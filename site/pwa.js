/* PiVerDraw : fonctionnement hors ligne (service worker) et stockage durable des tableaux. */
(function () {
  if (!/^https?:$/.test(location.protocol)) return;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      // Nouvelle version : le nouveau service worker prend le contrôle (skipWaiting + clients.claim) mais la page ouverte
      // garde l'ancien code ; on prévient l'application (index.html), qui propose de recharger.
      // Première installation (aucun contrôleur au chargement) : rien de nouveau, on ne dit rien.
      var hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController) { hadController = true; return; }
        window.__piverdrawUpdate = true;
        try { window.dispatchEvent(new Event('piverdraw-update')); } catch (_) {}
      });
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        // une application installée peut rester ouverte longtemps en classe : on vérifie au retour sur l'application et toutes les heures
        var check = function () { reg.update().catch(function () {}); };
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
        setInterval(check, 3600 * 1000);
      }).catch(function () {});
    });
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) {}   // évite que le navigateur efface « Mes tableaux » en cas de manque de place
})();
