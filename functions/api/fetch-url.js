// POST /api/fetch-url — lit une page web (communiqué, article) et renvoie son texte, EN LIGNE (Smart Ingest PRO).
// Même contrat que le Hub local (server.js) : { text, title, url, image?, video? }. Session admin obligatoire.
// Lecture directe puis repli « lecteur » (r.jina.ai) ; pas de rendu navigateur en ligne (copier-coller du texte sinon).
import { json, requireAdmin } from '../_lib/admin.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MIN_LEN = 300;

// Pas de requêtes vers un réseau interne (SSRF) : hôtes locaux, adresses privées, formes numériques détournées.
function hoteInterdit(h) {
  h = String(h || '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost') || h.includes('@')) return true;
  if (/^\[.*\]$/.test(h)) return true;                       // IPv6 littérale
  if (/^[0-9.]+$/.test(h) || /0x[0-9a-f]/.test(h)) {          // IPv4 (ou forme numérique)
    const p = h.split('.').map(Number);
    if (p.length !== 4 || p.some(n => !(n >= 0 && n <= 255))) return true;
    if (p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168)) return true;
  }
  return false;
}

function extractMainText(html) {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<nav[\s\S]*?<\/nav>/gi, ' ').replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ').replace(/<aside[\s\S]*?<\/aside>/gi, ' ').replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
    .replace(/<form[\s\S]*?<\/form>/gi, ' ').replace(/<button[\s\S]*?<\/button>/gi, ' ');
  const zone = (clean.match(/<article[\s\S]*?<\/article>/i) || [])[0] || (clean.match(/<main[\s\S]*?<\/main>/i) || [])[0] ||
    (clean.match(/<body[\s\S]*?<\/body>/i) || [])[0] || clean;
  return zone
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ').replace(/&eacute;/gi, 'é')
    .replace(/&agrave;/gi, 'à').replace(/&egrave;/gi, 'è').replace(/&ecirc;/gi, 'ê').replace(/&ccedil;/gi, 'ç').replace(/&ugrave;/gi, 'ù')
    .replace(/&ocirc;/gi, 'ô').replace(/&quot;/gi, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&[a-z]{2,8};/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function lireHtml(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (hoteInterdit(new URL(r.url).hostname)) throw new Error('Adresse interdite');
  const type = r.headers.get('content-type') || '';
  if (type && !/html|xml|text/i.test(type)) throw new Error('Ce lien ne renvoie pas une page web');
  const buf = await r.arrayBuffer();
  if (buf.byteLength > 3 * 1024 * 1024) throw new Error('Page trop volumineuse');
  return new TextDecoder('utf-8').decode(buf);
}

async function lireViaLecteur(url) {
  const r = await fetch('https://r.jina.ai/' + url, { headers: { 'User-Agent': UA, 'X-Return-Format': 'text' }, signal: AbortSignal.timeout(40000) });
  if (!r.ok) throw new Error(`Lecteur HTTP ${r.status}`);
  let txt = await r.text();
  const title = (txt.match(/^Title:\s*(.+)$/m) || [])[1] || '';
  txt = txt.replace(/^Title:.*$/m, '').replace(/^URL Source:.*$/m, '').replace(/^Markdown Content:\s*/m, '').trim();
  return { text: txt, title: title.trim() };
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  let url;
  try { url = String((await request.json()).url || '').trim(); } catch { return json({ error: 'Requête invalide' }, 400); }
  let u;
  try { u = new URL(url); } catch { return json({ error: 'URL invalide' }, 400); }
  if (!/^https?:$/.test(u.protocol) || hoteInterdit(u.hostname)) return json({ error: 'URL invalide ou interdite' }, 400);

  let erreur = null;
  try {
    const html = await lireHtml(url);
    const titre = ((html.match(/<title[^>]*>([^<]{1,200})<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const og = (p) => (html.match(new RegExp(`<meta\\s+(?:property|name)=["']${p}["']\\s+content=["']([^"']+)["']`, 'i')) ||
      html.match(new RegExp(`content=["']([^"']+)["']\\s+(?:property|name)=["']${p}["']`, 'i')) || [])[1] || '';
    const image = og('og:image') || og('twitter:image');
    const video = og('og:video:url') || og('og:video');
    const text = extractMainText(html);
    const streamed = /self\.__next_f\.push/.test(html);
    if (text.length >= MIN_LEN && !streamed) {
      return json({ text: text.substring(0, 8000), title: titre, url, image: image || undefined, video: video || undefined });
    }
    erreur = new Error(streamed ? 'Page à contenu chargé côté client' : 'Contenu trop court (page rendue en JavaScript)');
  } catch (e) { erreur = e; }

  try {
    const { text, title } = await lireViaLecteur(url);
    if (text.length >= MIN_LEN) return json({ text: text.substring(0, 8000), title, url });
  } catch (e) { /* message final ci-dessous */ }

  const bloque = /403|401|429/.test(String(erreur && erreur.message));
  return json({
    error: bloque
      ? "Ce site bloque l'extraction automatique (anti-bot ou paywall). Ouvrez l'article et copiez-collez le texte directement dans la zone ci-dessous."
      : "Impossible d'extraire le contenu de cette page (" + (erreur ? erreur.message : 'inconnu') + "). Copiez-collez le texte manuellement.",
  }, 502);
}
