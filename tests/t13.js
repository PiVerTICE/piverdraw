const { chromium } = require('playwright');
const out = (...a) => console.log(...a);
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
  const errs = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message + (e.stack || '').slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push('[console] ' + m.text()); });
  const check = (n, c, x = '') => out((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : ''));
  await page.goto('http://localhost:8765/index.html'); await page.waitForTimeout(700);
  const A = f => page.evaluate(f);
  const openClass = async (id) => { await page.click('#btnClass'); await page.click(`#classMenu [data-cls="${id}"]`); };
  const txt = s => page.$eval(s, e => e.textContent);
  const rect = s => page.$eval(s, e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; });
  const vis = async s => (await page.$(s)) ? page.$eval(s, e => !e.hidden && e.getBoundingClientRect().width > 0) : false;
  const objCount = () => page.evaluate(() => __piverdraw.page().objects.length);

  // ── Menu Classe ──
  await page.click('#btnClass'); await page.waitForTimeout(100);
  const items = await page.$$eval('#classMenu [data-cls]', bs => bs.map(b => [b.dataset.cls, getComputedStyle(b).display !== 'none']));
  check('menu Classe: minuteur, tirage, rideau, QR (masqué sur grand écran), tout fermer', JSON.stringify(items) === JSON.stringify([['timer', true], ['draw', true], ['curtain', true], ['qr', false], ['none', true]]), JSON.stringify(items));
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  check('Escape ferme le menu', !(await vis('#classMenu')));

  // ── Minuteur ──
  await openClass('timer'); await page.waitForTimeout(100);
  check('minuteur : fenêtre visible, 05:00, bouton Démarrer', await vis('.wdg-timer') && (await txt('.tm-time')) === '05:00' && /Démarrer/.test(await txt('.tm-go')), await txt('.tm-time'));
  check('bouton Classe en surbrillance', (await page.getAttribute('#btnClass', 'aria-pressed')) === 'true');
  await page.screenshot({ path: 'shot-timer.png' });
  await page.click('.tm-pre [data-min="10"]'); check('préréglage 10 min', (await txt('.tm-time')) === '10:00');
  await page.click('.tm-adj [data-adj="-60000"]'); check('−1 min → 09:00', (await txt('.tm-time')) === '09:00');
  await page.click('.tm-adj [data-adj="10000"]'); check('+10 s → 09:10', (await txt('.tm-time')) === '09:10');
  await page.click('.tm-pre [data-min="1"]'); await page.click('.tm-adj [data-adj="-60000"]');
  check('on ne descend pas sous 00:01 à l’arrêt', (await txt('.tm-time')) === '00:01', await txt('.tm-time'));
  // décompte réel
  await A(() => { __piverdraw.TM.total = __piverdraw.TM.rem = 3000; }); await page.click('.tm-reset');
  check('remise à zéro : 00:03', (await txt('.tm-time')) === '00:03');
  await page.click('.tm-go'); await page.waitForTimeout(1300);
  let tt = await txt('.tm-time');
  check('décompte en cours, bouton Pause', /^00:0[12]$/.test(tt) && /Pause/.test(await txt('.tm-go')), tt);
  await page.click('.tm-go'); const frozen = await txt('.tm-time'); await page.waitForTimeout(1200);
  check('pause : le temps ne bouge plus, bouton Reprendre', (await txt('.tm-time')) === frozen && /Reprendre/.test(await txt('.tm-go')), frozen);
  await page.click('.tm-go'); await page.waitForTimeout(2600);
  const st = await A(() => ({ done: __piverdraw.TM.done, run: __piverdraw.TM.run, alarms: __piverdraw.TM.alarms, cls: document.querySelector('.wdg-timer').className }));
  check('fin : « Temps écoulé ! », alarme déclenchée une fois', st.done && !st.run && st.alarms === 1 && /done/.test(st.cls) && (await txt('.tm-msg')) === 'Temps écoulé !' && /Recommencer/.test(await txt('.tm-go')), JSON.stringify(st));
  await page.screenshot({ path: 'shot-timer-done.png' });
  await page.click('.tm-go'); await page.waitForTimeout(300);
  check('Recommencer relance le décompte', await A(() => __piverdraw.TM.run && !__piverdraw.TM.done));
  await page.click('.tm-go'); await page.click('.tm-reset');
  // fermé pendant le décompte : continue, et se rouvre à la fin
  await A(() => { __piverdraw.TM.total = __piverdraw.TM.rem = 2000; }); await page.click('.tm-reset'); await page.click('.tm-go');
  await page.click('.wdg-timer .wdg-btns button[aria-label^="Fermer"]'); await page.waitForTimeout(300);
  check('fermer la fenêtre ne coupe pas le minuteur', !(await vis('.wdg-timer')) && await A(() => __piverdraw.TM.run));
  await page.click('#btnClass'); const mr = await page.$eval('#classMenu [data-cls="timer"] .mr', e => e.textContent); await page.keyboard.press('Escape');
  check('le menu montre le temps restant', /^00:0\d$/.test(mr), mr);
  await page.waitForTimeout(2400);
  check('la fenêtre se rouvre à la fin', await vis('.wdg-timer') && await A(() => __piverdraw.TM.done), '');
  // son coupé
  await page.click('.tm-go'); await page.click('.tm-reset'); await page.click('.tm-snd');
  check('son coupé : bouton enfoncé relâché', (await page.getAttribute('.tm-snd', 'aria-pressed')) === 'false');
  const a0 = await A(() => __piverdraw.TM.alarms);
  await A(() => { __piverdraw.TM.total = __piverdraw.TM.rem = 1500; }); await page.click('.tm-reset'); await page.click('.tm-go'); await page.waitForTimeout(2200);
  check('son coupé : pas d’alarme sonore mais fin affichée', (await A(() => __piverdraw.TM.alarms)) === a0 && await A(() => __piverdraw.TM.done));
  await page.click('.tm-snd');
  // déplacement + agrandir
  const r0 = await rect('.wdg-timer');
  const hd = await rect('.wdg-timer .wdg-head');
  await page.mouse.move(hd.x + 40, hd.y + 15); await page.mouse.down(); await page.mouse.move(hd.x - 160, hd.y + 120, { steps: 6 }); await page.mouse.up();
  const r1 = await rect('.wdg-timer');
  check('la fenêtre se déplace en tirant sa barre', Math.abs((r1.x - r0.x) + 200) < 3 && Math.abs((r1.y - r0.y) - 105) < 3, JSON.stringify([r0.x, r0.y, r1.x, r1.y]));
  await page.mouse.move(hd.x + 40, hd.y + 15 + 105); await page.mouse.down(); await page.mouse.move(-500, -500, { steps: 4 }); await page.mouse.up();
  const r2 = await rect('.wdg-timer'); const sr = await rect('#stage');
  check('elle reste dans la scène', r2.x >= sr.x - 1 && r2.y >= sr.y - 1, JSON.stringify([r2.x, r2.y, sr.x, sr.y]));
  const w0 = (await rect('.wdg-timer')).w; await page.click('.tm-big'); const w1 = (await rect('.wdg-timer')).w;
  check('agrandir le minuteur', w1 > w0 + 100, w0 + ' → ' + w1);
  await page.screenshot({ path: 'shot-timer-big.png' }); await page.click('.tm-big');
  // le tableau reste utilisable derrière / à côté : on dessine hors de la fenêtre
  const n0 = await objCount(); await page.keyboard.press('p'); await page.mouse.move(500, 600); await page.mouse.down(); await page.mouse.move(700, 650, { steps: 5 }); await page.mouse.up();
  check('on peut toujours dessiner à côté de la fenêtre', (await objCount()) === n0 + 1);
  await page.click('.wdg-timer .wdg-btns button[aria-label^="Fermer"]');

  // ── Tirage au sort ──
  await openClass('draw'); await page.waitForSelector('.dr-ta');
  check('tirage : sans liste, on arrive sur la saisie', await vis('.dr-ta') && !(await vis('.dr-pick')));
  await page.fill('.dr-name', 'Test 6A'); await page.fill('.dr-ta', 'Ana\nBen\nChloé\nDavid\n<img src=x onerror=window.__xss=1>\n');
  await page.click('[data-a="save"]'); await page.waitForSelector('.dr-pick');
  check('liste enregistrée : 5 noms, sélecteur', (await page.$$eval('.chip', c => c.length)) === 5 && (await page.$eval('.dr-list', s => s.selectedOptions[0].textContent)) === 'Test 6A (5)');
  check('un nom contenant du HTML est affiché comme texte (pas d’exécution)', !(await A(() => window.__xss)) && (await page.$$eval('.wdg-draw img', i => i.length)) === 0 && (await page.$$eval('.chip', c => c.map(x => x.textContent))).some(t => t.startsWith('<img')));
  await page.screenshot({ path: 'shot-draw.png' });
  const pickOnce = async () => { await page.click('.dr-pick'); await page.waitForSelector('.dr-out.win', { timeout: 5000 }); return txt('.dr-out'); };
  const got = []; for (let i = 0; i < 5; i++) got.push(await pickOnce());
  check('5 tirages sans répétition : tous les élèves, une fois chacun', new Set(got).size === 5, JSON.stringify(got));
  check('compteur « 5 / 5 déjà passés »', /5 \/ 5/.test(await txt('.dr-foot .note')));
  const again = await pickOnce();
  check('au 6e tirage : on recommence, un nom valide', got.includes(again) && /1 \/ 5/.test(await txt('.dr-foot .note')), again);
  await page.click('[data-a="reset"]'); check('remise à zéro', /0 \/ 5/.test(await txt('.dr-foot .note')) && (await txt('.dr-out')) === 'Prêt ?');
  // absent
  await page.click('.chip:has-text("Ana")'); check('Ana marquée absente', (await page.getAttribute('.chip:has-text("Ana")', 'aria-pressed')) === 'true' && /0 \/ 4/.test(await txt('.dr-foot .note')));
  const g2 = []; for (let i = 0; i < 4; i++) g2.push(await pickOnce());
  check('une élève absente n’est jamais tirée', !g2.includes('Ana') && new Set(g2).size === 4, JSON.stringify(g2));
  // sans exclusion
  await page.uncheck('input[data-a="once"]'); await page.click('[data-a="reset"]');
  const g3 = []; for (let i = 0; i < 12; i++) g3.push(await pickOnce());
  check('sans exclusion : des répétitions possibles, jamais d’absent', !g3.includes('Ana') && new Set(g3).size < 12, new Set(g3).size + ' noms différents');
  await page.check('input[data-a="once"]');
  // groupes
  await page.click('.dr-seg [data-v="groups"]'); await page.waitForSelector('[data-a="make"]');
  check('groupes : 4 présents, 3 groupes par défaut', (await txt('.dr-n')) === '3' && /4 élèves présents : 3 groupes de 1 ou 2/.test(await txt('.wdg-draw .note')), await txt('.wdg-draw .note'));
  await page.click('[data-a="make"]'); await page.waitForSelector('.gr-card');
  const grp = await page.$$eval('.gr-card', cs => cs.map(c => [...c.querySelectorAll('div')].map(d => d.textContent)));
  const flat = grp.flat();
  check('3 groupes équilibrés, chaque présent une seule fois', grp.length === 3 && grp.map(g => g.length).sort().join() === '1,1,2' && new Set(flat).size === 4 && !flat.includes('Ana'), JSON.stringify(grp));
  await page.click('[data-a="gplus"]'); check('nombre de groupes plafonné au nombre de présents', (await txt('.dr-n')) === '4' && await page.$eval('[data-a="gplus"]', b => b.disabled));
  await page.click('[data-a="gminus"]'); await page.click('[data-a="gminus"]');
  check('et jamais moins de 2', (await txt('.dr-n')) === '2' && await page.$eval('[data-a="gminus"]', b => b.disabled));
  await page.click('[data-a="make"]'); await page.waitForTimeout(100);
  await page.screenshot({ path: 'shot-groups.png' });
  const nb = await objCount(); const sel0 = await A(() => __piverdraw.S.undo.length);
  await page.click('[data-a="board"]'); await page.waitForTimeout(150);
  const after = await A(() => ({ n: __piverdraw.page().objects.length, sel: __piverdraw.S.sel.size, tool: __piverdraw.S.tool, undo: __piverdraw.S.undo.length, texts: __piverdraw.page().objects.filter(o => o.t === 'text').slice(-2).map(o => o.text), xs: __piverdraw.page().objects.slice(-2).map(o => [Math.round(o.x), Math.round(o.y)]) }));
  check('« Écrire sur le tableau » : 2 textes ajoutés, sélectionnés, un seul pas d’annulation', after.n === nb + 2 && after.sel === 2 && after.tool === 'select' && after.undo === sel0 + 1 && /^Groupe 1\n/.test(after.texts[0]), JSON.stringify(after));
  await page.keyboard.press('Control+z'); check('annuler retire les groupes d’un coup', (await objCount()) === nb);
  await page.screenshot({ path: 'shot-groups-board.png' });
  // mémorisation
  await page.waitForTimeout(300); await page.reload(); await page.waitForTimeout(800);
  await openClass('draw'); await page.waitForSelector('.dr-pick');
  check('les listes sont retrouvées après rechargement', (await page.$$eval('.chip', c => c.length)) === 5 && (await page.$eval('.dr-list', s => s.selectedOptions[0].textContent)) === 'Test 6A (5)');
  // collage sur une ligne, nouvelle liste, suppression
  await page.selectOption('.dr-list', '__new'); await page.waitForSelector('.dr-ta');
  await page.fill('.dr-name', 'Autre'); await page.fill('.dr-ta', 'Zoé, Yann; Xavier\tWendy'); await page.click('[data-a="save"]'); await page.waitForSelector('.dr-pick');
  check('collage « Zoé, Yann; … » sur une ligne : 4 noms', (await page.$$eval('.chip', c => c.map(x => x.textContent))).join() === 'Zoé,Yann,Xavier,Wendy');
  await page.click('[data-a="edit"]'); await page.waitForSelector('[data-a="del"]'); await page.click('[data-a="del"]');
  check('suppression : premier clic demande confirmation', /Supprimer \?/.test(await txt('[data-a="del"]')));
  await page.click('[data-a="del"]'); await page.waitForSelector('.dr-pick');
  check('suppression confirmée : retour sur la liste restante', (await page.$eval('.dr-list', s => s.selectedOptions[0].textContent)) === 'Test 6A (5)' && (await page.$$eval('.dr-list option', o => o.length)) === 2);
  await page.click('.wdg-draw .wdg-btns button[aria-label^="Fermer"]');

  // ── Rideau ──
  await openClass('curtain'); await page.waitForTimeout(150);
  const S0 = await rect('#stage'); let cu = await rect('#curtain');
  check('rideau : couvre toute la scène au départ', Math.abs(cu.h - S0.h) < 2 && Math.abs(cu.w - S0.w) < 2 && (await vis('.cu-hint')), JSON.stringify(cu));
  await page.screenshot({ path: 'shot-curtain-full.png' });
  const n1 = await objCount(); await page.keyboard.press('Escape'); await page.keyboard.press('p'); await page.mouse.move(600, 400); await page.mouse.down(); await page.mouse.move(700, 450, { steps: 4 }); await page.mouse.up();
  check('on ne dessine pas à travers le rideau', (await objCount()) === n1);
  const gr = await rect('.cu-grip');
  await page.mouse.move(gr.x + gr.w * .6, gr.y + 17); await page.mouse.down(); await page.mouse.move(gr.x + gr.w * .6, gr.y + 17 + 300, { steps: 8 }); await page.mouse.up();
  cu = await rect('#curtain');
  check('tirer la poignée vers le bas dévoile 300 px', Math.abs((S0.h - cu.h) - 300) < 3, S0.h + ' → ' + cu.h);
  check('le rideau reste ancré en bas', Math.abs(cu.b - S0.b) < 2);
  check('valeur ARIA du curseur', (await page.getAttribute('.cu-grip', 'aria-valuenow')) === String(Math.round((1 - cu.h / S0.h) * 100)), await page.getAttribute('.cu-grip', 'aria-valuetext'));
  const n2 = await objCount(); await page.mouse.move(500, 200); await page.mouse.down(); await page.mouse.move(620, 240, { steps: 4 }); await page.mouse.up();
  check('on dessine dans la partie dévoilée', (await objCount()) === n2 + 1);
  await page.screenshot({ path: 'shot-curtain-half.png' });
  await page.focus('.cu-grip'); const before = cu.h; await page.keyboard.press('ArrowDown'); cu = await rect('#curtain');
  check('flèche bas dévoile 5 %', Math.abs((before - cu.h) - S0.h * .05) < 3, before + ' → ' + cu.h);
  await page.keyboard.press('Shift+ArrowUp'); cu = await rect('#curtain');
  check('Maj + flèche haut recouvre 20 %', Math.abs(cu.h - (before - S0.h * .05 + S0.h * .2)) < 3);
  await page.click('[data-cuedge="right"]'); cu = await rect('#curtain');
  check('rideau à droite : ancré à droite, pleine hauteur', Math.abs(cu.r - S0.r) < 2 && Math.abs(cu.h - S0.h) < 2 && cu.w < S0.w, JSON.stringify(cu));
  const g3r = await rect('.cu-grip'); await page.mouse.move(g3r.x + 17, g3r.y + g3r.h * .6); await page.mouse.down(); await page.mouse.move(g3r.x + 17 + 250, g3r.y + g3r.h * .6, { steps: 6 }); await page.mouse.up();
  const cw = (await rect('#curtain')).w;
  check('glisser la poignée vers la droite dévoile', cw < cu.w - 200, cu.w + ' → ' + cw);
  await page.click('[data-cuedge="top"]'); await page.click('[data-cuedge="left"]'); cu = await rect('#curtain');
  check('rideau à gauche', Math.abs(cu.x - S0.x) < 2);
  await page.click('[data-cuclose]'); check('le rideau se retire', !(await vis('#curtain')));
  check('le menu n’indique plus rien d’ouvert', (await page.getAttribute('#btnClass', 'aria-pressed')) === 'false');

  // ── Tout fermer + persistance entre tableaux ──
  await openClass('timer'); await openClass('curtain'); await openClass('draw'); await page.waitForTimeout(300);
  await page.click('#btnLib'); await page.click('#libNew'); await page.waitForTimeout(400);
  check('changer de tableau ne ferme pas les outils', await vis('.wdg-timer') && await vis('.wdg-draw') && await vis('#curtain'));
  await page.click('#btnClass'); await page.click('#classMenu [data-cls="none"]'); await page.waitForTimeout(100);
  check('« Tout fermer »', !(await vis('.wdg-timer')) && !(await vis('.wdg-draw')) && !(await vis('#curtain')));

  // ── Mode présentation ──
  await page.click('#btnPresent'); await page.waitForTimeout(400);
  check('présentation : bouton Classe dans la barre', await vis('#pClass'));
  await page.click('#pClass'); await page.waitForTimeout(100);
  const pm = await rect('#pClassMenu'), pb = await rect('#pbar');
  check('le menu s’ouvre au-dessus de la barre, entièrement visible', pm.b <= pb.y + 1 && pm.y >= 0 && pm.x >= 0 && pm.r <= 1280, JSON.stringify([pm, pb.y]));
  check('QR code accessible dans le menu de présentation', await page.$eval('#pClassMenu [data-cls="qr"]', b => getComputedStyle(b).display !== 'none'));
  await page.screenshot({ path: 'shot-present-menu.png' });
  await page.click('#pClassMenu [data-cls="timer"]'); await page.waitForTimeout(150);
  const tr = await rect('.wdg-timer'); const stp = await rect('#stage');
  check('minuteur en présentation : dans la scène, au-dessus du tableau', await vis('.wdg-timer') && tr.x >= stp.x && tr.r <= stp.r + 1 && tr.y >= 0, JSON.stringify(tr));
  await page.click('#pClass'); await page.click('#pClassMenu [data-cls="curtain"]'); await page.waitForTimeout(150);
  check('rideau en présentation', await vis('#curtain'));
  await page.screenshot({ path: 'shot-present-tools.png' });
  const pbEl = await A(() => { const e = document.elementFromPoint(640, document.querySelector('#pbar').getBoundingClientRect().top + 10); return !!e.closest('#pbar'); });
  check('la barre de présentation reste au-dessus du rideau', pbEl);
  await page.click('#pExit'); await page.waitForTimeout(300);
  check('on quitte la présentation, les outils restent', await vis('.wdg-timer') && await vis('#curtain'));
  await page.click('#btnClass'); await page.click('#classMenu [data-cls="none"]');

  // ── Mobile ──
  for (const w of [412, 360]) {
    await page.setViewportSize({ width: w, height: 800 }); await page.waitForTimeout(300);
    const hd = await A(() => ({ docW: document.documentElement.scrollWidth, vw: innerWidth, qr: getComputedStyle(document.querySelector('#btnQr')).display, cls: Math.round(document.querySelector('#btnClass').getBoundingClientRect().right) }));
    check(`mobile ${w} : en-tête sans débordement, QR rangé dans le menu Classe`, hd.docW <= hd.vw && hd.qr === 'none' && hd.cls <= w, JSON.stringify(hd));
    await page.click('#btnClass'); await page.waitForTimeout(100);
    const mq = await page.$eval('#classMenu [data-cls="qr"]', b => getComputedStyle(b).display !== 'none'); const mrx = await rect('#classMenu');
    check(`mobile ${w} : menu Classe visible avec QR`, mq && mrx.x >= 0 && mrx.r <= w, JSON.stringify(mrx));
    await page.click('#classMenu [data-cls="timer"]'); await page.waitForTimeout(150);
    let t = await rect('.wdg-timer');
    check(`mobile ${w} : minuteur dans l’écran`, t.x >= 0 && t.r <= w + .5 && t.b <= 800, JSON.stringify(t));
    await page.click('.tm-big'); t = await rect('.wdg-timer'); check(`mobile ${w} : minuteur agrandi dans l’écran`, t.x >= 0 && t.r <= w + .5, JSON.stringify(t)); await page.click('.tm-big');
    await page.screenshot({ path: `shot-mob-timer-${w}.png` });
    await page.click('#btnClass'); await page.click('#classMenu [data-cls="draw"]'); await page.waitForSelector('.dr-seg'); await page.click('.dr-seg [data-v="draw"]'); await page.waitForSelector('.dr-pick');
    let d = await rect('.wdg-draw'); check(`mobile ${w} : tirage dans l’écran`, d.x >= 0 && d.r <= w + .5 && d.b <= 800.5, JSON.stringify(d));
    await page.click('.dr-seg [data-v="groups"]'); await page.click('[data-a="make"]'); await page.waitForTimeout(100);
    d = await rect('.wdg-draw'); const sw = await page.$eval('.wdg-draw .wdg-body', b => [b.scrollWidth, b.clientWidth]);
    check(`mobile ${w} : groupes sans défilement horizontal`, d.r <= w + .5 && d.b <= 800.5 && sw[0] <= sw[1] + 1, JSON.stringify([d, sw]));
    await page.screenshot({ path: `shot-mob-draw-${w}.png` });
    await page.click('#btnClass'); await page.click('#classMenu [data-cls="curtain"]'); await page.waitForTimeout(100);
    await page.screenshot({ path: `shot-mob-curtain-${w}.png` });
    await page.click('#btnClass'); await page.click('#classMenu [data-cls="none"]');
  }
  out('errors', JSON.stringify(errs));
  await browser.close();
})();
