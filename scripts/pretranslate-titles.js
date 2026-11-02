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

// Lot de textes séparés par des sauts de ligne → 1 requête ; repli 1 par 1 si le découpage ne colle pas.
async function translateBatch(texts, tl) {
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
