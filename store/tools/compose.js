// Adds a headline above each raw capture, in the KAZE Application look (same as Neko Daruma Otoshi):
// cream background, dark brown rounded headline, the screen with a soft shadow.
// The wardrobe picture is 4 list crops (body, hat, silk, knots) tiled 2 x 2.
// Japanese headlines use only first-grade kanji (the game is meant for young children too).
// Usage: LANG_UI=ja|en node store/tools/compose.js [outDir] [srcDir]
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');
const LANG = process.env.LANG_UI || 'ja';
const SRC = process.argv[3] || path.join(__dirname, 'shots', LANG);
const OUT = process.argv[2] || path.resolve(__dirname, '../screenshots', LANG);
// no bug count anywhere: the Bugdex grows with updates
const ORDER = {
  ja: [
    ['title', 'クモの すを はって、|虫を つかまえよう！'],
    ['eat', 'かかった虫を タップして、|ぐるぐるまき！'],
    ['night', 'あさ・ひる・ゆうがた・よる。|なん日 いきのびられる？'],
    ['bonus', 'ボーナスタイムは、|おかしが いっぱい！'],
    ['glow', 'ひかる糸なら、|ボス虫も つかまえられる！'],
    ['zukan', 'いろんな虫を ずかんに あつめよう。|ごくまれに「いろちがい」も…？'],
    ['wardrobe', 'これは ほんの いちぶ！|くみあわせは むげんだい。'],
    ['challenge', 'チャレンジモードは 30ステージ。|これからも ふえていくよ！'],
  ],
  en: [
    ['title', 'Spin your web,|catch the bugs!'],
    ['eat', 'Tap stuck bugs|to wrap them up!'],
    ['night', 'Morning to night —|how many days can you last?'],
    ['bonus', 'Bonus time rains|sweets on your web.'],
    ['glow', 'Glowing silk catches|even the boss bugs.'],
    ['zukan', 'Fill your Bugdex with bugs.|Spot a rare colour variant?'],
    ['wardrobe', 'Just a small taste —|endless combinations!'],
    ['challenge', '30 Challenge stages,|with more on the way!'],
  ],
}[LANG];
const DRESS = {
  ja: [['body', 'からだ'], ['hat', 'ぼうし'], ['thread', 'いと'], ['knot', 'むすびめ']],
  en: [['body', 'Body'], ['hat', 'Hat'], ['thread', 'Silk'], ['knot', 'Knots']],
}[LANG];
// iPhone 6.9" 1320x2868 and iPad 13" 2064x2752
const DEV = {
  iphone: { vw: 440, vh: 956, dpr: 3, font: 34, shotH: 0.765, radius: 30, top: 0.06 },
  ipad: { vw: 1032, vh: 1376, dpr: 2, font: 50, shotH: 0.76, radius: 22, top: 0.04 },
};
const FONT = 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800&display=block';
const b64 = f => fs.readFileSync(f).toString('base64');
const pngSize = f => { const b = fs.readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

function shotHtml(c, name, d) {
  const shadow = `box-shadow:0 ${c.font * 0.35}px ${c.font * 1.1}px rgba(70,52,44,.16), 0 ${c.font * 0.06}px ${c.font * 0.2}px rgba(70,52,44,.10)`;
  if (name !== 'wardrobe') {
    return `<img class="shot" style="height:${Math.round(c.vh * c.shotH)}px;border-radius:${c.radius}px;${shadow}" src="data:image/png;base64,${b64(`${SRC}/${d}-${name}.png`)}">`;
  }
  const first = `${SRC}/${d}-wardrobe-${DRESS[0][0]}.png`, sz = pngSize(first);
  const gap = Math.round(c.font * 0.5), label = Math.round(c.font * 0.62), labH = Math.round(label * 1.9);
  const tileW = Math.floor(Math.min((c.vw * 0.92 - gap) / 2, ((c.vh * c.shotH - 2 * labH - gap) / 2) * sz.w / sz.h));
  const tiles = DRESS.map(([slot, lab]) => `<div class="tile"><span style="font-size:${label}px;padding:${label * 0.25}px ${label * 0.9}px">${lab}</span>
    <img style="width:${tileW}px;border-radius:${c.radius * 0.6}px;${shadow}" src="data:image/png;base64,${b64(`${SRC}/${d}-wardrobe-${slot}.png`)}"></div>`).join('');
  return `<div class="dress" style="height:${Math.round(c.vh * c.shotH)}px;gap:${gap}px;grid-template-columns:${tileW}px ${tileW}px">${tiles}</div>`;
}

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
      const lines = cap.split('|').map(l => `<span>${l}</span>`).join('');
      await p.setContent(`<!doctype html><html><head><link rel="stylesheet" href="${FONT}"><style>
        html,body{margin:0;width:${c.vw}px;height:${c.vh}px;overflow:hidden}
        body{background:linear-gradient(#f6f0e5,#f3ecdf);font-family:"M PLUS Rounded 1c";display:flex;flex-direction:column;align-items:center}
        h1{margin:${Math.round(c.vh * c.top)}px 0 0;font-weight:800;font-size:${c.font}px;line-height:1.38;text-align:center;color:#46342c;letter-spacing:.04em}
        h1 span{display:block;white-space:nowrap}
        .shot,.dress{margin-top:auto;margin-bottom:${Math.round(c.vh * 0.035)}px}
        .dress{display:grid;align-content:center}
        .tile{display:flex;flex-direction:column;align-items:center}
        .tile span{font-weight:800;color:#fff;background:#46342c;border-radius:999px;margin-bottom:.5em;letter-spacing:.06em}
        .tile img{display:block}
      </style></head><body><h1>${lines}</h1>${shotHtml(c, name, d)}
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
      // plain version: the bare screen (the wardrobe tiles keep their layout, without the headline)
      if (name === 'wardrobe') await p.evaluate(() => { document.querySelector('h1').style.visibility = 'hidden'; document.querySelector('.dress').style.margin = 'auto'; });
      else await p.setContent(`<html><body style="margin:0"><img src="data:image/png;base64,${b64(`${SRC}/${d}-${name}.png`)}" style="width:${c.vw}px;height:${c.vh}px;display:block"></body></html>`);
      await p.screenshot({ path: `${OUT}/${d}-plain/${file}.jpg`, type: 'jpeg', quality: 92 });
      console.log(LANG, d, file);
    }
    await ctx.close();
  }
  await b.close();
})();
