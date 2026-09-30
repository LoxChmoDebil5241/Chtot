/* К-47 — игровой движок: состояние операции, правила, бой, регенерация */
'use strict';
(function () {
  const U = K.util, Hx = K.hex, D = K.data;
  const G = K.game = {};
  let S = null; // текущее состояние
  G.fast = false; // без анимаций (тесты)

  /* ---------- События ---------- */
  const handlers = {};
  G.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
  G.emit = (ev, a, b) => { (handlers[ev] || []).forEach(fn => { try { fn(a, b); } catch (e) { console.error(e); } }); };

  G.state = () => S;
  G.rnd = Math.random;

  /* ---------- Хуки UI/рендера (заменяются в ui.js/render.js) ---------- */
  G.hooks = {
    say: async () => {}, story: async () => {}, toast: () => {},
    animMove: async () => {}, animAttack: async () => {}, animDeath: async () => {}, animExplode: async () => {},
    animSpawn: async () => {}, animText: () => {}, focus: async () => {}, rebake: () => {}, decal: () => {}
  };
  G.say = (who, text) => (G.fast ? Promise.resolve() : G.hooks.say(who, text));
  G.story = id => (G.fast ? Promise.resolve() : G.hooks.story(id));
  G.toast = (text, kind) => { G.hooks.toast(text, kind); G.emit('log', text, kind); };

  /* ---------- Индексация ---------- */
  const idx = (c, r) => r * S.W + c;
  G.idx = idx;
  G.inb = (c, r) => c >= 0 && r >= 0 && c < S.W && r < S.H;
  G.tAt = (c, r) => (G.inb(c, r) ? S.terrain[idx(c, r)] : null);
  G.tInfo = (c, r) => D.TERRAIN[S.env][G.tAt(c, r)];
  G.structAt = (c, r) => S.structMap[idx(c, r)] || null;
  G.unitAt = (c, r) => S.occ[idx(c, r)] || null;
  G.T = u => D.UNITS[u.type];

  function rebuildOcc() {
    S.occ = {};
    S.units.forEach(u => { if (!u.dead && !u.evac) S.occ[idx(u.c, u.r)] = u; });
  }

  /* ---------- Загрузка операции ---------- */
  G.load = function (mi, campaign) {
    const m = K.missions[mi];
    const B = new K.MapBuilder(m.W, m.H, m.env, m.seed);
    K.noise.seed(m.seed);
    m.build(B);
    campaign = campaign || {};
    S = {
      mi, m, W: m.W, H: m.H, env: m.env,
      terrain: B.t.slice(), lamps: B.lamps.slice(), roads: B.roads, pipes: B.pipes,
      structs: B.structs.map((s, i) => Object.assign({ id: i }, s)),
      units: [], nextId: 1, turn: 1, phase: 'player',
      norm: { used: 0, max: Math.round((m.norm || 0) * (D.DIFF[campaign.difficulty || 'normal'] || D.DIFF.normal).norm) },
      diff: D.DIFF[campaign.difficulty || 'normal'] || D.DIFF.normal,
      regen: !m.noRegen && (m.norm || 0) > 0,
      regenQueue: [], corpses: {}, stims: Object.assign({}, m.stims || {}),
      stats: { kills: 0, losses: 0, regens: 0, dnaLost: 0, evacuated: 0, evacAny: 0, civHarmed: 0, heroDeaths: 0, dealt: 0, taken: 0, overdoses: 0 },
      fired: [], flags: {}, tagSeen: {}, scans: [], aranesp: {},
      heroCycle: m.cycle.num, heroEvac: false, heroDead: false,
      perks: (campaign.perks || []).slice(), heroXP: campaign.heroXP || 0,
      objDone: {}, objFail: {}, over: null, lastMove: null, log: []
    };
    S.structMap = {};
    S.structs.forEach(s => { S.structMap[idx(s.c, s.r)] = s; });
    m.units.forEach(spec => G.addUnit(spec, true));
    rebuildOcc();
    G.computeVis();
    return S;
  };

  function nameFor(u) {
    if (u.hero) return u.human ? (u.name || 'Кристиан') : 'К-' + S.heroCycle;
    return u.name || null;
  }

  G.addUnit = function (spec, initial) {
    const T = D.UNITS[spec.t];
    const pos = G.findFree(spec.at[0], spec.at[1], T.move);
    if (!pos) return null;
    const u = {
      id: S.nextId++, type: spec.t, fac: spec.f, c: pos[0], r: pos[1],
      hp: spec.hp || T.hp, maxhp: T.hp, ammo: T.ammo, xp: 0, rank: 0,
      name: spec.name || null, tag: spec.tag || null, hero: !!spec.hero, human: !!spec.human,
      ai: spec.ai || (spec.f === 'player' ? null : 'aggro'), home: spec.home || [pos[0], pos[1]],
      mods: spec.mods || {}, moved: false, attacked: false, done: false, mpBonus: 0,
      effects: [], sleep: 0, suppressed: 0, warm: T.warmup ? 0 : 1, hits: 0,
      facing: spec.f === 'player' ? 1 : -1, dead: false, evac: false,
      hidden: !!(T.burrow && spec.f === 'fauna'), alerted: false, scanLeft: T.scan || 0,
      cycle: spec.cycle || (T.clone ? 3 + Math.floor(G.rnd() * 40) : 0),
      series: spec.series || U.pick(['Л', 'М', 'С', 'Т', 'В', 'Р', 'Н'], G.rnd)
    };
    if (spec.rank) u.xp = D.RANKS[spec.rank];
    if (u.hero && !u.human) u.xp = Math.max(u.xp, S.heroXP);
    if (u.hero && u.human) u.xp = Math.max(u.xp, S.heroXP);
    u.rank = G.rankOf(u.xp);
    u.name = nameFor(u) || u.name;
    if (!initial && S.occ) S.occ[idx(u.c, u.r)] = u;
    S.units.push(u);
    if (u.tag) S.tagSeen[u.tag] = true;
    return u;
  };

  G.rankOf = xp => { let r = 0; D.RANKS.forEach((v, i) => { if (xp >= v) r = i; }); return r; };

  G.displayName = u => {
    const T = G.T(u);
    if (u.hero) return u.name;
    if (u.name) return u.name;
    if (T.clone && u.fac === 'player') return u.series + '-' + u.cycle;
    return T.short;
  };

  /* ---------- Свободная клетка поблизости ---------- */
  G.passable = (c, r, move) => {
    if (!G.inb(c, r)) return false;
    if (move === 'air') return true;
    if (move === 'static') { const t = G.tInfo(c, r); return t && t.cost.foot != null; }
    const t = G.tInfo(c, r);
    return !!(t && t.cost[move] != null);
  };
  G.findFree = function (c, r, move) {
    for (let rad = 0; rad < 8; rad++) {
      const ring = rad === 0 ? [[c, r]] : Hx.ring(c, r, rad);
      for (const p of ring) {
        if (G.passable(p[0], p[1], move) && !(S.occ && S.occ[idx(p[0], p[1])]) && !S.units.some(u => !u.dead && !u.evac && u.c === p[0] && u.r === p[1])) return p;
      }
    }
    return null;
  };

  /* ---------- Отношения ---------- */
  G.hostile = (a, b) => {
    if (a === b) return false;
    if (a === 'civ' || b === 'civ') return false;
    if (a === 'fauna' || b === 'fauna') return true;
    if (a === 'player' || b === 'player') return true;
    return false;
  };
  G.canTarget = (att, def) => G.hostile(att.fac, def.fac) || (att.fac === 'player' && def.fac === 'civ');

  /* ---------- Параметры юнита ---------- */
  G.hasFx = (u, id) => u.effects.some(e => e.id === id);
  G.perk = id => S.perks.indexOf(id) >= 0;
  G.atkVal = (u, cls) => {
    const T = G.T(u);
    if (!T.atk) return 0;
    const v = u.mods[cls] != null ? u.mods[cls] : T.atk[cls];
    return v || 0;
  };
  G.range = u => u.mods.range || G.T(u).range;
  G.armor = u => {
    let a = u.mods.armor != null ? u.mods.armor : G.T(u).armor;
    if (u.hero && G.perk('ivan')) a += 1;
    if (G.hasFx(u, 'cocktail')) a += 3;
    return a;
  };
  G.mpMax = u => {
    const T = G.T(u);
    let mp = T.mp + (u.mpBonus || 0);
    if (G.hasFx(u, 'eph2')) mp += 2;
    if (G.hasFx(u, 'ephCrash')) mp -= 2;
    if (G.hasFx(u, 'choco')) mp += 4;
    if (G.hasFx(u, 'cocktail')) mp += 4;
    if (u.suppressed) mp -= 2;
    return Math.max(T.mp > 0 ? 2 : 0, mp);
  };
  G.vision = u => {
    let v = G.T(u).vision;
    if (S.env === 'under' && !S.m.station) v -= 1;
    if (u.hero && S.m.cycle.whiteEyes) v += 1;
    if (G.perk('arina')) v += 1;
    return Math.max(2, v);
  };
  G.isInfinite = u => { const T = G.T(u); return T.ammo === 0 || T.ammo >= 99; };
  G.canAct = u => !u.dead && !u.evac && !u.sleep && !G.hasFx(u, 'exhausted');

  G.canAttack = u => {
    const T = G.T(u);
    if (!T.atk || !G.canAct(u) || u.attacked || u.done) return false;
    if (!G.isInfinite(u) && u.ammo <= 0) return false;
    if (T.noMoveFire && u.moved) return false;
    if (G.hasFx(u, 'convulsion')) return false;
    if (T.warmup && u.warm < 1) return false;
    return true;
  };
  G.canMove = u => {
    const T = G.T(u);
    return T.move !== 'static' && G.canAct(u) && !u.moved && !u.done && !(T.noMoveFire && u.attacked);
  };

  /* ---------- Защита местности ---------- */
  G.defBonus = (u, c, r) => {
    c = c == null ? u.c : c; r = r == null ? u.r : r;
    const T = G.T(u);
    if (T.move === 'air') return 0;
    const st = G.structAt(c, r);
    let d = st && D.STRUCT[st.type] ? D.STRUCT[st.type].def : G.tInfo(c, r).def;
    if (T.move === 'heavy' || T.move === 'track') d = d * 0.5;
    return U.clamp(d, -30, 70);
  };

  /* ---------- Видимость ---------- */
  G.computeVis = function () {
    const N = S.W * S.H;
    S.vis = new Uint8Array(N);
    S.units.forEach(u => {
      if (u.dead || u.evac || u.fac !== 'player') return;
      Hx.disk(u.c, u.r, G.vision(u)).forEach(p => { if (G.inb(p[0], p[1])) S.vis[idx(p[0], p[1])] = 1; });
    });
    S.scans.forEach(sc => Hx.disk(sc.c, sc.r, sc.rad).forEach(p => { if (G.inb(p[0], p[1])) S.vis[idx(p[0], p[1])] = 2; }));
    // затаившиеся твари
    const near = G.perk('arina') ? 2 : 1;
    S.units.forEach(u => {
      if (!u.hidden || u.dead) return;
      const i = idx(u.c, u.r);
      if (S.vis[i] === 2 || S.units.some(p => !p.dead && !p.evac && p.fac === 'player' && Hx.dist(p.c, p.r, u.c, u.r) <= near)) u.hidden = false;
    });
  };
  G.visibleHex = (c, r) => G.inb(c, r) && S.vis[idx(c, r)] > 0;
  G.seen = u => {
    if (u.dead || u.evac) return false;
    if (u.fac === 'player') return true;
    if (u.hidden) return false;
    return G.visibleHex(u.c, u.r);
  };

  /* ---------- Стоимость движения и досягаемость ---------- */
  G.moveCost = (u, c, r) => {
    const T = G.T(u);
    if (!G.inb(c, r)) return null;
    if (T.move === 'air') return S.env === 'surface' ? 2 : null;
    if (T.move === 'static') return null;
    const t = G.tInfo(c, r);
    if (!t) return null;
    const v = t.cost[T.move];
    return v == null ? null : v;
  };

  function zocAt(u, c, r) {
    if (G.T(u).move === 'air') return false;
    const nb = Hx.neighbors(c, r);
    for (const p of nb) {
      const o = G.unitAt(p[0], p[1]);
      if (!o || o === u) continue;
      if (!G.hostile(u.fac, o.fac)) continue;
      if (G.T(o).move === 'air' || G.T(o).civ) continue;
      if (u.fac === 'player' && !G.seen(o)) continue;
      return true;
    }
    return false;
  }

  G.reach = function (u, opts) {
    opts = opts || {};
    const res = {};
    const start = idx(u.c, u.r);
    res[start] = { cost: 0, prev: -1, stop: false, end: true };
    if (!opts.ignoreMoved && !G.canMove(u)) return res;
    const mp = opts.mp != null ? opts.mp : G.mpMax(u);
    const heap = new U.Heap();
    heap.push(0, start);
    const isAI = u.fac !== 'player';
    while (heap.size) {
      const [cost, i] = heap.pop();
      const node = res[i];
      if (!node || node.cost < cost) continue;
      if (node.stop && i !== start) continue;
      const c = i % S.W, r = (i / S.W) | 0;
      for (const p of Hx.neighbors(c, r)) {
        if (!G.inb(p[0], p[1])) continue;
        const mc = G.moveCost(u, p[0], p[1]);
        if (mc == null) continue;
        const j = idx(p[0], p[1]);
        let nc = cost + mc;
        if (nc > mp) { if (i === start && !u.moved && mp >= 2) nc = mp; else continue; }
        const occ = S.occ[j];
        let canEnd = true;
        if (occ && occ !== u) {
          const bothAir = G.T(occ).move === 'air';
          if (G.hostile(u.fac, occ.fac) && (isAI || G.seen(occ))) continue;
          if (!G.hostile(u.fac, occ.fac) && G.T(u).move === 'air' && !bothAir) { /* пролёт над своими */ }
          canEnd = false;
        }
        const stop = zocAt(u, p[0], p[1]);
        if (!res[j] || res[j].cost > nc) {
          res[j] = { cost: nc, prev: i, stop, end: canEnd };
          heap.push(nc, j);
        }
      }
    }
    return res;
  };

  G.pathTo = (reach, j) => {
    const out = [];
    let k = j;
    while (k !== -1 && k != null && reach[k]) { out.push(k); k = reach[k].prev; }
    return out.reverse().map(i => [i % S.W, (i / S.W) | 0]);
  };

  // Поле расстояний (для ИИ) без учёта юнитов
  G.distField = function (move, goals) {
    const N = S.W * S.H;
    const dist = new Float32Array(N).fill(1e9);
    const heap = new U.Heap();
    goals.forEach(g => { if (G.inb(g[0], g[1])) { const i = idx(g[0], g[1]); dist[i] = 0; heap.push(0, i); } });
    const fake = { type: null };
    while (heap.size) {
      const [d, i] = heap.pop();
      if (d > dist[i]) continue;
      const c = i % S.W, r = (i / S.W) | 0;
      for (const p of Hx.neighbors(c, r)) {
        if (!G.inb(p[0], p[1])) continue;
        let mc;
        if (move === 'air') mc = 2;
        else { const t = G.tInfo(p[0], p[1]); mc = t ? t.cost[move] : null; }
        if (mc == null) continue;
        const j = idx(p[0], p[1]);
        if (d + mc < dist[j]) { dist[j] = d + mc; heap.push(d + mc, j); }
      }
    }
    void fake;
    return dist;
  };

  /* ---------- Цели атаки ---------- */
  G.targets = function (u, fromC, fromR) {
    const out = [];
    if (!G.canAttack(u)) return out;
    fromC = fromC == null ? u.c : fromC; fromR = fromR == null ? u.r : fromR;
    const [mn, mx] = G.range(u);
    const isP = u.fac === 'player';
    S.units.forEach(o => {
      if (o.dead || o.evac || o === u) return;
      if (!G.canTarget(u, o)) return;
      if (isP && !G.seen(o)) return;
      if (!isP && o.fac === 'civ') return;
      const d = Hx.dist(fromC, fromR, o.c, o.r);
      if (d < mn || d > mx) return;
      if (G.atkVal(u, G.T(o).cls) <= 0) return;
      out.push({ unit: o, d });
    });
    // газовые гексы
    if (isP || G.T(u).warmup) {
      for (let rad = Math.max(1, mn); rad <= mx; rad++) {
        Hx.ring(fromC, fromR, rad).forEach(p => {
          if (!G.inb(p[0], p[1])) return;
          const t = G.tInfo(p[0], p[1]);
          if (t && t.gas && (!isP || G.visibleHex(p[0], p[1]))) out.push({ gas: [p[0], p[1]], d: rad });
        });
      }
    }
    return out;
  };

  /* ---------- Расчёт урона ---------- */
  G.calc = function (att, def, opts) {
    opts = opts || {};
    const Ta = G.T(att), Td = G.T(def);
    let base = G.atkVal(att, Td.cls);
    if (base <= 0) return 0;
    const hpF = 0.45 + 0.55 * att.hp / att.maxhp;
    const rankF = 1 + 0.1 * att.rank;
    let mult = 1;
    if (Ta.antiFauna && Td.beast) mult *= 1.4;
    if (Ta.hunter && def.hp < def.maxhp) mult *= 1.3;
    if (Ta.laser) mult *= Math.max(0.35, 1 - 0.1 * (S.turn - 1));
    if (G.hasFx(att, 'dox')) mult *= 1.4;
    if (G.hasFx(att, 'cocktail')) mult *= 2;
    if (G.hasFx(att, 'ephCrash')) mult *= 0.9;
    if (att.hero && S.m.cycle.whiteEyes) mult *= 1.1;
    if (att.suppressed && !G.hasFx(att, 'dox')) mult *= 0.7;
    if (!opts.counter) mult *= 1 + 0.15 * (def.hits || 0);
    if (opts.counter) mult *= 0.7;
    if (def.sleep) mult *= 1.2;
    const td = G.defBonus(def);
    mult *= 1 - td / 100;
    mult *= 1 - 0.05 * def.rank;
    const armorF = 6 / (6 + G.armor(def));
    if (att.fac !== 'player' && def.fac === 'player') mult *= S.diff.dmg;
    const dmg = base * hpF * rankF * mult * armorF;
    if (opts.expect) return dmg;
    return U.clamp(U.sround(dmg * (0.75 + G.rnd() * 0.5), G.rnd), 0, 99);
  };

  G.canCounter = (def, att) => {
    const Td = G.T(def);
    if (!Td.atk || !G.canAct(def) || Td.civ) return false;
    if (!G.isInfinite(def) && def.ammo <= 0) return false;
    if (Td.warmup && def.warm < 1) return false;
    const d = Hx.dist(def.c, def.r, att.c, att.r);
    const [mn, mx] = G.range(def);
    if (d < mn || d > mx) return false;
    return G.atkVal(def, G.T(att).cls) > 0;
  };

  G.forecast = function (att, def) {
    const e = G.calc(att, def, { expect: true });
    const lo = Math.max(0, Math.floor(e * 0.75)), hi = Math.min(def.hp, Math.ceil(e * 1.25));
    let clo = 0, chi = 0;
    if (G.canCounter(def, att)) {
      const hpAfter = Math.max(0, def.hp - Math.round(e));
      if (hpAfter > 0) {
        const saved = def.hp; def.hp = hpAfter;
        const ce = G.calc(def, att, { expect: true, counter: true });
        def.hp = saved;
        clo = Math.max(0, Math.floor(ce * 0.75)); chi = Math.min(att.hp, Math.ceil(ce * 1.25));
      }
    }
    return { lo, hi, clo, chi, kill: lo >= def.hp };
  };

  /* ---------- Действия ---------- */
  G.busy = false;

  G.move = async function (u, destC, destR, reachMap) {
    if (S.over) return false;
    const reach = reachMap || G.reach(u);
    const j = idx(destC, destR);
    const node = reach[j];
    if (!node || !node.end || j === idx(u.c, u.r)) return false;
    const path = G.pathTo(reach, j);
    const from = [u.c, u.r];
    let revealed = false, ambush = false;
    let stopAt = path.length - 1;
    // пошаговая проверка засад: скрытый враг на пути или внезапный контакт
    const seenBefore = {};
    S.units.forEach(o => { if (o.fac !== u.fac && G.seen(o)) seenBefore[o.id] = 1; });
    const startIdx = idx(u.c, u.r);
    for (let k = 1; k < path.length; k++) {
      const p = path[k];
      const occ = G.unitAt(p[0], p[1]);
      if (occ && occ !== u && G.hostile(u.fac, occ.fac)) { stopAt = k - 1; ambush = true; occ.hidden = false; break; }
      if (u.fac !== 'player') continue;
      delete S.occ[idx(u.c, u.r)]; u.c = p[0]; u.r = p[1]; S.occ[idx(u.c, u.r)] = u;
      G.computeVis();
      const fresh = S.units.filter(o => o.fac !== 'player' && !seenBefore[o.id] && G.seen(o));
      if (fresh.length) {
        revealed = true;
        fresh.forEach(o => { seenBefore[o.id] = 1; });
        const adj = Hx.neighbors(p[0], p[1]).some(q => { const o = G.unitAt(q[0], q[1]); return o && o !== u && G.hostile(u.fac, o.fac) && G.seen(o); });
        if (adj && k < path.length - 1) { stopAt = k; ambush = true; break; }
      }
    }
    if (u.fac === 'player') { delete S.occ[idx(u.c, u.r)]; u.c = from[0]; u.r = from[1]; S.occ[startIdx] = u; }
    // нельзя остановиться на клетке, занятой своим
    while (stopAt > 0) { const o = G.unitAt(path[stopAt][0], path[stopAt][1]); if (!o || o === u) break; stopAt--; }
    const realPath = path.slice(0, stopAt + 1);
    if (realPath.length < 2) {
      if (ambush) { u.moved = true; G.toast('Засада! Движение остановлено', 'warn'); G.computeVis(); G.emit('changed'); }
      return false;
    }
    const fin = realPath[realPath.length - 1];
    await G.hooks.animMove(u, realPath);
    delete S.occ[idx(u.c, u.r)];
    u.c = fin[0]; u.r = fin[1];
    S.occ[idx(u.c, u.r)] = u;
    if (fin[0] !== from[0]) u.facing = fin[0] > from[0] ? 1 : -1;
    u.moved = true;
    if (G.T(u).move === 'air' || G.T(u).mp === 0) { /* */ }
    if (ambush && u.fac === 'player') G.toast('Засада! Движение остановлено', 'warn');
    G.computeVis();
    const changed = await G.arrive(u);
    S.lastMove = (u.fac === 'player' && !revealed && !ambush && !changed) ? { id: u.id, from, bonus: u.mpBonus } : null;
    G.emit('changed');
    await G.checkTriggers('move', u);
    G.checkEnd();
    return true;
  };

  G.undo = function () {
    const lm = S.lastMove;
    if (!lm) return false;
    const u = S.units.find(x => x.id === lm.id);
    if (!u || u.attacked || u.dead) { S.lastMove = null; return false; }
    delete S.occ[idx(u.c, u.r)];
    u.c = lm.from[0]; u.r = lm.from[1];
    S.occ[idx(u.c, u.r)] = u;
    u.moved = false; u.done = false;
    S.lastMove = null;
    G.computeVis();
    G.emit('changed');
    return true;
  };

  // прибытие на гекс: захват, тела, эвакуация
  G.arrive = async function (u) {
    const T = G.T(u);
    let changed = false;
    const i = idx(u.c, u.r);
    const st = G.structAt(u.c, u.r);
    // эвакуация
    if (u.fac === 'player' && st && (st.type === 'gate' || st.type === 'lift')) {
      const ev = S.m.objectives.find(o => (o.type === 'evac' || o.type === 'reach') && o.exitTag === st.tag);
      if (ev && (ev.type === 'reach' || u.tag === ev.unitTag) && T.move !== 'air') {
        u.evac = true; delete S.occ[i];
        S.stats.evacuated += (ev.type === 'evac' ? 1 : 0);
        S.stats.evacAny++;
        if (u.hero) S.heroEvac = true;
        G.toast((G.displayName(u)) + ' эвакуирован', 'good');
        G.hooks.animText(u.c, u.r, 'ЭВАКУАЦИЯ', '#8fffb0');
        await G.checkTriggers('evac', u);
        G.computeVis();
        return true;
      }
    }
    // захват
    if (st && T.capture && st.owner !== u.fac && st.owner !== 'none' && st.type !== 'shaft' && !(st.type === 'gate' || st.type === 'lift')) {
      if (u.fac !== 'civ' && u.fac !== 'fauna') {
        const prev = st.owner;
        st.owner = u.fac;
        changed = true;
        if (u.fac === 'player') { G.toast('Захвачено: ' + st.name, 'good'); K.audio && K.audio.sfx('capture'); }
        else if (prev === 'player') { G.toast('Потерян объект: ' + st.name, 'bad'); K.audio && K.audio.sfx('alarm'); }
        G.hooks.animText(u.c, u.r, 'ЗАХВАТ', u.fac === 'player' ? '#9dff9d' : '#ff8d8d');
        await G.checkTriggers('capture', st);
      }
    }
    // тела активов
    if (S.corpses[i]) {
      if (u.fac === 'player' && (T.capture || T.collect)) {
        delete S.corpses[i]; changed = true;
        if (T.collect && S.norm.used > 0) { S.norm.used--; G.toast('Биомасса эвакуирована: норма −1', 'good'); }
        else G.toast('Тело эвакуировано', 'info');
      } else if (u.fac === 'fauna') {
        delete S.corpses[i]; u.hp = Math.min(u.maxhp, u.hp + 3);
        G.toast('Фауна пожирает биомассу', 'warn'); changed = true;
      } else if (u.fac !== 'player' && u.fac !== 'civ' && T.capture) {
        delete S.corpses[i]; changed = true;
        if (S.regen) { S.norm.used++; S.stats.dnaLost++; G.toast('ДНК актива утрачена: противник забрал тело. Норма +1', 'bad'); G.checkNorm(); }
      }
    }
    return changed;
  };

  G.attack = async function (att, target) {
    if (S.over || !G.canAttack(att)) return false;
    const Ta = G.T(att);
    if (target.gas) return G.igniteShot(att, target.gas[0], target.gas[1]);
    const def = target.unit || target;
    if (def.dead) return false;
    if (def.c !== att.c) att.facing = def.c > att.c ? 1 : -1;
    if (!G.isInfinite(att)) att.ammo--;
    att.attacked = true;
    S.lastMove = null;
    if (Ta.noMoveFire) att.moved = true;
    const dmg = G.calc(att, def);
    def.hits = (def.hits || 0) + 1;
    if (def.hidden) def.hidden = false;
    if (def.fac === 'fauna' || def.ai === 'guard' || def.ai === 'territorial') def.alerted = true;
    const Td = G.T(def);
    let counter = 0;
    await G.hooks.animAttack(att, def, dmg, false);
    def.hp -= dmg;
    S.stats[att.fac === 'player' ? 'dealt' : 'taken'] += dmg;
    if (def.fac === 'civ' && att.fac === 'player' && dmg > 0) S.stats.civHarmed++;
    if (Ta.suppress && def.hp > 0 && !G.hasFx(def, 'dox')) def.suppressed = 1;
    if (def.sleep && dmg > 0) def.sleep = 0;
    G.gainXP(att, def.hp <= 0 ? 3 : 1);
    if (def.hp <= 0) {
      await G.kill(def, att, 'combat');
    } else {
      G.gainXP(def, 1);
      if (G.canCounter(def, att)) {
        counter = G.calc(def, att, { counter: true });
        await G.hooks.animAttack(def, att, counter, true);
        att.hp -= counter;
        if (att.hp <= 0) { G.gainXP(def, 2); await G.kill(att, def, 'combat'); }
      }
    }
    // плазма по газу
    if (Ta.warmup && !def.dead) {
      const t = G.tInfo(def.c, def.r);
      if (t && t.gas) await G.explode(def.c, def.r, att);
    }
    if (Ta.warmup) att.warm = 1;
    G.emit('changed');
    await G.checkTriggers('attack', att);
    G.checkEnd();
    return { dmg, counter };
  };

  G.gainXP = (u, n) => {
    if (u.dead || G.T(u).beast || G.T(u).civ || G.T(u).move === 'static') return;
    const before = u.rank;
    u.xp += n;
    u.rank = G.rankOf(u.xp);
    if (u.rank > before && u.fac === 'player') { G.toast(G.displayName(u) + ': ранг ' + u.rank, 'good'); G.hooks.animText(u.c, u.r, '▲ РАНГ ' + u.rank, '#ffe28a'); }
  };

  /* ---------- Газ и взрывы ---------- */
  G.igniteShot = async function (att, c, r) {
    if (!G.isInfinite(att)) att.ammo--;
    att.attacked = true;
    if (G.T(att).noMoveFire) att.moved = true;
    if (c !== att.c) att.facing = c > att.c ? 1 : -1;
    S.lastMove = null;
    await G.hooks.animAttack(att, { c, r, gasHex: true }, 0, false);
    await G.explode(c, r, att);
    G.emit('changed');
    G.checkEnd();
    return true;
  };

  G.explode = async function (c, r, by) {
    const queue = [[c, r]];
    const done = {};
    while (queue.length) {
      const [x, y] = queue.shift();
      const k = idx(x, y);
      if (done[k]) continue;
      const t = G.tInfo(x, y);
      if (!t || !t.gas) continue;
      done[k] = 1;
      S.terrain[k] = S.env === 'surface' ? 'x' : '.';
      G.hooks.rebake(x, y);
      await G.hooks.animExplode(x, y);
      const hitList = [];
      const u0 = G.unitAt(x, y); if (u0) hitList.push([u0, 5]);
      Hx.neighbors(x, y).forEach(p => { const o = G.unitAt(p[0], p[1]); if (o && G.T(o).move !== 'air') hitList.push([o, 3]); });
      for (const [o, base] of hitList) {
        if (o.dead) continue;
        const dmg = U.sround(base * 6 / (6 + G.armor(o)) * 1.4, G.rnd);
        o.hp -= dmg;
        o.hidden = false;
        G.hooks.animText(o.c, o.r, '-' + dmg, '#ffb347');
        if (o.fac === 'civ' && by && by.fac === 'player' && dmg > 0) S.stats.civHarmed++;
        if (o.hp <= 0) { if (by && !by.dead && G.hostile(by.fac, o.fac)) G.gainXP(by, 2); await G.kill(o, by, 'explosion'); }
      }
      Hx.neighbors(x, y).forEach(p => { const tt = G.tInfo(p[0], p[1]); if (tt && tt.gas) queue.push(p); });
    }
    G.computeVis();
  };

  /* ---------- Гибель ---------- */
  G.kill = async function (u, killer, cause) {
    if (u.dead) return;
    u.dead = true;
    delete S.occ[idx(u.c, u.r)];
    const T = G.T(u);
    await G.hooks.animDeath(u, cause);
    if (u.fac === 'player') {
      const cloneLine = (T.clone || u.hero) && !u.human;
      if (cloneLine && S.regen && !S.flags.noRegen) {
        S.norm.used += cause === 'overdose' ? 2 : 1;
        S.stats.regens++;
        if (T.move !== 'air') S.corpses[idx(u.c, u.r)] = (S.corpses[idx(u.c, u.r)] || 0) + 1;
        const delay = G.perk('elena') ? 1 : 2;
        S.regenQueue.push({ t: u.type, name: u.hero ? null : u.name, tag: u.tag, xp: u.xp, hero: u.hero, cycle: u.cycle + 1, series: u.series, mods: u.mods, turns: delay });
        if (u.hero) { S.heroCycle++; S.stats.heroDeaths++; G.toast(u.name + ' деактивирован. Цикл ' + S.heroCycle + ' — регенерация через ' + delay + ' х.', 'bad'); }
        else G.toast(G.displayName(u) + ' деактивирован. Регенерация через ' + delay + ' х. Норма ' + S.norm.used + '/' + S.norm.max, 'bad');
        G.checkNorm();
      } else {
        S.stats.losses++;
        G.toast(G.displayName(u) + (T.civ ? ' погиб' : ' — безвозвратная потеря'), 'bad');
        if (u.hero) { S.heroDead = true; G.lose(u.human ? 'Кристиан Комаров погиб. Контракт сорван.' : (S.flags.noRegen === 'transfer' ? 'Актив К-47 утрачен без возможности регенерации.' : 'Актив погиб без возможности регенерации.')); }
      }
    } else {
      if (killer && killer.fac === 'player') S.stats.kills++;
      if (u.fac === 'civ' && killer && killer.fac === 'player') S.stats.civHarmed++;
      if (u.fac === 'fauna' && T.beast) G.hooks.decal(u.c, u.r, 'ichor');
    }
    if (cause === 'overdose') S.stats.overdoses++;
    await G.checkTriggers('death', u);
    G.computeVis();
    G.emit('changed');
  };

  G.checkNorm = () => {
    if (S.regen && S.norm.max > 0 && S.norm.used > S.norm.max) G.lose('Перерасход плоти: ' + S.norm.used + ' из ' + S.norm.max + '. Операция свёрнута как нерентабельная.');
  };

  G.disableRegen = reason => {
    S.flags.noRegen = reason || true;
    S.regenQueue = [];
    G.emit('changed');
  };

  /* ---------- Особые действия ---------- */
  G.resupplyInfo = u => {
    const T = G.T(u);
    if (!G.canAct(u) || u.moved || u.attacked || u.done) return null;
    if (G.isInfinite(u) && u.hp >= u.maxhp) return null;
    const near = S.structs.some(s => s.owner === u.fac && D.STRUCT[s.type].supply && Hx.dist(s.c, s.r, u.c, u.r) <= 1) ||
      S.units.some(o => !o.dead && o.fac === u.fac && G.T(o).supply && Hx.dist(o.c, o.r, u.c, u.r) <= 1 && o !== u);
    if (!T.atk && !near) return null;
    return { full: near };
  };
  G.resupply = function (u) {
    const inf = G.resupplyInfo(u);
    if (!inf) return false;
    const T = G.T(u);
    if (!G.isInfinite(u)) u.ammo = inf.full ? T.ammo : Math.min(T.ammo, u.ammo + Math.ceil(T.ammo / 2));
    if (inf.full) u.hp = Math.min(u.maxhp, u.hp + 2);
    u.moved = u.attacked = u.done = true;
    S.lastMove = null;
    G.hooks.animText(u.c, u.r, 'ПОПОЛНЕНИЕ', '#9fd8ff');
    G.emit('changed');
    return true;
  };

  G.wait = u => { u.done = true; S.lastMove = null; G.emit('changed'); };

  G.scan = function (u) {
    if (!u.scanLeft || !G.canAct(u)) return false;
    u.scanLeft--;
    S.scans.push({ c: u.c, r: u.r, rad: 6 });
    G.computeVis();
    K.audio && K.audio.sfx('scan');
    G.hooks.animText(u.c, u.r, 'ГЕОСКАН', '#7fe8ff');
    G.emit('scan', u);
    G.emit('changed');
    return true;
  };

  G.boreTargets = u => {
    if (!G.T(u).bore || !G.canAct(u) || u.attacked || u.done) return [];
    return Hx.neighbors(u.c, u.r).filter(p => {
      const t = G.tAt(p[0], p[1]);
      return t === '#' || (S.env === 'surface' && (t === '^' || t === 'A'));
    });
  };
  G.bore = async function (u, c, r) {
    if (!G.boreTargets(u).some(p => p[0] === c && p[1] === r)) return false;
    u.attacked = true; u.moved = true; u.done = true;
    S.lastMove = null;
    K.audio && K.audio.sfx('drill');
    await G.hooks.animAttack(u, { c, r, bore: true }, 0, false);
    S.terrain[idx(c, r)] = S.env === 'surface' ? '.' : '.';
    G.hooks.rebake(c, r);
    G.toast('Порода пробита', 'info');
    G.computeVis();
    G.emit('changed');
    return true;
  };

  G.torchTargets = u => {
    if (!G.T(u).capture || !G.canAct(u) || u.attacked || u.done || u.fac !== 'player') return [];
    return Hx.neighbors(u.c, u.r).filter(p => { const t = G.tInfo(p[0], p[1]); return t && t.gas; });
  };
  G.torch = async function (u, c, r) {
    if (!G.torchTargets(u).some(p => p[0] === c && p[1] === r)) return false;
    u.attacked = true; u.done = true;
    S.lastMove = null;
    G.hooks.animText(u.c, u.r, 'ПАЯЛЬНАЯ ЛАМПА', '#ffb347');
    await G.explode(c, r, u);
    G.emit('changed');
    G.checkEnd();
    return true;
  };

  /* ---------- Стимуляторы ---------- */
  G.stimTargets = u => Hx.neighbors(u.c, u.r).map(p => G.unitAt(p[0], p[1])).filter(o => o && G.hostile(u.fac, o.fac) && G.seen(o) && G.T(o).cls === 'soft' && !G.T(o).boss);
  G.canStim = (u, id) => {
    if (!S.stims[id] || u.fac !== 'player' || u.dead || u.evac) return false;
    const T = G.T(u);
    if (T.move === 'track' || T.move === 'air' || T.move === 'static' || T.civ) return false;
    if (u.sleep || G.hasFx(u, 'exhausted')) return false;
    if (id === 'nocturine') return G.stimTargets(u).length > 0 && !u.done;
    if (id === 'impedrizine') return u.hp < u.maxhp;
    return true;
  };
  G.useStim = async function (u, id, target) {
    if (!G.canStim(u, id)) return false;
    S.stims[id]--;
    S.lastMove = null;
    K.audio && K.audio.sfx('stim');
    u.turnStims = u.turnStims || {};
    if (id !== 'nocturine') u.turnStims[id] = 1;
    switch (id) {
      case 'ephedrine':
        if (u.moved && !u.attacked) { u.moved = false; u.mpBonus = -G.T(u).mp + 2; }
        else u.mpBonus += 2;
        u.effects.push({ id: 'eph2', t: 2 });
        break;
      case 'dox':
        u.effects.push({ id: 'dox', t: 1 });
        u.suppressed = 0;
        break;
      case 'hyperzine':
        u.moved = false; u.attacked = false; u.done = false; u.mpBonus = 0;
        u.hp = Math.min(u.maxhp, u.hp + 2);
        u.effects.push({ id: 'exhaustNext', t: 1 });
        break;
      case 'aranesp':
        S.aranesp[u.id] = (S.aranesp[u.id] || 0) + 1;
        u.mpBonus += 2;
        if (!G.isInfinite(u)) u.ammo = Math.min(G.T(u).ammo + 2, u.ammo + 2);
        if (S.aranesp[u.id] > 1) { u.hp -= 1; G.toast('Зависимость: −1 здоровья', 'warn'); }
        break;
      case 'impedrizine':
        u.hp = Math.min(u.maxhp, u.hp + 4);
        u.moved = u.attacked = u.done = true;
        break;
      case 'nocturine': {
        const t = target || G.stimTargets(u)[0];
        if (!t) return false;
        t.sleep = 2;
        u.done = true; u.attacked = true;
        G.hooks.animText(t.c, t.r, 'СОН', '#7fa8ff');
        break;
      }
    }
    G.hooks.animText(u.c, u.r, D.STIMS[id].name.toUpperCase(), D.STIMS[id].color === '#3b2a1a' ? '#d9a066' : D.STIMS[id].color);
    // коктейль
    if (Object.keys(u.turnStims).length >= 3 && !G.hasFx(u, 'cocktail')) {
      u.effects = u.effects.filter(e => e.id !== 'exhaustNext' && e.id !== 'eph2');
      u.effects.push({ id: 'cocktail', t: 2 });
      u.moved = false; u.attacked = false; u.done = false;
      G.toast('КОКТЕЙЛЬ. Сердце бьётся слишком быстро. Осталось меньше двух ходов.', 'bad');
      K.audio && K.audio.sfx('heartbeat');
      G.hooks.animText(u.c, u.r, 'КОКТЕЙЛЬ', '#ff3b30');
    }
    if (u.hp <= 0) await G.kill(u, null, 'overdose');
    G.emit('changed');
    return true;
  };

  /* ---------- Цели операции ---------- */
  G.objStatus = function (o, i) {
    if (S.objFail[i]) return 'fail';
    if (S.objDone[i]) return 'done';
    const own = tag => { const s = S.structs.find(x => x.tag === tag); return s && s.owner === 'player'; };
    switch (o.type) {
      case 'capture': return o.tags.every(own) ? 'done' : 'pending';
      case 'hold': {
        if (o.critical && !o.tags.every(own)) return 'fail';
        const n = o.tags.filter(own).length;
        if (o.min && n < o.min) return 'danger';
        return 'pending';
      }
      case 'evac': {
        if (S.stats.evacuated >= o.count) return 'done';
        const alive = S.units.filter(u => u.tag === o.unitTag && !u.dead && !u.evac).length;
        return alive + S.stats.evacuated < o.count ? 'fail' : 'pending';
      }
      case 'reach': {
        if (S.stats.evacAny >= o.count) return 'done';
        const alive = S.units.filter(u => u.fac === 'player' && !u.dead && !u.evac && G.T(u).move !== 'static').length + S.regenQueue.length;
        return alive + S.stats.evacAny < o.count ? 'fail' : 'pending';
      }
      case 'heroReach': return S.heroEvac ? 'done' : 'pending';
      case 'destroy': {
        if (!S.tagSeen[o.unitTag]) return 'pending';
        return S.units.some(u => u.tag === o.unitTag && !u.dead) ? 'pending' : 'done';
      }
      case 'survive': return (o.heroAlive && S.heroDead) ? 'fail' : 'pending';
      case 'noLoss': return S.stats.losses + S.stats.regens > 0 ? 'fail' : 'pending';
      case 'keepUnit': return S.units.some(u => u.tag === o.unitTag && u.dead) ? 'fail' : 'pending';
      case 'noCiv': return S.stats.civHarmed > 0 ? 'fail' : 'pending';
    }
    return 'pending';
  };

  G.primaryDone = () => S.m.objectives.every((o, i) => o.secondary || G.objStatus(o, i) === 'done');

  G.checkEnd = function () {
    if (S.over) return;
    const objs = S.m.objectives;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      const st = G.objStatus(o, i);
      if (!o.secondary && st === 'fail') {
        let why = 'Задача провалена.';
        if (o.type === 'hold') why = o.min ? 'Удержано меньше ' + o.min + ' объектов из ' + o.tags.length + '.' : 'Объект «' + (S.structs.find(s => s.tag === o.tags[0]) || {}).name + '» потерян.';
        else if (o.type === 'evac') why = 'Эвакуация сорвана: сотрудников не осталось.';
        else if (o.type === 'reach') why = 'Некому дойти до лифта.';
        else if (o.type === 'survive') why = 'Актив погиб.';
        G.lose(why);
        return;
      }
    }
    if (objs.some(o => !o.secondary && (o.type === 'hold' || o.type === 'survive'))) {
      // победа по времени проверяется в конце хода
      if (G.primaryDone()) G.win();
      return;
    }
    if (G.primaryDone()) G.win();
  };

  G.win = function () {
    if (S.over) return;
    S.m.objectives.forEach((o, i) => {
      const st = G.objStatus(o, i);
      if (st === 'fail') S.objFail[i] = true;
      else if (st !== 'danger' && (st === 'done' || ['noLoss', 'keepUnit', 'noCiv', 'survive', 'hold'].indexOf(o.type) >= 0)) S.objDone[i] = true;
    });
    S.over = { win: true };
    G.emit('over', S.over);
  };
  G.lose = function (reason) {
    if (S.over) return;
    S.over = { win: false, reason };
    G.emit('over', S.over);
  };

  G.efficiency = function () {
    const m = S.m;
    let score = 100;
    if (m.norm) score -= 60 * (S.norm.used / Math.max(1, m.norm));
    score -= 12 * S.stats.losses;
    score -= 20 * S.stats.overdoses;
    score -= 8 * S.stats.dnaLost;
    const timed = m.objectives.some(o => !o.secondary && (o.type === 'hold' || o.type === 'survive'));
    if (!timed) score -= Math.max(0, S.turn - Math.ceil(m.turns * 0.6)) * 2;
    m.objectives.forEach((o, i) => { if (o.secondary) score += S.objDone[i] ? 6 : -4; });
    return Math.round(U.clamp(score, 5, 100));
  };

  /* ---------- Ходы ---------- */
  G.processEffects = function (fac) {
    S.units.forEach(u => {
      if (u.dead || u.evac || u.fac !== fac) return;
      u.moved = false; u.attacked = false; u.done = false; u.mpBonus = 0; u.turnStims = {};
      if (u.suppressed) u.suppressed--;
      if (u.sleep) { u.sleep--; u.done = true; u.moved = true; u.attacked = true; if (!u.sleep) G.hooks.animText(u.c, u.r, 'ПРОБУЖДЕНИЕ', '#aac4ff'); }
      const next = [];
      u.effects.forEach(e => {
        e.t--;
        if (e.id === 'eph2' && e.t === 0) next.push({ id: 'ephCrash', t: 1 });
        if (e.id === 'dox' && e.t === 0) next.push({ id: 'convulsion', t: 1 });
        if (e.id === 'exhaustNext' && e.t === 0) next.push({ id: 'exhausted', t: 1 });
        if (e.id === 'cocktail' && e.t === 0) u.overdose = true;
        if (e.t > 0) next.push(e);
      });
      u.effects = next.concat([]).filter((e, k, a) => a.findIndex(x => x.id === e.id) === k);
      if (G.hasFx(u, 'exhausted')) { u.done = true; u.moved = true; u.attacked = true; }
      if (G.T(u).warmup && u.warm < 1) u.warm += 1;
    });
  };

  async function startPlayerTurn() {
    S.phase = 'player';
    S.scans = [];
    S.units.forEach(u => { u.hits = 0; });
    G.processEffects('player');
    // передозировки
    for (const u of S.units.filter(x => x.overdose && !x.dead)) {
      u.overdose = false;
      G.toast(G.displayName(u) + ': остановка сердца. Передозировка.', 'bad');
      K.audio && K.audio.sfx('flatline');
      await G.kill(u, null, 'overdose');
      if (S.over) return;
    }
    // снабжение, лечение
    S.units.forEach(u => {
      if (u.dead || u.evac || u.fac !== 'player') return;
      const st = G.structAt(u.c, u.r);
      if (st && st.owner === 'player' && D.STRUCT[st.type].supply) {
        u.hp = Math.min(u.maxhp, u.hp + 2);
        if (!G.isInfinite(u)) u.ammo = Math.min(G.T(u).ammo, u.ammo + Math.ceil(G.T(u).ammo / 2));
      }
      if (u.hero && G.perk('ash') && u.hp < u.maxhp) u.hp++;
    });
    S.units.forEach(md => {
      if (md.dead || md.evac || md.fac !== 'player' || !G.T(md).supply) return;
      Hx.neighbors(md.c, md.r).forEach(p => {
        const o = G.unitAt(p[0], p[1]);
        if (o && o.fac === 'player' && !G.T(o).civ) { o.hp = Math.min(o.maxhp, o.hp + 2); if (!G.isInfinite(o)) o.ammo = Math.min(G.T(o).ammo, o.ammo + 1); }
        const k = idx(p[0], p[1]);
        if (S.corpses[k] && G.T(md).collect) { delete S.corpses[k]; if (S.norm.used > 0) S.norm.used--; G.toast('Санитары забрали тело: норма −1', 'good'); }
      });
    });
    // регенерация
    if (S.regenQueue.length && !S.flags.noRegen) {
      const drop = S.structs.find(s => s.type === 'drop' && s.owner === 'player') || S.structs.find(s => s.owner === 'player' && D.STRUCT[s.type].supply);
      const keep = [];
      for (const q of S.regenQueue) {
        q.turns--;
        if (q.turns > 0) { keep.push(q); continue; }
        if (!drop) { keep.push(q); G.toast('Точка высадки потеряна — капсулы некуда доставить', 'bad'); continue; }
        const spec = { t: q.t, f: 'player', at: [drop.c, drop.r], name: q.name, tag: q.tag, hero: q.hero, cycle: q.cycle, series: q.series, mods: q.mods };
        const u = G.addUnit(spec);
        if (!u) { keep.push(q); continue; }
        u.xp = q.xp; u.rank = G.rankOf(u.xp);
        if (u.hero) u.name = 'К-' + S.heroCycle;
        if (G.perk('robin')) u.effects.push({ id: 'choco', t: 1 });
        await G.hooks.animSpawn(u, S.env === 'surface' ? 'pod' : 'capsule');
        G.toast((u.hero ? u.name : G.displayName(u)) + ' активирован. Цикл ' + (u.hero ? S.heroCycle : u.cycle) + '. Следуйте указаниям персонала.', 'info');
      }
      S.regenQueue = keep;
    }
    G.computeVis();
    await G.checkTriggers('turn');
    G.emit('turn', S.turn);
    G.emit('changed');
  }

  G.endTurn = async function () {
    if (S.over || S.phase !== 'player' || G.busy) return;
    G.busy = true;
    S.lastMove = null;
    try {
      for (const fac of ['opz', 'snk', 'rogue', 'fauna', 'civ']) {
        if (S.over) break;
        if (!S.units.some(u => u.fac === fac && !u.dead)) continue;
        S.phase = fac;
        G.emit('phase', fac);
        G.processEffects(fac);
        S.units.forEach(u => { if (u.fac === fac) u.hits = 0; });
        // снабжение противника
        S.units.forEach(u => {
          if (u.dead || u.fac !== fac) return;
          const st = G.structAt(u.c, u.r);
          if (st && st.owner === fac && D.STRUCT[st.type].supply) { u.hp = Math.min(u.maxhp, u.hp + 2); if (!G.isInfinite(u)) u.ammo = G.T(u).ammo; }
        });
        await K.ai.runFaction(fac);
      }
      if (S.over) return;
      // конец хода: проверки удержания и выживания
      S.m.objectives.forEach((o, i) => {
        if ((o.type === 'hold' || o.type === 'survive') && o.until === S.turn) {
          const st = G.objStatus(o, i);
          if (st === 'pending') S.objDone[i] = true;
          else if (st === 'danger' || st === 'fail') S.objFail[i] = true;
        }
      });
      G.checkEnd();
      if (S.over) return;
      if (G.primaryDone()) { G.win(); return; }
      S.turn++;
      if (S.turn > S.m.turns) {
        G.lose(S.m.o2 ? 'Кислород исчерпан. Баллоны пусты.' : 'Время операции истекло.');
        return;
      }
      await startPlayerTurn();
      G.checkEnd();
    } finally {
      G.busy = false;
      if (S && !S.over) S.phase = 'player';
      G.emit('changed');
    }
  };

  G.begin = async function () {
    S.turn = 1;
    S.phase = 'player';
    G.processEffects('player');
    G.computeVis();
    await G.checkTriggers('turn');
    G.emit('turn', S.turn);
    G.emit('changed');
  };

  /* ---------- Триггеры ---------- */
  G.checkTriggers = async function (kind, obj) {
    const tr = S.m.triggers || [];
    for (let i = 0; i < tr.length; i++) {
      if (S.fired.indexOf(i) >= 0 || S.over) continue;
      const t = tr[i];
      let ok = false;
      if (t.turn != null && kind === 'turn' && S.turn >= t.turn) ok = true;
      else if (t.on === 'death' && kind === 'death' && obj && obj.tag === t.tag) ok = true;
      else if (t.on === 'capture' && kind === 'capture' && obj && obj.tag === t.tag && obj.owner === 'player') ok = true;
      else if (t.on === 'evac' && kind === 'evac') ok = true;
      else if (t.on === 'aggro' && kind === 'aggro' && obj && obj.type === t.tag) ok = true;
      if (!ok) continue;
      if (t.on !== 'evac') S.fired.push(i);
      await t.run(G);
    }
  };

  /* ---------- Подкрепления ---------- */
  G.spawn = function (specs, opts) {
    opts = opts || {};
    const out = [];
    specs.forEach(sp => {
      const u = G.addUnit(sp);
      if (!u) return;
      S.occ[idx(u.c, u.r)] = u;
      if (opts.from === 'shaft' || opts.from === 'walk') u.hidden = u.hidden && opts.from !== 'shaft';
      out.push(u);
      G.hooks.animSpawn(u, opts.from || 'walk');
    });
    G.computeVis();
    G.emit('changed');
    return out;
  };

  /* ---------- Сохранение ---------- */
  G.serialize = function () {
    const o = {};
    ['mi', 'turn', 'terrain', 'units', 'nextId', 'norm', 'regen', 'regenQueue', 'corpses', 'stims', 'stats', 'fired', 'flags', 'tagSeen', 'aranesp', 'heroCycle', 'heroEvac', 'heroDead', 'perks', 'heroXP', 'objDone', 'objFail'].forEach(k => { o[k] = S[k]; });
    o.owners = S.structs.map(s => s.owner);
    return JSON.parse(JSON.stringify(o));
  };
  G.deserialize = function (o, campaign) {
    G.load(o.mi, campaign);
    Object.keys(o).forEach(k => { if (k !== 'owners') S[k] = o[k]; });
    o.owners.forEach((w, i) => { S.structs[i].owner = w; });
    S.phase = 'player'; S.over = null; S.lastMove = null; S.scans = [];
    rebuildOcc();
    G.computeVis();
    return S;
  };

  G.idleUnits = () => S.units.filter(u => u.fac === 'player' && !u.dead && !u.evac && !u.done && G.canAct(u) && (G.canMove(u) || G.canAttack(u)) && G.T(u).move !== 'static' && !G.T(u).civ);
})();
