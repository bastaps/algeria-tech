# -*- coding: utf-8 -*-
"""
Enrichissement des articles interactifs.

Ce module ajoute aux données produites (préréglage, heuristique ou IA)
les blocs interactifs optionnels du gabarit :
chiffres-clés à jauge, graphique, frise chronologique, comparateur,
mini-carte des wilayas, sondage, badge de fraîcheur et « À lire aussi ».

Chaque bloc n'est ajouté que si la donnée existe réellement dans le texte :
aucun widget n'est inventé quand la matière manque.
"""
import json
import os
import re
import unicodedata
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT = os.environ.get("ALGERIA_TECH_ROOT", os.path.dirname(BASE_DIR))
SITE_URL = os.environ.get("SITE_URL", "https://algeria-tech.pages.dev")

MONTHS = {
    "janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4, "mai": 5,
    "juin": 6, "juillet": 7, "aout": 8, "août": 8, "septembre": 9,
    "octobre": 10, "novembre": 11, "decembre": 12, "décembre": 12,
}

# Correspondance entre les noms du fichier GeoJSON et l'usage courant en français
WILAYA_ALIASES = {
    "Algiers": ["Alger", "Alger-Centre", "la capitale"],
    "Béjaïa": ["Bejaia", "Bougie"],
    "Sétif": ["Setif"],
    "Constantine": ["Constantine"],
    "Tizi Ouzou": ["Tizi-Ouzou"],
    "Ouargla": ["Ouargla", "Hassi Messaoud"],
    "Béchar": ["Bechar"],
    "Tamanrasset": ["Tamanrasset", "Tamanghasset"],
    "Sidi Bel Abbès": ["Sidi Bel Abbes"],
    "Aïn Témouchent": ["Ain Temouchent"],
    "Aïn Defla": ["Ain Defla"],
    "Laghouat": ["Laghouat", "Hassi R'mel", "Hassi Rmel"],
    "Boumerdès": ["Boumerdes"],
    "Médéa": ["Medea"],
    "M'Sila": ["M'Sila", "Msila"],
    "Naâma": ["Naama"],
    "Saïda": ["Saida"],
    "Tébessa": ["Tebessa"],
    "El M'Ghair": ["El M'Ghair", "El Meghaier"],
    "Ghardaia": ["Ghardaïa", "Ghardaia"],
}

DISPLAY_NAMES = {"Algiers": "Alger"}

_WILAYAS_CACHE = None
_ARTICLES_CACHE = {"mtime": 0, "items": []}


# ---------------------------------------------------------------- utilitaires
def strip_tags(text):
    return re.sub(r"<[^>]+>", " ", text or "")


def deaccent(text):
    return "".join(
        c for c in unicodedata.normalize("NFD", text or "")
        if unicodedata.category(c) != "Mn"
    ).lower()


def to_number(raw):
    """Convertit « 1 250,5 » ou « 1.250,5 » en float. None si impossible."""
    if raw is None:
        return None
    s = str(raw).strip()
    s = re.sub(r"[^\d,.\-]", "", s.replace(" ", "").replace(" ", "").replace(" ", ""))
    if not s or s in {"-", ".", ","}:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


# ------------------------------------------------------- carte des wilayas
def load_wilayas():
    global _WILAYAS_CACHE
    if _WILAYAS_CACHE is not None:
        return _WILAYAS_CACHE
    path = os.path.join(BASE_DIR, "data", "algeria_wilayas.json")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            _WILAYAS_CACHE = json.load(fh)
    except Exception:
        _WILAYAS_CACHE = {"viewBox": "0 0 1000 700", "wilayas": []}
    return _WILAYAS_CACHE


def detect_wilaya(text):
    """Repère la wilaya la plus citée dans le texte. Renvoie None si aucune."""
    data = load_wilayas()
    if not data["wilayas"]:
        return None
    flat = deaccent(strip_tags(text))
    best, best_score = None, 0
    for w in data["wilayas"]:
        names = [w["name"]] + WILAYA_ALIASES.get(w["name"], [])
        score = 0
        for n in names:
            needle = deaccent(n)
            if len(needle) < 4:
                continue
            score += len(re.findall(r"\b" + re.escape(needle) + r"\b", flat))
        if score > best_score:
            best, best_score = w, score
    return best if best_score else None


def build_map_svg(wilaya_name):
    """Génère le SVG de la carte d'Algérie avec la wilaya mise en avant."""
    data = load_wilayas()
    if not data["wilayas"] or not wilaya_name:
        return ""
    target = deaccent(wilaya_name)
    hit = None
    for w in data["wilayas"]:
        candidates = [w["name"]] + WILAYA_ALIASES.get(w["name"], []) + [DISPLAY_NAMES.get(w["name"], "")]
        if any(target == deaccent(c) for c in candidates if c):
            hit = w
            break
    parts = [
        '<svg viewBox="{vb}" role="img" aria-label="Carte de l\'Algérie – {n}" '
        'xmlns="http://www.w3.org/2000/svg">'.format(
            vb=data["viewBox"], n=(DISPLAY_NAMES.get(wilaya_name, wilaya_name))
        )
    ]
    for w in data["wilayas"]:
        cls = "wil hl" if hit and w["code"] == hit["code"] and w["name"] == hit["name"] else "wil"
        label = DISPLAY_NAMES.get(w["name"], w["name"]).replace('"', "&quot;")
        parts.append('<path class="{c}" d="{d}" data-name="{n}"/>'.format(c=cls, d=w["d"], n=label))
    if hit:
        parts.append(
            '<circle class="pin-halo" cx="{x}" cy="{y}" r="9"/>'
            '<circle class="pin" cx="{x}" cy="{y}" r="5"/>'.format(x=hit["cx"], y=hit["cy"])
        )
    parts.append("</svg>")
    return "".join(parts)


