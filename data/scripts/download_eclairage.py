"""Téléchargement éclairage nocturne — pratiques communales 2014-2024.

Source: data.gouv.fr "Cartographie nationale des pratiques d'éclairage nocturne"
Producteur: Cerema + DarkSkyLab (projet Sérénos)
Format: GeoPackage (.gpkg) avec 132 colonnes mensuelles 2014-01 → 2024-12

Pour le MVP on dérive 4 indicateurs synthétiques par commune:
  - radiance_moy_2014 : moyenne 12 mois 2014 (référence "avant extinctions")
  - radiance_moy_2024 : moyenne 12 mois 2024 (état actuel)
  - delta_2014_2024   : variation (négatif = extinction effective)
  - changes_EP, dates : indicateurs textuels Cerema

Sortie: data/processed/noire/eclairage_communes.geojson (jointure géométrique sur communes Oise)
"""
from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import pyogrio
from pyproj import Transformer
from shapely import from_wkb
from shapely.geometry import mapping
from shapely.ops import transform

from _common import (
    DEPT_CODE,
    DEPT_NAME,
    FRONTEND_DATA_DIR,
    PROCESSED_DIR,
    RAW_DIR,
    ensure_dir,
    file_size_human,
    setup_logger,
    write_geojson,
)

DATAGOUV_URL = "https://www.data.gouv.fr/api/1/datasets/r/4a7efca5-2758-4232-8c03-92ec8d77a2ef"


def _coerce(v):
    import numpy as np
    if v is None:
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return None if np.isnan(v) else float(v)
    if isinstance(v, bytes):
        try:
            return v.decode("utf-8")
        except Exception:
            return None
    return v if isinstance(v, (str, int, float, bool)) else str(v)


def main() -> None:
    log = setup_logger("eclairage")
    log.info(f"Cartographie pratiques éclairage 2014-2024 — {DEPT_NAME}")

    raw_dir = ensure_dir(RAW_DIR / "eclairage")
    zip_path = raw_dir / "vectorExtinctionFrance.zip"
    if not zip_path.exists():
        import requests
        log.info(f"  GET {DATAGOUV_URL}")
        r = requests.get(DATAGOUV_URL, timeout=300)
        r.raise_for_status()
        zip_path.write_bytes(r.content)
    log.info(f"  zip: {file_size_human(zip_path)}")

    gpkg = raw_dir / "vectorExtinctionFrance.gpkg"
    if not gpkg.exists():
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(raw_dir)
    log.info(f"  gpkg: {file_size_human(gpkg)}")

    info = pyogrio.read_info(gpkg, layer="extinction_communes")
    log.info(f"  total communes: {info['features']}")

    # Lecture: 4 + 132 colonnes
    meta, _, geom_wkb, fields = pyogrio.raw.read(
        str(gpkg), layer="extinction_communes",
        where=f"insee_dep = '{DEPT_CODE}'",
    )
    field_names = list(meta["fields"])
    log.info(f"  features dept {DEPT_CODE}: {len(geom_wkb)}")

    # Index colonnes
    idx = {name: i for i, name in enumerate(field_names)}
    months_2014 = [f"2014-{m:02d}" for m in range(1, 13)]
    months_2024 = [f"2024-{m:02d}" for m in range(1, 13)]
    cols_meta = ["insee_com", "nom", "insee_dep", "Date Extinction EP",
                 "Date Renov parc / extinction", "Date Abandon d'extinction", "changes_EP"]

    # Reprojection L93 → 4326
    src_crs = meta["crs"]
    transformer = Transformer.from_crs(src_crs, "EPSG:4326", always_xy=True)

    out_features = []
    for i, wkb in enumerate(geom_wkb):
        if wkb is None:
            continue
        try:
            geom = from_wkb(wkb)
            geom = transform(transformer.transform, geom)
            geom = geom.simplify(1e-4, preserve_topology=True)
            if geom.is_empty:
                continue
            # Moyennes radiance
            def _mean(months):
                vals = [fields[idx[m]][i] for m in months if m in idx]
                vals = [float(v) for v in vals if v is not None and not _is_nan(v)]
                return round(sum(vals) / len(vals), 4) if vals else None
            r2014 = _mean(months_2014)
            r2024 = _mean(months_2024)
            props = {k: _coerce(fields[idx[k]][i]) for k in cols_meta if k in idx}
            props["radiance_moy_2014"] = r2014
            props["radiance_moy_2024"] = r2024
            props["delta_2014_2024"] = (
                round(r2024 - r2014, 4) if r2014 is not None and r2024 is not None else None
            )
            out_features.append({
                "type": "Feature",
                "geometry": mapping(geom),
                "properties": props,
            })
        except Exception as exc:
            log.warning(f"  feature {i} ignoré: {exc}")

    out_proc = PROCESSED_DIR / "noire" / "eclairage_communes.geojson"
    out_front = FRONTEND_DATA_DIR / "noire" / "eclairage_communes.geojson"
    n = write_geojson(out_features, out_proc)
    write_geojson(out_features, out_front)
    log.info(f"OK — {n} communes ({file_size_human(out_proc)})")


def _is_nan(v):
    try:
        import math
        return isinstance(v, float) and math.isnan(v)
    except Exception:
        return False


if __name__ == "__main__":
    main()
