/**
 * Légende dynamique : affiche un swatch adapté au type de couche.
 * - Polygone : carré rempli
 * - Ligne : trait horizontal (avec dashArray éventuel)
 * - Point : disque
 * - WMS : pastille "wms" + couleur de la trame
 *
 * Pour les couches choroplèthes (style fonction), un dégradé est affiché.
 */

const choroplethLegends = {
  brune_artificialisation: {
    title: '% artificialisé 2009-2024',
    stops: [
      { color: '#6D4C41', opacity: 0.1, label: '0-1%' },
      { color: '#6D4C41', opacity: 0.35, label: '1-2%' },
      { color: '#6D4C41', opacity: 0.6, label: '2-4%' },
      { color: '#6D4C41', opacity: 0.85, label: '>4%' }
    ]
  },
  noire_eclairage: {
    title: 'Radiance moyenne 2024',
    gradient: [
      'rgb(10,10,10)', 'rgb(38,30,24)', 'rgb(70,47,26)',
      'rgb(128,80,28)', 'rgb(185,113,32)', 'rgb(225,145,42)',
      'rgb(245,195,75)', 'rgb(252,230,130)'
    ],
    bounds: ['ciel préservé', 'pollution forte']
  },
  // Couches d'analyse Phase 3a — sévérité 3 niveaux
  analyse_connectivite: {
    title: 'Score connectivité 1km',
    gradient: [
      'rgb(180,30,30)', 'rgb(220,80,30)', 'rgb(240,150,40)',
      'rgb(245,200,80)', 'rgb(140,180,80)', 'rgb(50,130,50)'
    ],
    bounds: ['0 (isolé)', '100 (saturé)']
  },
  analyse_ruptures_corridors: {
    title: 'Sévérité de rupture',
    stops: [
      { color: '#388E3C', label: 'légère' },
      { color: '#F57C00', label: 'modérée' },
      { color: '#D32F2F', label: 'critique' }
    ]
  },
  analyse_pas_japonais: {
    title: 'Rôle dans la connectivité',
    stops: [
      { color: '#388E3C', label: 'actif' },
      { color: '#F57C00', label: 'potentiel' },
      { color: '#D32F2F', label: 'isolé' }
    ]
  },
  analyse_ripisylves: {
    title: 'État de la ripisylve',
    stops: [
      { color: '#388E3C', label: 'présente' },
      { color: '#F57C00', label: 'dégradée' },
      { color: '#D32F2F', label: 'absente' }
    ]
  },
  analyse_conflits_eclairage: {
    title: 'Sévérité conflit',
    stops: [
      { color: '#F57C00', label: 'modéré' },
      { color: '#D32F2F', label: 'sévère' },
      { color: '#D32F2F', label: 'critique' }
    ]
  },
  analyse_deserts_pollinisateurs: {
    title: 'Sévérité du désert',
    stops: [
      { color: '#F57C00', label: 'modéré (50-200 ha)' },
      { color: '#D32F2F', label: 'sévère (200-500)' },
      { color: '#D32F2F', label: 'critique (>500)' }
    ]
  }
};

function getColor(cfg) {
  if (typeof cfg.style === 'object') {
    return cfg.style.color || cfg.style.fillColor || '#0B2966';
  }
  return '#0B2966';
}

function Swatch({ cfg }) {
  // WMS : carré semi-transparent avec petit liseré
  if (cfg.type === 'wms') {
    return (
      <span className="inline-flex items-center gap-1 shrink-0">
        <span
          className="w-3 h-3 rounded-sm border border-gray-400"
          style={{ background: 'repeating-linear-gradient(45deg, #ccc 0 2px, #fff 2px 4px)' }}
          aria-hidden
        />
      </span>
    );
  }

  // Style en fonction → on essaie de dessiner un dégradé connu
  if (typeof cfg.style === 'function') {
    const cho = choroplethLegends[cfg.id];
    if (cho?.gradient) {
      // Dégradé continu
      return (
        <span
          className="inline-block w-12 h-3 rounded-sm shrink-0"
          style={{ background: `linear-gradient(to right, ${cho.gradient.join(',')})` }}
        />
      );
    }
    if (cho?.stops) {
      return (
        <span className="inline-flex h-3 shrink-0">
          {cho.stops.map((s, i) => (
            <span
              key={i}
              className="w-2 h-3"
              style={{ background: s.color, opacity: s.opacity ?? 1 }}
            />
          ))}
        </span>
      );
    }
    return <span className="w-3 h-3 rounded-sm bg-gray-400 shrink-0" />;
  }

  const style = cfg.style || {};
  const color = style.color || style.fillColor || '#0B2966';
  const isLine = style.fill === false || style.weight >= 2;
  const isPoint = !!cfg.pointToLayer;

  if (isPoint) {
    return (
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ background: color, opacity: 0.85 }}
      />
    );
  }

  if (isLine) {
    return (
      <span className="w-4 h-3 flex items-center shrink-0" aria-hidden>
        <span
          className="w-full h-0.5 rounded"
          style={{
            background: color,
            opacity: 0.9,
            ...(style.dashArray ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)`, background: 'transparent' } : {})
          }}
        />
      </span>
    );
  }

  // Polygone par défaut
  return (
    <span
      className="w-3 h-3 rounded-sm shrink-0 border"
      style={{
        background: color,
        opacity: style.fillOpacity ?? 0.6,
        borderColor: color
      }}
    />
  );
}

export default function Legend({ items }) {
  if (!items || items.length === 0) return null;

  // Ordre : transversal d'abord, puis trames
  return (
    <div className="absolute bottom-6 left-3 z-[400] bg-white/95 backdrop-blur border border-edena-secondary rounded shadow-sm px-3 py-2 max-w-[280px]">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Légende</div>
      <ul className="flex flex-col gap-1">
        {items.map((cfg) => {
          const cho = typeof cfg.style === 'function' ? choroplethLegends[cfg.id] : null;
          return (
            <li key={cfg.id} className="text-xs text-gray-800">
              <div className="flex items-center gap-2">
                <Swatch cfg={cfg} />
                <span className="leading-tight">{cfg.label}</span>
              </div>
              {cho?.gradient && (
                <div className="ml-5 mt-0.5 flex justify-between text-[10px] text-gray-500">
                  <span>{cho.bounds?.[0] || ''}</span>
                  <span>{cho.bounds?.[1] || ''}</span>
                </div>
              )}
              {cho?.stops && (
                <div className="ml-5 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                  {cho.stops.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-sm"
                        style={{ background: s.color, opacity: s.opacity ?? 1 }}
                      />
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
