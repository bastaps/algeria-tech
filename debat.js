'use strict';
/* ═══════════════════════════════════════════════════════════════
   DEBAT.JS — Algeria Tech
   Chat IA contextuel par article
   L'IA a "lu" l'article et répond aux questions / approfondit
   les arguments du lecteur (via Mistral + contexte article).
═══════════════════════════════════════════════════════════════ */

let _debatHistory  = [];   // historique conversation [{role,content}]
let _debatOpen     = false;
let _debatLoading  = false;

/* ── Ouvrir le panneau ──────────────────────────────────────── */
window.openDebat = function () {
  var panel = document.getElementById('debatPanel');

  if (!panel) {
    _buildPanel();
    panel = document.getElementById('debatPanel');
  }

  if (_debatOpen) {
    /* Déjà ouvert : simple focus sur l'input */
    panel.classList.add('debat-visible');
    document.getElementById('debatInput')?.focus();
    return;
  }

  _debatOpen    = true;
  _debatHistory = [];

  requestAnimationFrame(function () {
    panel.classList.add('debat-visible');
    document.getElementById('debatInput')?.focus();
  });

  /* Message de bienvenue de l'IA */
  var titre = _getTitre();
  _addMsg('ia',
    'J\'ai analysé « ' + _esc(titre.substring(0, 80)) + (titre.length > 80 ? '…' : '') + ' ».' +
    '\n\nPosez-moi vos questions, souhaitez-vous qu\'on approfondisse un argument ou ' +
    'que je donne une perspective complémentaire ?'
  );
};

/* ── Fermer le panneau ──────────────────────────────────────── */
window.closeDebat = function () {
  var panel = document.getElementById('debatPanel');
  if (!panel) return;
  panel.classList.remove('debat-visible');
  setTimeout(function () {
    panel.remove();
    _debatOpen    = false;
    _debatHistory = [];
  }, 320);
};

/* ── Réinitialiser (appelé depuis goHome / showVeille / etc.) ─ */
window.resetDebat = function () {
  var panel = document.getElementById('debatPanel');
  if (panel) panel.remove();
  _debatOpen    = false;
  _debatHistory = [];
  _debatLoading = false;
};

/* ── Envoyer un message utilisateur ────────────────────────── */
window.sendDebatMessage = function () {
  if (_debatLoading) return;

  var input = document.getElementById('debatInput');
  if (!input) return;

  var msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  _addMsg('user', msg);
  _setLoading(true);

  _debatHistory.push({ role: 'user', content: msg });

  var titre  = _getTitre();
  var texte  = _getTexte();
  var langue = document.documentElement.lang === 'ar' ? 'arabe' : 'français';

  fetch('/api/debat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      titre:      titre.substring(0, 200),
      contenu:    texte.substring(0, 4200),
      historique: _debatHistory.slice(0, -1).slice(-8), /* 8 tours max */
      message:    msg.substring(0, 500),
      langue:     langue
    })
  })
  .then(function (r) { return r.json(); })
  .then(function (d) {
    var rep = d.reponse || d.error || 'Désolé, une erreur est survenue.';
    _debatHistory.push({ role: 'assistant', content: rep });
    _addMsg('ia', rep);
  })
  .catch(function () {
    _addMsg('ia', 'Impossible de joindre le serveur. Vérifiez votre connexion.');
  })
  .finally(function () { _setLoading(false); });
};

/* ══════════════════════════════════════════════════════════════
   HELPERS INTERNES
══════════════════════════════════════════════════════════════ */
function _getTitre() {
  return document.querySelector('.article-body h1')?.textContent
      || document.querySelector('#articleContent h1')?.textContent
      || 'cet article';
}

function _getTexte() {
  return document.querySelector('.article-text')?.innerText || '';
}

