const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = (...a) => console.log(...a);
const MM = 96 / 25.4;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    window.__saved = [];
    window.claude = { use: async (n) => n === 'downloads' ? { save: async (r) => {
      const blob = r.data instanceof Blob ? r.data : new Blob([r.data]);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      window.__saved.push({ filename: r.filename, size: buf.length, b64: btoa(s) });
      return { status: 'saved' };
    } } : null };
  });
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push('[console.error] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://localhost')) return route.continue();
    if (u.includes('qrcode-generator')) return route.fulfill({ path: path.join(__dirname, '..', 'site', 'vendor', 'qrcode.js'), contentType: 'application/javascript' });
    return route.abort();
  });
  await page.goto('http://localhost:8765/index.html');
  await page.waitForTimeout(600);
  const check = (name, cond, extra = '') => out((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : ''));
  const world = (x, y) => page.evaluate(([x, y]) => { const v = __piverdraw.view(), r = document.getElementById('cv').getBoundingClientRect(); return [r.left + v.tx + x * v.z, r.top + v.ty + y * v.z]; }, [x, y]);
  const drag = async (pts, opts = {}) => {
    const [x0, y0] = await world(...pts[0]); await page.mouse.move(x0, y0);
    if (opts.shift) await page.keyboard.down('Shift');
    await page.mouse.down();
    for (const p of pts.slice(1)) { const [x, y] = await world(...p); await page.mouse.move(x, y, { steps: 6 }); }
    await page.mouse.up();
    if (opts.shift) await page.keyboard.up('Shift');
  };
  const st = () => page.evaluate(() => ({ n: __piverdraw.page().objects.length, insts: __piverdraw.S.insts.map(i => ({ ...i })), z: __piverdraw.view().z }));
  const lastStroke = () => page.evaluate(() => { const o = __piverdraw.page().objects; return o[o.length - 1]; });
  const W = (i, u, v) => [i.x + u * Math.cos(i.a) - v * Math.sin(i.a), i.y + u * Math.sin(i.a) + v * Math.cos(i.a)];
  const toggle = async (k) => { await page.click('#btnInst'); await page.click(`[data-inst="${k}"]`); };

  await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(100);
  await page.keyboard.press('p');

  // ---- équerre 45° ----
  await toggle('sq45'); let s = await st(); check('square added', s.insts.length === 1 && s.insts[0].k === 'sq45');
  let i = s.insts[0];
  const A = 200 * MM, c3 = A / 3, V0 = [-c3, -c3];
  // leg 1: from V0 along +u at v=V0.v ; pen just outside (v - 4)
  let a0 = W(i, V0[0] + 40, V0[1] - 5), a1 = W(i, V0[0] + 160, V0[1] - 30);
  await drag([a0, a1]);
  let o = await lastStroke(); let dist = Math.abs(o.pts[0][1] - W(i, 0, V0[1])[1]);
  const along = (pt) => { const dx = pt[0] - W(i, V0[0], V0[1])[0], dy = pt[1] - W(i, V0[0], V0[1])[1]; return [dx * Math.cos(i.a) + dy * Math.sin(i.a), -dx * Math.sin(i.a) + dy * Math.cos(i.a)]; };
  const l0 = along(o.pts[0]), l1 = along(o.pts[1]);
  check('square leg snap straight on edge', o.t === 'stroke' && o.pts.length === 2 && Math.abs(l0[1]) < .01 && Math.abs(l1[1]) < .01 && Math.abs(l1[0] - 160 + 0) < 200, JSON.stringify([l0, l1].map(p => p.map(v => +v.toFixed(1)))));
  // hypotenuse snap
  const hm = W(i, (A - c3 + (-c3)) / 2, (-c3 + A - c3) / 2);
  const nrm = [1 / Math.SQRT2, 1 / Math.SQRT2];
  const hstart = [W(i, A - c3, -c3)[0], W(i, A - c3, -c3)[1]];
  // outside hypotenuse: take the midpoint plus 5 units along outward normal (in local), then drag along it
  const pOut = (t, d) => W(i, (A - c3) + (-A) * t + nrm[0] * d, (-c3) + A * t + nrm[1] * d);
  const before = (await st()).n;
  await drag([pOut(.3, 5), pOut(.7, 30)]);
  o = await lastStroke(); const dHyp = (pt) => { const l = along(pt); return (l[0] + l[1] - A) / Math.SQRT2; };
  check('square hypotenuse snap', (await st()).n === before + 1 && o.pts.length === 2 && Math.abs(dHyp(o.pts[0])) < .01 && Math.abs(dHyp(o.pts[1])) < .01, JSON.stringify(o.pts.map(p => +dHyp(p).toFixed(3))));
  // move square by body
  const bodyPt = W(i, V0[0] + 80, V0[1] + 80);
  await drag([bodyPt, [bodyPt[0] + 100, bodyPt[1] + 40]]);
  s = await st(); check('square moved', Math.abs(s.insts[0].x - i.x - 100) < 1 && Math.abs(s.insts[0].y - i.y - 40) < 1, `dx=${(s.insts[0].x - i.x).toFixed(1)}`);
  i = s.insts[0];
  // rotate through handle
  const zz = s.z, hyp = Math.hypot(A, A), mx = (A - c3 + -c3) / 2, my = (-c3 + A - c3) / 2;
  const rotH = W(i, mx + (A / hyp) * 20 / zz, my + (A / hyp) * 20 / zz);
  const ctr = [i.x, i.y];
  await drag([rotH, [ctr[0] + 400, ctr[1] + 150]]);
  s = await st(); check('square rotated', Math.abs(s.insts[0].a) > .2, 'a=' + s.insts[0].a.toFixed(2));
  await page.screenshot({ path: 'shot-square.png' });
  // 60° variant replaces 45°
  await toggle('sq60'); s = await st(); check('sq60 replaces sq45', s.insts.filter(x => x.k.startsWith('sq')).length === 1 && s.insts[0].k === 'sq60');
  await toggle('sq60'); s = await st(); check('square toggled off', s.insts.length === 0);

  // ---- rapporteur ----
  await toggle('proto'); s = await st(); i = s.insts[0]; const R = 80 * MM;
  check('protractor added', i.k === 'proto');
  const arcPt = (deg, d) => W(i, (R + d) * Math.cos(deg * Math.PI / 180), -(R + d) * Math.sin(deg * Math.PI / 180));
  const pts = []; for (let d = 30; d <= 120; d += 15) pts.push(arcPt(d, 6));
  await drag(pts);
  o = await lastStroke();
  const rr = o.pts.map(p => Math.hypot(p[0] - i.x, p[1] - i.y));
  check('protractor arc snap', o.pts.length > 20 && Math.max(...rr.map(r => Math.abs(r - R))) < .05, `n=${o.pts.length} maxdev=${Math.max(...rr.map(r => Math.abs(r - R))).toFixed(4)}`);
  // baseline
  await drag([W(i, -R + 40, 6), W(i, R - 40, 20)]);
  o = await lastStroke(); const l = o.pts.map(p => { const dx = p[0] - i.x, dy = p[1] - i.y; return -dx * Math.sin(i.a) + dy * Math.cos(i.a); });
  check('protractor baseline snap', o.pts.length === 2 && l.every(v => Math.abs(v) < .01), JSON.stringify(l.map(v => +v.toFixed(3))));
  await page.screenshot({ path: 'shot-proto.png' });
  await toggle('proto');

  // ---- compas ----
  await toggle('compass'); s = await st(); i = s.insts[0]; check('compass added', i.k === 'compass' && i.r === 170, JSON.stringify(i));
  const L = 260; let th = Math.acos(i.r / (2 * L));
  let Q = [i.x + i.r * Math.cos(i.a), i.y + i.r * Math.sin(i.a)];
  // drag tip a quarter turn clockwise around pivot (screen coords)
  const circ = []; for (let d = 0; d <= 90; d += 15) { const t = d * Math.PI / 180; circ.push([i.x + (i.r + 30) * Math.cos(t), i.y + (i.r + 30) * Math.sin(t)]); }
  circ[0] = Q;
  const n0 = (await st()).n;
  await drag(circ);
  o = await lastStroke(); const rc = o.pts.map(p => Math.hypot(p[0] - i.x, p[1] - i.y));
  check('compass arc drawn', (await st()).n === n0 + 1 && o.pts.length > 20 && Math.max(...rc.map(r => Math.abs(r - 170))) < .01, `n=${o.pts.length} maxdev=${Math.max(...rc.map(r => Math.abs(r - 170))).toFixed(5)}`);
  s = await st(); i = s.insts[0]; check('compass angle followed pointer', Math.abs(i.a - Math.PI / 2) < .05, 'a=' + i.a.toFixed(2));
  // open the compass: drag hinge
  const g = (() => { const r = i.r, t = Math.acos(r / (2 * L)); return { H: [i.x + L * Math.cos(i.a - t), i.y + L * Math.sin(i.a - t)] }; })();
  const target = [i.x + L * Math.cos(i.a - 0.9), i.y + L * Math.sin(i.a - 0.9)];
  await drag([g.H, target]);
  s = await st(); const expR = 2 * L * Math.cos(0.9); check('compass opening changed', Math.abs(s.insts[0].r - expR) < 4, `r=${s.insts[0].r.toFixed(1)} expected≈${expR.toFixed(1)}`);
  // shift-drag tip rotates without drawing
  i = s.insts[0]; Q = [i.x + i.r * Math.cos(i.a), i.y + i.r * Math.sin(i.a)];
  const nb = (await st()).n; await drag([Q, [i.x - 200, i.y]], { shift: true });
  s = await st(); check('shift rotate no stroke', s.n === nb && Math.abs(Math.abs(s.insts[0].a) - Math.PI) < .1, 'a=' + s.insts[0].a.toFixed(2));
  await page.screenshot({ path: 'shot-compass.png' });
  await toggle('compass');

  // ---- all instruments together + règle ----
  for (const k of ['ruler', 'sq60', 'proto', 'compass']) await toggle(k);
  s = await st(); check('4 instruments at once', s.insts.length === 4);
  await page.screenshot({ path: 'shot-all-inst.png' });
  const chk = await page.evaluate(() => { document.getElementById('btnInst').click(); return [...document.querySelectorAll('[data-inst]')].map(b => b.getAttribute('aria-checked')).join(','); });
  out('menu checked states', chk);
  await page.keyboard.press('Escape');
  await page.click('#btnInst'); await page.click('[data-inst="none"]'); s = await st(); check('hide all', s.insts.length === 0);

  // (QR testé dans t6.js)
  out('ERRORS', JSON.stringify(errors, null, 1));
  await browser.close();
})();
