/* К-47: Нормы расхода плоти — ядро: утилиты, шум, гекс-геометрия, поиск пути */
'use strict';
var K = window.K = window.K || {};

(function () {
  const U = K.util = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  U.easeOut = t => 1 - Math.pow(1 - t, 3);
  U.sleep = ms => new Promise(res => setTimeout(res, ms));
  U.pick = (arr, rnd) => arr[Math.floor((rnd || Math.random)() * arr.length)];
  U.shuffle = (arr, rnd) => {
    rnd = rnd || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  U.escape = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // Детерминированный генератор (mulberry32)
  U.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Стохастическое округление: 2.3 -> 2 (70%) или 3 (30%)
  U.sround = (v, rnd) => {
    const f = Math.floor(v);
    return f + (((rnd || Math.random)() < v - f) ? 1 : 0);
  };

  U.rgb = (r, g, b, a) => a === undefined ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  U.hex2rgb = h => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.mix = (c1, c2, t) => [U.lerp(c1[0], c2[0], t), U.lerp(c1[1], c2[1], t), U.lerp(c1[2], c2[2], t)];
  U.shade = (hex, k) => {
    const c = U.hex2rgb(hex);
    const f = k < 0 ? [0, 0, 0] : [255, 255, 255];
    const m = U.mix(c, f, Math.abs(k));
    return U.rgb(m[0], m[1], m[2]);
  };

  /* ---------- Шум (value noise + fbm) ---------- */
  const N = K.noise = {};
  const PERM = new Uint8Array(512);
  const GRAD = new Float32Array(256);
  N.seed = function (seed) {
    const r = U.rng(seed || 1337);
    const p = [];
    for (let i = 0; i < 256; i++) { p[i] = i; GRAD[i] = r(); }
    U.shuffle(p, r);
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  };
  N.seed(1337);
  const fade = t => t * t * (3 - 2 * t);
  N.value = function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = GRAD[PERM[X + PERM[Y]]], b = GRAD[PERM[X + 1 + PERM[Y]]];
    const c = GRAD[PERM[X + PERM[Y + 1]]], d = GRAD[PERM[X + 1 + PERM[Y + 1]]];
    const u = fade(xf), v = fade(yf);
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
  };
  N.fbm = function (x, y, oct) {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    oct = oct || 4;
    for (let i = 0; i < oct; i++) {
      s += amp * N.value(x * f, y * f);
      norm += amp; amp *= 0.5; f *= 2.03;
    }
    return s / norm;
  };
  N.ridge = function (x, y, oct) {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    oct = oct || 4;
    for (let i = 0; i < oct; i++) {
      s += amp * (1 - Math.abs(N.value(x * f, y * f) * 2 - 1));
      norm += amp; amp *= 0.5; f *= 2.1;
    }
    return s / norm;
  };

  /* ---------- Гекс-геометрия (плоский верх, odd-q) ---------- */
  const H = K.hex = {};
  H.SIZE = 40; // радиус гекса в мировых пикселях
  H.SQ3 = Math.sqrt(3);
  H.MARGIN = 48;

  const DIRS_EVEN = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1]];
  const DIRS_ODD = [[1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1]];

  H.toCube = (c, r) => { const x = c; const z = r - (c - (c & 1)) / 2; return [x, -x - z, z]; };
  H.fromCube = (x, z) => [x, z + (x - (x & 1)) / 2];
  H.dist = (c1, r1, c2, r2) => {
    const a = H.toCube(c1, r1), b = H.toCube(c2, r2);
    return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
  };
  H.neighbors = (c, r) => {
    const d = (c & 1) ? DIRS_ODD : DIRS_EVEN;
    const out = [];
    for (let i = 0; i < 6; i++) out.push([c + d[i][0], r + d[i][1]]);
    return out;
  };
  H.center = (c, r) => [H.MARGIN + H.SIZE * 1.5 * c + H.SIZE, H.MARGIN + H.SIZE * H.SQ3 * (r + 0.5 * (c & 1)) + H.SIZE * H.SQ3 / 2];
  H.worldSize = (W, Hh) => [H.MARGIN * 2 + H.SIZE * 1.5 * (W - 1) + H.SIZE * 2, H.MARGIN * 2 + H.SIZE * H.SQ3 * (Hh + 0.5)];
  H.corners = (x, y, s) => {
    s = s || H.SIZE;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i;
      pts.push([x + s * Math.cos(a), y + s * Math.sin(a)]);
    }
    return pts;
  };
  H.pathHex = (ctx, x, y, s) => {
    const p = H.corners(x, y, s);
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < 6; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
  };
  // мировые пиксели -> [c, r]
  H.fromPixel = (px, py) => {
    const x = px - H.MARGIN - H.SIZE;
    const y = py - H.MARGIN - H.SIZE * H.SQ3 / 2;
    const q = (2 / 3 * x) / H.SIZE;
    const r = (-1 / 3 * x + H.SQ3 / 3 * y) / H.SIZE;
    // кубическое округление
    let cx = q, cz = r, cy = -cx - cz;
    let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    return H.fromCube(rx, rz);
  };
  // Линия между гексами
  H.line = (c1, r1, c2, r2) => {
    const a = H.toCube(c1, r1), b = H.toCube(c2, r2);
    const n = Math.max(1, H.dist(c1, r1, c2, r2));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      let x = U.lerp(a[0] + 1e-6, b[0] + 1e-6, t), y = U.lerp(a[1] + 1e-6, b[1] + 1e-6, t), z = U.lerp(a[2] - 2e-6, b[2] - 2e-6, t);
      let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
      const o = H.fromCube(rx, rz);
      if (!out.length || out[out.length - 1][0] !== o[0] || out[out.length - 1][1] !== o[1]) out.push(o);
    }
    return out;
  };
  H.ring = (c, r, rad) => {
    const out = [];
    for (let dc = -rad; dc <= rad; dc++) {
      for (let dr = -rad - 1; dr <= rad + 1; dr++) {
        const cc = c + dc, rr = r + dr;
        if (H.dist(c, r, cc, rr) === rad) out.push([cc, rr]);
      }
    }
    return out;
  };
  H.disk = (c, r, rad) => {
    const out = [];
    for (let dc = -rad; dc <= rad; dc++) {
      for (let dr = -rad - 1; dr <= rad + 1; dr++) {
        const cc = c + dc, rr = r + dr;
        if (H.dist(c, r, cc, rr) <= rad) out.push([cc, rr]);
      }
    }
    return out;
  };

  /* ---------- Двоичная куча для Дейкстры ---------- */
  U.Heap = class {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(pri, val) {
      const a = this.a; a.push([pri, val]);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p][0] <= a[i][0]) break;
        const t = a[p]; a[p] = a[i]; a[i] = t; i = p;
      }
    }
    pop() {
      const a = this.a; const top = a[0]; const last = a.pop();
      if (a.length) {
        a[0] = last; let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1; let m = i;
          if (l < a.length && a[l][0] < a[m][0]) m = l;
          if (r < a.length && a[r][0] < a[m][0]) m = r;
          if (m === i) break;
          const t = a[m]; a[m] = a[i]; a[i] = t; i = m;
        }
      }
      return top;
    }
  };
})();
