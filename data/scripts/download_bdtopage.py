"""Téléchargement BD TOPAGE — cours d'eau Oise.

Source: WFS Sandre (services.sandre.eaufrance.fr/geo/sandre)
Typename: sa:CoursEau_FXX_Topage2019 (LineString, EPSG:4326 disponible)

Stratégie:
1. BBOX Oise sur WFS (filtre serveur, rapide)
2. Clip exact sur polygone départemental shapely
3. Simplification légère (~5m) pour léger en frontend
4. Sortie: data/processed/bleue/cours_eau.geojson + frontend/public/data/bleue/cours_eau.geojson
"""
from __future__ import annotations

import shutil
from pathlib import Path

from _common import (
    DEPT_NAME,
    FRONTEND_DATA_DIR,
    OISE_BBOX_4326,
    PROCESSED_DIR,
    clip_features_to_polygon,
    file_size_human,
    load_oise_polygon,
    setup_logger,
    wfs_paged_geojson,
    write_geojson,
)

WFS_BASE = "https://services.sandre.eaufrance.fr/geo/sandre"
TYPENAME = "sa:CoursEau_FXX_Topage2019"

# Champs propres conservés pour l'affichage
KEEP_PROPS = ("CdOH", "TopoOH", "StatutOH")


def main() -> None:
    log = setup_logger("bdtopage")
    log.info(f"BD TOPAGE — cours d'eau {DEPT_NAME}")

    log.info("Chargement polygone départemental Oise...")
    poly = load_oise_polygon()

    log.info(f"WFS GetFeature {TYPENAME} BBOX={OISE_BBOX_4326}")
    raw_features = list(
        wfs_paged_geojson(
            WFS_BASE,
            TYPENAME,
            bbox=OISE_BBOX_4326,
            page_size=1000,
            logger=log,
        )
    )
    log.info(f"  total brut: {len(raw_features)} cours d'eau dans la BBOX")

    log.info("Clip exact sur dept Oise + simplification 5e-5°...")
    clipped = clip_features_to_polygon(
        raw_features,
        poly,
        simplify_tolerance=5e-5,
        logger=log,
    )

    # On ne garde que les propriétés utiles
    for f in clipped:
        props = f.get("properties", {}) or {}
        f["properties"] = {k: props.get(k) for k in KEEP_PROPS}

    out_proc = PROCESSED_DIR / "bleue" / "cours_eau.geojson"
    out_front = FRONTEND_DATA_DIR / "bleue" / "cours_eau.geojson"
    n = write_geojson(clipped, out_proc)
    write_geojson(clipped, out_front)
    log.info(
        f"OK — {n} cours d'eau écrits ({file_size_human(out_proc)}) → {out_proc.relative_to(out_proc.parents[2])}"
    )


if __name__ == "__main__":
    main()
