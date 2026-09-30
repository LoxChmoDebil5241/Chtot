// Проверка потока победы: дебрифинг, интерлюдии, финал. node tools/flow.js <миссия>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const out = '/tmp/claude-0/-home-user-Chtot/bd80d257-1617-58a5-a066-e76c2d350a51/scratchpad/shots';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const m = +(process.argv[2] || 10);
  await page.goto(url + '?auto&m=' + m);
  await page.waitForTimeout(2500);
  await page.click('#br-go');
  await page.waitForTimeout(800);
  for (let i = 0; i < 8; i++) { if (await page.isVisible('#dialog.show')) { await page.click('#dialog'); await page.waitForTimeout(200); await page.click('#dialog').catch(()=>{}); await page.waitForTimeout(200);} }
  await page.evaluate(() => K.game.win());
  await page.waitForTimeout(1500);
  let n = 0;
  while (n++ < 30) {
    if (await page.isVisible('#story-next')) { await page.screenshot({ path: out + '/flow' + m + '_story' + n + '.png' }); await page.click('#story-next'); await page.waitForTimeout(300); continue; }
    if (await page.isVisible('#pk-ok')) { await page.screenshot({ path: out + '/flow' + m + '_perk.png' }); await page.click('#pk-ok'); await page.waitForTimeout(300); continue; }
    if (await page.isVisible('#db-next')) { await page.screenshot({ path: out + '/flow' + m + '_debrief.png' }); await page.click('#db-next'); await page.waitForTimeout(500); continue; }
    if (await page.isVisible('#end-open')) { await page.screenshot({ path: out + '/flow' + m + '_door.png' }); await page.click('#end-open'); await page.waitForTimeout(2800); await page.screenshot({ path: out + '/flow' + m + '_credits.png' }); break; }
    if (await page.isVisible('#br-go')) { await page.screenshot({ path: out + '/flow' + m + '_nextbrief.png' }); break; }
    await page.waitForTimeout(400);
  }
  const save = await page.evaluate(() => localStorage.getItem('k47.save.v1'));
  console.log(save.slice(0, 300));
  console.log(errs.join('\n') || 'no errors');
  await browser.close();
})();
