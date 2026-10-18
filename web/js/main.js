// Boot: canvas sizing, input, main loop, lifecycle.
(function (root) {
  'use strict';
  const SH = root.SH;

  // The opening plays while the game boots. Texts go in right away (the saved language may
  // still be on its way from native storage, so this uses whatever is at hand); it lifts once
  // the game is ready and the scene has played, or on a tap after that.
  const intro = document.getElementById('intro');
  const INTRO_MS = 3500;
  let booted = false, introDone;
  SH.introDone = new Promise(r => { introDone = r; });
  try {
    const saved = JSON.parse(root.localStorage.getItem('spiderHunting.save.v1') || 'null');
    const lang = saved && saved.settings && saved.settings.lang;
    SH.i18n.set(lang && lang !== 'auto' ? lang : SH.i18n.detect());
  } catch (e) { SH.i18n.set(SH.i18n.detect()); }
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = SH.i18n.t(el.dataset.t); });
  function liftIntro() {
    if (!intro || intro.classList.contains('out')) return;
    intro.classList.add('out');
    setTimeout(() => { intro.remove(); }, 500);
    introDone();
  }
  if (intro) {
    const t0 = performance.now();
    const tryLift = () => { if (booted && performance.now() - t0 >= INTRO_MS) liftIntro(); else setTimeout(tryLift, 100); };
    setTimeout(tryLift, INTRO_MS);
    intro.addEventListener('pointerdown', () => { if (booted && performance.now() - t0 > 600) liftIntro(); });
  } else introDone();

  // On iOS the save is restored from native Preferences before the game boots
  SH.platform.ready().then(boot).finally(() => { booted = true; });
  setTimeout(liftIntro, 9000); // never hold the player on the opening

  function boot() {
    const save = SH.save.load();
    if (save.settings.lang !== 'auto') SH.i18n.set(save.settings.lang); else SH.i18n.set(SH.i18n.detect());
    SH.audio.setSound(save.settings.sound);
    SH.audio.setMusic(save.settings.music);

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const ui = SH.ui;

    const game = new SH.Game({
      banner: (a, b, c) => ui.banner(a, b, c),
      tutorial: text => ui.tutorial(text),
      hint: text => ui.hint(text),
      gameOver: canContinue => ui.gameOver(canContinue),
      stageClear: () => ui.stageClear(),
      stageFail: reason => ui.stageFail(reason),
      charmPick: choices => ui.charmPick(choices),
    });
    SH.game = game;

    // Logical play field: at least 390 wide (phone portrait), wider on iPad/desktop.
    // Measured from the stage, which ends above the banner ad area.
    // While playing, the HUD band sits above the stage; the field keeps the scale it would
    // have at full height and just ends lower, so bugs and the web look the same size.
    const stage = document.getElementById('stage');
    const hud = document.getElementById('hud');
    function resize() {
      const band = hud.hidden ? 0 : hud.offsetHeight;
      stage.style.top = band + 'px';
      const rect = stage.getBoundingClientRect();
      const vw = Math.max(1, rect.width), vh = Math.max(1, rect.height);
      let W = Math.max(390, 760 * vw / (vh + band));
      W = Math.min(W, 1000);
      const H = W * vh / vw;
      const dpr = Math.min(root.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      game.resize(W, H, dpr * vw / W);
    }
    root.addEventListener('resize', resize);
    if (root.ResizeObserver) { const ro = new ResizeObserver(resize); ro.observe(stage); ro.observe(hud); }
    resize();
    SH.relayout = resize;

    ui.init(game);
    game.startDemo();

    function toLogical(e) {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * game.W, y: (e.clientY - r.top) / r.height * game.H };
    }
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      SH.audio.unlock();
      const p = toLogical(e);
      game.tap(p.x, p.y);
    });
    // block iOS double-tap zoom / long-press menus on the stage
    document.addEventListener('dblclick', e => e.preventDefault());
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' || e.key === 'p') { if (game.paused) ui.resume(); else ui.pause(); }
    });

    // Audio needs a gesture: every tap makes sure it is awake (iOS can silence it at any time),
    // and the title music starts on the first one.
    let musicStarted = false;
    const wake = () => {
      SH.audio.unlock();
      if (!musicStarted) { musicStarted = true; if (game.mode === 'demo') SH.audio.music('title'); }
    };
    ['pointerdown', 'touchend', 'click'].forEach(ev => root.addEventListener(ev, wake, { capture: true, passive: true }));
    // The app's web view may play without a tap, so the title music starts as the opening ends.
    if (SH.platform.isNative) SH.introDone.then(() => { if (!musicStarted && game.mode === 'demo') { musicStarted = true; SH.audio.music('title'); } });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { ui.pause(); SH.audio.suspend(); away = true; }
      else back();
    });
    // iOS does not always send visibilitychange (and a system prompt only blurs the page),
    // so blur/focus count as leaving and coming back too
    let away = false;
    const back = () => { if (away) { away = false; SH.audio.restart(); } };
    root.addEventListener('blur', () => { away = true; });
    root.addEventListener('focus', back);
    root.addEventListener('pageshow', back);

    let last = performance.now();
    function frame(now) {
      const dt = (now - last) / 1000;
      last = now;
      game.update(dt);
      game.draw(ctx);
      ui.updateHud();
      ui.tick(Math.min(dt, 0.05));
      root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !root.SH_NO_SW && !SH.platform.isNative) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
