const fs = require('fs');
const https = require('https');
const path = require('path');

// Configuration du chemin du fichier de données
const VEILLE_FILE = path.join(__dirname, 'veille_data.json');

/**
 * Charge les données depuis le fichier JSON
 */
function loadVeilleData() {
    try {
        if (fs.existsSync(VEILLE_FILE)) {
            const content = fs.readFileSync(VEILLE_FILE, 'utf-8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error("[VEILLE] Erreur lors de la lecture du fichier :", e.message);
    }
    return { manual: [], feed: [], lastUpdated: new Date().toISOString() };
}

/**
 * Sauvegarde les données dans le fichier JSON
 */
function saveVeilleData(data) {
    try {
        fs.writeFileSync(VEILLE_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("[VEILLE] Erreur lors de la sauvegarde du fichier :", e.message);
    }
}

/**
 * Effectue une requête HTTPS GET et retourne le contenu brut
 */
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlgeriaTech-Bot/1.0'
            },
            timeout: 15000 // Timeout de 15 secondes pour éviter de bloquer l'Action
        };
        https.get(url, options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

/**
 * Fonction principale de mise à jour des flux RSS
 */
async function updateVeilleFeeds() {
    console.log('[VEILLE] --- DÉBUT DE LA MISE À JOUR ---');
    const data = loadVeilleData();
    
    // Sources algériennes spécialisées TIC (16) + sources internationales (5)
    const feeds = [
        // ── Algérie ──────────────────────────────────────────────────────────
        'https://www.tsa-algerie.dz/feed/',
        'https://lesenjeuxeco.dz/category/tic/feed/',
        'https://www.algerie360.com/category/high-tech/feed/',
        'https://www.aps.dz/fr/algerie/education-et-technologie?format=feed&type=rss',
        'https://itmag.dz/feed/',
        'https://dz-tech.news/fr/feed/',
        'https://www.android-dz.com/feed/',
        'https://www.ntic-dz.com/feed/',
        'https://www.indjazat.com/category/tic/feed/',
        'https://algerie-eco.com/feed/',
        'https://www.ecomnewsmed.com/location/algerie/feed/',
        'https://www.elwatan.com/feed/',
        'https://www.elmoudjahid.dz/?format=feed&type=rss',
        'https://www.lesoirdalgerie.com/mobiles/feed/',
        'https://www.lesoirdalgerie.com/numerique-et-satellite/feed/',
        'https://www.algerietelecom.dz/fr/espace-presse?format=feed&type=rss',
        // ── International TIC ─────────────────────────────────────────────────
        'https://www.silicon.fr/feed',
        'https://www.zdnet.fr/feed/',
        'https://techcrunch.com/feed/',
        'https://www.lemonde.fr/pixels/rss_full.xml',
        'https://www.wired.com/feed/rss'
    ];

    let newItems = [];
    
    for (const url of feeds) {
        try {
            console.log(`[VEILLE] Récupération de : ${url}`);
            // Utilisation du service rss2json pour convertir les flux XML en JSON
            const jsonStr = await httpsGet(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
            const json = JSON.parse(jsonStr);
            
            if (json.status === 'ok' && json.items) {
                json.items.forEach(item => {
                    if (!item.title || !item.link) return;

                    // Fusion du titre et de la description pour l'analyse des mots-clés
                    const text = (item.title + ' ' + (item.description || '')).toLowerCase();
                    
                    // Mots-clés identiques à votre server.js (plus ajouts pertinents)
                    const techKw = [
                        'tic', 'télécom', 'mobile', 'startup', 'innovation', 
                        'tech', 'numérique', 'internet', 'data', 'ia', 'fibre', 
                        'algerie', '5g', 'réseau', 'opérateur', 'digital', 
                        'presse', 'communiqué', 'cybersécurité', 'logiciel', 'cloud'
                    ];
                    
                    // Filtrage intelligent
                    if (techKw.some(k => text.includes(k))) {
                        newItems.push({
                            id: Buffer.from(item.link).toString('base64').substring(0, 16),
                            title: item.title,
                            url: item.link,
                            tags: text.includes('algerie') ? ['Algérie', 'Tech'] : ['Tech', 'Actualité'],
                            date: item.pubDate || new Date().toISOString(),
                            source: json.feed.title || new URL(url).hostname.replace('www.', ''),
                            isManual: false
                        });
                    }
                });
            }
        } catch (e) {
            console.log(`[VEILLE] ⚠️ Échec pour la source ${url}:`, e.message);
        }
    }

    // Gestion de la déduplication (on vérifie les URL déjà présentes en manuel ou en flux)
    const existingUrls = new Set([
        ...data.feed.map(i => i.url),
        ...data.manual.map(i => i.url)
    ]);

    // On ne garde que les articles vraiment nouveaux
    const uniqueNew = newItems.filter(i => !existingUrls.has(i.url));

    // Mise à jour de la liste : Nouveaux + Anciens, triés par date décroissante, max 150
    data.feed = [...uniqueNew, ...data.feed]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 150);

    // Mise à jour de l'horodatage
    data.lastUpdated = new Date().toISOString();

    // Sauvegarde physique
    saveVeilleData(data);
    
    console.log(`[VEILLE] --- MISE À JOUR TERMINÉE ---`);
    console.log(`[VEILLE] Nouveautés ajoutées : ${uniqueNew.length}`);
    console.log(`[VEILLE] Total d'articles en stock : ${data.feed.length}`);
}

// Exécution immédiate au lancement du script
updateVeilleFeeds();