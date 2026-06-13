// ============================================================
//  Algeria Tech — Build Script
//  Génère articles.json depuis les fichiers Markdown
//  Exécuté par Cloudflare Pages à chaque déploiement
// ============================================================
const fs   = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, 'articles');
const OUTPUT       = path.join(__dirname, 'articles.json');

function parseFrontmatter(text, fileName) {
    const parts = text.split('---');
    if (parts.length < 3) return null;

    const fm      = parts[1];
    const content = parts.slice(2).join('---').trim();

    const get = (k) => {
        const m = fm.match(new RegExp(`${k}:\\s*(.*)`));
        return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    };

    const tagsMatch = fm.match(/tags:\s*\[(.*)\]/);
    const tags = tagsMatch
        ? tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''))
        : [];

    const id    = fileName.replace('.md', '');
    const image = get('image');

    // Les images relatives → URL raw GitHub pour accès public
    const imageUrl = (image && image.trim() !== '' && !image.startsWith('http'))
        ? `https://raw.githubusercontent.com/bastaps/algeria-tech/main/${image}`
        : image;

    const titre = get('titre');
    if (!titre) return null;  // article invalide, on saute

    return {
        id,
        titre,
        date:      get('date'),
        heure:     get('heure'),
        categorie: get('categorie'),
        image:     imageUrl,
        video:     get('video'),
        pdf:       get('pdf'),
        extrait:   get('extrait'),
        rawContent: content,   // Markdown brut — parsé côté client à la demande
        tags
    };
}

// ── Lecture des fichiers ──────────────────────────────────────
const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
const articles = [];

for (const file of files) {
    try {
        const text    = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
        const article = parseFrontmatter(text, file);
        if (article) articles.push(article);
    } catch (e) {
        console.warn(`⚠️  Skipping ${file}: ${e.message}`);
    }
}

// ── Tri par date décroissante ─────────────────────────────────
articles.sort((a, b) => {
    const da = new Date(`${a.date}T${a.heure || '00:00'}`);
    const db = new Date(`${b.date}T${b.heure || '00:00'}`);
    return db - da;
});

// ── Écriture articles.json ────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(articles), 'utf8');
console.log(`✅ articles.json généré : ${articles.length} articles (${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB)`);

// ============================================================
//  Génération wiki_data.json depuis les fichiers Markdown wiki
// ============================================================
const WIKI_DIR    = path.join(__dirname, 'wiki');
const WIKI_OUTPUT = path.join(__dirname, 'wiki_data.json');

const WIKI_CATS = [
    { id: 'cat1', dir: 'cat1-infrastructures' },
    { id: 'cat2', dir: 'cat2-operateurs' },
    { id: 'cat3', dir: 'cat3-internet-web' },
    { id: 'cat4', dir: 'cat4-data-cybersecurite' },
    { id: 'cat5', dir: 'cat5-innovation' },
    { id: 'cat6', dir: 'cat6-complementaire' },
];

function parseWikiFm(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const fm = match[1];
    const get = (k) => { const m = fm.match(new RegExp(`${k}:\\s*"?([^"\\n]+)"?`)); return m ? m[1].trim() : ''; };
    const tagsM = fm.match(/tags:\s*\[([^\]]+)\]/);
    const tags = tagsM ? tagsM[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')) : [];
    return { titre: get('titre'), slug: get('slug'), meta: get('meta_description'), tags };
}

function parseWikiBody(content) {
    const body = content.replace(/^---[\s\S]*?---\n/, '');
    const defM = body.match(/## Définition\n([\s\S]*?)(?=\n##|$)/);
    const ctxM = body.match(/## Contexte Algérien\n([\s\S]*?)(?=\n##|$)/);
    const tagsM = body.match(/## Mots-clés SEO\n([\s\S]*?)(?=\n##|$)/);
    const tags = tagsM ? tagsM[1].trim().split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean) : [];
    return {
        definition: defM ? defM[1].trim() : '',
        contexte:   ctxM ? ctxM[1].trim() : '',
        tags,
    };
}

const wikiTerms = [];
for (const cat of WIKI_CATS) {
    const dir = path.join(WIKI_DIR, cat.dir);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('INDEX'));
    for (const file of files) {
        try {
            const content = fs.readFileSync(path.join(dir, file), 'utf-8');
            const fm   = parseWikiFm(content);
            if (!fm.slug || !fm.titre) continue;
            const body = parseWikiBody(content);
            wikiTerms.push({
                cat:        cat.id,
                slug:       fm.slug,
                titre:      fm.titre,
                meta:       fm.meta,
                tags:       body.tags.length ? body.tags : fm.tags,
                definition: body.definition,
                contexte:   body.contexte,
            });
        } catch (e) { console.warn(`⚠️  Wiki skip ${file}: ${e.message}`); }
    }
}
wikiTerms.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));

fs.writeFileSync(WIKI_OUTPUT, JSON.stringify(wikiTerms), 'utf8');
console.log(`✅ wiki_data.json généré : ${wikiTerms.length} termes (${(fs.statSync(WIKI_OUTPUT).size / 1024).toFixed(1)} KB)`);
