const H = require('./h.js');
(async () => {
  const T = await H(), { page, check } = T;
  const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;
  // rect 200x80 centré (300,300)
  await T.add({ t: 'rect', x1: 200, y1: 260, x2: 400, y2: 340, fill: true, color: '#d33' });
  await page.click('[data-tool="select"]'); await T.click([300, 300]);
  check('selected', (await T.st()).sel === 1);
  // poignée de rotation : au-dessus du cadre, à ROT_OFF px
  const z = await page.evaluate(() => __piverdraw.view().z);
  const hx = 300, hy = 260 - 30 / z;
  let u = (await T.st()).undo;
  await T.drag([hx, hy], [300 + 100, 300], [], 10);       // vers la droite = +90°
  let o = (await T.objs())[0];
  check('drag handle to the right → rot = +π/2 (magnet 90°)', near(o.rot, Math.PI / 2), String(o.rot));
  check('center unchanged', near((o.x1 + o.x2) / 2, 300, .01) && near((o.y1 + o.y2) / 2, 300, .01));
  check('one undo step', (await T.st()).undo === u + 1);
  let bb = await page.evaluate(() => { const b = __piverdraw.boundsOf(__piverdraw.page().objects[0]); return b.map(v => Math.round(v)); });
  check('rotated bbox is ≈80×200 (+ stroke padding)', near(bb[2] - bb[0], 83, 1.5) && near(bb[3] - bb[1], 203, 1.5), JSON.stringify(bb));
  // hit test : le coin d'origine n'est plus dans la forme, un point sur l'axe vertical l'est
  const hits = await page.evaluate(() => { const o = __piverdraw.page().objects[0]; return [__piverdraw.hitObj(o, 300, 215, 4), __piverdraw.hitObj(o, 385, 300, 4)]; });
  check('hit test follows rotation (fill)', hits[0] === true && hits[1] === false, JSON.stringify(hits));
  // Shift : pas de 15°
  await page.click('[data-tool="select"]'); await T.click([300, 300]).catch(() => {});
  await page.keyboard.press('Escape'); await T.click([300, 300]);
  const b2 = await page.evaluate(() => { const b = __piverdraw.boundsOf(__piverdraw.page().objects[0]); const v = __piverdraw.view(); return { y0: b[1], x: (b[0] + b[2]) / 2, z: v.z }; });
  await T.drag([b2.x, b2.y0 - 30 / b2.z], [300 + 200, 300 - 200 * Math.tan(.38) * 0 - 60], ['Shift'], 12);
  o = (await T.objs())[0]; const step = Math.PI / 12; check('Shift snaps to 15° multiples', near(((o.rot / step) % 1 + 1) % 1 < .5 ? (o.rot / step) % 1 : 1 - (o.rot / step) % 1, 0, 1e-3) || Math.abs(o.rot / step - Math.round(o.rot / step)) < 1e-3, String(o.rot * 180 / Math.PI));
  // bouton 90°
  await page.keyboard.press('Escape'); await T.fresh();
  await T.add({ t: 'rect', x1: 200, y1: 260, x2: 400, y2: 340, fill: false });
  await T.add({ t: 'line', x1: 100, y1: 100, x2: 200, y2: 100 });
  await page.click('[data-tool="select"]'); await page.keyboard.press('ControlOrMeta+a'); await page.waitForTimeout(100);
  u = (await T.st()).undo; await page.click('#selRot'); await page.waitForTimeout(100); o = await T.objs();
  check('Pivoter 90° on a selection: both rotated, 1 undo', (await T.st()).undo === u + 1 && near(o[0].rot, Math.PI / 2) && o[1].t === 'line' && near(o[1].x1, o[1].x2, 1e-6) , JSON.stringify(o.map(q => q.rot)));
  await page.click('#selRot'); await page.click('#selRot'); await page.click('#selRot'); await page.waitForTimeout(100); o = await T.objs();
  check('4× rotate → back to start (rot removed, line horizontal)', o[0].rot === undefined && near(o[1].y1, o[1].y2, 1e-6) && near(o[1].x2 - o[1].x1, 100, 1e-6), JSON.stringify(o));
  // traits : rotation baked dans les points
  await T.fresh(); await T.add({ t: 'stroke', pts: [[100, 100, .5], [200, 100, .5], [200, 150, .5]] });
  await page.click('[data-tool="select"]'); await page.keyboard.press('ControlOrMeta+a'); await page.click('#selRot'); await page.waitForTimeout(100); o = await T.objs();
  check('stroke rotated by baking points (no rot field)', o[0].rot === undefined && o[0].pts.length === 3 && near(o[0].pts[0][0], o[0].pts[1][0], 1e-6));
  // texte et image tournés : bounds + rendu
  await T.fresh(); await T.add({ t: 'text', x: 200, y: 200, text: 'Pivot', size: 48 });
  await page.click('[data-tool="select"]'); await page.keyboard.press('ControlOrMeta+a'); await page.waitForTimeout(80);
  const r0 = await page.evaluate(() => { const b = __piverdraw.boundsOf(__piverdraw.page().objects[0]); return [b[2] - b[0], b[3] - b[1]]; });
  await page.click('#selRot'); await page.waitForTimeout(100);
  const r1 = await page.evaluate(() => { const b = __piverdraw.boundsOf(__piverdraw.page().objects[0]); return [b[2] - b[0], b[3] - b[1]]; });
  check('text rotated: bbox width/height swap', near(r0[0], r1[1], 1.5) && near(r0[1], r1[0], 1.5), JSON.stringify([r0, r1]));
  await page.keyboard.press('Escape'); await page.mouse.move(5, 790); await page.screenshot({ path: 'shot-rot-text.png' });
  // pixels : le texte tourné est bien dessiné dans le cadre vertical
  const px = await page.evaluate(() => { const o = __piverdraw.page().objects[0], b = __piverdraw.boundsOf(o), v = __piverdraw.view(), cv = document.getElementById('cv'), g = cv.getContext('2d'), d = cv.width / cv.getBoundingClientRect().width;
    const x0 = Math.round((v.tx + b[0] * v.z) * d), y0 = Math.round((v.ty + b[1] * v.z) * d), w = Math.round((b[2] - b[0]) * v.z * d), h = Math.round((b[3] - b[1]) * v.z * d); const data = g.getImageData(x0, y0, w, h).data; let dark = 0; for (let i = 0; i < data.length; i += 4) if (data[i] < 80 && data[i + 1] < 80) dark++; return dark; });
  check('rotated text has ink inside its rotated bbox', px > 200, String(px));
  // exports : le PNG contient la rotation (même résultat que l'écran)
  const exp = await page.evaluate(() => { const { canvas, r } = __piverdraw.renderExport(__piverdraw.page(), 2000, 1); const g = canvas.getContext('2d'), d = g.getImageData(0, 0, canvas.width, canvas.height).data; let dark = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < d.length; i += 4) if (d[i] < 80 && d[i + 1] < 80 && d[i + 3] > 200) { dark++; const k = i / 4, x = k % canvas.width, y = (k / canvas.width) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { dark, w: x1 - x0, h: y1 - y0 }; });
  check('export contains rotated ink, tall & narrow', exp.dark > 200 && exp.h > exp.w, JSON.stringify(exp));

  // image tournée + échelle uniforme
  await T.fresh();
  await T.add({ t: 'rect', x1: 200, y1: 200, x2: 300, y2: 240, fill: false, rot: .6 });
  await page.click('[data-tool="select"]'); await page.keyboard.press('ControlOrMeta+a'); await page.waitForTimeout(80);
  const bs = await page.evaluate(() => { const b = __piverdraw.boundsOf(__piverdraw.page().objects[0]); return b; });
  await T.drag([bs[2], bs[3]], [bs[2] + 80, bs[3] + 5], ['Shift'], 8); o = (await T.objs())[0];
  const ar = Math.hypot(o.x2 - o.x1, 0) / Math.hypot(0, o.y2 - o.y1);
  check('scaling a rotated rect stays uniform (no skew), keeps rot', near(o.rot, .6) && near(ar, 100 / 40, .05), JSON.stringify(o));

  // persistance + normalisation
  const ser = await page.evaluate(() => JSON.stringify(__piverdraw.serialize()));
  check('serialize keeps rot', /"rot":0\.6/.test(ser));
  const bad = await page.evaluate(() => { const d = __piverdraw.normalize({ v: 1, pages: [{ id: 'p', objects: [
    { t: 'rect', id: 'a', x1: 0, y1: 0, x2: 10, y2: 10, rot: 'x', gid: 5, locked: 'yes', clone: 1 },
    { t: 'line', id: 'b', x1: 0, y1: 0, x2: 10, y2: 10, rot: 1 },
    { t: 'rect', id: 'c', x1: 0, y1: 0, x2: 10, y2: 10, rot: 1.2, gid: 'abc', locked: true, clone: true },
    { t: 'rect', id: 'd', x1: 0, y1: 0, x2: 10, y2: 10, rot: Infinity, gid: 'x'.repeat(40) }] }] }); return JSON.stringify(d.pages ? d.pages[0].objects : d); }).catch(e => 'ERR ' + e);
  const bo = (() => { try { return JSON.parse(bad); } catch (_) { return null; } })();
  check('normalize strips bad rot/gid/locked/clone', bo && bo[0].rot === undefined && bo[0].gid === undefined && bo[0].locked === undefined && bo[0].clone === undefined && bo[1].rot === undefined && bo[2].rot === 1.2 && bo[2].gid === 'abc' && bo[2].locked === true && bo[2].clone === true && bo[3].rot === undefined && bo[3].gid === undefined, bad.slice(0, 400));

  // gomme partielle sur forme tournée : le contour tourne
  await T.fresh(); await T.add({ t: 'rect', x1: 200, y1: 260, x2: 400, y2: 340, fill: false, rot: Math.PI / 2 });
  await page.click('[data-tool="eraser"]'); await T.click([300, 200]);   // sur le côté haut après rotation (point du bord)
  o = await T.objs(); check('eraser hits the rotated outline (cut or removed)', o.length !== 1 || o[0].t !== 'rect', JSON.stringify(o.map(q => q.t)));
  // poignée en bas quand l'objet est tout en haut de l'écran
  await T.fresh(); await T.add({ t: 'rect', x1: 200, y1: 2, x2: 300, y2: 40, fill: true });
  await page.click('[data-tool="select"]'); await page.evaluate(() => { const v = __piverdraw.view(); }); await T.click([250, 20]);
  const rh = await page.evaluate(() => { const v = __piverdraw.view(); return { ty: v.ty, z: v.z }; });
  await page.mouse.move(5, 790); await page.screenshot({ path: 'shot-rot-top.png' });
  const flip = rh.ty + 2 * rh.z - 30 < 90;
  const hyx = flip ? 40 + 30 / rh.z : 2 - 30 / rh.z; let u2 = (await T.st()).undo;
  await T.drag([250, hyx], [350, hyx + 20], [], 6); check('handle reachable when near the top edge (placed below)', (await T.objs())[0].rot !== undefined, JSON.stringify((await T.objs())[0]));
  console.log('errors', JSON.stringify(T.errors)); await T.browser.close();
})();
