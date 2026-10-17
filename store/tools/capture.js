// Raw App Store screenshots: opens the web build (no ads), sets up each scene and saves PNGs.
// Usage: node store/tools/capture.js [scene] [outDir]   (LANG=en for English; serve web/ at URL)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LANG = process.env.LANG_UI || 'ja';
const URL = process.env.URL || 'http://localhost:8765/';
const OUT = process.argv[3] || __dirname + '/shots/' + LANG;
require('fs').mkdirSync(OUT, { recursive: true });

const DEVICES = {
  iphone: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, sat: 62, sab: 34 },
  ipad: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, sat: 24, sab: 20 },
};

// a mid-game player: some outfits, about two thirds of the Bugdex, a title
const CAUGHT = {
  gnat: 64, fly: 88, greenfly: 31, horsefly: 12, mosquito: 47, ladybug: 40, ladybug2: 9, butterfly: 52, sulphur: 21,
  blue: 14, swallowtail: 8, moth: 26, bee: 33, carpenter: 7, dragonfly: 29, redfly: 18, firefly: 36, firefly2: 6,
  cicada: 22, minmin: 9, beetle: 15, chafer: 11, kokuwa: 7, kabuto: 4, stag: 3, emperor: 1, oniyanma: 1,
};
const SAVE = {
  tutorialDone: true, plays: 46, level: 18, exp: 120, coins: 4280, bestScore: 36420, bestDay: 8, drops: 14,
  caught: CAUGHT, title: 'hunter', titles: ['rookie', 'hunter', 'knotter', 'combo'],
  stars: { cleared: 1, sel: 1, best: {} },
  parts: { body: ['classic', 'cherry', 'sky', 'leaf', 'bee', 'mint'], hat: ['none', 'ribbon', 'cap', 'straw', 'flower', 'acorn'], face: ['none', 'blush'], thread: ['white'], knot: ['dot'], bg: ['none'] },
  look: { body: 'classic', hat: 'none', face: 'none', thread: 'white', knot: 'dot', bg: 'none' },
  upgrades: { strength: 12, silk: 8, sticky: 5, speed: 4, appetite: 3, lure: 3 },
  challenge: { stage: 11, cleared: 11, upgrades: { strength: 4, silk: 3, sticky: 2, speed: 1, appetite: 1, lure: 0 } },
  settings: { sound: false, music: false, vibration: false, lang: LANG },
};

