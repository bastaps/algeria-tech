/* Habillage mobile « A · Rédaction » : bandeau « EN DIRECT » rempli avec les titres affichés (donc déjà traduits). Essai réversible. */
(function () {
  'use strict';
  var _c = document.documentElement.classList;
  if (!_c.contains('ma') && !_c.contains('mb')) return;
  var _b = _c.contains('mb');
  var done = false;
  function build() {
    if (done) return;
    var hdr = document.getElementById('siteHeader');
    var titres = [].slice.call(document.querySelectorAll('#newsGrid .news-card h3')).slice(0, 6).map(function (h) { return h.textContent.trim(); }).filter(Boolean);
    if (!hdr || titres.length < 2) return;
    done = true;
    var bar = document.createElement('div'); bar.id = 'ma-tick';
    var em = document.createElement('em'); em.textContent = (document.documentElement.getAttribute('data-lang') === 'ar') ? 'مباشر' : (_b ? 'PULSE' : 'EN DIRECT');
    var mt = document.createElement('span'); mt.className = 'mt'; mt.textContent = titres.join('   ·   ');
    var mw = document.createElement('div'); mw.className = 'mw'; mw.appendChild(mt);
    bar.appendChild(em); bar.appendChild(mw);
    hdr.parentNode.insertBefore(bar, hdr.nextSibling);
    if (obs) obs.disconnect();
  }
  // La langue peut changer après la construction (traduction des titres) : on resynchronise le texte.
  setInterval(function () {
    var mt = document.querySelector('#ma-tick .mt'); if (!mt) return;
    var ts = [].slice.call(document.querySelectorAll('#newsGrid .news-card h3')).slice(0, 6).map(function (h) { return h.textContent.trim(); }).filter(Boolean).join('   ·   ');
    if (ts && ts !== mt.textContent) mt.textContent = ts;
    var em = document.querySelector('#ma-tick em'); if (em) em.textContent = (document.documentElement.getAttribute('data-lang') === 'ar') ? 'مباشر' : (_b ? 'PULSE' : 'EN DIRECT');
  }, 4000);
  var obs = null;
  var grid = document.getElementById('newsGrid');
  if (grid && 'MutationObserver' in window) { obs = new MutationObserver(build); obs.observe(grid, { childList: true }); }
  build();
  setTimeout(build, 2500);
})();
