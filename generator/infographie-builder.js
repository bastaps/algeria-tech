'use strict';
/**
 * Algeria Tech — Moteur infographies premium v3
 *
 * Génère un dossier multi-fichiers dans infographies/ au niveau
 * de qualité du blueprint observatoire-telephonie-mobile-algerie :
 *   index.html · assets/css/styles.css · assets/js/{data,charts,scene3d,main,exports}.js
 *
 * v3 — Upgrade majeur :
 *   ✓ H1 massif clamp(2.6rem, 5vw, 4.2rem) via blueprint CSS
 *   ✓ Paragraphe d'analyse globale sous le titre hero
 *   ✓ Analyse textuelle automatique sous chaque graphique + chaque section
 *   ✓ Scène 3D constellation AVEC Raycaster + tooltip KPI (tous types)
 *   ✓ Scène "Champ de Signaux" antennes AVEC Raycaster + tooltip (telecom)
 *   ✓ Données précises : valeur/unite alignés partout
 */

const fs   = require('fs');
const path = require('path');

const ROOT         = path.join(__dirname, '..');
const INFOGRAPHIES = path.join(ROOT, 'infographies');
const BLUEPRINT    = path.join(INFOGRAPHIES, 'observatoire-telephonie-mobile-algerie');
const INTERACTIFS  = path.join(INFOGRAPHIES, 'interactifs-list.json');

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtN(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1e6) return (v / 1e6).toFixed(2).replace('.', ',') + ' M';
  if (v >= 1e3) return Math.round(v).toLocaleString('fr-FR');
  if (String(n).includes('.') || String(n).includes(',')) return parseFloat(n).toFixed(2).replace('.', ',');
  return String(Math.round(v));
}

// ─── Palette par type de document ─────────────────────────────────────────────

const PALETTES = {
  telecom:  ['#D4A437','#2D8A5F','#B85042','#4A6FA5','#6CC298','#D16B5D'],
  internet: ['#D4A437','#2D8A5F','#B85042','#06b6d4','#94a3b8','#c9994a'],
  startup:  ['#10b981','#D4A437','#7c3aed','#0ea5e9','#f59e0b','#ef4444'],
  rapport:  ['#D4A437','#2D8A5F','#B85042','#4A6FA5','#94a3b8','#354265'],
  presse:   ['#0ea5e9','#D4A437','#B85042','#2D8A5F','#7c3aed','#94a3b8'],
};
PALETTES.finance  = ['#1d4ed8','#7c3aed','#10b981','#f59e0b','#ef4444','#94a3b8'];
PALETTES.satellite= ['#7c3aed','#a78bfa','#c084fc','#38bdf8','#818cf8','#e879f9'];
PALETTES.health   = ['#10b981','#0ea5e9','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
PALETTES.energy   = ['#f59e0b','#22c55e','#3b82f6','#ef4444','#8b5cf6','#14b8a6'];
PALETTES.industry = ['#64748b','#0ea5e9','#f59e0b','#10b981','#ef4444','#a855f7'];
PALETTES.product  = ['#ec4899','#8b5cf6','#06b6d4','#10b981','#f97316','#3b82f6'];

// ─── Moteur d'Intelligence Éditoriale — Algeria Tech Generator v4 ─────────────
/**
 * Couche analytique experte : synthèse au niveau cabinet de conseil (Gartner / Deloitte).
 * Vocabulaire TIC précis, interprétation contextuelle, ton journaliste spécialisé.
 * Zéro copier-coller du texte source.
 */

// ── Profil analytique enrichi ────────────────────────────────────────────────
function buildAnalyticsProfile(data) {
  const { stats = [], chartData = {}, docType, date, title, source } = data;
  const numStats  = stats.filter(s => parseFloat(s.numericValue) > 0);
  const pctStats  = stats.filter(s => s.unit === '%' && parseFloat(s.numericValue) > 0 && parseFloat(s.numericValue) <= 100);

  // Indicateurs télécom spécifiques
  const subscriberStat = numStats.find(s => /abonn|souscript|parc|client|utilisat|mobile/i.test(s.label));
  const penetrationStat = pctStats.find(s => /pénétr|couvert|taux/i.test(s.label));
  const bandwidthStat  = numStats.find(s => /bande|mbps|gbps|débit|capacit/i.test(s.label));
  const revenueStat    = numStats.find(s => /revenu|chiffre|arpu|da\b|dinar/i.test(s.label));

  // Structure concurrentielle
  const marketShares = pctStats.slice(0, 6);
  const leader = marketShares.length
    ? marketShares.reduce((a, b) => parseFloat(a.numericValue) > parseFloat(b.numericValue) ? a : b)
    : null;
  const leaderPct     = leader ? parseFloat(leader.numericValue) : 0;
  const isConcentrated = leaderPct > 45;
  const isBipolar      = marketShares.length >= 2 &&
    marketShares.slice(0, 2).reduce((a, b) => a + parseFloat(b.numericValue), 0) > 75;
  const hhi = marketShares.reduce((s, x) => s + Math.pow(parseFloat(x.numericValue) / 100, 2), 0);

  // Analyse de tendance
  const hasTime = !!(chartData && chartData.labels && chartData.labels.length >= 3);
  let trend = null, trendPct = 0, cagr = null;
  if (hasTime && chartData.values && chartData.values.length >= 2) {
    const vv = chartData.values;
    const fv = vv[0], lv = vv[vv.length - 1];
    trendPct = fv > 0 ? (lv - fv) / fv * 100 : 0;
    trend    = trendPct > 3 ? 'haussière' : trendPct < -3 ? 'baissière' : 'stable';
    const n  = vv.length - 1;
    if (n >= 2 && fv > 0) cagr = ((Math.pow(lv / fv, 1 / n) - 1) * 100).toFixed(1);
  }

  // Contexte temporel
  const quarter = (date || '').match(/T[1-4]/i)?.[0];
  const year    = (date || '').match(/20\d{2}/)?.[0];

  return {
    docType, date, title, source,
    numStats, pctStats, marketShares,
    subscriberStat, penetrationStat, bandwidthStat, revenueStat,
    leader, leaderPct, isConcentrated, isBipolar, hhi,
    trend, trendPct, cagr, hasTime,
    quarter, year,
    topStat: numStats[0],
    totalKPIs: numStats.length,
  };
}

// ── Helper : formater une valeur avec son unité de manière naturelle ─────────
function fmtValNat(numericValue, unit) {
  const v = parseFloat(numericValue);
  if (unit === '%') return `${v.toFixed(v % 1 === 0 ? 0 : 2).replace('.', ',')} %`;
  if (v >= 1e9)  return `${(v / 1e9).toFixed(2).replace('.', ',')} milliard${v >= 2e9 ? 's' : ''}`;
  if (v >= 1e6)  return `${(v / 1e6).toFixed(2).replace('.', ',')} million${v >= 2e6 ? 's' : ''}`;
  if (v >= 1e3)  return `${Math.round(v).toLocaleString('fr-FR')}${unit ? ' ' + unit : ''}`;
  return `${v.toFixed(v % 1 === 0 ? 0 : 2).replace('.', ',')}${unit ? ' ' + unit : ''}`;
}

// ── 1. Analyse globale — résumé exécutif hero ────────────────────────────────
function genAnalyseGlobale(data) {
  const p   = buildAnalyticsProfile(data);
  const { title, subtitle, keyPoints = [] } = data;
  const { docType, date, topStat, pctStats, leader, leaderPct, isConcentrated } = p;

  const domainCtx = {
    telecom:  'secteur des télécommunications et du numérique',
    internet: 'secteur de l\'internet et des infrastructures réseau',
    startup:  'écosystème des startups et de l\'innovation technologique',
    rapport:  'périmètre institutionnel et réglementaire',
    presse:   'veille informationnelle et analyse de presse',
  };

  let para = '';

  // S1 — Framing documentaire
  const shortTitle = title.length > 72 ? title.substring(0, 72) + '…' : title;
  para += `L'étude du document « ${shortTitle} » fournit un éclairage stratégique sur le ${domainCtx[docType] || 'domaine analysé'} pour la période ${date}. `;

  // S2 — Indicateur structurant avec interprétation
  if (topStat) {
    const valStr = fmtValNat(topStat.numericValue, topStat.unit);
    const v = parseFloat(topStat.numericValue);
    para += `L'indicateur structurant de cette période, « ${topStat.label} », s'établit à ${valStr} — `;
    if (docType === 'telecom' && v >= 1e6) {
      const pen = pctStats.find(s => /pénétr|couvert/i.test(s.label));
      para += pen
        ? `chiffre qui, rapporté à la population nationale, traduit un taux de pénétration de ${parseFloat(pen.numericValue).toFixed(1).replace('.', ',')} % et témoigne d'une maturité accélérée du marché mobile. `
        : `chiffre qui positionne le marché national des télécommunications dans une trajectoire de maturité affirmée. `;
    } else if (docType === 'startup') {
      para += `résultat qui reflète le niveau de dynamisme de l'écosystème entrepreneurial et la profondeur de ses fondamentaux. `;
    } else {
      para += `résultat qui positionne ce secteur dans une dynamique dont les implications stratégiques méritent une attention particulière. `;
    }
  }

  // S3 — Structure concurrentielle si données disponibles
  if (leader && p.marketShares.length >= 2) {
    if (isConcentrated) {
      para += `Sur le plan concurrentiel, la structure du marché révèle une concentration notable autour de « ${leader.label} » `;
      para += `(${leaderPct.toFixed(1).replace('.', ',')} %), caractéristique d'un marché en phase de consolidation où les barrières à l'entrée demeurent élevées. `;
    } else {
      para += `La dynamique concurrentielle est caractérisée par un leadership certes affirmé de « ${leader.label} » à ${leaderPct.toFixed(1).replace('.', ',')} %, `;
      para += `mais une compétition soutenue entre acteurs qui maintient la pression sur les prix et l'innovation. `;
    }
  }

  // S4 — Ouverture analytique
  const qualPts = keyPoints.filter(pt => pt.trim().length > 40);
  if (qualPts.length >= 2) {
    para += `L'analyse transversale des données, articulée autour de ${qualPts.length} points clés identifiés, offre une grille de lecture multidimensionnelle pour comprendre les enjeux structurels de ce marché.`;
  } else if (docType === 'telecom') {
    para += `Les données consolidées permettent de dégager des tendances structurelles déterminantes pour la compréhension de l'évolution du marché national des TIC.`;
  } else {
    para += `La lecture croisée de ces indicateurs constitue une base analytique solide pour la prise de décision stratégique et la planification sectorielle.`;
  }

  return para || subtitle || 'Analyse générée automatiquement par Algeria Tech Generator v4 — Intelligence éditoriale TIC.';
}

// ── 2. Analyse indicateurs — sous graphiques barres ─────────────────────────
function genAnalyseChartIndicateurs(data) {
  const p = buildAnalyticsProfile(data);
  const { numStats, docType } = p;
  if (!numStats.length) return 'Visualisation des indicateurs numériques extraits du document source.';

  const top  = numStats.slice(0, 4);
  const max  = top.reduce((a, s) => parseFloat(s.numericValue) > parseFloat(a.numericValue) ? s : a);
  const min  = top.reduce((a, s) => parseFloat(s.numericValue) < parseFloat(a.numericValue) ? s : a);
  const sum  = top.reduce((a, s) => a + parseFloat(s.numericValue), 0);
  const dominance = sum > 0 ? (parseFloat(max.numericValue) / sum * 100).toFixed(1) : '0';
  const spread    = parseFloat(min.numericValue) > 0
    ? (parseFloat(max.numericValue) / parseFloat(min.numericValue)).toFixed(1)
    : null;

  let para = '';

  // Observation principale
  para += `L'analyse comparative des ${top.length} indicateurs extraits met en exergue « ${max.label} » `;
  para += `comme variable dominante du corpus, avec ${fmtValNat(max.numericValue, max.unit)}, `;
  para += `soit ${dominance} % de la valeur agrégée. `;

  // Interprétation de la dispersion
  if (spread && parseFloat(spread) > 10) {
    para += `L'amplitude considérable entre les valeurs extrêmes — facteur ${Math.round(parseFloat(spread))} entre « ${max.label} » et « ${min.label} » — `;
    para += `souligne l'hétérogénéité structurelle des indicateurs et la coexistence de segments à niveaux de maturité très distincts. `;
  } else if (spread && parseFloat(spread) > 3) {
    para += `La dispersion observée entre les indicateurs révèle une asymétrie dans la distribution des ressources, `;
    para += `typique d'un marché où les effets d'échelle jouent un rôle différenciateur majeur. `;
  } else {
    para += `La relative homogénéité des valeurs indique un équilibre intrinsèque entre les composantes analysées, `;
    para += `signal d'un marché dont les différents segments évoluent à des rythmes convergents. `;
  }

  // Contextualisation sectorielle
  if (docType === 'telecom') {
    para += `Dans le contexte des marchés émergents des TIC, ces métriques constituent des signaux avancés de la trajectoire sectorielle et guident l'allocation des investissements infrastructurels.`;
  } else if (docType === 'startup') {
    para += `Ces KPIs forment un tableau de bord synthétique de la maturité de l'écosystème, permettant un benchmarking rigoureux avec les standards régionaux et internationaux.`;
  } else {
    para += `La lecture combinée de ces indicateurs offre une grille d'analyse robuste pour l'évaluation de la performance globale et l'identification des leviers d'amélioration prioritaires.`;
  }

  return para;
}

// ── 3. Analyse répartition — sous graphiques donut/barh ──────────────────────
function genAnalyseChartRepartition(data) {
  const p = buildAnalyticsProfile(data);
  const { pctStats, numStats, leader, leaderPct, isConcentrated, isBipolar, hhi, docType } = p;

  // Construire la série selon les données disponibles
  const series = pctStats.length >= 2 ? pctStats
    : (() => {
        const top = numStats.slice(0, 4);
        const sum = top.reduce((a, s) => a + parseFloat(s.numericValue), 0) || 1;
        return top.map(s => ({ ...s, numericValue: String((parseFloat(s.numericValue) / sum * 100).toFixed(1)) }));
      })();

  if (!series.length) return 'Analyse de la structure de marché et de la répartition des indicateurs clés.';

  const dom    = series.reduce((a, b) => parseFloat(a.numericValue) > parseFloat(b.numericValue) ? a : b);
  const domPct = parseFloat(dom.numericValue);
  const hhiStr = (hhi * 10000).toFixed(0);

  let para = '';

  // Structure de marché
  if (domPct > 60) {
    para += `La structure du marché révèle une concentration forte, voire oligopolistique sur certains segments, `;
    para += `avec « ${dom.label} » accaparant ${domPct.toFixed(1).replace('.', ',')} % de l'ensemble. `;
    para += `Avec un indice de Herfindahl-Hirschman (HHI) estimé à ${hhiStr}, ce marché présente des caractéristiques de concentration `;
    para += parseFloat(hhiStr) > 2500
      ? `élevée qui interroge sur l'intensité de la pression concurrentielle et les marges de manœuvre des acteurs secondaires. `
      : `modérée, avec un leadership dominant mais des challengers en mesure de peser sur la dynamique sectorielle. `;
  } else if (domPct > 40) {
    para += `La structure oligopolistique du marché se confirme avec « ${dom.label} » en position dominante à ${domPct.toFixed(1).replace('.', ',')} %. `;
    para += `Ce leadership, bien qu'établi, reste contestable : l'écart avec les challengers — `;
    if (series.length >= 2) {
      const second = series.sort((a, b) => parseFloat(b.numericValue) - parseFloat(a.numericValue))[1];
      para += `notamment « ${second.label} » à ${parseFloat(second.numericValue).toFixed(1).replace('.', ',')} % — `;
    }
    para += `demeure susceptible d'évoluer sous l'impulsion des investissements réseau et de la dynamique tarifaire. `;
  } else {
    para += `La répartition équilibrée entre les acteurs — le premier n'atteignant que ${domPct.toFixed(1).replace('.', ',')} % — `;
    para += `traduit un marché atomisé où aucun opérateur ne détient de position hégémonique. `;
    para += `Cette pluralité, indicateur positif de la vitalité concurrentielle, profite in fine aux utilisateurs finaux. `;
  }

  // Analyse de bipolarisation
  if (isBipolar && series.length >= 2) {
    const cumTop2 = series.slice(0, 2).reduce((a, b) => a + parseFloat(b.numericValue), 0).toFixed(1);
    para += `La bipolarisation du marché est notable : les deux premiers acteurs cumulent ${cumTop2} % des parts, `;
    para += `laissant un espace résiduel limité aux opérateurs de niche et aux entrants potentiels.`;
  } else if (series.length >= 3) {
    const cumTop2 = series.slice(0, 2).reduce((a, b) => a + parseFloat(b.numericValue), 0).toFixed(1);
    para += `Les deux premiers acteurs cumulent ${cumTop2} % des parts, `;
    para += parseFloat(cumTop2) > 70
      ? `ce qui caractérise une structure de marché à dominante duale, avec des barrières à l'entrée significatives pour les challengers.`
      : `laissant un espace concurrentiel significatif aux acteurs du second rang et favorisant l'émergence de nouveaux modèles de service.`;
  }

  return para;
}

// ── 4. Analyse évolution — sous graphique area/line ──────────────────────────
function genAnalyseChartEvolution(data) {
  const p = buildAnalyticsProfile(data);
  const { trend, trendPct, cagr } = p;
  const { chartData } = data;

  if (!chartData || !chartData.labels || chartData.labels.length < 2) {
    return 'Évolution temporelle des indicateurs clés sur la période couverte par le document source.';
  }

  const vals   = chartData.values || [];
  const labels = chartData.labels;
  const pctStr = `${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1).replace('.', ',')} %`;

  // Peak analysis
  const maxVal = Math.max(...vals);
  const maxIdx = vals.indexOf(maxVal);
  const hasPeak = maxIdx !== 0 && maxIdx !== vals.length - 1;

  let para = '';

  // S1 — Tendance principale
  para += `Sur la séquence ${labels[0]}–${labels[labels.length - 1]}, la courbe d'évolution adopte une trajectoire ${trend || 'stable'} `;
  if (Math.abs(trendPct) > 0.5) {
    para += `avec une variation globale de ${pctStr} entre le point d'observation initial et le dernier relevé. `;
  } else {
    para += `témoignant d'une inertie des volumes et d'un marché qui cherche ses nouveaux catalyseurs de croissance. `;
  }

  // S2 — TCAC
  if (cagr && parseFloat(cagr) !== 0) {
    para += `Le taux de croissance annuel composé (TCAC) s'établit à ${cagr.replace('.', ',')} %, `;
    const cagrV = parseFloat(cagr);
    if (cagrV > 10) {
      para += `niveau exceptionnel qui positionne ce segment dans la catégorie des marchés à forte expansion, comparable aux meilleures performances régionales. `;
    } else if (cagrV > 4) {
      para += `indice d'une dynamique d'expansion structurelle soutenue, au-dessus de la moyenne des marchés émergents comparables. `;
    } else if (cagrV > 0) {
      para += `reflétant une progression organique régulière, cohérente avec la phase de maturité du marché. `;
    } else {
      para += `signalant une compression progressive des volumes qui appelle une analyse approfondie des facteurs structurels sous-jacents. `;
    }
  }

  // S3 — Point de pic / anomalie
  if (hasPeak) {
    para += `Le sommet de la série, observé en ${labels[maxIdx]}, souligne une phase d'accélération conjoncturelle, `;
    para += `potentiellement liée à des effets de saisonnalité ou à l'impact d'événements réglementaires ou promotionnels. `;
  }

  // S4 — Moyenne mobile
  para += `La moyenne mobile superposée filtre les oscillations de court terme pour faire ressortir la direction structurelle : `;
  para += trend === 'haussière'
    ? `les fondamentaux demeurent solides et présagent d'une continuation de la dynamique positive, sous réserve de la stabilité de l'environnement macro-économique.`
    : trend === 'baissière'
    ? `la pression structurelle sur les volumes est confirmée et appelle des mesures correctives proactives de la part des acteurs du marché.`
    : `le marché se consolide autour d'un palier d'équilibre, en attente de nouveaux stimuli pour enclencher la prochaine phase de croissance.`;

  return para;
}

// ── 5. Synthèse finale — résumé exécutif de clôture ──────────────────────────
function genAnalyseSynthese(data) {
  const p = buildAnalyticsProfile(data);
  const { title, keyPoints = [] } = data;
  const { docType, date, topStat, pctStats, leader, leaderPct, trend, cagr, numStats } = p;

  const shortTitle = title.length > 65 ? title.substring(0, 65) + '…' : title;
  const qualPts    = keyPoints.filter(pt => pt.trim().length > 40).slice(0, 3);

  let para = '';

  // S1 — Introduction exécutive
  para += `En synthèse, l'examen croisé des indicateurs issus de « ${shortTitle} » `;
  para += `pour la période ${date} dégage un ensemble de conclusions structurantes pour la compréhension du ${
    { telecom:'marché des TIC', internet:'secteur de l\'internet', startup:'paysage entrepreneurial', rapport:'périmètre institutionnel', presse:'contexte sectoriel' }[docType] || 'secteur analysé'
  }. `;

  // S2 — Points clés synthétisés
  if (qualPts.length >= 2) {
    para += `Parmi les enseignements majeurs, on retiendra en premier lieu que ${qualPts[0].substring(0, 130).replace(/^[A-Z]/, c => c.toLowerCase())}${qualPts[0].length > 130 ? '…' : ''}. `;
    if (qualPts[1]) {
      para += `Par ailleurs, ${qualPts[1].substring(0, 100).replace(/^[A-Z]/, c => c.toLowerCase())}${qualPts[1].length > 100 ? '…' : ''}. `;
    }
  } else if (topStat) {
    para += `L'indicateur phare, « ${topStat.label} » à ${fmtValNat(topStat.numericValue, topStat.unit)}, `;
    para += `illustre la profondeur des enjeux quantitatifs et fournit un référentiel solide pour les analyses comparatives futures. `;
  }

  // S3 — Lecture concurrentielle
  if (leader && pctStats.length >= 2) {
    para += `La dynamique concurrentielle, caractérisée par le positionnement de « ${leader.label} » à ${leaderPct.toFixed(1).replace('.', ',')} %, `;
    para += leaderPct > 50
      ? `dessine les contours d'un marché en cours de consolidation, dont les équilibres seront déterminés par les prochaines décisions d'investissement et les orientations réglementaires. `
      : `témoigne d'une saine émulation entre acteurs, facteur de compétitivité et d'amélioration continue des services offerts aux utilisateurs. `;
  }

  // S4 — Tendance et perspectives
  if (trend) {
    para += `La tendance ${trend} confirmée sur la période, `;
    if (cagr) para += `avec un TCAC de ${cagr.replace('.', ',')} %, `;
    para += trend === 'haussière'
      ? `ouvre des perspectives prometteuses et légitime les stratégies d'expansion engagées par les opérateurs du secteur.`
      : trend === 'baissière'
      ? `constitue un signal d'alerte qui nécessite une révision des stratégies de croissance et un renforcement des dispositifs d'innovation.`
      : `consolide un palier d'équilibre dont la durabilité dépendra des catalyseurs exogènes à venir — évolutions réglementaires, investissements étrangers, adoption technologique.`;
  } else {
    para += `La robustesse analytique de ce document repose sur ${numStats.length} indicateur${numStats.length > 1 ? 's' : ''} quantifié${numStats.length > 1 ? 's' : ''}, traités et synthétisés automatiquement par Algeria Tech Generator v4 selon les standards éditoriaux du secteur TIC.`;
  }

  return para;
}

// ─── Stratégie Data-to-Visual ─────────────────────────────────────────────────
/**
 * Analyse les données disponibles et détermine quelles sections/graphiques
 * doivent être rendus. Évite les sections vides ou non pertinentes.
 */
function detectVisualStrategy(data) {
  const { stats = [], chartData = {}, sections = [], keyPoints = [] } = data;
  const numStats  = stats.filter(s => parseFloat(s.numericValue) > 0);
  const pctStats  = stats.filter(s => s.unit === '%' && parseFloat(s.numericValue) > 0);
  const hasTime   = !!(chartData && chartData.labels && chartData.labels.length >= 3);
  const goodSects = sections.filter(s =>
    s.body && s.body.trim().length > 80 &&
    !/^(republique|autorite|ministere|chapitre|sommaire|table des|liste|postpaid|prepaid|\\d+\\.)/i.test(s.title?.trim() || '')
  );

  return {
    hasKPIs:         numStats.length >= 1,
    hasIndicateurs:  numStats.length >= 2,
    hasRepartition:  pctStats.length >= 2 || numStats.length >= 3,
    hasEvolution:    hasTime,
    hasSections:     goodSects.length > 0,
    hasFindings:     keyPoints.filter(p => p.trim().length > 30).length > 0,
    hasSynthese:     numStats.length >= 1 && keyPoints.length >= 1,
    preferDonut:     pctStats.length >= 2,
    preferArea:      hasTime && (chartData.values || []).length >= 4,
    goodSects,
  };
}

// ─── Mettre à jour interactifs-list.json ───────────────────────────────────────

function updateList(slug, title) {
  let list = [];
  if (fs.existsSync(INTERACTIFS)) {
    try { list = JSON.parse(fs.readFileSync(INTERACTIFS, 'utf8')); } catch (e) {}
  }
  list = list.filter(e => e.name !== slug);
  list.unshift({
    name:      slug,
    title:     title,
    url:       `/infographies/${slug}/`,
    type:      'interactive-folder',
    modified:  new Date().toISOString(),
    thumbnail: `/infographies/${slug}/thumbnail.svg`
  });
  fs.writeFileSync(INTERACTIFS, JSON.stringify(list, null, 2), 'utf8');
}

// ─── Génération data.js ────────────────────────────────────────────────────────

function genDataJS(data, pal) {
  const { title, subtitle, date, source, docType, stats = [], keyPoints = [], sections = [], chartData = {} } = data;
  const hasTime = chartData.labels && chartData.labels.length >= 3;

  const kpis = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 6).map(s => ({
    label:  s.label,
    valeur: s.numericValue,
    unite:  s.unit,
    icon:   s.icon || '📊',
    trend:  s.trend || null
  }));

  const pctStats = stats.filter(s => s.unit === '%' && parseFloat(s.numericValue) > 0).slice(0, 6);
  const repartition = pctStats.length >= 2
    ? pctStats.map((s, i) => ({ label: s.label, valeur: parseFloat(s.numericValue), couleur: pal[i % pal.length] }))
    : (() => {
        const top = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 4);
        const sum = top.reduce((a, s) => a + parseFloat(s.numericValue), 0) || 1;
        return top.map((s, i) => ({
          label:   s.label,
          valeur:  +(parseFloat(s.numericValue) / sum * 100).toFixed(1),
          couleur: pal[i % pal.length]
        }));
      })();

  const indicateurs = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 6).map((s, i) => ({
    label:   s.label.substring(0, 22),
    valeur:  parseFloat(s.numericValue),
    unite:   s.unit,
    couleur: pal[i % pal.length]
  }));

  const evolution = hasTime
    ? chartData.labels.map((l, i) => ({ periode: l, valeur: chartData.values[i] || 0 }))
    : [];

  const syntheseClé = keyPoints.slice(0, 3).map((pt, i) => ({
    titre:       `Enseignement ${i + 1}`,
    chiffre:     kpis[i] ? fmtN(kpis[i].valeur) + (kpis[i].unite ? ' ' + kpis[i].unite.substring(0, 8) : '') : '—',
    contexte:    kpis[i] ? kpis[i].label : 'Indicateur clé',
    description: pt.substring(0, 200)
  }));

  return `/**
 * Dataset généré automatiquement — Algeria Tech Generator v3
 * Source  : ${title.replace(/\*\//g, '')}
 * Période : ${date}
 * Généré le : ${new Date().toLocaleDateString('fr-FR')}
 */

export const DOC_TYPE = ${JSON.stringify(docType)};

export const PALETTE = ${JSON.stringify(pal, null, 2)};

export const DATASET = {

  meta: {
    titre:    ${JSON.stringify(title)},
    sousTitre:${JSON.stringify(subtitle || '')},
    source:   ${JSON.stringify(source || '')},
    periode:  ${JSON.stringify(date || '')},
    dateMaj:  ${JSON.stringify(date || '')}
  },

  kpis: ${JSON.stringify(kpis, null, 2)},

  repartition: ${JSON.stringify(repartition, null, 2)},

  indicateurs: ${JSON.stringify(indicateurs, null, 2)},

  evolution: ${JSON.stringify(evolution, null, 2)},

  keyPoints: ${JSON.stringify(keyPoints.slice(0, 8), null, 2)},

  syntheseClé: ${JSON.stringify(syntheseClé, null, 2)},

  sections: ${JSON.stringify(sections.slice(0, 3), null, 2)}
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
`;
}

// ─── Génération charts.js ──────────────────────────────────────────────────────

