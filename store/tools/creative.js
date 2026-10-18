// App Store creative assets (iOS 27+): the product page header (21:9, 3840 x 1646) and the
// search result image (3:2, 3840 x 2560). No text, so one picture serves every language.
// Usage: node store/tools/creative.js [outDir]   (serve web/ at URL, like capture.js)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const { SAVE, HELPERS, sleep } = require('./capture.js');
const URL = process.env.URL || 'http://localhost:8765/';
const OUT = process.argv[2] || __dirname + '/../creative';
fs.mkdirSync(OUT, { recursive: true });

// viewports at 3x; the extra pixel row is trimmed by the caller (PIL) to the exact size
const SIZES = {
  header: { width: 1280, height: 549, cy: 0.5, size: 0.78, spider: 1.9 },
  search: { width: 1280, height: 854, cy: 0.5, size: 0.74, spider: 2.4 },
};
const LOOK = { body: 'classic', hat: 'nightcap', face: 'blush', thread: 'nightglow', knot: 'star', bg: 'none' };

(async () => {
  const b = await chromium.launch();
  for (const [name, sz] of Object.entries(SIZES)) {
    const ctx = await b.newContext({ viewport: { width: sz.width, height: sz.height }, deviceScaleFactor: 3, locale: 'ja-JP' });
    await ctx.addInitScript(save => {
      window.SH_NO_SW = true;
      try { localStorage.setItem('spiderHunting.save.v1', JSON.stringify(save)); } catch (e) {}
      document.addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        // the bare play field: no ad slot, no opening, no HUD
        st.textContent = '#adSlot,#intro,#hud{display:none!important}:root{--adh:0px!important;--sat:0px!important;--sab:0px!important}';
        document.head.append(st);
      });
    }, SAVE);
    await ctx.addInitScript(HELPERS);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL);
    await p.waitForFunction(() => window.SH && SH.game && SH.ui && SH.ui.game);
    await sleep(400);
    await p.evaluate(look => { SH.save.data.look = look; }, LOOK);
    await p.evaluate(sz => {
      const s = __shot, g = SH.game;
      SH.noRings = true;
      s.run('stars', { day: 4, cy: sz.cy, run: { score: 0, combo: 0, bonusGauge: 0, silk: g.st.maxSilk } });
      document.getElementById('hud').hidden = true; SH.relayout();
      // a bigger web than in play, centred, so it reads at App Store sizes
      const W = g.W, H = g.H;
      g.web = new SH.physics.Web(); g.insects = [];
      const hub = g.buildStarterWeb(W / 2, H * sz.cy, 12, H * sz.size / 2, [0.2, 0.38, 0.56, 0.74, 0.9]);
      g.spider.node = hub; g.spider.x = hub.x; g.spider.y = hub.y; g.spider.action = 'idle'; g.spider.scale = sz.spider;
      const cx = 0.5, r = (H * sz.size / 2) / W, ry = sz.size / 2;
      s.stick('firefly', cx - r * 0.55, sz.cy - ry * 0.45);
      s.stick('butterfly', cx + r * 0.5, sz.cy - ry * 0.5);
      s.stick('kabuto', cx + r * 0.35, sz.cy + ry * 0.5);
      s.stick('firefly2', cx - r * 0.4, sz.cy + ry * 0.55);
      for (const ins of g.insects) ins.sizeF = 1.5;
      s.fly('firefly', 0.1, 0.25, 1); s.fly('firefly', 0.86, 0.72, -1); s.fly('firefly2', 0.22, 0.8, 1); s.fly('firefly', 0.8, 0.2, -1);
    }, sz);
    await sleep(1400);
    await p.evaluate(() => __shot.freeze());
    await sleep(200);
    await p.screenshot({ path: `${OUT}/${name}-raw.png` });
    console.log(name, errs.length ? errs : 'ok');
    await ctx.close();
  }
  await b.close();
})();
