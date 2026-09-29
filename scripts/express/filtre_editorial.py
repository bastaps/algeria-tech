"""Filtre éditorial commun — express « L'info en 15 s » et vrai flash.

Ligne : actualité TIC / télécoms / numérique, Algérie d'abord. Tri en deux
temps : mots-clés (gratuit, déterministe), puis Gemini pour les cas ambigus.
Exclus : tutoriels, bons plans, tests grand public, rumeurs, jeux, people.

Utilisation :
    from filtre_editorial import trier
    gardes, rejetes = trier(articles)   # articles = [{title, url, source, date, summary?}]
"""
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

# ── Sources ──────────────────────────────────────────────────────────────────
# Clés normalisées (minuscules, sans accents ni ponctuation) → comparaison par
# inclusion, pour absorber les variantes de nommage des flux (« NTIC DZ »,
# « NTIC.dz », « ITMag DZ »…).
SOURCES_DZ = [
    "aps", "itmag", "ntic", "tsa", "algerie360", "algerie eco", "algerieeco",
    "geekyalgeria", "ecomnewsmed", "arpce", "joradp", "algeriatech", "algeria tech",
    "el moudjahid", "el watan", "horizons", "soir d'algerie", "maghreb emergent", "24h algerie",
    "patrie news", "jeune independant", "cresus", "radio algerie",
]
SOURCES_INTL = [
    "silicon", "usine digitale", "usine nouvelle", "zdnet", "01net", "numerama",
    "bfm", "frandroid", "wamda", "techcrunch", "wired", "le monde", "clubic", "next",
    "journal du net", "figaro", "siecle digital", "maddyness", "jeune afrique", "hespress",
    "lemagit", "verge", "ars technica", "register", "mit tech", "venturebeat",
    "bleepingcomputer", "rest of world", "spacenews", "mobile world live", "light reading",
    "developing telecoms", "capacity media", "data center dynamics", "techcabal",
    "disrupt africa", "itweb",
]

# ── Mots-clés ────────────────────────────────────────────────────────────────
DZ = [
    "algerie", "algerien", "algerienne", "alger", "oran", "constantine", "annaba",
    "setif", "algeria", "algerian", "mobilis", "djezzy", "ooredoo algerie",
    "algerie telecom", "arpce", "mptic", "anpdp", "asal", "alcomsat",
    "algeria venture", "edahabia", "baridimob", "algerie poste", "carte cib", "satim",
    "gie monetique", "sonatrach", "sonelgaz", "joradp", "tebboune",
]

