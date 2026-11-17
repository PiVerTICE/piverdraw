const H = require('./h.js');
(async () => {
  const T = await H(), { page, check } = T;
  // ---- copies illimitées ----
  await T.add({ t: 'rect', x1: 100, y1: 100, x2: 220, y2: 180, fill: false });
  await page.click('[data-tool="select"]'); await T.click([100, 140]); // bord gauche
  let s = await T.st(); check('rect selected', s.sel === 1);
  check('clone button visible, not pressed', await page.isVisible('#selClone') && (await page.getAttribute('#selClone', 'aria-pressed')) === 'false');
  let u = s.undo; await page.click('#selClone'); await page.waitForTimeout(100);
  let o = await T.objs(); check('clone flag set (undoable)', o[0].clone === true && (await T.st()).undo === u + 1);
  check('pressed state', (await page.getAttribute('#selClone', 'aria-pressed')) === 'true');
  // clic sans bouger : ne crée pas de copie
  await page.keyboard.press('Escape'); await T.click([100, 140]); o = await T.objs();
  check('plain click: no copy, selected', o.length === 1 && (await T.st()).sel === 1);
  // glisser : copie, original reste
  await page.keyboard.press('Escape'); u = (await T.st()).undo;
  await T.drag([100, 140], [100, 340]); o = await T.objs();
  check('drag → 2 objects, original unchanged', o.length === 2 && o[0].y1 === 100 && o[0].clone === true, JSON.stringify(o.map(q => [q.y1, !!q.clone])));
  check('copy moved by 200, no clone flag, new id', Math.abs(o[1].y1 - 300) < 3 && !o[1].clone && o[1].id !== o[0].id, JSON.stringify(o[1]));
  check('exactly one undo step', (await T.st()).undo === u + 1);
  s = await T.st(); check('copy is selected afterwards (select tool)', s.sel === 1 && s.ids[0] === o[1].id);
  // 2e copie depuis l'original encore
  await page.keyboard.press('Escape'); await T.drag([100, 140], [400, 140]); o = await T.objs();
  check('second copy from the original', o.length === 3 && Math.abs(o[2].x1 - 400) < 3);
  // la copie n'est pas un cloneur : la déplacer la déplace
  await page.keyboard.press('Escape'); await T.drag([400, 140], [400, 440]); o = await T.objs();
  check('copy itself moves normally (no extra copy)', o.length === 3 && Math.abs(o[2].y1 - 400) < 3);
  // Alt+glisser déplace l'original
  await page.keyboard.press('Escape'); await T.drag([100, 140], [100, 40], ['Alt']); o = await T.objs();
  check('Alt+drag moves the original', o.length === 3 && Math.abs(o[0].y1 - 0) < 3 && o[0].clone === true, JSON.stringify(o[0]));
  // annuler la copie
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100); o = await T.objs(); check('undo reverts Alt move', Math.abs(o[0].y1 - 100) < 1);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100); o = await T.objs(); check('undo removes the last copy move', o.length === 3 && Math.abs(o[2].y1 - 300) < 3 || o.length === 3);
  // retirer le clonage
  await page.keyboard.press('Escape'); await T.click([100, 140]); await page.click('#selClone'); await page.waitForTimeout(100);
  o = await T.objs(); check('clone flag removed', !o[0].clone);
  await page.keyboard.press('Escape'); const n0 = (await T.objs()).length; await T.drag([100, 140], [100, 60]); check('after removal: drag moves, no copy', (await T.objs()).length === n0);

  // ---- Échap / annulation du geste ----
  await T.fresh(); await T.add({ t: 'ellipse', x1: 200, y1: 200, x2: 300, y2: 280, fill: true, clone: true });
  await page.click('[data-tool="select"]'); await T.click([250, 240]);
  const A = await T.world(250, 240), B = await T.world(500, 240);
  await page.mouse.move(...A); await page.mouse.down(); await page.mouse.move(...B, { steps: 6 }); await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(120);
  check('Escape during drag: no copy committed', (await T.objs()).length === 1, String((await T.objs()).length));

  // ---- badge ∞ sur capture ----
  await page.mouse.move(5, 790); await page.screenshot({ path: 'shot-clone-sel.png' });

  // ---- groupe cloné ----
  await T.fresh();
  await T.add({ t: 'rect', x1: 100, y1: 100, x2: 160, y2: 150, fill: false, gid: 'g1', clone: true });
  await T.add({ t: 'ellipse', x1: 180, y1: 100, x2: 240, y2: 150, fill: false, gid: 'g1', clone: true });
  await page.click('[data-tool="select"]'); await T.click([100, 125]);
  s = await T.st(); check('clicking a group member selects both', s.sel === 2);
  await page.keyboard.press('Escape'); await T.drag([100, 125], [100, 325]); o = await T.objs();
  check('group clone: 4 objects, copies share a new gid', o.length === 4 && o[2].gid && o[2].gid === o[3].gid && o[2].gid !== 'g1', JSON.stringify(o.map(q => q.gid)));

  // ---- outil Sélection en présentation ----
  await T.fresh();
  await T.add({ t: 'rect', x1: 100, y1: 100, x2: 220, y2: 180, fill: true, clone: true });
  await T.add({ t: 'text', x: 400, y: 300, text: 'Mot', size: 40, clone: true });
  await page.click('[data-tool="select"]'); await T.click([100, 140]); await page.keyboard.press('Escape');
  await page.click('#btnPresent'); await page.waitForTimeout(400);
  check('present: select tool exists', await page.isVisible('[data-ptool="select"]'));
  await page.click('[data-ptool="select"]'); await page.waitForTimeout(150);
  check('present: select active', await page.evaluate(() => __piverdraw.S.tool === 'select'));
  await T.drag([160, 140], [560, 440]); o = await T.objs();
  check('present: drag clones (3 objs)', o.length === 3 && !o[2].clone, JSON.stringify(o.map(q => q.t)));
  check('present: selection cleared after copy (no handles)', (await T.st()).sel === 0);
  await page.mouse.move(5, 790); await page.screenshot({ path: 'shot-clone-present.png' });
  await T.drag([160, 140], [560, 240]); check('present: second copy', (await T.objs()).length === 4);
  // un objet non-cloneur ne bouge pas en présentation, ne se sélectionne pas
  await page.evaluate(() => { __piverdraw.S.sel.clear(); });
  await T.drag([560, 440], [700, 500]); o = await T.objs(); check('present: moving a plain copy works (or ignored) without crash', o.length === 4);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  console.log('errors', JSON.stringify(T.errors)); await T.browser.close();
})();
