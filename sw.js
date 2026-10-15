/* ============================================================
   SERVICE WORKER — Gestionnaire Boutique Téléphone
   Fonctionne 100% hors ligne
   ============================================================ */

const CACHE_NAME = 'bp9-cache-v1.1';
const CACHE_VERSION = '1.1';

/* Fichiers à mettre en cache dès l'installation */
const PRECACHE_URLS = [
  './',
  './gestionnaire-boutique-telephone.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

/* ---------- INSTALLATION ---------- */
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Mise en cache des fichiers essentiels');
        // On utilise addAll mais on tolère les erreurs sur les icônes manquantes
        return Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Impossible de cacher :', url, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATION ---------- */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Suppression ancien cache :', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;

  // Ignorer les requêtes vers d'autres domaines (WhatsApp, etc.)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Stratégie : Cache First pour tout (app 100% locale)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Servir depuis le cache
        return cachedResponse;
      }
      // Sinon, aller sur le réseau
      return fetch(request)
        .then((networkResponse) => {
          // Ne pas mettre en cache les réponses invalides
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          // Mettre en cache la nouvelle ressource
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Hors ligne ET pas dans le cache
          // → Retourner la page principale pour navigation
          if (request.mode === 'navigate') {
            return caches.match('./gestionnaire-boutique-telephone.html');
          }
          // Sinon, réponse vide
          return new Response('', {
            status: 503,
            statusText: 'Service indisponible hors ligne'
          });
        });
    })
  );
});

/* ---------- MESSAGE (mise à jour forcée) ---------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

/* ---------- SYNCHRONISATION EN ARRIÈRE-PLAN (optionnel) ---------- */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Synchronisation en arrière-plan');
    // L'app étant 100% locale, rien à synchroniser
    // Mais on garde le hook pour évolution future
  }
});