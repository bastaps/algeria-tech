/**
 * Dataset — Algeria Tech · Observatoire de la Téléphonie Fixe
 * Source  : ARPCE — Algérie T3 2025
 * Généré le : 20/05/2026
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
    titre:    "OBSERVATOIRE DU MARCHÉ DE LA TÉLÉPHONIE FIXE EN ALGÉRIE",
    sousTitre:"Synthèse des indicateurs clés — T3 2025 · Source ARPCE",
    source:   "ARPCE — Autorité de Régulation de la Poste et des Communications Électroniques",
    periode:  "T3 2025",
    dateMaj:  "20/05/2026"
  },

  kpis: [
  {
    "label": "Total abonnés fixe",
    "valeur": 7501156,
    "unite": "abonnés",
    "icon": "☎️",
    "trend": null
  },
  {
    "label": "Abonnés résidentiels",
    "valeur": 6964516,
    "unite": "abonnés",
    "icon": "🏠",
    "trend": null
  },
  {
    "label": "Abonnés professionnels",
    "valeur": 536640,
    "unite": "abonnés",
    "icon": "🏢",
    "trend": null
  },
  {
    "label": "Part résidentielle",
    "valeur": 92.85,
    "unite": "%",
    "icon": "📊",
    "trend": "dominante"
  },
  {
    "label": "Part professionnelle",
    "valeur": 7.15,
    "unite": "%",
    "icon": "📊",
    "trend": null
  },
  {
    "label": "Taux de pénétration",
    "valeur": 66.12,
    "unite": "%",
    "icon": "📡",
    "trend": "résidentielle"
  }
],

  repartition: [
  {
    "label": "Résidentiels",
    "valeur": 92.85,
    "couleur": "#D4A437"
  },
  {
    "label": "Professionnels",
    "valeur": 7.15,
    "couleur": "#2D8A5F"
  }
],

  indicateurs: [
  {
    "label": "Total abonnés",
    "valeur": 7501156,
    "unite": "abonnés",
    "couleur": "#D4A437"
  },
  {
    "label": "Résidentiels",
    "valeur": 6964516,
    "unite": "abonnés",
    "couleur": "#2D8A5F"
  },
  {
    "label": "Professionnels",
    "valeur": 536640,
    "unite": "abonnés",
    "couleur": "#B85042"
  }
],

  evolution: [
  {
    "periode": "Parc total",
    "valeur": 7501156
  },
  {
    "periode": "Résidentiels",
    "valeur": 6964516
  },
  {
    "periode": "Professionnels",
    "valeur": 536640
  }
],

  keyPoints: [
  "Le marché algérien de la téléphonie fixe atteint 7 501 156 abonnés au T3 2025, confirmant la résilience du fixe face à la concurrence du mobile.",
  "La structure du parc est à très forte dominante résidentielle : 92,85 % des lignes appartiennent à des particuliers (6 964 516 abonnés).",
  "Le segment professionnel reste sous-représenté avec 7,15 % du parc (536 640 abonnés), inférieur aux standards régionaux pour un marché de cette taille.",
  "Le taux de pénétration résidentielle de 66,12 % positionne l'Algérie dans la moyenne des marchés en transition numérique, avec un potentiel de croissance résiduel.",
  "La migration progressive vers la fibre optique (FTTH/FTTB) constitue le principal vecteur de modernisation et de croissance du réseau fixe algérien."
],

  syntheseClé: [
  {
    "titre": "Marché en consolidation",
    "chiffre": "7,50 M abonnés",
    "contexte": "Parc total T3 2025",
    "description": "Le parc de la téléphonie fixe algérien atteint 7,5 millions d'abonnés au T3 2025. Cette base solide témoigne de la résilience du fixe dans un marché dominé par le mobile, soutenue par les déploiements FTTH et la politique de couverture universelle portée par l'ARPCE."
  },
  {
    "titre": "Dominance résidentielle",
    "chiffre": "92,85%",
    "contexte": "Part des abonnés particuliers",
    "description": "9 abonnés sur 10 sont des particuliers. Cette concentration structurelle sur le grand public illustre la priorité accordée à la connectivité des foyers dans le développement national. Les 6 964 516 abonnés résidentiels constituent le socle du marché fixe algérien."
  },
  {
    "titre": "Potentiel professionnel",
    "chiffre": "7,15%",
    "contexte": "Part des abonnés professionnels",
    "description": "Avec 536 640 abonnés professionnels, le segment entreprise représente un gisement de croissance. Ce ratio, inférieur aux standards régionaux, révèle un potentiel de développement dans les services dédiés aux entreprises : lignes PABX-IP, groupements téléphoniques et solutions de convergence fixe-mobile."
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
