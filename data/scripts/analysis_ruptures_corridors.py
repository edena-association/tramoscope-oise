"""Analyse Phase 3b — ruptures de corridors SRCE (trame verte + bleue).

Méthode (CLAUDE.md §5.1, version simplifiée sans raster de friction) :
1. Combiner corridors trame verte (cer_corridor_s_fr32) + trame bleue
   (cer_cours_eau_l_fr32) en un réseau de corridors candidats.
2. Charger les obstacles SRCE :
   - Surfaciques : urbanisation traversant les corridors
   - Linéaires : routes/voies ferrées coupant les corridors
3. Pour chaque corridor, identifier les segments d'intersection avec un obstacle :
   - Surface  → mesurer la "largeur" traversée par le corridor
   - Linéaire → c'est un point/segment de rupture, sévérité forfaitaire (modérée)
4. Classer selon largeur de rupture (CLAUDE.md §5.1 thresholds) :
   - <500m       : légère
   - 500m-2km    : modérée
   - >2km        : critique

Sortie : data/processed/derived/ruptures_corridors.geojson
"""
from __future__ import annotations

from shapely.geometry import LineString, MultiLineString, mapping, shape
from shapely.ops import unary_union

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

LIGHT_THRESHOLD_M = 500
MODERATE_THRESHOLD_M = 2000


def severity_from_length(meters: float) -> str:
    if meters >= MODERATE_THRESHOLD_M:
        return "critique"
    if meters >= LIGHT_THRESHOLD_M:
        return "moderee"
    return "legere"


def main() -> None:
    log = setup_logger("ruptures_corridors")
    log.info(f"Ruptures de corridors SRCE — {DEPT_NAME}")

    to_l93, to_4326 = make_l93_transformer()

    # 1. Corridors candidats : trame verte (polygone) + trame bleue (linéaire)
    corridors = []
    sources = [
        ("verte_surface", "verte/corridors_trame_verte.geojson"),
        ("bleue_lineaire", "bleue/corridors_trame_bleue.geojson"),
    ]
    for label, path in sources:
        try:
            fc = load_geojson(path)
            for f in fc["features"]:
                try:
                    g = to_l93(shape(f["geometry"]))
                    if g.is_empty:
                        continue
                    corridors.append({
                        "geom": g,
                        "type": label,
                        "props": f.get("properties", {}) or {},
                    })
                except Exception:
                    pass
            log.info(f"  corridors {label}: {len(fc['features'])}")
        except FileNotFoundError as e:
            log.warning(f"  {label} absent: {e}")

    log.info(f"  total corridors: {len(corridors)}")

    # 2. Obstacles : surfaciques + linéaires (SRCE HdF)
    obstacles_surf = unary_union([
        to_l93(shape(f["geometry"]))
        for f in load_geojson("verte/obstacles_corridors_surface.geojson")["features"]
    ])
    obstacles_lin = unary_union([
        to_l93(shape(f["geometry"]))
        for f in load_geojson("verte/obstacles_corridors_lineaires.geojson")["features"]
    ])
    log.info(
        f"  obstacles : surfaciques {obstacles_surf.geom_type}, "
        f"linéaires {obstacles_lin.geom_type}"
    )

    # 3. Intersection pour chaque corridor
    out_features = []
    counts = {"legere": 0, "moderee": 0, "critique": 0}

    for c in corridors:
        cg = c["geom"]
        # Si c'est un polygone (corridor surfacique), on travaille sur sa frontière
        # ou directement le polygone selon le type.
        # Surface : on mesure la surface traversée par les obstacles surfaciques
        # Linéaire : on mesure la longueur coupée
        if c["type"] == "verte_surface":
            inter = cg.intersection(obstacles_surf)
            if inter.is_empty:
                continue
            # Récupérer composantes
            geoms = []
            if inter.geom_type == "Polygon":
                geoms = [inter]
            elif inter.geom_type == "MultiPolygon":
                geoms = list(inter.geoms)
            for g in geoms:
                # "Largeur" = sqrt(area) approximation
                area_m2 = g.area
                width_m = (area_m2 ** 0.5)
                sev = severity_from_length(width_m)
                counts[sev] += 1
                g4 = to_4326(g).simplify(1e-4, preserve_topology=True)
                out_features.append({
                    "type": "Feature",
                    "geometry": mapping(g4),
                    "properties": {
                        "corridor_type": "trame verte",
                        "obstacle": "urbanisation",
                        "longueur_rupture_m": round(width_m),
                        "surface_rupture_ha": round(area_m2 / 10_000, 2),
                        "severite": sev,
                    },
                })
        else:
            # Corridor linéaire (trame bleue) : intersection avec obstacles surface (continue)
            # + obstacles linéaires (point/cross)
            for obs_geom, obs_kind in (
                (obstacles_surf, "urbanisation"),
                (obstacles_lin, "infrastructure"),
            ):
                inter = cg.intersection(obs_geom)
                if inter.is_empty:
                    continue
                lines = []
                if inter.geom_type == "LineString":
                    lines = [inter]
                elif inter.geom_type == "MultiLineString":
                    lines = list(inter.geoms)
                else:
                    continue
                for ln in lines:
                    L = ln.length
                    if L < 5:
                        continue
                    sev = severity_from_length(L)
                    counts[sev] += 1
                    g4 = to_4326(ln).simplify(1e-4, preserve_topology=True)
                    out_features.append({
                        "type": "Feature",
                        "geometry": mapping(g4),
                        "properties": {
                            "corridor_type": "trame bleue",
                            "obstacle": obs_kind,
                            "longueur_rupture_m": round(L),
                            "severite": sev,
                        },
                    })

    log.info(f"  ruptures détectées: {len(out_features)}")
    log.info(f"  sévérité: {counts}")

    out_proc = PROCESSED_DIR / "derived" / "ruptures_corridors.geojson"
    out_front = FRONTEND_DATA_DIR / "derived" / "ruptures_corridors.geojson"
    write_geojson(out_features, out_proc)
    write_geojson(out_features, out_front)
    log.info(f"OK — {len(out_features)} ruptures ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
