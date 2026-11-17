const qrOpen = require('./qropen.js');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = (...a) => console.log(...a);
const SAVED = (b64, f) => fs.writeFileSync(f, Buffer.from(b64, 'base64'));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(() => {
    window.__saved = [];
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
  await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(100);

  // 1. état initial
  await qrOpen(page, false); await page.waitForSelector('#shareUrl');
  check('input empty at start', (await page.inputValue('#shareUrl')) === '');
  check('placeholder', /Collez/.test(await page.getAttribute('#shareUrl', 'placeholder')));
  check('canvas hidden + message', await page.$eval('#qrCv', e => e.hidden) && /Collez un lien/.test(await page.textContent('#qrMsg')));
  check('png/place disabled', await page.$eval('#qrPng', e => e.disabled) && await page.$eval('#qrPlace', e => e.disabled));
  check('paste button next to field', await page.evaluate(() => { const a = document.getElementById('shareUrl').getBoundingClientRect(), b = document.getElementById('qrPaste').getBoundingClientRect(); return Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)) < 4 && b.left >= a.right - 1; }));
  check('paste button has icon + >=36px', await page.evaluate(() => { const b = document.getElementById('qrPaste'); const r = b.getBoundingClientRect(); return !!b.querySelector('svg path') && r.width >= 36 && r.height >= 36; }));
  check('no artifact url in dialog', !/claude\.ai/.test(await page.evaluate(() => document.getElementById('modal').innerHTML)));
  check('6 swatches', (await page.$$('.qrsw')).length === 6);
  await page.screenshot({ path: 'shot-qr-empty.png' });

  // 2. bouton coller avec presse-papiers accessible
  await page.evaluate(() => navigator.clipboard.writeText('  exemple.fr/exo?id=12  '));
  await page.click('#qrPaste'); await page.waitForSelector('#qrCv:not([hidden])');
  check('paste button fills field', (await page.inputValue('#shareUrl')) === 'exemple.fr/exo?id=12', await page.inputValue('#shareUrl'));
  check('encoded caption has https://', /Encodé : https:\/\/exemple\.fr\/exo\?id=12$/.test(await page.textContent('#qrEnc')), await page.textContent('#qrEnc'));
  check('png/place enabled', !(await page.$eval('#qrPng', e => e.disabled)));

  // 3. bouton coller sans accès au presse-papiers
  await page.click('#qrClear'); await page.waitForTimeout(100);
  check('clear empties', (await page.inputValue('#shareUrl')) === '' && await page.$eval('#qrCv', e => e.hidden));
  await page.evaluate(() => { navigator.clipboard.readText = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
  await page.click('#qrPaste'); await page.waitForTimeout(150);
  check('fallback hint shown + input focused', /Ctrl\+V/.test(await page.textContent('#qrHint')) && await page.evaluate(() => document.activeElement.id === 'shareUrl'));
  // 3b. événement paste (Ctrl+V / appui long > Coller) dans le champ
  await page.evaluate(() => { const i = document.getElementById('shareUrl'); const dt = new DataTransfer(); dt.setData('text/plain', 'https://www.geogebra.org/classic/abcd'); i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await page.waitForSelector('#qrCv:not([hidden])');
  check('paste event in field fills', (await page.inputValue('#shareUrl')) === 'https://www.geogebra.org/classic/abcd', await page.inputValue('#shareUrl'));
  check('hint cleared after paste', (await page.textContent('#qrHint')) === '');
  // 3c. Ctrl+V alors que le focus est ailleurs dans la boîte de dialogue
  await page.evaluate(() => { document.getElementById('qrClear').click(); document.querySelector('.dlg').focus(); const dt = new DataTransfer(); dt.setData('text/plain', 'https://learningapps.org/123'); document.querySelector('.dlg').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await page.waitForTimeout(250);
  check('paste on dialog fills', (await page.inputValue('#shareUrl')) === 'https://learningapps.org/123');
  const nObj0 = await page.evaluate(() => __piverdraw.page().objects.length);

  // 4. couleurs + transparence + décodage
  const links = ['https://www.geogebra.org/classic/abcd', 'https://exemple.fr/é?x=ç&y=2', 'Bonjour à tous — exercice 3'];
  const expected = ['https://www.geogebra.org/classic/abcd', 'https://exemple.fr/%C3%A9?x=%C3%A7&y=2', 'Bonjour à tous — exercice 3'];
  const sw = await page.$$eval('.qrsw', els => els.map(e => [e.dataset.color, e.title]));
  out('swatches', JSON.stringify(sw));
  for (let li = 0; li < links.length; li++) {
    await page.fill('#shareUrl', links[li]); await page.waitForSelector('#qrCv:not([hidden])'); await page.waitForTimeout(350);
    check('caption link ' + li, (await page.textContent('#qrEnc')) === 'Encodé : ' + expected[li], await page.textContent('#qrEnc'));
    for (let ci = 0; ci < sw.length; ci++) {
      if (li > 0 && ci > 1) continue;
      await page.click(`.qrsw >> nth=${ci}`); await page.waitForTimeout(80);
      const px = await page.evaluate(() => {
        const c = document.getElementById('qrCv'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
        let a0 = 0, ca = 0, col = null, other = 0; const cnt = {};
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] === 0) a0++; else { ca++; const k = [d[i], d[i + 1], d[i + 2], d[i + 3]].join(','); cnt[k] = (cnt[k] || 0) + 1; } }
        return { corner: [...g.getImageData(0, 0, 1, 1).data], transparentShare: a0 / (d.length / 4), colors: cnt };
      });
      const want = sw[ci][0].replace('#', ''); const rgb = [0, 2, 4].map(i => parseInt(want.substr(i, 2), 16)); const ks = Object.keys(px.colors);
      check(`li${li} color ${sw[ci][1]} ${sw[ci][0]}: modules are exactly that colour & rest alpha 0`, ks.length === 1 && ks[0] === rgb.concat(255).join(',') && px.corner[3] === 0 && px.transparentShare > 0.4, JSON.stringify({ ks, corner: px.corner, share: px.transparentShare.toFixed(2) }));
      check(`li${li} aria-pressed ${ci}`, (await page.getAttribute(`.qrsw >> nth=${ci}`, 'aria-pressed')) === 'true');
      // PNG enregistré
      await page.evaluate(() => { window.__saved.length = 0; });
      await page.click('#qrPng'); await page.waitForTimeout(350);
      const sv = await page.evaluate(() => window.__saved.map(x => ({ f: x.filename, b: x.b64 })));
      if (sv.length !== 1) { check('png saved', false, JSON.stringify(sv.map(x => x.f))); continue; }
      SAVED(sv[0].b, `qrs_${li}_${ci}.png`);
    }
  }
  fs.writeFileSync('qr_expected.json', JSON.stringify({ expected, nColors: sw.length }));
  await page.screenshot({ path: 'shot-qr-colors.png' });

  // 5. mémorisation de la couleur
  await page.click('.qrsw >> nth=3'); const col3 = await page.getAttribute('.qrsw >> nth=3', 'data-color');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  check('dialog closes on Escape', !(await page.evaluate(() => !!document.getElementById('modal').firstChild)));
  await qrOpen(page, false); await page.waitForSelector('#shareUrl');
  check('colour remembered', (await page.getAttribute('.qrsw[aria-pressed="true"]', 'data-color')) === col3);
  check('link not remembered (empty again)', (await page.inputValue('#shareUrl')) === '');

  // 6. placer sur la page (fond transparent conservé)
  await page.fill('#shareUrl', 'https://www.geogebra.org/classic/abcd'); await page.waitForSelector('#qrCv:not([hidden])'); await page.waitForTimeout(300);
  await page.click('#qrPlace'); await page.waitForTimeout(200);
  const placed = await page.evaluate(async () => {
    const o = __piverdraw.page().objects.slice(-1)[0], url = __piverdraw.S.proj.assets[o.iid];
    const img = new Image(); img.src = url; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return { t: o.t, w: o.w, h: o.h, corner: [...g.getImageData(0, 0, 1, 1).data], dialog: !!document.getElementById('modal').firstChild, n: __piverdraw.page().objects.length, size: img.width };
  });
  check('QR placed as transparent image', placed.t === 'img' && placed.corner[3] === 0 && !placed.dialog && placed.n === nObj0 + 1, JSON.stringify(placed));
  // fond coloré sous le QR : on dessine un rectangle jaune pâle derrière et on photographie
  await page.screenshot({ path: 'shot-qr-placed.png' });

  // 7. page noire
  await page.selectOption('#bgSel', 'noir'); await page.waitForTimeout(150);
  await qrOpen(page, false); await page.waitForSelector('#shareUrl');
  const dk = await page.evaluate(() => ({ cols: [...document.querySelectorAll('.qrsw')].map(e => e.dataset.color), note: /fond noir/.test(document.querySelector('.dlg').textContent), box: getComputedStyle(document.getElementById('qrBox') || document.querySelector('.qrbox')).backgroundColor }));
  check('dark page: light palette + note + dark preview', dk.cols[0] === '#f7f7f2' && dk.note && /rgb\(30, 42, 38\)/.test(dk.box), JSON.stringify(dk));
  await page.fill('#shareUrl', 'https://www.geogebra.org/classic/abcd'); await page.waitForSelector('#qrCv:not([hidden])'); await page.waitForTimeout(300);
  await page.screenshot({ path: 'shot-qr-dark.png' });
  await page.evaluate(() => { window.__saved.length = 0; }); await page.click('#qrPng'); await page.waitForTimeout(350);
  const svd = await page.evaluate(() => window.__saved.map(x => x.b64)); if (svd[0]) SAVED(svd[0], 'qrs_dark.png');
  await page.keyboard.press('Escape'); await page.selectOption('#bgSel', 'blank');

  // 8. lien trop long
  await qrOpen(page, false); await page.waitForSelector('#shareUrl');
  await page.fill('#shareUrl', 'x'.repeat(4000)); await page.waitForTimeout(500);
  check('too long message', /trop long/.test(await page.textContent('#qrMsg')) && await page.$eval('#qrPlace', e => e.disabled), await page.textContent('#qrMsg'));
  await page.fill('#shareUrl', 'https://a.fr'); await page.waitForTimeout(400);
  check('recovers after error', !(await page.$eval('#qrCv', e => e.hidden)));
  await page.keyboard.press('Escape');

  // 9. mobile
  await page.setViewportSize({ width: 412, height: 860 }); await page.waitForTimeout(300);
  await qrOpen(page, false); await page.waitForSelector('#shareUrl');
  await page.fill('#shareUrl', 'https://www.geogebra.org/classic/abcd'); await page.waitForSelector('#qrCv:not([hidden])'); await page.waitForTimeout(300);
  const mob = await page.evaluate(() => { const d = document.querySelector('.dlg'), r = d.getBoundingClientRect(); return { docW: document.documentElement.scrollWidth, vw: innerWidth, dlgR: r.right, dlgL: r.left, dlgScrollW: d.scrollWidth, dlgClientW: d.clientWidth, pasteVisible: (() => { const b = document.getElementById('qrPaste').getBoundingClientRect(); return b.right <= innerWidth && b.width >= 36; })(), btns: [...document.querySelectorAll('.dlg .acts .btn')].map(b => Math.round(b.getBoundingClientRect().right)) }; });
  check('mobile: no horizontal overflow', mob.docW <= mob.vw && mob.dlgScrollW <= mob.dlgClientW && mob.pasteVisible, JSON.stringify(mob));
  await page.screenshot({ path: 'shot-mobile-qr.png' });
  out('ERRORS', JSON.stringify(errors, null, 1));
  await browser.close();
})();
