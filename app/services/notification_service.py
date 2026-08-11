import os
import requests
from django.conf import settings
from app.models import Notification, DevicePushToken

# Firebase Admin SDK Import (Safe fallback if credentials JSON not yet added)
try:
    import firebase_admin
    from firebase_admin import credentials, messaging

    FIREBASE_KEY_PATH = os.path.join(str(settings.BASE_DIR), "firebase-credentials.json")
    key_exists = os.path.exists(FIREBASE_KEY_PATH)
    print(f"[FCM Init] Resolved FIREBASE_KEY_PATH: '{FIREBASE_KEY_PATH}' (Exists: {key_exists})")

    if key_exists and not firebase_admin._apps:
        cred = credentials.Certificate(FIREBASE_KEY_PATH)
        firebase_admin.initialize_app(cred)
        FCM_INITIALIZED = True
        print("[FCM Init] Firebase Admin initialized successfully.")
    elif len(firebase_admin._apps) > 0:
        FCM_INITIALIZED = True
        print("[FCM Init] Firebase Admin app already initialized.")
    else:
        FCM_INITIALIZED = False
        print(f"[FCM Warning] Firebase credentials file missing at '{FIREBASE_KEY_PATH}'. FCM push notifications disabled.")
except Exception as e:
    print(f"[FCM Warning] Firebase Admin setup skipped or credentials file missing: {e}")
    FCM_INITIALIZED = False


def _prune_invalid_token(token):
    """
    Remove a device token from the DB if FCM reports it as dead
    (uninstalled app, expired token, etc). Keeps the token table clean
    so future sends don't keep failing against tokens that will never work.
    """
    try:
        deleted, _ = DevicePushToken.objects.filter(token=token).delete()
        if deleted:
            print(f"[FCM Cleanup] Removed stale/invalid token: {token[:16]}...")
    except Exception as e:
        print(f"[FCM Cleanup] Error removing stale token: {e}")


def send_fcm_push(notification, image_url=None):
    """
    Dispatch FCM Push Notification to all Registered Android Tokens
    """
    if not FCM_INITIALIZED:
        print("[FCM Push Warning] FCM is not initialized. Ensure firebase-credentials.json exists at project root.")
        return

    try:
        tokens = list(DevicePushToken.objects.values_list('token', flat=True))
        if tokens:
            # Format image_url to full absolute HTTP/HTTPS URL for FCM client
            full_image_url = None
            if image_url:
                if str(image_url).startswith('http://') or str(image_url).startswith('https://'):
                    full_image_url = str(image_url)
                else:
                    server_url = os.environ.get("SERVER_PUBLIC_URL", "http://127.0.0.1:8000")
                    full_image_url = f"{server_url.rstrip('/')}{image_url}"

            unread_count = Notification.objects.filter(status='PENDING').count() or 1

            fcm_notification = messaging.Notification(
                title=notification.title,
                body=notification.message,
                image=full_image_url if full_image_url else None
            )
            fcm_android = messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    icon='ic_stat_notification',
                    sound='smart_sight_alert',
                    channel_id='smart_sight_alerts',
                    default_sound=True,
                    default_vibrate_timings=True,
                    priority='high',
                    notification_count=unread_count,
                )
            )
            fcm_data = {
                "notification_id": str(notification.id),
                "status": str(notification.status),
                "image_url": str(full_image_url) if full_image_url else "",
                "actions": "approve,cancel"
            }

            success_count = 0
            failure_count = 0
            try:
                # Try newer API first (firebase_admin >= 6.5)
                fcm_message = messaging.MulticastMessage(
                    notification=fcm_notification,
                    android=fcm_android,
                    data=fcm_data,
                    tokens=tokens
                )
                response = messaging.send_each_for_multicast(fcm_message)
                success_count = response.success_count
                failure_count = response.failure_count

                # Log the exact reason for each failure and prune dead tokens
                for token, send_response in zip(tokens, response.responses):
                    if not send_response.success:
                        err = send_response.exception
                        err_code = getattr(err, "code", None) or type(err).__name__
                        print(f"[FCM Push] Failed for token {token[:16]}...: {err_code} - {err}")
                        if err_code in ("UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"):
                            _prune_invalid_token(token)

            except AttributeError:
                # Fallback: send individually (older firebase_admin versions)
                for token in tokens:
                    try:
                        msg = messaging.Message(
                            notification=fcm_notification,
                            android=fcm_android,
                            data=fcm_data,
                            token=token
                        )
                        messaging.send(msg)
                        success_count += 1
                    except messaging.UnregisteredError:
                        failure_count += 1
                        _prune_invalid_token(token)
                    except Exception as send_err:
                        failure_count += 1
                        print(f"[FCM Push] Failed for token {token[:16]}...: {send_err}")

            print(f"[FCM Push] Sent push to {success_count} devices ({failure_count} failed).")
        else:
            print("[FCM Push Warning] No registered device tokens found in database. Push notification skipped.")
    except Exception as fcm_err:
        print(f"[FCM Dispatch Error]: {fcm_err}")


def dispatch_notification(title, message, image_url=None, user=None):
    """
    Creates a DB Notification record, sends Telegram Alert,
    and dispatches FCM Native Push Notification simultaneously.
    """
    # 1. Save Notification in Database
    notification = Notification.objects.create(
        title=title,
        message=message,
        image_url=image_url,
        status='PENDING',
        user=user
    )

    # 2. Dispatch to Telegram Bot (Optional environment variables)
    telegram_bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    telegram_chat_id = os.environ.get("TELEGRAM_CHAT_ID")

    if telegram_bot_token and telegram_chat_id:
        try:
            telegram_url = f"https://api.telegram.org/bot{telegram_bot_token}/sendPhoto"
            caption = f"🚨 *{title}*\n{message}\n\n*Status:* Pending Approval"

            # Inline keyboard buttons for Approve and Cancel
            reply_markup = {
                "inline_keyboard": [
                    [
                        {"text": "✅ Approve", "callback_data": f"approve_{notification.id}"},
                        {"text": "❌ Cancel", "callback_data": f"cancel_{notification.id}"}
                    ]
                ]
            }

            payload = {
                "chat_id": telegram_chat_id,
                "caption": caption,
                "parse_mode": "Markdown",
                "reply_markup": reply_markup
            }

            if image_url:
                payload["photo"] = image_url
                res = requests.post(telegram_url, json=payload, timeout=5)
                if res.status_code == 200:
                    res_json = res.json()
                    notification.telegram_message_id = str(res_json.get("result", {}).get("message_id", ""))
                    notification.save()
        except Exception as err:
            print(f"[Telegram Dispatch Error]: {err}")

    # 3. Dispatch FCM Push Notification
    send_fcm_push(notification, image_url)

    return notification