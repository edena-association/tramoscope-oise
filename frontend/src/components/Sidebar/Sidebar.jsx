import { Compass, Crosshair, FileText } from 'lucide-react';
import TramePanel from './TramePanel.jsx';
import { TRAMES, TRAMES_ORDER } from '../../config/trames.js';
import { TRAME_LAYERS, TRANSVERSAL_LAYERS } from '../../config/layers.js';

const MODES = [
  { id: 'exploration', label: 'Exploration', icon: Compass },
  { id: 'analyse', label: 'Analyse', icon: Crosshair },
  { id: 'rapport', label: 'Rapport', icon: FileText }
];

export default function Sidebar({ mode, setMode, activeLayers, toggleLayer }) {
  return (
    <aside className="w-[320px] bg-white border-r border-edena-secondary flex flex-col shrink-0">
      <nav className="flex border-b border-edena-secondary">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm transition ${
              mode === id
                ? 'text-edena-primary border-b-2 border-edena-primary font-medium'
                : 'text-gray-500 hover:text-edena-primary'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {mode === 'exploration' && (
          <ExplorationPanel activeLayers={activeLayers} toggleLayer={toggleLayer} />
        )}
        {mode === 'analyse' && <PlaceholderPanel title="Mode Analyse — à venir (Phase 3)" />}
        {mode === 'rapport' && <PlaceholderPanel title="Mode Rapport — à venir (Phase 4)" />}
      </div>

      <footer className="px-4 py-2 text-[10px] text-gray-400 border-t border-edena-secondary">
        EDENA — Tiers de confiance territorial
      </footer>
    </aside>
  );
}

function ExplorationPanel({ activeLayers, toggleLayer }) {
  return (
    <div>
      <Section title="Couches transversales">
        {Object.values(TRANSVERSAL_LAYERS).map((layer) => (
          <LayerToggle
            key={layer.id}
            label={layer.label}
            color="#0B2966"
            active={activeLayers.has(layer.id)}
            onToggle={() => toggleLayer(layer.id)}
          />
        ))}
      </Section>

      {TRAMES_ORDER.map((trameId) => (
        <TramePanel
          key={trameId}
          trame={TRAMES[trameId]}
          layers={TRAME_LAYERS[trameId] || []}
          activeLayers={activeLayers}
          toggleLayer={toggleLayer}
        />
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="px-4 pt-3 pb-2 border-b border-edena-secondary">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">{title}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function LayerToggle({ label, color, active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2.5 py-1.5 text-sm text-left hover:bg-gray-50 rounded px-1 -mx-1 transition"
    >
      <span
        className={`w-8 h-4 rounded-full relative transition ${active ? '' : 'bg-gray-200'}`}
        style={{ background: active ? color : undefined }}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${
            active ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
      <span className="flex-1 text-gray-800">{label}</span>
    </button>
  );
}

function PlaceholderPanel({ title }) {
  return (
    <div className="p-4 text-sm text-gray-500">
      <div className="border border-dashed border-gray-300 rounded p-4 text-center">{title}</div>
    </div>
  );
}