# ------------------------------------------------------------ chiffres clés
FIGURE_VERBS = {
    'atteindra', 'atteint', 'atteindre', 'sera', 'seront', 'est', 'sont', 'represente',
    'représente', 'depassera', 'dépassera', 'depasse', 'dépasse', 'installera', 'prevoit',
    'prévoit', 'vise', 'compte', 'mobilise', 'mobilisé', 'totalise', 'affiche', 'enregistre',
    'evitera', 'évitera', 'permettra', 'financera', 'rassemble', 'reunit', 'réunit',
    'accueille', 'signe', 'signé', 'annonce', 'lance', 'produit', 'exporte', 'soit', 'avait',
}
FIGURE_ARTICLES = {
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'a', 'à', 'ce', 'cette', 'ces',
    'son', 'sa', 'ses', 'leur', 'leurs', 'plus', 'moins', 'environ', 'pres', 'près', 'au',
    'aux', 'en', 'par', 'pour', 'avec', 'dans', 'sur', 'que', 'qui', "d'", 'notre', 'nos',
    'contre', 'soit', 'dont', 'ou',
}


def _tidy_words(words, from_end=True, max_words=4):
    """Nettoie un groupe de mots pour en faire un libellé lisible.

    `from_end` : garder la fin du groupe (ce qui précède un chiffre)
    ou son début (le complément qui le suit).
    """
    junk = FIGURE_VERBS | FIGURE_ARTICLES

    def trim(seq):
        seq = list(seq)
        while seq and seq[-1].lower().strip("’'") in junk:
            seq.pop()
        while seq and seq[0].lower().strip("’'") in junk:
            seq.pop(0)
        return seq

    words = trim(words)
    words = words[-max_words:] if from_end else words[:max_words]
    words = trim(words)
    label = " ".join(words).strip(" ,;:.'’-")
    return label if len(label) >= 4 else None


def _cut_label(label):
    """Coupe un libellé sur un mot entier plutôt qu'au milieu."""
    if not label:
        return None
    label = label.strip()
    if len(label) <= 38:
        return label.capitalize()
    cut = label[:38].rsplit(" ", 1)[0].strip(" ,;:.-")
    return (cut or label[:38]).capitalize()


def label_before(text, pos):
    """Groupe nominal qui précède un chiffre : « un parc solaire de 150 MW »."""
    segment = re.split(r"[,.;:!?]", text[max(0, pos - 80): pos])[-1]
    label = _tidy_words(re.findall(r"[A-Za-zÀ-ÿ'’-]+", segment))
    return _cut_label(label)


def label_after(text, pos_end, strict=False):
    """Complément qui suit un chiffre : « 200 000 tonnes DE gaz à effet de serre ».

    En mode strict, seul un vrai complément introduit par « de / du / des »
    est accepté : sinon on renverrait le début de la proposition suivante.
    """
    segment = text[pos_end: pos_end + 80]
    m = re.match(r"\s*(?:de[s]?|d[’']|du)\s+(.{4,60})", segment, re.I)
    if strict and not m:
        return None
    body = m.group(1) if m else segment
    label = _tidy_words(re.findall(r"[A-Za-zÀ-ÿ'’-]+", re.split(r"[,.;:!?]", body)[0]),
                        from_end=False, max_words=5)
    return _cut_label(label)


def label_for_figure(text, value):
    """Déduit un libellé lisible à partir des mots qui entourent le chiffre."""
    pos = text.find(value)
    if pos < 0:
        return None
    end = pos + len(value)
    # Le complément immédiat d'une unité est le meilleur libellé.
    if re.match(r"\s*(?:de[s]?|d[’']|du)\s", text[end: end + 6], re.I):
        label = label_after(text, end)
        if label:
            return label
    return label_before(text, pos) or label_after(text, end)


FIGURE_ICONS = [
    (r"%", "fas fa-percent"),
    (r"(usd|dollar|euro|\bda\b|dinar|milliard|million)", "fas fa-sack-dollar"),
    (r"(mw|mwp|gw|kwh|energie|énergie|solaire)", "fas fa-bolt"),
    (r"(tonne|co2|gaz|emission|émission)", "fas fa-smog"),
    (r"(startup|entreprise|societe|société)", "fas fa-rocket"),
    (r"(emploi|poste|talent|salarie|salarié)", "fas fa-users"),
    (r"(eleve|élève|laureat|lauréat|etudiant|étudiant|bac|bem)", "fas fa-graduation-cap"),
    (r"(abonne|abonné|client|habitant|utilisateur)", "fas fa-user-group"),
    (r"(an|annee|année|trimestre|mois|jour)", "fas fa-calendar-days"),
]


