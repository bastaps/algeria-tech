# -*- coding: utf-8 -*-
"""Visuel interactif : une image qui illustre l'article, avec des zones
cliquables renvoyant chacune vers un passage precis du texte.

Deux facons de peindre la *meme* mise en page :

  * ``svg``    - option A : infographie vectorielle dessinee par le code ;
  * ``layers`` - option B : une illustration produite par un modele d'image
                 pour chaque element, composee ici meme.

La mise en page est calculee ici dans les deux cas : les coordonnees des zones
sont donc exactes par construction, jamais devinees apres coup sur une image
plate. Passer de A a B ne deplace pas une seule zone.
"""

import base64
import hashlib
import io
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor

import requests

import enrich

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, "cache", "visuals")

W_DEFAULT, H_DEFAULT = 1000, 620
MAX_NODES = 6


# --------------------------------------------------------------- utilitaires
def _esc(value):
    return (
        str(value if value is not None else "")
        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _hex_to_rgb(color, fallback=(10, 42, 94)):
    raw = str(color or "").strip().lstrip("#")
    if len(raw) == 3:
        raw = "".join(c * 2 for c in raw)
    if len(raw) != 6:
        return fallback
    try:
        return tuple(int(raw[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return fallback


def _to_hex(rgb):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(c)))) for c in rgb)


def _mix(color, other, ratio):
    """Melange deux couleurs. `ratio` est la part de `other`."""
    a, b = _hex_to_rgb(color), _hex_to_rgb(other)
    return _to_hex(tuple(a[i] + (b[i] - a[i]) * ratio for i in range(3)))


def _rgba(color, alpha):
    r, g, b = _hex_to_rgb(color)
    return "rgba(%d,%d,%d,%s)" % (r, g, b, round(float(alpha), 3))


def _luma(color):
    r, g, b = _hex_to_rgb(color)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0


def _readable_on(color):
    """Noir ou blanc, selon ce qui se lit le mieux sur `color`."""
    return "#101820" if _luma(color) > 0.62 else "#ffffff"


def _clean(text):
    """Du texte lisible sur une image : ni balise, ni markdown, ni ligne de tableau."""
    flat = re.sub(r"\s+", " ", enrich.strip_tags(str(text or ""))).strip()
    flat = re.sub(r"^#{1,6}\s*", "", flat)
    flat = re.sub(r"[*_`]+", "", flat)
    if flat.count("|") >= 2:
        # Une ligne de tableau markdown : on ne garde que ses cellules parlantes.
        cells = [c.strip() for c in flat.split("|")
                 if c.strip() and not re.fullmatch(r"[-:\s]+", c.strip())]
        flat = " · ".join(cells[:2])
    return flat.strip(" |·-—–").strip()


def _fit(text, max_chars):
    flat = _clean(text)
    if len(flat) <= max_chars:
        return flat
    cut = flat[:max_chars].rsplit(" ", 1)[0]
    return (cut or flat[:max_chars]).rstrip(" ,;:.") + "…"


def _wrap(text, max_chars, max_lines):
    """Decoupe en lignes : SVG ne sait pas revenir a la ligne tout seul."""
    flat = _clean(text)
    if not flat:
        return []
    words, lines, current = flat.split(" "), [], ""
    for word in words:
        candidate = (current + " " + word).strip()
        if len(candidate) <= max_chars or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
            if len(lines) == max_lines:
                break
    if current and len(lines) < max_lines:
        lines.append(current)
    if lines and len(" ".join(lines)) < len(flat):
        lines[-1] = _fit(lines[-1], max_chars - 1) if lines[-1].endswith("…") \
            else _fit(lines[-1] + " …", max_chars)
    return lines


def _theme_of(data, override=None):
    theme = dict((data or {}).get("theme") or {})
    theme.update(override or {})
    primary = theme.get("primary_color") or "#0a2a5e"
    accent = theme.get("accent_color") or "#ffb347"
    return {
        "primary": primary,
        "accent": accent,
        "deep": _mix(primary, "#000000", 0.45),
        "mid": _mix(primary, "#ffffff", 0.10),
        "soft": _mix(primary, "#ffffff", 0.70),
        "ink": _readable_on(primary),
        "on_accent": _readable_on(accent),
    }


# ------------------------------------------------------------- ancrage texte
def _sentences_of(text):
    out = []
    for line in enrich.strip_tags(text or "").splitlines():
        line = line.strip()
        if line:
            out.extend(enrich.split_sentences(line))
    return out


def locate_passage(probe, sentences, tabs, avoid=None):
    """Retrouve la phrase et la section qui portent `probe`.

    `avoid` liste les phrases deja prises par d'autres zones : une phrase qui
    enumere tous les acteurs ne doit pas devenir la cible de chacun d'eux. On
    lui prefere une phrase encore libre, et on ne revient a la premiere trouvee
    qu'a defaut.

    Renvoie ``None`` si le texte cherche n'existe pas dans l'article : une zone
    qui ne mene nulle part ne doit pas etre proposee au lecteur.
    """
    needle = re.sub(r"\s+", " ", str(probe or "")).strip()
    if len(needle) < 2:
        return None

    taken = avoid if avoid is not None else set()
    flat_needle = enrich.deaccent(needle).lower()

    def matches(item):
        return needle in item or flat_needle in enrich.deaccent(item).lower()

    # Une ligne de tableau contient bien le terme cherche, mais fait une pietre
    # citation : on la garde en dernier recours seulement.
    hits = sorted(
        (s for s in sentences if matches(s)),
        key=lambda s: (s.strip().lower() in taken, s.count("|") >= 2),
    )
    sentence = hits[0] if hits else None

    tab_id = None
    for tab in tabs or []:
        if needle in enrich.strip_tags(tab.get("content") or ""):
            tab_id = tab.get("id")
            break
    if tab_id is None:
        for tab in tabs or []:
            body = enrich.deaccent(enrich.strip_tags(tab.get("content") or "")).lower()
            if flat_needle in body:
                tab_id = tab.get("id")
                break

    if sentence is None and tab_id is None:
        return None

    # Le repere doit exister *tel quel* dans l'article : le surlignage cote
    # navigateur compare caractere par caractere. « ANCIEN » lu sur une image
    # doit donc devenir « ancien » si c'est ainsi que le texte l'ecrit.
    if sentence and needle not in sentence:
        flat_sentence = enrich.deaccent(sentence)
        position = flat_sentence.find(flat_needle)
        if position >= 0 and len(flat_sentence) == len(sentence):
            needle = sentence[position:position + len(needle)]

    # Un intertitre markdown reste une phrase valable, mais ses dieses n'ont rien
    # a faire dans la citation montree au lecteur.
    quote = re.sub(r"\s+", " ", (sentence or "")).strip()
    quote = re.sub(r"^#{1,6}\s*", "", quote).replace("**", "").strip()
    return {
        "probe": needle,
        "sentence": quote[:320],
        "tab": tab_id or "",
    }


# --------------------------------------------------------- sources des noeuds
def _remember(target, used):
    used.add((target.get("sentence") or "").strip().lower())
    return target


def _nodes_figures(data, text, sentences, tabs, limit, used=None):
    used = set() if used is None else used
    nodes = []
    for fig in (data.get("key_figures") or []):
        value = _fit(fig.get("value"), 14)
        if not value:
            continue
        source = fig.get("source") or {}
        probe = source.get("probe")
        if not probe:
            number = re.match(r"[+\-]?[\d   .,]+", value)
            probe = (number.group(0).strip() if number else value)
        target = locate_passage(probe, sentences, tabs, used)
        if not target:
            continue
        _remember(target, used)
        nodes.append({
            "value": value,
            "label": _fit(fig.get("label"), 46),
            "sub": _fit(fig.get("sub") or fig.get("unit") or "", 30),
            "target": target,
            "art": fig.get("label") or value,
        })
        if len(nodes) >= limit:
            break
    return nodes


