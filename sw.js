/**
 * Service Worker for XYZ Player (Android PWA & Offline Engine)
 * Handles app shell caching and offline resilience
 */

const CACHE_NAME = 'xyz-player-v2.5.2';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './tracks.js',
  './offlineDb.js',
  './manifest.json',
  './Preview/obsidian.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('Some shell assets could not be cached immediately:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip dynamic API streams from SW cache (IndexedDB handles audio caching)
  if (url.pathname.startsWith('/api/stream') || url.pathname.startsWith('/api/search') || url.pathname.startsWith('/api/info')) {
    return;
  }

  // Cache-first strategy for app shell
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, toCache);
        });
        return response;
      }).catch(() => {
        // Fallback for navigation requests when completely offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
