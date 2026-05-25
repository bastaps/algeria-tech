const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlgeriaTech-RevueBot/11.0' },
    timeout: 15000,
});

// CHANGEMENT : On utilise MISTRAL_API_KEY
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const OUTPUT_FILE = path.join(__dirname, 'revue_presse.json');

if (!MISTRAL_API_KEY) {
    console.error("❌ MISTRAL_API_KEY non définie. Tapez : $env:MISTRAL_API_KEY='VOTRE_CLE'");
    process.exit(1);
}

const SOURCES = [
    { url: 'https://itmag.dz/feed/',                       name: 'ITMAG.dz',         pays: 'DZ' },
    { url: 'https://dz-tech.news/fr/feed/',                name: 'DZ-Tech',          pays: 'DZ' },
    { url: 'https://www.tsa-algerie.dz/feed/',             name: 'TSA Algérie',      pays: 'DZ' },
    { url: 'https://lesenjeuxeco.dz/category/tic/feed/',   name: 'Les Enjeux Éco',   pays: 'DZ' },
    { url: 'https://www.algerie360.com/category/high-tech/feed/', name: 'Algérie360 Tech', pays: 'DZ' },
    { url: 'https://www.algerie-eco.com/feed/',            name: 'Algérie Éco',      pays: 'DZ' },
    { url: 'https://www.aps.dz/fr/algerie/education-et-technologie?format=feed&type=rss', name: 'APS', pays: 'DZ' },
    { url: 'https://elwatan-dz.com/feed',                  name: 'El Watan',         pays: 'DZ' },
    { url: 'https://www.silicon.fr/feed',                  name: 'Silicon.fr',       pays: 'FR' },
    { url: 'https://www.zdnet.fr/feed/',                   name: 'ZDNet France',     pays: 'FR' },
    { url: 'https://www.usine-digitale.fr/rss/',           name: 'Usine Digitale',   pays: 'FR' },
    { url: 'https://www.frandroid.com/feed',               name: 'Frandroid',        pays: 'FR' },
    { url: 'https://www.01net.com/feed/',                  name: '01net',            pays: 'FR' },
    { url: 'https://www.numerama.com/feed/',               name: 'Numerama',         pays: 'FR' },
    { url: 'https://www.usinenouvelle.com/rss/',           name: "L'Usine Nouvelle", pays: 'FR' },
    { url: 'https://www.journaldunet.com/telecharger/rss/ebusiness.xml', name: 'Journal du Net', pays: 'FR' }
];

const TECH_KW = ['tic', 'télécom', 'mobile', 'startup', 'innovation', 'tech', 'numérique', 'internet', 'data', 'ia', 'intelligence artificielle', 'fibre', 'algérie', '5g', '4g', 'réseau', 'digital', 'cybersécurité', 'cloud', 'djezzy', 'ooredoo', 'mobilis'];

function logoUrl(sourceName) {
    const domainMap = { 'ITMAG.dz': 'itmag.dz', 'DZ-Tech': 'dz-tech.news', 'TSA Algérie': 'tsa-algerie.dz', 'Les Enjeux Éco': 'lesenjeuxeco.dz', 'Algérie360 Tech': 'algerie360.com', 'APS': 'aps.dz', 'El Watan': 'elwatan-dz.com', 'Algérie Éco': 'algerie-eco.com', 'Silicon.fr': 'silicon.fr', 'ZDNet France': 'zdnet.fr', 'Usine Digitale': 'usine-digitale.fr', 'Frandroid': 'frandroid.com', '01net': '01net.com', 'Numerama': 'numerama.com', "L'Usine Nouvelle": 'usinenouvelle.com', 'Journal du Net': 'journaldunet.com' };
    return `https://www.google.com/s2/favicons?domain=${domainMap[sourceName] || 'google.com'}&sz=32`;
}