def pick_icon(*fragments):
    blob = deaccent(" ".join(str(f or "") for f in fragments))
    for pattern, icon in FIGURE_ICONS:
        if re.search(pattern, blob):
            return icon
    return "fas fa-chart-line"


def enrich_key_figures(figures, text):
    """Ajoute icône, jauge et tendance à chaque chiffre clé déjà extrait."""
    flat = strip_tags(text or "")
    numeric = []
    for fig in figures or []:
        val = to_number(fig.get("value"))
        numeric.append(val if val is not None else 0)
    peak = max(numeric) if numeric else 0

    out = []
    for i, fig in enumerate(figures or []):
        fig = dict(fig)
        raw_value = str(fig.get("value", ""))
        fig.setdefault("icon", pick_icon(raw_value, fig.get("label")))

        val = numeric[i]
        if "%" in raw_value and val:
            fig["progress"] = max(0, min(100, abs(val)))
        elif peak > 0 and val:
            fig["progress"] = max(4, min(100, round(val / peak * 100)))

        # Tendance : cherchée autour du chiffre, sans confondre avec un point de comparaison
        window = ""
        pos = flat.find(raw_value.strip())
        if pos >= 0:
            before = deaccent(flat[max(0, pos - 60): pos])
            after = deaccent(flat[pos + len(raw_value.strip()): pos + len(raw_value.strip()) + 45])
            # « en hausse par rapport aux 42 % » : ce 2e chiffre est la référence, pas la tendance
            if re.search(r"(par rapport|contre|au lieu de|versus)\s*(aux?|a|de[s]?)?\s*$", before):
                window = ""
            else:
                window = before + " " + re.split(r"(?:par rapport|contre|au lieu de|versus)", after)[0]
        if raw_value.strip().startswith("+") or re.search(r"(hausse|augment|croissance|progress|record|bond|plus de)", window):
            fig["trend"] = "up"
            fig.setdefault("delta", "En hausse")
        elif raw_value.strip().startswith("-") or re.search(r"(baisse|recul|diminu|chute|moins de|reduction|réduction)", window):
            fig["trend"] = "down"
            fig.setdefault("delta", "En baisse")
        out.append(fig)
    return out


# ----------------------------------------------------------------- graphique
def chart_from_table(table_data):
    """Convertit un tableau à colonne numérique en graphique."""
    if not table_data:
        return None
    headers = table_data.get("headers") or []
    rows = table_data.get("rows") or []
    if len(headers) < 2 or len(rows) < 2:
        return None
    # Cherche la première colonne majoritairement numérique
    for col in range(1, len(headers)):
        values = [to_number(r[col]) if len(r) > col else None for r in rows]
        ok = [v for v in values if v is not None]
        if len(ok) >= max(2, int(len(rows) * 0.7)):
            series = []
            for r, v in zip(rows, values):
                if v is None:
                    continue
                series.append({"label": str(r[0])[:24], "value": v})
            if len(series) < 2:
                continue
            unit = ""
            m = re.search(r"\(([^)]{1,8})\)|\b(%|MW|DA|USD|Mds?)\b", headers[col])
            if m:
                unit = (m.group(1) or m.group(2) or "").strip()
            return {
                "type": "bar",
                "title": headers[col] if len(headers[col]) > 3 else "Données comparées",
                "subtitle": "Source : tableau de l’article",
                "unit": unit,
                "series": series,
            }
    return None


