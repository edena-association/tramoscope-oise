"""Enrichissement des communes Oise : maires 2026, gentilés, annuaire mairie.

Sources :
1. RNE — Répertoire National des Élus (mai 2026, post-élections municipales)
   data.gouv.fr/api/1/datasets/r/2876a346-... (CSV ~4.4 Mo)
2. Gentilés — base Habitants.fr (2020)
   data.gouv.fr/api/1/datasets/r/8f33a9a6-... (CSV)
3. Annuaire mairies — DILA via API OpenDataSoft (filtre dept Oise)

Pipeline :
1. Charger communes_oise.geojson
2. Pour chaque source, récupérer les données dept 60
3. Joindre par INSEE (avec normalisation pour les codes < 5 chars)
4. Sauvegarder en remplaçant communes_oise.geojson (data/processed + frontend)

Champs ajoutés aux properties commune :
  - maire_2026 : "Prénom NOM"
  - mandat_debut : date début mandat
  - gentile : nom des habitants
  - email_mairie, site_mairie : annuaire DILA
  - adresse_mairie : adresse postale
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

UA = {"User-Agent": "EdenaTramoscope/1.0"}

# URLs de téléchargement directes data.gouv (résolues lors de l'audit)
URL_MAIRES_RNE = "https://www.data.gouv.fr/api/1/datasets/r/2876a346-d50c-4911-934e-19ee07b0e503"
URL_GENTILES = "https://www.data.gouv.fr/api/1/datasets/r/8f33a9a6-2522-43d1-8981-648ca2667fa7"
URL_ANNUAIRE_API = (
    "https://public.opendatasoft.com/api/explore/v2.1/"
    "catalog/datasets/annuaire-de-ladministration-base-de-donnees-locales/records"
)


def normalize_insee(raw: str | int) -> str:
    """Normalise un code INSEE commune en 5 caractères."""
    s = str(raw).strip()
    if len(s) == 5:
        return s
    if len(s) == 4:
        # ex: "1001" → "01001" (dept à 1 chiffre)
        return "0" + s
    return s.zfill(5)


def fetch_maires_oise(log) -> dict[str, dict]:
    """Télécharge le RNE maires et filtre dept 60."""
    log.info(f"  GET RNE maires {URL_MAIRES_RNE}")
    r = requests.get(URL_MAIRES_RNE, headers=UA, timeout=300)
    r.raise_for_status()
    text = r.content.decode("utf-8")
    log.info(f"  RNE maires: {len(text)/1024/1024:.1f} Mo")
    out = {}
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    for row in reader:
        if row.get("Code du département") != DEPT_CODE:
            continue
        insee = normalize_insee(row["Code de la commune"])
        prenom = row.get("Prénom de l'élu", "").strip()
        nom = row.get("Nom de l'élu", "").strip()
        out[insee] = {
            "maire_2026": f"{prenom} {nom}".strip(),
            "mandat_debut": row.get("Date de début du mandat") or None,
            "csp_maire": row.get("Libellé de la catégorie socio-professionnelle") or None,
        }
    log.info(f"  maires Oise: {len(out)}")
    return out


def fetch_gentiles_oise(log) -> dict[str, str]:
    """Télécharge la base gentilés et filtre Oise."""
    log.info(f"  GET gentilés {URL_GENTILES}")
    r = requests.get(URL_GENTILES, headers=UA, timeout=120)
    r.raise_for_status()
    text = r.content.decode("utf-8-sig")
    out = {}
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    for row in reader:
        com = row.get("COM", "").strip()
        # COM pour dept 60 commence par "60"
        insee = normalize_insee(com)
        if not insee.startswith(DEPT_CODE):
            continue
        gent = row.get("GENTILE", "").strip()
        if gent:
            out[insee] = gent
    log.info(f"  gentilés Oise: {len(out)}")
    return out


def fetch_mairies_annuaire(log) -> dict[str, dict]:
    """Récupère les mairies Oise via API OpenDataSoft (paginée)."""
    log.info(f"  GET annuaire DILA (API OpenDataSoft)")
    out = {}
    offset = 0
    page = 100
    while True:
        params = {
            "select": "codeinsee,nom,coordonneesnum_email,coordonneesnum_url,adresse_ligne,adresse_codepostal,adresse_nomcommune",
            "where": f"startswith(codeinsee, '{DEPT_CODE}') AND pivotlocal = 'Mairie'",
            "limit": page,
            "offset": offset,
            "lang": "fr",
        }
        r = requests.get(URL_ANNUAIRE_API, params=params, timeout=60)
        r.raise_for_status()
        d = r.json()
        results = d.get("results", [])
        if not results:
            break
        for rec in results:
            insee = normalize_insee(rec.get("codeinsee", ""))
            out[insee] = {
                "email_mairie": rec.get("coordonneesnum_email"),
                "site_mairie": rec.get("coordonneesnum_url"),
                "adresse_mairie": " — ".join(
                    filter(None, [rec.get("adresse_ligne"), f"{rec.get('adresse_codepostal') or ''} {rec.get('adresse_nomcommune') or ''}".strip()])
                ).strip(" —"),
            }
        offset += page
        if offset >= d.get("total_count", 0):
            break
    log.info(f"  mairies Oise: {len(out)}")
    return out


def main() -> None:
    log = setup_logger("enrich_communes")
    log.info(f"Enrichissement communes — {DEPT_NAME}")

    src = FRONTEND_DATA_DIR / "admin" / "communes_oise.geojson"
    fc = json.loads(src.read_text(encoding="utf-8"))
    log.info(f"  communes en entrée : {len(fc['features'])}")

    maires = fetch_maires_oise(log)
    gentiles = fetch_gentiles_oise(log)
    mairies = fetch_mairies_annuaire(log)

    matched_m, matched_g, matched_a = 0, 0, 0
    for f in fc["features"]:
        insee = normalize_insee(f["properties"].get("code_insee", ""))
        if insee in maires:
            f["properties"].update(maires[insee])
            matched_m += 1
        if insee in gentiles:
            f["properties"]["gentile"] = gentiles[insee]
            matched_g += 1
        if insee in mairies:
            f["properties"].update({k: v for k, v in mairies[insee].items() if v})
            matched_a += 1

    log.info(f"  enrichis : maires {matched_m}, gentilés {matched_g}, annuaire {matched_a}")

    out_proc = PROCESSED_DIR / "admin" / "communes_oise.geojson"
    out_front = FRONTEND_DATA_DIR / "admin" / "communes_oise.geojson"
    n = write_geojson(fc["features"], out_proc)
    write_geojson(fc["features"], out_front)
    log.info(f"OK — {n} communes ({file_size_human(out_proc)})")


if __name__ == "__main__":
    main()
