// ── Flash Info — module vidéo persistant (style BFM TV) ──────────────────────
// Charge data/flash-latest.json, affiche le dernier flash en overlay bas-droit,
// autoplay muet, avec fermeture (session), agrandissement et Picture-in-Picture
// natif (le PiP survit à une vraie navigation de page, contrairement au widget).
(function () {
  var MANIFEST_URL = '/data/flash-latest.json';
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var DISMISS_KEY = 'flashDismissedId';

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
      '</div>' +
      '<div class="fw-title">' + (entry.titre || 'Flash Info Algeria Tech') + '</div>';
    document.body.appendChild(root);

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
      var expanded = root.classList.toggle('fw-expanded');
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
