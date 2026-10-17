// /api/admin/drafts — brouillons d'articles préparés par le workflow « brouillons ».
//   GET                      liste (titre, extrait, catégorie, source…)
//   POST   {id}              publie tel quel (brouillons/<id>.md → articles/<id>.md)
//   DELETE ?id=<id>          rejette / supprime le brouillon
// Session admin obligatoire ; jeton GitHub côté serveur uniquement.
import { json, requireAdmin, ghGet, ghText, ghPut, ghDelete } from '../../_lib/admin.js';

const idOk = (id) => /^[0-9]{6,20}$/.test(String(id || ''));
const champ = (md, k) => {
  const m = md.match(new RegExp('^' + k + ':[ \\t]*(.*)$', 'm'));
  return m ? m[1].trim().replace(/^"|"$/g, '').replace(/\\"/g, '"') : '';
};

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  try {
    const dir = await ghGet(env, 'brouillons');
    const files = (Array.isArray(dir) ? dir : []).filter(f => f.name.endsWith('.md')).sort((a, b) => b.name.localeCompare(a.name)).slice(0, 40);
    const out = [];
    for (const f of files) {
      const md = await ghText(env, 'brouillons/' + f.name);
      if (!md) continue;
      const corps = md.replace(/^---[\s\S]*?\n---\s*/, '');
      out.push({
        id: f.name.replace('.md', ''), titre: champ(md, 'titre'), extrait: champ(md, 'extrait'),
        categorie: champ(md, 'categorie'), source: champ(md, 'source'), image: champ(md, 'image_suggeree'),
        mots: corps.split(/\s+/).filter(Boolean).length
      });
    }
    return json({ brouillons: out });
  } catch (e) {
    return json({ error: e.message || 'Erreur serveur' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  try {
    const { id } = await request.json();
    if (!idOk(id)) return json({ error: 'Identifiant invalide.' }, 400);
    const md = await ghText(env, `brouillons/${id}.md`);
    if (!md) return json({ error: 'Brouillon introuvable.' }, 404);
    const publie = md.replace(/^image_suggeree:.*\n/m, '').replace(/^brouillon:.*\n/m, '');
    await ghPut(env, `articles/${id}.md`, publie, 'Admin : publication du brouillon ' + id);
    await ghDelete(env, `brouillons/${id}.md`, 'Admin : brouillon publié ' + id);
    return json({ success: true });
  } catch (e) {
    return json({ error: e.message || 'Erreur serveur' }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!idOk(id)) return json({ error: 'Identifiant invalide.' }, 400);
  try {
    await ghDelete(env, `brouillons/${id}.md`, 'Admin : brouillon rejeté ' + id);
    return json({ success: true });
  } catch (e) {
    return json({ error: e.message || 'Erreur serveur' }, 500);
  }
}
