const { chromium, devices } = require('playwright');
const fs = require('fs');
const out = (...a) => console.log(...a);
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
  const errs = [];
  const mk = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message + (e.stack || '').slice(0, 300))); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); }); return p; };
  const page = await mk();
  const check = (n, c, x = '') => out((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : ''));
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(700);
  const dump = () => page.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('piverdraw', 1); r.onsuccess = () => { const tx = r.result.transaction('kv'), st = tx.objectStore('kv'), keys = st.getAllKeys(), vals = st.getAll(); tx.oncomplete = () => { const o = {}; keys.result.forEach((k, i) => o[k] = vals.result[i]); res(o); }; }; r.onerror = () => rej(r.error); }));
  const objCount = () => page.evaluate(() => __piverdraw.page().objects.length);
  const name = () => page.inputValue('#projName');
  const scribble = async (x = 400, y = 300) => { await page.keyboard.press('p'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 150, y + 40, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(60); };
  const openLib = async () => { await page.click('#btnLib'); await page.waitForSelector('.librow'); };
  const rows = () => page.$$eval('.librow', rs => rs.map(r => ({ id: r.dataset.id, name: r.querySelector('.libname, input')?.textContent || r.querySelector('input')?.value, cur: r.classList.contains('cur'), meta: r.querySelector('.libmeta').textContent, thumb: r.querySelector('.libthumb').tagName + ':' + (r.querySelector('.libthumb').src || '').slice(0, 22) })));
  const closeLib = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(80); };

  // 1. premier lancement : tableau d'exemple « en cours », rien n'est encore enregistré
  await openLib(); let r = await rows();
  check('first run: one entry, current, "pas encore modifié"', r.length === 1 && r[0].cur && /pas encore modifié/.test(r[0].meta), JSON.stringify(r));
  check('first run: thumb shown', /^IMG:data:image\/jpeg/.test(r[0].thumb), r[0].thumb);
  await page.screenshot({ path: 'shot-lib-1.png' });
  await closeLib(); let d = await dump(); check('nothing stored while untouched', !d.library && !Object.keys(d).some(k => k.startsWith('board:')), Object.keys(d).join());

  // 2. on dessine → enregistrement par tableau ; nom
  await scribble(); await page.fill('#projName', 'Fractions 6e'); await page.waitForTimeout(1500);
  d = await dump(); const ids = Object.keys(d).filter(k => k.startsWith('board:'));
  check('board stored under board:<id> + library index', ids.length === 1 && d.library && d.library.boards.length === 1 && d.library.current === ids[0].slice(6) && d.library.boards[0].name === 'Fractions 6e' && /^data:image\/jpeg/.test(d.library.boards[0].thumb), JSON.stringify(d.library && { n: d.library.boards.length, cur: d.library.current, name: d.library.boards[0].name }));
  const idA = d.library.current, nA = await objCount();

  // 3. Fichier › Nouveau : ne remplace plus, pas de boîte de confirmation
  await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(250);
  check('new board: no confirm dialog, blank page, named, focus left to the canvas', !(await page.$('.dlg .btn.primary')) && (await objCount()) === 0 && (await name()) === 'Nouveau tableau' && await page.evaluate(() => document.activeElement.id !== 'projName'), await name());
  await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(150);
  check('second "Nouveau" on an untouched blank board reuses it (toast)', /encore vide/.test(await page.textContent('#toast')));
  await openLib(); r = await rows();
  check('library lists current (blank, unsaved) + previous', r.length === 2 && r[0].cur && /pas encore modifié/.test(r[0].meta) && r[1].id === idA && /modifié/.test(r[1].meta) && r[1].name === 'Fractions 6e', JSON.stringify(r.map(x => [x.name, x.cur])));
  await closeLib();

  // 4. dessin dans le 2e tableau, renommage, puis retour au 1er (bascule < 1 s : l'enregistrement est forcé)
  await scribble(300, 400); await scribble(500, 450); await page.fill('#projName', 'Pythagore 4e');
  const nB = await objCount(); const idB = await page.evaluate(() => __piverdraw.S.boardId);
  await openLib(); await page.click(`.librow[data-id="${idA}"] .libopen`); await page.waitForTimeout(400);
  check('open previous board: its content and name are back', (await objCount()) === nA && (await name()) === 'Fractions 6e' && !(await page.$('.librow')), `${await objCount()} vs ${nA}`);
  d = await dump(); check('board B saved on switch (2 strokes, renamed)', d['board:' + idB] && d['board:' + idB].pages[0].objects.length === nB && d['board:' + idB].name === 'Pythagore 4e' && d.library.current === idA, JSON.stringify(d.library.boards.map(b => [b.name, b.pages])));
  await page.reload(); await page.waitForTimeout(800);
  check('reload reopens the last opened board', (await name()) === 'Fractions 6e' && (await objCount()) === nA);

  // 5. dupliquer
  await openLib(); await page.click(`.librow[data-id="${idA}"] button[aria-label^="Dupliquer"]`); await page.waitForTimeout(400); r = await rows();
  check('duplicate: "(copie)" appears, current stays', r.length === 3 && r.some(x => x.name === 'Fractions 6e (copie)') && r.find(x => x.cur).id === idA, JSON.stringify(r.map(x => [x.name, x.cur])));
  const idC = r.find(x => x.name === 'Fractions 6e (copie)').id; d = await dump();
  check('copy has the same content under a new id', d['board:' + idC] && d['board:' + idC].pages[0].objects.length === nA && idC !== idA);

  // 6. renommer (autre tableau) en ligne
  await page.click(`.librow[data-id="${idC}"] button[aria-label^="Renommer"]`); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type('Contrôle fractions'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  r = await rows(); check('inline rename of another board persists', r.some(x => x.id === idC && x.name === 'Contrôle fractions'), JSON.stringify(r.map(x => x.name)));
  d = await dump(); check('rename stored in board + index', d['board:' + idC].name === 'Contrôle fractions' && d.library.boards.find(b => b.id === idC).name === 'Contrôle fractions');
  // Échap pendant le renommage annule le renommage sans fermer la fenêtre
  await page.click(`.librow[data-id="${idC}"] button[aria-label^="Renommer"]`); await page.keyboard.type('XXX'); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  r = await rows(); check('Escape while renaming cancels but keeps the dialog', r.length === 3 && r.some(x => x.name === 'Contrôle fractions'));
  // renommer le tableau en cours depuis la liste met à jour l'en-tête
  await page.click(`.librow[data-id="${idA}"] button[aria-label^="Renommer"]`); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type('Fractions (cours)'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check('renaming the current board updates header name', (await name()) === 'Fractions (cours)');
  await page.screenshot({ path: 'shot-lib-2.png' });

  // 7. supprimer : confirmation en deux temps
  await page.click(`.librow[data-id="${idC}"] button[aria-label^="Supprimer"]`);
  check('delete: first click asks to confirm, nothing deleted', /Supprimer \?/.test(await page.textContent(`.librow[data-id="${idC}"] .libacts`)) && (await rows()).length === 3);
  await page.click(`.librow[data-id="${idC}"] button[aria-label^="Supprimer"]`); await page.waitForTimeout(400); r = await rows(); d = await dump();
  check('delete: second click removes board and its data', r.length === 2 && !d['board:' + idC] && !d.library.boards.some(b => b.id === idC));
  // supprimer le tableau en cours : on bascule sur le plus récent
  await page.click(`.librow[data-id="${idA}"] button[aria-label^="Supprimer"]`); await page.click(`.librow[data-id="${idA}"] button[aria-label^="Supprimer"]`); await page.waitForTimeout(600); r = await rows(); d = await dump();
  check('deleting the current board opens the most recent other one', r.length === 1 && r[0].cur && r[0].id === idB && (await name()) === 'Pythagore 4e' && !d['board:' + idA], JSON.stringify(r.map(x => [x.name, x.cur])));
  await page.waitForTimeout(1300); d = await dump(); check('deleted board is not resurrected by a pending autosave', !d['board:' + idA] && d.library.boards.length === 1);
  // supprimer le dernier → tableau vide
  await page.click(`.librow[data-id="${idB}"] button[aria-label^="Supprimer"]`); await page.click(`.librow[data-id="${idB}"] button[aria-label^="Supprimer"]`); await page.waitForTimeout(600); r = await rows();
  check('deleting the last board leaves a fresh blank one', r.length === 1 && r[0].cur && (await objCount()) === 0 && (await name()) === 'Nouveau tableau', JSON.stringify(r.map(x => [x.name])));
  await closeLib(); await page.reload(); await page.waitForTimeout(700);
  check('reload after deleting everything: blank board (no tutorial, no legacy resurrection)', (await name()) === 'Nouveau tableau' && (await objCount()) === 0);

  // 8. import .json : ajoute un tableau sans rien écraser
  await scribble(); await page.fill('#projName', 'Avant import'); await page.waitForTimeout(1300);
  const proj = await page.evaluate(() => ({ app: 'piverdraw', v: 1, name: 'Importé', cur: 0, pages: [{ id: 'p1', bg: 'grid', frame: { x: 0, y: 0, w: 1600, h: 900 }, objects: [{ t: 'rect', id: 'r1', x1: 10, y1: 10, x2: 300, y2: 200, color: '#000000', size: 3, fill: false }] }], assets: {} }));
  fs.writeFileSync('import.piverdraw.json', JSON.stringify(proj));
  await page.setInputFiles('#fileProj', 'import.piverdraw.json'); await page.waitForTimeout(700);
  check('import: no confirm, new board opened', !(await page.$('.dlg .btn.primary')) && (await name()) === 'Importé' && (await objCount()) === 1);
  await openLib(); r = await rows(); check('import: previous board still listed', r.length === 2 && r.some(x => x.name === 'Avant import') && r[0].name === 'Importé', JSON.stringify(r.map(x => x.name)));
  await closeLib();

  // 9. recherche (plus de 6 tableaux)
  for (let i = 0; i < 6; i++) { await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(120); await scribble(300 + i * 10, 300); await page.fill('#projName', i % 2 ? 'Géométrie ' + i : 'Algèbre ' + i); await page.waitForTimeout(150); }
  await page.waitForTimeout(1300); await openLib(); r = await rows(); const sv = await page.isVisible('#libSearch');
  check('8 boards listed, search box shown', r.length === 8 && sv, String(r.length));
  await page.fill('#libSearch', 'geometrie'); await page.waitForTimeout(100); r = await rows(); check('search ignores accents/case', r.length === 3 && r.every(x => /Géométrie/.test(x.name)), JSON.stringify(r.map(x => x.name)));
  await page.fill('#libSearch', 'zzz'); await page.waitForTimeout(100); check('search with no match shows message', /Aucun tableau/.test(await page.textContent('.liblist')));
  await page.fill('#libSearch', ''); await page.waitForTimeout(100);
  await page.screenshot({ path: 'shot-lib-3.png' });
  await closeLib();

  // 10. migration de l'ancien stockage (un seul tableau « project »)
  const page2 = await ctx.newPage(); page2.on('pageerror', e => errs.push(e.message));
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx2.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
  const pm = await ctx2.newPage(); pm.on('pageerror', e => errs.push('[migr] ' + e.message));
  await pm.goto('http://localhost:8765/index.html'); await pm.waitForTimeout(600);
  await pm.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('piverdraw', 1); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put({ app: 'piverdraw', v: 1, name: 'Ancien tableau', cur: 0, pages: [{ id: 'pg', bg: 'seyes', frame: { x: 0, y: 0, w: 1600, h: 900 }, objects: [{ t: 'line', id: 'l1', x1: 0, y1: 0, x2: 300, y2: 300, color: '#000', size: 3 }, { t: 'line', id: 'l2', x1: 0, y1: 300, x2: 300, y2: 0, color: '#000', size: 3 }] }], assets: {}, views: {} }, 'project'); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }; }));
  await pm.reload(); await pm.waitForTimeout(1800);
  const mig = await pm.evaluate(async () => ({ name: document.getElementById('projName').value, n: __piverdraw.page().objects.length }));
  const dm = await pm.evaluate(() => new Promise(res => { const r = indexedDB.open('piverdraw', 1); r.onsuccess = () => { const st = r.result.transaction('kv').objectStore('kv'), k = st.getAllKeys(); k.onsuccess = () => res(k.result); }; }));
  check('legacy single board is migrated into the library', mig.name === 'Ancien tableau' && mig.n === 2 && dm.includes('library') && dm.some(k => String(k).startsWith('board:')) && dm.includes('project'), JSON.stringify({ mig, dm }));

  // 11. stockage local indisponible : l'ancien comportement (remplacement avec confirmation) est conservé
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx3.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
  await ctx3.addInitScript(() => { indexedDB.open = () => { throw new Error('blocked'); }; });
  const pn = await ctx3.newPage(); pn.on('pageerror', e => errs.push('[noidb] ' + e.message)); await pn.goto('http://localhost:8765/index.html'); await pn.waitForTimeout(800);
  check('no storage: warning in save state', /indisponible/.test(await pn.textContent('#saveState')));
  await pn.keyboard.press('p'); await pn.mouse.move(400, 300); await pn.mouse.down(); await pn.mouse.move(520, 340, { steps: 6 }); await pn.mouse.up();
  await pn.click('#btnFile'); await pn.click('[data-act="new"]'); await pn.waitForTimeout(200);
  check('no storage: "Nouveau" asks before replacing', !!(await pn.$('.dlg .btn.primary')) && /Remplacer/.test(await pn.textContent('.dlg')));
  await pn.click('.dlg .btn.primary'); await pn.waitForTimeout(200); check('no storage: replaced after confirmation', (await pn.evaluate(() => __piverdraw.page().objects.length)) === 0);
  await pn.click('#btnLib'); await pn.waitForSelector('.librow'); check('no storage: library dialog warns', await pn.isVisible('#libNote'));

  out('errors', JSON.stringify(errs));
  await browser.close();
})();
