"""Flash JT (version E) — flash infos de 3 sujets en voix off (Henri) avec Pexels,
encadrés par l'accueil et la clôture de Rachid Basta.

Chaîne : collecte → filtre éditorial → 3 sujets (2 Algérie + 1 Monde, sinon les
meilleurs) → texte JT en un seul appel IA → voix Henri par sujet → plans Pexels
(ou photo d'article pertinente) → sous-titres mot à mot + bandeau de titre par
sujet → assemblage : [accueil de Rachid] + 3 sujets + [clôture de Rachid] →
tapis musical qui s'efface sous la voix + jingles.

L'accueil et la clôture sont de VRAIES vidéos de Rachid, déjà générées par Agnes
et validées (voix native conservée, aucun sous-titre ajouté) : bibliothèque
assets/rachid/intro/*.mp4 et assets/rachid/outro/*.mp4. Un nom de fichier contenant
« matin », « apres-midi » ou « soir » n'est retenu qu'à ce créneau ; sinon le clip
est choisi de façon déterministe selon la date et l'heure (variété, sans hasard
qui change à chaque relance). Les accueils ne doivent PAS citer de date.

Trop long pour ~62 s ? le dernier sujet est abandonné (3 → 2 → 1).

    python flash_jt.py --sortie flash-out                       # bibliothèque assets/rachid
    python flash_jt.py --intro a.mp4 --outro b.mp4 --sortie flash-out
"""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import express as X  # noqa: E402  (module « L'info en 30 s » : briques réutilisées)
from filtre_editorial import appeler_gemini, trier  # noqa: E402
from sources import collecter  # noqa: E402

NOM_FLASH = "Flash Info"
DUREE_TOTALE_MAX = 62.0     # secondes, voix + accueil + clôture
PAUSE = 0.5                 # silence après chaque sujet
JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
              "septembre", "octobre", "novembre", "décembre"]
CARDINAUX = ["", "premier", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze",
             "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf", "vingt",
             "vingt et un", "vingt-deux", "vingt-trois", "vingt-quatre", "vingt-cinq", "vingt-six",
             "vingt-sept", "vingt-huit", "vingt-neuf", "trente", "trente et un"]
SONS = X.SONS
JINGLE_TRANS = SONS / "jingle_trans.mp3"
ENC_V = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(X.FPS)]
ENC_A = ["-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2"]


def maintenant_alger() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=1)


def dire_jour(n: datetime) -> str:
    """« mercredi trente septembre » (titre du flash)."""
    return f"{JOURS[n.weekday()]} {CARDINAUX[n.day]} {MOIS_LONGS[n.month - 1]}"


def creneau(n: datetime = None) -> str:
    n = n or maintenant_alger()
    return "matin" if n.hour < 12 else ("apres-midi" if n.hour < 17 else "soir")


BIBLIOTHEQUE = Path(os.environ.get("RACHID_BIBLIOTHEQUE") or (X.RACINE / "assets" / "rachid")).resolve()


def choisir_rachid(genre: str, n: datetime = None) -> Path:
    """Accueil (genre='intro') ou clôture ('outro') de Rachid, pris dans la bibliothèque.
    Les fichiers taggés d'un autre créneau sont écartés ; le choix parmi le reste est
    déterministe (date + créneau), donc identique à chaque relance du même flash."""
    n = n or maintenant_alger()
    tous = sorted((BIBLIOTHEQUE / genre).glob("*.mp4"))
    if not tous:
        raise RuntimeError(f"bibliothèque vide : {BIBLIOTHEQUE / genre} (ajouter des vidéos de Rachid)")
    tags = ("matin", "apres-midi", "soir")
    ok = [p for p in tous if not any(t in p.stem.lower() for t in tags) or creneau(n) in p.stem.lower()]
    ok = ok or tous
    graine = int(hashlib.md5(f"{n:%Y%m%d}-{creneau(n)}-{genre}".encode()).hexdigest(), 16)
    return ok[graine % len(ok)]


