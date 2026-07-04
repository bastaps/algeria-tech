// ============================================================
//  Algeria Tech — Opérateurs Mobiles
//  Triple-Hub : filtrage, rendu, interactions
// ============================================================

/* ── Config opérateurs ──────────────────────────────────────── */
const OPS = {
  mobilis: { label: 'Mobilis',  ph: 'ph-mob', feedId: 'feed-mobilis', cntId: 'cnt-mobilis', featuredId: 'featured-mobilis' },
  djezzy : { label: 'Djezzy',   ph: 'ph-dj',  feedId: 'feed-djezzy',  cntId: 'cnt-djezzy',  featuredId: 'featured-djezzy'  },
  ooredoo: { label: 'Ooredoo',  ph: 'ph-oo',  feedId: 'feed-ooredoo', cntId: 'cnt-ooredoo', featuredId: 'featured-ooredoo' },
};

const COMM_KEYS = ['communiqué', 'communique', 'officiel', 'press release', 'cp ', 'communiqué de presse'];

let allArticles  = [];
let currentType  = 'actualite'; // 'actualite' | 'communique'

/* ══════════════════════════════════════════════════════════════
   DONNÉES
   ══════════════════════════════════════════════════════════════ */
async function init() {
  try {
    const res = await fetch('/articles.json');
    if (!res.ok) throw new Error('articles.json introuvable');
    allArticles = await res.json();
    renderAll();
  } catch (err) {
    console.error('[Opérateurs] Erreur chargement :', err);
    Object.values(OPS).forEach(op => {
      const el = document.getElementById(op.feedId);
      if (el) el.innerHTML = `<div class="feed-error">⚠️ Impossible de charger les articles.</div>`;
    });
  }
}

/* ── Filtrage ───────────────────────────────────────────────── */
function isCommunique(article) {
  // Priorité : champ type explicite (créé depuis le Hub)
  if (article.type === 'communique_officiel') return true;
  // Fallback : détection par mots-clés (articles legacy)
  const pool = [
    ...(article.tags || []),
    article.titre   || '',
    article.extrait || '',
  ].map(s => s.toLowerCase()).join(' ');
  return COMM_KEYS.some(k => pool.includes(k));
}

function articlesForOp(opKey) {
  const name = opKey.toLowerCase();
  return allArticles.filter(a => {
    const tags  = (a.tags  || []).map(t => t.toLowerCase());
    const titre = (a.titre || '').toLowerCase();
    return tags.includes(name) || titre.includes(name);
  });
}

/* ══════════════════════════════════════════════════════════════
   RENDU
   ══════════════════════════════════════════════════════════════ */
function renderAll() {
  Object.keys(OPS).forEach(opKey => {
    const base     = articlesForOp(opKey);
    const filtered = currentType === 'actualite'
      ? base.filter(a => !isCommunique(a))
      : base.filter(a =>  isCommunique(a));
    renderFeed(opKey, filtered);
    renderFeatured(opKey);
  });
}

/* ══════════════════════════════════════════════════════════════
   FEATURED — Article le plus récent par opérateur
   ══════════════════════════════════════════════════════════════ */

/* Parse date article (YYYY-MM-DD ou DD/MM/YYYY) + heure */
function parseArticleDate(article) {
  const d = article.date  || '';
  const h = article.heure || '00:00';
  let dateStr = d;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split('/');
    dateStr = `${yyyy}-${mm}-${dd}`;
  }
  try { return new Date(`${dateStr}T${h}:00`); } catch(e) { return new Date(0); }
}

/* Retourne l'article le plus récent toutes catégories confondues */
function getFeaturedArticle(opKey) {
  const base = articlesForOp(opKey);
  if (!base.length) return null;
  return [...base].sort((a, b) => parseArticleDate(b) - parseArticleDate(a))[0];
}

