"""Publie les brouillons du circuit « article vidéo » selon le choix fait sur le téléphone (ntfy).

Mode normal : dans un dépôt déjà à jour (GitHub Actions, à la demande). Mode `--local` : sur le PC (tâche
planifiée Windows toutes les 15 min, aucune minute GitHub consommée) — clone temporaire d'origin/main,
publication, commit, push. Pour chaque brouillon `brouillons/<id>.md`
marqué `circuit: true` :
  - lit sur le canal ntfy de réponse (`choix_canal`) le dernier message « <id>:<choix> » ;
  - choix : une (position 1) · seconde (position 2) · breve (espace Brèves) · rejeter (suppression) ;
  - sans choix au bout de DELAI_MIN minutes : À LA UNE, position 1 (décision de l'administrateur du 2026-10-28).
  - brouillons Facebook : en-têtes `delai_min` (relecture) et `defaut` (breve | entreprise) prioritaires sur DELAI_MIN.
Publier = brouillons/<id>.md → articles/<id>.md (champs internes retirés), la place précédente est libérée.
Stdlib uniquement. Variables : NTFY_TOPIC (notification de confirmation, facultatif), DELAI_MIN, PUBLIER_RACINE.
"""
import datetime
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dedup as D  # noqa: E402  (dernier garde-fou : jamais deux articles sur le même fait)
import perimetre as P  # noqa: E402  (périmètre éditorial)
RACINE = Path(os.environ.get("PUBLIER_RACINE") or Path(__file__).resolve().parents[2])
SITE = "https://algeria-tech.pages.dev"
NTFY = os.environ.get("NTFY_BASE", "https://ntfy.sh")
DELAI_MIN = int(os.environ.get("DELAI_MIN", "0"))
INTERNES = ("image_suggeree", "brouillon", "circuit", "cree", "choix_canal", "defaut", "delai_min")
CHOIX = ("une", "seconde", "breve", "entreprise", "rejeter")
LIBELLE = {"une": "à la Une", "seconde": "en 2e position", "breve": "en brève", "entreprise": "dans Entreprises & Marques"}


def log(m):
    print(f"[publier] {m}", flush=True)


def champ(md, k):
    m = re.search(rf"^{k}:[ \t]*(.*)$", md, re.M)
    return m.group(1).strip().strip('"') if m else ""


def choix_ntfy(canal, ident):
    """Dernier choix posté pour ce brouillon (messages « <ident>:<choix> » du canal de réponse)."""
    try:
        with urllib.request.urlopen(f"{NTFY}/{canal}/json?poll=1&since=all", timeout=25) as r:
            lignes = r.read().decode("utf-8", "replace").splitlines()
    except Exception as e:
        log(f"  ntfy illisible ({type(e).__name__}) : {e}")
        return None
    dernier = None
    for l in lignes:
        try:
            j = json.loads(l)
        except ValueError:
            continue
        if j.get("event") != "message":
            continue
        m = re.fullmatch(rf"{re.escape(ident)}:({'|'.join(CHOIX)})", (j.get("message") or "").strip())
        if m:
            dernier = m.group(1)
    return dernier


def notifier(titre, message, clic):
    canal = os.environ.get("NTFY_TOPIC", "").strip()
    if not canal:
        return
    try:
        req = urllib.request.Request(f"{NTFY}/{canal}", data=message.encode("utf-8"),
                                     headers={"Title": titre.encode("utf-8"), "Tags": "newspaper", "Click": clic})
        urllib.request.urlopen(req, timeout=20)
    except Exception as e:
        log(f"  notification impossible : {e}")


def liberer_position(p, sauf):
    """Une seule Une / une seule 2e position : on libère l'ancienne."""
    motif = re.compile(rf"^position:[ \t]*{p}[ \t]*$", re.M)
    for f in (RACINE / "articles").glob("*.md"):
        if f.name == sauf:
            continue
        t = f.read_text(encoding="utf-8")
        if motif.search(t):
            f.write_text(motif.sub("position: ", t, count=1), encoding="utf-8")
            log(f"  position {p} libérée : {f.name}")


