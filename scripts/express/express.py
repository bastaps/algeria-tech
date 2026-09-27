"""Express « L'info en 30 s » — une info TIC, une vidéo de 30 s maximum.

Chaîne : collecte → filtre éditorial → texte Gemini (« Bonjour. » + 3 phrases,
sans rien inventer) → voix Henri (edge-tts, réglages par défaut, NE PAS MODIFIER)
→ montage : intro animée + jingle, un plan par phrase (photo de l'article si
pertinente, sinon vidéos Pexels), sous-titres mot à mot, étiquette ALGÉRIE/MONDE
et date, chiffre clé, barre de progression, fin animée + jingle, tapis musical
« info » qui s'efface sous la voix.

Rien de neuf, voix en échec ou texte trop long = pas de vidéo (code de sortie 2).

    python express.py                 # une vidéo, historique mis à jour
    python express.py --essai 3       # 3 vidéos d'essai, historique intact
"""
import argparse
import asyncio
import base64
import hashlib
import io
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import edge_tts
import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from filtre_editorial import appeler_gemini, empreinte, trier  # noqa: E402
from sources import UA, collecter  # noqa: E402

RACINE = Path(__file__).resolve().parents[2]  # dépôt algeria-tech
HISTORIQUE = RACINE / "data" / "express-history.json"
LOGO = RACINE / "images" / "logo_v2.png"
SONS = RACINE / "assets" / "express"
JINGLE_INTRO, JINGLE_FIN, TAPIS = SONS / "jingle_intro.mp3", SONS / "jingle_outro.mp3", SONS / "tapis_info.mp3"

NOM = "L'info en 30 s"
SITE = "algeria-tech.pages.dev"
VOIX = "fr-FR-HenriNeural"  # Henri — réglages voix inchangés (rate/pitch par défaut)
INTRO, FIN, MARGE = 2.4, 3.0, 0.6  # secondes : intro, fin animée, silence après la voix
DUREE_VOIX_MAX = 30 - INTRO - FIN - MARGE  # 24 s
L, H, FPS = 1280, 720, 25
VERT, ROUGE, JAUNE = (0, 98, 51), (210, 16, 52), (255, 212, 0)

