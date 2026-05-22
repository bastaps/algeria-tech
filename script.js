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
const synth = window.speechSynthesis;
let currentUtterance = null;
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
    const cached = localStorage.getItem('at_articles_cache');
    if (cached) {
        try {
            allArticles = JSON.parse(cached);
            allArticles.forEach(a => {
                a.views = articleViews[a.id] || Math.floor(Math.random() * 500) + 50;
            });
            _renderAll(allArticles);
        } catch (e) {
            localStorage.removeItem('at_articles_cache');
        }
    } else {
        const grid = document.getElementById('newsGrid');
        if (grid) grid.innerHTML = '<p style="text-align:center;padding:20px;">Chargement…</p>';
    }

    // ── 2. Fetch articles.json depuis Cloudflare CDN (~80ms) ──
    try {
        const res = await fetch('/articles.json');
        if (!res.ok) throw new Error('articles.json introuvable');
        const data = await res.json();

        allArticles = data.map(a => ({
            ...a,
            views: articleViews[a.id] || Math.floor(Math.random() * 500) + 50
            // rawContent conservé — contenu HTML parsé à la demande (openArticle)
        }));

        // Mise en cache pour la prochaine visite (sans contenu HTML pour économiser l'espace)
        localStorage.setItem('at_articles_cache', JSON.stringify(allArticles));

        _renderAll(allArticles);

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
    let html = `<div class="hero-main" onclick="openArticle('${h.id}')"><img src="${getT(h)}" alt="${h.titre}" onerror="this.src='https://via.placeholder.com/800x400?text=Image+Indisponible'">${h.video ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(210,16,52,0.8);color:#fff;width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2rem;z-index:2;pointer-events:none;"><i class="fas fa-play"></i></div>' : ''}<div class="hero-overlay"><div class="hero-meta-wrapper"><span class="category-tag ${cls(h.categorie)}">${h.categorie}</span><span class="hero-meta-tag"><i class="far fa-calendar-alt"></i> ${h.date}</span><span class="hero-meta-tag"><i class="far fa-clock"></i> ${h.heure}</span></div><h2>${h.titre}</h2><p>${h.extrait}</p></div></div><div class="hero-side-card">`;
    s.forEach(a => {
        html += `<div onclick="openArticle('${a.id}')" style="position:relative;"><img src="${getT(a)}" alt="${a.titre}" onerror="this.src='https://via.placeholder.com/400x200?text=Image+Indisponible'">${a.video ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(210,16,52,0.8);color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;z-index:2;pointer-events:none;"><i class="fas fa-play"></i></div>' : ''}<div class="hero-overlay"><div class="hero-meta-wrapper"><span class="category-tag ${cls(a.categorie)}">${a.categorie}</span><span class="hero-meta-tag"><i class="far fa-calendar-alt"></i> ${a.date}</span><span class="hero-meta-tag"><i class="far fa-clock"></i> ${a.heure}</span></div><h2>${a.titre}</h2></div></div>`;
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
<div class="news-card-img" style="position:relative;"><img src="${getT(a)}" alt="${a.titre}" onerror="this.src='https://via.placeholder.com/400x200?text=Image+Indisponible'">${a.video ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(210,16,52,0.8);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;z-index:2;pointer-events:none;"><i class="fas fa-play"></i></div>' : ''}<span class="category-tag ${cls(a.categorie)}">${a.categorie}</span></div>
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
        mediaHeader = `<img src="${art.image}" alt="${art.titre}" onerror="this.src='https://via.placeholder.com/800x400?text=Image+Indisponible'" style="width:100%; border-radius:15px; margin-bottom:25px;">`;
    }
    let pdfLink = art.pdf ? `<div style="margin: 20px 0; padding: 15px; background: var(--bg-light); border-radius: 10px; display: flex; align-items: center; gap: 15px;"><i class="fas fa-file-pdf" style="font-size: 2rem; color: #D21034;"></i><div><p style="margin:0; font-weight:600;">Document d'accompagnement</p><a href="${art.pdf}" target="_blank" class="tag-filter" style="display:inline-block; margin-top:5px; text-decoration:none;"><i class="fas fa-download"></i> TÃ©lÃ©charger le PDF</a></div></div>` : '';
    let html = `${mediaHeader}<div class="article-body"><div class="article-meta"><span class="category-tag ${cls(art.categorie)}">${art.categorie}</span><span><i class="far fa-calendar"></i> ${art.date}</span><span><i class="far fa-clock"></i> ${art.heure}</span><span class="reading-time"><i class="fas fa-book-open"></i> ${art.readingTime} min</span><span><i class="far fa-eye"></i> ${art.views} vues</span><button class="meta-audio-btn" onclick="triggerAudio()"><i class="fas fa-volume-up"></i> Ã‰couter</button></div><h1>${art.titre}</h1><div class="article-text">${bodyImage}${art.contenu}${pdfLink}</div>`;
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
            const thumb = vMatch ? `https://img.youtube.com/vi/${vMatch[1]}/hqdefault.jpg` : (a.image || 'https://via.placeholder.com/400x200?text=Indisponible');
            return `<div class="related-card" onclick="openArticle('${a.id}')"><img src="${thumb}" onerror="this.src='https://via.placeholder.com/400x200?text=Indisponible'"><h4>${a.titre}</h4></div>`;
        }).join('');
    } else if (relBox) { relBox.style.display = 'none'; }
};

