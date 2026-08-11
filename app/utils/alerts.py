import os
import time
import uuid
import json
import threading
import requests
from datetime import datetime
from django.conf import settings
from app.models import RecognitionLog, Person, PersonImage, Notification
from django.utils import timezone
from app.services.notification_service import send_fcm_push

_pending_alerts = {}
_unknown_cooldowns = {}
UNKNOWN_COOLDOWN_SECONDS = 3600
PENDING_ALERT_TIMEOUT = 900  # 15 minutes expiration timeout
_polling_started = False


def handle_admin_response(action, alert_id, cb_id, chat_id, message_id):
    telegram_bot_api = os.environ.get("telegram_bot_api")
    if not telegram_bot_api:
        return
        
    alert = _pending_alerts.pop(alert_id, None)
    notif = None

    if alert:
        person_name = alert.get("person_name", "Unknown Target")
        confidence = alert.get("confidence", 0.0)
        frame_bytes = alert.get("frame_bytes", None)
        timestamp = alert.get("timestamp", datetime.now())
        camera_name = alert.get("camera_name", "Default Camera")
    else:
        # Fallback to DB Notification if in-memory dict cleared or server reloaded
        if message_id:
            notif = Notification.objects.filter(telegram_message_id=str(message_id)).first()
        if notif and notif.status == 'PENDING':
            time_diff = (timezone.now() - notif.created_at).total_seconds()
            if time_diff <= PENDING_ALERT_TIMEOUT:
                person_name = notif.title.replace("Intruder Alert (", "").replace(")", "").strip()
                confidence = 0.80
                frame_bytes = None
                timestamp = notif.created_at
                camera_name = "Default Camera"
            else:
                notif.status = 'EXPIRED'
                notif.save()
                notif = None

    if not alert and not notif:
        try:
            requests.post(
                f"https://api.telegram.org/bot{telegram_bot_api}/answerCallbackQuery",
                json={"callback_query_id": cb_id, "text": "This alert has already expired (15 min timeout) or been handled."}
            )
        except Exception as e:
            print(f"[Telegram Polling] Error answering callback query: {e}")
        return
    
    if action == "ok":
        relative_image_path = None
        if frame_bytes:
            try:
                unknown_dir = os.path.join(settings.MEDIA_ROOT, 'unknown')
                os.makedirs(unknown_dir, exist_ok=True)
                filename = f"unknown_{timestamp.strftime('%Y%m%d_%H%M%S')}_{alert_id}.jpg"
                file_path = os.path.join(unknown_dir, filename)
                with open(file_path, 'wb') as f:
                    f.write(frame_bytes)
                relative_image_path = f"unknown/{filename}"
                print(f"[Telegram Polling] Admin approved: saved unknown frame locally to: {relative_image_path}")
            except Exception as e:
                print(f"[Telegram Polling] Error saving unknown frame locally: {e}")
                
        try:
            RecognitionLog.objects.create(
                person_name=person_name,
                confidence=confidence,
                status='UNKNOWN',
                image_path=relative_image_path,
                camera_name=camera_name,
            )
            _unknown_cooldowns[person_name] = time.time()
            print(f"[Telegram Polling] Approved and logged: {person_name}, cooldown activated.")
        except Exception as e:
            print(f"[Telegram Polling] DB save error: {e}")

        # Record Notification in DB for Audit Trail
        try:
            db_id = alert.get("db_notification_id")
            notif = Notification.objects.filter(id=db_id).first() if db_id else None
            if not notif and message_id:
                notif = Notification.objects.filter(telegram_message_id=str(message_id)).first()

            if notif:
                notif.title = f"Intruder Approved ({person_name})"
                notif.message = f"Approved on Telegram for {camera_name} (Confidence: {confidence:.2f})"
                notif.status = 'APPROVED'
                notif.action_source = 'TELEGRAM'
                notif.processed_at = timezone.now()
                if relative_image_path:
                    notif.image_url = f"/media/{relative_image_path}"
                notif.save()
            else:
                Notification.objects.create(
                    title=f"Intruder Approved ({person_name})",
                    message=f"Approved on Telegram for {camera_name} (Confidence: {confidence:.2f})",
                    image_url=f"/media/{relative_image_path}" if relative_image_path else None,
                    status='APPROVED',
                    action_source='TELEGRAM',
                    processed_at=timezone.now(),
                    telegram_message_id=str(message_id) if message_id else None
                )
        except Exception as e:
            print(f"[Telegram Polling] Error saving Notification approval: {e}")
            
        new_caption = alert["details"] + "\n\n\u2705 <b>Status: APPROVED & LOGGED</b>"
        try:
            requests.post(
                f"https://api.telegram.org/bot{telegram_bot_api}/editMessageCaption",
                json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "caption": new_caption,
                    "parse_mode": "HTML"
                }
            )
            requests.post(
                f"https://api.telegram.org/bot{telegram_bot_api}/answerCallbackQuery",
                json={"callback_query_id": cb_id, "text": "Alert Approved & Logged!"}
            )
        except Exception as e:
            print(f"[Telegram Polling] Error editing Telegram caption: {e}")
            
    elif action == "cancel":
        print(f"[Telegram Polling] Admin canceled alert for {person_name}. Discarding.")

        # Record Cancellation Notification in DB for Audit Trail
        try:
            db_id = alert.get("db_notification_id")
            notif = Notification.objects.filter(id=db_id).first() if db_id else None
            if not notif and message_id:
                notif = Notification.objects.filter(telegram_message_id=str(message_id)).first()

            if notif:
                notif.title = f"Intruder Alert Cancelled ({person_name})"
                notif.message = f"Alert for {person_name} on {camera_name} was rejected/cancelled on Telegram."
                notif.status = 'CANCELLED'
                notif.action_source = 'TELEGRAM'
                notif.processed_at = timezone.now()
                notif.save()
            else:
                Notification.objects.create(
                    title=f"Intruder Alert Cancelled ({person_name})",
                    message=f"Alert for {person_name} was rejected/cancelled on Telegram.",
                    status='CANCELLED',
                    action_source='TELEGRAM',
                    processed_at=timezone.now(),
                    telegram_message_id=str(message_id) if message_id else None
                )
        except Exception as e:
            print(f"[Telegram Polling] Error saving Notification cancellation: {e}")

        new_caption = alert["details"] + "\n\n\u274c <b>Status: CANCELED & DISCARDED</b>"
        try:
            requests.post(
                f"https://api.telegram.org/bot{telegram_bot_api}/editMessageCaption",
                json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "caption": new_caption,
                    "parse_mode": "HTML"
                }
            )
            requests.post(
                f"https://api.telegram.org/bot{telegram_bot_api}/answerCallbackQuery",
                json={"callback_query_id": cb_id, "text": "Alert Canceled & Discarded."}
            )
        except Exception as e:
            print(f"[Telegram Polling] Error editing Telegram caption: {e}")


