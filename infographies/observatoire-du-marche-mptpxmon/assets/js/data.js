/**
 * Dataset généré automatiquement — Algeria Tech Generator v3
 * Source  : Observatoire du Marché
 * Période : 2025
 * Généré le : 31/05/2026
 */

export const DOC_TYPE = "finance";

export const PALETTE = [
  "#1d4ed8",
  "#7c3aed",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#94a3b8"
];

export const DATASET = {

  meta: {
    titre:    "Observatoire du Marché",
    sousTitre:"de l'Internet en Algérie",
    source:   "internetalgerie",
    periode:  "2025",
    dateMaj:  "2025"
  },

  kpis: [],

  repartition: [],

  indicateurs: [],

  evolution: [],

  keyPoints: [
  "12/05/2026 13:04Observatoire du Marché de l'Internet en Algérie",
  "L'indicateur « Ème trimestre » ressort à 2025 pour la période analysée."
],

  syntheseClé: [
  {
    "titre": "Enseignement 1",
    "chiffre": "—",
    "contexte": "Indicateur clé",
    "description": "12/05/2026 13:04Observatoire du Marché de l'Internet en Algérie"
  },
  {
    "titre": "Enseignement 2",
    "chiffre": "—",
    "contexte": "Indicateur clé",
    "description": "L'indicateur « Ème trimestre » ressort à 2025 pour la période analysée."
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