# ── Choix des sujets ─────────────────────────────────────────────────────────
def choisir_sujets(gardes: list, n: int = 3) -> list:
    dz = [a for a in gardes if a["filtre"]["pays"] == "DZ"]
    monde = [a for a in gardes if a["filtre"]["pays"] != "DZ"]
    choix = dz[:2] + monde[:1]
    for a in gardes:
        if len(choix) >= n:
            break
        if a not in choix:
            choix.append(a)
    return choix[:n]


CONSIGNE_JT = """Tu écris le texte lu, en voix off de journal télévisé, d'un flash infos vidéo d'Algeria Tech
(le présentateur assure lui-même l'accueil et la clôture : n'écris NI bonjour NI au revoir).
Pour CHAQUE info ci-dessous, dans l'ordre :
- "texte" : DEUX phrases complètes, 30 mots maximum au total. Phrase 1 : le fait principal. Phrase 2 : le détail
  ou l'enjeu le plus important. La 2e info commence par « Autre sujet à la une, », la 3e par « Enfin, ».
  N'utilise QUE les faits présents dans l'article : aucun chiffre, nom ou date inventé. Pas d'emoji.
- "titre" : titre court à l'écran (45 caractères maximum, sans point final) ;
- "videos" : 4 requêtes EN ANGLAIS pour une banque de vidéos d'illustration (plans concrets et filmables,
  sans marque ni personne), une par phrase puis deux de secours ;
- "chiffre" : le chiffre clé recopié MOT POUR MOT depuis ton texte, {{"valeur": "...", "legende": "4 mots max"}}, sinon null.
Réponds en JSON : {{"sujets": [{{"titre": "...", "texte": "...", "videos": ["...", "...", "...", "..."], "chiffre": null}}, ...]}}

INFOS :
{infos}"""


def rediger_sujets(sujets: list):
    blocs = [f"{i}. [{a['source']}] {a['title']}\n{(a.get('corps') or a.get('summary') or '')[:1200]}"
             for i, a in enumerate(sujets, 1)]
    r = appeler_gemini(CONSIGNE_JT.format(infos="\n\n".join(blocs)), temperature=0.3)
    liste = (r or {}).get("sujets") if isinstance(r, dict) else None
    if not liste or len(liste) < len(sujets):
        return None
    out = []
    for s in liste[:len(sujets)]:
        texte = " ".join(str(s.get("texte", "")).split())
        if len(texte.split()) < 8:
            return None
        chiffre = s.get("chiffre") if isinstance(s.get("chiffre"), dict) else None
        if chiffre and str(chiffre.get("valeur", "")).strip() not in texte:
            chiffre = None
        out.append({"titre": " ".join(str(s.get("titre", "")).split()).rstrip(".")[:48], "texte": texte,
                    "videos": [str(q) for q in (s.get("videos") or []) if str(q).strip()][:4],
                    "chiffre": chiffre})
    return out