function genChartsJS(data, pal) {
  const hasTime = data.chartData && data.chartData.labels && data.chartData.labels.length >= 3;
  const chartLabel = data.chartData ? (data.chartData.label || 'Évolution') : 'Indicateurs';

  return `/**
 * Graphiques Chart.js — générés par Algeria Tech Generator v3
 */

import { DATASET, fmt, PALETTE } from './data.js';

function applyTheme() {
  const C = window.Chart;
  if (!C) return;
  C.defaults.font.family       = "'Manrope', sans-serif";
  C.defaults.font.size         = 12;
  C.defaults.color             = '#94a3b8';
  C.defaults.borderColor       = 'rgba(255,255,255,0.06)';
  C.defaults.plugins.legend.labels.color = '#f4ede0';
  C.defaults.plugins.legend.labels.font  = { family:"'JetBrains Mono',monospace", size:11 };
  C.defaults.plugins.tooltip.backgroundColor = 'rgba(17,23,41,.95)';
  C.defaults.plugins.tooltip.titleColor  = '#d4a437';
  C.defaults.plugins.tooltip.bodyColor   = '#f4ede0';
  C.defaults.plugins.tooltip.borderColor = 'rgba(212,164,55,.4)';
  C.defaults.plugins.tooltip.borderWidth = 1;
  C.defaults.plugins.tooltip.padding     = 12;
  C.defaults.plugins.tooltip.cornerRadius= 8;
}

const CHARTS = {};

function chartIndicateurs(ctx) {
  const ind = DATASET.indicateurs;
  if (!ind.length) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ind.map(d => d.label),
      datasets: [{
        label: 'Valeur',
        data: ind.map(d => d.valeur),
        backgroundColor: ind.map(d => d.couleur + 'bb'),
        borderColor:     ind.map(d => d.couleur),
        borderWidth: 1,
        borderRadius: 7
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: c => fmt.kpi(c.parsed.y, ind[c.dataIndex]?.unite) + (ind[c.dataIndex]?.unite ? ' ' + ind[c.dataIndex].unite : '') } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8', maxRotation: 35 } },
        y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8' } }
      },
      animation: { duration: 1400, easing: 'easeOutQuart' }
    }
  });
}

function chartRepartition(ctx) {
  const rep = DATASET.repartition;
  if (!rep.length) return null;
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: rep.map(d => d.label),
      datasets: [{
        data: rep.map(d => d.valeur),
        backgroundColor: rep.map(d => d.couleur),
        borderColor: '#111729',
        borderWidth: 3,
        hoverOffset: 14
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: c => fmt.pourcentSimple(c.parsed) + '%' } }
      },
      animation: { animateRotate: true, animateScale: true, duration: 1400 }
    }
  });
}

function chartDistribution(ctx) {
  const rep = DATASET.repartition.slice(0, 2);
  if (rep.length < 2) return null;
  const top = rep[0];
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [top.label, 'Reste'],
      datasets: [{
        data: [top.valeur, Math.max(0, 100 - top.valeur)],
        backgroundColor: [top.couleur, '#1a2238'],
        borderColor: '#111729',
        borderWidth: 3,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 10, usePointStyle: true } },
        tooltip: { callbacks: { label: c => fmt.pourcentSimple(c.parsed) + '%' } }
      },
      animation: { animateRotate: true, animateScale: true, duration: 1200 }
    }
  });
}

${hasTime ? `
function chartEvolution(ctx) {
  const ev = DATASET.evolution;
  if (!ev.length) return null;
  const vals = ev.map(d => d.valeur);
  const avg  = vals.reduce((a, b) => a + b, 0) / vals.length;
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: ev.map(d => d.periode),
      datasets: [
        {
          label: ${JSON.stringify(chartLabel)},
          data: vals,
          borderColor: PALETTE[0],
          backgroundColor: PALETTE[0] + '18',
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: PALETTE[0],
          pointBorderColor: '#111729',
          pointBorderWidth: 2,
          fill: true
        },
        {
          label: 'Moyenne',
          data: vals.map(() => avg),
          borderColor: 'rgba(148,163,184,.5)',
          borderDash: [5, 3],
          tension: 0,
          pointRadius: 0,
          fill: false,
          borderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8' } }
      },
      animation: { duration: 1500, easing: 'easeOutQuart' }
    }
  });
}
` : ''}

function chartBarH(ctx) {
  const rep = DATASET.repartition;
  if (!rep.length) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rep.map(d => d.label),
      datasets: [{
        label: 'Part (%)',
        data: rep.map(d => d.valeur),
        backgroundColor: rep.map(d => d.couleur + 'bb'),
        borderColor:     rep.map(d => d.couleur),
        borderWidth: 1,
        borderRadius: 5
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { max: 100, grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8', callback: v => v + '%' } },
        y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#f4ede0' } }
      },
      animation: { duration: 1300, easing: 'easeOutQuart' }
    }
  });
}

function chartComparatif(ctx) {
  const ind = DATASET.indicateurs.slice(0, 4);
  if (ind.length < 2) return null;
  const max = Math.max(...ind.map(d => d.valeur));
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ind.map(d => d.label),
      datasets: [
        {
          label: 'Valeur absolue',
          data: ind.map(d => d.valeur),
          backgroundColor: ind.map(d => d.couleur + 'bb'),
          borderColor:     ind.map(d => d.couleur),
          borderWidth: 1, borderRadius: 6, yAxisID: 'y'
        },
        {
          label: 'Part relative (%)',
          data: ind.map(d => +(d.valeur / max * 100).toFixed(1)),
          type: 'line',
          borderColor: '#d4a437',
          backgroundColor: 'transparent',
          pointRadius: 5,
          pointBackgroundColor: '#d4a437',
          tension: 0.3,
          yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true } },
      scales: {
        y:  { position: 'left',  grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#94a3b8' } },
        y2: { position: 'right', grid: { display: false }, ticks: { color: '#d4a437', callback: v => v + '%' } },
        x:  { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#f4ede0' } }
      },
      animation: { duration: 1400, easing: 'easeOutQuart' }
    }
  });
}

export function initCharts() {
  applyTheme();
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      if (CHARTS[id]) return;
      const ctx = entry.target.getContext('2d');
      switch (id) {
        case 'chart-indicateurs': CHARTS[id] = chartIndicateurs(ctx); break;
        case 'chart-repartition': CHARTS[id] = chartRepartition(ctx); break;
        case 'chart-distribution':CHARTS[id] = chartDistribution(ctx); break;
        ${hasTime ? "case 'chart-evolution':  CHARTS[id] = chartEvolution(ctx); break;" : ''}
        case 'chart-barh':        CHARTS[id] = chartBarH(ctx); break;
        case 'chart-comparatif':  CHARTS[id] = chartComparatif(ctx); break;
      }
      if (CHARTS[id]) obs.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('canvas[id^="chart-"]').forEach(c => obs.observe(c));
}
`;
}

// ─── Génération charts.js — Version adaptée au domaine ───────────────────────
function genChartsJSDomain(data, pal, domain) {
  const hasTime = data.chartData && data.chartData.labels && data.chartData.labels.length >= 3;
  const chartLabel = data.chartData ? (data.chartData.label || 'Évolution') : 'Indicateurs';

  // Chart configs by domain
  const domainCharts = {
    finance: ['barComparatif', 'lineArea', 'stackedBar', 'radarIndicateurs', 'indicateurs', 'distribution'],
    satellite: ['scatter', 'lineEvolution', 'radarIndicateurs', 'polarArea', 'indicateurs', 'repartition'],
    health: ['stackedBar', 'lineArea', 'repartition', 'radarIndicateurs', 'indicateurs', 'distribution'],
    energy: ['lineArea', 'stackedBar', 'repartition', 'indicateurs', 'barComparatif', 'radarIndicateurs'],
    industry: ['indicateurs', 'barComparatif', 'radarIndicateurs', 'repartition', 'lineEvolution', 'distribution'],
    product: ['repartition', 'radarIndicateurs', 'indicateurs', 'barH', 'distribution', 'barComparatif'],
    telecom: ['indicateurs', 'repartition', 'distribution', hasTime ? 'lineEvolution' : 'barH', 'barComparatif', 'radarIndicateurs'],
    startup: ['indicateurs', hasTime ? 'lineEvolution' : 'barComparatif', 'repartition', 'radarIndicateurs', 'distribution', 'barH'],
    rapport: ['indicateurs', 'repartition', 'distribution', 'barComparatif', hasTime ? 'lineEvolution' : 'barH', 'radarIndicateurs'],
    presse:  ['repartition', 'indicateurs', 'distribution', 'barH', 'barComparatif', 'lineEvolution'],
  };

  const order = domainCharts[domain] || domainCharts.rapport;

  const chartFunctions = {
    indicateurs: `
function chartIndicateurs(ctx) {
  const ind = DATASET.indicateurs;
  if (!ind.length) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ind.map(d => d.label),
      datasets: [{ label:'Valeur', data:ind.map(d=>d.valeur),
        backgroundColor:ind.map(d=>d.couleur+'bb'), borderColor:ind.map(d=>d.couleur),
        borderWidth:1, borderRadius:7 }]
    },
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>fmt.kpi(c.parsed.y,ind[c.dataIndex]?.unite)+(ind[c.dataIndex]?.unite?' '+ind[c.dataIndex].unite:'')}}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8',maxRotation:35}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}}},
      animation:{duration:1400,easing:'easeOutQuart'} }
  });
}`,
    repartition: `
function chartRepartition(ctx) {
  const rep = DATASET.repartition;
  if (!rep.length) return null;
  return new Chart(ctx, {
    type: 'doughnut',
    data: { labels:rep.map(d=>d.label), datasets:[{data:rep.map(d=>d.valeur),backgroundColor:rep.map(d=>d.couleur),borderColor:'#111729',borderWidth:3,hoverOffset:14}] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{legend:{position:'bottom',labels:{padding:12,usePointStyle:true}}, tooltip:{callbacks:{label:c=>fmt.pourcentSimple(c.parsed)+'%'}}},
      animation:{animateRotate:true,animateScale:true,duration:1400} }
  });
}`,
    distribution: `
function chartDistribution(ctx) {
  const rep = DATASET.repartition.slice(0,2);
  if (rep.length < 2) return null;
  const top = rep[0];
  return new Chart(ctx, {
    type:'doughnut',
    data:{labels:[top.label,'Reste'],datasets:[{data:[top.valeur,Math.max(0,100-top.valeur)],backgroundColor:[top.couleur,'#1a2238'],borderColor:'#111729',borderWidth:3,hoverOffset:10}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'68%',
      plugins:{legend:{position:'bottom',labels:{padding:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>fmt.pourcentSimple(c.parsed)+'%'}}},
      animation:{animateRotate:true,animateScale:true,duration:1200} }
  });
}`,
    lineEvolution: hasTime ? `
function chartEvolution(ctx) {
  const ev = DATASET.evolution;
  if (!ev.length) return null;
  const vals = ev.map(d=>d.valeur);
  const avg  = vals.reduce((a,b)=>a+b,0)/vals.length;
  return new Chart(ctx, {
    type:'line',
    data:{labels:ev.map(d=>d.periode),datasets:[
      {label:${JSON.stringify(chartLabel)},data:vals,borderColor:PALETTE[0],backgroundColor:PALETTE[0]+'18',tension:.35,pointRadius:5,pointBackgroundColor:PALETTE[0],pointBorderColor:'#111729',pointBorderWidth:2,fill:true},
      {label:'Moyenne',data:vals.map(()=>avg),borderColor:'rgba(148,163,184,.5)',borderDash:[5,3],tension:0,pointRadius:0,fill:false,borderWidth:1.5}
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:true}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}}},
      animation:{duration:1500,easing:'easeOutQuart'} }
  });
}` : '',
    lineArea: `
function chartLineArea(ctx) {
  const ind = DATASET.indicateurs;
  if (ind.length < 2) return null;
  return new Chart(ctx, {
    type:'line',
    data:{labels:ind.map(d=>d.label),datasets:[
      {label:'Tendance',data:ind.map(d=>d.valeur),borderColor:PALETTE[0],backgroundColor:PALETTE[0]+'22',tension:.45,pointRadius:6,pointBackgroundColor:PALETTE[0],fill:true},
      {label:'Référence',data:ind.map(d=>d.valeur*0.9),borderColor:PALETTE[1]+'88',borderDash:[4,3],tension:.3,pointRadius:3,fill:false,borderWidth:1.5}
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:true}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}}},
      animation:{duration:1400,easing:'easeOutQuart'} }
  });
}`,
    barH: `
function chartBarH(ctx) {
  const rep = DATASET.repartition;
  if (!rep.length) return null;
  return new Chart(ctx, {
    type:'bar',
    data:{labels:rep.map(d=>d.label),datasets:[{label:'Part (%)',data:rep.map(d=>d.valeur),backgroundColor:rep.map(d=>d.couleur+'bb'),borderColor:rep.map(d=>d.couleur),borderWidth:1,borderRadius:5}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{x:{max:100,grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8',callback:v=>v+'%'}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#f4ede0'}}},
      animation:{duration:1300,easing:'easeOutQuart'} }
  });
}`,
    barComparatif: `
function chartComparatif(ctx) {
  const ind = DATASET.indicateurs.slice(0,4);
  if (ind.length < 2) return null;
  const max = Math.max(...ind.map(d=>d.valeur));
  return new Chart(ctx, {
    type:'bar',
    data:{labels:ind.map(d=>d.label),datasets:[
      {label:'Valeur absolue',data:ind.map(d=>d.valeur),backgroundColor:ind.map(d=>d.couleur+'bb'),borderColor:ind.map(d=>d.couleur),borderWidth:1,borderRadius:6,yAxisID:'y'},
      {label:'Part relative (%)',data:ind.map(d=>+(d.valeur/max*100).toFixed(1)),type:'line',borderColor:PALETTE[0],backgroundColor:'transparent',pointRadius:5,pointBackgroundColor:PALETTE[0],tension:.3,yAxisID:'y2'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:true}},
      scales:{y:{position:'left',grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}},y2:{position:'right',grid:{display:false},ticks:{color:PALETTE[0],callback:v=>v+'%'}},x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#f4ede0'}}},
      animation:{duration:1400,easing:'easeOutQuart'} }
  });
}`,
    radarIndicateurs: `
function chartRadar(ctx) {
  const ind = DATASET.indicateurs.slice(0,6);
  if (ind.length < 3) return null;
  const max = Math.max(...ind.map(d=>d.valeur)) || 1;
  return new Chart(ctx, {
    type:'radar',
    data:{labels:ind.map(d=>d.label),datasets:[
      {label:'Indicateurs',data:ind.map(d=>+(d.valeur/max*100).toFixed(1)),borderColor:PALETTE[0],backgroundColor:PALETTE[0]+'33',pointBackgroundColor:PALETTE[0],pointBorderColor:'#fff',pointHoverBackgroundColor:'#fff',borderWidth:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{r:{angleLines:{color:'rgba(255,255,255,.1)'},grid:{color:'rgba(255,255,255,.08)'},pointLabels:{color:'#94a3b8',font:{size:10}},ticks:{backdropColor:'transparent',color:'#64748b',font:{size:9}}}},
      plugins:{legend:{display:false}},
      animation:{duration:1400,easing:'easeOutQuart'} }
  });
}`,
    stackedBar: `
function chartStackedBar(ctx) {
  const rep = DATASET.repartition.slice(0,4);
  const ind = DATASET.indicateurs.slice(0,4);
  if (!rep.length || !ind.length) return null;
  return new Chart(ctx, {
    type:'bar',
    data:{labels:ind.map(d=>d.label),datasets:rep.map((r,i)=>({
      label:r.label, data:ind.map(d=>+(d.valeur*r.valeur/100).toFixed(1)),
      backgroundColor:r.couleur+'cc', borderColor:r.couleur, borderWidth:1, borderRadius:i===rep.length-1?6:0, stack:'stack0'
    }))},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true}},
      scales:{x:{stacked:true,grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}},y:{stacked:true,grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}}},
      animation:{duration:1400,easing:'easeOutQuart'} }
  });
}`,
    polarArea: `
function chartPolar(ctx) {
  const ind = DATASET.indicateurs.slice(0,6);
  if (!ind.length) return null;
  const max = Math.max(...ind.map(d=>d.valeur)) || 1;
  return new Chart(ctx, {
    type:'polarArea',
    data:{labels:ind.map(d=>d.label),datasets:[{data:ind.map(d=>+(d.valeur/max*100).toFixed(1)),backgroundColor:ind.map(d=>d.couleur+'99'),borderColor:ind.map(d=>d.couleur),borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{r:{grid:{color:'rgba(255,255,255,.07)'},ticks:{backdropColor:'transparent',color:'#64748b',font:{size:9}}}},
      plugins:{legend:{position:'bottom',labels:{padding:10,font:{size:10}}}},
      animation:{animateRotate:true,animateScale:true,duration:1400} }
  });
}`,
    scatter: `
function chartScatter(ctx) {
  const ind = DATASET.indicateurs;
  if (ind.length < 2) return null;
  return new Chart(ctx, {
    type:'bubble',
    data:{datasets:ind.map((d,i)=>({label:d.label,data:[{x:i,y:d.valeur,r:Math.max(4,Math.min(18,Math.sqrt(Math.abs(d.valeur)/10)||6))}],backgroundColor:d.couleur+'99',borderColor:d.couleur,borderWidth:2}))},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'bottom',labels:{padding:8,font:{size:10}}}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8',callback:(_,i)=>ind[i]?.label||i}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#94a3b8'}}},
      animation:{duration:1400,easing:'easeOutQuart'} }
  });
}`,
  };

  // Build chart switch cases
  const chartIdMap = {
    indicateurs:      'chart-indicateurs',
    repartition:      'chart-repartition',
    distribution:     'chart-distribution',
    lineEvolution:    'chart-evolution',
    lineArea:         'chart-line-area',
    barH:             'chart-barh',
    barComparatif:    'chart-comparatif',
    radarIndicateurs: 'chart-radar',
    stackedBar:       'chart-stacked',
    polarArea:        'chart-polar',
    scatter:          'chart-scatter',
  };
  const chartFuncMap = {
    indicateurs:      'chartIndicateurs',
    repartition:      'chartRepartition',
    distribution:     'chartDistribution',
    lineEvolution:    hasTime ? 'chartEvolution' : null,
    lineArea:         'chartLineArea',
    barH:             'chartBarH',
    barComparatif:    'chartComparatif',
    radarIndicateurs: 'chartRadar',
    stackedBar:       'chartStackedBar',
    polarArea:        'chartPolar',
    scatter:          'chartScatter',
  };

  const activeCharts = order.filter(k => chartFuncMap[k]);
  const usedFuncCode = [...new Set(activeCharts.map(k => chartFunctions[k]).filter(Boolean))].join('\n');

  const switchCases = activeCharts
    .filter(k => chartFuncMap[k])
    .map(k => `        case '${chartIdMap[k]}': CHARTS[id] = ${chartFuncMap[k]}(ctx); break;`)
    .join('\n');

  return `/**
 * Graphiques Chart.js — Domain: ${domain} — Algeria Tech Generator v4
 */

import { DATASET, fmt, PALETTE } from './data.js';

function applyTheme() {
  const C = window.Chart;
  if (!C) return;
  C.defaults.font.family       = "'Manrope', sans-serif";
  C.defaults.font.size         = 12;
  C.defaults.color             = '#94a3b8';
  C.defaults.borderColor       = 'rgba(255,255,255,0.06)';
  C.defaults.plugins.legend.labels.color = '#f4ede0';
  C.defaults.plugins.legend.labels.font  = { family:"'JetBrains Mono',monospace", size:11 };
  C.defaults.plugins.tooltip.backgroundColor = 'rgba(17,23,41,.95)';
  C.defaults.plugins.tooltip.titleColor  = PALETTE[0];
  C.defaults.plugins.tooltip.bodyColor   = '#f4ede0';
  C.defaults.plugins.tooltip.borderColor = PALETTE[0] + '66';
  C.defaults.plugins.tooltip.borderWidth = 1;
  C.defaults.plugins.tooltip.padding     = 12;
  C.defaults.plugins.tooltip.cornerRadius= 8;
}

const CHARTS = {};

${usedFuncCode}

export function initCharts() {
  applyTheme();
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      if (CHARTS[id]) return;
      const ctx = entry.target.getContext('2d');
      switch (id) {
${switchCases}
      }
      if (CHARTS[id]) obs.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('canvas[id^="chart-"]').forEach(c => obs.observe(c));
}
`;
}

// ─── Génération scene3d.js — CONSTELLATION AVEC RAYCASTER (générique) ─────────

function genScene3DConstellationJS(pal) {
  return `/**
 * Scène 3D — « Constellation de données »
 * Algeria Tech Generator v3 — Raycaster + Tooltip KPI
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w = container.clientWidth || 600;
  const h = container.clientHeight || 480;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e1a, 0.022);

  const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
  camera.position.set(0, 2, 22);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  container.style.position = 'relative';
  container.appendChild(renderer.domElement);

  const c1 = parseInt((PALETTE[0] || '#D4A437').replace('#', ''), 16);
  const c2 = parseInt((PALETTE[1] || '#2D8A5F').replace('#', ''), 16);
  const c3 = parseInt((PALETTE[2] || '#B85042').replace('#', ''), 16);

  // ── Éclairage ───────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.28));
  const lA = new THREE.PointLight(c1, 2.5, 65); lA.position.set(10, 12, 10); scene.add(lA);
  const lB = new THREE.PointLight(c2, 1.8, 55); lB.position.set(-12, -8, 6);  scene.add(lB);
  const lC = new THREE.PointLight(c3, 1.2, 40); lC.position.set(0, -10, -8);  scene.add(lC);

  // ── Cristal central ─────────────────────────────────────────────────────────
  const crystalGeo = new THREE.IcosahedronGeometry(2.4, 2);
  const crystal = new THREE.Mesh(crystalGeo, new THREE.MeshStandardMaterial({
    color: c1, metalness: 0.85, roughness: 0.12, transparent: true, opacity: 0.88
  }));
  crystal.userData.kpi = {
    label:  DATASET.meta.titre.substring(0, 40),
    valeur: DATASET.meta.sousTitre ? DATASET.meta.sousTitre.substring(0, 50) : DATASET.meta.periode || '',
    unite:  ''
  };
  scene.add(crystal);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.46, 2),
    new THREE.MeshBasicMaterial({ color: c1, wireframe: true, transparent: true, opacity: 0.18 })
  );
  scene.add(wire);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.04, 8, 80),
    new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.35 })
  );
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  // ── Sphères orbitales KPI avec halo ─────────────────────────────────────────
  const kpis = DATASET.kpis.slice(0, 3);
  const orbColors = [c1, c2, c3];
  const orbs = kpis.map((kpi, i) => {
    const radius = 5.5 + i * 1.8;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 22, 22),
      new THREE.MeshStandardMaterial({
        color: orbColors[i], emissive: orbColors[i], emissiveIntensity: 0.75, roughness: 0.2, metalness: 0.6
      })
    );
    mesh.userData.kpi = kpi;

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.78, 14, 14),
      new THREE.MeshBasicMaterial({ color: orbColors[i], transparent: true, opacity: 0.1, side: THREE.BackSide })
    );
    mesh.add(halo);

    const orbitPts = [];
    for (let s = 0; s <= 128; s++) {
      const a = (s / 128) * Math.PI * 2;
      orbitPts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius * 0.55));
    }
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPts),
      new THREE.LineBasicMaterial({ color: orbColors[i], transparent: true, opacity: 0.08 })
    ));

    const connGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const conn = new THREE.Line(connGeo, new THREE.LineBasicMaterial({ color: orbColors[i], transparent: true, opacity: 0.45 }));
    scene.add(mesh); scene.add(conn);
    return { mesh, conn, radius, phi: (i / 3) * Math.PI * 2, spd: 0.26 + i * 0.09 };
  });

  // ── Grille sinusoïdale ───────────────────────────────────────────────────────
  const gRes = 40, gSize = 12;
  const fGeo = new THREE.BufferGeometry();
  const fVerts = new Float32Array((gRes + 1) * (gRes + 1) * 3);
  let vi = 0;
  for (let iy = 0; iy <= gRes; iy++) for (let ix = 0; ix <= gRes; ix++) {
    const x = (ix / gRes - 0.5) * gSize, z = (iy / gRes - 0.5) * gSize;
    const y = Math.sin(x * 1.1) * Math.cos(z * 1.1) * 0.5 + Math.sin(x * 2.3 + 1.2) * Math.cos(z * 1.7) * 0.22;
    fVerts[vi++] = x; fVerts[vi++] = y - 6; fVerts[vi++] = z;
  }
  fGeo.setAttribute('position', new THREE.BufferAttribute(fVerts, 3));
  scene.add(new THREE.Mesh(fGeo, new THREE.MeshStandardMaterial({ color: c2, wireframe: true, transparent: true, opacity: 0.09 })));

  // ── Particules ───────────────────────────────────────────────────────────────
  const N = 1800;
  const pp = new Float32Array(N * 3), pc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pp[i * 3] = (Math.random() - 0.5) * 130;
    pp[i * 3 + 1] = (Math.random() - 0.5) * 130;
    pp[i * 3 + 2] = (Math.random() - 0.5) * 75 - 12;
    const col = new THREE.Color(c1).lerp(new THREE.Color(c2), Math.random());
    pc[i * 3] = col.r; pc[i * 3 + 1] = col.g; pc[i * 3 + 2] = col.b;
  }
  const pG = new THREE.BufferGeometry();
  pG.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  pG.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  scene.add(new THREE.Points(pG, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.5 })));

  // ── Tooltip hover ────────────────────────────────────────────────────────────
  const tt = document.createElement('div');
  tt.style.cssText = [
    'position:absolute', 'pointer-events:none',
    'background:rgba(10,14,26,.94)',
    'border:1px solid rgba(212,164,55,.6)',
    'border-radius:10px', 'padding:9px 16px',
    'font-family:var(--font-body,"Manrope",sans-serif)',
    'font-size:.72rem', 'letter-spacing:.04em',
    'color:#f4ede0', 'white-space:nowrap',
    'opacity:0', 'transition:opacity .15s ease, transform .12s ease',
    'box-shadow:0 6px 32px rgba(0,0,0,.65)',
    'backdrop-filter:blur(12px)',
    'z-index:20', 'transform:translate(-50%,-140%)',
    'text-align:center', 'line-height:1.6',
    'will-change:transform,opacity'
  ].join(';');
  container.appendChild(tt);

  // ── Raycaster ────────────────────────────────────────────────────────────────
  const ray = new THREE.Raycaster();
  ray.params.Points = { threshold: 0.4 };
  const mouse = new THREE.Vector2(9999, 9999);
  let mxPx = 0, myPx = 0;

  renderer.domElement.addEventListener('pointermove', e => {
    const rect = renderer.domElement.getBoundingClientRect();
    mxPx = e.clientX - rect.left;
    myPx = e.clientY - rect.top;
    mouse.x = (mxPx / rect.width)  * 2 - 1;
    mouse.y = -(myPx / rect.height) * 2 + 1;
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    mouse.set(9999, 9999);
    tt.style.opacity = '0';
  });

  const hitTargets = [crystal, ...orbs.map(o => o.mesh)];

  // ── OrbitControls ────────────────────────────────────────────────────────────
  const ctrl = new OrbitControls(camera, renderer.domElement);
  ctrl.enableDamping = true; ctrl.dampingFactor = 0.06;
  ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.55;
  ctrl.minDistance = 8; ctrl.maxDistance = 28;
  ctrl.enablePan = false;

  // ── ResizeObserver ───────────────────────────────────────────────────────────
  const ro = new ResizeObserver(() => {
    const nw = container.clientWidth, nh = container.clientHeight;
    if (!nw || !nh) return;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
  ro.observe(container);

  // ── Boucle d'animation ───────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let fid;

  (function animate() {
    fid = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    crystal.rotation.y += 0.003; crystal.rotation.x += 0.001;
    wire.rotation.copy(crystal.rotation);
    ring.rotation.z += 0.004;
    lA.intensity = 2.5 + Math.sin(t * 1.2) * 0.4;
    lB.intensity = 1.8 + Math.sin(t * 0.8 + 1) * 0.3;

    orbs.forEach(o => {
      o.phi += o.spd * 0.008;
      o.mesh.position.set(
        Math.cos(o.phi) * o.radius,
        Math.sin(o.phi * 0.65) * 2.2,
        Math.sin(o.phi) * o.radius * 0.52
      );
      o.conn.geometry.setFromPoints([new THREE.Vector3(), o.mesh.position.clone()]);
    });

    // Raycasting hover
    if (mouse.x !== 9999) {
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(hitTargets, true);
      if (hits.length) {
        let obj = hits[0].object;
        while (obj && !obj.userData.kpi) obj = obj.parent;
        if (obj?.userData.kpi) {
          const k = obj.userData.kpi;
          const val = typeof k.valeur === 'number'
            ? k.valeur.toLocaleString('fr-FR') + (k.unite ? ' ' + k.unite : '')
            : String(k.valeur ?? '') + (k.unite ? ' ' + k.unite : '');
          tt.innerHTML = \`<span style="color:#d4a437;font-weight:700;display:block;margin-bottom:2px">\${k.label}</span><span style="color:#ecd28a;font-size:.82em">\${val}</span>\`;
          tt.style.left = mxPx + 'px';
          tt.style.top  = myPx + 'px';
          tt.style.opacity = '1';
          renderer.domElement.style.cursor = 'crosshair';
        } else { tt.style.opacity = '0'; renderer.domElement.style.cursor = ''; }
      } else { tt.style.opacity = '0'; renderer.domElement.style.cursor = ''; }
    }

    ctrl.update();
    renderer.render(scene, camera);
  })();

  return { dispose() {
    cancelAnimationFrame(fid); ro.disconnect(); ctrl.dispose(); renderer.dispose();
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    if (tt.parentNode) tt.parentNode.removeChild(tt);
  }};
}
`;
}

// ─── Génération scene3d.js — CHAMP DE SIGNAUX antennes (telecom) ─────────────

