"""Circuit « article vidéo » : choix de l'info → rédaction IA → vidéo Google Flow → carte interactive
→ brouillon + notification ntfy avec boutons (Une / 2e position / Brève).

Tourne sur le PC (Hub Smart Ingest :3000 + Article Interactif :5000, lancés au besoin).
L'étape Google Flow n'a pas d'API : elle est pilotée dans Chrome (voir RUNBOOK_FLOW.md).

    python circuit_flow.py choisir --slot matin|midi|soir
    python circuit_flow.py finaliser <ident> <clip.mp4|none> [--sans-push]
    python circuit_flow.py alerte "<message>"

Créneaux : matin = revue de presse ; midi et soir = flux RSS + réseaux sociaux (repli : revue de presse).
Codes de sortie : 0 ok · 2 rien de neuf · 3 créneau déjà fait aujourd'hui · 1 erreur.
Le choix des boutons ntfy est lu par le workflow GitHub « brouillons-publier » (publier_choix.py) ;
sans choix au bout de DELAI_DEFAUT_MIN minutes, l'article part en 2e position.
"""
import argparse
import datetime
import io
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import time
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import redaction as R  # noqa: E402  (format éditorial commun : À retenir, tableau, sources officielles, vidéo pertinente)
RACINE = Path(__file__).resolve().parents[2]
WORK = Path(os.environ.get("CIRCUIT_FLOW_DIR", r"E:\MonStudioIA\circuit-flow"))
HISTORIQUE = WORK / "historique.json"
HUB, AI = "http://localhost:3000", "http://localhost:5000"
SITE = "https://algeria-tech.pages.dev"
NTFY_FICHIER = Path(r"E:\01-flash-infos\flash_auto\ntfy_canal.txt")
CATEGORIES = ["Algérie", "Télécoms", "Mobile", "Startups", "IA", "Fintech", "Innovation", "Monde", "Entreprises"]
SLOTS = ("matin", "midi", "soir")
DELAI_DEFAUT_MIN = 0

