// Adaptive Reader Service Worker
// Provides offline support and caching for PWA functionality

const CACHE_NAME = 'adaptive-reader-v1';
const OFFLINE_PAGE = '/offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.error('[Service Worker] Failed to cache static assets:', error);
        // Continue even if some assets fail to cache
        return Promise.resolve();
      });
    })
  );
  // Force waiting service worker to become active
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim all clients immediately
  return self.clients.claim();
});

// Fetch event - network-first strategy for most resources, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // For navigation requests (HTML pages)
        if (request.mode === 'navigate') {
          // Try network first
          try {
            const networkResponse = await fetch(request);
            // Cache successful navigation responses
            if (networkResponse.ok) {
              const cache = await caches.open(CACHE_NAME);
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          } catch (error) {
            console.log('[Service Worker] Network request failed, using cache:', request.url);
            // If network fails, try cache
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
              return cachedResponse;
            }
            // If cache also fails, return offline page
            console.log('[Service Worker] Serving offline page');
            return await caches.match(OFFLINE_PAGE);
          }
        }

        // For static assets (images, icons, manifest) - cache first
        if (
          request.destination === 'image' ||
          request.destination === 'font' ||
          request.destination === 'manifest' ||
          url.pathname.startsWith('/icons/')
        ) {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            console.log('[Service Worker] Serving from cache:', request.url);
            return cachedResponse;
          }

          // If not in cache, fetch and cache
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }

        // For Next.js static files and scripts - network first, cache fallback
        if (
          url.pathname.startsWith('/_next/') ||
          request.destination === 'script' ||
          request.destination === 'style'
        ) {
          try {
            const networkResponse = await fetch(request);
            if (networkResponse.ok) {
              const cache = await caches.open(CACHE_NAME);
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          } catch (error) {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
              console.log('[Service Worker] Network failed, using cached asset:', request.url);
              return cachedResponse;
            }
            throw error;
          }
        }

        // For everything else - network first
        const networkResponse = await fetch(request);
        return networkResponse;
      } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);
        // Try to return cached version
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
          return await caches.match(OFFLINE_PAGE);
        }
        // For other requests, let them fail naturally
        throw error;
      }
    })()
  );
});

// Message event - handle commands from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_BOOK') {
    // Cache a book file for offline reading
    const { url } = event.data;
    caches.open(CACHE_NAME).then((cache) => {
      cache.add(url).then(() => {
        console.log('[Service Worker] Cached book for offline reading:', url);
      });
    });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Clear all caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('[Service Worker] All caches cleared');
      event.ports[0].postMessage({ success: true });
    });
  }
});

console.log('[Service Worker] Loaded');
