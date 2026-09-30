/* К-47 — интерфейс: экраны, HUD, ввод, диалоги, сохранения */
'use strict';
(function () {
  const U = K.util, Hx = K.hex, D = K.data, G = K.game, R = K.render, A = K.audio, SP = K.sprites;
  const UI = K.ui = {};
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = U.escape;

  /* ---------- Сохранение ---------- */
  const KEY = 'k47.save.v1';
  const defSave = () => ({ unlocked: 1, done: {}, perks: [], heroXP: 0, heroDeaths: 0, difficulty: 'normal', finished: false, hintsSeen: {}, mid: null, introSeen: false,
    settings: { sfx: 0.7, music: 0.45, speed: 1, grid: true, hints: true, intro: true } });
  UI.save = defSave();
  UI.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); UI.save = Object.assign(defSave(), s); UI.save.settings = Object.assign(defSave().settings, s.settings || {}); }
    } catch (e) { /* хранилище недоступно */ }
    applySettings();
  };
  UI.persist = function () { try { localStorage.setItem(KEY, JSON.stringify(UI.save)); } catch (e) { /* */ } };
  function applySettings() {
    const s = UI.save.settings;
    A.setVol(s.sfx, s.music);
    R.speed = s.speed;
    R.showGrid = s.grid;
  }
  UI.campaign = () => ({ perks: UI.save.perks.slice(), heroXP: UI.save.heroXP, difficulty: UI.save.difficulty });

  /* ---------- Экраны ---------- */
  const screens = ['intro', 'menu', 'select', 'briefing', 'story', 'debrief', 'codex', 'settings', 'ending'];
  UI.show = function (name) {
    screens.forEach(s => { const e = $('#screen-' + s); if (e) e.classList.toggle('active', s === name); });
    $('#hud').classList.toggle('hidden', name !== 'game');
    $('#game').classList.toggle('dim', name !== 'game');
    if (name === 'menu' || name === 'select' || name === 'codex' || name === 'settings') { K.menubg.start($('#menu-cv')); $('#screen-menu-bg').classList.add('active'); }
    else { K.menubg.stop(); $('#screen-menu-bg').classList.remove('active'); }
    R.paused = name !== 'game' && name !== 'briefing';
    UI.current = name;
  };

  /* ---------- Тосты ---------- */
  UI.toast = function (text, kind) {
    const box = $('#toasts');
    const t = el('div', 'toast ' + (kind || 'info'), esc(text));
    box.appendChild(t);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => t.classList.add('out'), 3800);
    setTimeout(() => t.remove(), 4400);
    addLog(text, kind);
  };
  function addLog(text, kind) {
    const lg = $('#log-list');
    if (!lg) return;
    const S = G.state();
    const row = el('div', 'log-row ' + (kind || ''), `<b>${S ? S.turn : ''}</b> ${esc(text)}`);
    lg.prepend(row);
    while (lg.children.length > 60) lg.removeChild(lg.lastChild);
  }

  /* ---------- Радиодиалог ---------- */
  UI.say = function (who, text) {
    return new Promise(res => {
      const box = $('#dialog');
      box.innerHTML = `<div class="dlg-who">${esc(who)}</div><div class="dlg-text"></div><div class="dlg-next">▶ Далее</div>`;
      box.classList.add('show');
      A.sfx('radio');
      const tx = box.querySelector('.dlg-text');
      let i = 0, done = false;
      const timer = setInterval(() => {
        i += 2; tx.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(timer); done = true; }
      }, 18);
      const next = e => {
        if (e && e.type === 'keydown' && [' ', 'Enter', 'Escape'].indexOf(e.key) < 0) return;
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!done) { clearInterval(timer); tx.textContent = text; done = true; return; }
        box.classList.remove('show');
        box.removeEventListener('pointerdown', next);
        window.removeEventListener('keydown', next, true);
        UI.dialogOpen = false;
        res();
      };
      UI.dialogOpen = true;
      setTimeout(() => { box.addEventListener('pointerdown', next); window.addEventListener('keydown', next, true); }, 150);
    });
  };

  /* ---------- Сюжетные страницы ---------- */
  UI.storyPages = function (id, opts) {
    opts = opts || {};
    const st = K.story[id];
    return new Promise(res => {
      if (!st) { res(); return; }
      const scr = $('#screen-story');
      const prev = UI.current;
      UI.show('story');
      let page = 0;
      const render = () => {
        const p = st.pages[page];
        scr.innerHTML = `<div class="story-box ${st.doc ? 'doc' : ''}">
          <div class="story-title">${esc(st.title)}</div>
          <div class="story-page">${p.map((l, i) => `<p style="animation-delay:${i * 0.35}s">${esc(l)}</p>`).join('')}</div>
          <div class="story-foot"><span class="story-count">${page + 1} / ${st.pages.length}</span>
          <button class="btn primary" id="story-next">${page < st.pages.length - 1 ? 'Далее' : (opts.last || 'Продолжить')}</button></div></div>`;
        scr.querySelector('#story-next').onclick = () => {
          A.sfx('click');
          if (page < st.pages.length - 1) { page++; render(); }
          else { if (opts.returnTo) UI.show(opts.returnTo); else if (prev === 'game') UI.show('game'); res(); }
        };
      };
      render();
    });
  };

  /* ---------- Хуки игры ---------- */
  G.hooks.say = UI.say;
  G.hooks.story = id => UI.storyPages(id, { returnTo: 'game' });
  G.hooks.toast = UI.toast;

  /* ---------- Главное меню ---------- */
  UI.buildMenu = function () {
    const m = $('#screen-menu');
    const sv = UI.save;
    const cont = sv.mid || sv.unlocked > 1 || sv.done[1];
    m.innerHTML = `
      <div class="menu-inner">
        <div class="logo"><div class="logo-k">К-47</div><div class="logo-sub">НОРМЫ РАСХОДА ПЛОТИ</div><div class="logo-tag">Пошаговая тактика · Ол-12-П · 3002–3026</div></div>
        <div class="menu-list">
          ${cont ? `<button class="mbtn" data-a="continue"><span>Продолжить</span><small>${sv.mid ? 'операция ' + (sv.mid.mi + 1) + ', ход ' + sv.mid.turn : 'операция ' + Math.min(10, sv.unlocked)}</small></button>` : ''}
          <button class="mbtn" data-a="new"><span>Новая кампания</span><small>10 операций</small></button>
          <button class="mbtn" data-a="select"><span>Операции</span><small>открыто ${sv.unlocked} из 10</small></button>
          <button class="mbtn" data-a="codex"><span>Досье</span><small>планета, брошюры, снаряжение</small></button>
          <button class="mbtn" data-a="settings"><span>Настройки</span><small>звук, скорость, сложность</small></button>
          <button class="mbtn" data-a="intro"><span>Интро</span><small>смотреть снова</small></button>
        </div>
        <div class="menu-foot">«Плакальщики не спасают. Они только помнят.»</div>
      </div>
      <div class="menu-stats">${sv.heroDeaths ? `ЖУРНАЛ УЧЁТА СМЕРТЕЙ К-47: <b>${sv.heroDeaths}</b>` : 'ЦИКЛ 1'}${sv.finished ? ' · <b>КАМПАНИЯ ЗАВЕРШЕНА</b>' : ''}</div>`;
    m.querySelectorAll('.mbtn').forEach(b => b.onclick = () => { A.init(); A.sfx('click'); menuAction(b.dataset.a); });
  };
  function menuAction(a) {
    if (a === 'continue') {
      if (UI.save.mid) return UI.resumeMid();
      return UI.briefing(Math.min(9, UI.save.unlocked - 1));
    }
    if (a === 'new') {
      const go = () => { const keep = UI.save.settings, diff = UI.save.difficulty, hs = UI.save.hintsSeen, fin = UI.save.finished; UI.save = defSave(); UI.save.settings = keep; UI.save.difficulty = diff; UI.save.finished = fin; UI.save.hintsSeen = hs; UI.save.introSeen = true; UI.persist(); UI.briefing(0); };
      if (UI.save.unlocked > 1 || UI.save.mid) UI.confirm('Начать кампанию заново? Прогресс, плакальщики и журнал смертей будут сброшены.', go);
      else go();
      return;
    }
    if (a === 'select') return UI.buildSelect();
    if (a === 'codex') return UI.buildCodex();
    if (a === 'settings') return UI.buildSettings();
    if (a === 'intro') return UI.playIntro(() => { UI.buildMenu(); UI.show('menu'); A.music(true); });
  }

  UI.confirm = function (text, yes, no) {
    const md = $('#modal');
    md.innerHTML = `<div class="modal-box"><div class="modal-text">${esc(text)}</div><div class="modal-btns"><button class="btn" id="md-no">Отмена</button><button class="btn primary" id="md-yes">Да</button></div></div>`;
    md.classList.add('show');
    md.querySelector('#md-yes').onclick = () => { md.classList.remove('show'); A.sfx('click'); yes && yes(); };
    md.querySelector('#md-no').onclick = () => { md.classList.remove('show'); A.sfx('click'); no && no(); };
  };

  UI.playIntro = function (done) {
    UI.show('intro');
    A.init();
    A.music(false); A.ambient('storm');
    K.intro.play($('#intro-cv'), () => { A.ambient(null); UI.save.introSeen = true; UI.persist(); done(); });
  };

  /* ---------- Выбор операции ---------- */
  UI.buildSelect = function () {
    const scr = $('#screen-select');
    const sv = UI.save;
    scr.innerHTML = `<div class="panel-page"><div class="page-head"><h2>Операции</h2><button class="btn" id="sel-back">Назад</button></div>
      <div class="ops">${K.missions.map((m, i) => {
        const open = i < sv.unlocked;
        const d = sv.done[m.id];
        const g = d ? D.GRADES.find(x => d.eff >= x.min) : null;
        return `<button class="op ${open ? '' : 'locked'}" data-i="${i}" ${open ? '' : 'disabled'}>
          <div class="op-n">${String(i + 1).padStart(2, '0')}</div>
          <div class="op-t"><b>${open ? esc(m.title) : '— засекречено —'}</b><small>${open ? esc(m.cycle.label + ' · ' + m.location) : 'Требуется выполнение предыдущей операции'}</small></div>
          <div class="op-g" style="color:${g ? g.color : '#556'}">${g ? g.name + '<small>' + d.eff + '%</small>' : (open ? 'НЕ ВЫПОЛНЕНО' : '')}</div></button>`;
      }).join('')}</div></div>`;
    scr.querySelector('#sel-back').onclick = () => { A.sfx('click'); UI.buildMenu(); UI.show('menu'); };
    scr.querySelectorAll('.op').forEach(b => b.onclick = () => { A.sfx('click'); UI.briefing(+b.dataset.i); });
    UI.show('select');
  };

  /* ---------- Досье ---------- */
  UI.buildCodex = function () {
    const scr = $('#screen-codex');
    const list = D.CODEX.concat(UI.save.finished ? [D.CODEX_SECRET] : []);
    const perks = UI.save.perks.map(p => D.PERKS[p]);
    const unitsEntry = { id: 'units', title: 'Юниты', group: 'Снаряжение', units: true };
    const perkEntry = { id: 'perks', title: 'Плакальщики', group: 'Документы', perks: true };
    const all = list.concat([unitsEntry]).concat(perks.length ? [perkEntry] : []);
    let cur = all[0].id;
    const render = () => {
      const e = all.find(x => x.id === cur);
      let body;
      if (e.units) {
        body = Object.keys(D.UNITS).map(k => {
          const T = D.UNITS[k];
          const atk = T.atk ? `атака ${T.atk.soft}/${T.atk.hard}/${T.atk.air} · дальность ${T.range[0]}–${T.range[1]}` : 'без оружия';
          return `<div class="cx-unit"><canvas width="84" height="64" data-u="${k}"></canvas><div><b>${esc(T.name)}</b><small>${atk} · броня ${T.armor} · движение ${T.mp / 2}${T.ammo && T.ammo < 99 ? ' · патроны ' + T.ammo : ''}</small><p>${esc(T.desc)}</p></div></div>`;
        }).join('');
      } else if (e.perks) {
        body = perks.map(p => `<div class="cx-perk"><b>${esc(p.who)}</b> — «${esc(p.name)}»<p>${esc(p.desc)}</p></div>`).join('');
      } else body = e.text.map(t => `<p>${esc(t)}</p>`).join('');
      const groups = {};
      all.forEach(x => { (groups[x.group] = groups[x.group] || []).push(x); });
      scr.innerHTML = `<div class="panel-page codex"><div class="page-head"><h2>Досье</h2><button class="btn" id="cx-back">Назад</button></div>
        <div class="cx-wrap"><div class="cx-list">${Object.keys(groups).map(g => `<div class="cx-g">${esc(g)}</div>` + groups[g].map(x => `<button class="cx-i ${x.id === cur ? 'on' : ''}" data-id="${x.id}">${esc(x.title)}</button>`).join('')).join('')}</div>
        <div class="cx-body"><h3>${esc(e.title)}</h3>${body}</div></div></div>`;
      scr.querySelector('#cx-back').onclick = () => { A.sfx('click'); UI.buildMenu(); UI.show('menu'); };
      scr.querySelectorAll('.cx-i').forEach(b => b.onclick = () => { A.sfx('click'); cur = b.dataset.id; render(); });
      scr.querySelectorAll('canvas[data-u]').forEach(c => {
        const ctx = c.getContext('2d');
        const k = c.dataset.u;
        const fac = ['guard', 'laser'].indexOf(k) >= 0 ? 'opz' : ['plasma', 'raider', 'rshotgun'].indexOf(k) >= 0 ? 'snk' : D.UNITS[k].beast ? 'fauna' : D.UNITS[k].civ ? 'civ' : 'player';
        const spr = SP.unit(k, fac);
        const T = D.UNITS[k];
        ctx.fillStyle = '#0b1016'; ctx.fillRect(0, 0, 84, 64);
        const s = 0.9 / (T.size || 1);
        ctx.save(); ctx.translate(42, 34); ctx.scale(s, s); ctx.drawImage(spr, -56, -58); ctx.restore();
      });
    };
    render();
    UI.show('codex');
  };

  /* ---------- Настройки ---------- */
  UI.buildSettings = function (fromGame) {
    const scr = $('#screen-settings');
    const s = UI.save.settings;
    scr.innerHTML = `<div class="panel-page settings"><div class="page-head"><h2>Настройки</h2><button class="btn" id="st-back">Назад</button></div>
      <label class="row"><span>Эффекты</span><input type="range" min="0" max="1" step="0.05" id="st-sfx" value="${s.sfx}"></label>
      <label class="row"><span>Музыка и эмбиент</span><input type="range" min="0" max="1" step="0.05" id="st-mus" value="${s.music}"></label>
      <label class="row"><span>Скорость анимаций</span><select id="st-speed">${[1, 1.5, 2.5].map(v => `<option value="${v}" ${s.speed == v ? 'selected' : ''}>${v}×</option>`).join('')}</select></label>
      <label class="row"><span>Сложность</span><select id="st-diff" ${fromGame ? 'disabled' : ''}>${Object.keys(D.DIFF).map(k => `<option value="${k}" ${UI.save.difficulty === k ? 'selected' : ''}>${D.DIFF[k].name}</option>`).join('')}</select></label>
      <div class="row note" id="st-diff-note">${esc(D.DIFF[UI.save.difficulty].desc)}${fromGame ? ' (меняется вне операции)' : ''}</div>
      <label class="row"><span>Гексовая сетка</span><input type="checkbox" id="st-grid" ${s.grid ? 'checked' : ''}></label>
      <label class="row"><span>Подсказки</span><input type="checkbox" id="st-hints" ${s.hints ? 'checked' : ''}></label>
      <label class="row"><span>Интро при запуске</span><input type="checkbox" id="st-intro" ${s.intro ? 'checked' : ''}></label>
      <div class="row"><span>Управление</span><small class="keys">ЛКМ/тап — выбор, движение, атака · ПКМ/Esc — отмена · перетаскивание/WASD — обзор · колесо/щипок — масштаб · Пробел — конец хода · Tab — следующий юнит · U — отменить ход · G — сетка</small></div>
      ${fromGame ? '' : '<div class="row"><button class="btn danger" id="st-reset">Сбросить весь прогресс</button></div>'}
    </div>`;
    const upd = () => {
      s.sfx = +scr.querySelector('#st-sfx').value; s.music = +scr.querySelector('#st-mus').value;
      s.speed = +scr.querySelector('#st-speed').value; s.grid = scr.querySelector('#st-grid').checked;
      s.hints = scr.querySelector('#st-hints').checked; s.intro = scr.querySelector('#st-intro').checked;
      if (!fromGame) { UI.save.difficulty = scr.querySelector('#st-diff').value; scr.querySelector('#st-diff-note').textContent = D.DIFF[UI.save.difficulty].desc; }
      applySettings(); UI.persist();
    };
    scr.querySelectorAll('input,select').forEach(i => { i.oninput = upd; i.onchange = upd; });
    scr.querySelector('#st-back').onclick = () => { A.sfx('click'); if (fromGame) UI.show('game'); else { UI.buildMenu(); UI.show('menu'); } };
    const rs = scr.querySelector('#st-reset');
    if (rs) rs.onclick = () => UI.confirm('Сбросить весь прогресс, включая завершённую кампанию?', () => { const keep = UI.save.settings; UI.save = defSave(); UI.save.settings = keep; UI.persist(); UI.buildMenu(); UI.show('menu'); });
    UI.show('settings');
  };

  /* ---------- Брифинг ---------- */
  UI.briefing = function (mi) {
    const m = K.missions[mi];
    A.init(); A.music(true); A.ambient(null);
    const scr = $('#screen-briefing');
    scr.innerHTML = `<div class="loading">Загрузка данных геосканирования…</div>`;
    UI.show('briefing');
    setTimeout(() => {
      G.load(mi, UI.campaign());
      R.bake();
      const S = G.state();
      const stims = Object.keys(m.stims || {}).filter(k => m.stims[k]).map(k => `${D.STIMS[k].name} ×${m.stims[k]}`).join(', ') || '—';
      const fac = {};
      S.units.forEach(u => { if (u.fac !== 'player' && u.fac !== 'civ') fac[u.fac] = 1; });
      scr.innerHTML = `<div class="brief">
        <div class="brief-left">
          <div class="brief-op">ОПЕРАЦИЯ ${mi + 1} / 10 · ${esc(m.chapter)}</div>
          <h1>${esc(m.title)}</h1>
          <div class="brief-meta"><span>${esc(m.location)}</span><span>${esc(m.date)}</span><span class="red">${m.cycle.human ? 'Оригинал: ' : 'Актив: '}${esc(m.cycle.label)}</span></div>
          <div class="brief-text">${m.briefing.map(p => `<p>${esc(p)}</p>`).join('')}</div>
          <div class="brief-obj"><div class="bo-h">ЗАДАЧИ</div>${m.objectives.map(o => `<div class="bo ${o.secondary ? 'sec' : ''}">${o.secondary ? '◇' : '◆'} ${esc(o.text)}</div>`).join('')}</div>
          <div class="brief-stats">
            <div><small>${m.o2 ? 'Кислород' : 'Лимит'}</small><b>${m.turns} ${m.turnLabel === 'КИСЛОРОД' ? 'ходов' : 'ходов'}</b></div>
            <div><small>Норма расхода плоти</small><b>${S.norm.max ? S.norm.max + ' регенераций' : (m.cycle.human ? 'люди — без регенерации' : 'регенерация недоступна')}</b></div>
            <div><small>Противник</small><b>${Object.keys(fac).map(f => esc((m.labels && m.labels[f]) || D.FACTIONS[f].label)).join(', ') || '—'}</b></div>
            <div><small>Стимуляторы</small><b>${esc(stims)}</b></div>
            ${UI.save.perks.length ? `<div><small>Плакальщики</small><b>${UI.save.perks.map(p => esc(D.PERKS[p].name)).join(', ')}</b></div>` : ''}
          </div>
          <div class="brief-btns"><button class="btn" id="br-back">Назад</button><button class="btn primary big" id="br-go">Начать операцию</button></div>
        </div>
        <div class="brief-right"><canvas id="br-map" width="640" height="460"></canvas><div class="map-leg"><span class="lg y">◯ цели</span><span class="lg r">■ ваши силы</span><span>Данные геосканера: точность 70%</span></div></div>
      </div>`;
      R.preview(scr.querySelector('#br-map'));
      scr.querySelector('#br-back').onclick = () => { A.sfx('click'); UI.buildMenu(); UI.show('menu'); };
      scr.querySelector('#br-go').onclick = () => { A.sfx('click'); UI.startMission(); };
    }, 30);
  };

  /* ---------- Запуск операции ---------- */
  UI.startMission = async function (resumed) {
    const S = G.state();
    A.music(false);
    A.ambient(S.env === 'surface' ? (S.m.weather === 'storm' ? 'storm' : 'surface') : 'under');
    UI.show('game');
    UI.sel = null; UI.mode = null; clearOverlays();
    const hero = S.units.find(u => u.hero) || S.units.find(u => u.fac === 'player');
    R.cam.z = window.innerWidth < 700 ? 0.8 : 1;
    if (hero) R.centerOn(hero.c, hero.r, true);
    buildHUD();
    refresh();
    if (!resumed) {
      await G.begin();
      UI.autosave();
      if (S.m.id === 1) UI.hint('start');
      if (S.env === 'under' && S.m.o2) UI.hint('o2');
      if (S.structs.length && S.m.objectives.some(o => o.type === 'hold')) UI.hint('hold');
      if (S.terrain.some(t => t === 'g' || t === 'o')) UI.hint('gas');
    } else { G.computeVis(); refresh(); }
  };

  UI.resumeMid = function () {
    const mid = UI.save.mid;
    try {
      G.deserialize(mid, UI.campaign());
      R.bake();
      UI.startMission(true);
      UI.toast('Операция восстановлена: ход ' + G.state().turn, 'info');
    } catch (e) {
      console.error(e);
      UI.save.mid = null; UI.persist();
      UI.briefing(Math.min(9, UI.save.unlocked - 1));
    }
  };
  UI.autosave = function () {
    const S = G.state();
    if (!S || S.over) return;
    try { UI.save.mid = G.serialize(); UI.persist(); } catch (e) { /* */ }
  };

  /* ---------- HUD ---------- */
  function buildHUD() {
    const hud = $('#hud');
    hud.innerHTML = `
      <div id="topbar">
        <button class="hbtn" id="h-menu" title="Меню (Esc)">☰</button>
        <div id="objective"><span class="obj-l">ОСНОВНАЯ ЦЕЛЬ</span> — <span id="obj-t"></span><div id="obj-list"></div></div>
        <div id="chips"></div>
      </div>
      <div id="phase"></div>
      <div id="hint"></div>
      <div id="forecast"></div>
      <div id="dialog"></div>
      <div id="stim-menu"></div>
      <div id="log"><div id="log-h">ЖУРНАЛ</div><div id="log-list"></div></div>
      <div id="bottom">
        <div class="b-left"><canvas id="mini"></canvas><div id="terrain-info"><b>—</b><span></span></div></div>
        <div class="b-logo"><div class="redbars"><i></i><i></i><i></i><i></i><i></i></div><div class="emblem">К-47<small>VITEZSTVI</small></div></div>
        <div class="b-port"><canvas id="portrait" width="150" height="92"></canvas></div>
        <div class="b-unit" id="unit-info"></div>
        <div class="b-actions" id="actions"></div>
        <button class="b-end" id="h-end" title="Конец хода (Пробел)"><span>▶▶</span><small>КОНЕЦ ХОДА</small></button>
      </div>`;
    R.miniCanvas = $('#mini');
    $('#h-menu').onclick = () => { A.sfx('click'); pauseMenu(); };
    $('#h-end').onclick = () => endTurnClick();
    $('#objective').onclick = () => $('#objective').classList.toggle('open');
    $('#log-h').onclick = () => $('#log').classList.toggle('open');
    $('#mini').addEventListener('pointerdown', e => {
      const r = e.target.getBoundingClientRect();
      const w = R.miniToWorld((e.clientX - r.left) * e.target.width / r.width, (e.clientY - r.top) * e.target.height / r.height);
      R.cam.tx = w[0]; R.cam.ty = w[1];
      e.stopPropagation();
    });
  }

  function chip(label, val, cls) { return `<div class="chip ${cls || ''}"><small>${label}</small><b>${val}</b></div>`; }

  function refresh() {
    const S = G.state();
    if (!S || UI.current !== 'game') return;
    const m = S.m;
    // цели
    const prim = m.objectives.map((o, i) => ({ o, i })).filter(x => !x.o.secondary);
    const firstOpen = prim.find(x => G.objStatus(x.o, x.i) !== 'done') || prim[0];
    $('#obj-t').textContent = firstOpen ? firstOpen.o.text : '';
    $('#obj-list').innerHTML = m.objectives.map((o, i) => {
      const st = G.objStatus(o, i);
      const mark = st === 'done' ? '✓' : st === 'fail' ? '✗' : st === 'danger' ? '!' : (o.secondary ? '◇' : '◆');
      return `<div class="ol ${st} ${o.secondary ? 'sec' : ''}"><b>${mark}</b> ${esc(o.text)}${o.type === 'evac' ? ` <i>${S.stats.evacuated}/${o.count}</i>` : o.type === 'reach' ? ` <i>${S.stats.evacAny}/${o.count}</i>` : ''}</div>`;
    }).join('');
    // фишки
    const left = m.turns - S.turn + 1;
    const hero = S.units.find(u => u.hero && !u.dead && !u.evac);
    let chips = chip(m.o2 ? 'КИСЛОРОД' : m.turnLabel, m.o2 ? `${left} х.` : `${S.turn}/${m.turns}`, m.o2 && left <= 3 ? 'warn' : '');
    if (m.o2) chips = chip('ХОД', `${S.turn}/${m.turns}`) + chips;
    if (S.norm.max) chips += chip('РАСХОД ПЛОТИ', S.flags.noRegen ? 'ОТКЛ.' : `${S.norm.used}/${S.norm.max}`, S.flags.noRegen || S.norm.used >= S.norm.max - 1 ? 'warn' : '');
    else if (!m.cycle.human) chips += chip('РЕГЕНЕРАЦИЯ', 'НЕТ', 'warn');
    if (S.regenQueue.length && !S.flags.noRegen) chips += chip('В КАПСУЛАХ', S.regenQueue.map(q => q.turns).join(' · ') + ' х.');
    chips += chip(m.cycle.human ? 'ОРИГИНАЛ' : 'АКТИВ', hero ? esc(hero.name) : (m.cycle.human ? 'Кристиан' : 'К-' + S.heroCycle), 'red');
    $('#chips').innerHTML = chips;
    $('#phase').className = S.phase !== 'player' ? 'show' : '';
    if (S.phase !== 'player') $('#phase').textContent = 'ХОД: ' + ((m.labels && m.labels[S.phase]) || D.FACTIONS[S.phase].label).toUpperCase();
    $('#h-end').disabled = S.phase !== 'player' || G.busy;
    // юнит
    const u = UI.inspect || UI.sel;
    SP.portrait($('#portrait'), u && !u.dead ? u : null);
    const info = $('#unit-info');
    if (u && !u.dead) {
      const T = G.T(u);
      const facLabel = (m.labels && m.labels[u.fac]) || D.FACTIONS[u.fac].label;
      const dmgPct = Math.round((1 - u.hp / u.maxhp) * 100);
      const fx = [];
      if (u.sleep) fx.push('<i class="bad">сон</i>');
      if (u.suppressed) fx.push('<i class="bad">подавлен</i>');
      if (T.warmup && u.warm < 1) fx.push('<i class="bad">прогрев</i>');
      u.effects.forEach(e => {
        const n = { eph2: 'эфедрин', ephCrash: 'откат', dox: 'дизокси', convulsion: 'судороги', exhaustNext: 'гиперзин', exhausted: 'пустой мешок', cocktail: 'КОКТЕЙЛЬ', choco: 'шоколад' }[e.id];
        if (n) fx.push(`<i class="${['ephCrash', 'convulsion', 'exhausted', 'cocktail'].indexOf(e.id) >= 0 ? 'bad' : 'good'}">${n}</i>`);
      });
      if (T.laser && u.fac !== 'player') fx.push(`<i class="bad">батарея ${Math.round(Math.max(0.35, 1 - 0.1 * (S.turn - 1)) * 100)}%</i>`);
      const ammo = !T.atk ? '—' : G.isInfinite(u) ? '∞' : `${u.ammo}/${T.ammo}`;
      info.innerHTML = `
        <div class="u-name">${esc(u.hero ? u.name : (G.displayName(u) !== T.short ? G.displayName(u) + ' · ' : '') + T.name)}</div>
        <div class="u-fac f-${u.fac}">${esc(facLabel)}</div>
        <div class="u-stats">
          <span>Урон: <b>${dmgPct}%</b></span><span>Боеприпасы: <b>${ammo}</b></span>
          <span>Ранг: <b>${'●'.repeat(u.rank) || '—'}</b></span>
          ${T.atk ? `<span>Атака: <b>${G.atkVal(u, 'soft')}/${G.atkVal(u, 'hard')}/${G.atkVal(u, 'air')}</b></span><span>Дальн.: <b>${G.range(u)[0]}–${G.range(u)[1]}</b></span>` : ''}
          <span>Броня: <b>${G.armor(u)}</b></span>
          ${u.fac === 'player' ? `<span>Ход: <b>${G.canMove(u) ? 'есть' : 'нет'}</b></span><span>Огонь: <b>${G.canAttack(u) ? 'есть' : 'нет'}</b></span>` : ''}
          ${T.clone && u.fac === 'player' && !u.human ? `<span>Цикл: <b>${u.cycle}</b></span>` : ''}
        </div>
        <div class="u-fx">${fx.join('')}</div>`;
    } else {
      info.innerHTML = `<div class="u-name">—</div><div class="u-fac">Выберите юнита</div><div class="u-stats"><span>Осталось юнитов с ходом: <b>${G.idleUnits().length}</b></span></div>`;
    }
    // местность под курсором
    const h = UI.hoverHex;
    if (h && G.inb(h[0], h[1])) {
      const t = G.tInfo(h[0], h[1]); const st = G.structAt(h[0], h[1]);
      const def = st ? D.STRUCT[st.type].def : t.def;
      $('#terrain-info').innerHTML = `<b>${esc(st ? D.STRUCT[st.type].name : t.name)}</b><span>${esc(st ? st.name : t.full)}</span><span>Защита: ${def >= 0 ? '+' : ''}${def}%</span>`;
    }
    buildActions();
  }
  UI.refresh = refresh;

  function actBtn(id, label, key, enabled, title, onclick, cls) {
    return { id, label, key, enabled, title, onclick, cls };
  }

  function buildActions() {
    const box = $('#actions');
    const S = G.state();
    const u = UI.sel;
    const list = [];
    const myTurn = S.phase === 'player' && !G.busy && !S.over;
    if (u && u.fac === 'player' && !u.dead) {
      const T = G.T(u);
      const anyStim = D.STIM_ORDER.some(k => S.stims[k] > 0);
      if (anyStim && !T.civ) list.push(actBtn('stim', '💉 Стим', 'X', myTurn && D.STIM_ORDER.some(k => G.canStim(u, k)), 'Стимуляторы', () => toggleStims()));
      if (T.bore) list.push(actBtn('bore', '⛏ Бурить', 'B', myTurn && G.boreTargets(u).length > 0, 'Прорезать ледяную толщу рядом', () => setMode('bore')));
      if (G.torchTargets(u).length) list.push(actBtn('torch', '🔥 Поджечь', 'F', myTurn, 'Паяльной лампой поджечь газ рядом', () => setMode('torch')));
      if (u.scanLeft) list.push(actBtn('scan', `📡 Скан ×${u.scanLeft}`, 'C', myTurn && G.canAct(u), 'Геосканер: показать всё в радиусе 6, включая затаившихся тварей', () => { G.scan(u); UI.hint('scan'); }));
      if (T.atk || T.supply) list.push(actBtn('sup', '📦 Пополнить', 'R', myTurn && !!G.resupplyInfo(u), 'Пополнить боеприпасы (у своих объектов/санитаров — полностью и +2 здоровья). Завершает ход юнита.', () => { G.resupply(u); afterAction(); }));
      list.push(actBtn('wait', '⏸ Ждать', 'Z', myTurn && !u.done, 'Юнит заканчивает ход', () => { G.wait(u); UI.sel = null; nextUnit(); }));
    }
    list.push(actBtn('undo', '↶ Отмена', 'U', myTurn && !!S.lastMove, 'Отменить последнее перемещение (если оно ничего не раскрыло)', () => { if (G.undo()) { reselect(); A.sfx('click'); } }));
    list.push(actBtn('next', '⇥ Следующий', 'Tab', myTurn && G.idleUnits().length > 0, 'Следующий юнит с ходом', () => nextUnit()));
    box.innerHTML = '';
    list.forEach(b => {
      const e = el('button', 'abtn ' + (b.cls || ''), `<span>${b.label}</span><small>${b.key}</small>`);
      e.title = b.title; e.disabled = !b.enabled;
      if (UI.mode === b.id) e.classList.add('on');
      e.onclick = ev => { ev.stopPropagation(); A.sfx('click'); b.onclick(); };
      box.appendChild(e);
    });
  }

  function toggleStims() {
    const menu = $('#stim-menu');
    if (menu.classList.contains('show')) { menu.classList.remove('show'); return; }
    const S = G.state(), u = UI.sel;
    menu.innerHTML = `<div class="sm-h">СТИМУЛЯТОРЫ · ${esc(u.name || G.displayName(u))}</div>` + D.STIM_ORDER.filter(k => S.stims[k] != null).map(k => {
      const st = D.STIMS[k];
      const ok = G.canStim(u, k);
      const used = u.turnStims && u.turnStims[k];
      return `<button class="sm-i" data-k="${k}" ${ok ? '' : 'disabled'}><i style="background:${st.color}"></i><b>${esc(st.name)} <em>×${S.stims[k] || 0}</em></b><small>${esc(st.desc)}${used ? ' <u>Уже в крови</u>' : ''}</small></button>`;
    }).join('') + `<div class="sm-warn">Три разных стимулятора за ход — коктейль: сила ×2, затем остановка сердца.</div>`;
    menu.classList.add('show');
    menu.querySelectorAll('.sm-i').forEach(b => b.onclick = async ev => {
      ev.stopPropagation();
      const k = b.dataset.k;
      menu.classList.remove('show');
      if (k === 'nocturine') { setMode('nocturine'); return; }
      const distinct = Object.keys(u.turnStims || {}).length;
      const run = async () => { await G.useStim(u, k); afterAction(); UI.hint('stim'); };
      if (distinct >= 2 && !(u.turnStims || {})[k]) UI.confirm('Третий стимулятор за ход — это коктейль. Сердце остановится в начале хода после следующего. Колоть?', run);
      else run();
    });
  }

  function setMode(m) {
    const u = UI.sel;
    if (UI.mode === m) { UI.mode = null; clearOverlays(); reselect(); return; }
    UI.mode = m;
    R.ov.reach = null; R.ov.targets = null; R.ov.path = null;
    if (m === 'bore') R.ov.special = G.boreTargets(u);
    else if (m === 'torch') R.ov.special = G.torchTargets(u);
    else if (m === 'nocturine') R.ov.special = G.stimTargets(u).map(o => [o.c, o.r]);
    UI.toast({ bore: 'Выберите стену для бурения', torch: 'Выберите газовый гекс', nocturine: 'Выберите соседнего противника' }[m], 'info');
    buildActions();
  }

  function clearOverlays() { R.ov = { sel: UI.sel, objectives: objectiveHexes() }; }
  function objectiveHexes() {
    const S = G.state();
    if (!S) return [];
    const out = [];
    S.m.objectives.forEach((o, i) => {
      if (G.objStatus(o, i) === 'done') return;
      (o.tags || []).forEach(t => { const s = S.structs.find(x => x.tag === t); if (s && (s.owner !== 'player' || o.type === 'hold')) out.push([s.c, s.r]); });
      if (o.exitTag) { const s = S.structs.find(x => x.tag === o.exitTag); if (s) out.push([s.c, s.r]); }
    });
    return out;
  }

  function select(u) {
    UI.sel = u; UI.inspect = null; UI.mode = null; UI.pending = null; UI.lastHoverKey = null;
    $('#stim-menu').classList.remove('show');
    clearOverlays();
    if (u && u.fac === 'player') {
      UI.reach = G.reach(u);
      UI.targets = G.targets(u);
      R.ov.reach = G.canMove(u) ? UI.reach : null;
      R.ov.targets = UI.targets;
      A.sfx('select');
    }
    R.ov.sel = u;
    refresh();
  }
  function reselect() { if (UI.sel && !UI.sel.dead && !UI.sel.evac) select(UI.sel); else { UI.sel = null; clearOverlays(); refresh(); } }
  async function afterAction() {
    const S = G.state();
    if (S.over) return;
    if (UI.sel && (UI.sel.dead || UI.sel.evac)) UI.sel = null;
    reselect();
  }
  function nextUnit() {
    const idle = G.idleUnits();
    if (!idle.length) { select(null); UI.hint('endturn'); return; }
    let i = UI.sel ? idle.indexOf(UI.sel) : -1;
    const u = idle[(i + 1) % idle.length];
    select(u);
    R.centerOn(u.c, u.r);
  }

  let endArmed = 0;
  async function endTurnClick() {
    const S = G.state();
    if (S.phase !== 'player' || G.busy || S.over) return;
    const idle = G.idleUnits().filter(u => G.canMove(u) || G.canAttack(u));
    if (idle.length && Date.now() - endArmed > 2500) {
      endArmed = Date.now();
      UI.toast(`Ещё ${idle.length} юнит(ов) с ходом. Нажмите «Конец хода» ещё раз.`, 'warn');
      return;
    }
    endArmed = 0;
    A.sfx('endturn');
    select(null);
    UI.hint('none');
    const p = G.endTurn();
    refresh();
    await p;
    if (!S.over) {
      UI.autosave();
      refresh();
      const hero = S.units.find(u => u.hero && !u.dead && !u.evac);
      if (S.turn === 2 && S.m.id === 1) UI.hint('stims1');
      void hero;
    }
  }

  /* ---------- Ввод на карте ---------- */
  const ptrs = {};
  let drag = null, pinch = null;
  UI.bindInput = function () {
    const cv = $('#game');
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      if (UI.current !== 'game') return;
      A.init();
      cv.setPointerCapture(e.pointerId);
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      const ids = Object.keys(ptrs);
      if (ids.length === 2) {
        const a = ptrs[ids[0]], b = ptrs[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: R.cam.z };
        drag = null;
      } else drag = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y, moved: false, button: e.button, type: e.pointerType };
    });
    cv.addEventListener('pointermove', e => {
      if (UI.current !== 'game') return;
      if (ptrs[e.pointerId]) ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      const ids = Object.keys(ptrs);
      if (pinch && ids.length === 2) {
        const a = ptrs[ids[0]], b = ptrs[ids[1]];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        R.cam.z = U.clamp(pinch.z * d / pinch.d, 0.45, 1.8);
        R.clampCam();
        return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > (drag.type === 'touch' ? 10 : 6)) drag.moved = true;
        if (drag.moved) { R.cam.x = drag.cx - dx / R.cam.z; R.cam.y = drag.cy - dy / R.cam.z; R.cam.tx = null; R.clampCam(); }
      }
      if (e.pointerType !== 'touch') hover(e.clientX, e.clientY);
    });
    const up = e => {
      if (UI.current !== 'game') { delete ptrs[e.pointerId]; return; }
      delete ptrs[e.pointerId];
      if (pinch) { if (Object.keys(ptrs).length < 2) pinch = null; drag = null; return; }
      if (drag && !drag.moved) {
        if (drag.button === 2) cancel();
        else tap(e.clientX, e.clientY, e.pointerType === 'touch');
      }
      drag = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { delete ptrs[e.pointerId]; drag = null; pinch = null; });
    cv.addEventListener('wheel', e => {
      if (UI.current !== 'game') return;
      e.preventDefault();
      const before = R.toWorld(e.clientX, e.clientY);
      R.cam.z = U.clamp(R.cam.z * (e.deltaY > 0 ? 0.9 : 1.1), 0.45, 1.8);
      const after = R.toWorld(e.clientX, e.clientY);
      R.cam.x += before[0] - after[0]; R.cam.y += before[1] - after[1]; R.cam.tx = null;
      R.clampCam();
    }, { passive: false });
    R.keys = {};
    const keymap = { ArrowLeft: 'left', a: 'left', ф: 'left', ArrowRight: 'right', d: 'right', в: 'right', ArrowUp: 'up', w: 'up', ц: 'up', ArrowDown: 'down', s: 'down', ы: 'down' };
    window.addEventListener('keydown', e => {
      if (UI.current !== 'game' || UI.dialogOpen) return;
      if ($('#modal').classList.contains('show')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (keymap[k] && !(k === 's' && UI.sel && e.shiftKey)) { R.keys[keymap[k]] = true; }
      if (k === ' ' || k === 'Enter') { e.preventDefault(); endTurnClick(); }
      else if (k === 'Tab') { e.preventDefault(); nextUnit(); }
      else if (k === 'Escape') { if (UI.sel || UI.mode) cancel(); else pauseMenu(); }
      else if (k === 'u' || k === 'г') { if (G.undo()) reselect(); }
      else if (k === 'g' || k === 'п') { UI.save.settings.grid = !UI.save.settings.grid; applySettings(); UI.persist(); }
      else if (k === '+' || k === '=') R.cam.z = U.clamp(R.cam.z * 1.15, 0.45, 1.8);
      else if (k === '-') R.cam.z = U.clamp(R.cam.z / 1.15, 0.45, 1.8);
      else if (k === 'z' || k === 'я') { if (UI.sel && UI.sel.fac === 'player') { G.wait(UI.sel); nextUnit(); } }
      else if (k === 'r' || k === 'к') { if (UI.sel && G.resupplyInfo(UI.sel)) { G.resupply(UI.sel); afterAction(); } }
      else if (k === 'c' || k === 'с') { if (UI.sel && UI.sel.scanLeft) G.scan(UI.sel); }
      else if (k === 'b' || k === 'и') { if (UI.sel && G.boreTargets(UI.sel).length) setMode('bore'); }
      else if (k === 'f' || k === 'а') { if (UI.sel && G.torchTargets(UI.sel).length) setMode('torch'); }
      else if (k === 'x' || k === 'ч') { if (UI.sel && UI.sel.fac === 'player' && D.STIM_ORDER.some(s => G.canStim(UI.sel, s))) toggleStims(); }
    });
    window.addEventListener('keyup', e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (keymap[k]) R.keys[keymap[k]] = false;
    });
    G.on('changed', () => { if (UI.current === 'game') { R.ov.objectives = objectiveHexes(); if (UI.sel && !G.busy) { /* */ } refresh(); } });
    G.on('turn', () => { UI.sel = null; clearOverlays(); refresh(); });
    G.on('over', ov => setTimeout(() => UI.finish(ov), G.fast ? 0 : 900));
    G.on('scan', () => { if (UI.sel) reselect(); });
  };

  function cancel() {
    UI.mode = null; UI.pending = null;
    $('#stim-menu').classList.remove('show');
    $('#forecast').classList.remove('show');
    select(null);
  }

  function hover(sx, sy) {
    const S = G.state();
    if (!S) return;
    const h = R.hexAtScreen(sx, sy);
    const inb = G.inb(h[0], h[1]);
    const key = inb ? h[0] + ',' + h[1] + ',' + (UI.sel ? UI.sel.id : 0) : '';
    if (key === UI.lastHoverKey) return;
    UI.lastHoverKey = key;
    UI.hoverHex = inb ? h : null;
    R.ov.hover = inb ? h : null; R.ov.hoverKind = null; R.ov.path = null;
    const fc = $('#forecast');
    fc.classList.remove('show');
    UI.inspect = null;
    if (!inb) { refresh(); return; }
    const u = UI.sel;
    const other = G.unitAt(h[0], h[1]);
    if (other && (other.fac === 'player' || G.seen(other)) && other !== u) UI.inspect = other;
    if (u && u.fac === 'player' && S.phase === 'player' && !UI.mode) {
      const tg = (UI.targets || []).find(t => (t.unit && t.unit.c === h[0] && t.unit.r === h[1]) || (t.gas && t.gas[0] === h[0] && t.gas[1] === h[1] && !G.unitAt(h[0], h[1])));
      if (tg) {
        R.ov.hoverKind = 'attack';
        showForecast(u, tg, sx, sy);
      } else if (UI.reach && G.canMove(u)) {
        const n = UI.reach[G.idx(h[0], h[1])];
        if (n && n.end && G.idx(h[0], h[1]) !== G.idx(u.c, u.r)) { R.ov.hoverKind = 'move'; R.ov.path = G.pathTo(UI.reach, G.idx(h[0], h[1])); }
      }
    }
    refresh();
  }

  function showForecast(u, tg, sx, sy) {
    const fc = $('#forecast');
    if (tg.gas) {
      fc.innerHTML = `<b>ПОДЖЕЧЬ ГАЗ</b><span>Взрыв: 5 на гексе, 3 рядом. Цепная реакция по газу.</span>`;
    } else {
      const f = G.forecast(u, tg.unit);
      const T = G.T(tg.unit);
      fc.innerHTML = `<b>${esc(tg.unit.hero ? tg.unit.name : T.name)}</b>
        <span>Урон: <em class="r">${f.lo}–${f.hi}</em> из ${tg.unit.hp}${f.kill ? ' · <em class="k">УНИЧТОЖЕНИЕ</em>' : ''}</span>
        <span>Ответный огонь: <em>${f.chi ? f.clo + '–' + f.chi : 'нет'}</em></span>
        <span class="dim">Защита цели: ${G.defBonus(tg.unit) >= 0 ? '+' : ''}${Math.round(G.defBonus(tg.unit))}%${tg.unit.hits ? ' · перегрузка +' + (tg.unit.hits * 15) + '%' : ''}${tg.unit.fac === 'civ' ? ' · <em class="r">ГРАЖДАНСКИЙ</em>' : ''}</span>`;
    }
    const [w, h] = R.size();
    fc.style.left = Math.min(w - 250, sx + 18) + 'px';
    fc.style.top = Math.max(60, Math.min(h - 260, sy - 20)) + 'px';
    fc.classList.add('show');
  }

  async function tap(sx, sy, touch) {
    const S = G.state();
    if (!S || S.over || G.busy || S.phase !== 'player' || UI.dialogOpen) return;
    const h = R.hexAtScreen(sx, sy);
    if (!G.inb(h[0], h[1])) { cancel(); return; }
    UI.hoverHex = h;
    $('#stim-menu').classList.remove('show');
    const u = UI.sel;
    const other = G.unitAt(h[0], h[1]);
    // спецрежимы
    if (UI.mode && u) {
      const m = UI.mode;
      const ok = (R.ov.special || []).some(p => p[0] === h[0] && p[1] === h[1]);
      UI.mode = null; R.ov.special = null;
      if (ok) {
        G.busy = true;
        try {
          if (m === 'bore') await G.bore(u, h[0], h[1]);
          else if (m === 'torch') await G.torch(u, h[0], h[1]);
          else if (m === 'nocturine') await G.useStim(u, 'nocturine', other);
        } finally { G.busy = false; }
      }
      afterAction();
      return;
    }
    if (u && u.fac === 'player') {
      const tg = (UI.targets || []).find(t => (t.unit && t.unit.c === h[0] && t.unit.r === h[1]) || (t.gas && t.gas[0] === h[0] && t.gas[1] === h[1] && !other));
      if (tg) {
        const key = h[0] + ',' + h[1];
        if (touch && UI.pending !== key) { UI.pending = key; R.ov.hover = h; R.ov.hoverKind = 'attack'; showForecast(u, tg, sx, sy); UI.toast('Коснитесь цели ещё раз для огня', 'info'); return; }
        UI.pending = null;
        $('#forecast').classList.remove('show');
        if (tg.unit && tg.unit.fac === 'civ' && !UI.civWarned) {
          UI.civWarned = true;
          UI.confirm('Это гражданский. Регламент разрешает. Открыть огонь?', () => doAttack(u, tg));
          return;
        }
        await doAttack(u, tg);
        return;
      }
      if (other && other.fac === 'player' && other !== u) { select(other); return; }
      const j = G.idx(h[0], h[1]);
      if (UI.reach && G.canMove(u) && UI.reach[j] && UI.reach[j].end && j !== G.idx(u.c, u.r)) {
        G.busy = true;
        R.ov.reach = null; R.ov.targets = null; R.ov.path = null;
        try { await G.move(u, h[0], h[1], UI.reach); } finally { G.busy = false; }
        afterAction();
        UI.hint(G.T(u).noMoveFire ? 'nomovefire' : 'moved');
        if (!u.dead && !u.evac && !G.canAttack(u) && !G.canMove(u)) setTimeout(() => { if (UI.sel === u) nextUnit(); }, 350);
        return;
      }
      if (other === u) { cancel(); return; }
      if (other && G.seen(other)) { UI.inspect = other; refresh(); return; }
      cancel();
      return;
    }
    if (other && other.fac === 'player') { select(other); UI.hint('selected'); return; }
    if (other && G.seen(other)) { select(null); UI.inspect = other; R.ov.sel = other; refresh(); return; }
    cancel();
  }

  async function doAttack(u, tg) {
    G.busy = true;
    R.ov.reach = null; R.ov.targets = null; R.ov.path = null;
    try { await G.attack(u, tg.gas ? tg : tg.unit); } finally { G.busy = false; }
    afterAction();
    UI.hint('attacked');
    if (!u.dead && !u.evac && !G.canAttack(u) && !G.canMove(u)) setTimeout(() => { if (UI.sel === u) nextUnit(); }, 450);
  }

  /* ---------- Подсказки ---------- */
  const HINTS = {
    start: 'Выберите бойца — щёлкните по нему. Зелёные гексы — куда он дойдёт за ход. Жёлтые кольца — цели операции.',
    selected: 'Щёлкните зелёный гекс — движение. Красная рамка — цель в зоне поражения: наведите для прогноза, щёлкните — огонь. Жёлтая рамка на пути — зона контроля врага: там придётся остановиться.',
    moved: 'Пехота захватывает строения, просто войдя на гекс. Местность защищает: торосы +30%, базальт +40%, колонии +40%. Отменить перемещение — «Отмена» (U).',
    nomovefire: 'Пулемётчики и снайперы не стреляют после движения — сначала огонь, потом ничего. Или ставьте их заранее.',
    attacked: 'Каждая следующая атака по той же цели за ход сильнее на 15% — «перегрузка». Так пробивают «Панцирь».',
    endturn: 'Все юниты походили. «Конец хода» — кнопка справа внизу или Пробел. Перетаскивание — обзор, колесо — масштаб.',
    stims1: 'Стимуляторы — кнопка «Стим» у выбранного бойца. Три разных за один ход — «коктейль»: огромная сила, затем остановка сердца.',
    regen: 'Актив погиб. Через 2 хода новое тело прибудет на точку высадки — с тем же рангом. Но каждая регенерация тратит НОРМУ РАСХОДА ПЛОТИ. Перерасход — операция свёрнута.',
    dna: 'На месте гибели осталось тело. Если на него зайдёт вражеский пехотинец — ДНК утрачена (+1 к расходу). Своя пехота уносит тело, санитары возвращают норму.',
    o2: 'Под льдом счётчик ходов — это КИСЛОРОД. Кончится — операция провалена. Свет фонарей и ламп — всё, что вы видите.',
    gas: 'Газовые участки (метан, этилен) можно поджечь: выстрелом (наведите на газовый гекс в радиусе атаки) или паяльной лампой рядом. Взрыв бьёт всех — и ваших тоже.',
    scan: 'Геосканер подсветил радиус 6 до следующего хода — включая нематод, затаившихся во льду.',
    stim: 'Стимулятор в крови. Следите за откатом: иконка ↓ над бойцом.',
    hold: 'Задача на удержание: победа засчитывается в конце указанного хода, если объекты ваши. Потеря штаба — провал.'
  };
  UI.hint = function (id) {
    const box = $('#hint');
    if (!box) return;
    if (id === 'none') { box.classList.remove('show'); return; }
    if (!UI.save.settings.hints || !HINTS[id] || UI.save.hintsSeen[id]) return;
    UI.save.hintsSeen[id] = 1; UI.persist();
    box.innerHTML = `<b>ПОДСКАЗКА</b><span>${esc(HINTS[id])}</span><button>Понятно</button>`;
    box.classList.add('show');
    box.querySelector('button').onclick = e => { e.stopPropagation(); box.classList.remove('show'); };
  };
  G.on('log', (t) => { if (/деактивирован/.test(t)) { UI.hint('regen'); setTimeout(() => UI.hint('dna'), 9000); } });

  /* ---------- Пауза ---------- */
  function pauseMenu() {
    const md = $('#modal');
    const S = G.state();
    md.innerHTML = `<div class="modal-box pause"><div class="modal-title">ПАУЗА · ${esc(S.m.title)}</div>
      <button class="btn" data-a="resume">Продолжить</button>
      <button class="btn" data-a="obj">Задачи операции</button>
      <button class="btn" data-a="settings">Настройки</button>
      <button class="btn" data-a="restart">Начать операцию заново</button>
      <button class="btn" data-a="exit">Сохранить и выйти в меню</button></div>`;
    md.classList.add('show');
    md.querySelectorAll('button').forEach(b => b.onclick = () => {
      A.sfx('click');
      md.classList.remove('show');
      const a = b.dataset.a;
      if (a === 'obj') $('#objective').classList.add('open');
      if (a === 'settings') UI.buildSettings(true);
      if (a === 'restart') UI.confirm('Начать операцию заново?', () => { UI.save.mid = null; UI.persist(); UI.briefing(S.mi); });
      if (a === 'exit') { UI.autosave(); A.ambient(null); UI.buildMenu(); UI.show('menu'); A.music(true); }
    });
  }

  /* ---------- Итоги ---------- */
  UI.finish = async function (ov) {
    const S = G.state();
    if (UI.current !== 'game') return;
    A.ambient(null);
    A.sfx(ov.win ? 'victory' : 'defeat');
    const m = S.m;
    const eff = G.efficiency();
    const grade = D.GRADES.find(g => eff >= g.min);
    const sv = UI.save;
    if (ov.win) {
      if (m.win && K.story[m.win]) await UI.storyPages(m.win, { last: 'Дальше' });
      sv.unlocked = Math.max(sv.unlocked, Math.min(10, m.id + 1));
      const prev = sv.done[m.id];
      if (!prev || prev.eff < eff) sv.done[m.id] = { eff };
      const hero = S.units.find(u => u.hero);
      const hx = S.regenQueue.find(q => q.hero);
      const xp = hero && !hero.dead ? hero.xp : hx ? hx.xp : (hero ? hero.xp : sv.heroXP);
      sv.heroXP = Math.max(sv.heroXP, xp);
      sv.heroDeaths += S.stats.heroDeaths;
      sv.mid = null;
      UI.persist();
    } else {
      sv.mid = null; UI.persist();
    }
    const scr = $('#screen-debrief');
    const st = S.stats;
    scr.innerHTML = `<div class="debrief ${ov.win ? 'win' : 'lose'}">
      <div class="db-h">${ov.win ? 'ОТЧЁТ О ВЫПОЛНЕНИИ КОНТРАКТА' : 'ОПЕРАЦИЯ ПРОВАЛЕНА'}</div>
      <h1>${esc(m.title)}</h1>
      ${ov.win ? '' : `<div class="db-reason">${esc(ov.reason || '')}</div>`}
      <div class="db-grid">
        <div><small>Ходов</small><b>${S.turn}</b></div>
        <div><small>Уничтожено</small><b>${st.kills}</b></div>
        <div><small>Расход плоти</small><b>${S.norm.max ? S.norm.used + ' / ' + S.norm.max : '—'}</b></div>
        <div><small>Регенераций</small><b>${st.regens}</b></div>
        <div><small>Безвозвратные потери</small><b>${st.losses}</b></div>
        <div><small>ДНК утрачено</small><b>${st.dnaLost}</b></div>
        <div><small>Передозировки</small><b>${st.overdoses}</b></div>
        <div><small>Смертей героя</small><b>${st.heroDeaths}</b></div>
      </div>
      <div class="db-obj">${m.objectives.map((o, i) => { const s = S.objDone[i] ? 'done' : (S.objFail[i] || G.objStatus(o, i) === 'fail') ? 'fail' : G.objStatus(o, i); return `<div class="ol ${s}"><b>${s === 'done' ? '✓' : s === 'fail' ? '✗' : '·'}</b> ${esc(o.text)}</div>`; }).join('')}</div>
      ${ov.win ? `<div class="db-grade" style="color:${grade.color}">ЭФФЕКТИВНОСТЬ: ${eff}% — ${grade.name}</div>` : ''}
      <div class="db-foot">${ov.win ? `Журнал учёта смертей К-47: <b>${sv.heroDeaths}</b>` : 'Затраты на цикл — четыре тысячи двести кредитов.'}</div>
      <div class="db-btns">${ov.win ? `<button class="btn" id="db-menu">В меню</button><button class="btn primary big" id="db-next">${m.id < 10 ? 'Далее' : 'Эпилог'}</button>` : `<button class="btn" id="db-menu">В меню</button><button class="btn primary big" id="db-retry">Повторить</button>`}</div>
    </div>`;
    UI.show('debrief');
    const nx = scr.querySelector('#db-next');
    if (nx) nx.onclick = async () => {
      A.sfx('click');
      if (m.interlude && K.story[m.interlude]) await UI.storyPages(m.interlude, { last: 'Дальше' });
      if (m.perk && sv.perks.indexOf(m.perk) < 0) { sv.perks.push(m.perk); UI.persist(); await perkScreen(m.perk); }
      if (m.id >= 10) return UI.ending();
      UI.briefing(m.id);
    };
    const rt = scr.querySelector('#db-retry');
    if (rt) rt.onclick = () => { A.sfx('click'); UI.briefing(S.mi); };
    scr.querySelector('#db-menu').onclick = () => { A.sfx('click'); UI.buildMenu(); UI.show('menu'); A.music(true); };
  };

  function perkScreen(id) {
    return new Promise(res => {
      const p = D.PERKS[id];
      const scr = $('#screen-story');
      UI.show('story');
      scr.innerHTML = `<div class="story-box perk"><div class="story-title">ПЛАКАЛЬЩИКИ</div>
        <div class="perk-card"><div class="perk-who">${esc(p.who)}</div><div class="perk-name">«${esc(p.name)}»</div><div class="perk-desc">${esc(p.desc)}</div></div>
        <p class="perk-note">Система не знает, что искать. Она видит только цифры.</p>
        <div class="story-foot"><span></span><button class="btn primary" id="pk-ok">Принять</button></div></div>`;
      A.sfx('capture');
      scr.querySelector('#pk-ok').onclick = () => { A.sfx('click'); res(); };
    });
  }

  /* ---------- Финал ---------- */
  UI.ending = async function () {
    UI.save.finished = true; UI.persist();
    A.music(true);
    await UI.storyPages('epilogue', { last: 'Дальше' });
    await UI.storyPages('after', { last: 'Дальше' });
    const scr = $('#screen-ending');
    scr.innerHTML = `<div class="ending">
      <div class="door"><div class="door-sign">ВЫХОД</div><div class="door-handle"></div></div>
      <p class="end-q">Он стоял перед дверью с надписью «Выход» и не решался открыть её.</p>
      <button class="btn primary big" id="end-open">Открыть дверь</button>
    </div>`;
    UI.show('ending');
    scr.querySelector('#end-open').onclick = () => {
      A.sfx('hiss');
      scr.querySelector('.ending').classList.add('open');
      setTimeout(() => {
        scr.innerHTML = `<div class="credits">
          <div class="cr-t">К-47</div><div class="cr-s">НОРМЫ РАСХОДА ПЛОТИ</div>
          <p>Камушек перейдёт к следующему.</p>
          <div class="cr-list">
            <div>По мотивам книги «К-47. Нормы расхода плоти. Цикл 48.»</div>
            <div>Журнал учёта смертей К-47: <b>${UI.save.heroDeaths}</b></div>
            <div>Плакальщики: ${UI.save.perks.map(p => esc(D.PERKS[p].who)).join(' · ') || '—'}</div>
            <div>В досье открыт документ «Регламент № К-00/Р».</div>
          </div>
          <button class="btn primary" id="cr-menu">В меню</button></div>`;
        scr.querySelector('#cr-menu').onclick = () => { A.sfx('click'); UI.buildMenu(); UI.show('menu'); };
      }, 2200);
    };
  };
})();
