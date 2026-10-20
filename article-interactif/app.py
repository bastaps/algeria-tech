import os
import re
import json
import io
import html
import unicodedata
from datetime import datetime, timezone
import requests
from flask import Flask, render_template, request, jsonify, make_response, send_file

# Resolve absolute path for template folder to prevent TemplateNotFound on local Windows/Linux machines
base_dir = os.path.dirname(os.path.abspath(__file__))
template_dir = os.path.join(base_dir, 'templates')

app = Flask(__name__, template_folder=template_dir)

# Universal video url to embeddable player url converter (YouTube, Instagram, TikTok, Facebook, Vimeo, Dailymotion)
def to_embed_url(url):
    if not url:
        return ""
    url = url.strip()
    import urllib.parse
    
    # 1. YouTube
    if 'youtube.com/watch' in url or 'youtube.com/live' in url:
        match = re.search(r'[?&]v=([^&#]+)', url)
        if match:
            return f"https://www.youtube.com/embed/{match.group(1)}"
    elif 'youtu.be/' in url:
        match = re.search(r'youtu\.be/([^?&#]+)', url)
        if match:
            return f"https://www.youtube.com/embed/{match.group(1)}"
    elif 'youtube.com/shorts/' in url:
        match = re.search(r'youtube\.com/shorts/([^?&#]+)', url)
        if match:
            return f"https://www.youtube.com/embed/{match.group(1)}"
            
    # 2. Instagram
    elif 'instagram.com/reel/' in url or 'instagram.com/p/' in url:
        match = re.search(r'instagram\.com/(reel|p)/([^/?#]+)', url)
        if match:
            path_type = match.group(1)
            media_id = match.group(2)
            return f"https://www.instagram.com/{path_type}/{media_id}/embed/"
            
    # 3. TikTok
    elif 'tiktok.com/' in url:
        match = re.search(r'video/(\d+)', url)
        if match:
            return f"https://www.tiktok.com/embed/v2/{match.group(1)}"
            
    # 4. Facebook
    elif 'facebook.com/' in url or 'fb.watch' in url:
        encoded_url = urllib.parse.quote_plus(url)
        return f"https://www.facebook.com/plugins/video.php?href={encoded_url}&show_text=0"
        
    # 5. Vimeo
    elif 'vimeo.com/' in url:
        match = re.search(r'vimeo\.com/(\d+)', url)
        if match:
            return f"https://player.vimeo.com/video/{match.group(1)}"
            
    # 6. Dailymotion
    elif 'dailymotion.com/video/' in url:
        match = re.search(r'video/([^?&#]+)', url)
        if match:
            return f"https://www.dailymotion.com/embed/video/{match.group(1)}"
            
    return url

@app.template_filter('to_embed_url')
def to_embed_url_filter(url):
    return to_embed_url(url)


def _hex_to_rgb(hex_color, fallback=(10, 42, 94)):
    hex_color = str(hex_color or '').lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join(c * 2 for c in hex_color)
    if len(hex_color) != 6:
        return fallback
    try:
        return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return fallback


@app.template_filter('soften')
def soften_filter(hex_color, ratio=0.30):
    """Mélange la couleur avec du blanc (remplace color-mix, non lu par html2canvas)."""
    r, g, b = _hex_to_rgb(hex_color)
    mix = lambda c: int(round(c * ratio + 255 * (1 - ratio)))
    return f"#{mix(r):02x}{mix(g):02x}{mix(b):02x}"


@app.template_filter('rgba')
def rgba_filter(hex_color, alpha=1.0):
    r, g, b = _hex_to_rgb(hex_color)
    return f"rgba({r}, {g}, {b}, {alpha})"

# ==============================================================================
# CONFIGURATION DES CLÉS API
# Les clés ne sont plus écrites en dur : elles sont lues dans article-interactif/.env
# (fichier ignoré par git) puis, à défaut, dans les variables d'environnement.
# Voir .env.example pour le modèle.
# ==============================================================================
def _load_dotenv(path):
    """Charge un .env minimal (KEY=VALUE) sans dépendance externe."""
    if not os.path.exists(path):
        return
    try:
        with open(path, 'r', encoding='utf-8-sig') as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, _, val = line.partition('=')
                key, val = key.strip(), val.strip().strip('"').strip("'")
                if key and val and key not in os.environ:
                    os.environ[key] = val
    except Exception as exc:
        print(f"[.env] Lecture impossible : {exc}")


_load_dotenv(os.path.join(base_dir, '.env'))

# Enrichissement interactif : importé APRÈS le .env, qui définit ALGERIA_TECH_ROOT.
import enrich  # noqa: E402
import visual  # noqa: E402

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# Nom lisible des fournisseurs (affiché dans l'interface)
PROVIDER_LABELS = {
    "openai": "OpenAI · GPT-4o",
    "gemini": "Google Gemini",
    "mistral": "Mistral AI",
    "groq": "Groq · Llama",
    "heuristic": "Moteur Heuristique local",
    "preset": "Exemple de démonstration",
}
# ==============================================================================


# Helper function to adjust hex color brightness
def adjust_lightness(hex_color, factor=1.3):
    hex_color = hex_color.lstrip('#')
    if len(hex_color) != 6:
        return '#1b4a8b'
    try:
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        r = min(255, max(0, int(r * factor)))
        g = min(255, max(0, int(g * factor)))
        b = min(255, max(0, int(b * factor)))
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return '#1b4a8b'


