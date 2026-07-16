// ── Cloudflare Pages Function — /api/tts ──────────────────────────────────────
// Synthèse vocale premium pour « CV Parlé » : proxy vers ElevenLabs.
// Portage de app.post('/api/tts') de cv-massar/workspace/server.js (Express).
// La page appelle cet endpoint UNIQUEMENT si /api/health annonce elevenlabs:true ;
// sinon elle parle avec la voix du navigateur. Cet endpoint reste donc optionnel.
// Clé : variable `ELEVENLABS_API_KEY` (dashboard Pages). Jamais en dur.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Requête invalide.' }, 400); }

  const { text, provider, voiceId } = body || {};
  if (!text || !voiceId) return json({ error: 'text et voiceId requis' }, 400);
  if (String(text).length > 5000) return json({ error: 'Texte trop long (max 5000 caractères)' }, 400);
  if (provider !== 'elevenlabs') return json({ error: 'provider requis : elevenlabs' }, 400);

  if (!env.ELEVENLABS_API_KEY)
    return json({ error: 'ELEVENLABS_API_KEY non configurée' }, 503);

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: String(text),
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true }
        })
      }
    );

    if (!r.ok) {
      const errText = await r.text();
      return json({ error: `ElevenLabs: ${errText.slice(0, 200)}` }, r.status);
    }

    // On relaie le flux audio tel quel : pas de Buffer côté Workers.
    return new Response(r.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch {
    return json({ error: 'Synthèse vocale momentanément indisponible.' }, 503);
  }
}
