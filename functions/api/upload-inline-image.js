// POST /api/upload-inline-image — photo insérée dans le corps d'un article, EN LIGNE.
import { json, requireAdmin, ghPut } from '../_lib/admin.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  try {
    const f = await request.formData();
    const file = f.get('photo');
    if (!file || typeof file !== 'object' || !file.size) return json({ message: 'Aucune image reçue.' }, 400);
    if (file.size > 12 * 1024 * 1024) return json({ message: 'Image trop lourde (12 Mo max).' }, 413);
    const ext = (file.name.match(/\.(jpe?g|png|gif|webp|avif)$/i) || ['', 'jpg'])[1].toLowerCase();
    const name = `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await ghPut(env, `images/${name}`, await file.arrayBuffer(), 'Admin : photo inline');
    return json({ success: true, url: `/images/${name}` });
  } catch (e) {
    return json({ message: e.message || 'Erreur serveur' }, 500);
  }
}
