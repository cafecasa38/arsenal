// Service worker: rede primeiro, cache como reserva. Assim o app sempre pega
// a versão nova quando há internet e continua abrindo quando não há.
const CACHE = 'arsenal-v4';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './db.js', './manual.js', './sync.js', './firebase-config.js', './manifest.webmanifest',
  './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Módulos do Firebase (CDN oficial do Google, versão fixa no endereço): cache primeiro,
// para a sincronização carregar mesmo sem internet. Nada mais de fora é interceptado.
const FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method === 'GET' && req.url.startsWith(FIREBASE_CDN)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length) return list[0].focus();
      return self.clients.openWindow('./#/foco');
    })
  );
});
