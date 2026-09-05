// === ADMIN VISIBILITY CONTROL ===
const ADMIN_CONFIG = {
    unlockKey: 'AT_Admin_2026',
    isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};

// L'admin n'existe QU'EN LOCALHOST. Le site déployé est en lecture seule : les
// écritures sont bloquées côté serveur (403), donc aucun mot de passe n'est requis
// ni stocké dans le client (plus de secret exposé dans le JS).
function isAdminUnlocked() {
    return ADMIN_CONFIG.isLocalhost;
}

// Plus de mot de passe : admin = localhost uniquement.
function unlockAdmin() {
    if (ADMIN_CONFIG.isLocalhost) return true;
    showToast('🔒 Administration disponible uniquement en local');
    return false;
}

// Verrouiller l'admin
function lockAdmin() {
    if (ADMIN_CONFIG.isLocalhost) return;
    localStorage.removeItem(ADMIN_CONFIG.unlockKey);
    updateAdminVisibility();
    showToast('🔒 Mode administrateur désactivé');
}

// Mettre à jour la visibilité des contrôles admin
function updateAdminVisibility() {
    const adminBtn = document.getElementById('adminBtn');
    const unlockHint = document.getElementById('adminUnlockHint');
    
    if (ADMIN_CONFIG.isLocalhost) {
        // Localhost : toujours visible
        if (adminBtn) adminBtn.classList.remove('admin-hidden');
        if (unlockHint) unlockHint.classList.add('admin-hidden');
        return;
    }
    
    // Production : dépend du déverrouillage
    const unlocked = isAdminUnlocked();
    
    if (adminBtn) {
        if (unlocked) {
            adminBtn.classList.remove('admin-hidden');
        } else {
            adminBtn.classList.add('admin-hidden');
        }
    }
    
    if (unlockHint) {
        if (unlocked) {
            unlockHint.classList.remove('admin-hidden');
            unlockHint.classList.add('unlocked');
            unlockHint.innerHTML = '<i class="fas fa-lock-open"></i>';
            unlockHint.title = 'Cliquez pour verrouiller';
        } else {
            unlockHint.classList.remove('admin-hidden', 'unlocked');
            unlockHint.innerHTML = '<i class="fas fa-lock"></i>';
            unlockHint.title = 'Cliquez pour déverrouiller l\'admin';
        }
    }
}

// Initialiser au chargement
window.addEventListener('DOMContentLoaded', () => {
    // Créer le bouton de déverrouillage discret
    if (!ADMIN_CONFIG.isLocalhost && !document.getElementById('adminUnlockHint')) {
        const unlockBtn = document.createElement('div');
        unlockBtn.id = 'adminUnlockHint';
        unlockBtn.className = 'admin-unlock-hint';
        unlockBtn.innerHTML = '<i class="fas fa-lock"></i>';
        unlockBtn.title = 'Cliquez pour déverrouiller l\'admin';
        const _toggleAdmin = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isAdminUnlocked()) { lockAdmin(); } else { unlockAdmin(); }
        };
        unlockBtn.addEventListener('click', _toggleAdmin);
        // touchend requis dans les WebViews Android (onclick seul ne fire pas)
        unlockBtn.addEventListener('touchend', _toggleAdmin, { passive: false });
        document.body.appendChild(unlockBtn);
    }
    
    // Mettre à jour la visibilité
    setTimeout(updateAdminVisibility, 100);
    
    // Raccourci clavier : Ctrl+Shift+A pour déverrouiller
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            if (!isAdminUnlocked()) {
                unlockAdmin();
            }
        }
    });
});

// ===== MENU MOBILE =====
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileMenuOverlay');
    const isOpen = menu.classList.contains('open');
    if (isOpen) {
        menu.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    } else {
        menu.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// ===== CONFIGURATION GLOBALE =====
let allArticles = [];
let breveArticles = []; // articles publiés en "Brèves" (n'apparaissent pas en Une)
const ITEMS_PER_PAGE = 6;
const BREVES_PER_PAGE = 5;
let brevesPage = 1;
let currentPage = 1;
let currentFilter = 'all';
let currentTag = null;
let articleViews = JSON.parse(localStorage.getItem('articleViews') || '{}');
let currentEditingId = null;
// Un article peut vivre dans allArticles (flux principal) ou breveArticles (espace Brèves)
function findArticleById(id) { return allArticles.find(a => a.id == id) || breveArticles.find(a => a.id == id); }

// Après publication/suppression : purge le cache local (localStorage) et le cache du
// Service Worker (stale-while-revalidate sur articles-list.json) pour que le prochain
// chargement voie immédiatement les données à jour au lieu d'une copie périmée.
function invalidateArticlesCache() {
    localStorage.removeItem('at_articles_cache');
    localStorage.removeItem('at_breves_cache');
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
    }
}
let isResetting = false;
let _pendingRoute = null; // route différée si articles pas encore chargés
let _skipPush    = false; // mutex : évite le double-pushState sur popstate
const synth = window.speechSynthesis;
let currentUtterance = null;

// ── TTS Config (Web Speech API — 100% gratuit) ───────────────────
const TTS_CONFIG = {
    rate: 1.0,           // vitesse de lecture (0.5 – 2.0)
    wpm:  160            // mots/min estimés pour le sync visuel
};
let _ttsAudio = null;    // référence globale (stoppable depuis navigation)

function cleanTextForTTS(raw) {
    return raw
        .replace(/<[^>]*>/g, ' ')               // balises HTML
        .replace(/#{1,6} */g, '')                // titres Markdown
        .replace(/[*_~`]+/g, '')                 // gras/italique/code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // liens Markdown → texte seul
        .replace(/[-–—]{2,}/g, ', ')             // tirets longs → pause naturelle
        .replace(/[|\\^<>{}\[\]@]/g, '')         // caractères parasites
        .replace(/\.{2,}/g, '.')                 // points multiples
        .replace(/ {2,}/g, ' ')                  // espaces multiples
        .trim();
}

// ── Population du sélecteur de voix ──────────────────────────────
function populateVoiceSelect() {
    const sel = document.getElementById('voiceSelect');
    if (!sel) return;

    const rank = v => /neural/i.test(v.name)    ? 0
                    : /microsoft/i.test(v.name)  ? 1
                    : /google/i.test(v.name)      ? 2
                    : 3;

    const frVoices = synth.getVoices()
        .filter(v => v.lang.startsWith('fr'))
        .sort((a, b) => rank(a) - rank(b));

    if (!frVoices.length) return;

    sel.innerHTML = frVoices.map(v => {
        const ico   = rank(v) === 0 ? '⭐' : rank(v) === 1 ? '🔵' : rank(v) === 2 ? '🔴' : '🔈';
        const label = v.name
            .replace(/Microsoft\s*/i, '')
            .replace(/\s*Online\s*(Natural)?\s*/i, '')
            .trim()
            .substring(0, 18);
        return `<option value="${v.name}">${ico} ${label}</option>`;
    }).join('');
}

if (synth) {
    synth.addEventListener('voiceschanged', populateVoiceSelect);
    if (synth.getVoices().length) populateVoiceSelect();
}
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const REMOTE_API = 'https://dz-tech-press-api.onrender.com';
const API_BASE = isLocal ? '' : REMOTE_API;
// Auth admin retirée du client : l'admin n'existe qu'en localhost, les écritures
// sont verrouillées côté serveur en production (403). Plus de mot de passe exposé.
// Clé YouTube déplacée côté serveur (proxy /api/youtube) — plus aucune clé dans le client.
const YOUTUBE_CHANNEL_ID = 'UCyIYnT60oAg8iVZKoz8seAA';

// ===== INITIALISATION AU CHARGEMENT =====
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.add('hidden');
    }, 600);
    loadTheme();
    loadArticles();
    updateWeather();
    initCurrencyWidget();
    loadVeille();

    // Ouverture auto de section si retour depuis quick-nav d'une autre page
    const openSection = sessionStorage.getItem('openSection');
    if (openSection) {
        sessionStorage.removeItem('openSection');
        if (openSection === 'veille' && typeof showVeille === 'function') showVeille();
        if (openSection === 'revue'  && typeof showRevue  === 'function') showRevue();
    }
});

const dateSpan = document.getElementById('currentDate');
if (dateSpan) {
    dateSpan.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Horloge temps rÃ©el (Restauration)
const clockEl = document.getElementById('liveClock');
function updateLiveClock() {
    if (clockEl) clockEl.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
updateLiveClock();
setInterval(updateLiveClock, 1000);

// ===== CHARGEMENT DES ARTICLES (statique via articles.json) =====
async function loadArticles() {

    // ── 1. Affichage instantané depuis le cache localStorage ──
    let cachedIds = ''; // mémorise les IDs déjà affichés pour éviter un double-render
    const cached = localStorage.getItem('at_articles_cache');
    if (cached) {
        try {
            allArticles = JSON.parse(cached);
            allArticles.forEach(a => {
                a.views = articleViews[a.id] || Math.floor(Math.random() * 500) + 50;
            });
            // Les Brèves ont leur propre clé de cache (exclues de at_articles_cache) —
            // sans ça, ce rendu instantané les affiche toujours vides.
            try {
                breveArticles = JSON.parse(localStorage.getItem('at_breves_cache') || '[]');
                breveArticles.forEach(a => { a.views = articleViews[a.id] || Math.floor(Math.random() * 500) + 50; });
            } catch (e) { breveArticles = []; }
            cachedIds = allArticles.map(a => a.id).join(',');
            _renderAll(allArticles);
        } catch (e) {
            localStorage.removeItem('at_articles_cache');
        }
    } else {
        const grid = document.getElementById('newsGrid');
        if (grid) grid.innerHTML = '<p style="text-align:center;padding:20px;">Chargement…</p>';
    }

    // ── 2. Fetch de la liste allégée (sans corps d'article) ──
    // articles-list.json ≈ 5× plus léger que articles.json (pas de rawContent).
    // Le corps de chaque article est chargé à la demande à l'ouverture.
    // Fallback vers articles.json si la version légère n'existe pas encore.
    try {
        let res = await fetch('/articles-list.json');
        if (!res.ok) res = await fetch('/articles.json');
        if (!res.ok) throw new Error('liste des articles introuvable');
        const data = await res.json();

        const _mapArt = a => ({
            ...a,
            image: a.image && !a.image.startsWith('http') && !a.image.startsWith('/') ? '/' + a.image : a.image,
            views: articleViews[a.id] || Math.floor(Math.random() * 500) + 50
        });

        allArticles = data
            .filter(a => a.type !== 'communique_officiel' && a.type !== 'breve')  // réservés au Hub Opérateurs / à l'espace Brèves
            .map(_mapArt);

        breveArticles = data
            .filter(a => a.type === 'breve')
            .map(_mapArt);

        // Mise en cache pour la prochaine visite
        localStorage.setItem('at_articles_cache', JSON.stringify(allArticles));
        localStorage.setItem('at_breves_cache', JSON.stringify(breveArticles));

        // Re-render uniquement si la liste d'articles a changé.
        // Évite le double-render quand le SW sert articles.json depuis son cache
        // instantanément : sans ce garde, les deux renders se chevauchent en ~0 ms
        // et l'animation CSS (fadeInUp) se rejoue → effet de vibration visible.
        const newIds = allArticles.map(a => a.id).join(',');
        if (newIds !== cachedIds) _renderAll(allArticles);
        else renderBreves(); // Brèves reste à resynchroniser avec le réseau même si le flux principal est inchangé

    } catch (e) {
        console.error('articles.json indisponible:', e);

        // ── 3. Fallback : API Render (si articles.json absent) ──
        if (allArticles.length === 0) {
            const grid = document.getElementById('newsGrid');
            if (grid) grid.innerHTML = '<div style="text-align:center;padding:20px;color:#d97706;">⚠️ Chargement en cours…</div>';
            try {
                const r = await fetch(`${API_BASE}/api/articles`, { signal: AbortSignal.timeout(15000) });
                if (r.ok) {
                    const files = await r.json();
                    const promises = files.map(async (f) => {
                        try {
                            const ar = await fetch(`${API_BASE}/api/article-content/${f}`, { signal: AbortSignal.timeout(8000) });
                            if (!ar.ok) return null;
                            const txt = await ar.text();
                            const art = parseMarkdownFile(txt);
                            art.id = f.replace('.md', '');
                            if (art.image && !art.image.startsWith('http'))
                                art.image = `https://raw.githubusercontent.com/bastaps/algeria-tech/main/${art.image}`;
                            art.views = articleViews[art.id] || Math.floor(Math.random() * 500) + 50;
                            return art;
                        } catch { return null; }
                    });
                    allArticles = (await Promise.all(promises)).filter(Boolean);
                    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
                    _renderAll(allArticles);
                }
            } catch (e2) {
                if (allArticles.length === 0 && grid)
                    grid.innerHTML = '<p style="text-align:center;padding:20px;">Impossible de charger les articles.</p>';
            }
        }
    }
}

// Render complet (DRY — évite la répétition)
function _renderAll(arts) {
    renderHero(arts);
    renderGrid(arts.slice(0, ITEMS_PER_PAGE));
    renderTicker(arts);
    renderTrending();
    renderBreves();
    renderTags();
    renderPagination(arts);
    initCounters();
    // Routeur : route différée (ex : accès direct /article/42 avant chargement des articles)
    if (_pendingRoute) {
        const r = _pendingRoute; _pendingRoute = null;
        _skipPush = false; applyRoute(r.pathname, r.search, false);
    }
}

// Parser Markdown
function parseMarkdownFile(text) {
    if (typeof marked === 'undefined') return { titre: 'Erreur', contenu: 'Librairie manquante', tags: [], readingTime: 0 };
    const parts = text.split('---');
    if (parts.length < 3) return { titre: 'Erreur', contenu: text, tags: [], readingTime: 0 };
    const fm = parts[1];
    const content = parts.slice(2).join('---');
    const get = (k) => {
        const m = fm.match(new RegExp(`${k}:[ \\t]*(.*)`));
        return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    };
    const tagsMatch = fm.match(/tags:\s*\[(.*)\]/);
    const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/"/g, '')) : [];
    const readingTime = Math.ceil(content.split(/\s+/).length / 200);
    return {
        titre: get('titre'),
        date: get('date'),
        heure: get('heure'),
        categorie: get('categorie'),
        image: get('image'),
        video: get('video'),
        pdf: get('pdf'),
        extrait: get('extrait'),
        contenu: marked.parse(content, { breaks: true, gfm: true }),
        rawContent: content.trim(),
        tags,
        readingTime
    };
}

// ===== CHARGEMENT PARESSEUX DU CORPS D'ARTICLE =====
// La page d'accueil ne charge que la liste légère (sans rawContent). Le corps
// est récupéré à la demande à l'ouverture d'un article, depuis son fichier .md
// statique (léger + mis en cache). Triple sécurité pour ne jamais casser :
//   1) /articles/<id>.md      (statique, fonctionne sur CDN et serveur Node)
//   2) /articles.json complet (mémoïsé, si le .md est indisponible)
//   3) l'extrait              (dégradation ultime)
let _fullArticlesCache = null;
async function ensureRawContent(art) {
    if (!art) return '';
    if (art.rawContent && art.rawContent.length) return art.rawContent;

    // 1) Fichier Markdown statique
    try {
        const r = await fetch(`/articles/${art.id}.md`, { cache: 'force-cache' });
        if (r.ok) {
            const parsed = parseMarkdownFile(await r.text());
            if (parsed.rawContent) {
                art.rawContent = parsed.rawContent;
                if (!art.contenu && parsed.contenu) art.contenu = parsed.contenu;
                return art.rawContent;
            }
        }
    } catch (e) { /* on tente le fallback ci-dessous */ }

    // 2) Fallback : articles.json complet (chargé une seule fois)
    try {
        if (!_fullArticlesCache) {
            const r = await fetch('/articles.json');
            if (r.ok) _fullArticlesCache = await r.json();
        }
        const full = _fullArticlesCache && _fullArticlesCache.find(a => a.id == art.id);
        if (full && full.rawContent) { art.rawContent = full.rawContent; return art.rawContent; }
    } catch (e) { /* dégradation ci-dessous */ }

    // 3) Dégradation : au pire on affiche l'extrait
    return art.rawContent || art.extrait || '';
}

// ===== FONCTIONS D'AFFICHAGE =====
function renderHero(arts) {
    if (!arts || arts.length === 0) return;
    const h = arts[0];
    const s = arts.slice(1, 3);
    const grid = document.getElementById('heroGrid');
    if (!grid || !h) return;
    const getT = (art) => {
        const vMatch = art.video ? art.video.match(/(?:youtu.be\/|youtube.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^&?]{11})/) : null;
        if (vMatch) return `https://img.youtube.com/vi/${vMatch[1]}/hqdefault.jpg`;
        const hasImg = art.image && art.image.trim() !== "" && !art.image.includes('%20%20') && !art.image.endsWith('/') && !art.image.endsWith('  ');
        if (hasImg) return art.image;
    };
    let html = `<div class="hero-main" onclick="openArticle('${h.id}')"><img src="${getT(h)}" alt="${h.titre}" onerror="this.onerror=null;this.style.display='none'">${h.video ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(210,16,52,0.8);color:#fff;width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2rem;z-index:2;pointer-events:none;"><i class="fas fa-play"></i></div>' : ''}<div class="hero-overlay"><div class="hero-meta-wrapper"><span class="category-tag ${cls(h.categorie)}">${h.categorie}</span><span class="hero-meta-tag"><i class="far fa-calendar-alt"></i> ${h.date}</span><span class="hero-meta-tag"><i class="far fa-clock"></i> ${h.heure}</span></div><h2>${h.titre}</h2><p>${h.extrait}</p></div></div><div class="hero-side-card">`;
    s.forEach(a => {
        html += `<div onclick="openArticle('${a.id}')" style="position:relative;"><img src="${getT(a)}" alt="${a.titre}" onerror="this.onerror=null;this.style.display='none'">${a.video ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(210,16,52,0.8);color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;z-index:2;pointer-events:none;"><i class="fas fa-play"></i></div>' : ''}<div class="hero-overlay"><div class="hero-meta-wrapper"><span class="category-tag ${cls(a.categorie)}">${a.categorie}</span><span class="hero-meta-tag"><i class="far fa-calendar-alt"></i> ${a.date}</span><span class="hero-meta-tag"><i class="far fa-clock"></i> ${a.heure}</span></div><h2>${a.titre}</h2></div></div>`;
    });
    html += '</div>';
    grid.innerHTML = html;
    const noHover = window.matchMedia('(hover: none)').matches;
    // Tilt 3D — les 2 cartes latérales uniquement (la Une utilise le parallaxe ci-dessous)
    if (window.VanillaTilt && !noHover) {
        VanillaTilt.init(grid.querySelectorAll('.hero-side-card > div'), {
            max: 8, speed: 400, scale: 1, glare: false, gyroscope: false
        });
    }
    // Parallaxe souris sur la Une : le texte se déplace plus que l'image de fond ("pop out")
    const heroMainEl = grid.querySelector('.hero-main');
    if (heroMainEl && !noHover) {
        const pImg = heroMainEl.querySelector('img');
        const pOverlay = heroMainEl.querySelector('.hero-overlay');
        heroMainEl.addEventListener('mousemove', (e) => {
            const r = heroMainEl.getBoundingClientRect();
            const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
            const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
            if (pImg) pImg.style.transform = `translate(${(nx * 8).toFixed(1)}px, ${(ny * 8).toFixed(1)}px) scale(1.05)`;
            if (pOverlay) pOverlay.style.transform = `translate(${(nx * 22).toFixed(1)}px, ${(ny * 14).toFixed(1)}px)`;
        });
        heroMainEl.addEventListener('mouseleave', () => {
            if (pImg) pImg.style.transform = '';
            if (pOverlay) pOverlay.style.transform = '';
        });
    }
}

function renderGrid(arts) {
    const grid = document.getElementById('newsGrid');
    if (!grid) return;
    if (!arts || arts.length === 0) {
        grid.innerHTML = '<p style="text-align:center; padding:20px;">Aucun rÃ©sultat.</p>';
        return;
    }
    const getT = (art) => {
        const vMatch = art.video ? art.video.match(/(?:youtu.be\/|youtube.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^&?]{11})/) : null;
        if (vMatch) return `https://img.youtube.com/vi/${vMatch[1]}/hqdefault.jpg`;
        const hasImg = art.image && art.image.trim() !== "" && !art.image.includes('%20%20') && !art.image.endsWith('/') && !art.image.endsWith('  ');
        if (hasImg) return art.image;
    };
    grid.innerHTML = arts.map((a, i) => `<div class="news-card" style="animation-delay:${i*0.1}s" onclick="openArticle('${a.id}')">
<div class="news-card-img" style="position:relative;"><img src="${getT(a)}" alt="${a.titre}" onerror="this.onerror=null;this.style.display='none'">${a.video ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(210,16,52,0.8);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;z-index:2;pointer-events:none;"><i class="fas fa-play"></i></div>' : ''}<span class="category-tag ${cls(a.categorie)}">${a.categorie}</span>${window.hasImmersive && window.hasImmersive(a) ? '<span class="at-badge-interactif" title="Cet article a une version interactive"><i class="fas fa-layer-group"></i> Interactif</span>' : ''}</div>
<div class="news-card-body"><h3>${a.titre}</h3><p>${a.extrait}</p>
<div class="card-meta"><span><i class="far fa-calendar"></i> ${a.date}</span><span><i class="far fa-clock"></i> ${a.heure}</span><span><i class="far fa-eye"></i> ${a.views}</span></div></div></div>`).join('');
}

function renderTicker(arts) {
    if (!arts) return;
    const html = arts.map(a => `<span class="ticker-item">${a.titre}</span>`).join('');
    const ticker = document.getElementById('breakingTicker');
    if (ticker) ticker.innerHTML = html + html;
}

