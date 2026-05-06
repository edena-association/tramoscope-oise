"""Configuration backend — chemins, seuils, CORS.

Les seuils d'analyse DOIVENT rester synchronisés avec
frontend/src/config/analysis.js (voir CLAUDE.md §7).
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    backend_data_dir: Path = Path("./data/processed")
    backend_reports_dir: Path = Path("./data/reports")

    cors_origins: list[str] = [
        "http://localhost:5173",
        "https://tramoscope-oise.vercel.app",
        "https://tramoscope.edena.eco",
    ]


settings = Settings()


# Seuils d'analyse — miroir de frontend/src/config/analysis.js
ANALYSIS_THRESHOLDS = {
    "corridor_rupture": {
        "max_distance_reservoirs": 5000,
        "raster_resolution": 25,
        "severity_thresholds": {
            "light": 500,
            "moderate": 2000,
        },
        "friction_costs": {
            "natural": 1,
            "extensive_agriculture": 5,
            "intensive_agriculture": 20,
            "permeable_urban": 50,
            "linear_infrastructure": 200,
            "impermeable_urban": 1000,
        },
    },
    "stepping_stones": {
        "min_area_ha": 0.1,
        "max_area_ha": 5,
        "max_distance_to_corridor": 500,
        "max_distance_between_fragments": 500,
        "isolation_threshold": 1000,
    },
    "connectivity": {
        "dispersal_distance": 1000,
        "min_patch_size_ha": 1,
        "grid_cell_size": 1000,
    },
    "riparian_rupture": {
        "buffer_width": 10,
        "present_threshold": 0.7,
        "degraded_threshold": 0.3,
    },
    "pollination_desert": {
        "foraging_radius": 300,
        "min_desert_area_ha": 50,
        "severity_moderate_ha": 200,
        "severity_severe_ha": 500,
    },
    "light_pollution": {
        "significant_threshold": 5,
        "preserved_max": 2,
        "transition_max": 5,
        "polluted_max": 20,
    },
}
