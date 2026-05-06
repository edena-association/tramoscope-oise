/**
 * Définition de toutes les couches cartographiques.
 *
 * Type:
 *  - 'wmts'    : tuile raster (fond de carte IGN)
 *  - 'wms'     : flux WMS (INPN, GPU, Georisques, IGN)
 *  - 'geojson' : GeoJSON statique servi depuis /public/data/
 *  - 'derived' : couche d'analyse calculée par le backend
 */

const IGN_WMTS = import.meta.env.VITE_IGN_WMTS_URL || 'https://data.geopf.fr/wmts';
const INPN_WMS = import.meta.env.VITE_INPN_WMS_URL || 'https://ws.carmencarto.fr/WMS/119/fxx_inpn';
const GPU_WMS = import.meta.env.VITE_GPU_WMS_URL || 'https://data.geopf.fr/wms-v/ows';

const wmtsUrl = (layer, format = 'image/png') =>
  `${IGN_WMTS}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=${encodeURIComponent(format)}`;

export const BASEMAPS = {
  ign_plan: {
    id: 'ign_plan',
    label: 'Plan IGN',
    url: wmtsUrl('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2'),
    attribution: '© IGN-F / Geoplateforme',
    maxZoom: 19
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
  }
};

export const TRANSVERSAL_LAYERS = {
  communes: {
    id: 'communes',
    label: 'Communes',
    type: 'geojson',
    url: '/data/admin/communes_oise.geojson',
    style: { color: '#0B2966', weight: 1, fillOpacity: 0, opacity: 0.6 },
    interactive: true
  },
  epci: {
    id: 'epci',
    label: 'EPCI',
    type: 'geojson',
    url: '/data/admin/epci_oise.geojson',
    style: { color: '#0B2966', weight: 2, fillOpacity: 0, opacity: 0.85, dashArray: '4,3' },
    interactive: true,
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
  }
};

/**
 * Couches par trame.
 * Chaque entrée est ajoutée progressivement au fil du développement de la base de données.
 * Voir CLAUDE.md §3 et §4.1.
 */
export const TRAME_LAYERS = {
  verte: [
    { id: 'znieff1', label: 'ZNIEFF type I', type: 'wms', url: INPN_WMS, layer: 'ZNIEFF1', format: 'image/png', transparent: true },
    { id: 'znieff2', label: 'ZNIEFF type II', type: 'wms', url: INPN_WMS, layer: 'ZNIEFF2', format: 'image/png', transparent: true },
    { id: 'natura_zsc', label: 'Natura 2000 — ZSC', type: 'wms', url: INPN_WMS, layer: 'SIC', format: 'image/png', transparent: true },
    { id: 'natura_zps', label: 'Natura 2000 — ZPS', type: 'wms', url: INPN_WMS, layer: 'ZPS', format: 'image/png', transparent: true }
  ],
  bleue: [],
  turquoise: [],
  brune: [],
  noire: [],
  rose: []
};
