/* Podcast Algeria Tech : pastille au-dessus de la vidéo Flash info ; choix langue (FR / عربي / EN) et nombre d'infos (3 à 10) ;
   barre de progression animée en haut de page pendant l'écoute. Lit /podcast/latest.json (1 clip MP3 par info). */
(function () {
  'use strict';
  var LS = 'atPodPrefs';
  function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
  var NOMS = { fr: 'FR', ar: 'عربي', en: 'EN' };

  fetch('/podcast/latest.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
    if (!m || !m.langs) return;
    var langs = Object.keys(m.langs); if (!langs.length) return;
    var prefs = load();
    var lang = langs.indexOf(prefs.lang) >= 0 ? prefs.lang : langs[0];
    var maxN = 10; langs.forEach(function (l) { maxN = Math.min(maxN, m.langs[l].items.length); });
    var n = Math.max(3, Math.min(maxN, +prefs.n || 5));

    var box = document.createElement('div'); box.id = 'atPod';
    box.innerHTML = '<button type="button" class="pl" aria-label="Écouter le podcast">▶</button>' +
      '<span class="t">🎧 Podcast<small></small></span><span class="eq"><i></i><i></i><i></i><i></i></span>' +
      '<a role="button" tabindex="0" class="opt" aria-label="Options">⚙</a>' +
      '<a role="button" tabindex="0" class="min" aria-label="Réduire" title="Réduire">⌄</a>';
    var panel = document.createElement('div'); panel.id = 'atPodPanel';
    panel.innerHTML = '<div class="row langs"></div><div class="row"><label>Infos : <b class="nv"></b></label>' +
      '<input type="range" min="3" max="' + maxN + '" step="1"></div><div class="row"><a role="button" tabindex="0" class="tx">Voir le texte</a></div><div class="txt"></div>';
    var bar = document.createElement('div'); bar.id = 'atPodBar';
    bar.innerHTML = '<div class="rail"><div class="fill"></div></div><div class="lbl"></div>';
    document.body.appendChild(box); document.body.appendChild(panel); document.body.appendChild(bar);

    var btn = box.querySelector('.pl'), small = box.querySelector('small'), fill = bar.querySelector('.fill'), lbl = bar.querySelector('.lbl');
    var range = panel.querySelector('input'), nv = panel.querySelector('.nv'), langsEl = panel.querySelector('.langs'), txt = panel.querySelector('.txt');
    var au = new Audio(); au.preload = 'none';
    var playlist = [], idx = 0, starting = false;

    function build() {
      var L = m.langs[lang], it = L.items.slice(0, n);
      playlist = [{ mp3: L.intro.mp3, duree: L.intro.duree, titre: '', texte: L.intro.texte }]
        .concat(it.map(function (x, i) { return { mp3: x.mp3, duree: x.duree, titre: x.titre, texte: x.texte, num: i + 1 }; }))
        .concat([{ mp3: L.outro.mp3, duree: L.outro.duree, titre: '', texte: L.outro.texte }]);
      var tot = playlist.reduce(function (s, c) { return s + c.duree; }, 0);
      small.textContent = ' ' + n + ' infos · ' + Math.max(1, Math.round(tot / 60)) + ' min';
      nv.textContent = n;
      var rtl = lang === 'ar'; txt.dir = rtl ? 'rtl' : 'ltr';
      txt.textContent = playlist.map(function (c) { return (c.titre ? c.titre + '\n' : '') + c.texte; }).join('\n\n');
    }
    function mmss(s) { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
    function drawLangs() {
      langsEl.innerHTML = '';
      langs.forEach(function (l) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = NOMS[l] || l; b.className = l === lang ? 'on' : '';
        b.onclick = function () { var etait = !au.paused; lang = l; prefs.lang = l; save(prefs); au.pause(); idx = 0; au.removeAttribute('src'); stopUi(); build(); drawLangs(); if (etait) demarrer(); };
        langsEl.appendChild(b);
      });
    }
    function stopUi() { box.classList.remove('on'); bar.classList.remove('on'); btn.textContent = '▶'; fill.style.width = '0'; }
    function playIdx(i) { idx = i; au.src = playlist[i].mp3; au.play(); }
    function demarrer() { box.classList.remove('mini'); box.classList.add('open'); place(); if (!au.src || (au.ended && idx >= playlist.length - 1)) playIdx(0); else au.play(); }
    // Contraction : dès que la lecture est coupée (ou finie), le lecteur redevient un cercle — sauf si le panneau d'options est ouvert
    var contracteur = null;
    function contracter(delai) {
      clearTimeout(contracteur);
      contracteur = setTimeout(function () {
        if (au.paused && !panel.classList.contains('open')) { box.classList.remove('open'); box.classList.remove('on'); box.classList.remove('mini'); bar.classList.remove('on'); place(); }
      }, delai);
    }
    range.value = n;
    range.oninput = function () { var etait = !au.paused; n = +range.value; prefs.n = n; save(prefs); au.pause(); idx = 0; au.removeAttribute('src'); stopUi(); build(); if (etait) { clearTimeout(contracteur); demarrer(); } };
    box.querySelector('.opt').onclick = function () { panel.classList.toggle('open'); if (!panel.classList.contains('open')) contracter(700); };
    panel.querySelector('.tx').onclick = function () { txt.style.display = txt.style.display === 'block' ? 'none' : 'block'; };
    btn.onclick = function () { if (!au.src || au.ended && idx >= playlist.length - 1) { playIdx(0); } else if (au.paused) au.play(); else au.pause(); };
    au.onplay = function () { btn.textContent = '⏸'; box.classList.add('on'); bar.classList.add('on'); };
    au.onpause = function () { if (!au.ended) { btn.textContent = '▶'; box.classList.remove('on'); contracter(700); } };
    au.onended = function () { if (idx < playlist.length - 1) playIdx(idx + 1); else { stopUi(); idx = 0; au.removeAttribute('src'); contracter(400); } };
    au.ontimeupdate = function () {
      var done = 0, i, tot = 0; for (i = 0; i < playlist.length; i++) { tot += playlist[i].duree; if (i < idx) done += playlist[i].duree; }
      var cur = au.duration ? Math.min(au.currentTime, au.duration) : 0, c = playlist[idx];
      fill.style.width = Math.min(100, (done + cur) / tot * 100) + '%';
      lbl.textContent = '🎧 ' + (c && c.num ? c.num + '/' + n + ' · ' + c.titre : 'Podcast Algeria Tech') + ' · ' + mmss(done + cur) + ' / ' + mmss(tot);
    };

    // La pastille suit la vidéo Flash info (déplaçable / redimensionnable) : juste au-dessus, jamais cachée par elle.
    function place() {
      var f = document.getElementById('flash-widget-root'), r = f && f.getBoundingClientRect(), vh = window.innerHeight;
      var visible = r && r.width > 0 && r.height > 0 && getComputedStyle(f).display !== 'none';
      var k = (box.offsetWidth && box.getBoundingClientRect().width / box.offsetWidth) || 1;   // zoom de page (panneau accessibilité)
      var left = 18, bottom = window.innerWidth <= 900 ? 76 : 18, w = 300;   // mobile : au-dessus de la barre du bas
      if (document.body.classList.contains('ml')) {
        // Smartphone (mobile-lite) : jamais par-dessus les barres du bas (Flash | 30 s, puis navigation) ; bouton compact 🎧, déployé au toucher
        var barres = ['ml-media', 'ml-nav'].map(function (i) { return document.getElementById(i); }).filter(function (e) {
          return e && e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none';
        });
        var haut = barres.length ? Math.min.apply(null, barres.map(function (e) { return e.getBoundingClientRect().top; })) : vh - 76;
        left = 12; bottom = vh - haut + 10;
        w = ((box.classList.contains('open') || box.classList.contains('on')) && !box.classList.contains('mini')) ? Math.min(320, window.innerWidth - 24) : 46;
        box.style.left = left + 'px'; box.style.bottom = bottom + 'px'; box.style.width = w + 'px';
        panel.style.left = left + 'px'; panel.style.width = Math.min(320, window.innerWidth - 24) + 'px'; panel.style.bottom = (bottom + 54) + 'px';
        return;
      }
      if (visible) {
        w = Math.max(200, Math.min(300, r.width)); left = Math.max(6, r.left); bottom = vh - r.top + 8;
        if (r.top < 60) bottom = vh - r.bottom - 52;
        left /= k; bottom /= k; w /= k;
      }
      var deploye = (box.classList.contains('open') || box.classList.contains('on')) && !box.classList.contains('mini');
      box.style.left = left + 'px'; box.style.bottom = bottom + 'px'; box.style.width = (deploye ? w : 46) + 'px';
      panel.style.left = left + 'px'; panel.style.width = w + 'px'; panel.style.bottom = (bottom + 54) + 'px';
    }
    // Smartphone : bouton compact 🎧 ; un toucher le déploie (lecture, langue, nombre d'infos) ; il se replie seul après 8 s d'inactivité
    var repli = null;
    function armer() {
      clearTimeout(repli);
      repli = setTimeout(function () { if (!box.classList.contains('on') && !panel.classList.contains('open')) box.classList.remove('open'); }, 8000);
    }
    box.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.min')) {   // réduire : la barre redevient le cercle 🎧 (la lecture continue)
        e.preventDefault(); e.stopPropagation();
        panel.classList.remove('open'); box.classList.remove('open'); box.classList.add('mini'); place();
        return;
      }
      var cercle = box.classList.contains('mini') || (!box.classList.contains('open') && !box.classList.contains('on'));
      if (cercle) { e.preventDefault(); e.stopPropagation(); clearTimeout(contracteur); demarrer(); armer(); return; }   // un toucher : le cercle s'allonge et la lecture démarre
      armer();
    }, true);
    panel.addEventListener('click', armer);
    au.addEventListener('play', function () { clearTimeout(contracteur); if (!box.classList.contains('mini')) box.classList.add('open'); place(); });
    au.addEventListener('pause', armer);
    build(); drawLangs(); place(); setInterval(place, 400); window.addEventListener('resize', place);
  }).catch(function () {});
})();
