// Replay layer logic: charms, stars, tasks, rewards, save migration.
const test = require('node:test');
const assert = require('node:assert');
require('../js/data.js');
require('../js/stages.js');
const M = require('../js/meta.js');
require('../js/save.js');
const save = globalThis.SH.save;

const fresh = () => save.defaults();
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };

test('mods are neutral without a run and stack with charms, weather and stars', () => {
  const n = M.mods(null);
  assert.strictEqual(n.cost, 1); assert.strictEqual(n.drain, 1); assert.strictEqual(n.coins, 1); assert.strictEqual(n.noContinue, false);
  const m = M.mods({ charms: { thrift: 2, coin: 1 }, weather: 'rain', star: 10 });
  assert.ok(Math.abs(m.cost - 0.7 * 0.7) < 1e-9);
  assert.ok(Math.abs(m.coins - 1.2 * 3) < 1e-9);
  assert.strictEqual(m.noContinue, true);
  assert.strictEqual(m.heavyFull, true);
  assert.strictEqual(m.gustFromDay, 3);
});

test('charm choices are 3 different ones and skip charms at their max', () => {
  const run = { charms: { calm: 1, strong: 3 } };
  for (let i = 0; i < 50; i++) {
    const c = M.charmChoices(run);
    assert.strictEqual(c.length, 3);
    assert.strictEqual(new Set(c).size, 3);
    assert.ok(!c.includes('calm') && !c.includes('strong'));
  }
});

test('daily tasks are the same all day and differ between days', () => {
  const a = M.makeOdai('2026-10-14'), b = M.makeOdai('2026-10-14'), c = M.makeOdai('2026-10-15');
  assert.deepStrictEqual(a, b);
  assert.strictEqual(new Set(a.tasks.map(t => t.id)).size, 3);
  assert.notDeepStrictEqual(a.tasks, c.tasks);
});

test('a run pays out tasks, achievements and drops once', () => {
  const s = fresh();
  s.odai = { date: M.today(), tasks: [{ id: 'catch', n: 10, cur: 0, done: false }, { id: 'combo', n: 5, cur: 0, done: false }, { id: 'day', n: 9, cur: 0, done: false }], allDone: false };
  const run = { catches: 12, maxCombo: 6, day: 2, score: 500, kinds: {}, weights: [], ties: 0, treats: 0, bonuses: 0, bosses: 0, star: 0, weathersSeen: ['clear'] };
  const r1 = M.applyRun(s, run);
  assert.strictEqual(r1.filter(r => r.kind === 'odai').length, 2);
  assert.strictEqual(s.drops >= M.ODAI_DROPS * 2, true);
  assert.ok(s.ach.combo_5 && s.ach.day_2);
  const drops = s.drops, coins = s.coins;
  const r2 = M.applyRun(s, Object.assign({}, run, { catches: 0, maxCombo: 0 }));
  assert.strictEqual(r2.filter(r => r.kind === 'odai' || r.kind === 'ach').length, 0);
  assert.strictEqual(s.drops, drops); assert.strictEqual(s.coins, coins);
});

test('family set: all bugs of a family at gold rank gives a title once', () => {
  const s = fresh();
  for (const k of M.familyBugs('ladybug')) s.caught[k] = 999;
  const r = M.checkRewards(s);
  assert.ok(r.some(x => x.kind === 'set' && x.family === 'ladybug'));
  assert.ok(s.titles.includes('fam_ladybug'));
  assert.ok(!M.checkRewards(s).some(x => x.kind === 'set'));
});

test('size records keep the biggest and the smallest, each with its own gold line', () => {
  const s = fresh();
  const g = M.sizeGold('kabuto');
  assert.ok(g.big > M.MM.kabuto && g.small < M.MM.kabuto);
  const run = { big: { kabuto: g.big + 1 }, small: { kabuto: g.small - 1 }, weights: [], kinds: {} };
  M.applyRun(s, run);
  M.applyRun(s, { big: { kabuto: 60 }, small: { kabuto: 75 }, weights: [], kinds: {} });
  assert.strictEqual(s.dex.big.kabuto, g.big + 1);
  assert.strictEqual(s.dex.small.kabuto, g.small - 1);
  assert.strictEqual(M.statValue(s, 'bigGold'), 1);
  assert.strictEqual(M.statValue(s, 'smallGold'), 1);
  for (let i = 0; i < 1000; i++) { const f = M.rollSize(); assert.ok(f >= 0.72 && f <= 1.28); }
});

test('stars open one by one up to the last', () => {
  const s = fresh();
  assert.strictEqual(M.starsOpen(s), 0);
  s.stars.cleared = 0; assert.strictEqual(M.starsOpen(s), 1);
  s.stars.cleared = M.MAX_STAR; assert.strictEqual(M.starsOpen(s), M.MAX_STAR);
});

test('old single outfits become parts', () => {
  const s = fresh();
  s.metaVer = 0; s.costumes = ['classic', 'royal', 'night']; s.costume = 'royal';
  M.migrate(s);
  assert.ok(s.parts.body.includes('royal') && s.parts.hat.includes('crown') && s.parts.face.includes('glasses'));
  assert.strictEqual(s.look.body, 'royal'); assert.strictEqual(s.look.hat, 'crown');
});

test('parts are bought with coins, or with drops when they have a drop price', () => {
  const s = fresh();
  s.coins = 1000; s.drops = 30;
  assert.ok(M.buyPart(s, 'hat', 'beret', 'coins'));
  assert.strictEqual(s.coins, 400);
  assert.ok(!M.buyPart(s, 'body', 'rainbow', 'coins'));
  assert.ok(!M.buyPart(s, 'body', 'rainbow', 'drops'));
  assert.ok(M.buyPart(s, 'body', 'royal', 'drops'));
  assert.strictEqual(s.drops, 10);
  assert.ok(!M.buyPart(s, 'body', 'royal', 'drops'));
});

test('random challenge looks only use real parts', () => {
  const r = seq([0.1, 0.5, 0.99, 0.3, 0.7]);
  for (let i = 0; i < 40; i++) {
    const l = M.randomLook(r);
    for (const sl of ['body', 'hat', 'face']) assert.ok(M.PARTS[sl].some(p => p.id === l[sl]));
  }
});

test('colour variant odds: 1/2048, x4 per boost (lucky charm, full moon)', () => {
  assert.strictEqual(M.mods(null).shiny, 1 / 2048);
  assert.strictEqual(M.mods({ charms: { lucky: 1 } }).shiny, 1 / 512);
  assert.strictEqual(M.mods({ charms: { lucky: 2 } }).shiny, 1 / 512);
  assert.strictEqual(M.mods({ weather: 'moon' }).shiny, 1 / 512);
  assert.strictEqual(M.mods({ charms: { lucky: 1 }, weather: 'moon' }).shiny, 1 / 128);
});

test('coin prices sit in three clear tiers (≤1000, 2000-5000, ≥10000)', () => {
  for (const sl of M.SLOTS) for (const p of M.PARTS[sl]) {
    if (!p.price) continue;
    assert.ok(p.price <= 1000 || (p.price >= 2000 && p.price <= 5000) || p.price >= 10000, sl + ':' + p.id + ' ' + p.price);
  }
});