function genScene3DAntennesJS() {
  return `/**
 * Scène 3D — « Champ de Signaux » Télécom
 * Algeria Tech Generator v3 — Raycaster + Tooltip KPI
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w = container.clientWidth, h = container.clientHeight;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e1a, 0.032);

  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
  camera.position.set(8, 6, 12);
  camera.lookAt(0, 1, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  container.style.position = 'relative';
  container.appendChild(renderer.domElement);

  // Lumières
  scene.add(new THREE.AmbientLight(0xf4ede0, 0.25));
  const moon = new THREE.DirectionalLight(0xc9d6f5, 0.4); moon.position.set(5, 10, 5); scene.add(moon);
  const gold = new THREE.PointLight(0xd4a437, 0.8, 25); gold.position.set(-6, 4, -4); scene.add(gold);

  // Sol low-poly
  const gGeo = new THREE.PlaneGeometry(24, 24, 48, 48);
  const gPos = gGeo.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
    const x = gPos.getX(i), y = gPos.getY(i), d = Math.sqrt(x*x+y*y);
    gPos.setZ(i, Math.sin(x*.5)*.15 + Math.cos(y*.4)*.12 + Math.sin(d*.3)*.1 - d*.05);
  }
  gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ color:0x1a2238, flatShading:true, metalness:.05, roughness:.85 }));
  ground.rotation.x = -Math.PI/2; ground.position.y = -1; scene.add(ground);
  const wireG = new THREE.Mesh(gGeo.clone(), new THREE.MeshBasicMaterial({ color:0xd4a437, wireframe:true, transparent:true, opacity:.15 }));
  wireG.rotation.x = -Math.PI/2; wireG.position.y = -0.998; scene.add(wireG);

  // Antennes KPI
  const kpis = DATASET.kpis.slice(0, 3);
  const vals = kpis.map(k => Math.abs(parseFloat(k.valeur)) || 1);
  const maxV = Math.max(...vals), minV = Math.min(...vals);
  const positions = [{ x:-3.5, z:1 }, { x:3.5, z:1.5 }, { x:0, z:-3 }];
  const antennas  = [];

  kpis.forEach((kpi, i) => {
    const colorHex = parseInt((PALETTE[i]||'#D4A437').replace('#',''), 16);
    const h = 2.8 + ((vals[i]-minV)/(maxV-minV||1)) * 1.7;
    const grp = new THREE.Group();

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(.05, .08, h, 8),
      new THREE.MeshStandardMaterial({ color:0x1a2238, metalness:.7, roughness:.3, emissive:colorHex, emissiveIntensity:.15 })
    );
    mast.position.y = h/2-1; grp.add(mast);

    const haubanMat = new THREE.LineBasicMaterial({ color:colorHex, transparent:true, opacity:.35 });
    for (let a=0;a<3;a++) {
      const ang = (a/3)*Math.PI*2;
      const pts = [new THREE.Vector3(0,h-1,0), new THREE.Vector3(Math.cos(ang)*.6,-1,Math.sin(ang)*.6)];
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), haubanMat));
    }

    const tip = new THREE.Mesh(new THREE.SphereGeometry(.15,16,16),
      new THREE.MeshStandardMaterial({ color:colorHex, emissive:colorHex, emissiveIntensity:1.5 }));
    tip.position.y = h-1; grp.add(tip);

    const halo = new THREE.Mesh(new THREE.SphereGeometry(.4,16,16),
      new THREE.MeshBasicMaterial({ color:colorHex, transparent:true, opacity:.18, side:THREE.BackSide }));
    halo.position.y = h-1; grp.add(halo);

    const pl = new THREE.PointLight(colorHex, 1.2, 8); pl.position.y = h-1; grp.add(pl);

    grp.position.set(positions[i].x, 0, positions[i].z);
    grp.userData = { kpi, tipPos: new THREE.Vector3(positions[i].x, h-1, positions[i].z), tip, colorHex };
    scene.add(grp);
    antennas.push(grp);
  });

  // Anneaux d'ondes
  const rings = [];
  antennas.forEach(ant => {
    for (let i=0;i<5;i++) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(1,1.05,64),
        new THREE.MeshBasicMaterial({ color:ant.userData.colorHex, side:THREE.DoubleSide, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending })
      );
      r.rotation.x = -Math.PI/2;
      r.position.copy(ant.userData.tipPos); r.position.y = -0.92;
      r.userData = { phase:(i/5)*3.0 };
      scene.add(r); rings.push({ ring:r, ant });
    }
  });

  // Particules de poussière
  const dustN = 200, dp = new Float32Array(dustN*3);
  for (let i=0;i<dustN;i++) { dp[i*3]=(Math.random()-.5)*22; dp[i*3+1]=Math.random()*8; dp[i*3+2]=(Math.random()-.5)*22; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position',new THREE.BufferAttribute(dp,3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color:0xd4a437, size:.04, transparent:true, opacity:.4, blending:THREE.AdditiveBlending, depthWrite:false }));
  scene.add(dust);

  // Arcs entre antennes
  const arcs = [];
  function pickPair() { const a=Math.floor(Math.random()*3); let b=Math.floor(Math.random()*2); if(b>=a)b++; return [a,b]; }
  for (let i=0;i<20;i++) {
    const [a,b] = pickPair();
    const p = new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),
      new THREE.MeshBasicMaterial({ color:0xd4a437, transparent:true, opacity:.9, blending:THREE.AdditiveBlending }));
    scene.add(p);
    arcs.push({ p, from:a, to:b, t:Math.random(), speed:.18+Math.random()*.2, arcH:2.5+Math.random()*2.5 });
  }
  function resetArc(arc) { const [a,b]=pickPair(); arc.from=a;arc.to=b;arc.t=0; }

  // OrbitControls
  const ctrl = new OrbitControls(camera, renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.5;
  ctrl.enablePan=false; ctrl.minDistance=10; ctrl.maxDistance=22;
  ctrl.maxPolarAngle=Math.PI*.49; ctrl.minPolarAngle=Math.PI*.18; ctrl.target.set(0,.5,0);

  // Tooltip
  const tt = document.createElement('div');
  tt.style.cssText = [
    'position:absolute', 'pointer-events:none',
    'background:rgba(17,23,41,.95)', 'backdrop-filter:blur(10px)',
    'border:1px solid rgba(212,164,55,.55)', 'border-radius:10px',
    'padding:9px 14px',
    'font-family:var(--font-body,"Manrope",sans-serif)',
    'font-size:.72rem', 'letter-spacing:.04em',
    'color:#f4ede0', 'white-space:nowrap',
    'opacity:0', 'transition:opacity .2s ease',
    'z-index:20', 'text-align:center', 'line-height:1.6'
  ].join(';');
  container.appendChild(tt);

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2(9999, 9999);
  let mxPx = 0, myPx = 0;

  renderer.domElement.addEventListener('pointermove', e => {
    const rect = renderer.domElement.getBoundingClientRect();
    mxPx = e.clientX - rect.left; myPx = e.clientY - rect.top;
    mouse.x = ((e.clientX-rect.left)/rect.width)*2-1;
    mouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    mouse.set(9999, 9999); tt.style.opacity = '0';
  });

  // ResizeObserver
  const ro = new ResizeObserver(() => {
    const nw = container.clientWidth, nh = container.clientHeight;
    camera.aspect=nw/nh; camera.updateProjectionMatrix(); renderer.setSize(nw,nh);
  });
  ro.observe(container);

  // Boucle d'animation
  const clock = new THREE.Clock();
  const tv = new THREE.Vector3();
  let fid;

  (function animate() {
    fid = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(),.05), t = clock.getElapsedTime();

    antennas.forEach((ant,i) => { const s=1+Math.sin(t*2.5+i*1.3)*.15; ant.userData.tip.scale.set(s,s,s); });
    rings.forEach(({ring}) => {
      const ct=((t+ring.userData.phase)%3.5)/3.5;
      const sc=.5+ct*7.5; ring.scale.set(sc,sc,sc);
      ring.material.opacity=.65*Math.min(ct*6,1)*(1-ct);
    });
    arcs.forEach(arc => {
      arc.t+=dt*arc.speed; if(arc.t>=1) resetArc(arc);
      if(antennas[arc.from]&&antennas[arc.to]) {
        tv.lerpVectors(antennas[arc.from].userData.tipPos, antennas[arc.to].userData.tipPos, arc.t);
        arc.p.position.set(tv.x, tv.y+4*arc.t*(1-arc.t)*arc.arcH, tv.z);
        arc.p.material.opacity=.9*Math.sin(arc.t*Math.PI);
      }
    });
    const dp2=dust.geometry.attributes.position;
    for(let i=0;i<dustN;i++){const idx=i*3+1;dp2.array[idx]+=dt*.15;if(dp2.array[idx]>8)dp2.array[idx]=0;}
    dp2.needsUpdate=true; dust.rotation.y+=dt*.02;

    // Raycasting
    if (mouse.x !== 9999) {
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(antennas, true);
      if (hits.length) {
        let p = hits[0].object;
        while (p && !p.userData.kpi) p = p.parent;
        if (p?.userData.kpi) {
          const k = p.userData.kpi;
          const val = typeof k.valeur === 'number'
            ? k.valeur.toLocaleString('fr-FR') + (k.unite ? ' ' + k.unite : '')
            : String(k.valeur ?? '') + (k.unite ? ' ' + k.unite : '');
          tt.innerHTML = \`<span style="color:#d4a437;font-weight:700;display:block;margin-bottom:2px">\${k.label}</span><span style="color:#ecd28a;font-size:.82em">\${val}</span>\`;
          tt.style.left = (mxPx + 14) + 'px';
          tt.style.top  = (myPx + 14) + 'px';
          tt.style.opacity = '1';
          renderer.domElement.style.cursor = 'crosshair';
        } else { tt.style.opacity = '0'; renderer.domElement.style.cursor = ''; }
      } else { tt.style.opacity = '0'; renderer.domElement.style.cursor = ''; }
    }

    ctrl.update();
    renderer.render(scene, camera);
  })();

  return { dispose() {
    cancelAnimationFrame(fid); ro.disconnect(); ctrl.dispose(); renderer.dispose();
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    if (tt.parentNode) tt.parentNode.removeChild(tt);
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }};
}
`;
}

// ─── Globe numérique ─────────────────────────────────────────────────────────
function genScene3DGlobeJS(pal) {
  return `/**
 * Scène 3D — Globe Numérique
 * Algeria Tech Generator v4 — Raycaster + Tooltip KPI
 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w = container.clientWidth || 600, h = container.clientHeight || 480;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e1a, 0.015);
  const camera = new THREE.PerspectiveCamera(48, w/h, 0.1, 200);
  camera.position.set(0, 2, 16);
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setSize(w, h); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0); container.style.position='relative';
  container.appendChild(renderer.domElement);

  const c1=parseInt((PALETTE[0]||'#D4A437').replace('#',''),16);
  const c2=parseInt((PALETTE[1]||'#2D8A5F').replace('#',''),16);
  const c3=parseInt((PALETTE[2]||'#B85042').replace('#',''),16);

  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const lA=new THREE.PointLight(c1,2.8,80); lA.position.set(12,12,12); scene.add(lA);
  const lB=new THREE.PointLight(c2,1.6,60); lB.position.set(-12,-8,6); scene.add(lB);

  // Sphère globe
  const R=4.5;
  const globe=new THREE.Mesh(new THREE.SphereGeometry(R,56,56),
    new THREE.MeshStandardMaterial({color:0x071228,metalness:.3,roughness:.75,transparent:true,opacity:.88}));
  globe.userData.kpi={label:DATASET.meta.titre.substring(0,38), valeur:DATASET.meta.periode||'', unite:''};
  scene.add(globe);

  // Wireframe overlay
  const gWire=new THREE.Mesh(new THREE.SphereGeometry(R+0.02,28,28),
    new THREE.MeshBasicMaterial({color:c1,wireframe:true,transparent:true,opacity:.07}));
  scene.add(gWire);

  // Grille lat/lon
  const gridMat=new THREE.LineBasicMaterial({color:c1,transparent:true,opacity:.12});
  for(let lat=-80;lat<=80;lat+=20){
    const p=[];
    for(let lon=0;lon<=360;lon+=5){
      const phi=(90-lat)*Math.PI/180, t2=lon*Math.PI/180;
      p.push(new THREE.Vector3((R+.04)*Math.sin(phi)*Math.cos(t2),(R+.04)*Math.cos(phi),(R+.04)*Math.sin(phi)*Math.sin(t2)));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),gridMat));
  }
  for(let lon=0;lon<360;lon+=20){
    const p=[];
    for(let lat=-90;lat<=90;lat+=5){
      const phi=(90-lat)*Math.PI/180, t2=lon*Math.PI/180;
      p.push(new THREE.Vector3((R+.04)*Math.sin(phi)*Math.cos(t2),(R+.04)*Math.cos(phi),(R+.04)*Math.sin(phi)*Math.sin(t2)));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),gridMat));
  }

  // Anneau orbital
  const ring=new THREE.Mesh(new THREE.TorusGeometry(6,0.04,8,100),
    new THREE.MeshBasicMaterial({color:c1,transparent:true,opacity:.3}));
  ring.rotation.x=Math.PI*0.22; scene.add(ring);

  // Nœuds KPI sur le globe
  const kpis=DATASET.kpis.slice(0,5);
  const LATS=[36.7,23.4,34.0,51.5,-8.0], LONS=[3.1,30.5,108.8,-0.1,15.3];
  const COLS=[c1,c2,c3,c1,c2];
  const kpiNodes=kpis.map((kpi,i)=>{
    const phi=(90-LATS[i])*Math.PI/180, t2=LONS[i]*Math.PI/180;
    const pos=new THREE.Vector3((R+.35)*Math.sin(phi)*Math.cos(t2),(R+.35)*Math.cos(phi),(R+.35)*Math.sin(phi)*Math.sin(t2));
    const node=new THREE.Mesh(new THREE.SphereGeometry(.24,16,16),
      new THREE.MeshStandardMaterial({color:COLS[i],emissive:COLS[i],emissiveIntensity:1.4,roughness:.1,metalness:.6}));
    node.position.copy(pos); node.userData.kpi=kpi;
    const halo=new THREE.Mesh(new THREE.SphereGeometry(.5,10,10),
      new THREE.MeshBasicMaterial({color:COLS[i],transparent:true,opacity:.14,side:THREE.BackSide}));
    node.add(halo);
    const pl=new THREE.PointLight(COLS[i],1.0,4); node.add(pl);
    // Spike
    const surfNorm=pos.clone().normalize();
    const spike=new THREE.Mesh(new THREE.CylinderGeometry(.025,.07,.45,6),
      new THREE.MeshStandardMaterial({color:COLS[i],emissive:COLS[i],emissiveIntensity:.5}));
    spike.position.copy(surfNorm.clone().multiplyScalar(R+.18));
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), surfNorm);
    scene.add(spike);
    scene.add(node);
    return node;
  });

  // Particules
  const N=800, pp=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const phi=Math.random()*Math.PI*2, th=Math.random()*Math.PI, r2=8+Math.random()*22;
    pp[i*3]=r2*Math.sin(th)*Math.cos(phi); pp[i*3+1]=r2*Math.cos(th); pp[i*3+2]=r2*Math.sin(th)*Math.sin(phi);
  }
  const pG=new THREE.BufferGeometry(); pG.setAttribute('position',new THREE.BufferAttribute(pp,3));
  scene.add(new THREE.Points(pG,new THREE.PointsMaterial({size:.07,color:c1,transparent:true,opacity:.4})));

  // Tooltip
  const tt=document.createElement('div');
  tt.style.cssText='position:absolute;pointer-events:none;background:rgba(10,14,26,.94);border:1px solid rgba(212,164,55,.6);border-radius:10px;padding:9px 16px;font-family:var(--font-body,"Manrope",sans-serif);font-size:.72rem;color:#f4ede0;white-space:nowrap;opacity:0;transition:opacity .15s ease;box-shadow:0 6px 32px rgba(0,0,0,.65);backdrop-filter:blur(12px);z-index:20;text-align:center;line-height:1.6;transform:translate(-50%,-140%)';
  container.appendChild(tt);

  const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2(9999,9999); let mxPx=0,myPx=0;
  renderer.domElement.addEventListener('pointermove',e=>{
    const r=renderer.domElement.getBoundingClientRect(); mxPx=e.clientX-r.left; myPx=e.clientY-r.top;
    mouse.x=(mxPx/r.width)*2-1; mouse.y=-(myPx/r.height)*2+1;
  });
  renderer.domElement.addEventListener('pointerleave',()=>{mouse.set(9999,9999);tt.style.opacity='0';});
  const hitTargets=[globe,...kpiNodes];

  const ctrl=new OrbitControls(camera,renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.45;
  ctrl.minDistance=9; ctrl.maxDistance=24; ctrl.enablePan=false;
  const ro=new ResizeObserver(()=>{const nw=container.clientWidth,nh=container.clientHeight;camera.aspect=nw/nh;camera.updateProjectionMatrix();renderer.setSize(nw,nh);});
  ro.observe(container);

  const clock=new THREE.Clock(); let fid;
  (function animate(){
    fid=requestAnimationFrame(animate); const t=clock.getElapsedTime();
    globe.rotation.y+=.0018; gWire.rotation.y+=.0018;
    ring.rotation.z+=.003;
    lA.intensity=2.8+Math.sin(t*1.1)*.4;
    kpiNodes.forEach((n,i)=>{ const s=1+Math.sin(t*2.2+i*1.4)*.22; n.scale.set(s,s,s); });
    if(mouse.x!==9999){
      ray.setFromCamera(mouse,camera);
      const hits=ray.intersectObjects(hitTargets,true);
      if(hits.length){ let obj=hits[0].object; while(obj&&!obj.userData.kpi)obj=obj.parent;
        if(obj?.userData.kpi){ const k=obj.userData.kpi;
          const val=typeof k.valeur==='number'?k.valeur.toLocaleString('fr-FR')+(k.unite?' '+k.unite:''):String(k.valeur??'')+(k.unite?' '+k.unite:'');
          tt.innerHTML=\`<span style="color:#d4a437;font-weight:700;display:block;margin-bottom:2px">\${k.label}</span><span style="color:#ecd28a;font-size:.82em">\${val}</span>\`;
          tt.style.left=mxPx+'px'; tt.style.top=myPx+'px'; tt.style.opacity='1';
          renderer.domElement.style.cursor='crosshair';
        } else { tt.style.opacity='0'; renderer.domElement.style.cursor=''; }
      } else { tt.style.opacity='0'; renderer.domElement.style.cursor=''; }
    }
    ctrl.update(); renderer.render(scene,camera);
  })();
  return{dispose(){cancelAnimationFrame(fid);ro.disconnect();ctrl.dispose();renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);if(tt.parentNode)tt.parentNode.removeChild(tt);}};
}
`;
}

// ─── Orbite Satellite ─────────────────────────────────────────────────────────
function genScene3DSatelliteJS(pal) {
  return `/**
 * Scène 3D — Orbite Satellite
 * Algeria Tech Generator v4
 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w=container.clientWidth||600, h=container.clientHeight||480;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(48,w/h,0.1,300);
  camera.position.set(0,8,22);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0); container.style.position='relative';
  container.appendChild(renderer.domElement);

  const c1=parseInt((PALETTE[0]||'#7c3aed').replace('#',''),16);
  const c2=parseInt((PALETTE[1]||'#a78bfa').replace('#',''),16);

  scene.add(new THREE.AmbientLight(0x111133,0.4));
  const sun=new THREE.PointLight(0xfff8e0,3.5,120); sun.position.set(25,10,10); scene.add(sun);
  const back=new THREE.PointLight(c1,1.2,60); back.position.set(-15,-8,-10); scene.add(back);

  // Étoiles
  const N=2500, sp=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1), r=60+Math.random()*80;
    sp[i*3]=r*Math.sin(ph)*Math.cos(th); sp[i*3+1]=r*Math.cos(ph); sp[i*3+2]=r*Math.sin(ph)*Math.sin(th);
  }
  const sG=new THREE.BufferGeometry(); sG.setAttribute('position',new THREE.BufferAttribute(sp,3));
  scene.add(new THREE.Points(sG,new THREE.PointsMaterial({size:.12,color:0xffffff,transparent:true,opacity:.7})));

  // Planète
  const planet=new THREE.Mesh(new THREE.SphereGeometry(4,56,56),
    new THREE.MeshStandardMaterial({color:0x0a1628,metalness:.15,roughness:.85,transparent:true,opacity:.92}));
  scene.add(planet);
  const pw=new THREE.Mesh(new THREE.SphereGeometry(4.02,24,24),
    new THREE.MeshBasicMaterial({color:c1,wireframe:true,transparent:true,opacity:.06}));
  scene.add(pw);

  // Anneaux planétaires
  const ringGeo=new THREE.RingGeometry(5.5,5.65,64);
  const ring1=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:c1,side:THREE.DoubleSide,transparent:true,opacity:.22}));
  ring1.rotation.x=Math.PI*.42; scene.add(ring1);
  const ring2=new THREE.Mesh(new THREE.RingGeometry(6.2,6.3,64),
    new THREE.MeshBasicMaterial({color:c2,side:THREE.DoubleSide,transparent:true,opacity:.14}));
  ring2.rotation.x=Math.PI*.42; scene.add(ring2);

  // Satellites KPI
  const kpis=DATASET.kpis.slice(0,3);
  const SAT_COLORS=[c1,c2,parseInt((PALETTE[2]||'#c084fc').replace('#',''),16)];
  const sats=kpis.map((kpi,i)=>{
    const orbit=7+i*2.8;
    const grp=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(.5,.35,.25),
      new THREE.MeshStandardMaterial({color:0x8899aa,metalness:.7,roughness:.2}));
    const pL=new THREE.Mesh(new THREE.BoxGeometry(.06,1.5,.08),
      new THREE.MeshStandardMaterial({color:SAT_COLORS[i],metalness:.4,roughness:.6,transparent:true,opacity:.85}));
    const pR=new THREE.Mesh(new THREE.BoxGeometry(.06,1.5,.08),
      new THREE.MeshStandardMaterial({color:SAT_COLORS[i],metalness:.4,roughness:.6,transparent:true,opacity:.85}));
    pL.position.set(-0.9,0,0); pR.position.set(0.9,0,0);
    const pl=new THREE.PointLight(SAT_COLORS[i],1.5,6);
    grp.add(body,pL,pR,pl);
    grp.userData={kpi,orbit,phi:(i/3)*Math.PI*2,speed:0.22+i*0.08,tilt:0.12+i*0.05};
    // Orbite visuelle
    const ops=[];
    for(let s=0;s<=128;s++){const a=(s/128)*Math.PI*2;ops.push(new THREE.Vector3(Math.cos(a)*orbit,Math.sin(a)*orbit*0.12,Math.sin(a)*orbit));}
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ops),
      new THREE.LineBasicMaterial({color:SAT_COLORS[i],transparent:true,opacity:.18})));
    scene.add(grp);
    return grp;
  });

  // Tooltip
  const tt=document.createElement('div');
  tt.style.cssText='position:absolute;pointer-events:none;background:rgba(10,14,26,.94);border:1px solid rgba(124,58,237,.6);border-radius:10px;padding:9px 16px;font-family:"Manrope",sans-serif;font-size:.72rem;color:#f4ede0;white-space:nowrap;opacity:0;transition:opacity .15s;z-index:20;text-align:center;line-height:1.6;transform:translate(-50%,-140%)';
  container.appendChild(tt);
  const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2(9999,9999); let mxPx=0,myPx=0;
  renderer.domElement.addEventListener('pointermove',e=>{
    const r=renderer.domElement.getBoundingClientRect(); mxPx=e.clientX-r.left; myPx=e.clientY-r.top;
    mouse.x=(mxPx/r.width)*2-1; mouse.y=-(myPx/r.height)*2+1;
  });
  renderer.domElement.addEventListener('pointerleave',()=>{mouse.set(9999,9999);tt.style.opacity='0';});

  const ctrl=new OrbitControls(camera,renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.05; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.35;
  ctrl.minDistance=12; ctrl.maxDistance=32; ctrl.enablePan=false;
  const ro=new ResizeObserver(()=>{const nw=container.clientWidth,nh=container.clientHeight;camera.aspect=nw/nh;camera.updateProjectionMatrix();renderer.setSize(nw,nh);});
  ro.observe(container);

  const clock=new THREE.Clock(); let fid;
  (function animate(){
    fid=requestAnimationFrame(animate); const t=clock.getElapsedTime();
    planet.rotation.y+=.002; pw.rotation.y+=.002; ring1.rotation.z+=.001;
    sats.forEach(s=>{
      const d=s.userData;
      d.phi+=d.speed*.008;
      s.position.set(Math.cos(d.phi)*d.orbit, Math.sin(d.phi)*d.orbit*d.tilt, Math.sin(d.phi)*d.orbit);
      s.rotation.y+=.015;
    });
    if(mouse.x!==9999){
      ray.setFromCamera(mouse,camera);
      const hits=ray.intersectObjects(sats,true);
      if(hits.length){let p=hits[0].object;while(p&&!p.userData.kpi)p=p.parent;
        if(p?.userData.kpi){const k=p.userData.kpi;
          const val=typeof k.valeur==='number'?k.valeur.toLocaleString('fr-FR')+(k.unite?' '+k.unite:''):String(k.valeur??'')+(k.unite?' '+k.unite:'');
          tt.innerHTML=\`<span style="color:#a78bfa;font-weight:700;display:block;margin-bottom:2px">\${k.label}</span><span style="color:#c4b5fd;font-size:.82em">\${val}</span>\`;
          tt.style.left=mxPx+'px'; tt.style.top=myPx+'px'; tt.style.opacity='1';
          renderer.domElement.style.cursor='crosshair';
        } else {tt.style.opacity='0';renderer.domElement.style.cursor='';}
      } else {tt.style.opacity='0';renderer.domElement.style.cursor='';}
    }
    ctrl.update(); renderer.render(scene,camera);
  })();
  return{dispose(){cancelAnimationFrame(fid);ro.disconnect();ctrl.dispose();renderer.dispose();
    scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});
    if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);
    if(tt.parentNode)tt.parentNode.removeChild(tt);}};
}
`;
}

