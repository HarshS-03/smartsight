import { Badge } from '@capawesome/capacitor-badge';

/**
 * Updates the native Android / iOS Launcher App Icon Badge Count.
 * @param {number} count - Unread notification count (0 clears badge)
 */
export const updateAppBadge = async (count) => {
  try {
    const isSupported = await Badge.isSupported();
    if (isSupported && isSupported.isSupported) {
      if (count > 0) {
        await Badge.set({ count: Math.max(0, count) });
      } else {
        await Badge.clear();
      }
    }
  } catch (err) {
    console.warn('[BadgeHelper] Unable to update app badge:', err);
  }
};

export const clearAppBadge = async () => {
  try {
    const isSupported = await Badge.isSupported();
    if (isSupported && isSupported.isSupported) {
      await Badge.clear();
    }
  } catch (err) {
    console.warn('[BadgeHelper] Unable to clear app badge:', err);
  }
};
