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

// ─── Filtre thématique ICT/Télécom — 5 domaines + termes transversaux ───────────
const TECH_RE = new RegExp(
    // Thème 1 — Infrastructures et Réseaux
    'tic|t[eé]l[ée]com|fibre|ftth|ftto|ftta' +
    '|câble.?sous.?marin|satellite|antenne.?relais|bts|idoom' +
    '|boucle.?locale|adsl|dslam|datacenter|data.?center' +
    '|centre.?de.?donn|ixp|backbone|r[ée]seau.?f[ée]d[ée]rateur' +
    '|small.?cell|micro.?cellule|pon|vsat|v-sat' +
    '|infrastructure.?r[ée]seau|interconnexion.?r[ée]seau' +
    // Thème 2 — Opérateurs et Services Mobiles
    '|djezzy|ooredoo|mobilis|alg.rie.?t.l.com' +
    '|[2345]g|lte|volte|t[ée]l[ée]phonie.?mobile' +
    '|t[ée]l[ée]phonie.?fixe|itin[ée]rance|roaming|esim|mvno' +
    '|mnp|portabilit[ée].?num[ée]ro|ran|r[ée]seau.?acc[eè]s.?radio' +
    '|d[ée]ploiement.?r[ée]seau|qualit[ée].?de.?service|qos' +
    '|facturation.?interop[ée]rat|r[ée]seaux.?priv[ée]s.?mobiles|mpn' +
    // Thème 3 — Internet, Web et Communication
    '|internet|haut.?d[ée]bit|tr[èe]s.?haut.?d[ée]bit|broadband' +
    '|dns|communication.?num[ée]rique|messagerie.?instantan[ée]e' +
    '|visioconf[ée]rence|streaming|cloud|saas|paas' +
    '|internet.?des.?objets|iot|web.?3|bande.?passante|latence' +
    '|ipv6|h[ée]bergement.?web|cdn|api|plateforme.?num[ée]rique' +
    '|trafic.?internet|wi-fi|wifi|wi.?fi.?[67]' +
    // Thème 4 — Data, Cybersécurité et Intelligence
    '|data|big.?data|analyse.?de.?donn[ée]es|m[ée]tadonn[ée]es' +
    '|cybers[ée]curit[ée]|s[ée]curit[ée].?informatique|chiffrement|cryptage' +
    '|pare.?feu|firewall|vpn|hame[çc]onnage|phishing' +
    '|malware|ransomware|souverainet[ée].?num[ée]rique|rgpd' +
    '|cryptographie|pentest|test.?d.?intrusion|soc|zero.?trust' +
    '|protection.?ddos|ddos|authentification.?forte|mfa|2fa' +
    '|cloud.?souverain|analyse.?pr[ée]dictive|cybers[ée]curit[ée].?industrielle' +
    // Thème 5 — Innovation, Recherche et Prospective
    '|startup|innovation|r&d|recherche.?et.?d[ée]veloppement' +
    '|transfert.?technologique|num[ée]risation|digitalisation' +
    '|transformation.?num[ée]rique|[ée]cosyst[èe]me.?num[ée]rique' +
    '|fintech|edtech|intelligence.?artificielle|ia' +
    '|machine.?learning|deep.?learning|deeptech|hackathon' +
    '|fablab|blockchain|smart.?city|ville.?intelligente' +
    '|gouvernance.?num[ée]rique|transformation.?digitale|[ée]conomie.?num[ée]rique' +
    '|llm|gpt|chatgpt' +
    // Termes transversaux — Régulation, Matériel, Concepts
    '|arpce|spectre.?de.?fr[ée]quences|licence.?d.?exploitation' +
    '|service.?universel|smartphone|modem|routeur' +
    '|objets.?connect[ée]s|wearable|interop[ée]rabilit[ée]' +
    '|virtualisation|nfv|sdn|fracture.?num[ée]rique' +
    '|d[ée]mat[ée]rialisation|neutralit[ée].?du.?net|inclusion.?num[ée]rique' +
    '|droit.?du.?num[ée]rique|litiges.?t[ée]l[ée]com|ntic' +
    '|num[ée]rique|digital|tech|informatique' +
    '|logiciel|hardware|software|e-gov|e-commerce',
    'i'
);