def chart_from_text(text):
    """Construit un graphique seulement si le texte porte une vraie série."""
    flat = strip_tags(text or "")

    # 1. Série temporelle : « en 2024 ... 12 % », « d'ici 2030 ... 40 MW »
    year_hits = []
    for m in re.finditer(
        r"\b(?:en|dès|d[’']ici|à l[’']horizon|pour)\s+(20\d{2})\b[^.;\d]{0,70}?"
        r"(\d[\d\s .,]*)\s*(%|MW|GW|milliards?|millions?|tonnes?)",
        flat, re.I,
    ):
        val = to_number(m.group(2))
        if val is None:
            continue
        year_hits.append((m.group(1), val, m.group(3)))
    # ... et l'ordre inverse : « 10 millions en 2026 »
    for m in re.finditer(
        r"(\d[\d\s .,]*)\s*(%|MW|GW|milliards?|millions?|tonnes?)[^.;\d]{0,45}?"
        r"\b(?:en|dès|d[’']ici|à l[’']horizon|pour)\s+(20\d{2})\b",
        flat, re.I,
    ):
        val = to_number(m.group(1))
        if val is None:
            continue
        pair = (m.group(3), val, m.group(2))
        if pair not in year_hits:
            year_hits.append(pair)
    if len(year_hits) >= 2:
        units = {u.lower().rstrip("s") for _, _, u in year_hits}
        if len(units) == 1:
            seen, series = set(), []
            for year, val, _ in sorted(year_hits, key=lambda h: h[0]):
                if year in seen:
                    continue
                seen.add(year)
                series.append({"label": year, "value": val})
            if len(series) >= 2:
                return {
                    "type": "line",
                    "title": "Évolution dans le temps",
                    "subtitle": "Valeurs citées dans l’article",
                    "unit": year_hits[0][2],
                    "series": series,
                }

    # 2. Répartition en pourcentages : « 45 % pour X, 30 % pour Y »
    pct = []
    for m in re.finditer(r"(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:de[s]?|pour|des|du|d[’'])\s+([\wÀ-ÿ'’\- ]{3,28})", flat):
        val = to_number(m.group(1))
        label = m.group(2).strip().rstrip(",.;:").title()
        if val is not None and 0 < val <= 100:
            pct.append({"label": label[:24], "value": val})
    if len(pct) >= 2:
        total = sum(p["value"] for p in pct)
        return {
            "type": "donut" if 92 <= total <= 108 else "bar",
            "title": "Répartition en pourcentage",
            "subtitle": "Valeurs citées dans l’article",
            "unit": " %",
            "total_label": "Cumul",
            "series": pct[:6],
        }

    # 3. Vraie serie de grandeurs de meme unite : au moins 3 valeurs nommees.
    #    En deca, une paire est presque toujours une comparaison mal decoupee :
    #    mieux vaut ne rien afficher qu'un graphique trompeur.
    UNIT_WORDS = {"dollar", "euro", "dinar", "usd", "da", "million", "milliard",
                  "an", "annee", "montant", "valeur", "total"}
    same_unit = {}
    for m in re.finditer(
        r"(\d[\d\s .,]*)\s*(MW|GW|tonnes?|startups?|entreprises?|emplois?|logements?|km)\b",
        flat, re.I,
    ):
        val = to_number(m.group(1))
        if val is None:
            continue
        unit = m.group(2).lower().rstrip("s")
        label = label_before(flat, m.start())
        if not label or deaccent(label).rstrip("s") in UNIT_WORDS or re.search(r"\d", label):
            continue
        same_unit.setdefault(unit, []).append({"label": label[:24], "value": val})

    for unit, series in same_unit.items():
        uniq, seen = [], set()
        for s in series:
            if deaccent(s["label"]) in seen:
                continue
            seen.add(deaccent(s["label"]))
            uniq.append(s)
        if len(uniq) >= 3:
            return {
                "type": "bar",
                "title": "Grandeurs comparees ({})".format(unit),
                "subtitle": "Valeurs extraites de l'article",
                "unit": "",
                "series": uniq[:6],
            }
    return None


# ------------------------------------------------------------------- frise
DATE_PATTERNS = [
    r"\b(\d{1,2}\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s+\d{4})?)\b",
    r"\b((?:premier|deuxième|troisième|quatrième|1er|2e|3e|4e)\s+trimestre\s+20\d{2})\b",
    r"\b((?:début|fin|mi)-?\s?20\d{2})\b",
    r"\b(20\d{2})\b",
]


def build_timeline(text):
    """Repère les jalons datés de l'article (≥ 2 pour être affichés)."""
    flat = strip_tags(text or "")
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", flat) if s.strip()]
    items, seen = [], set()
    for sentence in sentences:
        if len(sentence) < 25:
            continue
        found = None
        for pattern in DATE_PATTERNS:
            m = re.search(pattern, sentence, re.I)
            if m:
                found = m.group(1).strip()
                break
        if not found:
            continue
        key = found.lower()
        if key in seen:
            continue
        seen.add(key)
        body = sentence if len(sentence) <= 190 else sentence[:187].rsplit(" ", 1)[0] + "…"
        items.append({"date": found, "text": body})
        if len(items) >= 5:
            break
    return items if len(items) >= 2 else None


# -------------------------------------------------------------- comparateur
def build_comparator(table_data):
    """Un tableau à 3 colonnes se lit naturellement comme un comparatif."""
    if not table_data:
        return None
    headers = table_data.get("headers") or []
    rows = table_data.get("rows") or []
    if len(headers) != 3 or len(rows) < 2:
        return None
    comp_rows = []
    for r in rows:
        if len(r) < 3:
            continue
        a_val, b_val = to_number(r[1]), to_number(r[2])
        best = None
        if a_val is not None and b_val is not None and a_val != b_val:
            best = "a" if a_val > b_val else "b"
        comp_rows.append({"label": str(r[0]), "a": str(r[1]), "b": str(r[2]), "best": best})
    if len(comp_rows) < 2:
        return None
    return {
        "title": headers[0] or "Comparatif",
        "a": {"label": headers[1], "icon": "fas fa-circle-dot"},
        "b": {"label": headers[2], "icon": "fas fa-circle-half-stroke"},
        "rows": comp_rows,
    }


# ------------------------------------------------------------------ sondage
POLL_TEMPLATES = {
    "TIC": (
        "Ce chantier va-t-il améliorer concrètement le service au quotidien ?",
        ["Oui, nettement", "Un peu seulement", "Pas vraiment", "Il faut voir à l’usage"],
    ),
    "ENERGIE": (
        "L’Algérie peut-elle devenir un fournisseur majeur d’énergie décarbonée ?",
        ["Oui, clairement", "Possible d’ici 10 ans", "Trop tôt pour le dire", "Non"],
    ),
    "TECH": (
        "Cet écosystème peut-il faire émerger une startup de rang continental ?",
        ["Oui, très vite", "Oui, mais lentement", "Il manque du financement", "Non"],
    ),
    "DEFAULT": (
        "Quel est votre avis sur cette annonce ?",
        ["Une bonne nouvelle", "À confirmer dans les faits", "Insuffisant", "Sans avis"],
    ),
}


