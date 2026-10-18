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
    if (!r || !v || (r.classList.contains('fw-expanded') && !r.classList.contains('fw-hidden'))) return;
    if (v.src && !v.dataset.mlSrc) v.dataset.mlSrc = v.src;
    v.pause(); v.removeAttribute('autoplay'); v.preload = 'none';
    if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); }
  }
  function openFlash(retried) {
    var root = document.getElementById('flash-widget-root'), v = flashVideo();
    if (!root || !v) {
      // le visiteur l'avait fermé (mémorisé pour la session) : on passe par la languette de réouverture du widget
      var t = document.getElementById('flash-widget-reopen');
      if (t && retried !== true) { t.click(); setTimeout(function () { openFlash(true); }, 500); }
      return;
    }
    root.classList.remove('fw-hidden');
    if (!v.getAttribute('src') && v.dataset.mlSrc) { v.src = v.dataset.mlSrc; v.load(); }
    if (!root.classList.contains('fw-expanded')) { var b = root.querySelector('[data-act="expand"]'); if (b) b.click(); }
    v.muted = false; v.play().catch(function () {});
  }

  // Lecteur plein écran 9:16 générique (L'info en 30 s et Flash Info en vignettes)
  var overlay30 = null;
  function playItem(it, label) {
    if (!overlay30) {
      overlay30 = el('div', { id: 'ml-30', role: 'dialog', 'aria-label': label },
        '<div class="cadre"><video playsinline controls></video></div><p class="ttl"></p><button class="x" aria-label="Fermer">✕</button>');
      document.body.appendChild(overlay30);
      overlay30.querySelector('.x').onclick = function () {
        var v = overlay30.querySelector('video'); v.pause(); v.removeAttribute('src'); v.load(); overlay30.classList.remove('on');
      };
    }
    var v = overlay30.querySelector('video');
    overlay30.setAttribute('aria-label', label);
    if (!it) { overlay30.querySelector('.ttl').textContent = 'Rien de nouveau pour le moment.'; overlay30.classList.add('on'); return; }
    v.src = it.mp4Url; v.poster = it.poster || '';
    overlay30.querySelector('.ttl').textContent = it.titre || '';
    overlay30.classList.add('on'); v.muted = false; v.play().catch(function () {});
  }
  var cache = {};
  function getList(url, ttl) {
    var c = cache[url];
    if (c && Date.now() - c.t < 120000) return Promise.resolve(c.l);
    return fetch(url + '?t=' + Math.floor(Date.now() / 300000), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (l) {
        var max = ttl || 7 * 864e5;
        l = (l || []).filter(function (x) { return x && x.mp4Url && Date.now() - new Date(x.publishedAt).getTime() < max; })
          .sort(function (x, y) { return new Date(y.publishedAt) - new Date(x.publishedAt); });
        cache[url] = { t: Date.now(), l: l }; return l;
      }).catch(function () { return []; });
  }
  function open30(i) { getList('/data/express-latest.json', 3 * 864e5).then(function (l) { playItem(l[i || 0], "L'info en 30 s"); }); }
  function ago(iso) {
    var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 60) return 'il y a ' + Math.max(m, 1) + ' min';
    var h = Math.round(m / 60); if (h < 24) return 'il y a ' + h + ' h';
    var j = Math.round(h / 24); return j === 1 ? 'hier' : 'il y a ' + j + ' j';
  }

  // Bloc « Flash Info » : les 4 derniers flashs en vignettes (sans poster : pas de téléchargement vidéo)
  function buildFlashStrip() {
    var side = document.querySelector('.sidebar');
    if (!side || document.getElementById('ml-flash')) return;
    getList('/data/flash-latest.json').then(function (l) {
      l = l.slice(0, 4);
      if (!l.length || document.getElementById('ml-flash')) return;
      var w = el('div', { id: 'ml-flash', 'class': 'sidebar-widget' }, '<h3 class="widget-title"><i class="ml-dot"></i> Flash Info</h3><div class="ml-tiles"></div>');
      var box = w.querySelector('.ml-tiles');
      l.forEach(function (it, i) {
        var t = (it.titre || '').replace(/^Flash Info\s*·\s*/i, '').split(' · ')[0];
        var b = el('button', { type: 'button', 'class': 'ml-tile' }, '<i class="fas fa-play"></i><span class="ml-t">' + t.replace(/</g, '&lt;') + '</span><small>' + ago(it.publishedAt) + '</small>');
        b.onclick = function () { playItem(it, 'Flash Info'); };
        box.appendChild(b);
      });
      side.insertBefore(w, side.firstChild);
    });
  }

  // L'info en 30 s : le gros lecteur devient une rangée de vignettes ; un appui ouvre le lecteur plein écran
  function compactExpress() {
    var r = document.getElementById('expressWidget');
    if (!r || r.hidden) return;
    r.classList.add('ml-compact');
    var v = r.querySelector('video');
    if (v) { v.pause(); v.preload = 'none'; v.removeAttribute('autoplay'); if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); } }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#expressWidget .ew-vignette');
    if (!b || !document.body.classList.contains('ml')) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    open30(Number(b.dataset.i) || 0);
  }, true);

  // « Date courte » : « il y a 2 h » au lieu de la date + l'heure
  function shortDates() {
    [].forEach.call(document.querySelectorAll('.card-meta, .hero-meta-wrapper, .article-meta'), function (m) {
      if (m.dataset.mlDate) return;
      var sp = m.querySelectorAll('span'), d = null, h = null;
      [].forEach.call(sp, function (s) {
        var t = s.textContent.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t) && !d) d = s; else if (/^\d{2}:\d{2}$/.test(t) && !h) h = s;
      });
      if (!d || !h) return;
      var iso = d.textContent.trim() + 'T' + h.textContent.trim() + ':00+01:00';
      if (isNaN(new Date(iso))) return;
      var ic = d.querySelector('i'); d.textContent = ' ' + ago(iso); if (ic) d.insertBefore(ic, d.firstChild);
      h.classList.add('ml-hide'); m.dataset.mlDate = 1;
    });
  }

  // Brèves / Les plus lus : deux onglets, un seul bloc visible ; Brèves repliées sur 4 lignes
  function tabs() {
    var side = document.querySelector('.sidebar');
    if (!side || document.getElementById('ml-tabs')) return;
    var ws = [].slice.call(side.querySelectorAll(':scope > .sidebar-widget'));
    var br = ws.filter(function (w) { return /Brèves|Breves/i.test((w.querySelector('.widget-title') || {}).textContent || ''); })[0];
    var pl = ws.filter(function (w) { return /Plus Lus/i.test((w.querySelector('.widget-title') || {}).textContent || ''); })[0];
    if (!br || !pl) return;
    br.classList.add('ml-brv'); pl.classList.add('ml-plus');
    var bar = el('div', { id: 'ml-tabs', role: 'tablist' }, '<button type="button" class="on">Brèves</button><button type="button">Les plus lus</button>');
    var bs = bar.querySelectorAll('button');
    function sel(k) { bs[0].classList.toggle('on', k === 0); bs[1].classList.toggle('on', k === 1); br.classList.toggle('ml-tab-off', k !== 0); pl.classList.toggle('ml-tab-off', k !== 1); }
    bs[0].onclick = function () { sel(0); }; bs[1].onclick = function () { sel(1); };
    var more = el('button', { type: 'button', id: 'ml-more' }, 'Voir plus de brèves');
    more.onclick = function () { var o = br.classList.toggle('ml-open'); more.textContent = o ? 'Réduire' : 'Voir plus de brèves'; };
    br.insertBefore(more, br.querySelector('.breves-pagination'));
    side.insertBefore(bar, br);
    sel(0);
  }

  function vue() {
    function on(id) { var e = document.getElementById(id); return !!(e && e.offsetParent !== null); }
    var v = on('articlePage') || /^\/article\//.test(location.pathname) ? 'article' : on('veilleSection') ? 'veille' : on('revueSection') ? 'revue' : 'home';
    if (document.body.dataset.mlView !== v) {
      document.body.dataset.mlView = v;
      setOn(v === 'veille' ? 2 : v === 'revue' ? 3 : v === 'home' ? 0 : -1);
      if (v !== 'home') window.scrollTo(0, 0);
    }
  }
  function setOn(i) { [].forEach.call(document.querySelectorAll('#ml-nav button'), function (b, k) { b.classList.toggle('on', k === i); }); }

  // Marque les éléments à masquer / réordonner (le contenu est généré en différé par script.js, d'où le rappel périodique)
  function organise() {
    // menu hamburger : les rubriques sont déjà dans les puces -> on ne garde que le reste
    var lab = document.querySelector('#mobileMenu .mobile-nav-section-label');
    if (lab && !lab.dataset.ml) { lab.dataset.ml = 1; lab.classList.add('ml-hide'); }
    [].forEach.call(document.querySelectorAll('#mobileMenu a[onclick*="filterByCategory"]'), function (a) { if (a.parentNode) a.parentNode.classList.add('ml-hide'); });
    // doublons : les 3 premières cartes de la grille reprennent la une + 2e + 3e déjà affichées en haut
    var hero = [].map.call(document.querySelectorAll('#heroGrid .hero-main h2'), function (h) { return h.textContent.trim(); });
    [].forEach.call(document.querySelectorAll('#newsGrid .news-card'), function (c) {
      var h = c.querySelector('h3'); c.classList.toggle('ml-dup', !!h && hero.indexOf(h.textContent.trim()) !== -1);
    });
    // bandeau URGENT : masqué tant qu'il ne fait que répéter la une
    var brk = document.getElementById('breakingNewsSection'), tk = document.querySelector('#breakingTicker .ticker-item');
    if (brk && tk && hero.length) brk.classList.toggle('ml-hide', tk.textContent.trim() === hero[0]);
    vue(); buildFlashStrip(); compactExpress(); shortDates(); tabs();
    // colonne latérale : Flash Info / info en 30 s / onglets (Brèves, Plus lus) / Newsletter / Tags
    var tb = document.getElementById('ml-tabs'); if (tb) tb.style.order = 2;
    [].forEach.call(document.querySelectorAll('.sidebar > .sidebar-widget'), function (w) {
      var t = (w.querySelector('.widget-title') || {}).textContent || '';
      var o = w.id === 'ml-flash' ? 0 : /30/.test(t) ? 1 : /Brèves|Breves|Plus Lus/i.test(t) ? 3 : /Newsletter/i.test(t) ? 4 : /Tags/i.test(t) ? 5 : 6;
      w.style.order = o;
    });
  }

  // Page article pré-rendue (lien direct / Google / partage) : pas d'application autour -> on ajoute l'en-tête et la barre du bas
  function initSsg() {
    var b = document.body; b.classList.add('ml', 'ml-ssg'); b.dataset.mlView = 'article';
    var top = el('header', { id: 'ml-top' }, '<a href="/" class="lg">Algeria <b>Tech</b></a><a href="/" class="bk">← Accueil</a>');
    b.insertBefore(top, b.firstChild);
    var nav = el('nav', { id: 'ml-nav', 'aria-label': 'Navigation principale' });
    [['fa-home', 'Accueil', '/'], ['fa-satellite-dish', 'Veille', '/veille'], ['fa-file-alt', 'Revue', '/revue'], ['fa-ellipsis-h', 'Plus', '/actualites-tic']].forEach(function (d) {
      nav.appendChild(el('a', { href: d[2] }, '<i class="fas ' + d[0] + '"></i>' + d[1]));
    });
    b.appendChild(nav);
    var m = document.querySelector('.ssg-article .meta');
    if (m) m.querySelectorAll('span').forEach(function (s) { var t = s.textContent.trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(t)) s.textContent = ago(t + 'T12:00:00+01:00'); });
  }

  function init() {
    if (document.querySelector('.ssg-article') && !document.getElementById('siteHeader')) return initSsg();
    document.body.classList.add('ml');
    var media = el('div', { id: 'ml-media' });
    var bF = el('button', { type: 'button' }, '<i class="ml-dot"></i> Flash Info');
    var b30 = el('button', { type: 'button' }, '<i class="fas fa-play-circle"></i> L\'info en 30 s');
    bF.onclick = function () { openFlash(); }; b30.onclick = function () { open30(0); };
    media.appendChild(bF); media.appendChild(b30);

    var nav = el('nav', { id: 'ml-nav', 'aria-label': 'Navigation principale' });
    [['fa-home', 'Accueil', function () { call('goHome'); window.scrollTo(0, 0); setOn(0); }],
     ['fa-search', 'Recherche', function () { call('toggleMobileMenu'); setTimeout(function () { var i = document.querySelector('#mobileMenu .mobile-search input'); if (i) i.focus(); }, 350); }],
     ['fa-satellite-dish', 'Veille', function () { call('showVeille'); setOn(2); }],
     ['fa-file-alt', 'Revue', function () { call('showRevue'); setOn(3); }],
     ['fa-ellipsis-h', 'Plus', function () { var f = document.querySelector('footer'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'end' }); }]
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
    organise(); setInterval(organise, 1500); window.addEventListener('popstate', vue);
    var header = document.getElementById('siteHeader') || document.querySelector('header');
    if (header && header.parentNode) header.parentNode.insertBefore(chips, header.nextSibling);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
