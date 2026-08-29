package com.smartsight.app;

import android.app.NotificationManager;
import android.content.Context;
import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Native Firebase Messaging Service that intercepts ALL incoming FCM pushes
 * (foreground + background + killed) and updates the launcher app icon badge.
 */
public class SmartSightFirebaseService extends FirebaseMessagingService {

    private static final String TAG = "SmartSightFCM";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Log.d(TAG, "Push received from: " + remoteMessage.getFrom());

        // Update launcher badge count
        try {
            int badgeCount = 0;

            // Try to get count from data payload first
            String countStr = remoteMessage.getData().get("notification_count");
            if (countStr != null) {
                try {
                    badgeCount = Integer.parseInt(countStr);
                } catch (NumberFormatException ignored) {}
            }

            // Fallback: count active notifications in the status bar + 1
            if (badgeCount <= 0) {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    badgeCount = nm.getActiveNotifications().length + 1;
                } else {
                    badgeCount = 1;
                }
            }

            BadgeManager.setBadgeCount(getApplicationContext(), badgeCount);
            Log.d(TAG, "Badge count set to: " + badgeCount);
        } catch (Throwable t) {
            Log.w(TAG, "Badge update failed silently: " + t.getMessage());
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "FCM token refreshed: " + token.substring(0, Math.min(16, token.length())) + "...");
        // Token registration is handled by the Capacitor Push Plugin on the JS side
    }
}