# « Alger, 14 août 2026 (Algeria Tech) — » : la signature de l'article, pas un
# jalon de son récit.
DATELINE = re.compile(
    r"^\s*[\wÀ-ÿ'’\- ]{3,28},\s*(?:le\s+)?"
    r"(?:\d{1,2}\s+[\wÀ-ÿ]+\s+\d{4}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})"
    r"\s*(?:\([^)]*\))?\s*[—–-]"
)


def _nodes_timeline(data, text, sentences, tabs, limit, used=None):
    used = set() if used is None else used
    nodes = []
    for item in (data.get("timeline") or []):
        date = _fit(item.get("date"), 16)
        if not date:
            continue
        raw_title = str(item.get("title") or item.get("text") or "")
        title = _fit(raw_title, 60)
        target = (locate_passage(date, sentences, tabs, used)
                  or locate_passage(title, sentences, tabs, used))
        if not target:
            continue
        if DATELINE.match(target.get("sentence") or ""):
            continue
        _remember(target, used)
        # Une ligne de tableau ne fait pas un intitulé : on reprend alors la
        # phrase qui porte la date, c'est elle que la zone ouvrira de toute façon.
        if "|" in raw_title or len(title) < 8:
            title = _fit(target.get("sentence") or title, 60)
        nodes.append({
            "value": date,
            "label": title,
            "sub": "",
            "target": target,
            "art": title or date,
        })
        if len(nodes) >= limit:
            break
    return nodes


MONTH_WORDS = set(enrich.deaccent(m) for m in getattr(enrich, "MONTHS", {}))
ACTOR_NOISE = set("""
Les Le La Des Du De Un Une Cette Ce Ces Il Elle Ils Elles Dans Pour Avec Sans Selon Sur
Par Mais Donc Or Ni Car Apres Avant Depuis Entre Chez Lors Alors Ainsi Cependant Toutefois
Enfin Ensuite Puis Aussi Plus Moins Tres Tout Toute Tous Toutes Autre Autres Meme Quant
Lundi Mardi Mercredi Jeudi Vendredi Samedi Dimanche
Apres Meme Tres
""".split())

KNOWN_ACTORS = [
    "Algerie Telecom", "Algerie Poste", "Mobilis", "Djezzy", "Ooredoo", "Sonelgaz",
    "Sonatrach", "ARPCE", "Naftal", "Air Algerie", "Yassir", "Temtem", "BaridiMob",
    "CNAS", "CASNOS", "ANADE", "ANGEM", "CNAC", "ASAL", "CERIST", "ANPT", "Algex",
]


def _nodes_actors(data, text, sentences, tabs, limit, used=None):
    """Les organisations et personnes reellement citees, classees par poids."""
    used = set() if used is None else used
    flat = enrich.strip_tags(text or "")
    deflat = enrich.deaccent(flat)
    counts = {}

    for name in KNOWN_ACTORS:
        hits = len(re.findall(r"\b" + re.escape(enrich.deaccent(name)) + r"\b", deflat, flags=re.I))
        if hits:
            counts[name] = counts.get(name, 0) + hits * 2

    pattern = re.compile(
        r"\b[A-ZÀ-Ý][\wÀ-ÿ'’\-]{2,}"
        r"(?:\s+(?:de|du|des|d[’']|la|le|et)\s+[A-ZÀ-Ý\wÀ-ÿ'’\-]{2,}"
        r"|\s+[A-ZÀ-Ý][\wÀ-ÿ'’\-]{2,}){0,2}"
    )
    for match in pattern.finditer(flat):
        raw = match.group(0).strip(" ,;:.")
        head = enrich.deaccent(raw.split(" ")[0])
        if head in ACTOR_NOISE or head.lower() in MONTH_WORDS:
            continue
        if len(raw) < 4:
            continue
        if enrich.deaccent(raw).lower() in enrich.STOPWORDS:
            continue
        # Un mot isole qui apparait aussi en minuscules dans l'article est un mot
        # ordinaire place en debut de phrase, pas un nom propre.
        if " " not in raw and not raw.isupper():
            if re.search(r"\b" + re.escape(enrich.deaccent(raw).lower()) + r"\b", deflat):
                continue
        counts[raw] = counts.get(raw, 0) + 1

    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], -len(kv[0])))
    nodes, seen = [], []
    for name, score in ranked:
        if score < 2 and name not in KNOWN_ACTORS:
            continue
        flat_name = enrich.deaccent(name).lower()
        if any(flat_name in s or s in flat_name for s in seen):
            continue
        target = locate_passage(name, sentences, tabs, used)
        if not target:
            continue
        _remember(target, used)
        seen.append(flat_name)
        nodes.append({
            "value": "",
            "label": _fit(name, 32),
            "sub": "%d mention%s" % (score, "s" if score > 1 else ""),
            "target": target,
            "art": name,
        })
        if len(nodes) >= limit:
            break
    return nodes



def _nodes_compare(data, text, sentences, tabs, limit, used=None):
    used = set() if used is None else used
    comparator = data.get("comparator") or {}
    nodes = []
    for row in (comparator.get("rows") or []):
        label = _fit(row.get("label"), 30)
        if not label:
            continue
        best = row.get("best")
        value = _fit(row.get("a") if best != "b" else row.get("b"), 16)
        target = (locate_passage(value, sentences, tabs, used)
                  or locate_passage(label, sentences, tabs, used))
        if not target:
            continue
        _remember(target, used)
        nodes.append({
            "value": value,
            "label": label,
            "sub": "",
            "target": target,
            "art": label,
            "extra": {
                "a": _fit(row.get("a"), 16),
                "b": _fit(row.get("b"), 16),
                "best": best,
                "head_a": _fit(comparator.get("a") or comparator.get("head_a") or "A", 18),
                "head_b": _fit(comparator.get("b") or comparator.get("head_b") or "B", 18),
            },
        })
        if len(nodes) >= limit:
            break
    return nodes


def _nodes_map(data, text, sentences, tabs, limit, used=None):
    used = set() if used is None else used
    geo = data.get("geo") or {}
    wilaya = geo.get("wilaya")
    if not wilaya:
        return []
    label = enrich.DISPLAY_NAMES.get(wilaya, wilaya)
    target = (locate_passage(label, sentences, tabs, used)
              or locate_passage(wilaya, sentences, tabs, used))
    if not target:
        return []
    _remember(target, used)
    nodes = [{
        "value": "", "label": label, "sub": _fit(geo.get("note"), 70),
        "target": target, "art": label, "role": "map", "wilaya": wilaya,
    }]
    nodes.extend(_nodes_figures(data, text, sentences, tabs, max(0, limit - 1), used))
    return nodes


LAYOUTS = {
    "figures": {"label": "Chiffres clés", "min": 2, "max": 6, "builder": _nodes_figures, "rank": 6},
    "timeline": {"label": "Frise", "min": 2, "max": 5, "builder": _nodes_timeline, "rank": 5},
    "compare": {"label": "Comparaison", "min": 2, "max": 5, "builder": _nodes_compare, "rank": 4},
    "actors": {"label": "Acteurs", "min": 3, "max": 6, "builder": _nodes_actors, "rank": 3},
    "map": {"label": "Carte", "min": 2, "max": 4, "builder": _nodes_map, "rank": 2},
}


