"""Podcast Algeria Tech — infos PROPRES au podcast (pas une copie du flash vidéo).
Collecte web (flux DZ + internationaux) + articles du site -> filtre « nos sujets » -> Algérie d'abord, monde ensuite
(si rien d'algérien : international dédié) -> jusqu'à 10 infos -> 1 clip MP3 par info + intro/outro, en FR / AR / EN.
Le lecteur enchaîne les N premières infos choisies (3 à 10).
Usage : python make_podcast.py [matin|midi|soir] [--langs fr,ar,en]"""
import asyncio, json, os, re, shutil, sys, time, urllib.request
from datetime import datetime
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'express'))
import sources, edge_tts

args = [a for a in sys.argv[1:] if not a.startswith('--') and a not in ('fr', 'ar', 'en') and ',' not in a]
CRENEAU = args[0] if args else ('matin' if datetime.now().hour < 11 else 'midi' if datetime.now().hour < 15 else 'soir')
LANGS = (sys.argv[sys.argv.index('--langs') + 1] if '--langs' in sys.argv else ('fr,ar,en' if CRENEAU == 'matin' else 'fr')).split(',')   # midi/soir : français seul (taille du dépôt)
FENETRE_H = {'matin': 24, 'midi': 8, 'soir': 6}[CRENEAU]
MAX = 10
VOIX = {'fr': 'fr-FR-RemyMultilingualNeural', 'ar': 'ar-DZ-AminaNeural', 'en': 'en-US-AndrewMultilingualNeural'}
LANGNOM = {'fr': 'français', 'ar': 'arabe (standard simple, compréhensible en Algérie)', 'en': 'anglais'}
SUJETS = re.compile(r'télécom|telecom|numériqu|numeriqu|digital|internet|fibre|5g|4g|mobile|smartphone|\bia\b|intelligence artificielle|'
  r'artificial intelligence|\bai\b|startup|start-up|cyber|donnée|data|technolog|satellite|djezzy|mobilis|ooredoo|algérie télécom|arpce|'
  r'logiciel|software|robot|puce|chip|semi-?conducteur|cloud|réseau|network|e-?commerce|fintech|paiement|innovation|application|android|iphone|'
  r'openai|google|microsoft|meta|apple|samsung|huawei|starlink|datacenter|ordinateur|jeux vidéo|numérisation', re.I)


def env(k):
    if os.environ.get(k): return os.environ[k]            # GitHub Actions : secrets en variables d'environnement
    for l in open(os.path.join(ROOT, '.env'), encoding='utf-8'):
        if l.startswith(k + '='): return l.split('=', 1)[1].strip().strip('"\'')


# ── 1. Matière : web + articles du site, sans les sources déjà prises par le flash vidéo ─────────────
try:
    deja = {h['url'].split('?')[0].rstrip('/') for h in json.load(open(os.path.join(ROOT, 'data', 'flash-jt-history.json'), encoding='utf-8'))[:30] if h.get('url')}
except Exception:
    deja = set()
items = []
for a in sources.collecter(FENETRE_H, 12):
    if a['url'].split('?')[0].rstrip('/') in deja: continue
    items.append({'titre': a['title'], 'resume': (a.get('summary') or '')[:400], 'pays': a['pays_source'], 'source': a['source'], 'url': a['url']})
try:
    L = json.load(open(os.path.join(ROOT, 'articles-list.json'), encoding='utf-8'))
    L = L if isinstance(L, list) else L['articles']
    for a in L[:40]:
        t = datetime.fromisoformat(a['date'] + 'T' + (a.get('heure') or '00:00') + ':00+01:00').timestamp()
        if time.time() - t <= FENETRE_H * 3600:
            items.append({'titre': a['titre'], 'resume': (a.get('extrait') or '')[:400], 'pays': 'DZ', 'source': 'Algeria Tech', 'url': ''})
except Exception:
    pass
vus, uniq = set(), []
for i in items:
    k = re.sub(r'\W+', '', i['titre'].lower())[:40]
    if k in vus or not SUJETS.search(i['titre'] + ' ' + i['resume']): continue
    vus.add(k); uniq.append(i)
dz = [i for i in uniq if i['pays'] == 'DZ']
intl = [i for i in uniq if i['pays'] != 'DZ']
retenus = (dz[:MAX] + intl)[:MAX]            # Algérie d'abord ; s'il en manque, le monde complète (jusqu'à 10)
if len(retenus) < 3: sys.exit("Pas assez d'infos sur nos sujets (%d)" % len(retenus))
print('infos retenues :', len(retenus), '(DZ %d)' % sum(1 for i in retenus if i['pays'] == 'DZ'))


