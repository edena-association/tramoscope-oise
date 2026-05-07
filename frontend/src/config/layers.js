/**
 * Définition de toutes les couches cartographiques.
 *
 * Type:
 *  - 'wmts'    : tuile raster (fond de carte IGN)
 *  - 'wms'     : flux WMS (INPN, GPU, Georisques, IGN, Géoservices DREAL/MGP)
 *  - 'geojson' : GeoJSON statique servi depuis /public/data/{trame}/
 *  - 'derived' : couche d'analyse calculée par le backend (Phase 3)
 *
 * Pour chaque couche geojson : `tooltipFields` est un ordre de propriétés à
 * essayer pour le label, `tooltipFormatter` (optionnel) personnalise la chaîne.
 */

import { TRAMES } from './trames.js';

const IGN_WMTS = import.meta.env.VITE_IGN_WMTS_URL || 'https://data.geopf.fr/wmts';
const IGN_WMS_R = import.meta.env.VITE_IGN_WMS_URL || 'https://data.geopf.fr/wms-r/wms';
const INPN_WMS = import.meta.env.VITE_INPN_WMS_URL || 'https://ws.carmencarto.fr/WMS/119/fxx_inpn';
const GPU_WMS = import.meta.env.VITE_GPU_WMS_URL || 'https://data.geopf.fr/wms-v/ows';

const wmtsUrl = (layer, format = 'image/png') =>
  `${IGN_WMTS}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=${encodeURIComponent(format)}`;

export const BASEMAPS = {
  ign_plan: {
    id: 'ign_plan',
    label: 'Plan IGN (gris)',
    url: wmtsUrl('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2'),
    attribution: '© IGN-F / Geoplateforme',
    maxZoom: 19,
    grayscale: true
  },
  ign_topo: {
    id: 'ign_topo',
    label: 'Topographique (relief + courbes)',
    // Empilé : plan IGN, ombrage relief, courbes de niveau
    layers: [
      { url: wmtsUrl('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2'), grayscale: true, opacity: 0.85 },
      { url: wmtsUrl('ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW', 'image/png'), opacity: 0.45 },
      { url: wmtsUrl('ELEVATION.CONTOUR.LINE', 'image/png'), opacity: 0.7 }
    ],
    attribution: '© IGN-F / Geoplateforme',
    maxZoom: 17
  },
  ign_ortho: {
    id: 'ign_ortho',
    label: 'Orthophotos',
    url: wmtsUrl('ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg'),
    attribution: '© IGN-F / Geoplateforme',
    maxZoom: 19
  },
  neutre: {
    id: 'neutre',
    label: 'Fond neutre',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap, © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  },
  nocturne: {
    id: 'nocturne',
    label: 'Carte nocturne',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap, © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
    dark: true
  },
  blanc: {
    id: 'blanc',
    label: 'Fond blanc',
    // Pas d'URL : le conteneur Leaflet a un fond blanc forcé via .basemap-blank
    blank: true,
    attribution: ''
  }
};

/**
 * Fonction d'interpolation continue pour la radiance nocturne.
 * Échelle log-like : noir profond (pas de pollution) → jaune-orangé (très pollué).
 * Voir CLAUDE.md §5.6 - les seuils 2/5/20 nW/cm²/sr restent les références
 * scientifiques pour la classification, mais l'affichage utilise un dégradé
 * continu pour rendre les transitions douces.
 */
const RADIANCE_STOPS = [
  { r: 0,    rgb: [10, 10, 10] },     // ciel préservé (anthracite quasi-noir)
  { r: 0.5,  rgb: [22, 19, 18] },
  { r: 1,    rgb: [38, 30, 24] },
  { r: 2,    rgb: [70, 47, 26] },
  { r: 5,    rgb: [128, 80, 28] },
  { r: 10,   rgb: [185, 113, 32] },
  { r: 20,   rgb: [225, 145, 42] },
  { r: 50,   rgb: [245, 195, 75] },
  { r: 100,  rgb: [252, 230, 130] }
];

