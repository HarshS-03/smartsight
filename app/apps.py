import os
import sys
from django.apps import AppConfig


class AppConfig(AppConfig):
    name = 'app'

    def ready(self):
        import app.signals  # noqa

        # Skip warmup for administrative commands
        if len(sys.argv) > 1:
            cmd = sys.argv[1]
            if cmd in ['makemigrations', 'migrate', 'collectstatic', 'createsuperuser', 'shell', 'test', 'check']:
                return

        # In Django runserver with reloader, only execute in the worker child process
        is_runserver = any('runserver' in arg for arg in sys.argv)
        is_reloader_child = os.environ.get('RUN_MAIN') == 'true'
        if is_runserver and not is_reloader_child:
            return

        # Pre-warm AI Models and Gallery SYNCHRONOUSLY at server boot
        try:
            import numpy as np
            from app.utils.embedding_engine import _get_face_detector, _get_arcface, get_gallery, embed_face_crop

            print("[AI Pre-Warm] Initializing YOLOv8-Face ONNX detector & ArcFace recognizer...")
            detector = _get_face_detector()
            dummy_img = np.zeros((480, 640, 3), dtype=np.uint8)
            detector(dummy_img, conf=0.45, verbose=False, imgsz=640)

            dummy_crop = np.zeros((112, 112, 3), dtype=np.uint8)
            embed_face_crop(dummy_crop)

            gallery = get_gallery()
            gallery.ensure_loaded()
            print(f"[AI Pre-Warm] Ready! YOLO Detection + ArcFace Recognition active. Gallery stats: {gallery.stats()}")
        except Exception as e:
            print(f"[AI Pre-Warm] Warning during initialization: {e}")

