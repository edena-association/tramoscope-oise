/**
 * Seuils d'analyse — DOIVENT rester synchronisés avec backend/app/config.py.
 * Voir CLAUDE.md §5 et §7 pour la justification scientifique.
 */
export const ANALYSIS_THRESHOLDS = {
  corridorRupture: {
    maxDistanceReservoirs: 5000,
    rasterResolution: 25,
    severityThresholds: {
      light: 500,
      moderate: 2000,
      critical: Infinity
    },
    frictionCosts: {
      natural: 1,
      extensiveAgriculture: 5,
      intensiveAgriculture: 20,
      permeableUrban: 50,
      linearInfrastructure: 200,
      impermeableUrban: 1000
    }
  },
  steppingStones: {
    minArea: 0.1,
    maxArea: 5,
    maxDistanceToCorridor: 500,
    maxDistanceBetweenFragments: 500,
    isolationThreshold: 1000
  },
  connectivity: {
    dispersalDistance: 1000,
    minPatchSize: 1,
    gridCellSize: 1000
  },
  riparianRupture: {
    bufferWidth: 10,
    presentThreshold: 0.7,
    degradedThreshold: 0.3
  },
  pollinationDesert: {
    foragingRadius: 300,
    minDesertArea: 50,
    severityModerate: 200,
    severitySevere: 500
  },
  lightPollution: {
    significantThreshold: 5,
    preservedMax: 2,
    transitionMax: 5,
    pollutedMax: 20
  }
};
