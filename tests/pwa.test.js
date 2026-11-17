const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SUBROOT = process.env.PIVERDRAW_SUBROOT;   // dossier servi sur le port 8767 (copie de site/ dans « piverdraw/ »), préparé par outils/run_tests.sh
const check = (n, c, x = '') => console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : ''));
(async () => {
  const browser = await chromium.launch();
  async function open(url, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts }), page = await ctx.newPage(), errs = [], external = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('[console] ' + m.text()); });
    await ctx.route('**/*', r => { const u = r.request().url(); if (/^http:\/\/localhost/.test(u)) return r.continue(); external.push(u); return r.abort(); });
    await page.goto(url); await page.waitForTimeout(800);
    return { ctx, page, errs, external };
  }
  const swReady = async page => { await page.evaluate(() => navigator.serviceWorker.ready.then(() => true)); await page.waitForFunction(() => navigator.serviceWorker.controller || false, null, { timeout: 8000 }).catch(() => {}); };

  // ---------- A. à la racine ----------
  let { ctx, page, errs, external } = await open('http://localhost:8766/');
  check('page loads, manifest linked', !!(await page.$('link[rel="manifest"]')) && (await page.title()) === 'PiVerDraw');
  check('no external request at all (no CDN, no Google Fonts)', external.length === 0, JSON.stringify(external));
  check('fonts served locally', await page.evaluate(async () => { await document.fonts.ready; return ['500 16px "IBM Plex Sans"', '700 20px "Bricolage Grotesque"', '400 12px "IBM Plex Mono"'].every(f => document.fonts.check(f)); }));
  const faces = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family));
  check('Plex Sans, Plex Mono and Bricolage faces really loaded', ['IBM Plex Sans', 'IBM Plex Mono', 'Bricolage Grotesque'].every(n => faces.some(f => f.replace(/"/g, '') === n)), JSON.stringify([...new Set(faces)]));
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForTimeout(600);
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { scope: r && r.scope, active: !!(r && r.active), controlled: !!navigator.serviceWorker.controller, caches: await caches.keys() }; });
  check('service worker active, page controlled, one versioned cache', sw.active && sw.controlled && sw.caches.length === 1 && /^piverdraw-[0-9a-f]{10}$/.test(sw.caches[0]), JSON.stringify(sw));
  const cached = await page.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return (await c.keys()).length; });
  check('all 23 files precached (+ root)', cached >= 23, String(cached));
  const cdp = await ctx.newCDPSession(page); await cdp.send('Page.enable');
  const inst = await cdp.send('Page.getInstallabilityErrors').catch(e => ({ err: String(e) }));
  check('installability: no errors reported by Chromium', inst.installabilityErrors && inst.installabilityErrors.length === 0, JSON.stringify(inst));
  const mf = await cdp.send('Page.getAppManifest').catch(e => ({ err: String(e) }));
  check('manifest parsed without errors', mf.url && (!mf.errors || mf.errors.length === 0), JSON.stringify(mf.errors || mf.err));

  // dessin + hors ligne
  await page.click('[data-tool="pen"]'); const r = await page.evaluate(() => document.getElementById('cv').getBoundingClientRect().toJSON());
  await page.mouse.move(r.x + 300, r.y + 300); await page.mouse.down(); await page.mouse.move(r.x + 520, r.y + 360, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500);
  await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(900);
  check('OFFLINE: page reloads from the cache', (await page.title()) === 'PiVerDraw' && !!(await page.$('#cv')));
  check('OFFLINE: fonts still available', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('500 16px "IBM Plex Sans"'); }));
  // PDF hors ligne
  const pdf = path.join(__dirname, 'exemple.pdf');
  if (pdf) {
    await page.setInputFiles('#filePdf', pdf); await page.waitForTimeout(3500);
    const n = await page.evaluate(() => window.pdfjsLib ? __x() : 0).catch(() => null);
    const hasLib = await page.evaluate(() => !!window.pdfjsLib && /vendor\/pdfjs\/pdf\.worker/.test(window.pdfjsLib.GlobalWorkerOptions.workerSrc));
    const imgs = await page.evaluate(() => document.querySelectorAll('#thumbs .thumb').length);
    check('OFFLINE: PDF import works with the local pdf.js (worker same-origin)', hasLib && imgs >= 1, JSON.stringify({ hasLib, pages: imgs }));
  }
  // QR hors ligne
  await page.keyboard.press('Escape'); await page.click('#btnQr'); await page.waitForSelector('#qrUrl, .dlg input', { timeout: 4000 }).catch(() => {});
  const inp = await page.$('.dlg input.field'); if (inp) { await inp.fill('https://exemple.fr/classe'); await page.waitForTimeout(600); }
  check('OFFLINE: QR code generated with the local library', await page.evaluate(() => !!window.qrcode && !!document.querySelector('#qrCv') && document.querySelector('#qrCv').width > 20));
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  check('no page error during the offline session', errs.length === 0, JSON.stringify(errs));
  await ctx.setOffline(false); await ctx.close();

  // ---------- B. bouton d'installation ----------
  ({ ctx, page, errs } = await open('http://localhost:8766/'));
  const vis = async () => page.evaluate(() => { const b = document.querySelector('[data-act="install"]'); return !b.hidden && getComputedStyle(b).display !== 'none'; });
  await page.click('#btnFile'); check('install item hidden at first (no browser prompt available)', !(await vis())); await page.keyboard.press('Escape'); await page.click('body', { position: { x: 600, y: 400 } });
  await page.evaluate(() => { window.__prompted = 0; const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted++; return Promise.resolve(); }; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
  await page.click('#btnFile'); check('install item appears when the browser offers installation', await vis());
  await page.screenshot({ path: 'shot-install-menu.png' });
  await page.click('[data-act="install"]'); await page.waitForTimeout(250);
  check('click → native install prompt shown once', (await page.evaluate(() => window.__prompted)) === 1);
  await page.click('#btnFile'); check('after “dismissed”, item stays available', await vis());
  await page.click('[data-act="install"]'); await page.waitForSelector('.dlg h2'); const t = await page.evaluate(() => document.querySelector('.dlg').innerText);
  check('then explains the manual steps (browser menu)', /Installer PiVerDraw/.test(t) && /menu de votre navigateur/.test(t), t.slice(0, 120).replace(/\n/g, ' | '));
  await page.screenshot({ path: 'shot-install-dialog.png' }); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  check('Escape closes the dialog', !(await page.$('.dlg')));
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled'))); await page.click('#btnFile'); check('after appinstalled the item disappears', !(await vis()));
  check('no errors', errs.length === 0, JSON.stringify(errs)); await ctx.close();

  // déjà installée (mode application) : jamais de bouton
  ({ ctx, page } = await open('http://localhost:8766/', { }));
  await ctx.close();
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await c2.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
  const p2 = await c2.newPage(); await p2.route('**/*', r => /^http:\/\/localhost/.test(r.request().url()) ? r.continue() : r.abort()); await p2.goto('http://localhost:8766/'); await p2.waitForTimeout(600);
  await p2.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
  await p2.click('#btnFile'); check('already running as an installed app → no install item', await p2.evaluate(() => document.querySelector('[data-act="install"]').hidden)); await c2.close();

  // ---------- C. iPhone / iPad (Safari) ----------
  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  ({ ctx, page, errs } = await open('http://localhost:8766/', { userAgent: UA, viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true }));
  await page.evaluate(() => document.getElementById('btnFile').click()); await page.waitForTimeout(150);
  check('iOS: install item visible without any browser event', await page.evaluate(() => !document.querySelector('[data-act="install"]').hidden));
  await page.evaluate(() => document.querySelector('[data-act="install"]').click()); await page.waitForSelector('.dlg h2');
  const ti = await page.evaluate(() => document.querySelector('.dlg').innerText);
  check('iOS: dialog explains Partager › Sur l’écran d’accueil', /Partager/.test(ti) && /écran d’accueil/.test(ti), ti.replace(/\n/g, ' | ').slice(0, 200));
  const fits = await page.evaluate(() => { const d = document.querySelector('.dlg').getBoundingClientRect(); return d.left >= 0 && d.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth; });
  check('iOS: dialog fits the phone screen', fits); await page.screenshot({ path: 'shot-install-ios.png' });
  check('iOS: no errors', errs.length === 0, JSON.stringify(errs)); await ctx.close();

  // ---------- C bis. Safari sur Mac : « Fichier › Ajouter au Dock… » ----------
  const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
  ({ ctx, page, errs } = await open('http://localhost:8766/', { userAgent: UA_MAC, viewport: { width: 1280, height: 800 } }));
  await page.evaluate(() => document.getElementById('btnFile').click()); await page.waitForTimeout(150);
  check('Mac Safari: install item visible without any browser event', await page.evaluate(() => !document.querySelector('[data-act="install"]').hidden));
  await page.evaluate(() => document.querySelector('[data-act="install"]').click()); await page.waitForSelector('.dlg h2');
  const tm = await page.evaluate(() => document.querySelector('.dlg ol').innerText);
  check('Mac Safari: steps explain Fichier › Ajouter au Dock', /Ajouter au Dock/.test(tm) && /Fichier/.test(tm) && !/écran d’accueil/.test(tm), tm.replace(/\n/g, ' | ').slice(0, 200));
  await page.screenshot({ path: 'shot-install-macsafari.png' });
  check('Mac Safari: no errors', errs.length === 0, JSON.stringify(errs)); await ctx.close();

  // ---------- D. version « artefact » (sans manifeste) : jamais de bouton ----------
  ({ ctx, page } = await open('http://localhost:8765/index.html'));
  await page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
  await page.click('#btnFile'); check('artifact build: install item never shown', await page.evaluate(() => document.querySelector('[data-act="install"]').hidden)); await ctx.close();

  // ---------- E. sous-dossier + mise à jour ----------
  ({ ctx, page, errs, external } = await open('http://localhost:8767/piverdraw/'));
  await swReady(page); await page.reload(); await page.waitForTimeout(600);
  const sc = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { scope: r.scope, k: await caches.keys(), ctl: !!navigator.serviceWorker.controller }; });
  check('sub-folder hosting: scope is /piverdraw/, controlled', sc.scope === 'http://localhost:8767/piverdraw/' && sc.ctl, JSON.stringify(sc));
  check('first install: no « nouvelle version » banner', !(await page.isVisible('#updBar')));
  await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(700); check('sub-folder: works offline', (await page.title()) === 'PiVerDraw' && !!(await page.$('#cv'))); await ctx.setOffline(false);
  // nouvelle version : sw.js modifié → ancien cache supprimé
  const swp = path.join(SUBROOT, 'piverdraw', 'sw.js'); fs.writeFileSync(swp, fs.readFileSync(swp, 'utf8').replace(/piverdraw-[0-9a-f]{10}/, 'piverdraw-nouvelle1'));
  await page.reload(); let after = { k: [] };
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(500); after = await page.evaluate(async () => ({ k: await caches.keys() })); if (after.k.length === 1 && after.k[0] === 'piverdraw-nouvelle1') break; }
  check('update: banner « nouvelle version » shown in the open page', await page.isVisible('#updBar'));
  await Promise.all([page.waitForNavigation(), page.click('#updGo')]); await page.waitForTimeout(600);
  check('update: after Recharger, banner gone', !(await page.isVisible('#updBar')));
  check('update: new cache installed, old cache removed', after.k.length === 1 && after.k[0] === 'piverdraw-nouvelle1', JSON.stringify(after));
  check('update: app still works', !!(await page.$('#cv')) && errs.length === 0, JSON.stringify(errs)); await ctx.close();
  await browser.close();
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