# Helper functions to clean and enrich raw text
def clean_and_shorten_title(title_text):
    title_text = re.sub(r'^\d{1,2}:\d{2}\s*', '', title_text)
    title_text = re.sub(r'^ALGER\s*—\s*', '', title_text)
    title_text = re.sub(r'^ALGER\s*-\s*', '', title_text)
    title_text = title_text.strip()
    
    words = title_text.split()
    n = len(words)
    for length in range(2, n // 2 + 1):
        for start in range(n - 2 * length + 1):
            chunk1 = words[start:start+length]
            chunk2 = words[start+length:start+2*length]
            if [w.lower() for w in chunk1] == [w.lower() for w in chunk2]:
                del words[start+length:start+2*length]
                title_text = " ".join(words)
                return clean_and_shorten_title(title_text)
                
    for separator in [" ALGER", " —", " -"]:
        if separator in title_text:
            parts = title_text.split(separator)
            if len(parts[0]) > 20:
                title_text = parts[0]
                break

    if len(title_text) > 100:
        truncated = title_text[:90]
        last_space = truncated.rfind(' ')
        if last_space > 40:
            title_text = truncated[:last_space] + "..."
        else:
            title_text = truncated + "..."
            
    return title_text.strip()


def clean_duplicate_sentences(text):
    text = re.sub(r'^\d{1,2}:\d{2}\s*', '', text)
    text = re.sub(r'^ALGER\s*—\s*', '', text)
    text = re.sub(r'^ALGER\s*-\s*', '', text)
    
    sentences = re.split(r'(?<=[\.\!\?])\s+', text)
    seen = set()
    unique_sentences = []
    for s in sentences:
        s_clean = s.strip().lower()
        if not s_clean:
            continue
        if s_clean not in seen:
            seen.add(s_clean)
            unique_sentences.append(s.strip())
            
    return " ".join(unique_sentences)


def highlight_metrics(text):
    pattern = r'\b(\d+(?:[.,]\d+)?\s*(?:%|Mégawatts|MW|Milliards?|Millions?|USD|DA|DA\/mois|euros?|dollars?|BEM|Baccalauréat|ans?|habitants?|tonnes?(?:\s*\/|)\s*an|élèves|lauréats)?)\b'
    
    def replace_bold(match):
        val = match.group(1)
        if len(val) > 1 and val.strip().isdigit() and int(val.strip()) in [1, 2, 3]:
            return val
        return f"<strong>{val}</strong>"
        
    return re.sub(pattern, replace_bold, text)


# Extraction des libellés : implémentée dans enrich.py (partagée avec les graphiques)
label_for_figure = enrich.label_for_figure


def extract_key_figures(text):
    figures = []
    seen_values = set()

    def push(value, fallback_label, label=None):
        value = value.strip()
        if not value or value in seen_values:
            return
        seen_values.add(value)
        figures.append({
            "value": value,
            "label": label or label_for_figure(text, value) or fallback_label,
        })

    for p in re.findall(r'\b(\d+(?:[.,]\d+)?\s*%)', text)[:2]:
        push(p, "Croissance / Évolution")

    # « 38,86 milliards de dollars » comme « 10 millions USD »
    devise = (r'\b(\d+(?:[.,]\d+)?\s*(?:Milliards?|Millions?)'
              r'(?:\s*(?:de\s+|d[\'’])?(?:USD|DA|dinars?|euros?|dollars?))?)\b')
    for c in re.findall(devise, text, re.I)[:2]:
        push(re.sub(r'\s+', ' ', c), "Volume d'Investissement")

    if len(figures) < 3:
        # Nombre + éventuels adjectifs + unité : « 12 000 nouveaux abonnés ».
        # Les symboles (MW, GW, km) restent dans la valeur ; les noms communs
        # (startups, abonnés…) deviennent le libellé, plus lisible sur la carte.
        SYMBOLS = {'mw', 'mwp', 'gw', 'km'}
        pattern = (r'\b(\d[\d\s ]{0,9}?)\s*((?:[a-zà-ÿ]+\s+){0,2}?'
                   r'(lauréats|élèves|emplois|habitants|tonnes|MWp|MW|GW|startups|'
                   r'entreprises|abonnés|clients|km|logements|postes|branches|'
                   r'secteurs|filières|projets|usines|unités|wilayas|lignes))\b')
        for number, tail, unit in re.findall(pattern, text, re.I)[:3]:
            number = re.sub(r'\s+', ' ', number).strip()
            if unit.lower() in SYMBOLS:
                push(f"{number} {unit}", "Impact Opérationnel")
            else:
                phrase = f"{number} {tail}".strip()
                complement = (enrich.label_after(text, text.find(phrase) + len(phrase), strict=True)
                              if phrase in text else None)
                push(number, "Impact Opérationnel",
                     label=(tail.strip().capitalize() + (" " + complement.lower() if complement else ""))[:38])

    defaults = [
        {"value": "100%", "label": "Fiabilité Opérationnelle"},
        {"value": "Top 10", "label": "Classement Régional"},
        {"value": "+15%", "label": "Taux d'Évolution Mensuel"}
    ]
    while len(figures) < 3:
        figures.append(defaults[len(figures)])

    return figures[:3]


def extract_text_from_file(file):
    filename = file.filename.lower()
    
    if filename.endswith('.txt') or filename.endswith('.md'):
        return file.read().decode('utf-8', errors='ignore')
        
    elif filename.endswith('.pdf'):
        from pypdf import PdfReader
        pdf_file = io.BytesIO(file.read())
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text
        
    elif filename.endswith('.docx'):
        from docx import Document
        docx_file = io.BytesIO(file.read())
        doc = Document(docx_file)
        text = "\n".join([para.text for para in doc.paragraphs])
        return text
        
    elif filename.endswith('.html') or filename.endswith('.htm'):
        from bs4 import BeautifulSoup
        html_content = file.read().decode('utf-8', errors='ignore')
        soup = BeautifulSoup(html_content, 'html.parser')
        for element in soup(["script", "style", "nav", "footer", "header", "iframe", "aside"]):
            element.decompose()
        return soup.get_text()
        
    else:
        raise Exception("Format de fichier non pris en charge.")


def extract_longest_strings_from_json(data):
    strings = []
    def recurse(node):
        if isinstance(node, str):
            val = node.strip()
            if len(val) > 45 and not val.startswith('{') and not val.startswith('[') and not any(k in val for k in ['_next', 'webpack', '.css', 'function(', 'const ']):
                strings.append(val)
        elif isinstance(node, list):
            for item in node:
                recurse(item)
        elif isinstance(node, dict):
            for val in node.values():
                recurse(val)
                
    recurse(data)
    unique_strings = []
    seen = set()
    for s in strings:
        clean = s.strip()
        if clean.lower() not in seen:
            seen.add(clean.lower())
            unique_strings.append(s)
            
    return "\n\n".join(unique_strings)


def find_urls_in_json(data, extensions):
    urls = []
    def recurse(node):
        if isinstance(node, str):
            val = node.strip()
            if any(val.lower().endswith(ext) for ext in extensions) or ('/images/' in val.lower() and ('logo' not in val.lower())):
                if val.startswith('http') or val.startswith('/'):
                    urls.append(val)
        elif isinstance(node, list):
            for item in node:
                recurse(item)
        elif isinstance(node, dict):
            for val in node.values():
                recurse(val)
    recurse(data)
    return urls


# ==============================================================================
# EXTRACTION UNIVERSELLE DE MÉDIAS (Image / Vidéo) DEPUIS UNE PAGE HTML
# Utilisée par /api/parse-html ET /api/fetch-url (logique centralisée, cohérente
# quel que soit le site source : logo/favicon toujours écarté, détection vidéo
# basée sur le domaine plutôt que sur des chemins d'URL figés).
# ==============================================================================
EXCLUDED_IMAGE_KEYWORDS = ['logo', 'icon', 'favicon', 'header', 'banner', 'avatar', 'sprite', 'placeholder', 'pixel.gif', 'spacer']
DIRECT_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.m3u8', '.mkv']

# Pour chaque domaine de plateforme vidéo : liste de mots-clés devant apparaître
# dans le chemin pour confirmer qu'il s'agit bien d'un lien vers UNE vidéo précise
# (et non un simple lien de profil/page). None = tout chemin non vide compte
# (cas des domaines de liens courts, systématiquement des vidéos individuelles).
VIDEO_DOMAIN_RULES = [
    ('youtube.com', ['watch', 'shorts', 'embed', 'live']),
    ('youtu.be', None),
    ('vimeo.com', None),
    ('dailymotion.com', ['video']),
    ('dai.ly', None),
    ('facebook.com', ['watch', 'video', 'reel', 'share/v', 'share/r']),
    ('fb.watch', None),
    ('tiktok.com', ['video', '/v/']),
    ('instagram.com', ['reel', '/p/', '/tv/']),
    ('twitter.com', ['status']),
    ('x.com', ['status']),
    ('twitch.tv', ['videos', 'clip']),
]


def _resolve_url(u, base_url):
    u = (u or '').strip()
    if not u:
        return ''
    if u.startswith('//'):
        return 'https:' + u
    if u.startswith('/') and base_url:
        return base_url.rstrip('/') + u
    return u


def _is_excluded_image(url):
    low = url.lower()
    return any(k in low for k in EXCLUDED_IMAGE_KEYWORDS)


def _strip_query(url):
    return url.split('?')[0].split('#')[0]


def _is_direct_video_url(url):
    path = _strip_query(url).lower()
    return any(path.endswith(ext) for ext in DIRECT_VIDEO_EXTENSIONS)


def _is_video_platform_url(url):
    import urllib.parse
    try:
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith('www.'):
            domain = domain[4:]
        if domain.startswith('m.'):
            domain = domain[2:]
        for platform_domain, path_keywords in VIDEO_DOMAIN_RULES:
            if domain == platform_domain or domain.endswith('.' + platform_domain):
                path = (parsed.path or '').strip('/')
                if not path:
                    return False
                if path_keywords is None:
                    return True
                full_path_lower = (parsed.path + '?' + parsed.query).lower()
                return any(kw in full_path_lower for kw in path_keywords)
        return False
    except Exception:
        return False


def extract_audio_from_dom(soup, article_elem, base_url):
    """Renvoie les pistes audio (balises <audio>, <source>, liens .mp3/.ogg/.m4a)."""
    scope = article_elem or soup
    urls = []

    def add(src):
        if not src:
            return
        resolved = _resolve_url(src, base_url)
        if resolved and resolved not in urls:
            urls.append(resolved)

    for audio in scope.find_all('audio'):
        add(audio.get('src') or audio.get('data-src'))
        for source_tag in audio.find_all('source'):
            add(source_tag.get('src') or source_tag.get('data-src'))

    for link in scope.find_all('a', href=True):
        if re.search(r'\.(mp3|ogg|m4a|wav|aac)(\?|$)', link['href'], re.I):
            add(link['href'])

    return urls


def extract_media_from_dom(soup, article_elem, base_url):
    """Renvoie (image_urls, video_urls) dédupliquées, triées par pertinence."""
    body_image_urls = []
    fallback_image_urls = []
    video_urls = []

    if article_elem:
        # Images réelles trouvées DANS le corps de l'article (priorité absolue :
        # c'est la vraie illustration, contrairement au og:image qui pointe souvent
        # vers le logo générique du site quand l'article n'a pas de photo).
        for img in article_elem.find_all('img'):
            src = (img.get('src') or img.get('data-src') or img.get('data-original')
                   or img.get('data-lazy-src') or img.get('data-lazy'))
            if not src:
                srcset = img.get('srcset') or img.get('data-srcset')
                if srcset:
                    src = srcset.split(',')[0].strip().split(' ')[0]
            if src and (src.startswith('http') or src.startswith('/') or src.startswith('//')):
                resolved = _resolve_url(src, base_url)
                if resolved and not _is_excluded_image(resolved):
                    body_image_urls.append(resolved)

        for source_tag in article_elem.find_all('source'):
            srcset = source_tag.get('srcset') or source_tag.get('data-srcset')
            if srcset:
                first = srcset.split(',')[0].strip().split(' ')[0]
                if first:
                    resolved = _resolve_url(first, base_url)
                    if resolved and not _is_excluded_image(resolved):
                        body_image_urls.append(resolved)

        # Vidéos : iframes, balises <video>, liens <a> pointant vers un fichier
        # direct ou une plateforme sociale (domaine reconnu), attributs data-*.
        for iframe in article_elem.find_all('iframe'):
            src = iframe.get('src') or iframe.get('data-src') or iframe.get('data-embed-url')
            if src:
                resolved = _resolve_url(src, base_url)
                if resolved and (_is_video_platform_url(resolved) or _is_direct_video_url(resolved)):
                    video_urls.append(resolved)

        for video in article_elem.find_all('video'):
            src = video.get('src') or video.get('data-src')
            if src:
                video_urls.append(_resolve_url(src, base_url))
            for source_tag in video.find_all('source'):
                ssrc = source_tag.get('src') or source_tag.get('data-src')
                if ssrc:
                    video_urls.append(_resolve_url(ssrc, base_url))

        for a in article_elem.find_all('a'):
            href = a.get('href') or a.get('data-href')
            if href:
                resolved = _resolve_url(href, base_url)
                if resolved and (_is_direct_video_url(resolved) or _is_video_platform_url(resolved)):
                    video_urls.append(resolved)

        for elem in article_elem.find_all(True):
            for attr in ['data-video', 'data-video-src', 'data-embed-url', 'data-src-video']:
                val = elem.get(attr)
                if val:
                    video_urls.append(_resolve_url(val, base_url))

    # og:image / twitter:image : uniquement en solution de repli si aucune image
    # exploitable n'a été trouvée dans le corps de l'article (et jamais si c'est
    # visiblement un logo/icône).
    og_img = soup.find('meta', attrs={'property': 'og:image'}) or soup.find('meta', attrs={'name': 'twitter:image'})
    if og_img and og_img.get('content'):
        resolved = _resolve_url(og_img.get('content'), base_url)
        if resolved and not _is_excluded_image(resolved):
            fallback_image_urls.append(resolved)

    def dedupe(items):
        seen = set()
        unique = []
        for item in items:
            item = item.strip()
            if item and item not in seen:
                seen.add(item)
                unique.append(item)
        return unique

    image_urls = dedupe(body_image_urls + fallback_image_urls)
    video_urls = dedupe(video_urls)
    return image_urls, video_urls


# SHARED IA PROMPT GENERATOR
def get_prompt(text, primary_color, accent_color):
    return f"""Vous êtes un expert UX designer et un assistant d'extraction JSON. Votre tâche consiste à transformer un article de presse brut en un objet JSON hautement structuré qui sera injecté dans un modèle HTML interactif à onglets (UX fluide).

Voici l'article brut de presse :
---
{text}
---

Vous devez analyser cet article et effectuer les opérations de segmentation suivantes :
1. Extraire les métadonnées :
   - title : Créez un titre engageant et court en français (commençant par un émoji approprié, par exemple 🏛️ pour les institutions, 🌿 pour l'écologie, 🚀 pour l'écologie, etc.).
   - category : Identifiez ou créez une catégorie de presse claire (ex: "TIC • Mobile • Opérateurs", "Énergie • Transition").
   - date : Extrayez la date de publication exacte mentionnée, ou écrivez "Récemment".
   - icon_brand : Choisissez une icône Font Awesome 6 pertinente pour l'en-tête (ex: "fas fa-satellite-dish", "fas fa-leaf", "fas fa-rocket").

2. Segmenter l'article en EXACTEMENT 3 onglets thématiques cohérents (les onglets doivent résumer chronologiquement ou logiquement l'article) :
   Chaque onglet doit être un objet contenant :
   - id : "tab1", "tab2", "tab3".
   - title : Un titre court et percutant de 1 ou 2 mots (ex: "Cérémonie", "Discours", "Impact").
   - icon : Une icône Font Awesome 6 représentative du thème (ex: "fas fa-award", "fas fa-microphone-alt", "fas fa-seedling").
   - content_icon : Une icône Font Awesome 6 de paragraphe (ex: "fas fa-user-tie", "fas fa-quote-left", "fas fa-magic").
   - content : Le texte rédigé pour cet onglet. Utilisez des balises HTML EN LIGNE uniquement (<strong>, <em>) pour mettre en valeur les noms propres, dates ou chiffres clés. N'enveloppez JAMAIS le contenu dans <p> ou <div>. Ne modifiez pas le sens originel du texte mais optimisez-le pour la lecture.
   - content_medium : le même contenu réduit de moitié environ (lecture en 3 minutes pour tout l'article).
   - content_short : UNE seule phrase, l'essentiel de cet onglet (lecture en 30 secondes pour tout l'article).
     Ces deux versions doivent rester fidèles : on resserre, on ne réinvente pas, on n'ajoute aucun fait.
   - tags : Un tableau de 2 ou 3 mots-clés ou chiffres clés extraits de cette partie, chacun avec une icône Font Awesome (ex: {{"text": "BEM 2024", "icon": "fas fa-graduation-cap"}}).
   - quote : (Optionnel) Si l'onglet contient une citation importante ou un discours direct, extrayez-le sous la forme {{"text": "...", "author": "..."}}.

3. Extraire un "chapeau" (Introduction accrocheuse) :
   - chapeau : Les 1 à 3 premières phrases introductives de l'article brut.
   - chapeau_short : la même accroche en UNE phrase.

4. Créer un bloc interactif d'engagement :
   - interactive_block : Un objet contenant {{"icon": "...", "content": "..."}} mettant en évidence l'engagement social, l'impact global ou la vision de l'entreprise (ex: "Algérie Poste réaffirme son engagement...").

5. Extraire/Formuler une conclusion/clôture :
   - closing : Un objet {{"icon": "...", "text": "..."}} résumant la fin de l'article (ex: la photo de famille).

6. Extraire les tags pour le footer :
   - footer : Un objet contenant :
     - tags : un tableau de 3 hashtags d'une seule idée (ex: ["#Innovation", "#Social", "#TIC"]).
     - source : La source de presse identifiée (ex: "APS", "Algérie Tech").

7. BLOCS INTERACTIFS OPTIONNELS — n'ajoutez un bloc QUE si l'article contient réellement la donnée.
   N'inventez JAMAIS de chiffre, de date ou de comparaison absente du texte. Omettez la clé si la matière manque.
   - key_figures : 2 à 4 chiffres marquants réellement cités.
     Chaque entrée : {{"value": "150", "label": "Startups présentes", "icon": "fas fa-rocket",
     "progress": 75, "trend": "up", "delta": "+12 %"}}.
     "progress" (0-100) sert de jauge visuelle ; "trend" vaut "up", "down" ou "flat" ; les deux sont facultatifs.
   - chart : un graphique UNIQUEMENT si l'article donne au moins deux valeurs comparables de même unité.
     {{"type": "bar"|"line"|"donut", "title": "...", "subtitle": "...", "unit": "%",
       "series": [{{"label": "2024", "value": 12}}, {{"label": "2025", "value": 18}}]}}
   - timeline : au moins 2 jalons datés cités dans l'article.
     [{{"date": "T1 2027", "title": "Phase de test", "text": "..."}}]
   - comparator : uniquement si l'article oppose deux entités mesurables.
     {{"title": "Comparatif", "a": {{"label": "Avant", "icon": "fas fa-circle-dot"}},
       "b": {{"label": "Après", "icon": "fas fa-circle-half-stroke"}},
       "rows": [{{"label": "Capacité", "a": "50 MW", "b": "150 MW", "best": "b"}}]}}
   - geo : la wilaya algérienne au cœur de l'information, si elle est citée.
     {{"wilaya": "Alger", "label": "Wilaya d'Alger", "note": "Une phrase de contexte."}}
   - poll : une question fermée liée au sujet, avec 3 ou 4 réponses.
     {{"question": "...", "options": [{{"id": "o0", "label": "..."}}]}}
   - Dans chaque onglet, vous pouvez ajouter "chart" et "timeline" au même format pour illustrer cette section précise.

Paramètres de thème demandés par l'utilisateur :
- Couleur principale : {primary_color}
- Couleur d'accentuation : {accent_color}

Vous DEVEZ répondre UNIQUEMENT par un objet JSON valide, sans aucune phrase introductive, sans balisage markdown (ne pas mettre de blocs de code ```json ... ```), sans texte de conclusion. Votre réponse doit être du JSON brut strictement valide et parsable.

Le format JSON attendu est :
{{
  "title": "...",
  "category": "...",
  "date": "...",
  "icon_brand": "...",
  "chapeau": "...",
  "theme": {{
    "primary_color": "{primary_color}",
    "accent_color": "{accent_color}",
    "primary_light": "{adjust_lightness(primary_color, 1.3)}"
  }},
  "tabs": [
    {{
      "id": "tab1",
      "title": "...",
      "icon": "...",
      "content_icon": "...",
      "content": "...",
      "content_medium": "...",
      "content_short": "...",
      "tags": [
        {{"text": "...", "icon": "..."}}
      ],
      "quote": {{
        "text": "...",
        "author": "..."
      }}
    }}
  ],
  "key_figures": [
    {{"value": "...", "label": "...", "icon": "...", "progress": 60, "trend": "up", "delta": "..."}}
  ],
  "chart": {{
    "type": "bar",
    "title": "...",
    "unit": "",
    "series": [{{"label": "...", "value": 0}}]
  }},
  "timeline": [
    {{"date": "...", "title": "...", "text": "..."}}
  ],
  "geo": {{
    "wilaya": "...",
    "label": "...",
    "note": "..."
  }},
  "poll": {{
    "question": "...",
    "options": [{{"id": "o0", "label": "..."}}, {{"id": "o1", "label": "..."}}]
  }},
  "interactive_block": {{
    "icon": "...",
    "content": "..."
  }},
  "closing": {{
    "icon": "...",
    "text": "..."
  }},
  "actions": {{
    "like_count": 24
  }},
  "footer": {{
    "tags": ["#Tag1", "#Tag2", "#Tag3"],
    "source": "..."
  }}
}}

Rappel : les clés "chart", "timeline", "comparator", "geo" et "poll" sont FACULTATIVES.
Supprimez-les purement et simplement de votre réponse si l'article ne fournit pas la donnée correspondante.
"""


# MULTI-PROVIDER ROUTER FUNCTIONS
def call_openai(prompt, api_key):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a specialized JSON generator. You only return valid JSON based on user text parsing. Never return explanations or markdown blocks."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }
    response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=45)
    if response.status_code == 200:
        result = response.json()
        content = result["choices"][0]["message"]["content"].strip()
        return json.loads(content)
    else:
        raise Exception(f"OpenAI Error (Status {response.status_code}) : {response.text}")


