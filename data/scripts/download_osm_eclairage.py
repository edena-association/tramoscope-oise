"""Téléchargement OSM — éclairage public et voies éclairées de l'Oise.

Source: OpenStreetMap via Overpass API
Tags ciblés:
  - node[highway=street_lamp] : lampadaires
  - way[highway][lit=yes] : voies dont l'éclairage est attesté

Sortie:
  - frontend/public/data/noire/lampadaires_osm.geojson (points)
  - frontend/public/data/noire/voies_eclairees.geojson (linestrings)

Couverture connue (mai 2026): ~9286 lampadaires sur Oise, attribution lamp_type
seulement à ~4%. Pour MVP on ne montre que la position - pas de typage couleur
fiable, ce qui demande l'inventaire SE60 (à négocier en partenariat).
"""
from __future__ import annotations

import json

import requests

from _common import (
    DEPT_CODE,
    DEPT_NAME,
    FRONTEND_DATA_DIR,
    PROCESSED_DIR,
    file_size_human,
    setup_logger,
    write_geojson,
)

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]
HEADERS = {"User-Agent": "EdenaTramoscope/1.0 (https://edena.eco)", "Accept": "application/json"}


def overpass(query: str, log) -> dict:
    last_err = None
    import time
    for mirror in OVERPASS_MIRRORS:
        for attempt in range(1, 3):
            try:
                log.info(f"  POST {mirror[:40]} (try {attempt})")
                r = requests.post(mirror, data={"data": query}, headers=HEADERS, timeout=600)
                if r.status_code == 200:
                    return r.json()
                last_err = f"HTTP {r.status_code}"
                if r.status_code in (429, 504):
                    time.sleep(8 * attempt)
                else:
                    break  # autre mirroir
            except Exception as exc:
                last_err = str(exc)
                time.sleep(5)
    raise RuntimeError(f"Overpass épuisé : {last_err}")


def main() -> None:
    log = setup_logger("osm_eclairage")
    log.info(f"OSM éclairage public — {DEPT_NAME}")

    # Lampadaires (nodes)
    log.info("→ Lampadaires (highway=street_lamp)")
    q_lamps = f"""
[out:json][timeout:300];
area["ref:INSEE"="{DEPT_CODE}"][admin_level=6]->.dept;
node[highway=street_lamp](area.dept);
out body;
"""
    data = overpass(q_lamps, log)
    lamps = data.get("elements", [])
    log.info(f"  {len(lamps)} lampadaires")

    lamp_features = []
    for el in lamps:
        if "lat" not in el or "lon" not in el:
            continue
        tags = el.get("tags", {}) or {}
        # On ne conserve que ce qui peut servir à un futur typage
        keep = {k: tags[k] for k in
                ("lamp_type", "lamp_mount", "operator", "ref", "light:method",
                 "luminous_flux", "colour", "support") if k in tags}
        keep["osm_id"] = el["id"]
        lamp_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]},
            "properties": keep,
        })

    out_proc = PROCESSED_DIR / "noire" / "lampadaires_osm.geojson"
    out_front = FRONTEND_DATA_DIR / "noire" / "lampadaires_osm.geojson"
    write_geojson(lamp_features, out_proc)
    write_geojson(lamp_features, out_front)
    log.info(f"  → lampadaires_osm.geojson ({file_size_human(out_proc)})")

    # Voies éclairées (ways with lit=yes)
    log.info("\n→ Voies éclairées (highway+lit=yes)")
    q_lit = f"""
[out:json][timeout:300];
area["ref:INSEE"="{DEPT_CODE}"][admin_level=6]->.dept;
way[highway][lit=yes](area.dept);
out body geom;
"""
    data = overpass(q_lit, log)
    ways = data.get("elements", [])
    log.info(f"  {len(ways)} voies éclairées")

    way_features = []
    for el in ways:
        coords = [[pt["lon"], pt["lat"]] for pt in el.get("geometry", [])]
        if len(coords) < 2:
            continue
        tags = el.get("tags", {}) or {}
        keep = {k: tags[k] for k in ("highway", "name", "ref", "surface") if k in tags}
        keep["osm_id"] = el["id"]
        way_features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": keep,
        })

    out_proc = PROCESSED_DIR / "noire" / "voies_eclairees.geojson"
    out_front = FRONTEND_DATA_DIR / "noire" / "voies_eclairees.geojson"
    write_geojson(way_features, out_proc)
    write_geojson(way_features, out_front)
    log.info(f"  → voies_eclairees.geojson ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
