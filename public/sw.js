const CACHE_NAME = 'we-fart-together-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/audio.js',
  './js/renderer.js',
  './js/client.js',
  './shared/levels.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Let network handle socket.io requests
  if (e.request.url.includes('/socket.io/')) return;
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
