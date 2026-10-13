// Game data tables: insects, areas (milestones), upgrades, costumes.
// All balance numbers live here so tuning after playtests stays in one file.
(function (root) {
  'use strict';

  // kind: drawing family. weight: compared with thread strength (F-03).
  // struggle: escape-time multiplier. silk: gauge refilled when eaten.
  // pattern: flight path. rare: boosted by the lure upgrade. Families are
  // listed in Bugdex order (INSECT_ORDER follows declaration order).
  const I = (kind, o) => Object.assign({ kind, struggle: 1, pattern: 'wobble' }, o);
  const INSECTS = {
    // --- flies ---
    gnat:      I('fly', { score: 10,  silk: 5,  weight: 0.5, speed: 95,  size: 7,  struggle: 1.15, pattern: 'jitter', color: '#6b6b6b', color2: '#ffffff', tiny: true,
                 name: { ja: 'コバエ', en: 'Gnat' }, note: { ja: 'ちいさくてかるい。むれで飛んでくる', en: 'Tiny and light. Comes in swarms' } }),
    fly:       I('fly', { score: 20,  silk: 8,  weight: 1.2, speed: 110, size: 10, color: '#3d5a66', color2: '#ff7a7a',
                 name: { ja: 'イエバエ', en: 'House fly' }, note: { ja: 'ふらふら飛ぶ、いちばんの獲物', en: 'Your everyday prey' } }),
    greenfly:  I('fly', { score: 30,  silk: 9,  weight: 1.4, speed: 120, size: 10, color: '#2fa36b', color2: '#ff6a5a', shiny: true,
                 name: { ja: 'キンバエ', en: 'Green bottle fly' }, note: { ja: 'みどりにかがやくハエ。すばしっこい', en: 'A shiny green fly. Quick' } }),
    horsefly:  I('fly', { score: 40,  silk: 10, weight: 2.0, speed: 100, size: 13, color: '#8a7a4a', color2: '#5ad1a0',
                 name: { ja: 'アブ', en: 'Horsefly' }, note: { ja: 'ハエよりひとまわり大きい', en: 'A size up from a fly' } }),
    // --- mosquitoes ---
    mosquito:  I('mosquito', { score: 15, silk: 6, weight: 0.7, speed: 80, size: 9, pattern: 'zigzag', color: '#8a6d5a',
                 name: { ja: 'アカイエカ', en: 'Mosquito' }, note: { ja: 'ジグザグに飛ぶ。かるい', en: 'Zigzags around. Light' } }),
    tigermosq: I('mosquito', { score: 20, silk: 6, weight: 0.8, speed: 90, size: 9, pattern: 'zigzag', color: '#2a2a2a', stripes: true,
                 name: { ja: 'ヒトスジシマカ', en: 'Tiger mosquito' }, note: { ja: 'しましまのカ。夜にふえる', en: 'Striped. More of them at night' } }),
    // --- ladybugs ---
    ladybug:   I('ladybug', { score: 25, silk: 7, weight: 1.0, speed: 60, size: 9, pattern: 'flutter', color: '#e8322f', color2: '#1c1830', spots: 7,
                 name: { ja: 'ナナホシテントウ', en: 'Seven-spot ladybird' }, note: { ja: 'あかに7つの点。のんびり飛ぶ', en: 'Red with seven spots. Slow flyer' } }),
    ladybug2:  I('ladybug', { score: 30, silk: 7, weight: 1.0, speed: 65, size: 9, pattern: 'flutter', color: '#1c1830', color2: '#ff5a3a', spots: 2,
                 name: { ja: 'ナミテントウ', en: 'Harlequin ladybird' }, note: { ja: 'くろにあかい点。もようがいろいろ', en: 'Black with red spots. Patterns vary' } }),
    // --- butterflies ---
    butterfly: I('butterfly', { score: 30, silk: 9, weight: 1.5, speed: 60, size: 14, pattern: 'flutter', color: '#ffffff', color2: '#5a5a5a',
                 name: { ja: 'モンシロチョウ', en: 'Cabbage white' }, note: { ja: 'しろいチョウ。ゆっくりでつかまえやすい', en: 'White and slow, easy to catch' } }),
    sulphur:   I('butterfly', { score: 30, silk: 9, weight: 1.5, speed: 62, size: 14, pattern: 'flutter', color: '#ffe25a', color2: '#e0a020',
                 name: { ja: 'モンキチョウ', en: 'Clouded yellow' }, note: { ja: 'きいろいチョウ。はらっぱが好き', en: 'Yellow, loves meadows' } }),
    blue:      I('butterfly', { score: 25, silk: 8, weight: 1.0, speed: 70, size: 11, pattern: 'flutter', color: '#8fb8ff', color2: '#4a6ad0',
                 name: { ja: 'ヤマトシジミ', en: 'Pale grass blue' }, note: { ja: 'ちいさなあおいチョウ', en: 'A tiny blue butterfly' } }),
    swallowtail: I('butterfly', { score: 70, silk: 12, weight: 2.6, speed: 75, size: 18, pattern: 'flutter', color: '#ffd84a', color2: '#2a2244', stripes: true,
                 name: { ja: 'アゲハチョウ', en: 'Swallowtail' }, note: { ja: 'しまもようの大きなチョウ', en: 'A big striped butterfly' } }),
    emperor:   I('butterfly', { score: 250, silk: 15, weight: 3.0, speed: 80, size: 19, pattern: 'flutter', color: '#7a4ad9', color2: '#ffd84a', rare: true, coins: 20,
                 name: { ja: 'オオムラサキ', en: 'Great purple emperor' }, note: { ja: 'むらさきにひかるレアなチョウ。コインがもらえる', en: 'A rare purple beauty that drops coins' } }),
    // --- moths ---
    moth:      I('moth', { score: 40, silk: 12, weight: 2.4, speed: 65, size: 14, pattern: 'flutter', color: '#b9a37e', color2: '#7a5a3a',
                 name: { ja: 'ガ', en: 'Moth' }, note: { ja: '夕方から夜にあらわれる', en: 'Shows up from dusk to night' } }),
    silkmoth:  I('moth', { score: 80, silk: 15, weight: 3.4, speed: 55, size: 18, pattern: 'flutter', color: '#d9a85a', color2: '#8a4a2a', eyespot: true,
                 name: { ja: 'ヤママユ', en: 'Japanese oak silkmoth' }, note: { ja: 'はねに目玉もようのある大きなガ', en: 'A big moth with eyespots' } }),
    luna:      I('moth', { score: 90, silk: 14, weight: 3.0, speed: 55, size: 17, pattern: 'flutter', color: '#bff2d0', color2: '#7ac9a0', glowWing: true,
                 name: { ja: 'オオミズアオ', en: 'Luna moth' }, note: { ja: 'あわいみどりのガ。夜にふわりと飛ぶ', en: 'Pale green, drifts by at night' } }),
    // --- bees ---
    bee:       I('bee', { score: 60, silk: 10, weight: 2.8, speed: 105, size: 12, struggle: 0.6, color: '#ffc531', color2: '#3a2a1a', sting: 14,
                 name: { ja: 'ミツバチ', en: 'Honeybee' }, note: { ja: 'にがすとチクッとさされて、おなかがへる', en: 'Let it escape and it stings you' } }),
    carpenter: I('bee', { score: 90, silk: 12, weight: 4.0, speed: 90, size: 15, struggle: 0.7, color: '#2a2230', color2: '#ffd84a', fuzzy: true, sting: 10,
                 name: { ja: 'クマバチ', en: 'Carpenter bee' }, note: { ja: 'まるくてもふもふ。ちょっと重い', en: 'Round and fuzzy. A bit heavy' } }),
    hornet:    I('bee', { boss: true, score: 150, silk: 14, weight: 5.5, speed: 130, size: 16, struggle: 0.5, color: '#ff9a1a', color2: '#2a1a10', sting: 25,
                 name: { ja: 'スズメバチ', en: 'Giant hornet' }, note: { ja: 'つよくてこわい。ひかる糸でしかつかまえられない。にがすとおなかが大きくへる', en: 'Fierce. Only glowing silk can hold it. Escaping hurts a lot' } }),
    // --- dragonflies ---
    dragonfly: I('dragonfly', { score: 70, silk: 14, weight: 3.6, speed: 165, size: 16, struggle: 0.8, pattern: 'dart', color: '#5aa8e0', color2: '#2a6aa0',
                 name: { ja: 'シオカラトンボ', en: 'Skimmer' }, note: { ja: 'あおいトンボ。とても速い', en: 'A blue dragonfly. Very fast' } }),
    redfly:    I('dragonfly', { score: 60, silk: 12, weight: 3.0, speed: 150, size: 15, struggle: 0.8, pattern: 'dart', color: '#e8503a', color2: '#a03020',
                 name: { ja: 'アキアカネ', en: 'Red darter' }, note: { ja: 'ゆうやけにあう、あかいトンボ', en: 'A red dragonfly of the sunset' } }),
    emperorfly: I('dragonfly', { score: 110, silk: 16, weight: 4.5, speed: 180, size: 19, struggle: 0.7, pattern: 'dart', color: '#4ac06a', color2: '#2a7ad0',
                 name: { ja: 'ギンヤンマ', en: 'Emperor dragonfly' }, note: { ja: 'みどりとあおの大きなヤンマ', en: 'A big green-and-blue hawker' } }),
    oniyanma:  I('dragonfly', { boss: true, score: 180, silk: 20, weight: 6.5, speed: 200, size: 23, struggle: 0.6, pattern: 'dart', color: '#2a2a2a', color2: '#ffd84a', stripes: true,
                 name: { ja: 'オニヤンマ', en: 'Golden-ringed dragonfly' }, note: { ja: '日本でいちばん大きいトンボ。ひかる糸でしかつかまえられない', en: 'Japan\'s largest dragonfly. Only glowing silk can hold it' } }),
    // --- fireflies ---
    firefly:   I('firefly', { silkBonus: 3, score: 50, silk: 26, weight: 1.0, speed: 55, size: 9, struggle: 1.3, pattern: 'flutter', color: '#e8f26a', glow: true,
                 name: { ja: 'ゲンジボタル', en: 'Firefly' }, note: { ja: 'ひかる虫。食べるといとがたくさん回復', en: 'Glows. Restores lots of silk' } }),
    firefly2:  I('firefly', { silkBonus: 3, score: 40, silk: 20, weight: 0.7, speed: 60, size: 7, struggle: 1.3, pattern: 'flutter', color: '#b8ff7a', glow: true,
                 name: { ja: 'ヒメボタル', en: 'Little firefly' }, note: { ja: 'ちいさなホタル。いとがよく回復', en: 'A small firefly. Good silk' } }),
    // --- cicadas ---
    cicada:    I('cicada', { score: 60, silk: 14, weight: 3.2, speed: 95, size: 15, struggle: 0.8, pattern: 'straight', color: '#5a3a2a', color2: 'rgba(140,90,60,0.85)',
                 name: { ja: 'アブラゼミ', en: 'Large brown cicada' }, note: { ja: 'ちゃいろいはねのセミ。夏のひる', en: 'Brown wings. Summer afternoons' } }),
    minmin:    I('cicada', { score: 70, silk: 14, weight: 3.0, speed: 95, size: 15, struggle: 0.8, pattern: 'straight', color: '#2a6a5a', color2: 'rgba(220,240,255,0.7)',
                 name: { ja: 'ミンミンゼミ', en: 'Robust cicada' }, note: { ja: 'すきとおったはねのセミ', en: 'A cicada with clear wings' } }),
    // --- scarabs ---
    beetle:    I('beetle', { score: 100, silk: 18, weight: 5.0, speed: 75, size: 15, struggle: 0.8, pattern: 'straight', color: '#2f8a4e', color2: '#6be08f',
                 name: { ja: 'カナブン', en: 'Flower chafer' }, note: { ja: '重くてかたい。弱い糸は切られてしまう', en: 'Heavy and tough. Snaps weak threads' } }),
    chafer:    I('beetle', { score: 70, silk: 14, weight: 3.5, speed: 80, size: 13, struggle: 0.9, pattern: 'straight', color: '#3a7a2a', color2: '#c8e86a',
                 name: { ja: 'コガネムシ', en: 'Chafer' }, note: { ja: 'つやつやのみどり。カナブンよりかるい', en: 'Glossy green, lighter than a chafer' } }),
    jewel:     I('beetle', { score: 300, silk: 15, weight: 4.0, speed: 115, size: 14, struggle: 0.7, color: '#3ac0a0', color2: '#ff5ad0', rainbow: true, rare: true, coins: 30,
                 name: { ja: 'タマムシ', en: 'Jewel beetle' }, note: { ja: 'にじいろにかがやくレア虫。コインがもらえる', en: 'Rainbow-shiny and rare. Drops coins' } }),
    golden:    I('beetle', { score: 300, silk: 15, weight: 4.2, speed: 120, size: 14, struggle: 0.7, color: '#ffd23f', color2: '#fff2a8', gold: true, rare: true, coins: 30,
                 name: { ja: 'きんのコガネ', en: 'Golden scarab' }, note: { ja: 'ときどきあらわれるレア虫。コインがもらえる', en: 'A rare visitor that drops coins' } }),
    // --- stag beetles ---
    kokuwa:    I('stag', { score: 90, silk: 16, weight: 4.5, speed: 75, size: 14, struggle: 0.8, pattern: 'straight', color: '#3a2a20', color2: '#5a4030', jaw: 0.7,
                 name: { ja: 'コクワガタ', en: 'Small stag beetle' }, note: { ja: 'ちいさめのクワガタ。はじめの目標', en: 'A small stag. A good first goal' } }),
    stag:      I('stag', { score: 200, silk: 22, weight: 7.0, speed: 70, size: 18, struggle: 0.7, pattern: 'straight', color: '#7a3a1a', color2: '#a05a30', jaw: 1.0, saw: true,
                 name: { ja: 'ノコギリクワガタ', en: 'Saw stag beetle' }, note: { ja: 'ギザギザの大あご。とても重い', en: 'Jagged jaws. Very heavy' } }),
    miyama:    I('stag', { score: 250, silk: 24, weight: 8.0, speed: 70, size: 19, struggle: 0.7, pattern: 'straight', color: '#6a4a2a', color2: '#c8a060', jaw: 1.1, crown: true,
                 name: { ja: 'ミヤマクワガタ', en: 'Miyama stag beetle' }, note: { ja: 'あたまにかんむりのようなでっぱり', en: 'Has a crown-like head' } }),
    ookuwa:    I('stag', { score: 400, silk: 28, weight: 9.5, speed: 65, size: 20, struggle: 0.6, pattern: 'straight', color: '#1c1820', color2: '#3a3440', jaw: 1.2, rare: true, coins: 15,
                 name: { ja: 'オオクワガタ', en: 'Giant stag beetle' }, note: { ja: 'くろくて太いあご。あこがれのクワガタ', en: 'Thick black jaws. Everyone\'s dream stag' } }),
    // --- rhinoceros beetles ---
    kabuto:    I('rhino', { score: 300, silk: 26, weight: 8.5, speed: 65, size: 19, struggle: 0.7, pattern: 'straight', color: '#5a2a18', color2: '#8a4a28', horn: 'kabuto',
                 name: { ja: 'カブトムシ', en: 'Japanese rhino beetle' }, note: { ja: 'りっぱなツノの虫の王さま', en: 'The king of bugs, with a grand horn' } }),
    caucasus:  I('rhino', { score: 600, silk: 32, weight: 11, speed: 60, size: 22, struggle: 0.6, pattern: 'straight', color: '#2a2a2a', color2: '#7a8a6a', horn: 'caucasus', rare: true, coins: 30,
                 name: { ja: 'コーカサスオオカブト', en: 'Atlas beetle' }, note: { ja: '3本ヅノの大きなカブト。とても重い', en: 'Three horns. Extremely heavy' } }),
    hercules:  I('rhino', { boss: true, score: 800, silk: 35, weight: 12.5, speed: 60, size: 24, struggle: 0.6, pattern: 'straight', color: '#2a2018', color2: '#d8c070', horn: 'hercules', rare: true, coins: 40,
                 name: { ja: 'ヘラクレスオオカブト', en: 'Hercules beetle' }, note: { ja: 'せかいいち長いカブト。ひかる糸でしかつかまえられない', en: 'The longest beetle. Only glowing silk can hold it' } }),
  };
  const INSECT_ORDER = Object.keys(INSECTS);

  // Bonus time treats: caught automatically on touch, never break threads.
  const TREATS = [
    { id: 'candy',   score: 15, coins: 1, color: '#ff6fa5', color2: '#fff' },
    { id: 'lolli',   score: 20, coins: 2, color: '#7cc8ff', color2: '#fff' },
    { id: 'cookie',  score: 15, coins: 1, color: '#d9a066', color2: '#7a4a24' },
    { id: 'donut',   score: 25, coins: 2, color: '#f7b6d2', color2: '#c98a5b' },
    { id: 'star',    score: 40, coins: 4, color: '#ffe066', color2: '#fff6c2' },
  ];

  // Milestone areas, switched mid-run by score (F-05a).
  // Times of day. The run cycles morning -> daytime -> evening -> night and
  // then a new day starts (F-05a milestones became a day/night cycle in v1.4).
  const AREAS = [
    { id: 'morning', spawn: 1.35, sky: ['#bfe8ff', '#eaf8ff'], hill: '#9fd99a', hill2: '#7cc47a', ground: '#6fb36b', sun: '#fff3b0', night: false,
      table: { gnat: 4, mosquito: 2, fly: 4, butterfly: 3, sulphur: 2.5, blue: 2, ladybug: 2, ladybug2: 1, bee: 2, chafer: 0.8, dragonfly: 1, emperor: 0.12 } },
    { id: 'day',     spawn: 1.2,  sky: ['#8fd3ff', '#e0f6ff'], hill: '#5fae7a', hill2: '#3f8f5e', ground: '#3d7d50', sun: '#fffbe0', night: false,
      table: { fly: 3, greenfly: 2, horsefly: 1.5, bee: 2.5, carpenter: 1.2, hornet: 0.6, dragonfly: 2.5, emperorfly: 1.2, oniyanma: 0.5, swallowtail: 2, cicada: 2.5, minmin: 2, beetle: 1.2, sulphur: 1, jewel: 0.12 } },
    { id: 'evening', spawn: 1.1,  sky: ['#ff9e7a', '#ffe1b8'], hill: '#c97a6a', hill2: '#9c5b5b', ground: '#7a4a4f', sun: '#ffd2a1', night: false,
      table: { gnat: 2, redfly: 3.5, emperorfly: 1, mosquito: 2.5, tigermosq: 1.5, moth: 2.5, chafer: 1.5, beetle: 1.5, kokuwa: 1.2, cicada: 1, horsefly: 1, swallowtail: 0.6 } },
    { id: 'night',   spawn: 1.0,  sky: ['#1d2a5a', '#3b4a86'], hill: '#24315e', hill2: '#18214a', ground: '#141b3d', sun: '#f6f1c7', night: true,
      table: { moth: 3, silkmoth: 1.5, luna: 1, firefly: 3, firefly2: 2, mosquito: 1.5, tigermosq: 2, kabuto: 2, stag: 1.5, kokuwa: 1.5, miyama: 1, ookuwa: 0.3, caucasus: 0.15 } },
    { id: 'stars',   spawn: 0.95, sky: ['#2a1a4a', '#6a4a9a'], hill: '#3a2a6a', hill2: '#281c50', ground: '#1c1438', sun: '#ffe9ff', night: true,
      table: { moth: 2, silkmoth: 1, luna: 1.5, firefly: 3, firefly2: 3, tigermosq: 1.5, kabuto: 2, stag: 1.5, miyama: 1.5, ookuwa: 0.6, caucasus: 0.35, hercules: 0.25 } },
  ];
  // Phases of one day: which AREAS entry and how long (s). Night on even days is the starry night.
  const PHASES = [
    { area: 0, len: 30 },
    { area: 1, len: 30 },
    { area: 2, len: 20 },
    { area: 3, len: 30, starryEvery: 2 },
  ];
  function phaseArea(phase, day) {
    const p = PHASES[phase];
    return p.starryEvery && day % p.starryEvery === 0 ? 4 : p.area;
  }
  const GOLDEN_CHANCE = 0.015;

  // Permanent upgrades bought with coins (F-08, F-11).
  const UPGRADES = [
    { id: 'strength', max: 20, base: 40, exp: 1.5 }, // thread strength
    { id: 'silk',     max: 15, base: 40, exp: 1.5 }, // max silk gauge
    { id: 'sticky',   max: 10, base: 50, exp: 1.5 }, // struggle time
    { id: 'speed',    max: 10, base: 50, exp: 1.5 }, // spider speed
    { id: 'appetite', max: 10, base: 60, exp: 1.5 }, // silk gained per meal
    { id: 'lure',     max: 10, base: 80, exp: 1.6 }, // rare bug chance
  ];

  const COSTUMES = [
    { id: 'classic', price: 0,    body: '#3a3350', belly: '#5a4f78', acc: null },
    { id: 'cherry',  price: 150,  body: '#d94a6a', belly: '#f27e98', acc: 'ribbon' },
    { id: 'sky',     price: 250,  body: '#3f8fd9', belly: '#7cc0ff', acc: 'cap' },
    { id: 'leaf',    price: 400,  body: '#3f9a5a', belly: '#78c98f', acc: 'leaf' },
    { id: 'bee',     price: 600,  body: '#f2b632', belly: '#ffd96b', acc: 'stripes' },
    { id: 'night',   price: 900,  body: '#2b2f6b', belly: '#5258b5', acc: 'glasses' },
    { id: 'royal',   price: 1500, body: '#7a3fb5', belly: '#b07de0', acc: 'crown' },
    { id: 'gold',    price: 3000, body: '#d6a21a', belly: '#ffd95e', acc: 'crown', shiny: true },
  ];

  const BALANCE = {
    baseStrength: 2.2,
    strengthPerUpgrade: 0.5,
    strengthPerLevel: 0.06,
    baseMaxSilk: 100,
    silkPerUpgrade: 12,
    silkPerLevel: 1.5,
    baseStruggle: 3.6,       // seconds; multiplied by insect.struggle
    strugglePerUpgrade: 0.35,
    baseSpeed: 520,          // px/s while spinning or rushing
    speedPerUpgrade: 0.08,
    appetitePerUpgrade: 0.06,
    lurePerUpgrade: 0.2,      // rare spawn weight multiplier step
    silkCostPerPx: 1 / 16,
    baseHunger: 100,         // tummy gauge; the run ends at 0
    drainBase: 1.0,          // tummy/s lost over time
    drainRamp: 0.03,         // extra tummy/s per second played (keeps upgraded runs finite)
    drainMax: 40,
    silkPerFood: 0.4,        // silk refilled per meal = insect.silk * this (* silkBonus)
    glowDuration: 15,        // seconds of glowing silk after bonus time
    gustFromDay: 3,          // endless: gusts start on this day...
    gustDelay: [15, 85],     // ...once per day, this many seconds after dawn
    gustPower: 0.33,         // share of threads a gust tears or blows away
    comboWindow: 3.0,
    bonusNeed: 14,           // meals to fill the bonus gauge (first time)
    bonusNeedStep: 8,        // each later bonus needs this many more meals
    bonusDuration: 9,
    snapNode: 22,
    snapThread: 13,
    tapInsectRadius: 34,
    maxThreads: 70,
    coinsPerScore: 0.1,
  };

  function levelExp(level) { return Math.round(120 * Math.pow(level, 1.45)); } // exp to go from level -> level+1
  function upgradeCost(u, lv) { return Math.round(u.base * Math.pow(lv + 1, u.exp) / 5) * 5; }

  root.SH = root.SH || {};
  root.SH.data = { INSECTS, INSECT_ORDER, TREATS, AREAS, PHASES, phaseArea, GOLDEN_CHANCE, UPGRADES, COSTUMES, BALANCE, levelExp, upgradeCost };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SH.data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
