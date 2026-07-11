/* ════════════════════════════════════════════════════════════════════
   ALGERIA TECH — PERSONNALISATION ENGINE v1.0 (intégré au site)
   - Injecte lui-même le FAB + le panneau + le toast (aucun markup requis)
   - Pilote le mode nuit EXISTANT du site (body.dark-mode / localStorage 'theme')
   - Chaque réglage est « gaté » : défaut = aucun changement visuel
   API : window.AT_PERSONNALISATION (.open/.close/.toggle/.set/.get/.applyPreset/.reset)
   Persistance : localStorage 'at-prefs-v1'
   ════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

const STORAGE_KEY = 'at-prefs-v1';
const ROOT = document.documentElement;

const DEFAULTS = Object.freeze({
  theme:         'light',  // auto | light | dark  (Clair par défaut au 1er chargement)
  font:          'sans',   // sans | serif | dyslexic
  fontScale:     1,
  lineHeight:    1.75,
  letterSpacing: 0,
  wordSpacing:   0,
  contrast:      false,
  bold:          false,
  justify:       false,
  underlineLinks:false,
  hideImages:    false,
  largeCursor:   false,
  colorTemp:     1,
  saturation:    1,
  readWidth:     '75ch',
  focus:         false,
  motion:        false,
  pauseVideo:    false,
});

const PRESETS = {
  night:       { label: 'Lecture soir',   icon: '🌙', settings: { theme: 'dark', colorTemp: 0.45, saturation: 0.9, fontScale: 1.05 } },
  dyslexia:    { label: 'Dyslexie',       icon: '📖', settings: { font: 'dyslexic', letterSpacing: 1.5, wordSpacing: 3, lineHeight: 2.0, fontScale: 1.1, bold: true, readWidth: '60ch' } },
  'data-saver':{ label: 'Économie data',  icon: '📉', settings: { hideImages: true, pauseVideo: true, saturation: 0.75, motion: true } },
  a11y:        { label: 'Accessibilité',  icon: '♿', settings: { contrast: true, bold: true, underlineLinks: true, largeCursor: true, fontScale: 1.15, lineHeight: 1.95, motion: true } },
};

let state = { ...DEFAULTS };
const listeners = { change: [], open: [], close: [] };
let dysFontLoaded = false;

function load() {
  try { state = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch (_) { state = { ...DEFAULTS }; }
  // Se synchronise avec le mode nuit déjà choisi sur le site
  if (!localStorage.getItem(STORAGE_KEY)) {
    const siteTheme = localStorage.getItem('theme');
    if (siteTheme === 'dark') state.theme = 'dark';
  }
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} }, 250);
}

/* ─── Chargement à la demande de OpenDyslexic (connexions lentes) ── */
function ensureDyslexicFont() {
  if (dysFontLoaded) return;
  dysFontLoaded = true;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=OpenDyslexic:wght@400;700&family=Lora:ital,wght@0,400..700;1,400..700&display=swap';
  document.head.appendChild(l);
}

/* ─── Applique l'état au DOM ────────────────────────────────────── */
function applyTheme() {
  let dark;
  if (state.theme === 'auto') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  else dark = state.theme === 'dark';
  document.body.classList.toggle('dark-mode', dark);
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (_) {}
  ROOT.setAttribute('data-at-theme', dark ? 'dark' : 'light');
}

