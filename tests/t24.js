// t24 : bandeau « Une nouvelle version de PiVerDraw est prête » (événement piverdraw-update envoyé par pwa.js)
const H = require('./h.js');
(async () => {
  const T = await H(), { page, check } = T;
  const vis = s => page.isVisible(s);
  check('banner hidden at start', !(await vis('#updBar')));
  await page.evaluate(() => window.dispatchEvent(new Event('piverdraw-update'))); await page.waitForTimeout(100);
  check('banner shown on update event', await vis('#updBar'));
  check('banner text and buttons', /nouvelle version/i.test(await page.textContent('#updBar')) && await vis('#updGo') && (await page.getAttribute('#updLater', 'aria-label')) === 'Plus tard');
  // un message (toast) passe au-dessus du bandeau au lieu de le recouvrir
  await page.evaluate(() => { const t = document.getElementById('toast'); t.textContent = 'Essai'; t.hidden = false; });
  const ov = await page.evaluate(() => { const a = document.getElementById('updBar').getBoundingClientRect(), b = document.getElementById('toast').getBoundingClientRect(); return b.bottom <= a.top; });
  check('toast sits above the banner', ov);
  await page.screenshot({ path: 'shot-update-1280.png' });
  // « Plus tard » ferme le bandeau
  await page.click('#updLater'); check('Plus tard hides the banner', !(await vis('#updBar')));
  // « Recharger » enregistre d'abord le tableau (même un trait posé à l'instant) puis recharge
  await page.keyboard.press('p'); await T.drag([300, 300], [500, 340]);
  await page.evaluate(() => window.dispatchEvent(new Event('piverdraw-update')));
  await Promise.all([page.waitForNavigation(), page.click('#updGo')]); await page.waitForTimeout(800);
  const n = await page.evaluate(() => __piverdraw.page().objects.filter(o => o.t === 'stroke').length);
  check('Recharger: page reloaded, the stroke just drawn was saved', n === 1, String(n));
  check('banner hidden after reload', !(await vis('#updBar')));
  // présentation : bandeau en haut
  await page.evaluate(() => window.dispatchEvent(new Event('piverdraw-update')));
  await page.click('#btnPresent'); await page.waitForTimeout(200);
  const top = await page.evaluate(() => document.getElementById('updBar').getBoundingClientRect().top);
  check('presentation: banner at the top', top < 100, String(top));
  await page.keyboard.press('Escape');
  console.log('errors', JSON.stringify(T.errors)); await T.browser.close();

  // ---- 360 px : le bandeau tient dans l'écran, cibles ≥ 34 px, sans débordement ----
  for (const [w, scheme] of [[360, 'light'], [412, 'dark']]) {
    const M = await H({ viewport: { width: w, height: 760 }, touch: true });
    await M.page.emulateMedia({ colorScheme: scheme });
    await M.page.evaluate(() => window.dispatchEvent(new Event('piverdraw-update'))); await M.page.waitForTimeout(100);
    const r = await M.page.evaluate(() => { const b = document.getElementById('updBar').getBoundingClientRect(), g = document.getElementById('updGo').getBoundingClientRect(), x = document.getElementById('updLater').getBoundingClientRect();
      return { l: b.left, r: b.right, w: innerWidth, sw: document.documentElement.scrollWidth, gh: g.height, xw: x.width, xh: x.height }; });
    M.check(w + ' px ' + scheme + ': banner fits, no overflow, targets ≥ 34 px', r.l >= 0 && r.r <= r.w && r.sw <= r.w && r.gh >= 34 && r.xw >= 34 && r.xh >= 34, JSON.stringify(r));
    await M.page.screenshot({ path: 'shot-update-' + w + '.png' });
    console.log('errors', JSON.stringify(M.errors)); await M.browser.close();
  }
})();
