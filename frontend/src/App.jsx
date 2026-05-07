import { useCallback, useRef, useState } from 'react';
import Header from './components/UI/Header.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import MapContainer from './components/Map/MapContainer.jsx';
import DetailPanel from './components/DetailPanel/DetailPanel.jsx';
import { BASEMAPS, TRAME_LAYERS, TRANSVERSAL_LAYERS } from './config/layers.js';
import { exportMap } from './services/map-export.js';

// Constitue l'ensemble initial des couches activées par défaut
function buildDefaultActive() {
  const ids = new Set();
  for (const cfg of Object.values(TRANSVERSAL_LAYERS)) {
    if (cfg.defaultActive !== false) ids.add(cfg.id);
  }
  for (const layers of Object.values(TRAME_LAYERS)) {
    for (const cfg of layers) {
      if (cfg.defaultActive) ids.add(cfg.id);
    }
  }
  return ids;
}

export default function App() {
  const [mode, setMode] = useState('exploration');
  const [basemap, setBasemap] = useState('ign_plan');
  const [activeLayers, setActiveLayers] = useState(buildDefaultActive);
  const [selected, setSelected] = useState(null); // {feature, layerId} ou null
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Cible de zoom : un objet {feature, ts} dont le ts force MapContainer à refaire le fit
  const [zoomTarget, setZoomTarget] = useState(null);

  const toggleLayer = (layerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  const handleFeatureClick = useCallback((feature, layerId) => {
    setSelected({ feature, layerId });
  }, []);

  const handleSearchSelect = useCallback((feature) => {
    if (!feature) return;
    // Centrer la carte + ouvrir le panel détail
    setZoomTarget({ feature, ts: Date.now() });
    setSelected({ feature, layerId: 'communes' });
  }, []);

  const mapShellRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const handleExport = useCallback(
    async (format) => {
      const container = mapShellRef.current?.querySelector('.leaflet-container');
      const map = mapInstanceRef.current;
      if (!container || !map) return;
      const allLayerConfigs = [
        ...Object.values(TRANSVERSAL_LAYERS),
        ...Object.values(TRAME_LAYERS).flat()
      ];
      try {
        await exportMap(container, {
          format,
          activeLayers,
          allLayerConfigs,
          basemapLabel: BASEMAPS[basemap]?.label,
          mapInstance: map
        });
      } catch (e) {
        console.error('export error', e);
        let msg;
        if (e instanceof Event) {
          msg = `Une couche n'a pas répondu en haute résolution (généralement un WMS lent comme INPN/Géorisques). Réessaye avec moins de couches actives ou en 4K.`;
        } else if (e instanceof Error) {
          msg = e.message;
        } else if (typeof e === 'string') {
          msg = e;
        } else {
          msg = JSON.stringify(e) || 'Erreur inconnue';
        }
        alert(`Échec de l'export : ${msg}`);
      }
    },
    [activeLayers, basemap]
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        basemap={basemap}
        setBasemap={setBasemap}
        basemaps={BASEMAPS}
        onSearchSelect={handleSearchSelect}
        tooltipsEnabled={tooltipsEnabled}
        setTooltipsEnabled={setTooltipsEnabled}
        onExport={handleExport}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          mode={mode}
          setMode={setMode}
          activeLayers={activeLayers}
          toggleLayer={toggleLayer}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
        <div className="flex-1 relative" ref={mapShellRef}>
          <MapContainer
            basemap={basemap}
            activeLayers={activeLayers}
            onFeatureClick={handleFeatureClick}
            tooltipsEnabled={tooltipsEnabled}
            zoomTarget={zoomTarget}
            onMapReady={(m) => {
              mapInstanceRef.current = m;
            }}
          />
          <div data-export-hide="true">
            <DetailPanel
              selected={selected}
              activeLayers={activeLayers}
              onClose={() => setSelected(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
