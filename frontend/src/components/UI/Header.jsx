import { Layers, Tag } from 'lucide-react';
import CommuneSearch from './CommuneSearch.jsx';

export default function Header({
  basemap,
  setBasemap,
  basemaps,
  onSearchSelect,
  tooltipsEnabled,
  setTooltipsEnabled
}) {
  return (
    <header className="bg-edena-primary text-white px-5 h-14 flex items-center justify-between shrink-0 shadow-sm gap-4">
      <div className="flex items-center gap-3 shrink-0">
        {/* Logo héron stylisé monochrome blanc — placeholder SVG simplifié */}
        <svg width="28" height="28" viewBox="0 0 64 64" fill="none" aria-label="Logo EDENA">
          <path
            d="M8 44c6-2 12-2 18-6 4-3 6-7 8-12 1-3 3-6 6-7 4-1 8 1 10 4 1 2 1 4 0 6-1 1-3 2-5 1-1-1-1-2 0-3 1-1 2-1 3 0M30 50c4-2 8-5 10-9M50 22l4-2 2 4-3 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <div className="leading-tight">
          <div className="text-lg">
            <span className="font-semibold">Tramoscope</span>
            <span className="font-normal opacity-80"> — Oise</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider opacity-70">EDENA · tiers de confiance territorial</div>
        </div>
      </div>

      <CommuneSearch onSelect={onSearchSelect} />

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setTooltipsEnabled((v) => !v)}
          className={`flex items-center gap-1.5 transition border rounded text-xs px-2 py-1 ${
            tooltipsEnabled
              ? 'bg-white/12 hover:bg-white/18 border-white/25'
              : 'bg-white/0 hover:bg-white/8 border-white/15 line-through opacity-70'
          }`}
          title={tooltipsEnabled ? 'Étiquettes au survol activées (cliquer pour masquer)' : 'Étiquettes masquées (cliquer pour réactiver)'}
        >
          <Tag size={13} />
          <span>Étiquettes</span>
        </button>

        <div className="flex items-center gap-2">
          <Layers size={16} className="opacity-70" />
          <select
            value={basemap}
            onChange={(e) => setBasemap(e.target.value)}
            className="bg-white/10 hover:bg-white/15 transition border border-white/20 rounded text-sm px-2 py-1 outline-none"
            aria-label="Fond de carte"
          >
            {Object.values(basemaps).map((bm) => (
              <option key={bm.id} value={bm.id} className="text-black">
                {bm.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