# ── Un sujet : voix + plans + habillage ─────────────────────────────────────
def fabriquer_sujet(i: int, n: int, article: dict, red: dict, tmp: Path) -> dict:
    dossier = tmp / f"s{i}"
    dossier.mkdir()
    voix = dossier / "voix.mp3"
    mots = X.synthetiser(red["texte"], voix)
    d_voix = X.duree(voix)
    groupes = X.phrases(red["texte"], X.ponctuer(red["texte"], mots))
    pays = article["filtre"]["pays"]
    photo = X.telecharger_photo(article.get("image"))
    if photo and not X.photo_pertinente(photo, red["titre"], red["texte"]):
        photo = None
    d = d_voix + PAUSE
    bornes = [0.0] + [g[0]["debut"] + 0.15 for g in groupes[1:]] + [d]
    clips = X.choisir_clips(red, len(bornes) - 1 - (1 if photo else 0),
                            max(b - a for a, b in zip(bornes, bornes[1:])) + 0.5)
    sources = []
    for k, c in enumerate(clips):
        try:
            sources.append((X.telecharger_clip(c["lien"], dossier / f"src{k}.mp4"), c["id"]))
        except Exception as e:
            X.journal(f"clip Pexels {c['id']} ignoré ({type(e).__name__})")
    elements = ([("photo", None)] if photo else []) + [("clip", s) for s in sources] or [("marque", None)]
    while len(bornes) - 1 > len(elements):
        bornes.pop(-2)
    plans = []
    for k, (genre, s) in enumerate(elements[:len(bornes) - 1]):
        a, b = bornes[k], bornes[k + 1]
        f = dossier / f"plan{k}.mp4"
        if genre == "photo":
            X.plan_photo(X.recadrer_16_9(photo, 2560), b - a, f, article["url"])
            credit, nom = f"Photo : {article['source']}", "photo"
        elif genre == "clip":
            X.plan_clip(s[0], b - a, f)
            credit, nom = "Vidéo : Pexels", f"pexels:{s[1]}"
        else:
            X.plan_photo(X.fond_marque(2560), b - a, f, article["url"])
            credit, nom = "", "marque"
        plans.append({"fichier": f, "debut": a, "duree": b - a, "credit": credit, "nom": nom})
    corps = dossier / "corps.mp4"
    red_ecran = {**red, "titre": f"{i}. {red['titre']}"}
    X.monter_corps(plans, d, red_ecran, pays, groupes, dossier, corps)
    seg = tmp / f"seg_sujet{i}.mp4"
    X.ffmpeg("-i", corps, "-i", voix, "-filter_complex",
             f"[0:v]fade=t=in:st=0:d=0.15,fade=t=out:st={d - 0.15:.2f}:d=0.15[v];"
             f"[1:a]apad,atrim=0:{d:.3f},aresample=44100,aformat=channel_layouts=stereo[a]",
             "-map", "[v]", "-map", "[a]", "-t", f"{d:.3f}", *ENC_V, *ENC_A, seg)
    return {"segment": seg, "duree": d, "titre": red["titre"], "texte": red["texte"], "source": article["source"],
            "url": article["url"], "pays": pays, "plans": [p["nom"] for p in plans],
            "titre_source": article["title"]}


