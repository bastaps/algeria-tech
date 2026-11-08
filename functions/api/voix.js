// ── Cloudflare Pages Function — /api/voix ──────────────────────────────────────
// Voix « serveur » de l'Assistant Vocal (page privée, session admin exigée par _middleware.js).
// Pourquoi : les navigateurs mobiles refusent la synthèse vocale du téléphone tant que l'écran n'a pas été touché.
// En conduite (application ouverte par « Ok Google »), on fait donc lire la réponse par un fichier audio,
// qu'une application installée a le droit de jouer sans toucher l'écran.
// Moteur : Cloudflare Workers AI (binding `AI`, offre gratuite), modèle MeloTTS (français, anglais).
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: 'Voix serveur non configurée (binding AI absent).' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const text = String(body?.text || '').replace(/\s+/g, ' ').trim().slice(0, 900);
  if (!text) return json({ error: 'Texte vide.' }, 400);
  const lang = body?.lang === 'en' ? 'en' : 'fr';
  try {
    const out = await env.AI.run('@cf/myshell-ai/melotts', { prompt: text, lang });
    const b64 = out && (out.audio || out.result?.audio);
    if (!b64) return json({ error: 'Voix vide.' }, 502);
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new Response(bin, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return json({ error: 'Voix serveur indisponible.' }, 503);
  }
}
