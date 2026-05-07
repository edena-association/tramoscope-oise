import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { loadGeoJson } from '../../services/data-cache.js';

/**
 * Barre de recherche commune en autocomplete.
 *  - Charge les 680 communes Oise au montage (via cache → 0 fetch si déjà chargées par la carte)
 *  - Filtre par préfixe + sous-chaîne dans le nom (insensible à casse/diacritiques)
 *  - Sélection appelle onSelect(feature) → parent recentre + ouvre le panel détail
 */
export default function CommuneSearch({ onSelect }) {
  const [communes, setCommunes] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    loadGeoJson('/data/admin/communes_oise.geojson')
      .then((fc) => setCommunes(fc.features || []))
      .catch(() => {});
  }, []);

  // Click outside → close
  useEffect(() => {
    function onDocClick(e) {
      if (!containerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Reset highlight si la liste change
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    const out = [];
    for (const f of communes) {
      const nom = f.properties?.nom_officiel || '';
      const norm = normalize(nom);
      if (!norm.includes(q)) continue;
      // Score : préfixe (0) > mot (1) > sous-chaîne (2)
      const score = norm.startsWith(q) ? 0 : norm.split(/[\s'-]/).some((w) => w.startsWith(q)) ? 1 : 2;
      out.push({ feature: f, nom, score });
      if (out.length > 60) break;
    }
    out.sort((a, b) => a.score - b.score || a.nom.localeCompare(b.nom));
    return out.slice(0, 8);
  }, [query, communes]);

  function selectMatch(m) {
    setQuery(m.nom);
    setOpen(false);
    inputRef.current?.blur();
    onSelect?.(m.feature);
  }

  function onKeyDown(e) {
    if (!open || matches.length === 0) {
      if (e.key === 'Enter' && matches.length > 0) {
        e.preventDefault();
        selectMatch(matches[0]);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectMatch(matches[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 bg-white/12 hover:bg-white/18 transition border border-white/25 rounded px-2 py-1 w-64">
        <Search size={14} className="opacity-70 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Rechercher une commune..."
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent text-sm placeholder-white/55 outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="opacity-60 hover:opacity-100"
            aria-label="Effacer"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white text-edena-primary border border-edena-secondary rounded shadow-lg overflow-hidden z-[1100]">
          {matches.map((m, i) => (
            <li key={m.feature.properties.code_insee || i}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => selectMatch(m)}
                className={`w-full flex justify-between items-baseline gap-2 px-2.5 py-1.5 text-left text-sm transition ${
                  i === highlight ? 'bg-edena-primary text-white' : 'hover:bg-edena-secondary'
                }`}
              >
                <span className="truncate">{m.nom}</span>
                <span className="text-[10px] opacity-70 tabular-nums shrink-0">
                  {m.feature.properties.code_insee}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function normalize(s) {
  return s
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
