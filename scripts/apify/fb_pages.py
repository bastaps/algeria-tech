"""Pages Facebook officielles (institutions + entreprises) via Apify, sans dépasser le plan gratuit (5 $/mois).

  python fb_pages.py --test 3            # 3 pages, 1 post max chacune, rien publié (vérifie compte + champs)
  python fb_pages.py                     # collecte quotidienne (institutions + entreprises) -> data/fb-posts.json
  python fb_pages.py --publier           # collecte puis publie les nouveaux posts via le Hub local (:3000)
  python fb_pages.py --budget            # affiche seulement le budget restant

Garde-fous : arrêt si le budget restant < 0,40 $ ; plafond de dépense par run ; seuls les posts des dernières 24 h sont demandés
(l'acteur facture 0,005 $ par post écrit, donc on ne paie que le nouveau). Le token reste dans .env (jamais affiché).
Entreprises : 1 à 3 posts publiés par jour (même promotionnels) -> catégorie dédiée « Entreprises » (type communique_entreprise)."""
import json, os, sys, time, re
from datetime import datetime, timezone
from pathlib import Path
import requests

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = Path(__file__).resolve().parents[2]
CONF = json.loads((Path(__file__).parent / 'pages.json').read_text(encoding='utf-8'))
POSTS = ROOT / 'data' / 'fb-posts.json'
ACTOR = 'apify~facebook-posts-scraper'
RESERVE_USD = 0.40          # on n'ouvre pas de run s'il reste moins que ça
PLAFOND_RUN_USD = 0.30      # dépense max par run
MAX_PAR_JOUR = {'entreprise': int(os.environ.get('FB_MAX_E', 3)), 'institution': int(os.environ.get('FB_MAX_I', 6))}
FOCUS = re.compile(r'smartphone|téléphone|telephone|mobile|galaxy|redmi|poco|iphone|honor|reno|spark|hot \d|camon|5g|tv|télé|tele|téléviseur|oled|qled|4k|android tv|google tv|box|décodeur|decodeur|récepteur|receiver|iptv|هاتف|هواتف|تلفاز|تلفزيون|شاشة|جهاز استقبال|ديكودور|سمارتفون', re.I)
HORS = re.compile(r'réfrigérateur|refrigerateur|congélateur|lave-linge|lave linge|lave-vaisselle|climatiseur|radiateur|cuisinière|four |micro-ondes|aspirateur|chauffe|ثلاج|مجمد|غسالة|مكيف|مدفأة|طباخ|فرن', re.I)
HUB = os.environ.get('INGEST_API_BASE', 'http://localhost:3000')


def env(k):
    for l in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
        if l.startswith(k + '='): return l.split('=', 1)[1].strip().strip('"\'')


TOKEN = env('APIFY_TOKEN')


def budget():
    d = requests.get('https://api.apify.com/v2/users/me/limits', params={'token': TOKEN}, timeout=30).json()['data']
    plafond = d['limits']['maxMonthlyUsageUsd']; used = d['current']['monthlyUsageUsd']
    return plafond, used, plafond - used


def collecter(pages, par_page, newer):
    urls = [{'url': 'https://www.facebook.com/' + p['id']} for p in pages]
    body = {'startUrls': urls, 'resultsLimit': par_page, 'onlyPostsNewerThan': newer}
    r = requests.post('https://api.apify.com/v2/acts/%s/run-sync-get-dataset-items' % ACTOR, json=body, timeout=320,
                      params={'token': TOKEN, 'format': 'json', 'timeout': 280, 'maxTotalChargeUsd': PLAFOND_RUN_USD})
    if r.status_code not in (200, 201):
        sys.exit('Apify HTTP %s : %s' % (r.status_code, r.text[:200]))
    return r.json()


def norm(it, pages):
    texte = (it.get('text') or it.get('message') or it.get('desc') or '').strip()
    url = it.get('url') or it.get('postUrl') or it.get('link') or ''
    nom_page = (it.get('pageName') or (it.get('user') or {}).get('name') or '')
    pid = ''
    low = (it.get('inputUrl') or it.get('facebookUrl') or it.get('pageUrl') or it.get('topLevelUrl') or url).lower()
    for p in pages:
        if '/' + p['id'].lower() in low: pid = p['id']; break
    img = ''
    for m in (it.get('media') or []):
        img = m.get('thumbnail') or m.get('photo_image', {}).get('uri') or m.get('image', {}).get('uri') or ''
        if img: break
    return {'page_id': pid, 'page': nom_page, 'texte': texte, 'url': url, 'image': img or it.get('image', ''),
            'date': it.get('time') or it.get('timestamp') or it.get('date') or '', 'vu': datetime.now(timezone.utc).isoformat(timespec='seconds')}


def charger():
    try: return json.loads(POSTS.read_text(encoding='utf-8'))
    except Exception: return []


