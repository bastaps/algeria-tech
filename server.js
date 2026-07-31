try { require('dotenv').config(); } catch (e) {}
const express = require('express');
const { checkJoradp, backfillJoradp, loadData: loadJoradpData } = require('./joradp');
const { checkArpce,  backfillArpce,  loadData: loadArpceData  } = require('./arpce');
const { subscribe, unsubscribe, getSubscribers, sendAlerts, sendTestEmail } = require('./email_alert');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { Octokit } = require("@octokit/rest");
const cors = require('cors');
const https = require('https');
const http = require('http');
const RssParser = require('rss-parser');
const compression = require('compression');

// ── Générateur d'infographies ─────────────────────────────────────────────────
const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');
const WordExtractor = require('word-extractor');
const AdmZip   = require('adm-zip');
const { generateReport } = require('./generator/html-template');

const app = express();
const PORT = process.env.PORT || 3000;

// ── COMPRESSION gzip/deflate — crucial pour les connexions lentes (2G/3G) ──
// Réduit de 70–85 % le poids des réponses texte (HTML, CSS, JS, JSON).
// Doit être le TOUT premier middleware pour couvrir statiques + API.
app.use(compression({ level: 6, threshold: 1024 }));

// ── CONFIGURATION IA (MISTRAL est l'alternative stable déjà présente dans votre projet) ──
// Clé lue UNIQUEMENT depuis l'environnement (.env en local, variables d'env en prod).
// Ne jamais remettre la clé en dur ici : ce fichier est dans un dépôt public.
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";
if (!MISTRAL_API_KEY) console.warn("[config] ⚠️ MISTRAL_API_KEY absente — les fonctions IA (débat, synthèse…) échoueront.");

// ── Helper robuste pour appeler l'API Mistral ──────────────────────────────────
// Corrige les "getaddrinfo ENOTFOUND api.mistral.ai" intermittents (DNS du host
// qui flanche) et les requêtes qui pendent : timeout par tentative + retry sur
// erreurs réseau transitoires (DNS, reset, timeout). Renvoie le corps brut (string).
const MISTRAL_TRANSIENT = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE']);
function callMistral(payload, { timeout = 25000, retries = 2, retryDelay = 700 } = {}) {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const attempt = (left) => new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.mistral.ai',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MISTRAL_API_KEY}`,
                'Content-Length': Buffer.byteLength(body)
            }
        }, apiRes => {
            let data = '';
            apiRes.on('data', chunk => data += chunk);
            apiRes.on('end', () => resolve(data));
        });
        req.setTimeout(timeout, () => req.destroy(Object.assign(new Error(`Timeout Mistral (${timeout / 1000}s)`), { code: 'ETIMEDOUT' })));
        req.on('error', reject);
        req.write(body);
        req.end();
    }).catch(err => {
        if (left > 0 && MISTRAL_TRANSIENT.has(err.code)) {
            console.warn(`[mistral] ${err.code} — nouvelle tentative (${left} restante·s)`);
            return new Promise(r => setTimeout(r, retryDelay)).then(() => attempt(left - 1));
        }
        throw err;
    });
    return attempt(retries);
}

app.use(cors({
    origin: [
        'https://algeria-tech.pages.dev',
        'https://algeria-tech.pages.dz',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ],
    credentials: true
}));

const isCloud = !!process.env.GITHUB_TOKEN;
const octokit = process.env.GITHUB_TOKEN ? new Octokit({ auth: process.env.GITHUB_TOKEN }) : null;
const OWNER = "bastaps";
const REPO = "algeria-tech";

// ── VERROU ÉCRITURE EN PRODUCTION ───────────────────────────────────────────
// Le site déployé (Render/Cloudflare) est en LECTURE SEULE. Toute création,
// modification ou suppression se fait UNIQUEMENT en localhost, via les outils
// dédiés, puis publication par `git push`. En cloud, seuls les GET et une petite
// liste de POST publics sont autorisés ; TOUTE autre mutation renvoie 403 — y
// compris via la console F12 ou un appel direct à l'API. La protection est côté
// serveur, donc elle ne peut pas être contournée depuis le navigateur.
const PUBLIC_CLOUD_POST = new Set(['/api/debat', '/api/synthese', '/api/subscribe']);
if (isCloud) {
    app.use((req, res, next) => {
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
        if (PUBLIC_CLOUD_POST.has(req.path)) return next();
        return res.status(403).json({ error: "Modification désactivée sur le site déployé. Les articles se gèrent uniquement en local." });
    });
    console.log('[secu] 🔒 Mode cloud : écritures verrouillées (lecture seule + POST publics debat/synthese/subscribe).');
}

const storage = isCloud ? multer.memoryStorage() : multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = file.mimetype === 'application/pdf' ? 'documents/' : 'images/';
        if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage }).fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]);

app.use(express.json());

