"""Cartes interactives dans le cloud (GitHub Actions) pour les articles marqués `interactif_a_faire: "true"`.

Même moteur que le Hub local et que scripts/interactif_job.py (article-interactif/app.py via le client de test Flask) ;
même résultat que circuit_flow.completer_carte (qui, lui, exige le PC allumé). Écrit interactifs/<id>.html et met l'en-tête à jour.
Au plus MAX cartes par passage ; articles de moins de 4 jours. Clés IA : variables d'environnement.
    python scripts/cartes_cloud.py"""
import os
import re
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE / "article-interactif"))
os.environ.setdefault("ALGERIA_TECH_ROOT", str(RACINE))
MAX = int(os.environ.get("CARTES_MAX", "3"))

a_faire = []
for f in sorted((RACINE / "articles").glob("*.md"), reverse=True):
    if not f.stem.isdigit() or time.time() * 1000 - int(f.stem) > 4 * 86400 * 1000:
        continue
    if re.search(r'^interactif_a_faire:', f.read_text(encoding="utf-8")[:3000], re.M):
        a_faire.append(f)
print(len(a_faire), "article(s) en attente de carte")
if not a_faire:
    sys.exit(0)

from app import app  # noqa: E402  (article-interactif/app.py)

client = app.test_client()
faites = 0
for md_path in a_faire[:MAX]:
    ident = md_path.stem
    m = re.match(r"---\n([\s\S]*?)\n---\n([\s\S]*)$", md_path.read_text(encoding="utf-8").replace("\r\n", "\n"))
    if not m:
        continue
    entete, corps = m.group(1), m.group(2).strip()
    get = lambda k: (re.search(rf"^{k}:[ \t]*(.*)$", entete, re.M) or [None, ""])[1].strip().strip('"')  # noqa: E731
    try:
        r = client.post("/api/generate", json={
            "text": f"# {get('titre')}\n\n{get('extrait')}\n\n{corps}", "mode": "real", "primary_color": "#0d3b24", "accent_color": "#d21034",
            "dark_mode": False, "source_url": get("source"), "gallery": [], "widgets": {}, "medias": {}})
        gen = r.get_json(silent=True) or {}
        if r.status_code >= 400 or gen.get("error"):
            print(f"{ident} : génération impossible — {gen.get('error') or r.status_code}")
            continue
        r2 = client.post("/api/render", json=gen)
        rendu = r2.get_json(silent=True) or {}
        if r2.status_code >= 400 or rendu.get("error") or len(rendu.get("html", "")) < 5000:
            print(f"{ident} : rendu impossible")
            continue
    except Exception as e:  # noqa: BLE001
        print(f"{ident} : erreur {type(e).__name__} : {e}")
        continue
    (RACINE / "interactifs").mkdir(exist_ok=True)
    (RACINE / "interactifs" / f"{ident}.html").write_text(rendu["html"], encoding="utf-8")
    entete = re.sub(r"^interactif:.*$", f'interactif: "/interactifs/{ident}.html"', entete, flags=re.M)
    entete = re.sub(r"^interactif_a_faire:.*\n?", "", entete, flags=re.M).rstrip("\n")
    md_path.write_text(f"---\n{entete}\n---\n\n{corps}\n", encoding="utf-8")
    print(f"carte interactive ajoutée : {ident}")
    faites += 1
print(faites, "carte(s) créée(s)")
