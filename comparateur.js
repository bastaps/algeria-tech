'use strict';
/* ═══════════════════════════════════════════════════════════════
   COMPARATEUR.JS — Algeria Tech
   Comparateur d'offres mobiles Algérie (Mobilis / Djezzy / Ooredoo)
   ─────────────────────────────────────────────────────────────
   Données indicatives — mise à jour manuelle recommandée chaque trimestre.
   Format offre : { id, op, name, type, price, data, calls, intl,
                    extras[], badge, link, validity }
═══════════════════════════════════════════════════════════════ */

/* ── Opérateurs ─────────────────────────────────────────────── */
const COMP_OPS = {
  mobilis: { name: 'Mobilis', color: '#1565C0', light: '#e8f0fb', site: 'https://www.mobilis.dz'  },
  djezzy:  { name: 'Djezzy',  color: '#C62828', light: '#fdecea', site: 'https://www.djezzy.dz'   },
  ooredoo: { name: 'Ooredoo', color: '#BF360C', light: '#fbe9e7', site: 'https://www.ooredoo.dz'  },
};

/* ── Offres (DA/mois, données indicatives juin 2025) ────────── */
const COMP_OFFERS = [
  /* ─── Mobilis ─── */
  {
    id:'m1', op:'mobilis', name:'Sim+ 3 Go',
    type:'prepaid', price:300, data:3,
    calls:'Mobilis illimités', intl:false,
    extras:['4G inclus','SMS illimités'],
    badge:null, validity:30, link:'https://www.mobilis.dz/particulier/offres'
  },
  {
    id:'m2', op:'mobilis', name:'Sim+ 5 Go',
    type:'prepaid', price:500, data:5,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G inclus','Appels illimités','SMS illimités'],
    badge:'Populaire', validity:30, link:'https://www.mobilis.dz/particulier/offres'
  },
  {
    id:'m3', op:'mobilis', name:'Sim+ 10 Go',
    type:'prepaid', price:850, data:10,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G inclus','Appels illimités','Nuits illimitées'],
    badge:null, validity:30, link:'https://www.mobilis.dz/particulier/offres'
  },
  {
    id:'m4', op:'mobilis', name:'Sim+ 20 Go',
    type:'prepaid', price:1400, data:20,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G inclus','1 Go offert le week-end','Appels illimités'],
    badge:'Meilleur rapport', validity:30, link:'https://www.mobilis.dz/particulier/offres'
  },
  {
    id:'m5', op:'mobilis', name:'Sim+ 50 Go',
    type:'prepaid', price:2500, data:50,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G+ inclus','3 Go offerts week-end','Appels illimités'],
    badge:null, validity:30, link:'https://www.mobilis.dz/particulier/offres'
  },
  {
    id:'m6', op:'mobilis', name:'El Manawar Pro',
    type:'postpaid', price:3000, data:60,
    calls:'Tous réseaux illimités', intl:true,
    extras:['4G+ inclus','Roaming disponible','60 min intl/mois','Appels illimités'],
    badge:'Pro', validity:30, link:'https://www.mobilis.dz/professionnel'
  },

  /* ─── Djezzy ─── */
  {
    id:'d1', op:'djezzy', name:'Pack 3 Go',
    type:'prepaid', price:350, data:3,
    calls:'Djezzy illimités', intl:false,
    extras:['4G inclus','SMS illimités'],
    badge:null, validity:30, link:'https://www.djezzy.dz/particulier/forfaits'
  },
  {
    id:'d2', op:'djezzy', name:'Pack 5 Go',
    type:'prepaid', price:600, data:5,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G inclus','Appels illimités','Réseaux sociaux 1 Go offerts'],
    badge:'Populaire', validity:30, link:'https://www.djezzy.dz/particulier/forfaits'
  },
  {
    id:'d3', op:'djezzy', name:'Pack 10 Go',
    type:'prepaid', price:1000, data:10,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G inclus','Appels illimités','2 Go bonus nuit'],
    badge:null, validity:30, link:'https://www.djezzy.dz/particulier/forfaits'
  },
  {
    id:'d4', op:'djezzy', name:'Pack 20 Go',
    type:'prepaid', price:1700, data:20,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G+ inclus','Appels illimités','2 Go offerts week-end'],
    badge:'Meilleur rapport', validity:30, link:'https://www.djezzy.dz/particulier/forfaits'
  },
  {
    id:'d5', op:'djezzy', name:'Pack 30 Go',
    type:'prepaid', price:2200, data:30,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G+ inclus','Appels illimités'],
    badge:null, validity:30, link:'https://www.djezzy.dz/particulier/forfaits'
  },
  {
    id:'d6', op:'djezzy', name:'Smart Pro 50 Go',
    type:'postpaid', price:3200, data:50,
    calls:'Tous réseaux illimités', intl:true,
    extras:['4G+ inclus','60 min intl/mois','Roaming disponible','Appels illimités'],
    badge:'Pro', validity:30, link:'https://www.djezzy.dz/professionnel'
  },

  /* ─── Ooredoo ─── */
  {
    id:'o1', op:'ooredoo', name:'Pack 3 Go',
    type:'prepaid', price:400, data:3,
    calls:'Ooredoo illimités', intl:false,
    extras:['4G inclus','SMS illimités'],
    badge:null, validity:30, link:'https://www.ooredoo.dz/particulier/forfaits'
  },
  {
    id:'o2', op:'ooredoo', name:'Pack 5 Go',
    type:'prepaid', price:650, data:5,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G inclus','Appels illimités','WhatsApp & Facebook offerts'],
    badge:null, validity:30, link:'https://www.ooredoo.dz/particulier/forfaits'
  },
  {
    id:'o3', op:'ooredoo', name:'Pack 10 Go',
    type:'prepaid', price:1100, data:10,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G inclus','Appels illimités','Réseaux sociaux offerts'],
    badge:'Populaire', validity:30, link:'https://www.ooredoo.dz/particulier/forfaits'
  },
  {
    id:'o4', op:'ooredoo', name:'Pack 20 Go',
    type:'prepaid', price:1800, data:20,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G+ inclus','Appels illimités','Réseaux sociaux offerts','2 Go week-end'],
    badge:'Meilleur rapport', validity:30, link:'https://www.ooredoo.dz/particulier/forfaits'
  },
  {
    id:'o5', op:'ooredoo', name:'Pack 50 Go',
    type:'prepaid', price:3000, data:50,
    calls:'Tous réseaux illimités', intl:false,
    extras:['4G+ inclus','Appels illimités','Réseaux sociaux offerts'],
    badge:null, validity:30, link:'https://www.ooredoo.dz/particulier/forfaits'
  },
  {
    id:'o6', op:'ooredoo', name:'Ooredoo Pro 100 Go',
    type:'postpaid', price:3800, data:100,
    calls:'Tous réseaux illimités', intl:true,
    extras:['4G+ inclus','120 min intl/mois','Roaming inclus','Appels illimités'],
    badge:'Pro', validity:30, link:'https://www.ooredoo.dz/professionnel'
  },
];

