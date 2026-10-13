// Boot: canvas sizing, input, main loop, lifecycle.
(function (root) {
  'use strict';
  const SH = root.SH;
  // On iOS the save is restored from native Preferences before the game boots
  SH.platform.ready().then(boot);

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
    });
    SH.game = game;

    // Logical play field: at least 390 wide (phone portrait), wider on iPad/desktop.
    // Measured from the stage, which ends above the banner ad area.
    const stage = document.getElementById('stage');
    function resize() {
      const rect = stage.getBoundingClientRect();
      const vw = Math.max(1, rect.width), vh = Math.max(1, rect.height);
      let W = Math.max(390, 760 * vw / vh);
      W = Math.min(W, 1000);
      const H = W * vh / vw;
      const dpr = Math.min(root.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      game.resize(W, H, dpr * vw / W);
    }
    root.addEventListener('resize', resize);
    if (root.ResizeObserver) new ResizeObserver(resize).observe(stage);
    resize();

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

    // title music starts on first interaction (audio needs a gesture)
    const firstTouch = () => {
      SH.audio.unlock();
      if (game.mode === 'demo') SH.audio.music('title');
      root.removeEventListener('pointerdown', firstTouch);
    };
    root.addEventListener('pointerdown', firstTouch);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { ui.pause(); SH.audio.suspend(); }
      else SH.audio.resume();
    });

    let last = performance.now();
    function frame(now) {
      const dt = (now - last) / 1000;
      last = now;
      game.update(dt);
      game.draw(ctx);
      ui.updateHud();
      root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !root.SH_NO_SW && !SH.platform.isNative) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
