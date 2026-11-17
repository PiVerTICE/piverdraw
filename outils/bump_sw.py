#!/usr/bin/env python3
"""Met à jour sw.js (version du cache + liste des fichiers à mettre en cache hors ligne).

À lancer après TOUTE modification d'un fichier de site/ (index.html, icônes, polices…) et avant de mettre en ligne :
sans cela, les appareils déjà installés garderaient l'ancienne version.

    python3 outils/bump_sw.py          # met sw.js à jour
    python3 outils/bump_sw.py --check  # ne modifie rien ; code de sortie 1 si sw.js n'est pas à jour
"""
import hashlib, json, os, re, sys

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
EXCLUS = ('sw.js', 'LISEZMOI.txt')                    # + tous les fichiers *-LICENSE.txt

def fichiers():
    out = []
    for racine, _, fs in os.walk(SITE):
        for f in fs:
            rel = os.path.relpath(os.path.join(racine, f), SITE).replace(os.sep, '/')
            if rel in EXCLUS or rel.endswith('-LICENSE.txt') or f.startswith('.'):
                continue
            out.append(rel)
    return sorted(out)

def main():
    files = fichiers()
    h = hashlib.sha256()
    for rel in files:
        h.update(rel.encode()); h.update(open(os.path.join(SITE, rel), 'rb').read())
    version = h.hexdigest()[:10]
    chemin = os.path.join(SITE, 'sw.js')
    sw = open(chemin, encoding='utf-8').read()
    neuf = re.sub(r"const CACHE = '[^']*';", "const CACHE = 'piverdraw-%s';" % version, sw, count=1)
    neuf = re.sub(r"const ASSETS = \[[\s\S]*?\n\];", lambda m: 'const ASSETS = ' + json.dumps(['./'] + files, indent=1) + ';', neuf, count=1)
    if neuf == sw:
        print('sw.js déjà à jour (version %s, %d fichiers)' % (version, len(files))); return 0
    if '--check' in sys.argv:
        print('sw.js PAS à jour : lancez  python3 outils/bump_sw.py'); return 1
    open(chemin, 'w', encoding='utf-8').write(neuf)
    print('sw.js mis à jour : version %s, %d fichiers' % (version, len(files))); return 0

if __name__ == '__main__':
    sys.exit(main())
