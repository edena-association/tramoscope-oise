"""Téléchargement SRCE/SRADDET Hauts-de-France 2020 — continuités écologiques.

Source: sig.hautsdefrance.fr (portail SIG région HdF, opendata SRADDET)
Datasets (8 fichiers, ~8.5 MB total brut) :
  - cer_reservoir_s_fr32      : réservoirs biodiversité surfaciques (trame verte)
  - cer_reservoir_l_fr32      : réservoirs linéaires (haies/lignes)
  - cer_corridor_s_fr32       : corridors trame verte (zones de passage)
  - cer_cours_eau_l_fr32      : corridors trame bleue (cours d'eau)
  - cer_obstacle_p_fr32       : obstacles ponctuels à l'écoulement
  - cer_obstacle_cor_s_fr32   : obstacles surfaciques aux corridors (urbanisation)
  - cer_obstacle_cor_l_fr32   : obstacles linéaires aux corridors (infrastructures)
  - cer_ontvb                 : continuités d'importance nationale (ONTVB)

Pour chaque fichier:
1. Download .zip dans data/raw/srce_hdf/
2. Unzip vers data/raw/srce_hdf/<name>/
3. Lecture SHP via pyogrio
4. Reprojection EPSG:4326
5. Clip sur polygone départemental Oise
6. Simplification adaptée au type de géométrie
7. Sortie GeoJSON dans frontend/public/data/{trame}/{name}.geojson
"""
from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pyogrio
from pyproj import Transformer
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

UA = {"User-Agent": "Mozilla/5.0 (compatible; EdenaTramoscope/1.0; +https://edena.eco)"}
BASE_URL = "https://sig.hautsdefrance.fr/ext/opendata/Sraddet2020"

# (filename_no_ext, trame_dir, output_name, simplify_tolerance_4326)
DATASETS = [
    ("cer_reservoir_s_fr32",     "verte",  "reservoirs_biodiversite",       1e-4),  # ~11m
    ("cer_reservoir_l_fr32",     "verte",  "reservoirs_lineaires",          5e-5),  # ~5m
    ("cer_corridor_s_fr32",      "verte",  "corridors_trame_verte",         1e-4),
    ("cer_cours_eau_l_fr32",     "bleue",  "corridors_trame_bleue",         5e-5),
    ("cer_obstacle_p_fr32",      "bleue",  "obstacles_majeurs",             None),
    ("cer_obstacle_cor_s_fr32",  "verte",  "obstacles_corridors_surface",   1e-4),
    ("cer_obstacle_cor_l_fr32",  "verte",  "obstacles_corridors_lineaires", 5e-5),
    ("cer_ontvb",                "verte",  "continuites_nationales",        1e-4),
]


def download_zip(name: str, target_dir: Path, log) -> Path:
    """Télécharge le .zip si absent, retourne le path local."""
    import requests
    out = target_dir / f"{name}.zip"
    if out.exists() and out.stat().st_size > 0:
        log.info(f"  cache: {out.name} ({file_size_human(out)})")
        return out
    url = f"{BASE_URL}/{name}.zip"
    log.info(f"  GET {url}")
    r = requests.get(url, headers=UA, timeout=120, stream=True)
    r.raise_for_status()
    out.write_bytes(r.content)
    log.info(f"  → {out.name} ({file_size_human(out)})")
    return out


def unzip(zip_path: Path, dest: Path, log) -> Path:
    """Décompresse vers dest/<name>/. Retourne le chemin du dossier."""
    out_dir = dest / zip_path.stem
    if out_dir.exists() and any(out_dir.iterdir()):
        return out_dir
    ensure_dir(out_dir)
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(out_dir)
    log.info(f"  unzip → {out_dir.name}/ ({len(list(out_dir.iterdir()))} fichiers)")
    return out_dir


def find_shapefile(folder: Path) -> Path:
    """Trouve le .shp principal dans un dossier (récursif)."""
    shps = list(folder.rglob("*.shp"))
    if not shps:
        raise FileNotFoundError(f"Aucun .shp trouvé dans {folder}")
    if len(shps) > 1:
        # Heuristique: prend le premier (souvent un seul SHP par zip)
        pass
    return shps[0]


def process_dataset(name: str, trame: str, out_name: str, simplify: float | None, oise_poly, log) -> dict:
    """Pipeline complet pour un dataset SRADDET."""
    raw_dir = ensure_dir(RAW_DIR / "srce_hdf")
    zip_path = download_zip(name, raw_dir, log)
    folder = unzip(zip_path, raw_dir, log)
    shp = find_shapefile(folder)

    info = pyogrio.read_info(shp)
    src_crs = info.get("crs", "EPSG:2154")  # SRADDET HdF est en Lambert 93 par défaut
    log.info(f"  SHP: {info['features']} features, CRS={src_crs}, geometry={info['geometry_type']}")

    # Lecture WKB - retourne (meta, fids, geometry_array_wkb, field_data_list)
    meta, _fids, geom_wkb, field_data = pyogrio.raw.read(str(shp))
    field_names = list(meta["fields"])

    # Reprojection vers EPSG:4326
    transformer = None
    if src_crs and "4326" not in str(src_crs):
        transformer = Transformer.from_crs(src_crs, "EPSG:4326", always_xy=True)

    out_features = []
    for i, wkb in enumerate(geom_wkb):
        if wkb is None:
            continue
        try:
            geom = from_wkb(wkb)
            if transformer is not None:
                geom = transform(transformer.transform, geom)
            inter = geom.intersection(oise_poly)
            if inter.is_empty:
                continue
            if simplify is not None:
                inter = inter.simplify(simplify, preserve_topology=True)
            props = {fn: _coerce(field_data[j][i]) for j, fn in enumerate(field_names)}
            out_features.append({
                "type": "Feature",
                "geometry": mapping(inter),
                "properties": props,
            })
        except Exception as exc:
            log.warning(f"  feature {i} ignoré: {exc}")

    out_proc = PROCESSED_DIR / trame / f"{out_name}.geojson"
    out_front = FRONTEND_DATA_DIR / trame / f"{out_name}.geojson"
    write_geojson(out_features, out_proc)
    write_geojson(out_features, out_front)
    log.info(
        f"  → {out_name}.geojson ({trame}) : {len(out_features)} features, {file_size_human(out_proc)}"
    )
    return {"name": out_name, "trame": trame, "count": len(out_features), "size": file_size_human(out_proc)}


def _coerce(v):
    """Convertit numpy types en types JSON-natifs."""
    import numpy as np
    if v is None:
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v) if not np.isnan(v) else None
    if isinstance(v, (np.ndarray, bytes)):
        try:
            return v.decode("utf-8")
        except Exception:
            return str(v)
    return v


def main() -> None:
    log = setup_logger("srce_hdf")
    log.info(f"SRCE/SRADDET Hauts-de-France 2020 → {DEPT_NAME}")

    log.info("Chargement polygone départemental Oise...")
    oise_poly = load_oise_polygon()

    results = []
    for name, trame, out_name, simplify in DATASETS:
        log.info(f"\n=== {name} ({trame}) ===")
        try:
            r = process_dataset(name, trame, out_name, simplify, oise_poly, log)
            results.append(r)
        except Exception as exc:
            log.error(f"  ÉCHEC {name}: {exc}")

    log.info("\n=== Récap ===")
    for r in results:
        log.info(f"  {r['trame']}/{r['name']}: {r['count']} features ({r['size']})")


if __name__ == "__main__":
    main()
