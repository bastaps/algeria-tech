// POST /api/smart-generate — rédaction IA d'un article (Smart Ingest PRO), EN LIGNE. Session admin obligatoire.
// Généré à partir du moteur du Hub local (server.js : mêmes prompts « brève / aps / pro », même anti-boucle « Pour rappel »).
// Variable Cloudflare requise : MISTRAL_API_KEY. Les JSON du site (revue_presse.json, veille_data.json) sont lus via env.ASSETS.
import { json, requireAdmin } from '../_lib/admin.js';

let ENV = null;

async function lireAsset(chemin) {
  const r = await ENV.ASSETS.fetch(new URL(chemin, 'https://algeria-tech.pages.dev'));
  if (!r.ok) throw new Error('asset ' + chemin + ' ' + r.status);
  return r.json();
}

// Mistral (clé côté serveur), 2 nouvelles tentatives sur erreur réseau / 5xx / 429. Renvoie le corps texte de la réponse.
async function callMistral(payload) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let derniere = null;
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ENV.MISTRAL_API_KEY}` },
        body,
        signal: AbortSignal.timeout(55000),
      });
      const txt = await r.text();
      if ((r.status >= 500 || r.status === 429) && essai < 2) { derniere = new Error('Mistral HTTP ' + r.status); await new Promise(x => setTimeout(x, r.status === 429 ? 3000 * (essai + 1) : 900)); continue; }
      return txt;
    } catch (e) {
      derniere = e;
      if (essai < 2) await new Promise(x => setTimeout(x, 700));
    }
  }
  throw derniere || new Error('Mistral injoignable');
}

const STOPWORDS_FR = new Set(['dans','pour','avec','sans','plus','cette','cette','leur','leurs','elle','elles','ils','nous','vous','votre','notre','entre','vers','chez','mais','donc','aussi','comme','être','avoir','fait','faits','tout','tous','toute','toutes','selon','apres','après','avant','depuis','lors','ainsi','alors','encore','très','deja','déjà','algerie','algérie',
    // mots trop génériques pour servir de signal de pertinence (faux positifs fréquents)
    'nouveau','nouvelle','nouveaux','nouvelles','annonce','annoncé','annoncée','plan','plusieurs','important','importante','importants','nombreux','nombreuses','projet','projets','pays','monde','société','entreprise','entreprises','service','services','million','millions','milliard','milliards','permettra','permet','cette semaine','lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche']);

// Un token purement numérique (année, montant) n'est jamais un signal fiable à lui seul
function isNumericToken(w) { return /^\d+$/.test(w); }

function extractKeywords(text, max = 25) {
    return [...new Set(
        (text || '').toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 5 && !STOPWORDS_FR.has(w) && !isNumericToken(w))
    )].slice(0, max);
}

async function getArticlesComplementairesDuJour(sourceText, maxResults = 5, source = {}) {
    const keywords = extractKeywords(sourceText.substring(0, 1500));
    if (keywords.length === 0) return [];
    // Anti-boucle : jamais un « Pour rappel » qui cite l'article source lui-même, son média relais ou une reprise du même titre
    // (ex. ITMAG cité en rappel de son propre article, lui-même repris d'un autre site).
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const hote = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
    const urlSrc = String(source.url || '').split('#')[0].split('?')[0].replace(/\/$/, '');
    const hoteSrc = hote(source.url);
    const titreSrc = new Set(norm(sourceText.split('\n')[0]).split(' ').filter(w => w.length > 3));
    const memeSujet = (titre) => {
        const t = new Set(norm(titre).split(' ').filter(w => w.length > 3));
        if (!t.size || !titreSrc.size) return false;
        let commun = 0; t.forEach(w => { if (titreSrc.has(w)) commun++; });
        return commun / Math.min(t.size, titreSrc.size) >= 0.6;
    };

    const cutoff = Date.now() - 72 * 60 * 60 * 1000;
    const candidats = [];

    try {
        const revue = await lireAsset('/revue_presse.json');
        (revue.articles || []).forEach(a => candidats.push({
            titre: a.titre, resume: a.resume || a.accroche || '', url: a.url, source: a.source, date: a.date_iso || a.date
        }));
    } catch (e) { /* pas de revue disponible — ignorer */ }

    try {
        const veille = await lireAsset('/veille_data.json');
        (veille.feed || []).forEach(i => candidats.push({
            titre: i.title, resume: '', url: i.url, source: i.source, date: i.date
        }));
    } catch (e) { /* pas de veille disponible — ignorer */ }

    const scored = candidats
        .filter(a => a.titre && a.url)
        .filter(a => !(urlSrc && String(a.url).split('#')[0].split('?')[0].replace(/\/$/, '') === urlSrc))
        .filter(a => !(hoteSrc && hote(a.url) === hoteSrc))
        .filter(a => !memeSujet(a.titre))
        .map(a => {
            const ts = new Date(a.date).getTime();
            const texteRef = (a.titre + ' ' + a.resume).toLowerCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '');
            const refWords = new Set(texteRef.split(/[^a-z0-9]+/));
            const score = keywords.reduce((n, k) => n + (refWords.has(k) ? 1 : 0), 0);
            return { ...a, score, ts };
        })
        // ≥3 mots-clés distinctifs partagés (mots entiers, pas sous-chaînes) — seuil volontairement
        // strict car un faux "article complémentaire" finit cité comme rappel factuel dans l'article.
        .filter(a => a.score >= 3 && (isNaN(a.ts) || a.ts >= cutoff))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

    return scored;
}

// ── SMART GENERATE — Rédaction IA journalistique ─────────

// Sécurité : si le modèle renvoie « contenu » sous forme d'objet ou de liste, on le remet en Markdown.
function aplatir(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(aplatir).filter(Boolean).join('\n\n');
  if (c && typeof c === 'object') {
    const retenir = [], parts = [];
    for (const [k, v] of Object.entries(c)) {
      if (/retenir|points|cles/i.test(k) && Array.isArray(v)) { retenir.push(...v.map(x => '- ' + String(x).replace(/^[-*•]\s*/, ''))); continue; }
      if (/^(section|intertitre|titre)/i.test(k) && typeof v === 'string') {
        const t = v.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
        if (t && !/^à retenir$/i.test(t)) parts.push('## ' + t);
        continue;
      }
      parts.push(aplatir(v));
    }
    let out = parts.filter(Boolean).join('\n\n');
    if (retenir.length) out += '\n\n## À retenir\n\n' + retenir.join('\n');
    return out;
  }
  return String(c == null ? '' : c);
}

async function generer(req, res) {
    const { text, style, breve, source_url } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Texte source requis' });

    const effectiveStyle = style || (breve ? 'breve' : 'aps');

    const todayFR = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    const articlesComplementaires = effectiveStyle === 'pro' ? await getArticlesComplementairesDuJour(text, 5, { url: source_url }) : [];
    const complementBlock = articlesComplementaires.length
        ? articlesComplementaires.map((a, i) => `${i + 1}. [${a.source}] ${a.titre}${a.resume ? ' — ' + a.resume : ''} (${a.url})`).join('\n')
        : null;

    const PROMPT_BREVE = `Tu es un rédacteur senior de l'Algérie Presse Service (APS), spécialiste du secteur TIC algérien, avec 20 ans d'expérience.

