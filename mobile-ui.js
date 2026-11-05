/* Sélecteur d'interface mobile : Classique / A Rédaction / B Signal / C Briefing — choix mémorisé (localStorage « at-ui »). Essai réversible. */
(function () {
  'use strict';
  var H = document.documentElement;
  var MODES = [
    ['classic', 'Classique', "L'interface historique"],
    ['a', 'A · Rédaction', 'Sobre : bandeau en direct, liste dense'],
    ['b', 'B · Signal', 'Sombre high-tech, accents cyan'],
    ['c', 'C · Briefing', 'Cartes à balayer, points clés']
  ];
  var AR = { classic: 'الكلاسيكية', a: 'تحرير', b: 'إشارة', c: 'موجز' };
  function cur() { return H.classList.contains('ma') ? 'a' : H.classList.contains('mb') ? 'b' : H.classList.contains('mc') ? 'c' : 'classic'; }
  function set(m) {
    try { localStorage.setItem('at-ui', m); } catch (e) {}
    var q = location.search.replace(/([?&])ui=\w+&?/, '$1').replace(/[?&]$/, '');   // l'URL ne doit plus imposer l'ancien choix
    location.replace(location.pathname + q + location.hash);
  }
  function ar() { return H.getAttribute('data-lang') === 'ar'; }
  var mq = window.matchMedia ? window.matchMedia('(max-width:640px)') : { matches: false };

  /* --- bouton + fenêtre de choix --- */
  function buildSwitch() {
    var utils = document.querySelector('#siteHeader .at-utils') || document.querySelector('#siteHeader .header-actions');
    if (!utils || document.getElementById('ui-cycle')) return;
    var b = document.createElement('button'); b.id = 'ui-cycle'; b.type = 'button';
    b.setAttribute('aria-label', "Changer d'interface"); b.title = "Changer d'interface";
    b.innerHTML = '<i class="fas fa-swatchbook" aria-hidden="true"></i>';
    var lt = document.getElementById('langToggle');
    if (lt && lt.parentNode === utils) utils.insertBefore(b, lt); else utils.insertBefore(b, utils.firstChild);
    var pop = document.createElement('div'); pop.id = 'ui-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Interface');
    document.body.appendChild(pop);
    function render() {
      pop.innerHTML = '';
      var h = document.createElement('h6'); h.textContent = ar() ? 'اختر الواجهة' : 'Choisir mon interface'; pop.appendChild(h);
      MODES.forEach(function (m) {
        var x = document.createElement('button'); x.type = 'button';
        if (m[0] === cur()) x.className = 'on';
        x.innerHTML = '<span></span><small></small>';
        x.firstChild.textContent = (ar() && AR[m[0]]) ? AR[m[0]] : m[1];
        x.lastChild.textContent = m[2];
        x.onclick = function () { set(m[0]); };
        pop.appendChild(x);
      });
    }
    b.onclick = function (e) {
      e.stopPropagation();
      if (pop.classList.contains('open')) { pop.classList.remove('open'); return; }
      var hd = document.getElementById('siteHeader'); var t = hd ? hd.getBoundingClientRect().bottom : 60;
      pop.style.setProperty('--ui-top', (Math.max(t, 0) + 6) + 'px'); render(); pop.classList.add('open');
    };
    document.addEventListener('click', function (e) { if (!pop.contains(e.target) && e.target !== b) pop.classList.remove('open'); });
  }

  /* --- B Signal : thème sombre + barre de recherche façon palette --- */
  function modeB() {
    if (!H.classList.contains('mb')) return;
    function dark() { if (mq.matches) document.body.classList.add('dark-mode'); }
    dark(); setTimeout(dark, 600); window.addEventListener('load', dark);
    var tries = 0, t = setInterval(function () {
      if (++tries > 40) clearInterval(t);
      var tick = document.getElementById('ma-tick');
      if (!tick || document.getElementById('mb-search')) return;
      var s = document.createElement('button'); s.type = 'button'; s.id = 'mb-search';
      s.innerHTML = '<span></span><kbd>⌘K</kbd>';
      s.firstChild.textContent = ar() ? 'ابحث عن مشغّل أو موضوع…' : 'Rechercher un opérateur, un sujet…';
      s.onclick = function () {
        if (typeof toggleMobileMenu === 'function') toggleMobileMenu();
        setTimeout(function () { var i = document.querySelector('#mobileMenu .mobile-search input'); if (i) i.focus(); }, 350);
      };
      tick.parentNode.insertBefore(s, tick.nextSibling);
      clearInterval(t);
    }, 400);
  }

  /* --- C Briefing : carrousel de cartes bâti avec les cartes déjà affichées (donc déjà traduites) --- */
  function modeC() {
    if (!H.classList.contains('mc')) return;
    var wrap = null, last = '';
    function lines(p) {
      var t = (p || '').replace(/\s+/g, ' ').trim(); if (!t) return [];
      var parts = t.match(/[^.!?؟]+[.!?؟]?/g) || [t];
      return parts.map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 12; }).slice(0, 3);
    }
    function collect() {
      var out = [];
      var hero = document.querySelector('#heroGrid .hero-main');
      function from(el, titleSel, pSel, tagSel) {
        var h = el.querySelector(titleSel); if (!h) return;
        var m = (el.getAttribute('onclick') || '').match(/openArticle\('([^']+)'\)/); if (!m) return;
        var tag = el.querySelector(tagSel), p = el.querySelector(pSel);
        out.push({ id: m[1], title: h.textContent.trim(), cat: tag ? tag.textContent.trim() : '', pts: lines(p && p.textContent) });
      }
      if (hero) from(hero, 'h2', 'p', '.category-tag');
      [].slice.call(document.querySelectorAll('#newsGrid .news-card')).slice(0, 7).forEach(function (c) { from(c, 'h3', '.news-card-body p', '.category-tag'); });
      return out;
    }
    function build() {
      var items = collect(); if (items.length < 2) return;
      var sig = items.map(function (i) { return i.id + i.title; }).join('|');
      var host = document.getElementById('heroSection'); if (!host) return;
      if (wrap && sig === last) return;
      last = sig;
      if (!wrap) { wrap = document.createElement('section'); wrap.id = 'mc-wrap'; host.parentNode.insertBefore(wrap, host); }
      var d = new Date(), fr = !ar();
      wrap.innerHTML = '';
      var hi = document.createElement('div'); hi.className = 'mc-hello';
      hi.innerHTML = '<b></b><span></span>';
      hi.firstChild.textContent = fr ? 'Votre point du jour' : 'موجزك اليومي';
      hi.lastChild.textContent = d.toLocaleDateString(fr ? 'fr-FR' : 'ar-DZ', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + items.length + (fr ? ' infos à retenir' : ' أخبار');
      wrap.appendChild(hi);
      var rail = document.createElement('div'); rail.className = 'mc-rail'; wrap.appendChild(rail);
      items.forEach(function (it, n) {
        var c = document.createElement('article'); c.className = 'mc-card';
        var chip = document.createElement('span'); chip.className = 'mc-chip'; chip.textContent = it.cat; c.appendChild(chip);
        var h = document.createElement('h3'); h.textContent = it.title; c.appendChild(h);
        if (it.pts.length) { var ul = document.createElement('ul'); it.pts.forEach(function (p) { var li = document.createElement('li'); li.textContent = p; ul.appendChild(li); }); c.appendChild(ul); }
        var f = document.createElement('div'); f.className = 'mc-ft'; f.innerHTML = '<span></span><b></b>';
        f.firstChild.textContent = (fr ? 'Point ' : 'نقطة ') + (n + 1) + '/' + items.length;
        f.lastChild.textContent = fr ? 'Lire →' : '← اقرأ';
        c.appendChild(f);
        c.onclick = function () { if (typeof openArticle === 'function') openArticle(it.id); };
        rail.appendChild(c);
      });
      var dots = document.createElement('div'); dots.className = 'mc-dots';
      items.forEach(function () { dots.appendChild(document.createElement('i')); });
      wrap.appendChild(dots);
      function sync() {
        var cs = rail.children; if (!cs.length) return;
        var w = cs[0].getBoundingClientRect().width + 10, k = Math.round(Math.abs(rail.scrollLeft) / (w || 1));
        [].forEach.call(dots.children, function (x, i) { x.className = i === k ? 'on' : ''; });
      }
      rail.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true }); sync();
      var lab = document.createElement('div'); lab.className = 'mc-sub'; lab.textContent = fr ? 'Toutes les infos' : 'كل الأخبار'; wrap.appendChild(lab);
    }
    var tries = 0, t = setInterval(function () { build(); if (++tries > 40 && wrap) clearInterval(t); }, 400);
    setInterval(build, 4000);
  }

  function init() { buildSwitch(); modeB(); modeC(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