/* ── État des filtres (valeurs par défaut = toutes offres) ──── */
let _cState = { budget: 9999, data: 0, type: 'any', intl: 'any' };

/* ═══════════════════════════════════════════════════════════════
   LOGIQUE DE FILTRAGE & SCORING
═══════════════════════════════════════════════════════════════ */
function _filterOffers() {
  return COMP_OFFERS.filter(function (o) {
    if (o.price > _cState.budget)         return false;
    if (o.data  < _cState.data)           return false;
    if (_cState.type !== 'any' && o.type !== _cState.type) return false;
    if (_cState.intl === '1' && !o.intl)  return false;
    return true;
  });
}

/* Score = Go par 100 DA + bonus extras + bonus intl */
function _score(o) {
  var base    = (o.data / o.price) * 100;           // Go / 100 DA
  var extras  = o.extras.length * 0.15;
  var intlB   = o.intl ? 0.5 : 0;
  return base + extras + intlB;
}

/* ═══════════════════════════════════════════════════════════════
   RENDU HTML
═══════════════════════════════════════════════════════════════ */
function _icon(name) {
  return '<i class="fas fa-' + name + '"></i>';
}

function _badgeHTML(badge, rank) {
  if (rank === 0) {
    return '<span class="comp-rec-badge">' + _icon('star') + ' Notre recommandation</span>';
  }
  if (badge === 'Populaire') return '<span class="comp-pop-badge">' + _icon('fire') + ' Populaire</span>';
  if (badge === 'Pro')       return '<span class="comp-pro-badge">' + _icon('briefcase') + ' Pro</span>';
  return '';
}

