package com.smartsight.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.util.Log;
import me.leolin.shortcutbadger.ShortcutBadger;

/**
 * Universal BadgeManager for Android
 * Supports Samsung, Xiaomi/MIUI, Huawei, Oppo, Realme, OnePlus, Vivo, Sony, HTC,
 * with graceful fallback for Stock Android / Google Pixel.
 */
public final class BadgeManager {

    private static final String TAG = "BadgeManager";
    public static final String DEFAULT_CHANNEL_ID = "smart_sight_alerts";

    private BadgeManager() {
        // Private constructor to prevent instantiation
    }

    /**
     * Sets the application launcher icon badge count.
     * Fails silently if the OEM launcher is unsupported.
     *
     * @param context Application or Activity Context
     * @param count   Badge count number (>= 0). If 0, clears the badge.
     */
    public static void setBadgeCount(Context context, int count) {
        if (context == null) {
            return;
        }

        try {
            if (count <= 0) {
                clearBadge(context);
                return;
            }

            // 1. Primary: OEM Custom Launchers via ShortcutBadger
            boolean isShortcutBadgerSuccess = ShortcutBadger.applyCount(context.getApplicationContext(), count);

            // 2. Secondary: Ensure NotificationChannel badge support for Stock Android 8.0+ (Oreo / Pixel)
            ensureChannelBadgeEnabled(context);

            if (!isShortcutBadgerSuccess) {
                Log.d(TAG, "ShortcutBadger: Launcher does not support direct badge intent, relying on system NotificationChannel.");
            }
        } catch (Throwable t) {
            // Catch all Throwables (Exception, Error, NoSuchMethodError, etc.) to ensure silent failure
            Log.w(TAG, "Silently handled badge setting failure: " + t.getMessage());
        }
    }

    /**
     * Clears the application launcher icon badge count.
     * Fails silently if unsupported.
     *
     * @param context Application or Activity Context
     */
    public static void clearBadge(Context context) {
        if (context == null) {
            return;
        }

        try {
            ShortcutBadger.removeCount(context.getApplicationContext());
        } catch (Throwable t) {
            Log.w(TAG, "Silently handled badge clearing failure: " + t.getMessage());
        }
    }

    /**
     * Ensures the default NotificationChannel has setShowBadge(true) enabled on Android 8.0+ (API 26+)
     * for Stock Android (Pixel / Motorola) badge dot support.
     */
    private static void ensureChannelBadgeEnabled(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null) {
                    NotificationChannel channel = manager.getNotificationChannel(DEFAULT_CHANNEL_ID);
                    if (channel != null && !channel.canShowBadge()) {
                        channel.setShowBadge(true);
                        manager.createNotificationChannel(channel);
                    }
                }
            } catch (Throwable ignored) {
                // Silent fail
            }
        }
    }
}
