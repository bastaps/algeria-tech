// Passerelle : l'éditeur Smart Ingest PRO (page, script, styles) n'est servi
// QU'À une session admin valide. Sans connexion : redirection vers la page de
// connexion — le code de l'éditeur n'est même pas envoyé au navigateur.
// (_routes.json limite ce middleware à /smart-ingest-pro*, /admin-brouillons*, /brouillons/* et /api/*.)
// Les brouillons non publiés ne sont donc pas lisibles publiquement non plus.
import { readSession, ghGet, ghPut } from './_lib/admin.js';

// Filet de sécurité de la revue de presse : GitHub retarde les exécutions planifiées de plusieurs heures. Si, à partir de
// 06h00 heure d'Alger, quelqu'un charge la revue et que l'édition du jour n'est pas là, le site dépose data/revue-demande.json
// (un « push » déclenche aussitôt le workflow revue-presse.yml). Au plus une demande toutes les 30 minutes.
let dernierEssaiRevue = 0;
async function verifierRevue(res, env) {
  const alger = new Date(Date.now() + 3600 * 1000);            // heure d'Alger = UTC+1 (pas de changement d'heure)
  if (alger.getUTCHours() < 6 || !env.GITHUB_TOKEN) return;
  const attendu = alger.toISOString().slice(0, 10);
  const j = await res.json();
  const date = j.edition || String(j.lastUpdated || '').slice(0, 10);
  if (date >= attendu) return;                                  // à jour (une édition préparée la nuit porte déjà la date du jour)
  if (Date.now() - dernierEssaiRevue < 15 * 60 * 1000) return;
  dernierEssaiRevue = Date.now();
  const deja = await ghGet(env, 'data/revue-demande.json').catch(() => null);
  if (deja && deja.content) {
    try { if (Date.now() - JSON.parse(atob(deja.content.replace(/\s/g, ''))).ts < 30 * 60 * 1000) return; } catch { /* demande illisible : on la remplace */ }
  }
  await ghPut(env, 'data/revue-demande.json', JSON.stringify({ ts: Date.now(), attendu }), 'Revue périmée : demande de mise à jour');
}


// Anti-abus des endpoints qui consomment des crédits IA/voix (Mistral, ElevenLabs, Workers AI, YouTube) :
// seul le site lui-même (même origine) peut les appeler ; un curl/script externe est refusé.
const COUT = /^\/api\/(debat|synthese|kateb|tts|voices|outpaint|youtube|newsletter)\/?$/;
function memeOrigine(request, url) {
  const sfs = request.headers.get('Sec-Fetch-Site');
  if (sfs) return sfs === 'same-origin';
  for (const h of ['Origin', 'Referer']) {
    const v = request.headers.get(h);
    if (v) { try { return new URL(v).host === url.host; } catch { return false; } }
  }
  return false;
}

export async function onRequest({ request, env, next, waitUntil }) {
  const url = new URL(request.url);
  if (url.pathname === '/revue_presse.json') {
    const res = await next();
    if (request.method === 'GET' && res.ok) { try { waitUntil(verifierRevue(res.clone(), env).catch(() => {})); } catch { /* sans effet sur la réponse */ } }
    return res;
  }
  if (COUT.test(url.pathname) && request.method !== 'OPTIONS' && !memeOrigine(request, url)) {
    return new Response(JSON.stringify({ error: 'Accès refusé (appel externe).' }), { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  if (url.pathname.startsWith('/smart-ingest-pro') || url.pathname.startsWith('/admin-brouillons') || url.pathname.startsWith('/brouillons/')) {
    const s = await readSession(request, env);
    if (!s) {
      return Response.redirect(`${url.origin}/admin-login.html?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
    }
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'no-store');
    out.headers.set('X-Frame-Options', 'SAMEORIGIN');
    return out;
  }
  return next();
}