// ===== LOGIQUE AUDIO =====
function initAudioReader(textToRead) {
    const playBtn = document.getElementById('listenBtn');
    const stopBtn = document.getElementById('stopBtn');
    const stickyContainer = document.getElementById('stickyAudio');
    const cleanText = textToRead.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
    function resetAudioUI() {
        if(playBtn) playBtn.style.display = 'flex';
        if(stopBtn) stopBtn.style.display = 'none';
        if(stickyContainer) stickyContainer.classList.remove('playing');
    }
    window.triggerAudio = () => {
        if (synth.speaking) { synth.cancel(); resetAudioUI(); } else { startReading(); }
    };
    function startReading() {
        synth.cancel();
        currentUtterance = new SpeechSynthesisUtterance(cleanText);
        currentUtterance.lang = 'fr-FR';
        currentUtterance.onstart = () => {
            if(playBtn) playBtn.style.display = 'none';
            if(stopBtn) stopBtn.style.display = 'flex';
            if(stickyContainer) stickyContainer.classList.add('playing');
        };
        currentUtterance.onend = resetAudioUI;
        currentUtterance.onerror = resetAudioUI;
        synth.speak(currentUtterance);
    }
    if(playBtn) playBtn.onclick = startReading;
    if(stopBtn) stopBtn.onclick = () => { synth.cancel(); resetAudioUI(); };
}

// ===== RETOUR ACCUEIL =====
window.goHome = function() {
    if (synth) synth.cancel();
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
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('articlePage').style.display = 'none';
    document.getElementById('veilleSection').style.display = 'none';
    document.getElementById('revueSection').style.display = 'none';
    document.getElementById('heroSection').classList.remove('hidden');
    renderGrid(allArticles.slice(0, ITEMS_PER_PAGE));
    renderPagination(allArticles);
    window.scrollTo({top: 0, behavior: 'smooth'});
};

// ===== NAVIGATION VEILLE =====
window.showVeille = function() {
    if (synth) synth.cancel();
    currentFilter = 'all';
    currentPage = 1;
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('articlePage').style.display = 'none';
    document.getElementById('revueSection').style.display = 'none';
    document.getElementById('veilleSection').style.display = 'block';
    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-veille').classList.add('active');
    loadVeille();
    window.scrollTo({top: 0, behavior: 'smooth'});
};

