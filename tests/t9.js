const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(600);
  const check = (n, c, x = '') => console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : ''));
  await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(150);
  // pixels rougeâtres autour d'un point (coordonnées écran)
  const redAt = (x, y, r = 4) => page.evaluate(([x, y, r]) => { const c = document.getElementById('cv'), b = c.getBoundingClientRect(), g = c.getContext('2d'); const d = g.getImageData(Math.round(x - b.left) - r, Math.round(y - b.top) - r, 2 * r + 1, 2 * r + 1).data; let best = null, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i] - d[i + 1] > 50) { n++; if (!best || d[i + 1] < best[1]) best = [d[i], d[i + 1], d[i + 2]]; } return { n, best }; }, [x, y, r]);
  const setDur = s => page.evaluate(v => { const i = document.getElementById('laserDur'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, s);
  const stroke = async (pts, wait = 8) => { await page.mouse.move(...pts[0]); await page.mouse.down(); for (const p of pts.slice(1)) { await page.mouse.move(...p, { steps: 6 }); await page.waitForTimeout(wait); } await page.mouse.up(); };

  // 1. curseur de durée
  await page.keyboard.press('k');
  const ui = await page.evaluate(() => { const g = document.querySelector('[data-g="laser"]'), r = g.getBoundingClientRect(); return { vis: r.width > 0, val: document.getElementById('laserVal').textContent, v: document.getElementById('laserDur').value }; });
  check('slider visible with laser, default 5 s', ui.vis && /^5 s$/.test(ui.val) && ui.v === '5', JSON.stringify(ui));
  await page.screenshot({ path: 'shot-laser-ui.png', clip: { x: 60, y: 50, width: 1060, height: 70 } });
  await page.keyboard.press('p'); check('slider hidden with pen', await page.evaluate(() => document.querySelector('[data-g="laser"]').getBoundingClientRect().width === 0));
  await page.keyboard.press('k');

  // 2. traits indépendants
  await stroke([[300, 300], [500, 300]]);                 // trait A
  await stroke([[500, 520], [700, 520]]);                 // trait B (démarre loin de la fin de A)
  const onA = await redAt(400, 300), onB = await redAt(600, 520), gap = await redAt(500, 410, 6), gap2 = await redAt(500, 360, 6);
  check('stroke A and B visible', onA.n > 0 && onB.n > 0, JSON.stringify([onA.n, onB.n]));
  check('no line joining A end to B start', gap.n === 0 && gap2.n === 0, JSON.stringify([gap.n, gap2.n]));
  const solid = onA.best; check('stroke is opaque (not pale) while it holds', solid && solid[0] > 240 && solid[1] < 110, JSON.stringify(solid));
  const t0 = Date.now();

  // 3. durée par défaut 5 s : plein à 3 s, estompé vers 4.5 s, effacé après 5.3 s
  await page.waitForTimeout(3000 - (Date.now() - t0)); const a3 = await redAt(400, 300);
  check('still fully visible at 3 s', a3.n > 0 && a3.best[1] < 110, JSON.stringify(a3.best));
  await page.waitForTimeout(4500 - (Date.now() - t0)); const a45 = await redAt(400, 300);
  check('fading at 4.5 s (paler than before)', a45.n === 0 || a45.best[1] > solid[1] + 15, JSON.stringify(a45));
  await page.waitForTimeout(5400 - (Date.now() - t0)); const a54 = await redAt(400, 300);
  check('gone at 5.4 s', a54.n === 0, JSON.stringify(a54));

  // 4. curseur : 1 s
  await setDur('1'); check('slider label updates', (await page.textContent('#laserVal')) === '1 s');
  await stroke([[300, 200], [500, 200]]); const t1 = Date.now();
  check('visible right after', (await redAt(400, 200)).n > 0);
  await page.waitForTimeout(1250 - (Date.now() - t1)); check('gone after 1.25 s with 1 s setting', (await redAt(400, 200)).n === 0);
  // point visible tant qu'on appuie, même immobile
  await page.mouse.move(800, 300); await page.mouse.down(); await page.waitForTimeout(1600);
  check('head dot stays while pressed and still (>1 s)', (await redAt(800, 300)).n > 0);
  await page.mouse.up(); await page.waitForTimeout(150);
  check('dot gone after release', (await redAt(800, 300)).n === 0);
  // simple clic : un point qui s'efface
  await page.mouse.click(900, 300); await page.waitForTimeout(250);
  check('click leaves a dot', (await redAt(900, 300)).n > 0);
  await page.waitForTimeout(1300); check('click dot fades away', (await redAt(900, 300)).n === 0);

  // 5. écrire un message (plusieurs traits), durée 8 s
  await setDur('8');
  const L = (x, y) => [x, y];
  await stroke([L(300, 600), L(300, 520), L(340, 520), L(340, 560), L(300, 560)]);                  // « P » grossier
  await stroke([L(380, 520), L(380, 600)]);                                                           // « I »
  await stroke([L(420, 520), L(470, 600), L(520, 520)]);                                              // « V »
  await page.waitForTimeout(200); await page.screenshot({ path: 'shot-laser-msg.png', clip: { x: 250, y: 480, width: 340, height: 150 } });
  check('message strokes all visible together', (await redAt(300, 540, 8)).n > 0 && (await redAt(380, 560, 8)).n > 0 && (await redAt(470, 600, 8)).n > 0);
  check('no link between letters', (await redAt(360, 600, 5)).n === 0 && (await redAt(400, 580, 4)).n === 0);
  // persistance du réglage
  const saved = await page.evaluate(() => localStorage.getItem('piverdraw.laserMs')); check('setting stored', saved === '8000', saved);
  await page.reload(); await page.waitForTimeout(700); await page.keyboard.press('k');
  check('setting restored after reload', (await page.inputValue('#laserDur')) === '8' && (await page.textContent('#laserVal')) === '8 s');
  // changement de page : les traits ne suivent pas
  await page.click('#btnFile'); await page.click('[data-act="new"]').catch(() => {}); await page.waitForTimeout(150);
  const dlg = await page.$('.dlg .btn.primary'); if (dlg) await dlg.click(); await page.waitForTimeout(150);
  await page.keyboard.press('k'); await stroke([[300, 300], [500, 300]]);
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(250);
  check('strokes cleared on page change', (await redAt(400, 300)).n === 0);
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
