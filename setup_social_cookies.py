"""
Algeria Tech — Setup des cookies sociaux via Cookie-Editor
==========================================================
Lit les fichiers JSON exportes par l'extension Cookie-Editor
et les injecte comme secrets GitHub Actions.

ETAPES (une seule fois, valable ~90 jours) :
──────────────────────────────────────────────────────────────────────
1. Installez "Cookie-Editor" dans Chrome :
   chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm

2. Allez sur facebook.com (restez connecte)
   → cliquez l'icone Cookie-Editor dans la barre d'outils Chrome
   → cliquez "Export" → "Export as JSON"
   → le JSON est copie dans le presse-papier
   → collez dans le fichier : E:\\algeria-tech\\fb_cookies_export.json

3. Allez sur instagram.com (restez connecte)
   → meme procedure
   → collez dans : E:\\algeria-tech\\ig_cookies_export.json

4. Relancez ce script : python setup_social_cookies.py
──────────────────────────────────────────────────────────────────────
"""

import sys
import subprocess
import json
import os
from pathlib import Path
from datetime import datetime

# Forcer UTF-8
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = Path(__file__).parent

# ─── Configuration ────────────────────────────────────────────────────────────
TARGETS = {
    'FACEBOOK_COOKIES': {
        'file':     BASE_DIR / 'fb_cookies_export.json',
        'domain':   'facebook.com',
        'names':    ['c_user', 'xs', 'datr', 'fr', 'sb'],
        'required': ['c_user', 'xs'],
        'label':    'Facebook',
        'url':      'https://www.facebook.com',
    },
    'INSTAGRAM_COOKIES': {
        'file':     BASE_DIR / 'ig_cookies_export.json',
        'domain':   'instagram.com',
        'names':    ['sessionid', 'csrftoken', 'ds_user_id', 'rur'],
        'required': ['sessionid'],
        'label':    'Instagram',
        'url':      'https://www.instagram.com',
    },
}

# ─── Lecture du fichier Cookie-Editor JSON ────────────────────────────────────
def parse_cookie_editor_json(filepath: Path, domain: str, names: list) -> dict:
    """
    Parse le JSON exporte par l'extension Cookie-Editor.
    Format: liste d'objets [{name, value, domain, ...}, ...]
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    # Le format peut etre une liste directe ou {'cookies': [...]}
    if isinstance(raw, dict):
        raw = raw.get('cookies', [])

    found = {}
    for cookie in raw:
        name  = cookie.get('name', '')
        value = cookie.get('value', '')
        c_domain = cookie.get('domain', '')
        if name in names and domain in c_domain and value:
            found[name] = value

    return found

# ─── Injection GitHub Secret ──────────────────────────────────────────────────
def set_github_secret(name: str, value: str) -> bool:
    try:
        r = subprocess.run(['gh', 'secret', 'set', name, '--body', value],
                           capture_output=True, text=True,
                           cwd=BASE_DIR)
        if r.returncode == 0:
            return True
        print(f"  [gh] Erreur : {r.stderr.strip()[:200]}")
        return False
    except FileNotFoundError:
        print("  [gh] CLI introuvable. Installez GitHub CLI.")
        return False

# ─── Programme principal ──────────────────────────────────────────────────────
def main():
    print("=== Algeria Tech - Setup cookies sociaux ===")
    print(f"    {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print()

    # Verifier si les fichiers d'export existent
    missing_files = []
    for secret_name, cfg in TARGETS.items():
        if not cfg['file'].exists():
            missing_files.append((cfg['label'], cfg['file'].name, cfg['url']))

    if missing_files:
        print("Fichiers d'export manquants :")
        print()
        for label, fname, url in missing_files:
            print(f"  [{label}] {fname} non trouve")
        print()
        print("ETAPES POUR GENERER LES FICHIERS :")
        print()
        print("1. Installez l'extension Cookie-Editor dans Chrome :")
        print("   https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm")
        print()
        for label, fname, url in missing_files:
            print(f"2. [{label}] Allez sur {url} (connecte)")
            print(f"   → cliquez l'icone Cookie-Editor → Export → Export as JSON")
            print(f"   → collez le contenu dans : {BASE_DIR / fname}")
        print()
        print("Puis relancez : python setup_social_cookies.py")

        # Ouvrir le Chrome Web Store pour installer Cookie-Editor
        print()
        choice = input("Ouvrir Chrome pour installer Cookie-Editor maintenant ? (o/n): ").strip().lower()
        if choice == 'o':
            chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
            if not Path(chrome).exists():
                chrome = r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
            subprocess.Popen([chrome,
                'https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm'])
            print("Chrome ouvert sur la page Cookie-Editor.")
        return

    # Traitement de chaque plateforme
    success_count = 0
    for secret_name, cfg in TARGETS.items():
        label    = cfg['label']
        filepath = cfg['file']
        names    = cfg['names']
        required = cfg['required']

        print(f">> {label} ({filepath.name})")

        try:
            cookies = parse_cookie_editor_json(filepath, cfg['domain'], names)
        except Exception as e:
            print(f"   Erreur de lecture : {e}")
            continue

        missing = [n for n in required if n not in cookies]
        if missing:
            print(f"   Cookies manquants dans le fichier : {missing}")
            print(f"   Assurez-vous d'etre sur {cfg['url']} avant d'exporter.")
            continue

        # Affiche noms (jamais les valeurs)
        print(f"   Cookies trouves : {', '.join(cookies.keys())}")

        cookie_str = '; '.join(
            f"{n}={cookies[n]}" for n in names if n in cookies
        )

        print(f"   Injection dans GitHub [{secret_name}]...", end=' ')
        if set_github_secret(secret_name, cookie_str):
            print("OK")
            success_count += 1
            # Supprimer le fichier temporaire (securite)
            try:
                filepath.unlink()
                print(f"   Fichier {filepath.name} supprime (securite).")
            except Exception:
                pass
        else:
            print("ECHEC")

    # Resume
    print()
    print("=" * 44)
    print(f"Resultat : {success_count}/{len(TARGETS)} secrets configures.")

    if success_count == len(TARGETS):
        print()
        print("[OK] Configuration complete !")
        print("     Le pipeline social_update.yml utilisera vos sessions")
        print("     Facebook et Instagram (valable ~90 jours).")
        print()
        print("     Rappel : relancez ce script dans 90 jours ou quand")
        print("     vous voyez '[FB] Cookie expire' dans les logs GitHub.")
    elif success_count > 0:
        print()
        print("[!] Configuration partielle - verifiez les erreurs.")
    else:
        print()
        print("[X] Aucun secret configure.")

if __name__ == '__main__':
    main()
