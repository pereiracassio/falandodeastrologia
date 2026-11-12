/* Avisos no celular (Web Push) do site Falando de Astrologia. Só recebe o aviso e mostra a notificação; não guarda nada em cache.
   Quem manda os avisos é o servidor (api/push.js). */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  /* número no ícone do app (iPhone/iPad com o app instalado, Android): a quantidade de avisos não lidos que o servidor mandou */
  if (typeof d.contagem === 'number' && self.navigator && self.navigator.setAppBadge) { try { self.navigator.setAppBadge(d.contagem); } catch (e) { /* sem suporte */ } }
  /* aviso que já foi lido em outro aparelho: troca a notificação pela mesma etiqueta e fecha, para sumir daqui também (o iPhone exige que todo push mostre algo, por isso substitui e fecha) */
  if (d.fechar) {
    event.waitUntil(self.registration.showNotification('Falando de Astrologia', { tag: 'aviso-' + d.fechar, silent: true, renotify: false })
      .then(function () { return self.registration.getNotifications({ tag: 'aviso-' + d.fechar }); })
      .then(function (l) { l.forEach(function (n) { n.close(); }); }));
    return;
  }
  event.waitUntil(self.registration.showNotification(d.title || 'Falando de Astrologia', {
    tag: d.id ? 'aviso-' + d.id : undefined,
    body: d.body || '',
    icon: '/favicon.png',
    badge: '/img/aviso-icone.png',   /* o ícone pequeno do aviso no Android precisa ser branco sobre transparente, senão vira um quadrado cinza */
    data: { url: d.url || '/', id: d.id || '' }
  }));
});

/* tocar no aviso abre (ou traz para a frente) a página certa */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var destinoUrl = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  /* tocar no aviso já o marca como lido (a página faz isso ao abrir, e o banco avisa os outros aparelhos para fecharem o deles) */
  if (event.notification.data && event.notification.data.id) destinoUrl.searchParams.set('lido', event.notification.data.id);
  var destino = destinoUrl.href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (janelas) {
    for (var i = 0; i < janelas.length; i++) {
      if (janelas[i].url.indexOf(self.location.origin) === 0 && 'focus' in janelas[i]) {
        /* o app já está aberto: manda o endereço para a própria página abrir (o navigate() do service worker falha no Android e deixava o app na tela errada) */
        janelas[i].postMessage({ fdaAbrir: destino });
        return janelas[i].focus().catch(function () { /* ok */ });
      }
    }
    return self.clients.openWindow(destino);
  }));
});
