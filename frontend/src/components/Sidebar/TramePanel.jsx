import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export default function TramePanel({ trame, layers, activeLayers, toggleLayer }) {
  const activeCount = layers.filter((l) => activeLayers.has(l.id)).length;
  // Trame ouverte par défaut si elle a une couche active
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <div className="border-b border-edena-secondary">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition text-left"
      >
        <ChevronRight
          size={14}
          className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span
          className="w-3 h-3 rounded-sm shrink-0"
          style={{ background: trame.color, opacity: 0.8 }}
          aria-hidden
        />
        <span className="flex-1 text-sm font-medium text-gray-800">{trame.label}</span>
        {activeCount > 0 && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
            style={{ background: trame.color }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1">
          {layers.length === 0 ? (
            <div className="text-xs text-gray-400 italic py-1">
              Aucune couche disponible — en cours d'intégration.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {layers.map((layer) => {
                const active = activeLayers.has(layer.id);
                return (
                  <button
                    key={layer.id}
                    onClick={() => toggleLayer(layer.id)}
                    className="flex items-center gap-2.5 py-1 text-sm text-left hover:bg-gray-50 rounded px-1 -mx-1 transition"
                  >
                    <span
                      className="w-8 h-4 rounded-full relative transition"
                      style={{ background: active ? trame.color : '#E5E7EB' }}
                    >
                      <span
                        className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${
                          active ? 'left-[18px]' : 'left-0.5'
                        }`}
                      />
                    </span>
                    <span className="flex-1 text-gray-700">{layer.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
