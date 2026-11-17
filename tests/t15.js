const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', 'site', 'vendor', 'pdfjs');
const out = (...a) => console.log(...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    window.__saved = []; window.__opened = [];
    window.open = (u, t) => { window.__opened.push(u); return { opener: 1 }; };
    window.claude = { use: async (n) => n === 'downloads' ? { save: async (r) => {
      const blob = r.data instanceof Blob ? r.data : new Blob([r.data]);
      const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      window.__saved.push({ filename: r.filename, size: buf.length, b64: btoa(s) }); return { status: 'saved' };
    } } : null };
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push('[console.error] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://localhost')) return route.continue();
    if (u.includes('pdf.worker.min.js')) return route.fulfill({ path: path.join(NM, 'pdf.worker.min.js'), contentType: 'application/javascript' });
    if (u.includes('pdf.min.js')) return route.fulfill({ path: path.join(NM, 'pdf.min.js'), contentType: 'application/javascript' });
    return route.abort();
  });
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(700);
  const check = (n, c, x = '') => out((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : ''));
  const world = (x, y) => page.evaluate(([x, y]) => { const v = __piverdraw.view(), r = document.getElementById('cv').getBoundingClientRect(); return [r.left + v.tx + x * v.z, r.top + v.ty + y * v.z]; }, [x, y]);
  const opened = () => page.evaluate(() => window.__opened.slice());
  const clear = () => page.evaluate(() => { window.__opened.length = 0; });
  const objs = () => page.evaluate(() => __piverdraw.page().objects.map(o => ({ ...o })));
  const st = () => page.evaluate(() => ({ sel: __piverdraw.S.sel.size, tool: __piverdraw.S.tool, undo: __piverdraw.S.undo.length }));
  const inside = o => world(o.x + 8, o.y + o.size * .6);
  const click = async (o, mods = []) => { const [x, y] = await inside(o); for (const m of mods) await page.keyboard.down(m); await page.mouse.click(x, y); for (const m of mods.reverse()) await page.keyboard.up(m); await page.waitForTimeout(120); };
  const dlgTitle = () => page.textContent('.dlg h2');

  await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(150);

  // 1. insertion depuis le rail
  await page.click('#railLink'); await page.waitForSelector('#lkUrl');
  check('dialog title', (await dlgTitle()) === 'Lien cliquable');
  check('OK disabled while empty', await page.isDisabled('#lkOk'));
  await page.fill('#lkUrl', 'javascript:alert(1)');
  check('javascript: refused (hint + OK disabled)', /http/.test(await page.textContent('#lkHint')) && await page.isDisabled('#lkOk'));
  await page.fill('#lkUrl', 'exercices.exemple.fr/ex4'); await page.fill('#lkTxt', 'Exercice 4');
  check('valid address enables OK', !(await page.isDisabled('#lkOk')));
  await page.screenshot({ path: 'shot-link-dlg.png' });
  await page.click('#lkOk'); await page.waitForTimeout(200);
  let o = await objs(); const L1 = o[o.length - 1], s1 = await st();
  check('link text inserted, selected, https added', L1.t === 'text' && L1.text === 'Exercice 4' && L1.href === 'https://exercices.exemple.fr/ex4' && s1.sel === 1 && s1.tool === 'select' && s1.undo === 1, JSON.stringify({ ...L1, ...s1 }));
  check('dialog closed', !(await page.$('.dlg')));
  // soulignement : pixels de la couleur du lien sous la ligne de texte
  const ul = await page.evaluate(() => { const o = __piverdraw.page().objects.slice(-1)[0], v = __piverdraw.view(), cv = document.getElementById('cv'), g = cv.getContext('2d'), d = cv.width / cv.getBoundingClientRect().width;
    const yy = Math.round((v.ty + (o.y + o.size * .12 + o.size * 1.02 + o.size * .03) * v.z) * d), x0 = Math.round((v.tx + (o.x + 4) * v.z) * d), n = 60; const px = g.getImageData(x0, yy, n, 1).data; let blue = 0;
    for (let i = 0; i < n; i++) { const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2]; if (b > r + 60 && b > 150 && r < 90) blue++; } return blue; });
  check('underline drawn under the link text', ul >= 50, 'blue px ' + ul);
  await page.mouse.move(5, 790); await page.screenshot({ path: 'shot-link-placed.png' });

  // 2. Ctrl+K sans sélection : libellé par défaut = domaine
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  await page.keyboard.press('Control+k'); await page.waitForSelector('#lkUrl');
  check('Ctrl+K opens the dialog (nothing selected)', (await dlgTitle()) === 'Lien cliquable');
  await page.fill('#lkUrl', 'https://www.geogebra.org/classic/abcd?lang=fr'); await page.press('#lkUrl', 'Enter'); await page.waitForTimeout(200);
  o = await objs(); const L2 = o[o.length - 1];
  check('Enter submits; default label is the domain', L2.text === 'geogebra.org' && L2.href.startsWith('https://www.geogebra.org/'), L2.text);
  // déplacer le 2e lien un peu plus bas pour ne pas chevaucher
  await page.evaluate(() => { const S = __piverdraw.S, pg = __piverdraw.page(); pg.objects = pg.objects.map((q, i) => i === pg.objects.length - 1 ? { ...q, y: q.y + 150 } : q); });
  await page.evaluate(() => { const pg = __piverdraw.page(); const L = pg.objects.slice(-1)[0]; L.__moved = 1; });

  // 3. ouverture : clic simple = sélection seulement ; Ctrl+clic ouvre
  o = await objs(); const A = o.find(q => q.text === 'Exercice 4'), B = o.find(q => q.text === 'geogebra.org');
  await page.keyboard.press('Escape'); await clear();
  await click(A);
  check('plain click selects, does not open', (await opened()).length === 0 && (await st()).sel === 1);
  const so = await page.evaluate(() => ({ open: !document.getElementById('selOpen').hidden, link: document.getElementById('selLink').textContent.trim(), linkHidden: document.getElementById('selLink').hidden }));
  check('selection bar: Ouvrir le lien + Modifier le lien', so.open && !so.linkHidden && /Modifier/.test(so.link), JSON.stringify(so));
  await page.keyboard.press('Escape'); await clear(); await click(A, ['Control']);
  check('Ctrl+click opens the link', JSON.stringify(await opened()) === JSON.stringify(['https://exercices.exemple.fr/ex4']), JSON.stringify(await opened()));
  await page.keyboard.press('Escape'); await clear(); await click(A); await page.click('#selOpen');
  check('« Ouvrir le lien » button opens', (await opened()).length === 1);
  const cur = async o2 => { const [x, y] = await inside(o2); await page.mouse.move(x, y, { steps: 2 }); return page.evaluate(() => document.getElementById('cv').style.cursor); };
  await page.keyboard.press('Escape'); await page.keyboard.down('Control'); const c1 = await cur(A); await page.keyboard.up('Control');
  check('pointer cursor on Ctrl+hover', c1 === 'pointer', c1);

  // 4. modifier / retirer le lien d'un texte lié
  await page.mouse.move(5, 790); await page.keyboard.press('Escape'); await click(A); const u0 = (await st()).undo;
  await page.keyboard.press('Control+k'); await page.waitForSelector('#lkUrl');
  check('edit dialog title + prefilled', (await dlgTitle()) === 'Modifier le lien du texte' && (await page.inputValue('#lkUrl')) === 'https://exercices.exemple.fr/ex4');
  check('no text field when editing an existing object', !(await page.$('#lkTxt')));
  await page.fill('#lkUrl', 'https://exemple.fr/nouveau'); await page.click('#lkOk'); await page.waitForTimeout(150);
  o = await objs(); check('link updated, one undo step', o.find(q => q.id === A.id).href === 'https://exemple.fr/nouveau' && (await st()).undo === u0 + 1);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100);
  o = await objs(); check('undo restores the previous link', o.find(q => q.id === A.id).href === 'https://exercices.exemple.fr/ex4');
  await click(A); await page.keyboard.press('Control+k'); await page.waitForSelector('#lkDel'); await page.click('#lkDel'); await page.waitForTimeout(150);
  o = await objs(); check('« Retirer le lien » removes href only', !('href' in o.find(q => q.id === A.id)) && o.find(q => q.id === A.id).text === 'Exercice 4');
  const ul2 = await page.evaluate(() => { const o = __piverdraw.page().objects.find(q => q.text === 'Exercice 4'), v = __piverdraw.view(), cv = document.getElementById('cv'), g = cv.getContext('2d'), d = cv.width / cv.getBoundingClientRect().width;
    const yy = Math.round((v.ty + (o.y + o.size * .12 + o.size * 1.02 + o.size * .03) * v.z) * d), x0 = Math.round((v.tx + (o.x + 4) * v.z) * d), px = g.getImageData(x0, yy, 60, 1).data; let blue = 0;
    for (let i = 0; i < 60; i++) if (px[i * 4 + 2] > px[i * 4] + 60 && px[i * 4 + 2] > 150) blue++; return blue; });
  check('no underline once the link is removed', ul2 < 10, 'blue px ' + ul2);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100);   // lien rétabli

  // 5. ajouter un lien à un texte ordinaire
  await page.keyboard.press('Escape'); await page.keyboard.press('t');
  { const [x, y] = await world(300, 600); await page.mouse.click(x, y); await page.waitForTimeout(250); await page.keyboard.type('Salut'); await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  o = await objs(); const T = o.find(q => q.text === 'Salut');
  await page.keyboard.press('v'); await click(T);
  check('plain text selected, button says « Lien… »', (await page.textContent('#selLink')).trim() === 'Lien…' && await page.isHidden('#selOpen'));
  await page.keyboard.press('Control+k'); await page.waitForSelector('#lkUrl');
  check('attach dialog title', (await dlgTitle()) === 'Ajouter un lien au texte');
  await page.fill('#lkUrl', 'https://exemple.fr/salut'); await page.click('#lkOk'); await page.waitForTimeout(150);
  o = await objs(); check('href added to the existing text', o.find(q => q.id === T.id).href === 'https://exemple.fr/salut');
  // modifier le texte conserve le lien
  await page.keyboard.press('Escape'); await page.keyboard.press('t');
  { const [x, y] = await inside(T); await page.mouse.click(x, y); await page.waitForTimeout(300); await page.keyboard.press('End'); await page.keyboard.type('!'); await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  await page.keyboard.press('v'); await click(T);
  o = await objs(); const T2 = o.find(q => q.id === T.id);
  check('editing the text keeps the link', T2 && T2.text === 'Salut!' && T2.href === 'https://exemple.fr/salut', JSON.stringify(T2));
  // dupliquer conserve le lien
  await page.keyboard.press('Control+d'); await page.waitForTimeout(150);
  o = await objs(); const D = o[o.length - 1];
  check('duplicate keeps the link', D.id !== T.id && D.href === 'https://exemple.fr/salut');
  await page.keyboard.press('Delete'); await page.waitForTimeout(100);

  // 6. image avec lien
  await page.evaluate(() => { const S = __piverdraw.S, pg = __piverdraw.page(); S.proj.assets.q1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; pg.objects.push({ t: 'img', id: 'imgq', iid: 'q1', x: 1100, y: 500, w: 160, h: 160, href: 'https://exemple.fr/image' }); });
  await page.evaluate(() => { __piverdraw.S.sel = new Set(['imgq']); });
  await page.keyboard.press('Control+k'); await page.waitForSelector('#lkUrl');
  check('image: dialog says « Modifier le lien de l’image »', (await dlgTitle()) === 'Modifier le lien de l’image'); await page.click('#lkCancel');
  check('Cancel closes without change', !(await page.$('.dlg')));

  // 7. persistance
  await page.waitForTimeout(1300); await page.reload(); await page.waitForTimeout(900);
  o = await objs(); check('links survive a reload', o.filter(q => q.href).length === 4, JSON.stringify(o.filter(q => q.href).map(q => q.href)));

  // 8. import JSON : liens dangereux supprimés sur les textes
  const proj = { app: 'piverdraw', v: 1, name: 'T', cur: 0, pages: [{ id: 'p', bg: 'blank', frame: { x: 0, y: 0, w: 1600, h: 900 }, objects: [
    { t: 'text', id: 'a', x: 10, y: 10, text: 'a', size: 30, color: '#000', href: 'javascript:alert(1)' },
    { t: 'text', id: 'b', x: 10, y: 80, text: 'b', size: 30, color: '#000', href: 'https://ok.example/x' },
    { t: 'text', id: 'c', x: 10, y: 150, text: 'c', size: 30, color: '#000', href: 'data:text/html,<b>' } ] }], assets: {} };
  fs.writeFileSync('evil2.piverdraw.json', JSON.stringify(proj));
  await page.setInputFiles('#fileProj', 'evil2.piverdraw.json'); await page.waitForTimeout(900);
  o = await objs(); check('import: unsafe hrefs stripped on texts, https kept', JSON.stringify(o.map(q => q.href || null)) === JSON.stringify([null, 'https://ok.example/x', null]), JSON.stringify(o.map(q => q.href || null)));
  // revenir au tableau de test
  await page.click('#btnLib'); await page.waitForSelector('.librow'); const rows = await page.$$('.librow .libopen'); 
  for (const r of rows) { if (!(await r.evaluate(e => e.closest('.librow').classList.contains('cur')))) { await r.click(); break; } }
  await page.waitForTimeout(500);

  // 9. présentation : un clic ouvre, un glissé dessine, la gomme n'ouvre pas
  o = await objs(); const PA = o.find(q => q.text === 'Exercice 4');
  await page.click('#btnPresent'); await page.waitForTimeout(400);
  const count = async () => (await objs()).length;
  for (const tool of ['pen', 'laser', 'hand']) {
    await page.click(`[data-ptool="${tool}"]`); await clear(); await click(PA);
    check(`presentation, tool ${tool}: a simple click opens the link`, (await opened()).length === 1, JSON.stringify(await opened()));
  }
  await page.click('[data-ptool="pen"]'); await clear(); const n0 = await count();
  { const [x, y] = await inside(PA); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 80, y + 20, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(150); }
  check('presentation, pen: dragging across the link draws and opens nothing', (await opened()).length === 0 && (await count()) === n0 + 1);
  await page.click('[data-ptool="eraser"]'); await clear(); await click(PA);
  check('presentation, eraser: no link opening', (await opened()).length === 0);
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z'); await page.waitForTimeout(100);
  await page.screenshot({ path: 'shot-link-present.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape');

  // 10. PDF : liens cliquables
  await page.evaluate(() => { window.__saved.length = 0; });
  await page.click('#btnFile'); await page.click('[data-act="pdfout"]'); await page.waitForFunction(() => window.__saved.length > 0, null, { timeout: 20000 });
  const b64 = await page.evaluate(() => window.__saved[0].b64); fs.writeFileSync('links.pdf', Buffer.from(b64, 'base64'));
  await page.addScriptTag({ path: path.join(NM, 'pdf.min.js') });
  const pd = await page.evaluate(async b64 => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.example/pdf.worker.min.js';
    const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), doc = await pdfjsLib.getDocument({ data }).promise, pg = await doc.getPage(1), an = await pg.getAnnotations(), vp = pg.getViewport({ scale: 1 });
    return { pages: doc.numPages, w: vp.width, h: vp.height, an: an.map(a => ({ url: a.url, rect: a.rect, sub: a.subtype })) };
  }, b64);
  o = await objs();
  check('PDF: one link annotation per linked object, with the right URL', pd.an.length === 4 && pd.an.every(a => a.sub === 'Link') && ['https://exercices.exemple.fr/ex4', 'https://exemple.fr/salut', 'https://exemple.fr/image', 'https://www.geogebra.org/classic/abcd?lang=fr'].every(u => pd.an.some(a => a.url === u)), JSON.stringify(pd.an.map(a => a.url)));
  check('PDF: rectangles inside the page', pd.an.every(a => a.rect[0] >= -0.5 && a.rect[1] >= -0.5 && a.rect[2] <= pd.w + 0.5 && a.rect[3] <= pd.h + 0.5 && a.rect[2] > a.rect[0] && a.rect[3] > a.rect[1]), JSON.stringify({ w: pd.w, h: pd.h, r: pd.an.map(a => a.rect.map(Math.round)) }));
  // orientation : « Exercice 4 » (haut de page) au-dessus de « Salut » (bas) → y plus grand dans le PDF
  const aEx = pd.an.find(a => a.url.includes('ex4')), aSal = pd.an.find(a => a.url.includes('salut'));
  check('PDF: y axis flipped correctly (higher on page = larger y)', aEx && aSal && aEx.rect[1] > aSal.rect[1], JSON.stringify([aEx && aEx.rect.map(Math.round), aSal && aSal.rect.map(Math.round)]));

  // 11. mobile
  await page.setViewportSize({ width: 412, height: 860 }); await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.getElementById('railLink').scrollIntoView({ inline: 'center' })); await page.waitForTimeout(150);
  await page.click('#railLink'); await page.waitForSelector('#lkUrl');
  const mob = await page.evaluate(() => { const d = document.querySelector('.dlg'); return { docW: document.documentElement.scrollWidth, vw: innerWidth, sw: d.scrollWidth, cw: d.clientWidth, ok: [...d.querySelectorAll('.btn')].every(b => { const r = b.getBoundingClientRect(); return r.right <= innerWidth && r.height >= 34; }) }; });
  check('mobile: dialog fits, buttons tall enough', mob.docW <= mob.vw && mob.sw <= mob.cw && mob.ok, JSON.stringify(mob));
  await page.screenshot({ path: 'shot-link-mobile.png' }); await page.click('#lkCancel');
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(300);

  // 12. tableau noir : le lien est clair
  await page.selectOption('#bgSel', 'noir'); await page.keyboard.press('Escape');
  await page.click('#railLink'); await page.waitForSelector('#lkUrl'); await page.fill('#lkUrl', 'https://exemple.fr/noir'); await page.fill('#lkTxt', 'Sur le tableau noir'); await page.click('#lkOk'); await page.waitForTimeout(200);
  o = await objs(); const N = o[o.length - 1]; check('dark board: light-blue link', N.color === '#8ab4ff', N.color);
  await page.mouse.move(5, 790); await page.screenshot({ path: 'shot-link-dark.png' });
  out('errors', JSON.stringify(errors));
  await browser.close();
})();
