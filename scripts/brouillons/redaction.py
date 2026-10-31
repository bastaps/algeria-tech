"""Rédaction éditoriale commune au circuit PC (circuit_flow.py) et au repli cloud (circuit_cloud.py).

Garantit le format Algeria Tech :
  - rédaction IA (jamais un résumé « mécanique » : si l'IA est indisponible, l'article n'est pas produit) ;
  - corps structuré + tableau Markdown quand la source contient des chiffres ;
  - section « À retenir » (liste à puces) en bas d'article + champ d'en-tête `aretenir` (points séparés par « | ») ;
  - sourcing : site officiel de l'entité concernée (récupéré, vérifié, cité) avant le média relais ;
  - vidéo seulement si l'image de l'article montre un élément concret du sujet (jamais de visuel générique).
Stdlib + requests + bs4 ; IA via scripts/express/filtre_editorial.appeler_gemini (routeur puis Gemini).
"""
import base64
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "express"))
from filtre_editorial import appeler_gemini  # noqa: E402
from sources import UA  # noqa: E402
import dedup as _DD  # noqa: E402  (pertinence des vidéos YouTube reprises)

CATEGORIES = ["Algérie", "Télécoms", "Mobile", "Startups", "IA", "Fintech", "Innovation", "Monde", "Entreprises"]

# Hôtes qui ne sont jamais une « source officielle » d'une entité
EXCLUS = ("wikipedia.", "linkedin.", "facebook.", "twitter.", "x.com", "youtube.", "youtu.be", "instagram.", "tiktok.",
          "google.", "reddit.", "medium.", "news.", "bing.", "yahoo.", "github.com")

PROMPT_REDACTION = """Tu es journaliste pour Algeria Tech, média algérien des technologies et du numérique.
Rédige un article ORIGINAL en français à partir de l'information ci-dessous. Tu REFORMULES : aucune phrase
recopiée, aucune citation longue. Style factuel d'agence de presse, clair, sobre, sans formules creuses
(« il convient de noter », « dans un contexte de », « force est de constater », « révolutionnaire »).

RÈGLES ABSOLUES
- N'invente RIEN : pas de chiffre, de nom, de date, de citation ni de sigle absents des textes fournis.
- Si une information manque, ne la mentionne pas. Un article court vaut mieux qu'un article gonflé.
- S'il y a un bloc « SOURCE OFFICIELLE », ses faits priment sur ceux du média en cas de divergence.
- N'écris AUCUNE section « Pour rappel », « Contexte », « Perspectives » ni « À retenir » dans "contenu" :
  l'« À retenir » est fourni à part dans "a_retenir" et ajouté par le système.

STRUCTURE de "contenu" (Markdown, 280 à 480 mots selon la matière réelle) :
## [Intertitre qui annonce le fait principal]
paragraphes courts séparés par une ligne vide (3 à 6).
Si les textes contiennent des données chiffrées, tarifs, dates, comparaisons ou listes structurées,
INSÈRE au moins un tableau Markdown (uniquement avec des données présentes dans les textes) :
| Colonne 1 | Colonne 2 |
|---|---|
| donnée | donnée |
Un deuxième intertitre « ## » est permis si le sujet a deux volets.

"a_retenir" : 3 à 5 points clés, une phrase courte chacun (28 mots maximum), uniquement des faits des textes.

{officiel}Média relais : {source}
Titre d'origine : {titre}
Texte du média :
{corps}

Réponds UNIQUEMENT par un JSON :
{{"titre": "titre factuel de 90 caractères maximum, sans point final",
  "lead": "chapô de 2 phrases (35 à 60 mots) : qui, quoi, où, quand — sans dateline, sans « ALGER — », sans titre",
  "extrait": "résumé de 200 caractères maximum",
  "categorie": "UNE valeur parmi : {categories}",
  "tags": ["3 à 6 mots-clés courts"],
  "contenu": "le corps de l'article en Markdown, sans « À retenir »",
  "a_retenir": ["point 1", "point 2", "point 3"]}}"""

