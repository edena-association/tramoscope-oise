"""Tramoscope Oise — API FastAPI.

Sert d'orchestrateur pour les analyses spatiales (Phase 3) et la génération de
rapports PDF (Phase 4). En Phase 1, expose seulement /health pour vérifier que
le déploiement Railway/Render fonctionne.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings

app = FastAPI(
    title="Tramoscope Oise API",
    description="API d'analyses spatiales pour le Tramoscope Oise (EDENA).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": "0.1.0", "phase": 1}


@app.get("/")
def root() -> dict:
    return {
        "name": "Tramoscope Oise API",
        "docs": "/docs",
        "health": "/health",
    }
