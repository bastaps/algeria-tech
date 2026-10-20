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
Réponds UNIQUEMENT par un JSON : {{"personnes": true|false, "generique": true|false, "raison": "une phrase"}}
personnes = true si l'image montre une ou plusieurs PERSONNES RÉELLES (visages, responsables, ministre, président, dirigeants,
foule, conférence, cérémonie), même de dos ou en petit.
generique = true SEULEMENT si c'est un visuel décoratif sans information propre : robot, cerveau, puce, hologramme, silhouette,
fond abstrait, illustration générée par IA, banque d'images, logo seul. generique = false si l'image montre un élément réel
du sujet (produit, appareil, lieu, interface, graphique, tableau de données, événement)."""

PROMPT_CONCEPT = """Écris un prompt de génération vidéo (Veo, 8 secondes, 16:9) qui met en images l'IDÉE du titre ci-dessous,
sous forme de plans cinématographiques abstraits ou symboliques (données qui circulent, réseau, écrans, villes la nuit,
infrastructure, textures de matière, mouvement de caméra lent).
INTERDIT : toute personne, visage, silhouette humaine, ministre, président, drapeau, logo, marque, texte à l'écran, armes,
violence. Ton sobre et professionnel, pas de robot qui danse, pas de musique ni de paroles, léger bruit d'ambiance.
Réponds UNIQUEMENT par un JSON : {{"prompt": "le prompt en français, 60 mots maximum"}}
Titre : {titre}
Résumé : {resume}"""


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
    red["contenu"] = re.sub(r"\n#{1,3}\s*(À retenir|A retenir|Pour rappel|Contexte)\b[\s\S]*$", "", str(red["contenu"]),
                            flags=re.I).strip()
    return red


def champ_aretenir(points):
    """Valeur de l'en-tête `aretenir` : points séparés par « | » (format lu par le site)."""
    return " | ".join(re.sub(r"\s+", " ", p).replace('"', "'").replace("|", "/").strip() for p in points)


def assembler(contenu, points, nom_media, url_media, officiels=()):
    """Corps final : article + « À retenir » en bas + « Sources » (officielle d'abord)."""
    out = [contenu.strip(), "## À retenir", "\n".join(f"- {p}" for p in points)]
    lignes = [f"- Source officielle : [{o['nom']}]({o['url']})" for o in officiels]
    # sans source officielle distincte, le média (ou l'institution) cité EST la source ; « relayé par » seulement s'il y en a une
    lignes.append(f"- {'Article relayé par' if officiels else 'Source'} : [{nom_media}]({url_media})")
    out += ["## Sources", "\n".join(lignes)]
    return "\n\n".join(out) + "\n"


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
    for e in entites[:max_entites]:
        nom = str(e.get("nom") or "").strip()
        if not nom or nom in deja:
            continue
        o = _via_recherche(nom, titre, corps, url_source, jetons)
        if o:
            trouves.append(o)
    return trouves


def _gemini_recherche(prompt):
    """Gemini avec Google Search ; renvoie les adresses des pages citées (redirections résolues)."""
    import json as _j
    from filtre_editorial import GEMINI_MODELES, GEMINI_URL, _gemini_cle
    cle = _gemini_cle()
    if not cle:
        return []
    corps = _j.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                      "tools": [{"google_search": {}}], "generationConfig": {"temperature": 0}})
    for modele in GEMINI_MODELES[:3]:
        try:
            r = requests.post(GEMINI_URL.format(m=modele), data=corps, timeout=90,
                              headers={"Content-Type": "application/json", "x-goog-api-key": cle})
            if r.status_code != 200:
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


# ── Vidéo : politique éditoriale ──────────────────────────────────────────
# 1. JAMAIS d'animation d'une image qui montre des personnes réelles (ministre, président, responsables…) : la photo EST l'information.
# 2. Une vidéo du média qui ACCOMPAGNE l'article (YouTube intégré) est reprise et publiée telle quelle.
# 3. Sinon, vidéo « concept » (texte → vidéo, sans personne) UNIQUEMENT si l'image est un visuel générique ; si l'image est une
#    information en soi (produit, interface, graphique, événement) : pas de vidéo.
def video_source(html):
    """Adresse YouTube d'une vidéo qui accompagne l'article (iframe intégrée ou lien), ou ''."""
    for m in re.finditer(r"(?:youtube(?:-nocookie)?\.com/(?:embed/|watch\?v=)|youtu\.be/)([A-Za-z0-9_-]{11})", html or ""):
        return f"https://www.youtube.com/watch?v={m.group(1)}"
    return ""


def politique_video(jpg_bytes, titre, resume, html_page=""):
    """{'mode': 'aucune'|'source'|'concept', 'raison': str, 'video_url': str, 'prompt': str}. Sans réponse de l'IA : aucune."""
    src = video_source(html_page)
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
    if rep.get("generique") is not True:
        return {"mode": "aucune", "raison": "l'image est déjà une information (produit, interface, graphique…). " + raison, "video_url": "", "prompt": ""}
    p = appeler_gemini(PROMPT_CONCEPT.format(titre=titre, resume=str(resume)[:500]), temperature=0.4)
    prompt = str(p.get("prompt") or "").strip() if isinstance(p, dict) else ""
    if not prompt:
        return {"mode": "aucune", "raison": "prompt de vidéo concept indisponible", "video_url": "", "prompt": ""}
    return {"mode": "concept", "raison": "visuel générique : vidéo concept sans personne. " + raison, "video_url": "", "prompt": prompt}


def video_pertinente(jpg_bytes, titre):
    """Compatibilité : (True, raison) seulement pour une vidéo concept."""
    r = politique_video(jpg_bytes, titre, "")
    return r["mode"] == "concept", r["raison"]
