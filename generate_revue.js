const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlgeriaTech-RevueBot/11.0' },
    timeout: 15000,
});

// Chaîne IA à 5 fournisseurs : dès qu'un expire/quota dépassé, le suivant prend le
// relais automatiquement (voir generateRevue). Ordre : gratuits d'abord (Mistral,
// Gemini), payants ensuite (OpenRouter, OpenAI, DeepSeek) pour éviter les coûts
// inutiles quand un moteur gratuit répond.
const MISTRAL_API_KEY    = process.env.MISTRAL_API_KEY;
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENAI_API_KEY     = process.env.OPENAI_API_KEY;
const DEEPSEEK_API_KEY   = process.env.DEEPSEEK_API_KEY;
const OUTPUT_FILE = path.join(__dirname, 'revue_presse.json');

if (!MISTRAL_API_KEY && !GEMINI_API_KEY && !OPENROUTER_API_KEY && !OPENAI_API_KEY && !DEEPSEEK_API_KEY) {
    console.error("❌ Aucune clé IA définie (MISTRAL/GEMINI/OPENROUTER/OPENAI/DEEPSEEK_API_KEY).");
    process.exit(1);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

// ── APPEL API MISTRAL, avec retry sur erreurs transitoires (429/5xx/réseau/timeout) ──
async function callMistralOnce(prompt) {
    const https = require('https');
    const endpoint = 'https://api.mistral.ai/v1/chat/completions';

    const payload = JSON.stringify({
        model: "ministral-8b-latest",
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
                if (res.statusCode !== 200) {
                    const err = new Error(`Mistral Error ${res.statusCode}: ${data}`);
                    err.statusCode = res.statusCode;
                    return reject(err);
                }
                try { resolve(JSON.parse(data)); }
                catch(e) { reject(new Error("Erreur JSON Mistral")); }
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

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
async function callMistral(prompt, retries = 3) {
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await callMistralOnce(prompt);
        } catch (e) {
            lastErr = e;
            const retryable = RETRYABLE_STATUS.has(e.statusCode) || /Timeout|ECONNRESET|ENOTFOUND|EAI_AGAIN/.test(e.message);
            if (!retryable || attempt === retries) throw e;
            const delay = 4000 * attempt;
            console.warn(`  ⚠️  Mistral (${e.message.slice(0, 90)}) — nouvelle tentative dans ${delay / 1000}s (${attempt}/${retries})`);
            await sleep(delay);
        }
    }
    throw lastErr;
}

// ── APPEL API GEMINI — repli si Mistral reste indisponible après ses tentatives ──
const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];
async function callGeminiOnce(prompt, model) {
    const https = require('https');
    const payload = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, responseMimeType: 'application/json' }
    });
    return new Promise((resolve, reject) => {
        const req = https.request(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`Gemini(${model}) Error ${res.statusCode}: ${data.slice(0, 200)}`));
                try {
                    const j = JSON.parse(data);
                    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
                    const text = parts.map(p => p.text || '').join('');
                    if (!text) return reject(new Error(`Gemini(${model}) réponse vide`));
                    resolve(JSON.parse(text));
                } catch (e) { reject(new Error(`Gemini(${model}) JSON invalide: ${e.message}`)); }
            });
        });
        req.setTimeout(60000, () => { req.destroy(); reject(new Error(`Gemini(${model}) Timeout 60s`)); });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}
async function callGemini(prompt) {
    let lastErr;
    for (const model of GEMINI_MODELS) {
        try { return await callGeminiOnce(prompt, model); }
        catch (e) { lastErr = e; console.warn(`  ⚠️  ${e.message}`); }
    }
    throw lastErr;
}

// ── Appel générique pour les fournisseurs compatibles API OpenAI (chat/completions) :
// OpenRouter, OpenAI, DeepSeek. Mistral garde son propre appel ci-dessus (déjà en place
// et testé), mais partage la même forme de réponse (choices[0].message.content).
function extractJsonFromText(text) {
    const m = /\{[\s\S]*\}/.exec(text || '');
    return JSON.parse(m ? m[0] : text);
}

