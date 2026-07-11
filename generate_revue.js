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
    { url: 'https://elwatan-dz.com/feed',                  name: 'El Watan',              pays: 'DZ' },
    { url: 'https://www.android-dz.com/feed/',             name: 'Android DZ',            pays: 'DZ' },
    { url: 'https://www.ntic-dz.com/feed/',                name: 'NTIC.dz',               pays: 'DZ' },
    { url: 'https://www.ecomnewsmed.com/location/algerie/feed/', name: 'EcomNewsMed DZ',  pays: 'DZ' },
    { url: 'https://www.algerietelecom.dz/fr/espace-presse/feed/', name: 'AT Presse',     pays: 'DZ' },
    { url: 'https://www.indjazat.com/category/tic/feed/',  name: 'Indjazat TIC',          pays: 'DZ' },
    { url: 'https://www.elmoudjahid.dz/fr/economie/feed/', name: 'El Moudjahid Éco',      pays: 'DZ' },
    { url: 'https://www.lesoirdalgerie.com/mobiles/feed/', name: 'Le Soir Mobiles',        pays: 'DZ' },
    { url: 'https://www.lesoirdalgerie.com/numerique-et-satellite/feed/', name: 'Le Soir Numérique', pays: 'DZ' },
    { url: 'https://www.silicon.fr/feed',                  name: 'Silicon.fr',            pays: 'FR' },
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
    const domainMap = { 'ITMAG.dz': 'itmag.dz', 'DZ-Tech': 'dz-tech.news', 'TSA Algérie': 'tsa-algerie.dz', 'Les Enjeux Éco': 'lesenjeuxeco.dz', 'Algérie360 Tech': 'algerie360.com', 'APS': 'aps.dz', 'El Watan': 'elwatan-dz.com', 'Algérie Éco': 'algerie-eco.com', 'Android DZ': 'android-dz.com', 'NTIC.dz': 'ntic-dz.com', 'EcomNewsMed DZ': 'ecomnewsmed.com', 'AT Presse': 'algerietelecom.dz', 'Indjazat TIC': 'indjazat.com', 'El Moudjahid Éco': 'elmoudjahid.dz', 'Le Soir Mobiles': 'lesoirdalgerie.com', 'Le Soir Numérique': 'lesoirdalgerie.com', 'Silicon.fr': 'silicon.fr', 'ZDNet France': 'zdnet.fr', 'Usine Digitale': 'usine-digitale.fr', 'Frandroid': 'frandroid.com', '01net': '01net.com', 'Numerama': 'numerama.com', "L'Usine Nouvelle": 'usinenouvelle.com', 'Journal du Net': 'journaldunet.com' };
    return `https://www.google.com/s2/favicons?domain=${domainMap[sourceName] || 'google.com'}&sz=32`;
}

// Récolte large (48h) : le tri 24h/48h se fait en aval, sans re-télécharger les flux
async function fetchRSS(source) {
    try {
        const feed = await parser.parseURL(source.url);
        const cutoff = Date.now() - 48 * 60 * 60 * 1000;
        return feed.items
            .filter(item => {
                const rawDate = item.isoDate || item.pubDate;
                if (!rawDate) return false;                          // pas de date → rejeté
                const pubTs = new Date(rawDate).getTime();
                if (isNaN(pubTs))      return false;                 // date invalide → rejeté
                if (pubTs < cutoff)    return false;                 // > 48h → rejeté
                const text = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase();
                return TECH_KW.some(k => text.includes(k));
            })
            .map(item => ({
                titre: item.title.trim(),
                resume: (item.contentSnippet || '').substring(0, 150).replace(/<[^>]+>/g, '').trim(),
                url: item.link,
                date: item.isoDate || item.pubDate,
                ts: new Date(item.isoDate || item.pubDate).getTime(),
                source: source.name,
                logo: logoUrl(source.name),
                pays: source.pays,
            }));
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
        response_format: { type: "json_object" },
        temperature: 0.5
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

        // Sécurité : si Mistral ne répond pas après 60s, on annule
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error("L'API Mistral a mis trop de temps à répondre (Timeout 60s)"));
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function processWithMistral(rawArticles) {
    const input = rawArticles.map((a, i) => ({ i, t: a.titre.substring(0, 100), s: a.source }));
    const prompt = `Tu es rédacteur en chef de l'Algérie Presse Service (APS). Analyse ces articles tech des dernières 24h.

STYLE APS OBLIGATOIRE :
- Accroches courtes, nominales, sans verbe d'opinion (max 18 mots)
- Faits bruts : chiffres, noms d'organismes officiels, actions concrètes
- Jamais : "révolutionnaire", "inédit", "historique", "remarquable", "force est de constater"
- Toujours : qui, quoi, où, quand — dans cet ordre
- La synthèse globale : 2 phrases factuelles style bulletin APS, pas de jugement de valeur

1. Sélectionne les 12 articles les plus factuellement importants (impact institutionnel, chiffres, décisions officielles).
2. Pour chaque article : accroche style APS (max 18 mots) + catégorie (Télécoms, IA, Startups, Mobile, Cybersécurité, Réseaux, Innovation).
3. Synthèse globale : 2 phrases APS — faits du jour, sans opinion.

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

// Applique une fenêtre temporelle + cap de 3 articles/source sur la récolte 48h
function selectWindow(allResults, hours) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return allResults
        .map(items => items.filter(a => a.ts >= cutoff).slice(0, 3))
        .flat()
        .map(({ ts, ...rest }) => rest); // ts = interne, ne doit pas finir dans le JSON
}

const MIN_CANDIDATS = 8; // en dessous → fenêtre élargie à 48h (week-end, jours creux)

async function main() {
    console.log('📡 SCAN RSS — FILTRE 24H (filet 48h si récolte maigre)...');
    const cutoffDisplay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`   Seuil : articles publiés après ${cutoffDisplay}`);

    const allResults = await Promise.all(SOURCES.map(async s => {
        const items = await fetchRSS(s);
        if (items.length > 0) console.log(`  • ${s.name.padEnd(22)} ✅ ${items.length} art. (48h)`);
        else                   console.log(`  • ${s.name.padEnd(22)} — 0 (aucun dans les 48h)`);
        return items;
    }));

    let rawArticles = selectWindow(allResults, 24);
    if (rawArticles.length < MIN_CANDIDATS) {
        console.warn(`\n⚠️  Seulement ${rawArticles.length} candidat(s) en 24h (< ${MIN_CANDIDATS}) → fenêtre élargie à 48h.`);
        rawArticles = selectWindow(allResults, 48);
        console.warn(`   Fenêtre 48h : ${rawArticles.length} candidat(s).`);
    }
    if (rawArticles.length === 0) {
        console.error('❌ Aucun article dans les 48 dernières heures. Aucun fichier écrit.');
        process.exit(1); // Échec visible dans GitHub Actions → notification
    }

    console.log(`\n🤖 IA MISTRAL SUR ${rawArticles.length} ARTICLES...`);
    const result = await processWithMistral(rawArticles);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ SUCCÈS : revue_presse.json généré (${result.articles.length} articles retenus).`);
    process.exit(0); // sortie explicite : des sockets RSS restés ouverts empêchent node de se terminer seul
}

main().catch(e => {
    console.error('\n❌ ERREUR FATALE :', e.message);
    process.exit(1); // Exit code 1 → GitHub Actions marque le job en échec
});