// ============================================================
//  Algeria Tech — Build Script
//  Génère articles.json depuis les fichiers Markdown
//  Exécuté par Cloudflare Pages à chaque déploiement
// ============================================================
const fs   = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, 'articles');

// Versions des assets : lues dans index.html pour que les pages article pré-rendues demandent EXACTEMENT les
// mêmes URL (style.css?v=N / script.js?v=N) que l'accueil — sinon le navigateur télécharge deux fois le même CSS.
let CSS_V = '1', JS_V = '1';
try {
    const _idx = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    CSS_V = (_idx.match(/style\.css\?v=(\d+)/) || [])[1] || CSS_V;
    JS_V  = (_idx.match(/script\.js\?v=(\d+)/) || [])[1] || JS_V;
} catch (e) { /* index.html illisible : valeurs par défaut */ }
const OUTPUT       = path.join(__dirname, 'articles.json');

function parseFrontmatter(text, fileName) {
    const parts = text.split('---');
    if (parts.length < 3) return null;

    const fm      = parts[1];
    const content = parts.slice(2).join('---').trim();

    const get = (k) => {
        const m = fm.match(new RegExp(`${k}:[ \\t]*(.*)`));
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
        position:  get('position'),  // '1'/'2' = épinglé en Une, sinon tri chronologique
        interactif: get('interactif'),
        aretenir:   get('aretenir')
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

<link rel="alternate" type="application/rss+xml" title="Algeria Tech — Flux RSS" href="/rss.xml">

<!-- Schema.org NewsArticle + fil d'Ariane -->
<script type="application/ld+json">${schema}</script>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL + '/' },
        ...((art.categorie && art.categorie !== 'undefined') ? [{ '@type': 'ListItem', position: 2, name: art.categorie, item: SITE_URL + '/?cat=' + encodeURIComponent(art.categorie) }] : []),
        { '@type': 'ListItem', position: (art.categorie && art.categorie !== 'undefined') ? 3 : 2, name: art.titre, item: url }
    ]
})}</script>

<link rel="stylesheet" href="/style.css?v=${CSS_V}">
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
  s.src = '/script.js?v=${JS_V}';
  s.defer = true;
  document.head.appendChild(s);
})();
</script>
<!-- Cloudflare Web Analytics : mesure d'audience sans cookies -->
<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "b0b62e76bba94885ac225a63c5feb365"}'></script>
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
    `<url><loc>${SITE_URL}/veille/</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
    `<url><loc>${SITE_URL}/revue/</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
    `<url><loc>${SITE_URL}/comparateur/</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`,
    `<url><loc>${SITE_URL}/reglementaire/</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`,
    ...['operateurs', 'actualites-tic', 'barometre', 'wiki', 'ae-tech', 'autoentrepreneur', 'simulateur-fiscal', 'confidentialite'].map(p =>
        `<url><loc>${SITE_URL}/${p}</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`),
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