def build_poll(category, text):
    blob = deaccent((category or "") + " " + strip_tags(text or "")[:1200])
    if re.search(r"(telecom|mobile|internet|operateur|poste|reseau|4g|5g|fibre)", blob):
        key = "TIC"
    elif re.search(r"(energie|hydrogene|solaire|gaz|petrole|sonatrach|sonelgaz|climat)", blob):
        key = "ENERGIE"
    elif re.search(r"(startup|innovation|intelligence artificielle|\bia\b|incubateur|venture)", blob):
        key = "TECH"
    else:
        key = "DEFAULT"
    question, labels = POLL_TEMPLATES[key]
    return {
        "id": "poll-" + key.lower(),
        "question": question,
        "options": [{"id": "o%d" % i, "label": lab} for i, lab in enumerate(labels)],
    }


# ------------------------------------------------------------- à lire aussi
STOPWORDS = set(
    """les des une aux avec pour dans sur par que qui est ont son ses leur leurs
    cette ces plus moins tout tous toute entre vers chez sans sous elle ils elles
    nous vous notre votre nos vos deux trois lors ainsi dont afin selon apres après
    depuis alors encore aussi meme même autre autres grand grande premier premiere
    première nouveau nouvelle""".split()
)


def load_site_articles():
    """Charge articles.json du site principal (cache sur date de modification)."""
    path = os.path.join(SITE_ROOT, "articles.json")
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return []
    if _ARTICLES_CACHE["mtime"] == mtime:
        return _ARTICLES_CACHE["items"]
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        items = data if isinstance(data, list) else data.get("articles", [])
    except Exception:
        items = []
    _ARTICLES_CACHE["mtime"] = mtime
    _ARTICLES_CACHE["items"] = items
    return items


def keywords_of(text, limit=40):
    words = re.findall(r"[a-z]{4,}", deaccent(strip_tags(text or "")))
    out = []
    for w in words:
        if w in STOPWORDS or w in out:
            continue
        out.append(w)
        if len(out) >= limit:
            break
    return set(out)


def build_related(title, text, limit=3):
    """Sélectionne les articles du site les plus proches par mots-clés."""
    articles = load_site_articles()
    if not articles:
        return None
    ref = keywords_of(title + " " + strip_tags(text or "")[:2500])
    if not ref:
        return None
    ref_title = deaccent(title or "")
    scored = []
    for art in articles:
        art_title = str(art.get("titre") or "")
        if not art_title or deaccent(art_title) == ref_title:
            continue
        blob = art_title + " " + str(art.get("tags") or "") + " " + str(art.get("extrait") or "")
        score = len(ref & keywords_of(blob, 60))
        if score >= 2:
            scored.append((score, art))
    # Les mieux appariés d'abord, puis les plus récents
    scored.sort(key=lambda p: (p[0], str(p[1].get("date") or "")), reverse=True)

    out = []
    for _, art in scored[:limit]:
        date = str(art.get("date") or "")
        try:
            date = datetime.strptime(date, "%Y-%m-%d").strftime("%d/%m/%Y")
        except ValueError:
            pass
        out.append({
            "title": str(art.get("titre"))[:110],
            "url": "{}/article/{}".format(SITE_URL, art.get("id")) if art.get("id") else SITE_URL,
            "date": date,
            "category": str(art.get("categorie") or ""),
        })
    return out or None


# --------------------------------------------------- densité de lecture
SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-ZÀ-Ý«\"'\d])")


def split_sentences(html):
    """Découpe en phrases sans casser les balises (<strong> n'enjambe jamais un point)."""
    parts = [s.strip() for s in SENTENCE_SPLIT.split(html or "") if s.strip()]
    merged = []
    for part in parts:
        # Une phrase dont les balises sont déséquilibrées est recollée à la précédente.
        if merged and merged[-1].count("<") != merged[-1].count(">"):
            merged[-1] += " " + part
        else:
            merged.append(part)
    return merged


def _sentence_score(sentence, keywords, index, total):
    flat = strip_tags(sentence)
    score = 0.0
    # Une phrase chiffrée porte l'information dure
    score += 2.2 * len(re.findall(r"\d", flat)) ** 0.5
    # Noms propres / sigles
    score += 0.8 * len(re.findall(r"\b[A-ZÀ-Ý][a-zà-ÿ']{2,}", flat[1:]))
    score += 1.0 * len(re.findall(r"\b[A-ZÀ-Ý]{3,}\b", flat))
    # Recoupement avec le titre
    words = set(re.findall(r"[a-z]{4,}", deaccent(flat)))
    score += 1.6 * len(words & keywords)
    # L'attaque du paragraphe pose le sujet
    if index == 0:
        score += 3.0
    elif index == total - 1:
        score += 0.5
    # Les phrases très courtes sont rarement autonomes
    if len(flat) < 45:
        score -= 2.0
    return score


