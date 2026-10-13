// Game data tables: insects, areas (milestones), upgrades, costumes.
// All balance numbers live here so tuning after playtests stays in one file.
(function (root) {
  'use strict';

  // weight: compared with thread strength (F-03). struggle: seconds before it breaks free.
  // silk: silk gauge refilled when eaten. pattern: flight path style.
  const INSECTS = {
    gnat:      { score: 10,  silk: 5,  weight: 0.5, speed: 95,  size: 7,  struggle: 1.15, pattern: 'jitter',  color: '#6b6b6b' },
    mosquito:  { score: 15,  silk: 6,  weight: 0.7, speed: 80,  size: 9,  struggle: 1.0,  pattern: 'zigzag',  color: '#8a6d5a' },
    fly:       { score: 20,  silk: 8,  weight: 1.2, speed: 110, size: 10, struggle: 1.0,  pattern: 'wobble',  color: '#3d5a66' },
    butterfly: { score: 35,  silk: 10, weight: 1.8, speed: 60,  size: 15, struggle: 1.1,  pattern: 'flutter', color: '#ff8fb8' },
    moth:      { score: 40,  silk: 12, weight: 2.4, speed: 65,  size: 14, struggle: 1.0,  pattern: 'flutter', color: '#b9a37e' },
    bee:       { score: 60,  silk: 10, weight: 2.8, speed: 105, size: 12, struggle: 0.6,  pattern: 'wobble',  color: '#ffc531', sting: 14 },
    dragonfly: { score: 70,  silk: 14, weight: 3.6, speed: 165, size: 16, struggle: 0.8,  pattern: 'dart',    color: '#3fb6d9' },
    firefly:   { score: 50,  silk: 26, weight: 1.0, speed: 55,  size: 9,  struggle: 1.3,  pattern: 'flutter', color: '#e8f26a', glow: true },
    beetle:    { score: 100, silk: 18, weight: 5.0, speed: 75,  size: 15, struggle: 0.8,  pattern: 'straight', color: '#2f8a4e' },
    stag:      { score: 200, silk: 22, weight: 7.0, speed: 70,  size: 18, struggle: 0.7,  pattern: 'straight', color: '#5b3a24' },
    golden:    { score: 300, silk: 15, weight: 4.2, speed: 120, size: 14, struggle: 0.7,  pattern: 'wobble',  color: '#ffd23f', rare: true, coins: 30 },
  };
  const INSECT_ORDER = ['gnat', 'mosquito', 'fly', 'butterfly', 'moth', 'bee', 'dragonfly', 'firefly', 'beetle', 'stag', 'golden'];

  // Bonus time treats: caught automatically on touch, never break threads.
  const TREATS = [
    { id: 'candy',   score: 15, coins: 1, color: '#ff6fa5', color2: '#fff' },
    { id: 'lolli',   score: 20, coins: 2, color: '#7cc8ff', color2: '#fff' },
    { id: 'cookie',  score: 15, coins: 1, color: '#d9a066', color2: '#7a4a24' },
    { id: 'donut',   score: 25, coins: 2, color: '#f7b6d2', color2: '#c98a5b' },
    { id: 'star',    score: 40, coins: 4, color: '#ffe066', color2: '#fff6c2' },
  ];

  // Milestone areas, switched mid-run by score (F-05a).
  const AREAS = [
    { id: 'garden',  score: 0,    spawn: 1.35, sky: ['#bfe8ff', '#eaf8ff'], hill: '#9fd99a', hill2: '#7cc47a', ground: '#6fb36b', sun: '#fff3b0', night: false,
      table: { gnat: 5, mosquito: 4, fly: 4, butterfly: 2.5 } },
    { id: 'forest',  score: 800,  spawn: 1.2,  sky: ['#a6e3d0', '#e8fff4'], hill: '#5fae7a', hill2: '#3f8f5e', ground: '#3d7d50', sun: '#fffbe0', night: false,
      table: { gnat: 2, fly: 4, butterfly: 3, bee: 2, dragonfly: 1.5, moth: 1 } },
    { id: 'sunset',  score: 2500, spawn: 1.08, sky: ['#ff9e7a', '#ffe1b8'], hill: '#c97a6a', hill2: '#9c5b5b', ground: '#7a4a4f', sun: '#ffd2a1', night: false,
      table: { fly: 3, moth: 3, dragonfly: 3, bee: 2, beetle: 1.5, butterfly: 2 } },
    { id: 'night',   score: 5000, spawn: 0.98, sky: ['#1d2a5a', '#3b4a86'], hill: '#24315e', hill2: '#18214a', ground: '#141b3d', sun: '#f6f1c7', night: true,
      table: { moth: 4, firefly: 4, beetle: 2, mosquito: 3, stag: 0.6 } },
    { id: 'stars',   score: 9000, spawn: 0.88, sky: ['#2a1a4a', '#6a4a9a'], hill: '#3a2a6a', hill2: '#281c50', ground: '#1c1438', sun: '#ffe9ff', night: true,
      table: { fly: 2, butterfly: 2, moth: 3, bee: 2, dragonfly: 3, firefly: 3, beetle: 2, stag: 1.5 } },
  ];
  const GOLDEN_CHANCE = 0.015;

  // Permanent upgrades bought with coins (F-08, F-11).
  const UPGRADES = [
    { id: 'strength', max: 10, base: 60,  growth: 1.55 }, // thread strength
    { id: 'silk',     max: 10, base: 50,  growth: 1.5 },  // max silk gauge
    { id: 'sticky',   max: 8,  base: 70,  growth: 1.6 },  // struggle time
    { id: 'speed',    max: 8,  base: 60,  growth: 1.55 }, // spider speed
    { id: 'appetite', max: 8,  base: 80,  growth: 1.6 },  // silk gained per meal
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
    strengthPerUpgrade: 0.55,
    strengthPerLevel: 0.06,
    baseMaxSilk: 100,
    silkPerUpgrade: 15,
    silkPerLevel: 1.5,
    baseStruggle: 3.6,       // seconds; multiplied by insect.struggle
    strugglePerUpgrade: 0.4,
    baseSpeed: 520,          // px/s while spinning or rushing
    speedPerUpgrade: 0.09,
    appetitePerUpgrade: 0.1,
    silkCostPerPx: 1 / 16,
    drainBase: 0.9,          // silk/s lost over time
    drainRamp: 0.015,        // extra silk/s per second played
    drainMax: 4.5,
    comboWindow: 3.0,
    bonusNeed: 14,           // meals to fill the bonus gauge
    bonusDuration: 9,
    snapNode: 22,
    snapThread: 13,
    tapInsectRadius: 34,
    maxThreads: 70,
    coinsPerScore: 0.1,
  };

  function levelExp(level) { return Math.round(120 * Math.pow(level, 1.45)); } // exp to go from level -> level+1
  function upgradeCost(u, lv) { return Math.round(u.base * Math.pow(u.growth, lv) / 5) * 5; }

  root.SH = root.SH || {};
  root.SH.data = { INSECTS, INSECT_ORDER, TREATS, AREAS, GOLDEN_CHANCE, UPGRADES, COSTUMES, BALANCE, levelExp, upgradeCost };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SH.data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
