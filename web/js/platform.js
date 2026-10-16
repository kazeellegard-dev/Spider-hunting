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
    // Test ad units until release; set useTest false to serve the live units.
    // The AdMob app ID (Info.plist GADApplicationIdentifier) is already the live one.
    useTest: true,
    test: {
      banner: 'ca-app-pub-3940256099942544/2435281174',       // Google's sample iOS banner
      interstitial: 'ca-app-pub-3940256099942544/4411468910', // Google's sample iOS interstitial
    },
    live: {
      banner: 'ca-app-pub-8743645031370957/1267859878',
      interstitial: 'ca-app-pub-8743645031370957/6451158939',
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

    // Banner at the very bottom. In the EEA/UK, ask for consent with Google's UMP first (no ATT).
    listen('AdMob', 'bannerAdSizeChanged', size => { adH = Math.max(0, +size.height || 0); log('bannerSize', size); applyInsets(); });
    listen('AdMob', 'bannerAdFailedToLoad', e => log('bannerError', e));
    const test = ADMOB.useTest;
    const ids = test ? ADMOB.test : ADMOB.live;
    const showBanner = () => call('AdMob', 'showBanner', {
      adId: ids.banner, isTesting: test, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0,
    }).catch(e => log('showBannerError', String(e && e.message || e)));
    const startAds = () => { ads.allowed = true; ads.id = ids.interstitial; ads.test = test; showBanner(); prepareInterstitial(); };
    (async () => {
      let info;
      try {
        await call('AdMob', 'initialize', { maxAdContentRating: 'General' });
        info = await call('AdMob', 'requestConsentInfo', {});
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await call('AdMob', 'showConsentForm', {});
      } catch (e) {
        log('consentError', String(e && e.message || e));
        // Unknown consent: never show real ads; test ads earn nothing, so they may still show.
        if (test) startAds();
        return;
      }
      if (info.canRequestAds || test) startAds();
    })();

    // Interstitial before a continue: loaded ahead of time, reloaded after each showing.
    listen('AdMob', 'interstitialAdLoaded', () => { ads.ready = true; ads.loading = false; });
    listen('AdMob', 'interstitialAdFailedToLoad', e => { ads.ready = false; ads.loading = false; log('interstitialError', e); });
    listen('AdMob', 'interstitialAdDismissed', () => finishInterstitial());
    listen('AdMob', 'interstitialAdFailedToShow', e => { log('interstitialShowError', e); finishInterstitial(); });
  }

  // ---- interstitial state ----
  const ads = { allowed: false, id: '', test: true, ready: false, loading: false, done: null };
  function prepareInterstitial() {
    if (!ads.allowed || ads.ready || ads.loading) return;
    ads.loading = true;
    call('AdMob', 'prepareInterstitial', { adId: ads.id, isTesting: ads.test })
      .then(() => { ads.ready = true; ads.loading = false; })
      .catch(e => { ads.ready = false; ads.loading = false; log('prepareInterstitialError', String(e && e.message || e)); });
  }
  function finishInterstitial() {
    const done = ads.done; ads.done = null;
    if (root.SH && root.SH.audio) root.SH.audio.resume();
    setTimeout(prepareInterstitial, 1000);
    if (done) done();
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

    // Interstitial before a continue. Always resolves true: if no ad is ready (offline, no fill),
    // the player just carries on without one.
    showContinueAd() {
      if (!native || !ads.allowed || !ads.ready) { prepareInterstitial(); return Promise.resolve(true); }
      ads.ready = false;
      if (root.SH && root.SH.audio) root.SH.audio.suspend();
      return new Promise(resolve => {
        ads.done = () => resolve(true);
        call('AdMob', 'showInterstitial', {}).catch(e => { log('showInterstitialError', String(e && e.message || e)); finishInterstitial(); });
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