def build_nodes(kind, data, text, sentences, tabs, count=None):
    spec = LAYOUTS.get(kind)
    if not spec:
        return []
    limit = min(int(count or spec["max"]), spec["max"], MAX_NODES)
    # On demande large, puis on écarte les doublons : deux zones qui ouvrent la
    # même phrase n'apprennent rien au lecteur.
    raw = spec["builder"](data, text, sentences, tabs, min(spec["max"] + 3, MAX_NODES + 3))
    nodes, seen, labels = [], set(), set()
    for node in raw:
        key = (node["target"].get("sentence") or "").strip().lower()
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        # Deux zones portant le meme intitule se lisent comme un bug d'affichage.
        # La phrase visee, elle, est unique : on s'en sert pour les distinguer.
        label = (node.get("label") or "").strip().lower()
        if label and label in labels:
            node["label"] = _fit(node["target"].get("sentence") or node.get("label"), 56)
        labels.add((node.get("label") or "").strip().lower())
        nodes.append(node)
        if len(nodes) >= limit:
            break
    return nodes if len(nodes) >= spec["min"] else []


def available_layouts(data, text=""):
    """Ce que l'article permet reellement de dessiner, du plus riche au moins riche."""
    tabs = [t for t in (data.get("tabs") or []) if isinstance(t, dict)]
    sentences = _sentences_of(text or _corpus(data))
    out = []
    for kind, spec in LAYOUTS.items():
        nodes = build_nodes(kind, data, text, sentences, tabs)
        # Une mise en page qui n'offre que deux zones reste maigre : elle passe
        # derriere une mise en page moins noble mais mieux fournie.
        score = spec["rank"] + (0 if len(nodes) >= 3 else -4)
        out.append({
            "id": kind,
            "label": spec["label"],
            "count": len(nodes),
            "ready": bool(nodes),
            "rank": spec["rank"],
            "score": score,
        })
    out.sort(key=lambda item: (not item["ready"], -item["score"], -item["rank"]))
    return out


def _corpus(data):
    chunks = [enrich.strip_tags(data.get("title", "")), enrich.strip_tags(data.get("chapeau", ""))]
    for tab in (data.get("tabs") or []):
        chunks.append(enrich.strip_tags(tab.get("content", "")))
    chunks.append(enrich.strip_tags((data.get("closing") or {}).get("text", "")))
    return "\n".join(c for c in chunks if c)


