/* ═══ Accueil PC « éditorial » (≥ 901 px) — essai réversible ═══════════════════════════════════════
   Se branche APRÈS script.js : remplace renderHero / renderGrid / renderPagination uniquement sur l'accueil
   (filtre « Tous », sans tag ni recherche). Catégories, tags, recherche, article : code d'origine, inchangé.
   Mobile (≤ 900 px) : ne fait rien. */
(function () {
  'use strict';
  if (!window.matchMedia || !window.matchMedia('(min-width: 901px)').matches) return;
  var root = document.documentElement;
  root.classList.add('dh');

  var POUR_PAGE = 24;          // 6 cartes + 18 articles « suite » par page
  var NB_CARTES = 6;
  var dhPage = 1, dhTag = false;   // dhTag : script.js ne remet jamais currentTag à zéro, on garde notre propre drapeau
  var YT = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^&?]{11})/;
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cat1(a) { return String(a.categorie || '').split('|')[0].trim(); }

  // ── Date : aujourd'hui « il y a x min / x h », hier « hier à HH:MM », avant « 19 oct. 2026 à 16:55 »
  function dateLabel(a) {
    var d = String(a.date || ''), hm = String(a.heure || '00:00').slice(0, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d ? d + (a.heure ? ' à ' + hm : '') : '';
    var t = new Date(d + 'T' + hm + ':00+01:00');
    var now = new Date();
    var today = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Algiers' });
    var jours = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 86400000);
    if (jours <= 0) {
      var m = Math.max(Math.floor((now - t) / 60000), 1);
      return m < 60 ? 'il y a ' + m + ' min' : 'il y a ' + Math.floor(m / 60) + ' h';
    }
    if (jours === 1) return 'hier à ' + hm;
    var p = d.split('-');
    return parseInt(p[2], 10) + ' ' + MOIS[parseInt(p[1], 10) - 1] + ' ' + p[0] + ' à ' + hm;
  }

  // ── Chapô : l'extrait sans la « ALGER — » d'ouverture, coupé proprement, terminé par « … »
  function chapo(a, n) {
    var t = String(a.extrait || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    t = t.replace(/^[A-ZÀ-Ý][A-ZÀ-Ý'’ .\-]{1,40}\s[—–-]\s+/, '');
    if (t.length > n) t = t.slice(0, n).replace(/\s+\S*$/, '');
    return t ? t.replace(/[\s.,;:!]+$/, '') + '…' : '';
  }

  // ── Média : vraie vidéo réduite (mp4 du site, muette, en boucle) sinon image d'origine réduite
  function imgSrc(a) {
    var v = String(a.video || ''), m = v.match(YT);
    var ok = a.image && String(a.image).trim() && String(a.image).indexOf('%20%20') < 0 && !/\/$/.test(a.image);
    if (ok) return a.image;
    return m ? 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg' : '';
  }
  var PH = '<div class="dh-ph"><img src="/images/logo_v2-256.webp" alt=""></div>';
  window.dhFb = function (el) {
    var p = el.parentNode; if (!p) return;
    var h = document.createElement('div'); h.innerHTML = PH;
    p.replaceChild(h.firstChild, el);
  };
  function media(a) {
    var v = String(a.video || ''), src = imgSrc(a);
    if (v.charAt(0) === '/' && /\.mp4(\?|$)/i.test(v)) {
      return '<video src="' + esc(v) + '"' + (src ? ' poster="' + esc(src) + '"' : '') +
        ' muted loop playsinline preload="metadata" data-dhv onerror="dhFb(this)"></video>';
    }
    var play = v ? '<span class="dh-play">▶</span>' : '';
    if (!src) return PH + play;
    return '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async" onerror="dhFb(this)">' + play;
  }
  function open(a) { return 'href="/article/' + esc(a.id) + '" onclick="if(event.ctrlKey||event.metaKey||event.shiftKey)return;openArticle(\'' + esc(a.id) + '\');return false;"'; }
  function catTag(a, cls) {
    var c = cat1(a); if (!c) return '';
    return '<span class="' + (cls || 'dh-cat') + '" role="link" tabindex="0" title="Voir la rubrique ' + esc(c) + '" onclick="event.preventDefault();event.stopPropagation();filterByCategory(\'' + esc(c).replace(/&#39;/g, "\\'") + '\');">' + esc(c) + '</span>';
  }

  // ── Blocs ──
  function carte(a) {
    var inter = a.interactif ? '<span class="dh-inter">Interactif</span>' : '';
    return '<a class="dh-card" ' + open(a) + '><div class="dh-im">' + media(a) + inter + catTag(a) + '</div>' +
      '<div class="dh-cb"><h3>' + esc(a.titre) + '</h3><p class="dh-m">' + esc(dateLabel(a)) + '</p></div></a>';
  }
  function vignette(a) {
    return '<a class="dh-sv" ' + open(a) + '><div class="dh-im">' + media(a) + '</div><div class="dh-cb"><h3>' + esc(a.titre) +
      '</h3><p class="dh-ex">' + esc(chapo(a, 175)) + '</p><p class="dh-m">' + catTag(a, 'dh-m dh-catl') + ' ' + esc(dateLabel(a)) + '</p></div></a>';
  }
  function texte(a) {
    return '<a class="dh-st" ' + open(a) + '><h4>' + esc(a.titre) + '</h4><p class="dh-ex">' + esc(chapo(a, 175)) +
      '</p><p class="dh-m">' + esc(cat1(a)) + ' · ' + esc(dateLabel(a)) + '</p></a>';
  }

  window.renderHero = function (arts) {
    var grid = document.getElementById('heroGrid');
    if (!grid || !arts || !arts.length) return;
    var h = arts[0], s = arts.slice(1, 3);
    grid.innerHTML = '<div class="dh-hero"><a class="dh-une" ' + open(h) + '>' + media(h) +
      '<div class="dh-tx"><span class="dh-badge">À LA UNE · ' + esc(cat1(h)).toUpperCase() + '</span><h1>' + esc(h.titre) + '</h1><p>' + esc(chapo(h, 170)) + '</p><div class="dh-meta">' + esc(dateLabel(h)) + '</div></div></a>' +
      '<div class="dh-side">' + s.map(function (a) {
        return '<a class="dh-s" ' + open(a) + '><div class="dh-si">' + media(a) + '</div><div class="dh-tx">' + catTag(a) +
          '<h3>' + esc(a.titre) + '</h3><p>' + esc(chapo(a, 130)) + '</p><p class="dh-m">' + esc(dateLabel(a)) + '</p></div></a>';
      }).join('') + '</div></div>';
    vids(grid);
  };

  // Les vidéos ne jouent que lorsqu'elles sont visibles (et jamais si l'utilisateur réduit les animations)
  var io = null;
  function vids(scope) {
    var list = (scope || document).querySelectorAll('video[data-dhv]');
    if (!list.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    if (!io) io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var v = e.target; if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); });
    }, { threshold: .4 });
    list.forEach(function (v) { io.observe(v); });
  }

  function accueil() {
    return typeof currentFilter !== 'undefined' && currentFilter === 'all' && !dhTag &&
      !((document.getElementById('searchInput') || {}).value || '').trim();
  }
  function debut(page) { return 3 + (page - 1) * POUR_PAGE; }
  function nbPages() { return Math.max(1, Math.ceil((allArticles.length - 3) / POUR_PAGE)); }

  function renderAccueil() {
    var grid = document.getElementById('newsGrid'); if (!grid) return;
    var d = debut(dhPage), lot = allArticles.slice(d, d + POUR_PAGE);
    var cartes = lot.slice(0, NB_CARTES), reste = lot.slice(NB_CARTES), suite = '';
    for (var k = 0; k < reste.length; k += 3) {
      var b = reste.slice(k, k + 3);
      suite += '<div class="dh-sb">' + vignette(b[0]) + b.slice(1).map(texte).join('') + '</div>';
    }
    grid.classList.add('dh-home');
    grid.innerHTML = '<h2 class="dh-t">Plus d\'actualités</h2><div class="dh-grid">' + cartes.map(carte).join('') + '</div>' +
      (suite ? '<h2 class="dh-t">Suite de l\'actualité</h2><div class="dh-suite">' + suite + '</div>' : '');
    var sh = document.querySelector('.news-column .section-header'); if (sh) sh.style.display = 'none';
    vids(grid);
  }

  ['filterByTag'].forEach(function (n) { var o = window[n]; window[n] = function () { dhTag = true; return o.apply(this, arguments); }; });
  ['filterByCategory', 'goHome'].forEach(function (n) { var o = window[n]; window[n] = function () { dhTag = false; return o.apply(this, arguments); }; });
  var origGrid = window.renderGrid, origPag = window.renderPagination;
  window.renderGrid = function (arts) {
    var grid = document.getElementById('newsGrid');
    if (accueil() && arts && allArticles.length && arts[0] === allArticles[0]) { renderAccueil(); return; }
    if (grid) grid.classList.remove('dh-home');
    var sh = document.querySelector('.news-column .section-header'); if (sh) sh.style.display = '';
    origGrid(arts);
  };

  window.renderPagination = function (arts) {
    var pag = document.getElementById('pagination');
    if (!(accueil() && arts === allArticles && pag)) { if (pag) pag.classList.remove('dh-pag'); return origPag(arts); }
    pag.classList.add('dh-pag');
    var n = nbPages();
    if (n < 2) { pag.innerHTML = ''; return; }
    var btns = '';
    for (var i = 1; i <= n; i++) btns += '<button type="button" data-p="' + i + '"' + (i === dhPage ? ' class="active"' : '') + '>' + i + '</button>';
    pag.innerHTML = '<div class="dh-arch"><span class="dh-arch-t">Archives</span><button type="button" class="dh-ar" data-s="-1" aria-label="Précédent">‹</button>' +
      '<div class="dh-strip">' + btns + '</div><button type="button" class="dh-ar" data-s="1" aria-label="Suivant">›</button></div>';
    var strip = pag.querySelector('.dh-strip'), on = strip.querySelector('.active');
    if (on) strip.scrollLeft = Math.max(0, on.offsetLeft - strip.clientWidth / 2);
    pag.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s) { strip.scrollBy({ left: strip.clientWidth * .8 * Number(b.dataset.s) }); return; }
      dhPage = Number(b.dataset.p); renderAccueil(); window.renderPagination(allArticles);
      var top = document.getElementById('newsGrid'); if (top) window.scrollTo({ top: top.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
    };
  };

  // ── En-tête : Revue de presse dans la navigation, « Explorer » à côté, outils dans le menu ──
  function entete() {
    var ul = document.querySelector('.at-mainnav > ul');
    var btn = document.getElementById('exploreBtn'), menu = document.getElementById('exploreMenu');
    if (ul && !ul.querySelector('.dh-revue')) {
      var li = document.createElement('li'); li.className = 'dh-revue';
      li.innerHTML = '<a href="#" onclick="showRevue();return false;" data-i18n-ar="مراجعة الصحافة" data-i18n-en="Press Review">Revue de presse</a>';
      ul.appendChild(li);
      if (btn) { var l2 = document.createElement('li'); l2.className = 'dh-explore-li'; l2.appendChild(btn); ul.appendChild(l2); }
    }
    var ab = { fr: 'FR', ar: 'عربي', en: 'EN' };
    document.querySelectorAll('#langToggle .lt-opt').forEach(function (o) { if (ab[o.dataset.lang]) o.textContent = ab[o.dataset.lang]; });
    if (menu && !menu.querySelector('.dh-added')) {
      menu.insertAdjacentHTML('afterbegin',
        '<a role="menuitem" class="dh-added" href="#" onclick="showComparateur();return false;" style="--chip:#fb923c"><i class="fas fa-mobile-alt"></i><span>Comparateur mobile</span></a>' +
        '<a role="menuitem" class="dh-added" href="/operateurs" style="--chip:#34d399"><i class="fas fa-signal"></i><span>Opérateurs</span></a>' +
        '<a role="menuitem" class="dh-added" href="/infographies/index.html" style="--chip:#f87171"><i class="fas fa-chart-pie"></i><span>Infographies</span></a>' +
        '<a role="menuitem" class="dh-added" href="/assistant-vocal.html" style="--chip:#8b5cf6"><i class="fas fa-microphone-lines"></i><span>Assistant vocal</span></a>' +
        '<div class="at-explore-sep dh-added" aria-hidden="true"></div>');
    }
  }

  // ── Colonne latérale : onglets « Brèves | Les plus lus » ──
  function onglets() {
    var b = document.getElementById('brevesList'), t = document.getElementById('trendingList');
    var wb = b && b.closest('.sidebar-widget'), wt = t && t.closest('.sidebar-widget');
    if (!wb || !wt || document.querySelector('.dh-tabs')) return;
    wb.parentNode.insertBefore(wt, wb.nextSibling);
    wb.classList.add('dh-tabbed'); wt.classList.add('dh-tabbed');
    var bar = document.createElement('div'); bar.className = 'dh-tabs';
    bar.innerHTML = '<button type="button" class="on" data-t="b">Brèves</button><button type="button" data-t="t">Les plus lus</button>';
    wb.parentNode.insertBefore(bar, wb);
    function show(k) {
      bar.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.dataset.t === k); });
      wb.classList.toggle('dh-hide', k !== 'b'); wt.classList.toggle('dh-hide', k !== 't');
    }
    bar.onclick = function (e) { var x = e.target.closest('button'); if (x) show(x.dataset.t); };
    show('b');
  }

  function init() {
    entete(); onglets();
    // Le premier rendu a pu avoir lieu avant ce script : on le refait à l'identique avec la nouvelle mise en page
    if (typeof allArticles !== 'undefined' && allArticles.length) {
      window.renderHero(allArticles);
      window.renderGrid(allArticles.slice(0, 6));
      window.renderPagination(allArticles);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