// ===== NAVIGATION REVUE DE PRESSE =====
window.showRevue = function() {
    if (synth) synth.cancel();
    currentFilter = 'all';
    currentPage = 1;
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('articlePage').style.display = 'none';
    document.getElementById('veilleSection').style.display = 'none';
    document.getElementById('revueSection').style.display = 'block';
    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));
    const navRevue = document.getElementById('nav-revue');
    if(navRevue) navRevue.classList.add('active');
    loadRevue();
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

    const articles = _revueData.articles.filter(a => {
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
        ...cats.map(c => ({ key: c, label: c }))
    ];

    container.innerHTML = `
        <div class="revue-intro">${_revueData.synthese}</div>
        <div class="revue-filters">
            ${filterBtns.map(f => `
                <button class="revue-filter-btn${_revueFilter === f.key ? ' active' : ''}"
                        onclick="setRevueFilter('${f.key}')">${f.label}</button>
            `).join('')}
        </div>
        <p class="revue-count">${articles.length} article${articles.length > 1 ? 's' : ''} · ${_revueData.totalSources || 20} sources surveillées</p>
        <div class="revue-grid">
            ${articles.length ? articles.map(a => `
                <div class="revue-card" data-pays="${a.pays || ''}">
                    <div class="revue-card-source">
                        <img class="revue-source-logo" src="${a.logo || ''}" alt="${a.source}" onerror="this.style.display='none'">
                        <span class="revue-source-name">${a.source}</span>
                        <span class="revue-pays-badge ${a.pays === 'DZ' ? 'dz' : 'fr'}">${a.pays === 'DZ' ? '🇩🇿 DZ' : '🌐 Intl'}</span>
                    </div>
                    <span class="revue-card-tag">${a.categorie}</span>
                    <h3>${a.titre}</h3>
                    <p class="revue-accroche">${a.accroche || a.resume}</p>
                    <a href="${a.url}" target="_blank" rel="noopener" class="revue-card-link">
                        Lire l'article <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
            `).join('') : '<p class="revue-empty">Aucun article pour ce filtre.</p>'}
        </div>
    `;
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
    // PrÃ©paration de l'affichage : on affiche le bloc principal et on cache l'article ou la veille
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

// ===== GESTION ADMIN =====
window.toggleAdminPanel = function() {
    const pass = prompt('Mot de passe Admin:');
    if (pass !== ADMIN_PASSWORD) return showToast('  AccÃ¨s refusÃ©');
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
            delBtn.id = 'delBtn'; delBtn.type = 'button'; delBtn.className = 'btn-secondary';
            delBtn.style.background = '#D21034'; delBtn.style.color = 'white';
            delBtn.innerHTML = '<i class="fas fa-trash"></i> Supprimer';
            delBtn.onclick = deleteArticle;
            document.querySelector('.form-actions').prepend(delBtn);
        }
    }
};

window.closeAdminPanel = () => { document.getElementById('adminModal').classList.remove('show'); document.getElementById('delBtn')?.remove(); document.getElementById('imagePreview').innerHTML = ''; };