# Liste de suivi (marques, opérateurs, institutions, événements TIC) : bonus de score
SUIVI = re.compile(r"huawei|ericsson|samsung|\blg\b|nokia|zte|ooredoo|mobilis|djezzy|alg[ée]rie t[ée]l[ée]com|"
                   r"alg[ée]rie poste|ministre de la poste|mptn|arpce|ministère de la poste|"
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
    HISTORIQUE.write_text(json.dumps(h[-300:], ensure_ascii=False, indent=1), encoding="utf-8")


def maintenant_alger():
    return datetime.datetime.utcnow() + datetime.timedelta(hours=1)


def aujourd_hui():
    return maintenant_alger().strftime("%Y-%m-%d")


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


def candidats_revue():
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
    out.sort(key=lambda c: -c["score"])
    return out


def candidats_flux():
    """Flux RSS (collecte de l'express, filtre éditorial sans IA, Algérie d'abord) + veille réseaux sociaux."""
    out = []
    try:
        sys.path.insert(0, str(RACINE / "scripts" / "express"))
        from filtre_editorial import trier
        from sources import collecter
        arts = collecter(max_age_h=20, journal=lambda m: None)
        gardes, _ = trier(arts, utiliser_gemini=False, historique=[])
        for i, a in enumerate(gardes[:25]):
            pays = (a.get("filtre") or {}).get("pays", "")
            out.append({"score": 80 - i + (10 if pays == "DZ" else 0), "titre": a.get("title", ""), "url": a.get("url"),
                        "source": a.get("source", ""), "pays": pays, "origine": "rss"})
    except Exception as e:
        log(f"flux RSS indisponibles ({type(e).__name__}) : {e}")
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
        brut = p.get("text", "")
        if isinstance(brut, str) and brut.lstrip().startswith("{"):
            try:
                import ast
                brut = ast.literal_eval(brut)
            except (ValueError, SyntaxError):
                pass
        if isinstance(brut, dict):
            brut = brut.get("fr") or brut.get("en") or brut.get("ar") or ""
        txt = re.sub(r"\s+", " ", str(brut))[:200]
        if len(txt) < 20:
            continue
        out.append({"score": 70 + 25 * bool(SUIVI.search(txt)), "titre": txt, "url": p["url"],
                    "source": p.get("source_short", ""), "pays": "DZ", "origine": "social"})
    out.sort(key=lambda c: -c["score"])
    return out


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


def weserv(url_image):
    sans = re.sub(r"^https?://", "", url_image)
    return ("https://images.weserv.nl/?url=" + requests.utils.quote(sans, safe="/:") +
            "&w=1672&h=941&fit=cover&a=attention&output=jpg&q=90")


def choisir(slot):
    h = historique()
    def fait(x):
        """Créneau réellement produit (ou en cours depuis moins de 3 h). Les essais à blanc et échecs ne comptent pas."""
        if x.get("jour") != aujourd_hui() or x.get("slot") != slot:
            return False
        if x.get("etat") == "brouillon":
            return True
        try:
            return x.get("etat") == "prepare" and time.time() * 1000 - int(x.get("ident", 0)) < 3 * 3600 * 1000
        except ValueError:
            return False
    if not os.environ.get("CIRCUIT_FORCE") and any(fait(x) for x in h):
        log(f"créneau « {slot} » déjà fait aujourd'hui")
        return 3
    try:  # le repli cloud a-t-il déjà produit ce créneau ?
        reg = requests.get(f"{SITE}/data/circuit-slots.json", timeout=15).json()
        if reg.get(aujourd_hui(), {}).get(slot) and not os.environ.get("CIRCUIT_FORCE"):
            log(f"créneau « {slot} » déjà produit aujourd'hui ({reg[aujourd_hui()][slot]})")
            return 3
    except Exception:
        pass
    serveurs()
    vus = deja_vus()
    listes = (candidats_revue, candidats_flux) if slot == "matin" else (candidats_flux, candidats_revue)
    for fabrique in listes:
        for c in fabrique()[:14]:
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
            # politique vidéo : jamais d'animation de personnes réelles ; vidéo du média reprise telle quelle ; sinon
            # vidéo « concept » (texte → vidéo, sans personne) seulement pour un visuel générique (voir redaction.py)
            try:
                html_page = requests.get(c["url"], timeout=25, headers=R.UA).text
            except requests.RequestException:
                html_page = ""
            pol = R.politique_video(jpg, f.get("title") or c["titre"], texte[:500], html_page)
            video_ok, raison_video = pol["mode"] == "concept", pol["raison"]
            log(f"  vidéo « {pol['mode']} » : {raison_video}")
            job = {"ident": ident, "slot": slot, "article": {k: c[k] for k in ("titre", "url", "source", "pays", "origine", "score")},
                   "titre_page": f.get("title", ""), "texte": texte, "image_source": image,
                   "image_weserv": weserv(image), "prompt_flow": pol["prompt"],
                   "video_mode": pol["mode"], "video_url": pol["video_url"],
                   "video_pertinente": video_ok, "raison_video": raison_video,
                   "dossier": str(dossier), "clip_attendu": str(dossier / "clip.mp4")}
            (dossier / "job.json").write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")
            h.append({"jour": aujourd_hui(), "slot": slot, "ident": ident, "url": c["url"], "titre": c["titre"], "etat": "prepare"})
            sauver_historique(h)
            log(f"choisi [{slot}, {c['origine']}, score {c['score']}] : {c['titre'][:90]}")
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


def notifier(titre, message, tags="newspaper", clic=f"{SITE}/", actions=None, priorite=None):
    canal = ntfy_canal()
    if not canal:
        log("ntfy : canal introuvable")
        return
    entetes = {"Title": titre.encode("utf-8"), "Tags": tags, "Click": clic}
    if actions:
        entetes["Actions"] = actions.encode("utf-8")
    if priorite:
        entetes["Priority"] = str(priorite)
    try:
        requests.post(f"https://ntfy.sh/{canal}", data=message.encode("utf-8"), timeout=20, headers=entetes)
    except requests.RequestException as e:
        log(f"ntfy : {e}")


def actions_choix(ident, canal_choix):
    """Boutons ntfy : chaque bouton poste « <ident>:<choix> » sur le canal de réponse du brouillon."""
    def b(libelle, choix):
        return f"http, {libelle}, https://ntfy.sh/{canal_choix}, method=POST, body={ident}:{choix}, clear=true"
    return "; ".join([b("À la Une", "une"), b("2e position", "seconde"), b("Brève", "breve")])


def q(v):
    return str(v or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip()


def points_essentiels(g):
    """« À retenir » (en-tête `aretenir`, points séparés par « | ») : les puces de la section « ## À retenir » de l'article ;
    à défaut, 3 phrases tirées de l'article rédigé (aucune invention)."""
    m = re.search(r"^#{1,3}\s*À retenir\s*$([\s\S]*?)(?=^#{1,3}\s|\Z)", g.get("contenu", ""), re.M | re.I)
    if m:
        puces = [re.sub(r"^[-*•]\s*", "", l).strip() for l in m.group(1).splitlines() if re.match(r"\s*[-*•]\s+\S", l)]
        if len(puces) >= 3:
            return R.champ_aretenir(puces[:5])
    phrases = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", f"{g['lead']} {g['contenu']}"))
    return R.champ_aretenir([p.strip() for p in phrases if 60 <= len(p) <= 230][:3])


def finaliser(ident, clip, sans_push):
    dossier = WORK / ident
    job = lire(dossier / "job.json", None)
    if not job:
        raise RuntimeError(f"job introuvable : {dossier}")
    avec_video = bool(clip) and clip.lower() != "none"
    if avec_video and job.get("video_mode", "aucune") != "concept":
        log(f"clip ignoré : politique vidéo « {job.get('video_mode', 'aucune')} » ({job.get('raison_video', '')})")
        avec_video = False
    if avec_video:
        clip = Path(clip)
        sonde = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type:format=duration",
                                "-of", "json", str(clip)], capture_output=True, text=True)
        info = json.loads(sonde.stdout or "{}")
        if not any(s.get("codec_type") == "video" for s in info.get("streams", [])) or float(info.get("format", {}).get("duration", 0)) < 3:
            raise RuntimeError("clip Flow invalide (pas de vidéo ou trop court)")
    serveurs()
    # rédaction : moteur de Smart Ingest PRO, mode IA, style PRO étoffé
    # sourcing : site officiel de l'entité concernée (page réellement lue et vérifiée) avant le média relais
    officiels = R.sources_officielles(job["titre_page"] or job["article"]["titre"], job["texte"], job["article"]["url"])
    bloc_officiel = "".join(f"\n\nSOURCE OFFICIELLE — {o['nom']} ({o['url']}) :\n{o['extrait']}" for o in officiels)
    corps_source = (f"{job['titre_page']}\n\n{job['texte']}{bloc_officiel}"
                    f"\n\nSource : {job['article']['source']} — {job['article']['url']}")
    g = requests.post(f"{HUB}/api/smart-generate", json={"text": corps_source[:9000], "style": "pro",
                                                          "source_url": job["article"]["url"]}, timeout=240).json()
    # mode IA uniquement : sans rédaction IA exploitable, le brouillon n'est PAS produit (jamais de repli heuristique)
    if not (g.get("titre") and g.get("lead") and len(str(g.get("contenu", "")).split()) >= 150):
        raise RuntimeError("rédaction IA insuffisante")
    g["contenu"] = str(g["contenu"]).strip() + "\n\n## Sources\n\n" + "\n".join(
        [f"- Source officielle : [{o['nom']}]({o['url']})" for o in officiels] +
        [f"- {'Article relayé par' if officiels else 'Source'} : [{job['article']['source']}]({job['article']['url']})"]) + "\n"
    cat = g.get("categorie") if g.get("categorie") in CATEGORIES else ("Algérie" if job["article"]["pays"] == "DZ" else "Monde")
    # vidéo : clip « concept » local, ou vidéo YouTube du média qui accompagne l'article (reprise telle quelle)
    video_url = (f"/videos/articles/{ident}.mp4" if avec_video
                 else (job.get("video_url", "") if job.get("video_mode") == "source" else ""))
    image_rel = f"images/{ident}.jpg"
    # carte interactive : Article Interactif, mode IA
    corps = f"# {g['titre']}\n\n{g['lead']}\n\n{g['contenu']}"
    medias = {"video": {"url": video_url, "caption": g["titre"][:120]}} if video_url else {}
    gen = requests.post(f"{AI}/api/generate", timeout=300, json={
        "text": corps, "mode": "real", "primary_color": "#0d3b24", "accent_color": "#d21034", "dark_mode": False,
        "source_url": job["article"]["url"], "gallery": [], "widgets": {}, "medias": medias}).json()
    if gen.get("error"):
        raise RuntimeError("carte interactive : " + str(gen["error"]))
    rendu = requests.post(f"{AI}/api/render", json=gen, timeout=120).json()
    if rendu.get("error") or len(rendu.get("html", "")) < 5000:
        raise RuntimeError("rendu de la carte interactive en échec")
    # fichiers du brouillon
    sortie = dossier / "out"
    for sous in ("brouillons", "videos/articles", "images", "interactifs"):
        (sortie / sous).mkdir(parents=True, exist_ok=True)
    if avec_video:
        shutil.copy(clip, sortie / "videos" / "articles" / f"{ident}.mp4")
    shutil.copy(dossier / "image.jpg", sortie / "images" / f"{ident}.jpg")
    (sortie / "interactifs" / f"{ident}.html").write_text(rendu["html"], encoding="utf-8")
    now = maintenant_alger()
    canal_choix = "atchoix-" + secrets.token_hex(8)
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
mediaPriority: {"video" if video_url else "image"}
brouillon: true
circuit: true
cree: "{datetime.datetime.utcnow():%Y-%m-%dT%H:%M:%SZ}"
choix_canal: "{canal_choix}"
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
    deposer(ident, sortie, g["titre"], avec_video, job.get("slot"))
    notifier(f"À placer : {g['titre'][:60]}",
             f"{g['lead'][:230]}\n\nPublication automatique en 2e position (sauf choix de place ci-dessous). Vous pouvez modifier ou supprimer ensuite."
             f"\n{'Vidéo Flow + ' if avec_video else ''}version interactive prête.",
             clic=f"{SITE}/interactifs/{ident}.html", actions=actions_choix(ident, canal_choix))
    notifier("Corriger ou rejeter ce brouillon ?", f"« {g['titre'][:80]} » — Corriger ouvre l'éditeur en ligne (connexion admin) ; "
             "Rejeter supprime le brouillon avant publication.",
             tags="pencil2", priorite=1, clic=f"{SITE}/",
             actions=f"view, Corriger, {SITE}/smart-ingest-pro.html?edit={ident}&draft=1; "
                     f"http, Rejeter, https://ntfy.sh/{canal_choix}, method=POST, body={ident}:rejeter, clear=true")
    return 0


