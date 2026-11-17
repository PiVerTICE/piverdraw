const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(700);
  // make 3 boards
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('p');
    const box = await page.locator('#cv').boundingBox();
    await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.down(); await page.mouse.move(box.x + 400, box.y + 300, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(300);
    await page.click('#btnLib'); await page.waitForSelector('#libNew'); await page.click('#libNew'); await page.waitForTimeout(500);
  }
  const check = (n, c, x = '') => console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : ''));
  for (const w of [1280, 1024, 900, 800, 600, 412, 360]) {
    await page.setViewportSize({ width: w, height: w < 600 ? 800 : 700 }); await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const hdr = document.querySelector('header, .top, #top') || document.querySelector('#btnLib').closest('div');
      const b = document.querySelector('#btnLib').getBoundingClientRect();
      const all = [...document.querySelectorAll('#btnLib')].map(x => x.getBoundingClientRect());
      return { docW: document.documentElement.scrollWidth, vw: innerWidth, btn: [Math.round(b.left), Math.round(b.right), Math.round(b.width), Math.round(b.height)], visible: b.width > 0 && b.right <= innerWidth && b.left >= 0, lblVisible: getComputedStyle(document.querySelector('#btnLib .lbl')).display !== 'none' };
    });
    check('header @' + w + ' no overflow, Mes tableaux visible', m.docW <= m.vw && m.visible, JSON.stringify(m));
    if (w === 1280 || w === 412 || w === 360) await page.screenshot({ path: `shot-hdr-${w}.png`, clip: { x: 0, y: 0, width: w, height: 120 } });
  }
  // dialog on mobile
  await page.setViewportSize({ width: 360, height: 760 });
  await page.click('#btnLib'); await page.waitForSelector('.liblist .librow'); await page.waitForTimeout(300);
  const d = await page.evaluate(() => {
    const dlg = document.querySelector('.dlg.lib'), r = dlg.getBoundingClientRect();
    const btns = [...dlg.querySelectorAll('.libacts .btn')].map(b => { const q = b.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height), q.right <= innerWidth + 0.5]; });
    return { docW: document.documentElement.scrollWidth, vw: innerWidth, dw: dlg.scrollWidth, cw: dlg.clientWidth, left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), vh: innerHeight, btns };
  });
  check('dialog @360 fits, buttons >= 32px', d.docW <= d.vw && d.dw <= d.cw && d.btns.every(b => b[0] >= 32 && b[1] >= 32 && b[2]) && d.right <= d.vw, JSON.stringify(d));
  await page.screenshot({ path: 'shot-lib-360.png' });
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(300);
  await page.screenshot({ path: 'shot-lib-1280.png' });
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
