"""Analyse Phase 3b — score de connectivité paysagère (trame verte).

Méthode (CLAUDE.md §5.3, version simplifiée sans Graphab/raster) :
1. Maille hexagonale 1 km² couvrant l'Oise (côté ~620m, area ≈ 1 km²).
2. Pour chaque hexagone intersectant le département :
   a. Buffer 1 km autour du centroïde (= rayon de dispersion typique).
   b. Mesurer la surface d'habitat naturel (forêt + zones humides + réservoirs
      biodiversité) dans ce buffer.
   c. Score = surface_habitat / surface_buffer × 100 (0-100).
3. Output : grille hex colorée par score.

Approximation par rapport à Graphab :
- Pas de connectivité graph-based (PC, dPC) faute de raster de friction.
- Le score local = "richesse en habitat dans 1 km", proxy raisonnable de la
  capacité d'une espèce à se maintenir/disperser localement.
- Phase 3c V2 : implémenter graphe Graphab quand OCS GE complet sera disponible.

Sortie : data/processed/derived/connectivite_hex.geojson
"""
from __future__ import annotations

import math

from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

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

HEX_SIDE_M = 620          # Côté tel que area ≈ 1 km²
DISPERSAL_RADIUS_M = 1000  # Rayon de dispersion (CLAUDE.md §5.3)


def make_hex(cx: float, cy: float, s: float) -> Polygon:
    """Hexagone flat-top centré sur (cx, cy), longueur côté s."""
    pts = [(cx + s * math.cos(math.pi / 3 * i), cy + s * math.sin(math.pi / 3 * i))
           for i in range(6)]
    return Polygon(pts)


def hex_grid(bounds_l93, s: float):
    """Génère grille hexagonale couvrant la bbox Lambert93."""
    xmin, ymin, xmax, ymax = bounds_l93
    dx = 1.5 * s
    dy = s * math.sqrt(3)
    out = []
    col = 0
    cx = xmin - s
    while cx <= xmax + s:
        y_off = dy / 2 if col % 2 == 1 else 0
        cy = ymin - dy + y_off
        while cy <= ymax + dy:
            out.append(make_hex(cx, cy, s))
            cy += dy
        cx += dx
        col += 1
    return out


def main() -> None:
    log = setup_logger("connectivite")
    log.info(f"Score de connectivité paysagère — {DEPT_NAME}")

    to_l93, to_4326 = make_l93_transformer()
    oise_l93 = to_l93(load_oise_polygon())

    log.info("  chargement habitats naturels (forêt + ZH + réservoirs)...")
    habitat_geoms = []
    for path in [
        "verte/foret.geojson",
        "bleue/zones_humides.geojson",
        "verte/reservoirs_biodiversite.geojson",
    ]:
        for f in load_geojson(path)["features"]:
            try:
                g = to_l93(shape(f["geometry"]))
                if not g.is_empty:
                    habitat_geoms.append(g)
            except Exception:
                pass
    log.info(f"  total habitats: {len(habitat_geoms)}")

    log.info("  union habitats (peut prendre 30s)...")
    habitat_union = unary_union(habitat_geoms)
    log.info("  union OK")

    log.info(f"  génération grille hex (côté {HEX_SIDE_M}m)...")
    bounds = oise_l93.bounds
    all_hex = hex_grid(bounds, HEX_SIDE_M)
    log.info(f"  hex bruts: {len(all_hex)}")

    # Garder seulement les hex qui touchent l'Oise
    hex_oise = [h for h in all_hex if h.intersects(oise_l93)]
    log.info(f"  hex Oise: {len(hex_oise)}")

    out_features = []
    for i, h in enumerate(hex_oise):
        if i % 500 == 0 and i:
            log.info(f"  ... {i}/{len(hex_oise)}")
        try:
            buf = h.centroid.buffer(DISPERSAL_RADIUS_M)
            buf_clip = buf.intersection(oise_l93)  # bord du dept : pas de "score fantôme"
            buf_area = buf_clip.area
            if buf_area <= 0:
                continue
            inter = buf_clip.intersection(habitat_union)
            score = (inter.area / buf_area) * 100 if not inter.is_empty else 0
        except Exception:
            score = 0
        h4 = to_4326(h).simplify(5e-5, preserve_topology=True)
        out_features.append({
            "type": "Feature",
            "geometry": mapping(h4),
            "properties": {
                "score": round(score, 1),
            },
        })

    # Stats
    scores = [f["properties"]["score"] for f in out_features]
    if scores:
        log.info(
            f"  score: min {min(scores):.1f}, max {max(scores):.1f}, "
            f"moyenne {sum(scores)/len(scores):.1f}"
        )

    out_proc = PROCESSED_DIR / "derived" / "connectivite_hex.geojson"
    out_front = FRONTEND_DATA_DIR / "derived" / "connectivite_hex.geojson"
    write_geojson(out_features, out_proc)
    write_geojson(out_features, out_front)
    log.info(f"OK — {len(out_features)} hexagones ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
