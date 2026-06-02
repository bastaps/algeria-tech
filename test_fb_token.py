"""
Algeria Tech — Test du Facebook App Token
==========================================
Vérifiez si votre token Facebook fonctionne et quelles pages sont accessibles.
Usage : python test_fb_token.py

Comment obtenir un token GRATUIT en 5 minutes :
  1. Allez sur : https://developers.facebook.com
  2. Connectez-vous avec votre compte Facebook personnel
  3. "My Apps" → "Create App" → choisissez "Other" → "Business"
  4. Donnez un nom (ex: "AlgeriaTechBot") → Create App
  5. Dans l'app créée : Tools → Graph API Explorer
  6. En haut à droite : "Generate Access Token" (App Token)
  7. Copiez ce token → ajoutez dans E:\\algeria-tech\\.env :
     FB_APP_TOKEN=votre_token_ici
"""

import os
import sys
import json
from pathlib import Path

try:
    import requests
except ImportError:
    os.system(f'"{sys.executable}" -m pip install requests --user -q')
    import requests

# Charger le token depuis .env
def load_token():
    env_file = Path(__file__).parent / '.env'
    token = os.environ.get('FB_APP_TOKEN', '')
    if not token and env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith('FB_APP_TOKEN='):
                token = line.split('=', 1)[1].strip()
    return token

# Pages à tester (celles fournies par l'utilisateur)
FB_PAGES = [
    ('mpt.gov.dz',         'Ministère de la Poste et des TIC'),
    ('mesrs.dz',           'MESRS'),
    ('mkesme.dz',          'MKESME Startups'),
    ('AlgerieTelecom',     'Algérie Télécom'),
    ('algerieposteofficiel','Algérie Poste'),
    ('atsofficiel',        'ATS Satellite'),
    ('OoredooDZ',          'Ooredoo DZ'),
    ('djezzy',             'Djezzy'),
    ('MobilisOfficielle',  'Mobilis'),
    ('HuaweimobileDZ',     'Huawei Mobile DZ'),
    ('huawei',             'Huawei Global'),
    ('ericsson',           'Ericsson'),
    ('Condor.Electromenager','Condor'),
    ('streamsystem',       'Stream System'),
]

def test_page(page_id, name, token):
    try:
        # Test 1 : infos de base (toujours accessible)
        r = requests.get(
            f'https://graph.facebook.com/v18.0/{page_id}',
            params={'fields': 'name,fan_count,about', 'access_token': token},
            timeout=10
        )
        data = r.json()
        if 'error' in data:
            return 'ERREUR', data['error'].get('message', '?')[:60]

        fans = data.get('fan_count', 0)
        real_name = data.get('name', name)

        # Test 2 : posts (peut nécessiter approval)
        r2 = requests.get(
            f'https://graph.facebook.com/v18.0/{page_id}/posts',
            params={'fields': 'message,created_time', 'limit': 3, 'access_token': token},
            timeout=10
        )
        d2 = r2.json()
        if 'error' in d2:
            posts_status = f"Posts: BLOQUE ({d2['error'].get('code','?')})"
        else:
            n = len(d2.get('data', []))
            posts_status = f"Posts: {n} accessibles"

        return 'OK', f"{real_name} ({fans:,} fans) — {posts_status}"
    except Exception as e:
        return 'ERREUR', str(e)[:60]

def main():
    print("\n=== Algeria Tech — Test Facebook Token ===\n")

    token = load_token()
    if not token:
        print("Token non trouvé !")
        print("Ajoutez dans E:\\algeria-tech\\.env :")
        print("  FB_APP_TOKEN=votre_token_facebook\n")
        print("Instructions : voir commentaire en haut de ce fichier\n")
        return

    print(f"Token trouvé : {token[:20]}...\n")
    print(f"{'Page':<25} {'Statut':<8} {'Détails'}")
    print("-" * 80)

    ok, err = 0, 0
    for page_id, name in FB_PAGES:
        status, detail = test_page(page_id, name, token)
        icon = "✓" if status == 'OK' else "✗"
        color_label = f"[{status}]"
        print(f"  {name:<23} {color_label:<8} {detail}")
        if status == 'OK': ok += 1
        else: err += 1

    print("-" * 80)
    print(f"\nRésultat : {ok} pages OK / {err} erreurs")
    if ok > 0:
        print("Token fonctionnel ! Ajoutez-le dans .env et relancez fetch_social.py")
    if err > 0:
        print("Pour les erreurs 'posts bloqués' : votre app a besoin de 'Page Public Content Access'")
        print("→ Dans votre app Facebook : App Review → Request features")

if __name__ == '__main__':
    main()
