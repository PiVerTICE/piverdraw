const H = require('./h.js');
(async () => {
  // ---- mobile tactile ----
  const T = await H({ viewport: { width: 412, height: 800 }, touch: true }), { page, check } = T;
  await T.add({ t: 'rect', x1: 60, y1: 200, x2: 200, y2: 280, fill: true, color: '#d33', clone: true });
  await T.add({ t: 'ellipse', x1: 220, y1: 200, x2: 300, y2: 280, fill: true, color: '#36c' });
  await page.click('[data-tool="select"]').catch(async () => { await page.evaluate(() => document.querySelector('[data-tool="select"]').click()); });
  const cdp = await T.ctx.newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const tdrag = async (a, b, n = 10) => { const A = await T.world(...a), B = await T.world(...b); await touch('touchStart', ...A); for (let i = 1; i <= n; i++) await touch('touchMove', A[0] + (B[0] - A[0]) * i / n, A[1] + (B[1] - A[1]) * i / n); await touch('touchEnd'); await page.waitForTimeout(150); };
  const tap = async (p) => { const A = await T.world(...p); await touch('touchStart', ...A); await touch('touchEnd'); await page.waitForTimeout(150); };
  await tap([130, 240]); check('touch: tap selects', (await T.st()).sel === 1);
  const bar = await page.evaluate(() => { const b = document.querySelector('#selBar') || document.querySelector('#selDel').closest('.grp, .bar, div'); const el = document.querySelector('#selDel'); let p = el.parentElement; const r = p.getBoundingClientRect(); const btns = [...p.querySelectorAll('.btn')].filter(x => x.offsetParent); return { docW: document.documentElement.scrollWidth, vw: innerWidth, n: btns.length, minH: Math.min(...btns.map(b => b.getBoundingClientRect().height)), minW: Math.min(...btns.map(b => b.getBoundingClientRect().width)), right: Math.max(...btns.map(b => b.getBoundingClientRect().right)), pscroll: p.scrollWidth, pclient: p.clientWidth }; });
  check('mobile: no page overflow, buttons ≥ 34 px', bar.docW <= bar.vw && bar.minH >= 34, JSON.stringify(bar));
  await page.mouse.move(5, 790); await page.screenshot({ path: 'shot-sel-mobile.png' });
  // rotation tactile
  const z = await page.evaluate(() => __piverdraw.view().z), y0 = 200 - 30 / z;
  await tdrag([130, y0], [230, 240]); let o = (await T.objs())[0];
  check('touch: rotate handle works (rot ≈ 90°)', o.rot !== undefined && Math.abs(o.rot - Math.PI / 2) < .06, String(o.rot));
  // copie tactile
  await page.evaluate(() => { __piverdraw.S.sel.clear(); __piverdraw.requestRender(); });
  const n0 = (await T.objs()).length; await tdrag([130, 240], [130, 460]);
  check('touch: cloner drags a copy', (await T.objs()).length === n0 + 1);
  // verrouiller
  await tap([260, 240]); await page.evaluate(() => document.querySelector('#selLock').click()); await page.waitForTimeout(100);
  check('touch: lock via button', (await T.objs())[1].locked === true);
  console.log('mobile errors', JSON.stringify(T.errors)); await T.browser.close();

  // ---- 360 px : barre de sélection ----
  const T2 = await H({ viewport: { width: 360, height: 640 } });
  await T2.add({ t: 'stroke', pts: [[100, 100, .5], [150, 130, .5], [200, 100, .5]] }); await T2.add({ t: 'rect', x1: 60, y1: 200, x2: 140, y2: 260, fill: true });
  await T2.page.evaluate(() => document.querySelector('[data-tool="select"]').click()); await T2.page.keyboard.press('ControlOrMeta+a'); await T2.page.waitForTimeout(200);
  const m = await T2.page.evaluate(() => ({ docW: document.documentElement.scrollWidth, vw: innerWidth, vis: [...document.querySelectorAll('#selStraight,#selDup,#selRot,#selGroup,#selLock,#selClone,#selDel')].filter(b => b.offsetParent).map(b => b.id) }));
  T2.check('360px: no horizontal page overflow with the full selection bar', m.docW <= m.vw, JSON.stringify(m));
  await T2.page.screenshot({ path: 'shot-sel-360.png' });
  console.log('360 errors', JSON.stringify(T2.errors)); await T2.browser.close();

  // ---- bureau : sombre + sélection ----
  const T3 = await H({ viewport: { width: 1280, height: 800 } });
  await T3.page.selectOption('#bgSel', 'noir').catch(() => {});
  await T3.add({ t: 'rect', x1: 300, y1: 250, x2: 520, y2: 330, fill: false, color: '#fff', rot: .35, clone: true });
  await T3.page.evaluate(() => document.querySelector('[data-tool="select"]').click()); await T3.click([410, 290]);
  await T3.page.mouse.move(5, 790); await T3.page.screenshot({ path: 'shot-sel-desktop-dark.png' });
  console.log('dark errors', JSON.stringify(T3.errors)); await T3.browser.close();
})();
