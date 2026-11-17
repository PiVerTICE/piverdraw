const { chromium } = require('playwright');
const out = (...a) => console.log(...a);
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
  const errs = []; const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  const check = (n, c, x = '') => out((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : ''));
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(700);
  const openClass = async id => { await page.click('#btnClass'); await page.click(`#classMenu [data-cls="${id}"]`); };
  // durée mémorisée
  await openClass('timer'); await page.click('.tm-pre [data-min="15"]'); await page.reload(); await page.waitForTimeout(700);
  await openClass('timer'); check('la dernière durée choisie est retrouvée', (await page.textContent('.tm-time')) === '15:00');
  await page.click('.tm-adj [data-adj="-60000"]'); await page.click('.tm-go'); await page.waitForTimeout(500);
  await page.setViewportSize({ width: 1280, height: 800 });
  // tableau noir + groupes en blanc
  await page.selectOption('#bgSel', 'noir');
  await openClass('draw'); await page.waitForSelector('.dr-ta'); await page.fill('.dr-ta', 'Ana\nBen\nChloé\nDavid\nÉmile\nFanny'); await page.click('[data-a="save"]'); await page.waitForSelector('.dr-pick');
  await page.click('.dr-seg [data-v="groups"]'); await page.click('[data-a="make"]'); await page.click('[data-a="board"]'); await page.waitForTimeout(200);
  const col = await page.evaluate(() => __piverdraw.page().objects.filter(o => o.t === 'text').map(o => o.color).slice(-3));
  check('sur tableau noir, les groupes sont écrits en clair', col.length === 3 && col.every(c => c.toLowerCase() === '#f7f7f2'), JSON.stringify(col));
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'shot-dark.png' });
  await openClass('curtain'); await page.waitForTimeout(100);
  const g = await page.$eval('.cu-grip', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await page.mouse.move(g[0] + 100, g[1] + 17); await page.mouse.down(); await page.mouse.move(g[0] + 100, g[1] + 330, { steps: 6 }); await page.mouse.up();
  await page.screenshot({ path: 'shot-dark-curtain.png' });
  // mise en page des fenêtres lors d'un redimensionnement : elles restent dans la scène
  await page.setViewportSize({ width: 700, height: 600 }); await page.waitForTimeout(400);
  const inside = await page.evaluate(() => [...document.querySelectorAll('.wdg')].filter(w => !w.hidden).map(w => { const r = w.getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect(); return r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1; }));
  check('après redimensionnement, les fenêtres restent dans la scène', inside.length === 2 && inside.every(Boolean), JSON.stringify(inside));
  out('errors', JSON.stringify(errs));
  await browser.close();
})();
