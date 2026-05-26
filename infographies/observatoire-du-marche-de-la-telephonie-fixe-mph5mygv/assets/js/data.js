/**
 * Dataset généré automatiquement — Algeria Tech Generator v3
 * Source  : OBSERVATOIRE DU MARCHÉ DE LA TÉLÉPHONIE FIXE
 * Période : 2025
 * Généré le : 22/05/2026
 */

export const DOC_TYPE = "telecom";

export const PALETTE = [
  "#D4A437",
  "#2D8A5F",
  "#B85042",
  "#4A6FA5",
  "#6CC298",
  "#D16B5D"
];

export const DATASET = {

  meta: {
    titre:    "OBSERVATOIRE DU MARCHÉ DE LA TÉLÉPHONIE FIXE",
    sousTitre:"AUTORITÉ DE RÉGULATION DE LA POSTE ET DES COMMUNICATIONS ELECTRONIQUES",
    source:   "Observatoire du Marché de la Téléphonie Fixe Algérie 2025T3",
    periode:  "2025",
    dateMaj:  "2025"
  },

  kpis: [
  {
    "label": "Total des abonnés",
    "valeur": 7501156,
    "unite": "abonnés",
    "icon": "👥",
    "trend": null
  },
  {
    "label": "Abonnés résidentiels",
    "valeur": 6964516,
    "unite": "abonnés",
    "icon": "👥",
    "trend": null
  },
  {
    "label": "Abonnés professionnels",
    "valeur": 536640,
    "unite": "k",
    "icon": "👥",
    "trend": null
  },
  {
    "label": "Total des abonnés de la téléph",
    "valeur": 92.85,
    "unite": "%",
    "icon": "📈",
    "trend": "92,85%"
  },
  {
    "label": "Taux",
    "valeur": 7.15,
    "unite": "%",
    "icon": "📉",
    "trend": "7,15%"
  },
  {
    "label": "Taux",
    "valeur": 66.12,
    "unite": "%",
    "icon": "📈",
    "trend": "66,12%"
  }
],

  repartition: [
  {
    "label": "Total des abonnés de la téléph",
    "valeur": 92.85,
    "couleur": "#D4A437"
  },
  {
    "label": "Taux",
    "valeur": 7.15,
    "couleur": "#2D8A5F"
  },
  {
    "label": "Taux",
    "valeur": 66.12,
    "couleur": "#B85042"
  }
],

  indicateurs: [
  {
    "label": "Total des abonnés",
    "valeur": 7501156,
    "unite": "abonnés",
    "couleur": "#D4A437"
  },
  {
    "label": "Abonnés résidentiels",
    "valeur": 6964516,
    "unite": "abonnés",
    "couleur": "#2D8A5F"
  },
  {
    "label": "Abonnés professionnels",
    "valeur": 536640,
    "unite": "k",
    "couleur": "#B85042"
  },
  {
    "label": "Total des abonnés de l",
    "valeur": 92.85,
    "unite": "%",
    "couleur": "#4A6FA5"
  },
  {
    "label": "Taux",
    "valeur": 7.15,
    "unite": "%",
    "couleur": "#6CC298"
  },
  {
    "label": "Taux",
    "valeur": 66.12,
    "unite": "%",
    "couleur": "#D16B5D"
  }
],

  evolution: [
  {
    "periode": "Abonnés",
    "valeur": 2873892
  },
  {
    "periode": "Total des abonnés",
    "valeur": 7501156
  },
  {
    "periode": "Abonnés résidentie",
    "valeur": 6964516
  },
  {
    "periode": "Abonnés profession",
    "valeur": 536640
  },
  {
    "periode": "Total des abonnés",
    "valeur": 7501156
  },
  {
    "periode": "Résidentiels",
    "valeur": 2459728
  }
],

  keyPoints: [
  "Situation du parc de la téléphonie fixe",
  "Trafic généré dans les réseaux de téléphonie fixe par destination",
  "Nombre mensuel moyen de minutes par abonné (MOU)",
  "Évolution du marché de la téléphonie fixe",
  "A fin Septembre 2025, les abonnés résidentiels aux réseaux de la téléphonie fixe",
  "représentent 92,85% du total des abonnés de la téléphonie fixe, contre 7,15%",
  "Répartition du trafic sortant généré par destination (T3-2025)",
  "Taux d’évolution +15,36% +13,78% +16,29% +14,01%"
],

  syntheseClé: [
  {
    "titre": "Enseignement 1",
    "chiffre": "7,50 M abonnés",
    "contexte": "Total des abonnés",
    "description": "Situation du parc de la téléphonie fixe"
  },
  {
    "titre": "Enseignement 2",
    "chiffre": "6,96 M abonnés",
    "contexte": "Abonnés résidentiels",
    "description": "Trafic généré dans les réseaux de téléphonie fixe par destination"
  },
  {
    "titre": "Enseignement 3",
    "chiffre": "536 640 k",
    "contexte": "Abonnés professionnels",
    "description": "Nombre mensuel moyen de minutes par abonné (MOU)"
  }
],

  sections: [
  {
    "title": "REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE",
    "body": "AUTORITÉ DE RÉGULATION DE LA POSTE ET DES COMMUNICATIONS ELECTRONIQUES"
  },
  {
    "title": "OBSERVATOIRE DU MARCHÉ DE LA TÉLÉPHONIE FIXE",
    "body": "3 eme TRIMESTRE  2025 ARPCE/Observatoire du marché de la téléphonie fixe en Algérie/T3-2025                                                                       1 Sommaire 1. SITUATION DU PARC DE LA TELEPHONIE FIXE.....................................................1 1.1. PARC GLOBAL....................................................................................................1 1.2. REPARTI"
  }
]
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
