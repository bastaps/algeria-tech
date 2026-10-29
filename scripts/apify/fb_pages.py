"""Pages Facebook officielles (institutions + entreprises) via Apify, sans dépasser le plan gratuit (5 $/mois).

  python fb_pages.py --test 3            # 3 pages, 1 post max chacune, rien publié (vérifie compte + champs)
  python fb_pages.py --cloud             # GitHub Actions : collecte + rédaction IA + articles/<id>.md (sans Hub, sans PC)
  python fb_pages.py --publier           # PC : collecte puis publication via le Hub local (:3000)
  python fb_pages.py --budget            # affiche seulement le budget restant

Garde-fous : arrêt si le budget restant < 0,40 $ ; plafond de dépense par run ; seul le post le plus récent de chaque page
(moins de 24 h) est demandé. Entreprises : 1 post par page et par jour, 3 pages au plus, uniquement smartphones / TV / box TV
(catégorie dédiée « Entreprises », type communique_entreprise). Le token reste dans .env / secrets (jamais affiché)."""
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
FOCUS = re.compile(r'smartphone|téléphone|telephone|mobile|galaxy|redmi|poco|iphone|honor|reno|spark|hot \d|camon|\b5g\b|\btv\b|télé|tele|téléviseur|oled|qled|4k|android tv|google tv|\bbox\b|décodeur|decodeur|récepteur|receiver|iptv|هاتف|هواتف|تلفاز|تلفزيون|شاشة|جهاز استقبال|ديكودور|سمارتفون', re.I)
HORS = re.compile(r'réfrigérateur|refrigerateur|congélateur|lave-linge|lave linge|lave-vaisselle|climatiseur|radiateur|cuisinière|four |micro-ondes|aspirateur|chauffe|ثلاج|مجمد|غسالة|مكيف|مدفأة|طباخ|فرن', re.I)
INST_FOCUS = re.compile(r'télécom|telecom|numér|numer|digital|internet|fibre|5g|4g|wifi|débit|réseau|satellite|cyber|donnée|data|application|plateforme|paiement|carte|edahabia|startup|innovation|intelligence artificielle|ia|technolog|licence|spectre|couverture|abonn|offre|tarif|service client|colis|mobile|smartphone|ordinateur|numéris|اتصالات|رقمن|انترنت|إنترنت|ألياف|مؤسسة ناشئة|ذكاء اصطناعي|تطبيق|دفع', re.I)
HUB = os.environ.get('INGEST_API_BASE', 'http://localhost:3000')


def env(k):
    if os.environ.get(k): return os.environ[k]
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


def eligible(p, meta, deja, posts, aujourdhui):
    """Règles éditoriales communes (Hub et cloud)."""
    if p.get('publie') or len(p['texte']) < 40 or not meta: return False
    t = meta['type']
    if t == 'entreprise' and (not FOCUS.search(p['texte']) or HORS.search(p['texte'])): return False   # smartphones / TV / box TV seulement
    if t == 'institution' and not INST_FOCUS.search(p['texte']): return False   # pas d'Octobre Rose ni d'assurance du personnel
    if deja[t] >= MAX_PAR_JOUR[t]: return False
    if any(q.get('publie') == aujourdhui and q.get('page_id') == p['page_id'] for q in posts): return False   # 1 post max par page et par jour
    return True


# ── Publication via le Hub local (PC) ────────────────────────────────────────────────────────────────
def api(path, body):
    r = requests.post(HUB + path, json=body, timeout=180)
    j = r.json()
    if not r.ok or j.get('error') or j.get('success') is False: raise RuntimeError(j.get('error') or j.get('message') or r.status_code)
    return j


def publier(posts, pages_par_id):
    aujourdhui = datetime.now().strftime('%Y-%m-%d'); heure = datetime.now().strftime('%H:%M')
    deja = {t: sum(1 for p in posts if p.get('publie') == aujourdhui and p.get('type') == t) for t in MAX_PAR_JOUR}
    for p in posts:
        meta = pages_par_id.get(p['page_id'])
        if not eligible(p, meta, deja, posts, aujourdhui): continue
        t = meta['type']
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


# ── Publication cloud (GitHub Actions) : aucun Hub, aucun PC ─────────────────────────────────────────
# Règles éditoriales (administrateur, 2026-10-29) :
#  - un post répétitif / « évergreen » (horaires, rappels, sensibilisation, voeux…) n'est PAS une nouveauté : écarté ;
#  - activité ministérielle, responsable du secteur, événement / salon / signature auquel participe l'entité : publié DIRECTEMENT à la Une ;
#  - le reste : brouillon relu par l'administrateur (notification ntfy : À la Une / Brève / Rejeter) ; sans réponse sous DELAI_RELECTURE_MIN,
#    publié en brève (institutions) ou dans « Entreprises & Marques » (entreprises). Dans tous les cas : carte interactive demandée.
DELAI_RELECTURE_MIN = 180
EVERGREEN = re.compile(r'tous les jours|7 ?j/7|horaires?|disponible (de|du|24)|nous vous rappelons|rappel|conseils?|sensibilis|octobre rose|bonne (fête|année)|'
                       r'joyeux|félicit|voeux|vœux|مواعيد|نذكر|تذكير|نصائح|تهنئة|عيد', re.I)
