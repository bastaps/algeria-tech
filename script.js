// === ADMIN VISIBILITY CONTROL ===
const ADMIN_CONFIG = {
    password: 'admin2026', // Change ce mot de passe si tu veux
    unlockKey: 'AT_Admin_2026',
    isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};

// Vérifier si admin est déverrouillé
function isAdminUnlocked() {
    if (ADMIN_CONFIG.isLocalhost) return true;
    return localStorage.getItem(ADMIN_CONFIG.unlockKey) === 'unlocked';
}

// Déverrouiller l'admin
function unlockAdmin() {
    if (ADMIN_CONFIG.isLocalhost) return true;
    
    const input = prompt(' Accès Administration Algeria Tech\n\nEntrez le mot de passe:');
    if (input === ADMIN_CONFIG.password) {
        localStorage.setItem(ADMIN_CONFIG.unlockKey, 'unlocked');
        updateAdminVisibility();
        showToast('✅ Mode administrateur activé');
        return true;
    } else if (input !== null) {
        showToast('❌ Mot de passe incorrect');
        return false;
    }
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
const ITEMS_PER_PAGE = 6;
let currentPage = 1;
let currentFilter = 'all';
let currentTag = null;
let articleViews = JSON.parse(localStorage.getItem('articleViews') || '{}');
let currentEditingId = null;
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
const ADMIN_PASSWORD = 'admin2026';
const YOUTUBE_API_KEY = 'AIzaSyDw_grxmStmAgZ6-WUWHNLPa5ozKIgVMiA';
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
            cachedIds = allArticles.map(a => a.id).join(',');
            _renderAll(allArticles);
        } catch (e) {
            localStorage.removeItem('at_articles_cache');
        }
    } else {
        const grid = document.getElementById('newsGrid');
        if (grid) grid.innerHTML = '<p style="text-align:center;padding:20px;">Chargement…</p>';
    }

    // ── 2. Fetch articles.json depuis Cloudflare CDN ──
    try {
        const res = await fetch('/articles.json');
        if (!res.ok) throw new Error('articles.json introuvable');
        const data = await res.json();

        allArticles = data
            .filter(a => a.type !== 'communique_officiel')  // réservés au Hub Opérateurs
            .map(a => ({
                ...a,
                views: articleViews[a.id] || Math.floor(Math.random() * 500) + 50
            }));

        // Mise en cache pour la prochaine visite
        localStorage.setItem('at_articles_cache', JSON.stringify(allArticles));

        // Re-render uniquement si la liste d'articles a changé.
        // Évite le double-render quand le SW sert articles.json depuis son cache
        // instantanément : sans ce garde, les deux renders se chevauchent en ~0 ms
        // et l'animation CSS (fadeInUp) se rejoue → effet de vibration visible.
        const newIds = allArticles.map(a => a.id).join(',');
        if (newIds !== cachedIds) _renderAll(allArticles);

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
        const m = fm.match(new RegExp(`${k}:\\s*(.*)`));
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
<div class="news-card-img" style="position:relative;"><img src="${getT(a)}" alt="${a.titre}" onerror="this.onerror=null;this.style.display='none'">${a.video ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(210,16,52,0.8);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;z-index:2;pointer-events:none;"><i class="fas fa-play"></i></div>' : ''}<span class="category-tag ${cls(a.categorie)}">${a.categorie}</span></div>
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
window.openArticle = function(id) {
    const art = allArticles.find(a => a.id == id);
    if (!art) return;
    currentEditingId = id;
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        adminBtn.title = "Modifier cet article";
    }
    // Parse markdown à la demande (lazy) — non fait au chargement initial
    if (!art.contenu && art.rawContent) {
        art.contenu = (typeof marked !== 'undefined')
            ? marked.parse(art.rawContent, { breaks: true, gfm: true })
            : art.rawContent;
        art.readingTime = Math.ceil(art.rawContent.split(/\s+/).length / 200);
    }

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
    if (art.video && art.video.trim() !== "  ") {
        const vId = art.video.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]{11})/)?.[1];
        if (vId) {
            mediaHeader = `<div class="video-container" style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; margin-bottom:20px; border-radius:12px; background:#000;"><iframe src="https://www.youtube-nocookie.com/embed/${vId}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allowfullscreen></iframe></div>`;
        }
        if (art.image && art.image.trim() !== "  ") {
            bodyImage = `<img src="${art.image}" alt="${art.titre}" style="max-width:350px; width:100%; float:right; margin:0 0 20px 20px; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">`;
        }
    } else if (art.image && art.image.trim() !== "  ") {
        mediaHeader = `<img src="${art.image}" alt="${art.titre}" onerror="this.onerror=null;this.style.display='none'" style="width:100%; border-radius:15px; margin-bottom:25px;">`;
    }
    let pdfLink = art.pdf ? `<div style="margin: 20px 0; padding: 15px; background: var(--bg-light); border-radius: 10px; display: flex; align-items: center; gap: 15px;"><i class="fas fa-file-pdf" style="font-size: 2rem; color: #D21034;"></i><div><p style="margin:0; font-weight:600;">Document d'accompagnement</p><a href="${art.pdf}" target="_blank" class="tag-filter" style="display:inline-block; margin-top:5px; text-decoration:none;"><i class="fas fa-download"></i> TÃ©lÃ©charger le PDF</a></div></div>` : '';
    let html = `${mediaHeader}<div class="article-body"><div class="article-meta"><span class="category-tag ${cls(art.categorie)}">${art.categorie}</span><span><i class="far fa-calendar"></i> ${art.date}</span><span><i class="far fa-clock"></i> ${art.heure}</span><span class="reading-time"><i class="fas fa-book-open"></i> ${art.readingTime} min</span><span><i class="far fa-eye"></i> ${art.views} vues</span><button class="meta-audio-btn" onclick="triggerAudio()"><i class="fas fa-volume-up"></i> Ã‰couter</button></div><h1>${art.titre}</h1><div class="article-actions"><button class="synthese-btn" id="syntheseBtn" onclick="loadSynthese()"><i class="fas fa-bolt"></i> Synthèse IA</button><button class="jargon-btn" id="jargonBtn" onclick="toggleJargon()"><i class="fas fa-glasses"></i> Déchiffrer le jargon</button><button class="debat-btn" id="debatBtn" onclick="openDebat()"><i class="fas fa-comments"></i> Débattre avec l'IA</button></div><div id="syntheseBox"></div><div class="article-text">${bodyImage}${art.contenu}${pdfLink}</div>`;
    if (art.tags && art.tags.length) {
        html += `<div style="margin:30px 0;padding-top:20px;border-top:1px solid var(--border)"><strong>Tags: </strong>${art.tags.map(t => `<span class="tag-filter" style="margin-left:8px" onclick="filterByTag('${t}');goHome()">${t}</span>`).join('')}</div>`;
    }
    html += `<div class="share-buttons"><button class="share-btn facebook" onclick="share('facebook')"><i class="fab fa-facebook-f"></i> Facebook</button><button class="share-btn twitter" onclick="share('twitter')"><i class="fab fa-twitter"></i> Twitter</button><button class="share-btn whatsapp" onclick="share('whatsapp')"><i class="fab fa-whatsapp"></i> WhatsApp</button><button class="share-btn linkedin" onclick="share('linkedin')"><i class="fab fa-linkedin-in"></i> LinkedIn</button><button class="share-btn copy" onclick="copyLink()"><i class="fas fa-link"></i> Copier</button></div>`;
    document.getElementById('articleContent').innerHTML = html;
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

