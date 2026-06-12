"""
Algeria Tech — Apify Facebook Scraper
======================================
Récupère les posts des pages Facebook officielles via l'API Apify.
Apify gère le scraping dans le cloud — aucun blocage local.

Usage :
  python fetch_apify_facebook.py          → scrape toutes les pages FB
  python fetch_apify_facebook.py --list   → affiche les pages configurées
  python fetch_apify_facebook.py --test   → teste sans sauvegarder

Prérequis :
  1. Compte Apify gratuit → https://apify.com
  2. Account → Integrations → API tokens → Create token
  3. Copier le token dans .env : APIFY_TOKEN=votre_token
  4. Dans Apify Store, trouver l'acteur Facebook et noter son ID
     → .env : APIFY_ACTOR=apify~facebook-pages-scraper (ajuster si besoin)
"""

import json
import os
import sys
import time
import argparse
import requests
from pathlib import Path
from datetime import datetime, timezone

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR    = Path(__file__).parent
CONFIG_FILE = BASE_DIR / "social_config.json"
OUTPUT_FILE = BASE_DIR / "apify_cache.json"
ENV_FILE    = BASE_DIR / ".env"

# ─── Chargement .env ──────────────────────────────────────────────────────────
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

ENV         = load_env()
APIFY_TOKEN = ENV.get("APIFY_TOKEN", "")
APIFY_ACTOR = ENV.get("APIFY_ACTOR", "apify~facebook-pages-scraper")

# ─── Sources Facebook à scraper via Apify ────────────────────────────────────
FB_ONLY_SOURCES = [
    # Sources sans RSS direct ni site officiel scrapable
    # (les autres ont déjà un fallback fonctionnel)
    {"page_id": "mpt.gov.dz",             "name": "MPT"},
    {"page_id": "mkesme.dz",              "name": "MKESME"},
    {"page_id": "algerieposteofficiel",    "name": "Algérie Poste"},
    {"page_id": "atsofficiel",             "name": "ATS"},
    {"page_id": "Condor.Electromenager",   "name": "Condor"},
    {"page_id": "HuaweimobileDZ",          "name": "Huawei Mobile DZ"},
    {"page_id": "huawei",                  "name": "Huawei Global"},
    {"page_id": "ericsson",                "name": "Ericsson"},
    {"page_id": "DGRSDT.ALGERIA",          "name": "DGRSDT"},
    # Ajout : pages sans RSS natif, site officiel déjà en fallback
    {"page_id": "mesrs.dz",               "name": "MESRS"},
    {"page_id": "AlgerieTelecom",          "name": "Algérie Télécom"},
    {"page_id": "OoredooDZ",              "name": "Ooredoo"},
    {"page_id": "streamsystem",            "name": "Stream System"},
]

# ─── Appel API Apify (run synchrone) ─────────────────────────────────────────
def run_apify(page_urls: list, dry_run: bool = False) -> list:
    if not APIFY_TOKEN or APIFY_TOKEN == "votre_token_apify_ici":
        print("[APIFY] ✗ APIFY_TOKEN non configuré dans .env")
        print("        → https://apify.com → Account → Integrations → API tokens")
        return []

    print(f"[APIFY] Actor : {APIFY_ACTOR}")
    print(f"[APIFY] Pages : {len(page_urls)} pages Facebook à scraper")

    if dry_run:
        print("[APIFY] Mode test — pas d'appel API")
        return []

    input_data = {
        "startUrls":    [{"url": url} for url in page_urls],
        "resultsLimit": 10,
    }

    try:
        # Run synchrone : bloque jusqu'à la fin (max 5 min)
        endpoint = (
            f"https://api.apify.com/v2/acts/{APIFY_ACTOR}"
            f"/run-sync-get-dataset-items"
            f"?token={APIFY_TOKEN}&format=json&timeout=280"
        )
        print("[APIFY] Lancement du scraping (peut prendre 1-3 min)...")
        res = requests.post(endpoint, json=input_data, timeout=310)

        if res.status_code in (200, 201):
            items = res.json()
            print(f"[APIFY] ✓ {len(items)} posts reçus")
            return items
        elif res.status_code == 400:
            print(f"[APIFY] ✗ Paramètres invalides — vérifiez APIFY_ACTOR dans .env")
            print(f"         Réponse : {res.text[:300]}")
        elif res.status_code == 401:
            print("[APIFY] ✗ Token invalide — vérifiez APIFY_TOKEN dans .env")
        elif res.status_code == 402:
            print("[APIFY] ✗ Quota Apify dépassé — attendez le renouvellement mensuel")
        else:
            print(f"[APIFY] ✗ HTTP {res.status_code} : {res.text[:200]}")
        return []

    except requests.exceptions.Timeout:
        print("[APIFY] ✗ Timeout (>5 min) — réduisez le nombre de pages ou maxPosts")
        return []
    except Exception as e:
        print(f"[APIFY] ✗ Erreur réseau : {e}")
        return []

