/**
 * Algeria Tech — Mise à jour Veille RSS
 * Remplace l'API rss2json.com (quota 10k/mois dépassé) par rss-parser direct.
 */
'use strict';

const fs        = require('fs');
const path      = require('path');
const Parser    = require('rss-parser');

const VEILLE_FILE = path.join(__dirname, 'veille_data.json');
const MAX_ITEMS   = 150;
const TIMEOUT_MS  = 12000;

// ── Chargement / sauvegarde ────────────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(VEILLE_FILE)) {
      return JSON.parse(fs.readFileSync(VEILLE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[VEILLE] Lecture échouée :', e.message);
  }
  return { manual: [], feed: [], lastUpdated: new Date().toISOString() };
}

function saveData(data) {
  fs.writeFileSync(VEILLE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Sources RSS ────────────────────────────────────────────────────────────────
const FEEDS = [
  // Algérie TIC
  { url: 'https://www.tsa-algerie.dz/feed/',                              label: 'TSA' },
  { url: 'https://lesenjeuxeco.dz/category/tic/feed/',                    label: 'Les Enjeux Eco' },
  { url: 'https://www.algerie360.com/category/high-tech/feed/',           label: 'Algérie 360' },
  { url: 'https://itmag.dz/feed/',                                        label: 'ITMag DZ' },
  { url: 'https://dz-tech.news/fr/feed/',                                 label: 'DZ Tech News' },
  { url: 'https://www.android-dz.com/feed/',                              label: 'Android DZ' },
  { url: 'https://www.ntic-dz.com/feed/',                                 label: 'NTIC DZ' },
  { url: 'https://algerie-eco.com/feed/',                                 label: 'Algérie Eco' },
  { url: 'https://www.ecomnewsmed.com/location/algerie/feed/',            label: 'EcomNews Med' },
  { url: 'https://www.elwatan.com/feed/',                                 label: 'El Watan' },
  { url: 'https://www.lesoirdalgerie.com/mobiles/feed/',                  label: 'Le Soir DZ Mobiles' },
  { url: 'https://www.lesoirdalgerie.com/numerique-et-satellite/feed/',   label: 'Le Soir DZ Numérique' },
  // International TIC
  { url: 'https://www.silicon.fr/feed',                                   label: 'Silicon.fr' },
  { url: 'https://www.zdnet.fr/feed/',                                    label: 'ZDNet FR' },
  { url: 'https://techcrunch.com/feed/',                                  label: 'TechCrunch' },
  { url: 'https://www.lemonde.fr/pixels/rss_full.xml',                    label: 'Le Monde Pixels' },
  { url: 'https://www.wired.com/feed/rss',                                label: 'Wired' },
];

// Mots-clés filtre (mêmes que l'ancienne version)
const TECH_KW = [
  'tic','telecom','télécoms','mobile','startup','innovation',
  'tech','numérique','internet','data','ia','fibre',
  'algerie','algérie','5g','réseau','opérateur','digital',
  'cybersécurité','logiciel','cloud','4g','wifi','satellite'
];

function isTech(text) {
  const t = text.toLowerCase();
  return TECH_KW.some(k => t.includes(k));
}

// ── Parsing RSS ────────────────────────────────────────────────────────────────
async function fetchFeed(feedCfg) {
  const parser = new Parser({
    timeout: TIMEOUT_MS,
    headers: { 'User-Agent': 'AlgeriaTech-Bot/2.0' },
    customFields: { item: ['media:content','media:thumbnail','enclosure'] }
  });

  try {
    const feed = await parser.parseURL(feedCfg.url);
    const items = [];

    for (const item of (feed.items || []).slice(0, 30)) {
      if (!item.title || !item.link) continue;
      const text = (item.title + ' ' + (item.contentSnippet || item.summary || '')).slice(0, 500);
      if (!isTech(text)) continue;

      items.push({
        id:       Buffer.from(item.link).toString('base64').substring(0, 16),
        title:    item.title.trim(),
        url:      item.link,
        tags:     text.toLowerCase().includes('algeri') ? ['Algérie', 'Tech'] : ['Tech', 'Actualité'],
        date:     item.pubDate || item.isoDate || new Date().toISOString(),
        source:   feedCfg.label || feed.title || new URL(feedCfg.url).hostname.replace('www.',''),
        isManual: false
      });
    }

    console.log(`  [OK] ${feedCfg.label || feedCfg.url} → ${items.length} articles tech`);
    return items;
  } catch (e) {
    console.warn(`  [KO] ${feedCfg.label || feedCfg.url} : ${e.message}`);
    return [];
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[VEILLE] ── Démarrage ──────────────────────────────');
  const data = loadData();

  const existingUrls = new Set([
    ...data.feed.map(i => i.url),
    ...data.manual.map(i => i.url)
  ]);

  let newItems = [];

  for (const feedCfg of FEEDS) {
    const items = await fetchFeed(feedCfg);
    const fresh = items.filter(i => !existingUrls.has(i.url));
    fresh.forEach(i => existingUrls.add(i.url));
    newItems.push(...fresh);
  }

  data.feed = [...newItems, ...data.feed]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_ITEMS);

  data.lastUpdated = new Date().toISOString();
  saveData(data);

  console.log(`[VEILLE] Nouveaux : ${newItems.length} | Total : ${data.feed.length}`);
  console.log('[VEILLE] ── Terminé ────────────────────────────────');
}

main().catch(e => {
  console.error('[VEILLE] ERREUR FATALE :', e);
  process.exit(1);
});
