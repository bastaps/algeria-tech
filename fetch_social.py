"""
Algeria Tech — TIC Social Media Aggregator
==========================================
Agrège les posts officiels des institutions et opérateurs TIC algériens.
Sources : Flux RSS (officiels + rss.app) + Facebook Graph API (optionnel)
Traduction : Mistral AI (clé déjà configurée dans .env)
Automatisation : Windows Task Scheduler (toutes les 2h)

Usage:
  python fetch_social.py            → mise à jour complète
  python fetch_social.py --no-translate → sans traduction (plus rapide)
  python fetch_social.py --test     → affiche les sources sans sauvegarder
"""

import json
import os
import re
import sys
import time
import hashlib
import argparse
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

# Forcer UTF-8 sur Windows (PowerShell / cmd en CP1252 par defaut)
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

try:
    import requests
except ImportError:
    os.system(f'"{sys.executable}" -m pip install requests --user -q')
    import requests

try:
    from bs4 import BeautifulSoup
except ImportError:
    os.system(f'"{sys.executable}" -m pip install beautifulsoup4 --user -q')
    from bs4 import BeautifulSoup

# curl_cffi — imite le TLS fingerprint Chrome → contourne les protections TLS de FB/IG
# Uniquement activé quand des cookies de session sont fournis
try:
    from curl_cffi import requests as cffi_requests
    HAS_CURL_CFFI = True
except ImportError:
    cffi_requests = None
    HAS_CURL_CFFI = False

# ─── Chemins ──────────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent
CONFIG_FILE = BASE_DIR / "social_config.json"
OUTPUT_FILE = BASE_DIR / "tic_social.json"
ENV_FILE    = BASE_DIR / ".env"

# ─── Clés API (depuis .env ou variables d'environnement) ─────────────────────
def load_env():
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, _, v = line.partition('=')
                env[k.strip()] = v.strip()
    env.update(os.environ)
    return env

ENV = load_env()
MISTRAL_KEY  = ENV.get("MISTRAL_API_KEY", "")
FB_TOKEN     = ENV.get("FB_APP_TOKEN", "")
# RSSHub auto-hébergé — solution définitive pour FB/IG/X/LinkedIn/TikTok
# Déployez en 5 min sur Vercel : https://github.com/DIYgod/RSSHub#vercel
# Puis ajoutez RSSHUB_BASE_URL dans les secrets GitHub Actions
RSSHUB_BASE  = ENV.get("RSSHUB_BASE_URL", "").rstrip('/')

# ── Cookies de session sociale (NE JAMAIS mettre le mot de passe ici) ────────
# Utilisez un COMPTE DÉDIÉ au monitoring (pas votre compte perso).
# Extraction depuis Chrome : F12 → Application → Cookies → <domaine>
# Copier : "nom=valeur; nom2=valeur2; ..." → GitHub Secret correspondant
#
# FACEBOOK_COOKIES  → c_user, xs, datr, fr   (depuis facebook.com)
# INSTAGRAM_COOKIES → sessionid, csrftoken    (depuis instagram.com)
# Durée de vie : ~90 jours. Rafraîchir quand "[FB] ✗ Cookie expiré" apparaît.
FB_COOKIE = ENV.get("FACEBOOK_COOKIES", "").strip()
IG_COOKIE = ENV.get("INSTAGRAM_COOKIES", "").strip()

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlgeriaTech-Bot/2.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-DZ,fr;q=0.9,ar;q=0.8,en;q=0.7'
}

# ─── Catégories et ordre d'affichage ─────────────────────────────────────────
CATEGORY_ORDER = ["Ministère", "Opérateurs", "Infrastructure", "Équipementiers", "Régulateurs", "Médias TIC"]

# ─── Chargement config ────────────────────────────────────────────────────────
def load_config():
    if not CONFIG_FILE.exists():
        print(f"[ERREUR] Fichier de config introuvable : {CONFIG_FILE}")
        sys.exit(1)
    return json.loads(CONFIG_FILE.read_text(encoding='utf-8'))

# ─── Chargement données existantes ────────────────────────────────────────────
def load_existing():
    if OUTPUT_FILE.exists():
        try:
            return json.loads(OUTPUT_FILE.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {"posts": [], "lastUpdated": None, "stats": {}, "total": 0}

# ─── Sauvegarde ───────────────────────────────────────────────────────────────
def save_data(data):
    data["lastUpdated"] = datetime.now(timezone.utc).isoformat()
    data["total"]       = len(data["posts"])
    stats = {}
    for p in data["posts"]:
        cat = p.get("category", "Autre")
        stats[cat] = stats.get(cat, 0) + 1
    data["stats"] = stats
    OUTPUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"\n[✅] {len(data['posts'])} posts sauvegardés → {OUTPUT_FILE}")

# ─── Détection de langue ──────────────────────────────────────────────────────
def detect_lang(text: str) -> str:
    if not text:
        return 'fr'
    # Arabe : plage Unicode [؀-ۿ]
    ar_chars = len(re.findall(r'[؀-ۿ]', text))
    if ar_chars > max(len(text) * 0.15, 5):
        return 'ar'
    # Mots anglais courants
    en_words = {'the','and','is','are','we','our','for','of','to','an','with','this',
                'has','have','will','can','its','in','at','by','on','new','been'}
    words = set(text.lower().split())
    if len(en_words & words) >= 3:
        return 'en'
    return 'fr'