function _valueBarHTML(score, maxScore) {
  var pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  var color = pct >= 75 ? '#2e7d32' : pct >= 45 ? '#f57c00' : '#c62828';
  return (
    '<div class="comp-value-row">' +
      '<span class="comp-value-label">' + _icon('chart-bar') + ' Rapport qualité-prix</span>' +
      '<div class="comp-value-bar">' +
        '<div class="comp-value-fill" style="width:' + pct + '%;background:' + color + '" data-pct="' + pct + '"></div>' +
      '</div>' +
      '<span class="comp-value-pct">' + pct + '%</span>' +
    '</div>'
  );
}

function _offerCard(o, rank, maxScore) {
  var op    = COMP_OPS[o.op];
  var score = _score(o);
  var isTop = rank === 0;
  return (
    '<div class="comp-card' + (isTop ? ' comp-card-top' : '') + '" style="--op-color:' + op.color + ';--op-light:' + op.light + '" data-id="' + o.id + '">' +
      '<div class="comp-card-header">' +
        '<span class="comp-op-name">' + op.name + '</span>' +
        _badgeHTML(o.badge, rank) +
      '</div>' +
      '<div class="comp-card-body">' +
        '<div class="comp-offer-name">' + o.name + '</div>' +
        '<div class="comp-price">' +
          '<strong>' + o.price.toLocaleString('fr-DZ') + '</strong>' +
          '<span class="comp-currency"> DA<small>/mois</small></span>' +
        '</div>' +
        '<ul class="comp-specs">' +
          '<li>' + _icon('database') + ' <strong>' + o.data + ' Go</strong> de data 4G</li>' +
          '<li>' + _icon('phone-alt') + ' ' + o.calls + '</li>' +
          '<li>' + _icon('comment-sms') + ' SMS illimités</li>' +
          (o.intl ? '<li>' + _icon('globe') + ' Appels internationaux inclus</li>' : '') +
        '</ul>' +
        '<div class="comp-extras">' +
          o.extras.map(function (e) {
            return '<span class="comp-extra-tag">' + e + '</span>';
          }).join('') +
        '</div>' +
        _valueBarHTML(score, maxScore) +
        '<a href="' + o.link + '" target="_blank" rel="noopener" class="comp-cta" style="background:' + op.color + '">' +
          _icon('external-link-alt') + ' Voir l\'offre sur ' + op.name +
        '</a>' +
      '</div>' +
    '</div>'
  );
}

function _renderResults() {
  var box = document.getElementById('compResults');
  if (!box) return;

  var filtered = _filterOffers();
  filtered.sort(function (a, b) { return _score(b) - _score(a); });

  if (filtered.length === 0) {
    box.innerHTML =
      '<div class="comp-empty">' +
        _icon('search') +
        '<p>Aucune offre ne correspond à vos critères.</p>' +
        '<p class="comp-empty-hint">Essayez d\'augmenter votre budget ou de réduire le volume data.</p>' +
      '</div>';
    return;
  }

  var maxScore = _score(filtered[0]);

  // Compteur résultats
  var counter =
    '<p class="comp-count">' +
      _icon('filter') + ' ' + filtered.length + ' offre' + (filtered.length > 1 ? 's' : '') +
      ' correspondent à vos critères' +
    '</p>';

  var cards = filtered.map(function (o, i) {
    return _offerCard(o, i, maxScore);
  }).join('');

  box.innerHTML = counter + '<div class="comp-grid">' + cards + '</div>';

  // Anime les barres après insertion dans le DOM
  requestAnimationFrame(function () {
    box.querySelectorAll('.comp-value-fill').forEach(function (el) {
      el.style.width = el.dataset.pct + '%';
    });
  });
}

