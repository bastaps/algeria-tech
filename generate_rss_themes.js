/**
 * generate_rss_themes.js
 * Génère 3 flux RSS thématiques XML (RSS 2.0) indépendants du flux veille existant.
 * Ne modifie ni update_veille.js, ni server.js, ni veille_data.json.
 * Usage : node generate_rss_themes.js
 */

'use strict';

const fs   = require('fs');
const https = require('https');
const path  = require('path');

const FEEDS_DIR = path.join(__dirname, 'feeds');
const SITE_URL  = 'https://algeria-tech.pages.dev';

// ─── Sources par thème ────────────────────────────────────────────────────────

const SOURCES = {
    // Priorité absolue : sources algériennes spécialisées TIC
    algerie: [
        { url: 'https://www.tsa-algerie.dz/feed/',                                     name: 'TSA Algérie',                  site: 'https://www.tsa-algerie.dz',        skipFilter: false },
        { url: 'https://lesenjeuxeco.dz/category/tic/feed/',                            name: 'Les Enjeux Éco — TIC',         site: 'https://lesenjeuxeco.dz',           skipFilter: true  },
        { url: 'https://www.algerie360.com/category/high-tech/feed/',                   name: 'Algérie 360 — High-Tech',      site: 'https://www.algerie360.com',        skipFilter: true  },
        { url: 'https://www.aps.dz/fr/algerie/education-et-technologie?format=feed&type=rss', name: 'APS — Éducation & Technologie', site: 'https://www.aps.dz',         skipFilter: false },
        { url: 'https://itmag.dz/feed/',                                                name: 'ItMag DZ',                     site: 'https://itmag.dz',                  skipFilter: true  },
        { url: 'https://dz-tech.news/fr/feed/',                                         name: 'DZ Tech News',                 site: 'https://dz-tech.news',              skipFilter: true  },
        { url: 'https://www.android-dz.com/feed/',                                      name: 'Android DZ',                   site: 'https://www.android-dz.com',        skipFilter: true  },
        { url: 'https://www.ntic-dz.com/feed/',                                         name: 'NTIC-DZ',                      site: 'https://www.ntic-dz.com',           skipFilter: true  },
        { url: 'https://www.indjazat.com/category/tic/feed/',                           name: 'Indjazat — TIC',               site: 'https://www.indjazat.com',          skipFilter: true  },
        { url: 'https://algerie-eco.com/category/tic-telecom/feed/',                       name: 'Algérie Éco — TIC/Télécom',    site: 'https://algerie-eco.com',           skipFilter: true  },
        { url: 'https://algerie-eco.com/category/technologies/feed/',                    name: 'Algérie Éco — Technologies',   site: 'https://algerie-eco.com',           skipFilter: true  },
        { url: 'https://www.ecomnewsmed.com/location/algerie/feed/',                    name: 'EcomNews Med — Algérie',       site: 'https://www.ecomnewsmed.com',       skipFilter: true  },
        { url: 'https://www.elmoudjahid.dz/fr/economie?format=feed&type=rss',            name: 'El Moudjahid — Économie',      site: 'https://www.elmoudjahid.dz',        skipFilter: false },
        { url: 'https://www.lesoirdalgerie.com/mobiles/feed/',                           name: "Le Soir d'Algérie — Mobiles",  site: 'https://www.lesoirdalgerie.com',    skipFilter: true  },
        { url: 'https://www.lesoirdalgerie.com/numerique-et-satellite/feed/',            name: "Le Soir d'Algérie — Numérique",site: 'https://www.lesoirdalgerie.com',    skipFilter: true  },
    ],

    // Francophonie hors Algérie
    francophone: [
        { url: 'https://www.frenchweb.fr/feed',                                         name: 'FrenchWeb',                    site: 'https://www.frenchweb.fr',          skipFilter: true  },
        { url: 'https://www.lemondeinformatique.fr/flux-rss/thematique-all-1.xml',       name: 'Le Monde Informatique',        site: 'https://www.lemondeinformatique.fr',skipFilter: true  },
        { url: 'https://www.journaldunet.com/rss/',                                      name: 'Journal du Net',               site: 'https://www.journaldunet.com',      skipFilter: false },
        { url: 'https://www.usine-digitale.fr/rss/',                                     name: 'Usine Digitale',               site: 'https://www.usine-digitale.fr',     skipFilter: true  },
        { url: 'https://www.rfi.fr/fr/rss/podcasts/revue-des-blogs',                     name: 'RFI — Afrique Numérique',      site: 'https://www.rfi.fr',                skipFilter: false },
        { url: 'https://www.01net.com/rss/actualites/',                                  name: '01net',                        site: 'https://www.01net.com',             skipFilter: false },
        { url: 'https://www.numerama.com/feed/',                                          name: 'Numerama',                     site: 'https://www.numerama.com',          skipFilter: false },
        { url: 'https://www.clubic.com/feed/',                                            name: 'Clubic',                       site: 'https://www.clubic.com',            skipFilter: false },
    ],

    // TIC & Digital — sources spécialisées internationales
    tic_digital: [
        { url: 'https://www.silicon.fr/feed',                                            name: 'Silicon.fr',                   site: 'https://www.silicon.fr',            skipFilter: true  },
        { url: 'https://www.zdnet.fr/feed/',                                              name: 'ZDNet France',                 site: 'https://www.zdnet.fr',              skipFilter: true  },
        { url: 'https://techcrunch.com/feed/',                                            name: 'TechCrunch',                   site: 'https://techcrunch.com',            skipFilter: false },
        { url: 'https://www.lemonde.fr/pixels/rss_full.xml',                              name: 'Le Monde — Pixels',            site: 'https://www.lemonde.fr',            skipFilter: true  },
        { url: 'https://www.wired.com/feed/rss',                                          name: 'Wired',                        site: 'https://www.wired.com',             skipFilter: false },
        { url: 'https://www.theverge.com/rss/index.xml',                                  name: 'The Verge',                    site: 'https://www.theverge.com',          skipFilter: false },
        { url: 'https://feeds.feedburner.com/TechCrunchFrance',                            name: 'TechCrunch France',            site: 'https://fr.techcrunch.com',         skipFilter: false },
        { url: 'https://www.reseaux-telecoms.net/rss.xml',                                name: 'Réseaux & Télécoms',           site: 'https://www.reseaux-telecoms.net',  skipFilter: true  },
    ]
};

