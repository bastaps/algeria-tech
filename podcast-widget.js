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
      '<a role="button" tabindex="0" class="opt" aria-label="Options">⚙</a>';
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
        b.onclick = function () { lang = l; prefs.lang = l; save(prefs); au.pause(); idx = 0; au.removeAttribute('src'); stopUi(); build(); drawLangs(); };
        langsEl.appendChild(b);
      });
    }
    function stopUi() { box.classList.remove('on'); bar.classList.remove('on'); btn.textContent = '▶'; fill.style.width = '0'; }
    function playIdx(i) { idx = i; au.src = playlist[i].mp3; au.play(); }
    range.value = n;
    range.oninput = function () { n = +range.value; prefs.n = n; save(prefs); au.pause(); idx = 0; au.removeAttribute('src'); stopUi(); build(); };
    box.querySelector('.opt').onclick = function () { panel.classList.toggle('open'); };
    panel.querySelector('.tx').onclick = function () { txt.style.display = txt.style.display === 'block' ? 'none' : 'block'; };
    btn.onclick = function () { if (!au.src || au.ended && idx >= playlist.length - 1) { playIdx(0); } else if (au.paused) au.play(); else au.pause(); };
    au.onplay = function () { btn.textContent = '⏸'; box.classList.add('on'); bar.classList.add('on'); };
    au.onpause = function () { if (!au.ended) { btn.textContent = '▶'; box.classList.remove('on'); } };
    au.onended = function () { if (idx < playlist.length - 1) playIdx(idx + 1); else { stopUi(); idx = 0; au.removeAttribute('src'); } };
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
      if (visible) {
        w = Math.max(200, Math.min(300, r.width)); left = Math.max(6, r.left); bottom = vh - r.top + 8;
        if (r.top < 60) bottom = vh - r.bottom - 52;
        left /= k; bottom /= k; w /= k;
      }
      box.style.left = left + 'px'; box.style.bottom = bottom + 'px'; box.style.width = w + 'px';
      panel.style.left = left + 'px'; panel.style.width = w + 'px'; panel.style.bottom = (bottom + 46) + 'px';
    }
    build(); drawLangs(); place(); setInterval(place, 400); window.addEventListener('resize', place);
  }).catch(function () {});
})();
