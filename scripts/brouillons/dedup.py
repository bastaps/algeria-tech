"""Anti-doublons du circuit d'articles (PC, repli cloud et publication).

Pourquoi : le PC et le repli cloud choisissaient leurs infos chacun de leur côté. Un brouillon déjà déposé sur GitHub (pas
encore publié) ou un article d'un autre média sur le MÊME fait n'était jamais vu : la comparaison se faisait seulement sur
l'adresse exacte de la source, et sur une liste qui ne contient même pas ce champ (articles-list.json n'a pas « source »).

Ici, un candidat est un doublon s'il :
  - a la même adresse source (normalisée) qu'un article publié, un brouillon ou un essai du PC ; ou
  - a un titre/extrait très proche d'un article récent (Jaccard) ; ou
  - partage plusieurs noms propres / chiffres avec un article récent ET un sujet proche (même fait, autre média).
Stdlib + requests. Utilisé par circuit_flow.py, circuit_cloud.py et publier_choix.py (dernier garde-fou avant publication).
"""
import datetime
import json
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse, parse_qsl, urlencode

try:
    import requests
except ImportError:  # publier_choix.py n'a besoin que du mode local (fichiers)
    requests = None

SITE = "https://algeria-tech.pages.dev"
DEPOT = "bastaps/algeria-tech"

SEUIL_TITRE = 0.34          # ressemblance titre + extrait → même fait
SEUIL_ENTITES = 3           # noms propres / chiffres communs…
SEUIL_ENTITES_JACCARD = 0.14  # …avec au moins ce degré de ressemblance générale

_MOTS_VIDES = set("""
de la le les des du un une et en au aux pour par sur dans avec qui que quoi dont ou où se sa son ses ce cet cette ces il elle ils
elles on nous vous leur leurs est sont été être a ont avait avoir plus moins très tout tous toute toutes mais donc car ni
entre vers chez sous après avant depuis lors alors aussi comme sans selon contre afin the of and to in for on at by with from
nouveau nouvelle nouveaux nouvelles lance lancement annonce annonces annoncé après pourrait sera seront peut peuvent
""".split())
# noms propres trop génériques pour prouver « même fait »
_ENTITES_COMMUNES = set("""
algerie algérie algerien algérien algerienne algérienne france monde internet numerique numérique cybersecurite cybersécurité
telecoms télécoms mobile ia intelligence artificielle octobre novembre decembre décembre septembre janvier février mars avril
mai juin juillet aout août lundi mardi mercredi jeudi vendredi samedi dimanche selon apres après avec dans pour
alger algeria alg algiers oran constantine annaba blida setif sétif ministere ministère telecommunications télécommunications
poste ministre president président gouvernement national nationale international internationale africa afrique europe chine
paris new york future summit forum salon programme edition édition journee journée
""".split())


def _sans_accents(t):
    return "".join(c for c in unicodedata.normalize("NFD", t or "") if unicodedata.category(c) != "Mn")


def jetons(texte):
    mots = re.findall(r"[a-z0-9]+", _sans_accents(texte).lower())
    return {m for m in mots if (len(m) >= 4 or m.isdigit()) and m not in _MOTS_VIDES}


def entites(texte):
    """Noms propres (mots capitalisés hors début de phrase) et nombres significatifs, sans accents ni casse."""
    t = re.sub(r"\s+", " ", texte or "")
    out = set()
    for m in re.finditer(r"(?<![.!?«\"]\s)(?<!^)\b([A-ZÀ-ÝŒ][\w'’-]{2,})\b", t):
        e = _sans_accents(m.group(1)).lower().strip("'’-")
        if e and e not in _ENTITES_COMMUNES and e not in _MOTS_VIDES:
            out.add(e)
    for m in re.finditer(r"\b\d{3,}(?:[.,]\d+)?\b|\b\d{1,2}[.,]\d+\b", t):
        if not re.fullmatch(r"(19|20)\d\d", m.group(0)):   # une année ne prouve rien
            out.add(m.group(0))
    for m in re.finditer(r"\b[A-Z]{2,6}\b", t):
        e = m.group(0).lower()
        if e not in _ENTITES_COMMUNES:
            out.add(e)
    return out


def norm_url(u):
    """Adresse comparable : sans schéma, sans www, sans suivi (utm…), sans « / » final ni ancre."""
    if not u:
        return ""
    try:
        p = urlparse(u.strip())
    except ValueError:
        return ""
    if not p.netloc:
        return ""
    q = [(k, v) for k, v in parse_qsl(p.query) if not k.lower().startswith(("utm_", "fbclid", "gclid", "ref"))]
    return (p.netloc.lower().removeprefix("www.") + p.path.rstrip("/") + (("?" + urlencode(q)) if q else "")).lower()


