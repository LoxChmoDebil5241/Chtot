/* К-47 — процедурные спрайты: бойцы, техника, фауна, строения, портреты */
'use strict';
(function () {
  const U = K.util, D = K.data;
  const SP = K.sprites = {};
  const cache = {};

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  SP.rr = rr;
  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
  function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); }

  /* ---------- Оружие ---------- */
  function weapon(ctx, kind, pal) {
    const dark = '#16171a', mid = '#3a3d44', hi = '#6b7078';
    ctx.save();
    ctx.translate(6, -2);
    switch (kind) {
      case 'smg':
        ctx.fillStyle = dark; rr(ctx, 0, -2, 14, 4, 1); ctx.fill();
        ctx.fillStyle = mid; ctx.fillRect(4, 1, 3, 5);
        ctx.fillStyle = hi; ctx.fillRect(2, -2, 8, 1);
        break;
      case 'vector':
        ctx.fillStyle = dark; rr(ctx, 0, -3, 15, 5, 1); ctx.fill();
        ctx.fillStyle = mid; ctx.fillRect(3, 2, 4, 6); ctx.fillRect(12, -2, 5, 3);
        ctx.fillStyle = hi; ctx.fillRect(1, -3, 10, 1);
        break;
      case 'shotgun':
        ctx.fillStyle = dark; rr(ctx, 0, -3, 17, 5, 1.5); ctx.fill();
        ctx.fillStyle = '#5a3d25'; ctx.fillRect(5, 1, 7, 3);
        ctx.fillStyle = mid; ctx.fillRect(13, -2, 6, 3);
        break;
      case 'rifle':
        ctx.fillStyle = dark; rr(ctx, 0, -2, 19, 4, 1); ctx.fill();
        ctx.fillStyle = mid; ctx.fillRect(6, 1, 3, 6);
        ctx.fillStyle = hi; ctx.fillRect(2, -2, 12, 1);
        break;
      case 'mg':
        ctx.fillStyle = dark; rr(ctx, -2, -3, 24, 5, 1); ctx.fill();
        ctx.fillStyle = '#4d5b3a'; ctx.fillRect(2, 2, 7, 6);
        ctx.strokeStyle = dark; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(18, 1); ctx.lineTo(16, 8); ctx.moveTo(18, 1); ctx.lineTo(21, 8); ctx.stroke();
        ctx.fillStyle = hi; ctx.fillRect(0, -3, 14, 1);
        break;
      case 'sniper':
        ctx.fillStyle = dark; rr(ctx, -2, -2, 28, 3.5, 1); ctx.fill();
        ctx.fillStyle = mid; rr(ctx, 4, -6, 9, 3, 1.5); ctx.fill();
        ctx.fillStyle = '#9fd8ff'; ctx.fillRect(12, -5.5, 1.5, 2);
        ctx.fillStyle = '#5a3d25'; ctx.fillRect(-3, -1, 6, 4);
        break;
      case 'laser':
        ctx.fillStyle = '#d7dde6'; rr(ctx, 0, -3, 18, 5, 2); ctx.fill();
        ctx.fillStyle = '#2a3a55'; ctx.fillRect(3, 2, 6, 5);
        ctx.fillStyle = '#5ad1ff'; ctx.shadowColor = '#5ad1ff'; ctx.shadowBlur = 6; ctx.fillRect(17, -2, 3, 3); ctx.shadowBlur = 0;
        break;
      case 'plasma':
        ctx.fillStyle = '#2a2a2a'; rr(ctx, -2, -4, 20, 8, 3); ctx.fill();
        ctx.fillStyle = '#8a6a2a'; ctx.fillRect(2, 3, 6, 5);
        ctx.fillStyle = '#ffcf5a'; ctx.shadowColor = '#ff9a2a'; ctx.shadowBlur = 8; ell(ctx, 19, 0, 3, 2.5); ctx.fill(); ctx.shadowBlur = 0;
        break;
      case 'heavy':
        ctx.fillStyle = dark; rr(ctx, -2, -4, 26, 7, 2); ctx.fill();
        ctx.fillStyle = mid; ell(ctx, 6, 5, 5, 5); ctx.fill();
        ctx.fillStyle = hi; ctx.fillRect(0, -4, 16, 1.5);
        break;
      default: break;
    }
    ctx.restore();
    void pal;
  }

  /* ---------- Пехотинец ---------- */
  function trooper(ctx, pal, wpn, o) {
    o = o || {};
    const armor = pal.armor, plate = pal.plate, visor = pal.visor;
    // баллон
    ctx.fillStyle = '#4a4f57'; rr(ctx, -14, -9, 6, 14, 2.5); ctx.fill();
    ctx.fillStyle = o.civ ? '#9aa' : '#2d6fd6'; ctx.fillRect(-14, -4, 6, 2);
    // ноги
    ctx.fillStyle = U.shade(armor, -0.25);
    rr(ctx, -6, 4, 5, 11, 2); ctx.fill(); rr(ctx, 2, 4, 5, 11, 2); ctx.fill();
    ctx.fillStyle = plate; rr(ctx, -6, 7, 5, 3, 1); ctx.fill(); rr(ctx, 2, 7, 5, 3, 1); ctx.fill();
    // корпус
    ctx.fillStyle = armor; rr(ctx, -9, -10, 18, 17, 4); ctx.fill();
    ctx.fillStyle = plate;
    poly(ctx, [[-7, -8], [7, -8], [6, 3], [-6, 3]]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; poly(ctx, [[-7, -8], [7, -8], [6, -5], [-6, -5]]); ctx.fill();
    // наплечники
    ctx.fillStyle = plate; ell(ctx, -9, -7, 4.5, 3.5); ctx.fill(); ell(ctx, 9, -7, 4.5, 3.5); ctx.fill();
    // рука
    ctx.fillStyle = U.shade(armor, 0.1); rr(ctx, 3, -5, 8, 4, 2); ctx.fill();
    weapon(ctx, wpn, pal);
    // голова
    if (o.civ) {
      ctx.fillStyle = '#d8b49a'; ell(ctx, 0, -16, 6, 6.5); ctx.fill();
      ctx.fillStyle = '#3a2a20'; ell(ctx, -1, -19, 6, 4); ctx.fill();
    } else {
      ctx.fillStyle = U.shade(armor, 0.15); ell(ctx, 0, -16, 7, 7); ctx.fill();
      ctx.fillStyle = visor; ctx.shadowColor = visor; ctx.shadowBlur = 7;
      rr(ctx, 0, -19, 7.5, 5, 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(2, -18.5, 3, 1);
      if (o.hero) { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(-6, -21, 4, 1.6); }
    }
  }

  function pantsir(ctx, pal) {
    const armor = pal.armor, plate = pal.plate;
    ctx.fillStyle = '#3a3f46'; rr(ctx, -17, -12, 8, 18, 3); ctx.fill();
    ctx.fillStyle = U.shade(armor, -0.2); rr(ctx, -8, 5, 7, 12, 2); ctx.fill(); rr(ctx, 2, 5, 7, 12, 2); ctx.fill();
    ctx.fillStyle = plate; rr(ctx, -8, 8, 7, 5, 1); ctx.fill(); rr(ctx, 2, 8, 7, 5, 1); ctx.fill();
    ctx.fillStyle = armor; rr(ctx, -12, -12, 24, 20, 5); ctx.fill();
    ctx.fillStyle = plate; poly(ctx, [[-10, -10], [10, -10], [9, 5], [-9, 5]]); ctx.fill();
    ctx.strokeStyle = U.shade(plate, -0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(9, -3); ctx.moveTo(0, -10); ctx.lineTo(0, 5); ctx.stroke();
    ctx.fillStyle = plate; ell(ctx, -12, -8, 6.5, 5); ctx.fill(); ell(ctx, 12, -8, 6.5, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ell(ctx, -12, -10, 4, 2); ctx.fill(); ell(ctx, 12, -10, 4, 2); ctx.fill();
    ctx.fillStyle = U.shade(armor, 0.1); rr(ctx, 5, -6, 9, 5, 2); ctx.fill();
    ctx.save(); ctx.translate(2, 0); weapon(ctx, pal.wpn || 'heavy', pal); ctx.restore();
    ctx.fillStyle = U.shade(armor, 0.15); rr(ctx, -6, -24, 12, 12, 4); ctx.fill();
    ctx.fillStyle = pal.visor; ctx.shadowColor = pal.visor; ctx.shadowBlur = 9; rr(ctx, 0, -21, 7, 5, 1.5); ctx.fill(); ctx.shadowBlur = 0;
  }

  /* ---------- Техника ---------- */
  function drill(ctx, pal) {
    ctx.fillStyle = '#16171a'; rr(ctx, -20, -15, 34, 8, 3); ctx.fill(); rr(ctx, -20, 7, 34, 8, 3); ctx.fill();
    ctx.strokeStyle = '#3a3d44'; ctx.lineWidth = 1;
    for (let x = -18; x < 14; x += 4) { ctx.beginPath(); ctx.moveTo(x, -15); ctx.lineTo(x, -7); ctx.moveTo(x, 7); ctx.lineTo(x, 15); ctx.stroke(); }
    ctx.fillStyle = pal.armor; rr(ctx, -18, -9, 30, 18, 4); ctx.fill();
    ctx.fillStyle = pal.plate; ctx.fillRect(-16, -8, 6, 16); ctx.fillRect(-6, -8, 4, 16);
    ctx.fillStyle = pal.visor; ctx.shadowColor = pal.visor; ctx.shadowBlur = 6; rr(ctx, 3, -5, 6, 10, 2); ctx.fill(); ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(12, -9, 28, 9); g.addColorStop(0, '#c9772e'); g.addColorStop(0.5, '#f0b060'); g.addColorStop(1, '#7a4418');
    ctx.fillStyle = g; poly(ctx, [[12, -10], [30, 0], [12, 10]]); ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,10,0.8)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(14 + i * 4, -8 + i * 2); ctx.lineTo(16 + i * 4, 8 - i * 2); ctx.stroke(); }
    ctx.fillStyle = '#555'; ctx.fillRect(-22, -4, 4, 3);
  }
  function medevac(ctx) {
    ctx.fillStyle = '#111'; [-14, -2, 10].forEach(x => { ell(ctx, x, -11, 4, 2.5); ctx.fill(); ell(ctx, x, 11, 4, 2.5); ctx.fill(); });
    ctx.fillStyle = '#5f6468'; rr(ctx, -20, -10, 34, 20, 3); ctx.fill();
    ctx.fillStyle = '#6d7377'; rr(ctx, -19, -9, 22, 18, 2); ctx.fill();
    ctx.fillStyle = '#3ddc84'; ctx.shadowColor = '#3ddc84'; ctx.shadowBlur = 6;
    ctx.fillRect(-11, -2, 10, 4); ctx.fillRect(-8, -6, 4, 12); ctx.shadowBlur = 0;
    ctx.fillStyle = '#4b5054'; rr(ctx, 5, -9, 12, 18, 3); ctx.fill();
    ctx.fillStyle = '#9fd8ff'; rr(ctx, 12, -7, 4, 14, 1.5); ctx.fill();
    ctx.fillStyle = '#ffb000'; ell(ctx, 9, 0, 2, 2); ctx.fill();
  }
  function turret(ctx, pal) {
    ctx.strokeStyle = '#2a2c30'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(-12, 13); ctx.moveTo(0, 2); ctx.lineTo(12, 13); ctx.moveTo(0, 2); ctx.lineTo(0, 16); ctx.stroke();
    ctx.fillStyle = pal.armor; ell(ctx, 0, 0, 10, 9); ctx.fill();
    ctx.fillStyle = pal.plate; rr(ctx, -6, -7, 13, 11, 3); ctx.fill();
    ctx.fillStyle = '#16171a'; rr(ctx, 5, -4, 16, 4, 1); ctx.fill(); rr(ctx, 5, 1, 16, 3, 1); ctx.fill();
    ctx.fillStyle = '#ff3b30'; ctx.shadowColor = '#ff3b30'; ctx.shadowBlur = 6; ell(ctx, 1, -3, 2, 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  function shuttle(ctx, pal) {
    ctx.fillStyle = U.shade(pal.armor, 0.05);
    poly(ctx, [[24, 0], [4, -6], [-10, -22], [-16, -22], [-10, -5], [-20, -4], [-20, 4], [-10, 5], [-16, 22], [-10, 22], [4, 6]]); ctx.fill();
    ctx.fillStyle = pal.plate;
    poly(ctx, [[-6, -14], [-12, -20], [-14, -20], [-9, -9]]); ctx.fill();
    poly(ctx, [[-6, 14], [-12, 20], [-14, 20], [-9, 9]]); ctx.fill();
    ctx.fillStyle = U.shade(pal.armor, 0.2); poly(ctx, [[22, 0], [2, -4], [-14, -3], [-14, 3], [2, 4]]); ctx.fill();
    ctx.fillStyle = pal.visor; ctx.shadowColor = pal.visor; ctx.shadowBlur = 6; poly(ctx, [[18, 0], [8, -3], [6, 0], [8, 3]]); ctx.fill();
    ctx.fillStyle = '#8fd6ff'; ctx.shadowColor = '#5ab8ff'; ctx.shadowBlur = 10; ell(ctx, -20, -2.5, 2.5, 1.8); ctx.fill(); ell(ctx, -20, 2.5, 2.5, 1.8); ctx.fill(); ctx.shadowBlur = 0;
  }

  /* ---------- Фауна ---------- */
  function filtrator(ctx, pal) {
    ctx.strokeStyle = U.shade(pal.plate, -0.35); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = -8 + i * 7;
      ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x - 3, -14); ctx.lineTo(x - 7, -17); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x - 3, 14); ctx.lineTo(x - 7, 17); ctx.stroke();
    }
    ctx.fillStyle = pal.plate; ell(ctx, 0, 0, 16, 12); ctx.fill();
    ctx.strokeStyle = U.shade(pal.plate, -0.3); ctx.lineWidth = 1.3;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * 5 - 2, 0, 3, 11, 0, -1.2, 1.2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ell(ctx, -2, -5, 10, 4); ctx.fill();
    // клешни
    ctx.fillStyle = U.shade(pal.plate, 0.1);
    [[-1, 1], [1, 1]].forEach((s, k) => {
      const y = k ? 8 : -8;
      ctx.save(); ctx.translate(14, y);
      poly(ctx, [[0, 0], [10, -4 * (k ? -1 : 1)], [14, 0], [9, 1], [11, 4 * (k ? -1 : 1)], [2, 3 * (k ? -1 : 1)]]); ctx.fill();
      ctx.restore();
    });
    ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(15, i * 2); ctx.quadraticCurveTo(20, i * 4 + 2, 22, i * 3); ctx.stroke(); }
    ctx.fillStyle = '#ff8a3d'; ell(ctx, 12, -4, 1.6, 1.6); ctx.fill(); ell(ctx, 12, 4, 1.6, 1.6); ctx.fill();
  }
  function nematode(ctx, pal, phase) {
    phase = phase || 0;
    const n = 12;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      pts.push([-22 + t * 40, Math.sin(t * 6 + phase) * 6 * (1 - t * 0.4)]);
    }
    for (let i = 0; i < n; i++) {
      const r = 3 + (i / (n - 1)) * 4.5;
      ctx.fillStyle = i % 2 ? '#b58a8f' : '#9c7277';
      ell(ctx, pts[i][0], pts[i][1], r, r); ctx.fill();
    }
    const h = pts[n - 1];
    ctx.fillStyle = '#5a2a30'; ell(ctx, h[0] + 3, h[1], 5, 5); ctx.fill();
    ctx.fillStyle = '#f2ecdf';
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      poly(ctx, [[h[0] + 3 + Math.cos(a) * 5, h[1] + Math.sin(a) * 5], [h[0] + 3 + Math.cos(a + 0.2) * 2.5, h[1] + Math.sin(a + 0.2) * 2.5], [h[0] + 3 + Math.cos(a + 0.4) * 5, h[1] + Math.sin(a + 0.4) * 5]]); ctx.fill();
    }
    void pal;
  }
  function leviathan(ctx) {
    ctx.strokeStyle = '#1c2433'; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + 0.3;
      ctx.lineWidth = 5 - (i % 3);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(Math.cos(a) * 14, Math.sin(a) * 14, Math.cos(a + 0.5) * 22, Math.sin(a + 0.5) * 22, Math.cos(a + 0.2) * 30, Math.sin(a + 0.2) * 30);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 20);
    g.addColorStop(0, '#34445e'); g.addColorStop(1, '#101722');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2; const rr2 = 17 + Math.sin(i * 2.7) * 3; i ? ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : ctx.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#07090d'; ell(ctx, 7, 0, 7, 5); ctx.fill();
    ctx.fillStyle = '#e8f4ff';
    for (let k = 0; k < 7; k++) { const x = 2 + k * 1.8; poly(ctx, [[x, -4], [x + 0.9, -1.5], [x + 1.8, -4]]); ctx.fill(); poly(ctx, [[x, 4], [x + 0.9, 1.5], [x + 1.8, 4]]); ctx.fill(); }
    ctx.fillStyle = '#6ff5ff'; ctx.shadowColor = '#6ff5ff'; ctx.shadowBlur = 8;
    [[-8, -8], [-11, 3], [-3, 10], [-6, -1], [2, -11]].forEach(p => { ell(ctx, p[0], p[1], 1.6, 1.6); ctx.fill(); });
    ctx.shadowBlur = 0;
  }

  /* ---------- Спрайт юнита (кэш) ---------- */
  SP.unit = function (type, fac, opts) {
    opts = opts || {};
    const key = type + '|' + fac + '|' + (opts.hero ? 'h' : '') + (opts.phase || 0);
    if (cache[key]) return cache[key];
    const T = D.UNITS[type];
    const pal = Object.assign({}, D.FACTIONS[fac] || D.FACTIONS.player);
    const cv = document.createElement('canvas');
    cv.width = 112; cv.height = 112;
    const ctx = cv.getContext('2d');
    ctx.translate(56, 58);
    const sc = 1.25;
    ctx.scale(sc, sc);
    switch (type) {
      case 'drill': drill(ctx, pal); break;
      case 'medevac': medevac(ctx); break;
      case 'turret': turret(ctx, pal); break;
      case 'shuttle': shuttle(ctx, pal); break;
      case 'filtrator': filtrator(ctx, pal); break;
      case 'nematode': nematode(ctx, pal, opts.phase || 0); break;
      case 'leviathan': leviathan(ctx); break;
      case 'pantsir': pantsir(ctx, pal); break;
      case 'plasma': pal.wpn = 'plasma'; pantsir(ctx, pal); break;
      case 'civ': trooper(ctx, { armor: '#6d7580', plate: '#e8ecf0', visor: '#9fd8ff' }, 'none', { civ: true }); break;
      case 'child': ctx.scale(0.75, 0.75); trooper(ctx, { armor: '#5c6d8a', plate: '#8fa4c8', visor: '#9fd8ff' }, 'none', { civ: true }); break;
      default: trooper(ctx, pal, T.weapon, { hero: opts.hero });
    }
    cache[key] = cv;
    return cv;
  };

  /* ---------- Портрет для панели ---------- */
  SP.portrait = function (cv, u) {
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!u) {
      ctx.fillStyle = '#0c1016'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120,160,200,0.15)';
      for (let y = 0; y < h; y += 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      return;
    }
    const pal = D.FACTIONS[u.fac] || D.FACTIONS.player;
    const bg = ctx.createLinearGradient(0, 0, w, h);
    const base = { player: ['#3a0d0f', '#0b0b0d'], opz: ['#12305a', '#070b14'], snk: ['#3d3a1a', '#0c0b06'], rogue: ['#2e2412', '#0b0906'], fauna: ['#2a1d3a', '#08060c'], civ: ['#39414d', '#0c0e11'] }[u.fac] || ['#222', '#000'];
    bg.addColorStop(0, base[0]); bg.addColorStop(1, base[1]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const S = K.game.state();
    if (u.hero) {
      heroFace(ctx, w, h, S && S.m.cycle.whiteEyes, S && S.m.cycle.human);
    } else {
      const spr = SP.unit(u.type, u.fac);
      const T = D.UNITS[u.type];
      const s = Math.min(w, h) / 112 * (T.size ? 1.7 / T.size : 1.9);
      ctx.save(); ctx.translate(w / 2, h / 2 + 4); ctx.scale(s, s); ctx.drawImage(spr, -56, -58); ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    void pal;
  };

  function heroFace(ctx, w, h, white, human) {
    const cx = w / 2, cy = h / 2 + 6;
    const k = h / 80;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    // плечи
    ctx.fillStyle = '#18181c'; rr(ctx, -44, 22, 88, 40, 14); ctx.fill();
    ctx.fillStyle = '#a3161c'; poly(ctx, [[-40, 26], [-14, 22], [-12, 40], [-42, 44]]); ctx.fill(); poly(ctx, [[40, 26], [14, 22], [12, 40], [42, 44]]); ctx.fill();
    // шея
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(-9, 12, 18, 14);
    // шлем
    ctx.fillStyle = '#1d1d22'; ell(ctx, 0, -6, 26, 30); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ell(ctx, -8, -24, 12, 7, -0.4); ctx.fill();
    // лицо в визоре
    ctx.save();
    rr(ctx, -18, -16, 36, 28, 10); ctx.clip();
    ctx.fillStyle = '#c99c80'; ctx.fillRect(-20, -18, 40, 32);
    ctx.fillStyle = '#b3876c'; ctx.fillRect(-20, 4, 40, 10);
    ctx.fillStyle = '#4a3325'; ctx.fillRect(-20, -18, 40, 5);
    // глаза
    [[-8, -5], [8, -5]].forEach(p => {
      ctx.fillStyle = '#f1efe9'; ell(ctx, p[0], p[1], 4.6, 2.6); ctx.fill();
      if (white) { ctx.fillStyle = '#e9eef2'; ell(ctx, p[0], p[1], 3, 2.4); ctx.fill(); ctx.fillStyle = 'rgba(200,220,235,0.8)'; ell(ctx, p[0], p[1], 2.2, 2); ctx.fill(); }
      else { ctx.fillStyle = '#4a2c17'; ell(ctx, p[0] + 0.5, p[1], 2.2, 2.2); ctx.fill(); ctx.fillStyle = '#120a05'; ell(ctx, p[0] + 0.5, p[1], 1, 1); ctx.fill(); }
    });
    ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(-4, -9); ctx.moveTo(4, -9); ctx.lineTo(13, -10); ctx.stroke();
    // метина — шрам на левой скуле
    ctx.strokeStyle = 'rgba(240,210,200,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(-9, 5); ctx.stroke();
    ctx.strokeStyle = '#6b4636'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-5, 9); ctx.quadraticCurveTo(0, 10, 5, 9); ctx.stroke();
    ctx.restore();
    // стекло визора
    const vg = ctx.createLinearGradient(-18, -16, 18, 12);
    vg.addColorStop(0, human ? 'rgba(160,190,220,0.35)' : 'rgba(255,60,50,0.28)'); vg.addColorStop(0.5, 'rgba(255,255,255,0.05)'); vg.addColorStop(1, human ? 'rgba(80,110,140,0.35)' : 'rgba(120,10,10,0.35)');
    ctx.fillStyle = vg; rr(ctx, -18, -16, 36, 28, 10); ctx.fill();
    ctx.strokeStyle = human ? '#7a8a9a' : '#ff3b30'; ctx.lineWidth = 1.5; rr(ctx, -18, -16, 36, 28, 10); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; poly(ctx, [[-14, -14], [-6, -14], [-14, -2]]); ctx.fill();
    ctx.restore();
  }

  /* ---------- Строения (запекаются в карту) ---------- */
  SP.drawStruct = function (ctx, st, x, y, rnd, env) {
    const S = K.hex.SIZE;
    ctx.save(); ctx.translate(x, y);
    const shadow = (dx, dy, w, h2) => { ctx.fillStyle = 'rgba(5,10,20,0.35)'; rr(ctx, dx + 5, dy + 6, w, h2, 4); ctx.fill(); };
    const lightDot = (px, py, col, r) => { ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8; ell(ctx, px, py, r || 1.6, r || 1.6); ctx.fill(); ctx.shadowBlur = 0; };
    const pad = (r, col) => { ctx.fillStyle = col || 'rgba(70,82,96,0.9)'; ell(ctx, 0, 0, r, r * 0.92); ctx.fill(); ctx.strokeStyle = 'rgba(220,230,240,0.55)'; ctx.lineWidth = 1.5; ell(ctx, 0, 0, r - 4, r * 0.92 - 4); ctx.stroke(); };
    switch (st.type) {
      case 'colony': {
        pad(S * 0.62, 'rgba(92,102,114,0.85)');
        const mods = [[-14, -12, 16, 12], [4, -16, 14, 14], [-18, 5, 14, 12], [2, 3, 18, 13], [-4, -4, 10, 8]];
        mods.forEach((m, i) => {
          shadow(m[0], m[1], m[2], m[3]);
          const g = ctx.createLinearGradient(m[0], m[1], m[0], m[1] + m[3]);
          g.addColorStop(0, '#c8d0d8'); g.addColorStop(1, '#7c8894');
          ctx.fillStyle = g; rr(ctx, m[0], m[1], m[2], m[3], 3); ctx.fill();
          ctx.fillStyle = '#5c6874'; ctx.fillRect(m[0], m[1] + m[3] - 3, m[2], 3);
          for (let k = 0; k < 3; k++) if (rnd() < 0.7) lightDot(m[0] + 3 + k * (m[2] - 6) / 2, m[1] + 4, rnd() < 0.5 ? '#ffe39a' : '#9fd8ff', 1.2);
          if (i === 1) { ctx.fillStyle = '#5ad1ff'; ell(ctx, m[0] + m[2] / 2, m[1] + m[3] / 2, 3, 3); ctx.fill(); }
        });
        break;
      }
      case 'radar': {
        pad(S * 0.5);
        shadow(-10, -8, 20, 18);
        ctx.fillStyle = '#6f7a86'; rr(ctx, -10, -6, 20, 16, 3); ctx.fill();
        ctx.fillStyle = '#a9b4bf'; rr(ctx, -10, -6, 20, 5, 2); ctx.fill();
        ctx.strokeStyle = '#2d333a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -20); ctx.stroke();
        ctx.fillStyle = '#dfe6ee'; ell(ctx, 3, -22, 10, 5, -0.4); ctx.fill();
        ctx.strokeStyle = '#7b8793'; ctx.lineWidth = 1; ell(ctx, 3, -22, 10, 5, -0.4); ctx.stroke();
        lightDot(0, -20, '#ff3b30', 1.8);
        lightDot(-6, 2, '#9fd8ff', 1.2); lightDot(5, 2, '#9fd8ff', 1.2);
        break;
      }
      case 'rig': {
        pad(S * 0.52, 'rgba(78,84,92,0.9)');
        shadow(-12, -12, 24, 24);
        ctx.strokeStyle = '#c9772e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-12, 10); ctx.lineTo(0, -26); ctx.lineTo(12, 10); ctx.moveTo(-8, -2); ctx.lineTo(8, -2); ctx.moveTo(-5, -12); ctx.lineTo(5, -12); ctx.moveTo(-10, 4); ctx.lineTo(6, -8); ctx.stroke();
        ctx.fillStyle = '#3d4248'; rr(ctx, -16, 8, 32, 8, 2); ctx.fill();
        lightDot(0, -26, '#ffcf5a', 2.2); lightDot(-12, 12, '#ffcf5a', 1.4); lightDot(12, 12, '#ffcf5a', 1.4);
        break;
      }
      case 'hangar': {
        shadow(-24, -16, 48, 32);
        const g = ctx.createLinearGradient(0, -16, 0, 16); g.addColorStop(0, '#aeb8c2'); g.addColorStop(1, '#5e6a76');
        ctx.fillStyle = g; rr(ctx, -24, -16, 48, 30, 12); ctx.fill();
        ctx.strokeStyle = 'rgba(40,50,60,0.6)'; ctx.lineWidth = 1;
        for (let i = -18; i <= 18; i += 6) { ctx.beginPath(); ctx.moveTo(i, -14); ctx.lineTo(i, 12); ctx.stroke(); }
        ctx.fillStyle = '#1d242c'; rr(ctx, -10, 6, 20, 8, 2); ctx.fill();
        ctx.fillStyle = '#ffb000'; for (let i = -9; i < 10; i += 4) ctx.fillRect(i, 12, 2, 2);
        lightDot(-20, -10, '#ffe39a', 1.4); lightDot(20, -10, '#ffe39a', 1.4);
        break;
      }
      case 'depot': {
        pad(S * 0.5, 'rgba(84,90,98,0.85)');
        const cols = ['#8a3a2a', '#3a5a7a', '#6a6a3a', '#5a5a62', '#7a4a1a'];
        [[-16, -10], [-2, -12], [-14, 3], [0, 2], [10, -4]].forEach((p, i) => {
          shadow(p[0], p[1], 13, 9);
          ctx.fillStyle = cols[(i + Math.floor(rnd() * 5)) % 5]; ctx.fillRect(p[0], p[1], 13, 9);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
          for (let k = 2; k < 13; k += 3) { ctx.beginPath(); ctx.moveTo(p[0] + k, p[1]); ctx.lineTo(p[0] + k, p[1] + 9); ctx.stroke(); }
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(p[0], p[1], 13, 2);
        });
        break;
      }
      case 'bunker': {
        shadow(-18, -14, 36, 28);
        ctx.fillStyle = '#6e6e6a'; rr(ctx, -18, -14, 36, 26, 5); ctx.fill();
        ctx.fillStyle = '#8c8c86'; rr(ctx, -16, -12, 32, 8, 3); ctx.fill();
        ctx.fillStyle = '#16171a'; ctx.fillRect(-12, -2, 24, 4);
        ctx.fillStyle = 'rgba(255,200,80,0.6)'; ctx.fillRect(-10, -1, 20, 1.5);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(18, 6); ctx.stroke();
        break;
      }
      case 'drop': {
        ctx.fillStyle = 'rgba(40,44,50,0.9)'; ell(ctx, 0, 0, S * 0.58, S * 0.54); ctx.fill();
        ctx.strokeStyle = '#c8201f'; ctx.lineWidth = 2; ell(ctx, 0, 0, S * 0.5, S * 0.46); ctx.stroke();
        ctx.fillStyle = '#c8201f';
        for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i * Math.PI / 2); poly(ctx, [[0, -16], [5, -10], [-5, -10]]); ctx.fill(); ctx.restore(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ell(ctx, 0, 0, 6, 6); ctx.stroke();
        lightDot(0, 0, '#ff3b30', 2.2);
        break;
      }
      case 'gate': {
        ctx.fillStyle = '#2a2f36'; rr(ctx, -22, -20, 44, 40, 4); ctx.fill();
        ctx.fillStyle = '#6a737c'; rr(ctx, -18, -17, 36, 34, 3); ctx.fill();
        ctx.fillStyle = '#ffb000';
        for (let i = -16; i < 16; i += 6) { poly(ctx, [[i, -17], [i + 3, -17], [i + 6, 17], [i + 3, 17]]); ctx.fill(); }
        ctx.fillStyle = '#3a4048'; ctx.fillRect(-2, -17, 4, 34);
        lightDot(-14, -14, '#3ddc84', 1.8); lightDot(14, -14, '#3ddc84', 1.8);
        break;
      }
      case 'server': {
        ctx.fillStyle = 'rgba(30,36,44,0.95)'; rr(ctx, -22, -18, 44, 36, 4); ctx.fill();
        for (let i = 0; i < 4; i++) {
          const xx = -18 + i * 10;
          ctx.fillStyle = '#15191f'; rr(ctx, xx, -14, 7, 28, 1.5); ctx.fill();
          for (let k = 0; k < 6; k++) if (rnd() < 0.8) lightDot(xx + 2 + (k % 2) * 3, -11 + k * 4.5, rnd() < 0.6 ? '#5ad1ff' : '#3ddc84', 0.9);
        }
        break;
      }
      case 'lab': {
        pad(S * 0.56, 'rgba(90,100,112,0.85)');
        shadow(-16, -12, 32, 24);
        ctx.fillStyle = '#e1e7ee'; rr(ctx, -16, -12, 32, 22, 6); ctx.fill();
        ctx.fillStyle = '#9fb3c8'; rr(ctx, -12, -8, 10, 8, 2); ctx.fill(); rr(ctx, 2, -8, 10, 8, 2); ctx.fill();
        ctx.fillStyle = '#3ddc84'; ctx.fillRect(-2, 4, 4, 4);
        lightDot(-10, 6, '#9fd8ff', 1.2); lightDot(10, 6, '#9fd8ff', 1.2);
        break;
      }
      case 'lift': {
        ctx.fillStyle = 'rgba(30,34,40,0.95)'; rr(ctx, -18, -18, 36, 36, 3); ctx.fill();
        ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 2; rr(ctx, -15, -15, 30, 30, 2); ctx.stroke();
        ctx.strokeStyle = '#5a636e'; ctx.lineWidth = 1.2;
        for (let i = -12; i <= 12; i += 4) { ctx.beginPath(); ctx.moveTo(i, -13); ctx.lineTo(i, 13); ctx.stroke(); }
        lightDot(-15, -15, '#3ddc84', 1.8); lightDot(15, 15, '#3ddc84', 1.8);
        break;
      }
      case 'shaft': {
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, S * 0.75);
        g.addColorStop(0, '#000'); g.addColorStop(0.7, '#05080d'); g.addColorStop(1, 'rgba(20,30,40,0)');
        ctx.fillStyle = g; ell(ctx, 0, 0, S * 0.8, S * 0.72); ctx.fill();
        ctx.strokeStyle = '#c9772e'; ctx.lineWidth = 2; ell(ctx, 0, 0, S * 0.62, S * 0.56); ctx.stroke();
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; lightDot(Math.cos(a) * S * 0.62, Math.sin(a) * S * 0.56, '#ffcf5a', 1.2); }
        break;
      }
    }
    ctx.restore();
    void env;
  };
})();
