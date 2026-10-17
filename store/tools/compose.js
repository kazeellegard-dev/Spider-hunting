// Adds a headline above each raw capture, in the KAZE Application look (same as Neko Daruma Otoshi):
// cream background, dark brown rounded headline, the screen with a soft shadow.
// Usage: LANG_UI=ja|en node store/tools/compose.js [outDir] [srcDir]
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');
const LANG = process.env.LANG_UI || 'ja';
const SRC = process.argv[3] || path.join(__dirname, 'shots', LANG);
const OUT = process.argv[2] || path.resolve(__dirname, '../screenshots', LANG);
const ORDER = {
  ja: [
    ['title', 'クモになって、|巣をはろう。'],
    ['eat', 'かかった虫をタップして、|ぐるぐる巻き！'],
    ['night', 'あさ・ひる・ゆうがた・よる。|何日いきのびる？'],
    ['bonus', 'ボーナスタイムは、|おかしがいっぱい。'],
    ['glow', 'ひかる糸なら、|ボス虫もつかまえられる。'],
    ['zukan', '38しゅるいの虫を、|ずかんに集めよう。'],
    ['wardrobe', 'きせかえで、|自分だけのクモに。'],
    ['challenge', 'チャレンジモードは、|30ステージ。'],
  ],
  en: [
    ['title', 'Spin your web,|catch the bugs.'],
    ['eat', 'Tap a stuck bug|to wrap it up!'],
    ['night', 'Morning to night —|how many days can you last?'],
    ['bonus', 'Bonus time rains|sweets on your web.'],
    ['glow', 'Glowing silk catches|even the boss bugs.'],
    ['zukan', 'Fill your Bugdex|with 38 kinds of bugs.'],
    ['wardrobe', 'Dress up your spider|your own way.'],
    ['challenge', '30 stages of|Challenge mode.'],
  ],
}[LANG];
// iPhone 6.9" 1320x2868 and iPad 13" 2064x2752
const DEV = {
  iphone: { vw: 440, vh: 956, dpr: 3, font: 34, shotH: 0.765, radius: 30, top: 0.06 },
  ipad: { vw: 1032, vh: 1376, dpr: 2, font: 50, shotH: 0.76, radius: 22, top: 0.04 },
};
const FONT = 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800&display=block';

(async () => {
  const b = await chromium.launch();
  for (const [d, c] of Object.entries(DEV)) {
    fs.mkdirSync(`${OUT}/${d}`, { recursive: true });
    fs.mkdirSync(`${OUT}/${d}-plain`, { recursive: true });
    const ctx = await b.newContext({ viewport: { width: c.vw, height: c.vh }, deviceScaleFactor: c.dpr });
    const p = await ctx.newPage();
    let i = 0;
    for (const [name, cap] of ORDER) {
      i++;
      const img = fs.readFileSync(`${SRC}/${d}-${name}.png`).toString('base64');
      const lines = cap.split('|').map(l => `<span>${l}</span>`).join('');
      await p.setContent(`<!doctype html><html><head><link rel="stylesheet" href="${FONT}"><style>
        html,body{margin:0;width:${c.vw}px;height:${c.vh}px;overflow:hidden}
        body{background:linear-gradient(#f6f0e5,#f3ecdf);font-family:"M PLUS Rounded 1c";display:flex;flex-direction:column;align-items:center}
        h1{margin:${Math.round(c.vh * c.top)}px 0 0;font-weight:800;font-size:${c.font}px;line-height:1.38;text-align:center;color:#46342c;letter-spacing:.04em}
        h1 span{display:block;white-space:nowrap}
        .shot{margin-top:auto;margin-bottom:${Math.round(c.vh * 0.035)}px;height:${Math.round(c.vh * c.shotH)}px;border-radius:${c.radius}px;
          box-shadow:0 ${c.font * 0.35}px ${c.font * 1.1}px rgba(70,52,44,.16), 0 ${c.font * 0.06}px ${c.font * 0.2}px rgba(70,52,44,.10)}
      </style></head><body><h1>${lines}</h1><img class="shot" src="data:image/png;base64,${img}">
        <script>/* shrink a headline that does not fit, once the font is in */
          document.fonts.load('800 20px "M PLUS Rounded 1c"', 'あA').then(() => document.fonts.ready).then(() => {
            const h = document.querySelector('h1'); let f = ${c.font};
            while ([...h.children].some(s => s.scrollWidth > ${c.vw} * 0.9) && f > 12) { f -= 1; h.style.fontSize = f + 'px'; }
            document.body.dataset.ready = '1';
          });
        </script></body></html>`, { waitUntil: 'networkidle' });
      await p.waitForSelector('body[data-ready="1"]');
      await p.waitForTimeout(150);
      const file = `${String(i).padStart(2, '0')}-${name}`;
      await p.screenshot({ path: `${OUT}/${d}/${file}.jpg`, type: 'jpeg', quality: 92 });
      await p.setContent(`<html><body style="margin:0"><img src="data:image/png;base64,${img}" style="width:${c.vw}px;height:${c.vh}px;display:block"></body></html>`);
      await p.screenshot({ path: `${OUT}/${d}-plain/${file}.jpg`, type: 'jpeg', quality: 92 });
      console.log(LANG, d, file);
    }
    await ctx.close();
  }
  await b.close();
})();
