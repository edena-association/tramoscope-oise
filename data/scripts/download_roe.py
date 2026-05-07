"""Téléchargement ROE — obstacles à l'écoulement Oise.

Source: WFS Sandre (services.sandre.eaufrance.fr/geo/sandre)
Typename: sa:ObstEcoul_FXX (Point, EPSG:4326 disponible)
Filtre serveur: CQL_FILTER CdDepartement='60'

Sortie: data/processed/bleue/obstacles.geojson
       + frontend/public/data/bleue/obstacles.geojson
"""
from __future__ import annotations

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

WFS_BASE = "https://services.sandre.eaufrance.fr/geo/sandre"
TYPENAME = "sa:ObstEcoul_FXX"

# Champs propres conservés pour l'affichage
KEEP_PROPS = (
    "CdObstEcoul",          # ROE id
    "NomPrincipalObstEcoul",
    "LbTypeOuvrage",        # type d'ouvrage
    "LbEtOuvrage",          # état de l'ouvrage
    "HautChutEtObstEcoul",  # hauteur de chute (m)
    "LbHautChutClObstEcoul",
    "LbTypeDispFranchPiscicole1",
    "LbCommune",
    "NomEntiteHydrographique",
    "GrenObstEcoul",        # classement Grenelle (t/f)
    "DateMAJObstEcoul",
)


def main() -> None:
    log = setup_logger("roe")
    log.info(f"ROE — obstacles à l'écoulement {DEPT_NAME}")

    # Sandre WFS ignore CQL_FILTER mais accepte les FILTER OGC XML
    ogc = (
        "<Filter><PropertyIsEqualTo>"
        "<PropertyName>CdDepartement</PropertyName>"
        f"<Literal>{DEPT_CODE}</Literal>"
        "</PropertyIsEqualTo></Filter>"
    )
    log.info(f"WFS GetFeature {TYPENAME} OGC CdDepartement={DEPT_CODE}")
    raw_features = list(
        wfs_paged_geojson(
            WFS_BASE,
            TYPENAME,
            ogc_filter=ogc,
            page_size=1000,
            logger=log,
        )
    )
    log.info(f"  total: {len(raw_features)} obstacles dans le dept {DEPT_CODE}")

    # Filtrage de propriétés
    cleaned = []
    for f in raw_features:
        props = f.get("properties", {}) or {}
        new_props = {k: props.get(k) for k in KEEP_PROPS}
        cleaned.append(
            {
                "type": "Feature",
                "geometry": f["geometry"],
                "properties": new_props,
            }
        )

    out_proc = PROCESSED_DIR / "bleue" / "obstacles.geojson"
    out_front = FRONTEND_DATA_DIR / "bleue" / "obstacles.geojson"
    n = write_geojson(cleaned, out_proc)
    write_geojson(cleaned, out_front)
    log.info(
        f"OK — {n} obstacles écrits ({file_size_human(out_proc)}) → {out_proc.relative_to(out_proc.parents[2])}"
    )


if __name__ == "__main__":
    main()