// ===== OUVERTURE D'UN ARTICLE =====
window.openArticle = async function(id) {
    const art = findArticleById(id);
    if (!art) return;
    currentEditingId = id;
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        adminBtn.title = "Modifier cet article";
    }
    // Charge le corps de l'article à la demande (liste d'accueil = sans rawContent)
    await ensureRawContent(art);
    // Parse markdown à la demande (lazy) — non fait au chargement initial
    if (!art.contenu && art.rawContent) {
        art.contenu = (typeof marked !== 'undefined')
            ? marked.parse(art.rawContent, { breaks: true, gfm: true })
            : art.rawContent;
        art.readingTime = Math.ceil(art.rawContent.split(/\s+/).length / 200);
    }
    // Slides, infographies et graphiques appartiennent au .html interactif :
    // la page de l'article ne montre que les tableaux.
    art.contenu = filtrerVisuelsArticle(art.contenu, hasImmersive(art));

    art.views++;
    articleViews[id] = art.views;
    localStorage.setItem('articleViews', JSON.stringify(articleViews));
    // ── Routeur : mise à jour de l'URL ──────────────────────────
    if (!_skipPush) {
        history.pushState({ view: 'article', id: String(art.id) }, art.titre, `/article/${art.id}`);
        document.title = art.titre + ' — Algeria Tech';
    }
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('articlePage').style.display = 'block';
    window.scrollTo({top:0, behavior:'smooth'});
    let mediaHeader = '';
    let bodyImage = '';
    let articleVideoId = null;
    if (art.video && art.video.trim() !== "  ") {
        const vId = art.video.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]{11})/)?.[1];
        if (vId) {
            articleVideoId = vId;
            mediaHeader = `<div id="articleVideoAnchor" class="video-anchor"><div class="video-container" id="articleVideoContainer" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#000;margin-bottom:20px;"><iframe src="https://www.youtube-nocookie.com/embed/${vId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div><div id="floatingVideoHeader" class="floating-video-header"><span class="floating-video-title"><i class="fab fa-youtube" style="color:#ff0000;margin-right:6px;"></i>Vidéo</span><button class="floating-video-close" onclick="closeFloatingVideo()" title="Fermer"><i class="fas fa-times"></i></button></div></div>`;
        } else if (/\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i.test(art.video.trim())) {
            // Lien vidéo direct (fichier hébergé hors YouTube) : lecteur HTML5 natif.
            mediaHeader = `<div class="video-anchor"><div class="video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#000;margin-bottom:20px;"><video controls playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;background:#000;" src="${art.video.trim()}"></video></div></div>`;
        }
        if (art.image && art.image.trim() !== "  ") {
            bodyImage = `<img src="${art.image}" alt="${art.titre}" style="max-width:350px; width:100%; float:right; margin:0 0 20px 20px; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">`;
        }
    } else if (art.image && art.image.trim() !== "  ") {
        mediaHeader = `<img src="${art.image}" alt="${art.titre}" onerror="this.onerror=null;this.style.display='none'" style="width:100%; border-radius:15px; margin-bottom:25px;">`;
    }
    let pdfLink = art.pdf ? `<div style="margin: 20px 0; padding: 15px; background: var(--bg-light); border-radius: 10px; display: flex; align-items: center; gap: 15px;"><i class="fas fa-file-pdf" style="font-size: 2rem; color: #D21034;"></i><div><p style="margin:0; font-weight:600;">Document d'accompagnement</p><a href="${art.pdf}" target="_blank" class="tag-filter" style="display:inline-block; margin-top:5px; text-decoration:none;"><i class="fas fa-download"></i> TÃ©lÃ©charger le PDF</a></div></div>` : '';
    const immersiveBtn = hasImmersive(art) ? `<button class="at-immersive-btn" onclick="openImmersiveMode('${art.id}')"><i class="fas fa-layer-group"></i> Version Interactive</button>` : '';
    const retenirBox = buildARetenir(art);
    let html = `${mediaHeader}<div class="article-body"><div class="article-meta"><span class="category-tag ${cls(art.categorie)}">${art.categorie}</span><span><i class="far fa-calendar"></i> ${art.date}</span><span><i class="far fa-clock"></i> ${art.heure}</span><span class="reading-time"><i class="fas fa-book-open"></i> ${art.readingTime} min</span><span><i class="far fa-eye"></i> ${art.views} vues</span><button class="meta-audio-btn" onclick="premiumTogglePlayer()"><i class="fas fa-headphones"></i> Écouter l'article</button><a class="meta-lite-btn" href="/article/${art.id}/lite" title="Version allégée pour connexion lente"><i class="fas fa-bolt"></i> Version légère</a></div><h1>${art.titre}</h1><div class="article-actions">${immersiveBtn}<button class="synthese-btn" id="syntheseBtn" onclick="loadSynthese()"><i class="fas fa-bolt"></i> Synthèse IA</button><button class="debat-btn" id="debatBtn" onclick="openDebat()"><i class="fas fa-comments"></i> Débattre avec l'IA</button></div><div id="syntheseBox"></div>${retenirBox}<div class="article-text">${bodyImage}${art.contenu}${pdfLink}</div>`;
    if (art.tags && art.tags.length) {
        html += `<div style="margin:30px 0;padding-top:20px;border-top:1px solid var(--border)"><strong>Tags: </strong>${art.tags.map(t => `<span class="tag-filter" style="margin-left:8px" onclick="filterByTag('${t}');goHome()">${t}</span>`).join('')}</div>`;
    }
    html += `<div class="share-buttons"><button class="share-btn facebook" onclick="share('facebook')"><i class="fab fa-facebook-f"></i> Facebook</button><button class="share-btn twitter" onclick="share('twitter')"><i class="fab fa-twitter"></i> Twitter</button><button class="share-btn whatsapp" onclick="share('whatsapp')"><i class="fab fa-whatsapp"></i> WhatsApp</button><button class="share-btn linkedin" onclick="share('linkedin')"><i class="fab fa-linkedin-in"></i> LinkedIn</button><button class="share-btn copy" onclick="copyLink()"><i class="fas fa-link"></i> Copier</button></div>`;
    document.getElementById('articleContent').innerHTML = html;
    if (articleVideoId) setupFloatingVideo();
    if (typeof highlightJargon === 'function') highlightJargon();
    initAudioReader(art.titre + ".  " + art.rawContent);
    const rel = allArticles.filter(a => a.id != id && a.categorie === art.categorie).slice(0, 3);
    const relBox = document.getElementById('relatedArticles');
    const relGrid = document.getElementById('relatedGrid');
    if (rel.length > 0 && relBox && relGrid) {
        relBox.style.display = 'block';
        relGrid.innerHTML = rel.map(a => {
            const vMatch = a.video ? a.video.match(/(?:youtu.be\/|youtube.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^&?]{11})/) : null;
            const thumb = vMatch ? `https://img.youtube.com/vi/${vMatch[1]}/hqdefault.jpg` : (a.image || '');
            return `<div class="related-card" onclick="openArticle('${a.id}')"><img src="${thumb}" onerror="this.onerror=null;this.style.display='none'"><h4>${a.titre}</h4></div>`;
        }).join('');
    } else if (relBox) { relBox.style.display = 'none'; }
};