THEMES = {
    "télécoms": [
        "telecom", "operateur", "operator", "fibre", "fiber", "ftth", "4g", "5g", "6g",
        "lte", "cable sous-marin", "cables sous-marins", "submarine cable", "haut debit",
        "broadband", "spectre", "spectrum", "roaming", "reseau mobile", "couverture reseau",
        "internet", "wifi", "connectivite", "connectivity", "starlink", "esim",
        "orange", "sfr", "bouygues telecom", "free pro", "vodafone", "mtn", "maroc telecom",
        "tunisie telecom", "inwi", "etisalat", "stc", "djezzy", "mobilis", "ooredoo",
        "algerie telecom", "communications", "telecommunications",
    ],
    "mobile": [
        "smartphone", "telephone mobile", "telephonie", "terminaux", "marche du mobile",
        "handset", "assemblage de smartphones", "assemblage de telephones",
        "usine de smartphones", "electronique", "electronics",
    ],
    "régulation": [
        "regulat", "regulateur", "autorite de regulation", "decret", "journal officiel",
        "projet de loi", "loi sur", "ministere de la poste", "ministere du numerique",
        "antitrust", "concurrence", "competition", "amende", "fined", "dma", "dsa",
        "rgpd", "gdpr", "donnees personnelles", "personal data", "privacy", "cnil",
        "commission europeenne", "european commission", "ftc", "doj", "lawsuit", "proces",
    ],
    "souveraineté": ["souverainete numerique", "sovereign", "souverain"],
    "e-gouvernement": [
        "e-gouvernement", "administration electronique", "numerisation", "digitalisation",
        "transformation numerique", "service numerique", "services numeriques",
        "e-government", "dematerialis", "plateforme numerique", "guichet unique",
        "identite numerique", "digital id",
    ],
    "startups": [
        "startup", "start-up", "levee de fonds", "leve", "raises", "funding", "series a",
        "series b", "serie a", "serie b", "seed", "incubateur", "accelerateur",
        "capital-risque", "venture capital", "licorne", "unicorn", "label startup",
    ],
    "data-IA-cloud": [
        "intelligence artificielle", "ia", "l'ia", "d'ia", "ai", "genai",
        "cloud", "datacenter", "data center", "centre de donnees", "centres de donnees",
        "llm", "openai", "anthropic", "mistral", "gemini", "chatgpt", "claude", "nvidia",
        "gpu", "puce", "puces", "chip", "chips", "semi-conducteur", "semiconductor",
        "big data", "algorithme", "multicloud", "supercalculateur", "supercomputer", "hpc",
        "processeur", "processor", "virtualisation", "vmware", "logiciel", "software", "saas",
        "open source", "linux", "finops", "modele de langage", "agent ia", "ai agent",
    ],
    "fintech": [
        "fintech", "paiement", "payment", "monetique", "e-paiement", "epaiement", "psp",
        "prestataire de services de paiement", "paiement electronique",
        "carte bancaire", "banque", "bank", "portefeuille electronique", "wallet",
        "neobanque", "mobile money", "stablecoin", "crypto", "bitcoin", "cbdc",
    ],
    "cybersécurité": [
        "cyber", "cybersecurite", "cybersecurity", "cyberattaque", "ransomware",
        "rancongiciel", "piratage", "pirate", "hacker", "hack", "faille", "vulnerabilit",
        "fuite de donnees", "data breach", "breach", "phishing", "hameconnage", "malware",
        "espionnage", "spyware", "cyberattack", "hacked", "securite informatique",
        "incident de securite", "incidents de securite", "ddos",
    ],
    "spatial": ["spatial", "satellite", "space", "fusee", "rocket", "orbite", "orbit"],
    "e-commerce": ["e-commerce", "commerce electronique", "ecommerce", "marketplace", "vente en ligne"],
    "e-santé-edtech": [
        "e-sante", "telemedecine", "sante numerique", "healthtech", "edtech",
        "education numerique", "enseignement a distance", "e-learning", "universite numerique",
    ],
    "industrie 4.0": [
        "industrie 4.0", "robot", "robotique", "automatisation", "automation", "automate", "iot", "objets connectes",
        "usine intelligente", "jumeau numerique", "drone", "maison connectee",
    ],
    "smart city": ["smart city", "ville intelligente", "villes intelligentes"],
    "compétences": [
        "competences numeriques", "formation numerique", "digital skills", "talents du numerique",
        "developpeurs", "developers", "codage",
    ],
    "plateformes": [
        "google", "meta", "apple", "microsoft", "amazon", "tiktok", "whatsapp", "youtube",
        "x.com", "twitter", "spacex", "tesla", "samsung", "huawei", "xiaomi",
    ],
    "numérique (général)": [
        "numerique", "digital", "tech", "technologie", "technologies", "informatique",
        "dsi", "numerique responsable",
    ],
}
# « plateformes » seule ne suffit pas (angle régulation/marché exigé) → ambigu.
THEMES_FAIBLES = {"plateformes", "numérique (général)"}

EXCLUS = [
    # tutoriels / guides pratiques
    "tuto", "tutoriel", "how to", "how-to", "pas a pas", "step by step", "astuce", "astuces",
    "comment faire", "voici comment", "here's how", "guide d'achat", "buying guide",
    "migrer vers", "configurer votre", "parametrer",
    # bons plans / commerce grand public
    "bon plan", "bons plans", "promo", "code promo", "soldes", "prix casse",
    "black friday", "prime day", "cyber monday", "moins cher", "en solde",
    "gift guide", "cadeau", "cadeaux", "coupon",
    # tests / comparatifs
    "test du", "notre test", "on a teste", "review:", "reviewed", "prise en main", "hands-on",
    "comparatif", "notre avis", "avis complet", "pratique :", "save up to", "% off",
    "zdnet morning", "versus", "vs", "meilleur", "meilleurs", "meilleures", "best",
    "top 10", "top 5", "we tested", "i tested", "i tried", "j'ai teste", "unboxing",
    # rumeurs / fuites produits
    "rumeur", "rumor", "rumour", "selon des rumeurs", "leaked render", "pourrait sortir",
    # jeux / divertissement / people
    "jeu video", "jeux video", "gaming", "gamer", "playstation", "ps5", "xbox", "nintendo",
    "switch 2", "fortnite", "gta", "esport", "e-sport", "netflix", "serie tv", "film",
    "movie", "celebrite", "celebrity", "star de", "horoscope",
    "sexe", "sex", "dating", "rencontre amoureuse", "fashion", "sport",
    "football", "quiz",
    # armée / défense : à éviter (demande de la rédaction)
    "anp", "armee nationale populaire", "armee", "militaire", "militaires", "defense nationale",
    "ministere de la defense", "chanegriha", "etat-major", "appel d'offres", "avis d'attribution", "consultation ouverte",
    "avis de recrutement", "offre d'emploi", "wordle", "crossword",
]

