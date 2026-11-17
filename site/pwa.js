/* PiVerDraw : fonctionnement hors ligne (service worker) et stockage durable des tableaux. */
(function () {
  if (!/^https?:$/.test(location.protocol)) return;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) {}   // évite que le navigateur efface « Mes tableaux » en cas de manque de place
})();
