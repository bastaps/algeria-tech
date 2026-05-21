/**
 * Dataset généré automatiquement — Algeria Tech Generator v3
 * Source  : Programme 77.7 : la formation numérique pour tous, de 7 à 77 ans
 * Période : 2026
 * Généré le : 21/05/2026
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
    titre:    "Programme 77.7 : la formation numérique pour tous, de 7 à 77 ans",
    sousTitre:"# 🇩🇿 Algérie / Numérique : Le programme « 77.7 » veut former 30 000 citoyens par an, de 7 à 77 ans",
    source:   "Programme de formation numérque de 7 à 77 ans en Algérie",
    periode:  "2026",
    dateMaj:  "2026"
  },

  kpis: [
  {
    "label": "Veut former",
    "valeur": 30000,
    "unite": "",
    "icon": "📊",
    "trend": null
  },
  {
    "label": "Apacité annuelle alger centre ",
    "valeur": 1000,
    "unite": "",
    "icon": "📊",
    "trend": null
  },
  {
    "label": "Citoyens formés par an",
    "valeur": 25000,
    "unite": "",
    "icon": "📊",
    "trend": null
  }
],

  repartition: [
  {
    "label": "Veut former",
    "valeur": 53.6,
    "couleur": "#D4A437"
  },
  {
    "label": "Apacité annuelle alger centre ",
    "valeur": 1.8,
    "couleur": "#2D8A5F"
  },
  {
    "label": "Citoyens formés par an",
    "valeur": 44.6,
    "couleur": "#B85042"
  }
],

  indicateurs: [
  {
    "label": "Veut former",
    "valeur": 30000,
    "unite": "",
    "couleur": "#D4A437"
  },
  {
    "label": "Apacité annuelle alger",
    "valeur": 1000,
    "unite": "",
    "couleur": "#2D8A5F"
  },
  {
    "label": "Citoyens formés par an",
    "valeur": 25000,
    "unite": "",
    "couleur": "#B85042"
  }
],

  evolution: [],

  keyPoints: [
  "🔐 Participants formés à la cybersécurité 100 %",
  "L'indicateur « Veut former » ressort à 30 000 pour la période analysée.",
  "L'indicateur « Apacité annuelle alger centre pilote » ressort à 1 000 pour la période analysée.",
  "L'indicateur « Stagiaires oran centre ouest » ressort à 1 000 pour la période analysée.",
  "L'indicateur « Stagiaires annaba centre est » ressort à 1 000 pour la période analysée.",
  "L'indicateur « Agiaires sétif centre hauts-plateaux » ressort à 1 000 pour la période analysée.",
  "L'indicateur « Stagiaires chlef centre centre-ouest » ressort à 1 000 pour la période analysée."
],

  syntheseClé: [
  {
    "titre": "Enseignement 1",
    "chiffre": "30 000",
    "contexte": "Veut former",
    "description": "🔐 Participants formés à la cybersécurité 100 %"
  },
  {
    "titre": "Enseignement 2",
    "chiffre": "1 000",
    "contexte": "Apacité annuelle alger centre ",
    "description": "L'indicateur « Veut former » ressort à 30 000 pour la période analysée."
  },
  {
    "titre": "Enseignement 3",
    "chiffre": "25 000",
    "contexte": "Citoyens formés par an",
    "description": "L'indicateur « Apacité annuelle alger centre pilote » ressort à 1 000 pour la période analysée."
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
