/**
 * Algeria Tech — Service Worker v7
 *
 * HTML             → Network First          (toujours frais ; cache = fallback hors-ligne)
 * CSS / JS         → Network First          (toujours frais ; cache = fallback hors-ligne)
 *                    (Cache First supprimé : causait l'affichage de versions périmées
 *                     après déploiement même avec Ctrl+F5 non effectué)
 * Images           → Cache First (80 max)   (instantané + quota limité)
 * JSON / données   → Stale-While-Revalidate (rapide + mise à jour en fond)
 * /api/*           → Réseau seul            (dynamique, jamais mis en cache)
 *
 * Règle fondamentale : HTML, CSS et JS ne sont JAMAIS servis depuis le cache en priorité.
 * Le cache ne sert que de fallback hors-ligne. Cloudflare Edge + ETags (304) assurent
 * la rapidité des requêtes réseau sans contenu périmé.
 */

const CACHE_VERSION = 'algeria-tech-v10';
const CACHE_IMAGES  = 'algeria-tech-images-v1';

// ── Assets locaux pré-cachés (HTML et CDN exclus volontairement) ──────────────
// CDN exclus : le SW ne peut pas les fetch() sans violer le CSP connect-src.
// Le navigateur les charge directement via script-src / style-src (HTTP cache CDN).
const SHELL_ASSETS = [
  '/style.css',
  '/script.js',
  '/images/logo_v2.png',
];

// ── Fichiers de données JSON ──────────────────────────────────────────────────
const DATA_FILES = [
  '/articles-list.json',
  '/articles.json',
  '/veille_data.json',
  '/tic_social.json',
  '/revue_presse.json',
  '/barometre_data.json',
  '/barometre_history.json',
  '/barometre_weekly.json',
  '/barometre_weekly_history.json',
  '/joradp_static.json',
  '/arpce_static.json',
];

// ────────────────────────────────────────────────────────────────────────────────
// INSTALL : mise en cache des assets statiques uniquement
// ────────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Asset non mis en cache :', url, err.message)
          )
        )
      )
    )
  );
});

// ────────────────────────────────────────────────────────────────────────────────
// ACTIVATE : suppression des anciens caches + prise de contrôle
// ────────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== CACHE_IMAGES)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ────────────────────────────────────────────────────────────────────────────────
// FETCH : aiguillage par type de ressource
// ────────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ── 0. Requêtes cross-origin → navigateur seul (CRITIQUE) ─────────────────
  //    Le SW ne doit JAMAIS intercepter les ressources externes (Unsplash, GitHub,
  //    CDN Font Awesome, jsDelivr, placeholder, YouTube…).
  //    Raison : fetch() dans le SW est soumis à connect-src (pas img-src/script-src).
  //    Or connect-src ne liste pas ces domaines → CSP bloque le fetch → 503.
  //    Le navigateur les charge directement avec la bonne directive CSP.
  if (url.origin !== self.location.origin) return;

  // ── 1. API dynamiques → réseau seul (pas de cache) ────────────────────────
  if (url.pathname.startsWith('/api/')) return;

  // ── 2. HTML → Network First ───────────────────────────────────────────────
  //    Toujours récupéré depuis le réseau pour refléter le dernier déploiement.
  //    Le cache ne sert que de fallback si le réseau est indisponible (offline).
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // ── 3. Données JSON → Stale-While-Revalidate ─────────────────────────────
  const isDataFile = DATA_FILES.some(f => url.pathname === f) ||
                     url.pathname.endsWith('.json');
  if (isDataFile) {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_VERSION));
    return;
  }

  // ── 4. Images locales → Cache First avec limite de 80 entrées ────────────
  //    Uniquement /images/* (même origine). Les images externes sont exclues (règle 0).
  if (url.pathname.startsWith('/images/')) {
    event.respondWith(cacheFirstImages(event.request));
    return;
  }

  // ── 5. CSS, JS locaux → Network First ────────────────────────────────────
  //    Toujours récupéré depuis le réseau pour refléter le dernier déploiement.
  //    ETags Cloudflare → 304 Not Modified (~5ms) si inchangé.
  //    Cache = fallback offline uniquement.
  event.respondWith(networkFirst(event.request));
});

// ────────────────────────────────────────────────────────────────────────────────
// STRATÉGIES
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Network First — réseau prioritaire, cache en fallback offline.
 * Utilisé pour le HTML afin de toujours servir la dernière version déployée.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone()); // stocké pour usage offline
    }
    return response;
  } catch {
    // Hors ligne : fallback sur le cache si disponible
    const cached = await cache.match(request);
    return cached || new Response('<h1>Algeria Tech — Hors ligne</h1><p>Vérifiez votre connexion.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/**
 * Cache First — cache prioritaire, réseau si absent.
 * Utilisé pour CSS, JS, fonts : fichiers stables qui ne changent pas souvent.
 */
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
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/**
 * Stale-While-Revalidate — cache immédiat + mise à jour en arrière-plan.
 * Utilisé pour les données JSON : l'utilisateur voit les données existantes
 * instantanément pendant que le cache se rafraîchit en fond.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise;
}

/**
 * Cache First pour images avec limite de 80 entrées maximum.
 * Évite de saturer le stockage du navigateur.
 */
async function cacheFirstImages(request) {
  const cache  = await caches.open(CACHE_IMAGES);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
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
// MESSAGE : commandes depuis l'application
// ────────────────────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
