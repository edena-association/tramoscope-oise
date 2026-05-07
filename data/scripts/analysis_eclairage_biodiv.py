"""Analyse Phase 3 — conflits éclairage / biodiversité.

Méthode (CLAUDE.md §5.6) :
1. Sélectionner communes avec radiance_moy_2024 > 5 nW/cm²/sr (seuil de pollution
   significative).
2. Intersecter ces communes avec ZNIEFF I/II + Natura 2000 ZSC/ZPS.
3. Pour chaque polygone d'intersection, classer la sévérité :
   - 5-20 nW    : conflit modéré
   - 20-50 nW   : conflit sévère
   - >50 nW     : conflit critique

Sortie : data/processed/derived/conflits_eclairage_biodiv.geojson
         + frontend/public/data/derived/...
"""
from __future__ import annotations

from shapely.geometry import shape, mapping
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

# Seuil de pollution significative (nW/cm²/sr)
RADIANCE_THRESHOLD = 5.0


def severity(radiance: float) -> str:
    if radiance >= 50:
        return "critique"
    if radiance >= 20:
        return "severe"
    return "modere"


def main() -> None:
    log = setup_logger("conflits_eclairage")
    log.info(f"Conflits éclairage × biodiversité — {DEPT_NAME}")

    # Charger sources
    eclairage = load_geojson("noire/eclairage_communes.geojson")
    log.info(f"  communes éclairage: {len(eclairage['features'])}")

    biodiv_files = [
        ("ZNIEFF1", "verte/znieff1.geojson"),
        ("ZNIEFF2", "verte/znieff2.geojson"),
        ("Natura2000_ZSC", "verte/natura_zsc.geojson"),
        ("Natura2000_ZPS", "verte/natura_zps.geojson"),
    ]
    biodiv = []
    for label, path in biodiv_files:
        try:
            fc = load_geojson(path)
            for f in fc["features"]:
                f["_source"] = label
                f["_label"] = (
                    f["properties"].get("nom_zone")
                    or f["properties"].get("sitename")
                    or f["properties"].get("lb_zone")
                    or label
                )
            biodiv.extend(fc["features"])
            log.info(f"  {label}: {len(fc['features'])}")
        except FileNotFoundError as e:
            log.warning(f"  {label} absent: {e}")

    to_l93, to_4326 = make_l93_transformer()

    out_features = []
    for ec in eclairage["features"]:
        r = ec["properties"].get("radiance_moy_2024")
        if r is None or r < RADIANCE_THRESHOLD:
            continue
        ec_geom = to_l93(shape(ec["geometry"]))
        commune_nom = ec["properties"].get("nom") or "?"
        sev = severity(r)

        for bf in biodiv:
            try:
                bf_geom = to_l93(shape(bf["geometry"]))
                inter = ec_geom.intersection(bf_geom)
                if inter.is_empty:
                    continue
                # En L93 → m² → ha
                area_ha = inter.area / 10_000
                if area_ha < 0.5:  # bruit, ignorer
                    continue
                geom_4326 = to_4326(inter).simplify(1e-4, preserve_topology=True)
                out_features.append({
                    "type": "Feature",
                    "geometry": mapping(geom_4326),
                    "properties": {
                        "commune": commune_nom,
                        "code_insee": ec["properties"].get("insee_com"),
                        "radiance": round(r, 2),
                        "site_biodiv": bf["_label"],
                        "type_biodiv": bf["_source"],
                        "surface_ha": round(area_ha, 2),
                        "severite": sev,
                    },
                })
            except Exception as exc:
                log.warning(f"  intersect ko: {exc}")

    log.info(f"  conflits identifiés: {len(out_features)}")
    counts = {}
    for f in out_features:
        sev = f["properties"]["severite"]
        counts[sev] = counts.get(sev, 0) + 1
    log.info(f"  sévérité: {counts}")

    out_proc = PROCESSED_DIR / "derived" / "conflits_eclairage_biodiv.geojson"
    out_front = FRONTEND_DATA_DIR / "derived" / "conflits_eclairage_biodiv.geojson"
    write_geojson(out_features, out_proc)
    write_geojson(out_features, out_front)
    log.info(f"OK — {len(out_features)} conflits ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
