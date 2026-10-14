import os
from urllib.parse import urlparse
from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver
from django.conf import settings
from .models import Notification, RecognitionLog, Person, PersonImage


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


@receiver(post_delete, sender=Person)
def clear_gallery_on_person_delete(sender, instance, **kwargs):
    """
    Remove all in-memory gallery embeddings when a Person is deleted.
    DB embeddings are cascade-deleted automatically by Django.
    """
    try:
        from app.utils.embedding_engine import get_gallery
        get_gallery().remove_person(instance.id)
        print(f"[Signal] Cleared gallery embeddings for deleted person: {instance.name}")
    except Exception as e:
        print(f"[Signal] Error clearing gallery on person delete: {e}")


@receiver(post_delete, sender=PersonImage)
def refresh_gallery_on_image_delete(sender, instance, **kwargs):
    """
    When a PersonImage is deleted, its PersonEmbedding rows are cascade-deleted.
    Refresh the in-memory gallery for that person.
    """
    try:
        from app.utils.embedding_engine import get_gallery
        get_gallery().remove_embedding_by_source(instance.person_id, instance.id)
        print(f"[Signal] Refreshed gallery embeddings after image delete for person ID: {instance.person_id}")
    except Exception as e:
        print(f"[Signal] Error refreshing gallery on image delete: {e}")


from django.db.models.signals import post_save
import threading
from django import db

_debounce_timers = {}
_debounce_lock = threading.Lock()

def _trigger_debounced_embedding(pid, delay=2.0):
    with _debounce_lock:
        existing_timer = _debounce_timers.get(pid)
        if existing_timer:
            try:
                existing_timer.cancel()
            except Exception:
                pass

        def _run():
            with _debounce_lock:
                _debounce_timers.pop(pid, None)
            try:
                from app.utils.embedding_engine import compute_person_embeddings
                print(f"[Signal] Starting debounced embedding computation for person ID: {pid}")
                compute_person_embeddings(pid)
            except Exception as err:
                print(f"[Signal] Error in debounced embedding computation for person ID {pid}: {err}")
            finally:
                db.connections.close_all()

        timer = threading.Timer(delay, _run)
        timer.daemon = True
        _debounce_timers[pid] = timer
        timer.start()
        print(f"[Signal] Scheduled debounced embedding computation for person ID: {pid} (in {delay}s)")


@receiver(post_save, sender=PersonImage)
def compute_embedding_on_image_save(sender, instance, created, **kwargs):
    """
    When a new PersonImage is saved, compute and store its embedding (debounced).
    """
    if kwargs.get('raw', False):
        return

    if created:
        try:
            _trigger_debounced_embedding(instance.person_id, delay=2.0)
        except Exception as e:
            print(f"[Signal] Error triggering embedding computation: {e}")


