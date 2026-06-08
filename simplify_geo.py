#!/usr/bin/env python3
"""
Simplifie all-wilayas-raw.geojson :
- Réduit la précision des coordonnées à 3 décimales
- Supprime 1 point sur N (decimation)
- Garde uniquement les propriétés utiles
Objectif : ~200KB au lieu de 22MB
"""
import json, math

PRECISION = 3     # décimales de coordonnées
KEEP_EVERY = 8    # garder 1 point sur 8

def round_coord(c):
    return [round(c[0], PRECISION), round(c[1], PRECISION)]

def decimate(coords, keep_every=KEEP_EVERY):
    if len(coords) <= 6:
        return [round_coord(c) for c in coords]
    kept = [round_coord(coords[0])]
    for i in range(1, len(coords) - 1):
        if i % keep_every == 0:
            kept.append(round_coord(coords[i]))
    kept.append(round_coord(coords[-1]))  # toujours garder le dernier (fermeture)
    return kept

def simplify_geometry(geom):
    if geom is None:
        return geom
    gtype = geom['type']
    if gtype == 'Polygon':
        return {'type': 'Polygon', 'coordinates': [decimate(ring) for ring in geom['coordinates']]}
    elif gtype == 'MultiPolygon':
        return {'type': 'MultiPolygon', 'coordinates': [[decimate(ring) for ring in poly] for poly in geom['coordinates']]}
    return geom

print("Chargement du fichier source (22MB)...")
with open('E:/algeria-tech/all-wilayas-raw.geojson', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Features : {len(data['features'])}")
print(f"Premier feature proprietes : {list(data['features'][0]['properties'].keys())}")

simplified = {
    "type": "FeatureCollection",
    "features": []
}

for feat in data['features']:
    props = feat.get('properties', {})
    # Extraire les champs utiles (adapter selon les clés réelles)
    new_props = {}
    for key in ['name', 'NAME', 'nom', 'NOM', 'wilaya_name', 'wilaya', 'code', 'CODE', 'id', 'ID',
                'wil_name', 'wil_code', 'ADM1_EN', 'ADM1_FR', 'NAME_1', 'GID_1']:
        if key in props and props[key] is not None:
            new_props[key] = props[key]

    new_feat = {
        "type": "Feature",
        "properties": new_props,
        "geometry": simplify_geometry(feat.get('geometry'))
    }
    simplified['features'].append(new_feat)

out_path = 'E:/algeria-tech/wilayas_geo.json'
out = json.dumps(simplified, ensure_ascii=False, separators=(',', ':'))
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(out)

import os
size_kb = os.path.getsize(out_path) / 1024
print(f"\nResultat : {out_path}")
print(f"Taille   : {size_kb:.1f} KB  (vs 22 000 KB)")
print(f"Features : {len(simplified['features'])}")
print(f"Exemple props : {list(simplified['features'][0]['properties'].items())[:5]}")
