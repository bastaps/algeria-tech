// ── Cloudflare Pages Function — /api/health ───────────────────────────────────
// Indique à « CV Parlé » quels moteurs de synthèse vocale sont disponibles.
// La page interroge cet endpoint au chargement : si elevenlabs est faux, elle
// bascule d'elle-même sur la voix du navigateur (speechSynthesis).
// Aucune clé n'est exposée ici : on ne renvoie qu'un booléen de présence.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

export async function onRequestGet({ env }) {
  return json({
    ok: true,
    elevenlabs: !!env.ELEVENLABS_API_KEY,
    // Azure n'est pas porté : la clé n'a jamais été renseignée côté projet.
    azure: false,
    azureRegion: null
  });
}
