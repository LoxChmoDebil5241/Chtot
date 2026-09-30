/* К-47 — рендер: запекание карты, кадр, эффекты, камера, миникарта */
'use strict';
(function () {
  const U = K.util, Hx = K.hex, Nz = K.noise, D = K.data, G = K.game, SP = K.sprites;
  const R = K.render = {};
  const SZ = Hx.SIZE;

  let cv, ctx, W = 0, H = 0, DPR = 1;
  R.cam = { x: 0, y: 0, z: 1, tx: null, ty: null, shake: 0 };
  R.ov = {}; // оверлеи интерфейса
  R.speed = 1;
  let terrainCv = null, decalCv = null, gridCv = null, lightCv = null, miniCv = null, miniBase = null;
  let worldW = 0, worldH = 0;
  let parts = [], tracers = [], texts = [], flashes = [], lights = [], weather = [];
  let last = 0, running = false;
  let anims = []; // активные анимации движения/смерти

  /* ---------- Инициализация ---------- */
  R.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    R.resize();
    window.addEventListener('resize', R.resize);
    lightCv = document.createElement('canvas');
    if (!running) { running = true; requestAnimationFrame(frame); }
  };
  R.resize = function () {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth || window.innerWidth; H = cv.clientHeight || window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    if (lightCv) { lightCv.width = Math.ceil(W / 2); lightCv.height = Math.ceil(H / 2); }
    initWeather();
  };
  R.size = () => [W, H];

  /* ---------- Координаты ---------- */
  R.toScreen = (wx, wy) => {
    const c = R.cam;
    return [(wx - c.x) * c.z + W / 2, (wy - c.y) * c.z + H / 2];
  };
  R.toWorld = (sx, sy) => {
    const c = R.cam;
    return [(sx - W / 2) / c.z + c.x, (sy - H / 2) / c.z + c.y];
  };
  R.hexAtScreen = (sx, sy) => { const w = R.toWorld(sx, sy); return Hx.fromPixel(w[0], w[1]); };
  R.clampCam = () => {
    const c = R.cam;
    const hw = W / 2 / c.z, hh = H / 2 / c.z;
    const padX = Math.max(0, hw - worldW / 2), padY = Math.max(0, hh - worldH / 2);
    c.x = U.clamp(c.x, hw - 30 - padX, worldW - hw + 30 + padX);
    c.y = U.clamp(c.y, hh - 30 - padY, worldH - hh + 130 + padY);
    if (worldW < hw * 2) c.x = worldW / 2;
  };
  R.centerOn = function (c, r, instant) {
    const p = Hx.center(c, r);
    if (instant) { R.cam.x = p[0]; R.cam.y = p[1]; R.cam.tx = null; R.clampCam(); }
    else { R.cam.tx = p[0]; R.cam.ty = p[1]; }
  };
  R.onScreen = (c, r, margin) => {
    const p = Hx.center(c, r); const s = R.toScreen(p[0], p[1]);
    margin = margin || 60;
    return s[0] > margin && s[0] < W - margin && s[1] > margin && s[1] < H - 140;
  };

  /* ---------- Палитры ---------- */
  const PAL = {
    surface: {
      '.': [134, 152, 170], ',': [178, 192, 207], '^': [146, 165, 183], 'A': [72, 70, 78], '~': [12, 22, 38],
      '=': [108, 120, 133], 'o': [110, 132, 122], 'x': [96, 102, 110]
    },
    under: {
      '#': [14, 22, 33], '.': [78, 88, 100], '=': [84, 90, 100], 'r': [78, 88, 100], 't': [60, 68, 78],
      'k': [92, 124, 150], 'g': [74, 106, 84], 'w': [14, 56, 70], 'v': [3, 5, 9], 'b': [78, 88, 100]
    }
  };

  /* ---------- Запекание карты ---------- */
  R.bake = function () {
    const S = G.state();
    const ws = Hx.worldSize(S.W, S.H);
    worldW = Math.ceil(ws[0]); worldH = Math.ceil(ws[1]);
    terrainCv = document.createElement('canvas'); terrainCv.width = worldW; terrainCv.height = worldH;
    decalCv = document.createElement('canvas'); decalCv.width = worldW; decalCv.height = worldH;
    bakeRegion(0, 0, worldW, worldH);
    bakeGrid();
    bakeMini();
    parts = []; tracers = []; texts = []; flashes = []; lights = []; anims = [];
    initWeather();
  };

  function terrainAtPx(S, px, py) {
    const h = Hx.fromPixel(px, py);
    const c = U.clamp(h[0], 0, S.W - 1), r = U.clamp(h[1], 0, S.H - 1);
    return S.terrain[r * S.W + c];
  }

  function bakeRegion(x0, y0, x1, y1) {
    const S = G.state();
    const env = S.env;
    const pal = PAL[env];
    const tctx = terrainCv.getContext('2d');
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(worldW, Math.ceil(x1)); y1 = Math.min(worldH, Math.ceil(y1));
    const q = 0.5, bp = 24;
    const cx0 = x0 - bp, cy0 = y0 - bp, cx1 = x1 + bp, cy1 = y1 + bp;
    const bw = Math.ceil((cx1 - cx0) * q), bh = Math.ceil((cy1 - cy0) * q);
    if (bw <= 0 || bh <= 0) return;
    const base = document.createElement('canvas'); base.width = bw; base.height = bh;
    const bctx = base.getContext('2d');
    const img = bctx.createImageData(bw, bh);
    const d = img.data;
    const N = bw * bh;
    const codes = new Array(N);
    const wall = new Uint8Array(N);
    Nz.seed(S.m.seed);
    const under = env === 'under';
    const amp = under ? 22 : 70, amp2 = under ? 7 : 16;
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        const px = cx0 + bx / q, py = cy0 + by / q;
        const wx = px + (Nz.fbm(px * 0.011, py * 0.011, 3) - 0.5) * amp + (Nz.value(px * 0.05, py * 0.05) - 0.5) * amp2;
        const wy = py + (Nz.fbm(px * 0.011 + 40, py * 0.011 + 17, 3) - 0.5) * amp + (Nz.value(px * 0.05 + 9, py * 0.05 + 3) - 0.5) * amp2;
        const t = terrainAtPx(S, wx, wy);
        const j = by * bw + bx;
        codes[j] = t;
        if (under && (t === '#')) wall[j] = 1;
      }
    }
    // поле расстояний до стены (для кромки льда и затенения)
    let dist = null, distW = null;
    if (under) {
      dist = new Uint8Array(N).fill(255); distW = new Uint8Array(N).fill(255);
      for (let j = 0; j < N; j++) { if (wall[j]) dist[j] = 0; else distW[j] = 0; }
      const pass = (arr) => {
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const j = y * bw + x; let v = arr[j];
          if (x > 0 && arr[j - 1] + 1 < v) v = arr[j - 1] + 1;
          if (y > 0 && arr[j - bw] + 1 < v) v = arr[j - bw] + 1;
          if (x > 0 && y > 0 && arr[j - bw - 1] + 1 < v) v = arr[j - bw - 1] + 1;
          if (x < bw - 1 && y > 0 && arr[j - bw + 1] + 1 < v) v = arr[j - bw + 1] + 1;
          arr[j] = v;
        }
        for (let y = bh - 1; y >= 0; y--) for (let x = bw - 1; x >= 0; x--) {
          const j = y * bw + x; let v = arr[j];
          if (x < bw - 1 && arr[j + 1] + 1 < v) v = arr[j + 1] + 1;
          if (y < bh - 1 && arr[j + bw] + 1 < v) v = arr[j + bw] + 1;
          if (x < bw - 1 && y < bh - 1 && arr[j + bw + 1] + 1 < v) v = arr[j + bw + 1] + 1;
          if (x > 0 && y < bh - 1 && arr[j + bw - 1] + 1 < v) v = arr[j + bw - 1] + 1;
          arr[j] = v;
        }
      };
      pass(dist); pass(distW);
    }
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        const px = cx0 + bx / q, py = cy0 + by / q;
        const j = by * bw + bx;
        const t = codes[j];
        const col = pal[t] || pal['.'];
        const n = Nz.fbm(px * 0.035, py * 0.035, 4);
        const n2 = Nz.value(px * 0.2, py * 0.2);
        let r = col[0], g = col[1], b = col[2];
        let k = (n - 0.5) * 34 + (n2 - 0.5) * 8;
        if (!under) {
          if (t === '.' || t === '=' || t === '^') {
            const streak = Nz.ridge(px * 0.012 + 3, py * 0.03, 3);
            k += (streak - 0.6) * 30;
          }
          if (t === ',') k = (n - 0.5) * 22 + (n2 - 0.5) * 10;
          if (t === '~') k *= 0.3;
          const cloud = Nz.fbm(px * 0.0035 + 9, py * 0.0035 + 3, 3);
          const sh = 0.72 + 0.34 * U.clamp((cloud - 0.35) * 2.2, 0, 1);
          r = (r + k) * sh; g = (g + k) * sh; b = (b + k * 1.1) * sh;
        } else {
          if (t === '#') {
            const v = Nz.ridge(px * 0.02, py * 0.02, 4);
            k = (v - 0.55) * 50;
            r += k * 0.5; g += k * 0.7; b += k * 0.9;
            const dw = distW[j];
            if (dw <= 5) { const f = (6 - dw) / 6; r += f * 34; g += f * 52; b += f * 70; }
            if (dw <= 1) { r += 60; g += 80; b += 90; }
          } else if (t === 'k') {
            const v = Nz.ridge(px * 0.03, py * 0.05, 3);
            r += (v - 0.5) * 40; g += (v - 0.5) * 50; b += (v - 0.5) * 60;
          } else if (t === 'w') {
            const v = Nz.fbm(px * 0.05, py * 0.05, 3);
            r += (v - 0.5) * 12; g += (v - 0.5) * 30; b += (v - 0.5) * 36;
          } else { r += k; g += k; b += k * 1.05; }
          if (t !== '#') {
            const dd = dist[j];
            if (dd <= 9) { const f = 0.5 + 0.5 * (dd / 9); r *= f; g *= f; b *= f; }
          }
          const amb = 0.88 + 0.2 * Nz.fbm(px * 0.006, py * 0.006, 2);
          r *= amb; g *= amb; b *= amb;
        }
        const i = j * 4;
        d[i] = U.clamp(r, 0, 255); d[i + 1] = U.clamp(g, 0, 255); d[i + 2] = U.clamp(b, 0, 255); d[i + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);
    tctx.save();
    tctx.beginPath(); tctx.rect(x0, y0, x1 - x0, y1 - y0); tctx.clip();
    tctx.imageSmoothingEnabled = true;
    tctx.filter = env === 'surface' ? 'blur(5px)' : 'blur(1.5px)';
    tctx.drawImage(base, cx0, cy0, cx1 - cx0, cy1 - cy0);
    tctx.filter = 'none';
    // детали для всех гексов, задевающих область
    const pad = SZ * 2;
    for (let r = 0; r < S.H; r++) for (let c = 0; c < S.W; c++) {
      const p = Hx.center(c, r);
      if (p[0] < x0 - pad || p[0] > x1 + pad || p[1] < y0 - pad || p[1] > y1 + pad) continue;
      decorate(tctx, S, c, r, p[0], p[1], 0);
    }
    for (let r = 0; r < S.H; r++) for (let c = 0; c < S.W; c++) {
      const p = Hx.center(c, r);
      if (p[0] < x0 - pad || p[0] > x1 + pad || p[1] < y0 - pad || p[1] > y1 + pad) continue;
      decorate(tctx, S, c, r, p[0], p[1], 1);
    }
    drawRoads(tctx, S, x0, y0, x1, y1);
    // лампы
    if (env === 'under') {
      S.lamps.forEach(l => {
        const p = Hx.center(l[0], l[1]);
        if (p[0] < x0 - 120 || p[0] > x1 + 120 || p[1] < y0 - 120 || p[1] > y1 + 120) return;
        const g = tctx.createRadialGradient(p[0], p[1], 2, p[0], p[1], 90);
        g.addColorStop(0, 'rgba(255,214,140,0.28)'); g.addColorStop(1, 'rgba(255,214,140,0)');
        tctx.fillStyle = g; tctx.fillRect(p[0] - 90, p[1] - 90, 180, 180);
      });
    }
    // строения
    S.structs.forEach(st => {
      const p = Hx.center(st.c, st.r);
      if (p[0] < x0 - pad || p[0] > x1 + pad || p[1] < y0 - pad || p[1] > y1 + pad) return;
      SP.drawStruct(tctx, st, p[0], p[1], U.rng(S.m.seed + st.c * 131 + st.r * 17), env);
    });
    tctx.restore();
  }

  function smoothPts(pts) {
    let p = pts.map(h => Hx.center(h[0], h[1]));
    for (let it = 0; it < 2; it++) {
      const o = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      o.push(p[p.length - 1]);
      p = o;
    }
    return p;
  }
  function strokePts(t, pts, off) {
    t.beginPath();
    for (let i = 0; i < pts.length; i++) {
      let x = pts[i][0], y = pts[i][1];
      if (off) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        x += -dy / L * off; y += dx / L * off;
      }
      i ? t.lineTo(x, y) : t.moveTo(x, y);
    }
    t.stroke();
  }
  function drawRoads(t, S, x0, y0, x1, y1) {
    void x0; void y0; void x1; void y1;
    t.lineCap = 'round'; t.lineJoin = 'round';
    (S.roads || []).forEach(rd => {
      const pts = smoothPts(rd.pts);
      if (S.env === 'surface') {
        t.strokeStyle = 'rgba(58,66,78,0.9)'; t.lineWidth = 22; strokePts(t, pts);
        t.strokeStyle = '#7a8591'; t.lineWidth = 16; strokePts(t, pts);
        t.strokeStyle = 'rgba(160,172,186,0.35)'; t.lineWidth = 2; strokePts(t, pts, 0);
        t.setLineDash([4, 5]); t.strokeStyle = 'rgba(48,56,66,0.55)'; t.lineWidth = 1.4;
        strokePts(t, pts, 4.5); strokePts(t, pts, -4.5);
        t.setLineDash([]);
      } else {
        const tracks = rd.w ? [-16, 16] : [0];
        tracks.forEach(o => {
          t.setLineDash([3, 9]); t.strokeStyle = '#3b2e22'; t.lineWidth = 16; strokePts(t, pts, o); t.setLineDash([]);
          t.strokeStyle = '#9aa2ab'; t.lineWidth = 1.8; strokePts(t, pts, o - 5); strokePts(t, pts, o + 5);
        });
        if (rd.w) { t.strokeStyle = 'rgba(255,176,0,0.35)'; t.lineWidth = 2; t.setLineDash([10, 10]); strokePts(t, pts, 34); strokePts(t, pts, -34); t.setLineDash([]); }
      }
    });
    (S.pipes || []).forEach(pp => {
      const pts = smoothPts(pp);
      t.strokeStyle = 'rgba(20,24,30,0.5)'; t.lineWidth = 7; strokePts(t, pts, -9);
      t.strokeStyle = '#56616d'; t.lineWidth = 4.5; strokePts(t, pts, -10);
      t.strokeStyle = '#2f6d9c'; t.lineWidth = 2.5; strokePts(t, pts, 9);
      t.strokeStyle = 'rgba(255,255,255,0.15)'; t.lineWidth = 1; strokePts(t, pts, -11);
    });
  }

  function isT(S, c, r, set) {
    if (c < 0 || r < 0 || c >= S.W || r >= S.H) return false;
    return set.indexOf(S.terrain[r * S.W + c]) >= 0;
  }

  function decorate(tctx, S, c, r, x, y, pass) {
    const t = S.terrain[r * S.W + c];
    const rnd = U.rng(S.m.seed * 7 + c * 928371 + r * 1237 + pass * 31);
    const env = S.env;
    const nb = Hx.neighbors(c, r);
    if (env === 'surface') {
      if (pass === 0) {
        if (t === '~') {
          tctx.fillStyle = '#07101c';
          nb.forEach(p => { if (isT(S, p[0], p[1], '~')) { const q = Hx.center(p[0], p[1]); tctx.strokeStyle = '#07101c'; tctx.lineWidth = SZ * 0.9; tctx.lineCap = 'round'; tctx.beginPath(); tctx.moveTo(x, y); tctx.lineTo((x + q[0]) / 2, (y + q[1]) / 2); tctx.stroke(); } });
          tctx.beginPath();
          for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const rr2 = SZ * (0.55 + rnd() * 0.25); i ? tctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2) : tctx.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
          tctx.closePath(); tctx.fill();
        }
      } else {
        if (t === '~') {
          tctx.strokeStyle = 'rgba(90,170,230,0.35)'; tctx.lineWidth = 1.5;
          nb.forEach(p => { if (isT(S, p[0], p[1], '~')) { const q = Hx.center(p[0], p[1]); tctx.beginPath(); tctx.moveTo(x + (rnd() - 0.5) * 6, y + (rnd() - 0.5) * 6); tctx.lineTo((x + q[0]) / 2, (y + q[1]) / 2); tctx.stroke(); } });
          tctx.strokeStyle = 'rgba(220,235,250,0.25)'; tctx.lineWidth = 1;
          nb.forEach(p => { if (!isT(S, p[0], p[1], '~')) { const q = Hx.center(p[0], p[1]); const mx = x + (q[0] - x) * 0.42, my = y + (q[1] - y) * 0.42; tctx.beginPath(); tctx.arc(mx, my, 6 + rnd() * 5, 0, Math.PI * 2); tctx.stroke(); } });
        }
        if (t === '^') {
          const n = 5 + Math.floor(rnd() * 4);
          for (let i = 0; i < n; i++) {
            const a = rnd() * Math.PI * 2, d = rnd() * SZ * 0.62;
            const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
            const h = 8 + rnd() * 12, w = 5 + rnd() * 6;
            tctx.fillStyle = 'rgba(15,25,40,0.35)';
            tctx.beginPath(); tctx.moveTo(sx - w, sy); tctx.lineTo(sx + w * 0.3 + 7, sy - h * 0.4 + 6); tctx.lineTo(sx + w + 6, sy + 5); tctx.closePath(); tctx.fill();
            tctx.fillStyle = '#6f879c'; tctx.beginPath(); tctx.moveTo(sx - w, sy); tctx.lineTo(sx + w * 0.2, sy - h); tctx.lineTo(sx + w, sy); tctx.closePath(); tctx.fill();
            tctx.fillStyle = '#d7e4ef'; tctx.beginPath(); tctx.moveTo(sx - w, sy); tctx.lineTo(sx + w * 0.2, sy - h); tctx.lineTo(sx - w * 0.1, sy + 1); tctx.closePath(); tctx.fill();
            tctx.strokeStyle = 'rgba(255,255,255,0.5)'; tctx.lineWidth = 0.8; tctx.beginPath(); tctx.moveTo(sx - w, sy); tctx.lineTo(sx + w * 0.2, sy - h); tctx.stroke();
          }
        }
        if (t === 'A') {
          const n = 3 + Math.floor(rnd() * 3);
          for (let i = 0; i < n; i++) {
            const a = rnd() * Math.PI * 2, d = rnd() * SZ * 0.55;
            const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d, s = 6 + rnd() * 9;
            tctx.fillStyle = 'rgba(10,12,18,0.4)'; tctx.beginPath(); tctx.ellipse(sx + 4, sy + 5, s, s * 0.6, 0, 0, Math.PI * 2); tctx.fill();
            tctx.fillStyle = '#3b3940'; tctx.beginPath();
            for (let k = 0; k < 7; k++) { const aa = k / 7 * Math.PI * 2; const rr2 = s * (0.7 + rnd() * 0.3); k ? tctx.lineTo(sx + Math.cos(aa) * rr2, sy + Math.sin(aa) * rr2 * 0.8) : tctx.moveTo(sx + Math.cos(aa) * rr2, sy + Math.sin(aa) * rr2 * 0.8); }
            tctx.closePath(); tctx.fill();
            tctx.fillStyle = 'rgba(160,160,175,0.35)'; tctx.beginPath(); tctx.ellipse(sx - s * 0.25, sy - s * 0.3, s * 0.45, s * 0.25, -0.3, 0, Math.PI * 2); tctx.fill();
          }
        }
        if (t === 'o') {
          for (let i = 0; i < 9; i++) {
            const sx = x + (rnd() - 0.5) * SZ * 1.2, sy = y + (rnd() - 0.5) * SZ;
            tctx.strokeStyle = 'rgba(190,230,200,0.35)'; tctx.lineWidth = 1;
            tctx.beginPath(); tctx.arc(sx, sy, 1.5 + rnd() * 3, 0, Math.PI * 2); tctx.stroke();
          }
          tctx.strokeStyle = 'rgba(30,50,40,0.5)'; tctx.lineWidth = 1;
          tctx.beginPath(); tctx.moveTo(x - 14, y + rnd() * 8); tctx.lineTo(x, y - 4); tctx.lineTo(x + 16, y + rnd() * 10); tctx.stroke();
        }
        if (t === 'x') {
          for (let i = 0; i < 2; i++) {
            const sx = x + (rnd() - 0.5) * SZ * 0.9, sy = y + (rnd() - 0.5) * SZ * 0.7, s = 7 + rnd() * 8;
            const g = tctx.createRadialGradient(sx, sy, 1, sx, sy, s);
            g.addColorStop(0, 'rgba(20,20,25,0.8)'); g.addColorStop(0.7, 'rgba(40,40,48,0.5)'); g.addColorStop(1, 'rgba(200,210,220,0.25)');
            tctx.fillStyle = g; tctx.beginPath(); tctx.arc(sx, sy, s, 0, Math.PI * 2); tctx.fill();
          }
        }
        if (t === ',' || t === '.') {
          const n = t === ',' ? 10 : 3;
          for (let i = 0; i < n; i++) {
            tctx.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.4})`;
            tctx.fillRect(x + (rnd() - 0.5) * SZ * 1.5, y + (rnd() - 0.5) * SZ * 1.3, 1.2, 1.2);
          }
          if (t === '.' && rnd() < 0.35) {
            tctx.strokeStyle = 'rgba(60,78,96,0.45)'; tctx.lineWidth = 0.8;
            let px = x + (rnd() - 0.5) * SZ, py = y + (rnd() - 0.5) * SZ;
            tctx.beginPath(); tctx.moveTo(px, py);
            for (let k = 0; k < 4; k++) { px += (rnd() - 0.5) * 16; py += (rnd() - 0.5) * 12; tctx.lineTo(px, py); }
            tctx.stroke();
          }
        }
      }
    } else {
      // подземелье
      if (pass === 0) {
        void 0;
      } else {
        if (t === '#') {
          if (rnd() < 0.5) {
            tctx.strokeStyle = 'rgba(120,170,210,0.18)'; tctx.lineWidth = 1;
            let px = x + (rnd() - 0.5) * SZ, py = y + (rnd() - 0.5) * SZ;
            tctx.beginPath(); tctx.moveTo(px, py);
            for (let k = 0; k < 5; k++) { px += (rnd() - 0.5) * 20; py += (rnd() - 0.5) * 20; tctx.lineTo(px, py); }
            tctx.stroke();
          }
        }
        if (t === 'k') {
          tctx.strokeStyle = 'rgba(210,235,255,0.22)'; tctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) { tctx.beginPath(); tctx.arc(x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 30, 5 + rnd() * 10, rnd() * 6, rnd() * 6 + 1.5); tctx.stroke(); }
        }
        if (t === 'g') {
          const g = tctx.createRadialGradient(x, y, 2, x, y, SZ);
          g.addColorStop(0, 'rgba(150,230,150,0.25)'); g.addColorStop(1, 'rgba(150,230,150,0)');
          tctx.fillStyle = g; tctx.beginPath(); tctx.arc(x, y, SZ, 0, Math.PI * 2); tctx.fill();
          for (let i = 0; i < 7; i++) { tctx.strokeStyle = 'rgba(200,255,200,0.35)'; tctx.lineWidth = 1; tctx.beginPath(); tctx.arc(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 34, 1.5 + rnd() * 2.5, 0, Math.PI * 2); tctx.stroke(); }
          tctx.fillStyle = 'rgba(255,200,60,0.8)'; tctx.font = 'bold 9px sans-serif'; tctx.textAlign = 'center'; tctx.fillText('CH₄', x, y + 3);
        }
        if (t === 'w') {
          tctx.strokeStyle = 'rgba(120,220,230,0.25)'; tctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) { const sx = x + (rnd() - 0.5) * 30, sy = y + (rnd() - 0.5) * 24; tctx.beginPath(); tctx.ellipse(sx, sy, 8 + rnd() * 6, 3, 0, 0, Math.PI * 2); tctx.stroke(); }
        }
        if (t === 'v') {
          nb.forEach(p => {
            if (isT(S, p[0], p[1], 'v#')) return;
            const q = Hx.center(p[0], p[1]);
            tctx.strokeStyle = 'rgba(120,190,240,0.45)'; tctx.lineWidth = 2; tctx.beginPath();
            tctx.arc(x + (q[0] - x) * 0.45, y + (q[1] - y) * 0.45, 10, 0, Math.PI * 2); tctx.stroke();
          });
        }
        if (t === 'b') {
          for (let i = 0; i < 3; i++) {
            const sx = x - 16 + i * 11 + (rnd() - 0.5) * 4, sy = y - 6 + (rnd() - 0.5) * 12;
            tctx.fillStyle = 'rgba(0,0,0,0.35)'; tctx.fillRect(sx + 3, sy + 4, 11, 9);
            tctx.fillStyle = '#7d7d78'; tctx.fillRect(sx, sy, 11, 9);
            tctx.fillStyle = '#9d9d96'; tctx.fillRect(sx, sy, 11, 3);
            tctx.fillStyle = '#ffb000'; tctx.fillRect(sx + 1, sy + 6, 9, 1);
          }
        }
        if (t === 'r') {
          tctx.fillStyle = '#3a414a'; tctx.fillRect(x - 14, y + 8, 28, 6);
          tctx.fillStyle = '#56606b'; tctx.fillRect(x - 14, y + 8, 28, 2);
          tctx.fillStyle = '#2f6d9c'; tctx.fillRect(x - 12, y + 11, 8, 2);
        }
        if (t === '.' && rnd() < 0.25) {
          tctx.fillStyle = 'rgba(160,200,230,0.18)';
          for (let i = 0; i < 6; i++) tctx.fillRect(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 34, 1.5, 1.5);
        }
      }
    }
    // лампы-светильники
    if (pass === 1 && env === 'under' && S.lamps.some(l => l[0] === c && l[1] === r)) {
      tctx.fillStyle = '#2a2f36'; tctx.fillRect(x - 3, y - SZ * 0.55, 6, 5);
      tctx.fillStyle = '#ffd98a'; tctx.shadowColor = '#ffcf5a'; tctx.shadowBlur = 10;
      tctx.beginPath(); tctx.arc(x, y - SZ * 0.5 + 5, 2.5, 0, Math.PI * 2); tctx.fill(); tctx.shadowBlur = 0;
    }
  }

  function bakeGrid() {
    const S = G.state();
    gridCv = document.createElement('canvas'); gridCv.width = worldW; gridCv.height = worldH;
    const g = gridCv.getContext('2d');
    g.strokeStyle = S.env === 'surface' ? 'rgba(235,245,255,0.10)' : 'rgba(150,200,255,0.08)';
    g.lineWidth = 1;
    g.beginPath();
    for (let r = 0; r < S.H; r++) for (let c = 0; c < S.W; c++) {
      if (S.env === 'under' && S.terrain[r * S.W + c] === '#') continue;
      const p = Hx.center(c, r);
      Hx.pathHex(g, p[0], p[1], SZ - 0.5);
    }
    g.stroke();
  }

  function bakeMini() {
    const S = G.state();
    miniBase = document.createElement('canvas');
    const k = 180 / worldW;
    miniBase.width = 180; miniBase.height = Math.round(worldH * k);
    const m = miniBase.getContext('2d');
    m.drawImage(terrainCv, 0, 0, miniBase.width, miniBase.height);
    void S;
  }

  R.rebake = function (c, r) {
    if (!terrainCv) return;
    const p = Hx.center(c, r);
    const rad = SZ * 2.4;
    bakeRegion(p[0] - rad, p[1] - rad, p[0] + rad, p[1] + rad);
    bakeGrid(); bakeMini();
  };

  R.decal = function (c, r, kind) {
    if (!decalCv) return;
    const p = Hx.center(c, r);
    const d = decalCv.getContext('2d');
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * 16;
      const s = 2 + Math.random() * 6;
      d.fillStyle = kind === 'ichor' ? `rgba(40,20,70,${0.35 + Math.random() * 0.3})` : kind === 'scorch' ? `rgba(10,10,12,${0.2 + Math.random() * 0.25})` : `rgba(${90 + Math.random() * 40},10,14,${0.35 + Math.random() * 0.35})`;
      d.beginPath(); d.ellipse(p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr * 0.7, s * (kind === 'scorch' ? 3 : 1), s * 0.7 * (kind === 'scorch' ? 3 : 1), a, 0, Math.PI * 2); d.fill();
    }
  };

  /* ---------- Погода ---------- */
  function initWeather() {
    weather = [];
    const S = G.state && G.state();
    if (!S) return;
    const n = S.env === 'surface' ? (S.m.weather === 'storm' ? 220 : 110) : 60;
    for (let i = 0; i < n; i++) weather.push({ x: Math.random() * W, y: Math.random() * H, z: 0.4 + Math.random() * 0.8, p: Math.random() * 6 });
  }

  /* ---------- Частицы и эффекты ---------- */
  function spawn(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = (o.dir != null ? o.dir + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2);
      const sp = (o.speed || 60) * (0.4 + Math.random() * 0.8);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), life: 0, max: (o.life || 0.6) * (0.6 + Math.random() * 0.6), size: (o.size || 2) * (0.6 + Math.random() * 0.8), color: o.color || '#fff', grav: o.grav || 0, drag: o.drag || 1.5, glow: o.glow, fade: o.fade !== false, grow: o.grow || 0 });
    }
  }
  R.spawnParts = spawn;
  R.text = function (c, r, str, color) {
    const p = Hx.center(c, r);
    texts.push({ x: p[0], y: p[1] - 26, text: str, color: color || '#fff', life: 0, max: 1.4 });
  };
  function tracer(x1, y1, x2, y2, o) { tracers.push(Object.assign({ x1, y1, x2, y2, life: 0, max: 0.12, color: '#ffe9a8', width: 1.6 }, o)); }
  function flash(x, y, r, color, max) { flashes.push({ x, y, r, color, life: 0, max: max || 0.08 }); lights.push({ x, y, r: r * 5, life: 0, max: (max || 0.08) * 2.5, color }); }
  R.shake = v => { R.cam.shake = Math.max(R.cam.shake, v); };

  const wait = ms => (G.fast ? Promise.resolve() : U.sleep(ms / R.speed));
  R.wait = wait;

  function visibleU(u) { return u.fac === 'player' || G.seen(u) || G.visibleHex(u.c, u.r); }

  /* ---------- Анимации (хуки игры) ---------- */
  R.animMove = async function (u, path) {
    if (G.fast) return;
    const vis = visibleU(u) || path.some(p => G.visibleHex(p[0], p[1]));
    if (!vis) return;
    const pts = path.map(p => Hx.center(p[0], p[1]));
    const T = G.T(u);
    const per = (T.move === 'air' ? 70 : T.move === 'track' ? 110 : 95) / R.speed;
    const a = { u, pts, t: 0, dur: per * (pts.length - 1) };
    anims.push(a);
    if (K.audio) K.audio.sfx(T.move === 'track' ? 'engine' : T.move === 'air' ? 'jet' : T.beast ? 'skitter' : 'steps');
    await new Promise(res => { a.done = res; });
  };

  function muzzlePoint(u) { const p = Hx.center(u.c, u.r); return [p[0] + (u.facing || 1) * 14, p[1] - 4]; }

  R.animAttack = async function (att, def, dmg, counter) {
    if (G.fast) return;
    const va = visibleU(att), vd = def.gasHex || def.bore ? G.visibleHex(def.c, def.r) : visibleU(def);
    if (!va && !vd) return;
    const T = G.T(att);
    const a = muzzlePoint(att);
    const tp = Hx.center(def.c, def.r);
    const tx = tp[0] + (Math.random() - 0.5) * 8, ty = tp[1] - 4 + (Math.random() - 0.5) * 8;
    const w = T.weapon;
    const au = K.audio;
    if (def.bore) {
      for (let i = 0; i < 10; i++) { spawn(tx, ty, 6, { color: '#cfe8ff', speed: 90, life: 0.5, size: 2.5, grav: 60 }); spawn(tx, ty, 2, { color: '#ffb347', speed: 60, life: 0.3, size: 2, glow: true }); await wait(60); }
      R.shake(4);
      return;
    }
    if (w === 'claw' || w === 'bite' || w === 'tentacle') {
      au && au.sfx(w === 'bite' ? 'bite' : 'claw');
      const lunge = { u: att, lx: (tp[0] - Hx.center(att.c, att.r)[0]) * 0.35, ly: (tp[1] - Hx.center(att.c, att.r)[1]) * 0.35, t: 0, dur: 260 / R.speed, lunge: true };
      anims.push(lunge);
      await wait(130);
      for (let k = 0; k < 3; k++) tracers.push({ x1: tx - 14 + k * 6, y1: ty - 12, x2: tx - 4 + k * 6, y2: ty + 12, life: 0, max: 0.18, color: w === 'tentacle' ? '#6ff5ff' : '#ffffff', width: 2.5 });
      spawn(tx, ty, 10, { color: '#8a0f16', speed: 70, life: 0.6, size: 2.5, grav: 80 });
      await wait(160);
    } else if (w === 'laser') {
      au && au.sfx('laser');
      tracers.push({ x1: a[0], y1: a[1], x2: tx, y2: ty, life: 0, max: 0.35, color: '#5ad1ff', width: 3, beam: true });
      flash(a[0], a[1], 7, '#9fe8ff', 0.12); flash(tx, ty, 6, '#9fe8ff', 0.12);
      spawn(tx, ty, 8, { color: '#bff2ff', speed: 80, life: 0.35, size: 1.8, glow: true });
      await wait(320);
    } else if (w === 'plasma') {
      au && au.sfx('plasma');
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const x = U.lerp(a[0], tx, i / steps), y = U.lerp(a[1], ty, i / steps);
        spawn(x, y, 3, { color: '#fff0b0', speed: 20, life: 0.25, size: 3.5, glow: true });
        lights.push({ x, y, r: 60, life: 0, max: 0.15, color: '#ffcf5a' });
        await wait(18);
      }
      flash(tx, ty, 14, '#ffe08a', 0.2);
      spawn(tx, ty, 18, { color: '#ffb347', speed: 110, life: 0.5, size: 2.5, glow: true });
      R.decal(def.c, def.r, 'scorch');
      await wait(160);
    } else if (w === 'drill') {
      au && au.sfx('drill');
      for (let i = 0; i < 6; i++) { spawn(tx, ty, 5, { color: '#ffb347', speed: 90, life: 0.3, size: 1.8, glow: true }); await wait(50); }
    } else {
      const cfg = {
        smg: { n: 6, gap: 45, snd: 'smg', col: '#ffe9a8' }, vector: { n: 4, gap: 60, snd: 'smg', col: '#ffe0a0' }, rifle: { n: 3, gap: 80, snd: 'rifle', col: '#ffe9a8' },
        shotgun: { n: 1, gap: 0, snd: 'shotgun', col: '#ffd27a', spread: 6 }, mg: { n: 9, gap: 38, snd: 'mg', col: '#ffe9a8' }, sniper: { n: 1, gap: 0, snd: 'sniper', col: '#ffffff', width: 2.2 },
        heavy: { n: 3, gap: 110, snd: 'heavy', col: '#ffd27a', width: 2.4 }, turret: { n: 6, gap: 50, snd: 'mg', col: '#ffe9a8' }, air: { n: 6, gap: 40, snd: 'mg', col: '#ffe9a8' }
      }[w] || { n: 3, gap: 70, snd: 'rifle', col: '#ffe9a8' };
      au && au.sfx(cfg.snd);
      for (let i = 0; i < cfg.n; i++) {
        flash(a[0], a[1], cfg.snd === 'shotgun' || cfg.snd === 'heavy' ? 10 : 6, '#ffd27a', 0.06);
        const spr = cfg.spread || 1;
        for (let k = 0; k < spr; k++) tracer(a[0], a[1], tx + (Math.random() - 0.5) * (spr > 1 ? 22 : 10), ty + (Math.random() - 0.5) * (spr > 1 ? 18 : 8), { color: cfg.col, width: cfg.width || 1.4, max: w === 'sniper' ? 0.25 : 0.1 });
        spawn(tx, ty, 3, { color: '#fff3c0', speed: 70, life: 0.2, size: 1.4, glow: true });
        if (cfg.gap) await wait(cfg.gap);
      }
      await wait(90);
    }
    // попадание
    if (def.gasHex) return;
    const Td = G.T(def);
    if (dmg > 0) {
      if (Td.beast) spawn(tx, ty, 8 + dmg * 2, { color: '#3d2466', speed: 70, life: 0.7, size: 2.5, grav: 90 });
      else if (Td.cls === 'hard') spawn(tx, ty, 8 + dmg * 2, { color: '#ffcc66', speed: 120, life: 0.35, size: 1.6, glow: true });
      else { spawn(tx, ty, 6 + dmg * 2, { color: '#7a0c12', speed: 60, life: 0.7, size: 2.4, grav: 90 }); if (dmg >= 3) R.decal(def.c, def.r, 'blood'); }
      if (vd) R.text(def.c, def.r, '−' + dmg, counter ? '#ffb0a0' : '#ff5a4a');
      au && au.sfx(Td.cls === 'hard' ? 'hitmetal' : 'hit');
      def.flash = 1;
    } else if (vd) { R.text(def.c, def.r, 'РИКОШЕТ', '#c8d4e0'); spawn(tx, ty, 6, { color: '#ffffff', speed: 100, life: 0.2, size: 1.2 }); }
    await wait(220);
  };

  R.animDeath = async function (u, cause) {
    if (G.fast) return;
    if (!visibleU(u) && !G.visibleHex(u.c, u.r)) return;
    const p = Hx.center(u.c, u.r);
    const T = G.T(u);
    const au = K.audio;
    if (T.cls === 'hard' && !T.beast) {
      au && au.sfx('explosion');
      flash(p[0], p[1], 26, '#ffcf5a', 0.25);
      spawn(p[0], p[1], 40, { color: '#ffb347', speed: 160, life: 0.6, size: 3, glow: true });
      spawn(p[0], p[1], 25, { color: 'rgba(40,40,45,0.8)', speed: 50, life: 1.4, size: 6, up: 30, drag: 1, grow: 6 });
      R.decal(u.c, u.r, 'scorch'); R.shake(10);
    } else if (T.beast) {
      au && au.sfx('screech');
      spawn(p[0], p[1], 30, { color: '#2a1646', speed: 90, life: 0.9, size: 3, grav: 60 });
      R.decal(u.c, u.r, 'ichor');
    } else {
      au && au.sfx(cause === 'overdose' ? 'flatline' : 'death');
      spawn(p[0], p[1], 16, { color: '#7a0c12', speed: 60, life: 0.8, size: 2.5, grav: 80 });
      R.decal(u.c, u.r, 'blood');
    }
    const a = { u, t: 0, dur: 450 / R.speed, dying: true };
    anims.push(a);
    await new Promise(res => { a.done = res; });
  };

  R.animExplode = async function (c, r) {
    if (G.fast) return;
    const p = Hx.center(c, r);
    K.audio && K.audio.sfx('explosion');
    flash(p[0], p[1], 40, '#ffcf5a', 0.35);
    spawn(p[0], p[1], 70, { color: '#ffb347', speed: 200, life: 0.7, size: 3.5, glow: true });
    spawn(p[0], p[1], 30, { color: '#ff6a2a', speed: 120, life: 0.5, size: 5, glow: true });
    spawn(p[0], p[1], 30, { color: 'rgba(50,55,60,0.8)', speed: 60, life: 1.8, size: 7, up: 40, drag: 0.8, grow: 10 });
    R.decal(c, r, 'scorch');
    R.shake(14);
    await wait(220);
  };

  R.animSpawn = async function (u, kind) {
    if (G.fast) return;
    const p = Hx.center(u.c, u.r);
    const vis = visibleU(u);
    if (kind === 'pod') {
      const a = { u, t: 0, dur: 700 / R.speed, pod: true };
      anims.push(a);
      K.audio && K.audio.sfx('pod');
      await new Promise(res => { a.done = res; });
      flash(p[0], p[1], 20, '#ffb347', 0.2);
      spawn(p[0], p[1], 30, { color: '#dfe9f3', speed: 120, life: 0.8, size: 2.5, grav: 40 });
      R.shake(6);
    } else if (kind === 'capsule') {
      K.audio && K.audio.sfx('hiss');
      spawn(p[0], p[1], 40, { color: 'rgba(210,235,255,0.7)', speed: 50, life: 1.2, size: 4, up: 20, drag: 1, grow: 5 });
      const a = { u, t: 0, dur: 600 / R.speed, fadeIn: true };
      anims.push(a);
      await new Promise(res => { a.done = res; });
    } else if (kind === 'shaft') {
      K.audio && K.audio.sfx('rumble');
      R.shake(18);
      spawn(p[0], p[1], 50, { color: '#1a2233', speed: 140, life: 1.1, size: 4, grav: 50 });
      const a = { u, t: 0, dur: 900 / R.speed, fadeIn: true, rise: true };
      anims.push(a);
    } else if (kind === 'air') {
      const a = { u, t: 0, dur: 800 / R.speed, flyIn: true };
      anims.push(a);
      if (vis) K.audio && K.audio.sfx('jet');
    } else {
      const a = { u, t: 0, dur: 500 / R.speed, fadeIn: true };
      anims.push(a);
    }
  };

  R.focus = async function (u, c, r) {
    if (G.fast) return;
    const vis = visibleU(u) || G.visibleHex(c, r);
    if (!vis) return;
    if (!R.onScreen(u.c, u.r, 120) || !R.onScreen(c, r, 120)) {
      const p1 = Hx.center(u.c, u.r), p2 = Hx.center(c, r);
      R.cam.tx = (p1[0] + p2[0]) / 2; R.cam.ty = (p1[1] + p2[1]) / 2;
      await wait(320);
    } else await wait(90);
  };

  /* ---------- Кадр ---------- */
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    const S = G.state && G.state();
    if (!S || !terrainCv || R.paused) return;
    update(dt);
    draw(S, ts / 1000);
  }

  function update(dt) {
    const c = R.cam;
    if (c.tx != null) {
      c.x += (c.tx - c.x) * Math.min(1, dt * 7);
      c.y += (c.ty - c.y) * Math.min(1, dt * 7);
      if (Math.abs(c.tx - c.x) < 1 && Math.abs(c.ty - c.y) < 1) c.tx = null;
    }
    if (R.keys) {
      const sp = 520 * dt / c.z;
      if (R.keys.left) { c.x -= sp; c.tx = null; }
      if (R.keys.right) { c.x += sp; c.tx = null; }
      if (R.keys.up) { c.y -= sp; c.tx = null; }
      if (R.keys.down) { c.y += sp; c.tx = null; }
    }
    R.clampCam();
    c.shake *= Math.pow(0.02, dt);
    parts = parts.filter(p => {
      p.life += dt;
      p.vx *= Math.max(0, 1 - p.drag * dt); p.vy *= Math.max(0, 1 - p.drag * dt);
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.size += p.grow * dt;
      return p.life < p.max;
    });
    tracers = tracers.filter(t => (t.life += dt) < t.max);
    texts = texts.filter(t => { t.life += dt; t.y -= 22 * dt; return t.life < t.max; });
    flashes = flashes.filter(f => (f.life += dt) < f.max);
    lights = lights.filter(f => (f.life += dt) < f.max);
    anims = anims.filter(a => {
      a.t += dt * 1000;
      if (a.t >= a.dur) { a.done && a.done(); return false; }
      return true;
    });
  }

  function unitPos(u) {
    const p = Hx.center(u.c, u.r);
    let x = p[0], y = p[1], alpha = 1, lift = 0, scale = 1;
    for (const a of anims) {
      if (a.u !== u) continue;
      const k = U.clamp(a.t / a.dur, 0, 1);
      if (a.pts) {
        const seg = (a.pts.length - 1) * k;
        const i = Math.min(a.pts.length - 2, Math.floor(seg));
        const f = seg - i;
        x = U.lerp(a.pts[i][0], a.pts[i + 1][0], f); y = U.lerp(a.pts[i][1], a.pts[i + 1][1], f);
        const dx = a.pts[i + 1][0] - a.pts[i][0];
        if (Math.abs(dx) > 1) u.facing = dx > 0 ? 1 : -1;
        if (G.T(u).move === 'foot' || G.T(u).move === 'heavy') lift = Math.abs(Math.sin(k * (a.pts.length - 1) * Math.PI * 2)) * 2.5;
      } else if (a.lunge) {
        const s = Math.sin(k * Math.PI);
        x += a.lx * s; y += a.ly * s;
      } else if (a.dying) { alpha = 1 - k; scale = 1 - k * 0.25; y += k * 4; }
      else if (a.pod) { lift = (1 - k) * (1 - k) * 420; alpha = 1; }
      else if (a.fadeIn) { alpha = k; if (a.rise) scale = 0.5 + k * 0.5; }
      else if (a.flyIn) { x += (1 - U.easeOut(k)) * 500 * (u.facing || -1) * -1; }
    }
    return { x, y, alpha, lift, scale };
  }

  function draw(S, time) {
    const c = R.cam;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = S.env === 'surface' ? '#0b1119' : '#04070b';
    ctx.fillRect(0, 0, W, H);
    const sx = (Math.random() - 0.5) * c.shake, sy = (Math.random() - 0.5) * c.shake;
    ctx.setTransform(DPR * c.z, 0, 0, DPR * c.z, DPR * ((-c.x) * c.z + W / 2 + sx), DPR * ((-c.y) * c.z + H / 2 + sy));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrainCv, 0, 0);
    ctx.drawImage(decalCv, 0, 0);
    if (R.showGrid !== false) { ctx.globalAlpha = 1; ctx.drawImage(gridCv, 0, 0); }

    // тела активов
    for (const k in S.corpses) {
      const i = +k, cc = i % S.W, rr = (i / S.W) | 0;
      if (!G.visibleHex(cc, rr)) continue;
      const p = Hx.center(cc, rr);
      ctx.fillStyle = 'rgba(20,20,24,0.85)'; SP.rr(ctx, p[0] - 13, p[1] + 6, 26, 9, 4); ctx.fill();
      ctx.fillStyle = '#c8201f'; ctx.fillRect(p[0] - 2, p[1] + 7, 4, 7);
    }

    // флаги владельцев строений
    S.structs.forEach(st => {
      const p = Hx.center(st.c, st.r);
      if (st.type === 'shaft') return;
      const col = st.owner === 'none' ? '#888' : (D.FACTIONS[st.owner] || D.FACTIONS.civ).flag;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
      ctx.beginPath(); Hx.pathHex(ctx, p[0], p[1], SZ - 3); ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1b1f25'; ctx.fillRect(p[0] + SZ * 0.42, p[1] - SZ * 0.72, 1.8, 16);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(p[0] + SZ * 0.42 + 1.8, p[1] - SZ * 0.72); ctx.lineTo(p[0] + SZ * 0.42 + 13, p[1] - SZ * 0.72 + 4 + Math.sin(time * 4 + st.c) * 1.5); ctx.lineTo(p[0] + SZ * 0.42 + 1.8, p[1] - SZ * 0.72 + 8); ctx.closePath(); ctx.fill();
    });

    drawOverlays(S, time);

    // юниты
    const vis = S.units.filter(u => !u.dead || anims.some(a => a.u === u && a.dying)).filter(u => !u.evac && (u.fac === 'player' || G.seen(u) || anims.some(a => a.u === u)));
    vis.sort((a, b) => (G.T(a).move === 'air') - (G.T(b).move === 'air') || Hx.center(a.c, a.r)[1] - Hx.center(b.c, b.r)[1]);
    vis.forEach(u => drawUnit(S, u, time));

    // эффекты
    ctx.globalCompositeOperation = 'lighter';
    tracers.forEach(t => {
      const k = 1 - t.life / t.max;
      ctx.strokeStyle = t.color; ctx.globalAlpha = k; ctx.lineWidth = t.width;
      if (t.beam) { ctx.shadowColor = t.color; ctx.shadowBlur = 12; }
      ctx.beginPath();
      if (t.beam) { ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); }
      else { const f = t.life / t.max; const hx = U.lerp(t.x1, t.x2, Math.min(1, f * 2.2)), hy = U.lerp(t.y1, t.y2, Math.min(1, f * 2.2)); const tx = U.lerp(t.x1, t.x2, Math.max(0, f * 2.2 - 0.6)), ty = U.lerp(t.y1, t.y2, Math.max(0, f * 2.2 - 0.6)); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); }
      ctx.stroke(); ctx.shadowBlur = 0;
    });
    flashes.forEach(f => {
      const k = 1 - f.life / f.max;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 1.6);
      g.addColorStop(0, f.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = k; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.6, 0, Math.PI * 2); ctx.fill();
    });
    parts.forEach(p => {
      if (!p.glow) return;
      ctx.globalAlpha = p.fade ? 1 - p.life / p.max : 1; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    parts.forEach(p => {
      if (p.glow) return;
      ctx.globalAlpha = p.fade ? Math.max(0, 1 - p.life / p.max) : 1; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // туман войны
    if (!R.debug) {
    ctx.fillStyle = S.env === 'surface' ? 'rgba(6,10,18,0.46)' : 'rgba(2,4,8,0.5)';
    ctx.beginPath();
    for (let r = 0; r < S.H; r++) for (let cc = 0; cc < S.W; cc++) {
      if (S.vis[r * S.W + cc]) continue;
      if (S.env === 'under' && S.terrain[r * S.W + cc] === '#') continue;
      const p = Hx.center(cc, r);
      Hx.pathHex(ctx, p[0], p[1], SZ + 0.6);
    }
    ctx.fill();
    }

    // тексты
    ctx.textAlign = 'center';
    texts.forEach(t => {
      const k = t.life / t.max;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = 'bold 15px "Russo One", "Arial Narrow", sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;

    // экранное пространство
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (S.env === 'under' && !R.debug) drawLightMask(S, time);
    drawWeather(S, time);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, S.env === 'surface' ? 'rgba(5,12,24,0.55)' : 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    drawMini(S);
  }

  function drawOverlays(S, time) {
    const ov = R.ov;
    // досягаемость
    if (ov.reach) {
      ctx.lineWidth = 2;
      for (const k in ov.reach) {
        const n = ov.reach[k];
        if (!n.end) continue;
        const i = +k, cc = i % S.W, rr = (i / S.W) | 0;
        const p = Hx.center(cc, rr);
        ctx.fillStyle = 'rgba(90,255,110,0.07)';
        ctx.strokeStyle = n.stop ? 'rgba(255,210,90,0.55)' : 'rgba(110,255,120,0.55)';
        ctx.beginPath(); Hx.pathHex(ctx, p[0], p[1], SZ - 4); ctx.fill(); ctx.stroke();
      }
    }
    if (ov.path && ov.path.length > 1) {
      ctx.strokeStyle = 'rgba(160,255,160,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([7, 6]); ctx.lineDashOffset = -time * 30;
      ctx.beginPath();
      ov.path.forEach((p, i) => { const q = Hx.center(p[0], p[1]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (ov.hover) {
      const p = Hx.center(ov.hover[0], ov.hover[1]);
      ctx.fillStyle = ov.hoverKind === 'attack' ? 'rgba(255,70,60,0.25)' : ov.hoverKind === 'move' ? 'rgba(120,255,130,0.3)' : 'rgba(255,255,255,0.08)';
      ctx.beginPath(); Hx.pathHex(ctx, p[0], p[1], SZ - 2); ctx.fill();
    }
    if (ov.targets) {
      const pulse = 0.55 + Math.sin(time * 6) * 0.25;
      ov.targets.forEach(t => {
        const cc = t.unit ? t.unit.c : t.gas[0], rr = t.unit ? t.unit.r : t.gas[1];
        const p = Hx.center(cc, rr);
        ctx.strokeStyle = t.gas ? `rgba(255,190,60,${pulse})` : `rgba(255,70,60,${pulse})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); Hx.pathHex(ctx, p[0], p[1], SZ - 3); ctx.stroke();
      });
    }
    if (ov.special) {
      ov.special.forEach(p => {
        const q = Hx.center(p[0], p[1]);
        ctx.strokeStyle = 'rgba(255,190,60,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); Hx.pathHex(ctx, q[0], q[1], SZ - 4); ctx.stroke(); ctx.setLineDash([]);
      });
    }
    if (ov.objectives) {
      ov.objectives.forEach(p => {
        const q = Hx.center(p[0], p[1]);
        const k = (Math.sin(time * 3) + 1) / 2;
        ctx.strokeStyle = `rgba(255,190,60,${0.35 + k * 0.4})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(q[0], q[1], SZ * (0.85 + k * 0.1), 0, Math.PI * 2); ctx.stroke();
      });
    }
  }

  function drawUnit(S, u, time) {
    const T = G.T(u);
    const pos = unitPos(u);
    const size = (T.size || 1);
    const air = T.move === 'air';
    const x = pos.x, y = pos.y - pos.lift - (air ? 14 : 0);
    ctx.globalAlpha = pos.alpha;
    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(pos.x + (air ? 10 : 2), pos.y + (air ? 16 : 13) * size, 16 * size, 6 * size, 0, 0, Math.PI * 2); ctx.fill();
    // подсветка стороны
    if (!u.dead && u.fac !== 'player') {
      ctx.fillStyle = u.fac === 'fauna' ? 'rgba(160,90,255,0.16)' : u.fac === 'civ' ? 'rgba(230,240,255,0.12)' : 'rgba(255,60,50,0.14)';
      ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 12 * size, 19 * size, 7 * size, 0, 0, Math.PI * 2); ctx.fill();
    }
    let phase = 0;
    if (u.type === 'nematode') phase = Math.floor(time * 4 + u.id) % 4;
    const spr = SP.unit(u.type, u.fac, { hero: u.hero, phase });
    const bob = (T.beast ? Math.sin(time * 3 + u.id) * 1.2 : Math.sin(time * 2 + u.id) * 0.5);
    const s = 0.92 * size * pos.scale;
    ctx.save();
    ctx.translate(x, y + bob);
    if ((u.facing || 1) < 0) ctx.scale(-1, 1);
    ctx.scale(s, s);
    const acted = u.fac === 'player' && (u.done || (!G.canMove(u) && !G.canAttack(u))) && S.phase === 'player' && !u.dead;
    if (acted) ctx.filter = 'grayscale(0.7) brightness(0.72)';
    if (u.flash) { ctx.filter = 'brightness(2.2)'; u.flash -= 0.12; if (u.flash <= 0) u.flash = 0; }
    ctx.drawImage(spr, -56, -58);
    ctx.filter = 'none';
    ctx.restore();
    if (T.move === 'air') {
      ctx.fillStyle = 'rgba(140,200,255,0.25)';
      ctx.beginPath(); ctx.arc(x - (u.facing || 1) * 20, y, 6 + Math.sin(time * 30) * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (u.dead) return;
    // выделение
    if (R.ov.sel === u) {
      const b = 26 * size, k = 5 + Math.sin(time * 5) * 1.2;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(d => {
        const cx = x + d[0] * b, cy = pos.y + d[1] * b - 6;
        ctx.beginPath(); ctx.moveTo(cx - d[0] * 0, cy - d[1] * k); ctx.lineTo(cx, cy); ctx.lineTo(cx - d[0] * k, cy); ctx.stroke();
      });
    }
    // полоса здоровья
    const bw = 30 * Math.min(1.4, size), bx = pos.x - bw / 2, by = pos.y - 34 * size - (air ? 14 : 0);
    const frac = U.clamp(u.hp / u.maxhp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = u.fac === 'player' ? (frac > 0.5 ? '#5dff6a' : frac > 0.25 ? '#ffd35a' : '#ff5a4a') : u.fac === 'fauna' ? '#b77dff' : u.fac === 'civ' ? '#e8ecf0' : '#ff6a4a';
    ctx.fillRect(bx, by, bw * frac, 3);
    // ранги
    for (let i = 0; i < u.rank; i++) {
      ctx.fillStyle = '#ffe28a'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bx + 3 + i * 7, by - 5, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // статусы
    let ix = bx + bw + 4;
    const icon = (txt, col) => { ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(txt, ix, by + 4); ix += 9; };
    if (u.sleep) icon('z', '#9fb8ff');
    if (u.suppressed) icon('!', '#ffb347');
    if (G.hasFx(u, 'cocktail')) icon('♥', Math.sin(time * 14) > 0 ? '#ff2a2a' : '#7a0000');
    else if (u.effects.some(e => ['dox', 'eph2', 'choco'].indexOf(e.id) >= 0)) icon('+', '#7dffb0');
    if (G.hasFx(u, 'exhausted') || G.hasFx(u, 'convulsion') || G.hasFx(u, 'ephCrash')) icon('↓', '#ff8a8a');
    if (T.warmup && u.warm < 1) icon('°', '#ffcf5a');
    if (u.hero) {
      ctx.font = 'bold 10px "Russo One", sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(pos.x - 17, pos.y + 16 * size, 34, 12);
      ctx.fillStyle = '#ff5a4a'; ctx.fillText(u.name.length > 8 ? u.name.slice(0, 8) : u.name, pos.x, pos.y + 25 * size);
    }
  }

  function drawLightMask(S, time) {
    const lw = lightCv.width, lh = lightCv.height;
    const l = lightCv.getContext('2d');
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, lw, lh);
    l.fillStyle = 'rgba(0,2,6,0.5)';
    l.fillRect(0, 0, lw, lh);
    l.globalCompositeOperation = 'destination-out';
    const z = R.cam.z;
    const hole = (wx, wy, rad, a) => {
      const s = R.toScreen(wx, wy);
      const x = s[0] / 2, y = s[1] / 2, r = rad * z / 2;
      if (x < -r || y < -r || x > lw + r || y > lh + r) return;
      const g = l.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.arc(x, y, r, 0, Math.PI * 2); l.fill();
    };
    S.lamps.forEach(p => { const q = Hx.center(p[0], p[1]); hole(q[0], q[1], 170 + Math.sin(time * 9 + p[0]) * 4, 0.85); });
    S.units.forEach(u => {
      if (u.dead || u.evac || u.fac !== 'player') return;
      const q = unitPos(u);
      hole(q.x + (u.facing || 1) * 30, q.y, 150, 0.9);
      hole(q.x, q.y, 90, 1);
    });
    S.scans.forEach(sc => { const q = Hx.center(sc.c, sc.r); hole(q[0], q[1], 330, 0.35); });
    lights.forEach(f => hole(f.x, f.y, f.r * 2.2, 1 - f.life / f.max));
    parts.forEach(p => { if (p.glow && Math.random() < 0.3) hole(p.x, p.y, 40, 0.5); });
    ctx.drawImage(lightCv, 0, 0, W, H);
  }

  function drawWeather(S, time) {
    const dt = 0.016;
    if (S.env === 'surface') {
      const storm = S.m.weather === 'storm';
      ctx.fillStyle = storm ? 'rgba(210,225,240,0.5)' : 'rgba(230,240,250,0.6)';
      ctx.strokeStyle = 'rgba(220,235,250,0.35)'; ctx.lineWidth = 1;
      weather.forEach(p => {
        p.x += (storm ? 520 : 70) * p.z * dt + Math.sin(time + p.p) * 0.3;
        p.y += (storm ? 180 : 45) * p.z * dt;
        if (p.x > W + 20) p.x -= W + 40; if (p.y > H + 20) p.y -= H + 40;
        if (storm) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 14 * p.z, p.y - 5 * p.z); ctx.stroke(); }
        else ctx.fillRect(p.x, p.y, 1.6 * p.z, 1.6 * p.z);
      });
      if (storm) { ctx.fillStyle = 'rgba(180,200,220,0.06)'; ctx.fillRect(0, 0, W, H); }
    } else {
      ctx.fillStyle = 'rgba(200,225,255,0.35)';
      weather.forEach(p => {
        p.y += 12 * p.z * dt; p.x += Math.sin(time * 0.7 + p.p) * 0.15;
        if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
        ctx.fillRect(p.x, p.y, 1.2 * p.z, 1.2 * p.z);
      });
    }
  }

  function drawMini(S) {
    if (!R.miniCanvas || !miniBase) return;
    const m = R.miniCanvas;
    if (m.width !== miniBase.width || m.height !== miniBase.height) { m.width = miniBase.width; m.height = miniBase.height; }
    const x = m.getContext('2d');
    x.drawImage(miniBase, 0, 0);
    const k = m.width / worldW;
    x.fillStyle = 'rgba(0,0,0,0.35)';
    S.units.forEach(u => {
      if (u.dead || u.evac) return;
      if (u.fac !== 'player' && !G.seen(u)) return;
      const p = Hx.center(u.c, u.r);
      x.fillStyle = u.fac === 'player' ? '#ff4a3a' : u.fac === 'fauna' ? '#c08aff' : u.fac === 'civ' ? '#fff' : u.fac === 'opz' ? '#6fb6ff' : '#ffd35a';
      x.fillRect(p[0] * k - 2, p[1] * k - 2, u.hero ? 5 : 4, u.hero ? 5 : 4);
    });
    const tl = R.toWorld(0, 0), br = R.toWorld(W, H);
    x.strokeStyle = '#fff'; x.lineWidth = 1;
    x.strokeRect(tl[0] * k, tl[1] * k, (br[0] - tl[0]) * k, (br[1] - tl[1]) * k);
  }
  R.miniToWorld = (mx, my) => { const k = R.miniCanvas.width / worldW; return [mx / k, my / k]; };
  R.worldSize = () => [worldW, worldH];

  /* ---------- Превью карты для брифинга ---------- */
  R.preview = function (canvas) {
    if (!terrainCv) return;
    const x = canvas.getContext('2d');
    const k = Math.min(canvas.width / worldW, canvas.height / worldH);
    x.fillStyle = '#05080c'; x.fillRect(0, 0, canvas.width, canvas.height);
    const ox = (canvas.width - worldW * k) / 2, oy = (canvas.height - worldH * k) / 2;
    x.drawImage(terrainCv, ox, oy, worldW * k, worldH * k);
    const S = G.state();
    S.structs.forEach(st => {
      const p = Hx.center(st.c, st.r);
      const obj = S.m.objectives.some(o => (o.tags || []).indexOf(st.tag) >= 0 || o.exitTag === st.tag);
      x.strokeStyle = obj ? '#ffb000' : (D.FACTIONS[st.owner] || D.FACTIONS.civ).flag; x.lineWidth = obj ? 2.5 : 1.5;
      x.beginPath(); x.arc(ox + p[0] * k, oy + p[1] * k, obj ? 7 : 4, 0, Math.PI * 2); x.stroke();
    });
    S.units.forEach(u => {
      if (u.fac !== 'player') return;
      const p = Hx.center(u.c, u.r);
      x.fillStyle = '#ff4a3a'; x.fillRect(ox + p[0] * k - 1.5, oy + p[1] * k - 1.5, 3, 3);
    });
  };

  // подключение хуков игры
  G.hooks.animMove = R.animMove;
  G.hooks.animAttack = R.animAttack;
  G.hooks.animDeath = R.animDeath;
  G.hooks.animExplode = R.animExplode;
  G.hooks.animSpawn = R.animSpawn;
  G.hooks.animText = (c, r, t, col) => { if (!G.fast) R.text(c, r, t, col); };
  G.hooks.focus = R.focus;
  G.hooks.rebake = R.rebake;
  G.hooks.decal = R.decal;
})();