POLICES = [os.environ.get("EXPRESS_FONT", ""), r"C:\Windows\Fonts\segoeuib.ttf",
           "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
POLICES_FINES = [r"C:\Windows\Fonts\segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
MOIS = ["janv.", "févr.", "mars", "avril", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]


def police(taille: int, grasse: bool = True):
    for p in (POLICES if grasse else POLICES_FINES):
        if p and Path(p).is_file():
            return ImageFont.truetype(p, taille)
    return ImageFont.load_default(taille)


def police_ass() -> str:
    """Nom de police pour les sous-titres (libass)."""
    return "Segoe UI" if Path(POLICES[1]).is_file() else "DejaVu Sans"


def journal(msg: str):
    print(f"[express] {msg}", flush=True)


def duree(fichier: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", str(fichier)], capture_output=True, text=True)
    return float(out.stdout.strip())


def ffmpeg(*args, cwd=None):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *map(str, args)], check=True, cwd=cwd)


# ── Historique ───────────────────────────────────────────────────────────────
def lire_historique() -> list:
    try:
        return json.loads(HISTORIQUE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def ajouter_historique(article: dict, texte: str):
    h = lire_historique()
    h.append({"date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "url": article["url"],
              "titre": article["title"], "empreinte": empreinte(article), "texte": texte})
    HISTORIQUE.parent.mkdir(parents=True, exist_ok=True)
    HISTORIQUE.write_text(json.dumps(h[-200:], ensure_ascii=False, indent=1), encoding="utf-8")


# ── Article : texte et photo ─────────────────────────────────────────────────
def lire_article(article: dict) -> dict:
    """Complète l'article : corps (pour ancrer Gemini) et photo og:image."""
    corps, image = article.get("summary", ""), article.get("image", "")
    try:
        r = requests.get(article["url"], headers=UA, timeout=25)
        s = BeautifulSoup(r.text, "html.parser")
        for prop in ("og:image", "twitter:image", "og:image:url"):
            m = s.find("meta", attrs={"property": prop}) or s.find("meta", attrs={"name": prop})
            if m and m.get("content", "").startswith("http"):
                image = m["content"]
                break
        paras = [" ".join(p.get_text(" ").split()) for p in s.find_all("p")]
        paras = [p for p in paras if len(p) > 80]
        if paras:
            corps = " ".join(paras)[:3000]
    except Exception as e:
        journal(f"page article illisible ({type(e).__name__}), résumé du flux utilisé")
    return {**article, "corps": corps, "image": image}


def telecharger_photo(url: str):
    if not url:
        return None
    try:
        img = Image.open(io.BytesIO(requests.get(url, headers=UA, timeout=25).content)).convert("RGB")
        if img.width < 480 or img.height < 270:
            return None
        return img
    except Exception:
        return None


# ── Texte ────────────────────────────────────────────────────────────────────
CONSIGNE_TEXTE = """Tu écris le texte lu d'une vidéo « L'info en 30 s » d'Algeria Tech.
Format EXACT : « Bonjour. » puis TROIS phrases, {mots} mots maximum au total (Bonjour compris).
Français clair, ton journal télévisé, phrases complètes et de longueurs proches.
Phrase 1 : le fait principal (qui, quoi). Phrase 2 : le détail le plus important.
Phrase 3 : l'enjeu ou la suite attendue.
N'utilise QUE les faits présents dans l'article ci-dessous : aucun chiffre, nom, date ou
détail inventé. Pas de formule d'au revoir, pas de question, pas d'emoji.
Donne aussi :
- "titre" : un titre court à l'écran (55 caractères maximum, sans point final) ;
- "videos" : 4 requêtes EN ANGLAIS pour chercher des vidéos d'illustration dans une banque
  d'images, une par phrase puis une de secours : plans concrets et filmables (ex. « data center
  server racks », « person paying with smartphone »), sans nom de marque ni de personne ;
- "chiffre" : le chiffre clé de l'info s'il y en a un, recopié MOT POUR MOT depuis ton texte
  (ex. {{"valeur": "1 million", "legende": "d'utilisateurs"}}, légende de 4 mots maximum), sinon null.
Réponds en JSON : {{"titre": "...", "texte": "Bonjour. ...", "videos": ["...", "...", "...", "..."],
"chiffre": null}}

SOURCE : {source}
TITRE : {titre}
ARTICLE : {corps}"""


def rediger(article: dict, mots: int = 58):
    r = appeler_gemini(CONSIGNE_TEXTE.format(
        mots=mots, source=article["source"], titre=article["title"],
        corps=article.get("corps") or article.get("summary") or article["title"]), temperature=0.3)
    if not isinstance(r, dict) or not r.get("texte"):
        return None
    texte = " ".join(str(r["texte"]).split())
    if not texte.startswith("Bonjour"):
        texte = "Bonjour. " + texte
    titre = " ".join(str(r.get("titre") or article["title"]).split()).rstrip(".")
    chiffre = r.get("chiffre") if isinstance(r.get("chiffre"), dict) else None
    if chiffre and str(chiffre.get("valeur", "")).strip() not in texte:
        chiffre = None  # jamais un chiffre absent du texte lu
    requetes = [str(q) for q in (r.get("videos") or []) if str(q).strip()][:4]
    return {"titre": titre[:60], "texte": texte, "videos": requetes, "chiffre": chiffre}


# ── Voix (avec horodatage de chaque mot pour les sous-titres) ────────────────
def synthetiser(texte: str, sortie: Path) -> list:
    """Voix Henri, réglages par défaut. Retourne [{mot, debut, fin}] en secondes."""
    async def _go():
        mots = []
        com = edge_tts.Communicate(texte, VOIX, boundary="WordBoundary")
        with open(sortie, "wb") as f:
            async for c in com.stream():
                if c["type"] == "audio":
                    f.write(c["data"])
                elif c["type"] == "WordBoundary":
                    mots.append({"mot": c.get("text", ""), "debut": c["offset"] / 1e7,
                                 "fin": (c["offset"] + c["duration"]) / 1e7})
        return mots
    for essai in range(3):
        try:
            mots = asyncio.run(_go())
            if sortie.stat().st_size > 1000 and mots:
                return mots
        except Exception as e:
            journal(f"voix : essai {essai + 1} en échec ({type(e).__name__})")
            time.sleep(3)
    raise RuntimeError("voix Henri indisponible")


def ponctuer(texte: str, mots: list) -> list:
    """Edge-TTS rend les mots sans ponctuation : on reprend, pour l'affichage,
    le morceau exact du texte (virgules, points, guillemets compris)."""
    pos, reperes = 0, []
    for m in mots:
        i = texte.find(m["mot"], pos)
        reperes.append(i if i >= 0 else None)
        if i >= 0:
            pos = i + len(m["mot"])
    for k, m in enumerate(mots):
        i = reperes[k]
        if i is None:
            m["affiche"] = m["mot"]
            continue
        j = next((r for r in reperes[k + 1:] if r is not None), len(texte))
        m["affiche"] = texte[i:j].strip() or m["mot"]
    for k in range(len(mots) - 1):  # le « ouvrant va avec le mot suivant
        if mots[k]["affiche"].endswith("«"):
            mots[k]["affiche"] = mots[k]["affiche"][:-1].strip()
            mots[k + 1]["affiche"] = "« " + mots[k + 1]["affiche"]
    return mots


def phrases(texte: str, mots: list) -> list:
    """Regroupe les mots horodatés en phrases (d'après la ponctuation du texte)."""
    groupes, cour, pos = [], [], 0
    for m in mots:
        cour.append(m)
        i = texte.find(m["mot"], pos)
        if i >= 0:
            pos = i + len(m["mot"])
            suite = texte[pos:pos + 3].lstrip(" »\"')")
            if suite[:1] in ".!?" or pos >= len(texte.rstrip(" .!?")):
                groupes.append(cour)
                cour = []
    if cour:
        groupes.append(cour)
    return groupes


# ── Illustration : photo vérifiée + vidéos Pexels ────────────────────────────
PEXELS_URL = "https://api.pexels.com/videos/search"


def _b64_jpeg(img: Image.Image, cote: int = 768) -> str:
    im = img.copy()
    im.thumbnail((cote, cote))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def photo_pertinente(img: Image.Image, titre: str, texte: str) -> bool:
    """Gemini regarde la photo : illustre-t-elle vraiment l'info ?"""
    r = appeler_gemini(
        "Voici la photo d'illustration d'un article. Info : « " + titre + " » — " + texte +
        "\nLa photo illustre-t-elle concrètement CETTE info (acteur, produit, lieu, objet ou "
        "situation dont on parle) ? Réponds non pour une image générique sans rapport, un simple "
        "logo de site, une bannière de texte, une capture illisible ou une image décorative "
        "interchangeable. JSON : {\"pertinente\": true|false, \"raison\": \"<8 mots>\"}",
        images=[("image/jpeg", _b64_jpeg(img))])
    ok = bool(isinstance(r, dict) and r.get("pertinente"))
    journal(f"photo {'pertinente' if ok else 'écartée'} : {(r or {}).get('raison', 'avis Gemini indisponible')}")
    return ok


def _pexels(requete: str) -> list:
    cle = (os.environ.get("PEXELS_API_KEY") or "").strip()
    if not cle:
        return []
    try:
        r = requests.get(PEXELS_URL, headers={"Authorization": cle}, timeout=25, params={
            "query": requete, "orientation": "landscape", "size": "medium", "per_page": 10})
        r.raise_for_status()
        return r.json().get("videos", [])
    except Exception as e:
        journal(f"Pexels indisponible ({type(e).__name__})")
        return []


def _fichier_hd(video: dict):
    fichiers = [f for f in video.get("video_files", [])
                if f.get("file_type") == "video/mp4" and (f.get("width") or 0) >= 1280]
    fichiers.sort(key=lambda f: abs((f.get("width") or 0) - 1920))
    return fichiers[0]["link"] if fichiers else None


def choisir_clips(red: dict, n: int, duree_min: float) -> list:
    """n vidéos Pexels, dans l'ordre des phrases, choisies par Gemini."""
    candidats = []
    for q in red.get("videos") or []:
        for v in _pexels(q):
            if v["id"] in {c["id"] for c in candidats}:
                continue
            if (v.get("duration") or 0) < duree_min or not _fichier_hd(v):
                continue
            slug = v.get("url", "").rstrip("/").rsplit("/", 1)[-1]
            candidats.append({"id": v["id"], "desc": re.sub(r"-?\d+$", "", slug).replace("-", " "),
                              "lien": _fichier_hd(v)})
        if len(candidats) >= 32:
            break
    if not candidats or n <= 0:
        return []
    liste = "\n".join(f"{i}. {c['desc']}" for i, c in enumerate(candidats))
    r = appeler_gemini(
        f"Texte lu : {red['texte']}\nChoisis {n} vidéos DIFFÉRENTES pour illustrer, dans l'ordre, "
        f"les {n} dernières phrases du texte (une vidéo par phrase, plans concrets et cohérents, "
        f"pas de hors-sujet ; si aucune ne convient pour une phrase, prends la plus proche du "
        f"sujet général).\n{liste}\nJSON : {{\"choix\": [<numéros dans l'ordre>]}}")
    choix = [candidats[i] for i in (r or {}).get("choix", []) if isinstance(i, int) and 0 <= i < len(candidats)]
    return list({c["id"]: c for c in choix}.values())[:n]


def telecharger_clip(lien: str, sortie: Path) -> Path:
    for essai in range(3):  # coupures réseau : 3 essais
        try:
            with requests.get(lien, headers=UA, timeout=60, stream=True) as r:
                r.raise_for_status()
                with open(sortie, "wb") as f:
                    for bloc in r.iter_content(1 << 20):
                        f.write(bloc)
            return sortie
        except requests.RequestException:
            if essai == 2:
                raise
            time.sleep(5)


# ── Visuels fixes (Pillow) ───────────────────────────────────────────────────
def recadrer_16_9(img: Image.Image, largeur: int) -> Image.Image:
    hauteur = largeur * 9 // 16
    ratio = max(largeur / img.width, hauteur / img.height)
    img = img.resize((round(img.width * ratio), round(img.height * ratio)), Image.LANCZOS)
    x = (img.width - largeur) // 2
    y = max(0, int((img.height - hauteur) * 0.35))
    return img.crop((x, y, x + largeur, y + hauteur))


def fond_marque(largeur: int = L, decalage: float = 0.0) -> Image.Image:
    """Dégradé vert → rouge sombre, avec un reflet diagonal (decalage 0..1)."""
    hauteur = largeur * 9 // 16
    fond = Image.new("RGB", (largeur, hauteur))
    d = ImageDraw.Draw(fond)
    for x in range(largeur):
        t = x / largeur
        d.line([(x, 0), (x, hauteur)], fill=tuple(int(VERT[i] * (1 - t) * 0.8 + ROUGE[i] * t * 0.55) for i in range(3)))
    if decalage:
        reflet = Image.new("L", (largeur, hauteur), 0)
        cx = int(-largeur * 0.4 + decalage * largeur * 1.8)
        ImageDraw.Draw(reflet).polygon([(cx, 0), (cx + 160, 0), (cx - 200, hauteur), (cx - 360, hauteur)], fill=70)
        fond.paste(Image.new("RGB", (largeur, hauteur), (255, 255, 255)), (0, 0), reflet.filter(ImageFilter.GaussianBlur(40)))
    return fond


def _logo(cote: int) -> Image.Image:
    return Image.open(LOGO).convert("RGBA").resize((cote, cote), Image.LANCZOS)


def _ease(t: float) -> float:
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3


def _date_fr() -> str:
    t = time.gmtime(time.time() + 3600)  # heure d'Algérie
    return f"{t.tm_mday} {MOIS[t.tm_mon - 1]} {t.tm_year}"


def _badge(d: ImageDraw.ImageDraw, x: int, y: int, texte: str, couleur, f) -> int:
    w = int(f.getlength(texte)) + 28
    d.rounded_rectangle((x, y, x + w, y + 38), radius=7, fill=(*couleur, 240))
    d.text((x + 14, y + 19), texte, font=f, fill="white", anchor="lm")
    return x + w


def image_intro(t: float, pays: str) -> Image.Image:
    """Intro animée : reflet, logo qui grossit, nom de l'émission qui glisse."""
    img = fond_marque(L, decalage=t / INTRO)
    d = ImageDraw.Draw(img, "RGBA")
    e = _ease(t / 0.9)
    cote = int(300 * (0.55 + 0.45 * e))
    logo = _logo(cote)
    logo.putalpha(logo.getchannel("A").point(lambda a: int(a * e)))
    img.paste(logo, (L // 2 - cote // 2 - 260, H // 2 - cote // 2), logo)
    e2 = _ease((t - 0.35) / 0.8)
    x = int(L // 2 - 60 + (1 - e2) * 200)
    f1, f2 = police(78), police(30)
    d.text((x, H // 2 - 30), NOM.upper(), font=f1, fill=(255, 255, 255, int(255 * e2)), anchor="ls")
    d.rectangle((x, H // 2 - 8, x + int(500 * e2), H // 2 - 2), fill=(*JAUNE, int(255 * e2)))
    e3 = _ease((t - 0.8) / 0.6)
    if e3 > 0:
        fx = police(24)
        bx = _badge(d, x, H // 2 + 22, "ALGÉRIE" if pays == "DZ" else "MONDE", ROUGE if pays == "DZ" else (30, 90, 170), fx)
        d.text((bx + 16, H // 2 + 41), _date_fr(), font=f2, fill=(255, 255, 255, int(255 * e3)), anchor="lm")
    return img


def image_fin(t: float) -> Image.Image:
    """Fin animée : logo, renvoi vers le site."""
    img = fond_marque(L, decalage=1 - t / FIN)
    d = ImageDraw.Draw(img, "RGBA")
    e = _ease(t / 0.7)
    cote = 230
    logo = _logo(cote)
    logo.putalpha(logo.getchannel("A").point(lambda a: int(a * e)))
    img.paste(logo, (L // 2 - cote // 2, 110 - int((1 - e) * 30)), logo)
    e2 = _ease((t - 0.4) / 0.7)
    d.text((L // 2, 420), "Toute l'actualité tech d'Algérie et du monde", font=police(38),
           fill=(255, 255, 255, int(255 * e2)), anchor="mm")
    f = police(44)
    w = int(f.getlength(SITE)) + 60
    d.rounded_rectangle((L // 2 - w // 2, 470, L // 2 + w // 2, 540), radius=12, fill=(*JAUNE, int(255 * e2)))
    d.text((L // 2, 505), SITE, font=f, fill=(20, 20, 20, int(255 * e2)), anchor="mm")
    return img


def habillage(titre: str, pays: str) -> Image.Image:
    """Calque permanent du corps : marque, étiquette + date, titre, fond sous-titres."""
    c = Image.new("RGBA", (L, H), (0, 0, 0, 0))
    # dégradés sombres haut et bas (lisibilité)
    grad = Image.new("L", (1, H))
    for y in range(H):
        haut = max(0.0, 1 - y / (H * 0.32)) ** 1.6 * 170
        bas = max(0.0, (y - H * 0.62) / (H * 0.38)) ** 1.5 * 200
        grad.putpixel((0, y), int(max(haut, bas)))
    c.paste(Image.new("RGBA", (L, H), (0, 0, 0, 255)), (0, 0), grad.resize((L, H)))
    d = ImageDraw.Draw(c)
    x0, y0 = 30, 24
    logo = _logo(62)
    c.paste(logo, (x0, y0), logo)
    fm = police(24)
    x = _badge(d, x0 + 74, y0 + 12, f"Algeria Tech · {NOM}", ROUGE, fm)
    x = _badge(d, x + 10, y0 + 12, "ALGÉRIE" if pays == "DZ" else "MONDE",
               VERT if pays == "DZ" else (30, 90, 170), fm)
    d.text((x + 14, y0 + 31), _date_fr(), font=police(22, grasse=False), fill=(240, 240, 240), anchor="lm")
    # titre sous la barre de marque
    ft = police(34)
    lignes, cour = [], ""
    for m in titre.split():
        essai = f"{cour} {m}".strip()
        if ft.getlength(essai) <= 820:
            cour = essai
        else:
            lignes.append(cour)
            cour = m
    lignes.append(cour)
    for i, ligne in enumerate(lignes[:2]):
        d.rectangle((x0, 108 + i * 46, x0 + 6, 146 + i * 46), fill=JAUNE)
        d.text((x0 + 18, 140 + i * 46), ligne, font=ft, fill="white", anchor="ls")
    return c


def carte_chiffre(chiffre: dict) -> Image.Image:
    c = Image.new("RGBA", (L, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    fv, fl = police(64), police(26)
    v, lg = str(chiffre["valeur"]), str(chiffre.get("legende") or "")
    w = int(max(fv.getlength(v), fl.getlength(lg))) + 60
    x1, y1 = L - 40, 250
    d.rounded_rectangle((x1 - w, y1, x1, y1 + 130), radius=16, fill=(15, 15, 15, 215), outline=(*JAUNE, 255), width=3)
    d.text((x1 - w // 2, y1 + 58), v, font=fv, fill=JAUNE, anchor="mm")
    d.text((x1 - w // 2, y1 + 104), lg, font=fl, fill="white", anchor="mm")
    return c


def credit_png(texte: str) -> Image.Image:
    c = Image.new("RGBA", (L, H), (0, 0, 0, 0))
    ImageDraw.Draw(c).text((L - 24, 36), texte, font=police(17, grasse=False),
                           fill=(235, 235, 235, 220), anchor="rm")
    return c


# ── Sous-titres mot à mot (ASS) ──────────────────────────────────────────────
def _ts(s: float) -> str:
    s = max(0.0, s)
    return f"{int(s // 3600)}:{int(s % 3600 // 60):02d}:{s % 60:05.2f}"


def sous_titres(groupes: list, decalage: float, fin_corps: float, sortie: Path):
    """Blocs de 5 mots maximum (coupés aux phrases), mot prononcé surligné en jaune."""
    blocs = []
    for g in groupes:
        for i in range(0, len(g), 5):
            blocs.append(g[i:i + 5])
    lignes = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {L}", f"PlayResY: {H}", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: S,{police_ass()},54,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,3.5,1.5,2,60,60,70,1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for b, bloc in enumerate(blocs):
        fin_bloc = blocs[b + 1][0]["debut"] if b + 1 < len(blocs) else min(bloc[-1]["fin"] + 0.6, fin_corps - decalage)
        for k, m in enumerate(bloc):
            debut = m["debut"]
            fin = bloc[k + 1]["debut"] if k + 1 < len(bloc) else fin_bloc
            mots = [(r"{\c&H00D4FF&}" + x.get("affiche", x["mot"]) + r"{\c&HFFFFFF&}") if j == k
                    else x.get("affiche", x["mot"]) for j, x in enumerate(bloc)]
            lignes.append(f"Dialogue: 0,{_ts(debut + decalage)},{_ts(fin + decalage)},S,,0,0,0,,{' '.join(mots)}")
    sortie.write_text("\n".join(lignes), encoding="utf-8")


# ── Montage ──────────────────────────────────────────────────────────────────
def _encoder(args: list, sortie: Path, cwd=None):
    ffmpeg(*args, "-an", "-r", FPS, "-c:v", "libx264", "-preset", "medium", "-crf", "18",
           "-pix_fmt", "yuv420p", sortie, cwd=cwd)


def plan_photo(fond: Image.Image, d: float, sortie: Path, graine: str):
    """Photo fixe + Ken Burns (zoom lent, ancrage varié)."""
    f = sortie.with_suffix(".jpg")
    fond.save(f, quality=93)
    images = int(d * FPS) + 1
    ax, ay = [(0.5, 0.5), (0.35, 0.4), (0.65, 0.4), (0.5, 0.3)][int(hashlib.md5(graine.encode()).hexdigest(), 16) % 4]
    kb = (f"zoompan=z='min(1+{0.14 / images:.6f}*on,1.14)':x='(iw-iw/zoom)*{ax}':y='(ih-ih/zoom)*{ay}'"
          f":d={images}:s={L}x{H}:fps={FPS}")
    _encoder(["-i", f, "-vf", kb, "-t", f"{d:.3f}"], sortie)


def plan_clip(source: Path, d: float, sortie: Path):
    """Extrait de d secondes pris au milieu de la vidéo, recadré en 16:9."""
    debut = max(0.0, (duree(source) - d) / 2)
    _encoder(["-ss", f"{debut:.2f}", "-i", source, "-t", f"{d:.3f}", "-vf",
              f"scale={L}:{H}:force_original_aspect_ratio=increase,crop={L}:{H},setsar=1,fps={FPS}"], sortie)


def sequence_animee(fabrique, d: float, dossier: Path, nom: str) -> Path:
    """Rend une séquence image par image (Pillow) puis l'encode."""
    rep = dossier / nom
    rep.mkdir(exist_ok=True)
    n = int(round(d * FPS))
    for i in range(n):
        fabrique(i / FPS).save(rep / f"{i:04d}.png")
    sortie = dossier / f"{nom}.mp4"
    _encoder(["-framerate", FPS, "-i", rep / "%04d.png", "-t", f"{d:.3f}"], sortie)
    return sortie


def monter_corps(plans: list, d_corps: float, red: dict, pays: str, groupes: list,
                 dossier: Path, sortie: Path):
    """Corps : plans coupés sur les phrases + habillage + crédits + chiffre clé
    + sous-titres + barre de progression. Durée d_corps, voix à t=0."""
    habillage(red["titre"], pays).save(dossier / "habillage.png")
    Image.new("RGBA", (L, 6), (*JAUNE, 255)).save(dossier / "barre.png")
    entrees, filtres = [], []
    for p in plans:
        entrees += ["-i", p["fichier"]]
    n = len(plans)
    filtres.append("".join(f"[{i}:v]" for i in range(n)) + f"concat=n={n}:v=1:a=0[base]")
    entrees += ["-loop", "1", "-i", dossier / "habillage.png", "-loop", "1", "-i", dossier / "barre.png"]
    filtres.append(f"[base][{n}:v]overlay=0:0[h0]")
    filtres.append(f"[h0][{n + 1}:v]overlay=x='-w+w*t/{d_corps:.3f}':y=H-6[h1]")
    cour, k = "[h1]", n + 2
    for i, p in enumerate(plans):  # crédit propre à chaque plan
        if p["credit"]:
            f = dossier / f"credit{i}.png"
            credit_png(p["credit"]).save(f)
            entrees += ["-loop", "1", "-i", f]
            filtres.append(f"{cour}[{k}:v]overlay=0:0:enable='between(t,{p['debut']:.2f},{p['debut'] + p['duree']:.2f})'[c{i}]")
            cour, k = f"[c{i}]", k + 1
    chiffre = red.get("chiffre")
    if chiffre:  # la carte apparaît quand Henri prononce le chiffre
        premier = str(chiffre["valeur"]).split()[0]
        t0 = next((m["debut"] for g in groupes for m in g if premier in m["mot"]), None)
        if t0 is not None:
            carte_chiffre(chiffre).save(dossier / "chiffre.png")
            entrees += ["-loop", "1", "-t", f"{d_corps:.3f}", "-i", dossier / "chiffre.png"]
            t1 = min(t0 + 4.0, d_corps - 0.5)
            filtres.append(f"[{k}:v]format=rgba,fade=t=in:st={t0:.2f}:d=0.3:alpha=1,"
                           f"fade=t=out:st={t1:.2f}:d=0.3:alpha=1[ch]")
            filtres.append(f"{cour}[ch]overlay=0:0[cc]")
            cour, k = "[cc]", k + 1
    sous_titres(groupes, 0.0, d_corps, dossier / "st.ass")
    filtres.append(f"{cour}ass=st.ass,format=yuv420p[v]")
    ffmpeg(*entrees, "-filter_complex", ";".join(filtres), "-map", "[v]", "-t", f"{d_corps:.3f}",
           "-an", "-r", FPS, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
           sortie, cwd=dossier)


def mixer_et_assembler(intro: Path, corps: Path, fin: Path, voix: Path, total: float, sortie: Path):
    """Enchaîne intro → corps → fin (fondus) et mixe : jingles + tapis musical
    (qui s'efface sous la voix) + voix Henri."""
    x = 0.3  # fondu entre séquences
    d_intro, d_corps = duree(intro), duree(corps)
    off1 = d_intro - x
    off2 = off1 + d_corps - x
    v = (f"[0:v][1:v]xfade=transition=fade:duration={x}:offset={off1:.3f}[a];"
         f"[a][2:v]xfade=transition=fade:duration={x}:offset={off2:.3f},"
         f"fade=t=out:st={total - 0.4:.2f}:d=0.4,format=yuv420p[v]")
    debut_voix = off1 + 0.15
    entrees = ["-i", intro, "-i", corps, "-i", fin, "-i", voix]
    a = [f"[3:a]adelay={int(debut_voix * 1000)}|{int(debut_voix * 1000)},apad,atrim=0:{total:.3f},asplit=2[voix][cle]"]
    musique = []
    idx = 4
    if TAPIS.is_file():
        entrees += ["-stream_loop", "-1", "-i", TAPIS]
        a.append(f"[{idx}:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,volume=0.55,"
                 f"afade=t=in:d=0.4,afade=t=out:st={total - 2.0:.2f}:d=2.0[tapis]")
        musique.append("[tapis]")
        idx += 1
    if JINGLE_INTRO.is_file():
        entrees += ["-i", JINGLE_INTRO]
        a.append(f"[{idx}:a]volume=0.9,apad,atrim=0:{total:.3f}[ji]")
        musique.append("[ji]")
        idx += 1
    if JINGLE_FIN.is_file():
        d_jf = duree(JINGLE_FIN)
        st = max(0.0, total - d_jf)
        entrees += ["-i", JINGLE_FIN]
        a.append(f"[{idx}:a]adelay={int(st * 1000)}|{int(st * 1000)},volume=0.9,apad,atrim=0:{total:.3f}[jf]")
        musique.append("[jf]")
        idx += 1
    if musique:
        a.append("".join(musique) + f"amix=inputs={len(musique)}:normalize=0[mus]")
        # la musique baisse d'environ 14 dB dès qu'Henri parle
        a.append("[mus][cle]sidechaincompress=threshold=0.02:ratio=9:attack=40:release=450:makeup=1[musduck]")
        a.append("[voix][musduck]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]")
    else:
        a.append("[voix]anull[a]")
        a.append("[cle]anullsink")
    ffmpeg(*entrees, "-filter_complex", v + ";" + ";".join(a), "-map", "[v]", "-map", "[a]",
           "-t", f"{total:.3f}", "-r", FPS, "-c:v", "libx264", "-preset", "medium", "-crf", "21",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", sortie)


# ── Chaîne complète ──────────────────────────────────────────────────────────
def clip_pexels(ident) -> dict:
    """Une vidéo Pexels précise (mode --refaire)."""
    r = requests.get(f"https://api.pexels.com/videos/videos/{ident}", timeout=25,
                     headers={"Authorization": (os.environ.get("PEXELS_API_KEY") or "").strip()})
    r.raise_for_status()
    return {"id": ident, "lien": _fichier_hd(r.json())}


def produire(article: dict, dossier: Path, reprise: dict = None) -> dict:
    """reprise = métadonnées d'une vidéo déjà faite : même texte et mêmes plans,
    sans appel à Gemini (pour refaire le montage)."""
    if reprise:
        red = {k: reprise.get(k) for k in ("titre", "texte", "chiffre")}
        red["videos"] = reprise.get("requetes_video") or []
    else:
        article = lire_article(article)
        red = rediger(article)
    if not red:
        raise RuntimeError("texte Gemini indisponible")
    base = dossier / f"express-{time.strftime('%Y%m%d-%H%M%S')}-{hashlib.md5(article['url'].encode()).hexdigest()[:6]}"
    voix = base.with_suffix(".mp3")
    mots = synthetiser(red["texte"], voix)
    d_voix = duree(voix)
    if d_voix > DUREE_VOIX_MAX and not reprise:  # une seule reprise, plus courte ; sinon abandon
        journal(f"voix trop longue ({d_voix:.1f} s), texte raccourci")
        red = rediger(article, mots=48) or red
        mots = synthetiser(red["texte"], voix)
        d_voix = duree(voix)
        if d_voix > DUREE_VOIX_MAX:
            raise RuntimeError(f"voix trop longue ({d_voix:.1f} s)")
    groupes = phrases(red["texte"], ponctuer(red["texte"], mots))
    # « Bonjour. » rejoint la première phrase : un plan par phrase d'information
    if len(groupes) > 1 and len(groupes[0]) <= 2:
        groupes = [groupes[0] + groupes[1]] + groupes[2:]
    pays = article["filtre"]["pays"]

    photo = telecharger_photo(article.get("image"))
    if reprise:
        photo = photo if reprise.get("photo") else None
    elif photo and not photo_pertinente(photo, red["titre"], red["texte"]):
        photo = None
    d_corps = d_voix + MARGE + 0.3  # 0,3 s absorbées par le fondu d'entrée
    # bornes des plans : début de chaque phrase (le 1er plan part de 0)
    bornes = [0.0] + [g[0]["debut"] + 0.15 for g in groupes[1:]] + [d_corps]
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        n_plans = len(bornes) - 1
        if reprise:
            clips = [clip_pexels(x.split(":", 1)[1]) for x in reprise.get("illustration", [])
                     if x.startswith("pexels:")]
        else:
            clips = choisir_clips(red, n_plans - (1 if photo else 0),
                                  max(b - a for a, b in zip(bornes, bornes[1:])) + 0.5)
        sources = []
        for i, c in enumerate(clips):
            try:
                sources.append((telecharger_clip(c["lien"], tmp / f"src{i}.mp4"), c["id"]))
            except Exception as e:
                journal(f"clip Pexels {c['id']} ignoré ({type(e).__name__})")
        elements = ([("photo", None)] if photo else []) + [("clip", s) for s in sources]
        if not elements:
            elements = [("marque", None)]
        # moins d'éléments que de phrases : on fusionne les dernières phrases
        while len(bornes) - 1 > len(elements):
            bornes.pop(-2)
        plans = []
        for i, (genre, s) in enumerate(elements[:len(bornes) - 1]):
            a, b = bornes[i], bornes[i + 1]
            f = tmp / f"plan{i}.mp4"
            if genre == "photo":
                plan_photo(recadrer_16_9(photo, 2560), b - a, f, article["url"])
                credit, nom = f"Photo : {article['source']}", "photo"
            elif genre == "clip":
                plan_clip(s[0], b - a, f)
                credit, nom = "Vidéo : Pexels", f"pexels:{s[1]}"
            else:
                plan_photo(fond_marque(2560), b - a, f, article["url"])
                credit, nom = "", "marque"
            plans.append({"fichier": f, "debut": a, "duree": b - a, "credit": credit, "nom": nom})
        corps = tmp / "corps.mp4"
        monter_corps(plans, d_corps, red, pays, groupes, tmp, corps)
        intro = sequence_animee(lambda t: image_intro(t, pays), INTRO, tmp, "intro")
        fin = sequence_animee(image_fin, FIN, tmp, "fin")
        total = round(INTRO + d_corps + FIN - 0.6, 2)
        video = base.with_suffix(".mp4")
        mixer_et_assembler(intro, corps, fin, voix, total, video)
    voix.unlink(missing_ok=True)
    illustration = [p["nom"] for p in plans]
    journal("plans : " + " + ".join(illustration))
    meta = {"titre": red["titre"], "texte": red["texte"], "source": article["source"],
            "url": article["url"], "pays": pays, "photo": bool(photo), "illustration": illustration,
            "chiffre": red.get("chiffre"), "requetes_video": red.get("videos"),
            "image": article.get("image", ""), "duree": duree(video), "video": video.name,
            "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    base.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--essai", type=int, default=0, help="N vidéos d'essai, historique intact")
    ap.add_argument("--sortie", default=str(RACINE / "express-out"))
    ap.add_argument("--max-age", type=float, default=24)
    ap.add_argument("--refaire", help="JSON d'une vidéo déjà faite : refait le montage à l'identique")
    args = ap.parse_args()
    dossier = Path(args.sortie)
    dossier.mkdir(parents=True, exist_ok=True)

    if args.refaire:
        m = json.loads(Path(args.refaire).read_text(encoding="utf-8"))
        article = {"title": m["titre"], "url": m["url"], "source": m["source"], "image": m.get("image", ""),
                   "filtre": {"pays": m.get("pays", "INT")}}
        meta = produire(article, dossier, reprise=m)
        journal(f"OK {meta['video']} ({meta['duree']:.1f} s) — {meta['titre']}")
        return

    historique = lire_historique()
    articles = collecter(max_age_h=args.max_age, journal=journal)
    journal(f"{len(articles)} articles collectés")
    gardes, _ = trier(articles, historique=historique)
    journal(f"{len(gardes)} retenus par le filtre")
    if not gardes:
        journal("rien de neuf : pas de publication")
        sys.exit(2)

    voulu = max(1, args.essai)
    faites = []
    for article in gardes:
        if len(faites) >= voulu:
            break
        try:
            meta = produire(article, dossier)
        except Exception as e:  # on passe à l'info suivante
            journal(f"échec sur « {article['title'][:60]} » : {type(e).__name__} {e}")
            continue
        journal(f"OK {meta['video']} ({meta['duree']:.1f} s) — {meta['titre']}")
        faites.append(meta)
        if not args.essai:
            ajouter_historique(article, meta["texte"])
    if not faites:
        journal("aucune vidéo produite : pas de publication")
        sys.exit(2)
    print(json.dumps(faites, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
