'use strict';
/* ═══════════════════════════════════════════════════════════════
   COMPARATEUR.JS — Algeria Tech
   Comparateur d'offres mobiles Algérie (Mobilis / Djezzy / Ooredoo)
   ─────────────────────────────────────────────────────────────
   Données officielles — mise à jour juin 2026
   Sources :
     Mobilis  → mobilis.dz/revolution_prepaid
     Djezzy   → djezzy.dz/particuliers/offres/djezzy-legend/
     Ooredoo  → ooredoo.dz (PDF officiel Dima)
   Format offre : { id, op, name, type, price, data, calls, sms, intl,
                    extras[], badge, link, validity }
═══════════════════════════════════════════════════════════════ */

/* ── Opérateurs ─────────────────────────────────────────────── */
const COMP_OPS = {
  mobilis: { name: 'Mobilis', color: '#1565C0', light: '#e8f0fb', site: 'https://www.mobilis.dz'  },
  djezzy:  { name: 'Djezzy',  color: '#C62828', light: '#fdecea', site: 'https://www.djezzy.dz'   },
  ooredoo: { name: 'Ooredoo', color: '#7B1FA2', light: '#f3e5f5', site: 'https://www.ooredoo.dz'  },
};

/* ══════════════════════════════════════════════════════════════
   OFFRES RÉELLES — juin 2026
   ──────────────────────────────────────────────────────────────
   Mobilis  : offre "Revolution" (système Mobilis Units = MU)
              1 Go internet = 50 MU | 1 min = 5 MU | 1 SMS = 10 MU
   Djezzy   : offre "LEGEND" prépayée
   Ooredoo  : offre "Dima" prépayée mensuelle
══════════════════════════════════════════════════════════════ */
const COMP_OFFERS = [

  /* ─── Mobilis Revolution ──────────────────────────────────── */
  /* Les données (Go) indiquent le maximum si tous les MU sont
     utilisés pour internet. Usage réel = combinaison appels/SMS/data. */
  {
    id:'m1', op:'mobilis', name:'Revolution 1200',
    type:'prepaid', price:1200, data:35,
    calls:'Illimités vers Mobilis', sms:'Via Mobilis Units',
    intl:false,
    extras:['Facebook après épuisement MU', '4G/5G inclus', 'MU cumulables (dès 1 000 DA)'],
    badge:null, validity:30,
    link:'https://www.mobilis.dz/revolution_prepaid'
  },
  {
    id:'m2', op:'mobilis', name:'Revolution 1500',
    type:'prepaid', price:1500, data:55,
    calls:'Illimités vers Mobilis', sms:'Via Mobilis Units',
    intl:false,
    extras:['Facebook illimité toute la validité', '4G/5G inclus', 'MU cumulables', '+200 MU si renouvellement avant J20'],
    badge:'Populaire', validity:30,
    link:'https://www.mobilis.dz/revolution_prepaid'
  },
  {
    id:'m3', op:'mobilis', name:'Revolution 1800',
    type:'prepaid', price:1800, data:80,
    calls:'Illimités vers Mobilis', sms:'Via Mobilis Units',
    intl:false,
    extras:['Facebook illimité toute la validité', '4G/5G inclus', 'MU cumulables', '+200 MU si renouvellement avant expiration'],
    badge:null, validity:30,
    link:'https://www.mobilis.dz/revolution_prepaid'
  },
  {
    id:'m4', op:'mobilis', name:'Revolution 2000',
    type:'prepaid', price:2000, data:90,
    calls:'Illimités vers tous réseaux', sms:'Illimités Mobilis + 35 SMS autres',
    intl:false,
    extras:['Facebook illimité toute la validité', '4G/5G inclus', 'MU cumulables', '+200 MU bonus renouvellement'],
    badge:'Meilleur rapport', validity:30,
    link:'https://www.mobilis.dz/revolution_prepaid'
  },
  {
    id:'m5', op:'mobilis', name:'Revolution 2500',
    type:'prepaid', price:2500, data:120,
    calls:'Illimités vers tous réseaux', sms:'Illimités Mobilis + 50 SMS autres',
    intl:false,
    extras:['Facebook illimité toute la validité', '4G/5G inclus', 'MU cumulables', '+200 MU bonus renouvellement'],
    badge:null, validity:30,
    link:'https://www.mobilis.dz/revolution_prepaid'
  },

  /* ─── Djezzy LEGEND ───────────────────────────────────────── */
  /* Plans 1000 & 1500 DA : crédit bonus (solde appels/SMS).
     Les Gigas non consommés sont cumulables au renouvellement
     (valable pour 1 500 DA et plus). */
  {
    id:'d1', op:'djezzy', name:'Legend 1 000 DA',
    type:'prepaid', price:1000, data:15,
    calls:'Illimités vers Djezzy', sms:'Illimités vers Djezzy',
    intl:false,
    extras:['2 000 DA de crédit offert', '4G/5G inclus'],
    badge:null, validity:30,
    link:'https://www.djezzy.dz/particuliers/offres/djezzy-legend/'
  },
  {
    id:'d2', op:'djezzy', name:'Legend 1 500 DA',
    type:'prepaid', price:1500, data:45,
    calls:'Illimités vers Djezzy', sms:'Illimités vers Djezzy',
    intl:false,
    extras:['3 000 DA de crédit offert', '4G/5G inclus', 'Gigas non consommés cumulables'],
    badge:'Populaire', validity:30,
    link:'https://www.djezzy.dz/particuliers/offres/djezzy-legend/'
  },
  {
    id:'d3', op:'djezzy', name:'Legend 2 000 DA',
    type:'prepaid', price:2000, data:70,
    calls:'Illimités vers tous réseaux', sms:'Illimités Djezzy + 50 SMS autres',
    intl:false,
    extras:['4G/5G inclus', 'Gigas non consommés cumulables'],
    badge:'Meilleur rapport', validity:30,
    link:'https://www.djezzy.dz/particuliers/offres/djezzy-legend/'
  },
  {
    id:'d4', op:'djezzy', name:'Legend 2 500 DA',
    type:'prepaid', price:2500, data:120,
    calls:'Illimités vers tous réseaux', sms:'Illimités Djezzy + 20 SMS autres',
    intl:false,
    extras:['4G/5G inclus', 'Gigas non consommés cumulables'],
    badge:null, validity:30,
    link:'https://www.djezzy.dz/particuliers/offres/djezzy-legend/'
  },
  {
    id:'d5', op:'djezzy', name:'Legend 3 000 DA',
    type:'prepaid', price:3000, data:145,
    calls:'Illimités vers tous réseaux', sms:'Illimités Djezzy + 25 SMS autres',
    intl:false,
    extras:['4G/5G inclus', 'Gigas non consommés cumulables'],
    badge:null, validity:30,
    link:'https://www.djezzy.dz/particuliers/offres/djezzy-legend/'
  },
  {
    id:'d6', op:'djezzy', name:'Legend 4 000 DA',
    type:'prepaid', price:4000, data:200,
    calls:'Illimités vers tous réseaux', sms:'Illimités Djezzy + 30 SMS autres',
    intl:false,
    extras:['4G/5G inclus', 'Gigas non consommés cumulables'],
    badge:null, validity:30,
    link:'https://www.djezzy.dz/particuliers/offres/djezzy-legend/'
  },

  /* ─── Ooredoo Dima ────────────────────────────────────────── */
  /* Activation : *500# ou app My Ooredoo | Infos : 333 | ooredoo.dz
     Dima 500 : validité 15 jours | Dima 750 : validité 14 jours
     Toutes offres compatibles 4G et 5G. */
  {
    id:'o1', op:'ooredoo', name:'Dima 500',
    type:'prepaid', price:500, data:3,
    calls:'Illimités vers Ooredoo + 100 min autres', sms:'50 SMS tous réseaux',
    intl:false,
    extras:['Facebook gratuit', '4G/5G inclus'],
    badge:null, validity:15,
    link:'https://www.ooredoo.dz/fr/'
  },
  {
    id:'o2', op:'ooredoo', name:'Dima 750',
    type:'prepaid', price:750, data:10,
    calls:'Illimités vers Ooredoo + 100 min autres', sms:'50 SMS tous réseaux',
    intl:false,
    extras:['Facebook gratuit', '4G/5G inclus'],
    badge:null, validity:14,
    link:'https://www.ooredoo.dz/fr/'
  },
  {
    id:'o3', op:'ooredoo', name:'Dima 1200',
    type:'prepaid', price:1200, data:8,
    calls:'Illimités vers Ooredoo + 100 min autres', sms:'120 SMS tous réseaux',
    intl:false,
    extras:['Facebook gratuit', 'ANAFLIX inclus', '4G/5G inclus'],
    badge:null, validity:30,
    link:'https://www.ooredoo.dz/fr/'
  },
  {
    id:'o4', op:'ooredoo', name:'Dima 1500',
    type:'prepaid', price:1500, data:30,
    calls:'Illimités vers Ooredoo + 150 min autres', sms:'150 SMS tous réseaux',
    intl:false,
    extras:['Facebook gratuit', 'ANAFLIX inclus', '4G/5G inclus'],
    badge:'Populaire', validity:30,
    link:'https://www.ooredoo.dz/fr/'
  },
  {
    id:'o5', op:'ooredoo', name:'Dima 2000',
    type:'prepaid', price:2000, data:50,
    calls:'Illimités vers Ooredoo + 300 min autres', sms:'200 SMS tous réseaux',
    intl:false,
    extras:['Facebook gratuit', 'ANAFLIX + ANAZIK inclus', '4G/5G inclus'],
    badge:'Meilleur rapport', validity:30,
    link:'https://www.ooredoo.dz/fr/'
  },
  {
    id:'o6', op:'ooredoo', name:'Dima 2500',
    type:'prepaid', price:2500, data:100,
    calls:'Illimités vers tous réseaux', sms:'Illimités Ooredoo + 100 SMS autres',
    intl:false,
    extras:['Facebook gratuit', 'ANAFLIX + ANAZIK + GoPlay', '4G/5G inclus'],
    badge:null, validity:30,
    link:'https://www.ooredoo.dz/fr/'
  },
  {
    id:'o7', op:'ooredoo', name:'Dima 4000',
    type:'prepaid', price:4000, data:200,
    calls:'Illimités vers tous réseaux', sms:'Illimités Ooredoo + 200 SMS autres',
    intl:false,
    extras:['4G/5G inclus'],
    badge:null, validity:30,
    link:'https://www.ooredoo.dz/fr/'
  },
];

