"""Synchronise le CODE du dépôt local avec GitHub (origin/main), sans jamais écraser vos modifications.

Pourquoi : le dépôt local prenait des centaines de commits de retard (la copie locale ne se met pas à jour toute
seule). Le Hub (server.js) et le site en localhost tournaient alors avec du code périmé : flash absent, route
/api/deploy-github manquante (articles Smart Ingest PRO jamais envoyés à GitHub)…

Règles de sécurité :
  - un fichier SUIVI que vous avez modifié en local (git status) n'est JAMAIS touché ;
  - les fichiers de données alimentés par les automatismes (JSON de veille, listes d'articles…) ne sont jamais touchés ;
  - rien n'est supprimé ; aucun commit ; HEAD avance vers origin/main (index remis à jour, fichiers locaux intacts) ;
  - un seul passage à la fois (verrou), arrêt si un rebase/merge est en cours.

    python tools/sync_code.py [--dry-run]
Journal : tools/sync_code.log
"""
import datetime
import os
import subprocess
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
JOURNAL = RACINE / "tools" / "sync_code.log"
VERROU = RACINE / ".git" / "sync_code.lock"
# Données gérées par les automatismes / le Hub : jamais écrasées par ce script
DONNEES = (
    "revue_presse.json", "veille_data.json", "arpce_veille.json", "joradp_veille.json", "articles.json",
    "articles-list.json", "articles/list.json", "tic_social.json", "wiki_data.json", "comparateur_pending.json",
    "barometre_data.json", "barometre_history.json", "barometre_weekly.json", "barometre_weekly_history.json",
    "apify_cache.json", "facebook_cookies.json",
)
PREFIXES_DONNEES = ("data/", "feeds/", "logs/", "backup_", "node_modules/", ".claude/", "videos/", "images/inline-")


def log(msg):
    ligne = f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S}  {msg}"
    try:
        sys.stdout.write(ligne + "\n")
    except Exception:
        pass
    try:
        with open(JOURNAL, "a", encoding="utf-8") as f:
            f.write(ligne + "\n")
    except OSError:
        pass


def git(*args, check=True):
    r = subprocess.run(["git", "-c", "core.autocrlf=false", *args], cwd=RACINE, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if check and r.returncode:
        raise RuntimeError(f"git {' '.join(args[:3])} : {(r.stderr or r.stdout).strip()[:300]}")
    return r.stdout


def main():
    dry = "--dry-run" in sys.argv
    if VERROU.exists() and time.time() - VERROU.stat().st_mtime < 900:
        log("autre synchronisation en cours : abandon")
        return 0
    VERROU.write_text(str(os.getpid()))
    try:
        if any((RACINE / ".git" / m).exists() for m in ("MERGE_HEAD", "REBASE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD")):
            log("merge/rebase en cours : abandon")
            return 0
        for essai in range(4):  # collisions de verrous de références (tâche de publication en parallèle)
            try:
                git("fetch", "-q", "origin", "main")
                break
            except RuntimeError as e:
                if essai == 3:
                    raise
                time.sleep(4)
        base = git("rev-parse", "HEAD").strip()
        cible = git("rev-parse", "origin/main").strip()
        if base == cible:
            log("déjà à jour")
            return 0
        # fichiers suivis modifiés localement (y compris index) → intouchables
        modifies = set()
        for l in git("status", "--porcelain", "--untracked-files=no").splitlines():
            modifies.add(l[3:].strip().strip('"').split(" -> ")[-1])
        # fichiers « skip-worktree » / « assume-unchanged » : intouchables aussi
        for l in git("ls-files", "-v").splitlines():
            if l[:1] in ("S", "h"):
                modifies.add(l[2:].strip().strip('"'))
        diff = git("diff", "--name-status", "--no-renames", base, cible).splitlines()
        a_copier, ignores_mod, ignores_data = [], [], []
        for l in diff:
            st, _, chemin = l.partition("\t")
            if st not in ("A", "M"):
                continue  # suppressions : on ne supprime rien
            if chemin in DONNEES or chemin.startswith(PREFIXES_DONNEES):
                ignores_data.append(chemin)
            elif chemin in modifies:
                ignores_mod.append(chemin)
            else:
                a_copier.append(chemin)
        log(f"retard : {len(diff)} fichiers différents | à copier : {len(a_copier)} | "
            f"données ignorées : {len(ignores_data)} | modifiés en local (préservés) : {len(ignores_mod)}")
        for c in ignores_mod[:15]:
            log(f"   préservé (modifié en local) : {c}")
        if dry:
            for c in a_copier[:40]:
                log(f"   copierait : {c}")
            log("--dry-run : rien n'a été modifié")
            return 0
        n = 0
        for i in range(0, len(a_copier), 80):
            lot = a_copier[i:i + 80]
            git("checkout", cible, "--", *lot)
            n += len(lot)
        git("reset", "-q", "--mixed", cible)  # HEAD → origin/main ; fichiers locaux (modifiés / données) intacts
        log(f"synchronisé : {n} fichiers mis à jour, HEAD = {cible[:7]}")
        return 0
    except Exception as e:
        log(f"ÉCHEC : {type(e).__name__} {e}")
        return 1
    finally:
        try:
            VERROU.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    sys.exit(main())
