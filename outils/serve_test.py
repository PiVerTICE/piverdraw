#!/usr/bin/env python3
"""Serveur de test (port 8765 par défaut) : sert site/ tel quel, sauf pour index.html où il
 - ajoute  window.__PIVERDRAW_TEST__ = true  (l'application expose alors window.__piverdraw pour les tests) ;
 - retire pwa.js et le lien vers le manifeste (pas de service worker ni de bouton « Installer » pendant les tests ordinaires).
    python3 outils/serve_test.py [port]
"""
import http.server, os, socketserver, sys

RACINE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=RACINE, **k)
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_GET(self):
        if self.path.split('?')[0] in ('/', '/index.html'):
            html = open(os.path.join(RACINE, 'index.html'), encoding='utf-8').read()
            for retire in ('<script src="pwa.js"></script>', '<link rel="manifest" href="manifest.webmanifest">'):
                assert retire in html, 'index.html a changé : mettre à jour serve_test.py'
                html = html.replace(retire, '')
            html = html.replace('<head>', '<head><script>window.__PIVERDRAW_TEST__=true;</script>', 1)
            data = html.encode('utf-8')
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
        else:
            super().do_GET()

class Serveur(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    with Serveur(('127.0.0.1', PORT), Handler) as s:
        s.serve_forever()
