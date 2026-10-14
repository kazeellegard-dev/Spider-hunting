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
  const M = root.SH.meta;

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
      this.bg = this.makeBg(this.areaIdx);
      this.bgPrev = null;
    }

    makeBg(idx) { return R.makeBackground(D.AREAS[idx], this.W, this.H, this.dpr, root.SH.save.data.look.bg); }

    // base stats with this run's charms / weather / stars applied (normal mode only)
    refreshStats() {
      const st = this.stats();
      const m = this.mods = M.mods(this.mode === 'play' && this.runMode === 'endless' ? this.run : null);
      st.strength += m.strength; st.struggle *= m.struggle; st.speed *= m.speed; st.lure *= m.lure;
      this.st = st;
      return st;
    }

    // endless: coin upgrades + level bonus. challenge: the stage run's own picks, no level bonus
    stats(mode) {
      const s = root.SH.save.data;
      const ch = (mode || this.runMode) === 'challenge';
      const u = ch ? s.challenge.upgrades : s.upgrades;
      const lv = ch ? 0 : s.level - 1;
      return {
        strength: B.baseStrength + (u.strength || 0) * B.strengthPerUpgrade + lv * B.strengthPerLevel,
        maxSilk: B.baseMaxSilk + (u.silk || 0) * B.silkPerUpgrade + lv * B.silkPerLevel,
        struggle: B.baseStruggle + (u.sticky || 0) * B.strugglePerUpgrade,
        speed: B.baseSpeed * (1 + (u.speed || 0) * B.speedPerUpgrade),
        appetite: 1 + (u.appetite || 0) * B.appetitePerUpgrade,
        lure: 1 + (u.lure || 0) * B.lurePerUpgrade,
      };
    }

    // challenge stages lend a random outfit for the stage; otherwise the player's own
    costume() {
      const s = root.SH.save.data;
      const lend = this.mode === 'play' && this.runMode === 'challenge' && s.challenge.look;
      if (this._lookKey !== (lend ? 'c' : 'p') + JSON.stringify(lend || s.look)) {
        this._lookKey = (lend ? 'c' : 'p') + JSON.stringify(lend || s.look);
        this._look = M.spiderLook(lend || s.look);
      }
      return this._look;
    }

    resetWorld() {
      this.web = new Web();
      this.insects = [];
      this.treats = [];
      this.specials = [];
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
      this.runMode = 'endless';
      this.stage = null; this.stageIdx = -1;
      this.run = null;
      this.refreshStats();
      this.resetWorld();
      // the title screen follows the player's real clock
      const h = new Date().getHours();
      this.areaIdx = h >= 5 && h < 10 ? 0 : h >= 10 && h < 16 ? 1 : h >= 16 && h < 18 ? 2 : 3;
      const hub = this.buildStarterWeb(this.W / 2, this.H * 0.5, 9, Math.min(this.W * 0.42, 170), [0.25, 0.5, 0.75]);
      this.spider.node = hub; this.spider.x = hub.x; this.spider.y = hub.y; this.spider.home = hub;
      this.spawnTimer = 0.5;
      this.bg = this.makeBg(this.areaIdx);
      this.bgPrev = null;
      this.particles = []; this.texts = [];
      this.paused = false;
      this.trail = []; this.shooters = []; this.skyFx = null;
    }

    // opts.stage: 0-based stage index for challenge mode; omitted = endless
    startRun(opts) {
      opts = opts || {};
      const stage = opts.stage != null ? root.SH.STAGES[opts.stage] : null;
      this.mode = 'play';
      this.runMode = stage ? 'challenge' : 'endless';
      this.stage = stage; this.stageIdx = stage ? opts.stage : -1;
      this.run = null;
      this.refreshStats();
      this.resetWorld();
      const save = root.SH.save.data;
      const endless = !stage;
      const run = this.run = {
        score: 0, silk: this.st.maxSilk, glow: 0, time: 0, combo: 0, lastEat: -99, maxCombo: 0, catches: 0,
        bonusGauge: 0, bonusTimer: 0, coins: 0, caught: {}, continued: false, over: false, dying: 0,
        windTimer: rand(B.windEvery[0] * 0.6, B.windEvery[1] * 0.6), wind: 0, windLeft: 0, maxArea: 0, day: 1, phase: 0, phaseT: 0,
        gustTimer: -1, gustLeft: 0, gusts: 0, mode: this.runMode,
        kinds: {}, treats: 0, bosses: 0, weights: [], timeLeft: stage ? stage.time : 0, gustDone: false,
        tutorial: save.tutorialDone ? 0 : 1, tutorialTimer: 0, heavyHinted: !!save.tutorialDone && save.plays > 3,
        // replay layer (normal mode)
        star: endless ? clamp(save.stars.sel || 0, 0, M.starsOpen(save)) : 0, charms: {}, charmPicks: 0,
        weather: 'clear', weathersSeen: ['clear'], ties: 0, gustsSurvived: 0, bonuses: 0,
        shinyCaught: 0, shinies: {}, big: {}, small: {}, glowMax: B.glowDuration, odaiShown: {},
        // easter eggs found this run (folded into the save at the end), heart-web lure time
        eggs: {}, heartT: 0, lastScore: 0,
      };
      this.trail = []; this.shapeCool = 0; this.shooters = []; this.skyFx = null;
      if (endless) M.ensureOdai(save);
      this.refreshStats();
      run.silk = this.st.maxSilk;
      run.windTimer *= this.mods.breezeEvery;
      const hub = this.buildStarterWeb(this.W / 2, this.H * 0.42, 6, Math.min(this.W * 0.2, 80), [0.55]);
      this.spider.node = hub; this.spider.x = hub.x; this.spider.y = hub.y;
      this.spawnTimer = run.tutorial ? 3 : 1.2;
      this.specials = []; this.specialTimer = 0;
      this.areaIdx = stage ? stage.area : 0;
      this.bg = this.makeBg(this.areaIdx);
      this.bgPrev = null;
      this.particles = []; this.texts = [];
      this.paused = false;
      audio.music(this.musicMode());
      if (stage) this.hooks.banner(t('stage') + ' ' + (opts.stage + 1), t('areaNames')[this.areaIdx], 'area');
      else this.hooks.banner(this.dayText(1), run.star ? '★' + run.star + '  ' + t('areaNames')[0] : t('areaNames')[0], 'area');
      if (run.tutorial) this.hooks.tutorial(t('tut1'));
      else if (endless) this.offerCharms();
    }

    // ---------- dawn charms ----------
    offerCharms() {
      const run = this.run;
      const choices = M.charmChoices(run);
      if (!choices.length || !this.hooks.charmPick) return;
      run.charmOffer = choices;
      this.hooks.charmPick(choices);
    }

    applyCharm(id) {
      const run = this.run;
      if (!run || !run.charmOffer || !run.charmOffer.includes(id)) return;
      run.charmOffer = null;
      run.charms[id] = (run.charms[id] || 0) + 1;
      run.charmPicks++;
      this.refreshStats();
      if (id === 'refill') run.silk = this.st.maxSilk;
      audio.play('buy');
      this.burst(this.spider.x, this.spider.y, '#ffe066');
      const c = M.CHARMS.find(x => x.id === id);
      this.floatText(this.spider.x, this.spider.y - 36, c.icon + ' ' + (c.name[root.SH.i18n.lang] || c.name.en), '#fff3b0', 16);
    }

    continueRun() {
      const run = this.run;
      run.continued = true; run.over = false; run.dying = 0;
      run.silk = Math.max(run.silk, this.st.maxSilk * 0.5);
      this.spider.sad = false;
      this.paused = false;
      audio.music(this.musicMode());
    }

    musicMode() {
      if (this.run && (this.run.bonusTimer > 0 || this.run.glow > 0)) return 'bonus';
      const a = D.AREAS[this.areaIdx];
      return a.night ? 'night' : a.id === 'sunset' ? 'eve' : 'day';
    }

    // ---------- input ----------
    tap(x, y) {
      if (this.paused) return;
      if (this.mode !== 'play' || this.run.over || this.run.dying) return;
      const sp = this.spider;
      for (const it of this.specials) {
        if (!it.dead && Math.hypot(it.x - x, it.y - y) < 42) { this.grabSpecial(it); return; }
      }
      if (sp.action !== 'idle') { this.queuedTap = { x, y }; return; }
      this.handleTap(x, y);
    }

    handleTap(x, y) {
      const sp = this.spider;
      // 0) the glowing spool (bonus time item) is grabbed by tapping it
      for (const it of this.specials) {
        if (!it.dead && Math.hypot(it.x - x, it.y - y) < 42) { this.grabSpecial(it); return; }
      }
      // 1) a stuck bug near the tap? rush and wrap it
      let best = null, bd = B.tapInsectRadius;
      for (const ins of this.insects) {
        if (ins.state !== 'caught' || (ins.targeted && sp.target === ins)) continue;
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
      const cost = len * B.silkCostPerPx * this.mods.cost;
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
      if (this.bgPrev) { this.bgFade -= dt / 3; if (this.bgFade <= 0) this.bgPrev = null; }
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
      this.updateSpecials(dt);
      this.updateFx(dt);
    }

    updateDemo(dt) {
      const sp0 = this.spider;
      if (sp0.hurt > 0) sp0.hurt -= dt;
      if (this.skyFx) { this.skyFx.t += dt; if (this.skyFx.t >= this.skyFx.max) this.skyFx = null; }
      if (sp0.dizzy) {
        // hangs upside down from its hub on a single thread, swaying
        sp0.x = sp0.home.x + Math.sin(this.time * 2) * 6; sp0.y = sp0.home.y + 44;
        sp0.lookX = 0; sp0.lookY = 0;
      }
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.insects.length < 6) {
        this.spawnTimer = rand(0.9, 1.6);
        this.spawnInsect(pickWeighted(D.AREAS[this.areaIdx].table));
      }
      const sp = this.spider;
      if (sp.action === 'idle' && !sp.dizzy) {
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
        if (run.dying <= 0) { run.dying = 0; run.over = true; this.hooks.gameOver(!run.continued && !this.mods.noContinue); }
        return;
      }
      run.time += dt;
      if (run.score !== run.lastScore) {
        run.lastScore = run.score;
        if (M.isPittari(run.score)) this.pittari(run.score);
      }
      if (run.heartT > 0) run.heartT -= dt;
      if (this.shapeCool > 0) this.shapeCool -= dt;
      const inBonus = run.bonusTimer > 0;
      // silk drains over time and faster as the run goes on (the run's clock)
      const tutorialFree = run.tutorial && run.tutorial < 4;
      if (!tutorialFree) {
        const st = this.stage;
        const drain = st ? st.drain + run.time * st.ramp : this.mods.drain * Math.min(B.drainMax, B.drainBase + run.time * B.drainRamp + run.time * run.time * B.drainCurve);
        run.silk -= drain * dt * (inBonus ? 0.5 : 1);
      }
      if (run.silk < this.st.maxSilk * 0.2 && !run.lowHinted && !run.tutorial) { run.lowHinted = true; this.hooks.hint(t('lowSilk')); }
      if (run.silk <= 0 && run.mode === 'challenge') { run.silk = 0; this.failStage('silk'); return; }
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
        const ramp = this.stage ? this.stage.spawn * (1 - Math.min(0.15, run.time / 800))
          : 1 - Math.min(0.4, (this.rampDay() - 1) * 0.08 + Math.min(0.1, run.time / 900));
        let interval = area.spawn * ramp * this.mods.spawn * (run.heartT > 0 ? 0.6 : 1);
        if (run.tutorial && run.tutorial < 3) interval = 99;
        else if (run.tutorial === 3) interval = 2.2;
        this.spawnTimer = interval * rand(0.75, 1.25);
        let type = pickWeighted(this.spawnTable(area));
        if (run.glow > 0 && (this.bossNext || Math.random() < 0.3)) {
          const want = this.stage && this.stage.goals.find(gl => gl.type === 'type' && D.INSECTS[gl.key].boss);
          type = want && Math.random() < 0.7 ? want.key : pickWeighted({ oniyanma: 3, hornet: 3, hercules: 1.2 });
          this.bossNext = false;
        }
        if (run.tutorial === 3) type = Math.random() < 0.5 ? 'butterfly' : 'fly';
        else if (Math.random() < D.GOLDEN_CHANCE * this.st.lure) type = 'golden';
        // secret bugs (normal mode only): about one spawn in ten thousand each
        if (!this.stage && !run.tutorial) for (const k of D.SECRET_BUGS) if (Math.random() < D.SECRET_CHANCE) { type = k; audio.play('area'); }
        this.spawnInsect(type, run.tutorial === 3 || run.heartT > 0);
        // swarm: sometimes gnats come in a group
        if (type === 'gnat' && Math.random() < 0.4) { this.spawnInsect('gnat'); this.spawnInsect('gnat'); }
      }
      // combo timeout
      if (run.combo > 0 && run.time - run.lastEat > B.comboWindow + this.mods.comboExtra) run.combo = 0;
      // bonus
      if (inBonus) {
        run.bonusTimer -= dt;
        this.treatTimer -= dt;
        if (this.treatTimer <= 0) { this.treatTimer = rand(0.22, 0.38); this.spawnTreat(); }
        if (this.specialTimer > 0) { this.specialTimer -= dt; if (this.specialTimer <= 0) this.spawnSpecial(); }
        if (run.bonusTimer <= 0) {
          run.bonusTimer = 0; run.bonusGauge = 0; run.bonuses++; this.spawnTimer = 0.6;
          for (const it of this.specials) it.dead = true;
          if (run.glow > 0) {
            audio.play('bonus');
            this.hooks.banner(t('glowTime'), t('glowSub'), 'bonus');
            this.bossNext = true;
          }
          audio.music(this.musicMode());
        }
      } else if (run.bonusGauge >= this.bonusNeed()) {
        run.bonusTimer = B.bonusDuration; this.treatTimer = 0.3;
        this.specialTimer = rand(1.2, 3.5);
        audio.play('bonus'); audio.music('bonus');
        this.hooks.banner(t('bonusTime'), t('bonusSub'), 'bonus');
        platform.haptic('medium');
      }
      // glowing silk counts down once bonus time is over
      if (run.glow > 0 && !inBonus) {
        run.glow -= dt;
        if (run.glow <= 0) { run.glow = 0; audio.music(this.musicMode()); }
      }
      // gusts: a warning, then a blast that tears away a chunk of the web
      if (!inBonus && !run.tutorial) {
        if (run.gustLeft > 0) {
          const before = run.gustLeft;
          run.gustLeft -= dt;
          const k = Math.sin(Math.PI * Math.min(1, (2.6 - run.gustLeft) / 2.6));
          run.wind = run.windDir * (run.gustLeft < 2.6 ? 4.5 * k : 0.3);
          if (before > 1.6 && run.gustLeft <= 1.6) this.gustBlast();
          if (run.gustLeft <= 0) { run.gustLeft = 0; run.wind = 0; }
        } else {
          // at most one gust per day, armed at dawn (see enterPhase); -1 = none pending
          if (run.gustTimer > 0) run.gustTimer -= dt;
          if (run.gustTimer > -1 && run.gustTimer <= 0) {
            run.gustTimer = -1;
            run.gustLeft = 4.0; run.windDir = Math.random() < 0.5 ? -1 : 1; run.windLeft = 0;
            audio.play('wind');
            this.hooks.banner(t('gustWarn'), t('gustSub'), 'wind');
            platform.haptic('medium');
          }
        }
      }
      // wind
      if (run.gustLeft > 0) { /* gust owns the wind */ }
      else if ((this.stage ? this.stage.wind : run.day > 1 || run.phase >= 1) && !inBonus) {
        if (run.windLeft > 0) {
          run.windLeft -= dt;
          const k = Math.sin(Math.PI * (1 - run.windLeft / 4.5));
          run.wind = run.windDir * k * (1 + Math.min(4, this.rampDay() - 1) * 0.15);
          if (run.windLeft <= 0) { run.wind = 0; run.windTimer = rand(B.windEvery[0], B.windEvery[1]) * this.mods.breezeEvery; }
        } else {
          run.windTimer -= dt;
          if (run.windTimer <= 0) {
            run.windLeft = 4.5; run.windDir = Math.random() < 0.5 ? -1 : 1;
            audio.play('wind');
            this.hooks.banner(t('wind'), run.windDir > 0 ? '→ → →' : '← ← ←', 'wind');
          }
        }
      } else run.wind = 0;
      if (run.mode === 'challenge') { if (this.updateStage(dt)) return; }
      // time of day: morning -> daytime -> evening -> night -> next morning
      else if (!run.tutorial || run.tutorial >= 4) {
        run.phaseT += dt;
        if (run.phaseT >= D.PHASES[run.phase].len) {
          run.phaseT = 0;
          run.phase = (run.phase + 1) % D.PHASES.length;
          if (run.phase === 0) run.day++;
          this.enterPhase();
        }
      }
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
      if (sp.smug > 0) sp.smug -= dt;
      if (run.mode !== 'challenge') {
        run.odaiT = (run.odaiT || 0) + dt;
        if (run.odaiT >= 0.5) { run.odaiT = 0; this.checkOdai(); }
      }
    }

    bonusNeed() {
      if (this.stage) return this.stage.bonusNeed + (this.run.bonuses || 0) * 4;
      return Math.round((B.bonusNeed + (this.run.bonuses || 0) * B.bonusNeedStep) * this.mods.bonusNeed);
    }

    // ---------- challenge mode ----------
    updateStage(dt) {
      const run = this.run, st = this.stage;
      if (run.tutorial && run.tutorial < 4) return false;
      run.timeLeft = Math.max(0, run.timeLeft - dt);
      if (st.gust && !run.gustDone && run.time >= st.gust) { run.gustDone = true; run.gustTimer = 0.01; }
      const goals = this.goalStates();
      const timed = goals.some(gs => gs.goal.type === 'survive');
      if (!timed && goals.every(gs => gs.done)) { this.clearStage(); return true; }
      if (run.timeLeft <= 0) {
        if (goals.every(gs => gs.done || gs.goal.type === 'survive')) this.clearStage();
        else this.failStage('time');
        return true;
      }
      return false;
    }

    goalProgress(goal) {
      const run = this.run;
      switch (goal.type) {
        case 'catch': return run.catches;
        case 'kind': return run.kinds[goal.key] || 0;
        case 'type': return run.caught[goal.key] || 0;
        case 'score': return run.score;
        case 'combo': return run.maxCombo;
        case 'treats': return run.treats;
        case 'boss': return run.bosses;
        case 'heavy': return run.weights.filter(w => w >= goal.key).length;
        case 'survive': return Math.floor(this.stage.time - run.timeLeft);
        default: return 0;
      }
    }

    goalStates() {
      return this.stage.goals.map(goal => {
        const cur = this.goalProgress(goal);
        const target = goal.type === 'survive' ? this.stage.time : goal.n;
        return { goal, cur: Math.min(cur, target), target, done: goal.type === 'survive' ? this.run.timeLeft <= 0 : cur >= target };
      });
    }

    clearStage() {
      const run = this.run;
      if (run.over) return;
      run.over = true;
      audio.stopMusic();
      audio.play('levelup');
      platform.haptic('heavy');
      this.burst(this.spider.x, this.spider.y, '#ffe066');
      this.spider.happy = 3;
      setTimeout(() => this.hooks.stageClear(), 900);
    }

    failStage(reason) {
      const run = this.run;
      if (run.over) return;
      run.over = true;
      this.spider.sad = true;
      audio.stopMusic();
      audio.play('gameover');
      platform.haptic('heavy');
      setTimeout(() => this.hooks.stageFail(reason), 900);
    }

    // rewards for a finished challenge stage; on clear, unlock the next stage
    finishStage(cleared) {
      const run = this.run, save = root.SH.save.data;
      const coins = Math.floor(run.score * B.coinsPerScore) + run.coins + (cleared ? 20 + this.stageIdx * 5 : 0);
      save.coins += coins;
      save.exp += run.score;
      let levels = 0;
      while (save.exp >= D.levelExp(save.level)) { save.exp -= D.levelExp(save.level); save.level++; levels++; }
      save.plays++;
      if (run.tutorial) save.tutorialDone = true;
      if (cleared) {
        save.challenge.cleared = Math.max(save.challenge.cleared || 0, this.stageIdx + 1);
        save.challenge.stage = Math.min(this.stageIdx + 1, root.SH.STAGES.length - 1);
        if (this.stageIdx + 1 >= root.SH.STAGES.length) save.challenge.allClear = true;
      }
      const rewards = M.applyStage(save, run);
      root.SH.save.write();
      return { score: run.score, coins, levels, level: save.level, stage: this.stageIdx, rewards };
    }

    endTutorial() {
      const run = this.run;
      run.tutorial = 0;
      root.SH.save.data.tutorialDone = true; root.SH.save.write();
      this.hooks.tutorial(null);
    }

    dayText(n) { return t('dayFmt').replace('{n}', n); }

    enterPhase() {
      const run = this.run;
      const save = root.SH.save.data;
      const idx = D.phaseArea(run.phase, run.day);
      if (run.phase === 0 && run.mode !== 'challenge') {
        // a new day: new weather, maybe a cleared star, then a charm to pick
        run.weather = M.pickWeather();
        if (!run.weathersSeen.includes(run.weather)) run.weathersSeen.push(run.weather);
        this.refreshStats();
        const gd = this.mods.gustFromDay;
        if (run.day >= gd && (run.day - gd) % B.gustEveryDays === 0) run.gustTimer = rand(B.gustDelay[0], B.gustDelay[1]);
      }
      if (run.phase === 0) {
        const record = run.day > (save.bestDay || 0) && save.bestDay > 0;
        const w = M.WEATHERS.find(x => x.id === run.weather);
        const sub = record ? t('newDayRecord') : run.weather !== 'clear' ? w.icon + ' ' + (w.name[root.SH.i18n.lang] || w.name.en) : t('areaNames')[idx];
        this.enterArea(idx, this.dayText(run.day), sub);
        if (record && !run.recordShown) { run.recordShown = true; audio.play('levelup'); }
        if (run.weather !== 'clear') setTimeout(() => this.hooks.hint(w.icon + ' ' + (w.name[root.SH.i18n.lang] || w.name.en) + '：' + (w.desc[root.SH.i18n.lang] || w.desc.en)), 600);
        let starDone = false;
        if (run.mode !== 'challenge' && run.day >= M.STAR_CLEAR_DAY && run.star > save.stars.cleared) {
          // reaching day 7 clears this star and opens the next one
          save.stars.cleared = run.star;
          root.SH.save.write();
          const open = M.starsOpen(save);
          starDone = true;
          audio.play('levelup');
          this.hooks.banner(run.star ? t('starClear').replace('{n}', run.star) : t('starClear0').replace('{d}', M.STAR_CLEAR_DAY), open > run.star ? t('starOpen').replace('{n}', open) : '', 'bonus');
        }
        if (run.mode !== 'challenge') setTimeout(() => { if (this.run === run && !run.over && !run.dying) this.offerCharms(); }, starDone ? 2600 : 1600);
      } else {
        this.enterArea(idx, t('areaNames')[idx], this.dayText(run.day));
      }
    }

    enterArea(idx, big, small) {
      this.areaIdx = idx;
      if (this.run) this.run.maxArea = Math.max(this.run.maxArea, idx);
      this.bgPrev = this.bg; this.bgFade = 1;
      this.bg = this.makeBg(idx);
      audio.play('area');
      if (!this.run || (this.run.bonusTimer <= 0 && this.run.glow <= 0)) audio.music(this.musicMode());
      this.hooks.banner(big || t('areaNames')[idx], small || '', 'area');
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
        if (this.mode === 'play') this.traceShape(from, to);
        const { knots } = this.web.spinTied(from, to, this.st.strength);
        if (knots.length && this.mode === 'play') {
          this.run.ties += knots.length;
          for (const k of knots) this.puff(k.x, k.y, 'rgba(255,240,170,0.95)', 7);
          this.floatText((from.x + to.x) / 2, (from.y + to.y) / 2 - 18, knots.length > 1 ? t('tieN').replace('{n}', knots.length) : t('tie'), '#fff3b0', 15);
          audio.play('stick', 0.6);
        }
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

    // ---------- easter eggs ----------
    // the corners the spider has spun through without stopping to eat; a loop that
    // comes back to an earlier corner is checked for a heart, a star or a circle
    traceShape(from, to) {
      const tr = this.trail, last = tr[tr.length - 1];
      if (!last || Math.hypot(last.x - from.x, last.y - from.y) > 16) this.trail = [{ x: from.x, y: from.y }];
      this.trail.push({ x: to.x, y: to.y });
      if (this.trail.length > 16) this.trail.shift();
      if (this.shapeCool > 0) return;
      const pts = this.trail, end = pts[pts.length - 1];
      for (let i = pts.length - 4; i >= 0; i--) {
        if (Math.hypot(pts[i].x - end.x, pts[i].y - end.y) > 24) continue;
        const loop = pts.slice(i, pts.length - 1);
        const shape = M.webShape(loop);
        if (shape) { this.webShapeFound(shape, loop); this.trail = [end]; return; }
      }
    }

    webShapeFound(shape, loop) {
      const run = this.run;
      run.eggs[shape] = (run.eggs[shape] || 0) + 1;
      this.shapeCool = 3;
      const cx = loop.reduce((a, p) => a + p.x, 0) / loop.length, cy = loop.reduce((a, p) => a + p.y, 0) / loop.length;
      audio.play('bonus');
      platform.haptic('medium');
      if (shape === 'heart') {
        // hearts rise from the web, and bugs come to it more often for a while
        run.heartT = 20;
        for (let i = 0; i < 14; i++) this.particles.push({ x: cx + rand(-40, 40), y: cy + rand(-30, 30), vx: rand(-30, 30), vy: rand(-140, -60), life: 1.4, max: 1.4, color: i % 2 ? '#ff6f9a' : '#ffb3cf', size: rand(5, 9), kind: 'heart', float: true });
        this.floatText(cx, cy - 20, t('eggHeart'), '#ff8fb8', 20);
      } else if (shape === 'star') {
        // a shooting star crosses the sky
        this.shooters.push({ x: -40, y: this.H * rand(0.08, 0.2), vx: this.W * 0.9, vy: this.H * 0.12, life: 1.6 });
        const pts = Math.round(300 * this.mods.score);
        run.score += pts;
        this.burst(cx, cy, '#ffe066');
        this.floatText(cx, cy - 20, t('eggStar').replace('{n}', pts), '#ffe066', 20);
      } else {
        // a perfect circle: the spider is very pleased with itself
        this.spider.smug = 4;
        this.burst(cx, cy, '#8fd3ff');
        this.floatText(cx, cy - 20, t('eggRound'), '#c8f0ff', 20);
      }
    }

    pittari(score) {
      const run = this.run;
      run.eggs.pittari = (run.eggs.pittari || 0) + 1;
      audio.play('levelup');
      // confetti from the top of the field
      const cols = ['#ff6f9a', '#ffe066', '#8fd3ff', '#7be39a', '#d2b8ff'];
      for (let i = 0; i < 40; i++) this.particles.push({ x: rand(0, this.W), y: rand(-10, this.H * 0.15), vx: rand(-40, 40), vy: rand(20, 120), life: 1.8, max: 1.8, color: cols[i % cols.length], size: rand(3, 5), kind: 'confetti', spin: rand(0, 6) });
      this.floatText(this.W / 2, this.H * 0.3, t('eggPittari').replace('{n}', score.toLocaleString()), '#ffe066', 24);
    }

    // taps on the title screen: poke the spider (ten pokes make it dizzy), greet the sun or moon
    demoTap(x, y) {
      if (this.mode !== 'demo') return null;
      const sp = this.spider;
      const sx = this.W * 0.78, sy = this.H * 0.13;
      if (Math.hypot(x - sx, y - sy) < 40) {
        const night = D.AREAS[this.areaIdx].night;
        this.skyFx = { kind: night ? 'moon' : 'sun', t: 0, max: night ? 4 : 2 };
        audio.play(night ? 'area' : 'pop');
        return 'sky';
      }
      if (Math.hypot(x - sp.x, y - sp.y) > 46) return null;
      if (sp.dizzy) {
        sp.dizzy = false; sp.pokes = 0;
        sp.action = 'walk'; sp.tx = sp.home.x; sp.ty = sp.home.y;
        audio.play('land');
        return 'undizzy';
      }
      sp.pokes = (sp.pokes || 0) + 1;
      sp.hurt = 0.25;
      audio.play('pop', sp.pokes);
      if (sp.pokes >= 10) {
        sp.dizzy = true; sp.action = 'idle'; sp.target = null;
        this.floatText(sp.x, sp.y - 40, t('eggDizzy'), '#ffe066', 18);
        audio.play('gameover');
        return 'dizzy';
      }
      this.floatText(sp.x + rand(-14, 14), sp.y - 30, sp.pokes >= 7 ? '!?' : '!', '#ffffff', 14);
      return 'poke';
    }

    beginWrap(ins) {
      const sp = this.spider;
      sp.action = 'wrap'; sp.wrapT = 0;
      ins.state = 'wrapped'; ins.wrapT = 0;
      if (ins.point) { ins.point.load = Math.max(0, ins.point.load - ins.load); }
      audio.play('wrap');
    }

    // Endless difficulty follows play time, not the day counter, so the length of a day
    // only changes how fast the days tick by. Day 1 = the first B.rampDay seconds.
    rampDay() { return this.run ? 1 + Math.floor(this.run.time / B.rampDay) : 3; }

    // ---------- insects ----------
    // heavy bugs ease in over the first days; the lure upgrade favors rare ones
    spawnTable(area) {
      const day = this.run ? this.rampDay() : 3;
      const m = this.mods;
      const heavy = this.stage ? this.stage.heavy : m.heavyFull ? 1 : Math.min(1, 0.2 + (day - 1) * 0.4);
      const out = {};
      let any = false;
      for (const k in area.table) {
        const d = D.INSECTS[k];
        // a swarm day only brings the small ones
        if (m.smallOnly && d.weight > 1.5) continue;
        // bugs a stage mission asks for show up twice as often and are never thinned out
        const wanted = this.stage && this.stage.goals.some(gl => (gl.type === 'type' && gl.key === k) || (gl.type === 'kind' && gl.key === d.kind));
        const wing = m.flutter && (d.kind === 'butterfly' || d.kind === 'moth') ? 1 + m.flutter : 1;
        out[k] = area.table[k] * (d.rare ? this.st.lure : 1) * wing * (wanted ? 2 : d.weight > 2.4 ? heavy : 1);
        any = true;
      }
      return any ? out : area.table;
    }

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
      // later days bring faster bugs
      const areaBoost = 1 + (this.run ? Math.min(0.5, (this.rampDay() - 1) * 0.08) + Math.min(0.15, this.run.time / 600) : 0);
      const speed = def.speed * rand(0.85, 1.15) * areaBoost * (this.run ? this.mods.bugSpeed : 1);
      // normal-mode bugs vary in size (Bugdex records) and are now and then a colour variant
      const endless = this.mode === 'play' && this.runMode === 'endless';
      const sizeF = this.mode === 'play' ? M.rollSize() : 1;
      const shiny = endless && !(this.run && this.run.tutorial) && Math.random() < this.mods.shiny;
      this.insects.push({
        id: insectId++, type, def, state: 'fly', sizeF, shiny,
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
          const hit = this.web.threadNear(ins.x, ins.y, ins.def.size * (ins.sizeF || 1) * 0.55 + 2);
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
      if (ins.state === 'escape') { ins.fade -= dt; if (ins.fade <= 0) ins.dead = true; }
    }

    hitThread(ins, hit, strength) {
      const def = ins.def;
      const th = hit.thread;
      const glow = this.mode === 'play' && this.run.glow > 0;
      // threads tied in at crossings hold heavier bugs
      const held = strength + Math.min(th.ties || 0, B.tieMax) * B.tieBonus * (this.mode === 'play' ? this.mods.tieMul : 1);
      const tooHeavy = this.mode === 'play' && !glow && (def.boss || def.weight > held);
      if (tooHeavy) {
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
      ins.targeted = false;
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
      // only the bug the spider is actually going for holds still
      const frozen = (ins.targeted && this.spider.target === ins) || (run && run.tutorial === 3);
      if (!frozen) {
        ins.struggle -= dt;
        // a breeze (not a gust) works the bug loose: windStruggle of its meter over the 4.5 s
        if (run && run.windLeft > 0 && run.gustLeft <= 0 && !this.mods.calm) ins.struggle -= dt * ins.struggleMax * B.windStruggle / 4.5;
      }
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
      // it flies off fading out and can't be caught again
      ins.state = 'escape'; ins.point = null; ins.targeted = false; ins.pass = 0.8; ins.vy = -40;
      ins.baseY = ins.y; ins.phase = 0; ins.fade = ins.fadeMax = 0.9;
      if (tear) {
        this.puff(ins.x, ins.y, 'rgba(255,255,255,0.9)', 10);
        for (let i = 0; i < 6; i++) this.particles.push({ x: ins.x, y: ins.y, vx: rand(-90, 90), vy: rand(-120, -20), life: 0.5, max: 0.5, color: ins.def.color, size: rand(1.5, 2.5), kind: 'dot' });
      }
      if (this.mode !== 'play') return;
      if (tear) { audio.play('snap'); platform.haptic('light'); }
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
      const m = this.mods;
      const wing = m.flutter && (def.kind === 'butterfly' || def.kind === 'moth') ? 1 + 0.3 * m.flutter : 1;
      const pts = Math.round(def.score * mult * m.score * wing * (ins.shiny ? 3 : 1));
      run.score += pts;
      run.catches++;
      if (run.mode !== 'challenge') this.recordCatch(ins);
      // the Bugdex belongs to Normal mode; challenge runs don't fill it
      if (run.mode !== 'challenge' && !run.caught[ins.type] && !root.SH.save.data.caught[ins.type]) {
        this.floatText(ins.x, ins.y - 64, 'NEW! ' + def.name[root.SH.i18n.lang], '#8fd3ff', 16);
        audio.play('area');
      }
      run.caught[ins.type] = (run.caught[ins.type] || 0) + 1;
      run.kinds[def.kind] = (run.kinds[def.kind] || 0) + 1;
      run.weights.push(def.weight);
      if (def.boss) run.bosses++;
      if (def.secret) {
        run.eggs[ins.type] = (run.eggs[ins.type] || 0) + 1;
        audio.play('levelup');
        this.floatText(ins.x, ins.y - 86, t('eggSecretBug'), '#ffe066', 18);
      }
      run.silk = Math.min(this.st.maxSilk, run.silk + def.silk * this.st.appetite * (def.weight >= 3 ? m.feast : 1));
      if (run.bonusTimer <= 0) run.bonusGauge = Math.min(this.bonusNeed(), run.bonusGauge + (1 + (run.combo >= 5 ? 0.5 : 0)) * m.bonusGain);
      if (def.coins) { run.coins += def.coins; audio.play('coin'); this.floatText(ins.x, ins.y - 44, '+' + def.coins + ' ' + t('coins'), '#ffd23f', 15); }
      audio.play('pop', run.combo);
      platform.haptic('light');
      this.floatText(ins.x, ins.y - 18, '+' + pts, run.combo >= 3 ? '#ffe066' : '#ffffff', 18 + Math.min(run.combo, 10));
      if (run.combo >= 2) this.floatText(ins.x, ins.y - 40, run.combo + ' ' + t('combo') + '!', '#ff8fb8', 14);
      this.spider.happy = 0.6;
      if (run.tutorial === 3) { run.tutorial = 4; run.tutorialTimer = 4.5; this.hooks.tutorial(t('tut4')); }
    }

    // Bugdex: size records (biggest / smallest, each with its own gold line) and colour variants
    recordCatch(ins) {
      const run = this.run, dex = root.SH.save.data.dex, type = ins.type;
      const mm = M.sizeMM(type, ins.sizeF || 1), gold = M.sizeGold(type);
      if (ins.shiny) {
        run.shinyCaught++; run.shinies[type] = (run.shinies[type] || 0) + 1;
        run.coins += 10;
        audio.play('levelup');
        this.floatText(ins.x, ins.y - 86, t('shinyGet'), '#ff9fe0', 18);
      }
      const bigBefore = Math.max(dex.big[type] || 0, run.big[type] || 0);
      const smallBefore = Math.min(dex.small[type] || Infinity, run.small[type] || Infinity);
      let note = null;
      if (mm > bigBefore) {
        run.big[type] = mm;
        if (bigBefore) note = (mm >= gold.big && bigBefore < gold.big ? '🥇 ' : '') + t('sizeBig') + ' ' + mm + 'mm';
      }
      if (mm < smallBefore) {
        run.small[type] = mm;
        if (smallBefore !== Infinity) note = (mm <= gold.small && smallBefore > gold.small ? '🥇 ' : '') + t('sizeSmall') + ' ' + mm + 'mm';
      }
      if (note) this.floatText(ins.x, ins.y - 64, note, note[0] === '🥇' ? '#ffd23f' : '#c8f0ff', note[0] === '🥇' ? 16 : 13);
      if (note && note[0] === '🥇') audio.play('coin');
    }

    // today's tasks: cheer once when one is done during the run (the drops are paid on the result screen)
    checkOdai() {
      const run = this.run, od = root.SH.save.data.odai;
      if (!od || !od.tasks) return;
      od.tasks.forEach((task, i) => {
        if (task.done || run.odaiShown[i]) return;
        if (M.odaiProgress(task, run) >= task.n) {
          run.odaiShown[i] = true;
          this.hooks.hint(t('odaiDone'));
          audio.play('bonus');
        }
      });
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
          const pts = Math.round(tr.def.score * mult * this.mods.score);
          run.score += pts; run.coins += tr.def.coins; run.treats++;
          audio.play('treat');
          this.burst(tr.x, tr.y, tr.def.color);
          this.floatText(tr.x, tr.y - 16, '+' + pts, '#fff6c2', 16);
        }
      }
      this.treats = this.treats.filter(tr => !tr.dead);
    }

    // ---------- glowing spool & gusts ----------
    spawnSpecial() {
      const left = Math.random() < 0.5;
      const y = rand(this.H * 0.25, this.H * 0.6);
      this.specials.push({ x: left ? -30 : this.W + 30, y, baseY: y, vx: (left ? 1 : -1) * rand(55, 75), t: 0, dead: false });
    }

    updateSpecials(dt) {
      for (const it of this.specials) {
        it.t += dt;
        it.x += it.vx * dt;
        it.y = it.baseY + Math.sin(it.t * 2.2) * 22;
        if (it.x < -60 || it.x > this.W + 60) it.dead = true;
      }
      this.specials = this.specials.filter(it => !it.dead);
    }

    grabSpecial(it) {
      it.dead = true;
      const run = this.run;
      run.glow = run.glowMax = B.glowDuration * this.mods.glow;
      audio.play('levelup');
      platform.haptic('medium');
      this.burst(it.x, it.y, '#ffe066');
      this.burst(it.x, it.y, '#ffffff');
      this.floatText(it.x, it.y - 24, t('glowGet'), '#ffe066', 20);
      this.hooks.hint(t('glowSoon'));
    }

    gustBlast() {
      const run = this.run;
      run.gusts++; run.gustsSurvived++;
      const p = B.gustPower * this.mods.gust;
      const dir = run.windDir || 1;
      for (const th of this.web.threads.slice()) {
        if (th.broken || Math.random() > p) continue;
        for (let i = 0; i < th.points.length; i += 2) {
          const q = th.points[i];
          this.particles.push({ x: q.x, y: q.y, vx: dir * rand(160, 320), vy: rand(-60, 20), life: 0.8, max: 0.8, color: 'rgba(255,255,255,0.9)', size: rand(1.5, 2.5), kind: 'dot' });
        }
        if (th.stub || Math.random() < 0.5) { th.broken = true; for (const q of th.points) if (q.owner === th) q.owner = null; }
        else this.web.sever(th, Math.floor(rand(0, th.points.length - 1)));
      }
      this.web.prune();
      audio.play('snap');
      platform.haptic('heavy');
      this.shake = 8;
      this.floatText(this.W / 2, this.H * 0.35, t('gustHit'), '#ffffff', 30);
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
      for (const p of this.particles) {
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.kind === 'confetti') { p.vy = Math.min(p.vy + 40 * dt, 110); p.vx += Math.sin(p.life * 6 + p.spin) * 30 * dt; p.spin += dt * 8; }
        else if (!p.float) p.vy += 140 * dt;
        p.vx *= 0.97;
      }
      if (this.shooters) {
        for (const sh of this.shooters) { sh.life -= dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt; }
        this.shooters = this.shooters.filter(sh => sh.life > 0);
      }
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
      const look = root.SH.save.data.look;
      if (look.bg !== 'none') R.drawSeason(g, look.bg, this.W, this.H, this.time, area.night);
      if (this.skyFx) this.drawSkyFx(g);
      if (this.shooters) for (const sh of this.shooters) {
        const gr = g.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 0.18, sh.y - sh.vy * 0.18);
        gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(1, 'rgba(255,250,210,0)');
        g.strokeStyle = gr; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(sh.x - sh.vx * 0.18, sh.y - sh.vy * 0.18); g.stroke();
        g.fillStyle = '#fffbe0'; R.star(g, sh.x, sh.y, 6);
      }
      if (run && this.mods.rain) this.drawRain(g);
      if (run && run.wind) this.drawWind(g, run.wind);

      R.drawThreads(g, this.web.threads, area.night, run && run.glow > 0 && run.bonusTimer <= 0 ? run.glow : 0, this.time, M.part('thread', look.thread));
      const sp = this.spider;
      if (sp.action === 'spin' && sp.from) {
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(sp.from.x, sp.from.y); g.lineTo(sp.x, sp.y); g.stroke();
      }
      R.drawNodes(g, this.web.nodes, this.time, look.knot);
      for (const tr of this.treats) R.drawTreat(g, tr, this.time);
      for (const it of this.specials) R.drawSpool(g, it, this.time);
      for (const ins of this.insects) R.drawInsect(g, ins, this.time);
      if (sp.dizzy && sp.home) {
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(sp.home.x, sp.home.y); g.lineTo(sp.x, sp.y + 14); g.stroke();
      }
      R.drawSpider(g, sp, this.time, this.costume());
      if (sp.action === 'spin') this.drawTapMark(g, sp.tapX, sp.tapY);

      for (const p of this.particles) {
        const a = p.life / p.max;
        g.globalAlpha = a; g.fillStyle = p.color; g.strokeStyle = p.color;
        if (p.kind === 'star') R.star(g, p.x, p.y, p.size);
        else if (p.kind === 'heart') R.heart(g, p.x, p.y, p.size);
        else if (p.kind === 'confetti') { g.save(); g.translate(p.x, p.y); g.rotate(p.spin); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); g.restore(); }
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

    // title-screen sky: the sun winks, the moon goes full with a rabbit on it
    drawSkyFx(g) {
      const fx = this.skyFx, x = this.W * 0.78, y = this.H * 0.13;
      const a = Math.min(1, fx.t * 4, (fx.max - fx.t) * 3);
      g.save(); g.globalAlpha = a;
      if (fx.kind === 'sun') {
        g.strokeStyle = '#8a4a10'; g.fillStyle = '#8a4a10'; g.lineWidth = 2.2; g.lineCap = 'round';
        g.beginPath(); g.arc(-8 + x, y - 4, 4, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        g.beginPath(); g.moveTo(x + 4, y - 5); g.lineTo(x + 12, y - 5); g.stroke();
        g.beginPath(); g.arc(x, y + 5, 8, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
        g.fillStyle = 'rgba(255,120,120,0.6)';
        g.beginPath(); g.arc(x - 14, y + 4, 3.5, 0, R.TAU); g.arc(x + 14, y + 4, 3.5, 0, R.TAU); g.fill();
      } else {
        g.fillStyle = '#fff4c2'; g.beginPath(); g.arc(x, y, 26, 0, R.TAU); g.fill();
        // a rabbit pounding rice cakes, as seen in the moon
        g.fillStyle = 'rgba(190,160,90,0.55)';
        g.beginPath(); g.ellipse(x - 6, y + 6, 8, 7, 0, 0, R.TAU); g.fill();
        g.beginPath(); g.arc(x - 1, y - 3, 5, 0, R.TAU); g.fill();
        g.beginPath(); g.ellipse(x - 3, y - 13, 1.8, 6, -0.25, 0, R.TAU); g.fill();
        g.beginPath(); g.ellipse(x + 2, y - 13, 1.8, 6, 0.25, 0, R.TAU); g.fill();
        g.beginPath(); g.ellipse(x + 11, y + 12, 6, 4, 0, 0, R.TAU); g.fill();
        g.lineWidth = 2; g.strokeStyle = 'rgba(190,160,90,0.55)';
        g.beginPath(); g.moveTo(x + 3, y + 1); g.lineTo(x + 12, y + (Math.sin(fx.t * 8) > 0 ? -2 : 6)); g.stroke();
      }
      g.restore();
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

    drawRain(g) {
      g.strokeStyle = 'rgba(200,225,255,0.45)'; g.lineWidth = 1.2; g.lineCap = 'round';
      g.beginPath();
      for (let i = 0; i < 40; i++) {
        const x = ((i * 137.5 + this.time * 60) % (this.W + 40)) - 20;
        const y = ((i * 89.3 + this.time * 520) % (this.H + 40)) - 20;
        g.moveTo(x, y); g.lineTo(x - 4, y + 14);
      }
      g.stroke();
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
      if (run.score === 0 && !run.tutorial) run.eggs.nap = 1;
      const coins = Math.floor((Math.floor(run.score * B.coinsPerScore) + run.coins) * this.mods.coins);
      save.coins += coins;
      save.exp += run.score;
      let levels = 0;
      while (save.exp >= D.levelExp(save.level)) { save.exp -= D.levelExp(save.level); save.level++; levels++; }
      const dropsBefore = save.drops;
      const isBest = run.score > save.bestScore;
      if (isBest) save.bestScore = run.score;
      save.bestArea = Math.max(save.bestArea, run.maxArea);
      const newDay = run.day > (save.bestDay || 0);
      save.bestDay = Math.max(save.bestDay || 0, run.day);
      save.scores.push({ score: run.score, day: run.day, phase: run.phase, star: run.star, date: Date.now() });
      save.scores.sort((a, b) => b.score - a.score);
      save.scores = save.scores.slice(0, 10);
      for (const k in run.caught) save.caught[k] = (save.caught[k] || 0) + run.caught[k];
      save.plays++;
      if (run.tutorial) save.tutorialDone = true;
      const coinsBefore = save.coins;
      const rewards = M.applyRun(save, run);
      root.SH.save.write();
      platform.submitScore(run.score);
      return {
        score: run.score, isBest, catches: run.catches, maxCombo: run.maxCombo, day: run.day, phase: run.phase, newDay, exp: run.score, coins, levels, before, level: save.level,
        rewards, rewardCoins: save.coins - coinsBefore, drops: save.drops - dropsBefore, star: run.star,
      };
    }
  }

  const FONT = '"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","Arial Rounded MT Bold",system-ui,sans-serif';

  root.SH = root.SH || {};
  root.SH.Game = Game;
  root.SH.FONT = FONT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
