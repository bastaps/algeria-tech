"""Sources OFFICIELLES du circuit d'articles : communiqués publiés sur les sites des opérateurs et institutions.

Règle éditoriale (2026-10-27) : un article est d'abord rapporté depuis le communiqué publié par l'entreprise ou l'institution
elle-même ; le média relais ne passe qu'en second. Ce module lit les pages « communiqués / actualités » de sites officiels
lisibles sans connexion et renvoie des candidats au même format que circuit_flow (titre, url, source, pays, score, origine).

Limite connue : les pages Facebook / X / Instagram officielles ne sont pas lisibles sans connexion ; les sites dont la liste des
communiqués est chargée par JavaScript (Mobilis, Ooredoo) ne le sont pas non plus (Ooredoo arrive par la veille des courriels).
Pour ajouter une source : une ligne dans SOURCES (page de liste + motif des liens d'articles).
Stdlib + requests + bs4.
"""
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dedup as D  # noqa: E402  (fraîcheur : dates citées dans la page)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7"}

# nom, pages de liste, motif des liens d'articles, filtre « numérique » (True = ne garder que les sujets TIC)
SOURCES = [
    ("Djezzy", ["https://www.djezzy.dz/djezzy/actualite-et-nouveautes/communiques-de-presse/"],
     r"/communiques-de-presse/[a-z0-9-]{14,}/?$", False),
    ("Algérie Télécom", ["https://www.algerietelecom.dz/fr/espace-presse"], r"/espace-presse/[a-z0-9-]+-art\d+/?$", False),
    ("ARPCE", ["https://www.arpce.dz/fr/news"], r"/fr/pub/[a-z0-9]{4,10}/?$", False),
    ("Ministère de l'Enseignement supérieur", ["https://www.mesrs.dz/fr/accueil/"], r"/fr/20\d\d/\d\d/[a-z0-9-]{18,}/?$", True),
]
TECH = re.compile(r"t[ée]l[ée]com|mobile|internet|num[ée]rique|\bia\b|intelligence artificielle|cyber|r[ée]seau|fibre|5g|4g|"
                  r"satellite|startup|logiciel|application|plateforme|donn[ée]es|cloud|digital|innovation|technolog|informatique", re.I)


def log(m):
    print(f"[officiels] {m}", flush=True)


def _page(url):
    r = requests.get(url, headers=UA, timeout=20)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")


def _meta(s, *noms):
    for n in noms:
        m = s.find("meta", attrs={"property": n}) or s.find("meta", attrs={"name": n})
        if m and m.get("content"):
            return m["content"].strip()
    return ""


def candidats_officiels(par_source=3, max_total=10):
    """[{score, titre, url, source, pays, origine}] — les plus récents d'abord (ordre des pages), un nombre limité par source."""
    out = []
    for nom, pages, motif, filtre_tic in SOURCES:
        vus = set()
        try:
            liens = []
            for p in pages:
                s = _page(p)
                for a in s.find_all("a", href=True):
                    h = urljoin(p, a["href"]).split("#")[0]
                    if urlparse(h).netloc.removeprefix("www.") == urlparse(p).netloc.removeprefix("www.") and re.search(motif, h) \
                            and h.rstrip("/") != p.rstrip("/") and h not in vus:
                        vus.add(h)
                        liens.append(h)
        except Exception as e:  # noqa: BLE001 — une source en panne ne bloque pas les autres
            log(f"{nom} : liste illisible ({type(e).__name__})")
            continue
        n = 0
        for rang, h in enumerate(liens[:12]):
            try:
                s = _page(h)
            except Exception:  # noqa: BLE001
                continue
            titre = re.sub(r"\s+", " ", _meta(s, "og:title", "twitter:title") or (s.title.string if s.title else "")).strip()
            titre = re.sub(r"\s*[|–—-]\s*(Djezzy|Alg[ée]rie T[ée]l[ée]com|ARPCE|MESRS).*$", "", titre, flags=re.I)
            if len(titre) < 15 or (filtre_tic and not TECH.search(titre)):
                continue
            texte_page = s.get_text(" ", strip=True)
            if D.perime(texte_page, jours=4, zone=8000):
                log(f"  {nom} : communiqué périmé écarté — {titre[:60]}")
                continue
            if not D.dates_dans(texte_page[:8000]) and rang >= 2:   # page sans date : seuls les 2 premiers de la liste (plus récents) passent
                log(f"  {nom} : communiqué sans date, rang {rang + 1} écarté — {titre[:60]}")
                continue
            out.append({"score": 200 - 8 * n - 2 * len(out), "titre": titre, "url": h, "source": nom, "pays": "DZ", "origine": "officiel"})
            n += 1
            if n >= par_source:
                break
        log(f"{nom} : {n} communiqué(s) retenu(s)")
    out.sort(key=lambda c: -c["score"])
    return out[:max_total]


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for c in candidats_officiels():
        print(c["score"], c["source"], "|", c["titre"][:90], "|", c["url"][:80])