def call_gemini(prompt, api_key):
    # gemini-1.5-flash a été retiré de l'API : « gemini-flash-latest » suit
    # la version courante sans qu'on ait à repasser ici à chaque génération.
    model = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }
    response = requests.post(url, headers=headers, json=payload, timeout=45)
    if response.status_code == 200:
        result = response.json()
        content = result["candidates"][0]["content"]["parts"][0]["text"].strip()
        return json.loads(content)
    else:
        raise Exception(f"Gemini Error (Status {response.status_code}) : {response.text}")


def call_mistral(prompt, api_key):
    url = "https://api.mistral.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "open-mistral-7b",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }
    response = requests.post(url, headers=headers, json=payload, timeout=45)
    if response.status_code == 200:
        result = response.json()
        content = result["choices"][0]["message"]["content"].strip()
        return json.loads(content)
    else:
        raise Exception(f"Mistral Error (Status {response.status_code}) : {response.text}")


def call_groq(prompt, api_key):
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        # Cloudflare protege l'API Groq : sans User-Agent elle repond 403
        # (code 1010), quelle que soit la cle. Cet en-tete n'est pas decoratif.
        "User-Agent": "AlgeriaTech-ArticleInteractif/1.0",
        "Accept": "application/json"
    }
    payload = {
        # Les modeles llama ont ete retires du catalogue Groq (404 sinon).
        "model": os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b"),
        "messages": [
            {"role": "system", "content": "You are a specialized JSON generator. You only return valid JSON based on user text parsing. Never return explanations or markdown blocks."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }
    response = requests.post(url, headers=headers, json=payload, timeout=45)
    if response.status_code == 200:
        result = response.json()
        content = result["choices"][0]["message"]["content"].strip()
        return json.loads(content)
    else:
        raise Exception(f"Groq Error (Status {response.status_code}) : {response.text}")


# Ordre d'essai des fournisseurs. OpenAI passe en dernier : le compte n'a plus
# de credits (429 insufficient_quota), le placer en tete faisait perdre un
# aller-retour a chaque generation avant de basculer sur un moteur qui repond.
ORDRE_IA = [x.strip() for x in os.environ.get(
    "AI_PROVIDER_ORDER", "gemini,mistral,groq,openai").split(",") if x.strip()]

_CLES_IA = {
    "openai": ("OPENAI_API_KEY", OPENAI_API_KEY, "VOTRE_CLE_OPENAI_ICI"),
    "gemini": ("GEMINI_API_KEY", GEMINI_API_KEY, "VOTRE_CLE_GEMINI_ICI"),
    "mistral": ("MISTRAL_API_KEY", MISTRAL_API_KEY, "VOTRE_CLE_MISTRAL_ICI"),
    "groq": ("GROQ_API_KEY", GROQ_API_KEY, "VOTRE_CLE_GROQ_ICI"),
}


def providers_disponibles():
    """Fournisseurs reellement utilisables, dans l'ordre defini par ORDRE_IA."""
    dispo = []
    for nom in ORDRE_IA:
        entree = _CLES_IA.get(nom)
        if not entree:
            continue
        var, valeur, gabarit = entree
        cle = valeur if (valeur and valeur != gabarit) else os.environ.get(var)
        if cle:
            dispo.append((nom, cle))
    return dispo


# MASTER ROUTER
def generate_interactive_data(text, primary_color="#0a2a5e", accent_color="#ffb347", mode="heuristic"):
    if mode == "heuristic":
        return heuristic_generate(text, primary_color, accent_color)
        
    try:
        providers_to_try = providers_disponibles()

        for provider, key in providers_to_try:
            try:
                if provider == 'openai':
                    return call_openai(get_prompt(text, primary_color, accent_color), key)
                elif provider == 'gemini':
                    return call_gemini(get_prompt(text, primary_color, accent_color), key)
                elif provider == 'mistral':
                    return call_mistral(get_prompt(text, primary_color, accent_color), key)
                elif provider == 'groq':
                    return call_groq(get_prompt(text, primary_color, accent_color), key)
            except Exception as e:
                print(f"Échec fournisseur {provider}: {str(e)}")
                continue
                
        raise Exception("Aucune clé API configurée n'a pu traiter la demande.")
        
    except Exception as e:
        print(f"Erreur globale IA, bascule Heuristique : {str(e)}")
        fallback_res = heuristic_generate(text, primary_color, accent_color)
        fallback_res["api_warning"] = f"Alerte de connexion : {str(e)[:90]}. Analyse Heuristique activée."
        return fallback_res


# Predefined high-quality articles (Presets)
PRESETS = {
    "algerie_poste": {
        "title": "🏛️ Algérie Poste récompense l’excellence académique des enfants de ses employés",
        "category": "TIC • Mobile • Opérateurs",
        "date": "Lundi 4 août 2026",
        "icon_brand": "fas fa-satellite-dish",
        "chapeau": "ALGER – Fidèle à sa tradition d'entreprise citoyenne et soucieuse du bien-être social de son capital humain, l'établissement public Algérie Poste a organisé, ce lundi à Alger, une cérémonie de distinction en l'honneur des enfants de ses travailleuses et travailleurs ayant brillamment réussi aux examens du Brevet d'Enseignement Moyen (BEM) et du Baccalauréat pour la session 2024.",
        "theme": {
            "primary_color": "#0a2a5e",
            "accent_color": "#ffb347",
            "primary_light": "#1b4a8b"
        },
        "medias": {
            "image": {
                "url": "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=800&auto=format&fit=crop",
                "caption": "Célébration annuelle de la réussite et du mérite académique pour les enfants des postiers."
            }
        },
        "tabs": [
            {
                "id": "tab1",
                "title": "Cérémonie",
                "icon": "fas fa-award",
                "content_icon": "fas fa-user-tie",
                "content": "La cérémonie, présidée par la Directrice Générale d'Algérie Poste, Mme Chiraz Bechiri, s'est déroulée dans une atmosphère empreinte de convivialité et de fierté, en présence des cadres de l'entreprise ainsi que des familles des lauréats. Cette initiative vise à récompenser les efforts soutenus des élèves durant l'année scolaire et à encourager l'excellence académique au sein des familles des postiers.",
                "tags": [
                    {"text": "BEM 2024", "icon": "fas fa-graduation-cap"},
                    {"text": "Bac 2024", "icon": "fas fa-award"},
                    {"text": "200+ lauréats", "icon": "fas fa-users"}
                ]
            },
            {
                "id": "tab2",
                "title": "Discours",
                "icon": "fas fa-microphone-alt",
                "content_icon": "fas fa-quote-left",
                "content": "Dans une allocution inspirante adressée aux jeunes diplômés, Mme Chiraz Bechiri a souligné la portée nationale de leur réussite.",
                "quote": {
                    "text": "Votre excellence aujourd'hui n'est pas seulement une réussite personnelle, mais c'est une nouvelle pierre à l'édifice de l'Algérie dont nous rêvons tous : l'Algérie de la science, l'Algérie de la compétence et l'Algérie du leadership.",
                    "author": "Mme Chiraz Bechiri, Directrice Générale"
                },
                "tags": [
                    {"text": "Algérie de la science", "icon": "fas fa-flag"},
                    {"text": "Leadership", "icon": "fas fa-brain"}
                ]
            },
            {
                "id": "tab3",
                "title": "Animations",
                "icon": "fas fa-star",
                "content_icon": "fas fa-magic",
                "content": "Le programme de la journée a été riche et diversifié, mêlant moments solennels et divertissement. Outre la remise de certificats de mérite et de cadeaux symboliques, les lauréats ont pu profiter d'un spectacle de magie et d'activités ludiques, créant ainsi des souvenirs mémorables pour marquer cette transition importante vers de nouveaux paliers d'enseignement.",
                "tags": [
                    {"text": "Spectacle de magie", "icon": "fas fa-hat-wizard"},
                    {"text": "Activités ludiques", "icon": "fas fa-gamepad"},
                    {"text": "Cadeaux", "icon": "fas fa-gift"}
                ]
            }
        ],
        "interactive_block": {
            "icon": "fas fa-hand-holding-heart",
            "content": "À travers cette célébration, Algérie Poste réaffirme son engagement à accompagner ses collaborateurs non seulement dans leur cadre professionnel, mais aussi en valorisant les succès de leurs familles. Cette démarche s'inscrit dans la stratégie de l'entreprise visant à renforcer le sentiment d'appartenance et à motiver les travailleurs en célébrant le mérite et l'effort."
        },
        "closing": {
            "icon": "fas fa-camera",
            "text": "La cérémonie s'est clôturée par une photo de famille regroupant les lauréats et la direction générale, sous les applaudissements nourris des parents."
        },
        "actions": {
            "like_count": 24
        },
        "footer": {
            "tags": ["#InnovationSociale", "#RH", "#APS"],
            "source": "APS"
        }
    },
    "hydrogene_vert": {
        "title": "🌿 Hydrogène Vert : L'Algérie s'allie avec l'Allemagne pour un méga-projet pilote",
        "category": "Énergie • Économie • Transition",
        "date": "Mardi 4 août 2026",
        "icon_brand": "fas fa-leaf",
        "chapeau": "ALGER – Dans le cadre de sa stratégie nationale de transition énergétique et de diversification de ses exportations, le groupe pétrolier national Sonatrach a signé ce matin un accord-cadre stratégique avec un consortium allemand de premier plan pour initier un projet pilote de production d'hydrogène vert dans le Sahara algérien.",
        "theme": {
            "primary_color": "#0d5c34",
            "accent_color": "#ffb347",
            "primary_light": "#1b8b54"
        },
        "medias": {
            "image": {
                "url": "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=800&auto=format&fit=crop",
                "caption": "Centrale solaire photovoltaïque destinée à alimenter les électrolyseurs d'hydrogène dans le Sud algérien."
            }
        },
        "table_data": {
            "headers": ["Indicateur", "Objectif Horizon 2028"],
            "rows": [
                ["Capacité de production", "50 000 tonnes / an"],
                ["Réduction Émissions CO2", "200 000 tonnes / an"],
                ["Investissement estimé", "1.2 Milliard USD"],
                ["Emplois locaux créés", "1 500 emplois directs"]
            ]
        },
        "tabs": [
            {
                "id": "tab1",
                "title": "Le Projet",
                "icon": "fas fa-flask",
                "content_icon": "fas fa-solar-panel",
                "content": "Le projet pilote sera implanté près du gisement de Hassi R'mel, profitant d'un ensoleillement exceptionnel. Le consortium installera un parc de panneaux solaires de 150 MW couplé à des électrolyseurs de dernière génération importés d'Allemagne. Ce projet vise à valider les capacités de transport de l'hydrogène via le réseau existant de gazoducs d'Afrique du Nord vers l'Italie.",
                "tags": [
                    {"text": "Hassi R'mel", "icon": "fas fa-map-marker-alt"},
                    {"text": "Énergie Solaire", "icon": "fas fa-sun"},
                    {"text": "150 MW Parc", "icon": "fas fa-bolt"}
                ]
            },
            {
                "id": "tab2",
                "title": "Partenariat",
                "icon": "fas fa-handshake",
                "content_icon": "fas fa-users-cog",
                "content": "L'accord a été signé conjointement par le PDG de Sonatrach et le représentant du consortium H2-Nord. Il prévoit non seulement l'infrastructure mais aussi un transfert technologique complet grâce à la création d'un centre de recherche de haut niveau à l'université de Ouargla pour former la prochaine génération de cadres algériens de l'énergie propre.",
                "quote": {
                    "text": "L'hydrogène vert n'est plus une option lointaine, c'est l'avenir immédiat de notre industrie. Grâce à notre position géopolitique et nos ressources solaires, l'Algérie sera le premier fournisseur d'énergie décarbonée de l'Europe.",
                    "author": "Direction Générale de Sonatrach"
                },
                "tags": [
                    {"text": "Sonatrach", "icon": "fas fa-industry"},
                    {"text": "H2-Nord", "icon": "fas fa-globe-europe"},
                    {"text": "Univ Ouargla", "icon": "fas fa-university"}
                ]
            },
            {
                "id": "tab3",
                "title": "Impact Écolo",
                "icon": "fas fa-globe",
                "content_icon": "fas fa-seedling",
                "content": "Sur le plan écologique, le projet permettra d'éviter l'émission de plus de 200 000 tonnes de gaz à effet de serre par an. Il servira également de modèle pour d'autres projets industriels lourds en Algérie, comme le dessalement d'eau de mer et la production d'ammoniac vert pour l'agriculture nationale.",
                "tags": [
                    {"text": "-200k t CO2", "icon": "fas fa-cloud-sun"},
                    {"text": "Ammoniac Vert", "icon": "fas fa-vial"},
                    {"text": "Dessalement", "icon": "fas fa-water"}
                ]
            }
        ],
        "interactive_block": {
            "icon": "fas fa-shield-halved",
            "content": "Ce partenariat stratégique consolide le rôle historique de l'Algérie comme fournisseur d'énergie fiable tout en l'insérant de plain-pied dans l'économie décarbonée du futur."
        },
        "closing": {
            "icon": "fas fa-flag",
            "text": "Le projet pilote devrait entrer en phase de test dès le premier trimestre 2027, ouvrant la voie à une exploitation commerciale à grande échelle en 2028."
        },
        "actions": {
            "like_count": 52
        },
        "footer": {
            "tags": ["#TransitionEnergetique", "#HydrogeneVert", "#Sonatrach"],
            "source": "Sonatrach Presse"
        }
    },
    "startup_summit": {
        "title": "🚀 Algeria Startup Summit : Algiers Venture réunit l'écosystème tech africain",
        "category": "Tech • Innovation • Startup",
        "date": "Mercredi 5 août 2026",
        "icon_brand": "fas fa-rocket",
        "chapeau": "ALGER – L'accélérateur national public Algiers Venture a inauguré ce matin au Centre International des Conférences (CIC) la 3ème édition de l'Algeria Startup Summit. Cet événement de dimension continentale rassemble cette année plus de 150 startups, 50 fonds d'investissement internationaux et des experts mondiaux pour débattre du rôle de l'IA générative en Afrique.",
        "theme": {
            "primary_color": "#5b1e6d",
            "accent_color": "#ffb347",
            "primary_light": "#8b3ba3"
        },
        "medias": {
            "image": {
                "url": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop",
                "caption": "Plus de 2 000 participants réunis pour la séance plénière d'ouverture du Algeria Startup Summit."
            }
        },
        "tabs": [
            {
                "id": "tab1",
                "title": "Le Sommet",
                "icon": "fas fa-laptop-code",
                "content_icon": "fas fa-users",
                "content": "Durant trois jours, Algiers accueillera des panels thématiques, des sessions de réseautage intense et un hackathon géant. L'objectif principal de cette édition est de créer des corridors technologiques directs entre l'Algérie, l'Afrique de l'Ouest et les hubs technologiques européens pour faciliter la mobility des talents.",
                "tags": [
                    {"text": "CIC Alger", "icon": "fas fa-map-marker-alt"},
                    {"text": "150+ Startups", "icon": "fas fa-rocket"},
                    {"text": "Hackathon", "icon": "fas fa-code"}
                ]
            },
            {
                "id": "tab2",
                "title": "IA et Afrique",
                "icon": "fas fa-brain",
                "content_icon": "fas fa-lightbulb",
                "content": "Les tables rondes de la première journée ont mis en lumière le potentiel exceptionnel de l'intelligence artificielle générative pour surmonter les défis structurels du continent, notamment dans la FinTech (inclusion financière) et l'AgriTech (sécurité alimentaire).",
                "quote": {
                    "text": "L'Afrique ne doit pas simplement être consommatrice des technologies de l'IA, mais elle doit les co-créer. L'Algérie dispose d'un potentiel académique unique capable d'exporter des solutions algorithmiques majeures.",
                    "author": "Yassine El-Mahdi, Spécialiste IA"
                },
                "tags": [
                    {"text": "IA Générative", "icon": "fas fa-microchip"},
                    {"text": "FinTech", "icon": "fas fa-wallet"},
                    {"text": "AgriTech", "icon": "fas fa-seedling"}
                ]
            },
            {
                "id": "tab3",
                "title": "Fonds d'Amorçage",
                "icon": "fas fa-piggy-bank",
                "content_icon": "fas fa-coins",
                "content": "La grande annonce de cette édition est le lancement d'un nouveau fonds de co-investissement d'amorçage d'une valeur de 10 millions de dollars, co-financé par Algiers Venture et deux capitaux-risqueurs du Moyen-Orient. Ce fonds financera en priorité les startups disposant d'un produit viable capable de s'exporter à l'international.",
                "tags": [
                    {"text": "$10 Millions", "icon": "fas fa-file-invoice-dollar"},
                    {"text": "Seed Funding", "icon": "fas fa-hand-holding-usd"},
                    {"text": "Venture Capital", "icon": "fas fa-chart-line"}
                ]
            }
        ],
        "interactive_block": {
            "icon": "fas fa-cubes",
            "content": "Cette édition confirme l'ambition affichée de l'Algérie de devenir un hub incontournable de la tech africaine, soutenue par des réformes réglementaires majeures facilitant l'investissement étranger."
        },
        "closing": {
            "icon": "fas fa-network-wired",
            "text": "Les pitchs des 20 finalistes devant le jury international débuteront demain matin, avec à la clé un prix d'excellence de 50 000 USD."
        },
        "actions": {
            "like_count": 89
        },
        "footer": {
            "tags": ["#AlgeriaTech", "#AlgiersVenture", "#Startups"],
            "source": "Algiers Tech Journal"
        }
    }
}


# HEURISTIC PARSER (No API Key Fallback)
def paragraphize(sentences, per_block=2):
    """Regroupe des phrases en paragraphes lisibles.

    Le rendu place le contenu d'un onglet dans un unique <p> (le selecteur
    .dens.on en depend). On produit donc des <span class="mt-para"> passes en
    display:block par la feuille de style : meme respiration visuelle qu'une
    suite de paragraphes, sans imbriquer de balises de bloc.
    """
    phrases = [s.strip() for s in (sentences or []) if s and s.strip()]
    if not phrases:
        return ""
    if len(phrases) <= per_block:
        return highlight_metrics(" ".join(phrases))
    blocs = []
    for i in range(0, len(phrases), per_block):
        blocs.append(highlight_metrics(" ".join(phrases[i:i + per_block])))
    # Un separateur vide plutot qu'un conteneur : le condensateur de lecture
    # (enrich.split_sentences) redecoupe ce contenu phrase par phrase, et une
    # balise ouvrante orpheline y produirait du balisage casse.
    return '<span class="mt-para-sep"></span>'.join(blocs)


def heuristic_generate(text, primary_color="#0a2a5e", accent_color="#ffb347"):
    if not text or len(text.strip()) < 10:
        return PRESETS["algerie_poste"]
    
    # Une première ligne courte et sans ponctuation finale est un titre :
    # on l'isole pour qu'elle n'avale pas le premier paragraphe.
    lines = [l.strip() for l in text.strip().splitlines()]
    headline, body_text = None, text
    for i, line in enumerate(lines):
        if not line:
            continue
        if len(line) <= 160 and not line.rstrip().endswith(('.', '!', '?', ':', ';')):
            headline = line
            body_text = "\n".join(lines[i + 1:])
        break

    cleaned_text = clean_duplicate_sentences(body_text)
    sentences = [s.strip() for s in re.split(r'(?<=[\.\!\?])\s+', cleaned_text) if s.strip()]
    if not sentences:
        cleaned_text = clean_duplicate_sentences(text)
        sentences = [s.strip() for s in re.split(r'(?<=[\.\!\?])\s+', cleaned_text) if s.strip()]
        headline = None
    if not sentences:
        return PRESETS["algerie_poste"]

    if headline:
        raw_title = clean_and_shorten_title(headline)
    else:
        raw_title = clean_and_shorten_title(sentences[0])
        sentences = sentences[1:]
    if sentences and (sentences[0].lower() in raw_title.lower() or raw_title.lower() in sentences[0].lower()):
        sentences = sentences[1:]

    category = "Presse • Actualités"
    icon_brand = "fas fa-newspaper"
    full_lower_text = (raw_title + " " + " ".join(sentences)).lower()
    
    if any(k in full_lower_text for k in ["ooredoo", "djezzy", "mobilis", "télécom", "poste", "mobile", "réseau", "internet", "opérateur", "4g", "lte", "mwc"]):
        category = "TIC • Télécom • Mobile"
        icon_brand = "fas fa-satellite-dish"
    elif any(k in full_lower_text for k in ["hydrogène", "sonatrach", "énergie", "gaz", "solaire", "pétrole", "écologique", "climat"]):
        category = "Énergie • Transition Énergétique"
        icon_brand = "fas fa-leaf"
    elif any(k in full_lower_text for k in ["startup", "venture", "sommet", "hackathon", "innovation", "ia", "tech"]):
        category = "Tech • Innovation • Startups"
        icon_brand = "fas fa-rocket"

    emoji_prefix = "📰 "
    if category == "TIC • Télécom • Mobile":
        emoji_prefix = "🏛️ " if "poste" in full_lower_text else "📱 "
    elif category == "Énergie • Transition Énergétique":
        emoji_prefix = "🌿 "
    elif category == "Tech • Innovation • Startups":
        emoji_prefix = "🚀 "

    title = emoji_prefix + re.sub(r'[#*`\-🏛️🚀🌿📱]', '', raw_title).strip()

    closing_text = ""
    if sentences:
        closing_text = sentences[-1]
        sentences = sentences[:-1]
    else:
        closing_text = "Analyse de l'événement complétée."

    interactive_content = ""
    if sentences:
        interactive_content = sentences[-1]
        sentences = sentences[:-1]
    else:
        interactive_content = "Cette analyse interactive synthétise les indicateurs opérationnels clés."

    n_s = len(sentences)
    if n_s == 0:
        chapeau = "Découvrez notre analyse interactive de cet article de presse."
        tab1_sentences = ["Détails et faits complémentaires décrits dans les autres sections."]
        tab2_sentences = ["Informations d'analyse clés décrites dans cet article."]
        tab3_sentences = ["Perspectives d'évolution et bilan de l'actualité."]
    elif n_s == 1:
        chapeau = sentences[0]
        tab1_sentences = [sentences[0]]
        tab2_sentences = [sentences[0]]
        tab3_sentences = [sentences[0]]
    elif n_s == 2:
        chapeau = sentences[0]
        tab1_sentences = [sentences[0]]
        tab2_sentences = [sentences[1]]
        tab3_sentences = [sentences[1]]
    elif n_s == 3:
        chapeau = sentences[0]
        tab1_sentences = [sentences[1]]
        tab2_sentences = [sentences[2]]
        tab3_sentences = [sentences[2]]
    else:
        chap_size = 2 if n_s >= 6 else 1
        chapeau_list = sentences[:chap_size]
        chapeau = " ".join(chapeau_list)
        
        remaining = sentences[chap_size:]
        rem_len = len(remaining)
        
        chunk = rem_len // 3
        if chunk == 0:
            chunk = 1
            
        tab1_sentences = remaining[:chunk]
        tab2_sentences = remaining[chunk:2*chunk]
        tab3_sentences = remaining[2*chunk:]

    chapeau = highlight_metrics(chapeau)
    # Le moteur heuristique renvoyait un seul pave par onglet : c'est ce qui
    # donnait l'aspect « bloc de texte ». On regroupe desormais les phrases par
    # deux, dans des paragraphes autonomes. Un <span display:block> plutot
    # qu'un <p> : le contenu vit deja DANS un <p>, et le systeme de densite de
    # lecture (.dens.on) cible ce <p> unique — l'imbriquer le casserait.
    tab1_content = paragraphize(tab1_sentences)
    tab2_content = paragraphize(tab2_sentences)
    tab3_content = paragraphize(tab3_sentences)
    interactive_content = highlight_metrics(interactive_content)
    closing_text = highlight_metrics(closing_text)

    if category == "TIC • Télécom • Mobile":
        tab_configs = [
            {"title": "Bilan Financier", "icon": "fas fa-chart-line", "content_icon": "fas fa-file-invoice-dollar"},
            {"title": "Clientèle & Réseau", "icon": "fas fa-users", "content_icon": "fas fa-mobile-alt"},
            {"title": "Investissements", "icon": "fas fa-bolt", "content_icon": "fas fa-network-wired"}
        ]
    elif category == "Énergie • Transition Énergétique":
        tab_configs = [
            {"title": "Le Projet", "icon": "fas fa-flask", "content_icon": "fas fa-solar-panel"},
            {"title": "Partenariat", "icon": "fas fa-handshake", "content_icon": "fas fa-users-cog"},
            {"title": "Impact Écolo", "icon": "fas fa-globe", "content_icon": "fas fa-seedling"}
        ]
    elif category == "Tech • Innovation • Startups":
        tab_configs = [
            {"title": "Le Sommet", "icon": "fas fa-laptop-code", "content_icon": "fas fa-users"},
            {"title": "IA & Innovation", "icon": "fas fa-brain", "content_icon": "fas fa-lightbulb"},
            {"title": "Financement", "icon": "fas fa-piggy-bank", "content_icon": "fas fa-coins"}
        ]
    else:
        tab_configs = [
            {"title": "Faits Majeurs", "icon": "fas fa-info-circle", "content_icon": "fas fa-bookmark"},
            {"title": "Analyse & Paroles", "icon": "fas fa-comment-dots", "content_icon": "fas fa-quote-left"},
            {"title": "Perspectives", "icon": "fas fa-chart-line", "content_icon": "fas fa-lightbulb"}
        ]

    tabs = []
    contents = [tab1_content, tab2_content, tab3_content]
    
    for i in range(3):
        quote = None
        if i == 1:
            quote_match = re.search(r'«([^»]+)»|"([^"]+)"', text)
            if quote_match:
                quote_text = highlight_metrics(quote_match.group(1) or quote_match.group(2))
                quote = {"text": quote_text, "author": "Déclaration officielle"}
            elif "ooredoo" in full_lower_text or "djezzy" in full_lower_text:
                quote = {
                    "text": "Cette progression constante témoigne de notre engagement à fournir des services de haute qualité et à accompagner la transition numérique de nos clients.",
                    "author": "Direction Générale"
                }
                
        clean_text_for_tags = re.sub(r'<[^>]+>', '', contents[i])
        extracted_words = re.findall(r'\b[A-Z\d][a-zA-Z\d]{3,12}\b', clean_text_for_tags)
        extracted_words = list(set([w for w in extracted_words if w.upper() not in ["ALGER", "L'ALGERIE", "L'OPÉRATEUR", "OOREDOO", "SONATRACH", "DJEZZY"]]))[:3]
        
        tags = []
        icons = ["fas fa-tag", "fas fa-star", "fas fa-check"]
        for idx, word in enumerate(extracted_words):
            tags.append({"text": word, "icon": icons[idx % len(icons)]})
            
        if not tags:
            tags = [{"text": "Analyse", "icon": "fas fa-chart-bar"}]

        tabs.append({
            "id": f"tab{i+1}",
            "title": tab_configs[i]["title"],
            "icon": tab_configs[i]["icon"],
            "content_icon": tab_configs[i]["content_icon"],
            "content": contents[i],
            "tags": tags,
            "quote": quote
        })

    interactive_block = {
        "icon": "fas fa-shield-halved" if "finance" in full_lower_text or "croissance" in full_lower_text else "fas fa-hand-holding-heart",
        "content": interactive_content
    }

    closing = {
        "icon": "fas fa-chart-line" if "croissance" in full_lower_text else "fas fa-check-circle",
        "text": closing_text
    }

    footer_tags = ["#DigitalAlgerie", "#InnovationTech"]
    words_for_tags = re.findall(r'\b[a-zA-Z]{5,10}\b', re.sub(r'<[^>]+>', '', title))
    if words_for_tags:
        footer_tags = ["#" + w.capitalize() for w in words_for_tags[:3]]

    source = "APS"
    if "ooredoo" in full_lower_text:
        source = "Ooredoo Presse"
    elif "djezzy" in full_lower_text:
        source = "Djezzy Presse"
    elif "sonatrach" in full_lower_text:
        source = "Sonatrach Médias"

    return {
        "title": title,
        "category": category,
        "date": "Semestre 2026" if "2026" in full_lower_text else "Récemment",
        "icon_brand": icon_brand,
        "chapeau": chapeau,
        "key_figures": extract_key_figures(text),
        "theme": {
            "primary_color": primary_color,
            "accent_color": accent_color,
            "primary_light": adjust_lightness(primary_color, 1.3)
        },
        "tabs": tabs,
        "interactive_block": interactive_block,
        "closing": closing,
        "actions": {
            "like_count": 36
        },
        "footer": {
            "tags": footer_tags,
            "source": source
        }
    }


# GLOBAL FILTER FOR RECOMMENDATIONS & ADS (French news portals)
def clean_boilerplate_and_related(soup):
    # Decompose known standard related/sharing widget classes (very specific, non-intrusive)
    selectors_to_remove = [
        '.related-posts', '.related-articles', '.recommendations', 
        '.suggested-posts', '.sharing-buttons', '.social-share-buttons', 
        '.comments-area', '#comments', '.widget_related_posts', '.newsletter-signup'
    ]
    for selector in selectors_to_remove:
        for element in soup.select(selector):
            element.decompose()
            
    # Also find and decompose text-based related blocks (e.g. "Vous aimerez aussi", "A lire aussi")
    # Search for headings or divs or paragraphs that contain common recommendation phrases in French
    patterns = [
        r"vous aimerez aussi",
        r"vous aimeriez aussi",
        r"vous pourriez aussi aimer",
        r"vous aimerez également",
        r"vous aimeriez également",
        r"vous pourriez aimer",
        r"a lire aussi",
        r"à lire aussi",
        r"sur le même sujet",
        r"articles connexes",
        r"lecture connexe",
        r"recommandé pour vous",
        r"recommandés pour vous"
    ]
    
    # Compile pattern
    regex = re.compile("|".join(patterns), re.IGNORECASE)
    
    # Find tags containing these texts
    for tag in list(soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong'])):
        if not tag.parent:
            continue
        try:
            text_val = tag.get_text().strip()
            # If text matches and is short (indicating a heading or title, not an article paragraph)
            if len(text_val) < 80 and regex.search(text_val):
                # Check if the next sibling is a list (which usually contains the related links)
                next_sib = tag.find_next_sibling()
                if next_sib and next_sib.name in ['ul', 'ol', 'div'] and (next_sib.find('a') or 'related' in ''.join(next_sib.get('class', []))):
                    next_sib.decompose()
                # Decompose the heading/paragraph itself
                tag.decompose()
        except Exception:
            pass


# ROUTES
# Smart Ingest PRO (servi par le Hub sur le port 3000) appelle ces routes depuis
# une autre origine : sans cet en-tête le navigateur bloquerait tout. On reste
# volontairement limité aux origines locales — pas de joker.
_ORIGINES_LOCALES = ("http://localhost:3000", "http://127.0.0.1:3000",
                     "http://localhost:7000", "http://127.0.0.1:7000")


@app.after_request
def _autoriser_origines_locales(reponse):
    origine = request.headers.get("Origin", "")
    if origine in _ORIGINES_LOCALES:
        reponse.headers["Access-Control-Allow-Origin"] = origine
        reponse.headers["Access-Control-Allow-Headers"] = "Content-Type"
        reponse.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        reponse.headers["Vary"] = "Origin"
    return reponse


@app.route('/')
def index():
    has_openai = bool(OPENAI_API_KEY and OPENAI_API_KEY != "VOTRE_CLE_OPENAI_ICI") or bool(os.environ.get("OPENAI_API_KEY"))
    has_gemini = bool(GEMINI_API_KEY and GEMINI_API_KEY != "VOTRE_CLE_GEMINI_ICI") or bool(os.environ.get("GEMINI_API_KEY"))
    has_mistral = bool(MISTRAL_API_KEY and MISTRAL_API_KEY != "VOTRE_CLE_MISTRAL_ICI") or bool(os.environ.get("MISTRAL_API_KEY"))
    has_groq = bool(GROQ_API_KEY and GROQ_API_KEY != "VOTRE_CLE_GROQ_ICI") or bool(os.environ.get("GROQ_API_KEY"))
    
    return render_template('index.html', 
                           has_openai_key=has_openai,
                           has_gemini_key=has_gemini,
                           has_mistral_key=has_mistral,
                           has_groq_key=has_groq)


@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni."}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné."}), 400
        
    try:
        extracted_text = extract_text_from_file(file)
        return jsonify({"text": extracted_text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/parse-html', methods=['POST'])
def parse_html_content():
    data = request.json or {}
    html_text = data.get('html', '').strip()
    url = data.get('url', '').strip()
    if not html_text:
        return jsonify({"error": "Veuillez fournir le contenu HTML."}), 400

    # Le navigateur a pu récupérer directement le HTML de /article/<id> (fetch
    # direct, cf. index.html) — mais c'est le squelette vide de la SPA, pas
    # l'article rendu. On bascule sur articles.json comme pour /api/fetch-url.
    try:
        at_result = try_fetch_algeria_tech_article(url)
        if at_result:
            return jsonify(at_result)
    except Exception as at_err:
        print(f"[parse-html] Lien Algeria Tech local détecté mais lecture directe échouée, retour au parsing HTML générique : {at_err}")

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_text, 'html.parser')
        
        # Clean up related articles and boilerplate from the DOM
        clean_boilerplate_and_related(soup)
        
        # 1. framework JSON Prop extraction fallback (Bypasses Javascript single page app limitations 100% of the time!)
        next_data_script = soup.find('script', id='__NEXT_DATA__') or soup.find('script', id='__NUXT_DATA__')
        if next_data_script:
            try:
                json_data = json.loads(next_data_script.string)
                extracted_text = extract_longest_strings_from_json(json_data)
                if len(extracted_text) > 200:
                    img_urls = find_urls_in_json(json_data, ['.png', '.jpg', '.jpeg', '.webp'])
                    img_urls = [x for x in img_urls if not any(k in x.lower() for k in ['logo', 'icon', 'header', 'banner', 'avatar'])]
                    
                    return jsonify({
                        "text": extracted_text,
                        "extracted_image": img_urls[0] if img_urls else None,
                        "extracted_video": None
                    })
            except Exception as json_err:
                print("Failed to scrape framework JSON metadata state:", json_err)

        # 2. Standard DOM HTML Extraction (Fallback)
        article_elem = soup.find('article') or soup.find(class_=re.compile(r'post|article|entry-content|content-body|story', re.I)) or soup.find(id=re.compile(r'post|article|content-body|story', re.I))
        if not article_elem:
            article_elem = soup.find('main') or soup.find('body')
            
        image_urls, video_urls = extract_media_from_dom(soup, article_elem, url)
        audio_urls = extract_audio_from_dom(soup, article_elem, url)

        for element in soup(["script", "style", "nav", "footer", "header", "iframe", "aside", "form", "button"]):
            element.decompose()

        text_content = ""
        if article_elem:
            text_content = article_elem.get_text()
        else:
            text_content = soup.get_text()

        clean_text = re.sub(r'\n\s*\n', '\n\n', text_content).strip()

        return jsonify({
            "text": clean_text,
            "extracted_image": image_urls[0] if image_urls else None,
            "extracted_video": video_urls[0] if video_urls else None,
            "extracted_audio": audio_urls[0] if audio_urls else None,
            "extracted_images": image_urls[:12],
            "extracted_videos": video_urls[:4],
        })
    except Exception as e:
        return jsonify({"error": f"Erreur lors du traitement HTML : {str(e)}"}), 500


# ==============================================================================
# LIENS INTERNES ALGERIA TECH (smart-ingest, localhost:3000) — reconnus comme
# source valide : au lieu de scraper le HTML de /article/<id> (qui ne renvoie
# que le squelette vide de la SPA, le contenu réel n'étant rendu qu'ensuite en
# JS côté client), on lit directement articles.json et on récupère les champs
# structurés (titre, extrait, contenu, image, vidéo) — bien plus fiable.
# ==============================================================================
ALGERIA_TECH_LOCAL_HOSTS = ['localhost:3000', '127.0.0.1:3000']


def try_fetch_algeria_tech_article(url):
    """Renvoie {text, extracted_image, extracted_video} si l'URL pointe vers un
    article Algeria Tech local (smart-ingest), sinon None (URL non concernée)."""
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc.lower() not in ALGERIA_TECH_LOCAL_HOSTS:
        return None
    m = re.match(r'^/article/([A-Za-z0-9_-]+)', parsed.path)
    if not m:
        return None
    article_id = m.group(1)
    base = f"{parsed.scheme}://{parsed.netloc}"

    resp = requests.get(f"{base}/articles.json", timeout=10)
    resp.raise_for_status()
    articles = resp.json()

    article = next((a for a in articles if str(a.get('id')) == article_id), None)
    if not article:
        return None

    raw = article.get('rawContent', '') or ''
    text_parts = [article.get('titre', ''), article.get('extrait', ''), raw]
    text = "\n\n".join(p for p in text_parts if p)

    def absolutize(src):
        src = (src or '').strip()
        if not src or src.lower().startswith(('http', 'data:')):
            return src
        return base + ('' if src.startswith('/') else '/') + src

    image = absolutize(article.get('image'))

    # Les photos insérées dans le corps (at-inline-images) alimentent la galerie.
    images = [image] if image else []
    for src in re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', raw, re.I):
        src = absolutize(src)
        if src and src not in images:
            images.append(src)
    for src in re.findall(r'!\[[^\]]*\]\(([^)\s]+)', raw):
        src = absolutize(src)
        if src and src not in images:
            images.append(src)

    videos = []
    main_video = (article.get('video') or '').strip()
    if main_video:
        videos.append(main_video)
    for src in re.findall(r'<(?:video|source|iframe)[^>]+src=["\']([^"\']+)["\']', raw, re.I):
        src = absolutize(src)
        if src and src not in videos:
            videos.append(src)

    audios = []
    for src in re.findall(r'<audio[^>]+src=["\']([^"\']+)["\']', raw, re.I):
        src = absolutize(src)
        if src and src not in audios:
            audios.append(src)
    for src in re.findall(r'https?://[^\s"\'<>]+\.(?:mp3|ogg|m4a|wav)', raw, re.I):
        if src not in audios:
            audios.append(src)

    return {
        "text": text,
        "extracted_image": images[0] if images else None,
        "extracted_video": videos[0] if videos else None,
        "extracted_audio": audios[0] if audios else None,
        "extracted_images": images[:12],
        "extracted_videos": videos[:4],
        "source_title": article.get('titre', ''),
    }


@app.route('/api/fetch-url', methods=['POST'])
def fetch_url():
    data = request.json or {}
    url = data.get('url', '').strip()
    if not url:
        return jsonify({"error": "Veuillez fournir un lien URL."}), 400

    try:
        if not (url.lower().startswith('http://') or url.lower().startswith('https://')):
            if 'localhost' in url.lower() or '127.0.0.1' in url.lower():
                url = 'http://' + url
            else:
                url = 'https://' + url

        if 'http://127.0.0.1:5000' in url or 'http://localhost:5000' in url:
            return jsonify({"error": "Impossible de scraper notre propre serveur de conversion !"}), 400

        try:
            at_result = try_fetch_algeria_tech_article(url)
            if at_result:
                return jsonify(at_result)
        except Exception as at_err:
            print(f"[fetch-url] Lien Algeria Tech local détecté mais lecture directe échouée, retour au scraping HTML générique : {at_err}")

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, bg-gecko) Chrome/115.0.0.0 Safari/537.36'
        }
        
        res = None
        try:
            res = requests.get(url, headers=headers, timeout=15)
        except requests.exceptions.ConnectionError:
            fallback_urls = []
            if 'localhost' in url.lower():
                fallback_urls.append(url.replace('localhost', '127.0.0.1'))
                fallback_urls.append(url.replace('localhost', '[::1]'))
            elif '127.0.0.1' in url.lower():
                fallback_urls.append(url.replace('127.0.0.1', 'localhost'))
                fallback_urls.append(url.replace('127.0.0.1', '[::1]'))
                
            for fb_url in fallback_urls:
                if 'http://127.0.0.1:5000' in fb_url or 'http://localhost:5000' in fb_url:
                    continue
                try:
                    res = requests.get(fb_url, headers=headers, timeout=15)
                    if res.status_code == 200:
                        break
                except requests.exceptions.ConnectionError:
                    continue
            
            if res is None:
                raise

        if res.status_code != 200:
            return jsonify({"error": f"Impossible d'accéder au lien (Code de statut {res.status_code})"}), 400
            
        if 'charset' not in res.headers.get('content-type', '').lower():
            res.encoding = res.apparent_encoding or 'utf-8'
            
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(res.text, 'html.parser')
        
        clean_boilerplate_and_related(soup)
        
        next_data_script = soup.find('script', id='__NEXT_DATA__') or soup.find('script', id='__NUXT_DATA__')
        if next_data_script:
            try:
                json_data = json.loads(next_data_script.string)
                extracted_text = extract_longest_strings_from_json(json_data)
                if len(extracted_text) > 200:
                    img_urls = find_urls_in_json(json_data, ['.png', '.jpg', '.jpeg', '.webp'])
                    img_urls = [x for x in img_urls if not any(k in x.lower() for k in ['logo', 'icon', 'header', 'banner', 'avatar'])]
                    
                    return jsonify({
                        "text": extracted_text,
                        "extracted_image": img_urls[0] if img_urls else None,
                        "extracted_video": None
                    })
            except Exception as json_err:
                print("Failed to scrape framework JSON metadata state:", json_err)

        article_elem = soup.find('article') or soup.find(class_=re.compile(r'post|article|entry-content|content-body|story', re.I)) or soup.find(id=re.compile(r'post|article|content-body|story', re.I))
        if not article_elem:
            article_elem = soup.find('main') or soup.find('body')
            
        image_urls, video_urls = extract_media_from_dom(soup, article_elem, url)
        audio_urls = extract_audio_from_dom(soup, article_elem, url)

        for element in soup(["script", "style", "nav", "footer", "header", "iframe", "aside", "form", "button"]):
            element.decompose()

        text_content = ""
        if article_elem:
            text_content = article_elem.get_text()
        else:
            text_content = soup.get_text()

        clean_text = re.sub(r'\n\s*\n', '\n\n', text_content).strip()

        return jsonify({
            "text": clean_text,
            "extracted_image": image_urls[0] if image_urls else None,
            "extracted_video": video_urls[0] if video_urls else None,
            "extracted_audio": audio_urls[0] if audio_urls else None,
            "extracted_images": image_urls[:12],
            "extracted_videos": video_urls[:4],
        })
    except requests.exceptions.ConnectionError as ce:
        is_localhost_url = 'localhost' in url.lower() or '127.0.0.1' in url.lower()
        if is_localhost_url:
            return jsonify({
                "error": "Impossible de se connecter à votre serveur local depuis notre serveur Cloud. "
                         "Veuillez vérifier que votre serveur local autorise les requêtes CORS, ou lancez "
                         "l'application en local sur votre PC afin que le serveur de conversion puisse interroger localhost."
            }), 400
        return jsonify({"error": f"Erreur de connexion : {str(ce)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Erreur lors de la récupération du lien : {str(e)}"}), 500


