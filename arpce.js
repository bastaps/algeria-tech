'use strict';
/* ═══════════════════════════════════════════════════════════════
   ARPCE.JS — Algeria Tech
   Veille automatique — publications ARPCE (arpce.dz/fr/pub)
   ─────────────────────────────────────────────────────────────
   ✓ Pas d'analyse Mistral nécessaire : l'ARPCE est l'autorité
     de régulation des télécoms → toutes ses publications sont
     TIC-pertinentes par définition.
   ✓ SSL : rejectUnauthorized:false (cert ARPCE potentiellement
     invalide, comme pour joradp.dz)
═══════════════════════════════════════════════════════════════ */

const https = require('https');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');

const ARPCE_BASE     = 'https://www.arpce.dz';
const ARPCE_PUB_URL  = 'https://www.arpce.dz/fr/pub';
const ARPCE_FILE     = path.join(__dirname, 'arpce_veille.json');
const MAX_STORED     = 300;
const FETCH_TIMEOUT  = 30000;

/* Agent HTTPS permissif pour arpce.dz ────────────────────────── */
const ARPCE_AGENT = new https.Agent({ rejectUnauthorized: false });

/* ── Mois français ───────────────────────────────────────────── */
const MONTHS = {
  janvier:1, fevrier:2, février:2, mars:3, avril:4, mai:5, juin:6,
  juillet:7, aout:8, août:8, septembre:9, octobre:10,
  novembre:11, decembre:12, décembre:12,
};

/* ═══════════════════════════════════════════════════════════════
   PERSISTANCE
═══════════════════════════════════════════════════════════════ */
function loadData() {
  try { return JSON.parse(fs.readFileSync(ARPCE_FILE, 'utf-8')); }
  catch { return { lastChecked: null, items: [] }; }
}
function saveData(d) {
  fs.writeFileSync(ARPCE_FILE, JSON.stringify(d, null, 2));
}