PROMPT_ENTITES = """Voici un article de presse. Identifie au plus 3 organisations (entreprises, institutions, organismes) qui
sont les ACTEURS PRINCIPAUX du fait rapporté (pas les médias, pas les réseaux sociaux, pas Wikipédia).
Pour chacune, donne l'adresse du SITE OFFICIEL PRINCIPAL (https://domaine) uniquement si tu la connais avec certitude,
et 0 à 3 chemins probables de sa page actualités/presse/blog (ex: "/newsroom", "/actualites").
Réponds UNIQUEMENT par un JSON : {{"entites": [{{"nom": "...", "site": "https://...", "pages": ["/..."]}}]}}

Titre : {titre}
Texte : {corps}"""

PROMPT_MEME_FAIT = """Un article de presse rapporte ceci : « {titre} » — {resume}
Voici un extrait d'une page du site officiel de l'organisation concernée :
\"\"\"{extrait}\"\"\"
Cette page rapporte-t-elle LE MÊME fait précis (même annonce, même événement, même sujet), et pas seulement la même entreprise ?
Réponds UNIQUEMENT par un JSON : {{"meme_fait": true|false}}"""

PROMPT_IMAGE = """Cette image illustre un article de presse intitulé : « {titre} ».
Réponds UNIQUEMENT par un JSON : {{"personnes": true|false, "texte_visible": true|false, "raison": "une phrase"}}
personnes = true si l'image montre une ou plusieurs PERSONNES RÉELLES (visages, responsables, ministre, président, dirigeants,
foule, conférence, cérémonie), même de dos ou en petit.
texte_visible = true si l'image contient DÉJÀ du texte lisible et important (titre, slogan, affiche, infographie, capture
d'écran avec texte, bandeau, inscriptions). false si c'est une photo ou une illustration sans texte (ou seulement un petit logo)."""

# Consigne Flow « image + texte » : la recette de l'éditeur — coller l'image puis demander une vidéo 16/9 « illustrant le texte
# suivant : « … » » ; l'IA reste fidèle à l'image, affiche le texte et le lit à voix haute. Le prompt INSISTE sur le texte et la voix.
PROMPT_FLOW_TEXTE = ("Génère une vidéo en 16/9 illustrant le texte suivant : « {phrase} ». Reste fidèle à l'image fournie "
                     "(mêmes éléments, même décor). IMPORTANT : le texte « {phrase} » doit apparaître à l'écran, bien lisible, en "
                     "sous-titre incrusté, ET être lu à voix haute en français par une voix off claire et posée, du début à la "
                     "fin de la vidéo. Mouvements lents et discrets, aucune autre inscription, aucun logo ajouté.")
# Image qui contient déjà du texte : on l'anime seulement (pas de texte ajouté, pas de voix off)
PROMPT_FLOW_ANIMER = ("Anime cette image en une vidéo de 8 secondes au format 16:9. Mouvements naturels et discrets, léger travelling "
                      "avant. Conserve exactement le texte déjà présent dans l'image, sans rien ajouter ni modifier. "
                      "Ambiance sonore naturelle et discrète, sans voix off.")
VIDEO_MODES = ("image_texte", "image_anime")   # modes qui exigent une génération Flow


