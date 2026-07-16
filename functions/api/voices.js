// ── Cloudflare Pages Function — /api/voices ───────────────────────────────────
// Liste les voix premium disponibles pour « CV Parlé ».
// Portage de app.get('/api/voices') de cv-massar/workspace/server.js (Express) :
// même contrat de sortie, mais la clé vient de l'environnement Cloudflare.
// Clé : variable `ELEVENLABS_API_KEY` (dashboard Pages → Settings → Environment
// variables). Jamais en dur — le dépôt est public.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

export async function onRequestGet({ request, env }) {
  const provider = (new URL(request.url).searchParams.get('provider') || '').toLowerCase();

  if (provider !== 'elevenlabs')
    return json({ error: 'provider requis : elevenlabs' }, 400);

  if (!env.ELEVENLABS_API_KEY)
    return json({ error: 'ELEVENLABS_API_KEY non configurée' }, 503);

  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY }
    });
    if (!r.ok) return json({ error: `ElevenLabs: ${r.statusText}` }, r.status);

    const data = await r.json();
    return json((data.voices || []).map(v => ({
      id: v.voice_id,
      name: v.name,
      category: v.category || 'custom',
      provider: 'elevenlabs',
      previewUrl: v.preview_url
    })));
  } catch {
    return json({ error: 'Voix indisponibles pour le moment.' }, 503);
  }
}