/* ── Template principal ─────────────────────────────────────── */
function _buildHTML() {
  return (
    '<div class="comp-wrap">' +

      /* Hero */
      '<div class="comp-hero">' +
        '<div class="comp-hero-icons">' +
          '<img src="/images/logo-mobilis.png" alt="Mobilis" onerror="this.style.display=\'none\'" class="comp-op-logo">' +
          '<img src="/images/logo-djezzy.png"  alt="Djezzy"  onerror="this.style.display=\'none\'" class="comp-op-logo">' +
          '<img src="/images/logo-ooredoo.png" alt="Ooredoo" onerror="this.style.display=\'none\'" class="comp-op-logo">' +
        '</div>' +
        '<h1 class="comp-hero-title">' + _icon('mobile-alt') + ' Comparateur d\'offres mobiles</h1>' +
        '<p class="comp-hero-sub">Trouvez le meilleur forfait 4G chez Mobilis, Djezzy ou Ooredoo selon votre budget et votre usage.</p>' +
      '</div>' +

      '<div class="comp-layout">' +

        /* Filtres */
        '<aside class="comp-filters">' +
          '<h2 class="comp-filters-title">' + _icon('sliders-h') + ' Vos besoins</h2>' +

          _filterGroup('Budget mensuel', 'budget', [
            { val:500,  label:'< 500 DA' },
            { val:1100, label:'500 – 1 100 DA' },
            { val:2000, label:'1 100 – 2 000 DA' },
            { val:9999, label:'> 2 000 DA', active:true },
          ]) +

          _filterGroup('Volume data', 'data', [
            { val:0,  label:'Peu importe', active:true },
            { val:3,  label:'≥ 3 Go' },
            { val:10, label:'≥ 10 Go' },
            { val:20, label:'≥ 20 Go' },
            { val:50, label:'≥ 50 Go' },
          ]) +

          _filterGroup('Type de forfait', 'type', [
            { val:'any',      label:'Tous',      active:true },
            { val:'prepaid',  label:'Prépayé' },
            { val:'postpaid', label:'Postpayé' },
          ]) +

          _filterGroup('Appels internationaux', 'intl', [
            { val:'any', label:'Non requis', active:true },
            { val:'1',   label:'Oui, indispensable' },
          ]) +

          '<p class="comp-updated">' + _icon('sync-alt') + ' Données mises à jour : <strong>Juin 2025</strong></p>' +
        '</aside>' +

        /* Résultats */
        '<main class="comp-results-wrap">' +
          '<div id="compResults" class="comp-results"></div>' +
        '</main>' +

      '</div>' +

      /* Disclaimer */
      '<div class="comp-disclaimer">' +
        _icon('exclamation-triangle') +
        ' Tarifs <strong>indicatifs</strong> — toujours vérifier sur le site officiel de l\'opérateur avant souscription. ' +
        'Les offres peuvent changer sans préavis.' +
      '</div>' +

    '</div>'
  );
}

function _filterGroup(label, key, options) {
  return (
    '<div class="comp-filter-group">' +
      '<label class="comp-filter-label">' + label + '</label>' +
      '<div class="comp-pills" data-key="' + key + '">' +
        options.map(function (o) {
          return (
            '<button class="comp-pill' + (o.active ? ' comp-pill-active' : '') + '" ' +
              'data-val="' + o.val + '" ' +
              'onclick="window._compSetFilter(\'' + key + '\', \'' + o.val + '\', this)">' +
              o.label +
            '</button>'
          );
        }).join('') +
      '</div>' +
    '</div>'
  );
}

/* ═══════════════════════════════════════════════════════════════
   API PUBLIQUE
═══════════════════════════════════════════════════════════════ */

/* Appelé par chaque pill */
window._compSetFilter = function (key, val, btn) {
  /* Toggle actif dans le groupe */
  var group = btn.closest('.comp-pills');
  if (group) {
    group.querySelectorAll('.comp-pill').forEach(function (b) {
      b.classList.remove('comp-pill-active');
    });
  }
  btn.classList.add('comp-pill-active');

  /* Mise à jour état */
  if (key === 'budget') _cState.budget = parseInt(val, 10);
  else if (key === 'data') _cState.data = parseInt(val, 10);
  else _cState[key] = val;

  _renderResults();
};

/* Appelé par script.js (showComparateur) */
window.initComparateur = function () {
  var section = document.getElementById('comparateurSection');
  if (!section) return;
  // Inject HTML si pas encore fait
  if (!section.querySelector('.comp-wrap')) {
    section.innerHTML = _buildHTML();
  }
  // Réinitialise les filtres
  _cState = { budget: 9999, data: 0, type: 'any', intl: 'any' };
  _renderResults();
};
