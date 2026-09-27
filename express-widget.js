// ── L'info en 30 s — encart latéral (express automatique) ────────────────────
// Lit data/express-latest.json (le plus récent en premier) et affiche la
// dernière vidéo en tête de la colonne latérale, avec les précédentes en
// vignettes. Indépendant du widget du vrai flash (flash-widget.js).
(function () {
  var MANIFEST_URL = '/data/express-latest.json';
  var MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
  var NB_VIGNETTES = 3;

  function depuis(iso) {
    var min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return 'il y a ' + min + ' min';
    var h = Math.round(min / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    return 'il y a ' + Math.round(h / 24) + ' j';
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }

  function afficher(root, liste, index) {
    var info = liste[index];
    var video = root.querySelector('.ew-video');
    video.src = info.mp4Url;
    video.poster = info.poster || '';
    video.load();
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    root.querySelector('.ew-titre').textContent = info.titre;
    root.querySelector('.ew-meta').textContent =
      (info.pays === 'DZ' ? 'Algérie' : 'Monde') + ' · ' + depuis(info.publishedAt) + ' · ' + info.source;
    var lien = root.querySelector('.ew-lien');
    lien.href = info.url;
    Array.prototype.forEach.call(root.querySelectorAll('.ew-vignette'), function (v, i) {
      v.classList.toggle('ew-active', Number(v.dataset.i) === index);
    });
  }

  function construire(root, liste) {
    root.innerHTML = '';
    var titre = el('h3', 'widget-title');
    titre.innerHTML = '<i class="fas fa-play-circle"></i> L\'info en 30 s';
    root.appendChild(titre);

    var cadre = el('div', 'ew-cadre');
    var video = el('video', 'ew-video');
    video.muted = true;
    video.playsInline = true;
    video.controls = true;
    video.preload = 'metadata';
    video.setAttribute('playsinline', '');
    cadre.appendChild(video);
    root.appendChild(cadre);

    root.appendChild(el('p', 'ew-titre'));
    root.appendChild(el('p', 'ew-meta'));
    var lien = el('a', 'ew-lien', "Lire l'article source →");
    lien.target = '_blank';
    lien.rel = 'noopener';
    root.appendChild(lien);

    if (liste.length > 1) {
      var bande = el('div', 'ew-vignettes');
      liste.slice(0, NB_VIGNETTES + 1).forEach(function (info, i) {
        var b = el('button', 'ew-vignette');
        b.type = 'button';
        b.dataset.i = i;
        b.title = info.titre;
        if (info.poster) b.style.backgroundImage = 'url("' + info.poster + '")';
        b.appendChild(el('span', '', depuis(info.publishedAt)));
        b.addEventListener('click', function () { afficher(root, liste, i); });
        bande.appendChild(b);
      });
      root.appendChild(bande);
    }
    root.hidden = false;
    afficher(root, liste, 0);
  }

  function init() {
    var root = document.getElementById('expressWidget');
    if (!root) return;
    fetch(MANIFEST_URL + '?t=' + Math.floor(Date.now() / 300000), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (liste) {
        liste = (liste || []).filter(function (x) {
          return x && x.mp4Url && Date.now() - new Date(x.publishedAt).getTime() < MAX_AGE_MS;
        });
        if (liste.length) construire(root, liste);
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