// ===== « À RETENIR » — l'essentiel de l'article en trois points =====
// Utilise le champ "aretenir" de l'en-tête quand il existe (fourni par le
// générateur d'articles interactifs) ; sinon les points sont extraits du texte :
// on ne garde que des phrases telles quelles, jamais de reformulation.
window.buildARetenir = function (art) {
    let points = [];

    if (art.aretenir) {
        points = String(art.aretenir)
            .split(/\s*\|\s*|\s*;;\s*|\n+/)
            .map(p => p.trim())
            .filter(Boolean);
    }

    if (!points.length) {
        const decode = (s) => {
            const d = document.createElement('textarea');
            d.innerHTML = s;
            return d.value;
        };
        const texte = decode(String(art.contenu || art.rawContent || ''))
            .replace(/^---[\s\S]*?---/, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')      // images markdown
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // liens markdown
            .replace(/^#{1,6}\s.*$/gm, ' ')              // intertitres sur leur ligne
            .replace(/[#>*`_|]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const phrases = (texte.match(/[^.!?]+[.!?]/g) || [])
            .map(p => p.trim())
            .filter(p => p.length > 55 && p.length < 260);
        if (phrases.length < 2) return '';

        const notes = phrases.map((p, i) => {
            let score = 0;
            const chiffres = (p.match(/\d/g) || []).length;
            score += Math.min(chiffres, 8) * 1.6;
            if (/\b(%|milliards?|millions?|dinars?|DA|USD|MW|tonnes?)\b/i.test(p)) score += 3;
            if (/\b(20\d{2}|trimestre|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i.test(p)) score += 2;
            if (/\b(annonc|lanc|prévoit|permettra|vise|objectif|décid|sign|approuv)/i.test(p)) score += 2;
            if (i === 0) score += 2.5;
            return { p, score, i };
        });
        points = notes.sort((a, b) => b.score - a.score).slice(0, 3)
                      .sort((a, b) => a.i - b.i).map(n => n.p);
    }

    points = points.slice(0, 4);
    if (points.length < 2) return '';

    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="at-retenir">
        <div class="at-retenir-title"><i class="fas fa-bookmark"></i> À retenir</div>
        <ul>${points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    </div>`;
};

// ===== VISUELS DE DONNÉES : l'article du site ne garde que les tableaux =====
// Smart Ingest PRO fabrique des blocs `.at-data` (chiffres clés, graphiques,
// jauges, anneaux, frises, comparateurs, infographies, citations en exergue).
// Leur place est le fichier .html interactif, pas la page de l'article : ici
// on n'affiche que les tableaux. Le filtrage se fait au rendu, jamais dans le
// fichier .md — les articles déjà publiés sont donc traités eux aussi, et rien
// n'est perdu : la version interactive continue de tout montrer.
const AT_VISUELS_GARDES = ['at-data-table'];

window.filtrerVisuelsArticle = function (html, aUneVersionInteractive) {
    if (!html || html.indexOf('at-data') === -1) return html;
    try {
        const doc = new DOMParser().parseFromString('<div id="at-root">' + html + '</div>', 'text/html');
        const racine = doc.getElementById('at-root');
        const garde = function (n) {
            return AT_VISUELS_GARDES.some(function (c) { return n.classList.contains(c); });
        };

        // Les blocs s'imbriquent : une infographie enveloppe ses chiffres et son
        // graphique, et le markdown mal refermé peut en emboîter d'autres. On ne
        // traite donc que les blocs de premier niveau, une seule fois.
        const sommets = Array.prototype.filter.call(
            racine.querySelectorAll('.at-data'),
            function (n) { return !n.parentElement.closest('.at-data'); });

        let retires = 0;
        sommets.forEach(function (bloc) {
            if (garde(bloc)) return;

            // Un bloc écarté peut contenir un tableau — c'est de la donnée, pas
            // de la décoration : on le remonte au lieu de le perdre.
            const sauves = [];
            bloc.querySelectorAll('.at-data').forEach(function (n) {
                if (garde(n) && !sauves.some(function (x) { return x.contains(n); })) sauves.push(n);
            });
            if (!sauves.length) {
                bloc.querySelectorAll('table').forEach(function (t) { sauves.push(t); });
            }

            if (sauves.length) bloc.replaceWith.apply(bloc, sauves);
            else bloc.remove();
            retires++;
        });

        if (retires && aUneVersionInteractive) {
            const note = doc.createElement('p');
            note.className = 'at-visuels-note';
            note.innerHTML = '<i class="fas fa-chart-pie"></i> ' + retires
                + ' visualisation' + (retires > 1 ? 's' : '') + ' (graphiques, infographies, frises) '
                + (retires > 1 ? 'sont' : 'est') + ' à voir dans la <b>version interactive</b> de cet article.';
            racine.appendChild(note);
        }
        return racine.innerHTML;
    } catch (e) {
        console.warn('Filtrage des visuels impossible :', e);
        return html;
    }
};

// ===== MODE IMMERSIF (version interactive maison d'un article) =====
// La carte vit dans interactifs/<id>.html. C'est un document HTML complet
// (styles + scripts) : il s'affiche dans une iframe et non en innerHTML, sinon
// ses styles déborderaient sur le site et ses scripts ne tourneraient pas.
// Liste de repli pour les articles publiés avant le champ "interactif".
const IMMERSIVE_ARTICLES = ['1785539788809'];

window.hasImmersive = function(art) {
    return !!(art && (art.interactif || IMMERSIVE_ARTICLES.includes(String(art.id))));
};

window.openImmersiveMode = async function(id) {
    const modal = document.getElementById('immersiveModal');
    const body = document.getElementById('immersiveModalBody');
    if (!modal || !body) return;
    body.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Chargement…</div>';
    modal.classList.add('show');
    document.body.classList.add('at-immersive-open');
    document.body.style.overflow = 'hidden';

    const closeBtn = '<button class="modal-close" onclick="closeImmersiveMode()" aria-label="Fermer"><i class="fas fa-times"></i></button>';
    const url = `/interactifs/${id}.html`;
    try {
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) throw new Error('not found');
        body.innerHTML = closeBtn +
            `<iframe src="${url}" title="Version interactive de l'article" ` +
            `style="width:100%;height:100vh;border:0;background:transparent;display:block;" ` +
            `allow="fullscreen; clipboard-write"></iframe>`;
    } catch (e) {
        body.innerHTML = closeBtn +
            '<p style="padding:60px;text-align:center;color:var(--text-muted);">' +
            'Aucune version interactive n’a encore été publiée pour cet article.</p>';
    }
};

window.closeImmersiveMode = function() {
    document.getElementById('immersiveModal')?.classList.remove('show');
    document.body.classList.remove('at-immersive-open');
    document.body.style.overflow = '';
};

// La carte interactive vit dans une iframe : sa croix demande la fermeture ici.
window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'at-close-interactif') closeImmersiveMode();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('immersiveModal')?.classList.contains('show')) {
        closeImmersiveMode();
    }
});

// Interactions internes à la carte immersive (onglets, "J'aime", partage) — déléguées
// car le fragment est injecté dynamiquement via fetch() dans openImmersiveMode().
document.addEventListener('click', (e) => {
    const body = document.getElementById('immersiveModalBody');
    if (!body || !body.contains(e.target)) return;

    const tabBtn = e.target.closest('.tab-btn');
    if (tabBtn) {
        const group = tabBtn.closest('.tabs-interactif');
        const wrapper = group?.parentElement;
        if (!group || !wrapper) return;
        group.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        wrapper.querySelectorAll(':scope > .tab-content').forEach(c => c.classList.remove('active'));
        tabBtn.classList.add('active');
        document.getElementById(tabBtn.dataset.tab)?.classList.add('active');
        return;
    }

    const likeBtn = e.target.closest('#atLikeButton');
    if (likeBtn) {
        const countSpan = document.getElementById('atLikeCount');
        let count = parseInt(countSpan.textContent, 10) || 0;
        const liked = likeBtn.classList.toggle('liked');
        count = liked ? count + 1 : count - 1;
        countSpan.textContent = count;
        likeBtn.innerHTML = `<i class="fas fa-thumbs-up"></i> ${liked ? 'Aimé' : "J'aime"} <span id="atLikeCount">${count}</span>`;
        return;
    }

    if (e.target.closest('.share-icons a')) {
        e.preventDefault();
        showToast('🔗 Partage social — à connecter avec vos APIs.');
    }
});

// ===== FLOATING VIDEO PLAYER =====
// L'iframe reste dans le DOM (position: fixed via CSS) — aucun rechargement, lecture continue.
function setupFloatingVideo() {
    const legacy = document.getElementById('floatingVideoPlayer');
    if (legacy) legacy.remove();
    if (window._floatingVideoScrollHandler) {
        window.removeEventListener('scroll', window._floatingVideoScrollHandler);
        window._floatingVideoScrollHandler = null;
    }
    window._floatingVideoDismissed = false;

    const anchor = document.getElementById('articleVideoAnchor');
    const videoContainer = document.getElementById('articleVideoContainer');
    if (!anchor || !videoContainer) return;

    let floatActivatedAtScrollY = null;

    function checkFloating() {
        if (window._floatingVideoDismissed) return;
        const isFloating = anchor.classList.contains('video-floating');

        if (!isFloating) {
            // Activer : on mesure rect seulement quand PAS en mode flottant (pas d'oscillation)
            if (videoContainer.getBoundingClientRect().bottom < 0) {
                // Réserver la hauteur avant de sortir du flux → évite le saut de layout
                const h = parseFloat(window.getComputedStyle(videoContainer).paddingBottom)
                          || Math.round(videoContainer.offsetWidth * 0.5625)
                          || 200;
                anchor.style.minHeight = h + 'px';
                floatActivatedAtScrollY = window.scrollY;
                anchor.classList.add('video-floating');
            }
        } else {
            // Désactiver : comparer scrollY (rect serait celui de l'élément fixed → fausse valeur)
            if (floatActivatedAtScrollY !== null && window.scrollY < floatActivatedAtScrollY - 40) {
                anchor.classList.remove('video-floating');
                anchor.style.minHeight = '';
                floatActivatedAtScrollY = null;
            }
        }
    }

    window.addEventListener('scroll', checkFloating, { passive: true });
    window._floatingVideoScrollHandler = checkFloating;
}

window.closeFloatingVideo = function() {
    const anchor = document.getElementById('articleVideoAnchor');
    if (anchor) anchor.classList.remove('video-floating');
    window._floatingVideoDismissed = true;
    if (window._floatingVideoScrollHandler) {
        window.removeEventListener('scroll', window._floatingVideoScrollHandler);
        window._floatingVideoScrollHandler = null;
    }
};

// ===== PREMIUM AUDIO PLAYER ENGINE =====
const premiumState = {
    isPlaying: false, isPaused: false, isZen: false, isExpanded: false, isPlayerVisible: false,
    highlightEnabled: true, autoScrollEnabled: true, currentSpeed: 1, currentPitch: 1,
    currentVolume: 1, currentParagraphIndex: 0, spokenWords: 0, totalWords: 0,
    selectedVoice: null, fontSize: 1.12, isMuted: false, previousVolume: 1,
    startTime: null, paragraphs: [], articleTitle: ''
};
let premiumUtterance = null;
let premiumVoices = [];
let premiumKeepAlive = null;

function premiumLoadVoices() {
    premiumVoices = synth.getVoices();
    const sel = document.getElementById('premiumVoiceSelect');
    if (!sel) return;
    sel.innerHTML = '';
    const fr = premiumVoices.filter(v => v.lang.startsWith('fr'));
    const other = premiumVoices.filter(v => !v.lang.startsWith('fr'));
    if (fr.length) {
        const g = document.createElement('optgroup'); g.label = 'Français';
        fr.forEach((v, i) => { const o = document.createElement('option'); o.value = v.name; o.textContent = v.name; if (i === 0) o.selected = true; g.appendChild(o); });
        sel.appendChild(g);
        premiumState.selectedVoice = fr[0];
    } else {
        // Aucune voix française installée (fréquent sur mobile) : ne PAS forcer une voix
        // étrangère (sinon le texte français est lu avec un accent anglais). On laisse le
        // moteur lire en « fr-FR » par défaut. Sur PC ce cas ne se produit pas (voix FR présentes).
        premiumState.selectedVoice = null;
        const o = document.createElement('option'); o.value = ''; o.textContent = 'Voix système (fr-FR)'; o.selected = true;
        sel.appendChild(o);
    }
    if (other.length) {
        const g = document.createElement('optgroup'); g.label = 'Autres';
        other.forEach(v => { const o = document.createElement('option'); o.value = v.name; o.textContent = v.name + ' (' + v.lang + ')'; g.appendChild(o); });
        sel.appendChild(g);
    }
}

function initAudioReader(textToRead) {
    premiumLoadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = premiumLoadVoices;
    // Mobile : la liste des voix arrive souvent en différé → quelques relances (sans effet sur PC)
    setTimeout(premiumLoadVoices, 300);
    setTimeout(premiumLoadVoices, 1200);
    const articleText = document.querySelector('.article-text');
    if (!articleText) return;
    premiumState.paragraphs = Array.from(articleText.querySelectorAll('p, h2, h3, li, blockquote')).filter(el => el.textContent.trim().length > 10);
    premiumState.totalWords = premiumState.paragraphs.reduce((s, el) => s + el.textContent.trim().split(/\s+/).length, 0);
    premiumState.currentParagraphIndex = 0;
    premiumState.spokenWords = 0;
    const title = textToRead ? textToRead.split('.')[0].substring(0, 80) : 'Article';
    premiumState.articleTitle = title;
    const titleEl = document.getElementById('premiumPlayerTitle');
    if (titleEl) titleEl.textContent = title;
    const timeEl = document.getElementById('premiumPlayerTime');
    if (timeEl) { const est = Math.floor(premiumState.totalWords / 3); timeEl.textContent = '0:00 / ' + Math.floor(est/60) + ':' + String(est%60).padStart(2,'0'); }
    window.triggerAudio = () => { premiumTogglePlayPause(); };
}

function premiumTogglePlayer() {
    const bar = document.getElementById('premiumPlayerBar');
    if (!premiumState.isPlayerVisible) {
        premiumState.isPlayerVisible = true;
        bar.classList.add('visible');
        setTimeout(() => premiumStartReading(), 300);
    } else { premiumTogglePlayPause(); }
}
function premiumClosePlayer() {
    premiumStopReading();
    document.getElementById('premiumPlayerBar').classList.remove('visible');
    premiumState.isPlayerVisible = false;
}
function premiumTogglePlayPause() {
    if (!premiumState.isPlayerVisible) { premiumTogglePlayer(); return; }
    if (premiumState.isPlaying && !premiumState.isPaused) premiumPauseReading();
    else if (premiumState.isPaused) premiumResumeReading();
    else premiumStartReading();
}
function premiumStartReading(fromIndex) {
    synth.cancel();
    premiumClearAllHighlights();
    if (fromIndex != null) premiumState.currentParagraphIndex = fromIndex;
    premiumState.isPlaying = true; premiumState.isPaused = false;
    premiumState.startTime = Date.now();
    premiumState.spokenWords = 0;
    for (let i = 0; i < premiumState.currentParagraphIndex; i++) premiumState.spokenWords += premiumState.paragraphs[i].textContent.trim().split(/\s+/).length;
    premiumUpdateUI(); premiumSpeakParagraph(premiumState.currentParagraphIndex);
}
// Choisit la meilleure voix française disponible (fraîchement, car les voix arrivent
// tard sur mobile). Préfère une voix « naturelle » (Google/France) si présente.
// Renvoie null si aucune voix FR → l'utterance reste en lang 'fr-FR' (fallback moteur).
function premiumPickFrenchVoice() {
    const vs = synth.getVoices() || [];
    const fr = vs.filter(v => /^fr/i.test(v.lang || '') || /fran[cç]ais|france/i.test(v.name || ''));
    if (!fr.length) return null;
    return fr.find(v => /google|natural|enhanced|julie|paul|france/i.test(v.name || '')) || fr[0];
}
function premiumSpeakParagraph(idx) {
    if (idx >= premiumState.paragraphs.length) { premiumFinishReading(); return; }
    premiumState.currentParagraphIndex = idx;
    const p = premiumState.paragraphs[idx];
    const text = p.textContent.trim();
    if (!text) { premiumSpeakParagraph(idx + 1); return; }
    premiumWrapWords(p);
    premiumUtterance = new SpeechSynthesisUtterance(text);
    premiumUtterance.rate = premiumState.currentSpeed;
    premiumUtterance.pitch = premiumState.currentPitch;
    premiumUtterance.volume = premiumState.isMuted ? 0 : premiumState.currentVolume;
    premiumUtterance.lang = 'fr-FR';
    // Résolution de la voix AU MOMENT de la lecture (les voix arrivent tard sur mobile)
    const _voice = premiumState.selectedVoice || premiumPickFrenchVoice();
    if (_voice) premiumUtterance.voice = _voice;
    let wIdx = 0;
    premiumUtterance.onboundary = (e) => {
        if (e.name === 'word') { premiumHighlightWord(p, wIdx); wIdx++; premiumState.spokenWords++; premiumUpdateProgress(); }
    };
    premiumUtterance.onend = () => {
        premiumClearParagraphHL(p); premiumState.currentParagraphIndex = idx + 1;
        if (premiumState.isPlaying && !premiumState.isPaused) premiumSpeakParagraph(idx + 1);
    };
    premiumUtterance.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') { premiumState.currentParagraphIndex = idx + 1; premiumSpeakParagraph(idx + 1); }
    };
    if (premiumState.highlightEnabled) p.classList.add('premium-sentence-highlight');
    if (premiumState.autoScrollEnabled) p.scrollIntoView({ behavior: 'smooth', block: 'center' });
    premiumStartKeepAlive();
    synth.speak(premiumUtterance);
}
function premiumWrapWords(el) {
    if (!el.dataset.origHtml) el.dataset.origHtml = el.innerHTML;
    const text = el.textContent; let html = '', last = 0, cnt = 0;
    const rx = /\S+/g; let m;
    while ((m = rx.exec(text)) !== null) {
        if (m.index > last) html += text.substring(last, m.index);
        html += '<span class="pw" data-wi="' + cnt + '">' + m[0] + '</span>';
        last = m.index + m[0].length; cnt++;
    }
    if (last < text.length) html += text.substring(last);
    el.innerHTML = html;
}
function premiumHighlightWord(p, wi) {
    if (!premiumState.highlightEnabled) return;
    p.querySelectorAll('.premium-word-highlight').forEach(e => e.classList.remove('premium-word-highlight'));
    const w = p.querySelector('[data-wi="' + wi + '"]');
    if (w) {
        w.classList.add('premium-word-highlight');
        if (premiumState.autoScrollEnabled) {
            const r = w.getBoundingClientRect();
            if (r.top < 80 || r.bottom > window.innerHeight - 120) w.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}
function premiumClearParagraphHL(p) {
    p.classList.remove('premium-sentence-highlight');
    p.querySelectorAll('.premium-word-highlight').forEach(e => e.classList.remove('premium-word-highlight'));
    if (p.dataset.origHtml) { p.innerHTML = p.dataset.origHtml; delete p.dataset.origHtml; }
}
function premiumClearAllHighlights() { premiumState.paragraphs.forEach(p => premiumClearParagraphHL(p)); }
function premiumPauseReading() { synth.pause(); premiumState.isPaused = true; premiumUpdateUI(); }
function premiumResumeReading() { synth.resume(); premiumState.isPaused = false; premiumUpdateUI(); }
function premiumStopReading() {
    synth.cancel(); clearInterval(premiumKeepAlive);
    premiumState.isPlaying = false; premiumState.isPaused = false;
    premiumState.currentParagraphIndex = 0; premiumState.spokenWords = 0;
    premiumClearAllHighlights(); premiumUpdateUI(); premiumUpdateProgress();
}
function premiumFinishReading() {
    premiumState.isPlaying = false; premiumState.isPaused = false;
    premiumState.currentParagraphIndex = 0; premiumState.spokenWords = 0;
    premiumClearAllHighlights(); premiumUpdateUI(); premiumUpdateProgress();
    premiumShowToast('Lecture terminée');
}
function premiumSkipParagraph(dir) {
    const ni = premiumState.currentParagraphIndex + dir;
    if (ni < 0 || ni >= premiumState.paragraphs.length) return;
    synth.cancel(); premiumClearAllHighlights();
    premiumState.spokenWords = 0;
    for (let i = 0; i < ni; i++) premiumState.spokenWords += premiumState.paragraphs[i].textContent.trim().split(/\s+/).length;
    premiumState.currentParagraphIndex = ni;
    if (premiumState.isPlaying) premiumSpeakParagraph(ni);
}
function premiumSeekTo(e) {
    const bar = document.getElementById('premiumProgressBar');
    const pct = (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth;
    const target = Math.floor(pct * premiumState.totalWords);
    let wc = 0;
    for (let i = 0; i < premiumState.paragraphs.length; i++) {
        const pw = premiumState.paragraphs[i].textContent.trim().split(/\s+/).length;
        if (wc + pw >= target) { synth.cancel(); premiumClearAllHighlights(); premiumState.spokenWords = wc; premiumState.currentParagraphIndex = i; if (premiumState.isPlaying) premiumSpeakParagraph(i); break; }
        wc += pw;
    }
}
function premiumSetSpeed(s) {
    premiumState.currentSpeed = s;
    document.querySelectorAll('.premium-speed-btn').forEach(b => b.classList.toggle('active', b.textContent.trim() === s + '×'));
    if (premiumState.isPlaying) { const ci = premiumState.currentParagraphIndex; synth.cancel(); premiumClearAllHighlights(); premiumSpeakParagraph(ci); }
    premiumShowToast('Vitesse : ' + s + '×');
}
function premiumChangeVoice() {
    const sel = document.getElementById('premiumVoiceSelect');
    premiumState.selectedVoice = premiumVoices.find(v => v.name === sel.value) || null;
    if (premiumState.isPlaying) { const ci = premiumState.currentParagraphIndex; synth.cancel(); premiumClearAllHighlights(); premiumSpeakParagraph(ci); }
}
function premiumChangePitch(v) {
    premiumState.currentPitch = parseFloat(v);
    document.getElementById('premiumPitchValue').textContent = parseFloat(v).toFixed(1);
    if (premiumState.isPlaying) { const ci = premiumState.currentParagraphIndex; synth.cancel(); premiumClearAllHighlights(); premiumSpeakParagraph(ci); }
}
function premiumChangeVolume(v) {
    premiumState.currentVolume = parseFloat(v); premiumState.isMuted = v == 0;
    document.getElementById('premiumVolumeValue').textContent = Math.round(v * 100) + '%';
}
function premiumToggleHighlight() {
    premiumState.highlightEnabled = !premiumState.highlightEnabled;
    document.getElementById('premiumHighlightToggle').classList.toggle('active', premiumState.highlightEnabled);
    if (!premiumState.highlightEnabled) premiumClearAllHighlights();
    premiumShowToast(premiumState.highlightEnabled ? 'Suivi activé' : 'Suivi désactivé');
}
function premiumToggleAutoScroll() {
    premiumState.autoScrollEnabled = !premiumState.autoScrollEnabled;
    document.getElementById('premiumAutoScrollToggle').classList.toggle('active', premiumState.autoScrollEnabled);
}
function premiumToggleZen() {
    premiumState.isZen = !premiumState.isZen;
    document.body.classList.toggle('premium-zen-mode', premiumState.isZen);
    const fb = document.getElementById('zenToggleFloat');
    if (fb) fb.classList.toggle('active', premiumState.isZen);
    premiumShowToast(premiumState.isZen ? 'Mode Zen' : 'Mode classique');
}
function premiumToggleExpand() {
    premiumState.isExpanded = !premiumState.isExpanded;
    document.getElementById('premiumPlayerBar').classList.toggle('expanded', premiumState.isExpanded);
}
function premiumChangeFontSize(dir) {
    premiumState.fontSize = Math.max(0.85, Math.min(1.6, premiumState.fontSize + dir * 0.08));
    const at = document.querySelector('.article-text');
    if (at) at.style.fontSize = premiumState.fontSize + 'rem';
    premiumShowToast('Taille : ' + Math.round(premiumState.fontSize / 1.12 * 100) + '%');
}
function premiumToggleMute() {
    if (premiumState.isMuted) { premiumState.isMuted = false; premiumState.currentVolume = premiumState.previousVolume || 1; }
    else { premiumState.previousVolume = premiumState.currentVolume; premiumState.isMuted = true; premiumState.currentVolume = 0; }
    document.getElementById('premiumVolumeSlider').value = premiumState.currentVolume;
    document.getElementById('premiumVolumeValue').textContent = Math.round(premiumState.currentVolume * 100) + '%';
    premiumShowToast(premiumState.isMuted ? 'Son coupé' : 'Son activé');
}
function premiumUpdateUI() {
    const pi = document.getElementById('premiumPlayIcon'), pa = document.getElementById('premiumPauseIcon');
    const sd = document.getElementById('premiumStatusDot'), st = document.getElementById('premiumStatusText');
    const viz = document.getElementById('premiumVisualizer');
    if (premiumState.isPlaying && !premiumState.isPaused) {
        if (pi) pi.style.display = 'none'; if (pa) pa.style.display = 'inline';
        if (sd) sd.classList.add('active'); if (st) st.textContent = 'En lecture…';
        if (viz) viz.classList.add('active');
    } else if (premiumState.isPaused) {
        if (pi) pi.style.display = 'inline'; if (pa) pa.style.display = 'none';
        if (sd) sd.classList.remove('active'); if (st) st.textContent = 'En pause';
        if (viz) viz.classList.remove('active');
    } else {
        if (pi) pi.style.display = 'inline'; if (pa) pa.style.display = 'none';
        if (sd) sd.classList.remove('active'); if (st) st.textContent = 'Prêt';
        if (viz) viz.classList.remove('active');
    }
}
function premiumUpdateProgress() {
    const pct = premiumState.totalWords > 0 ? (premiumState.spokenWords / premiumState.totalWords) * 100 : 0;
    const fill = document.getElementById('premiumProgressFill');
    if (fill) fill.style.width = Math.min(pct, 100) + '%';
    const elapsed = premiumState.startTime ? Math.floor((Date.now() - premiumState.startTime) / 1000) : 0;
    const est = Math.floor(premiumState.totalWords / (premiumState.currentSpeed * 3));
    const fmt = s => Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
    const te = document.getElementById('premiumPlayerTime');
    if (te) te.textContent = fmt(elapsed) + ' / ' + fmt(est);
}
function premiumShowToast(msg) {
    const t = document.getElementById('premiumToast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._to); t._to = setTimeout(() => t.classList.remove('show'), 2500);
}
function premiumStartKeepAlive() {
    clearInterval(premiumKeepAlive);
    premiumKeepAlive = setInterval(() => { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); } }, 10000);
}

// Reading progress bar + floating controls on scroll
window.addEventListener('scroll', () => {
    const dh = document.documentElement.scrollHeight - window.innerHeight;
    const pct = dh > 0 ? (window.scrollY / dh) * 100 : 0;
    const rp = document.getElementById('premiumReadingProgress');
    if (rp) rp.style.width = pct + '%';
    const fc = document.getElementById('premiumFloatingControls');
    if (fc) fc.classList.toggle('visible', window.scrollY > 400);
});

// Keyboard shortcuts for premium player
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (!premiumState.isPlayerVisible && e.code !== 'Space') return;
    switch (e.code) {
        case 'Space': if (document.getElementById('articlePage')?.style.display !== 'none') { e.preventDefault(); premiumTogglePlayPause(); } break;
        case 'ArrowRight': e.preventDefault(); premiumSkipParagraph(1); break;
        case 'ArrowLeft': e.preventDefault(); premiumSkipParagraph(-1); break;
        case 'KeyZ': premiumToggleZen(); break;
        case 'KeyM': premiumToggleMute(); break;
        case 'Equal': case 'NumpadAdd': e.preventDefault(); premiumSetSpeed(Math.min(2, premiumState.currentSpeed + 0.25)); break;
        case 'Minus': case 'NumpadSubtract': e.preventDefault(); premiumSetSpeed(Math.max(0.5, premiumState.currentSpeed - 0.25)); break;
        case 'Escape': if (premiumState.isExpanded) premiumToggleExpand(); break;
    }
});

// ── Stop global (Web Speech) ─────────────────────────────────────
function stopAllAudio() {
    premiumStopReading();
    premiumClosePlayer();
}

// ===== RETOUR ACCUEIL =====
window.goHome = function() {
    stopAllAudio();
    if (typeof resetJargon === 'function') resetJargon();
    if (typeof resetDebat  === 'function') resetDebat();
    currentEditingId = null;
    currentFilter = 'all';
    currentPage = 1;
    // RÃ©initialiser la navigation active
    document.querySelectorAll('.main-nav a').forEach(a => {
        a.classList.toggle('active', a.innerText.trim() === 'Accueil');
    });
    const searchInput = document.getElementById('searchInput');
    if(searchInput) { isResetting = true; searchInput.value = ''; isResetting = false; }
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) adminBtn.innerHTML = '<i class="fas fa-plus"></i>';
    // ── Routeur ──────────────────────────────────────────────────
    if (!_skipPush) {
        history.replaceState({ view: 'home' }, '', '/');
        document.title = "Algeria Tech - L'actualité numérique en Algérie par Basta";
    }
    closeFloatingVideo();
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('articlePage').style.display = 'none';
    document.getElementById('veilleSection').style.display = 'none';
    document.getElementById('revueSection').style.display = 'none';
    const _compSec = document.getElementById('comparateurSection');
    if (_compSec) _compSec.style.display = 'none';
    const _regSec  = document.getElementById('reglementaireSection');
    if (_regSec)  _regSec.style.display  = 'none';
    document.getElementById('heroSection').classList.remove('hidden');
    renderGrid(allArticles.slice(0, ITEMS_PER_PAGE));
    renderPagination(allArticles);
    window.scrollTo({top: 0, behavior: 'smooth'});
};

// ===== NAVIGATION VEILLE =====
window.showVeille = function() {
    stopAllAudio();
    if (!_skipPush) {
        history.pushState({ view: 'veille' }, 'Veille — Algeria Tech', '/veille');
        document.title = 'Veille — Algeria Tech';
    }
    currentFilter = 'all';
    currentPage = 1;
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('articlePage').style.display = 'none';
    document.getElementById('revueSection').style.display = 'none';
    const _cSecV = document.getElementById('comparateurSection');
    if (_cSecV) _cSecV.style.display = 'none';
    const _rSecV = document.getElementById('reglementaireSection');
    if (_rSecV) _rSecV.style.display = 'none';
    document.getElementById('veilleSection').style.display = 'block';
    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-veille').classList.add('active');
    loadVeille();
    window.scrollTo({top: 0, behavior: 'smooth'});
};

// ===== NAVIGATION REVUE DE PRESSE =====
window.showRevue = function() {
    stopAllAudio();
    if (!_skipPush) {
        history.pushState({ view: 'revue' }, 'Revue de Presse — Algeria Tech', '/revue');
        document.title = 'Revue de Presse — Algeria Tech';
    }
    currentFilter = 'all';
    currentPage = 1;
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('articlePage').style.display = 'none';
    document.getElementById('veilleSection').style.display = 'none';
    const _cSecR = document.getElementById('comparateurSection');
    if (_cSecR) _cSecR.style.display = 'none';
    const _rSecR = document.getElementById('reglementaireSection');
    if (_rSecR) _rSecR.style.display = 'none';
    document.getElementById('revueSection').style.display = 'block';
    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));
    const navRevue = document.getElementById('nav-revue');
    if(navRevue) navRevue.classList.add('active');
    loadRevue();
    window.scrollTo({top: 0, behavior: 'smooth'});
};

// ═══════════════════════════════════════════════════════════════════════
// VEILLE RÉGLEMENTAIRE — Journal Officiel Algérien (JORADP)
// ═══════════════════════════════════════════════════════════════════════

/* Couleurs par type de texte réglementaire */
const REG_TYPE_STYLES = {
  /* ── JORADP ───────────────────────────────────────── */
  'Loi':                    { color:'#1565C0', bg:'#e8f0fb', icon:'fa-landmark' },
  'Décret présidentiel':    { color:'#6A1B9A', bg:'#f3e5f5', icon:'fa-crown' },
  'Décret exécutif':        { color:'#0277BD', bg:'#e1f5fe', icon:'fa-gavel' },
  'Arrêté':                 { color:'#2E7D32', bg:'#e8f5e9', icon:'fa-file-signature' },
  /* ── ARPCE ────────────────────────────────────────── */
  "Appel d'offres":         { color:'#E65100', bg:'#fff3e0', icon:'fa-handshake' },
  'Communiqué':             { color:'#1B5E20', bg:'#e8f5e9', icon:'fa-bullhorn' },
  'Consultation publique':  { color:'#4A148C', bg:'#f3e5f5', icon:'fa-comments' },
  'Rapport':                { color:'#BF360C', bg:'#fbe9e7', icon:'fa-chart-bar' },
  'Avis':                   { color:'#01579B', bg:'#e1f5fe', icon:'fa-info-circle' },
  'Programme':              { color:'#33691E', bg:'#f1f8e9', icon:'fa-project-diagram' },
  'Publication ARPCE':      { color:'#006064', bg:'#e0f7fa', icon:'fa-newspaper' },
  'Décision':             { color:'#E65100', bg:'#fff3e0', icon:'fa-balance-scale' },
  'Circulaire':           { color:'#5D4037', bg:'#efebe9', icon:'fa-scroll' },
  'Instruction':          { color:'#37474F', bg:'#eceff1', icon:'fa-clipboard-list' },
  'Avis':                 { color:'#558B2F', bg:'#f1f8e9', icon:'fa-bullhorn' },
};
const REG_DEFAULT_STYLE = { color:'#455A64', bg:'#eceff1', icon:'fa-file-alt' };

function _regStyle(type) {
  return REG_TYPE_STYLES[type] || REG_DEFAULT_STYLE;
}

function _regCard(t) {
  const s       = _regStyle(t.type);
  const isArpce = t.source === 'ARPCE';

  /* Badge source */
  const srcBadge = isArpce
    ? `<span class="reg-src-badge reg-src-arpce"><img src="/images/arpce-logo-mini.png" onerror="this.style.display='none'" style="height:12px;margin-right:3px;vertical-align:middle">ARPCE</span>`
    : `<span class="reg-src-badge reg-src-joradp"><i class="fas fa-book-open"></i> JORADP</span>`;

  /* Badge numéro JO ou date */
  const refBadge = isArpce
    ? (t.jo_date_fr ? `<span class="reg-jo-badge"><i class="fas fa-calendar-alt"></i> ${t.jo_date_fr}</span>` : '')
    : `<span class="reg-jo-badge"><i class="fas fa-book-open"></i> JO N°${t.jo_numero} · ${t.jo_date_fr}</span>`;

  /* Lien et libellé bouton */
  const link      = isArpce ? t.url : (t.page_jo ? `${t.jo_url}#page=${t.page_jo}` : t.jo_url);
  const btnLabel  = isArpce ? 'Lire la publication' : 'Consulter le JO';
  const footLabel = isArpce
    ? `<span class="reg-page-info"><i class="fas fa-external-link-alt"></i> arpce.dz</span>`
    : `<span class="reg-page-info"><i class="fas fa-file-pdf"></i> ${t.page_jo ? `Page ${t.page_jo}` : 'Voir le JO'}</span>`;

  /* Texte de pertinence / description */
  const pertText = t.pertinence || t.description || '';

    const _st = [t.titre, t.numero||'', pertText].join(' ').toLowerCase().replace(/"/g,'');
  return `<div class="reg-card" data-source="${isArpce ? 'ARPCE' : 'JORADP'}" data-search="${_st}" style="--rc:${s.color};--rl:${s.bg}">
    <div class="reg-card-head">
      <span class="reg-type-badge"><i class="fas ${s.icon}"></i> ${t.type}</span>
      <div class="reg-card-head-right">${srcBadge}${refBadge}</div>
    </div>
    <div class="reg-card-body">
      <p class="reg-numero">${t.numero ? `N° ${t.numero}` : ''}${(!isArpce && t.date_texte) ? ` — ${t.date_texte}` : ''}</p>
      <h3 class="reg-titre">${t.titre}</h3>
      ${pertText ? `<p class="reg-pertinence"><i class="fas fa-lightbulb"></i> ${pertText}</p>` : ''}
    </div>
    <div class="reg-card-foot">
      ${footLabel}
      <a href="${link}" target="_blank" rel="noopener" class="reg-link" style="background:${s.color}">
        <i class="fas fa-external-link-alt"></i> ${btnLabel}
      </a>
    </div>
  </div>`;
}

function _regEmpty() {
  return `<div class="reg-empty">
    <i class="fas fa-gavel"></i>
    <p>Aucun texte réglementaire TIC trouvé pour le moment.</p>
    <p class="reg-empty-hint">La vérification du Journal Officiel se fait automatiquement chaque jour à 9h.</p>
  </div>`;
}

function _regLastChecked(iso) {
  if (!iso) return '';
  const d   = new Date(iso);
  const now = new Date();
  const diff = Math.round((now - d) / 60000); // minutes
  const label = diff < 60 ? `il y a ${diff} min`
              : diff < 1440 ? `il y a ${Math.round(diff / 60)}h`
              : `le ${d.toLocaleDateString('fr-DZ')}`;
  return `<span class="reg-last-check"><i class="fas fa-sync-alt"></i> Dernière vérification : ${label}</span>`;
}

async function _loadRegData() {
  const box = document.getElementById('regResults');
  if (!box) return;
  box.innerHTML = `<div class="reg-loading"><i class="fas fa-circle-notch fa-spin"></i> Chargement des textes réglementaires…</div>`;

  /* Essaie l'API locale, se replie sur le fichier statique (Cloudflare Pages) */
  async function _regFetch(apiUrl, staticUrl) {
    try {
      const r = await fetch(apiUrl);
      if (r.ok) return await r.json();
    } catch {}
    try {
      const r = await fetch(staticUrl);
      if (r.ok) return await r.json();
    } catch {}
    return null;
  }

  try {
    /* Charger JORADP et ARPCE en parallèle */
    const [joradpRes, arpceRes] = await Promise.allSettled([
      _regFetch('/api/joradp', '/joradp_static.json'),
      _regFetch('/api/arpce',  '/arpce_static.json'),
    ]);

    const joradpData  = joradpRes.status  === 'fulfilled' && joradpRes.value  ? joradpRes.value  : { textes: [], lastChecked: null };
    const arpceData   = arpceRes.status   === 'fulfilled' && arpceRes.value   ? arpceRes.value   : { items:  [], lastChecked: null };

    /* Fusionner : ARPCE items + JORADP textes → format unifié, triés par date desc */
    const joradpItems = (joradpData.textes || []).map(t => ({ ...t, source: t.source || 'JORADP' }));
    const arpceItems  = (arpceData.items   || []).map(t => ({ ...t, source: 'ARPCE' }));

    const allItems = [...arpceItems, ...joradpItems].sort((a, b) => {
      const da = a.jo_date || a.date || '0';
      const db = b.jo_date || b.date || '0';
      return db.localeCompare(da);
    });

    const section = document.getElementById('reglementaireSection');

    /* Mettre à jour le compteur */
    const counter = section?.querySelector('.reg-count');
    if (counter) {
      const n = allItems.length;
      const nA = arpceItems.length, nJ = joradpItems.length;
      counter.textContent = n
        ? `${n} publication${n > 1 ? 's' : ''} — ${nA} ARPCE · ${nJ} JO`
        : 'Aucune publication trouvée';
    }

    /* Dernière vérification (la plus récente des deux) */
    const lastChk = section?.querySelector('.reg-last-check');
    const latestCheck = [joradpData.lastChecked, arpceData.lastChecked]
      .filter(Boolean).sort().pop();
    if (lastChk) lastChk.outerHTML = _regLastChecked(latestCheck);

    /* Appliquer le filtre courant */
    window._regAllItems = allItems;
    _applyRegFilter(_regCurrentFilter, _regCurrentSource);

    box.innerHTML = allItems.length
      ? `<div class="reg-grid" id="regGrid">${allItems.map(_regCard).join('')}</div>`
      : _regEmpty();
  } catch (e) {
    if (box) box.innerHTML = `<div class="reg-error"><i class="fas fa-exclamation-triangle"></i> Impossible de charger les données (serveur requis).</div>`;
  }
}

/* Filtre type + source ────────────────────────────────────────── */
let _regCurrentSource = 'all';
let _regCurrentSearch = '';

function _applyRegFilter(type, source) {
  const cards = document.querySelectorAll('.reg-card');
  cards.forEach(card => {
    const badge  = card.querySelector('.reg-type-badge')?.textContent || '';
    const src    = card.dataset.source || '';
    const showT  = type   === 'all' || badge.includes(type);
    const showS  = source === 'all' || src === source;
    const q = _regCurrentSearch.trim().toLowerCase();
    const showQ  = !q || (card.dataset.search || '').includes(q);
    card.style.display = (showT && showS && showQ) ? '' : 'none';
  });
}

function _buildRegHTML() {
  return `<div class="reg-wrap">

    <!-- Hero -->
    <div class="reg-hero">
      <div class="reg-hero-icon"><i class="fas fa-gavel"></i></div>
      <h1 class="reg-hero-title">Veille Réglementaire TIC</h1>
      <p class="reg-hero-sub">
        Textes du <strong>Journal Officiel Algérien (JORADP)</strong> et publications officielles de l'<strong>ARPCE</strong>
        relatifs aux TIC, télécommunications, numérique, startups et cybersécurité — mis à jour automatiquement chaque jour.
      </p>
      <div class="reg-hero-meta">
        <span class="reg-count">Chargement…</span>
        ${_regLastChecked(null)}
        <a href="https://www.joradp.dz/HFR/Index.htm" target="_blank" rel="noopener" class="reg-src-link">
          <i class="fas fa-book-open"></i> JORADP
        </a>
        <a href="https://www.arpce.dz/fr/pub" target="_blank" rel="noopener" class="reg-src-link reg-src-link-arpce">
          <i class="fas fa-shield-alt"></i> ARPCE
        </a>
      </div>
    </div>

    <!-- Barre de recherche -->
    <div class="reg-search-wrap">
      <div class="reg-search-box">
        <i class="fas fa-search reg-search-ico"></i>
        <input type="search" id="regSearchInput" class="reg-search-input" placeholder="Rechercher un texte, numéro, mot-clé…" oninput="_regSearch(this.value)" autocomplete="off">
        <button class="reg-search-clear" id="regSearchClear" onclick="_regSearch('')" style="display:none" title="Effacer"><i class="fas fa-times"></i></button>
      </div>
    </div>

    <!-- Filtres source -->
    <div class="reg-filters" id="regFilters">
      <div class="reg-filter-row">
        <span class="reg-filter-label">Source :</span>
        <button class="reg-pill reg-pill-src reg-pill-active" onclick="_regFilterSource(this,'all')">Toutes</button>
        <button class="reg-pill reg-pill-src" onclick="_regFilterSource(this,'JORADP')"><i class="fas fa-book-open"></i> JORADP</button>
        <button class="reg-pill reg-pill-src reg-pill-arpce" onclick="_regFilterSource(this,'ARPCE')"><i class="fas fa-shield-alt"></i> ARPCE</button>
      </div>
      <div class="reg-filter-row">
        <span class="reg-filter-label">Type :</span>
        <button class="reg-pill reg-pill-type reg-pill-active" onclick="_regFilter(this,'all')">Tous</button>
        <button class="reg-pill reg-pill-type" onclick="_regFilter(this,'Loi')"><i class="fas fa-landmark"></i> Lois</button>
        <button class="reg-pill reg-pill-type" onclick="_regFilter(this,'Décret')"><i class="fas fa-gavel"></i> Décrets</button>
        <button class="reg-pill reg-pill-type" onclick="_regFilter(this,'Arrêté')"><i class="fas fa-file-signature"></i> Arrêtés</button>
        <button class="reg-pill reg-pill-type" onclick="_regFilter(this,'Décision')"><i class="fas fa-balance-scale"></i> Décisions</button>
        <button class="reg-pill reg-pill-type" onclick="_regFilter(this,'Appel')"><i class="fas fa-handshake"></i> Appels d'offres</button>
        <button class="reg-pill reg-pill-type" onclick="_regFilter(this,'Communiqué')"><i class="fas fa-bullhorn"></i> Communiqués</button>
        <button class="reg-pill reg-pill-type" onclick="_regFilter(this,'Avis')"><i class="fas fa-info-circle"></i> Avis</button>
      </div>
    </div>

    <!-- Résultats -->
    <div id="regResults" class="reg-results"></div>

    <!-- Abonnement Email -->
    <div class="reg-subscribe-box" id="regSubscribeBox">
      <div class="reg-sub-icon"><i class="fas fa-bell"></i></div>
      <div class="reg-sub-text">
        <strong>Recevoir les alertes par email</strong>
        <p>Dès qu'un nouveau texte TIC est détecté, recevez un email avec le résumé en 3 points.</p>
      </div>
      <form class="reg-sub-form" onsubmit="return _regSubscribe(event)">
        <input type="email" id="regSubEmail" placeholder="votre@email.com" required autocomplete="email">
        <button type="submit" class="reg-sub-btn" id="regSubBtn">
          <i class="fas fa-envelope"></i> S'abonner
        </button>
      </form>
      <p class="reg-sub-msg" id="regSubMsg" style="display:none"></p>
    </div>

    <!-- Disclaimer -->
    <div class="reg-disclaimer">
      <i class="fas fa-info-circle"></i>
      Les données JORADP sont extraites du sommaire (table des matières) uniquement.
      Les publications ARPCE proviennent directement de <a href="https://www.arpce.dz/fr/pub" target="_blank">arpce.dz</a>.
      Vérifiez toujours sur les sources officielles avant tout usage juridique.
    </div>
  </div>`;
}

let _regCurrentFilter = 'all';

window._regFilter = function(btn, type) {
  _regCurrentFilter = type;
  document.querySelectorAll('#regFilters .reg-pill-type').forEach(b => b.classList.remove('reg-pill-active'));
  btn.classList.add('reg-pill-active');
  _applyRegFilter(_regCurrentFilter, _regCurrentSource);
};

window._regFilterSource = function(btn, source) {
  _regCurrentSource = source;
  document.querySelectorAll('#regFilters .reg-pill-src').forEach(b => b.classList.remove('reg-pill-active'));
  btn.classList.add('reg-pill-active');
  _applyRegFilter(_regCurrentFilter, _regCurrentSource);
};

window._regSearch = function(q) {
  _regCurrentSearch = q;
  const clr = document.getElementById('regSearchClear');
  if (clr) clr.style.display = q ? '' : 'none';
  _applyRegFilter(_regCurrentFilter, _regCurrentSource);
};

window.showReglementaire = function() {
  stopAllAudio();
  if (typeof resetJargon === 'function') resetJargon();
  if (typeof resetDebat  === 'function') resetDebat();

  if (!_skipPush) {
    history.pushState({ view: 'reglementaire' }, 'Veille Réglementaire — Algeria Tech', '/reglementaire');
    document.title = 'Veille Réglementaire — Algeria Tech';
  }

  document.getElementById('mainContent').style.display    = 'none';
  document.getElementById('heroSection').classList.add('hidden');
  document.getElementById('articlePage').style.display    = 'none';
  document.getElementById('veilleSection').style.display  = 'none';
  document.getElementById('revueSection').style.display   = 'none';
  const compSec = document.getElementById('comparateurSection');
  if (compSec) compSec.style.display = 'none';

  const regSec = document.getElementById('reglementaireSection');
  if (!regSec) return;
  regSec.style.display = 'block';

  /* Injecter le HTML une seule fois */
  if (!regSec.querySelector('.reg-wrap')) {
    regSec.innerHTML = _buildRegHTML();
  }

  document.querySelectorAll('.main-nav a').forEach(a => {
    a.classList.toggle('active', a.id === 'nav-reglementaire');
  });

  _regCurrentFilter  = 'all';
  _regCurrentSource  = 'all';
  _loadRegData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* ── Abonnement email ──────────────────────────────────────── */
window._regSubscribe = async function(e) {
  e.preventDefault();
  const input  = document.getElementById('regSubEmail');
  const btn    = document.getElementById('regSubBtn');
  const msg    = document.getElementById('regSubMsg');
  const email  = (input?.value || '').trim();
  if (!email) return false;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Envoi…';
  msg.style.display = 'none';

  try {
    const r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const d = await r.json();
    msg.style.display = 'block';
    if (d.ok) {
      msg.className  = 'reg-sub-msg reg-sub-ok';
      msg.innerHTML  = `<i class="fas fa-check-circle"></i> ${d.message || 'Inscription confirmée ! Vérifiez votre boîte email.'}`;
      input.value    = '';
      btn.style.display = 'none';
    } else {
      msg.className  = 'reg-sub-msg reg-sub-err';
      msg.innerHTML  = `<i class="fas fa-exclamation-circle"></i> ${d.error || 'Erreur lors de l\'inscription.'}`;
      btn.disabled   = false;
      btn.innerHTML  = '<i class="fas fa-envelope"></i> S\'abonner';
    }
  } catch {
    msg.style.display = 'block';
    msg.className     = 'reg-sub-msg reg-sub-err';
    msg.textContent   = 'Serveur non disponible. Réessayez plus tard.';
    btn.disabled      = false;
    btn.innerHTML     = '<i class="fas fa-envelope"></i> S\'abonner';
  }
  return false;
};

// ===== COMPARATEUR D'OFFRES MOBILES =====
window.showComparateur = function() {
    stopAllAudio();
    if (typeof resetJargon === 'function') resetJargon();
    if (typeof resetDebat  === 'function') resetDebat();
    if (!_skipPush) {
        history.pushState({ view: 'comparateur' }, 'Comparateur mobile — Algeria Tech', '/comparateur');
        document.title = 'Comparateur d\'offres mobiles — Algeria Tech';
    }
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('articlePage').style.display = 'none';
    document.getElementById('veilleSection').style.display = 'none';
    document.getElementById('revueSection').style.display = 'none';
    const compSec = document.getElementById('comparateurSection');
    if (compSec) compSec.style.display = 'block';
    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));
    const navComp = document.getElementById('nav-comparateur');
    if (navComp) navComp.classList.add('active');
    if (typeof window.initComparateur === 'function') window.initComparateur();
    window.scrollTo({top: 0, behavior: 'smooth'});
};

let _revueData = null;
let _revueFilter = 'all';

async function loadRevue() {
    const container = document.getElementById('revueContent');
    const dateEl = document.getElementById('revueLastUpdate');
    if(!container) return;
    try {
        const res = await fetch('revue_presse.json?t=' + Date.now());
        if(!res.ok) throw new Error('Revue non disponible');
        const data = await res.json();
        if(!data.articles || data.articles.length === 0) throw new Error('Données incomplètes');

        _revueData = data;
        _revueFilter = 'all';
        if(dateEl) dateEl.textContent = `Édition du ${data.date}`;

        renderRevueCards();
    } catch(e) {
        container.innerHTML = '<div class="revue-loading"><i class="fas fa-exclamation-triangle"></i><p>La revue de presse sera disponible prochainement (génération automatique à 06h00).</p></div>';
    }
}

function renderRevueCards() {
    const container = document.getElementById('revueContent');
    if(!container || !_revueData) return;

    const showArchives = _revueFilter === 'archives';

    const articles = showArchives ? [] : _revueData.articles.filter(a => {
        if(_revueFilter === 'all') return true;
        if(_revueFilter === 'DZ') return a.pays === 'DZ';
        if(_revueFilter === 'FR') return a.pays === 'FR';
        return a.categorie === _revueFilter;
    });

    const cats = [...new Set(_revueData.articles.map(a => a.categorie))].sort();
    const filterBtns = [
        { key: 'all', label: 'Toutes' },
        { key: 'DZ',  label: '🇩🇿 Algérie' },
        { key: 'FR',  label: '🌐 International' },
        ...cats.map(c => ({ key: c, label: c })),
        { key: 'archives', label: '📁 Archives', extra: 'archives-btn' }
    ];

    const catSlug = cat => ({ 'IA':'cat-ia','Télécoms':'cat-telecoms','Startups':'cat-startups','Innovation':'cat-innovation','Numérique':'cat-numerique','Cybersécurité':'cat-cybersecurite','Réseaux':'cat-reseaux' }[cat] || 'cat-default');

    const une = articles[0];
    const rest = articles.slice(1);

    // Masthead (titre + date) — défile normalement
    const _annee = _revueData.lastUpdated ? new Date(_revueData.lastUpdated).getFullYear() : new Date().getFullYear();
    const mastheadHtml = `
        <div class="revue-masthead">
            <div class="revue-masthead-brand">
                <span class="revue-masthead-title">Revue de <span>Presse</span></span>
                <span class="revue-masthead-subtitle">TIC &amp; Télécoms · Algérie &amp; International</span>
            </div>
            <div class="revue-masthead-date">
                <div class="revue-masthead-date-line"><span class="revue-masthead-label">✦ Édition quotidienne du <strong>${_revueData.date} ${_annee}</strong></span></div>
                <span class="revue-count-journal">${articles.length} article${articles.length !== 1 ? 's' : ''} · ${_revueData.totalSources || 20} sources</span>
            </div>
        </div>`;

    // Toolbar (filtres) — élément frère INDÉPENDANT, sticky dans tout #revueContent
    const toolbarHtml = `
        <div class="revue-toolbar">
            <div class="revue-filters-journal">
                ${filterBtns.map(f => `
                    <button class="revue-filter-journal${_revueFilter === f.key ? ' active' : ''}${f.extra ? ' '+f.extra : ''}"
                            onclick="setRevueFilter('${f.key}')">${f.label}</button>
                `).join('')}
            </div>
            ${isAdminUnlocked() ? `<button class="revue-add-btn" onclick="openRevueAddModal()" title="Ajouter un article manuellement"><i class="fas fa-plus"></i></button>` : ''}
        </div>`;

    const syntheseHtml = `
        <div class="revue-synthese-bloc">
            <div class="revue-synthese-eyelet"><i class="fas fa-robot"></i> Synthèse IA</div>
            <p class="revue-synthese-text">${_revueData.synthese}</p>
        </div>`;

    const syntheseArticleHtml = _revueData.syntheseArticle ? `
        <div class="revue-article-du-jour" onclick="openRevueArticle()">
            <div class="revue-article-du-jour-icon"><i class="fas fa-newspaper"></i></div>
            <div class="revue-article-du-jour-text">
                <span class="revue-article-du-jour-label">Tour d'horizon (${_revueData.articles.length} articles)</span>
                <span class="revue-article-du-jour-titre">${_revueData.syntheseArticle.titre}</span>
            </div>
            <span class="revue-article-du-jour-cta">Lire l'article complet <i class="fas fa-arrow-down"></i></span>
        </div>` : '';

    const uneHtml = une ? `
        <div class="revue-une" style="--revue-glow:${glowByCategorie(une.categorie)}">
            <div class="revue-card-shine"></div>
            ${isAdminUnlocked() ? `<button class="revue-delete-btn" onclick="event.stopPropagation();deleteRevueArticle(${_revueData.articles.indexOf(une)})" title="Supprimer cet article"><i class="fas fa-trash"></i></button>` : ''}
            <div class="revue-une-left">
                <span class="revue-une-cat">${une.categorie}</span>
                <a href="${une.url}" target="_blank" rel="noopener" class="revue-une-title-link">
                    <h2 class="revue-une-title">${une.titre}</h2>
                </a>
                <p class="revue-une-accroche">${une.accroche || une.resume}</p>
            </div>
            <div class="revue-une-right">
                <div class="revue-une-source-row">
                    <img class="revue-une-logo" src="${une.logo || ''}" alt="${une.source}" onerror="this.style.display='none'">
                    <span class="revue-une-source-name">${une.source}</span>
                    <span class="revue-une-pays ${une.pays === 'DZ' ? 'dz' : 'fr'}">${une.pays === 'DZ' ? '🇩🇿 DZ' : '🌐 Intl'}</span>
                </div>
                <div class="revue-une-ai-badge">
                    <span class="revue-ai-pulse"></span> Sélectionné par IA
                </div>
                <p class="revue-une-resume">${une.resume || une.accroche}</p>
            </div>
        </div>` : '';

    const gridHtml = rest.length ? `
        <div class="revue-grid-journal">
            ${rest.map(a => `
                <div class="revue-card-journal" style="--revue-glow:${glowByCategorie(a.categorie)}">
                    <div class="revue-card-shine"></div>
                    ${isAdminUnlocked() ? `<button class="revue-delete-btn" onclick="event.stopPropagation();deleteRevueArticle(${_revueData.articles.indexOf(a)})" title="Supprimer cet article"><i class="fas fa-trash"></i></button>` : ''}
                    <span class="revue-card-cat ${catSlug(a.categorie)}">${a.categorie}</span>
                    <a href="${a.url}" target="_blank" rel="noopener" class="revue-card-title-link">
                        <h3 class="revue-card-title-journal">${a.titre}</h3>
                    </a>
                    <p class="revue-card-accroche-journal">${a.accroche || a.resume}</p>
                    <div class="revue-card-footer-journal">
                        <img class="revue-card-logo-sm" src="${a.logo || ''}" alt="${a.source}" onerror="this.style.display='none'">
                        <span class="revue-card-source-sm">${a.source}</span>
                        <span class="revue-card-pays-sm ${a.pays === 'DZ' ? 'dz' : 'fr'}">${a.pays === 'DZ' ? '🇩🇿' : '🌐'}</span>
                        <a href="${a.url}" target="_blank" rel="noopener" class="revue-card-lire">Lire →</a>
                    </div>
                </div>
            `).join('')}
        </div>` : (!showArchives ? '<p class="revue-empty-journal">Aucun article pour ce filtre.</p>' : '');

    const archiveHtml = showArchives ? `
        <div class="revue-archive-picker">
            <h4>📁 Consulter une édition archivée</h4>
            <p>Les éditions précédentes sont disponibles depuis le lendemain de leur publication.</p>
            <div class="revue-archive-row">
                <input type="date" id="revueArchiveDate" class="revue-archive-input" max="${new Date().toISOString().slice(0,10)}">
                <button class="revue-archive-btn" onclick="loadRevueArchive()">Charger cette édition</button>
            </div>
        </div>` : '';

    const footerHtml = `
        <div class="revue-footer-edition">
            <span class="revue-footer-sources">${_revueData.totalSources || 20} sources surveillées · Mise à jour quotidienne</span>
            <div class="revue-footer-ai">
                <span class="revue-ai-pulse"></span> Sélection &amp; synthèse par IA Mistral
            </div>
        </div>`;

    container.innerHTML = mastheadHtml + toolbarHtml + syntheseHtml + syntheseArticleHtml + (showArchives ? archiveHtml : uneHtml + gridHtml) + footerHtml;

    // Activer le moteur de lévitation 3D après chaque rendu
    initRevueTilt3D();
}

function _stripTags(html) { return (html || '').replace(/<[^>]+>/g, ''); }

function _revueReadingTime(art) {
    const words = (_stripTags(art.lead) + ' ' + (art.corpsHtml || []).map(_stripTags).join(' ')).trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

function _revueViewsKey() { return 'tourHorizonViews_' + (_revueData.date || 'default'); }
function _revueIncrementViews() {
    const k = _revueViewsKey();
    const v = parseInt(localStorage.getItem(k) || '0', 10) + 1;
    localStorage.setItem(k, v);
    return v;
}
function _revueGetViews() { return parseInt(localStorage.getItem(_revueViewsKey()) || '0', 10); }

let _tourHorizonEditing = false;
let _tourHorizonUtterance = null;

function renderRevueArticleBody() {
    const art = _revueData && _revueData.syntheseArticle;
    const body = document.getElementById('revueArticleBody');
    if (!art || !body) return;

    if (_tourHorizonEditing) {
        body.innerHTML = `
            <h2 class="revue-article-full-titre">Modifier le Tour d'horizon</h2>
            <div class="form-group"><label>Titre</label><input type="text" id="revueEditTitre" value="${(art.titre || '').replace(/"/g, '&quot;')}"></div>
            <div class="form-group"><label>Lead</label><textarea id="revueEditLead" rows="3">${_stripTags(art.lead)}</textarea></div>
            <div class="form-group"><label>Paragraphes</label>
                <div id="revueEditParagraphs">
                    ${(art.corpsHtml || []).map(p => `
                        <div class="revue-edit-para-row">
                            <textarea class="revue-edit-para" rows="3">${p.replace(/^<p>|<\/p>$/g, '')}</textarea>
                            <button type="button" class="revue-para-del" onclick="this.parentElement.remove()" title="Supprimer ce paragraphe"><i class="fas fa-trash"></i></button>
                        </div>`).join('')}
                </div>
                <button type="button" class="revue-para-add" onclick="addRevueParagraphField()"><i class="fas fa-plus"></i> Ajouter un paragraphe</button>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="cancelRevueEditMode()">Annuler</button>
                <button type="button" class="btn-primary" onclick="saveRevueEdit()"><i class="fas fa-check"></i> Enregistrer</button>
            </div>
        `;
        return;
    }

    const heure = _revueData.lastUpdated ? new Date(_revueData.lastUpdated).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    const readingTime = _revueReadingTime(art);
    const views = _revueGetViews();

    body.innerHTML = `
        ${isAdminUnlocked() ? `<div class="revue-article-admin-bar">
            <button class="revue-edit-btn" onclick="enterRevueEditMode()" title="Modifier le Tour d'horizon"><i class="fas fa-pencil-alt"></i> Modifier</button>
        </div>` : ''}
        <h2 class="revue-article-full-titre">${art.titre || ''}</h2>
        <div class="revue-article-full-meta">
            <span><i class="far fa-clock"></i> ${heure}</span>
            <span><i class="fas fa-book-open"></i> ${readingTime} min</span>
            <span><i class="far fa-eye"></i> ${views} vue${views > 1 ? 's' : ''}</span>
        </div>
        <div class="revue-article-full-actions">
            <button class="meta-audio-btn" id="revueArticleListenBtn" onclick="toggleTourHorizonAudio()"><i class="fas fa-headphones"></i> Écouter l'article</button>
            <button class="debat-btn" id="revueArticleExplainBtn" onclick="explainTourHorizon()"><i class="fas fa-bolt"></i> Expliquer l'article par l'IA</button>
        </div>
        <div id="revueArticleExplainBox"></div>
        <p class="revue-article-full-lead">${art.dateline ? `<strong class="revue-article-full-dateline">${art.dateline}</strong>- ` : ''}${art.lead || ''}</p>
        <div class="revue-article-full-corps">${(art.corpsHtml || []).join('')}</div>
        <div class="share-buttons">
            <button class="share-btn facebook" onclick="share('facebook')"><i class="fab fa-facebook-f"></i> Facebook</button>
            <button class="share-btn twitter" onclick="share('twitter')"><i class="fab fa-twitter"></i> Twitter</button>
            <button class="share-btn whatsapp" onclick="share('whatsapp')"><i class="fab fa-whatsapp"></i> WhatsApp</button>
            <button class="share-btn linkedin" onclick="share('linkedin')"><i class="fab fa-linkedin-in"></i> LinkedIn</button>
            <button class="share-btn copy" onclick="copyLink()"><i class="fas fa-link"></i> Copier</button>
        </div>
    `;
}

function openRevueArticle() {
    const art = _revueData && _revueData.syntheseArticle;
    const modal = document.getElementById('revueArticleModal');
    if (!art || !modal) return;
    _tourHorizonEditing = false;
    _revueIncrementViews();
    renderRevueArticleBody();
    modal.classList.add('show');
}

function closeRevueArticle() {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    _tourHorizonUtterance = null;
    _tourHorizonEditing = false;
    const modal = document.getElementById('revueArticleModal');
    if (modal) modal.classList.remove('show');
}

function toggleTourHorizonAudio() {
    const btn = document.getElementById('revueArticleListenBtn');
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        _tourHorizonUtterance = null;
        if (btn) btn.innerHTML = '<i class="fas fa-headphones"></i> Écouter l\'article';
        return;
    }
    const art = _revueData.syntheseArticle;
    const text = art.titre + '. ' + _stripTags(art.lead) + ' ' + (art.corpsHtml || []).map(_stripTags).join(' ');
    _tourHorizonUtterance = new SpeechSynthesisUtterance(text);
    _tourHorizonUtterance.lang = 'fr-FR';
    _tourHorizonUtterance.onend = () => { _tourHorizonUtterance = null; if (btn) btn.innerHTML = '<i class="fas fa-headphones"></i> Écouter l\'article'; };
    speechSynthesis.speak(_tourHorizonUtterance);
    if (btn) btn.innerHTML = '<i class="fas fa-pause"></i> Mettre en pause';
}

window.explainTourHorizon = async function () {
    const art = _revueData && _revueData.syntheseArticle;
    const btn = document.getElementById('revueArticleExplainBtn');
    const box = document.getElementById('revueArticleExplainBox');
    if (!art || !btn || !box || btn.dataset.loading) return;
    if (box.classList.contains('synthese-visible')) { box.classList.remove('synthese-visible'); box.innerHTML = ''; return; }
    btn.dataset.loading = '1';
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyse en cours…';
    btn.disabled = true;
    try {
        const contenu = _stripTags(art.lead) + ' ' + (art.corpsHtml || []).map(_stripTags).join(' ');
        const r = await fetch(`${API_BASE}/api/synthese`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titre: art.titre, contenu, lang: 'fr' }),
            signal: AbortSignal.timeout(25000)
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        _renderSynthese(box, data, false);
    } catch (e) {
        box.innerHTML = '<div class="synthese-inner"><p class="synthese-error">Erreur — réessayez</p></div>';
        box.classList.add('synthese-visible');
        setTimeout(() => { box.classList.remove('synthese-visible'); box.innerHTML = ''; }, 4000);
    } finally {
        delete btn.dataset.loading; btn.disabled = false; btn.innerHTML = orig;
    }
};

// ── Édition manuelle du Tour d'horizon (admin local uniquement) ───
function enterRevueEditMode() { _tourHorizonEditing = true; renderRevueArticleBody(); }
function cancelRevueEditMode() { _tourHorizonEditing = false; renderRevueArticleBody(); }

window.addRevueParagraphField = function () {
    const wrap = document.getElementById('revueEditParagraphs');
    if (!wrap) return;
    const row = document.createElement('div');
    row.className = 'revue-edit-para-row';
    row.innerHTML = `<textarea class="revue-edit-para" rows="3"></textarea><button type="button" class="revue-para-del" onclick="this.parentElement.remove()" title="Supprimer ce paragraphe"><i class="fas fa-trash"></i></button>`;
    wrap.appendChild(row);
};

window.saveRevueEdit = async function () {
    const titre = document.getElementById('revueEditTitre').value.trim();
    const lead = document.getElementById('revueEditLead').value.trim();
    const corps = Array.from(document.querySelectorAll('.revue-edit-para')).map(t => t.value.trim()).filter(Boolean);
    if (!titre || !lead) { showToast('❌ Titre et lead requis'); return; }
    try {
        const res = await fetch(`${API_BASE}/api/revue/tour-horizon`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titre, lead, corps })
        });
        if (res.ok) {
            showToast('✅ Tour d\'horizon mis à jour !');
            _tourHorizonEditing = false;
            await loadRevue();
            openRevueArticle();
        } else { showToast('❌ Erreur serveur'); }
    } catch (e) { showToast('❌ Erreur réseau'); }
};

// ── Ajout / suppression manuelle d'articles de la revue (admin local) ──
window.openRevueAddModal = function () {
    document.getElementById('revueAddForm').reset();
    document.getElementById('revueAddModal').classList.add('show');
};
window.closeRevueAddModal = () => document.getElementById('revueAddModal').classList.remove('show');

window.handleRevueAddSubmit = async function (e) {
    e.preventDefault();
    const titre = document.getElementById('revueAddTitre').value;
    const url = document.getElementById('revueAddUrl').value;
    const source = document.getElementById('revueAddSource').value;
    const categorie = document.getElementById('revueAddCategorie').value;
    const pays = document.getElementById('revueAddPays').value;
    try {
        const res = await fetch(`${API_BASE}/api/revue/article`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titre, url, source, categorie, pays })
        });
        if (res.ok) { showToast('✅ Article ajouté !'); closeRevueAddModal(); loadRevue(); }
        else { showToast('❌ Erreur serveur'); }
    } catch (err) { showToast('❌ Erreur réseau'); }
};

