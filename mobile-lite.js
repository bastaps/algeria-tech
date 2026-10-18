// Smartphone allégé : barre média (Flash Info | L'info en 30 s), navigation du bas, bouton « + », puces de rubriques.
// Actif uniquement en largeur <= 640 px. Aucun changement sur PC. Réversible : retirer les 2 lignes mobile-lite dans index.html.
(function () {
  if (!window.matchMedia || !matchMedia('(max-width: 640px)').matches) return;
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; }
  function call(fn) { try { if (typeof window[fn] === 'function') window[fn].apply(null, [].slice.call(arguments, 1)); } catch (e) {} }

  // Flash Info : rien ne tourne en arrière-plan. Tant que le lecteur n'est pas ouvert, la vidéo est arrêtée et déchargée
  // (pas d'autoplay, pas de données consommées) ; elle est rechargée à l'ouverture et déchargée à la fermeture.
  function flashVideo() { var r = document.getElementById('flash-widget-root'); return r ? r.querySelector('video') : null; }
  function stopFlashIfClosed() {
    var r = document.getElementById('flash-widget-root'), v = flashVideo();
    if (!r || !v || r.classList.contains('fw-expanded')) return;
    if (v.src && !v.dataset.mlSrc) v.dataset.mlSrc = v.src;
    v.pause(); v.removeAttribute('autoplay'); v.preload = 'none';
    if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); }
  }
  function openFlash() {
    var root = document.getElementById('flash-widget-root'), v = flashVideo();
    if (!root || !v) return;
    root.classList.remove('fw-hidden');
    if (!v.getAttribute('src') && v.dataset.mlSrc) { v.src = v.dataset.mlSrc; v.load(); }
    if (!root.classList.contains('fw-expanded')) { var b = root.querySelector('[data-act="expand"]'); if (b) b.click(); }
    v.muted = false; v.play().catch(function () {});
  }

  var overlay30 = null;
  function open30() {
    if (!overlay30) {
      overlay30 = el('div', { id: 'ml-30', role: 'dialog', 'aria-label': "L'info en 30 s" },
        '<div class="cadre"><video playsinline controls></video></div><p class="ttl"></p><button class="x" aria-label="Fermer">✕</button>');
      document.body.appendChild(overlay30);
      overlay30.querySelector('.x').onclick = function () { var v = overlay30.querySelector('video'); v.pause(); overlay30.classList.remove('on'); };
    }
    fetch('/data/express-latest.json?t=' + Math.floor(Date.now() / 300000), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (l) {
        l = (l || []).filter(function (x) { return x && x.mp4Url; });
        var v = overlay30.querySelector('video');
        if (!l.length) { overlay30.querySelector('.ttl').textContent = "Pas d'info en 30 s pour le moment."; overlay30.classList.add('on'); return; }
        v.src = l[0].mp4Url; v.poster = l[0].poster || '';
        overlay30.querySelector('.ttl').textContent = l[0].titre || '';
        overlay30.classList.add('on'); v.play().catch(function () {});
      }).catch(function () {});
  }

  function setOn(i) { [].forEach.call(document.querySelectorAll('#ml-nav button'), function (b, k) { b.classList.toggle('on', k === i); }); }

  function init() {
    document.body.classList.add('ml');
    var media = el('div', { id: 'ml-media' });
    var bF = el('button', { type: 'button' }, '<i class="ml-dot"></i> Flash Info');
    var b30 = el('button', { type: 'button' }, '<i class="fas fa-play-circle"></i> L\'info en 30 s');
    bF.onclick = openFlash; b30.onclick = open30;
    media.appendChild(bF); media.appendChild(b30);

    var nav = el('nav', { id: 'ml-nav', 'aria-label': 'Navigation principale' });
    [['fa-home', 'Accueil', function () { call('goHome'); window.scrollTo(0, 0); setOn(0); }],
     ['fa-newspaper', 'Actualités', function () { call('goHome'); var s = document.querySelector('.news-grid,#newsGrid'); if (s) s.scrollIntoView({ behavior: 'smooth' }); setOn(1); }],
     ['fa-satellite-dish', 'Veille', function () { call('showVeille'); setOn(2); }],
     ['fa-ellipsis-h', 'Plus', function () { call('toggleMobileMenu'); }]
    ].forEach(function (d, i) {
      var b = el('button', { type: 'button' }, '<i class="fas ' + d[0] + '"></i>' + d[1]);
      b.onclick = d[2]; if (i === 0) b.className = 'on'; nav.appendChild(b);
    });

    var fab = el('button', { id: 'ml-fab', type: 'button', 'aria-label': 'Plus d\'actions (micro, WhatsApp, réglages)' }, '+');
    fab.onclick = function () { document.body.classList.toggle('ml-open'); };
    document.body.appendChild(media); document.body.appendChild(nav); document.body.appendChild(fab);

    var chips = el('div', { id: 'ml-chips', role: 'tablist', 'aria-label': 'Rubriques' });
    ['À la une', 'Algérie', 'Télécoms', 'Mobile', 'Startups', 'Innovation', 'IA', 'Vidéo', 'Entreprises', 'Internationale'].forEach(function (c, i) {
      var b = el('button', { type: 'button' }, c); if (i === 0) b.className = 'on';
      b.onclick = function () {
        [].forEach.call(chips.children, function (x) { x.classList.toggle('on', x === b); });
        if (i === 0) call('goHome'); else call('filterByCategory', c);
      };
      chips.appendChild(b);
    });
    // surveille le widget Flash (créé en différé, rouvert/refermé par ses boutons) et le garde arrêté quand il est fermé
    stopFlashIfClosed();
    new MutationObserver(stopFlashIfClosed).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'src'] });
    setInterval(stopFlashIfClosed, 2000);
    var header = document.getElementById('siteHeader') || document.querySelector('header');
    if (header && header.parentNode) header.parentNode.insertBefore(chips, header.nextSibling);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