async function fetchRSS(source) {
    try {
        const feed = await parser.parseURL(source.url);
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // timestamp ms — STRICT 24h
        return feed.items
            .filter(item => {
                const rawDate = item.isoDate || item.pubDate;
                if (!rawDate) return false;                          // pas de date → rejeté
                const pubTs = new Date(rawDate).getTime();
                if (isNaN(pubTs))      return false;                 // date invalide → rejeté
                if (pubTs < cutoff)    return false;                 // > 24h → rejeté
                const text = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase();
                return TECH_KW.some(k => text.includes(k));
            })
            .map(item => ({
                titre: item.title.trim(),
                resume: (item.contentSnippet || '').substring(0, 150).replace(/<[^>]+>/g, '').trim(),
                url: item.link,
                date: item.isoDate || item.pubDate,
                source: source.name,
                logo: logoUrl(source.name),
                pays: source.pays,
            }))
            .slice(0, 3);
    } catch(e) {
        console.warn(`  ⚠️  ${source.name} : ${e.message}`);
        return [];
    }
}

// ── APPEL API MISTRAL (Plus stable que Gemini) ──────────────────────────────
async function callMistral(prompt) {
    const https = require('https');
    const endpoint = 'https://api.mistral.ai/v1/chat/completions';
    
    const payload = JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }, // Mistral supporte le JSON natif
        temperature: 0.1
    });

    return new Promise((resolve, reject) => {
        const req = https.request(endpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MISTRAL_API_KEY}`
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) reject(new Error(`Mistral Error ${res.statusCode}: ${data}`));
                    else resolve(JSON.parse(data));
                } catch(e) { reject(new Error("Erreur JSON Mistral")); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function processWithMistral(rawArticles) {
    const input = rawArticles.map((a, i) => ({ i, t: a.titre.substring(0, 100), s: a.source }));
    const prompt = `Agis en rédacteur AlgérieTech. Analyse cette liste d'articles tech des dernières 24h.
    1. Sélectionne les 12 articles les plus marquants.
    2. Pour chaque article: crée une accroche pro (15 mots) et une catégorie (Télécoms, IA, Startups, Mobile, Cybersécurité, Réseaux, ou Innovation).
    3. Rédige une synthèse globale de 3 phrases.
    Data:${JSON.stringify(input)}
    Réponds EXCLUSIVEMENT en JSON pur: {"synthese":"...", "selected":[{"i":0, "accroche":"...", "categorie":"..."}]}`;

    const response = await callMistral(prompt);
    const aiResult = JSON.parse(response.choices[0].message.content);
    
    const finalArticles = aiResult.selected.map(sel => {
        const orig = rawArticles[sel.i];
        return orig ? { ...orig, accroche: sel.accroche, categorie: sel.categorie } : null;
    }).filter(Boolean);

    return {
        date: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        synthese: aiResult.synthese,
        articles: finalArticles,
        lastUpdated: new Date().toISOString()
    };
}

async function main() {
    console.log('📡 SCAN RSS — FILTRE STRICT 24H...');
    const cutoffDisplay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`   Seuil : articles publiés après ${cutoffDisplay}`);

    const allResults = await Promise.all(SOURCES.map(async s => {
        const items = await fetchRSS(s);
        if (items.length > 0) console.log(`  • ${s.name.padEnd(22)} ✅ ${items.length} art.`);
        else                   console.log(`  • ${s.name.padEnd(22)} — 0 (aucun dans les 24h)`);
        return items;
    }));

    let rawArticles = allResults.flat();
    if (rawArticles.length === 0) {
        console.error('❌ Aucun article dans les 24 dernières heures. Aucun fichier écrit.');
        process.exit(1); // Échec visible dans GitHub Actions → notification
    }

    console.log(`\n🤖 IA MISTRAL SUR ${rawArticles.length} ARTICLES...`);
    const result = await processWithMistral(rawArticles);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ SUCCÈS : revue_presse.json généré (${result.articles.length} articles retenus).`);
}

main().catch(e => {
    console.error('\n❌ ERREUR FATALE :', e.message);
    process.exit(1); // Exit code 1 → GitHub Actions marque le job en échec
});