# ── 2. Textes parlés (un appel IA par langue, repli Mistral -> Gemini -> Groq) ────────────────────────
def post(url, body, headers):
    r = urllib.request.Request(url, json.dumps(body).encode(), dict({'Content-Type': 'application/json', 'User-Agent': 'algeria-tech/1.0'}, **headers))
    return json.load(urllib.request.urlopen(r, timeout=120))


def mistral(p):
    return post('https://api.mistral.ai/v1/chat/completions', {'model': 'mistral-small-latest', 'temperature': 0.4, 'response_format': {'type': 'json_object'},
                'messages': [{'role': 'user', 'content': p}]}, {'Authorization': 'Bearer ' + env('MISTRAL_API_KEY')})['choices'][0]['message']['content']


def gemini(p):
    err = None
    for m in ('gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'):   # les modèles disparaissent / saturent : cascade
        try:
            return post('https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s' % (m, env('GEMINI_API_KEY')),
                        {'contents': [{'parts': [{'text': p}]}], 'generationConfig': {'responseMimeType': 'application/json'}}, {})['candidates'][0]['content']['parts'][0]['text']
        except Exception as e:
            err = e
    raise err


def groq(p):
    return post('https://api.groq.com/openai/v1/chat/completions', {'model': 'openai/gpt-oss-120b', 'response_format': {'type': 'json_object'},
                'messages': [{'role': 'user', 'content': p}]}, {'Authorization': 'Bearer ' + env('GROQ_API_KEY')})['choices'][0]['message']['content']


def ia(p):
    for f in (mistral, gemini, gemini, groq, gemini):      # gemini ré-essayé : 503 par vagues
        try:
            r = json.loads(f(p))
            if len(r.get('items', [])) == len(retenus):
                print('  via', f.__name__); return r
            print('  ', f.__name__, 'nombre d\'items inattendu')
        except Exception as e:
            print('  ', f.__name__, 'échec :', str(e)[:80]); time.sleep(4)
    raise SystemExit('Aucun fournisseur IA disponible')


matiere = '\n'.join('%d. [%s] %s — %s' % (n + 1, i['source'], i['titre'], i['resume']) for n, i in enumerate(retenus))
salut = {'matin': 'bonjour', 'midi': 'bon après-midi', 'soir': 'bonsoir'}[CRENEAU]


def textes(lang):
    p = ("Tu es la voix du podcast d'Algeria Tech (média tech/télécoms algérien), créneau « %s ». Langue de sortie : %s. "
         "Pour CHACUNE des %d infos ci-dessous, écris un court texte à lire à voix haute (35 à 55 mots, ton naturel de radio, un fait clair, pas de symboles, "
         "pas d'emoji, n'invente rien, ne cite pas d'URL), et un titre de 3 à 8 mots. Ajoute une introduction parlée de 12 à 25 mots "
         "(salutation adaptée à « %s », « Algeria Tech », annonce du nombre d'infos) et une conclusion de 8 à 15 mots. "
         'Réponds UNIQUEMENT en JSON : {"intro":"...","items":[{"titre":"...","texte":"..."}],"outro":"..."} avec exactement %d éléments dans items, dans le même ordre.\n\nInfos :\n%s'
         ) % (CRENEAU, LANGNOM[lang], len(retenus), salut, len(retenus), matiere)
    return ia(p)


# ── 3. Voix : un MP3 par clip ───────────────────────────────────────────────────────────────────────
out = os.path.join(ROOT, 'podcast')
os.makedirs(out, exist_ok=True)


def dur(path): return round(os.path.getsize(path) / 6000, 1)     # edge-tts mesuré ≈ 6 Ko/s


try:
    manifest = json.load(open(os.path.join(out, 'latest.json'), encoding='utf-8'))   # on garde les langues non régénérées ce créneau
except Exception:
    manifest = {'langs': {}}
manifest.update({'creneau': CRENEAU, 'date': datetime.now().strftime('%Y-%m-%d'), 'genere': datetime.now().isoformat(timespec='seconds')})
for lang in LANGS:
    print('==', lang)
    t = textes(lang)
    d = os.path.join(out, lang + '.new')
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    clips = [('intro', t['intro'])] + [('%02d' % (n + 1), x['texte']) for n, x in enumerate(t['items'])] + [('outro', t['outro'])]

    async def tout():
        for nom, txt in clips:
            await edge_tts.Communicate(re.sub(r'[*#_`]', '', txt), VOIX[lang], rate='+2%').save(os.path.join(d, nom + '.mp3'))
    asyncio.run(tout())
    final = os.path.join(out, lang)
    shutil.rmtree(final, ignore_errors=True); os.rename(d, final)
    manifest['langs'][lang] = {
        'voix': VOIX[lang], 'creneau': CRENEAU, 'genere': datetime.now().isoformat(timespec='seconds'),
        'intro': {'mp3': '/podcast/%s/intro.mp3' % lang, 'duree': dur(os.path.join(final, 'intro.mp3')), 'texte': t['intro']},
        'outro': {'mp3': '/podcast/%s/outro.mp3' % lang, 'duree': dur(os.path.join(final, 'outro.mp3')), 'texte': t['outro']},
        'items': [{'titre': x['titre'], 'texte': x['texte'], 'mp3': '/podcast/%s/%02d.mp3' % (lang, n + 1),
                   'duree': dur(os.path.join(final, '%02d.mp3' % (n + 1))), 'pays': retenus[n]['pays'], 'source': retenus[n]['source']}
                  for n, x in enumerate(t['items'])]}