def phrase_video(titre):
    """Texte lu et affiché dans la vidéo : le titre de l'article (8 s de voix ≈ 20 mots), coupé proprement, sans guillemets."""
    t = re.sub(r"\s+", " ", str(titre or "")).strip().replace("«", "").replace("»", "").replace('"', "")
    t = re.sub(r"\s[|–—]\s[^|–—]{2,40}$", "", t)   # suffixe « | Nom du site » des titres de page
    t = re.sub(r"\s+", " ", t).strip()
    if t.isupper():   # titres tout en majuscules des sites officiels : casse normale (noms propres en majuscule initiale)
        petits = {"de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "pour", "par", "sur", "dans", "un", "une", "d", "l", "à"}
        mots = t.lower().split(" ")
        t = " ".join(m if (m in petits and i) else m[:1].upper() + m[1:] for i, m in enumerate(mots))
    if len(t) > 115:
        t = t[:115].rsplit(" ", 1)[0].rstrip(" ,;:-–—")
    return t



def log(m):
    print(f"[redaction] {m}", flush=True)


# ── Rédaction IA ──────────────────────────────────────────────────────────
def _nb_mots(t):
    return len(str(t or "").split())


def _a_tableau(t):
    return bool(re.search(r"^\s*\|.+\|\s*$\n^\s*\|[\s:|-]+\|\s*$", str(t or ""), re.M))


def _nb_chiffres(t):
    return len(re.findall(r"\d[\d  .,]*\d|\d", str(t or "")))


def rediger(source, titre, corps, officiel=None):
    """Article IA au format Algeria Tech, ou None si l'IA est indisponible / insuffisante (jamais de repli mécanique)."""
    bloc = ""
    if officiel:
        bloc = "SOURCE OFFICIELLE (faits prioritaires) :\n" + "\n\n".join(
            f"[{o['nom']} — {o['url']}]\n{o['extrait']}" for o in officiel) + "\n\n"
    base = PROMPT_REDACTION.format(officiel=bloc, source=source, titre=titre, corps=corps[:7000],
                                   categories=", ".join(CATEGORIES))
    red = None
    tableau_demande = False
    for essai in range(5):
        consigne = base + ("\n\nRAPPEL : ajoute un tableau Markdown avec les chiffres du texte." if tableau_demande else "")
        if essai:
            time.sleep(8)  # pointes de charge de l'IA : courte pause avant de réessayer
        r = appeler_gemini(consigne, temperature=0.35)
        if not isinstance(r, dict) or not r.get("titre") or _nb_mots(r.get("contenu")) < 150:
            log("rédaction IA insuffisante")
            continue
        red = r
        # la source contient des chiffres → un tableau est attendu ; une seule relance
        if not tableau_demande and _nb_chiffres(corps + (bloc or "")) >= 6 and not _a_tableau(r.get("contenu")):
            tableau_demande = True  # une seule relance pour obtenir le tableau
            continue
        break
    if not red:
        return None
    pts = [re.sub(r"\s+", " ", str(p)).strip() for p in (red.get("a_retenir") or []) if str(p).strip()]
    if len(pts) < 3:
        log("« À retenir » insuffisant")
        return None
    red["a_retenir"] = pts[:5]
    red["lead"] = re.sub(r"\s+", " ", str(red.get("lead") or red.get("extrait") or "")).strip()
    red["contenu"] = re.sub(r"\n#{1,3}\s*(À retenir|A retenir|Pour rappel|Contexte)\b[\s\S]*$", "", str(red["contenu"]),
                            flags=re.I).strip()
    return red


def champ_aretenir(points):
    """Valeur de l'en-tête `aretenir` : points séparés par « | » (format lu par le site)."""
    return " | ".join(re.sub(r"\s+", " ", p).replace('"', "'").replace("|", "/").strip() for p in points)


MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def dateline(d=None):
    """« Alger, 28 octobre 2026 (Algeria Tech) — » : la signature ajoutée par Smart Ingest PRO en tête de chaque article."""
    import datetime as _dt
    d = d or (_dt.datetime.utcnow() + _dt.timedelta(hours=1))
    return f"Alger, {d.day} {MOIS_FR[d.month - 1]} {d.year} (Algeria Tech) — "


def retirer_dateline(texte):
    """Retire une dateline déjà présente (« ALGER — », « ALGER, 7 août 2026 (APS) — »), comme le fait Smart Ingest PRO."""
    return re.sub(r"^[A-ZÀ-Ÿ][A-ZÀ-Ÿ' -]{1,24}(?:,\s*[^()\n]{0,40})?(?:\s*\([^)\n]{1,30}\))?\s*[—–-]\s+", "", texte or "")


def corps_pro(lead, contenu):
    """Corps d'article au format Smart Ingest PRO « Générer avec IA » : dateline + chapô, puis le développement."""
    lead = retirer_dateline(re.sub(r"\s+", " ", str(lead or "")).strip())
    tete = (dateline() + lead) if lead else ""
    return (tete + "\n\n" + str(contenu).strip()).strip()


def assembler(contenu, points, nom_media, url_media, officiels=(), lead="", source_admin=False, direct=False):
    """Corps final : dateline + chapô + article, « À retenir » en bas, « Sources » (officielle d'abord).
    source_admin : aucune source d'origine identifiable parmi plusieurs sites → « Source : Admin » (pas de média cité)."""
    out = [corps_pro(lead, contenu), "## À retenir", "\n".join(f"- {p}" for p in points)]
    out += ["## Sources", "\n".join(lignes_sources(officiels, nom_media, url_media, source_admin, direct))]
    return "\n\n".join(out) + "\n"


def lignes_sources(officiels, nom_media, url_media, admin=False, direct=False):
    """Puces de la section « Sources » : origine officielle d'abord ; « Source : Admin » si l'origine est introuvable parmi plusieurs
    sites ; direct=True quand la page lue EST la publication officielle (communiqué, scoop) ; sinon le média cité."""
    if admin and not officiels:
        return ["- Source : Admin"]
    if direct:
        return [f"- Source officielle : [{nom_media}]({url_media})"]
    lignes = [f"- Source officielle : [{o['nom']}]({o['url']})" for o in officiels]
    # sans source officielle distincte, le média cité EST la source ; « relayé par » seulement s'il y en a une
    lignes.append(f"- {'Article relayé par' if officiels else 'Source'} : [{nom_media}]({url_media})")
    return lignes


# ── Sources officielles ───────────────────────────────────────────────────
def _hote(url):
    return urlparse(url).netloc.lower().removeprefix("www.")


def _get(url, timeout=12):
    try:
        r = requests.get(url, timeout=timeout, headers=UA, allow_redirects=True)
        if r.status_code != 200 or "html" not in r.headers.get("content-type", "") or len(r.content) > 2_500_000:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        for t in soup(["script", "style", "noscript", "nav", "footer"]):
            t.decompose()
        return r.url, soup
    except requests.RequestException:
        return None


def _jetons(titre, corps):
    """Éléments distinctifs de l'article (chiffres, versions, noms propres) pour vérifier qu'une page officielle en parle."""
    t = f"{titre}\n{corps[:3500]}"
    jetons = set(m.lower() for m in re.findall(r"\b\d[\d.,]{2,}\b|\b[A-Z][a-zA-Z0-9]{4,}\b", t))
    banals = {"selon", "cette", "depuis", "leurs", "comme", "alors", "entre", "après", "avant", "algérie", "france"}
    return {j for j in jetons if j not in banals}


def sources_officielles(titre, corps, url_source, max_entites=3):
    """Cherche sur le SITE OFFICIEL des acteurs de l'article une page qui parle du même fait.
    Renvoie [{nom, url, extrait}] vérifiés (page réellement lue, au moins 3 éléments distinctifs retrouvés)."""
    rep = appeler_gemini(PROMPT_ENTITES.format(titre=titre, corps=corps[:3000]), temperature=0)
    entites = rep.get("entites") if isinstance(rep, dict) else None
    if not entites:
        return []
    hote_src = _hote(url_source)
    jetons = _jetons(titre, corps)
    trouves = []
    for e in entites[:max_entites]:
        nom, site = str(e.get("nom") or "").strip(), str(e.get("site") or "").strip()
        if not nom or not site.startswith("http"):
            continue
        base = urlparse(site)
        hote = _hote(site)
        if not hote or hote == hote_src or any(x in hote for x in EXCLUS):
            continue
        accueil = _get(f"{base.scheme}://{base.netloc}/")
        if not accueil:
            continue
        url_accueil, soup = accueil
        texte_acc = soup.get_text(" ", strip=True).lower()
        titre_acc = (soup.title.string or "").lower() if soup.title else ""
        if nom.split()[0].lower() not in (titre_acc + " " + texte_acc[:4000]):
            continue  # le site ne semble pas être celui de l'entité
        candidats = []
        for chemin in (e.get("pages") or [])[:3]:
            if isinstance(chemin, str) and chemin.startswith("/"):
                candidats.append(urljoin(url_accueil, chemin))
        for a in soup.find_all("a", href=True):
            lien = urljoin(url_accueil, a["href"])
            if _hote(lien) == hote and re.search(r"press|news|actu|blog|communiqu|media|newsroom|presse", lien + " " + a.get_text(" "), re.I):
                candidats.append(lien.split("#")[0])
        vus, meilleur = set(), None
        for lien in [url_accueil] + candidats:
            if lien in vus or len(vus) >= 6:
                continue
            vus.add(lien)
            page = _get(lien) if lien != url_accueil else accueil
            if not page:
                continue
            texte = page[1].get_text(" ", strip=True)
            bas = texte.lower()
            hits = [j for j in jetons if j in bas and j not in nom.lower()]
            if len(hits) >= 3 and (not meilleur or len(hits) > meilleur[0]):
                paras = [p.get_text(" ", strip=True) for p in page[1].find_all(["p", "li", "h1", "h2", "h3"])]
                bons = [p for p in paras if any(h in p.lower() for h in hits) and len(p) > 40][:4]
                extrait = " ".join(bons)[:900]
                if extrait:
                    meilleur = (len(hits), page[0], extrait)
        if meilleur:
            resume = corps[:600].replace("\n", " ")
            verdict = appeler_gemini(PROMPT_MEME_FAIT.format(titre=titre, resume=resume, extrait=meilleur[2]),
                                     temperature=0)
            if isinstance(verdict, dict) and verdict.get("meme_fait") is True:
                trouves.append({"nom": nom, "url": meilleur[1], "extrait": meilleur[2]})
                log(f"source officielle retrouvée : {nom} — {meilleur[1]}")
            else:
                log(f"page officielle écartée (autre sujet) : {nom} — {meilleur[1]}")
    # 2e stratégie : recherche web (Gemini + Google Search) de la page officielle, puis lecture et vérification
    deja = {o["nom"] for o in trouves}
    for e in entites[:1]:   # une seule recherche Google par article (l'acteur principal) : le quota de la recherche est limité
        nom = str(e.get("nom") or "").strip()
        if not nom or nom in deja:
            continue
        o = _via_recherche(nom, titre, corps, url_source, jetons)
        if o:
            trouves.append(o)
    return trouves


_RECHERCHE = {"epuisee": False}   # quota « recherche Google » de Gemini atteint : on n'insiste plus pendant ce passage


def _quota_recherche(r):
    if r.status_code == 429:
        _RECHERCHE["epuisee"] = True
        log("quota de la recherche Google (Gemini) atteint : suite sans recherche pour ce passage")


def _gemini_recherche(prompt):
    """Gemini avec Google Search ; renvoie les adresses des pages citées (redirections résolues)."""
    import json as _j
    from filtre_editorial import GEMINI_MODELES, GEMINI_URL, _gemini_cle
    cle = _gemini_cle()
    if not cle or _RECHERCHE["epuisee"]:
        return []
    corps = _j.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                      "tools": [{"google_search": {}}], "generationConfig": {"temperature": 0}})
    for modele in GEMINI_MODELES[:3]:
        try:
            r = requests.post(GEMINI_URL.format(m=modele), data=corps, timeout=90,
                              headers={"Content-Type": "application/json", "x-goog-api-key": cle})
            if r.status_code != 200:
                _quota_recherche(r)
                if _RECHERCHE["epuisee"]:
                    break
                continue
            cand = (r.json().get("candidates") or [{}])[0]
            chunks = (cand.get("groundingMetadata") or {}).get("groundingChunks") or []
            urls = []
            for c in chunks[:8]:
                u = (c.get("web") or {}).get("uri")
                if not u:
                    continue
                try:
                    u = requests.get(u, timeout=12, headers=UA, allow_redirects=True, stream=True).url
                except requests.RequestException:
                    continue
                urls.append(u)
            return urls
        except requests.RequestException:
            continue
    return []


