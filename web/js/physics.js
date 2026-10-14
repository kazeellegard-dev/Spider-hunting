// Silk physics: Verlet-integrated threads stretched between pinned nodes.
// Port of ios/SpiderWebPhysics (T-02) extended with shared nodes, thread
// splitting and per-point loads so a real web can be woven out of strands.
// No DOM dependency: runs in the browser and under `node --test`.
(function (root) {
  'use strict';

  let nextId = 1;

  class VerletPoint {
    constructor(x, y, pinned) {
      this.x = x; this.y = y;
      this.px = x; this.py = y;
      this.pinned = !!pinned;
      this.load = 0;       // extra downward pull (caught insects)
      this.owner = null;   // thread that currently holds this point
    }
    integrate(gx, gy, damping) {
      if (this.pinned) return;
      const vx = (this.x - this.px) * damping;
      const vy = (this.y - this.py) * damping;
      this.px = this.x; this.py = this.y;
      this.x += vx + gx;
      this.y += vy + gy + this.load;
    }
    impulse(ix, iy) {
      if (this.pinned) return;
      this.px -= ix; this.py -= iy;
    }
  }

  // A node is a fixed knot in the web where strands meet.
  class Node {
    constructor(x, y) { this.id = nextId++; this.x = x; this.y = y; }
  }

  function closestOnSegment(ax, ay, bx, by, tx, ty) {
    const sx = bx - ax, sy = by - ay;
    const l2 = sx * sx + sy * sy;
    let t = 0;
    if (l2 > 0) t = Math.max(0, Math.min(1, ((tx - ax) * sx + (ty - ay) * sy) / l2));
    return { x: ax + sx * t, y: ay + sy * t, t };
  }

  class Thread {
    // Either built between two nodes, or from a raw point chain (stubs/splits).
    constructor(opts) {
      this.id = nextId++;
      this.strength = opts.strength;
      this.age = 0;
      this.broken = false;
      this.ties = 0;
      if (opts.points) {
        this.points = opts.points;
        this.segmentLength = opts.segmentLength;
      } else {
        const a = opts.from, b = opts.to;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const n = opts.segments || Math.max(4, Math.min(18, Math.round(len / 22)));
        const slack = opts.slack == null ? 0.03 : opts.slack;
        this.segmentLength = (len * (1 + slack)) / n;
        this.points = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          this.points.push(new VerletPoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, i === 0 || i === n));
        }
      }
      this.nodeA = opts.nodeA || null;
      this.nodeB = opts.nodeB || null;
      for (const p of this.points) p.owner = this;
    }

    get length() {
      let l = 0;
      for (let i = 0; i < this.points.length - 1; i++) {
        const a = this.points[i], b = this.points[i + 1];
        l += Math.hypot(b.x - a.x, b.y - a.y);
      }
      return l;
    }

    update(gx, gy, damping, iterations) {
      if (this.broken) return;
      this.age++;
      for (const p of this.points) p.integrate(gx, gy, damping);
      for (let k = 0; k < iterations; k++) this.satisfy();
    }

    satisfy() {
      const pts = this.points, rest = this.segmentLength;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d === 0) continue;
        const diff = (d - rest) / d * 0.5;
        const cx = dx * diff, cy = dy * diff;
        if (a.pinned && b.pinned) continue;
        if (a.pinned) { b.x -= cx * 2; b.y -= cy * 2; }
        else if (b.pinned) { a.x += cx * 2; a.y += cy * 2; }
        else { a.x += cx; a.y += cy; b.x -= cx; b.y -= cy; }
      }
    }

    closest(tx, ty) {
      let best = { distance: Infinity, segmentIndex: 0, x: this.points[0].x, y: this.points[0].y, t: 0 };
      for (let i = 0; i < this.points.length - 1; i++) {
        const a = this.points[i], b = this.points[i + 1];
        const c = closestOnSegment(a.x, a.y, b.x, b.y, tx, ty);
        const d = Math.hypot(c.x - tx, c.y - ty);
        if (d < best.distance) best = { distance: d, segmentIndex: i, x: c.x, y: c.y, t: c.t };
      }
      return best;
    }

    impact(segmentIndex, ix, iy) {
      if (segmentIndex < 0 || segmentIndex >= this.points.length - 1) return;
      this.points[segmentIndex].impulse(ix, iy);
      this.points[segmentIndex + 1].impulse(ix, iy);
    }
  }

  class Web {
    constructor() {
      this.nodes = [];
      this.threads = [];
    }

    addNode(x, y) {
      const n = new Node(x, y);
      this.nodes.push(n);
      return n;
    }

    nodeNear(x, y, radius) {
      let best = null, bd = radius;
      for (const n of this.nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d <= bd) { bd = d; best = n; }
      }
      return best;
    }

    threadNear(x, y, radius) {
      let best = null;
      for (const t of this.threads) {
        if (t.broken) continue;
        const c = t.closest(x, y);
        if (c.distance <= radius && (!best || c.distance < best.distance)) {
          best = { thread: t, segmentIndex: c.segmentIndex, x: c.x, y: c.y, distance: c.distance, t: c.t };
        }
      }
      return best;
    }

    spin(nodeA, nodeB, strength) {
      const t = new Thread({ from: nodeA, to: nodeB, nodeA, nodeB, strength });
      this.threads.push(t);
      return t;
    }

    // Spins a straight thread from a to b, but ties it into every live thread it crosses:
    // each crossing becomes a shared knot and the new thread is laid as a chain through them.
    // Threads on both sides of a knot count one more tie (they hold heavier bugs).
    // Crossings closer than `gap` to an end, a knot or each other are left alone.
    spinTied(a, b, strength, gap = 12, maxTies = 6) {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const knots = [];
      if (len > gap * 2) {
        const dx = b.x - a.x, dy = b.y - a.y;
        let u0 = gap / len;
        const u1 = 1 - gap / len;
        while (knots.length < maxTies) {
          let best = null;
          for (const th of this.threads) {
            if (th.broken) continue;
            const pts = th.points;
            for (let i = 0; i < pts.length - 1; i++) {
              const p = pts[i], q = pts[i + 1];
              const ex = q.x - p.x, ey = q.y - p.y;
              const den = dx * ey - dy * ex;
              if (Math.abs(den) < 1e-9) continue;
              const u = ((p.x - a.x) * ey - (p.y - a.y) * ex) / den;
              const w = ((p.x - a.x) * dy - (p.y - a.y) * dx) / den;
              if (u <= u0 || u >= u1 || w < 0 || w > 1 || (best && u >= best.u)) continue;
              best = { thread: th, i, w, u };
            }
          }
          if (!best) break;
          const x = a.x + dx * best.u, y = a.y + dy * best.u;
          u0 = best.u + gap / len;
          // crossing right at an existing knot: run through that knot instead of tying a new one
          const near = this.nodes.find(n => n !== a && n !== b && Math.hypot(n.x - x, n.y - y) < gap);
          if (near && knots.includes(near)) continue;
          const knot = near || this.split(best.thread, best.i, best.w);
          knot.tie = true;
          for (const t of this.threads) if (t.nodeA === knot || t.nodeB === knot) t.ties++;
          knots.push(knot);
        }
      }
      const chain = [a, ...knots, b], made = [];
      for (let i = 0; i < chain.length - 1; i++) {
        const t = this.spin(chain[i], chain[i + 1], strength);
        t.ties = knots.length ? 1 : 0;
        made.push(t);
      }
      // split() prunes knots no thread uses yet; the ends may be brand new
      for (const n of [a, b]) if (!this.nodes.includes(n)) this.nodes.push(n);
      return { threads: made, knots };
    }

    // Splits `thread` at segmentIndex/t by inserting a new pinned knot there.
    // Existing point objects survive so anything attached to them stays put.
    split(thread, segmentIndex, t) {
      const pts = thread.points;
      const a = pts[segmentIndex], b = pts[segmentIndex + 1];
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      const node = this.addNode(x, y);
      const knotA = new VerletPoint(x, y, true);
      const knotB = new VerletPoint(x, y, true);
      const before = pts.slice(0, segmentIndex + 1).concat([knotA]);
      const after = [knotB].concat(pts.slice(segmentIndex + 1));
      thread.broken = true;
      const made = [];
      if (before.length >= 2) made.push(new Thread({ points: before, segmentLength: thread.segmentLength, strength: thread.strength, nodeA: thread.nodeA, nodeB: node }));
      if (after.length >= 2) made.push(new Thread({ points: after, segmentLength: thread.segmentLength, strength: thread.strength, nodeA: node, nodeB: thread.nodeB }));
      for (const m of made) { m.age = thread.age; m.ties = thread.ties || 0; this.threads.push(m); }
      this.prune();
      return node;
    }

    // Tears a thread at segmentIndex. Pieces that still hang from a pinned
    // end stay as dangling stubs; pieces with no anchor are dropped.
    sever(thread, segmentIndex) {
      if (thread.broken) return [];
      thread.broken = true;
      const pts = thread.points;
      const i = Math.max(0, Math.min(pts.length - 2, segmentIndex));
      const tearA = new VerletPoint(pts[i].x, pts[i].y, false);
      const tearB = new VerletPoint(pts[i + 1].x, pts[i + 1].y, false);
      tearA.px = pts[i].px; tearA.py = pts[i].py;
      tearB.px = pts[i + 1].px; tearB.py = pts[i + 1].py;
      const before = pts.slice(0, i).concat([tearA]);
      const after = [tearB].concat(pts.slice(i + 2));
      const stubs = [];
      for (const chain of [before, after]) {
        if (chain.length >= 3 && chain.some(p => p.pinned)) {
          const s = new Thread({ points: chain, segmentLength: thread.segmentLength, strength: thread.strength, nodeA: chain[0].pinned ? thread.nodeA : null, nodeB: chain[chain.length - 1].pinned ? thread.nodeB : null });
          s.stub = true;
          s.age = thread.age;
          s.ties = thread.ties || 0;
          stubs.push(s);
          this.threads.push(s);
        }
      }
      for (const p of pts) if (p.owner === thread) p.owner = null;
      for (const s of stubs) for (const p of s.points) p.owner = s;
      this.prune();
      return stubs;
    }

    prune() {
      this.threads = this.threads.filter(t => !t.broken);
      // Drop knots no live thread is tied to anymore.
      const used = new Set();
      for (const t of this.threads) { if (t.nodeA) used.add(t.nodeA); if (t.nodeB) used.add(t.nodeB); }
      this.nodes = this.nodes.filter(n => used.has(n) || n.keep);
    }

    update(gx, gy, damping, iterations) {
      for (const t of this.threads) t.update(gx, gy, damping, iterations);
    }

    get totalLength() {
      let l = 0;
      for (const t of this.threads) l += t.length;
      return l;
    }
  }

  const api = { VerletPoint, Node, Thread, Web, closestOnSegment };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SH = root.SH || {};
  root.SH.physics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
