'use strict';
/* ═══════════════════════════════════════════════════════════════
   JORADP.JS — Algeria Tech
   Veille Réglementaire automatique — Journal Officiel Algérien
   ─────────────────────────────────────────────────────────────
   ⚠️  JORADP utilise un certificat SSL auto-signé/expiré —
       rejectUnauthorized: false est intentionnel et limité
       au domaine joradp.dz uniquement.
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

const MAX_SOMMAIRE_PAGES  = 5;
const MAX_PDF_MB          = 30;
const FETCH_TIMEOUT_MS    = 40000;
const PDF_PARTIAL_BYTES   = 400000; // 400 Ko → couvre les 4-6 premières pages (sommaire)
const MAX_ISSUES_DELTA    = 5;    // numéros/vérification quotidienne
const MAX_STORED_TEXTES   = 500;

/* Agent HTTPS qui tolère le certificat auto-signé du JORADP ── */
const JORADP_AGENT = new https.Agent({ rejectUnauthorized: false });

/* ── Correspondance mois français ────────────────────────────── */
const MONTHS_FR = {
  'janvier':   '01', 'fevrier':   '02', 'février':   '02',
  'mars':      '03', 'avril':     '04', 'mai':        '05',
  'juin':      '06', 'juillet':   '07', 'aout':       '08',
  'août':      '08', 'septembre': '09', 'octobre':    '10',
  'novembre':  '11', 'decembre':  '12', 'décembre':   '12',
};