def condense(html, keep, keywords):
    """Garde les `keep` phrases les plus informatives, mot pour mot, dans l'ordre."""
    sentences = split_sentences(html)
    if keep >= len(sentences) or keep <= 0:
        return html
    scored = [(_sentence_score(s, keywords, i, len(sentences)), i, s) for i, s in enumerate(sentences)]
    scored.sort(key=lambda t: t[0], reverse=True)
    chosen = sorted(idx for _, idx, _ in scored[:keep])
    return " ".join(sentences[i] for i in chosen)


BLOCK_TAGS = re.compile(
    r"</?(?:p|div|section|article|ul|ol|li|h[1-6]|blockquote|figure|figcaption|table|tbody|tr|td|th)\b[^>]*>",
    re.I,
)


def normalize_markup(html):
    """Ramène le balisage d'un modèle à de l'HTML en ligne, sûr à insérer.

    Les modèles renvoient volontiers du markdown ou un contenu enveloppé dans
    <p>…</p> : injecté dans le <p> du gabarit, ce bloc le refermait aussitôt et
    vidait le paragraphe. On ne garde donc que les balises en ligne.
    """
    if not html:
        return html
    html = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html)
    html = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", html)
    html = re.sub(r"<br\s*/?>", " ", html, flags=re.I)
    html = BLOCK_TAGS.sub(" ", html)
    return re.sub(r"\s{2,}", " ", html).strip()


def _plain_len(html):
    return len(re.sub(r"\s+", " ", strip_tags(html or "")).strip())


def build_density(data, text=""):
    """Prépare les versions « 30 secondes » et « 3 minutes » de chaque section.

    Une version fournie par l'IA n'est gardée que si elle est réellement plus
    courte que le niveau au-dessus ; sinon on la reconstruit par extraction
    (phrases existantes, mot pour mot, jamais de reformulation).
    """
    keywords = keywords_of(strip_tags(data.get("title", "")) + " " + strip_tags(data.get("category", "")), 20)

    chapeau = normalize_markup(data.get("chapeau") or "")
    if chapeau:
        data["chapeau"] = chapeau
        short = normalize_markup(data.get("chapeau_short") or "")
        if not short or _plain_len(short) >= _plain_len(chapeau) * 0.95:
            short = condense(chapeau, 1, keywords)
        data["chapeau_short"] = short

    for tab in data.get("tabs") or []:
        content = normalize_markup(tab.get("content") or "")
        if not content:
            continue
        tab["content"] = content
        total = len(split_sentences(content))
        if total <= 1:
            tab.pop("content_short", None)
            tab.pop("content_medium", None)
            continue

        medium = normalize_markup(tab.get("content_medium") or "")
        if not medium or _plain_len(medium) >= _plain_len(content) * 0.95:
            medium = condense(content, max(2, round(total * 0.5)), keywords)
        tab["content_medium"] = medium

        short = normalize_markup(tab.get("content_short") or "")
        if not short or _plain_len(short) >= _plain_len(medium) * 0.95:
            short = condense(content, 1, keywords)
        tab["content_short"] = short

    return data


# ------------------------------------------------- traçabilité des chiffres
def attach_figure_sources(data, text=""):
    """Relie chaque chiffre clé à la phrase d'origine et à la section qui la porte."""
    flat = strip_tags(text or "")
    # Découpage ligne par ligne : le titre d'un article n'est pas ponctué et
    # serait sinon recollé au premier paragraphe.
    sentences = []
    for line in flat.splitlines():
        line = line.strip()
        if line:
            sentences.extend(split_sentences(line))
    tabs = data.get("tabs") or []

    for fig in data.get("key_figures") or []:
        raw = str(fig.get("value") or "").strip()
        if not raw or fig.get("source"):
            continue
        needle = re.sub(r"\s+", " ", raw)
        # Le nombre seul suffit à retrouver la phrase (l'unité peut varier de casse)
        number = re.match(r"[+\-]?[\d  .,]+", needle)
        probe = (number.group(0).strip() if number else needle)
        if len(probe) < 1:
            continue

        sentence = next((s for s in sentences if probe in s), None)
        tab_id = None
        for tab in tabs:
            if probe in strip_tags(tab.get("content") or ""):
                tab_id = tab.get("id")
                break
        if sentence or tab_id:
            fig["source"] = {
                "probe": probe,
                "sentence": (sentence or "").strip()[:320],
                "tab": tab_id,
            }
    return data


