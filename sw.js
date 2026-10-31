// Service worker APP SOLERA — guarda la app en el móvil para que abra sin cobertura
var CACHE = 'solera-v19';
var FICHEROS = ['./', './index.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png',
  './almacen.html', './almacen/', './manifest-almacen.json', './icon-almacen-192.png', './icon-almacen-512.png',
  './lib/zxing-0.21.3.min.js'];   // lector de códigos de barras: dentro de la app para que funcione sin conexión

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHEROS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;                 // las llamadas a la API no se cachean
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // red primero (para coger versiones nuevas), caché si no hay red
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(function (r) {
    var copia = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copia); }); return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('./index.html'); }); }));
});