export function radianceColor(r) {
  if (r == null || isNaN(r)) return '#3a3535'; // pas de donnée : gris brun
  if (r <= 0) return `rgb(${RADIANCE_STOPS[0].rgb.join(',')})`;
  for (let i = 1; i < RADIANCE_STOPS.length; i++) {
    if (r <= RADIANCE_STOPS[i].r) {
      const a = RADIANCE_STOPS[i - 1];
      const b = RADIANCE_STOPS[i];
      const t = (r - a.r) / (b.r - a.r);
      const out = a.rgb.map((v, j) => Math.round(v + t * (b.rgb[j] - v)));
      return `rgb(${out.join(',')})`;
    }
  }
  return `rgb(${RADIANCE_STOPS[RADIANCE_STOPS.length - 1].rgb.join(',')})`;
}

// Couleurs des trames (depuis trames.js)
const C = Object.fromEntries(
  Object.entries(TRAMES).map(([k, v]) => [k, v.color])
);

// Helpers de style
const polyStyle = (color, fillOpacity = 0.3, strokeOpacity = 0.85) => ({
  color,
  weight: 1.2,
  fillColor: color,
  fillOpacity,
  opacity: strokeOpacity
});
const lineStyle = (color, weight = 2) => ({
  color,
  weight,
  opacity: 0.85,
  fill: false
});
const pointStyle = (color) => ({
  radius: 5,
  color,
  weight: 1.5,
  fillColor: color,
  fillOpacity: 0.8
});

export const TRANSVERSAL_LAYERS = {
  communes: {
    id: 'communes',
    label: 'Communes',
    type: 'geojson',
    url: '/data/admin/communes_oise.geojson',
    style: { color: '#0B2966', weight: 1, fillOpacity: 0, opacity: 0.6 },
    tooltipFields: ['nom_officiel', 'nom']
  },
  epci: {
    id: 'epci',
    label: 'EPCI',
    type: 'geojson',
    url: '/data/admin/epci_oise.geojson',
    style: { color: '#0B2966', weight: 2, fillOpacity: 0, opacity: 0.85, dashArray: '4,3' },
    tooltipFields: ['nom_officiel', 'nom'],
    defaultActive: false
  },
  departement: {
    id: 'departement',
    label: 'Limite départementale',
    type: 'geojson',
    url: '/data/admin/departement_oise.geojson',
    style: { color: '#0B2966', weight: 2.5, fillOpacity: 0, opacity: 1 },
    interactive: false,
    defaultActive: true
  },
  routes: {
    id: 'routes',
    label: 'Routes (IGN)',
    type: 'wms',
    url: IGN_WMS_R,
    layer: 'TRANSPORTNETWORKS.ROADS',
    format: 'image/png',
    transparent: true,
    attribution: '© IGN-F / Geoplateforme',
    defaultActive: false
  }
};

/**
 * Couches par trame. Chaque trame contient un mix:
 *  - GeoJSON statiques (locaux, /public/data/{trame}/)
 *  - WMS flux (IGN, INPN, etc.)
 */