window.deleteRevueArticle = async function (index) {
    if (index == null || index < 0) return;
    if (!confirm('Supprimer définitivement cet article de la revue de presse ?')) return;
    try {
        const res = await fetch(`${API_BASE}/api/revue/article/${index}`, { method: 'DELETE' });
        if (res.ok) { showToast('✅ Supprimé !'); loadRevue(); }
        else { showToast('❌ Erreur serveur'); }
    } catch (e) { showToast('❌ Erreur réseau'); }
};

// ── Couleur de lueur par catégorie ────────────────────────────────
function glowByCategorie(cat) {
    const map = {
        'IA':              'rgba(123,47,247,0.22)',
        'Télécoms':        'rgba(0,212,255,0.22)',
        'Télécommunications': 'rgba(0,212,255,0.22)',
        'Startups':        'rgba(217,119,6,0.22)',
        'Innovation':      'rgba(16,185,129,0.22)',
        'Numérique':       'rgba(8,145,178,0.22)',
        'Cybersécurité':   'rgba(220,38,38,0.22)',
        'Cyber':           'rgba(220,38,38,0.22)',
        'Réseaux':         'rgba(3,105,161,0.22)',
        'Régulation':      'rgba(245,158,11,0.22)',
        'Économie':        'rgba(16,185,129,0.22)',
    };
    return map[cat] || 'rgba(0,98,51,0.20)';
}

