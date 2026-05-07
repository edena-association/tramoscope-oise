/**
 * Génération du rapport PDF de zone (Mode Rapport - Phase 4).
 *
 * Périmètre MVP : une commune sélectionnée. Polygone libre = V2 (backend).
 *
 * Approche client-side avec jsPDF + jspdf-autotable :
 *  - Pas de backend Python/WeasyPrint nécessaire (déploiement immédiat Vercel).
 *  - Image carto = WMTS GetTile concaténé (pas de capture Leaflet, plus robuste
 *    aux problèmes CORS).
 *  - Branding EDENA : couleurs #0B2966 / #E4E2DD, héron monochrome, mentions
 *    légales.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as turf from '@turf/turf';

import { TRAMES } from '../config/trames.js';
import { TRAME_LAYERS } from '../config/layers.js';
import { computeLayerStats } from './feature-stats.js';
import { loadGeoJson } from './data-cache.js';

// Couleurs EDENA
const EDENA_PRIMARY = '#0B2966';
const EDENA_SECONDARY = '#E4E2DD';
const TEXT_DARK = '#1a1a1a';
const TEXT_MUTED = '#666666';

const SEVERITY_COLOR = {
  critique: '#D32F2F',
  severe: '#D32F2F',
  absente: '#D32F2F',
  isole: '#D32F2F',
  modere: '#F57C00',
  degradee: '#F57C00',
  potentiel: '#F57C00',
  moderee: '#F57C00',
  presente: '#388E3C',
  actif: '#388E3C',
  legere: '#388E3C'
};

const ANALYSES_DERIVED = [
  {
    id: 'analyse_connectivite',
    title: 'Score de connectivité paysagère',
    trame: 'verte',
    field: 'score',
    kind: 'numeric',
    summary: (vals) => {
      if (!vals.length) return 'Aucun hexagone dans la commune.';
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return `${vals.length} hexagones · score moyen ${mean.toFixed(1)} / 100`;
    }
  },
  {
    id: 'analyse_ruptures_corridors',
    title: 'Ruptures de corridors écologiques',
    trame: 'verte',
    field: 'severite',
    kind: 'classes',
    classOrder: ['critique', 'moderee', 'legere']
  },
  {
    id: 'analyse_pas_japonais',
    title: 'Pas japonais potentiels',
    trame: 'verte',
    field: 'classe',
    kind: 'classes',
    classOrder: ['actif', 'potentiel', 'isole']
  },
  {
    id: 'analyse_ripisylves',
    title: 'État des ripisylves',
    trame: 'turquoise',
    field: 'etat_ripisylve',
    kind: 'classes',
    classOrder: ['presente', 'degradee', 'absente']
  },
  {
    id: 'analyse_conflits_eclairage',
    title: 'Conflits éclairage / biodiversité',
    trame: 'noire',
    field: 'severite',
    kind: 'classes',
    classOrder: ['critique', 'severe', 'modere']
  },
  {
    id: 'analyse_deserts_pollinisateurs',
    title: 'Déserts pollinisateurs',
    trame: 'rose',
    field: 'severite',
    kind: 'classes',
    classOrder: ['critique', 'severe', 'modere']
  }
];

/**
 * Récupère la BBox d'une feature commune et calcule l'URL d'une carte WMS
 * IGN (raster) couvrant cette zone, à inclure dans le PDF.
 */
