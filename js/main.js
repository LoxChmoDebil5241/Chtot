/* К-47 — запуск */
'use strict';
(function () {
  const UI = K.ui, A = K.audio;

  function toMenu() { UI.buildMenu(); UI.show('menu'); A.music(true); }

  function boot() {
    UI.load();
    K.render.init(document.getElementById('game'));
    UI.bindInput();
    const q = new URLSearchParams(location.search);
    const splash = document.getElementById('splash');
    const go = () => {
      splash.classList.add('out');
      setTimeout(() => splash.remove(), 600);
      A.init();
      const m = +q.get('m');
      if (m >= 1 && m <= 10) { UI.briefing(m - 1); return; }
      if (UI.save.settings.intro && !q.has('skip')) UI.playIntro(toMenu);
      else toMenu();
    };
    splash.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', function k(e) { if (!document.body.contains(splash)) return; window.removeEventListener('keydown', k); go(); e.preventDefault(); });
    if (q.has('auto')) go();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
