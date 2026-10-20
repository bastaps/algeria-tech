// Toute route /api/* qui n'existe pas en ligne : réponse JSON explicite (au lieu d'une page vide ou HTML, d'où les
// « Unexpected end of JSON input » de Smart Ingest PRO). Ces fonctions-là ne tournent que sur le Hub local (localhost:3000) :
// carte interactive, lecture de PDF, extraction/envoi de vidéos, déploiement ciblé, etc.
// Les routes réelles (fetch-url, smart-generate, create-article…) ont leur propre fichier et passent avant celle-ci.
export async function onRequest() {
  return new Response(JSON.stringify({
    error: "Cette fonction n'est disponible que sur le Hub local (localhost:3000), pas en ligne.",
    message: "Cette fonction n'est disponible que sur le Hub local (localhost:3000), pas en ligne.",
  }), { status: 501, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
