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

  return (
    <div className="flex flex-col h-full">
      <Header basemap={basemap} setBasemap={setBasemap} basemaps={BASEMAPS} />
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