@app.route('/api/generate', methods=['POST'])
def generate_article():
    data = request.json or {}
    text = data.get('text', '').strip()
    primary_color = data.get('primary_color', '#0a2a5e')
    accent_color = data.get('accent_color', '#ffb347')
    mode = data.get('mode', 'heuristic')
    preset_id = data.get('preset_id', '')

    medias_data = data.get('medias', {})
    for m_key in ['image', 'video', 'audio']:
        m_item = medias_data.get(m_key)
        if m_item and m_item.get('url'):
            url = m_item['url'].strip()
            if url.lower().startswith('file://') or (len(url) > 2 and url[1] == ':' and (url[0].lower() in ['c', 'd', 'e', 'f'] or url[0] == '\\')):
                m_item['url'] = f"/api/serve-local?path={requests.utils.quote(url)}"

    # Blocs interactifs optionnels demandés par l'interface
    widget_options = data.get('widgets') or {}
    gallery_data = data.get('gallery') or []
    dark_mode = bool(data.get('dark_mode'))
    source_url = (data.get('source_url') or '').strip()

    def finalize(payload, provider, base_text=""):
        """Applique thème, médias, galerie puis l'enrichissement interactif."""
        if gallery_data:
            payload["gallery"] = gallery_data
        if source_url:
            payload["source_url"] = source_url
        theme = payload.setdefault("theme", {})
        theme["dark"] = dark_mode
        payload = enrich.enrich_payload(payload, base_text, widget_options)
        # Visuel interactif : seul le tracé vectoriel (option A) est produit
        # automatiquement. Les illustrations générées (option B) coûtent un appel
        # par élément, elles restent déclenchées à la demande depuis l'interface.
        if widget_options.get("visual"):
            try:
                built = visual.build_visual(payload, base_text, kind="auto", style="svg")
                if built:
                    payload["visual"] = built
            except Exception as exc:
                print(f"Visuel interactif ignoré : {exc}")
        payload["ai_provider"] = provider
        payload["ai_provider_label"] = PROVIDER_LABELS.get(provider, provider)
        return payload

    if preset_id and preset_id in PRESETS:
        preset_data = json.loads(json.dumps(PRESETS[preset_id]))
        if primary_color and primary_color != "#0a2a5e":
            preset_data["theme"]["primary_color"] = primary_color
            preset_data["theme"]["primary_light"] = adjust_lightness(primary_color, 1.3)
        if accent_color and accent_color != "#ffb347":
            preset_data["theme"]["accent_color"] = accent_color
        if medias_data:
            preset_data["medias"] = {**preset_data.get("medias", {}), **medias_data}
        return jsonify(finalize(preset_data, "preset", text))

    if mode == 'real':
        providers_to_try = providers_disponibles()

        for provider, key in providers_to_try:
            try:
                if provider == 'openai':
                    result_json = call_openai(get_prompt(text, primary_color, accent_color), key)
                elif provider == 'gemini':
                    result_json = call_gemini(get_prompt(text, primary_color, accent_color), key)
                elif provider == 'mistral':
                    result_json = call_mistral(get_prompt(text, primary_color, accent_color), key)
                elif provider == 'groq':
                    result_json = call_groq(get_prompt(text, primary_color, accent_color), key)
                if medias_data:
                    result_json["medias"] = medias_data
                return jsonify(finalize(result_json, provider, text))
            except Exception as e:
                print(f"Failed provider {provider} in /generate: {str(e)}")
                continue

        err_msg = "Aucun fournisseur d'IA configuré n'a pu traiter la demande."
        fallback_res = heuristic_generate(text, primary_color, accent_color)
        fallback_res["api_warning"] = f"Alerte de connexion : {err_msg[:90]}. Moteur Heuristique activé."
        if medias_data:
            fallback_res["medias"] = medias_data
        return jsonify(finalize(fallback_res, "heuristic", text))

    else:
        result_json = heuristic_generate(text, primary_color, accent_color)
        if medias_data:
            result_json["medias"] = medias_data
        return jsonify(finalize(result_json, "heuristic", text))


