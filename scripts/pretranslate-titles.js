// ============================================================
//  Algeria Tech — Pré-traduction des titres + chapeaux (FR → AR / EN)
//  Produit i18n-titles-ar.json / i18n-titles-en.json : { "texte fr": "ترجمة" }
//  Le site (i18n.js) le lit au chargement → bascule de langue instantanée
//  sur l'accueil ; seuls les textes absents passent encore par l'API live.
//  + corps de chaque article : i18n/ar/<id>.json, i18n/en/<id>.json (chargés à l'ouverture
//    de l'article ou préchargés pour les articles affichés à l'accueil).
//  Incrémental : ne traduit que les textes nouveaux. Ne casse jamais le build.
//  Usage : node scripts/pretranslate-titles.js   (ou appelé par build.js)
// ============================================================
const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const OUT    = tl => path.join(ROOT, 'i18n-titles-' + tl + '.json');
const LANGS  = ['ar', 'en'];
const norm   = s => String(s || '').replace(/\s+/g, ' ').trim();

async function gtx(text, tl) {
    const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=' + tl + '&dt=t', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': 'Mozilla/5.0' },
        body: 'q=' + encodeURIComponent(text),
        signal: AbortSignal.timeout(15000),
    });
    // 429 / page « sorry » = Google limite cette adresse IP : on arrête tout (suite au prochain passage)
    if (r.status === 429 || r.status === 403 || r.redirected) throw Object.assign(new Error('BLOCKED'), { blocked: true });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return (Array.isArray(j[0]) ? j[0] : []).map(p => (p && p[0]) || '').join('');
}
const pause = ms => new Promise(r => setTimeout(r, ms));

// ── Repli IA (GEMINI_API_KEY / MISTRAL_API_KEY : secrets GitHub ou .env local) quand Google bloque l'IP ──
const LANG_NAME = { ar: 'arabe standard moderne', en: 'anglais' };
let googleBlocked = false;
const consigne = tl => 'Tu es traducteur de presse technologique. Traduis chaque texte du français vers l\'' + LANG_NAME[tl] +
    '. Garde les noms propres, marques, sigles et chiffres. Réponds UNIQUEMENT en JSON : {"t":[...]} avec exactement autant de traductions, dans le même ordre.';
// Chaque fournisseur renvoie le tableau traduit, ou lève { rate:true } (saturé) / { dead:true } (clé absente ou refusée).
const LLM = [
    { nom: 'Gemini', key: 'GEMINI_API_KEY', async call(texts, tl, key) {
        const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + key, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(90000),
            body: JSON.stringify({ generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
                contents: [{ parts: [{ text: consigne(tl) + '\n' + JSON.stringify({ t: texts }) }] }] }),
        });
        if (r.status === 429 || r.status >= 500) throw { rate: true };
        if (!r.ok) throw { dead: true, msg: 'HTTP ' + r.status };
        const j = await r.json();
        return JSON.parse(((j.candidates || [])[0] || {}).content.parts.map(p => p.text || '').join('')).t;
    } },
    { nom: 'Mistral', key: 'MISTRAL_API_KEY', async call(texts, tl, key) {
        const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(90000),
            body: JSON.stringify({ model: 'mistral-small-latest', temperature: 0.1, response_format: { type: 'json_object' },
                messages: [{ role: 'system', content: consigne(tl) }, { role: 'user', content: JSON.stringify({ t: texts }) }] }),
        });
        if (r.status === 429 || r.status >= 500) throw { rate: true };
        if (!r.ok) throw { dead: true, msg: 'HTTP ' + r.status };
        const j = await r.json();
        return JSON.parse(j.choices[0].message.content).t;
    } },
];
let llmIdx = 0;
async function llm(texts, tl) {
    const vivants = () => LLM.filter(p => process.env[p.key] && !p.dead);
    for (let essai = 0; essai < 12; essai++) {
        const ps = vivants();
        if (!ps.length) throw Object.assign(new Error('BLOCKED'), { blocked: true });
        const p = ps[llmIdx % ps.length];
        try {
            const arr = await p.call(texts, tl, process.env[p.key]);
            if (Array.isArray(arr) && arr.length === texts.length) return arr.map(x => norm(x));
            if (texts.length === 1) return [''];
            const m = Math.ceil(texts.length / 2);              // découpage raté : lot coupé en deux
            return (await llm(texts.slice(0, m), tl)).concat(await llm(texts.slice(m), tl));
        } catch (e) {
            if (e && e.dead) { p.dead = true; console.log('⚠️  ' + p.nom + ' indisponible (' + e.msg + ')'); continue; }
            // Saturé (limite par minute) : on patiente jusqu'à ~1 min avant de réessayer
            if (e && (e.rate || e.name === 'TimeoutError' || e.name === 'AbortError')) { llmIdx++; await pause(Math.min(60000, 10000 * (essai + 1))); continue; }
            if (e instanceof SyntaxError || e instanceof TypeError) { llmIdx++; continue; }   // JSON invalide : autre fournisseur
            throw e;
        }
    }
    throw Object.assign(new Error('BLOCKED'), { blocked: true });
}

