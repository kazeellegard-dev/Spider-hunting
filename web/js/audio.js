// All sound is synthesized with Web Audio: no asset files, no licensing (B-06).
(function (root) {
  'use strict';

  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let musicOn = true, soundOn = true;
  let music = null; // { timer, step, nextTime, mode }

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 0.6 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.22 : 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // iOS only lets audio start inside a user gesture.
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  function tone(freq, dur, opt) {
    const c = ctx; if (!c || !soundOn) return;
    opt = opt || {};
    const t0 = c.currentTime + (opt.delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur);
    const v = opt.vol == null ? 0.5 : opt.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (opt.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(opt.bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, opt) {
    const c = ctx; if (!c || !soundOn) return;
    opt = opt || {};
    const t0 = c.currentTime + (opt.delay || 0);
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = opt.filter || 'bandpass'; f.frequency.value = opt.freq || 2000; f.Q.value = opt.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(opt.vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t0); s.stop(t0 + dur);
  }

  const SFX = {
    button() { tone(660, 0.08, { type: 'triangle', vol: 0.3 }); tone(990, 0.08, { type: 'triangle', vol: 0.2, delay: 0.05 }); },
    spin() { tone(500, 0.18, { type: 'sine', to: 1100, vol: 0.18 }); noise(0.15, { freq: 5000, q: 2, vol: 0.05 }); },
    land() { tone(240, 0.22, { type: 'triangle', to: 180, vol: 0.35 }); tone(480, 0.12, { type: 'sine', vol: 0.12 }); },
    deny() { tone(200, 0.12, { type: 'square', vol: 0.12 }); tone(160, 0.16, { type: 'square', vol: 0.12, delay: 0.1 }); },
    stick(w) { const f = 380 - Math.min(w, 6) * 30; tone(f, 0.3, { type: 'sine', to: f * 0.6, vol: 0.4 }); tone(f * 2, 0.08, { type: 'triangle', vol: 0.15 }); },
    rush() { tone(700, 0.12, { type: 'sine', to: 1300, vol: 0.15 }); },
    wrap() { for (let i = 0; i < 5; i++) tone(900 + i * 120, 0.05, { type: 'triangle', vol: 0.12, delay: i * 0.05 }); },
    pop(combo) {
      const base = 520 * Math.pow(1.06, Math.min(combo || 0, 16));
      tone(base, 0.12, { type: 'sine', to: base * 2, vol: 0.4 });
      tone(base * 1.5, 0.18, { type: 'triangle', vol: 0.18, delay: 0.06 });
    },
    snap() { noise(0.12, { freq: 3000, q: 3, vol: 0.4 }); tone(180, 0.2, { type: 'triangle', to: 90, vol: 0.3 }); },
    escape() { tone(700, 0.35, { type: 'triangle', to: 300, vol: 0.2 }); },
    sting() { tone(1200, 0.15, { type: 'sawtooth', to: 600, vol: 0.18 }); noise(0.1, { freq: 6000, q: 4, vol: 0.2 }); },
    coin() { tone(988, 0.07, { type: 'square', vol: 0.1 }); tone(1319, 0.18, { type: 'square', vol: 0.1, delay: 0.07 }); },
    treat() { tone(1046, 0.1, { type: 'sine', vol: 0.3 }); tone(1568, 0.14, { type: 'sine', vol: 0.2, delay: 0.05 }); },
    bonus() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.25, delay: i * 0.08 })); },
    area() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.4, { type: 'sine', vol: 0.25, delay: i * 0.12 })); },
    levelup() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.25, delay: i * 0.09 })); },
    gameover() { [523, 440, 349, 262].forEach((f, i) => tone(f, 0.45, { type: 'triangle', vol: 0.25, delay: i * 0.2 })); },
    wind() { noise(1.6, { filter: 'lowpass', freq: 600, q: 0.5, vol: 0.25 }); },
    buy() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.15, { type: 'square', vol: 0.08, delay: i * 0.06 })); },
  };

  // --- tiny generative BGM ---
  const MODES = {
    day:   { bpm: 104, root: 60, scale: [0, 2, 4, 7, 9, 12, 14, 16], bass: [0, -5, -3, -7], wave: 'triangle' },
    eve:   { bpm: 96,  root: 57, scale: [0, 3, 5, 7, 10, 12, 15, 17], bass: [0, -4, -2, -5], wave: 'triangle' },
    night: { bpm: 84,  root: 55, scale: [0, 2, 3, 7, 9, 12, 14, 15], bass: [0, -4, -5, -2], wave: 'sine' },
    bonus: { bpm: 150, root: 64, scale: [0, 2, 4, 7, 9, 12, 14, 16], bass: [0, 5, 7, 5], wave: 'square' },
    title: { bpm: 92,  root: 62, scale: [0, 2, 4, 7, 9, 12, 14, 16], bass: [0, -3, -5, -7], wave: 'sine' },
  };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function startMusic(modeName) {
    ensure();
    if (!ctx) return;
    if (music && music.mode === modeName) return;
    stopMusic();
    const mode = MODES[modeName] || MODES.day;
    let melodyIdx = 3;
    music = { mode: modeName, step: 0, nextTime: ctx.currentTime + 0.1 };
    const spb = 60 / mode.bpm / 2; // eighth notes
    music.timer = setInterval(() => {
      if (!ctx) return;
      while (music && music.nextTime < ctx.currentTime + 0.3) {
        const s = music.step, t = music.nextTime;
        const bar = Math.floor(s / 8) % mode.bass.length;
        if (s % 8 === 0) note(midi(mode.root - 12 + mode.bass[bar]), spb * 7, 'triangle', 0.5, t);
        if (s % 8 === 4) note(midi(mode.root - 12 + mode.bass[bar] + 7), spb * 3, 'triangle', 0.25, t);
        // wandering melody: small steps, occasional rests
        if (Math.random() < 0.72) {
          melodyIdx = Math.max(0, Math.min(mode.scale.length - 1, melodyIdx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
          note(midi(mode.root + mode.scale[melodyIdx] + mode.bass[bar] * 0), spb * 0.9, mode.wave, modeName === 'bonus' ? 0.12 : 0.28, t);
        }
        if (modeName !== 'night' && s % 2 === 1 && Math.random() < 0.5) hat(t);
        music.step++;
        music.nextTime += spb;
      }
    }, 60);
  }

  function note(freq, dur, wave, vol, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function hat(t) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(musicBus);
    s.start(t); s.stop(t + 0.05);
  }

  function stopMusic() {
    if (music) { clearInterval(music.timer); music = null; }
  }

  const audio = {
    unlock,
    play(name, arg) { if (ctx && SFX[name]) { try { SFX[name](arg); } catch (e) { /* ignore */ } } },
    music: startMusic,
    stopMusic,
    setSound(on) { soundOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.6 : 0; },
    setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.value = on ? 0.22 : 0; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  };

  root.SH = root.SH || {};
  root.SH.audio = audio;
})(typeof globalThis !== 'undefined' ? globalThis : this);
