import { useEffect, useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { TRAMES } from '../../config/trames.js';
import { TRAME_LAYERS } from '../../config/layers.js';
import { computeLayerStats } from '../../services/feature-stats.js';
import { loadGeoJson } from '../../services/data-cache.js';

// Map siren EPCI → nom officiel, calculée à la demande
let epciCachePromise = null;
function loadEpciNameMap() {
  if (!epciCachePromise) {
    epciCachePromise = loadGeoJson('/data/admin/epci_oise.geojson').then((fc) => {
      const map = new Map();
      for (const f of fc.features || []) {
        const siren = f.properties?.code_siren;
        if (siren) map.set(String(siren), f.properties.nom_officiel || '?');
      }
      return map;
    });
  }
  return epciCachePromise;
}

/**
 * Panneau slide-in droit avec :
 *  - Identité de la commune/EPCI (nom, code INSEE, population, surface, EPCI...)
 *  - Stats par couche active (longueur cours d'eau, surface forêt, nb obstacles, etc.)
 */
export default function DetailPanel({ selected, activeLayers, onClose }) {
  if (!selected) return null;

  const props = selected.feature?.properties || {};
  const isCommune = selected.layerId === 'communes';
  const title = props.nom_officiel || props.nom || props.NOM || '—';

  return (
    <aside className="absolute top-0 right-0 h-full w-[360px] bg-white border-l border-edena-secondary shadow-lg z-[450] flex flex-col">
      <header className="flex items-start justify-between px-4 py-3 border-b border-edena-secondary">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            {isCommune ? 'Commune' : 'EPCI'}
          </div>
          <h3 className="text-base font-semibold text-edena-primary leading-tight">{title}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-edena-primary p-1 -mr-1 -mt-1"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto sidebar-scroll">
        <IdentitySection props={props} isCommune={isCommune} />
        <StatsSection feature={selected.feature} activeLayers={activeLayers} />
      </div>
    </aside>
  );
}

function IdentitySection({ props, isCommune }) {
  const [epciName, setEpciName] = useState(null);

  useEffect(() => {
    if (!isCommune) return;
    const siren = props.codes_siren_des_epci;
    if (!siren) return;
    let cancelled = false;
    loadEpciNameMap().then((map) => {
      if (!cancelled) setEpciName(map.get(String(siren)));
    });
    return () => {
      cancelled = true;
    };
  }, [isCommune, props.codes_siren_des_epci]);

  // Superficie commune : champ 'superficie_cadastrale' en hectares (Admin Express)
  const surfaceKm2 =
    props.superficie_cadastrale != null
      ? (props.superficie_cadastrale / 100).toFixed(2)
      : props.superficie_km2 != null
        ? props.superficie_km2.toFixed(2)
        : null;

  // Nb communes EPCI
  const nbCommunesEpci =
    typeof props.codes_insee_des_communes_membres === 'string'
      ? props.codes_insee_des_communes_membres.split('/').filter(Boolean).length
      : null;

  const rows = isCommune
    ? [
        ['Code INSEE', props.code_insee],
        ['Code postal', props.code_postal],
        ['Population', props.population ? props.population.toLocaleString('fr-FR') + ' hab.' : null],
        ['Superficie', surfaceKm2 ? `${surfaceKm2} km²` : null],
        ['Gentilé', props.gentile_singulier || props.gentile],
        ['Maire (2026)', props.maire_2026 || props.maire],
        ['EPCI', epciName || (props.codes_siren_des_epci ? `SIREN ${props.codes_siren_des_epci}` : null)],
        ['Canton (INSEE)', props.code_insee_du_canton],
        ['Site mairie', props.site_web ? <a key="w" href={props.site_web} target="_blank" rel="noreferrer" className="text-edena-primary underline">{props.site_web.replace(/^https?:\/\//, '')}</a> : null],
        ['Téléphone mairie', props.telephone],
        ['Email mairie', props.email ? <a key="e" href={`mailto:${props.email}`} className="text-edena-primary underline break-all">{props.email}</a> : null],
        ['Statut', props.statut]
      ]
    : [
        ['Code SIREN', props.code_siren],
        ['Type', props.nature],
        ['Nb communes', nbCommunesEpci]
      ];

  return (
    <section className="px-4 py-3 border-b border-edena-secondary">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Identité</div>
      <dl className="text-sm">
        {rows
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => (
            <div key={k} className="flex gap-2 py-0.5">
              <dt className="w-28 shrink-0 text-gray-500">{k}</dt>
              <dd className="text-gray-800 break-words flex-1">{v}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

function StatsSection({ feature, activeLayers }) {
  // Couches GeoJSON par trame, qui sont actives
  const groupedLayers = useMemo(() => {
    const out = {};
    for (const [trameId, layers] of Object.entries(TRAME_LAYERS)) {
      const active = layers.filter(
        (l) => activeLayers.has(l.id) && l.type === 'geojson'
      );
      if (active.length) out[trameId] = active;
    }
    return out;
  }, [activeLayers]);

  const totalActive = Object.values(groupedLayers).reduce((s, a) => s + a.length, 0);

  return (
    <section className="px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
        Stats par couches actives
      </div>
      {totalActive === 0 ? (
        <div className="text-xs text-gray-400 italic py-2">
          Aucune couche statique active. Activez des couches dans la sidebar pour voir les stats locales.
        </div>
      ) : (
        Object.entries(groupedLayers).map(([trameId, layers]) => (
          <TrameStatsBlock
            key={trameId}
            trame={TRAMES[trameId]}
            layers={layers}
            feature={feature}
          />
        ))
      )}
    </section>
  );
}

function TrameStatsBlock({ trame, layers, feature }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-sm"
          style={{ background: trame.color, opacity: 0.85 }}
          aria-hidden
        />
        <span className="text-xs font-medium text-gray-700">{trame.label}</span>
      </div>
      <ul className="flex flex-col gap-0.5 ml-4">
        {layers.map((layer) => (
          <LayerStatRow key={layer.id} layer={layer} feature={feature} />
        ))}
      </ul>
    </div>
  );
}

function LayerStatRow({ layer, feature }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStats(null);
    computeLayerStats(feature, layer)
      .then((s) => {
        if (!cancelled) {
          setStats(s);
          setLoading(false);
        }
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [feature, layer]);

  return (
    <li className="flex items-center justify-between text-xs gap-2">
      <span className="text-gray-600 truncate">{layer.label}</span>
      <span className="text-gray-800 font-medium tabular-nums shrink-0">
        {loading && <Loader2 size={11} className="animate-spin inline" />}
        {!loading && stats && formatStat(stats)}
        {!loading && !stats && '—'}
      </span>
    </li>
  );
}

function formatStat(s) {
  if (!s) return '—';
  if (s.kind === 'count') return `${s.value} ${s.value > 1 ? 'éléments' : 'élément'}`;
  if (s.kind === 'length') {
    return s.value < 0.1 ? `<0.1 km` : `${s.value} km`;
  }
  if (s.kind === 'area') {
    if (s.value < 0.1) return `<0.1 ha`;
    if (s.value > 1000) return `${(s.value / 100).toFixed(0)} km²`;
    return `${s.value} ha`;
  }
  return '—';
}
