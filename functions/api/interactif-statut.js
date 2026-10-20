// GET /api/interactif-statut?job=<id> — état d'une carte interactive demandée en ligne.
// { etat: 'en_cours' } · { etat: 'pret', data, html } (le résultat est supprimé du dépôt après lecture) · { etat: 'echec', message }.
import { json, requireAdmin, ghGet, ghDelete, OWNER, REPO } from '../_lib/admin.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  const job = new URL(request.url).searchParams.get('job') || '';
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(job)) return json({ message: 'Identifiant de demande invalide.' }, 400);
  const chemin = `interactifs/_apercus/${job}.json`;
  try {
    const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${chemin}?ref=main`, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.raw+json', 'User-Agent': 'algeria-tech-admin' },
    });
    if (r.ok) {
      const res = JSON.parse(await r.text());
      ghDelete(env, chemin, 'Carte interactive lue ' + job).catch(() => {});
      return json(res);
    }
    if (r.status !== 404) return json({ etat: 'en_cours' });
    const demande = await ghGet(env, `interactifs/_demandes/${job}.json`);
    return json(demande ? { etat: 'en_cours' } : { etat: 'echec', message: 'Demande introuvable (expirée ou déjà lue).' });
  } catch (e) {
    return json({ etat: 'en_cours' });
  }
}
