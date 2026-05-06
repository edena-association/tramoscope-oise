"""Utilitaires partagés par les scripts de téléchargement."""
from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path
from typing import Iterable

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
