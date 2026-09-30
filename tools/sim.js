// Headless-симуляция кампании: бот играет за игрока. node tools/sim.js [runs] [missionNo]
const load = require('./load.js');
const K = load(['js/core.js', 'js/data.js', 'js/missions.js', 'js/game.js', 'js/ai.js']);
const G = K.game, Hx = K.hex, D = K.data;
G.fast = true;
const runs = +process.argv[2] || 5;
const only = +process.argv[3] || 0;

function validate(mi) {
  const S = G.load(mi, { difficulty: 'normal', perks: [], heroXP: 0 });
  const m = S.m;
  const problems = [];
  if (S.units.length !== m.units.length) problems.push(`placed ${S.units.length}/${m.units.length} units`);
  m.units.forEach(sp => {
    const u = S.units.find(x => x.type === sp.t && x.fac === sp.f && x.c === sp.at[0] && x.r === sp.at[1]);
    if (!u) problems.push(`moved ${sp.t}@${sp.at}`);
  });
  m.objectives.forEach(o => {
    (o.tags || []).forEach(t => { if (!S.structs.find(s => s.tag === t)) problems.push('no struct ' + t); });
    if (o.exitTag && !S.structs.find(s => s.tag === o.exitTag)) problems.push('no exit ' + o.exitTag);
  });
  // достижимость целей пешком от героя
  const hero = S.units.find(u => u.hero);
  const f = G.distField('foot', [[hero.c, hero.r]]);
  S.structs.forEach(s => { if (f[G.idx(s.c, s.r)] > 1e8 && s.type !== 'shaft') problems.push(`struct ${s.tag} unreachable on foot`); });
  S.units.filter(u => u.fac !== 'player' && K.data.UNITS[u.type].move !== 'static' && K.data.UNITS[u.type].move !== 'air').forEach(u => {
    const ff = G.distField(K.data.UNITS[u.type].move, [[hero.c, hero.r]]);
    if (ff[G.idx(u.c, u.r)] > 1e8) problems.push(`${u.type}@${u.c},${u.r} cannot reach hero`);
  });
  return problems;
}

async function playerTurn() {
  const S = G.state();
  const m = S.m;
  const tags = [];
  m.objectives.forEach(o => { if (!o.secondary && o.tags) tags.push(...o.tags); if (o.exitTag) tags.push(o.exitTag); });
  m.aiGoals = Object.assign({}, m.aiGoals || {}, { player: tags });
  const list = S.units.filter(u => u.fac === 'player' && !u.dead && !u.evac);
  for (const u of list) {
    if (S.over) return;
    if (u.dead || u.evac || u.done || !G.canAct(u)) continue;
    const T = D.UNITS[u.type];
    const evacObj = m.objectives.find(o => (o.type === 'evac' && o.unitTag === u.tag) || (o.type === 'reach' && S.turn > 3));
    if (evacObj) {
      const ex = S.structs.find(s => s.tag === evacObj.exitTag);
      const dist = G.distField(T.move, [[ex.c, ex.r]]);
      const reach = G.reach(u);
      let best = null;
      for (const k in reach) { if (!reach[k].end) continue; if (!best || dist[k] < dist[best]) best = +k; }
      if (best != null && best !== G.idx(u.c, u.r)) await G.move(u, best % S.W, (best / S.W) | 0, reach);
      continue;
    }
    if (T.civ) continue;
    // иногда стимуляторы
    if (u.hp <= 4 && G.canStim(u, 'impedrizine') && Math.random() < 0.5) { await G.useStim(u, 'impedrizine'); continue; }
    if (G.canStim(u, 'dox') && Math.random() < 0.15) await G.useStim(u, 'dox');
    // бур: сверлить стены на пути
    if (T.bore) { const bt = G.boreTargets(u); if (bt.length && Math.random() < 0.3) { await G.bore(u, bt[0][0], bt[0][1]); continue; } }
    // газ рядом с врагами
    const tg = G.targets(u).filter(t => t.gas && K.hex.neighbors(t.gas[0], t.gas[1]).some(p => { const o = G.unitAt(p[0], p[1]); return o && o.fac !== 'player'; }));
    if (tg.length) { await G.attack(u, tg[0]); continue; }
    u.ai = 'aggro';
    await K.ai.act(u);
    u.ai = null;
    if (!u.dead && !u.attacked && G.resupplyInfo(u) && (!G.isInfinite(u) && u.ammo <= 1)) G.resupply(u);
    if (u.hero && u.scanLeft && S.env === 'under' && S.turn % 3 === 1) G.scan(u);
  }
}

async function runMission(mi) {
  const S = G.load(mi, { difficulty: 'normal', perks: ['ash', 'ivan', 'elena', 'robin', 'arina'].slice(0, Math.max(0, mi - 2)), heroXP: mi * 3 });
  await G.begin();
  let guard = 0;
  while (!S.over && guard++ < 60) {
    await playerTurn();
    if (S.over) break;
    await G.endTurn();
  }
  return { win: S.over && S.over.win, reason: S.over ? S.over.reason : 'loop', turn: S.turn, norm: S.norm.used + '/' + S.norm.max, kills: S.stats.kills, eff: G.efficiency() };
}

(async () => {
  for (let mi = 0; mi < K.missions.length; mi++) {
    if (only && mi + 1 !== only) continue;
    const pr = validate(mi);
    const res = [];
    for (let r = 0; r < runs; r++) {
      try { res.push(await runMission(mi)); } catch (e) { console.log('EXC', mi + 1, e.stack); res.push({ win: false, reason: 'EXC' }); }
    }
    const wins = res.filter(x => x.win).length;
    console.log(`M${mi + 1} ${K.missions[mi].title}: wins ${wins}/${runs}` + (pr.length ? ' | PROBLEMS: ' + pr.join('; ') : ''));
    res.forEach(x => console.log('   ', x.win ? 'WIN ' : 'LOSE', 't' + x.turn, 'norm', x.norm, 'kills', x.kills, 'eff', x.eff, x.win ? '' : x.reason));
  }
})();