// ── Moteur de lévitation 3D "Quantum Cards" ───────────────────────
function initRevueTilt3D() {
    const MAX_TILT  = 13;   // degrés max de rotation X/Y
    const SCALE     = 1.04; // grossissement au survol
    const LIFT      = 26;   // translateZ en pixels
    const EASE_OUT  = 'transform 0.65s cubic-bezier(0.23,1,0.32,1), box-shadow 0.55s ease, border-color 0.3s ease';

    // Sélectionner cartes + UNE
    const targets = document.querySelectorAll('.revue-card-journal, .revue-une');

    targets.forEach(function(card) {
        // Éviter les doublons si renderRevueCards est rappelé
        if (card._tilt3d) return;
        card._tilt3d = true;

        var shine = card.querySelector('.revue-card-shine');

        card.addEventListener('mouseenter', function() {
            // Désactiver la transition pendant le mouvement pour une fluidité totale
            card.style.transition = 'none';
        });

        card.addEventListener('mousemove', function(e) {
            var r  = card.getBoundingClientRect();
            var x  = e.clientX - r.left;
            var y  = e.clientY - r.top;
            var cx = r.width  / 2;
            var cy = r.height / 2;

            var rotY =  ((x - cx) / cx) * MAX_TILT;
            var rotX = -((y - cy) / cy) * MAX_TILT;

            // Décalage directionnel des ombres selon l'angle de tilt
            var offX = (rotY / MAX_TILT) * 18;
            var offY = (-rotX / MAX_TILT) * 18;
            var glow = getComputedStyle(card).getPropertyValue('--revue-glow').trim()
                       || 'rgba(0,212,255,0.22)';

            card.style.transform = [
                'perspective(900px)',
                'rotateX(' + rotX + 'deg)',
                'rotateY(' + rotY + 'deg)',
                'translateZ(' + LIFT + 'px)',
                'scale(' + SCALE + ')'
            ].join(' ');

            card.style.boxShadow = [
                (offX * 0.5) + 'px ' + (offY * 0.5 + 14) + 'px 28px rgba(0,0,0,0.20)',
                offX + 'px ' + (offY + 38) + 'px 65px rgba(0,0,0,0.14)',
                (offX * 0.3) + 'px ' + (offY * 0.3 + 48) + 'px 75px ' + glow,
                '0 75px 110px -28px rgba(0,212,255,0.16)',
                'inset 0 1px 0 rgba(255,255,255,0.5)'
            ].join(', ');

            card.style.borderColor = 'transparent';

            // Reflet spéculaire qui suit le curseur
            if (shine) {
                shine.style.setProperty('--mx', ((x / r.width)  * 100).toFixed(1) + '%');
                shine.style.setProperty('--my', ((y / r.height) * 100).toFixed(1) + '%');
            }
        });

        card.addEventListener('mouseleave', function() {
            // Reset avec spring easing
            card.style.transition = EASE_OUT;
            card.style.transform  = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)';
            card.style.boxShadow  = '0 2px 8px rgba(0,0,0,0.05)';
            card.style.borderColor = '';
            setTimeout(function() { card.style.transition = ''; }, 700);
        });
    });
}

window.setRevueFilter = function(key) {
    _revueFilter = key;
    renderRevueCards();
};

// ── Chargement d'une édition archivée ────────────────────────────
window.loadRevueArchive = function() {
    var input = document.getElementById('revueArchiveDate');
    if (!input || !input.value) return;
    var date = input.value; // format YYYY-MM-DD
    var container = document.getElementById('revueContent');
    if (container) container.innerHTML = '<div class="revue-loading"><i class="fas fa-spinner fa-spin"></i><p>Chargement de l\'édition du ' + date + '…</p></div>';
    fetch('archives/' + date + '.json?t=' + Date.now())
        .then(function(r) {
            if (!r.ok) throw new Error('Archive non trouvée');
            return r.json();
        })
        .then(function(data) {
            _revueData = data;
            _revueFilter = 'all';
            renderRevueCards();
        })
        .catch(function() {
            if (container) container.innerHTML = '<div class="revue-loading"><i class="fas fa-exclamation-triangle"></i>'
                + '<p>Archive du <strong>' + date + '</strong> non disponible.<br>Les archives sont générées chaque matin à partir du lendemain.</p></div>';
        });
};

// ===== PAGINATION ET FILTRES =====
function renderPagination(arts) {
    if(!arts || arts.length === 0) { const pag = document.getElementById('pagination'); if(pag) pag.innerHTML = ''; return; }
    const total = Math.ceil(arts.length / ITEMS_PER_PAGE);
    const pag = document.getElementById('pagination');
    if(!pag) return;
    pag.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === currentPage ? 'active' : '';
        btn.onclick = () => {
            currentPage = i;
            const start = (i-1) * ITEMS_PER_PAGE;
            renderGrid(arts.slice(start, start + ITEMS_PER_PAGE));
            renderPagination(arts);
            window.scrollTo({top: 400, behavior: 'smooth'});
        };
        pag.appendChild(btn);
    }
}

window.filterByCategory = function(cat, ev) {
    if(ev) ev.preventDefault();
    // ── Routeur ──────────────────────────────────────────────────
    if (!_skipPush) {
        const _url = (cat === 'all' || cat === 'Tous')
            ? '/'
            : '/?cat=' + encodeURIComponent(cat);
        history.pushState({ view: 'cat', cat }, cat + ' — Algeria Tech', _url);
        if (cat !== 'all') document.title = cat + ' — Algeria Tech';
    }
    // Préparation de l'affichage : on affiche le bloc principal et on cache l'article ou la veille
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('articlePage').style.display = 'none';
    document.getElementById('veilleSection').style.display = 'none';
    document.getElementById('revueSection').style.display = 'none';
    // Mise Ã  jour de l'onglet actif dans la navigation
    document.querySelectorAll('.main-nav a').forEach(a => {
        const text = a.innerText.trim();
        a.classList.toggle('active', text === cat || (cat === 'all' && text === 'Accueil'));
    });
    if (cat === 'VidÃ©o' || cat === 'Vidéo') {
        document.getElementById('heroSection').classList.add('hidden');
        loadYouTubeVideos();
        return;
    }
    currentFilter = cat;
    currentPage = 1;
    // On affiche le Hero (grandes images) uniquement sur l'Accueil, on le cache ailleurs
    document.getElementById('heroSection').classList.toggle('hidden', cat !== 'all');
    const filtered = cat === 'all' ? allArticles : allArticles.filter(a => a.categorie === cat);
    renderGrid(filtered.slice(0, ITEMS_PER_PAGE));
    renderPagination(filtered);
};

window.filterByTag = function(tag) {
    currentTag = tag;
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('articlePage').style.display = 'none';
    document.getElementById('veilleSection').style.display = 'none';
    document.getElementById('revueSection').style.display = 'none';
    document.getElementById('heroSection').classList.add('hidden');
    const filtered = allArticles.filter(a => a.tags && a.tags.includes(tag));
    renderGrid(filtered.slice(0, ITEMS_PER_PAGE));
    renderPagination(filtered);
};

// ===== SIDEBAR WIDGETS =====
function renderTrending() {
    const sorted = [...allArticles].sort((a,b) => b.views - a.views).slice(0, 5);
    const list = document.getElementById('trendingList');
    if(list) list.innerHTML = sorted.map((a,i) => `<li class="trending-item" onclick="openArticle('${a.id}')"><span class="trending-number">${i+1}</span><div class="trending-content"><h4>${a.titre}</h4><span>${a.views} vues</span></div></li>`).join('');
}

function renderBreves(page) {
    if (page) brevesPage = page;
    const list = document.getElementById('brevesList');
    const pag = document.getElementById('brevesPagination');
    if (!list) return;

    if (!breveArticles.length) {
        list.innerHTML = '<li class="trending-item" style="cursor:default;"><div class="trending-content"><span>Aucune brève pour le moment.</span></div></li>';
        if (pag) pag.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(breveArticles.length / BREVES_PER_PAGE);
    if (brevesPage > totalPages) brevesPage = totalPages;
    const start = (brevesPage - 1) * BREVES_PER_PAGE;
    const pageItems = breveArticles.slice(start, start + BREVES_PER_PAGE);

    list.innerHTML = pageItems.map(a =>
        `<li class="trending-item" onclick="openArticle('${a.id}')"><div class="trending-content"><h4>${a.titre}</h4><span>${a.date} à ${a.heure} · ${a.views} vues</span></div></li>`
    ).join('');

    if (pag) {
        pag.innerHTML = '';
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = i === brevesPage ? 'active' : '';
                btn.onclick = () => renderBreves(i);
                pag.appendChild(btn);
            }
        }
    }
}

function renderTags() {
    const counts = {};
    allArticles.forEach(a => a.tags?.forEach(t => counts[t] = (counts[t] || 0) + 1));
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const cloud = document.getElementById('tagCloud');
    if(cloud) cloud.innerHTML = sorted.map(([t,c]) => `<span class="tag-cloud-item" onclick="filterByTag('${t}')">${t} (${c})</span>`).join('');
}

// ===== THEME ET SCROLL =====
window.toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
};

function loadTheme() { if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); }

window.addEventListener('scroll', () => {
    if (document.getElementById('articlePage').style.display !== 'none') {
        const h = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const progress = document.getElementById('readingProgress');
        if(progress) progress.style.width = ((window.scrollY / h) * 100) + '%';
    }
    const btt = document.getElementById('backToTop');
    if(btt) btt.classList.toggle('visible', window.scrollY > 500);
});

function showToast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

function cls(c) {
    const maps = { 'AlgÃ©rie':'tag-algerie','TÃ©lÃ©coms':'tag-telecoms','Mobile':'tag-mobile','Startups':'tag-startups','Innovation':'tag-innovation','Infographies':'tag-video','VidÃ©o':'tag-video','Entreprises':'tag-startups' };
    return maps[c] || 'tag-telecoms';
}

function initCounters() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target; const target = +el.dataset.target; let cur = 0;
                const up = () => { cur += target/100; if(cur < target) { el.textContent = Math.floor(cur); requestAnimationFrame(up); } else { el.textContent = target; } };
                up(); obs.unobserve(el);
            }
        });
    });
    document.querySelectorAll('.stat-number').forEach(c => obs.observe(c));
}

// ===== SMART HUB IA (boutons du modal admin) =====
const HUB_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '' : 'https://dz-tech-press-api.onrender.com';

let _hubLastAI = null;

// Compteur de caractères hubSmartBox
document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('hubSmartBox');
    if (box) box.addEventListener('input', () => {
        document.getElementById('hubCharCount').textContent = box.value.length + ' caractères';
    });
});

function hubSetStatus(btnId, state) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const icon = btn.querySelector('i');
    const label = btn.querySelector('span');
    const origTexts = { hubUrlBtn:'Importer', hubPdfBtn:'PDF', hubTranslateBtn:'Traduire', hubGenBtn:'Générer', hubFillBtn:'Remplir' };
    const origIcons = { hubUrlBtn:'fas fa-globe', hubPdfBtn:'fas fa-file-pdf', hubTranslateBtn:'fas fa-language', hubGenBtn:'fas fa-pen-nib', hubFillBtn:'fas fa-fill-drip' };
    if (state === 'loading') {
        btn.disabled = true; btn.classList.add('hub-btn-loading');
        if (icon) icon.className = 'fas fa-spinner fa-spin';
        if (label) label.textContent = '...';
    } else if (state === 'success') {
        btn.disabled = false; btn.classList.remove('hub-btn-loading'); btn.classList.add('hub-btn-done');
        if (icon) icon.className = 'fas fa-check';
        if (label) label.textContent = 'OK ✓';
        setTimeout(() => {
            btn.classList.remove('hub-btn-done');
            if (icon) icon.className = origIcons[btnId];
            if (label) label.textContent = origTexts[btnId];
        }, 2500);
    } else if (state === 'error') {
        btn.disabled = false; btn.classList.remove('hub-btn-loading');
        if (icon) icon.className = 'fas fa-exclamation-triangle';
        if (label) label.textContent = 'Erreur';
        setTimeout(() => {
            if (icon) icon.className = origIcons[btnId];
            if (label) label.textContent = origTexts[btnId];
        }, 2500);
    }
}

// Importer le contenu d'une URL source → hubSmartBox (miroir de fetchFromUrl de smart-ingest.js)
window.hubFetchFromUrl = async function() {
    const url = document.getElementById('sourceUrl').value.trim();
    if (!url || !url.startsWith('http')) return showToast("Veuillez saisir une URL valide (commençant par http...)");
    hubSetStatus('hubUrlBtn', 'loading');
    try {
        const r = await fetch(`${HUB_API}/api/fetch-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Erreur serveur');

        const box = document.getElementById('hubSmartBox');
        box.value = d.text;
        document.getElementById('hubCharCount').textContent = d.text.length + ' caractères';

        const badge = document.getElementById('hubSourceBadge');
        badge.textContent = '🔗 Source : ' + url;
        badge.classList.remove('hidden');

        if (d.title && !document.getElementById('titre').value) {
            document.getElementById('titre').value = d.title;
        }

        hubSetStatus('hubUrlBtn', 'success');
    } catch (e) {
        showToast("Erreur lors de l'import : " + e.message);
        hubSetStatus('hubUrlBtn', 'error');
    }
};

// PDF → hubSmartBox
window.hubTranscribePDF = async function(input) {
    if (!input || !input.files[0]) return;
    hubSetStatus('hubPdfBtn', 'loading');
    const fd = new FormData();
    fd.append('pdf', input.files[0]);
    try {
        const r = await fetch(`${HUB_API}/api/transcribe-pdf`, { method: 'POST', body: fd });
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        const box = document.getElementById('hubSmartBox');
        box.value = d.text;
        document.getElementById('hubCharCount').textContent = d.text.length + ' caractères';
        hubSetStatus('hubPdfBtn', 'success');
    } catch(e) {
        showToast('Erreur lecture PDF : ' + e.message);
        hubSetStatus('hubPdfBtn', 'error');
    } finally { input.value = ''; }
};

// Traduire hubSmartBox → français
// Stratégie : POST direct Google (pas de limite URL) → fallback endpoint serveur
window.hubTranslate = async function() {
    const text = document.getElementById('hubSmartBox').value.trim();
    if (!text) return showToast('Aucun texte à traduire.');
    hubSetStatus('hubTranslateBtn', 'loading');

    // Traduction en chunks de 4000 chars max pour éviter les timeouts
    async function translateChunk(chunk) {
        // Tentative 1 : POST direct sur Google Translate unofficial API
        try {
            const body = new URLSearchParams({ client:'gtx', sl:'auto', tl:'fr', dt:'t', q: chunk });
            const r = await fetch('https://translate.googleapis.com/translate_a/single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
            if (!r.ok) throw new Error('Google direct failed');
            const d = await r.json();
            return d[0].map(s => s[0]).join('');
        } catch (_) {
            // Fallback : endpoint serveur (évite CORS et limite URL)
            const r2 = await fetch(`${HUB_API}/api/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: chunk, to: 'fr' })
            });
            if (!r2.ok) throw new Error('Server translate failed');
            const d2 = await r2.json();
            return d2.translated || chunk;
        }
    }

    try {
        // Découper en chunks de 4000 chars sur les sauts de ligne
        const CHUNK = 4000;
        let result = '';
        if (text.length <= CHUNK) {
            result = await translateChunk(text);
        } else {
            const lines = text.split('\n');
            let current = '';
            for (const line of lines) {
                if ((current + line).length > CHUNK) {
                    result += await translateChunk(current) + '\n';
                    current = line + '\n';
                } else {
                    current += line + '\n';
                }
            }
            if (current.trim()) result += await translateChunk(current);
        }

        const box = document.getElementById('hubSmartBox');
        box.value = result.trim();
        document.getElementById('hubCharCount').textContent = box.value.length + ' caractères';
        hubSetStatus('hubTranslateBtn', 'success');
    } catch(e) {
        showToast('Erreur traduction : ' + e.message);
        hubSetStatus('hubTranslateBtn', 'error');
    }
};

// Générer article via Smart Engine
let _hubStyle = 'aps';

(function setupHubGenDropdown() {
    document.addEventListener('DOMContentLoaded', () => {
        const wrap = document.getElementById('hubGenWrap');
        const btn = document.getElementById('hubGenBtn');
        if (!wrap || !btn) return;
        btn.addEventListener('click', () => wrap.classList.toggle('open'));
        document.querySelectorAll('.hub-gen-option').forEach(opt => {
            opt.addEventListener('click', () => {
                _hubStyle = opt.dataset.style;
                document.querySelectorAll('.hub-gen-option').forEach(o => o.classList.remove('checked'));
                opt.classList.add('checked');
                wrap.classList.remove('open');
                hubGenerate();
            });
        });
        document.addEventListener('click', e => {
            if (!wrap.contains(e.target)) wrap.classList.remove('open');
        });
    });
})();

