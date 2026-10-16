"""Circuit « article vidéo » en brouillon : revue de presse → rédaction IA → vidéo Google Flow
→ carte interactive → brouillon à valider (notification ntfy).

Tourne sur le PC (Hub Smart Ingest :3000 + Article Interactif :5000, lancés au besoin).
L'étape Google Flow n'a pas d'API : elle est pilotée dans Chrome (voir RUNBOOK_FLOW.md).

    python circuit_flow.py choisir                      # choisit l'info, prépare le job Flow
    python circuit_flow.py finaliser <ident> <clip.mp4> # rédige, fabrique la carte, dépose le brouillon
        [--sans-push]  (essai à blanc : rien n'est publié ni notifié)

Codes de sortie : 0 ok · 2 rien de neuf · 3 quota du jour déjà utilisé · 1 erreur.
Rien n'est jamais publié : le brouillon attend la validation dans /admin-brouillons.html.
"""
import argparse
import datetime
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")
RACINE = Path(__file__).resolve().parents[2]
WORK = Path(os.environ.get("CIRCUIT_FLOW_DIR", r"E:\MonStudioIA\circuit-flow"))
HISTORIQUE = WORK / "historique.json"
HUB, AI = "http://localhost:3000", "http://localhost:5000"
SITE = "https://algeria-tech.pages.dev"
NTFY_FICHIER = Path(r"E:\01-flash-infos\flash_auto\ntfy_canal.txt")
CATEGORIES = ["Algérie", "Télécoms", "Mobile", "Startups", "IA", "Fintech", "Innovation", "Monde", "Entreprises"]

# Liste de suivi (marques, opérateurs, institutions, événements TIC) : bonus de score
SUIVI = re.compile(r"huawei|ericsson|samsung|\blg\b|nokia|zte|ooredoo|mobilis|djezzy|alg[ée]rie t[ée]l[ée]com|"
                   r"alg[ée]rie poste|alg[ée]rie t[ée]l[ée]com|ministre de la poste|mptn|arpce|ministère de la poste|"
                   r"startup|salon|forum|conf[ée]rence|hackathon|\bcyber|5g|fibre|data ?center|intelligence artificielle", re.I)
TECH = re.compile(r"t[ée]l[ée]com|mobile|internet|num[ée]rique|\bia\b|intelligence artificielle|cyber|r[ée]seau|"
                  r"fibre|5g|4g|satellite|startup|logiciel|application|plateforme|donn[ée]es|cloud|digital", re.I)

PROMPT_FLOW = ("Anime cette image en une vidéo de 8 secondes au format 16:9. Lent travelling avant cinématographique ; "
               "mouvements naturels et discrets des personnes et des objets visibles, légers mouvements de la lumière et "
               "de l'arrière-plan. Garde identiques les visages, les vêtements, les écrans, les textes et le décor de "
               "l'image. Ambiance sonore naturelle et discrète. Aucun texte ajouté, aucun logo, aucune nouvelle personne.")


def log(m):
    print(f"[circuit] {m}", flush=True)


def lire(chemin, defaut):
    try:
        return json.loads(Path(chemin).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return defaut


def historique():
    return lire(HISTORIQUE, [])


def sauver_historique(h):
    WORK.mkdir(parents=True, exist_ok=True)
    HISTORIQUE.write_text(json.dumps(h[-200:], ensure_ascii=False, indent=1), encoding="utf-8")


def aujourd_hui():
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=1)).strftime("%Y-%m-%d")  # heure d'Alger


# ── Serveurs locaux ─────────────────────────────────────────────────────────
def repond(url):
    try:
        return requests.get(url, timeout=4).status_code < 500
    except requests.RequestException:
        return False


def lancer(cmd, cwd):
    subprocess.Popen(cmd, cwd=cwd, creationflags=0x00000008 | 0x08000000,  # DETACHED_PROCESS | CREATE_NO_WINDOW
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL)


def serveurs():
    if not repond(HUB):
        log("démarrage du Hub (port 3000)…")
        lancer(["node", "server.js"], str(RACINE))
    if not repond(AI):
        log("démarrage d'Article Interactif (port 5000)…")
        lancer([sys.executable, "app.py"], str(RACINE / "article-interactif"))
    for _ in range(40):
        if repond(HUB) and repond(AI):
            return
        time.sleep(2)
    raise RuntimeError("Hub (3000) ou Article Interactif (5000) ne répondent pas")


# ── 1. Choix de l'info ──────────────────────────────────────────────────────
def charger_revue():
    try:
        r = requests.get(f"{SITE}/revue_presse.json", timeout=20)
        r.raise_for_status()
        return r.json()
    except Exception:
        return lire(RACINE / "revue_presse.json", {})


