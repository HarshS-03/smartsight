import os
from urllib.parse import urlparse
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.conf import settings
from .models import Notification, RecognitionLog


@receiver(post_delete, sender=Notification)
def auto_delete_file_on_notification_delete(sender, instance, **kwargs):
    """
    Deletes image file from filesystem (e.g. media/alerts/...) when corresponding
    Notification is deleted.
    """
    if not instance.image_url:
        return

    try:
        rel_path = instance.image_url.split('?')[0]
        if rel_path.startswith(('http://', 'https://')):
            rel_path = urlparse(rel_path).path

        if rel_path.startswith('/media/'):
            rel_path = rel_path[len('/media/'):]
        elif rel_path.startswith('media/'):
            rel_path = rel_path[len('media/'):]
        elif rel_path.startswith('/'):
            rel_path = rel_path[1:]

        full_path = os.path.normpath(os.path.join(settings.MEDIA_ROOT, rel_path))
        media_root = os.path.normpath(settings.MEDIA_ROOT)

        # Security check: ensure path resides inside MEDIA_ROOT
        if full_path.startswith(media_root) and os.path.isfile(full_path):
            os.remove(full_path)
            print(f"[Signal] Deleted alert image file: {full_path}")
    except Exception as e:
        print(f"[Signal] Error deleting Notification image file: {e}")


@receiver(post_delete, sender=RecognitionLog)
def auto_delete_file_on_recognition_log_delete(sender, instance, **kwargs):
    """
    Deletes image file from filesystem when corresponding RecognitionLog is deleted.
    """
    if not instance.image_path:
        return

    try:
        full_path = os.path.normpath(os.path.join(settings.MEDIA_ROOT, instance.image_path))
        media_root = os.path.normpath(settings.MEDIA_ROOT)

        if full_path.startswith(media_root) and os.path.isfile(full_path):
            os.remove(full_path)
            print(f"[Signal] Deleted log image file: {full_path}")
    except Exception as e:
        print(f"[Signal] Error deleting RecognitionLog image file: {e}")
