"""Ajoute des accueils / clôtures de Rachid Basta à la bibliothèque du flash JT.

Tu fournis des plans générés par Agnes (même longs, même avec une date ou une info
qui date). L'outil transcrit la voix mot à mot (faster-whisper, gratuit, sur le PC),
puis ne garde que le morceau réutilisable :
  - accueil  : la salutation, coupée AVANT toute date (« … Tech By Basta, ce lundi
               14 septembre 2026 » devient « … Tech By Basta ») ; refusé s'il ne salue pas ;
  - clôture  : à partir de « Merci de votre attention » / « À bientôt » jusqu'à la fin
               (la dernière info qui précède est retirée) ; refusée sans formule de fin.
Il étiquette le créneau (matin / apres-midi / soir) d'après les mots (« bonne fin de
soirée » → soir), écrit le clip dans <sortie>/intro ou <sortie>/outro et tient à jour
<sortie>/bibliotheque.json (texte gardé, durée, source).

    python ajouter_rachid.py --sortie assets/rachid  intro  clip1.mp4 clip2.mp4
    python ajouter_rachid.py --sortie assets/rachid  outro  clip3.mp4
    python ajouter_rachid.py --dossier-agnes E:/agnes-video-generator-master/.working_dir  --sortie assets/rachid
"""
import argparse
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

MOIS = r"janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre"
JOURS = r"lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche"
# la reconnaissance vocale écorche parfois un jour (« vendredit ») : on compare le début du mot
RE_DATE = re.compile(rf"^(({JOURS[:-len('dimanche')]}dimanche)\w{{0,2}}|vendred\w*|{MOIS}|20\d\d|\d{{1,2}})$", re.I)
LIAISONS = {"ce", "se", "cette", "le", "on", "est", "nous", "sommes", "en", "du", "ici", "aujourd'hui", "aujourd"}
# un accueil qui annonce déjà un sujet ne peut pas resservir
RE_SUJET = re.compile(r"(événement suivant|evenement suivant|évêvement|premier sujet|première en|à la une)", re.I)
RE_SALUT = re.compile(r"^(bonjour|bonsoir|bienvenue)", re.I)
RE_FIN = re.compile(r"^(merci|bientôt|bientot)$", re.I)
_modele = None


def nettoyer(m: str) -> str:
    return re.sub(r"[^\wàâäçéèêëîïôöùûüÿœ'-]", "", m.lower()).replace("’", "'")