def _via_recherche(nom, titre, corps, url_source, jetons):
    """Page OFFICIELLE de l'entité (son domaine ou son compte) qui parle du même fait ; None sinon."""
    urls = _gemini_recherche(f"Trouve la page officielle de {nom} (site de l'organisation, blog, communiqué de presse, "
                             f"notes de version, ou son compte officiel) qui annonce ou documente ceci : {titre}. "
                             f"Donne les adresses.")
    marque = re.sub(r"[^a-z0-9]", "", nom.split()[0].lower())
    hote_src = _hote(url_source)
    for u in urls:
        hote = _hote(u)
        if not hote or hote == hote_src or len(marque) < 3:
            continue
        reseau = any(x in hote for x in ("facebook.", "x.com", "twitter.", "linkedin.", "instagram.", "youtube."))
        # officiel = le domaine porte la marque (ex. nvidia.com) ; un compte de réseau social doit porter la marque dans son chemin
        if not ((not reseau and marque in hote.replace("-", "").replace(".", "")) or
                (reseau and marque in re.sub(r"[^a-z0-9]", "", urlparse(u).path.lower()))):
            continue
        page = _get(u)
        if not page:
            continue
        texte = page[1].get_text(" ", strip=True)
        bas = texte.lower()
        hits = [j for j in jetons if j in bas and j not in nom.lower()]
        if len(hits) < 3:
            continue
        paras = [p.get_text(" ", strip=True) for p in page[1].find_all(["p", "li", "h1", "h2", "h3"])]
        extrait = " ".join([p for p in paras if any(h in p.lower() for h in hits) and len(p) > 40][:4])[:900]
        if not extrait:
            continue
        verdict = appeler_gemini(PROMPT_MEME_FAIT.format(titre=titre, resume=corps[:600].replace("\n", " "),
                                                         extrait=extrait), temperature=0)
        if isinstance(verdict, dict) and verdict.get("meme_fait") is True:
            log(f"source officielle (recherche) : {nom} — {page[0]}")
            return {"nom": nom, "url": page[0], "extrait": extrait}
    return None


