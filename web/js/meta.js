// Replay layer (v1.9): dawn charms, daily weather, difficulty stars, Bugdex ranks and
// size records, colour variants, family sets, outfits split into parts, web looks,
// seasons, titles, achievements and the daily tasks that pay out dew drops.
// Pure data + save logic, no DOM, so it also runs under `node --test`.
(function (root) {
  'use strict';
  const D = root.SH.data;
  const L = (ja, en) => ({ ja, en });

  // colour variant per normal-mode spawn: 1/2048; lucky charm or full moon 1/512; both 1/128
  const SHINY_CHANCE = 1 / 2048, SHINY_BOOST = 4;

  // ---------- A1. dawn charms: pick 1 of 3 at every new day, lasts for the run ----------
  // max: how many times it can stack in one run (0 = no limit)
  const CHARMS = [
    { id: 'strong', max: 3, icon: '🧵', name: L('ふとい糸', 'Thick silk'), desc: L('糸のつよさ +0.6', 'Silk strength +0.6') },
    { id: 'tie',    max: 2, icon: '🪢', name: L('むすび目 がっちり', 'Tight knots'), desc: L('むすんだ糸が もっと じょうぶ', 'Tied threads get even tougher') },
    { id: 'flutter', max: 2, icon: '🦋', name: L('チョウ・ガ あつまれ', 'Wing lure'), desc: L('チョウとガが よく来て、スコアも+30%', 'More butterflies and moths, +30% score each') },
    { id: 'calm',   max: 1, icon: '🍃', name: L('かぜに まけない', 'Windproof'), desc: L('かぜで 虫が にげやすく ならない', 'Breezes no longer loosen stuck bugs') },
    { id: 'bonus',  max: 3, icon: '🍬', name: L('ボーナス はやい', 'Quick bonus'), desc: L('ボーナスゲージが 35% はやく たまる', 'Bonus gauge fills 35% faster') },
    { id: 'feast',  max: 2, icon: '🍖', name: L('おおぐい', 'Big eater'), desc: L('重い虫（おもさ3いじょう）で いとが 50% 多く 回復', 'Heavy bugs (3+) restore 50% more silk') },
    { id: 'thrift', max: 3, icon: '🪡', name: L('せつやく', 'Thrifty'), desc: L('糸を はるときの いとが 15% へる', 'Spinning costs 15% less silk') },
    { id: 'sticky', max: 3, icon: '💧', name: L('ねばねば+', 'Extra sticky'), desc: L('虫が にげるまでの時間 +20%', 'Stuck bugs hold on 20% longer') },
    { id: 'coin',   max: 3, icon: '🪙', name: L('コイン ざくざく', 'Coin rain'), desc: L('このプレイの コイン +20%', '+20% coins this run') },
    { id: 'combo',  max: 2, icon: '💥', name: L('コンボ ながもち', 'Long combo'), desc: L('コンボが つづく時間 +1びょう', 'Combos last 1 s longer') },
    { id: 'lucky',  max: 2, icon: '🍀', name: L('ラッキー', 'Lucky'), desc: L('レア虫と いろちがいが 出やすい', 'Rare bugs and colour variants show up more') },
    { id: 'glow',   max: 2, icon: '✨', name: L('ひかる糸 ながもち', 'Long glow'), desc: L('ひかる糸の時間 +50%', 'Glowing silk lasts 50% longer') },
    { id: 'saver',  max: 3, icon: '🧶', name: L('いと へりにくい', 'Slow drain'), desc: L('時間で へる いとが 12% すくない', 'Silk drains 12% slower') },
    { id: 'guard',  max: 2, icon: '🛡️', name: L('とっぷうガード', 'Gust guard'), desc: L('とっぷうで とばされる巣が 半分に', 'Gusts tear away half as much') },
    { id: 'swift',  max: 3, icon: '👟', name: L('すばやい', 'Swift'), desc: L('クモの はやさ +12%', 'Spider speed +12%') },
    { id: 'refill', max: 0, icon: '🥛', name: L('いと まんたん', 'Full refill'), desc: L('いますぐ いとが まんたんになる', 'Refill your silk right now') },
  ];

  // ---------- A2. weather of the day (day 2 onwards) ----------
  const WEATHERS = [
    { id: 'clear',  w: 4,   icon: '☀️', name: L('はれ', 'Clear'), desc: L('いつもどおり', 'A normal day') },
    { id: 'rain',   w: 1.2, icon: '☔', name: L('あめ', 'Rain'), desc: L('糸が のびて 安く はれる。虫は すくなめ', 'Spinning is cheap, but fewer bugs') },
    { id: 'moon',   w: 1,   icon: '🌕', name: L('まんげつ', 'Full moon'), desc: L('レア虫と いろちがいが よく来る', 'Rare bugs and colour variants come often') },
    { id: 'swarm',  w: 1,   icon: '🐜', name: L('むしの大群', 'Swarm'), desc: L('小さな虫が たくさん来る', 'Lots of small bugs') },
    { id: 'breezy', w: 1,   icon: '🌬️', name: L('かぜの日', 'Windy day'), desc: L('かぜが よくふく。ボーナスは たまりやすい', 'Frequent breezes, but bonus fills faster') },
  ];

  // ---------- B1. difficulty stars (normal mode). Each star adds one rule ----------
  const STAR_CLEAR_DAY = 7;     // reach this day at your highest star to unlock the next
  const STARS = [
    null,
    { rule: L('かぜが よく ふく', 'More breezes') },
    { rule: L('いとが へりやすい', 'Silk drains faster') },
    { rule: L('とっぷうが 2日目から', 'Gusts from day 2') },
    { rule: L('重い虫が はじめから来る', 'Heavy bugs from the start') },
    { rule: L('虫が にげやすい', 'Bugs escape sooner') },
    { rule: L('とっぷうが つよい', 'Stronger gusts') },
    { rule: L('いとが もっと へる', 'Silk drains even faster') },
    { rule: L('虫が すばやい', 'Faster bugs') },
    { rule: L('ボーナスが たまりにくい', 'Bonus fills slower') },
    { rule: L('「つづける」なし', 'No continue') },
  ];
  const MAX_STAR = STARS.length - 1;

  // combined multipliers for a run (charms + weather + stars). Everything defaults to neutral.
  function mods(run) {
    const c = (run && run.charms) || {};
    const n = id => c[id] || 0;
    const star = (run && run.star) || 0;
    const w = (run && run.weather) || 'clear';
    const m = {
      strength: n('strong') * 0.6, tieMul: 1 + n('tie'), flutter: n('flutter'), calm: n('calm') > 0,
      bonusGain: 1 + n('bonus') * 0.35, feast: 1 + n('feast') * 0.5, cost: 1 - n('thrift') * 0.15,
      struggle: 1 + n('sticky') * 0.2, coins: 1 + n('coin') * 0.2, comboExtra: n('combo'),
      lure: 1 + n('lucky') * 0.6, glow: 1 + n('glow') * 0.5, drain: 1 - n('saver') * 0.12,
      gust: Math.pow(0.5, n('guard')), speed: 1 + n('swift') * 0.12,
      spawn: 1, breezeEvery: 1, bonusNeed: 1, gustFromDay: D.BALANCE.gustFromDay, heavyFull: false,
      bugSpeed: 1, noContinue: false, smallOnly: false, score: 1 + star * 0.1, rain: false,
      // colour variants: each active boost (lucky charm, full moon) makes them 4x likelier
      shiny: SHINY_CHANCE * (n('lucky') > 0 ? SHINY_BOOST : 1) * (w === 'moon' ? SHINY_BOOST : 1),
    };
    m.coins *= 1 + star * 0.2;
    if (w === 'rain') { m.cost *= 0.7; m.spawn *= 1.3; m.rain = true; }
    if (w === 'moon') m.lure *= 2.5;
    if (w === 'swarm') { m.spawn *= 0.6; m.smallOnly = true; }
    if (w === 'breezy') { m.breezeEvery *= 0.5; m.bonusGain *= 1.3; }
    if (star >= 1) m.breezeEvery *= 0.6;
    if (star >= 2) m.drain *= 1.15;
    if (star >= 3) m.gustFromDay = 2;
    if (star >= 4) m.heavyFull = true;
    if (star >= 5) m.struggle *= 0.85;
    if (star >= 6) m.gust *= 1.35;
    if (star >= 7) m.drain *= 1.15;
    if (star >= 8) m.bugSpeed *= 1.15;
    if (star >= 9) m.bonusNeed *= 1.3;
    if (star >= 10) m.noContinue = true;
    return m;
  }

  // three different charms to offer, skipping ones already stacked to the max
  function charmChoices(run, rnd) {
    rnd = rnd || Math.random;
    const c = (run && run.charms) || {};
    const pool = CHARMS.filter(ch => !ch.max || (c[ch.id] || 0) < ch.max);
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0].id);
    return out;
  }

  function pickWeather(rnd) {
    rnd = rnd || Math.random;
    let sum = 0;
    for (const w of WEATHERS) sum += w.w;
    let r = rnd() * sum;
    for (const w of WEATHERS) { r -= w.w; if (r <= 0) return w.id; }
    return 'clear';
  }

  // ---------- C1-C3. Bugdex: catch-count ranks, size records, colour variants ----------
  // body length in mm (wingspan for butterflies and moths)
  const MM = {
    gnat: 2.5, fly: 8, greenfly: 9, horsefly: 17, mosquito: 5.5, tigermosq: 4.5, ladybug: 8, ladybug2: 7,
    butterfly: 50, sulphur: 48, blue: 25, swallowtail: 90, emperor: 100, moth: 40, silkmoth: 130, luna: 110,
    bee: 13, carpenter: 23, hornet: 40, dragonfly: 52, redfly: 38, emperorfly: 75, oniyanma: 100,
    firefly: 15, firefly2: 8, cicada: 58, minmin: 60, beetle: 27, chafer: 20, jewel: 38, golden: 22,
    kokuwa: 35, stag: 55, miyama: 60, ookuwa: 65, kabuto: 70, caucasus: 100, hercules: 140,
  };
  const SIZE_SPREAD = 0.09, SIZE_MIN = 0.72, SIZE_MAX = 1.28;
  // each bug carries its own gold lines for the biggest and the smallest record;
  // rare and boss bugs (seldom met) get easier lines
  function sizeGold(type) {
    const d = D.INSECTS[type], mm = MM[type] || 10;
    const k = d.boss || d.rare ? 0.1 : 0.16;
    return { big: Math.round(mm * (1 + k) * 10) / 10, small: Math.round(mm * (1 - k) * 10) / 10 };
  }
  function rollSize(rnd) {
    rnd = rnd || Math.random;
    // sum of uniforms ≈ normal
    const z = (rnd() + rnd() + rnd() + rnd() - 2) * Math.sqrt(3);
    return Math.max(SIZE_MIN, Math.min(SIZE_MAX, 1 + z * SIZE_SPREAD));
  }
  function sizeMM(type, f) { return Math.round((MM[type] || 10) * f * 10) / 10; }

  function rankLines(type) { const d = D.INSECTS[type]; return d.boss || d.rare ? [3, 15, 50] : [10, 50, 200]; }
  function dexRank(type, n) { const r = rankLines(type); return n >= r[2] ? 3 : n >= r[1] ? 2 : n >= r[0] ? 1 : 0; }

  // ---------- C4. family sets: every bug of a family at gold rank ----------
  const FAMILIES = [];
  for (const k of D.INSECT_ORDER) { const f = D.INSECTS[k].kind; if (!FAMILIES.includes(f)) FAMILIES.push(f); }
  const familyBugs = f => D.INSECT_ORDER.filter(k => D.INSECTS[k].kind === f);
  const SET_REWARD = { coins: 300, drops: 5 };

  // ---------- D1-D3. looks: spider parts, web silk, knots, seasons ----------
  // price: coins; drops: dew-drop price (exchange). Items with only `drops` are exchange-only.
  // Coin prices come in three clear tiers: within reach 100-1000, a bit of effort 2000-5000,
  // long-haul 20000-50000. Silk, knots and scenery lean cheap; only the special ones are pricey.
  const P = (id, o) => Object.assign({ id, price: 0 }, o);
  const PARTS = {
    body: [
      P('classic', { body: '#3a3350', belly: '#5a4f78', name: L('いつもの', 'Classic') }),
      P('cherry',  { price: 150,  body: '#d94a6a', belly: '#f27e98', name: L('さくらんぼ', 'Cherry') }),
      P('sky',     { price: 250,  body: '#3f8fd9', belly: '#7cc0ff', name: L('そらいろ', 'Sky') }),
      P('leaf',    { price: 400,  body: '#3f9a5a', belly: '#78c98f', name: L('はっぱ', 'Leafy') }),
      P('mint',    { price: 500,  body: '#3fb8a8', belly: '#9ae8dc', name: L('ミント', 'Mint') }),
      P('choco',   { price: 700,  body: '#6a4430', belly: '#a0705a', pattern: 'spots', name: L('チョコ', 'Choco') }),
      P('bee',     { price: 900,  body: '#f2b632', belly: '#ffd96b', pattern: 'stripes', name: L('ハチさん', 'Bumble') }),
      P('night',   { price: 2000, body: '#2b2f6b', belly: '#5258b5', name: L('よぞら', 'Night') }),
      P('snow',    { price: 3000, body: '#cfd8ee', belly: '#ffffff', name: L('ゆきだま', 'Snowball') }),
      P('tentou',  { price: 4000, body: '#d8322f', belly: '#ff6a5a', pattern: 'ladybug', name: L('テントウムシ', 'Ladybird') }),
      P('royal',   { price: 5000, drops: 20, body: '#7a3fb5', belly: '#b07de0', name: L('おうさま', 'Royal') }),
      P('gold',    { price: 25000, drops: 35, body: '#d6a21a', belly: '#ffd95e', shiny: true, name: L('きんぴか', 'Golden') }),
      P('galaxy',  { price: 50000, drops: 45, body: '#1c1640', belly: '#4a3a9a', pattern: 'galaxy', shiny: true, name: L('ぎんが', 'Galaxy') }),
      P('rainbow', { drops: 40, body: '#ff6f9a', belly: '#ffe066', pattern: 'rainbow', shiny: true, name: L('にじいろ', 'Rainbow') }),
      P('crystal', { drops: 60, body: '#7ad0ff', belly: '#e8fbff', pattern: 'crystal', shiny: true, name: L('すいしょう', 'Crystal') }),
    ],
    hat: [
      P('none',     { name: L('なし', 'None') }),
      P('ribbon',   { price: 150,  name: L('リボン', 'Ribbon') }),
      P('cap',      { price: 250,  name: L('キャップ', 'Cap') }),
      P('leaf',     { price: 300,  name: L('はっぱ', 'Leaf') }),
      P('acorn',    { price: 400,  name: L('どんぐりぼうし', 'Acorn cap') }),
      P('flower',   { price: 500,  name: L('おはな', 'Flower') }),
      P('beret',    { price: 600,  name: L('ベレーぼう', 'Beret') }),
      P('straw',    { price: 800,  name: L('むぎわらぼうし', 'Straw hat') }),
      P('antenna',  { price: 1000, name: L('しょっかく', 'Antennae') }),
      P('mushroom', { price: 2000, name: L('きのこ', 'Mushroom') }),
      P('bunny',    { price: 2500, name: L('うさみみ', 'Bunny ears') }),
      P('cat',      { price: 2500, name: L('ねこみみ', 'Cat ears') }),
      P('headphones', { price: 3000, name: L('ヘッドホン', 'Headphones') }),
      P('nightcap', { price: 3500, name: L('ナイトキャップ', 'Nightcap') }),
      P('propeller', { price: 4000, name: L('プロペラぼうし', 'Propeller cap') }),
      P('tophat',   { price: 4500, name: L('シルクハット', 'Top hat') }),
      P('witch',    { price: 5000, name: L('まじょのぼうし', 'Witch hat') }),
      P('pirate',   { price: 5000, name: L('かいぞくぼうし', 'Pirate hat') }),
      P('crown',    { price: 30000, drops: 20, name: L('おうかん', 'Crown') }),
      P('halo',     { drops: 35, name: L('てんしのわ', 'Halo') }),
      P('dewcrown', { drops: 50, name: L('しずくのかんむり', 'Dew crown') }),
    ],
    face: [
      P('none',     { name: L('なし', 'None') }),
      P('blush',    { price: 150, name: L('ハートほっぺ', 'Heart cheeks') }),
      P('freckles', { price: 200, name: L('そばかす', 'Freckles') }),
      P('whiskers', { price: 300, name: L('ねこひげ', 'Whiskers') }),
      P('tongue',   { price: 400, name: L('ぺろっ', 'Tongue out') }),
      P('bandaid',  { price: 600, name: L('ばんそうこう', 'Plaster') }),
      P('mustache', { price: 800, name: L('おひげ', 'Mustache') }),
      P('shades',   { price: 2000, name: L('サングラス', 'Shades') }),
      P('glasses',  { price: 2500, name: L('まるメガネ', 'Round glasses') }),
      P('goggles',  { price: 3500, name: L('ゴーグル', 'Goggles') }),
      P('hearteyes', { price: 4000, name: L('ハートおめめ', 'Heart eyes') }),
      P('monocle',  { price: 5000, name: L('かためがね', 'Monocle') }),
      P('starglasses', { price: 20000, drops: 30, name: L('ほしがたメガネ', 'Star glasses') }),
      P('stareyes', { drops: 25, name: L('キラキラおめめ', 'Sparkly eyes') }),
    ],
    thread: [
      P('white',    { color: null, name: L('しろ', 'White') }),
      P('pink',     { price: 100, color: '#ffb3cf', name: L('さくら色', 'Pink') }),
      P('mint',     { price: 100, color: '#a8f0dc', name: L('ミント色', 'Mint') }),
      P('sky',      { price: 150, color: '#9fdcff', name: L('みずいろ', 'Sky blue') }),
      P('lemon',    { price: 150, color: '#fff09a', name: L('レモン色', 'Lemon') }),
      P('lavender', { price: 200, color: '#d2b8ff', name: L('ふじいろ', 'Lavender') }),
      P('peach',    { price: 200, color: '#ffc8a8', name: L('もも色', 'Peach') }),
      P('orange',   { price: 300, color: '#ffb35a', name: L('みかん色', 'Tangerine') }),
      P('lime',     { price: 300, color: '#c8f07a', name: L('わかくさ色', 'Lime') }),
      P('silver',   { price: 2000, color: '#dfe6f2', sheen: true, name: L('ぎんいろ', 'Silver') }),
      P('candy',    { price: 3000, color: '#ffffff', stripe: '#ff6f9a', name: L('キャンディ', 'Candy stripe') }),
      P('nightglow', { price: 4000, color: '#bfe6ff', glow: true, name: L('よるに ひかる', 'Night glow') }),
      P('gold',     { price: 20000, drops: 25, color: '#ffd84a', sheen: true, name: L('きんいろ', 'Gold') }),
      P('sparkle',  { price: 25000, drops: 30, color: '#fff6d0', sparkle: true, name: L('ほしくず', 'Stardust') }),
      P('fire',     { price: 30000, drops: 35, fire: true, name: L('ほのお', 'Flame') }),
      P('rainbow',  { price: 40000, drops: 35, rainbow: true, name: L('にじいろ', 'Rainbow') }),
      P('aurora',   { drops: 50, aurora: true, glow: true, name: L('オーロラ', 'Aurora') }),
    ],
    knot: [
      P('dot',       { name: L('まる', 'Dot') }),
      P('heart',     { price: 150, name: L('ハート', 'Heart') }),
      P('star',      { price: 150, name: L('ほし', 'Star') }),
      P('clover',    { price: 200, name: L('クローバー', 'Clover') }),
      P('moon',      { price: 250, name: L('みかづき', 'Crescent') }),
      P('flower',    { price: 300, name: L('おはな', 'Flower') }),
      P('ribbon',    { price: 400, name: L('リボン', 'Ribbon') }),
      P('button',    { price: 500, name: L('ボタン', 'Button') }),
      P('snowflake', { price: 600, name: L('ゆきのけっしょう', 'Snowflake') }),
      P('candy',     { price: 800, name: L('あめだま', 'Candy') }),
      P('drop',      { price: 2500, name: L('しずく', 'Dew drop') }),
      P('pearl',     { price: 3000, name: L('しんじゅ', 'Pearl') }),
      P('gem',       { price: 25000, drops: 30, name: L('ほうせき', 'Jewel') }),
      P('diamond',   { drops: 25, name: L('ダイヤ', 'Diamond') }),
    ],
    bg: [
      P('none',      { name: L('いつもの にわ', 'Garden') }),
      P('spring',    { price: 500, name: L('はる（さくら）', 'Spring') }),
      P('summer',    { price: 500, name: L('なつ（ひまわり）', 'Summer') }),
      P('autumn',    { price: 500, name: L('あき（もみじ）', 'Autumn') }),
      P('winter',    { price: 800, name: L('ふゆ（ゆき）', 'Winter') }),
      P('tsuyu',     { price: 700, name: L('つゆ（あじさい）', 'Rainy season') }),
      P('harvest',   { price: 900, name: L('みのり（いなほ）', 'Harvest') }),
      P('forest',    { price: 2500, name: L('もりのおく', 'Deep forest') }),
      P('seaside',   { price: 3000, name: L('うみべ', 'Seaside') }),
      P('candyland', { price: 4000, name: L('おかしのくに', 'Candyland') }),
      P('space',     { price: 35000, drops: 40, name: L('うちゅう', 'Outer space') }),
    ],
  };
  const SLOTS = Object.keys(PARTS);
  const DEFAULT_LOOK = { body: 'classic', hat: 'none', face: 'none', thread: 'white', knot: 'dot', bg: 'none' };
  const part = (slot, id) => PARTS[slot].find(p => p.id === id) || PARTS[slot][0];
  // what the old single-pick outfits (v1.8 and earlier) were made of
  const OLD_COSTUMES = {
    classic: {}, cherry: { body: 'cherry', hat: 'ribbon' }, sky: { body: 'sky', hat: 'cap' }, leaf: { body: 'leaf', hat: 'leaf' },
    bee: { body: 'bee' }, night: { body: 'night', face: 'glasses' }, royal: { body: 'royal', hat: 'crown' }, gold: { body: 'gold', hat: 'crown' },
  };
  // a spider look the renderer understands: colours + hat + face
  function spiderLook(look) {
    look = look || DEFAULT_LOOK;
    const b = part('body', look.body);
    return { body: b.body, belly: b.belly, pattern: b.pattern || null, shiny: !!b.shiny, hat: look.hat || 'none', face: look.face || 'none' };
  }
  // challenge stages lend a random combination from every part, owned or not
  function randomLook(rnd) {
    rnd = rnd || Math.random;
    const pick = (slot, noneBias) => {
      const list = PARTS[slot];
      if (noneBias && rnd() < noneBias) return list[0].id;
      return list[1 + Math.floor(rnd() * (list.length - 1))].id;
    };
    return { body: pick('body', 0), hat: pick('hat', 0.15), face: pick('face', 0.35) };
  }

  // ---------- D4. titles ----------
  const TITLES = {
    rookie: L('みならいクモ', 'Rookie spider'),
    hunter: L('むしとり名人', 'Bug catcher'), legend: L('でんせつのクモ', 'Legendary spider'),
    knotter: L('むすびの名人', 'Knot master'), combo: L('コンボマスター', 'Combo master'),
    survivor: L('いきのびの達人', 'Survivor'), scorer: L('スコアキング', 'Score king'),
    gustproof: L('とっぷうに まけない', 'Gustproof'), bosshunter: L('ボスハンター', 'Boss hunter'),
    shinyhunter: L('いろちがいハンター', 'Variant hunter'), professor: L('むしはかせ', 'Bug professor'),
    goldprof: L('でんせつの はかせ', 'Legendary professor'), bigcatch: L('おおものハンター', 'Big-game hunter'),
    tinycatch: L('ちびっこハンター', 'Tiny-bug hunter'), starspider: L('ほしのクモ', 'Star spider'),
    challenger: L('チャレンジャー', 'Challenger'), taskmaster: L('おだい名人', 'Task master'),
    strongman: L('ちからもち', 'Strongman'), sweettooth: L('あまいもの好き', 'Sweet tooth'),
    weather: L('おてんきはかせ', 'Weather expert'), charmer: L('おまもり名人', 'Charm collector'),
  };
  // family set titles ('fam_<kind>') are built from the family name in the UI

  // ---------- E1. achievements ----------
  // stat: key in save.stats (lifetime totals and best-of-run values), or a computed one.
  const ACH_DEF = [
    ['catches', [50, 200, 1000, 3000, 10000], { title: 'hunter' }, L('虫を {n}ひき つかまえる', 'Catch {n} bugs')],
    ['runCatch', [30, 60, 100, 150], { title: 'legend' }, L('1回で 虫を {n}ひき', 'Catch {n} bugs in one run')],
    ['ties', [10, 100, 500, 2000], { title: 'knotter' }, L('糸を {n}かしょ むすぶ', 'Tie {n} knots')],
    ['combo', [5, 10, 20, 30], { title: 'combo' }, L('{n}コンボ をだす', 'Make a {n} combo')],
    ['day', [2, 3, 5, 7, 10, 15], { title: 'survivor' }, L('{n}にちめ まで いきのびる', 'Reach day {n}')],
    ['score', [3000, 10000, 30000, 60000, 100000], { title: 'scorer' }, L('1回で スコア {n}', 'Score {n} in one run')],
    ['gusts', [1, 10, 30], { title: 'gustproof' }, L('とっぷうを {n}回 のりこえる', 'Weather {n} gusts')],
    ['bonuses', [1, 20, 100], {}, L('ボーナスタイムを {n}回', 'Reach bonus time {n} times')],
    ['treats', [30, 300, 1000], { title: 'sweettooth' }, L('おかしを {n}こ あつめる', 'Collect {n} treats')],
    ['bosses', [1, 10, 50], { title: 'bosshunter' }, L('ボス虫を {n}ひき つかまえる', 'Catch {n} boss bugs')],
    ['heavy', [10, 100, 500], { title: 'strongman' }, L('おもさ5いじょうの虫を {n}ひき', 'Catch {n} bugs weighing 5+')],
    ['shiny', [1, 5, 15], { title: 'shinyhunter' }, L('いろちがいを {n}ひき つかまえる', 'Catch {n} colour variants')],
    ['dexFound', [10, 20, 30, 38], { title: 'professor' }, L('ずかんを {n}しゅるい みつける', 'Find {n} species')],
    ['dexSilver', [5, 20], {}, L('ぎんランクを {n}しゅるい', 'Get {n} species to silver')],
    ['dexGold', [1, 10, 38], { title: 'goldprof' }, L('きんランクを {n}しゅるい', 'Get {n} species to gold')],
    ['bigGold', [1, 10, 38], { title: 'bigcatch' }, L('おおきさ金を {n}しゅるい', 'Biggest-size gold for {n} species')],
    ['smallGold', [1, 10, 38], { title: 'tinycatch' }, L('ちいささ金を {n}しゅるい', 'Smallest-size gold for {n} species')],
    ['stars', [1, 3, 5, 10], { title: 'starspider' }, L('むずかしさ★{n}を クリア', 'Clear difficulty ★{n}')],
    ['chStage', [10, 20, 30], { title: 'challenger' }, L('チャレンジ ステージ{n}を クリア', 'Clear challenge stage {n}')],
    ['plays', [10, 50, 200], {}, L('ノーマルモードを {n}回 あそぶ', 'Play Normal mode {n} times')],
    ['charms', [10, 100], { title: 'charmer' }, L('おまもりを {n}こ えらぶ', 'Pick {n} charms')],
    ['odai', [3, 30, 100], { title: 'taskmaster' }, L('きょうのおだいを {n}こ たっせい', 'Finish {n} daily tasks')],
    ['weatherKinds', [5], { title: 'weather' }, L('{n}しゅるいの 天気を たいけん', 'See all {n} kinds of weather')],
  ];
  const ACHIEVEMENTS = [];
  for (const [stat, tiers, top, text] of ACH_DEF) {
    tiers.forEach((n, i) => {
      const last = i === tiers.length - 1;
      const tier = i / Math.max(1, tiers.length - 1);
      ACHIEVEMENTS.push({
        id: stat + '_' + n, stat, n, text,
        coins: Math.round((60 + 440 * tier) / 10) * 10,
        drops: last ? 5 : i >= 1 ? 1 : 0,
        title: last ? top.title || null : null,
      });
    });
  }

  // ---------- E2. today's tasks (pay out dew drops, not coins) ----------
  // run: counted within one run (best of the day); otherwise added up over the day's runs
  const ODAI = [
    { id: 'catch',  min: 40, max: 80, step: 5, text: L('虫を {n}ひき つかまえる', 'Catch {n} bugs') },
    { id: 'kind',   min: 6,  max: 15, step: 1, text: L('{k}を {n}ひき つかまえる', 'Catch {n} {k}') },
    { id: 'combo',  min: 6,  max: 12, step: 1, run: true, text: L('{n}コンボ をだす', 'Make a {n} combo') },
    { id: 'day',    min: 3,  max: 5,  step: 1, run: true, text: L('{n}にちめ まで いきのびる', 'Reach day {n}') },
    { id: 'ties',   min: 8,  max: 20, step: 2, text: L('糸を {n}かしょ むすぶ', 'Tie {n} knots') },
    { id: 'treats', min: 15, max: 40, step: 5, text: L('おかしを {n}こ あつめる', 'Collect {n} treats') },
    { id: 'score',  min: 3000, max: 8000, step: 500, run: true, text: L('1回で スコア {n}', 'Score {n} in one run') },
    { id: 'bonus',  min: 2,  max: 4,  step: 1, text: L('ボーナスタイムを {n}回', 'Reach bonus time {n} times') },
    { id: 'heavy3', min: 5,  max: 15, step: 1, text: L('おもさ3いじょうの虫を {n}ひき', 'Catch {n} bugs weighing 3+') },
    { id: 'charms', min: 2,  max: 4,  step: 1, text: L('おまもりを {n}こ えらぶ', 'Pick {n} charms') },
  ];
  const ODAI_KINDS = ['fly', 'mosquito', 'ladybug', 'butterfly', 'moth', 'bee', 'dragonfly', 'firefly', 'cicada', 'beetle'];
  const ODAI_DROPS = 3, ODAI_ALL_BONUS = 4;

  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  }
  function today(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function makeOdai(date) {
    const r = seeded('odai' + date);
    const pool = ODAI.slice(), tasks = [];
    while (tasks.length < 3) {
      const o = pool.splice(Math.floor(r() * pool.length), 1)[0];
      const steps = Math.round((o.max - o.min) / o.step);
      const t = { id: o.id, n: o.min + Math.floor(r() * (steps + 1)) * o.step, cur: 0, done: false };
      if (o.id === 'kind') t.key = ODAI_KINDS[Math.floor(r() * ODAI_KINDS.length)];
      tasks.push(t);
    }
    return { date, tasks, allDone: false };
  }
  // progress of one task from a run's numbers
  function odaiRunValue(task, run) {
    if (!run) return 0;
    switch (task.id) {
      case 'catch': return run.catches || 0;
      case 'kind': return (run.kinds && run.kinds[task.key]) || 0;
      case 'combo': return run.maxCombo || 0;
      case 'day': return run.day || 0;
      case 'ties': return run.ties || 0;
      case 'treats': return run.treats || 0;
      case 'score': return run.score || 0;
      case 'bonus': return run.bonuses || 0;
      case 'heavy3': return (run.weights || []).filter(w => w >= 3).length;
      case 'charms': return run.charmPicks || 0;
      default: return 0;
    }
  }
  function odaiProgress(task, run) {
    const def = ODAI.find(o => o.id === task.id);
    const v = odaiRunValue(task, run);
    return Math.min(task.n, def && def.run ? Math.max(task.cur, v) : task.cur + v);
  }

  // ---------- save helpers ----------
  function defaults() {
    return {
      drops: 0,
      stats: {},
      ach: {},
      dex: { big: {}, small: {}, shiny: {} },
      sets: {},
      titles: ['rookie'], title: 'rookie',
      parts: { body: ['classic'], hat: ['none'], face: ['none'], thread: ['white'], knot: ['dot'], bg: ['none'] },
      look: Object.assign({}, DEFAULT_LOOK),
      stars: { cleared: -1, sel: 0, best: {} },
      odai: { date: '', tasks: [], allDone: false },
      weathers: [],
      metaVer: 1,
    };
  }
  // v1.8 saves: single outfits -> parts, challenge outfit id -> a look
  function migrate(s) {
    if (s.metaVer >= 1) return s;
    s.metaVer = 1;
    for (const id of s.costumes || []) {
      const o = OLD_COSTUMES[id];
      if (!o) continue;
      for (const slot in o) if (!s.parts[slot].includes(o[slot])) s.parts[slot].push(o[slot]);
    }
    const cur = OLD_COSTUMES[s.costume];
    if (cur) s.look = Object.assign({}, DEFAULT_LOOK, cur);
    if (s.challenge && typeof s.challenge.costume === 'string') { s.challenge.look = null; s.challenge.costumeStage = -1; }
    // players who already reached day 7 start with ★1 open
    if ((s.bestDay || 0) >= STAR_CLEAR_DAY) s.stars.cleared = Math.max(s.stars.cleared, 0);
    return s;
  }

  const starsOpen = s => Math.min(MAX_STAR, s.stars.cleared + 1);

  function ensureOdai(s, date) {
    date = date || today();
    if (!s.odai || s.odai.date !== date) s.odai = makeOdai(date);
    return s.odai;
  }

  function bump(stats, k, v) { stats[k] = (stats[k] || 0) + (v || 0); }
  function best(stats, k, v) { stats[k] = Math.max(stats[k] || 0, v || 0); }

  // values the achievements look at
  function statValue(s, stat) {
    const st = s.stats || {};
    switch (stat) {
      case 'dexFound': return D.INSECT_ORDER.filter(k => s.caught[k]).length;
      case 'dexSilver': return D.INSECT_ORDER.filter(k => dexRank(k, s.caught[k] || 0) >= 2).length;
      case 'dexGold': return D.INSECT_ORDER.filter(k => dexRank(k, s.caught[k] || 0) >= 3).length;
      case 'bigGold': return D.INSECT_ORDER.filter(k => s.dex.big[k] >= sizeGold(k).big).length;
      case 'smallGold': return D.INSECT_ORDER.filter(k => s.dex.small[k] && s.dex.small[k] <= sizeGold(k).small).length;
      case 'stars': return Math.max(0, s.stars.cleared);
      case 'chStage': return (s.challenge && s.challenge.cleared) || 0;
      case 'weatherKinds': return (s.weathers || []).length;
      default: return st[stat] || 0;
    }
  }

  // grant everything newly earned; returns a list of {kind, ...} for the result screen
  function grant(s, rw, out, item) {
    if (rw.coins) s.coins += rw.coins;
    if (rw.drops) s.drops += rw.drops;
    if (rw.title && !s.titles.includes(rw.title)) s.titles.push(rw.title);
    out.push(item);
  }
  function checkRewards(s) {
    const out = [];
    for (const a of ACHIEVEMENTS) {
      if (s.ach[a.id] || statValue(s, a.stat) < a.n) continue;
      s.ach[a.id] = Date.now();
      grant(s, a, out, { kind: 'ach', id: a.id, a });
    }
    for (const f of FAMILIES) {
      if (s.sets[f]) continue;
      if (familyBugs(f).every(k => dexRank(k, s.caught[k] || 0) >= 3)) {
        s.sets[f] = Date.now();
        grant(s, Object.assign({ title: 'fam_' + f }, SET_REWARD), out, { kind: 'set', family: f });
      }
    }
    return out;
  }

  // fold a finished normal-mode run into lifetime stats, dex, odai, stars; returns new rewards
  function applyRun(s, run) {
    const st = s.stats;
    bump(st, 'catches', run.catches); bump(st, 'ties', run.ties); bump(st, 'gusts', run.gustsSurvived);
    bump(st, 'bonuses', run.bonuses); bump(st, 'treats', run.treats); bump(st, 'bosses', run.bosses);
    bump(st, 'heavy', (run.weights || []).filter(w => w >= 5).length); bump(st, 'shiny', run.shinyCaught);
    bump(st, 'plays', 1); bump(st, 'charms', run.charmPicks);
    best(st, 'runCatch', run.catches); best(st, 'combo', run.maxCombo); best(st, 'day', run.day); best(st, 'score', run.score);
    for (const k in run.big || {}) if (!(s.dex.big[k] >= run.big[k])) s.dex.big[k] = run.big[k];
    for (const k in run.small || {}) if (!s.dex.small[k] || s.dex.small[k] > run.small[k]) s.dex.small[k] = run.small[k];
    for (const k in run.shinies || {}) s.dex.shiny[k] = (s.dex.shiny[k] || 0) + run.shinies[k];
    for (const w of run.weathersSeen || []) if (!s.weathers.includes(w)) s.weathers.push(w);
    const out = [];
    // today's tasks
    const od = ensureOdai(s);
    for (const t of od.tasks) {
      if (t.done) continue;
      const def = ODAI.find(o => o.id === t.id);
      const v = odaiRunValue(t, run);
      t.cur = Math.min(t.n, def.run ? Math.max(t.cur, v) : t.cur + v);
      if (t.cur >= t.n) {
        t.done = true; bump(st, 'odai', 1);
        grant(s, { drops: ODAI_DROPS }, out, { kind: 'odai', task: t });
      }
    }
    if (!od.allDone && od.tasks.length && od.tasks.every(t => t.done)) {
      od.allDone = true;
      grant(s, { drops: ODAI_ALL_BONUS }, out, { kind: 'odaiAll' });
    }
    // stars: best day per star
    const sk = String(run.star || 0);
    s.stars.best[sk] = Math.max(s.stars.best[sk] || 0, run.day);
    return out.concat(checkRewards(s));
  }

  // challenge stages count toward lifetime totals too (not the Bugdex)
  function applyStage(s, run) {
    const st = s.stats;
    bump(st, 'catches', run.catches); bump(st, 'ties', run.ties); bump(st, 'treats', run.treats);
    bump(st, 'bosses', run.bosses); bump(st, 'heavy', (run.weights || []).filter(w => w >= 5).length);
    best(st, 'combo', run.maxCombo);
    return checkRewards(s);
  }

  // buy a part with coins or drops; returns false when it can't be afforded
  function buyPart(s, slot, id, currency) {
    const p = part(slot, id);
    if (s.parts[slot].includes(id)) return false;
    if (currency === 'drops') { if (!p.drops || s.drops < p.drops) return false; s.drops -= p.drops; }
    else { if (!p.price || s.coins < p.price) return false; s.coins -= p.price; }
    s.parts[slot].push(id);
    return true;
  }

  root.SH = root.SH || {};
  root.SH.meta = {
    CHARMS, WEATHERS, STARS, MAX_STAR, STAR_CLEAR_DAY, mods, charmChoices, pickWeather,
    MM, sizeGold, rollSize, sizeMM, rankLines, dexRank, SHINY_CHANCE, SHINY_BOOST, FAMILIES, familyBugs, SET_REWARD,
    PARTS, SLOTS, DEFAULT_LOOK, part, spiderLook, randomLook,
    TITLES, ACHIEVEMENTS, ODAI, ODAI_DROPS, ODAI_ALL_BONUS, makeOdai, today, ensureOdai, odaiProgress, odaiRunValue,
    defaults, migrate, starsOpen, statValue, checkRewards, applyRun, applyStage, buyPart,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SH.meta;
})(typeof globalThis !== 'undefined' ? globalThis : this);
