"""Collecte des articles pour l'express et le vrai flash.

Flux RSS + trois sites officiels sans RSS lus en HTML (APS, Radio Algérie,
ARPCE). Chaque article reçoit « pays_source » (DZ / INT), que le filtre
éditorial utilise. Une source en panne n'arrête jamais la collecte.
"""
import calendar
import concurrent.futures as cf
import re
import time
from urllib.parse import urljoin

import feedparser
import requests
from bs4 import BeautifulSoup

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/128 Safari/537.36"}

# ── Algérie (.dz, .com, .gov/officiels) ─────────────────────────────────────
FLUX_DZ = {
    "ITMAG": "https://itmag.dz/feed/",
    "NTIC.dz": "https://www.ntic-dz.com/feed/",
    "TSA Algérie": "https://www.tsa-algerie.com/feed/",
    "Algérie360 Tech": "https://www.algerie360.com/category/high-tech/feed/",
    "Algérie360": "https://www.algerie360.com/feed/",
    "Algérie Éco": "https://algerie-eco.com/feed/",
    "EcomNewsMed DZ": "https://www.ecomnewsmed.com/location/algerie/feed/",
    "GeekyAlgeria": "https://geekyalgeria.com/feed/",
    "AlgeriaTech.news": "https://algeriatech.news/feed/",
    "El Moudjahid": "https://www.elmoudjahid.dz/fr/feed",
    "El Watan": "https://elwatan.dz/feed/",
    "Horizons": "https://www.horizons.dz/feed/",
    "Le Soir d'Algérie": "https://www.lesoirdalgerie.com/feed",
    "Maghreb Emergent": "https://maghrebemergent.news/fr/feed/",
    "24H Algérie": "https://www.24hdz.dz/feed/",
    "La Patrie News": "https://lapatrienews.dz/feed/",
    "Le Jeune Indépendant": "https://www.jeune-independant.net/feed/",
    "Crésus": "https://cresus.dz/feed/",
}

# Sites officiels sans RSS : (page, motif des liens d'articles)
PAGES_DZ = {
    "APS": [("https://www.aps.dz/fr", r"^/fr/[a-z-]+/[a-z-]+/[a-z0-9]{8}-"),
            ("https://www.aps.dz/fr/algerie/actualite-nationale", r"^/fr/[a-z-]+/[a-z-]+/[a-z0-9]{8}-")],
    "Radio Algérie": [("https://news.radioalgerie.dz/fr", r"^/fr/node/\d+$")],
    "ARPCE": [("https://www.arpce.dz/fr/pub", r"^/fr/pub/\w+$")],
}

# ── International ────────────────────────────────────────────────────────────
FLUX_INTL = {
    # francophones
    "Silicon.fr": "https://www.silicon.fr/feed",
    "ZDNet FR": "https://www.zdnet.fr/feed/",
    "Usine Digitale": "https://www.usine-digitale.fr/rss/",
    "L'Usine Nouvelle": "https://www.usinenouvelle.com/rss/",
    "01net": "https://www.01net.com/feed/",
    "Numerama": "https://www.numerama.com/feed/",
    "BFM Tech": "https://www.bfmtv.com/rss/tech/",
    "Frandroid": "https://www.frandroid.com/feed",
    "Le Monde Pixels": "https://www.lemonde.fr/pixels/rss_full.xml",
    "Le Monde Informatique": "https://www.lemondeinformatique.fr/flux-rss/thematique/toutes-les-actualites/rss.xml",
    "LeMagIT": "https://www.lemagit.fr/rss/ContentSyndication.xml",
    "Clubic": "https://www.clubic.com/feed/rss",
    "Next": "https://next.ink/feed/",
    "Journal du Net": "https://www.journaldunet.com/rss/",
    "Le Figaro Tech": "https://www.lefigaro.fr/rss/figaro_secteur_high-tech.xml",
    "Siècle Digital": "https://siecledigital.fr/feed/",
    "Maddyness": "https://www.maddyness.com/feed/",
    "Jeune Afrique": "https://www.jeuneafrique.com/feed/",
    "Hespress FR": "https://fr.hespress.com/feed",
    # anglophones
    "TechCrunch": "https://techcrunch.com/feed/",
    "Wired": "https://www.wired.com/feed/rss",
    "The Verge": "https://www.theverge.com/rss/index.xml",
    "Ars Technica": "https://feeds.arstechnica.com/arstechnica/index",
    "The Register": "https://www.theregister.com/headlines.atom",
    "MIT Tech Review": "https://www.technologyreview.com/feed/",
    "VentureBeat": "https://venturebeat.com/feed/",
    "BleepingComputer": "https://www.bleepingcomputer.com/feed/",
    "Rest of World": "https://restofworld.org/feed/latest",
    "SpaceNews": "https://spacenews.com/feed/",
    # télécoms / infrastructures
    "Mobile World Live": "https://www.mobileworldlive.com/feed/",
    "Light Reading": "https://www.lightreading.com/rss.xml",
    "Developing Telecoms": "https://developingtelecoms.com/?format=feed",
    "Capacity Media": "https://www.capacitymedia.com/rss",
    "Data Center Dynamics": "https://www.datacenterdynamics.com/en/rss/",
    # Afrique / MENA
    "Wamda": "https://www.wamda.com/en/feed",
    "TechCabal": "https://techcabal.com/feed/",
    "Disrupt Africa": "https://disruptafrica.com/feed/",
    "ITWeb Africa": "https://itweb.africa/rss",
}


