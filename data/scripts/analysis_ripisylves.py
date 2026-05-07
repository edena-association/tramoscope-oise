"""Analyse Phase 3 — ruptures de ripisylves (trame turquoise).

Méthode (CLAUDE.md §5.4) :
1. Pour chaque cours d'eau (BD TOPAGE) :
   a. Découper en segments de ~250m
   b. Buffer 10m de chaque côté = polygone tampon
   c. Mesurer la part de couverture forestière (BD Forêt) dans le buffer
2. Classer chaque segment :
   - >70% couvert       : ripisylve présente
   - 30-70%             : ripisylve dégradée
   - <30%               : ripisylve absente

Sortie : data/processed/derived/ripisylves.geojson
         + frontend/public/data/derived/...
"""
from __future__ import annotations

from shapely.geometry import LineString, MultiLineString, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from _common import (
    DEPT_NAME,
    FRONTEND_DATA_DIR,
    PROCESSED_DIR,
    file_size_human,
    load_geojson,
    make_l93_transformer,
    setup_logger,
    write_geojson,
)

SEGMENT_LENGTH_M = 250
BUFFER_M = 10
THRESHOLD_PRESENT = 0.7
THRESHOLD_ABSENT = 0.3


def split_line(line: LineString, seg_len: float):
    """Découpe une LineString en segments de ~seg_len mètres (CRS métrique)."""
    total = line.length
    if total < seg_len:
        yield line
        return
    n = int(total // seg_len) + 1
    step = total / n
    for i in range(n):
        start = line.interpolate(i * step)
        end = line.interpolate((i + 1) * step) if i + 1 < n else line.interpolate(total)
        yield LineString([start, end])


def main() -> None:
    log = setup_logger("ripisylves")
    log.info(f"Ruptures de ripisylves — {DEPT_NAME}")

    cours_eau = load_geojson("bleue/cours_eau.geojson")
    foret = load_geojson("verte/foret.geojson")
    log.info(f"  {len(cours_eau['features'])} cours d'eau, {len(foret['features'])} polygones forêt")

    to_l93, to_4326 = make_l93_transformer()

    # Indexer la forêt en L93
    log.info("  reprojection + index forêt...")
    foret_geoms = []
    for f in foret["features"]:
        try:
            g = to_l93(shape(f["geometry"]))
            if not g.is_empty:
                foret_geoms.append(g)
        except Exception:
            pass
    foret_tree = STRtree(foret_geoms)

    # Pour chaque cours d'eau, splitter et calculer couverture
    out_features = []
    counts = {"presente": 0, "degradee": 0, "absente": 0}
    for idx, ce in enumerate(cours_eau["features"]):
        if idx % 100 == 0:
            log.info(f"  ... cours d'eau {idx}/{len(cours_eau['features'])}")
        try:
            geom = to_l93(shape(ce["geometry"]))
        except Exception:
            continue
        lines = []
        if isinstance(geom, LineString):
            lines = [geom]
        elif isinstance(geom, MultiLineString):
            lines = list(geom.geoms)
        else:
            continue

        nom = ce["properties"].get("TopoOH") or ce["properties"].get("CdOH") or ""

        for line in lines:
            for seg in split_line(line, SEGMENT_LENGTH_M):
                if seg.length < 5:
                    continue
                buf = seg.buffer(BUFFER_M, cap_style=2, join_style=2)
                buf_area = buf.area
                if buf_area == 0:
                    continue
                # Intersection avec polygones forêts proches
                cands_idx = foret_tree.query(buf)
                inter_area = 0.0
                for i in cands_idx:
                    fg = foret_geoms[int(i)]
                    if buf.intersects(fg):
                        try:
                            inter_area += buf.intersection(fg).area
                        except Exception:
                            pass
                ratio = inter_area / buf_area
                if ratio >= THRESHOLD_PRESENT:
                    cls = "presente"
                elif ratio >= THRESHOLD_ABSENT:
                    cls = "degradee"
                else:
                    cls = "absente"
                counts[cls] += 1
                # Garder seg en 4326 simplifié
                seg_4326 = to_4326(seg).simplify(5e-5, preserve_topology=True)
                out_features.append({
                    "type": "Feature",
                    "geometry": mapping(seg_4326),
                    "properties": {
                        "cours_eau": nom,
                        "longueur_m": round(seg.length, 1),
                        "couverture_arboree": round(ratio, 3),
                        "etat_ripisylve": cls,
                    },
                })

    log.info(f"  segments analysés: {sum(counts.values())}")
    log.info(f"  états: {counts}")

    out_proc = PROCESSED_DIR / "derived" / "ripisylves.geojson"
    out_front = FRONTEND_DATA_DIR / "derived" / "ripisylves.geojson"
    write_geojson(out_features, out_proc)
    write_geojson(out_features, out_front)
    log.info(f"OK — {len(out_features)} segments ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