const MONTHS_FR_LABELS = [
  '', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

/* ── Mots-clés TIC (pré-filtre avant Mistral) ────────────────── */
const TIC_KW = [
  'algérie télécom','algerie telecom','mobilis','ooredoo','djezzy',
  'arpce','arpt','atrp','algérie poste','algerie poste',
  'barid el-djazaïr','barid el djazair',
  'télécommunication','telecom','téléphonie','telephonie',
  'numérique','numerique','digital','tic','informatique',
  'transition numérique','transition numerique',
  'cybersécurité','cyber-sécurité','cybersecurite',
  'données personnelles','donnees personnelles',
  'fibre optique','4g','5g','réseau mobile','réseau fixe',
  'haut débit','internet','spectre','fréquence','hertzien',
  'e-administration','e-commerce','e-gouvernement','e-paiement',
  'e-santé','e-learning','dématérialisation','numérisation',
  'paiement électronique','paiement mobile','edahabia','cib',
  'signature électronique','carte de crédit',
  'startup','incubateur','pépinière','innovation','technologie',
  'logiciel','application numérique','plateforme',
  'système d\'information','cloud','hébergement',
];

/* ═══════════════════════════════════════════════════════════════
   PERSISTANCE
═══════════════════════════════════════════════════════════════ */
function loadData() {
  try { return JSON.parse(fs.readFileSync(VEILLE_FILE, 'utf-8')); }
  catch {
    return { lastChecked: null, analyzed: [], textes: [] };
  }
}
function saveData(d) {
  fs.writeFileSync(VEILLE_FILE, JSON.stringify(d, null, 2));
}

/* ═══════════════════════════════════════════════════════════════
   FETCH HTTP/HTTPS
   • rejectUnauthorized:false pour joradp.dz (cert auto-signé)
   • Suit les redirections, limite la taille, timeout configurable
═══════════════════════════════════════════════════════════════ */
function fetchBuffer(url, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const isHttps  = url.startsWith('https');
    const client   = isHttps ? https : http;
    const maxSize  = MAX_PDF_MB * 1024 * 1024;
    const isJoradp = url.includes('joradp.dz');

    const options = {
      headers: {
        'User-Agent': 'AlgeriaTech-VeilleReglementaire/1.0',
        'Accept':     '*/*',
      },
    };
    if (isHttps && isJoradp) options.agent = JORADP_AGENT;

    const req = client.get(url, options, res => {
      /* Redirections */
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        if (!redirectsLeft) return reject(new Error('Trop de redirections'));
        const loc = res.headers.location;
        if (!loc) return reject(new Error('Redirection sans Location'));
        res.destroy();
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        return fetchBuffer(next, redirectsLeft - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.destroy();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const cl = parseInt(res.headers['content-length'] || '0', 10);
      if (cl > maxSize) {
        res.destroy();
        return reject(new Error(`PDF trop grand (${(cl / 1048576).toFixed(1)} MB)`));
      }

      const chunks = [];
      let total    = 0;
      res.on('data', c => {
        total += c.length;
        if (total > maxSize) { res.destroy(); return reject(new Error('PDF trop grand')); }
        chunks.push(c);
      });
      res.on('end',   () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.setTimeout(FETCH_TIMEOUT_MS, () => { req.destroy(); reject(new Error(`Timeout`)); });
    req.on('error', reject);
  });
}

/* ═══════════════════════════════════════════════════════════════
   FETCH PDF PARTIEL — Range: bytes=0-N
   Télécharge uniquement les N premiers octets du PDF.
   Le sommaire tient dans les 400 premiers Ko pour la quasi-
   totalité des JO algériens (pages 1-5 en format texte).
   • Envoie Range: bytes=0-(maxBytes-1) → 206 si serveur ok
   • Si le serveur répond 200 (pas de Range), coupe après N octets
   • Gère proprement la destruction de flux (ECONNRESET attendu)
═══════════════════════════════════════════════════════════════ */
function fetchPdfPartial(url, maxBytes = PDF_PARTIAL_BYTES, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const isHttps  = url.startsWith('https');
    const client   = isHttps ? https : http;
    const isJoradp = url.includes('joradp.dz');

    const options = {
      headers: {
        'User-Agent': 'AlgeriaTech-VeilleReglementaire/1.0',
        'Accept':     'application/pdf,*/*',
        'Range':      `bytes=0-${maxBytes - 1}`,
      },
    };
    if (isHttps && isJoradp) options.agent = JORADP_AGENT;

    let settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    const req = client.get(url, options, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        if (!redirectsLeft) return done(reject, new Error('Trop de redirections'));
        const loc = res.headers.location;
        if (!loc) return done(reject, new Error('Redirection sans Location'));
        res.destroy();
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        return fetchPdfPartial(next, maxBytes, redirectsLeft - 1)
          .then(v => done(resolve, v)).catch(e => done(reject, e));
      }
      /* 206 = Range honoré, 200 = Range ignoré (on coupe manuellement) */
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.destroy();
        return done(reject, new Error(`HTTP ${res.statusCode}`));
      }

      const chunks  = [];
      let received  = 0;
      res.on('data', chunk => {
        if (settled) return;
        chunks.push(chunk);
        received += chunk.length;
        if (received >= maxBytes) {
          res.destroy(); // coupe la connexion — ECONNRESET ignoré ci-dessous
          done(resolve, Buffer.concat(chunks));
        }
      });
      res.on('end',   () => done(resolve, Buffer.concat(chunks)));
      res.on('error', e => {
        if (e.code !== 'ECONNRESET' && e.code !== 'ERR_STREAM_DESTROYED') done(reject, e);
      });
    });

    req.setTimeout(20000, () => { req.destroy(); done(reject, new Error('Timeout PDF partiel')); });
    req.on('error', e => {
      if (!settled && e.code !== 'ECONNRESET' && e.code !== 'ERR_STREAM_DESTROYED') done(reject, e);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   PARSER HTML — Accueil.htm
   Extrait les MaxWin('NNN') et les dates associées
═══════════════════════════════════════════════════════════════ */
function parseAccueil(html) {
  const issues = [];
  const seen   = new Set();
  const norm   = html.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

  const mwRe   = /MaxWin\('(\d{2,3})'\)/g;
  const datePat = /(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(20\d{2})/g;

  const allDates = [];
  let dm;
  while ((dm = datePat.exec(norm)) !== null) {
    const mLow = dm[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    // Normalise accents pour la comparaison
    const mKey = dm[2].toLowerCase();
    const mNum = MONTHS_FR[mKey] || MONTHS_FR[mLow];
    if (mNum) allDates.push({ day: dm[1].padStart(2,'0'), month: mNum, year: dm[3],
      fr: `${dm[1]} ${dm[2]} ${dm[3]}`, idx: dm.index });
  }

  let mw;
  while ((mw = mwRe.exec(norm)) !== null) {
    const numStr = mw[1].padStart(3, '0');
    const numero = parseInt(mw[1], 10);

    let bestDate = allDates[0];
    if (allDates.length > 1) {
      bestDate = allDates.reduce((p, c) =>
        Math.abs(c.idx - mw.index) < Math.abs(p.idx - mw.index) ? c : p);
    }
    if (!bestDate) continue;

    const year = parseInt(bestDate.year, 10);
    const id   = `${year}-${numStr}`;
    if (seen.has(id)) continue;
    seen.add(id);

    issues.push({
      id, numero, year, numStr,
      date:    `${bestDate.year}-${bestDate.month}-${bestDate.day}`,
      date_fr: bestDate.fr,
      url:     `${JORADP_PDF_BASE}/${year}/F${year}${numStr}.pdf`,
    });
  }
  return issues.sort((a, b) => b.year - a.year || b.numero - a.numero);
}

/* ═══════════════════════════════════════════════════════════════
   EXTRACTION DATE depuis le texte du PDF
   Le JO contient "3 juin 2026" ou "26 janvier 2026" dans l'en-tête
═══════════════════════════════════════════════════════════════ */
function extractDateFr(text) {
  // Ex: "3 juin 2026" ou "26 Janvier 2026"
  const months = Object.keys(MONTHS_FR).join('|');
  const re = new RegExp(`(\\d{1,2})\\s+(${months})\\s+(20\\d{2})`, 'i');
  const m  = text.match(re);
  if (!m) return null;
  const year  = m[3];
  const month = MONTHS_FR[m[2].toLowerCase()] || '01';
  const day   = m[1].padStart(2, '0');
  const label = `${m[1]} ${m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase()} ${year}`;
  return { date: `${year}-${month}-${day}`, date_fr: label };
}

/* ── Construit un objet issue à partir d'un numéro brut ────── */
function buildIssue(numero, year) {
  const numStr = numero.toString().padStart(3, '0');
  return {
    id:      `${year}-${numStr}`,
    numero, year, numStr,
    date:    `${year}-01-01`,
    date_fr: `JO N°${numero} — ${year}`,
    url:     `${JORADP_PDF_BASE}/${year}/F${year}${numStr}.pdf`,
  };
}

/* ═══════════════════════════════════════════════════════════════
   EXTRACTION SOMMAIRE — téléchargement partiel du PDF (400 Ko)
   On ne récupère que les premières pages — le JO n'est jamais
   stocké en entier sur le disque.
═══════════════════════════════════════════════════════════════ */
async function extractSommaire(pdfUrl) {
  const buf  = await fetchPdfPartial(pdfUrl, PDF_PARTIAL_BYTES);
  const data = await pdfParse(buf, { max: MAX_SOMMAIRE_PAGES });
  return data.text || '';
}

/* ── Pré-filtre mots-clés TIC ──────────────────────────────── */
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
Identifie UNIQUEMENT les textes ayant un lien direct avec :

• Télécommunications : Algérie Télécom, Mobilis, Ooredoo, Djezzy, opérateurs
• Régulation : ARPCE, ARPT, autorités de régulation des communications
• Numérique : transition numérique, e-administration, e-gouvernement, e-commerce,
  e-paiement, dématérialisation, numérisation
• Technologies : 4G, 5G, fibre optique, spectre, fréquences, réseaux haut débit
• Cybersécurité : sécurité informatique, données personnelles, CERT-DZ, loi 18-07
• Innovation : startups, incubateurs, pépinières, Loi Startup
• Poste & paiement : Algérie Poste, Barid El-Djazaïr, paiement mobile, Edahabia, CIB
• Systèmes d'information : logiciels, cloud, plateformes numériques, SI de l'État

MOTS-CLÉS PRIORITAIRES :
algérie télécom, mobilis, ooredoo, djezzy, arpce, arpt, numérique, digital,
transition numérique, startup, incubateur, fibre optique, 4G, 5G, internet,
e-administration, e-commerce, cybersécurité, données personnelles, spectre,
dématérialisation, paiement électronique, edahabia, CIB, Algérie Poste.

Pour CHAQUE texte pertinent :
{
  "type": "Loi | Décret exécutif | Décret présidentiel | Arrêté | Décision | Circulaire | Instruction | Avis",
  "numero": "XX-XXX ou chaîne vide",
  "date_texte": "date telle qu'elle apparaît dans le sommaire",
  "titre": "titre COMPLET du texte",
  "page_jo": numéro_de_page_entier_ou_null,
  "pertinence": "1 phrase factuelle : pourquoi ce texte concerne le secteur TIC"
}

Réponds UNIQUEMENT en JSON pur : { "textes": [ ... ] }
Si aucun texte TIC : { "textes": [] }

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
    const opts = {
      hostname: 'api.mistral.ai',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(raw);
          if (r.error) throw new Error(r.error.message);
          const p = JSON.parse(r.choices[0].message.content);
          resolve(Array.isArray(p.textes) ? p.textes : []);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(35000, () => { req.destroy(); reject(new Error('Mistral timeout')); });
    req.write(payload);
    req.end();
  });
}

/* ═══════════════════════════════════════════════════════════════
   ENRICHISSEMENT & DÉDUPLICATION
═══════════════════════════════════════════════════════════════ */
function enrichAndMerge(textes, iss, data) {
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
      type:        t.type        || 'Texte réglementaire',
      numero:      t.numero      || '',
      date_texte:  t.date_texte  || '',
      titre:       t.titre       || '',
      page_jo:     t.page_jo     || null,
      pertinence:  t.pertinence  || '',
      detected_at: new Date().toISOString(),
    }));
  data.textes = [...enriched, ...data.textes].slice(0, MAX_STORED_TEXTES);
  return enriched.length;
}

