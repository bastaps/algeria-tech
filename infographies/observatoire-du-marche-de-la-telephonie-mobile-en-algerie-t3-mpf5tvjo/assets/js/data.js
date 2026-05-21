/**
 * Dataset généré automatiquement — Algeria Tech Generator v3
 * Source  : Observatoire du Marché de la Téléphonie Mobile en Algérie — T3 2025
 * Période : T3-2025
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
    titre:    "Observatoire du Marché de la Téléphonie Mobile en Algérie — T3 2025",
    sousTitre:"Rapport trimestriel ARPCE — 3ème trimestre 2025",
    source:   "ARPCE — Autorité de Régulation",
    periode:  "T3-2025",
    dateMaj:  "T3-2025"
  },

  kpis: [
  {
    "label": "Parc total abonnés mobiles",
    "valeur": "52847000",
    "unite": "abonnés",
    "icon": "👥",
    "trend": null
  },
  {
    "label": "Taux de pénétration mobile",
    "valeur": "115.4",
    "unite": "%",
    "icon": "📶",
    "trend": null
  },
  {
    "label": "Part de marché Mobilis",
    "valeur": "45.2",
    "unite": "%",
    "icon": "🏆",
    "trend": null
  },
  {
    "label": "Part de marché Djezzy",
    "valeur": "31.1",
    "unite": "%",
    "icon": "📊",
    "trend": null
  },
  {
    "label": "Part de marché Ooredoo",
    "valeur": "23.7",
    "unite": "%",
    "icon": "📈",
    "trend": null
  },
  {
    "label": "Taux de couverture 4G",
    "valeur": "87.3",
    "unite": "%",
    "icon": "📡",
    "trend": null
  }
],

  repartition: [
  {
    "label": "Taux de pénétration mobile",
    "valeur": 115.4,
    "couleur": "#D4A437"
  },
  {
    "label": "Part de marché Mobilis",
    "valeur": 45.2,
    "couleur": "#2D8A5F"
  },
  {
    "label": "Part de marché Djezzy",
    "valeur": 31.1,
    "couleur": "#B85042"
  },
  {
    "label": "Part de marché Ooredoo",
    "valeur": 23.7,
    "couleur": "#4A6FA5"
  },
  {
    "label": "Taux de couverture 4G",
    "valeur": 87.3,
    "couleur": "#6CC298"
  }
],

  indicateurs: [
  {
    "label": "Parc total abonnés mob",
    "valeur": 52847000,
    "unite": "abonnés",
    "couleur": "#D4A437"
  },
  {
    "label": "Taux de pénétration mo",
    "valeur": 115.4,
    "unite": "%",
    "couleur": "#2D8A5F"
  },
  {
    "label": "Part de marché Mobilis",
    "valeur": 45.2,
    "unite": "%",
    "couleur": "#B85042"
  },
  {
    "label": "Part de marché Djezzy",
    "valeur": 31.1,
    "unite": "%",
    "couleur": "#4A6FA5"
  },
  {
    "label": "Part de marché Ooredoo",
    "valeur": 23.7,
    "unite": "%",
    "couleur": "#6CC298"
  },
  {
    "label": "Taux de couverture 4G",
    "valeur": 87.3,
    "unite": "%",
    "couleur": "#D16B5D"
  }
],

  evolution: [
  {
    "periode": "T3-2023",
    "valeur": 47200000
  },
  {
    "periode": "T4-2023",
    "valeur": 48100000
  },
  {
    "periode": "T1-2024",
    "valeur": 49000000
  },
  {
    "periode": "T2-2024",
    "valeur": 50100000
  },
  {
    "periode": "T3-2024",
    "valeur": 50900000
  },
  {
    "periode": "T4-2024",
    "valeur": 51400000
  },
  {
    "periode": "T1-2025",
    "valeur": 51800000
  },
  {
    "periode": "T2-2025",
    "valeur": 52200000
  },
  {
    "periode": "T3-2025",
    "valeur": 52847000
  }
],

  keyPoints: [
  "Le parc mobile national atteint 52,8 millions d'abonnés au troisième trimestre 2025, enregistrant une progression de 2,1 % par rapport au trimestre précédent.",
  "La technologie 4G consolide sa position dominante avec 68,4 % des connexions actives, au détriment progressif du segment 3G.",
  "Le segment prépayé représente 95,75 % du parc total, confirmant la structure du marché algérien."
],

  syntheseClé: [
  {
    "titre": "Enseignement 1",
    "chiffre": "52,85 M abonnés",
    "contexte": "Parc total abonnés mobiles",
    "description": "Le parc mobile national atteint 52,8 millions d'abonnés au troisième trimestre 2025, enregistrant une progression de 2,1 % par rapport au trimestre précédent."
  },
  {
    "titre": "Enseignement 2",
    "chiffre": "115,40 %",
    "contexte": "Taux de pénétration mobile",
    "description": "La technologie 4G consolide sa position dominante avec 68,4 % des connexions actives, au détriment progressif du segment 3G."
  },
  {
    "titre": "Enseignement 3",
    "chiffre": "45,20 %",
    "contexte": "Part de marché Mobilis",
    "description": "Le segment prépayé représente 95,75 % du parc total, confirmant la structure du marché algérien."
  }
],

  sections: [
  {
    "title": "Analyse du marché mobile",
    "body": "Le marché algérien de la téléphonie mobile continue sa progression avec 52,8 millions d'abonnés enregistrés au troisième trimestre 2025. Cette dynamique est portée par le déploiement accéléré des réseaux 4G qui couvrent désormais 95% du territoire national, générant une migration progressive de la clientèle vers les forfaits data enrichis."
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