window.hubGenerate = async function() {
    const source = document.getElementById('hubSmartBox').value.trim();
    if (!source) return showToast('Collez un texte dans la zone IA avant de générer.');
    hubSetStatus('hubGenBtn', 'loading');
    try {
        const r = await fetch(`${HUB_API}/api/smart-generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: source, style: _hubStyle })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Erreur inconnue');
        _hubLastAI = d;
        hubSetStatus('hubGenBtn', 'success');
        showToast('Article généré ! Cliquez sur "Remplir" pour remplir le formulaire.');
    } catch(e) {
        showToast('Erreur génération : ' + e.message);
        hubSetStatus('hubGenBtn', 'error');
    }
};

// Remplir le formulaire depuis le résultat IA
window.hubFill = function() {
    if (!_hubLastAI) return showToast('Générez d\'abord un article avec le bouton "Générer".');
    hubSetStatus('hubFillBtn', 'loading');
    const d = _hubLastAI;
    if (d.titre)   document.getElementById('titre').value   = d.titre;
    if (d.lead)    document.getElementById('extrait').value = d.lead;
    if (d.tags)    document.getElementById('tags').value    = Array.isArray(d.tags) ? d.tags.join(', ') : d.tags;
    if (d.contenu) document.getElementById('contenu').value = `# ${d.titre || ''}\n\n${d.lead || ''}\n\n${d.contenu}`;
    if (d.video)   document.getElementById('video').value   = d.video;
    // Détection auto catégorie (fallback si l'IA ne fournit pas déjà d.categorie)
    const txt = ((d.contenu || '') + ' ' + (d.titre || '')).toLowerCase();
    const mentionsAlgerie = /alg[ée]rie|wilaya|alger\b|oran\b|constantine\b|arpce|anpt/.test(txt);
    const cat = txt.includes('djezzy')||txt.includes('mobilis')||txt.includes('ooredoo')||txt.includes('télécom') ? 'Télécoms'
              : txt.includes('mobile')||txt.includes('smartphone') ? 'Mobile'
              : txt.includes('startup')||txt.includes('incubateur') ? 'Startups'
              : /\bia\b|intelligence artificielle|chatgpt|llm\b|machine learning/.test(txt) ? 'IA'
              : txt.includes('fintech')||txt.includes('paiement électronique')||txt.includes('banque en ligne') ? 'Fintech'
              : mentionsAlgerie && (txt.includes('entreprise')||txt.includes('société')) ? 'Entreprises'
              : mentionsAlgerie && (txt.includes('innovation')||txt.includes('numérique')) ? 'Innovation'
              : mentionsAlgerie ? 'Algérie'
              : 'Monde';
    document.getElementById('categorie').value = d.categorie || cat;
    hubSetStatus('hubFillBtn', 'success');
    showToast('Formulaire rempli ! Vérifiez et ajustez avant de déployer.');
};

// ===== GESTION ADMIN =====
window.toggleAdminPanel = async function() {
    // Vérifier si admin est déverrouillé (production uniquement)
    if (!isAdminUnlocked()) {
        return showToast('🔒 Administration disponible uniquement en local');
    }

    const modal = document.getElementById('adminModal');
    modal.classList.add('show');

    if (currentEditingId) {
        const art = findArticleById(currentEditingId);
        await ensureRawContent(art); // corps chargé à la demande (liste allégée)
        document.getElementById('titre').value = art.titre;
        document.getElementById('categorie').value = art.categorie;
        document.getElementById('date').value = art.date;
        document.getElementById('heure').value = art.heure;
        document.getElementById('extrait').value = art.extrait;
        document.getElementById('video').value = art.video || '';
        document.getElementById('tags').value = art.tags.join(', ');
        document.getElementById('contenu').value = art.rawContent || '';
        document.getElementById('position').value = art.position || '';
        document.getElementById('isBreve').checked = art.type === 'breve';

        if (document.getElementById('imagePreview')) {
            document.getElementById('imagePreview').innerHTML = `<p style="font-size:0.8rem;margin-bottom:5px;">Image actuelle:</p><img src="${art.image}" style="max-width:100%; border-radius:8px;">`;
        }
        
        if(!document.getElementById('delBtn')) {
            const delBtn = document.createElement('button');
            delBtn.id = 'delBtn';
            delBtn.type = 'button';
            delBtn.className = 'btn-secondary';
            delBtn.style.background = '#D21034';
            delBtn.style.color = 'white';
            delBtn.innerHTML = '<i class="fas fa-trash"></i> Supprimer';
            delBtn.onclick = deleteArticle;
            document.querySelector('.form-actions').prepend(delBtn);
        }
    }
};

window.closeAdminPanel = () => { document.getElementById('adminModal').classList.remove('show'); document.getElementById('delBtn')?.remove(); document.getElementById('imagePreview').innerHTML = ''; };

// ── IMAGE AUTO : IDs Unsplash vérifiés HTTP 200 ───────────────
function getAutoImage(titre, tags, categorie) {
    const U = 'https://images.unsplash.com/';
    const P = '?w=1200&h=800&fit=crop&q=80';
    const POOL = {
        drone:    ['photo-1527977966376-1c8408f9f108'],
        ecologie: ['photo-1441974231531-c6227db76b6e','photo-1473341304170-971dccb5ac1e'],
        satellite:['photo-1451187580459-43490279c0fa','photo-1454789548928-9efd52dc4031'],
        ia:       ['photo-1620712943543-bcc4688e7485'],
        cyber:    ['photo-1550751827-4bd374c3f58b'],
        cloud:    ['photo-1629654297299-c8506221ca97','photo-1544197150-b99a580bb7a8'],
        startup:  ['photo-1522202176988-66273c2fd55f','photo-1559136555-9303baea8ebd'],
        mobile:   ['photo-1511707171634-5f897ff02aa9'],
        telecoms: ['photo-1544197150-b99a580bb7a8'],
        default:  ['photo-1518770660439-4636190af475','photo-1504384308090-c894fdcc538d','photo-1517694712202-14dd9538aa97'],
    };
    const txt = (titre + ' ' + tags + ' ' + categorie).toLowerCase();
    let key = 'default';
    if      (/drone|uav|pilote.*aérien|télépilote/.test(txt))                                       key = 'drone';
    else if (/écologie|environnement|vert|solaire|énergie renouvel|green/.test(txt))                key = 'ecologie';
    else if (/satellite|espace|spatial|orbite/.test(txt))                                           key = 'satellite';
    else if (/intelligence artificielle|machine learning|\bia\b|\bai\b|chatgpt|llm|gpt/.test(txt)) key = 'ia';
    else if (/cybersécurité|cyber|hack|sécurit|malware/.test(txt))                                  key = 'cyber';
    else if (/cloud|data.?center|serveur|stockage/.test(txt))                                       key = 'cloud';
    else if (/startup|entrepreneur|incubateur|accélérateur/.test(txt))                              key = 'startup';
    else if (/smartphone|mobile|android|ios|iphone|tablette/.test(txt))                             key = 'mobile';
    else if (/5g|4g|fibre|antenne|réseau|télécom|ooredoo|djezzy|mobilis/.test(txt))                key = 'telecoms';
    const pool = POOL[key];
    return U + pool[Math.floor(Math.random() * pool.length)] + P;
}

// Correction de la fonction submitArticle
window.submitArticle = async function(e) {
    if (e) e.preventDefault();
    try {
        const formData = new FormData();
        formData.append('titre',     document.getElementById('titre').value);
        formData.append('categorie', document.getElementById('categorie').value);
        formData.append('date',      document.getElementById('date').value);
        formData.append('heure',     document.getElementById('heure').value);
        formData.append('extrait',   document.getElementById('extrait').value);
        formData.append('tags',      document.getElementById('tags').value);
        formData.append('contenu',   document.getElementById('contenu').value);
        formData.append('video',     document.getElementById('video').value);
        formData.append('source',    document.getElementById('sourceUrl')?.value || '');
        formData.append('position',  document.getElementById('position')?.value || '');
        formData.append('type',      document.getElementById('isBreve')?.checked ? 'breve' : '');

        // Correction: AccÃ¨s sÃ©curisÃ© aux fichiers pour Ã©viter les crashes si l'input est manquant
        const imgInput = document.getElementById('image');
        if (imgInput && imgInput.files.length > 0) {
            formData.append('image', imgInput.files[0]);
        } else if (!currentEditingId) {
            formData.append('existingImage', getAutoImage(
                document.getElementById('titre').value || '',
                document.getElementById('tags').value  || '',
                document.getElementById('categorie').value || ''
            ));
        }

        const pdfInput = document.getElementById('pdfFile');
        if (pdfInput && pdfInput.files.length > 0) {
            formData.append('pdf', pdfInput.files[0]);
        }

        if (currentEditingId) {
            const art = findArticleById(currentEditingId);
            if (art) { // Correction: vÃ©rification que l'article existe
                formData.append('existingImage', art.image);
                if (art.pdf) formData.append('existingPdf', art.pdf);
                formData.append('id', currentEditingId);
            }
        }

        showToast('â ³ Envoi au serveur...');
        const response = await fetch(`${API_BASE}/api/create-article`, { method: 'POST', body: formData });
        if (response.ok) {
            showToast('âœ… Article enregistrÃ© !');
            invalidateArticlesCache();
            setTimeout(() => window.location.reload(), 2000);
        } else {
            const errText = await response.text();
            showToast('â Œ Erreur serveur: ' + errText);
        }
    } catch (error) {
        console.error("Erreur submitArticle:", error);
        showToast('â Œ Erreur: ' + error.message);
    }
};

async function deleteArticle() {
    if (!confirm("âš ï¸  Supprimer dÃ©finitivement cet article ?  ")) return;
    try {
        showToast('â ³ Suppression...');
        const response = await fetch(`${API_BASE}/api/delete-article/${currentEditingId}`, { method: 'DELETE' });
        if (response.ok) { showToast('âœ… SupprimÃ© !'); invalidateArticlesCache(); setTimeout(() => window.location.reload(), 2000); }
    } catch (e) { showToast('â Œ Erreur rÃ©seau'); }
}

window.previewImage = function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => { document.getElementById('imagePreview').innerHTML = `<p style="font-size:0.8rem;margin-bottom:5px;">Nouvelle image:</p><img src="${ev.target.result}" style="max-width:100%; border-radius:8px;">`; };
        reader.readAsDataURL(file);
    }
};

window.share = (p) => {
    const u = encodeURIComponent(window.location.href); const t = encodeURIComponent(document.title);
    const urls = { facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`, twitter: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, whatsapp: `https://wa.me/?text=${t}%20${u}`, linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` };
    if(urls[p]) window.open(urls[p], '_blank');
};

window.copyLink = () => { navigator.clipboard.writeText(window.location.href); showToast('Lien copiÃ© !'); };

// ===== METEO =====
const WMO_FR = {
    0:'Ciel degage', 1:'Principalement degage', 2:'Partiellement nuageux', 3:'Couvert',
    45:'Brouillard', 48:'Brouillard givrant',
    51:'Bruine legere', 53:'Bruine moderee', 55:'Bruine dense',
    61:'Pluie legere', 63:'Pluie moderee', 65:'Pluie forte',
    71:'Neige legere', 73:'Neige moderee', 75:'Neige forte', 77:'Grains de neige',
    80:'Averses legeres', 81:'Averses moderees', 82:'Averses violentes',
    85:'Averses de neige', 86:'Averses de neige fortes',
    95:'Orage', 96:'Orage avec grele', 99:'Orage avec forte grele'
};
function _wxIcon(code) {
    if (code === 0)  return { i:'fa-sun',                 c:'#fbbf24' };
    if (code <= 2)   return { i:'fa-cloud-sun',           c:'#f59e0b' };
    if (code <= 3)   return { i:'fa-cloud',               c:'#94a3b8' };
    if (code <= 48)  return { i:'fa-smog',                c:'#64748b' };
    if (code <= 67)  return { i:'fa-cloud-rain',          c:'#60a5fa' };
    if (code <= 77)  return { i:'fa-snowflake',           c:'#bae6fd' };
    if (code <= 82)  return { i:'fa-cloud-showers-heavy', c:'#2563eb' };
    return                  { i:'fa-bolt',                c:'#ef4444' };
}
function _wxDir(deg) {
    return ['N','NE','E','SE','S','SO','O','NO'][Math.round((deg ?? 0) / 45) % 8];
}
function _uvLabel(uv) {
    if (uv <= 2) return { label:'Faible',     color:'#22c55e' };
    if (uv <= 5) return { label:'Modere',     color:'#f59e0b' };
    if (uv <= 7) return { label:'Eleve',      color:'#f97316' };
    return              { label:'Tres eleve', color:'#ef4444' };
}

// 58 wilayas — coordonnees chef-lieu
const WILAYAS = [
  { n: 1, name:'Adrar',               lat:27.8744, lon:-0.2853 },
  { n: 2, name:'Chlef',               lat:36.1650, lon: 1.3317 },
  { n: 3, name:'Laghouat',            lat:33.8000, lon: 2.8650 },
  { n: 4, name:'Oum El Bouaghi',      lat:35.8714, lon: 7.1131 },
  { n: 5, name:'Batna',               lat:35.5569, lon: 6.1741 },
  { n: 6, name:'Bejaia',              lat:36.7524, lon: 5.0573 },
  { n: 7, name:'Biskra',              lat:34.8500, lon: 5.7317 },
  { n: 8, name:'Bechar',              lat:31.6167, lon:-2.2167 },
  { n: 9, name:'Blida',               lat:36.4703, lon: 2.8277 },
  { n:10, name:'Bouira',              lat:36.3733, lon: 3.9011 },
  { n:11, name:'Tamanrasset',         lat:22.7850, lon: 5.5228 },
  { n:12, name:'Tebessa',             lat:35.4044, lon: 8.1244 },
  { n:13, name:'Tlemcen',             lat:34.8783, lon:-1.3150 },
  { n:14, name:'Tiaret',              lat:35.3706, lon: 1.3217 },
  { n:15, name:'Tizi Ouzou',          lat:36.7167, lon: 4.0500 },
  { n:16, name:'Alger',               lat:36.7525, lon: 3.0420 },
  { n:17, name:'Djelfa',              lat:34.6733, lon: 3.2636 },
  { n:18, name:'Jijel',               lat:36.8186, lon: 5.7658 },
  { n:19, name:'Setif',               lat:36.1897, lon: 5.4033 },
  { n:20, name:'Saida',               lat:34.8297, lon: 0.1525 },
  { n:21, name:'Skikda',              lat:36.8760, lon: 6.9078 },
  { n:22, name:'Sidi Bel Abbes',      lat:35.1897, lon:-0.6302 },
  { n:23, name:'Annaba',              lat:36.9000, lon: 7.7667 },
  { n:24, name:'Guelma',              lat:36.4628, lon: 7.4319 },
  { n:25, name:'Constantine',         lat:36.3650, lon: 6.6147 },
  { n:26, name:'Medea',               lat:36.2639, lon: 2.7539 },
  { n:27, name:'Mostaganem',          lat:35.9311, lon: 0.0886 },
  { n:28, name:"M'Sila",              lat:35.7053, lon: 4.5458 },
  { n:29, name:'Mascara',             lat:35.3961, lon: 0.1400 },
  { n:30, name:'Ouargla',             lat:31.9522, lon: 5.3248 },
  { n:31, name:'Oran',                lat:35.6969, lon:-0.6331 },
  { n:32, name:'El Bayadh',           lat:33.6836, lon: 1.0086 },
  { n:33, name:'Illizi',              lat:26.5092, lon: 8.4748 },
  { n:34, name:'Bordj Bou Arreridj',  lat:36.0731, lon: 4.7631 },
  { n:35, name:'Boumerdes',           lat:36.7669, lon: 3.4772 },
  { n:36, name:'El Tarf',             lat:36.7680, lon: 8.3130 },
  { n:37, name:'Tindouf',             lat:27.6742, lon:-8.1373 },
  { n:38, name:'Tissemsilt',          lat:35.6064, lon: 1.8128 },
  { n:39, name:'El Oued',             lat:33.3678, lon: 6.8533 },
  { n:40, name:'Khenchela',           lat:35.4361, lon: 7.1436 },
  { n:41, name:'Souk Ahras',          lat:36.2864, lon: 7.9508 },
  { n:42, name:'Tipaza',              lat:36.5894, lon: 2.4472 },
  { n:43, name:'Mila',                lat:36.4500, lon: 6.2656 },
  { n:44, name:'Ain Defla',           lat:36.2644, lon: 1.9681 },
  { n:45, name:'Naama',               lat:33.2678, lon:-0.3119 },
  { n:46, name:'Ain Temouchent',      lat:35.2983, lon:-1.1400 },
  { n:47, name:'Ghardaia',            lat:32.4908, lon: 3.6736 },
  { n:48, name:'Relizane',            lat:35.7378, lon: 0.5561 },
  { n:49, name:'Timimoune',           lat:29.2636, lon: 0.2408 },
  { n:50, name:'Bordj Badji Mokhtar', lat:21.3299, lon: 0.9564 },
  { n:51, name:'Ouled Djellal',       lat:34.4178, lon: 5.0722 },
  { n:52, name:'Beni Abbes',          lat:30.1261, lon:-2.1606 },
  { n:53, name:'In Salah',            lat:27.1886, lon: 2.4740 },
  { n:54, name:'In Guezzam',          lat:19.5681, lon: 5.7717 },
  { n:55, name:'Touggourt',           lat:33.1078, lon: 6.0706 },
  { n:56, name:'Djanet',              lat:24.5567, lon: 9.4839 },
  { n:57, name:"El M'Ghair",          lat:33.9481, lon: 5.9308 },
  { n:58, name:'El Menia',            lat:30.5703, lon: 2.8794 },
];

let _wxWilData = null;
let _wxWilTs   = 0;
const WX_WIL_TTL = 30 * 60 * 1000;
let _wxSelIdx = 15; // Alger = index 15

function _buildWcDetail(cityName, d) {
    const c = d.current;
    const temp  = Math.round(c.temperature_2m);
    const feels = Math.round(c.apparent_temperature);
    const code  = c.weather_code;
    const ic    = _wxIcon(code);
    const icon  = ic.i; const color = ic.c;
    const desc  = WMO_FR[code] || '';
    const dir   = _wxDir(c.wind_direction_10m);
    const wind  = Math.round(c.wind_speed_10m);
    const cloud = c.cloud_cover != null ? Math.round(c.cloud_cover) : null;
    const uv    = c.uv_index   != null ? Math.round(c.uv_index)    : null;
    const uvInf = uv != null ? _uvLabel(uv) : null;
    const now   = new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const DAY_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const days  = d.daily;
    let weekHtml = '<div class="wc-week">';
    for (let k = 0; k < Math.min(7, days && days.time ? days.time.length : 0); k++) {
        const dd = new Date(days.time[k]);
        const dn = k === 0 ? 'Auj.' : DAY_FR[dd.getDay()];
        const di = _wxIcon(days.weather_code[k]);
        weekHtml +=
            '<div class="wc-day">' +
                '<span class="wc-day-name">' + dn + '</span>' +
                '<i class="fas ' + di.i + '" style="color:' + di.c + '"></i>' +
                '<span class="wc-day-max">' + Math.round(days.temperature_2m_max[k]) + '&#176;</span>' +
                '<span class="wc-day-min">' + Math.round(days.temperature_2m_min[k]) + '&#176;</span>' +
            '</div>';
    }
    weekHtml += '</div>';
    const uvRow   = uvInf
        ? '<div class="wc-item"><i class="fas fa-sun" style="color:' + uvInf.color + '"></i><span>UV</span><b style="color:' + uvInf.color + '">' + uv + '</b></div>' +
          '<div class="wc-item"><i class="fas fa-circle" style="color:' + uvInf.color + ';font-size:.45rem"></i><span>Niveau</span><b style="color:' + uvInf.color + '">' + uvInf.label + '</b></div>'
        : '';
    const cloudRow = cloud != null
        ? '<div class="wc-item"><i class="fas fa-cloud"></i><span>Nuages</span><b>' + cloud + '%</b></div>'
        : '';
    return (
        '<div class="wc-header">' +
            '<span><i class="fas fa-map-marker-alt"></i>&nbsp;' + cityName + ', Algerie</span>' +
            '<span class="wc-time">&#8635;&nbsp;' + now + '</span>' +
        '</div>' +
        '<div class="wc-body">' +
            '<div class="wc-main">' +
                '<i class="fas ' + icon + ' wc-main-icon" style="color:' + color + '"></i>' +
                '<div class="wc-main-temp">' + temp + '<span class="wc-unit">&#176;C</span></div>' +
                '<div class="wc-desc">' + desc + '</div>' +
            '</div>' +
            '<div class="wc-grid">' +
                '<div class="wc-item"><i class="fas fa-thermometer-half"></i><span>Ressenti</span><b>' + feels + '&#176;C</b></div>' +
                '<div class="wc-item"><i class="fas fa-tint"></i><span>Humidite</span><b>' + c.relative_humidity_2m + '%</b></div>' +
                cloudRow +
                '<div class="wc-item"><i class="fas fa-wind"></i><span>Vent ' + dir + '</span><b>' + wind + ' km/h</b></div>' +
                uvRow +
            '</div>' +
            weekHtml +
            '<a href="https://www.meteo.dz/" target="_blank" rel="noopener" class="wc-link">Meteo complete &mdash; meteo.dz &#8594;</a>' +
        '</div>'
    );
}

function _renderWilList(filter) {
    const list = document.getElementById('wcWilList');
    if (!list) return;
    const raw = filter !== undefined ? filter : (document.getElementById('wcSearch') ? document.getElementById('wcSearch').value : '');
    const q = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let html = '';
    WILAYAS.forEach(function(w, i) {
        const wNorm = w.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (q && !wNorm.includes(q)) return;
        const wx = _wxWilData ? _wxWilData[i] : null;
        const tempStr  = wx ? (wx.temp + '&#176;') : '&#8230;';
        const iconHtml = wx
            ? '<i class="fas ' + _wxIcon(wx.code).i + '" style="color:' + _wxIcon(wx.code).c + ';font-size:0.73rem"></i>'
            : '<i class="fas fa-circle-notch fa-spin" style="color:#ccc;font-size:0.6rem"></i>';
        html +=
            '<div class="wc-wil-item' + (i === _wxSelIdx ? ' active' : '') + '" data-idx="' + i + '" onclick="window._wxSelect(' + i + ')">' +
                '<span class="wc-wil-num">' + (w.n < 10 ? '0' : '') + w.n + '</span>' +
                '<span class="wc-wil-name">' + w.name + '</span>' +
                iconHtml +
                '<b class="wc-wil-temp">' + tempStr + '</b>' +
            '</div>';
    });
    list.innerHTML = html || '<div class="wc-wil-empty">Aucune wilaya</div>';
}

async function _wxLoadAll() {
    if (_wxWilData && Date.now() - _wxWilTs < WX_WIL_TTL) { _renderWilList(); return; }
    const BASE = 'https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code&timezone=Africa%2FAlgiers';
    const results = await Promise.allSettled(
        WILAYAS.map(function(w) {
            return fetch(BASE + '&latitude=' + w.lat + '&longitude=' + w.lon).then(function(r) { return r.json(); });
        })
    );
    _wxWilData = results.map(function(r) {
        return r.status === 'fulfilled'
            ? { temp: Math.round(r.value.current.temperature_2m), code: r.value.current.weather_code }
            : null;
    });
    _wxWilTs = Date.now();
    _renderWilList();
}

window._wxSelect = async function(idx) {
    _wxSelIdx = idx;
    document.querySelectorAll('.wc-wil-item').forEach(function(el) {
        el.classList.toggle('active', +el.dataset.idx === idx);
    });
    const left = document.getElementById('wcLeft');
    if (!left) return;
    left.innerHTML = '<div class="wc-loading"><i class="fas fa-circle-notch fa-spin"></i></div>';
    try {
        const w   = WILAYAS[idx];
        const res = await fetch(
            'https://api.open-meteo.com/v1/forecast' +
            '?latitude=' + w.lat + '&longitude=' + w.lon +
            '&current=temperature_2m,apparent_temperature,relative_humidity_2m,' +
            'weather_code,wind_speed_10m,wind_direction_10m,uv_index,cloud_cover' +
            '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
            '&timezone=Africa%2FAlgiers'
        );
        const d = await res.json();
        left.innerHTML = _buildWcDetail(w.name, d);
    } catch(e) {
        left.innerHTML = '<div class="wc-error"><i class="fas fa-exclamation-triangle"></i> Erreur reseau</div>';
    }
};

function _buildInitialWilHtml() {
    return WILAYAS.map(function(w, i) {
        return '<div class="wc-wil-item' + (i === 15 ? ' active' : '') + '" data-idx="' + i + '" onclick="window._wxSelect(' + i + ')">' +
            '<span class="wc-wil-num">' + (w.n < 10 ? '0' : '') + w.n + '</span>' +
            '<span class="wc-wil-name">' + w.name + '</span>' +
            '<i class="fas fa-circle-notch fa-spin" style="color:#ccc;font-size:0.6rem"></i>' +
            '<b class="wc-wil-temp">&#8230;</b>' +
        '</div>';
    }).join('');
}

async function updateWeather() {
    const widget = document.getElementById('weatherWidget');
    const card   = document.getElementById('weatherCard');
    if (!widget) return;
    widget.classList.add('updating');
    try {
        const res = await fetch(
            'https://api.open-meteo.com/v1/forecast' +
            '?latitude=36.7525&longitude=3.04197' +
            '&current=temperature_2m,apparent_temperature,relative_humidity_2m,' +
            'weather_code,wind_speed_10m,wind_direction_10m,uv_index,cloud_cover' +
            '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
            '&timezone=Africa%2FAlgiers'
        );
        const d    = await res.json();
        const temp = Math.round(d.current.temperature_2m);
        const ic   = _wxIcon(d.current.weather_code);

        widget.innerHTML = '<i class="fas ' + ic.i + '" style="color:' + ic.c + ';margin-right:4px;"></i><b>' + temp + '&#176;C</b>';

        if (card) {
            card.innerHTML =
                '<div class="wc-layout">' +
                    '<div class="wc-left" id="wcLeft">' + _buildWcDetail('Alger', d) + '</div>' +
                    '<div class="wc-right">' +
                        '<div class="wc-right-hd"><i class="fas fa-map-marked-alt"></i>&nbsp;58 Wilayas</div>' +
                        '<div class="wc-search-wrap">' +
                            '<i class="fas fa-search wc-search-ico"></i>' +
                            '<input class="wc-search" id="wcSearch" placeholder="Filtrer une wilaya..." oninput="_renderWilList(this.value)">' +
                        '</div>' +
                        '<div class="wc-wil-list" id="wcWilList">' + _buildInitialWilHtml() + '</div>' +
                    '</div>' +
                '</div>';
        }
    } catch(e) {
        widget.innerHTML = '<i class="fas fa-sun" style="color:#fbbf24;margin-right:4px;"></i><b>--&#176;C</b>';
        if (card) card.innerHTML =
            '<div class="wc-header" style="justify-content:center">' +
                '<i class="fas fa-exclamation-triangle" style="color:#ef4444;margin-right:6px"></i>' +
                'Meteo indisponible' +
            '</div>';
    } finally {
        widget.classList.remove('updating');
    }
}

// Charge les wilayas au premier survol du widget
(function() {
    var _loaded = false;
    function _attach() {
        var wrap = document.querySelector('.weather-wrap');
        if (!wrap) return;
        wrap.addEventListener('mouseenter', function() {
            if (!_loaded) { _loaded = true; _wxLoadAll(); }
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _attach);
    } else {
        _attach();
    }
})();

// Rafraichissement automatique toutes les 10 minutes
setInterval(updateWeather, 10 * 60 * 1000);

// ===== BARRE DE RECHERCHE =====
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        if (isResetting) return;
        const query = e.target.value.toLowerCase().trim();
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('articlePage').style.display = 'none';
        document.getElementById('veilleSection').style.display = 'none';
        document.getElementById('revueSection').style.display = 'none';
        document.getElementById('heroSection').classList.add('hidden');
        if (query === '') { goHome(); } else {
            currentPage = 1;
            // Résultats immédiats (titre/extrait/tags — données déjà en mémoire)
            const nq = _atNorm(query);
            const filtered = allArticles.filter(a => _atNorm(a.titre).includes(nq) || _atNorm(a.extrait).includes(nq) || (a.tags && a.tags.some(t => _atNorm(t).includes(nq))));
            renderGrid(filtered.slice(0, ITEMS_PER_PAGE));
            renderPagination(filtered);
            // Puis recherche plein-texte (corps + brèves) une fois articles.json chargé
            if (typeof window.atVoiceSearch === 'function' && query.length >= 2) {
                window.atVoiceSearch(query, () => searchInput.value.toLowerCase().trim() !== query).catch(() => {});
            }
        }
    });
}

