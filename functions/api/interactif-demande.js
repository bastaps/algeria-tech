// POST /api/interactif-demande — demande de génération d'une carte interactive EN LIGNE (Smart Ingest PRO).
// La carte est produite par le moteur Article Interactif (Python) sur GitHub Actions : cette fonction dépose la demande
// (interactifs/_demandes/<job>.json) qui déclenche le workflow « interactif.yml » ; l'état se lit via /api/interactif-statut.
// Corps : { generer: {corps de /api/generate}, extra_visuals?: "<html>" }. Session admin obligatoire.
import { json, requireAdmin, ghPut } from '../_lib/admin.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  let corps;
  try {
    const brut = await request.text();
    if (brut.length > 400 * 1024) return json({ message: 'Demande trop volumineuse.' }, 413);
    corps = JSON.parse(brut);
  } catch { return json({ message: 'Requête invalide.' }, 400); }
  const g = corps && corps.generer;
  if (!g || typeof g !== 'object' || String(g.text || '').trim().length < 80) return json({ message: "Texte de l'article trop court." }, 400);
  const job = 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const demande = { job, generer: g, extra_visuals: typeof corps.extra_visuals === 'string' ? corps.extra_visuals.slice(0, 200000) : '' };
  try {
    await ghPut(env, `interactifs/_demandes/${job}.json`, JSON.stringify(demande), 'Demande de carte interactive ' + job);
    return json({ success: true, job });
  } catch (e) {
    return json({ message: e.message || 'Erreur serveur' }, 500);
  }
}