# ------------------------------------------------------------- mises en page
def _place_grid(nodes, W, H, top):
    count = len(nodes)
    cols = 2 if count <= 4 else 3
    rows = -(-count // cols)
    pad, gap = 54, 24
    box_w = (W - 2 * pad - (cols - 1) * gap) / cols
    box_h = min(190.0, (H - top - pad - (rows - 1) * gap) / rows)
    for index, node in enumerate(nodes):
        row, col = divmod(index, cols)
        in_row = min(cols, count - row * cols)
        offset = pad + (cols - in_row) * (box_w + gap) / 2.0
        node["x"] = offset + col * (box_w + gap)
        node["y"] = top + row * (box_h + gap)
        node["w"] = box_w
        node["h"] = box_h
        node["shape"] = "rounded"
    return nodes


def _place_timeline(nodes, W, H, top):
    count = len(nodes)
    pad = 60
    span = (W - 2 * pad) / float(count)
    box_w = min(210.0, span - 16)
    axis = top + 60
    for index, node in enumerate(nodes):
        centre = pad + span * (index + 0.5)
        node["cx"] = centre
        node["axis"] = axis
        node["x"] = centre - box_w / 2.0
        node["y"] = axis + 42
        node["w"] = box_w
        node["h"] = H - (axis + 42) - 54
        node["shape"] = "rounded"
    return nodes


def _place_hub(nodes, W, H, top):
    import math
    satellites = nodes[1:] if len(nodes) > 3 else nodes
    hub = nodes[0] if len(nodes) > 3 else None
    cx, cy = W / 2.0, top + (H - top) / 2.0 - 10
    box_w, box_h = 214.0, 96.0
    if hub:
        hub["x"] = cx - 118
        hub["y"] = cy - 62
        hub["w"] = 236.0
        hub["h"] = 124.0
        hub["shape"] = "circle"
        hub["role"] = "hub"
    count = len(satellites)
    radius_x, radius_y = (W / 2.0) - box_w / 2.0 - 46, (H - top) / 2.0 - box_h / 2.0 - 18
    for index, node in enumerate(satellites):
        angle = -math.pi / 2 + 2 * math.pi * index / float(count)
        px = cx + radius_x * math.cos(angle)
        py = cy + radius_y * math.sin(angle)
        node["x"] = px - box_w / 2.0
        node["y"] = py - box_h / 2.0
        node["w"] = box_w
        node["h"] = box_h
        node["shape"] = "pill"
        node["link"] = (cx, cy)
    return nodes



def _place_compare(nodes, W, H, top):
    count = len(nodes)
    pad = 60
    row_h = min(84.0, (H - top - 64) / float(count))
    for index, node in enumerate(nodes):
        node["x"] = pad
        node["y"] = top + index * (row_h + 8)
        node["w"] = W - 2 * pad
        node["h"] = row_h
        node["shape"] = "row"
    return nodes


def _place_map(nodes, W, H, top):
    map_node = nodes[0]
    map_node["x"] = 46.0
    map_node["y"] = top
    map_node["w"] = 520.0
    map_node["h"] = H - top - 48
    map_node["shape"] = "map"
    rest = nodes[1:]
    if rest:
        pad = 24
        box_h = min(120.0, (H - top - 48 - (len(rest) - 1) * pad) / len(rest))
        for index, node in enumerate(rest):
            node["x"] = 606.0
            node["y"] = top + index * (box_h + pad)
            node["w"] = W - 606.0 - 46
            node["h"] = box_h
            node["shape"] = "rounded"
    return nodes


PLACERS = {
    "figures": _place_grid,
    "timeline": _place_timeline,
    "actors": _place_hub,
    "compare": _place_compare,
    "map": _place_map,
}


# ------------------------------------------------------------------ peinture
def _frame(W, H, theme, title, kicker):
    """Fond, degrade et titre : identiques en mode A et en mode B."""
    parts = [
        '<defs>',
        '<linearGradient id="avBg" x1="0" y1="0" x2="0.6" y2="1">',
        '<stop offset="0" stop-color="%s"/>' % _esc(theme["mid"]),
        '<stop offset="1" stop-color="%s"/>' % _esc(theme["deep"]),
        '</linearGradient>',
        '<linearGradient id="avAcc" x1="0" y1="0" x2="1" y2="0">',
        '<stop offset="0" stop-color="%s"/>' % _esc(theme["accent"]),
        '<stop offset="1" stop-color="%s"/>' % _esc(_mix(theme["accent"], "#ffffff", 0.35)),
        '</linearGradient>',
        '<pattern id="avGrid" width="46" height="46" patternUnits="userSpaceOnUse">',
        '<path d="M46 0H0V46" fill="none" stroke="%s" stroke-width="1"/>' % _rgba(theme["ink"], 0.05),
        '</pattern>',
        '</defs>',
        '<rect width="%d" height="%d" rx="26" fill="url(#avBg)"/>' % (W, H),
        '<rect width="%d" height="%d" rx="26" fill="url(#avGrid)"/>' % (W, H),
        '<circle cx="%d" cy="-40" r="200" fill="%s"/>' % (W - 90, _rgba(theme["accent"], 0.10)),
    ]
    if kicker:
        parts.append(
            '<text x="54" y="58" font-size="17" font-weight="700" letter-spacing="2.6" '
            'fill="%s">%s</text>' % (_esc(theme["accent"]), _esc(kicker.upper()))
        )
    if title:
        for index, line in enumerate(_wrap(title, 52, 2)):
            parts.append(
                '<text x="54" y="%d" font-size="34" font-weight="800" fill="%s">%s</text>'
                % (100 + index * 40, _esc(theme["ink"]), _esc(line))
            )
    return parts


def _node_art(node, theme, style):
    """La vignette d'un noeud : forme vectorielle (A) ou image generee (B)."""
    x, y, w, h = node["x"], node["y"], node["w"], node["h"]
    box = min(w * 0.42, h * 0.52, 96.0)
    cx = x + w / 2.0
    if node.get("shape") in ("pill", "circle"):
        art_x, art_y = x + 16, y + (h - box) / 2.0
    else:
        art_x, art_y = cx - box / 2.0, y + 16

    if style == "layers" and node.get("image"):
        clip = "avClip%s" % node["id"]
        radius = box / 2.0 if node.get("shape") in ("pill", "circle") else 20
        return (
            '<clipPath id="%s"><rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f"/></clipPath>'
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s"/>'
            '<image href="%s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" '
            'preserveAspectRatio="xMidYMid slice" clip-path="url(#%s)"/>'
            % (clip, art_x, art_y, box, box, radius,
               art_x, art_y, box, box, radius, _rgba(theme["ink"], 0.08),
               node["image"], art_x, art_y, box, box, clip)
        ), (art_x, art_y, box)
    return "", (art_x, art_y, box)


def _paint_nodes(nodes, theme, style, kind):
    parts = []
    ink, accent = theme["ink"], theme["accent"]

    # Les liens du schema d'acteurs passent sous les cartes
    for node in nodes:
        if node.get("link"):
            lx, ly = node["link"]
            parts.append(
                '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2" '
                'stroke-dasharray="6 7"/>'
                % (lx, ly, node["x"] + node["w"] / 2.0, node["y"] + node["h"] / 2.0,
                   _rgba(accent, 0.45))
            )

    for node in nodes:
        x, y, w, h = node["x"], node["y"], node["w"], node["h"]
        shape = node.get("shape", "rounded")
        is_hub = node.get("role") == "hub"
        radius = h / 2.0 if shape in ("pill", "circle") else 20

        if shape != "map":
            parts.append(
                '<rect id="avbox-%s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" '
                'fill="%s" stroke="%s" stroke-width="%s"/>'
                % (node["id"], x, y, w, h, radius,
                   _rgba(accent, 0.16) if is_hub else _rgba(ink, 0.07),
                   _rgba(accent, 0.75) if is_hub else _rgba(ink, 0.16),
                   "2.4" if is_hub else "1.4")
            )

        art_markup, (art_x, art_y, art_box) = _node_art(node, theme, style)
        has_art = bool(art_markup)
        parts.append(art_markup)

        if kind == "compare":
            extra = node.get("extra") or {}
            parts.append(
                '<text x="%.1f" y="%.1f" font-size="17" font-weight="700" fill="%s">%s</text>'
                % (x + 22, y + h / 2.0 + 6, _esc(ink), _esc(node["label"]))
            )
            for offset, key in ((0.52, "a"), (0.78, "b")):
                best = (extra.get("best") == key)
                parts.append(
                    '<rect x="%.1f" y="%.1f" width="150" height="%.1f" rx="12" fill="%s"/>'
                    '<text x="%.1f" y="%.1f" font-size="16" font-weight="%s" fill="%s" '
                    'text-anchor="middle">%s</text>'
                    % (x + w * offset, y + 8, max(24.0, h - 16),
                       _rgba(accent, 0.85) if best else _rgba(ink, 0.10),
                       x + w * offset + 75, y + h / 2.0 + 6,
                       "800" if best else "600",
                       _esc(theme["on_accent"] if best else ink),
                       _esc(extra.get(key) or ""))
                )
            continue

        text_y = (art_y + art_box + 34) if has_art else (y + 46)
        centre = x + w / 2.0
        anchor = "middle"
        text_x = centre
        if shape in ("pill", "circle") and not is_hub:
            anchor = "start"
            text_x = x + (art_box + 30 if has_art else 24)
            text_y = y + h / 2.0 - (6 if node.get("sub") else -6)

        if node.get("value"):
            size = 40 if kind == "figures" else (26 if kind == "timeline" else 22)
            parts.append(
                '<text x="%.1f" y="%.1f" font-size="%d" font-weight="800" fill="%s" '
                'text-anchor="%s">%s</text>'
                % (text_x, text_y if has_art else y + (58 if kind == "figures" else 46),
                   size, _esc(accent), anchor, _esc(node["value"]))
            )
            text_y = (text_y if has_art else y + (58 if kind == "figures" else 46)) + size * 0.78

        for index, line in enumerate(_wrap(node.get("label"), 26 if w < 260 else 34, 2)):
            parts.append(
                '<text x="%.1f" y="%.1f" font-size="17" font-weight="700" fill="%s" '
                'text-anchor="%s">%s</text>'
                % (text_x, text_y + index * 21, _esc(ink), anchor, _esc(line))
            )
        if node.get("sub"):
            base = text_y + 21 * max(1, len(_wrap(node.get("label"), 26 if w < 260 else 34, 2)))
            for index, line in enumerate(_wrap(node["sub"], 30 if w < 260 else 42, 2)):
                if base + index * 17 > y + h - 10:
                    break
                parts.append(
                    '<text x="%.1f" y="%.1f" font-size="13" fill="%s" text-anchor="%s">%s</text>'
                    % (text_x, base + index * 17, _rgba(ink, 0.66), anchor, _esc(line))
                )

        if node.get("arrow"):
            ax = x + w + 8
            ay = y + h / 2.0
            parts.append(
                '<path d="M%.1f %.1f h12 m-4 -5 l5 5 l-5 5" fill="none" stroke="%s" '
                'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
                % (ax, ay, _esc(accent))
            )
    return parts


def _paint_timeline_axis(nodes, theme):
    if not nodes:
        return []
    axis = nodes[0]["axis"]
    first, last = nodes[0]["cx"], nodes[-1]["cx"]
    parts = [
        '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="3" '
        'stroke-linecap="round"/>' % (first, axis, last, axis, _rgba(theme["ink"], 0.22))
    ]
    for node in nodes:
        parts.append(
            '<circle cx="%.1f" cy="%.1f" r="9" fill="%s"/>'
            '<circle cx="%.1f" cy="%.1f" r="4" fill="%s"/>'
            % (node["cx"], axis, _esc(theme["accent"]), node["cx"], axis, _esc(theme["deep"]))
        )
    return parts


def _paint_map_node(node, theme):
    svg = enrich.build_map_svg(node.get("wilaya") or node.get("label"))
    if not svg:
        return []
    inner = re.sub(r"^<svg[^>]*>", "", svg)
    inner = re.sub(r"</svg>\s*$", "", inner)
    view = re.search(r'viewBox="([^"]+)"', svg)
    return [
        '<svg x="%.1f" y="%.1f" width="%.1f" height="%.1f" viewBox="%s" '
        'preserveAspectRatio="xMidYMid meet" class="av-map">%s</svg>'
        % (node["x"], node["y"], node["w"], node["h"],
           _esc(view.group(1) if view else "0 0 1000 700"), inner)
    ]


def paint(nodes, kind, theme, style, W, H, title, kicker):
    parts = ['<svg viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" '
             'role="img" aria-label="%s">' % (W, H, _esc(title or "Visuel de l'article"))]
    parts.extend(_frame(W, H, theme, title, kicker))
    if kind == "timeline":
        parts.extend(_paint_timeline_axis(nodes, theme))
    if kind == "map" and nodes:
        parts.extend(_paint_map_node(nodes[0], theme))
        parts.extend(_paint_nodes(nodes[1:], theme, style, kind))
    else:
        parts.extend(_paint_nodes(nodes, theme, style, kind))
    parts.append("</svg>")
    return "".join(parts)


# ------------------------------------------- option B : illustrations generees
IMAGE_PROMPT = (
    "Flat vector editorial illustration, minimal, clean geometric shapes, soft shadows, "
    "centered composition, no text, no letters, no numbers, no logo, no watermark. "
    "Subject: {subject}. Context: {context}. Color palette: {primary} and {accent}."
)


def _api_error(label, response):
    """Le message du fournisseur, sans le JSON brut autour."""
    detail = response.text[:400]
    try:
        payload = response.json()
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict) and error.get("message"):
            detail = error["message"]
        elif isinstance(error, str):
            detail = error
    except ValueError:
        pass
    return RuntimeError("%s (%s) : %s" % (label, response.status_code,
                                          re.sub(r"\s+", " ", detail).strip()[:200]))


