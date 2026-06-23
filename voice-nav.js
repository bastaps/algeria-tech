/**
 * Algeria Tech — Navigation Vocale
 * Web Speech API native (fr-FR) — zéro CDN, zéro token, zéro coût
 */

(function () {
  'use strict';

  const BTN_ID   = 'voice-nav-btn';
  const TOAST_ID = 'voice-nav-toast';

  let isListening = false;
  let recognition = null;

  // ── Toast ──────────────────────────────────────────────────────────────
  function toast(msg, type) {
    const el = document.getElementById(TOAST_ID);
    if (!el) return;
    el.textContent = msg;
    el.className = 'voice-toast' + (type ? ' voice-toast--' + type : '');
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
    }, 2800);
  }

  // ── Normalisation texte ────────────────────────────────────────────────
  function normalize(s) {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  // ── Commandes : [motifs normalisés] → action ───────────────────────────
  const COMMANDS = [
    {
      patterns: ['ouvrir revue de presse', 'revue de presse', 'revue presse', 'ouvrir revue'],
      label: '📰 Revue de presse…',
      action() { if (typeof window.showRevue === 'function') window.showRevue(); }
    },
    {
      patterns: ['article en une', 'a la une', 'accueil', 'retour accueil', 'page accueil'],
      label: '🏠 À la une…',
      action() { if (typeof window.goHome === 'function') window.goHome(); }
    },
    {
      patterns: ['categorie algerie', 'algerie', 'section algerie', 'actualites algerie'],
      label: '🇩🇿 Catégorie Algérie…',
      action() {
        if (typeof window.showVeille === 'function') window.showVeille();
        setTimeout(() => {
          if (typeof window.switchVeilleFlux === 'function') {
            const btn = document.querySelector('.v2-tab[data-flux="algerie"]');
            window.switchVeilleFlux('algerie', btn || null);
          }
        }, 400);
      }
    },
    {
      patterns: ['veille', 'veille tech', 'veille technologique'],
      label: '📡 Veille tech…',
      action() { if (typeof window.showVeille === 'function') window.showVeille(); }
    },
    {
      patterns: ['operateurs', 'comparateur operateurs'],
      label: '📶 Opérateurs…',
      action() { window.location.href = '/operateurs'; }
    },
    {
      patterns: ['barometre', 'barometre reseau'],
      label: '📊 Baromètre…',
      action() { window.location.href = '/barometre'; }
    },
  ];

  // ── Correspondance transcript → commande ───────────────────────────────
  function matchCommand(transcript) {
    const norm = normalize(transcript);
    for (const cmd of COMMANDS) {
      for (const p of cmd.patterns) {
        if (norm.includes(p)) return cmd;
      }
    }
    return null;
  }

  // ── Web Speech API ─────────────────────────────────────────────────────
  function createRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = 'fr-FR';
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 3;

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        // Essayer chaque alternative
        for (let k = 0; k < e.results[i].length; k++) {
          const transcript = e.results[i][k].transcript;
          const cmd = matchCommand(transcript);
          if (cmd) {
            toast(cmd.label, 'ok');
            setTimeout(() => cmd.action(), 300);
            return;
          }
        }
      }
    };

    r.onerror = (e) => {
      if (e.error === 'no-speech') return;
      if (e.error === 'not-allowed') {
        toast('🔒 Microphone refusé — autorisez l\'accès', 'error');
        stopListening();
        return;
      }
      console.warn('[VoiceNav] Erreur:', e.error);
    };

    // Redémarrage automatique si la reconnaissance s'arrête inopinément
    r.onend = () => {
      if (isListening) {
        try { r.start(); } catch (_) {}
      }
    };

    return r;
  }

  // ── Toggle ─────────────────────────────────────────────────────────────
  function startListening() {
    if (!recognition) recognition = createRecognition();
    if (!recognition) { toast('⚠️ Navigateur non compatible (Chrome requis)', 'error'); return; }
    try {
      recognition.start();
      isListening = true;
      updateBtn();
      toast('🎙️ Écoute active — parlez maintenant…', 'ok');
    } catch (err) {
      console.warn('[VoiceNav] start():', err);
    }
  }

  function stopListening() {
    isListening = false;
    if (recognition) { try { recognition.stop(); } catch (_) {} }
    updateBtn();
    toast('🔇 Navigation vocale désactivée');
  }

  function toggleListening() {
    if (isListening) stopListening(); else startListening();
  }

  // ── Bouton ─────────────────────────────────────────────────────────────
  const SVG_MIC_ON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  const SVG_MIC_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

  function updateBtn() {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(isListening));
    btn.title = isListening ? 'Désactiver la navigation vocale' : 'Activer la navigation vocale';
    btn.innerHTML = isListening
      ? `<span class="vn-icon vn-on">${SVG_MIC_ON}<span class="vn-ripple"></span></span>`
      : `<span class="vn-icon vn-off">${SVG_MIC_OFF}</span>`;
  }

  // ── Injection DOM ──────────────────────────────────────────────────────
  function injectUI() {
    const style = document.createElement('style');
    style.textContent = `
      #${BTN_ID} {
        position: fixed; bottom: 88px; right: 20px; z-index: 9999;
        width: 52px; height: 52px; border-radius: 50%; border: none;
        cursor: pointer; background: var(--primary, #006233); color: #fff;
        box-shadow: 0 4px 18px rgba(0,0,0,.28);
        display: flex; align-items: center; justify-content: center;
        transition: background .2s, transform .15s;
        outline: none; -webkit-tap-highlight-color: transparent;
      }
      #${BTN_ID}:hover { background: var(--accent, #009e60); transform: scale(1.08); }
      #${BTN_ID}[aria-pressed="true"] {
        background: #e53935;
        box-shadow: 0 4px 22px rgba(229,57,53,.45);
        animation: vn-glow 2s ease-in-out infinite alternate;
      }
      @keyframes vn-glow {
        from { box-shadow: 0 4px 18px rgba(229,57,53,.4); }
        to   { box-shadow: 0 4px 30px rgba(229,57,53,.8); }
      }
      .vn-icon { position:relative; display:flex; align-items:center; justify-content:center; }
      .vn-icon svg { width:22px; height:22px; display:block; }
      .vn-ripple {
        position:absolute; width:52px; height:52px; border-radius:50%;
        border:2px solid rgba(255,255,255,.55);
        animation: vn-pulse 1.4s ease-out infinite; pointer-events:none;
      }
      @keyframes vn-pulse {
        0%   { transform:scale(.88); opacity:.9; }
        100% { transform:scale(1.65); opacity:0; }
      }
      #${TOAST_ID} {
        position:fixed; bottom:152px; right:20px; z-index:10000;
        background:rgba(18,18,18,.88); color:#fff;
        padding:9px 16px; border-radius:22px;
        font-size:13px; font-family:inherit;
        pointer-events:none; opacity:0; transform:translateY(8px);
        transition:opacity .25s, transform .25s;
        max-width:240px; text-align:center;
        backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
      }
      #${TOAST_ID}.voice-toast--error { background:rgba(198,40,40,.9); }
      #${TOAST_ID}.voice-toast--ok    { background:rgba(0,98,51,.9); }
      @media(max-width:480px){
        #${BTN_ID}   { bottom:80px; right:14px; width:46px; height:46px; }
        .vn-ripple   { width:46px; height:46px; }
        #${TOAST_ID} { bottom:136px; right:14px; font-size:12px; }
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.setAttribute('aria-label', 'Navigation vocale');
    btn.setAttribute('aria-pressed', 'false');
    document.body.appendChild(btn);

    const toastEl = document.createElement('div');
    toastEl.id = TOAST_ID;
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);

    updateBtn();
    btn.addEventListener('click', toggleListening);
  }

  // ── Init ───────────────────────────────────────────────────────────────
  function init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.info('[VoiceNav] Web Speech API non disponible dans ce navigateur.');
      return;
    }
    injectUI();
    console.log('[VoiceNav] ✅ Prêt — commandes : "ouvrir revue de presse" | "article en une" | "catégorie Algérie"');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
