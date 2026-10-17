// POST /api/interactif — carte interactive d'un article (interactifs/<id>.html), EN LIGNE.
import { json, requireAdmin, ghPut } from '../_lib/admin.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  try {
    const { id, html } = await request.json();
    if (!id || !/^[A-Za-z0-9_-]+$/.test(String(id))) return json({ message: "Identifiant d'article invalide." }, 400);
    if (!html || typeof html !== 'string' || html.length < 50) return json({ message: 'Contenu HTML manquant.' }, 400);
    if (html.length > 6 * 1024 * 1024) return json({ message: 'Carte trop volumineuse.' }, 413);
    await ghPut(env, `interactifs/${id}.html`, html, 'Admin : carte interactive ' + id);
    return json({ success: true, url: `/interactifs/${id}.html` });
  } catch (e) {
    return json({ message: e.message || 'Erreur serveur' }, 500);
  }
}