try:
    from PIL import Image
except ImportError:  # la reduction est un confort, pas une dependance dure
    Image = None

ART_SIDE = int(os.environ.get("VISUAL_ART_SIDE", "384"))


def _shrink(data_uri, side=None, force=False):
    """Ramene une illustration a la taille ou elle sera reellement affichee.

    Un modele rend du 1024x1024 (~250 ko) pour une vignette de moins de 200 px :
    embarquer ca tel quel dans l'article pese pres d'un megaoctet pour quatre
    zones. On redescend a `ART_SIDE`, ce qui divise le poids par dix sans que
    l'oeil y perde quoi que ce soit.
    """
    target = int(side or ART_SIDE)
    if Image is None or not data_uri.startswith("data:image/"):
        return data_uri
    try:
        head, _, payload = data_uri.partition(",")
        raw = base64.b64decode(payload)
        image = Image.open(io.BytesIO(raw))
        # `force` : une capture PNG deja petite pese quand meme trois fois son
        # equivalent JPEG une fois embarquee en base64.
        if max(image.size) <= target and not force:
            return data_uri
        has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
        image.thumbnail((target, target), Image.LANCZOS)
        buffer = io.BytesIO()
        if has_alpha:
            image.convert("RGBA").save(buffer, format="PNG", optimize=True)
            mime = "image/png"
        else:
            image.convert("RGB").save(buffer, format="JPEG", quality=82, optimize=True)
            mime = "image/jpeg"
        shrunk = "data:%s;base64,%s" % (
            mime, base64.b64encode(buffer.getvalue()).decode("ascii"))
        return shrunk if len(shrunk) < len(data_uri) else data_uri
    except Exception:
        # Une image illisible par Pillow reste utilisable telle quelle par le navigateur
        return data_uri


def _cache_path(key):
    return os.path.join(CACHE_DIR, key + ".txt")


def _cached(key):
    path = _cache_path(key)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as handle:
                return handle.read()
        except OSError:
            return None
    return None


def _store(key, data_uri):
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(_cache_path(key), "w", encoding="utf-8") as handle:
            handle.write(data_uri)
    except OSError:
        pass


def _openai_image(prompt, api_key, size="1024x1024"):
    response = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": "Bearer %s" % api_key, "Content-Type": "application/json"},
        json={
            "model": os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1"),
            "prompt": prompt,
            "size": size,
            "n": 1,
            "quality": os.environ.get("OPENAI_IMAGE_QUALITY", "low"),
            "background": "transparent",
            "output_format": "png",
        },
        timeout=120,
    )
    if response.status_code != 200:
        raise _api_error("OpenAI images", response)
    payload = response.json()["data"][0]
    if payload.get("b64_json"):
        return "data:image/png;base64," + payload["b64_json"]
    raw = requests.get(payload["url"], timeout=60).content
    return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")


def _gemini_image(prompt, api_key, size="1024x1024"):
    model = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s"
        % (model, api_key),
        headers={"Content-Type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=120,
    )
    if response.status_code != 200:
        raise _api_error("Gemini images", response)
    for candidate in response.json().get("candidates") or []:
        for part in (candidate.get("content") or {}).get("parts") or []:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return "data:%s;base64,%s" % (mime, inline["data"])
    raise RuntimeError("Gemini images : aucune image dans la reponse")


def _local_image(prompt, endpoint, size="1024x1024"):
    """Serveur d'images local compatible Automatic1111 / Forge (`/sdapi/v1/txt2img`).

    Renseigner ``LOCAL_IMAGE_URL`` dans le .env, par exemple
    ``http://127.0.0.1:7860``. Aucun quota, aucune cle : l'option B tourne alors
    entierement sur la machine.
    """
    base = endpoint.rstrip("/")
    if not base.endswith("/sdapi/v1/txt2img"):
        base += "/sdapi/v1/txt2img"
    side = int(str(size).split("x")[0])
    response = requests.post(
        base,
        json={
            "prompt": prompt,
            "negative_prompt": "text, letters, numbers, watermark, logo, signature, blurry",
            "width": side, "height": side,
            "steps": int(os.environ.get("LOCAL_IMAGE_STEPS", "20")),
            "cfg_scale": 6.0,
            "sampler_name": os.environ.get("LOCAL_IMAGE_SAMPLER", "DPM++ 2M"),
        },
        timeout=300,
    )
    if response.status_code != 200:
        raise _api_error("Serveur local", response)
    images = response.json().get("images") or []
    if not images:
        raise RuntimeError("Serveur local : aucune image dans la reponse")
    return "data:image/png;base64," + images[0]


def _binary_image(response, label):
    """Une reponse qui porte l'image en octets bruts plutot qu'en base64."""
    mime = (response.headers.get("Content-Type") or "image/png").split(";")[0].strip()
    if not mime.startswith("image/"):
        raise _api_error(label, response)
    return "data:%s;base64,%s" % (mime, base64.b64encode(response.content).decode("ascii"))


def _cloudflare_image(prompt, api_token, size="1024x1024"):
    """Workers AI. Demande l'identifiant de compte en plus du jeton."""
    account = (os.environ.get("CLOUDFLARE_ACCOUNT_ID") or "").strip()
    if not account:
        raise RuntimeError("Cloudflare : CLOUDFLARE_ACCOUNT_ID manquant dans le .env")
    model = os.environ.get("CLOUDFLARE_IMAGE_MODEL", "@cf/black-forest-labs/flux-1-schnell")
    response = requests.post(
        "https://api.cloudflare.com/client/v4/accounts/%s/ai/run/%s" % (account, model),
        headers={"Authorization": "Bearer %s" % api_token, "Content-Type": "application/json"},
        json={"prompt": prompt, "steps": int(os.environ.get("CLOUDFLARE_IMAGE_STEPS", "4"))},
        timeout=180,
    )
    if response.status_code != 200:
        raise _api_error("Cloudflare Workers AI", response)
    # flux-1-schnell renvoie du JSON base64 ; les modeles SDXL renvoient l'image brute.
    if "json" in (response.headers.get("Content-Type") or ""):
        payload = response.json()
        if not payload.get("success", True):
            raise _api_error("Cloudflare Workers AI", response)
        image = (payload.get("result") or {}).get("image")
        if not image:
            raise RuntimeError("Cloudflare Workers AI : aucune image dans la reponse")
        return "data:image/jpeg;base64," + image
    return _binary_image(response, "Cloudflare Workers AI")


