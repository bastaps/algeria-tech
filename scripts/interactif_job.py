"""Génère une carte interactive à partir d'une demande déposée par le site en ligne (workflow interactif.yml).

Entrée : fichier JSON `interactifs/_demandes/<job>.json` = {"job": "...", "generer": {corps de /api/generate}, "extra_visuals": "<html>"}
Sortie : `interactifs/_apercus/<job>.json` = {"etat": "pret", "data": {...}, "html": "..."} ou {"etat": "echec", "message": "..."}
Le site en ligne (functions/api/interactif-statut.js) lit puis supprime ce fichier. Même moteur que le Hub local
(article-interactif/app.py, appelé via le client de test Flask : aucun serveur à lancer).
Clés IA : variables d'environnement (secrets du dépôt) MISTRAL_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY.
"""
import json
import os
import re
import sys
import traceback
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE / "article-interactif"))
os.environ.setdefault("ALGERIA_TECH_ROOT", str(RACINE))

demande_path = Path(sys.argv[1])
demande = json.loads(demande_path.read_text(encoding="utf-8"))
job = re.sub(r"[^A-Za-z0-9_-]", "", str(demande.get("job", "")))[:40]
if not job:
    sys.exit("job manquant")
sortie = RACINE / "interactifs" / "_apercus" / f"{job}.json"
sortie.parent.mkdir(parents=True, exist_ok=True)

try:
    from app import app  # noqa: E402  (article-interactif/app.py)
    client = app.test_client()
    r = client.post("/api/generate", json=demande.get("generer") or {})
    data = r.get_json(silent=True) or {}
    if r.status_code >= 400 or data.get("error"):
        raise RuntimeError(data.get("error") or f"génération : HTTP {r.status_code}")
    if demande.get("extra_visuals"):
        data["extra_visuals"] = demande["extra_visuals"]
    r2 = client.post("/api/render", json=data)
    rendu = r2.get_json(silent=True) or {}
    if r2.status_code >= 400 or rendu.get("error") or not rendu.get("html"):
        raise RuntimeError(rendu.get("error") or f"rendu : HTTP {r2.status_code}")
    resultat = {"etat": "pret", "data": data, "html": rendu["html"]}
    print(f"carte prête : {len(rendu['html']) // 1024} Ko, moteur {data.get('ai_provider_label') or data.get('ai_provider')}")
except Exception as e:  # noqa: BLE001
    traceback.print_exc()
    resultat = {"etat": "echec", "message": str(e)[:300]}

sortie.write_text(json.dumps(resultat, ensure_ascii=False), encoding="utf-8")
try:
    demande_path.unlink()
except OSError:
    pass
