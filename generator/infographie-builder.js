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
  // sinon telecom → antennes par défaut
  const type = animType || (docType === 'telecom' ? 'antennes' : 'constellation');
  switch (type) {
    case 'antennes':      return genScene3DAntennesJS();
    case 'globe':         return genScene3DGlobeJS(pal);
    case 'hexagones':     return genScene3DHexagonsJS(pal);
    case 'vagues':        return genScene3DVaguesJS(pal);
    case 'cube':          return genScene3DCubeJS(pal);
    case 'neural':        return genScene3DNeuralJS(pal);
    // Aliases → scènes existantes adaptées
    case 'particules':    return genScene3DConstellationJS(pal);  // particules = constellation
    case 'pyramide':      return genScene3DConstellationJS(pal);  // pyramide = constellation
    case 'cristal':       return genScene3DConstellationJS(pal);  // cristal = constellation
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

// ─── Génération index.html — LE CŒUR PREMIUM ──────────────────────────────────

function genIndexHTML(data, slug, pal) {
  const {
    title, subtitle, date, source, docType,
    stats = [], keyPoints = [], sections = []
  } = data;

  const hasTime  = data.chartData && data.chartData.labels && data.chartData.labels.length >= 3;
  const typeLabels = {
    telecom:'Télécommunications', internet:'Internet & Réseaux',
    startup:'Startups & Innovation', rapport:'Rapport Officiel', presse:'Article de Presse'
  };
  const typeLabel = typeLabels[docType] || 'Rapport';

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

// ─── Fonction principale ───────────────────────────────────────────────────────

async function buildInfographie(data, opts = {}) {
  const { docType = 'rapport' } = data;
  const animType = opts.animType || '';
  const pal = PALETTES[docType] || PALETTES.rapport;

  const baseSlug = slugify(data.title || 'rapport');
  const slug     = baseSlug + '-' + Date.now().toString(36);

  const dir      = path.join(INFOGRAPHIES, slug);
  const assetsJS  = path.join(dir, 'assets', 'js');
  const assetsCSS = path.join(dir, 'assets', 'css');
  const assetsImg = path.join(dir, 'assets', 'img');
  ensureDir(assetsJS);
  ensureDir(assetsCSS);
  ensureDir(assetsImg);

  // Fichiers principaux
  fs.writeFileSync(path.join(dir, 'index.html'),         genIndexHTML(data, slug, pal),    'utf8');
  fs.writeFileSync(path.join(assetsCSS, 'styles.css'),   genExtraCSS(),                    'utf8');
  fs.writeFileSync(path.join(assetsJS, 'data.js'),       genDataJS(data, pal),             'utf8');
  fs.writeFileSync(path.join(assetsJS, 'charts.js'),     genChartsJS(data, pal),           'utf8');
  fs.writeFileSync(path.join(assetsJS, 'scene3d.js'),    genScene3DJS(docType, pal, animType), 'utf8');
  fs.writeFileSync(path.join(assetsJS, 'main.js'),       genMainJS(!!(data.chartData?.labels?.length >= 3)), 'utf8');
  fs.writeFileSync(path.join(assetsJS, 'exports.js'),    genExportsJS(slug, data.title),   'utf8');

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