def check_alert_timeouts():
    telegram_bot_api = os.environ.get("telegram_bot_api")
    if not telegram_bot_api:
        return
        
    now = time.time()
    expired_ids = [aid for aid, alert in _pending_alerts.items() if now - alert["saved_at"] > PENDING_ALERT_TIMEOUT]
    
    for aid in expired_ids:
        alert = _pending_alerts.pop(aid, None)
        if not alert:
            continue
            
        person_name = alert["person_name"]
        confidence = alert["confidence"]
        frame_bytes = alert["frame_bytes"]
        timestamp = alert["timestamp"]
        chat_id = alert.get("chat_id")
        message_id = alert.get("message_id")
        camera_name = alert.get("camera_name", "Default Camera")
        
        relative_image_path = None
        if frame_bytes:
            try:
                unknown_dir = os.path.join(settings.MEDIA_ROOT, 'unknown')
                os.makedirs(unknown_dir, exist_ok=True)
                filename = f"unknown_{timestamp.strftime('%Y%m%d_%H%M%S')}_{aid}.jpg"
                file_path = os.path.join(unknown_dir, filename)
                with open(file_path, 'wb') as f:
                    f.write(frame_bytes)
                relative_image_path = f"unknown/{filename}"
            except Exception as e:
                print(f"[Timeout Engine] Error saving frame locally: {e}")
                
        try:
            RecognitionLog.objects.create(
                person_name=person_name,
                confidence=confidence,
                status='UNKNOWN',
                image_path=relative_image_path,
                camera_name=camera_name,
            )
            print(f"[Timeout Engine] Auto-saved alert due to 10-minute timeout: {person_name}")
        except Exception as e:
            print(f"[Timeout Engine] DB save error: {e}")

        # Update Notification status in DB to EXPIRED
        try:
            db_id = alert.get("db_notification_id")
            notif = Notification.objects.filter(id=db_id).first() if db_id else None
            if not notif and message_id:
                notif = Notification.objects.filter(telegram_message_id=str(message_id)).first()
            if notif:
                notif.status = 'EXPIRED'
                notif.processed_at = timezone.now()
                notif.save()
            else:
                Notification.objects.create(
                    title=f"Intruder Alert Expired ({person_name})",
                    message=f"No response received within timeout for {camera_name}.",
                    image_url=f"/media/{relative_image_path}" if relative_image_path else None,
                    status='EXPIRED',
                    processed_at=timezone.now()
                )
        except Exception as e:
            print(f"[Timeout Engine] Error updating Notification to EXPIRED: {e}")
            
        if chat_id and message_id:
            new_caption = alert["details"] + "\n\n\u23f1\ufe0f <b>Status: AUTO-SAVED (TIMEOUT)</b>"
            try:
                requests.post(
                    f"https://api.telegram.org/bot{telegram_bot_api}/editMessageCaption",
                    json={
                        "chat_id": chat_id,
                        "message_id": message_id,
                        "caption": new_caption,
                        "parse_mode": "HTML"
                    }
                )
            except Exception as e:
                print(f"[Timeout Engine] Error editing message caption: {e}")