// ─── Barres financières flottantes ────────────────────────────────────────────
function genScene3DFinanceJS(pal) {
  return `/**
 * Scène 3D — Barres Financières
 * Algeria Tech Generator v4
 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w=container.clientWidth||600, h=container.clientHeight||480;
  const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x0f1629,0.025);
  const camera=new THREE.PerspectiveCamera(50,w/h,0.1,200);
  camera.position.set(0,6,18); camera.lookAt(0,0,0);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0); container.style.position='relative';
  container.appendChild(renderer.domElement);

  const c1=parseInt((PALETTE[0]||'#1d4ed8').replace('#',''),16);
  const c2=parseInt((PALETTE[1]||'#7c3aed').replace('#',''),16);
  const c3=parseInt((PALETTE[2]||'#10b981').replace('#',''),16);

  scene.add(new THREE.AmbientLight(0xffffff,.18));
  const lA=new THREE.PointLight(c1,2.8,60); lA.position.set(-8,10,8); scene.add(lA);
  const lB=new THREE.PointLight(c2,1.5,50); lB.position.set(10,-5,4); scene.add(lB);
  const lC=new THREE.PointLight(c3,1.2,40); lC.position.set(0,8,-6); scene.add(lC);

  // Grille sol
  const gridH=new THREE.GridHelper(28,18,c1,c1);
  gridH.material.transparent=true; gridH.material.opacity=.1; gridH.position.y=-2; scene.add(gridH);

  // Barres KPI
  const kpis=DATASET.kpis.slice(0,6);
  const vals=kpis.map(k=>Math.abs(parseFloat(k.valeur))||1);
  const maxV=Math.max(...vals)||1;
  const COLS=[c1,c2,c3,c1,c2,c3];
  const spacing=3.2, startX=(-(kpis.length-1)/2)*spacing;
  const bars=[];

  kpis.forEach((kpi,i)=>{
    const bH=0.5+(vals[i]/maxV)*6.5;
    const col=COLS[i];
    const bar=new THREE.Mesh(new THREE.BoxGeometry(1.8,bH,1.8),
      new THREE.MeshStandardMaterial({color:col,metalness:.45,roughness:.35,transparent:true,opacity:.88,emissive:col,emissiveIntensity:.08}));
    bar.position.set(startX+i*spacing, bH/2-2, 0);
    bar.userData={kpi,targetY:bH/2-2,bH};
    const wire=new THREE.Mesh(new THREE.BoxGeometry(1.82,bH,1.82),
      new THREE.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:.14}));
    wire.position.copy(bar.position); scene.add(wire);

    const cap=new THREE.Mesh(new THREE.BoxGeometry(1.8,.08,1.8),
      new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:1.8}));
    cap.position.set(startX+i*spacing, bH-2+.04, 0); scene.add(cap);

    const pl=new THREE.PointLight(col,1.2,6); pl.position.set(startX+i*spacing, bH-2+.8, 0); scene.add(pl);

    scene.add(bar); bars.push({bar,wire,cap,pl,bH,col});
  });

  // Particules
  const N=1200, pp=new Float32Array(N*3);
  for(let i=0;i<N;i++){pp[i*3]=(Math.random()-.5)*60;pp[i*3+1]=Math.random()*20-2;pp[i*3+2]=(Math.random()-.5)*40;}
  const pG=new THREE.BufferGeometry(); pG.setAttribute('position',new THREE.BufferAttribute(pp,3));
  scene.add(new THREE.Points(pG,new THREE.PointsMaterial({size:.065,color:c1,transparent:true,opacity:.35,blending:THREE.AdditiveBlending})));

  // Tooltip
  const tt=document.createElement('div');
  tt.style.cssText='position:absolute;pointer-events:none;background:rgba(15,22,41,.95);border:1px solid rgba(29,78,216,.6);border-radius:10px;padding:9px 16px;font-family:"Manrope",sans-serif;font-size:.72rem;color:#e2e8f0;white-space:nowrap;opacity:0;transition:opacity .15s;z-index:20;text-align:center;line-height:1.6;transform:translate(-50%,-140%)';
  container.appendChild(tt);
  const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2(9999,9999); let mxPx=0,myPx=0;
  renderer.domElement.addEventListener('pointermove',e=>{
    const r=renderer.domElement.getBoundingClientRect(); mxPx=e.clientX-r.left; myPx=e.clientY-r.top;
    mouse.x=(mxPx/r.width)*2-1; mouse.y=-(myPx/r.height)*2+1;
  });
  renderer.domElement.addEventListener('pointerleave',()=>{mouse.set(9999,9999);tt.style.opacity='0';});

  const ctrl=new OrbitControls(camera,renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.4;
  ctrl.minDistance=10; ctrl.maxDistance=28; ctrl.enablePan=false;
  ctrl.maxPolarAngle=Math.PI*.46; ctrl.minPolarAngle=Math.PI*.14; ctrl.target.set(0,0,0);
  const ro=new ResizeObserver(()=>{const nw=container.clientWidth,nh=container.clientHeight;camera.aspect=nw/nh;camera.updateProjectionMatrix();renderer.setSize(nw,nh);});
  ro.observe(container);

  const clock=new THREE.Clock(); let fid;
  const hitTargets=bars.map(b=>b.bar);
  (function animate(){
    fid=requestAnimationFrame(animate); const t=clock.getElapsedTime();
    lA.intensity=2.8+Math.sin(t*.8)*.4;
    bars.forEach((b,i)=>{
      const pulse=1+Math.sin(t*1.8+i*.7)*.02;
      b.bar.scale.set(pulse,1,pulse); b.wire.scale.set(pulse,1,pulse);
      b.cap.position.y=b.bH-2+Math.sin(t*2+i)*.06+.04;
      b.pl.intensity=1.2+Math.sin(t*2.2+i*1.1)*.5;
    });
    if(mouse.x!==9999){
      ray.setFromCamera(mouse,camera);
      const hits=ray.intersectObjects(hitTargets,false);
      if(hits.length){const k=hits[0].object.userData.kpi;
        const val=typeof k.valeur==='number'?k.valeur.toLocaleString('fr-FR')+(k.unite?' '+k.unite:''):String(k.valeur??'')+(k.unite?' '+k.unite:'');
        tt.innerHTML=\`<span style="color:#60a5fa;font-weight:700;display:block;margin-bottom:2px">\${k.label}</span><span style="color:#93c5fd;font-size:.82em">\${val}</span>\`;
        tt.style.left=mxPx+'px'; tt.style.top=myPx+'px'; tt.style.opacity='1';
        renderer.domElement.style.cursor='crosshair';
      } else {tt.style.opacity='0';renderer.domElement.style.cursor='';}
    }
    ctrl.update(); renderer.render(scene,camera);
  })();
  return{dispose(){cancelAnimationFrame(fid);ro.disconnect();ctrl.dispose();renderer.dispose();
    scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});
    if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);
    if(tt.parentNode)tt.parentNode.removeChild(tt);}};
}
`;
}

// ─── Hexagones KPI ───────────────────────────────────────────────────────────
function genScene3DHexagonsJS(pal) {
  return `/**
 * Scène 3D — Tours Hexagonales de Données
 * Algeria Tech Generator v4 — Raycaster + Tooltip KPI
 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w=container.clientWidth||600, h=container.clientHeight||480;
  const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x0a0e1a,0.028);
  const camera=new THREE.PerspectiveCamera(52,w/h,0.1,200);
  camera.position.set(0,8,16); camera.lookAt(0,0,0);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0); renderer.shadowMap.enabled=true;
  container.style.position='relative'; container.appendChild(renderer.domElement);

  const c1=parseInt((PALETTE[0]||'#D4A437').replace('#',''),16);
  const c2=parseInt((PALETTE[1]||'#2D8A5F').replace('#',''),16);
  const c3=parseInt((PALETTE[2]||'#B85042').replace('#',''),16);

  scene.add(new THREE.AmbientLight(0xffffff,.2));
  const moon=new THREE.DirectionalLight(0xc9d6f5,.35); moon.position.set(5,10,5); scene.add(moon);
  const lA=new THREE.PointLight(c1,2.2,50); lA.position.set(-6,8,6); scene.add(lA);
  const lB=new THREE.PointLight(c2,1.4,40); lB.position.set(6,-4,4); scene.add(lB);

  // Sol hexagonal
  const floorGeo=new THREE.CircleGeometry(14,6);
  scene.add(new THREE.Mesh(floorGeo,new THREE.MeshStandardMaterial({color:0x111729,roughness:.9,metalness:.1})));
  const floorWire=new THREE.Mesh(new THREE.CircleGeometry(14,6),
    new THREE.MeshBasicMaterial({color:c1,wireframe:true,transparent:true,opacity:.08}));
  scene.add(floorWire);

  // Tours hexagonales — une par KPI
  const kpis=DATASET.kpis.slice(0,6);
  const vals=kpis.map(k=>Math.abs(parseFloat(k.valeur))||1);
  const maxV=Math.max(...vals)||1;
  const GRID=[[0,0],[-4,0],[4,0],[-2,3.5],[2,3.5],[0,-4]];
  const hexTowers=[];

  kpis.forEach((kpi,i)=>{
    const hN=1.5+(vals[i]/maxV)*5.5;
    const colHex=i===0?c1:i===1?c2:i===2?c3:c1;
    const [gx,gz]=GRID[i]||[0,0];

    // Corps hexagonal
    const tower=new THREE.Mesh(new THREE.CylinderGeometry(1,1,hN,6),
      new THREE.MeshStandardMaterial({color:colHex,metalness:.55,roughness:.3,transparent:true,opacity:.82,emissive:colHex,emissiveIntensity:.12}));
    tower.position.set(gx,hN/2,gz);
    tower.userData.kpi=kpi;
    scene.add(tower);

    // Capuchon lumineux
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.12,6),
      new THREE.MeshStandardMaterial({color:colHex,emissive:colHex,emissiveIntensity:1.5}));
    cap.position.set(gx,hN+.06,gz); scene.add(cap);

    // Halo en haut
    const pl=new THREE.PointLight(colHex,1.2,8); pl.position.set(gx,hN+.5,gz); scene.add(pl);

    // Wireframe
    const twire=new THREE.Mesh(new THREE.CylinderGeometry(1.02,1.02,hN,6),
      new THREE.MeshBasicMaterial({color:colHex,wireframe:true,transparent:true,opacity:.15}));
    twire.position.copy(tower.position); scene.add(twire);

    hexTowers.push({tower,cap,pl,baseH:hN,colHex});
  });

  // Particules
  const N=1200, pp=new Float32Array(N*3);
  for(let i=0;i<N;i++){pp[i*3]=(Math.random()-.5)*60;pp[i*3+1]=Math.random()*30;pp[i*3+2]=(Math.random()-.5)*60;}
  const pG=new THREE.BufferGeometry(); pG.setAttribute('position',new THREE.BufferAttribute(pp,3));
  scene.add(new THREE.Points(pG,new THREE.PointsMaterial({size:.07,color:c1,transparent:true,opacity:.35})));

  // Tooltip
  const tt=document.createElement('div');
  tt.style.cssText='position:absolute;pointer-events:none;background:rgba(10,14,26,.94);border:1px solid rgba(212,164,55,.6);border-radius:10px;padding:9px 16px;font-family:var(--font-body,"Manrope",sans-serif);font-size:.72rem;color:#f4ede0;white-space:nowrap;opacity:0;transition:opacity .15s ease;box-shadow:0 6px 32px rgba(0,0,0,.65);backdrop-filter:blur(12px);z-index:20;text-align:center;line-height:1.6;transform:translate(-50%,-140%)';
  container.appendChild(tt);

  const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2(9999,9999); let mxPx=0,myPx=0;
  renderer.domElement.addEventListener('pointermove',e=>{
    const r=renderer.domElement.getBoundingClientRect(); mxPx=e.clientX-r.left; myPx=e.clientY-r.top;
    mouse.x=(mxPx/r.width)*2-1; mouse.y=-(myPx/r.height)*2+1;
  });
  renderer.domElement.addEventListener('pointerleave',()=>{mouse.set(9999,9999);tt.style.opacity='0';});
  const hitTargets=hexTowers.map(h=>h.tower);

  const ctrl=new OrbitControls(camera,renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.5;
  ctrl.minDistance=10; ctrl.maxDistance=28; ctrl.enablePan=false;
  ctrl.maxPolarAngle=Math.PI*.48; ctrl.minPolarAngle=Math.PI*.12; ctrl.target.set(0,2,0);
  const ro=new ResizeObserver(()=>{const nw=container.clientWidth,nh=container.clientHeight;camera.aspect=nw/nh;camera.updateProjectionMatrix();renderer.setSize(nw,nh);});
  ro.observe(container);

  const clock=new THREE.Clock(); let fid;
  (function animate(){
    fid=requestAnimationFrame(animate); const t=clock.getElapsedTime();
    lA.intensity=2.2+Math.sin(t*.9)*.35;
    hexTowers.forEach((h,i)=>{
      const pulse=1+Math.sin(t*2+i*.8)*.04;
      h.tower.scale.set(pulse,1,pulse);
      h.cap.scale.set(pulse,1,pulse);
      h.cap.position.y=h.baseH+Math.sin(t*1.5+i)*.08+.06;
      h.pl.intensity=1.2+Math.sin(t*2.5+i*1.2)*.5;
    });
    if(mouse.x!==9999){
      ray.setFromCamera(mouse,camera);
      const hits=ray.intersectObjects(hitTargets,false);
      if(hits.length){const k=hits[0].object.userData.kpi;
        const val=typeof k.valeur==='number'?k.valeur.toLocaleString('fr-FR')+(k.unite?' '+k.unite:''):String(k.valeur??'')+(k.unite?' '+k.unite:'');
        tt.innerHTML=\`<span style="color:#d4a437;font-weight:700;display:block;margin-bottom:2px">\${k.label}</span><span style="color:#ecd28a;font-size:.82em">\${val}</span>\`;
        tt.style.left=mxPx+'px'; tt.style.top=myPx+'px'; tt.style.opacity='1';
        renderer.domElement.style.cursor='crosshair';
      } else { tt.style.opacity='0'; renderer.domElement.style.cursor=''; }
    }
    ctrl.update(); renderer.render(scene,camera);
  })();
  return{dispose(){cancelAnimationFrame(fid);ro.disconnect();ctrl.dispose();renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);if(tt.parentNode)tt.parentNode.removeChild(tt);}};
}
`;
}

// ─── Vagues de données ────────────────────────────────────────────────────────
function genScene3DVaguesJS(pal) {
  return `/**
 * Scène 3D — Vagues de Données
 * Algeria Tech Generator v4 — Raycaster + Tooltip KPI
 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w=container.clientWidth||600, h=container.clientHeight||480;
  const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x0a0e1a,0.025);
  const camera=new THREE.PerspectiveCamera(50,w/h,0.1,200);
  camera.position.set(0,10,18); camera.lookAt(0,0,0);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0); container.style.position='relative';
  container.appendChild(renderer.domElement);

  const c1=parseInt((PALETTE[0]||'#D4A437').replace('#',''),16);
  const c2=parseInt((PALETTE[1]||'#2D8A5F').replace('#',''),16);
  const c3=parseInt((PALETTE[2]||'#B85042').replace('#',''),16);

  scene.add(new THREE.AmbientLight(0xffffff,.2));
  const lA=new THREE.PointLight(c1,2.5,60); lA.position.set(8,10,8); scene.add(lA);
  const lB=new THREE.PointLight(c2,1.8,50); lB.position.set(-8,-6,6); scene.add(lB);

  // Grille de vagues (surface paramétrique)
  const GR=60, GS=18;
  const waveGeo=new THREE.BufferGeometry();
  const verts=new Float32Array((GR+1)*(GR+1)*3);
  const orig=new Float32Array((GR+1)*(GR+1)*3);
  let vi=0;
  for(let iy=0;iy<=GR;iy++) for(let ix=0;ix<=GR;ix++){
    const x=(ix/GR-.5)*GS, z=(iy/GR-.5)*GS;
    orig[vi]=x; orig[vi+1]=0; orig[vi+2]=z;
    verts[vi++]=x; verts[vi++]=0; verts[vi++]=z;
  }
  waveGeo.setAttribute('position',new THREE.BufferAttribute(verts,3));
  // Index pour le mesh de triangles
  const idx=[];
  for(let iy=0;iy<GR;iy++) for(let ix=0;ix<GR;ix++){
    const a=iy*(GR+1)+ix, b=a+1, c=a+(GR+1), d=c+1;
    idx.push(a,b,c, b,d,c);
  }
  waveGeo.setIndex(idx);
  waveGeo.computeVertexNormals();
  const waveMesh=new THREE.Mesh(waveGeo,new THREE.MeshStandardMaterial({
    color:c2,wireframe:false,transparent:true,opacity:.55,
    metalness:.3,roughness:.6,side:THREE.DoubleSide
  }));
  scene.add(waveMesh);
  // Wireframe overlay
  scene.add(new THREE.Mesh(waveGeo,new THREE.MeshBasicMaterial({color:c1,wireframe:true,transparent:true,opacity:.12})));

  // Bulles KPI flottantes au-dessus des vagues
  const kpis=DATASET.kpis.slice(0,5);
  const BPOS=[[-5,2,2],[5,3,-2],[0,4,4],[-4,3,-4],[4,2,0]];
  const BCOLS=[c1,c2,c3,c1,c2];
  const bubbles=kpis.map((kpi,i)=>{
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.55,20,20),
      new THREE.MeshStandardMaterial({color:BCOLS[i],emissive:BCOLS[i],emissiveIntensity:.9,transparent:true,opacity:.85,roughness:.1,metalness:.7}));
    mesh.position.set(...BPOS[i]); mesh.userData.kpi=kpi;
    const halo=new THREE.Mesh(new THREE.SphereGeometry(1,12,12),
      new THREE.MeshBasicMaterial({color:BCOLS[i],transparent:true,opacity:.1,side:THREE.BackSide}));
    mesh.add(halo);
    scene.add(mesh);
    return mesh;
  });

  // Lignes de flux horizontal
  for(let i=0;i<12;i++){
    const pts=[];
    const z=(Math.random()-.5)*12;
    for(let x=-9;x<=9;x+=.5) pts.push(new THREE.Vector3(x, Math.random()*2-.5, z));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:c1,transparent:true,opacity:.06})));
  }

  // Tooltip
  const tt=document.createElement('div');
  tt.style.cssText='position:absolute;pointer-events:none;background:rgba(10,14,26,.94);border:1px solid rgba(212,164,55,.6);border-radius:10px;padding:9px 16px;font-family:var(--font-body,"Manrope",sans-serif);font-size:.72rem;color:#f4ede0;white-space:nowrap;opacity:0;transition:opacity .15s ease;box-shadow:0 6px 32px rgba(0,0,0,.65);backdrop-filter:blur(12px);z-index:20;text-align:center;line-height:1.6;transform:translate(-50%,-140%)';
  container.appendChild(tt);

  const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2(9999,9999); let mxPx=0,myPx=0;
  renderer.domElement.addEventListener('pointermove',e=>{
    const r=renderer.domElement.getBoundingClientRect(); mxPx=e.clientX-r.left; myPx=e.clientY-r.top;
    mouse.x=(mxPx/r.width)*2-1; mouse.y=-(myPx/r.height)*2+1;
  });
  renderer.domElement.addEventListener('pointerleave',()=>{mouse.set(9999,9999);tt.style.opacity='0';});

  const ctrl=new OrbitControls(camera,renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.4;
  ctrl.minDistance=10; ctrl.maxDistance=28; ctrl.enablePan=false;
  ctrl.maxPolarAngle=Math.PI*.45; ctrl.target.set(0,0,0);
  const ro=new ResizeObserver(()=>{const nw=container.clientWidth,nh=container.clientHeight;camera.aspect=nw/nh;camera.updateProjectionMatrix();renderer.setSize(nw,nh);});
  ro.observe(container);

  const clock=new THREE.Clock(); let fid;
  (function animate(){
    fid=requestAnimationFrame(animate); const t=clock.getElapsedTime();
    // Animer les vagues
    const pos=waveGeo.attributes.position;
    let k=0;
    for(let iy=0;iy<=GR;iy++) for(let ix=0;ix<=GR;ix++){
      const x=orig[k], z=orig[k+2];
      pos.array[k+1]=Math.sin(x*.7+t*1.2)*0.55+Math.cos(z*.6+t*.9)*.4+Math.sin(x*.3+z*.4+t*.6)*.25;
      k+=3;
    }
    pos.needsUpdate=true; waveGeo.computeVertexNormals();
    lA.intensity=2.5+Math.sin(t*1.1)*.4;
    bubbles.forEach((b,i)=>{ b.position.y=BPOS[i][1]+Math.sin(t*1.5+i)*.6; b.rotation.y+=.01; });
    if(mouse.x!==9999){
      ray.setFromCamera(mouse,camera);
      const hits=ray.intersectObjects(bubbles,true);
      if(hits.length){ let obj=hits[0].object; while(obj&&!obj.userData.kpi)obj=obj.parent;
        if(obj?.userData.kpi){ const kp=obj.userData.kpi;
          const val=typeof kp.valeur==='number'?kp.valeur.toLocaleString('fr-FR')+(kp.unite?' '+kp.unite:''):String(kp.valeur??'')+(kp.unite?' '+kp.unite:'');
          tt.innerHTML=\`<span style="color:#d4a437;font-weight:700;display:block;margin-bottom:2px">\${kp.label}</span><span style="color:#ecd28a;font-size:.82em">\${val}</span>\`;
          tt.style.left=mxPx+'px'; tt.style.top=myPx+'px'; tt.style.opacity='1';
          renderer.domElement.style.cursor='crosshair';
        } else { tt.style.opacity='0'; renderer.domElement.style.cursor=''; }
      } else { tt.style.opacity='0'; renderer.domElement.style.cursor=''; }
    }
    ctrl.update(); renderer.render(scene,camera);
  })();
  return{dispose(){cancelAnimationFrame(fid);ro.disconnect();ctrl.dispose();renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);if(tt.parentNode)tt.parentNode.removeChild(tt);}};
}
`;
}

// ─── Cubes financiers ─────────────────────────────────────────────────────────
function genScene3DCubeJS(pal) {
  return `/**
 * Scène 3D — Cubes BI Financiers
 * Algeria Tech Generator v4 — Raycaster + Tooltip KPI
 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w=container.clientWidth||600, h=container.clientHeight||480;
  const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x0a0e1a,0.022);
  const camera=new THREE.PerspectiveCamera(50,w/h,0.1,200);
  camera.position.set(0,6,18);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0); container.style.position='relative';
  container.appendChild(renderer.domElement);

  const c1=parseInt((PALETTE[0]||'#D4A437').replace('#',''),16);
  const c2=parseInt((PALETTE[1]||'#2D8A5F').replace('#',''),16);
  const c3=parseInt((PALETTE[2]||'#B85042').replace('#',''),16);

  scene.add(new THREE.AmbientLight(0xffffff,.25));
  const lA=new THREE.PointLight(c1,2.5,70); lA.position.set(10,10,10); scene.add(lA);
  const lB=new THREE.PointLight(c2,1.8,55); lB.position.set(-10,-8,6); scene.add(lB);
  const lC=new THREE.PointLight(c3,1.2,45); lC.position.set(0,-8,-10); scene.add(lC);

  const kpis=DATASET.kpis.slice(0,6);
  const vals=kpis.map(k=>Math.abs(parseFloat(k.valeur))||1);
  const maxV=Math.max(...vals)||1;

  // Layout en grille 3x2
  const POSITIONS=[[-5,0,-2],[0,0,-2],[5,0,-2],[-5,0,3],[0,0,3],[5,0,3]];
  const COLS=[c1,c2,c3,c2,c3,c1];
  const cubes=[], wires=[], pivots=[];

  kpis.forEach((kpi,i)=>{
    const scale=1.2+(vals[i]/maxV)*2.2;
    const geo=new THREE.BoxGeometry(scale,scale,scale);
    const mat=new THREE.MeshStandardMaterial({
      color:COLS[i],metalness:.65,roughness:.22,
      transparent:true,opacity:.82,
      emissive:COLS[i],emissiveIntensity:.1
    });
    const cube=new THREE.Mesh(geo,mat);
    cube.userData.kpi=kpi;

    const wireGeo=new THREE.EdgesGeometry(geo);
    const wire=new THREE.LineSegments(wireGeo,new THREE.LineBasicMaterial({color:COLS[i],transparent:true,opacity:.4}));

    const pivot=new THREE.Group();
    pivot.position.set(...POSITIONS[i]);
    pivot.userData.baseY=POSITIONS[i][1];
    pivot.add(cube); pivot.add(wire);

    const pl=new THREE.PointLight(COLS[i],.8,8); pl.position.y=scale*.6; pivot.add(pl);
    scene.add(pivot);
    cubes.push(cube); wires.push(wire); pivots.push(pivot);
  });

  // Sol reflétant
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(30,30),
    new THREE.MeshStandardMaterial({color:0x0d1524,metalness:.05,roughness:.95,transparent:true,opacity:.6}))
    .rotateX(-Math.PI/2).translateY(.01-3));

  // Grille sol
  scene.add(new THREE.GridHelper(30,20,c1,c1));
  scene.children[scene.children.length-1].material.transparent=true;
  scene.children[scene.children.length-1].material.opacity=.08;

  // Particules
  const N=1000, pp=new Float32Array(N*3);
  for(let i=0;i<N;i++){pp[i*3]=(Math.random()-.5)*60;pp[i*3+1]=Math.random()*35-5;pp[i*3+2]=(Math.random()-.5)*60;}
  const pG=new THREE.BufferGeometry(); pG.setAttribute('position',new THREE.BufferAttribute(pp,3));
  scene.add(new THREE.Points(pG,new THREE.PointsMaterial({size:.08,color:c1,transparent:true,opacity:.3})));

  // Tooltip
  const tt=document.createElement('div');
  tt.style.cssText='position:absolute;pointer-events:none;background:rgba(10,14,26,.94);border:1px solid rgba(212,164,55,.6);border-radius:10px;padding:9px 16px;font-family:var(--font-body,"Manrope",sans-serif);font-size:.72rem;color:#f4ede0;white-space:nowrap;opacity:0;transition:opacity .15s ease;box-shadow:0 6px 32px rgba(0,0,0,.65);backdrop-filter:blur(12px);z-index:20;text-align:center;line-height:1.6;transform:translate(-50%,-140%)';
  container.appendChild(tt);

  const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2(9999,9999); let mxPx=0,myPx=0;
  renderer.domElement.addEventListener('pointermove',e=>{
    const r=renderer.domElement.getBoundingClientRect(); mxPx=e.clientX-r.left; myPx=e.clientY-r.top;
    mouse.x=(mxPx/r.width)*2-1; mouse.y=-(myPx/r.height)*2+1;
  });
  renderer.domElement.addEventListener('pointerleave',()=>{mouse.set(9999,9999);tt.style.opacity='0';});

  const ctrl=new OrbitControls(camera,renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.55;
  ctrl.minDistance=10; ctrl.maxDistance=30; ctrl.enablePan=false;
  const ro=new ResizeObserver(()=>{const nw=container.clientWidth,nh=container.clientHeight;camera.aspect=nw/nh;camera.updateProjectionMatrix();renderer.setSize(nw,nh);});
  ro.observe(container);

  const clock=new THREE.Clock(); let fid;
  (function animate(){
    fid=requestAnimationFrame(animate); const t=clock.getElapsedTime();
    lA.intensity=2.5+Math.sin(t*1.1)*.4;
    cubes.forEach((c,i)=>{ c.rotation.x+=.006; c.rotation.y+=.008; });
    pivots.forEach((p,i)=>{ p.position.y=p.userData.baseY+Math.sin(t*1.2+i*.8)*.3; });
    if(mouse.x!==9999){
      ray.setFromCamera(mouse,camera);
      const hits=ray.intersectObjects(cubes,false);
      if(hits.length){ const k=hits[0].object.userData.kpi;
        const val=typeof k.valeur==='number'?k.valeur.toLocaleString('fr-FR')+(k.unite?' '+k.unite:''):String(k.valeur??'')+(k.unite?' '+k.unite:'');
        tt.innerHTML=\`<span style="color:#d4a437;font-weight:700;display:block;margin-bottom:2px">\${k.label}</span><span style="color:#ecd28a;font-size:.82em">\${val}</span>\`;
        tt.style.left=mxPx+'px'; tt.style.top=myPx+'px'; tt.style.opacity='1';
        renderer.domElement.style.cursor='crosshair';
      } else { tt.style.opacity='0'; renderer.domElement.style.cursor=''; }
    }
    ctrl.update(); renderer.render(scene,camera);
  })();
  return{dispose(){cancelAnimationFrame(fid);ro.disconnect();ctrl.dispose();renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);if(tt.parentNode)tt.parentNode.removeChild(tt);}};
}
`;
}

// ─── Réseau neuronal ─────────────────────────────────────────────────────────
function genScene3DNeuralJS(pal) {
  return `/**
 * Scène 3D — Réseau Neuronal de Données
 * Algeria Tech Generator v4 — Raycaster + Tooltip KPI
 */
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { DATASET, PALETTE } from './data.js';

export function initScene3D(container) {
  const w=container.clientWidth||600, h=container.clientHeight||480;
  const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x0a0e1a,0.02);
  const camera=new THREE.PerspectiveCamera(50,w/h,0.1,200);
  camera.position.set(0,3,20);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0); container.style.position='relative';
  container.appendChild(renderer.domElement);

  const c1=parseInt((PALETTE[0]||'#D4A437').replace('#',''),16);
  const c2=parseInt((PALETTE[1]||'#2D8A5F').replace('#',''),16);
  const c3=parseInt((PALETTE[2]||'#B85042').replace('#',''),16);

  scene.add(new THREE.AmbientLight(0xffffff,.2));
  const lA=new THREE.PointLight(c1,2.5,70); lA.position.set(8,8,8); scene.add(lA);
  const lB=new THREE.PointLight(c2,1.6,55); lB.position.set(-8,-6,5); scene.add(lB);

  const kpis=DATASET.kpis.slice(0,6);

  // Couches du réseau (input, hidden, output)
  const LAYERS=[[2,[-8,0,0]],[3,[0,0,0]],[3,[8,0,0]]]; // [nNodes, centerPos]
  const allNodes=[], kpiMap=[];

  // Générer les positions des nœuds
  LAYERS.forEach(([n,ctr],li)=>{
    for(let i=0;i<n;i++){
      const spread=n>1?(i/(n-1)-.5)*8:0;
      const pos=new THREE.Vector3(ctr[0], spread, ctr[2]+(Math.random()-.5)*3);
      const kpiIdx=(li*3+i)%kpis.length;
      const kpi=kpis[kpiIdx];
      const colHex=li===0?c1:li===1?c2:c3;

      const node=new THREE.Mesh(new THREE.SphereGeometry(.5,18,18),
        new THREE.MeshStandardMaterial({color:colHex,emissive:colHex,emissiveIntensity:.8,roughness:.15,metalness:.6}));
      node.position.copy(pos); node.userData.kpi=kpi;
      const halo=new THREE.Mesh(new THREE.SphereGeometry(.85,10,10),
        new THREE.MeshBasicMaterial({color:colHex,transparent:true,opacity:.12,side:THREE.BackSide}));
      node.add(halo);
      scene.add(node);
      allNodes.push({node,pos,layer:li,colHex});
      kpiMap.push(node);
    }
  });

  // Connexions entre couches
  const connections=[];
  const nodesL0=allNodes.filter(n=>n.layer===0);
  const nodesL1=allNodes.filter(n=>n.layer===1);
  const nodesL2=allNodes.filter(n=>n.layer===2);

  const drawConn=(fromNodes,toNodes)=>{
    fromNodes.forEach(f=>{
      toNodes.forEach(t=>{
        const pts=[f.pos.clone(),t.pos.clone()];
        const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({color:f.colHex,transparent:true,opacity:.18}));
        scene.add(line);
        // Pulse particle
        const pulseMesh=new THREE.Mesh(new THREE.SphereGeometry(.1,8,8),
          new THREE.MeshBasicMaterial({color:f.colHex,transparent:true,opacity:.9,blending:THREE.AdditiveBlending}));
        scene.add(pulseMesh);
        connections.push({line,pulse:pulseMesh,from:f.pos.clone(),to:t.pos.clone(),t:Math.random(),spd:.25+Math.random()*.2});
      });
    });
  };
  drawConn(nodesL0,nodesL1);
  drawConn(nodesL1,nodesL2);

  // Particules d'arrière-plan
  const N=1200, pp=new Float32Array(N*3);
  for(let i=0;i<N;i++){pp[i*3]=(Math.random()-.5)*70;pp[i*3+1]=(Math.random()-.5)*70;pp[i*3+2]=(Math.random()-.5)*50-5;}
  const pG=new THREE.BufferGeometry(); pG.setAttribute('position',new THREE.BufferAttribute(pp,3));
  scene.add(new THREE.Points(pG,new THREE.PointsMaterial({size:.07,color:c1,transparent:true,opacity:.35})));

  // Tooltip
  const tt=document.createElement('div');
  tt.style.cssText='position:absolute;pointer-events:none;background:rgba(10,14,26,.94);border:1px solid rgba(212,164,55,.6);border-radius:10px;padding:9px 16px;font-family:var(--font-body,"Manrope",sans-serif);font-size:.72rem;color:#f4ede0;white-space:nowrap;opacity:0;transition:opacity .15s ease;box-shadow:0 6px 32px rgba(0,0,0,.65);backdrop-filter:blur(12px);z-index:20;text-align:center;line-height:1.6;transform:translate(-50%,-140%)';
  container.appendChild(tt);

  const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2(9999,9999); let mxPx=0,myPx=0;
  renderer.domElement.addEventListener('pointermove',e=>{
    const r=renderer.domElement.getBoundingClientRect(); mxPx=e.clientX-r.left; myPx=e.clientY-r.top;
    mouse.x=(mxPx/r.width)*2-1; mouse.y=-(myPx/r.height)*2+1;
  });
  renderer.domElement.addEventListener('pointerleave',()=>{mouse.set(9999,9999);tt.style.opacity='0';});

  const ctrl=new OrbitControls(camera,renderer.domElement);
  ctrl.enableDamping=true; ctrl.dampingFactor=.06; ctrl.autoRotate=true; ctrl.autoRotateSpeed=.5;
  ctrl.minDistance=10; ctrl.maxDistance=30; ctrl.enablePan=false;
  const ro=new ResizeObserver(()=>{const nw=container.clientWidth,nh=container.clientHeight;camera.aspect=nw/nh;camera.updateProjectionMatrix();renderer.setSize(nw,nh);});
  ro.observe(container);

  const clock=new THREE.Clock(); let fid;
  (function animate(){
    fid=requestAnimationFrame(animate); const dt=Math.min(clock.getDelta(),.05), t=clock.getElapsedTime();
    lA.intensity=2.5+Math.sin(t*1.1)*.4;
    allNodes.forEach((n,i)=>{ const s=1+Math.sin(t*2+i*.9)*.15; n.node.scale.set(s,s,s); });
    connections.forEach(c=>{
      c.t+=dt*c.spd; if(c.t>=1)c.t=0;
      c.pulse.position.lerpVectors(c.from,c.to,c.t);
      c.pulse.material.opacity=.9*Math.sin(c.t*Math.PI);
    });
    if(mouse.x!==9999){
      ray.setFromCamera(mouse,camera);
      const hits=ray.intersectObjects(kpiMap,true);
      if(hits.length){ let obj=hits[0].object; while(obj&&!obj.userData.kpi)obj=obj.parent;
        if(obj?.userData.kpi){ const k=obj.userData.kpi;
          const val=typeof k.valeur==='number'?k.valeur.toLocaleString('fr-FR')+(k.unite?' '+k.unite:''):String(k.valeur??'')+(k.unite?' '+k.unite:'');
          tt.innerHTML=\`<span style="color:#d4a437;font-weight:700;display:block;margin-bottom:2px">\${k.label}</span><span style="color:#ecd28a;font-size:.82em">\${val}</span>\`;
          tt.style.left=mxPx+'px'; tt.style.top=myPx+'px'; tt.style.opacity='1';
          renderer.domElement.style.cursor='crosshair';
        } else { tt.style.opacity='0'; renderer.domElement.style.cursor=''; }
      } else { tt.style.opacity='0'; renderer.domElement.style.cursor=''; }
    }
    ctrl.update(); renderer.render(scene,camera);
  })();
  return{dispose(){cancelAnimationFrame(fid);ro.disconnect();ctrl.dispose();renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);if(tt.parentNode)tt.parentNode.removeChild(tt);}};
}
`;
}

