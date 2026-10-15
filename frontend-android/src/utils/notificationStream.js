/**
 * Real-time Server-Sent Events (SSE) Client
 * Connects to /api/notifications/stream/ to receive instant real-time events:
 *  - 'ACTION_UPDATE' (Admin approved/cancelled an alert via Telegram or App)
 *  - 'NOTIFICATION_NEW' (New security alert detected)
 * Eliminates redundant background HTTP polling completely.
 */

let eventSource = null;
const listeners = new Set();
let reconnectTimer = null;

const getStreamUrl = () => {
  const savedIp = localStorage.getItem('server_ip');
  if (savedIp) {
    const cleanIp = savedIp.trim().replace(/\/+$/, '');
    const base = cleanIp.startsWith('http') ? cleanIp : `http://${cleanIp}`;
    return `${base}/api/notifications/stream/`;
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  return `${envUrl.replace(/\/+$/, '')}/notifications/stream/`;
};

export const startNotificationStream = () => {
  if (eventSource) return;

  try {
    const url = getStreamUrl();
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      // console.log('[SSE Stream] Connected to real-time notification bus.');
    };

    // Generic Message Handler
    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        notifyListeners(payload.event || 'message', payload.data || payload);
      } catch (err) {
        // silent parse error
      }
    };

    // Specific event listeners
    eventSource.addEventListener('ACTION_UPDATE', (e) => {
      try {
        const payload = JSON.parse(e.data);
        notifyListeners('ACTION_UPDATE', payload.data || payload);
      } catch (err) {}
    });

    eventSource.addEventListener('NOTIFICATION_NEW', (e) => {
      try {
        const payload = JSON.parse(e.data);
        notifyListeners('NOTIFICATION_NEW', payload.data || payload);
      } catch (err) {}
    });

    eventSource.addEventListener('SCAN_NEW', (e) => {
      try {
        const payload = JSON.parse(e.data);
        notifyListeners('SCAN_NEW', payload.data || payload);
      } catch (err) {}
    });

    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      // Reconnect after 5 seconds
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          startNotificationStream();
        }, 5000);
      }
    };
  } catch (err) {
    console.warn('[SSE Stream] Could not initialize EventSource:', err);
  }
};

export const stopNotificationStream = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

export const subscribeNotificationEvents = (callback) => {
  listeners.add(callback);
  if (!eventSource) {
    startNotificationStream();
  }
  return () => {
    listeners.delete(callback);
  };
};

const notifyListeners = (eventType, data) => {
  listeners.forEach((cb) => {
    try {
      cb(eventType, data);
    } catch (err) {
      console.error('[SSE Listener Error]:', err);
    }
  });
};
