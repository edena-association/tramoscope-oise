/**
 * Export carte propre — PNG haute résolution (2K/4K/8K) ou PDF A3.
 *
 * Stratégie haute résolution :
 *   On NE multiplie PAS le pixelRatio (le bug "mosaïque" de html-to-image
 *   apparaît au-delà de 2x avec les tiles raster). À la place :
 *     1. On agrandit temporairement le conteneur Leaflet à la taille cible.
 *     2. On augmente le zoom Leaflet de log2(scale) → tiles fines fetchées.
 *     3. On attend que les tiles soient chargées.
 *     4. On capture à pixelRatio 1 (taille native).
 *     5. On restaure conteneur, vue, zoom.
 *
 * Pendant la manip, un overlay plein écran cache la transition à l'utilisateur.
 */
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const EDENA_PRIMARY = '#0B2966';

export const QUALITY_PRESETS = {
  '2k': { label: 'PNG 2K', width: 2048, hint: 'recommandé' },
  '4k': { label: 'PNG 4K', width: 3840, hint: 'haute qualité' },
  '8k': { label: 'PNG 8K', width: 7680, hint: 'très lourd, 30 s+' }
};

/**
 * Attend que toutes les images <img> du conteneur soient chargées,
 * + délai de sécurité pour les WMS plus lents.
 */
async function waitForTilesLoaded(container, extraMs = 1500) {
  const tries = 60;
  for (let i = 0; i < tries; i++) {
    const imgs = container.querySelectorAll('img');
    let pending = 0;
    for (const img of imgs) {
      if (!img.complete || img.naturalWidth === 0) pending++;
    }
    if (pending === 0) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  await new Promise((r) => setTimeout(r, extraMs));
}

function showOverlay(message) {
  const overlay = document.createElement('div');
  overlay.id = 'map-export-overlay';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:#0B2966',
    'color:#fff',
    'z-index:99999',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:12px',
    'font-family:Rethink Sans, Inter, sans-serif',
    'font-size:14px'
  ].join(';');
  overlay.innerHTML = `
    <div style="font-size:18px;font-weight:600">Tramoscope</div>
    <div style="opacity:.8" id="map-export-overlay-msg">${message}</div>
    <div style="width:160px;height:3px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden">
      <div style="width:40%;height:100%;background:#fff;animation:exp-bar 1.4s ease-in-out infinite"></div>
    </div>
    <style>@keyframes exp-bar { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }</style>
  `;
  document.body.appendChild(overlay);
  return {
    setMsg: (m) => {
      const el = overlay.querySelector('#map-export-overlay-msg');
      if (el) el.textContent = m;
    },
    remove: () => overlay.remove()
  };
}

/**
 * Capture haute résolution via redimensionnement temporaire du conteneur.
 */
async function captureHighRes(mapInstance, targetWidth) {
  const map = mapInstance;
  const container = map.getContainer();
  const rect = container.getBoundingClientRect();
  const scale = targetWidth / rect.width;

  // Sauvegarde
  const originalCenter = map.getCenter();
  const originalZoom = map.getZoom();
  const savedStyle = {
    position: container.style.position,
    top: container.style.top,
    left: container.style.left,
    width: container.style.width,
    height: container.style.height,
    zIndex: container.style.zIndex
  };

  // Redimensionne hors-flux pour échapper au flex parent
  const newW = Math.round(rect.width * scale);
  const newH = Math.round(rect.height * scale);
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = newW + 'px';
  container.style.height = newH + 'px';
  container.style.zIndex = '-1'; // Sous l'overlay
  container.classList.add('map-exporting-zoomed');

  map.invalidateSize({ pan: false, animate: false });

  // Boost zoom : log2 de l'échelle (chaque +1 zoom = ×2 résolution linéaire)
  const zoomBoost = Math.log2(scale);
  const targetZoom = Math.min(originalZoom + zoomBoost, map.getMaxZoom() || 19);
  map.setView(originalCenter, targetZoom, { animate: false });

  try {
    // Attendre les tiles
    await waitForTilesLoaded(container, scale > 3 ? 2500 : 1500);

    // Capture native (pixelRatio 1, on a déjà la bonne taille)
    const dataUrl = await toPng(container, {
      pixelRatio: 1,
      cacheBust: false,
      skipAutoScale: true
    });
    return dataUrl;
  } finally {
    // Restauration
    Object.assign(container.style, savedStyle);
    container.classList.remove('map-exporting-zoomed');
    map.invalidateSize({ pan: false, animate: false });
    map.setView(originalCenter, originalZoom, { animate: false });
  }
}

/**
 * Capture standard sans manipulation du zoom (utilisée pour 2K et le PDF).
 */
async function captureStandard(container) {
  await waitForTilesLoaded(container, 800);
  return await toPng(container, {
    pixelRatio: 2,
    cacheBust: false,
    skipAutoScale: true
  });
}

function hideUiForCapture() {
  document.body.classList.add('map-exporting');
  return () => document.body.classList.remove('map-exporting');
}

export async function exportMap(
  mapContainer,
  { format = 'png-2k', activeLayers, allLayerConfigs, basemapLabel, mapInstance } = {}
) {
  const quality = format.startsWith('png-') ? format.slice(4) : '2k';
  const targetWidth = QUALITY_PRESETS[quality]?.width || 2048;
  const cw = mapContainer.offsetWidth || 1200;

  const overlay = showOverlay('Préparation de l\'export...');
  const restoreUi = hideUiForCapture();
  await new Promise((r) => setTimeout(r, 200));

  let dataUrl;
  try {
    if (format === 'pdf') {
      overlay.setMsg('Capture de la carte...');
      dataUrl = await captureStandard(mapContainer);
    } else if (targetWidth > cw * 1.3 && mapInstance) {
      // Haute résolution → resize + zoom boost
      overlay.setMsg(`Génération ${QUALITY_PRESETS[quality].label} (peut prendre 10-30 s)...`);
      dataUrl = await captureHighRes(mapInstance, targetWidth);
    } else {
      overlay.setMsg('Capture de la carte...');
      dataUrl = await captureStandard(mapContainer);
    }
  } finally {
    restoreUi();
  }

  overlay.setMsg('Téléchargement...');
  await new Promise((r) => setTimeout(r, 100));

  try {
    if (format.startsWith('png')) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Tramoscope_Oise_${quality}_${Date.now()}.png`;
      a.click();
    } else {
      await renderPdfA3(dataUrl, { activeLayers, allLayerConfigs, basemapLabel });
    }
  } finally {
    overlay.remove();
  }
}

async function renderPdfA3(dataUrl, { activeLayers, allLayerConfigs, basemapLabel }) {
  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 28;
  const headerH = 44;
  const footerH = 28;

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

  const mapY = headerH + 12;
  const mapH = H - mapY - footerH - 80;
  const mapW = W - 2 * M;

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

  const legendItems = (allLayerConfigs || []).filter((c) => activeLayers.has(c.id));
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
