const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const NM = path.join(__dirname, '..', 'site', 'vendor', 'pdfjs');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
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
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push('[console.' + m.type() + '] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://localhost')) return route.continue();
    if (u.includes('pdf.worker.min.js')) return route.fulfill({ path: path.join(NM, 'pdf.worker.min.js'), contentType: 'application/javascript' });
    if (u.includes('pdf.min.js')) return route.fulfill({ path: path.join(NM, 'pdf.min.js'), contentType: 'application/javascript' });
    return route.abort();
  });
  await page.goto('http://localhost:8765/index.html');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shot-desktop-light.png' });
  const info = await page.evaluate(() => ({ pages: __piverdraw.S.proj.pages.length, objs: __piverdraw.page().objects.length, view: __piverdraw.view() }));
  console.log('init', JSON.stringify(info));
  console.log('ERRORS', JSON.stringify(errors, null, 1));
  await browser.close();
})();