def _together_image(prompt, api_key, size="1024x1024"):
    width, _, height = str(size).partition("x")
    response = requests.post(
        "https://api.together.xyz/v1/images/generations",
        headers={"Authorization": "Bearer %s" % api_key, "Content-Type": "application/json"},
        json={
            "model": os.environ.get("TOGETHER_IMAGE_MODEL",
                                    "black-forest-labs/FLUX.1-schnell-Free"),
            "prompt": prompt,
            "width": int(width), "height": int(height or width),
            "steps": int(os.environ.get("TOGETHER_IMAGE_STEPS", "4")),
            "n": 1,
            "response_format": "b64_json",
        },
        timeout=180,
    )
    if response.status_code != 200:
        raise _api_error("Together AI", response)
    items = response.json().get("data") or []
    if not items:
        raise RuntimeError("Together AI : aucune image dans la reponse")
    if items[0].get("b64_json"):
        return "data:image/png;base64," + items[0]["b64_json"]
    raw = requests.get(items[0]["url"], timeout=90)
    return _binary_image(raw, "Together AI")


def _pollinations_image(prompt, token, size="1024x1024"):
    """Sans compte obligatoire ; le jeton retire le filigrane et releve les limites."""
    width, _, height = str(size).partition("x")
    headers = {}
    if token and token != "public":
        headers["Authorization"] = "Bearer %s" % token
    response = requests.get(
        "https://image.pollinations.ai/prompt/" + requests.utils.quote(prompt[:1500], safe=""),
        params={
            "width": int(width), "height": int(height or width),
            "model": os.environ.get("POLLINATIONS_MODEL", "flux"),
            "nologo": "true", "private": "true", "referrer": "algeria-tech",
        },
        headers=headers,
        timeout=180,
    )
    if response.status_code != 200:
        raise _api_error("Pollinations", response)
    return _binary_image(response, "Pollinations")


def _huggingface_image(prompt, token, size="1024x1024"):
    model = os.environ.get("HF_IMAGE_MODEL", "black-forest-labs/FLUX.1-schnell")
    endpoints = [
        "https://router.huggingface.co/hf-inference/models/" + model,
        "https://api-inference.huggingface.co/models/" + model,
    ]
    last, failure = None, None
    for url in endpoints:
        try:
            response = requests.post(
                url,
                headers={"Authorization": "Bearer %s" % token, "Content-Type": "application/json"},
                json={"inputs": prompt},
                timeout=180,
            )
        except requests.RequestException as exc:
            # Un hote injoignable ne doit pas masquer la reponse de l'autre.
            failure = exc
            continue
        if response.status_code == 200:
            return _binary_image(response, "Hugging Face")
        last = response
    if last is not None:
        raise _api_error("Hugging Face", last)
    raise RuntimeError("Hugging Face : injoignable (%s)" % str(failure)[:150])


# Ordre d'essai : le gratuit et l'illimite d'abord, le facture en dernier.
IMAGE_PROVIDERS = [
    ("local", "LOCAL_IMAGE_URL", _local_image),
    ("cloudflare", "CLOUDFLARE_API_TOKEN", _cloudflare_image),
    ("together", "TOGETHER_API_KEY", _together_image),
    ("pollinations", "POLLINATIONS_TOKEN", _pollinations_image),
    ("huggingface", "HF_TOKEN", _huggingface_image),
    ("gemini2", "GEMINI_API_KEY_2", _gemini_image),
    ("gemini", "GEMINI_API_KEY", _gemini_image),
    ("openai", "OPENAI_API_KEY", _openai_image),
]
PLACEHOLDER_KEYS = {"", "VOTRE_CLE_OPENAI_ICI", "VOTRE_CLE_GEMINI_ICI"}


def image_providers_ready():
    """Les fournisseurs d'images utilisables. Le serveur local passe en premier :
    il ne coute rien et ne depend d'aucun quota."""
    return [name for name, env, _ in IMAGE_PROVIDERS
            if (os.environ.get(env) or "").strip() not in PLACEHOLDER_KEYS]


def generate_node_images(nodes, theme, context, forced=None):
    """Une illustration par noeud. Renvoie (fournisseur, avertissement)."""
    ready = image_providers_ready()
    if forced:
        ready = [p for p in ready if p == forced] or ready
    if not ready:
        return None, ("Aucune cle d'image configuree (OPENAI_API_KEY ou GEMINI_API_KEY) : "
                      "le visuel reste en infographie vectorielle.")

    errors = []

    def run(node):
        prompt = IMAGE_PROMPT.format(
            subject=node.get("art") or node.get("label") or "abstract concept",
            context=_fit(context, 180) or "Algerian technology news",
            primary=theme["primary"], accent=theme["accent"],
        )
        for name in ready:
            env = dict((n, e) for n, e, _ in IMAGE_PROVIDERS)[name]
            func = dict((n, f) for n, _, f in IMAGE_PROVIDERS)[name]
            key = hashlib.sha1(("%s|%s" % (name, prompt)).encode("utf-8")).hexdigest()
            hit = _cached(key)
            if hit:
                node["image"] = hit
                return name
            try:
                data_uri = func(prompt, os.environ.get(env, "").strip())
            except Exception as exc:  # une panne de fournisseur ne doit pas tout arreter
                errors.append(str(exc))
                continue
            data_uri = _shrink(data_uri)
            _store(key, data_uri)
            node["image"] = data_uri
            return name
        return None

    with ThreadPoolExecutor(max_workers=3) as pool:
        used = [name for name in pool.map(run, nodes) if name]

    if not used:
        detail = re.sub(r"\s+", " ", errors[0]) if errors else "cause inconnue"
        return None, ("Illustrations indisponibles, le visuel reste en infographie "
                      "vectorielle. Motif : %s" % detail[:150])
    missing = [n for n in nodes if not n.get("image")]
    warning = ""
    if missing:
        warning = ("%d element(s) sur %d n'ont pas d'illustration : ils gardent leur "
                   "rendu vectoriel." % (len(missing), len(nodes)))
    return used[0], warning


# ------------------------- option C : zones posees sur la photo de l'article
#
# Ici, contrairement aux options A et B, la mise en page ne vient pas de nous :
# l'image existe deja. Il faut donc *decouvrir* ou sont ses elements. C'est un
# modele de vision qui les cadre, et chaque cadre n'est retenu que s'il mene a
# un passage reel du texte.

VISION_PROMPT = (
    "Tu analyses l'illustration d'un article de presse dont voici le sujet : {context}\n"
    "Repere les elements visuels distincts et lisibles : chiffres affiches, logos, "
    "icones, blocs de texte, objets marquants.\n"
    "Reponds en JSON strict, sans commentaire :\n"
    '{{"regions":[{{"label":"nom court de l\'element","text":"le texte exact lu dans '
    'l\'element, ou une chaine vide","box_2d":[ymin,xmin,ymax,xmax]}}]}}\n'
    "Le champ \"label\" doit etre en francais, en toutes lettres, avec de vrais "
    "espaces entre les mots (exemple : \"Logo YouTube\", \"Compteur ancien systeme\"). "
    "Jamais d'identifiant technique du genre titre_principal ou valeurGauche.\n"
    "Les coordonnees sont normalisees entre 0 et 1000, dans l'ordre "
    "[haut, gauche, bas, droite]. Maximum {limit} regions, les plus saillantes. "
    "N'invente aucun element qui ne serait pas visible."
)