# --------------------------------------------------------- « À retenir »
def build_takeaways(data, limit=3):
    """Trois points essentiels, repris mot pour mot dans l'article.

    On sélectionne des phrases existantes : rien n'est reformulé, donc rien
    ne peut être déformé.
    """
    if data.get("takeaways"):
        return [strip_tags(t).strip() for t in data["takeaways"] if str(t).strip()][:limit]

    def clean(sentence):
        flat = re.sub(r"\s+", " ", strip_tags(sentence)).strip()
        # Un intertitre markdown collé au texte n'a rien à faire dans un point clé
        flat = re.sub(r"^#{1,6}\s*", "", flat)
        flat = re.sub(r"#{1,6}\s+[^.!?]{0,80}?(?=[A-ZÀ-Ý])", "", flat)
        return re.sub(r"^[\s>*_-]+", "", flat).strip()

    candidates = []
    for tab in data.get("tabs") or []:
        for sentence in split_sentences(tab.get("content") or ""):
            flat = clean(sentence)
            if 55 <= len(flat) <= 240:
                candidates.append(flat)
    if len(candidates) < 2:
        for sentence in split_sentences(data.get("chapeau") or ""):
            flat = clean(sentence)
            if 55 <= len(flat) <= 240:
                candidates.append(flat)
    if len(candidates) < 2:
        return []

    def score(sentence, index):
        value = 0.0
        value += min(len(re.findall(r"\d", sentence)), 8) * 1.6
        if re.search(r"\b(%|milliards?|millions?|dinars?|DA|USD|MW|tonnes?)\b", sentence, re.I):
            value += 3
        if re.search(r"\b(20\d{2}|trimestre)\b", sentence):
            value += 2
        if re.search(r"\b(annonc|lanc|prévoit|permettra|vise|objectif|décid|sign|approuv)", sentence, re.I):
            value += 2
        if index == 0:
            value += 2
        return value

    ranked = sorted(
        ((score(s, i), i, s) for i, s in enumerate(candidates)),
        key=lambda t: t[0], reverse=True,
    )[:limit]
    return [s for _, _, s in sorted(ranked, key=lambda t: t[1])]


# ------------------------------------------- questions suggérées au lecteur
def build_qa_suggestions(data, text=""):
    """Trois questions d'amorce, tirées de ce que l'article contient vraiment."""
    flat = strip_tags(text or "")
    blob = deaccent(flat)
    out = []

    figures = data.get("key_figures") or []
    real = [f for f in figures if f.get("source")]
    if real:
        out.append("Que représente le chiffre {} ?".format(real[0].get("value")))

    if re.search(r"\b(quand|des|dès|a partir|à partir|20\d{2}|trimestre|calendrier|echeance|échéance)\b", blob):
        out.append("Quel est le calendrier annoncé ?")
    if re.search(r"(dinar|million|milliard|budget|investissement|cout|coût|prix|tarif|da\b)", blob):
        out.append("Combien cela coûte-t-il ?")
    if re.search(r"(wilaya|alger|oran|constantine|region|région|national)", blob):
        out.append("Qui est concerné et où ?")
    if re.search(r"(objectif|vise|ambition|permettra|but)", blob):
        out.append("Quel est l'objectif visé ?")

    out.append("Quel est le point essentiel à retenir ?")

    seen, uniq = set(), []
    for q in out:
        if q in seen:
            continue
        seen.add(q)
        uniq.append(q)
    return uniq[:3]


_EXTERNAL_CACHE = {"mtime": 0, "items": []}


def load_external_sources():
    """Rassemble les sources extérieures déjà collectées par le site :
    revue de presse et veille (titre + URL réelle + média d'origine)."""
    paths = [os.path.join(SITE_ROOT, "revue_presse.json"),
             os.path.join(SITE_ROOT, "veille_data.json")]
    stamp = 0
    for path in paths:
        try:
            stamp += os.path.getmtime(path)
        except OSError:
            pass
    if _EXTERNAL_CACHE["mtime"] == stamp and _EXTERNAL_CACHE["items"]:
        return _EXTERNAL_CACHE["items"]

    items = []

    def add(title, url, source, date=""):
        title = strip_tags(str(title or "")).strip()
        url = str(url or "").strip()
        if not title or not url.startswith("http"):
            return
        items.append({"title": title[:150], "url": url,
                      "source": strip_tags(str(source or "")).strip()[:60], "date": str(date or "")[:10]})

    try:
        with open(paths[0], "r", encoding="utf-8") as fh:
            revue = json.load(fh)
        for a in (revue.get("articles") or []):
            add(a.get("titre"), a.get("url"), a.get("source"), a.get("date"))
    except Exception:
        pass

    try:
        with open(paths[1], "r", encoding="utf-8") as fh:
            veille = json.load(fh)
        for key in ("manual", "feed"):
            for a in (veille.get(key) or []):
                add(a.get("title"), a.get("url"), a.get("source"), a.get("date"))
    except Exception:
        pass

    # Les articles du site portent aussi des sources publiques
    for art in load_site_articles():
        if art.get("id"):
            add(art.get("titre"), "{}/article/{}".format(SITE_URL, art["id"]),
                "Algeria Tech", art.get("date"))

    _EXTERNAL_CACHE["mtime"] = stamp
    _EXTERNAL_CACHE["items"] = items
    return items


def search_external(question, article_title="", limit=4, exclude_url=""):
    """Cherche, hors de l'article, des lectures qui éclairent la question."""
    terms = keywords_of(question, 12) | keywords_of(article_title, 8)
    if not terms:
        return []
    ref_title = deaccent(article_title)
    # L'article qu'on est en train de lire n'est pas une lecture complémentaire
    ref_id = ""
    match = re.search(r"/article/([A-Za-z0-9_-]+)", str(exclude_url or ""))
    if match:
        ref_id = match.group(1)

    scored = []
    for item in load_external_sources():
        if deaccent(item["title"]) == ref_title:
            continue
        if ref_id and ref_id in item["url"]:
            continue
        hay = keywords_of(item["title"] + " " + item["source"], 30)
        overlap = len(terms & hay)
        if overlap >= 2:
            scored.append((overlap, item))

    scored.sort(key=lambda pair: (pair[0], pair[1]["date"]), reverse=True)

    seen, out = set(), []
    for _, item in scored:
        key = deaccent(item["title"])[:60]
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= limit:
            break
    return out


