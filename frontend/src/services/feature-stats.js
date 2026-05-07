/**
 * Calcul de stats par couche × polygone (commune ou EPCI).
 *
 * Pour chaque couche GeoJSON active, on calcule :
 *   - Polygones : surface (ha) intersectée
 *   - Lignes    : longueur (km) intersectée (via lineSplit + midpoint inside)
 *   - Points    : nombre dans le polygone
 *
 * Les WMS et les couches transversales sont ignorées.
 *
 * Les calculs sont approximatifs (precision suffisante à l'échelle dept).
 */

import * as turf from '@turf/turf';
import { loadGeoJson } from './data-cache.js';

function inferGeomKind(feature, layerCfg) {
  if (layerCfg?.pointToLayer) return 'point';
  const t = feature?.geometry?.type || '';
  if (t.includes('Line')) return 'line';
  if (t.includes('Point')) return 'point';
  return 'polygon';
}

function coerceToFeature(geom) {
  // Accepte une feature ou un objet géométrique brut
  if (!geom) return null;
  if (geom.type === 'Feature') return geom;
  return { type: 'Feature', properties: {}, geometry: geom };
}

/**
 * Calcule une stat pour une couche donnée.
 * @param {Feature<Polygon|MultiPolygon>} polyFeature - polygone de référence (commune/EPCI)
 * @param {object} layerCfg - configuration de la couche (depuis layers.js)
 * @returns {Promise<{kind: 'count'|'length'|'area', value: number, unit: string, count: number} | null>}
 */
export async function computeLayerStats(polyFeature, layerCfg) {
  if (!layerCfg || layerCfg.type !== 'geojson') return null;
  let data;
  try {
    data = await loadGeoJson(layerCfg.url);
  } catch (err) {
    console.warn(`[stats] échec chargement ${layerCfg.url}: ${err.message}`);
    return null;
  }
  if (!data?.features?.length) return null;

  const ref = coerceToFeature(polyFeature);
  const refBbox = turf.bbox(ref);
  const kind = inferGeomKind(data.features[0], layerCfg);

  if (kind === 'point') {
    let count = 0;
    for (const f of data.features) {
      if (!f?.geometry) continue;
      try {
        // Filtre bbox rapide
        const [x, y] = f.geometry.coordinates || [];
        if (x < refBbox[0] || x > refBbox[2] || y < refBbox[1] || y > refBbox[3]) continue;
        if (turf.booleanPointInPolygon(f, ref)) count++;
      } catch {}
    }
    return { kind: 'count', value: count, unit: '', count };
  }

  if (kind === 'line') {
    let totalKm = 0;
    let count = 0;
    for (const f of data.features) {
      if (!f?.geometry) continue;
      try {
        const fbbox = turf.bbox(f);
        if (fbbox[2] < refBbox[0] || fbbox[0] > refBbox[2] || fbbox[3] < refBbox[1] || fbbox[1] > refBbox[3]) continue;
        // Test rapide d'intersection
        if (!turf.booleanIntersects(f, ref)) continue;
        // Découpe la ligne par le polygone, garde les morceaux dont le milieu est dedans
        const split = turf.lineSplit(f, turf.polygonToLine(ref));
        const segments = split?.features?.length ? split.features : [f];
        for (const seg of segments) {
          try {
            const len = turf.length(seg, { units: 'kilometers' });
            const coords = seg.geometry.coordinates;
            const mid = coords[Math.floor(coords.length / 2)];
            const midPt = turf.point(mid);
            if (turf.booleanPointInPolygon(midPt, ref)) {
              totalKm += len;
            }
          } catch {}
        }
        count++;
      } catch {}
    }
    return {
      kind: 'length',
      value: Math.round(totalKm * 100) / 100,
      unit: 'km',
      count
    };
  }

  // Polygon
  let totalHa = 0;
  let count = 0;
  for (const f of data.features) {
    if (!f?.geometry) continue;
    try {
      const fbbox = turf.bbox(f);
      if (fbbox[2] < refBbox[0] || fbbox[0] > refBbox[2] || fbbox[3] < refBbox[1] || fbbox[1] > refBbox[3]) continue;
      const inter = turf.intersect(turf.featureCollection([ref, f]));
      if (inter) {
        totalHa += turf.area(inter) / 10_000;
        count++;
      }
    } catch {
      // ignore feature invalides
    }
  }
  return {
    kind: 'area',
    value: Math.round(totalHa * 100) / 100,
    unit: 'ha',
    count
  };
}