# ─── Traduction via Mistral ───────────────────────────────────────────────────
def translate_mistral(text: str, source_lang: str, source_name: str) -> dict:
    """Traduit dans les 2 autres langues via Mistral AI."""
    if not MISTRAL_KEY:
        print("  [!] MISTRAL_API_KEY non définie — traduction ignorée")
        return {source_lang: text}

    lang_names = {'ar': 'arabe', 'fr': 'français', 'en': 'anglais'}
    targets = [l for l in ['ar', 'fr', 'en'] if l != source_lang]

    prompt = (
        f"Tu es un traducteur expert en TIC et télécommunications.\n"
        f"Source : '{source_name}' (langue : {lang_names[source_lang]})\n\n"
        f"Texte à traduire :\n{text[:700]}\n\n"
        f"Traduis en {lang_names[targets[0]]} ET en {lang_names[targets[1]]}.\n"
        f"Réponds UNIQUEMENT en JSON avec les clés : 'ar', 'fr', 'en'.\n"
        f"Pour la langue source ({source_lang}), recopie le texte original."
    )

    try:
        res = requests.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {MISTRAL_KEY}", "Content-Type": "application/json"},
            json={
                "model": "mistral-small-latest",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
                "max_tokens": 800
            },
            timeout=30
        )
        result = res.json()
        translations = json.loads(result['choices'][0]['message']['content'])
        # Vérification minimale
        for key in ['ar', 'fr', 'en']:
            if key not in translations:
                translations[key] = text if key == source_lang else ""
        return translations
    except Exception as e:
        print(f"  [!] Traduction échouée ({e})")
        return {source_lang: text, 'fr': text if source_lang != 'fr' else text}

# ─── Nettoyage HTML ───────────────────────────────────────────────────────────
def clean_html(html_text: str) -> str:
    if not html_text:
        return ""
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    text = re.sub(r'\s{2,}', ' ', text)
    return text.strip()

# ─── ID unique ────────────────────────────────────────────────────────────────
def make_id(url_or_text: str) -> str:
    return hashlib.md5(url_or_text.encode('utf-8', errors='ignore')).hexdigest()[:16]

# ─── Parser RSS/Atom universel ────────────────────────────────────────────────
def parse_rss(content: bytes) -> list:
    items = []
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        # Tentative avec BeautifulSoup si XML mal formé
        try:
            soup = BeautifulSoup(content, 'xml')
            for item in soup.find_all('item')[:20]:
                t = item.find('title')
                l = item.find('link')
                d = item.find('description') or item.find('summary')
                pub = item.find('pubDate') or item.find('published') or item.find('updated')
                items.append({
                    'title': t.get_text(strip=True) if t else '',
                    'link':  l.get_text(strip=True) if l else '',
                    'desc':  clean_html(d.get_text() if d else ''),
                    'date':  pub.get_text(strip=True) if pub else ''
                })
            return items
        except Exception:
            return []

    ns = {
        'atom':    'http://www.w3.org/2005/Atom',
        'content': 'http://purl.org/rss/1.0/modules/content/',
        'dc':      'http://purl.org/dc/elements/1.1/'
    }

    # RSS 2.0
    for item in root.findall('.//item')[:20]:
        title = item.findtext('title', '').strip()
        link  = item.findtext('link', '').strip()
        desc  = item.findtext('description', '') or item.findtext('content:encoded', '', ns)
        pub   = item.findtext('pubDate', '') or item.findtext('dc:date', '', ns)
        items.append({'title': title, 'link': link, 'desc': clean_html(desc), 'date': pub})

    # RSS 1.0 (RDF — namespaced items)
    if not items:
        rss1 = 'http://purl.org/rss/1.0/'
        dc   = 'http://purl.org/dc/elements/1.1/'
        for item in root.findall(f'{{{rss1}}}item')[:20]:
            title = item.findtext(f'{{{rss1}}}title', '').strip()
            link  = item.findtext(f'{{{rss1}}}link', '').strip()
            desc  = item.findtext(f'{{{rss1}}}description', '')
            pub   = item.findtext(f'{{{dc}}}date', '')
            if title:
                items.append({'title': title, 'link': link, 'desc': clean_html(desc), 'date': pub})

    # Atom
    if not items:
        for entry in root.findall('atom:entry', ns)[:20]:
            title   = entry.findtext('atom:title', '', ns).strip()
            link_el = entry.find('atom:link', ns)
            link    = (link_el.attrib.get('href', '') if link_el is not None else '')
            content = (entry.findtext('atom:content', '', ns) or
                       entry.findtext('atom:summary', '', ns))
            pub     = (entry.findtext('atom:published', '', ns) or
                       entry.findtext('atom:updated', '', ns))
            items.append({'title': title, 'link': link, 'desc': clean_html(content), 'date': pub})

    return items

# ─── Fetch RSS ────────────────────────────────────────────────────────────────
def fetch_rss(source: dict) -> list:
    url = source.get('rss_url', '')
    if not url:
        return []

    try:
        res = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        if res.status_code == 402:
            print(f"  [RSS] ✗ {url[:50]} → 402 (rss.app payant — passez au canal Telegram/YouTube)")
            return []
        res.raise_for_status()
        parsed = parse_rss(res.content)
        count = len(parsed)
        print(f"  [RSS] ✓ {count} items ← {url[:60]}")
        for item in parsed:
            item.setdefault('source_type', 'rss')
        return parsed[:15]
    except Exception as e:
        print(f"  [RSS] ✗ {url[:50]} → {e}")
        return []

