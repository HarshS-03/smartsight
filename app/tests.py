import os
from django.test import TestCase
from django.conf import settings
from app.models import Notification, RecognitionLog


class NotificationImageDeletionTestCase(TestCase):
    def test_notification_image_deleted_from_disk_on_model_delete(self):
        alerts_dir = os.path.join(settings.MEDIA_ROOT, 'alerts')
        os.makedirs(alerts_dir, exist_ok=True)
        dummy_filename = "test_alert_deletion.jpg"
        dummy_filepath = os.path.join(alerts_dir, dummy_filename)

        with open(dummy_filepath, "wb") as f:
            f.write(b"dummy image data for alert test")

        self.assertTrue(os.path.exists(dummy_filepath))

        notif = Notification.objects.create(
            title="Test Intruder Alert",
            message="Test message",
            image_url=f"/media/alerts/{dummy_filename}",
            status="PENDING"
        )

        # Delete notification (triggers post_delete signal)
        notif.delete()

        # File should be automatically removed from media/alerts
        self.assertFalse(os.path.exists(dummy_filepath))

    def test_recognition_log_image_deleted_from_disk_on_model_delete(self):
        alerts_dir = os.path.join(settings.MEDIA_ROOT, 'alerts')
        os.makedirs(alerts_dir, exist_ok=True)
        dummy_filename = "test_log_deletion.jpg"
        dummy_filepath = os.path.join(alerts_dir, dummy_filename)

        with open(dummy_filepath, "wb") as f:
            f.write(b"dummy image data for log test")

        self.assertTrue(os.path.exists(dummy_filepath))

        log = RecognitionLog.objects.create(
            person_name="Unknown Person",
            confidence=0.92,
            status="UNKNOWN",
            image_path=f"alerts/{dummy_filename}"
        )

        # Delete log (triggers post_delete signal)
        log.delete()

        # File should be automatically removed from disk
        self.assertFalse(os.path.exists(dummy_filepath))



