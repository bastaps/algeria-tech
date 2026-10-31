"""Repli CLOUD du circuit « article » (GitHub Actions, sans PC).

Si le PC n'a pas produit l'article d'un créneau (PC éteint, Flow indisponible…), ce script le fait :
  info choisie comme sur le PC (matin = revue de presse ; midi/soir = flux RSS + réseaux sociaux),
  rédaction IA au format Algeria Tech (redaction.py : tableau, « À retenir », source officielle vérifiée),
  image de l'article en 16:9, brouillon `brouillons/<id>.md` (circuit: true) et notification ntfy à 3 boutons
  (À la Une / 2e position / Brève). La publication est faite par publier_choix.py (à la Une, position 1).
Pas de vidéo dans ce repli (une vidéo générique n'apporte rien) ; pas de carte interactive non plus : elle est
ajoutée plus tard par le PC (champ `interactif_a_faire`, voir publier_choix.py).

    python circuit_cloud.py --slot matin|midi|soir [--sans-notif]

Registre commun PC/cloud : data/circuit-slots.json {"2026-10-16": {"matin": "pc"}}.
Codes de sortie : 0 brouillon créé · 2 rien à faire (créneau déjà fait, ou rien de neuf).
"""
import argparse
import datetime
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageFont

RACINE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RACINE / "scripts" / "express"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import circuit_flow as C  # noqa: E402  (choix des infos, image, ntfy : même logique que sur le PC)
import redaction as R  # noqa: E402  (format éditorial commun)
from sources import UA  # noqa: E402

REGISTRE = RACINE / "data" / "circuit-slots.json"
PEXELS = "https://api.pexels.com/videos/search"

def log(m):
    print(f"[cloud] {m}", flush=True)