def deja_vus():
    vus = {h.get("url") for h in historique()}
    try:
        for a in requests.get(f"{SITE}/articles-list.json", timeout=20).json()[:400]:
            vus.add(a.get("source"))
    except Exception:
        for a in lire(RACINE / "articles-list.json", [])[:400]:
            vus.add(a.get("source"))
    return vus


def candidats():
    """Revue de presse d'abord ; veille réseaux sociaux en complément (opérateurs, équipementiers, ministères)."""
    out = []
    for a in charger_revue().get("articles", []):
        titre = re.sub(r"<[^>]+>", " ", a.get("titre", "")).strip()
        texte = f"{titre} {a.get('resume', '')}"
        s = (50 if a.get("pays") == "DZ" else 0) + 10 * min(3, len(TECH.findall(texte))) + 25 * bool(SUIVI.search(texte))
        s += 10 if str(a.get("date", ""))[:10] == aujourd_hui() else 0
        if not TECH.search(texte) and not SUIVI.search(texte):
            s -= 60  # « que du tech » : sans lien avec le numérique, on ne retient pas
        out.append({"score": s, "titre": titre, "url": a.get("url"), "source": a.get("source", ""),
                    "pays": a.get("pays", ""), "origine": "revue"})
    limite = datetime.datetime.utcnow() - datetime.timedelta(days=4)
    for p in lire(RACINE / "tic_social.json", {}).get("posts", []):
        if p.get("category") not in ("Opérateurs", "Équipementiers", "Ministère", "Infrastructure"):
            continue
        if "news.google.com" in (p.get("url") or ""):
            continue  # redirection opaque : pas de texte exploitable
        try:
            d = datetime.datetime.fromisoformat(str(p.get("date")).replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            continue
        if d < limite:
            continue
        txt = re.sub(r"\s+", " ", str(p.get("text", "")))[:200]
        out.append({"score": 35 + 25 * bool(SUIVI.search(txt)), "titre": txt, "url": p["url"],
                    "source": p.get("source_short", ""), "pays": "DZ", "origine": "social"})
    out.sort(key=lambda c: -c["score"])
    return out


def weserv(url_image):
    sans = re.sub(r"^https?://", "", url_image)
    return ("https://images.weserv.nl/?url=" + requests.utils.quote(sans, safe="/:") +
            "&w=1672&h=941&fit=cover&a=attention&output=jpg&q=90")


def telecharger_image(url):
    """Image de l'article, recadrée en 16:9 (haut favorisé), 1672 px max, JPEG. None si inexploitable."""
    from PIL import Image
    try:
        r = requests.get(url, timeout=40, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125 Safari/537.36",
                                                   "Referer": url.split("/wp-content")[0] + "/"})
        img = Image.open(io.BytesIO(r.content)).convert("RGB")
    except Exception:
        return None
    if img.width < 800 or img.height < 450:
        return None
    h169 = round(img.width * 9 / 16)
    if h169 <= img.height:  # trop haute : on rogne en hauteur
        y = int((img.height - h169) * 0.3)
        img = img.crop((0, y, img.width, y + h169))
    else:  # trop large : on rogne en largeur
        w169 = round(img.height * 16 / 9)
        x = (img.width - w169) // 2
        img = img.crop((x, 0, x + w169, img.height))
    if img.width > 1672:
        img = img.resize((1672, 941))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def choisir():
    h = historique()
    if not os.environ.get("CIRCUIT_FORCE") and any(x.get("jour") == aujourd_hui() and x.get("etat") != "echec" for x in h):
        log("quota du jour déjà utilisé (1 vidéo Flow par jour)")
        return 3
    serveurs()
    vus = deja_vus()
    for c in candidats()[:12]:
        if not c["url"] or c["url"] in vus:
            continue
        try:
            f = requests.post(f"{HUB}/api/fetch-url", json={"url": c["url"]}, timeout=60).json()
        except Exception as e:
            log(f"  lecture impossible ({type(e).__name__}) : {c['titre'][:60]}")
            continue
        texte, image = (f.get("text") or "").strip(), f.get("image") or ""
        if len(texte) < 400 or not image.startswith("http"):
            log(f"  ignoré (texte ou image manquant) : {c['titre'][:70]}")
            continue
        jpg = telecharger_image(image)
        if not jpg:
            log(f"  ignoré (image inexploitable) : {c['titre'][:70]}")
            continue
        ident = str(int(time.time() * 1000))
        dossier = WORK / ident
        dossier.mkdir(parents=True, exist_ok=True)
        (dossier / "image.jpg").write_bytes(jpg)
        job = {"ident": ident, "article": {k: c[k] for k in ("titre", "url", "source", "pays", "origine", "score")},
               "titre_page": f.get("title", ""), "texte": texte, "image_source": image,
               "image_weserv": weserv(image), "prompt_flow": PROMPT_FLOW,
               "dossier": str(dossier), "clip_attendu": str(dossier / "clip.mp4")}
        (dossier / "job.json").write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")
        h.append({"jour": aujourd_hui(), "ident": ident, "url": c["url"], "titre": c["titre"], "etat": "prepare"})
        sauver_historique(h)
        log(f"choisi (score {c['score']}) : {c['titre'][:90]}")
        print(json.dumps({"ident": ident, "job": str(dossier / "job.json")}, ensure_ascii=False))
        return 0
    log("rien de neuf (aucune info avec texte et image exploitables)")
    return 2