function genScene3DJS(docType, pal, animType) {
  // animType explicite → priorité absolue
  // sinon domaine → scène adaptée
  const domainDefault = {
    telecom:   'antennes',
    satellite: 'satellite',
    finance:   'finance',
    internet:  'globe',
    startup:   'hexagones',
    energy:    'vagues',
    health:    'neural',
    industry:  'hexagones',
    product:   'cube',
    rapport:   'constellation',
    presse:    'constellation',
  };
  const type = animType || domainDefault[docType] || 'constellation';
  switch (type) {
    case 'antennes':      return genScene3DAntennesJS();
    case 'globe':         return genScene3DGlobeJS(pal);
    case 'hexagones':     return genScene3DHexagonsJS(pal);
    case 'vagues':        return genScene3DVaguesJS(pal);
    case 'cube':          return genScene3DCubeJS(pal);
    case 'neural':        return genScene3DNeuralJS(pal);
    case 'satellite':     return genScene3DSatelliteJS(pal);
    case 'finance':       return genScene3DFinanceJS(pal);
    // Aliases → scènes existantes adaptées
    case 'particules':    return genScene3DConstellationJS(pal);
    case 'pyramide':      return genScene3DConstellationJS(pal);
    case 'cristal':       return genScene3DConstellationJS(pal);
    case 'constellation':
    default:              return genScene3DConstellationJS(pal);
  }
}

// ─── Génération main.js ───────────────────────────────────────────────────────

function genMainJS(hasTime) {
  return `/**
 * Orchestration principale — Algeria Tech Generator v3
 */

import { DATASET, fmt } from './data.js';
import { initCharts } from './charts.js';
import { initScene3D } from './scene3d.js';
import { exportJSON, exportPDF, sharePage, toggleFullscreen, toast } from './exports.js';

function animateCounter(el) {
  const target   = parseFloat(el.dataset.target) || 0;
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const suffix   = el.dataset.suffix || '';
  const dur = 1800, t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  (function step(now) {
    const t = Math.min(1, (now - t0) / dur);
    const v = target * ease(t);
    el.textContent = v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (t < 1) requestAnimationFrame(step);
    else el.dataset.done = '1';
  })(performance.now());
}

function initCounters() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting && !e.target.dataset.done) animateCounter(e.target); });
  }, { threshold: 0.4 });
  document.querySelectorAll('.counter').forEach(c => obs.observe(c));
}

function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

function initNavigation() {
  const links    = document.querySelectorAll('.section-nav a');
  const sections = Array.from(links).map(l => document.querySelector(l.getAttribute('href')));
  function update() {
    const scrollY = window.scrollY + window.innerHeight / 3;
    let active = sections[0];
    for (const s of sections) { if (s && s.offsetTop <= scrollY) active = s; }
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + (active?.id || '')));
    document.querySelector('.topbar')?.classList.toggle('compact', window.scrollY > 100);
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function bindEvents() {
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-export-json')?.addEventListener('click', exportJSON);
  document.getElementById('btn-share')?.addEventListener('click', sharePage);
  document.getElementById('fab-fullscreen')?.addEventListener('click', toggleFullscreen);
  document.getElementById('fab-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function hideLoader() {
  setTimeout(() => document.getElementById('loader')?.classList.add('hidden'), 800);
}

window.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  initReveal();
  initNavigation();
  initCounters();

  if (window.Chart) {
    try { initCharts(); } catch (e) { console.error('Charts:', e); }
  }

  const el3d = document.getElementById('scene3d');
  if (el3d) {
    try { initScene3D(el3d); }
    catch (e) {
      console.error('Scene 3D:', e);
      el3d.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#94a3b8;font:0.8rem monospace;text-align:center;padding:1rem">Scène 3D indisponible<br>(WebGL requis)</div>';
    }
  }

  hideLoader();
});
`;
}

// ─── Génération exports.js ────────────────────────────────────────────────────

function genExportsJS(slug, title) {
  const safeName = slug.replace(/-/g, '_');
  return `/**
 * Exports — Algeria Tech Generator v3
 */

import { DATASET } from './data.js';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON() {
  downloadBlob(new Blob([JSON.stringify(DATASET, null, 2)], { type: 'application/json' }), '${safeName}.json');
  toast('JSON exporté');
}

export async function exportPDF() {
  if (!window.jspdf || !window.html2canvas) { toast('Module PDF indisponible', true); return; }
  toast('Génération PDF…');
  const { jsPDF } = window.jspdf;
  const fab = document.querySelector('.fab-stack');
  if (fab) fab.style.visibility = 'hidden';
  try {
    const canvas = await html2canvas(document.querySelector('main'), {
      backgroundColor: '#0a0e1a', scale: 1.5, useCORS: true, logging: false,
      windowWidth: document.querySelector('main').scrollWidth
    });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const img = canvas.toDataURL('image/jpeg', .85);
    const ih = canvas.height * pw / canvas.width;
    let left = ih, pos = 0;
    pdf.addImage(img, 'JPEG', 0, pos, pw, ih, '', 'FAST');
    left -= ph;
    while (left > 0) { pos = left - ih; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, pos, pw, ih, '', 'FAST'); left -= ph; }
    pdf.save('${safeName}.pdf');
    toast('PDF exporté');
  } catch (e) { toast('Erreur export PDF', true); console.error(e); }
  finally { if (fab) fab.style.visibility = ''; }
}

export async function sharePage() {
  const txt = { title: DATASET.meta.titre, text: DATASET.meta.sousTitre, url: location.href };
  if (navigator.share) { try { await navigator.share(txt); return; } catch (e) {} }
  try { await navigator.clipboard.writeText(location.href); toast('Lien copié'); }
  catch { toast('Partage indisponible', true); }
}

export function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
  else document.exitFullscreen();
}

let _tt;
export function toast(message, isError = false) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = message;
  el.style.background = isError ? '#b85042' : '#2d8a5f';
  el.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('show'), 2800);
}
`;
}

// ─── Fond d'écran injecté dans l'infographie ──────────────────────────────────

const IA_GRADS = [
  'linear-gradient(135deg,#0d0033 0%,#1a0550 40%,#0a2060 100%)',
  'linear-gradient(135deg,#001a00 0%,#002d20 40%,#001530 100%)',
  'linear-gradient(135deg,#1a0a00 0%,#2d1500 40%,#1a0a2d 100%)',
  'linear-gradient(135deg,#000d1a 0%,#001a33 50%,#001a1a 100%)',
  'linear-gradient(135deg,#0a001a 0%,#1a0033 40%,#001a2d 100%)',
  'linear-gradient(135deg,#000a00 0%,#001400 50%,#000a0a 100%)',
];

function genBgPhotoHTML(bgTheme, bgImage) {
  if (!bgTheme || bgTheme === 'none' || !bgImage || bgImage === 'none') return '';
  let styleVal = '';
  if (bgImage.startsWith('ia:')) {
    const idx = parseInt(bgImage.split(':')[1]) || 0;
    styleVal = `background:${IA_GRADS[idx % IA_GRADS.length]}`;
  } else {
    styleVal = `background-image:url('${bgImage}');background-size:cover;background-position:center`;
  }
  return `<div id="bg-photo" style="position:fixed;inset:0;z-index:0;pointer-events:none;${styleVal};opacity:0.50;transition:opacity 1s ease;"></div>`;
}

// ─── Génération index.html — LE CŒUR PREMIUM ──────────────────────────────────

function genIndexHTML(data, slug, pal, domain, bgTheme = 'none', bgImage = 'none') {
  domain = domain || data.docType || 'rapport';
  const {
    title, subtitle, date, source, docType,
    stats = [], keyPoints = [], sections = []
  } = data;

  const hasTime  = data.chartData && data.chartData.labels && data.chartData.labels.length >= 3;
  const typeLabels = {
    telecom:'Télécommunications', internet:'Internet & Réseaux',
    startup:'Startups & Innovation', rapport:'Rapport Officiel', presse:'Article de Presse',
    finance:'Finance & Économie', satellite:'Satellite & Spatial', health:'Santé & Médical',
    energy:'Énergie & Environnement', industry:'Industrie', product:'Produit & Innovation',
  };
  const typeLabel = typeLabels[docType] || typeLabels[domain] || 'Rapport';

  // ── Stratégie visuelle intelligente ───────────────────────────────────────
  const vs = detectVisualStrategy(data);

  // ── Analyses automatiques ──────────────────────────────────────────────────
  const analyseGlobale     = genAnalyseGlobale(data);
  const analyseIndicateurs = genAnalyseChartIndicateurs(data);
  const analyseRepartition = genAnalyseChartRepartition(data);
  const analyseEvolution   = vs.hasEvolution ? genAnalyseChartEvolution(data) : '';
  const analyseSynthese    = genAnalyseSynthese(data);

  // ── KPI cards avec compteur animé ──────────────────────────────────────────
  const kpiCards = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 6).map((s, i) => {
    const dec    = s.unit === '%' || String(s.numericValue).includes('.') ? 2 : 0;
    const target = parseFloat(s.numericValue);
    const disp   = target >= 1e6 ? (target / 1e6).toFixed(2).replace('.', ',') + ' M' : String(Math.round(target));
    return `
      <div class="kpi-card reveal" style="transition-delay:${i * 0.08}s">
        <div class="kpi-icon">${esc(s.icon || '📊')}</div>
        <div class="kpi-value">
          <span class="counter" data-target="${target}" data-decimals="${dec}">${disp}</span>
          <span class="kpi-unit">${esc(s.unit)}</span>
        </div>
        <div class="kpi-label">${esc(s.label)}</div>
        ${s.trend ? `<div class="kpi-trend">${s.trend.startsWith('+') ? '▲' : '▼'} ${esc(s.trend)}</div>` : ''}
      </div>`;
  }).join('');

  // ── Hero meta (3 stats mini) ──────────────────────────────────────────────
  const heroMeta = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 3).map(s => {
    const dec = s.unit === '%' || String(s.numericValue).includes('.') ? 2 : 0;
    return `<div class="hero-meta-item">
        <span class="hero-meta-label">${esc(s.label)}</span>
        <span class="hero-meta-value">
          <span class="counter" data-target="${parseFloat(s.numericValue)}" data-decimals="${dec}">0</span>
          <small style="font-size:.7em;opacity:.7"> ${esc(s.unit)}</small>
        </span>
      </div>`;
  }).join('');

  // ── Points clés (findings) — filtrés : pas de contenu TOC ou trop court ─────
  const goodPts = keyPoints.filter(p => p.trim().length > 30 &&
    !/^\d+\s*\./.test(p.trim()) &&
    !/^(parc global|repartition|trafic|évolution du marché|observatoire)/i.test(p.trim().substring(0, 50)));
  const findings = goodPts.slice(0, 6).map((pt, i) => `
      <div class="finding-item reveal" style="transition-delay:${i * 0.07}s">
        <span class="finding-bullet">✦</span>
        <span>${esc(pt)}</span>
      </div>`).join('');

  // ── Synthèse cards ────────────────────────────────────────────────────────
  const synthCards = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 3).map((s, i) => {
    const pts = keyPoints[i] || '';
    return `
      <div class="synth-card reveal" style="transition-delay:${i * 0.1}s">
        <div class="synth-chiffre">
          <span class="counter" data-target="${parseFloat(s.numericValue)}" data-decimals="${s.unit === '%' ? 2 : 0}">0</span>
          <small> ${esc(s.unit)}</small>
        </div>
        <div class="synth-label">${esc(s.label)}</div>
        ${pts ? `<p class="synth-desc">${esc(pts.substring(0, 150))}</p>` : ''}
      </div>`;
  }).join('');

  // ── Sections textuelles — filtrées intelligemment par stratégie ─────────
  const sectionsHTML = vs.goodSects.slice(0, 3).map((s, i) => `
  <section class="section section-doc${i % 2 ? ' section-alt' : ''}" id="section-${i}">
    <div class="container">
      <div class="data-block glass-card reveal">
        <span class="data-block-eyebrow">Extrait · Document source</span>
        <h3>${esc(s.title)}</h3>
        <p class="section-analysis">${esc(s.body)}</p>
      </div>
    </div>
  </section>`).join('');

  // ── Navigation — conditionnelle selon données disponibles ─────────────────
  const navItems = [
    vs.hasKPIs                      ? ['#vue-ensemble', 'Vue d\'ensemble'] : null,
    vs.hasIndicateurs               ? ['#indicateurs',  'Indicateurs']     : null,
    vs.hasEvolution                 ? ['#evolution',    'Évolution']       : null,
    vs.hasRepartition               ? ['#repartition',  'Répartition']     : null,
    vs.hasSynthese                  ? ['#synthese',     'Synthèse']        : null,
  ].filter(Boolean).map(([href, label]) =>
    `<li><a href="${href}">${label}</a></li>`
  ).join('\n        ');

  // ── Domain-specific chart sections ────────────────────────────────────────
  const domainChartSections = {
    finance: `
<section class="section section-alt" id="domain-charts">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">Finance · Analyse avancée</span>
      <h2 class="display-2">Indicateurs <em class="gold">financiers</em></h2>
    </div>
    <div class="chart-card glass-card chart-wide reveal">
      <h3 class="chart-title">Évolution &amp; Tendance</h3>
      <div class="chart-wrap tall"><canvas id="chart-line-area"></canvas></div>
    </div>
    <div class="charts-row charts-2col" style="margin-top:1.5rem">
      <div class="chart-card glass-card reveal"><h3 class="chart-title">Barres empilées</h3><div class="chart-wrap"><canvas id="chart-stacked"></canvas></div></div>
      <div class="chart-card glass-card reveal" style="transition-delay:.1s"><h3 class="chart-title">Radar multidimensionnel</h3><div class="chart-wrap"><canvas id="chart-radar"></canvas></div></div>
    </div>
  </div>
</section>
<div class="divider"></div>`,
    satellite: `
<section class="section section-alt" id="domain-charts">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">Satellite · Analyse spatiale</span>
      <h2 class="display-2">Données <em class="gold">orbitales</em></h2>
    </div>
    <div class="charts-row charts-2col">
      <div class="chart-card glass-card reveal"><h3 class="chart-title">Corrélation orbitale</h3><div class="chart-wrap"><canvas id="chart-scatter"></canvas></div></div>
      <div class="chart-card glass-card reveal" style="transition-delay:.1s"><h3 class="chart-title">Vue polaire</h3><div class="chart-wrap"><canvas id="chart-polar"></canvas></div></div>
    </div>
    <div class="chart-card glass-card chart-wide reveal" style="margin-top:1.5rem">
      <h3 class="chart-title">Radar de couverture</h3>
      <div class="chart-wrap"><canvas id="chart-radar"></canvas></div>
    </div>
  </div>
</section>
<div class="divider"></div>`,
    health: `
<section class="section section-alt" id="domain-charts">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">Santé · Analyse clinique</span>
      <h2 class="display-2">Indicateurs <em class="gold">médicaux</em></h2>
    </div>
    <div class="chart-card glass-card chart-wide reveal">
      <h3 class="chart-title">Distribution démographique</h3>
      <div class="chart-wrap tall"><canvas id="chart-stacked"></canvas></div>
    </div>
    <div class="charts-row charts-2col" style="margin-top:1.5rem">
      <div class="chart-card glass-card reveal"><h3 class="chart-title">Tendance</h3><div class="chart-wrap"><canvas id="chart-line-area"></canvas></div></div>
      <div class="chart-card glass-card reveal" style="transition-delay:.1s"><h3 class="chart-title">Radar clinique</h3><div class="chart-wrap"><canvas id="chart-radar"></canvas></div></div>
    </div>
  </div>
</section>
<div class="divider"></div>`,
    energy: `
<section class="section section-alt" id="domain-charts">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">Énergie · Analyse sectorielle</span>
      <h2 class="display-2">Mix <em class="gold">énergétique</em></h2>
    </div>
    <div class="chart-card glass-card chart-wide reveal">
      <h3 class="chart-title">Évolution énergétique</h3>
      <div class="chart-wrap tall"><canvas id="chart-line-area"></canvas></div>
    </div>
    <div class="charts-row charts-2col" style="margin-top:1.5rem">
      <div class="chart-card glass-card reveal"><h3 class="chart-title">Mix énergétique</h3><div class="chart-wrap"><canvas id="chart-stacked"></canvas></div></div>
      <div class="chart-card glass-card reveal" style="transition-delay:.1s"><h3 class="chart-title">Radar performance</h3><div class="chart-wrap"><canvas id="chart-radar"></canvas></div></div>
    </div>
  </div>
</section>
<div class="divider"></div>`,
    product: `
<section class="section section-alt" id="domain-charts">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">Produit · Analyse marché</span>
      <h2 class="display-2">Positionnement <em class="gold">produit</em></h2>
    </div>
    <div class="charts-row charts-2col">
      <div class="chart-card glass-card reveal"><h3 class="chart-title">Radar produit</h3><div class="chart-wrap"><canvas id="chart-radar"></canvas></div></div>
      <div class="chart-card glass-card reveal" style="transition-delay:.1s"><h3 class="chart-title">Part de marché</h3><div class="chart-wrap"><canvas id="chart-barh"></canvas></div></div>
    </div>
  </div>
</section>
<div class="divider"></div>`,
    industry: `
<section class="section section-alt" id="domain-charts">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">Industrie · Analyse sectorielle</span>
      <h2 class="display-2">Performance <em class="gold">industrielle</em></h2>
    </div>
    <div class="charts-row charts-2col">
      <div class="chart-card glass-card reveal"><h3 class="chart-title">Radar performance</h3><div class="chart-wrap"><canvas id="chart-radar"></canvas></div></div>
      <div class="chart-card glass-card reveal" style="transition-delay:.1s"><h3 class="chart-title">Distribution sectorielle</h3><div class="chart-wrap"><canvas id="chart-stacked"></canvas></div></div>
    </div>
  </div>
</section>
<div class="divider"></div>`,
  };
  const domainChartsHTML = domainChartSections[domain] || '';

  // ── Titre H1 — découpe en 2-3 lignes pour l'effet éditorial ──────────────
  const words   = title.split(' ');
  const line1   = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const line2   = words.slice(Math.ceil(words.length / 2), Math.ceil(words.length * 0.8)).join(' ');
  const line3   = words.slice(Math.ceil(words.length * 0.8)).join(' ');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — Algeria Tech</title>
  <meta name="description" content="${esc(subtitle || title)} · ${esc(typeLabel)} · ${esc(date)}">
  <meta name="theme-color" content="#0a0e1a">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(subtitle || analyseGlobale.substring(0, 160))}">
  <meta property="og:type" content="website">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=JetBrains+Mono:wght@400;500;700&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/styles.css">

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js" defer></script>
  <script>setTimeout(function(){var l=document.getElementById('loader');if(l&&!l.classList.contains('hidden'))l.classList.add('hidden');},6000);</script>
</head>
<body>

${genBgPhotoHTML(bgTheme, bgImage)}
<!-- LOADER -->
<div id="loader" role="status">
  <div class="loader-content">
    <div class="loader-mark"></div>
    <div class="loader-text">Algeria Tech · ${esc(typeLabel)}</div>
    <div class="loader-bar"></div>
  </div>
</div>

<!-- TOPBAR -->
<header class="topbar">
  <div class="container topbar-inner">
    <a href="/infographies/" class="brand">
      <span class="brand-mark">A</span>
      <span><em>Algeria Tech</em> · ${esc(typeLabel)}</span>
    </a>
    <nav aria-label="Sections">
      <ul class="section-nav">
        ${navItems}
      </ul>
    </nav>
    <div class="topbar-actions">
      <button id="btn-share" class="btn btn-ghost" aria-label="Partager">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
      <button id="btn-export-pdf" class="btn btn-gold">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        PDF
      </button>
    </div>
  </div>
</header>

<main id="mc">

<!-- ── HERO ─────────────────────────────────────────────────────────────────── -->
<section class="section hero" id="hero">
  <div class="hero-inner">
    <div class="hero-content reveal">
      <span class="eyebrow">── ${esc(source || 'Algeria Tech')} · ${esc(date)} ──</span>
      <h1 class="display-1">
        ${esc(line1)}${line2 ? `<br><em class="gold">${esc(line2)}</em>` : ''}${line3 ? `<br>${esc(line3)}` : ''}
      </h1>
      ${subtitle ? `<p class="lead">${esc(subtitle)}</p>` : ''}
      <p class="hero-analyse reveal">${esc(analyseGlobale)}</p>
      <div class="hero-meta">
        ${heroMeta}
        <div class="hero-meta-item">
          <span class="hero-meta-label">Période</span>
          <span class="hero-meta-value">${esc(date)}</span>
        </div>
        <div class="hero-meta-item">
          <span class="hero-meta-label">Type</span>
          <span class="hero-meta-value">${esc(typeLabel)}</span>
        </div>
      </div>
      <div class="hero-cta">
        <a href="#vue-ensemble" class="btn btn-gold">Explorer les données →</a>
        <a href="#synthese" class="btn btn-ghost">Points clés</a>
      </div>
    </div>
    <div class="hero-visual">
      <div id="scene3d" class="scene3d-container"></div>
      <div class="scene-hint">🖱 Glisser · Zoomer · Survoler pour les KPIs</div>
    </div>
  </div>
</section>
<div class="divider"></div>

${vs.hasKPIs ? `
<!-- ── VUE D'ENSEMBLE (KPIs) ─────────────────────────────────────────────────── -->
<section class="section" id="vue-ensemble">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">01 · Vue d'ensemble</span>
      <h2 class="display-2">Indicateurs <span class="gold">clés</span></h2>
      <p class="lead">Métriques extraites automatiquement depuis le document source · ${esc(source || title.substring(0, 40))}.</p>
    </div>
    <div class="kpi-grid">${kpiCards}</div>
  </div>
</section>
<div class="divider"></div>
` : ''}

${vs.hasIndicateurs ? `
<!-- ── INDICATEURS ───────────────────────────────────────────────────────────── -->
<section class="section section-alt" id="indicateurs">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">02 · Analyse</span>
      <h2 class="display-2">Indicateurs <em class="gold">détaillés</em></h2>
      <p class="lead chart-analysis">${esc(analyseIndicateurs)}</p>
    </div>
    <div class="charts-row charts-2col">
      <div class="chart-card glass-card reveal">
        <h3 class="chart-title">${vs.preferDonut ? 'Répartition par catégorie' : 'Valeurs par indicateur'}</h3>
        <div class="chart-wrap tall"><canvas id="chart-indicateurs"></canvas></div>
      </div>
      <div class="chart-card glass-card reveal" style="transition-delay:.1s">
        <h3 class="chart-title">Analyse comparative · valeurs & parts relatives</h3>
        <div class="chart-wrap tall"><canvas id="chart-comparatif"></canvas></div>
      </div>
    </div>
  </div>
</section>
<div class="divider"></div>
` : ''}

${vs.hasEvolution ? `
<!-- ── ÉVOLUTION ─────────────────────────────────────────────────────────────── -->
<section class="section" id="evolution">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">03 · Évolution temporelle</span>
      <h2 class="display-2">Tendance <span class="gold">temporelle</span></h2>
      <p class="lead chart-analysis">${esc(analyseEvolution)}</p>
    </div>
    <div class="chart-card glass-card chart-wide reveal">
      <h3 class="chart-title">${esc(data.chartData.label || 'Évolution')} avec moyenne mobile</h3>
      <div class="chart-wrap tall"><canvas id="chart-evolution"></canvas></div>
    </div>
  </div>
</section>
<div class="divider"></div>
` : ''}

${vs.hasRepartition ? `
<!-- ── RÉPARTITION ───────────────────────────────────────────────────────────── -->
<section class="section${vs.hasEvolution ? ' section-alt' : ''}" id="repartition">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">${vs.hasEvolution ? '04' : '03'} · Répartition</span>
      <h2 class="display-2">Distribution <em class="gold">relative</em></h2>
      <p class="lead chart-analysis">${esc(analyseRepartition)}</p>
    </div>
    <div class="charts-row charts-2col">
      <div class="chart-card glass-card reveal">
        <h3 class="chart-title">Répartition proportionnelle ${vs.preferDonut ? '(parts de marché %)' : '(valeurs relatives)'}</h3>
        <div class="chart-wrap"><canvas id="chart-repartition"></canvas></div>
      </div>
      <div class="chart-card glass-card reveal" style="transition-delay:.1s">
        <h3 class="chart-title">Indicateur dominant vs reste du marché</h3>
        <div class="chart-wrap"><canvas id="chart-distribution"></canvas></div>
      </div>
    </div>
    <div class="chart-card glass-card chart-wide reveal" style="margin-top:1.5rem">
      <h3 class="chart-title">Comparaison horizontale</h3>
      <div class="chart-wrap"><canvas id="chart-barh"></canvas></div>
    </div>
  </div>
</section>
<div class="divider"></div>
` : ''}

${findings ? `
<!-- ── POINTS CLÉS ───────────────────────────────────────────────────────────── -->
<section class="section" id="analyse">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">Synthèse · Points clés</span>
      <h2 class="display-2">Éléments <em class="gold">essentiels</em></h2>
      <p class="lead">Extraits automatiquement du document source · ${esc(source || '')}.</p>
    </div>
    <div class="findings-grid">${findings}</div>
  </div>
</section>
<div class="divider"></div>
` : ''}

${synthCards ? `
<!-- ── SYNTHÈSE ──────────────────────────────────────────────────────────────── -->
<section class="section section-alt" id="synthese">
  <div class="container">
    <div class="section-header reveal">
      <span class="eyebrow">Conclusions</span>
      <h2 class="display-2">Synthèse <span class="gold">finale</span></h2>
      <p class="lead chart-analysis">${esc(analyseSynthese)}</p>
    </div>
    <div class="synth-grid">${synthCards}</div>
  </div>
</section>
<div class="divider"></div>
` : ''}

