// Интерактивный прогон: выбор, движение, атака, конец хода. node tools/play.js <миссия>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const out = '/tmp/claude-0/-home-user-Chtot/bd80d257-1617-58a5-a066-e76c2d350a51/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error' && !/CERT|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const m = +(process.argv[2] || 1);
  await page.goto(url + '?auto&skip');
  await page.evaluate(() => { localStorage.setItem('k47.save.v1', JSON.stringify({ settings: { hints: false, speed: 2.5 } })); });
  await page.goto(url + '?auto&m=' + m);
  await page.waitForTimeout(2200);
  await page.click('#br-go');
  await page.waitForTimeout(700);
  const closeDialogs = async () => { for (let i = 0; i < 8; i++) { if (await page.isVisible('#dialog.show')) { await page.click('#dialog'); await page.waitForTimeout(200); await page.click('#dialog').catch(()=>{}); await page.waitForTimeout(200);} } };
  await closeDialogs();
  const scr = async (c, r) => page.evaluate(([c, r]) => { const p = K.hex.center(c, r); return K.render.toScreen(p[0], p[1]); }, [c, r]);
  // выбрать героя
  const hero = await page.evaluate(() => { const u = K.game.state().units.find(u => u.hero); return [u.c, u.r]; });
  let p = await scr(...hero);
  await page.mouse.click(p[0], p[1]);
  await page.waitForTimeout(400);
  // наведение на дальний достижимый гекс
  const dest = await page.evaluate(() => { const S = K.game.state(); const u = K.ui.sel; const R = K.ui.reach; let best = null, bd = -1; for (const k in R) { if (!R[k].end) continue; const c = k % S.W, r = (k / S.W) | 0; const d = K.hex.dist(u.c, u.r, c, r); if (d > bd) { bd = d; best = [c, r]; } } return best; });
  p = await scr(...dest);
  await page.mouse.move(p[0], p[1]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/play' + m + '_a.png' });
  await page.mouse.click(p[0], p[1]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/play' + m + '_b.png' });
  // конец хода x2
  for (let t = 0; t < 2; t++) {
    await page.click('#h-end'); await page.waitForTimeout(150); await page.click('#h-end');
    await page.waitForTimeout(600);
    await page.screenshot({ path: out + '/play' + m + '_ai' + t + '.png' });
    for (let i = 0; i < 40; i++) { await closeDialogs(); const ph = await page.evaluate(() => K.game.state().phase + (K.game.busy ? '!' : '')); if (ph === 'player') break; await page.waitForTimeout(500); }
  }
  await page.screenshot({ path: out + '/play' + m + '_c.png' });
  const st = await page.evaluate(() => { const S = K.game.state(); return { turn: S.turn, over: S.over, units: S.units.filter(u => !u.dead).length }; });
  console.log(JSON.stringify(st));
  console.log(errs.join('\n') || 'no errors');
  await browser.close();
})();