// ─── Filtre de pertinence tech (regex avec limites de mots pour éviter les faux positifs) ──
const TECH_RE = /\btic\b|\bt[eé]l[eé]com|\bmobile\b|\bsmartphone|\bstartup|\binnovation|\btech\b|num[eé]rique|\binternet\b|\bdata\b|\b(?:i\.?a|ia)\b|intelligence artificielle|\bfibre\b|alg[eé]rie|\b5g\b|\b4g\b|r[eé]seau\b|op[eé]rateur|\bdigital\b|\bcloud\b|cybers[eé]curit|logiciel|\bhaut d[eé]bit|\bbroadband\b|\bsoftware\b|\bhardware\b|\bsatellite\b|\binformatique\b|\bblockchain\b|\bfintech\b|\bntic\b|\be-gov|\be-commerce|\bIA\b|5G|4G/;

function isTechRelevant(title, description) {
    const text = (title + ' ' + (description || '')).toLowerCase();
    return TECH_RE.test(text);
}

// ─── Détection des catégories thématiques ────────────────────────────────────
function detectCategories(title, description) {
    const text = (title + ' ' + (description || '')).toLowerCase();
    const cats = [];

    if (/t[eé]l[eé]com|op[eé]rateur|fibre|[45]g\b|lte|r[eé]seau|fai|voip|gsm|umts|fttx/.test(text))
        cats.push('Télécoms');
    if (/mobile|smartphone|iphone|android|tablette/.test(text))
        cats.push('Mobile');
    if (/startup|innovation|lev[eé]e de fonds|incubat|pitch|scale-up|fintech|accelerat/.test(text))
        cats.push('Startups');
    if (/internet|web|haut d[eé]bit|adsl|vdsl|fttx|broadband/.test(text))
        cats.push('Internet');
    if (/\bdata\b|big data|donn[eé]es|analytique|base de donn/.test(text))
        cats.push('Data');
    if (/intelligence artificielle|\bia\b|machine learning|deep learning|llm|gpt|chatgpt|gen[eé]ratif/.test(text))
        cats.push('IA');
    if (/num[eé]rique|digital|transformation|e-gov|e-gouvernement|e-commerce|gouvernement/.test(text))
        cats.push('Numérique');
    if (/cloud|saas|paas|iaas|h[eé]bergement|serveur|datacenter|centre de donn/.test(text))
        cats.push('Cloud');
    if (/cybers[eé]curit[eé]|s[eé]curit[eé] informatique|hack|phishing|malware|ransomware|vuln[eé]rabilit/.test(text))
        cats.push('Cybersécurité');

    return cats.length > 0 ? cats : ['Tech'];
}

