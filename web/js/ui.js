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
      document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { audio.play('button'); this.open(b.dataset.open, b.dataset.howto); }));
      $('faceMain').addEventListener('click', () => { audio.unlock(); audio.play('button'); this.open('mainScr'); });
      $('faceChallenge').addEventListener('click', () => { audio.unlock(); audio.play('button'); this.open('challengeScr'); });
      document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { audio.play('button'); this.closeSheet(b.closest('.screen').id); }));
      $('playBtn').addEventListener('click', () => this.startGame());
      $('sgStart').addEventListener('click', () => this.startStage());
      $('sgRestart').addEventListener('click', () => { $('sgConfirm').hidden = false; });
      $('sgNo').addEventListener('click', () => { $('sgConfirm').hidden = true; });
      $('sgYes').addEventListener('click', () => {
        const d = save.defaults().challenge;
        save.data.challenge = d; save.write();
        $('sgConfirm').hidden = true; audio.play('button'); this.renderChallenge();
      });
      $('fRetry').addEventListener('click', () => this.startStage());
      $('fStages').addEventListener('click', () => { audio.play('button'); this.toTitle(1); });
      $('clHome').addEventListener('click', () => { audio.play('button'); this.toTitle(1); });
      $('retryBtn').addEventListener('click', () => this.startGame());
      $('homeBtn').addEventListener('click', () => { audio.play('button'); this.toTitle(); });
      $('pauseBtn').addEventListener('click', () => this.pause());
      $('resumeBtn').addEventListener('click', () => this.resume());
      $('quitBtn').addEventListener('click', () => {
        audio.play('button'); $('pauseScr').hidden = true; this.game.paused = false; this.game.run.over = true;
        if (this.game.runMode === 'challenge') { this.game.finishStage(false); this.toTitle(1); }
        else this.showResult();
      });
      $('continueBtn').addEventListener('click', () => this.continueGame());
      $('giveUpBtn').addEventListener('click', () => { audio.play('button'); $('overScr').hidden = true; this.showResult(); });
      this.initSettings();
      this.initModeSelect();
      this.refreshTitle();
    },

    applyTexts() {
      document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
      document.title = i18n.lang === 'ja' ? 'クモの巣ハンティング' : 'Spider Hunting';
    },

    open(id, howto) {
      if (id === 'howtoScr') $('howtoBody').textContent = t(howto === 'challenge' ? 'howtoChallenge' : 'howtoBody');
      if (id === 'mainScr' || id === 'challengeScr') { $('sgConfirm').hidden = true; this.refreshTitle(); }
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
      $('tDay').textContent = s.bestDay ? this.game.dayText(s.bestDay) : '—';
      $('mainStat').textContent = `${t('level')} ${s.level} ・ ${t('bestDay')} ${s.bestDay ? this.game.dayText(s.bestDay) : '—'}`;
      const ch = s.challenge, last = root.SH.STAGES.length;
      $('chStat').textContent = ch.allClear ? t('allClear') : `${t('stage')} ${Math.min(ch.stage, last - 1) + 1} / ${last}`;
      $('tLvBar').style.width = Math.min(100, s.exp / D.levelExp(s.level) * 100) + '%';
      document.querySelectorAll('.coinval').forEach(el => { el.textContent = s.coins.toLocaleString(); });
      this.renderChallenge();
    },

    // ---------- title mode select ----------
    // The two modes sit back to back on a drum. Arrows, swipes and the arrow keys turn it
    // half a turn; the angle keeps growing so it always spins the way you pushed.
    modeIdx: 0,
    drumAngle: 0,

    initModeSelect() {
      const wrap = $('drumWrap'), drum = $('drum');
      this.modeIdx = save.data.titleMode === 1 ? 1 : 0;
      this.drumAngle = this.modeIdx * 180;
      this.applyMode(false);
      $('modeNext').addEventListener('click', () => this.turnMode(1));
      $('modePrev').addEventListener('click', () => this.turnMode(-1));
      document.addEventListener('keydown', e => {
        if ($('title').hidden || document.querySelector('.screen.dim:not([hidden])')) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.open(this.modeIdx ? 'challengeScr' : 'mainScr'); }
        else if (e.key === 'ArrowRight') this.turnMode(1);
        else if (e.key === 'ArrowLeft') this.turnMode(-1);
      });
      // drag: the drum follows the finger, then settles on the nearest face
      let drag = null;
      wrap.addEventListener('pointerdown', e => {
        if (!e.isPrimary) return;
        drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, t: performance.now() };
      });
      wrap.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved) {
          if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) { if (Math.abs(dy) > 12) drag = null; return; }
          drag.moved = true;
          drum.classList.add('dragging');
          try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
        const k = Math.max(-1, Math.min(1, dx / wrap.clientWidth));
        drum.style.transform = `translateZ(-70px) rotateY(${this.drumAngle - k * 180}deg)`;
      });
      const end = e => {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag; drag = null;
        if (!d.moved) return;
        drum.classList.remove('dragging');
        const dx = e.clientX - d.x, v = dx / Math.max(1, performance.now() - d.t);
        // swallow the click that follows a drag so buttons on the face don't fire
        const block = ev => { ev.stopPropagation(); ev.preventDefault(); };
        wrap.addEventListener('click', block, { capture: true, once: true });
        setTimeout(() => wrap.removeEventListener('click', block, { capture: true }), 50);
        if (Math.abs(dx) > wrap.clientWidth * 0.22 || Math.abs(v) > 0.5) this.turnMode(dx < 0 ? 1 : -1);
        else this.applyMode(true);
      };
      wrap.addEventListener('pointerup', end);
      wrap.addEventListener('pointercancel', end);
    },

    turnMode(dir) {
      audio.unlock();
      audio.play('spin');
      this.modeIdx = (this.modeIdx + 1) % 2;
      this.drumAngle += dir * 180;
      $('sgConfirm').hidden = true;
      if (save.data.titleMode !== this.modeIdx) { save.data.titleMode = this.modeIdx; save.write(); }
      this.applyMode(true);
    },

    applyMode(animate) {
      const drum = $('drum');
      if (!animate) drum.classList.add('dragging');
      drum.style.transform = `translateZ(-70px) rotateY(${this.drumAngle}deg)`;
      if (!animate) { void drum.offsetWidth; drum.classList.remove('dragging'); }
      const ch = this.modeIdx === 1;
      $('faceMain').inert = ch; $('faceChallenge').inert = !ch;
      $('faceMain').setAttribute('aria-hidden', ch); $('faceChallenge').setAttribute('aria-hidden', !ch);
      $('modeDots').classList.toggle('ch', ch);
      $('modeDots').querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i === this.modeIdx));
    },

    setMode(idx) {
      if (this.modeIdx === idx) return;
      this.modeIdx = idx;
      this.drumAngle = idx * 180;
      if (save.data.titleMode !== idx) { save.data.titleMode = idx; save.write(); }
      this.applyMode(false);
    },

    // ---------- flow ----------
    // ---------- challenge mode ----------
    goalText(goal) {
      const tpl = t('goal')[goal.type];
      const k = goal.type === 'kind' ? t('kindNames')[goal.key] : goal.type === 'type' ? this.insectName(goal.key) : goal.key;
      return tpl.replace('{n}', goal.n).replace('{k}', k);
    },

    fillGoals(ul, states) {
      ul.innerHTML = '';
      for (const gs of states) {
        const li = document.createElement('li');
        if (gs.done) li.className = 'done';
        const a = document.createElement('span'); a.textContent = (gs.done ? '✓ ' : '・') + this.goalText(gs.goal);
        const b = document.createElement('span'); b.className = 'p';
        b.textContent = gs.goal.type === 'survive' ? '' : `${gs.cur}/${gs.target}`;
        li.append(a, b); ul.append(li);
      }
    },

    renderChallenge() {
      const n = save.data.challenge;
      const STAGES = root.SH.STAGES;
      const idx = Math.min(n.stage, STAGES.length - 1);
      const st = STAGES[idx];
      $('sgTitle').textContent = n.allClear ? `${t('allClear')}  ${t('stage')} ${idx + 1}` : `${t('stage')} ${idx + 1} / ${STAGES.length}`;
      $('sgSub').textContent = `${t('areaNames')[st.area]} ・ ${t('timeLimit')} ${st.time}${t('sec')}`;
      $('sgDots').innerHTML = STAGES.map((_, i) => `<i class="${i < n.cleared ? 'done' : ''} ${i === idx ? 'now' : ''}">${i + 1}</i>`).join('');
      this.fillGoals($('sgGoals'), st.goals.map(goal => ({ goal, cur: 0, target: goal.n, done: false })));
      const ups = D.UPGRADES.filter(u => n.upgrades[u.id]).map(u => `<span>${t('upgradeNames')[u.id]} Lv${n.upgrades[u.id]}</span>`);
      $('sgUps').innerHTML = ups.length ? ups.join('') : `<span>${t('none')}</span>`;
      // a random outfit, lent for this stage only (kept for retries, re-rolled on the next stage)
      if (n.costumeStage !== idx || !D.COSTUMES.some(c => c.id === n.costume)) {
        const pool = D.COSTUMES.filter(c => c.id !== n.costume);
        n.costume = pool[Math.floor(Math.random() * pool.length)].id;
        n.costumeStage = idx;
        save.write();
      }
      const dress = D.COSTUMES.find(c => c.id === n.costume);
      $('sgDress').textContent = t('costumeNames')[dress.id];
      const dg = this.prepCanvas($('sgDressCv'), 52);
      R.drawSpider(dg, { x: 26, y: 28, lookX: 0, lookY: 0.3, scale: 0.85, happy: 1 }, 0.5, dress);
    },

    startStage() {
      audio.unlock();
      audio.play('button');
      ['title', 'challengeScr', 'failScr', 'clearScr', 'resultScr', 'overScr', 'pauseScr'].forEach(id => { $(id).hidden = true; });
      $('hud').hidden = false; $('hint').hidden = true;
      $('missionBox').hidden = false; $('bestHud').hidden = true;
      this.hudCache = {};
      this.game.startRun({ stage: Math.min(save.data.challenge.stage, root.SH.STAGES.length - 1) });
    },

    stageClear() {
      const g = this.game;
      const idx = g.stageIdx;
      const r = g.finishStage(true);
      $('hud').hidden = true; $('tutorial').hidden = true; $('hint').hidden = true;
      $('clSub').textContent = `${t('stage')} ${idx + 1}`;
      $('clScore').textContent = r.score.toLocaleString();
      $('clCoins').textContent = '+' + r.coins.toLocaleString();
      $('clLevel').hidden = !r.levels;
      $('clLevel').textContent = `${t('levelUp')} ${t('level')} ${r.level}`;
      const last = idx + 1 >= root.SH.STAGES.length;
      $('clPickLead').textContent = last ? t('allClearSub') : t('pickUpgrade');
      $('clHome').hidden = !last;
      if (last) { $('pickList').innerHTML = ''; $('clSub').textContent = t('allClear'); }
      else this.renderPicks();
      $('clearScr').hidden = false;
      $('clearScr').scrollTop = 0;
      this.refreshTitle();
    },

    renderPicks() {
      const list = $('pickList');
      list.innerHTML = '';
      const ups = save.data.challenge.upgrades;
      for (const u of D.UPGRADES) {
        const lv = ups[u.id] || 0;
        const el = document.createElement('div');
        el.className = 'item';
        const icon = document.createElement('canvas');
        this.drawUpgradeIcon(icon, u.id);
        const mid = document.createElement('div');
        mid.innerHTML = '<div class="name"></div><div class="effect"></div>';
        mid.querySelector('.name').textContent = `${t('upgradeNames')[u.id]}  Lv${lv}`;
        mid.querySelector('.effect').textContent = this.upgradeEffect(u.id, lv, u.max);
        const btn = document.createElement('button');
        btn.className = 'btn small primary';
        btn.textContent = lv >= u.max ? t('max') : t('pick');
        btn.disabled = lv >= u.max;
        btn.addEventListener('click', () => {
          save.data.challenge.upgrades[u.id] = lv + 1;
          save.write(); audio.play('buy');
          $('clearScr').hidden = true;
          this.toTitle(1);
        });
        el.append(icon, mid, btn);
        list.append(el);
      }
    },

    stageFail(reason) {
      const g = this.game;
      const states = g.goalStates();
      const r = g.finishStage(false);
      $('hud').hidden = true; $('tutorial').hidden = true; $('hint').hidden = true;
      $('fReason').textContent = reason === 'time' ? t('failTime') : t('failSilk');
      this.fillGoals($('fGoals'), states);
      $('fCoins').textContent = '+' + r.coins.toLocaleString();
      $('failScr').hidden = false;
      this.refreshTitle();
    },

    startGame() {
      audio.unlock();
      audio.play('button');
      ['title', 'resultScr', 'overScr', 'pauseScr'].forEach(id => { $(id).hidden = true; });
      $('hud').hidden = false;
      $('hint').hidden = true;
      $('missionBox').hidden = true; $('bestHud').hidden = false;
      ['mainScr', 'challengeScr', 'failScr', 'clearScr'].forEach(id => { $(id).hidden = true; });
      this.hudCache = {};
      this.game.startRun();
    },
    // mode 1: back from a challenge stage, straight to the stage menu
    toTitle(mode) {
      if (mode != null) this.setMode(mode);
      ['mainScr', 'challengeScr', 'resultScr', 'overScr', 'pauseScr', 'failScr', 'clearScr'].forEach(id => { $(id).hidden = true; });
      $('hud').hidden = true; $('tutorial').hidden = true; $('hint').hidden = true;
      $('title').hidden = false;
      this.game.startDemo();
      audio.music('title');
      this.refreshTitle();
      if (mode === 1) this.open('challengeScr');
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
      const dayRecord = r.newDay && r.day > 1;
      $('rBest').hidden = !(dayRecord || (r.isBest && r.score > 0));
      $('rBest').textContent = dayRecord ? `${this.game.dayText(r.day)} ${t('newDayRecord')}` : t('newBest');
      $('rCatches').textContent = r.catches;
      $('rCombo').textContent = r.maxCombo;
      $('rArea').textContent = `${this.game.dayText(r.day)}・${t('areaNames')[D.phaseArea(r.phase, r.day)]}`;
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
      const setBar = (id, frac, warn) => {
        const pct = Math.round(Math.max(0, Math.min(1, frac)) * 1000) / 10;
        if (c[id] === pct) return;
        c[id] = pct;
        const bar = $(id);
        bar.firstElementChild.style.width = pct + '%';
        bar.classList.toggle('low', pct < warn);
        bar.classList.toggle('mid', pct >= warn && pct < warn * 2.2);
      };
      setBar('silkBar', run.silk / g.st.maxSilk, 22);
      // the bonus bar doubles as the glowing-silk timer after bonus time
      const glowing = run.glow > 0 && run.bonusTimer <= 0;
      const bonusFrac = run.bonusTimer > 0 ? run.bonusTimer / D.BALANCE.bonusDuration
        : glowing ? run.glow / D.BALANCE.glowDuration : run.bonusGauge / g.bonusNeed();
      const bp = Math.round(bonusFrac * 100) + (glowing ? 1000 : 0);
      if (c.bonus !== bp) {
        c.bonus = bp;
        $('bonusBar').firstElementChild.style.width = Math.round(bonusFrac * 100) + '%';
        $('bonusBar').classList.toggle('full', run.bonusTimer > 0);
        $('bonusBar').classList.toggle('glow', glowing);
        $('bonusLabel').textContent = glowing ? t('glowGauge') : t('bonusGauge');
      }
      if (g.runMode === 'challenge' && g.stage) {
        const states = g.goalStates();
        const key = states.map(x => x.cur + (x.done ? '!' : '')).join(',') + '|' + Math.ceil(run.timeLeft);
        if (c.mission !== key) {
          c.mission = key;
          const tl = Math.ceil(run.timeLeft);
          $('mTime').textContent = `${t('stage')} ${g.stageIdx + 1} ・ ${t('timeLeft')} ${tl}${t('sec')}`;
          $('mTime').classList.toggle('low', tl <= 10);
          this.fillGoals($('mGoals'), states);
        }
      }
      if (c.score !== run.score) { c.score = run.score; $('score').textContent = run.score.toLocaleString(); }
      if (c.combo !== run.combo) {
        const el = $('combo');
        el.textContent = run.combo >= 2 ? run.combo + ' ' + t('combo') : '';
        if (run.combo > (c.combo || 0)) { el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 150); }
        c.combo = run.combo;
      }
      const dayKey = run.day * 10 + g.areaIdx;
      if (c.area !== dayKey) {
        c.area = dayKey;
        const icon = D.AREAS[g.areaIdx].night ? '☾' : '☀';
        $('areaName').textContent = g.runMode === 'challenge' ? `${icon} ${t('areaNames')[g.areaIdx]}` : `${icon} ${g.dayText(run.day)}・${t('areaNames')[g.areaIdx]}`;
      }
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
        const next = D.INSECT_ORDER.filter(k => !D.INSECTS[k].boss).map(k => [k, D.INSECTS[k].weight]).filter(([, w]) => w > now).sort((x, y) => x[1] - y[1])[0];
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
        card.className = 'zcard' + (def.boss ? ' boss' : def.rare ? ' rare' : '');
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
          const times = D.AREAS.map((a, i) => a.table[type] ? t('areaNames')[i] : null).filter(Boolean);
          const h = document.createElement('div'); h.className = 'zname';
          h.textContent = (n ? this.insectName(type) : t('unknown')) + (def.rare ? `  ★${t('rareTag')}` : '');
          const p = document.createElement('div');
          p.textContent = n ? def.note[i18n.lang] || def.note.en : '';
          const m = document.createElement('div'); m.className = 'zmeta';
          m.textContent = `${t('weight')} ${def.weight}` + (n ? ` ・ ${t('score')} ${def.score}` : '') + ` ・ ${t('firstArea')} ${times.length ? times.join('・') : '?'}`;
          const c = document.createElement('div');
          const ok = !def.boss && def.weight <= strength;
          c.className = 'zcatch ' + (def.boss ? 'boss' : ok ? 'ok' : 'ng');
          c.textContent = def.boss ? t('bossOnly') : (ok ? t('canCatch') : t('cantCatch')) + `（${t('threadPower')} ${strength.toFixed(1)}）`;
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
        const b = document.createElement('span'); b.textContent = s.day ? `${this.game.dayText(s.day)}・${t('areaNames')[D.phaseArea(s.phase || 0, s.day)]}` : ''; b.style.color = '#cfc6ee'; b.style.fontSize = '12px';
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