def publier(ident, action, md):
    for k in INTERNES:
        md = re.sub(rf"^{k}:.*\n", "", md, flags=re.M)
    md = re.sub(r"^position:.*$", "position: ", md, count=1, flags=re.M)
    md = re.sub(r"^type:.*$", "type: ", md, count=1, flags=re.M)
    if action == "breve":
        md = re.sub(r"^type:.*$", "type: breve", md, count=1, flags=re.M)
    elif action == "entreprise":
        md = re.sub(r"^type:.*$", "type: communique_entreprise", md, count=1, flags=re.M)
    else:
        p = "1" if action == "une" else "2"
        liberer_position(p, f"{ident}.md")
        md = re.sub(r"^position:.*$", f"position: {p}", md, count=1, flags=re.M)
    cible = RACINE / "articles" / f"{ident}.md"
    cible.parent.mkdir(exist_ok=True)
    cible.write_text(md, encoding="utf-8")
    (RACINE / "brouillons" / f"{ident}.md").unlink()


def main():
    dossier = RACINE / "brouillons"
    if not dossier.is_dir():
        log("aucun dossier brouillons")
        return 0
    maintenant = datetime.datetime.now(datetime.timezone.utc)
    modifie = 0
    arbitre = None
    try:   # avis de l'IA pour les cas limites (disponible sur le PC et dans le cloud, pas dans un environnement minimal)
        import circuit_flow as CF  # noqa: PLC0415
        arbitre = CF.arbitre_ia
    except Exception:  # noqa: BLE001
        pass
    for f in sorted(dossier.glob("*.md")):
        md = f.read_text(encoding="utf-8")
        ident = f.stem
        if champ(md, "circuit") != "true" or not re.fullmatch(r"\d{6,20}", ident):
            continue
        titre = champ(md, "titre")
        choix = choix_ntfy(champ(md, "choix_canal"), ident) if champ(md, "choix_canal") else None
        origine = "choix de l'administrateur"
        if not choix:
            try:
                age = (maintenant - datetime.datetime.fromisoformat(champ(md, "cree").replace("Z", "+00:00"))).total_seconds() / 60
            except ValueError:
                age = 0
            # Brouillons Facebook : délai de relecture et destination par défaut propres au brouillon (en-têtes delai_min / defaut)
            delai = int(champ(md, "delai_min") or DELAI_MIN) if (champ(md, "delai_min") or "").isdigit() else DELAI_MIN
            defaut = champ(md, "defaut") if champ(md, "defaut") in CHOIX else "une"
            if age < delai:
                log(f"{ident} : en attente de choix ({age:.0f}/{delai} min)")
                continue
            choix, origine = defaut, f"aucun choix sous {delai} min"
        # Garde-fou anti-doublon : un autre article publié depuis (autre circuit, saisie manuelle, brouillon plus ancien du même
        # créneau) peut déjà couvrir ce fait. On compare aux articles PUBLIÉS (y compris ceux publiés plus haut dans cette boucle).
        if choix != "rejeter":
            publies = [x for x in D.contexte_local(RACINE, 7) if x["origine"] == "publié"]
            doublon, pourquoi, ref = D.trouver_doublon(titre, champ(md, "source"), champ(md, "extrait"), publies, ignorer_id=ident, arbitre=arbitre)
            if doublon:
                f.unlink()
                log(f"{ident} : DOUBLON écarté ({titre[:60]}) — {pourquoi}")
                notifier("Doublon écarté (non publié)", f"« {titre[:90]} » : {pourquoi}", SITE)
                modifie += 1
                continue
        if choix != "rejeter":
            hp, pourquoi = P.hors_perimetre(titre, champ(md, "extrait"), champ(md, "source"))
            if hp:
                f.unlink()
                log(f"{ident} : HORS PÉRIMÈTRE écarté ({titre[:60]}) — {pourquoi}")
                notifier("Hors périmètre (non publié)", f"« {titre[:90]} » : {pourquoi}", SITE)
                modifie += 1
                continue
            # vidéo YouTube d'un autre média sans rapport avec l'article : on publie sans vidéo plutôt qu'avec une vidéo hors sujet
            m = re.search(r"^video:[ 	]*\"https?://(?:www\.)?youtube\.com/watch\?v=([A-Za-z0-9_-]{11})\"", md, re.M)
            if m and not D.video_yt_pertinente(m.group(1), titre, champ(md, "extrait"), si_illisible=True):
                log(f"{ident} : vidéo YouTube {m.group(1)} sans rapport avec l'article : retirée")
                md = re.sub(r'^video:.*$', 'video: ""', md, count=1, flags=re.M)
                md = re.sub(r'^mediaPriority:.*$', 'mediaPriority: image', md, count=1, flags=re.M)
        if choix == "rejeter":
            f.unlink()
            log(f"{ident} : rejeté ({titre[:60]})")
            notifier("Brouillon rejeté", f"« {titre[:90]} » a été supprimé.", SITE)
        else:
            publier(ident, choix, md)
            log(f"{ident} : publié {LIBELLE[choix]} ({origine}) — {titre[:60]}")
            notifier(f"Publié {LIBELLE[choix]}", f"« {titre[:90]} » ({origine}). En ligne dans 2 à 4 minutes.",
                     f"{SITE}/article/{ident}")
        modifie += 1
    log(f"{modifie} brouillon(s) traité(s)")
    return 0


