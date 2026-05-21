/**
 * Dataset — Algeria Tech · Observatoire du Marché de la Téléphonie Mobile
 * Source  : ARPCE — Algérie
 * Période : T3 2025
 * Généré le : 20/05/2026
 */

export const DOC_TYPE = "rapport";

export const PALETTE = [
  "#D4A437",
  "#2D8A5F",
  "#B85042",
  "#4A6FA5",
  "#94a3b8",
  "#354265"
];

export const DATASET = {

  meta: {
    titre:    "OBSERVATOIRE DU MARCHÉ DE LA TÉLÉPHONIE MOBILE EN ALGÉRIE",
    sousTitre:"Synthèse interactive des indicateurs clés T3 2025 — 55,94 M abonnés · Mobilis 41,97 % · Djezzy 31,75 % · Ooredoo 26,29 %",
    source:   "ARPCE — Algérie",
    periode:  "T3 2025",
    dateMaj:  "T3 2025"
  },

  kpis: [
  {
    "label": "Total abonnés mobile",
    "valeur": 55941086,
    "unite": "abonnés",
    "icon": "📱",
    "trend": null
  },
  {
    "label": "Mobilis (ATM)",
    "valeur": 23477942,
    "unite": "abonnés",
    "icon": "📶",
    "trend": "▲ Leader du marché"
  },
  {
    "label": "Djezzy (OTA)",
    "valeur": 17758639,
    "unite": "abonnés",
    "icon": "📶",
    "trend": null
  },
  {
    "label": "Ooredoo (WTA)",
    "valeur": 14704505,
    "unite": "abonnés",
    "icon": "📶",
    "trend": null
  },
  {
    "label": "Abonnés prépayés",
    "valeur": 95.75,
    "unite": "%",
    "icon": "💳",
    "trend": null
  },
  {
    "label": "Abonnés postpayés",
    "valeur": 4.25,
    "unite": "%",
    "icon": "📋",
    "trend": null
  }
],

  repartition: [
  {
    "label": "Mobilis (ATM)",
    "valeur": 41.97,
    "couleur": "#D4A437"
  },
  {
    "label": "Djezzy (OTA)",
    "valeur": 31.75,
    "couleur": "#2D8A5F"
  },
  {
    "label": "Ooredoo (WTA)",
    "valeur": 26.29,
    "couleur": "#B85042"
  }
],

  indicateurs: [
  {
    "label": "Mobilis (ATM)",
    "valeur": 23477942,
    "unite": "abonnés",
    "couleur": "#D4A437"
  },
  {
    "label": "Djezzy (OTA)",
    "valeur": 17758639,
    "unite": "abonnés",
    "couleur": "#2D8A5F"
  },
  {
    "label": "Ooredoo (WTA)",
    "valeur": 14704505,
    "unite": "abonnés",
    "couleur": "#B85042"
  },
  {
    "label": "Total abonnés",
    "valeur": 55941086,
    "unite": "abonnés",
    "couleur": "#4A6FA5"
  }
],

  evolution: [
  {
    "periode": "Mobilis (ATM)",
    "valeur": 23477942
  },
  {
    "periode": "Djezzy (OTA)",
    "valeur": 17758639
  },
  {
    "periode": "Ooredoo (WTA)",
    "valeur": 14704505
  }
],

  keyPoints: [
  "Le marché mobile algérien franchit les <strong>55,94 millions d'abonnés</strong> au T3 2025, un chiffre supérieur à la population totale (~45 M habitants), reflétant la prévalence du multi-équipement et des usages professionnels parallèles.",
  "<strong>Mobilis (ATM)</strong> confirme son leadership avec 23,48 millions d'abonnés et <strong>41,97 %</strong> de parts de marché, soit 10 points d'avance sur Djezzy — une position concurrentielle solide portée par un réseau 4G étendu.",
  "<strong>Djezzy (OTA)</strong> se positionne en dauphin avec 17,76 millions d'abonnés (31,75 %), tandis qu'<strong>Ooredoo (WTA)</strong> complète le triopolice avec 14,70 millions (26,29 %), soit un marché équilibré à trois acteurs.",
  "Le modèle prépayé domine structurellement à <strong>95,75 %</strong> contre 4,25 % de postpayés — levier de croissance pour les forfaits data illimitée, le roaming et les services à valeur ajoutée (IoT, convergence mobile-fixe).",
  "La somme des parts de marché (41,97 % + 31,75 % + 26,29 % = <strong>100 %</strong>) atteste d'un marché mature à trois opérateurs régulés par l'ARPCE, sans acteur dominant de manière écrasante."
],

  syntheseClé: [
  {
    "titre": "Leadership Mobilis (ATM)",
    "chiffre": "41,97 %",
    "contexte": "Part de marché T3 2025",
    "description": "Avec 23,48 millions d'abonnés, Mobilis (ATM) domine le marché mobile algérien. Son avance de 10 points sur Djezzy témoigne d'une position concurrentielle solide, portée par un réseau 4G étendu et une offre tarifaire accessible à l'ensemble du territoire national."
  },
  {
    "titre": "55,94 millions d'abonnés",
    "chiffre": "55,94 M",
    "contexte": "Parc total mobile T3 2025",
    "description": "Le marché mobile algérien affiche une taille imposante : 55,94 millions d'abonnés actifs au T3 2025. Ce chiffre, supérieur à la population totale (~45 M habitants), traduit la prévalence du multi-équipement et des usages SIM multiples dans les usages professionnels et personnels."
  },
  {
    "titre": "Prépayé ultra-dominant",
    "chiffre": "95,75 %",
    "contexte": "Part du prépayé T3 2025",
    "description": "Neuf abonnés sur dix sont en prépayé. Cette structure, typique des marchés à forte sensibilité prix, offre une opportunité aux trois opérateurs pour développer des forfaits postpayés et des services à valeur ajoutée — data illimitée, roaming international, IoT — afin d'améliorer l'ARPU moyen."
  }
],

  sections: []
};

export const fmt = {
  nombre:        (n) => Math.round(n).toLocaleString('fr-FR'),
  millions:      (n) => (n / 1e6).toFixed(2).replace('.', ',') + ' M',
  millionsCourt: (n) => (n / 1e6).toFixed(1).replace('.', ',') + ' M',
  pourcent:      (n) => parseFloat(n).toFixed(2).replace('.', ',') + '%',
  pourcentSimple:(n) => parseFloat(n).toFixed(1).replace('.', ',') + '%',
  kpi: (n, unit) => {
    const v = parseFloat(n) || 0;
    if (unit === '%') return v.toFixed(2).replace('.', ',') + '%';
    if (v >= 1e6) return (v / 1e6).toFixed(2).replace('.', ',') + ' M';
    if (v >= 1e3) return Math.round(v).toLocaleString('fr-FR');
    return String(v);
  }
};
