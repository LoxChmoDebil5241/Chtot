/* К-47 — кампания: генератор карт и 10 операций */
'use strict';
(function () {
  const U = K.util, Hx = K.hex, Nz = K.noise;

  /* ---------- Построитель карт ---------- */
  class MapBuilder {
    constructor(W, H, env, seed) {
      this.W = W; this.H = H; this.env = env; this.seed = seed;
      this.rnd = U.rng(seed);
      this.t = new Array(W * H).fill(env === 'under' ? '#' : '.');
      this.structs = []; this.lamps = []; this.roads = []; this.pipes = [];
      this.ox = this.rnd() * 200; this.oy = this.rnd() * 200;
    }
    inb(c, r) { return c >= 0 && r >= 0 && c < this.W && r < this.H; }
    get(c, r) { return this.inb(c, r) ? this.t[r * this.W + c] : null; }
    set(c, r, v) { if (this.inb(c, r)) this.t[r * this.W + c] = v; }
    fill(v) { this.t.fill(v); }
    disk(c, r, rad, v) { Hx.disk(c, r, rad).forEach(p => this.set(p[0], p[1], v)); }
    blob(c, r, rad, v, rough) {
      rough = rough === undefined ? 0.35 : rough;
      const k = this.rnd() * 50;
      Hx.disk(c, r, rad + 1).forEach(p => {
        const d = Hx.dist(c, r, p[0], p[1]);
        const n = Nz.fbm(p[0] * 0.7 + k, p[1] * 0.7 + k, 3);
        if (d <= rad * (1 - rough) + rough * rad * 2 * n) this.set(p[0], p[1], v);
      });
    }
    line(a, b, v, w) {
      Hx.line(a[0], a[1], b[0], b[1]).forEach(p => {
        if (w) this.disk(p[0], p[1], w, v); else this.set(p[0], p[1], v);
      });
    }
    path(pts, v, w) {
      for (let i = 0; i < pts.length - 1; i++) this.line(pts[i], pts[i + 1], v, w || 0);
      if (v === '=') this.roads.push({ pts: pts.map(p => p.slice()), w: w || 0 });
      if (v === 't') this.pipes.push(pts.map(p => p.slice()));
    }
    // извилистая трещина
    crack(pts, v) {
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const mid = [Math.round((a[0] + b[0]) / 2 + (this.rnd() - 0.5) * 2), Math.round((a[1] + b[1]) / 2 + (this.rnd() - 0.5) * 2)];
        out.push(mid, b);
      }
      this.path(out, v || '~', 0);
    }
    noise(v, scale, thr, pred) {
      const k = this.rnd() * 300;
      for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) {
        const p = Hx.center(c, r);
        const n = Nz.fbm(p[0] / 100 * scale + k, p[1] / 100 * scale + k * 0.7, 4);
        if (n > thr && (!pred || pred(this.get(c, r), c, r))) this.set(c, r, v);
      }
    }
    struct(c, r, type, owner, name, tag) {
      const cur = this.get(c, r);
      if (this.env === 'under') { if (cur === '#' || cur === 'w' || cur === 'v' || cur === 't' || cur === 'g') this.set(c, r, '.'); }
      else if (cur !== '=') this.set(c, r, '.');
      this.structs.push({ c, r, type, owner, name, tag });
    }
    lamp(c, r) { this.lamps.push([c, r]); }
    lampsAlong(pts, step) {
      let i = 0;
      for (let s = 0; s < pts.length - 1; s++) {
        Hx.line(pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1]).forEach(p => { if (i++ % step === 0) this.lamp(p[0], p[1]); });
      }
    }
  }
  K.MapBuilder = MapBuilder;

  /* ---------- Юниты: краткая запись ---------- */
  const P = (t, c, r, o) => Object.assign({ t, f: 'player', at: [c, r] }, o || {});
  const E = (f, t, c, r, o) => Object.assign({ t, f, at: [c, r], ai: 'aggro' }, o || {});

  /* ---------- Кампания ---------- */
  const M = K.missions = [];

  // ===== 1. ВТОРЖЕНИЕ =====
  M.push({
    id: 1, title: 'Вторжение', chapter: 'Глава 2', location: 'Объект «Горн-12», поверхность', date: '3002 год',
    cycle: { label: 'Кристиан Комаров', num: 0, human: true }, env: 'surface', weather: 'storm', W: 24, H: 16, seed: 1101,
    turns: 15, turnLabel: 'БУРЯ', norm: 0, labels: { opz: 'Gorlex Securities SLL' },
    stims: { ephedrine: 1, hyperzine: 1 },
    build(B) {
      B.fill('.');
      B.noise(',', 0.9, 0.56);
      B.noise('^', 1.1, 0.67);
      B.noise('A', 1.4, 0.77, (t, c, r) => c > 19 || r < 2);
      B.crack([[7, 0], [8, 3], [11, 4], [12, 1]], '~');
      B.crack([[0, 13], [3, 12], [6, 15]], '~');
      B.path([[2, 8], [6, 8], [10, 9], [13, 6], [18, 4]], '=');
      B.path([[10, 9], [14, 11], [19, 10]], '=');
      B.path([[13, 6], [14, 11]], '=');
      B.disk(3, 8, 1, '.');
      B.struct(2, 8, 'hangar', 'player', 'Бункерный отсек', 'start');
      B.struct(10, 9, 'depot', 'opz', 'Склад колонии', 'depot');
      B.struct(13, 6, 'colony', 'opz', 'Жилые модули А', 'colA');
      B.struct(14, 11, 'colony', 'opz', 'Жилые модули Б', 'colB');
      B.struct(18, 4, 'radar', 'opz', 'Диспетчерская', 'radar');
      B.struct(19, 10, 'hangar', 'opz', 'Грузовой ангар «Гамма»', 'cargo');
    },
    units: [
      P('hero', 3, 9, { name: 'Кристиан', hero: true, human: true, mods: { range: [1, 3], armor: 4 } }),
      P('vector', 2, 8, { name: 'Маркус', human: true, tag: 'marcus', rank: 3 }),
      P('mg', 3, 8, { name: 'Марвин', human: true, rank: 2, mods: { soft: 8 } }),
      P('mg', 3, 7, { name: 'Альберт', human: true, rank: 1 }),
      P('aktiv', 2, 9, { name: 'Динар', human: true }),
      E('opz', 'guard', 7, 8, { ai: 'guard' }), E('opz', 'guard', 10, 9, { ai: 'guard' }), E('opz', 'guard', 11, 7, { ai: 'guard' }),
      E('opz', 'guard', 13, 6, { ai: 'guard' }), E('opz', 'guard', 14, 8, { ai: 'guard' }), E('opz', 'guard', 14, 11, { ai: 'guard' }),
      E('opz', 'guard', 17, 5, { ai: 'guard' }), E('opz', 'guard', 18, 4, { ai: 'hold' }), E('opz', 'guard', 19, 10, { ai: 'hold' }),
      E('opz', 'guard', 20, 9, { ai: 'guard' }),
      E('opz', 'turret', 19, 5, { ai: 'hold', name: 'Травматическая турель', mods: { soft: 3, hard: 1 } }),
      E('opz', 'turret', 18, 10, { ai: 'hold', name: 'Травматическая турель', mods: { soft: 3, hard: 1 } })
    ],
    objectives: [
      { type: 'capture', tags: ['radar'], text: 'Захватите диспетчерскую' },
      { type: 'capture', tags: ['cargo'], text: 'Захватите грузовой ангар с грузом «Гамма»' },
      { type: 'noLoss', secondary: true, text: 'Без потерь в отряде' }
    ],
    briefing: [
      'Ол-12-П. Челнок-невидимка сквозь ледяную крупу идёт на посадку.',
      '— Цель — горнодобывающая колония ОПЗ, объект «Горн-12». Добыча — груз категории «Гамма». ОПЗ заключило контракт с подрядчиком «Gorlex Securities SLL». Наши сведения гласят, что охрана вооружена лишь нелетальным снаряжением.',
      '— Легенда — аварийная посадка. Подаём сигнал SOS, они любезно откроют нам бункерный отсек. Как только пройдём досмотр — начинаем очистку. Снаружи бушует буря — она заглушит всё.',
      '— Груз не вскрывать. Приказ категоричный. Это будет проще, чем задуть свечу.',
      'Пятеро. Маркус, Марвин, Альберт, Динар. И Кристиан — белое пятно шлема, пустой визор, ни слова, кроме собственного имени.'
    ],
    hints: true,
    triggers: [
      { turn: 1, run: async G => {
        await G.say('Диспетчер «Горна-12»', '«Невидимый», вас не видно на радаре… Сигнал бедствия… да кому нужны наши разработки в этой ледяной дыре? Открываю ворота.');
        await G.say('Маркус', 'Короткий кивок — и начинаем. Восемь штук за голову. Потом дожму.');
      } },
      { turn: 7, run: async G => { await G.say('Альберт', 'Буря слабеет. Глушилка долго не протянет — если диспетчерская пошлёт депешу, нас накроют.'); } }
    ],
    win: 'm1end'
  });

  // ===== 2. ГЛУБИНА =====
  M.push({
    id: 2, title: 'Глубина', chapter: 'Глава 17', location: 'Логистический штрек под «Горном-12»', date: 'Цикл 6',
    cycle: { label: 'К-6', num: 6 }, env: 'under', W: 26, H: 14, seed: 2202,
    turns: 16, turnLabel: 'КИСЛОРОД', o2: true, norm: 11,
    stims: { ephedrine: 1, dox: 1, hyperzine: 1 },
    build(B) {
      B.fill('#');
      B.disk(2, 7, 2, '.');
      B.path([[1, 7], [25, 7]], '=', 1);
      B.path([[5, 6], [6, 2], [19, 2], [21, 5]], 't', 0);
      B.path([[6, 8], [7, 12], [19, 12], [21, 9]], 't', 0);
      B.blob(12, 6, 1, 'k', 0.2); B.set(12, 6, 'v'); B.set(13, 6, 'v'); B.set(12, 5, 'v');
      ['r', 'r', 'r', 'r'].forEach((v, i) => B.set(8 + i * 3, 8, v));
      [[9, 6], [15, 6], [17, 8], [11, 8]].forEach(p => B.set(p[0], p[1], 'r'));
      B.disk(21, 7, 2, '.');
      [[19, 5], [19, 6], [19, 8], [19, 9], [20, 5], [20, 9]].forEach(p => B.set(p[0], p[1], 'b'));
      B.path([[21, 7], [25, 7]], '=', 1);
      B.struct(2, 7, 'drop', 'player', 'Буровая скважина', 'drop');
      B.struct(21, 6, 'bunker', 'rogue', 'Блокпост — северное гнездо', 'bp1');
      B.struct(21, 8, 'bunker', 'rogue', 'Блокпост — южное гнездо', 'bp2');
      B.lampsAlong([[1, 7], [25, 7]], 4);
      B.lamp(8, 2); B.lamp(16, 2); B.lamp(10, 12); B.lamp(17, 12);
    },
    units: [
      P('hero', 3, 7, { hero: true }),
      P('vector', 3, 6, { name: 'Командир', human: true, tag: 'cmd', rank: 3 }),
      P('aktiv', 2, 6, { name: 'Сорока' }),
      P('shotgun', 4, 7, { name: 'Коротыш' }),
      P('shotgun', 3, 8, { name: 'Молчун', human: true }),
      P('aktiv', 2, 8), P('aktiv', 4, 8), P('mg', 1, 7),
      E('rogue', 'raider', 9, 6, { ai: 'guard' }), E('rogue', 'raider', 10, 8, { ai: 'guard' }),
      E('rogue', 'raider', 14, 7, { ai: 'guard' }), E('rogue', 'rshotgun', 15, 6, { ai: 'guard' }),
      E('rogue', 'raider', 16, 8, { ai: 'guard' }), E('rogue', 'raider', 18, 7, { ai: 'guard' }),
      E('rogue', 'rshotgun', 13, 12, { ai: 'guard' }),
      E('rogue', 'raider', 21, 6, { ai: 'hold' }), E('rogue', 'rshotgun', 21, 8, { ai: 'hold' }),
      E('rogue', 'turret', 22, 6, { ai: 'hold', name: 'Пулемётное гнездо' }), E('rogue', 'turret', 22, 8, { ai: 'hold', name: 'Пулемётное гнездо' })
    ],
    objectives: [
      { type: 'capture', tags: ['bp1', 'bp2'], text: 'Возьмите оба гнезда блокпоста' },
      { type: 'keepUnit', unitTag: 'cmd', secondary: true, text: 'Командир должен выжить' }
    ],
    briefing: [
      'Цикл 6. Платформа буровой установки содрогается от вибрации. В пятидесяти метрах внизу термальный бур вгрызается в лёд, пробивая последние метры к старому логистическому штреку противника.',
      'Пятнадцать теней в тусклом свете аварийных ламп. К-6 знает, что не все вернутся. Он знает это из предыдущих циклов. И всё равно запоминает их — чтобы не забыть, когда их не станет.',
      '— Трое — с флангов, через технические штреки. Остальные — со мной. В лоб. Отвлекаем огонь.',
      'Гранаты и взрывчатка запрещены — риск обвала. Кислорода — на шестнадцать ходов.'
    ],
    triggers: [
      { turn: 1, run: async G => { await G.say('Командир', 'Пройдено! Первая волна — бегом! Быстро! Не останавливаться!'); } },
      { turn: 5, run: async G => {
        G.spawn([E('rogue', 'pantsir', 24, 7, { name: 'Рейдер в «Панцире»', ai: 'aggro', tag: 'pantsir', rank: 2 })], { from: 'walk' });
        await G.say('К-6', 'Шаги. Тяжёлые, металлические. Не один человек. Что-то массивное давит на лёд.');
        await G.say('Лекция', '«Панцирь держит очередь в упор. Не пытайтесь пробить — пытайтесь перегрузить». Бейте одну цель несколькими юнитами за ход: каждая следующая атака сильнее.');
      } },
      { on: 'death', tag: 'cmd', run: async G => {
        await G.say('Командир', 'Я… не дойду. Ты… ты теперь командир. Веди их. Не дай им умереть зря. Скажи им, что мы… сражались.');
      } }
    ],
    interlude: 'booklet'
  });

  // ===== 3. ЩИТ =====
  M.push({
    id: 3, title: 'Щит', chapter: 'Глава 12', location: 'Исследовательский модуль «Кернер»', date: 'Цикл 21',
    cycle: { label: 'К-21', num: 21 }, env: 'under', W: 24, H: 16, seed: 3303,
    turns: 13, turnLabel: 'ДО ОТЛЁТА', norm: 9,
    stims: { ephedrine: 1, hyperzine: 1, impedrizine: 1 },
    build(B) {
      B.fill('#');
      B.disk(3, 8, 3, '.');
      B.path([[5, 8], [21, 8]], '.', 1);
      B.disk(22, 8, 1, '.');
      B.path([[9, 7], [9, 1]], '.', 0); B.disk(9, 1, 1, '.');
      B.path([[16, 7], [16, 1]], '.', 0); B.disk(16, 1, 1, '.');
      B.path([[12, 9], [12, 14]], '.', 0); B.disk(12, 14, 1, '.');
      B.path([[18, 9], [18, 14]], '.', 0); B.disk(18, 14, 1, '.');
      B.disk(13, 4, 1, '.'); B.path([[13, 5], [13, 7]], 't', 0);
      [[7, 7], [19, 9]].forEach(p => B.set(p[0], p[1], 'b'));
      [[11, 9], [14, 7], [20, 7], [15, 9], [8, 9]].forEach(p => B.set(p[0], p[1], 'r'));
      B.struct(2, 8, 'lab', 'player', 'Лаборатория', 'lab');
      B.struct(3, 11, 'drop', 'player', 'Грузовой лифт', 'drop');
      B.struct(22, 8, 'gate', 'player', 'Гермоворота челнока', 'gate');
      B.lampsAlong([[5, 8], [21, 8]], 3);
      [[9, 2], [16, 2], [12, 13], [18, 13], [13, 4]].forEach(p => B.lamp(p[0], p[1]));
    },
    units: [
      P('hero', 6, 8, { hero: true }),
      P('aktiv', 8, 8), P('aktiv', 10, 8), P('aktiv', 5, 7), P('mg', 7, 9), P('shotgun', 9, 8),
      P('civ', 2, 7, { tag: 'sci', name: 'Учёная' }), P('civ', 3, 7, { tag: 'sci', name: 'Техник' }), P('civ', 2, 9, { tag: 'sci', name: 'Геолог' }),
      P('civ', 4, 8, { tag: 'sci', name: 'Инженер' }), P('civ', 1, 8, { tag: 'sci', name: 'Лаборант' }), P('civ', 3, 9, { tag: 'sci', name: 'Химик' }),
      E('snk', 'raider', 17, 8, { ai: 'guard' }), E('snk', 'rshotgun', 19, 7, { ai: 'guard' })
    ],
    objectives: [
      { type: 'evac', unitTag: 'sci', count: 4, exitTag: 'gate', text: 'Эвакуируйте через гермоворота не менее 4 сотрудников' }
    ],
    briefing: [
      'Цикл 21. Узкий коридор. Двадцать учёных и техников прижаты к гермоворотам, отрезаны от эвакуационного челнока шквальным огнём рейдеров СНК.',
      'К-21 — единственный, кто стоит между ними и смертью.',
      'Рейдеры пойдут волнами — из северных и южных штреков. Сотрудники безоружны: ведите их к гермоворотам на востоке. Каждый, кто дошёл, — эвакуирован.',
      'Щит не чувствует боли. Щит не имеет лица. Щит просто держит, пока за ним есть кому стоять.'
    ],
    aiPrefer: 'civ',
    triggers: [
      { turn: 1, run: async G => {
        await G.say('Учёная', 'Кто… кто вы? Челнок за воротами! Мы не дойдём, они простреливают весь коридор!');
      } },
      { turn: 2, run: async G => { G.spawn([E('snk', 'raider', 9, 1), E('snk', 'raider', 8, 1), E('snk', 'rshotgun', 10, 1)], { from: 'walk' }); G.toast('Движение в северном штреке'); } },
      { turn: 4, run: async G => { G.spawn([E('snk', 'raider', 12, 14), E('snk', 'raider', 11, 14)], { from: 'walk' }); G.toast('Движение в южном штреке'); } },
      { turn: 6, run: async G => { G.spawn([E('snk', 'raider', 16, 1), E('snk', 'plasma', 17, 1)], { from: 'walk' }); G.toast('Северный штрек: тяжёлый рейдер с плазмой'); } },
      { turn: 8, run: async G => { G.spawn([E('snk', 'raider', 18, 14), E('snk', 'raider', 17, 14), E('snk', 'rshotgun', 19, 14)], { from: 'walk' }); G.toast('Южный штрек: новая волна'); } },
      { turn: 10, run: async G => { G.spawn([E('snk', 'raider', 9, 1), E('snk', 'raider', 10, 1)], { from: 'walk' }); } },
      { on: 'evac', run: async G => { if (G.state().stats.evacuated === 1) await G.say('Учёная', 'Прости… — беззвучно, одними губами, сквозь толстое стекло гермоворот.'); } }
    ],
    interlude: 'cook', perk: 'ash'
  });

  // ===== 4. АЙСБЕРГ-3 =====
  M.push({
    id: 4, title: 'Айсберг-3', chapter: 'Глава 18', location: 'Логистическая база «Айсберг-3»', date: 'Цикл 27',
    cycle: { label: 'К-27', num: 27 }, env: 'surface', weather: 'snow', W: 28, H: 18, seed: 4404,
    turns: 14, turnLabel: 'ХОД', norm: 14,
    stims: { ephedrine: 1, dox: 1, hyperzine: 1, aranesp: 1 },
    build(B) {
      B.fill('.');
      B.noise(',', 0.8, 0.55);
      B.noise('^', 1.0, 0.665);
      B.noise('A', 1.3, 0.78, (t, c, r) => c > 13);
      B.crack([[17, 0], [16, 4], [18, 8], [16, 12], [17, 17]], '~');
      B.path([[4, 9], [8, 9], [12, 6], [17, 5], [22, 5], [27, 6]], '=');
      B.path([[8, 9], [6, 14]], '='); B.path([[8, 9], [5, 4]], '=');
      B.path([[8, 9], [10, 12], [13, 13], [17, 13], [23, 12], [27, 12]], '=');
      B.path([[22, 5], [24, 9], [23, 12]], '=');
      B.struct(8, 9, 'colony', 'player', 'Штаб «Айсберг-3»', 'hq');
      B.struct(5, 4, 'depot', 'player', 'Склад биомассы', 'd1');
      B.struct(6, 14, 'depot', 'player', 'Склад боеприпасов', 'd2');
      B.struct(12, 6, 'depot', 'player', 'Грузовой терминал', 'd3');
      B.struct(4, 9, 'drop', 'player', 'Точка высадки', 'drop');
      B.struct(10, 12, 'hangar', 'player', 'Ангар', 'hangar');
      B.struct(24, 9, 'depot', 'snk', 'Полевой лагерь СНК', 'camp');
    },
    units: [
      P('hero', 9, 9, { hero: true }),
      P('vector', 15, 5), P('vector', 15, 13), P('aktiv', 11, 7), P('aktiv', 11, 11), P('mg', 13, 9),
      P('sniper', 12, 8), P('turret', 14, 8, { name: 'Автотурель базы' }), P('shuttle', 10, 12), P('medevac', 7, 10),
      E('snk', 'raider', 22, 6), E('snk', 'raider', 23, 11), E('snk', 'raider', 24, 8), E('snk', 'raider', 21, 9),
      E('snk', 'plasma', 25, 9), E('snk', 'drill', 25, 11, { name: 'Бронебур СНК' })
    ],
    objectives: [
      { type: 'hold', tags: ['hq'], critical: true, until: 14, text: 'Удержите штаб «Айсберг-3» до конца 14-го хода' },
      { type: 'hold', tags: ['d1', 'd2', 'd3'], min: 2, until: 14, text: 'Сохраните не менее 2 складов из 3' },
      { type: 'capture', tags: ['camp'], secondary: true, text: 'Захватите полевой лагерь СНК' }
    ],
    aiGoals: { snk: ['hq', 'd1', 'd2', 'd3', 'drop'] },
    briefing: [
      'Цикл 26 прошёл в комнате погрузки. Шесть часов ожидания. Он считал — двадцать тысяч ударов сердца. Задание отменено. Разоружайся. Следуй за мной.',
      'Цикл 27 начался с сирены.',
      '«Айсберг-3» — логистическая база. Здесь принимают грузы, хранят боеприпасы, ведут учёт и списание биомассы — тел клонов и фауны.',
      'СНК перешёл трещину: пехота, плазменные штурмовики, бронебур, челноки. Трещину можно пересечь только по двум мостам — если не умеешь летать.',
      'Задача: удержать штаб и хотя бы два склада до конца 14-го хода.'
    ],
    triggers: [
      { turn: 1, run: async G => { await G.say('«Ледяной коготь»', 'Активы, занять оборону. Мосты — ключ. Плазме нужен прогрев — у вас есть один ход, пока их стволы холодные.'); } },
      { turn: 3, run: async G => { G.spawn([E('snk', 'shuttle', 27, 4), E('snk', 'shuttle', 27, 14)], { from: 'air' }); await G.say('Радар', 'Две воздушные цели с востока. Челноки СНК идут над трещиной.'); } },
      { turn: 5, run: async G => { G.spawn([E('snk', 'raider', 27, 7), E('snk', 'raider', 27, 11), E('snk', 'rshotgun', 27, 9)], { from: 'walk' }); } },
      { turn: 8, run: async G => { G.spawn([E('snk', 'plasma', 27, 6), E('snk', 'raider', 27, 8), E('snk', 'raider', 27, 10)], { from: 'walk' }); G.toast('СНК вводит резерв'); } },
      { turn: 11, run: async G => { G.spawn([E('snk', 'raider', 27, 5), E('snk', 'rshotgun', 27, 9)], { from: 'walk' }); } }
    ],
    interlude: 'medic', perk: 'ivan'
  });

  // ===== 5. БРАК =====
  M.push({
    id: 5, title: 'Брак', chapter: 'Глава 23', location: 'Поверхность, сектор «Мрахна»', date: 'Цикл 37',
    cycle: { label: 'К-37', num: 37, whiteEyes: true }, env: 'surface', weather: 'snow', W: 28, H: 18, seed: 5505,
    turns: 16, turnLabel: 'ХОД', norm: 11,
    stims: { ephedrine: 2, dox: 1, hyperzine: 1, nocturine: 1 },
    build(B) {
      B.fill('.');
      B.noise(',', 0.8, 0.52);
      B.noise('^', 1.0, 0.665);
      B.noise('A', 1.2, 0.785);
      B.noise('o', 1.7, 0.66, (t, c, r) => Hx.dist(c, r, 13, 9) < 5 && Hx.dist(c, r, 13, 9) > 1);
      B.crack([[5, 0], [7, 4], [6, 7]], '~');
      B.crack([[20, 17], [22, 14], [27, 14]], '~');
      B.path([[2, 15], [8, 12], [13, 9], [16, 6], [22, 3], [27, 2]], '=');
      B.path([[13, 9], [18, 11], [23, 12], [27, 11]], '=');
      B.path([[16, 6], [18, 6]], '=');
      B.struct(3, 14, 'drop', 'player', 'Точка высадки', 'drop');
      B.struct(13, 9, 'colony', 'opz', 'Пост «Мрахна»', 'post');
      B.struct(22, 3, 'radar', 'opz', 'Ретрансляционная станция', 'radar');
      B.struct(23, 12, 'rig', 'opz', 'Буровая вышка ОПЗ', 'rig');
      B.struct(18, 6, 'depot', 'opz', 'Склад аккумуляторов', 'depot');
    },
    units: [
      P('hero', 4, 14, { hero: true }),
      P('drill', 5, 14), P('vector', 4, 13), P('vector', 6, 14), P('aktiv', 3, 15), P('aktiv', 5, 13), P('sniper', 2, 14), P('mg', 3, 13),
      E('opz', 'laser', 12, 8, { ai: 'guard' }), E('opz', 'laser', 14, 10, { ai: 'guard' }), E('opz', 'laser', 17, 6, { ai: 'guard' }),
      E('opz', 'laser', 21, 4, { ai: 'guard' }), E('opz', 'laser', 22, 11, { ai: 'guard' }),
      E('opz', 'guard', 13, 9, { ai: 'hold' }), E('opz', 'guard', 9, 11, { ai: 'guard' }), E('opz', 'guard', 20, 3, { ai: 'guard' }),
      E('opz', 'turret', 14, 8, { ai: 'hold' }), E('opz', 'turret', 23, 4, { ai: 'hold' }),
      E('opz', 'pantsir', 22, 2, { ai: 'guard', name: 'Штурмовик ОПЗ' })
    ],
    objectives: [
      { type: 'capture', tags: ['radar'], text: 'Захватите ретрансляционную станцию к северо-востоку от поста «Мрахна»' },
      { type: 'capture', tags: ['rig'], secondary: true, text: 'Захватите буровую вышку ОПЗ' }
    ],
    briefing: [
      'Цикл 37. Капсула открылась. Гель стёк на пол. В отражении — тот же разрез глаз, те же скулы. Но глаза — белые. Молочные. Без зрачков, без радужки.',
      '— Утилизация. Приказ комиссии. Ты — брак.',
      '— Я хочу знать, кто я. Перед смертью.',
      '— …Решение пересмотрено. Ты остаёшься. Ты брак. Но ты эффективный брак. Этого достаточно.',
      '«Ледяной коготь» направляет эффективный брак на поверхность: захватить ретрансляционную станцию ОПЗ к северо-востоку от поста «Мрахна».',
      'Белые глаза видят дальше (+1 к обзору). Лазеры ОПЗ на морозе садятся — затяжной бой играет за вас. Газовые каверны у поста можно поджечь.'
    ],
    triggers: [
      { turn: 4, run: async G => { G.spawn([E('opz', 'shuttle', 22, 0, { name: 'Перехватчик ОПЗ' })], { from: 'air' }); await G.say('Радар', 'Перехватчик ОПЗ над ретранслятором.'); } },
      { turn: 9, run: async G => { G.spawn([E('opz', 'laser', 27, 3), E('opz', 'guard', 27, 4)], { from: 'walk' }); G.toast('Подкрепление ОПЗ с востока'); } }
    ],
    interlude: 'tech', perk: 'elena'
  });

  // ===== 6. ШИПЕНИЕ =====
  M.push({
    id: 6, title: 'Шипение', chapter: 'Глава 26', location: 'Карстовый узел «Сухой»', date: 'Цикл 38',
    cycle: { label: 'К-38', num: 38, whiteEyes: true }, env: 'under', W: 26, H: 16, seed: 6606,
    turns: 14, turnLabel: 'КИСЛОРОД', o2: true, norm: 9,
    stims: { ephedrine: 1, hyperzine: 1, impedrizine: 1, nocturine: 1 },
    build(B) {
      B.fill('#');
      B.disk(2, 8, 2, '.');
      B.path([[2, 8], [7, 8]], '.', 1);
      B.path([[7, 8], [9, 5], [14, 5]], '.', 0);
      B.path([[8, 8], [10, 6]], '.', 0);
      B.path([[14, 5], [16, 9]], '.', 1);
      B.path([[16, 9], [21, 9], [24, 8]], '.', 0);
      B.path([[17, 9], [21, 8]], '.', 0);
      B.blob(13, 10, 3, 'k', 0.3); B.disk(13, 10, 1, 'w'); B.set(12, 12, 'w');
      B.path([[7, 7], [8, 2], [18, 2], [21, 7]], 't', 0);
      B.path([[9, 9], [10, 13], [20, 13], [21, 10]], 't', 0);
      B.disk(24, 8, 1, '.');
      B.struct(1, 8, 'drop', 'player', 'Шлюз', 'drop');
      B.struct(24, 8, 'lift', 'player', 'Эвакуационный лифт', 'lift');
      [[4, 8], [9, 5], [13, 5], [16, 9], [20, 9], [24, 7]].forEach(p => B.lamp(p[0], p[1]));
    },
    units: [
      P('hero', 3, 8, { hero: true }),
      P('aktiv', 2, 7), P('aktiv', 2, 9), P('shotgun', 3, 9), P('shotgun', 4, 8), P('vector', 1, 7),
      E('fauna', 'filtrator', 12, 9, { ai: 'territorial', home: [13, 10] }), E('fauna', 'filtrator', 14, 11, { ai: 'territorial', home: [13, 10] }),
      E('fauna', 'filtrator', 12, 11, { ai: 'territorial', home: [13, 10] }), E('fauna', 'filtrator', 14, 9, { ai: 'territorial', home: [13, 10] }),
      E('fauna', 'nematode', 12, 2, { ai: 'hunt' }), E('fauna', 'nematode', 16, 2, { ai: 'hunt' }),
      E('fauna', 'nematode', 14, 13, { ai: 'hunt' }), E('fauna', 'nematode', 18, 13, { ai: 'hunt' })
    ],
    objectives: [
      { type: 'reach', count: 2, exitTag: 'lift', text: 'Доведите до эвакуационного лифта не менее 2 юнитов' },
      { type: 'heroReach', exitTag: 'lift', secondary: true, text: 'Среди эвакуированных — К-38' }
    ],
    briefing: [
      'Цикл 38. Разведгруппа идёт через карстовый узел к эвакуационному лифту.',
      'Геосканер показывает гнездо ракообразных-фильтраторов в затопленной полости у самого маршрута. Агрессивны при нарушении территории.',
      'Нематоды в технических штреках не видны сканеру, пока не станет поздно. «Реагируют на тепло и запах крови. Предпочитают ослабленных».',
      'Кислорода — на 14 ходов. Используйте геосканер героя: он подсвечивает затаившихся тварей.'
    ],
    triggers: [
      { on: 'aggro', tag: 'filtrator', run: async G => { await G.say('К-38', 'Твари вырвались из ледяных трещин! Гнездо!'); } },
      { turn: 4, run: async G => {
        G.spawn([E('rogue', 'raider', 21, 7), E('rogue', 'rshotgun', 21, 10), E('rogue', 'raider', 22, 9)], { from: 'walk' });
        await G.say('К-38', 'Они ждали. Они знали, что фауна выгонит отряд на открытое пространство.');
      } },
      { turn: 9, run: async G => { await G.say('Баллон', 'Ш-ш-ш… ш-ш-ш… Кислорода всё меньше.'); } }
    ],
    interlude: 'keeper', perk: 'robin'
  });

  // ===== 7. СЛЕПОТА =====
  M.push({
    id: 7, title: 'Слепота', chapter: 'Глава 37', location: 'Выработка «Глубокая-4»', date: 'Цикл 39',
    cycle: { label: 'К-39', num: 39, whiteEyes: true }, env: 'under', W: 26, H: 16, seed: 7707,
    turns: 16, turnLabel: 'КИСЛОРОД', o2: true, norm: 13,
    stims: { ephedrine: 1, dox: 2, hyperzine: 1, impedrizine: 1 },
    build(B) {
      B.fill('#');
      B.disk(2, 8, 2, '.');
      B.path([[3, 8], [9, 8]], '.', 1);
      B.blob(17, 8, 5, '.', 0.2);
      B.path([[9, 8], [12, 8]], '=', 1);
      B.path([[12, 8], [24, 8]], '=', 0);
      B.path([[4, 6], [5, 2], [9, 2]], '.', 0);
      B.path([[12, 2], [15, 3], [16, 4]], '.', 0);
      B.set(10, 2, '#'); B.set(11, 2, '#');
      B.path([[5, 10], [7, 13], [14, 13], [15, 12]], 't', 0);
      B.blob(19, 5, 1, 'g', 0.1); B.blob(20, 11, 1, 'g', 0.1); B.set(22, 10, 'g'); B.set(15, 7, 'g'); B.set(16, 10, 'g');
      [[13, 6], [14, 10], [18, 8], [21, 6], [12, 9]].forEach(p => B.set(p[0], p[1], 'r'));
      [[17, 6], [19, 9], [22, 7]].forEach(p => B.set(p[0], p[1], 'b'));
      B.struct(2, 8, 'drop', 'player', 'Точка высадки', 'drop');
      B.struct(21, 8, 'depot', 'rogue', 'Склад выработки', 'edepot');
      [[5, 8], [9, 8], [13, 8], [17, 8], [21, 8], [7, 2], [15, 3], [10, 13]].forEach(p => B.lamp(p[0], p[1]));
    },
    units: [
      P('hero', 3, 8, { hero: true }),
      P('drill', 2, 7, { tag: 'drill', name: 'Термальный бур «Крот»' }), P('shotgun', 4, 8), P('shotgun', 3, 9), P('aktiv', 2, 9), P('aktiv', 4, 7), P('mg', 1, 8), P('medevac', 2, 8),
      E('rogue', 'plasma', 18, 6, { tag: 'plasma', ai: 'guard' }), E('rogue', 'plasma', 19, 10, { tag: 'plasma', ai: 'guard' }), E('rogue', 'plasma', 22, 9, { tag: 'plasma', ai: 'guard' }),
      E('rogue', 'raider', 13, 7, { ai: 'guard' }), E('rogue', 'raider', 14, 9, { ai: 'guard' }), E('rogue', 'rshotgun', 16, 6, { ai: 'guard' }),
      E('rogue', 'raider', 17, 9, { ai: 'guard' }), E('rogue', 'raider', 20, 7, { ai: 'guard' }), E('rogue', 'turret', 22, 7, { ai: 'hold' })
    ],
    objectives: [
      { type: 'destroy', unitTag: 'plasma', text: 'Уничтожьте трёх плазменных штурмовиков' },
      { type: 'keepUnit', unitTag: 'drill', secondary: true, text: 'Термальный бур «Крот» должен уцелеть' }
    ],
    briefing: [
      'Цикл 39. Выработка «Глубокая-4». Тяжёлые рейдеры в силовой броне держат зал. В руках — плазменные резаки.',
      'Сфокусированный поток плазмы, предназначенный для резки брони. Он проходит через ствол ружья, превращая оружие в лужу металла, и чисто, почти хирургически, сжигает плоть и кости.',
      'Но плазме нужен прогрев. И в зале — газовые карсты. «Один искровой разряд — и вы взорвётесь вместе с полостью».',
      'Любой юнит может выстрелить по газовому гексу в радиусе атаки или поджечь его паяльной лампой — взрыв бьёт всех на гексе и рядом. Бур может прорезать тонкую стену на севере и открыть фланг.'
    ],
    triggers: [
      { turn: 1, run: async G => { await G.say('«Ледяной коготь»', 'К-39, на севере тонкая перемычка — два метра льда. Бур прорежет её за пару ходов. Фланг открыт.'); } },
      { turn: 6, run: async G => { G.spawn([E('rogue', 'raider', 24, 7), E('rogue', 'raider', 24, 9)], { from: 'walk' }); G.toast('Подкрепление противника из восточного штрека'); } }
    ],
    interlude: 'grin'
  });

  // ===== 8. КОКТЕЙЛЬ =====
  M.push({
    id: 8, title: 'Коктейль', chapter: 'Глава 28', location: 'Карстовая полость без названия', date: 'Цикл 41',
    cycle: { label: 'К-41', num: 41, whiteEyes: true }, env: 'under', W: 22, H: 16, seed: 8808,
    turns: 9, turnLabel: 'ДО ЭВАКУАЦИИ', o2: false, norm: 0, noRegen: true,
    stims: { ephedrine: 2, dox: 2, hyperzine: 2, aranesp: 2, impedrizine: 1, nocturine: 2 },
    build(B) {
      B.fill('#');
      B.blob(10, 8, 5, 'k', 0.2);
      B.disk(10, 8, 2, '.');
      [[8, 5], [13, 11], [14, 6], [6, 10]].forEach(p => B.set(p[0], p[1], '#'));
      B.path([[15, 8], [21, 8]], 't', 0);
      B.path([[5, 8], [0, 8]], 't', 0);
      B.path([[10, 13], [10, 15]], 't', 0);
      B.path([[10, 3], [10, 0]], '.', 0);
      B.path([[14, 4], [19, 1]], 't', 0);
      B.set(12, 12, 'w'); B.set(7, 5, 'w');
      [[9, 7], [11, 9]].forEach(p => B.set(p[0], p[1], 'r'));
      B.struct(10, 1, 'lift', 'player', 'Шахта эвакуации', 'lift');
      [[10, 8], [10, 2]].forEach(p => B.lamp(p[0], p[1]));
    },
    units: [
      P('hero', 9, 8, { hero: true }),
      P('aktiv', 10, 7), P('aktiv', 9, 9), P('shotgun', 11, 8),
      E('fauna', 'filtrator', 19, 8, { ai: 'hunt' }), E('fauna', 'filtrator', 20, 8, { ai: 'hunt' }),
      E('fauna', 'nematode', 10, 15, { ai: 'hunt' }), E('fauna', 'nematode', 10, 14, { ai: 'hunt' })
    ],
    objectives: [
      { type: 'survive', until: 9, heroAlive: true, text: 'К-41 должен продержаться до прибытия эвакуации (конец 9-го хода)' }
    ],
    briefing: [
      'Цикл 41. Он влетел за угол, споткнулся о труп и рухнул на колени. Штрек сзади захлебнулся рёвом — фильтраторы лезли из каждой трещины.',
      'Карстовая полость — метров пятнадцать в поперечнике. Рядом мёртвый рейдер и раскрытая аптечка: эфедрин, дизоксиэфедрин, гиперзин, аранепс, ингаляторы.',
      'Капсула регенерации сюда не дойдёт: полость вне зоны доставки. Смерть здесь — окончательная. Эвакуация — через 9 ходов.',
      '«Все вместе — это самоубийство. Но если я не смешаю — умру как мусор, раздавленный тварями, без смысла». Три разных стимулятора за ход — коктейль. Сила чудовищная. Сердце — не вечное.'
    ],
    triggers: [
      { turn: 3, run: async G => { G.spawn([E('fauna', 'nematode', 0, 8, { ai: 'hunt' }), E('fauna', 'nematode', 1, 8, { ai: 'hunt' }), E('fauna', 'filtrator', 21, 8, { ai: 'hunt' })], { from: 'walk' }); G.toast('Шипение со всех сторон'); } },
      { turn: 5, run: async G => {
        G.spawn([E('rogue', 'raider', 21, 8), E('rogue', 'rshotgun', 20, 8), E('rogue', 'raider', 19, 2)], { from: 'walk' });
        await G.say('К-41', 'В главный проход ворвались рейдеры. Красно-чёрная броня. Они не ожидали увидеть его — одного, по колено в трупах.');
      } },
      { turn: 7, run: async G => { G.spawn([E('fauna', 'filtrator', 10, 15, { ai: 'hunt' }), E('fauna', 'nematode', 21, 8, { ai: 'hunt' }), E('fauna', 'nematode', 0, 8, { ai: 'hunt' })], { from: 'walk' }); } },
      { turn: 8, run: async G => { G.spawn([E('fauna', 'nematode', 19, 1, { ai: 'hunt' }), E('fauna', 'nematode', 10, 15, { ai: 'hunt' })], { from: 'walk' }); await G.say('Эвакуация', 'Лифт на подходе. Держитесь ещё немного.'); } }
    ],
    interlude: 'observer', perk: 'arina'
  });

  // ===== 9. ОСОЗНАНИЕ =====
  M.push({
    id: 9, title: 'Осознание', chapter: 'Глава 40', location: 'Технический комплекс ОПЗ «Кольцо-9»', date: 'Цикл 42',
    cycle: { label: 'К-42', num: 42, whiteEyes: true }, env: 'under', W: 24, H: 16, seed: 9909, station: true,
    turns: 16, turnLabel: 'ХОД', norm: 9,
    stims: { ephedrine: 1, dox: 1, hyperzine: 1, nocturine: 2 },
    build(B) {
      B.fill('#');
      B.disk(2, 8, 2, '.');
      B.path([[3, 8], [10, 8]], '.', 1);
      B.disk(13, 8, 3, '.');
      B.path([[16, 8], [19, 8]], '.', 1);
      B.disk(20, 9, 2, '.');
      B.path([[13, 5], [15, 3], [16, 3]], '.', 0); B.disk(16, 3, 1, '.');
      B.path([[13, 11], [13, 14]], 't', 0); B.disk(13, 14, 1, '.');
      B.path([[14, 14], [19, 12]], 't', 0);
      [[11, 6], [15, 10], [12, 10], [21, 7], [19, 11], [14, 6]].forEach(p => B.set(p[0], p[1], 'r'));
      [[6, 7], [6, 9], [17, 7]].forEach(p => B.set(p[0], p[1], 'b'));
      B.struct(2, 8, 'drop', 'player', 'Шлюз', 'drop');
      B.struct(7, 8, 'bunker', 'opz', 'КПП', 'kpp');
      B.struct(13, 8, 'lab', 'opz', 'Технический блок', 'tech');
      B.struct(20, 8, 'server', 'opz', 'Серверная', 'server');
      B.struct(16, 3, 'radar', 'opz', 'Узел связи', 'comms');
      [[4, 8], [8, 8], [11, 8], [15, 8], [18, 8], [20, 10], [16, 3], [13, 13]].forEach(p => B.lamp(p[0], p[1]));
    },
    units: [
      P('hero', 3, 8, { hero: true }),
      P('vector', 2, 7), P('vector', 3, 9), P('aktiv', 2, 9), P('aktiv', 1, 8), P('shotgun', 4, 8), P('sniper', 1, 7), P('pantsir', 4, 7),
      E('opz', 'guard', 7, 8, { ai: 'hold' }), E('opz', 'guard', 8, 7, { ai: 'guard' }), E('opz', 'guard', 9, 9, { ai: 'guard' }),
      E('opz', 'laser', 12, 7, { ai: 'guard' }), E('opz', 'laser', 14, 9, { ai: 'guard' }), E('opz', 'laser', 19, 7, { ai: 'guard' }), E('opz', 'laser', 16, 3, { ai: 'hold' }),
      E('opz', 'pantsir', 18, 8, { ai: 'guard', name: 'Штурмовик ОПЗ' }),
      E('opz', 'turret', 21, 8, { ai: 'hold' }), E('opz', 'turret', 16, 4, { ai: 'hold' }),
      E('civ', 'civ', 12, 9, { ai: 'civ', name: 'Инженер' }), E('civ', 'civ', 14, 7, { ai: 'civ', name: 'Техник' }), E('civ', 'civ', 13, 10, { ai: 'civ', name: 'Уборщик' }),
      E('civ', 'civ', 21, 10, { ai: 'civ', name: 'Инженер серверной' }), E('civ', 'child', 19, 10, { ai: 'civ', name: 'Ребёнок', tag: 'child' })
    ],
    objectives: [
      { type: 'capture', tags: ['server'], text: 'Захватите серверную' },
      { type: 'capture', tags: ['comms'], text: 'Захватите узел связи' },
      { type: 'noCiv', secondary: true, text: 'Не причинять вреда гражданским' }
    ],
    briefing: [
      'Цикл 42. Он двигался по коридору. Автоматически. Шаг. Остановка. Проверка угла. Шаг.',
      'Он проходил этот маршрут с закрытыми глазами. Сотни раз. Тысячи. Он не считал.',
      'Контракт: технический комплекс ОПЗ. Захватить серверную и узел связи. Персонал не эвакуирован.',
      'Регламент, п. 3.21: «При обнаружении неопознанных групп — огонь на поражение без предупреждения».',
      'Гражданские не атакуют. Вы можете стрелять по ним. Можете — нет. Решать тебе.'
    ],
    triggers: [
      { on: 'capture', tag: 'server', run: async G => { await G.story('awareness'); } }
    ],
    interlude: 'rational'
  });

  // ===== 10. ЦИКЛ 47 =====
  M.push({
    id: 10, title: 'Цикл 47', chapter: 'Глава 44', location: 'Объект «Горн-12»', date: '3026 год, 26 ноября',
    cycle: { label: 'К-47', num: 47, whiteEyes: true }, env: 'surface', weather: 'storm', W: 30, H: 20, seed: 10110,
    turns: 18, turnLabel: 'ХОД', norm: 14,
    stims: { ephedrine: 2, dox: 2, hyperzine: 2, aranesp: 1, impedrizine: 2, nocturine: 2 },
    build(B) {
      B.fill('.');
      B.noise(',', 0.8, 0.54);
      B.noise('^', 1.0, 0.665);
      B.noise('A', 1.3, 0.78, (t, c, r) => r < 3 || c > 25);
      B.crack([[3, 19], [6, 16], [5, 13]], '~');
      B.crack([[24, 0], [22, 3], [25, 5]], '~');
      B.path([[8, 11], [13, 10], [17, 12], [22, 13], [29, 13]], '=');
      B.path([[13, 10], [12, 5], [13, 0]], '=');
      B.path([[13, 10], [9, 5]], '=');
      B.path([[17, 12], [20, 6], [22, 2]], '=');
      B.path([[13, 10], [11, 14]], '=');
      B.disk(15, 7, 1, 'x');
      B.struct(13, 10, 'colony', 'player', '«Горн-12»', 'hq');
      B.struct(17, 12, 'hangar', 'player', 'Ангар', 'hangar');
      B.struct(9, 5, 'rig', 'player', 'Буровая-1', 'rig1');
      B.struct(20, 6, 'rig', 'player', 'Буровая-2', 'rig2');
      B.struct(11, 14, 'depot', 'player', 'Склад', 'depot');
      B.struct(8, 11, 'drop', 'player', 'Точка высадки', 'drop');
      B.struct(15, 7, 'shaft', 'none', 'Буровой ствол', 'shaft');
    },
    units: [
      P('hero', 13, 11, { hero: true }),
      P('vector', 12, 8), P('vector', 16, 11), P('shotgun', 14, 9), P('shotgun', 12, 12), P('aktiv', 10, 5), P('aktiv', 20, 7),
      P('mg', 13, 7), P('sniper', 14, 11), P('pantsir', 12, 10), P('drill', 18, 12), P('medevac', 11, 12), P('shuttle', 17, 13),
      P('turret', 14, 6, { name: 'Автотурель «Горна»' }),
      E('opz', 'laser', 11, 1), E('opz', 'laser', 14, 1), E('opz', 'laser', 17, 1), E('opz', 'guard', 12, 0), E('opz', 'guard', 16, 0),
      E('snk', 'raider', 28, 11), E('snk', 'raider', 28, 14), E('snk', 'raider', 29, 12), E('snk', 'plasma', 29, 10)
    ],
    objectives: [
      { type: 'hold', tags: ['hq'], critical: true, until: 18, text: 'Удержите «Горн-12» до конца 18-го хода' },
      { type: 'destroy', unitTag: 'beast', secondary: true, text: 'Уничтожьте неклассифицированную форму' }
    ],
    aiGoals: { opz: ['hq', 'rig1', 'hangar', 'drop'], snk: ['hangar', 'hq', 'rig2', 'depot'] },
    briefing: [
      'Цикл 47. «Горн-12». Там, где всё началось.',
      'Сюда когда-то сел челнок-невидимка с пятью наёмниками. Здесь погиб оригинал — Кристиан Комаров. Теперь это шахта «Vitezstvi», и логистические штреки от неё ведут к базам ОПЗ и СНК.',
      'ОПЗ идёт с севера. СНК — с востока. Из бурового ствола поднимается нечто, что «избегает шума и освещения».',
      'Где-то на орбитальной станции «Купол-7», за семью гермодверями, обсуждают окупаемость. Затраты на цикл — четыре тысячи двести кредитов. Рыночная стоимость контракта — сто двадцать тысяч.',
      'Задача: удержать «Горн-12» до конца 18-го хода.'
    ],
    triggers: [
      { turn: 1, run: async G => { await G.say('«Ледяной коготь»', 'К-47, объект атакован с двух направлений. Держать колонию. Норма расхода плоти — четырнадцать.'); } },
      { turn: 4, run: async G => { G.spawn([E('opz', 'shuttle', 14, 0, { name: 'Перехватчик ОПЗ' }), E('opz', 'laser', 10, 0), E('opz', 'pantsir', 13, 0, { name: 'Штурмовик ОПЗ' })], { from: 'air' }); G.toast('ОПЗ: вторая волна с севера'); } },
      { turn: 6, run: async G => {
        G.spawn([E('fauna', 'leviathan', 15, 7, { ai: 'hunt', tag: 'beast', name: 'Неклассифицированная форма' }), E('fauna', 'nematode', 14, 7, { ai: 'hunt' }), E('fauna', 'nematode', 16, 8, { ai: 'hunt' })], { from: 'shaft' });
        await G.say('Геосканер', 'Масса… в стволе. Крупная. Очень крупная. Поднимается.');
      } },
      { turn: 8, run: async G => { await G.story('transfer'); G.disableRegen('transfer'); } },
      { turn: 9, run: async G => { G.spawn([E('snk', 'raider', 29, 11), E('snk', 'raider', 29, 15), E('snk', 'drill', 29, 13, { name: 'Бронебур СНК' }), E('snk', 'rshotgun', 28, 12), E('snk', 'rshotgun', 28, 14)], { from: 'walk' }); G.toast('СНК: штурм с востока'); } },
      { turn: 12, run: async G => { G.spawn([E('opz', 'laser', 11, 0), E('opz', 'laser', 15, 0), E('opz', 'guard', 13, 0)], { from: 'walk' }); } },
      { turn: 14, run: async G => { G.spawn([E('snk', 'plasma', 29, 12), E('snk', 'raider', 28, 10), E('snk', 'raider', 28, 16)], { from: 'walk' }); await G.say('«Ледяной коготь»', '…связь с «Купол-7» нестабильна. Держитесь. Считать теперь будут другие.'); } }
    ],
    interlude: 'epilogue'
  });

  /* ---------- Сюжетные тексты ---------- */
  K.story = {
    m1end: {
      title: 'Груз «Гамма»',
      pages: [
        ['В центре ангара — грузовой шаттл. Марвин без церемоний выжигает дверь плазменным резаком. Внутри — ящики из матового чёрного металла. Цель их визита.',
          'Громкий, глухой стук изнутри одного из ящиков. Пять стволов разом нацелились на груз.',
          'Маркус заглянул в щель. Его лицо исказилось смесью ужаса и отвращения.',
          '— Там прототип. Полмиллиарда. Наш контракт — гроши. Я забираю груз себе. Кто со мной?'],
        ['— Я с тобой, шеф. Надоело, — Марвин.',
          '— Нет. Я не пойду на измену, — Альберт.',
          '— Я… я не буду мешать. Не стреляйте… — Динар.',
          'Мозг, выдрессированный годами слепого подчинения, сработал быстрее сознания. Пункт контракта, вбитый в подкорку: «Ликвидация вышедшего из-под контроля актива является приоритетной задачей».',
          'Кристиан выстрелил в своего командира.'],
        ['Хаос. Очередь многоствольной пушки. Две пули в незащищённое горло здоровяка. Альберт, так и не выстреливший в своих. Динар под стеной, даже не взявший оружие в руки.',
          'Шальная пуля, рикошетом от стены, пронзила шею Кристиана, сокрушив позвонок и разорвав артерию.',
          'Последнее, что он почувствовал, — леденящая слабость и наступающая тьма.'],
        ['АГОНИЯ.',
          'Красный свет аварийной лампы пульсирует в такт умирающему сердцу. Маркус у консоли, спиной к нему, спокойно выводит шаттл из ангара. Будто за спиной не лежат тела.',
          'Выстрел. Пуля — чуть ниже левой лопатки. Предсмертная судорога — пальцы на десятках кнопок. Главные гермоворота распахиваются, обнажая ледяную пустоту Ол-12-П.',
          'Иней бежит по стенам, как живой. Вечные пленники ледяного склепа.'],
        ['СВЕТ.',
          'Яркая, безжалостная вспышка. Крышка капсулы отъезжает. Едкий, химически чистый запах озона. Питательный гель на коже.',
          'Рядом стоят десятки таких же капсул. За матовым стеклом каждой — силуэт. В каждой капсуле — он. Его собственное лицо смотрит на него десятками пустых глаз.',
          'Вспышка. Выстрел. Падение. Капсула. Боль. Капсула. Смерть. Капсула.',
          '— Активация завершена.']
      ]
    },
    booklet: {
      title: 'Буклет',
      pages: [
        ['Комната наблюдения. Ровная зелёная линия на мониторе — такая же, как вчера, как неделю назад, как год назад.',
          '— Сколько этот протянет? Часа два?',
          '— Три, если повезёт.',
          '— Ставлю на полтора. Спорим на рацион? Твоя свинина против моей курятины.'],
        ['Техник теребит уголок потрёпанного буклета. «Класс Актив: нормы расхода плоти, цикличность, утилизация».',
          '«Клоны класса „Актив“ представляют собой высокоэффективный биоматериал. Клоны не являются физическими лицами. Один клон способен заменять до двенадцати штатных сотрудников».',
          '«Плановая утилизация превышает показатели естественного износа на 37%».',
          '«При обнаружении у клона признаков самосознания (вопросы „за что?“, „почему я?“, „кто я?“) — немедленно инициировать процедуру аварийной деактивации».'],
        ['— А ты знаешь, что самое смешное? Наши клоны воюют с нашими же клонами. Наша компания продаёт их обеим сторонам конфликта.',
          '— Знаю. Поэтому и читаю брошюры. Чтобы понять, зачем мы это делаем.',
          '— И понял?',
          '— Нет. Только привык.']
      ]
    },
    cook: {
      title: 'Повар', perkText: true,
      pages: [
        ['Эшу было двадцать семь, когда он впервые увидел того парня. Босой. В чужой форме, слишком большой для него. Голова опущена.',
          '— Держи.',
          '— Нельзя. Нарушаю протокол.',
          '— Как тебя зовут?',
          '— К-7.',
          '— Ужасное имя. Буду называть тебя Коля.'],
        ['Эш начал готовить для него специально. Однажды испёк картошку — посолил, добавил масла, завернул в фольгу, чтобы держалась горячей.',
          'У стены лежало тело. Не К-7. К-12. В руке — картошка. Надкушенная один раз. Он спрятал её, чтобы съесть потом. Потом не наступило.',
          '— А давно ли вы кормили свою совесть? — спросил Эш начальника.',
          'Выговор. Минус двадцать процентов к зарплате. Он продолжил.']
      ]
    },
    medic: {
      title: 'Санитар', perkText: true,
      pages: [
        ['Иван работал в утилизации двадцать три года. Бирка. Мешок. Носилки. Машина. Руки помнили всё, голова — ничего.',
          'Но одного клона он запомнил. К-6. Половина черепа снесена. Левый глаз вытек. Но правый — смотрел. Прямо на Ивана.'],
        ['Однажды он разжал сжатые пальцы мёртвого К-16. На ладони лежал камушек. Серый, гладкий, тёплый. Маленький, как медаль.',
          'Что-то внутри, глубже логики, сказало ему: «Оставь».',
          'Блокнот под матрасом: «К-12. Камушек. Передал К-13». «К-17. Камушек на месте. Передал К-18». «К-26. Камушек найден. Передан К-27».',
          '— Клади его в карман клону, когда он выходит из капсулы. Никому не говори.']
      ]
    },
    tech: {
      title: 'Техник', perkText: true,
      pages: [
        ['Елена смотрела на показатели. Это было проще. Цифры не кричат.',
          'Капсула открылась. К-27 вывалился наружу, схватился за горло, и из его груди вырвался звук — не крик, не стон. Он выставлял руки перед собой, защищаясь от чего-то.'],
        ['На следующей смене она изменила настройки. Чуть-чуть. Давление геля — минус десять процентов. Задержка пробуждения — полсекунды. Капсула открывается плавно, без рывка.',
          'Когда К-27 проснулся в следующий раз, он не закричал.',
          '— Ты знаешь, что это бесполезно?',
          '— Знаю. Но я могу сделать так, чтобы ему было чуть тише.']
      ]
    },
    keeper: {
      title: 'Смотритель', perkText: true,
      pages: [
        ['Робин работал смотрителем третий год. «Иди. Стой. Жди». Форму он бросал на пол.',
          'Однажды он не бросил. Протянул. Потом начал поправлять воротник. Затягивать лямки бронежилета. Однажды сунул в карман шоколадку.',
          '— Ты справишься.'],
        ['— Ты помнишь меня? — спросил Робин у К-37.',
          '— Да. Ты называешь меня Кристиан. Ты даёшь мне шоколад. Ты всегда говоришь: «Ты справишься».',
          'В тот же день его вызвали в кабинет. Офицер вытащил пистолет. Робин улыбнулся — коротко, почти незаметно.',
          'В отчёте написали: «несчастный случай при обращении с оружием».'],
        ['Клон вышел из капсулы. Вошёл новый смотритель.',
          '— Где другой?',
          '— Нет другого. Я здесь.',
          'Он не знал, кого потерял. Но он чувствовал это.']
      ]
    },
    grin: {
      title: 'Оскал',
      pages: [
        ['Цикл 40. Он пришёл в себя на полу ангара. Вокруг — тела. Осколок брони в плече, левая рука висит плетью.',
          'Обычно в этом месте, в этот момент, он умирал. Смерть была единственной константой.',
          'Но не в этот раз. Он выжил.'],
        ['Голоса пришли изнутри. Все предыдущие. «Выжил!» «Не умер!» «Мы — он. Он — мы. Мы победили!»',
          'Уголки рта поползли вверх — медленно, неестественно, будто кто-то тянул невидимые нитки. Не улыбка. Спазм. Оскал.',
          '— Он был мёртвый, — сказал старший санитар, закуривая. — Но кто-то забыл ему об этом сказать.'],
        ['СОЛЬ.',
          'В камере сухо. Всегда сухо. Он провёл языком по губам. И почувствовал соль. Пот. От его тела. От его жизни.',
          'Пока он чувствует соль — он есть. Не как номер. Не как актив. Как плоть, которая помнит, что была человеком.',
          'Он улыбнулся. Не оскалом. Просто улыбнулся.']
      ]
    },
    observer: {
      title: 'Наблюдатель', perkText: true,
      pages: [
        ['Арина сидела за пультом пятнадцатый час. Тайный дневник на старом компьютере в углу.',
          '«Смотритель Робин. Контакт с активом. Шоколад. Он называет его Кристиан».',
          '«Санитар Иван. Перемещает камушек из трупа в форму нового клона».',
          '«Техник Елена. Делает пробуждение тише. Она смотрит на него слишком долго».',
          '«Повар Эш. Еда в карман. Каждый день. Он плачет, когда думает, что никто не видит».'],
        ['Она решилась только на К-42. Вошла в капсульную. Гель стекал на пол.',
          '— Ты живой.',
          '— Я знаю. Я всегда знаю.',
          'Её понизили. Архив. Папка «Комаров, Кристиан». Каждая смерть — в сухих корпоративных подробностях, вплоть до каждого миллилитра вытекшей крови.',
          'Она уволилась. Перед уходом отправила анонимное письмо в ОПЗ. Никто не ответил.']
      ]
    },
    rational: {
      title: 'Рациональность',
      pages: [
        ['ВНУТРЕННИЙ АНАЛИТИЧЕСКИЙ ОТЧЁТ № NT-К-47/304. «Совершенно секретно».',
          'Конференц-зал «Купола-7», за семью гермодверями. Над столом — трёхмерная модель нейропрофиля: спираль, местами рваная, местами сгущённая в узлы, похожие на рубцовую ткань. «Стабильность: критическая».',
          'Ройзман: «Затраты на цикл — четыре тысячи двести кредитов. Рыночная стоимость контракта — сто двадцать тысяч. Актив приносит чистую прибыль».'],
        ['Айрин Шульц: «Он дважды пытался убить себя вне задания. Это деградация личности».',
          'Ройзман: «„Белые глаза“ — не сбой. Уникальный феномен нейропластичности. Он использовал собственные локтевые кости как колющее оружие. Это адаптация. Его человечность не входит в контракт».',
          'Градов, «Vitezstvi»: «Он клон. Он не имеет прав. Он не имеет имени. Он имеет номер. И этот номер принадлежит нам».',
          'Стажёр Дейзи Мотхман, тихо: «У него есть имя. Кристиан».'],
        ['Айрин: «Однажды он поймёт, что его смерти — это не случайность, а эксперимент. И тогда у него не останется ничего, кроме ярости. И никто из нас не сможет сказать, что мы не знали».']
      ]
    },
    awareness: {
      title: 'Осознание',
      pages: [
        ['Серверная. Двое. Два выстрела. Женщина за консолью — короткая очередь. Тишина.',
          'Третья — ребёнок у серверной стойки. Процедура та же. Его палец уже на спуске.',
          'И в этот миг луч аварийного освещения упал на лицо.'],
        ['Тёмно-карие глаза, полные немого ужаса. Веснушки на переносице. Та же линия губ.',
          'Он смотрел на себя. На мальчика, который прятался в углу берлоги, когда отец возвращался пьяным. На того, кого он закопал под грудами чужих трупов.',
          'В его взгляде не было ненависти. Только вопрос. Тот самый.',
          'За что?'],
        ['Он не мог убить это. Не потому что это был ребёнок. А потому что это был он.',
          'Серверная взята. Контракт закрыт. В отчёте — «самоликвидация актива К-42 после выполнения задачи».',
          'Капсула уже открывается.']
      ]
    },
    transfer: {
      title: 'Имущество', doc: true,
      pages: [
        ['АКТ ПРИЁМА-ПЕРЕДАЧИ ИМУЩЕСТВА № К-48/НТ',
          'Орбитальная станция «Купол-7». 3026 год, 26 ноября, 14:30.',
          'Передающая сторона — корпорация «Vitezstvi». Принимающая сторона — корпорация «NanoTrasen».',
          '1.1. Нейропрофиль клона класса «Актив» с идентификатором К-47, включая боевые рефлексы, архив психоэмоциональных отклонений от К-1 до К-47, журнал аномалий.',
          '2.1. Капсулы клонирования «Регенератор-7М», серийные номера 0047-К, 0048-К, 0049-К.',
          '3.1. Продолжать бессрочное клонирование актива К-47 в соответствии с нормами расхода плоти.'],
        ['На время демонтажа и транспортировки капсул регенерация активов приостановлена.',
          'Подписи: Директор департамента клонирования Ибрагим Захаев. Уполномоченный представитель Лотам-Тулш.',
          'Акт подписан. Печати поставлены. Копии отправлены. Дело закрыто.',
          '— И дальше без счёта..?',
          '— Теперь их забота. Считать будут другие.',
          'РЕГЕНЕРАЦИЯ ОТКЛЮЧЕНА. Каждая смерть теперь окончательна.']
      ]
    },
    epilogue: {
      title: 'Плакальщики',
      pages: [
        ['Годы шли. Циклы сменяли друг друга — как кадры старой, заезженной плёнки, которую никто не выключит.',
          'Но каждый раз, когда капсула открывалась, пальцы нащупывали в кармане что-то чужое. Не предусмотренное регламентом.',
          'Серый камушек — гладкий, отполированный тысячами прикосновений. Иногда — надкусанный шоколад. Иногда — крошки горячей картошки.'],
        ['Толстые резиновые перчатки, протягивающие свёрток с едой. «Держи, Коля. Горячая».',
          'Седая щетина, склоняющаяся над телом: «Передай следующему».',
          'Тонкие пальцы, поправляющие параметры капсулы: «Пусть ему будет тише».',
          'Шоколадный батончик в левом нагрудном кармане. «Ты справишься».',
          'Женский силуэт за зеркальным стеклом, делающий пометку, которой нет в отчётах.'],
        ['Плакальщики не спасают. Они не могут остановить конвейер. Они только помнят.',
          'Помнят, что у К-4 были карие глаза, а К-12 любил шоколад. Помнят, как К-40 улыбался, когда выжил, а потом плакал при получении оружия.',
          'Камушек перейдёт к следующему.']
      ]
    },
    after: {
      title: 'После',
      pages: [
        ['Комната была светлой. Слишком светлой. Белые стены, белый стол. Где-то за стеной тикали часы. Он считал их.',
          'Он смотрел на комнату и видел оружие. Стул. Планшет. Ручка. Он видел это не потому, что хотел убивать. Он видел это потому, что его учили.',
          'Психолог смотрела на него. Она знала его файл. Сорок восемь регенераций.'],
        ['— Ты помнишь своё имя?',
          'Здесь ему сказали, что он больше не клон. Что у него есть право на имя. Он не знал, что делать с этим правом.',
          '— Кристиан, — сказал он. Слово вышло чужим на языке.',
          '— Что ты чувствуешь?',
          '— Не знаю.',
          '— Это уже начало.'],
        ['Коридор. Таблички: «Столовая», «Комната отдыха», «Выход».',
          '«К-14. Подъём», — голос изнутри. Тело выпрямилось навытяжку. Секунда. Две. Три. Приказа не было.',
          '— Замолчи.',
          'Он стоял перед дверью с надписью «Выход». В кармане — белая карточка с номером телефона. И маленький серый камушек, которого там не должно было быть.']
      ]
    }
  };
})();
