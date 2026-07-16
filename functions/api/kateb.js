// ── Cloudflare Pages Function — /api/kateb ─────────────────────────────────────
// « Kateb », l'écrivain public numérique de CV Massar El Mihani.
// Rédige des résumés / reformulations / conseils au STYLE HUMAIN (jamais « IA froide »).
// Clé Mistral : variable d'environnement Cloudflare `MISTRAL_API_KEY` UNIQUEMENT
// (dashboard Pages → Settings → Environment variables). Aucune clé en dur (dépôt public).

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

// Règles de style communes à toutes les rédactions de Kateb.
const STYLE = `Tu es « Kateb », un écrivain public algérien chevronné qui rédige des CV pour des gens de tous horizons (santé, BTP, commerce, administration, éducation, hôtellerie, industrie, numérique).
Tu écris un français professionnel, clair et digne, accessible à tous.

RÈGLES DE STYLE ABSOLUES — le texte ne doit JAMAIS ressembler à une réponse d'IA :
- Interdit : listes à puces, tirets en début de ligne, titres, emojis, guillemets décoratifs.
- Interdit : clichés creux (« passionné par », « fort de mon expérience », « doté d'un excellent relationnel », « dynamique et motivé », « force de proposition »).
- Interdit : superlatifs vides et auto-congratulation excessive.
- Écris en phrases pleines, de longueurs variées, avec un rythme naturel.
- Reste concret et ancré : gestes, tâches et méthodes du métier, réalisations précises.
- Fierté sobre et sincère, ton humain et professionnel. Pas de bla-bla.
- Réponds en français.

⛔ RÈGLE ABSOLUE — ZÉRO INVENTION (la plus importante) :
- N'invente JAMAIS de noms de villes, wilayas, pays, quartiers, employeurs, entreprises, établissements (écoles, lycées, hôpitaux…), de dates, de durées, de chiffres ni de diplômes.
- Utilise EXCLUSIVEMENT les lieux, employeurs et dates explicitement fournis dans les données. Si un lieu, un employeur ou une date n'est pas fourni, ne le mentionne pas du tout — n'en fabrique aucun, même « à titre d'exemple ».
- Tu peux enrichir UNIQUEMENT la description des tâches, responsabilités et méthodes liées au métier (ex. méthodes d'enseignement, préparation de cours). Reste strictement factuel sur le contexte géographique et temporel.`;

