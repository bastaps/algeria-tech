#!/usr/bin/env python3
"""
Algeria Tech — Setup des cookies Facebook pour la veille TIC
=============================================================
Ces cookies permettent à fetch_social.py d'accéder aux pages Facebook
qui nécessitent une connexion.  Configuration UNE SEULE FOIS, ensuite
tout est automatique.

Usage :
  python setup_facebook_cookies.py          → instructions + vérification
  python setup_facebook_cookies.py --test   → teste un accès Facebook
"""

import json
import sys
from pathlib import Path

BASE_DIR     = Path(__file__).parent
COOKIES_FILE = BASE_DIR / "facebook_cookies.json"

INSTRUCTIONS = """
╔══════════════════════════════════════════════════════════════════════╗
║         SETUP COOKIES FACEBOOK — Algeria Tech Veille Sociale         ║
╚══════════════════════════════════════════════════════════════════════╝

Les cookies Facebook permettent de récupérer le contenu des pages
qui nécessitent une connexion.  Durée : 30 à 90 jours.

─────────────────────────────────────────────────────────────────────
ÉTAPE 1 — Connectez-vous sur Facebook dans Chrome ou Firefox
  → https://www.facebook.com (votre compte personnel, n'importe lequel)

ÉTAPE 2 — Installez l'extension "Cookie-Editor"
  Chrome  : https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm
  Firefox : https://addons.mozilla.org/fr/firefox/addon/cookie-editor/

ÉTAPE 3 — Exportez les cookies Facebook
  → Sur facebook.com, cliquez sur l'icône Cookie-Editor dans la barre
  → Cliquez "Export" → "Export as JSON"  (ou Ctrl+C pour copier)

ÉTAPE 4 — Sauvegardez dans :
  E:\\algeria-tech\\facebook_cookies.json
  (collez le JSON exporté, sauvegardez)

ÉTAPE 5 — Vérifiez :
  python setup_facebook_cookies.py

ÉTAPE 6 — Testez la veille :
  python fetch_social.py --source "Ooredoo"

─────────────────────────────────────────────────────────────────────
SÉCURITÉ
  • facebook_cookies.json est dans .gitignore → jamais poussé sur Git
  • Ne partagez JAMAIS ce fichier (il donne accès à votre compte Facebook)
  • Renouvelez tous les 60-90 jours si les pages ne se chargent plus
─────────────────────────────────────────────────────────────────────
"""


def check_cookies():
    if not COOKIES_FILE.exists():
        print(INSTRUCTIONS)
        print(f"❌  {COOKIES_FILE} introuvable.\n"
              f"   Suivez les étapes ci-dessus, puis relancez ce script.")
        return False

    try:
        raw = json.loads(COOKIES_FILE.read_text(encoding='utf-8'))
    except Exception as e:
        print(f"❌  Fichier JSON invalide : {e}")
        return False

    if isinstance(raw, list):
        cookies = {c['name']: c['value'] for c in raw
                   if 'name' in c and 'value' in c}
    elif isinstance(raw, dict):
        cookies = raw
    else:
        print("❌  Format non reconnu (attendu : liste ou dict).")
        return False

    has_session = 'c_user' in cookies or 'xs' in cookies or 'datr' in cookies
    print(f"✅  {COOKIES_FILE.name} chargé — {len(cookies)} cookies")
    if has_session:
        print("✅  Session Facebook détectée (c_user / xs / datr présents)")
    else:
        print("⚠️   Cookies chargés mais session incomplète — "
              "assurez-vous d'être connecté avant d'exporter")
    return True


def test_access():
    """Vérifie qu'on peut accéder à une page Facebook publique avec ces cookies."""
    try:
        from facebook_scraper import get_posts
    except ImportError:
        import os
        os.system(f'"{sys.executable}" -m pip install facebook-scraper --user -q')
        from facebook_scraper import get_posts

    raw = json.loads(COOKIES_FILE.read_text(encoding='utf-8'))
    if isinstance(raw, list):
        cookies = {c['name']: c['value'] for c in raw if 'name' in c and 'value' in c}
    else:
        cookies = raw

    print("\n[TEST] Accès à la page OoredooDZ...")
    try:
        posts = list(get_posts('OoredooDZ', pages=1, cookies=cookies,
                               timeout=20,
                               options={'allow_extra_requests': False, 'progress': False}))
        if posts:
            print(f"✅  {len(posts)} posts récupérés — cookies fonctionnels !")
            print(f"    Exemple : {posts[0].get('post_text', '')[:100]}…")
        else:
            print("⚠️   0 posts — page peut-être vide ou inaccessible malgré les cookies")
    except Exception as e:
        print(f"❌  Erreur : {e}")


def main():
    ok = check_cookies()
    if ok and '--test' in sys.argv:
        test_access()
    elif ok:
        print("\nPour tester l'accès : python setup_facebook_cookies.py --test")


if __name__ == '__main__':
    main()
