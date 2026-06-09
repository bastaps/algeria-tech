'use strict';
/* ═══════════════════════════════════════════════════════════════
   JORADP.JS — Algeria Tech
   Veille Réglementaire automatique — Journal Officiel Algérien
   ─────────────────────────────────────────────────────────────
   1. Scrape https://www.joradp.dz/HFR/Accueil.htm pour lister
      les numéros récents (MaxWin('NNN') → numéro du JO).
   2. Télécharge le PDF de chaque nouveau numéro.
   3. Analyse les 6 premières pages (sommaire) via pdf-parse.
   4. Pré-filtre par mots-clés TIC (économise les appels IA).
   5. Envoie le sommaire à Mistral pour extraction structurée.
   6. Sauvegarde dans joradp_veille.json.
═══════════════════════════════════════════════════════════════ */

const https    = require('https');
const http     = require('http');
const path     = require('path');
const fs       = require('fs');
const pdfParse = require('pdf-parse');

/* ── Constantes ─────────────────────────────────────────────── */
const JORADP_ACCUEIL  = 'https://www.joradp.dz/HFR/Accueil.htm';
const JORADP_PDF_BASE = 'https://www.joradp.dz/FTP/jo-francais';
const VEILLE_FILE     = path.join(__dirname, 'joradp_veille.json');

const MAX_SOMMAIRE_PAGES = 6;     // Pages analysées (sommaire = pages 1-4 en général)
const MAX_PDF_MB         = 30;    // Ignore les PDFs > 30 MB
const FETCH_TIMEOUT_MS   = 35000; // 35s timeout HTTP
const MAX_ISSUES_FIRST   = 8;     // Nb max à analyser au premier démarrage
const MAX_ISSUES_DELTA   = 5;     // Nb max par vérification quotidienne
const MAX_STORED_TEXTES  = 300;   // Nb max de textes conservés en mémoire

/* ── Correspondance mois français → numéro ────────────────────
   Gère variantes avec/sans accents (page JORADP en latin1 parfois) */
const MONTHS_FR = {
  'janvier':   '01', 'février':  '02', 'fevrier':  '02',
  'mars':      '03', 'avril':    '04', 'mai':       '05',
  'juin':      '06', 'juillet':  '07', 'août':      '08',
  'aout':      '08', 'septembre':'09', 'octobre':   '10',
  'novembre':  '11', 'décembre': '12', 'decembre':  '12',
};

/* ── Mots-clés TIC pour pré-filtre rapide (avant appel Mistral) */
const TIC_KW = [
  /* Opérateurs & régulateurs */
  'algérie télécom','algerie telecom','mobilis','ooredoo','djezzy',
  'arpce','arpt','atrp','algérie poste','algerie poste',
  'barid el-djazaïr','barid el djazair',
  /* Secteurs */
  'télécommunication','telecom','téléphonie','telephonie',
  'numérique','numerique','digital','tic','informatique',
  'transition numérique','transition numerique',
  'cybersécurité','cyber-sécurité','cybersecurite',
  'données personnelles','donnees personnelles',
  /* Technologies réseau */
  'fibre optique','4g','5g','réseau mobile','réseau fixe','haut débit',
  'spectre','fréquence','hertzien','internet',
  /* Services numériques */
  'e-administration','e-commerce','e-gouvernement','e-paiement',
  'e-santé','e-learning','dématérialisation','numérisation',
  'paiement électronique','paiement mobile','edahabia','cib',
  'signature électronique','carte de crédit',
  /* Innovation */
  'startup','incubateur','pépinière','innovation','technologie',
  /* Textes de référence */
  'loi organique','décret exécutif relatif aux','arrêté relatif',
  'protection des données','système d\'information',
  'logiciel','application numérique','plateforme',
];

/* ═══════════════════════════════════════════════════════════════
   PERSISTANCE
═══════════════════════════════════════════════════════════════ */
function loadData() {
  try { return JSON.parse(fs.readFileSync(VEILLE_FILE, 'utf-8')); }
  catch {
    return {
      lastChecked:  null,
      analyzed:     [],   // IDs déjà traités ex: ["2026-040","2026-039"]
      textes:       []    // Textes TIC trouvés
    };
  }
}