def _texte(html: str) -> str:
    return " ".join(BeautifulSoup(html or "", "html.parser").get_text(" ").split())


def _image_flux(e) -> str:
    for m in (e.get("media_content") or []) + (e.get("media_thumbnail") or []):
        if m.get("url"):
            return m["url"]
    for l in e.get("links") or []:
        if l.get("type", "").startswith("image/") and l.get("href"):
            return l["href"]
    return ""


def _lire_flux(nom, url, pays, par_source):
    r = requests.get(url, headers=UA, timeout=25)
    f = feedparser.parse(r.content)
    out, maintenant = [], time.time()
    for e in f.entries[:par_source]:
        d = e.get("published_parsed") or e.get("updated_parsed")
        ts = calendar.timegm(d) if d else None
        if ts and ts > maintenant + 86400:  # date aberrante (futur) → inconnue
            ts = None
        elif ts and ts > maintenant:        # fuseau mal déclaré → maintenant
            ts = maintenant
        out.append({
            "title": _texte(e.get("title", "")), "url": e.get("link", ""),
            "summary": _texte(e.get("summary", ""))[:600], "source": nom, "pays_source": pays,
            "ts": ts, "image": _image_flux(e),
        })
    return out


MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout",
        "septembre", "octobre", "novembre", "decembre"]


def _date_fr(texte: str):
    """« 15 septembre 2026 13:50 » (heure d'Algérie, UTC+1) → timestamp UTC."""
    t = texte.lower().replace("é", "e").replace("û", "u")
    m = re.search(r"(\d{1,2}) (\w+) (\d{4})(?: (\d{1,2}):(\d{2}))?", t)
    if not m or m.group(2) not in MOIS:
        return None
    j, mois, an, h, mn = m.groups()
    return calendar.timegm((int(an), MOIS.index(mois) + 1, int(j), int(h or 12), int(mn or 0), 0)) - 3600


def _lire_page(nom, pages, par_source):
    out, vus = [], set()
    for page, motif in pages:
        s = BeautifulSoup(requests.get(page, headers=UA, timeout=25).text, "html.parser")
        for a in s.find_all("a", href=True):
            if not re.search(motif, a["href"]):
                continue
            url = urljoin(page, a["href"])
            titre = " ".join(a.get_text(" ").split())
            ts = time.time()
            carte = a.find_parent("li")
            if len(titre) < 25 and carte:  # ARPCE : lien « Lire », titre dans la carte
                h = carte.find(class_="card-title")
                for badge in h.find_all("span") if h else []:
                    badge.extract()
                t = carte.find(class_="card-text")
                titre = " : ".join(x for x in (
                    h and " ".join(h.get_text(" ").split()),
                    t and " ".join(t.get_text(" ").split())) if x)
                d = carte.find(class_="card-date")
                ts = _date_fr(d.get_text(" ")) if d else None
            if url in vus or len(titre) < 25:
                continue
            vus.add(url)
            out.append({"title": titre[:200], "url": url, "summary": "", "source": nom,
                        "pays_source": "DZ", "ts": ts, "image": ""})
    return out[:par_source]


def collecter(max_age_h: float = 24, par_source: int = 10, journal=print) -> list:
    """Tous les articles de moins de max_age_h heures, dédoublonnés par URL."""
    taches = [(_lire_flux, n, u, "DZ") for n, u in FLUX_DZ.items()]
    taches += [(_lire_flux, n, u, "INT") for n, u in FLUX_INTL.items()]
    taches += [(_lire_page, n, p, None) for n, p in PAGES_DZ.items()]
    articles, pannes = [], []
    with cf.ThreadPoolExecutor(16) as ex:
        futurs = {
            ex.submit(fn, n, x, par_source) if pays is None else ex.submit(fn, n, x, pays, par_source): n
            for fn, n, x, pays in taches
        }
        for fut in cf.as_completed(futurs):
            try:
                articles += fut.result()
            except Exception as e:
                pannes.append(f"{futurs[fut]} ({type(e).__name__})")
    if pannes:
        journal(f"[sources] indisponibles : {', '.join(sorted(pannes))}")
    limite = time.time() - max_age_h * 3600
    vus, frais = set(), []
    for a in sorted(articles, key=lambda a: -(a["ts"] or 0)):
        cle = a["url"].split("?")[0].rstrip("/")
        if not a["title"] or cle in vus or (a["ts"] is not None and a["ts"] < limite):
            continue
        vus.add(cle)
        a["date"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(a["ts"])) if a["ts"] else ""
        frais.append(a)
    return frais