async function callOpenAICompatibleOnce(prompt, { baseUrl, apiKey, model, jsonMode, extraHeaders }) {
    const https = require('https');
    const url = new URL(baseUrl);
    const body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5 };
    if (jsonMode) body.response_format = { type: 'json_object' };
    const payload = JSON.stringify(body);

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                ...(extraHeaders || {})
            }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    const err = new Error(`${model} Error ${res.statusCode}: ${data.slice(0, 300)}`);
                    err.statusCode = res.statusCode;
                    return reject(err);
                }
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`${model} JSON invalide: ${e.message}`)); }
            });
        });
        req.setTimeout(60000, () => { req.destroy(); reject(Object.assign(new Error(`${model} Timeout 60s`), { statusCode: 0 })); });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function callOpenAICompatible(prompt, opts, retries = 2) {
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try { return await callOpenAICompatibleOnce(prompt, opts); }
        catch (e) {
            lastErr = e;
            const retryable = RETRYABLE_STATUS.has(e.statusCode) || /Timeout|ECONNRESET|ENOTFOUND|EAI_AGAIN/.test(e.message);
            if (!retryable || attempt === retries) throw e;
            const delay = 3000 * attempt;
            console.warn(`  ⚠️  ${opts.model} (${e.message.slice(0, 90)}) — nouvelle tentative dans ${delay / 1000}s (${attempt}/${retries})`);
            await sleep(delay);
        }
    }
    throw lastErr;
}

async function callOpenRouter(prompt) {
    const r = await callOpenAICompatible(prompt, {
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: OPENROUTER_API_KEY,
        model: 'meta-llama/llama-3.3-70b-instruct',
        jsonMode: false, // support JSON mode variable selon le modèle routé — on extrait nous-mêmes
        extraHeaders: { 'HTTP-Referer': 'https://algeria-tech.pages.dev', 'X-Title': 'Algeria Tech - Revue de presse' }
    });
    return extractJsonFromText(r.choices[0].message.content);
}

async function callOpenAI(prompt) {
    const r = await callOpenAICompatible(prompt, {
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: OPENAI_API_KEY,
        model: 'gpt-4o-mini',
        jsonMode: true
    });
    return JSON.parse(r.choices[0].message.content);
}

async function callDeepSeek(prompt) {
    const r = await callOpenAICompatible(prompt, {
        baseUrl: 'https://api.deepseek.com/chat/completions',
        apiKey: DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
        jsonMode: true
    });
    return JSON.parse(r.choices[0].message.content);
}

function buildPrompt(rawArticles) {
    const input = rawArticles.map((a, i) => ({ i, t: a.titre.substring(0, 100), s: a.source }));
    return `Tu es rédacteur en chef de l'Algérie Presse Service (APS). Analyse ces articles tech des dernières 24h.

STYLE APS OBLIGATOIRE :
- Accroches courtes, nominales, sans verbe d'opinion (max 18 mots)
- Faits bruts : chiffres, noms d'organismes officiels, actions concrètes
- Jamais : "révolutionnaire", "inédit", "historique", "remarquable", "force est de constater"
- Toujours : qui, quoi, où, quand — dans cet ordre
- La synthèse globale : 2 phrases factuelles style bulletin APS, pas de jugement de valeur

1. Sélectionne les 12 articles les plus factuellement importants (impact institutionnel, chiffres, décisions officielles).
2. Pour chaque article : accroche style APS (max 18 mots) + catégorie (Télécoms, IA, Startups, Mobile, Cybersécurité, Réseaux, Innovation).
3. Synthèse globale : 2 phrases APS — faits du jour, sans opinion.
4. Article de synthèse complet, façon dépêche APS, qui couvre les 12 articles sélectionnés avec des transitions fluides (pas une liste à puces) :
   - "titre" : titre factuel et percutant résumant la tendance principale.
   - "lead" : un paragraphe qui répond à qui/quoi/où/quand/pourquoi.
   - "corps" : un tableau de 3 à 6 paragraphes rédigés qui reprennent TOUS les 12 articles, avec citation systématique de la source. Pour chaque mention de source, encadre EXACTEMENT le nom du site avec des doubles astérisques, ex: "Selon **Algérie Éco**, ..." ou "d'après **Silicon.fr**". Le nom entre astérisques doit correspondre EXACTEMENT au champ "s" de l'article cité dans Data.

Data:${JSON.stringify(input)}
Réponds EXCLUSIVEMENT en JSON pur: {"synthese":"...", "selected":[{"i":0, "accroche":"...", "categorie":"..."}], "article":{"titre":"...", "lead":"...", "corps":["...", "..."]}}`;
}