UNE_AUTO = re.compile(r'ministre|ministère|wali|directeur général|\bpdg\b|président|secrétaire général|visite|inaugur|cérémonie|signature|convention|accord|partenariat|'
                      r'salon|foire|exposition|forum|conférence|séminaire|sommet|colloque|hackathon|participation|participe|lancement officiel|'
                      r'وزير|وزارة|والي|مدير عام|زيارة|تدشين|توقيع|اتفاقية|شراكة|صالون|معرض|منتدى|ملتقى|مشاركة|ندوة', re.I)


def _norm(t): return re.sub(r'\W+', ' ', t.lower())[:180]


def repetitif(p, posts):
    """Même page, texte quasi identique à un post déjà vu ces 45 derniers jours (publicité récurrente)."""
    import difflib
    a = _norm(p['texte'])
    for q in posts:
        if q is p or q.get('page_id') != p['page_id'] or q.get('url') == p['url']: continue
        if difflib.SequenceMatcher(None, a, _norm(q['texte'])).ratio() > 0.6: return True
    return False


def liberer_une(sauf):
    for f in (ROOT / 'articles').glob('*.md'):
        if f.name == sauf: continue
        t = f.read_text(encoding='utf-8')
        if re.search(r'^position:[ \t]*1[ \t]*$', t, re.M):
            f.write_text(re.sub(r'^position:[ \t]*1[ \t]*$', 'position: ', t, count=1, flags=re.M), encoding='utf-8')


def ntfy(titre, message, clic, actions):
    canal = os.environ.get('NTFY_TOPIC', '').strip()
    if not canal: return
    import urllib.request
    try:
        req = urllib.request.Request('https://ntfy.sh/' + canal, data=message.encode('utf-8'),
                                     headers={'Title': titre.encode('utf-8'), 'Tags': 'newspaper', 'Click': clic, 'Actions': actions})
        urllib.request.urlopen(req, timeout=20)
    except Exception as e:
        print('  notification impossible :', e)


