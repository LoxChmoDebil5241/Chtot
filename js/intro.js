/* К-47 — интро-ролик и фон меню: планета, звёзды, капсульная */
'use strict';
(function () {
  const U = K.util, Nz = K.noise;
  const P = K.planet = {};
  const TW = 256, TH = 128;
  let tex = null, lightsTex = null, off = null, offImg = null;
  const RES = 200;

  function makeTex() {
    Nz.seed(4747);
    tex = new Float32Array(TW * TH * 3);
    lightsTex = new Uint8Array(TW * TH);
    const rnd = U.rng(47);
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const lon = x / TW * Math.PI * 2, lat = (y / TH - 0.5) * Math.PI;
      const nx = Math.cos(lat) * Math.cos(lon), ny = Math.sin(lat), nz = Math.cos(lat) * Math.sin(lon);
      const n1 = Nz.fbm(nx * 2.2 + 10, ny * 2.2 + nz * 1.4, 5);
      const n2 = Nz.ridge(nz * 3 + 4, ny * 3 + nx * 1.1, 4);
      const band = Math.sin(lat * 7 + n1 * 3) * 0.5 + 0.5;
      let r = 120 + n1 * 70 + band * 14, g = 138 + n1 * 72 + band * 12, b = 158 + n1 * 70 + band * 10;
      const crack = Math.max(0, n2 - 0.78) * 4;
      r -= crack * 90; g -= crack * 70; b -= crack * 40;
      const pole = Math.pow(Math.abs(ny), 6);
      r += pole * 70; g += pole * 70; b += pole * 70;
      const i = (y * TW + x) * 3;
      tex[i] = r; tex[i + 1] = g; tex[i + 2] = b;
      if (rnd() < 0.004 && Math.abs(ny) < 0.8) lightsTex[y * TW + x] = 1;
    }
    off = document.createElement('canvas'); off.width = RES; off.height = RES;
    offImg = off.getContext('2d').createImageData(RES, RES);
  }

  P.draw = function (ctx, cx, cy, R, time, opts) {
    opts = opts || {};
    if (!tex) makeTex();
    const d = offImg.data;
    const tilt = 82 * Math.PI / 180;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const spin = time * (opts.spin || 0.04);
    const L = [-0.62, -0.38, 0.69];
    for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
      const i = (y * RES + x) * 4;
      const nx = (x - RES / 2 + 0.5) / (RES / 2), ny = (y - RES / 2 + 0.5) / (RES / 2);
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) { d[i + 3] = 0; continue; }
      const nz = Math.sqrt(1 - r2);
      const ax = nx * ct - ny * st, ay = nx * st + ny * ct;
      let lon = Math.atan2(nz, ax) + spin;
      const lat = Math.asin(U.clamp(ay, -1, 1));
      lon = ((lon % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const tx = Math.floor(lon / (Math.PI * 2) * TW) % TW, ty = U.clamp(Math.floor((lat / Math.PI + 0.5) * TH), 0, TH - 1);
      const ti = (ty * TW + tx) * 3;
      let dif = nx * L[0] + ny * L[1] + nz * L[2];
      dif = U.clamp(dif, 0, 1);
      const lit = 0.06 + dif * 1.05;
      let r = tex[ti] * lit, g = tex[ti + 1] * lit, b = tex[ti + 2] * lit * 1.05;
      const rim = Math.pow(1 - nz, 3);
      r += rim * 40; g += rim * 80; b += rim * 140;
      if (dif < 0.08 && lightsTex[ty * TW + tx]) { r += 180; g += 120; b += 40; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    off.getContext('2d').putImageData(offImg, 0, 0);
    const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.35);
    glow.addColorStop(0, 'rgba(120,180,255,0.28)'); glow.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2); ctx.fill();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, cx - R, cy - R, R * 2, R * 2);
  };

  /* ---------- Звёзды ---------- */
  function makeStars(n, w, h) {
    const r = U.rng(99);
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: r() * w, y: r() * h, s: r() * 1.4 + 0.2, t: r() * 6, c: r() < 0.1 ? '#ffd9b0' : r() < 0.2 ? '#b8d4ff' : '#ffffff' });
    return out;
  }
  function drawStars(ctx, stars, time, alpha) {
    stars.forEach(s => {
      ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(time * 1.3 + s.t));
      ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, s.s, s.s);
    });
    ctx.globalAlpha = 1;
  }

  /* ---------- Фон меню ---------- */
  const MB = K.menubg = {};
  let mbRun = false, mbCv = null, mbStars = null, mbFlakes = null;
  MB.start = function (cv) {
    mbCv = cv; mbRun = true;
    const loop = ts => {
      if (!mbRun) return;
      requestAnimationFrame(loop);
      const w = cv.clientWidth, h = cv.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); mbStars = null; }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!mbStars) { mbStars = makeStars(260, w, h); mbFlakes = Array.from({ length: 90 }, () => ({ x: Math.random() * w, y: Math.random() * h, z: 0.3 + Math.random() })); }
      const t = ts / 1000;
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#05070b'); bg.addColorStop(1, '#0b1320');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      drawStars(ctx, mbStars, t, 0.9);
      const R = Math.min(w, h) * (w > 900 ? 0.42 : 0.34);
      P.draw(ctx, w > 900 ? w * 0.72 : w * 0.5, w > 900 ? h * 0.52 : h * 0.3, R, t, { spin: 0.03 });
      ctx.fillStyle = 'rgba(220,235,255,0.5)';
      mbFlakes.forEach(f => { f.x += 30 * f.z * 0.016; f.y += 14 * f.z * 0.016; if (f.x > w) f.x = 0; if (f.y > h) f.y = 0; ctx.fillRect(f.x, f.y, 1.4 * f.z, 1.4 * f.z); });
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = (t * 20) % 3; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    };
    requestAnimationFrame(loop);
  };
  MB.stop = () => { mbRun = false; };

  /* ---------- Интро ---------- */
  const I = K.intro = {};
  const LINES = [
    { t: 0.8, d: 5, text: 'Звезда С-1. В 3,7 раза дальше, чем Солнце от Земли.', y: 0.82 },
    { t: 6, d: 7, big: 'ОЛ-12-П', text: '−201 °C · ледяной панцирь 191 км · ось наклонена на 82°', y: 0.8 },
    { t: 13.5, d: 6, text: 'Под льдом — иридий, осмий, неодим. Стоимость недр превышает ВВП человечества за пять лет.', y: 0.82 },
    { t: 20, d: 6, text: 'ОПЗ и СНК вгрызаются в лёд. Холодная война — в самом буквальном смысле.', y: 0.82 },
    { t: 26.5, d: 6.5, text: 'Корпорация «Vitezstvi» продаёт солдат обеим сторонам.\nСолдат, которые не умирают навсегда.', y: 0.8 },
    { t: 33.5, d: 7, mono: true, text: 'АКТИВАЦИЯ ЗАВЕРШЕНА.\nК-1. ЦИКЛ 1. СЛЕДУЙТЕ УКАЗАНИЯМ ПЕРСОНАЛА.', y: 0.78 }
  ];
  const TOTAL = 46;

  I.play = function (cv, onDone) {
    let t0 = null, done = false, lastType = 0;
    const stars = makeStars(420, 2000, 1400);
    const finish = () => {
      if (done) return; done = true;
      cv.removeEventListener('pointerdown', skip); window.removeEventListener('keydown', skip);
      onDone && onDone();
    };
    const skip = () => { finish(); };
    cv.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    let beat = -1;
    const loop = ts => {
      if (done) return;
      requestAnimationFrame(loop);
      if (t0 == null) t0 = ts;
      const t = (ts - t0) / 1000;
      if (t > TOTAL) { finish(); return; }
      const w = cv.clientWidth, h = cv.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const fadeIn = U.clamp(t / 2, 0, 1);
      // звёзды и планета
      if (t < 33) {
        ctx.save(); ctx.translate(-t * 4, 0);
        drawStars(ctx, stars, t, fadeIn * (t > 31 ? U.clamp((33 - t) / 2, 0, 1) : 1));
        ctx.restore();
        if (t > 4) {
          const k = U.easeOut(U.clamp((t - 4) / 9, 0, 1));
          const R = Math.min(w, h) * (0.12 + k * 0.3 + Math.max(0, t - 20) * 0.012);
          ctx.globalAlpha = U.clamp((t - 4) / 2, 0, 1) * (t > 31 ? U.clamp((33 - t) / 2, 0, 1) : 1);
          P.draw(ctx, w * 0.5, h * 0.42, R, t, { spin: 0.05 });
          ctx.globalAlpha = 1;
        }
        // корабли/огни шахт
        if (t > 20 && t < 32) {
          for (let i = 0; i < 6; i++) {
            const a = t * 0.3 + i;
            const R = Math.min(w, h) * 0.5;
            ctx.fillStyle = i % 2 ? '#6fb6ff' : '#ffd35a';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(w * 0.5 + Math.cos(a) * R, h * 0.42 + Math.sin(a) * R * 0.3, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
      } else if (t < 41) {
        capsuleScene(ctx, w, h, t - 33);
        const b = Math.floor((t - 33) / 0.9);
        if (b !== beat && t < 40) { beat = b; K.audio && K.audio.sfx(b === 4 ? 'hiss' : 'heartbeat'); }
      } else {
        titleCard(ctx, w, h, t - 41);
      }
      // тексты
      LINES.forEach(L => {
        if (t < L.t || t > L.t + L.d) return;
        const lt = t - L.t;
        const alpha = U.clamp(lt / 0.5, 0, 1) * U.clamp((L.d - lt) / 0.6, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        if (L.big) {
          ctx.font = `${Math.round(Math.min(w, h) * 0.09)}px "Russo One", sans-serif`;
          ctx.fillStyle = '#e8f1ff'; ctx.shadowColor = '#6fb6ff'; ctx.shadowBlur = 20;
          ctx.fillText(L.big, w / 2, h * 0.14 + Math.min(w, h) * 0.06);
          ctx.shadowBlur = 0;
        }
        const chars = Math.floor(lt * 42);
        const full = L.text;
        const shown = full.slice(0, chars);
        if (chars < full.length && ts - lastType > 45 && L.mono) { K.audio && K.audio.sfx('type'); lastType = ts; }
        const fs = Math.max(14, Math.min(24, w / 42));
        ctx.font = L.mono ? `${fs}px "PT Mono", monospace` : `${fs}px "PT Sans Narrow", "Arial Narrow", sans-serif`;
        ctx.fillStyle = L.mono ? '#7dff9a' : '#d6e2f0';
        wrap(ctx, shown, w / 2, h * L.y, w * 0.8, fs * 1.35);
        ctx.globalAlpha = 1;
      });
      // подсказка
      ctx.font = '12px "PT Mono", monospace'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(200,210,220,0.45)';
      ctx.fillText('нажмите, чтобы пропустить', w - 18, h - 16);
      // летербокс
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h * 0.06); ctx.fillRect(0, h * 0.94, w, h * 0.06);
    };
    requestAnimationFrame(loop);
  };

  function wrap(ctx, text, x, y, maxW, lh) {
    const out = [];
    text.split('\n').forEach(par => {
      const words = par.split(' ');
      let line = '';
      words.forEach(wd => {
        const test = line ? line + ' ' + wd : wd;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = wd; } else line = test;
      });
      out.push(line);
    });
    out.forEach((l, i) => ctx.fillText(l, x, y + i * lh - (out.length - 1) * lh / 2));
  }
  I.wrap = wrap;

  function capsuleScene(ctx, w, h, t) {
    const a = U.clamp(t / 1.2, 0, 1);
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0c1116'); g.addColorStop(1, '#030507');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const depth = Math.abs(i - (n - 1) / 2);
      const cw = Math.min(w / 9, 120) * (1 - depth * 0.08);
      const ch = cw * 2.3;
      const x = w / 2 + (i - (n - 1) / 2) * cw * 1.25;
      const y = h * 0.42;
      ctx.fillStyle = '#1a2129'; SPrr(ctx, x - cw / 2, y - ch / 2, cw, ch, cw * 0.4); ctx.fill();
      const gg = ctx.createLinearGradient(x, y - ch / 2, x, y + ch / 2);
      gg.addColorStop(0, 'rgba(90,255,160,0.10)'); gg.addColorStop(1, 'rgba(90,255,160,0.28)');
      ctx.fillStyle = gg; SPrr(ctx, x - cw * 0.38, y - ch * 0.42, cw * 0.76, ch * 0.84, cw * 0.32); ctx.fill();
      // силуэт
      ctx.fillStyle = 'rgba(10,20,15,0.75)';
      ctx.beginPath(); ctx.arc(x, y - ch * 0.26, cw * 0.12, 0, Math.PI * 2); ctx.fill();
      SPrr(ctx, x - cw * 0.16, y - ch * 0.18, cw * 0.32, ch * 0.45, cw * 0.1); ctx.fill();
      if (i === 3 && t > 4) {
        ctx.fillStyle = `rgba(255,255,255,${U.clamp((t - 4) * 1.5, 0, 0.9)})`;
        SPrr(ctx, x - cw * 0.38, y - ch * 0.42, cw * 0.76, ch * 0.84, cw * 0.32); ctx.fill();
      }
    }
    // ЭКГ
    const baseY = h * 0.72;
    ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 2; ctx.shadowColor = '#3ddc84'; ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 3) {
      const ph = (x / w * 4 - t * 1.1);
      const f = ph - Math.floor(ph);
      let yy = 0;
      if (t > 1.5) { if (f > 0.45 && f < 0.5) yy = -40 * Math.sin((f - 0.45) / 0.05 * Math.PI); else if (f > 0.5 && f < 0.55) yy = 18 * Math.sin((f - 0.5) / 0.05 * Math.PI); }
      x ? ctx.lineTo(x, baseY + yy) : ctx.moveTo(x, baseY + yy);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  function SPrr(ctx, x, y, w, h, r) { K.sprites.rr(ctx, x, y, w, h, Math.min(r, w / 2, h / 2)); }

  function titleCard(ctx, w, h, t) {
    ctx.fillStyle = '#050608'; ctx.fillRect(0, 0, w, h);
    const a = U.clamp(t / 0.8, 0, 1);
    const fs = Math.min(w, h) * 0.22;
    ctx.textAlign = 'center';
    ctx.font = `${fs}px "Russo One", sans-serif`;
    for (let i = 0; i < 3; i++) {
      const gl = Math.random() < 0.2 ? (Math.random() - 0.5) * 16 : 0;
      ctx.globalAlpha = a * (i === 2 ? 1 : 0.35);
      ctx.fillStyle = i === 0 ? '#ff2a2a' : i === 1 ? '#2af' : '#f2f2f2';
      ctx.fillText('К-47', w / 2 + (i - 1) * 3 + gl, h * 0.5);
    }
    ctx.globalAlpha = U.clamp((t - 1) / 1, 0, 1);
    ctx.font = `${Math.max(16, fs * 0.16)}px "PT Mono", monospace`;
    ctx.fillStyle = '#c9d4de';
    ctx.fillText('НОРМЫ  РАСХОДА  ПЛОТИ', w / 2, h * 0.5 + fs * 0.42);
    ctx.globalAlpha = 1;
  }
})();