TITRES_EXCLUS_DEBUT = ("pourquoi j'ai", "voici ", "i created", "i built", "i spent")
# « Comment X va… » est une info ; « Comment réparer… » est un tutoriel.
TUTO_RE = re.compile(
    r"^ ?comment (bien |faire|installer|configurer|activer|desactiver|reparer|nettoyer|"
    r"supprimer|recuperer|utiliser|telecharger|migrer|proteger|choisir|regler|changer|"
    r"mettre|transferer|sauvegarder|creer|trouver|economiser|prolonger|ameliorer|optimiser|"
    r"eviter|savoir|j'ai|se |vous |votre |vos )")


def normaliser(texte: str) -> str:
    t = unicodedata.normalize("NFKD", (texte or "").lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.replace("’", "'").replace(" ", " ")
    return " " + re.sub(r"\s+", " ", t).strip() + " "


def _hits(blob: str, mots) -> list:
    """Début de mot toujours exigé (« sport » ≠ « transport ») ; mot entier
    exigé pour les mots courts (ia, 5g, dsa, film…)."""
    out = []
    for m in mots:
        c = normaliser(m).strip()
        fin = r"(?![a-z0-9])" if len(c) <= 4 else ""
        if re.search(r"(?<![a-z0-9])" + re.escape(c) + fin, blob):
            out.append(c)
    return out


def _source(source: str):
    s = normaliser(source).replace(".", " ").replace("-", " ")
    s = re.sub(r"\s+", " ", s)
    if any(k in s for k in SOURCES_DZ):
        return "DZ"
    if any(k in s for k in SOURCES_INTL):
        return "INTL"
    return None


SOURCES_OFFICIELLES = {"APS", "Radio Algérie", "ARPCE"}  # toujours des sujets algériens


def source_sure_dz(article: dict) -> bool:
    """Règle de la rédaction : une info sur l'Algérie ne se reprend que d'une source
    sûre — site en .dz (APS, Radio Algérie, ARPCE, El Moudjahid, Horizons…)."""
    hote = urllib.parse.urlsplit(article.get("url") or "").hostname or ""
    return hote.endswith(".dz")


def nettoyer_titre(t: str) -> str:
    """ITMAG met « Rubrique <BR> Titre » : on garde « Rubrique — Titre »."""
    t = re.sub(r"\s*<br\s*/?>\s*", " — ", t or "", flags=re.I)
    return re.sub(r"<[^>]+>", "", t).strip()


def analyser(article: dict) -> dict:
    """Première passe par mots-clés. decision ∈ garder / rejeter / ambigu.

    - Sujet algérien (mot-clé DZ dans le titre, ou site DZ + mot-clé DZ dans le
      résumé) avec thème TIC dans le titre → gardé d'office.
    - Tout le reste (sujets internationaux, y compris publiés par un site DZ)
      passe par Gemini, qui applique la barre « portée majeure ».
    """
    titre = nettoyer_titre(article.get("title") or article.get("titre") or "")
    resume = re.sub(r"<[^>]+>", " ", article.get("summary") or article.get("resume") or "")
    bt = normaliser(titre)
    br = normaliser(resume[:600])
    origine = article.get("pays_source") or _source(article.get("source", ""))
    dz_titre, dz_resume = _hits(bt, DZ), _hits(br, DZ)
    th_titre = {n: h for n, m in THEMES.items() if (h := _hits(bt, m))}
    th_resume = {n: h for n, m in THEMES.items() if (h := _hits(br, m))}
    forts_titre = {k for k in th_titre if k not in THEMES_FAIBLES}
    forts = forts_titre | {k for k in th_resume if k not in THEMES_FAIBLES}
    exclus = _hits(bt, EXCLUS)
    if bt.strip().startswith(TITRES_EXCLUS_DEBUT) or TUTO_RE.match(bt):
        exclus.append("tutoriel/témoignage")

    sujet_dz = bool(dz_titre) or (origine == "DZ" and bool(dz_resume))
    r = {
        "pays": "DZ" if sujet_dz else "INT",
        "origine": origine or "hors liste",
        "themes": sorted(set(th_titre) | set(th_resume)),
        "dz": (dz_titre or dz_resume)[:4],
    }
    if exclus:
        return {**r, "decision": "rejeter", "raison": "exclu : " + ", ".join(exclus[:3])}
    if origine is None and not sujet_dz:
        return {**r, "decision": "rejeter", "raison": "source hors liste validée"}
    if sujet_dz and forts_titre:
        return {**r, "decision": "garder", "raison": "Algérie + " + ", ".join(sorted(forts_titre))}
    if th_titre or th_resume:
        return {**r, "decision": "ambigu", "raison": "à arbitrer : " + ", ".join(sorted(forts or set(th_titre) | set(th_resume)))}
    return {**r, "decision": "rejeter", "raison": "hors thème TIC"}


# ── Gemini (cas ambigus) ─────────────────────────────────────────────────────
GEMINI_MODELES = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-flash-lite"]
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"

CONSIGNE = """Tu es rédacteur en chef d'Algeria Tech, média d'actualité TIC algérien.
Ligne éditoriale : télécoms et opérateurs, fibre/4G/5G/câbles sous-marins, marché mobile,
régulation du numérique (MPTIC, ARPCE, lois), souveraineté numérique, e-gouvernement,
startups, data/IA/cloud/datacenters, fintech et e-paiement, cybersécurité, spatial,
e-commerce, e-santé/edtech, industrie 4.0, smart city, compétences numériques, grandes
plateformes sous l'angle régulation/marché.
Pour chaque article, décide d'abord s'il concerne l'Algérie ("pays": "DZ" : acteur,
institution, marché ou décision algérienne) ou non ("pays": "INT"), quel que soit le site :
le nom ou le domaine du site ne compte pas (un site algérien ou « AlgeriaTech.news » qui
reprend une info américaine = "INT").
Sujet algérien : garder s'il y a une vraie dimension numérique/TIC ; rejeter l'économie,
la politique ou les faits divers sans dimension numérique. Pour l'Algérie, uniquement des
FAITS établis (annonce officielle, décision d'une institution, lancement par une entreprise,
chiffre officiel) : rejeter les études ou avis de consultants et d'experts privés, les
tribunes, analyses et opinions, les titres au conditionnel ou sensationnels.
Sujet international : barre haute. Garder seulement une info tech
de portée mondiale ou utile à un lecteur algérien du secteur (grands acteurs, régulation,
gros contrats ou levées, incident de sécurité majeur, infrastructures télécom/cloud/IA,
tendance de fond). Rejeter l'actualité locale étrangère de faible portée (ex. une banque
française adopte un outil), les nouveautés produits grand public, les interviews ou
tribunes promotionnelles, les événements promotionnels.
Toujours rejeter : tutoriels, bons plans, tests de produits, rumeurs, jeux vidéo, people,
divertissement, jeux-concours, témoignages personnels, armée et défense (ANP,
militaire), appels d'offres et avis
d'attribution, offres d'emploi, vie politique et élections (même si le numérique n'y est
qu'évoqué au passage).
Doublons : si deux articles racontent le même événement, garde le plus complet et mets
dans l'autre "doublon_de": <numéro>. Si un article raconte un événement de la liste
« DÉJÀ DIFFUSÉ », mets "doublon_de": "H".
Pour chaque article, réponds par un JSON strict : [{"i": <numéro>, "pays": "DZ"|"INT",
"garder": true|false, "raison": "<8 mots max>", "doublon_de": null|<numéro>|"H"}].
Rien d'autre."""


def _gemini_cle() -> str:
    return (os.environ.get("GEMINI_API_KEY") or "").strip()


_QUOTA_EPUISE = set()  # modèles dont le quota gratuit du jour est atteint


def _json_du_texte(sortie: str):
    """Extrait le JSON d'une réponse (tolère ```json … ``` et du texte autour)."""
    s = sortie.strip()
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s)
    try:
        return json.loads(s)
    except ValueError:
        m = re.search(r"(\{.*\}|\[.*\])", s, re.S)
        return json.loads(m.group(1)) if m else None


