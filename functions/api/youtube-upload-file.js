// POST /api/youtube-upload-file — envoie une vidéo sur YouTube EN LIGNE (Smart Ingest PRO) et renvoie son adresse.
// Secrets Cloudflare requis (mêmes valeurs que le .env du Hub local) : YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN.
// Sans eux : 501, et la page héberge alors la vidéo directement sur le site (22 Mo max).
// multipart : video (fichier), privacy? (unlisted par défaut), title?, description?. Session admin obligatoire.
import { json, requireAdmin } from '../_lib/admin.js';

const MAX = 90 * 1024 * 1024;   // mémoire d'une fonction Cloudflare : au-delà, passer par le Hub local

async function accessToken(env) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET,
      refresh_token: env.YOUTUBE_REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) {
    const e = new Error(d.error_description || d.error || 'Jeton YouTube refusé');
    e.expire = /invalid_grant|expired|revoked/i.test(String(d.error || '') + String(d.error_description || ''));
    throw e;
  }
  return d.access_token;
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REFRESH_TOKEN) {
    return json({ error: "L'envoi vers YouTube n'est pas configuré en ligne",
      hint: 'ajoutez YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET et YOUTUBE_REFRESH_TOKEN dans Cloudflare ; en attendant, la vidéo est hébergée sur le site' }, 501);
  }
  try {
    const f = await request.formData();
    const file = f.get('video');
    if (!file || typeof file !== 'object' || !file.size) return json({ error: 'Aucune vidéo reçue.' }, 400);
    if (file.size > MAX) return json({ error: `Vidéo trop lourde pour l'envoi en ligne (${(file.size / 1048576).toFixed(0)} Mo ; 90 Mo max).`,
      hint: 'envoyez-la depuis le Hub local' }, 413);
    const priv = ['public', 'unlisted', 'private'].includes(String(f.get('privacy'))) ? String(f.get('privacy')) : 'unlisted';
    const titre = String(f.get('title') || 'Algeria Tech — vidéo').slice(0, 95);
    const type = file.type && file.type.startsWith('video/') ? file.type : 'video/mp4';
    const token = await accessToken(env);
    const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(file.size) },
      body: JSON.stringify({
        snippet: { title: titre, description: String(f.get('description') || 'Vidéo publiée avec Algeria Tech.').slice(0, 4000), tags: ['Algeria Tech', 'Algérie', 'TIC'], categoryId: '25' },
        status: { privacyStatus: priv, selfDeclaredMadeForKids: false, embeddable: true },
      }),
    });
    if (!init.ok) {
      const t = await init.text();
      const quota = /quotaExceeded|dailyLimitExceeded/i.test(t);
      return json({ error: quota ? 'Quota YouTube du jour atteint' : 'YouTube a refusé la vidéo (' + init.status + ')',
        hint: quota ? 'la vidéo sera hébergée sur le site' : t.slice(0, 160) }, quota ? 429 : 502);
    }
    const lieu = init.headers.get('Location');
    if (!lieu) return json({ error: "YouTube n'a pas ouvert la session d'envoi" }, 502);
    const up = await fetch(lieu, { method: 'PUT', headers: { 'Content-Type': type }, body: await file.arrayBuffer() });
    const res = await up.json().catch(() => ({}));
    if (!up.ok || !res.id) return json({ error: "L'envoi vers YouTube a échoué (" + up.status + ')' }, 502);
    return json({ success: true, videoId: res.id, youtubeUrl: `https://www.youtube.com/watch?v=${res.id}` });
  } catch (e) {
    return json({ error: e.expire ? 'Autorisation YouTube expirée' : (e.message || 'Erreur serveur'),
      hint: e.expire ? "régénérez le jeton (node get-youtube-token.js sur le PC) puis mettez à jour YOUTUBE_REFRESH_TOKEN ; l'application Google doit être en « Production » pour que le jeton ne s'expire plus tous les 7 jours" : undefined },
      e.expire ? 401 : 500);
  }
}
