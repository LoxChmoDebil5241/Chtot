// Скриншоты и проверка консоли: node tools/shot.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const out = process.argv[2] || '/tmp/claude-0/-home-user-Chtot/bd80d257-1617-58a5-a066-e76c2d350a51/scratchpad/shots';
require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await page.goto(url + '?auto&skip');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/menu.png' });
  const which = +(process.argv[3] || 1);
  await page.goto(url + '?auto&m=' + which);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out + '/brief' + which + '.png' });
  await page.click('#br-go');
  await page.waitForTimeout(1500);
  // закрыть диалоги
  for (let i = 0; i < 4; i++) { if (await page.isVisible('#dialog.show')) { await page.click('#dialog'); await page.waitForTimeout(300); await page.click('#dialog').catch(()=>{}); await page.waitForTimeout(300);} }
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/game' + which + '.png' });
  console.log(errs.join('\n') || 'no console errors');
  await browser.close();
})();
