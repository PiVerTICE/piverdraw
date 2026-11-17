// t26 : revue d'interface — indicateur d'enregistrement lisible, cibles ≥ 34 px, zoom réajusté au redimensionnement,
// téléphone : fondu de la barre d'outils, panneaux des pages et des réglages repliables, appui long qui affiche le nom d'un bouton
const H = require('./h.js');
(async () => {
  // ---------- 1. Ordinateur 1280 px ----------
  const T = await H(), { page, check } = T;
  await page.keyboard.press('p'); await T.drag([300, 300], [500, 340]); await page.waitForTimeout(900);
  const sv = await page.evaluate(() => { const e = document.getElementById('saveState'), r = e.getBoundingClientRect(); return { t: e.textContent, title: e.title, w: r.width, full: e.scrollWidth <= e.clientWidth + 1 }; });
  check('1280: save state short and complete, full sentence in the tooltip', sv.t === '✓ Enregistré' && sv.title === 'Enregistré dans ce navigateur' && sv.w > 50 && sv.full, JSON.stringify(sv));
  const small = await page.evaluate(() => [...document.querySelectorAll('.swatch, #snapChk, #bgSel, .zoom .btn, .pages-head .btn')]
    .filter(b => b.offsetParent).map(b => { const t = b.id === 'snapChk' ? b.closest('label') : b, r = t.getBoundingClientRect(); return [b.id || b.className, Math.round(r.width), Math.round(r.height)]; })
    .filter(([, w, h]) => w < 34 || h < 34));
  check('1280: swatches, checkbox row, Fond, zoom and page buttons ≥ 34 px', !small.length, JSON.stringify(small));
  check('1280: fold controls hidden on desktop', !(await page.isVisible('#propsMin')) && !(await page.isVisible('#pgMin')) && !(await page.isVisible('#pgMax')));
  // le zoom suit la fenêtre tant que l'utilisateur n'a pas zoomé
  const z0 = await page.evaluate(() => __piverdraw.view().z);
  await page.setViewportSize({ width: 900, height: 700 }); await page.waitForTimeout(250);
  const z1 = await page.evaluate(() => __piverdraw.view().z);
  check('resize: untouched view is refitted', z1 < z0 - .05, z0 + ' → ' + z1);
  await page.click('#zIn'); const z2 = await page.evaluate(() => __piverdraw.view().z);
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(250);
  check('resize: a zoom chosen by the user is kept', Math.abs(await page.evaluate(() => __piverdraw.view().z) - z2) < 1e-9);
  await page.click('#zFit'); await page.setViewportSize({ width: 1000, height: 800 }); await page.waitForTimeout(250);
  check('resize: after « Ajuster », refit again', Math.abs(await page.evaluate(() => __piverdraw.view().z) - z2) > .01);
  // la page commence sous le panneau des réglages
  const below = await page.evaluate(() => { const v = __piverdraw.view(), p = document.getElementById('props').getBoundingClientRect(), c = document.getElementById('cv').getBoundingClientRect(); return c.top + v.ty + __piverdraw.page().frame.y * v.z >= p.bottom; });
  check('fit: page starts below the settings panel', below);
  // fichier de stockage indisponible : message toujours lisible (« indisponible »)
  console.log('errors', JSON.stringify(T.errors)); await T.browser.close();

  // ---------- 2. Téléphone 360 px ----------
  const M = await H({ viewport: { width: 360, height: 740 }, touch: true }), p2 = M.page, ck = M.check;
  // barre d'outils : fondu à droite, puis à gauche une fois défilée
  let rc = await p2.evaluate(() => document.getElementById('rail').className);
  ck('360: toolbar fades on the right (more tools)', /more-r/.test(rc) && !/more-l/.test(rc), rc);
  await p2.evaluate(() => { const r = document.getElementById('rail'); r.scrollLeft = r.scrollWidth; }); await p2.waitForTimeout(100);
  rc = await p2.evaluate(() => document.getElementById('rail').className);
  ck('360: scrolled to the end, fade on the left only', /more-l/.test(rc) && !/more-r/.test(rc), rc);
  const laserIn = await p2.evaluate(() => { const b = document.querySelector('[data-tool="laser"]').getBoundingClientRect(); return b.right <= innerWidth; });
  ck('360: last tool reachable', laserIn);
  // panneau des pages : replié par défaut, une ligne avec compteur, précédente, suivante, nouvelle
  ck('360: pages pane folded by default', await p2.isVisible('#pgMax') && !(await p2.isVisible('#thumbs')) && /1 \/ 1/.test(await p2.textContent('#pgN')));
  const h0 = await p2.evaluate(() => document.getElementById('pagesPane').getBoundingClientRect().height);
  ck('360: folded pages bar is one row (≤ 44 px)', h0 <= 44, String(h0));
  await p2.click('#pgAdd2'); await p2.waitForTimeout(100);
  ck('360: + adds a page, counter 2 / 2', /2 \/ 2/.test(await p2.textContent('#pgN')) && await p2.isDisabled('#pgNext') && !(await p2.isDisabled('#pgPrev')));
  await p2.click('#pgPrev'); await p2.waitForTimeout(100);
  ck('360: previous page', (await p2.evaluate(() => __piverdraw.S.cur)) === 0 && /1 \/ 2/.test(await p2.textContent('#pgN')));
  await p2.click('#pgMax'); await p2.waitForTimeout(100);
  ck('360: unfold shows thumbnails and page tools', await p2.isVisible('#thumbs') && await p2.isVisible('#pgClear') && await p2.isVisible('#pgMin'));
  await p2.click('#pgMin'); await p2.waitForTimeout(100);
  ck('360: fold again', !(await p2.isVisible('#thumbs')));
  // réglages : repliés, il ne reste que les couleurs ; choix mémorisé
  await p2.click('[data-tool="pen"]');
  const ph0 = await p2.evaluate(() => document.getElementById('props').offsetHeight);
  await p2.click('#propsMin'); await p2.waitForTimeout(150);
  const ph1 = await p2.evaluate(() => document.getElementById('props').offsetHeight);
  ck('360: folded settings keep only the colours', ph1 < ph0 - 30 && await p2.isVisible('.swatch') && !(await p2.isVisible('#size')) && !(await p2.isVisible('#bgSel')), ph0 + ' → ' + ph1);
  ck('360: fold button says what it does', (await p2.getAttribute('#propsMin', 'aria-expanded')) === 'false' && /Plus de réglages/.test(await p2.textContent('#propsMin')));
  const sw = await p2.evaluate(() => { const g = document.getElementById('swatches').getBoundingClientRect(), s = [...document.querySelectorAll('#swatches .swatch')].map(b => b.getBoundingClientRect()); return { one: new Set(s.map(r => Math.round(r.top))).size === 1, w: s.every(r => r.width >= 34 && r.height >= 34), inside: g.right <= innerWidth }; });
  ck('360: 9 swatches of 34 px on one row', sw.one && sw.w && sw.inside, JSON.stringify(sw));
  const ov = await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  ck('360: no horizontal overflow', ov);
  await p2.reload(); await p2.waitForTimeout(700);
  ck('360: folds remembered after reload', (await p2.evaluate(() => document.getElementById('app').className)).includes('propmin') && !(await p2.isVisible('#thumbs')));
  await p2.click('#propsMin'); await p2.waitForTimeout(100);
  ck('360: unfold settings', await p2.isVisible('#size'));
  // appui long au doigt : bulle avec le nom, sans déclencher le bouton
  const cl = await p2.evaluate(() => __piverdraw.S.tool);
  const b = await p2.evaluate(() => { const r = document.querySelector('[data-tool="eraser"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const cdp = await M.ctx.newCDPSession(p2);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await touch('touchStart', [{ x: b[0], y: b[1] }]); await p2.waitForTimeout(700);
  const tip = await p2.evaluate(() => { const t = document.querySelector('.tip'); return t && !t.hidden ? t.textContent : null; });
  await touch('touchEnd', []); await p2.waitForTimeout(150);
  ck('360: long press shows the tool name without the shortcut', tip === 'Gomme', String(tip));
  ck('360: long press does not switch tool', (await p2.evaluate(() => __piverdraw.S.tool)) === cl);
  await touch('touchStart', [{ x: b[0], y: b[1] }]); await touch('touchEnd', []); await p2.waitForTimeout(150);
  ck('360: a short tap still works afterwards', (await p2.evaluate(() => __piverdraw.S.tool)) === 'eraser');
  await p2.screenshot({ path: 'shot-ui-360.png' });
  console.log('errors', JSON.stringify(M.errors)); await M.browser.close();

  // ---------- 3. Téléphone à l'horizontale 740 × 360 : réglages repliables aussi ----------
  const L = await H({ viewport: { width: 740, height: 360 }, touch: true });
  L.check('landscape phone: settings fold button visible', await L.page.isVisible('#propsMin'));
  console.log('errors', JSON.stringify(L.errors)); await L.browser.close();
})();
