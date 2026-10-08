// Network first, so updates show up when online; cached copy when offline.
// Bump the version in version.js on every release; add new files to ASSETS.
importScripts("version.js");
var CACHE = "intervals-" + APP_VERSION;
var ASSETS = ["./", "index.html", "version.js", "style.css", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(e.request, copy); }));
      }
      return res;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); })
  );
});
