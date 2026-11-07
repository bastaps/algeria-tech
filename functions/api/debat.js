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

  if (!env.MISTRAL_API_KEY && !env.GEMINI_API_KEY && !env.GROQ_API_KEY)
    return json({ error: "Service IA non configuré (clé API manquante)." }, 503);

  const { titre, contenu, historique, message, langue, longueur } = body || {};
  if (!message || !String(message).trim())
    return json({ error: 'Message vide.' }, 400);
  if (!contenu || contenu.length < 30)
    return json({ error: 'Contenu article trop court.' }, 400);

  // Longueur de réponse demandée par le lecteur (boutons Courte / Moyenne / Longue)
  const LONGUEURS = {
    courte:  { consigne: "Réponds TRÈS BRIÈVEMENT : 2 à 3 phrases maximum, va droit à l'essentiel, aucune introduction ni conclusion.", tokens: 200 },
    moyenne: { consigne: 'Réponds de façon MODÉRÉE : 1 à 2 paragraphes (environ 120 à 180 mots).', tokens: 500 },
    longue:  { consigne: 'Réponds de façon DÉTAILLÉE : 4 à 6 paragraphes développés, avec nuances, chiffres, contexte et mise en perspective.', tokens: 1500 }
  };
  const fmt = LONGUEURS[String(longueur || '').toLowerCase()] || LONGUEURS.moyenne;

  const lang   = langue || 'français';
  const sysMsg =
`Tu es un expert analyste en télécommunications, numérique et économie algérienne.
Tu as lu et analysé cet article en détail.
Réponds aux questions du lecteur en te basant sur l'article ET tes connaissances complémentaires.
Sois précis, factuel, nuancé. Développe les arguments avec rigueur.
Réponds en ${lang}. ${fmt.consigne}
Respecte strictement cette longueur, même si le lecteur pose une question large.
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

  // Chaîne de repli : Mistral → Gemini → Groq. Une limite de débit (429) ou une panne passe au suivant.
  // Clés : variables d'environnement Cloudflare MISTRAL_API_KEY, GEMINI_API_KEY, GROQ_API_KEY (jamais dans le dépôt).
  const withTimeout = (ms, fn) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fn(ctrl.signal).finally(() => clearTimeout(timer));
  };
  const providers = [];
  if (env.MISTRAL_API_KEY) providers.push(['mistral', async (signal) => {
    const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.MISTRAL_API_KEY}` },
      body: JSON.stringify({ model: 'mistral-small-latest', messages, max_tokens: fmt.tokens, temperature: 0.5 })
    });
    const j = await r.json();
    if (j.error || !r.ok) throw new Error('mistral ' + r.status);
    return j.choices?.[0]?.message?.content;
  }]);
  if (env.GEMINI_API_KEY) providers.push(['gemini', async (signal) => {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sysMsg }] },
        contents: [...hist, { role: 'user', content: String(message).trim().substring(0, 500) }]
          .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] })),
        generationConfig: { maxOutputTokens: fmt.tokens + 300, temperature: 0.5 }
      })
    });
    const j = await r.json();
    if (j.error || !r.ok) throw new Error('gemini ' + r.status);
    return j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
  }]);
  if (env.GROQ_API_KEY) providers.push(['groq', async (signal) => {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'User-Agent': 'Mozilla/5.0 (compatible; AlgeriaTech/1.0)' },
      body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages, max_tokens: fmt.tokens + 600, temperature: 0.5, reasoning_effort: 'low' })
    });
    const j = await r.json();
    if (j.error || !r.ok) throw new Error('groq ' + r.status);
    return j.choices?.[0]?.message?.content;
  }]);

  for (const [, call] of providers) {
    try {
      const reponse = await withTimeout(15000, call);
      if (reponse && String(reponse).trim()) return json({ reponse: String(reponse).trim() });
    } catch (e) { /* fournisseur suivant */ }
  }
  return json({ error: "Service IA momentanément indisponible, réessayez dans un instant." }, 503);
}
