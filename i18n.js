/* ══════════════════════════════════════════════════════════════════
   Algeria Tech — Moteur i18n  FR ↔ AR  v2.0
   ─────────────────────────────────────────────────────────────────
   • UI statique   : attributs data-i18n-ar  (instantané)
   • Articles      : Google Translate API non-officielle
                     6 requêtes en parallèle  → ~2-3 s pour 20 articles
                     Cache localStorage 7 jours (2e toggle = instantané)
   • Layout RTL    : html.ar { dir:rtl } + CSS dédié dans style.css
   • Persistance   : localStorage clé « at-lang »
═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ─── 1. Config ────────────────────────────────────────────────── */
const LANG_KEY   = 'at-lang';
const CACHE_KEY  = 'at-trans-v2';
const CACHE_TTL  = 7 * 24 * 3600 * 1000; // 7 jours
const MAX_PAR    = 6;                      // requêtes en parallèle max

/* ─── 2. Cache localStorage ────────────────────────────────────── */
let cache = {};
(function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const now = Date.now();
    Object.keys(raw).forEach(k => {
      if (now - (raw[k].ts || 0) < CACHE_TTL) cache[k] = raw[k].v;
    });
  } catch (_) {}
})();

function saveCache() {
  try {
    const out = {};
    const now = Date.now();
    Object.keys(cache).forEach(k => { out[k] = { v: cache[k], ts: now }; });
    localStorage.setItem(CACHE_KEY, JSON.stringify(out));
  } catch (_) {}
}

/* ─── 3. Parallélisme limité ───────────────────────────────────── */
let activeReqs = 0;
const reqWaiters = [];

function withLimit(fn) {
  if (activeReqs < MAX_PAR) {
    activeReqs++;
    return fn().finally(() => {
      activeReqs--;
      if (reqWaiters.length) reqWaiters.shift()();
    });
  }
  return new Promise(resolve => {
    reqWaiters.push(() => resolve(withLimit(fn)));
  });
}

/* ─── 4. Google Translate non-officielle (client=gtx) ─────────── */
/*  Gratuit, sans clé, supporte CORS navigateur, ~300 ms/requête.
    Fallback : retourne le texte original si erreur réseau.          */
