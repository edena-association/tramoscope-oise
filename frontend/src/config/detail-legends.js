/**
 * Légendes détaillées par couche.
 *
 * IGN/INPN/Géorisques ne supportent pas GetLegendGraphic, donc on code les
 * nomenclatures en dur. Les couleurs reproduisent au mieux les rendus officiels
 * (OCS GE 2024 IGN, INPN, Géorisques 2025).
 *
 * Structure : `groups: [{ color, label, sub?: [...] }]`. Si sub est défini,
 * c'est un groupe pliable qui détaille les sous-classes.
 */

export const DETAIL_LEGENDS = {
  // -------------------- OCS GE --------------------
  ocsge_couverture: {
    title: 'OCS GE — Couverture du sol (2021-2023)',
    note: 'Nomenclature CS de la Couverture du Sol IGN. Les classes 1.x sont artificialisées, 2.x agricoles, 3.x forestières/naturelles, 4.x eau.',
    groups: [
      { color: '#d11929', label: '1.1.1 — Bâtiments' },
      { color: '#ff95a8', label: '1.1.2 — Surfaces non bâties artificialisées (parkings, voies)' },
      { color: '#cc9f80', label: '1.2 — Sols nus artificialisés' },
      { color: '#fdcc01', label: '2.1 — Cultures (grandes cultures, vignes, vergers)' },
      { color: '#fff9c4', label: '2.2 — Prairies' },
      { color: '#1c8b1c', label: '3.1 — Forêts de feuillus' },
      { color: '#5d8233', label: '3.2 — Forêts de conifères' },
      { color: '#7e9f44', label: '3.3 — Forêts mélangées' },
      { color: '#9bbf6c', label: '3.4 — Landes, friches, lisières' },
      { color: '#cce5cc', label: '3.5 — Sols nus naturels' },
      { color: '#22a4d4', label: '4 — Eau (cours, plans, zones humides)' }
    ]
  },
  ocsge_usage: {
    title: 'OCS GE — Usage du sol (2021-2023)',
    note: 'Nomenclature US — fonction socio-économique du sol (résidentiel, agricole, industriel, etc.).',
    groups: [
      { color: '#e88aa5', label: 'US1.1 — Résidentiel' },
      { color: '#a02050', label: 'US1.2 — Activités économiques (industriel, commercial)' },
      { color: '#666666', label: 'US1.3 — Réseaux de transport' },
      { color: '#bca2da', label: 'US1.4 — Équipements (santé, éducation, sport)' },
      { color: '#fdcc01', label: 'US2 — Production agricole' },
      { color: '#5d8233', label: 'US3 — Production forestière' },
      { color: '#22a4d4', label: 'US4 — Pêche, aquaculture' },
      { color: '#bbb', label: 'US5 — Sols nus, friches sans usage' },
      { color: '#cce5cc', label: 'US6 — Espaces naturels (sans usage productif)' }
    ]
  },
  ocsge_artif: {
    title: 'OCS GE — Artificialisation (2021-2023)',
    note: 'Surfaces classées comme artificialisées au sens du ZAN (Zéro Artificialisation Nette).',
    groups: [
      { color: '#d11929', label: 'Artificialisé (bâti, infrastructures, sols imperméabilisés)' },
      { color: 'transparent', label: 'Non artificialisé (NAF — naturel/agricole/forestier)' }
    ]
  },

  // -------------------- PPRI --------------------
  ppri: {
    title: 'PPRI — Plan de Prévention des Risques Inondation',
    note: 'Zonage réglementaire approuvé par arrêté préfectoral. Source : Géorisques.',
    groups: [
      { color: '#e53935', label: 'Zone rouge — aléa fort, constructions interdites' },
      { color: '#1976d2', label: 'Zone bleue — aléa modéré, prescriptions' },
      { color: '#888', label: 'Zone violette / autres — réglementations spéciales' }
    ]
  },

  // -------------------- INPN --------------------
  znieff_inpn: {
    title: 'ZNIEFF — Zones Naturelles d\'Intérêt Écologique',
    note: 'Inventaire INPN. Outil de connaissance, valeur indicative (pas réglementaire).',
    groups: [
      { color: '#f9a825', label: 'ZNIEFF type I — secteurs de fort intérêt biologique' },
      { color: '#fff59d', label: 'ZNIEFF type II — grands ensembles écologiques' }
    ]
  },
  natura2000: {
    title: 'Natura 2000',
    note: 'Réseau européen de sites protégés. Source : INPN/MNHN.',
    groups: [
      { color: '#1565c0', label: 'ZSC/SIC — Directive Habitats (faune/flore/habitats)' },
      { color: '#0d47a1', label: 'ZPS — Directive Oiseaux' }
    ]
  },

  // -------------------- IGN --------------------
  rpg: {
    title: 'RPG 2024 — Parcelles agricoles',
    note: 'Registre Parcellaire Graphique : parcelles déclarées par les agriculteurs à la PAC. Catégories de cultures sur 28 groupes (céréales, prairies, oléagineux…).',
    groups: [
      { color: '#fdc25b', label: 'Céréales (blé, orge, maïs)' },
      { color: '#a4d65e', label: 'Prairies permanentes / temporaires' },
      { color: '#f9e79f', label: 'Oléagineux (colza, tournesol)' },
      { color: '#f5b7b1', label: 'Légumineuses (pois, féverole)' },
      { color: '#a9cce3', label: 'Cultures industrielles (betterave, lin)' },
      { color: '#d7bde2', label: 'Vergers, vignes, légumes' },
      { color: '#dfe6e9', label: 'Gels et jachères' }
    ]
  },
  rpg_prairies: {
    title: 'RPG 2024 — Prairies permanentes',
    note: 'Sous-ensemble du RPG : prairies > 5 ans en herbe, à fort intérêt pour la biodiversité.',
    groups: [
      { color: '#a4d65e', label: 'Prairie permanente (≥5 ans)' }
    ]
  },
  inra_sols: {
    title: 'Carte des sols INRAE 1/1 000 000',
    note: 'Carte pédologique nationale. Échelle large (1/1M), donc usage stratégique uniquement.',
    groups: [
      { color: '#7e5d3b', label: 'Sols bruns / sols agricoles dominants' },
      { color: '#c4a780', label: 'Sols calcaires / argilo-calcaires' },
      { color: '#d6c19b', label: 'Sols limoneux' },
      { color: '#a08763', label: 'Sols sableux' },
      { color: '#8a6d4a', label: 'Sols hydromorphes (humides)' }
    ]
  },

  // -------------------- Couches dérivées (Phase 3) --------------------
  // Les choroplèthes radiance, artificialisation, connectivité sont déjà
  // détaillées via les `gradient` et `stops` dans Legend.jsx — pas besoin
  // de les répéter ici.
};

/**
 * Récupère la légende détaillée pour une couche (par id de couche).
 * Mapping id → clé dans DETAIL_LEGENDS.
 */
const LAYER_TO_LEGEND = {
  ocsge_couverture: 'ocsge_couverture',
  ocsge_usage: 'ocsge_usage',
  ocsge_artif: 'ocsge_artif',
  ocsge_constructions: 'ocsge_artif',
  ppri: 'ppri',
  znieff1: 'znieff_inpn',
  znieff2: 'znieff_inpn',
  natura_zsc: 'natura2000',
  natura_zps: 'natura2000',
  rpg_2024: 'rpg',
  rpg_prairies: 'rpg_prairies',
  inra_sols: 'inra_sols'
};

export function getDetailLegend(layerId) {
  const key = LAYER_TO_LEGEND[layerId];
  return key ? DETAIL_LEGENDS[key] : null;
}