VISION_KEYS = ["GEMINI_API_KEY", "GEMINI_API_KEY_2"]
# Plusieurs modeles : un « flash » sature repond 503, et l'attente ne sert a rien
# quand un modele voisin est libre.
VISION_MODELS = [
    os.environ.get("VISION_MODEL", "gemini-flash-latest"),
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-flash-lite-latest",
]

# Mots qui decrivent le contenant, pas le contenu : ils n'aident pas a retrouver
# le passage vise dans l'article.
LABEL_NOISE = re.compile(
    r"^(?:le |la |les |l'|un |une |des )?"
    r"(?:logo|icone|icône|ic[oô]nes|image|photo|illustration|visuel|bloc|encadre|encadré|"
    r"cadre|texte|titre|sous-titre|libelle|libellé|legende|légende|compteur|compteurs|"
    r"graphique|courbe|panneau|bouton|badge|zone|section|colonne|partie)\s*"
    r"(?:de |du |des |d'|:|-|–|—)?\s*",
    re.I,
)


def _image_bytes(url, hub_url=None):
    """Recupere l'image, qu'elle soit sur le disque, servie localement ou en ligne."""
    raw = str(url or "").strip()
    if not raw:
        return None, None
    if raw.startswith("data:image/"):
        head, _, payload = raw.partition(",")
        return base64.b64decode(payload), head[5:].split(";")[0]

    path = None
    if raw.startswith("/api/serve-local"):
        query = raw.partition("?")[2]
        for part in query.split("&"):
            if part.startswith("path="):
                path = requests.utils.unquote(part[5:])
                break
    elif re.match(r"^[A-Za-z]:[\\/]", raw) or raw.startswith("\\\\"):
        path = raw
    elif raw.startswith("/") and not raw.startswith("//"):
        # Chemin absolu du site : on le cherche a la racine d'Algeria Tech
        candidate = os.path.join(enrich.SITE_ROOT, raw.lstrip("/").replace("/", os.sep))
        if os.path.exists(candidate):
            path = candidate
        elif hub_url:
            raw = hub_url.rstrip("/") + raw

    if path:
        if not os.path.exists(path):
            raise RuntimeError("Image introuvable sur le disque : %s" % path[:120])
        with open(path, "rb") as handle:
            data = handle.read()
        ext = os.path.splitext(path)[1].lower().lstrip(".") or "png"
        return data, "image/" + ("jpeg" if ext in ("jpg", "jpeg") else ext)

    if not raw.lower().startswith("http"):
        raise RuntimeError("Adresse d'image incomprise : %s" % raw[:120])
    response = requests.get(raw, timeout=60)
    if response.status_code != 200:
        raise _api_error("Telechargement de l'image", response)
    mime = (response.headers.get("Content-Type") or "image/png").split(";")[0].strip()
    return response.content, mime


def _prepare_for_vision(data, mime):
    """Un modele de vision n'a pas besoin de 4000 px : on allege l'envoi."""
    if Image is None:
        return data, mime
    try:
        image = Image.open(io.BytesIO(data))
        size = image.size
        if max(size) > 1024:
            image.thumbnail((1024, 1024), Image.LANCZOS)
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="JPEG", quality=88)
        return buffer.getvalue(), "image/jpeg", size
    except Exception:
        return data, mime, None


def _gemini_regions(payload, mime, prompt, key, model):
    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s"
        % (model, key),
        json={
            "contents": [{"parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime, "data":
                                 base64.b64encode(payload).decode("ascii")}},
            ]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1},
        },
        timeout=120,
    )
    if response.status_code != 200:
        raise _api_error("Gemini vision", response)
    text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text).get("regions") or []


def detect_regions(image_url, context="", limit=8, hub_url=None):
    """Cadre les elements de l'image. Renvoie (regions, dimensions, fournisseur)."""
    raw, mime = _image_bytes(image_url, hub_url)
    if not raw:
        raise RuntimeError("Aucune image a analyser")
    prepared = _prepare_for_vision(raw, mime)
    payload, send_mime = prepared[0], prepared[1]
    size = prepared[2] if len(prepared) > 2 else None

    prompt = VISION_PROMPT.format(context=_fit(context, 220) or "actualite technologique",
                                  limit=limit)

    # Reanalyser la meme image avec la meme consigne donnerait le meme cadrage :
    # autant ne pas repayer l'appel a chaque essai de mise en page.
    cache_key = "vision-" + hashlib.sha1(
        hashlib.sha1(payload).hexdigest().encode() + prompt.encode("utf-8")).hexdigest()
    hit = _cached(cache_key)
    if hit:
        try:
            saved = json.loads(hit)
            return saved["regions"], tuple(saved["size"]) if saved.get("size") else None,                 saved.get("provider", "cache") + " (en cache)"
        except (ValueError, KeyError):
            pass

    keys = [(env, (os.environ.get(env) or "").strip()) for env in VISION_KEYS]
    keys = [(env, key) for env, key in keys if key not in PLACEHOLDER_KEYS]
    if not keys:
        raise RuntimeError("Aucune cle Gemini pour analyser l'image")

    errors = []
    for model in VISION_MODELS:
        for env, key in keys:
            try:
                regions = _gemini_regions(payload, send_mime, prompt, key, model)
            except Exception as exc:
                errors.append("%s : %s" % (model, exc))
                continue
            if regions:
                label = "%s (%s)" % (model, "clé 2" if env.endswith("_2") else "clé 1")
                _store(cache_key, json.dumps(
                    {"regions": regions, "size": list(size) if size else None,
                     "provider": label}, ensure_ascii=False))
                return regions, size, label
    raise RuntimeError(errors[0] if errors else "Aucun modele de vision n'a repondu")


def _humanize_label(raw):
    """« valeur_gauche », « valeurGauche », « valeur-gauche » -> « Valeur gauche ».

    Les modeles rendent volontiers des identifiants techniques malgre la consigne ;
    tels quels ils seraient illisibles sur l'image.
    """
    text = str(raw or "").strip()
    if not text:
        return ""
    if " " not in text:
        text = re.sub(r"[_\-]+", " ", text)
        text = re.sub(r"(?<=[a-zà-ÿ0-9])(?=[A-ZÀ-Ý])", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1].upper() + text[1:] if text else ""


def _label_probes(region):
    """Les textes a chercher dans l'article pour ancrer une zone, du plus au moins sur."""
    label = _clean(_humanize_label(region.get("label")))
    read = _clean(region.get("text"))
    probes = []

    # Ce que le modele a lu dans l'image est le repere le plus fiable
    for candidate in (read, label):
        if not candidate:
            continue
        inside = re.findall(r"\(([^)]{2,40})\)", candidate)
        probes.extend(inside)
        probes.append(re.sub(r"\s*\([^)]*\)", "", candidate).strip())

    # Le libelle sans son mot de contenant : « Logo YouTube » -> « YouTube »
    if label:
        stripped = LABEL_NOISE.sub("", label).strip(" :-–—")
        if stripped and stripped.lower() != label.lower():
            probes.append(stripped)

    # A defaut, les mots porteurs : nombres et noms propres, les plus longs d'abord
    for candidate in (read, label):
        for token in re.findall(r"[\d][\d  .,]*\s*(?:%|M|K|Md|millions?|milliards?)?|"
                                r"[A-ZÀ-Ý][\wÀ-ÿ'’\-]{2,}", candidate or ""):
            token = token.strip()
            if len(token) >= 2:
                probes.append(token)

    seen, out = set(), []
    for probe in probes:
        probe = probe.strip(" :;,.-–—")
        key = probe.lower()
        if len(probe) < 2 or key in seen:
            continue
        seen.add(key)
        out.append(probe)
    out.sort(key=lambda p: (-len(p.split()), -len(p)))
    return out


