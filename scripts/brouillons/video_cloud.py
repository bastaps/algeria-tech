"""Vidéo « image + titre + voix off » fabriquée SANS le PC (repli cloud, GitHub Actions) : remplace Flow quand le PC est éteint.

Ajout isolé (2026-11-27) : activé seulement si VIDEO_CLOUD=1 ; toute erreur renvoie "" et le brouillon part comme avant (sans vidéo).
Image de l'article (zoom lent) + bandeau titre + voix off française gratuite (edge-tts, sinon gTTS) lisant le chapô.
Règle éditoriale conservée : jamais d'animation d'une photo de personnes réelles (l'appelant n'autorise que le mode « image_texte »).
Dépendances : ffmpeg, Pillow, edge-tts ou gTTS. Sortie : videos/articles/<ident>.mp4 (720p, < 8 Mo : limite Cloudflare 25 Mo).
"""
import asyncio
import os
import re
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

L, H = 1280, 720
VOIX = "fr-FR-DeniseNeural"
POLICES = ("C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
           "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf")


def log(m):
    print(f"[video-cloud] {m}", flush=True)


def actif():
    return os.environ.get("VIDEO_CLOUD", "") == "1"


def _texte_voix(titre, lead):
    """Titre puis chapô (sans le « ALGER, date (Algeria Tech) — »), ~55 mots maximum, coupé à la fin d'une phrase."""
    lead = re.sub(r"^[A-ZÉÈ' -]{3,20}\s*[,—-]\s*", "", str(lead or "").strip())
    lead = re.sub(r"\([^)]*Algeria Tech[^)]*\)\s*[—-]?\s*", "", lead)
    mots = re.sub(r"\s+", " ", lead).split(" ")
    court = " ".join(mots[:55])
    if len(mots) > 55:
        coupe = max(court.rfind(". "), court.rfind("; "))
        court = court[:coupe + 1] if coupe > 80 else court.rstrip(",;:") + "."
    return f"{titre.strip().rstrip('.')}. {court}".strip()


def _voix(texte, mp3):
    try:
        import edge_tts
        asyncio.run(asyncio.wait_for(edge_tts.Communicate(texte, VOIX, rate="+0%").save(str(mp3)), 90))
        if Path(mp3).stat().st_size > 5000:
            return True
    except Exception as e:  # noqa: BLE001 — repli gTTS
        log(f"edge-tts indisponible ({type(e).__name__}) : repli gTTS")
    try:
        from gtts import gTTS
        gTTS(texte, lang="fr").save(str(mp3))
        return Path(mp3).stat().st_size > 5000
    except Exception as e:  # noqa: BLE001
        log(f"gTTS indisponible ({type(e).__name__})")
        return False


def mode_fond(mode_politique):
    """Politique vidéo de l'article → type de fond. image_texte : photo sans personne ni texte → photo + bandeau titre ;
    image_anime : photo qui porte déjà du texte → photo seule ; sans_personnes : photo de personnes réelles → JAMAIS animée,
    fond aux couleurs du site avec le titre. Autre mode (aucune, source) : pas de vidéo."""
    return {"image_texte": "image", "image_anime": "image_seule", "sans_personnes": "fond"}.get(mode_politique)


def _fond_marque():
    """Image de fond sans personne : dégradé brun / or du site."""
    import io
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (1920, 1080))
    d = ImageDraw.Draw(im)
    for y in range(1080):
        t = y / 1079
        d.line([(0, y), (1920, y)], fill=(int(44 + 70 * t), int(26 + 38 * t), int(14 + 12 * t)))
    d.ellipse([1150, -250, 2250, 850], outline=(176, 125, 60), width=6)
    d.ellipse([1300, -100, 2100, 700], outline=(120, 85, 42), width=3)
    b = io.BytesIO()
    im.save(b, "JPEG", quality=90)
    return b.getvalue()