@app.route('/api/serve-local')
def serve_local_file():
    path = request.args.get('path', '').strip()
    if not path:
        return "Path is empty", 400
        
    if path.lower().startswith('file:///'):
        path = path[8:]
    elif path.lower().startswith('file://'):
        path = path[7:]
        
    path = requests.utils.unquote(path)
    if not os.path.exists(path):
        return f"File not found: {path}", 404
        
    try:
        range_header = request.headers.get('Range', None)
        if not range_header:
            return send_file(path)
            
        size = os.path.getsize(path)
        byte1, byte2 = 0, None
        
        match = re.search(r'bytes=(\d+)-(\d*)', range_header)
        if match:
            groups = match.groups()
            if groups[0]:
                byte1 = int(groups[0])
            if groups[1]:
                byte2 = int(groups[1])
                
        length = size - byte1
        if byte2 is not None:
            length = byte2 - byte1 + 1
            
        data = None
        with open(path, 'rb') as f:
            f.seek(byte1)
            data = f.read(length)
            
        rv = make_response(data)
        rv.status_code = 206
        rv.headers['Content-Type'] = 'video/mp4' if path.lower().endswith('.mp4') else 'application/octet-stream'
        rv.headers['Content-Range'] = f'bytes {byte1}-{byte1 + len(data) - 1}/{size}'
        rv.headers['Accept-Ranges'] = 'bytes'
        return rv
    except Exception as e:
        return str(e), 500


