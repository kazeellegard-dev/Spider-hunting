// DOM side: menus, HUD, banners. The game canvas sits underneath.
(function (root) {
  'use strict';
  const D = root.SH.data;
  const R = root.SH.render;
  const audio = root.SH.audio;
  const i18n = root.SH.i18n;
  const save = root.SH.save;
  const M = root.SH.meta;
  const t = k => i18n.t(k);
  const nm = o => (o && (o[i18n.lang] || o.en)) || '';
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
      $('tapGate').addEventListener('click', () => this.gateTap());
      // easter eggs on the title screen: poke the spider, tap the sun or moon
      $('title').addEventListener('pointerdown', e => {
        if (e.target.closest('button, .title-panel')) return;
        const r = $('game').getBoundingClientRect();
        const ev = this.game.demoTap((e.clientX - r.left) / r.width * this.game.W, (e.clientY - r.top) / r.height * this.game.H);
        if (ev === 'sky') this.toast(t(D.AREAS[this.game.areaIdx].night ? 'eggMoon' : 'eggSun'));
        if (ev === 'dizzy' || ev === 'sky') this.demoEgg(ev);
      });
      $('petCv').addEventListener('pointerdown', e => { e.preventDefault(); this.petTap(e); });
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
      $('starPrev').addEventListener('click', () => this.stepStar(-1));
      $('starNext').addEventListener('click', () => this.stepStar(1));
      document.querySelectorAll('#zkTabs button').forEach(b => b.addEventListener('click', () => { audio.play('button'); this.zkTab = b.dataset.zk; this.renderZukan(); }));
      this.initSettings();
      this.initModeSelect();
      this.refreshTitle();
    },

    applyTexts() {
      document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
      document.title = i18n.lang === 'ja' ? 'クモの巣ハンティング' : 'Spider Web Catch';
    },

    open(id, howto) {
      if (id === 'howtoScr') $('howtoBody').textContent = t(howto === 'challenge' ? 'howtoChallenge' : 'howtoBody');
      if (id === 'mainScr' || id === 'challengeScr') { $('sgConfirm').hidden = true; this.refreshTitle(); }
      if (id === 'upgradeScr') this.renderUpgrades();
      if (id === 'chUpScr') this.renderChallengeUpgrades();
      if (id === 'wardrobeScr') this.renderWardrobe();
      if (id === 'exchangeScr') this.renderExchange();
      if (id === 'achScr') this.renderAch();
      if (id === 'zukanScr') { this.zkTab = 'dex'; this.renderZukan(); }
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
      document.querySelectorAll('.dropval').forEach(el => { el.textContent = s.drops.toLocaleString(); });
      $('tTitle').hidden = !s.title;
      $('tTitle').textContent = this.titleName(s.title);
      this.renderStars();
      this.renderOdai();
      this.renderChallenge();
    },

    titleName(id) {
      if (!id) return '';
      if (id.indexOf('fam_') === 0) return t('famTitle').replace('{k}', t('kindNames')[id.slice(4)] || id);
      return nm(M.TITLES[id]);
    },

    // ---------- difficulty stars (normal mode) ----------
    stepStar(dir) {
      const s = save.data, open = M.starsOpen(s);
      const v = Math.max(0, Math.min(open, (s.stars.sel || 0) + dir));
      if (v === s.stars.sel) { audio.play('deny'); return; }
      s.stars.sel = v; save.write(); audio.play('button');
      this.refreshTitle();
    },
    renderStars() {
      const s = save.data, open = M.starsOpen(s);
      const sel = Math.min(s.stars.sel || 0, open);
      $('starName').textContent = sel ? '★' + sel : `${t('starZero')}（★0）`;
      const rules = [];
      for (let i = 1; i <= sel; i++) rules.push(nm(M.STARS[i].rule));
      let line = sel ? rules[rules.length - 1] + (rules.length > 1 ? `（${t('starMore').replace('{n}', rules.length - 1)}）` : '') : '';
      const bonus = t('starBonus').replace('{c}', (1 + sel * 0.2).toFixed(1)).replace('{s}', (1 + sel * 0.1).toFixed(1));
      line = (line ? line + '\n' : '') + (sel ? bonus : '');
      const next = s.stars.cleared >= M.MAX_STAR ? t('starAll')
        : open < M.MAX_STAR ? t('starHint').replace('{d}', M.STAR_CLEAR_DAY).replace('{n}', open + 1)
          : t('starLast').replace('{d}', M.STAR_CLEAR_DAY).replace('{n}', M.MAX_STAR);
      $('starRule').textContent = (line ? line + '\n' : '') + (sel === open ? next : '');
      $('starPrev').disabled = sel <= 0;
      $('starNext').disabled = sel >= open;
      $('starSel').classList.toggle('hot', sel > 0);
    },

    // ---------- today's tasks ----------
    odaiText(task) {
      const def = M.ODAI.find(o => o.id === task.id);
      return nm(def.text).replace('{n}', task.n.toLocaleString()).replace('{k}', task.key ? t('kindNames')[task.key] : '');
    },
    fillOdai(ul, run) {
      const od = M.ensureOdai(save.data);
      ul.innerHTML = '';
      for (const task of od.tasks) {
        const cur = run ? M.odaiProgress(task, run) : task.cur;
        const done = task.done || cur >= task.n;
        const li = document.createElement('li');
        if (done) li.className = 'done';
        const a = document.createElement('span'); a.textContent = (done ? '✓ ' : '・') + this.odaiText(task);
        const b = document.createElement('span'); b.className = 'p'; b.textContent = done ? '💧' + M.ODAI_DROPS : `${cur.toLocaleString()}/${task.n.toLocaleString()}`;
        li.append(a, b); ul.append(li);
      }
      return od;
    },
    renderOdai() {
      const od = this.fillOdai($('odaiList'));
      $('odaiDrops').textContent = `💧 ${save.data.drops.toLocaleString()}` + (od.allDone ? '  ✓' : '');
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
    goalShort(goal) {
      const tpl = t('goalShort')[goal.type];
      const k = goal.type === 'kind' ? t('kindNames')[goal.key] : goal.type === 'type' ? this.insectName(goal.key) : goal.key;
      return tpl.replace('{k}', k);
    },
    goalIcon(goal, size) {
      const EMO = { score: '⭐', combo: '💥', treats: '🍬', boss: '👑', heavy: '⚖️', survive: '⏱️' };
      if (EMO[goal.type]) { const sp = document.createElement('span'); sp.className = 'gi'; sp.textContent = EMO[goal.type]; return sp; }
      const type = goal.type === 'type' ? goal.key : goal.type === 'kind' ? D.INSECT_ORDER.find(k => D.INSECTS[k].kind === goal.key) : 'fly';
      const cv = document.createElement('canvas'); cv.className = 'gi';
      this.drawBug(cv, type, size, false);
      return cv;
    },
    buildMission(states) {
      const box = $('mGoals');
      box.innerHTML = '';
      this.mChips = states.map(gs => {
        const chip = document.createElement('span'); chip.className = 'mchip';
        const lab = document.createElement('b'); lab.textContent = this.goalShort(gs.goal);
        const val = document.createElement('i');
        chip.append(this.goalIcon(gs.goal, 18), lab, val);
        box.append(chip);
        return { chip, val };
      });
      $('missionBox').classList.remove('clear', 'almost');
    },
    // a bug drawn to fit a square canvas (Bugdex cards, mission icons)
    drawBug(cv, type, size, dark, shiny) {
      const def = D.INSECTS[type];
      const g = this.prepCanvas(cv, size);
      if (dark) g.filter = 'brightness(0) opacity(0.45)';
      const big = def.kind === 'rhino' || def.kind === 'stag';
      const k = size / 3 / (def.size + (big ? 14 : 8));
      g.translate(size * (big ? 0.42 : 0.5), size * 0.53); g.scale(k, k);
      R.drawInsect(g, { x: 0, y: 0, vx: 1, def, type, state: 'fly', seed: 1.3, id: 0, shiny: !!shiny }, 0.3);
    },

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
      // a random mix of parts (owned or not), lent for this stage only: kept for retries,
      // re-rolled on the next stage, so players meet looks they may want to get later
      if (n.costumeStage !== idx || !n.look) {
        n.look = M.randomLook();
        n.costumeStage = idx;
        save.write();
      }
      $('sgDress').textContent = this.lookName(n.look);
      $('sgDressNote').textContent = this.lookMissingText(n.look);
      const dg = this.prepCanvas($('sgDressCv'), 52);
      R.drawSpider(dg, { x: 26, y: 30, lookX: 0, lookY: 0.3, scale: 0.8, happy: 1 }, 0.5, M.spiderLook(n.look));
    },

    lookName(look) {
      return ['body', 'hat', 'face'].filter(sl => look[sl] && look[sl] !== 'none').map(sl => nm(M.part(sl, look[sl]).name)).join(' ＋ ');
    },
    priceText(p) { return p.level ? 'Lv' + p.level : p.price ? '🪙' + p.price.toLocaleString() : '💧' + p.drops; },
    // parts of a lent look the player doesn't own yet, with where to get them
    lookMissing(look) {
      return ['body', 'hat', 'face'].filter(sl => look[sl] && look[sl] !== 'none' && !save.data.parts[sl].includes(look[sl])).map(sl => M.part(sl, look[sl]));
    },
    lookMissingText(look) {
      const miss = this.lookMissing(look);
      if (!miss.length) return t('dressOwned');
      return t('dressMissing').replace('{p}', miss.map(p => `${nm(p.name)}（${this.priceText(p)}）`).join('・'));
    },

    startStage() {
      audio.unlock();
      audio.play('button');
      ['title', 'challengeScr', 'failScr', 'clearScr', 'resultScr', 'overScr', 'pauseScr', 'charmScr', 'chUpScr'].forEach(id => { $(id).hidden = true; });
      $('hint').hidden = true;
      $('missionBox').hidden = false; $('bestHud').hidden = true;
      this.showHud(true);
      this.hudCache = {};
      this.game.startRun({ stage: Math.min(save.data.challenge.stage, root.SH.STAGES.length - 1) });
    },

    // the field freezes on the cleared web; a tap (not taken for the first moment, so a
    // tap meant for the web doesn't skip it) opens the details
    stageClear() {
      const g = this.game;
      if (g.mode !== 'play' || !g.run) return;
      g.paused = true;
      $('tutorial').hidden = true; $('hint').hidden = true;
      const gate = $('tapGate');
      gate.classList.remove('ready');
      gate.hidden = false;
      clearTimeout(this.gateTimer);
      this.gateTimer = setTimeout(() => gate.classList.add('ready'), 700);
    },
    gateTap() {
      const gate = $('tapGate');
      if (gate.hidden || !gate.classList.contains('ready')) return;
      gate.hidden = true;
      audio.play('button');
      this.showClear();
    },

    showClear() {
      const g = this.game;
      const idx = g.stageIdx;
      const r = g.finishStage(true);
      this.showHud(false); $('tutorial').hidden = true; $('hint').hidden = true;
      $('clSub').textContent = `${t('stage')} ${idx + 1}`;
      $('clScore').textContent = r.score.toLocaleString();
      $('clCoins').textContent = '+' + r.coins.toLocaleString();
      $('clLevel').hidden = !r.levels;
      $('clLevel').textContent = `${t('levelUp')} ${t('level')} ${r.level}`;
      const last = idx + 1 >= root.SH.STAGES.length;
      this.fillRewards($('clRewards'), r.rewards);
      const look = save.data.challenge.look;
      const miss = look ? this.lookMissing(look) : [];
      $('clDressNote').hidden = !miss.length;
      if (miss.length) $('clDressNote').textContent = `${this.lookName(look)}\n${this.lookMissingText(look)}`;
      $('clPickLead').textContent = last ? t('allClearSub') : t('pickUpgrade');
      $('clHome').hidden = !last;
      if (last) { $('pickList').innerHTML = ''; $('clSub').textContent = t('allClear'); }
      else this.renderPicks();
      $('clearScr').hidden = false;
      $('clearScr').scrollTop = 0;
      this.lockTaps($('clearScr'));
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
          if (btn.closest('.sheet').classList.contains('locked')) return;
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
      this.showHud(false); $('tutorial').hidden = true; $('hint').hidden = true;
      $('fReason').textContent = reason === 'time' ? t('failTime') : t('failSilk');
      this.fillGoals($('fGoals'), states);
      $('fCoins').textContent = '+' + r.coins.toLocaleString();
      $('failScr').hidden = false;
      this.refreshTitle();
    },

    startGame() {
      audio.unlock();
      audio.play('button');
      ['title', 'resultScr', 'overScr', 'pauseScr', 'charmScr'].forEach(id => { $(id).hidden = true; });
      this.pendingCharm = null;
      $('hint').hidden = true;
      $('missionBox').hidden = true; $('bestHud').hidden = false;
      ['mainScr', 'challengeScr', 'failScr', 'clearScr'].forEach(id => { $(id).hidden = true; });
      this.showHud(true);
      this.hudCache = {};
      this.game.startRun();
    },
    // mode 1: back from a challenge stage, straight to the stage menu
    toTitle(mode) {
      if (mode != null) this.setMode(mode);
      ['mainScr', 'challengeScr', 'resultScr', 'overScr', 'pauseScr', 'failScr', 'clearScr', 'charmScr'].forEach(id => { $(id).hidden = true; });
      this.pendingCharm = null;
      $('tapGate').hidden = true;
      this.showHud(false); $('tutorial').hidden = true; $('hint').hidden = true;
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
      this.pet = { n: 0, hearts: [], t: 0, purr: 0 };
      this.renderPauseInfo();
      $('pauseScr').hidden = false;
      audio.stopMusic();
    },
    resume() {
      if (!$('charmScr').hidden || $('pauseScr').hidden) return;
      audio.play('button');
      $('pauseScr').hidden = true;
      this.game.paused = false;
      audio.music(this.game.musicMode());
      if (this.pendingCharm) { const c = this.pendingCharm; this.pendingCharm = null; this.charmPick(c); }
    },

    // the whole mission (challenge) or the run's charms, weather and tasks (normal)
    renderPauseInfo() {
      const g = this.game, run = g.run, box = $('pauseInfo');
      box.innerHTML = '';
      const section = (label, node) => {
        const d = document.createElement('div'); d.className = 'goalbox';
        const l = document.createElement('div'); l.className = 'glabel'; l.textContent = label;
        d.append(l, node); box.append(d);
      };
      if (g.runMode === 'challenge' && g.stage) {
        const ul = document.createElement('ul'); ul.className = 'goals';
        this.fillGoals(ul, g.goalStates());
        section(`${t('goalsTitle')} ・ ${t('stage')} ${g.stageIdx + 1} ・ ${t('timeLeft')} ${Math.ceil(run.timeLeft)}${t('sec')}`, ul);
        return;
      }
      const w = M.WEATHERS.find(x => x.id === run.weather);
      const wd = document.createElement('div'); wd.className = 'pline';
      wd.textContent = `${w.icon} ${nm(w.name)}：${nm(w.desc)}` + (run.star ? `\n★${run.star}` : '');
      section(t('pauseWeather'), wd);
      section(t('pauseCharms'), this.charmChips(run));
      const ul = document.createElement('ul'); ul.className = 'goals';
      this.fillOdai(ul, run);
      section(t('odaiTitle'), ul);
    },

    charmChips(run) {
      const wrap = document.createElement('div'); wrap.className = 'chips';
      const ids = Object.keys(run.charms || {});
      if (!ids.length) { const sp = document.createElement('span'); sp.textContent = t('none2'); wrap.append(sp); }
      for (const id of ids) {
        const c = M.CHARMS.find(x => x.id === id);
        const sp = document.createElement('span');
        sp.textContent = `${c.icon} ${nm(c.name)}` + (run.charms[id] > 1 ? ` ×${run.charms[id]}` : '');
        wrap.append(sp);
      }
      return wrap;
    },

    // dawn charm: the game waits while the player picks one of three
    charmPick(choices) {
      const g = this.game;
      if (g.mode !== 'play' || !g.run || g.run.over) return;
      if (!$('pauseScr').hidden || !$('overScr').hidden) { this.pendingCharm = choices; return; }
      g.paused = true;
      $('charmTitle').textContent = t('charmTitle').replace('{n}', g.run.day);
      const list = $('charmList');
      list.innerHTML = '';
      for (const id of choices) {
        const c = M.CHARMS.find(x => x.id === id);
        const have = g.run.charms[id] || 0;
        const b = document.createElement('button');
        b.className = 'charmcard';
        b.innerHTML = '<span class="cicon"></span><span class="cname"></span><span class="cdesc"></span>';
        b.querySelector('.cicon').textContent = c.icon;
        b.querySelector('.cname').textContent = nm(c.name) + (have ? `  （${t('charmLv').replace('{n}', have)}）` : '');
        b.querySelector('.cdesc').textContent = nm(c.desc);
        b.addEventListener('click', () => {
          if ($('charmScr').hidden || b.closest('.sheet').classList.contains('locked')) return;
          $('charmScr').hidden = true;
          g.paused = false;
          g.applyCharm(id);
        });
        list.append(b);
      }
      const have = $('charmHave');
      have.innerHTML = '';
      if (Object.keys(g.run.charms).length) {
        const l = document.createElement('span'); l.className = 'lbl'; l.textContent = t('charmHave');
        have.append(l, ...this.charmChips(g.run).children);
      }
      $('charmScr').hidden = false;
      $('charmScr').scrollTop = 0;
      this.lockTaps($('charmScr'), 1000);
      audio.play('bonus');
    },
    gameOver(canContinue) {
      $('charmScr').hidden = true; this.pendingCharm = null;
      if (canContinue) {
        $('continueBtn').textContent = t(root.SH.platform.continueHasAd ? 'continueAdBtn' : 'continueBtn');
        $('overScr').hidden = false;
        this.lockTaps($('overScr'), 800); // a tap meant for the web must not start an ad
      }
      else this.showResult();
    },
    continueGame() {
      const scr = $('overScr').querySelector('.sheet');
      if (scr.classList.contains('locked')) return;
      clearTimeout(scr.unlockTimer);
      scr.classList.add('locked'); // no double taps while the ad opens
      audio.play('button');
      root.SH.platform.showContinueAd().then(ok => {
        scr.classList.remove('locked');
        // Closed the rewarded ad early: no continue, stay on this sheet so they can try again or give up.
        if (!ok) { this.lockTaps($('overScr'), 600); return; }
        $('overScr').hidden = true;
        this.game.continueRun();
      });
    },
    showResult() {
      const r = this.game.finishRun();
      this.game.mode = 'result';
      this.showHud(false); $('tutorial').hidden = true; $('hint').hidden = true;
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
      $('rStar').textContent = r.star ? '★' + r.star : t('starZero');
      $('rNap').hidden = r.score !== 0;
      if (r.score === 0) this.drawNap($('napCv'));
      this.fillRewards($('rRewards'), r.rewards, r.drops);
      $('resultScr').hidden = false;
      $('resultScr').scrollTop = 0;
      if (r.levels) setTimeout(() => audio.play('levelup'), 400);
      else if (r.isBest) setTimeout(() => audio.play('bonus'), 300);
      this.refreshTitle();
    },

    // ---------- easter eggs ----------
    // found outside a run (title screen): counted and rewarded right away
    demoEgg(key) {
      const s = save.data;
      if ((s.eggs || {})[key]) return;
      M.addEgg(s, key);
      const rw = M.checkRewards(s);
      save.write();
      // after the sun / moon line has had its moment
      for (const r of rw) if (r.kind === 'ach') setTimeout(() => this.toast(`🏅 ${t('eggFound').replace('{t}', nm(r.a.text))}  🪙${r.a.coins}`), key === 'sky' ? 1500 : 0);
      this.refreshTitle();
    },
    // the spider on the break sheet: a few strokes and it purrs
    petTap(e) {
      const p = this.pet; if (!p) return;
      const r = $('petCv').getBoundingClientRect();
      p.n++;
      p.hearts.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: 0 });
      audio.play('pop', p.n);
      if (p.n === 3) {
        p.purr = 2.5;
        audio.play('bonus');
        const run = this.game.run;
        if (run) run.eggs.pet = (run.eggs.pet || 0) + 1;
      }
    },
    tick(dt) {
      if (!this.pet || $('pauseScr').hidden) return;
      const p = this.pet, W = 88, H = 64;
      p.t += dt; if (p.purr > 0) p.purr -= dt;
      const g = this.prepCanvas($('petCv'), W, H);
      const sp = { x: W / 2, y: H / 2 + 6, lookX: 0, lookY: 0.2, scale: 1.25, happy: p.n ? 1 : 0, hurt: 0 };
      if (p.purr > 0) { sp.x += Math.sin(p.t * 40) * 0.8; sp.smug = 1; }
      R.drawSpider(g, sp, p.t, this.game.costume());
      for (const h of p.hearts) {
        h.t += dt;
        g.globalAlpha = Math.max(0, 1 - h.t);
        g.fillStyle = '#ff6f9a'; R.heart(g, h.x, h.y - h.t * 30, 5);
      }
      g.globalAlpha = 1;
      p.hearts = p.hearts.filter(h => h.t < 1);
      if (p.purr > 0) {
        g.font = `900 11px ${getComputedStyle(document.body).fontFamily}`; g.textAlign = 'center';
        g.fillStyle = '#fff3b0'; g.fillText(t('petPurr'), W / 2, 10);
      }
    },
    drawNap(cv) {
      const W = 160, H = 90, g = this.prepCanvas(cv, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(10, 70); g.quadraticCurveTo(W / 2, 84, W - 10, 70); g.stroke();
      R.drawSpider(g, { x: W / 2, y: 58, lookX: 0, lookY: 0, scale: 1.3, sleep: true }, 0.5, this.game.costume());
    },

    // ---------- HUD ----------
    // the HUD is a band above the field; the field is re-measured right away so a run
    // starts on the final size (not squashed by a later resize)
    showHud(on) {
      if ($('hud').hidden === !on) return;
      $('hud').hidden = !on;
      if (root.SH.relayout) root.SH.relayout();
    },
    // buttons on a sheet that pops up during play ignore taps for a moment
    lockTaps(scr, ms = 700) {
      const sheet = scr.querySelector('.sheet');
      sheet.classList.add('locked');
      clearTimeout(sheet.unlockTimer);
      sheet.unlockTimer = setTimeout(() => sheet.classList.remove('locked'), ms);
    },
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
        // one slim line: time + an icon chip per goal; the full text is on the start and pause screens
        const states = g.goalStates();
        if (c.missionStage !== run) { c.missionStage = run; this.buildMission(states); }
        const key = states.map(x => x.cur + (x.done ? '!' : '')).join(',') + '|' + Math.ceil(run.timeLeft);
        if (c.mission !== key) {
          c.mission = key;
          const tl = Math.ceil(run.timeLeft);
          $('mTime').textContent = '⏱' + tl;
          $('mTime').classList.toggle('low', tl <= 10);
          states.forEach((gs, i) => {
            const ch = this.mChips[i];
            ch.val.textContent = gs.goal.type === 'survive' ? '' : `${gs.cur}/${gs.target}`;
            if (ch.chip.classList.contains('done') !== gs.done) {
              ch.chip.classList.toggle('done', gs.done);
              if (gs.done) { ch.chip.classList.add('pop'); setTimeout(() => ch.chip.classList.remove('pop'), 400); }
            }
          });
          const clear = states.every(gs => gs.done || gs.goal.type === 'survive') && states.some(gs => gs.goal.type !== 'survive');
          $('missionBox').classList.toggle('clear', clear && !states.some(gs => gs.goal.type === 'survive'));
          $('missionBox').classList.toggle('almost', clear && states.some(gs => gs.goal.type === 'survive'));
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

    // new achievements, sets, tasks and titles earned by a run
    fillRewards(ul, rewards, drops) {
      ul.innerHTML = '';
      const add = (text, cls) => { const li = document.createElement('li'); li.textContent = text; if (cls) li.className = cls; ul.append(li); };
      for (const rw of rewards || []) {
        if (rw.kind === 'ach') {
          const a = rw.a;
          add(`🏅 ${t('rwAch')}${nm(a.text).replace('{n}', a.n.toLocaleString())}  🪙${a.coins.toLocaleString()}` + (a.drops ? ` 💧${a.drops}` : ''));
          if (a.part) add('🎁 ' + t('rwPart').replace('{p}', nm(M.part(a.part.slot, a.part.id).name)), 'title');
          if (a.title) add('👑 ' + t('rwTitle').replace('{t}', this.titleName(a.title)), 'title');
        } else if (rw.kind === 'set') {
          add(`🏆 ${t('rwSet')}${t('kindNames')[rw.family]}  🪙${M.SET_REWARD.coins} 💧${M.SET_REWARD.drops}`);
          add('👑 ' + t('rwTitle').replace('{t}', this.titleName('fam_' + rw.family)), 'title');
        } else if (rw.kind === 'odai') add(`💧 ${t('rwOdai')}${this.odaiText(rw.task)}  💧${M.ODAI_DROPS}`);
        else if (rw.kind === 'odaiAll') add(`💧 ${t('rwOdaiAll')}  💧${M.ODAI_ALL_BONUS}`, 'title');
      }
      if (drops) add(`${t('dropsGot')}  💧+${drops}`, 'title');
      ul.hidden = !ul.children.length;
      if (rewards && rewards.length) setTimeout(() => audio.play('coin'), 700);
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

    // same rows as the normal upgrade list, but read-only and showing the challenge picks
    renderChallengeUpgrades() {
      const list = $('chUpList');
      list.innerHTML = '';
      const ups = save.data.challenge.upgrades;
      for (const u of D.UPGRADES) {
        const lv = ups[u.id] || 0;
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
        el.append(icon, mid);
        list.append(el);
      }
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

    prepCanvas(cv, size, height) {
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      cv.width = size * dpr; cv.height = (height || size) * dpr;
      const g = cv.getContext('2d');
      g.scale(dpr, dpr);
      return g;
    },

    // ---------- wardrobe: parts, silk, knots, seasons, titles ----------
    wdTab: 'body',
    renderWardrobe() {
      const s = save.data;
      const tabs = $('wdTabs');
      tabs.innerHTML = '';
      for (const slot of M.SLOTS.concat('title')) {
        const b = document.createElement('button');
        b.textContent = t('slotNames')[slot];
        if (slot === this.wdTab) b.className = 'on';
        b.addEventListener('click', () => { audio.play('button'); this.wdTab = slot; this.renderWardrobe(); });
        tabs.append(b);
      }
      this.drawPreview($('wdPreview'), s.look);
      const list = $('wardrobeList');
      list.innerHTML = '';
      if (this.wdTab === 'title') { this.renderTitles(list); this.refreshTitle(); return; }
      const slot = this.wdTab;
      for (const p of M.PARTS[slot]) list.append(this.partRow(slot, p, 'coins'));
      this.refreshTitle();
    },

    // one row in the wardrobe or the exchange: icon, name, price / equip button
    partRow(slot, p, shop) {
      const s = save.data;
      const owned = s.parts[slot].includes(p.id);
      const el = document.createElement('div');
      el.className = 'item';
      const cv = document.createElement('canvas');
      this.drawPartIcon(cv, slot, p.id);
      const mid = document.createElement('div');
      mid.innerHTML = '<div class="name"></div><div class="desc"></div>';
      mid.querySelector('.name').textContent = nm(p.name);
      const note = shop === 'drops' ? t('slotNames')[slot] : p.level ? t('levelOnly').replace('{n}', p.level) : !p.price && p.drops ? t('dropsOnly') + `（💧${p.drops}）` : p.drops && !owned ? t('alsoDrops').replace('{n}', p.drops) : '';
      mid.querySelector('.desc').textContent = note;
      const btn = document.createElement('button');
      btn.className = 'btn small';
      const wear = () => { save.data.look[slot] = p.id; save.write(); audio.play('button'); this.rerenderShop(); };
      if (s.look[slot] === p.id) { btn.textContent = t('equipped'); btn.disabled = true; }
      else if (owned) { btn.textContent = t('equip'); btn.addEventListener('click', wear); }
      else if (p.level) { btn.textContent = t('levelLock').replace('{n}', p.level); btn.disabled = true; }
      else {
        const useDrops = shop === 'drops' || !p.price;
        const cost = useDrops ? p.drops : p.price;
        btn.textContent = (useDrops ? '💧' : '🪙') + cost.toLocaleString();
        btn.classList.add('primary');
        if (useDrops) btn.classList.add('drop');
        if ((useDrops ? s.drops : s.coins) < cost) btn.disabled = true;
        btn.addEventListener('click', () => {
          if (!M.buyPart(save.data, slot, p.id, useDrops ? 'drops' : 'coins')) { this.toast(t(useDrops ? 'notEnoughDrops' : 'notEnough')); return; }
          save.data.look[slot] = p.id;
          save.write(); audio.play('buy');
          this.rerenderShop();
        });
      }
      el.append(cv, mid, btn);
      return el;
    },
    rerenderShop() {
      if (!$('wardrobeScr').hidden) this.renderWardrobe();
      if (!$('exchangeScr').hidden) this.renderExchange();
      this.refreshTitle();
    },

    renderTitles(list) {
      const s = save.data;
      for (const id of s.titles) {
        const el = document.createElement('div');
        el.className = 'item notile';
        const mid = document.createElement('div');
        mid.innerHTML = '<div class="name"></div>';
        mid.querySelector('.name').textContent = '👑 ' + this.titleName(id);
        const btn = document.createElement('button');
        btn.className = 'btn small';
        if (s.title === id) { btn.textContent = t('equipped'); btn.disabled = true; }
        else {
          btn.textContent = t('equip');
          btn.addEventListener('click', () => { save.data.title = id; save.write(); audio.play('button'); this.renderWardrobe(); });
        }
        el.append(mid, btn);
        list.append(el);
      }
      const total = Object.keys(M.TITLES).length + M.FAMILIES.length;
      const p = document.createElement('p'); p.className = 'lead';
      p.textContent = t('titleLocked').replace('{n}', Math.max(0, total - s.titles.length));
      list.append(p);
    },

    // dew-drop exchange: drop-only looks and the priciest coin looks
    renderExchange() {
      const list = $('exchangeList');
      list.innerHTML = '';
      for (const slot of M.SLOTS) for (const p of M.PARTS[slot]) if (p.drops) list.append(this.partRow(slot, p, 'drops'));
      this.refreshTitle();
    },

    drawPartIcon(cv, slot, id) {
      const g = this.prepCanvas(cv, 64);
      const look = Object.assign({}, save.data.look);
      if (slot === 'body' || slot === 'hat' || slot === 'face') {
        look[slot] = id;
        if (slot !== 'body') look.body = 'classic';
        R.drawSpider(g, { x: 32, y: slot === 'hat' ? 40 : 35, lookX: 0, lookY: 0.3, scale: slot === 'body' ? 1.05 : 1.15, happy: 1 }, 0.5, M.spiderLook(look));
      } else if (slot === 'thread' || slot === 'knot') {
        const sk = slot === 'thread' ? M.part('thread', id) : M.part('thread', look.thread);
        const th = this.fakeWeb(32, 32, 26);
        R.drawThreads(g, th.threads, false, 0, 0.5, sk);
        R.drawNodes(g, th.nodes, 0.5, slot === 'knot' ? id : look.knot);
      } else if (slot === 'bg') {
        const bg = R.makeBackground(D.AREAS[1], 128, 128, 1, id);
        g.drawImage(bg, 0, 0, 64, 64);
      }
    },
    // a little hub-and-spoke web for previews
    fakeWeb(cx, cy, r) {
      const nodes = [{ x: cx, y: cy, id: 1 }], threads = [];
      const line = (a, b, id) => {
        const pts = [];
        for (let i = 0; i <= 4; i++) pts.push({ x: a.x + (b.x - a.x) * i / 4, y: a.y + (b.y - a.y) * i / 4 + Math.sin(i / 4 * Math.PI) * 1.5 });
        threads.push({ id, points: pts });
      };
      const ring = [];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i / 6 * Math.PI * 2;
        const n = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, id: i + 2, tie: i % 2 === 0 };
        nodes.push(n); ring.push(n); line(nodes[0], n, i + 1);
      }
      for (let i = 0; i < 6; i++) line(ring[i], ring[(i + 1) % 6], i + 10);
      return { nodes, threads };
    },
    drawPreview(cv, look) {
      const W = 300, H = 140;
      const g = this.prepCanvas(cv, W, H);
      const night = (look.thread === 'nightglow' || look.thread === 'aurora');
      const bg = R.makeBackground(D.AREAS[night ? 3 : 1], W * 2, H * 2, 1, look.bg);
      g.drawImage(bg, 0, 0, W, H);
      if (look.bg !== 'none') R.drawSeason(g, look.bg, W, H, 3.2, night);
      const web = this.fakeWeb(W / 2, H / 2 + 4, 52);
      R.drawThreads(g, web.threads, night, 0, 0.5, M.part('thread', look.thread));
      R.drawNodes(g, web.nodes, 0.5, look.knot);
      R.drawSpider(g, { x: W / 2, y: H / 2 + 4, lookX: 0, lookY: 0.3, scale: 1.3, happy: 1 }, 0.5, M.spiderLook(look));
    },

    // ---------- achievements ----------
    renderAch() {
      const s = save.data;
      const list = $('achList');
      list.innerHTML = '';
      const done = M.ACHIEVEMENTS.filter(a => s.ach[a.id]).length;
      $('achCount').textContent = t('achCount').replace('{a}', done).replace('{b}', M.ACHIEVEMENTS.length);
      // one row per line of tiers, showing the next tier to reach
      const lines = [];
      for (const a of M.ACHIEVEMENTS) { let l = lines.find(x => x.stat === a.stat); if (!l) lines.push(l = { stat: a.stat, tiers: [] }); l.tiers.push(a); }
      for (const l of lines) {
        if (l.tiers[0].secret) {
          // secret achievements stay "???" until found
          const a = l.tiers[0], got = !!s.ach[a.id];
          const el = document.createElement('div');
          el.className = 'item notile ach secret' + (got ? ' complete' : '');
          const mid = document.createElement('div');
          mid.innerHTML = '<div class="name"></div><div class="desc"></div>';
          mid.querySelector('.name').textContent = got ? `🔮 ${nm(a.text)}` : t('unknown');
          mid.querySelector('.desc').textContent = got ? `${t('secretTag')} ・ 🪙${a.coins}` + (a.title ? ` 👑${this.titleName(a.title)}` : '') : `${t('secretTag')} ・ ${t('secretHint')}`;
          el.append(mid);
          list.append(el);
          continue;
        }
        const next = l.tiers.find(a => !s.ach[a.id]);
        const a = next || l.tiers[l.tiers.length - 1];
        const v = M.statValue(s, l.stat);
        const el = document.createElement('div');
        el.className = 'item notile ach' + (next ? '' : ' complete');
        const mid = document.createElement('div');
        mid.innerHTML = '<div class="name"></div><div class="desc"></div><div class="abar"><i></i></div><div class="pips"></div>';
        mid.querySelector('.name').textContent = nm(a.text).replace('{n}', a.n.toLocaleString());
        const reward = `🪙${a.coins.toLocaleString()}` + (a.drops ? ` 💧${a.drops}` : '') + (a.part ? ` 🎁${nm(M.part(a.part.slot, a.part.id).name)}` : '') + (a.title ? ` 👑${this.titleName(a.title)}` : '');
        mid.querySelector('.desc').textContent = next ? `${Math.min(v, a.n).toLocaleString()} / ${a.n.toLocaleString()}  ・ ${reward}` : t('achComplete');
        mid.querySelector('.abar i').style.width = (next ? Math.min(100, v / a.n * 100) : 100) + '%';
        mid.querySelector('.pips').innerHTML = l.tiers.map(x => `<i class="${s.ach[x.id] ? 'on' : ''}"></i>`).join('');
        el.append(mid);
        list.append(el);
      }
    },

    // ---------- zukan ----------
    zkTab: 'dex',
    renderZukan() {
      const grid = $('zukanGrid');
      grid.innerHTML = '';
      $('zukanDetail').hidden = true;
      document.querySelectorAll('#zkTabs button').forEach(b => b.classList.toggle('on', b.dataset.zk === this.zkTab));
      const s = save.data;
      const sets = this.zkTab === 'sets';
      grid.hidden = sets; $('zukanSets').hidden = !sets;
      if (sets) { this.renderSets(); return; }
      const shinyTab = this.zkTab === 'shiny';
      if (shinyTab) {
        const found = D.INSECT_ORDER.filter(k => s.dex.shiny[k]).length;
        $('zukanCount').textContent = `${t('shinyCount')} ${found} / ${D.INSECT_ORDER.length}`;
      } else {
        const found = D.INSECT_ORDER.filter(k => s.caught[k]).length;
        const gold = D.INSECT_ORDER.filter(k => M.dexRank(k, s.caught[k] || 0) >= 3).length;
        $('zukanCount').textContent = `${t('zukanProgress')} ${found} / ${D.INSECT_ORDER.length}  ・ ${t('rankNames')[3]} ${gold}`;
      }
      const strength = this.game.stats().strength;
      for (const type of D.INSECT_ORDER) {
        const def = D.INSECTS[type];
        const n = shinyTab ? s.dex.shiny[type] || 0 : s.caught[type] || 0;
        const card = document.createElement('button');
        card.className = 'zcard' + (def.boss ? ' boss' : def.rare ? ' rare' : '') + (shinyTab ? ' shiny' : '');
        const cv = document.createElement('canvas');
        this.drawBug(cv, type, 72, !n, shinyTab);
        const name = document.createElement('div'); name.className = 'name';
        name.textContent = n ? this.insectName(type) : t('unknown');
        const cnt = document.createElement('div'); cnt.className = 'cnt';
        cnt.textContent = n ? t('caughtCount') + ' ' + n : shinyTab ? '' : `${t('weight')} ${def.weight}`;
        card.append(cv, name, cnt);
        if (!shinyTab) {
          // medals: catch rank, biggest gold, smallest gold
          const rank = M.dexRank(type, n), gold = M.sizeGold(type);
          const med = document.createElement('div'); med.className = 'medals';
          med.innerHTML = `<i class="r${rank}"></i><i class="sz ${s.dex.big[type] >= gold.big ? 'g' : ''}">大</i><i class="sz ${s.dex.small[type] && s.dex.small[type] <= gold.small ? 'g' : ''}">小</i>`;
          card.append(med);
        }
        card.addEventListener('click', () => {
          audio.play('button');
          const d = $('zukanDetail');
          d.hidden = false;
          d.innerHTML = '';
          const caught = s.caught[type] || 0;
          const times = D.AREAS.map((a, i) => a.table[type] ? t('areaNames')[i] : null).filter(Boolean);
          const h = document.createElement('div'); h.className = 'zname';
          h.textContent = (caught ? this.insectName(type) : t('unknown')) + (def.rare ? `  ★${t('rareTag')}` : '') + (shinyTab && n ? ` ✨${t('zkShiny')}` : '');
          const p = document.createElement('div');
          p.textContent = shinyTab ? t('shinyLead') : caught ? def.note[i18n.lang] || def.note.en : '';
          const m = document.createElement('div'); m.className = 'zmeta';
          m.textContent = `${t('weight')} ${def.weight}` + (caught ? ` ・ ${t('score')} ${def.score}` : '') + ` ・ ${t('firstArea')} ${times.length ? times.join('・') : '?'}`;
          // catch rank and size records with this bug's own gold lines
          const lines = M.rankLines(type), rank = M.dexRank(type, caught), gold = M.sizeGold(type);
          const rk = document.createElement('div'); rk.className = 'zrank';
          rk.textContent = `${t('caughtCount')} ${caught} ・ ` + (rank >= 3 ? t('rankMax') : t('rankNext').replace('{r}', t('rankNames')[rank + 1]).replace('{n}', lines[rank] - caught));
          const sz = document.createElement('div'); sz.className = 'zsize';
          const big = s.dex.big[type], small = s.dex.small[type];
          sz.innerHTML = '<div></div><div></div>';
          sz.children[0].textContent = `${s.dex.big[type] >= gold.big ? '🥇' : '・'}${t('sizeMax')} ${big ? big + 'mm' : t('notYet')}（${t('goldBig').replace('{v}', gold.big)}）`;
          sz.children[1].textContent = `${small && small <= gold.small ? '🥇' : '・'}${t('sizeMin')} ${small ? small + 'mm' : t('notYet')}（${t('goldSmall').replace('{v}', gold.small)}）`;
          const c = document.createElement('div');
          const ok = !def.boss && def.weight <= strength;
          c.className = 'zcatch ' + (def.boss ? 'boss' : ok ? 'ok' : 'ng');
          c.textContent = def.boss ? t('bossOnly') : (ok ? t('canCatch') : t('cantCatch')) + `（${t('threadPower')} ${strength.toFixed(1)}）`;
          d.append(h, p, m, rk, sz, c);
        });
        grid.append(card);
      }
      if (!shinyTab) {
        // secret bugs: an empty frame with a faint shadow until caught
        const sep = document.createElement('div'); sep.className = 'zsep'; sep.textContent = '🔮 ' + t('secretBugs');
        grid.append(sep);
        for (const type of D.SECRET_BUGS) {
          const n = s.caught[type] || 0;
          const card = document.createElement('button');
          card.className = 'zcard secret';
          const cv = document.createElement('canvas');
          this.drawBug(cv, type, 72, !n);
          if (!n) cv.style.opacity = '0.35';
          const name = document.createElement('div'); name.className = 'name';
          name.textContent = n ? this.insectName(type) : t('unknown');
          const cnt = document.createElement('div'); cnt.className = 'cnt';
          cnt.textContent = n ? t('caughtCount') + ' ' + n : t('secretTag');
          card.append(cv, name, cnt);
          card.addEventListener('click', () => {
            audio.play('button');
            const d = $('zukanDetail');
            d.hidden = false; d.innerHTML = '';
            const h = document.createElement('div'); h.className = 'zname';
            h.textContent = n ? this.insectName(type) : t('unknown');
            const p = document.createElement('div');
            p.textContent = n ? nm(D.INSECTS[type].note) : t('secretBugNote');
            d.append(h, p);
          });
          grid.append(card);
        }
      }
    },

    // family sets: all bugs of a family at gold rank
    renderSets() {
      const s = save.data, list = $('zukanSets');
      list.innerHTML = '';
      const done = M.FAMILIES.filter(f => s.sets[f]).length;
      $('zukanCount').textContent = `${t('zkSets')} ${done} / ${M.FAMILIES.length}`;
      const lead = document.createElement('p'); lead.className = 'lead'; lead.textContent = t('setLead');
      list.append(lead);
      for (const f of M.FAMILIES) {
        const bugs = M.familyBugs(f);
        const gold = bugs.filter(k => M.dexRank(k, s.caught[k] || 0) >= 3).length;
        const el = document.createElement('div');
        el.className = 'item notile ach' + (s.sets[f] ? ' complete' : '');
        const mid = document.createElement('div');
        mid.innerHTML = '<div class="name"></div><div class="desc"></div><div class="setbugs"></div>';
        mid.querySelector('.name').textContent = `${t('kindNames')[f]}  ${gold}/${bugs.length}`;
        mid.querySelector('.desc').textContent = s.sets[f] ? `${t('setDone')} 👑${this.titleName('fam_' + f)}` : `👑${this.titleName('fam_' + f)}`;
        const row = mid.querySelector('.setbugs');
        for (const k of bugs) {
          const cv = document.createElement('canvas');
          const rank = M.dexRank(k, s.caught[k] || 0);
          cv.className = 'r' + rank;
          this.drawBug(cv, k, 34, !s.caught[k]);
          row.append(cv);
        }
        el.append(mid);
        list.append(el);
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
        const b = document.createElement('span'); b.textContent = (s.star ? '★' + s.star + ' ' : '') + (s.day ? `${this.game.dayText(s.day)}・${t('areaNames')[D.phaseArea(s.phase || 0, s.day)]}` : ''); b.style.color = '#cfc6ee'; b.style.fontSize = '12px';
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