# ── 2. Finalisation ─────────────────────────────────────────────────────────
def ntfy_canal():
    try:
        return NTFY_FICHIER.read_text(encoding="utf-8").strip()
    except OSError:
        return os.environ.get("NTFY_TOPIC", "")


def notifier(titre, message, tags="newspaper", clic=f"{SITE}/admin-brouillons.html"):
    canal = ntfy_canal()
    if not canal:
        log("ntfy : canal introuvable")
        return
    try:
        requests.post(f"https://ntfy.sh/{canal}", data=message.encode("utf-8"), timeout=20,
                      headers={"Title": titre.encode("utf-8"), "Tags": tags, "Click": clic})
    except requests.RequestException as e:
        log(f"ntfy : {e}")


def q(v):
    return str(v or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip()


def points_essentiels(g):
    """« À retenir » : 2-3 phrases tirées de l'article rédigé (aucune invention)."""
    phrases = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", f"{g['lead']} {g['contenu']}"))
    pts = [p.strip() for p in phrases if 60 <= len(p) <= 230][:3]
    return "\n".join(pts)


def finaliser(ident, clip, sans_push):
    dossier = WORK / ident
    job = lire(dossier / "job.json", None)
    if not job:
        raise RuntimeError(f"job introuvable : {dossier}")
    clip = Path(clip)
    sonde = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration",
                            "-of", "json", str(clip)], capture_output=True, text=True)
    info = json.loads(sonde.stdout or "{}")
    if not any(s.get("codec_type") == "video" for s in info.get("streams", [])) or float(info.get("format", {}).get("duration", 0)) < 3:
        raise RuntimeError("clip Flow invalide (pas de vidéo ou trop court)")
    serveurs()
    # rédaction : moteur de Smart Ingest PRO, mode IA, style PRO étoffé
    corps_source = f"{job['titre_page']}\n\n{job['texte']}\n\nSource : {job['article']['source']} — {job['article']['url']}"
    g = requests.post(f"{HUB}/api/smart-generate", json={"text": corps_source[:9000], "style": "pro"}, timeout=240).json()
    if not (g.get("titre") and g.get("lead") and len(str(g.get("contenu", "")).split()) >= 150):
        raise RuntimeError("rédaction IA insuffisante")
    cat = g.get("categorie") if g.get("categorie") in CATEGORIES else ("Algérie" if job["article"]["pays"] == "DZ" else "Monde")
    video_url, image_rel = f"/videos/articles/{ident}.mp4", f"images/{ident}.jpg"
    # carte interactive : Article Interactif, mode IA
    corps = f"# {g['titre']}\n\n{g['lead']}\n\n{g['contenu']}"
    gen = requests.post(f"{AI}/api/generate", timeout=300, json={
        "text": corps, "mode": "real", "primary_color": "#0d3b24", "accent_color": "#d21034", "dark_mode": False,
        "source_url": job["article"]["url"], "gallery": [], "widgets": {},
        "medias": {"video": {"url": video_url, "caption": g["titre"][:120]}}}).json()
    if gen.get("error"):
        raise RuntimeError("carte interactive : " + str(gen["error"]))
    rendu = requests.post(f"{AI}/api/render", json=gen, timeout=120).json()
    if rendu.get("error") or len(rendu.get("html", "")) < 5000:
        raise RuntimeError("rendu de la carte interactive en échec")
    # fichiers du brouillon
    sortie = dossier / "out"
    for sous in ("brouillons", "videos/articles", "images", "interactifs"):
        (sortie / sous).mkdir(parents=True, exist_ok=True)
    shutil.copy(clip, sortie / "videos" / "articles" / f"{ident}.mp4")
    shutil.copy(dossier / "image.jpg", sortie / "images" / f"{ident}.jpg")
    (sortie / "interactifs" / f"{ident}.html").write_text(rendu["html"], encoding="utf-8")
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    tags = ", ".join(f'"{q(t)}"' for t in (g.get("tags") or [])[:6] if str(t).strip())
    md = f"""---
titre: "{q(g['titre'])[:110]}"
categorie: {cat}
date: {now:%Y-%m-%d}
heure: {now:%H:%M}
image: "{image_rel}"
image_suggeree: "{SITE}/{image_rel}"
pdf: ""
video: "{video_url}"
source: "{q(job['article']['url'])}"
extrait: "{q(g['lead'])[:260]}"
tags: [{tags}]
type:
position:
interactif: "/interactifs/{ident}.html"
aretenir: "{q(points_essentiels(g))}"
mediaPriority: video
brouillon: true
---

{g['contenu'].strip()}
"""
    (sortie / "brouillons" / f"{ident}.md").write_text(md, encoding="utf-8")
    log(f"brouillon prêt en local : {sortie}")
    h = historique()
    for x in h:
        if x.get("ident") == ident:
            x["etat"] = "essai" if sans_push else "brouillon"
    sauver_historique(h)
    if sans_push:
        log("--sans-push : rien n'est déposé ni notifié")
        return 0
    deposer(ident, sortie, g["titre"])
    notifier("Brouillon vidéo à valider", f"« {g['titre']} » — vidéo Flow + version interactive prêtes.\n"
             f"Relire puis publier dans l'admin.")
    return 0