def _start_telegram_polling():
    global _polling_started
    if _polling_started:
        return
    _polling_started = True
    
    def poll_loop():
        telegram_bot_api = os.environ.get("telegram_bot_api")
        if not telegram_bot_api:
            print("[Telegram Listener] No telegram_bot_api token found. Listener not starting.")
            return
        
        try:
            requests.get(f"https://api.telegram.org/bot{telegram_bot_api}/deleteWebhook")
        except Exception as e:
            print("[Telegram Listener] Error deleting webhook:", e)

        offset = 0
        print("[Telegram Listener] Started polling for callback queries...")
        
        while True:
            try:
                url = f"https://api.telegram.org/bot{telegram_bot_api}/getUpdates"
                params = {"timeout": 10, "offset": offset}
                response = requests.get(url, params=params, timeout=15)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        for update in data.get("result", []):
                            update_id = update["update_id"]
                            offset = update_id + 1
                            
                            if "callback_query" in update:
                                cb = update["callback_query"]
                                cb_id = cb["id"]
                                cb_data = cb.get("data", "")
                                message = cb.get("message", {})
                                chat_id = message.get("chat", {}).get("id")
                                message_id = message.get("message_id")
                                
                                if cb_data.startswith("ok_") or cb_data.startswith("cancel_"):
                                    action, alert_id = cb_data.split("_", 1)
                                    handle_admin_response(action, alert_id, cb_id, chat_id, message_id)
                
                check_alert_timeouts()
                
            except requests.exceptions.RequestException as net_err:
                print("[Telegram Listener] Network offline or Telegram API unreachable. Retrying in 10s...")
                time.sleep(10)
                continue
            except Exception as e:
                print(f"[Telegram Listener] Unexpected polling error: {e}")
                time.sleep(5)
            
    threading.Thread(target=poll_loop, daemon=True).start()


# Start polling listener automatically when module is loaded
_start_telegram_polling()


