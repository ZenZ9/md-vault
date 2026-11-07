/* MD Vault service worker: caches the app shell so the editor opens offline.
   Navigations are network-first (new deploys show up), assets are
   stale-while-revalidate. Bump CACHE when you change the shell list. */
var CACHE = 'md-vault-v1';
var SHELL = [
  './',
  './index.html',
  './app.js',
  './markdown.js',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
            return caches.delete(key);
          })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // page loads: try the network first so a new deploy is picked up
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  // assets: answer from cache, refresh in the background
  event.respondWith(
    caches.match(request).then(function (hit) {
      var network = fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE).then(function (cache) {
              cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return hit || new Response('offline', { status: 503, statusText: 'offline' });
        });
      return hit || network;
    })
  );
});
