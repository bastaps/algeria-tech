// ── Cloudflare Pages Function — /api/debat ─────────────────────────────────────
// Backend « edge » pour la fonctionnalité « Débattre avec l'IA » sur pages.dev
// (l'hébergement Pages est statique : ce fichier fournit le backend manquant).
// Clé Mistral : variable d'environnement Cloudflare `MISTRAL_API_KEY` UNIQUEMENT
// (à définir dans le dashboard Pages → Settings → Environment variables).
// Pas de clé en dur : ce dépôt est public.
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Requête invalide.' }, 400); }

  if (!env.MISTRAL_API_KEY)
    return json({ error: "Service IA non configuré (clé API manquante)." }, 503);

  const { titre, contenu, historique, message, langue } = body || {};
  if (!message || !String(message).trim())
    return json({ error: 'Message vide.' }, 400);
  if (!contenu || contenu.length < 30)
    return json({ error: 'Contenu article trop court.' }, 400);

  const lang   = langue || 'français';
  const sysMsg =
`Tu es un expert analyste en télécommunications, numérique et économie algérienne.
Tu as lu et analysé cet article en détail.
Réponds aux questions du lecteur en te basant sur l'article ET tes connaissances complémentaires.
Sois précis, factuel, nuancé. Développe les arguments avec rigueur.
Réponds en ${lang}. Limite tes réponses à 3-4 paragraphes maximum sauf si la question demande plus de détail.
N'utilise pas de mise en forme markdown (pas de **, pas de #).

=== ARTICLE ===
TITRE : ${String(titre || '').substring(0, 200)}

${String(contenu || '').substring(0, 4200)}
=== FIN ARTICLE ===`;

  const hist     = Array.isArray(historique) ? historique.slice(-8) : [];
  const messages = [
    { role: 'system', content: sysMsg },
    ...hist,
    { role: 'user',   content: String(message).trim().substring(0, 500) }
  ];

  try {
    const apiRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        max_tokens: 700,
        temperature: 0.5
      })
    });

    const result = await apiRes.json();
    if (result.error) throw new Error(result.error.message || 'Erreur Mistral');
    const reponse = result.choices?.[0]?.message?.content;
    if (!reponse) throw new Error('Réponse Mistral vide');
    return json({ reponse });
  } catch (e) {
    return json({ error: "Service IA momentanément indisponible, réessayez dans un instant." }, 503);
  }
}