def article_corpus(data):
    """Toutes les phrases de l'article, avec la section d'où elles viennent."""
    corpus = []

    def add(html, tab_id, label):
        for sentence in split_sentences(html or ""):
            flat = strip_tags(sentence).strip()
            if len(flat) > 25:
                corpus.append({"text": flat, "tab": tab_id, "section": label})

    add(data.get("chapeau"), None, "Chapeau")
    for tab in data.get("tabs") or []:
        add(tab.get("content"), tab.get("id"), tab.get("title") or "Section")
        quote = (tab.get("quote") or {}).get("text")
        if quote:
            corpus.append({"text": strip_tags(quote).strip(), "tab": tab.get("id"),
                           "section": (tab.get("title") or "Section") + " · citation"})
    add((data.get("interactive_block") or {}).get("content"), None, "Mise en avant")
    add((data.get("closing") or {}).get("text"), None, "Conclusion")
    return corpus


# ------------------------------------------------------------- orchestrateur
def enrich_payload(data, source_text="", options=None):
    """Complète les données d'un article avec tous les blocs interactifs."""
    if not isinstance(data, dict):
        return data
    options = options or {}
    text = source_text or ""
    if not text.strip():
        chunks = [strip_tags(data.get("chapeau", ""))]
        for tab in data.get("tabs") or []:
            chunks.append(strip_tags(tab.get("content", "")))
        chunks.append(strip_tags((data.get("closing") or {}).get("text", "")))
        text = " ".join(c for c in chunks if c)

    title = strip_tags(data.get("title", ""))

    # 0. Assainissement du balisage (markdown, <p> parasites des modèles)
    for key in ("chapeau", "chapeau_short"):
        if data.get(key):
            data[key] = normalize_markup(data[key])
    for tab in data.get("tabs") or []:
        for key in ("content", "content_medium", "content_short"):
            if tab.get(key):
                tab[key] = normalize_markup(tab[key])
        if (tab.get("quote") or {}).get("text"):
            tab["quote"]["text"] = normalize_markup(tab["quote"]["text"])
    if (data.get("interactive_block") or {}).get("content"):
        data["interactive_block"]["content"] = normalize_markup(data["interactive_block"]["content"])
    if (data.get("closing") or {}).get("text"):
        data["closing"]["text"] = normalize_markup(data["closing"]["text"])

    # 1. Horodatage vivant
    data.setdefault("published_at", datetime.now(timezone.utc).isoformat(timespec="seconds"))

    # 2. Chiffres clés enrichis (jauges + tendances)
    if data.get("key_figures"):
        data["key_figures"] = enrich_key_figures(data["key_figures"], text)

    # 3. Graphique
    if options.get("chart", True) and not data.get("chart"):
        chart = chart_from_table(data.get("table_data")) or chart_from_text(text)
        if chart:
            data["chart"] = chart

    # 4. Frise chronologique
    if options.get("timeline", True) and not data.get("timeline"):
        timeline = build_timeline(text)
        if timeline:
            data["timeline"] = timeline
            data.setdefault("timeline_title", "Les dates clés de l’article")

    # 5. Comparateur
    if options.get("comparator", True) and not data.get("comparator"):
        comparator = build_comparator(data.get("table_data"))
        if comparator:
            data["comparator"] = comparator

    # 6. Mini-carte
    if options.get("map", True) and not data.get("geo"):
        hit = detect_wilaya(text + " " + title)
        if hit:
            label = DISPLAY_NAMES.get(hit["name"], hit["name"])
            data["geo"] = {
                "wilaya": hit["name"],
                "label": "Wilaya " + ("d’" if label[:1].upper() in "AEIOU" else "de ") + label,
                "note": "Le cœur de cette actualité se situe à {}.".format(label),
            }

    # 7. Sondage
    if options.get("poll", True) and not data.get("poll"):
        data["poll"] = build_poll(data.get("category"), text)

    # 8. À lire aussi
    if options.get("related", True) and not data.get("related"):
        related = build_related(title, text)
        if related:
            data["related"] = related

    # 9. Densité de lecture (30 s / 3 min / intégral)
    if options.get("density", True):
        build_density(data, text)

    # 10. Traçabilité : chaque chiffre pointe vers sa phrase d'origine
    if options.get("sources", True):
        attach_figure_sources(data, text)

    # 11. Questions à l'article : le repli hors ligne se fait côté carte
    if options.get("qa", True) and not data.get("qa"):
        data["qa"] = {
            "enabled": True,
            "endpoint": "/api/ask",
            "suggestions": build_qa_suggestions(data, text),
        }

    # 12. Partage
    data.setdefault("share", {
        "url": data.get("source_url") or "",
        "hashtags": [t.lstrip("#") for t in ((data.get("footer") or {}).get("tags") or [])][:3],
    })

    return data
