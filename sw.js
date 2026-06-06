/**
 * Algeria Tech — Service Worker
 * Stratégie : App Shell en cache → chargement instantané dès la 2e visite
 *
 * Cache First   → ressources statiques (CSS, JS, images, fonts, icônes)
 * Stale-While-Revalidate → données JSON (articles, veille, revue, social)
 * Network Only  → appels API dynamiques (/api/*)
 */

const CACHE_VERSION = 'algeria-tech-v3';
const CACHE_IMAGES  = 'algeria-tech-images-v1';

// ── App Shell : mis en cache à l'installation ─────────────────────────────────
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/images/logo_v2.png',
  // Font Awesome (icônes)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  // Marked (rendu markdown articles)
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
];

// ── Fichiers de données : servis depuis le cache, mis à jour en arrière-plan ──
const DATA_FILES = [
  '/articles.json',
  '/veille_data.json',
  '/tic_social.json',
  '/revue_presse.json',
];

// ────────────────────────────────────────────────────────────────────────────────
// INSTALL : mise en cache du shell
// ────────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting(); // active immédiatement sans attendre la fermeture des onglets

  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // addAll est atomique : si un seul échoue, on continue quand même
      return Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Shell non mis en cache :', url, err.message)
          )
        )
      );
    })
  );
});

// ────────────────────────────────────────────────────────────────────────────────
// ACTIVATE : suppression des anciens caches
// ────────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== CACHE_IMAGES)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // prend le contrôle des onglets ouverts
  );
});

// ────────────────────────────────────────────────────────────────────────────────
// FETCH : logique de cache par type de ressource
// ────────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ── 1. API dynamiques : toujours réseau (pas de cache) ─────────────────────
  if (url.pathname.startsWith('/api/')) return;

  // ── 2. Données JSON : Stale-While-Revalidate ──────────────────────────────
  //    → affiche la version mise en cache IMMÉDIATEMENT
  //    → met à jour le cache en arrière-plan
  const isDataFile = DATA_FILES.some(f => url.pathname === f) ||
                     url.pathname.endsWith('.json');
  if (isDataFile) {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_VERSION));
    return;
  }

  // ── 3. Images : Cache First avec limite de taille ─────────────────────────
  if (url.pathname.startsWith('/images/') ||
      url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/)) {
    event.respondWith(cacheFirstImages(event.request));
    return;
  }

  // ── 4. Tout le reste (CSS, JS, fonts, HTML) : Cache First ─────────────────
  event.respondWith(cacheFirst(event.request, CACHE_VERSION));
});

// ────────────────────────────────────────────────────────────────────────────────
// STRATÉGIES
// ────────────────────────────────────────────────────────────────────────────────

/** Cache First : sert depuis le cache si disponible, sinon réseau + mise en cache */
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Fallback silencieux si réseau indisponible
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/** Stale-While-Revalidate : sert le cache immédiatement, met à jour en arrière-plan */
async function staleWhileRevalidate(request, cacheName) {
  const cache      = await caches.open(cacheName);
  const cached     = await cache.match(request);

  // Lancement de la mise à jour en arrière-plan (sans await)
  const fetchPromise = fetch(request)
    .then(response => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Si on a un cache → sert immédiatement, update en fond
  // Si pas de cache  → attend le réseau
  return cached || fetchPromise;
}

/** Cache First pour images avec limite de 80 entrées (évite saturation stockage) */
async function cacheFirstImages(request) {
  const cache  = await caches.open(CACHE_IMAGES);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      // Limite à 80 images en cache
      const keys = await cache.keys();
      if (keys.length >= 80) await cache.delete(keys[0]);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// MESSAGE : forcer la mise à jour du cache depuis l'app
// ────────────────────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