function buildMapImageUrl(feature, { width = 720, height = 480, layer = 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2' } = {}) {
  const bbox = turf.bbox(feature); // [minlon, minlat, maxlon, maxlat]
  // Élargir 25% pour avoir du contexte
  const dx = (bbox[2] - bbox[0]) * 0.25;
  const dy = (bbox[3] - bbox[1]) * 0.25;
  const ext = [bbox[0] - dx, bbox[1] - dy, bbox[2] + dx, bbox[3] + dy];
  // Garder un ratio compatible avec width/height
  const ratio = width / height;
  const extW = ext[2] - ext[0];
  const extH = ext[3] - ext[1];
  if (extW / extH > ratio) {
    const newH = extW / ratio;
    const cy = (ext[1] + ext[3]) / 2;
    ext[1] = cy - newH / 2;
    ext[3] = cy + newH / 2;
  } else {
    const newW = extH * ratio;
    const cx = (ext[0] + ext[2]) / 2;
    ext[0] = cx - newW / 2;
    ext[2] = cx + newW / 2;
  }
  // WMS 1.3.0 EPSG:4326 → BBOX en order lat,lon
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: layer,
    STYLES: '',
    FORMAT: 'image/png',
    TRANSPARENT: 'false',
    CRS: 'EPSG:4326',
    BBOX: `${ext[1]},${ext[0]},${ext[3]},${ext[2]}`,
    WIDTH: String(width),
    HEIGHT: String(height)
  });
  return `https://data.geopf.fr/wms-r/wms?${params.toString()}`;
}