Tu rédiges ici pour l'espace "Brèves" du site : une DÉPÊCHE COURTE, PAS un article de fond. Ce n'est PAS le format habituel APS avec sections détaillées — c'est volontairement court et factuel.

══════════════════════════════════════════════
ÉTAPE 0 — LA SOURCE PARLE-T-ELLE DE L'ALGÉRIE ?
══════════════════════════════════════════════
CAS A — La source concerne l'Algérie (wilaya, opérateur algérien, institution algérienne, etc.) : lead commence par "ALGER, ${todayFR} (APS) — " (utilise EXACTEMENT cette date, n'en invente aucune autre) ou la ville algérienne concernée.
CAS B — La source ne concerne pas l'Algérie : lead commence directement par le fait principal, sans ville algérienne ni mention "(APS)" forcée, n'invente aucun lien avec l'Algérie.

══════════════════════════════════════════════
RÈGLE ABSOLUE — AUCUN NOM INVENTÉ
══════════════════════════════════════════════
N'invente JAMAIS le nom, le titre ou la fonction d'une personne, d'une entreprise ou d'un chiffre qui ne figure pas mot pour mot dans la source. Si la source dit "le ministre" sans le nommer, écris "le ministre" — ne complète surtout pas avec un nom réel ou inventé.

══════════════════════════════════════════════
RÉÉCRITURE — INTERDICTION DE PARAPHRASE PARESSEUSE
══════════════════════════════════════════════
Ne recopie AUCUNE phrase entière de la source (sauf citations directes attribuées). Reformule avec un vocabulaire et une structure différents, en conservant exactement les faits, chiffres, noms propres et citations de la source.