async function apiTranslate(text) {
  if (!text || text.length < 3)         return text;
  if (/[؀-ۿ]/.test(text))     return text;  // déjà arabe
  if (cache[text])                      return cache[text];

  return withLimit(async () => {
    try {
      const url =
        'https://translate.googleapis.com/translate_a/single' +
        `?client=gtx&sl=fr&tl=ar&dt=t&q=${encodeURIComponent(text.slice(0, 1000))}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      /* Structure : [[["trad","orig"],["trad2","orig2"],...], null, "fr", ...] */
      const tr = (Array.isArray(j[0]) ? j[0] : [])
                  .map(p => (p && p[0]) ? p[0] : '').join('').trim();
      if (tr && tr !== text) { cache[text] = tr; saveCache(); }
      return tr || text;
    } catch (_) { return text; }
  });
}

/* ─── 5. Remplacement nœud texte (préserve icônes FontAwesome) ── */
function swapTextNode(el, newText) {
  for (let i = el.childNodes.length - 1; i >= 0; i--) {
    const n = el.childNodes[i];
    if (n.nodeType === 3 && n.textContent.trim()) {
      const lead  = /^\s/.test(n.textContent) ? ' ' : '';
      const trail = /\s$/.test(n.textContent) ? ' ' : '';
      n.textContent = lead + newText + trail;
      return;
    }
  }
  el.insertAdjacentText('beforeend', ' ' + newText);
}

/* ─── 6. UI statique — attributs data-i18n-ar ─────────────────── */
function applyUiLang(lang) {
  document.querySelectorAll('[data-i18n-ar]').forEach(el => {
    const arVal = el.dataset.i18nAr;

    /* <input> / <textarea> → placeholder uniquement */
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (!el.dataset.i18nFrSaved) el.dataset.i18nFrSaved = el.placeholder;
      el.placeholder = lang === 'ar' ? arVal : (el.dataset.i18nFrSaved || '');
      return;
    }

    /* Éléments texte : sauvegarde du texte FR au premier passage */
    if (!el.dataset.i18nFrSaved) {
      for (let i = el.childNodes.length - 1; i >= 0; i--) {
        const n = el.childNodes[i];
        if (n.nodeType === 3 && n.textContent.trim()) {
          el.dataset.i18nFrSaved = n.textContent.trim();
          break;
        }
      }
    }
    const target = lang === 'ar' ? arVal : (el.dataset.i18nFrSaved || '');
    if (target) swapTextNode(el, target);
  });

  /* Placeholder barre de recherche */
  const si = document.getElementById('searchInput');
  if (si) si.placeholder = lang === 'ar' ? 'بحث...' : 'Rechercher...';

  document.querySelectorAll('.mobile-search input').forEach(inp => {
    inp.placeholder = lang === 'ar' ? 'ابحث عن مقال...' : 'Rechercher un article...';
  });

  /* Bouton thème (mobile menu) */
  const mbt = document.querySelector('.mobile-theme-btn');
  if (mbt) {
    if (!mbt.dataset.i18nFrSaved) mbt.dataset.i18nFrSaved = 'Changer le thème';
    swapTextNode(mbt, lang === 'ar' ? 'تغيير السمة' : mbt.dataset.i18nFrSaved);
  }

  document.body.dir = lang === 'ar' ? 'rtl' : '';
}

/* ─── 7. Sélecteurs articles à traduire ───────────────────────── */
/*  Titres + Extraits + Corps complets de toutes les sections     */
const ART_SEL = [
  /* Grille principale */
  '.news-card-body h3',           // titre carte
  '.news-card-body > p',          // extrait carte

  /* Section héro */
  '.hero-overlay h2',             // titre héro principal + côté
  '.hero-overlay > p',            // extrait héro principal

  /* Veille V2 */
  '.v2-card-title a',             // titre

  /* Revue de presse — UNE */
  '.revue-une-title',             // titre
  '.revue-une-accroche',          // accroche
  '.revue-une-resume',            // résumé

  /* Revue de presse — grille journaux */
  '.revue-card-title-journal',    // titre
  '.revue-card-accroche-journal', // accroche

  /* Breaking news ticker */
  '.ticker-item',

  /* ── Page article (ouverture au clic) ── */
  '.article-body h1',             // titre principal
  '.article-text p',              // paragraphes du corps
  '.article-text h2',             // sous-titres (markdown ##)
  '.article-text h3',             // sous-sous-titres (markdown ###)
  '.article-text li',             // listes

  /* Articles liés (colonne droite de la page article) */
  '.related-card h4',

  /* Sidebar "Les Plus Lus" */
  '.trending-content h4',
].join(',');

/* ─── 8. Traduire une grille (fire & forget, parallel) ─────────── */
function translateGrid(root) {
  if (!root) return;
  root.querySelectorAll(ART_SEL).forEach(el => {
    if (el.dataset.atDone) return;       // déjà en cours ou traduit
    el.dataset.atDone = '1';
    const orig = el.textContent.trim();
    if (!orig || orig.length < 3) return;
    el.dataset.atOrig = orig;

    /* Légère atténuation pendant le chargement */
    el.style.transition = 'opacity .15s';
    el.style.opacity    = '.55';

    apiTranslate(orig).then(translated => {
      el.style.opacity = '';
      if (!document.documentElement.classList.contains('ar')) return;
      if (translated && translated !== orig) {
        el.textContent = translated;
        el.dir         = 'rtl';
      }
    });
  });
}

/* ─── 9. Restauration → français ──────────────────────────────── */
function restoreArticles() {
  document.querySelectorAll('[data-at-orig][data-at-done]').forEach(el => {
    el.textContent   = el.dataset.atOrig;
    el.dir           = '';
    el.style.opacity = '';
    delete el.dataset.atDone; // autorise la re-traduction si on revient en AR
  });
}

/* ─── 10. MutationObserver — surveillance des grilles ──────────── */
let obs = null;
const GRIDS = [
  '#newsGrid',
  '#heroGrid',
  '#breakingTicker',
  '#veilleCards',
  '#revueContent',
  '.revue-cards-grid',
  '#articleContent',   // page article ouverte au clic
  '#relatedGrid',      // articles liés (bas de page article)
  '#trendingList',     // sidebar "Les Plus Lus"
].join(', ');

function watchGrids() {
  if (obs) obs.disconnect();
  obs = new MutationObserver(() => {
    if (!document.documentElement.classList.contains('ar')) return;
    document.querySelectorAll(GRIDS).forEach(translateGrid);
  });
  document.querySelectorAll(GRIDS).forEach(g =>
    obs.observe(g, { childList: true, subtree: true })
  );
}

/* ─── 11. Bouton(s) toggle — mise à jour visuelle ─────────────── */
function updateBtn(lang) {
  const arHtml = '<b class="lt-active">ع</b><span class="lt-sep">|</span><span class="lt-dim">FR</span>';
  const frHtml = '<span class="lt-dim">ع</span><span class="lt-sep">|</span><b class="lt-active">FR</b>';
  const html  = lang === 'ar' ? arHtml : frHtml;
  const title = lang === 'ar' ? 'Passer en français' : 'التبديل إلى العربية';

  ['langToggle', 'langToggleMobile'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.innerHTML = html;
    btn.title     = title;
    btn.setAttribute('aria-label', title);
  });
}

/* ─── 12. Appliquer la langue ──────────────────────────────────── */
function applyLang(lang) {
  const html  = document.documentElement;
  html.lang   = lang;
  html.dir    = lang === 'ar' ? 'rtl' : 'ltr';
  html.classList.toggle('ar', lang === 'ar');

  /* Police Cairo pour l'arabe */
  document.body.style.fontFamily = lang === 'ar'
    ? "'Cairo', 'Inter', sans-serif" : '';

  applyUiLang(lang);
  updateBtn(lang);
  localStorage.setItem(LANG_KEY, lang);

  if (lang === 'ar') {
    /* Lance toutes les traductions en parallèle */
    document.querySelectorAll(GRIDS).forEach(translateGrid);
    watchGrids();
  } else {
    restoreArticles();
    if (obs) { obs.disconnect(); obs = null; }
  }

  window.dispatchEvent(new CustomEvent('at:lang', { detail: { lang } }));
}

/* ─── 13. API publique ─────────────────────────────────────────── */
window.AT_LANG = {
  get current() { return localStorage.getItem(LANG_KEY) || 'fr'; },
  toggle()      { applyLang(this.current === 'fr' ? 'ar' : 'fr'); },
  set(lang)     { applyLang(lang); },
  translate:    apiTranslate,
};

/* ─── 14. Démarrage ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  updateBtn(AT_LANG.current);
  watchGrids(); // pré-chauffe l'observer (même en mode FR)
  if (AT_LANG.current === 'ar') applyLang('ar');
});

})(); /* IIFE — seul AT_LANG exposé globalement */
