"""Analyse Phase 3 — pas japonais potentiels (trame verte).

Méthode (CLAUDE.md §5.2) :
1. Filtrer les fragments forestiers de surface 0.1 ha ≤ S ≤ 5 ha (BD Forêt 2021-2023).
2. Pour chaque fragment, distance au plus proche :
   - corridor SRCE trame verte
   - réservoir de biodiversité SRCE
   - autre fragment (pour détection chapelet)
3. Classer :
   - actif    : à <500m d'un corridor OU dans un alignement (≥3 fragments à <500m)
   - potentiel : à 500-1000m d'un corridor (relais possible mais isolé)
   - isole    : >1000m, sans rôle de connectivité

Sortie : data/processed/derived/pas_japonais.geojson
         + frontend/public/data/derived/...
"""
from __future__ import annotations

from shapely.geometry import shape, mapping
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

MIN_HA = 0.1
MAX_HA = 5.0
ACTIVE_THRESHOLD_M = 500
POTENTIAL_THRESHOLD_M = 1000


def main() -> None:
    log = setup_logger("pas_japonais")
    log.info(f"Pas japonais potentiels — {DEPT_NAME}")

    foret = load_geojson("verte/foret.geojson")
    corridors = load_geojson("verte/corridors_trame_verte.geojson")
    reservoirs = load_geojson("verte/reservoirs_biodiversite.geojson")
    log.info(
        f"  forêt: {len(foret['features'])} | corridors: {len(corridors['features'])} | "
        f"réservoirs: {len(reservoirs['features'])}"
    )

    to_l93, to_4326 = make_l93_transformer()

    # Reproject + filtre fragments par taille
    fragments = []
    for f in foret["features"]:
        try:
            g = to_l93(shape(f["geometry"]))
            if g.is_empty:
                continue
            ha = g.area / 10_000
            if MIN_HA <= ha <= MAX_HA:
                fragments.append((g, ha, f.get("properties", {})))
        except Exception:
            pass
    log.info(f"  fragments retenus (0.1-5 ha): {len(fragments)}")

    # Combiner corridors + réservoirs en "réseau de référence"
    network_geoms = []
    for src in (corridors, reservoirs):
        for f in src["features"]:
            try:
                g = to_l93(shape(f["geometry"]))
                if not g.is_empty:
                    network_geoms.append(g)
            except Exception:
                pass
    log.info(f"  réseau (corridors + réservoirs): {len(network_geoms)}")
    network_tree = STRtree(network_geoms)

    # Index spatial des fragments pour calcul de chapelet
    frag_geoms = [g for g, _, _ in fragments]
    frag_tree = STRtree(frag_geoms)

    out_features = []
    counts = {"actif": 0, "potentiel": 0, "isole": 0}
    for idx, (g, ha, props) in enumerate(fragments):
        if idx % 500 == 0 and idx:
            log.info(f"  ... {idx}/{len(fragments)}")
        # Distance au réseau le plus proche
        d_network = float("inf")
        # Query rectangle élargi de 1000m
        env = g.envelope.buffer(POTENTIAL_THRESHOLD_M)
        for i in network_tree.query(env):
            ng = network_geoms[int(i)]
            d = g.distance(ng)
            if d < d_network:
                d_network = d
                if d == 0:
                    break
        # Compte de fragments voisins à <500m (chapelet)
        env_chap = g.envelope.buffer(ACTIVE_THRESHOLD_M)
        nb_voisins = 0
        for i in frag_tree.query(env_chap):
            other = frag_geoms[int(i)]
            if other is g:
                continue
            if g.distance(other) <= ACTIVE_THRESHOLD_M:
                nb_voisins += 1
                if nb_voisins >= 2:
                    break

        if d_network <= ACTIVE_THRESHOLD_M or nb_voisins >= 2:
            cls = "actif"
        elif d_network <= POTENTIAL_THRESHOLD_M:
            cls = "potentiel"
        else:
            cls = "isole"
        counts[cls] += 1

        # Output : géométrie 4326 simplifiée
        g4 = to_4326(g).simplify(5e-5, preserve_topology=True)
        out_features.append({
            "type": "Feature",
            "geometry": mapping(g4),
            "properties": {
                "surface_ha": round(ha, 2),
                "distance_reseau_m": round(d_network, 0) if d_network < float("inf") else None,
                "nb_voisins_500m": nb_voisins,
                "classe": cls,
                "nature": props.get("nature"),
            },
        })

    log.info(f"  classes: {counts}")

    out_proc = PROCESSED_DIR / "derived" / "pas_japonais.geojson"
    out_front = FRONTEND_DATA_DIR / "derived" / "pas_japonais.geojson"
    write_geojson(out_features, out_proc)
    write_geojson(out_features, out_front)
    log.info(f"OK — {len(out_features)} fragments ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