export const TRAME_LAYERS = {
  // -------------------- TRAME VERTE --------------------
  verte: [
    {
      id: 'verte_reservoirs',
      label: 'Réservoirs de biodiversité (SRADDET)',
      type: 'geojson',
      url: '/data/verte/reservoirs_biodiversite.geojson',
      style: polyStyle(C.verte, 0.35),
      tooltipFields: ['Nom', 'NOM', 'nom', 'TypeReserv', 'TYPE'],
      defaultActive: true
    },
    {
      id: 'verte_corridors',
      label: 'Corridors trame verte (SRADDET)',
      type: 'geojson',
      url: '/data/verte/corridors_trame_verte.geojson',
      style: polyStyle(C.verte, 0.2),
      tooltipFields: ['Nom', 'NOM', 'TypeCorri', 'TYPE'],
      defaultActive: true
    },
    {
      id: 'verte_continuites_nat',
      label: 'Continuités d’importance nationale (ONTVB)',
      type: 'geojson',
      url: '/data/verte/continuites_nationales.geojson',
      style: { color: C.verte, weight: 2, dashArray: '6,3', opacity: 0.9 },
      tooltipFields: ['Nom', 'NOM']
    },
    {
      id: 'verte_reservoirs_lin',
      label: 'Réservoirs linéaires (haies, alignements)',
      type: 'geojson',
      url: '/data/verte/reservoirs_lineaires.geojson',
      style: lineStyle(C.verte, 1.5),
      tooltipFields: ['Nom', 'TYPE']
    },
    {
      id: 'verte_obstacles_surf',
      label: 'Urbanisation (obstacles aux corridors)',
      type: 'geojson',
      url: '/data/verte/obstacles_corridors_surface.geojson',
      style: polyStyle('#9E9E9E', 0.25, 0.7),
      tooltipFields: ['Nom', 'TYPE']
    },
    {
      id: 'verte_obstacles_lin',
      label: 'Infrastructures (obstacles linéaires)',
      type: 'geojson',
      url: '/data/verte/obstacles_corridors_lineaires.geojson',
      style: { color: '#616161', weight: 1, opacity: 0.7 },
      tooltipFields: ['Nom', 'TYPE']
    },
    {
      id: 'verte_foret',
      label: 'Forêts (>2 ha, IGN 2021-2023)',
      type: 'geojson',
      url: '/data/verte/foret.geojson',
      style: polyStyle('#1B5E20', 0.55, 0.6),
      tooltipFields: ['nature', 'surface_ha'],
      tooltipFormatter: (p) =>
        `${p.nature || 'Forêt'} — ${p.surface_ha ? p.surface_ha.toFixed(1) + ' ha' : ''}`
    },
    {
      id: 'znieff1',
      label: 'ZNIEFF type I',
      type: 'wms',
      url: INPN_WMS,
      layer: 'Znieff1',
      format: 'image/png',
      transparent: true,
      attribution: '© INPN/MNHN'
    },
    {
      id: 'znieff2',
      label: 'ZNIEFF type II',
      type: 'wms',
      url: INPN_WMS,
      layer: 'Znieff2',
      format: 'image/png',
      transparent: true,
      attribution: '© INPN/MNHN'
    },
    {
      id: 'natura_zsc',
      label: 'Natura 2000 — ZSC (habitats)',
      type: 'wms',
      url: INPN_WMS,
      layer: 'Sites_d_importance_communautaire',
      format: 'image/png',
      transparent: true,
      attribution: '© INPN/MNHN'
    },
    {
      id: 'natura_zps',
      label: 'Natura 2000 — ZPS (oiseaux)',
      type: 'wms',
      url: INPN_WMS,
      layer: 'Zones_de_protection_speciale',
      format: 'image/png',
      transparent: true,
      attribution: '© INPN/MNHN'
    },
    {
      id: 'ocsge_couverture',
      label: 'OCS GE — couverture du sol (2021-2023)',
      type: 'wms',
      url: IGN_WMS_R,
      layer: 'OCSGE.COUVERTURE.2021-2023',
      format: 'image/png',
      transparent: true,
      attribution: '© IGN-F / Geoplateforme'
    }
  ],

  // -------------------- TRAME BLEUE --------------------
  bleue: [
    {
      id: 'bleue_cours_eau',
      label: 'Cours d’eau (BD TOPAGE)',
      type: 'geojson',
      url: '/data/bleue/cours_eau.geojson',
      style: lineStyle(C.bleue, 1.6),
      tooltipFields: ['TopoOH', 'CdOH'],
      defaultActive: true
    },
    {
      id: 'bleue_corridors',
      label: 'Corridors trame bleue (SRADDET)',
      type: 'geojson',
      url: '/data/bleue/corridors_trame_bleue.geojson',
      style: lineStyle('#0D47A1', 2.5),
      tooltipFields: ['Nom', 'TypeCorri']
    },
    {
      id: 'bleue_obstacles_roe',
      label: 'Obstacles écoulement (ROE)',
      type: 'geojson',
      url: '/data/bleue/obstacles.geojson',
      style: pointStyle('#D32F2F'),
      pointToLayer: true,
      tooltipFields: ['NomPrincipalObstEcoul', 'LbTypeOuvrage'],
      tooltipFormatter: (p) =>
        `${p.NomPrincipalObstEcoul || 'Obstacle'} — ${p.LbTypeOuvrage || ''} (${p.LbEtOuvrage || 'État inconnu'})`
    },
    {
      id: 'bleue_obstacles_majeurs',
      label: 'Obstacles majeurs (SRADDET)',
      type: 'geojson',
      url: '/data/bleue/obstacles_majeurs.geojson',
      style: pointStyle('#B71C1C'),
      pointToLayer: true,
      tooltipFields: ['Nom', 'NomPrinc']
    },
    {
      id: 'bleue_zones_humides',
      label: 'Zones humides (prélocalisation 2016)',
      type: 'geojson',
      url: '/data/bleue/zones_humides.geojson',
      style: polyStyle('#0277BD', 0.3, 0.7),
      tooltipFields: ['surface_ha'],
      tooltipFormatter: (p) => `Zone humide — ${p.surface_ha ? p.surface_ha.toFixed(1) + ' ha' : ''}`
    },
    {
      id: 'ppri',
      label: 'PPRI — zonage inondation',
      type: 'wms',
      url: 'https://georisques.gouv.fr/services',
      // PPRN_INOND : visible à tous les zooms (périmètre + zonage rgmtaire combiné)
      // PPRN_ZONE_INOND ne rend qu'à zoom élevé, donc on prend le layer global.
      layer: 'PPRN_INOND',
      format: 'image/png',
      transparent: true,
      attribution: '© Géorisques / MTECT'
    }
  ],

  // -------------------- TRAME TURQUOISE --------------------
  turquoise: [
    {
      id: 'turq_zones_humides',
      label: 'Zones humides (interfaces)',
      type: 'geojson',
      url: '/data/bleue/zones_humides.geojson',
      style: polyStyle(C.turquoise, 0.35),
      tooltipFields: ['surface_ha'],
      tooltipFormatter: (p) => `Zone humide — ${p.surface_ha ? p.surface_ha.toFixed(1) + ' ha' : ''}`
    },
    {
      id: 'turq_cours_eau',
      label: 'Cours d’eau (BD TOPAGE)',
      type: 'geojson',
      url: '/data/bleue/cours_eau.geojson',
      style: lineStyle(C.turquoise, 1.4),
      tooltipFields: ['TopoOH']
    }
    // Ripisylves (dérivé) → Phase 3
  ],

  // -------------------- TRAME BRUNE --------------------
  brune: [
    {
      id: 'brune_artificialisation',
      label: 'Artificialisation cumulée 2009-2024 (commune)',
      type: 'geojson',
      url: '/data/brune/artificialisation_communes.geojson',
      style: (feature) => {
        const pct = feature?.properties?.pct_artif_commune_0924 || 0;
        // Choroplèthe simple - de blanc à brun selon % artif
        const opacity = Math.min(0.85, 0.1 + pct / 5);
        return { color: '#5D4037', weight: 0.5, fillColor: C.brune, fillOpacity: opacity, opacity: 0.6 };
      },
      tooltipFields: ['nom_commune', 'pct_artif_commune_0924'],
      tooltipFormatter: (p) =>
        `${p.nom_commune || ''} — ${p.pct_artif_commune_0924?.toFixed(2) || '?'} % artificialisé (2009-2024)`
    },
    {
      id: 'ocsge_artif',
      label: 'OCS GE — artificialisation 2021-2023',
      type: 'wms',
      url: IGN_WMS_R,
      layer: 'OCSGE.ARTIF.2021-2023',
      format: 'image/png',
      transparent: true,
      attribution: '© IGN-F / Geoplateforme'
    },
    {
      id: 'inra_sols',
      label: 'Carte des sols (INRA, 1/1M)',
      type: 'wms',
      url: IGN_WMS_R,
      layer: 'INRA.CARTE.SOLS',
      format: 'image/png',
      transparent: true,
      attribution: '© INRAE / GIS Sol'
    }
  ],

  // -------------------- TRAME NOIRE --------------------
  noire: [
    {
      id: 'noire_satellite_2024',
      label: 'Pollution lumineuse vue du ciel (atlas 2024)',
      type: 'tilelayer',
      // Tiles haute-résolution David Lorenz, atlas 2024 (recalcule du World Atlas
      // d'après VIIRS-DNB) - palette : noir < bleu < vert < jaune < orange < rouge < blanc
      url: 'https://djlorenz.github.io/astronomy/image_tiles/tiles2024/tile_{z}_{x}_{y}.png',
      attribution: '© David J. Lorenz - Light Pollution Atlas 2024 (data VIIRS-DNB)',
      maxNativeZoom: 8,
      tileSize: 1024,
      zoomOffset: -2,
      opacity: 0.75
    },
    {
      id: 'noire_eclairage',
      label: 'Radiance nocturne 2024 (par commune)',
      type: 'geojson',
      url: '/data/noire/eclairage_communes.geojson',
      style: (feature) => {
        const r = feature?.properties?.radiance_moy_2024;
        return {
          color: '#0a0a0a',
          weight: 0.3,
          fillColor: radianceColor(r),
          fillOpacity: 0.85,
          opacity: 0.5
        };
      },
      tooltipFields: ['nom', 'radiance_moy_2024', 'delta_2014_2024'],
      tooltipFormatter: (p) => {
        const r = p.radiance_moy_2024;
        const d = p.delta_2014_2024;
        const evol = d != null ? (d < 0 ? `↓ ${d.toFixed(2)}` : `↑ +${d.toFixed(2)}`) : '?';
        return `${p.nom || ''} — radiance ${r != null ? r.toFixed(2) : '?'} nW (${evol} vs 2014)`;
      }
    },
    {
      id: 'noire_voies_eclairees',
      label: 'Voies éclairées (OSM, lit=yes)',
      type: 'geojson',
      url: '/data/noire/voies_eclairees.geojson',
      style: { color: '#FFC107', weight: 1.4, opacity: 0.85, fill: false },
      tooltipFields: ['name', 'highway']
    },
    {
      id: 'noire_lampadaires',
      label: 'Lampadaires (OpenStreetMap)',
      type: 'geojson',
      url: '/data/noire/lampadaires_osm.geojson',
      style: { radius: 2, color: '#FFE082', weight: 0, fillColor: '#FFE082', fillOpacity: 0.9 },
      pointToLayer: true,
      tooltipFields: ['lamp_type', 'operator'],
      tooltipFormatter: (p) =>
        p.lamp_type
          ? `Lampadaire — ${p.lamp_type}`
          : `Lampadaire${p.operator ? ' (' + p.operator + ')' : ''}`
    }
  ],

  // -------------------- TRAME ROSE --------------------
  rose: [
    {
      id: 'rpg_2024',
      label: 'Parcelles agricoles 2024 (RPG)',
      type: 'wms',
      url: IGN_WMS_R,
      layer: 'IGNF_RPG_PARCELLES-AGRICOLES-CATEGORISEES_2024',
      format: 'image/png',
      transparent: true,
      attribution: '© IGN-F / ASP - RPG 2024'
    },
    {
      id: 'rpg_prairies',
      label: 'Prairies permanentes 2024',
      type: 'wms',
      url: IGN_WMS_R,
      layer: 'IGNF_RPG_PRAIRIES-PERMANENTES_2024',
      format: 'image/png',
      transparent: true,
      attribution: '© IGN-F / ASP'
    },
    {
      id: 'ocsge_usage',
      label: 'OCS GE — usage du sol (2021-2023)',
      type: 'wms',
      url: IGN_WMS_R,
      layer: 'OCSGE.USAGE.2021-2023',
      format: 'image/png',
      transparent: true,
      attribution: '© IGN-F / Geoplateforme'
    },
    {
      id: 'rose_foret_lisieres',
      label: 'Forêts (lisières favorables aux pollinisateurs)',
      type: 'geojson',
      url: '/data/verte/foret.geojson',
      style: polyStyle(C.rose, 0.15, 0.6),
      tooltipFields: ['nature', 'surface_ha'],
      tooltipFormatter: (p) =>
        `${p.nature || 'Forêt'} — ${p.surface_ha ? p.surface_ha.toFixed(1) + ' ha' : ''}`
    }
  ]
};
