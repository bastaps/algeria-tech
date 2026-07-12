// ── Cloudflare Pages Function — /api/synthese ──────────────────────────────────
// Backend « edge » pour la « Synthèse IA » (résumé en points clés) sur pages.dev.
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

  const { titre, contenu, lang } = body || {};
  if (!contenu || contenu.length < 80)
    return json({ error: 'Article trop court pour une synthèse.' }, 400);

  const langue = lang === 'ar' ? 'arabe' : 'français';
  const prompt =
`Tu es un journaliste expert. Fais une synthèse concise de cet article en ${langue} en maximum 5 points clés.
Chaque point = 1 phrase courte (max 25 mots), précise, factuelle.
Réponds UNIQUEMENT en JSON pur : { "points": ["...", "...", "..."] }

TITRE : ${(titre || '').substring(0, 120)}
ARTICLE : ${contenu.substring(0, 3500)}`;

  try {
    const apiRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.15,
        max_tokens: 400
      })
    });

    const result = await apiRes.json();
    if (result.error) throw new Error(result.error.message || 'Erreur Mistral');
    const parsed = JSON.parse(result.choices[0].message.content);
    if (!Array.isArray(parsed.points) || parsed.points.length === 0)
      throw new Error('Format inattendu');
    return json({ points: parsed.points.slice(0, 5) });
  } catch (e) {
    return json({ error: "Service IA momentanément indisponible, réessayez dans un instant." }, 503);
  }
}