def build_render_context(data):
    """Prépare les variables du gabarit (dont la carte SVG des wilayas)."""
    ctx = dict(data or {})
    ctx.pop('map_svg', None)  # toujours recalculé côté serveur

    # Un modèle omet parfois une clé : le gabarit y accède directement
    # (theme.primary_color, actions.like_count) et tout le rendu échouerait.
    theme = ctx.get('theme') if isinstance(ctx.get('theme'), dict) else {}
    theme.setdefault('primary_color', '#0a2a5e')
    theme.setdefault('accent_color', '#ffb347')
    theme.setdefault('primary_light', adjust_lightness(theme['primary_color'], 1.3))
    ctx['theme'] = theme

    actions = ctx.get('actions') if isinstance(ctx.get('actions'), dict) else {}
    actions.setdefault('like_count', 12)
    ctx['actions'] = actions

    # Visualisations envoyees par le studio (graphiques, frises, infographies)
    # que l'article du site ne doit pas porter. C'est du HTML fabrique par notre
    # propre interface, mais il traverse le reseau : on refuse tout script.
    brut = ctx.get('extra_visuals')
    if isinstance(brut, str) and brut.strip():
        propre = re.sub(r'(?is)<\s*script.*?<\s*/\s*script\s*>', '', brut)
        propre = re.sub(r'(?is)<\s*/?\s*(script|iframe|object|embed|form)\b[^>]*>', '', propre)
        propre = re.sub(r'(?i)\son[a-z]+\s*=\s*"[^"]*"', '', propre)
        propre = re.sub(r"(?i)\son[a-z]+\s*=\s*'[^']*'", '', propre)
        ctx['extra_visuals'] = propre
    else:
        ctx['extra_visuals'] = ''

    geo = ctx.get('geo') or {}
    wilaya = geo.get('wilaya') or geo.get('label')
    if wilaya:
        wilaya = re.sub(r'^\s*wilaya\s+d[eu\'’]\s*', '', str(wilaya), flags=re.I).strip()
        svg = enrich.build_map_svg(wilaya)
        if svg:
            ctx['map_svg'] = svg

    # Le curseur n'apparaît que s'il change vraiment quelque chose : un chapeau
    # raccourci seul ne justifie pas un réglage que le lecteur croirait inerte.
    tabs = [t for t in (ctx.get('tabs') or []) if isinstance(t, dict)]
    ctx['has_density'] = any(t.get('content_short') or t.get('content_medium') for t in tabs)

    # Corpus transmis à /api/ask (la carte peut être servie ailleurs qu'ici)
    if (ctx.get('qa') or {}).get('enabled'):
        ctx['qa_article'] = {
            'title': ctx.get('title', ''),
            'chapeau': ctx.get('chapeau', ''),
            'tabs': [
                {'id': t.get('id'), 'title': t.get('title'),
                 'content': t.get('content'), 'quote': t.get('quote')}
                for t in tabs
            ],
            'interactive_block': ctx.get('interactive_block'),
            'closing': ctx.get('closing'),
            # Sert à écarter l'article lui-même des lectures complémentaires
            'source_url': ctx.get('source_url', ''),
        }
    return ctx


