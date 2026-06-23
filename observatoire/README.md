# Observatoire des Prix Tech — Pipeline de collecte

## Installation (une seule fois)

```bash
cd observatoire
pip install -r requirements_observatoire.txt
playwright install chromium
```

## Lancer le pipeline complet

```bash
# Windows
run_pipeline.bat

# Linux/Mac
python scraper_webstar.py && python scraper_ouedkniss.py && python index_builder.py
```

## Mode test (3 fiches seulement)

```bash
python scraper_webstar.py --test
python scraper_ouedkniss.py --test
python index_builder.py
```

## Fichiers produits

| Fichier | Description |
|---|---|
| `prices_db.json` | Base brute avec historique complet |
| `phones_index.json` | Index optimisé pour le frontend |
| `scraper.log` | Logs WebStar |
| `scraper_ouedkniss.log` | Logs Ouedkniss |

## Architecture du pipeline

```
WebStar-Electro ──► scraper_webstar.py ──►┐
                                           ├──► prices_db.json ──► index_builder.py ──► phones_index.json
Ouedkniss ─────► scraper_ouedkniss.py ──►┘
```

## Structure de phones_index.json

```json
{
  "phones": [
    {
      "slug": "samsung-galaxy-a55",
      "brand": "Samsung",
      "name": "Galaxy A55",
      "segment": "mid",
      "price_official": 58000,
      "price_caba": 68000,
      "indice_dzd": 62000,
      "spread_pct": 17.2,
      "trend": "up",
      "credit_offers": [
        { "duree_mois": 12, "mensualite_dzd": 5300, "overhead_pct": 9.6 }
      ],
      "history": [
        { "date": "2026-05-01", "price": 55000 }
      ]
    }
  ],
  "stats": {
    "total": 247,
    "up_count": 42,
    "down_count": 38,
    "avg_spread_pct": 21.0
  }
}
```

## Fréquence recommandée

| Scraper | Fréquence | Raison |
|---|---|---|
| WebStar | 2×/semaine (lun + jeu) | Prix officiels stables |
| Ouedkniss | Quotidien (nuit) | Marché volatile |
| Index builder | Après chaque scraper | Toujours |