def _racines(texte):
    """Jetons réduits à 5 lettres : « étudiants/étudiant », « algériens/algérien », « projette/projet » se rejoignent."""
    return {j if j.isdigit() else j[:5] for j in jetons(texte)}


def ressemblance(a, b):
    ja, jb = _racines(a), _racines(b)
    return len(ja & jb) / len(ja | jb) if ja and jb else 0.0


# ── Lecture d'un article / brouillon .md ─────────────────────────────────────
def lire_md(texte, ident=""):
    fm = texte.split("---")[1] if texte.count("---") >= 2 else texte[:2000]

    def g(k):
        m = re.search(rf"^{k}:[ \t]*(.*)$", fm, re.M)
        return m.group(1).strip().strip('"') if m else ""
    return {"id": ident, "titre": g("titre"), "extrait": g("extrait"), "url": norm_url(g("source")),
            "date": g("date"), "type": g("type"), "origine": ""}


def contexte_local(racine, jours=7, brouillons=True):
    """Articles publiés récents + brouillons d'un dépôt déjà extrait (cloud, publication, PC sur clone)."""
    racine = Path(racine)
    limite = (datetime.datetime.utcnow() - datetime.timedelta(days=jours)).strftime("%Y-%m-%d")
    out = []
    for dossier, origine in (("articles", "publié"), ("brouillons", "brouillon")):
        if dossier == "brouillons" and not brouillons:
            continue
        d = racine / dossier
        if not d.is_dir():
            continue
        fichiers = sorted(d.glob("*.md"))[-250:] if dossier == "articles" else sorted(d.glob("*.md"))
        for f in fichiers:
            try:
                x = lire_md(f.read_text(encoding="utf-8"), f.stem)
            except OSError:
                continue
            if x["titre"] and (origine == "brouillon" or (x["date"] or "9") >= limite):
                x["origine"] = origine
                out.append(x)
    return out


def _http(url, **kw):
    return requests.get(url, timeout=25, headers={"User-Agent": "Mozilla/5.0 AlgeriaTech-circuit"}, **kw)


def contexte_distant(jours=7):
    """Même contexte, lu sur GitHub/pages.dev (le PC peut avoir un dépôt local en retard) : publiés récents (titre, extrait,
    adresse source lue dans l'en-tête du .md) + brouillons en attente."""
    out = []
    limite = (datetime.datetime.utcnow() - datetime.timedelta(days=jours)).strftime("%Y-%m-%d")
    try:
        recents = [a for a in _http(f"{SITE}/articles-list.json").json() if (a.get("date") or "") >= limite]
    except Exception:
        recents = []
    for a in recents:
        out.append({"id": a.get("id"), "titre": a.get("titre") or "", "extrait": a.get("extrait") or "", "url": "",
                    "date": a.get("date") or "", "type": a.get("type") or "", "origine": "publié"})

    def source_de(x):
        try:
            t = _http(f"https://raw.githubusercontent.com/{DEPOT}/main/articles/{x['id']}.md").text[:2500]
            x["url"] = lire_md(t, x["id"])["url"]
        except Exception:
            pass
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(source_de, out[:60]))
    try:
        for f in _http(f"https://api.github.com/repos/{DEPOT}/contents/brouillons").json():
            if isinstance(f, dict) and f.get("name", "").endswith(".md"):
                t = _http(f["download_url"]).text
                x = lire_md(t, f["name"][:-3])
                x["origine"] = "brouillon"
                out.append(x)
    except Exception:
        pass
    return out


def contexte_pc(historique):
    """Entrées de l'historique du PC (essais, brouillons du jour) : même un échec ne doit pas être refait à l'identique."""
    return [{"id": h.get("ident"), "titre": h.get("titre") or "", "extrait": "", "url": norm_url(h.get("url")),
             "date": h.get("jour") or "", "type": "", "origine": "historique PC"} for h in historique or []]


def contexte(racine=None, historique=None, jours=7, brouillons_locaux=False):
    """brouillons_locaux=False sur le PC : son dossier brouillons/ est un reste périmé (la vérité est sur GitHub) ;
    True dans le dépôt tout juste extrait du cloud (Actions)."""
    ctx = contexte_local(racine, jours, brouillons_locaux) if racine and (Path(racine) / "articles").is_dir() else []
    if requests is not None:
        ctx += contexte_distant(jours)
    ctx += contexte_pc(historique)
    return ctx


