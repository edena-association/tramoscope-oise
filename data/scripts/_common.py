"""Utilitaires partagés par les scripts de téléchargement."""
from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path
from typing import Callable, Iterable, Iterator

import requests

# Code département cible
DEPT_CODE = "60"
DEPT_NAME = "Oise"

# Racine du projet (data/scripts/_common.py → projet)
SCRIPTS_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPTS_DIR.parent
PROJECT_ROOT = DATA_DIR.parent
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
FRONTEND_DATA_DIR = PROJECT_ROOT / "frontend" / "public" / "data"

# BBOX Oise approximative en EPSG:4326 (lon_min, lat_min, lon_max, lat_max)
# Marge confortable au cas où - le clipping shapely supprime les débordements.
OISE_BBOX_4326 = (1.69, 49.05, 3.18, 49.78)


def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    handler = logging.StreamHandler(sys.stdout)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s", datefmt="%H:%M:%S")
    handler.setFormatter(fmt)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def http_get_json(url: str, params: dict | None = None, timeout: int = 120, retries: int = 3) -> dict:
    """GET JSON avec retry exponentiel."""
    last_exc: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(url, params=params, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            last_exc = exc
            if attempt < retries:
                wait = 2 ** attempt
                time.sleep(wait)
    raise RuntimeError(f"Échec GET {url} après {retries} tentatives: {last_exc}")


def write_geojson(features: Iterable[dict], output: Path, crs: str = "EPSG:4326") -> int:
    """Écrit un GeoJSON FeatureCollection. Retourne le nombre de features écrites."""
    ensure_dir(output.parent)
    feats = list(features)
    fc = {
        "type": "FeatureCollection",
        "name": output.stem,
        "crs": {"type": "name", "properties": {"name": crs}},
        "features": feats,
    }
    output.write_text(json.dumps(fc, ensure_ascii=False), encoding="utf-8")
    return len(feats)


def file_size_human(path: Path) -> str:
    size = path.stat().st_size
    for unit in ("o", "Ko", "Mo", "Go"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} To"


def load_oise_polygon():
    """Charge le polygone du département de l'Oise (EPSG:4326) en shapely.

    Le GeoJSON departement_oise.geojson est produit par download_admin_express.py.
    """
    from shapely.geometry import shape
    from shapely.ops import unary_union

    src = FRONTEND_DATA_DIR / "admin" / "departement_oise.geojson"
    if not src.exists():
        raise FileNotFoundError(
            f"{src} introuvable - lance d'abord download_admin_express.py"
        )
    fc = json.loads(src.read_text(encoding="utf-8"))
    geoms = [shape(f["geometry"]) for f in fc["features"]]
    return unary_union(geoms)


def wfs_paged_geojson(
    base_url: str,
    typename: str,
    *,
    bbox: tuple[float, float, float, float] | None = None,
    cql_filter: str | None = None,
    ogc_filter: str | None = None,
    srs: str = "EPSG:4326",
    page_size: int = 1000,
    output_format: str = "geojson",
    extra_params: dict | None = None,
    logger: logging.Logger | None = None,
) -> Iterator[dict]:
    """Itère sur les features d'un WFS en paginant (WFS 2.0).

    Filtrage:
    - bbox: (minlon, minlat, maxlon, maxlat) en EPSG:4326
    - cql_filter: GeoServer CQL (ex: GeoServer Geo2France, IGN Géoplateforme)
    - ogc_filter: OGC Filter Encoding XML (ex: Sandre, qui ignore CQL)
    Note: ne pas combiner ogc_filter + bbox - utiliser BBOX dans le filtre OGC.
    """
    log = logger or setup_logger("wfs")
    start = 0
    base_params = {
        "SERVICE": "WFS",
        "VERSION": "2.0.0",
        "REQUEST": "GetFeature",
        "TYPENAMES": typename,
        "OUTPUTFORMAT": output_format,
        "SRSNAME": srs,
        "COUNT": str(page_size),
    }
    if bbox is not None:
        base_params["BBOX"] = f"{bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]},{srs}"  # SW lat,lon,NE lat,lon
    if cql_filter:
        base_params["CQL_FILTER"] = cql_filter
    if ogc_filter:
        base_params["FILTER"] = ogc_filter
    if extra_params:
        base_params.update(extra_params)

    total_seen = 0
    while True:
        params = dict(base_params, STARTINDEX=str(start))
        for attempt in range(1, 4):
            try:
                r = requests.get(base_url, params=params, timeout=180)
                r.raise_for_status()
                data = r.json()
                break
            except Exception as exc:
                if attempt == 3:
                    raise RuntimeError(f"WFS échoué: {exc} - URL: {r.url if 'r' in dir() else ''}") from exc
                time.sleep(2 ** attempt)
        feats = data.get("features", []) or []
        if not feats:
            log.info(f"  fin pagination: {total_seen} features récupérées")
            return
        for f in feats:
            yield f
        total_seen += len(feats)
        log.info(f"  page startIndex={start}: +{len(feats)} (cumul {total_seen})")
        # Heuristique: si renvoi < page_size, on a fini
        if len(feats) < page_size:
            return
        start += page_size


def clip_features_to_polygon(
    features: Iterable[dict],
    polygon,
    *,
    simplify_tolerance: float | None = None,
    logger: logging.Logger | None = None,
) -> list[dict]:
    """Clip features GeoJSON sur un polygone shapely. Optionnellement simplifie.

    simplify_tolerance en degrés (EPSG:4326). 1e-4 ≈ 11m, 5e-5 ≈ 5m, 1e-5 ≈ 1m.
    """
    from shapely.geometry import mapping, shape

    log = logger or setup_logger("clip")
    kept = 0
    dropped = 0
    out: list[dict] = []
    for f in features:
        geom_dict = f.get("geometry")
        if not geom_dict:
            dropped += 1
            continue
        try:
            g = shape(geom_dict)
            if g.is_empty:
                dropped += 1
                continue
            inter = g.intersection(polygon)
            if inter.is_empty:
                dropped += 1
                continue
            if simplify_tolerance:
                inter = inter.simplify(simplify_tolerance, preserve_topology=True)
            new_f = {
                "type": "Feature",
                "geometry": mapping(inter),
                "properties": f.get("properties", {}),
            }
            out.append(new_f)
            kept += 1
        except Exception as exc:
            log.warning(f"  feature ignoré: {exc}")
            dropped += 1
    log.info(f"  clip: {kept} retenus, {dropped} hors zone/invalides")
    return out