// ══════════════════════════════════════════════════════════════════════
// RECHERCHE PLEIN-TEXTE (corps d'article + brèves) — pour l'assistant vocal
// Charge articles.json (lourd, avec rawContent) à la demande, une seule fois.
// ══════════════════════════════════════════════════════════════════════
let _atFtPool = null;
const _atNorm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function _atShowGridView() {
    const el = id => document.getElementById(id);
    if (el('mainContent'))   el('mainContent').style.display = 'block';
    if (el('articlePage'))   el('articlePage').style.display = 'none';
    if (el('veilleSection')) el('veilleSection').style.display = 'none';
    if (el('revueSection'))  el('revueSection').style.display = 'none';
    if (el('heroSection'))   el('heroSection').classList.add('hidden');
    currentPage = 1;
}
window.atVoiceSearch = async function (rawQuery, isStale) {
    const q = _atNorm(rawQuery).trim();
    if (q.length < 2) return 0;
    if (!_atFtPool) {
        try { const r = await fetch('/articles.json', { cache: 'force-cache' }); _atFtPool = await r.json(); }
        catch (e) { _atFtPool = allArticles.concat(breveArticles); }
    }
    if (typeof isStale === 'function' && isStale()) return -1; // l'utilisateur a retapé : on n'écrase pas
    const hits = _atFtPool.filter(a =>
        _atNorm(a.titre).includes(q) ||
        _atNorm(a.extrait).includes(q) ||
        _atNorm(a.rawContent || a.contenu).includes(q) ||
        (a.tags && a.tags.some(t => _atNorm(t).includes(q)))
    );
    // Rendre chaque résultat ouvrable (openArticle → findArticleById) même les brèves/communiqués
    hits.forEach(h => { h.views = h.views || 0; if (!findArticleById(h.id)) breveArticles.push(h); });
    _atShowGridView();
    renderGrid(hits.slice(0, ITEMS_PER_PAGE));
    renderPagination(hits);
    return hits.length;
};
// Affiche toutes les brèves dans la grille principale
window.atShowBreves = function () {
    _atShowGridView();
    renderGrid(breveArticles.slice(0, ITEMS_PER_PAGE));
    renderPagination(breveArticles);
    return breveArticles.length;
};

// ==========================================
// [VEILLE] LOGIQUE FRONTEND
// ==========================================
let veilleData     = { manual: [], feed: [] };
let vCurrentFlux   = 'algerie';
let vCurrentTopic  = 'all';
let vShown         = 15;
const V_PAGE_SIZE  = 15;
let vCurrentItems  = [];

// Source → flux classification
const V_ALGERIE_KW = ['tsa-algerie','lesenjeuxeco','algerie360','aps.dz','itmag','dz-tech','android-dz','ntic-dz','indjazat','algerie-eco','ecomnews','elmoudjahid','lesoirdalgerie','elwatan','algerietelecom'];
const V_FRANCO_KW  = ['frenchweb','lemondeinformatique','journaldunet','usine-digitale','rfi.fr','01net','numerama','clubic'];
const V_COLORS     = ['#006233','#D21034','#0891b2','#7c3aed','#ea580c','#059669','#dc2626','#4f46e5','#d97706','#be185d'];

function classifyVeilleItem(item) {
    if (item.isManual) return 'manuel';
    const combined = ((item.url || '') + ' ' + (item.source || '')).toLowerCase();
    const tags     = (item.tags || []).map(t => t.toLowerCase());
    if (tags.includes('algérie') || tags.includes('algerie')) return 'algerie';
    if (combined.includes('.dz') || V_ALGERIE_KW.some(k => combined.includes(k))) return 'algerie';
    if (V_FRANCO_KW.some(k => combined.includes(k))) return 'francophone';
    return 'tic';
}

function detectVeilleTopic(title) {
    const t = (title || '').toLowerCase();
    // 1. Infrastructures et Réseaux
    if (/t[eé]l[eé]com|fibre|ftth|ftto|ftta|satellite|antenne.?relais|\bbts\b|\bidoom\b|boucle.?locale|\badsl\b|\bdslam\b|datacenter|data.?center|backbone|\bpon\b|\bvsat\b|infrastructure.?r[eé]seau|interconnexion|small.?cell|\bnfv\b|\bsdn\b|virtualisation|câble.?sous.?marin/.test(t))
        return 'Infrastructures & Réseaux';
    // 2. Opérateurs et Services Mobiles
    if (/\bdjezzy\b|\booredoo\b|\bmobilis\b|\b[2345]g\b|\blte\b|\bvolte\b|t[eé]l[eé]phonie.?mobile|t[eé]l[eé]phonie.?fixe|itin[eé]rance|\broaming\b|\besim\b|\bmvno\b|\bmnp\b|portabilit[eé]|\bran\b|d[eé]ploiement.?r[eé]seau|\bqos\b|qualit[eé].?de.?service|r[eé]seaux.?priv[eé]s|\bmpn\b|\bgsm\b|\bvoip\b|op[eé]rateur|\bsmartphone\b|android|iphone|tablette|samsung|xiaomi/.test(t))
        return 'Opérateurs & Mobile';
    // 3. Internet, Web et Communication
    if (/\binternet\b|haut.?d[eé]bit|tr[eè]s.?haut.?d[eé]bit|\bbroadband\b|\bdns\b|messagerie.?instantan|visioconf[eé]rence|\bstreaming\b|\bsaas\b|\bpaas\b|internet.?des.?objets|\biot\b|web.?3|bande.?passante|\blatence\b|\bipv6\b|h[eé]bergement.?web|\bcdn\b|plateforme.?num[eé]rique|trafic.?internet|wi-fi|\bwifi\b|\bvdsl\b/.test(t))
        return 'Internet & Web';
    // 4. Data, Cybersécurité et Intelligence
    if (/cybers[eé]curit|s[eé]curit[eé].?informatique|\bhack\b|\bphishing\b|\bmalware\b|\bransomware\b|chiffrement|\bvpn\b|pare.?feu|\bfirewall\b|\bddos\b|\bpentest\b|\bsoc\b|zero.?trust|\brgpd\b|cryptographie|\bmfa\b|\b2fa\b|cloud.?souverain|souverainet[eé].?num[eé]rique|\bdata\b|big.?data|donn[eé]es|analytique|m[eé]tadonn|analyse.?pr[eé]dictive/.test(t))
        return 'Data & Cybersécurité';
    // 5. Innovation, Recherche et Prospective
    if (/\bstartup\b|\binnovation\b|\br&d\b|lev[eé]e|incubat|pitch|scale.?up|transfert.?technologique|num[eé]risation|digitalisation|transformation.?num[eé]rique|[eé]cosyst[eè]me.?num[eé]rique|\bfintech\b|\bedtech\b|intelligence.?artificielle|\bia\b|\bai\b|machine.?learning|deep.?learning|\bgpt\b|\bchatgpt\b|\bllm\b|\bdeeptech\b|\bhackathon\b|\bfablab\b|\bblockchain\b|smart.?city|ville.?intelligente|gouvernance.?num[eé]rique|transformation.?digitale/.test(t))
        return 'Innovation & Recherche';
    // Termes transversaux
    if (/\bnum[eé]rique\b|\bdigital\b|\btech\b|\binformatique\b|\blogiciel\b|\barpce\b|service.?universel|\bmodem\b|\brouteur\b|objets.?connect|interop[eé]rabilit|fracture.?num[eé]rique|inclusion.?num[eé]rique|droit.?du.?num[eé]rique|litiges.?t[eé]l[eé]com|\bntic\b/.test(t))
        return 'Tech & Numérique';
    return 'Tech';
}

function veilleRelDate(ds) {
    try {
        const m = Math.floor((Date.now() - new Date(ds)) / 60000);
        if (m < 2)  return "À l'instant";
        if (m < 60) return `il y a ${m} min`;
        const h = Math.floor(m / 60);
        if (h < 24) return `il y a ${h}h`;
        const d = Math.floor(h / 24);
        if (d < 7)  return `il y a ${d}j`;
        return new Date(ds).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
    } catch { return ''; }
}

function vAvatarInitials(src) {
    const clean = (src || 'XX').replace(/\.(fr|dz|com|net|org|news|info)$/i,'').replace(/[^a-zA-ZÀ-ÿ]/g,' ').trim();
    const w = clean.split(/\s+/).filter(Boolean);
    return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : clean.substring(0,2).toUpperCase();
}

function vAvatarColor(src) {
    let h = 0;
    for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
    return V_COLORS[Math.abs(h) % V_COLORS.length];
}

function buildVeilleCard(item, flux) {
    const topic   = detectVeilleTopic(item.title);
    const relD    = veilleRelDate(item.date);
    const initials = vAvatarInitials(item.source);
    const color   = vAvatarColor(item.source || '');
    const cls     = `v2-card--${flux === 'algerie' ? 'dz' : flux === 'francophone' ? 'fr' : flux === 'tic' ? 'tic' : 'manuel'}`;
    const isNew   = item.fetchedAt && (Date.now() - new Date(item.fetchedAt).getTime() < 24 * 60 * 60 * 1000);
    const safeT   = (item.title || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const safeU   = (item.url   || '').replace(/"/g,'&quot;');
    const acts    = item.isManual
        ? `<button class="v2-act-btn v2-edit"   onclick="openVeilleModal('edit','${item.id}')"><i class="fas fa-pencil-alt"></i></button>
           <button class="v2-act-btn v2-delete" onclick="deleteVeilleArticle('${item.id}')"><i class="fas fa-trash"></i></button>`
        : `<a class="v2-act-btn" href="${safeU}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> Lire</a>`;
    return `<article class="v2-card ${cls}">
  <div class="v2-card-header">
    <div class="v2-card-source">
      <div class="v2-avatar" style="background:${color}">${initials}</div>
      <span class="v2-src-name">${(item.source||'').replace(/</g,'&lt;')}</span>
      ${isNew ? '<span class="v2-new"><i class="fas fa-bolt"></i> Nouveau</span>' : ''}
    </div>
    <span class="v2-badge v2-badge--${topic}">${topic}</span>
  </div>
  <div class="v2-card-title"><a href="${safeU}" target="_blank" rel="noopener noreferrer">${safeT}</a></div>
  <div class="v2-card-footer">
    <span class="v2-card-date"><i class="fas fa-clock"></i> ${relD}</span>
    <div class="v2-card-acts">${acts}</div>
  </div>
</article>`;
}

function updateVeilleKPIs(cls) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const total = cls.algerie.length + cls.francophone.length + cls.tic.length + cls.manuel.length;
    set('vs-total', total);
    set('vs-dz',    cls.algerie.length);
    set('vs-fr',    cls.francophone.length);
    set('vs-tic',   cls.tic.length);
    set('vtc-algerie',     cls.algerie.length);
    set('vtc-francophone', cls.francophone.length);
    set('vtc-tic',         cls.tic.length);
    set('vtc-manuel',      cls.manuel.length);
    if (veilleData.lastUpdated) {
        const el = document.getElementById('vSyncLabel');
        if (el) el.innerHTML = `<i class="fas fa-circle"></i> ${veilleRelDate(veilleData.lastUpdated)}`;
    }
}

async function loadVeille() {
    const loader = document.getElementById('veilleLoading');
    if(loader) loader.style.display = 'block';
    try {
        const veilleUrl = isLocal ? '/api/veille' : ('veille_data.json?t=' + Date.now());
        const res = await fetch(veilleUrl);
        if(!res.ok) throw new Error('Erreur chargement veille');
        veilleData = await res.json();
        renderVeilleTable();
        if(loader) loader.style.display = 'none';
    } catch(e) { console.error(e); if(loader) loader.textContent = 'âš ï¸  Impossible de synchroniser la veille.'; }
}

function renderVeilleTable() {
    const all = [...(veilleData.feed||[]), ...(veilleData.manual||[])].sort((a,b) => new Date(b.date) - new Date(a.date));
    const classified = { algerie:[], francophone:[], tic:[], manuel:[] };
    all.forEach(item => classified[classifyVeilleItem(item)].push(item));
    updateVeilleKPIs(classified);

    const grid  = document.getElementById('veilleCards');
    const empty = document.getElementById('veilleEmpty');
    const more  = document.getElementById('veilleMoreWrap');
    if (!grid) return;

    let items = classified[vCurrentFlux] || [];
    if (vCurrentTopic !== 'all') items = items.filter(i => detectVeilleTopic(i.title) === vCurrentTopic);

    vCurrentItems = items;
    vShown = Math.min(V_PAGE_SIZE, items.length);
    grid.innerHTML = items.slice(0, vShown).map(i => buildVeilleCard(i, vCurrentFlux)).join('');
    if (empty) empty.style.display = vShown === 0 ? 'block' : 'none';
    if (more)  more.style.display  = items.length > vShown ? 'flex' : 'none';
}

window.switchVeilleFlux = function(flux, btn) {
    vCurrentFlux  = flux;
    vCurrentTopic = 'all';
    document.querySelectorAll('.v2-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.v2-pill').forEach(p => p.classList.remove('active'));
    const first = document.querySelector('.v2-pill');
    if (first) first.classList.add('active');
    renderVeilleTable();
};

window.filterVeilleTopic = function(topic, btn) {
    vCurrentTopic = topic;
    document.querySelectorAll('.v2-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderVeilleTable();
};

window.loadMoreVeille = function() {
    const grid = document.getElementById('veilleCards');
    const more = document.getElementById('veilleMoreWrap');
    if (!grid) return;
    const batch = vCurrentItems.slice(vShown, vShown + V_PAGE_SIZE);
    vShown += batch.length;
    grid.innerHTML += batch.map(i => buildVeilleCard(i, vCurrentFlux)).join('');
    if (more) more.style.display = vShown >= vCurrentItems.length ? 'none' : 'flex';
};

window.openVeilleModal = function(mode = 'add', id = null) {
    const modal = document.getElementById('veilleModal');
    const form = document.getElementById('veilleForm');
    const titleEl = document.getElementById('veilleModalTitle');
    modal.classList.add('show');
    form.reset();
    document.getElementById('veilleEditId').value = '';
    if (mode === 'edit' && id) {
        const art = veilleData.manual.find(a => a.id === id);
        if (art) {
            titleEl.innerHTML = '<i class="fas fa-pencil-alt"></i> Modifier l\'article';
            document.getElementById('veilleEditId').value = art.id;
            document.getElementById('veilleTitle').value = art.title;
            document.getElementById('veilleUrl').value = art.url;
            document.getElementById('veilleTags').value = art.tags.join(', ');
        }
    } else {
        titleEl.innerHTML = '<i class="fas fa-plus"></i> Ajouter un article de veille';
    }
};

window.closeVeilleModal = () => document.getElementById('veilleModal').classList.remove('show');

window.handleVeilleSubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('veilleEditId').value;
    const title = document.getElementById('veilleTitle').value;
    const url = document.getElementById('veilleUrl').value;
    const tag = document.getElementById('veilleTags').value;
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `${API_BASE}/api/veille/${id}` : `${API_BASE}/api/veille`;
    try {
        const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, url, tag }) });
        if(res.ok) { showToast(id ? 'âœ… Article modifiÃ© !' : 'âœ… Article ajoutÃ© !'); closeVeilleModal(); loadVeille(); }
    } catch(err) { showToast('â Œ Erreur rÃ©seau'); }
};

window.deleteVeilleArticle = async (id) => {
    if(!confirm('Supprimer dÃ©finitivement cet article ?')) return;
    try {
        const res = await fetch(`${API_BASE}/api/veille/${id}`, { method: 'DELETE' });
        if(res.ok) { showToast('âœ… SupprimÃ© !'); loadVeille(); }
    } catch(e) { showToast('â Œ Erreur'); }
};

// ==========================================
// [YOUTUBE] RÃ‰CUPÃ‰RATION DYNAMIQUE
// ==========================================
async function loadYouTubeVideos() {
    const grid = document.getElementById('newsGrid');
    const hero = document.getElementById('heroSection');
    if(hero) hero.classList.add('hidden');
    if(grid) grid.innerHTML = '<div class="loader">Chargement des vidÃ©os Algeria Tech...</div>';
    try {
        const res = await fetch('/api/youtube');
        const data = await res.json();
        if (data.items && data.items.length > 0) {
            renderYouTubeGrid(data.items);
            document.getElementById('pagination').innerHTML = ''; // Pas de pagination locale pour YouTube
        } else if (data.error) {
             let msg = data.error.message;
            if (data.error.code === 403) {
                msg = "L'accÃ¨s Ã  l'API YouTube est bloquÃ©. VÃ©rifiez que 'YouTube Data API v3' est bien activÃ©e dans votre console Google Cloud.";
            }
            grid.innerHTML = `<p style="text-align:center; padding:20px; color:red;">âš ï¸  ${msg} (Code: ${data.error.code})</p>`;
        } else {
            grid.innerHTML = '<p style="text-align:center; padding:20px;">Aucune vidÃ©o trouvÃ©e sur YouTube.</p>';
        }
    } catch (e) {
        grid.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Erreur de connexion avec YouTube.</p>';
    }
}

function renderYouTubeGrid(videos) {
    const grid = document.getElementById('newsGrid');
    if(!grid) return;
    grid.innerHTML = videos.map((v, i) => {
        const vId = v.id.videoId;
        const title = v.snippet.title;
        const thumb = v.snippet.thumbnails.high.url;
        const date = new Date(v.snippet.publishedAt).toLocaleDateString('fr-FR');
        return `<div class="news-card" style="animation-delay:${i*0.1}s" onclick="playYouTubeVideo('${vId}')">
<div class="news-card-img"><img src="${thumb}" alt="${title}"><span class="category-tag tag-video"><i class="fab fa-youtube"></i> VidÃ©o</span></div>
<div class="news-card-body"><h3>${title}</h3><div class="card-meta"><span><i class="far fa-calendar"></i> ${date}</span><span style="color:var(--primary);margin-left:auto">Regarder <i class="fas fa-play-circle"></i></span></div></div></div>`;
    }).join('');
}

window.playYouTubeVideo = function(vId) {
    let modal = document.getElementById('videoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'videoModal';
        modal.className = 'admin-modal';
        modal.innerHTML = `<div class="modal-content" style="max-width:850px; padding:0; background:#000; position:relative;"><button onclick="document.getElementById('videoModal').classList.remove('show'); document.getElementById('ytPlayer').src='';" style="position:absolute; right:10px; top:10px; z-index:10; background:rgba(0,0,0,0.5); color:#fff; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer;">&times;</button><div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden;"><iframe id="ytPlayer" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div></div>`;
        document.body.appendChild(modal);
    }
    document.getElementById('ytPlayer').src = `https://www.youtube-nocookie.com/embed/${vId}?autoplay=1&rel=0`;
    modal.classList.add('show');
};

setInterval(loadVeille, 60000);

// === REVUE PRESSE — COULEURS CATÉGORIES PAR MUTATION OBSERVER (ajout pur — aucune ligne existante modifiée) ===
(function () {
    const CAT_COLORS = {
        'IA': 'IA', 'Télécoms': 'Télécoms', 'Startups': 'Startups',
        'Innovation': 'Innovation', 'Numérique': 'Numérique',
        'Cybersécurité': 'Cybersécurité', 'Réseaux': 'Réseaux'
    };
    function paintCategories() {
        document.querySelectorAll('.revue-card:not([data-cat-ok])').forEach(function (card) {
            var tag = card.querySelector('.revue-card-tag');
            if (!tag) return;
            var cat = tag.textContent.trim();
            if (CAT_COLORS[cat]) {
                tag.setAttribute('data-cat', cat);
                card.setAttribute('data-cat-ok', '1');
            }
        });
    }
    var revueEl = document.getElementById('revueContent');
    if (revueEl) {
        new MutationObserver(paintCategories).observe(revueEl, { childList: true, subtree: true });
    }
})();
// === FIN AJOUT REVUE PRESSE ===

// (ancien override supprimé — renderRevueCards défini à la ligne ~390)

/* ══════════════════════════════════════════════════════════════
   SYNTHÈSE IA — Résumé en points clés via Mistral
══════════════════════════════════════════════════════════════ */
function _renderSynthese(box, data, isAr) {
    const points = (data.points || []).filter(Boolean);
    if (!points.length) return;
    const n = points.length;
    const intro = isAr
        ? `إليك ملخص هذا المقال في ${n} نقاط`
        : `Voici la synthèse de cet article en ${n} point${n > 1 ? 's' : ''}`;
    const dir = isAr ? 'rtl' : 'ltr';
    box.innerHTML = `
<div class="synthese-inner" dir="${dir}">
  <div class="synthese-header">
    <i class="fas fa-bolt"></i>
    <span>${intro}</span>
    <span class="synthese-ia-badge">IA</span>
  </div>
  <ul class="synthese-list">
    ${points.map(p => `<li>${p}</li>`).join('')}
  </ul>
</div>`;
    box.classList.add('synthese-visible');
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.loadSynthese = async function () {
    const btn = document.getElementById('syntheseBtn');
    const box = document.getElementById('syntheseBox');
    if (!btn || !box || btn.dataset.loading) return;

    const art = findArticleById(currentEditingId);
    if (!art) return;
    await ensureRawContent(art); // corps chargé à la demande (liste allégée)

    const isAr = document.documentElement.classList.contains('ar');

    // État chargement
    btn.dataset.loading = '1';
    const origLabel = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Génération en cours…';
    btn.disabled = true;
    box.classList.remove('synthese-visible');
    box.innerHTML = '';

    try {
        const r = await fetch(`${API_BASE}/api/synthese`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                titre:   art.titre   || '',
                contenu: art.rawContent || art.extrait || '',
                lang:    isAr ? 'ar' : 'fr'
            }),
            signal: AbortSignal.timeout(25000)
        });

        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (data.error) throw new Error(data.error);

        _renderSynthese(box, data, isAr);

    } catch (e) {
        const msg = isAr ? 'خطأ — أعد المحاولة' : 'Erreur — réessayez';
        box.innerHTML = `<div class="synthese-inner"><p class="synthese-error">${msg}</p></div>`;
        box.classList.add('synthese-visible');
        setTimeout(() => { box.classList.remove('synthese-visible'); box.innerHTML = ''; }, 4000);
    } finally {
        delete btn.dataset.loading;
        btn.disabled = false;
        btn.innerHTML = origLabel;
    }
};

