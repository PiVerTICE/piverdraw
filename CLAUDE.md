# PiVerDraw — tableau blanc web pour la classe

Ce fichier explique le projet à Claude Code (ou à tout développeur) pour continuer à le faire évoluer.
Lis-le en entier avant de modifier quoi que ce soit.

## 1. Contexte et façon de travailler avec Pierre

- **Pierre** est enseignant (francophone, fuseau Europe/Brussels). Il appelle ses classes « mes élèves ». Il a fait construire PiVerDraw avec Claude, **fonction par fonction**, en s'inspirant d'**OpenBoard** (https://github.com/OpenBoard-org/OpenBoard), version web plutôt que fork C++/Qt.
- **Réponds en français**, simplement, sans jargon inutile. Quand une tâche est finie : une ou deux phrases sur ce qui a changé, pas un compte rendu des étapes.
- Pierre choisit ses prochaines fonctions lui-même (« 1, 4 et 5 »…). Propose des pistes (§9) mais ne développe pas ce qu'il n'a pas demandé.
- **Décision de Pierre : pas d'enregistrement direct dans Google Drive.** Ne le propose plus.
- Usage réel : ordinateur, tableau interactif, tablette ou téléphone ; souris, **tactile et stylet** ; en classe, donc **robuste et utilisable sans internet** (c'est pourquoi l'application est une PWA installable).
- **Données d'élèves** : les listes de classe (menu Classe › Tirage au sort) contiennent des prénoms/noms. Elles restent **uniquement dans le navigateur** (IndexedDB, clé `classes`). Ne jamais les envoyer vers un service externe, ne jamais les écrire dans un fichier exporté, ne jamais les mettre dans les tests autrement qu'avec des noms fictifs.

## 2. Démarrage rapide

```bash
npm install                          # installe Playwright
npx playwright install chromium      # navigateur de test (une seule fois)
npm run serve                        # ou : python3 -m http.server 8080 --directory site  → http://localhost:8080
npm test                             # tous les tests automatiques (≈ 4 minutes)
bash outils/run_tests.sh t16 t18     # seulement certains tests
python3 outils/bump_sw.py            # À LANCER avant chaque mise en ligne (voir §7)
```

Pas de bundler, pas de framework, pas d'étape de compilation : on modifie `site/index.html` et on recharge la page.

## 3. Organisation du dossier

```
CLAUDE.md                 ce fichier
package.json              scripts npm (test, bump, serve) ; seule dépendance : playwright
site/                     TOUT ce qui est mis en ligne (rien d'autre n'est publié)
  index.html              l'application entière : CSS + HTML + JavaScript (≈ 3 070 lignes, 220 Ko)
  sw.js                   service worker (cache hors ligne) — généré par outils/bump_sw.py, ne pas éditer à la main
  pwa.js                  enregistre le service worker, demande le stockage durable
  manifest.webmanifest    manifeste d'installation (nom, icônes, couleurs)
  icons/                  icon.svg (source), icon-192/512.png, icon-maskable-512.png, apple-touch-icon.png, favicon-32.png
  fonts/                  IBM Plex Sans/Mono + Bricolage Grotesque en woff2 + fonts.css (licence SIL OFL)
  vendor/                 pdfjs/ (pdf.js 3.11.174 : lecture des PDF) et qrcode.js (qrcode-generator 1.4.4) + licences
  LISEZMOI.txt            mode d'emploi de la mise en ligne, pour Pierre
outils/
  bump_sw.py              recalcule la version du cache dans sw.js
  serve_test.py           serveur de test (port 8765) qui expose window.__piverdraw
  run_tests.sh            lance les serveurs et les tests, résume
tests/                    suites Playwright (voir §6)
```

## 4. Architecture de l'application (`site/index.html`)

Un seul fichier, un seul `<script>` qui est une IIFE (`(function () { 'use strict'; … })()`). Les sections sont repérables par des commentaires `/* ───────── Titre ───────── */`. Ordre actuel :

| Section | Contenu |
|---|---|
| Utilitaires | `$`, `$$`, `clamp`, `uid`, constantes (`MM` = 1 mm en unités de page, `PT` = 0,75), `ICONS` (SVG des icônes, injectés dans les `<svg data-icon="…">`), `PALETTE`, `SIZE_CFG`, `TOOL_KIND`, `HINTS` (texte d'aide par outil), `BGS` (fonds de page) |
| État | objet `S` (projet, page courante, outil, couleurs, sélection `S.sel` = Set d'ids, piles `S.undo`/`S.redo`, instruments `S.insts`, présentation…), `G` = geste en cours |
| Projet | `newPage`, `blankProject`, `sampleProject`, `normalize(d)` (nettoie tout JSON importé), `serialize()`, `loadProject()` |
| Historique | annuler/rétablir par **instantanés** : `commit(fn)` = `pushUndo(); fn(); touched()` (150 pas max) |
| Géométrie | `boundsOf`/`rawBounds`, `hitObj`/`hitRaw`, `xformObj`, `rotateObj`, `unionBounds`, `selObjs`, `expandGroups`, `angOf`/`selAngle`/`selFrame` (cadre de sélection orienté : poignées d'agrandissement et de rotation dans son repère), `rotHandle(frame, z)` |
| Dessin | `drawObj(c, o, live)`, `paintContent(c, pg, vis, opts)` (commun à l'écran, aux vignettes et aux exports), `render()` (écran : contenu + sélection + instruments + laser) |
| Vue | zoom/déplacement par page (`S.views[pageId] = {tx, ty, z}`), `fit()`, molette, pincement |
| Instruments | règle, équerres 45° et 30-60°, rapporteur, compas ; tracé le long des bords |
| Écriture regroupée | `addInk`/`inkJoin` (juste après `addObject`) : un trait de stylo posé moins de 1,5 s (`INK_MS`) après le précédent et proche de lui rejoint son groupe (`gid`) ; `lastInk` en mémoire seulement ; jamais pour le surligneur ni les formes redressées |
| Gestes | `startGesture(tool, e, p, noLink)`, gestionnaires `pointerdown/move/up`, `finishGesture(cancel)` ; `G.kind` ∈ draw, shape, erase, laser, link, move, scale, rotate, marquee, pan, inst-* |
| Gomme « Partie » | `cutPolyline`, `erasePiece`, `shapeOutline` : coupe les traits/formes au bord de la gomme |
| Texte | édition par `<textarea>` superposé (`commitText`) |
| Redressement des formes | `recognizeShape(stroke)` → liste d'objets de remplacement ou `null` ; `armHold` (pointe immobile 0,8 s) |
| Actions sur la sélection | dupliquer, ordre, grouper, verrouiller, pivoter, redresser, copies illimitées |
| Pages | ajout, copie, suppression, déplacement, vignettes (`markThumb`) |
| Interface | `setTool`, `syncAll()` (affiche/masque les groupes de la barre de propriétés `data-g="…"`), menus, dialogues (`dialog`, `closeDialog`, `helpDialog`), `toast` |
| Installation (PWA) | bouton « Installer l'application… » (n'apparaît que si la page a un manifeste et n'est pas déjà installée) |
| Fichiers | `saveFile` (téléchargement), export `exportPNG` / `exportPDF` / `saveProject` (.json), `buildPDF` (PDF écrit à la main, sans bibliothèque), import images / PDF (`importPDF`) / projet |
| QR code, liens | générateur de QR (fond transparent, couleurs, cliquable, libellé), lien cliquable sur texte/image (`safeHref`, `normalizeLink`) |
| Présentation, Clavier | mode présentation (barre `#pbar`), raccourcis |
| Sauvegarde locale | IndexedDB `piverdraw` (v1), magasin `kv` : `library` (liste des tableaux), `board:<id>` (un tableau), `classes` (listes d'élèves), `project` (ancien format, migré) ; `scheduleSave` (1 s après modification), `flushSave` |
| Mes tableaux | bibliothèque : ouvrir, renommer, supprimer, importer |
| Outils de classe | fenêtres flottantes : minuteur (`TM`), tirage au sort + groupes (`DR`, listes `CL`), rideau (`CU`) |
| Démarrage | `resize`, `init()`, et à la toute fin l'exposition de test (§6) |

### Modèle de données

Coordonnées « monde » : 1 unité = 1 px CSS à 100 % de zoom ; page par défaut `frame = {x:0, y:0, w:1600, h:900}` (la page est un cadre, mais on peut écrire au-delà : l'export englobe tous les objets).

```
projet : { name, pages: [page], assets: { <iid>: "data:image/…" } }
page   : { id, bg: 'blank'|'grid'|'lines'|'seyes'|'dots'|'noir', frame: {x,y,w,h}, objects: [objet] }
fichier .json : { app: 'piverdraw', v: 1, name, cur, pages, assets, views }

objet (commun) : { t, id, color, size, … } + facultatifs : rot, gid, locked, clone, href
  stroke   : pts [[x, y, pression]], hl (surligneur), alpha, vp (pression variable), sharp (polygone, pas de lissage)   — ang autorisé
  line / arrow : x1, y1, x2, y2                                — ang autorisé
  rect / ellipse : x1, y1, x2, y2, fill (booléen)             — rot autorisé
  text     : x, y, text, size                                  — rot et href autorisés
  img      : x, y, w, h, iid                                   — rot et href autorisés
```

- `rot` (radians) n'existe que pour rect, ellipse, text, img ; les traits, lignes et flèches sont tournés en réécrivant leurs points, et leur angle cumulé est mémorisé dans `ang` (radians, dans ]-π, π], borné à l'import) qui ne sert pas au dessin : `angOf(o)` donne l'angle de tout objet. Il permet d'afficher l'angle réel, d'orienter le cadre de sélection (`selFrame`, angle commun `selAngle`, sinon cadre droit) et le bouton « 0° » (`#selUnrot`) qui ramène à la position de départ. `rotateObj` met `ang` à jour (`withAng`).
- `gid` : identifiant de groupe (les membres se sélectionnent/déplacent/copient ensemble).
- `locked: true` : ni sélectionnable, ni effaçable, ni touché par « Effacer la page » (`clearPage` : bouton gomme du panneau des pages, et « Tout effacer » dans la barre de la gomme) (les pages de PDF importées sont verrouillées). Bouton « Déverrouiller (N) » dans la barre de l'outil Sélection.
- `clone: true` : « copies illimitées » — glisser l'objet en tire une copie (Alt + glisser déplace l'original). Marqué par un badge ∞.

### Règles d'or (invariants à ne pas casser)

1. **Objets immuables.** On ne modifie jamais un objet en place : on le remplace (`{...o, x1: …}`) dans `page().objects`, toujours dans un `commit(() => …)`. Des caches reposent sur l'identité des objets : `bCache`, `rbCache`, `tbCache` (WeakMap par objet) et `pathCache` (WeakMap par tableau `pts`). Ils sont remis à zéro dans `loadProject` et quand les polices sont chargées.
2. **Un geste utilisateur = un seul pas d'annulation** (`commit` une fois). Les aperçus pendant un geste vivent dans `G` (`G.preview`, `G.extra`, `G.snap`, `G.temp`), jamais dans les données.
3. **Toute nouvelle propriété d'objet doit être nettoyée dans `normalize()`** : un `.json` importé est une entrée non fiable. Les liens ne passent que par `safeHref` (http/https uniquement).
4. **Jamais de `innerHTML` avec du texte de l'utilisateur** (noms d'élèves, nom du tableau, libellés) : `textContent` ou `elt(...)`. Le test t13 vérifie un nom piégé (`<img onerror…>`).
5. **L'attribut `hidden`** est réellement respecté (`[hidden]{display:none!important}`) : `syncAll()` affiche/masque les boutons avec `hidden`.
6. **Rendu unique** : tout ce qui se voit sur la page doit passer par `paintContent` (écran, vignettes, export PNG et PDF) pour que l'export soit identique à l'écran.
7. **Texte français** : apostrophes typographiques `’` dans les chaînes JS entre apostrophes droites (une `'` droite casse la chaîne). Interface en français ; titres/`aria-label` sur tous les boutons-icônes.
8. **Tactile d'abord** : cibles ≥ 34 px (pastilles de couleur : zone de 34 px, disque de 26 px), pas de survol obligatoire (un appui long au doigt sur un bouton affiche son `title`, sans raccourcis clavier, et ne déclenche pas le bouton), `touch-action: none` sur le canvas. Tester à 360 px, 412 px et 1280 px de large, en clair et en sombre (`prefers-color-scheme`, et fond « tableau noir »). Téléphone (≤ 760 px de large) : panneau des pages replié par défaut sur une ligne (`#app.pgmin`), réglages repliables par une poignée (`#app.propmin`, aussi ≤ 500 px de haut), fondu sur le bord de la barre d'outils qui défile (`.more-l` / `.more-r`). Vue « automatique » : `fit()` la marque (`markAuto`) ; elle se réajuste quand la scène change de taille, sauf si l'utilisateur a zoomé ou déplacé la page depuis.
9. **Aucune dépendance réseau** : tout est local (`vendor/`, `fonts/`). N'ajoute pas de CDN ni de police Google ; le test `pwa.test.js` vérifie qu'aucune requête externe n'est émise.
10. **Stockage** : toute lecture/écriture `localStorage` dans `try/catch` (il peut être indisponible). Clés : `piverdraw.eraser`, `piverdraw.laserMs`, `piverdraw.pagesMin`, `piverdraw.propsMin`, `piverdraw.qrOpts`, `piverdraw.snap`, `piverdraw.snapHints`, `piverdraw.timerMs`, `piverdraw.timerSound`.
11. **`saveFile()`** garde son double chemin : `window.claude.use('downloads')` (quand l'appli tournait comme page Claude) sinon lien `<a download>`. Le second suffit hors de Claude ; ne retire pas le premier sans raison.

### Fonctions livrées (pour mémoire)

Stylo (pression), surligneur, gomme « Partie »/« Trait entier », lignes/flèches/rectangles/ellipses (remplissage), texte, pages (+ vignettes), zoom/déplacement, PDF/images en import, export PNG/PDF/.json, fonds (blanc, quadrillé, lignes, Seyès, points, tableau noir), instruments (règle, équerres, rapporteur, compas), mode présentation (stylo, gomme, laser, main, sélection), laser (traits indépendants, durée réglable), QR code (couleurs, transparent, cliquable, libellé), « Mes tableaux » (bibliothèque IndexedDB), outils de classe (minuteur, tirage au sort + groupes, rideau), liens cliquables (Ctrl+K ; exportés en liens dans le PDF), redressement des formes tracées (pointe immobile ou bouton), copies illimitées, écriture manuscrite regroupée (un mot se déplace d’un bloc), rotation (poignée ronde, Maj = pas de 15°, bouton 90°), groupes (Ctrl+G), verrouillage, installation PWA hors ligne.

## 5. Raccourcis (voir aussi le dialogue d'aide `?` dans l'appli)

V sélection · M/Espace main · P stylo · H surligneur · E gomme · L ligne · A flèche · R rectangle · O ellipse · T texte · K laser · Ctrl+Z/Y · Ctrl+C/V/D · Ctrl+G grouper · Ctrl+K lien · Ctrl+A tout sélectionner · Suppr · 0 ajuster · +/− zoom · PgUp/PgDn pages · Ctrl+Entrée nouvelle page · Échap annule un geste en cours (déplacer/redimensionner/pivoter), puis désélectionne / quitte la présentation.

## 6. Tests automatiques (`tests/`)

Playwright + Chromium, sans framework : chaque fichier est un script Node qui affiche des lignes `PASS …` / `FAIL …`. `outils/run_tests.sh` lance trois serveurs, exécute les suites et résume (code de sortie 1 s'il y a un échec inattendu).

- **8765** `serve_test.py` : `site/index.html` avec `window.__PIVERDRAW_TEST__ = true` (sans `pwa.js` ni manifeste). L'application expose alors `window.__piverdraw = { S, page, view, exportRect, renderExport, buildPDF, boundsOf, hitObj, rotateObj, recognizeShape, commit, addObject, requestRender, loadProject, serialize, normalize, TM, DR, CL, CU, CLS }`. Si tu ajoutes une fonction à tester, ajoute-la à la ligne `if (window.__PIVERDRAW_TEST__) …` en bas de `index.html`.
- **8766** : le vrai site à la racine ; **8767** : le vrai site dans un sous-dossier `/piverdraw/` (pour les tests PWA).
- `tests/h.js` : petit utilitaire (ouvre l'appli, `T.add(obj)` ajoute un objet, `T.drag`, `T.click`, `T.world(x,y)` convertit des coordonnées monde en pixels écran, `T.objs()`, `T.st()`).

| Suite | Sujet (approximatif) |
|---|---|
| t1–t5 | prototype : dessin, pages, exports, thème sombre/aide, instruments, QR (premières versions) |
| t6, t7 | QR code : couleurs, transparence, libellé sous le code, import de projet piégé |
| t8, t9 | laser : durée, indépendance des traits |
| t10 | gomme « Partie » / « Trait entier » |
| t11 | « Mes tableaux » : migration, changement, suppression, rechargement |
| t12 | en-tête et boîtes de dialogue en largeur 360–1280 px |
| t13, t14 | outils de classe : minuteur, tirage au sort, groupes, rideau (bureau, mobile, présentation) |
| t15 | liens cliquables (texte, image, PDF exporté avec annotations de lien) |
| t16 | redressement des formes (fonction pure + geste réel + bouton) |
| t17 | copies illimitées (+ outil Sélection en présentation) |
| t18 | rotation (poignée, Maj, aimant 90°, hit-test, export, persistance, import piégé) |
| t19 | groupes et verrouillage |
| t20 | tactile et mobile (barre de sélection à 360/412 px) |
| t22 | liens et édition sur du texte tourné, copier/coller |
| t23 | écriture manuscrite regroupée (mot = un groupe, pause/éloignement/surligneur, annulation, dégrouper, persistance, tactile 360 px) |
| t25 | effacer la page (panneau des pages, verrouillés conservés, annulation), angle mémorisé et bouton 0°, aimant sur l'angle réel, cadre orienté et agrandissement tourné, groupes, persistance, import piégé de `ang`, 360 px |
| t26 | revue d'interface : indicateur « ✓ Enregistré » (phrase complète en bulle), cibles ≥ 34 px, zoom réajusté au redimensionnement sauf zoom choisi, page sous le panneau des réglages, téléphone : fondu de la barre d'outils, pages et réglages repliables (mémorisés), appui long, 740 × 360 |
| t24 | bandeau « nouvelle version » (affichage, Plus tard, Recharger enregistre le tableau, présentation, 360/412 px clair/sombre) |
| pwa | installabilité (erreurs Chromium), hors ligne (rechargement, polices, import PDF, QR), bouton Installer (Chrome, iOS et Safari Mac simulés, déjà installée), sous-dossier, mise à jour du cache et bandeau « nouvelle version » |

Bruit connu, sans gravité (déjà filtré par `run_tests.sh`) : t1 affiche une erreur console `ERR_FAILED` (police externe bloquée), t2 « noir switches to white pen », t8 « gone at 3.2 s » (chronométrage du laser).

Les tests écrivent des captures (`shot-*.png`) et des fichiers temporaires dans `tests/` (ignorés par `.gitignore`) ; regarde les captures pour juger du rendu visuel — un PASS ne prouve pas qu'une interface est belle.

**Quand tu ajoutes une fonction** : écris un test (`tests/tNN.js`, ajoute-le à la liste de `run_tests.sh` et au tableau ci-dessus), couvre au moins : le cas nominal, l'annulation (1 pas), le rechargement/persistance si la donnée est enregistrée, un import piégé si tu ajoutes une propriété, et l'affichage à 360 px.

## 7. Mise en ligne, PWA et hors ligne

- **En ligne : https://pivertice.github.io/piverdraw/** (GitHub Pages, dépôt public `PiVerTICE/piverdraw` de l’organisation GitHub PiVerTICE, la société de Pierre ; novembre 2026). Chaque projet de PiVerTICE a sa propre adresse `pivertice.github.io/<dépôt>/` ; la racine `pivertice.github.io` est réservée à une éventuelle page d’accueil de la société (dépôt `pivertice.github.io`, non créé). Anciennes adresses qui ne fonctionnent plus : `pierreverbiest.github.io/piverdraw/`, puis brièvement `pivertice.github.io/` (même origine que l’adresse actuelle : les tableaux enregistrés y restent visibles). Chaque envoi sur `main` publie `site/` tel quel par `.github/workflows/pages.yml`, qui refuse de publier si `sw.js` n'est pas à jour. Le dépôt étant public : jamais de vrais noms d'élèves ni de secrets dans le code ou les tests.
- Le dossier publié est **`site/`** (HTTPS obligatoire pour l'installation ; l’application fonctionne à la racine ou dans un sous-dossier, comme ici `/piverdraw/`). Attention : toutes les applications de `pivertice.github.io` partagent la même origine, donc le même `localStorage`, la même IndexedDB et les mêmes caches ; d’où les préfixes `piverdraw.` / `piverdraw-` à garder uniques pour chaque projet.
- Auteur des commits : `236827678+pierreverbiest@users.noreply.github.com` (réglé dans `.git/config` du dépôt).
- **Après toute modification d'un fichier de `site/`, lance `python3 outils/bump_sw.py`.** Il recalcule `CACHE = 'piverdraw-<hash>'` et la liste `ASSETS` de `sw.js`. Sans cela les appareils installés ne verront jamais la nouvelle version (le service worker sert le cache en priorité). `run_tests.sh` refuse de tourner si `sw.js` n'est pas à jour.
- Mise à jour côté utilisateur : le navigateur détecte le nouveau `sw.js`, installe le nouveau cache (`skipWaiting`), supprime l'ancien (`clients.claim`) ; la page ouverte garde l'ancien code jusqu'au prochain chargement. C'est pourquoi `pwa.js` écoute `controllerchange` (sauf à la première installation) et envoie l'événement `piverdraw-update` : `index.html` affiche alors le bandeau `#updBar` « Une nouvelle version de PiVerDraw est prête » (bouton Recharger, qui enregistre d'abord le tableau par `flushSave`). `pwa.js` vérifie aussi les mises à jour au retour sur l'application et toutes les heures. Piège : en essayant une nouveauté, s'assurer que la page tourne bien avec le nouveau code (recharger).
- Ajouter un fichier à `site/` (icône, police, bibliothèque) suffit : `bump_sw.py` le met dans la liste de précache. Les fichiers `*-LICENSE.txt` et `LISEZMOI.txt` ne sont volontairement pas mis en cache.
- Bouton « Installer l'application… » (menu Fichier) : Chrome/Edge/Android utilisent l'événement `beforeinstallprompt` ; iPhone/iPad (Safari) n'en ont pas, on affiche donc les étapes « Partager › Sur l'écran d'accueil ». Il est caché si le mode « application » est déjà actif ou si la page n'a pas de manifeste.
- `navigator.storage.persist()` (dans `pwa.js`) demande que « Mes tableaux » ne soit pas purgé. Rappelle à Pierre que les tableaux sont **par appareil et par adresse** ; la voie de transfert est Fichier › Exporter (.json) puis Importer.
- Régénérer les icônes : modifie `icons/icon.svg` (fond `#0b7a75`, tableau clair avec une vague verte et sa tablette), puis exporte en PNG 192/512 (rôle `any`, coins arrondis), 512 plein cadre « maskable » (contenu dans les 80 % centraux) et 180 plein cadre pour `apple-touch-icon.png`.
- Historique : le projet s'appelait d'abord **Ardoise** (commencé sur un autre compte Claude) ; il a été renommé **PiVerDraw** en novembre 2026, y compris les identifiants techniques (`localStorage` `piverdraw.*`, IndexedDB `piverdraw`, cache `piverdraw-…`, fichiers `.piverdraw.json`). Les anciens fichiers `.ardoise.json` s'importent toujours (`normalize` ne vérifie pas le champ `app`) ; les tableaux enregistrés dans le navigateur sous l'ancien nom ne sont pas repris automatiquement : passer par Exporter puis Importer.
- Ardoise avait d'abord été publiée comme **page Claude** (artefact). La version de `site/index.html` n'en diffère que par : polices et bibliothèques locales au lieu de CDN, balises PWA dans l'en-tête, `pwa.js`. Ce n'est plus nécessaire de maintenir la version artefact.

## 8. Pièges rencontrés (à éviter)

- Un `<input>` imbriqué dans un `<button>` : le clic ferme la boîte de dialogue quand le nom contient une espace (renommage dans « Mes tableaux ») → utiliser un `div` puis insérer le champ.
- Ne pas donner le focus automatiquement au champ « nom du tableau » : cela bloque les raccourcis clavier et fait surgir le clavier tactile.
- En-tête qui déborde entre 800 et 1279 px et à 360 px : les libellés sont masqués sous 1280 px ; vérifier chaque nouveau bouton d'en-tête.
- La poignée de rotation passe **sous** la sélection quand l'objet touche le haut de l'écran (voir `rotHandle`).
- `Escape` annule d'abord un geste en cours (`move`/`scale`/`rotate`) avant de désélectionner.
- Tests : démarre les serveurs dans la même commande que le test (ils s'arrêtent entre deux commandes), ne tue jamais avec `pkill -f` depuis la même ligne de commande (cela tue le shell), vérifie la syntaxe du script avant de tester :
  `node -e "const s=require('fs').readFileSync('site/index.html','utf8');new Function([...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n'));console.log('SYNTAXE OK')"`
- Les pages de PDF importées sont des images verrouillées : tout nouvel outil doit respecter `locked`.

## 9. Pistes non réalisées (issues d'une étude ActivInspire, SMART Notebook, Lynx, Gynzy)

À proposer à Pierre, pas à faire d'office :
- projecteur / loupe (masque avec un trou, zoom local) ;
- dés, roue de la chance, horloge, calculatrice ;
- outils de maths : droite graduée, repère orthonormé, grille de fonctions ;
- plans de classe ;
- enregistrement vidéo de la leçon ;
- sauvegarde complète / restauration de toute la bibliothèque (un seul fichier) ;
- synchronisation entre appareils (sans Google Drive) ;
- amélioration : l'édition d'un texte tourné ouvre le champ de saisie non tourné (la rotation est conservée à l'enregistrement).

## 10. Méthode conseillée pour une nouvelle fonction

1. Reformule la demande en une phrase avec Pierre si elle est ambiguë (une seule question).
2. Repère la section concernée (§4) et les invariants (§4, règles d'or).
3. Modifie `site/index.html` par petites éditions ; vérifie la syntaxe (§8).
4. Écris/étends un test, lance `bash outils/run_tests.sh tNN` puis **toute** la suite.
5. Regarde les captures `shot-*.png` (bureau clair/sombre, 360 px).
6. `python3 outils/bump_sw.py`, relance `npm test` (il vérifie que `sw.js` est à jour), publie `site/`.
7. Annonce en une ou deux phrases ce qui a changé, en français.
