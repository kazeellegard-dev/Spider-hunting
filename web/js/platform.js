// Native bridge. In the browser everything is a harmless stand-in; the iOS
// build (Capacitor) will swap these for AdMob / Game Center / StoreKit / Haptics.
(function (root) {
  'use strict';

  const cap = root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform() ? root.Capacitor : null;

  const platform = {
    isNative: !!cap,

    // Rewarded ad (continue / double rewards). Browser: grant immediately.
    showRewarded() { return Promise.resolve(true); },

    // Game Center leaderboard (F-25). Browser: local ranking only.
    submitScore(/* score */) { return Promise.resolve(); },

    haptic(kind) {
      const s = root.SH && root.SH.save && root.SH.save.data.settings;
      if (s && !s.vibration) return;
      const nav = root.navigator;
      if (nav && nav.vibrate && (!nav.userActivation || nav.userActivation.hasBeenActive)) {
        try { nav.vibrate(kind === 'heavy' ? 30 : kind === 'medium' ? 15 : 8); } catch (e) { /* ignore */ }
      }
    },
  };

  root.SH = root.SH || {};
  root.SH.platform = platform;
})(typeof globalThis !== 'undefined' ? globalThis : this);