function isTechRelevant(title, description) {
    const text = (title + ' ' + (description || '')).toLowerCase();
    return TECH_RE.test(text);
}

// ─── Détection des catégories thématiques (5 domaines ICT/Télécom) ───────────
function detectCategories(title, description) {
    const text = (title + ' ' + (description || '')).toLowerCase();
    const cats = [];

    // 1. Infrastructures et Réseaux
    if (/t[eé]l[eé]com|fibre|ftth|ftto|ftta|satellite|antenne.?relais|boucle.?locale|adsl|dslam|datacenter|data.?center|centre.?de.?donn|backbone|small.?cell|pon|vsat|infrastructure.?r[eé]seau|interconnexion.?r[eé]seau|nfv|sdn|virtualisation/.test(text))
        cats.push('Infrastructures & Réseaux');

    // 2. Opérateurs et Services Mobiles
    if (/djezzy|ooredoo|mobilis|[2345]g|lte|volte|t[eé]l[eé]phonie.?mobile|t[eé]l[eé]phonie.?fixe|itin[eé]rance|roaming|esim|mvno|mnp|portabilit|ran|d[eé]ploiement.?r[eé]seau|qos|qualit[eé].?de.?service|gsm|umts|voip|fai|op[eé]rateur|mobile|smartphone/.test(text))
        cats.push('Opérateurs & Mobile');

    // 3. Internet, Web et Communication
    if (/internet|haut.?d[eé]bit|tr[eè]s.?haut.?d[eé]bit|broadband|dns|communication.?num[eé]rique|messagerie.?instantan|visioconf[eé]rence|streaming|cloud|saas|paas|iaas|internet.?des.?objets|iot|web.?3|bande.?passante|latence|ipv6|h[eé]bergement.?web|cdn|plateforme.?num[eé]rique|trafic.?internet|wi-fi|wifi|adsl|vdsl/.test(text))
        cats.push('Internet & Web');

    // 4. Data, Cybersécurité et Intelligence
    if (/big.?data|donn[eé]es|analytique|base.?de.?donn|m[eé]tadonn|cybers[eé]curit|s[eé]curit[eé].?informatique|chiffrement|cryptage|pare.?feu|firewall|vpn|phishing|malware|ransomware|souverainet[eé].?num[eé]rique|rgpd|cryptographie|pentest|test.?d.?intrusion|soc|zero.?trust|ddos|mfa|2fa|cloud.?souverain|analyse.?pr[eé]dictive|vuln[eé]rabilit/.test(text))
        cats.push('Data & Cybersécurité');

    // 5. Innovation, Recherche et Prospective
    if (/startup|innovation|r&d|recherche.?et.?d[eé]veloppement|lev[eé]e.?de.?fonds|incubat|scale.?up|transfert.?technologique|num[eé]risation|digitalisation|transformation.?num[eé]rique|[eé]cosyst[eè]me.?num[eé]rique|fintech|edtech|intelligence.?artificielle|machine.?learning|deep.?learning|deeptech|hackathon|fablab|blockchain|smart.?city|ville.?intelligente|gouvernance.?num[eé]rique|transformation.?digitale|llm|gpt|chatgpt|gen[eé]ratif|brevet|laboratoire/.test(text))
        cats.push('Innovation & Recherche');

    // Termes transversaux (si aucune catégorie principale)
    if (cats.length === 0 && /arpce|spectre.?de.?fr[eé]quences|service.?universel|smartphone|modem|routeur|objets.?connect|wearable|interop[eé]rabilit|fracture.?num[eé]rique|d[eé]mat[eé]rialisation|neutralit[eé].?du.?net|inclusion.?num[eé]rique|droit.?du.?num[eé]rique|litiges.?t[eé]l[eé]com|ntic|num[eé]rique|digital|tech|informatique|logiciel/.test(text))
        cats.push('Tech & Numérique');

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