// === [AUTO-MEDIA] Route pour lister dynamiquement les fichiers dans infographies/media ===
app.get('/api/infographies/media', (req, res) => {
    const mediaDir = path.join(__dirname, 'infographies', 'media');
    try {
        if (!fsSync.existsSync(mediaDir)) return res.json([]);
        const files = fsSync.readdirSync(mediaDir);
        const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pptx', '.ppt', '.txt', '.md', '.html', '.htm'];
        
        const mediaList = files
            .filter(f => !f.startsWith('.') && allowedExts.includes(path.extname(f).toLowerCase()))
            .map(f => {
                const ext = path.extname(f).toLowerCase();
                const stat = fsSync.statSync(path.join(mediaDir, f));
                let type = 'file';
                if (['.pdf'].includes(ext)) type = 'pdf';
                else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) type = 'image';
                else if (['.pptx', '.ppt'].includes(ext)) type = 'presentation';
                else if (['.txt', '.md'].includes(ext)) type = 'text';
                else if (['.html', '.htm'].includes(ext)) type = 'interactive';
                
                const baseName = path.basename(f, ext);
                const thumbnail = files.find(file => {
                    const fileExt = path.extname(file).toLowerCase();
                    const fileBase = path.basename(file, fileExt);
                    return (fileExt === '.jpg' || fileExt === '.jpeg' || fileExt === '.png') && fileBase === baseName;
                });
                
                return { 
                    name: f, 
                    url: `/infographies/media/${encodeURIComponent(f)}`, 
                    type, 
                    ext, 
                    size: stat.size, 
                    modified: stat.mtime,
                    thumbnail: thumbnail ? `/infographies/media/${encodeURIComponent(thumbnail)}` : null
                };
            })
            .sort((a, b) => b.modified - a.modified);
        res.json(mediaList);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// === FIN [AUTO-MEDIA] ===

// === [INTERACTIFS] Route pour lister les dossiers interactifs dans infographies/ ===
app.get('/api/infographies/interactifs', (req, res) => {
    const infographicsDir = path.join(__dirname, 'infographies');
    try {
        if (!fsSync.existsSync(infographicsDir)) return res.json([]);
        const items = fsSync.readdirSync(infographicsDir);
        const interactifs = [];
        
        for (const item of items) {
            const itemPath = path.join(infographicsDir, item);
            const stat = fsSync.statSync(itemPath);
            
            if (stat.isDirectory() && item !== 'media' && !item.startsWith('.')) {
                const indexPath = path.join(itemPath, 'index.html');
                const hasIndex = fsSync.existsSync(indexPath);
                
                if (hasIndex) {
                    const indexStat = fsSync.statSync(indexPath);
                    const title = item
                        .replace(/-/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                    
                    const folderFiles = fsSync.readdirSync(itemPath);
                    const thumbnailFile = folderFiles.find(f => {
                        const ext = path.extname(f).toLowerCase();
                        return f.toLowerCase().includes('thumbnail') && (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.svg' || ext === '.webp');
                    });

                    interactifs.push({
                        name: item,
                        title: title,
                        url: `/infographies/${item}/`,
                        type: 'interactive-folder',
                        modified: indexStat.mtime,
                        thumbnail: thumbnailFile ? `/infographies/${item}/${thumbnailFile}` : null
                    });
                }
            }
        }

        res.json(interactifs.sort((a, b) => b.modified - a.modified));
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// === FIN [INTERACTIFS] ===

// === [STATIC-GENERATOR] Générer des fichiers JSON statiques pour Cloudflare Pages ===
app.get('/api/generate-static-files', (req, res) => {
    const mediaDir = path.join(__dirname, 'infographies', 'media');
    const infographicsDir = path.join(__dirname, 'infographies');
    
    try {
        // Générer media-list.json
        if (fsSync.existsSync(mediaDir)) {
            const files = fsSync.readdirSync(mediaDir);
            const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pptx', '.ppt', '.txt', '.md', '.html', '.htm'];
            
            const mediaList = files
                .filter(f => !f.startsWith('.') && allowedExts.includes(path.extname(f).toLowerCase()))
                .map(f => {
                    const ext = path.extname(f).toLowerCase();
                    const stat = fsSync.statSync(path.join(mediaDir, f));
                    let type = 'file';
                    if (['.pdf'].includes(ext)) type = 'pdf';
                    else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) type = 'image';
                    else if (['.pptx', '.ppt'].includes(ext)) type = 'presentation';
                    else if (['.txt', '.md'].includes(ext)) type = 'text';
                    else if (['.html', '.htm'].includes(ext)) type = 'interactive';
                    
                    const baseName = path.basename(f, ext);
                    const thumbnail = files.find(file => {
                        const fileExt = path.extname(file).toLowerCase();
                        const fileBase = path.basename(file, fileExt);
                        return (fileExt === '.jpg' || fileExt === '.jpeg' || fileExt === '.png') && fileBase === baseName;
                    });
                    
                    return { 
                        name: f, 
                        url: `/infographies/media/${encodeURIComponent(f)}`, 
                        type, 
                        ext, 
                        size: stat.size, 
                        modified: stat.mtime,
                        thumbnail: thumbnail ? `/infographies/media/${encodeURIComponent(thumbnail)}` : null
                    };
                })
                .sort((a, b) => b.modified - a.modified);
            
            fsSync.writeFileSync(
                path.join(__dirname, 'infographies', 'media-list.json'),
                JSON.stringify(mediaList, null, 2)
            );
            console.log('✅ media-list.json généré avec', mediaList.length, 'fichiers');
        }
        
        // Générer interactifs-list.json
        if (fsSync.existsSync(infographicsDir)) {
            const items = fsSync.readdirSync(infographicsDir);
            const interactifs = [];
            
            for (const item of items) {
                const itemPath = path.join(infographicsDir, item);
                const stat = fsSync.statSync(itemPath);
                
                if (stat.isDirectory() && item !== 'media' && !item.startsWith('.')) {
                    const indexPath = path.join(itemPath, 'index.html');
                    const hasIndex = fsSync.existsSync(indexPath);
                    
                    if (hasIndex) {
                        const indexStat = fsSync.statSync(indexPath);
                        const title = item
                            .replace(/-/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                        
                        const folderFiles = fsSync.readdirSync(itemPath);
                        const thumbnailFile = folderFiles.find(f => {
                            const ext = path.extname(f).toLowerCase();
                            return f.toLowerCase().includes('thumbnail') && (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.svg' || ext === '.webp');
                        });
                        
                        interactifs.push({
                            name: item,
                            title: title,
                            url: `/infographies/${item}/`,
                            type: 'interactive-folder',
                            modified: indexStat.mtime,
                            thumbnail: thumbnailFile ? `/infographies/${item}/${thumbnailFile}` : null
                        });
                    }
                }
            }
            
            fsSync.writeFileSync(
                path.join(__dirname, 'infographies', 'interactifs-list.json'),
                JSON.stringify(interactifs.sort((a, b) => b.modified - a.modified), null, 2)
            );
            console.log('✅ interactifs-list.json généré avec', interactifs.length, 'présentations');
        }
        
        res.json({ success: true, message: 'Fichiers statiques générés avec succès' });
    } catch (e) {
        console.error('Erreur génération statique:', e);
        res.status(500).json({ error: e.message });
    }
});
// === FIN [STATIC-GENERATOR] ===

// === ROUTE OPÉRATEURS MOBILES ===
app.get('/operateurs', (req, res) => res.sendFile(path.join(__dirname, 'operateurs.html')));

// === ROUTE BAROMÈTRE MENSUEL ===
app.get('/barometre', (req, res) => res.sendFile(path.join(__dirname, 'barometre.html')));
app.get('/barometre/', (req, res) => res.sendFile(path.join(__dirname, 'barometre.html')));

// === ROUTE ACTUALITÉS TIC ===
app.get('/actualites-tic', (req, res) => res.sendFile(path.join(__dirname, 'actualites-tic.html')));
app.get('/actualites-tic/', (req, res) => res.sendFile(path.join(__dirname, 'actualites-tic.html')));

// === ROUTE AUTO-ENTREPRENEUR TECH ===
app.get('/ae-tech', (req, res) => res.sendFile(path.join(__dirname, 'ae-tech.html')));
app.get('/ae-tech/', (req, res) => res.sendFile(path.join(__dirname, 'ae-tech.html')));

// === ROUTE STUDIO (plateforme d'outils premium 3D) ===
app.get('/studio', (req, res) => res.sendFile(path.join(__dirname, 'studio.html')));
app.get('/studio.html', (req, res) => res.sendFile(path.join(__dirname, 'studio.html')));
app.get('/plateforme', (req, res) => res.sendFile(path.join(__dirname, 'studio.html')));

// === ROUTE SMART INGEST ===
app.get('/smart-ingest', (req, res) => res.sendFile(path.join(__dirname, 'smart-ingest.html')));
app.get('/smart-ingest.html', (req, res) => res.sendFile(path.join(__dirname, 'smart-ingest.html')));
app.get('/video-downloader', (req, res) => res.sendFile(path.join(__dirname, 'video-downloader.html')));
app.get('/video-transcription', (req, res) => res.sendFile(path.join(__dirname, 'video-transcription.html')));
app.get('/multimedia-studio', (req, res) => res.sendFile(path.join(__dirname, 'algeria-tech-multimedia-studio.html')));

// === ROUTE ARTICLES (SPA — hard refresh support) ===
app.get('/article/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── VERSION LÉGÈRE (chargement allégé pour connexions lentes) ──────────────
// Page HTML autonome rendue côté serveur : pas de JS, pas de Font Awesome,
// pas de webfonts, images en lazy-load, vidéo remplacée par une vignette
// cliquable. Cible : réseaux 2G/3G, mode économie de données.

function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Rendu Markdown minimal → HTML (couvre le style des dépêches générées :
// titres ##, listes -, gras/italique, liens, règles ---).
function renderLiteMarkdown(md) {
    // Retire les blocs HTML lourds (embeds vidéo/iframe) — remplacés en amont
    let src = String(md || '')
        .replace(/<div class="video-embed"[\s\S]*?<\/div>\s*<\/div>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<div[^>]*>|<\/div>/gi, '');

    const inline = (t) => escapeHtml(t)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener" target="_blank">$1</a>')
        .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" rel="noopener" target="_blank">$2</a>');

    const lines = src.split('\n');
    let html = '', listOpen = false;
    const closeList = () => { if (listOpen) { html += '</ul>'; listOpen = false; } };

    for (let raw of lines) {
        const line = raw.trim();
        if (!line) { closeList(); continue; }
        if (/^---+$/.test(line)) { closeList(); html += '<hr>'; continue; }
        let m;
        if ((m = line.match(/^(#{2,4})\s+(.*)$/))) {
            closeList();
            const lvl = m[1].length; // ## -> h2, ### -> h3...
            html += `<h${lvl}>${inline(m[2])}</h${lvl}>`;
        } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
            if (!listOpen) { html += '<ul>'; listOpen = true; }
            html += `<li>${inline(m[1])}</li>`;
        } else {
            closeList();
            html += `<p>${inline(line)}</p>`;
        }
    }
    closeList();
    return html;
}

function ytId(url) {
    return (String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^&?]{11})/) || [])[1] || null;
}

async function readArticleById(id) {
    const text = await fs.readFile(path.join(__dirname, 'articles', `${id}.md`), 'utf-8');
    const parts = text.split('---');
    if (parts.length < 3) throw new Error('Format invalide');
    const fm = parts[1];
    const content = parts.slice(2).join('---').trim();
    const get = (k) => { const m = fm.match(new RegExp(`${k}:\\s*(.*)`)); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
    const tagsMatch = fm.match(/tags:\s*\[(.*)\]/);
    const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : [];
    return { id, titre: get('titre'), date: get('date'), heure: get('heure'), categorie: get('categorie'), image: get('image'), video: get('video'), pdf: get('pdf'), extrait: get('extrait'), tags, rawContent: content };
}

app.get('/article/:id/lite', async (req, res) => {
    try {
        const a = await readArticleById(req.params.id);
        const readingTime = Math.max(1, Math.ceil((a.rawContent || '').split(/\s+/).length / 200));
        const canonical = `/article/${a.id}`;

        // Média d'en-tête léger : vignette vidéo cliquable OU image lazy
        let media = '';
        const vId = ytId(a.video);
        if (vId) {
            media = `<a class="lite-video" href="https://www.youtube.com/watch?v=${vId}" rel="noopener" target="_blank" aria-label="Voir la vidéo sur YouTube">`
                + `<img loading="lazy" width="480" height="360" src="https://img.youtube.com/vi/${vId}/hqdefault.jpg" alt="${escapeHtml(a.titre)}">`
                + `<span class="lite-play">► Voir la vidéo</span></a>`;
        } else if (a.image && a.image.trim()) {
            media = `<img class="lite-hero" loading="lazy" src="${escapeHtml(a.image)}" alt="${escapeHtml(a.titre)}">`;
        }

        const body = renderLiteMarkdown(a.rawContent);
        const pdf = a.pdf ? `<p><a href="${escapeHtml(a.pdf)}" rel="noopener" target="_blank">📄 Télécharger le PDF d'accompagnement</a></p>` : '';
        const tags = a.tags.length ? `<p class="lite-tags">${a.tags.map(t => `<span>#${escapeHtml(t)}</span>`).join(' ')}</p>` : '';

        const htmlPage = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escapeHtml(a.extrait)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<title>${escapeHtml(a.titre)} — Algeria Tech (version légère)</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
line-height:1.7;color:#1a1a1a;background:#fff;font-size:17px}
.wrap{max-width:680px;margin:0 auto;padding:16px}
header.site{border-bottom:2px solid #0a7d3e;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
header.site a{color:#0a7d3e;text-decoration:none;font-weight:700}
.full-link{font-size:14px;color:#555;font-weight:600}
h1{font-size:1.6rem;line-height:1.3;margin:.4em 0}
h2{font-size:1.25rem;margin:1.4em 0 .4em;color:#0a5c2e}
h3{font-size:1.1rem;margin:1.2em 0 .3em}
.meta{color:#666;font-size:.85rem;margin:.5em 0 1em;border-bottom:1px solid #eee;padding-bottom:.8em}
.meta .cat{background:#0a7d3e;color:#fff;padding:2px 8px;border-radius:4px;font-weight:600;margin-right:8px}
img{max-width:100%;height:auto;border-radius:8px}
.lite-hero{display:block;margin:0 0 1em}
.lite-video{display:block;position:relative;margin:0 0 1em;text-decoration:none}
.lite-video img{width:100%;display:block}
.lite-play{position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,.75);color:#fff;padding:6px 12px;border-radius:6px;font-weight:600;font-size:.9rem}
p{margin:0 0 1em}
ul{margin:0 0 1em;padding-left:1.3em}
li{margin:.3em 0}
hr{border:0;border-top:1px solid #ddd;margin:1.5em 0}
a{color:#0a5c2e}
.lite-tags{margin-top:1.5em;font-size:.85rem}
.lite-tags span{color:#666;margin-right:6px}
footer{border-top:1px solid #eee;margin-top:2em;padding-top:1em;font-size:.85rem;color:#777;text-align:center}
</style>
</head>
<body>
<header class="site">
<a href="/">🇩🇿 Algeria Tech</a>
<a class="full-link" href="${canonical}">Version complète ↗</a>
</header>
<main class="wrap">
<h1>${escapeHtml(a.titre)}</h1>
<div class="meta"><span class="cat">${escapeHtml(a.categorie)}</span> ${escapeHtml(a.date)} · ${escapeHtml(a.heure)} · ⏱ ${readingTime} min</div>
${media}
<div class="content">${body}${pdf}</div>
${tags}
<footer>
Version allégée pour connexions lentes · <a href="${canonical}">Ouvrir la version complète</a><br>
© Algeria Tech
</footer>
</main>
</body>
</html>`;

        res.set('Cache-Control', 'public, max-age=600');
        res.type('html').send(htmlPage);
    } catch (e) {
        res.status(404).type('html').send('<!DOCTYPE html><meta charset="utf-8"><p>Article introuvable. <a href="/">Retour à l\'accueil</a></p>');
    }
});

// === WIKI TIC — Routes ===
app.get('/wiki', (req, res) => res.sendFile(path.join(__dirname, 'wiki.html')));
app.get('/wiki/', (req, res) => res.sendFile(path.join(__dirname, 'wiki.html')));
app.get('/wiki/:slug', (req, res) => res.sendFile(path.join(__dirname, 'wiki.html')));

// === WIKI TIC — API /api/wiki (liste tous les termes) ===
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
    const defM  = body.match(/## Définition\n([\s\S]*?)(?=\n##|$)/);
    const ctxM  = body.match(/## Contexte Algérien\n([\s\S]*?)(?=\n##|$)/);
    const tagsM = body.match(/## Mots-clés SEO\n([\s\S]*?)(?=\n##|$)/);
    const tags  = tagsM ? tagsM[1].trim().split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean) : [];
    return {
        definition: defM ? defM[1].trim() : '',
        contexte:   ctxM ? ctxM[1].trim() : '',
        tags,
    };
}

app.get('/api/wiki', (req, res) => {
    try {
        const terms = [];
        for (const cat of WIKI_CATS) {
            const dir = path.join(__dirname, 'wiki', cat.dir);
            if (!fsSync.existsSync(dir)) continue;
            const files = fsSync.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('INDEX'));
            for (const file of files) {
                try {
                    const content = fsSync.readFileSync(path.join(dir, file), 'utf-8');
                    const fm = parseWikiFm(content);
                    if (!fm.slug || !fm.titre) continue;
                    terms.push({ cat: cat.id, slug: fm.slug, titre: fm.titre, meta: fm.meta, tags: fm.tags });
                } catch (e) { /* skip bad files */ }
            }
        }
        terms.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
        res.json(terms);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// === WIKI TIC — API /api/wiki/:slug (détail d'un terme) ===
app.get('/api/wiki/:slug', (req, res) => {
    const slug = req.params.slug.replace(/[^a-z0-9\-]/gi, '');
    for (const cat of WIKI_CATS) {
        const dir = path.join(__dirname, 'wiki', cat.dir);
        if (!fsSync.existsSync(dir)) continue;
        const files = fsSync.readdirSync(dir).filter(f => f.endsWith('.md'));
        for (const file of files) {
            const filePath = path.join(dir, file);
            try {
                const content = fsSync.readFileSync(filePath, 'utf-8');
                const fm = parseWikiFm(content);
                if (fm.slug === slug) {
                    const body = parseWikiBody(content);
                    return res.json({ ...fm, ...body, cat: cat.id });
                }
            } catch (e) { /* skip */ }
        }
    }
    res.status(404).json({ error: 'Terme non trouvé' });
});
// === FIN WIKI TIC ===

// === SERVIR LES FICHIERS STATIQUES ===
app.use(express.static(__dirname, {
    setHeaders: (res, filepath) => {
        if (filepath.toLowerCase().endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
        }
        // Service Worker : jamais mis en cache (le navigateur doit toujours vérifier la version)
        if (filepath.toLowerCase().endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        // Assets statiques : 24h en prod, no-cache en dev (revalidation ETag → toujours frais en local)
        if (filepath.match(/\.(css|js)$/) && !filepath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', process.env.NODE_ENV === 'production'
                ? 'public, max-age=86400, stale-while-revalidate=604800'
                : 'no-cache');
        }
        // Images : cache 7 jours
        if (filepath.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=604800');
        }
    }
}));

// --- ROUTES ARTICLES ---
app.get('/api/articles', async (req, res) => {
    try {
        if (isCloud && octokit) {
            const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: 'articles' });
            res.json(data.filter(f => f.name.endsWith('.md')).map(f => f.name));
        } else {
            const files = await fs.readdir('articles');
            res.json(files.filter(f => f.endsWith('.md')));
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/article-content/:file', async (req, res) => {
    try {
        const fileName = req.params.file;
        if (isCloud && octokit) {
            const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: `articles/${fileName}` });
            res.send(Buffer.from(data.content, 'base64').toString('utf-8'));
        } else {
            res.send(await fs.readFile(path.join('articles', fileName), 'utf-8'));
        }
    } catch (e) { res.status(404).send("Article non trouvé"); }
});

async function generateArticlesList() {
    try {
        const files = await fs.readdir('articles');
        const mdFiles = files.filter(f => f.endsWith('.md')).sort((a, b) => parseInt(b) - parseInt(a));
        await fs.writeFile('articles/list.json', JSON.stringify(mdFiles, null, 2));
        return mdFiles;
    } catch (e) { console.error("Erreur liste:", e); }
}

async function regenerateArticlesJson() {
    try {
        const files = await fs.readdir('articles');
        const articles = [];
        for (const file of files.filter(f => f.endsWith('.md'))) {
            try {
                const text = await fs.readFile(path.join('articles', file), 'utf-8');
                const parts = text.split('---');
                if (parts.length < 3) continue;
                const fm = parts[1];
                const content = parts.slice(2).join('---').trim();
                const get = (k) => { const m = fm.match(new RegExp(`${k}:\\s*(.*)`)); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
                const tagsMatch = fm.match(/tags:\s*\[(.*)\]/);
                const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')) : [];
                const titre = get('titre');
                if (!titre) continue;
                articles.push({ id: file.replace('.md', ''), titre, date: get('date'), heure: get('heure'), categorie: get('categorie'), image: get('image'), video: get('video'), pdf: get('pdf'), extrait: get('extrait'), rawContent: content, tags, type: get('type'), position: get('position') });
            } catch (e) { console.warn(`Skipping ${file}:`, e.message); }
        }
        articles.sort((a, b) => new Date(`${b.date}T${b.heure || '00:00'}`) - new Date(`${a.date}T${a.heure || '00:00'}`));

        // ── Épinglage manuel en Une : un article marqué position "1" ou "2"
        // passe devant le tri chronologique normal. Un seul article peut tenir
        // chaque position (voir clearPositionConflicts, appelé à la publication).
        const pinned1 = articles.find(a => a.position === '1');
        const pinned2 = articles.find(a => a.position === '2' && a !== pinned1);
        const rest = articles.filter(a => a !== pinned1 && a !== pinned2);
        const ordered = [pinned1, pinned2, ...rest].filter(Boolean);

        await fs.writeFile('articles.json', JSON.stringify(ordered));
        // Version légère (sans rawContent) pour la page d'accueil
        const articlesLight = ordered.map(({ rawContent, ...rest }) => rest);
        await fs.writeFile('articles-list.json', JSON.stringify(articlesLight));
    } catch (e) { console.error("Erreur régénération articles.json:", e); }
}

// ── FETCH URL — helpers ───────────────────────────────────
function fetchWebPage(url, redirectsLeft = 4) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https');
        const client = isHttps ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                'Accept-Encoding': 'identity',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
            },
            ...(isHttps ? { agent: new https.Agent({ rejectUnauthorized: false }) } : {}),
        };
        const req = client.get(url, options, (response) => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                if (!redirectsLeft) return reject(new Error('Trop de redirections'));
                const loc = response.headers.location;
                response.destroy();
                const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
                return fetchWebPage(next, redirectsLeft - 1).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                response.destroy();
                return reject(new Error(`HTTP ${response.statusCode}`));
            }
            const chunks = [];
            response.on('data', c => chunks.push(c));
            response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
            response.on('error', reject);
        });
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout (15s)')); });
        req.on('error', reject);
    });
}

function extractMainText(html) {
    let clean = html
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
        .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
        .replace(/<form[\s\S]*?<\/form>/gi, ' ')
        .replace(/<button[\s\S]*?<\/button>/gi, ' ');

    const zone =
        (clean.match(/<article[\s\S]*?<\/article>/i) || [])[0] ||
        (clean.match(/<main[\s\S]*?<\/main>/i) || [])[0] ||
        (clean.match(/<body[\s\S]*?<\/body>/i) || [])[0] ||
        clean;

    return zone
        .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
        .replace(/&nbsp;/gi, ' ').replace(/&eacute;/gi, 'é').replace(/&agrave;/gi, 'à')
        .replace(/&egrave;/gi, 'è').replace(/&ecirc;/gi, 'ê').replace(/&ccedil;/gi, 'ç')
        .replace(/&ugrave;/gi, 'ù').replace(/&ocirc;/gi, 'ô').replace(/&quot;/gi, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
        .replace(/&[a-z]{2,8};/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── FETCH URL — Extraction web vers texte ─────────────────
// Fallback : proxy lecteur Jina (rend la page comme un navigateur, contourne
// beaucoup d'anti-bots). Renvoie déjà du texte/markdown propre.
async function fetchViaReader(url) {
    const r = await fetch('https://r.jina.ai/' + url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'X-Return-Format': 'text',
        },
        signal: AbortSignal.timeout(40000),
    });
    if (!r.ok) throw new Error(`Reader HTTP ${r.status}`);
    let txt = await r.text();
    // Entête ajoutée par Jina : "Title: ...\nURL Source: ...\nMarkdown Content:"
    const title = (txt.match(/^Title:\s*(.+)$/m) || [])[1] || '';
    txt = txt.replace(/^Title:.*$/m, '').replace(/^URL Source:.*$/m, '')
             .replace(/^Markdown Content:\s*/m, '').trim();
    return { text: txt, title: title.trim() };
}

// Fallback ultime : rendu navigateur complet via Playwright (observatoire/).
// Lance Chromium headless, exécute le JS de la page, puis extrait le texte.
// Plus lourd (~quelques secondes) — réservé aux pages que les méthodes
// directe et proxy n'ont pas su lire.
function fetchViaBrowser(url) {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        const script = path.join(__dirname, 'observatoire', 'render_url.py');
        const child = spawn('python', [script, url], {
            cwd: path.join(__dirname, 'observatoire'),
            env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
        });
        let out = '', err = '';
        const killer = setTimeout(() => child.kill(), 60000);
        child.stdout.on('data', d => out += d);
        child.stderr.on('data', d => err += d);
        child.on('error', e => { clearTimeout(killer); reject(e); });
        child.on('close', code => {
            clearTimeout(killer);
            if (code !== 0) return reject(new Error(err.trim() || `python code ${code}`));
            try {
                const j = JSON.parse(out);
                resolve({ text: j.text || '', title: j.title || '' });
            } catch (e) {
                reject(new Error('Sortie Playwright illisible'));
            }
        });
    });
}

app.post('/api/fetch-url', express.json(), async (req, res) => {
    const { url } = req.body || {};
    if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'URL invalide' });

    const MIN_LEN = 300; // en dessous : extraction probablement bloquée/vide
    let directErr = null;

    // 1) Tentative directe (rapide, gratuite)
    try {
        const html = await fetchWebPage(url);
        const rawTitle = (html.match(/<title[^>]*>([^<]{1,200})<\/title>/i) || [])[1] || '';
        const title = rawTitle.replace(/\s+/g, ' ').trim();
        const ogImage = (html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) || html.match(/content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i) || [])[1] || '';
        const ogVideo = (html.match(/<meta\s+(?:property|name)=["']og:video(?::url)?["']\s+content=["']([^"']+)["']/i) || html.match(/content=["']([^"']+)["']\s+(?:property|name)=["']og:video(?::url)?["']/i) || [])[1] || '';
        const text = extractMainText(html);

        // Certains sites (Next.js App Router avec streaming RSC, ex. aps.dz) ne rendent
        // que le premier paragraphe dans le HTML statique — le reste du corps est injecté
        // via des chunks JSON dans des <script>self.__next_f.push(...)</script>, que
        // extractMainText() ne peut pas lire (les <script> sont retirés). Dans ce cas,
        // le texte extrait paraît "suffisant" (> MIN_LEN) mais n'est en réalité que le
        // lead : on force le passage au fallback (rendu complet) plutôt que de le renvoyer.
        const isStreamedRSC = /self\.__next_f\.push/.test(html);

        if (text.length >= MIN_LEN && !isStreamedRSC) {
            return res.json({ text: text.substring(0, 8000), title, url, image: ogImage || undefined, video: ogVideo || undefined });
        }
        directErr = new Error(isStreamedRSC
            ? 'Page avec contenu streamé côté client (Next.js RSC) — rendu complet requis'
            : 'Contenu trop court (page probablement rendue en JavaScript)');
    } catch (e) {
        directErr = e;
    }

    // 2) Fallback proxy lecteur (sites protégés / rendus côté client)
    try {
        const { text, title } = await fetchViaReader(url);
        if (text.length >= MIN_LEN) {
            return res.json({ text: text.substring(0, 8000), title, url });
        }
    } catch (e) {
        // on passe au rendu navigateur ci-dessous
    }

    // 3) Fallback navigateur complet (Playwright) — plus lourd
    try {
        const { text, title } = await fetchViaBrowser(url);
        if (text.length >= MIN_LEN) {
            return res.json({ text: text.substring(0, 8000), title, url });
        }
    } catch (e) {
        console.error('[fetch-url] Playwright fallback échoué:', e.message);
    }

    // 4) Échec de toutes les méthodes → message explicite
    const is403 = /403/.test(directErr && directErr.message || '');
    res.status(502).json({
        error: is403
            ? "Ce site bloque l'extraction automatique (anti-bot ou paywall). Ouvrez l'article et copiez-collez le texte directement dans la zone ci-dessous."
            : "Impossible d'extraire le contenu de cette page (" + (directErr ? directErr.message : 'inconnu') + "). Copiez-collez le texte manuellement."
    });
});

// ── TRANSCRIPTION PDF ─────────────────────────────────────
app.post('/api/transcribe-pdf', upload, async (req, res) => {
    try {
        if (!req.files || !req.files.pdf) {
            return res.status(400).json({ error: 'Aucun fichier PDF fourni' });
        }

        const file = req.files.pdf[0];
        const dataBuffer = file.buffer || await fs.readFile(file.path);
        const data = await pdfParse(dataBuffer);
        res.json({ text: data.text.trim() });
    } catch (error) {
        console.error('Erreur PDF:', error);
        res.status(500).json({ error: 'Échec de l\'extraction du texte du PDF' });
    }
});

// ── EXTRACTION COMMUNIQUÉ — upload JPG/PNG/PDF/TXT/Word → texte brut ──
const commUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }).single('file');

app.post('/api/extract-communique', (req, res) => {
    commUpload(req, res, async (err) => {
        if (err) return res.status(400).json({ error: 'Upload : ' + err.message });
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

        try {
            const ext = path.extname(req.file.originalname).toLowerCase();
            let rawText;

            if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                rawText = await ocrImageMistral(req.file.buffer, req.file.mimetype || 'image/jpeg');
            } else {
                rawText = await extractText(req.file.buffer, req.file.originalname);
            }

            rawText = (rawText || '').trim();
            if (!rawText) {
                return res.status(422).json({ error: "Aucun texte détecté dans ce fichier." });
            }

            res.json({ rawText });
        } catch (e) {
            console.error('[extract-communique]', e.message);
            res.status(500).json({ error: e.message || "Échec de l'extraction du fichier" });
        }
    });
});

// ── STRUCTURATION COMMUNIQUÉ — texte brut (déjà en français, traduit ou non) → JSON structuré ──
app.post('/api/structure-communique', express.json({ limit: '2mb' }), async (req, res) => {
    const rawText = (req.body && req.body.rawText || '').trim();
    if (!rawText) return res.status(400).json({ error: 'Texte requis' });

    try {
        const structured = await structureCommuniqueIA(rawText);
        res.json(structured);
    } catch (e) {
        console.error('[structure-communique]', e.message);
        res.status(500).json({ error: e.message || "Échec de l'analyse du texte" });
    }
});

// OCR d'une image via le modèle vision de Mistral (Pixtral)
function ocrImageMistral(buffer, mimetype) {
    return new Promise((resolve, reject) => {
        const b64 = buffer.toString('base64');
        const payload = JSON.stringify({
            model: 'pixtral-12b-2409',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: "Transcris fidèlement tout le texte visible sur cette image (il s'agit d'un communiqué de presse). Réponds uniquement avec le texte brut transcrit, sans commentaire ni mise en forme." },
                    { type: 'image_url', image_url: `data:${mimetype};base64,${b64}` }
                ]
            }],
            temperature: 0.1,
            max_tokens: 3000
        });

        const options = {
            hostname: 'api.mistral.ai',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MISTRAL_API_KEY}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const request = https.request(options, (apiRes) => {
            let data = '';
            apiRes.on('data', c => data += c);
            apiRes.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.error) return reject(new Error(result.error.message));
                    resolve(result.choices[0].message.content);
                } catch (e) { reject(e); }
            });
        });
        request.on('error', reject);
        request.write(payload);
        request.end();
    });
}

// Structuration IA du texte brut → champs du formulaire Communiqué
function structureCommuniqueIA(rawText) {
    return new Promise((resolve, reject) => {
        const today = new Date().toISOString().slice(0, 10);
        const prompt = `Tu es assistant de rédaction pour Algeria Tech. On te fournit le texte brut d'un communiqué de presse d'un opérateur télécom algérien (Mobilis, Djezzy ou Ooredoo), extrait d'un document (PDF, image, Word ou texte).

Analyse ce texte et retourne UNIQUEMENT du JSON pur avec cette structure exacte :
{
  "operateur": "Mobilis" | "Djezzy" | "Ooredoo" | "",
  "titre": "titre factuel et concis du communiqué",
  "date": "AAAA-MM-JJ (déduite du texte, sinon ${today})",
  "heure": "HH:MM (déduite du texte, sinon 09:00)",
  "extrait": "résumé en 1 à 2 phrases",
  "contenu": "corps complet du communiqué reformaté proprement en Markdown, en conservant tous les faits, chiffres et citations d'origine",
  "tags": ["tag1", "tag2", "tag3"]
}

Règles :
- "operateur" doit être détecté depuis le texte (mentions explicites de Mobilis, Djezzy ou Ooredoo) ; si ambigu ou absent, laisse une chaîne vide.
- Ne fabrique aucun fait, chiffre ou citation absent du texte source.
- "contenu" doit rester fidèle au texte source, juste nettoyé et mis en forme Markdown (titres ##, paragraphes).
- "tags" ne doit pas inclure le nom de l'opérateur (déjà couvert par "operateur").

TEXTE SOURCE :
${rawText.substring(0, 6000)}`;

        const payload = JSON.stringify({
            model: 'mistral-small-latest',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 3000
        });

        const options = {
            hostname: 'api.mistral.ai',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MISTRAL_API_KEY}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const request = https.request(options, (apiRes) => {
            let data = '';
            apiRes.on('data', c => data += c);
            apiRes.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.error) return reject(new Error(result.error.message));
                    resolve(JSON.parse(result.choices[0].message.content));
                } catch (e) { reject(e); }
            });
        });
        request.on('error', reject);
        request.write(payload);
        request.end();
    });
}

// ── TRANSLATE — Proxy serveur (évite CORS + limite URL client) ──
app.post('/api/translate', express.json(), async (req, res) => {
    const { text, to = 'fr' } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Texte requis' });
    try {
        /* NB : Google renvoie du texte corrompu ("????") pour les scripts non-latins
           (arabe, etc.) via POST — la requête GET avec la query encodée fonctionne
           correctement quelle que soit la langue source. */
        const chunks = [];
        for (let i = 0; i < text.length; i += 1800) chunks.push(text.slice(i, i + 1800));

        const translatedChunks = await Promise.all(chunks.map(async (chunk) => {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(chunk)}`;
            const r = await fetch(url);
            if (!r.ok) throw new Error(`Google Translate HTTP ${r.status}`);
            const d = await r.json();
            return d[0].map(s => s[0]).join('');
        }));

        res.json({ translated: translatedChunks.join('') });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── SMART GENERATE — Rédaction IA journalistique ─────────
app.post('/api/smart-generate', express.json(), async (req, res) => {
    const { text, style, breve } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Texte source requis' });

    const effectiveStyle = style || (breve ? 'breve' : 'aps');

    const PROMPT_BREVE = `Tu es un rédacteur senior de l'Algérie Presse Service (APS), spécialiste du secteur TIC algérien, avec 20 ans d'expérience.

Tu rédiges ici pour l'espace "Brèves" du site : une DÉPÊCHE COURTE, PAS un article de fond. Ce n'est PAS le format habituel APS avec sections détaillées — c'est volontairement court et factuel.

══════════════════════════════════════════════
ÉTAPE 0 — LA SOURCE PARLE-T-ELLE DE L'ALGÉRIE ?
══════════════════════════════════════════════
CAS A — La source concerne l'Algérie (wilaya, opérateur algérien, institution algérienne, etc.) : lead commence par "ALGER, [date] (APS) — " ou la ville algérienne concernée.
CAS B — La source ne concerne pas l'Algérie : lead commence directement par le fait principal, sans ville algérienne ni mention "(APS)" forcée, n'invente aucun lien avec l'Algérie.

══════════════════════════════════════════════
RÉÉCRITURE — INTERDICTION DE PARAPHRASE PARESSEUSE
══════════════════════════════════════════════
Ne recopie AUCUNE phrase entière de la source (sauf citations directes attribuées). Reformule avec un vocabulaire et une structure différents, en conservant exactement les faits, chiffres, noms propres et citations de la source.

══════════════════════════════════════════════
VOCABULAIRE ADMINISTRATIF ALGÉRIEN — OBLIGATOIRE (uniquement si CAS A)
══════════════════════════════════════════════
wilaya (jamais "État"/"département"/"préfecture"), daïra (jamais "arrondissement"), commune, wali (jamais "préfet"), APW, APC, ANPT, ARPCE, Algérie Télécom, Mobilis, Djezzy, Ooredoo — noms officiels exacts.

══════════════════════════════════════════════
STRUCTURE OBLIGATOIRE — 3 PARAGRAPHES MAXIMUM AU TOTAL
══════════════════════════════════════════════
Le champ "contenu" est un texte court en Markdown, SANS sous-titres ("##"), SANS section "Analyse", "Contexte du secteur", "Perspectives" ou "À retenir" :
- Paragraphe 1 (lead) : le fait principal — qui, quoi, où, quand — en 2 phrases maximum.
- Paragraphes 2-3 : détails essentiels, une citation si elle est disponible dans la source, un seul élément de contexte bref. Rien de plus.
Ne dépasse JAMAIS 3 paragraphes. Une brève courte de 2 paragraphes est préférable à un texte étiré artificiellement.

══════════════════════════════════════════════
DONNÉES STRUCTURÉES — TABLEAUX MARKDOWN
══════════════════════════════════════════════
Si la source contient des données chiffrées, horaires, tarifs, comparaisons ou toute information tabulaire (même présentée sous forme de liste) : insère un tableau Markdown dans le contenu. Syntaxe :
| Colonne 1 | Colonne 2 | Colonne 3 |
|---|---|---|
| donnée | donnée | donnée |
Le tableau compte comme un paragraphe. Si la brève contient un tableau, le reste du texte peut se limiter à 1-2 paragraphes.

══════════════════════════════════════════════
RÈGLES DE STYLE APS — ABSOLUES
══════════════════════════════════════════════
- Pyramide inversée : fait principal → détail essentiel → contexte bref
- Phrases courtes (≤ 20 mots), style factuel, au présent ou passé composé
- Titres officiels complets pour toute personne citée
- Chiffres en lettres pour unités (deux millions, cinquante milliards) sauf % et dates
- JAMAIS : "il convient de noter" / "dans un contexte de" / "en conclusion" / "force est de constater" / "remarquable" / "révolutionnaire" / "impressionnant"
- Conserver EXACTEMENT les noms propres, chiffres et citations de la source

RÉPONDS EXCLUSIVEMENT EN JSON PUR :
{
  "titre": "Titre factuel nominal sans verbe (ex: 'Mobilis déploie la 5G dans 12 wilayas')",
  "lead": "[selon CAS A ou CAS B ci-dessus — fait principal en 2 phrases max]",
  "contenu": "...markdown court, 3 paragraphes maximum (un tableau Markdown si données structurées), sans sous-titres...",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "categorie": "Algérie|Télécoms|Mobile|Startups|IA|Fintech|Innovation|Monde|Entreprises",
  "video": ""
}

SOURCE :
${text.substring(0, 4000)}`;

    const PROMPT_PRO = `Tu es un journaliste tech senior, spécialiste du numérique en Afrique du Nord, avec un style éditorial riche et engageant. Tu écris des articles de fond pour un magazine en ligne premium.

══════════════════════════════════════════════
ÉTAPE 0 — LA SOURCE PARLE-T-ELLE DE L'ALGÉRIE ?
══════════════════════════════════════════════
CAS A — La source concerne l'Algérie : intègre le vocabulaire algérien (wilaya, daïra, ARPCE, etc.), lead "ALGER, [date] —" ou ville algérienne.
CAS B — La source ne concerne PAS l'Algérie : n'invente aucun lien, commence par le fait principal avec son lieu réel.

══════════════════════════════════════════════
RÉÉCRITURE — INTERDICTION DE PARAPHRASE PARESSEUSE
══════════════════════════════════════════════
Reformule intégralement. Réorganise, enrichis, contextualise. Ne recopie aucune phrase de la source. Conserve faits, chiffres, noms et citations exacts.

══════════════════════════════════════════════
STYLE ÉDITORIAL — FORMAT PRO ÉTOFFÉ
══════════════════════════════════════════════
- Article de 600 à 900 mots, style magazine/éditorial : phrases articulées, transitions fluides
- Vocabulaire riche et précis, registre soutenu mais accessible
- Accroche narrative percutante (anecdote, question rhétorique, mise en contexte immersive)
- Analyse approfondie : implications économiques, technologiques, géopolitiques
- Mise en perspective : données de marché, comparaisons internationales, tendances sectorielles
- Ton engageant : le lecteur doit comprendre POURQUOI c'est important, pas seulement CE QUI s'est passé

══════════════════════════════════════════════
DONNÉES STRUCTURÉES — TABLEAUX MARKDOWN
══════════════════════════════════════════════
Si la source contient des données chiffrées, horaires, tarifs, statistiques, comparaisons ou toute information tabulaire (même présentée sous forme de liste dans la source) : INSÈRE un ou plusieurs tableaux Markdown dans le contenu aux endroits pertinents. Syntaxe :
| Colonne 1 | Colonne 2 | Colonne 3 |
|---|---|---|
| donnée | donnée | donnée |
Les tableaux rendent l'article plus lisible et professionnel. Ne les évite pas.

══════════════════════════════════════════════
STRUCTURE OBLIGATOIRE DU CONTENU (Markdown)
══════════════════════════════════════════════

## [Accroche + développement du fait]
[3-4 paragraphes — le cœur de l'info, développé avec profondeur. Inclure un tableau si des données comparatives ou chiffrées sont disponibles]

## Analyse et enjeux
[2-3 paragraphes — impacts stratégiques, lecture sectorielle]

## Contexte et perspectives
[2 paragraphes — données de marché, que faut-il surveiller ensuite]

## À retenir
[4-6 points clés en liste à puces, chiffrés si possible]

══════════════════════════════════════════════
RÈGLES ABSOLUES
══════════════════════════════════════════════
- Titres officiels complets pour toute personne citée
- Chiffres en lettres pour unités (deux millions, cinquante milliards) sauf % et dates
- JAMAIS : "il convient de noter" / "dans un contexte de" / "force est de constater" / "révolutionnaire" / "impressionnant"
- Conserver EXACTEMENT les noms propres, chiffres et citations de la source

RÉPONDS EXCLUSIVEMENT EN JSON PUR :
{
  "titre": "Titre accrocheur mais factuel (peut contenir un verbe, style magazine)",
  "lead": "Accroche percutante en 2-3 phrases — donne envie de lire la suite",
  "contenu": "...markdown complet avec sections ## (600-900 mots)...",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "categorie": "Algérie|Télécoms|Mobile|Startups|IA|Fintech|Innovation|Monde|Entreprises",
  "video": ""
}

SOURCE :
${text.substring(0, 5000)}`;

    const PROMPT_APS = `Tu es un rédacteur d'agence de presse, spécialiste du secteur TIC, avec 20 ans d'expérience. Tu écris dans le style dépêche d'agence : factuel, structuré, pyramide inversée.

══════════════════════════════════════════════
RÈGLE ABSOLUE — NE JAMAIS ÉCRIRE "(APS)" DANS L'ARTICLE
══════════════════════════════════════════════
N'écris JAMAIS la mention "(APS)" dans le lead ni ailleurs dans l'article. Pas de "ALGER, [date] (APS) —". Commence simplement par "ALGER — " ou la ville concernée suivie de " — ".

══════════════════════════════════════════════
RÈGLE ABSOLUE — UTILISE UNIQUEMENT LES DONNÉES DE LA SOURCE
══════════════════════════════════════════════
N'INVENTE et n'AJOUTE AUCUNE donnée, statistique, chiffre ou contexte qui ne figure PAS dans le texte source. Ne complète pas avec des informations extérieures. Si la source ne mentionne pas de chiffres de marché, ne les ajoute pas. Le contenu de l'article doit être 100% issu du texte source fourni.

══════════════════════════════════════════════
RÉÉCRITURE — INTERDICTION DE PARAPHRASE PARESSEUSE
══════════════════════════════════════════════
- Ne recopie AUCUNE phrase entière de la source (sauf citations directes entre guillemets attribuées).
- Réorganise l'ordre des informations, change la structure des phrases, varie le vocabulaire.
- Conserve EXACTEMENT les faits, chiffres, noms propres et citations de la source.

══════════════════════════════════════════════
VOCABULAIRE ADMINISTRATIF ALGÉRIEN (si sujet algérien)
══════════════════════════════════════════════
wilaya (jamais "département"/"préfecture"), daïra (jamais "arrondissement"), commune, wali (jamais "préfet"), APW, APC, ANPT, ARPCE, Algérie Télécom, Mobilis, Djezzy, Ooredoo — noms officiels exacts.

══════════════════════════════════════════════
STRUCTURE DE L'ARTICLE
══════════════════════════════════════════════
Le champ "contenu" est en Markdown. Structure :

## [Titre de section — développement du fait principal]
[2-4 paragraphes développant les faits, chiffres et citations de la source. Inclure un tableau Markdown si la source contient des données tabulaires.]

## À retenir
[4 à 7 points clés en liste à puces — uniquement des faits présents dans la source]

══════════════════════════════════════════════
DONNÉES STRUCTURÉES — TABLEAUX MARKDOWN
══════════════════════════════════════════════
Si la source contient des données chiffrées, horaires, tarifs, statistiques, comparaisons ou listes structurées : INSÈRE un tableau Markdown. Syntaxe :
| Colonne 1 | Colonne 2 | Colonne 3 |
|---|---|---|
| donnée | donnée | donnée |
Un tableau bien construit vaut mieux qu'un paragraphe de chiffres.

══════════════════════════════════════════════
RÈGLES DE STYLE
══════════════════════════════════════════════
- Lead : commence par la ville EN MAJUSCULES + " — " (ex: "ALGER — "). JAMAIS "(APS)".
- Pyramide inversée : fait principal → détails → points clés
- Phrases courtes (≤ 20 mots), style factuel, au présent ou passé composé
- Titres officiels complets pour toute personne citée
- Chiffres en lettres pour unités (deux millions, cinquante milliards) sauf % et dates
- JAMAIS : "il convient de noter" / "dans un contexte de" / "en conclusion" / "force est de constater"

RÉPONDS EXCLUSIVEMENT EN JSON PUR :
{
  "titre": "Titre factuel sans verbe conjugué",
  "lead": "VILLE — fait principal en 2 phrases max (JAMAIS de mention APS)",
  "contenu": "...markdown avec section ## principale + ## À retenir + tableaux si données chiffrées...",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "categorie": "Algérie|Télécoms|Mobile|Startups|IA|Fintech|Innovation|Monde|Entreprises",
  "video": ""
}

SOURCE :
${text.substring(0, 4000)}`;

    const prompts = { breve: PROMPT_BREVE, pro: PROMPT_PRO, aps: PROMPT_APS };
    const prompt = prompts[effectiveStyle] || PROMPT_APS;

    const payload = JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: effectiveStyle === 'pro' ? 0.65 : 0.55,
        max_tokens: effectiveStyle === 'pro' ? 4500 : 3500
    });

    const options = {
        hostname: 'api.mistral.ai',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MISTRAL_API_KEY}`,
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const request = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => data += chunk);
        apiRes.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (result.error) throw new Error(result.error.message);
                res.json(JSON.parse(result.choices[0].message.content));
            } catch (e) { res.status(500).json({ error: "Erreur IA: " + e.message }); }
        });
    });

    request.on('error', (e) => res.status(500).json({ error: "Réseau: " + e.message }));
    request.write(payload);
    request.end();
});


// ── Synthèse IA — résumé en points clés via Mistral ─────────────────────────
app.post('/api/synthese', express.json(), async (req, res) => {
    const { titre, contenu, lang } = req.body || {};
    if (!contenu || contenu.length < 80)
        return res.status(400).json({ error: 'Article trop court pour une synthèse.' });

    const langue = lang === 'ar' ? 'arabe' : 'français';
    const prompt =
`Tu es un journaliste expert. Fais une synthèse concise de cet article en ${langue} en maximum 5 points clés.
Chaque point = 1 phrase courte (max 25 mots), précise, factuelle.
Réponds UNIQUEMENT en JSON pur : { "points": ["...", "...", "..."] }

TITRE : ${(titre || '').substring(0, 120)}
ARTICLE : ${contenu.substring(0, 3500)}`;

    const payload = JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.15,
        max_tokens: 400
    });

    try {
        const data   = await callMistral(payload);
        const result = JSON.parse(data);
        if (result.error) throw new Error(result.error.message);
        const parsed = JSON.parse(result.choices[0].message.content);
        if (!Array.isArray(parsed.points) || parsed.points.length === 0)
            throw new Error('Format inattendu');
        res.json({ points: parsed.points.slice(0, 5) });
    } catch (e) {
        console.error('[synthese]', e.code || '', e.message);
        const reseau = MISTRAL_TRANSIENT.has(e.code);
        res.status(reseau ? 503 : 500).json({
            error: reseau
                ? "Service IA momentanément indisponible, réessayez dans un instant."
                : 'Erreur IA : ' + e.message
        });
    }
});

// ── Veille Réglementaire — Journal Officiel Algérien (JORADP) ───────────────
/* Retourne les textes TIC détectés + métadonnées de dernière vérification */
app.get('/api/joradp', (req, res) => {
    const data = loadJoradpData();
    res.json({
        textes:       data.textes      || [],
        lastChecked:  data.lastChecked || null,
        total:        (data.textes || []).length,
    });
});

/* Déclenchement manuel (admin ou cron externe) */
app.post('/api/joradp/refresh', async (req, res) => {
    res.json({ status: 'started', message: 'Vérification JORADP lancée en arrière-plan.' });
    checkJoradpWithAlert()
        .then(n => console.log(`[JORADP] Refresh manuel : ${n} nouveau(x) texte(s).`))
        .catch(e => console.error('[JORADP] Refresh manuel erreur :', e.message));
});

/* ── Rétro-remplissage — tous les JO depuis le n°1 de l'année ── */
let _backfillRunning = false;
app.post('/api/joradp/backfill', async (req, res) => {
    if (_backfillRunning)
        return res.status(409).json({ status: 'already_running',
            message: 'Un backfill est déjà en cours. Vérifiez les logs serveur.' });

    const year     = parseInt(req.body?.year) || new Date().getFullYear();
    const delayMs  = Math.max(1500, parseInt(req.body?.delay_ms) || 3000);

    _backfillRunning = true;
    res.json({
        status: 'started',
        message: `Backfill ${year} lancé en arrière-plan. Vérifiez les logs serveur.`,
        year, delayMs,
    });

    backfillJoradp(year, MISTRAL_API_KEY, delayMs)
        .then(n => {
            _backfillRunning = false;
            console.log(`[JORADP] ✅ Backfill terminé — ${n} texte(s) TIC enregistré(s).`);
        })
        .catch(e => {
            _backfillRunning = false;
            console.error('[JORADP] ❌ Backfill erreur :', e.message);
        });
});

/* ── Statut du backfill ─────────────────────────────────────── */
app.get('/api/joradp/status', (req, res) => {
    const data = loadJoradpData();
    res.json({
        backfillRunning: _backfillRunning,
        textes:          (data.textes || []).length,
        analyzed:        (data.analyzed || []).length,
        lastChecked:     data.lastChecked || null,
    });
});

/* ── Planification automatique : vérification quotidienne à 9h Alger ─────── */
(function scheduleJoradp() {
    /* Prochaine occurrence hebdomadaire : lundi à 09h00 heure algérienne */
    function msUntilNextWeekly(targetDay, hour, min) {
        const now  = new Date();
        const next = new Date(now);
        next.setHours(hour, min, 0, 0);
        let add = (targetDay - next.getDay() + 7) % 7;
        if (add === 0 && now >= next) add = 7;
        next.setDate(next.getDate() + add);
        return next - now;
    }

    function isJoradpStale() {
        const d = loadJoradpData();
        if (!d.lastChecked) return true;
        /* Périmé si le dernier contrôle date de plus de 7 jours */
        return (Date.now() - new Date(d.lastChecked).getTime()) > 7 * 24 * 3600 * 1000;
    }

    /* Vérification immédiate au démarrage si les données sont périmées */
    if (isJoradpStale()) {
        console.log('[JORADP] Données périmées — lancement immédiat...');
        setTimeout(() => {
            checkJoradpWithAlert().catch(e => console.error('[JORADP]', e.message));
        }, 15000); /* 15s après démarrage pour ne pas bloquer le serveur */
    }

    /* Vérification hebdomadaire : lundi 09h00 heure algérienne */
    const msFirst = msUntilNextWeekly(1, 9, 0);
    console.log(`[JORADP] ⏰ Prochaine vérification dans ${(msFirst / 3600000).toFixed(1)}h (lundi 09h00 Alger)`);
    setTimeout(function runWeekly() {
        checkJoradpWithAlert().catch(e => console.error('[JORADP]', e.message));
        setTimeout(runWeekly, 7 * 24 * 3600 * 1000);
    }, msFirst);
})();
// ── FIN Veille Réglementaire JORADP ──────────────────────────────────────────

// ── Veille ARPCE — publications officielles (arpce.dz/fr/pub) ────────────────

/* Retourne toutes les publications ARPCE stockées */
app.get('/api/arpce', (req, res) => {
    const data = loadArpceData();
    res.json({
        items:       data.items      || [],
        lastChecked: data.lastChecked || null,
        total:       (data.items || []).length,
    });
});

/* Déclenchement manuel */
app.post('/api/arpce/refresh', async (req, res) => {
    res.json({ status: 'started', message: 'Vérification ARPCE lancée en arrière-plan.' });
    checkArpceWithAlert(1)
        .then(n => console.log(`[ARPCE] Refresh manuel : ${n} nouveau(x).`))
        .catch(e => console.error('[ARPCE] Refresh erreur :', e.message));
});

/* Backfill — charger les premières pages (opération ponctuelle) */
let _arpceBackfillRunning = false;
app.post('/api/arpce/backfill', async (req, res) => {
    if (_arpceBackfillRunning)
        return res.status(409).json({ status: 'already_running',
            message: 'Un backfill ARPCE est déjà en cours.' });

    const pages    = Math.min(parseInt(req.body?.pages) || 12, 25);
    const stopDate = req.body?.stop_date || '2025-01-01';
    _arpceBackfillRunning = true;
    res.json({ status: 'started', message: `Backfill ARPCE (${pages} pages, arrêt avant ${stopDate}) lancé.`, pages, stopDate });

    backfillArpce(pages, stopDate)
        .then(n  => { _arpceBackfillRunning = false; console.log(`[ARPCE] ✅ Backfill : ${n} publication(s).`); })
        .catch(e => { _arpceBackfillRunning = false; console.error('[ARPCE] ❌ Backfill :', e.message); });
});

/* Statut */
app.get('/api/arpce/status', (req, res) => {
    const data = loadArpceData();
    res.json({
        backfillRunning: _arpceBackfillRunning,
        total:           (data.items || []).length,
        lastChecked:     data.lastChecked || null,
    });
});

/* ── Export statique pour Cloudflare Pages ──────────────────────────────── */
/* Génère joradp_static.json et arpce_static.json depuis les données locales */
/* Ces fichiers sont committés dans git → servis par Cloudflare Pages.       */
app.post('/api/export-static', (req, res) => {
    try {
        const joradpData = loadJoradpData();
        const arpceData  = loadArpceData();

        const joradpStatic = {
            textes:      joradpData.textes  || [],
            lastChecked: joradpData.lastChecked || null,
            total:       (joradpData.textes || []).length,
            generated:   new Date().toISOString(),
        };
        const arpceStatic = {
            items:       arpceData.items    || [],
            lastChecked: arpceData.lastChecked || null,
            total:       (arpceData.items   || []).length,
            generated:   new Date().toISOString(),
        };

        fsSync.writeFileSync(
            path.join(__dirname, 'joradp_static.json'),
            JSON.stringify(joradpStatic)
        );
        fsSync.writeFileSync(
            path.join(__dirname, 'arpce_static.json'),
            JSON.stringify(arpceStatic)
        );

        console.log(`[EXPORT] ✅ joradp_static.json (${joradpStatic.total} textes) + arpce_static.json (${arpceStatic.total} items)`);
        res.json({
            ok:     true,
            joradp: joradpStatic.total,
            arpce:  arpceStatic.total,
            generated: joradpStatic.generated,
        });
    } catch (e) {
        console.error('[EXPORT] ❌', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

/* ── Planification ARPCE : vérification hebdomadaire — lundi 09h30 Alger ──── */
(function scheduleArpce() {
    /* Prochaine occurrence hebdomadaire : lundi à 09h30 heure algérienne */
    function msUntilNextWeekly(targetDay, hour, min) {
        const now  = new Date();
        const next = new Date(now);
        next.setHours(hour, min, 0, 0);
        let add = (targetDay - next.getDay() + 7) % 7;
        if (add === 0 && now >= next) add = 7;
        next.setDate(next.getDate() + add);
        return next - now;
    }
    function isArpceStale() {
        const d = loadArpceData();
        if (!d.lastChecked) return true;
        /* Périmé si le dernier contrôle date de plus de 7 jours */
        return (Date.now() - new Date(d.lastChecked).getTime()) > 7 * 24 * 3600 * 1000;
    }

    /* Vérification au démarrage si périmé */
    if (isArpceStale()) {
        console.log('[ARPCE] Données périmées — vérification dans 20s...');
        setTimeout(() => {
            checkArpceWithAlert(1).catch(e => console.error('[ARPCE]', e.message));
        }, 20000);
    }

    /* Planification hebdomadaire : lundi 09h30 */
    const msFirst = msUntilNextWeekly(1, 9, 30);
    console.log(`[ARPCE] ⏰ Prochaine vérification dans ${(msFirst / 3600000).toFixed(1)}h (lundi 09h30 Alger)`);
    setTimeout(function runWeekly() {
        checkArpceWithAlert(1).catch(e => console.error('[ARPCE]', e.message));
        setTimeout(runWeekly, 7 * 24 * 3600 * 1000);
    }, msFirst);
})();
// ── FIN Veille ARPCE ─────────────────────────────────────────────────────────

// ── Alertes Email — Abonnés Veille Réglementaire ─────────────────────────────

/* S'abonner */
app.post('/api/subscribe', express.json(), (req, res) => {
    const email = (req.body?.email || '').trim();
    const result = subscribe(email);
    if (result.ok) {
        // Envoyer email de bienvenue en arrière-plan
        sendTestEmail(email).then(r => {
            if (!r.ok) console.warn(`[EMAIL] Bienvenue non envoyé à ${email} : ${r.error}`);
        });
    }
    res.json(result);
});

/* Se désabonner (lien email) */
app.get('/api/unsubscribe', (req, res) => {
    const token = req.query.token || '';
    const result = unsubscribe(token);
    if (result.ok) {
        res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
        <title>Désabonnement — Algeria Tech</title>
        <style>body{font-family:Arial;text-align:center;padding:60px;color:#333}
        .ok{color:#2e7d32;font-size:48px} h2{margin:16px 0} a{color:#1a237e}</style></head>
        <body><p class="ok">✅</p><h2>Vous êtes désabonné</h2>
        <p>Vous ne recevrez plus d'alertes réglementaires Algeria Tech.</p>
        <p><a href="/">Retour au site</a></p></body></html>`);
    } else {
        res.status(404).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
        <title>Lien invalide</title></head><body style="font-family:Arial;text-align:center;padding:60px">
        <h2>Lien de désabonnement invalide ou expiré.</h2>
        <p><a href="/">Retour au site</a></p></body></html>`);
    }
});

/* Test SMTP (admin) */
app.post('/api/email/test', express.json(), async (req, res) => {
    const to = req.body?.to || '';
    if (!to) return res.status(400).json({ error: 'Email destinataire requis.' });
    const result = await sendTestEmail(to);
    res.json(result);
});

/* Liste abonnés (admin) */
app.get('/api/subscribers', (req, res) => {
    const subs = getSubscribers().map(s => ({
        email: s.email,
        subscribedAt: s.subscribedAt,
        // Ne pas exposer le token
    }));
    res.json({ count: subs.length, subscribers: subs });
});

/* Wrapper checkJoradp avec alerte email automatique */
async function checkJoradpWithAlert() {
    const data    = loadJoradpData();
    const before  = (data.textes || []).map(t => t.id);
    const found   = await checkJoradp(MISTRAL_API_KEY);
    if (found > 0) {
        const dataAfter = loadJoradpData();
        const newTextes = (dataAfter.textes || []).filter(t => !before.includes(t.id));
        if (newTextes.length > 0) {
            console.log(`[EMAIL] ${newTextes.length} nouveau(x) texte(s) JORADP → envoi alertes…`);
            sendAlerts(newTextes, MISTRAL_API_KEY).catch(e => console.error('[EMAIL]', e.message));
        }
    }
    return found;
}

/* Wrapper checkArpce avec alerte email automatique */
async function checkArpceWithAlert(pages = 1) {
    const data   = loadArpceData();
    const before = (data.items || []).map(i => i.id);
    const found  = await checkArpce(pages);
    if (found > 0) {
        const dataAfter = loadArpceData();
        const newItems  = (dataAfter.items || []).filter(i => !before.includes(i.id));
        if (newItems.length > 0) {
            console.log(`[EMAIL] ${newItems.length} nouvelle(s) pub ARPCE → envoi alertes…`);
            sendAlerts(newItems, MISTRAL_API_KEY).catch(e => console.error('[EMAIL]', e.message));
        }
    }
    return found;
}

// ── FIN Alertes Email ─────────────────────────────────────────────────────────

// ── Vidéos YouTube (grille accueil) — proxy pour garder la clé côté serveur ──
// N'a AUCUN lien avec video-downloader / smart-ingest / boutons +/crayon, qui
// utilisent leurs propres endpoints (yt-dlp / OAuth). Ici : simple listing chaîne.
const YOUTUBE_API_KEY  = process.env.YOUTUBE_API_KEY || "";
const YOUTUBE_CHANNEL  = process.env.YOUTUBE_CHANNEL_ID || "UCyIYnT60oAg8iVZKoz8seAA";
app.get('/api/youtube', (req, res) => {
    if (!YOUTUBE_API_KEY)
        return res.status(503).json({ error: { message: 'Service vidéos non configuré (clé API manquante).', code: 503 } });

    const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}` +
                `&channelId=${YOUTUBE_CHANNEL}&part=snippet,id&order=date&maxResults=12&type=video`;
    https.get(url, apiRes => {
        let data = '';
        apiRes.on('data', c => data += c);
        apiRes.on('end', () => {
            res.set('Cache-Control', 'public, max-age=600');
            res.type('application/json').status(apiRes.statusCode || 200).send(data);
        });
    }).on('error', e => res.status(502).json({ error: { message: 'Réseau YouTube : ' + e.message, code: 502 } }));
});

// ── Débat IA — chat contextuel par article (Mistral) ────────────────────────
app.post('/api/debat', express.json(), async (req, res) => {
    const { titre, contenu, historique, message, langue } = req.body || {};

    if (!message || !String(message).trim())
        return res.status(400).json({ error: 'Message vide.' });
    if (!contenu || contenu.length < 30)
        return res.status(400).json({ error: 'Contenu article trop court.' });

    const lang    = langue || 'français';
    const sysMsg  =
`Tu es un expert analyste en télécommunications, numérique et économie algérienne.
Tu as lu et analysé cet article en détail.
Réponds aux questions du lecteur en te basant sur l'article ET tes connaissances complémentaires.
Sois précis, factuel, nuancé. Développe les arguments avec rigueur.
Réponds en ${lang}. Limite tes réponses à 3-4 paragraphes maximum sauf si la question demande plus de détail.
N'utilise pas de mise en forme markdown (pas de **, pas de #).

=== ARTICLE ===
TITRE : ${String(titre || '').substring(0, 200)}

${String(contenu || '').substring(0, 4200)}
=== FIN ARTICLE ===`;

    const hist = Array.isArray(historique) ? historique.slice(-8) : [];
    const messages = [
        { role: 'system',  content: sysMsg },
        ...hist,
        { role: 'user',    content: String(message).trim().substring(0, 500) }
    ];

    const payload = JSON.stringify({
        model:       'mistral-small-latest',
        messages,
        max_tokens:  700,
        temperature: 0.5
    });

    try {
        const data   = await callMistral(payload);
        const result = JSON.parse(data);
        if (result.error) throw new Error(result.error.message);
        const reponse = result.choices?.[0]?.message?.content;
        if (!reponse) throw new Error('Réponse Mistral vide');
        res.json({ reponse });
    } catch (e) {
        console.error('[debat]', e.code || '', e.message);
        const reseau = MISTRAL_TRANSIENT.has(e.code);
        res.status(reseau ? 503 : 500).json({
            error: reseau
                ? "Service IA momentanément indisponible, réessayez dans un instant."
                : 'Erreur IA : ' + e.message
        });
    }
});

// Un seul article peut occuper la position 1 (Une principale) ou 2 (Une secondaire).
// Avant de publier un article épinglé, on retire ce même numéro de position de
// tout autre article qui le détenait, pour éviter les conflits d'affichage.
async function clearPositionConflicts(position, excludeFileName) {
    if (position !== '1' && position !== '2') return;
    const posRe = new RegExp(`^position:\\s*${position}\\s*$`, 'm');

    if (isCloud) {
        const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: 'articles' });
        for (const entry of data) {
            if (!entry.name.endsWith('.md') || entry.name === excludeFileName) continue;
            try {
                const { data: fileData } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: `articles/${entry.name}` });
                const text = Buffer.from(fileData.content, 'base64').toString('utf-8');
                if (posRe.test(text)) await pushToGithub(`articles/${entry.name}`, text.replace(posRe, 'position: '), `Libère la position ${position}`);
            } catch (e) { console.warn(`clearPositionConflicts (cloud) ${entry.name}:`, e.message); }
        }
    } else {
        const files = await fs.readdir('articles');
        for (const f of files.filter(f => f.endsWith('.md') && f !== excludeFileName)) {
            const filePath = path.join('articles', f);
            const text = await fs.readFile(filePath, 'utf-8');
            if (posRe.test(text)) await fs.writeFile(filePath, text.replace(posRe, 'position: '));
        }
    }
}

app.post('/api/create-article', upload, async (req, res) => {
    try {
        const { id, titre, categorie, date, heure, extrait, tags, contenu, video, type, source, position } = req.body;
        let fileName = (id && id !== "null") ? `${id}.md` : `${Date.now()}.md`;
        let tagsFormatted = "";
        if (tags) tagsFormatted = tags.split(',').map(t => t.trim().replace(/"/g, '')).filter(t => t).map(t => `"${t}"`).join(', ');

        let imagePath = "";
        if (req.files && req.files.image) {
            imagePath = isCloud ? `images/${Date.now()}-${req.files.image[0].originalname}` : `images/${req.files.image[0].filename}`;
        } else {
            imagePath = req.body.existingImage || "";
        }

        let pdfPath = req.body.existingPdf || "";
        if (req.files && req.files.pdf) pdfPath = isCloud ? `documents/${Date.now()}-${req.files.pdf[0].originalname}` : `documents/${req.files.pdf[0].filename}`;

        const frontMatter = `---\ntitre: "${titre.replace(/"/g, '\\"')}"\ncategorie: ${categorie}\ndate: ${date}\nheure: ${heure}\nimage: "${imagePath}"\npdf: "${pdfPath}"\nvideo: "${video || ''}"\nsource: "${(source || '').replace(/"/g, '\\"')}"\nextrait: "${extrait.replace(/"/g, '\\"')}"\ntags: [${tagsFormatted}]\ntype: ${type || ''}\nposition: ${position || ''}\n---\n\n${contenu}\n`;

        if (position === '1' || position === '2') await clearPositionConflicts(position, fileName);

        if (isCloud) {
            if (req.files && req.files.image) await pushToGithub(imagePath, req.files.image[0].buffer, "Upload image", true);
            if (req.files && req.files.pdf) await pushToGithub(pdfPath, req.files.pdf[0].buffer, "Upload PDF", true);
            await pushToGithub(`articles/${fileName}`, frontMatter, `MAJ Article: ${titre}`);
            res.json({ success: true, message: "Enregistré sur GitHub" });
        } else {
            await fs.writeFile(path.join('articles', fileName), frontMatter);
            await generateArticlesList();
            await regenerateArticlesJson();
            res.json({ success: true, message: "Enregistré localement" });
        }
    } catch (e) { console.error("Erreur API:", e); res.status(500).json({ message: e.message }); }
});

// ── UPLOAD PHOTO INLINE — insertion dans le corps d'un article ──
// Reçoit un fichier image unique (champ "photo"), l'enregistre dans images/
// (disque en local, GitHub en cloud) et renvoie { url } prêt à insérer.
const inlineImgUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 }
}).single('photo');

app.post('/api/upload-inline-image', (req, res) => {
    inlineImgUpload(req, res, async (err) => {
        try {
            if (err) throw err;
            if (!req.file) return res.status(400).json({ message: "Aucune image reçue." });
            const ext = (path.extname(req.file.originalname) || '.jpg').toLowerCase();
            const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'].includes(ext) ? ext : '.jpg';
            const fileName = `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
            const imagePath = `images/${fileName}`;
            if (isCloud) {
                await pushToGithub(imagePath, req.file.buffer, "Upload photo inline", true);
            } else {
                if (!fsSync.existsSync('images')) fsSync.mkdirSync('images', { recursive: true });
                await fs.writeFile(path.join('images', fileName), req.file.buffer);
            }
            res.json({ success: true, url: '/' + imagePath });
        } catch (e) {
            console.error("Erreur upload-inline-image:", e);
            res.status(500).json({ message: e.message });
        }
    });
});

app.delete('/api/delete-article/:id', async (req, res) => {
    try {
        const id = req.params.id;
        if (isCloud) {
            const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: `articles/${id}.md` });
            await octokit.repos.deleteFile({ owner: OWNER, repo: REPO, path: `articles/${id}.md`, message: `Suppr ${id}`, sha: data.sha });
        } else {
            await fs.unlink(path.join('articles', `${id}.md`));
            await generateArticlesList();
            await regenerateArticlesJson();
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: "Erreur suppression" }); }
});

async function pushToGithub(filePath, content, message, isImg) {
    let sha;
    try { const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: filePath }); sha = data.sha; } catch (e) { sha = null; }
    await octokit.repos.createOrUpdateFileContents({
        owner: OWNER, repo: REPO, path: filePath, message,
        content: isImg ? content.toString('base64') : Buffer.from(content).toString('base64'),
        sha
    });
}

// ==========================================
// [VEILLE] LOGIQUE BACKEND (RSS + CRUD)
// ==========================================
const VEILLE_FILE = path.join(__dirname, 'veille_data.json');
if (!fsSync.existsSync(VEILLE_FILE)) fsSync.writeFileSync(VEILLE_FILE, JSON.stringify({ manual: [], feed: [], lastUpdated: new Date().toISOString() }));

function loadVeilleData() {
    try { return JSON.parse(fsSync.readFileSync(VEILLE_FILE, 'utf-8')); }
    catch(e) { return { manual: [], feed: [], lastUpdated: new Date().toISOString() }; }
}

function saveVeilleData(data) { fsSync.writeFileSync(VEILLE_FILE, JSON.stringify(data, null, 2)); }

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

const VEILLE_FEEDS = [
    // Algérie TIC — sources thématisées (pas de filtre)
    { url: 'https://lesenjeuxeco.dz/category/tic/feed/',                  label: 'Les Enjeux Eco',       skipFilter: true, browserUA: true },
    { url: 'https://www.algerie360.com/category/high-tech/feed/',         label: 'Algérie 360',          skipFilter: true },
    { url: 'https://itmag.dz/feed/',                                      label: 'ITMag DZ',             skipFilter: true, browserUA: true },
    { url: 'https://www.android-dz.com/feed.xml',                         label: 'Android DZ',           skipFilter: true },
    { url: 'https://www.ntic-dz.com/feed/',                               label: 'NTIC DZ',              skipFilter: true },
    { url: 'https://www.lesoirdalgerie.com/feed',                         label: 'Le Soir DZ',           skipFilter: true },
    { url: 'https://www.elmoudjahid.dz/fr/feed',                          label: 'El Moudjahid',         skipFilter: true },
    // Algérie — presse générale (filtre actif)
    { url: 'https://www.tsa-algerie.dz/feed/',                            label: 'TSA' },
    { url: 'https://www.indjazat.com/category/tic/feed/',                 label: 'Indjazat' },
    { url: 'https://algerie-eco.com/feed/',                               label: 'Algérie Eco' },
    { url: 'https://www.ecomnewsmed.com/location/algerie/feed/',          label: 'EcomNews Med' },
    // International TIC — spécialisées (pas de filtre)
    { url: 'https://www.silicon.fr/feed',                                 label: 'Silicon.fr',           skipFilter: true },
    { url: 'https://www.zdnet.fr/feed/',                                  label: 'ZDNet FR',             skipFilter: true },
    { url: 'https://www.lemonde.fr/pixels/rss_full.xml',                  label: 'Le Monde Pixels',      skipFilter: true },
    { url: 'https://www.wired.com/feed/rss',                              label: 'Wired',                skipFilter: true },
    { url: 'https://techcrunch.com/feed/',                                label: 'TechCrunch' },
];

const VEILLE_TECH_RE = new RegExp(
    '\\btic\\b|t[eé]l[eé]com|fibre\\b|\\bftth\\b|satellite|datacenter|data.?center' +
    '|\\bdjezzy\\b|\\booredoo\\b|\\bmobilis\\b|algérie.?télécom|algerie.?telecom' +
    '|\\b[2345]g\\b|\\blte\\b|t[eé]l[eé]phonie.?mobile|t[eé]l[eé]phonie.?fixe' +
    '|\\binternet\\b|haut.?d[eé]bit|\\bcloud\\b|\\biot\\b|bande.?passante' +
    '|cybers[eé]curit[eé]|s[eé]curit[eé].?informatique|\\bvpn\\b|\\brgpd\\b' +
    '|\\bstartup\\b|\\binnovation\\b|intelligence.?artificielle|\\bia\\b' +
    '|machine.?learning|transformation.?num[eé]rique|num[eé]risation|digitalisation' +
    '|\\barpce\\b|spectre.?de.?fr[eé]quences|\\bsmartphone\\b|objets.?connect[eé]s' +
    '|\\bnum[eé]rique\\b|\\bdigital\\b|\\btech\\b|\\binformatique\\b|\\bntic\\b',
    'i'
);

async function updateVeilleFeeds() {
    const data = loadVeilleData();
    const existingUrls = new Set([...data.feed.map(i => i.url), ...data.manual.map(i => i.url)]);
    // Fenêtre de fraîcheur : on n'ingère pas le backlog RSS trop ancien (certains flux exposent des années d'archives)
    const VEILLE_MAX_AGE_DAYS = 45;
    const cutoff = Date.now() - VEILLE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const parser = new RssParser({
        timeout: 12000,
        headers: { 'User-Agent': 'AlgeriaTech-Bot/2.0' }
    });
    let newItems = [];

    for (const feedCfg of VEILLE_FEEDS) {
        try {
            const feedParser = feedCfg.browserUA
                ? new RssParser({
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlgeriaTech-RevueBot/11.0',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                    requestOptions: { rejectUnauthorized: false }
                  })
                : parser;
            const feed = await feedParser.parseURL(feedCfg.url);
            let count = 0;
            for (const item of (feed.items || []).slice(0, 30)) {
                if (!item.title || !item.link) continue;
                const text = (item.title + ' ' + (item.contentSnippet || item.summary || '')).slice(0, 500);
                if (!feedCfg.skipFilter && !VEILLE_TECH_RE.test(text)) continue;
                // Date fiable et récente requise (pas de fausse date « maintenant », pas de backlog ancien)
                const pub = new Date(item.pubDate || item.isoDate || '');
                if (isNaN(pub.getTime()) || pub.getTime() < cutoff) continue;
                if (!existingUrls.has(item.link)) {
                    existingUrls.add(item.link);
                    newItems.push({
                        id: Buffer.from(item.link).toString('base64').substring(0, 16),
                        title: item.title.trim(),
                        url: item.link,
                        tags: text.toLowerCase().includes('algeri') ? ['Algérie', 'Tech'] : ['Tech', 'Actualité'],
                        date: pub.toISOString(),
                        fetchedAt: new Date().toISOString(),
                        source: feedCfg.label || new URL(feedCfg.url).hostname.replace('www.', ''),
                        isManual: false
                    });
                    count++;
                }
            }
            console.log(`[VEILLE] ${feedCfg.label} → ${count} nouveaux`);
        } catch (e) { console.log(`[VEILLE] RSS échoué pour ${feedCfg.url}:`, e.message); }
    }

    data.feed = [...newItems, ...data.feed]
        .filter(i => { const t = new Date(i.date).getTime(); return !isNaN(t) && t >= cutoff; })
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 150);
    data.lastUpdated = new Date().toISOString();
    saveVeilleData(data);
    console.log('[VEILLE] Flux actualisés. Nouveautés:', newItems.length);
}

updateVeilleFeeds();
setInterval(updateVeilleFeeds, 4 * 60 * 60 * 1000);

// ── REVUE DE PRESSE — Génération automatique à 06h00 heure algérienne (UTC+1) ──
function msUntilNext6h() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(6, 0, 0, 0);
    if (now >= next) next.setDate(next.getDate() + 1);
    return next - now;
}

function isRevueStale() {
    try {
        const revue = JSON.parse(fsSync.readFileSync(path.join(__dirname, 'revue_presse.json'), 'utf8'));
        if (!revue.lastUpdated) return true;
        return new Date(revue.lastUpdated).toDateString() !== new Date().toDateString();
    } catch (e) { return true; }
}

function genererRevuePresse() {
    if (!isRevueStale()) {
        console.log('[REVUE] Déjà à jour aujourd\'hui — génération ignorée.');
        return;
    }
    if (!process.env.MISTRAL_API_KEY) {
        console.warn('[REVUE] ⚠️  MISTRAL_API_KEY non définie — génération auto impossible.');
        return;
    }
    console.log('[REVUE] 📰 Génération de la revue de presse du jour...');
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, ['generate_revue.js'], {
        cwd: __dirname,
        env: { ...process.env },
        stdio: 'inherit'
    });
    child.on('error', e => console.error('[REVUE] ❌ Erreur spawn:', e.message));
    child.on('exit', code => {
        if (code === 0) console.log('[REVUE] ✅ Revue du jour générée avec succès.');
        else console.error(`[REVUE] ❌ Génération échouée (exit code ${code})`);
    });
}

// Au démarrage : génère immédiatement si la revue est périmée (ex: redémarrage après 06h00)
genererRevuePresse();

// Schedule quotidien à 06h00 heure locale = heure algérienne (UTC+1, pas de changement d'heure)
const _msUntil6h = msUntilNext6h();
console.log(`[REVUE] ⏰ Prochaine génération dans ${Math.round(_msUntil6h / 3600000 * 10) / 10}h (06h00 Alger)`);
setTimeout(() => {
    genererRevuePresse();
    setInterval(genererRevuePresse, 24 * 60 * 60 * 1000);
}, _msUntil6h);

app.get('/api/veille', (req, res) => res.json(loadVeilleData()));

app.post('/api/veille', (req, res) => {
    const { title, url, tag } = req.body;
    if (!title || !url) return res.status(400).json({ error: 'Titre et URL requis' });
    const data = loadVeilleData();
    data.manual.push({ id: Date.now().toString(), title, url, tags: tag ? tag.split(',').map(t => t.trim()) : ['Manuel'], date: new Date().toISOString(), source: 'Ajout manuel', isManual: true });
    saveVeilleData(data); res.json({ success: true });
});

app.put('/api/veille/:id', (req, res) => {
    const { id } = req.params; const { title, url, tag } = req.body;
    const data = loadVeilleData();
    const idx = data.manual.findIndex(a => a.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Non trouvé' });
    data.manual[idx] = { ...data.manual[idx], title, url, tags: tag ? tag.split(',').map(t => t.trim()) : data.manual[idx].tags };
    saveVeilleData(data); res.json({ success: true });
});

app.delete('/api/veille/:id', (req, res) => {
    const { id } = req.params;
    const data = loadVeilleData();
    data.manual = data.manual.filter(a => a.id !== id);
    saveVeilleData(data); res.json({ success: true });
});

// ==========================================
// [REVUE DE PRESSE] CRUD MANUEL (admin local uniquement — verrou 403 cloud ci-dessus)
// N'affecte en rien la génération auto (generate_revue.js / Mistral) : simples
// ajustements manuels sur le fichier déjà généré.
// ==========================================
const REVUE_FILE = path.join(__dirname, 'revue_presse.json');

function loadRevueDataFile() {
    return JSON.parse(fsSync.readFileSync(REVUE_FILE, 'utf-8'));
}

function saveRevueDataFile(data) { fsSync.writeFileSync(REVUE_FILE, JSON.stringify(data, null, 2)); }

app.post('/api/revue/article', (req, res) => {
    const { titre, url, source, categorie, pays } = req.body;
    if (!titre || !url) return res.status(400).json({ error: 'Titre et URL requis' });
    const data = loadRevueDataFile();
    data.articles.unshift({
        titre, url,
        resume: '', accroche: titre,
        source: source || 'Ajout manuel',
        logo: `https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(url).hostname; } catch { return 'google.com'; } })()}&sz=32`,
        pays: pays === 'FR' ? 'FR' : 'DZ',
        categorie: categorie || 'Innovation',
        date: new Date().toISOString(),
        isManual: true
    });
    saveRevueDataFile(data);
    res.json({ success: true });
});

app.delete('/api/revue/article/:index', (req, res) => {
    const idx = parseInt(req.params.index, 10);
    const data = loadRevueDataFile();
    if (isNaN(idx) || idx < 0 || idx >= data.articles.length) return res.status(404).json({ error: 'Non trouvé' });
    data.articles.splice(idx, 1);
    saveRevueDataFile(data);
    res.json({ success: true });
});

app.put('/api/revue/tour-horizon', (req, res) => {
    const { titre, lead, corps } = req.body;
    if (!titre || !lead || !Array.isArray(corps)) return res.status(400).json({ error: 'titre, lead et corps (tableau) requis' });
    const data = loadRevueDataFile();
    data.syntheseArticle = {
        titre,
        dateline: (data.syntheseArticle && data.syntheseArticle.dateline) || `Alger, ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} (Algeria Tech)`,
        lead,
        corpsHtml: corps.filter(p => p && p.trim()).map(p => `<p>${p}</p>`)
    };
    saveRevueDataFile(data);
    res.json({ success: true });
});

// ── Cotation Officielle Banque d'Algérie — Scraper PDF ───────────────────────
// URL pattern : https://www.bank-of-algeria.dz/stoodroa/{YYYY}/{MM}/cotation-commerciale-{N}.pdf
// N est un compteur mensuel (jours ouvrables). On tente N+1, N+2 puis recule si besoin.
// ─────────────────────────────────────────────────────────────────────────────
let _boaCache = {
    rates: null, pdfNum: null, pdfUrl: null, pdfDate: null, fetchedAt: 0, cacheMonth: null
};

// Devises BOA connues (dans l'ordre du PDF)
const BOA_ISO_LIST = ['USD','EUR','GBP','JPY','CNY','CHF','CAD','DKK','SEK','NOK','AED','SAR','KWD','TND','MAD','LYD','MRU','SDR'];

function parseBOAText(rawText) {
    // Le PDF BOA est extrait en colonnes séparées :
    //   [BASE] [ISO codes] [Noms] [COURS ACHAT x N] [COURS VENTE x N]
    // Les taux ont 4 decimales (ex: 133.3211). Les entiers (1, 100) et dates sont exclus.

    const text = rawText
        .replace(/\r\n|\r/g, '\n')
        .replace(/,/g, '.');

    // 1. Codes ISO presents dans le doc, dans l'ordre d'apparition
    const ISO_RE = /\b(USD|EUR|GBP|JPY|CNY|CHF|CAD|DKK|SEK|NOK|AED|SAR|KWD|TND|MAD|LYD|MRU|SDR)\b/g;
    const seen = new Set();
    const isoInDoc = [];
    for (const m of text.matchAll(ISO_RE)) {
        if (!seen.has(m[1])) { seen.add(m[1]); isoInDoc.push(m[1]); }
    }
    if (isoInDoc.length < 4) return null;

    // 2. Taux de change : >= 3 decimales, valeur > 1.5
    //    Exclut naturellement les entiers (1, 100), annees (2026), etc.
    const rateNums = [...text.matchAll(/\b(\d{1,4}\.\d{3,6})\b/g)]
        .map(m => parseFloat(m[1]))
        .filter(n => n > 1.5);

    // Structure : N achats puis N ventes (2*N total)
    const N = isoInDoc.length;
    if (rateNums.length < N * 2) return null;

    // Prendre les 2*N dernieres valeurs
    const tail   = rateNums.slice(-N * 2);
    const achats = tail.slice(0, N);
    const ventes = tail.slice(N);

    const rates = {};
    for (let i = 0; i < isoInDoc.length; i++) {
        const code = isoInDoc[i];
        if (achats[i] != null && ventes[i] != null) {
            rates[code] = { buy: +achats[i].toFixed(2), sell: +ventes[i].toFixed(2) };
        }
    }

    return Object.keys(rates).length >= 4 ? rates : null;
}

// Jours ouvrés algériens (week-end = ven + sam) du 1er du mois à aujourd'hui
function estimateBOAPdfN(d) {
    let count = 0;
    const cur = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    while (cur <= end) {
        const dow = cur.getDay(); // 0=dim, 5=ven, 6=sam
        if (dow !== 5 && dow !== 6) count++;
        cur.setDate(cur.getDate() + 1);
    }
    // Léger facteur de correction : jours fériés algériens réduisent le N réel
    return Math.max(1, Math.floor(count * 0.80));
}

async function fetchBOAPdf(yyyy, mm, n) {
    const url = `https://www.bank-of-algeria.dz/stoodroa/${yyyy}/${mm}/cotation-commerciale-${n}.pdf`;
    const resp = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlgeriaTech/2.0)' }
    });
    if (!resp.ok) return null;
    const buf    = Buffer.from(await resp.arrayBuffer());
    const parsed = await pdfParse(buf);
    const rates  = parseBOAText(parsed.text);
    if (!rates) return null;
    // Format numérique DD/MM/YYYY ou DD.MM.YYYY
    let pdfDate = null;
    const dm = parsed.text.match(/(\d{2})[\/.](\d{2})[\/.](\d{4})/);
    if (dm) {
        pdfDate = `${dm[1]}/${dm[2]}/${dm[3]}`;
    } else {
        // Format littéral "22 Juin 2026" (PDF BOA en français)
        const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                      'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
        const lm = parsed.text.match(/(\d{1,2})\s+(Janvier|F[eé]vrier|Mars|Avril|Mai|Juin|Juillet|Ao[uû]t|Septembre|Octobre|Novembre|D[eé]cembre)\s+(\d{4})/i);
        if (lm) {
            const mIdx = String(MOIS.findIndex(m => m.toLowerCase().startsWith(lm[2].toLowerCase().substring(0,3))) + 1).padStart(2,'0');
            pdfDate = `${String(lm[1]).padStart(2,'0')}/${mIdx}/${lm[3]}`;
        }
    }
    return { rates, pdfDate, pdfUrl: url };
}

app.get('/api/dzd-rates', async (req, res) => {
    const now  = Date.now();
    const d    = new Date();
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const curMonth = `${yyyy}-${mm}`;

    // Cache valide 1 heure
    if (_boaCache.rates && now - _boaCache.fetchedAt < 3_600_000) {
        return res.json({ ..._boaCache, cached: true });
    }

    // Estimer le N courant
    const estimated = _boaCache.cacheMonth === curMonth && _boaCache.pdfNum
        ? _boaCache.pdfNum + 3          // chercher d'abord 3 au-dessus du dernier connu
        : estimateBOAPdfN(d) + 3;       // premier lancement : estimation jours ouvrés

    // Séquence décroissante : de estimated jusqu'à 1 (s'arrête au premier PDF valide)
    let found = null;
    for (let n = Math.min(estimated, 28); n >= 1; n--) {
        try {
            found = await fetchBOAPdf(yyyy, mm, n);
            if (found) { found.pdfNum = n; break; }
        } catch (_) { /* timeout ou réseau → continuer */ }
    }

    // Dernier recours : mois précédent (si tout le mois courant est vide, ex: 1er du mois)
    if (!found) {
        const prevDate = new Date(d.getFullYear(), d.getMonth() - 1, 15);
        const py = prevDate.getFullYear();
        const pm = String(prevDate.getMonth() + 1).padStart(2, '0');
        for (let n = 25; n >= 1; n--) {
            try {
                found = await fetchBOAPdf(py, pm, n);
                if (found) { found.pdfNum = n; break; }
            } catch (_) { /* continue */ }
        }
    }

    if (found) {
        _boaCache = {
            rates:      found.rates,
            pdfNum:     found.pdfNum,
            pdfUrl:     found.pdfUrl,
            pdfDate:    found.pdfDate,
            fetchedAt:  now,
            cacheMonth: curMonth,
        };
        console.log(`[BOA] ✅ cotation-commerciale-${found.pdfNum}.pdf · ${found.pdfDate || '?'} · ${Object.keys(found.rates).length} devises`);
        return res.json({ ..._boaCache, cached: false });
    }

    if (_boaCache.rates) {
        console.warn('[BOA] ⚠️ Aucun PDF trouvé — cache périmé renvoyé');
        return res.json({ ..._boaCache, cached: true, stale: true });
    }

    res.status(503).json({ error: 'PDF Banque d\'Algérie inaccessible' });
});
// ── FIN Cotation BOA ──────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));

// ── API fonds d'écran ─────────────────────────────────────────────────────────
app.get('/api/backgrounds/:theme', (req, res) => {
    const theme = req.params.theme.replace(/[^a-z0-9_-]/gi, '');
    const dir = path.join(__dirname, 'public', 'backgrounds', theme);
    if (!fsSync.existsSync(dir)) return res.json({ images: [] });
    const exts = ['.jpg','.jpeg','.png','.webp','.avif'];
    const images = fsSync.readdirSync(dir).filter(f => exts.includes(path.extname(f).toLowerCase())).sort();
    res.json({ images });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// GÉNÉRATEUR D'INFOGRAPHIES PREMIUM — POST /api/generate
// Crée un dossier multi-fichiers dans infographies/ (qualité blueprint)
// + met à jour interactifs-list.json automatiquement
// ═══════════════════════════════════════════════════════════════════════════════
const { buildInfographie } = require('./generator/infographie-builder');
const genUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } }).single('file');

app.post('/api/generate', (req, res) => {
    genUpload(req, res, async (err) => {
        if (err) return res.status(400).json({ error: 'Upload: ' + err.message });
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
        try {
            const text = await extractText(req.file.buffer, req.file.originalname);
            const type          = req.body.type          || 'auto';
            const animType      = req.body.animationType  || '';
            const bgTheme       = req.body.bgTheme        || 'none';
            const bgImage       = req.body.bgImage        || 'none';
            const slideTemplate = req.body.slideTemplate  || 'none';
            const data = analyseDoc(text, type, req.file.originalname);

            // Construction de l'infographie premium multi-fichiers
            const result = await buildInfographie(data, { type, animType, bgTheme, bgImage, slideTemplate });

            console.log(`[generate] ✓ Infographie créée : ${result.url}`);
            res.json({
                url:   result.url,
                slug:  result.slug,
                title: result.title,
                path:  result.path
            });
        } catch(e) {
            console.error('[generate]', e.message, e.stack);
            res.status(500).json({ error: e.message });
        }
    });
});

// ── Extraction texte ──────────────────────────────────────────────────────────
async function extractText(buf, filename) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') {
        const r = await pdfParse(buf); return r.text || '';
    }
    if (ext === '.docx') {
        try {
            const r = await mammoth.extractRawText({ buffer: buf }); return r.value || '';
        } catch (e) {
            throw new Error("Fichier .docx illisible ou corrompu. Vérifiez le fichier ou réenregistrez-le depuis Word.");
        }
    }
    if (ext === '.doc') {
        /* Mammoth ne lit que le format .docx (zip) — l'ancien format binaire .doc
           (OLE), encore courant pour les documents en arabe, nécessite word-extractor. */
        try {
            const extractor = new WordExtractor();
            const doc = await extractor.extract(buf);
            return doc.getBody() || '';
        } catch (e) {
            throw new Error("Fichier .doc illisible ou corrompu. Vérifiez le fichier ou réenregistrez-le au format .docx depuis Word.");
        }
    }
    if (ext === '.pptx' || ext === '.ppt') {
        try {
            const zip = new AdmZip(buf); let txt = '';
            zip.getEntries().forEach(e => {
                if (/ppt\/slides\/slide\d+\.xml$/.test(e.entryName)) {
                    const xml = e.getData().toString('utf-8');
                    txt += (xml.match(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)||[])
                               .map(m => m.replace(/<[^>]+>/g,'')).filter(Boolean).join(' ') + '\n';
                }
            });
            return txt;
        } catch(e) { return ''; }
    }
    return buf.toString('utf-8');
}

// ── Analyse du texte → données structurées ────────────────────────────────────
function analyseDoc(text, type, filename) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const dtype = type === 'auto' ? detectType(text) : type;

    return {
        title:     findTitle(lines, filename),
        subtitle:  findSubtitle(lines, findTitle(lines, filename)),
        date:      findDate(text),
        source:    fixEncoding(path.basename(filename, path.extname(filename)).replace(/[-_]/g,' ')),
        docType:   dtype,
        typeLabel: { telecom:'Télécommunications', startup:'Startups & Innovation',
                     rapport:'Rapport Officiel', presse:'Article de Presse' }[dtype] || 'Document',
        stats:     extractStats(text),
        keyPoints: extractPoints(lines),
        sections:  extractSections(lines),
        chartData: buildSeries(text)
    };
}

function detectType(t) {
    const lo = t.toLowerCase();
    const sc = k => (lo.split(k).length - 1);
    return ['telecom','startup','rapport','presse'].sort((a,b) =>
        ({telecom:sc('mobile')+sc('télécom')+sc('abonné')+sc('arpce')+sc('réseau')+sc('4g'),
          startup:sc('startup')+sc('levée')+sc('incubat')+sc('invest')+sc('pitch'),
          rapport:sc('rapport')+sc('bilan')+sc('résultat')+sc('chiffre')+sc('exercice'),
          presse: sc('selon')+sc('déclaré')+sc('annonce')+sc('communiqué')+sc('source')}[b]-
         {telecom:sc('mobile')+sc('télécom')+sc('abonné')+sc('arpce')+sc('réseau')+sc('4g'),
          startup:sc('startup')+sc('levée')+sc('incubat')+sc('invest')+sc('pitch'),
          rapport:sc('rapport')+sc('bilan')+sc('résultat')+sc('chiffre')+sc('exercice'),
          presse: sc('selon')+sc('déclaré')+sc('annonce')+sc('communiqué')+sc('source')}[a]))[0];
}

function fixEncoding(s) {
    // Repair Latin-1 mojibake from filenames with UTF-8 accented chars
    try {
        const fixed = Buffer.from(s, 'latin1').toString('utf8');
        // Only use if it looks better (no replacement chars)
        return fixed.includes(' ') ? s : fixed;
    } catch { return s; }
}

function findTitle(lines, fn) {
    // Boilerplate to skip (Algerian administrative headers + contact info)
    const BOILER = /^(REPUBLIQUE|AUTORITE|MINISTERE|POSTE\s|COMMUNICATIONS?\s+ELECTRONIQUES?|REGULATION|ARPCE|ARPT|CONSEIL\s|MINISTRE|HAUT\s+COMMISSARIAT|AGENCE\s+NATIONALE|SECRETARIAT)/i;
    const SKIP   = line =>
        BOILER.test(line) ||
        /^\d{1,4}[.,):\s]/.test(line)  ||  // street/numbered lines  "01, Rue…"
        /@/.test(line)                  ||  // email
        /^www\.|https?:\/\//i.test(line)||  // URL
        /^[\+\d\s\-\/()]{8,}$/.test(line)  ||  // phone number or address code
        /^page\s/i.test(line)           ||
        line.length <= 3;
    // Preferred keywords signalling the real report title — must look like a title
    // (all-caps OR starts with the keyword)
    const PREFER_KW = /OBSERVATOIRE|RAPPORT\s+|MARCH[EÉ]\s+DE|[EÉ]TUDE\s+|BILAN\s+|ENQU[EÊ]TE\s+|NOTE\s+DE\s|TABLEAU\s+DE\s+BORD|SYNTH[EÈ]SE\s|MONITOR/i;
    const isTitle   = l => l.length > 8 && (
        l.trim() === l.trim().toUpperCase() ||          // ALL CAPS
        /^(OBSERVATOIRE|RAPPORT|MARCH|[EÉ]TUDE|BILAN|ENQU|NOTE\s+DE|TABLEAU|SYNTH|MONITOR)/i.test(l.trim())
    );

    // Pass 1 — preferred keyword + title-like structure in first 80 lines
    for (const l of lines.slice(0, 80)) {
        if (!SKIP(l) && l.length < 150 && PREFER_KW.test(l) && isTitle(l)) return l.trim();
    }
    // Pass 2 — first clean non-boilerplate sentence in first 30 lines
    //          merge consecutive short lines that form a single title (split by PDF layout)
    let candidate = '', candidateLen = 0;
    for (const l of lines.slice(0, 30)) {
        if (SKIP(l)) { if (candidate) break; continue; }
        if (candidate) {
            // merge if both parts together still look like a title
            const merged = candidate + ' ' + l.trim();
            if (merged.length < 130) { candidate = merged; candidateLen++; }
            if (candidateLen >= 2) break; // max 2 parts
        } else {
            candidate = l.trim();
            candidateLen = 1;
            if (l.trim().length >= 20) break; // long enough on its own
        }
    }
    if (candidate) return candidate;
    // Fallback — filename (repair potential UTF-8/Latin-1 mojibake)
    const raw = path.basename(fn, path.extname(fn)).replace(/[-_]/g, ' ');
    return fixEncoding(raw);
}
function findSubtitle(lines, title) {
    const BOILER = /^(REPUBLIQUE|AUTORITE|MINISTERE|POSTE\s|ARPCE|ARPT)/i;
    for (const l of lines.slice(0, 50)) {
        const lt = l.trim();
        if (!lt || lt === title) continue;
        if (lt.length > 12 && lt.length < 160
            && !BOILER.test(lt)
            && !/@/.test(lt)
            && !/^www\.|https?:\/\//i.test(lt)
            && !/^\d{1,4}[.,):\s]/.test(lt)
            && !/^[\+\d\s\-\/()]{8,}$/.test(lt)
            && !/^page\s/i.test(lt)) return lt;
    }
    return '';
}
function findDate(text) {
    const m = text.match(/T[1-4]\s*20\d{2}/) || text.match(/\b(20\d{2})\b/);
    return m ? m[0] : new Date().getFullYear().toString();
}

function extractStats(text) {
    const stats = [], seen = new Set();
    const push = (label, value, numericValue, unit, icon, trend) => {
        const k = `${Math.round(numericValue)}-${unit}`;
        if (seen.has(k) || numericValue <= 0) return;
        seen.add(k);
        stats.push({ label: label.substring(0,30), value, numericValue, unit, icon: icon||'📊', trend: trend||null });
    };

    // 1. Label + large number on same line: "Abonnés ADSL 2 204 319"
    for (const m of text.matchAll(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\/\(\)]{4,38}?)\s{1,3}(\d{1,3}(?:[\s]\d{3})+)(?!\s*\d)/g)) {
        if (stats.length >= 6) break;
        const n = num(m[2]); if (n < 1000) continue;
        const lbl = m[1].trim().replace(/\s+/g,' ');
        const icon = /abonn|client|util|user/i.test(lbl)?'👥':/trafic|data|bande/i.test(lbl)?'📶':/revenu|chiffre|million/i.test(lbl)?'💰':'📊';
        push(cap(lbl), fmtNum(n), n, n>1e6?'abonnés':n>1e5?'k':'', icon, null);
    }

    // 2. "X,XX millions d'abonnés" or "X millions de Y"
    for (const m of text.matchAll(/(\d+[,.]\d+)\s*millions?\s+d[''e]?\s*([\w\séèêà]{2,25})/gi)) {
        if (stats.length >= 6) break;
        const n = num(m[1]); if (!n) continue;
        push(cap(m[2].trim()), m[1].replace(',','.')+' M', n, 'Millions', '👥', null);
    }

    // 3. Explicit percentages with context label
    for (const m of text.matchAll(/(\d+[,.]\d+)\s*%\s*(?:du\s+|de\s+|des\s+)?([\w\séèêàâùûîôÀ-ÿ]{4,40})?/g)) {
        if (stats.length >= 6) break;
        const v = num(m[1]); if (v < 0.1 || v > 100) continue;
        const lbl = m[2] ? m[2].trim().replace(/\s+/g,' ') : 'Taux';
        if (lbl.length < 3) continue;
        push(cap(lbl), m[1]+'%', v, '%', v>50?'📈':'📉', `${m[1]}%`);
    }

    // 4. Gbps / Tbps bandwidth
    for (const m of text.matchAll(/(\d[\d\s]*[,.]\d+|\d{3,})\s*(Gbps|Tbps|Mbps)/gi)) {
        if (stats.length >= 6) break;
        const n = num(m[1]); if (!n) continue;
        push('Bande passante', m[1].trim()+' '+m[2], n, m[2].toUpperCase(), '📶', null);
    }

    // 5. Fallback: any number > 10000 preceded/followed by label keyword
    if (stats.length < 3) {
        for (const m of text.matchAll(/(abonnés?|clients?|utilisateurs?|emplois?|startups?|entreprises?)\s+(\d[\d\s]{3,})/gi)) {
            if (stats.length >= 5) break;
            const n = num(m[2]); if (n < 100) continue;
            push(cap(m[1]), fmtNum(n), n, '', '📊', null);
        }
    }

    return stats;
}

function fmtNum(n) {
    if (n >= 1e6)  return (n/1e6).toFixed(2).replace('.',',') + ' M';
    if (n >= 1000) return Math.round(n).toLocaleString('fr-FR');
    return String(n);
}

function extractPoints(lines) {
    const pts = [];
    const seen = new Set();

    // Filtre qualité : longueur, unicité, pas de contenu TOC/boilerplate
    const BOIL = /^(republique|autorite|ministere|poste\s|arpce|arpt|sommaire|table des|liste des|chapitre|annexe|figure\s|tableau\s\d|page\s\d)/i;
    const isTOC = l => /\.{4,}\s*\d+\s*$/.test(l); // "Titre ............... 4"
    const add = (s) => {
        const t = s.trim().replace(/\s+/g, ' ');
        if (t.length < 35 || t.length > 300) return;
        if (BOIL.test(t)) return;
        if (isTOC(t)) return;
        const key = t.substring(0, 45).toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        pts.push(t);
    };

    // ── Passe 1 : listes à puces / numérotées (contenu structuré)
    const bRe = /^[-•·▪▸➤✓✔►*►◆◇]\s+(.+)/;
    const nRe = /^\d+[.)]\s+(.{30,})/;
    for (const l of lines) {
        if (pts.length >= 8) break;
        const b = l.match(bRe), n = l.match(nRe);
        if (b && b[1].length > 35) add(b[1]);
        else if (n) add(n[1]);
    }

    // ── Passe 2 : phrases analytiques avec chiffres + vocabulaire sectoriel
    const KW_TELECOM = /%|million|milliard|Mbps|Gbps|DA\b|abonné|opérateur|réseau|marché|parc|pénétration|ARPU|4G|5G|haut débit|accès|couverture/i;
    const KW_START   = /^(Le\s|La\s|Les\s|L'|Au\s|En\s|Sur\s|Avec\s|Pour\s|Dans\s|Cette\s|Ce\s|Un\s|Une\s|Il\s|Elle\s)/i;
    if (pts.length < 5) {
        for (const l of lines) {
            if (pts.length >= 8) break;
            if (l.length < 40 || l.length > 260) continue;
            if (/\d/.test(l) && KW_TELECOM.test(l) && KW_START.test(l.trim())) add(l);
        }
    }

    // ── Passe 3 : phrases avec données numériques significatives
    if (pts.length < 5) {
        for (const l of lines) {
            if (pts.length >= 8) break;
            if (l.length > 45 && l.length < 230 && /\d{4,}|[\d,]+\s*%/.test(l) && !/^\d{1,4}\s/.test(l.trim())) add(l);
        }
    }

    // ── Passe 4 : phrases de conclusion / synthèse institutionnelle
    if (pts.length < 3) {
        const CONCL = /^(En\s+(conclusion|résumé|synthèse)|Il\s+(ressort|convient|apparaît)|L'analyse\s|Cette\s+étude\s|Le\s+rapport\s+souligne|Les\s+résultats\s|On\s+(constate|observe|note)|La\s+tendance\s|Le\s+marché\s+(?:a\s+enregistré|affiche|présente|démontre|confirme))/i;
        for (const l of lines) {
            if (pts.length >= 7) break;
            if (l.length > 50 && l.length < 280 && CONCL.test(l.trim()) && !isTOC(l)) add(l);
        }
    }

    // ── Passe 5 : synthèse générative à partir des statistiques détectées
    // Si on a peu de points extraits, on génère des phrases analytiques à partir
    // des chiffres trouvés dans le texte
    if (pts.length < 3) {
        const numRe = /([A-ZÀ-ÿa-z][A-ZÀ-ÿa-z\s\/\-]{3,35}?)\s+(\d[\d\s]{2,}[\d])(?:\s*(millions?|milliards?|%|abonnés?|DA))?/g;
        const fullText = lines.join(' ');
        for (const m of fullText.matchAll(numRe)) {
            if (pts.length >= 7) break;
            const label = m[1].trim().replace(/\s+/g, ' ');
            const value = m[2].trim().replace(/\s+/g, ' ');
            const unit  = m[3] || '';
            if (label.length < 5 || label.length > 40) continue;
            if (BOIL.test(label)) continue;
            const synth = `L'indicateur « ${cap(label)} » ressort à ${value}${unit ? ' ' + unit : ''} pour la période analysée.`;
            add(synth);
        }
    }

    return [...new Set(pts)].slice(0, 8);
}

function extractSections(lines) {
    const secs = []; let ct = null, cb = [];
    const hRe = /^([A-ZÉÈÊÀÂÙÛÎÔ][A-ZÉÈÊÀÂÙÛÎÔA-Z\s]{2,48})$/;
    for (const l of lines) {
        if (l.length > 300) continue;
        if ((hRe.test(l) || (l.length < 60 && l.endsWith(':'))) && l.length > 4) {
            if (ct && cb.length) secs.push({ title: ct, body: cb.join(' ').substring(0,400) });
            ct = l.replace(/:$/,''); cb = [];
        } else if (ct) cb.push(l);
        if (secs.length >= 3) break;
    }
    if (ct && cb.length) secs.push({ title: ct, body: cb.join(' ').substring(0,400) });
    return secs.slice(0,3);
}

function buildSeries(text) {
    // Pattern 1: "T3 2024T4 2024T1 2025T2 2025T3 2025" (PDF chart axis labels concatenated)
    // Values appear BEFORE the axis labels in the text stream
    const concatIdx = text.search(/(T[1-4]\s*20\d{2}){3,}/);
    if (concatIdx >= 0) {
        const concatM = text.slice(concatIdx).match(/((?:T[1-4]\s*20\d{2}\s*){3,})/);
        if (concatM) {
            const lbls = [...concatM[1].matchAll(/T([1-4])\s*(20\d{2})/g)].map(m=>`T${m[1]}-${m[2]}`);
            // Values appear in the 600-char window before the axis labels
            const region = text.slice(Math.max(0, concatIdx - 600), concatIdx);
            // Extract all decimal numbers, filter out axis ticks (multiples of 10)
            const allVals = [...region.matchAll(/\b(\d+[,.]\d+)\b/g)]
                .map(m=>num(m[1])).filter(v=>v>0 && v%10 !== 0);
            // Take the last lbls.length values (data is closer to the axis labels than axis ticks)
            const vals = allVals.slice(-lbls.length);
            if (lbls.length >= 3 && vals.length >= 3) {
                return { labels:lbls.slice(0, vals.length), values:vals.slice(0, lbls.length), label:'Évolution trimestrielle (millions)', type:'line' };
            }
        }
    }

    // Pattern 2: "T1 : 45,2" or "T2 - 48.5" explicit format
    const qM = [...text.matchAll(/T([1-4])(?:\s*20\d{2})?\s*[:\-–]\s*(\d+[,.]\d+)/g)];
    if (qM.length >= 3) return { labels:qM.map(m=>`T${m[1]}`), values:qM.map(m=>num(m[2])), label:'Évolution trimestrielle', type:'bar' };

    // Pattern 3: "2021 - 42,1" yearly
    const yM = [...text.matchAll(/(20\d{2})\s*[:\-–]\s*(\d[\d,.']+)/g)];
    if (yM.length >= 3) return { labels:yM.map(m=>m[1]), values:yM.map(m=>num(m[2])), label:'Évolution annuelle', type:'bar' };

    // Pattern 4: ARPCE-style tables "Label text 2 204 319\nLabel2 2 045 253"
    const tableM = [...text.matchAll(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\/]{5,35}?)\s{1,3}(\d{1,3}(?:\s\d{3})+)/g)];
    if (tableM.length >= 3) {
        const rows = tableM.map(m=>({ label:m[1].trim().split(/\s+/).slice(-3).join(' '), value:num(m[2]) }))
                           .filter(r=>r.value>10000).slice(0,6);
        if (rows.length >= 3) return { labels:rows.map(r=>cap(r.label).substring(0,18)), values:rows.map(r=>r.value), label:'Répartition par catégorie', type:'bar' };
    }

    return { labels:[], values:[], label:'', type:'bar' };
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; }
function clean(s) { return s.replace(/\s/g,'').replace(',','.'); }
function num(s)   { return parseFloat(String(s).replace(/[\s']/g,'').replace(',','.')) || 0; }

// ── VIDEO DOWNLOADER ─────────────────────────────────────────────────────────
const { spawn } = require('child_process');
const os = require('os');

const YTDLP = 'C:\\Users\\Aps\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\yt-dlp.exe';
const FFMPEG_PATH = 'C:\\Users\\Aps\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe';
function ytdlpExtra() {
    return ['--socket-timeout', '30', '--retries', '3'];
}

// GET /api/video-info?url=...
app.get('/api/video-info', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL manquante' });

    const args = [...ytdlpExtra(), '--dump-json', '--no-playlist', url];
    const proc = spawn(YTDLP, args);

    let out = '';
    let err = '';
    let responded = false;
    proc.on('error', e => {
        if (!responded) { responded = true; res.status(500).json({ error: 'yt-dlp introuvable', details: e.message }); }
    });
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);

    proc.on('close', code => {
        if (responded) return;
        if (code !== 0) return res.status(500).json({ error: 'Impossible d\'analyser cette URL', details: err.slice(0, 500) });
        try {
            const info = JSON.parse(out);
            res.json({
                title:     info.title || 'Sans titre',
                uploader:  info.uploader || info.channel || '',
                thumbnail: info.thumbnail || '',
                duration:  info.duration || 0,
                platform:  info.extractor_key || '',
                formats:   (info.formats || [])
                    .filter(f => f.vcodec !== 'none' && f.height)
                    .map(f => ({ id: f.format_id, height: f.height, ext: f.ext, note: f.format_note }))
                    .sort((a, b) => (b.height || 0) - (a.height || 0))
                    .slice(0, 6)
            });
        } catch (e) {
            res.status(500).json({ error: 'Erreur JSON', details: e.message });
        }
    });
});

// GET /api/download-video?url=...&quality=best
app.get('/api/download-video', (req, res) => {
    const { url, quality } = req.query;
    if (!url) return res.status(400).json({ error: 'URL manquante' });

    const tmpFile = path.join(os.tmpdir(), `vid_${Date.now()}.%(ext)s`);
    // Full HD 1080p en priorité (DASH av01) ; fallback progressif hd/sd si connexion faible.
    const fmt = quality === '1080' ? 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/hd/sd/best[height<=1080]/best'
              : quality === '720'  ? 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/hd/sd/best[height<=720]/best'
              : quality === '480'  ? 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/sd/best[height<=480]/best'
              : 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/hd/sd/best[ext=mp4]/best';

    const args = [
        ...ytdlpExtra(),
        '--no-playlist',
        '--format', fmt,
        '--merge-output-format', 'mp4',
        '--ffmpeg-location', FFMPEG_PATH,
        '-o', tmpFile,
        url
    ];

    const proc = spawn(YTDLP, args);

    let logOut = '';
    let dlResponded = false;
    proc.on('error', e => {
        if (!dlResponded) { dlResponded = true; res.status(500).json({ error: 'yt-dlp introuvable', details: e.message }); }
    });
    proc.stderr.on('data', d => logOut += d);

    proc.on('close', code => {
        if (dlResponded) return;
        if (code !== 0) {
            dlResponded = true;
            return res.status(500).json({ error: 'Échec du téléchargement', details: logOut.slice(-800) });
        }
        // Trouver le fichier téléchargé
        const base = tmpFile.replace('%(ext)s', '');
        const tmpDir = path.dirname(tmpFile);
        const prefix = path.basename(base);
        const files = fsSync.readdirSync(tmpDir).filter(f => f.startsWith(prefix));
        if (!files.length) return res.status(500).json({ error: 'Fichier introuvable après téléchargement' });

        const finalFile = path.join(tmpDir, files[0]);
        const stat = fsSync.statSync(finalFile);

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');

        const stream = fsSync.createReadStream(finalFile);
        stream.pipe(res);
        stream.on('close', () => {
            try { fsSync.unlinkSync(finalFile); } catch (e) {}
        });
    });
});
// GET /api/download-audio?url=...
app.get('/api/download-audio', (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL manquante' });

    const tmpFile = path.join(os.tmpdir(), `aud_${Date.now()}.%(ext)s`);

    const args = [
        ...ytdlpExtra(),
        '--no-playlist',
        '--format', 'bestaudio/best',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--ffmpeg-location', FFMPEG_PATH,
        '-o', tmpFile,
        url
    ];

    const proc = spawn(YTDLP, args);

    let logOut = '';
    let audResponded = false;
    proc.on('error', e => {
        if (!audResponded) { audResponded = true; res.status(500).json({ error: 'yt-dlp introuvable', details: e.message }); }
    });
    proc.stderr.on('data', d => logOut += d);

    proc.on('close', code => {
        if (audResponded) return;
        if (code !== 0) {
            audResponded = true;
            return res.status(500).json({ error: 'Échec extraction audio', details: logOut.slice(-800) });
        }
        const tmpDir = path.dirname(tmpFile);
        const prefix = path.basename(tmpFile.replace('%(ext)s', ''));
        const files = fsSync.readdirSync(tmpDir).filter(f => f.startsWith(prefix));
        if (!files.length) return res.status(500).json({ error: 'Fichier audio introuvable' });

        const finalFile = path.join(tmpDir, files[0]);
        const stat = fsSync.statSync(finalFile);

        audResponded = true;
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');

        const stream = fsSync.createReadStream(finalFile);
        stream.pipe(res);
        stream.on('close', () => { try { fsSync.unlinkSync(finalFile); } catch (e) {} });
    });
});
// ── FIN VIDEO DOWNLOADER ──────────────────────────────────────────────────────

// ── YOUTUBE PUBLISHER ─────────────────────────────────────────────────────────
let youtubeUploader = null;
try {
    youtubeUploader = require('./youtube-uploader');
} catch (e) {
    console.warn('[YouTube] Module non chargé :', e.message);
}

// POST /api/youtube-publish
// Body : { url, title?, description?, tags?, quality?, privacy? }
// Télécharge la vidéo source et l'uploade sur YouTube.
app.post('/api/youtube-publish', express.json(), async (req, res) => {
    const { url, title, description, tags, quality, privacy } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL manquante' });
    if (!youtubeUploader) return res.status(500).json({ error: 'Module YouTube non disponible' });

    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_REFRESH_TOKEN) {
        return res.status(503).json({
            error: 'YouTube non configuré',
            hint: 'Créez un fichier .env avec YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN. Exécutez : node get-youtube-token.js'
        });
    }

    try {
        const result = await youtubeUploader.publishToYoutube(url, {
            title, description,
            tags:    tags    || ['Algeria Tech', 'Algérie', 'TIC'],
            quality: quality || 'best',
            privacy: privacy || 'public',
            license: 'creativeCommon',
        });
        res.json({
            success:     true,
            videoId:     result.videoId,
            youtubeUrl:  result.youtubeUrl,
            title:       result.title,
            duration:    result.duration,
            localFile:   result.localFile,
            description: result.description || '',
            uploader:    result.uploader    || '',
            thumbnail:   result.thumbnail   || '',
        });
    } catch (e) {
        console.error('[YouTube Publish]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/create-video-article
// Body : { videoId, titre, description, tags?, categorie?, date?, heure?, source?, uploader?, duration? }
// Crée un article .md avec iframe YouTube intégré, immédiatement visible sur le site local.
app.post('/api/create-video-article', express.json(), async (req, res) => {
    const { videoId, titre, description, tags, categorie, date, heure, source, uploader, duration } = req.body || {};
    if (!videoId || !titre) return res.status(400).json({ error: 'videoId et titre requis' });

    const now       = new Date();
    const artDate   = date  || now.toISOString().split('T')[0];
    const artHeure  = heure || now.toTimeString().slice(0, 5);
    const artCat    = categorie || 'Algérie';
    const artSource = source    || '';
    const titreEsc  = titre.replace(/"/g, '\\"');

    // Extrait : description tronquée ou texte générique
    const descText  = (description || '').trim();
    const extrait   = (descText || `Vidéo publiée sur Algeria Tech${uploader ? ' par ' + uploader : ''}.`)
                        .substring(0, 200).replace(/"/g, '\\"');

    const tagsArr = Array.isArray(tags)
        ? tags
        : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : []);
    // Assure que les tags de base sont présents
    ['Vidéo', 'Algeria Tech'].forEach(t => { if (!tagsArr.includes(t)) tagsArr.push(t); });
    const tagsStr = tagsArr.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ');

    // Durée lisible (ex: "2m 37s")
    const fmtDur = (s) => {
        if (!s) return '';
        const m = Math.floor(s / 60), sec = Math.floor(s % 60);
        return `${m}m ${String(sec).padStart(2, '0')}s`;
    };

    const iframeEmbed = `<div class="video-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;margin:1.5rem 0">
  <iframe
    src="https://www.youtube.com/embed/${videoId}?rel=0"
    style="position:absolute;top:0;left:0;width:100%;height:100%"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen
    loading="lazy"
    title="${titre.replace(/"/g, '&quot;')}">
  </iframe>
</div>`;

    // Corps de l'article : iframe + métadonnées + description + lien source
    const metaLine = [
        uploader ? `**Source :** ${uploader}` : null,
        duration ? `**Durée :** ${fmtDur(duration)}` : null,
        artSource ? `**Lien original :** [Voir sur Facebook](${artSource})` : null,
    ].filter(Boolean).join('  \n');

    const body = [
        iframeEmbed,
        metaLine,
        descText,
    ].filter(Boolean).join('\n\n');

    const frontMatter = `---
titre: "${titreEsc}"
categorie: ${artCat}
date: ${artDate}
heure: ${artHeure}
image: ""
pdf: ""
video: "https://www.youtube.com/watch?v=${videoId}"
source: "${artSource.replace(/"/g, '\\"')}"
extrait: "${extrait}"
tags: [${tagsStr}]
type: video
---

${body}
`;

    try {
        const fileName = `${Date.now()}.md`;
        await fs.writeFile(path.join('articles', fileName), frontMatter);
        await generateArticlesList();
        await regenerateArticlesJson();
        res.json({
            success:   true,
            articleId: fileName.replace('.md', ''),
            videoId,
            youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        });
    } catch (e) {
        console.error('[Create Video Article]', e.message);
        res.status(500).json({ error: e.message });
    }
});
// ── FIN YOUTUBE PUBLISHER ─────────────────────────────────────────────────────

// ── SMART INGEST VIDÉO ────────────────────────────────────────────────────────
// POST /api/smart-ingest-video
// Reçoit { videoId, youtubeUrl, rawText, title, sourceUrl, uploader, duration }
// → Traduit (si arabe) + génère article APS complet via Mistral
// → Sauvegarde dans articles/ avec iframe YouTube intégré
// → Retourne { articleId, titre, youtubeUrl }
app.post('/api/smart-ingest-video', express.json(), async (req, res) => {
    const { videoId, youtubeUrl, rawText, title, sourceUrl, uploader, duration } = req.body || {};
    if (!videoId)    return res.status(400).json({ error: 'videoId requis' });
    if (!youtubeUrl) return res.status(400).json({ error: 'youtubeUrl requis' });

    const now      = new Date();
    const artDate  = now.toISOString().split('T')[0];
    const artHeure = now.toTimeString().slice(0, 5);

    const sourceText = (rawText || title || '').trim();

    // ── Prompt Mistral spécialisé : traduction AR/darija + article APS enrichi ─
    const prompt = `Tu es un rédacteur senior de l'Algérie Presse Service (APS), spécialiste TIC, avec 20 ans d'expérience.

CONTEXTE DE CETTE MISSION :
- Source : publication Facebook de la page "${uploader || 'Algeria Tech'}"
- Vidéo YouTube associée : ${youtubeUrl}
- Le texte source peut être en arabe, darija ou français

══════════════════════════════════════════════
VOCABULAIRE ADMINISTRATIF ALGÉRIEN — OBLIGATOIRE
══════════════════════════════════════════════
L'Algérie a sa propre terminologie. Tu dois TOUJOURS utiliser ces termes :

✅ CORRECT → ❌ INTERDIT
wilaya de Saïda → ❌ "État de Saïda" / "département de Saïda" / "préfecture de Saïda"
wilayas (pluriel) → ❌ "provinces" / "régions" / "États"
daïra → ❌ "arrondissement" / "district" / "canton"
commune → ❌ "municipalité" (sens administratif)
wali → ❌ "préfet" / "gouverneur"
chef-lieu de wilaya → ❌ "préfecture" pour désigner la ville principale
APW (Assemblée Populaire de Wilaya) → ❌ "conseil général"
APC (Assemblée Populaire Communale) → ❌ "conseil municipal"
L'Algérie compte 58 wilayas → ❌ jamais "provinces" ni "États"
ANPT, ARPCE, Algérie Télécom, Mobilis, Djezzy, Ooredoo → noms officiels exacts

══════════════════════════════════════════════
MISSION EN 2 ÉTAPES
══════════════════════════════════════════════
ÉTAPE 1 — TRADUCTION (si nécessaire)
Si le texte source est en arabe ou darija, traduis-le intégralement et fidèlement en français avant de rédiger. Conserve tous les noms propres, chiffres et faits exacts.

ÉTAPE 2 — RÉDACTION (minimum 600 mots de contenu)
Rédige un article de presse complet en français, style APS, avec la structure suivante dans le champ "contenu" :

## [Titre de section — fait principal développé]
[2-3 paragraphes · 2-3 phrases chacun · données chiffrées si disponibles]

## Analyse et enjeux pour l'Algérie
[2 paragraphes · impacts économiques, technologiques ou sociaux concrets]

## Contexte du secteur TIC algérien
[1-2 paragraphes · enrichis OBLIGATOIREMENT avec des données réelles : taux de pénétration mobile (120 %+ en 2025), nombre d'abonnés Internet (30 M+), plan numérique 2030, rôle de l'ARPCE, investissements Algérie Télécom]

## Réactions et déclarations
[Citer les personnalités mentionnées dans la source avec leur titre officiel complet · Si aucune citation disponible, omettre cette section]

## Perspectives et prochaines étapes
[1-2 paragraphes · calendrier, objectifs nationaux, phase suivante]

## À retenir
[6 à 8 points clés en liste à puces · chaque point = 1 fait précis et chiffré si possible]

══════════════════════════════════════════════
RÈGLES DE STYLE APS — ABSOLUES
══════════════════════════════════════════════
- Lead : "ALGER, ${artDate.split('-').reverse().join('/')} (Algeria Tech) — " + fait principal (2 phrases max)
- Pyramide inversée : fait principal → contexte → détails → perspectives
- Phrases courtes (≤ 20 mots), présent ou passé composé, voix active
- Titres officiels COMPLETS : "le ministre de la Poste et des Télécommunications", "le PDG de Mobilis SA"
- Chiffres : lettres pour unités (deux millions, cinquante milliards DA) · chiffres pour % et dates
- JAMAIS : "il convient de noter" / "force est de constater" / "dans un contexte de" / "en conclusion" / "remarquable" / "révolutionnaire" / "impressionnant" / "indéniablement"
- Si la source est courte ou vague → enrichis ACTIVEMENT avec tes connaissances du secteur TIC algérien (ne laisse JAMAIS le contenu sous 600 mots)
- Conserver EXACTEMENT noms propres, chiffres et citations de la source

RÉPONDS UNIQUEMENT EN JSON PUR (zéro texte en dehors du JSON) :
{
  "titre": "Titre nominal factuel sans verbe (max 12 mots)",
  "lead": "ALGER, ${artDate.split('-').reverse().join('/')} (Algeria Tech) — ...",
  "contenu": "...markdown complet avec toutes les sections ## ci-dessus...",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "categorie": "Algérie|Télécoms|Mobile|Startups|Innovation|Entreprises"
}

TEXTE SOURCE FACEBOOK (traduis si arabe/darija, puis rédige l'article) :
${sourceText.substring(0, 3500) || '(Pas de description — génère un article complet à partir du titre : ' + (title || 'Vidéo Algeria Tech') + ')'}`;

    const payload = JSON.stringify({
        model:           'mistral-small-latest',
        messages:        [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature:     0.6,
        max_tokens:      3500,
    });

    const mistralOptions = {
        hostname: 'api.mistral.ai',
        path:     '/v1/chat/completions',
        method:   'POST',
        headers: {
            'Content-Type':   'application/json',
            'Authorization':  `Bearer ${MISTRAL_API_KEY}`,
            'Content-Length': Buffer.byteLength(payload),
        },
    };

    const callMistral = () => new Promise((resolve, reject) => {
        const req = https.request(mistralOptions, apiRes => {
            let data = '';
            apiRes.on('data', chunk => data += chunk);
            apiRes.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.error) return reject(new Error(result.error.message));
                    resolve(JSON.parse(result.choices[0].message.content));
                } catch (e) {
                    reject(new Error('Réponse Mistral invalide : ' + e.message));
                }
            });
        });
        req.on('error', e => reject(new Error('Réseau Mistral : ' + e.message)));
        req.write(payload);
        req.end();
    });

    let article;
    try {
        article = await callMistral();
    } catch (e) {
        console.error('[smart-ingest-video] Erreur Mistral :', e.message);
        return res.status(500).json({ error: 'Génération IA échouée : ' + e.message });
    }

    // ── Construction de l'article Markdown final ─────────────────────────────
    const titre    = (article.titre   || title || 'Vidéo Algeria Tech').substring(0, 150);
    const lead     = article.lead     || '';
    const contenu  = article.contenu  || '';
    const tags     = Array.isArray(article.tags) ? article.tags : ['Vidéo', 'Algeria Tech'];
    const categorie = article.categorie || 'Algérie';

    // Tags enrichis
    if (!tags.includes('Vidéo'))       tags.push('Vidéo');
    if (!tags.includes('Algeria Tech')) tags.push('Algeria Tech');
    const tagsStr  = tags.slice(0, 8).map(t => `"${String(t).replace(/"/g, '\\"')}"`).join(', ');

    const titreEsc = titre.replace(/"/g, '\\"');
    const extrait  = lead.replace(/"/g, '\\"').substring(0, 250);

    // Durée lisible
    const fmtDur = s => { if (!s) return ''; const m = Math.floor(s/60), sec = Math.floor(s%60); return `${m}m ${String(sec).padStart(2,'0')}s`; };

    // Note : la vidéo est rendue par le champ frontmatter `video:` (en Une + haut d'article).
    // On n'injecte PAS d'iframe dans le corps pour éviter le doublon.

    // Ligne de métadonnées discrète
    const metaLine = [
        uploader   ? `**Page :** ${uploader}` : null,
        duration   ? `**Durée :** ${fmtDur(duration)}` : null,
        sourceUrl  ? `**Source :** [Publication originale Facebook](${sourceUrl})` : null,
    ].filter(Boolean).join('  \n');

    // Corps complet : lead + contenu IA + méta (pas d'iframe : voir frontmatter `video:`)
    const bodyMd = `${lead}\n\n${contenu}\n\n---\n${metaLine}`;

    const frontMatter = `---
titre: "${titreEsc}"
categorie: ${categorie}
date: ${artDate}
heure: ${artHeure}
image: ""
pdf: ""
video: "https://www.youtube.com/watch?v=${videoId}"
source: "${(sourceUrl || '').replace(/"/g, '\\"')}"
extrait: "${extrait}"
tags: [${tagsStr}]
type: video
---

${bodyMd}
`;

    try {
        const fileName = `${Date.now()}.md`;
        await fs.writeFile(path.join('articles', fileName), frontMatter);
        await generateArticlesList();
        await regenerateArticlesJson();

        const articleId = fileName.replace('.md', '');
        console.log(`[smart-ingest-video] ✅ Article créé : ${fileName} | "${titre}"`);

        res.json({
            success:    true,
            articleId,
            titre,
            youtubeUrl,
            articleUrl: `/article/${articleId}`,
            tags,
            categorie,
        });
    } catch (e) {
        console.error('[smart-ingest-video] Erreur sauvegarde :', e.message);
        res.status(500).json({ error: 'Sauvegarde article échouée : ' + e.message });
    }
});
// ── FIN SMART INGEST VIDÉO ────────────────────────────────────────────────────

// ── TEST ROUTE — génère slide avec données fictives ─────────────────────────
app.get('/api/test-slide/:template', async (req, res) => {
    const tpl = req.params.template || 'annual';
    const testData = {
        title: "Rapport Télécoms Algérie 2024",
        subtitle: "Bilan annuel des indicateurs ICT nationaux — ARPT",
        date: "Décembre 2024", source: "ARPT / MPTIC", docType: "telecom",
        stats: [
            { label: "Abonnés mobile",    numericValue: "49800000",   unit: "abonnés", icon: "📱", numericStatus: "positive" },
            { label: "Taux pénétration",  numericValue: "112.5",      unit: "%",       icon: "📶", numericStatus: "positive" },
            { label: "Abonnés 4G",        numericValue: "22300000",   unit: "abonnés", icon: "🔥", numericStatus: "positive" },
            { label: "Revenu opérateurs", numericValue: "4200000000", unit: "DA",      icon: "💰", numericStatus: "positive" },
            { label: "Couverture réseau", numericValue: "98.2",       unit: "%",       icon: "🗺️",  numericStatus: "positive" },
            { label: "Abonnés ADSL/Fibre",numericValue: "6750000",    unit: "abonnés", icon: "🌐", numericStatus: "positive" }
        ],
        keyPoints: [
            "Le marché mobile algérien a atteint un taux de pénétration record de 112,5% avec près de 50 millions d'abonnés actifs en 2024.",
            "Mobilis maintient sa position de leader avec 43% de parts de marché, suivi de Djezzy à 32% et Ooredoo à 25%.",
            "La 4G a connu une croissance spectaculaire de 28% en un an, portant le nombre d'abonnés à 22,3 millions.",
            "Le déploiement de la fibre optique s'accélère avec 340 000 nouveaux raccordements au cours du dernier trimestre.",
            "Les revenus des opérateurs ont progressé de 12% malgré un contexte concurrentiel intense sur les prix."
        ],
        sections: [
            { title: "Marché Mobile",  body: "Le marché mobile continue sa croissance portée par la 4G et les smartphones accessibles." },
            { title: "Internet Fixe",  body: "L'ADSL reste dominant mais la fibre optique gagne du terrain dans les grandes villes." }
        ],
        chartData: { labels: ["Mobilis", "Djezzy", "Ooredoo"], values: [21600000, 15900000, 12300000] }
    };
    try {
        const { buildInfographie } = require('./generator/infographie-builder');
        const result = await buildInfographie(testData, { type: 'telecom', animType: '', bgTheme: 'none', bgImage: 'none', slideTemplate: tpl });
        res.json({ url: result.url, slug: result.slug });
    } catch(e) {
        console.error('[test-slide]', e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Algeria Tech · Port ${PORT} · Générateur activé`));