# ─── Fetch Facebook Graph API ─────────────────────────────────────────────────
def fetch_facebook_api(source: dict) -> list:
    """
    Utilise le Facebook Graph API pour récupérer les posts d'une page publique.
    Nécessite FB_APP_TOKEN dans .env (voir social_config.json pour instructions).
    """
    page_id = source.get('fb_page_id', '').strip()
    token   = source.get('fb_token', '') or FB_TOKEN

    if not page_id or not token:
        return []

    try:
        res = requests.get(
            f"https://graph.facebook.com/v21.0/{page_id}/posts",
            params={
                'access_token': token,
                'fields': 'message,story,created_time,permalink_url,full_picture',
                'limit': 10
            },
            headers=HEADERS,
            timeout=15
        )
        data = res.json()

        if 'error' in data:
            err_code = data['error'].get('code', '?')
            err_msg  = data['error'].get('message', 'Unknown error')
            if err_code in [190, 102, 463, 467]:
                print(f"  [FB]  ✗ Token invalide/expiré — renouvelez FB_APP_TOKEN dans .env")
            elif err_code in [100, 200, 10]:
                print(f"  [FB]  ✗ {page_id}: App Review requis (code {err_code}) → facebook-scraper prendra le relais")
            else:
                print(f"  [FB]  ✗ API {err_code}: {err_msg[:80]}")
            return []

        posts_raw = data.get('data', [])
        results = []
        for post in posts_raw:
            msg = post.get('message', '') or post.get('story', '')
            if not msg:
                continue
            results.append({
                'title':  msg[:120].replace('\n', ' ') + ('…' if len(msg) > 120 else ''),
                'link':   post.get('permalink_url', ''),
                'desc':   msg,
                'date':   post.get('created_time', ''),
                'image':  post.get('full_picture', '')
            })
        print(f"  [FB]  ✓ {len(results)} posts ← Graph API ({page_id})")
        return results

    except Exception as e:
        print(f"  [FB]  ✗ Graph API erreur : {e}")
        return []

# ─── Fetch Facebook mbasic (scraping HTML simplifié — sans compte) ───────────
def fetch_facebook_mbasic(source: dict) -> list:
    """
    Scrape les posts depuis mbasic.facebook.com — le site mobile allégé de Facebook.
    Fonctionne pour les pages PUBLIQUES sans authentification.
    Couvre TOUS les liens Facebook fournis sans limite de quota.
    Délai respectueux : 1 s entre chaque page.
    """
    page_id = source.get('fb_page_id', '').strip()
    if not page_id:
        return []

    # Headers mobile pour éviter d'être bloqué
    mob_headers = {
        'User-Agent': (
            'Mozilla/5.0 (Linux; Android 12; SM-A536B) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/112.0.0.0 Mobile Safari/537.36'
        ),
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-DZ,fr;q=0.9,ar;q=0.8,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection':      'keep-alive',
        'DNT':             '1',
    }

    urls_to_try = [
        f"https://mbasic.facebook.com/{page_id}",
        f"https://mbasic.facebook.com/pg/{page_id}/posts",
    ]

    items = []
    for url in urls_to_try:
        try:
            res = requests.get(url, headers=mob_headers, timeout=20,
                               allow_redirects=True)

            # Détection du mur de connexion
            if ('login' in res.url.lower()
                    or res.status_code in (302, 301, 403)
                    or 'se connecter' in res.text[:2000].lower()
                    or 'log in' in res.text[:2000].lower()):
                print(f"  [MBASIC] {page_id}: mur de connexion ou redirection")
                break

            soup = BeautifulSoup(res.text, 'html.parser')

            # Essai de plusieurs sélecteurs selon la version mbasic
            post_containers = (
                soup.find_all('div', attrs={'data-ft': True})  # Version récente
                or soup.find_all('div', id=lambda x: x and x.startswith('u_'))
                or soup.select('article')
                or soup.select('[data-store]')
            )

            seen_texts = set()
            for container in post_containers[:15]:
                # Extraire le texte principal
                text_nodes = container.find_all(['p', 'span'], recursive=True)
                text = ' '.join(
                    n.get_text(separator=' ', strip=True)
                    for n in text_nodes
                    if n.get_text(strip=True)
                ).strip()

                if len(text) < 25 or text in seen_texts:
                    continue

                # Éliminer les menus / navigation / boutons courts
                words = text.split()
                if len(words) < 5:
                    continue

                seen_texts.add(text)

                # Lien permanent du post
                link = ''
                for a in container.find_all('a', href=True):
                    href = a['href']
                    if '/permalink/' in href or '/posts/' in href:
                        link = (f"https://www.facebook.com{href}"
                                if href.startswith('/') else href)
                        link = link.split('?')[0]  # retirer les params tracking
                        break

                # Date : mbasic affiche souvent un texte relatif ("il y a 3h")
                date_str = datetime.now(timezone.utc).isoformat()

                items.append({
                    'title': text[:130] + ('…' if len(text) > 130 else ''),
                    'link':  link,
                    'desc':  text[:800],
                    'date':  date_str,
                    'image': ''
                })

            if items:
                print(f"  [MBASIC] {page_id}: {len(items)} posts extraits")
                break  # Succès sur cette URL, inutile d'essayer la suivante
            else:
                print(f"  [MBASIC] {page_id}: aucun post détecté sur {url}")

            time.sleep(1)  # Délai respectueux entre requêtes

        except Exception as e:
            print(f"  [MBASIC] {page_id}: {e}")

    return items[:12]

# ─── Fetch depuis le cache Apify (apify_cache.json) ─────────────────────────
def fetch_apify_cache(source: dict) -> list:
    """
    Lit les posts pré-récupérés par fetch_apify_facebook.py via l'API Apify.
    Le cache est généré en amont (GitHub Action ou tâche locale).
    Aucun appel réseau ici — lecture seule du fichier JSON local.
    """
    cache_file = BASE_DIR / "apify_cache.json"
    if not cache_file.exists():
        return []

    page_id = source.get('fb_page_id', '').strip()
    if not page_id:
        return []

    try:
        cache = json.loads(cache_file.read_text(encoding='utf-8'))
        posts = cache.get('pages', {}).get(page_id, [])
        if posts:
            generated = cache.get('generated', '')[:10]
            print(f"  [APIFY] ✓ {len(posts)} posts ← cache du {generated} ({page_id})")
        return posts
    except Exception:
        return []