/* ── État des filtres (valeurs par défaut = toutes offres) ──── */
let _cState = { budget: 9999, data: 0, type: 'any', intl: 'any' };

/* ═══════════════════════════════════════════════════════════════
   LOGIQUE DE FILTRAGE & SCORING
═══════════════════════════════════════════════════════════════ */
function _filterOffers() {
  return COMP_OFFERS.filter(function (o) {
    if (o.price > _cState.budget)                          return false;
    if (o.data  < _cState.data)                            return false;
    if (_cState.type !== 'any' && o.type !== _cState.type) return false;
    if (_cState.intl === '1'   && !o.intl)                 return false;
    return true;
  });
}

/* Score = Go par 100 DA (normalisé sur 30 jours) + bonus extras */
function _score(o) {
  var validity  = o.validity || 30;
  /* Normalise au mois : une offre 15 jours à 500 DA revient à 1000 DA/mois */
  var normPrice = o.price * (30 / validity);
  var base      = (o.data / normPrice) * 100;   // Go / 100 DA équivalent mensuel
  var extras    = o.extras.length * 0.15;
  var intlB     = o.intl ? 0.5 : 0;
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
  if (badge === 'Populaire')       return '<span class="comp-pop-badge">'  + _icon('fire')      + ' Populaire</span>';
  if (badge === 'Meilleur rapport') return '<span class="comp-best-badge">' + _icon('thumbs-up') + ' Meilleur rapport</span>';
  if (badge === 'Pro')              return '<span class="comp-pro-badge">'  + _icon('briefcase') + ' Pro</span>';
  return '';
}

