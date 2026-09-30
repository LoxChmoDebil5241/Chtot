// Отладочный снимок карты без тумана: node tools/shot2.js <миссия> [debug]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const out = '/tmp/claude-0/-home-user-Chtot/bd80d257-1617-58a5-a066-e76c2d350a51/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const m = +(process.argv[2] || 2);
  await page.evaluate(() => localStorage.setItem('k47.save.v1', JSON.stringify({ settings: { hints: false } }))).catch(() => {});
  await page.goto(url + '?auto&m=' + m);
  await page.waitForTimeout(2500);
  await page.click('#br-go');
  await page.waitForTimeout(800);
  for (let i = 0; i < 6; i++) { if (await page.isVisible('#dialog.show')) { await page.click('#dialog'); await page.waitForTimeout(250); await page.click('#dialog').catch(()=>{}); await page.waitForTimeout(250);} }
  if (process.argv[3] === 'debug') await page.evaluate(() => { K.render.debug = true; K.render.cam.z = 0.55; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + '/dbg' + m + '.png' });
  console.log(errs.join('\n') || 'ok');
  await browser.close();
})();