/* ═══════════════════════════════════════════════════════════════
   FETCH HTML
═══════════════════════════════════════════════════════════════ */
function fetchHtml(url, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const isHttps  = url.startsWith('https');
    const client   = isHttps ? https : http;
    const isArpce  = url.includes('arpce.dz');
    const options  = {
      headers: {
        'User-Agent': 'AlgeriaTech-Veille/1.0',
        'Accept':     'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    };
    if (isHttps && isArpce) options.agent = ARPCE_AGENT;

    const req = client.get(url, options, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        if (!redirectsLeft) return reject(new Error('Trop de redirections'));
        const loc = res.headers.location;
        res.destroy();
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        return fetchHtml(next, redirectsLeft - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.destroy();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        // ARPCE sert parfois du latin-1
        const buf = Buffer.concat(chunks);
        const html = buf.toString('utf-8');
        resolve(html.includes('charset=') ? html : buf.toString('latin1'));
      });
      res.on('error', reject);
    });
    req.setTimeout(FETCH_TIMEOUT, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

/* ═══════════════════════════════════════════════════════════════
   NETTOYAGE HTML → TEXTE BRUT
═══════════════════════════════════════════════════════════════ */
function stripHtml(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ').replace(/&eacute;/gi, 'é').replace(/&agrave;/gi, 'à')
    .replace(/&egrave;/gi, 'è').replace(/&ecirc;/gi, 'ê').replace(/&eacute;/gi, 'é')
    .replace(/&ccedil;/gi, 'ç').replace(/&ugrave;/gi, 'ù').replace(/&ocirc;/gi, 'ô')
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&[a-z]{2,8};/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── Parser une date française ────────────────────────────────── */
function parseDateFr(s) {
  if (!s) return '';
  const m = s.match(/(\d{1,2})\s+([a-zéû]+)\s+(20\d{2})/i);
  if (!m) return '';
  const mo = MONTHS[m[2].toLowerCase()];
  if (!mo) return '';
  return `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/* ── Reformater une date ISO en français ──────────────────────── */
function isoToFr(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const mLabel = Object.entries(MONTHS).find(([k, v]) => v === +m && k.length > 4);
  return mLabel ? `${+d} ${mLabel[0]} ${y}` : iso;
}

/* ═══════════════════════════════════════════════════════════════
   MAPPER TYPE ARPCE → CATÉGORIE NORMALISÉE
═══════════════════════════════════════════════════════════════ */
function mapType(raw, titre) {
  const lo = ((raw || '') + ' ' + (titre || '')).toLowerCase();
  if (/appel.{0,5}offres|consultation.{0,8}ouverte/i.test(lo)) return "Appel d'offres";
  if (/communiqu[eé]/i.test(lo))                               return 'Communiqué';
  if (/d[eé]cision/i.test(lo))                                 return 'Décision';
  if (/consultation.{0,8}publique/i.test(lo))                  return 'Consultation publique';
  if (/arr[eê]t[eé]/i.test(lo))                                return 'Arrêté';
  if (/rapport|bilan|statistique|observatoire/i.test(lo))      return 'Rapport';
  if (/avis/i.test(lo))                                         return 'Avis';
  if (/licence|autorisation|attribution/i.test(lo))            return 'Décision';
  if (/programme|plan/i.test(lo))                              return 'Programme';
  return raw || 'Publication ARPCE';
}

/* ── Extraire numéro de référence ─────────────────────────────── */
function extractNumero(titre) {
  const m = titre.match(/[Nn][°º]\s*([\w\/\-]+(?:\/\w+)*)/);
  return m ? m[1] : '';
}

/* ═══════════════════════════════════════════════════════════════
   PARSER LA PAGE ARPCE
   Structure réelle du site :
   • Les liens vers les publications ont la forme /fr/pub/[slug6]
     (ex: /fr/pub/y2h9u7) avec texte "Lire" (trop court pour l'ancien parser)
   • Le titre est dans un heading <h2>–<h5> AVANT le lien "Lire"
   • Pagination : ?page=N  (pas ?start=N)
═══════════════════════════════════════════════════════════════ */
function parseArpcePage(html) {
  const items = [];
  const seen  = new Set();

  /* Trouve tous les liens /fr/pub/[slug] — quel que soit le texte du lien */
  const linkRe = /<a\s[^>]*href="(\/fr\/pub\/([a-z0-9]+))"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = linkRe.exec(html)) !== null) {
    const href     = m[1];
    const slug     = m[2];
    const linkText = stripHtml(m[3]);

    /* Ignorer les liens de pagination ou de navigation (/fr/pub?page=...) */
    if (!slug || slug.length < 4) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const url = `${ARPCE_BASE}${href}`;

    /* ── Titre ─────────────────────────────────────────────────
       Si le texte du lien est long (≥15 chars) → c'est le titre.
       Sinon (ex: "Lire") → chercher le dernier heading h2-h5
       dans les 3000 chars qui précèdent ce lien. */
    let title = '';
    if (linkText.length >= 15) {
      title = linkText;
    } else {
      const before = html.substring(Math.max(0, m.index - 3000), m.index);
      const hRe    = /<h[2-5][^>]*>([\s\S]*?)<\/h[2-5]>/gi;
      let hm, lastH = null;
      while ((hm = hRe.exec(before)) !== null) lastH = hm;
      if (lastH) title = stripHtml(lastH[1]);
    }

    if (!title || title.length < 5 || title.length > 500) continue;

    /* ── Contexte pour date / type / description ──────────────
       Zone de 3000 chars centrée autour du lien */
    const ctxStart = Math.max(0, m.index - 2000);
    const ctx      = html.substring(ctxStart, m.index + 800);

    /* Date : balise <time datetime="..."> puis texte littéral */
    let dateStr = '', dateFr = '';
    const timeM = ctx.match(/<time[^>]*datetime="([^"]+)"/i);
    if (timeM) {
      dateStr = timeM[1].substring(0, 10);
      dateFr  = isoToFr(dateStr);
    } else {
      const dtM = ctx.match(/(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+(20\d{2})/i);
      if (dtM) {
        dateFr  = `${dtM[1]} ${dtM[2]} ${dtM[3]}`;
        dateStr = parseDateFr(dateFr);
      }
    }

    /* Type / badges (span avec classe label, badge, tag, category ou type) */
    const tagRe = /<span[^>]*class="[^"]*(?:label|badge|tag|categ|type)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    const types = [];
    let tg;
    while ((tg = tagRe.exec(ctx)) !== null) {
      const t = stripHtml(tg[1]);
      if (t && t.length > 1 && t.length < 80 && t !== 'Nouveau') types.push(t);
    }

    /* Description : premier <p> substantiel dans le contexte */
    const descM = ctx.match(/<p[^>]*>([\s\S]{20,400}?)<\/p>/i);
    const desc  = descM ? stripHtml(descM[1]).substring(0, 350) : '';

    const typeRaw    = types[0] || '';
    const typeMapped = mapType(typeRaw, title);

    items.push({
      id:          `arpce-${slug}`,
      source:      'ARPCE',
      jo_numero:   null,
      jo_numStr:   null,
      jo_date:     dateStr,
      jo_date_fr:  dateFr,
      jo_url:      url,
      type:        typeMapped,
      type_raw:    typeRaw,
      types_tags:  types,
      numero:      extractNumero(title),
      date_texte:  dateFr,
      titre:       title,
      page_jo:     null,
      pertinence:  desc || `Publication officielle ARPCE — ${typeMapped}`,
      url,
      detected_at: new Date().toISOString(),
    });
  }

  return items;
}

/* ═══════════════════════════════════════════════════════════════
   FETCH UNE PAGE DE PUBLICATIONS
   Le site ARPCE pagine avec ?page=N (1-indexé, ~10 items/page)
═══════════════════════════════════════════════════════════════ */
async function fetchArpcePage(pageNum = 1) {
  const url  = pageNum <= 1 ? ARPCE_PUB_URL : `${ARPCE_PUB_URL}?page=${pageNum}`;
  console.log(`[ARPCE]   Fetch page ${pageNum} …`);
  const html = await fetchHtml(url);
  return parseArpcePage(html);
}

/* ═══════════════════════════════════════════════════════════════
   CHECK PRINCIPAL — nouvelles publications uniquement
   pagesMax = 1 → vérification quotidienne rapide (1 page)
   pagesMax > 1 → backfill (plusieurs pages)
═══════════════════════════════════════════════════════════════ */
async function checkArpce(pagesMax = 1) {
  console.log('[ARPCE] 🔎 Vérification des nouvelles publications ARPCE…');
  const data      = loadData();
  const existIds  = new Set(data.items.map(i => i.id));
  let   totalNew  = 0;

  for (let p = 0; p < pagesMax; p++) {
    if (p > 0) await new Promise(r => setTimeout(r, 2000));
    try {
      const items    = await fetchArpcePage(p + 1);
      if (!items.length) { console.log('[ARPCE]   Page vide — arrêt.'); break; }

      const newItems = items.filter(i => !existIds.has(i.id));
      newItems.forEach(i => { existIds.add(i.id); data.items.unshift(i); });
      totalNew += newItems.length;

      console.log(`[ARPCE]   Page ${p + 1}/${pagesMax} : ${items.length} pub, ${newItems.length} nouvelles`);

      /* Si on trouve 0 nouveau sur une page intérieure, on a rattrapé le niveau */
      if (p > 0 && newItems.length === 0) break;
    } catch (e) {
      console.error(`[ARPCE] ❌ Page ${p + 1} : ${e.message}`);
      break;
    }
  }

  data.items      = data.items.slice(0, MAX_STORED);
  data.lastChecked = new Date().toISOString();
  saveData(data);

  if (totalNew > 0) {
    console.log(`[ARPCE] ✅ ${totalNew} nouvelle(s) publication(s) ajoutée(s).`);
  } else {
    console.log('[ARPCE] ✅ Aucune nouvelle publication.');
  }
  return totalNew;
}

/* ═══════════════════════════════════════════════════════════════
   BACKFILL — charger les pages jusqu'à une date limite
   stopDate : chaîne ISO "YYYY-MM-DD" (ex: "2025-01-01")
═══════════════════════════════════════════════════════════════ */
async function backfillArpce(pagesMax = 12, stopDate = null) {
  const stopLabel = stopDate ? `arrêt avant ${stopDate}` : 'toutes pages';
  console.log(`\n[ARPCE] 🔄 BACKFILL — ${pagesMax} pages max (${stopLabel})\n`);

  const data      = loadData();
  const existIds  = new Set(data.items.map(i => i.id));
  let   totalNew  = 0;

  for (let p = 0; p < pagesMax; p++) {
    if (p > 0) await new Promise(r => setTimeout(r, 2000));
    try {
      const items = await fetchArpcePage(p + 1);
      if (!items.length) { console.log('[ARPCE]   Page vide — arrêt.'); break; }

      const newItems = items.filter(i => !existIds.has(i.id));
      newItems.forEach(i => { existIds.add(i.id); data.items.push(i); });
      totalNew += newItems.length;

      console.log(`[ARPCE]   Page ${p + 1}/${pagesMax} : ${items.length} pub, ${newItems.length} nouvelles`);

      /* Condition d'arrêt par date */
      if (stopDate) {
        const datedItems = items.filter(i => i.jo_date && i.jo_date.length >= 10);
        if (datedItems.length > 0) {
          const oldest = datedItems.map(i => i.jo_date).sort()[0];
          if (oldest < stopDate) {
            console.log(`[ARPCE]   Date limite atteinte (plus ancien : ${oldest}) — arrêt.`);
            break;
          }
        }
      }

      if (p > 0 && newItems.length === 0) { console.log('[ARPCE]   Aucun nouveau — arrêt.'); break; }

    } catch (e) {
      console.error(`[ARPCE] ❌ Page ${p + 1} : ${e.message}`);
      break;
    }
  }

  data.items      = data.items.slice(0, MAX_STORED);
  data.lastChecked = new Date().toISOString();
  saveData(data);

  console.log(`\n[ARPCE] 🏁 BACKFILL terminé — ${totalNew} publication(s) ajoutée(s).`);
  return totalNew;
}

module.exports = { checkArpce, backfillArpce, loadData, saveData };