# ── Verdict ──────────────────────────────────────────────────────────────────
# Seuils calés sur les doublons réels d'octobre 2026 (Huawei 0,36 ; Tirsam 0,32 ; Anthropic 0,29-0,66 ; Orange 0,25 ; Roblox 0,31)
# et sur les faux positifs à éviter (deux sujets Huawei/Djezzy distincts : 0,19-0,24 avec un seul nom propre commun).
def _verdict(r, nb_ent):
    """'oui' | 'peut-etre' | 'non'."""
    if r >= 0.45 or (r >= 0.28 and nb_ent >= 1) or (r >= 0.22 and nb_ent >= 2):
        return "oui"
    if r >= 0.18 and nb_ent >= 1:
        return "peut-etre"
    return "non"


def trouver_doublon(titre, url="", extrait="", ctx=(), ignorer_id=None, arbitre=None):
    """(True, raison, élément) si le candidat double un élément du contexte, sinon (False, '', None).
    arbitre(titre_a, extrait_a, titre_b, extrait_b) -> True/False/None : avis de l'IA pour les cas limites (facultatif)."""
    u = norm_url(url)
    texte = f"{titre} {extrait}"
    ent = entites(f"{titre}. {extrait}")
    limites = []
    for x in ctx:
        if ignorer_id and str(x.get("id")) == str(ignorer_id):
            continue
        if x.get("type") == "communique_officiel" and x.get("origine") == "publié":
            continue  # le communiqué est la source : sa version rédigée n'est pas un doublon
        if u and x.get("url") and u == x["url"]:
            return True, f"même adresse source que {x['origine']} « {x['titre'][:60]} »", x
        r = ressemblance(texte, f"{x.get('titre', '')} {x.get('extrait', '')}")
        commun = ent & entites(f"{x.get('titre', '')}. {x.get('extrait', '')}")
        v = _verdict(r, len(commun))
        if v == "oui":
            return True, f"même fait ({r:.2f}{', ' + ', '.join(sorted(commun)[:3]) if commun else ''}) que {x['origine']} « {x['titre'][:60]} »", x
        if v == "peut-etre":
            limites.append((r, x))
    if arbitre and limites:
        for r, x in sorted(limites, key=lambda t: -t[0])[:2]:
            try:
                if arbitre(titre, extrait, x.get("titre", ""), x.get("extrait", "")):
                    return True, f"même fait (avis IA, {r:.2f}) que {x['origine']} « {x['titre'][:60]} »", x
            except Exception:  # noqa: BLE001 — l'avis est facultatif
                break
    return False, "", None


# ── Fraîcheur ────────────────────────────────────────────────────────────────
# Les communiqués officiels listés sur un site ne sont pas toujours classés par date : le circuit avait repris des communiqués du
# 29 août et du 13 octobre comme s'ils étaient du jour. Une source dont TOUTES les dates citées en tête sont anciennes est écartée.
_MOIS = {"janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6, "juillet": 7, "aout": 8, "septembre": 9,
         "octobre": 10, "novembre": 11, "decembre": 12}


def dates_dans(texte):
    """Dates complètes (« 29 août 2026 », « 2026-10-13 », « 13/10/2026 ») trouvées dans le texte."""
    t = _sans_accents(texte or "").lower()
    out = []
    for j, m, a in re.findall(r"\b(\d{1,2})(?:er)?\s+(" + "|".join(_MOIS) + r")\s+(20\d\d)\b", t):
        out.append((int(a), _MOIS[m], int(j)))
    for a, m, j in re.findall(r"\b(20\d\d)-(\d{2})-(\d{2})\b", t):
        out.append((int(a), int(m), int(j)))
    for j, m, a in re.findall(r"\b(\d{1,2})/(\d{1,2})/(20\d\d)\b", t):
        out.append((int(a), int(m), int(j)))
    ok = []
    for a, m, j in out:
        try:
            ok.append(datetime.date(a, m, j))
        except ValueError:
            pass
    return ok


def aujourd_hui():
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=1)).date()   # heure d'Alger


def perime(texte, jours=5, zone=900):
    """True si le début du texte ne cite que des dates plus anciennes que `jours` jours (aucune date : on ne conclut pas)."""
    ds = dates_dans((texte or "")[:zone])
    return bool(ds) and max(ds) < aujourd_hui() - datetime.timedelta(days=jours)