// Post-traitement commun (Mistral et Gemini renvoient la même forme de JSON)
function packAiResult(aiResult, rawArticles) {
    const finalArticles = aiResult.selected.map(sel => {
        const orig = rawArticles[sel.i];
        return orig ? { ...orig, accroche: sel.accroche, categorie: sel.categorie } : null;
    }).filter(Boolean);

    // Article de synthèse quotidien (style APS) — lie chaque **Nom de site** vers l'URL réelle de l'article cité
    const sourceQueues = {};
    finalArticles.forEach(a => { (sourceQueues[a.source] = sourceQueues[a.source] || []).push(a.url); });
    function linkifySources(text) {
        return text.replace(/\*\*([^*]+)\*\*/g, (match, name) => {
            const queue = sourceQueues[name];
            if (queue && queue.length) {
                const url = queue.shift();
                return `<a href="${url}" target="_blank" rel="noopener" class="revue-article-source-link">${name}</a>`;
            }
            return name;
        });
    }
    const syntheseArticle = aiResult.article ? {
        titre: aiResult.article.titre,
        dateline: `Alger, ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} (Algeria Tech)`,
        lead: linkifySources(aiResult.article.lead || ''),
        corpsHtml: (aiResult.article.corps || []).map(p => `<p>${linkifySources(p)}</p>`)
    } : null;

    return {
        date: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        synthese: aiResult.synthese,
        articles: finalArticles,
        syntheseArticle,
        lastUpdated: new Date().toISOString()
    };
}

// Filet de sécurité final : aucune IA disponible → édition quand même publiée (titres
// bruts, sans accroche réécrite) plutôt que de laisser le site figé sur la veille.
function buildRuleBasedRevue(rawArticles) {
    const finalArticles = rawArticles.slice(0, 12).map(a => ({
        ...a,
        accroche: a.titre.length > 140 ? a.titre.slice(0, 137) + '…' : a.titre,
        categorie: 'Actualité'
    }));
    return {
        date: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        synthese: `${finalArticles.length} articles tech retenus ce jour, issus de ${new Set(finalArticles.map(a => a.source)).size} sources — édition générée sans réécriture IA (moteurs indisponibles).`,
        articles: finalArticles,
        syntheseArticle: null,
        lastUpdated: new Date().toISOString(),
        engine: 'Règles (sans IA)'
    };
}

// Chaîne à 5 fournisseurs, gratuits d'abord : Mistral → Gemini → OpenRouter → OpenAI →
// DeepSeek → repli sans IA. Chacun a ses propres retries ; dès qu'un expire ou dépasse
// son quota, le suivant prend le relais automatiquement. Ne lève jamais : la revue est
// TOUJOURS publiée, dégradée si besoin, jamais absente.
// Mistral en dernier : son workspace reste rate-limité en continu (429 systématique),
// autant ne pas perdre de temps dessus avant d'avoir essayé les autres.
const AI_PROVIDERS = [
    { name: 'Gemini',     key: () => GEMINI_API_KEY,     run: callGemini },
    { name: 'OpenRouter', key: () => OPENROUTER_API_KEY, run: callOpenRouter },
    { name: 'OpenAI',     key: () => OPENAI_API_KEY,     run: callOpenAI },
    { name: 'DeepSeek',   key: () => DEEPSEEK_API_KEY,   run: callDeepSeek },
    { name: 'Mistral',    key: () => MISTRAL_API_KEY,    run: async (prompt) => JSON.parse((await callMistral(prompt)).choices[0].message.content) },
];

async function generateRevue(rawArticles) {
    const prompt = buildPrompt(rawArticles);

    for (const provider of AI_PROVIDERS) {
        if (!provider.key()) continue;
        try {
            console.log(`\n🤖 IA ${provider.name.toUpperCase()} SUR ${rawArticles.length} ARTICLES...`);
            const aiResult = await provider.run(prompt);
            const result = packAiResult(aiResult, rawArticles);
            return { ...result, engine: provider.name };
        } catch (e) {
            console.warn(`\n⚠️  ${provider.name} indisponible (${e.message.slice(0, 150)}) — moteur suivant.`);
        }
    }
    console.warn('\n⚠️  Aucun moteur IA disponible — édition générée sans réécriture (titres bruts).');
    return buildRuleBasedRevue(rawArticles);
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

    const result = await generateRevue(rawArticles);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ SUCCÈS (${result.engine}) : revue_presse.json généré (${result.articles.length} articles retenus).`);
    process.exit(0); // sortie explicite : des sockets RSS restés ouverts empêchent node de se terminer seul
}

main().catch(e => {
    console.error('\n❌ ERREUR FATALE :', e.message);
    process.exit(1); // Exit code 1 → GitHub Actions marque le job en échec
});