function apply() {
  applyTheme();

  if (state.font !== 'sans') ROOT.setAttribute('data-at-font', state.font);
  else ROOT.removeAttribute('data-at-font');
  if (state.font === 'dyslexic' || state.font === 'serif') ensureDyslexicFont();

  ROOT.style.setProperty('--at-font-scale',     state.fontScale);
  ROOT.style.setProperty('--at-line-height',    state.lineHeight);
  ROOT.style.setProperty('--at-letter-spacing', state.letterSpacing + 'px');
  ROOT.style.setProperty('--at-word-spacing',   state.wordSpacing + 'px');
  ROOT.style.setProperty('--at-saturation',     state.saturation);
  ROOT.style.setProperty('--at-read-width',     state.readWidth);

  // Attributs gatés (présents seulement si non-défaut)
  toggleAttr('data-at-typo',     state.lineHeight !== DEFAULTS.lineHeight, 'on');
  toggleAttr('data-at-rw',       state.readWidth !== DEFAULTS.readWidth, 'on');
  toggleAttr('data-at-sat',      state.saturation !== DEFAULTS.saturation, 'on');
  toggleAttr('data-at-contrast', state.contrast, 'high');
  toggleAttr('data-at-text',     state.bold || state.justify, state.bold ? 'bold' : (state.justify ? 'justify' : null));
  toggleAttr('data-at-links',    state.underlineLinks, 'underlined');
  toggleAttr('data-at-images',   state.hideImages, 'hidden');
  toggleAttr('data-at-cursor',   state.largeCursor, 'large');
  toggleAttr('data-at-focus',    state.focus, 'on');
  toggleAttr('data-at-motion',   state.motion, 'reduced');

  // Température : overlay chaud plein écran (sûr, ne casse pas les position:fixed)
  const overlay = document.getElementById('at-warm-overlay');
  if (overlay) overlay.style.opacity = (1 - state.colorTemp) * 0.5;

  // Pause des vidéos HTML5 en autoplay
  if (state.pauseVideo) {
    document.querySelectorAll('video[autoplay]').forEach(v => { try { v.pause(); v.removeAttribute('autoplay'); } catch (_) {} });
  }

  save();
  emit('change', state);
}

function toggleAttr(name, cond, value) {
  if (cond && value) ROOT.setAttribute(name, value);
  else ROOT.removeAttribute(name);
}

/* ─── Synchronise les contrôles de l'UI ─────────────────────────── */
function syncControls() {
  document.querySelectorAll('.at-seg[data-setting]').forEach(seg => {
    const val = state[seg.dataset.setting];
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.value === String(val)));
  });
  document.querySelectorAll('.at-toggle input[type=checkbox]').forEach(t => { t.checked = !!state[t.dataset.setting]; });
  document.querySelectorAll('.at-range input[type=range]').forEach(r => { r.value = state[r.dataset.setting]; });
  const valMap = {
    fontScale:     () => Math.round(state.fontScale * 100) + '%',
    lineHeight:    () => Number(state.lineHeight).toFixed(2),
    letterSpacing: () => state.letterSpacing + 'px',
    wordSpacing:   () => state.wordSpacing + 'px',
    colorTemp:     () => state.colorTemp < 0.4 ? 'Chaud' : (state.colorTemp < 0.75 ? 'Tiède' : 'Froid'),
    saturation:    () => Math.round(state.saturation * 100) + '%',
  };
  Object.entries(valMap).forEach(([k, fn]) => { const el = document.getElementById('at-val-' + k); if (el) el.textContent = fn(); });
  const custom = Object.keys(state).filter(k => state[k] !== DEFAULTS[k]).length;
  const badge = document.getElementById('atPrefsBadge');
  if (badge) badge.textContent = custom > 0 ? custom : '';
}

/* ─── API ───────────────────────────────────────────────────────── */
function set(key, value) {
  if (!(key in DEFAULTS)) return;
  const cur = DEFAULTS[key];
  if (typeof cur === 'number') value = parseFloat(value);
  if (typeof cur === 'boolean') value = !!value;
  state[key] = value;
  apply(); syncControls();
}
function get(key) { return key ? state[key] : { ...state }; }
function applyPreset(name) {
  const p = PRESETS[name]; if (!p) return;
  state = { ...DEFAULTS, ...p.settings };
  apply(); syncControls();
  toast(p.icon + ' Préréglage « ' + p.label + ' » appliqué', p.icon);
}
function reset() {
  state = { ...DEFAULTS };
  ['--at-font-scale','--at-line-height','--at-letter-spacing','--at-word-spacing','--at-saturation','--at-read-width'].forEach(v => ROOT.style.removeProperty(v));
  apply(); syncControls();
  toast('🔄 Préférences réinitialisées', '🔄');
}
function open()  { panel.classList.add('open'); backdrop.classList.add('open'); panel.setAttribute('aria-hidden','false'); emit('open'); }
function close() { panel.classList.remove('open'); backdrop.classList.remove('open'); panel.setAttribute('aria-hidden','true'); emit('close'); }
function toggle(){ panel.classList.contains('open') ? close() : open(); }
function on(evt, cb) { if (listeners[evt]) listeners[evt].push(cb); }
function emit(evt, p) { (listeners[evt] || []).forEach(cb => { try { cb(p); } catch (_) {} }); }

