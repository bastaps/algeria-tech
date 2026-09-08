// ── Flash Info — module vidéo persistant (style BFM TV) ──────────────────────
// Charge data/flash-latest.json, affiche le dernier flash en overlay bas-droit,
// autoplay muet, avec fermeture (session), agrandissement et Picture-in-Picture
// natif (le PiP survit à une vraie navigation de page, contrairement au widget).
(function () {
  var MANIFEST_URL = '/data/flash-latest.json';
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var DISMISS_KEY = 'flashDismissedId';
  var RECT_KEY = 'flashWidgetRect'; // position/taille choisies par ce visiteur (par navigateur)
  var MIN_WIDTH = 180;

  function saveRect(root) {
    try {
      var r = root.getBoundingClientRect();
      // Garde-fou : un viewport à 0 (onglet en arrière-plan, etc.) produirait
      // des valeurs de clamp aberrantes — ne jamais persister un rect dégénéré.
      if (r.width < MIN_WIDTH || window.innerWidth < 100 || window.innerHeight < 100) return;
      localStorage.setItem(RECT_KEY, JSON.stringify({ left: r.left, top: r.top, width: r.width }));
    } catch (e) {}
  }

  function loadRect() {
    try {
      var raw = localStorage.getItem(RECT_KEY);
      if (!raw) return null;
      var rect = JSON.parse(raw);
      if (!rect || !(rect.width >= MIN_WIDTH)) return null;
      return rect;
    } catch (e) { return null; }
  }

  // Bascule la boîte sur un positionnement libre (left/top/width en pixels),
  // en partant de sa position actuelle — plus de dépendance au coin CSS par
  // défaut ni au mode "agrandi" une fois qu'on a glissé/redimensionné à la main.
  function pinToCurrentRect(root) {
    var r = root.getBoundingClientRect();
    root.classList.remove('fw-expanded');
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.style.transform = 'none';
    root.style.left = r.left + 'px';
    root.style.top = r.top + 'px';
    root.style.width = r.width + 'px';
  }

  // Écoute move/up sur `document` (pas sur la poignée) : le geste continue de
  // fonctionner même si le curseur sort de la petite zone de la poignée pendant
  // le mouvement. setPointerCapture est tenté en best-effort (améliore le suivi
  // tactile) mais ne doit jamais bloquer l'attache des écouteurs s'il échoue.
  function makeDraggable(root, handle) {
    handle.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      pinToCurrentRect(root);
      root.classList.add('fw-dragging');
      var startX = ev.clientX, startY = ev.clientY;
      var startLeft = parseFloat(root.style.left), startTop = parseFloat(root.style.top);
      try { handle.setPointerCapture(ev.pointerId); } catch (e) {}

      function onMove(e) {
        var dx = e.clientX - startX, dy = e.clientY - startY;
        var w = root.offsetWidth, h = root.offsetHeight;
        var left = Math.min(Math.max(0, startLeft + dx), window.innerWidth - w);
        var top  = Math.min(Math.max(0, startTop + dy), window.innerHeight - h);
        root.style.left = left + 'px';
        root.style.top = top + 'px';
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        root.classList.remove('fw-dragging');
        saveRect(root);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  function makeResizable(root, handle) {
    handle.addEventListener('pointerdown', function (ev) {
      pinToCurrentRect(root);
      root.classList.add('fw-dragging');
      var startX = ev.clientX;
      var startWidth = root.getBoundingClientRect().width;
      try { handle.setPointerCapture(ev.pointerId); } catch (e) {}

      var titleH = root.querySelector('.fw-title').offsetHeight || 34;
      function onMove(e) {
        var dx = e.clientX - startX;
        // Deux plafonds : ne pas déborder à droite (largeur) ni en bas (la hauteur
        // suit le ratio 16:9 de la vidéo + le bandeau titre).
        var maxWidthH = window.innerWidth - parseFloat(root.style.left || 0) - 4;
        var maxWidthV = (window.innerHeight - parseFloat(root.style.top || 0) - titleH - 4) / 0.5625;
        var maxWidth = Math.max(MIN_WIDTH, Math.min(maxWidthH, maxWidthV));
        var w = Math.min(Math.max(MIN_WIDTH, startWidth + dx), maxWidth);
        root.style.width = w + 'px';
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        root.classList.remove('fw-dragging');
        saveRect(root);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  function isFresh(entry) {
    var t = new Date(entry.publishedAt).getTime();
    return isFinite(t) && (Date.now() - t) < MAX_AGE_MS;
  }

  function buildWidget(entry) {
    var root = document.createElement('div');
    root.id = 'flash-widget-root';
    root.innerHTML =
      '<div class="fw-videobox">' +
        '<span class="fw-badge"><i></i>FLASH INFO</span>' +
        '<div class="fw-controls">' +
          '<button class="fw-btn" data-act="pip" title="Picture-in-Picture" hidden>⧉</button>' +
          '<button class="fw-btn" data-act="expand" title="Agrandir">⤢</button>' +
          '<button class="fw-btn" data-act="close" title="Fermer">✕</button>' +
        '</div>' +
        '<video src="' + entry.mp4Url + '" muted autoplay loop playsinline></video>' +
        '<div class="fw-vol">' +
          '<button class="fw-btn" data-act="mute" title="Activer le son">🔇</button>' +
          '<input type="range" min="0" max="100" value="100" data-act="volume" title="Volume">' +
        '</div>' +
        '<div class="fw-resize" title="Redimensionner"></div>' +
      '</div>' +
      '<div class="fw-title">' + (entry.titre || 'Flash Info Algeria Tech') + '</div>';
    document.body.appendChild(root);

    var savedRect = loadRect();
    if (savedRect && savedRect.width >= MIN_WIDTH) {
      root.style.left = Math.min(Math.max(0, savedRect.left), window.innerWidth - savedRect.width) + 'px';
      root.style.top = Math.min(Math.max(0, savedRect.top), window.innerHeight - 40) + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      root.style.width = savedRect.width + 'px';
    }

    makeDraggable(root, root.querySelector('.fw-title'));
    makeResizable(root, root.querySelector('.fw-resize'));

    var video   = root.querySelector('video');
    var pipBtn  = root.querySelector('[data-act="pip"]');
    var expBtn  = root.querySelector('[data-act="expand"]');
    var closeBtn = root.querySelector('[data-act="close"]');
    var muteBtn = root.querySelector('[data-act="mute"]');
    var volSlider = root.querySelector('[data-act="volume"]');

    muteBtn.addEventListener('click', function () {
      video.muted = !video.muted;
      muteBtn.textContent = video.muted ? '🔇' : '🔊';
      muteBtn.title = video.muted ? 'Activer le son' : 'Couper le son';
      if (!video.muted && video.volume === 0) video.volume = 1;
    });
    volSlider.addEventListener('input', function () {
      video.volume = Number(volSlider.value) / 100;
      video.muted = video.volume === 0;
      muteBtn.textContent = video.muted ? '🔇' : '🔊';
    });

    if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
      pipBtn.hidden = false;
      pipBtn.addEventListener('click', function () {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture().catch(function () {});
        } else {
          video.requestPictureInPicture().catch(function () {});
        }
      });
    }

    expBtn.addEventListener('click', function () {
      // Le bouton bascule toujours entre deux presets fixes — centré-agrandi, ou
      // coin par défaut — et ignore/efface tout glisser-déposer manuel en cours,
      // peu importe où la boîte se trouvait avant le clic.
      var expanded = !root.classList.contains('fw-expanded');
      root.classList.toggle('fw-expanded', expanded);
      root.style.left = root.style.top = root.style.width =
        root.style.right = root.style.bottom = root.style.transform = '';
      if (!expanded) {
        try { localStorage.removeItem(RECT_KEY); } catch (e) {}
      }
      expBtn.textContent = expanded ? '⤡' : '⤢';
      expBtn.title = expanded ? 'Réduire' : 'Agrandir';
    });

    closeBtn.addEventListener('click', function () {
      try { sessionStorage.setItem(DISMISS_KEY, entry.id); } catch (e) {}
      root.classList.add('fw-hidden');
      showReopenTab(entry);
    });

    return root;
  }

  function showReopenTab(entry) {
    var tab = document.getElementById('flash-widget-reopen');
    if (!tab) {
      tab = document.createElement('div');
      tab.id = 'flash-widget-reopen';
      tab.innerHTML = '<i></i>Flash Info';
      document.body.appendChild(tab);
    }
    tab.classList.add('fw-show');
    tab.onclick = function () {
      try { sessionStorage.removeItem(DISMISS_KEY); } catch (e) {}
      tab.classList.remove('fw-show');
      var existing = document.getElementById('flash-widget-root');
      if (existing) existing.classList.remove('fw-hidden');
      else buildWidget(entry);
    };
  }

  function init() {
    fetch(MANIFEST_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        if (!Array.isArray(list) || !list.length) return;
        var fresh = list.filter(isFresh);
        if (!fresh.length) return;
        var latest = fresh[0];

        var dismissed = null;
        try { dismissed = sessionStorage.getItem(DISMISS_KEY); } catch (e) {}

        if (dismissed === latest.id) {
          showReopenTab(latest);
        } else {
          buildWidget(latest);
        }
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