def build_photo_visual(data, text="", limit=6, hub_url=None, image_url=None):
    """Zones cliquables posees directement sur la photo qui illustre l'article."""
    medias = data.get("medias") or {}
    url = image_url or ((medias.get("image") or {}).get("url") or "")
    if not url:
        gallery = data.get("gallery") or []
        url = (gallery[0] or {}).get("url", "") if gallery else ""
    if not url:
        return None, "Cet article n'a pas d'image principale : ajoutez-en une d'abord."

    tabs = [t for t in (data.get("tabs") or []) if isinstance(t, dict)]
    corpus = (text or "").strip() or _corpus(data)
    sentences = _sentences_of(corpus)
    context = "%s. %s" % (_clean(data.get("title")), _clean(data.get("chapeau")))

    try:
        regions, size, provider = detect_regions(url, context, limit + 3, hub_url)
    except Exception as exc:
        return None, "Analyse de l'image impossible : %s" % re.sub(r"\s+", " ", str(exc))[:170]

    used, hotspots = set(), []
    for region in regions:
        box = region.get("box_2d") or region.get("box") or []
        if len(box) != 4:
            continue
        try:
            ymin, xmin, ymax, xmax = [float(v) for v in box]
        except (TypeError, ValueError):
            continue
        if ymax <= ymin or xmax <= xmin:
            continue

        target = None
        for probe in _label_probes(region):
            found = locate_passage(probe, sentences, tabs, used)
            if not found:
                continue
            phrase = (found.get("sentence") or "").strip()
            # Ni la signature de l'article, ni une phrase deja visee par une
            # autre zone : trois cadres qui ouvrent le meme texte, c'est le
            # doublon que l'on cherche justement a eviter.
            if DATELINE.match(phrase) or phrase.lower() in used:
                continue
            target = found
            break
        if not target:
            continue
        _remember(target, used)

        label = _fit(_humanize_label(region.get("label")) or region.get("text"), 46)
        hotspots.append({
            "id": "z%d" % (len(hotspots) + 1),
            "label": label,
            "value": _fit(region.get("text"), 18),
            "x": round(max(0.0, xmin) / 10.0, 3),
            "y": round(max(0.0, ymin) / 10.0, 3),
            "w": round(min(1000.0, xmax - xmin) / 10.0, 3),
            "h": round(min(1000.0, ymax - ymin) / 10.0, 3),
            "target": target,
        })
        if len(hotspots) >= limit:
            break

    if len(hotspots) < 2:
        return None, ("L'image a bien été analysée, mais moins de deux de ses éléments "
                      "correspondent à un passage du texte. Les zones qui ne mènent nulle "
                      "part ne sont pas posées.")

    width, height = (size or (1000, 620))

    # L'image est embarquee : une adresse « /api/serve-local » ne survivrait pas
    # au telechargement de l'article en HTML autonome.
    embedded, note = url, ""
    try:
        raw, mime = _image_bytes(url, hub_url)
        embedded = _shrink("data:%s;base64,%s"
                           % (mime, base64.b64encode(raw).decode("ascii")),
                           side=int(os.environ.get("VISUAL_PHOTO_SIDE", "1100")),
                           force=True)
    except Exception as exc:
        note = ("L'image n'a pas pu etre embarquee (%s) : le visuel restera lie a son "
                "adresse d'origine." % re.sub(r"\s+", " ", str(exc))[:100])

    return {
        "kind": "photo",
        "kind_label": "Sur la photo",
        "style": "photo",
        "provider": provider,
        "image": embedded,
        "image_src": url,
        "width": width,
        "height": height,
        "title": _fit(data.get("title"), 90),
        "kicker": "Explorez l'image",
        "caption": "Survolez l'image : chaque zone encadrée ouvre le passage "
                   "correspondant de l'article.",
        "svg": "",
        "hotspots": hotspots,
        "warning": note,
    }, ""


# ------------------------------------------------------------------- assemblage
KICKERS = {
    "figures": "Les chiffres de l'article",
    "timeline": "Le fil des dates",
    "actors": "Qui fait quoi",
    "compare": "Face à face",
    "map": "Où cela se passe",
}


def build_visual(data, text="", kind="auto", style="svg", count=None,
                 title=None, provider=None):
    """Construit le visuel interactif. Renvoie ``None`` si l'article ne s'y prete pas."""
    if not isinstance(data, dict):
        return None

    # Option C : on ne dessine rien, on pose les zones sur l'image de l'article.
    if style == "photo" or kind == "photo":
        built, why = build_photo_visual(
            data, text, limit=int(count or 6),
            hub_url=os.environ.get("HUB_URL"),
        )
        if built:
            return built
        raise RuntimeError(why or "Zones sur la photo impossibles.")

    tabs = [t for t in (data.get("tabs") or []) if isinstance(t, dict)]
    corpus = text.strip() or _corpus(data)
    sentences = _sentences_of(corpus)
    theme = _theme_of(data)

    order = [kind] if kind and kind != "auto" else [
        item["id"] for item in available_layouts(data, corpus) if item["ready"]
    ]
    nodes, chosen = [], None
    for candidate in order:
        nodes = build_nodes(candidate, data, corpus, sentences, tabs, count)
        if nodes:
            chosen = candidate
            break
    if not nodes or not chosen:
        return None

    for index, node in enumerate(nodes, start=1):
        node["id"] = "z%d" % index

    W, H = W_DEFAULT, H_DEFAULT
    if chosen == "compare":
        H = max(420, 210 + len(nodes) * 92)
    top = 148
    PLACERS[chosen](nodes, W, H, top)

    warning = ""
    used_provider = "vectoriel"
    if style == "layers":
        used_provider, warning = generate_node_images(
            nodes, theme, enrich.strip_tags(data.get("chapeau") or data.get("title") or ""),
            forced=provider,
        )
        if not used_provider:
            style = "svg"
            used_provider = "vectoriel"

    heading = title or _fit(data.get("title"), 90)
    svg = paint(nodes, chosen, theme, style, W, H, heading, KICKERS.get(chosen, ""))

    hotspots = []
    for node in nodes:
        hotspots.append({
            "id": node["id"],
            "label": node.get("label") or node.get("value") or "",
            "value": node.get("value") or "",
            "x": round(node["x"] / W * 100, 3),
            "y": round(node["y"] / H * 100, 3),
            "w": round(node["w"] / W * 100, 3),
            "h": round(node["h"] / H * 100, 3),
            "target": node["target"],
        })

    return {
        "kind": chosen,
        "kind_label": LAYOUTS[chosen]["label"],
        "style": style,
        "provider": used_provider,
        "width": W,
        "height": H,
        "title": heading,
        "kicker": KICKERS.get(chosen, ""),
        "caption": "Cliquez une zone de l'image : le passage correspondant s'ouvre et "
                   "se surligne dans l'article.",
        "svg": svg,
        "hotspots": hotspots,
        "warning": warning,
    }
