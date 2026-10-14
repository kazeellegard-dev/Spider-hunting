// Procedural drawing: backgrounds, the spider, insects, treats and silk.
// Everything is vector-drawn so the game needs no image assets.
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // ---------- background ----------
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = sh => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }
  // season looks (bought in the wardrobe): recolour hills and swap the decorations
  const SEASONS = {
    spring: { hill: '#ffc6dc', k: 0.25, leaf: '#ffb7d0', leafN: '#8a5a7a', flowers: ['#ffb7d0', '#fff', '#ffd6e6', '#ff9fc0'] },
    summer: { hill: '#3fae4a', k: 0.25, leaf: '#3f9a3a', leafN: '#24402f', flowers: null, sunflowers: true },
    autumn: { hill: '#d9822b', k: 0.4, leaf: '#e8562a', leafN: '#6a3a2a', flowers: ['#ffb347', '#e8562a', '#ffd56b', '#c94a2a'] },
    winter: { hill: '#f2f6ff', k: 0.62, kN: 0.35, leaf: '#ffffff', leafN: '#c8d0e8', flowers: null, snow: true },
  };

  function makeBackground(area, W, H, dpr, season) {
    const se = SEASONS[season];
    if (se) {
      const k = area.night ? (se.kN || se.k * 0.5) : se.k;
      area = Object.assign({}, area, { hill: mix(area.hill, se.hill, k), hill2: mix(area.hill2, se.hill, k * 0.9), ground: se.snow ? mix(area.ground, '#ffffff', area.night ? 0.45 : 0.85) : mix(area.ground, se.hill, k * 0.6) });
    }
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const r = rng(area.id.length * 977 + 13);

    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, area.sky[0]); sky.addColorStop(1, area.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);

    if (area.night) {
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`;
        g.beginPath(); g.arc(r() * W, r() * H * 0.75, r() * 1.4 + 0.3, 0, TAU); g.fill();
      }
    }
    // sun / moon
    const sx = W * 0.78, sy = H * 0.13;
    const glow = g.createRadialGradient(sx, sy, 4, sx, sy, 90);
    glow.addColorStop(0, area.sun); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(sx, sy, 90, 0, TAU); g.fill();
    g.fillStyle = area.sun; g.beginPath(); g.arc(sx, sy, 26, 0, TAU); g.fill();
    if (area.night) { g.fillStyle = area.sky[0]; g.beginPath(); g.arc(sx + 11, sy - 7, 23, 0, TAU); g.fill(); }

    if (!area.night) {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 4; i++) cloud(g, r() * W, H * (0.08 + r() * 0.3), 18 + r() * 16);
    }
    // hills
    hill(g, W, H, H * 0.72, 40, area.hill, r);
    hill(g, W, H, H * 0.82, 28, area.hill2, r);
    g.fillStyle = area.ground; g.fillRect(0, H * 0.93, W, H * 0.07);
    // grass blades
    g.strokeStyle = area.hill2; g.lineWidth = 2; g.lineCap = 'round';
    for (let x = 0; x < W; x += 6) {
      const h = 10 + r() * 18;
      g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + 2, H - h * 0.6, x + (r() - 0.5) * 8, H - h - H * 0.06); g.stroke();
    }
    if (se && se.sunflowers) {
      for (let i = 0; i < 6; i++) sunflower(g, (i + 0.3 + r() * 0.4) / 6 * W, H * (0.86 + r() * 0.05), 7 + r() * 3, area.night);
    } else if (!area.night && !(se && se.snow)) {
      const cols = (se && se.flowers) || ['#ff9fc0', '#fff', '#ffd56b', '#b8a6ff'];
      for (let i = 0; i < 9; i++) flower(g, r() * W, H * (0.9 + r() * 0.06), cols[Math.floor(r() * 4)]);
    }
    // branch frame (top-left) and leaves (top-right)
    const leaf = se ? (area.night ? se.leafN : se.leaf) : (area.night ? '#24402f' : '#5aa35f');
    branch(g, W, H, area.night ? '#2a2238' : '#7a5236', leaf, se && se.snow);
    return c;
  }
  function sunflower(g, x, y, s, night) {
    g.strokeStyle = night ? '#24402f' : '#3f8f3a'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + s * 5); g.stroke();
    g.fillStyle = night ? '#8a7a3a' : '#ffd23f';
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.95, y + Math.sin(a) * s * 0.95, s * 0.55, s * 0.25, a, 0, TAU); g.fill(); }
    g.fillStyle = night ? '#3a2a1a' : '#7a4a1a'; g.beginPath(); g.arc(x, y, s * 0.6, 0, TAU); g.fill();
  }

  // drifting petals / leaves / snow for the chosen season (sunflowers stay put)
  function drawSeason(g, season, W, H, time, night) {
    const se = SEASONS[season];
    if (!se || se.sunflowers) return;
    for (let i = 0; i < 14; i++) {
      const sp = 18 + (i * 7) % 16;
      const y = ((time * sp + i * 97) % (H + 40)) - 20;
      const x = ((i * 173 + Math.sin(time * 0.8 + i) * 30 + time * (se.snow ? 6 : 14)) % (W + 40) + W + 40) % (W + 40) - 20;
      g.save(); g.translate(x, y);
      if (se.snow) {
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(0, 0, 1.6 + (i % 3) * 0.7, 0, TAU); g.fill();
      } else {
        g.rotate(time * 1.5 + i); g.globalAlpha *= night ? 0.5 : 0.85;
        g.fillStyle = season === 'spring' ? '#ffc0d6' : ['#e8562a', '#ffb347', '#c94a2a'][i % 3];
        if (season === 'spring') { g.beginPath(); g.ellipse(0, 0, 3.4, 2, 0, 0, TAU); g.fill(); }
        else leafShape(g, -4, 0, 0, 5);
      }
      g.restore();
    }
  }

  function cloud(g, x, y, s) {
    g.beginPath();
    g.arc(x, y, s, 0, TAU); g.arc(x + s, y + 4, s * 0.8, 0, TAU); g.arc(x - s, y + 5, s * 0.7, 0, TAU); g.arc(x + s * 0.3, y - s * 0.5, s * 0.7, 0, TAU);
    g.fill();
  }
  function hill(g, W, H, base, amp, color, r) {
    g.fillStyle = color; g.beginPath(); g.moveTo(0, H);
    const k1 = 0.5 + r() * 2, k2 = 2 + r() * 3, ph = r() * 6;
    for (let x = 0; x <= W; x += 8) g.lineTo(x, base - Math.sin(x / W * Math.PI * k1 + ph) * amp - Math.sin(x / W * Math.PI * k2) * amp * 0.3);
    g.lineTo(W, H); g.closePath(); g.fill();
  }
  function flower(g, x, y, color) {
    g.fillStyle = color;
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.2, 0, TAU); g.fill(); }
    g.fillStyle = '#ffcf4a'; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill();
  }
  function branch(g, W, H, wood, leaf, snow) {
    g.strokeStyle = wood; g.lineCap = 'round';
    g.lineWidth = 12; g.beginPath(); g.moveTo(-10, H * 0.05); g.quadraticCurveTo(W * 0.25, H * 0.02, W * 0.45, H * 0.065); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(W * 0.22, H * 0.035); g.quadraticCurveTo(W * 0.3, H * 0.08, W * 0.27, H * 0.12); g.stroke();
    g.fillStyle = leaf;
    const leaves = [[W * 0.1, H * 0.065, 0.6], [W * 0.33, H * 0.04, -0.5], [W * 0.42, H * 0.085, 0.9], [W * 0.27, H * 0.125, 1.6], [W * 0.95, H * 0.03, 2.2], [W * 0.88, H * 0.06, 2.8], [W * 1.0, H * 0.09, 2.5]];
    for (const [x, y, a] of leaves) leafShape(g, x, y, a, 16);
    if (snow) {
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-10, H * 0.05 - 5); g.quadraticCurveTo(W * 0.25, H * 0.02 - 5, W * 0.45, H * 0.065 - 5); g.stroke();
    }
  }
  function leafShape(g, x, y, a, s) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.6, -s * 0.6, s * 1.6, 0); g.quadraticCurveTo(s * 0.6, s * 0.6, 0, 0); g.fill();
    g.restore();
  }

  // ---------- silk ----------
  function threadPath(g, t) {
    const p = t.points;
    g.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
      g.quadraticCurveTo(p[i].x, p[i].y, mx, my);
    }
    g.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  }
  // glow > 0: glowing silk (seconds left), drawn gold and pulsing; blinks when ending.
  // skin: the player's silk look (meta.PARTS.thread)
  function drawThreads(g, threads, night, glow, time, skin) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    skin = skin || {};
    const lit = glow > 0 && (glow > 3 || Math.sin(time * 18) > 0);
    // silk that glows by night gets a soft halo first
    if (!lit && skin.glow && night) {
      g.strokeStyle = skin.aurora ? `hsla(${(170 + time * 40) % 360},90%,70%,0.28)` : 'rgba(150,215,255,0.3)';
      g.lineWidth = 7;
      g.beginPath(); for (const t of threads) threadPath(g, t); g.stroke();
    }
    for (const pass of [0, 1]) {
      if (lit) {
        const a = 0.75 + 0.25 * Math.sin(time * 6);
        g.strokeStyle = pass === 0 ? `rgba(255,200,60,${0.45 * a})` : `rgba(255,246,190,${a})`;
        g.lineWidth = pass === 0 ? 6 : 2.2;
      } else {
        g.strokeStyle = pass === 0 ? (night ? 'rgba(0,0,30,0.35)' : 'rgba(60,60,110,0.28)') : (skin.color || (night ? 'rgba(220,230,255,0.85)' : 'rgba(255,255,255,0.95)'));
        g.lineWidth = pass === 0 ? 3.2 : 1.5;
      }
      // rainbow / aurora silk: each strand gets its own drifting colour
      if (pass === 1 && !lit && (skin.rainbow || skin.aurora)) {
        g.lineWidth = 1.7;
        for (const t of threads) {
          const h = skin.rainbow ? (t.id * 47 + time * 50) % 360 : 150 + 90 * Math.sin(t.id * 0.7 + time * 0.8);
          g.strokeStyle = `hsl(${h},${skin.rainbow ? 85 : 80}%,${skin.rainbow ? 70 : 72}%)`;
          g.beginPath(); threadPath(g, t); g.stroke();
        }
        continue;
      }
      g.beginPath();
      for (const t of threads) threadPath(g, t);
      g.stroke();
    }
  }
  // knot: the player's knot look (dot / star / heart / flower / diamond)
  function drawNodes(g, nodes, time, knot) {
    for (const n of nodes) {
      // knots tied at crossings get a slightly bigger, warmer bead
      g.fillStyle = n.tie ? 'rgba(255,240,190,1)' : 'rgba(255,255,255,0.95)';
      const r = n.tie ? 3.4 : 2.6;
      if (!knot || knot === 'dot') { g.beginPath(); g.arc(n.x, n.y, r, 0, TAU); g.fill(); }
      else drawKnot(g, knot, n.x, n.y, r * 1.45, n.tie, time + n.id);
      // dew sparkle
      const tw = 0.5 + 0.5 * Math.sin(time * 2 + n.id);
      g.fillStyle = `rgba(200,240,255,${0.25 + tw * 0.4})`;
      g.beginPath(); g.arc(n.x, n.y, 4.5, 0, TAU); g.fill();
    }
  }

  function drawKnot(g, knot, x, y, r, tie, t) {
    if (knot === 'star') { g.fillStyle = tie ? '#ffe066' : '#fff6c2'; star(g, x, y, r * 1.2); }
    else if (knot === 'heart') { g.fillStyle = tie ? '#ff6f9a' : '#ffb3cf'; heart(g, x, y, r * 0.95); }
    else if (knot === 'flower') {
      g.fillStyle = tie ? '#ffb3cf' : '#ffffff';
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55, 0, TAU); g.fill(); }
      g.fillStyle = '#ffcf4a'; g.beginPath(); g.arc(x, y, r * 0.45, 0, TAU); g.fill();
    } else if (knot === 'diamond') {
      const k = 0.7 + 0.3 * Math.sin(t * 3);
      g.fillStyle = `rgba(170,230,255,${0.75 + 0.25 * k})`;
      g.beginPath(); g.moveTo(x, y - r * 1.3); g.lineTo(x + r * 0.9, y); g.lineTo(x, y + r * 1.3); g.lineTo(x - r * 0.9, y); g.closePath(); g.fill();
      g.fillStyle = `rgba(255,255,255,${k})`; g.beginPath(); g.arc(x - r * 0.2, y - r * 0.35, r * 0.28, 0, TAU); g.fill();
    } else { g.beginPath(); g.arc(x, y, r / 1.45, 0, TAU); g.fill(); }
  }

  // ---------- spider ----------
  // look: { body, belly, pattern, shiny, hat, face } (see meta.spiderLook)
  function drawSpider(g, s, time, look) {
    const x = s.x, y = s.y;
    const body = look.body, belly = look.belly;
    const moving = s.moving;
    const scale = s.scale || 1;
    g.save(); g.translate(x, y); g.scale(scale, scale);
    if (s.hurt > 0) g.translate(Math.sin(time * 80) * 3, 0);
    const bob = moving ? Math.sin(time * 30) * 1.2 : Math.sin(time * 3) * 0.8;
    const rainbow = look.pattern === 'rainbow';
    const hue = (time * 60) % 360;
    // legs
    g.strokeStyle = rainbow ? `hsl(${hue},70%,55%)` : body; g.lineWidth = 3.2; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        const base = (-0.75 + i * 0.5);
        const wiggle = moving ? Math.sin(time * 28 + i * 1.7 + (side > 0 ? 1.4 : 0)) * 0.28 : Math.sin(time * 2 + i) * 0.05;
        const a = base + wiggle;
        const hx = side * 9, hy = 2 + i * 1.5;
        const kx = side * (20 + Math.cos(a) * 2), ky = -6 + a * 14;
        const fx = side * (27 + Math.cos(a) * 3), fy = 10 + a * 16;
        g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      }
    }
    g.translate(0, bob);
    // abdomen + head as one cute round body
    if (rainbow) {
      const gr = g.createLinearGradient(-16, -15, 16, 15);
      for (let i = 0; i <= 4; i++) gr.addColorStop(i / 4, `hsl(${(hue + i * 70) % 360},80%,62%)`);
      g.fillStyle = gr;
    } else {
      const grad = g.createRadialGradient(-5, -6, 2, 0, 0, 18);
      grad.addColorStop(0, belly); grad.addColorStop(1, body);
      g.fillStyle = grad;
    }
    g.beginPath(); g.ellipse(0, 0, 16, 15, 0, 0, TAU); g.fill();
    if (look.pattern === 'stripes' || look.pattern === 'spots' || look.pattern === 'crystal') {
      g.save(); g.beginPath(); g.ellipse(0, 0, 16, 15, 0, 0, TAU); g.clip();
      if (look.pattern === 'stripes') { g.fillStyle = 'rgba(40,30,20,0.85)'; g.fillRect(-16, -11, 32, 4); g.fillRect(-16, 9, 32, 4); }
      else if (look.pattern === 'spots') {
        g.fillStyle = 'rgba(255,240,220,0.55)';
        for (const [sx, sy, r] of [[-10, -9, 2.2], [11, -8, 1.8], [-12, 8, 2], [12, 9, 2.4], [0, 12, 1.6]]) { g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill(); }
      } else {
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-16, -4); g.lineTo(-6, -15); g.lineTo(4, -6); g.lineTo(16, -10); g.moveTo(-14, 8); g.lineTo(-4, 2); g.lineTo(6, 13); g.moveTo(4, -6); g.lineTo(-4, 2); g.stroke();
      }
      g.restore();
    }
    if (look.shiny) {
      g.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(time * 4)})`;
      g.beginPath(); g.ellipse(-6, -7, 5, 3, -0.6, 0, TAU); g.fill();
      if (look.pattern === 'crystal' || rainbow) {
        g.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(time * 5)})`;
        star(g, 11, -9, 2.6); star(g, -12, 6, 1.8);
      }
    }
    // eyes look toward travel direction
    const lx = Math.max(-1, Math.min(1, s.lookX || 0)) * 1.8, ly = Math.max(-1, Math.min(1, s.lookY || 0)) * 1.5;
    const blink = (Math.sin(time * 1.3) > 0.985) ? 0.15 : 1;
    for (const ex of [-6, 6]) {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, -2, 5, 6 * blink, 0, 0, TAU); g.fill();
      if (blink > 0.5) {
        g.fillStyle = '#1c1830'; g.beginPath(); g.arc(ex + lx, -1.5 + ly, s.sad ? 2.2 : 3, 0, TAU); g.fill();
        if (look.face === 'stareyes') { g.fillStyle = '#ffe066'; star(g, ex + lx, -1.5 + ly, 2.4); }
        else { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + lx + 1, -3 + ly, 1.1, 0, TAU); g.fill(); }
      }
    }
    // cheeks + mouth
    if (look.face === 'blush') {
      g.fillStyle = 'rgba(255,90,140,0.85)';
      heart(g, -10.5, 5, 2.6); heart(g, 10.5, 5, 2.6);
    } else {
      g.fillStyle = 'rgba(255,120,150,0.55)';
      g.beginPath(); g.ellipse(-10, 5, 3, 2, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(10, 5, 3, 2, 0, 0, TAU); g.fill();
    }
    g.strokeStyle = '#1c1830'; g.lineWidth = 1.4;
    g.beginPath();
    if (s.sad) g.arc(0, 10, 3, Math.PI * 1.15, Math.PI * 1.85);
    else if (s.happy > 0) { g.fillStyle = '#1c1830'; g.arc(0, 6, 3.4, 0, Math.PI); g.fill(); }
    else g.arc(0, 5, 2.6, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
    drawFace(g, look.face, time);
    drawHat(g, look.hat, time);
    g.restore();
  }

  function heart(g, x, y, r) {
    g.beginPath();
    g.moveTo(x, y + r);
    g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.8, y - r * 1.4, x, y - r * 0.5);
    g.bezierCurveTo(x + r * 0.8, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r);
    g.fill();
  }

  function drawFace(g, face) {
    if (face === 'glasses') {
      g.strokeStyle = '#ffd34d'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(-6, -2, 6.5, 0, TAU); g.stroke();
      g.beginPath(); g.arc(6, -2, 6.5, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(-0.5, -3); g.lineTo(0.5, -3); g.stroke();
    } else if (face === 'shades') {
      g.fillStyle = '#1c1830';
      g.beginPath(); g.ellipse(-6, -2, 6.5, 5, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(6, -2, 6.5, 5, 0, 0, TAU); g.fill();
      g.fillRect(-1, -4, 2, 2);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-8, -4, 2, 1, -0.4, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(4, -4, 2, 1, -0.4, 0, TAU); g.fill();
    } else if (face === 'mustache') {
      g.fillStyle = '#2a1a10';
      g.beginPath(); g.moveTo(0, 3.5);
      g.quadraticCurveTo(-4, 1.5, -9, 4.5); g.quadraticCurveTo(-5, 7, 0, 5);
      g.quadraticCurveTo(5, 7, 9, 4.5); g.quadraticCurveTo(4, 1.5, 0, 3.5); g.fill();
    }
  }

  function drawHat(g, hat, time) {
    if (!hat || hat === 'none') return;
    if (hat === 'ribbon') {
      g.fillStyle = '#ff4f7b';
      g.beginPath(); g.moveTo(6, -13); g.lineTo(-2, -20); g.lineTo(-1, -9); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(6, -13); g.lineTo(14, -20); g.lineTo(13, -8); g.closePath(); g.fill();
      g.beginPath(); g.arc(6, -13, 2.6, 0, TAU); g.fill();
    } else if (hat === 'cap') {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(0, -10, 11, Math.PI, TAU); g.fill();
      g.fillStyle = '#ff6b6b'; g.fillRect(-3, -21, 6, 3);
      g.fillStyle = '#e8e8e8'; g.beginPath(); g.ellipse(9, -10, 8, 2.5, 0, 0, TAU); g.fill();
    } else if (hat === 'leaf') {
      g.fillStyle = '#5bc46a';
      g.save(); g.translate(0, -14); g.rotate(-0.9 + Math.sin(time * 3) * 0.1);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, -8, 16, 0); g.quadraticCurveTo(6, 6, 0, 0); g.fill();
      g.restore();
    } else if (hat === 'flower') {
      g.save(); g.translate(-8, -13);
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + time * 0.5; g.beginPath(); g.arc(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 2.8, 0, TAU); g.fill(); }
      g.fillStyle = '#ffcf4a'; g.beginPath(); g.arc(0, 0, 2.4, 0, TAU); g.fill();
      g.restore();
    } else if (hat === 'antenna') {
      g.strokeStyle = '#1c1830'; g.lineWidth = 1.6;
      for (const k of [-1, 1]) {
        const sw = Math.sin(time * 4 + k) * 1.5;
        g.beginPath(); g.moveTo(k * 4, -13); g.quadraticCurveTo(k * 6, -20, k * 9 + sw, -24); g.stroke();
        g.fillStyle = '#ff6f9a'; g.beginPath(); g.arc(k * 9 + sw, -24, 2.6, 0, TAU); g.fill();
      }
    } else if (hat === 'tophat') {
      g.fillStyle = '#1c1830';
      g.beginPath(); g.ellipse(0, -12, 12, 3, 0, 0, TAU); g.fill();
      g.fillRect(-7.5, -27, 15, 15);
      g.fillStyle = '#ff6f9a'; g.fillRect(-7.5, -16.5, 15, 3);
    } else if (hat === 'crown') {
      g.fillStyle = '#ffd23f'; g.strokeStyle = '#c9971a'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-9, -12); g.lineTo(-9, -22); g.lineTo(-4.5, -16); g.lineTo(0, -24); g.lineTo(4.5, -16); g.lineTo(9, -22); g.lineTo(9, -12); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff4f7b'; g.beginPath(); g.arc(0, -15, 1.8, 0, TAU); g.fill();
    } else if (hat === 'halo') {
      const a = 0.75 + 0.25 * Math.sin(time * 3);
      g.strokeStyle = `rgba(255,236,140,${a})`; g.lineWidth = 3;
      g.beginPath(); g.ellipse(0, -24 + Math.sin(time * 2) * 1.2, 10, 3.2, 0, 0, TAU); g.stroke();
      g.strokeStyle = `rgba(255,255,230,${a * 0.6})`; g.lineWidth = 6;
      g.globalAlpha *= 0.35; g.stroke(); g.globalAlpha /= 0.35;
    } else if (hat === 'dewcrown') {
      // a crown of dew drops on a silk band
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(0, -4, 13, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (1.18 + i * 0.16), px = Math.cos(a) * 13, py = -4 + Math.sin(a) * 13;
        const tw = 0.6 + 0.4 * Math.sin(time * 4 + i);
        g.fillStyle = `rgba(160,225,255,${0.7 + 0.3 * tw})`;
        g.beginPath(); g.moveTo(px, py - 5); g.quadraticCurveTo(px + 3.2, py, px, py + 2.6); g.quadraticCurveTo(px - 3.2, py, px, py - 5); g.fill();
        g.fillStyle = `rgba(255,255,255,${tw})`; g.beginPath(); g.arc(px - 0.8, py - 0.8, 0.9, 0, TAU); g.fill();
      }
    }
  }

  // ---------- insects ----------
  function wingFlap(time, speed) { return 0.35 + 0.65 * Math.abs(Math.sin(time * speed)); }

  // colour variants: every colour of the species turned around the colour wheel
  function shiftColor(c, deg) {
    let r, gg, b, a = 1, m;
    if ((m = /^#([0-9a-f]{6})$/i.exec(c))) { const n = parseInt(m[1], 16); r = n >> 16; gg = (n >> 8) & 255; b = n & 255; }
    else if ((m = /^rgba?\(([^)]+)\)$/.exec(c))) { [r, gg, b, a = 1] = m[1].split(',').map(Number); }
    else return c;
    r /= 255; gg /= 255; b /= 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2;
    let h = 0, sat = 0;
    if (mx !== mn) {
      const d = mx - mn;
      sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (gg - b) / d + (gg < b ? 6 : 0) : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
      h *= 60;
    }
    // greys get some colour so the variant always shows
    sat = Math.min(1, Math.max(sat, 0.45) * 1.15);
    return `hsla(${Math.round((h + deg) % 360)},${Math.round(sat * 100)}%,${Math.round(Math.min(0.78, Math.max(0.3, l)) * 100)}%,${a})`;
  }
  function shinyDef(def) {
    if (!def._shiny) def._shiny = Object.assign({}, def, { color: shiftColor(def.color, 150), color2: def.color2 ? shiftColor(def.color2, 150) : def.color2 });
    return def._shiny;
  }

  function drawInsect(g, ins, time) {
    const def = ins.shiny ? shinyDef(ins.def) : ins.def;
    g.save();
    g.translate(ins.x, ins.y);
    if (ins.sizeF && ins.sizeF !== 1) g.scale(ins.sizeF, ins.sizeF);
    if (ins.shiny && ins.state !== 'wrapped') {
      const a = 0.55 + 0.45 * Math.sin(time * 7 + ins.seed);
      g.fillStyle = `rgba(255,200,255,${a})`;
      const s0 = def.size;
      star(g, Math.cos(time * 2 + ins.seed) * s0 * 1.3, Math.sin(time * 2 + ins.seed) * s0 * 1.1, 3);
      star(g, Math.cos(time * 2 + ins.seed + 3) * s0 * 1.2, Math.sin(time * 2 + ins.seed + 3) * s0, 2.2);
    }
    if (ins.state === 'escape' && ins.fadeMax) g.globalAlpha *= Math.max(0, ins.fade / ins.fadeMax);
    const face = ins.vx < 0 ? -1 : 1;
    if (ins.state === 'wrapped') {
      drawCocoon(g, def.size, ins.wrapT, time);
      g.restore(); return;
    }
    if (ins.state === 'caught') {
      g.rotate(Math.sin(time * 25 + ins.seed) * 0.25);
      // escape timer ring
      const r = def.size + 9;
      const frac = Math.max(0, ins.struggle / ins.struggleMax);
      g.lineWidth = 3.5; g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.strokeStyle = frac > 0.5 ? '#5ad17a' : frac > 0.25 ? '#ffc23d' : '#ff5a5a';
      g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac); g.stroke();
    }
    g.scale(face, 1);
    const slow = def.pattern === 'flutter' || def.kind === 'butterfly' || def.kind === 'moth';
    const flap = ins.state === 'caught' ? 0.3 + 0.7 * Math.abs(Math.sin(time * 40 + ins.seed)) : wingFlap(time + ins.seed, slow ? 9 : 40);
    const s = def.size;
    if (def.glow) {
      const a = 0.45 + 0.35 * Math.sin(time * 5 + ins.seed);
      const gr = g.createRadialGradient(-s * 0.5, 0, 1, -s * 0.5, 0, s * 2.4);
      gr.addColorStop(0, `rgba(240,255,140,${a})`); gr.addColorStop(1, 'rgba(240,255,140,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(-s * 0.5, 0, s * 2.4, 0, TAU); g.fill();
    }
    if (def.rare) {
      const a = 0.25 + 0.2 * Math.sin(time * 6 + ins.seed);
      const gr = g.createRadialGradient(0, 0, 1, 0, 0, s * 1.8);
      gr.addColorStop(0, `rgba(255,240,170,${a})`); gr.addColorStop(1, 'rgba(255,240,170,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * 1.8, 0, TAU); g.fill();
    }
    const draw = KINDS[def.kind] || KINDS.fly;
    draw(g, s, flap, def, time);
    g.restore();
  }

  function wings(g, len, wid, flap, color, y) {
    g.fillStyle = color;
    g.beginPath(); g.ellipse(-len * 0.1, y - wid * flap, len * 0.5, wid * flap, -0.4, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(len * 0.15, y - wid * flap * 0.9, len * 0.45, wid * flap * 0.9, 0.3, 0, TAU); g.fill();
  }
  function eyes(g, x, y, r, color) {
    g.fillStyle = color || '#fff'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = '#1c1830'; g.beginPath(); g.arc(x + r * 0.25, y, r * 0.55, 0, TAU); g.fill();
  }
  function legs(g, s, n, color, y0, len) {
    g.strokeStyle = color; g.lineWidth = Math.max(1, s * 0.08); g.lineCap = 'round';
    for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(-s * 0.3 + i * s * 0.3, s * y0); g.lineTo(-s * 0.5 + i * s * 0.35, s * (y0 + len)); g.stroke(); }
  }
  function shell(g, s, def, time, rx, ry) {
    const gr = g.createLinearGradient(0, -s * ry, 0, s * ry);
    if (def.rainbow) {
      const k = (time * 0.4) % 1;
      ['#3ac0a0', '#5a8aff', '#ff5ad0', '#ffd84a', '#3ac0a0'].forEach((c, i) => gr.addColorStop((i / 4 + k) % 1, c));
    } else { gr.addColorStop(0, def.color2); gr.addColorStop(1, def.color); }
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, s * rx, s * ry, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-s * 0.15, -s * ry * 0.55, s * rx * 0.45, s * ry * 0.18, -0.1, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(s * rx * 0.4, -s * ry * 0.9); g.lineTo(-s * rx, 0); g.stroke();
  }

  const KINDS = {
    fly(g, s, flap, d) {
      wings(g, s * 1.4, s * 0.7, flap, 'rgba(220,240,255,0.75)', -s * 0.3);
      if (!d.tiny) legs(g, s, 3, d.color, 0.3, 0.45);
      g.fillStyle = d.color; g.beginPath(); g.ellipse(0, 0, s * 0.75, s * 0.55, 0, 0, TAU); g.fill();
      if (d.shiny) { g.fillStyle = 'rgba(200,255,220,0.5)'; g.beginPath(); g.ellipse(-s * 0.15, -s * 0.2, s * 0.35, s * 0.15, 0, 0, TAU); g.fill(); }
      if (d.kind === 'fly' && s > 12) { g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 3; i++) g.fillRect(-s * 0.5 + i * s * 0.3, -s * 0.5, s * 0.1, s); }
      g.fillStyle = d.color; g.beginPath(); g.arc(s * 0.65, -s * 0.05, s * 0.38, 0, TAU); g.fill();
      eyes(g, s * 0.8, -s * 0.15, s * 0.22, d.tiny ? '#fff' : d.color2);
    },
    mosquito(g, s, flap, d) {
      g.strokeStyle = d.color; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-s * 0.2 + i * s * 0.3, s * 0.1); g.lineTo(-s * 0.6 + i * s * 0.5, s * 0.9); g.stroke(); }
      wings(g, s * 1.3, s * 0.5, flap, 'rgba(230,240,255,0.7)', -s * 0.2);
      g.fillStyle = d.color; g.beginPath(); g.ellipse(-s * 0.25, 0, s * 0.7, s * 0.22, 0.15, 0, TAU); g.fill();
      if (d.stripes) { g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) g.fillRect(-s * 0.7 + i * s * 0.35, -s * 0.2, s * 0.08, s * 0.4); }
      g.fillStyle = d.color; g.beginPath(); g.arc(s * 0.55, -s * 0.05, s * 0.25, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(s * 0.7, 0); g.lineTo(s * 1.25, s * 0.15); g.stroke();
      eyes(g, s * 0.62, -s * 0.12, s * 0.15);
    },
    ladybug(g, s, flap, d) {
      g.fillStyle = 'rgba(230,240,255,0.6)';
      g.beginPath(); g.ellipse(-s * 0.4, -s * 0.5 * flap, s * 0.6, s * 0.3 * flap + 0.5, -0.5, 0, TAU); g.fill();
      legs(g, s, 3, '#1c1830', 0.4, 0.35);
      g.fillStyle = d.color; g.beginPath(); g.arc(0, 0, s * 0.8, Math.PI, 0); g.ellipse(0, 0, s * 0.8, s * 0.35, 0, 0, Math.PI); g.fill();
      g.fillStyle = d.color2;
      const spots = d.spots === 2 ? [[-0.3, -0.35], [0.25, -0.4]] : [[0, -0.55], [-0.4, -0.3], [0.4, -0.3], [-0.2, 0], [0.2, 0], [-0.55, 0.05], [0.55, 0.05]];
      for (const [x, y] of spots) { g.beginPath(); g.arc(x * s, y * s, s * (d.spots === 2 ? 0.2 : 0.13), 0, TAU); g.fill(); }
      g.fillStyle = '#1c1830'; g.beginPath(); g.arc(s * 0.8, 0, s * 0.3, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 0.85, -s * 0.15, s * 0.1, 0, TAU); g.fill();
    },
    butterfly(g, s, flap, d) {
      g.fillStyle = d.color; g.strokeStyle = d.color2; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(-s * 0.05, -s * 0.6 * flap, s * 0.42, s * 0.62 * flap + 1, -0.35, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(-s * 0.42, -s * 0.3 * flap, s * 0.3, s * 0.42 * flap + 1, -0.9, 0, TAU); g.fill(); g.stroke();
      if (d.stripes) {
        g.save(); g.beginPath(); g.ellipse(-s * 0.05, -s * 0.6 * flap, s * 0.42, s * 0.62 * flap + 1, -0.35, 0, TAU); g.clip();
        g.fillStyle = d.color2; for (let i = 0; i < 3; i++) g.fillRect(-s * 0.4 + i * s * 0.25, -s * 1.4, s * 0.08, s * 1.4);
        g.restore();
        g.strokeStyle = d.color2; g.lineWidth = 2; g.beginPath(); g.moveTo(-s * 0.6, -s * 0.1); g.lineTo(-s * 0.85, s * 0.25); g.stroke();
      } else {
        g.fillStyle = d.color2; g.beginPath(); g.arc(-s * 0.05, -s * 0.72 * flap, s * 0.09 * flap + 0.5, 0, TAU); g.fill();
      }
      g.fillStyle = '#3a2a3a'; g.beginPath(); g.ellipse(0, 0, s * 0.55, s * 0.14, 0, 0, TAU); g.fill();
      g.strokeStyle = '#3a2a3a'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(s * 0.5, -s * 0.05); g.quadraticCurveTo(s * 0.75, -s * 0.45, s * 0.85, -s * 0.55); g.stroke();
      eyes(g, s * 0.5, -s * 0.05, s * 0.12);
    },
    moth(g, s, flap, d) {
      g.fillStyle = d.color;
      g.beginPath(); g.moveTo(s * 0.3, 0); g.lineTo(-s * 0.9, -s * 1.0 * flap); g.lineTo(-s * 0.6, s * 0.15); g.closePath(); g.fill();
      if (d.glowWing) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1; g.stroke(); g.strokeStyle = d.color2; g.beginPath(); g.moveTo(-s * 0.6, s * 0.1); g.lineTo(-s * 1.1, s * 0.5); g.stroke(); }
      if (d.eyespot) { g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(-s * 0.45, -s * 0.4 * flap, s * 0.17, 0, TAU); g.fill(); g.fillStyle = d.color2; g.beginPath(); g.arc(-s * 0.45, -s * 0.4 * flap, s * 0.09, 0, TAU); g.fill(); }
      else { g.fillStyle = 'rgba(120,90,60,0.4)'; g.beginPath(); g.arc(-s * 0.45, -s * 0.45 * flap, s * 0.15, 0, TAU); g.fill(); }
      g.fillStyle = d.color2; g.beginPath(); g.ellipse(0, 0, s * 0.6, s * 0.25, 0, 0, TAU); g.fill();
      g.fillStyle = d.color; g.beginPath(); g.arc(s * 0.55, 0, s * 0.25, 0, TAU); g.fill();
      g.strokeStyle = d.color2; g.lineWidth = 1.2; g.beginPath(); g.moveTo(s * 0.65, -s * 0.15); g.quadraticCurveTo(s * 0.9, -s * 0.5, s * 0.75, -s * 0.6); g.stroke();
      eyes(g, s * 0.62, -s * 0.05, s * 0.12);
    },
    bee(g, s, flap, d) {
      wings(g, s * 1.3, s * 0.7, flap, 'rgba(230,245,255,0.8)', -s * 0.35);
      if (d.fuzzy) {
        g.fillStyle = d.color; g.beginPath(); g.arc(0, 0, s * 0.72, 0, TAU); g.fill();
        g.fillStyle = d.color2; g.beginPath(); g.arc(s * 0.15, -s * 0.15, s * 0.42, 0, TAU); g.fill();
        g.fillStyle = d.color; g.beginPath(); g.arc(s * 0.65, 0, s * 0.3, 0, TAU); g.fill();
        eyes(g, s * 0.72, -s * 0.1, s * 0.16);
        return;
      }
      g.fillStyle = d.color; g.beginPath(); g.ellipse(0, 0, s * 0.85, s * 0.6, 0, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.ellipse(0, 0, s * 0.85, s * 0.6, 0, 0, TAU); g.clip();
      g.fillStyle = d.color2; g.fillRect(-s * 0.35, -s, s * 0.22, s * 2); g.fillRect(s * 0.05, -s, s * 0.22, s * 2);
      g.restore();
      g.fillStyle = d.color2; g.beginPath(); g.moveTo(-s * 0.8, -s * 0.1); g.lineTo(-s * 1.2, 0); g.lineTo(-s * 0.8, s * 0.1); g.fill();
      if (d.sting >= 20) { g.fillStyle = d.color; g.beginPath(); g.arc(s * 0.75, 0, s * 0.35, 0, TAU); g.fill(); }
      eyes(g, s * 0.55, -s * 0.12, s * 0.2);
    },
    dragonfly(g, s, flap, d) {
      g.fillStyle = 'rgba(210,240,255,0.7)';
      for (const dx of [0.05, -0.25]) {
        g.beginPath(); g.ellipse(s * dx, -s * 0.45 * flap, s * 0.18, s * 0.6 * flap + 1, 0.15, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(s * dx, s * 0.45 * flap, s * 0.16, s * 0.55 * flap + 1, -0.15, 0, TAU); g.fill();
      }
      g.fillStyle = d.color; g.beginPath(); g.ellipse(-s * 0.55, 0, s * 0.85, s * 0.1, 0, 0, TAU); g.fill();
      if (d.stripes) { g.fillStyle = d.color2; for (let i = 0; i < 5; i++) g.fillRect(-s * 1.25 + i * s * 0.25, -s * 0.1, s * 0.07, s * 0.2); }
      g.fillStyle = d.color; g.beginPath(); g.ellipse(s * 0.1, 0, s * 0.3, s * 0.17, 0, 0, TAU); g.fill();
      g.fillStyle = d.color2; g.beginPath(); g.arc(s * 0.45, -s * 0.06, s * 0.2, 0, TAU); g.fill();
      eyes(g, s * 0.5, -s * 0.08, s * 0.12);
    },
    firefly(g, s, flap, d) {
      wings(g, s * 1.2, s * 0.6, flap, 'rgba(230,240,255,0.6)', -s * 0.3);
      g.fillStyle = '#3a2a2a'; g.beginPath(); g.ellipse(0, 0, s * 0.7, s * 0.4, 0, 0, TAU); g.fill();
      g.fillStyle = d.color; g.beginPath(); g.ellipse(-s * 0.55, 0, s * 0.42, s * 0.36, 0, 0, TAU); g.fill();
      g.fillStyle = '#ff7a5a'; g.beginPath(); g.arc(s * 0.6, 0, s * 0.3, 0, TAU); g.fill();
      eyes(g, s * 0.7, -s * 0.08, s * 0.14);
    },
    cicada(g, s, flap, d) {
      legs(g, s, 3, '#2a1a10', 0.3, 0.4);
      g.fillStyle = d.color2; g.strokeStyle = 'rgba(40,30,20,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(-s * 0.35, -s * 0.25 - s * 0.2 * flap, s * 0.85, s * 0.32, -0.15 - flap * 0.2, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = d.color; g.beginPath(); g.ellipse(-s * 0.05, 0, s * 0.7, s * 0.42, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-s * 0.5, -s * 0.05, s * 0.8, s * 0.06);
      g.fillStyle = d.color; g.beginPath(); g.ellipse(s * 0.6, 0, s * 0.25, s * 0.38, 0, 0, TAU); g.fill();
      eyes(g, s * 0.68, -s * 0.25, s * 0.13);
    },
    beetle(g, s, flap, d, time) {
      g.fillStyle = 'rgba(230,240,255,0.55)';
      g.beginPath(); g.ellipse(-s * 0.2, -s * 0.6 * flap, s * 0.6, s * 0.35 * flap, -0.3, 0, TAU); g.fill();
      legs(g, s, 3, '#1c1830', 0.3, 0.45);
      shell(g, s, d, time, 0.85, 0.6);
      g.fillStyle = d.gold ? '#b8860b' : d.rainbow ? '#2a6a8a' : d.color; g.beginPath(); g.arc(s * 0.75, 0, s * 0.32, 0, TAU); g.fill();
      eyes(g, s * 0.85, -s * 0.1, s * 0.13);
      if (d.gold || d.rainbow) { g.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(time * 8)})`; star(g, -s * 0.2, -s * 0.2, s * 0.25); }
    },
    stag(g, s, flap, d, time) {
      const j = d.jaw || 1;
      g.strokeStyle = d.color; g.lineWidth = Math.max(2, s * 0.13 * j); g.lineCap = 'round';
      for (const k of [-1, 1]) {
        g.beginPath(); g.moveTo(s * 0.95, k * s * 0.14); g.quadraticCurveTo(s * (1.05 + 0.45 * j), k * s * 0.55 * j, s * (1.05 + 0.75 * j), k * s * 0.2); g.stroke();
        if (d.saw) { g.lineWidth = 1.5; for (let i = 1; i < 4; i++) { const x = s * (0.95 + i * 0.13 * j); g.beginPath(); g.moveTo(x, k * s * 0.3 * j); g.lineTo(x, k * s * 0.15 * j); g.stroke(); } g.lineWidth = Math.max(2, s * 0.13 * j); }
      }
      legs(g, s, 3, '#1c1410', 0.3, 0.5);
      shell(g, s, d, time, 0.85, 0.6);
      g.fillStyle = d.color; g.beginPath(); g.ellipse(s * 0.75, 0, s * 0.36, s * 0.32, 0, 0, TAU); g.fill();
      if (d.crown) { g.fillStyle = d.color2; g.beginPath(); g.ellipse(s * 0.7, -s * 0.3, s * 0.25, s * 0.08, 0, 0, TAU); g.fill(); }
      eyes(g, s * 0.88, -s * 0.12, s * 0.12);
    },
    rhino(g, s, flap, d, time) {
      legs(g, s, 3, '#1c1410', 0.3, 0.5);
      shell(g, s, d, time, 0.9, 0.62);
      g.fillStyle = d.color; g.beginPath(); g.ellipse(s * 0.72, -s * 0.02, s * 0.36, s * 0.34, 0, 0, TAU); g.fill();
      g.strokeStyle = d.horn === 'hercules' ? d.color2 : d.color; g.lineCap = 'round';
      g.lineWidth = Math.max(2.5, s * 0.16);
      if (d.horn === 'kabuto') {
        g.beginPath(); g.moveTo(s * 0.9, s * 0.05); g.quadraticCurveTo(s * 1.35, -s * 0.1, s * 1.45, -s * 0.65); g.stroke();
        g.lineWidth = Math.max(1.5, s * 0.1);
        g.beginPath(); g.moveTo(s * 1.45, -s * 0.65); g.lineTo(s * 1.6, -s * 0.8); g.moveTo(s * 1.45, -s * 0.65); g.lineTo(s * 1.3, -s * 0.85); g.stroke();
        g.beginPath(); g.moveTo(s * 0.75, -s * 0.3); g.lineTo(s * 0.95, -s * 0.5); g.stroke();
      } else if (d.horn === 'hercules') {
        g.beginPath(); g.moveTo(s * 0.5, -s * 0.3); g.quadraticCurveTo(s * 1.4, -s * 0.7, s * 1.9, -s * 0.15); g.stroke();
        g.strokeStyle = d.color; g.lineWidth = Math.max(2, s * 0.12);
        g.beginPath(); g.moveTo(s * 0.95, s * 0.05); g.quadraticCurveTo(s * 1.4, -s * 0.05, s * 1.6, -s * 0.3); g.stroke();
      } else {
        for (const [y0, x1, y1] of [[-0.3, 1.5, -0.75], [0.05, 1.55, 0.0], [0.25, 1.35, 0.45]]) {
          g.beginPath(); g.moveTo(s * 0.8, s * y0); g.quadraticCurveTo(s * 1.2, s * (y0 + y1) / 2 - s * 0.15, s * x1, s * y1); g.stroke();
        }
      }
      eyes(g, s * 0.85, -s * 0.12, s * 0.11);
    },
  };

  function drawCocoon(g, s, t, time) {
    const k = Math.min(1, t / 0.35);
    const w = s * (1.1 - 0.3 * k), h = s * (0.85 - 0.1 * k);
    g.fillStyle = 'rgba(255,255,255,0.97)';
    g.beginPath(); g.ellipse(0, 0, w, h, 0.3, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(160,170,200,0.8)'; g.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      g.beginPath(); g.ellipse(0, 0, w, h * 0.35, 0.3 + i * 0.35 + time * 6 * (1 - k), 0, TAU); g.stroke();
    }
  }

  function star(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  }

  // ---------- glowing spool (bonus time special) ----------
  function drawSpool(g, it, time) {
    g.save(); g.translate(it.x, it.y);
    const pulse = 1 + 0.08 * Math.sin(time * 8);
    g.rotate(time * 0.8);
    g.fillStyle = 'rgba(255,230,120,0.35)';
    for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(-5, 40 * pulse); g.lineTo(5, 40 * pulse); g.closePath(); g.fill(); }
    g.restore();
    g.save(); g.translate(it.x, it.y); g.scale(pulse, pulse);
    const gl = g.createRadialGradient(0, 0, 3, 0, 0, 30);
    gl.addColorStop(0, 'rgba(255,250,200,0.95)'); gl.addColorStop(1, 'rgba(255,220,90,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
    g.fillStyle = '#c98a3b'; g.fillRect(-12, -14, 24, 5); g.fillRect(-12, 9, 24, 5);
    g.fillStyle = '#fff2a0'; g.fillRect(-9, -9, 18, 18);
    g.strokeStyle = '#ffc93a'; g.lineWidth = 1.2;
    for (let y = -6; y <= 6; y += 3) { g.beginPath(); g.moveTo(-9, y); g.lineTo(9, y + 1.5); g.stroke(); }
    g.restore();
    g.save();
    g.font = '900 13px ' + (root.SH.FONT || 'sans-serif'); g.textAlign = 'center';
    g.lineWidth = 3; g.strokeStyle = 'rgba(40,30,60,0.8)'; g.strokeText('TAP!', it.x, it.y - 30);
    g.fillStyle = '#fff6c2'; g.fillText('TAP!', it.x, it.y - 30);
    g.restore();
  }

  // ---------- treats (bonus time) ----------
  function drawTreat(g, tr, time) {
    const d = tr.def;
    g.save(); g.translate(tr.x, tr.y); g.rotate(tr.rot);
    const glow = g.createRadialGradient(0, 0, 2, 0, 0, 26);
    glow.addColorStop(0, 'rgba(255,255,255,0.7)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
    if (d.id === 'candy') {
      g.fillStyle = d.color;
      g.beginPath(); g.moveTo(-10, 0); g.lineTo(-18, -8); g.lineTo(-18, 8); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(10, 0); g.lineTo(18, -8); g.lineTo(18, 8); g.closePath(); g.fill();
      g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill();
      g.strokeStyle = d.color2; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 6, 0.3, 2.5); g.stroke();
    } else if (d.id === 'lolli') {
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 6); g.lineTo(0, 22); g.stroke();
      g.fillStyle = d.color; g.beginPath(); g.arc(0, -2, 11, 0, TAU); g.fill();
      g.strokeStyle = d.color2; g.lineWidth = 2.5; g.beginPath();
      for (let a = 0; a < 12; a += 0.3) g.lineTo(Math.cos(a) * a * 0.9, -2 + Math.sin(a) * a * 0.9);
      g.stroke();
    } else if (d.id === 'cookie') {
      g.fillStyle = d.color; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
      g.fillStyle = d.color2;
      for (const [x, y] of [[-4, -4], [5, -2], [-2, 5], [4, 6], [-7, 2]]) { g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill(); }
    } else if (d.id === 'donut') {
      g.fillStyle = d.color2; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.arc(0, 0, 4.5, 0, TAU, true); g.fill('evenodd');
      g.fillStyle = d.color; g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.arc(0, 0, 5.5, 0, TAU, true); g.fill('evenodd');
      const sp = ['#fff', '#7cc8ff', '#ffe066'];
      for (let i = 0; i < 8; i++) { const a = i * 0.8; g.fillStyle = sp[i % 3]; g.fillRect(Math.cos(a) * 8 - 1, Math.sin(a) * 8 - 1, 2.5, 2.5); }
    } else {
      g.fillStyle = d.color; star(g, 0, 0, 14 + Math.sin(time * 6) * 1.5);
      g.fillStyle = d.color2; star(g, 0, 0, 6);
    }
    g.restore();
  }

  root.SH = root.SH || {};
  root.SH.render = { makeBackground, drawSeason, drawThreads, drawSpool, drawNodes, drawKnot, drawSpider, drawInsect, drawTreat, star, heart, TAU };
})(typeof globalThis !== 'undefined' ? globalThis : this);
