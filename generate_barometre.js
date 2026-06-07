'use strict';
/**
 * Algeria Tech — Generateur Barometre Mensuel
 * Lit veille_data.json + tic_social.json + revue_presse.json
 * Produit : barometre_data.json  (rapport du mois courant)
 *           barometre_history.json (12 derniers mois pour comparaisons)
 */
const fs   = require('fs');
const path = require('path');

function loadJson(file, fallback) {
  const full = path.join(__dirname, file);
  try {
    if (fs.existsSync(full)) return JSON.parse(fs.readFileSync(full, 'utf-8'));
  } catch(e) { console.warn('[BARO] Lecture echouee :', file, e.message); }
  return fallback;
}

// ── Taxonomie thematique ───────────────────────────────────────────────────────
const TOPICS = [
  { key: '5G & Reseaux Mobiles',      emoji: '📡', kw: ['5g','4g','lte','reseau mobile','couverture mobile','frequence','antenne','nsa'] },
  { key: 'Intelligence Artificielle', emoji: '🤖', kw: ['intelligence artificielle','machine learning','deep learning','chatgpt','llm','ia generative','ia ','generative ai','donnees','data science','neural'] },
  { key: 'Cybersecurite',             emoji: '🔒', kw: ['cybersecurite','securite','hacking','phishing','ransomware','malware','cyberattaque','violation','credentials','fraude informatique'] },
  { key: 'Startups & Innovation',     emoji: '🚀', kw: ['startup','fintech','levee de fonds','incubateur','accelerateur','innovation','seed','serie a','entrepreneurs'] },
  { key: 'E-commerce & Paiement',     emoji: '🛒', kw: ['e-commerce','commerce electronique','marketplace','dahabia','cib','baridimob','paiement mobile','livraison'] },
  { key: 'Operateurs & Telecom',      emoji: '📶', kw: ['mobilis','djezzy','ooredoo','algerie telecom','operateur','abonnement','forfait','resiliation'] },
  { key: 'Fibre Optique',             emoji: '🔌', kw: ['fibre','ftth','fttx','haut debit','tres haut debit','connexion filaire','debit'] },
  { key: 'Cloud & Data Center',       emoji: '☁️', kw: ['cloud','data center','azure','aws','hebergement','infrastructure cloud','stockage','sauvegarde'] },
  { key: 'Satellite & Spatial',       emoji: '🛰️', kw: ['satellite','alcomsat','spatial','orbite','espace algerien'] },
  { key: 'Regulation & Politique',    emoji: '⚖️', kw: ['arpt','regulation','reglementation','decret','politique numerique','ministere du numerique','conformite'] },
  { key: 'E-gouvernement',            emoji: '🏛️', kw: ['algerie numerique','e-gouvernement','dematerialisation','administration numerique','service public','numerique gouvernement'] },
  { key: 'Formation & Emploi TIC',    emoji: '🎓', kw: ['formation','certification','competences','emploi tech','ingenieur','huawei ict','cisco academie','universite tech'] },
];

const POS_KW = ['lance','succes','croissance','innovation','investissement','record','amelioration',
  'avance','developpement','nouveau','solution','opportunite','partenariat','accord','contrat',
  'premiere','expansion','ouverture','hausse','deploiement','signature','depasse','gagne',
  'progression','augmentation','excellence','prix','recompense','meilleur','officialise','inaugure'];