// ===== LOGIQUE AUDIO (TTS Premium + Highlighting) =====
function initAudioReader(textToRead) {
    const playBtn   = document.getElementById('listenBtn');
    const stopBtn   = document.getElementById('stopBtn');
    const statusEl  = document.querySelector('.audio-status');
    const stickyBar = document.getElementById('stickyAudio');
    const articleText = document.querySelector('.article-text');

    // ── Nettoyage du texte (pas de #, *, -, etc.) ────────────────
    const cleanText = cleanTextForTTS(textToRead).substring(0, 4090);

    // ── Construction des segments DOM + timestamps estimés ───────
    const domSegs = articleText
        ? Array.from(articleText.querySelectorAll('p, h2, h3, li'))
              .filter(el => el.textContent.trim().length > 15)
        : [];

    let cursor = 0;
    // Le titre est lu en premier (≈ 15 premiers mots du cleanText)
    cursor += (Math.min(cleanText.split(' ').length, 15) / TTS_CONFIG.wpm) * 60;

    const segments = domSegs.map(el => {
        const wc  = el.textContent.trim().split(/\s+/).length;
        const dur = (wc / TTS_CONFIG.wpm) * 60;
        const seg = { el, start: cursor, end: cursor + dur };
        cursor += dur;
        return seg;
    });

    // ── Helpers UI ────────────────────────────────────────────────
    function resetUI() {
        if (playBtn)   playBtn.style.display  = 'flex';
        if (stopBtn)   stopBtn.style.display  = 'none';
        if (statusEl)  statusEl.textContent   = 'AUDIO';
        if (stickyBar) stickyBar.classList.remove('playing');
        domSegs.forEach(el => el.classList.remove('reading-active', 'reading-done'));
        if (synth) synth.cancel();
    }

    function highlightAt(time) {
        let activeEl = null;
        segments.forEach(seg => {
            if (time >= seg.start && time < seg.end) {
                seg.el.classList.add('reading-active');
                seg.el.classList.remove('reading-done');
                activeEl = seg.el;
            } else if (time >= seg.end) {
                seg.el.classList.remove('reading-active');
                seg.el.classList.add('reading-done');
            } else {
                seg.el.classList.remove('reading-active', 'reading-done');
            }
        });
        // Auto-scroll : paragraphe actif centré dans la fenêtre
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ── Résolution de la voix : select > auto-detect ──────────────
    function resolveVoice() {
        const sel = document.getElementById('voiceSelect');
        const voices = synth.getVoices();
        // Samsung : voiceschanged peut être manqué — repopuler à la demande
        if (sel && sel.options.length <= 1 && voices.length) populateVoiceSelect();
        if (sel && sel.value) {
            const picked = voices.find(v => v.name === sel.value && v.lang.startsWith('fr'));
            if (picked) return picked;
        }
        // Fallback : meilleure voix FR détectée automatiquement
        return voices.find(v => /neural/i.test(v.name)    && v.lang.startsWith('fr'))
            || voices.find(v => /microsoft/i.test(v.name) && v.lang.startsWith('fr'))
            || voices.find(v => /google/i.test(v.name)    && v.lang.startsWith('fr'))
            || voices.find(v => v.lang === 'fr-FR')
            || voices.find(v => v.lang.startsWith('fr'))
            || null;
    }

    // ── Lecture Web Speech API ────────────────────────────────────
    function startSpeech() {
        if (!synth) return;

        // Cancel uniquement si déjà en lecture (évite le bug iOS "cancel on idle")
        if (synth.speaking || synth.pending) synth.cancel();

        if (playBtn)   playBtn.style.display  = 'none';
        if (stopBtn)   stopBtn.style.display  = 'flex';
        if (statusEl)  statusEl.textContent   = '▶ AUDIO';
        if (stickyBar) stickyBar.classList.add('playing');

        const utt = new SpeechSynthesisUtterance(cleanText);
        utt.rate  = TTS_CONFIG.rate;

        utt.onboundary = (e) => {
            if (e.name !== 'word' || cursor === 0) return;
            highlightAt((e.charIndex / cleanText.length) * cursor);
        };
        utt.onend   = resetUI;
        utt.onerror = resetUI;

        // Voix FR appliquée en premier, lang forcé après pour Samsung
        const voice = resolveVoice();
        if (voice) utt.voice = voice;
        utt.lang = 'fr-FR';

        // DOIT être synchrone dans le handler du geste utilisateur.
        // setTimeout (même 0ms) sort du contexte de geste → TTS bloqué silencieusement sur mobile.
        synth.speak(utt);
    }

    // ── Bouton repli mobile ───────────────────────────────────────
    const collapseBtn = document.getElementById('audioCollapseBtn');
    if (collapseBtn && stickyBar) {
        const doCollapse = (e) => {
            e.preventDefault();
            const collapsed = stickyBar.classList.toggle('collapsed');
            collapseBtn.querySelector('i').className = collapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
        };
        collapseBtn.addEventListener('click', doCollapse);
        collapseBtn.addEventListener('touchend', doCollapse, { passive: false });
    }

    // ── Bindings anti-double-déclenchement (touchend + click) ────
    // Sur mobile les deux events tirent pour un seul tap.
    // touchend prend la main ; click est ignoré s'il suit un touchend récent.
    let _lastTouchMs = 0;
    const _bindBtn = (btn, fn) => {
        if (!btn) return;
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            _lastTouchMs = Date.now();
            fn();
        }, { passive: false });
        btn.addEventListener('click', () => {
            if (Date.now() - _lastTouchMs > 500) fn();
        });
    };
    _bindBtn(playBtn, startSpeech);
    _bindBtn(stopBtn, resetUI);

    window.triggerAudio = () => {
        synth?.speaking ? resetUI() : startSpeech();
    };
}

