"""Publie une vidéo express sur le site : vidéo + image d'aperçu, puis mise à
jour de data/express-latest.json (le plus récent en premier, 30 au maximum).

Stockage : dépôt dédié bastaps/algeria-tech-videos, servi par GitHub Pages.
Le workflow en fait une copie locale (VIDEOS_REPO_DIR) ; ce script y dépose les
fichiers et fait le ménage au-delà des 30 dernières vidéos ; le workflow pousse
ensuite un commit unique (sans historique qui s'accumule).

    VIDEOS_REPO_DIR=videos-repo python publier.py <meta.json> [<meta.json> ...]
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
MANIFESTE = RACINE / "data" / "express-latest.json"
URL_PUBLIQUE = os.environ.get("VIDEOS_PUBLIC_URL", "https://bastaps.github.io/algeria-tech-videos").rstrip("/")
GARDER = 30


def apercu(video: Path, sortie: Path):
    """Image d'aperçu prise dans le corps de la vidéo (après l'intro)."""
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "4", "-i", str(video),
                    "-frames:v", "1", "-vf", "scale=640:-1", "-q:v", "4", str(sortie)], check=True)


def publier(meta_path: Path, dossier: Path) -> dict:
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    video = meta_path.with_name(meta["video"])
    ident = video.stem.replace("express-", "")
    poster = video.with_suffix(".jpg")
    apercu(video, poster)
    shutil.copy2(video, dossier / f"{ident}.mp4")
    shutil.copy2(poster, dossier / f"{ident}.jpg")
    base = f"{URL_PUBLIQUE}/express/{ident}"
    return {"id": ident, "titre": meta["titre"], "texte": meta["texte"], "source": meta["source"],
            "url": meta["url"], "pays": meta["pays"], "duree": meta["duree"],
            "mp4Url": base + ".mp4", "poster": base + ".jpg", "publishedAt": meta["date"]}


def main():
    depot = os.environ.get("VIDEOS_REPO_DIR")
    if not depot:
        sys.exit("VIDEOS_REPO_DIR manquant (copie locale de bastaps/algeria-tech-videos)")
    dossier = Path(depot) / "express"
    dossier.mkdir(parents=True, exist_ok=True)
    try:
        liste = json.loads(MANIFESTE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        liste = []
    for p in sys.argv[1:]:
        entree = publier(Path(p), dossier)
        liste = [entree] + [x for x in liste if x.get("id") != entree["id"]]
        print(f"[publier] {entree['id']} -> {entree['mp4Url']}")
    liste = liste[:GARDER]
    gardes = {x["id"] for x in liste}
    for f in dossier.iterdir():  # ménage : tout ce qui n'est plus dans les 30 derniers
        if f.suffix in (".mp4", ".jpg") and f.stem not in gardes:
            f.unlink()
    MANIFESTE.parent.mkdir(parents=True, exist_ok=True)
    MANIFESTE.write_text(json.dumps(liste, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
