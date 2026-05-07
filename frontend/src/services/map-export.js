/**
 * Export carte propre — PNG ou PDF A3 paysage.
 *
 * Approche : html-to-image capture le DOM de la zone carte (.leaflet-container)
 * incluant tuiles raster (WMTS/WMS, CORS activé) + overlays SVG/Canvas Leaflet.
 *
 * Pour un export "propre" sans sidebar/panel/légende, on les masque
 * temporairement via classe CSS .map-exporting sur le body, on capture, puis
 * on restaure.
 */
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const EDENA_PRIMARY = '#0B2966';

/**
 * Capture le rendu actuel de la carte en PNG dataURL haute résolution.
 * @param {HTMLElement} mapContainer - le div .leaflet-container
 * @param {object} opts
 * @returns {Promise<string>} dataURL PNG
 */
async function captureMap(mapContainer, { pixelRatio = 2 } = {}) {
  // Attendre que toutes les tuiles soient chargées (Leaflet ne fournit pas un
  // event simple "all loaded" cross-layers, on attend les images img du DOM)
  const imgs = mapContainer.querySelectorAll('img.leaflet-tile');
  await Promise.all(
    [...imgs].map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.addEventListener('load', res, { once: true });
              img.addEventListener('error', res, { once: true });
            })
    )
  );

  return await toPng(mapContainer, {
    pixelRatio,
    cacheBust: false,
    skipAutoScale: true,
    style: {
      // Masque les overlays UI éventuels qui se trouveraient dans le conteneur
      // (le bouton Légende est dans le conteneur Leaflet, on le neutralise)
    }
  });
}

/**
 * Hide UI temporairement pour une capture propre.
 */
function hideUiForCapture() {
  document.body.classList.add('map-exporting');
  return () => document.body.classList.remove('map-exporting');
}

/**
 * Liste des couches actives + leur catégorie pour la légende compacte du PDF.
 */
function buildLegendItems(activeLayers, allLayerConfigs) {
  return allLayerConfigs.filter((cfg) => activeLayers.has(cfg.id));
}

export async function exportMap(
  mapContainer,
  { format = 'pdf', activeLayers, allLayerConfigs, basemapLabel } = {}
) {
  const restore = hideUiForCapture();
  // Petit délai pour laisser le navigateur appliquer le CSS
  await new Promise((r) => setTimeout(r, 250));

  let dataUrl;
  try {
    dataUrl = await captureMap(mapContainer, { pixelRatio: 2 });
  } finally {
    restore();
  }

  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (format === 'png') {
    // Téléchargement direct du PNG
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Tramoscope_Oise_${Date.now()}.png`;
    a.click();
    return;
  }

  // ---- PDF A3 paysage (420 × 297 mm) ----
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  const W = doc.internal.pageSize.getWidth();   // ≈ 1190
  const H = doc.internal.pageSize.getHeight();  // ≈ 842
  const M = 28;                                  // marges
  const headerH = 44;
  const footerH = 28;

  // Bandeau header bleu nuit
  doc.setFillColor(EDENA_PRIMARY);
  doc.rect(0, 0, W, headerH, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Tramoscope', M, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('— Oise', M + 90, 28);
  doc.setFontSize(9);
  doc.setTextColor('#dadada');
  doc.text(`Édité le ${today}`, W - M, 28, { align: 'right' });

  // Zone carte
  const mapY = headerH + 12;
  const mapH = H - mapY - footerH - 80; // réserver bas pour légende
  const mapW = W - 2 * M;

  // Charger l'image et calculer le ratio pour l'insérer sans déformer
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = dataUrl;
  });
  const imgRatio = img.width / img.height;
  const targetRatio = mapW / mapH;
  let drawW, drawH, drawX, drawY;
  if (imgRatio > targetRatio) {
    drawW = mapW;
    drawH = mapW / imgRatio;
    drawX = M;
    drawY = mapY + (mapH - drawH) / 2;
  } else {
    drawH = mapH;
    drawW = mapH * imgRatio;
    drawX = M + (mapW - drawW) / 2;
    drawY = mapY;
  }
  doc.addImage(dataUrl, 'PNG', drawX, drawY, drawW, drawH);

  // Légende compacte sous la carte
  const legY = mapY + mapH + 12;
  doc.setTextColor('#1a1a1a');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Couches affichées', M, legY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (basemapLabel) {
    doc.setTextColor('#666');
    doc.text(`Fond : ${basemapLabel}`, W - M, legY, { align: 'right' });
  }

  const legendItems = buildLegendItems(activeLayers, allLayerConfigs);
  let lx = M;
  let ly = legY + 14;
  doc.setTextColor('#333');
  doc.setFontSize(8);
  for (const cfg of legendItems) {
    const label = cfg.label.replace(/^⚙\s*Analyse\s*—\s*/, '');
    const colorEntry = inferColor(cfg);
    if (colorEntry) {
      doc.setFillColor(colorEntry);
      doc.rect(lx, ly - 7, 8, 8, 'F');
    }
    const w = doc.getTextWidth(label) + 16;
    if (lx + w > W - M) {
      lx = M;
      ly += 12;
    }
    doc.text(label, lx + 12, ly);
    lx += w + 8;
  }

  // Footer mentions
  doc.setFontSize(7);
  doc.setTextColor('#888');
  doc.text(
    'Données : IGN · INPN · Sandre · Cerema · DRIEAT · sig.hautsdefrance.fr · OpenStreetMap   |   EDENA — tiers de confiance territorial',
    M,
    H - 12
  );

  doc.save(`Tramoscope_Oise_${Date.now()}.pdf`);
}

function inferColor(cfg) {
  if (cfg.type === 'wms' || cfg.type === 'tilelayer') return '#999';
  if (typeof cfg.style === 'function') return '#666';
  if (typeof cfg.style === 'object') {
    return cfg.style.fillColor || cfg.style.color || '#666';
  }
  return '#666';
}