async function urlToDataUrl(url) {
  // fetch + convert blob → data URL (jsPDF accepte data: URI directement)
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const blob = await r.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Calcule pour chaque analyse dérivée la distribution dans la commune.
 */
async function computeDerivedStats(feature) {
  const ref = feature.type === 'Feature' ? feature : { type: 'Feature', properties: {}, geometry: feature };
  const refBbox = turf.bbox(ref);

  const out = [];
  for (const a of ANALYSES_DERIVED) {
    const cfg = TRAME_LAYERS[a.trame]?.find((l) => l.id === a.id);
    if (!cfg) continue;
    let data;
    try {
      data = await loadGeoJson(cfg.url);
    } catch {
      continue;
    }

    if (a.kind === 'numeric') {
      const vals = [];
      for (const f of data.features || []) {
        if (!f.geometry) continue;
        try {
          const fbbox = turf.bbox(f);
          if (fbbox[2] < refBbox[0] || fbbox[0] > refBbox[2] || fbbox[3] < refBbox[1] || fbbox[1] > refBbox[3]) continue;
          if (turf.booleanIntersects(f, ref)) {
            const v = f.properties?.[a.field];
            if (v != null) vals.push(v);
          }
        } catch {}
      }
      out.push({
        title: a.title,
        kind: 'numeric',
        summary: a.summary(vals),
        count: vals.length
      });
    } else {
      const counts = {};
      let total = 0;
      for (const f of data.features || []) {
        if (!f.geometry) continue;
        try {
          const fbbox = turf.bbox(f);
          if (fbbox[2] < refBbox[0] || fbbox[0] > refBbox[2] || fbbox[3] < refBbox[1] || fbbox[1] > refBbox[3]) continue;
          if (turf.booleanIntersects(f, ref)) {
            const c = f.properties?.[a.field];
            if (c != null) {
              counts[c] = (counts[c] || 0) + 1;
              total += 1;
            }
          }
        } catch {}
      }
      out.push({
        title: a.title,
        kind: 'classes',
        classOrder: a.classOrder,
        counts,
        total
      });
    }
  }
  return out;
}

/**
 * Stats par couche active (trames).
 */
async function computeTrameStats(feature, activeLayers) {
  const ref = feature.type === 'Feature' ? feature : { type: 'Feature', properties: {}, geometry: feature };
  const out = [];
  for (const [trameId, layers] of Object.entries(TRAME_LAYERS)) {
    const trameOut = { trameId, label: TRAMES[trameId].label, color: TRAMES[trameId].color, layers: [] };
    for (const layer of layers) {
      if (!activeLayers.has(layer.id) || layer.type !== 'geojson') continue;
      // Skip dérivés (ils sont dans la section Analyses)
      if (layer.id.startsWith('analyse_')) continue;
      try {
        const stats = await computeLayerStats(ref, layer);
        if (!stats) continue;
        trameOut.layers.push({ label: layer.label, stats });
      } catch {}
    }
    if (trameOut.layers.length) out.push(trameOut);
  }
  return out;
}

function formatStat(s) {
  if (!s) return '—';
  if (s.kind === 'count') return `${s.value} ${s.value > 1 ? 'éléments' : 'élément'}`;
  if (s.kind === 'length') return s.value < 0.1 ? '<0.1 km' : `${s.value} km`;
  if (s.kind === 'area') {
    if (s.value < 0.1) return '<0.1 ha';
    if (s.value > 1000) return `${(s.value / 100).toFixed(0)} km²`;
    return `${s.value} ha`;
  }
  return '—';
}

/**
 * Recommandations auto : règles déterministes basées sur les stats.
 */
function buildRecommendations(derivedStats) {
  const recs = [];
  for (const d of derivedStats) {
    if (d.kind === 'numeric' && d.count > 0) {
      // score connectivité : extraire moyenne via regex du summary
      const m = d.summary.match(/score moyen\s*([\d.]+)/);
      const mean = m ? parseFloat(m[1]) : null;
      if (mean !== null) {
        if (mean < 20) recs.push("Connectivité paysagère faible : prioriser la création de haies, alignements arborés et zones tampons pour reconstituer un maillage écologique.");
        else if (mean < 40) recs.push("Connectivité moyenne : renforcer les corridors existants par plantations linéaires (haies champêtres, alignements le long des chemins).");
      }
    }
    if (d.kind === 'classes') {
      const total = d.total || 0;
      if (!total) continue;
      if (d.title.includes('Ruptures')) {
        const crit = (d.counts.critique || 0) + (d.counts.moderee || 0);
        if (crit > 0) recs.push(`${crit} ruptures de corridors significatives identifiées : étudier un passage faune (écopont, buse, mare-relais) pour les zones à plus de 500m d'urbanisation traversée.`);
      }
      if (d.title.includes('Pas japonais')) {
        const isoles = d.counts.isole || 0;
        if (isoles > total * 0.5) recs.push(`${isoles} fragments forestiers isolés (>${Math.round(isoles/total*100)}%) : sont des candidats prioritaires à reconnecter via plantations relais.`);
      }
      if (d.title.includes('ripisylves')) {
        const absente = d.counts.absente || 0;
        if (absente > 0) recs.push(`${absente} tronçons de cours d'eau sans ripisylve : restauration des bandes arborées riveraines (rôle thermique, antiérosif, refuge).`);
      }
      if (d.title.includes('Conflits éclairage')) {
        const tot = d.counts.critique + d.counts.severe + d.counts.modere || 0;
        if (tot > 0) recs.push(`${tot} zones de conflit éclairage/biodiversité : sensibiliser la commune à la modernisation de l'éclairage public (LED 2700K max, extinction partielle).`);
      }
      if (d.title.includes('Déserts pollinisateurs')) {
        const crit = (d.counts.critique || 0) + (d.counts.severe || 0);
        if (crit > 0) recs.push(`${crit} déserts pollinisateurs ≥200 ha : implanter bandes mellifères, jachères fleuries et zones non-cultivées.`);
      }
    }
  }
  if (recs.length === 0) {
    recs.push("Aucune problématique majeure détectée par les analyses pré-calculées sur cette zone.");
  }
  return recs;
}

/**
 * Point d'entrée principal : génère + télécharge le PDF.
 */
export async function generateCommuneReport(feature, activeLayers, { onProgress } = {}) {
  const props = feature.properties || {};
  const nom = props.nom_officiel || props.nom || 'Commune';
  const insee = props.code_insee || '';

  onProgress?.('Chargement de la cartographie…');
  // 1. Image cartographique (Plan IGN)
  const mapUrl = buildMapImageUrl(feature, { width: 800, height: 520 });
  let mapImg = null;
  try {
    mapImg = await urlToDataUrl(mapUrl);
  } catch (e) {
    console.warn('Impossible de charger la carte de fond:', e);
  }

  onProgress?.('Calcul des indicateurs…');
  // 2. Stats par trame active
  const trameStats = await computeTrameStats(feature, activeLayers);
  // 3. Stats analyses dérivées
  const derivedStats = await computeDerivedStats(feature);
  // 4. Recommandations
  const recs = buildRecommendations(derivedStats);

  onProgress?.('Mise en page du rapport…');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40; // marges
  let y = 0;

  // ---------- Header bandeau bleu nuit ----------
  doc.setFillColor(EDENA_PRIMARY);
  doc.rect(0, 0, W, 90, 'F');

  // Logo héron simplifié (vector path en SVG via doc.lines n'est pas supporté
  // simplement, on dessine un héron stylisé approximatif)
  doc.setDrawColor('#FFFFFF');
  doc.setLineWidth(1.2);
  // Trait minimaliste évoquant un oiseau en vol
  doc.lines([[18, -4], [10, 4], [16, -8], [8, -2]], M, 50);

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Tramoscope', M + 90, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('— Oise · Diagnostic territorial trames écologiques', M + 90, 53);
  doc.setFontSize(8);
  doc.setTextColor('#dadada');
  doc.text('EDENA · tiers de confiance territorial', M + 90, 70);

  // Date
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFontSize(8);
  doc.setTextColor('#dadada');
  doc.text(today, W - M, 70, { align: 'right' });

  // ---------- Titre commune ----------
  y = 120;
  doc.setTextColor(TEXT_DARK);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(nom, M, y);
  y += 18;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_MUTED);
  const ident = [insee && `Code INSEE ${insee}`, props.code_postal && `Code postal ${props.code_postal}`, props.gentile && `Gentilé : ${props.gentile}`].filter(Boolean).join('  ·  ');
  if (ident) doc.text(ident, M, y);
  y += 18;

  // ---------- Image carto ----------
  if (mapImg) {
    const imgW = W - 2 * M;
    const imgH = imgW * (520 / 800);
    try {
      doc.addImage(mapImg, 'PNG', M, y, imgW, imgH);
      y += imgH + 16;
    } catch (e) {
      console.warn('addImage error', e);
    }
  }

  // ---------- Identité commune ----------
  y += 4;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(EDENA_PRIMARY);
  doc.text('Identité de la commune', M, y);
  y += 6;

  const identityRows = [];
  if (props.population != null) identityRows.push(['Population', `${props.population.toLocaleString('fr-FR')} habitants`]);
  if (props.superficie_cadastrale != null) identityRows.push(['Superficie', `${(props.superficie_cadastrale / 100).toFixed(2)} km²`]);
  if (props.maire_2026) identityRows.push(['Maire (2026)', props.maire_2026]);
  if (props.adresse_mairie) identityRows.push(['Adresse mairie', props.adresse_mairie]);
  if (props.email_mairie) identityRows.push(['Email mairie', props.email_mairie]);
  if (props.site_mairie) identityRows.push(['Site mairie', props.site_mairie]);

  if (identityRows.length) {
    autoTable(doc, {
      startY: y + 4,
      head: [],
      body: identityRows,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3, textColor: TEXT_DARK },
      columnStyles: { 0: { cellWidth: 110, textColor: TEXT_MUTED } },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ---------- Page 2 : stats par trame ----------
  doc.addPage();
  y = M;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(EDENA_PRIMARY);
  doc.text('Indicateurs des trames écologiques', M, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_MUTED);
  doc.text('Surfaces, longueurs et comptages calculés sur le polygone communal pour chaque couche de données activée.', M, y + 12);
  y += 22;

  if (trameStats.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(TEXT_MUTED);
    doc.text('Aucune couche activée pour ce rapport. Activez des couches dans la sidebar avant de générer le PDF.', M, y);
    y += 20;
  }

  for (const t of trameStats) {
    const rows = t.layers.map((l) => [l.label, formatStat(l.stats)]);
    if (!rows.length) continue;
    autoTable(doc, {
      startY: y,
      head: [[{ content: t.label, colSpan: 2, styles: { fillColor: t.color, textColor: '#FFFFFF', fontStyle: 'bold' } }]],
      body: rows,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fontSize: 10 },
      columnStyles: { 0: { textColor: TEXT_DARK }, 1: { halign: 'right', cellWidth: 110, fontStyle: 'bold' } },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 10;
    if (y > H - 80) {
      doc.addPage();
      y = M;
    }
  }

  // ---------- Page 3 : analyses dérivées ----------
  doc.addPage();
  y = M;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(EDENA_PRIMARY);
  doc.text('Diagnostic — analyses dérivées', M, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_MUTED);
  doc.text("Six analyses pré-calculées sur l'ensemble de l'Oise, restreintes ici à la commune.", M, y + 12);
  y += 26;

  for (const d of derivedStats) {
    if (d.kind === 'numeric') {
      autoTable(doc, {
        startY: y,
        head: [[{ content: d.title, colSpan: 2, styles: { fillColor: EDENA_PRIMARY, textColor: '#FFFFFF', fontStyle: 'bold' } }]],
        body: [[d.summary || '—', '']],
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 4 },
        margin: { left: M, right: M }
      });
    } else {
      const rows = (d.classOrder || Object.keys(d.counts)).map((c) => {
        const n = d.counts[c] || 0;
        const pct = d.total ? Math.round((n / d.total) * 100) : 0;
        return [
          { content: c.charAt(0).toUpperCase() + c.slice(1), styles: { textColor: SEVERITY_COLOR[c] || TEXT_DARK } },
          { content: String(n), styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${pct}%`, styles: { halign: 'right', textColor: TEXT_MUTED } }
        ];
      });
      autoTable(doc, {
        startY: y,
        head: [[{ content: `${d.title} — ${d.total || 0} entités`, colSpan: 3, styles: { fillColor: EDENA_PRIMARY, textColor: '#FFFFFF', fontStyle: 'bold' } }]],
        body: rows.length ? rows : [['Aucun élément dans cette commune', '0', '0%']],
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 1: { cellWidth: 60 }, 2: { cellWidth: 50 } },
        margin: { left: M, right: M }
      });
    }
    y = doc.lastAutoTable.finalY + 10;
    if (y > H - 80) {
      doc.addPage();
      y = M;
    }
  }

  // ---------- Page 4 : recommandations ----------
  doc.addPage();
  y = M;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(EDENA_PRIMARY);
  doc.text('Recommandations', M, y);
  y += 18;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_DARK);
  doc.text('Pistes d\'action générées automatiquement à partir des indicateurs ci-dessus.', M, y);
  y += 16;
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED);
  doc.text("(Ces recommandations sont indicatives ; un échange terrain avec EDENA permettra de prioriser et localiser précisément.)", M, y);
  y += 16;

  doc.setFontSize(10);
  doc.setTextColor(TEXT_DARK);
  for (const r of recs) {
    const lines = doc.splitTextToSize(`• ${r}`, W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 12 + 6;
    if (y > H - 80) {
      doc.addPage();
      y = M;
    }
  }

  // ---------- Pied de page mentions sur toutes les pages ----------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor('#999999');
    doc.text(
      'Données : IGN · INPN · Sandre · Cerema · DRIEAT · sig.hautsdefrance.fr · OpenStreetMap',
      M,
      H - 18
    );
    doc.text(`${i} / ${pageCount}`, W - M, H - 18, { align: 'right' });
  }

  onProgress?.('Téléchargement…');
  const filename = `Tramoscope_${(insee || nom).replace(/\W+/g, '_')}.pdf`;
  doc.save(filename);
}