def completer_carte(racine_clone, md_path):
    """Ajoute la carte interactive à un article produit par le repli cloud (champ `interactif_a_faire`).
    À lancer sur le PC (Article Interactif :5000). Écrit interactifs/<id>.html et met l'en-tête à jour.
    Retourne True si la carte a été créée."""
    md = md_path.read_text(encoding="utf-8")
    m = re.match(r"---\n([\s\S]*?)\n---\n([\s\S]*)$", md.replace("\r\n", "\n"))
    if not m:
        return False
    entete, corps = m.group(1), m.group(2).strip()
    get = lambda k: (re.search(rf"^{k}:[ \t]*(.*)$", entete, re.M) or [None, ""])[1].strip().strip('"')  # noqa: E731
    ident = md_path.stem
    serveurs()
    texte = f"# {get('titre')}\n\n{get('extrait')}\n\n{corps}"
    gen = requests.post(f"{AI}/api/generate", timeout=300, json={
        "text": texte, "mode": "real", "primary_color": "#0d3b24", "accent_color": "#d21034", "dark_mode": False,
        "source_url": get("source"), "gallery": [], "widgets": {}, "medias": {}}).json()
    if gen.get("error"):
        log(f"carte interactive impossible ({ident}) : {gen['error']}")
        return False
    rendu = requests.post(f"{AI}/api/render", json=gen, timeout=120).json()
    if rendu.get("error") or len(rendu.get("html", "")) < 5000:
        log(f"rendu de la carte impossible ({ident})")
        return False
    sortie = racine_clone / "interactifs"
    sortie.mkdir(exist_ok=True)
    (sortie / f"{ident}.html").write_text(rendu["html"], encoding="utf-8")
    entete = re.sub(r"^interactif:.*$", f'interactif: "/interactifs/{ident}.html"', entete, flags=re.M)
    entete = re.sub(r"^interactif_a_faire:.*\n?", "", entete, flags=re.M).rstrip("\n")
    md_path.write_text(f"---\n{entete}\n---\n\n{corps}\n", encoding="utf-8")
    log(f"carte interactive ajoutée : {ident}")
    return True