${sectionsHTML}

${domainChartsHTML}

<!-- ── FOOTER PREMIUM ────────────────────────────────────────────────────────── -->
<footer class="footer-premium">
  <div class="container">
    <div class="footer-glass">
      <div class="footer-col footer-col-brand">
        <div class="footer-logo">
          <span class="footer-logo-mark">✦</span>
          <span>Algeria<em>Tech</em></span>
        </div>
        <p class="footer-tagline">Moteur BI Premium · Three.js · Chart.js · v4</p>
        <div class="footer-badges">
          <span class="footer-badge">🔒 Données locales</span>
          <span class="footer-badge">📊 Chart.js 4</span>
          <span class="footer-badge">🌐 Three.js 0.160</span>
        </div>
      </div>
      <div class="footer-col footer-col-meta">
        <h4 class="footer-col-title">Informations source</h4>
        <dl class="footer-dl">
          <dt>Document</dt><dd>${esc(source || title.substring(0, 50))}</dd>
          <dt>Période</dt><dd>${esc(date)}</dd>
          <dt>Domaine</dt><dd>${esc(typeLabel)}</dd>
          <dt>Généré le</dt><dd>${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}</dd>
        </dl>
      </div>
      <div class="footer-col footer-col-actions">
        <h4 class="footer-col-title">Exporter</h4>
        <div class="footer-action-btns">
          <button id="btn-export-json" class="btn btn-ghost footer-action-btn">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M17 13l-5 5-5-5"/><path d="M12 18V4M7 9H4a1 1 0 00-1 1v6a1 1 0 001 1h12a1 1 0 001-1v-6a1 1 0 00-1-1h-3"/></svg>
            JSON
          </button>
          <button id="btn-export-pdf-f" class="btn btn-ghost footer-action-btn" onclick="document.getElementById('btn-export-pdf')?.click()">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10h6M10 7v6"/></svg>
            PDF
          </button>
        </div>
        <p class="footer-legal">Infographie générée automatiquement par Algeria Tech Generator v4. Aucune donnée n'est transmise à des serveurs externes.</p>
      </div>
    </div>
    <div class="footer-bottom-bar">
      <span>© ${new Date().getFullYear()} Algeria Tech · Tous droits réservés</span>
      <span>Algeria Tech Generator v4 · BI Premium</span>
    </div>
  </div>
</footer>

</main>

<!-- FAB -->
<div class="fab-stack">
  <button id="fab-top" class="fab" title="Haut de page">↑</button>
  <button id="fab-fullscreen" class="fab" title="Plein écran">⛶</button>
</div>

<script type="module" src="assets/js/main.js"></script>
</body>
</html>
`;
}

// ─── CSS — Blueprint + composants premium ─────────────────────────────────────

function genExtraCSS() {
  const blueprintCSS = fs.readFileSync(
    path.join(BLUEPRINT, 'assets', 'css', 'styles.css'), 'utf8'
  );

  return blueprintCSS + `

/* ═══════════════════════════════════════════════════════════════
   Algeria Tech Generator v3 — Composants Premium
   ═══════════════════════════════════════════════════════════════ */

/* ── Hero split-screen 50/50 strict — edge to edge ──────────────────────────── */
.section.hero {
  padding: 0 !important;   /* annule .hero{padding-top:clamp(6rem,...)} du blueprint */
  overflow: hidden;
  display: block !important;  /* annule .hero{display:grid;grid-template-columns:1.2fr 1fr} du blueprint */
  width: 100%;
}

.hero-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;   /* 50 / 50 strict */
  grid-template-rows: 1fr;
  gap: 0;                            /* aucun espace entre colonnes */
  align-items: stretch;              /* les deux colonnes font la même hauteur */
  min-height: calc(100vh - 64px);
  width: 100%;                       /* pleine largeur — pas de container max-width */
}

/* Colonne gauche — texte avec padding interne */
.hero-content {
  padding: 4.5rem clamp(1.5rem, 3vw, 3.5rem) 3rem clamp(1.5rem, 4vw, 5rem);
  min-width: 0;                      /* KEY : empêche le texte de repousser la colonne */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
}

/* Colonne droite — 3D bord à bord */
.hero-visual {
  min-width: 0;                      /* KEY : empêche la scène 3D de déborder */
  position: relative;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(212,164,55,.1);
  overflow: hidden;
}

@media (max-width: 900px) {
  .hero-inner {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }
  .hero-content { padding: 3rem 1.5rem 2rem; }
  .hero-visual { order: -1; min-height: 320px; border-left: none; border-bottom: 1px solid rgba(212,164,55,.1); }
}

/* ── H1 display-1 — taille équilibrée 50/50 ─────────────────────────────────── */
.display-1 {
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 3vw, 2.6rem);
  font-weight: 400;
  font-style: italic;
  line-height: 1.1;
  color: var(--cream-100);
  margin-bottom: 1.2rem;
  letter-spacing: -0.015em;
  max-width: 52ch;
}
.display-2 {
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  font-weight: 400;
  line-height: 1.12;
  color: var(--cream-100);
  margin-bottom: 0.9rem;
}

/* ── Analyse globale sous le titre ──────────────────────────────────────────── */
.hero-analyse {
  font-size: .92rem;
  line-height: 1.8;
  color: var(--slate-300);
  max-width: 58ch;
  margin: 1rem 0 1.5rem;
  padding: 1rem 1.2rem;
  background: rgba(212,164,55,.06);
  border-left: 3px solid var(--gold-500);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

/* ── Analyse sous les graphiques ─────────────────────────────────────────────── */
.chart-analysis {
  font-size: .88rem;
  line-height: 1.75;
  color: var(--slate-300);
  max-width: 70ch;
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(45,138,95,.05);
  border-left: 2px solid var(--emerald-500);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

/* ── Sections textuelles ─────────────────────────────────────────────────────── */
.section-analysis {
  font-size: .9rem;
  line-height: 1.8;
  color: var(--slate-300);
}

/* ── Hero CTA ────────────────────────────────────────────────────────────────── */
.hero-cta {
  display: flex;
  gap: 1rem;
  margin-top: 1.8rem;
  flex-wrap: wrap;
}

/* ── Hero méta ────────────────────────────────────────────────────────────────── */
.hero-meta {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}
.hero-meta-item { display: flex; flex-direction: column; gap: .2rem; }
.hero-meta-label {
  font-family: var(--font-mono);
  font-size: .62rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--slate-400);
}
.hero-meta-value {
  font-family: var(--font-mono);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--gold-500);
  line-height: 1;
}

/* ── Scene 3D — remplit toute la colonne droite ──────────────────────────────── */
.scene3d-container {
  flex: 1;                           /* s'étend pour remplir toute la hauteur de .hero-visual */
  width: 100%;
  min-height: 480px;
  border-radius: 0;                  /* bord à bord dans la colonne */
  overflow: hidden;
  background: var(--ink-800);
  /* Lueur subtile sur le bord gauche uniquement */
  box-shadow: inset 4px 0 24px rgba(212,164,55,.06);
}
@media (max-width: 900px) { .scene3d-container { min-height: 320px; } }
.scene-hint {
  position: absolute;
  bottom: .8rem; left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: .6rem;
  letter-spacing: .1em;
  color: var(--slate-400);
  opacity: .6;
  white-space: nowrap;
  pointer-events: none;
}

/* ── Section header ──────────────────────────────────────────────────────────── */
.section-header { margin-bottom: 2rem; }

/* ── Divider — trait doré discret entre sections ─────────────────────────────── */
.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(212,164,55,.18) 20%, rgba(212,164,55,.18) 80%, transparent 100%);
  margin: 0;
  display: block;
}

/* ── KPI Grid ────────────────────────────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1px;
  background: rgba(212,164,55,.08);
  border: 1px solid rgba(212,164,55,.08);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-top: 2rem;
}
.kpi-card {
  padding: 1.8rem 1.6rem;
  background: var(--ink-800);
  position: relative;
  overflow: hidden;
  transition: background .2s;
}
.kpi-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: var(--gold-500);
  transform: scaleX(0);
  transition: transform .4s var(--ease-out-expo);
}
.kpi-card:hover { background: rgba(212,164,55,.06); }
.kpi-card:hover::after { transform: scaleX(1); }
.kpi-icon { font-size: 1.4rem; margin-bottom: .6rem; }
.kpi-value {
  font-family: var(--font-mono);
  font-size: 2rem; font-weight: 700;
  color: var(--gold-500); line-height: 1; margin-bottom: .4rem;
}
.kpi-unit { font-size: .85rem; font-weight: 400; opacity: .7; margin-left: .15rem; }
.kpi-label {
  font-family: var(--font-mono);
  font-size: .65rem; letter-spacing: .1em;
  text-transform: uppercase; color: var(--slate-300); margin-bottom: .3rem;
}
.kpi-trend { font-family: var(--font-mono); font-size: .72rem; color: var(--emerald-400); }

/* ── Charts ──────────────────────────────────────────────────────────────────── */
.charts-row { display: flex; gap: 1.5rem; margin-top: 2rem; flex-wrap: wrap; }
.charts-2col > * { flex: 1; min-width: 280px; }
.chart-card {
  background: var(--ink-800);
  border: 1px solid rgba(212,164,55,.08);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  box-shadow: var(--shadow-card);
}
.chart-wide { width: 100%; margin-top: 1.5rem; }
.chart-title {
  font-family: var(--font-mono);
  font-size: .72rem; letter-spacing: .1em;
  text-transform: uppercase; color: var(--slate-300); margin-bottom: 1rem;
}
.chart-wrap { position: relative; height: 260px; }
.chart-wrap.tall { height: 320px; }

/* ── Findings ────────────────────────────────────────────────────────────────── */
.findings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem; margin-top: 2rem;
}
.finding-item {
  display: flex; gap: .75rem; align-items: flex-start;
  padding: 1rem 1.2rem;
  background: var(--ink-800);
  border: 1px solid rgba(212,164,55,.08);
  border-radius: var(--radius-md);
  font-size: .88rem; line-height: 1.7;
  transition: border-color .2s, transform .18s;
}
.finding-item:hover { border-color: rgba(212,164,55,.3); transform: translateX(4px); }
.finding-bullet { color: var(--gold-500); flex-shrink: 0; margin-top: .15rem; }

/* ── Synthèse ────────────────────────────────────────────────────────────────── */
.synth-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem; margin-top: 2rem;
}
.synth-card {
  background: var(--ink-800);
  border: 1px solid rgba(212,164,55,.12);
  border-radius: var(--radius-lg);
  padding: 2rem 1.8rem;
  box-shadow: var(--shadow-card);
}
.synth-chiffre {
  font-family: var(--font-mono);
  font-size: 2.4rem; font-weight: 700;
  color: var(--gold-500); line-height: 1; margin-bottom: .6rem;
}
.synth-label {
  font-size: .85rem; font-weight: 600; color: var(--cream-100);
  margin-bottom: .6rem; text-transform: uppercase; letter-spacing: .06em;
  font-family: var(--font-mono);
}
.synth-desc { font-size: .84rem; color: var(--slate-300); line-height: 1.7; }

/* ── Glassmorphism — carte générique ─────────────────────────────────────────── */
.glass-card {
  background: rgba(17, 23, 41, 0.72) !important;
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border: 1px solid rgba(212,164,55,.14) !important;
  box-shadow: 0 8px 32px rgba(0,0,0,.38), inset 0 1px 0 rgba(212,164,55,.08) !important;
  transition: border-color .25s, box-shadow .25s, transform .2s;
}
.glass-card:hover {
  border-color: rgba(212,164,55,.28) !important;
  box-shadow: 0 12px 40px rgba(0,0,0,.45), 0 0 0 1px rgba(212,164,55,.1) inset !important;
  transform: translateY(-2px);
}

/* ── Data block (sections document source) ───────────────────────────────────── */
.section-doc { padding: clamp(2rem, 5vw, 3.5rem) 0; }

.data-block {
  background: var(--ink-800);
  border: 1px solid rgba(212,164,55,.08);
  border-radius: var(--radius-md);
  padding: 2rem;
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}
.data-block::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--gold-500), transparent 70%);
  opacity: .5;
}
.data-block h3 {
  font-family: var(--font-display);
  font-size: 1.2rem; color: var(--gold-500); margin-bottom: .6rem;
}
.data-block-eyebrow {
  font-family: var(--font-mono);
  font-size: .6rem; letter-spacing: .12em; text-transform: uppercase;
  color: var(--slate-400); margin-bottom: .5rem; display: block;
}

/* ── Footer Premium ──────────────────────────────────────────────────────────── */
.footer-premium {
  background: linear-gradient(180deg, transparent 0%, rgba(10,14,26,.98) 20%);
  border-top: 1px solid rgba(212,164,55,.12);
  padding: 0;
  position: relative;
  margin-top: 0;
}
.footer-premium::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-500), transparent);
  opacity: .4;
}
.footer-glass {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 2.5rem;
  padding: 3rem 0 2rem;
  border-bottom: 1px solid rgba(255,255,255,.05);
}
@media (max-width: 900px) {
  .footer-glass { grid-template-columns: 1fr; gap: 2rem; padding: 2rem 0 1.5rem; }
}
.footer-col {}
.footer-col-title {
  font-family: var(--font-mono); font-size: .65rem;
  letter-spacing: .12em; text-transform: uppercase;
  color: var(--gold-500); margin-bottom: 1rem;
}
.footer-logo {
  display: flex; align-items: center; gap: .5rem;
  font-family: var(--font-display); font-size: 1.3rem;
  color: var(--cream-100); margin-bottom: .6rem;
}
.footer-logo-mark { color: var(--gold-500); font-size: 1.1rem; }
.footer-tagline {
  font-family: var(--font-mono); font-size: .72rem;
  color: var(--slate-400); margin-bottom: 1rem;
}
.footer-badges { display: flex; flex-wrap: wrap; gap: .4rem; }
.footer-badge {
  font-family: var(--font-mono); font-size: .6rem;
  padding: .3rem .6rem;
  background: rgba(212,164,55,.08);
  border: 1px solid rgba(212,164,55,.16);
  border-radius: 4px; color: var(--slate-300);
  letter-spacing: .04em;
}
.footer-dl {
  display: grid; grid-template-columns: auto 1fr; gap: .35rem 1rem;
  font-size: .75rem; font-family: var(--font-mono);
}
.footer-dl dt { color: var(--slate-400); white-space: nowrap; }
.footer-dl dd { color: var(--cream-100); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.footer-action-btns { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1rem; }
.footer-action-btn {
  display: flex; align-items: center; gap: .5rem;
  font-size: .75rem !important; justify-content: flex-start;
}
.footer-legal { font-size: .68rem; color: var(--slate-500); line-height: 1.6; margin-top: .5rem; }
.footer-bottom-bar {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
  gap: 1rem; padding: 1rem 0;
  font-family: var(--font-mono); font-size: .62rem; color: var(--slate-500); letter-spacing: .05em;
}

/* ── Compatibilité ancienne classe .footer ───────────────────────────────────── */
.footer { display: none; }
.footer-inner, .footer-brand, .footer-mark, .footer-copy, .footer-meta, .footer-actions { display: none; }

/* ── Toast ───────────────────────────────────────────────────────────────────── */
.toast {
  position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999;
  padding: .7rem 1.2rem; border-radius: var(--radius-md);
  font-size: .82rem; font-family: var(--font-mono); color: white;
  opacity: 0; transform: translateY(8px); transition: all .25s; pointer-events: none;
}
.toast.show { opacity: 1; transform: translateY(0); }

/* ── Reveal ──────────────────────────────────────────────────────────────────── */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity .7s var(--ease-out-expo), transform .7s var(--ease-out-expo);
}
.reveal.in { opacity: 1; transform: none; }

