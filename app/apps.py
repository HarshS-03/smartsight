import os
import sys
from django.apps import AppConfig


class AppConfig(AppConfig):
    name = 'app'

    def ready(self):
        # Skip warmup for administrative commands
        if len(sys.argv) > 1:
            cmd = sys.argv[1]
            if cmd in ['makemigrations', 'migrate', 'loaddata', 'dumpdata', 'collectstatic', 'createsuperuser', 'shell', 'test', 'check']:
                return

        import app.signals  # noqa

        # We skip AI Pre-Warm here so the server boots up instantly.
        # Models will be lazy-loaded on the first API request instead.
        pass

