const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(600);
  await page.keyboard.press('k');
  const red = () => page.evaluate(() => { const c = document.getElementById('cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 130 && d[i + 2] < 120) n++; return n; });
  const base = await red();
  await page.mouse.move(400, 300); await page.mouse.down();
  for (let i = 0; i <= 20; i++) { await page.mouse.move(400 + i * 20, 300 + Math.sin(i / 3) * 60); await page.waitForTimeout(12); }
  await page.mouse.up(); const t0 = Date.now();
  const res = []; for (const ms of [200, 1200, 1900, 3200]) { await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0))); res.push([ms, (await red()) - base]); if (ms === 1200 || ms === 1900) await page.screenshot({ path: 'shot-laser-' + ms + '.png', clip: { x: 300, y: 200, width: 600, height: 250 } }); }
  console.log(JSON.stringify(res), 'errors', JSON.stringify(errs));
  const [a, b, c, d] = res.map(r => r[1]);
  console.log((a > 0 ? 'PASS' : 'FAIL') + ' visible at 0.2 s;', (b > 0 ? 'PASS' : 'FAIL') + ' still visible at 1.2 s (was gone after 0.9 s);', (c >= 0 ? 'PASS' : 'FAIL') + ' fading at 2.0 s;', (d === 0 ? 'PASS' : 'FAIL') + ' gone at 3.2 s');
  await browser.close();
})();