# ─── Fetch Facebook via librairie facebook-scraper ───────────────────────────
def fetch_facebook_scraper_lib(source: dict) -> list:
    """
    Utilise facebook-scraper (pip install facebook-scraper) — zéro compte requis
    pour les pages publiques. Gère automatiquement l'évolution du HTML de Facebook.
    Cookie optionnel : créez facebook_cookies.json (voir setup_facebook_cookies.py)
    pour les pages qui nécessitent une connexion.
    """
    page_id = source.get('fb_page_id', '').strip()
    if not page_id:
        return []

    # Auto-install silencieux (facebook-scraper + lxml_html_clean requis)
    try:
        from facebook_scraper import get_posts
    except (ImportError, RuntimeError):
        print("  [FB-SC] Installation de facebook-scraper + lxml_html_clean...")
        os.system(f'"{sys.executable}" -m pip install facebook-scraper lxml_html_clean --user -q')
        try:
            from facebook_scraper import get_posts
        except Exception as exc:
            print(f"  [FB-SC] ✗ Import échoué : {exc}")
            return []

    # Cookies optionnels (Cookie-Editor JSON ou dict simple)
    cookies_file = BASE_DIR / "facebook_cookies.json"
    cookies = None
    if cookies_file.exists():
        try:
            raw = json.loads(cookies_file.read_text(encoding='utf-8'))
            if isinstance(raw, list):    # Format Cookie-Editor [{name, value, ...}]
                cookies = {c['name']: c['value'] for c in raw
                           if 'name' in c and 'value' in c}
            elif isinstance(raw, dict):  # Format dict simple {name: value}
                cookies = raw
        except Exception:
            pass

    try:
        items = []
        kwargs = {
            'pages': 3,
            'timeout': 30,
            'options': {'allow_extra_requests': False, 'progress': False},
        }
        if cookies:
            kwargs['cookies'] = cookies

        for post in get_posts(page_id, **kwargs):
            text = (post.get('post_text') or post.get('text') or
                    post.get('shared_text') or '').strip()
            if len(text) < 10:
                continue

            pub_time = post.get('time')
            if pub_time:
                try:
                    date_str = pub_time.astimezone(timezone.utc).isoformat()
                except Exception:
                    date_str = datetime.now(timezone.utc).isoformat()
            else:
                date_str = datetime.now(timezone.utc).isoformat()

            img = (post.get('image') or
                   (post.get('images') or [None])[0] or '')

            items.append({
                'title': text[:130].replace('\n', ' ') + ('…' if len(text) > 130 else ''),
                'link':  post.get('post_url', ''),
                'desc':  text[:800],
                'date':  date_str,
                'image': img
            })
            if len(items) >= 10:
                break

        if items:
            print(f"  [FB-SC] ✓ {len(items)} posts ← {page_id}")
        else:
            print(f"  [FB-SC] ✗ {page_id}: aucun post (page vide ou structure inconnue)")
        return items

    except Exception as e:
        err = str(e)
        if any(w in err.lower() for w in ('login', 'checkpoint', 'block', 'captcha', 'too many')):
            print(f"  [FB-SC] ✗ {page_id}: connexion requise → lancez setup_facebook_cookies.py")
        elif 'timeout' in err.lower():
            print(f"  [FB-SC] ✗ {page_id}: timeout (Facebook lent)")
        else:
            print(f"  [FB-SC] ✗ {page_id}: {err[:100]}")
        return []

# ─── Fetch via RSSHub auto-hébergé ───────────────────────────────────────────
def fetch_rsshub(source: dict) -> list:
    """
    Récupère les posts sociaux via une instance RSSHub personnelle.
    RSSHub = agrégateur open-source qui couvre FB, IG, X, LinkedIn, TikTok.
    Déploiement gratuit sur Vercel : https://github.com/DIYgod/RSSHub#vercel
    → Ajoutez RSSHUB_BASE_URL dans les secrets GitHub Actions une fois déployé.

    Ordre de priorité : Facebook → Instagram → X/Twitter → TikTok → LinkedIn
    """
    if not RSSHUB_BASE:
        return []

    candidates = []

    # Facebook (priorité maximale — principal vecteur d'info institutionnel en Algérie)
    if source.get('fb_page_id'):
        candidates.append((f"{RSSHUB_BASE}/facebook/page/{source['fb_page_id']}", 'facebook'))

    # Instagram
    if source.get('ig_user'):
        candidates.append((f"{RSSHUB_BASE}/instagram/user/{source['ig_user']}", 'instagram'))

    # X / Twitter
    if source.get('x_handle'):
        candidates.append((f"{RSSHUB_BASE}/twitter/user/{source['x_handle']}", 'twitter'))

    # TikTok
    if source.get('tiktok_user'):
        tuser = source['tiktok_user'].lstrip('@')
        candidates.append((f"{RSSHUB_BASE}/tiktok/user/@{tuser}", 'tiktok'))

    # LinkedIn
    if source.get('linkedin_company'):
        candidates.append((f"{RSSHUB_BASE}/linkedin/company/{source['linkedin_company']}", 'linkedin'))

    for url, platform in candidates:
        try:
            res = requests.get(url, headers=HEADERS, timeout=15)
            if res.status_code in (401, 403, 404, 422):
                # 422 = cookie requis non configuré dans RSSHub
                print(f"  [RSH] ✗ {platform}: {res.status_code} (configurez le cookie dans RSSHub)")
                continue
            res.raise_for_status()
            parsed = parse_rss(res.content)
            if parsed:
                for item in parsed:
                    item['source_type'] = platform
                print(f"  [RSH] ✓ {len(parsed)} posts ← {platform} ({url.split('/')[-1]})")
                return parsed[:15]
        except Exception as e:
            print(f"  [RSH] ✗ {platform}: {str(e)[:60]}")

    return []