// Correction de la fonction submitArticle
window.submitArticle = async function(e) {
    if (e) e.preventDefault();
    try {
        const formData = new FormData();
        formData.append('titre', document.getElementById('titre').value);
        formData.append('categorie', document.getElementById('categorie').value); // Correction: suppression de l'espace aprÃ¨s 'categorie'
        formData.append('date', document.getElementById('date').value);
        formData.append('heure', document.getElementById('heure').value);
        formData.append('extrait', document.getElementById('extrait').value);
        formData.append('tags', document.getElementById('tags').value);
        formData.append('contenu', document.getElementById('contenu').value);
        formData.append('video', document.getElementById('video').value);

        // Correction: AccÃ¨s sÃ©curisÃ© aux fichiers pour Ã©viter les crashes si l'input est manquant
        const imgInput = document.getElementById('image');
        if (imgInput && imgInput.files.length > 0) {
            formData.append('image', imgInput.files[0]);
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

// ===== MÃ‰TÃ‰O =====
async function updateWeather() {
    const widget = document.getElementById('weatherWidget');
    if (!widget) return;
    try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=36.7525&longitude=3.04197&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m');
        const data = await response.json();
        const temp = Math.round(data.current.temperature_2m); const code = data.current.weather_code;
        let icon = 'fa-sun'; let color = '#fbbf24';
        if (code >= 1 && code <= 3) { icon = 'fa-cloud-sun'; color = '#94a3b8'; }
        if (code >= 45 && code <= 48) { icon = 'fa-smog'; color = '#64748b'; }
        if (code >= 51 && code <= 67) { icon = 'fa-cloud-rain'; color = '#60a5fa'; }
        if (code >= 71 && code <= 77) { icon = 'fa-snowflake'; color = '#bae6fd'; }
        if (code >= 80 && code <= 82) { icon = 'fa-cloud-showers-heavy'; color = '#2563eb'; }
        if (code >= 95) { icon = 'fa-bolt'; color = '#ef4444'; }
        widget.innerHTML = `<i class="fas ${icon}" style="color:${color}; margin-right:5px;"></i> ${temp}Â°C`;
        widget.title = `MÃ©tÃ©o Alger - HumiditÃ©: ${data.current.relative_humidity_2m}% | Vent: ${data.current.wind_speed_10m} km/h`;
    } catch (e) { widget.innerHTML = `<i class="fas fa-sun" style="color:#fbbf24"></i> 22Â°C`; }
}

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
let veilleData = { manual: [], feed: [] };
async function loadVeille() {
    const loader = document.getElementById('veilleLoading');
    if(loader) loader.style.display = 'block';
    try {
        const res = await fetch(`${API_BASE}/api/veille`);
        if(!res.ok) throw new Error('Erreur chargement veille');
        veilleData = await res.json();
        renderVeilleTable();
        if(loader) loader.style.display = 'none';
    } catch(e) { console.error(e); if(loader) loader.textContent = 'âš ï¸  Impossible de synchroniser la veille.'; }
}

function renderVeilleTable() {
    const tbody = document.getElementById('veilleBody');
    if(!tbody) return;
    const all = [...veilleData.feed, ...veilleData.manual].sort((a,b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = all.map(a => {
        const date = new Date(a.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
        const tagsHtml = (a.tags || []).map(t => `<span class="veille-tag">${t}</span>`).join('');
        const actionsHtml = a.isManual ? `<button class="veille-btn edit" title="Modifier" onclick="openVeilleModal('edit', '${a.id}')"><i class="fas fa-pencil-alt"></i></button><button class="veille-btn delete" title="Supprimer" onclick="deleteVeilleArticle('${a.id}')"><i class="fas fa-trash"></i></button>` : `<button class="veille-btn" title="Ouvrir la source" onclick="window.open('${a.url}', '_blank')"><i class="fas fa-external-link-alt"></i></button>`;
        return `<tr><td style="white-space:nowrap; font-size:0.8rem; color:var(--text-light);">${date}</td><td><a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.title}</a></td><td>${tagsHtml}</td><td><span class="veille-source">${a.source}</span></td><td><div class="veille-actions">${actionsHtml}</div></td></tr>`;
    }).join('');
}

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

// ================================================================
//  REVUE DE PRESSE — RENDU GRAND JOURNAL (override renderRevueCards)
//  Append pur — aucune ligne existante modifiée
// ================================================================
(function () {

    // ── Police éditoriale Playfair Display ──────────────────────
    if (!document.getElementById('playfair-font')) {
        var lk = document.createElement('link');
        lk.id = 'playfair-font';
        lk.rel = 'stylesheet';
        lk.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&display=swap';
        document.head.appendChild(lk);
    }

    // ── Normalisation des catégories (encodage Mistral) ─────────
    function normCat(cat) {
        if (!cat) return 'Innovation';
        var fixes = {
            'Numérique':'Mobile','Num??rique':'Mobile','Num?rique':'Mobile',
            'Numerique':'Mobile','numérique':'Mobile',
            'Télécoms':'Télécoms','T?l?coms':'Télécoms',
            'Cybersécurité':'Cybersécurité','Cybers?curit?':'Cybersécurité',
            'Réseaux':'Réseaux','R?seaux':'Réseaux'
        };
        return fixes[cat] || cat;
    }

    // ── Catégorie → classe CSS ──────────────────────────────────
    function catCls(cat) {
        var normalized = normCat(cat);
        var m = {
            'IA':'ia','Télécoms':'telecoms','Startups':'startups',
            'Innovation':'innovation','Mobile':'numerique',
            'Cybersécurité':'cybersecurite','Réseaux':'reseaux'
        };
        return m[normalized] || 'default';
    }

    // ── Render article à la UNE ─────────────────────────────────
    function renderUne(a) {
        var cat = normCat(a.categorie);
        var pc = a.pays === 'DZ' ? 'dz' : 'fr';
        var pl = a.pays === 'DZ' ? '🇩🇿 Algérie' : '🌐 International';
        return '<div class="revue-une">'
            + '<div class="revue-une-left">'
            +   '<span class="revue-une-cat">' + cat + '</span>'
            +   '<h2 class="revue-une-title">' + a.titre + '</h2>'
            +   '<p class="revue-une-accroche">' + (a.accroche || a.resume) + '</p>'
            +   '<a href="' + a.url + '" target="_blank" rel="noopener" class="revue-une-link">'
            +     'Lire l\'article &nbsp;&#8594;'
            +   '</a>'
            + '</div>'
            + '<div class="revue-une-right">'
            +   '<div class="revue-une-source-row">'
            +     '<img class="revue-une-logo" src="' + a.logo + '" alt="' + a.source + '" onerror="this.style.display=\'none\'">'
            +     '<span class="revue-une-source-name">' + a.source + '</span>'
            +     '<span class="revue-une-pays ' + pc + '">' + pl + '</span>'
            +   '</div>'
            +   '<p class="revue-une-resume">' + (a.resume || a.accroche) + '</p>'
            + '</div>'
            + '</div>';
    }

    // ── Render carte standard ────────────────────────────────────
    function renderCard(a) {
        var cc = catCls(normCat(a.categorie));
        var pc = a.pays === 'DZ' ? 'dz' : 'fr';
        var pl = a.pays === 'DZ' ? '🇩🇿 DZ' : '🌐 Intl';
        return '<div class="revue-card-journal">'
            + '<span class="revue-card-cat cat-' + cc + '">' + a.categorie + '</span>'
            + '<h3 class="revue-card-title-journal">' + a.titre + '</h3>'
            + '<p class="revue-card-accroche-journal">' + (a.accroche || a.resume) + '</p>'
            + '<div class="revue-card-footer-journal">'
            +   '<img class="revue-card-logo-sm" src="' + a.logo + '" alt="' + a.source + '" onerror="this.style.display=\'none\'">'
            +   '<span class="revue-card-source-sm">' + a.source + '</span>'
            +   '<span class="revue-card-pays-sm ' + pc + '">' + pl + '</span>'
            +   '<a href="' + a.url + '" target="_blank" rel="noopener" class="revue-card-lire">Lire &#8594;</a>'
            + '</div>'
            + '</div>';
    }

    // ── Override principal ───────────────────────────────────────
    renderRevueCards = function () {
        var container = document.getElementById('revueContent');
        if (!container || !_revueData) return;

        // Filtre actif
        // Boutons filtres — construits en premier (nécessaires pour le mode Archives aussi)
        var cats = [];
        _revueData.articles.forEach(function (a) {
            var c = normCat(a.categorie);
            if (cats.indexOf(c) === -1) cats.push(c);
        });
        cats.sort();
        var fBtns = [
            { key: 'all', label: 'Toutes' },
            { key: 'DZ',  label: '🇩🇿 Algérie' },
            { key: 'FR',  label: '🌐 International' }
        ].concat(cats.map(function (c) { return { key: c, label: c }; }))
         .concat([{ key: 'archives', label: '📁 Archives', cls: 'archives-btn' }]);

        // ── Helper : rendu barre filtres ────────────────────────────
        function filterBar() {
            return '<div class="revue-toolbar">'
                + '<div class="revue-filters-journal">'
                + fBtns.map(function(f) {
                    return '<button class="revue-filter-journal'
                        + (_revueFilter === f.key ? ' active' : '')
                        + (f.cls ? ' ' + f.cls : '')
                        + '" onclick="setRevueFilter(\'' + f.key + '\')">' + f.label + '</button>';
                  }).join('')
                + '</div>'
                + '<span class="revue-count-journal" id="revueCount"></span>'
                + '</div>';
        }

        // ── Helper : rendu masthead compact ─────────────────────────
        function mastheadHtml(dateLabel) {
            return '<div class="revue-masthead">'
                + '<div class="revue-masthead-brand">'
                +   '<span class="revue-masthead-label">✶ Edition quotidienne</span>'
                +   '<div class="revue-masthead-title">Revue de <span>Presse</span></div>'
                +   '<div class="revue-masthead-subtitle">TIC &amp; Télécoms · Algérie &amp; International</div>'
                + '</div>'
                + '<div class="revue-masthead-date"><strong>' + dateLabel + '</strong></div>'
                + '</div>';
        }

        // Mode Archives : afficher le sélecteur de date
        if (_revueFilter === 'archives') {
            var today = new Date().toISOString().split('T')[0];
            container.innerHTML = '<div class="revue-header-sticky">'
                + mastheadHtml('Archives')
                + filterBar()
                + '</div>'
                + '<div class="revue-grid-journal">'
                + '<div class="revue-archive-picker">'
                + '<h4>📅 Consulter une édition précédente</h4>'
                + '<p>Les archives sont disponibles à partir du lendemain de leur génération.</p>'
                + '<div class="revue-archive-row">'
                + '<input type="date" class="revue-archive-input" id="revueArchiveDate" max="' + today + '">'
                + '<button class="revue-archive-btn" onclick="loadRevueArchive()">Consulter cette édition</button>'
                + '</div>'
                + '</div></div>';
            return;
        }

        var articles = _revueData.articles.filter(function (a) {
            if (_revueFilter === 'all') return true;
            if (_revueFilter === 'DZ')  return a.pays === 'DZ';
            if (_revueFilter === 'FR')  return a.pays === 'FR';
            return normCat(a.categorie) === _revueFilter;
        });

        var nbSources = _revueData.totalSources || 16;
        var hero  = articles[0];
        var reste = articles.slice(1);

        var html = '';

        // ── Bloc sticky : Titre + Catégories ────────────────────────
        html += '<div class="revue-header-sticky">';
        html += mastheadHtml(_revueData.date);
        html += filterBar();
        html += '</div>';

        // ── Synthèse (hors sticky) ───────────────────────────────────
        html += '<div class="revue-synthese-bloc">'
            + '<div class="revue-synthese-eyelet">✦ Synthèse · '
            + articles.length + ' article' + (articles.length > 1 ? 's' : '') + ' · '
            + nbSources + ' sources</div>'
            + '<p class="revue-synthese-text">' + _revueData.synthese + '</p>'
            + '</div>';

        // Article à la UNE
        if (hero) html += renderUne(hero);

        // Grille
        html += '<div class="revue-grid-journal">';
        if (reste.length) {
            reste.forEach(function (a) { html += renderCard(a); });
        } else {
            html += '<p class="revue-empty-journal">Aucun article pour ce filtre.</p>';
        }
        html += '</div>';

        // Pied édition
        html += '<div class="revue-footer-edition">'
            + '<span class="revue-footer-sources">' + nbSources + ' sources · Mis à jour chaque matin à 05h00</span>'
            + '<span class="revue-footer-ai">'
            +   '<span class="revue-ai-pulse"></span>'
            +   'Sélection éditoriale automatique'
            + '</span>'
            + '</div>';

        container.innerHTML = html;
    };

})();
// ================================================================
//  FIN REFONTE GRAND JOURNAL
// ================================================================