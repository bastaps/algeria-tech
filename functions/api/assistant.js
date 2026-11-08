// ── Cloudflare Pages Function — /api/assistant ─────────────────────────────────
// Cerveau de l'Assistant Vocal (/assistant-vocal, page privée : session admin, voir _middleware.js).
//   mode « chat »      : répond à l'oral, en phrases courtes, appuyé sur les articles d'Algeria Tech et la revue du jour.
//   mode « traduire »  : traduit une réponse déjà prête en arabe ou en derja algérienne (pour la synthèse vocale arabe).
//   mode « redaction » : met en forme une dictée en article (JSON) — l'enregistrement en brouillon se fait via /api/admin/dictee.
// langue : fr (défaut) · ar (arabe standard) · derja (darija algérienne, écrite en arabe).
// Chaîne de repli identique à /api/debat : Mistral → Gemini → Groq.
// Clés : MISTRAL_API_KEY, GEMINI_API_KEY, GROQ_API_KEY (dashboard Pages, jamais dans le dépôt).
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

async function asset(request, env, path) {
  const url = new URL(path, request.url);
  const r = env.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

async function dernieresActus(request, env) {
  try {
    const data = await asset(request, env, '/articles-list.json');
    const list = Array.isArray(data) ? data : (data.articles || []);
    return list.slice(0, 25).map((a, i) =>
      `${i + 1}. [${a.date || ''}] (${a.categorie || ''}) ${a.titre || ''} — ${String(a.extrait || '').slice(0, 220)}`
    ).join('\n');
  } catch { return ''; }
}

async function revueDuJour(request, env) {
  try {
    const d = await asset(request, env, '/revue_presse.json');
    const titres = (d.articles || []).slice(0, 12).map((a, i) => `${i + 1}. ${a.titre || ''} (${a.source || ''})`).join('\n');
    return `Édition du ${d.date || d.edition || ''}. Synthèse : ${String(d.synthese || '').slice(0, 700)}\n${titres}`;
  } catch { return ''; }
}

// Règles de langue communes (réponses et traductions destinées à une voix arabe).
const LANGUES = {
  fr: 'Réponds en français (ou dans la langue de l\'utilisateur s\'il parle autrement).',
  ar: `Réponds en arabe standard moderne, simple et clair, écrit en alphabet arabe.
Écris les noms de marques et d'opérateurs en arabe tels qu'on les prononce en Algérie (جيزي، موبيليس، أوريدو، اتصالات الجزائر) et les nombres en chiffres.`,
  derja: `Réponds en darija ALGÉRIENNE de tous les jours, écrite en alphabet arabe (pas en latin), comme on parle à Alger.
C'est de l'algérien, PAS du marocain : dis « واش », « راني », « بزاف », « شوية », « درك », « نتاع », « مليح », « لازم ». Jamais « بغيت », « ديال », « مزيان », « دابا ».
Garde les mots français usuels que les Algériens disent tels quels, écrits en arabe (الريزو، الكونيكسيون، الفورفي، الطابليت).
Écris les noms de marques comme on les prononce (جيزي، موبيليس، أوريدو، اتصالات الجزائر) et les nombres en chiffres.`
};

async function callLLM(env, messages, { max_tokens = 260, temperature = 0.4 } = {}) {
  const sys = messages.find(m => m.role === 'system')?.content || '';
  const conv = messages.filter(m => m.role !== 'system');
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
      body: JSON.stringify({ model: 'mistral-small-latest', messages, max_tokens, temperature })
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
        systemInstruction: { parts: [{ text: sys }] },
        contents: conv.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: max_tokens + 240, temperature }
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
      body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages, max_tokens: max_tokens + 640, temperature, reasoning_effort: 'low' })
    });
    const j = await r.json();
    if (j.error || !r.ok) throw new Error('groq ' + r.status);
    return j.choices?.[0]?.message?.content;
  });
  for (const call of providers) {
    try {
      const out = String(await withTimeout(15000, call) || '').trim();
      if (out) return out;
    } catch { /* fournisseur suivant */ }
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Requête invalide.' }, 400); }

  if (!env.MISTRAL_API_KEY && !env.GEMINI_API_KEY && !env.GROQ_API_KEY)
    return json({ error: 'Service IA non configuré.' }, 503);

  const mode = ['traduire', 'redaction'].includes(body?.mode) ? body.mode : 'chat';
  const langue = LANGUES[body?.langue] ? body.langue : 'fr';
  const message = String(body?.message || '').trim().substring(0, mode === 'chat' ? 500 : 6000);
  if (!message) return json({ error: 'Message vide.' }, 400);
  const now = new Date(Date.now() + 3600 * 1000); // heure d'Alger (UTC+1)

  // ── Traduction d'une réponse prête (listes de titres, météo, prières…) ──
  if (mode === 'traduire') {
    const out = await callLLM(env, [
      { role: 'system', content: `Tu traduis un texte destiné à être LU À VOIX HAUTE. ${LANGUES[langue === 'fr' ? 'ar' : langue]}
Traduis fidèlement, sans rien ajouter ni retirer, en gardant la numérotation et les retours à la ligne. Ne mets aucun commentaire, aucune note, aucun markdown : uniquement la traduction.` },
      { role: 'user', content: message }
    ], { max_tokens: 900, temperature: 0.2 });
    return out ? json({ reponse: out.replace(/[*#_`]/g, '') }) : json({ error: 'Traduction indisponible.' }, 503);
  }

  // ── Dictée → article structuré (JSON) ──
  if (mode === 'redaction') {
    const dateFr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const out = await callLLM(env, [
      { role: 'system', content: `Tu es secrétaire de rédaction d'Algeria Tech (télécoms, numérique, IA, startups, économie en Algérie).
On te donne des notes DICTÉES à la voix (ponctuation approximative, répétitions, mots mal reconnus). Transforme-les en article de presse.
RÈGLES : français journalistique sobre et clair ; corrige les mots manifestement mal reconnus (ex. « jazzy » → Djezzy, « mobile is » → Mobilis) ; pas d'emojis.
⛔ ZÉRO INVENTION, c'est la règle la plus importante : chaque information de l'article doit venir des notes. N'ajoute AUCUN chiffre, nom, lieu, date, citation, ni AUCUNE phrase de contexte, de perspective, de stratégie, de suite annoncée ou de conclusion générale qui ne figure pas dans les notes. Tu peux seulement reformuler, ordonner et relier ce qui est dit.
La longueur suit la matière : des notes courtes donnent un article court (2 ou 3 paragraphes suffisent). Ne délaie jamais.
Le corps commence par « Alger, ${dateFr} (Algeria Tech) — », puis les paragraphes ; ajoute un intertitre markdown « ## » seulement s'il y a au moins 4 paragraphes.
Réponds UNIQUEMENT avec un objet json valide, sans texte autour :
{"titre": "titre informatif de 60 à 110 caractères", "categorie": "une parmi Télécoms, Mobile, IA, Startups, Innovation, Entreprises, Algérie, Monde, Fintech", "extrait": "chapeau de 1 à 2 phrases (max 260 caractères)", "tags": ["3 à 6 mots-clés"], "corps": "texte markdown"}` },
      { role: 'user', content: message }
    ], { max_tokens: 1400, temperature: 0.3 });
    if (!out) return json({ error: 'Rédaction indisponible.' }, 503);
    try {
      const art = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
      if (!art.titre || !art.corps) throw new Error('incomplet');
      return json({ article: art });
    } catch { return json({ error: 'La rédaction a échoué, réessayez.' }, 502); }
  }

  // ── Conversation ──
  const hist = (Array.isArray(body?.historique) ? body.historique.slice(-8) : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ role: m.role, content: String(m.content).substring(0, 600) }));
  const [actus, revue] = await Promise.all([dernieresActus(request, env), revueDuJour(request, env)]);
  const sysMsg =
`Tu es l'assistant vocal d'Algeria Tech, un média algérien consacré aux télécoms, au numérique, à l'IA et à l'économie.
Date et heure à Alger : ${now.toISOString().slice(0, 16).replace('T', ' ')}.
Ta réponse sera LUE À VOIX HAUTE par une synthèse vocale :
- 1 à 4 phrases courtes, naturelles, comme à l'oral. Va droit au but.
- Aucun markdown, aucune liste, aucun emoji, aucune URL, pas de parenthèses inutiles.
- Écris les sigles prononçables tels quels (ARPCE, 5G, Djezzy) et les nombres simplement.
${LANGUES[langue]}
${body?.conduite ? "⚠️ L'utilisateur CONDUIT et t'écoute sans regarder l'écran : réponds en 1 ou 2 phrases courtes maximum, sans énumération ni chiffres superflus. Propose d'en dire plus seulement si c'est utile.\n" : ''}Pour toute question d'actualité, appuie-toi d'abord sur les articles d'Algeria Tech et la revue de presse ci-dessous et cite le titre. Si l'information n'y est pas et que tu n'es pas sûr, dis-le honnêtement plutôt que d'inventer.
${actus ? `\n=== DERNIERS ARTICLES ALGERIA TECH ===\n${actus}\n=== FIN ===` : ''}${revue ? `\n=== REVUE DE PRESSE DU JOUR (autres médias) ===\n${revue}\n=== FIN ===` : ''}`;

  const out = await callLLM(env, [{ role: 'system', content: sysMsg }, ...hist, { role: 'user', content: message }], { max_tokens: body?.conduite ? 160 : 260 });
  return out ? json({ reponse: out.replace(/[*#_`]/g, '').trim() }) : json({ error: 'Service IA momentanément indisponible.' }, 503);
}