# ─── Normalisation des résultats Apify → format interne ──────────────────────
def normalize_items(items: list) -> dict:
    """
    Organise les posts par page_id.
    Apify retourne des structures variables selon l'actor — on gère les cas communs.
    """
    cache = {}

    # Mapping url/username → page_id de nos sources
    url_map = {}
    for src in FB_ONLY_SOURCES:
        pid = src["page_id"].lower()
        url_map[pid] = src["page_id"]
        url_map[f"facebook.com/{pid}"] = src["page_id"]
        url_map[f"www.facebook.com/{pid}"] = src["page_id"]

    for item in items:
        # Identifier la page source
        page_url  = (item.get("pageUrl") or item.get("url") or "").lower()
        page_name = (item.get("pageName") or item.get("pageId") or "").lower()

        matched_id = None
        for key, pid in url_map.items():
            if key in page_url or key in page_name:
                matched_id = pid
                break

        if not matched_id:
            continue

        # Extraire le texte du post
        text = (
            item.get("text") or
            item.get("postText") or
            item.get("message") or
            item.get("story") or ""
        ).strip()

        if len(text) < 10:
            continue

        # URL du post
        post_url = (
            item.get("postUrl") or
            item.get("url") or
            item.get("link") or ""
        )

        # Date
        raw_date = item.get("time") or item.get("date") or item.get("created_time") or ""
        if hasattr(raw_date, "isoformat"):
            date_str = raw_date.isoformat()
        else:
            date_str = str(raw_date) if raw_date else datetime.now(timezone.utc).isoformat()

        # Image
        image = ""
        if item.get("media"):
            media = item["media"]
            if isinstance(media, list) and media:
                image = media[0].get("url", "") or media[0].get("src", "")
        image = image or item.get("image", "") or item.get("full_picture", "")

        if matched_id not in cache:
            cache[matched_id] = []

        cache[matched_id].append({
            "title": text[:130].replace("\n", " ") + ("…" if len(text) > 130 else ""),
            "link":  post_url,
            "desc":  text[:800],
            "date":  date_str,
            "image": image
        })

    return cache

# ─── Programme principal ──────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Algeria Tech — Apify Facebook Scraper")
    parser.add_argument("--list", action="store_true", help="Lister les pages configurées")
    parser.add_argument("--test", action="store_true", help="Mode test sans appel API")
    args = parser.parse_args()

    print("\n=== Apify Facebook Scraper ===")
    print(f"    {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"    Token : {'configuré' if APIFY_TOKEN and APIFY_TOKEN != 'votre_token_apify_ici' else 'MANQUANT'}")
    print(f"    Actor : {APIFY_ACTOR}\n")

    if args.list:
        print("Pages Facebook configurées :")
        for src in FB_ONLY_SOURCES:
            print(f"  • {src['name']:<25} facebook.com/{src['page_id']}")
        return

    page_urls = [f"https://www.facebook.com/{s['page_id']}" for s in FB_ONLY_SOURCES]
    items     = run_apify(page_urls, dry_run=args.test)

    if not items:
        if not args.test:
            print("\n[INFO] Cache Apify non mis à jour.")
        return

    cache = normalize_items(items)

    result = {
        "generated":  datetime.now(timezone.utc).isoformat(),
        "actor":      APIFY_ACTOR,
        "pages":      cache,
        "total_posts": sum(len(v) for v in cache.values())
    }

    OUTPUT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n[✅] {result['total_posts']} posts sauvegardés → apify_cache.json")
    for page_id, posts in cache.items():
        src_name = next((s["name"] for s in FB_ONLY_SOURCES if s["page_id"] == page_id), page_id)
        print(f"  {src_name:<25} {len(posts)} posts")

if __name__ == "__main__":
    main()
