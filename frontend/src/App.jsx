import { useCallback, useState } from 'react';
import Header from './components/UI/Header.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import MapContainer from './components/Map/MapContainer.jsx';
import DetailPanel from './components/DetailPanel/DetailPanel.jsx';
import { BASEMAPS, TRAME_LAYERS, TRANSVERSAL_LAYERS } from './config/layers.js';

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

  return (
    <div className="flex flex-col h-full">
      <Header
        basemap={basemap}
        setBasemap={setBasemap}
        basemaps={BASEMAPS}
        onSearchSelect={handleSearchSelect}
        tooltipsEnabled={tooltipsEnabled}
        setTooltipsEnabled={setTooltipsEnabled}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          mode={mode}
          setMode={setMode}
          activeLayers={activeLayers}
          toggleLayer={toggleLayer}
        />
        <div className="flex-1 relative">
          <MapContainer
            basemap={basemap}
            activeLayers={activeLayers}
            onFeatureClick={handleFeatureClick}
            tooltipsEnabled={tooltipsEnabled}
            zoomTarget={zoomTarget}
          />
          <DetailPanel
            selected={selected}
            activeLayers={activeLayers}
            onClose={() => setSelected(null)}
          />
        </div>
      </div>
    </div>
  );
}
