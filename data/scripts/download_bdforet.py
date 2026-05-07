"""Téléchargement BD Forêt / Masque Forêt — Oise.

Source: IGN Géoplateforme WFS (data.geopf.fr/wfs/ows)
Typename: IGNF_MASQUE-FORET.2021-2023:masque_foret
  - Couverture forestière la plus récente disponible (2021-2023)
  - Polygones binaires "présence/absence" forêt
  - Champ 'nature' (ex: feuillus, conifères, mixtes) pour distinction visuelle

Filtre serveur: CQL_FILTER code_dpt='60'
Pré-filtre côté client: surface > 0.5 ha (réduit le bruit visuel sur la carte)

Sortie: data/processed/verte/foret.geojson
       + frontend/public/data/verte/foret.geojson
"""
from __future__ import annotations

from shapely.geometry import shape, mapping
from pyproj import Geod

from _common import (
    DEPT_CODE,
    DEPT_NAME,
    FRONTEND_DATA_DIR,
    PROCESSED_DIR,
    file_size_human,
    setup_logger,
    wfs_paged_geojson,
    write_geojson,
)

WFS_BASE = "https://data.geopf.fr/wfs/ows"
TYPENAME = "IGNF_MASQUE-FORET.2021-2023:masque_foret"

# Surface minimale en hectares pour conserver un fragment forestier
# 2 ha = bon compromis : retient les massifs significatifs, élimine le bruit visuel
MIN_AREA_HA = 2.0
# Tolérance de simplification en degrés EPSG:4326 (~10m, suffisant à l'échelle dept)
SIMPLIFY_TOL = 1e-4

KEEP_PROPS = ("id", "nature", "usage", "millesime")


def main() -> None:
    log = setup_logger("bdforet")
    log.info(f"Masque Forêt 2021-2023 — {DEPT_NAME}")

    log.info(f"WFS GetFeature {TYPENAME} CQL code_dpt='{DEPT_CODE}'")
    raw = list(
        wfs_paged_geojson(
            WFS_BASE,
            TYPENAME,
            cql_filter=f"code_dpt='{DEPT_CODE}'",
            page_size=1000,
            output_format="json",  # IGN n'accepte pas 'geojson'
            logger=log,
        )
    )
    log.info(f"  total brut: {len(raw)} polygones forestiers")

    # Filtrage par surface (geodesic en EPSG:4326)
    geod = Geod(ellps="WGS84")
    kept = []
    for f in raw:
        try:
            g = shape(f["geometry"])
            if g.is_empty:
                continue
            # Aire géodésique en m² → ha
            area_m2 = abs(geod.geometry_area_perimeter(g)[0])
            area_ha = area_m2 / 10_000
            if area_ha < MIN_AREA_HA:
                continue
            # Simplification
            g_simple = g.simplify(SIMPLIFY_TOL, preserve_topology=True)
            if g_simple.is_empty:
                continue
            props = f.get("properties", {}) or {}
            new_props = {k: props.get(k) for k in KEEP_PROPS}
            new_props["surface_ha"] = round(area_ha, 2)
            kept.append({
                "type": "Feature",
                "geometry": mapping(g_simple),
                "properties": new_props,
            })
        except Exception as exc:
            log.warning(f"  feature ignoré: {exc}")

    log.info(f"  après filtre >{MIN_AREA_HA}ha: {len(kept)}/{len(raw)} polygones")

    out_proc = PROCESSED_DIR / "verte" / "foret.geojson"
    out_front = FRONTEND_DATA_DIR / "verte" / "foret.geojson"
    write_geojson(kept, out_proc)
    write_geojson(kept, out_front)
    log.info(f"OK — foret.geojson ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
