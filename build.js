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

    const imageUrl = image;

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
        tags,
        type:      get('type'),      // 'breve' = espace Brèves, 'communique_officiel' = Hub Opérateurs
        position:  get('position')   // '1'/'2' = épinglé en Une, sinon tri chronologique
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

// ── Épinglage manuel en Une : un article marqué position "1" ou "2"
// passe devant le tri chronologique normal (même logique que server.js).
{
    const pinned1 = articles.find(a => a.position === '1');
    const pinned2 = articles.find(a => a.position === '2' && a !== pinned1);
    const rest = articles.filter(a => a !== pinned1 && a !== pinned2);
    const ordered = [pinned1, pinned2, ...rest].filter(Boolean);
    articles.length = 0;
    articles.push(...ordered);
}

// ── Écriture articles.json ────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(articles), 'utf8');
console.log(`✅ articles.json généré : ${articles.length} articles (${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB)`);

// ── Écriture articles-list.json (léger, sans rawContent) ──────
// Utilisé par la page d'accueil : les cartes n'ont pas besoin du corps
// des articles (chargé à la demande depuis /articles/<id>.md).
const LIST_OUTPUT = path.join(__dirname, 'articles-list.json');
const articlesLight = articles.map(({ rawContent, ...rest }) => rest);
fs.writeFileSync(LIST_OUTPUT, JSON.stringify(articlesLight), 'utf8');
console.log(`✅ articles-list.json généré : ${articlesLight.length} articles (${(fs.statSync(LIST_OUTPUT).size / 1024).toFixed(1)} KB, sans corps)`);

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

// ============================================================
//  SSG — Pages statiques article + sitemap.xml
//  Résout le problème CSR : Google voit du HTML réel
// ============================================================

const SITE_URL   = 'https://algeria-tech.pages.dev';
const ARTICLE_PUB_DIR = path.join(__dirname, 'article');

// Recharge articles (déjà générés plus haut, mais OUTPUT peut avoir changé)
const allArticlesForSSG = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));

// Helpers
function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function truncate(str = '', max = 160) {
    const s = str.replace(/\s+/g, ' ').trim();
    return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

// Simple Markdown → HTML (titres, gras, liens, paragraphes)
function mdToHtml(md = '') {
    return md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
        .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,     '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
        .split(/\n{2,}/)
        .map(block => {
            if (/^<(h[1-6]|ul|blockquote)/.test(block.trim())) return block.trim();
            return block.trim() ? `<p>${block.trim()}</p>` : '';
        })
        .join('\n');
}

function generateArticlePage(art) {
    const title       = escapeHtml(art.titre);
    const description = escapeHtml(truncate(art.extrait || art.titre, 160));
    const image       = art.image || `${SITE_URL}/images/logo_v2.png`;
    const url         = `${SITE_URL}/article/${art.id}`;
    const dateISO     = art.date ? `${art.date}T${art.heure || '00:00'}:00+01:00` : '';
    const bodyHtml    = mdToHtml(art.rawContent || '');
    const catLabel    = escapeHtml(art.categorie || 'Tech');

    const schema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: art.titre,
        description: art.extrait || art.titre,
        image: [image],
        datePublished: dateISO,
        dateModified:  dateISO,
        author: { '@type': 'Person', name: 'Basta', url: SITE_URL },
        publisher: {
            '@type': 'Organization',
            name: 'Algeria Tech',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/images/logo_v2.png` }
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        articleSection: art.categorie || 'Tech',
        inLanguage: 'fr'
    });

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Algeria Tech</title>
<meta name="description" content="${description}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">

<!-- Open Graph -->
<meta property="og:type"        content="article">
<meta property="og:title"       content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image"       content="${escapeHtml(image)}">
<meta property="og:url"         content="${url}">
<meta property="og:site_name"   content="Algeria Tech">
<meta property="article:published_time" content="${dateISO}">
<meta property="article:section"        content="${catLabel}">

<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image"       content="${escapeHtml(image)}">

<!-- Schema.org NewsArticle -->
<script type="application/ld+json">${schema}</script>

<link rel="stylesheet" href="/style.css?v=3">
<style>
  .ssg-article { max-width:800px; margin:80px auto; padding:0 20px 60px; font-family:Inter,sans-serif; }
  .ssg-article img { width:100%; border-radius:8px; margin-bottom:24px; }
  .ssg-article h1 { font-size:1.8rem; line-height:1.3; margin-bottom:12px; }
  .ssg-article .meta { color:#666; font-size:.85rem; margin-bottom:24px; }
  .ssg-article .body { line-height:1.8; color:#333; }
</style>
</head>
<body>
<!-- Contenu pré-rendu pour les crawlers (Google, Google News, Bing…) -->
<article class="ssg-article" itemscope itemtype="https://schema.org/NewsArticle">
  <meta itemprop="headline" content="${title}">
  ${art.image ? `<img src="${escapeHtml(art.image)}" alt="${title}" itemprop="image">` : ''}
  <h1 itemprop="name">${title}</h1>
  <p class="meta">
    <span itemprop="datePublished" content="${dateISO}">${art.date || ''}</span>
    ${art.categorie ? ` · <span itemprop="articleSection">${catLabel}</span>` : ''}
    · <span itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">Basta</span></span>
  </p>
  <div class="body" itemprop="articleBody">
    ${bodyHtml || `<p>${escapeHtml(art.extrait || '')}</p>`}
  </div>
</article>

<!-- Chargement de l'application SPA (remplace le contenu ci-dessus pour les vrais utilisateurs) -->
<script>
// Charge le SPA principal depuis la racine
(function() {
  const s = document.createElement('script');
  s.src = '/script.js?v=3';
  s.defer = true;
  document.head.appendChild(s);
})();
</script>
</body>
</html>`;
}

// Crée le dossier article/ si nécessaire
if (!fs.existsSync(ARTICLE_PUB_DIR)) fs.mkdirSync(ARTICLE_PUB_DIR, { recursive: true });

let generated = 0;
for (const art of allArticlesForSSG) {
    const dir = path.join(ARTICLE_PUB_DIR, String(art.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), generateArticlePage(art), 'utf8');
    generated++;
}
console.log(`✅ SSG : ${generated} pages article/ générées`);

// ── Sitemap XML ──────────────────────────────────────────────
const sitemapUrls = [
    `<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${SITE_URL}/veille</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
    `<url><loc>${SITE_URL}/revue</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
    `<url><loc>${SITE_URL}/comparateur</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`,
    `<url><loc>${SITE_URL}/reglementaire</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`,
    ...allArticlesForSSG.map(art => {
        const lastmod = art.date ? `<lastmod>${art.date}</lastmod>` : '';
        return `<url><loc>${SITE_URL}/article/${art.id}</loc>${lastmod}<changefreq>monthly</changefreq><priority>0.8</priority></url>`;
    })
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.join('\n')}
</urlset>`;

fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap, 'utf8');
console.log(`✅ sitemap.xml généré : ${sitemapUrls.length} URLs`);
