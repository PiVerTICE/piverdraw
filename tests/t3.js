const { chromium, devices } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function mk(opts) {
    const ctx = await browser.newContext(opts);
    await ctx.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
    return page;
  }
  // desktop dark + help
  let page = await mk({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(700);
  await page.screenshot({ path: 'shot-dark.png' });
  await page.keyboard.press('h'); await page.waitForTimeout(100);
  const hl = await page.evaluate(() => __piverdraw.S.hlColor); console.log('hl color', hl);
  await page.click('#btnHelp'); await page.waitForTimeout(150); await page.screenshot({ path: 'shot-help.png' });
  await page.keyboard.press('Escape');
  await page.click('#btnFile'); await page.waitForTimeout(100); await page.screenshot({ path: 'shot-menu-dark.png' });
  // synthetic pen + touch events
  await page.keyboard.press('Escape');
  await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(150);
  await page.keyboard.press('p');
  const r = await page.evaluate(() => {
    const cv = document.getElementById('cv'), b = cv.getBoundingClientRect();
    const ev = (type, id, x, y, kind, pr) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, clientX: b.left + x, clientY: b.top + y, pressure: pr, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, isPrimary: true }));
    // pen stroke with varying pressure
    ev('pointerdown', 7, 300, 300, 'pen', .2);
    for (let i = 1; i <= 30; i++) ev('pointermove', 7, 300 + i * 10, 300 + Math.sin(i / 4) * 40, 'pen', .2 + i * .025);
    ev('pointerup', 7, 600, 300, 'pen', 0);
    const o1 = __piverdraw.page().objects[0];
    // touch after pen => pan, no stroke
    const v0 = { ...__piverdraw.view() };
    ev('pointerdown', 11, 400, 500, 'touch', .5); ev('pointermove', 11, 460, 540, 'touch', .5); ev('pointerup', 11, 460, 540, 'touch', 0);
    const v1 = { ...__piverdraw.view() };
    // two-finger pinch zoom
    ev('pointerdown', 21, 500, 400, 'touch', .5); ev('pointerdown', 22, 600, 400, 'touch', .5);
    ev('pointermove', 21, 450, 400, 'touch', .5); ev('pointermove', 22, 650, 400, 'touch', .5);
    ev('pointerup', 21, 450, 400, 'touch', 0); ev('pointerup', 22, 650, 400, 'touch', 0);
    const v2 = { ...__piverdraw.view() };
    return { n: __piverdraw.page().objects.length, vp: o1.vp, pts: o1.pts.length, p0: o1.pts[0][2], pEnd: o1.pts[o1.pts.length - 1][2], panned: [v1.tx - v0.tx, v1.ty - v0.ty], zoomRatio: v2.z / v1.z, g: !!(window.__piverdraw.S.ruler) };
  });
  console.log('pen/touch', JSON.stringify(r));
  await page.screenshot({ path: 'shot-pen.png' });
  // mobile
  page = await mk({ ...devices['Pixel 7'], colorScheme: 'light' });
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(700);
  await page.screenshot({ path: 'shot-mobile.png' });
  const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log('mobile overflow', JSON.stringify(ov));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})();