/* ── Loader ──────────────────────────────────────────────────────────────────── */
#loader {
  position: fixed; inset: 0; z-index: 9999;
  background: var(--ink-900);
  display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 1.4rem;
  transition: opacity .6s, visibility .6s;
}
#loader.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
.loader-content { display: flex; flex-direction: column; align-items: center; gap: 1.2rem; }
.loader-mark {
  width: 44px; height: 44px;
  border: 2px solid var(--ink-600);
  border-top-color: var(--gold-500);
  border-radius: 50%;
  animation: spin .85s linear infinite;
}
.loader-text {
  font-family: var(--font-mono); font-size: .72rem;
  letter-spacing: .12em; text-transform: uppercase; color: var(--gold-500);
}
.loader-bar {
  width: 180px; height: 2px;
  background: var(--ink-600); border-radius: 99px; overflow: hidden;
}
.loader-bar::after {
  content: ''; display: block; height: 100%;
  background: var(--gold-500);
  animation: lfill 1.8s ease-in-out forwards;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes lfill { 0%{width:0} 75%{width:88%} 100%{width:100%} }

/* ── FAB ─────────────────────────────────────────────────────────────────────── */
.fab-stack {
  position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 50;
  display: flex; flex-direction: column; gap: .5rem;
}
.fab {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: var(--ink-700);
  border: 1px solid rgba(212,164,55,.2);
  color: var(--gold-500); font-size: .9rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .2s;
}
.fab:hover { background: var(--gold-500); color: var(--ink-900); border-color: var(--gold-500); }

/* ═══════════════════════════════════════════════════════════════
   Surcharges lisibilité — texte blanc + tailles agrandies
   ═══════════════════════════════════════════════════════════════ */

/* Texte blanc — corps uniquement (pas les titres/sous-titres) */
p, li, td, th,
.section-analysis, .data-block p, .section-doc p, .analysis-block p,
.kpi-label, .kpi-unit, .hero-meta-label,
.eyebrow, .chart-title,
.topbar a, .brand, .section-nav a { color: #ffffff !important; }

/* KPI — tailles réduites de moitié par rapport à avant */
.kpi-value { font-size: clamp(1.1rem, 2vw, 1.6rem) !important; }
.kpi-label { font-size: .88rem !important; }
.hero-meta-value { font-size: clamp(.95rem, 1.4vw, 1.2rem) !important; }
.hero-meta-label { font-size: .8rem !important; }

/* Corps de texte — légèrement agrandi */
p, li, .section-analysis, .analysis-block p { font-size: clamp(.95rem, 1.3vw, 1.1rem) !important; line-height: 1.75 !important; }
.eyebrow { font-size: .82rem !important; }
.chart-title { font-size: 1rem !important; }
`;
}

// ─── Génération thumbnail SVG ──────────────────────────────────────────────────

function genThumbnailSVG(title, pal) {
  const c1 = pal[0] || '#D4A437';
  const c2 = pal[1] || '#2D8A5F';
  const shortTitle = title.substring(0, 48);
  const line1 = shortTitle.substring(0, 24);
  const line2 = shortTitle.length > 24 ? shortTitle.substring(24, 48) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0e1a"/>
      <stop offset="100%" style="stop-color:#111729"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="100%" style="stop-color:${c2}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="560" width="1200" height="4" fill="url(#accent)"/>
  <rect x="80" y="80" width="4" height="80" fill="${c1}" opacity=".6"/>
  <text x="104" y="118" font-family="Georgia,serif" font-size="13" fill="${c1}" letter-spacing="4" opacity=".8" text-transform="uppercase">ALGERIA TECH · INFOGRAPHIE INTERACTIVE</text>
  <text x="100" y="240" font-family="Georgia,serif" font-size="48" font-style="italic" fill="#f4ede0" font-weight="400">${line1}</text>
  ${line2 ? `<text x="100" y="302" font-family="Georgia,serif" font-size="48" font-style="italic" fill="${c1}" font-weight="400">${line2}</text>` : ''}
  <text x="100" y="400" font-family="monospace" font-size="14" fill="#94a3b8" letter-spacing="2">Three.js 3D · Chart.js · Raycaster · Export PDF</text>
  <circle cx="1060" cy="290" r="120" fill="${c1}" opacity=".04"/>
  <circle cx="1060" cy="290" r="80" fill="${c1}" opacity=".06"/>
  <circle cx="1060" cy="290" r="45" fill="${c1}" opacity=".12"/>
  <circle cx="1060" cy="290" r="18" fill="${c1}" opacity=".7"/>
  <text x="100" y="580" font-family="monospace" font-size="12" fill="#64748b">Algeria Tech Generator v3 · ${new Date().getFullYear()}</text>
</svg>`;
}

// ─── Template de slides animés ────────────────────────────────────────────────

function getTplDecoCSS(tpl, t) {
  const d = {
    techblue: `
.deco-bg { position:fixed; inset:0; z-index:1; pointer-events:none; overflow:hidden; }
.deco-bg::before { content:''; position:absolute; top:8%; right:4%; width:42vw; height:55vh;
  background:radial-gradient(circle, ${t.accent}1a 0%, transparent 68%);
  animation:pulse 5s ease-in-out infinite; }
.deco-bg::after { content:''; position:absolute; bottom:8%; left:3%; width:32vw; height:38vh;
  background:radial-gradient(circle, ${t.accent2}14 0%, transparent 68%);
  animation:pulse 6s ease-in-out infinite .8s; }`,
    diamond: `
.deco-bg { position:fixed; inset:0; z-index:1; pointer-events:none; overflow:hidden; }
.deco-bg::before { content:'◆'; position:absolute; top:12%; right:6%; font-size:9rem;
  color:${t.accent}; opacity:.05; transform:rotate(12deg); }
.deco-bg::after { content:'◆'; position:absolute; bottom:12%; left:4%; font-size:13rem;
  color:${t.accent2}; opacity:.04; transform:rotate(-18deg); }`,
    gradient: `
.deco-bg { position:fixed; inset:0; z-index:1; pointer-events:none; overflow:hidden; }
.deco-bg::before { content:''; position:absolute; top:-15%; right:-8%; width:55vw; height:55vw;
  border-radius:50%; background:radial-gradient(circle, ${t.accent}1e 0%, transparent 65%);
  animation:pulse 7s ease-in-out infinite; }
.deco-bg::after { content:''; position:absolute; bottom:-15%; left:-8%; width:45vw; height:45vw;
  border-radius:50%; background:radial-gradient(circle, ${t.accent2}18 0%, transparent 65%);
  animation:pulse 8s ease-in-out infinite .6s; }`,
    annual: `
.deco-bg { position:fixed; inset:0; z-index:1; pointer-events:none; overflow:hidden; }
.deco-bg::before { content:''; position:absolute; top:-6%; right:-6%; width:38vw; height:38vw;
  border-radius:50%; border:1px solid ${t.accent}22; }
.deco-bg::after { content:''; position:absolute; bottom:-8%; left:-8%; width:48vw; height:48vw;
  border-radius:50%; border:1px solid ${t.accent}18; }`,
    numbered: `
.deco-bg { position:fixed; inset:0; z-index:1; pointer-events:none; overflow:hidden; }
.deco-bg::before { content:''; position:absolute; top:0; left:0; width:5px; height:100%;
  background:linear-gradient(to bottom, transparent, ${t.accent}, transparent); }
.deco-bg::after { content:''; position:absolute; bottom:0; right:0; width:100%; height:5px;
  background:linear-gradient(to left, transparent, ${t.accent}, transparent); }`,
    corporate: `
.deco-bg { position:fixed; inset:0; z-index:1; pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px);
  background-size:50px 50px; }`,
    emerald: `
.deco-bg { position:fixed; inset:0; z-index:1; pointer-events:none; overflow:hidden; }
.deco-bg::before { content:'⬡'; position:absolute; top:8%; right:5%; font-size:11rem;
  color:${t.accent}; opacity:.05; }
.deco-bg::after { content:'⬡'; position:absolute; bottom:6%; left:3%; font-size:15rem;
  color:${t.accent2}; opacity:.04; }`,
  };
  return d[tpl] || d.techblue;
}

function genAnnualReportHTML(data, pal, bgOvStyle) {
  // Recreates slide_4.jpg: dark textured bg, 3-col [banners+circles | center ring | circles+banners]
  const { title, subtitle, date, source, docType, stats = [], keyPoints = [], chartData = {} } = data;
  const ACC = '#ffc107', ACC2 = '#e65100', BG = '#141414', CARD = '#1d1d1d', TEXT = '#fff', MUTED = '#777';
  const kpis    = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 6);
  const pctSt   = stats.filter(s => s.unit === '%' && parseFloat(s.numericValue) > 0).slice(0, 6);
  const goodPts = keyPoints.filter(p => p.trim().length > 30).slice(0, 5);
  const year    = (date || '').match(/20\d{2}/)?.[0] || new Date().getFullYear();
  const typeMap  = { telecom:'Télécoms', internet:'Internet', startup:'Startup', rapport:'Rapport Annuel', finance:'Finance', satellite:'Satellite', health:'Santé', energy:'Énergie' };
  const typeLabel = typeMap[docType] || 'Rapport Annuel';
  const fmtV = v => { const n=parseFloat(v); return n>=1e9?(n/1e9).toFixed(2).replace('.',',')+' Md':n>=1e6?(n/1e6).toFixed(2).replace('.',',')+' M':n>=1e3?Math.round(n).toLocaleString('fr-FR'):String(n); };
  const mainKPI = kpis[0] || { label:'Indicateur', numericValue:'0', unit:'', icon:'📊' };
  const mainRaw = parseFloat(mainKPI.numericValue);
  const mainDisp = fmtV(mainKPI.numericValue);
  const heroSub = (subtitle || genAnalyseGlobale(data)||'').substring(0,140);

  const items6 = kpis.slice(0,6);
  while(items6.length < 6) items6.push({ label:'—', numericValue:'0', unit:'', icon:'•' });
  const leftItems  = items6.slice(0,3);
  const rightItems = items6.slice(3,6);

  const leftHTML = leftItems.map((s,i) => {
    const v=fmtV(s.numericValue), empty=s.label==='—';
    return `<div class="ar-item" style="--i:${i}${empty?';opacity:.2':''}">
      <div class="ar-banner"><div class="ar-num">0${i+1}</div>
        <div class="ar-text"><div class="ar-lbl">${esc(s.label.substring(0,22))}</div>
          <div class="ar-val">${empty?'':esc(v)}<small>${empty?'':' '+esc(s.unit)}</small></div></div></div>
      <div class="ar-line-h"></div>
      <div class="ar-ico">${esc(s.icon||'📊')}</div></div>`;
  }).join('');

  const rightHTML = rightItems.map((s,i) => {
    const v=fmtV(s.numericValue), empty=s.label==='—';
    return `<div class="ar-item ar-item-r" style="--i:${i+3}${empty?';opacity:.2':''}">
      <div class="ar-ico">${esc(s.icon||'📊')}</div>
      <div class="ar-line-h"></div>
      <div class="ar-banner ar-banner-r">
        <div class="ar-text"><div class="ar-lbl">${esc(s.label.substring(0,22))}</div>
          <div class="ar-val">${empty?'':esc(v)}<small>${empty?'':' '+esc(s.unit)}</small></div></div>
        <div class="ar-num">0${i+4}</div></div></div>`;
  }).join('');

  const barLabels   = JSON.stringify(kpis.map(s=>s.label.substring(0,14)));
  const barValues   = JSON.stringify(kpis.map(s=>parseFloat(s.numericValue)));
  const barColors   = JSON.stringify(kpis.map((_,i)=>pal[i%pal.length]));
  const dSeries     = pctSt.length>=2?pctSt:kpis.slice(0,5);
  const doughLabels = JSON.stringify(dSeries.map(s=>s.label.substring(0,14)));
  const doughValues = JSON.stringify(dSeries.map(s=>parseFloat(s.numericValue)));
  const doughColors = JSON.stringify(pal.slice(0,dSeries.length));
  const findingsJS  = JSON.stringify(goodPts.map((pt,i)=>({num:String(i+1).padStart(2,'0'),text:pt.substring(0,160)})));
  const synthJS     = JSON.stringify(kpis.slice(0,3).map(s=>({value:fmtV(s.numericValue),unit:s.unit,label:s.label.substring(0,24),raw:parseFloat(s.numericValue)})));
  const analyseInd  = (genAnalyseChartIndicateurs(data)||'').substring(0,220);
  const analyseRep  = (genAnalyseChartRepartition(data)||'').substring(0,300);
  const analyseSyn  = (genAnalyseSynthese(data)||'').substring(0,350);

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Annual Report</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;font-family:'Manrope',sans-serif;background:${BG};color:${TEXT}}
${bgOvStyle?`.bg-ov{position:fixed;inset:0;z-index:0;pointer-events:none;${bgOvStyle}opacity:.25}`:''}
.sw{position:relative;width:100vw;height:100vh;overflow:hidden}
.slide{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:2rem 4vw 5rem;opacity:0;transform:translateX(80px);transition:opacity .52s,transform .52s;pointer-events:none;overflow-y:auto;z-index:1}
.slide.active{opacity:1;transform:none;pointer-events:all;z-index:2}
.slide.out{opacity:0;transform:translateX(-80px);z-index:1}
.hero-bg{position:fixed;inset:0;background:${BG};background-image:repeating-linear-gradient(-45deg,transparent,transparent 4px,rgba(255,255,255,.018) 4px,rgba(255,255,255,.018) 5px);z-index:0}
.h-badge{display:inline-flex;align-items:center;gap:.5rem;font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:${ACC};padding:.22rem 1rem;border:1px solid ${ACC}44;border-radius:99px;margin-bottom:1.3rem;animation:fadeUp .6s .1s both;position:relative;z-index:1}
.h-title{font-size:clamp(1.5rem,4vw,3rem);font-weight:900;text-align:center;line-height:1.1;margin-bottom:.7rem;animation:fadeUp .6s .25s both;max-width:820px;position:relative;z-index:1}
.h-rule{width:0;height:3px;background:${ACC};margin:.7rem auto;border-radius:2px;animation:ruleExp .6s .42s both;position:relative;z-index:1}
.h-sub{font-size:clamp(.78rem,1.3vw,.94rem);color:${MUTED};max-width:560px;text-align:center;line-height:1.75;animation:fadeUp .6s .55s both;position:relative;z-index:1}
.h-meta{display:flex;gap:1rem;margin-top:1rem;animation:fadeUp .6s .68s both;justify-content:center;flex-wrap:wrap;position:relative;z-index:1}
.h-meta span{font-size:.67rem;color:${MUTED};padding:.18rem .7rem;border:1px solid ${ACC}30;border-radius:5px}
.ar-wrap{width:100%;height:100%;display:flex;flex-direction:column;background:${BG};background-image:repeating-linear-gradient(-45deg,transparent,transparent 4px,rgba(255,255,255,.018) 4px,rgba(255,255,255,.018) 5px);padding:1.1rem 1.5rem}
.ar-hdr{display:flex;align-items:center;gap:1.2rem;margin-bottom:.8rem;flex-shrink:0;flex-wrap:wrap}
.ar-hl{display:flex;flex-direction:column;line-height:1.15;flex-shrink:0}
.ar-hl1{font-size:.72rem;font-weight:400;color:#999;text-transform:lowercase;letter-spacing:.05em}
.ar-hl2{font-size:.95rem;font-weight:900;color:${ACC};text-transform:lowercase}
.ar-htxt{flex:1;font-size:.82rem;font-weight:700;color:${TEXT};min-width:0}
.ar-hmeta{font-size:.6rem;color:#555;flex-shrink:0}
.ar-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:clamp(.7rem,1.5vw,1.6rem);flex:1;align-items:center;min-height:0}
.ar-side{display:flex;flex-direction:column;gap:clamp(.45rem,1.1vh,.85rem)}
.ar-item{display:flex;align-items:center;gap:0;animation:arLeft .45s ease both;animation-delay:calc(var(--i)*.1s+.3s)}
.ar-item-r{flex-direction:row-reverse;animation-name:arRight}
.ar-banner{display:flex;align-items:stretch;border-radius:6px 0 0 6px;overflow:hidden;flex:1;box-shadow:0 3px 12px rgba(0,0,0,.55),0 1px 6px rgba(255,193,7,.1)}
.ar-banner-r{border-radius:0 6px 6px 0;flex-direction:row-reverse}
.ar-num{background:#000;color:${ACC};font-size:clamp(.82rem,1.5vw,1.15rem);font-weight:900;padding:.35rem .52rem;display:flex;align-items:center;justify-content:center;min-width:2.4rem;border-right:2.5px solid rgba(255,193,7,.38);flex-shrink:0;line-height:1}
.ar-banner-r .ar-num{border-right:none;border-left:2.5px solid rgba(255,193,7,.38)}
.ar-text{background:linear-gradient(135deg,${ACC} 0%,${ACC2} 100%);flex:1;padding:.35rem .58rem;display:flex;flex-direction:column;justify-content:center}
.ar-lbl{font-size:.58rem;font-weight:700;color:#000;text-transform:uppercase;line-height:1.3;opacity:.85}
.ar-val{font-size:clamp(.68rem,1.2vw,.9rem);font-weight:900;color:#000;line-height:1.1}
.ar-val small{font-size:.55em;opacity:.75}
.ar-line-h{flex:0 0 clamp(.4rem,.8vw,.75rem);height:1px;background:rgba(255,193,7,.28);align-self:center}
.ar-ico{width:clamp(42px,5.8vw,58px);height:clamp(42px,5.8vw,58px);border-radius:50%;background:radial-gradient(circle at 37% 32%,#484848 0%,#111 70%);border:2px solid ${ACC};font-size:clamp(.8rem,1.2vw,1.05rem);box-shadow:0 4px 12px rgba(0,0,0,.75),0 0 14px rgba(255,193,7,.18),inset 0 1px 3px rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ar-center{display:flex;align-items:center;justify-content:center}
.ar-ring{width:clamp(140px,17vw,180px);height:clamp(140px,17vw,180px);border-radius:50%;background:radial-gradient(circle at 38% 33%,#353535 0%,#0c0c0c 65%);border:5px solid ${ACC};box-shadow:0 0 0 2.5px ${BG},0 0 38px rgba(255,193,7,.58),0 0 65px rgba(255,193,7,.18),inset 0 2px 7px rgba(255,255,255,.07),0 8px 25px rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;text-align:center;animation:ringPop .7s cubic-bezier(.34,1.56,.64,1) .12s both}
.arc-inner{color:${TEXT};padding:.45rem}
.arc-cat{font-size:.46rem;color:${ACC};text-transform:uppercase;letter-spacing:.14em;display:block}
.arc-v{font-size:clamp(.88rem,2.1vw,1.55rem);font-weight:900;color:${TEXT};display:block;line-height:1;margin:.1rem 0}
.arc-u{font-size:.46rem;color:#888;display:block}
.arc-s{font-size:.46rem;color:${ACC};text-transform:uppercase;letter-spacing:.1em;display:block;margin-top:.2rem}
.ar-foot{font-size:.65rem;color:#555;line-height:1.6;margin-top:.65rem;flex-shrink:0}
.sl-hdr{font-size:clamp(.85rem,1.6vw,1.12rem);font-weight:700;color:${TEXT};width:100%;max-width:900px;margin-bottom:1rem;display:flex;align-items:center;gap:.7rem}
.sl-hdr-line{flex:1;height:2px;background:linear-gradient(to right,${ACC}44,transparent)}
.ch-area{position:relative;width:100%;max-width:900px;height:54vh;max-height:350px}
.ch-txt{font-size:.73rem;color:${MUTED};line-height:1.78;max-width:900px;margin-top:.7rem;text-align:left}
.ch-dbl{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;width:100%;max-width:900px}
.ch-dw{position:relative;height:44vh;max-height:300px}
.fn-list{display:flex;flex-direction:column;gap:.62rem;width:100%;max-width:820px}
.fn-row{display:flex;align-items:center;gap:1.1rem;background:${CARD};border:1px solid ${ACC}28;border-radius:12px;padding:.8rem 1.1rem;position:relative;overflow:hidden}
.fn-row::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:${ACC}}
.fn-n{font-size:1.5rem;font-weight:900;color:${ACC};min-width:2.5rem;text-align:center;line-height:1}
.fn-t{font-size:.79rem;color:${TEXT};line-height:1.68;flex:1}
.sy-row{display:flex;gap:1.5rem;justify-content:center;margin-bottom:1.3rem;flex-wrap:wrap}
.sy-c{border-radius:50%;border:2px solid ${ACC}55;background:radial-gradient(circle at 40% 38%,${ACC}1a,transparent 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem;box-shadow:0 0 28px ${ACC}22}
.sy-v{font-size:clamp(.95rem,2.2vw,1.65rem);font-weight:900;color:${ACC};line-height:1}
.sy-v small{font-size:.5em;color:${MUTED};margin-left:.1rem}
.sy-l{font-size:.58rem;color:${MUTED};margin-top:.25rem;line-height:1.3}
.sy-txt{font-size:.76rem;color:${MUTED};line-height:1.78;max-width:750px;text-align:center}
.pres-nav{position:fixed;bottom:1.1rem;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:1rem;z-index:99;background:rgba(0,0,0,.72);backdrop-filter:blur(14px);border:1px solid ${ACC}33;border-radius:50px;padding:.4rem 1.2rem}
.nav-b{background:none;border:none;color:${ACC};font-size:.9rem;cursor:pointer;padding:.2rem .38rem;border-radius:5px;transition:background .2s}
.nav-b:hover{background:${ACC}22}.nav-b:disabled{opacity:.22;cursor:default}
.p-dots{display:flex;gap:.3rem}.dot{width:6px;height:6px;border-radius:50%;background:${ACC}33;transition:all .3s;cursor:pointer}.dot.on{background:${ACC};transform:scale(1.45);box-shadow:0 0 8px ${ACC}88}
.p-cnt{font-size:.7rem;color:${MUTED};min-width:3rem;text-align:center}
.pres-logo{position:fixed;top:.8rem;right:1.1rem;font-size:.65rem;color:${MUTED};opacity:.5;z-index:50}.pres-logo strong{color:${ACC}}
@keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@keyframes ruleExp{from{width:0}to{width:70px}}
@keyframes arLeft{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:none}}
@keyframes arRight{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}
@keyframes ringPop{from{opacity:0;transform:scale(.18)}to{opacity:1;transform:scale(1)}}
@keyframes fnIn{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
@keyframes syIn{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
@media(max-width:640px){.ar-grid{grid-template-columns:1fr}.ar-center{display:none}.ch-dbl{grid-template-columns:1fr}}
</style></head><body>
${bgOvStyle?'<div class="bg-ov"></div>':''}
<div class="sw">

<!-- S0: TITRE -->
<div class="slide active" id="s0">
  <div class="hero-bg"></div>
  <span class="h-badge">✦ ${esc(typeLabel)} · ${esc(String(year))}</span>
  <h1 class="h-title">${esc(title.length>90?title.substring(0,88)+'…':title)}</h1>
  <div class="h-rule"></div>
  <p class="h-sub">${esc(heroSub)}</p>
  <div class="h-meta">
    ${source?`<span>📌 ${esc(source)}</span>`:''}
    <span>📅 ${esc(date||String(year))}</span>
    <span>Algeria<strong style="color:${ACC}">Tech</strong> Generator</span>
  </div>
</div>

<!-- S1: ANNUAL LAYOUT (slide_4 recreation) -->
<div class="slide" id="s1">
  <div class="ar-wrap">
    <div class="ar-hdr">
      <div class="ar-hl"><span class="ar-hl1">headline</span><span class="ar-hl2">annual report</span></div>
      <div class="ar-htxt">${esc(title.substring(0,65))}</div>
      <div class="ar-hmeta">${source?esc(source)+' · ':''}${esc(date||String(year))}</div>
    </div>
    <div class="ar-grid">
      <div class="ar-side">${leftHTML}</div>
      <div class="ar-center">
        <div class="ar-ring">
          <div class="arc-inner">
            <span class="arc-cat">${esc(typeLabel.toUpperCase())}</span>
            <strong class="arc-v" data-t="${mainRaw}" id="arc-v">${esc(mainDisp)}</strong>
            <span class="arc-u">${esc(mainKPI.unit)}</span>
            <span class="arc-s">INFOGRAPHIC</span>
          </div>
        </div>
      </div>
      <div class="ar-side">${rightHTML}</div>
    </div>
    <p class="ar-foot">${esc(heroSub)}</p>
  </div>
</div>

<!-- S2: GRAPHIQUE -->
<div class="slide" id="s2">
  <div class="sl-hdr"><span>📊</span> Analyse comparative <span class="sl-hdr-line"></span></div>
  <div class="ch-area"><canvas id="ch-bar"></canvas></div>
  <p class="ch-txt">${esc(analyseInd)}</p>
</div>

<!-- S3: RÉPARTITION -->
<div class="slide" id="s3">
  <div class="sl-hdr"><span>🥧</span> Répartition &amp; structure <span class="sl-hdr-line"></span></div>
  <div class="ch-dbl">
    <div class="ch-dw"><canvas id="ch-dou"></canvas></div>
    <div style="display:flex;align-items:center"><p class="ch-txt" style="margin:0">${esc(analyseRep)}</p></div>
  </div>
</div>

<!-- S4: POINTS CLÉS -->
<div class="slide" id="s4">
  <div class="sl-hdr"><span>🔍</span> Points clés &amp; constats <span class="sl-hdr-line"></span></div>
  <div class="fn-list" id="fn-list"></div>
</div>

<!-- S5: SYNTHÈSE -->
<div class="slide" id="s5">
  <div class="sl-hdr"><span>📋</span> Synthèse exécutive <span class="sl-hdr-line"></span></div>
  <div class="sy-row" id="sy-row"></div>
  <p class="sy-txt">${esc(analyseSyn)}</p>
</div>

</div>
<nav class="pres-nav">
  <button class="nav-b" id="bp" disabled>◀</button>
  <div class="p-dots">${[0,1,2,3,4,5].map(i=>`<span class="dot${i===0?' on':''}" data-i="${i}"></span>`).join('')}</div>
  <span class="p-cnt" id="pcnt">1 / 6</span>
  <button class="nav-b" id="bn">▶</button>
</nav>
<div class="pres-logo">Algeria<strong>Tech</strong></div>

<script>
const N=6,ACC=${JSON.stringify(ACC)},BG=${JSON.stringify(BG)},MUTED=${JSON.stringify(MUTED)},PAL=${JSON.stringify(pal)};
const BAR_L=${barLabels},BAR_V=${barValues},BAR_C=${barColors};
const DGH_L=${doughLabels},DGH_V=${doughValues},DGH_C=${doughColors};
const FINDS=${findingsJS},SYNTH=${synthJS};
Chart.defaults.font.family="'Manrope',sans-serif";Chart.defaults.color=MUTED;Chart.defaults.borderColor='rgba(255,255,255,.05)';
let cur=0;
const slides=Array.from(document.querySelectorAll('.slide')),dots=Array.from(document.querySelectorAll('.dot'));
const pcnt=document.getElementById('pcnt'),bp=document.getElementById('bp'),bn=document.getElementById('bn'),done=new Set();
function goto(n){if(n<0||n>=N)return;slides[cur].classList.remove('active');slides[cur].classList.add('out');const p=cur;cur=n;setTimeout(()=>slides[p].classList.remove('out'),600);slides[cur].classList.add('active');dots.forEach((d,i)=>d.classList.toggle('on',i===cur));pcnt.textContent=(cur+1)+' / '+N;bp.disabled=cur===0;bn.disabled=cur===N-1;onEnter(cur);}
bn.onclick=()=>goto(cur+1);bp.onclick=()=>goto(cur-1);
dots.forEach(d=>d.addEventListener('click',()=>goto(+d.dataset.i)));
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();goto(cur+1);}if(e.key==='ArrowLeft'){e.preventDefault();goto(cur-1);}});
let tx=0;document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX},{passive:true});document.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-tx;if(Math.abs(dx)>40)goto(dx<0?cur+1:cur-1)},{passive:true});
function fmtNum(v){return v>=1e9?(v/1e9).toFixed(2).replace('.',',')+' Md':v>=1e6?(v/1e6).toFixed(2).replace('.',',')+' M':v>=1e3?Math.round(v).toLocaleString('fr-FR'):v.toFixed(v%1?1:0).replace('.',',');}
function countUp(el,target){if(!target)return;const dur=1100;let st=null;(function step(ts){if(!st)st=ts;const p=Math.min((ts-st)/dur,1);const e=1-Math.pow(1-p,3);el.textContent=fmtNum(target*e);if(p<1)requestAnimationFrame(step);})(performance.now());}
function buildFindings(){const c=document.getElementById('fn-list');if(!c||c.children.length)return;if(!FINDS.length){c.innerHTML='<p style="color:'+MUTED+'">Aucun point clé extrait.</p>';return;}FINDS.forEach((f,i)=>{const d=document.createElement('div');d.className='fn-row';d.style.cssText='opacity:0;animation:fnIn .5s ease '+(i*.1+.15)+'s both';d.innerHTML='<div class="fn-n">'+f.num+'</div><div class="fn-t">'+f.text+'</div>';c.appendChild(d);});}
function buildSynth(){const c=document.getElementById('sy-row');if(!c||c.children.length)return;const sz=Math.min(155,Math.floor(window.innerWidth*.25));SYNTH.forEach((s,i)=>{const d=document.createElement('div');d.className='sy-c';d.style.cssText='width:'+sz+'px;height:'+sz+'px;opacity:0;animation:syIn .6s cubic-bezier(.34,1.56,.64,1) '+(i*.14+.1)+'s both';d.innerHTML='<div class="sy-v">'+s.value+'<small>'+s.unit+'</small></div><div class="sy-l">'+s.label+'</div>';c.appendChild(d);});}
function initBar(){const c=document.getElementById('ch-bar');if(!c||!BAR_L.length)return;new Chart(c,{type:'bar',data:{labels:BAR_L,datasets:[{label:'Valeur',data:BAR_V,backgroundColor:BAR_C.map(c=>c+'bb'),borderColor:BAR_C,borderWidth:1,borderRadius:9}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:MUTED,maxRotation:35}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:MUTED}}},animation:{duration:1000,easing:'easeOutQuart'}}});}
function initDonut(){const c=document.getElementById('ch-dou');if(!c||!DGH_L.length)return;new Chart(c,{type:'doughnut',data:{labels:DGH_L,datasets:[{data:DGH_V,backgroundColor:DGH_C,borderColor:BG,borderWidth:3,hoverOffset:12}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right',labels:{color:MUTED,padding:12,usePointStyle:true}}},animation:{animateRotate:true,animateScale:true,duration:1000}}});}
function onEnter(idx){if(done.has(idx))return;done.add(idx);if(idx===1)setTimeout(()=>{const el=document.getElementById('arc-v');if(el)countUp(el,${mainRaw});},500);if(idx===2)initBar();if(idx===3)initDonut();if(idx===4)buildFindings();if(idx===5)buildSynth();}
onEnter(0);
<\/script></body></html>`;
}

// ─── Numbered Steps Template — alternating rows + diagonal yellow bg (slide_5 style) ──

function genNumberedStepsHTML(data, pal, bgOvStyle) {
  // Recreates slide_5.jpg: dark bg + yellow diagonal left band, 5 alternating numbered rows
  const { title, subtitle, date, source, docType, stats = [], keyPoints = [], chartData = {} } = data;
  const ACC = '#ffcc00', ACC2 = '#e65100', BG = '#0a0a0a', CARD = '#141414', TEXT = '#fff', MUTED = '#888';
  const kpis    = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 5);
  const pctSt   = stats.filter(s => s.unit === '%' && parseFloat(s.numericValue) > 0).slice(0, 5);
  const goodPts = keyPoints.filter(p => p.trim().length > 30).slice(0, 5);
  const year    = (date || '').match(/20\d{2}/)?.[0] || new Date().getFullYear();
  const typeMap  = { telecom:'Télécoms', internet:'Internet', startup:'Startup', rapport:'Rapport Annuel', finance:'Finance', satellite:'Satellite', health:'Santé', energy:'Énergie' };
  const typeLabel = typeMap[docType] || 'Rapport';
  const fmtV = v => { const n=parseFloat(v); return n>=1e9?(n/1e9).toFixed(2).replace('.',',')+' Md':n>=1e6?(n/1e6).toFixed(2).replace('.',',')+' M':n>=1e3?Math.round(n).toLocaleString('fr-FR'):String(n); };
  const heroSub = (subtitle || genAnalyseGlobale(data)||'').substring(0,140);

  const items5 = kpis.slice(0,5);
  while(items5.length < 5) items5.push({ label:'—', numericValue:'0', unit:'', icon:'•' });

  const stepsHTML = items5.map((s,i) => {
    const v = fmtV(s.numericValue), empty = s.label==='—';
    const numStr = String(i+1).padStart(2,'0');
    const isOdd = i % 2 === 0;
    if (isOdd) {
      return `<div class="ns-row" style="--i:${i}">
        <div class="ns-ico">${esc(s.icon||'📊')}</div>
        <div class="ns-numblk"><span class="ns-num">${numStr}</span></div>
        <div class="ns-content">
          <div class="ns-lbl">${esc(s.label.substring(0,28))}</div>
          <div class="ns-val">${empty?'—':esc(v)}<small>${empty?'':' '+esc(s.unit)}</small></div>
        </div>
      </div>`;
    } else {
      return `<div class="ns-row ns-row-even" style="--i:${i}">
        <div class="ns-content ns-content-r">
          <div class="ns-lbl">${esc(s.label.substring(0,28))}</div>
          <div class="ns-val">${empty?'—':esc(v)}<small>${empty?'':' '+esc(s.unit)}</small></div>
        </div>
        <div class="ns-numblk"><span class="ns-num">${numStr}</span></div>
        <div class="ns-ico">${esc(s.icon||'📊')}</div>
      </div>`;
    }
  }).join('');

  const barLabels   = JSON.stringify(kpis.map(s=>s.label.substring(0,14)));
  const barValues   = JSON.stringify(kpis.map(s=>parseFloat(s.numericValue)));
  const barColors   = JSON.stringify(kpis.map((_,i)=>pal[i%pal.length]));
  const dSeries     = pctSt.length>=2?pctSt:kpis.slice(0,5);
  const doughLabels = JSON.stringify(dSeries.map(s=>s.label.substring(0,14)));
  const doughValues = JSON.stringify(dSeries.map(s=>parseFloat(s.numericValue)));
  const doughColors = JSON.stringify(pal.slice(0,dSeries.length));
  const findingsJS  = JSON.stringify(goodPts.map((pt,i)=>({num:String(i+1).padStart(2,'0'),text:pt.substring(0,160)})));
  const synthJS     = JSON.stringify(kpis.slice(0,3).map(s=>({value:fmtV(s.numericValue),unit:s.unit,label:s.label.substring(0,24),raw:parseFloat(s.numericValue)})));
  const analyseInd  = (genAnalyseChartIndicateurs(data)||'').substring(0,220);
  const analyseRep  = (genAnalyseChartRepartition(data)||'').substring(0,300);
  const analyseSyn  = (genAnalyseSynthese(data)||'').substring(0,350);

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Étapes</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;font-family:'Manrope',sans-serif;background:${BG};color:${TEXT}}
${bgOvStyle?`.bg-ov{position:fixed;inset:0;z-index:0;pointer-events:none;${bgOvStyle}opacity:.22}`:''}
.sw{position:relative;width:100vw;height:100vh;overflow:hidden}
.slide{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:2rem 4vw 5rem;opacity:0;transform:translateX(80px);transition:opacity .52s,transform .52s;pointer-events:none;overflow-y:auto;z-index:1}
.slide.active{opacity:1;transform:none;pointer-events:all;z-index:2}
.slide.out{opacity:0;transform:translateX(-80px);z-index:1}
.ns-diag{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.ns-diag::before{content:'';position:absolute;top:0;left:0;bottom:0;width:38%;background:linear-gradient(to bottom,${ACC} 0%,#ff8f00 60%,${ACC2} 100%);clip-path:polygon(0 0,100% 0,84% 100%,0 100%)}
.ns-diag::after{content:'';position:absolute;top:0;left:0;bottom:0;width:38%;background:rgba(0,0,0,.2);clip-path:polygon(0 0,100% 0,84% 100%,0 100%)}
.h-badge{display:inline-flex;align-items:center;gap:.5rem;font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:${ACC};padding:.22rem 1rem;border:1px solid ${ACC}44;border-radius:99px;margin-bottom:1.3rem;animation:fadeUp .6s .1s both;position:relative;z-index:1}
.h-title{font-size:clamp(1.5rem,4vw,3rem);font-weight:900;text-align:center;line-height:1.1;margin-bottom:.7rem;animation:fadeUp .6s .25s both;max-width:820px;position:relative;z-index:1}
.h-rule{width:0;height:3px;background:${ACC};margin:.7rem auto;border-radius:2px;animation:ruleExp .6s .42s both;position:relative;z-index:1}
.h-sub{font-size:clamp(.78rem,1.3vw,.94rem);color:${MUTED};max-width:560px;text-align:center;line-height:1.75;animation:fadeUp .6s .55s both;position:relative;z-index:1}
.h-meta{display:flex;gap:1rem;margin-top:1rem;animation:fadeUp .6s .68s both;justify-content:center;flex-wrap:wrap;position:relative;z-index:1}
.h-meta span{font-size:.67rem;color:${MUTED};padding:.18rem .7rem;border:1px solid ${ACC}30;border-radius:5px}
.ns-wrap{width:100%;max-width:720px;position:relative;z-index:1;display:flex;flex-direction:column;gap:clamp(.5rem,1.2vh,.9rem)}
.ns-row{display:grid;grid-template-columns:clamp(46px,5.5vw,58px) clamp(2.5rem,3.8vw,3.2rem) 1fr;align-items:center;gap:clamp(.5rem,1vw,.85rem);animation:nsIn .45s ease both;animation-delay:calc(var(--i)*.1s+.2s)}
.ns-row-even{grid-template-columns:1fr clamp(2.5rem,3.8vw,3.2rem) clamp(46px,5.5vw,58px)}
.ns-ico{width:clamp(46px,5.5vw,58px);height:clamp(46px,5.5vw,58px);border-radius:50%;background:radial-gradient(circle at 37% 32%,#484848 0%,#111 70%);border:2px solid ${ACC};font-size:clamp(.82rem,1.15vw,1rem);box-shadow:0 4px 12px rgba(0,0,0,.75),0 0 14px rgba(255,204,0,.18),inset 0 1px 3px rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ns-numblk{display:flex;align-items:center;justify-content:center}
.ns-num{font-size:clamp(1.8rem,3.5vw,3rem);font-weight:900;line-height:1;color:${ACC};text-shadow:0 2px 8px rgba(255,204,0,.25)}
.ns-content{display:flex;flex-direction:column;gap:.18rem;background:rgba(255,255,255,.04);border-left:3px solid ${ACC}66;padding:.4rem .62rem;border-radius:0 8px 8px 0}
.ns-content-r{border-left:none;border-right:3px solid ${ACC}66;border-radius:8px 0 0 8px;text-align:right}
.ns-lbl{font-size:.73rem;font-weight:700;color:${TEXT};line-height:1.3}
.ns-val{font-size:clamp(.85rem,1.7vw,1.2rem);font-weight:900;color:${ACC};line-height:1}
.ns-val small{font-size:.55em;color:${MUTED}}
.sl-hdr{font-size:clamp(.85rem,1.6vw,1.12rem);font-weight:700;color:${TEXT};width:100%;max-width:900px;margin-bottom:1rem;display:flex;align-items:center;gap:.7rem}
.sl-hdr-line{flex:1;height:2px;background:linear-gradient(to right,${ACC}44,transparent)}
.ch-area{position:relative;width:100%;max-width:900px;height:54vh;max-height:350px}
.ch-txt{font-size:.73rem;color:${MUTED};line-height:1.78;max-width:900px;margin-top:.7rem;text-align:left}
.ch-dbl{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;width:100%;max-width:900px}
.ch-dw{position:relative;height:44vh;max-height:300px}
.fn-list{display:flex;flex-direction:column;gap:.62rem;width:100%;max-width:820px}
.fn-row{display:flex;align-items:center;gap:1.1rem;background:${CARD};border:1px solid ${ACC}28;border-radius:12px;padding:.8rem 1.1rem;position:relative;overflow:hidden}
.fn-row::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:${ACC}}
.fn-n{font-size:1.5rem;font-weight:900;color:${ACC};min-width:2.5rem;text-align:center;line-height:1}
.fn-t{font-size:.79rem;color:${TEXT};line-height:1.68;flex:1}
.sy-row{display:flex;gap:1.5rem;justify-content:center;margin-bottom:1.3rem;flex-wrap:wrap}
.sy-c{border-radius:50%;border:2px solid ${ACC}55;background:radial-gradient(circle at 40% 38%,${ACC}1a,transparent 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem;box-shadow:0 0 28px ${ACC}22}
.sy-v{font-size:clamp(.95rem,2.2vw,1.65rem);font-weight:900;color:${ACC};line-height:1}
.sy-v small{font-size:.5em;color:${MUTED};margin-left:.1rem}
.sy-l{font-size:.58rem;color:${MUTED};margin-top:.25rem;line-height:1.3}
.sy-txt{font-size:.76rem;color:${MUTED};line-height:1.78;max-width:750px;text-align:center}
.pres-nav{position:fixed;bottom:1.1rem;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:1rem;z-index:99;background:rgba(0,0,0,.72);backdrop-filter:blur(14px);border:1px solid ${ACC}33;border-radius:50px;padding:.4rem 1.2rem}
.nav-b{background:none;border:none;color:${ACC};font-size:.9rem;cursor:pointer;padding:.2rem .38rem;border-radius:5px;transition:background .2s}
.nav-b:hover{background:${ACC}22}.nav-b:disabled{opacity:.22;cursor:default}
.p-dots{display:flex;gap:.3rem}.dot{width:6px;height:6px;border-radius:50%;background:${ACC}33;transition:all .3s;cursor:pointer}.dot.on{background:${ACC};transform:scale(1.45);box-shadow:0 0 8px ${ACC}88}
.p-cnt{font-size:.7rem;color:${MUTED};min-width:3rem;text-align:center}
.pres-logo{position:fixed;top:.8rem;right:1.1rem;font-size:.65rem;color:${MUTED};opacity:.5;z-index:50}.pres-logo strong{color:${ACC}}
@keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@keyframes ruleExp{from{width:0}to{width:70px}}
@keyframes nsIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes fnIn{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
@keyframes syIn{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
@media(max-width:640px){.ch-dbl{grid-template-columns:1fr}.ns-row,.ns-row-even{grid-template-columns:auto auto 1fr}}
</style></head><body>
${bgOvStyle?'<div class="bg-ov"></div>':''}
<div class="ns-diag"></div>
<div class="sw">

<!-- S0: TITRE -->
<div class="slide active" id="s0">
  <span class="h-badge">✦ ${esc(typeLabel)} · ${esc(String(year))}</span>
  <h1 class="h-title">${esc(title.length>90?title.substring(0,88)+'…':title)}</h1>
  <div class="h-rule"></div>
  <p class="h-sub">${esc(heroSub)}</p>
  <div class="h-meta">
    ${source?`<span>📌 ${esc(source)}</span>`:''}
    <span>📅 ${esc(date||String(year))}</span>
    <span>Algeria<strong style="color:${ACC}">Tech</strong> Generator</span>
  </div>
</div>

<!-- S1: NUMBERED LAYOUT (slide_5 recreation) -->
<div class="slide" id="s1">
  <div class="sl-hdr" style="position:relative;z-index:1"><span>🔢</span> Indicateurs clés — Étapes <span class="sl-hdr-line"></span></div>
  <div class="ns-wrap">${stepsHTML}</div>
</div>

<!-- S2: GRAPHIQUE -->
<div class="slide" id="s2">
  <div class="sl-hdr" style="position:relative;z-index:1"><span>📊</span> Analyse comparative <span class="sl-hdr-line"></span></div>
  <div class="ch-area" style="position:relative;z-index:1"><canvas id="ch-bar"></canvas></div>
  <p class="ch-txt" style="position:relative;z-index:1">${esc(analyseInd)}</p>
</div>

<!-- S3: RÉPARTITION -->
<div class="slide" id="s3">
  <div class="sl-hdr" style="position:relative;z-index:1"><span>🥧</span> Répartition &amp; structure <span class="sl-hdr-line"></span></div>
  <div class="ch-dbl" style="position:relative;z-index:1">
    <div class="ch-dw"><canvas id="ch-dou"></canvas></div>
    <div style="display:flex;align-items:center"><p class="ch-txt" style="margin:0">${esc(analyseRep)}</p></div>
  </div>
</div>

<!-- S4: POINTS CLÉS -->
<div class="slide" id="s4">
  <div class="sl-hdr" style="position:relative;z-index:1"><span>🔍</span> Points clés &amp; constats <span class="sl-hdr-line"></span></div>
  <div class="fn-list" id="fn-list" style="position:relative;z-index:1"></div>
</div>

<!-- S5: SYNTHÈSE -->
<div class="slide" id="s5">
  <div class="sl-hdr" style="position:relative;z-index:1"><span>📋</span> Synthèse exécutive <span class="sl-hdr-line"></span></div>
  <div class="sy-row" id="sy-row" style="position:relative;z-index:1"></div>
  <p class="sy-txt" style="position:relative;z-index:1">${esc(analyseSyn)}</p>
</div>

</div>
<nav class="pres-nav">
  <button class="nav-b" id="bp" disabled>◀</button>
  <div class="p-dots">${[0,1,2,3,4,5].map(i=>`<span class="dot${i===0?' on':''}" data-i="${i}"></span>`).join('')}</div>
  <span class="p-cnt" id="pcnt">1 / 6</span>
  <button class="nav-b" id="bn">▶</button>
</nav>
<div class="pres-logo">Algeria<strong>Tech</strong></div>

<script>
const N=6,ACC=${JSON.stringify(ACC)},BG=${JSON.stringify(BG)},MUTED=${JSON.stringify(MUTED)},PAL=${JSON.stringify(pal)};
const BAR_L=${barLabels},BAR_V=${barValues},BAR_C=${barColors};
const DGH_L=${doughLabels},DGH_V=${doughValues},DGH_C=${doughColors};
const FINDS=${findingsJS},SYNTH=${synthJS};
Chart.defaults.font.family="'Manrope',sans-serif";Chart.defaults.color=MUTED;Chart.defaults.borderColor='rgba(255,255,255,.05)';
let cur=0;
const slides=Array.from(document.querySelectorAll('.slide')),dots=Array.from(document.querySelectorAll('.dot'));
const pcnt=document.getElementById('pcnt'),bp=document.getElementById('bp'),bn=document.getElementById('bn'),done=new Set();
function goto(n){if(n<0||n>=N)return;slides[cur].classList.remove('active');slides[cur].classList.add('out');const p=cur;cur=n;setTimeout(()=>slides[p].classList.remove('out'),600);slides[cur].classList.add('active');dots.forEach((d,i)=>d.classList.toggle('on',i===cur));pcnt.textContent=(cur+1)+' / '+N;bp.disabled=cur===0;bn.disabled=cur===N-1;onEnter(cur);}
bn.onclick=()=>goto(cur+1);bp.onclick=()=>goto(cur-1);
dots.forEach(d=>d.addEventListener('click',()=>goto(+d.dataset.i)));
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();goto(cur+1);}if(e.key==='ArrowLeft'){e.preventDefault();goto(cur-1);}});
let tx=0;document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX},{passive:true});document.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-tx;if(Math.abs(dx)>40)goto(dx<0?cur+1:cur-1)},{passive:true});
function fmtNum(v){return v>=1e9?(v/1e9).toFixed(2).replace('.',',')+' Md':v>=1e6?(v/1e6).toFixed(2).replace('.',',')+' M':v>=1e3?Math.round(v).toLocaleString('fr-FR'):v.toFixed(v%1?1:0).replace('.',',');}
function countUp(el,target){if(!target)return;const dur=1100;let st=null;(function step(ts){if(!st)st=ts;const p=Math.min((ts-st)/dur,1);const e=1-Math.pow(1-p,3);el.textContent=fmtNum(target*e);if(p<1)requestAnimationFrame(step);})(performance.now());}
function buildFindings(){const c=document.getElementById('fn-list');if(!c||c.children.length)return;if(!FINDS.length){c.innerHTML='<p style="color:'+MUTED+'">Aucun point clé extrait.</p>';return;}FINDS.forEach((f,i)=>{const d=document.createElement('div');d.className='fn-row';d.style.cssText='opacity:0;animation:fnIn .5s ease '+(i*.1+.15)+'s both';d.innerHTML='<div class="fn-n">'+f.num+'</div><div class="fn-t">'+f.text+'</div>';c.appendChild(d);});}
function buildSynth(){const c=document.getElementById('sy-row');if(!c||c.children.length)return;const sz=Math.min(155,Math.floor(window.innerWidth*.25));SYNTH.forEach((s,i)=>{const d=document.createElement('div');d.className='sy-c';d.style.cssText='width:'+sz+'px;height:'+sz+'px;opacity:0;animation:syIn .6s cubic-bezier(.34,1.56,.64,1) '+(i*.14+.1)+'s both';d.innerHTML='<div class="sy-v">'+s.value+'<small>'+s.unit+'</small></div><div class="sy-l">'+s.label+'</div>';c.appendChild(d);});}
function initBar(){const c=document.getElementById('ch-bar');if(!c||!BAR_L.length)return;new Chart(c,{type:'bar',data:{labels:BAR_L,datasets:[{label:'Valeur',data:BAR_V,backgroundColor:BAR_C.map(c=>c+'bb'),borderColor:BAR_C,borderWidth:1,borderRadius:9}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:MUTED,maxRotation:35}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:MUTED}}},animation:{duration:1000,easing:'easeOutQuart'}}});}
function initDonut(){const c=document.getElementById('ch-dou');if(!c||!DGH_L.length)return;new Chart(c,{type:'doughnut',data:{labels:DGH_L,datasets:[{data:DGH_V,backgroundColor:DGH_C,borderColor:BG,borderWidth:3,hoverOffset:12}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right',labels:{color:MUTED,padding:12,usePointStyle:true}}},animation:{animateRotate:true,animateScale:true,duration:1000}}});}
function onEnter(idx){if(done.has(idx))return;done.add(idx);if(idx===2)initBar();if(idx===3)initDonut();if(idx===4)buildFindings();if(idx===5)buildSynth();}
onEnter(0);
<\/script></body></html>`;
}

// ─── Slide HTML dispatcher ────────────────────────────────────────────────────

function genSlideHTML(data, slug, pal, domain, slideTemplate, bgTheme, bgImage) {
  const {
    title, subtitle, date, source, docType,
    stats = [], keyPoints = [], sections = [], chartData = {}
  } = data;

  const hasTime = chartData.labels && chartData.labels.length >= 3;
  const kpis    = stats.filter(s => parseFloat(s.numericValue) > 0).slice(0, 6);
  const pctSt   = stats.filter(s => s.unit === '%' && parseFloat(s.numericValue) > 0).slice(0, 6);
  const goodPts = keyPoints.filter(p => p.trim().length > 30).slice(0, 5);
  const goodSects = sections.filter(s => s.body && s.body.trim().length > 80).slice(0, 2);
  const tpl = slideTemplate || 'techblue';

  const THEMES = {
    techblue:  { bg:'#030d1c', card:'#071526', accent:'#00b4ff', accent2:'#00e5c4', text:'#d0eeff', muted:'#5a8cb0', border:'rgba(0,180,255,.22)', glow:'0 0 40px rgba(0,180,255,.18)' },
    diamond:   { bg:'#0b1225', card:'#111e38', accent:'#d4a437', accent2:'#4fc3f7', text:'#f0e8d8', muted:'#8898aa', border:'rgba(212,164,55,.28)', glow:'0 0 40px rgba(212,164,55,.1)' },
    gradient:  { bg:'#130824', card:'#1d1035', accent:'#e040fb', accent2:'#ff6e40', text:'#f3e5ff', muted:'#b085c9', border:'rgba(224,64,251,.28)', glow:'0 0 40px rgba(224,64,251,.12)' },
    annual:    { bg:'#080808', card:'#101010', accent:'#ffc107', accent2:'#ff7043', text:'#ffffff', muted:'#999999', border:'rgba(255,193,7,.28)',   glow:'0 0 40px rgba(255,193,7,.1)'  },
    numbered:  { bg:'#070707', card:'#0f0f0f', accent:'#ffcc00', accent2:'#ff5722', text:'#ffffff', muted:'#888888', border:'rgba(255,204,0,.32)',   glow:'0 0 40px rgba(255,204,0,.12)' },
    corporate: { bg:'#0f172a', card:'#1e293b', accent:'#3b82f6', accent2:'#06b6d4', text:'#f1f5f9', muted:'#94a3b8', border:'rgba(59,130,246,.28)', glow:'0 0 40px rgba(59,130,246,.12)' },
    emerald:   { bg:'#021208', card:'#071f10', accent:'#10b981', accent2:'#f59e0b', text:'#d1fae5', muted:'#6aa880', border:'rgba(16,185,129,.28)', glow:'0 0 40px rgba(16,185,129,.12)' },
  };

  const t = THEMES[tpl] || THEMES.techblue;
  const decoCSS = getTplDecoCSS(tpl, t);

  // background photo
  let bgOvStyle = '';
  if (bgTheme !== 'none' && bgImage && bgImage !== 'none') {
    const isGrad = bgImage.startsWith('linear-gradient') || bgImage.startsWith('radial-gradient') || bgImage.startsWith('ia:');
    if (isGrad) {
      const grad = bgImage.startsWith('ia:') ? bgImage.slice(3) : bgImage;
      bgOvStyle = `background:${grad};`;
    } else {
      bgOvStyle = `background:url('${bgImage}') center/cover no-repeat;`;
    }
  }

  // Dispatch to layout-specific templates
  if (slideTemplate === 'annual')   return genAnnualReportHTML(data, pal, bgOvStyle);
  if (slideTemplate === 'numbered') return genNumberedStepsHTML(data, pal, bgOvStyle);

  // chart data
  const barLabels   = JSON.stringify(kpis.map(s => s.label.substring(0, 16)));
  const barValues   = JSON.stringify(kpis.map(s => parseFloat(s.numericValue)));
  const barColors   = JSON.stringify(kpis.map((_, i) => pal[i % pal.length]));
  const usePct      = pctSt.length >= 2;
  const dSeries     = usePct ? pctSt : kpis.slice(0, 4);
  const doughLabels = JSON.stringify(dSeries.map(s => s.label.substring(0, 16)));
  const doughValues = JSON.stringify(dSeries.map(s => parseFloat(s.numericValue)));
  const doughColors = JSON.stringify(pal.slice(0, dSeries.length));
  const evoLabels   = hasTime ? JSON.stringify(chartData.labels) : '[]';
  const evoValues   = hasTime ? JSON.stringify(chartData.values) : '[]';

  // HTML fragments
  const kpiHTML = kpis.map((s, i) => {
    const v = parseFloat(s.numericValue);
    const d = v >= 1e6 ? (v/1e6).toFixed(2).replace('.',',') + ' M'
            : v >= 1e3 ? Math.round(v).toLocaleString('fr-FR') : String(v);
    return `<div class="kc" style="--i:${i}">
      <div class="kc-ico">${esc(s.icon || '📊')}</div>
      <div class="kc-val">${esc(d)}<span class="kc-u">${esc(s.unit || '')}</span></div>
      <div class="kc-lbl">${esc(s.label)}</div>
    </div>`;
  }).join('');

  const findHTML = goodPts.map((pt, i) =>
    `<div class="fn-row" style="--i:${i}">
      <span class="fn-n">${String(i+1).padStart(2,'0')}</span>
      <span class="fn-t">${esc(pt)}</span>
    </div>`
  ).join('');

  const synthHTML = kpis.slice(0, 3).map((s, i) => {
    const v = parseFloat(s.numericValue);
    const d = v >= 1e6 ? (v/1e6).toFixed(2).replace('.',',') + ' M'
            : v >= 1e3 ? Math.round(v).toLocaleString('fr-FR') : String(v);
    return `<div class="sy-card" style="--i:${i}">
      <div class="sy-v">${esc(d)}<small>${esc(s.unit||'')}</small></div>
      <div class="sy-l">${esc(s.label)}</div>
    </div>`;
  }).join('');

  const sectsHTML = goodSects.map((s, i) =>
    `<div class="sc-blk" style="--i:${i}">
      <h3 class="sc-h">${esc(s.title)}</h3>
      <p class="sc-p">${esc(s.body.substring(0, 280))}</p>
    </div>`
  ).join('');

  const typeLabels = { telecom:'Télécoms', internet:'Internet', startup:'Startup', rapport:'Rapport', presse:'Presse', finance:'Finance', satellite:'Satellite', health:'Santé', energy:'Énergie', industry:'Industrie', product:'Produit' };
  const typeLabel  = typeLabels[docType] || typeLabels[domain] || 'Rapport';
  const analyseInd = genAnalyseChartIndicateurs(data);
  const analyseRep = genAnalyseChartRepartition(data);
  const analyseSyn = genAnalyseSynthese(data);
  const nSlides    = 6 + (goodSects.length > 0 ? 1 : 0);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Algeria Tech Slides</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;font-family:'Manrope',sans-serif;background:${t.bg};color:${t.text}}
${decoCSS}
.bg-ov{position:fixed;inset:0;z-index:0;pointer-events:none;${bgOvStyle}opacity:.35}
.slides-wrap{position:relative;width:100vw;height:100vh;overflow:hidden}
.slide{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;
  padding:2rem 5vw 5rem;opacity:0;transform:translateX(70px);transition:opacity .5s ease,transform .5s ease;
  pointer-events:none;overflow-y:auto;background:${t.bg}${bgOvStyle ? '99' : ''}}
.slide.active{opacity:1;transform:none;pointer-events:all;z-index:2}
.slide.out-left{opacity:0;transform:translateX(-70px);z-index:1}
.sl-c{position:relative;z-index:5;width:100%;max-width:1080px}
.sl-eye{display:inline-block;font-size:.65rem;letter-spacing:.18em;text-transform:uppercase;
  color:${t.accent};margin-bottom:.75rem;padding:.18rem .9rem;border:1px solid ${t.border};border-radius:99px}
.sl-h1{font-size:clamp(1.6rem,4vw,3rem);font-weight:800;line-height:1.15;margin-bottom:.8rem;color:${t.text}}
.sl-sub{font-size:clamp(.85rem,1.4vw,1rem);color:${t.muted};max-width:660px;margin:0 auto 1rem;line-height:1.65;text-align:center}
.sl-meta{display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap;font-size:.68rem;color:${t.muted};margin-top:.8rem}
.sl-h2{font-size:clamp(1rem,2vw,1.45rem);font-weight:700;color:${t.text};margin-bottom:1.2rem;
  padding-bottom:.45rem;border-bottom:1px solid ${t.border};text-align:left}
.sl-txt{font-size:.78rem;color:${t.muted};line-height:1.75;text-align:left;max-width:820px}
/* KPIs */
.kpi-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.8rem;width:100%}
.kc{background:${t.card};border:1px solid ${t.border};border-radius:14px;padding:1.1rem .9rem;text-align:center;
  box-shadow:${t.glow};animation:fadeUp .5s ease both;animation-delay:calc(var(--i)*.08s)}
.kc-ico{font-size:1.5rem;margin-bottom:.4rem}
.kc-val{font-size:clamp(1rem,2vw,1.45rem);font-weight:800;color:${t.accent}}
.kc-u{font-size:.6rem;color:${t.muted};margin-left:.2rem}
.kc-lbl{font-size:.65rem;color:${t.muted};margin-top:.28rem;line-height:1.3}
/* Charts */
.ch-w{position:relative;width:100%;height:52vh;max-height:360px}
.ch-row{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;width:100%}
.ch-dw{position:relative;height:48vh;max-height:320px}
/* Findings */
.fn-list{display:flex;flex-direction:column;gap:.65rem;width:100%;text-align:left}
.fn-row{display:flex;gap:.9rem;align-items:flex-start;background:${t.card};
  border:1px solid ${t.border};border-left:3px solid ${t.accent};border-radius:10px;
  padding:.85rem .95rem;animation:fadeRight .45s ease both;animation-delay:calc(var(--i)*.1s)}
.fn-n{font-size:1.15rem;font-weight:800;color:${t.accent};min-width:2rem}
.fn-t{font-size:.79rem;line-height:1.65;color:${t.text}}
/* Synthesis */
.sy-row{display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem;width:100%;margin-bottom:1.3rem}
.sy-card{background:${t.card};border:1px solid ${t.border};border-radius:12px;padding:1.1rem .9rem;text-align:center;
  animation:fadeUp .5s ease both;animation-delay:calc(var(--i)*.1s)}
.sy-v{font-size:clamp(1.2rem,2.3vw,1.8rem);font-weight:800;color:${t.accent2}}
.sy-v small{font-size:.55em;color:${t.muted};margin-left:.15rem}
.sy-l{font-size:.68rem;color:${t.muted};margin-top:.28rem}
/* Sections */
.sc-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.1rem;width:100%;text-align:left}
.sc-blk{background:${t.card};border:1px solid ${t.border};border-radius:12px;padding:1.2rem;
  animation:fadeUp .5s ease both;animation-delay:calc(var(--i)*.12s)}
.sc-h{font-size:.85rem;font-weight:700;color:${t.accent};margin-bottom:.45rem}
.sc-p{font-size:.75rem;color:${t.muted};line-height:1.72}
/* Nav */
.pres-nav{position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%);display:flex;align-items:center;
  gap:1.1rem;z-index:99;background:rgba(0,0,0,.5);backdrop-filter:blur(14px);
  border:1px solid ${t.border};border-radius:50px;padding:.4rem 1.3rem}
.nav-b{background:none;border:none;color:${t.accent};font-size:1rem;cursor:pointer;padding:.18rem .4rem;
  border-radius:6px;transition:background .2s}
.nav-b:hover{background:${t.border}}
.nav-b:disabled{opacity:.28;cursor:default}
.p-dots{display:flex;gap:.32rem}
.dot{width:6px;height:6px;border-radius:50%;background:${t.border};transition:background .3s,transform .3s;cursor:pointer}
.dot.on{background:${t.accent};transform:scale(1.45)}
.p-cnt{font-size:.72rem;color:${t.muted};min-width:3rem;text-align:center;font-variant-numeric:tabular-nums}
.pres-logo{position:fixed;top:.9rem;right:1.2rem;font-size:.68rem;color:${t.muted};opacity:.55;z-index:50;letter-spacing:.06em}
.pres-logo strong{color:${t.accent}}
.txt-c{text-align:center}
/* Animations */
@keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@keyframes fadeRight{from{opacity:0;transform:translateX(-22px)}to{opacity:1;transform:none}}
@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
/* Responsive */
@media(max-width:640px){.kpi-g{grid-template-columns:repeat(2,1fr)}.sy-row{grid-template-columns:1fr}.ch-row{grid-template-columns:1fr}}
</style>
</head>
<body>
${bgOvStyle ? '<div class="bg-ov"></div>' : ''}
<div class="deco-bg"></div>
<div class="slides-wrap">

<!-- S0: Title -->
<div class="slide active" id="s0">
  <div class="sl-c txt-c">
    <span class="sl-eye">${esc(typeLabel)} · ${esc(date || new Date().getFullYear().toString())}</span>
    <h1 class="sl-h1">${esc(title.length > 90 ? title.substring(0,88)+'…' : title)}</h1>
    <p class="sl-sub">${esc((subtitle || genAnalyseGlobale(data)).substring(0, 200))}</p>
    <div class="sl-meta">
      ${source ? `<span>📌 ${esc(source)}</span>` : ''}
      <span>📅 ${esc(date || '')}</span>
      <span>✦ Algeria<strong>Tech</strong> Generator</span>
    </div>
  </div>
</div>

<!-- S1: KPIs -->
<div class="slide" id="s1">
  <div class="sl-c">
    <h2 class="sl-h2">⚡ Indicateurs clés de performance</h2>
    <div class="kpi-g">${kpiHTML || '<p style="color:'+t.muted+'">Aucun indicateur numérique extrait.</p>'}</div>
  </div>
</div>

<!-- S2: Bar chart -->
<div class="slide" id="s2">
  <div class="sl-c">
    <h2 class="sl-h2">📊 Analyse comparative des indicateurs</h2>
    <div class="ch-w"><canvas id="ch-bar"></canvas></div>
    <p class="sl-txt" style="margin-top:.8rem">${esc(analyseInd.substring(0, 230))}</p>
  </div>
</div>

<!-- S3: Donut -->
<div class="slide" id="s3">
  <div class="sl-c">
    <h2 class="sl-h2">🥧 Structure &amp; répartition</h2>
    <div class="ch-row">
      <div class="ch-dw"><canvas id="ch-donut"></canvas></div>
      <div style="display:flex;align-items:center"><p class="sl-txt">${esc(analyseRep.substring(0, 310))}</p></div>
    </div>
  </div>
</div>

<!-- S4: Findings -->
<div class="slide" id="s4">
  <div class="sl-c">
    <h2 class="sl-h2">🔍 Points clés &amp; constats</h2>
    <div class="fn-list">${findHTML || '<p style="color:'+t.muted+'">Aucun point clé identifié.</p>'}</div>
  </div>
</div>

<!-- S5: Synthesis -->
<div class="slide" id="s5">
  <div class="sl-c">
    <h2 class="sl-h2">📋 Synthèse exécutive</h2>
    <div class="sy-row">${synthHTML}</div>
    <p class="sl-txt">${esc(analyseSyn.substring(0, 380))}</p>
  </div>
</div>

${goodSects.length > 0 ? `<!-- S6: Sections -->
<div class="slide" id="s6">
  <div class="sl-c">
    <h2 class="sl-h2">📄 Extraits du document source</h2>
    <div class="sc-g">${sectsHTML}</div>
  </div>
</div>` : ''}

</div><!-- /slides-wrap -->

<nav class="pres-nav">
  <button class="nav-b" id="bp" disabled>◀</button>
  <div class="p-dots">${Array.from({length:nSlides},(_,i)=>`<span class="dot${i===0?' on':''}" data-i="${i}"></span>`).join('')}</div>
  <span class="p-cnt" id="cnt">1 / ${nSlides}</span>
  <button class="nav-b" id="bn">▶</button>
</nav>
<div class="pres-logo">Algeria<strong>Tech</strong> Generator</div>

<script>
const N=${nSlides};
const ACC=${JSON.stringify(t.accent)};
const ACC2=${JSON.stringify(t.accent2)};
const PAL=${JSON.stringify(pal)};
const BG=${JSON.stringify(t.bg)};
const MUTED=${JSON.stringify(t.muted)};
const BAR_L=${barLabels};
const BAR_V=${barValues};
const BAR_C=${barColors};
const DGH_L=${doughLabels};
const DGH_V=${doughValues};
const DGH_C=${doughColors};
const EVO_L=${evoLabels};
const EVO_V=${evoValues};

Chart.defaults.font.family="'Manrope',sans-serif";
Chart.defaults.color=MUTED;
Chart.defaults.borderColor='rgba(255,255,255,.05)';

let cur=0;
const slides=Array.from(document.querySelectorAll('.slide'));
const dots=Array.from(document.querySelectorAll('.dot'));
const cnt=document.getElementById('cnt');
const bp=document.getElementById('bp');
const bn=document.getElementById('bn');
const done=new Set();

function goto(n){
  if(n<0||n>=N)return;
  slides[cur].classList.remove('active');
  slides[cur].classList.add('out-left');
  const prev=cur; cur=n;
  setTimeout(()=>slides[prev].classList.remove('out-left'),520);
  slides[cur].classList.add('active');
  dots.forEach((d,i)=>d.classList.toggle('on',i===cur));
  cnt.textContent=(cur+1)+' / '+N;
  bp.disabled=cur===0; bn.disabled=cur===N-1;
  lazyChart(cur);
}

bn.addEventListener('click',()=>goto(cur+1));
bp.addEventListener('click',()=>goto(cur-1));
dots.forEach(d=>d.addEventListener('click',()=>goto(+d.dataset.i)));
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key===' ')goto(cur+1);
  if(e.key==='ArrowLeft')goto(cur-1);
});
let tx=0;
document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX},{passive:true});
document.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-tx;if(Math.abs(dx)>40)goto(dx<0?cur+1:cur-1)},{passive:true});

