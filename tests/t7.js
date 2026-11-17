const qrOpen = require('./qropen.js');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = (...a) => console.log(...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(() => {
    window.__saved = []; window.__opened = []; window.__openRet = 'ok';
    window.open = (u, t) => { window.__opened.push(u); return window.__openRet === 'ok' ? { opener: 1 } : null; };
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
    if (u.includes('qrcode-generator')) return route.fulfill({ path: path.join(__dirname, '..', 'site', 'vendor', 'qrcode.js'), contentType: 'application/javascript' });
    return route.abort();
  });
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(600);
  const check = (n, c, x = '') => out((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : ''));
  const world = (x, y) => page.evaluate(([x, y]) => { const v = __piverdraw.view(), r = document.getElementById('cv').getBoundingClientRect(); return [r.left + v.tx + x * v.z, r.top + v.ty + y * v.z]; }, [x, y]);
  const opened = () => page.evaluate(() => window.__opened.slice());
  const lastObj = () => page.evaluate(() => { const o = __piverdraw.page().objects.slice(-1)[0]; return o ? { ...o } : null; });
  const centerOf = async o => world(o.x + o.w / 2, o.y + o.h / 2);
  const openDlg = async () => { await qrOpen(page, false); await page.waitForSelector('#shareUrl'); };
  const fillLink = async v => { await page.fill('#shareUrl', v); await page.waitForSelector('#qrCv:not([hidden])'); await page.waitForTimeout(350); };
  const SAVE = (b64, f) => fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(100);

  // 1. options présentes, décochées au départ
  await openDlg();
  check('both options unchecked at start', !(await page.isChecked('#qrLink')) && !(await page.isChecked('#qrShow')));
  check('options labels', /cliquable/.test(await page.textContent('#qrLinkRow')) && /Afficher le lien sous/.test(await page.textContent('label:has(#qrShow)')));
  await fillLink('exemple.fr/exercice-3');
  const sq = await page.evaluate(() => { const c = document.getElementById('qrCv'); return [c.width, c.height, document.getElementById('qrEnc').hidden]; });
  check('without label: square canvas, "Encodé" caption visible', sq[0] === sq[1] && sq[2] === false, JSON.stringify(sq));
  await page.check('#qrShow'); await page.waitForTimeout(150);
  const wl = await page.evaluate(() => { const c = document.getElementById('qrCv'); return [c.width, c.height, document.getElementById('qrEnc').hidden]; });
  check('with label: taller canvas, caption hidden', wl[1] > wl[0] * 1.05 && wl[2] === true, JSON.stringify(wl));
  await page.screenshot({ path: 'shot-qr-label.png' });
  // PNG enregistré avec le lien
  await page.evaluate(() => { window.__saved.length = 0; }); await page.click('#qrPng'); await page.waitForTimeout(400);
  const sv = await page.evaluate(() => window.__saved.map(x => ({ f: x.filename, b: x.b64 })));
  check('png saved with label', sv.length === 1 && sv[0].f === 'qr-lien.png'); if (sv[0]) SAVE(sv[0].b, 'qrl_short.png');

  // 2. URL longue → plusieurs lignes ; très longue → tronquée
  const longU = 'https://www.geogebra.org/classic/abcdefghijk?lang=fr&param=12345&autre=valeur-tres-longue/ensuite/et-encore-un-chemin';
  await fillLink(longU);
  await page.evaluate(() => { window.__saved.length = 0; }); await page.click('#qrPng'); await page.waitForTimeout(400);
  const s2 = await page.evaluate(() => window.__saved.map(x => x.b64)); if (s2[0]) SAVE(s2[0], 'qrl_long.png');
  const veryLong = 'https://exemple.fr/' + Array.from({ length: 24 }, (_, i) => 'segment' + i + '-valeur').join('/');
  await fillLink(veryLong);
  await page.evaluate(() => { window.__saved.length = 0; }); await page.click('#qrPng'); await page.waitForTimeout(400);
  const s3 = await page.evaluate(() => window.__saved.map(x => x.b64)); if (s3[0]) SAVE(s3[0], 'qrl_vlong.png');
  fs.writeFileSync('qrl_expected.json', JSON.stringify({ short: 'https://exemple.fr/exercice-3', long: longU, vlong: veryLong }));
  await page.screenshot({ path: 'shot-qr-vlong.png' });

  // 3. texte qui n'est pas une adresse web → « cliquable » indisponible
  await page.check('#qrLink'); await page.fill('#shareUrl', 'Bonjour à tous'); await page.waitForTimeout(400);
  check('plain text: clickable disabled + note', await page.isDisabled('#qrLink') && /adresse web/.test(await page.textContent('#qrLinkNote')));
  await page.click('#qrPlace'); await page.waitForTimeout(200);
  let o = await lastObj(); check('plain text placed without href', o && o.t === 'img' && !('href' in o), JSON.stringify(o && Object.keys(o)));
  const nObj = await page.evaluate(() => __piverdraw.page().objects.length);

  // 4. lien cliquable + lien affiché, mémorisés
  await openDlg();
  check('options remembered', (await page.isChecked('#qrLink')) && (await page.isChecked('#qrShow')));
  check('clickable enabled again with empty field', !(await page.isDisabled('#qrLink')));
  await fillLink('https://learningapps.org/view12345?x=é');
  await page.click('#qrPlace'); await page.waitForTimeout(250);
  o = await lastObj();
  check('placed with href (encoded) and taller than wide', o.href === 'https://learningapps.org/view12345?x=%C3%A9' && o.h > o.w * 1.1, JSON.stringify({ href: o.href, w: o.w, h: o.h }));
  check('toast mentions clickable', /cliquable/.test(await page.textContent('#toast')));
  const so = await page.evaluate(() => { const b = document.getElementById('selOpen'), r = b.getBoundingClientRect(); return { hidden: b.hidden, title: b.title, vis: r.width > 0 && r.height > 0 }; });
  check('"Ouvrir le lien" button shown for selected QR', !so.hidden && so.vis && /learningapps\.org/.test(so.title), JSON.stringify(so));
  await page.screenshot({ path: 'shot-qr-placed2.png' });
  await page.click('#selOpen'); await page.waitForTimeout(100);
  check('button opens the link', (await opened()).slice(-1)[0] === o.href, JSON.stringify(await opened()));

  // 5. édition : clic simple = sélection seulement ; Ctrl+clic = ouvre
  await page.keyboard.press('Escape'); await page.evaluate(() => { __piverdraw.S.sel.clear(); });
  await page.evaluate(() => window.__opened.length = 0);
  const [cx, cy] = await centerOf(o);
  await page.mouse.click(cx, cy); await page.waitForTimeout(100);
  check('plain click selects without opening', (await opened()).length === 0 && await page.evaluate(() => __piverdraw.S.sel.size === 1));
  await page.keyboard.down('Control'); await page.mouse.move(cx + 3, cy + 3); await page.mouse.move(cx, cy);
  check('cursor is pointer on Ctrl+hover', (await page.evaluate(() => document.getElementById('cv').style.cursor)) === 'pointer');
  await page.mouse.click(cx, cy); await page.keyboard.up('Control'); await page.waitForTimeout(100);
  check('Ctrl+click opens', (await opened()).length === 1 && (await opened())[0] === o.href, JSON.stringify(await opened()));
  await page.mouse.move(cx, cy + 5);
  check('cursor back to default without Ctrl', (await page.evaluate(() => document.getElementById('cv').style.cursor)) !== 'pointer');
  // glisser = déplacer, sans ouvrir
  await page.evaluate(() => window.__opened.length = 0);
  await page.keyboard.down('Control'); await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 80, cy + 40, { steps: 6 }); await page.mouse.up(); await page.keyboard.up('Control'); await page.waitForTimeout(100);
  const o2 = await lastObj();
  check('Ctrl+drag moves (no open)', (await opened()).length === 0 && Math.abs(o2.x - o.x) > 30 && o2.href === o.href, JSON.stringify({ dx: o2.x - o.x, href: o2.href }));
  // duplication et déplacement gardent le lien
  await page.keyboard.press('Control+d'); await page.waitForTimeout(100);
  const o3 = await lastObj(); check('duplicate keeps href', o3.id !== o2.id && o3.href === o2.href);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(80);

  // 6. présentation : laser + clic = ouvre ; glisser = laser ; stylo = pas d'ouverture
  await page.evaluate(() => window.__opened.length = 0);
  await page.evaluate(() => { __piverdraw.S.sel.clear(); });
  await page.click('#btnPresent'); await page.waitForTimeout(400);
  check('presenting', await page.evaluate(() => __piverdraw.S.presenting === true && __piverdraw.S.tool === 'laser'), await page.evaluate(() => __piverdraw.S.tool));
  const cur = await lastObj(); const [px, py] = await centerOf(cur);
  await page.mouse.move(px + 2, py + 2); await page.mouse.move(px, py);
  check('presentation: pointer cursor on QR', (await page.evaluate(() => document.getElementById('cv').style.cursor)) === 'pointer');
  await page.mouse.click(px, py); await page.waitForTimeout(100);
  check('presentation click opens', (await opened()).length === 1 && (await opened())[0] === cur.href, JSON.stringify(await opened()));
  await page.evaluate(() => window.__opened.length = 0);
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 60, py + 10, { steps: 5 }); const laserN = await page.evaluate(() => 1); await page.mouse.up(); await page.waitForTimeout(80);
  check('presentation drag does not open', (await opened()).length === 0);
  await page.mouse.click(px - 400, py); check('click elsewhere does not open', (await opened()).length === 0);
  await page.evaluate(() => { document.querySelector('[data-ptool="pen"]').click(); });
  const nBefore = await page.evaluate(() => __piverdraw.page().objects.length);
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 40, py + 40, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(80);
  check('pen tool draws over QR (no open)', (await opened()).length === 0 && await page.evaluate(n => __piverdraw.page().objects.length === n + 1, nBefore));
  await page.screenshot({ path: 'shot-qr-present.png' });
  // popup bloquée → boîte de dialogue de secours
  await page.evaluate(() => { document.querySelector('[data-ptool="laser"]').click(); window.__openRet = 'blocked'; });
  await page.mouse.click(px, py); await page.waitForTimeout(200);
  const fb = await page.evaluate(() => { const m = document.getElementById('modal'); const a = m.querySelector('.linkbox a'); return { open: !!m.firstChild, href: a && a.href, rel: a && a.rel, target: a && a.target, txt: m.textContent.slice(0, 80) }; });
  check('blocked popup → fallback dialog with link', fb.open && fb.href === cur.href && /noopener/.test(fb.rel) && fb.target === '_blank', JSON.stringify(fb));
  await page.screenshot({ path: 'shot-link-fallback.png' });
  await page.click('.dlg .btn.line'); await page.waitForTimeout(100);
  check('copy button', /copié/.test(await page.textContent('.dlg .btn.line')));
  await page.keyboard.press('Escape'); await page.evaluate(() => { window.__openRet = 'ok'; });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check('left presentation', await page.evaluate(() => !__piverdraw.S.presenting));

  // 7. persistance + filtrage des liens dangereux
  await page.waitForTimeout(1200); await page.reload(); await page.waitForTimeout(800);
  const hrefs = await page.evaluate(() => __piverdraw.page().objects.filter(o => o.t === 'img').map(o => o.href || null));
  check('hrefs survive reload', hrefs.length === 2 && hrefs.includes('https://learningapps.org/view12345?x=%C3%A9') && hrefs.includes(null), JSON.stringify(hrefs));
  const proj = await page.evaluate(() => { const o = __piverdraw.page().objects.find(o => o.t === 'img' && o.href); return { app: 'piverdraw', v: 1, name: 'T', cur: 0, pages: [{ id: 'p', bg: 'blank', frame: { x: 0, y: 0, w: 1600, h: 900 }, objects: [
    { t: 'img', id: 'a', iid: 'i1', x: 10, y: 10, w: 100, h: 100, href: 'javascript:alert(1)' },
    { t: 'img', id: 'b', iid: 'i1', x: 200, y: 10, w: 100, h: 100, href: 'https://ok.example/x' },
    { t: 'img', id: 'c', iid: 'i1', x: 400, y: 10, w: 100, h: 100, href: 'data:text/html,<script>1</script>' },
    { t: 'img', id: 'd', iid: 'i1', x: 600, y: 10, w: 100, h: 100, href: 'https://a b' } ] }], assets: { i1: __piverdraw.S.proj.assets[o.iid] } }; });
  fs.writeFileSync('evil.piverdraw.json', JSON.stringify(proj));
  await page.setInputFiles('#fileProj', 'evil.piverdraw.json'); await page.waitForTimeout(900);
  const hs = await page.evaluate(() => __piverdraw.page().objects.map(o => [o.id, o.href || null]));
  check('unsafe hrefs stripped on import, https kept', JSON.stringify(hs) === JSON.stringify([['a', null], ['b', 'https://ok.example/x'], ['c', null], ['d', null]]), JSON.stringify(hs));
  // objet importé avec href dangereux : Ctrl+clic n'ouvre rien
  await page.evaluate(() => window.__opened.length = 0);
  const [ax, ay] = await world(60, 60); await page.keyboard.press('v'); await page.keyboard.down('Control'); await page.mouse.click(ax, ay); await page.keyboard.up('Control'); await page.waitForTimeout(100);
  check('no open for stripped link', (await opened()).length === 0);
  const [bx, by] = await world(250, 60); await page.keyboard.down('Control'); await page.mouse.click(bx, by); await page.keyboard.up('Control'); await page.waitForTimeout(100);
  check('safe imported link opens', (await opened())[0] === 'https://ok.example/x', JSON.stringify(await opened()));

  // 8. mobile
  await page.setViewportSize({ width: 412, height: 860 }); await page.waitForTimeout(300);
  await openDlg(); await fillLink('https://www.geogebra.org/classic/abcd');
  const mob = await page.evaluate(() => { const d = document.querySelector('.dlg'); return { docW: document.documentElement.scrollWidth, vw: innerWidth, sw: d.scrollWidth, cw: d.clientWidth, boxes: [...document.querySelectorAll('.dlg .chk input')].map(i => { const r = i.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), r.right <= innerWidth]; }) }; });
  check('mobile: no horizontal overflow, 20px checkboxes', mob.docW <= mob.vw && mob.sw <= mob.cw && mob.boxes.every(b => b[0] >= 20 && b[2]), JSON.stringify(mob));
  await page.screenshot({ path: 'shot-mobile-qr2.png' });
  out('ERRORS', JSON.stringify(errors, null, 1));
  await browser.close();
})();