const NEG_KW = ['probleme','panne','incident','hack','fraude','retard','difficulte','crise','baisse',
  'chute','blocage','suspendu','interdit','risque','menace','cyberattaque','fuite','vol','arnaque',
  'lenteur','violation','perte','rupture','fermeture','defaillance','erreur','escroquerie','attaque'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreSentiment(text) {
  const t = normalize(text);
  const pos = POS_KW.filter(k => t.includes(k)).length;
  const neg = NEG_KW.filter(k => t.includes(k)).length;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

function matchTopics(text) {
  const t = normalize(text);
  return TOPICS
    .map((topic, i) => {
      const hits = topic.kw.filter(k => t.includes(k)).length;
      return hits > 0 ? i : -1;
    })
    .filter(i => i >= 0);
}

const FR_MONTHS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin',
                   'Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
// Avec accents pour l'affichage
const FR_MONTHS_ACC = ['Janvier','Février','Mars','Avril','Mai','Juin',
                       'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function frPeriodLabel(period) {
  const [y, m] = period.split('-');
  return FR_MONTHS_ACC[parseInt(m, 10) - 1] + ' ' + y;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[BARO] ── Analyse Barometre Mensuel ─────────────────────');

  const veille  = loadJson('veille_data.json',    { feed: [] });
  const social  = loadJson('tic_social.json',     { posts: [] });
  const presse  = loadJson('revue_presse.json',   { articles: [] });
  const history = loadJson('barometre_history.json', { months: [] });

  // ── Normalisation de toutes les sources ────────────────────────────────────
  const articles = [];

  for (const a of (veille.feed || [])) {
    articles.push({
      text:   (a.title || '') + ' ' + (a.tags || []).join(' '),
      source: a.source || 'Inconnu',
      date:   a.date   || '',
      type:   'veille',
    });
  }

  for (const p of (social.posts || [])) {
    const textFr = (p.text && p.text.fr) ? p.text.fr : '';
    const textAr = (p.text && p.text.ar) ? p.text.ar : '';
    const fullText = (p.source_name || '') + ' ' + p.category + ' ' + textFr + ' ' + textAr;
    if (fullText.trim().length > 10) {
      articles.push({
        text:   fullText,
        source: p.source_name || 'Social',
        date:   p.date || '',
        type:   'social',
      });
    }
  }

  for (const a of (presse.articles || [])) {
    articles.push({
      text:   (a.titre || '') + ' ' + (a.resume || '') + ' ' + (a.categorie || ''),
      source: a.source || 'Presse',
      date:   a.date   || '',
      type:   'presse',
    });
  }

  console.log('[BARO] Articles total :', articles.length,
    `(veille:${(veille.feed||[]).length} social:${(social.posts||[]).length} presse:${(presse.articles||[]).length})`);

  // ── Periode ────────────────────────────────────────────────────────────────
  const now    = new Date();
  const period = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  // ── Comptages ─────────────────────────────────────────────────────────────
  const topicCounts   = TOPICS.map(() => 0);
  const sentimentCnt  = { positive: 0, negative: 0, neutral: 0 };
  const sourceCounts  = {};

  for (const a of articles) {
    const indices = matchTopics(a.text);
    indices.forEach(i => topicCounts[i]++);

    const sent = scoreSentiment(a.text);
    sentimentCnt[sent]++;

    const src = a.source || 'Inconnu';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }

  // ── Top 10 topics + tendances ──────────────────────────────────────────────
  const prevEntry = history.months && history.months.length > 0
    ? history.months[history.months.length - 1]
    : null;

  const topTopics = TOPICS
    .map((t, i) => ({ key: t.key, emoji: t.emoji, count: topicCounts[i] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(t => {
      const prev  = prevEntry ? (prevEntry.topics || []).find(p => p.key === t.key) : null;
      const prevC = prev ? prev.count : null;
      const delta = prevC !== null ? t.count - prevC : null;
      const pct   = (prevC !== null && prevC > 0) ? Math.round((delta / prevC) * 100) : null;
      return { ...t, prev_count: prevC, trend: delta, trend_pct: pct };
    });

  // ── Sentiment ─────────────────────────────────────────────────────────────
  const total = articles.length || 1;
  const sentiment = {
    positive:     sentimentCnt.positive,
    negative:     sentimentCnt.negative,
    neutral:      sentimentCnt.neutral,
    positive_pct: Math.round(sentimentCnt.positive / total * 100),
    negative_pct: Math.round(sentimentCnt.negative / total * 100),
    neutral_pct:  Math.round(sentimentCnt.neutral  / total * 100),
  };

  // ── Top 5 sources ──────────────────────────────────────────────────────────
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, count]) => ({ source, count }));

  // ── Highlights automatiques ────────────────────────────────────────────────
  const highlights = [];
  if (topTopics[0])
    highlights.push('"' + topTopics[0].key + '" est le sujet dominant ce mois avec ' + topTopics[0].count + ' occurrences dans les publications.');

  const rising = topTopics.filter(t => t.trend_pct !== null && t.trend_pct >= 20)[0];
  if (rising)
    highlights.push('"' + rising.key + '" en forte hausse : +' + rising.trend_pct + '% par rapport au mois precedent.');

  const falling = topTopics.filter(t => t.trend_pct !== null && t.trend_pct <= -20)[0];
  if (falling)
    highlights.push('"' + falling.key + '" en recul : ' + falling.trend_pct + '% par rapport au mois precedent.');

  if (sentiment.positive_pct >= 40)
    highlights.push('Climat positif : ' + sentiment.positive_pct + '% des publications expriment un sentiment favorable.');
  else if (sentiment.negative_pct >= 20)
    highlights.push('Attention : ' + sentiment.negative_pct + '% des publications expriment un sentiment negatif.');
  else
    highlights.push('Sentiment global equilibre : ' + sentiment.positive_pct + '% positif, ' + sentiment.negative_pct + '% negatif sur ' + total + ' publications.');

  // ── Rapport JSON ──────────────────────────────────────────────────────────
  const report = {
    generated:    now.toISOString(),
    period,
    period_label: frPeriodLabel(period),
    stats: {
      articles_total:  articles.length,
      veille_articles: (veille.feed    || []).length,
      social_posts:    (social.posts   || []).length,
      presse_articles: (presse.articles|| []).length,
      sources_count:   Object.keys(sourceCounts).length,
    },
    top_topics:  topTopics,
    sentiment,
    top_sources: topSources,
    highlights,
    previous_period: prevEntry
      ? { period: prevEntry.period, period_label: frPeriodLabel(prevEntry.period) }
      : null,
  };

  fs.writeFileSync(
    path.join(__dirname, 'barometre_data.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  console.log('[BARO] barometre_data.json ecrit.');

  // ── Historique (12 mois max) ───────────────────────────────────────────────
  let months = (history.months || []).filter(m => m.period !== period);
  months.push({
    period,
    generated:            now.toISOString(),
    articles_total:       articles.length,
    topics:               topTopics.map(t => ({ key: t.key, count: t.count })),
    sentiment_pos_pct:    sentiment.positive_pct,
    sentiment_neg_pct:    sentiment.negative_pct,
    top_topic:            topTopics[0]?.key || '',
  });
  if (months.length > 12) months = months.slice(-12);

  fs.writeFileSync(
    path.join(__dirname, 'barometre_history.json'),
    JSON.stringify({ months }, null, 2),
    'utf-8'
  );
  console.log('[BARO] barometre_history.json mis a jour (' + months.length + ' mois).');
  console.log('[BARO] ── Termine : ' + period + ' (' + articles.length + ' publications) ──');
}

main().catch(e => { console.error('[BARO] ERREUR FATALE :', e); process.exit(1); });