@app.route('/api/render', methods=['POST'])
def render_article():
    data = request.json or {}
    try:
        rendered_html = render_template('interactive_template.html', **build_render_context(data))
        return jsonify({"html": rendered_html})
    except Exception as e:
        return jsonify({"error": f"Erreur de rendu HTML : {str(e)}"}), 500


@app.route('/api/download', methods=['POST'])
def download_article():
    data = request.json or {}
    try:
        rendered_html = render_template('interactive_template.html', **build_render_context(data))
        raw_title = re.sub(r'<[^>]+>', '', str(data.get('title') or 'article-interactif'))
        slug = re.sub(r'[^a-zA-Z0-9]+', '-', enrich.deaccent(raw_title)).strip('-')[:60] or 'article-interactif'
        response = make_response(rendered_html)
        response.headers["Content-Disposition"] = f"attachment; filename={slug}.html"
        response.headers["Content-Type"] = "text/html; charset=utf-8"
        return response
    except Exception as e:
        return jsonify({"error": f"Erreur de téléchargement : {str(e)}"}), 500


@app.route('/api/ask', methods=['POST'])
def ask_article():
    """Répond à une question EN S'APPUYANT UNIQUEMENT sur le contenu de l'article.

    Si aucun fournisseur d'IA n'est joignable, on renvoie 503 : la carte bascule
    alors sur sa recherche de passages intégrée, qui fonctionne hors ligne.
    """
    data = request.json or {}
    question = (data.get('question') or '').strip()
    article = data.get('article') or {}
    if not question:
        return jsonify({"error": "Question vide."}), 400
    question = question[:400]

    corpus = enrich.article_corpus(article)
    if not corpus:
        return jsonify({"error": "Article vide."}), 400

    numbered = "\n".join(f"[{i}] {c['text']}" for i, c in enumerate(corpus))
    title = re.sub(r'<[^>]+>', '', str(article.get('title') or ''))

    prompt = f"""Tu réponds à la question d'un lecteur à propos d'un article de presse, en français.

TITRE : {title}

PHRASES DE L'ARTICLE (numérotées) :
{numbered}

QUESTION DU LECTEUR : {question}

Produis DEUX parties nettement séparées.

1) "answer" — CE QUE DIT L'ARTICLE :
   - Uniquement ce que contiennent les phrases ci-dessus.
   - Aucune connaissance extérieure, aucune estimation, aucune supposition.
   - Si l'article ne répond pas, mets "found": false et dis-le en une phrase.
   - 1 à 3 phrases, rédigées naturellement, sans citer de numéros de phrases.
   - "sources" : les numéros des phrases utilisées (1 à 3).

2) "context" — POUR COMPRENDRE (hors article) :
   - 2 à 4 phrases d'explication générale qui éclairent la question : de quoi
     s'agit-il, pourquoi cela compte, quel est l'usage courant du terme,
     quels repères connus aident à situer le sujet.
   - Cette partie s'appuie sur tes connaissances générales, PAS sur l'article.
   - Reste factuel et prudent. N'invente aucun chiffre précis, aucune date
     précise, aucun nom propre dont tu ne serais pas sûr. En cas de doute,
     reste général plutôt que d'affirmer.
   - Laisse "context" vide si tu n'as rien de solide à apporter.

Réponds UNIQUEMENT par un objet JSON valide, sans markdown :
{{"found": true, "answer": "...", "sources": [0, 3], "context": "..."}}"""

    callers = {'openai': call_openai, 'gemini': call_gemini,
               'mistral': call_mistral, 'groq': call_groq}
    providers = [(n, k) for n, k in (('openai', OPENAI_API_KEY), ('gemini', GEMINI_API_KEY),
                                     ('mistral', MISTRAL_API_KEY), ('groq', GROQ_API_KEY)) if k]

    for name, key in providers:
        try:
            result = callers[name](prompt, key)
            idx = [i for i in (result.get('sources') or [])
                   if isinstance(i, int) and 0 <= i < len(corpus)]

            # La réponse est affichée telle quelle : on l'échappe, puis on ne
            # réautorise que la mise en gras, et on retire les renvois internes.
            answer = str(result.get('answer') or '').strip()
            answer = re.sub(r'\s*\((?:phrases?|extraits?|sources?)\s*[\d,;\s]*(?:et\s*\d+\s*)?\)',
                            '', answer, flags=re.I)
            answer = html.escape(answer)
            answer = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', answer)

            context = str(result.get('context') or '').strip()
            context = html.escape(context)
            context = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', context)

            return jsonify({
                "found": bool(result.get('found', True)),
                "answer": answer,
                "provider": PROVIDER_LABELS.get(name, name),
                "sources": [{"text": corpus[i]['text'], "tab": corpus[i]['tab'],
                             "section": corpus[i]['section']} for i in idx[:3]],
                # Éclairage extérieur : explication générale + lectures réelles
                "context": context,
                "links": enrich.search_external(question, title,
                                               exclude_url=str(article.get('source_url') or '')),
            })
        except Exception as e:
            print(f"/api/ask : échec {name} — {e}")
            continue

    return jsonify({"error": "Aucun fournisseur d'IA disponible."}), 503