# ─── Helper : décodage JSON string Facebook ───────────────────────────────────
def _fb_unescape(s: str) -> str:
    """
    Décode les séquences d'échappement JSON (\\n, \\uXXXX, paires de surrogates pour emoji).
    Utilise json.loads pour gérer correctement \\uD83D\\uDE00 → 😀 sans surrogates isolés.
    """
    try:
        # json.loads combine automatiquement les paires de surrogates en emoji valides
        return json.loads('"' + s + '"')
    except (json.JSONDecodeError, ValueError):
        try:
            # Fallback : guillemets non échappés dans le texte
            return json.loads('"' + s.replace('"', '\\"') + '"')
        except Exception:
            # Dernier recours : substitutions basiques
            return (s.replace('\\n', '\n').replace('\\/', '/')
                     .replace('\\"', '"').replace('\\\\', '\\'))


# ─── Fetch Facebook via cookie de session authentifiée ───────────────────────
def fetch_facebook_cookie(source: dict) -> list:
    """
    Accède à facebook.com/{page} avec un cookie de session Chrome exporté.
    Extrait les textes de posts depuis les blobs JSON embarqués dans la page.

    Variable d'environnement requise : FACEBOOK_COOKIES (GitHub Secret)
    Format : "c_user=1234567890; xs=Abc...; datr=Xyz...; fr=..."

    Comment extraire vos cookies (une fois par ~90 jours) :
      1. Connectez-vous sur facebook.com avec un compte DÉDIÉ monitoring
      2. F12 → onglet "Application" → "Cookies" → "https://www.facebook.com"
      3. Copiez c_user, xs, datr, fr dans la valeur du secret FACEBOOK_COOKIES
    """
    if not FB_COOKIE or not HAS_CURL_CFFI:
        return []
    page_id = source.get('fb_page_id', '').strip()
    if not page_id:
        return []

    url = f"https://www.facebook.com/{page_id}/"
    try:
        r = cffi_requests.get(url, impersonate='chrome124', headers={
            'Cookie': FB_COOKIE,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-DZ,fr;q=0.9,ar;q=0.8,en;q=0.7',
        }, timeout=25)

        # Redirection vers /login/ → cookie expiré ou compte suspendu
        if 'login' in r.url.lower() or r.status_code != 200:
            print(f"  [FB]  ✗ Cookie expiré ou page introuvable → renouvelez FACEBOOK_COOKIES")
            return []

        html = r.text

        # ── Extraction des textes de posts depuis le JSON React embarqué ──────
        # Pattern principal : "message":{"text":"<post>"}
        raw_texts = re.findall(
            r'"message":\{"text":"((?:[^"\\]|\\.){20,1500})"\}',
            html
        )
        # Pattern alternatif pour certaines pages : "story":{"message":{"text":"..."}}
        if not raw_texts:
            raw_texts = re.findall(
                r'"story":\{"[^}]*"message":\{"text":"((?:[^"\\]|\\.){20,1500})"\}',
                html
            )

        # ── Timestamps et liens ────────────────────────────────────────────────
        raw_times = re.findall(r'"creation_time":(\d{10})', html)
        raw_links = re.findall(
            r'"url":"(https://www\.facebook\.com/(?:permalink|[^"]{5,80}/posts/)[^"]{5,80})"',
            html
        )

        items = []
        seen = set()
        for i, raw in enumerate(raw_texts[:12]):
            text = _fb_unescape(raw).strip()
            if len(text) < 20 or text in seen:
                continue
            seen.add(text)

            ts = int(raw_times[i]) if i < len(raw_times) else None
            date = (datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
                    if ts else datetime.now(timezone.utc).isoformat())
            link = (raw_links[i].replace('\\/', '/')
                    if i < len(raw_links)
                    else f"https://www.facebook.com/{page_id}")

            items.append({
                'title': text[:130].replace('\n', ' ') + ('…' if len(text) > 130 else ''),
                'link':  link,
                'desc':  text[:800],
                'date':  date,
                'source_type': 'facebook'
            })

        if items:
            print(f"  [FB]  ✓ {len(items)} posts ← facebook.com/{page_id}")
        else:
            print(f"  [FB]  ✗ {page_id}: aucun post extrait (JSON structure inattendue)")
        return items

    except Exception as e:
        print(f"  [FB]  ✗ {page_id}: {str(e)[:80]}")
        return []


# ─── Fetch Instagram via cookie de session + API mobile ───────────────────────
def fetch_instagram_cookie(source: dict) -> list:
    """
    Appelle l'API mobile interne d'Instagram avec un cookie de session Chrome.
    Retourne les derniers posts (légendes texte uniquement).

    Variable d'environnement requise : INSTAGRAM_COOKIES (GitHub Secret)
    Format : "sessionid=Abc123...; csrftoken=Xyz..."

    Comment extraire vos cookies (une fois par ~90 jours) :
      1. Connectez-vous sur instagram.com avec un compte DÉDIÉ monitoring
      2. F12 → onglet "Application" → "Cookies" → "https://www.instagram.com"
      3. Copiez sessionid et csrftoken dans la valeur du secret INSTAGRAM_COOKIES
    """
    if not IG_COOKIE or not HAS_CURL_CFFI:
        return []
    ig_user = source.get('ig_user', '').strip()
    if not ig_user:
        return []

    url = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={ig_user}"
    try:
        r = cffi_requests.get(url, impersonate='chrome124', headers={
            'Cookie': IG_COOKIE,
            'x-ig-app-id': '936619743392459',  # ID public de l'app web Instagram
            'Accept': 'application/json',
            'Accept-Language': 'fr-DZ,fr;q=0.9',
            'Referer': f'https://www.instagram.com/{ig_user}/',
        }, timeout=20)

        if r.status_code == 401:
            print(f"  [IG]  ✗ Cookie expiré → renouvelez INSTAGRAM_COOKIES")
            return []
        if r.status_code == 404:
            print(f"  [IG]  ✗ @{ig_user}: compte introuvable")
            return []
        r.raise_for_status()

        data = r.json()
        user = data.get('data', {}).get('user', {})
        edges = user.get('edge_owner_to_timeline_media', {}).get('edges', [])

        items = []
        for edge in edges[:10]:
            node = edge.get('node', {})
            cap_edges = node.get('edge_media_to_caption', {}).get('edges', [])
            text = cap_edges[0]['node']['text'] if cap_edges else ''
            if not text or len(text) < 10:
                continue

            shortcode = node.get('shortcode', '')
            timestamp = node.get('taken_at_timestamp', 0)
            img_url   = node.get('display_url', '')

            items.append({
                'title': text[:130].replace('\n', ' ') + ('…' if len(text) > 130 else ''),
                'link':  (f"https://www.instagram.com/p/{shortcode}/"
                          if shortcode else f"https://www.instagram.com/{ig_user}/"),
                'desc':  text[:800],
                'date':  (datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
                          if timestamp else datetime.now(timezone.utc).isoformat()),
                'image': img_url,
                'source_type': 'instagram'
            })

        if items:
            print(f"  [IG]  ✓ {len(items)} posts ← instagram.com/{ig_user}")
        else:
            print(f"  [IG]  ✗ {ig_user}: aucun post (compte vide ou cookie invalide)")
        return items

    except Exception as e:
        print(f"  [IG]  ✗ {ig_user}: {str(e)[:80]}")
        return []


