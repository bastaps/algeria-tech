// POST /api/youtube-upload-file — l'envoi d'un fichier vers YouTube n'est possible que depuis le Hub local (jeton OAuth du PC).
// En ligne : réponse claire (au lieu d'une page vide) ; Smart Ingest PRO héberge alors la vidéo directement sur le site.
import { json, requireAdmin } from '../_lib/admin.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  return json({
    error: "L'envoi vers YouTube n'est pas disponible en ligne",
    hint: 'la vidéo sera hébergée directement sur le site (22 Mo max)',
  }, 501);
}
