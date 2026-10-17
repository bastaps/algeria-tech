// DELETE /api/delete-article/:id — suppression EN LIGNE (session admin obligatoire).
import { json, requireAdmin, ghDelete } from '../../_lib/admin.js';

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  const id = String(params.id || '');
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return json({ message: 'Identifiant invalide.' }, 400);
  try {
    const ok = await ghDelete(env, `articles/${id}.md`, 'Admin : suppression ' + id);
    if (!ok) return json({ message: 'Article introuvable.' }, 404);
    await ghDelete(env, `interactifs/${id}.html`, 'Admin : suppression carte ' + id).catch(() => {});
    return json({ success: true });
  } catch (e) {
    return json({ message: e.message || 'Erreur serveur' }, 500);
  }
}
