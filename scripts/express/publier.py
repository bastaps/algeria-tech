"""Publie une vidéo express sur le site : vidéo + image d'aperçu, puis mise à
jour de data/express-latest.json (le plus récent en premier, 30 au maximum).

Stockage :
- Cloudflare R2 si R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_BUCKET et R2_PUBLIC_URL sont définis (vidéos hors du dépôt git) ;
- sinon dans le dépôt, sous videos/express/ (comme le vrai flash).

    python publier.py <meta.json> [<meta.json> ...]
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
MANIFESTE = RACINE / "data" / "express-latest.json"
DOSSIER = RACINE / "videos" / "express"
GARDER = 30


def r2():
    noms = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL")
    if not all(os.environ.get(n) for n in noms):
        return None
    import boto3
    client = boto3.client(
        "s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"], region_name="auto")
    return client, os.environ["R2_BUCKET"], os.environ["R2_PUBLIC_URL"].rstrip("/")


def apercu(video: Path, sortie: Path):
    """Image d'aperçu prise dans le corps de la vidéo (après l'intro)."""
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "4", "-i", str(video),
                    "-frames:v", "1", "-vf", "scale=640:-1", "-q:v", "4", str(sortie)], check=True)


def publier(meta_path: Path, stockage) -> dict:
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    video = meta_path.with_name(meta["video"])
    ident = video.stem.replace("express-", "")
    poster = video.with_suffix(".jpg")
    apercu(video, poster)
    if stockage:
        client, bucket, public = stockage
        for f, type_ in ((video, "video/mp4"), (poster, "image/jpeg")):
            client.upload_file(str(f), bucket, f"express/{ident}{f.suffix}",
                               ExtraArgs={"ContentType": type_, "CacheControl": "public, max-age=31536000"})
        base = f"{public}/express/{ident}"
    else:
        DOSSIER.mkdir(parents=True, exist_ok=True)
        shutil.copy2(video, DOSSIER / f"{ident}.mp4")
        shutil.copy2(poster, DOSSIER / f"{ident}.jpg")
        base = f"/videos/express/{ident}"
    return {"id": ident, "titre": meta["titre"], "texte": meta["texte"], "source": meta["source"],
            "url": meta["url"], "pays": meta["pays"], "duree": meta["duree"],
            "mp4Url": base + ".mp4", "poster": base + ".jpg", "publishedAt": meta["date"]}


def main():
    stockage = r2()
    try:
        liste = json.loads(MANIFESTE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        liste = []
    for p in sys.argv[1:]:
        entree = publier(Path(p), stockage)
        liste = [entree] + [x for x in liste if x.get("id") != entree["id"]]
        print(f"[publier] {entree['id']} -> {entree['mp4Url']}")
    anciens, liste = liste[GARDER:], liste[:GARDER]
    for x in anciens:  # ménage : fichiers locaux au-delà des 30 derniers
        if x.get("mp4Url", "").startswith("/videos/express/"):
            for suffixe in (".mp4", ".jpg"):
                (DOSSIER / f"{x['id']}{suffixe}").unlink(missing_ok=True)
        elif stockage:
            client, bucket, _ = stockage
            for suffixe in (".mp4", ".jpg"):
                client.delete_object(Bucket=bucket, Key=f"express/{x['id']}{suffixe}")
    MANIFESTE.parent.mkdir(parents=True, exist_ok=True)
    MANIFESTE.write_text(json.dumps(liste, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
