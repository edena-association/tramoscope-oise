# Tramoscope — Oise

Carte interactive multi-trames pour le département de l'Oise (60). Outil EDENA d'analyse paysagère par les trames écologiques (verte, bleue, turquoise, brune, noire, rose).

> Voir `CLAUDE.md` pour le document fondateur complet (contexte, architecture, sources, UX, plan).

## Quickstart

```bash
# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173

# Backend (optionnel pour le mode Exploration)
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000

# Données (à exécuter une fois pour reproduire le dataset Oise)
cd data/scripts
python download_admin_express.py
# puis les autres scripts download_*.py
python prepare_data.py
```

## Structure

```
frontend/    React + Vite + Leaflet + Tailwind
backend/     FastAPI + GeoPandas (analyses spatiales)
data/        Scripts de téléchargement + données (raw/processed gitignored)
docs/        Documentation détaillée
```

## Déploiement

- **Frontend** : Vercel (auto-deploy sur push `main`)
- **Backend** : Railway ou Render
- **Production** : `tramoscope.edena.eco` (CNAME → Vercel)

## Licence et données

Toutes les données sont sous licence ouverte (Etalab 2.0, CC-BY, etc.). Voir `data/config/sources.json` pour le catalogue complet avec attributions.

EDENA — Tiers de confiance territorial.