def _bandeau(titre, png, mode="image"):
    from PIL import Image, ImageDraw, ImageFont
    police = next((p for p in POLICES if Path(p).exists()), None)
    if not police:
        raise RuntimeError("aucune police disponible")
    img = Image.new("RGBA", (L, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f_titre, f_marque = ImageFont.truetype(police, 40), ImageFont.truetype(police, 26)
    if mode == "fond":   # pas de photo : titre grand, centré verticalement
        f_grand = ImageFont.truetype(police, 56)
        lignes = textwrap.wrap(titre.strip(), width=30)[:5]
        y0 = (H - 70 * len(lignes)) // 2
        for i, ligne in enumerate(lignes):
            d.text((90, y0 + 70 * i), ligne, font=f_grand, fill=(255, 255, 255, 255))
    elif mode != "image_seule":
        lignes = textwrap.wrap(titre.strip(), width=44)[:3]
        haut = 36 + 52 * len(lignes)
        d.rectangle([0, H - haut - 24, L, H], fill=(20, 12, 6, 205))
        for i, ligne in enumerate(lignes):
            d.text((48, H - haut - 6 + 52 * i), ligne, font=f_titre, fill=(255, 255, 255, 255))
    d.rounded_rectangle([36, 30, 36 + 214, 74], radius=10, fill=(176, 125, 60, 235))
    d.text((52, 38), "Algeria Tech", font=f_marque, fill=(255, 255, 255, 255))
    img.save(png)


def fabriquer(ident, titre, lead, jpg_bytes, racine, mode="image"):
    """Chemin web « /videos/articles/<ident>.mp4 » de la vidéo produite, ou "" (inactif, échec, vidéo trop lourde).
    mode : « image » (photo + bandeau titre), « image_seule » (la photo porte déjà du texte), « fond » (aucune photo : personnes réelles)."""
    if not actif():
        return ""
    try:
        racine = Path(racine)
        with tempfile.TemporaryDirectory() as t:
            t = Path(t)
            (t / "img.jpg").write_bytes(_fond_marque() if mode == "fond" else jpg_bytes)
            if not _voix(_texte_voix(titre, lead), t / "voix.mp3"):
                return ""
            _bandeau(titre, t / "bandeau.png", mode)
            sonde = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1",
                                    str(t / "voix.mp3")], capture_output=True, text=True)
            duree = float(sonde.stdout.strip()) + 1.5
            if not 4 <= duree <= 40:
                log(f"durée de voix inattendue ({duree:.0f} s) : pas de vidéo")
                return ""
            n = int(duree * 25)
            sortie = racine / "videos" / "articles" / f"{ident}.mp4"
            sortie.parent.mkdir(parents=True, exist_ok=True)
            filtre = (f"[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,"
                      f"zoompan=z='min(1.0+0.0004*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={L}x{H}:fps=25[bg];"
                      f"[bg][1:v]overlay=0:0,format=yuv420p[v]")
            r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "25", "-loop", "1", "-t", f"{duree:.2f}",
                                "-i", str(t / "img.jpg"), "-i", str(t / "bandeau.png"), "-i", str(t / "voix.mp3"),
                                "-filter_complex", filtre, "-map", "[v]", "-map", "2:a", "-frames:v", str(n),
                                "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-c:a", "aac", "-b:a", "96k",
                                "-af", "apad", "-shortest", "-movflags", "+faststart", str(sortie)],
                               capture_output=True, text=True, timeout=600)
            if r.returncode or not sortie.exists():
                log(f"ffmpeg a échoué : {(r.stderr or '')[-300:]}")
                sortie.unlink(missing_ok=True)
                return ""
            if sortie.stat().st_size > 8_000_000:
                log("vidéo trop lourde (> 8 Mo) : écartée")
                sortie.unlink(missing_ok=True)
                return ""
            log(f"vidéo prête : {sortie.name} — {sortie.stat().st_size / 1e6:.1f} Mo, {duree:.0f} s")
            return f"/videos/articles/{ident}.mp4"
    except Exception as e:  # noqa: BLE001 — jamais bloquant pour le circuit
        log(f"vidéo cloud impossible ({type(e).__name__}) : {str(e)[:160]}")
        return ""


if __name__ == "__main__":   # essai : python video_cloud.py image.jpg "Titre" "Chapô…" [dossier_racine]
    os.environ["VIDEO_CLOUD"] = "1"
    sys.stdout.reconfigure(encoding="utf-8")
    img, titre, lead = sys.argv[1:4]
    print(fabriquer("essai", titre, lead, Path(img).read_bytes(), sys.argv[4] if len(sys.argv) > 4 else "."))
