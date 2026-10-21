"""Brouillons d'articles de presse (mode semi-automatique).

Réutilise la collecte, le filtre éditorial et le routeur IA de l'express :
on prend les meilleures infos du moment (Algérie d'abord), l'IA REFORMULE un
article original (jamais de copie, source citée) et le dépose dans brouillons/.
Rien n'est publié : l'administrateur relit, modifie puis publie en un clic.

Code de sortie : 0 = brouillons créés · 2 = rien de neuf.
"""
import argparse
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

RACINE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RACINE / "scripts" / "express"))
from filtre_editorial import appeler_gemini, empreinte, trier  # noqa: E402
from sources import UA, collecter  # noqa: E402

DOSSIER = RACINE / "brouillons"
HISTORIQUE = RACINE / "data" / "brouillons-history.json"
CATEGORIES = ["Algérie", "Télécoms", "Mobile", "Startups", "IA", "Fintech", "Innovation", "Monde", "Entreprises"]

CONSIGNE = """Tu es journaliste pour Algeria Tech, média algérien des technologies et du numérique.
Rédige un article ORIGINAL en français, à partir de l'information ci-dessous. Tu REFORMULES : aucune phrase
recopiée de la source, aucune citation longue. Style factuel d'agence de presse (APS), clair, sobre.

RÈGLES ABSOLUES :
- N'invente RIEN : pas de chiffre, de nom, de date ni de citation absents du texte fourni.
- Si une information manque, ne la mentionne pas.
- 220 à 380 mots, 3 à 5 paragraphes courts séparés par une ligne vide, sans titres internes ni listes.
- Termine par la phrase : « Source : {source}. »

Source : {source}
Titre d'origine : {titre}
Texte :
{corps}

Réponds UNIQUEMENT par un JSON :
{{"titre": "titre accrocheur de 70 caractères maximum, sans point final",
  "extrait": "résumé de 180 caractères maximum",
  "categorie": "UNE valeur parmi : {categories}",
  "tags": ["3 à 5 mots-clés courts"],
  "aretenir": "3 points essentiels séparés par ' | ', 120 caractères chacun maximum",
  "contenu": "le corps de l'article"}}"""


def journal(msg):
    print(msg, flush=True)


def lire_json(chemin, defaut):
    try:
        return json.loads(Path(chemin).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return defaut


def lire_page(article):
    corps, image = article.get("summary", ""), article.get("image", "")
    try:
        r = requests.get(article["url"], headers=UA, timeout=25)
        s = BeautifulSoup(r.text, "html.parser")
        for prop in ("og:image", "twitter:image"):
            m = s.find("meta", attrs={"property": prop}) or s.find("meta", attrs={"name": prop})
            if m and m.get("content", "").startswith("http"):
                image = m["content"]
                break
        paras = [" ".join(p.get_text(" ").split()) for p in s.find_all("p")]
        paras = [p for p in paras if len(p) > 80]
        if paras:
            corps = "\n\n".join(paras)[:6000]
    except Exception as e:  # page illisible : on garde le résumé du flux
        journal(f"  page illisible ({type(e).__name__}), résumé du flux utilisé")
    return corps, image


def q(v):
    return str(v or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip()


def ecrire_brouillon(article, red, image, ident):
    maintenant = datetime.now(timezone.utc) + timedelta(hours=1)  # heure d'Alger
    cat = red.get("categorie") if red.get("categorie") in CATEGORIES else ("Algérie" if article["filtre"]["pays"] == "DZ" else "Monde")
    tags = ", ".join(f'"{t.strip().replace(chr(34), "")}"' for t in (red.get("tags") or [])[:5] if str(t).strip())
    texte = f"""---
titre: "{q(red['titre'])[:90]}"
categorie: {cat}
date: {maintenant:%Y-%m-%d}
heure: {maintenant:%H:%M}
image: ""
image_suggeree: "{q(image)}"
pdf: ""
video: ""
source: "{q(article['url'])}"
extrait: "{q(red['extrait'])[:220]}"
tags: [{tags}]
type:
position:
interactif: ""
aretenir: "{q(red.get('aretenir'))}"
mediaPriority: image
brouillon: true
---

{red['contenu'].strip()}
"""
    DOSSIER.mkdir(exist_ok=True)
    (DOSSIER / f"{ident}.md").write_text(texte, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=3, help="nombre maximal de brouillons par passage")
    ap.add_argument("--age", type=float, default=18, help="âge maximal des infos (heures)")
    args = ap.parse_args()

    histo = lire_json(HISTORIQUE, [])
    deja = histo + lire_json(RACINE / "data" / "express-history.json", [])
    # titres déjà publiés sur le site : on ne refait pas un article existant
    for a in lire_json(RACINE / "articles-list.json", [])[:300]:
        deja.append({"titre": a.get("titre", ""), "url": a.get("source", ""), "empreinte": empreinte({"title": a.get("titre", "")})})
    urls = {h.get("url") for h in deja if h.get("url")}

    journal("Collecte des sources…")
    articles = [a for a in collecter(max_age_h=args.age, journal=journal) if a.get("url") not in urls]
    journal(f"{len(articles)} infos candidates")
    if not articles:
        return 2
    gardes, _ = trier(articles, historique=deja)
    journal(f"{len(gardes)} retenues par le filtre éditorial")
    crees = []
    for art in gardes:
        if len(crees) >= args.max:
            break
        journal(f"→ {art['source']} : {art['title'][:80]}")
        corps, image = lire_page(art)
        if len(corps) < 200:
            journal("  texte trop court, ignoré")
            continue
        red = appeler_gemini(CONSIGNE.format(source=art["source"], titre=art["title"], corps=corps,
                                             categories=", ".join(CATEGORIES)), temperature=0.4)
        if not isinstance(red, dict) or not red.get("contenu") or not red.get("titre") or len(str(red["contenu"]).split()) < 120:
            journal("  rédaction IA insuffisante, ignoré")
            continue
        ident = str(int(time.time() * 1000) + len(crees))
        ecrire_brouillon(art, red, image, ident)
        histo.append({"date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "url": art["url"],
                      "titre": art["title"], "empreinte": empreinte(art), "brouillon": ident})
        crees.append((ident, red["titre"]))
        journal(f"  ✔ brouillon {ident} : {red['titre']}")
    if not crees:
        return 2
    HISTORIQUE.parent.mkdir(parents=True, exist_ok=True)
    HISTORIQUE.write_text(json.dumps(histo[-300:], ensure_ascii=False, indent=1), encoding="utf-8")
    (RACINE / "brouillons-out.json").write_text(json.dumps(crees, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
