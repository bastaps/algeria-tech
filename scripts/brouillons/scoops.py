"""Scoops : informations de PREMIÈRE MAIN trouvées par l'IA sur les sites et pages Facebook officiels (2026-10-28).

Au lieu de se contenter de la revue de presse (matin) et des flux RSS (midi/soir), l'IA (Gemini + recherche Google) cherche elle-même,
parmi les entreprises et institutions suivies — algériennes d'abord, étrangères ensuite — les publications officielles des dernières
48 h. Un scoop n'est retenu que si la publication a été vue par la recherche (adresse présente parmi les pages citées), datée de moins
de 3 jours, et lisible (≥ 400 caractères) : l'article est alors rédigé depuis la publication officielle elle-même.

Limites assumées :
  - les pages Facebook ne sont pas lisibles sans connexion : une publication Facebook trouvée mais illisible n'est PAS inventée ; elle est
    signalée par ntfy comme « piste » (titre + lien) pour que l'éditeur colle le texte dans Smart Ingest PRO ;
  - la recherche Google de Gemini consomme le quota de l'IA : sans réponse (quota épuisé…), aucun scoop n'est proposé et le circuit
    continue avec les communiqués officiels puis la presse.
Pour changer la liste des entités suivies : modifier ENTITES_DZ / ENTITES_MONDE ci-dessous.
"""
import datetime
import json
import re
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import redaction as R  # noqa: E402

ENTITES_DZ = [
    "Djezzy", "Mobilis", "Ooredoo Algérie", "Algérie Télécom", "Algérie Poste", "ARPCE",
    "ministère de la Poste et des Télécommunications", "ministère de l'Économie de la connaissance, des Startups et des Micro-entreprises",
    "ANPT", "Huawei Algérie", "Samsung Algérie", "LG Algérie", "Condor Electronics", "Sonelgaz", "Sonatrach (numérique)",
    "Air Algérie (numérique)", "Algérie Télécom Satellite", "Yassir", "Starlink Algérie",
]
ENTITES_MONDE = [
    "Orange", "Nokia", "Ericsson", "Microsoft", "Google", "Meta", "OpenAI", "Anthropic", "Nvidia", "Apple", "Samsung", "Huawei",
    "Cisco", "Starlink / SpaceX", "Mozilla", "Intel", "Qualcomm", "Amazon Web Services",
]

PROMPT_SCOOPS = """Nous sommes le {jour}. Avec la recherche web, trouve des informations de PREMIÈRE MAIN publiées au cours des 48 DERNIÈRES
HEURES par ces organisations, sur leur site officiel (communiqué, actualités, blog) ou leur page Facebook officielle :
{entites}.
Seuls comptent le numérique, les télécoms, l'IA, l'innovation, les startups, la cybersécurité, les équipements et services technologiques.
Réponds UNIQUEMENT par un JSON, sans texte autour :
{{"infos": [{{"titre": "titre factuel", "entite": "organisation", "url": "adresse EXACTE de la publication officielle (https://…)",
  "date": "AAAA-MM-JJ", "reseau": "site" | "facebook", "resume": "une phrase factuelle"}}]}}
Maximum 8 infos, uniquement des publications que tu as réellement vues ; aucune invention, aucune adresse devinée ; [] si rien."""


def log(m):
    print(f"[scoops] {m}", flush=True)


def _marque(entite):
    import unicodedata
    mot = unicodedata.normalize("NFD", entite.split()[0].lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in mot if unicodedata.category(c) != "Mn"))


def _officiel(url, entite):
    """Le domaine porte la marque de l'entité (site officiel) ou, pour un réseau social, le chemin de la page la porte."""
    hote = R._hote(url)
    marque = _marque(entite)
    if len(marque) < 3:
        return False
    reseau = any(x in hote for x in ("facebook.", "fb.com", "x.com", "twitter.", "linkedin.", "instagram."))
    if any(x in hote for x in R.EXCLUS) and not reseau:
        return False
    if reseau:
        return marque in re.sub(r"[^a-z0-9]", "", url.lower().split(hote, 1)[-1])
    return marque in hote.replace("-", "").replace(".", "") or hote.endswith(".gov.dz")


def _demander(entites):
    texte, urls = R._gemini_recherche_texte(PROMPT_SCOOPS.format(
        jour=(datetime.datetime.utcnow() + datetime.timedelta(hours=1)).strftime("%d/%m/%Y"), entites=", ".join(entites)))
    m = re.search(r"\{[\s\S]*\}", texte or "")
    if not m:
        return [], urls
    try:
        return (json.loads(m.group(0)).get("infos") or []), urls
    except ValueError:
        return [], urls


def candidats_scoops(max_total=6):
    """([candidats lisibles], [pistes Facebook illisibles]) — candidats au format de circuit_flow (origine « scoop »)."""
    limite = (datetime.datetime.utcnow() + datetime.timedelta(hours=1)).date() - datetime.timedelta(days=3)
    cands, pistes, vus = [], [], set()
    for groupe in (ENTITES_DZ, ENTITES_MONDE):
        infos, urls = _demander(groupe)
        cite = {re.sub(r"[?#].*$", "", u).rstrip("/") for u in urls}
        for i in infos:
            url, entite, titre = str(i.get("url") or "").strip(), str(i.get("entite") or "").strip(), str(i.get("titre") or "").strip()
            if not url.startswith("http") or not titre or url in vus:
                continue
            vus.add(url)
            if re.sub(r"[?#].*$", "", url).rstrip("/") not in cite:
                log(f"  adresse non vue par la recherche, écartée : {url[:80]}")
                continue
            if not _officiel(url, entite):
                log(f"  pas une publication officielle de {entite} : {url[:80]}")
                continue
            try:
                d = datetime.date.fromisoformat(str(i.get("date") or "")[:10])
            except ValueError:
                d = None
            if not d or d < limite:
                log(f"  date absente ou ancienne, écartée : {titre[:60]}")
                continue
            reseau = any(x in R._hote(url) for x in ("facebook.", "fb.com", "x.com", "twitter.", "linkedin.", "instagram."))
            c = {"score": 240 - 4 * len(cands), "titre": titre, "url": url, "source": entite, "pays": "DZ" if groupe is ENTITES_DZ else "",
                 "origine": "scoop", "reseau": "facebook" if reseau else "site", "resume": str(i.get("resume") or "")}
            (pistes if reseau else cands).append(c)
    log(f"{len(cands)} scoop(s) lisible(s), {len(pistes)} piste(s) sur réseau social")
    return cands[:max_total], pistes[:max_total]


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    c, p = candidats_scoops()
    for x in c + p:
        print(x["score"], x["reseau"], x["source"], "|", x["titre"][:80], "|", x["url"][:80])
