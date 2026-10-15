import queue
import json
import logging
import threading

logger = logging.getLogger(__name__)

class NotificationEventBus:
    """
    Lightweight, thread-safe in-memory pub/sub broker for Server-Sent Events (SSE).
    Allows instant event dispatching from API actions, Telegram bot, or camera detections
    directly to connected web/mobile clients with 0ms delay.
    """
    def __init__(self):
        self._subscribers = set()
        self._lock = threading.Lock()

    def subscribe(self) -> queue.Queue:
        """Register a new client listener stream."""
        q = queue.Queue(maxsize=100)
        with self._lock:
            self._subscribers.add(q)
            logger.debug(f"[SSE Bus] Client subscribed. Total clients: {len(self._subscribers)}")
        return q

    def unsubscribe(self, q: queue.Queue):
        """Clean up disconnected client stream."""
        with self._lock:
            self._subscribers.discard(q)
            logger.debug(f"[SSE Bus] Client unsubscribed. Remaining clients: {len(self._subscribers)}")

    def publish(self, event_type: str, data: dict):
        """
        Broadcast an event to all connected clients.
        Example event_type: 'NOTIFICATION_NEW', 'ACTION_UPDATE', 'REFRESH_UNREAD'
        """
        payload = {
            'event': event_type,
            'data': data
        }
        raw_msg = f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"

        with self._lock:
            dead_queues = []
            for q in self._subscribers:
                try:
                    q.put_nowait(raw_msg)
                except queue.Full:
                    dead_queues.append(q)
                except Exception:
                    dead_queues.append(q)

            for dq in dead_queues:
                self._subscribers.discard(dq)

# Global Singleton
event_bus = NotificationEventBus()
