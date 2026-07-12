// ── Cloudflare Pages Function — /api/youtube ───────────────────────────────────
// Proxy edge pour lister les dernières vidéos de la chaîne YouTube Algeria Tech.
// La clé API reste côté serveur (env.YOUTUBE_API_KEY) et ne fuite plus dans le
// JavaScript client. Le channelId est public (non secret).
const CHANNEL_ID = 'UCyIYnT60oAg8iVZKoz8seAA';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600' // 10 min : économise le quota YouTube
    }
  });

export async function onRequestGet({ env }) {
  if (!env.YOUTUBE_API_KEY)
    return json({ error: { message: 'Service vidéos non configuré (clé API manquante).', code: 503 } }, 503);

  const url = `https://www.googleapis.com/youtube/v3/search?key=${env.YOUTUBE_API_KEY}` +
              `&channelId=${CHANNEL_ID}&part=snippet,id&order=date&maxResults=12&type=video`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    return json(data, res.ok ? 200 : (data.error?.code || 502));
  } catch (e) {
    return json({ error: { message: 'Erreur de connexion avec YouTube.', code: 502 } }, 502);
  }
}
