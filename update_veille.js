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
// skipFilter: true → source déjà thématisée TIC, pas besoin de filtrer
const FEEDS = [
  // Algérie TIC — sources thématisées (filtre désactivé)
  { url: 'https://lesenjeuxeco.dz/category/tic/feed/',                    label: 'Les Enjeux Eco',        skipFilter: true },
  { url: 'https://www.algerie360.com/category/high-tech/feed/',           label: 'Algérie 360',           skipFilter: true },
  { url: 'https://itmag.dz/feed/',                                        label: 'ITMag DZ',              skipFilter: true },
  { url: 'https://dz-tech.news/fr/feed/',                                 label: 'DZ Tech News',          skipFilter: true },
  { url: 'https://www.android-dz.com/feed/',                              label: 'Android DZ',            skipFilter: true },
  { url: 'https://www.ntic-dz.com/feed/',                                 label: 'NTIC DZ',               skipFilter: true },
  { url: 'https://www.lesoirdalgerie.com/mobiles/feed/',                  label: 'Le Soir DZ Mobiles',    skipFilter: true },
  { url: 'https://www.lesoirdalgerie.com/numerique-et-satellite/feed/',   label: 'Le Soir DZ Numérique',  skipFilter: true },
  // Algérie — presse générale (filtre strict activé)
  { url: 'https://www.tsa-algerie.dz/feed/',                              label: 'TSA' },
  { url: 'https://algerie-eco.com/feed/',                                 label: 'Algérie Eco' },
  { url: 'https://www.ecomnewsmed.com/location/algerie/feed/',            label: 'EcomNews Med' },
  { url: 'https://www.elwatan.com/feed/',                                 label: 'El Watan' },
  // International TIC — spécialisées (filtre désactivé)
  { url: 'https://www.silicon.fr/feed',                                   label: 'Silicon.fr',            skipFilter: true },
  { url: 'https://www.zdnet.fr/feed/',                                    label: 'ZDNet FR',              skipFilter: true },
  { url: 'https://www.lemonde.fr/pixels/rss_full.xml',                    label: 'Le Monde Pixels',       skipFilter: true },
  { url: 'https://www.wired.com/feed/rss',                                label: 'Wired',                 skipFilter: true },
  // International — filtre strict
  { url: 'https://techcrunch.com/feed/',                                  label: 'TechCrunch' },
];