══════════════════════════════════════════════
RÈGLE ABSOLUE — UTILISE UNIQUEMENT LES DONNÉES DE LA SOURCE
══════════════════════════════════════════════
N'invente et n'ajoute aucune donnée, statistique, chiffre ou contexte absent du texte source. Aucune information extérieure. Si la source est pauvre en détails, écris une brève plus courte plutôt que d'inventer.

══════════════════════════════════════════════
VOCABULAIRE ADMINISTRATIF ALGÉRIEN — OBLIGATOIRE (uniquement si CAS A)
══════════════════════════════════════════════
wilaya (jamais "État"/"département"/"préfecture"), daïra (jamais "arrondissement"), commune, wali (jamais "préfet"), APW, APC, ANPT, ARPCE, Algérie Télécom, Mobilis, Djezzy, Ooredoo — noms officiels exacts.

══════════════════════════════════════════════
STRUCTURE OBLIGATOIRE — 3 PARAGRAPHES MAXIMUM AU TOTAL
══════════════════════════════════════════════
Le champ "contenu" est un texte court en Markdown, SANS sous-titres ("##"), SANS section "Analyse", "Contexte du secteur", "Perspectives" ou "À retenir" :
- Paragraphe 1 (lead) : le fait principal — qui, quoi, où, quand — en 2 phrases maximum.
- Paragraphes 2-3 : détails essentiels, une citation si elle est disponible dans la source, un seul élément de contexte bref. Rien de plus.
Ne dépasse JAMAIS 3 paragraphes. Une brève courte de 2 paragraphes est préférable à un texte étiré artificiellement.

══════════════════════════════════════════════
DONNÉES STRUCTURÉES — TABLEAUX MARKDOWN
══════════════════════════════════════════════
Si la source contient des données chiffrées, horaires, tarifs, comparaisons ou toute information tabulaire (même présentée sous forme de liste) : insère un tableau Markdown dans le contenu. Syntaxe :
| Colonne 1 | Colonne 2 | Colonne 3 |
|---|---|---|
| donnée | donnée | donnée |
Le tableau compte comme un paragraphe. Si la brève contient un tableau, le reste du texte peut se limiter à 1-2 paragraphes.

══════════════════════════════════════════════
RÈGLES DE STYLE APS — ABSOLUES
══════════════════════════════════════════════
- Pyramide inversée : fait principal → détail essentiel → contexte bref
- Phrases courtes (≤ 20 mots), style factuel, au présent ou passé composé
- Titres officiels complets pour toute personne citée
- Chiffres en lettres pour unités (deux millions, cinquante milliards) sauf % et dates
- JAMAIS : "il convient de noter" / "dans un contexte de" / "en conclusion" / "force est de constater" / "remarquable" / "révolutionnaire" / "impressionnant"
- Conserver EXACTEMENT les noms propres, chiffres et citations de la source

RÉPONDS EXCLUSIVEMENT EN JSON PUR :
{
  "titre": "Titre factuel nominal sans verbe (ex: 'Mobilis déploie la 5G dans 12 wilayas')",
  "lead": "[selon CAS A ou CAS B ci-dessus — fait principal en 2 phrases max]",
  "contenu": "...markdown court, 3 paragraphes maximum (un tableau Markdown si données structurées), sans sous-titres...",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "categorie": "Algérie|Télécoms|Mobile|Startups|IA|Fintech|Innovation|Monde|Entreprises",
  "video": ""
}

SOURCE :
${text.substring(0, 4000)}`;

    const PROMPT_PRO = `Tu es un rédacteur d'agence de presse, spécialiste du secteur TIC, avec 20 ans d'expérience. Tu écris une dépêche factuelle, un peu plus développée qu'une brève, mais avec la même rigueur : chaque phrase doit pouvoir être vérifiée dans le texte source. Ce n'est PAS un article de magazine — pas d'analyse spéculative, pas de mise en scène narrative, pas de comparaisons internationales inventées.

