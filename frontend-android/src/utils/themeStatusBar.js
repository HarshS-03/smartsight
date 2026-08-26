/**
 * themeStatusBar.js
 * Unified Theme & Status Bar synchronizer for Web, Mobile Browsers & Capacitor Native Android.
 */
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function syncThemeAndStatusBar(theme) {
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0b0f19' : '#ffffff';

  // 1. Set HTML attribute
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-bs-theme', theme);
  }

  // 2. Update Web / Mobile Browser <meta name="theme-color">
  if (typeof document !== 'undefined') {
    try {
      const allThemedMetas = document.querySelectorAll('meta[name="theme-color"]');
      if (allThemedMetas.length > 0) {
        allThemedMetas.forEach(m => {
          m.setAttribute('content', bgColor);
          m.removeAttribute('media');
        });
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        meta.setAttribute('content', bgColor);
        document.head.appendChild(meta);
      }
    } catch (e) {
      console.warn('[Theme] Meta theme-color update failed:', e);
    }
  }

  // 3. Update Capacitor Native Android Status Bar (if running in Capacitor native app)
  try {
    if (Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) {
      // Style.Dark: Light text for dark backgrounds
      // Style.Light: Dark text for light backgrounds
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
    }
  } catch (e) {
    // Non-native / Web environment - silently ignore
  }
}