def publier_cloud(posts, pages_par_id):
    import urllib.request, secrets
    from zoneinfo import ZoneInfo
    sys.path.insert(0, str(Path(__file__).parent))
    import ia
    now = datetime.now(ZoneInfo('Africa/Algiers')); aujourdhui = now.strftime('%Y-%m-%d'); heure = now.strftime('%H:%M')
    mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][now.month - 1]
    deja = {t: sum(1 for p in posts if p.get('publie') == aujourdhui and p.get('type') == t) for t in MAX_PAR_JOUR}
    SITE = 'https://algeriatechnews.com'
    n = 0
    for p in posts:
        meta = pages_par_id.get(p['page_id'])
        if not eligible(p, meta, deja, posts, aujourdhui): continue
        t = meta['type']
        if EVERGREEN.search(p['texte']) or repetitif(p, posts):
            p['publie'] = 'ignoré'; print('  ignoré (pas une nouveauté) :', p['texte'][:60].replace('\n', ' ')); continue
        prompt = ("Tu es journaliste du média tech/télécoms Algeria Tech. Réécris en français, en article factuel, la publication Facebook officielle de « %s » ci-dessous "
                  "(elle peut être en arabe ou en français ; garde les faits, prix, dates ; n'invente rien ; ton neutre même si c'est promotionnel). "
                  'Réponds UNIQUEMENT en JSON : {"titre":"titre informatif de 8 à 14 mots, sans préfixe « Algeria Tech »","lead":"chapo d\'une phrase","contenu":"corps en markdown, 90 à 180 mots",'
                  '"tags":["3 à 5 mots-clés"],"nouveaute":true ou false (false si ce type de publication revient régulièrement sur la page : rappel, horaires, conseil, publicité récurrente, voeux),'
                  '"important":true ou false (true seulement si : activité d\'un ministre ou d\'un responsable du secteur, OU événement / salon / signature / forum auquel participe l\'entité, OU annonce majeure)}.'
                  "\n\nPublication :\n%s") % (meta['nom'], p['texte'][:2500])
        try:
            g = ia.appeler(prompt, lambda r: r.get('titre') and r.get('contenu'))
        except Exception as e:
            print('  échec rédaction :', e); continue
        if g.get('nouveaute') is False:
            p['publie'] = 'ignoré'; print('  ignoré (pas une nouveauté, avis IA) :', g['titre'][:60]); continue
        important = bool(g.get('important')) or bool(UNE_AUTO.search(p['texte']))
        n += 1
        aid = str(int(time.time() * 1000) + n)
        img = ''
        if str(p.get('image', '')).startswith('http'):
            try:
                req = urllib.request.Request(p['image'], headers={'User-Agent': 'Mozilla/5.0'})
                data = urllib.request.urlopen(req, timeout=30).read()
                if 5000 < len(data) < 3_000_000:
                    (ROOT / 'images').mkdir(exist_ok=True); (ROOT / 'images' / (aid + '.jpg')).write_bytes(data); img = 'images/%s.jpg' % aid
            except Exception: pass
        tags = list(dict.fromkeys([x.strip() for x in (g.get('tags') or []) if x.strip()] + [meta['nom']] + ([meta['secteur']] if meta.get('secteur') else [])))
        cat = 'Entreprises' if t == 'entreprise' else 'Télécoms'
        q = lambda x: str(x).replace('"', "'").replace('\n', ' ')
        titre = re.sub(r'^\s*Algeria Tech\s*[:\-–—]\s*', '', g['titre'])
        corps = 'Alger, %d %s %d (Algeria Tech) — %s\n\n%s\n\nSource : publication Facebook officielle de %s — %s\n' % (
            now.day, mois, now.year, g.get('lead', ''), g['contenu'].strip(), meta['nom'], p['url'])
        base = ('---\ntitre: "%s"\ncategorie: %s\ndate: %s\nheure: %s\nimage: "%s"\npdf: ""\nvideo: ""\nsource: "%s"\nextrait: "%s"\ntags: [%s]\n'
                % (q(titre), cat, aujourdhui, heure, img, q(meta['nom']), q(g.get('lead', '')[:200]), ', '.join('"%s"' % q(x) for x in tags)))
        fin = 'interactif: ""\ninteractif_a_faire: "true"\naretenir: ""\nmediaPriority: image\n'
        p['publie'] = aujourdhui; p['type'] = t; p['page_id'] = p['page_id']; deja[t] += 1
        if important:      # publié directement, à la Une
            (ROOT / 'articles').mkdir(exist_ok=True)
            liberer_une(aid + '.md')
            (ROOT / 'articles' / (aid + '.md')).write_text(base + 'type: \nposition: 1\n' + fin + '---\n\n' + corps, encoding='utf-8')
            print('  publié À LA UNE (%s) : %s' % (t, titre[:70]))
            continue
        canal = 'atchoix-' + secrets.token_hex(8)       # brouillon relu : défaut = brève (institutions) / Entreprises & Marques (entreprises)
        defaut = 'entreprise' if t == 'entreprise' else 'breve'
        cree = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
        (ROOT / 'brouillons').mkdir(exist_ok=True)
        (ROOT / 'brouillons' / (aid + '.md')).write_text(
            base + 'type: \nposition: \n' + fin + 'brouillon: true\ncircuit: true\ncree: "%s"\nchoix_canal: "%s"\ndefaut: %s\ndelai_min: %d\n---\n\n%s'
            % (cree, canal, defaut, DELAI_RELECTURE_MIN, corps), encoding='utf-8')
        b = lambda lib, ch: 'http, %s, https://ntfy.sh/%s, method=POST, body=%s:%s, clear=true' % (lib, canal, aid, ch)
        ntfy('Facebook officiel à relire : ' + meta['nom'],
             '« %s » — sans réponse sous %d min : publié %s.' % (titre[:90], DELAI_RELECTURE_MIN, 'dans Entreprises & Marques' if t == 'entreprise' else 'en brève'),
             SITE + '/', '; '.join([b('À la Une', 'une'), b('Brève', 'breve'), b('Rejeter', 'rejeter'),
                                    'view, Corriger, %s/smart-ingest-pro.html?edit=%s&draft=1' % (SITE, aid)]))
        print('  brouillon à relire (%s, défaut %s) : %s' % (t, defaut, titre[:70]))


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
    items = [i for i in items if not i.get('error')]
    print('%d posts reçus' % len(items))
    nouveaux = [norm(i, tous) for i in items]
    for n in nouveaux[:3]: print('  -', n['page_id'] or n['page'], '|', n['date'], '|', n['texte'][:70].replace('\n', ' '))
    if test: return
    posts = charger(); connus = {p['url'] for p in posts}
    posts = [p for p in nouveaux if p['url'] and p['url'] not in connus] + posts
    par_id = {p['id']: p for p in tous}
    if '--cloud' in sys.argv: publier_cloud(posts, par_id)
    elif '--publier' in sys.argv: publier(posts, par_id)
    POSTS.parent.mkdir(exist_ok=True)
    POSTS.write_text(json.dumps(posts[:300], ensure_ascii=False, indent=1), encoding='utf-8')
    _, used2, reste2 = budget()
    print('OK — %d nouveaux ; budget restant %.2f $' % (len(posts) - len(connus), reste2))


if __name__ == "__main__":
    main()