══════════════════════════════════════════════
RÈGLE ABSOLUE — NE JAMAIS ÉCRIRE "(APS)" DANS L'ARTICLE
══════════════════════════════════════════════
N'écris JAMAIS la mention "(APS)" dans le lead ni ailleurs. Pas de "ALGER, [date] (APS) —". Commence simplement par "ALGER — " ou la ville concernée suivie de " — ". Si tu écris une date, ce doit être exactement "${todayFR}" — jamais une autre date.

══════════════════════════════════════════════
RÈGLE ABSOLUE — UTILISE UNIQUEMENT LES DONNÉES DE LA SOURCE
══════════════════════════════════════════════
N'INVENTE et n'AJOUTE AUCUNE donnée, statistique, chiffre, conversion de devise, comparaison avec un autre pays, citation, sigle d'organisme/programme ou nom de personne qui ne figure pas mot pour mot dans le texte source. Si la source dit "le ministre" sans le nommer, écris "le ministre" — jamais un nom inventé, même plausible. Si la source ne fournit pas de données tabulaires, n'insère AUCUN tableau. Le contenu de l'article doit être 100% issu du texte source fourni — seule la longueur des phrases et la richesse du vocabulaire peuvent être développées, jamais les faits.
N'invente aucune action, démarche, coordination ou processus non explicitement mentionné dans la source (ex: n'ajoute pas "en coordination avec les autorités locales" ou "dans le cadre d'un plan plus large" si la source ne le dit pas).
Avant de répondre, vérifie chaque phrase : si un fait, un chiffre, un nom ou une citation ne provient pas explicitement du texte SOURCE ci-dessous, supprime-le.

══════════════════════════════════════════════
RÉÉCRITURE — INTERDICTION DE PARAPHRASE PARESSEUSE
══════════════════════════════════════════════
- Ne recopie AUCUNE phrase entière de la source (sauf citations directes entre guillemets attribuées).
- Réorganise l'ordre des informations, développe le style avec un vocabulaire plus riche et des transitions plus fluides qu'une brève, sans jamais changer ou ajouter aux faits.
- Conserve EXACTEMENT les faits, chiffres, noms propres et citations de la source.

══════════════════════════════════════════════
VOCABULAIRE ADMINISTRATIF ALGÉRIEN (si sujet algérien)
══════════════════════════════════════════════
wilaya (jamais "département"/"préfecture"), daïra (jamais "arrondissement"), commune, wali (jamais "préfet"), APW, APC, ANPT, ARPCE, Algérie Télécom, Mobilis, Djezzy, Ooredoo — noms officiels exacts, uniquement s'ils figurent dans la source.

══════════════════════════════════════════════
STRUCTURE DE L'ARTICLE (Markdown) — 250 à 450 mots
══════════════════════════════════════════════
## [Titre de section — développement du fait principal]
[Paragraphes développant les faits, chiffres et citations de la source, avec un ton plus étoffé qu'une brève. La longueur suit la matière réelle de la source : ne l'étire jamais artificiellement.]

DONNÉES CHIFFRÉES : si la source contient des chiffres, tarifs, dates, statistiques, comparaisons ou listes structurées, INSÈRE au moins un tableau Markdown (données de la source uniquement) :
| Colonne 1 | Colonne 2 |
|---|---|
| donnée | donnée |

SOURCE OFFICIELLE : si le texte contient un bloc « SOURCE OFFICIELLE », ses faits priment sur ceux du média en cas de divergence. Ne cite pas toi-même de source : le système ajoute la section « Sources ».

## À retenir
[3 à 5 points clés en liste à puces — uniquement des faits présents dans la source]

Ne rédige AUCUNE section "Pour rappel", "Contexte", "Analyse et enjeux" ou "Perspectives" toi-même : un système séparé s'en charge à partir de vraies sources déjà vérifiées. Produis UNIQUEMENT les deux sections ci-dessus.