def registre():
    try:
        return json.loads(REGISTRE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def marquer(slot, origine):
    r = registre()
    jour = C.aujourd_hui()
    r.setdefault(jour, {})[slot] = origine
    for j in sorted(r)[:-10]:  # on garde 10 jours
        del r[j]
    REGISTRE.parent.mkdir(parents=True, exist_ok=True)
    REGISTRE.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")


def lire_page(url, resume=""):
    """(texte, image) d'une page d'article."""
    try:
        r = requests.get(url, headers=UA, timeout=25)
        s = BeautifulSoup(r.text, "html.parser")
        image = ""
        for prop in ("og:image", "twitter:image"):
            m = s.find("meta", attrs={"property": prop}) or s.find("meta", attrs={"name": prop})
            if m and m.get("content", "").startswith("http"):
                image = m["content"]
                break
        paras = [" ".join(p.get_text(" ").split()) for p in s.find_all("p")]
        paras = [p for p in paras if len(p) > 80]
        return ("\n\n".join(paras)[:6000] if paras else resume), image
    except Exception as e:
        log(f"  page illisible ({type(e).__name__})")
        return resume, ""


def sources_deja_utilisees():
    vus = set(C.deja_vus())
    for f in (RACINE / "brouillons").glob("*.md") if (RACINE / "brouillons").is_dir() else []:
        m = re.search(r'^source:\s*"?([^"\n]+)', f.read_text(encoding="utf-8"), re.M)
        if m:
            vus.add(m.group(1).strip())
    for f in sorted((RACINE / "articles").glob("*.md"))[-80:]:
        m = re.search(r'^source:\s*"?([^"\n]+)', f.read_text(encoding="utf-8"), re.M)
        if m:
            vus.add(m.group(1).strip())
    return vus


# ── Vidéo Pexels ────────────────────────────────────────────────────────────
def police(taille):
    for p in (r"C:\Windows\Fonts\segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if Path(p).is_file():
            return ImageFont.truetype(p, taille)
    return ImageFont.load_default()


def video_pexels(requetes, sortie: Path):
    """Un clip Pexels de 10 s (1280×720, sans son) avec crédit. True si fabriqué."""
    cle = (os.environ.get("PEXELS_API_KEY") or "").strip()
    if not cle:
        log("  pas de clé Pexels : image seule")
        return False
    for q in requetes[:3]:
        try:
            r = requests.get(PEXELS, headers={"Authorization": cle}, timeout=25,
                             params={"query": q, "orientation": "landscape", "size": "medium", "per_page": 10})
            r.raise_for_status()
        except Exception as e:
            log(f"  Pexels indisponible ({type(e).__name__})")
            return False
        for v in r.json().get("videos", []):
            if (v.get("duration") or 0) < 7:
                continue
            fichiers = [f for f in v.get("video_files", []) if f.get("file_type") == "video/mp4" and 960 <= (f.get("width") or 0) <= 1920]
            if not fichiers:
                continue
            fichiers.sort(key=lambda f: abs((f.get("width") or 0) - 1280))
            with tempfile.TemporaryDirectory() as tmp:
                tmp = Path(tmp)
                try:
                    with requests.get(fichiers[0]["link"], headers=UA, timeout=90, stream=True) as d:
                        d.raise_for_status()
                        with open(tmp / "src.mp4", "wb") as f:
                            for bloc in d.iter_content(1 << 20):
                                f.write(bloc)
                except requests.RequestException:
                    continue
                credit = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
                ImageDraw.Draw(credit).text((1256, 700), "Vidéo : Pexels", font=police(20), fill=(240, 240, 240, 220), anchor="rb")
                credit.save(tmp / "credit.png")
                debut = max(0.0, (v["duration"] - 10) / 2)
                r2 = subprocess.run(
                    ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{debut:.1f}", "-i", str(tmp / "src.mp4"), "-loop", "1",
                     "-i", str(tmp / "credit.png"), "-filter_complex",
                     "[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=25,setsar=1[v];[v][1:v]overlay=0:0:shortest=1",
                     "-t", "10", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p",
                     "-movflags", "+faststart", str(sortie)], capture_output=True, text=True)
                if r2.returncode == 0 and sortie.is_file() and sortie.stat().st_size > 100_000:
                    log(f"  vidéo Pexels {v['id']} ({sortie.stat().st_size // 1024} Ko) — requête « {q} »")
                    return True
    return False


# ── Brouillon ───────────────────────────────────────────────────────────────
def produire(slot, notif=True):
    if slot != "test" and registre().get(C.aujourd_hui(), {}).get(slot):
        log(f"créneau « {slot} » déjà fait aujourd'hui ({registre()[C.aujourd_hui()][slot]})")
        return 2
    vus = sources_deja_utilisees()
    ctx = C.D.contexte(RACINE, None, brouillons_locaux=True)   # publiés récents + brouillons en attente (dont ceux du PC, lus sur GitHub)
    # Règle éditoriale : d'abord les communiqués officiels des entreprises / institutions ; les médias ensuite.
    # une seule recherche Google par jour (cache partagé data/scoops-jour.json, commité avec le brouillon) ; pistes Facebook : PC seulement
    scoops = lambda: C.S.candidats_du_jour(RACINE / C.S.CACHE_REL)[0]   # noqa: E731
    listes = ((scoops, C.O.candidats_officiels, C.candidats_revue, C.candidats_flux) if slot == "matin"
              else (scoops, C.O.candidats_officiels, C.candidats_flux, C.candidats_revue))
    essais_ia = 0
    for fabrique in listes:
        for c in fabrique()[:14]:
            if not c["url"] or c["url"] in vus:
                continue
            doublon, pourquoi, _ = C.D.trouver_doublon(c["titre"], c["url"], "", ctx, arbitre=C.arbitre_ia)
            if doublon:
                log(f"  doublon écarté : {c['titre'][:60]} — {pourquoi}")
                continue
            corps, image = lire_page(c["url"])
            if len(corps) < 400 or not image.startswith("http"):
                log(f"  ignoré (texte ou image manquant) : {c['titre'][:70]}")
                continue
            if c.get("origine") not in ("officiel", "scoop"):
                hp, pourquoi = C.P.hors_perimetre(c["titre"], corps, c["url"])
                if not hp and C.P.douteux(c["titre"], corps):
                    avis = C.P.avis_ia(c["titre"], corps[:400], lambda q: R.appeler_gemini(q, temperature=0))
                    if avis and not avis[0]:
                        hp, pourquoi = True, "avis IA : " + avis[1]
                if hp:
                    log(f"  hors périmètre écarté : {c['titre'][:70]} — {pourquoi}")
                    continue
            if C.D.perime(corps, jours=5):
                log(f"  source périmée écartée : {c['titre'][:70]}")
                continue
            doublon, pourquoi, _ = C.D.trouver_doublon(c["titre"], c["url"], corps[:400], ctx, arbitre=C.arbitre_ia)
            if doublon:
                log(f"  doublon écarté (après lecture) : {c['titre'][:60]} — {pourquoi}")
                continue
            jpg = C.telecharger_image(image)
            if not jpg:
                log(f"  ignoré (image inexploitable) : {c['titre'][:70]}")
                continue
            if essais_ia >= 3:
                log("rédaction IA indisponible : abandon")
                return 2
            essais_ia += 1
            direct = c.get("origine") in ("officiel", "scoop")   # la page lue EST la publication de l'entreprise / institution
            src = R.resoudre_sources(c["titre"], corps, c["url"], c["source"], origine_officielle=direct)
            officiels = src["officiels"]
            red = R.rediger(c["source"], c["titre"], corps, officiels)
            if not red:
                log("  rédaction IA insuffisante, article suivant")
                continue
            doublon, pourquoi, _ = C.D.trouver_doublon(red["titre"], c["url"], red.get("extrait", ""), ctx, arbitre=C.arbitre_ia)
            if doublon:   # contrôle final sur l'article rédigé : rien n'est déposé s'il double un fait déjà publié ou en attente
                log(f"  doublon écarté (article rédigé) : {red['titre'][:60]} — {pourquoi}")
                continue
            hp, pourquoi = C.P.hors_perimetre(red["titre"], red.get("extrait", ""), c["url"])
            if hp and not direct:
                log(f"  hors périmètre écarté (article rédigé) : {red['titre'][:60]} — {pourquoi}")
                continue
            ident = str(int(time.time() * 1000))
            (RACINE / "images").mkdir(exist_ok=True)
            (RACINE / "images" / f"{ident}.jpg").write_bytes(jpg)
            # seule une vidéo du média qui ACCOMPAGNE l'article est reprise (YouTube) ; jamais de vidéo générée dans le repli cloud
            try:
                c["video"] = R.video_source(requests.get(c["url"], headers=UA, timeout=25).text, red["titre"], red.get("extrait", ""))
            except requests.RequestException:
                c["video"] = ""
            ecrire_brouillon(ident, c, red, officiels, slot, notif, src, direct)
            if slot != "test":
                marquer(slot, "cloud")
            return 0
    log("rien de neuf (aucune info avec texte et image exploitables)")
    return 2


def ecrire_brouillon(ident, c, red, officiels, slot, notif, src=None, direct=False):
    cat = red.get("categorie") if red.get("categorie") in C.CATEGORIES else ("Algérie" if c["pays"] == "DZ" else "Monde")
    now = C.maintenant_alger()
    canal_choix = "atchoix-" + secrets.token_hex(8)
    tags = ", ".join(f'"{C.q(t)}"' for t in (red.get("tags") or [])[:6] if str(t).strip())
    src = src or {"nom": c["source"], "url": c["url"], "admin": False}
    corps = R.assembler(red["contenu"], red["a_retenir"], src["nom"], src["url"], officiels, lead=red.get("lead", ""),
                        source_admin=src["admin"], direct=direct)
    texte = f"""---
titre: "{C.q(red['titre'])[:110]}"
categorie: {cat}
date: {now:%Y-%m-%d}
heure: {now:%H:%M}
image: "images/{ident}.jpg"
image_suggeree: "{C.SITE}/images/{ident}.jpg"
pdf: ""
video: "{c.get('video', '')}"
source: "{C.q(c['url'])}"
extrait: "{C.q(red.get('extrait'))[:220]}"
tags: [{tags}]
type:
position:
interactif: ""
interactif_a_faire: "true"
aretenir: "{R.champ_aretenir(red['a_retenir'])}"
mediaPriority: {"video" if c.get("video") else "image"}
brouillon: true
circuit: true
cree: "{datetime.datetime.utcnow():%Y-%m-%dT%H:%M:%SZ}"
choix_canal: "{canal_choix}"
---

{corps}"""
    (RACINE / "brouillons").mkdir(exist_ok=True)
    (RACINE / "brouillons" / f"{ident}.md").write_text(texte, encoding="utf-8")
    log(f"brouillon {ident} [{slot}] : {red['titre']}")
    if not notif:
        return
    C.notifier(f"À placer : {red['titre'][:60]}",
               f"{red.get('extrait', '')[:230]}\n\nChoisissez la place. Sans choix sous {C.DELAI_DEFAUT_MIN} min : à la Une (position 1)."
               f"\n(Brouillon automatique du cloud — {'source officielle citée, ' if officiels else ''}carte interactive ajoutée plus tard par le PC.)",
               clic=f"{C.SITE}/images/{ident}.jpg", actions=C.actions_choix(ident, canal_choix))
    C.notifier("Corriger ou rejeter ce brouillon ?", f"« {red['titre'][:80]} » — Corriger ouvre l'éditeur en ligne (connexion admin) ; "
               "Rejeter supprime le brouillon avant publication.",
               tags="pencil2", priorite=1, clic=C.SITE + "/",
               actions=f"view, Corriger, {C.SITE}/smart-ingest-pro.html?edit={ident}&draft=1; "
                       f"http, Rejeter, https://ntfy.sh/{canal_choix}, method=POST, body={ident}:rejeter, clear=true")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slot", choices=C.SLOTS + ("test",), required=True)  # « test » : n'inscrit pas le créneau au registre
    ap.add_argument("--sans-notif", action="store_true")
    a = ap.parse_args()
    return produire(a.slot, notif=not a.sans_notif)


if __name__ == "__main__":
    sys.exit(main())