function lazyChart(idx){
  if(done.has(idx))return;
  done.add(idx);
  if(idx===2&&BAR_L.length){
    const ctx=document.getElementById('ch-bar');
    if(ctx)new Chart(ctx,{type:'bar',data:{labels:BAR_L,datasets:[{label:'Valeur',data:BAR_V,
      backgroundColor:BAR_C.map(c=>c+'bb'),borderColor:BAR_C,borderWidth:1,borderRadius:8}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:MUTED,maxRotation:35}},
                y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:MUTED}}},
        animation:{duration:900,easing:'easeOutQuart'}}});
  }
  if(idx===3&&DGH_L.length){
    const ctx=document.getElementById('ch-donut');
    if(ctx)new Chart(ctx,{type:'doughnut',data:{labels:DGH_L,datasets:[{data:DGH_V,
      backgroundColor:DGH_C,borderColor:BG,borderWidth:3,hoverOffset:12}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
        plugins:{legend:{position:'right',labels:{color:MUTED,padding:12,usePointStyle:true}}},
        animation:{animateRotate:true,animateScale:true,duration:900}}});
  }
}
lazyChart(0);
<\/script>
</body>
</html>`;
}

// ─── Fonction principale ───────────────────────────────────────────────────────

async function buildInfographie(data, opts = {}) {
  const { docType = 'rapport' } = data;
  const animType      = opts.animType      || '';
  const bgTheme       = opts.bgTheme       || 'none';
  const slideTemplate = opts.slideTemplate || 'none';
  const bgImage  = opts.bgImage  || 'none';

  // Domain = docType extended with new domains
  const domain = data.domain || docType;
  const pal = PALETTES[domain] || PALETTES[docType] || PALETTES.rapport;

  const baseSlug = slugify(data.title || 'rapport');
  const slug     = baseSlug + '-' + Date.now().toString(36);

  const dir      = path.join(INFOGRAPHIES, slug);
  const assetsJS  = path.join(dir, 'assets', 'js');
  const assetsCSS = path.join(dir, 'assets', 'css');
  const assetsImg = path.join(dir, 'assets', 'img');
  ensureDir(assetsJS);
  ensureDir(assetsCSS);
  ensureDir(assetsImg);

  // Fichiers principaux — slide template ou infographie standard
  if (slideTemplate && slideTemplate !== 'none') {
    fs.writeFileSync(path.join(dir, 'index.html'), genSlideHTML(data, slug, pal, domain, slideTemplate, bgTheme, bgImage), 'utf8');
    // data.js reste utile pour exports éventuels
    fs.writeFileSync(path.join(assetsJS, 'data.js'), genDataJS(data, pal), 'utf8');
  } else {
    fs.writeFileSync(path.join(dir, 'index.html'),         genIndexHTML(data, slug, pal, domain, bgTheme, bgImage), 'utf8');
    fs.writeFileSync(path.join(assetsCSS, 'styles.css'),   genExtraCSS(),                    'utf8');
    fs.writeFileSync(path.join(assetsJS, 'data.js'),       genDataJS(data, pal),             'utf8');
    fs.writeFileSync(path.join(assetsJS, 'charts.js'),     genChartsJSDomain(data, pal, domain), 'utf8');
    fs.writeFileSync(path.join(assetsJS, 'scene3d.js'),    genScene3DJS(domain, pal, animType), 'utf8');
    fs.writeFileSync(path.join(assetsJS, 'main.js'),       genMainJS(!!(data.chartData?.labels?.length >= 3)), 'utf8');
    fs.writeFileSync(path.join(assetsJS, 'exports.js'),    genExportsJS(slug, data.title),   'utf8');
  }

  // Thumbnail SVG
  const thumb = genThumbnailSVG(data.title, pal);
  fs.writeFileSync(path.join(dir, 'thumbnail.svg'),      thumb, 'utf8');
  fs.writeFileSync(path.join(assetsImg, 'thumbnail.svg'),thumb, 'utf8');

  // Mise à jour interactifs-list.json
  updateList(slug, data.title);

  return {
    slug,
    url:   `/infographies/${slug}/`,
    path:  dir,
    title: data.title
  };
}

module.exports = { buildInfographie };