// ─── Fetch via rss2json ───────────────────────────────────────────────────────
function fetchFeed(url) {
    return new Promise((resolve) => {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
        const req = https.get(apiUrl, { headers: { 'User-Agent': 'AlgeriaTech-RSSBot/2.0' }, timeout: 15000 }, res => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(raw)); }
                catch { resolve(null); }
            });
        });
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.on('error', () => resolve(null));
    });
}

// ─── Échappement XML ──────────────────────────────────────────────────────────
function xmlEscape(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ─── Date → RFC 2822 ──────────────────────────────────────────────────────────
function toRFC2822(dateStr) {
    try { return new Date(dateStr).toUTCString(); }
    catch { return new Date().toUTCString(); }
}

// ─── Strip HTML basique ───────────────────────────────────────────────────────
function stripHTML(str) {
    return (str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Construire le XML RSS 2.0 ────────────────────────────────────────────────
function buildRSS(meta, items) {
    const now = new Date().toUTCString();

    const itemsXML = items.slice(0, 100).map(item => {
        const catsXML = item.categories
            .map(c => `      <category>${xmlEscape(c)}</category>`)
            .join('\n');
        const desc = stripHTML(item.description).substring(0, 400);

        return `    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${xmlEscape(item.url)}</link>
      <description>${xmlEscape(desc)}</description>
      <pubDate>${toRFC2822(item.date)}</pubDate>
${catsXML}
      <source url="${xmlEscape(item.sourceUrl)}">${xmlEscape(item.sourceName)}</source>
      <guid isPermaLink="true">${xmlEscape(item.url)}</guid>
    </item>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xmlEscape(meta.title)}</title>
    <link>${xmlEscape(meta.link)}</link>
    <description>${xmlEscape(meta.description)}</description>
    <language>fr</language>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>AlgeriaTech RSS Generator v2.0</generator>
    <atom:link href="${xmlEscape(meta.selfUrl)}" rel="self" type="application/rss+xml"/>
${itemsXML}
  </channel>
</rss>`;
}

// ─── Collecter les articles d'un groupe de sources ───────────────────────────
async function collectItems(sources, isAlgeria) {
    const items = [];
    const seen  = new Set();

    for (const source of sources) {
        console.log(`    → ${source.name}`);
        const json = await fetchFeed(source.url);

        if (!json || json.status !== 'ok' || !Array.isArray(json.items)) {
            console.log(`      ⚠️  Échec ou flux vide`);
            continue;
        }

        let added = 0;
        for (const item of json.items) {
            if (!item.title || !item.link) continue;
            if (seen.has(item.link)) continue;

            // Filtre pertinence tech (ignoré pour sources déjà thématisées)
            if (!source.skipFilter && !isTechRelevant(item.title, item.description)) continue;

            seen.add(item.link);

            const cats = detectCategories(item.title, item.description);
            if (isAlgeria && !cats.includes('Algérie')) cats.unshift('Algérie');

            items.push({
                title      : item.title,
                url        : item.link,
                description: item.description || '',
                date       : item.pubDate || new Date().toISOString(),
                categories : cats,
                sourceName : source.name,
                sourceUrl  : source.site
            });
            added++;
        }
        console.log(`      ✓ ${added} articles retenus`);
    }

    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────
async function main() {
    console.log('\n[RSS-THEMES] ══════════════════════════════════════');
    console.log('[RSS-THEMES] Génération des 3 flux thématiques RSS');
    console.log('[RSS-THEMES] ══════════════════════════════════════\n');

    if (!fs.existsSync(FEEDS_DIR)) fs.mkdirSync(FEEDS_DIR, { recursive: true });

    // ── 1. Flux Algérie ───────────────────────────────────────────────────────
    console.log('[1/3] Flux ALGÉRIE (priorité)');
    const algerieItems = await collectItems(SOURCES.algerie, true);
    fs.writeFileSync(
        path.join(FEEDS_DIR, 'rss-algerie.xml'),
        buildRSS({
            title      : 'Algeria Tech — Veille Algérie (TIC & Numérique)',
            link       : SITE_URL,
            description: 'Actualités TIC, télécoms et numérique en Algérie. Sources algériennes spécialisées : TSA, ItMag, NTIC-DZ, Android-DZ, Indjazat, Algérie Éco, APS…',
            selfUrl    : `${SITE_URL}/feeds/rss-algerie.xml`
        }, algerieItems),
        'utf-8'
    );
    console.log(`    ✅ feeds/rss-algerie.xml — ${algerieItems.length} articles\n`);

    // ── 2. Flux International Francophone ────────────────────────────────────
    console.log('[2/3] Flux INTERNATIONAL FRANCOPHONE');
    const francoItems = await collectItems(SOURCES.francophone, false);
    fs.writeFileSync(
        path.join(FEEDS_DIR, 'rss-international-fr.xml'),
        buildRSS({
            title      : 'Algeria Tech — Veille Internationale Francophone (TIC)',
            link       : SITE_URL,
            description: 'Veille TIC en français, sources internationales hors Algérie : FrenchWeb, Le Monde Informatique, Usine Digitale, Journal du Net, RFI…',
            selfUrl    : `${SITE_URL}/feeds/rss-international-fr.xml`
        }, francoItems),
        'utf-8'
    );
    console.log(`    ✅ feeds/rss-international-fr.xml — ${francoItems.length} articles\n`);

    // ── 3. Flux TIC & Digital ────────────────────────────────────────────────
    console.log('[3/3] Flux TIC & DIGITAL');
    const ticItems = await collectItems(SOURCES.tic_digital, false);
    fs.writeFileSync(
        path.join(FEEDS_DIR, 'rss-tic-digital.xml'),
        buildRSS({
            title      : 'Algeria Tech — Flux TIC & Digital',
            link       : SITE_URL,
            description: 'Télécoms, startups, innovations, internet, mobile, data, opérateurs, réseaux. Silicon.fr, ZDNet, TechCrunch, Wired, Le Monde Pixels…',
            selfUrl    : `${SITE_URL}/feeds/rss-tic-digital.xml`
        }, ticItems),
        'utf-8'
    );
    console.log(`    ✅ feeds/rss-tic-digital.xml — ${ticItems.length} articles\n`);

    // ── Résumé ───────────────────────────────────────────────────────────────
    const total = algerieItems.length + francoItems.length + ticItems.length;
    console.log('[RSS-THEMES] ══════════════════════════════════════');
    console.log(`[RSS-THEMES] ✅ Terminé — ${total} articles au total`);
    console.log('[RSS-THEMES] Accès local :');
    console.log('  http://localhost:3000/feeds/rss-algerie.xml');
    console.log('  http://localhost:3000/feeds/rss-international-fr.xml');
    console.log('  http://localhost:3000/feeds/rss-tic-digital.xml');
    console.log('[RSS-THEMES] ══════════════════════════════════════\n');
}

main().catch(e => {
    console.error('[RSS-THEMES] Erreur fatale :', e.message);
    process.exit(1);
});
