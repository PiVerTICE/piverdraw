const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', 'site', 'vendor', 'pdfjs');
const out = (...a) => console.log(...a);
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
    if (u.includes('pdf.worker.min.js')) return route.fulfill({ path: path.join(NM, 'pdf.worker.min.js'), contentType: 'application/javascript' });
    if (u.includes('pdf.min.js')) return route.fulfill({ path: path.join(NM, 'pdf.min.js'), contentType: 'application/javascript' });
    return route.abort();
  });
  await page.goto('http://localhost:8765/index.html');
  await page.waitForTimeout(600);
  const st = () => page.evaluate(() => ({ cur: __piverdraw.S.cur, pages: __piverdraw.S.proj.pages.length, n: __piverdraw.page().objects.length, sel: __piverdraw.S.sel.size, tool: __piverdraw.S.tool, undo: __piverdraw.S.undo.length }));
  const world = (x, y) => page.evaluate(([x, y]) => { const v = __piverdraw.view(), r = document.getElementById('cv').getBoundingClientRect(); return [r.left + v.tx + x * v.z, r.top + v.ty + y * v.z]; }, [x, y]);
  const drag = async (pts, opts = {}) => {
    const [x0, y0] = await world(...pts[0]); await page.mouse.move(x0, y0); await page.mouse.down();
    for (const p of pts.slice(1)) { const [x, y] = await world(...p); await page.mouse.move(x, y, { steps: 4 }); }
    await page.mouse.up();
  };
  const check = (name, cond, extra = '') => out((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : ''));

  // reset to blank board
  await page.click('#btnFile'); await page.click('[data-act="new"]');
  await page.waitForTimeout(100);
  let s = await st(); check('new board empty', s.n === 0 && s.pages === 1, JSON.stringify(s));

  // pen stroke
  await page.keyboard.press('p');
  await drag([[200, 200], [300, 260], [400, 200], [500, 280]]);
  s = await st(); check('pen stroke added', s.n === 1, JSON.stringify(s));
  // highlighter
  await page.keyboard.press('h'); await drag([[200, 330], [600, 330]]);
  s = await st(); check('highlighter added', s.n === 2);
  // shapes
  for (const [k, a, b] of [['l', [700, 150], [900, 250]], ['a', [700, 300], [900, 300]], ['r', [700, 380], [900, 480]], ['o', [950, 380], [1150, 480]]]) { await page.keyboard.press(k); await drag([a, b]); }
  s = await st(); check('4 shapes added', s.n === 6, JSON.stringify(s));
  // text
  await page.keyboard.press('t'); const [tx, ty] = await world(200, 500); await page.mouse.click(tx, ty);
  await page.waitForTimeout(80); await page.keyboard.type('Bonjour la classe'); await page.keyboard.press('Control+Enter');
  s = await st(); check('text added', s.n === 7, JSON.stringify(s));
  // undo/redo
  await page.keyboard.press('Control+z'); s = await st(); check('undo', s.n === 6);
  await page.keyboard.press('Control+y'); s = await st(); check('redo', s.n === 7);
  // select + move
  await page.keyboard.press('v'); const before = await page.evaluate(() => JSON.stringify(__piverdraw.page().objects.find(o => o.t === 'rect')));
  await drag([[700, 380], [760, 430]]);   // click on rect edge start (700,380) corner and drag
  const after = await page.evaluate(() => JSON.stringify(__piverdraw.page().objects.find(o => o.t === 'rect')));
  check('select+move rect', before !== after, after);
  s = await st(); check('rect selected', s.sel === 1);
  // change color of selection
  await page.click('.swatch[data-color="#d62f2f"]');
  const col = await page.evaluate(() => __piverdraw.page().objects.find(o => o.t === 'rect').color); check('recolor selection', col === '#d62f2f', col);
  // scale via handle
  const bb = await page.evaluate(() => { const o = __piverdraw.page().objects.find(o => o.t === 'rect'); return [Math.max(o.x1, o.x2), Math.max(o.y1, o.y2), Math.min(o.x1, o.x2)]; });
  await drag([[bb[0], bb[1]], [bb[0] + 100, bb[1] + 60]]);
  const sc = await page.evaluate(() => { const o = __piverdraw.page().objects.find(o => o.t === 'rect'); return Math.abs(o.x2 - o.x1); });
  check('scale rect via handle', sc > 220, 'width=' + sc.toFixed(1));
  // duplicate, delete
  await page.keyboard.press('Control+d'); s = await st(); check('duplicate', s.n === 8, JSON.stringify(s));
  await page.keyboard.press('Delete'); s = await st(); check('delete', s.n === 7);
  // marquee select all
  await page.keyboard.press('ControlOrMeta+a'); s = await st(); check('select all', s.sel === 7, JSON.stringify(s));
  await page.keyboard.press('Escape');
  // eraser over the pen stroke
  const u0 = (await st()).undo; await page.keyboard.press('e'); await drag([[190, 190], [320, 270]]);
  s = await st(); check('eraser cut the stroke (mode Partie, one undo step)', s.undo === u0 + 1 && s.n >= 7, JSON.stringify(s));
  await page.screenshot({ path: 'shot-draw.png' });

  // ruler snap
  await page.click('#btnInst'); await page.click('[data-inst="ruler"]');
  const R = await page.evaluate(() => ({ ...__piverdraw.S.insts[0], len: 300 * 96 / 25.4, h: 64 }));
  await page.keyboard.press('p');
  // pen just outside the top edge of ruler (v = -h/2 - 4)
  await drag([[R.x + 200, R.y - R.h / 2 - 4], [R.x + 500, R.y - R.h / 2 - 40]]);
  const rs = await page.evaluate(() => { const o = __piverdraw.page().objects[__piverdraw.page().objects.length - 1]; return o.pts; });
  check('ruler snap stroke straight', rs.length === 2 && Math.abs(rs[0][1] - rs[1][1]) < 0.01, JSON.stringify(rs.map(p => p.map(v => +v.toFixed(1)))));
  // move ruler
  await page.keyboard.press('v'); await drag([[R.x + 300, R.y], [R.x + 300, R.y + 100]]);
  const R2 = await page.evaluate(() => ({ ...__piverdraw.S.insts[0], len: 300 * 96 / 25.4, h: 64 })); check('ruler moved', Math.abs(R2.y - (R.y + 100)) < 1, 'y=' + R2.y.toFixed(1));
  // rotate ruler
  await drag([[R2.x + R2.len + 20 / (await page.evaluate(() => __piverdraw.view().z)), R2.y], [R2.x + R2.len / 2, R2.y + 400]]);
  const R3 = await page.evaluate(() => ({ ...__piverdraw.S.insts[0] })); check('ruler rotated', Math.abs(R3.a) > .1, 'a=' + R3.a.toFixed(2));
  await page.screenshot({ path: 'shot-ruler.png' });
  await page.click('#btnInst'); await page.click('[data-inst="ruler"]');

  // pages
  await page.click('#pgAdd'); s = await st(); check('add page', s.pages === 2 && s.cur === 1 && s.n === 0, JSON.stringify(s));
  await page.keyboard.press('p'); await drag([[300, 300], [500, 400]]);
  await page.click('#pgDup'); s = await st(); check('dup page', s.pages === 3 && s.cur === 2 && s.n === 1, JSON.stringify(s));
  await page.click('#pgUp'); s = await st(); check('move page up', s.cur === 1);
  await page.click('#pgDel'); s = await st(); check('delete page', s.pages === 2);
  await page.keyboard.press('PageUp'); s = await st(); check('PageUp', s.cur === 0, JSON.stringify(s));
  await page.waitForTimeout(500);
  const thumbs = await page.$$eval('.thumb canvas', cs => cs.map(c => [c.width, c.height]));
  check('thumbnails rendered', thumbs.length === 2 && thumbs.every(t => t[0] > 0), JSON.stringify(thumbs));

  // background change
  await page.selectOption('#bgSel', 'seyes'); await page.waitForTimeout(100);
  await page.screenshot({ path: 'shot-seyes.png' });
  await page.selectOption('#bgSel', 'noir'); await page.waitForTimeout(100);
  const colN = await page.evaluate(() => __piverdraw.S.color); check('noir switches to white pen', colN === '#f7f7f2', colN);
  await page.screenshot({ path: 'shot-noir.png' });
  await page.selectOption('#bgSel', 'blank');

  // exports
  await page.click('#btnFile'); await page.click('[data-act="png"]'); await page.waitForTimeout(500);
  await page.click('#btnFile'); await page.click('[data-act="pdfout"]'); await page.waitForTimeout(1500);
  await page.click('#btnFile'); await page.click('[data-act="save"]'); await page.waitForTimeout(300);
  const saved = await page.evaluate(() => window.__saved.map(x => ({ filename: x.filename, size: x.size, b64: x.b64 })));
  for (const f of saved) fs.writeFileSync(f.filename, Buffer.from(f.b64, 'base64'));
  check('3 files saved', saved.length === 3, saved.map(x => x.filename + ':' + x.size).join(', '));

  // reload persistence
  await page.waitForTimeout(1500);
  const before2 = await st();
  await page.reload(); await page.waitForTimeout(800);
  const after2 = await st(); check('persist after reload', after2.pages === before2.pages && after2.n === before2.n, JSON.stringify([before2, after2]));

  // image import
  await page.setInputFiles('#fileImg', path.join(__dirname, 'test-img.png')).catch(e => out('img skipped', e.message));
  await page.waitForTimeout(600);
  s = await st(); out('after image import', JSON.stringify(s));

  // pdf import (the exported PDF)
  const pdfFile = saved.find(f => f.filename.endsWith('.pdf'));
  if (pdfFile) {
    await page.setInputFiles('#filePdf', path.join(__dirname, pdfFile.filename));
    await page.waitForFunction(() => /PDF importé|n’a pas|indisponible/.test(document.getElementById('toast').textContent), null, { timeout: 20000 }).catch(() => out('pdf import timeout'));
    out('toast:', await page.textContent('#toast'));
    s = await st(); out('after pdf import', JSON.stringify(s));
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'shot-pdf.png' });
  }

  // presentation
  await page.click('#btnPresent'); await page.waitForTimeout(300);
  const pres = await page.evaluate(() => document.getElementById('app').classList.contains('present')); check('present mode', pres);
  await page.screenshot({ path: 'shot-present.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);

  // keyboard help
  await page.click('#btnHelp'); await page.waitForTimeout(100); await page.screenshot({ path: 'shot-help.png' }); await page.keyboard.press('Escape');

  out('ERRORS', JSON.stringify(errors, null, 1));
  await browser.close();
})();
