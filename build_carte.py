#!/usr/bin/env python3
"""Recrée wilayas_geo.json avec noms nettoyés + codes officiels."""
import json, unicodedata, os

# Mapping nom brut (source) → (nom affichage FR propre, code officiel)
# Les 48 anciens ont les codes 01-48, les 10 nouveaux 49-58
NAME_FIX = {
    'Adrar':              ('Adrar',              '01'),
    'Chlef':              ('Chlef',              '02'),
    'Laghouat':           ('Laghouat',           '03'),
    'Oum El Bouaghi':     ('Oum El Bouaghi',     '04'),
    'Batna':              ('Batna',              '05'),
    'Bejaia':             ('Bejaia',             '06'),
    'Béjaïa':             ('Bejaia',             '06'),
    'Biskra':             ('Biskra',             '07'),
    'Bechar':             ('Bechar',             '08'),
    'Béchar':             ('Bechar',             '08'),
    'Blida':              ('Blida',              '09'),
    'Bouira':             ('Bouira',             '10'),
    'Tamanrasset':        ('Tamanrasset',        '11'),
    'Tebessa':            ('Tebessa',            '12'),
    'Tébessa':            ('Tebessa',            '12'),
    'Tlemcen':            ('Tlemcen',            '13'),
    'Tiaret':             ('Tiaret',             '14'),
    'Tizi Ouzou':         ('Tizi Ouzou',         '15'),
    'Alger':              ('Alger',              '16'),
    'Algiers':            ('Alger',              '16'),
    'Djelfa':             ('Djelfa',             '17'),
    'Jijel':              ('Jijel',              '18'),
    'Setif':              ('Setif',              '19'),
    'Sétif':              ('Setif',              '19'),
    'Saida':              ('Saida',              '20'),
    'Saïda':              ('Saida',              '20'),
    'Skikda':             ('Skikda',             '21'),
    'Sidi Bel Abbes':     ('Sidi Bel Abbes',     '22'),
    'Sidi Bel Abbès':     ('Sidi Bel Abbes',     '22'),
    'Annaba':             ('Annaba',             '23'),
    'Guelma':             ('Guelma',             '24'),
    'Constantine':        ('Constantine',        '25'),
    'Medea':              ('Medea',              '26'),
    'Médéa':              ('Medea',              '26'),
    'Mostaganem':         ('Mostaganem',         '27'),
    "M'Sila":             ("M'Sila",             '28'),
    'Mascara':            ('Mascara',            '29'),
    'Ouargla':            ('Ouargla',            '30'),
    'Oran':               ('Oran',               '31'),
    'El Bayadh':          ('El Bayadh',          '32'),
    'Illizi':             ('Illizi',             '33'),
    'Bordj Bou Arreridj': ('Bordj Bou Arreridj', '34'),
    'Boumerdes':          ('Boumerdes',          '35'),
    'Boumerdès':          ('Boumerdes',          '35'),
    'El Tarf':            ('El Tarf',            '36'),
    'Tindouf':            ('Tindouf',            '37'),
    'Tissemsilt':         ('Tissemsilt',         '38'),
    'El Oued':            ('El Oued',            '39'),
    'Khenchela':          ('Khenchela',          '40'),
    'Souk Ahras':         ('Souk Ahras',         '41'),
    'Tipaza':             ('Tipaza',             '42'),
    'Mila':               ('Mila',               '43'),
    'Ain Defla':          ('Ain Defla',          '44'),
    'Aïn Defla':          ('Ain Defla',          '44'),
    'Naama':              ('Naama',              '45'),
    'Naâma':              ('Naama',              '45'),
    'Ain Temouchent':     ('Ain Temouchent',     '46'),
    'Aïn Témouchent':     ('Ain Temouchent',     '46'),
    'Ghardaia':           ('Ghardaia',           '47'),
    'Relizane':           ('Relizane',           '48'),
    # Nouvelles wilayas 2019
    'Timimoune':          ('Timimoune',          '49'),
    'Bordj Badji Mokhtar':('Bordj Badji Mokhtar','50'),
    'Ouled Djellal':      ('Ouled Djellal',      '51'),
    'Beni Abbes':         ('Beni Abbes',         '52'),
    'Béni Abbès':         ('Beni Abbes',         '52'),
    'In Salah':           ('In Salah',           '53'),
    'In Guezzam':         ('In Guezzam',         '54'),
    'Touggourt':          ('Touggourt',          '55'),
    'Djanet':             ('Djanet',             '56'),
    "El M'Ghair":         ("El M'Ghair",         '57'),
    'El Menia':           ('El Menia',           '58'),
}

print("Chargement du fichier source...")
with open('E:/algeria-tech/all-wilayas-raw.geojson', 'r', encoding='utf-8') as f:
    raw = json.load(f)

KEEP_EVERY = 20
PRECISION  = 3

def round_c(c):
    return [round(c[0], PRECISION), round(c[1], PRECISION)]

def decimate(coords):
    if len(coords) <= 6:
        return [round_c(c) for c in coords]
    kept = [round_c(coords[0])]
    for i in range(1, len(coords)-1):
        if i % KEEP_EVERY == 0:
            kept.append(round_c(coords[i]))
    kept.append(round_c(coords[-1]))
    return kept

def simplify_geom(geom):
    if not geom: return geom
    if geom['type'] == 'Polygon':
        return {'type':'Polygon','coordinates':[decimate(r) for r in geom['coordinates']]}
    if geom['type'] == 'MultiPolygon':
        return {'type':'MultiPolygon','coordinates':[[decimate(r) for r in p] for p in geom['coordinates']]}
    return geom

out_features = []
missing = []
for feat in raw['features']:
    raw_name = feat['properties'].get('name','')
    if raw_name in NAME_FIX:
        clean_name, code = NAME_FIX[raw_name]
    else:
        # Essayer normalisation
        norm = unicodedata.normalize('NFC', raw_name)
        if norm in NAME_FIX:
            clean_name, code = NAME_FIX[norm]
        else:
            clean_name = raw_name
            code = '?'
            missing.append(raw_name)

    out_features.append({
        'type': 'Feature',
        'properties': {'name': clean_name, 'code': code},
        'geometry': simplify_geom(feat.get('geometry'))
    })

out = {'type':'FeatureCollection','features':out_features}
with open('E:/algeria-tech/wilayas_geo.json','w',encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',',':'))

size = os.path.getsize('E:/algeria-tech/wilayas_geo.json') / 1024
print(f"wilayas_geo.json : {size:.0f} KB | {len(out_features)} features")
if missing:
    print(f"Noms non reconnus : {missing}")
else:
    print("Tous les noms resolus OK")

# Vérification
for f in out['features']:
    print(f"  [{f['properties']['code']:>2}] {f['properties']['name']}")
