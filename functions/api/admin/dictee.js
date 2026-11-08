// /api/admin/dictee — enregistre en BROUILLON un article dicté à l'Assistant Vocal.
//   POST {titre, categorie, extrait, tags[], corps}  →  brouillons/<id>.md (jamais publié automatiquement :
//   pas de « circuit: true », donc publier_choix.py l'ignore ; il attend dans /admin-brouillons).
// Session admin obligatoire ; jeton GitHub côté serveur uniquement.
import { json, requireAdmin, ghPut } from '../../_lib/admin.js';

const q = (s) => '"' + String(s || '').replace(/\r?\n/g, ' ').replace(/"/g, '\\"').trim() + '"';

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  let a;
  try { a = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const titre = String(a?.titre || '').trim().slice(0, 200);
  const corps = String(a?.corps || '').trim().slice(0, 20000);
  if (titre.length < 10 || corps.length < 80) return json({ error: 'Article trop court.' }, 400);
  const tags = (Array.isArray(a.tags) ? a.tags : []).map(t => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 8);
  const id = String(Date.now());
  const alger = new Date(Date.now() + 3600 * 1000).toISOString();
  const md = `---
titre: ${q(titre)}
categorie: ${String(a.categorie || 'Algérie').replace(/[\r\n:]/g, ' ').trim().slice(0, 40)}
date: ${alger.slice(0, 10)}
heure: ${alger.slice(11, 16)}
image: ""
pdf: ""
video: ""
source: "Dictée vocale (Assistant Algeria Tech)"
extrait: ${q(String(a.extrait || '').slice(0, 400))}
tags: ${JSON.stringify(tags)}
type:
position:
brouillon: true
cree: "${new Date().toISOString().slice(0, 19)}Z"
---

${corps}
`;
  try {
    await ghPut(env, `brouillons/${id}.md`, md, 'Assistant vocal : brouillon dicté ' + id);
    return json({ success: true, id });
  } catch (e) {
    return json({ error: e.message || 'Erreur serveur' }, 500);
  }
}