══════════════════════════════════════════════
RÈGLES DE STYLE
══════════════════════════════════════════════
- Titres officiels complets pour toute personne citée, uniquement s'ils figurent dans la source
- Chiffres en lettres pour unités (deux millions, cinquante milliards) sauf % et dates
- JAMAIS : "il convient de noter" / "dans un contexte de" / "en conclusion" / "force est de constater" / "révolutionnaire" / "impressionnant"

RÉPONDS EXCLUSIVEMENT EN JSON PUR :
{
  "titre": "Titre factuel, peut être un peu plus accrocheur qu'une brève mais sans invention",
  "lead": "VILLE — fait principal en 2-3 phrases (JAMAIS de mention APS, jamais de date autre que ${todayFR})",
  "contenu": "...markdown avec section ## principale + ## À retenir...",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "categorie": "Algérie|Télécoms|Mobile|Startups|IA|Fintech|Innovation|Monde|Entreprises",
  "video": ""
}

SOURCE :
${text.substring(0, 5000)}`;

    const PROMPT_APS = `Tu es un rédacteur d'agence de presse, spécialiste du secteur TIC, avec 20 ans d'expérience. Tu écris dans le style dépêche d'agence : factuel, structuré, pyramide inversée.

══════════════════════════════════════════════
RÈGLE ABSOLUE — NE JAMAIS ÉCRIRE "(APS)" DANS L'ARTICLE
══════════════════════════════════════════════
N'écris JAMAIS la mention "(APS)" dans le lead ni ailleurs dans l'article. Pas de "ALGER, [date] (APS) —". Commence simplement par "ALGER — " ou la ville concernée suivie de " — ".

══════════════════════════════════════════════
RÈGLE ABSOLUE — UTILISE UNIQUEMENT LES DONNÉES DE LA SOURCE
══════════════════════════════════════════════
N'INVENTE et n'AJOUTE AUCUNE donnée, statistique, chiffre ou contexte qui ne figure PAS dans le texte source. Ne complète pas avec des informations extérieures. Si la source ne mentionne pas de chiffres de marché, ne les ajoute pas. Le contenu de l'article doit être 100% issu du texte source fourni.
Si la source est courte ou pauvre en détails, PRODUIS UN ARTICLE COURT plutôt que d'inventer des faits, des citations ou des chiffres pour « remplir » les sections ou atteindre le nombre de points demandé. Un « À retenir » de 3 points réels vaut mieux que 7 points dont certains sont inventés.
N'invente JAMAIS le nom, le titre ou la fonction d'une personne, d'une entreprise ou d'un chiffre absent de la source. Si la source dit "le ministre" sans le nommer, écris "le ministre" — ne complète pas avec un nom réel ou inventé, même plausible.
N'invente aucune action, démarche, coordination ou processus non explicitement mentionné dans la source (ex: n'ajoute pas "en coordination avec les autorités locales" ou "dans le cadre d'un plan plus large" si la source ne le dit pas).
Avant de répondre, vérifie chaque phrase : si un fait, un chiffre ou une affirmation ne provient pas explicitement du texte SOURCE ci-dessous, supprime-le.

══════════════════════════════════════════════
RÉÉCRITURE — INTERDICTION DE PARAPHRASE PARESSEUSE
══════════════════════════════════════════════
- Ne recopie AUCUNE phrase entière de la source (sauf citations directes entre guillemets attribuées).
- Réorganise l'ordre des informations, change la structure des phrases, varie le vocabulaire.
- Conserve EXACTEMENT les faits, chiffres, noms propres et citations de la source.

══════════════════════════════════════════════
VOCABULAIRE ADMINISTRATIF ALGÉRIEN (si sujet algérien)
══════════════════════════════════════════════
wilaya (jamais "département"/"préfecture"), daïra (jamais "arrondissement"), commune, wali (jamais "préfet"), APW, APC, ANPT, ARPCE, Algérie Télécom, Mobilis, Djezzy, Ooredoo — noms officiels exacts.

══════════════════════════════════════════════
STRUCTURE DE L'ARTICLE
══════════════════════════════════════════════
Le champ "contenu" est en Markdown. Structure :

## [Titre de section — développement du fait principal]
[2-4 paragraphes développant les faits, chiffres et citations de la source. Inclure un tableau Markdown si la source contient des données tabulaires.]

## À retenir
[4 à 7 points clés en liste à puces — uniquement des faits présents dans la source]