/* ═══════════════════════════════════════════════════════════════
   TRAITEMENT D'UN NUMÉRO (commun à checkJoradp et backfillJoradp)
═══════════════════════════════════════════════════════════════ */
async function processIssue(iss, data, apiKey) {
  let added = 0;
  try {
    const sommaire = await extractSommaire(iss.url);

    /* Enrichir la date si elle n'était pas dans Accueil.htm */
    if (iss.date_fr.startsWith('JO N°')) {
      const extracted = extractDateFr(sommaire);
      if (extracted) { iss.date = extracted.date; iss.date_fr = extracted.date_fr; }
    }

    if (!sommaire || sommaire.length < 50) {
      console.log(`[JORADP]   Sommaire vide — ignoré.`);
      return 0;
    }
    if (!hasTicContent(sommaire)) {
      console.log(`[JORADP]   Pas de contenu TIC — ignoré.`);
      return 0;
    }

    console.log(`[JORADP]   ✓ TIC détecté — analyse Mistral...`);
    const textes = await analyzeSommaire(sommaire, iss, apiKey);

    if (textes.length > 0) {
      added = enrichAndMerge(textes, iss, data);
      console.log(`[JORADP]   ✅ ${added} texte(s) TIC enregistré(s).`);
    } else {
      console.log(`[JORADP]   Aucun texte TIC extrait.`);
    }
  } catch (e) {
    console.error(`[JORADP] ❌ JO n°${iss.numero} : ${e.message}`);
  }
  return added;
}

