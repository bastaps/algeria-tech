"""Optimise les images du site (poids de chargement) sans rien casser.

Ne traite QUE les images locales (dossier images/) réellement utilisées par des articles (articles/*.md).
  - JPEG  : redimensionné à 1600 px max (côté le plus long), recompressé (qualité 82, progressif), EN PLACE
            (même nom, mêmes références). Ignoré si le gain est < 15 %.
  - PNG   : copie WebP (qualité 85) à côté (« nom.webp ») et références des articles réécrites vers le .webp.
            Le PNG d'origine est CONSERVÉ (liens externes, partages).
  - Vignettes : « images/t/<nom>.webp » (640 px de large) pour les cartes de l'accueil ; le site les utilise
            avec repli automatique sur l'original si une vignette manque.
Idempotent : une image déjà optimisée n'est pas retraitée.

    python tools/optimiser_images.py [--root .] [--apply] [--min-kb 200] [--only articles/123.md ...]
Sans --apply : essai à blanc (rapport seulement).
"""
import argparse
import re
import sys
from pathlib import Path
from urllib.parse import unquote

from PIL import Image, ImageOps

sys.stdout.reconfigure(encoding="utf-8")
EXT = r"(?:jpe?g|png|webp|gif)"
REF = re.compile(r"/?(images/[^\s)\"'<>\]\\]+?\." + EXT + r")(?=[\s)\"'<>\]\\?#]|$)", re.I)
MAX_SIDE = 1600
THUMB_W = 640


def refs_dans(texte):
    return {unquote(m.group(1)) for m in REF.finditer(texte)}


def image_front(texte):
    m = re.search(r'^image:[ \t]*"?([^"\n]*)"?', texte, re.M)
    return (m.group(1).strip() if m else "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--min-kb", type=int, default=200)
    ap.add_argument("--only", nargs="*", help="limiter aux articles indiqués (chemins relatifs)")
    a = ap.parse_args()
    root = Path(a.root).resolve()
    arts = [root / p for p in a.only] if a.only else sorted((root / "articles").glob("*.md"))
    utilisees, heros = {}, set()
    for f in arts:
        if not f.is_file():
            continue
        t = f.read_text(encoding="utf-8", errors="replace")
        for r in refs_dans(t):
            utilisees.setdefault(r, set()).add(f)
        h = image_front(t)
        if h and not re.match(r"^https?://", h):
            heros.add(unquote(h.lstrip("/")))
    avant = apres = 0
    n_jpg = n_png = n_thumb = 0
    reecrire = {}  # article -> [(ancien nom, nouveau nom)]
    for rel in sorted(utilisees):
        p = root / rel
        if not p.is_file():
            continue
        taille = p.stat().st_size
        ext = p.suffix.lower()
        if taille < a.min_kb * 1024 or ext in (".webp", ".gif"):
            continue
        try:
            img = Image.open(p)
            img = ImageOps.exif_transpose(img)
        except Exception as e:
            print(f"  ✗ illisible {rel} ({e})")
            continue
        if ext in (".jpg", ".jpeg"):
            im = img.convert("RGB")
            if max(im.size) > MAX_SIDE:
                r = MAX_SIDE / max(im.size)
                im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
            tmp = p.with_suffix(p.suffix + ".opt")
            im.save(tmp, "JPEG", quality=82, optimize=True, progressive=True)
            nouveau = tmp.stat().st_size
            if nouveau < taille * 0.85:
                avant += taille
                apres += nouveau
                n_jpg += 1
                print(f"  JPEG {rel}: {taille // 1024} Ko → {nouveau // 1024} Ko ({im.width}×{im.height})")
                if a.apply:
                    tmp.replace(p)
                else:
                    tmp.unlink()
            else:
                tmp.unlink()
        elif ext == ".png":
            im = img.convert("RGBA") if (img.mode in ("RGBA", "LA", "P") or "transparency" in img.info) else img.convert("RGB")
            if max(im.size) > MAX_SIDE:
                r = MAX_SIDE / max(im.size)
                im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
            cible = p.with_suffix(".webp")
            if cible.exists():
                nouveau = cible.stat().st_size
            else:
                tmp = cible.with_suffix(".webp.opt")
                im.save(tmp, "WEBP", quality=85, method=6)
                nouveau = tmp.stat().st_size
                if nouveau < taille * 0.85 and a.apply:
                    tmp.replace(cible)
                else:
                    tmp.unlink()
            if nouveau < taille * 0.85:
                avant += taille
                apres += nouveau
                n_png += 1
                print(f"  PNG→WebP {rel}: {taille // 1024} Ko → {nouveau // 1024} Ko")
                for art in utilisees[rel]:
                    reecrire.setdefault(art, []).append((p.name, cible.name))
    # vignettes des images de couverture locales
    (root / "images" / "t").mkdir(parents=True, exist_ok=True) if a.apply else None
    for rel in sorted(heros):
        p = root / rel
        if not p.is_file() or p.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        t = root / "images" / "t" / (p.stem + ".webp")
        if t.exists():
            continue
        try:
            im = ImageOps.exif_transpose(Image.open(p))
            im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
            r = THUMB_W / im.width
            if r < 1:
                im = im.resize((THUMB_W, round(im.height * r)), Image.LANCZOS)
            if a.apply:
                im.save(t, "WEBP", quality=72, method=6)
            n_thumb += 1
        except Exception as e:
            print(f"  ✗ vignette impossible {rel} ({e})")
    if a.apply:
        for art, paires in reecrire.items():
            t = art.read_text(encoding="utf-8")
            for ancien, nouveau in set(paires):
                t = re.sub(r"(?<![\w.-])" + re.escape(ancien) + r"(?![\w.-])", nouveau, t)
            art.write_text(t, encoding="utf-8")
    print(f"\nRésumé ({'appliqué' if a.apply else 'essai à blanc'}) : {n_jpg} JPEG recompressés, {n_png} PNG→WebP, "
          f"{n_thumb} vignettes créées ; poids avant {avant / 1048576:.0f} Mo → après {apres / 1048576:.0f} Mo "
          f"(économie {max(0, avant - apres) / 1048576:.0f} Mo) ; articles réécrits : {len(reecrire)}")


if __name__ == "__main__":
    main()