json.dump(manifest, open(os.path.join(out, 'latest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('OK', len(retenus), 'infos x', len(LANGS), 'langues')


# ── 4. Épisode complet (français) + flux RSS pour Spotify / Apple Podcasts / etc. ───────────────────────
import subprocess
from email.utils import formatdate
from xml.sax.saxutils import escape
SITE = 'https://algeriatechnews.com'
N_FEED = 5                                   # infos dans l'épisode du flux
if 'fr' in LANGS:
    L = manifest['langs']['fr']
    eid = '%s-%s' % (manifest['date'], CRENEAU)
    epdir = os.path.join(out, 'episodes')
    os.makedirs(epdir, exist_ok=True)
    liste = os.path.join(epdir, eid + '.txt')
    clips = [L['intro']['mp3']] + [x['mp3'] for x in L['items'][:N_FEED]] + [L['outro']['mp3']]
    open(liste, 'w', encoding='utf-8').write(''.join("file '%s'" % os.path.join(ROOT, c.lstrip('/')).replace(os.sep, '/') + chr(10) for c in clips))
    mp3 = os.path.join(epdir, eid + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', mp3], check=True)
    os.remove(liste)
    meta_path = os.path.join(epdir, 'index.json')
    try:
        eps = json.load(open(meta_path, encoding='utf-8'))
    except Exception:
        eps = []
    eps = [e for e in eps if e['id'] != eid]
    eps.insert(0, {'id': eid, 'titre': 'Flash audio %s — %s' % (datetime.now().strftime('%d/%m/%Y'), CRENEAU),
                   'date': datetime.now().astimezone().isoformat(timespec='seconds'), 'mp3': '/podcast/episodes/%s.mp3' % eid,
                   'taille': os.path.getsize(mp3),
                   'duree': int(sum(x['duree'] for x in L['items'][:N_FEED]) + L['intro']['duree'] + L['outro']['duree']),
                   'resume': ' · '.join(x['titre'] for x in L['items'][:N_FEED])})
    for e in eps[21:]:                         # 21 épisodes conservés (7 jours)
        try:
            os.remove(os.path.join(ROOT, e['mp3'].lstrip('/')))
        except OSError:
            pass
    eps = eps[:21]
    json.dump(eps, open(meta_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    def hms(sec): return '%02d:%02d:%02d' % (sec // 3600, sec % 3600 // 60, sec % 60)
    items_xml = ''.join(
        '<item><title>%s</title><description>%s</description><pubDate>%s</pubDate><guid isPermaLink="false">%s</guid>'
        '<enclosure url="%s%s" length="%d" type="audio/mpeg"/><itunes:duration>%s</itunes:duration><itunes:explicit>false</itunes:explicit></item>'
        % (escape(e['titre']), escape(e['resume']), formatdate(datetime.fromisoformat(e['date']).timestamp()), escape(e['id']),
           SITE, e['mp3'], e['taille'], hms(e['duree'])) for e in eps)
    feed = ('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" '
            'xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Algeria Tech — Le flash audio</title><link>%s</link><language>fr</language>'
            "<description>Le flash audio d'Algeria Tech : l'actualité télécoms, numérique, IA et startups en Algérie, trois fois par jour.</description>"
            '<atom:link href="%s/podcast/feed.xml" rel="self" type="application/rss+xml"/><itunes:author>Algeria Tech</itunes:author>'
            '<itunes:owner><itunes:name>Algeria Tech</itunes:name><itunes:email>algeriatech2026@gmail.com</itunes:email></itunes:owner>'
            '<itunes:image href="%s/podcast/cover.jpg"/><itunes:category text="Technology"/>'
            '<itunes:category text="News"><itunes:category text="Tech News"/></itunes:category><itunes:explicit>false</itunes:explicit>%s</channel></rss>'
            ) % (SITE, SITE, SITE, items_xml)
    open(os.path.join(out, 'feed.xml'), 'w', encoding='utf-8').write(feed)
    print('RSS :', len(eps), 'épisodes ->', SITE + '/podcast/feed.xml')