/* ═══════════════════════════════════════════════════════════════
   CHECK QUOTIDIEN — nouveaux numéros uniquement
═══════════════════════════════════════════════════════════════ */
async function checkJoradp(apiKey) {
  console.log('[JORADP] 🔎 Vérification des nouveaux numéros...');
  const data = loadData();

  let html;
  try {
    const buf = await fetchBuffer(JORADP_ACCUEIL);
    html = buf.toString('utf-8').includes('MaxWin')
      ? buf.toString('utf-8')
      : buf.toString('latin1');
  } catch (e) {
    console.error('[JORADP] ❌ Accueil.htm inaccessible :', e.message);
    return 0;
  }

  const issues     = parseAccueil(html);
  const toProcess  = issues
    .filter(i => !data.analyzed.includes(i.id))
    .slice(0, MAX_ISSUES_DELTA);

  if (toProcess.length === 0) {
    console.log('[JORADP] ✅ Tous les numéros récents déjà traités.');
    data.lastChecked = new Date().toISOString();
    saveData(data);
    return 0;
  }

  let total = 0;
  for (const iss of toProcess) {
    console.log(`[JORADP] → JO n°${iss.numero} du ${iss.date_fr}`);
    data.analyzed.push(iss.id);
    total += await processIssue(iss, data, apiKey);
    saveData(data);
  }

  data.lastChecked = new Date().toISOString();
  saveData(data);
  console.log(`[JORADP] ✅ Vérification terminée — ${total} nouveau(x) texte(s).`);
  return total;
}

