"""Téléchargement ENAF Cerema — consommation d'espaces NAF 2009-2024.

Source: Portail artificialisation des sols (Cerema, MAJ mai 2025)
URL: https://www.data.gouv.fr/datasets/consommation-despaces-naturels-agricoles-et-forestiers-...

Approche: CSV par commune (18 Mo, beaucoup plus léger que les 155 Mo de SHP).
Champs clés:
  - idcom, iddep : codes INSEE
  - naf09art24 : surface NAF (m²) consommée 2009 → 2024 (cumul)
  - art09hab24, art09act24, art09mix24, art09rou24, art09fer24, art09inc24 :
    décomposition par usage (habitat/activité/mixte/routier/ferroviaire/inconnu)
  - artcom0924 : % artificialisation 2009-2024 / surface commune
  - artpop1521 : artif/habitant 2015-2021
  - pop15, pop21, pop1521 : population et évolution

Pipeline:
1. Téléchargement CSV streamé
2. Filtre iddep='60'
3. Jointure spatiale avec communes_oise.geojson (sur insee_commune)
4. Sortie: data/processed/brune/artificialisation_communes.geojson
"""
from __future__ import annotations

import csv
import io
import json
from pathlib import Path

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

CSV_URL = "https://www.data.gouv.fr/api/1/datasets/r/8c67a68a-bb1a-4b7e-b221-62ccfb8bc4f9"

# Champs CSV à conserver dans les properties GeoJSON (clés ENAF → noms lisibles)
CSV_FIELDS = {
    "naf09art24": "naf_consomme_m2_0924",
    "art09hab24": "artif_habitat_m2_0924",
    "art09act24": "artif_activite_m2_0924",
    "art09mix24": "artif_mixte_m2_0924",
    "art09rou24": "artif_routier_m2_0924",
    "art09fer24": "artif_ferroviaire_m2_0924",
    "art09inc24": "artif_inconnu_m2_0924",
    "artcom0924": "pct_artif_commune_0924",
    "artpop1521": "artif_par_habitant_1521_m2",
    "pop15": "population_2015",
    "pop21": "population_2021",
    "pop1521": "evol_population_1521",
    "surfcom2024": "surface_commune_2024_m2",
}


def parse_num(s: str):
    """Convertit string FR (virgule décimale) en nombre, ou None."""
    if s is None or s == "":
        return None
    s = s.replace(",", ".").strip()
    try:
        if "." in s:
            return float(s)
        return int(s)
    except ValueError:
        return None


def main() -> None:
    log = setup_logger("enaf")
    log.info(f"ENAF Cerema 2009-2024 — {DEPT_NAME}")

    # 1. Charger les communes Oise (déjà disponibles)
    communes_path = FRONTEND_DATA_DIR / "admin" / "communes_oise.geojson"
    if not communes_path.exists():
        raise FileNotFoundError(f"{communes_path} introuvable - lance d'abord download_admin_express.py")
    communes_fc = json.loads(communes_path.read_text(encoding="utf-8"))
    log.info(f"  communes Oise: {len(communes_fc['features'])}")

    # 2. Télécharger CSV en streaming
    log.info(f"  GET {CSV_URL}")
    r = requests.get(CSV_URL, stream=True, timeout=300)
    r.raise_for_status()
    text = r.content.decode("utf-8")
    log.info(f"  CSV téléchargé: {len(text)/1024/1024:.1f} Mo")

    # 3. Parser et filtrer iddep=60
    enaf_by_insee: dict[str, dict] = {}
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    for row in reader:
        if row.get("iddep") != DEPT_CODE:
            continue
        insee = row["idcom"]
        cleaned = {nom_lisible: parse_num(row.get(k)) for k, nom_lisible in CSV_FIELDS.items()}
        cleaned["nom_commune"] = row.get("idcomtxt")
        enaf_by_insee[insee] = cleaned

    log.info(f"  communes ENAF dept {DEPT_CODE}: {len(enaf_by_insee)}")

    # 4. Jointure: enrichir chaque feature commune avec ENAF
    matched = 0
    out_features = []
    for f in communes_fc["features"]:
        props = f.get("properties", {}) or {}
        insee = props.get("code_insee") or props.get("INSEE_COM") or props.get("insee_commune")
        if not insee:
            continue
        enaf_data = enaf_by_insee.get(insee)
        if not enaf_data:
            continue
        # Nouveau feature: géométrie commune + props ENAF + nom commune
        new_props = {
            "code_insee": insee,
            "nom_commune": props.get("nom_officiel") or enaf_data.get("nom_commune"),
            **enaf_data,
        }
        out_features.append({
            "type": "Feature",
            "geometry": f["geometry"],
            "properties": new_props,
        })
        matched += 1
    log.info(f"  jointure: {matched}/{len(communes_fc['features'])} communes appariées")

    out_proc = PROCESSED_DIR / "brune" / "artificialisation_communes.geojson"
    out_front = FRONTEND_DATA_DIR / "brune" / "artificialisation_communes.geojson"
    write_geojson(out_features, out_proc)
    write_geojson(out_features, out_front)
    log.info(f"OK — artificialisation_communes.geojson ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