def git(*a, cwd):
    r = subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError(f"git {' '.join(a[:2])} : {(r.stderr or r.stdout).strip()[:300]}")
    return r.stdout


def deposer(ident, sortie, titre):
    """Dépôt via un dossier temporaire cloné depuis origin/main (le dépôt local a du retard)."""
    tmp = Path(r"E:\algeria-tech-push-circuit")
    git("fetch", "-q", "origin", cwd=RACINE)
    if tmp.exists():
        subprocess.run(["git", "worktree", "remove", "--force", str(tmp)], cwd=RACINE, capture_output=True)
    git("worktree", "add", "-q", "--detach", str(tmp), "origin/main", cwd=RACINE)
    try:
        for rel in (f"brouillons/{ident}.md", f"videos/articles/{ident}.mp4", f"images/{ident}.jpg", f"interactifs/{ident}.html"):
            cible = tmp / rel
            cible.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(sortie / rel, cible)
            git("add", "-f", rel, cwd=tmp)
        git("-c", "user.name=circuit-flow", "-c", "user.email=circuit-flow@local", "commit", "-q", "-m",
            f"Auto: brouillon vidéo à valider — {titre[:70]}", cwd=tmp)
        for essai in range(4):
            try:
                git("push", "-q", "origin", "HEAD:main", cwd=tmp)
                break
            except RuntimeError:
                if essai == 3:
                    raise
                git("fetch", "-q", "origin", cwd=tmp)
                git("rebase", "-q", "origin/main", cwd=tmp)
        log("brouillon déposé sur GitHub (déploiement Cloudflare en cours)")
    finally:
        subprocess.run(["git", "worktree", "remove", "--force", str(tmp)], cwd=RACINE, capture_output=True)
        subprocess.run(["git", "worktree", "prune"], cwd=RACINE, capture_output=True)


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("choisir")
    al = sp.add_parser("alerte")
    al.add_argument("message")
    f = sp.add_parser("finaliser")
    f.add_argument("ident")
    f.add_argument("clip")
    f.add_argument("--sans-push", action="store_true")
    a = ap.parse_args()
    try:
        if a.cmd == "alerte":
            notifier("Circuit vidéo : action requise", a.message, tags="warning", clic=SITE)
            return 0
        if a.cmd == "choisir":
            return choisir()
        return finaliser(a.ident, a.clip, a.sans_push)
    except Exception as e:
        log(f"ÉCHEC : {type(e).__name__} {e}")
        h = historique()
        for x in h:
            if getattr(a, "ident", None) and x.get("ident") == a.ident:
                x["etat"] = "echec"
        sauver_historique(h)
        if a.cmd == "finaliser" and not getattr(a, "sans_push", False):
            notifier("Circuit vidéo : échec", f"{type(e).__name__} : {str(e)[:200]}", tags="warning", clic=SITE)
        return 1


if __name__ == "__main__":
    sys.exit(main())
