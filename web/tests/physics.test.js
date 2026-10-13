// Run with: node --test web/tests
const test = require('node:test');
const assert = require('node:assert');
const { Web, Thread } = require('../js/physics.js');

function step(web, n, gy = 0.25) {
  for (let i = 0; i < n; i++) web.update(0, gy, 0.985, 8);
}

function makeWeb(ax, ay, bx, by, strength = 3) {
  const web = new Web();
  const a = web.addNode(ax, ay), b = web.addNode(bx, by);
  const t = web.spin(a, b, strength);
  return { web, a, b, t };
}

test('thread sags under gravity', () => {
  const { web, t } = makeWeb(0, 0, 200, 0);
  step(web, 200);
  const mid = t.points[Math.floor(t.points.length / 2)];
  assert.ok(mid.y > 5, `mid point should sag, got ${mid.y}`);
});

test('anchors stay pinned', () => {
  const { web, t } = makeWeb(10, 20, 210, 40);
  step(web, 120);
  const first = t.points[0], last = t.points[t.points.length - 1];
  assert.deepStrictEqual([first.x, first.y], [10, 20]);
  assert.deepStrictEqual([last.x, last.y], [210, 40]);
});

test('segment length is roughly maintained', () => {
  const { web, t } = makeWeb(0, 0, 300, 0);
  step(web, 200);
  for (let i = 0; i < t.points.length - 1; i++) {
    const a = t.points[i], b = t.points[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    assert.ok(Math.abs(d - t.segmentLength) / t.segmentLength < 0.1, `segment ${i} length ${d} vs ${t.segmentLength}`);
  }
});

test('closest point finds the middle of the thread', () => {
  const { t } = makeWeb(0, 0, 200, 0);
  const c = t.closest(100, 30);
  assert.ok(Math.abs(c.x - 100) < 1);
  assert.ok(Math.abs(c.distance - 30) < 1);
});

test('impact displaces the bracketing points', () => {
  const { web, t } = makeWeb(0, 0, 200, 0);
  const c = t.closest(100, 0);
  t.impact(c.segmentIndex, 0, 5);
  step(web, 1, 0);
  const p = t.points[c.segmentIndex + 1];
  assert.ok(p.y > 1, `point should have moved, got ${p.y}`);
});

test('split keeps both halves tied to a new knot', () => {
  const { web, t } = makeWeb(0, 0, 200, 0);
  const c = t.closest(100, 0);
  const node = web.split(t, c.segmentIndex, c.t);
  assert.strictEqual(web.threads.length, 2);
  assert.strictEqual(web.nodes.length, 3);
  assert.ok(web.threads.every(th => th.nodeA === node || th.nodeB === node));
  assert.ok(Math.abs(node.x - 100) < 1);
});

test('severing leaves anchored stubs and drops the old thread', () => {
  const { web, t } = makeWeb(0, 0, 200, 0);
  web.sever(t, Math.floor(t.points.length / 2));
  assert.ok(!web.threads.includes(t));
  assert.strictEqual(web.threads.length, 2);
  for (const s of web.threads) assert.ok(s.points.some(p => p.pinned));
});

test('severing a stub again drops the piece with no anchor', () => {
  const { web, t } = makeWeb(0, 0, 400, 0);
  web.sever(t, 2);
  const longStub = web.threads.reduce((a, b) => (a.points.length > b.points.length ? a : b));
  const before = web.threads.length;
  web.sever(longStub, 4);
  assert.ok(web.threads.length <= before, 'no anchorless piece should remain');
  for (const s of web.threads) assert.ok(s.points.some(p => p.pinned));
});

test('a load on a point pulls it further down', () => {
  const a = makeWeb(0, 0, 200, 0);
  const b = makeWeb(0, 0, 200, 0);
  const mid = Math.floor(b.t.points.length / 2);
  b.t.points[mid].load = 0.6;
  step(a.web, 150);
  step(b.web, 150);
  assert.ok(b.t.points[mid].y > a.t.points[mid].y + 2);
});

test('orphan nodes are pruned when their threads go away', () => {
  const { web, t } = makeWeb(0, 0, 200, 0);
  web.sever(t, 0);
  web.sever(web.threads[0], 0);
  assert.ok(web.nodes.length <= 1);
});

test('Thread can be built from raw points', () => {
  const { t } = makeWeb(0, 0, 100, 0);
  const copy = new Thread({ points: t.points.slice(), segmentLength: t.segmentLength, strength: 2 });
  assert.strictEqual(copy.points[0].owner, copy);
});