def send_alerts(*args, **kwargs):
    frame_bytes = None
    person_name = 'Unknown'
    is_known = False
    person_count = 1
    confidence = 0.0

    if len(args) == 5:
        frame_bytes, person_name, is_known, person_count, confidence = args
    elif len(args) == 3:
        frame_bytes, person_count, confidence = args
    elif len(args) >= 1:
        frame_bytes = args[0]
        if len(args) > 1:
            person_count = args[1]
        if len(args) > 2:
            confidence = args[2]

    if 'frame_bytes' in kwargs: frame_bytes = kwargs['frame_bytes']
    if 'person_name' in kwargs: person_name = kwargs['person_name']
    if 'is_known' in kwargs: is_known = kwargs['is_known']
    if 'person_count' in kwargs: person_count = kwargs['person_count']
    if 'confidence' in kwargs: confidence = kwargs['confidence']
    camera_name = kwargs.get('camera_name', 'Default Camera')
    clean_frame_bytes = kwargs.get('clean_frame_bytes', None)

    timestamp = datetime.now()
    timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
    confidence_pct = round(confidence * 100, 1)
    status_str = 'KNOWN' if is_known else 'UNKNOWN'

    telegram_bot_api = os.environ.get("telegram_bot_api")
    telegram_chat_id = os.environ.get("telegram_chat_id")

    if not telegram_bot_api or not telegram_chat_id:
        print(f"[Alert System Warning] Telegram credentials missing! bot_api={telegram_bot_api}, chat_id={telegram_chat_id}")

    if not is_known:
        current_time = time.time()
        cooldown_active = False
        if person_name in _unknown_cooldowns:
            time_passed = current_time - _unknown_cooldowns[person_name]
            if time_passed < UNKNOWN_COOLDOWN_SECONDS:
                cooldown_active = True
            else:
                del _unknown_cooldowns[person_name]

        if cooldown_active:
            relative_image_path = None
            bytes_to_save = clean_frame_bytes if clean_frame_bytes is not None else frame_bytes
            if bytes_to_save:
                try:
                    unknown_dir = os.path.join(settings.MEDIA_ROOT, 'unknown')
                    os.makedirs(unknown_dir, exist_ok=True)
                    filename = f"unknown_{timestamp.strftime('%Y%m%d_%H%M%S')}_{int(time.time())}.jpg"
                    file_path = os.path.join(unknown_dir, filename)
                    with open(file_path, 'wb') as f:
                        f.write(bytes_to_save)
                    relative_image_path = f"unknown/{filename}"
                except Exception as e:
                    print(f"[Alert Cooldown] Error saving unknown frame: {e}")

            try:
                RecognitionLog.objects.create(
                    person_name=person_name,
                    confidence=confidence,
                    status='UNKNOWN',
                    image_path=relative_image_path,
                    camera_name=camera_name,
                )
                print(f"[Alert Cooldown] Cooldown active. Auto-saved: {person_name}")
            except Exception as e:
                print(f"[Alert Cooldown] DB save error: {e}")

                # Telegram notification removed to prevent spam during cooldown
        else:
            alert_id = uuid.uuid4().hex[:12]
            status_icon = "\U0001f6a8"
            alert_details = (
                f"{status_icon} <b>Security Alert - Smart Sight</b>\n"
                f"\n"
                f"\U0001f4f9 <b>Camera:</b> {camera_name}\n"
                f"\U0001f464 <b>Person:</b> {person_name}\n"
                f"\U0001f465 <b>Count:</b> {person_count} person(s) detected\n"
                f"\U0001f3af <b>Confidence:</b> {confidence_pct}%\n"
                f"\U0001f552 <b>Time:</b> {timestamp_str}\n"
                f"\U0001f4cc <b>Status:</b> {status_str}"
            )

            # Save intruder frame to media folder immediately so image is always available for notifications
            relative_image_path = None
            bytes_to_save = clean_frame_bytes if clean_frame_bytes is not None else frame_bytes
            if bytes_to_save:
                try:
                    alerts_dir = os.path.join(settings.MEDIA_ROOT, 'alerts')
                    os.makedirs(alerts_dir, exist_ok=True)
                    filename = f"alert_{timestamp.strftime('%Y%m%d_%H%M%S')}_{alert_id}.jpg"
                    file_path = os.path.join(alerts_dir, filename)
                    with open(file_path, 'wb') as f:
                        f.write(bytes_to_save)
                    relative_image_path = f"alerts/{filename}"
                except Exception as e:
                    print(f"[Alert System] Error saving alert frame locally: {e}")

            # Initialize pending alert dictionary entry
            _pending_alerts[alert_id] = {
                "person_name": person_name,
                "confidence": confidence,
                "frame_bytes": clean_frame_bytes if clean_frame_bytes is not None else frame_bytes,
                "saved_at": time.time(),
                "timestamp": timestamp,
                "details": alert_details,
                "camera_name": camera_name,
                "db_notification_id": None
            }

            # Immediately log PENDING Notification in DB for Web/Mobile Realtime Audit Log
            try:
                notif = Notification.objects.create(
                    title=f"Intruder Alert ({person_name})",
                    message=f"Unrecognized person detected on {camera_name} (Confidence: {confidence_pct}%).",
                    image_url=f"/media/{relative_image_path}" if relative_image_path else None,
                    status='PENDING'
                )
                _pending_alerts[alert_id]["db_notification_id"] = notif.id
                
                # Dispatch FCM Push Notification immediately
                try:
                    send_fcm_push(notif, notif.image_url)
                except Exception as fcm_err:
                    print(f"[Alert System] Error dispatching FCM push: {fcm_err}")
            except Exception as db_err:
                print(f"[Alert System] Error saving pending Notification to DB: {db_err}")

            if telegram_bot_api and telegram_chat_id:
                try:
                    url = f"https://api.telegram.org/bot{telegram_bot_api}/sendPhoto"
                    files = {'photo': ('alert.jpg', frame_bytes, 'image/jpeg')}
                    reply_markup = {
                        "inline_keyboard": [
                            [
                                {"text": "OK \u2705", "callback_data": f"ok_{alert_id}"},
                                {"text": "Cancel \u274c", "callback_data": f"cancel_{alert_id}"}
                            ]
                        ]
                    }
                    data = {
                        'chat_id': telegram_chat_id,
                        'caption': alert_details,
                        'parse_mode': 'HTML',
                        'reply_markup': json.dumps(reply_markup)
                    }
                    response = requests.post(url, files=files, data=data)
                    if response.status_code == 200:
                        resp_json = response.json()
                        if resp_json.get("ok"):
                            msg_id = resp_json["result"]["message_id"]
                            if alert_id in _pending_alerts:
                                _pending_alerts[alert_id]["message_id"] = msg_id
                                _pending_alerts[alert_id]["chat_id"] = telegram_chat_id
                                db_id = _pending_alerts[alert_id].get("db_notification_id")
                                if db_id:
                                    Notification.objects.filter(id=db_id).update(telegram_message_id=str(msg_id))
                        print("[Alert] Telegram OK/Cancel alert sent successfully.")
                    else:
                        print(f"[Alert] Telegram API error: {response.text}")
                except Exception as e:
                    print(f"[Alert] Telegram send error: {e}")
    else:
        try:
            RecognitionLog.objects.create(
                person_name=person_name,
                confidence=confidence,
                status=status_str,
                image_path=None,
                camera_name=camera_name,
            )
            print(f"[Alert] Saved Known to DB: {person_name}, confidence={confidence_pct}%")
            
            clean_frame_bytes = kwargs.get('clean_frame_bytes')
            if clean_frame_bytes:
                names = [n.strip() for n in person_name.split(',')]
                for name in names:
                    if name and name.lower() != 'unknown':
                        person = Person.objects.filter(name__iexact=name).first()
                        if person:
                            dataset_dir = os.path.join(settings.MEDIA_ROOT, 'dataset', person.name)
                            os.makedirs(dataset_dir, exist_ok=True)
                            
                            filename = f"auto_{timestamp.strftime('%Y%m%d_%H%M%S')}_{int(time.time())}.jpg"
                            file_path = os.path.join(dataset_dir, filename)
                            
                            with open(file_path, 'wb') as f:
                                f.write(clean_frame_bytes)
                                
                            relative_path = f"dataset/{person.name}/{filename}"
                            PersonImage.objects.create(person=person, image=relative_path)
                            print(f"[Self-Learning Engine] Automatically saved training sample for {person.name}: {relative_path}")
        except Exception as e:
            print(f"[Self-Learning Engine] Error saving auto-training image: {e}")