function _buildPanel() {
  var titre = _getTitre();

  var panel = document.createElement('div');
  panel.id        = 'debatPanel';
  panel.className = 'debat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat IA – Débat article');

  panel.innerHTML =
    /* ── En-tête ─────────────────────────────────────────────── */
    '<div class="debat-header">' +
      '<div class="debat-header-left">' +
        '<div class="debat-avatar"><i class="fas fa-robot"></i></div>' +
        '<div class="debat-header-text">' +
          '<span class="debat-title">Débattre avec l\'IA</span>' +
          '<span class="debat-subtitle">' + _esc(titre).substring(0, 55) + (titre.length > 55 ? '…' : '') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="debat-header-actions">' +
        '<button class="debat-icon-btn" onclick="window.closeDebat()" title="Fermer" aria-label="Fermer le chat">' +
          '<i class="fas fa-times"></i>' +
        '</button>' +
      '</div>' +
    '</div>' +

    /* ── Messages ─────────────────────────────────────────────── */
    '<div id="debatMessages" class="debat-messages"></div>' +

    /* ── Suggestions rapides ──────────────────────────────────── */
    '<div class="debat-chips" id="debatChips">' +
      '<button class="debat-chip" onclick="_debatChip(this)">Quelles sont les implications ?</button>' +
      '<button class="debat-chip" onclick="_debatChip(this)">Donnez un exemple concret</button>' +
      '<button class="debat-chip" onclick="_debatChip(this)">Quels acteurs sont concernés ?</button>' +
      '<button class="debat-chip" onclick="_debatChip(this)">Quel est l\'impact en Algérie ?</button>' +
    '</div>' +

    /* ── Zone de saisie ───────────────────────────────────────── */
    '<div class="debat-input-row">' +
      '<input id="debatInput" class="debat-input" type="text" ' +
        'placeholder="Votre question ou argument…" maxlength="500" ' +
        'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();window.sendDebatMessage();}" ' +
        'aria-label="Message">' +
      '<button class="debat-send" id="debatSendBtn" onclick="window.sendDebatMessage()" title="Envoyer" aria-label="Envoyer">' +
        '<i class="fas fa-paper-plane"></i>' +
      '</button>' +
    '</div>';

  document.body.appendChild(panel);
}

/* Clic sur une suggestion rapide */
window._debatChip = function (btn) {
  var input = document.getElementById('debatInput');
  if (input) { input.value = btn.textContent; input.focus(); }
  /* Masquer les chips après 1er usage */
  var chips = document.getElementById('debatChips');
  if (chips) { chips.style.display = 'none'; }
};

function _addMsg(role, text) {
  var box = document.getElementById('debatMessages');
  if (!box) return;

  var div = document.createElement('div');
  div.className = 'debat-msg debat-' + (role === 'user' ? 'user' : 'ia');

  if (role === 'ia') {
    /* Petit avatar pour les messages IA */
    var av = document.createElement('div');
    av.className = 'debat-ia-avatar';
    av.innerHTML = '<i class="fas fa-robot"></i>';
    div.appendChild(av);
  }

  var bubble = document.createElement('div');
  bubble.className = 'debat-bubble';
  /* Convertit retours à la ligne en <br> */
  bubble.innerHTML = _esc(text).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  if (role === 'ia') bubble.innerHTML = '<p>' + bubble.innerHTML + '</p>';

  div.appendChild(bubble);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function _setLoading(on) {
  _debatLoading = on;

  var btn = document.getElementById('debatSendBtn');
  var inp = document.getElementById('debatInput');

  if (on) {
    if (btn) { btn.disabled = true;  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>'; }
    if (inp)   inp.disabled = true;

    /* Indicateur de frappe (typing dots) */
    var typing = document.createElement('div');
    typing.id        = 'debatTyping';
    typing.className = 'debat-msg debat-ia debat-typing-wrap';
    typing.innerHTML =
      '<div class="debat-ia-avatar"><i class="fas fa-robot"></i></div>' +
      '<div class="debat-bubble debat-typing">' +
        '<span></span><span></span><span></span>' +
      '</div>';
    document.getElementById('debatMessages')?.appendChild(typing);
    document.getElementById('debatMessages').scrollTop = 99999;
  } else {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
    if (inp) { inp.disabled = false; inp.focus(); }
    document.getElementById('debatTyping')?.remove();
  }
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
