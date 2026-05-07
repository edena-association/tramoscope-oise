import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { BASEMAPS, TRAME_LAYERS, TRANSVERSAL_LAYERS } from '../../config/layers.js';
import Legend from './Legend.jsx';

// Centre approximatif et emprise du département de l'Oise
const OISE_CENTER = [49.42, 2.42];
const OISE_BOUNDS = [
  [49.05, 1.65],
  [49.78, 3.15]
];

export default function MapContainer({ basemap, activeLayers }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const basemapLayerRef = useRef(null);
  const overlayLayersRef = useRef(new Map());
  const [legendItems, setLegendItems] = useState([]);

  // Initialisation Leaflet
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: OISE_CENTER,
      zoom: 9,
      minZoom: 7,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true
    });
    map.fitBounds(OISE_BOUNDS, { padding: [20, 20] });
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Gestion fond de carte (peut être un seul tileLayer ou un layerGroup multi-tuiles)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (basemapLayerRef.current) {
      map.removeLayer(basemapLayerRef.current);
    }
    const cfg = BASEMAPS[basemap];
    if (!cfg) return;

    // Mode multi-couches (ex: topographique = plan + relief + courbes)
    if (Array.isArray(cfg.layers)) {
      const tiles = cfg.layers.map((sub) =>
        L.tileLayer(sub.url, {
          maxZoom: cfg.maxZoom || 19,
          tileSize: 256,
          opacity: sub.opacity ?? 1,
          className: sub.grayscale ? 'basemap-grayscale' : undefined
        })
      );
      const group = L.layerGroup(tiles, { attribution: cfg.attribution });
      group.addTo(map);
      basemapLayerRef.current = group;
      return;
    }

    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom || 19,
      subdomains: cfg.subdomains || 'abc',
      tileSize: 256,
      className: cfg.grayscale ? 'basemap-grayscale' : undefined
    });
    layer.addTo(map);
    basemapLayerRef.current = layer;
  }, [basemap]);

  // Gestion des overlays (couches transversales + trames)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const allLayers = [
      ...Object.values(TRANSVERSAL_LAYERS),
      ...Object.values(TRAME_LAYERS).flat()
    ];

    const newLegend = [];

    for (const cfg of allLayers) {
      const isActive = activeLayers.has(cfg.id);
      const existing = overlayLayersRef.current.get(cfg.id);

      if (isActive && !existing) {
        const layer = createLayer(cfg);
        if (layer) {
          layer.addTo(map);
          overlayLayersRef.current.set(cfg.id, layer);
        }
      } else if (!isActive && existing) {
        map.removeLayer(existing);
        overlayLayersRef.current.delete(cfg.id);
      }

      if (isActive) {
        newLegend.push(cfg);
      }
    }

    setLegendItems(newLegend);
  }, [activeLayers]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <Legend items={legendItems} />
    </>
  );
}

function buildTooltip(props, cfg) {
  if (cfg.tooltipFormatter) {
    try {
      return cfg.tooltipFormatter(props || {});
    } catch (e) {
      console.warn(`[layer ${cfg.id}] tooltip formatter error: ${e.message}`);
    }
  }
  // Sinon, parcourt tooltipFields dans l'ordre, puis fallbacks génériques
  const fields = cfg.tooltipFields || [];
  for (const fname of fields) {
    const v = props?.[fname];
    if (v != null && v !== '') return String(v);
  }
  // Fallbacks larges
  return (
    props?.nom_officiel ||
    props?.nom ||
    props?.NOM ||
    props?.libelle ||
    props?.code_insee ||
    cfg.label
  );
}

function createLayer(cfg) {
  if (cfg.type === 'wms') {
    return L.tileLayer.wms(cfg.url, {
      layers: cfg.layer,
      format: cfg.format || 'image/png',
      transparent: cfg.transparent ?? true,
      version: '1.3.0',
      attribution: cfg.attribution || ''
    });
  }
  if (cfg.type === 'geojson') {
    const interactive = cfg.interactive !== false;
    const options = {
      // style peut être un objet ou une fonction (pour choroplèthes)
      style: typeof cfg.style === 'function' ? cfg.style : () => cfg.style || {},
      // points → cercles colorés
      pointToLayer: cfg.pointToLayer
        ? (feature, latlng) => L.circleMarker(latlng, cfg.style || { radius: 5, color: '#0B2966' })
        : undefined,
      onEachFeature: interactive
        ? (feature, lyr) => {
            const tip = buildTooltip(feature.properties, cfg);
            if (tip) lyr.bindTooltip(tip, { sticky: true, direction: 'top' });
          }
        : undefined
    };
    const layer = L.geoJSON(null, options);
    fetch(cfg.url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((data) => layer.addData(data))
      .catch((err) => {
        console.warn(`[layer ${cfg.id}] échec chargement ${cfg.url}: ${err.message}`);
      });
    return layer;
  }
  return null;
}
