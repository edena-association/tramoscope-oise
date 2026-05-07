import { useEffect, useState } from 'react';
import { AlertTriangle, Activity, ExternalLink } from 'lucide-react';
import { TRAMES, TRAMES_ORDER } from '../../config/trames.js';
import { TRAME_LAYERS } from '../../config/layers.js';
import { loadGeoJson } from '../../services/data-cache.js';

/**
 * Panneau du mode "Analyse" : présentation dédiée des couches dérivées (Phase 3a),
 * avec un résumé statistique calculé à la volée pour chaque analyse.
 *
 * Différent du mode Exploration : ici on sélectionne par "thématique d'analyse"
 * plutôt que par couches brutes - le toggle ajoute la même couche dérivée que
 * dans Exploration, mais le UX est centré "diagnostic".
 */

// Description méthodologique de chaque analyse (résumée depuis CLAUDE.md §5)
const ANALYSES = [
  {
    id: 'analyse_pas_japonais',
    trameId: 'verte',
    title: 'Pas japonais potentiels',
    method: 'Fragments forestiers 0.1-5 ha à <500m d’un corridor SRCE ou en chapelet (≥3 voisins).',
    severityField: 'classe',
    classOrder: ['actif', 'potentiel', 'isole'],
    classLabel: { actif: 'Actifs', potentiel: 'Potentiels', isole: 'Isolés' }
  },
  {
    id: 'analyse_ripisylves',
    trameId: 'turquoise',
    title: 'État des ripisylves',
    method: 'Tronçons de 250m de cours d’eau, classés selon la couverture forestière dans un buffer 10m.',
    severityField: 'etat_ripisylve',
    classOrder: ['presente', 'degradee', 'absente'],
    classLabel: { presente: 'Présentes', degradee: 'Dégradées', absente: 'Absentes' }
  },
  {
    id: 'analyse_conflits_eclairage',
    trameId: 'noire',
    title: 'Conflits éclairage / biodiversité',
    method: 'Communes à radiance >5 nW intersectées avec ZNIEFF + Natura 2000.',
    severityField: 'severite',
    classOrder: ['critique', 'severe', 'modere'],
    classLabel: { modere: 'Modérés', severe: 'Sévères', critique: 'Critiques' }
  },
  {
    id: 'analyse_deserts_pollinisateurs',
    trameId: 'rose',
    title: 'Déserts pollinisateurs',
    method: 'Zones >50 ha sans habitat semi-naturel (forêt + zones humides + réservoirs) à <300m.',
    severityField: 'severite',
    classOrder: ['critique', 'severe', 'modere'],
    classLabel: { modere: 'Modérés (50-200 ha)', severe: 'Sévères (200-500 ha)', critique: 'Critiques (>500 ha)' }
  }
];

const SEVERITY_COLOR = {
  critique: '#D32F2F',
  severe: '#D32F2F',
  absente: '#D32F2F',
  isole: '#D32F2F',
  modere: '#F57C00',
  degradee: '#F57C00',
  potentiel: '#F57C00',
  presente: '#388E3C',
  actif: '#388E3C'
};

export default function AnalysisPanel({ activeLayers, toggleLayer }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 mb-3">
        <Activity size={14} className="text-edena-primary" />
        <h3 className="text-sm font-semibold text-edena-primary">Diagnostics dérivés</h3>
      </div>
      <p className="text-[11px] text-gray-500 leading-snug mb-4">
        4 analyses pré-calculées sur l’Oise, basées sur le croisement des couches publiques.
        Activez une analyse pour la voir s’afficher sur la carte avec son code couleur de sévérité.
      </p>

      {ANALYSES.map((a) => (
        <AnalysisCard
          key={a.id}
          analysis={a}
          active={activeLayers.has(a.id)}
          onToggle={() => toggleLayer(a.id)}
        />
      ))}

      <div className="mt-4 pt-3 border-t border-edena-secondary text-[10px] text-gray-400 leading-relaxed">
        <div className="flex items-start gap-1">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          <span>
            Calculs Phase 3a — pré-calculés. La Phase 3b (least-cost path, score
            Graphab) et le mode interactif (zone dessinée) viendront avec le
            backend Python.
          </span>
        </div>
      </div>
    </div>
  );
}

function AnalysisCard({ analysis, active, onToggle }) {
  const trame = TRAMES[analysis.trameId];
  const cfg = TRAME_LAYERS[analysis.trameId]?.find((l) => l.id === analysis.id);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!cfg?.url) return;
    let cancelled = false;
    loadGeoJson(cfg.url)
      .then((fc) => {
        if (cancelled) return;
        const counts = {};
        let total = 0;
        for (const f of fc.features || []) {
          const c = f.properties?.[analysis.severityField];
          if (c == null) continue;
          counts[c] = (counts[c] || 0) + 1;
          total += 1;
        }
        setStats({ total, counts });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cfg?.url, analysis.severityField]);

  return (
    <div className="border border-edena-secondary rounded mb-2 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-gray-50 transition"
      >
        <span
          className={`mt-0.5 w-8 h-4 rounded-full relative transition shrink-0 ${active ? '' : 'bg-gray-200'}`}
          style={{ background: active ? trame.color : undefined }}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${
              active ? 'left-[18px]' : 'left-0.5'
            }`}
          />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ background: trame.color, opacity: 0.85 }}
            />
            <span className="text-sm font-medium text-gray-800">{analysis.title}</span>
          </div>
          <div className="text-[10px] text-gray-500 leading-snug mt-0.5">{analysis.method}</div>
        </div>
      </button>

      {stats && stats.total > 0 && (
        <div className="px-3 pb-2 pt-0.5">
          <div className="flex items-baseline justify-between text-[10px] text-gray-500 mb-1">
            <span>Bilan Oise</span>
            <span className="tabular-nums font-medium text-gray-700">{stats.total} entités</span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {analysis.classOrder.map((c) => {
              const n = stats.counts[c] || 0;
              const pct = stats.total ? Math.round((n / stats.total) * 100) : 0;
              return (
                <li key={c} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ background: SEVERITY_COLOR[c] || '#999' }}
                  />
                  <span className="flex-1 text-gray-600">{analysis.classLabel[c] || c}</span>
                  <span className="tabular-nums text-gray-700 font-medium">{n}</span>
                  <span className="tabular-nums text-gray-400 w-9 text-right">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