# ─── Fetch Telegram public channel (t.me/s/) ─────────────────────────────────
def fetch_telegram(source: dict) -> list:
    """
    Scrape les messages d'un canal Telegram PUBLIC via t.me/s/{channel}.
    Zéro authentification — fonctionne pour tout canal public, stable, gratuit.
    Ajouter 'telegram_channel' dans social_config.json pour activer.
    """
    channel = source.get('telegram_channel', '').strip().lstrip('@')
    if not channel:
        return []

    url = f"https://t.me/s/{channel}"
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        if res.status_code == 404:
            print(f"  [TG]  ✗ @{channel}: canal introuvable (404)")
            return []
        res.raise_for_status()

        soup = BeautifulSoup(res.text, 'html.parser')

        # Canal privé : Telegram ne montre aucun message ET affiche un bouton join
        has_messages = bool(soup.select('.tgme_widget_message_wrap'))
        if not has_messages and soup.select_one('.tgme_page_action_join'):
            print(f"  [TG]  ✗ @{channel}: canal privé (join requis — vérifiez le nom)")
            return []

        items = []
        seen = set()

        for msg in soup.select('.tgme_widget_message_wrap'):
            text_el = msg.select_one('.tgme_widget_message_text')
            if not text_el:
                # Essai sur les légendes des photos/vidéos
                text_el = msg.select_one('.tgme_widget_message_photo_caption')
            if not text_el:
                continue
            text = text_el.get_text(separator=' ', strip=True)
            if len(text) < 15 or text in seen:
                continue
            seen.add(text)

            date_el = msg.select_one('time[datetime]')
            date_str = date_el['datetime'] if date_el else datetime.now(timezone.utc).isoformat()

            link_el = msg.select_one('a.tgme_widget_message_date')
            link = link_el['href'] if link_el else f"https://t.me/{channel}"

            img = ''
            img_el = msg.select_one('.tgme_widget_message_photo_wrap')
            if img_el:
                m = re.search(r"url\('([^']+)'\)", img_el.get('style', ''))
                if m:
                    img = m.group(1)

            items.append({
                'title': text[:130].replace('\n', ' ') + ('…' if len(text) > 130 else ''),
                'link':  link,
                'desc':  text[:800],
                'date':  date_str,
                'image': img,
                'source_type': 'telegram'
            })

        print(f"  [TG]  ✓ {len(items)} messages ← @{channel}")
        return items[:15]

    except Exception as e:
        print(f"  [TG]  ✗ @{channel}: {e}")
        return []


# ─── Fetch YouTube RSS (API Google publique) ──────────────────────────────────
def fetch_youtube(source: dict) -> list:
    """
    Récupère les dernières vidéos via le flux Atom officiel de YouTube.
    Supporte 'youtube_channel_id' (format UCxxx) ET 'youtube_user' (ancien format /user/).
    Zéro authentification — API Google publique, stable, gratuite.
    """
    channel_id = source.get('youtube_channel_id', '').strip()
    youtube_user = source.get('youtube_user', '').strip()

    if channel_id:
        url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    elif youtube_user:
        url = f"https://www.youtube.com/feeds/videos.xml?user={youtube_user}"
    else:
        return []
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        res.raise_for_status()
        parsed = parse_rss(res.content)
        for item in parsed:
            item['source_type'] = 'youtube'
        label = channel_id or youtube_user
        print(f"  [YT]  ✓ {len(parsed)} vidéos ← YouTube/{label[:20]}")
        return parsed[:10]
    except Exception as e:
        print(f"  [YT]  ✗ YouTube/{channel_id[:20]}: {e}")
        return []