def api(path, body):
    r = requests.post(HUB + path, json=body, timeout=180)
    j = r.json()
    if not r.ok or j.get('error') or j.get('success') is False: raise RuntimeError(j.get('error') or j.get('message') or r.status_code)
    return j


def publier(posts, pages_par_id):
    aujourdhui = datetime.now().strftime('%Y-%m-%d'); heure = datetime.now().strftime('%H:%M')
    deja = {t: sum(1 for p in posts if p.get('publie') == aujourdhui and p.get('type') == t) for t in MAX_PAR_JOUR}
    for p in posts:
        if p.get('publie') or len(p['texte']) < 40: continue
        meta = pages_par_id.get(p['page_id'])
        if not meta: continue
        t = meta['type']
        if t == 'entreprise' and (not FOCUS.search(p['texte']) or HORS.search(p['texte'])): continue   # smartphones / TV / box TV seulement
        if deja[t] >= MAX_PAR_JOUR[t]: continue
        if any(q.get('publie') == aujourdhui and q.get('page_id') == p['page_id'] for q in posts): continue   # 1 post max par page et par jour
        try:
            g = api('/api/smart-generate', {'text': '[%s — publication Facebook officielle] %s' % (meta['nom'], p['texte']), 'style': 'aps'})
            tags = g.get('tags') or ''; tags = ', '.join(tags) if isinstance(tags, list) else tags
            if t == 'entreprise':
                cat, typ = 'Entreprises', 'communique_entreprise'
                tags = ', '.join(dict.fromkeys(x.strip() for x in (tags + ',' + meta['nom'] + ',' + meta.get('secteur', '')).split(',') if x.strip()))
            else:
                cat, typ = g.get('categorie') or 'Télécoms', ''
            api('/api/create-article', {'titre': g.get('titre') or p['texte'][:80], 'extrait': g.get('lead') or p['texte'][:180],
                'contenu': (g.get('contenu') or p['texte']) + '\n\nSource : page Facebook officielle de %s — %s' % (meta['nom'], p['url']),
                'categorie': cat, 'tags': tags, 'date': aujourdhui, 'heure': heure, 'source': meta['nom'],
                'existingImage': '', 'video': '', 'type': typ, 'position': ''})
            p['publie'] = aujourdhui; p['type'] = t; deja[t] += 1
            print('  publié (%s) : %s' % (t, g.get('titre', '')[:70]))
        except Exception as e:
            print('  échec publication :', e)


def main():
    plafond, used, reste = budget()
    print('Budget Apify : %.3f $ utilisés / %.0f $ ; reste %.2f $' % (used, plafond, reste))
    if '--budget' in sys.argv: return
    if reste < RESERVE_USD: sys.exit('Budget insuffisant (< %.2f $) : on attend le prochain cycle.' % RESERVE_USD)
    tous = [dict(p, type='institution') for p in CONF['institutions']] + [dict(p, type='entreprise') for p in CONF['entreprises']]
    test = '--test' in sys.argv
    if test:
        n = int(sys.argv[sys.argv.index('--test') + 1]); pages = [tous[i] for i in (1, 7, 8)][:n]; par_page, newer = 1, '60 days'
    else:
        # Coût ≈ 0,008 $ par page et par run : entreprises chaque jour, institutions un jour sur deux -> ≈ 4,3 $/mois (plan gratuit = 5 $)
        g = sys.argv[sys.argv.index('--groupe') + 1] if '--groupe' in sys.argv else 'auto'
        inst = g == 'institutions' or (g == 'auto' and datetime.now().timetuple().tm_yday % 2 == 0)
        pages = [p for p in tous if p['type'] == 'entreprise' or (inst and p['type'] == 'institution')]
        if g == 'institutions': pages = [p for p in tous if p['type'] == 'institution']
        par_page, newer = 1, '1 day'      # le post le plus récent de chaque page, s'il date de moins de 24 h
        print('Pages ce jour :', len(pages), '(institutions incluses)' if inst else '(entreprises seulement)')
    items = collecter(pages, par_page, newer)
    print('%d posts reçus ; champs du 1er :' % len(items), sorted(items[0].keys())[:30] if items else '-')
    items = [i for i in items if not i.get('error')]
    nouveaux = [norm(i, tous) for i in items]
    for n in nouveaux[:3]: print('  -', n['page_id'] or n['page'], '|', n['date'], '|', n['texte'][:70].replace('\n', ' '))
    if test: return
    posts = charger(); connus = {p['url'] for p in posts}
    posts = [p for p in nouveaux if p['url'] and p['url'] not in connus] + posts
    if '--publier' in sys.argv: publier(posts, {p['id']: p for p in tous})
    POSTS.write_text(json.dumps(posts[:300], ensure_ascii=False, indent=1), encoding='utf-8')
    _, used2, reste2 = budget()
    print('OK — %d nouveaux ; budget restant %.2f $' % (len(posts) - len(connus), reste2))


main()
