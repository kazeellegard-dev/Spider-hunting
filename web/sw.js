// Offline cache. Bump VERSION whenever shipped files change.
const VERSION = 'spider-hunting-v26';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/physics.js', 'js/data.js', 'js/stages.js', 'js/meta.js', 'js/i18n.js', 'js/save.js', 'js/platform.js', 'js/audio.js', 'js/render.js', 'js/game.js', 'js/ui.js', 'js/main.js',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// network first so device checks always see the latest push; cache when offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