// ── Filtre thématique ICT/Télécom — 5 domaines + termes transversaux ──────────
// Couvre : Infrastructures & Réseaux | Opérateurs & Mobile | Internet & Web
//          Data & Cybersécurité | Innovation & Recherche | Régulation & Matériel
const TECH_RE = new RegExp(
  // Thème 1 — Infrastructures et Réseaux
  '\\btic\\b|t[eé]l[eé]com|fibre\\b|\\bftth\\b|\\bftto\\b|\\bftta\\b' +
  '|câble.?sous.?marin|satellite|antenne.?relais|\\bbts\\b|\\bidoom\\b' +
  '|boucle.?locale|\\badsl\\b|\\bdslam\\b|datacenter|data.?center' +
  '|centre.?de.?donn|\\bixp\\b|backbone|r[eé]seau.?f[eé]d[eé]rateur' +
  '|small.?cell|micro.?cellule|\\bpon\\b|\\bvsat\\b|v-sat' +
  '|infrastructure.?r[eé]seau|interconnexion.?r[eé]seau' +
  // Thème 2 — Opérateurs et Services Mobiles
  '|\\bdjezzy\\b|\\booredoo\\b|\\bmobilis\\b|algérie.?télécom|algerie.?telecom' +
  '|\\b[2345]g\\b|\\blte\\b|\\bvolte\\b|t[eé]l[eé]phonie.?mobile' +
  '|t[eé]l[eé]phonie.?fixe|itin[eé]rance|\\broaming\\b|\\besim\\b|\\bmvno\\b' +
  '|\\bmnp\\b|portabilit[eé].?num[eé]ro|\\bran\\b|r[eé]seau.?acc[eè]s.?radio' +
  '|d[eé]ploiement.?r[eé]seau|qualit[eé].?de.?service|\\bqos\\b' +
  '|facturation.?interop[eé]rat|r[eé]seaux.?priv[eé]s.?mobiles|\\bmpn\\b' +
  // Thème 3 — Internet, Web et Communication
  '|\\binternet\\b|haut.?d[eé]bit|tr[eè]s.?haut.?d[eé]bit|\\bbroadband\\b' +
  '|\\bdns\\b|communication.?num[eé]rique|messagerie.?instantan[eé]e' +
  '|visioconf[eé]rence|\\bstreaming\\b|\\bcloud\\b|\\bsaas\\b|\\bpaas\\b' +
  '|internet.?des.?objets|\\biot\\b|web.?3|bande.?passante|\\blatence\\b' +
  '|\\bipv6\\b|h[eé]bergement.?web|\\bcdn\\b|\\bapi\\b|plateforme.?num[eé]rique' +
  '|trafic.?internet|wi-fi|\\bwifi\\b|wi.?fi.?[67]' +
  // Thème 4 — Data, Cybersécurité et Intelligence
  '|\\bdata\\b|big.?data|analyse.?de.?donn[eé]es|m[eé]tadonn[eé]es' +
  '|cybers[eé]curit[eé]|s[eé]curit[eé].?informatique|chiffrement|\\bcryptage\\b' +
  '|pare.?feu|\\bfirewall\\b|\\bvpn\\b|hame[çc]onnage|\\bphishing\\b' +
  '|\\bmalware\\b|\\bransomware\\b|souverainet[eé].?num[eé]rique|\\brgpd\\b' +
  '|cryptographie|\\bpentest\\b|test.?d.?intrusion|\\bsoc\\b|zero.?trust' +
  '|protection.?ddos|\\bddos\\b|authentification.?forte|\\bmfa\\b|\\b2fa\\b' +
  '|cloud.?souverain|analyse.?pr[eé]dictive|cybers[eé]curit[eé].?industrielle' +
  // Thème 5 — Innovation, Recherche et Prospective
  '|\\bstartup\\b|\\binnovation\\b|\\br&d\\b|recherche.?et.?d[eé]veloppement' +
  '|\\bingénierie\\b|\\blaboratoire\\b|\\bbrevet\\b|transfert.?technologique' +
  '|num[eé]risation|digitalisation|transformation.?num[eé]rique' +
  '|[eé]cosyst[eè]me.?num[eé]rique|\\bfintech\\b|\\bedtech\\b' +
  '|intelligence.?artificielle|\\bia\\b|machine.?learning|deep.?learning' +
  '|\\bdeeptech\\b|\\bhackathon\\b|\\bfablab\\b|\\bblockchain\\b' +
  '|smart.?city|ville.?intelligente|gouvernance.?num[eé]rique' +
  '|transformation.?digitale|[eé]conomie.?num[eé]rique|\\bllm\\b|\\bgpt\\b' +
  // Termes transversaux — Régulation, Matériel, Concepts
  '|\\barpce\\b|spectre.?de.?fr[eé]quences|licence.?d.?exploitation' +
  '|service.?universel|\\bsmartphone\\b|\\bmodem\\b|\\brouteur\\b' +
  '|objets.?connect[eé]s|\\bwearable\\b|interop[eé]rabilit[eé]' +
  '|virtualisation|\\bnfv\\b|\\bsdn\\b|fracture.?num[eé]rique' +
  '|d[eé]mat[eé]rialisation|neutralit[eé].?du.?net|inclusion.?num[eé]rique' +
  '|droit.?du.?num[eé]rique|litiges.?t[eé]l[eé]com|\\bntic\\b' +
  '|\\bnum[eé]rique\\b|\\bdigital\\b|\\btech\\b|\\binformatique\\b',
  'i'
);

function isTech(text) {
  return TECH_RE.test(text);
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
      if (!feedCfg.skipFilter && !isTech(text)) continue;

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
