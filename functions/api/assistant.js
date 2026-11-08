// ── Cloudflare Pages Function — /api/assistant ─────────────────────────────────
// Cerveau de l'Assistant Vocal (/assistant-vocal) : répond à l'oral, en phrases courtes,
// en s'appuyant sur les dernières actualités publiées sur Algeria Tech (articles-list.json).
// Chaîne de repli identique à /api/debat : Mistral → Gemini → Groq.
// Clés : MISTRAL_API_KEY, GEMINI_API_KEY, GROQ_API_KEY (dashboard Pages, jamais dans le dépôt).
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

async function dernieresActus(request, env) {
  try {
    const url = new URL('/articles-list.json', request.url);
    const r = env.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);
    if (!r.ok) return '';
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data.articles || []);
    return list.slice(0, 25).map((a, i) =>
      `${i + 1}. [${a.date || ''}] (${a.categorie || ''}) ${a.titre || ''} — ${String(a.extrait || '').slice(0, 220)}`
    ).join('\n');
  } catch { return ''; }
}

async function revueDuJour(request, env) {
  try {
    const url = new URL('/revue_presse.json', request.url);
    const r = env.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);
    if (!r.ok) return '';
    const d = await r.json();
    const titres = (d.articles || []).slice(0, 12).map((a, i) => `${i + 1}. ${a.titre || ''} (${a.source || ''})`).join('\n');
    return `Édition du ${d.date || d.edition || ''}. Synthèse : ${String(d.synthese || '').slice(0, 700)}\n${titres}`;
  } catch { return ''; }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Requête invalide.' }, 400); }

  if (!env.MISTRAL_API_KEY && !env.GEMINI_API_KEY && !env.GROQ_API_KEY)
    return json({ error: 'Service IA non configuré.' }, 503);

  const message = String(body?.message || '').trim().substring(0, 500);
  if (!message) return json({ error: 'Message vide.' }, 400);
  const hist = (Array.isArray(body?.historique) ? body.historique.slice(-8) : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ role: m.role, content: String(m.content).substring(0, 600) }));

  const [actus, revue] = await Promise.all([dernieresActus(request, env), revueDuJour(request, env)]);
  const now = new Date(Date.now() + 3600 * 1000); // heure d'Alger (UTC+1)
  const sysMsg =
`Tu es l'assistant vocal d'Algeria Tech, un média algérien consacré aux télécoms, au numérique, à l'IA et à l'économie.
Date et heure à Alger : ${now.toISOString().slice(0, 16).replace('T', ' ')}.
Ta réponse sera LUE À VOIX HAUTE par une synthèse vocale :
- 1 à 4 phrases courtes, naturelles, comme à l'oral. Va droit au but.
- Aucun markdown, aucune liste, aucun emoji, aucune URL, pas de parenthèses inutiles.
- Écris les sigles prononçables tels quels (ARPCE, 5G, Djezzy) et les nombres simplement.
- Réponds dans la langue de l'utilisateur (français par défaut ; arabe ou anglais s'il parle ainsi).
Pour toute question d'actualité, appuie-toi d'abord sur les articles d'Algeria Tech ci-dessous et cite le titre. Si l'information n'y est pas et que tu n'es pas sûr, dis-le honnêtement plutôt que d'inventer.
${actus ? `\n=== DERNIERS ARTICLES ALGERIA TECH ===\n${actus}\n=== FIN ===` : ''}${revue ? `\n=== REVUE DE PRESSE DU JOUR (autres médias) ===\n${revue}\n=== FIN ===` : ''}`;

  const messages = [{ role: 'system', content: sysMsg }, ...hist, { role: 'user', content: message }];

  const withTimeout = (ms, fn) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fn(ctrl.signal).finally(() => clearTimeout(timer));
  };
  const providers = [];
  if (env.MISTRAL_API_KEY) providers.push(async (signal) => {
    const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.MISTRAL_API_KEY}` },
      body: JSON.stringify({ model: 'mistral-small-latest', messages, max_tokens: 260, temperature: 0.4 })
    });
    const j = await r.json();
    if (j.error || !r.ok) throw new Error('mistral ' + r.status);
    return j.choices?.[0]?.message?.content;
  });
  if (env.GEMINI_API_KEY) providers.push(async (signal) => {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sysMsg }] },
        contents: [...hist, { role: 'user', content: message }]
          .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: 500, temperature: 0.4 }
      })
    });
    const j = await r.json();
    if (j.error || !r.ok) throw new Error('gemini ' + r.status);
    return j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
  });
  if (env.GROQ_API_KEY) providers.push(async (signal) => {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'User-Agent': 'Mozilla/5.0 (compatible; AlgeriaTech/1.0)' },
      body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages, max_tokens: 900, temperature: 0.4, reasoning_effort: 'low' })
    });
    const j = await r.json();
    if (j.error || !r.ok) throw new Error('groq ' + r.status);
    return j.choices?.[0]?.message?.content;
  });

  for (const call of providers) {
    try {
      const out = await withTimeout(12000, call);
      const clean = String(out || '').replace(/[*#_`]/g, '').trim();
      if (clean) return json({ reponse: clean });
    } catch { /* fournisseur suivant */ }
  }
  return json({ error: 'Service IA momentanément indisponible.' }, 503);
}