def appeler_freellmapi(texte: str, json_mode: bool, temperature: float, images: list):
    """Routeur FreeLLMAPI (compatible OpenAI) : il choisit le meilleur modèle
    gratuit disponible et bascule tout seul quand un fournisseur est saturé."""
    url, cle = os.environ.get("FREELLMAPI_URL"), os.environ.get("FREELLMAPI_KEY")
    if not url or not cle:
        return None
    contenu = [{"type": "text", "text": texte}] + [
        {"type": "image_url", "image_url": {"url": f"data:{m};base64,{d}"}} for m, d in images]
    corps = {"model": "auto", "temperature": temperature,
             "messages": [{"role": "user", "content": contenu if images else texte}]}
    if json_mode:
        corps["response_format"] = {"type": "json_object"}
    for essai in range(3):
        req = urllib.request.Request(f"{url.rstrip('/')}/chat/completions", data=json.dumps(corps).encode(),
                                     headers={"Content-Type": "application/json",
                                              "Authorization": f"Bearer {cle}"})
        try:
            with urllib.request.urlopen(req, timeout=180) as rep:
                data = json.load(rep)
            sortie = data["choices"][0]["message"]["content"] or ""
            modele = data.get("model", "?")
            print(f"[freellmapi] réponse de {modele}")
            return _json_du_texte(sortie) if json_mode else sortie.strip()
        except Exception as e:
            print(f"[freellmapi] essai {essai + 1} en échec : {type(e).__name__} {str(e)[:120]}")
            corps.pop("response_format", None)  # certains modèles refusent le mode JSON
            time.sleep(5)
    return None