/* ═══════════════════════════════════════════════════════════════
   BACKFILL — tous les numéros depuis le n°1 de l'année
   Appelé une seule fois pour initialiser la base de données.
   Délai entre chaque requête pour respecter le serveur JORADP.
═══════════════════════════════════════════════════════════════ */
async function backfillJoradp(year, apiKey, delayMs = 3000, maxNum = null) {
  const currentYear = new Date().getFullYear();
  year = year || currentYear;
  console.log(`\n[JORADP] 🔄 BACKFILL — Tous les JO de ${year} depuis n°1\n`);

  const data = loadData();

  /* 1. Essayer d'abord Accueil.htm pour obtenir les numéros avec dates */
  let knownIssues = [];
  let maxKnown    = 0;
  try {
    const buf  = await fetchBuffer(JORADP_ACCUEIL);
    const html = buf.toString('utf-8').includes('MaxWin')
      ? buf.toString('utf-8')
      : buf.toString('latin1');
    knownIssues = parseAccueil(html).filter(i => i.year === year);
    maxKnown    = knownIssues.reduce((m, i) => Math.max(m, i.numero), 0);
    console.log(`[JORADP] Accueil.htm → ${knownIssues.length} numéro(s) listés (max n°${maxKnown})`);
  } catch (e) {
    console.warn(`[JORADP] Accueil.htm inaccessible : ${e.message}`);
  }

  /* Si maxNum fourni explicitement, il prime toujours */
  if (maxNum) {
    maxKnown = Math.max(maxKnown, maxNum);
  } else if (maxKnown === 0) {
    /* Estimation de secours : année passée ≈ 90 numéros, année en cours ≈ mois × 7 */
    maxKnown = year < currentYear
      ? 90
      : Math.min((new Date().getMonth() + 1) * 7, 90);
  }
  console.log(`[JORADP] Plafond : n°${maxKnown}`);

  /* 2. Construire la liste complète n°1 → maxKnown */
  const knownMap = new Map(knownIssues.map(i => [i.numero, i]));
  const allIssues = [];
  for (let n = 1; n <= maxKnown; n++) {
    allIssues.push(knownMap.get(n) || buildIssue(n, year));
  }

  /* 3. Filtrer ceux déjà analysés */
  const toProcess = allIssues.filter(i => !data.analyzed.includes(i.id));
  const total     = toProcess.length;

  if (total === 0) {
    console.log(`[JORADP] ✅ Tous les numéros de ${year} sont déjà dans la base.`);
    return 0;
  }

  console.log(`[JORADP] ${total} numéro(s) à analyser. Délai : ${delayMs / 1000}s entre chaque.\n`);
  console.log(`[JORADP] Durée estimée : ~${Math.ceil(total * (delayMs + 25000) / 60000)} minutes.\n`);

  let newTextes = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const iss = toProcess[i];

    if (i > 0) await new Promise(r => setTimeout(r, delayMs));

    console.log(`[JORADP] [${i + 1}/${total}] JO n°${iss.numero} — ${iss.date_fr}`);

    /* Marquer comme analysé AVANT (évite retry en boucle si crash) */
    data.analyzed.push(iss.id);

    const added = await processIssue(iss, data, apiKey);
    newTextes  += added;

    /* Sauvegarder après chaque numéro */
    data.lastChecked = new Date().toISOString();
    saveData(data);
  }

  /* Nettoyer l'historique d'analyse si trop long */
  if (data.analyzed.length > 600) data.analyzed = data.analyzed.slice(-500);
  data.lastChecked = new Date().toISOString();
  saveData(data);

  console.log(`\n[JORADP] 🏁 BACKFILL terminé.`);
  console.log(`[JORADP] Numéros traités : ${total} | Textes TIC trouvés : ${newTextes}\n`);
  return newTextes;
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
═══════════════════════════════════════════════════════════════ */
module.exports = { checkJoradp, backfillJoradp, loadData, saveData };
