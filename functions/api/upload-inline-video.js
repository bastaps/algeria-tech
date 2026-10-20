// POST /api/upload-inline-video — vidéo déposée dans Smart Ingest PRO, hébergée sur le site EN LIGNE (videos/articles/…).
// Limite : 22 Mo (un fichier statique Cloudflare Pages ne peut pas dépasser 25 Mo). Au-delà : lien YouTube ou Hub local.
import { json, requireAdmin, ghPut } from '../_lib/admin.js';

const MAX = 22 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  try {
    const f = await request.formData();
    const file = f.get('video');
    if (!file || typeof file !== 'object' || !file.size) return json({ message: 'Aucune vidéo reçue.' }, 400);
    if (file.size > MAX) {
      return json({ message: `Vidéo trop lourde pour l'hébergement en ligne (${(file.size / 1048576).toFixed(0)} Mo ; 22 Mo max). ` +
        'Compressez-la, collez un lien YouTube, ou envoyez-la depuis le Hub local.' }, 413);
    }
    const m = String(file.name || '').toLowerCase().match(/\.(mp4|webm|mov|m4v)$/);
    const ext = m ? m[1] : 'mp4';
    const name = `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await ghPut(env, `videos/articles/${name}`, await file.arrayBuffer(), 'Admin : vidéo ' + name);
    return json({ success: true, url: `/videos/articles/${name}` });
  } catch (e) {
    return json({ message: e.message || 'Erreur serveur' }, 500);
  }
}
