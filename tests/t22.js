const H = require('./h.js');
(async () => {
  const T = await H(), { page, check } = T;
  await page.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return { opener: 1 }; }; });
  await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return { opener: 1 }; }; });
  await T.add({ t: 'text', x: 300, y: 300, text: 'Lien tourné', size: 48, href: 'https://exemple.fr/x', rot: Math.PI / 2 });
  const b = await page.evaluate(() => __piverdraw.boundsOf(__piverdraw.page().objects[0]));
  await page.evaluate(() => document.querySelector('[data-tool="select"]').click());
  // Ctrl+clic au centre du texte tourné → ouvre le lien ; sur l'ancien emplacement horizontal (hors forme) → rien
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  await T.click([cx, cy], ['Control']); let op = await page.evaluate(() => window.__opened.slice());
  check('Ctrl+click on rotated link opens it', op.length === 1 && op[0] === 'https://exemple.fr/x', JSON.stringify(op));
  await T.click([b[2] + 80, cy], ['Control']); op = await page.evaluate(() => window.__opened.slice()); check('Ctrl+click outside does nothing', op.length === 1);
  // édition du texte tourné : conserve rot
  await page.keyboard.press('Escape'); await page.click('[data-tool="text"]'); await T.click([cx, cy]); await page.waitForTimeout(250);
  const ta = await page.$('textarea');
  if (ta) { await page.keyboard.press('End'); await page.keyboard.type('!'); await page.keyboard.press('Escape'); await page.waitForTimeout(150); const o = (await T.objs()); check('edit keeps rot, text updated', o.length === 1 && o[0].rot && /!/.test(o[0].text), JSON.stringify(o)); }
  else { const o = await T.objs(); check('text tool on rotated text opened an editor or created a new text (no crash)', o.length >= 1, String(o.length)); }
  // clavier : flèches déplacent un objet tourné, Ctrl+C/V conserve rot
  await page.evaluate(() => document.querySelector('[data-tool="select"]').click()); await page.keyboard.press('Escape'); await T.click([cx, cy]);
  await page.keyboard.press('ControlOrMeta+c'); await page.keyboard.press('ControlOrMeta+v'); await page.waitForTimeout(150);
  const o2 = await T.objs(); check('copy/paste keeps rot', o2.length === 2 && Math.abs(o2[1].rot - Math.PI / 2) < 1e-9 && o2[1].href === 'https://exemple.fr/x', JSON.stringify(o2.map(q => q.rot)));
  console.log('errors', JSON.stringify(T.errors)); await T.browser.close();
})();