# ── Rachid : accueil et clôture ─────────────────────────────────────────────
def cadre_rachid(pays_flash: str, bandeau_bas: str) -> Image.Image:
    """Calque : logo + étiquette Flash Info + date en haut ; bandeau optionnel en bas."""
    c = Image.new("RGBA", (X.L, X.H), (0, 0, 0, 0))
    grad = Image.new("L", (1, X.H))
    for y in range(X.H):
        grad.putpixel((0, y), int(max(0.0, 1 - y / (X.H * 0.22)) ** 1.6 * 150))
    c.paste(Image.new("RGBA", (X.L, X.H), (0, 0, 0, 255)), (0, 0), grad.resize((X.L, X.H)))
    d = ImageDraw.Draw(c)
    logo = X._logo(62)
    c.paste(logo, (30, 24), logo)
    fm = X.police(24)
    x = X._badge(d, 104, 36, f"Algeria Tech · {NOM_FLASH}", X.ROUGE, fm)
    d.text((x + 16, 55), X._date_fr(), font=X.police(22, grasse=False), fill=(240, 240, 240), anchor="lm")
    if bandeau_bas:  # renvoi vers le site, en haut à droite (le présentateur reste dégagé)
        f = X.police(26)
        w = int(f.getlength(bandeau_bas)) + 44
        x1 = X.L - 30
        d.rounded_rectangle((x1 - w, 30, x1, 76), radius=10, fill=(*X.JAUNE, 240))
        d.text((x1 - w // 2, 53), bandeau_bas, font=f, fill=(20, 20, 20), anchor="mm")
    return c


def segment_rachid(clip: Path, bandeau_haut: str, nom: str, tmp: Path) -> dict:
    """Vidéo de Rachid telle quelle (voix native d'Agnes conservée) : seulement le
    badge « Algeria Tech · Flash Info » et, en clôture, le renvoi vers le site.
    Aucun sous-titre : le texte du clip n'est pas connu et le clip reste propre."""
    dossier = tmp / nom
    dossier.mkdir()
    d = X.duree(clip)
    cadre_rachid("", bandeau_haut).save(dossier / "cadre.png")
    seg = tmp / f"seg_{nom}.mp4"
    X.ffmpeg("-i", clip, "-loop", "1", "-i", dossier / "cadre.png", "-filter_complex",
             f"[0:v]fps={X.FPS},scale={X.L}:{X.H}:force_original_aspect_ratio=increase,crop={X.L}:{X.H},setsar=1[b];"
             f"[b][1:v]overlay=0:0:shortest=1,fade=t=in:st=0:d=0.15,fade=t=out:st={d - 0.25:.2f}:d=0.25[v];"
             f"[0:a]aresample=44100,aformat=channel_layouts=stereo,apad,atrim=0:{d:.3f}[a]",
             "-map", "[v]", "-map", "[a]", "-t", f"{d:.3f}", *ENC_V, *ENC_A, seg, cwd=dossier)
    return {"segment": seg, "duree": d}


# ── Assemblage final + musique ───────────────────────────────────────────────
def assembler(segments: list, sortie: Path, tmp: Path):
    liste = tmp / "liste.txt"
    liste.write_text("".join(f"file '{Path(s['segment']).as_posix()}'\n" for s in segments), encoding="utf-8")
    joint = tmp / "joint.mp4"
    X.ffmpeg("-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", joint)
    total = X.duree(joint)
    entrees = ["-i", joint]
    a, musique, idx = ["[0:a]asplit=2[voix][cle]"], [], 1
    if X.TAPIS.is_file():
        entrees += ["-stream_loop", "-1", "-i", X.TAPIS]
        a.append(f"[{idx}:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,volume=0.55,afade=t=in:d=0.4,"
                 f"afade=t=out:st={total - 2.0:.2f}:d=2.0[tapis]")
        musique.append("[tapis]")
        idx += 1
    if X.JINGLE_INTRO.is_file():
        entrees += ["-i", X.JINGLE_INTRO]
        a.append(f"[{idx}:a]volume=0.8,apad,atrim=0:{total:.3f}[ji]")
        musique.append("[ji]")
        idx += 1
    if JINGLE_TRANS.is_file():
        debut = 0.0
        for s in segments[:-1]:  # jingle de transition entre chaque bloc « sujet »
            debut += s["duree"]
            if s.get("transition_apres"):
                ms = int(debut * 1000) - 300
                entrees += ["-i", JINGLE_TRANS]
                a.append(f"[{idx}:a]adelay={max(ms, 0)}|{max(ms, 0)},volume=0.8,apad,atrim=0:{total:.3f}[jt{idx}]")
                musique.append(f"[jt{idx}]")
                idx += 1
    if X.JINGLE_FIN.is_file():
        st = max(0.0, total - X.duree(X.JINGLE_FIN))
        entrees += ["-i", X.JINGLE_FIN]
        a.append(f"[{idx}:a]adelay={int(st * 1000)}|{int(st * 1000)},volume=0.8,apad,atrim=0:{total:.3f}[jf]")
        musique.append("[jf]")
        idx += 1
    if musique:
        a.append("".join(musique) + f"amix=inputs={len(musique)}:normalize=0:duration=longest[mus]")
        a.append("[mus][cle]sidechaincompress=threshold=0.02:ratio=9:attack=40:release=450:makeup=1[duck]")
        a.append("[voix][duck]amix=inputs=2:normalize=0,alimiter=limit=0.95[out]")
    else:
        a.append("[voix]anull[out]")
        a.append("[cle]anullsink")
    X.ffmpeg(*entrees, "-filter_complex", ";".join(a), "-map", "0:v", "-map", "[out]", "-t", f"{total:.3f}",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", sortie)
    return total


def produire(intro: Path, outro: Path, dossier: Path, n_max: int = 3, historique: list = ()):
    X.NOM = NOM_FLASH  # badge « Algeria Tech · Flash Info » dans l'habillage réutilisé
    articles = collecter(max_age_h=20, journal=X.journal)
    X.journal(f"{len(articles)} articles collectés")
    gardes, _ = trier(articles, historique=list(historique))
    sujets = choisir_sujets(gardes, n_max)
    if not sujets:
        raise RuntimeError("aucune info nouvelle")
    X.journal("sujets : " + " | ".join(f"[{a['filtre']['pays']}] {a['title'][:55]}" for a in sujets))
    sujets = [X.lire_article(a) for a in sujets]
    X.journal(f"accueil : {intro.name} | clôture : {outro.name}")
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        reds = None
        for _ in range(2):
            reds = rediger_sujets(sujets)
            if reds:
                break
        if not reds:
            raise RuntimeError("texte des sujets indisponible")
        d_rachid = X.duree(intro) + X.duree(outro)
        fabriques = []
        for i, (a, red) in enumerate(zip(sujets, reds), 1):
            f = fabriquer_sujet(i, len(sujets), a, red, tmp)
            fabriques.append(f)
            total = d_rachid + sum(x["duree"] for x in fabriques)
            X.journal(f"sujet {i} prêt ({f['duree']:.1f} s) — total provisoire {total:.1f} s")
            if total > DUREE_TOTALE_MAX and len(fabriques) > 1:
                X.journal("trop long : ce sujet est retiré")
                fabriques.pop()
                break
        n = len(fabriques)
        # accueil, sujets 1..n, clôture ; jingle de transition entre deux sujets seulement
        segs = [{**segment_rachid(intro, "", "intro", tmp), "transition_apres": False}]
        for k, f in enumerate(fabriques, 1):
            segs.append({"segment": f["segment"], "duree": f["duree"], "transition_apres": k < n})
        segs.append({**segment_rachid(outro, X.SITE, "outro", tmp), "transition_apres": False})
        dossier.mkdir(parents=True, exist_ok=True)
        base = dossier / f"flashjt-{time.strftime('%Y%m%d-%H%M%S')}"
        total = assembler(segs, base.with_suffix(".mp4"), tmp)
    meta = {"titre": f"Flash Info — {dire_jour(maintenant_alger())}", "sujets": [
        {k: f[k] for k in ("titre", "texte", "source", "url", "pays", "plans", "titre_source")} for f in fabriques],
        "accueil": intro.name, "cloture": outro.name, "duree": round(total, 1),
        "video": base.with_suffix(".mp4").name, "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    base.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    return meta


HIST_JT = X.RACINE / "data" / "flash-jt-history.json"


def lire_historique_jt() -> list:
    try:
        return json.loads(HIST_JT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def ajouter_historique_jt(meta: dict):
    """Mémorise les sujets du flash (pour ne jamais les rediffuser)."""
    h = lire_historique_jt()
    for s in meta["sujets"]:
        art = {"title": s["titre_source"], "url": s["url"]}
        h.append({"date": meta["date"], "url": s["url"], "titre": s["titre_source"],
                  "empreinte": X.empreinte(art)})
    HIST_JT.parent.mkdir(parents=True, exist_ok=True)
    HIST_JT.write_text(json.dumps(h[-300:], ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--intro", help="accueil de Rachid (sinon : bibliothèque assets/rachid/intro)")
    ap.add_argument("--outro", help="clôture de Rachid (sinon : bibliothèque assets/rachid/outro)")
    ap.add_argument("--sortie", default="flash-out")
    ap.add_argument("--sujets", type=int, default=3)
    ap.add_argument("--essai", action="store_true", help="n'enregistre pas les sujets dans l'historique")
    args = ap.parse_args()
    intro = Path(args.intro) if args.intro else choisir_rachid("intro")
    outro = Path(args.outro) if args.outro else choisir_rachid("outro")
    # jamais une info déjà passée : « L'info en 30 s » + flashs précédents
    historique = X.lire_historique() + lire_historique_jt()
    try:
        meta = produire(intro, outro, Path(args.sortie), args.sujets, historique)
    except RuntimeError as e:
        X.journal(f"pas de flash : {e}")
        sys.exit(2)
    if not args.essai:
        ajouter_historique_jt(meta)
    print(json.dumps(meta, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
