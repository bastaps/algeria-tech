// ── Cloudflare Pages Function — /api/stt ───────────────────────────────────────
// Transcription de la voix pour l'Assistant Vocal « Basta Info » (page privée, session admin via _middleware.js).
// Pourquoi : la reconnaissance vocale de Google sur Android émet un BIP à chaque relance du micro, plusieurs fois
// par minute en mode conduite. L'application écoute donc elle-même le micro en continu (sans relance, sans bip),
// découpe les phrases et les envoie ici. Moteur : Cloudflare Workers AI (binding `AI`, offre gratuite), Whisper.
// Corps : audio WAV brut (16 kHz mono). En-tête X-Langue : fr | ar | derja.
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// Vocabulaire du site : aide Whisper à bien écrire les noms propres.
const VOCAB = 'Algeria Tech, Basta Info, Djezzy, Mobilis, Ooredoo, Algérie Télécom, ARPCE, 5G, fibre, revue de presse, briefing, météo, Maghreb, Fajr, Dohr, Asr, Icha.';
// Phrases que Whisper « invente » sur du bruit ou du silence.
const HALLU = /(sous-titr|amara\.org|merci d'avoir regard|abonnez-vous|n'oubliez pas de vous abonner|thank you for watching|♪|\[musique\]|\[music\]|transcrit par|اشتركوا في القناة|ترجمة نانسي)/i;

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: 'Transcription non configurée (binding AI absent).' }, 503);
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.length < 4000) return json({ text: '' });
  if (buf.length > 1500000) return json({ error: 'Audio trop long.' }, 413);
  const lang = request.headers.get('X-Langue') === 'fr' ? 'fr' : 'ar';
  let b64 = '';
  for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  b64 = btoa(b64);
  let text = '';
  try {
    const r = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: b64, task: 'transcribe', language: lang, vad_filter: true, initial_prompt: lang === 'fr' ? VOCAB : undefined });
    text = String(r?.text || '');
  } catch {
    try { const r = await env.AI.run('@cf/openai/whisper', { audio: [...buf] }); text = String(r?.text || ''); }
    catch { return json({ error: 'Transcription indisponible.' }, 503); }
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (HALLU.test(text) || !/[\p{L}\p{N}]/u.test(text)) text = '';
  return json({ text });
}