/* ══════════════════════════════════════════════════════════════
   ROUTEUR SPA — History API
   ─────────────────────────────────────────────────────────────
   Routes gérées :
     /                → goHome()
     /?cat=Algérie    → filterByCategory('Algérie')
     /article/:id     → openArticle(id)
     /veille          → showVeille()
     /revue           → showRevue()
   Les pages standalone (/actualites-tic, /barometre…) sont de
   vraies pages HTML servies directement par Cloudflare Pages.
══════════════════════════════════════════════════════════════ */
function applyRoute(pathname, search, push) {
    _skipPush = !push;
    try {
        const params = new URLSearchParams(search || '');
        const parts  = pathname.replace(/^\/+/, '').split('/').filter(Boolean);

        if (parts.length === 0) {
            // / ou /?cat=xxx
            const cat = params.get('cat');
            if (cat) filterByCategory(decodeURIComponent(cat));
            else     goHome();

        } else if (parts[0] === 'article' && parts[1]) {
            const id = parts[1];
            if (allArticles.length > 0) {
                openArticle(id);
            } else {
                // Articles pas encore chargés → route différée
                _pendingRoute = { pathname, search };
            }

        } else if (parts[0] === 'veille') {
            showVeille();

        } else if (parts[0] === 'revue') {
            showRevue();

        } else if (parts[0] === 'comparateur') {
            showComparateur();

        } else if (parts[0] === 'reglementaire') {
            showReglementaire();

        } else {
            // Route inconnue → accueil
            goHome();
        }
    } finally {
        _skipPush = false;
    }
}

function initRouter() {
    // Bouton Précédent / Suivant du navigateur
    window.addEventListener('popstate', () => {
        applyRoute(location.pathname, location.search, false);
    });
    // Résolution de l'URL initiale (accès direct, F5, partage de lien…)
    applyRoute(location.pathname, location.search, false);
}

// Démarrage du routeur après DOMContentLoaded
document.addEventListener('DOMContentLoaded', initRouter);

// ══════════════════════════════════════════════════════════════
//  PLATFORM HUB — Centre de Commandement du Numérique Algérien
// ══════════════════════════════════════════════════════════════

const HUB_MODULES = [
    {
        id: 'veille',
        name: 'Veille Intelligence',
        desc: 'Monitoring temps réel des sources numériques algériennes',
        icon: 'fas fa-satellite-dish',
        color: '#4a9eff',
        glow: 'rgba(74,158,255,0.18)',
        action: 'showVeille()',
        live: true,
        countId: 'vs-total',
        unit: 'articles'
    },
    {
        id: 'observatoire',
        name: 'Observatoire du Numérique',
        desc: 'Données et tendances du marché télécom algérien',
        icon: 'fas fa-chart-line',
        color: '#a78bfa',
        glow: 'rgba(167,139,250,0.18)',
        action: "window.location.href='/barometre'",
        live: false,
        staticCount: null,
        unit: 'indicateurs'
    },
    {
        id: 'revue',
        name: 'Revue de Presse',
        desc: 'Synthèse quotidienne de la presse algérienne et internationale',
        icon: 'fas fa-newspaper',
        color: '#4ade80',
        glow: 'rgba(74,222,128,0.18)',
        action: 'showRevue()',
        live: false,
        staticCount: null,
        unit: 'revues'
    },
    {
        id: 'comparateur',
        name: 'Comparateur Mobile',
        desc: 'Comparez les offres des 3 opérateurs en temps réel',
        icon: 'fas fa-balance-scale',
        color: '#fb923c',
        glow: 'rgba(251,146,60,0.18)',
        action: 'showComparateur()',
        live: false,
        staticCount: '3',
        unit: 'opérateurs'
    },
    {
        id: 'infographies',
        name: 'Infographies',
        desc: 'Visualisations de données du secteur numérique algérien',
        icon: 'fas fa-chart-pie',
        color: '#f87171',
        glow: 'rgba(248,113,113,0.18)',
        action: "window.location.href='/infographies/index.html'",
        live: false,
        staticCount: null,
        unit: 'infographies'
    },
    {
        id: 'operateurs',
        name: 'Opérateurs Mobiles',
        desc: 'Profils, couverture et offres des opérateurs en Algérie',
        icon: 'fas fa-signal',
        color: '#34d399',
        glow: 'rgba(52,211,153,0.18)',
        action: "window.location.href='/operateurs'",
        live: false,
        staticCount: '3',
        unit: 'opérateurs'
    },
    {
        id: 'reglementaire',
        name: 'Veille Réglementaire',
        desc: 'Textes juridiques et décisions de l\'ARPCE et du MPTIC',
        icon: 'fas fa-gavel',
        color: '#818cf8',
        glow: 'rgba(129,140,248,0.18)',
        action: 'showReglementaire()',
        live: false,
        staticCount: null,
        unit: 'textes'
    },
    {
        id: 'veille-rs',
        name: 'Veille Réseaux Sociaux',
        desc: 'Tendances TIC sur Twitter, LinkedIn et Facebook algériens',
        icon: 'fas fa-share-alt',
        color: '#fb7185',
        glow: 'rgba(251,113,133,0.18)',
        action: "window.location.href='/actualites-tic'",
        live: true,
        staticCount: null,
        unit: 'posts'
    },
    {
        id: 'lexique',
        name: 'Lexique TIC',
        desc: 'Dictionnaire du numérique en arabe, français et anglais',
        icon: 'fas fa-book-open',
        color: '#2dd4bf',
        glow: 'rgba(45,212,191,0.18)',
        action: "window.location.href='/wiki'",
        live: false,
        staticCount: null,
        unit: 'termes'
    },
    {
        id: 'video',
        name: 'Vidéos & Décryptages',
        desc: 'Reportages et analyses vidéo du numérique algérien',
        icon: 'fas fa-play-circle',
        color: '#f43f5e',
        glow: 'rgba(244,63,94,0.18)',
        action: "filterByCategory('Vidéo')",
        live: false,
        staticCount: null,
        unit: 'vidéos'
    }
];

function renderPlatformHub() {
    const grid = document.getElementById('hubGrid');
    if (!grid) return;

    grid.innerHTML = HUB_MODULES.map(mod => {
        const liveDot = mod.live
            ? `<span class="hub-dot-live" title="En direct"></span>`
            : '';

        const countVal = mod.countId
            ? (document.getElementById(mod.countId)?.textContent || '—')
            : (mod.staticCount || '—');

        const footerHTML = `
            <span class="hub-card-count" id="hc-${mod.id}">${countVal}</span>
            <span class="hub-card-unit">${mod.unit}</span>
            ${liveDot}`;

        return `<div class="hub-card"
                     style="--hc-color:${mod.color};--hc-glow:${mod.glow};"
                     onclick="${mod.action}"
                     role="button" tabindex="0"
                     onkeydown="if(event.key==='Enter'||event.key===' '){${mod.action}}">
            <div class="hub-card-icon"><i class="${mod.icon}"></i></div>
            <div class="hub-card-name">${mod.name}</div>
            <div class="hub-card-desc">${mod.desc}</div>
            <div class="hub-card-footer">${footerHTML}</div>
        </div>`;
    }).join('');
}

function updateHubStats() {
    // Nombre d'articles
    const artEl = document.getElementById('hubStatArticles');
    if (artEl && allArticles.length > 0) hubAnimateCount(artEl, allArticles.length);

    // Nombre de sources veille
    const vsTotal = document.getElementById('vs-total');
    const hubVeille = document.getElementById('hubStatVeille');
    if (hubVeille && vsTotal && vsTotal.textContent !== '—') {
        hubVeille.textContent = vsTotal.textContent;
        // Mettre à jour aussi la carte veille
        const hcVeille = document.getElementById('hc-veille');
        if (hcVeille) hcVeille.textContent = vsTotal.textContent;
    }

    // Nombre d'articles dans la carte vidéo (depuis allArticles)
    const videoCount = allArticles.filter(a => a.category === 'Vidéo').length;
    const hcVideo = document.getElementById('hc-video');
    if (hcVideo && videoCount > 0) hcVideo.textContent = videoCount;

    // Heure de synchro
    const timeEl = document.getElementById('hubStatTime');
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
}

function hubAnimateCount(el, target, duration = 900) {
    if (el._hubAnimating) return;
    el._hubAnimating = true;
    const start = performance.now();
    const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(ease * target);
        if (p < 1) requestAnimationFrame(tick);
        else { el.textContent = target; el._hubAnimating = false; }
    };
    requestAnimationFrame(tick);
}

// ===== WIDGET DEVISES — Taux temps réel via open.er-api.com =====
function initCurrencyWidget() {
    const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                       'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

    const CURRENCIES = [
        { code:'USD', flag:'🇺🇸', label:'USD',      x100:false },
        { code:'EUR', flag:'🇪🇺', label:'EUR',      x100:false },
        { code:'GBP', flag:'🇬🇧', label:'GBP',      x100:false },
        { code:'CAD', flag:'🇨🇦', label:'CAD',      x100:false },
        { code:'CHF', flag:'🇨🇭', label:'CHF',      x100:false },
        { code:'SAR', flag:'🇸🇦', label:'SAR',      x100:false },
        { code:'AED', flag:'🇦🇪', label:'AED',      x100:false },
        { code:'JPY', flag:'🇯🇵', label:'JPY ×100', x100:true  },
    ];

    // Taux de référence J-1 (Banque d'Algérie, 11 juin 2026)
    // Utilisés comme base de comparaison tant que localStorage ne contient pas de données J-1
    const FALLBACK_PREV = {
        USD: { buy:133.30, sell:133.32 },
        EUR: { buy:153.48, sell:153.51 },
        GBP: { buy:177.10, sell:177.23 },
        CAD: { buy:94.48,  sell:94.51  },
        CHF: { buy:156.05, sell:156.18 },
        SAR: { buy:35.54,  sell:35.57  },
        AED: { buy:36.27,  sell:36.30  },
        JPY: { buy:86.15,  sell:86.22  },
    };

    // ── Clés localStorage ────────────────────────────────────────────────────
    const LS_TODAY  = 'cc_rates_today';
    const LS_PREV   = 'cc_rates_prev';
    const LS_DATE   = 'cc_rates_date';
    const LS_TS     = 'cc_rates_ts';
    const LS_PDFURL = 'cc_pdf_url';
    const LS_PDFNUM = 'cc_pdf_num';
    const LS_PDFDT  = 'cc_pdf_date';
    const LS_SOURCE = 'cc_source'; // 'boa' | 'api'

    function fmt(n) { return n.toFixed(2).replace('.', ','); }

    function getDateStr() {
        const d = new Date();
        return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
    }

    // Triangulation open.er-api.com (fallback si PDF indisponible)
    function computeRates(apiRates) {
        const dzdPerUsd = apiRates.DZD;
        const result = {};
        for (const cur of CURRENCIES) {
            const mult   = cur.x100 ? 100 : 1;
            const mid    = (dzdPerUsd / apiRates[cur.code]) * mult;
            const spread = mid * 0.00015;
            result[cur.code] = { buy: +(mid - spread).toFixed(2), sell: +(mid + spread).toFixed(2) };
        }
        return result;
    }

    function buildCard(rates, prevRates, ts, opts) {
        // opts : { cached, stale, source, pdfUrl, pdfDate, pdfNum }
        opts = opts || {};
        let rows = '';
        for (const cur of CURRENCIES) {
            const r = rates[cur.code];
            if (!r) continue;
            const p = prevRates?.[cur.code];
            let badge = '';
            if (p) {
                const diff = +(r.buy - p.buy).toFixed(4);
                if (Math.abs(diff) >= 0.005) {
                    const sign = diff > 0 ? '+' : '−';
                    badge = `<span class="cc-badge ${diff > 0 ? 'cc-up' : 'cc-down'}">${sign}${fmt(Math.abs(diff))}</span>`;
                } else {
                    badge = `<span class="cc-badge cc-flat">—</span>`;
                }
            }
            rows += `<tr>
                <td><span class="cc-flag">${cur.flag}</span> ${cur.label}${badge}</td>
                <td class="cc-buy">${fmt(r.buy)}</td>
                <td class="cc-sell">${fmt(r.sell)}</td>
            </tr>`;
        }

        // Badge source
        const isBOA    = opts.source === 'boa';
        const srcBadge = isBOA
            ? `<span class="cc-src-badge cc-src-boa"><i class="fas fa-file-pdf"></i> PDF officiel${opts.pdfNum ? ' n°' + opts.pdfNum : ''}</span>`
            : `<span class="cc-src-badge cc-src-api"><i class="fas fa-exchange-alt"></i> Taux mi-marché</span>`;

        const dateLabel = isBOA && opts.pdfDate
            ? opts.pdfDate
            : getDateStr();

        const statusLine = ts
            ? `<span class="cc-update-time"><i class="fas fa-clock" style="font-size:0.55rem"></i> ${ts}${opts.cached ? ' · cache' : ''}${opts.stale ? ' · périmé' : ''}</span>`
            : '';

        const pdfHref   = opts.pdfUrl || 'https://www.bank-of-algeria.dz/taux-de-change-journalier/';
        const pdfLabel  = isBOA
            ? `<i class="fas fa-file-pdf"></i> Télécharger le PDF officiel n°${opts.pdfNum || ''}`
            : `<i class="fas fa-external-link-alt"></i> Cotations officielles — Banque d'Algérie`;

        const subtitle  = isBOA
            ? `Taux officiels du ${dateLabel} — Banque d'Algérie`
            : `Cours du Dinar Algérien — Taux indicatifs`;

        return `<div class="cc-header">
                    <span><i class="fas fa-university"></i> Banque d'Algérie ${srcBadge}</span>
                    <span class="cc-date">${dateLabel}</span>
                </div>
                <div class="cc-body">
                    <p class="cc-subtitle">${subtitle}${statusLine}</p>
                    <div class="cc-scroll-body">
                        <table class="cc-table">
                            <thead><tr><th>Devise</th><th>Achat</th><th>Vente</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                    <a href="${pdfHref}" target="_blank" rel="noopener" class="cc-pdf-btn">
                        ${pdfLabel}
                    </a>
                    <p class="cc-footer">
                        <i class="fas fa-info-circle"></i>
                        ${isBOA
                            ? 'Cotation commerciale officielle · Banque d\'Algérie'
                            : 'Taux mi-marché · Source : <a href="https://www.bank-of-algeria.dz/taux-de-change-journalier/" target="_blank" rel="noopener">Banque d\'Algérie</a>'}
                    </p>
                </div>`;
    }

    function buildErrorCard() {
        const pdfHref = localStorage.getItem(LS_PDFURL) || 'https://www.bank-of-algeria.dz/taux-de-change-journalier/';
        return `<div class="cc-header">
                    <span><i class="fas fa-university"></i> Banque d'Algérie</span>
                    <span class="cc-date">${getDateStr()}</span>
                </div>
                <div class="cc-body">
                    <div class="cc-loading-body" style="flex-direction:column;gap:8px">
                        <i class="fas fa-exclamation-circle" style="font-size:1.5rem;color:#f59e0b"></i>
                        <span style="font-size:0.75rem;color:#aaa;text-align:center">Données temporairement<br>indisponibles</span>
                    </div>
                    <a href="${pdfHref}" target="_blank" rel="noopener" class="cc-pdf-btn">
                        <i class="fas fa-external-link-alt"></i> Cotations officielles — Banque d'Algérie
                    </a>
                </div>`;
    }

    async function fetchRates() {
        const loadIcon = document.getElementById('ccLoadingIcon');
        if (loadIcon) loadIcon.style.display = 'inline';

        const today      = new Date().toDateString();
        const storedDate = localStorage.getItem(LS_DATE);
        // Rotation J → J-1 au changement de jour
        if (storedDate && storedDate !== today) {
            localStorage.setItem(LS_PREV, localStorage.getItem(LS_TODAY) || '{}');
        }

        const prevRates = JSON.parse(localStorage.getItem(LS_PREV) || 'null') || FALLBACK_PREV;

        // ── Priorité 1 : PDF officiel Banque d'Algérie (via endpoint local) ──
        try {
            const boaRes = await fetch('/api/dzd-rates');
            if (boaRes.ok) {
                const boa = await boaRes.json();
                if (boa.rates && Object.keys(boa.rates).length >= 4) {
                    const ts = new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
                    // Persister pour affichage hors-ligne
                    localStorage.setItem(LS_TODAY,  JSON.stringify(boa.rates));
                    localStorage.setItem(LS_DATE,   today);
                    localStorage.setItem(LS_TS,     ts);
                    localStorage.setItem(LS_PDFURL, boa.pdfUrl  || '');
                    localStorage.setItem(LS_PDFNUM, boa.pdfNum  || '');
                    localStorage.setItem(LS_PDFDT,  boa.pdfDate || '');
                    localStorage.setItem(LS_SOURCE, 'boa');
                    card.innerHTML = buildCard(boa.rates, prevRates, ts, {
                        cached:  boa.cached,
                        stale:   boa.stale,
                        source:  'boa',
                        pdfUrl:  boa.pdfUrl,
                        pdfDate: boa.pdfDate,
                        pdfNum:  boa.pdfNum,
                    });
                    if (loadIcon) loadIcon.style.display = 'none';
                    return;
                }
            }
        } catch (_) { /* fallback ci-dessous */ }

        // ── Priorité 2 : open.er-api.com (triangulation USD→DZD) ─────────────
        try {
            const res  = await fetch('https://open.er-api.com/v6/latest/USD');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();

            const newRates = computeRates(data.rates);
            const ts       = new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
            localStorage.setItem(LS_TODAY,  JSON.stringify(newRates));
            localStorage.setItem(LS_DATE,   today);
            localStorage.setItem(LS_TS,     ts);
            localStorage.setItem(LS_SOURCE, 'api');
            card.innerHTML = buildCard(newRates, prevRates, ts, { cached: false, source: 'api' });

        } catch (_) {
            // ── Priorité 3 : cache localStorage ──────────────────────────────
            const cached  = JSON.parse(localStorage.getItem(LS_TODAY)  || 'null');
            const ts      = localStorage.getItem(LS_TS);
            const src     = localStorage.getItem(LS_SOURCE) || 'api';
            const pdfUrl  = localStorage.getItem(LS_PDFURL) || '';
            const pdfDate = localStorage.getItem(LS_PDFDT)  || '';
            const pdfNum  = localStorage.getItem(LS_PDFNUM) || '';
            card.innerHTML = cached
                ? buildCard(cached, prevRates, ts, { cached: true, source: src, pdfUrl, pdfDate, pdfNum })
                : buildErrorCard();
        } finally {
            if (loadIcon) loadIcon.style.display = 'none';
        }
    }

    const card = document.getElementById('currencyCard');
    const wrap = document.querySelector('.currency-wrap');
    if (!card || !wrap) return;

    // Skeleton de chargement immédiat
    card.innerHTML = `<div class="cc-header"><span><i class="fas fa-university"></i> Banque d'Algérie</span><span class="cc-date">${getDateStr()}</span></div>
        <div class="cc-body"><div class="cc-loading-body"><i class="fas fa-circle-notch fa-spin" style="font-size:1.4rem;color:#b45309"></i></div></div>`;

    fetchRates();
    setInterval(fetchRates, 4 * 60 * 60 * 1000); // Rafraîchissement toutes les 4 h

    // Hover JS avec timer pour couvrir le gap trigger → carte
    let hideTimer;
    const show = () => { clearTimeout(hideTimer); card.classList.add('cc-visible'); };
    const hide = () => { hideTimer = setTimeout(() => card.classList.remove('cc-visible'), 140); };
    wrap.addEventListener('mouseenter', show);
    wrap.addEventListener('mouseleave', hide);
    card.addEventListener('mouseenter', show);
    card.addEventListener('mouseleave', hide);
}

// Init hub au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    renderPlatformHub();
    // Mise à jour des stats après chargement des données
    setTimeout(updateHubStats, 2500);
    // Rafraîchissement de l'heure toutes les minutes
    setInterval(() => {
        const timeEl = document.getElementById('hubStatTime');
        if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
    }, 60000);
});

// ══════════════════════════════════════════════════════════════
//  WHATSAPP SHARE WIDGET
// ══════════════════════════════════════════════════════════════

function injectWhatsAppWidget() {
    // Mettre à jour le lien si le widget existe déjà
    const existing = document.getElementById('at-wa-share-link');
    if (existing) {
        const url   = encodeURIComponent(location.href);
        const title = encodeURIComponent((document.title || '').replace(' — Algeria Tech', '').trim());
        existing.href = 'https://wa.me/?text=' + title + '%20%E2%80%94%20' + url;
        return;
    }

    const url   = encodeURIComponent(location.href);
    const title = encodeURIComponent((document.title || '').replace(' — Algeria Tech', '').trim());
    const waUrl = () => 'https://wa.me/?text=' + encodeURIComponent((document.title || '').replace(' — Algeria Tech','').trim()) + '%20%E2%80%94%20' + encodeURIComponent(location.href);

    const wrap = document.createElement('div');
    wrap.id = 'at-wa-widget';
    wrap.style.cssText = 'position:fixed;bottom:96px;right:24px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px';
    wrap.innerHTML = `
      <div id="at-wa-panel" style="display:none;background:#fff;border-radius:16px;width:272px;
           box-shadow:0 8px 32px rgba(0,0,0,.18);overflow:hidden;
           animation:none;transition:opacity .2s,transform .2s">
        <div style="background:#075E54;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px">
          <i class="fab fa-whatsapp" style="font-size:1.35rem"></i>
          <div>
            <div style="font-weight:700;font-size:.95rem">Partager sur WhatsApp</div>
            <div style="font-size:.73rem;opacity:.82">Algeria Tech — By Basta</div>
          </div>
        </div>
        <div style="padding:14px">
          <p style="font-size:.82rem;color:#555;line-height:1.6;margin-bottom:12px">
            Partagez cet article avec vos contacts WhatsApp.
          </p>
          <a id="at-wa-share-link" href="${'https://wa.me/?text=' + title + '%20%E2%80%94%20' + url}"
             target="_blank" rel="noopener"
             style="display:flex;align-items:center;gap:10px;background:#25D366;color:#fff;
                    border-radius:8px;padding:11px 16px;text-decoration:none;font-weight:700;font-size:.88rem;
                    transition:background .15s"
             onmouseover="this.style.background='#1da851'" onmouseout="this.style.background='#25D366'">
            <i class="fab fa-whatsapp"></i> Partager maintenant
          </a>
        </div>
      </div>
      <button id="at-wa-fab"
        style="width:54px;height:54px;background:#25D366;border:none;border-radius:50%;cursor:pointer;
               display:flex;align-items:center;justify-content:center;position:relative;
               box-shadow:0 4px 18px rgba(37,211,102,.5);transition:transform .2s"
        onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
        <i class="fab fa-whatsapp" style="color:#fff;font-size:1.5rem;pointer-events:none"></i>
        <span id="at-wa-pulse" style="position:absolute;inset:-5px;border-radius:50%;
              border:2px solid rgba(37,211,102,.4);animation:at-wa-pulse 2s ease-out infinite;
              pointer-events:none"></span>
      </button>
    `;
    document.body.appendChild(wrap);

    // Style animation pulse
    if (!document.getElementById('at-wa-style')) {
        const s = document.createElement('style');
        s.id = 'at-wa-style';
        s.textContent = '@keyframes at-wa-pulse{0%{transform:scale(.9);opacity:1}100%{transform:scale(1.5);opacity:0}}';
        document.head.appendChild(s);
    }

    const fab   = document.getElementById('at-wa-fab');
    const panel = document.getElementById('at-wa-panel');
    let open = false;

    fab.addEventListener('click', (e) => {
        e.stopPropagation();
        open = !open;
        // Mettre à jour le lien avec l'URL courante au moment du clic
        const link = document.getElementById('at-wa-share-link');
        if (link) link.href = waUrl();
        panel.style.display = open ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
        if (open && !wrap.contains(e.target)) {
            open = false;
            panel.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', injectWhatsAppWidget);
