// t25 : effacer la page en une fois ; angle de rotation mémorisé (bouton 0°) ; cadre de sélection qui pivote avec l'objet
const H = require('./h.js');
(async () => {
  const T = await H(), { page, check } = T;
  const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;
  const A = (f, arg) => page.evaluate(f, arg);
  const scr = async (w) => T.world(w.x, w.y);
  const dragW = async (a, b, mods = []) => { const P = await T.world(a.x, a.y), Q = await T.world(b.x, b.y); for (const m of mods) await page.keyboard.down(m);
    await page.mouse.move(...P); await page.mouse.down(); await page.mouse.move(...Q, { steps: 12 }); await page.mouse.up(); for (const m of mods) await page.keyboard.up(m); await page.waitForTimeout(150); };
  const frame = () => A(() => { const f = __piverdraw.selFrame(__piverdraw.page().objects.filter(o => __piverdraw.S.sel.has(o.id))); return f && { a: f.a, w: f.w, h: f.h, c: f.c, tl: f.tl, br: f.br }; });
  const handle = () => A(() => { const f = __piverdraw.selFrame(__piverdraw.page().objects.filter(o => __piverdraw.S.sel.has(o.id))); const r = __piverdraw.rotHandle(f, __piverdraw.view().z); return { x: r.x, y: r.y }; });

  // ---------- 1. Effacer la page (panneau des pages) ----------
  await T.add({ t: 'rect', x1: 100, y1: 100, x2: 200, y2: 160, color: '#d33' });
  await T.add({ t: 'stroke', pts: [[300, 300, .5], [400, 340, .5]] });
  await T.add({ t: 'text', x: 500, y: 500, text: 'Verrouillé', size: 30, locked: true });
  check('« Effacer la page » visible in the pages pane (any tool)', await page.isVisible('#pgClear'));
  let u = (await T.st()).undo;
  await page.click('#pgClear'); await page.waitForTimeout(100);
  let o = await T.objs();
  check('clear page: only the locked object remains, one undo step', o.length === 1 && o[0].locked && (await T.st()).undo === u + 1, JSON.stringify(o.map(q => q.t)));
  check('clear page: confirmation message', /Page effacée/.test(await page.textContent('#toast')));
  await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(100);
  check('Ctrl+Z brings everything back', (await T.objs()).length === 3);
  await page.click('#pgClear'); u = (await T.st()).undo; await page.click('#pgClear'); await page.waitForTimeout(100);
  check('already empty: no extra undo step, message', (await T.st()).undo === u && /déjà vide/.test(await page.textContent('#toast')));

  // ---------- 2. Trait : l'angle est mémorisé, bouton 0° ----------
  await T.fresh();
  const pts0 = [[300, 300, .5], [340, 260, .5], [380, 320, .5], [430, 280, .5]];
  await T.add({ t: 'stroke', pts: pts0, size: 4 });
  await page.click('[data-tool="select"]'); await T.click([340, 261]);
  check('stroke selected, no 0° button at 0°', (await T.st()).sel === 1 && !(await page.isVisible('#selUnrot')));
  await page.click('#selRot'); await page.waitForTimeout(80);
  o = (await T.objs())[0];
  check('90° button: stroke remembers ang = 90°', near(o.ang, Math.PI / 2), String(o.ang));
  check('0° button appears, title shows 90°', await page.isVisible('#selUnrot') && /90°/.test(await page.getAttribute('#selUnrot', 'title')));
  let f = await frame();
  check('selection frame follows the stroke angle (a = 90°)', near(f.a, Math.PI / 2), JSON.stringify(f));
  // poignée : on part de 90° et on tourne encore → l'angle continue depuis 90°, pas depuis 0°
  let hd = await handle(), c = f.c, r = Math.hypot(hd.x - c.x, hd.y - c.y), a1 = Math.atan2(hd.y - c.y, hd.x - c.x) + Math.PI / 4;
  await dragW(hd, { x: c.x + r * Math.cos(a1), y: c.y + r * Math.sin(a1) });
  o = (await T.objs())[0];
  check('handle rotation continues from the remembered angle (90° + 45° = 135°)', near(o.ang, 3 * Math.PI / 4, .02), String(o.ang * 180 / Math.PI));
  // retour à 0°
  u = (await T.st()).undo;
  await page.click('#selUnrot'); await page.waitForTimeout(80);
  o = (await T.objs())[0];
  const back = o.pts.every((p, i) => near(p[0], pts0[i][0], .01) && near(p[1], pts0[i][1], .01));
  check('0° button: stroke back to its original position, ang removed, one undo step', back && !('ang' in o) && (await T.st()).undo === u + 1, JSON.stringify(o.pts.map(p => p.map(Math.round))));
  check('0° button hidden again', !(await page.isVisible('#selUnrot')));
  // aimant : en tournant près de 0°, on retombe exactement à 0°
  await page.click('#selRot'); await page.waitForTimeout(80); f = await frame(); hd = await handle(); c = f.c; r = Math.hypot(hd.x - c.x, hd.y - c.y);
  const aBack = Math.atan2(hd.y - c.y, hd.x - c.x) - Math.PI / 2 + .02;   // -90° (+ un petit écart) → angle réel ≈ 0°
  await dragW(hd, { x: c.x + r * Math.cos(aBack), y: c.y + r * Math.sin(aBack) });
  o = (await T.objs())[0];
  check('magnet on the real angle: back near 0° snaps to exactly 0°', !('ang' in o), String(o.ang));

  // ---------- 3. Rectangle tourné : cadre orienté, agrandissement dans le repère tourné ----------
  await T.fresh(); await page.click('[data-tool="select"]');
  await T.add({ t: 'rect', x1: 200, y1: 260, x2: 400, y2: 340, fill: true, color: '#36c', rot: Math.PI / 4 });
  await T.click([300, 300]);
  f = await frame();
  check('rotated rect: frame turned 45°, same size as the rect (not inflated)', near(f.a, Math.PI / 4) && near(f.w, 203, 1.5) && near(f.h, 83, 1.5), JSON.stringify(f));
  await page.screenshot({ path: 'shot-rot-frame.png' });
  const br = f.br, out = { x: br.x + (f.br.x - f.c.x) * .5, y: br.y + (f.br.y - f.c.y) * .5 };
  await dragW(br, out);
  o = (await T.objs())[0];
  check('scale handle at the rotated corner: rect grows, keeps 45°', near(o.rot, Math.PI / 4) && Math.abs(o.x2 - o.x1) > 230, JSON.stringify(o));
  f = await frame();
  check('after scaling: frame still turned 45°', near(f.a, Math.PI / 4));

  // ---------- 4. Groupe : même angle → cadre orienté ; angles différents → cadre droit ----------
  await T.fresh(); await page.click('[data-tool="select"]');
  await T.add({ t: 'stroke', pts: [[300, 300, .5], [400, 300, .5]], size: 4 });
  await T.add({ t: 'stroke', pts: [[300, 340, .5], [400, 340, .5]], size: 4 });
  await page.keyboard.press('ControlOrMeta+a'); await page.waitForTimeout(80);
  await A(() => document.getElementById('selRot').click()); await page.waitForTimeout(80);
  o = await T.objs(); f = await frame();
  check('two strokes rotated together: same ang, oriented frame', near(o[0].ang, Math.PI / 2) && near(o[1].ang, Math.PI / 2) && near(f.a, Math.PI / 2));
  await T.add({ t: 'stroke', pts: [[600, 300, .5], [700, 300, .5]], size: 4 });
  await page.keyboard.press('ControlOrMeta+a'); await page.waitForTimeout(80); f = await frame();
  check('mixed angles: straight frame, no 0° button', near(f.a, 0) && !(await page.isVisible('#selUnrot')));

  // ---------- 5. Persistance et import piégé ----------
  const ser = await A(() => JSON.stringify(__piverdraw.serialize()));
  await A(s => __piverdraw.loadProject(__piverdraw.normalize(JSON.parse(s))), ser); await page.waitForTimeout(100);
  o = await T.objs();
  check('ang kept after save/reload', near(o[0].ang, Math.PI / 2) && near(o[1].ang, Math.PI / 2) && !('ang' in o[2]));
  const bad = await A(() => { const d = __piverdraw.normalize({ v: 1, pages: [{ id: 'p', objects: [
    { t: 'stroke', id: 'a', color: '#000', size: 3, pts: [[0, 0, .5], [9, 9, .5]], ang: 1e300 },
    { t: 'stroke', id: 'b', color: '#000', size: 3, pts: [[0, 0, .5], [9, 9, .5]], ang: 'x' },
    { t: 'rect', id: 'c', color: '#000', size: 3, x1: 0, y1: 0, x2: 9, y2: 9, ang: 1 },
    { t: 'line', id: 'd', color: '#000', size: 3, x1: 0, y1: 0, x2: 9, y2: 9, ang: 7 } ] }] }); return d.pages[0].objects.map(o => o.ang); });
  check('booby-trapped import: huge/non-numeric/misplaced ang dropped, valid one wrapped', bad[0] === undefined && bad[1] === undefined && bad[2] === undefined && near(bad[3], 7 - 2 * Math.PI), JSON.stringify(bad));
  console.log('errors', JSON.stringify(T.errors)); await T.browser.close();

  // ---------- 6. Mobile 360 px : bouton « Effacer la page » et barre de sélection avec 0° ----------
  const M = await H({ viewport: { width: 360, height: 740 }, touch: true });
  await M.add({ t: 'rect', x1: 200, y1: 260, x2: 400, y2: 340, fill: true, color: '#36c', rot: Math.PI / 6 });
  await M.page.click('[data-tool="select"]'); await M.click([300, 300]); await M.page.waitForTimeout(100);
  const m = await M.page.evaluate(() => { const b = document.getElementById('pgClear').getBoundingClientRect(), u = document.getElementById('selUnrot').getBoundingClientRect();
    return { cw: b.width, ch: b.height, inView: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, unrot: !document.getElementById('selUnrot').hidden, uw: u.width, sw: document.documentElement.scrollWidth, w: innerWidth }; });
  M.check('360 px: « Effacer la page » visible, ≥ 34 px; 0° button shown; no horizontal overflow', m.inView && m.cw >= 34 && m.ch >= 34 && m.unrot && m.uw >= 34 && m.sw <= m.w, JSON.stringify(m));
  await M.page.screenshot({ path: 'shot-rot-360.png' });
  console.log('errors', JSON.stringify(M.errors)); await M.browser.close();
})();
