// DOM side: menus, HUD, banners. The game canvas sits underneath.
(function (root) {
  'use strict';
  const D = root.SH.data;
  const R = root.SH.render;
  const audio = root.SH.audio;
  const i18n = root.SH.i18n;
  const save = root.SH.save;
  const t = k => i18n.t(k);
  const $ = id => document.getElementById(id);

  const ui = {
    game: null,
    hudCache: {},

    init(game) {
      this.game = game;
      this.applyTexts();
      document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { audio.play('button'); this.open(b.dataset.open); }));
      document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { audio.play('button'); this.closeSheet(b.closest('.screen').id); }));
      $('playBtn').addEventListener('click', () => this.startGame());
      $('retryBtn').addEventListener('click', () => this.startGame());
      $('homeBtn').addEventListener('click', () => { audio.play('button'); this.toTitle(); });
      $('pauseBtn').addEventListener('click', () => this.pause());
      $('resumeBtn').addEventListener('click', () => this.resume());
      $('quitBtn').addEventListener('click', () => { audio.play('button'); $('pauseScr').hidden = true; this.game.paused = false; this.game.run.over = true; this.showResult(); });
      $('continueBtn').addEventListener('click', () => this.continueGame());
      $('giveUpBtn').addEventListener('click', () => { audio.play('button'); $('overScr').hidden = true; this.showResult(); });
      this.initSettings();
      this.refreshTitle();
    },

    applyTexts() {
      document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
      document.title = i18n.lang === 'ja' ? 'クモの巣ハンティング' : 'Spider Hunting';
    },

    open(id) {
      if (id === 'upgradeScr') this.renderUpgrades();
      if (id === 'wardrobeScr') this.renderWardrobe();
      if (id === 'zukanScr') this.renderZukan();
      if (id === 'rankScr') this.renderRanking();
      if (id === 'settingsScr') this.renderSettings();
      $(id).hidden = false;
      $(id).scrollTop = 0;
    },
    closeSheet(id) {
      $(id).hidden = true;
      this.refreshTitle();
    },

    refreshTitle() {
      const s = save.data;
      $('tLevel').textContent = s.level;
      $('tCoins').textContent = s.coins.toLocaleString();
      $('tBest').textContent = s.bestScore.toLocaleString();
      $('tLvBar').style.width = Math.min(100, s.exp / D.levelExp(s.level) * 100) + '%';
      document.querySelectorAll('.coinval').forEach(el => { el.textContent = s.coins.toLocaleString(); });
    },

    // ---------- flow ----------
    startGame() {
      audio.unlock();
      audio.play('button');
      ['title', 'resultScr', 'overScr', 'pauseScr'].forEach(id => { $(id).hidden = true; });
      $('hud').hidden = false;
      $('hint').hidden = true;
      this.hudCache = {};
      this.game.startRun();
    },
    toTitle() {
      ['resultScr', 'overScr', 'pauseScr'].forEach(id => { $(id).hidden = true; });
      $('hud').hidden = true; $('tutorial').hidden = true; $('hint').hidden = true;
      $('title').hidden = false;
      this.game.startDemo();
      audio.music('title');
      this.refreshTitle();
    },
    pause() {
      const g = this.game;
      if (g.mode !== 'play' || g.run.over || g.paused) return;
      audio.play('button');
      g.paused = true;
      $('pauseScr').hidden = false;
      audio.stopMusic();
    },
    resume() {
      audio.play('button');
      $('pauseScr').hidden = true;
      this.game.paused = false;
      audio.music(this.game.musicMode());
    },
    gameOver(canContinue) {
      if (canContinue) { $('overScr').hidden = false; }
      else this.showResult();
    },
    continueGame() {
      audio.play('button');
      root.SH.platform.showRewarded().then(ok => {
        $('overScr').hidden = true;
        if (ok) this.game.continueRun(); else this.showResult();
      });
    },
    showResult() {
      const r = this.game.finishRun();
      this.game.mode = 'result';
      $('hud').hidden = true; $('tutorial').hidden = true; $('hint').hidden = true;
      $('rScore').textContent = r.score.toLocaleString();
      $('rBest').hidden = !r.isBest || r.score === 0;
      $('rCatches').textContent = r.catches;
      $('rCombo').textContent = r.maxCombo;
      $('rArea').textContent = t('areaNames')[r.area];
      $('rExp').textContent = '+' + r.exp.toLocaleString();
      $('rCoins').textContent = '+' + r.coins.toLocaleString();
      $('rLevel').hidden = !r.levels;
      $('rLevel').textContent = t('levelUp') + ' ' + t('level') + ' ' + r.before.level + ' → ' + r.level;
      $('resultScr').hidden = false;
      if (r.levels) setTimeout(() => audio.play('levelup'), 400);
      else if (r.isBest) setTimeout(() => audio.play('bonus'), 300);
      this.refreshTitle();
    },

    // ---------- HUD ----------
    updateHud() {
      const g = this.game;
      if (g.mode !== 'play' || !g.run) return;
      const run = g.run, c = this.hudCache;
      const silkPct = Math.round(run.silk / g.st.maxSilk * 1000) / 10;
      if (c.silk !== silkPct) {
        c.silk = silkPct;
        const bar = $('silkBar');
        bar.firstElementChild.style.width = silkPct + '%';
        bar.classList.toggle('low', silkPct < 20);
        bar.classList.toggle('mid', silkPct >= 20 && silkPct < 45);
      }
      const bonusPct = run.bonusTimer > 0 ? run.bonusTimer / D.BALANCE.bonusDuration * 100 : run.bonusGauge / D.BALANCE.bonusNeed * 100;
      const bp = Math.round(bonusPct);
      if (c.bonus !== bp) {
        c.bonus = bp;
        $('bonusBar').firstElementChild.style.width = bp + '%';
        $('bonusBar').classList.toggle('full', run.bonusTimer > 0);
      }
      if (c.score !== run.score) { c.score = run.score; $('score').textContent = run.score.toLocaleString(); }
      if (c.combo !== run.combo) {
        const el = $('combo');
        el.textContent = run.combo >= 2 ? run.combo + ' ' + t('combo') : '';
        if (run.combo > (c.combo || 0)) { el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 150); }
        c.combo = run.combo;
      }
      if (c.area !== g.areaIdx) { c.area = g.areaIdx; $('areaName').textContent = t('areaNames')[g.areaIdx]; }
      if (c.best === undefined) { c.best = save.data.bestScore; $('bestHud').textContent = t('best') + ' ' + save.data.bestScore.toLocaleString(); }
    },

    banner(text, sub, cls) {
      const b = $('banner');
      b.className = '';
      b.querySelector('.big').textContent = text || '';
      b.querySelector('.small').textContent = sub || '';
      b.querySelector('.small').hidden = !sub;
      void b.offsetWidth;
      b.className = 'show ' + (cls || '');
    },
    tutorial(text) {
      const el = $('tutorial');
      el.hidden = !text;
      if (text) el.textContent = text;
    },
    hint(text) {
      const el = $('hint');
      el.textContent = text; el.hidden = false;
      clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => { el.hidden = true; }, 3800);
    },
    toast(text) {
      const el = $('toast');
      el.textContent = text; el.hidden = false;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { el.hidden = true; }, 1400);
    },

    // ---------- upgrade ----------
    insectName(type) { return D.INSECTS[type].name[i18n.lang] || D.INSECTS[type].name.en; },

    // "now -> next" text for each upgrade, so a purchase has a visible payoff
    upgradeEffect(id, lv, max) {
      const B = D.BALANCE, st = this.game.stats();
      const nxt = lv < max;
      const fmt = (a, b, unit) => nxt ? `${a}${unit} → ${b}${unit}` : `${a}${unit}`;
      if (id === 'strength') {
        const now = st.strength, after = now + B.strengthPerUpgrade;
        const next = D.INSECT_ORDER.map(k => [k, D.INSECTS[k].weight]).filter(([, w]) => w > now).sort((x, y) => x[1] - y[1])[0];
        const line = next ? `${t('nextCatch')}: ${this.insectName(next[0])}（${next[1]}）` : t('allCatch');
        return `${t('threadPower')} ${fmt(now.toFixed(1), after.toFixed(1), '')}\n${line}`;
      }
      if (id === 'silk') return fmt(Math.round(st.maxSilk), Math.round(st.maxSilk + B.silkPerUpgrade), '');
      if (id === 'sticky') return fmt(st.struggle.toFixed(1), (st.struggle + B.strugglePerUpgrade).toFixed(1), i18n.lang === 'ja' ? '秒' : 's');
      if (id === 'speed') return fmt(Math.round(st.speed / B.baseSpeed * 100), Math.round((st.speed / B.baseSpeed + B.speedPerUpgrade) * 100), '%');
      if (id === 'appetite') return fmt(Math.round(st.appetite * 100), Math.round((st.appetite + B.appetitePerUpgrade) * 100), '%');
      if (id === 'lure') return `${t('rareTag')} ` + fmt('×' + st.lure.toFixed(1), '×' + (st.lure + B.lurePerUpgrade).toFixed(1), '');
      return '';
    },

    renderUpgrades() {
      const list = $('upgradeList');
      list.innerHTML = '';
      const s = save.data;
      for (const u of D.UPGRADES) {
        const lv = s.upgrades[u.id] || 0;
        const cost = D.upgradeCost(u, lv);
        const el = document.createElement('div');
        el.className = 'item';
        const icon = document.createElement('canvas');
        this.drawUpgradeIcon(icon, u.id);
        const mid = document.createElement('div');
        mid.innerHTML = `<div class="name"></div><div class="desc"></div><div class="effect"></div><div class="pips"></div>`;
        mid.querySelector('.name').textContent = `${t('upgradeNames')[u.id]}  Lv${lv}`;
        mid.querySelector('.desc').textContent = t('upgradeDesc')[u.id];
        mid.querySelector('.effect').textContent = this.upgradeEffect(u.id, lv, u.max);
        mid.querySelector('.pips').innerHTML = Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
        const btn = document.createElement('button');
        btn.className = 'btn small primary';
        if (lv >= u.max) { btn.textContent = t('max'); btn.disabled = true; }
        else {
          btn.textContent = cost.toLocaleString();
          if (s.coins < cost) btn.disabled = true;
          btn.addEventListener('click', () => {
            if (save.data.coins < cost) { this.toast(t('notEnough')); return; }
            save.data.coins -= cost; save.data.upgrades[u.id] = lv + 1;
            save.write(); audio.play('buy');
            this.renderUpgrades(); this.refreshTitle();
          });
        }
        el.append(icon, mid, btn);
        list.append(el);
      }
      this.refreshTitle();
    },

    drawUpgradeIcon(cv, id) {
      const g = this.prepCanvas(cv, 64);
      g.translate(32, 32);
      g.strokeStyle = '#fbfaff'; g.fillStyle = '#fbfaff'; g.lineWidth = 2; g.lineCap = 'round';
      if (id === 'strength') {
        for (let i = 0; i < 3; i++) { g.lineWidth = 1.5 + i * 1.3; g.beginPath(); g.moveTo(-20, -12 + i * 12); g.quadraticCurveTo(0, -4 + i * 12, 20, -12 + i * 12); g.stroke(); }
      } else if (id === 'silk') {
        g.beginPath(); g.arc(0, 0, 16, 0, R.TAU); g.stroke();
        g.beginPath(); for (let a = 0; a < 18; a += 0.25) g.lineTo(Math.cos(a) * a * 0.85, Math.sin(a) * a * 0.85); g.stroke();
      } else if (id === 'sticky') {
        g.fillStyle = '#8fd3ff';
        for (const [x, y, r] of [[-8, -4, 7], [8, 2, 9], [-2, 12, 5]]) { g.beginPath(); g.arc(x, y, r, 0, R.TAU); g.fill(); }
      } else if (id === 'speed') {
        g.lineWidth = 3;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-20 + i * 4, -10 + i * 10); g.lineTo(8 + i * 4, -10 + i * 10); g.stroke(); }
        g.beginPath(); g.moveTo(14, -16); g.lineTo(22, 0); g.lineTo(14, 16); g.stroke();
      } else if (id === 'lure') {
        g.fillStyle = '#ffe066'; R.star(g, -6, -4, 13);
        g.fillStyle = '#8fd3ff'; R.star(g, 12, 10, 7);
        g.fillStyle = '#ff8fb8'; R.star(g, 12, -14, 5);
      } else {
        g.fillStyle = '#ffc94a';
        g.beginPath(); g.arc(0, 2, 16, 0, Math.PI); g.fill();
        g.fillRect(-18, 0, 36, 3);
        g.strokeStyle = '#fbfaff';
        for (const x of [-6, 0, 6]) { g.beginPath(); g.moveTo(x, -6); g.quadraticCurveTo(x + 4, -12, x, -18); g.stroke(); }
      }
    },

    prepCanvas(cv, size) {
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      cv.width = size * dpr; cv.height = size * dpr;
      const g = cv.getContext('2d');
      g.scale(dpr, dpr);
      return g;
    },

    // ---------- wardrobe ----------
    renderWardrobe() {
      const list = $('wardrobeList');
      list.innerHTML = '';
      const s = save.data;
      for (const c of D.COSTUMES) {
        const owned = s.costumes.includes(c.id);
        const el = document.createElement('div');
        el.className = 'item';
        const cv = document.createElement('canvas');
        const g = this.prepCanvas(cv, 64);
        R.drawSpider(g, { x: 32, y: 34, lookX: 0, lookY: 0.3, scale: 1.05, happy: s.costume === c.id ? 1 : 0 }, 0.5, c);
        const mid = document.createElement('div');
        mid.innerHTML = '<div class="name"></div>';
        mid.querySelector('.name').textContent = t('costumeNames')[c.id];
        const btn = document.createElement('button');
        btn.className = 'btn small';
        if (s.costume === c.id) { btn.textContent = t('equipped'); btn.disabled = true; }
        else if (owned) {
          btn.textContent = t('equip');
          btn.addEventListener('click', () => { save.data.costume = c.id; save.write(); audio.play('button'); this.renderWardrobe(); });
        } else {
          btn.textContent = c.price.toLocaleString();
          btn.classList.add('primary');
          if (s.coins < c.price) btn.disabled = true;
          btn.addEventListener('click', () => {
            if (save.data.coins < c.price) { this.toast(t('notEnough')); return; }
            save.data.coins -= c.price; save.data.costumes.push(c.id); save.data.costume = c.id;
            save.write(); audio.play('buy');
            this.renderWardrobe(); this.refreshTitle();
          });
        }
        el.append(cv, mid, btn);
        list.append(el);
      }
      this.refreshTitle();
    },

    // ---------- zukan ----------
    renderZukan() {
      const grid = $('zukanGrid');
      grid.innerHTML = '';
      $('zukanDetail').hidden = true;
      const s = save.data;
      const found = D.INSECT_ORDER.filter(k => s.caught[k]).length;
      $('zukanCount').textContent = `${t('zukanProgress')} ${found} / ${D.INSECT_ORDER.length}`;
      const strength = this.game.stats().strength;
      for (const type of D.INSECT_ORDER) {
        const def = D.INSECTS[type];
        const n = s.caught[type] || 0;
        const card = document.createElement('button');
        card.className = 'zcard' + (def.rare ? ' rare' : '');
        const cv = document.createElement('canvas');
        const g = this.prepCanvas(cv, 72);
        if (!n) g.filter = 'brightness(0) opacity(0.45)';
        const k = 24 / (def.size + (def.kind === 'rhino' || def.kind === 'stag' ? 14 : 8));
        g.translate(def.kind === 'rhino' || def.kind === 'stag' ? 30 : 36, 38); g.scale(k, k);
        R.drawInsect(g, { x: 0, y: 0, vx: 1, def, type, state: 'fly', seed: 1.3, id: 0 }, 0.3);
        const name = document.createElement('div'); name.className = 'name';
        name.textContent = n ? this.insectName(type) : t('unknown');
        const cnt = document.createElement('div'); cnt.className = 'cnt';
        cnt.textContent = n ? t('caughtCount') + ' ' + n : `${t('weight')} ${def.weight}`;
        card.append(cv, name, cnt);
        card.addEventListener('click', () => {
          audio.play('button');
          const d = $('zukanDetail');
          d.hidden = false;
          d.innerHTML = '';
          const areaIdx = D.AREAS.findIndex(a => a.table[type]);
          const h = document.createElement('div'); h.className = 'zname';
          h.textContent = (n ? this.insectName(type) : t('unknown')) + (def.rare ? `  ★${t('rareTag')}` : '');
          const p = document.createElement('div');
          p.textContent = n ? def.note[i18n.lang] || def.note.en : '';
          const m = document.createElement('div'); m.className = 'zmeta';
          m.textContent = `${t('weight')} ${def.weight}` + (n ? ` ・ ${t('score')} ${def.score}` : '') + ` ・ ${t('firstArea')} ${areaIdx >= 0 ? t('areaNames')[areaIdx] : '?'}`;
          const c = document.createElement('div');
          const ok = def.weight <= strength;
          c.className = 'zcatch ' + (ok ? 'ok' : 'ng');
          c.textContent = (ok ? t('canCatch') : t('cantCatch')) + `（${t('threadPower')} ${strength.toFixed(1)}）`;
          d.append(h, p, m, c);
        });
        grid.append(card);
      }
    },

    renderRanking() {
      const list = $('rankList');
      list.innerHTML = '';
      const scores = save.data.scores;
      if (!scores.length) { const li = document.createElement('li'); li.innerHTML = '<span>—</span>'; list.append(li); return; }
      for (const s of scores) {
        const li = document.createElement('li');
        const a = document.createElement('span'); a.textContent = s.score.toLocaleString();
        const b = document.createElement('span'); b.textContent = t('areaNames')[s.area || 0]; b.style.color = '#cfc6ee'; b.style.fontSize = '12px';
        li.append(a, b);
        list.append(li);
      }
    },

    // ---------- settings ----------
    initSettings() {
      const st = () => save.data.settings;
      $('setSound').addEventListener('click', () => { st().sound = !st().sound; audio.setSound(st().sound); save.write(); audio.play('button'); this.renderSettings(); });
      $('setMusic').addEventListener('click', () => { st().music = !st().music; audio.setMusic(st().music); save.write(); this.renderSettings(); });
      $('setVib').addEventListener('click', () => { st().vibration = !st().vibration; save.write(); audio.play('button'); this.renderSettings(); });
      $('setLang').addEventListener('click', () => {
        st().lang = i18n.lang === 'ja' ? 'en' : 'ja';
        i18n.set(st().lang); save.write(); audio.play('button');
        this.applyTexts(); this.renderSettings(); this.refreshTitle();
      });
      $('resetBtn').addEventListener('click', () => { $('resetConfirm').hidden = false; });
      $('resetNo').addEventListener('click', () => { $('resetConfirm').hidden = true; });
      $('resetYes').addEventListener('click', () => {
        save.reset(); save.write();
        $('resetConfirm').hidden = true;
        i18n.set(i18n.detect()); this.applyTexts();
        this.renderSettings(); this.refreshTitle();
        this.game.startDemo();
      });
    },
    renderSettings() {
      const s = save.data.settings;
      $('setSound').textContent = s.sound ? t('on') : t('off');
      $('setMusic').textContent = s.music ? t('on') : t('off');
      $('setVib').textContent = s.vibration ? t('on') : t('off');
      $('setLang').textContent = i18n.lang === 'ja' ? '日本語' : 'English';
    },
  };

  root.SH = root.SH || {};
  root.SH.ui = ui;
})(typeof globalThis !== 'undefined' ? globalThis : this);