def ffprobe(p: Path) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,codec_type",
                        "-of", "json", str(p)], capture_output=True, text=True)
    j = json.loads(r.stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    return {"duree": float(j["format"]["duration"]), "l": v["width"], "h": v["height"],
            "audio": any(s["codec_type"] == "audio" for s in j["streams"])}


def transcrire(clip: Path) -> list:
    global _modele
    from faster_whisper import WhisperModel
    if _modele is None:
        _modele = WhisperModel("small", device="cpu", compute_type="int8")
    with tempfile.TemporaryDirectory() as t:
        wav = os.path.join(t, "a.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(clip), "-ar", "16000", "-ac", "1", wav], check=True)
        segments, _ = _modele.transcribe(wav, language="fr", word_timestamps=True, beam_size=5,
                                         condition_on_previous_text=False)
        return [{"m": w.word.strip(), "d": w.start, "f": w.end} for s in segments for w in (s.words or [])]


def coupe_entre(mots: list, i: int) -> float:
    """Instant de coupe entre le mot i-1 et le mot i (milieu du silence s'il existe)."""
    fin_prec, debut_suiv = mots[i - 1]["f"], mots[i]["d"]
    return fin_prec + min(max(debut_suiv - fin_prec, 0.12), 0.35) / 2 if debut_suiv - fin_prec > 0.12 else fin_prec + 0.06


def analyser(role: str, mots: list, duree: float):
    """Retourne (début, fin, texte gardé) ou (None, None, raison du refus)."""
    if len(mots) < 3:
        return None, None, "voix non reconnue"
    if role == "intro":
        if not RE_SALUT.search(nettoyer(mots[0]["m"])):
            return None, None, "ne commence pas par une salutation"
        k = next((i for i, m in enumerate(mots) if RE_DATE.match(nettoyer(m["m"]))), None)
        if k is None:
            fin, gardes = min(duree, mots[-1]["f"] + 0.45), mots   # pas de silence traînant après la parole
        else:
            j = k
            while j > 1 and nettoyer(mots[j - 1]["m"]) in LIAISONS:
                j -= 1
            if j < 3:
                return None, None, "la date suit immédiatement la salutation"
            fin, gardes = coupe_entre(mots, j), mots[:j]
        texte = " ".join(m["m"] for m in gardes)
        if RE_SUJET.search(texte):
            return None, None, "l'accueil annonce déjà un sujet"
        return 0.0, min(fin + 0.05, duree), texte
    # clôture
    k = next((i for i, m in enumerate(mots) if RE_FIN.match(nettoyer(m["m"]))), None)
    if k is None:
        return None, None, "aucune formule de fin (merci / à bientôt)"
    if k == 0:
        debut = 0.0
    elif nettoyer(mots[k]["m"]) in ("bientôt", "bientot") and nettoyer(mots[k - 1]["m"]) != "à":
        # le « À » de « À bientôt » n'est souvent pas transcrit : il se trouve juste avant
        debut = mots[k - 1]["f"] + 0.03
    else:
        debut = coupe_entre(mots, k)
    return max(debut, 0.0), min(duree, mots[-1]["f"] + 0.55), " ".join(m["m"] for m in mots[k:])


def creneau_de(texte: str) -> str:
    t = texte.lower()
    if re.search(r"soir|bonsoir", t):
        return "soir"
    if re.search(r"matin", t):
        return "matin"
    if re.search(r"après-midi|apres-midi", t):
        return "apres-midi"
    return ""


def ajouter(role: str, clip: Path, sortie: Path) -> str:
    info = ffprobe(clip)
    if not info["audio"]:
        return "refusé : pas de son"
    if info["l"] < info["h"]:
        return "refusé : vidéo verticale"
    mots = transcrire(clip)
    debut, fin, texte = analyser(role, mots, info["duree"])
    if debut is None:
        return f"refusé : {texte}"
    if fin - debut < 1.5:
        return f"refusé : trop court ({fin - debut:.1f} s)"
    tag = creneau_de(texte)
    cle = hashlib.md5(f"{clip}".encode()).hexdigest()[:6]
    dest = sortie / role / f"{role}_{cle}{'_' + tag if tag else ''}.mp4"
    dest.parent.mkdir(parents=True, exist_ok=True)
    d = fin - debut
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{debut:.3f}", "-i", str(clip), "-t", f"{d:.3f}",
                    "-vf", "fps=25", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
                    "-af", f"afade=t=in:d=0.04,afade=t=out:st={max(d - 0.08, 0):.3f}:d=0.08",
                    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", str(dest)],
                   check=True)
    reg = sortie / "bibliotheque.json"
    liste = json.loads(reg.read_text(encoding="utf-8")) if reg.exists() else []
    liste = [x for x in liste if x["fichier"] != f"{role}/{dest.name}"]
    liste.append({"fichier": f"{role}/{dest.name}", "role": role, "creneau": tag or "tous", "texte": texte,
                  "duree": round(d, 1), "source": str(clip)})
    reg.write_text(json.dumps(liste, ensure_ascii=False, indent=1), encoding="utf-8")
    return f"OK {dest.name} ({d:.1f} s, {tag or 'tous créneaux'}) : « {texte} »"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sortie", required=True, help="dossier de la bibliothèque (contient intro/ et outro/)")
    ap.add_argument("--dossier-agnes", help="scanne un dossier .working_dir d'Agnes (premiers / derniers plans)")
    ap.add_argument("role", nargs="?", choices=["intro", "outro"])
    ap.add_argument("clips", nargs="*")
    a = ap.parse_args()
    sortie = Path(a.sortie)
    travaux = []
    if a.dossier_agnes:
        for d in sorted(glob.glob(os.path.join(a.dossier_agnes, "20*_*"))):
            plans = sorted(glob.glob(os.path.join(d, "para_*", "video.mp4")),
                           key=lambda p: int(os.path.basename(os.path.dirname(p)).split("_")[1]))
            if len(plans) >= 2:
                travaux += [("intro", Path(plans[0])), ("outro", Path(plans[-1]))]
    elif a.role:
        travaux = [(a.role, Path(c)) for c in a.clips]
    else:
        sys.exit("donner un rôle (intro|outro) et des clips, ou --dossier-agnes")
    for role, clip in travaux:
        try:
            print(f"[{role}] {clip.parent.parent.name[:22]}/{clip.parent.name} → {ajouter(role, clip, sortie)}", flush=True)
        except Exception as e:
            print(f"[{role}] {clip} → erreur {type(e).__name__} {e}", flush=True)


if __name__ == "__main__":
    main()
