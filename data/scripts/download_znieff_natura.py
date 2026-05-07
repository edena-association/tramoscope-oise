"""Téléchargement ZNIEFF + Natura 2000 — polygones, clip Oise.

Source: IGN Géoplateforme WFS (data.geopf.fr/wfs/ows) — relais des données INPN
Typenames :
  - patrinat_znieff1:znieff1   (ZNIEFF type I)
  - patrinat_znieff2:znieff2   (ZNIEFF type II)
  - patrinat_sic:sic           (Natura 2000 ZSC - directive Habitats)
  - patrinat_zps:zps           (Natura 2000 ZPS - directive Oiseaux)

Sortie: data/processed/verte/{znieff1, znieff2, natura_zsc, natura_zps}.geojson
        + frontend/public/data/verte/...
"""
from __future__ import annotations

from shapely.geometry import shape, mapping

from _common import (
    DEPT_NAME,
    FRONTEND_DATA_DIR,
    OISE_BBOX_4326,
    PROCESSED_DIR,
    file_size_human,
    load_oise_polygon,
    setup_logger,
    wfs_paged_geojson,
    write_geojson,
)

WFS_BASE = "https://data.geopf.fr/wfs/ows"

DATASETS = [
    # (typename, output_name, simplify_tol, props_to_keep)
    ("patrinat_znieff1:znieff1", "znieff1", 1e-4, ("nm_sffzn", "nom_zone", "id_mnhn", "lb_zone")),
    ("patrinat_znieff2:znieff2", "znieff2", 1e-4, ("nm_sffzn", "nom_zone", "id_mnhn", "lb_zone")),
    ("patrinat_sic:sic",         "natura_zsc", 1e-4, ("sitecode", "sitename", "nm_sffzn")),
    ("patrinat_zps:zps",         "natura_zps", 1e-4, ("sitecode", "sitename", "nm_sffzn")),
]


def main() -> None:
    log = setup_logger("znieff_natura")
    log.info(f"ZNIEFF + Natura 2000 → {DEPT_NAME}")

    oise = load_oise_polygon()

    for typename, out_name, tol, keep in DATASETS:
        log.info(f"\n=== {typename} ===")
        try:
            raw = list(
                wfs_paged_geojson(
                    WFS_BASE,
                    typename,
                    bbox=OISE_BBOX_4326,
                    bbox_order="lonlat",  # IGN attend lon,lat
                    output_format="json",  # IGN
                    page_size=500,
                    logger=log,
                )
            )
        except Exception as exc:
            log.error(f"  échec {typename}: {exc}")
            continue
        log.info(f"  brut: {len(raw)} features")

        kept = []
        for f in raw:
            try:
                g = shape(f["geometry"])
                if g.is_empty:
                    continue
                inter = g.intersection(oise)
                if inter.is_empty:
                    continue
                inter = inter.simplify(tol, preserve_topology=True)
                props_in = f.get("properties", {}) or {}
                # On garde les champs utiles + surface en ha calculée par turf côté front
                props = {k: props_in.get(k) for k in keep if props_in.get(k) is not None}
                kept.append({
                    "type": "Feature",
                    "geometry": mapping(inter),
                    "properties": props,
                })
            except Exception as exc:
                log.warning(f"  feature ignoré: {exc}")
        log.info(f"  clipé Oise: {len(kept)} features")

        out_proc = PROCESSED_DIR / "verte" / f"{out_name}.geojson"
        out_front = FRONTEND_DATA_DIR / "verte" / f"{out_name}.geojson"
        write_geojson(kept, out_proc)
        write_geojson(kept, out_front)
        log.info(f"  → {out_name}.geojson ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
