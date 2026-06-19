/* ══════════════════════════════════════════════════════════════════
   Algeria Tech — Moteur i18n  FR ↔ AR ↔ EN  v3.0
   ─────────────────────────────────────────────────────────────────
   • UI statique   : attributs data-i18n-ar / data-i18n-en
   • Articles      : Google Translate API non-officielle
   • Layout RTL    : html.ar { dir:rtl } + CSS dédié dans style.css
   • Persistance   : localStorage clé « at-lang »
═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

const LANG_KEY   = 'at-lang';
const CACHE_KEY  = 'at-trans-v3';
const CACHE_TTL  = 7 * 24 * 3600 * 1000;
const MAX_PAR    = 6;
const CYCLE      = ['fr', 'ar', 'en'];

/* ─── Cache localStorage ───────────────────────────────────────── */
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

/* ─── Parallélisme limité ──────────────────────────────────────── */
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
  return new Promise(resolve => { reqWaiters.push(() => resolve(withLimit(fn))); });
}

/* ─── Google Translate non-officielle (client=gtx) ────────────── */
async function apiTranslate(text, tl) {
  if (!text || text.length < 3) return text;
  if (tl === 'ar' && /[؀-ۿ]/.test(text)) return text;
  const cKey = `${tl}:${text}`;
  if (cache[cKey]) return cache[cKey];

  return withLimit(async () => {
    try {
      const url =
        'https://translate.googleapis.com/translate_a/single' +
        `?client=gtx&sl=fr&tl=${tl}&dt=t&q=${encodeURIComponent(text.slice(0, 1000))}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      const tr = (Array.isArray(j[0]) ? j[0] : [])
                  .map(p => (p && p[0]) ? p[0] : '').join('').trim();
      if (tr && tr !== text) { cache[cKey] = tr; saveCache(); }
      return tr || text;
    } catch (_) { return text; }
  });
}

/* ─── Remplacement nœud texte (préserve icônes FontAwesome) ───── */
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

/* ─── UI statique ──────────────────────────────────────────────── */
function applyUiLang(lang) {
  document.querySelectorAll('[data-i18n-ar], [data-i18n-en]').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (!el.dataset.i18nFrSaved) el.dataset.i18nFrSaved = el.placeholder;
      if (lang === 'ar') el.placeholder = el.dataset.i18nAr || el.dataset.i18nFrSaved;
      else if (lang === 'en') el.placeholder = el.dataset.i18nEn || el.dataset.i18nFrSaved;
      else el.placeholder = el.dataset.i18nFrSaved || '';
      return;
    }
    if (!el.dataset.i18nFrSaved) {
      for (let i = el.childNodes.length - 1; i >= 0; i--) {
        const n = el.childNodes[i];
        if (n.nodeType === 3 && n.textContent.trim()) {
          el.dataset.i18nFrSaved = n.textContent.trim();
          break;
        }
      }
    }
    let target;
    if (lang === 'ar') target = el.dataset.i18nAr;
    else if (lang === 'en') target = el.dataset.i18nEn;
    if (!target) target = el.dataset.i18nFrSaved || '';
    if (target) swapTextNode(el, target);
  });

  const phMap = {
    fr: { search: 'Rechercher...', searchMob: 'Rechercher un article...' },
    ar: { search: 'بحث...',         searchMob: 'ابحث عن مقال...' },
    en: { search: 'Search...',      searchMob: 'Search for an article...' },
  };
  const ph = phMap[lang] || phMap.fr;
  const si = document.getElementById('searchInput');
  if (si) si.placeholder = ph.search;
  document.querySelectorAll('.mobile-search input').forEach(inp => { inp.placeholder = ph.searchMob; });

  const mbt = document.querySelector('.mobile-theme-btn');
  if (mbt) {
    if (!mbt.dataset.i18nFrSaved) mbt.dataset.i18nFrSaved = 'Changer le thème';
    const labels = { fr: mbt.dataset.i18nFrSaved, ar: 'تغيير السمة', en: 'Change theme' };
    swapTextNode(mbt, labels[lang] || labels.fr);
  }

  document.body.dir = lang === 'ar' ? 'rtl' : '';
}

/* ─── Sélecteurs articles à traduire ──────────────────────────── */
const ART_SEL = [
  '.news-card-body h3', '.news-card-body > p',
  '.hero-overlay h2', '.hero-overlay > p',
  '.v2-card-title a',
  '.revue-une-title', '.revue-une-accroche', '.revue-une-resume',
  '.revue-card-title-journal', '.revue-card-accroche-journal',
  '.ticker-item',
  '.article-body h1', '.article-text p', '.article-text h2',
  '.article-text h3', '.article-text li',
  '.related-card h4', '.trending-content h4',
].join(',');

/* ─── Traduire une grille ──────────────────────────────────────── */
function translateGrid(root, tl) {
  if (!root) return;
  root.querySelectorAll(ART_SEL).forEach(el => {
    const doneKey = `atDone_${tl}`;
    if (el.dataset[doneKey]) return;
    el.dataset[doneKey] = '1';
    const orig = el.dataset.atOrig || el.textContent.trim();
    if (!orig || orig.length < 3) return;
    if (!el.dataset.atOrig) el.dataset.atOrig = orig;
    el.style.transition = 'opacity .15s';
    el.style.opacity    = '.55';
    apiTranslate(orig, tl).then(translated => {
      el.style.opacity = '';
      const cur = document.documentElement.getAttribute('data-lang');
      if (cur !== tl) return;
      if (translated && translated !== orig) {
        el.textContent = translated;
        el.dir = tl === 'ar' ? 'rtl' : '';
      }
    });
  });
}

/* ─── Restauration → français ──────────────────────────────────── */
function restoreArticles() {
  document.querySelectorAll('[data-at-orig]').forEach(el => {
    if (el.dataset.atOrig) {
      el.textContent   = el.dataset.atOrig;
      el.dir           = '';
      el.style.opacity = '';
      // réinitialise les flags de traduction
      Object.keys(el.dataset).forEach(k => { if (k.startsWith('atDone')) delete el.dataset[k]; });
    }
  });
}

/* ─── MutationObserver ─────────────────────────────────────────── */
let obs = null;
const GRIDS = [
  '#newsGrid','#heroGrid','#breakingTicker','#veilleCards','#revueContent',
  '.revue-cards-grid','#articleContent','#relatedGrid','#trendingList',
].join(', ');

function watchGrids(tl) {
  if (obs) obs.disconnect();
  obs = new MutationObserver(() => {
    const cur = document.documentElement.getAttribute('data-lang');
    if (cur === 'fr') return;
    document.querySelectorAll(GRIDS).forEach(g => translateGrid(g, cur));
  });
  document.querySelectorAll(GRIDS).forEach(g => obs.observe(g, { childList: true, subtree: true }));
}

/* ─── Mise à jour bouton(s) ────────────────────────────────────── */
function updateBtn(lang) {
  ['langToggle', 'langToggleMobile'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.querySelectorAll('.lt-opt').forEach(opt => {
      opt.classList.toggle('lt-active', opt.dataset.lang === lang);
    });
    const labels = { fr: 'Passer en arabe', ar: 'Switch to English', en: 'Passer en français' };
    btn.title = labels[lang] || '';
  });
}

/* ─── Appliquer la langue ──────────────────────────────────────── */
function applyLang(lang) {
  const html = document.documentElement;
  html.lang  = lang;
  html.dir   = lang === 'ar' ? 'rtl' : 'ltr';
  html.classList.toggle('ar', lang === 'ar');
  html.setAttribute('data-lang', lang);

  document.body.style.fontFamily = lang === 'ar' ? "'Cairo', 'Inter', sans-serif" : '';

  applyUiLang(lang);
  updateBtn(lang);
  localStorage.setItem(LANG_KEY, lang);

  if (lang !== 'fr') {
    document.querySelectorAll(GRIDS).forEach(g => translateGrid(g, lang));
    watchGrids(lang);
  } else {
    restoreArticles();
    if (obs) { obs.disconnect(); obs = null; }
  }

  window.dispatchEvent(new CustomEvent('at:lang', { detail: { lang } }));
}

/* ─── API publique ─────────────────────────────────────────────── */
window.AT_LANG = {
  get current() { return localStorage.getItem(LANG_KEY) || 'fr'; },
  cycle() {
    const idx = CYCLE.indexOf(this.current);
    applyLang(CYCLE[(idx + 1) % CYCLE.length]);
  },
  toggle() { this.cycle(); },
  set(lang) { applyLang(lang); },
  translate: apiTranslate,
};

/* ─── Démarrage ────────────────────────────────────────────────── */
/* Toujours démarrer en français — réinitialise tout l'état i18n au chargement */
document.addEventListener('DOMContentLoaded', () => {
  applyLang('fr');
  watchGrids();
});

})();