# ── Source d'origine (2026-10-28) ─────────────────────────────────────────
# Règle de l'éditeur : l'article cite d'abord la publication d'ORIGINE (site de l'entreprise / institution, ou sa page Facebook officielle).
# Si l'origine est introuvable : « Source : Admin » — sauf si UN SEUL site a publié l'info et que les autres le reprennent (on cite ce site).
PROMPT_ORIGINE = """Information : « {titre} »
Résumé : {resume}
Média lu : {media} ({url})

Retrouve, avec la recherche web, la SOURCE D'ORIGINE de cette information : la publication de l'entreprise ou de l'institution
concernée (communiqué sur son site, ou sa page Facebook officielle), sinon le premier média qui l'a publiée.
Réponds UNIQUEMENT par un JSON, sans texte autour :
{{"origine": "officielle" | "media_unique" | "plusieurs_sans_origine",
  "nom": "nom de l'organisation ou du média d'origine",
  "url": "adresse EXACTE de la publication d'origine (https://…), vide si inconnue",
  "medias": ["domaines des médias qui ont publié l'information"],
  "explication": "une phrase"}}
officielle = l'organisation concernée a publié l'information elle-même (site officiel ou page Facebook officielle de l'organisation).
media_unique = un seul site a publié l'information et tous les autres la reprennent de ce site.
plusieurs_sans_origine = plusieurs sites indépendants la publient, sans source d'origine identifiable."""