def git(*a, cwd):
    r = subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError(f"git {' '.join(a[:2])} : {(r.stderr or r.stdout).strip()[:300]}")
    return r.stdout


def maj_registre(tmp, slot):
    """data/circuit-slots.json : le cloud ne refait pas un créneau déjà produit par le PC."""
    if not slot:
        return
    chemin = tmp / "data" / "circuit-slots.json"
    r = lire(chemin, {})
    r.setdefault(aujourd_hui(), {})[slot] = "pc"
    for j in sorted(r)[:-10]:
        del r[j]
    chemin.parent.mkdir(exist_ok=True)
    chemin.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    git("add", "data/circuit-slots.json", cwd=tmp)


def deposer(ident, sortie, titre, avec_video, slot=None):
    """Dépôt via un dossier temporaire cloné depuis origin/main (le dépôt local a du retard)."""
    tmp = Path(r"E:\algeria-tech-push-circuit")
    git("fetch", "-q", "origin", cwd=RACINE)
    if tmp.exists():
        subprocess.run(["git", "worktree", "remove", "--force", str(tmp)], cwd=RACINE, capture_output=True)
    git("worktree", "add", "-q", "--detach", str(tmp), "origin/main", cwd=RACINE)
    try:
        fichiers = [f"brouillons/{ident}.md", f"images/{ident}.jpg", f"interactifs/{ident}.html"]
        if avec_video:
            fichiers.append(f"videos/articles/{ident}.mp4")
        for rel in fichiers:
            cible = tmp / rel
            cible.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(sortie / rel, cible)
            git("add", "-f", rel, cwd=tmp)
        maj_registre(tmp, slot)
        git("-c", "user.name=circuit-flow", "-c", "user.email=circuit-flow@local", "commit", "-q", "-m",
            f"Auto: brouillon à placer — {titre[:70]}", cwd=tmp)
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
    c = sp.add_parser("choisir")
    c.add_argument("--slot", choices=SLOTS, default="matin")
    al = sp.add_parser("alerte")
    al.add_argument("message")
    f = sp.add_parser("finaliser")
    f.add_argument("ident")
    f.add_argument("clip", help="chemin du clip mp4, ou « none » (brouillon sans vidéo)")
    f.add_argument("--sans-push", action="store_true")
    a = ap.parse_args()
    try:
        if a.cmd == "alerte":
            notifier("Circuit vidéo : action requise", a.message, tags="warning", clic=SITE)
            return 0
        if a.cmd == "choisir":
            return choisir(a.slot)
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