def appeler_gemini(texte: str, json_mode: bool = True, temperature: float = 0, images: list = ()):
    """Appel IA : d'abord le routeur FreeLLMAPI s'il tourne (FREELLMAPI_URL),
    sinon Gemini en direct avec bascule de modèle et nouvelle tentative.
    images = [(mime, base64)] pour une analyse visuelle.
    Retourne le JSON décodé (json_mode) ou le texte ; None si tout échoue."""
    r = appeler_freellmapi(texte, json_mode, temperature, images)
    if r is not None:
        return r
    cle = _gemini_cle()
    if not cle:
        return None
    config = {"temperature": temperature}
    if json_mode:
        config["responseMimeType"] = "application/json"
    parts = [{"text": texte}] + [{"inline_data": {"mime_type": m, "data": d}} for m, d in images]
    corps = json.dumps({"contents": [{"role": "user", "parts": parts}],
                        "generationConfig": config}).encode()
    for modele in [m for m in GEMINI_MODELES for _ in range(2)]:  # 2 essais par modèle
        if modele in _QUOTA_EPUISE:
            continue
        req = urllib.request.Request(
            GEMINI_URL.format(m=modele), data=corps,
            headers={"Content-Type": "application/json", "x-goog-api-key": cle},
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as rep:
                data = json.load(rep)
            sortie = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(sortie) if json_mode else sortie.strip()
        except urllib.error.HTTPError as e:  # modèle suivant ; jamais la clé dans les logs
            try:
                msg = json.loads(e.read()).get("error", {}).get("message", "")[:160]
            except Exception:
                msg = ""
            print(f"[gemini] {modele} indisponible : HTTP {e.code} {msg}")
            if e.code == 429 and "quota" in msg.lower():
                _QUOTA_EPUISE.add(modele)  # quota du jour : inutile d'insister
            elif e.code in (429, 500, 503):
                time.sleep(20)
        except Exception as e:
            print(f"[gemini] {modele} indisponible : {type(e).__name__} {str(e)[:120]}")
    return None


def arbitrer_gemini(articles: list, deja: list = ()) -> dict:
    """Retourne {index: (garder, raison, doublon_de, pays)} ; {} si Gemini indisponible."""
    if not articles:
        return {}
    lignes = [
        f'{i}. {a.get("title", "")}'
        f' — {(a.get("summary") or a.get("resume") or "")[:200]}'
        for i, a in enumerate(articles)
    ]
    texte = CONSIGNE + "\n\nARTICLES :\n" + "\n".join(lignes)
    if deja:
        texte += "\n\nDÉJÀ DIFFUSÉ :\n" + "\n".join(f"- {t}" for t in deja[-40:])
    verdicts = appeler_gemini(texte)
    try:
        return {int(v["i"]): (bool(v["garder"]), str(v.get("raison", "")), v.get("doublon_de"),
                              v.get("pays"))
                for v in verdicts or []}
    except (TypeError, KeyError, ValueError) as e:
        print(f"[filtre] réponse Gemini illisible : {type(e).__name__}")
        return {}


def trier(articles: list, utiliser_gemini: bool = True, historique: list = ()):
    """Retourne (gardés, rejetés), chaque article enrichi d'un champ « filtre ».

    Les mots-clés écartent le hors-sujet évident ; Gemini tranche ensuite sur
    tous les candidats restants (ligne éditoriale + doublons + déjà diffusé).
    Sans Gemini : on garde seulement les « gardés d'office » par mots-clés.
    historique = [{url, empreinte, titre}] des infos déjà diffusées."""
    lot = []
    for a in articles:
        a = {**a, "title": nettoyer_titre(a.get("title") or a.get("titre") or "")}
        lot.append({**a, "filtre": analyser(a)})
    lot.sort(key=lambda a: (a["filtre"]["pays"] != "DZ", _neg_date(a)))
    candidats = [a for a in lot if a["filtre"]["decision"] != "rejeter"]
    deja = [h.get("titre", "") for h in historique if h.get("titre")]
    verdicts = {}
    if utiliser_gemini:  # lots de 100 (taille de requête raisonnable)
        for debut in range(0, len(candidats), 100):
            v = arbitrer_gemini(candidats[debut:debut + 100], deja)
            verdicts.update({debut + k: x if not isinstance(x[2], int) else (x[0], x[1], debut + x[2], x[3])
                             for k, x in v.items()})
    for k, a in enumerate(candidats):
        f = a["filtre"]
        if k in verdicts:
            ok, raison, doublon, pays = verdicts[k]
            if pays in ("DZ", "INT"):
                f["pays"] = pays  # Gemini juge sur le texte seul (le site ne lui est pas montré)
            if a.get("source") in SOURCES_OFFICIELLES:
                f["pays"] = "DZ"
            if doublon not in (None, k, "null", ""):
                f.update(decision="rejeter", raison="doublon / déjà diffusé (Gemini)")
            else:
                f.update(decision="garder" if ok else "rejeter", raison=f"Gemini : {raison}")
        elif f["decision"] == "ambigu":  # sans arbitrage : prudence
            f.update(decision="rejeter", raison=f["raison"] + " (non arbitré)")
    lot.sort(key=lambda a: (a["filtre"]["pays"] != "DZ", _neg_date(a)))  # Algérie d'abord
    gardes, rejetes, vus = [], [], list(historique)
    for a in lot:
        f = a["filtre"]
        if f["decision"] == "garder" and f["pays"] == "DZ" and not source_sure_dz(a):
            f.update(decision="rejeter", raison="info Algérie hors source sûre (.dz exigé)")
        if f["decision"] == "garder" and deja_diffuse(a, vus):
            f.update(decision="rejeter", raison="doublon / déjà diffusé")
        if f["decision"] == "garder":
            gardes.append(a)
            vus.append({"url": a.get("url", ""), "empreinte": empreinte(a)})
        else:
            rejetes.append(a)
    return gardes, rejetes


def _neg_date(a):
    d = a.get("date") or ""
    return "".join(chr(0x10FFFF - ord(c)) for c in d)  # tri décroissant sur ISO


# ── Mémoire des infos déjà diffusées ─────────────────────────────────────────
def empreinte(article: dict) -> str:
    t = normaliser(article.get("title") or article.get("titre") or "")
    mots = [m for m in re.findall(r"[a-z0-9]{4,}", t)]
    return " ".join(sorted(set(mots))[:12])


def deja_diffuse(article: dict, historique: list) -> bool:
    """historique = [{url, empreinte}] ; même URL ou ≥ 60 % de mots communs."""
    url = (article.get("url") or "").split("?")[0]
    e = set(empreinte(article).split())
    for h in historique:
        if url and h.get("url", "").split("?")[0] == url:
            return True
        he = set((h.get("empreinte") or "").split())
        if e and he and len(e & he) / min(len(e), len(he)) >= 0.6:
            return True
    return False
