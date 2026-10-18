// Native bridge. In the browser everything is a harmless stand-in; in the iOS
// app (Capacitor) it reads the safe area, shows the AdMob banner and backs the
// save data up to native Preferences. Mirrors the daruma_game app setup.
(function (root) {
  'use strict';

  const cap = root.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform() && cap.nativePromise);
  const call = (plugin, method, opts) => cap.nativePromise(plugin, method, opts || {});
  const listen = (plugin, ev, fn) => cap.addListener(plugin, ev, d => { if (d) fn(d); });

  const ADMOB = {
    // Live ad units (switched for App Store submission). Set useTest true for device tests.
    // The AdMob app ID (Info.plist GADApplicationIdentifier) is already the live one.
    useTest: false,
    test: {
      banner: 'ca-app-pub-3940256099942544/2435281174',       // Google's sample iOS banner
      rewarded: 'ca-app-pub-3940256099942544/1712485313',     // Google's sample iOS rewarded
    },
    live: {
      banner: 'ca-app-pub-8743645031370957/1267859878',
      rewarded: 'ca-app-pub-8743645031370957/8720732070',
    },
  };
  const SAVE_PREFIX = 'spiderHunting.';

  const log = (k, v) => { try { console.log('[platform]', k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) { /* ignore */ } };

  // ---- insets: Dynamic Island / home bar and the banner height ----
  // The game area sits above the banner from the start (the web keeps the same space empty),
  // so nothing jumps when the ad loads. Adaptive banners are about 15.6% of the width tall.
  const rootStyle = document.documentElement.style;
  const adGuess = () => Math.round(Math.min(90, Math.max(50, root.innerWidth * 0.156)));
  let safe = null, adH = 0;
  function applyInsets() {
    rootStyle.setProperty('--adh', Math.max(adH, adGuess()) + 'px');
    if (safe) {
      rootStyle.setProperty('--sat', safe.top + 'px');
      rootStyle.setProperty('--sab', safe.bottom + 'px');
    }
    root.dispatchEvent(new Event('resize'));
  }

  function startNative() {
    const slot = document.getElementById('adSlot');
    if (slot) slot.classList.add('native');

    const update = v => {
      const n = { top: +v.top || 0, right: +v.right || 0, bottom: +v.bottom || 0, left: +v.left || 0 };
      if (safe && n.top === safe.top && n.bottom === safe.bottom && n.left === safe.left && n.right === safe.right) return;
      safe = n; log('safeArea', n); applyInsets();
    };
    const poll = () => call('SafeArea', 'get').then(update).catch(e => log('safeAreaError', String(e && e.message || e)));
    listen('SafeArea', 'change', update);
    poll();
    [300, 1000, 2500].forEach(t => setTimeout(poll, t)); // values settle a moment after launch
    root.addEventListener('orientationchange', () => setTimeout(poll, 300));

    // Banner at the very bottom. In the EEA/UK, ask for consent with Google's UMP first, then ask
    // for App Tracking Transparency before any ad loads. Without ATT, App Review rejects the app
    // under guideline 5.1.2(i) (this happened to daruma_game 1.0).
    listen('AdMob', 'bannerAdSizeChanged', size => { adH = Math.max(0, +size.height || 0); log('bannerSize', size); applyInsets(); });
    listen('AdMob', 'bannerAdFailedToLoad', e => log('bannerError', e));
    const test = ADMOB.useTest;
    const ids = test ? ADMOB.test : ADMOB.live;
    const showBanner = () => call('AdMob', 'showBanner', {
      adId: ids.banner, isTesting: test, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0,
    }).catch(e => log('showBannerError', String(e && e.message || e)));
    const startAds = () => { ads.allowed = true; ads.id = ids.rewarded; ads.test = test; showBanner(); prepareRewarded(); };
    // iOS only shows the ATT prompt while the app is in the foreground; otherwise it counts as "deny".
    const askTracking = async () => {
      try {
        const { status } = await call('AdMob', 'trackingAuthorizationStatus', {});
        log('tracking', status);
        if (status !== 'notDetermined') return;
        if (document.visibilityState !== 'visible') await new Promise(r => document.addEventListener('visibilitychange', function f() {
          if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', f); r(); }
        }));
        // after the opening, so the prompt does not cut into it
        if (root.SH && root.SH.introDone) await root.SH.introDone;
        await new Promise(r => setTimeout(r, 600));
        await call('AdMob', 'requestTrackingAuthorization', {});
        log('tracking', (await call('AdMob', 'trackingAuthorizationStatus', {})).status);
      } catch (e) { log('trackingError', String(e && e.message || e)); }
    };
    (async () => {
      let info;
      try {
        await call('AdMob', 'initialize', { maxAdContentRating: 'General' });
        info = await call('AdMob', 'requestConsentInfo', {});
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await call('AdMob', 'showConsentForm', {});
      } catch (e) {
        log('consentError', String(e && e.message || e));
        // Unknown consent: never show real ads; test ads earn nothing, so they may still show.
        await askTracking();
        if (test) startAds();
        return;
      }
      // Always ask, whatever the consent result, so App Review can see the prompt.
      await askTracking();
      if (info.canRequestAds || test) startAds();
    })();

    // Rewarded ad behind "Watch an ad to continue". AdMob only allows a reward (the continue)
    // for viewing an ad through the rewarded formats, and only after the player opts in by tapping.
    // Loaded ahead of time, reloaded after each showing.
    listen('AdMob', 'onRewardedVideoAdLoaded', () => { ads.ready = true; ads.loading = false; });
    listen('AdMob', 'onRewardedVideoAdFailedToLoad', e => { ads.ready = false; ads.loading = false; log('rewardedError', e); });
    listen('AdMob', 'onRewardedVideoAdReward', () => { ads.earned = true; });
    listen('AdMob', 'onRewardedVideoAdDismissed', () => finishRewarded());
    listen('AdMob', 'onRewardedVideoAdFailedToShow', e => { log('rewardedShowError', e); ads.failed = true; finishRewarded(); });
  }

  // ---- rewarded ad state ----
  const ads = { allowed: false, id: '', test: true, ready: false, loading: false, earned: false, failed: false, done: null };
  function prepareRewarded() {
    if (!ads.allowed || ads.ready || ads.loading) return;
    ads.loading = true;
    call('AdMob', 'prepareRewardVideoAd', { adId: ads.id, isTesting: ads.test })
      .then(() => { ads.ready = true; ads.loading = false; })
      .catch(e => { ads.ready = false; ads.loading = false; log('prepareRewardedError', String(e && e.message || e)); });
  }
  // Continue only when the reward was earned. If the ad could not be shown at all, the player
  // still continues (nothing was watched, so nothing is being rewarded).
  function finishRewarded() {
    const done = ads.done; ads.done = null;
    if (!done) return;
    const ok = ads.earned || ads.failed;
    ads.earned = ads.failed = false;
    if (root.SH && root.SH.audio) root.SH.audio.resume();
    setTimeout(prepareRewarded, 1000);
    done(ok);
  }

  // ---- save backup: iOS may clear web view storage, so mirror our keys into Preferences ----
  function mirrorStorage() {
    const LS = root.localStorage;
    const set = Storage.prototype.setItem, del = Storage.prototype.removeItem;
    const mine = (st, k) => st === LS && String(k).startsWith(SAVE_PREFIX);
    Storage.prototype.setItem = function (k, v) {
      set.call(this, k, v);
      if (mine(this, k)) call('Preferences', 'set', { key: String(k), value: String(v) }).catch(() => {});
    };
    Storage.prototype.removeItem = function (k) {
      del.call(this, k);
      if (mine(this, k)) call('Preferences', 'remove', { key: String(k) }).catch(() => {});
    };
  }

  function restoreSave() {
    const hasPrefs = (cap.PluginHeaders || []).some(h => h.name === 'Preferences');
    if (!hasPrefs) return Promise.resolve();
    mirrorStorage();
    const restore = call('Preferences', 'keys').then(res => Promise.all((res.keys || []).filter(k => k.startsWith(SAVE_PREFIX)).map(k =>
      call('Preferences', 'get', { key: k }).then(r => {
        try { if (r && r.value != null && root.localStorage.getItem(k) == null) Storage.prototype.setItem.call(root.localStorage, k, r.value); } catch (e) { /* ignore */ }
      })))).catch(e => log('restoreError', String(e && e.message || e)));
    // never hold the game back for long
    return Promise.race([restore, new Promise(r => setTimeout(r, 1500))]);
  }

  let readyPromise = null;
  const platform = {
    isNative: native,

    // Resolves when the game may boot (the save has been restored on iOS).
    ready() {
      if (readyPromise) return readyPromise;
      applyInsets();
      root.addEventListener('resize', () => { if (Math.max(adH, adGuess()) + 'px' !== rootStyle.getPropertyValue('--adh')) applyInsets(); });
      if (!native) return (readyPromise = Promise.resolve());
      startNative();
      return (readyPromise = restoreSave());
    },

    // Does a continue show an ad first? (only in the app, once ads may be shown)
    get continueHasAd() { return native && ads.allowed; },

    // Rewarded ad for a continue. Resolves true when the player earned the reward, false when they
    // closed the ad early. If no ad is ready (offline, no fill), the player carries on without one.
    showContinueAd() {
      if (!native || !ads.allowed || !ads.ready) { prepareRewarded(); return Promise.resolve(true); }
      ads.ready = false; ads.earned = ads.failed = false;
      if (root.SH && root.SH.audio) root.SH.audio.suspend();
      return new Promise(resolve => {
        ads.done = resolve;
        call('AdMob', 'showRewardVideoAd', {}).catch(e => { log('showRewardedError', String(e && e.message || e)); ads.failed = true; finishRewarded(); });
      });
    },

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
