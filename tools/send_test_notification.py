#!/usr/bin/env python3
"""
Send a test notification using the project's notification service.

Usage examples:
  python tools/send_test_notification.py --title "Test" --message "Hello world"
  python tools/send_test_notification.py --title "Image" --message "With image" --image_url "/media/alerts/test.jpg"
  python tools/send_test_notification.py --title "ToUser" --message "Private" --user_id 3
"""
import os
import sys
import argparse
from pathlib import Path

# Ensure project root is on sys.path (assumes this file is at tools/)
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "smartsight.settings")

import django


def build_parser():
    parser = argparse.ArgumentParser(description="Send a test notification via the project's notification service")
    parser.add_argument('positional', nargs='*', help='Optional positional text used as title/message when flags are omitted')
    parser.add_argument('--title', default=None, help='Notification title')
    parser.add_argument('--message', default=None, help='Notification message/body')
    parser.add_argument('--image_url', default=None, help='Optional image URL or path to include')
    parser.add_argument('--user_id', type=int, default=None, help='Optional user id to attach to the notification')
    return parser


def resolve_notification_args(args):
    if args.title is not None or args.message is not None:
        title = args.title or "Notification"
        message = args.message or ""
        return title, message

    if args.positional:
        title = args.positional[0]
        message = " ".join(args.positional[1:]) if len(args.positional) > 1 else ""
        return title, message

    return "Notification", ""


def main():
    django.setup()

    parser = build_parser()
    args = parser.parse_args()
    title, message = resolve_notification_args(args)

    if not title and not message:
        parser.error("the following arguments are required: --title, --message")

    user = None
    if args.user_id:
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.filter(pk=args.user_id).first()
            if not user:
                print(f"[Warning] User id {args.user_id} not found; continuing without user association.")
        except Exception as e:
            print(f"[Warning] Could not lookup user: {e}")
            user = None

    try:
        from app.services.notification_service import dispatch_notification

        notif = dispatch_notification(
            title=title,
            message=message,
            image_url=args.image_url,
            user=user
        )

        print(f"Created Notification id={notif.id} status={notif.status}")
    except Exception as e:
        print(f"Failed to send test notification: {e}")

if __name__ == '__main__':
    main()