// Google d'abord ; dès qu'il bloque, Gemini/Mistral pour le reste du passage.
async function translateBatch(texts, tl) {
    if (!googleBlocked) {
        try { return await translateBatchGoogle(texts, tl); }
        catch (e) {
            if (!e.blocked) throw e;
            googleBlocked = true;
            console.log('↪️  Google limite cette IP → bascule sur Gemini/Mistral (si clés présentes)');
        }
    }
    const out = await llm(texts, tl);
    await pause(4500);              // ≈ 13 requêtes/min : sous la limite du palier gratuit Gemini
    return out;
}

// Lot de textes séparés par des sauts de ligne → 1 requête ; repli 1 par 1 si le découpage ne colle pas.
async function translateBatchGoogle(texts, tl) {
    try {
        const parts = (await gtx(texts.join('\n'), tl)).split('\n').map(norm);
        if (parts.length === texts.length && parts.every(Boolean)) return parts;
    } catch (e) { if (e.blocked) throw e; }
    const out = [];
    for (const t of texts) {
        try { out.push(norm(await gtx(t, tl)) || ''); } catch (e) { if (e.blocked) throw e; out.push(''); }
        await pause(400);
    }
    return out;
}

// Mêmes éléments que i18n.js traduit dans .article-text (p, h2, h3, li), texte tel que textContent le donne.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', hellip: '…', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };
const decode = s => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m));
let marked = null;
function bodyTexts(md) {
    if (!marked) { const m = require(path.join(ROOT, 'libs/marked/marked.min.js')); marked = m.marked || m; }
    const html = marked.parse(String(md || ''), { breaks: true, gfm: true });
    const out = new Set();
    for (const m of html.matchAll(/<(p|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
        const t = norm(decode(m[2].replace(/<[^>]+>/g, '')));
        if (t.length >= 3 && !/^[\d\s.,:;%€$+\-–—/()]+$/.test(t)) out.add(t);
    }
    return [...out];
}

async function translateAll(texts, tl, deadline) {
    const res = {};
    for (let i = 0; i < texts.length; ) {
        if (Date.now() > deadline) return null;
        const batch = []; let len = 0;
        while (i < texts.length && batch.length < 25 && len + texts[i].length < 3500) { len += texts[i].length + 1; batch.push(texts[i++]); }
        if (!batch.length) batch.push(texts[i++].slice(0, 4500));
        const tr = await translateBatch(batch, tl);
        batch.forEach((t, k) => { if (tr[k] && tr[k] !== t) res[t] = tr[k]; });
        await pause(600);
    }
    // Traduction incomplète (< 80 % des paragraphes) : on n'écrit pas, l'article sera repris plus tard
    return Object.keys(res).length >= texts.length * 0.8 ? res : null;
}

async function runBodies(arts, deadline, quiet) {
    let done = 0, left = 0;
    for (const tl of LANGS) {
        const dir = path.join(ROOT, 'i18n', tl);
        fs.mkdirSync(dir, { recursive: true });
        const ids = new Set(arts.map(a => String(a.id)));
        for (const f of fs.readdirSync(dir)) if (!ids.has(f.replace(/\.json$/, ''))) fs.unlinkSync(path.join(dir, f));
        for (const a of arts) {
            const f = path.join(dir, a.id + '.json');
            if (fs.existsSync(f) || !a.rawContent) continue;
            const texts = bodyTexts(a.rawContent);
            if (!texts.length) continue;
            if (Date.now() > deadline || blocked) { left++; continue; }
            let tr = null;
            try { tr = await translateAll(texts, tl, deadline); }
            catch (e) { if (!e.blocked) throw e; blocked = true; }
            if (!tr) { left++; continue; }
            fs.writeFileSync(f, JSON.stringify(tr), 'utf8');
            done++;
        }
    }
    if (!quiet) console.log(`📄 corps d'articles pré-traduits : +${done}` + (left ? ` (${left} au prochain passage)` : '') + (blocked ? ' — Google limite cette IP, arrêt' : ''));
}
let blocked = false;

async function run({ budgetMs = 10 * 60 * 1000, quiet = false } = {}) {
    const t0 = Date.now();
    const dict = {};
    for (const tl of LANGS) { try { dict[tl] = JSON.parse(fs.readFileSync(OUT(tl), 'utf8')); } catch (_) { dict[tl] = {}; } }

    let arts = [];
    try {
        const a = JSON.parse(fs.readFileSync(path.join(ROOT, 'articles.json'), 'utf8'));
        arts = Array.isArray(a) ? a : (a.articles || []);
    } catch (e) { if (!quiet) console.warn('⚠️  pré-traduction : articles.json illisible'); return; }

    const wanted = new Set();
    arts.forEach(a => [a.titre, a.extrait, a.categorie].forEach(t => { t = norm(t); if (t.length >= 3) wanted.add(t); }));
    // Revue de presse + veille : titres et accroches affichés à l'accueil
    const FIELDS = new Set(['titre', 'title', 'accroche', 'resume', 'lead']);
    const walk = (o, d) => {
        if (!o || d > 6) return;
        if (Array.isArray(o)) return o.forEach(x => walk(x, d + 1));
        if (typeof o === 'object') for (const [k, v] of Object.entries(o)) {
            if (typeof v === 'string') { if (FIELDS.has(k)) { const t = norm(v); if (t.length >= 3 && t.length < 1500) wanted.add(t); } }
            else walk(v, d + 1);
        }
    };
    for (const f of ['revue_presse.json', 'veille_data.json']) {
        try { walk(JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')), 0); } catch (_) {}
    }

    let added = 0;
    for (const tl of LANGS) {
        const todo = [...wanted].filter(t => !dict[tl][t]);
        for (let i = 0; i < todo.length; ) {
            if (Date.now() - t0 > budgetMs) { if (!quiet) console.log('⏱️  pré-traduction : budget atteint, suite au prochain build'); i = todo.length; break; }
            // Lots ≤ 3500 caractères
            const batch = []; let len = 0;
            while (i < todo.length && batch.length < 25 && len + todo[i].length < 3500) { len += todo[i].length + 1; batch.push(todo[i++]); }
            if (!batch.length) batch.push(todo[i++]);
            if (blocked) break;
            let res = [];
            try { res = await translateBatch(batch, tl); } catch (e) { if (!e.blocked) throw e; blocked = true; break; }
            batch.forEach((t, k) => { if (res[k] && res[k] !== t) { dict[tl][t] = res[k]; added++; } });
            await pause(600);
        }
    }

    // Purge des textes qui ne sont plus sur le site (le fichier reste petit)
    for (const tl of LANGS) Object.keys(dict[tl]).forEach(k => { if (!wanted.has(k)) delete dict[tl][k]; });

    for (const tl of LANGS) fs.writeFileSync(OUT(tl), JSON.stringify(dict[tl]), 'utf8');
    if (!quiet) console.log(`🌍 i18n-titles-ar/en.json : +${added} traductions (${Object.keys(dict.ar).length} AR / ${Object.keys(dict.en).length} EN)`);

    await runBodies(arts, t0 + budgetMs, quiet);
}

module.exports = { run };
// PRETR_BUDGET_MIN=40 node scripts/pretranslate-titles.js  → budget en minutes (défaut 10)
if (require.main === module) run({ budgetMs: (+process.env.PRETR_BUDGET_MIN || 10) * 60 * 1000 }).catch(e => { console.error(e); process.exitCode = 1; });
