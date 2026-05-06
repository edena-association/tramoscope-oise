# Données — Tramoscope Oise

Ce dossier contient les **scripts** de téléchargement et de préparation des données. Les **données elles-mêmes ne sont jamais committées** (`data/raw/` et `data/processed/` sont gitignorés).

## Reproduction du dataset Oise

```bash
cd data/scripts
python -m venv .venv
.venv\Scripts\activate                      # Windows
# source .venv/bin/activate                 # Linux/Mac
pip install -r requirements.txt

# Téléchargement source par source
python download_admin_express.py            # ~5 Mo, < 1 min
python download_ocsge.py                    # ~3 Go, ~30 min
python download_bdforet.py                  # ~150 Mo, ~5 min
python download_bdtopage.py                 # ~80 Mo, ~5 min
python download_srce.py                     # ~30 Mo, ~2 min
python download_rpg.py                      # ~200 Mo, ~10 min
python download_roe.py                      # ~10 Mo, ~1 min
python download_znieff.py                   # WMS uniquement — pas de DL
python download_natura2000.py               # WMS uniquement — pas de DL
python download_viirs.py                    # ~50 Mo, ~3 min
python download_enaf.py                     # ~20 Mo, ~2 min

# Préparation : découpage Oise, simplification multi-zoom, conversion GeoJSON
python prepare_data.py

# Pré-calcul des couches d'analyse dérivées (Phase 3)
python generate_analysis_layers.py
```

## Structure

```
data/
├── README.md                  # Ce fichier
├── config/
│   └── sources.json           # Catalogue exhaustif des sources avec URLs et licences
├── scripts/
│   ├── requirements.txt       # Dépendances Python (geopandas, requests, etc.)
│   ├── _common.py             # Utilitaires partagés (HTTP, paths, logging)
│   ├── download_*.py          # Un script par source
│   ├── prepare_data.py        # Découpage + simplification + GeoJSON multi-zoom
│   └── generate_analysis_layers.py
├── raw/                       # GITIGNORÉ — données brutes téléchargées
└── processed/                 # GITIGNORÉ — données traitées Oise
    ├── admin/
    ├── verte/
    ├── bleue/
    ├── turquoise/
    ├── brune/
    ├── noire/
    ├── rose/
    └── analyse/
```

## Convention d'organisation

- Chaque script `download_*.py` télécharge **dans `data/raw/<source>/`** et ne fait rien d'autre.
- `prepare_data.py` lit `data/raw/`, découpe sur l'emprise départementale (60), simplifie selon le niveau de zoom, et écrit en GeoJSON dans `data/processed/<trame>/`.
- Les GeoJSON **légers** (< 5 Mo) sont copiés dans `frontend/public/data/` pour servir directement depuis le bundle Vercel.
- Les GeoJSON **lourds** sont servis par le backend FastAPI (endpoint `/data/<trame>/<layer>`).

## Idempotence

Tous les scripts sont idempotents : ils détectent si le fichier de sortie existe et le skippent. Utiliser `--force` pour re-télécharger.

## Licences

Voir `config/sources.json` pour la licence de chaque source. Toutes les sources utilisées sont **ouvertes** (Etalab 2.0, ODbL, CC-BY, ou équivalent).