# ─── Scraping page officielle de presse/actualités ───────────────────────────
def fetch_news_page(source: dict) -> list:
    """
    Scrape la page officielle d'actualités d'un organisme (fallback sans RSS ni token).
    Stratégie : chercher les titres (h2/h3/h4) accompagnés d'un lien interne.
    Fonctionne pour : Djezzy, Mobilis, Algérie Télécom, et tout CMS standard.
    """
    news_url = source.get('news_url', '')
    if not news_url:
        return []

    try:
        import warnings
        from urllib.parse import urljoin, urlparse
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            res = requests.get(news_url, headers=HEADERS, timeout=20,
                               allow_redirects=True, verify=False)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, 'html.parser')

        base = urlparse(news_url)
        origin = f"{base.scheme}://{base.netloc}"

        DATE_RX = re.compile(
            r'\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}'       # DD/MM/YYYY
            r'|\b\d{4}[/\-.]\d{2}[/\-.]\d{2}'           # YYYY-MM-DD
            r'|\b\d{1,2}\s+\w{3,10}\.?\s+\d{4}\b',      # DD Mois YYYY
            re.IGNORECASE
        )

        items = []
        seen = set()

        for heading in soup.find_all(['h2', 'h3', 'h4']):
            title = heading.get_text(strip=True)
            if len(title) < 10:
                continue

            # Cherche un lien (du plus proche au plus lointain) :
            # - Dans le titre        : <h3><a href>...</a></h3>              (Mobilis)
            # - Ancêtre = ancre      : <a href><..><h3>...</h3></..></a>      (Djezzy)
            # - Frère dans conteneur : <article><header><h3/></header><a/></article>  (AT)
            a = heading.find('a', href=True)
            if not a:
                node = heading.parent
                for _ in range(5):
                    if node is None:
                        break
                    if node.name == 'a' and node.get('href'):
                        a = node          # le heading EST dans l'ancre
                        break
                    a = node.find('a', href=True)
                    if a:
                        break             # premier lien trouvé dans ce conteneur
                    node = node.parent
            if not a:
                continue

            href = a['href']
            if href.startswith(('#', 'mailto:', 'tel:')):
                continue

            abs_url = urljoin(origin, href)
            if urlparse(abs_url).netloc != base.netloc:
                continue
            if abs_url == news_url or abs_url in seen:
                continue
            seen.add(abs_url)

            # Date : cherche dans le conteneur parent (jusqu'à 4 niveaux)
            date_str = ''
            node = heading.parent
            for _ in range(4):
                if node is None:
                    break
                m = DATE_RX.search(node.get_text(' '))
                if m:
                    date_str = m.group()
                    break
                node = node.parent

            items.append({
                'title': title,
                'link':  abs_url,
                'desc':  title,
                'date':  date_str or datetime.now(timezone.utc).isoformat(),
                'source_type': 'web'
            })

        print(f"  [WEB] {'✓' if items else '✗'} {len(items)} articles ← {news_url[:60]}")
        return items[:15]

    except Exception as e:
        print(f"  [WEB] ✗ {news_url[:50]} → {e}")
        return []

# ─── Construire un objet post standardisé ────────────────────────────────────
def build_post(raw: dict, source: dict, do_translate: bool) -> dict:
    title   = raw.get('title', '')
    desc    = raw.get('desc', '')
    link    = raw.get('link', '')
    date    = raw.get('date', datetime.now(timezone.utc).isoformat())
    image   = raw.get('image', '')

    # Texte principal = description si longue, sinon titre
    main_text = desc if len(desc) > len(title) else title
    if title and desc and desc != title:
        main_text = title + (' — ' + desc[:300] if desc else '')

    main_text = main_text.strip()
    lang = detect_lang(main_text)

    # Traduction
    if do_translate and MISTRAL_KEY and main_text and len(main_text) > 15:
        translations = translate_mistral(main_text, lang, source['name'])
        time.sleep(0.3)  # éviter le rate-limiting Mistral
    else:
        translations = {lang: main_text}
        for l in ['ar', 'fr', 'en']:
            if l not in translations:
                translations[l] = ''

    uid = make_id(link or main_text[:80])

    return {
        'id':            uid,
        'source_name':   source['name'],
        'source_short':  source.get('short', source['name'][:2].upper()),
        'source_color':  source.get('color', '#006233'),
        'category':      source.get('category', 'Autre'),
        'category_icon': source.get('icon', '🏢'),
        'url':           link,
        'image':         image,
        'date':          date,
        'lang_source':   lang,
        'text':          translations,
        'source_type':   raw.get('source_type', 'rss')
    }

# ─── Filtrage qualité ─────────────────────────────────────────────────────────
TIC_KEYWORDS = [
    'télécom', 'telecom', 'mobile', '5g', '4g', 'réseau', 'internet', 'fibre',
    'numérique', 'digital', 'data', 'réseau', 'opérateur', 'infrastructure',
    'satellite', 'tic', 'mpt', 'poste', 'connectivité', 'bandwidth', 'network',
    'innovation', 'startup', 'tech', 'ia', 'intelligence artificielle', 'ai',
    'cloud', 'cybersécurité', 'sécurité', 'logiciel', 'algorithme', 'signal',
    'antenne', 'déploiement', 'couverture', 'haut débit', 'broadband',
    'ooredoo', 'djezzy', 'mobilis', 'algérie télécom', 'algerietelecom',
    'ericsson', 'huawei', 'nokia', 'arpce', 'arpt', 'algersat'
]

def is_tic_relevant(post: dict, source: dict) -> bool:
    """
    Filtre les posts non pertinents TIC.
    Sources spécialisées → on garde tout sans filtrage.
    Sources généralistes → filtrage par mots-clés.
    """
    # Toutes les sources TIC institutionnelles et médias : on garde tout
    if source.get('category') in [
        'Ministère', 'Opérateurs', 'Infrastructure',
        'Équipementiers', 'Régulateurs', 'Médias TIC'
    ]:
        return True

    # Pour Tech International et autres : vérification des mots-clés
    text_all = ' '.join(post.get('text', {}).values()).lower()
    return any(kw in text_all for kw in TIC_KEYWORDS)

