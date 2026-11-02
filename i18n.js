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

/* ─── Dictionnaire pré-traduit (i18n-titles-xx.json, généré au build) ─
   Titres + chapeaux de tous les articles → bascule instantanée, sans API. */
const norm = t => String(t || '').replace(/\s+/g, ' ').trim();
const dicts = {}, dictLoads = {};
function loadDict(tl) {
  if (tl === 'fr') return Promise.resolve();
  if (!dictLoads[tl]) {
    dictLoads[tl] = fetch('/i18n-titles-' + tl + '.json')
      .then(r => r.ok ? r.json() : {})
      .then(d => { dicts[tl] = d || {}; })
      .catch(() => { dicts[tl] = {}; });
  }
  return dictLoads[tl];
}
/* Corps d'article : i18n/<tl>/<id>.json, fusionné dans le dictionnaire de la langue. */
const artLoads = {};
function loadArticle(id, tl) {
  tl = tl || document.documentElement.getAttribute('data-lang');
  if (!id || !tl || tl === 'fr') return Promise.resolve();
  const k = tl + ':' + id;
  if (!artLoads[k]) {
    artLoads[k] = Promise.all([
      loadDict(tl),
      fetch('/i18n/' + tl + '/' + encodeURIComponent(id) + '.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([, d]) => { dicts[tl] = Object.assign(dicts[tl] || {}, d); });
  }
  return artLoads[k];
}
// Précharge (au repos) les articles visibles en tête d'accueil + au survol/toucher d'une carte.
function prefetchShown(tl) {
  const idle = window.requestIdleCallback || (f => setTimeout(f, 800));
  idle(() => {
    const ids = [];
    document.querySelectorAll('#heroGrid [onclick*="openArticle"], #newsGrid [onclick*="openArticle"]').forEach(el => {
      const m = (el.getAttribute('onclick') || '').match(/openArticle\('([^']+)'/);
      if (m && !ids.includes(m[1])) ids.push(m[1]);
    });
    ids.slice(0, 8).forEach(id => loadArticle(id, tl));
  });
}
['mouseover', 'touchstart'].forEach(ev => document.addEventListener(ev, e => {
  const tl = document.documentElement.getAttribute('data-lang');
  if (!tl || tl === 'fr') return;
  const el = e.target.closest && e.target.closest('[onclick*="openArticle"]');
  const m = el && (el.getAttribute('onclick') || '').match(/openArticle\('([^']+)'/);
  if (m) loadArticle(m[1], tl);
}, { passive: true }));

/* Libellés fixes de l'accueil PC (desktop-home.js) */
const UI = {
  ar: { "Plus d'actualités": 'مزيد من الأخبار', "Suite de l'actualité": 'تتمة الأخبار', 'Interactif': 'تفاعلي', 'Archives': 'الأرشيف',
        'Brèves': 'موجزات', 'Les plus lus': 'الأكثر قراءة', 'Flash Info': 'موجز الأخبار', "L'info en 30 s": 'الخبر في 30 ثانية', 'À LA UNE': 'الأبرز', 'IA': 'الذكاء الاصطناعي' },
  en: { "Plus d'actualités": 'More news', "Suite de l'actualité": 'More stories', 'Interactif': 'Interactive', 'Archives': 'Archives',
        'Brèves': 'In brief', 'Les plus lus': 'Most read', 'Flash Info': 'News Flash', "L'info en 30 s": 'News in 30 s', 'À LA UNE': 'TOP STORY', 'IA': 'AI' },
};
const fuzzy = {};
function dictGet(text, tl) {
  const d = dicts[tl]; if (!d) return null;
  const t = norm(text);
  if (UI[tl] && UI[tl][t]) return UI[tl][t];
  if (d[t]) return d[t];
  // « À LA UNE · ENTREPRISES » : bandeau + catégorie
  const b = t.match(/^À LA UNE · (.+)$/);
  if (b) { const c = Object.keys(d).find(k => k.toUpperCase() === b[1]); return (UI[tl]['À LA UNE']) + ' · ' + (c ? d[c] : b[1]); }
  // Chapeau raccourci par l'accueil PC (« … » en fin, « ALGER — » parfois retiré) : on retrouve le texte complet
  if (!/…$/.test(t) || t.length < 25) return null;
  const k = tl + ':' + t;
  if (!(k in fuzzy)) {
    const part = t.replace(/…$/, '').trim();
    const full = Object.keys(d).find(x => x.length > part.length && x.includes(part));
    fuzzy[k] = null;
    if (full) {
      const tr = d[full], n = Math.round(tr.length * part.length / full.length);
      fuzzy[k] = tr.length > n + 10 ? tr.slice(0, n).replace(/\s+\S*$/, '') + '…' : tr;
    }
  }
  return fuzzy[k];
}

let saveTimer = null;
function saveCache() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCacheNow, 1500);
}
function saveCacheNow() {
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
  const d = dictGet(text, tl);
  if (d) return d;
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
  // Accueil PC (desktop-home.js)
  '.dh-une h1', '.dh-tx > p:not(.dh-m)', '.dh-tx h3', '.dh-cb h3', '.dh-st h4', '.dh-ex',
  '.dh-t', '.dh-badge', '.dh-cat', '.dh-catl', '.dh-inter', '.dh-arch-t', '.dh-fl b', '.dh-tabs button',
].join(',');

/* ─── Traduire une grille ──────────────────────────────────────── */
function translateGrid(root, tl) {
  if (!root) return;
  root.querySelectorAll(ART_SEL).forEach(el => {
    const doneKey = `atDone_${tl}`;
    if (el.dataset[doneKey]) return;
    el.dataset[doneKey] = '1';
    const orig = el.dataset.atOrig || el.textContent.trim();
    if (!orig || (orig.length < 3 && !(UI[tl] && UI[tl][orig]))) return;
    if (!el.dataset.atOrig) el.dataset.atOrig = orig;
    const hit = dictGet(orig, tl);
    if (hit) {                       // instantané : pas d'appel réseau
      el.textContent = hit;
      el.dir = tl === 'ar' ? 'rtl' : '';
      return;
    }
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
  '#dhFlash','.dh-tabs','#pagination','#brevesList',
].join(', ');

// Observe toute la page (les blocs de l'accueil PC sont créés après coup), mutations regroupées en 1 passage.
let obsQueued = false;
function watchGrids(tl) {
  if (obs) obs.disconnect();
  obs = new MutationObserver(() => {
    if (obsQueued) return;
    obsQueued = true;
    // setTimeout et non requestAnimationFrame : ce dernier ne tourne pas tant que l'onglet n'est pas affiché
    setTimeout(() => {
      obsQueued = false;
      const cur = document.documentElement.getAttribute('data-lang');
      if (cur === 'fr') return;
      document.querySelectorAll(GRIDS).forEach(g => translateGrid(g, cur));
    }, 30);
  });
  obs.observe(document.body, { childList: true, subtree: true });
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
  try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}

  if (lang !== 'fr') {
    loadDict(lang).then(() => {
      if (html.getAttribute('data-lang') !== lang) return;
      document.querySelectorAll(GRIDS).forEach(g => translateGrid(g, lang));
      watchGrids(lang);
      prefetchShown(lang);
    });
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
    this.set(CYCLE[(idx + 1) % CYCLE.length]);
  },
  toggle() { this.cycle(); },
  set(lang) {                      // choix explicite du visiteur : prioritaire sur la détection pays
    try { localStorage.setItem(USER_KEY, lang); } catch (_) {}
    applyLang(lang);
  },
  detect: detectLang,
  loadArticle: loadArticle,          // appelé par openArticle() avant l'affichage
  translate: apiTranslate,
};

/* ─── Langue de départ ─────────────────────────────────────────────
   1) choix explicite du visiteur (bouton langue)  2) pays (Cloudflare)
   3) langue du navigateur. Algérie → arabe ; francophones → français ;
   reste du monde → anglais (sauf navigateur réglé en fr/ar). */
const USER_KEY = 'at-lang-user';
const GEO_KEY  = 'at-lang-geo';
const AR_CC = 'DZ,SA,AE,QA,KW,BH,OM,YE,IQ,JO,SY,LB,PS,EG,LY,SD';
const FR_CC = 'FR,BE,CH,LU,MC,MA,TN,MR,SN,CI,ML,BF,NE,TG,BJ,GN,CM,GA,CG,CD,CF,TD,MG,DJ,KM,HT,RE,GP,MQ,GF,YT,PF,NC,BI,RW';
function langFromNavigator() {
  const l = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
  return l.startsWith('fr') ? 'fr' : l.startsWith('ar') ? 'ar' : 'en';
}
function langFromCountry(cc, nav) {
  if (cc === 'DZ') return 'ar';
  if (AR_CC.split(',').includes(cc)) return nav === 'fr' ? 'fr' : 'ar';
  if (FR_CC.split(',').includes(cc)) return nav === 'ar' ? 'ar' : 'fr';
  if (cc === 'CA') return nav === 'fr' ? 'fr' : 'en';
  return nav === 'en' ? 'en' : nav;          // navigateur fr/ar hors zone : on le respecte
}
async function detectLang() {
  const nav = langFromNavigator();
  try {
    const r = await fetch('/cdn-cgi/trace', { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    const m = r.ok && (await r.text()).match(/^loc=([A-Z]{2})$/m);
    if (m) return langFromCountry(m[1], nav);
  } catch (_) {}
  return nav;
}
function startLang() {
  let user = null, geo = null;
  try { user = localStorage.getItem(USER_KEY); geo = localStorage.getItem(GEO_KEY); } catch (_) {}
  if (CYCLE.includes(user)) return applyLang(user);
  // ?lang=ar|en|fr dans l'URL : forçage ponctuel (liens partagés, tests)
  const q = (location.search.match(/[?&]lang=(fr|ar|en)\b/) || [])[1];
  if (q) return applyLang(q);
  applyLang(CYCLE.includes(geo) ? geo : 'fr');   // visite suivante : instantané
  detectLang().then(l => {
    try { localStorage.setItem(GEO_KEY, l); } catch (_) {}
    let u = null; try { u = localStorage.getItem(USER_KEY); } catch (_) {}
    if (!u && l !== document.documentElement.getAttribute('data-lang')) applyLang(l);
  });
}

/* ─── Démarrage ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', startLang);

})();
