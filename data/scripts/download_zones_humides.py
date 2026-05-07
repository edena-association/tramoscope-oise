"""Téléchargement zones humides — prélocalisation bassin Seine-Normandie.

Source: DRIEAT IDF (data.gouv) - Prélocalisation des zones humides 2016
Couverture: bassin Seine-Normandie (inclut l'Oise)
Note: l'Oise n'a pas d'inventaire effectif RPDZH complet (◐ dans l'audit),
      la prélocalisation 2016 reste la meilleure source disponible nationale.

Source SHP via ATOM data.gouv (~21 Mo zip / ~52 Mo SHP brut).

Pipeline:
1. Download ATOM ZIP (cache local)
2. Lecture SHP via pyogrio
3. Reprojection L93 → 4326
4. Clip exact Oise + simplification 1e-4 (~10m)
5. Filtre surface > 1 ha
6. Sortie: data/processed/bleue/zones_humides.geojson
"""
from __future__ import annotations

import zipfile
from pathlib import Path

import pyogrio
from pyproj import Geod, Transformer
from shapely import from_wkb
from shapely.geometry import mapping
from shapely.ops import transform

from _common import (
    DEPT_NAME,
    FRONTEND_DATA_DIR,
    PROCESSED_DIR,
    RAW_DIR,
    ensure_dir,
    file_size_human,
    load_oise_polygon,
    setup_logger,
    write_geojson,
)

ATOM_URL = (
    "https://atom.geo-ide.developpement-durable.gouv.fr/atomArchive/GetResource"
    "?id=9862dccc-5e18-496b-9e0a-b03262b0fed5&dataType=dataset"
)

MIN_AREA_HA = 1.0
SIMPLIFY_TOL = 1e-4  # ~10m


def main() -> None:
    log = setup_logger("zh")
    log.info(f"Zones humides — prélocalisation Seine-Normandie 2016 → {DEPT_NAME}")

    raw_dir = ensure_dir(RAW_DIR / "zones_humides")
    zip_path = raw_dir / "prelocalisation_zh_seine_normandie.zip"
    if not zip_path.exists():
        import requests
        log.info(f"  GET ATOM ZIP")
        r = requests.get(ATOM_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=600)
        r.raise_for_status()
        zip_path.write_bytes(r.content)
    log.info(f"  zip: {file_size_human(zip_path)}")

    # Extract
    extract_dir = raw_dir / "extracted"
    if not (extract_dir / "dataset" / "L_PRELOCALISATION_ZH_2016_S_R11.shp").exists():
        ensure_dir(extract_dir)
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(extract_dir)
    shp = extract_dir / "dataset" / "L_PRELOCALISATION_ZH_2016_S_R11.shp"
    log.info(f"  shp: {file_size_human(shp)}")

    # Charger polygone Oise
    oise = load_oise_polygon()

    # Lecture SHP avec spatial filter L93 BBOX (cache pyogrio)
    info = pyogrio.read_info(str(shp))
    log.info(f"  total features: {info['features']}, CRS={info['crs']}")

    # Bbox Oise en L93
    transformer_to_l93 = Transformer.from_crs("EPSG:4326", "EPSG:2154", always_xy=True)
    minx_l93, miny_l93 = transformer_to_l93.transform(1.69, 49.05)
    maxx_l93, maxy_l93 = transformer_to_l93.transform(3.18, 49.78)

    # bbox = (xmin, ymin, xmax, ymax) in source CRS
    meta, _, geom_wkb, fields_data = pyogrio.raw.read(
        str(shp),
        bbox=(minx_l93, miny_l93, maxx_l93, maxy_l93),
    )
    field_names = list(meta["fields"])
    log.info(f"  features dans BBOX Oise: {len(geom_wkb)}")

    # Clip exact + simplifier
    transformer_to_4326 = Transformer.from_crs("EPSG:2154", "EPSG:4326", always_xy=True)
    geod = Geod(ellps="WGS84")
    out_features = []
    for i, wkb in enumerate(geom_wkb):
        if wkb is None:
            continue
        try:
            g = from_wkb(wkb)
            g = transform(transformer_to_4326.transform, g)
            inter = g.intersection(oise)
            if inter.is_empty:
                continue
            area_m2 = abs(geod.geometry_area_perimeter(inter)[0])
            area_ha = area_m2 / 10_000
            if area_ha < MIN_AREA_HA:
                continue
            inter = inter.simplify(SIMPLIFY_TOL, preserve_topology=True)
            if inter.is_empty:
                continue
            props = {fn: _coerce(fields_data[j][i]) for j, fn in enumerate(field_names)}
            props["surface_ha"] = round(area_ha, 2)
            out_features.append({
                "type": "Feature",
                "geometry": mapping(inter),
                "properties": props,
            })
        except Exception as exc:
            log.warning(f"  feature {i} ignoré: {exc}")

    log.info(f"  après clip+filtre>{MIN_AREA_HA}ha: {len(out_features)} polygones")

    out_proc = PROCESSED_DIR / "bleue" / "zones_humides.geojson"
    out_front = FRONTEND_DATA_DIR / "bleue" / "zones_humides.geojson"
    write_geojson(out_features, out_proc)
    write_geojson(out_features, out_front)
    log.info(f"OK — zones_humides.geojson ({file_size_human(out_proc)})")


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
    return v


if __name__ == "__main__":
    main()