async function mistral(env, messages, { temperature = 0.7, max_tokens = 380 } = {}) {
  const apiRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages,
      temperature,
      max_tokens
    })
  });
  const result = await apiRes.json();
  if (result.error) throw new Error(result.error.message || 'Erreur Mistral');
  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Réponse vide');
  return content.trim();
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Requête invalide.' }, 400); }

  if (!env.MISTRAL_API_KEY)
    return json({ error: "Service IA non configuré (clé API manquante)." }, 503);

  const { mode, context = {} } = body || {};
  const job = (context.job || '').toString().slice(0, 120);
  const skills = Array.isArray(context.skills) ? context.skills.slice(0, 15).join(', ') : '';
  const name = (context.name || '').toString().slice(0, 80);

  try {
    // ── 1. Résumé professionnel à partir de 2-3 mots-clés ────────────────────
    if (mode === 'summary') {
      const keywords = (body.keywords || '').toString().slice(0, 400);
      const cvExtract = (body.cvExtract || '').toString().slice(0, 3000);
      const source = cvExtract
        ? `Voici des extraits du CV réel de la personne (utilise-les fidèlement) :\n"""\n${cvExtract}\n"""`
        : `Indices donnés par la personne : ${keywords || '(aucun)'}`;
      const user =
`Rédige un RÉSUMÉ PROFESSIONNEL pour un CV, en 3 à 4 phrases (60 à 90 mots), à la première personne sobre ou en style neutre professionnel.
Métier visé : ${job || '(déduis-le du CV)'}
Compétences connues : ${skills || '(aucune)'}
${source}
Synthétise le parcours réel de la personne. N'invente aucun lieu, employeur, date ni diplôme absent du texte. Écris un seul paragraphe, sans titre ni puce, humain, concret et fier, prêt à coller en haut d'un CV.`;
      const text = await mistral(env, [
        { role: 'system', content: STYLE },
        { role: 'user', content: user }
      ], { temperature: 0.75, max_tokens: 320 });
      return json({ text });
    }

    // ── 2. Reformulation d'un passage selon un ton ───────────────────────────
    if (mode === 'improve') {
      const text0 = (body.text || '').toString().slice(0, 1200);
      const tone = (body.tone || 'plus clair').toString().slice(0, 40);
      if (!text0) return json({ error: 'Aucun texte à reformuler.' }, 400);
      const user =
`Reformule ce passage de CV pour qu'il soit « ${tone} », sans changer les faits ni inventer.
Garde un seul paragraphe, style humain et professionnel, sans puce ni titre.

PASSAGE :
${text0}`;
      const text = await mistral(env, [
        { role: 'system', content: STYLE },
        { role: 'user', content: user }
      ], { temperature: 0.7, max_tokens: 340 });
      return json({ text });
    }

    // ── 2 bis. Champ contextuel (expérience / formation / aspiration) + style ─
    if (mode === 'field') {
      const field = (body.field || 'experience').toString();
      const style = (body.style || 'concise').toString();
      const keywords = (body.keywords || '').toString().slice(0, 500);
      if (!keywords) return json({ error: 'Aucun mot-clé fourni.' }, 400);
      const fieldLabel = field === 'experience' ? "une DESCRIPTION D'EXPÉRIENCE professionnelle (missions, responsabilités, réalisations)"
        : field === 'education' ? "une DESCRIPTION DE FORMATION (spécialité, acquis, projets marquants)"
        : field === 'aspiration' ? "un OBJECTIF / des ASPIRATIONS professionnelles (ce que la personne vise pour la suite)"
        : "un passage de CV";
      const styleInstr = style === 'concise' ? "Très concis : 1 à 2 phrases, droit au but."
        : style === 'detaillee' ? "Détaillé : 2 à 4 phrases, enrichis le contenu sans remplissage inutile."
        : style === 'technique' ? "Précis et technique : mets en avant les compétences, outils et procédures concrets du métier."
        : style === 'suggestive' ? "Suggestif : propose une formulation alignée sur les standards du marché de l'emploi."
        : "Clair et professionnel.";
      const e = (body.entry && typeof body.entry === 'object') ? body.entry : {};
      const clean = v => (v || '').toString().slice(0, 160).trim();
      let donnees;
      if (field === 'experience') {
        donnees =
`- Poste occupé : ${clean(e.poste) || job || '(non précisé)'}
- Employeur / lieu (SEUL contexte géographique autorisé) : ${clean(e.employeur) || '(non fourni — n\'indique AUCUN lieu ni employeur)'}
- Période (SEULES dates autorisées) : ${clean(e.debut) || '(non fournie)'} → ${clean(e.fin) || '(non fournie)'}`;
      } else if (field === 'education') {
        donnees =
`- Diplôme / formation : ${clean(e.diplome) || '(non précisé)'}
- Établissement / lieu (SEUL contexte géographique autorisé) : ${clean(e.etablissement) || '(non fourni — n\'indique AUCUN établissement ni lieu)'}
- Période (SEULES dates autorisées) : ${clean(e.debut) || '(non fournie)'} → ${clean(e.fin) || '(non fournie)'}`;
      } else {
        donnees = `- Métier visé : ${job || '(non précisé)'}`;
      }
      const user =
`Rédige ${fieldLabel} pour un CV, à partir des SEULES données ci-dessous. ${styleInstr}

DONNÉES FOURNIES (les seules autorisées — ne va jamais au-delà) :
${donnees}
- Compétences connues : ${skills || '(aucune)'}
- Indices / mots-clés de la personne : ${keywords}

CONSIGNE STRICTE : n'utilise QUE les lieux, employeurs, établissements et dates listés ci-dessus. Il est INTERDIT d'inventer ou d'ajouter le moindre autre nom de ville, wilaya, établissement, entreprise ou date. Si un lieu ou une date n'est pas fourni, ne le mentionne pas. Tu peux seulement développer les tâches, méthodes et responsabilités du métier. Un seul paragraphe, sans puce ni titre.`;
      const text = await mistral(env, [
        { role: 'system', content: STYLE },
        { role: 'user', content: user }
      ], { temperature: style === 'suggestive' ? 0.6 : 0.5, max_tokens: style === 'detaillee' ? 360 : 220 });
      return json({ text });
    }

    // ── 3. Chat conseil carrière ─────────────────────────────────────────────
    if (mode === 'chat') {
      const message = (body.message || '').toString().slice(0, 800);
      if (!message) return json({ error: 'Message vide.' }, 400);
      const sys =
`${STYLE}
Ici tu réponds comme un conseiller carrière bienveillant et concret. Réponses courtes (2 à 4 phrases), utiles, sans blabla. Tu peux proposer des compétences, des formulations, un modèle de CV, ou des conseils. Contexte : métier = ${job || 'non choisi'}, compétences = ${skills || 'aucune'}, prénom = ${name || 'inconnu'}.`;
      const reply = await mistral(env, [
        { role: 'system', content: sys },
        { role: 'user', content: message }
      ], { temperature: 0.6, max_tokens: 300 });
      return json({ reply });
    }

    return json({ error: 'Mode inconnu.' }, 400);
  } catch (e) {
    return json({ error: "Kateb est momentanément indisponible, réessayez dans un instant." }, 503);
  }
}
