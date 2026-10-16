/**
 * EPOKKITA - Progressive Web App (PWA) Service Worker
 * Mendukung instalasi aplikasi standalone di handphone (Android/iOS)
 */

const CACHE_NAME = "epokkita-cache-v3";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/store.js",
  "/js/charts.js",
  "/js/app.js",
  "/manifest.json",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/assets/apple-touch-icon.png",
  "/assets/favicon.png",
  "/assets/favicon-64.png",
  "/assets/logo-circle.png",
  "/assets/avatars/avatar-ayah.png",
  "/assets/avatars/avatar-mama.png",
  "/assets/avatars/avatar-anak-laki.png",
  "/assets/avatars/avatar-anak-perempuan.png"
];

// 1. Install Event: Cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching core assets...");
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn("[Service Worker] Pre-cache partial warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Menghapus cache lama:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network-first for API, Stale-while-revalidate for static files
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Jangan cache request API dan metode non-GET
  if (url.pathname.startsWith("/api/") || event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
