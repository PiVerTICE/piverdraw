const H = require('./h.js');
(async () => {
  const T = await H(), { page, check } = T;
  const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;
  // ---- groupes ----
  await T.add({ t: 'rect', x1: 100, y1: 100, x2: 200, y2: 160, fill: true, color: '#d33' });
  await T.add({ t: 'ellipse', x1: 260, y1: 100, x2: 340, y2: 160, fill: true, color: '#36c' });
  await T.add({ t: 'rect', x1: 500, y1: 100, x2: 560, y2: 160, fill: true, color: '#3a3' });
  await page.click('[data-tool="select"]');
  check('Grouper hidden without selection', !(await page.isVisible('#selGroup')));
  await T.click([150, 130]); check('Grouper hidden with a single object', !(await page.isVisible('#selGroup')));
  await T.click([300, 130], ['Shift']); let s = await T.st(); check('shift-click: 2 selected', s.sel === 2);
  check('Grouper visible, not pressed', await page.isVisible('#selGroup') && (await page.getAttribute('#selGroup', 'aria-pressed')) === 'false');
  let u = s.undo; await page.click('#selGroup'); await page.waitForTimeout(100);
  let o = await T.objs(); check('grouped: same gid on the two, none on third, 1 undo', o[0].gid && o[0].gid === o[1].gid && !o[2].gid && (await T.st()).undo === u + 1);
  check('pressed (= Dégrouper)', (await page.getAttribute('#selGroup', 'aria-pressed')) === 'true' && /Dégrouper/.test(await page.getAttribute('#selGroup', 'aria-label')));
  await page.keyboard.press('Escape'); await T.click([150, 130]); s = await T.st(); check('click on one member → whole group selected', s.sel === 2);
  // déplacement
  await T.drag([150, 130], [150, 330]); o = await T.objs(); check('group moves as one', near(o[0].y1, 300, 3) && near(o[1].y1, 300, 3) && o[2].y1 === 100);
  // marquee
  await page.keyboard.press('Escape'); await T.drag([240, 280], [380, 360]);  // cadre autour de l'ellipse seulement (centre 300,330)
  s = await T.st(); check('marquee touching one member selects the group', s.sel === 2, JSON.stringify(s));
  // shift-clic retire le groupe entier
  await T.click([300, 330], ['Shift']); s = await T.st(); check('shift-click on a selected member removes the whole group', s.sel === 0, JSON.stringify(s));
  // rotation d'un groupe (autour du centre commun)
  await T.click([300, 330]); const pre = (await T.objs()).map(q => ({ ...q })); await page.click('#selRot'); await page.waitForTimeout(100); o = await T.objs();
  check('group rotated 90° together (both rot, centres swapped around union centre)', near(o[0].rot, Math.PI / 2) && near(o[1].rot, Math.PI / 2) && o[0].y1 !== pre[0].y1);
  // copier / coller / dupliquer : gid distinct
  await page.keyboard.press('Control+d'); await page.waitForTimeout(150); o = await T.objs();
  check('duplicate: 5 objects, copies share a NEW gid', o.length === 5 && o[3].gid && o[3].gid === o[4].gid && o[3].gid !== o[0].gid, JSON.stringify(o.map(q => q.gid)));
  // Ctrl+G dégroupe
  u = (await T.st()).undo; await page.keyboard.press('Control+g'); await page.waitForTimeout(100); o = await T.objs();
  check('Ctrl+G ungroups the selection (copies)', !o[3].gid && !o[4].gid && o[0].gid && (await T.st()).undo === u + 1, JSON.stringify(o.map(q => q.gid)));
  await page.keyboard.press('Control+g'); await page.waitForTimeout(100); o = await T.objs();
  check('Ctrl+G again regroups', o[3].gid && o[3].gid === o[4].gid);
  // supprimer le groupe
  await page.keyboard.press('Delete'); await page.waitForTimeout(100); check('Delete removes the whole group', (await T.objs()).length === 3);
  // annuler / rétablir
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z'); await page.waitForTimeout(100); o = await T.objs(); check('undo ×2 restores (5 objects, ungrouped copies)', o.length === 5 && !o[3].gid, String(o.length));
  // tout sélectionner
  await page.keyboard.press('Escape'); await page.keyboard.press('ControlOrMeta+a'); check('Ctrl+A selects all 5', (await T.st()).sel === 5);

  // ---- verrouillage ----
  await T.fresh();
  await T.add({ t: 'rect', x1: 100, y1: 100, x2: 200, y2: 160, fill: true });
  await T.add({ t: 'rect', x1: 300, y1: 100, x2: 400, y2: 160, fill: true });
  await page.click('[data-tool="select"]');
  check('unlock button hidden when nothing locked', !(await page.isVisible('#unlockAll')));
  await T.click([150, 130]); u = (await T.st()).undo; await page.click('#selLock'); await page.waitForTimeout(100);
  o = await T.objs(); s = await T.st(); check('lock: flag set, selection cleared, 1 undo', o[0].locked === true && s.sel === 0 && s.undo === u + 1);
  check('unlock button shows (1)', await page.isVisible('#unlockAll') && /\(1\)/.test(await page.textContent('#unlockAll')), await page.textContent('#unlockAll'));
  await T.click([150, 130]); check('locked object is not selectable by click', (await T.st()).sel === 0);
  await T.drag([100, 80], [220, 180]); check('locked object ignored by marquee', (await T.st()).sel === 0);
  await page.keyboard.press('ControlOrMeta+a'); check('Ctrl+A skips locked', (await T.st()).sel === 1);
  await page.keyboard.press('Escape');
  await page.click('[data-tool="eraser"]'); await T.click([150, 130]); check('eraser skips locked', (await T.objs()).length === 2);
  await page.click('[data-tool="select"]'); await page.mouse.move(5, 790); await page.screenshot({ path: 'shot-locked.png' });
  u = (await T.st()).undo; await page.click('#unlockAll'); await page.waitForTimeout(100);
  o = await T.objs(); s = await T.st(); check('unlock: flag removed, object selected, 1 undo', !o[0].locked && s.sel === 1 && s.ids[0] === o[0].id && s.undo === u + 1);
  check('unlock button hidden again', !(await page.isVisible('#unlockAll')));
  // verrouiller un groupe
  await page.keyboard.press('Escape'); await T.click([150, 130]); await T.click([350, 130], ['Shift']); await page.click('#selGroup'); await page.click('#selLock'); await page.waitForTimeout(100);
  o = await T.objs(); check('group locked together', o[0].locked && o[1].locked && o[0].gid === o[1].gid);
  await page.click('#unlockAll'); await page.waitForTimeout(100); check('unlock restores selection of both', (await T.st()).sel === 2);

  // ---- persistance (rechargement du projet) ----
  const ser = await page.evaluate(() => JSON.stringify(__piverdraw.serialize()));
  check('serialized contains gid', /"gid":"/.test(ser));
  await page.keyboard.press('Escape'); await T.click([150, 130]); await page.click('#selClone'); await page.click('#selLock'); await page.waitForTimeout(50);
  const ser2 = await page.evaluate(() => JSON.stringify(__piverdraw.serialize()));
  await page.evaluate(s => __piverdraw.loadProject(JSON.parse(s)), ser2); await page.waitForTimeout(200);
  o = await T.objs(); check('reload keeps locked / gid', o.length === 2 && o[0].gid === o[1].gid && (o[0].locked === true || o[1].locked === true), JSON.stringify(o.map(q => [q.gid, q.locked, q.clone])));
  console.log('errors', JSON.stringify(T.errors)); await T.browser.close();
})();
