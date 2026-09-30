// Снимки интро, досье, настроек, мобильной версии: node tools/screens.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const out = '/tmp/claude-0/-home-user-Chtot/bd80d257-1617-58a5-a066-e76c2d350a51/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/s_splash.png' });
  await page.mouse.click(600, 400);
  for (const t of [3, 10, 24, 36, 43]) { await page.waitForTimeout(t * 1000 - (page._last || 0)); page._last = t * 1000; await page.screenshot({ path: out + '/s_intro' + t + '.png' }); }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: out + '/s_menu.png' });
  await page.click('.mbtn[data-a=codex]');
  await page.waitForTimeout(500);
  await page.click('.cx-i[data-id=units]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/s_codex.png' });
  await page.close();
  // мобильная
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page.on('pageerror', e => errs.push('PAGEERROR(m): ' + e.message));
  await page.goto(url + '?auto&skip');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out + '/m_menu.png' });
  await page.goto(url + '?auto&m=3');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out + '/m_brief.png' });
  await page.click('#br-go');
  await page.waitForTimeout(1200);
  for (let i = 0; i < 6; i++) { if (await page.isVisible('#dialog.show')) { await page.tap('#dialog'); await page.waitForTimeout(250); await page.tap('#dialog').catch(()=>{}); await page.waitForTimeout(250);} }
  const hero = await page.evaluate(() => { const u = K.game.state().units.find(u => u.hero); const p = K.hex.center(u.c, u.r); return K.render.toScreen(p[0], p[1]); });
  await page.tap('#game', { position: { x: hero[0], y: hero[1] } });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + '/m_game.png' });
  console.log(errs.join('\n') || 'no errors');
  await browser.close();
})();
