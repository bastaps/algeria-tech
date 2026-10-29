"""Appel IA JSON avec repli : Mistral -> Gemini (cascade de modèles) -> Groq. Clés : variables d'environnement ou .env."""
import json, os, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def env(k):
    if os.environ.get(k): return os.environ[k]
    try:
        for l in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
            if l.startswith(k + '='): return l.split('=', 1)[1].strip().strip('"\'')
    except OSError:
        pass


def _post(url, body, headers):
    r = urllib.request.Request(url, json.dumps(body).encode(), dict({'Content-Type': 'application/json', 'User-Agent': 'algeria-tech/1.0'}, **headers))
    return json.load(urllib.request.urlopen(r, timeout=120))


def _mistral(p):
    return _post('https://api.mistral.ai/v1/chat/completions', {'model': 'mistral-small-latest', 'temperature': 0.3, 'response_format': {'type': 'json_object'},
                 'messages': [{'role': 'user', 'content': p}]}, {'Authorization': 'Bearer ' + env('MISTRAL_API_KEY')})['choices'][0]['message']['content']


def _gemini(p):
    err = None
    for m in ('gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'):
        try:
            return _post('https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s' % (m, env('GEMINI_API_KEY')),
                         {'contents': [{'parts': [{'text': p}]}], 'generationConfig': {'responseMimeType': 'application/json'}}, {})['candidates'][0]['content']['parts'][0]['text']
        except Exception as e:
            err = e
    raise err


def _groq(p):
    return _post('https://api.groq.com/openai/v1/chat/completions', {'model': 'openai/gpt-oss-120b', 'response_format': {'type': 'json_object'},
                 'messages': [{'role': 'user', 'content': p}]}, {'Authorization': 'Bearer ' + env('GROQ_API_KEY')})['choices'][0]['message']['content']


def appeler(prompt, valide=lambda r: True):
    for f in (_mistral, _gemini, _gemini, _groq):
        try:
            r = json.loads(f(prompt))
            if valide(r): return r
        except Exception as e:
            print('  IA', f.__name__, 'échec :', str(e)[:80])
            time.sleep(3)
    raise RuntimeError('Aucun fournisseur IA disponible')
