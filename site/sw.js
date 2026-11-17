/* PiVerDraw : service worker. Tout le nécessaire est mis en cache à l'installation : l'application fonctionne ensuite sans connexion.
   Le nom du cache change à chaque nouvelle version des fichiers : l'ancienne version est alors supprimée. */
const CACHE = 'piverdraw-4fb643f68a';
const ASSETS = [
 "./",
 "fonts/bricolage-grotesque-latin-ext-opsz-normal.woff2",
 "fonts/bricolage-grotesque-latin-opsz-normal.woff2",
 "fonts/fonts.css",
 "fonts/ibm-plex-mono-latin-400-normal.woff2",
 "fonts/ibm-plex-mono-latin-500-normal.woff2",
 "fonts/ibm-plex-sans-latin-400-normal.woff2",
 "fonts/ibm-plex-sans-latin-500-normal.woff2",
 "fonts/ibm-plex-sans-latin-600-normal.woff2",
 "fonts/ibm-plex-sans-latin-ext-400-normal.woff2",
 "fonts/ibm-plex-sans-latin-ext-500-normal.woff2",
 "fonts/ibm-plex-sans-latin-ext-600-normal.woff2",
 "icons/apple-touch-icon.png",
 "icons/favicon-32.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "icons/icon.svg",
 "index.html",
 "manifest.webmanifest",
 "pwa.js",
 "vendor/pdfjs/pdf.min.js",
 "vendor/pdfjs/pdf.worker.min.js",
 "vendor/qrcode.js"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('piverdraw-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); }
    catch (err) {
      if (req.mode === 'navigate') { const home = await cache.match('index.html'); if (home) return home; }
      return Response.error();
    }
  })());
});
