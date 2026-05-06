/**
 * Définition des 6 trames écologiques du Tramoscope.
 * Couleurs et opacités fixées par la DA EDENA (voir CLAUDE.md §4.2).
 */
export const TRAMES = {
  verte: {
    id: 'verte',
    label: 'Trame verte',
    description: 'Continuités écologiques terrestres : forêts, haies, prairies, corridors.',
    color: '#2E7D32',
    fillOpacity: 0.3,
    strokeOpacity: 0.8
  },
  bleue: {
    id: 'bleue',
    label: 'Trame bleue',
    description: 'Continuités aquatiques : cours d’eau, zones humides, obstacles.',
    color: '#1565C0',
    fillOpacity: 0.3,
    strokeOpacity: 0.8
  },
  turquoise: {
    id: 'turquoise',
    label: 'Trame turquoise',
    description: 'Interfaces terre-eau : ripisylves, berges, zones d’interface.',
    color: '#00897B',
    fillOpacity: 0.3,
    strokeOpacity: 0.8
  },
  brune: {
    id: 'brune',
    label: 'Trame brune',
    description: 'Sols vivants et fonctionnels, dynamique d’artificialisation.',
    color: '#6D4C41',
    fillOpacity: 0.3,
    strokeOpacity: 0.8
  },
  noire: {
    id: 'noire',
    label: 'Trame noire',
    description: 'Zones préservées de la pollution lumineuse pour la faune nocturne.',
    color: '#4A148C',
    fillOpacity: 0.3,
    strokeOpacity: 0.8
  },
  rose: {
    id: 'rose',
    label: 'Trame rose',
    description: 'Zones favorables aux pollinisateurs.',
    color: '#C2185B',
    fillOpacity: 0.3,
    strokeOpacity: 0.8
  }
};

export const TRAMES_ORDER = ['verte', 'bleue', 'turquoise', 'brune', 'noire', 'rose'];

export const ANALYSIS_STYLES = {
  alerte: { color: '#D32F2F', fillOpacity: 0.25, strokeOpacity: 0.9, dashArray: '4,3' },
  potentiel: { color: '#F57C00', fillOpacity: 0.2, strokeOpacity: 0.85 },
  bon: { color: '#388E3C', fillOpacity: 0.2, strokeOpacity: 0.85 }
};