@app.route('/api/visual/options', methods=['POST'])
def visual_options():
    """Ce que l'article permet réellement de dessiner, et si l'option B est ouverte."""
    payload = request.json or {}
    data = payload.get('data') or {}
    text = (payload.get('text') or '').strip()
    try:
        layouts = visual.available_layouts(data, text)
    except Exception as e:
        return jsonify({"error": f"Analyse impossible : {str(e)}"}), 500
    return jsonify({
        "layouts": layouts,
        "image_providers": visual.image_providers_ready(),
    })


@app.route('/api/visual', methods=['POST'])
def build_visual_route():
    """Construit le visuel interactif : mise en page vectorielle (A) ou illustrée (B)."""
    payload = request.json or {}
    data = payload.get('data') or {}
    text = (payload.get('text') or '').strip()
    style = payload.get('style') if payload.get('style') in ('layers', 'photo') else 'svg'
    kind = payload.get('layout') or 'auto'
    count = payload.get('count')
    try:
        built = visual.build_visual(
            data, text, kind=kind, style=style,
            count=int(count) if count else None,
            provider=payload.get('provider') or None,
        )
    except Exception as e:
        return jsonify({"error": f"Génération du visuel impossible : {str(e)}"}), 500
    if not built:
        return jsonify({
            "error": "Cet article ne fournit pas assez d'éléments repérables dans le texte "
                     "pour bâtir un visuel dont chaque zone mène à un passage réel."
        }), 200
    return jsonify({"visual": built})


@app.route('/api/wilayas')
def list_wilayas():
    """Liste des wilayas disponibles pour la mini-carte."""
    data = enrich.load_wilayas()
    names = sorted({enrich.DISPLAY_NAMES.get(w["name"], w["name"]) for w in data["wilayas"]})
    return jsonify({"wilayas": names})


@app.route('/api/detect-theme', methods=['POST'])
def detect_theme_route():
    """Devine le thème couleur (opérateur / institution) à partir du texte."""
    text = (request.json or {}).get('text', '')
    flat = enrich.deaccent(enrich.strip_tags(text))[:6000]
    rules = [
        ("mobilis",       r"\bmobilis\b|atm mobilis",                 "#008543", "#7ec142", "Mobilis"),
        ("djezzy",        r"\bdjezzy\b|optimum telecom",              "#e30613", "#ffd100", "Djezzy"),
        ("ooredoo",       r"\booredoo\b|\bnedjma\b",                  "#ed1c24", "#ffffff", "Ooredoo"),
        ("sonelgaz",      r"\bsonelgaz\b|\bcreg\b|electricite",       "#004b87", "#f48120", "Sonelgaz"),
        ("sonatrach",     r"\bsonatrach\b|hydrogene|petrole|\bgaz\b", "#0d5c34", "#ffb347", "Sonatrach / Énergie"),
        ("algerie_poste", r"algerie poste|\bccp\b|\bbaridi\b",        "#0a2a5e", "#ffb347", "Algérie Poste"),
        ("at",            r"algerie telecom|\bidoom\b",               "#1b4a8b", "#ffb347", "Algérie Télécom"),
        ("startup",       r"\bstartup\b|incubateur|venture|hackathon","#5b1e6d", "#ffb347", "Écosystème Startups"),
    ]
    best = None
    for key, pattern, primary, accent, label in rules:
        hits = len(re.findall(pattern, flat))
        if hits and (best is None or hits > best["hits"]):
            best = {"key": key, "hits": hits, "primary": primary, "accent": accent, "label": label}
    if not best:
        return jsonify({"detected": False})
    return jsonify({
        "detected": True,
        "key": best["key"], "label": best["label"],
        "primary": best["primary"], "accent": best["accent"],
        "hits": best["hits"],
    })


# Rubriques reconnues par le site (voir le sélecteur de smart-ingest.html)
HUB_CATEGORIES = ['Algérie', 'Télécoms', 'Mobile', 'Startups', 'IA', 'Fintech',
                  'Innovation', 'Monde', 'Entreprises', 'Vidéo', 'Infographies']

HUB_CATEGORY_RULES = [
    ('Télécoms', r'telecom|operateur|mobilis|djezzy|ooredoo|algerie telecom|reseau|fibre|adsl|internet|arpce|4g|5g'),
    ('Mobile', r'\bmobile\b|smartphone|application mobile|android|ios|apk'),
    ('IA', r'intelligence artificielle|\bia\b|machine learning|generative|algorithme'),
    ('Fintech', r'fintech|paiement|banque|monetique|ccp|baridi|carte edahabia|dinar'),
    ('Startups', r'startup|incubateur|accelerateur|venture|levee de fonds|amorcage'),
    ('Innovation', r'innovation|recherche|brevet|numerique|digitalisation|transformation'),
    ('Entreprises', r'entreprise|societe|groupe|industrie|usine|production|investissement|economie|importation|exportation'),
    ('Monde', r'international|mondial|europe|afrique|etats-unis|chine|onu'),
    ('Algérie', r'algerie|algerien|wilaya|ministere|gouvernement|national'),
]


def map_hub_category(article, title=''):
    """Ramène la catégorie libre du générateur vers une rubrique du site."""
    raw = enrich.deaccent(str(article.get('category') or ''))
    for known in HUB_CATEGORIES:
        needle = enrich.deaccent(known).rstrip('s')   # « Télécom » vaut « Télécoms »
        if needle and needle in raw:
            return known

    blob = enrich.deaccent(" ".join([
        raw, title,
        re.sub(r'<[^>]+>', ' ', str(article.get('chapeau') or '')),
        " ".join(str(t) for t in ((article.get('footer') or {}).get('tags') or [])),
    ]))
    for category, pattern in HUB_CATEGORY_RULES:
        if re.search(pattern, blob):
            return category
    return 'Algérie'


@app.route('/api/send-to-hub', methods=['POST'])
def send_to_hub():
    """Pont vers le Hub Algeria Tech local (server.js).

    Trois envois possibles : l'article rédigé (.md), la carte interactive
    autonome (interactifs/<id>.html), ou les deux. En écrasement, les deux
    reprennent l'identifiant de l'article visé.
    """
    data = request.json or {}
    article = data.get('article') or {}
    hub_url = (data.get('hub_url') or os.environ.get('HUB_URL') or 'http://localhost:3000').rstrip('/')

    send = (data.get('send') or 'both').lower()
    target_id = str(data.get('target_id') or '').strip()
    overwrite = bool(data.get('overwrite')) and bool(target_id)

    if not str(hub_url).startswith(('http://localhost', 'http://127.0.0.1')):
        return jsonify({"error": "Le pont n'accepte que le Hub local (localhost)."}), 400
    if send not in ('md', 'html', 'both'):
        return jsonify({"error": "Type d'envoi inconnu."}), 400
    if target_id and not re.fullmatch(r'[A-Za-z0-9_-]+', target_id):
        return jsonify({"error": "Identifiant d'article cible invalide."}), 400
    if send == 'html' and not target_id:
        return jsonify({"error": "Indiquez l'article à enrichir pour n'envoyer que la carte interactive."}), 400

    title = re.sub(r'<[^>]+>', '', str(article.get('title') or '')).strip()
    if not title:
        return jsonify({"error": "Article sans titre : envoi refusé."}), 400

    body_parts = []
    chapeau = re.sub(r'<[^>]+>', '', str(article.get('chapeau') or '')).strip()
    if chapeau:
        body_parts.append(chapeau)
    for tab in article.get('tabs') or []:
        heading = str(tab.get('title') or '').strip()
        content = str(tab.get('content') or '').strip()
        if heading:
            body_parts.append("## " + heading)
        if content:
            body_parts.append(content)
        quote = (tab.get('quote') or {}).get('text')
        if quote:
            body_parts.append("> " + str(quote))
    closing = str((article.get('closing') or {}).get('text') or '').strip()
    if closing:
        body_parts.append(closing)

    # Le site ne connaît qu'une liste fermée de rubriques : une catégorie
    # libre inventée par l'IA n'apparaîtrait sous aucun filtre.
    hub_category = map_hub_category(article, title)

    # Illustration : une image locale (data:) est d'abord téléversée sur le Hub,
    # une URL ou un chemin existant est transmis tel quel.
    image_path = ''
    media_image = ((article.get('medias') or {}).get('image') or {}).get('url') or ''
    if media_image.startswith('data:image'):
        try:
            import base64
            header, _, b64 = media_image.partition(',')
            found = re.search(r'image/(\w+)', header)
            ext = '.' + (found.group(1) if found else 'jpg').replace('jpeg', 'jpg')
            files = {'photo': ('illustration' + ext, base64.b64decode(b64), 'image/' + ext.lstrip('.'))}
            up = requests.post(hub_url + "/api/upload-inline-image", files=files, timeout=25)
            if up.status_code < 400:
                image_path = (up.json() or {}).get('url', '')
        except Exception as exc:
            print("send-to-hub : televersement de l'illustration impossible - %s" % exc)
    elif media_image:
        image_path = media_image

    # L'identifiant du fichier : celui visé, sinon un nouveau.
    if send == 'html' or overwrite:
        article_id = target_id
    else:
        article_id = str(int(datetime.now().timestamp() * 1000))
    done = []

    # Réécrire seulement l'article ne doit pas effacer une carte déjà publiée.
    has_card = send in ('html', 'both')
    if not has_card and overwrite:
        try:
            probe = requests.head(hub_url + "/interactifs/" + article_id + ".html", timeout=5)
            has_card = probe.status_code < 400
        except Exception:
            has_card = False

    try:
        # 1. La carte interactive autonome
        if send in ('html', 'both'):
            rendered = render_template('interactive_template.html', **build_render_context(article))
            resp = requests.post(hub_url + "/api/interactif",
                                 json={"id": article_id, "html": rendered}, timeout=30)
            if resp.status_code >= 400:
                return jsonify({"error": "Carte interactive refusee (%s) : %s" % (resp.status_code, resp.text[:200])}), 502
            done.append("version interactive")

        # 2. L'article rédigé
        if send in ('md', 'both'):
            now = datetime.now()
            payload = {
                "id": article_id,
                "titre": title,
                "categorie": hub_category,
                "existingImage": image_path,
                "date": now.strftime('%Y-%m-%d'),
                "heure": now.strftime('%H:%M'),
                "extrait": (chapeau or title)[:280],
                "tags": ", ".join(t.lstrip('#') for t in ((article.get('footer') or {}).get('tags') or [])),
                "contenu": "\n\n".join(body_parts),
                "source": str((article.get('footer') or {}).get('source') or 'Algeria Tech'),
                "video": (article.get('medias') or {}).get('video', {}).get('url', '') or '',
                "type": "",
                "position": "",
                # Active le bouton « Version Interactive » sur la page de l'article
                "interactif": ("interactifs/" + article_id + ".html") if has_card else "",
                # Encadré « À retenir » affiché en tête de l'article sur le site
                "aretenir": " | ".join(enrich.build_takeaways(article)),
            }
            # Le Hub lit les champs via multer : il faut du multipart/form-data,
            # pas de l'urlencoded (sinon req.body arrive vide côté Node).
            multipart = {key: (None, str(val)) for key, val in payload.items()}
            resp = requests.post(hub_url + "/api/create-article", files=multipart, timeout=25)
            if resp.status_code >= 400:
                return jsonify({"error": "Le Hub a repondu %s : %s" % (resp.status_code, resp.text[:200])}), 502
            done.append("article rédigé")

        return jsonify({
            "success": True,
            "article_id": article_id,
            "overwritten": overwrite,
            "sent": done,
            "article_url": hub_url + "/article/" + article_id,
            "interactif_url": (hub_url + "/interactifs/" + article_id + ".html") if send in ('html', 'both') else None,
        })
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Hub injoignable sur %s. Lancez server.js puis reessayez." % hub_url}), 503
    except Exception as exc:
        return jsonify({"error": "Envoi impossible : %s" % exc}), 500


if __name__ == '__main__':
    # use_reloader=False : le rechargeur auto de Werkzeug scanne l'arborescence E:\algeria-tech
    # (des dizaines de milliers de fichiers) et provoque un MemoryError qui tue le serveur.
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=True, use_reloader=False)