let toastTimer = null;
function toast(text, emoji) {
  const t = document.getElementById('atToast');
  if (!t) return;
  t.querySelector('.emoji').textContent = emoji || '✓';
  t.querySelector('.txt').textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ─── Markup injecté ────────────────────────────────────────────── */
function segRow(title, setting, opts) {
  return `<div class="at-prefs-row at-prefs-row--seg"><div class="label"><span class="title">${title}</span></div>
    <div class="at-seg" data-setting="${setting}">${opts.map(o => `<button data-value="${o.v}">${o.l}</button>`).join('')}</div></div>`;
}
function toggleRow(title, setting) {
  return `<div class="at-prefs-row"><div class="label"><span class="title">${title}</span></div>
    <label class="at-toggle"><input type="checkbox" data-setting="${setting}"><span class="slider"></span></label></div>`;
}
function rangeRow(title, setting, min, max, step, valId) {
  return `<div class="at-prefs-row"><div class="label"><span class="title">${title}</span></div>
    <div class="at-range"><input type="range" data-setting="${setting}" min="${min}" max="${max}" step="${step}"><span class="val" id="at-val-${valId}"></span></div></div>`;
}

function buildMarkup() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
  <div id="at-warm-overlay"></div>
  <button class="at-prefs-fab" id="atPrefsFab" aria-label="Préférences d'affichage" title="Préférences d'affichage (Alt+P)">
    <span aria-hidden="true">⚙️</span><span class="badge" id="atPrefsBadge"></span>
  </button>
  <div class="at-prefs-backdrop" id="atPrefsBackdrop"></div>
  <aside class="at-prefs-panel" id="atPrefsPanel" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Préférences d'affichage">
    <header class="at-prefs-header">
      <div class="icon-wrap" aria-hidden="true">⚙️</div>
      <div><h2>Préférences d'affichage</h2><p>Confort de lecture & accessibilité</p></div>
      <button class="at-prefs-close" id="atPrefsClose" aria-label="Fermer">×</button>
    </header>
    <div class="at-prefs-body">
      <div class="at-prefs-section">
        <div class="at-prefs-section-head"><span class="emoji">✨</span><span>Préréglages rapides</span><span class="count">1 clic</span></div>
        <div class="at-presets">
          <button class="at-preset-chip" data-preset="night"><span class="emoji">🌙</span><span>Lecture soir</span></button>
          <button class="at-preset-chip" data-preset="dyslexia"><span class="emoji">📖</span><span>Dyslexie</span></button>
          <button class="at-preset-chip" data-preset="data-saver"><span class="emoji">📉</span><span>Économie data</span></button>
          <button class="at-preset-chip" data-preset="a11y"><span class="emoji">♿</span><span>Accessibilité</span></button>
        </div>
      </div>
      <div class="at-prefs-section">
        <div class="at-prefs-section-head"><span class="emoji">🎨</span><span>Thème</span></div>
        <div class="at-prefs-card">
          ${segRow('Affichage', 'theme', [{v:'auto',l:'Auto'},{v:'light',l:'☀ Clair'},{v:'dark',l:'🌙 Sombre'}])}
        </div>
      </div>
      <div class="at-prefs-section">
        <div class="at-prefs-section-head"><span class="emoji">📝</span><span>Typographie</span></div>
        <div class="at-prefs-card">
          ${segRow('Police', 'font', [{v:'sans',l:'Sans'},{v:'serif',l:'Serif'},{v:'dyslexic',l:'Dys'}])}
          ${rangeRow('Taille', 'fontScale', 0.85, 1.4, 0.05, 'fontScale')}
          ${rangeRow('Interligne', 'lineHeight', 1.3, 2.2, 0.05, 'lineHeight')}
          ${rangeRow('Lettres', 'letterSpacing', 0, 3, 0.5, 'letterSpacing')}
          ${rangeRow('Mots', 'wordSpacing', 0, 6, 0.5, 'wordSpacing')}
        </div>
      </div>
      <div class="at-prefs-section">
        <div class="at-prefs-section-head"><span class="emoji">👁️</span><span>Affichage</span></div>
        <div class="at-prefs-card">
          ${toggleRow('Contraste', 'contrast')}
          ${toggleRow('Gras', 'bold')}
          ${toggleRow('Justifié', 'justify')}
          ${toggleRow('Liens soulignés', 'underlineLinks')}
          ${toggleRow('Masquer images', 'hideImages')}
          ${toggleRow('Curseur large', 'largeCursor')}
        </div>
      </div>
      <div class="at-prefs-section">
        <div class="at-prefs-section-head"><span class="emoji">🌡️</span><span>Couleur</span></div>
        <div class="at-prefs-card">
          ${rangeRow('Température', 'colorTemp', 0, 1, 0.05, 'colorTemp')}
          ${rangeRow('Saturation', 'saturation', 0.4, 1.2, 0.05, 'saturation')}
        </div>
      </div>
      <div class="at-prefs-section">
        <div class="at-prefs-section-head"><span class="emoji">📐</span><span>Mise en page</span></div>
        <div class="at-prefs-card">
          ${segRow('Largeur', 'readWidth', [{v:'60ch',l:'Étroite'},{v:'75ch',l:'Moyenne'},{v:'200ch',l:'Large'}])}
          ${toggleRow('Focus', 'focus')}
          ${toggleRow('Animations', 'motion')}
          ${toggleRow('Pause vidéos', 'pauseVideo')}
        </div>
      </div>
    </div>
    <footer class="at-prefs-footer">
      <button id="atPrefsReset" class="danger" title="Réinitialiser">🔄 Réinitialiser</button>
    </footer>
  </aside>
  <div class="at-toast" id="atToast" role="status" aria-live="polite"><span class="emoji">✓</span><span class="txt"></span></div>`;
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
}

/* ─── Init ──────────────────────────────────────────────────────── */
buildMarkup();
const fab = document.getElementById('atPrefsFab');
const panel = document.getElementById('atPrefsPanel');
const backdrop = document.getElementById('atPrefsBackdrop');

fab.addEventListener('click', toggle);
document.getElementById('atPrefsClose').addEventListener('click', close);
backdrop.addEventListener('click', close);
document.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); toggle(); }
  if (e.key === 'Escape' && panel.classList.contains('open')) close();
});
document.querySelectorAll('.at-seg[data-setting]').forEach(seg => {
  seg.addEventListener('click', e => { const b = e.target.closest('button[data-value]'); if (b) set(seg.dataset.setting, b.dataset.value); });
});
document.querySelectorAll('.at-toggle input[type=checkbox]').forEach(t => {
  t.addEventListener('change', () => set(t.dataset.setting, t.checked));
});
document.querySelectorAll('.at-range input[type=range]').forEach(r => {
  r.addEventListener('input', () => set(r.dataset.setting, r.value));
});
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
document.getElementById('atPrefsReset').addEventListener('click', reset);

// Suit les changements système en mode auto
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.theme === 'auto') applyTheme(); });

load();
apply();
syncControls();

window.AT_PERSONNALISATION = { open, close, toggle, set, get, applyPreset, reset, on, PRESETS, DEFAULTS };
console.log('%c⚙️ AT Personnalisation v1.0 chargé', 'color:#10b981;font-weight:bold');
})();