function saveData(d) {
  fs.writeFileSync(VEILLE_FILE, JSON.stringify(d, null, 2));
}

/* ═══════════════════════════════════════════════════════════════
   FETCH HTTP/HTTPS (avec redirects + timeout + limite taille)
═══════════════════════════════════════════════════════════════ */
function fetchBuffer(url, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const client  = url.startsWith('https') ? https : http;
    const maxSize = MAX_PDF_MB * 1024 * 1024;

    const req = client.get(url, {
      headers: {
        'User-Agent': 'AlgeriaTech-VeilleReglementaire/1.0 (+https://algeria-tech.pages.dev)',
        'Accept':     'text/html,application/pdf,*/*',
      },
    }, res => {

      /* Redirections */
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        if (!redirectsLeft) return reject(new Error('Trop de redirections'));
        const loc = res.headers.location;
        if (!loc) return reject(new Error('Redirection sans Location header'));
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        res.destroy();
        return fetchBuffer(next, redirectsLeft - 1).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        res.destroy();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      /* Taille annoncée */
      const cl = parseInt(res.headers['content-length'] || '0', 10);
      if (cl > maxSize) {
        res.destroy();
        return reject(new Error(`Fichier trop grand : ${(cl / 1024 / 1024).toFixed(1)} MB`));
      }

      const chunks = [];
      let total    = 0;

      res.on('data', chunk => {
        total += chunk.length;
        if (total > maxSize) {
          res.destroy();
          reject(new Error('Fichier trop grand (streaming)'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end',   () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.setTimeout(FETCH_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`Timeout (${FETCH_TIMEOUT_MS / 1000}s) : ${url}`));
    });
    req.on('error', reject);
  });
}

/* ═══════════════════════════════════════════════════════════════
   PARSER HTML — Accueil.htm du JORADP
   Trouve les MaxWin('NNN') et les dates associées
═══════════════════════════════════════════════════════════════ */
function parseAccueil(html) {
  const issues   = [];
  const seen     = new Set();
  const normHtml = html.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

  /* Regex pour trouver les appels MaxWin('NNN') */
  const mwRe = /MaxWin\('(\d{2,3})'\)/g;

  /* Regex pour trouver les dates françaises dans un contexte */
  const datePat =
    /(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(20\d{2})/g;

  /* Récolte toutes les dates avec position */
  const allDates = [];
  let dm;
  while ((dm = datePat.exec(normHtml)) !== null) {
    const mLow = dm[2].toLowerCase();
    const mNum = MONTHS_FR[mLow];
    if (mNum) {
      allDates.push({
        day:   dm[1].padStart(2, '0'),
        month: mNum,
        year:  dm[3],
        fr:    `${dm[1]} ${dm[2].charAt(0).toUpperCase() + dm[2].slice(1).toLowerCase()} ${dm[3]}`,
        idx:   dm.index,
      });
    }
  }

  /* Pour chaque MaxWin, trouve la date la plus proche */
  let mw;
  while ((mw = mwRe.exec(normHtml)) !== null) {
    const numStr = mw[1].padStart(3, '0'); // ex: '040'
    const numero = parseInt(mw[1], 10);

    /* Date la plus proche dans le HTML */
    let bestDate = allDates[0];
    if (allDates.length > 1) {
      bestDate = allDates.reduce((prev, curr) =>
        Math.abs(curr.idx - mw.index) < Math.abs(prev.idx - mw.index) ? curr : prev
      );
    }
    if (!bestDate) continue;

    const year = parseInt(bestDate.year, 10);
    const id   = `${year}-${numStr}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const url = `${JORADP_PDF_BASE}/${year}/F${year}${numStr}.pdf`;

    issues.push({
      id,
      numero,
      year,
      numStr,
      date:    `${bestDate.year}-${bestDate.month}-${bestDate.day}`,
      date_fr: bestDate.fr,
      url,
    });
  }

  /* Trier du plus récent au plus ancien */
  return issues.sort((a, b) => b.year !== a.year ? b.year - a.year : b.numero - a.numero);
}

/* ═══════════════════════════════════════════════════════════════
   EXTRACTION SOMMAIRE (premiers N pages du PDF)
═══════════════════════════════════════════════════════════════ */
async function extractSommaire(pdfUrl) {
  const buf  = await fetchBuffer(pdfUrl);
  const data = await pdfParse(buf, { max: MAX_SOMMAIRE_PAGES });
  return data.text || '';
}

/* ═══════════════════════════════════════════════════════════════
   PRÉ-FILTRE MOTS-CLÉS TIC
═══════════════════════════════════════════════════════════════ */
function hasTicContent(text) {
  const lo = text.toLowerCase();
  return TIC_KW.some(kw => lo.includes(kw));
}

/* ═══════════════════════════════════════════════════════════════
   ANALYSE MISTRAL — extraction structurée du sommaire
═══════════════════════════════════════════════════════════════ */
function analyzeSommaire(sommaire, iss, apiKey) {
  const prompt =
`Tu es un expert juridique spécialisé dans la réglementation TIC en Algérie.

Analyse ce SOMMAIRE du Journal Officiel Algérien (JORADP) n°${iss.numero} du ${iss.date_fr}.
Identifie UNIQUEMENT les textes législatifs ou réglementaires ayant un lien direct avec :

• Télécommunications : Algérie Télécom, Mobilis, Ooredoo, Djezzy, opérateurs mobiles/fixes
• Régulation sectorielle : ARPCE, ARPT, autorités de régulation des communications électroniques et postales
• Numérique : transition numérique, e-administration, e-gouvernement, e-commerce, e-paiement, e-santé, dématérialisation
• Technologies réseau : 4G, 5G, fibre optique, spectre hertzien, fréquences, réseaux haut débit
• Cybersécurité : sécurité informatique, données personnelles, CERT-DZ, loi 18-07
• Innovation & startups : Loi Startup, incubateurs, pépinières d'entreprises, innovation technologique
• Poste & paiement électronique : Algérie Poste, Barid El-Djazaïr, ATRP, paiement mobile, Edahabia, CIB
• Systèmes d'information : logiciels, plateformes numériques, SI de l'État, cloud souverain

MOTS-CLÉS PRIORITAIRES :
algérie télécom, mobilis, ooredoo, djezzy, arpce, arpt, numérique, digital,
transition numérique, startup, incubateur, fibre optique, 4G, 5G, téléphonie,
mobile, internet, e-administration, e-commerce, cybersécurité, données personnelles,
spectre, fréquences, réseau, haut débit, dématérialisation, numérisation,
paiement électronique, paiement mobile, edahabia, CIB, Algérie Poste,
innovation, technologie, système d'information, logiciel, plateforme.

Pour CHAQUE texte pertinent trouvé, retourne :
{
  "type": "Loi | Décret exécutif | Décret présidentiel | Arrêté | Décision | Circulaire | Instruction | Avis",
  "numero": "XX-XXX ou chaîne vide si absent",
  "date_texte": "date du texte telle qu'elle apparaît dans le sommaire",
  "titre": "titre COMPLET du texte tel qu'il figure dans le sommaire",
  "page_jo": numéro_de_page_entier_ou_null,
  "pertinence": "1 phrase factuelle expliquant pourquoi ce texte concerne le secteur TIC algérien"
}

Réponds UNIQUEMENT en JSON pur : { "textes": [ ... ] }
Si aucun texte n'est pertinent pour le TIC : { "textes": [] }

SOMMAIRE DU JO N°${iss.numero} DU ${iss.date_fr} :
${sommaire.substring(0, 5500)}`;

  const payload = JSON.stringify({
    model:           'mistral-small-latest',
    messages:        [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature:     0.05,
    max_tokens:      1200,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.mistral.ai',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(raw);
          if (r.error) throw new Error(r.error.message);
          const parsed = JSON.parse(r.choices[0].message.content);
          resolve(Array.isArray(parsed.textes) ? parsed.textes : []);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Mistral timeout')); });
    req.write(payload);
    req.end();
  });
}

/* ═══════════════════════════════════════════════════════════════
   FONCTION PRINCIPALE — vérification des nouveaux numéros
═══════════════════════════════════════════════════════════════ */
async function checkJoradp(apiKey) {
  console.log('[JORADP] 🔎 Vérification du Journal Officiel Algérien...');

  const data = loadData();
  const isFirstRun = data.analyzed.length === 0;

  /* 1. Récupérer la page d'accueil */
  let html;
  try {
    const buf = await fetchBuffer(JORADP_ACCUEIL);
    /* Essayer UTF-8 d'abord, latin1 ensuite (site encodé en latin1) */
    html = buf.toString('utf-8');
    if (!html.includes('MaxWin')) html = buf.toString('latin1');
  } catch (e) {
    console.error('[JORADP] ❌ Impossible de charger Accueil.htm :', e.message);
    return 0;
  }

  /* 2. Parser les numéros disponibles */
  const issues = parseAccueil(html);
  if (issues.length === 0) {
    console.warn('[JORADP] ⚠️  Aucun numéro trouvé dans Accueil.htm.');
    return 0;
  }
  console.log(`[JORADP] ${issues.length} numéro(s) détecté(s) (dernier : JO n°${issues[0].numero}).`);

  /* 3. Filtrer : ne traiter que les nouveaux numéros */
  const limit     = isFirstRun ? MAX_ISSUES_FIRST : MAX_ISSUES_DELTA;
  const toProcess = issues
    .filter(iss => !data.analyzed.includes(iss.id))
    .slice(0, limit);

  if (toProcess.length === 0) {
    console.log('[JORADP] ✅ Tous les numéros récents déjà analysés.');
    data.lastChecked = new Date().toISOString();
    saveData(data);
    return 0;
  }
  console.log(`[JORADP] ${toProcess.length} nouveau(x) numéro(s) à analyser.`);

  let newCount = 0;

  for (const iss of toProcess) {
    console.log(`[JORADP] → JO n°${iss.numero} du ${iss.date_fr}...`);

    /* Marquer comme analysé avant tout (évite retry en cas d'erreur) */
    data.analyzed.push(iss.id);

    try {
      /* 4. Télécharger + extraire le sommaire */
      const sommaire = await extractSommaire(iss.url);

      if (!sommaire || sommaire.length < 50) {
        console.warn(`[JORADP]   Sommaire vide ou illisible — ignoré.`);
        continue;
      }

      /* 5. Pré-filtre mots-clés TIC */
      if (!hasTicContent(sommaire)) {
        console.log(`[JORADP]   Pas de contenu TIC détecté — JO ignoré.`);
        continue;
      }
      console.log(`[JORADP]   ✓ Contenu TIC trouvé — analyse Mistral en cours...`);

      /* 6. Analyse Mistral */
      const textes = await analyzeSommaire(sommaire, iss, apiKey);

      if (textes.length === 0) {
        console.log(`[JORADP]   Aucun texte TIC extrait par l'IA.`);
        continue;
      }

      /* 7. Enrichir + dédupliquer */
      const existing = new Set(data.textes.map(t => (t.titre || '').substring(0, 70)));
      const enriched = textes
        .filter(t => t.titre && !existing.has(t.titre.substring(0, 70)))
        .map(t => ({
          id:          `jo${iss.year}-${iss.numStr}-${(t.numero || 'x').replace(/\W+/g, '')}`,
          jo_numero:   iss.numero,
          jo_numStr:   iss.numStr,
          jo_date:     iss.date,
          jo_date_fr:  iss.date_fr,
          jo_url:      iss.url,
          type:        t.type         || 'Texte réglementaire',
          numero:      t.numero       || '',
          date_texte:  t.date_texte   || '',
          titre:       t.titre        || '',
          page_jo:     t.page_jo      || null,
          pertinence:  t.pertinence   || '',
          detected_at: new Date().toISOString(),
        }));

      data.textes = [...enriched, ...data.textes].slice(0, MAX_STORED_TEXTES);
      newCount   += enriched.length;
      console.log(`[JORADP]   ✅ ${enriched.length} texte(s) TIC enregistré(s).`);

    } catch (e) {
      console.error(`[JORADP] ❌ Erreur JO n°${iss.numero} :`, e.message);
    }
  }

  /* Garder l'historique d'analyse raisonnable */
  if (data.analyzed.length > 500) data.analyzed = data.analyzed.slice(-400);

  data.lastChecked = new Date().toISOString();
  saveData(data);

  console.log(`[JORADP] ✅ Terminé. ${newCount} nouveau(x) texte(s) TIC enregistré(s).`);
  return newCount;
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
═══════════════════════════════════════════════════════════════ */
module.exports = { checkJoradp, loadData, saveData };