def _gemini_recherche_texte(prompt):
    """Gemini + Google Search : (texte de la réponse, adresses des pages citées). ('', []) si indisponible."""
    import json as _j
    from filtre_editorial import GEMINI_MODELES, GEMINI_URL, _gemini_cle
    cle = _gemini_cle()
    if not cle or _RECHERCHE["epuisee"]:
        return "", []
    corps = _j.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                      "tools": [{"google_search": {}}], "generationConfig": {"temperature": 0}})
    for modele in GEMINI_MODELES[:3]:
        try:
            r = requests.post(GEMINI_URL.format(m=modele), data=corps, timeout=90,
                              headers={"Content-Type": "application/json", "x-goog-api-key": cle})
            if r.status_code != 200:
                _quota_recherche(r)
                if _RECHERCHE["epuisee"]:
                    break
                continue
            cand = (r.json().get("candidates") or [{}])[0]
            texte = "".join(p.get("text", "") for p in (cand.get("content") or {}).get("parts", []))
            urls = []
            for c in ((cand.get("groundingMetadata") or {}).get("groundingChunks") or [])[:10]:
                u = (c.get("web") or {}).get("uri")
                if u:
                    try:
                        u = requests.get(u, timeout=12, headers=UA, allow_redirects=True, stream=True).url
                    except requests.RequestException:
                        pass
                    urls.append(u)
            return texte, urls
        except requests.RequestException:
            continue
    return "", []


