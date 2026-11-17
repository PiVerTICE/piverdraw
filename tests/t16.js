const { chromium } = require('playwright');
const out = (...a) => console.log(...a);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push('[console.error] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  await ctx.route('**/*', route => route.request().url().startsWith('http://localhost') ? route.continue() : route.abort());
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(700);
  const check = (n, c, x = '') => out((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : ''));
  const world = (x, y) => page.evaluate(([x, y]) => { const v = __piverdraw.view(), r = document.getElementById('cv').getBoundingClientRect(); return [r.left + v.tx + x * v.z, r.top + v.ty + y * v.z]; }, [x, y]);
  const objs = () => page.evaluate(() => __piverdraw.page().objects.map(o => ({ ...o })));
  const st = () => page.evaluate(() => ({ sel: __piverdraw.S.sel.size, tool: __piverdraw.S.tool, undo: __piverdraw.S.undo.length }));
  await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(150);

  // ----- reconnaissance pure (fonction) -----
  const rec = (pts, extra = {}) => page.evaluate(([pts, extra]) => { const r = __piverdraw.recognizeShape({ t: 'stroke', id: 'x', color: '#111', size: 4, pts: pts.map(p => [p[0], p[1], .5]), ...extra }); return r && r.map(o => ({ ...o, pts: o.pts && o.pts.length })); }, [pts, extra]);
  const jit = (x, y, s = 1.5) => [x + (Math.random() - .5) * s, y + (Math.random() - .5) * s];
  const circle = (cx, cy, rx, ry, n = 60, a0 = .3, turn = 6.4) => Array.from({ length: n }, (_, i) => jit(cx + rx * Math.cos(a0 + turn * i / n), cy + ry * Math.sin(a0 + turn * i / n)));
  const seg = (a, b, n) => Array.from({ length: n }, (_, i) => jit(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n));
  const polyline = (V, n = 25) => V.flatMap((v, i) => seg(v, V[(i + 1) % V.length], n)).concat([jit(V[0][0], V[0][1])]);

  let r = await rec(circle(300, 300, 80, 80));
  check('circle → ellipse (square bbox)', r && r.length === 1 && r[0].t === 'ellipse' && Math.abs((r[0].x2 - r[0].x1) - (r[0].y2 - r[0].y1)) < 1e-6, JSON.stringify(r));
  r = await rec(circle(300, 300, 120, 60));
  check('flat ellipse → ellipse (not circle)', r && r[0].t === 'ellipse' && (r[0].x2 - r[0].x1) > 1.5 * (r[0].y2 - r[0].y1), JSON.stringify(r));
  r = await rec(polyline([[100, 100], [300, 100], [300, 220], [100, 220]]));
  check('rectangle → rect, no rot', r && r.length === 1 && r[0].t === 'rect' && !r[0].rot && Math.abs(r[0].x2 - r[0].x1 - 200) < 8 && Math.abs(r[0].y2 - r[0].y1 - 120) < 8, JSON.stringify(r));
  r = await rec(polyline([[100, 100], [220, 100], [220, 215], [100, 215]]));
  check('near-square → square', r && r[0].t === 'rect' && Math.abs((r[0].x2 - r[0].x1) - (r[0].y2 - r[0].y1)) < 1e-6, JSON.stringify(r));
  const th = .5, R = (x, y) => [400 + (x - 400) * Math.cos(th) - (y - 300) * Math.sin(th), 300 + (x - 400) * Math.sin(th) + (y - 300) * Math.cos(th)];
  r = await rec(polyline([R(300, 240), R(500, 240), R(500, 360), R(300, 360)]));
  check('tilted rectangle → rect with rot ≈ 0.5', r && r[0].t === 'rect' && Math.abs(r[0].rot - .5) < .06 && Math.abs(r[0].x2 - r[0].x1 - 200) < 10, JSON.stringify(r));
  r = await rec(polyline([[200, 100], [320, 300], [80, 300]]));
  check('triangle → closed sharp polygon (4 pts)', r && r.length === 1 && r[0].t === 'stroke' && r[0].sharp && r[0].pts === 4, JSON.stringify(r));
  r = await rec(polyline([[100, 100], [300, 130], [280, 260], [120, 200]]));
  check('quadrilateral (not rect) → polygon (5 pts)', r && r[0].t === 'stroke' && r[0].sharp && r[0].pts === 5, JSON.stringify(r));
  r = await rec(seg([100, 100], [420, 108], 40));
  check('wobbly line → line', r && r[0].t === 'line', JSON.stringify(r));
  r = await rec(seg([100, 100], [420, 103], 40));
  check('near-horizontal line snapped to horizontal', r && r[0].t === 'line' && Math.abs(r[0].y1 - r[0].y2) < 1e-6, JSON.stringify(r));
  r = await rec(seg([100, 100], [420, 108], 40), { hl: true, color: '#ff0', size: 20 });
  check('highlighter line → 2-pt sharp stroke keeping hl', r && r[0].t === 'stroke' && r[0].hl && r[0].sharp && r[0].pts === 2, JSON.stringify(r));
  r = await rec(circle(300, 300, 80, 80), { hl: true });
  check('highlighter circle → not recognised', r === null);
  r = await rec(circle(300, 300, 80, 80, 40, .3, 3.2));
  check('half circle (open) → not recognised', r === null);
  r = await rec([[100, 100], [101, 100], [102, 101]]);
  check('tiny scribble → not recognised', r === null);
  const zig = Array.from({ length: 80 }, (_, i) => jit(100 + i * 4, 200 + (i % 2 ? 40 : -40), 2));
  r = await rec(zig);
  check('zigzag → not recognised', r === null, JSON.stringify(r));
  r = await rec(circle(300, 300, 80, 80, 60, 0, 12.5));
  check('double-loop spiral-ish still OK or null (no crash)', r === null || Array.isArray(r));

  // ----- geste réel : maintien en fin de trait -----
  await page.click('[data-tool="pen"]'); await page.waitForTimeout(100);
  check('snap checkbox visible for pen, on by default', await page.isVisible('#snapChk') && await page.isChecked('#snapChk'));
  const drawShape = async (pts, hold = 1000, after = null) => {
    const P = []; for (const p of pts) P.push(await world(p[0], p[1]));
    await page.mouse.move(P[0][0], P[0][1]); await page.mouse.down();
    for (const q of P) await page.mouse.move(q[0], q[1]);
    if (hold) await page.waitForTimeout(hold);
    if (after) await after(P);
    await page.mouse.up(); await page.waitForTimeout(120);
  };
  let before = (await objs()).length, u0 = (await st()).undo;
  await drawShape(circle(300, 300, 90, 90, 50));
  let o = await objs();
  check('hold at end → ellipse committed (one object)', o.length === before + 1 && o[o.length - 1].t === 'ellipse', JSON.stringify(o.slice(-1)));
  check('one undo step', (await st()).undo === u0 + 1);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100);
  check('undo removes it entirely', (await objs()).length === before);
  await page.keyboard.press('Control+y'); await page.waitForTimeout(100);

  before = (await objs()).length;
  await drawShape(circle(700, 300, 90, 90, 50), 400);
  o = await objs(); check('short pause (400 ms) → stays freehand', o.length === before + 1 && o[o.length - 1].t === 'stroke');
  before = o.length;
  await drawShape(circle(300, 550, 80, 80, 50), 1000, async P => { const l = P[P.length - 1]; await page.mouse.move(l[0] + 30, l[1] + 25, { steps: 6 }); await page.waitForTimeout(300); });
  o = await objs(); check('moving after snap cancels it → freehand stroke', o.length === before + 1 && o[o.length - 1].t === 'stroke', o[o.length - 1].t);

  // case à cocher décochée → pas de redressement
  await page.uncheck('#snapChk'); before = (await objs()).length;
  await drawShape(circle(700, 550, 80, 80, 50));
  o = await objs(); check('snap off → stays freehand', o[o.length - 1].t === 'stroke' && o.length === before + 1);
  check('preference stored', await page.evaluate(() => localStorage.getItem('piverdraw.snap')) === '0');
  await page.check('#snapChk');

  // trait droit surligneur
  await page.click('[data-tool="hl"]'); before = (await objs()).length;
  await drawShape(seg([150, 700], [500, 706], 30));
  o = await objs(); check('highlighter held → straight 2-pt stroke', o.length === before + 1 && o[o.length - 1].hl && o[o.length - 1].pts.length === 2, JSON.stringify(o[o.length - 1]).slice(0, 120));
  await page.screenshot({ path: 'shot-snap.png' });

  // bouton « Redresser » sur la sélection
  await page.click('[data-tool="pen"]'); before = (await objs()).length;
  await drawShape(polyline([[900, 100], [1100, 100], [1100, 230], [900, 230]]), 0);
  o = await objs(); check('without hold → freehand', o.length === before + 1 && o[o.length - 1].t === 'stroke');
  await page.click('[data-tool="select"]'); const [sx, sy] = await world(900, 100); await page.mouse.click(sx, sy); await page.waitForTimeout(150);
  check('Redresser button visible when a stroke is selected', await page.isVisible('#selStraight'));
  u0 = (await st()).undo; await page.click('#selStraight'); await page.waitForTimeout(150);
  o = await objs(); check('Redresser → rect, selected, 1 undo', o[o.length - 1].t === 'rect' && (await st()).sel === 1 && (await st()).undo === u0 + 1 && o.length === before + 1, JSON.stringify(o[o.length - 1]));
  check('Redresser hidden for a rect', !(await page.isVisible('#selStraight')));
  // scribble → message
  await page.click('[data-tool="pen"]');
  await drawShape(zig.map(p => [p[0] + 400, p[1] + 300]).slice(0, 40), 0);
  await page.click('[data-tool="select"]'); const zp = await world(400 + 100 + 8, 300 + 200 + 40); await page.mouse.click(zp[0], zp[1]); await page.waitForTimeout(150);
  if ((await st()).sel === 1) { u0 = (await st()).undo; await page.click('#selStraight'); await page.waitForTimeout(150); check('scribble: no change, toast says not recognised', (await st()).undo === u0 && /non reconnue/.test(await page.evaluate(() => document.body.innerText))); }
  else check('scribble selected (setup)', false);
  // export : la forme redressée est bien dessinée
  const px = await page.evaluate(async () => { const c = await __piverdraw.exportRect(0, 0, 1300, 900, 1); return !!c; }).catch(() => 'n/a');
  out('errors', JSON.stringify(errors));
  await browser.close();
})();
