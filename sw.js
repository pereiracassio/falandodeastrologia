/* Avisos no celular (Web Push) do site Falando de Astrologia. Só recebe o aviso e mostra a notificação; não guarda nada em cache.
   Quem manda os avisos é o servidor (api/push.js). */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  /* número no ícone do app (iPhone/iPad com o app instalado, Android): a quantidade de avisos não lidos que o servidor mandou */
  if (typeof d.contagem === 'number' && self.navigator && self.navigator.setAppBadge) { try { self.navigator.setAppBadge(d.contagem); } catch (e) { /* sem suporte */ } }
  event.waitUntil(self.registration.showNotification(d.title || 'Falando de Astrologia', {
    body: d.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { url: d.url || '/' }
  }));
});

/* tocar no aviso abre (ou traz para a frente) a página certa */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var destino = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (janelas) {
    for (var i = 0; i < janelas.length; i++) {
      if (janelas[i].url.indexOf(self.location.origin) === 0 && 'focus' in janelas[i]) {
        return (janelas[i].navigate ? janelas[i].navigate(destino) : Promise.resolve()).then(function () { return janelas[i].focus(); }).catch(function () { return janelas[i].focus(); });
      }
    }
    return self.clients.openWindow(destino);
  }));
});
