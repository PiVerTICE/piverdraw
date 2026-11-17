#!/usr/bin/env bash
# Lance les tests automatiques (Playwright + Chromium) : tous, ou seulement ceux indiqués.
#   bash outils/run_tests.sh                 # tout
#   bash outils/run_tests.sh t16 t17 pwa     # certains tests (t16.js, t17.js, pwa.test.js)
# Prérequis : npm install  puis  npx playwright install chromium   (une seule fois)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
python3 "$ROOT/outils/bump_sw.py" --check || exit 1

mkdir -p "$TMP/sub" && cp -r "$ROOT/site" "$TMP/sub/piverdraw"          # copie modifiable pour le test de mise à jour
python3 "$ROOT/outils/serve_test.py" 8765 & P1=$!                       # 8765 : application en mode test
python3 -m http.server 8766 --directory "$ROOT/site" >/dev/null 2>&1 & P2=$!   # 8766 : site réel (PWA) à la racine
python3 -m http.server 8767 --directory "$TMP/sub" >/dev/null 2>&1 & P3=$!      # 8767 : site réel dans un sous-dossier
trap 'kill $P1 $P2 $P3 2>/dev/null; rm -rf "$TMP"' EXIT
export PIVERDRAW_SUBROOT="$TMP/sub"
sleep 1

cd "$ROOT/tests" || exit 1
if [ $# -gt 0 ]; then LISTE="$*"; else LISTE="t1 t2 t3 t4 t5 t6 t7 t8 t9 t10 t11 t12 t13 t14 t15 t16 t17 t18 t19 t20 t22 t23 t24 t25 t26 pwa"; fi
# Bruit connu, sans gravité : t1 (console ERR_FAILED d'une police), t2 « noir switches to white pen », t8 « gone at 3.2 s » (minuterie du laser)
CONNU='noir switches to white pen|gone at 3\.2 s'
# « timeout » n'existe pas d'office sur macOS : gtimeout (coreutils de Homebrew) ou, à défaut, sans limite de durée
if command -v timeout >/dev/null; then LIMITE="timeout 240"; elif command -v gtimeout >/dev/null; then LIMITE="gtimeout 240"; else LIMITE=""; fi
TOTAL_OK=0; TOTAL_KO=0; GRAVE=0
for t in $LISTE; do
  f="$t.js"; [ "$t" = "pwa" ] && f="pwa.test.js"
  [ -f "$f" ] || { echo "== $t : fichier introuvable"; GRAVE=1; continue; }
  SORTIE="$($LIMITE node "$f" 2>&1)"; CODE=$?
  OK=$(printf '%s\n' "$SORTIE" | grep -o 'PASS ' | wc -l)
  KO_LIGNES=$(printf '%s\n' "$SORTIE" | grep -o 'FAIL [^;]*' | grep -vE "$CONNU")
  KO=$(printf '%s' "$KO_LIGNES" | grep -c . )
  ERR=$(printf '%s\n' "$SORTIE" | grep -E 'pageerror|FATAL|Cannot find module' | head -3)
  TOTAL_OK=$((TOTAL_OK+OK)); TOTAL_KO=$((TOTAL_KO+KO))
  if [ "$KO" -gt 0 ] || [ -n "$ERR" ] || [ "$CODE" -ne 0 ]; then GRAVE=1; echo "== $t : $OK ok, $KO ÉCHEC (code $CODE)"; [ -n "$KO_LIGNES" ] && printf '%s\n' "$KO_LIGNES" | sed 's/^/     /'; [ -n "$ERR" ] && printf '%s\n' "$ERR" | sed 's/^/     /'
  else echo "== $t : $OK ok"; fi
done
echo "---- Total : $TOTAL_OK ok, $TOTAL_KO échec(s) inattendu(s)"
[ "$GRAVE" -ne 0 ] && echo "---- ATTENTION : au moins une suite a échoué ou ne s'est pas exécutée (voir ci-dessus)"
exit $GRAVE
