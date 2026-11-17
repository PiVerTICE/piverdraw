const { chromium, devices } = require('playwright');
const out = (...a) => console.log(...a);
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message + (e.stack || '').slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(600);
  const check = (n, c, x = '') => out((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : ''));
  await page.click('#btnFile'); await page.click('[data-act="new"]'); await page.waitForTimeout(150);
  await page.keyboard.press('0'); await page.waitForTimeout(100);
  const Z = () => page.evaluate(() => __piverdraw.view().z);
  const objs = () => page.evaluate(() => __piverdraw.page().objects.map(o => ({ ...o })));
  const toScreen = (x, y) => page.evaluate(([x, y]) => { const v = __piverdraw.view(), r = document.getElementById('cv').getBoundingClientRect(); return [r.left + v.tx + x * v.z, r.top + v.ty + y * v.z]; }, [x, y]);
  const toWorld = (x, y) => page.evaluate(([x, y]) => { const v = __piverdraw.view(), r = document.getElementById('cv').getBoundingClientRect(); return [(x - r.left - v.tx) / v.z, (y - r.top - v.ty) / v.z]; }, [x, y]);
  const drag = async (pts, steps = 8) => { await page.mouse.move(...pts[0]); await page.mouse.down(); for (const p of pts.slice(1)) await page.mouse.move(...p, { steps }); await page.mouse.up(); await page.waitForTimeout(60); };
  const inkAt = (x, y, r = 3) => page.evaluate(([x, y, r]) => { const c = document.getElementById('cv'), b = c.getBoundingClientRect(), d = c.getContext('2d').getImageData(Math.round(x - b.left) - r, Math.round(y - b.top) - r, 2 * r + 1, 2 * r + 1).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 140 || d[i + 1] < 140) n++; return n; }, [x, y, r]);
  const clearAll = async () => { await page.evaluate(() => { document.getElementById('clearPage'); }); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.press('Delete'); await page.waitForTimeout(60); };
  const mode = m => page.click(`[data-ermode="${m}"]`);

  // --- interface
  await page.keyboard.press('e');
  const ui = await page.evaluate(() => { const g = document.querySelector('[data-g="ermode"]'), r = g.getBoundingClientRect(); return { vis: r.width > 0, pressed: [...document.querySelectorAll('[data-ermode]')].map(b => b.getAttribute('aria-pressed')).join(','), txt: g.textContent.replace(/\s+/g, ' ').trim() }; });
  check('eraser: mode choice visible, default "Partie"', ui.vis && ui.pressed === 'true,false' && /Partie/.test(ui.txt) && /Trait entier/.test(ui.txt), JSON.stringify(ui));
  await page.screenshot({ path: 'shot-eraser-ui.png', clip: { x: 60, y: 50, width: 1060, height: 70 } });
  await page.keyboard.press('p'); check('mode choice hidden with pen', await page.evaluate(() => document.querySelector('[data-g="ermode"]').getBoundingClientRect().width === 0));

  // --- 1. coupe exacte d'un trait
  await page.keyboard.press('p');
  const A = await toScreen(300, 300), B = await toScreen(700, 300);
  await drag([A, B], 20);
  let o = await objs(); check('one pen stroke', o.length === 1 && o[0].t === 'stroke');
  const z = await Z(); const R = (12 + Math.min(o[0].size / 2, 4)) ;   // rayon de coupe en unités monde
  await page.keyboard.press('e');
  const e1 = await toScreen(480, 300), e2 = await toScreen(520, 300);
  await drag([e1, e2], 6);
  o = await objs();
  const xs = o.map(q => [Math.min(...q.pts.map(p => p[0])), Math.max(...q.pts.map(p => p[0]))]);
  check('stroke split in 2', o.length === 2 && o.every(q => q.t === 'stroke'), JSON.stringify(xs.map(x => x.map(v => Math.round(v)))));
  const [w480] = await toWorld(...e1), [w520] = await toWorld(...e2); const [wA] = await toWorld(...A), [wB] = await toWorld(...B);
  const left = xs.find(x => x[0] < w480), right = xs.find(x => x[0] > w520 - 1);
  check('left piece ends at eraser edge (±1.5)', left && Math.abs(left[1] - (w480 - R)) < 1.5 && Math.abs(left[0] - wA) < 1.5, JSON.stringify({ left, expect: w480 - R }));
  check('right piece starts at eraser edge (±1.5)', right && Math.abs(right[0] - (w520 + R)) < 1.5 && Math.abs(right[1] - wB) < 1.5, JSON.stringify({ right, expect: w520 + R }));
  check('pieces keep colour/size and have new ids', o[0].color === o[1].color && o[0].size === o[1].size && o[0].id !== o[1].id);
  const mid = await toScreen(500, 300); check('gap is really empty on screen', (await inkAt(mid[0], mid[1], 2)) === 0 && (await inkAt(A[0] + 20, A[1], 2)) > 0);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(80);
  o = await objs(); check('single undo restores the original stroke', o.length === 1 && o[0].pts.length > 10);
  await page.keyboard.press('Control+y'); await page.waitForTimeout(80); check('redo re-applies the cut', (await objs()).length === 2);

  // --- 2. balayage rapide (un seul grand saut de souris)
  await page.keyboard.press('Control+z'); await page.waitForTimeout(60);
  await page.keyboard.press('e'); const f1 = await toScreen(400, 300), f2 = await toScreen(600, 300);
  await page.mouse.move(...f1); await page.mouse.down(); await page.mouse.move(...f2, { steps: 1 }); await page.mouse.up(); await page.waitForTimeout(60);
  o = await objs(); const gapEmpty = o.every(q => q.pts.every(p => p[0] < 400 || p[0] > 600)); check('fast single jump leaves no residue between', gapEmpty && o.length === 2, JSON.stringify(o.map(q => [Math.round(Math.min(...q.pts.map(p => p[0]))), Math.round(Math.max(...q.pts.map(p => p[0])))])));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(60);

  // --- 3. mode « Trait entier » inchangé
  await page.keyboard.press('e'); await mode('obj'); check('mode switch pressed state', (await page.getAttribute('[data-ermode="obj"]', 'aria-pressed')) === 'true' && (await page.getAttribute('[data-ermode="part"]', 'aria-pressed')) === 'false');
  await drag([e1, e2], 6); o = await objs(); check('whole-stroke mode removes the full stroke', o.length === 0);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(60); check('undo restores', (await objs()).length === 1);
  await mode('part');

  // --- 4. ligne et flèche
  await clearAll(); await page.keyboard.press('a');
  const ar1 = await toScreen(300, 400), ar2 = await toScreen(700, 400); await drag([ar1, ar2], 10);
  o = await objs(); check('arrow created', o.length === 1 && o[0].t === 'arrow');
  await page.keyboard.press('e'); const m1 = await toScreen(480, 400), m2 = await toScreen(500, 400); await drag([m1, m2], 4);
  o = await objs(); check('arrow cut: first part is a line, head part stays an arrow', o.length === 2 && o[0].t === 'line' && o[1].t === 'arrow' && o[0].x2 < o[1].x1, JSON.stringify(o.map(q => [q.t, Math.round(q.x1), Math.round(q.x2)])));
  const t1 = await toScreen(690, 400), t2 = await toScreen(715, 400); await drag([t1, t2], 4);
  o = await objs(); check('erasing the tip leaves a plain line piece (no head)', o.every(q => q.t === 'line') && o.length === 2, JSON.stringify(o.map(q => q.t)));
  await clearAll();

  // --- 5. rectangle (contour) : devient des traits nets ; les coins restent carrés
  await page.keyboard.press('r'); const r1 = await toScreen(300, 500), r2 = await toScreen(500, 620); await drag([r1, r2], 8);
  o = await objs(); check('rect created', o.length === 1 && o[0].t === 'rect');
  await page.keyboard.press('e'); const top1 = await toScreen(390, 500), top2 = await toScreen(410, 500); await drag([top1, top2], 4);
  o = await objs(); check('rect outline converted to sharp strokes after cut', o.length >= 1 && o.every(q => q.t === 'stroke' && q.sharp === 1), JSON.stringify(o.map(q => [q.t, q.pts.length])));
  await page.mouse.move(640, 20); await page.waitForTimeout(80);
  const topMid = await toScreen(400, 500), leftMid = await toScreen(300, 560), corner = await toScreen(300, 500), bottomMid = await toScreen(400, 620);
  check('top edge gap empty; other edges and corner still inked', (await inkAt(topMid[0], topMid[1], 2)) === 0 && (await inkAt(leftMid[0], leftMid[1], 2)) > 0 && (await inkAt(corner[0], corner[1], 2)) > 0 && (await inkAt(bottomMid[0], bottomMid[1], 2)) > 0);
  await page.screenshot({ path: 'shot-eraser-rect.png', clip: { x: 200, y: 350, width: 500, height: 330 } });
  await clearAll();

  // --- 6. ellipse (contour) et ellipse pleine
  await page.keyboard.press('o'); const l1 = await toScreen(300, 450), l2 = await toScreen(500, 600); await drag([l1, l2], 8);
  await page.keyboard.press('e'); const rt = await toScreen(500, 525); await drag([[rt[0] - 8, rt[1]], [rt[0] + 8, rt[1]]], 4);
  o = await objs(); check('ellipse outline cut into stroke(s)', o.length >= 1 && o.every(q => q.t === 'stroke') && o[0].pts.length > 40, JSON.stringify(o.map(q => q.pts.length)));
  const lm = await toScreen(300, 525); check('ellipse far side still inked', (await inkAt(lm[0], lm[1], 3)) > 0);
  await clearAll();
  await page.keyboard.press('o'); await page.check('#fill'); const p1 = await toScreen(300, 450), p2 = await toScreen(500, 600); await drag([p1, p2], 8);
  await page.uncheck('#fill'); await page.keyboard.press('e'); const edge = await toScreen(500, 525); await drag([[edge[0] - 6, edge[1]], [edge[0] + 6, edge[1]]], 4);
  o = await objs(); check('filled shape is removed whole when touched', o.length === 0);
  await clearAll();

  // --- 7. surligneur : mêmes propriétés, coupe au bord de la gomme (extrémité plate)
  await page.keyboard.press('h'); const h1 = await toScreen(300, 300), h2 = await toScreen(700, 300); await drag([h1, h2], 20);
  await page.keyboard.press('e'); await drag([await toScreen(490, 300), await toScreen(510, 300)], 4);
  o = await objs(); const hx = o.map(q => [Math.min(...q.pts.map(p => p[0])), Math.max(...q.pts.map(p => p[0]))]);
  const [wc] = await toWorld(...(await toScreen(490, 300)));
  check('highlighter cut keeps hl flag/alpha', o.length === 2 && o.every(q => q.hl === 1 && q.alpha > 0), JSON.stringify(o.map(q => [q.hl, q.alpha])));
  check('highlighter cut exactly at circle edge (no padding)', Math.abs(hx.find(x => x[0] < wc)[1] - (wc - 12)) < 1.5, JSON.stringify(hx.map(x => x.map(Math.round))));
  await clearAll();

  // --- 8. texte et image épargnés en mode Partie
  await page.keyboard.press('t'); const tx = await toScreen(300, 300); await page.mouse.click(...tx); await page.waitForTimeout(250); await page.keyboard.type('Bonjour'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100);
  o = await objs(); check('text created', o.length === 1 && o[0].t === 'text', JSON.stringify(o.map(q => q.t)));
  await page.keyboard.press('e'); const tb = await toScreen(330, 315); await drag([[tb[0] - 30, tb[1]], [tb[0] + 30, tb[1]]], 6);
  check('text untouched by partial eraser', (await objs()).length === 1);
  await mode('obj'); await drag([[tb[0] - 30, tb[1]], [tb[0] + 30, tb[1]]], 6); check('text removed by whole-object eraser', (await objs()).length === 0); await mode('part');

  // --- 9. trait à pression variable (stylet) : pression interpolée
  await page.evaluate(() => { __piverdraw.page().objects.push({ t: 'stroke', id: 'vp1', color: '#000000', size: 6, vp: 1, pts: Array.from({ length: 21 }, (_, i) => [300 + i * 20, 300, i / 20]) }); });
  await page.keyboard.press('m'); await page.keyboard.press('e');
  await drag([await toScreen(488, 300), await toScreen(512, 300)], 4);
  o = await objs(); const pr = o.filter(q => q.vp === 1); check('pressure stroke cut in two, pressures kept', pr.length === 2 && pr.every(q => q.pts.every(p => p[2] >= 0 && p[2] <= 1)) && pr[0].pts[pr[0].pts.length - 1][2] > .4 && pr[0].pts[pr[0].pts.length - 1][2] < .6, JSON.stringify(pr.map(q => q.pts[q.pts.length - 1])));
  await clearAll();

  // --- 10. persistance du choix + présentation
  await page.keyboard.press('e'); await mode('obj'); await page.reload(); await page.waitForTimeout(700); await page.keyboard.press('e');
  check('mode remembered after reload', (await page.getAttribute('[data-ermode="obj"]', 'aria-pressed')) === 'true');
  await page.click('#btnPresent'); await page.waitForTimeout(400); await page.evaluate(() => document.querySelector('[data-ptool="eraser"]').click()); await page.waitForTimeout(100);
  const pm = await page.evaluate(() => { const b = document.getElementById('pErMode'), r = b.getBoundingClientRect(); return { vis: r.width > 0, title: b.title }; });
  check('presentation: mode button shown with eraser, shows current mode', pm.vis && /trait entier/.test(pm.title), JSON.stringify(pm));
  await page.click('#pErMode'); await page.waitForTimeout(100);
  check('presentation: click toggles to "partie" + toast', /partie/.test(await page.evaluate(() => document.getElementById('pErMode').title)) && /partie touchée/.test(await page.textContent('#toast')));
  await page.evaluate(() => document.querySelector('[data-ptool="laser"]').click()); check('presentation: mode button hidden with other tools', await page.evaluate(() => document.getElementById('pErMode').getBoundingClientRect().width === 0));
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);

  // --- 11. performance : 300 traits, balayage de gomme
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const arr = __piverdraw.page().objects; for (let k = 0; k < 300; k++) { const y = 80 + (k % 30) * 25, x = 100 + Math.floor(k / 30) * 120; arr.push({ t: 'stroke', id: 'perf' + k, color: '#111', size: 3, pts: Array.from({ length: 60 }, (_, i) => [x + i * 2, y + Math.sin(i / 4) * 6, .5]) }); } });
  await page.keyboard.press('m'); await page.keyboard.press('e'); await mode('part');
  const t0 = Date.now(); await drag([await toScreen(100, 80), await toScreen(1000, 400), await toScreen(100, 700), await toScreen(1000, 700)], 40); const dt = Date.now() - t0;
  o = await objs(); check('performance: 300 strokes, long sweep finishes quickly', dt < 6000, dt + ' ms, pieces ' + o.length);
  out('errors', JSON.stringify(errs));
  await browser.close();
})();