def resoudre_sources(titre, corps, url_media, nom_media, origine_officielle=False):
    """{'officiels': [{nom, url, extrait}], 'admin': bool, 'nom': str, 'url': str}.
    - officiels : publication d'origine de l'organisation concernée (site vérifié, ou page Facebook officielle trouvée par la recherche) ;
    - admin=True : plusieurs sites, aucune origine identifiable → « Source : Admin » ;
    - sinon nom/url = le média cité (seul site, ou recherche indisponible : on ne prétend rien de plus)."""
    sortie = {"officiels": [], "admin": False, "nom": nom_media, "url": url_media}
    if origine_officielle:                      # la source lue EST la page officielle (communiqué, scoop)
        return sortie
    sortie["officiels"] = sources_officielles(titre, corps, url_media)
    if sortie["officiels"]:
        return sortie
    texte, urls = _gemini_recherche_texte(PROMPT_ORIGINE.format(
        titre=titre, resume=re.sub(r"\s+", " ", corps[:700]), media=nom_media, url=url_media))
    m = re.search(r"\{[\s\S]*\}", texte or "")
    if not m:
        log("origine de la source : recherche indisponible, média cité")
        return sortie
    try:
        import json as _j
        rep = _j.loads(m.group(0))
    except ValueError:
        return sortie
    kind, nom, url = str(rep.get("origine") or ""), str(rep.get("nom") or "").strip(), str(rep.get("url") or "").strip()
    log(f"origine de la source : {kind} — {nom} {url} — {str(rep.get('explication') or '')[:120]}")
    cite = {re.sub(r"[?#].*$", "", u).rstrip("/") for u in urls}
    if kind == "officielle" and url.startswith("http") and re.sub(r"[?#].*$", "", url).rstrip("/") in cite:
        reseau = any(x in _hote(url) for x in ("facebook.", "fb.com", "x.com", "twitter.", "linkedin.", "instagram."))
        if reseau or _get(url):                 # page réellement joignable (ou publication de réseau social trouvée par la recherche)
            sortie["officiels"] = [{"nom": nom or _hote(url), "url": url, "extrait": ""}]
    elif kind == "media_unique" and url.startswith("http") and _hote(url) != _hote(url_media):
        sortie["nom"], sortie["url"] = nom or _hote(url), url
    elif kind == "plusieurs_sans_origine":
        sortie["admin"] = True
    return sortie


