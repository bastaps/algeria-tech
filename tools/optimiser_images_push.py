"""Agent « images » : optimise automatiquement les nouvelles images du site déjà publiées sur GitHub.

Toutes les images (Hub, éditeur en ligne, circuit d'articles, veille mails…) finissent dans GitHub. Ce script
(tâche Windows toutes les 3 h, sans fenêtre) regarde s'il y a de NOUVELLES images lourdes depuis son dernier
passage ; si oui, il clone temporairement origin/main, lance tools/optimiser_images.py --apply (JPEG recompressés,
PNG→WebP, vignettes), puis commit + push. Aucun commit s'il n'y a rien à optimiser. N'écrase jamais le dépôt local.

    python tools/optimiser_images_push.py [--force]
Journal : tools/optimiser_images_push.log · État : .git/optimiser_images.state
"""
import datetime
import os
import subprocess
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
JOURNAL = RACINE / "tools" / "optimiser_images_push.log"
ETAT = RACINE / ".git" / "optimiser_images.state"
VERROU = RACINE / ".git" / "optimiser_images.lock"
TMP = Path("E:/algeria-tech-push-images")
SEUIL = 200 * 1024


def log(m):
    ligne = f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S}  {m}"
    try:
        sys.stdout.write(ligne + "\n")
    except Exception:
        pass
    try:
        with open(JOURNAL, "a", encoding="utf-8") as f:
            f.write(ligne + "\n")
    except OSError:
        pass


def git(*a, cwd=None, check=True):
    r = subprocess.run(["git", "-c", "core.autocrlf=false", *a], cwd=cwd or RACINE, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if check and r.returncode:
        raise RuntimeError(f"git {' '.join(a[:2])} : {(r.stderr or r.stdout).strip()[:300]}")
    return r.stdout


def nouvelles_images_lourdes(base, cible):
    sortie = git("diff", "--name-only", "--diff-filter=AM", base, cible, "--", "images")
    cand = []
    for chemin in sortie.splitlines():
        if chemin.startswith("images/t/") or not chemin.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        try:
            if int(git("cat-file", "-s", f"{cible}:{chemin}").strip()) >= SEUIL:
                cand.append(chemin)
        except RuntimeError:
            pass
    return cand


def main():
    force = "--force" in sys.argv
    if VERROU.exists() and time.time() - VERROU.stat().st_mtime < 1800:
        log("autre passage en cours : abandon")
        return 0
    VERROU.write_text(str(os.getpid()))
    try:
        for essai in range(4):
            try:
                git("fetch", "-q", "origin", "main")
                break
            except RuntimeError:
                if essai == 3:
                    raise
                time.sleep(4)
        cible = git("rev-parse", "origin/main").strip()
        base = ETAT.read_text().strip() if ETAT.exists() else None
        if base and git("cat-file", "-t", base, check=False).strip() != "commit":
            base = None
        if base == cible and not force:
            return 0
        if base is None:
            base = git("rev-parse", "origin/main~30").strip()  # première exécution : 30 derniers commits
        cand = nouvelles_images_lourdes(base, cible)
        if not cand and not force:
            ETAT.write_text(cible)
            return 0
        log(f"{len(cand)} nouvelle(s) image(s) lourde(s) : {', '.join(c.split('/')[-1] for c in cand[:6])}")
        if TMP.exists():
            subprocess.run(["git", "worktree", "remove", "--force", str(TMP)], cwd=RACINE, capture_output=True)
        git("worktree", "add", "-q", "--detach", str(TMP), cible)
        try:
            r = subprocess.run([sys.executable, str(TMP / "tools" / "optimiser_images.py"), "--root", str(TMP), "--apply"],
                               capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1500)
            resume = [l for l in r.stdout.splitlines() if l.startswith("Résumé")]
            log(resume[-1] if resume else f"optimiseur : code {r.returncode} {r.stderr[-200:]}")
            git("add", "-A", cwd=TMP)
            if not git("diff", "--cached", "--name-only", cwd=TMP).strip():
                ETAT.write_text(cible)
                return 0
            git("-c", "user.name=agent-images", "-c", "user.email=agent-images@local", "commit", "-q", "-m",
                "Auto: optimisation des nouvelles images (WebP, recompression, vignettes)", cwd=TMP)
            for essai in range(4):
                try:
                    git("push", "-q", "origin", "HEAD:main", cwd=TMP)
                    break
                except RuntimeError:
                    if essai == 3:
                        raise
                    git("fetch", "-q", "origin", cwd=TMP)
                    git("rebase", "-q", "origin/main", cwd=TMP)
            ETAT.write_text(git("rev-parse", "HEAD", cwd=TMP).strip())
            log("optimisations poussées sur GitHub")
        finally:
            subprocess.run(["git", "worktree", "remove", "--force", str(TMP)], cwd=RACINE, capture_output=True)
            subprocess.run(["git", "worktree", "prune"], cwd=RACINE, capture_output=True)
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