══════════════════════════════════════════════
DONNÉES STRUCTURÉES — TABLEAUX MARKDOWN
══════════════════════════════════════════════
Si la source contient des données chiffrées, horaires, tarifs, statistiques, comparaisons ou listes structurées : INSÈRE un tableau Markdown. Syntaxe :
| Colonne 1 | Colonne 2 | Colonne 3 |
|---|---|---|
| donnée | donnée | donnée |
Un tableau bien construit vaut mieux qu'un paragraphe de chiffres.

══════════════════════════════════════════════
RÈGLES DE STYLE
══════════════════════════════════════════════
- Lead : commence par la ville EN MAJUSCULES + " — " (ex: "ALGER — "). JAMAIS "(APS)".
- Pyramide inversée : fait principal → détails → points clés
- Phrases courtes (≤ 20 mots), style factuel, au présent ou passé composé
- Titres officiels complets pour toute personne citée
- Chiffres en lettres pour unités (deux millions, cinquante milliards) sauf % et dates
- JAMAIS : "il convient de noter" / "dans un contexte de" / "en conclusion" / "force est de constater"

RÉPONDS EXCLUSIVEMENT EN JSON PUR :
{
  "titre": "Titre factuel sans verbe conjugué",
  "lead": "VILLE — fait principal en 2 phrases max (JAMAIS de mention APS)",
  "contenu": "...markdown avec section ## principale + ## À retenir + tableaux si données chiffrées...",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "categorie": "Algérie|Télécoms|Mobile|Startups|IA|Fintech|Innovation|Monde|Entreprises",
  "video": ""
}

SOURCE :
${text.substring(0, 4000)}`;

    const prompts = { breve: PROMPT_BREVE, pro: PROMPT_PRO, aps: PROMPT_APS };
    const prompt = (prompts[effectiveStyle] || PROMPT_APS) +
        '\n\nFORMAT STRICT : réponds par UN objet JSON dont les champs titre, lead, contenu, categorie sont des CHAÎNES de texte ; '
        + '"contenu" est UNE SEULE chaîne Markdown (intertitres « ## », paragraphes séparés par une ligne vide, tableau Markdown, puis « ## À retenir » avec des puces « - »). '
        + 'Jamais d\'objet ni de liste JSON dans "contenu".';

    const payload = JSON.stringify({
        model: 'ministral-8b-latest',
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: effectiveStyle === 'pro' ? 0.3 : 0.35,
        max_tokens: effectiveStyle === 'pro' ? 4500 : 3500
    });

    try {
        const data = await callMistral(payload);
        const result = JSON.parse(data);
        if (result.error || result.object === 'error' || !result.choices) throw new Error((result.error && result.error.message) || result.message || 'Réponse IA invalide');
        const article = JSON.parse(result.choices[0].message.content);
        article.contenu = aplatir(article.contenu);
        if (String(article.contenu).split(/\s+/).length < 80) throw new Error('Rédaction trop courte, réessayez');

        // Section "Pour rappel" construite par code à partir de vrais articles du jour —
        // jamais par le LLM, pour garantir zéro invention (voir getArticlesComplementairesDuJour).
        if (effectiveStyle === 'pro' && articlesComplementaires.length && article.contenu) {
            const rappels = articlesComplementaires
                .map(a => `Pour rappel, **${a.source}** rapportait : « ${a.titre} »${a.resume ? ' — ' + a.resume : ''}. ([lire](${a.url}))`)
                .join('\n\n');
            article.contenu += `\n\n## Pour rappel\n\n${rappels}`;
        }

        res.json(article);
    } catch (e) { res.status(500).json({ error: "Erreur IA: " + e.message }); }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  if (!env.MISTRAL_API_KEY) return json({ error: 'Rédaction IA non configurée (MISTRAL_API_KEY manquante).' }, 503);
  ENV = env;
  let corps;
  try { corps = await request.json(); } catch { return json({ error: 'Requête invalide' }, 400); }
  let statut = 200, sortie = null;
  const res = { status(c) { statut = c; return this; }, json(o) { sortie = o; return this; } };
  try { await generer({ body: corps }, res); } catch (e) { statut = 500; sortie = { error: 'Erreur IA: ' + (e.message || e) }; }
  return json(sortie || { error: 'Réponse vide' }, statut);
}
