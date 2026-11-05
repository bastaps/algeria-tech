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

const CACHE_VERSION = 'algeria-tech-v33';
const CACHE_IMAGES  = 'algeria-tech-images-v1';

// ── Assets locaux pré-cachés (HTML et CDN exclus volontairement) ──────────────
// CDN exclus : le SW ne peut pas les fetch() sans violer le CSP connect-src.
// Le navigateur les charge directement via script-src / style-src (HTTP cache CDN).
const SHELL_ASSETS = [
  '/style.css',
  '/script.js',
  '/images/logo_v2-256.webp',
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

  // ── 0 bis. Navigations vers les routes (/veille, /revue, /article/…) → navigateur seul.
  //    Le SW renvoyait l'accueil au lieu de la page demandée (redirection 308 vers /route/).
  if (event.request.mode === 'navigate' && url.pathname !== '/' && !url.pathname.endsWith('.html')) return;

  // ── 1. API dynamiques → réseau seul (pas de cache) ────────────────────────
  if (url.pathname.startsWith('/api/')) return;

  // ── 2. HTML → Network First ───────────────────────────────────────────────
  //    Toujours récupéré depuis le réseau pour refléter le dernier déploiement.
  //    Le cache ne sert que de fallback si le réseau est indisponible (offline).
  //    Connexion très faible : la copie en cache est servie TOUT DE SUITE et le réseau met à jour pour la visite suivante.
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(swrShell(event));
    return;
  }

  // ── 2 bis. La revue de presse change chaque matin : réseau d'abord, jamais de copie périmée.
  if (url.pathname === '/revue_presse.json') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // ── 2 ter. Listes d'articles : réseau d'abord (revalidé par le navigateur). Une copie périmée servie par le cache
  //    montrait un article corrigé avec son ancienne forme jusqu'à plusieurs rechargements plus tard.
  if (url.pathname === '/articles-list.json' || url.pathname === '/articles.json' || url.pathname.startsWith('/articles/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // ── 2 quater. Libs tierces figées : cache d'abord
  if (url.pathname.startsWith('/libs/')) {
    event.respondWith(cacheFirst(event.request, CACHE_VERSION));
    return;
  }

  // ── 2 quinquies. CSS/JS versionnés (?v=) : cache immédiat + mise à jour en fond (chaque changement change l'URL)
  if (/\.(js|css)$/.test(url.pathname) && url.searchParams.has('v')) {
    event.respondWith(swrShell(event));
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
  const cachedNow = await cache.match(request) ||
                    (request.mode === 'navigate' && new URL(request.url).pathname === '/' ? await cache.match('/') : null);
  // Réseau lent (mobile) : après 3 s on sert la copie en cache si elle existe, sinon on attend le réseau.
  const timeoutMs = cachedNow ? 2000 : 25000;
  for (let essai = 0; essai < 2; essai++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      let response;
      try { response = await fetch(request, { signal: ctrl.signal }); } finally { clearTimeout(t); }
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      if (cachedNow) return cachedNow;
      if (essai === 0) await new Promise(r => setTimeout(r, 800));
    }
  }
  return new Response(
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<h1>Algeria Tech — Hors ligne</h1><p>Vérifiez votre connexion puis <a href="/">réessayez</a>.</p>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Cache immédiat + mise à jour en arrière-plan (le SW reste actif jusqu'à la fin de la mise à jour).
 * Sans copie en cache (1re visite) : réseau avec repli propre.
 */
async function swrShell(event) {
  const request = event.request;
  const cache  = await caches.open(CACHE_VERSION);
  // L'accueil en cache ne remplace QUE l'accueil : une iframe (carte interactive, .html) ne doit jamais recevoir la page d'accueil.
  const isHome = new URL(request.url).pathname === '/';
  const cached = await cache.match(request) ||
                 (request.mode === 'navigate' && isHome ? await cache.match('/') : null);
  if (!cached) return networkFirst(request);
  event.waitUntil(
    fetch(request)
      .then(r => { if (r && r.status === 200 && !r.redirected) return cache.put(request, r.clone()); })
      .catch(() => {})
  );
  return cached;
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
