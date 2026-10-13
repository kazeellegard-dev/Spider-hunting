// Local save data. localStorage can throw or be empty (private mode etc.),
// so every access is guarded and the game still runs without it.
(function (root) {
  'use strict';
  const KEY = 'spiderHunting.save.v1';

  function defaults() {
    return {
      level: 1, exp: 0, coins: 0,
      upgrades: { strength: 0, silk: 0, sticky: 0, speed: 0, appetite: 0, lure: 0 },
      costumes: ['classic'], costume: 'classic',
      bestScore: 0, bestArea: 0, bestDay: 0, scores: [],
      caught: {},
      normal: { stage: 0, cleared: 0, allClear: false, upgrades: { strength: 0, silk: 0, sticky: 0, speed: 0, appetite: 0, lure: 0 } },
      plays: 0, tutorialDone: false,
      settings: { sound: true, music: true, vibration: true, lang: 'auto' },
    };
  }

  function merge(base, saved) {
    for (const k of Object.keys(saved || {})) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && saved[k] && typeof saved[k] === 'object') merge(base[k], saved[k]);
      else if (saved[k] !== undefined) base[k] = saved[k];
    }
    return base;
  }

  const save = {
    data: defaults(),
    load() {
      try {
        const raw = root.localStorage && root.localStorage.getItem(KEY);
        if (raw) this.data = merge(defaults(), JSON.parse(raw));
      } catch (e) { this.data = defaults(); }
      return this.data;
    },
    write() {
      try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    },
    reset() {
      this.data = defaults();
      try { root.localStorage && root.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },
    defaults,
  };

  root.SH = root.SH || {};
  root.SH.save = save;
})(typeof globalThis !== 'undefined' ? globalThis : this);
