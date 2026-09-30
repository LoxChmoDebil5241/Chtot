/* К-47 — искусственный интеллект противника, фауны и гражданских */
'use strict';
(function () {
  const U = K.util, Hx = K.hex, D = K.data, G = K.game;
  const AI = K.ai = {};
  let fields = {};

  function enemiesOf(u) {
    const S = G.state();
    return S.units.filter(o => !o.dead && !o.evac && G.hostile(u.fac, o.fac) && !(G.T(o).civ && o.fac === 'civ'));
  }

  function goalsFor(fac, move) {
    const S = G.state();
    const key = fac + ':' + move;
    if (fields[key]) return fields[key];
    const pts = [];
    S.units.forEach(o => { if (!o.dead && !o.evac && G.hostile(fac, o.fac) && o.fac !== 'civ') pts.push([o.c, o.r]); });
    const tags = (S.m.aiGoals && S.m.aiGoals[fac]) || [];
    S.structs.forEach(s => { if (tags.indexOf(s.tag) >= 0 && s.owner !== fac) { pts.push([s.c, s.r]); pts.push([s.c, s.r]); } });
    fields[key] = G.distField(move === 'static' ? 'foot' : move, pts);
    return fields[key];
  }

  function targetValue(u, e) {
    const S = G.state();
    const Te = G.T(e);
    let v = 1;
    if (e.hero) v *= 1.5;
    if (Te.noMoveFire) v *= 1.2;
    if (Te.supply) v *= 1.15;
    if (Te.civ && S.m.aiPrefer === 'civ') v *= 1.6;
    if (G.T(u).hunter) v *= 1 + (1 - e.hp / e.maxhp) * 1.5;
    if (Te.move === 'static') v *= 0.8;
    return v;
  }

  function counterEstimate(u, hex, e, dmgDone) {
    const Te = G.T(e);
    if (!Te.atk || e.sleep || G.hasFx(e, 'exhausted')) return 0;
    if (!G.isInfinite(e) && e.ammo <= 0) return 0;
    if (Te.warmup && e.warm < 1) return 0;
    const d = Hx.dist(hex[0], hex[1], e.c, e.r);
    const [mn, mx] = G.range(e);
    if (d < mn || d > mx) return 0;
    const hpLeft = e.hp - dmgDone;
    if (hpLeft <= 0) return 0;
    const saved = e.hp; e.hp = hpLeft;
    const oc = u.c, orr = u.r; u.c = hex[0]; u.r = hex[1];
    const v = G.calc(e, u, { expect: true, counter: true });
    u.c = oc; u.r = orr; e.hp = saved;
    return v;
  }

  function isAggressive(u) {
    const S = G.state();
    const T = G.T(u);
    if (u.ai === 'aggro' || u.ai === 'hunt' || u.alerted) return true;
    const en = enemiesOf(u);
    if (u.ai === 'guard') {
      const near = en.some(e => Hx.dist(e.c, e.r, u.c, u.r) <= 5);
      if (near) {
        u.alerted = true;
        S.units.forEach(o => { if (o.fac === u.fac && o.ai === 'guard' && Hx.dist(o.c, o.r, u.c, u.r) <= 3) o.alerted = true; });
      }
      return near;
    }
    if (u.ai === 'territorial') {
      const home = u.home;
      const intr = en.some(e => Hx.dist(e.c, e.r, home[0], home[1]) <= 4);
      if (intr) { u.alerted = true; S.units.forEach(o => { if (o.fac === 'fauna' && o.ai === 'territorial' && Hx.dist(o.home[0], o.home[1], home[0], home[1]) <= 2) o.alerted = true; }); }
      return intr;
    }
    void T;
    return false;
  }

  AI.runFaction = async function (fac) {
    const S = G.state();
    fields = {};
    const list = S.units.filter(u => u.fac === fac && !u.dead && !u.evac);
    const en0 = S.units.filter(o => !o.dead && !o.evac && G.hostile(fac, o.fac));
    const nearest = u => en0.reduce((m, e) => Math.min(m, Hx.dist(u.c, u.r, e.c, e.r)), 99);
    list.sort((a, b) => {
      const ra = G.T(a).noMoveFire || G.T(a).move === 'static' ? 0 : 1;
      const rb = G.T(b).noMoveFire || G.T(b).move === 'static' ? 0 : 1;
      return ra - rb || nearest(a) - nearest(b);
    });
    for (const u of list) {
      if (S.over) return;
      if (u.dead || u.evac || u.done || !G.canAct(u)) continue;
      try { await AI.act(u); } catch (e) { console.error('AI error', e); }
      u.done = true;
    }
  };

  AI.act = async function (u) {
    const S = G.state();
    const T = G.T(u);
    if (u.ai === 'civ') return civAct(u);
    const wasAlerted = u.alerted;
    const aggressive = isAggressive(u);
    if (T.territorial && aggressive && !wasAlerted) await G.checkTriggers('aggro', u);
    const enemies = enemiesOf(u);
    if (!enemies.length) return;
    const visible = G.seen(u);

    // 1. Лучшая атака с учётом перемещения
    const canMove = G.canMove(u) && (aggressive || u.ai === 'territorial') && u.ai !== 'hold';
    const reach = canMove ? G.reach(u) : { [G.idx(u.c, u.r)]: { cost: 0, prev: -1, end: true } };
    let best = null;
    const [mn, mx] = G.range(u);
    const here = G.idx(u.c, u.r);
    if (G.canAttack(u) || (canMove && T.atk && (G.isInfinite(u) || u.ammo > 0) && !T.noMoveFire)) {
      for (const k in reach) {
        const node = reach[k];
        const i = +k;
        if (!node.end && i !== here) continue;
        if (T.noMoveFire && i !== here) continue;
        const hc = i % S.W, hr = (i / S.W) | 0;
        if (T.territorial && Hx.dist(hc, hr, u.home[0], u.home[1]) > 5) continue;
        for (const e of enemies) {
          const d = Hx.dist(hc, hr, e.c, e.r);
          if (d < mn || d > mx) continue;
          if (G.atkVal(u, G.T(e).cls) <= 0) continue;
          const exp = G.calc(u, e, { expect: true });
          const val = targetValue(u, e);
          const cnt = counterEstimate(u, [hc, hr], e, exp);
          let score = exp * val + (exp >= e.hp ? 5 : 0) - cnt * 0.8 + G.defBonus(u, hc, hr) * 0.02 - node.cost * 0.01;
          if (e.hidden) score *= 0.5;
          if (!best || score > best.score) best = { score, i, e };
        }
      }
    }
    if (best && best.score > 0.25) {
      const bc = best.i % S.W, br = (best.i / S.W) | 0;
      if (best.i !== here) {
        await G.hooks.focus(u, bc, br);
        await G.move(u, bc, br, reach);
        if (u.dead || S.over) return;
      } else if (visible) await G.hooks.focus(u, u.c, u.r);
      if (!best.e.dead && G.canAttack(u)) {
        const d = Hx.dist(u.c, u.r, best.e.c, best.e.r);
        if (d >= mn && d <= mx) await G.attack(u, best.e);
      }
      return;
    }

    // 2. Движение к цели
    if (!canMove) return;
    // нет патронов — к снабжению
    let dist;
    if (!G.isInfinite(u) && u.ammo <= 0) {
      const sup = S.structs.filter(s => s.owner === u.fac && D.STRUCT[s.type].supply).map(s => [s.c, s.r]);
      if (sup.length) dist = G.distField(T.move, sup);
    }
    if (!dist) {
      if (T.territorial) {
        const intr = enemies.filter(e => Hx.dist(e.c, e.r, u.home[0], u.home[1]) <= 5).map(e => [e.c, e.r]);
        dist = G.distField(T.move, intr.length ? intr : [u.home]);
      } else if (T.hunter) {
        const prey = enemies.slice().sort((a, b) => (a.hp / a.maxhp) - (b.hp / b.maxhp) || Hx.dist(u.c, u.r, a.c, a.r) - Hx.dist(u.c, u.r, b.c, b.r));
        const pick = prey.filter(p => Hx.dist(u.c, u.r, p.c, p.r) <= 12);
        dist = G.distField(T.move, (pick.length ? pick.slice(0, 2) : prey.slice(0, 3)).map(e => [e.c, e.r]));
      } else dist = goalsFor(u.fac, T.move);
    }
    let bestN = null;
    const cur = dist[here];
    for (const k in reach) {
      const node = reach[k];
      const i = +k;
      if (!node.end || i === here) continue;
      const hc = i % S.W, hr = (i / S.W) | 0;
      if (T.territorial && Hx.dist(hc, hr, u.home[0], u.home[1]) > 5) continue;
      let sc = dist[i] - G.defBonus(u, hc, hr) * 0.04;
      // захват объектов
      const st = G.structAt(hc, hr);
      const goalTags = (S.m.aiGoals && S.m.aiGoals[u.fac]) || [];
      if (st && T.capture && st.owner !== u.fac && st.owner !== 'none' && (goalTags.indexOf(st.tag) >= 0 || st.owner === 'player')) sc -= 30;
      // стрелки держат дистанцию
      if (mx >= 3) {
        const near = enemies.reduce((m, e) => Math.min(m, Hx.dist(hc, hr, e.c, e.r)), 99);
        if (near <= 1) sc += 6;
      }
      if (!bestN || sc < bestN.sc) bestN = { sc, i };
    }
    if (bestN && bestN.sc < cur - 0.5) {
      const bc = bestN.i % S.W, br = (bestN.i / S.W) | 0;
      await G.hooks.focus(u, bc, br);
      await G.move(u, bc, br, reach);
      if (u.dead || S.over) return;
      // после движения — выстрел, если есть цель
      if (G.canAttack(u)) {
        const tg = G.targets(u).filter(t => t.unit && t.unit.fac !== 'civ');
        if (tg.length) {
          tg.sort((a, b) => G.calc(u, b.unit, { expect: true }) * targetValue(u, b.unit) - G.calc(u, a.unit, { expect: true }) * targetValue(u, a.unit));
          await G.attack(u, tg[0].unit);
        }
      }
    }
  };

  async function civAct(u) {
    const S = G.state();
    const threats = S.units.filter(o => !o.dead && !o.evac && o.fac === 'player');
    const near = threats.filter(o => Hx.dist(o.c, o.r, u.c, u.r) <= 3);
    if (!near.length || !G.canMove(u)) return;
    const reach = G.reach(u);
    let best = null;
    for (const k in reach) {
      const node = reach[k];
      if (!node.end) continue;
      const i = +k, c = i % S.W, r = (i / S.W) | 0;
      const d = threats.reduce((m, o) => Math.min(m, Hx.dist(o.c, o.r, c, r)), 99);
      const sc = d + G.defBonus(u, c, r) * 0.02;
      if (!best || sc > best.sc) best = { sc, c, r };
    }
    if (best && (best.c !== u.c || best.r !== u.r)) await G.move(u, best.c, best.r, reach);
  }
})();