def git(*a, cwd):
    r = subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError(f"git {' '.join(a[:2])} : {(r.stderr or r.stdout).strip()[:300]}")
    return r.stdout


def local():
    """Sur le PC : clone temporaire d'origin/main → publication → commit → push (les JSON locaux restent intouchés)."""
    global RACINE
    depot = Path(__file__).resolve().parents[2]
    git("fetch", "-q", "origin", cwd=depot)
    a_publier = [x for x in git("ls-tree", "-r", "--name-only", "origin/main", "brouillons", cwd=depot).splitlines() if x.endswith(".md")]
    r = subprocess.run(["git", "grep", "-l", "^interactif_a_faire:", "origin/main", "--", "articles", "brouillons"],
                       cwd=depot, capture_output=True, text=True, encoding="utf-8", errors="replace")
    a_completer = [l.split(":", 1)[1] for l in r.stdout.splitlines() if ":" in l]  # « origin/main:articles/<id>.md »
    import time as _t
    a_completer = [x for x in a_completer
                   if Path(x).stem.isdigit() and _t.time() * 1000 - int(Path(x).stem) < 4 * 86400 * 1000]  # 4 jours maximum
    if not a_publier and not a_completer:
        return 0  # aucun brouillon en attente ni carte interactive à ajouter : rien à faire
    tmp = Path("E:/algeria-tech-push-publish")
    if tmp.exists():
        subprocess.run(["git", "worktree", "remove", "--force", str(tmp)], cwd=depot, capture_output=True)
    git("worktree", "add", "-q", "--detach", str(tmp), "origin/main", cwd=depot)
    try:
        if not os.environ.get("NTFY_TOPIC"):
            try:
                os.environ["NTFY_TOPIC"] = Path("E:/01-flash-infos/flash_auto/ntfy_canal.txt").read_text(encoding="utf-8").strip()
            except OSError:
                pass
        RACINE = tmp
        # cartes interactives manquantes (articles produits par le repli cloud) : une par passage, sur le PC seulement
        for rel in a_completer[:1]:
            try:
                sys.path.insert(0, str(Path(__file__).resolve().parent))
                import circuit_flow as CF  # noqa: PLC0415  (exige requests + Article Interactif local)
                CF.completer_carte(tmp, tmp / rel)
            except Exception as e:  # noqa: BLE001 — la publication des brouillons ne doit jamais en dépendre
                log(f"  carte interactive non ajoutée ({type(e).__name__}) : {e}")
        main()
        git("add", "-A", cwd=tmp)
        if not git("diff", "--cached", "--name-only", cwd=tmp).strip():
            return 0
        git("-c", "user.name=circuit-flow", "-c", "user.email=circuit-flow@local", "commit", "-q", "-m",
            "Auto: publication des brouillons selon le choix ntfy", cwd=tmp)
        for essai in range(4):
            try:
                git("push", "-q", "origin", "HEAD:main", cwd=tmp)
                log("publication poussée sur GitHub")
                break
            except RuntimeError:
                if essai == 3:
                    raise
                git("fetch", "-q", "origin", cwd=tmp)
                git("rebase", "-q", "origin/main", cwd=tmp)
        return 0
    finally:
        subprocess.run(["git", "worktree", "remove", "--force", str(tmp)], cwd=depot, capture_output=True)
        subprocess.run(["git", "worktree", "prune"], cwd=depot, capture_output=True)


if __name__ == "__main__":
    sys.exit(local() if "--local" in sys.argv else main())
