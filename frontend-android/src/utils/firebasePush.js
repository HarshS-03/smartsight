import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Badge } from '@capawesome/capacitor-badge';
import { updateAppBadge } from './badgeHelper';
import API from '../api/axios';

let _fcmInitialized = false;

export const initFirebasePush = async () => {
  if (_fcmInitialized) {
    console.log('[FCM Push] Already initialized, skipping.');
    return;
  }
  if (Capacitor.getPlatform() === 'web') {
    console.log('[FCM Push] Push notifications not supported on web platform.');
    return;
  }
  _fcmInitialized = true;

  try {
    const permStatus = await PushNotifications.checkPermissions();
    let status = permStatus.receive;

    if (status !== 'granted') {
      const requestRes = await PushNotifications.requestPermissions();
      status = requestRes.receive;
    }

    // Attach listeners BEFORE calling register() so registration events are never missed
    PushNotifications.addListener('registration', async (tokenData) => {
      console.log('[FCM Push] Device Token:', tokenData.value);
      try {
        await API.post('/notifications/register_push_token/', {
          device_token: tokenData.value,
          platform: 'android'
        });
        console.log('[FCM Push] Registered push token with server!');
      } catch (err) {
        console.warn('[FCM Push] Failed to register token with backend:', err);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.warn('[FCM Push] Registration error:', error);
    });

    if (status === 'granted') {
      try {
        await PushNotifications.createChannel({
          id: 'smart_sight_alerts',
          name: 'Smart Sight Intruders',
          description: 'High priority security alerts for intruders',
          importance: 5, // MAX importance for loud alerts
          visibility: 1, // VISIBILITY_PUBLIC
          sound: 'smart_sight_alert', // Name of the file in res/raw
          vibration: true
        });
      } catch (e) {
        console.log('[FCM Push] Channel creation not supported/failed', e);
      }
      await PushNotifications.register();
    }

    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('[FCM Push] Received push notification in foreground:', notification);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refresh-notifications'));
        if (window.showToast) {
          window.showToast(notification.body || notification.title, 'danger', notification.title || 'SECURITY ALERT');
        }
      }

      // Update Home Screen App Badge (like Instagram)
      try {
        const current = await Badge.get();
        await updateAppBadge((current.count || 0) + 1);
      } catch (badgeErr) {
        console.warn('[FCM Push] Badge update error:', badgeErr);
      }

      // Schedule local status bar notification for foreground mode
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: notification.title || 'Security Alert',
              body: notification.body || 'Intruder detection event recorded.',
              id: Math.floor(Math.random() * 100000),
              schedule: { at: new Date(Date.now() + 100) },
              smallIcon: 'ic_stat_notification',
              iconColor: '#0d6efd',
              sound: 'smart_sight_alert',
              channelId: 'smart_sight_alerts'
            }
          ]
        });
      } catch (e) {
        console.warn('[FCM Push] Local notification schedule error:', e);
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[FCM Push] Tapped push notification:', notification);
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/notifications';
      }
    });

  } catch (err) {
    console.warn('[FCM Push] Not supported or push permission denied:', err);
  }
};