// ── Stop global (Web Speech) ─────────────────────────────────────
function stopAllAudio() {
    if (synth) synth.cancel();
    const statusEl = document.querySelector('.audio-status');
    if (statusEl)  statusEl.textContent = 'AUDIO';
    const stickyBar = document.getElementById('stickyAudio');
    if (stickyBar)  stickyBar.classList.remove('playing');
    const playBtn = document.getElementById('listenBtn');
    const stopBtn = document.getElementById('stopBtn');
    if (playBtn) playBtn.style.display = 'flex';
    if (stopBtn) stopBtn.style.display = 'none';
    document.querySelectorAll('.reading-active, .reading-done')
        .forEach(el => el.classList.remove('reading-active', 'reading-done'));
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
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('articlePage').style.display = 'none';
    document.getElementById('veilleSection').style.display = 'none';
    document.getElementById('revueSection').style.display = 'none';
    const _compSec = document.getElementById('comparateurSection');
    if (_compSec) _compSec.style.display = 'none';
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
    document.getElementById('revueSection').style.display = 'block';
    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));
    const navRevue = document.getElementById('nav-revue');
    if(navRevue) navRevue.classList.add('active');
    loadRevue();
    window.scrollTo({top: 0, behavior: 'smooth'});
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
        </div>`;

    const syntheseHtml = `
        <div class="revue-synthese-bloc">
            <div class="revue-synthese-eyelet"><i class="fas fa-robot"></i> Synthèse IA</div>
            <p class="revue-synthese-text">${_revueData.synthese}</p>
        </div>`;

    const uneHtml = une ? `
        <div class="revue-une" style="--revue-glow:${glowByCategorie(une.categorie)}">
            <div class="revue-card-shine"></div>
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

    container.innerHTML = mastheadHtml + toolbarHtml + syntheseHtml + (showArchives ? archiveHtml : uneHtml + gridHtml) + footerHtml;

    // Activer le moteur de lévitation 3D après chaque rendu
    initRevueTilt3D();
}

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
    const origTexts = { hubPdfBtn:'PDF', hubTranslateBtn:'Traduire', hubGenBtn:'Générer', hubFillBtn:'Remplir' };
    const origIcons = { hubPdfBtn:'fas fa-file-pdf', hubTranslateBtn:'fas fa-language', hubGenBtn:'fas fa-pen-nib', hubFillBtn:'fas fa-fill-drip' };
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
window.hubGenerate = async function() {
    const source = document.getElementById('hubSmartBox').value.trim();
    if (!source) return showToast('Collez un texte dans la zone IA avant de générer.');
    hubSetStatus('hubGenBtn', 'loading');
    try {
        const r = await fetch(`${HUB_API}/api/smart-generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: source })
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
    // Détection auto catégorie
    const txt = ((d.contenu || '') + ' ' + (d.titre || '')).toLowerCase();
    const cat = txt.includes('djezzy')||txt.includes('mobilis')||txt.includes('ooredoo')||txt.includes('télécom') ? 'Télécoms'
              : txt.includes('mobile')||txt.includes('smartphone') ? 'Mobile'
              : txt.includes('startup')||txt.includes('incubateur') ? 'Startups'
              : txt.includes('entreprise')||txt.includes('société') ? 'Entreprises'
              : txt.includes('innovation')||txt.includes('numérique') ? 'Innovation'
              : 'Algérie';
    document.getElementById('categorie').value = d.categorie || cat;
    hubSetStatus('hubFillBtn', 'success');
    showToast('Formulaire rempli ! Vérifiez et ajustez avant de déployer.');
};

// ===== GESTION ADMIN =====
window.toggleAdminPanel = function() {
    // Vérifier si admin est déverrouillé (production uniquement)
    if (!ADMIN_CONFIG.isLocalhost && !isAdminUnlocked()) {
        if (!unlockAdmin()) return;
    }
    
    const pass = prompt('Mot de passe Admin:');
    if (pass !== ADMIN_PASSWORD) return showToast('Accès refusé');
    
    const modal = document.getElementById('adminModal');
    modal.classList.add('show');
    
    if (currentEditingId) {
        const art = allArticles.find(a => a.id == currentEditingId);
        document.getElementById('titre').value = art.titre;
        document.getElementById('categorie').value = art.categorie;
        document.getElementById('date').value = art.date;
        document.getElementById('heure').value = art.heure;
        document.getElementById('extrait').value = art.extrait;
        document.getElementById('video').value = art.video || '';
        document.getElementById('tags').value = art.tags.join(', ');
        document.getElementById('contenu').value = art.rawContent;
        
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
            const art = allArticles.find(a => a.id == currentEditingId);
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
        if (response.ok) { showToast('âœ… SupprimÃ© !'); setTimeout(() => window.location.reload(), 2000); }
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
    const urls = { facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`, twitter: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, whatsapp: `https://wa.me/?text=${t}%20${u}` };
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
        const d = await res.json();
        const c = d.current;
        const temp  = Math.round(c.temperature_2m);
        const feels = Math.round(c.apparent_temperature);
        const code  = c.weather_code;
        const { i: icon, c: color } = _wxIcon(code);
        const desc   = WMO_FR[code] || 'Alger';
        const dir    = _wxDir(c.wind_direction_10m);
        const wind   = Math.round(c.wind_speed_10m);
        const cloud  = c.cloud_cover != null ? Math.round(c.cloud_cover) : null;
        const uv     = c.uv_index   != null ? Math.round(c.uv_index)    : null;
        const uvInfo = uv != null ? _uvLabel(uv) : null;
        const now    = new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

        // Previsions semaine (7 jours)
        const DAY_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
        const days   = d.daily;
        let weekHtml = '<div class="wc-week">';
        for (let k = 0; k < Math.min(7, (days && days.time ? days.time.length : 0)); k++) {
            const dayDate = new Date(days.time[k]);
            const dayName = k === 0 ? 'Auj.' : DAY_FR[dayDate.getDay()];
            const { i: dIcon, c: dColor } = _wxIcon(days.weather_code[k]);
            const dMax = Math.round(days.temperature_2m_max[k]);
            const dMin = Math.round(days.temperature_2m_min[k]);
            weekHtml +=
                '<div class="wc-day">' +
                    '<span class="wc-day-name">' + dayName + '</span>' +
                    '<i class="fas ' + dIcon + '" style="color:' + dColor + '"></i>' +
                    '<span class="wc-day-max">' + dMax + '&#176;</span>' +
                    '<span class="wc-day-min">' + dMin + '&#176;</span>' +
                '</div>';
        }
        weekHtml += '</div>';

        // Topbar
        widget.innerHTML = '<i class="fas ' + icon + '" style="color:' + color + ';margin-right:4px;"></i><b>' + temp + '&#176;C</b>';

        // Grand popup
        if (card) {
            const uvRow = uvInfo ? (
                '<div class="wc-item">' +
                    '<i class="fas fa-sun" style="color:' + uvInfo.color + '"></i>' +
                    '<span>Indice UV</span>' +
                    '<b style="color:' + uvInfo.color + '">' + uv + '</b>' +
                '</div>' +
                '<div class="wc-item">' +
                    '<i class="fas fa-circle" style="color:' + uvInfo.color + ';font-size:.5rem"></i>' +
                    '<span>Niveau</span>' +
                    '<b style="color:' + uvInfo.color + '">' + uvInfo.label + '</b>' +
                '</div>'
            ) : '';
            const cloudRow = cloud != null ? (
                '<div class="wc-item">' +
                    '<i class="fas fa-cloud"></i>' +
                    '<span>Nuages</span>' +
                    '<b>' + cloud + '%</b>' +
                '</div>'
            ) : '';

            card.innerHTML =
                '<div class="wc-header">' +
                    '<span><i class="fas fa-map-marker-alt"></i>&nbsp;Alger, Algerie</span>' +
                    '<span class="wc-time">&#8635;&nbsp;' + now + '</span>' +
                '</div>' +
                '<div class="wc-body">' +
                    '<div class="wc-main">' +
                        '<i class="fas ' + icon + ' wc-main-icon" style="color:' + color + '"></i>' +
                        '<div class="wc-main-temp">' + temp + '<span class="wc-unit">&#176;C</span></div>' +
                        '<div class="wc-desc">' + desc + '</div>' +
                    '</div>' +
                    '<div class="wc-grid">' +
                        '<div class="wc-item">' +
                            '<i class="fas fa-thermometer-half"></i>' +
                            '<span>Ressenti</span>' +
                            '<b>' + feels + '&#176;C</b>' +
                        '</div>' +
                        '<div class="wc-item">' +
                            '<i class="fas fa-tint"></i>' +
                            '<span>Humidite</span>' +
                            '<b>' + c.relative_humidity_2m + '%</b>' +
                        '</div>' +
                        cloudRow +
                        '<div class="wc-item">' +
                            '<i class="fas fa-wind"></i>' +
                            '<span>Vent ' + dir + '</span>' +
                            '<b>' + wind + ' km/h</b>' +
                        '</div>' +
                        uvRow +
                    '</div>' +
                    weekHtml +
                    '<a href="https://www.meteo.dz/" target="_blank" rel="noopener" class="wc-link">' +
                        'Meteo complete &mdash; meteo.dz &#8594;' +
                    '</a>' +
                '</div>';
        }
    } catch(e) {
        widget.innerHTML = '<i class="fas fa-sun" style="color:#fbbf24;margin-right:4px;"></i><b>--&#176;C</b>';
        if (card) card.innerHTML = '<div class="wc-header" style="justify-content:center"><i class="fas fa-exclamation-triangle" style="color:#ef4444;margin-right:6px"></i>Meteo indisponible</div>';
    } finally {
        widget.classList.remove('updating');
    }
}

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
            const filtered = allArticles.filter(a => (a.titre && a.titre.toLowerCase().includes(query)) || (a.extrait && a.extrait.toLowerCase().includes(query)) || (a.tags && a.tags.some(t => t.toLowerCase().includes(query))));
            renderGrid(filtered.slice(0, ITEMS_PER_PAGE));
            renderPagination(filtered);
        }
    });
}

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
    if (/t[eé]l[eé]com|op[eé]rateur|\bfibre\b|\b[45]g\b|r[eé]seau\b|\bfai\b|voip|gsm|lte/.test(t)) return 'Télécoms';
    if (/\bmobile\b|smartphone|android|iphone|tablette|samsung|xiaomi/.test(t))                        return 'Mobile';
    if (/startup|innovation|lev[eé]e|incubat|pitch|fintech|scale-up/.test(t))                          return 'Startups';
    if (/intelligence artificielle|\bia\b|\bai\b|machine learning|gpt|chatgpt|llm/.test(t))            return 'IA';
    if (/\binternet\b|haut d[eé]bit|adsl|vdsl|broadband/.test(t))                                     return 'Internet';
    if (/\bdata\b|big data|donn[eé]es|analytique/.test(t))                                             return 'Data';
    if (/cloud\b|saas|paas|h[eé]bergement|datacenter/.test(t))                                         return 'Cloud';
    if (/cybers[eé]curit|hack\b|phishing|malware|ransomware/.test(t))                                  return 'Cybersécurité';
    if (/num[eé]rique|digital|transformation/.test(t))                                                  return 'Numérique';
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
        const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${YOUTUBE_CHANNEL_ID}&part=snippet,id&order=date&maxResults=12&type=video`;
        const res = await fetch(url);
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

    const art = allArticles.find(a => a.id == currentEditingId);
    if (!art) return;

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
