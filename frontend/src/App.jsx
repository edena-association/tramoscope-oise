import { useState } from 'react';
import Header from './components/UI/Header.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import MapContainer from './components/Map/MapContainer.jsx';
import { BASEMAPS } from './config/layers.js';

export default function App() {
  const [mode, setMode] = useState('exploration');
  const [basemap, setBasemap] = useState('ign_plan');
  const [activeLayers, setActiveLayers] = useState(new Set(['departement', 'communes']));

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
          <MapContainer basemap={basemap} activeLayers={activeLayers} />
        </div>
      </div>
    </div>
  );
}
