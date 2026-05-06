#!/usr/bin/env python3
"""Téléchargement Admin Express — département de l'Oise (60).

Source : WFS Géoplateforme IGN (https://data.geopf.fr/wfs/ows), licence Etalab 2.0.
Ne nécessite que `requests` (pas de geopandas) — peut tourner sur n'importe quelle
installation Python 3.11+.

Sorties (dans data/processed/admin/) :
- departement_oise.geojson  : limite départementale
- communes_oise.geojson     : 679 communes de l'Oise
- epci_oise.geojson         : EPCI dont au moins une commune est dans le 60

Les fichiers sont aussi copiés dans frontend/public/data/admin/ pour servir
directement depuis le bundle Vercel (ils sont légers).

Usage :
    python download_admin_express.py             # skip si déjà téléchargé
    python download_admin_express.py --force     # re-télécharge
"""
from __future__ import annotations

import argparse
import shutil
import sys
import time
from pathlib import Path

import requests

# Permet l'exécution directe depuis data/scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    DEPT_CODE,
    FRONTEND_DATA_DIR,
    PROCESSED_DIR,
    ensure_dir,
    file_size_human,
    setup_logger,
    write_geojson,
)

log = setup_logger("admin_express")

WFS_URL = "https://data.geopf.fr/wfs/ows"

# Typenames Admin Express sur la Géoplateforme IGN.
# Vérifié par GetCapabilities 2025-01 : LIMITES_ADMINISTRATIVES_EXPRESS.LATEST.
TYPENAME_CANDIDATES = {
    "departement": [
        "LIMITES_ADMINISTRATIVES_EXPRESS.LATEST:departement",
    ],
    "commune": [
        "LIMITES_ADMINISTRATIVES_EXPRESS.LATEST:commune",
    ],
    "epci": [
        "LIMITES_ADMINISTRATIVES_EXPRESS.LATEST:epci",
    ],
}

# Noms des champs CQL (vérifiés via WFS GetFeature) :
# - departement : code_insee
# - commune     : code_insee_du_departement, codes_siren_des_epci
# - epci        : code_siren

OUTPUT_DIR = PROCESSED_DIR / "admin"
FRONTEND_OUTPUT_DIR = FRONTEND_DATA_DIR / "admin"

PAGE_SIZE = 1000


def fetch_wfs_paginated(typename: str, cql_filter: str | None = None) -> list[dict]:
    """Récupère toutes les features d'un typename WFS avec paging."""
    features: list[dict] = []
    start_index = 0
    while True:
        params = {
            "SERVICE": "WFS",
            "VERSION": "2.0.0",
            "REQUEST": "GetFeature",
            "TYPENAMES": typename,
            "outputFormat": "application/json",
            "srsName": "EPSG:4326",
            "count": PAGE_SIZE,
            "startIndex": start_index,
        }
        if cql_filter:
            params["CQL_FILTER"] = cql_filter
        log.debug("WFS GetFeature %s startIndex=%d", typename, start_index)
        r = requests.get(WFS_URL, params=params, timeout=180)
        r.raise_for_status()
        data = r.json()
        page = data.get("features", [])
        features.extend(page)
        if len(page) < PAGE_SIZE:
            break
        start_index += PAGE_SIZE
        time.sleep(0.2)
    return features


def fetch_with_fallback(layer: str, cql_filter: str | None = None) -> list[dict]:
    """Tente plusieurs typenames jusqu'à ce qu'un fonctionne."""
    last_exc: Exception | None = None
    for typename in TYPENAME_CANDIDATES[layer]:
        try:
            log.info("Tentative typename=%s", typename)
            feats = fetch_wfs_paginated(typename, cql_filter)
            log.info("OK : %d features", len(feats))
            return feats
        except requests.HTTPError as exc:
            log.warning("Échec %s : HTTP %s", typename, exc.response.status_code if exc.response else "?")
            last_exc = exc
        except Exception as exc:
            log.warning("Échec %s : %s", typename, exc)
            last_exc = exc
    raise RuntimeError(f"Aucun typename ne fonctionne pour {layer}: {last_exc}")


def write_and_copy(features: list[dict], filename: str) -> None:
    out = OUTPUT_DIR / filename
    n = write_geojson(features, out)
    log.info("Écrit %s (%d features, %s)", out, n, file_size_human(out))
    # Copie vers frontend/public/data/admin/
    ensure_dir(FRONTEND_OUTPUT_DIR)
    dst = FRONTEND_OUTPUT_DIR / filename
    shutil.copy2(out, dst)
    log.info("Copié vers %s", dst)


def already_done() -> bool:
    expected = ["departement_oise.geojson", "communes_oise.geojson", "epci_oise.geojson"]
    return all((OUTPUT_DIR / f).exists() for f in expected)


def main() -> int:
    parser = argparse.ArgumentParser(description="Téléchargement Admin Express Oise")
    parser.add_argument("--force", action="store_true", help="Re-télécharger même si fichiers existent")
    args = parser.parse_args()

    if already_done() and not args.force:
        log.info("Données Admin Express déjà téléchargées (utiliser --force pour re-DL).")
        return 0

    ensure_dir(OUTPUT_DIR)

    # 1. Département (filtre code_insee = 60)
    log.info("=== Département ===")
    dept_feats = fetch_with_fallback("departement", cql_filter=f"code_insee='{DEPT_CODE}'")
    if not dept_feats:
        log.error("Aucune feature département trouvée pour code_insee=%s", DEPT_CODE)
        return 1
    write_and_copy(dept_feats, "departement_oise.geojson")

    # 2. Communes (filtre code_insee_du_departement = 60)
    log.info("=== Communes ===")
    commune_feats = fetch_with_fallback(
        "commune",
        cql_filter=f"code_insee_du_departement='{DEPT_CODE}'",
    )
    write_and_copy(commune_feats, "communes_oise.geojson")

    # 3. EPCI : extraction des SIREN depuis les communes.
    # Le champ codes_siren_des_epci peut contenir un ou plusieurs codes (séparés par /).
    siren_set: set[str] = set()
    for feat in commune_feats:
        raw = (feat.get("properties") or {}).get("codes_siren_des_epci")
        if not raw:
            continue
        for token in str(raw).replace(",", "/").split("/"):
            token = token.strip()
            if token:
                siren_set.add(token)
    log.info("=== EPCI === (%d SIREN distincts depuis les communes)", len(siren_set))
    if siren_set:
        in_clause = ",".join(f"'{s}'" for s in sorted(siren_set))
        try:
            epci_feats = fetch_with_fallback("epci", cql_filter=f"code_siren IN ({in_clause})")
        except Exception as exc:
            log.warning("Filtre EPCI IN(...) refusé (%s) — fallback récup complète", exc)
            epci_feats = []
        if not epci_feats:
            log.info("Fallback : récupération de tous les EPCI puis filtrage client")
            all_epci = fetch_with_fallback("epci")
            epci_feats = [
                f for f in all_epci
                if str((f.get("properties") or {}).get("code_siren") or "") in siren_set
            ]
        write_and_copy(epci_feats, "epci_oise.geojson")
    else:
        log.warning("Aucun SIREN EPCI trouvé dans les communes — schéma peut-être différent")

    log.info("Terminé.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