function _valueBarHTML(score, maxScore) {
  var pct   = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  var color = pct >= 75 ? '#2e7d32' : pct >= 45 ? '#f57c00' : '#c62828';
  return (
    '<div class="comp-value-row">' +
      '<span class="comp-value-label">' + _icon('chart-bar') + ' Rapport qualité-prix</span>' +
      '<div class="comp-value-bar">' +
        '<div class="comp-value-fill" style="width:0%;background:' + color + '" data-pct="' + pct + '"></div>' +
      '</div>' +
      '<span class="comp-value-pct">' + pct + '%</span>' +
    '</div>'
  );
}

function _offerCard(o, rank, maxScore) {
  var op    = COMP_OPS[o.op];
  var score = _score(o);
  var isTop = rank === 0;

  /* Validité */
  var validLabel = o.validity === 30 ? '30 jours'
                 : o.validity === 15 ? '15 jours'
                 : o.validity === 14 ? '14 jours'
                 : o.validity + ' jours';
  var validIcon  = o.validity < 30 ? ' <em class="comp-validity-warn">(attention : ' + validLabel + ')</em>' : validLabel;

  /* SMS */
  var smsLine = o.sms
    ? '<li>' + _icon('comment-sms') + ' ' + o.sms + '</li>'
    : '';

  return (
    '<div class="comp-card' + (isTop ? ' comp-card-top' : '') +
      '" style="--op-color:' + op.color + ';--op-light:' + op.light + '" data-id="' + o.id + '">' +

      '<div class="comp-card-header">' +
        '<span class="comp-op-name">' + op.name + '</span>' +
        _badgeHTML(o.badge, rank) +
      '</div>' +

      '<div class="comp-card-body">' +
        '<div class="comp-offer-name">' + o.name + '</div>' +
        '<div class="comp-price">' +
          '<strong>' + o.price.toLocaleString('fr-DZ') + '</strong>' +
          '<span class="comp-currency"> DA</span>' +
        '</div>' +

        '<ul class="comp-specs">' +
          '<li>' + _icon('database')    + ' <strong>' + o.data + ' Go</strong> de data 4G/5G</li>' +
          '<li>' + _icon('calendar-alt') + ' Validité : ' + validIcon + '</li>' +
          '<li>' + _icon('phone-alt')   + ' ' + o.calls + '</li>' +
          smsLine +
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

  var counter =
    '<p class="comp-count">' +
      _icon('filter') + ' ' + filtered.length + ' offre' + (filtered.length > 1 ? 's' : '') +
      ' correspondent à vos critères' +
    '</p>';

  var cards = filtered.map(function (o, i) {
    return _offerCard(o, i, maxScore);
  }).join('');

  box.innerHTML = counter + '<div class="comp-grid">' + cards + '</div>';

  /* Anime les barres après insertion dans le DOM */
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
        '<p class="comp-hero-sub">Comparez les forfaits officiels <strong>Mobilis Revolution</strong>, <strong>Djezzy LEGEND</strong> et <strong>Ooredoo Dima</strong> — données réelles juin 2026.</p>' +
      '</div>' +

      '<div class="comp-layout">' +

        /* Filtres */
        '<aside class="comp-filters">' +
          '<h2 class="comp-filters-title">' + _icon('sliders-h') + ' Vos besoins</h2>' +

          _filterGroup('Budget mensuel', 'budget', [
            { val:1000, label:'≤ 1 000 DA' },
            { val:1500, label:'≤ 1 500 DA' },
            { val:2500, label:'≤ 2 500 DA' },
            { val:9999, label:'Peu importe', active:true },
          ]) +

          _filterGroup('Volume data', 'data', [
            { val:0,   label:'Peu importe', active:true },
            { val:10,  label:'≥ 10 Go' },
            { val:30,  label:'≥ 30 Go' },
            { val:50,  label:'≥ 50 Go' },
            { val:100, label:'≥ 100 Go' },
          ]) +

          _filterGroup('Type de forfait', 'type', [
            { val:'any',     label:'Tous', active:true },
            { val:'prepaid', label:'Prépayé' },
          ]) +

          _filterGroup('Appels vers tous réseaux', 'intl', [
            { val:'any', label:'Non requis', active:true },
            { val:'1',   label:'Oui, indispensable' },
          ]) +

          '<p class="comp-updated">' + _icon('sync-alt') + ' Données officielles : <strong>Juin 2026</strong></p>' +
        '</aside>' +

        /* Résultats */
        '<main class="comp-results-wrap">' +
          '<div id="compResults" class="comp-results"></div>' +
        '</main>' +

      '</div>' +

      /* Disclaimer */
      '<div class="comp-disclaimer">' +
        _icon('exclamation-triangle') +
        ' Données issues des sources officielles (juin 2026) — toujours vérifier sur le site de l\'opérateur avant souscription. ' +
        'Le classement est basé sur le rapport Go/DA normalisé sur 30 jours. ' +
        'Pour Mobilis Revolution, les Go indiqués correspondent à l\'usage 100 % data (système Mobilis Units flexible).' +
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
  var group = btn.closest('.comp-pills');
  if (group) {
    group.querySelectorAll('.comp-pill').forEach(function (b) {
      b.classList.remove('comp-pill-active');
    });
  }
  btn.classList.add('comp-pill-active');

  if      (key === 'budget') _cState.budget = parseInt(val, 10);
  else if (key === 'data')   _cState.data   = parseInt(val, 10);
  else                       _cState[key]   = val;

  _renderResults();
};

/* Appelé par script.js (showComparateur) */
window.initComparateur = function () {
  var section = document.getElementById('comparateurSection');
  if (!section) return;
  if (!section.querySelector('.comp-wrap')) {
    section.innerHTML = _buildHTML();
  }
  _cState = { budget: 9999, data: 0, type: 'any', intl: 'any' };
  _renderResults();
};