/* Construit le HTML de la carte "À la Une" */
function buildFeaturedCard(article, opKey) {
  const hasImg  = article.image && article.image.trim();
  const bgAttr  = hasImg ? `style="background-image:url('${esc(article.image)}')"` : '';
  const bgClass = hasImg ? 'fc-bg' : 'fc-bg fc-bg-ph';

  const age   = Date.now() - parseArticleDate(article).getTime();
  const badge = age < 7 * 24 * 3600 * 1000 ? 'NOUVEAU' : 'À LA UNE';

  return `
    <div class="featured-card" onclick="openArticle('${esc(String(article.id))}')">
      <div class="${bgClass}" ${bgAttr}></div>
      <div class="fc-glass"></div>
      <div class="fc-badge"><span class="fc-dot"></span>${badge}</div>
      <div class="fc-content">
        <p class="fc-title">${esc(article.titre)}</p>
        <span class="fc-date"><i class="far fa-calendar"></i> ${esc(article.date || '')}</span>
      </div>
    </div>`;
}

/* Injecte la carte dans le slot HTML */
function renderFeatured(opKey) {
  const cfg  = OPS[opKey];
  const wrap = document.getElementById(cfg.featuredId);
  if (!wrap) return;
  const article = getFeaturedArticle(opKey);
  wrap.innerHTML = article ? buildFeaturedCard(article, opKey) : '';
}

function renderFeed(opKey, articles) {
  const cfg   = OPS[opKey];
  const feed  = document.getElementById(cfg.feedId);
  const cnt   = document.getElementById(cfg.cntId);
  if (!feed) return;

  const n = articles.length;
  cnt.textContent = n === 0
    ? 'Aucun résultat'
    : `${n} article${n > 1 ? 's' : ''}`;

  if (n === 0) {
    const label = currentType === 'actualite' ? 'actualité' : 'communiqué';
    feed.innerHTML = `
      <div class="feed-empty">
        <div class="empty-ico">📡</div>
        <p>Aucun ${label} disponible</p>
        <small>Contenu à venir</small>
      </div>`;
    return;
  }

  feed.innerHTML = articles.map(a => buildCard(a, opKey)).join('');
}

/* ── Construction d'une carte ───────────────────────────────── */
function buildCard(article, opKey) {
  const isComm = isCommunique(article);
  const badge  = isComm
    ? `<span class="badge badge-comm"><i class="fas fa-bullhorn"></i> Communiqué</span>`
    : `<span class="badge badge-actu"><i class="fas fa-newspaper"></i> Actualité</span>`;

  const hasImg = article.image && article.image.trim();
  const imgBlock = hasImg
    ? `<div class="card-img">
         <img src="${esc(article.image)}" alt="${esc(article.titre)}" loading="lazy"
              onerror="this.parentElement.innerHTML=ph('${opKey}')">
       </div>`
    : `<div class="card-img">${ph(opKey)}</div>`;

  const tags = (article.tags || []).slice(0, 4)
    .map(t => `<span class="mini-tag">${esc(t)}</span>`).join('');

  const datePart = article.date  ? `<i class="far fa-calendar"></i> ${article.date}` : '';
  const hrPart   = article.heure ? `<i class="far fa-clock"></i> ${article.heure}`   : '';

  /* Boutons edit/delete uniquement sur les communiqués officiels */
  const actionsHtml = article.type === 'communique_officiel' ? `
    <div class="card-actions">
      <button class="card-act-btn edit"   title="Modifier"    onclick="event.stopPropagation();editComm('${esc(String(article.id))}')"><i class="fas fa-pencil-alt"></i></button>
      <button class="card-act-btn delete" title="Supprimer"   onclick="event.stopPropagation();deleteComm('${esc(String(article.id))}')"><i class="fas fa-trash"></i></button>
    </div>` : '';

  return `
    <div class="art-card" onclick="openArticle('${esc(String(article.id))}')">
      ${actionsHtml}
      ${imgBlock}
      <div class="card-body">
        ${badge}
        <h3 class="card-title">${esc(article.titre)}</h3>
        ${article.extrait ? `<p class="card-excerpt">${esc(article.extrait)}</p>` : ''}
        <div class="card-foot">
          <span class="card-date">${datePart} ${hrPart}</span>
          <div class="card-tags">${tags}</div>
        </div>
      </div>
    </div>`;
}

/* ── Placeholder brandé (CSS inline) ───────────────────────── */
function ph(opKey) {
  const cfg = OPS[opKey];
  return `
    <div class="card-ph ${cfg.ph}">
      <div class="wave-rings">
        <div class="wr"></div>
        <div class="wr"></div>
      </div>
      <span class="ph-lbl">${cfg.label}</span>
    </div>`;
}