// in-page helpers: build a run with a big web, stick bugs on it, then freeze
const HELPERS = () => {
  window.__shot = {
    run(area, opts = {}) {
      const g = SH.game, ui = SH.ui;
      ui.startGame();
      document.getElementById('charmScr').hidden = true;
      g.paused = false;
      const run = g.run;
      run.charmOffer = null; run.tutorial = 0;
      run.windTimer = 999; run.gustTimer = -1;
      run.phase = area === 'stars' ? 3 : ['morning', 'day', 'evening', 'night'].indexOf(area);
      run.day = opts.day || 3; run.phaseT = 0;
      Object.assign(run, opts.run || {});
      g.areaIdx = SH.data.AREAS.findIndex(a => a.id === area);
      g.bg = g.makeBg(g.areaIdx); g.bgPrev = null;
      g.web = new SH.physics.Web(); g.insects = []; g.treats = []; g.specials = [];
      const W = g.W, H = g.H;
      const hub = g.buildStarterWeb(W / 2, H * (opts.cy || 0.44), opts.spokes || 9, Math.min(W * 0.44, H * 0.3), [0.22, 0.42, 0.62, 0.82]);
      g.spider.node = hub; g.spider.x = hub.x; g.spider.y = hub.y; g.spider.action = 'idle';
      g.spawnTimer = 999;
      g.particles = []; g.texts = [];
      this.quiet();
      return true;
    },
    quiet() {
      for (const id of ['banner', 'hint', 'tutorial', 'toast']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
    },
    // stick a bug on the web near the given fraction of the field
    stick(type, fx, fy, shiny) {
      const g = SH.game;
      g.spawnInsect(type);
      const ins = g.insects[g.insects.length - 1];
      const hit = g.web.threadNear(g.W * fx, g.H * fy, 80);
      if (!hit) { ins.dead = true; return false; }
      ins.x = hit.x; ins.y = hit.y; ins.shiny = !!shiny; ins.sizeF = 1;
      g.hitThread(ins, hit, 99);
      ins.struggle = ins.struggleMax = 999;
      return true;
    },
    fly(type, fx, fy, dir) {
      const g = SH.game;
      g.spawnInsect(type);
      const ins = g.insects[g.insects.length - 1];
      ins.x = g.W * fx; ins.y = ins.baseY = g.H * fy; ins.pass = 99; ins.sizeF = 1;
      if (dir) ins.vx = Math.abs(ins.vx) * dir;
    },
    freeze() {
      // nothing cut off at the edges (a spool or a pop half outside the field)
      const g = SH.game;
      g.specials = g.specials.filter(it => it.x > 30 && it.x < g.W - 30);
      g.paused = true;
    },
  };
};

async function settle(p, ms) { await sleep(ms); }

// outfits for the first scenes (any part can be worn here, owned or not)
const LOOKS = {
  title: { body: 'cherry', hat: 'ribbon', face: 'blush', thread: 'pink', knot: 'heart', bg: 'none' },
  eat: { body: 'bee', hat: 'straw', face: 'none', thread: 'white', knot: 'star', bg: 'none' },
  night: { body: 'night', hat: 'nightcap', face: 'glasses', thread: 'nightglow', knot: 'moon', bg: 'none' },
  bonus: { body: 'mint', hat: 'propeller', face: 'hearteyes', thread: 'candy', knot: 'candy', bg: 'none' },
  glow: { body: 'leaf', hat: 'acorn', face: 'freckles', thread: 'white', knot: 'clover', bg: 'none' },
};
const wear = (p, look) => p.evaluate(l => { SH.save.data.look = l; }, look);
// wardrobe tabs shown side by side on the 7th screenshot
const DRESS_SLOTS = ['body', 'hat', 'thread', 'knot'];

const SCENES = {
  async title(p) {
    await wear(p, LOOKS.title);
    await p.evaluate(() => {
      const g = SH.game;
      g.areaIdx = 1; g.bg = g.makeBg(1); g.bgPrev = null;
    });
    await sleep(1600);
    // the demo spider wanders; put it back on its hub
    await p.evaluate(() => {
      const g = SH.game, sp = g.spider, h = sp.home;
      sp.action = 'idle'; sp.node = h; sp.x = h.x; sp.y = h.y; sp.target = null;
      g.paused = true;
    });
  },
  async eat(p) {
    await wear(p, LOOKS.eat);
    await p.evaluate(() => {
      const s = __shot, g = SH.game;
      s.run('evening', { run: { score: 21560, combo: 0, bonusGauge: 22, silk: g.st.maxSilk * 0.6 } });
      s.stick('redfly', 0.3, 0.36); s.stick('moth', 0.7, 0.32); s.stick('kokuwa', 0.62, 0.62);
      s.stick('mosquito', 0.24, 0.56); s.stick('silkmoth', 0.48, 0.24); s.stick('tigermosq', 0.78, 0.5);
      s.stick('moth', 0.4, 0.66);
      s.fly('mosquito', 0.85, 0.16, -1);
    });
    await settle(p, 900);
    // eat one for the points and the combo, then catch the spider wrapping the next
    await p.evaluate(() => { const g = SH.game; const c = g.insects.find(i => i.type === 'redfly'); g.handleTap(c.x, c.y); });
    await sleep(1500);
    await p.evaluate(() => { const g = SH.game; const c = g.insects.find(i => i.type === 'silkmoth' && i.state === 'caught'); g.handleTap(c.x, c.y); });
    await sleep(700);
    await p.evaluate(() => { SH.game.specials = []; __shot.freeze(); });
  },
  async night(p) {
    await wear(p, LOOKS.night);
    await p.evaluate(() => {
      const s = __shot, g = SH.game;
      s.run('stars', { day: 4, run: { score: 31280, combo: 2, lastEat: 1e9, bonusGauge: 8, silk: g.st.maxSilk * 0.66 } });
      s.stick('kabuto', 0.4, 0.6); s.stick('firefly', 0.3, 0.32); s.stick('stag', 0.7, 0.42); s.stick('firefly2', 0.62, 0.26);
      s.fly('firefly', 0.15, 0.16, 1); s.fly('caucasus', 0.88, 0.8, -1); s.fly('firefly', 0.78, 0.12, -1);
    });
    await settle(p, 1400);
    await p.evaluate(() => __shot.freeze());
  },
  async bonus(p) {
    await wear(p, LOOKS.bonus);
    await p.evaluate(() => {
      const s = __shot, g = SH.game;
      s.run('day', { run: { score: 18720, combo: 6, lastEat: 1e9, silk: g.st.maxSilk * 0.9 } });
      g.run.bonusGauge = 999;
    });
    await sleep(2300);
    await p.evaluate(() => { const g = SH.game; if (!g.specials.length) g.spawnSpecial(); });
    await sleep(700);
    await p.evaluate(() => __shot.freeze());
  },
  async glow(p) {
    await wear(p, LOOKS.glow);
    await p.evaluate(() => {
      const s = __shot, g = SH.game;
      s.run('day', { day: 5, run: { score: 27450, combo: 3, lastEat: 1e9, glow: 11, silk: g.st.maxSilk * 0.7 } });
      s.stick('hercules', 0.42, 0.58); s.stick('hornet', 0.7, 0.36); s.stick('blue', 0.28, 0.34);
      s.fly('oniyanma', 0.86, 0.18, -1);
    });
    await settle(p, 1200);
    await p.evaluate(() => __shot.freeze());
  },
  async zukan(p) {
    await p.evaluate(() => { SH.ui.open('mainScr'); SH.ui.open('zukanScr'); });
    await sleep(700);
    // the Bugdex grows with updates, so the store pictures never show the total ("27 / 38" -> "27")
    await p.evaluate(() => {
      for (const el of document.querySelectorAll('#zukanScr *')) {
        if (el.children.length === 0 && /\d+\s*\/\s*\d+/.test(el.textContent)) el.textContent = el.textContent.replace(/(\d+)\s*\/\s*\d+/, '$1');
      }
    });
  },
  // 4 crops from the middle of the wardrobe lists; compose.js tiles them
  async wardrobe(p, dname) {
    await p.evaluate(l => { SH.save.data.look = l; SH.ui.open('mainScr'); SH.ui.open('wardrobeScr'); }, LOOKS.title);
    await sleep(500);
    for (const slot of DRESS_SLOTS) {
      const clip = await p.evaluate(slot => {
        SH.ui.wdTab = slot; SH.ui.renderWardrobe();
        const scr = document.getElementById('wardrobeScr'), list = document.getElementById('wardrobeList');
        const rows = [...list.children], mid = rows[Math.max(0, Math.floor(rows.length / 2) - 4)];
        scr.scrollTop = 0;
        scr.scrollTop = mid.getBoundingClientRect().top - 12;
        const r = list.getBoundingClientRect(), m = mid.getBoundingClientRect();
        // exactly 5 whole rows
        const end = rows[rows.indexOf(mid) + 5] || rows[rows.length - 1];
        // icon and name only (the price buttons are left out so the 2 x 2 tiles stay readable)
        return { x: r.left - 6, y: m.top - 6, width: Math.round((r.width + 12) * 0.64), height: end.getBoundingClientRect().top - m.top + 2 };
      }, slot);
      await sleep(300);
      await p.screenshot({ path: `${OUT}/${dname}-wardrobe-${slot}.png`, clip });
    }
    return 'done';
  },
  async challenge(p) {
    await p.evaluate(() => { SH.ui.setMode(1); SH.ui.open('challengeScr'); });
    await sleep(800);
  },
};

(async () => {
  const b = await chromium.launch();
  const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
  for (const [dname, d] of Object.entries(DEVICES)) {
    if (process.env.DEV && process.env.DEV !== dname) continue;
    for (const [sname, fn] of Object.entries(SCENES)) {
      if (only && !only.includes(sname)) continue;
      const ctx = await b.newContext({ viewport: d.viewport, deviceScaleFactor: d.deviceScaleFactor, isMobile: true, hasTouch: true, locale: LANG === 'ja' ? 'ja-JP' : 'en-US' });
      await ctx.addInitScript(([save, sat, sab]) => {
        window.SH_NO_SW = true;
        try { localStorage.setItem('spiderHunting.save.v1', JSON.stringify(save)); } catch (e) {}
        document.addEventListener('DOMContentLoaded', () => {
          const st = document.createElement('style');
          st.textContent = `#adSlot{display:none!important}:root{--adh:0px!important;--sat:${sat}px!important;--sab:${sab}px!important}`;
          document.head.append(st);
        });
      }, [SAVE, d.sat, d.sab]);
      await ctx.addInitScript(HELPERS);
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(URL);
      await p.waitForFunction(() => window.SH && SH.game && SH.ui && SH.ui.game);
      await sleep(400);
      await p.evaluate(() => window.dispatchEvent(new Event('resize')));
      await sleep(300);
      if (await fn(p, dname) !== 'done') await p.screenshot({ path: `${OUT}/${dname}-${sname}.png` });
      console.log(dname, sname, errs.length ? errs : 'ok');
      await ctx.close();
    }
  }
  await b.close();
})();