# ─── Programme principal ──────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Algeria Tech — TIC Social Aggregator')
    parser.add_argument('--no-translate', action='store_true', help='Désactiver la traduction Mistral')
    parser.add_argument('--test',         action='store_true', help='Mode test (affiche sans sauvegarder)')
    parser.add_argument('--source',       type=str, default='', help='Traiter une seule source (par nom)')
    args = parser.parse_args()

    do_translate = not args.no_translate

    print("\n=== Algeria Tech - TIC Social Aggregator ===")
    print(f"    {datetime.now().strftime('%d/%m/%Y %H:%M')}  | Traduction: {'OUI (Mistral)' if do_translate and MISTRAL_KEY else 'NON'}")
    print("=" * 45 + "\n")

    config    = load_config()
    existing  = load_existing()
    seen_ids  = {p['id'] for p in existing.get('posts', [])}
    new_posts = []

    sources = [s for s in config.get('sources', [])
               if s.get('name') and s.get('enabled', True)]
    if args.source:
        sources = [s for s in sources if args.source.lower() in s['name'].lower()]

    print(f"Sources actives : {len(sources)}")

    for src in sources:
        print(f"\n▶ {src['name']} [{src['category']}]")
        raw_items = []

        # ── Méthode 1 : Flux RSS officiel direct ─────────────────────────────
        if src.get('rss_url'):
            raw_items.extend(fetch_rss(src))

        # ── Méthode 2 : RSSHub auto-hébergé ──────────────────────────────────
        if not raw_items:
            raw_items.extend(fetch_rsshub(src))

        # ── Méthode 3 : YouTube RSS — toujours tenté en complément ───────────
        #    Gratuit, sans authentification, flux Atom officiel Google.
        #    Ajoute des vidéos récentes même quand le RSS renvoie déjà des articles.
        if src.get('youtube_channel_id') or src.get('youtube_user'):
            raw_items.extend(fetch_youtube(src))

        # ── Méthode 4 : Telegram public — toujours tenté en complément ───────
        #    t.me/s/ zéro-auth, stable, gratuit. Canaux publics DZ très actifs.
        if src.get('telegram_channel'):
            raw_items.extend(fetch_telegram(src))

        # ── Méthode 5a : Facebook via cookie de session Chrome ───────────────
        if not raw_items and src.get('fb_page_id') and FB_COOKIE:
            raw_items.extend(fetch_facebook_cookie(src))

        # ── Méthode 5b : Instagram via cookie de session Chrome ──────────────
        if not raw_items and src.get('ig_user') and IG_COOKIE:
            raw_items.extend(fetch_instagram_cookie(src))

        # ── Méthode 6 : Cache Apify ───────────────────────────────────────────
        if not raw_items and src.get('fb_page_id'):
            raw_items.extend(fetch_apify_cache(src))

        # ── Méthode 7 : Scraping du site officiel (dernier recours) ──────────
        if not raw_items and src.get('news_url'):
            raw_items.extend(fetch_news_page(src))

        # ── Dédupliquer par URL (sources multiples peuvent retourner le même lien)
        seen_links: set = set()
        deduped: list = []
        for item in raw_items:
            key = (item.get('link') or item.get('title', '')[:60]).strip()
            if key and key not in seen_links:
                seen_links.add(key)
                deduped.append(item)
        raw_items = deduped[:20]  # Limite 20 items par source

        if not raw_items:
            print(f"  [—] Aucune donnée disponible pour cette source")
            continue

        # Construire les posts
        for raw in raw_items:
            post = build_post(raw, src, do_translate)
            if post['id'] in seen_ids:
                continue
            if not is_tic_relevant(post, src):
                continue
            seen_ids.add(post['id'])
            new_posts.append(post)

        print(f"  → {len([p for p in new_posts if p['source_name'] == src['name']])} nouveaux posts")

    if args.test:
        print(f"\n[MODE TEST] {len(new_posts)} nouveaux posts trouvés (non sauvegardés)")
        for p in new_posts[:3]:
            print(f"  • {p['source_name']} | {p['category']} | {p['text'].get('fr', '')[:80]}…")
        return

    # Fusion + déduplication + tri + limite 300
    def parse_post_date(p):
        raw = p.get('date', '')
        if not raw:
            return datetime.min.replace(tzinfo=timezone.utc)
        # RFC 2822 : "Wed, 27 May 2026 21:03:20 +0000"
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(raw)
        except Exception:
            pass
        # ISO 8601 : "2026-06-06T07:14:53+00:00"
        try:
            dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)

    all_posts = new_posts + existing.get('posts', [])
    all_posts.sort(key=parse_post_date, reverse=True)

    # ── Quota minimum par catégorie institutionnelle ─────────────────────────
    # Garantit que chaque catégorie TIC algérienne est visible, même si ses
    # articles ont des dates plus anciennes que le reste du pool.
    MIN_PER_CAT = {
        'Ministère':      20,
        'Opérateurs':     20,
        'Infrastructure': 20,
        'Équipementiers': 20,
    }
    TOTAL_CAP = 300

    # Construire le pool en deux passes :
    # 1re passe : remplir les quotas avec les posts les plus récents par catégorie
    # 2e passe : compléter jusqu'à TOTAL_CAP avec les posts les plus récents globaux
    reserved: list = []
    reserved_ids: set = set()
    by_cat: dict = {}
    for p in all_posts:
        cat = p.get('category', '')
        by_cat.setdefault(cat, []).append(p)

    for cat, quota in MIN_PER_CAT.items():
        for p in (by_cat.get(cat) or [])[:quota]:
            if p['id'] not in reserved_ids:
                reserved.append(p)
                reserved_ids.add(p['id'])

    # Compléter avec les posts les plus récents non encore retenus
    remainder = [p for p in all_posts if p['id'] not in reserved_ids]
    combined = reserved + remainder
    combined = combined[:TOTAL_CAP]

    save_data({"posts": combined, "lastUpdated": None, "stats": {}, "total": 0})

    # Résumé
    print("\n--- Resume par categorie ---")
    cat_counts = {}
    for p in all_posts:
        cat = p.get('category', 'Autre')
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    for cat in CATEGORY_ORDER:
        if cat in cat_counts:
            print(f"  {cat:<22} {cat_counts[cat]:>4} posts")

    print(f"\n[TOTAL] {len(all_posts)} posts | {len(new_posts)} nouveaux ce cycle")
    print("=" * 48 + "\n")

if __name__ == "__main__":
    main()
