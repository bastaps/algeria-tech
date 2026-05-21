const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { Octokit } = require("@octokit/rest");
const cors = require('cors');
const https = require('https');

// ── Générateur d'infographies ─────────────────────────────────────────────────
const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');
const AdmZip   = require('adm-zip');
const { generateReport } = require('./generator/html-template');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ['https://algeria-tech.pages.dev', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

const isCloud = !!process.env.GITHUB_TOKEN;
const octokit = process.env.GITHUB_TOKEN ? new Octokit({ auth: process.env.GITHUB_TOKEN }) : null;
const OWNER = "bastaps";
const REPO = "algeria-tech";

const storage = isCloud ? multer.memoryStorage() : multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = file.mimetype === 'application/pdf' ? 'documents/' : 'images/';
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

// === SERVIR LES FICHIERS STATIQUES ===
app.use(express.static('.', {
    setHeaders: (res, filepath) => {
        if (filepath.toLowerCase().endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
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

app.post('/api/create-article', upload, async (req, res) => {
    try {
        const { id, titre, categorie, date, heure, extrait, tags, contenu, video } = req.body;
        let fileName = (id && id !== "null") ? `${id}.md` : `${Date.now()}.md`;
        let tagsFormatted = "";
        if (tags) tagsFormatted = tags.split(',').map(t => t.trim().replace(/"/g, '')).filter(t => t).map(t => `"${t}"`).join(', ');
        
        let imagePath = req.body.existingImage || "";
        if (req.files && req.files.image) imagePath = isCloud ? `images/${Date.now()}-${req.files.image[0].originalname}` : `images/${req.files.image[0].filename}`;
        
        let pdfPath = req.body.existingPdf || "";
        if (req.files && req.files.pdf) pdfPath = isCloud ? `documents/${Date.now()}-${req.files.pdf[0].originalname}` : `documents/${req.files.pdf[0].filename}`;

        const frontMatter = `---\ntitre: "${titre.replace(/"/g, '\\"')}"\ncategorie: ${categorie}\ndate: ${date}\nheure: ${heure}\nimage: ${imagePath}\npdf: "${pdfPath}"\nvideo: "${video || ''}"\nextrait: "${extrait.replace(/"/g, '\\"')}"\ntags: [${tagsFormatted}]\n---\n\n${contenu}\n`;
        
        if (isCloud) {
            if (req.files && req.files.image) await pushToGithub(imagePath, req.files.image[0].buffer, "Upload image", true);
            if (req.files && req.files.pdf) await pushToGithub(pdfPath, req.files.pdf[0].buffer, "Upload PDF", true);
            await pushToGithub(`articles/${fileName}`, frontMatter, `MAJ Article: ${titre}`);
            res.json({ success: true, message: "Enregistré sur GitHub" });
        } else {
            await fs.writeFile(path.join('articles', fileName), frontMatter);
            await generateArticlesList();
            res.json({ success: true, message: "Enregistré localement" });
        }
    } catch (e) { console.error("Erreur API:", e); res.status(500).json({ message: e.message }); }
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

async function updateVeilleFeeds() {
    const data = loadVeilleData();
    const feeds = [
    'https://www.tsa-algerie.dz/feed/',
    'https://lesenjeuxeco.dz/category/tic/feed/',
    'https://www.algerie360.com/category/high-tech/feed/',
    'https://www.aps.dz/fr/algerie/education-et-technologie?format=feed&type=rss',
    'https://itmag.dz/feed/',
    'https://www.silicon.fr/feed',
    'https://www.zdnet.fr/feed/',
    'https://techcrunch.com/feed/',
    'https://www.lemonde.fr/pixels/rss_full.xml',
    'https://www.wired.com/feed/rss'
];
    let newItems = [];
    
    for (const url of feeds) {
        try {
            const jsonStr = await httpsGet(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
            const json = JSON.parse(jsonStr);
            if (json.status === 'ok' && json.items) {
                json.items.forEach(item => {
                    if (!item.title || !item.link) return;
                    const text = (item.title + ' ' + (item.description || '')).toLowerCase();
                    const techKw = ['tic', 'télécom', 'mobile', 'startup', 'innovation', 'tech', 'numérique', 'internet', 'data', 'ia', 'fibre', 'algerie', '5g', 'réseau', 'opérateur', 'digital', 'presse', 'communiqué'];
                    if (techKw.some(k => text.includes(k))) {
                        newItems.push({
                            id: Buffer.from(item.link).toString('base64').substring(0, 16),
                            title: item.title, url: item.link, tags: ['Presse', 'Automatique'],
                            date: item.pubDate || new Date().toISOString(), source: new URL(url).hostname.replace('www.', ''), isManual: false
                        });
                    }
                });
            }
        } catch (e) { console.log(`[VEILLE] RSS échoué pour ${url}:`, e.message); }
    }

    const existingUrls = new Set([...data.feed.map(i => i.url), ...data.manual.map(i => i.url)]);
    const uniqueNew = newItems.filter(i => !existingUrls.has(i.url));
    data.feed = [...data.feed, ...uniqueNew].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 150);
    data.lastUpdated = new Date().toISOString();
    saveVeilleData(data);
    console.log('[VEILLE] Flux actualisés. Nouveautés:', uniqueNew.length);
}

updateVeilleFeeds();
setInterval(updateVeilleFeeds, 4 * 60 * 60 * 1000);

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

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));

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
            const type = req.body.type || 'auto';
            const animType = req.body.animationType || '';
            const data = analyseDoc(text, type, req.file.originalname);

            // Construction de l'infographie premium multi-fichiers
            const result = await buildInfographie(data, { type, animType });

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
    if (ext === '.docx' || ext === '.doc') {
        const r = await mammoth.extractRawText({ buffer: buf }); return r.value || '';
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
        return fixed.includes('�') ? s : fixed;
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

app.listen(PORT, () => console.log(`🚀 Algeria Tech · Port ${PORT} · Générateur activé`));