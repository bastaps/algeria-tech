/**
 * Dataset généré automatiquement — Algeria Tech Generator v3
 * Source  : L’ARPCE par les chiffres
 * Période : 2018
 * Généré le : 31/05/2026
 */

export const DOC_TYPE = "health";

export const PALETTE = [
  "#10b981",
  "#0ea5e9",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4"
];

export const DATASET = {

  meta: {
    titre:    "L’ARPCE par les chiffres",
    sousTitre:"L’ARPCE par les",
    source:   "arpcechiffresalgerie",
    periode:  "2018",
    dateMaj:  "2018"
  },

  kpis: [],

  repartition: [],

  indicateurs: [],

  evolution: [],

  keyPoints: [
  "au public mobile de cinquième génération (5G) et la fourniture de",
  "cadre des missions qui lui sont assignées par la loi n° 18-04 du 10 mai 2018, on",
  "des opérateurs de la téléphonie fixe et mobile (2025-2026) ;",
  "Mille trois cent trente-deux (1332) demandes d’information en matière",
  "d’interconnexion des opérateurs de la téléphonie fixe et mobile (2025-",
  "Sept mille cent vingt (7120) réclamations ont été introduites et traitées avec",
  "Le Sommet mondial sur la Société de l’Information (SMSI+20) 2025 ;",
  "électroniques dans la branche économique le 16.02.2025 ;"
],

  syntheseClé: [
  {
    "titre": "Enseignement 1",
    "chiffre": "—",
    "contexte": "Indicateur clé",
    "description": "au public mobile de cinquième génération (5G) et la fourniture de"
  },
  {
    "titre": "Enseignement 2",
    "chiffre": "—",
    "contexte": "Indicateur clé",
    "description": "cadre des missions qui lui sont assignées par la loi n° 18-04 du 10 mai 2018, on"
  },
  {
    "titre": "Enseignement 3",
    "chiffre": "—",
    "contexte": "Indicateur clé",
    "description": "des opérateurs de la téléphonie fixe et mobile (2025-2026) ;"
  }
],

  sections: [
  {
    "title": "L’ARPCE décide ",
    "body": "Cinquante-six (56) décisions ont été prises par l’Autorité de  régulation  dans  le cadre des missions qui lui sont assignées par la loi n° 18-04 du 10 mai 2018, on"
  },
  {
    "title": "cite notamment ",
    "body": "Une (1) décision portant approbation de la convention d’itinérance national pour l’acheminement des appels d’urgence ; Une   (1) décision   portant   procédure   de   contrôle   d'identification   des abonnés  des  opérateurs  de  communication  Electroniques  titulaires  de licences de téléphonie mobiles ; Trois  (3) décisions  portant  assignation  des  fréquences  dans  la  bande GSM 900 Mhz au"
  },
  {
    "title": "L’ARPCE contrôle ",
    "body": "Deux  (2) campagnes  de  contrôle  des  services  de  téléphonie  mobile, menées auprès des trois (3) opérateurs, couvrant l’autoroute Est–Ouest ainsi que six )6(routes nationales et six )6(autoroutes ; Cent  quarante-deux  (142) missions  de  contrôle  des opérateurs  de fourniture  de  services  de  communications  électroniques  relevant  du régime de l’autorisation générale ont été menées, aya"
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