# ── Vidéo : politique éditoriale ──────────────────────────────────────────
# 1. JAMAIS d'animation d'une image qui montre des personnes réelles (ministre, président, responsables…) : la photo EST l'information.
# 2. Une vidéo du média qui ACCOMPAGNE l'article (YouTube intégré) est reprise et publiée telle quelle.
# 3. Sinon (aucune personne) : image + texte (illustre le titre, texte affiché ET lu à voix haute) ; si l'image contient déjà du texte,
#    on l'anime seulement. (2026-10-27 : fin des vidéos « concept » sans texte ni voix, hors contexte.)
def video_source(html, titre="", extrait=""):
    """Adresse YouTube d'une vidéo qui accompagne VRAIMENT l'article, ou ''. Si un titre est fourni, chaque vidéo trouvée dans la page est
    contrôlée (titre lu via oEmbed) : une vidéo sans rapport avec l'article (autre sujet du même média) est écartée."""
    vus = []
    for m in re.finditer(r"(?:youtube(?:-nocookie)?\.com/(?:embed/|watch\?v=)|youtu\.be/)([A-Za-z0-9_-]{11})", html or ""):
        if m.group(1) not in vus:
            vus.append(m.group(1))
    for vid in vus[:4]:
        if not titre:
            return f"https://www.youtube.com/watch?v={vid}"
        if _DD.video_yt_pertinente(vid, titre, extrait):
            return f"https://www.youtube.com/watch?v={vid}"
        log(f"vidéo YouTube {vid} écartée : sans rapport avec « {titre[:60]} »")
    return ""


def politique_video(jpg_bytes, titre, resume, html_page=""):
    """{'mode': 'aucune'|'source'|'image_texte'|'image_anime', 'raison', 'video_url', 'prompt'}. Sans réponse de l'IA : aucune.
    - source : vidéo YouTube du média déjà dans l'article, reprise telle quelle ;
    - image_texte : image sans texte → Flow « illustrant le texte suivant : « titre » » (texte affiché + voix off) ;
    - image_anime : image qui contient déjà du texte → Flow anime seulement l'image ;
    - aucune : personnes réelles (haut responsable…) sur l'image, ou analyse impossible."""
    src = video_source(html_page, titre, resume)
    if src:
        return {"mode": "source", "raison": "vidéo du média intégrée à l'article", "video_url": src, "prompt": ""}
    try:
        rep = appeler_gemini(PROMPT_IMAGE.format(titre=titre), temperature=0,
                             images=[("image/jpeg", base64.b64encode(jpg_bytes).decode())])
    except Exception as e:  # noqa: BLE001
        return {"mode": "aucune", "raison": f"analyse impossible ({type(e).__name__})", "video_url": "", "prompt": ""}
    if not isinstance(rep, dict):
        return {"mode": "aucune", "raison": "analyse d'image indisponible", "video_url": "", "prompt": ""}
    raison = str(rep.get("raison") or "")[:200]
    if rep.get("personnes") is not False:  # personnes réelles (ou doute) : la photo est l'information, on n'anime jamais
        return {"mode": "aucune", "raison": "personnes réelles sur l'image — jamais d'animation. " + raison, "video_url": "", "prompt": ""}
    if rep.get("texte_visible") is True:
        return {"mode": "image_anime", "raison": "l'image contient déjà du texte : animation seule. " + raison, "video_url": "",
                "prompt": PROMPT_FLOW_ANIMER}
    return {"mode": "image_texte", "raison": "image sans texte : vidéo qui illustre le titre (texte affiché + voix off). " + raison,
            "video_url": "", "prompt": PROMPT_FLOW_TEXTE.format(phrase=phrase_video(titre))}


def video_pertinente(jpg_bytes, titre):
    """Compatibilité : (True, raison) quand une génération Flow est prévue."""
    r = politique_video(jpg_bytes, titre, "")
    return r["mode"] in VIDEO_MODES, r["raison"]
