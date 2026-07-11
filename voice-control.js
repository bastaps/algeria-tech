/**
 * Algeria Tech — Voice Control v3
 * Annyang.js (Web Speech API) · fr-FR · Zéro token · Zéro coût
 *
 * Stratégie :
 *   "algeria tech"        → accueil
 *   "catégorie [X]"       → filterByCategory(X)  — catégorie exacte
 *   "ouvre [terme]"       → recherche full-text dans tous les articles
 *   "interface arabe/anglais/français" → changement langue
 *   "mode nuit/jour"      → basculement thème
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // MAPPING — voix normalisée → nom exact de catégorie du site
  // ══════════════════════════════════════════════════════════════════════
  const CAT_MAP = {
    'algerie'                  : 'Algérie',
    'algérie'                  : 'Algérie',
    'telecom'                  : 'Télécoms',
    'telecoms'                 : 'Télécoms',
    'télécom'                  : 'Télécoms',
    'télécoms'                 : 'Télécoms',
    'teleco'                   : 'Télécoms',
    'mobile'                   : 'Mobile',
    'smartphone'               : 'Mobile',
    'startup'                  : 'Startups',
    'startups'                 : 'Startups',
    'start up'                 : 'Startups',
    'ia'                       : 'IA',
    'intelligence artificielle': 'IA',
    'intelligence artific'     : 'IA',
    'fintech'                  : 'Fintech',
    'finance tech'             : 'Fintech',
    'innovation'               : 'Innovation',
    'innovant'                 : 'Innovation',
    'internationale'           : 'Internationale',
    'international'            : 'Internationale',
    'monde'                    : 'Internationale',
    'monde entier'             : 'Internationale',
    'entreprise'               : 'Entreprises',
    'entreprises'              : 'Entreprises',
    'societes'                 : 'Entreprises',
    'video'                    : 'Vidéo',
    'vidéo'                    : 'Vidéo',
    'videos'                   : 'Vidéo',
    'film'                     : 'Vidéo',
    'infographie'              : 'Infographies',
    'infographies'             : 'Infographies',
    'infos'                    : 'Infographies',
  };

  // ══════════════════════════════════════════════════════════════════════
  // UTILS
  // ══════════════════════════════════════════════════════════════════════
  const BTN_ID   = 'vc-btn';
  const TOAST_ID = 'vc-toast';
  let isListening = false;

  function norm(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function resolveCategory(raw) {
    const n = norm(raw);
    // Correspondance exacte
    if (CAT_MAP[n]) return CAT_MAP[n];
    // Correspondance partielle
    for (const [key, val] of Object.entries(CAT_MAP)) {
      if (n.includes(key) || key.includes(n)) return val;
    }
    // Capitaliser et renvoyer tel quel
    return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
  }

  // ══════════════════════════════════════════════════════════════════════
  // TOAST
  // ══════════════════════════════════════════════════════════════════════
  function toast(msg, type) {
    const el = document.getElementById(TOAST_ID);
    if (!el) return;
    el.textContent = msg;
    el.className = 'vc-toast' + (type ? ' vc-toast--' + type : '');
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
    }, 3200);
  }

  // ══════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════════════════

  /* ── Accueil ── */
  function navHome() {
    toast('🏠 Algeria Tech — Accueil', 'ok');
    setTimeout(() => { if (typeof window.goHome === 'function') window.goHome(); }, 280);
  }

  /* ── Catégorie précise ── */
  function navCategory(raw) {
    const cat = resolveCategory(raw);
    toast('🗂️ Catégorie : ' + cat, 'ok');
    setTimeout(() => {
      if (typeof window.filterByCategory === 'function') {
        window.filterByCategory(cat);
      } else {
        window.location.href = '/?cat=' + encodeURIComponent(cat);
      }
    }, 280);
  }

  /* ── Recherche full-text ("ouvre [terme]") ── */
  function navSearch(query) {
    const q = (query || '').trim();
    if (!q) return;
    toast('🔍 ' + q + '…', 'ok');
    setTimeout(() => {
      // Ouvrir la barre de recherche
      const bar    = document.getElementById('atSearch');
      const input  = document.getElementById('searchInput');
      const toggle = document.getElementById('searchToggle');
      if (!input) return;
      if (bar && !bar.classList.contains('open')) {
        bar.classList.add('open');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
      }
      // Revenir à la grille pour que les résultats soient visibles
      if (typeof window.goHome === 'function') window.goHome();
      setTimeout(() => {
        input.value = q;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }, 320);
    }, 280);
  }

  /* ── Sections de navigation ── */
  function navRevue() {
    toast('📰 Revue de Presse', 'ok');
    setTimeout(() => { if (typeof window.showRevue === 'function') window.showRevue(); }, 280);
  }

  function navVeille(flux) {
    toast('📡 Veille' + (flux ? ' — ' + flux : ''), 'ok');
    setTimeout(() => {
      if (typeof window.showVeille === 'function') window.showVeille();
      if (flux) {
        setTimeout(() => {
          if (typeof window.switchVeilleFlux === 'function') {
            const btn = document.querySelector(`.v2-tab[data-flux="${flux}"]`);
            window.switchVeilleFlux(flux, btn || null);
          }
        }, 420);
      }
    }, 280);
  }

  /* ── Langue ── */
  function setLang(code, label) {
    toast('🌐 Interface ' + label, 'ok');
    setTimeout(() => {
      if (window.AT_LANG && typeof window.AT_LANG.set === 'function') {
        window.AT_LANG.set(code);
      }
    }, 280);
  }

  /* ── Thème ── */
  function setTheme(dark) {
    const isDark = document.body.classList.contains('dark-mode');
    if (dark === isDark) { toast(dark ? '🌙 Déjà en mode nuit' : '☀️ Déjà en mode jour'); return; }
    toast(dark ? '🌙 Mode nuit' : '☀️ Mode jour', 'ok');
    setTimeout(() => {
      if (typeof window.toggleTheme === 'function') window.toggleTheme();
      else {
        document.body.classList.toggle('dark-mode', dark);
        localStorage.setItem('theme', dark ? 'dark' : 'light');
      }
    }, 280);
  }

  /* ── Stop écoute ── */
  function stopCmd() {
    toast('🔇 Contrôle vocal désactivé');
    setTimeout(stopListening, 300);
  }

  // ══════════════════════════════════════════════════════════════════════
  // COMMANDES ANNYANG
  // Règle : Annyang teste les commandes dans l'ordre déclaration.
  // Les commandes fixes (sans splat) sont prioritaires sur les splat.
  // ══════════════════════════════════════════════════════════════════════
  const COMMANDS = {

    // ─── MOT-CLÉ BRAND → accueil ───────────────────────────────────
    'algeria tech'      : navHome,
    'algeria'           : navHome,
    'accueil'           : navHome,
    'retour accueil'    : navHome,
    'page accueil'      : navHome,
    'retour au site'    : navHome,
    'page principale'   : navHome,

    // ─── SECTIONS ──────────────────────────────────────────────────
    'revue de presse'        : navRevue,
    'ouvrir revue de presse' : navRevue,
    'revue presse'           : navRevue,

    'veille'             : () => navVeille(),
    'veille tech'        : () => navVeille(),
    'veille technologie' : () => navVeille(),

    'opérateurs'              : () => { toast('📶 Opérateurs','ok'); setTimeout(()=>{ window.location.href='/operateurs'; },280); },
    'comparateur opérateurs'  : () => { toast('📶 Opérateurs','ok'); setTimeout(()=>{ window.location.href='/operateurs'; },280); },
    'baromètre'               : () => { toast('📊 Baromètre', 'ok'); setTimeout(()=>{ window.location.href='/barometre';  },280); },
    'baromètre réseau'        : () => { toast('📊 Baromètre', 'ok'); setTimeout(()=>{ window.location.href='/barometre';  },280); },
    'wiki'                    : () => { toast('📖 Wiki',       'ok'); setTimeout(()=>{ window.location.href='/wiki';       },280); },
    'wiki tech'               : () => { toast('📖 Wiki',       'ok'); setTimeout(()=>{ window.location.href='/wiki';       },280); },

    // ─── LANGUE ────────────────────────────────────────────────────
    'interface arabe'      : () => setLang('ar', 'عربي'),
    'interface arab'       : () => setLang('ar', 'عربي'),
    'passe en arabe'       : () => setLang('ar', 'عربي'),
    'langue arabe'         : () => setLang('ar', 'عربي'),

    'interface anglais'    : () => setLang('en', 'English'),
    'interface anglaise'   : () => setLang('en', 'English'),
    'interface english'    : () => setLang('en', 'English'),
    'passe en anglais'     : () => setLang('en', 'English'),
    'langue anglaise'      : () => setLang('en', 'English'),

    'interface français'   : () => setLang('fr', 'Français'),
    'interface française'  : () => setLang('fr', 'Français'),
    'interface francais'   : () => setLang('fr', 'Français'),
    'passe en français'    : () => setLang('fr', 'Français'),
    'langue française'     : () => setLang('fr', 'Français'),
    'langue français'      : () => setLang('fr', 'Français'),

    // ─── THÈME ─────────────────────────────────────────────────────
    'mode nuit'      : () => setTheme(true),
    'mode sombre'    : () => setTheme(true),
    'mode dark'      : () => setTheme(true),
    'activer nuit'   : () => setTheme(true),

    'mode jour'      : () => setTheme(false),
    'mode clair'     : () => setTheme(false),
    'mode light'     : () => setTheme(false),
    'activer jour'   : () => setTheme(false),

    // ─── STOP ──────────────────────────────────────────────────────
    'stop'           : stopCmd,
    'arrêter écoute' : stopCmd,
    'désactiver voix': stopCmd,
    'silence'        : stopCmd,

    // ─── CATÉGORIE DYNAMIQUE (splat) ───────────────────────────────
    // "catégorie Djezzy" → navCategory (résolution + filterByCategory)
    'catégorie *cat'              : (c) => navCategory(c),
    'catégorie la *cat'           : (c) => navCategory(c),
    'ouvrir la catégorie *cat'    : (c) => navCategory(c),
    'afficher la catégorie *cat'  : (c) => navCategory(c),
    'aller catégorie *cat'        : (c) => navCategory(c),

    // ─── RECHERCHE FULL-TEXT (splat) ───────────────────────────────
    // "ouvre djezzy", "ouvre algérie télécom", "cherche 5G"…
    'ouvre *terme'         : (t) => navSearch(t),
    'ouvrir *terme'        : (t) => navSearch(t),
    'ouvrir l article *terme'  : (t) => navSearch(t),
    'montre moi *terme'    : (t) => navSearch(t),
    'montrer *terme'       : (t) => navSearch(t),
    'rechercher *terme'    : (t) => navSearch(t),
    'recherche *terme'     : (t) => navSearch(t),
    'chercher *terme'      : (t) => navSearch(t),
    'cherche *terme'       : (t) => navSearch(t),
    'trouver *terme'       : (t) => navSearch(t),
    'trouve *terme'        : (t) => navSearch(t),
    'articles sur *terme'  : (t) => navSearch(t),
    'article sur *terme'   : (t) => navSearch(t),
    'voir *terme'          : (t) => navSearch(t),
    'tous les articles *terme' : (t) => navSearch(t),
  };

  // ══════════════════════════════════════════════════════════════════════
  // TOGGLE ÉCOUTE
  // ══════════════════════════════════════════════════════════════════════
  function startListening() {
    if (!window.annyang) {
      toast('⚠️ Module vocal non prêt — réessayez', 'error');
      return;
    }
    annyang.setLanguage('fr-FR');
    annyang.removeCommands();
    annyang.addCommands(COMMANDS);
    annyang.start({ autoRestart: true, continuous: true });
    isListening = true;
    updateBtn();
    toast('🎙️ Écoute active — parlez !', 'ok');
  }

  function stopListening() {
    if (window.annyang) annyang.abort();
    isListening = false;
    updateBtn();
    toast('🔇 Contrôle vocal désactivé');
  }

  function toggleListening() {
    if (isListening) stopListening(); else startListening();
  }

  // ══════════════════════════════════════════════════════════════════════
  // UI
  // ══════════════════════════════════════════════════════════════════════
  const SVG_ON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8"  y1="23" x2="16" y2="23"/>
  </svg>`;

  const SVG_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8"  y1="23" x2="16" y2="23"/>
  </svg>`;

  function updateBtn() {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(isListening));
    btn.title = isListening ? 'Désactiver le contrôle vocal' : 'Activer le contrôle vocal';
    btn.innerHTML = isListening
      ? `<span class="vc-icon">${SVG_ON}<span class="vc-ripple"></span></span>`
      : `<span class="vc-icon">${SVG_OFF}</span>`;
  }

  function injectStyles() {
    const s = document.createElement('style');
    s.id = 'vc-styles';
    s.textContent = `
      /* ── Bouton ──────────────────────────────────────────────── */
      #${BTN_ID} {
        position: fixed; bottom: 168px; right: 20px; z-index: 9999;
        width: 54px; height: 54px; border-radius: 50%; border: none;
        cursor: pointer; color: #fff;
        display: flex; align-items: center; justify-content: center;
        transition: transform .15s;
        outline: none; -webkit-tap-highlight-color: transparent;
        /* Rouge inactif par défaut */
        background: #dc2626;
        box-shadow: 0 4px 18px rgba(220,38,38,.45);
        animation: vc-red-idle 2.8s ease-in-out infinite alternate;
      }
      @keyframes vc-red-idle {
        from { box-shadow: 0 4px 10px rgba(220,38,38,.35); }
        to   { box-shadow: 0 4px 28px rgba(220,38,38,.80); }
      }
      #${BTN_ID}:hover { transform: scale(1.1); }

      /* Vert clignotant quand actif */
      #${BTN_ID}[aria-pressed="true"] {
        background: #16a34a !important;
        animation: vc-green-blink .9s ease-in-out infinite alternate !important;
      }
      @keyframes vc-green-blink {
        from { box-shadow: 0 4px 10px rgba(22,163,74,.4); opacity: 1; }
        to   { box-shadow: 0 4px 36px rgba(22,163,74,1);  opacity: .85; }
      }

      .vc-icon { position:relative; display:flex; align-items:center; justify-content:center; }
      .vc-icon svg { width:23px; height:23px; display:block; }

      .vc-ripple {
        position:absolute; width:54px; height:54px; border-radius:50%;
        border:2.5px solid rgba(255,255,255,.65);
        animation: vc-ring 1.2s ease-out infinite; pointer-events:none;
      }
      @keyframes vc-ring {
        0%   { transform:scale(.82); opacity:1; }
        100% { transform:scale(1.75); opacity:0; }
      }

      /* ── Toast ───────────────────────────────────────────────── */
      #${TOAST_ID} {
        position:fixed; bottom:236px; right:20px; z-index:10000;
        background:rgba(12,12,12,.88); color:#fff;
        padding:10px 18px; border-radius:24px;
        font-size:13.5px; font-family:inherit; font-weight:500;
        pointer-events:none; opacity:0; transform:translateY(8px);
        transition:opacity .22s, transform .22s;
        max-width:270px; text-align:center;
        backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
        box-shadow:0 4px 22px rgba(0,0,0,.28);
        line-height:1.4;
      }
      #${TOAST_ID}.vc-toast--error { background:rgba(185,28,28,.92); }
      #${TOAST_ID}.vc-toast--ok    { background:rgba(20,83,45,.92); }

      /* ── Mobile ──────────────────────────────────────────────── */
      @media(max-width:480px){
        #${BTN_ID}   { bottom:150px; right:14px; width:48px; height:48px; }
        .vc-ripple   { width:48px; height:48px; }
        #${TOAST_ID} { bottom:210px; right:14px; font-size:12px; max-width:220px; }
      }
    `;
    document.head.appendChild(s);
  }

  function injectDOM() {
    injectStyles();

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.setAttribute('aria-label', 'Contrôle vocal Algeria Tech');
    btn.setAttribute('aria-pressed', 'false');
    document.body.appendChild(btn);

    const t = document.createElement('div');
    t.id = TOAST_ID;
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);

    updateBtn();
    btn.addEventListener('click', toggleListening);
  }

  // ══════════════════════════════════════════════════════════════════════
  // CHARGEMENT ANNYANG — CDN jsDelivr (gratuit, sans token)
  // Fallback natif si réseau indisponible
  // ══════════════════════════════════════════════════════════════════════
  function loadAnnyang(cb) {
    if (window.annyang) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/annyang@2.6.1/annyang.min.js';
    s.onload  = cb;
    s.onerror = () => {
      console.warn('[VoiceControl] CDN inaccessible — fallback natif activé.');
      initFallback();
    };
    document.head.appendChild(s);
  }

  // ── Fallback : Web Speech API native, regex à la place des splats ──────
  function initFallback() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = false;

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const raw = e.results[i][0].transcript;
        const n   = norm(raw);
        let m;

        // Langue
        if (n.includes('interface arabe')   || n.includes('passe en arabe'))   { setLang('ar','عربي');    return; }
        if (n.includes('interface anglais') || n.includes('passe en anglais'))  { setLang('en','English'); return; }
        if (n.includes('interface fran')    || n.includes('passe en fran'))     { setLang('fr','Français');return; }
        // Thème
        if (n.includes('mode nuit') || n.includes('mode sombre') || n.includes('mode dark'))  { setTheme(true);  return; }
        if (n.includes('mode jour') || n.includes('mode clair')  || n.includes('mode light')) { setTheme(false); return; }
        // Marque
        if (n === 'algeria tech' || n === 'algeria' || n.includes('retour accueil') || n === 'accueil') { navHome(); return; }
        // Sections fixes
        if (n.includes('revue de presse') || n.includes('revue presse')) { navRevue(); return; }
        if (n.startsWith('veille')) { navVeille(); return; }
        if (n.includes('operateur'))  { toast('📶 Opérateurs','ok'); setTimeout(()=>{ window.location.href='/operateurs'; },280); return; }
        if (n.includes('barometre')) { toast('📊 Baromètre', 'ok'); setTimeout(()=>{ window.location.href='/barometre';  },280); return; }
        if (n === 'wiki' || n === 'wiki tech') { toast('📖 Wiki','ok'); setTimeout(()=>{ window.location.href='/wiki'; },280); return; }
        if (n === 'stop' || n.includes('arreter ecoute') || n.includes('silence')) { stopCmd(); return; }
        // Catégorie dynamique
        if ((m = n.match(/^cat[eé]gorie(?:\s+la)?\s+(.+)$/))) { navCategory(m[1]); return; }
        if ((m = n.match(/^(?:ouvrir la cat[eé]gorie|afficher la cat[eé]gorie|aller cat[eé]gorie)\s+(.+)$/))) { navCategory(m[1]); return; }
        // Recherche full-text
        if ((m = n.match(/^(?:ouvre|ouvrir|montre moi|montrer|recherch(?:er|e)|cherch(?:er|e)|trouver?|trouve|voir|articles? sur|tous les articles)\s+(.+)$/))) { navSearch(m[1]); return; }
      }
    };

    r.onerror = (e) => {
      if (e.error === 'not-allowed') { toast('🔒 Microphone refusé — autorisez l\'accès','error'); stopListening(); }
    };
    r.onend = () => { if (isListening) { try { r.start(); } catch(_){} } };

    // Rebrancher toggle sur fallback
    document.getElementById(BTN_ID).onclick = () => {
      if (isListening) {
        isListening = false; try { r.stop(); } catch(_){} updateBtn(); toast('🔇 Contrôle vocal désactivé');
      } else {
        isListening = true; try { r.start(); } catch(_){} updateBtn(); toast('🎙️ Écoute active (mode natif)…','ok');
      }
    };
    console.log('[VoiceControl] ✅ Fallback natif actif');
  }

  // ══════════════════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════════════════
  function init() {
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
      console.info('[VoiceControl] Web Speech API indisponible — Chrome/Edge requis.');
      return;
    }
    injectDOM();
    loadAnnyang(() => {
      console.log('[VoiceControl] ✅ Annyang prêt · fr-FR\n' +
        '  → "algeria tech"            accueil\n' +
        '  → "catégorie [X]"           filtrer par catégorie\n' +
        '  → "ouvre [terme]"           recherche full-text\n' +
        '  → "interface arabe/anglais/français"\n' +
        '  → "mode nuit / mode jour"');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
