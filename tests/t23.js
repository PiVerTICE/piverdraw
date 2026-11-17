// t23 : écriture manuscrite regroupée — les traits de stylo écrits à la suite et proches forment un groupe (un mot se déplace d'un bloc)
const H = require('./h.js');
(async () => {
  const T = await H(), { page, check } = T;
  const near = (a, b, e = 3) => Math.abs(a - b) < e;
  // un « trait de lettre » : petit zigzag rapide, en coordonnées monde
  const letter = async (x, y, w = 24, h = 40) => {
    const pts = [[x, y + h], [x + w * .25, y], [x + w * .5, y + h], [x + w * .75, y], [x + w, y + h]];
    const s = []; for (const p of pts) s.push(await T.world(...p));
    await page.mouse.move(...s[0]); await page.mouse.down();
    for (let i = 1; i < s.length; i++) await page.mouse.move(...s[i], { steps: 3 });
    await page.mouse.up(); await page.waitForTimeout(60);
  };
  const strokes = async () => (await T.objs()).filter(o => o.t === 'stroke');

  // ---- 1. un mot écrit en 4 traits rapides → un seul groupe, un pas d'annulation par trait ----
  await page.keyboard.press('p');
  const u0 = (await T.st()).undo;
  for (let i = 0; i < 4; i++) await letter(200 + i * 34, 200);
  let st = await strokes();
  check('4 strokes written', st.length === 4, String(st.length));
  check('the 4 strokes share one gid', !!st[0].gid && st.every(o => o.gid === st[0].gid), JSON.stringify(st.map(o => o.gid)));
  check('one undo step per stroke', (await T.st()).undo === u0 + 4);

  // ---- 2. sélection : un clic sur une lettre prend tout le mot, qui se déplace d'un bloc ----
  await page.keyboard.press('v');
  await T.click([200 + 34 + 6, 200 + 20]);                 // sur le 2e trait
  check('click on one letter selects the whole word', (await T.st()).sel === 4, JSON.stringify(await T.st()));
  const before = (await strokes()).map(o => o.pts[0][1]);
  await T.drag([200 + 34 + 6, 220], [200 + 34 + 6, 420]);
  const after = (await strokes()).map(o => o.pts[0][1]);
  check('the whole word moved together', after.every((y, i) => near(y - before[i], 200, 6)), JSON.stringify(after.map((y, i) => Math.round(y - before[i]))));

  // ---- 3. annuler le dernier trait ne défait pas le groupe des autres ----
  await page.keyboard.press('Escape'); await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(80);   // annule le déplacement
  await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(80);                                   // annule le 4e trait
  st = await strokes();
  check('undo removes only the last stroke, the rest stays grouped', st.length === 3 && st.every(o => o.gid && o.gid === st[0].gid));

  // ---- 4. après une pause, ou loin, ou au surligneur : pas de regroupement ----
  await T.fresh(); await page.keyboard.press('p');
  await letter(200, 200); await page.waitForTimeout(1700); await letter(234, 200);
  st = await strokes();
  check('pause > 1.5 s: separate strokes', st.length === 2 && !st[0].gid && !st[1].gid, JSON.stringify(st.map(o => o.gid)));
  await letter(900, 600);                                   // rapide mais loin
  st = await strokes();
  check('far away stroke: not grouped', st.length === 3 && !st[2].gid && !st[1].gid, JSON.stringify(st.map(o => o.gid)));
  await letter(200, 300); await letter(234, 300);           // deux traits rapides et proches : groupés…
  st = await strokes();
  check('two quick close strokes: grouped', st[3].gid && st[3].gid === st[4].gid);
  check('…without joining the earlier separate strokes', !st[0].gid && !st[1].gid && !st[2].gid);
  await page.keyboard.press('h'); await letter(200, 450); await letter(234, 450);
  st = await strokes();
  check('highlighter strokes are never grouped', st.length === 7 && !st[5].gid && !st[6].gid);

  // ---- 5. dégrouper sépare le mot ----
  await page.keyboard.press('v'); await T.click([200 + 6, 320]);
  check('word selected (2)', (await T.st()).sel === 2);
  await page.click('#selGroup'); await page.waitForTimeout(100);
  st = await strokes();
  check('Dégrouper: strokes are separate again', !st[3].gid && !st[4].gid);

  // ---- 6. persistance : le groupe survit à l'enregistrement et au rechargement du projet ----
  await T.fresh(); await page.keyboard.press('p'); await letter(300, 300); await letter(334, 300);
  const ser = await page.evaluate(() => JSON.stringify(__piverdraw.serialize()));
  await page.evaluate(s => __piverdraw.loadProject(__piverdraw.normalize(JSON.parse(s))), ser); await page.waitForTimeout(150);
  st = await strokes();
  check('gid kept after save/reload', st.length === 2 && st[0].gid && st[0].gid === st[1].gid);

  // ---- 7. mobile 360 px, tactile : même comportement ----
  await T.browser.close();
  const M = await H({ viewport: { width: 360, height: 740 }, touch: true });
  await M.page.keyboard.press('p');
  const tap = async (x, y) => { const a = await M.world(x, y), b = await M.world(x + 20, y + 30); const c = await M.page.context().newCDPSession(M.page);
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1] }] });
    for (let k = 1; k <= 4; k++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a[0] + (b[0] - a[0]) * k / 4, y: a[1] + (b[1] - a[1]) * k / 4 }] });
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await M.page.waitForTimeout(60); };
  await tap(300, 300); await tap(330, 300);
  const ms = (await M.objs()).filter(o => o.t === 'stroke');
  M.check('360 px touch: two quick strokes grouped', ms.length === 2 && ms[0].gid && ms[0].gid === ms[1].gid, JSON.stringify(ms.map(o => o.gid)));
  await M.page.screenshot({ path: 'shot-ink-360.png' });
  console.log('errors', JSON.stringify([...T.errors, ...M.errors])); await M.browser.close();
})();
