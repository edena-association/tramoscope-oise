"""Analyse Phase 3 — déserts pollinisateurs (trame rose).

Méthode (CLAUDE.md §5.5) :
1. Identifier les habitats favorables aux pollinisateurs :
   - Forêts (lisières, sous-bois, haies)
   - Zones humides (sources de nectar variées)
   - Réservoirs de biodiversité SRCE (prairies, milieux ouverts)
   Note : sans RPG en local, on utilise ces proxies. La donnée sera affinée
   en V2 quand RPG sera téléchargé.
2. Buffer 300m autour de chaque habitat (rayon de butinage médian abeille sauvage).
3. Soustraire l'ensemble des buffers du polygone Oise = zones sans habitat à <300m.
4. Découper en polygones connexes ; ne garder que les zones >50 ha.
5. Classer :
   - 50-200 ha    : désert modéré
   - 200-500 ha   : désert sévère
   - >500 ha      : désert critique

Sortie : data/processed/derived/deserts_pollinisateurs.geojson
         + frontend/public/data/derived/...
"""
from __future__ import annotations

from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union

from _common import (
    DEPT_NAME,
    FRONTEND_DATA_DIR,
    PROCESSED_DIR,
    file_size_human,
    load_geojson,
    load_oise_polygon,
    make_l93_transformer,
    setup_logger,
    write_geojson,
)

FORAGING_RADIUS_M = 300
MIN_DESERT_HA = 50
SEVERITY_MODERATE_HA = 200
SEVERITY_SEVERE_HA = 500


def severity(area_ha: float) -> str:
    if area_ha >= SEVERITY_SEVERE_HA:
        return "critique"
    if area_ha >= SEVERITY_MODERATE_HA:
        return "severe"
    return "modere"


def main() -> None:
    log = setup_logger("deserts_polli")
    log.info(f"Déserts pollinisateurs — {DEPT_NAME}")

    to_l93, to_4326 = make_l93_transformer()

    log.info("  chargement habitats favorables...")
    sources = [
        ("forêt", "verte/foret.geojson"),
        ("zones humides", "bleue/zones_humides.geojson"),
        ("réservoirs biodiv", "verte/reservoirs_biodiversite.geojson"),
    ]
    habitat_geoms = []
    for label, path in sources:
        fc = load_geojson(path)
        ok = 0
        for f in fc["features"]:
            try:
                g = to_l93(shape(f["geometry"]))
                if not g.is_empty:
                    habitat_geoms.append(g)
                    ok += 1
            except Exception:
                pass
        log.info(f"    {label}: {ok}")

    log.info(f"  total habitats: {len(habitat_geoms)}")
    log.info("  union + buffer 300m...")
    habitats_union = unary_union(habitat_geoms)
    foraging = habitats_union.buffer(FORAGING_RADIUS_M)

    log.info("  soustraction Oise - butinage...")
    oise_l93 = to_l93(load_oise_polygon())
    deserts = oise_l93.difference(foraging)

    # Découper en polygones individuels
    polys = []
    if isinstance(deserts, Polygon):
        polys = [deserts]
    elif isinstance(deserts, MultiPolygon):
        polys = list(deserts.geoms)
    log.info(f"  composantes brutes: {len(polys)}")

    # Filtrer >50 ha
    out_features = []
    counts = {"modere": 0, "severe": 0, "critique": 0}
    for p in polys:
        ha = p.area / 10_000
        if ha < MIN_DESERT_HA:
            continue
        sev = severity(ha)
        counts[sev] += 1
        g4 = to_4326(p).simplify(1e-4, preserve_topology=True)
        out_features.append({
            "type": "Feature",
            "geometry": mapping(g4),
            "properties": {
                "surface_ha": round(ha, 1),
                "severite": sev,
            },
        })

    out_features.sort(key=lambda f: -f["properties"]["surface_ha"])
    log.info(f"  déserts retenus (>50 ha): {len(out_features)}")
    log.info(f"  sévérité: {counts}")

    out_proc = PROCESSED_DIR / "derived" / "deserts_pollinisateurs.geojson"
    out_front = FRONTEND_DATA_DIR / "derived" / "deserts_pollinisateurs.geojson"
    write_geojson(out_features, out_proc)
    write_geojson(out_features, out_front)
    log.info(f"OK — {len(out_features)} déserts ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