/* ── Utilitaire échappement HTML ────────────────────────────── */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ══════════════════════════════════════════════════════════════
   MODAL ARTICLE
   ══════════════════════════════════════════════════════════════ */
window.openArticle = function (id) {
  const article = allArticles.find(a => String(a.id) === String(id));
  if (!article) return;

  const body = document.getElementById('modalBody');

  /* Rendu Markdown simplifié */
  const content = (article.rawContent || '')
    .replace(/^### (.*)/gm, '<h3>$1</h3>')
    .replace(/^## (.*)/gm,  '<h2>$1</h2>')
    .replace(/^# (.*)/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,    '<em>$1</em>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g,    '<br>');

  const imgHtml = article.image
    ? `<img src="${esc(article.image)}" alt="${esc(article.titre)}" class="modal-hero" loading="lazy">`
    : '';

  const videoHtml = article.video
    ? `<div class="modal-video">
         <iframe src="${article.video.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}"
                 frameborder="0" allowfullscreen loading="lazy"></iframe>
       </div>`
    : '';

  const tagsHtml = (article.tags || [])
    .map(t => `<span class="modal-tag">${esc(t)}</span>`).join('');

  body.innerHTML = `
    <span class="modal-cat">${esc(article.categorie || '')}</span>
    <h2 class="modal-title">${esc(article.titre)}</h2>
    <div class="modal-meta">
      ${article.date  ? `<span><i class="far fa-calendar"></i> ${article.date}</span>`  : ''}
      ${article.heure ? `<span><i class="far fa-clock"></i> ${article.heure}</span>`    : ''}
    </div>
    ${imgHtml}
    <div class="modal-content-body"><p>${content}</p></div>
    ${videoHtml}
    ${tagsHtml ? `<div class="modal-tags">${tagsHtml}</div>` : ''}`;

  document.getElementById('artModal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeArticle = function () {
  document.getElementById('artModal').classList.remove('open');
  document.body.style.overflow = '';
};

/* ══════════════════════════════════════════════════════════════
   TOGGLE GLOBAL  Actualités ↔ Communiqués
   ══════════════════════════════════════════════════════════════ */
function setupToggle() {
  const btn      = document.getElementById('typeToggle');
  const lblActu  = document.getElementById('lbl-actu');
  const lblComm  = document.getElementById('lbl-comm');
  const feeds    = document.querySelectorAll('.col-feed');

  btn.addEventListener('click', () => {
    currentType = currentType === 'actualite' ? 'communique' : 'actualite';
    btn.dataset.type = currentType;

    const isComm = currentType === 'communique';
    lblActu.classList.toggle('active', !isComm);
    lblComm.classList.toggle('active',  isComm);

    /* Transition : fade-out → re-render → fade-in */
    feeds.forEach(f => f.classList.add('switching'));
    setTimeout(() => {
      renderAll();
      feeds.forEach(f => f.classList.remove('switching'));
    }, 220);
  });
}

/* ══════════════════════════════════════════════════════════════
   HOVER : agrandit la colonne active
   ══════════════════════════════════════════════════════════════ */
function setupHover() {
  const hub  = document.getElementById('tripleHub');
  const cols = document.querySelectorAll('.op-col');

  cols.forEach(col => {
    col.addEventListener('mouseenter', () => {
      hub.classList.add('is-hovered');
      col.classList.add('is-active');
    });
    col.addEventListener('mouseleave', () => {
      hub.classList.remove('is-hovered');
      col.classList.remove('is-active');
    });
  });
}

/* Relance l'animation d'apparition en cascade des cartes d'un feed
   (une animation CSS ne redémarre pas d'elle-même sur display:none → flex) */
function replayCardAnim(feed) {
  const cards = feed.querySelectorAll('.art-card');
  cards.forEach(c => { c.style.animation = 'none'; });
  void feed.offsetWidth;                       // reflow → redémarre les animations
  cards.forEach(c => { c.style.animation = ''; });
}

/* ══════════════════════════════════════════════════════════════
   MOBILE : barre d'onglets (tap = ouvrir, glisser = réordonner)
   ══════════════════════════════════════════════════════════════ */
const OP_ORDER_KEY = 'op_tab_order';

function loadTabOrder() {
  try { const a = JSON.parse(localStorage.getItem(OP_ORDER_KEY)); return Array.isArray(a) ? a : null; }
  catch { return null; }
}
function saveTabOrder(tabbar) {
  try {
    const order = [...tabbar.children].map(h => h.dataset.op);
    localStorage.setItem(OP_ORDER_KEY, JSON.stringify(order));
  } catch (_) {}
}

function setupMobileTap() {
  if (window.innerWidth > 768) return;
  const hub  = document.getElementById('tripleHub');
  if (!hub) return;
  const cols = [...hub.querySelectorAll('.op-col')];
  if (!cols.length) return;

  // Restructure : 3 logos (col-head) dans une barre d'onglets, les feeds
  // en dessous. Les .col-feed gardent leurs id (feed-mobilis…) → renderAll()
  // les remplit toujours par id.
  const tabbar    = document.createElement('div'); tabbar.className    = 'op-tabbar';
  const feedsWrap = document.createElement('div'); feedsWrap.className = 'op-feeds';

  const headByOp = {}, feedByOp = {};
  cols.forEach(col => {
    const op   = col.dataset.op;
    const head = col.querySelector('.col-head');
    const feed = col.querySelector('.col-feed');
    head.dataset.op = op;
    headByOp[op] = head;
    feedByOp[op] = feed;
  });

  // Ordre : celui mémorisé (glisser-déposer), sinon l'ordre du HTML
  const defaultOrder = cols.map(c => c.dataset.op);
  const saved = loadTabOrder();
  const order = (saved && saved.length === defaultOrder.length && saved.every(op => headByOp[op]))
    ? saved : defaultOrder;
  order.forEach(op => { tabbar.appendChild(headByOp[op]); feedsWrap.appendChild(feedByOp[op]); });

  hub.innerHTML = '';
  hub.appendChild(tabbar);
  hub.appendChild(feedsWrap);

  const openTab = head => {
    const feed = feedByOp[head.dataset.op];
    const wasActive = head.classList.contains('tab-active');
    Object.values(headByOp).forEach(h => h.classList.remove('tab-active'));
    Object.values(feedByOp).forEach(f => f.classList.remove('feed-open'));
    if (!wasActive) {
      head.classList.add('tab-active');
      feed.classList.add('feed-open');
      replayCardAnim(feed);          // relance l'apparition en cascade
    }
  };

  enableTabDrag(tabbar, openTab, () => saveTabOrder(tabbar));

  // Ouvre le premier onglet (dans l'ordre courant) par défaut
  const first = tabbar.querySelector('.col-head');
  first.classList.add('tab-active');
  feedByOp[first.dataset.op].classList.add('feed-open');
}

/* Glisser-déposer des onglets au doigt ; un tap simple ouvre le feed.
   Réordonnancement en direct : l'onglet suit le doigt, les voisins
   permutent quand on dépasse leur centre. Ordre mémorisé au relâchement. */
function enableTabDrag(tabbar, onTap, onReorder) {
  const THRESH = 8;                 // px avant de considérer que c'est un glisser
  const GAP    = 10;                // doit correspondre au gap CSS de .op-tabbar
  let dragEl = null, pid = null, startX = 0, moved = false;

  tabbar.addEventListener('pointerdown', e => {
    const head = e.target.closest('.col-head');
    if (!head || dragEl) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragEl = head; pid = e.pointerId; startX = e.clientX; moved = false;
  });

  tabbar.addEventListener('pointermove', e => {
    if (!dragEl || e.pointerId !== pid) return;
    if (!moved) {
      if (Math.abs(e.clientX - startX) < THRESH) return;
      moved = true;
      dragEl.classList.add('dragging');
      try { dragEl.setPointerCapture(pid); } catch (_) {}
    }
    e.preventDefault();
    dragEl.style.transform = `translateX(${e.clientX - startX}px)`;

    // Permutation avec le voisin de droite / gauche si on a dépassé son centre
    const dc = () => { const r = dragEl.getBoundingClientRect(); return r.left + r.width / 2; };
    const next = dragEl.nextElementSibling;
    if (next) {
      const r = next.getBoundingClientRect();
      if (dc() > r.left + r.width / 2) {
        tabbar.insertBefore(next, dragEl);       // dragEl passe à droite
        startX += r.width + GAP;
        dragEl.style.transform = `translateX(${e.clientX - startX}px)`;
      }
    }
    const prev = dragEl.previousElementSibling;
    if (prev) {
      const r = prev.getBoundingClientRect();
      if (dc() < r.left + r.width / 2) {
        tabbar.insertBefore(dragEl, prev);       // dragEl passe à gauche
        startX -= r.width + GAP;
        dragEl.style.transform = `translateX(${e.clientX - startX}px)`;
      }
    }
  });

  const finish = e => {
    if (!dragEl || (e && e.pointerId !== pid)) return;
    const el = dragEl, wasMoved = moved;
    try { el.releasePointerCapture(pid); } catch (_) {}
    el.classList.remove('dragging');
    el.style.transform = '';
    dragEl = null; pid = null; moved = false;
    if (wasMoved) onReorder();
    else onTap(el);
  };
  tabbar.addEventListener('pointerup', finish);
  tabbar.addEventListener('pointercancel', finish);
}

/* ══════════════════════════════════════════════════════════════
   FERMETURE MODAL
   ══════════════════════════════════════════════════════════════ */
function setupModal() {
  document.getElementById('modalBackdrop').addEventListener('click', window.closeArticle);
  document.getElementById('modalClose').addEventListener('click',   window.closeArticle);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') window.closeArticle();
  });
}

/* ══════════════════════════════════════════════════════════════
   THÈME  (cycle : noir → anthracite → bleu nuit → noir)
   ══════════════════════════════════════════════════════════════ */
const THEMES = [
  { key: '',               icon: 'fa-moon',    label: 'Sombre'     },
  { key: 'theme-anthracite', icon: 'fa-adjust', label: 'Anthracite' },
  { key: 'theme-bluenuit',   icon: 'fa-star',   label: 'Bleu nuit'  },
];
let themeIndex = 0;

function setupTheme() {
  const btn  = document.getElementById('themeBtn');
  const icon = document.getElementById('themeIcon');
  if (!btn) return;

  btn.addEventListener('click', () => {
    /* Retire l'ancien thème */
    if (THEMES[themeIndex].key) document.body.classList.remove(THEMES[themeIndex].key);

    themeIndex = (themeIndex + 1) % THEMES.length;

    /* Applique le nouveau */
    if (THEMES[themeIndex].key) document.body.classList.add(THEMES[themeIndex].key);

    /* Met à jour l'icône */
    icon.className = `fas ${THEMES[themeIndex].icon}`;
    btn.title = THEMES[themeIndex].label;
  });
}

/* ══════════════════════════════════════════════════════════════
   FORMULAIRE COMMUNIQUÉ — Création / Édition / Suppression
   ══════════════════════════════════════════════════════════════ */
const COMM_PASSWORD  = 'admin2026';
let   commAuthed     = false;   // authentifié pour cette session de page

/* ── Authentification légère ─────────────────────────────────── */
function ensureAuthed() {
  if (commAuthed) return true;
  const pwd = prompt('Mot de passe administrateur :');
  if (pwd === COMM_PASSWORD) { commAuthed = true; return true; }
  alert('Mot de passe incorrect.');
  return false;
}

/* ── Ouverture / fermeture modal formulaire ──────────────────── */
function openCommForm(article = null) {
  if (!ensureAuthed()) return;

  const modal      = document.getElementById('commModal');
  const fab        = document.getElementById('commFab');
  const titleEl    = document.getElementById('commModalTitle');
  const submitLbl  = document.getElementById('commSubmitLabel');

  /* Reset formulaire */
  document.getElementById('commForm').reset();
  document.getElementById('commEditId').value      = '';
  document.getElementById('commExistingImage').value = '';
  document.getElementById('commImageName').textContent = 'Aucun fichier';
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('commOperateur').value = '';
  resetCommImport();

  if (article) {
    /* Mode édition — pré-remplissage */
    titleEl.innerHTML   = '<i class="fas fa-pencil-alt"></i> Modifier le Communiqué';
    submitLbl.textContent = 'Enregistrer les modifications';
    document.getElementById('commEditId').value    = article.id;
    document.getElementById('commTitre').value     = article.titre   || '';
    document.getElementById('commDate').value      = article.date    || '';
    document.getElementById('commHeure').value     = article.heure   || '';
    document.getElementById('commExtrait').value   = article.extrait || '';
    document.getElementById('commContenu').value   = article.rawContent || '';
    document.getElementById('commExistingImage').value = article.image || '';
    /* Tags sans le tag opérateur */
    const opNames = ['mobilis','djezzy','ooredoo'];
    const extraTags = (article.tags || []).filter(t => !opNames.includes(t.toLowerCase()));
    document.getElementById('commTags').value = extraTags.join(', ');
    /* Sélectionner l'opérateur détecté */
    const detectedOp = (article.tags || []).find(t => opNames.includes(t.toLowerCase()));
    if (detectedOp) {
      const btn = document.querySelector(`.op-btn[data-op="${detectedOp.charAt(0).toUpperCase()+detectedOp.slice(1).toLowerCase()}"]`);
      if (btn) { btn.classList.add('selected'); document.getElementById('commOperateur').value = btn.dataset.op; }
    }
  } else {
    titleEl.innerHTML   = '<i class="fas fa-bullhorn"></i> Nouveau Communiqué';
    submitLbl.textContent = 'Publier le Communiqué';
    /* Date/heure par défaut = maintenant */
    const now = new Date();
    document.getElementById('commDate').value  = now.toISOString().slice(0,10);
    document.getElementById('commHeure').value = now.toTimeString().slice(0,5);
  }

  modal.classList.add('open');
  fab.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeCommForm() {
  document.getElementById('commModal').classList.remove('open');
  document.getElementById('commFab').classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ── Soumission ──────────────────────────────────────────────── */
async function submitComm(e) {
  e.preventDefault();

  const operateur = document.getElementById('commOperateur').value;
  if (!operateur) { alert('Veuillez sélectionner un opérateur.'); return; }

  const submitBtn = document.getElementById('commSubmit');
  submitBtn.disabled = true;

  try {
    const editId   = document.getElementById('commEditId').value;
    const titre    = document.getElementById('commTitre').value.trim();
    const date     = document.getElementById('commDate').value;
    const heure    = document.getElementById('commHeure').value;
    const extrait  = document.getElementById('commExtrait').value.trim();
    const contenu  = document.getElementById('commContenu').value.trim();
    const extraTags = document.getElementById('commTags').value;

    /* Construire la liste de tags : opérateur en premier */
    const tagsArr = [operateur, ...extraTags.split(',').map(t => t.trim()).filter(Boolean)];
    const tags    = [...new Set(tagsArr)].join(', ');

    const fd = new FormData();
    if (editId) fd.append('id', editId);
    fd.append('titre',     titre);
    fd.append('categorie', 'Télécoms');
    fd.append('date',      date);
    fd.append('heure',     heure);
    fd.append('extrait',   extrait);
    fd.append('contenu',   contenu);
    fd.append('video',     '');
    fd.append('tags',      tags);
    fd.append('type',      'communique_officiel');   /* ← marqueur clé */

    /* Image */
    const imgFile = document.getElementById('commImage').files[0];
    if (imgFile) {
      fd.append('image', imgFile);
    } else {
      const existing = document.getElementById('commExistingImage').value;
      if (existing) fd.append('existingImage', existing);
    }

    const res = await fetch('/api/create-article', { method: 'POST', body: fd });
    if (!res.ok) throw new Error((await res.text()) || 'Erreur serveur');

    closeCommForm();
    /* Recharger les données et rafraîchir le hub */
    const fresh = await fetch('/articles.json');
    allArticles = await fresh.json();
    renderAll();

  } catch (err) {
    alert('Erreur : ' + err.message);
  } finally {
    submitBtn.disabled = false;
  }
}

/* ── Édition ─────────────────────────────────────────────────── */
window.editComm = function(id) {
  const article = allArticles.find(a => String(a.id) === String(id));
  if (!article) return;
  openCommForm(article);
};

/* ── Suppression ─────────────────────────────────────────────── */
window.deleteComm = async function(id) {
  if (!ensureAuthed()) return;
  if (!confirm('Supprimer définitivement ce communiqué ?')) return;
  try {
    const res = await fetch(`/api/delete-article/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression');
    /* Retirer de la liste locale et rafraîchir */
    allArticles = allArticles.filter(a => String(a.id) !== String(id));
    renderAll();
  } catch (err) {
    alert('Erreur : ' + err.message);
  }
};

/* ══════════════════════════════════════════════════════════════
   IMPORT AUTOMATIQUE — JPG / PDF / TXT / Word → (traduction) → Remplir
   ══════════════════════════════════════════════════════════════ */
let commRawText = null;
let commStyle = 'aps';

function resetCommImport() {
  commRawText = null;

  const importBtn = document.getElementById('commImportBtn');
  const importLbl = document.getElementById('commImportBtnLabel');
  const translateBtn = document.getElementById('commTranslateBtn');
  const genBtn    = document.getElementById('commGenBtn');
  const fillBtn   = document.getElementById('commFillBtn');
  if (!importBtn) return;

  importBtn.classList.remove('is-loading', 'is-done', 'is-error');
  importBtn.disabled = false;
  importLbl.textContent = 'Importer un fichier';
  importBtn.querySelector('i').className = 'fas fa-file-import';

  translateBtn.classList.remove('is-loading', 'is-done', 'is-error');
  translateBtn.disabled = true;
  translateBtn.innerHTML = '<i class="fas fa-language"></i> Traduire en français';

  if (genBtn) { genBtn.classList.remove('is-loading', 'is-done', 'is-error'); genBtn.disabled = true; }
  fillBtn.classList.remove('is-loading');
  fillBtn.disabled = true;
}

async function handleCommImport(file) {
  const btn   = document.getElementById('commImportBtn');
  const label = document.getElementById('commImportBtnLabel');
  const icon  = btn.querySelector('i');
  const translateBtn = document.getElementById('commTranslateBtn');
  const fillBtn = document.getElementById('commFillBtn');

  btn.classList.remove('is-done', 'is-error');
  btn.classList.add('is-loading');
  btn.disabled = true;
  translateBtn.disabled = true;
  fillBtn.disabled = true;
  label.textContent = 'Extraction en cours...';
  icon.className = 'fas fa-spinner fa-spin';

  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/extract-communique', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');

    commRawText = data.rawText;
    btn.classList.remove('is-loading');
    btn.classList.add('is-done');
    btn.disabled = false;
    label.textContent = 'Texte extrait ✓';
    icon.className = 'fas fa-check';
    translateBtn.disabled = false;
    if (document.getElementById('commGenBtn')) document.getElementById('commGenBtn').disabled = false;
    fillBtn.disabled = false;
  } catch (err) {
    btn.classList.remove('is-loading');
    btn.classList.add('is-error');
    btn.disabled = false;
    label.textContent = "Échec de l'extraction";
    icon.className = 'fas fa-exclamation-triangle';
    alert("Erreur lors de l'extraction du fichier : " + err.message);
  }
}

/* ── Traduction du texte extrait vers le français (Google Translate) ── */
async function translateCommImport() {
  if (!commRawText) return;
  const btn = document.getElementById('commTranslateBtn');

  btn.classList.remove('is-done', 'is-error');
  btn.classList.add('is-loading');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traduction en cours...';

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: commRawText, to: 'fr' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');

    commRawText = data.translated;
    btn.classList.remove('is-loading');
    btn.classList.add('is-done');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Traduit en français ✓';
  } catch (err) {
    btn.classList.remove('is-loading');
    btn.classList.add('is-error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Échec de la traduction';
    alert('Erreur lors de la traduction : ' + err.message);
  }
}

/* ── Structuration IA du texte (brut ou traduit) puis remplissage du formulaire ── */
async function fillCommFromExtract() {
  if (!commRawText) return;
  const fillBtn = document.getElementById('commFillBtn');
  const originalHtml = fillBtn.innerHTML;

  fillBtn.classList.add('is-loading');
  fillBtn.disabled = true;
  fillBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyse...';

  try {
    const res = await fetch('/api/structure-communique', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: commRawText })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');

    if (data.titre)    document.getElementById('commTitre').value   = data.titre;
    if (data.date)      document.getElementById('commDate').value    = data.date;
    if (data.heure)     document.getElementById('commHeure').value   = data.heure;
    if (data.extrait)   document.getElementById('commExtrait').value = data.extrait;
    if (data.contenu)   document.getElementById('commContenu').value = data.contenu;
    if (Array.isArray(data.tags) && data.tags.length) {
      document.getElementById('commTags').value = data.tags.join(', ');
    }

    if (data.operateur) {
      document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('selected'));
      const opBtn = document.querySelector(`.op-btn[data-op="${data.operateur}"]`);
      if (opBtn) {
        opBtn.classList.add('selected');
        document.getElementById('commOperateur').value = data.operateur;
      }
    }
  } catch (err) {
    alert("Erreur lors du remplissage automatique : " + err.message);
  } finally {
    fillBtn.classList.remove('is-loading');
    fillBtn.disabled = false;
    fillBtn.innerHTML = originalHtml;
  }
}

async function generateCommArticle() {
  if (!commRawText) return;
  const genBtn = document.getElementById('commGenBtn');
  genBtn.classList.add('is-loading');
  genBtn.disabled = true;
  genBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> IA...';

  try {
    const res = await fetch('/api/smart-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: commRawText, style: commStyle })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');

    if (data.titre)   document.getElementById('commTitre').value   = data.titre;
    if (data.lead)    document.getElementById('commExtrait').value  = data.lead;
    if (data.contenu) document.getElementById('commContenu').value  = data.contenu;
    const today = new Date();
    if (!document.getElementById('commDate').value) document.getElementById('commDate').value = today.toISOString().slice(0,10);
    if (!document.getElementById('commHeure').value) document.getElementById('commHeure').value = today.toTimeString().slice(0,5);
    if (Array.isArray(data.tags) && data.tags.length) {
      const opNames = ['mobilis','djezzy','ooredoo'];
      const extraTags = data.tags.filter(t => !opNames.includes(t.toLowerCase()));
      document.getElementById('commTags').value = extraTags.join(', ');
    }

    genBtn.classList.remove('is-loading');
    genBtn.classList.add('is-done');
    genBtn.innerHTML = '<i class="fas fa-check"></i> Généré ✓';
    setTimeout(() => { genBtn.classList.remove('is-done'); genBtn.innerHTML = '<i class="fas fa-pen-nib"></i> Générer'; genBtn.disabled = false; }, 3000);
  } catch (err) {
    genBtn.classList.remove('is-loading');
    genBtn.classList.add('is-error');
    genBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Échec';
    genBtn.disabled = false;
    alert('Erreur génération IA : ' + err.message);
    setTimeout(() => { genBtn.classList.remove('is-error'); genBtn.innerHTML = '<i class="fas fa-pen-nib"></i> Générer'; }, 3000);
  }
}

function setupCommImport() {
  const importBtn    = document.getElementById('commImportBtn');
  const importFile    = document.getElementById('commImportFile');
  const translateBtn = document.getElementById('commTranslateBtn');
  const genBtn       = document.getElementById('commGenBtn');
  const fillBtn       = document.getElementById('commFillBtn');

  importBtn.addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', function () {
    const file = this.files[0];
    if (file) handleCommImport(file);
    this.value = '';
  });

  translateBtn.addEventListener('click', translateCommImport);
  if (genBtn) genBtn.addEventListener('click', generateCommArticle);
  fillBtn.addEventListener('click', fillCommFromExtract);

  document.querySelectorAll('.cf-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cf-style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      commStyle = btn.dataset.style;
    });
  });
}

/* ── Wiring événements du formulaire ─────────────────────────── */
function setupCommForm() {
  /* FAB */
  document.getElementById('commFab').addEventListener('click', () => openCommForm());

  /* Fermeture */
  document.getElementById('commClose').addEventListener('click',   closeCommForm);
  document.getElementById('commCancel').addEventListener('click',  closeCommForm);
  document.getElementById('commBackdrop').addEventListener('click', closeCommForm);

  /* Soumission */
  document.getElementById('commForm').addEventListener('submit', submitComm);

  /* Import automatique de fichier */
  setupCommImport();

  /* Sélecteur opérateur */
  document.querySelectorAll('.op-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('commOperateur').value = btn.dataset.op;
    });
  });

  /* Affichage nom de fichier image */
  document.getElementById('commImage').addEventListener('change', function() {
    const name = this.files[0]?.name || 'Aucun fichier';
    document.getElementById('commImageName').textContent = name;
  });

  /* Fermeture par Échap */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('commModal').classList.contains('open')) {
      closeCommForm();
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setupToggle();
  setupHover();
  setupMobileTap();
  setupModal();
  setupTheme();
  setupCommForm();
  init();
});
