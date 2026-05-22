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

// ── Écriture ─────────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(articles), 'utf8');
console.log(`✅ articles.json généré : ${articles.length} articles (${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB)`);
