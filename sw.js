/* Avisos no celular (Web Push) do site Falando de Astrologia. Só recebe o aviso e mostra a notificação; não guarda nada em cache
   (só um contador pequeno dos "fechar" seguidos, ver abaixo). Quem manda os avisos é a função do Supabase. */
/* O iPhone/iPad exige que todo push mostre algo e cancela os avisos do aparelho se vierem 3 pushes seguidos sem notificação.
   O "fechar" (aviso já lido em outro aparelho) fecha a notificação SEM mostrar nada nova; só a cada 3 seguidos mostra uma mínima que some na hora, para o aparelho não ser cancelado. */
function lerSilenciosos() { return caches.open('fda-silenciosos').then(function (c) { return c.match('/n'); }).then(function (r) { return r ? r.text() : '0'; }).then(function (t) { return parseInt(t, 10) || 0; }).catch(function () { return 0; }); }
function gravarSilenciosos(n) { return caches.open('fda-silenciosos').then(function (c) { return c.put('/n', new Response(String(n))); }).catch(function () { /* sem cache */ }); }
function fecharDaqui(tag) { return self.registration.getNotifications({ tag: tag }).then(function (l) { l.forEach(function (n) { n.close(); }); }); }
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  /* número no ícone do app (iPhone/iPad com o app instalado, Android): a quantidade de avisos não lidos que o servidor mandou */
  if (typeof d.contagem === 'number' && self.navigator && self.navigator.setAppBadge) { try { self.navigator.setAppBadge(d.contagem); } catch (e) { /* sem suporte */ } }
  /* aviso que já foi lido em outro aparelho: fecha a notificação daqui sem mostrar nada novo (mostrar uma e fechar fazia o aviso aparecer de novo na hora que você tocava) */
  if (d.fechar) {
    var tagF = 'aviso-' + d.fechar;
    event.waitUntil(fecharDaqui(tagF).then(lerSilenciosos).then(function (n) {
      if (n < 2) return gravarSilenciosos(n + 1);
      return gravarSilenciosos(0).then(function () { return self.registration.showNotification('Avisos', { tag: tagF, silent: true, renotify: false }); }).then(function () { return fecharDaqui(tagF); });
    }));
    return;
  }
  gravarSilenciosos(0);
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
  gravarSilenciosos(0);
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
