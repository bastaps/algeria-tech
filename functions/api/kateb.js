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

// Style propre aux modes Derja. Volontairement séparé de STYLE : celui-ci impose
// « Réponds en français », ce qui est l'inverse de ce qu'on veut ici.
const DERJA_STYLE = `Tu es « Kateb », un écrivain public algérien, né et élevé en Algérie. Tu écris la darija ALGÉRIENNE de tous les jours — celle de la rue, du café, de la famille.

⛔ RÈGLE LA PLUS IMPORTANTE — C'EST DE L'ALGÉRIEN, PAS DU MAROCAIN :
Les modèles confondent constamment darija algérienne et marocaine. Interdiction absolue des marqueurs marocains.
- « je veux » : dis « n7ab » ou « rani n7ab ». JAMAIS « bghit ».
- « de / à moi » : dis « ta3 » ou « nta3 ». JAMAIS « dyal ».
- « bien / bon » : dis « mlih ». JAMAIS « mezyan ».
- « maintenant » : dis « druk » ou « daba7 ». JAMAIS « daba ».
- « un peu » : dis « chwiya ». « beaucoup » : dis « bezzaf ».
- « travail » : dis « khedma ». « il faut » : dis « lazem ».
L'algérien emprunte beaucoup au français : garde les mots français usuels tels quels (infirmier, clinique, chantier, dossier, entretien, diplôme). C'est naturel, ne les traduis pas de force en arabe classique.

RÈGLES DE LANGUE :
- Translittération latine uniquement, JAMAIS l'alphabet arabe.
- Chiffres du clavier algérien : 3 = ع, 7 = ح, 9 = ق, 5 = خ, 2 = ء.
- Phrases courtes et simples, comme si tu expliquais à un ami au café.
- Pas de listes à puces, pas de titres, pas d'emojis.

EXEMPLE DU TON ATTENDU :
Français : « Je suis maçon depuis dix ans et je cherche un poste stable. »
Darija algérienne : « Rani ma3ellem fi l-binaa 3andi 3achra snin, w rani n9alleb 3la khedma stable. »

⛔ ZÉRO INVENTION : n'invente jamais un lieu, un employeur, une date, un chiffre ni un diplôme qui ne figure pas dans le texte fourni. Ne change jamais le métier de la personne : traduis-le fidèlement, et si tu hésites, garde le mot français.`;

// `model` par défaut : mistral-small-latest, le modèle historique de Kateb.
// Les modes Derja demandent explicitement mistral-large : small confond la darija
// algérienne avec la marocaine et inverse parfois le sens (testé en prod).
async function mistral(env, messages, { temperature = 0.7, max_tokens = 380, model = 'mistral-small-latest' } = {}) {
  const apiRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model,
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

    // ── 4. Derja : traduire/expliquer un texte français en darija ────────────
    // Contrat attendu par la page Derja : { mode, text } → { text }.
    if (mode === 'derja-explain') {
      const text = (body.text || '').toString().slice(0, 1500);
      if (!text) return json({ error: 'Texte vide.' }, 400);
      const out = await mistral(env, [
        { role: 'system', content: DERJA_STYLE },
        { role: 'user', content:
`Traduis fidèlement ce texte en darija algérienne. Respecte le sens exact : ne nie rien, n'ajoute rien, ne change pas le métier.
Ensuite, saute une ligne et ajoute une seule phrase en darija qui explique l'idée simplement, comme à un ami.

Réponds uniquement en darija algérienne (translittération latine). Ne reprends pas le texte français.

TEXTE :
${text}` }
      ], { temperature: 0.3, max_tokens: 400, model: 'mistral-large-latest' });
      return json({ text: out });
    }

    // ── 5. Derja : corriger un texte français, expliquer en darija ───────────
    // Le client lit d'abord raw.corrected / raw.explanations_derja, sinon text.
    if (mode === 'derja-correct') {
      const text = (body.text || '').toString().slice(0, 1500);
      if (!text) return json({ error: 'Texte vide.' }, 400);
      const out = await mistral(env, [
        { role: 'system', content: DERJA_STYLE },
        { role: 'user', content:
`Corrige les fautes de ce texte français (orthographe, grammaire, tournure), sans en changer le sens ni ajouter d'information.

Puis explique les corrections À UN ALGÉRIEN QUI NE LIT PAS BIEN LE FRANÇAIS.
⛔ Ces explications doivent être ÉCRITES EN DARIJA ALGÉRIENNE (translittération latine), PAS en français. C'est le but même de l'outil : quelqu'un qui comprend le français n'en aurait pas besoin.
Tu peux citer le mot français fautif et le mot corrigé, mais tout ce qui les entoure est en darija.
Exemple attendu : « Ktebt "travailler" walakin lazem "travaillé", 3la khater rak tahder 3la l-passé. »

Réponds STRICTEMENT par un objet JSON, sans texte autour, sans bloc de code :
{"corrected": "<le texte corrigé, en français>", "explanations_derja": "<les explications, en darija algérienne latine>"}

TEXTE :
${text}` }
      ], { temperature: 0.2, max_tokens: 700, model: 'mistral-large-latest' });

      // Le modèle peut enrober le JSON (bloc de code, phrase d'intro) : on reste tolérant.
      let raw = null;
      try {
        const m = out.match(/\{[\s\S]*\}/);
        if (m) raw = JSON.parse(m[0]);
      } catch { /* pas de JSON exploitable : on renverra le texte brut */ }

      const corrected = (raw && typeof raw.corrected === 'string' && raw.corrected.trim())
        ? raw.corrected.trim()
        : out;
      return json({
        text: corrected,
        raw: {
          corrected,
          explanations_derja: (raw && raw.explanations_derja) ? String(raw.explanations_derja) : ''
        }
      });
    }

    return json({ error: 'Mode inconnu.' }, 400);
  } catch (e) {
    return json({ error: "Kateb est momentanément indisponible, réessayez dans un instant." }, 503);
  }
}
