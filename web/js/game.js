// Core game: web building, insects, catching, combos, bonus time, areas.
(function (root) {
  'use strict';
  const { Web } = root.SH.physics;
  const D = root.SH.data;
  const R = root.SH.render;
  const audio = root.SH.audio;
  const platform = root.SH.platform;
  const t = k => root.SH.i18n.t(k);
  const B = D.BALANCE;

  const STEP = 1 / 60;
  const GRAVITY = 0.2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function pickWeighted(table) {
    let sum = 0;
    for (const k in table) sum += table[k];
    let r = Math.random() * sum;
    for (const k in table) { r -= table[k]; if (r <= 0) return k; }
    return Object.keys(table)[0];
  }

  let insectId = 1;

  class Game {
    constructor(hooks) {
      this.hooks = hooks;
      this.W = 390; this.H = 844; this.dpr = 1;
      this.time = 0;
      this.mode = 'demo';
      this.paused = false;
      this.bg = null; this.bgPrev = null; this.bgFade = 0;
      this.particles = [];
      this.texts = [];
      this.acc = 0;
      this.shake = 0;
      this.resetWorld();
    }

    // ---------- setup ----------
    resize(W, H, dpr) {
      const oldW = this.W, oldH = this.H;
      this.W = W; this.H = H; this.dpr = dpr;
      if (oldW !== W || oldH !== H) {
        const sx = W / oldW, sy = H / oldH;
        // keep the web roughly where it was when the viewport changes
        for (const n of this.web.nodes) { n.x *= sx; n.y *= sy; }
        for (const th of this.web.threads) for (const p of th.points) { p.x *= sx; p.y *= sy; p.px *= sx; p.py *= sy; }
        this.spider.x *= sx; this.spider.y *= sy;
      }
      this.bg = R.makeBackground(D.AREAS[this.areaIdx], W, H, dpr);
      this.bgPrev = null;
    }

    stats() {
      const s = root.SH.save.data, u = s.upgrades;
      return {
        strength: B.baseStrength + u.strength * B.strengthPerUpgrade + (s.level - 1) * B.strengthPerLevel,
        maxSilk: B.baseMaxSilk + u.silk * B.silkPerUpgrade + (s.level - 1) * B.silkPerLevel,
        struggle: B.baseStruggle + u.sticky * B.strugglePerUpgrade,
        speed: B.baseSpeed * (1 + u.speed * B.speedPerUpgrade),
        appetite: 1 + u.appetite * B.appetitePerUpgrade,
      };
    }

    resetWorld() {
      this.web = new Web();
      this.insects = [];
      this.treats = [];
      this.areaIdx = 0;
      this.spider = { x: this.W / 2, y: this.H * 0.4, node: null, action: 'idle', moving: false, lookX: 0, lookY: 0, hurt: 0, happy: 0, sad: false, scale: 1 };
      this.queuedTap = null;
    }

    buildStarterWeb(cx, cy, spokes, radius, rings) {
      const hub = this.web.addNode(cx, cy);
      const strength = this.mode === 'demo' ? 99 : this.st.strength;
      const ringNodes = [];
      for (let r = 0; r < rings.length; r++) ringNodes.push([]);
      const ends = [];
      for (let i = 0; i < spokes; i++) {
        const a = -Math.PI / 2 + i / spokes * Math.PI * 2 + 0.2;
        let prev = hub;
        rings.forEach((rr, r) => {
          const n = this.web.addNode(cx + Math.cos(a) * radius * rr, cy + Math.sin(a) * radius * rr);
          this.web.spin(prev, n, strength);
          ringNodes[r].push(n); prev = n;
        });
        const end = this.web.addNode(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
        this.web.spin(prev, end, strength);
        ends.push(end);
      }
      for (const ring of ringNodes) for (let i = 0; i < ring.length; i++) this.web.spin(ring[i], ring[(i + 1) % ring.length], strength);
      return hub;
    }

    startDemo() {
      this.mode = 'demo';
      this.st = this.stats();
      this.resetWorld();
      this.areaIdx = Math.min(root.SH.save.data.bestArea || 0, D.AREAS.length - 1);
      const hub = this.buildStarterWeb(this.W / 2, this.H * 0.5, 9, Math.min(this.W * 0.42, 170), [0.25, 0.5, 0.75]);
      this.spider.node = hub; this.spider.x = hub.x; this.spider.y = hub.y; this.spider.home = hub;
      this.spawnTimer = 0.5;
      this.bg = R.makeBackground(D.AREAS[this.areaIdx], this.W, this.H, this.dpr);
      this.bgPrev = null;
      this.particles = []; this.texts = [];
      this.paused = false;
    }

    startRun() {
      this.mode = 'play';
      this.st = this.stats();
      this.resetWorld();
      const save = root.SH.save.data;
      const run = this.run = {
        score: 0, silk: this.st.maxSilk, time: 0, combo: 0, lastEat: -99, maxCombo: 0, catches: 0,
        bonusGauge: 0, bonusTimer: 0, coins: 0, caught: {}, continued: false, over: false, dying: 0,
        windTimer: rand(22, 34), wind: 0, windLeft: 0, maxArea: 0,
        tutorial: save.tutorialDone ? 0 : 1, tutorialTimer: 0, heavyHinted: !!save.tutorialDone && save.plays > 3,
      };
      const hub = this.buildStarterWeb(this.W / 2, this.H * 0.42, 6, Math.min(this.W * 0.2, 80), [0.55]);
      this.spider.node = hub; this.spider.x = hub.x; this.spider.y = hub.y;
      this.spawnTimer = run.tutorial ? 3 : 1.2;
      this.bg = R.makeBackground(D.AREAS[0], this.W, this.H, this.dpr);
      this.bgPrev = null;
      this.particles = []; this.texts = [];
      this.paused = false;
      audio.music('day');
      this.hooks.banner(t('areaEnter') + ' 1', t('areaNames')[0]);
      if (run.tutorial) this.hooks.tutorial(t('tut1'));
    }

    continueRun() {
      const run = this.run;
      run.continued = true; run.over = false; run.dying = 0;
      run.silk = this.st.maxSilk * 0.5;
      this.spider.sad = false;
      this.paused = false;
      audio.music(this.musicMode());
    }

    musicMode() {
      if (this.run && this.run.bonusTimer > 0) return 'bonus';
      const a = D.AREAS[this.areaIdx];
      return a.night ? 'night' : a.id === 'sunset' ? 'eve' : 'day';
    }

    // ---------- input ----------
    tap(x, y) {
      if (this.paused) return;
      if (this.mode !== 'play' || this.run.over || this.run.dying) return;
      const sp = this.spider;
      if (sp.action !== 'idle') { this.queuedTap = { x, y }; return; }
      this.handleTap(x, y);
    }

    handleTap(x, y) {
      const sp = this.spider;
      // 1) a stuck bug near the tap? rush and wrap it
      let best = null, bd = B.tapInsectRadius;
      for (const ins of this.insects) {
        if (ins.state !== 'caught' || ins.targeted) continue;
        const d = Math.hypot(ins.x - x, ins.y - y);
        if (d < bd) { bd = d; best = ins; }
      }
      if (best) {
        best.targeted = true;
        sp.action = 'rush'; sp.target = best; sp.node = null;
        audio.play('rush');
        return;
      }
      // 2) otherwise spin a thread to the tapped point
      x = clamp(x, 10, this.W - 10);
      y = clamp(y, this.H * 0.07, this.H - 24);
      let tx = x, ty = y;
      const startNode = this.nodeAtSpider();
      const n = this.web.nodeNear(x, y, B.snapNode);
      if (n && n !== startNode) { tx = n.x; ty = n.y; }
      else {
        const th = this.web.threadNear(x, y, B.snapThread);
        if (th) { tx = th.x; ty = th.y; }
      }
      const len = Math.hypot(tx - sp.x, ty - sp.y);
      if (len < 14) return;
      const cost = len * B.silkCostPerPx;
      if (cost >= this.run.silk) {
        audio.play('deny');
        this.floatText(sp.x, sp.y - 30, t('noSilk'), '#ff5a5a', 15);
        this.shake = Math.max(this.shake, 3);
        return;
      }
      this.run.silk -= cost;
      sp.action = 'spin';
      sp.from = startNode;
      sp.tx = tx; sp.ty = ty; sp.tapX = x; sp.tapY = y;
      sp.node = null;
      audio.play('spin');
    }

    nodeAtSpider() {
      const sp = this.spider;
      if (sp.node) {
        if (!this.web.nodes.includes(sp.node)) this.web.nodes.push(sp.node);
        return sp.node;
      }
      sp.node = this.nodeAt(sp.x, sp.y, null);
      return sp.node;
    }

    nodeAt(x, y, exclude) {
      const n = this.web.nodeNear(x, y, B.snapNode * 0.6);
      if (n && n !== exclude) return n;
      const th = this.web.threadNear(x, y, B.snapThread);
      if (th) return this.web.split(th.thread, th.segmentIndex, th.t);
      return this.web.addNode(x, y);
    }

    // ---------- update ----------
    update(dt) {
      if (this.paused) return;
      dt = Math.min(dt, 0.05);
      this.time += dt;
      if (this.bgPrev) { this.bgFade -= dt / 1.5; if (this.bgFade <= 0) this.bgPrev = null; }
      this.shake = Math.max(0, this.shake - dt * 20);

      const run = this.mode === 'play' ? this.run : null;
      if (run) this.updateRun(dt);
      else this.updateDemo(dt);

      // physics at a fixed rate so low-power 30fps still feels the same
      this.acc += dt;
      let wind = run ? run.wind : 0;
      while (this.acc >= STEP) {
        this.web.update(wind * 0.05, GRAVITY, 0.985, 8);
        this.acc -= STEP;
      }
      this.updateSpider(dt);
      this.updateInsects(dt);
      this.updateTreats(dt);
      this.updateFx(dt);
    }

    updateDemo(dt) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.insects.length < 6) {
        this.spawnTimer = rand(0.9, 1.6);
        this.spawnInsect(pickWeighted(D.AREAS[this.areaIdx].table));
      }
      const sp = this.spider;
      if (sp.action === 'idle') {
        const stuck = this.insects.find(i => i.state === 'caught' && !i.targeted && i.struggle < i.struggleMax - 0.6);
        if (stuck) { stuck.targeted = true; sp.action = 'rush'; sp.target = stuck; sp.node = null; }
        else if (sp.home && Math.hypot(sp.x - sp.home.x, sp.y - sp.home.y) > 4 && !sp.returnWait) {
          sp.returnWait = 0.8;
        }
      }
      if (sp.returnWait) {
        sp.returnWait -= dt;
        if (sp.returnWait <= 0) { sp.returnWait = 0; sp.action = 'walk'; sp.tx = sp.home.x; sp.ty = sp.home.y; }
      }
    }

    updateRun(dt) {
      const run = this.run;
      const sp = this.spider;
      if (run.over) return;
      if (run.dying) {
        run.dying -= dt;
        sp.y += dt * 40;
        if (run.dying <= 0) { run.dying = 0; run.over = true; this.hooks.gameOver(!run.continued); }
        return;
      }
      run.time += dt;
      const inBonus = run.bonusTimer > 0;
      // silk drains over time (the run's clock)
      const tutorialFree = run.tutorial && run.tutorial < 4;
      if (!inBonus && !tutorialFree) {
        const drain = Math.min(B.drainMax, B.drainBase + run.time * B.drainRamp);
        run.silk -= drain * dt;
      }
      if (run.silk <= 0) {
        run.silk = 0;
        run.dying = 1.3;
        sp.sad = true;
        audio.play('gameover');
        audio.stopMusic();
        platform.haptic('heavy');
        return;
      }
      // spawning
      this.spawnTimer -= dt;
      if (!inBonus && this.spawnTimer <= 0) {
        const area = D.AREAS[this.areaIdx];
        const ramp = 1 - Math.min(0.3, run.time / 300);
        let interval = area.spawn * ramp;
        if (run.tutorial && run.tutorial < 3) interval = 99;
        else if (run.tutorial === 3) interval = 2.2;
        this.spawnTimer = interval * rand(0.75, 1.25);
        let type = pickWeighted(area.table);
        if (run.tutorial === 3) type = Math.random() < 0.5 ? 'butterfly' : 'fly';
        else if (Math.random() < D.GOLDEN_CHANCE) type = 'golden';
        this.spawnInsect(type, run.tutorial === 3);
        // swarm: sometimes gnats come in a group
        if (type === 'gnat' && Math.random() < 0.4) { this.spawnInsect('gnat'); this.spawnInsect('gnat'); }
      }
      // combo timeout
      if (run.combo > 0 && run.time - run.lastEat > B.comboWindow) run.combo = 0;
      // bonus
      if (inBonus) {
        run.bonusTimer -= dt;
        this.treatTimer -= dt;
        if (this.treatTimer <= 0) { this.treatTimer = rand(0.22, 0.38); this.spawnTreat(); }
        if (run.bonusTimer <= 0) { run.bonusTimer = 0; run.bonusGauge = 0; audio.music(this.musicMode()); this.spawnTimer = 0.6; }
      } else if (run.bonusGauge >= B.bonusNeed) {
        run.bonusTimer = B.bonusDuration; this.treatTimer = 0.3;
        audio.play('bonus'); audio.music('bonus');
        this.hooks.banner(t('bonusTime'), t('bonusSub'), 'bonus');
        platform.haptic('medium');
      }
      // wind
      if (this.areaIdx >= 1 && !inBonus) {
        if (run.windLeft > 0) {
          run.windLeft -= dt;
          const k = Math.sin(Math.PI * (1 - run.windLeft / 4.5));
          run.wind = run.windDir * k * (1 + this.areaIdx * 0.15);
          if (run.windLeft <= 0) { run.wind = 0; run.windTimer = rand(20, 35); }
        } else {
          run.windTimer -= dt;
          if (run.windTimer <= 0) {
            run.windLeft = 4.5; run.windDir = Math.random() < 0.5 ? -1 : 1;
            audio.play('wind');
            this.hooks.banner(t('wind'), run.windDir > 0 ? '→ → →' : '← ← ←', 'wind');
          }
        }
      } else run.wind = 0;
      // area milestones
      const next = D.AREAS[this.areaIdx + 1];
      if (next && run.score >= next.score) this.enterArea(this.areaIdx + 1);
      // tutorial step 4 times out
      if (run.tutorial === 4) {
        run.tutorialTimer -= dt;
        if (run.tutorialTimer <= 0) this.endTutorial();
      }
      // thread cap: drop oldest dangling stubs first, then oldest threads
      if (this.web.threads.length > B.maxThreads) {
        const victim = this.web.threads.find(th => th.stub) || this.web.threads[0];
        victim.broken = true; this.web.prune();
      }
      if (sp.hurt > 0) sp.hurt -= dt;
      if (sp.happy > 0) sp.happy -= dt;
    }

    endTutorial() {
      const run = this.run;
      run.tutorial = 0;
      root.SH.save.data.tutorialDone = true; root.SH.save.write();
      this.hooks.tutorial(null);
    }

    enterArea(idx) {
      this.areaIdx = idx;
      if (this.run) this.run.maxArea = Math.max(this.run.maxArea, idx);
      this.bgPrev = this.bg; this.bgFade = 1;
      this.bg = R.makeBackground(D.AREAS[idx], this.W, this.H, this.dpr);
      audio.play('area');
      if (!this.run || this.run.bonusTimer <= 0) audio.music(this.musicMode());
      this.hooks.banner(t('areaEnter') + ' ' + (idx + 1), t('areaNames')[idx], 'area');
      platform.haptic('medium');
    }

    // ---------- spider ----------
    updateSpider(dt) {
      const sp = this.spider;
      const speed = this.st.speed;
      sp.moving = sp.action === 'spin' || sp.action === 'rush' || sp.action === 'walk';
      if (sp.action === 'spin' || sp.action === 'walk') {
        const dx = sp.tx - sp.x, dy = sp.ty - sp.y, d = Math.hypot(dx, dy);
        const v = speed * dt;
        sp.lookX = dx / (d || 1); sp.lookY = dy / (d || 1);
        if (d <= v) {
          sp.x = sp.tx; sp.y = sp.ty;
          if (sp.action === 'spin') this.finishSpin();
          else { sp.action = 'idle'; sp.node = sp.home || this.nodeAt(sp.x, sp.y, null); }
        } else { sp.x += dx / d * v; sp.y += dy / d * v; }
      } else if (sp.action === 'rush') {
        const ins = sp.target;
        if (!ins || ins.state !== 'caught') { sp.action = 'idle'; sp.target = null; this.afterAction(); return; }
        const dx = ins.x - sp.x, dy = ins.y - sp.y, d = Math.hypot(dx, dy);
        const v = speed * 1.35 * dt;
        sp.lookX = dx / (d || 1); sp.lookY = dy / (d || 1);
        if (d <= v + 4) {
          sp.x = ins.x; sp.y = ins.y;
          this.beginWrap(ins);
        } else { sp.x += dx / d * v; sp.y += dy / d * v; }
      } else if (sp.action === 'wrap') {
        sp.wrapT += dt;
        const ins = sp.target;
        if (ins) { sp.x = ins.x; sp.y = ins.y; }
        if (sp.wrapT >= 0.3) {
          sp.action = 'idle'; sp.target = null;
          sp.node = this.nodeAt(sp.x, sp.y, null);
          sp.x = sp.node.x; sp.y = sp.node.y;
          this.afterAction();
        }
      } else {
        sp.lookX *= 0.95; sp.lookY *= 0.95;
      }
    }

    afterAction() {
      if (this.queuedTap && this.mode === 'play') {
        const q = this.queuedTap; this.queuedTap = null;
        this.handleTap(q.x, q.y);
      }
    }

    finishSpin() {
      const sp = this.spider;
      let from = sp.from;
      if (!this.web.nodes.includes(from)) this.web.nodes.push(from);
      const to = this.nodeAt(sp.x, sp.y, from);
      sp.x = to.x; sp.y = to.y;
      if (to !== from && Math.hypot(to.x - from.x, to.y - from.y) > 6) {
        this.web.spin(from, to, this.st.strength);
      }
      sp.node = to; sp.action = 'idle';
      audio.play('land');
      platform.haptic('light');
      this.puff(to.x, to.y, 'rgba(255,255,255,0.9)', 6);
      const run = this.run;
      if (run && run.tutorial === 1) { run.tutorial = 2; this.hooks.tutorial(t('tut2')); }
      else if (run && run.tutorial === 2) { run.tutorial = 3; this.hooks.tutorial(t('tut3')); this.spawnTimer = 0.8; }
      this.afterAction();
    }

    beginWrap(ins) {
      const sp = this.spider;
      sp.action = 'wrap'; sp.wrapT = 0;
      ins.state = 'wrapped'; ins.wrapT = 0;
      if (ins.point) { ins.point.load = Math.max(0, ins.point.load - ins.load); }
      audio.play('wrap');
    }

    // ---------- insects ----------
    spawnInsect(type, aimAtWeb) {
      const def = D.INSECTS[type];
      const fromLeft = Math.random() < 0.5;
      const W = this.W, H = this.H;
      let y = rand(H * 0.16, H * 0.84);
      if (aimAtWeb && this.web.threads.length) {
        const th = this.web.threads[Math.floor(Math.random() * this.web.threads.length)];
        const p = th.points[Math.floor(th.points.length / 2)];
        y = p.y;
      }
      const areaBoost = 1 + this.areaIdx * 0.06 + (this.run ? Math.min(0.25, this.run.time / 400) : 0);
      const speed = def.speed * rand(0.85, 1.15) * areaBoost;
      this.insects.push({
        id: insectId++, type, def, state: 'fly',
        x: fromLeft ? -30 : W + 30, y, baseY: y,
        vx: fromLeft ? speed : -speed, vy: 0, speed,
        drift: rand(-14, 14), seed: Math.random() * 10, age: 0,
        pass: 0, phase: 0, dartT: 0,
      });
    }

    updateInsects(dt) {
      const run = this.mode === 'play' ? this.run : null;
      const strength = this.mode === 'demo' ? 99 : this.st.strength;
      for (const ins of this.insects) {
        ins.age += dt;
        if (ins.state === 'fly' || ins.state === 'escape') this.flyInsect(ins, dt, run);
        if (ins.state === 'fly' && ins.pass <= 0 && ins.x > -10 && ins.x < this.W + 10) {
          const hit = this.web.threadNear(ins.x, ins.y, ins.def.size * 0.55 + 2);
          if (hit) this.hitThread(ins, hit, strength);
        }
        if (ins.state === 'caught') this.struggleInsect(ins, dt, run);
        if (ins.state === 'wrapped') {
          ins.wrapT += dt;
          if (ins.point && ins.point.owner) { ins.x = ins.point.x; ins.y = ins.point.y; }
          if (ins.wrapT >= 0.5) this.eat(ins);
        }
      }
      this.insects = this.insects.filter(i => !i.dead);
    }

    flyInsect(ins, dt, run) {
      const def = ins.def;
      if (ins.pass > 0) ins.pass -= dt;
      const wind = run ? run.wind * 45 : 0;
      ins.phase += dt;
      let vx = ins.vx, y = ins.baseY;
      switch (def.pattern) {
        case 'wobble': y += Math.sin(ins.phase * 3 + ins.seed) * 16; break;
        case 'jitter': ins.vy += rand(-600, 600) * dt; ins.vy *= 0.92; ins.baseY += ins.vy * dt; break;
        case 'zigzag': { const p = (ins.phase * 1.4 + ins.seed) % 2; y += (p < 1 ? p : 2 - p) * 50 - 25; break; }
        case 'flutter': y += Math.sin(ins.phase * 2 + ins.seed) * 32 + Math.sin(ins.phase * 7) * 6; vx *= 0.7 + 0.5 * Math.abs(Math.sin(ins.phase * 2.5)); break;
        case 'dart': {
          ins.dartT -= dt;
          if (ins.dartT <= 0) { ins.dartT = rand(0.35, 0.8); ins.darting = !ins.darting; if (ins.darting) ins.drift = rand(-80, 80); }
          vx *= ins.darting ? 1.5 : 0.15;
          ins.baseY += (ins.darting ? ins.drift : 0) * dt;
          y = ins.baseY + Math.sin(ins.phase * 20) * 1.5;
          break;
        }
        default: y += Math.sin(ins.phase * 1.5 + ins.seed) * 5;
      }
      if (ins.state === 'escape') { ins.vy -= 60 * dt; ins.baseY += ins.vy * dt; }
      ins.baseY += ins.drift * dt * (def.pattern === 'dart' ? 0 : 0.5);
      ins.baseY = clamp(ins.baseY, this.H * 0.06, this.H * 0.95);
      ins.x += (vx + wind) * dt;
      ins.y = def.pattern === 'jitter' ? ins.baseY : y;
      if (ins.x < -60 || ins.x > this.W + 60 || ins.y < -60) ins.dead = true;
      if (ins.state === 'escape' && ins.pass <= 0) ins.state = 'fly';
    }

    hitThread(ins, hit, strength) {
      const def = ins.def;
      const th = hit.thread;
      if (def.weight > strength) {
        this.web.sever(th, hit.segmentIndex);
        ins.pass = 0.12; ins.vx *= 0.85;
        audio.play('snap');
        platform.haptic('medium');
        this.floatText(hit.x, hit.y - 14, t('snap'), '#ffffff', 15);
        this.puff(hit.x, hit.y, 'rgba(255,255,255,0.9)', 8);
        this.shake = Math.max(this.shake, 4);
        const run = this.run;
        if (run && !run.heavyHinted && this.mode === 'play') { run.heavyHinted = true; this.hooks.hint(t('tutHeavy')); }
        return;
      }
      const i = hit.segmentIndex;
      const a = th.points[i], b = th.points[i + 1];
      let p = hit.t < 0.5 ? a : b;
      if (p.pinned) p = p === a ? b : a;
      ins.state = 'caught';
      ins.point = p;
      ins.load = 0.05 + def.weight * 0.08;
      p.load += ins.load;
      const k = 0.04 * (1 + def.weight * 0.4);
      th.impact(i, ins.vx * k * 0.02, Math.abs(ins.vx) * k * 0.02 + 2);
      ins.struggleMax = ins.struggle = (this.mode === 'demo' ? 3 : this.st.struggle) * def.struggle;
      audio.play('stick', def.weight);
      platform.haptic('light');
      this.puff(ins.x, ins.y, 'rgba(255,255,255,0.8)', 5);
    }

    struggleInsect(ins, dt, run) {
      const p = ins.point;
      if (!p || !p.owner || p.owner.broken) { this.release(ins, false); return; }
      ins.x = p.x; ins.y = p.y;
      if (Math.random() < dt * 8) p.impulse(rand(-1.2, 1.2) * ins.def.weight * 0.5, rand(-1, 1) * ins.def.weight * 0.5);
      const frozen = ins.targeted || (run && run.tutorial === 3);
      if (!frozen) ins.struggle -= dt;
      if (ins.struggle <= 0) this.release(ins, true);
    }

    // the bug breaks free; `tear` = it rips its strand on the way out
    release(ins, tear) {
      const p = ins.point;
      if (p) p.load = Math.max(0, p.load - ins.load);
      if (tear && p && p.owner && !p.owner.broken) {
        const th = p.owner, idx = th.points.indexOf(p);
        this.web.sever(th, Math.min(Math.max(idx, 0), th.points.length - 2));
      }
      ins.state = 'escape'; ins.point = null; ins.pass = 0.8; ins.vy = -40;
      ins.baseY = ins.y; ins.phase = 0;
      if (this.mode !== 'play') return;
      const run = this.run;
      audio.play('escape');
      this.floatText(ins.x, ins.y - 20, t('escaped'), '#ffffff', 13);
      run.combo = 0;
      if (ins.def.sting) {
        run.silk = Math.max(0.5, run.silk - ins.def.sting);
        this.spider.hurt = 0.5;
        audio.play('sting');
        platform.haptic('heavy');
        this.floatText(this.spider.x, this.spider.y - 30, t('sting') + ' -' + ins.def.sting, '#ff5a5a', 16);
        this.shake = 6;
      }
    }

    eat(ins) {
      ins.dead = true;
      const def = ins.def;
      this.burst(ins.x, ins.y, def.color);
      if (this.mode !== 'play') { audio.play('pop', 0); return; }
      const run = this.run;
      run.combo = run.time - run.lastEat <= B.comboWindow ? run.combo + 1 : 1;
      run.lastEat = run.time;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      const mult = Math.min(3, 1 + (run.combo - 1) * 0.1);
      const pts = Math.round(def.score * mult);
      run.score += pts;
      run.catches++;
      run.caught[ins.type] = (run.caught[ins.type] || 0) + 1;
      run.silk = Math.min(this.st.maxSilk, run.silk + def.silk * this.st.appetite);
      if (run.bonusTimer <= 0) run.bonusGauge = Math.min(B.bonusNeed, run.bonusGauge + 1 + (run.combo >= 5 ? 0.5 : 0));
      if (def.coins) { run.coins += def.coins; audio.play('coin'); this.floatText(ins.x, ins.y - 44, '+' + def.coins + ' ' + t('coins'), '#ffd23f', 15); }
      audio.play('pop', run.combo);
      platform.haptic('light');
      this.floatText(ins.x, ins.y - 18, '+' + pts, run.combo >= 3 ? '#ffe066' : '#ffffff', 18 + Math.min(run.combo, 10));
      if (run.combo >= 2) this.floatText(ins.x, ins.y - 40, run.combo + ' ' + t('combo') + '!', '#ff8fb8', 14);
      this.spider.happy = 0.6;
      if (run.tutorial === 3) { run.tutorial = 4; run.tutorialTimer = 4.5; this.hooks.tutorial(t('tut4')); }
    }

    // ---------- bonus treats ----------
    spawnTreat() {
      const def = D.TREATS[Math.floor(Math.random() * D.TREATS.length)];
      const fromTop = Math.random() < 0.55;
      const W = this.W, H = this.H;
      const tr = { def, rot: 0, vr: rand(-3, 3), dead: false };
      if (fromTop) { tr.x = rand(30, W - 30); tr.y = -20; tr.vx = rand(-30, 30); tr.vy = rand(80, 160); }
      else { const left = Math.random() < 0.5; tr.x = left ? -20 : W + 20; tr.y = rand(H * 0.2, H * 0.6); tr.vx = (left ? 1 : -1) * rand(120, 200); tr.vy = rand(-160, -60); }
      this.treats.push(tr);
    }

    updateTreats(dt) {
      for (const tr of this.treats) {
        tr.vy += 120 * dt;
        tr.x += tr.vx * dt; tr.y += tr.vy * dt; tr.rot += tr.vr * dt;
        if (tr.y > this.H + 40 || tr.x < -60 || tr.x > this.W + 60) { tr.dead = true; continue; }
        const hit = this.web.threadNear(tr.x, tr.y, 14);
        if (hit) {
          tr.dead = true;
          hit.thread.impact(hit.segmentIndex, 0, 2);
          const run = this.run;
          const mult = Math.min(3, 1 + Math.max(0, run.combo - 1) * 0.1);
          const pts = Math.round(tr.def.score * mult);
          run.score += pts; run.coins += tr.def.coins;
          audio.play('treat');
          this.burst(tr.x, tr.y, tr.def.color);
          this.floatText(tr.x, tr.y - 16, '+' + pts, '#fff6c2', 16);
        }
      }
      this.treats = this.treats.filter(tr => !tr.dead);
    }

    // ---------- fx ----------
    puff(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = rand(20, 70);
        this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4, max: 0.4, color, size: rand(1.5, 3), kind: 'dot' });
      }
    }
    burst(x, y, color) {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, v = rand(60, 170);
        this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.7, max: 0.7, color: i % 2 ? '#ffffff' : color, size: rand(3, 6), kind: i % 3 === 0 ? 'star' : 'dot' });
      }
      this.particles.push({ x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, color: '#ffffff', size: 8, kind: 'ring' });
    }
    floatText(x, y, text, color, size) {
      this.texts.push({ x, y, text, color, size: size || 16, life: 1.0, max: 1.0 });
    }
    updateFx(dt) {
      for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; p.vx *= 0.97; }
      this.particles = this.particles.filter(p => p.life > 0);
      for (const tx of this.texts) { tx.life -= dt; tx.y -= 34 * dt; }
      this.texts = this.texts.filter(tx => tx.life > 0);
    }

    // ---------- draw ----------
    draw(g) {
      const W = this.W, H = this.H;
      const scale = g.canvas.width / W;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      if (this.bg) g.drawImage(this.bg, 0, 0, W, H);
      if (this.bgPrev && this.bgFade > 0) { g.globalAlpha = this.bgFade; g.drawImage(this.bgPrev, 0, 0, W, H); g.globalAlpha = 1; }
      const area = D.AREAS[this.areaIdx];
      const run = this.mode === 'play' ? this.run : null;
      if (run && run.bonusTimer > 0) {
        const a = 0.18 + 0.06 * Math.sin(this.time * 6);
        const grd = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * 0.7);
        grd.addColorStop(0, `rgba(255,240,200,${a})`); grd.addColorStop(1, `rgba(255,150,200,${a + 0.1})`);
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
      }
      if (this.shake > 0) g.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
      if (area.night) this.drawAmbientFireflies(g);
      if (run && run.wind) this.drawWind(g, run.wind);

      R.drawThreads(g, this.web.threads, area.night);
      const sp = this.spider;
      if (sp.action === 'spin' && sp.from) {
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(sp.from.x, sp.from.y); g.lineTo(sp.x, sp.y); g.stroke();
      }
      R.drawNodes(g, this.web.nodes, this.time);
      for (const tr of this.treats) R.drawTreat(g, tr, this.time);
      for (const ins of this.insects) R.drawInsect(g, ins, this.time);
      const costume = D.COSTUMES.find(c => c.id === root.SH.save.data.costume) || D.COSTUMES[0];
      R.drawSpider(g, sp, this.time, costume);
      if (sp.action === 'spin') this.drawTapMark(g, sp.tapX, sp.tapY);

      for (const p of this.particles) {
        const a = p.life / p.max;
        g.globalAlpha = a; g.fillStyle = p.color; g.strokeStyle = p.color;
        if (p.kind === 'star') R.star(g, p.x, p.y, p.size);
        else if (p.kind === 'ring') { g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, p.size + (1 - a) * 30, 0, R.TAU); g.stroke(); }
        else { g.beginPath(); g.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, R.TAU); g.fill(); }
      }
      g.globalAlpha = 1;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const tx of this.texts) {
        const a = Math.min(1, tx.life / tx.max * 2);
        g.globalAlpha = a;
        g.font = `900 ${tx.size}px ${FONT}`;
        g.lineWidth = 4; g.strokeStyle = 'rgba(40,30,60,0.75)'; g.strokeText(tx.text, tx.x, tx.y);
        g.fillStyle = tx.color; g.fillText(tx.text, tx.x, tx.y);
      }
      g.globalAlpha = 1;
    }

    drawTapMark(g, x, y) {
      const k = (this.time * 3) % 1;
      g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 6 + k * 14, 0, R.TAU); g.stroke();
    }

    drawAmbientFireflies(g) {
      for (let i = 0; i < 10; i++) {
        const x = (Math.sin(this.time * 0.2 + i * 7.1) * 0.5 + 0.5) * this.W;
        const y = (Math.sin(this.time * 0.13 + i * 3.7) * 0.4 + 0.55) * this.H;
        const a = 0.3 + 0.3 * Math.sin(this.time * 3 + i);
        g.fillStyle = `rgba(240,255,150,${a})`;
        g.beginPath(); g.arc(x, y, 2, 0, R.TAU); g.fill();
      }
    }

    drawWind(g, wind) {
      g.strokeStyle = `rgba(255,255,255,${Math.min(0.5, Math.abs(wind) * 0.4)})`; g.lineWidth = 2; g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const y = (i * 97 + 40) % this.H;
        const span = this.W + 200;
        const x = ((this.time * 400 * Math.sign(wind) + i * 173) % span + span) % span - 100;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.sign(wind) * 60, y); g.stroke();
      }
    }

    // ---------- results ----------
    finishRun() {
      const run = this.run;
      const save = root.SH.save.data;
      const before = { level: save.level, exp: save.exp };
      const coins = Math.floor(run.score * B.coinsPerScore) + run.coins;
      save.coins += coins;
      save.exp += run.score;
      let levels = 0;
      while (save.exp >= D.levelExp(save.level)) { save.exp -= D.levelExp(save.level); save.level++; levels++; }
      const isBest = run.score > save.bestScore;
      if (isBest) save.bestScore = run.score;
      save.bestArea = Math.max(save.bestArea, run.maxArea);
      save.scores.push({ score: run.score, area: run.maxArea, date: Date.now() });
      save.scores.sort((a, b) => b.score - a.score);
      save.scores = save.scores.slice(0, 10);
      for (const k in run.caught) save.caught[k] = (save.caught[k] || 0) + run.caught[k];
      save.plays++;
      if (run.tutorial) save.tutorialDone = true;
      root.SH.save.write();
      platform.submitScore(run.score);
      return { score: run.score, isBest, catches: run.catches, maxCombo: run.maxCombo, area: run.maxArea, exp: run.score, coins, levels, before, level: save.level };
    }
  }

  const FONT = '"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","Arial Rounded MT Bold",system-ui,sans-serif';

  root.SH = root.SH || {};
  root.SH.Game = Game;
  root.SH.FONT = FONT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