// ============================================================================================
//  LOT 2 — SEO : pages par route, pages publiques/internes, flux RSS, sitemap Google News
//  Chaque bloc est isolé (try/catch) : un échec n'interrompt JAMAIS le build ni le déploiement.
// ============================================================================================
const _xml = (s = '') => String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const _abs = (u) => !u ? '' : (/^https?:\/\//i.test(u) ? u : SITE_URL + (u.startsWith('/') ? '' : '/') + encodeURI(decodeURI(u)));
const _when = (a) => new Date(`${a.date || '1970-01-01'}T${a.heure || '00:00'}:00+01:00`);
const _valid = (c) => (c && c !== 'undefined') ? c : '';
const _byDate = [...allArticlesForSSG].sort((a, b) => _when(b) - _when(a));

// 1) Une page statique par route de l'application (titre, description, canonical, Open Graph, Twitter propres).
//    Le routeur JavaScript fonctionne à l'identique : la page est l'index.html avec un <head> adapté.
const ROUTES_SEO = [
    { path: 'veille', title: 'Veille TIC en Algérie — Algeria Tech',
      desc: "Veille continue sur les télécoms et le numérique en Algérie : annonces des opérateurs, ministères, équipementiers et médias TIC." },
    { path: 'revue', title: 'Revue de presse tech — Algeria Tech',
      desc: "La revue de presse de l'actualité tech et numérique : les articles à retenir de la presse algérienne et internationale." },
    { path: 'comparateur', title: "Comparateur d'offres mobiles en Algérie — Algeria Tech",
      desc: "Comparez les offres mobiles des opérateurs algériens : forfaits, prix, volume de données et validité." },
    { path: 'reglementaire', title: 'Veille réglementaire télécoms en Algérie — Algeria Tech',
      desc: "Suivez la réglementation des télécommunications en Algérie : décisions de l'ARPCE et textes du Journal officiel." }
];
try {
    const indexSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const r of ROUTES_SEO) {
        const url = `${SITE_URL}/${r.path}/`;   // servie comme un dossier : canonical = URL réelle (avec « / » final)
        let h = indexSrc
            .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${_xml(r.title)}</title>`)
            .replace(/(<meta name="description" content=")[^"]*(")/, (m, a, b) => `${a}${_xml(r.desc)}${b}`)
            .replace(/(<link rel="canonical" href=")[^"]*(")/, (m, a, b) => `${a}${url}${b}`)
            .replace(/(<meta property="og:title"\s+content=")[^"]*(")/, (m, a, b) => `${a}${_xml(r.title)}${b}`)
            .replace(/(<meta property="og:description"\s+content=")[^"]*(")/, (m, a, b) => `${a}${_xml(r.desc)}${b}`)
            .replace(/(<meta property="og:url"\s+content=")[^"]*(")/, (m, a, b) => `${a}${url}${b}`)
            .replace(/(<meta name="twitter:title"\s+content=")[^"]*(")/, (m, a, b) => `${a}${_xml(r.title)}${b}`)
            .replace(/(<meta name="twitter:description"\s+content=")[^"]*(")/, (m, a, b) => `${a}${_xml(r.desc)}${b}`)
            // chemins relatifs → absolus (la page peut être ouverte avec ou sans « / » final)
            .replace(/(\s(?:src|href)=")(?!https?:|\/|#|mailto:|tel:|javascript:|data:)([^"]+)(")/g, '$1/$2$3');
        fs.mkdirSync(path.join(__dirname, r.path), { recursive: true });
        fs.writeFileSync(path.join(__dirname, r.path, 'index.html'), h, 'utf8');
    }
    console.log(`✅ SEO : ${ROUTES_SEO.length} pages de routes générées`);
} catch (e) { console.warn('⚠️  SEO routes ignoré :', e.message); }

// 2) Pages publiques : description / canonical / Open Graph / Twitter si absents ; pages internes : noindex.
const PUBLIC_PAGES = {
    'actualites-tic.html': "Actualités TIC en Algérie : opérateurs, ministères, équipementiers et médias suivis en continu.",
    'ae-tech.html': "Guide de l'auto-entrepreneur en Algérie : statut, démarches et références pour lancer son activité.",
    'autoentrepreneur.html': "Auto-entrepreneur en Algérie : le guide complet pour comprendre le statut, les démarches et la fiscalité.",
    'barometre.html': "Observatoire du numérique en Algérie : indicateurs et évolution du marché de l'Internet et de la téléphonie.",
    'operateurs.html': "Les opérateurs mobiles algériens : offres, promotions et communiqués officiels.",
    'simulateur-fiscal.html': "Simulateur fiscal pour auto-entrepreneur en Algérie : estimez vos impôts et cotisations.",
    'wiki.html': "Wiki TIC : glossaire des télécommunications et du numérique en Algérie.",
    'cv-generator-premium.html': "Générateur de CV pour les métiers du numérique : créez un CV professionnel prêt à envoyer."
};
const INTERNAL_RE = /^(admin-|assistant-vocal|at-|prototype-|smart-ingest|studio-|test-|video-downloader|flash-vertical)/;
try {
    let nPub = 0, nInt = 0;
    for (const f of fs.readdirSync(__dirname).filter(x => x.endsWith('.html'))) {
        const p = path.join(__dirname, f);
        let h = fs.readFileSync(p, 'utf8'), o = h;
        if (INTERNAL_RE.test(f)) {
            if (!/name=["']robots["']/i.test(h)) h = h.replace(/<head[^>]*>/i, m => `${m}\n<meta name="robots" content="noindex, nofollow">`);
            if (h !== o) { fs.writeFileSync(p, h, 'utf8'); nInt++; }
        } else if (PUBLIC_PAGES[f]) {
            const desc = PUBLIC_PAGES[f];
            const url = `${SITE_URL}/${f.replace(/\.html$/, '')}`;
            const t = _xml(((h.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || 'Algeria Tech').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
            let add = '';
            if (!/name=["']description["']/i.test(h)) add += `\n<meta name="description" content="${_xml(desc)}">`;
            if (!/rel=["']canonical["']/i.test(h)) add += `\n<link rel="canonical" href="${url}">`;
            if (!/property=["']og:title["']/i.test(h)) add += `\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="Algeria Tech">\n<meta property="og:title" content="${t}">\n<meta property="og:description" content="${_xml(desc)}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${SITE_URL}/images/logo_v2.png">`;
            if (!/name=["']twitter:card["']/i.test(h)) add += `\n<meta name="twitter:card" content="summary">\n<meta name="twitter:title" content="${t}">\n<meta name="twitter:description" content="${_xml(desc)}">\n<meta name="twitter:image" content="${SITE_URL}/images/logo_v2.png">`;
            if (add) { h = h.replace(/<\/title>/i, () => '</title>' + add); fs.writeFileSync(p, h, 'utf8'); nPub++; }
        }
    }
    console.log(`✅ SEO : ${nPub} pages publiques complétées, ${nInt} pages internes en noindex`);
} catch (e) { console.warn('⚠️  SEO pages ignoré :', e.message); }

// 3) Flux RSS (40 derniers articles)
try {
    const items = _byDate.filter(a => a.type !== 'communique_officiel').slice(0, 40).map(a => {
        const cat = _valid(a.categorie);
        const img = a.image ? _abs(a.image) : '';
        return `    <item>
      <title>${_xml(a.titre)}</title>
      <link>${SITE_URL}/article/${a.id}</link>
      <guid isPermaLink="true">${SITE_URL}/article/${a.id}</guid>
      <pubDate>${_when(a).toUTCString()}</pubDate>${cat ? `\n      <category>${_xml(cat)}</category>` : ''}
      <dc:creator>Basta</dc:creator>
      <description>${_xml(a.extrait || a.titre)}</description>${img ? `\n      <media:content url="${_xml(img)}" medium="image"/>` : ''}
    </item>`;
    }).join('\n');
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Algeria Tech — L'actualité numérique en Algérie</title>
    <link>${SITE_URL}/</link>
    <description>Actualités, analyses et veille sur le numérique, les télécoms et la tech en Algérie.</description>
    <language>fr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <image><url>${SITE_URL}/images/logo_v2.png</url><title>Algeria Tech</title><link>${SITE_URL}/</link></image>
${items}
  </channel>
</rss>
`;
    fs.writeFileSync(path.join(__dirname, 'rss.xml'), rss, 'utf8');
    console.log(`✅ rss.xml généré : ${Math.min(40, _byDate.length)} articles`);
} catch (e) { console.warn('⚠️  RSS ignoré :', e.message); }

// 4) Sitemap Google News (articles des 48 dernières heures — consigne Google ; au moins le plus récent)
try {
    let recents = _byDate.filter(a => a.type !== 'communique_officiel' && Date.now() - _when(a).getTime() < 48 * 3600 * 1000);
    if (!recents.length) recents = _byDate.slice(0, 1);
    const urls = recents.slice(0, 1000).map(a => `  <url>
    <loc>${SITE_URL}/article/${a.id}</loc>
    <news:news>
      <news:publication><news:name>Algeria Tech</news:name><news:language>fr</news:language></news:publication>
      <news:publication_date>${a.date || '1970-01-01'}T${a.heure || '00:00'}:00+01:00</news:publication_date>
      <news:title>${_xml(a.titre)}</news:title>
    </news:news>
  </url>`).join('\n');
    fs.writeFileSync(path.join(__dirname, 'news-sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`, 'utf8');
    console.log(`✅ news-sitemap.xml généré : ${recents.length} article(s) récents`);
} catch (e) { console.warn('⚠️  Sitemap News ignoré :', e.message); }

// ── Nettoyage du déploiement (Cloudflare Pages uniquement : variable CF_PAGES=1) ─────────────────
// Le site est publié depuis la racine du dépôt : sans ce nettoyage, server.js, les scripts Python, les
// workflows et les documents internes étaient téléchargeables sur pages.dev. Ne touche JAMAIS au dépôt :
// seule la copie de build (éphémère) est nettoyée. Rien n'est supprimé en local (CF_PAGES absent).
if (process.env.CF_PAGES === '1') {
    const rm = (p) => { try { fs.rmSync(path.join(__dirname, p), { recursive: true, force: true }); } catch (e) {} };
    for (const f of fs.readdirSync(__dirname)) {
        if (/\.(md|py|ps1|bat|lnk|docx|pptx)$/i.test(f) || (/\.txt$/i.test(f) && f !== 'robots.txt')) rm(f);
    }
    ['server.js', 'requirements.txt', 'diff_report.txt', 'apify_cache.json', 'scripts', 'tools', '.github'].forEach(rm);
    console.log('🧹 fichiers internes retirés du déploiement');
}
