# CLAUDE.md — Tramoscope Oise

> **Ce fichier est le document fondateur du projet Tramoscope Oise.**
> Il contient tout le contexte, les spécifications, les sources de données, l'architecture technique, le UX, la DA et le plan de développement.
> Claude Code doit le lire intégralement avant toute action.

---

## 1. Contexte du projet

### EDENA

EDENA est une association loi 1901 d'intérêt général, fondée par Anthony Augier (architecte-paysagiste DPLG) et Théo Le Du (ingénieur paysagiste). EDENA se positionne comme **tiers de confiance territorial** spécialisé dans les **trames écologiques** (verte, bleue, turquoise, brune, noire, rose).

EDENA analyse les dynamiques territoriales par les trames, identifie les zones d'enjeux (ruptures de corridors, chevauchements, potentiels), puis coopère avec les communes concernées pour des résultats opérationnels concrets : amplification, protection, création et gestion des trames.

EDENA ne facture pas les collectivités. L'association est financée par subventions institutionnelles, mécénat, dons et cotisations.

### Le Tramoscope

Le Tramoscope est **l'outil central d'EDENA** : une carte interactive multi-trames permettant une lecture paysagère territoriale. Il sert à :

1. **Analyser** les dynamiques de trames à l'échelle d'un département
2. **Identifier** les zones d'enjeux (ruptures, pas japonais potentiels, conflits entre trames)
3. **Produire** des diagnostics territoriaux pour les rencontres institutionnelles
4. **Démontrer** la crédibilité technique d'EDENA auprès des partenaires

Le premier déploiement cible le **département de l'Oise (60)**, choisi après un audit de disponibilité des données sur 19 départements (voir `../EDENA_audit-donnees-departements.xlsx`). L'Oise obtient un score de complétude de 95%, avec un territoire rural/périurbain offrant des enjeux réels de corridors écologiques.

### Pourquoi l'Oise

- OCS GE disponible (millésimes 2017 et 2020)
- Données SRADDET Hauts-de-France de bonne qualité (Geo2France)
- Territoire mixte rural/périurbain avec corridors écologiques majeurs
- Proximité Paris (~1h)
- CAUE 60 comme partenaire naturel
- Richesse hydrographique (Oise, Thérain, Automne, Aisne en limite)

### Nomenclature

- L'outil s'appelle **tramoscope-oise** (minuscules, tiret)
- Chaque département aura son instance : tramoscope-oise, tramoscope-seine-et-marne, etc.
- Le nom public affiché est **Tramoscope — Oise**

---

## 2. Architecture technique

### Stack

| Composant | Technologie | Justification |
|-----------|------------|---------------|
| **Frontend** | React 18 + Vite | Performant, écosystème riche, familier |
| **Cartographie** | Leaflet 1.9 + react-leaflet | Support WMS/WFS natif, plugins riches, doc mature |
| **Analyse spatiale client** | Turf.js | Buffers, intersections, mesures côté client |
| **Analyse spatiale serveur** | Python + GeoPandas + Shapely | Analyses lourdes (graphe connectivité, least-cost path) |
| **API backend** | FastAPI (Python) | Léger, async, auto-documentation OpenAPI |
| **Données statiques** | GeoJSON + GeoPackage | Données pré-traitées pour chargement rapide |
| **Données distantes** | WMS / WFS / WMTS | Flux IGN, INPN, GPU, Georisques en temps réel |
| **Génération PDF** | WeasyPrint (Python) | Rapports de zone automatisés |
| **Style** | Tailwind CSS | Utilitaire, rapide, cohérent |
| **Déploiement** | Docker + Docker Compose | Reproductible, déployable sur VPS edena.eco |

### Structure du projet

```
Tramoscope_Oise/
├── CLAUDE.md                    # Ce fichier
├── docker-compose.yml
├── .env.example
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── public/
│   │   └── favicon.ico
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── config/
│       │   ├── layers.js          # Définition de toutes les couches cartographiques
│       │   ├── trames.js          # Configuration des 6 trames (couleurs, sources, seuils)
│       │   └── analysis.js        # Paramètres des analyses (seuils configurables)
│       ├── components/
│       │   ├── Map/
│       │   │   ├── MapContainer.jsx
│       │   │   ├── LayerControl.jsx
│       │   │   ├── BasemapSwitcher.jsx
│       │   │   └── Legend.jsx
│       │   ├── Sidebar/
│       │   │   ├── Sidebar.jsx
│       │   │   ├── TramePanel.jsx
│       │   │   ├── AnalysisPanel.jsx
│       │   │   └── ZoneReportPanel.jsx
│       │   ├── Analysis/
│       │   │   ├── DrawTools.jsx
│       │   │   ├── AnalysisResults.jsx
│       │   │   └── CorridorAnalysis.jsx
│       │   └── UI/
│       │       ├── Header.jsx
│       │       ├── LoadingOverlay.jsx
│       │       └── InfoTooltip.jsx
│       ├── hooks/
│       │   ├── useMap.js
│       │   ├── useLayers.js
│       │   └── useAnalysis.js
│       ├── services/
│       │   ├── api.js             # Appels au backend FastAPI
│       │   ├── wms.js             # Gestion des flux WMS/WFS
│       │   └── export.js          # Export PDF via backend
│       ├── utils/
│       │   ├── spatial.js         # Helpers Turf.js
│       │   ├── colors.js          # Palettes par trame
│       │   └── format.js          # Formatage données
│       └── styles/
│           └── globals.css
│
├── backend/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── app/
│       ├── main.py               # FastAPI app
│       ├── config.py             # Chemins, seuils, constantes
│       ├── routers/
│       │   ├── analysis.py       # Endpoints d'analyse spatiale
│       │   ├── data.py           # Endpoints de données
│       │   └── report.py         # Génération de rapports PDF
│       ├── services/
│       │   ├── corridor.py       # Analyse de corridors (ruptures, least-cost)
│       │   ├── connectivity.py   # Graphe de connectivité paysagère
│       │   ├── stepping_stones.py # Détection pas japonais
│       │   ├── light_pollution.py # Analyse trame noire
│       │   ├── riparian.py       # Analyse ripisylves (trame turquoise)
│       │   └── pollination.py    # Déserts pollinisateurs (trame rose)
│       ├── models/
│       │   └── schemas.py        # Pydantic models
│       └── utils/
│           ├── geo.py            # Helpers géospatiaux
│           └── pdf.py            # Template rapport PDF
│
├── data/
│   ├── README.md                 # Instructions de téléchargement et préparation
│   ├── scripts/
│   │   ├── download_all.sh       # Script maître de téléchargement
│   │   ├── download_ocsge.py     # Téléchargement OCS GE Oise
│   │   ├── download_bdforet.py
│   │   ├── download_bdtopage.py
│   │   ├── download_znieff.py
│   │   ├── download_natura2000.py
│   │   ├── download_rpg.py
│   │   ├── download_roe.py
│   │   ├── download_srce.py      # SRCE/SRADDET Hauts-de-France
│   │   ├── download_zones_humides.py  # Zones humides (RPDZH + Artois-Picardie)
│   │   ├── download_viirs.py     # Radiance nocturne
│   │   ├── download_enaf.py      # Artificialisation Cerema
│   │   ├── download_clc.py       # Corine Land Cover
│   │   ├── prepare_data.py       # Découpage par département, simplification, conversion GeoJSON
│   │   └── generate_analysis_layers.py  # Pré-calcul des couches d'analyse
│   ├── raw/                      # Données brutes téléchargées (gitignored)
│   ├── processed/                # Données traitées, découpées Oise (gitignored)
│   └── config/
│       └── sources.json          # Catalogue des sources avec URLs et métadonnées
│
└── docs/
    ├── architecture.md
    ├── data-sources.md
    └── deployment.md
```

### Principes d'architecture

1. **Séparation données statiques / flux dynamiques** : les données lourdes (OCS GE, BD Forêt, SRCE) sont téléchargées, traitées et servies en GeoJSON statique. Les données légères ou à jour (ZNIEFF, Natura 2000, fond topo IGN) sont consommées en flux WMS/WMTS.

2. **Progressive loading** : les couches ne se chargent que quand l'utilisateur les active. Les GeoJSON lourds sont découpés en tuiles ou simplifiés selon le niveau de zoom.

3. **Analyse hybride** : les analyses simples (buffers, mesures) sont côté client (Turf.js). Les analyses complexes (graphe de connectivité, least-cost path) sont côté serveur (Python).

4. **Configuration centralisée** : tous les seuils d'analyse, les URLs de flux, les couleurs sont dans des fichiers de config, pas hardcodés dans les composants.

---

## 3. Sources de données — Catalogue complet

### 3.1 Données à télécharger (statiques, pré-traitées)

| Source | Trame(s) | URL de téléchargement | Format | Fréquence MAJ |
|--------|----------|----------------------|--------|----------------|
| **OCS GE** — Oise (60) | Verte, Turquoise, Brune, Rose | `https://geoservices.ign.fr/telechargement-api/OCSGE?zone=D060` | SHP (.7z) | ~3 ans |
| **BD Forêt** — Oise | Verte, Rose | `https://geoservices.ign.fr/bdforet` (téléchargement par département) | SHP | ~5 ans |
| **RPG** — Oise | Rose, Verte | `https://geoservices.ign.fr/rpg` (millésime 2024, par département) | GeoPackage | Annuel |
| **BD TOPAGE** — métropole | Bleue, Turquoise | `https://www.data.gouv.fr/datasets/cours-deau-metropole-2025-bd-topage-r` | SHP/GeoJSON | Annuel |
| **ROE** (obstacles écoulement) | Bleue | `https://www.data.gouv.fr/datasets/obstacles-a-lecoulement-issus-du-roe-en-france-metropole` | SHP/GeoJSON | Continu |
| **SRCE/SRADDET HdF** — corridors TVB | Verte, Bleue | `https://www.geo2france.fr/geonetwork/` → rechercher "SRADDET" + "continuité écologique" | SHP | Stable (2020) |
| **VIIRS-DNB** (radiance nocturne) | Noire | `https://eogdata.mines.edu/products/vnl/` | GeoTIFF | Annuel |
| **Éclairage nocturne communes** | Noire | `https://www.data.gouv.fr/datasets/cartographie-nationale-des-pratiques-declairage-nocturne` | CSV/GeoJSON | Annuel |
| **ENAF Cerema** (artificialisation) | Brune | `https://artificialisation.developpement-durable.gouv.fr/` → téléchargement SHP | SHP | Annuel |
| **Admin Express** (communes, EPCI) | Transversal | `https://geoservices.ign.fr/adminexpress` | SHP/GeoPackage | Annuel |
| **Zones humides** (RPDZH + Artois-Picardie) | Bleue, Turquoise | `https://sig.reseau-zones-humides.org/` (WFS) + Agence Artois-Picardie | SHP/GeoJSON | Variable |
| **Corine Land Cover** | Verte, Rose | `https://land.copernicus.eu/pan-european/corine-land-cover` | GeoPackage | ~6 ans |

### 3.2 Données en flux WMS/WMTS/WFS (temps réel)

| Source | Trame(s) | URL du service | Type | Layer/couche |
|--------|----------|---------------|------|-------------|
| **IGN Plan topographique** | Fond de carte | `https://data.geopf.fr/wmts` | WMTS | `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2` |
| **IGN Orthophotos** | Fond de carte | `https://data.geopf.fr/wmts` | WMTS | `ORTHOIMAGERY.ORTHOPHOTOS` |
| **ZNIEFF type I** | Verte | `https://ws.carmencarto.fr/WMS/119/fxx_inpn` | WMS | `ZNIEFF1` |
| **ZNIEFF type II** | Verte | `https://ws.carmencarto.fr/WMS/119/fxx_inpn` | WMS | `ZNIEFF2` |
| **Natura 2000 — ZSC** | Verte | `https://ws.carmencarto.fr/WMS/119/fxx_inpn` | WMS | `SIC` |
| **Natura 2000 — ZPS** | Verte | `https://ws.carmencarto.fr/WMS/119/fxx_inpn` | WMS | `ZPS` |
| **PLU/PLUi** (GPU) | Transversal | `https://data.geopf.fr/wms-v/ows` | WMS | GPU layers |
| **PPRI** (Georisques) | Bleue, Turquoise | `https://georisques.gouv.fr/services` → WMS | WMS | Zonage réglementaire PPR |
| **Carte des sols** (1/250k) | Brune | `https://data.geopf.fr/wms-r/wms` | WMS | Carte pédologique |
| **TVB nationale** (INPN) | Verte, Bleue | `https://ws.carmencarto.fr/WMS/119/fxx_inpn` | WMS | Couches TVB nationales |

### 3.3 Données dérivées (calculées par nos scripts)

| Donnée dérivée | Source(s) | Méthode | Trame |
|---------------|-----------|---------|-------|
| Zones de rupture de corridors | SRCE + OCS GE | Analyse de graphe + least-cost path | Verte |
| Pas japonais potentiels | OCS GE + BD Forêt | Détection fragments 0.1–5 ha isolés (<500m du corridor) | Verte |
| Score de connectivité | SRCE + OCS GE + BD Forêt | Graphe paysager (Graphab / méthode équivalente) | Verte |
| Ruptures ripisylves | BD TOPAGE + OCS GE | Buffer 10m cours d'eau, intersection occupation sol | Turquoise |
| Déserts pollinisateurs | RPG + OCS GE | Zones >50 ha sans habitat semi-naturel à <300m | Rose |
| Conflits éclairage/biodiversité | VIIRS + ZNIEFF/Natura2000 | Superposition radiance >5 nW/cm²/sr avec zones naturelles | Noire |

---

## 4. Spécification UX

### 4.1 Les trois modes

Le Tramoscope propose trois modes d'interaction, accessibles par onglets dans la sidebar gauche :

#### MODE 1 — Exploration

**Objectif** : naviguer librement sur la carte, activer/désactiver les couches par trame.

- Panneau latéral gauche avec les 6 trames, chacune pliable/dépliable
- Chaque trame contient ses sous-couches avec toggle on/off
- Au survol d'une entité : tooltip avec informations clés
- Au clic : panneau détail avec toutes les métadonnées
- Barre de recherche pour localiser une commune, une adresse, un lieu-dit
- Switcher de fond de carte : Plan IGN / Orthophoto / Neutre (fond clair minimal)

**Couches par trame en mode exploration :**

**Trame verte** :
- Réservoirs de biodiversité (SRCE/SRADDET)
- Corridors écologiques (SRCE/SRADDET)
- ZNIEFF type I (WMS INPN)
- ZNIEFF type II (WMS INPN)
- Natura 2000 ZSC (WMS INPN)
- Natura 2000 ZPS (WMS INPN)
- BD Forêt (massifs forestiers)
- OCS GE — espaces naturels

**Trame bleue** :
- Cours d'eau (BD TOPAGE)
- Obstacles à l'écoulement (ROE) — points
- Zones humides (quand données disponibles)
- PPRI — zonage réglementaire (WMS Georisques)
- Corridors aquatiques (SRCE/SRADDET sous-trame bleue)

**Trame turquoise** :
- Ripisylves (dérivé BD TOPAGE + OCS GE)
- Zones humides
- PPRI
- Interfaces terre/eau (dérivé OCS GE)

**Trame brune** :
- Carte pédologique (WMS IGN)
- OCS GE — sols artificialisés
- ENAF Cerema — dynamiques d'artificialisation

**Trame noire** :
- Radiance nocturne VIIRS (raster)
- Pratiques d'éclairage par commune
- Zones de conflits éclairage/biodiversité (dérivé)

**Trame rose** :
- RPG — cultures et prairies
- OCS GE — mosaïques agricoles
- BD Forêt — lisières
- Déserts pollinisateurs (dérivé)

**Couches transversales** (toujours disponibles) :
- Limites communales + EPCI (Admin Express)
- PLU/PLUi (WMS GPU) — activable
- SCOT (WMS GPU) — activable
- Fond topographique IGN (WMTS)

#### MODE 2 — Analyse ponctuelle

**Objectif** : dessiner une zone et obtenir des résultats d'analyse instantanés.

- L'utilisateur dessine un polygone, un cercle, ou un rectangle sur la carte
- Ou sélectionne une commune par clic
- Le système analyse automatiquement la zone :
  - Surface par type d'occupation du sol (OCS GE)
  - Nombre et longueur des cours d'eau traversants
  - Nombre d'obstacles à l'écoulement
  - Surface de ZNIEFF / Natura 2000 dans le périmètre
  - Niveau moyen de radiance nocturne
  - Présence de corridors SRCE et état de continuité
  - Part de surfaces artificialisées et dynamique

- Résultats affichés dans un panneau latéral avec graphiques (barres, camemberts)
- Possibilité d'exporter les résultats en PNG ou de basculer en mode rapport

#### MODE 3 — Rapport de zone

**Objectif** : générer un diagnostic PDF complet pour une zone donnée.

- L'utilisateur délimite un périmètre (polygone libre ou sélection de communes)
- Le backend génère un rapport PDF automatisé contenant :
  - Carte de localisation
  - Carte des trames actives sur la zone
  - Tableau de synthèse : surface, occupation du sol, enjeux par trame
  - Identification des ruptures de corridors
  - Identification des pas japonais potentiels
  - Analyse de connectivité
  - État des cours d'eau et obstacles
  - Niveau de pollution lumineuse
  - Présence de déserts pollinisateurs
  - Données réglementaires (PLU, PPRI, ZNIEFF, Natura 2000)
  - Cartographie des enjeux prioritaires
  - Recommandations automatiques (texte généré selon les résultats)

- Le rapport est téléchargeable en PDF
- Il est brandé EDENA (logo, couleurs, mentions légales données)

### 4.2 Symbologie et couleurs des trames

Chaque trame a une couleur identitaire utilisée pour tous ses éléments cartographiques :

| Trame | Couleur principale | Hex | Opacité remplissage | Opacité contour |
|-------|-------------------|-----|---------------------|-----------------|
| Verte | Vert forêt | `#2E7D32` | 0.3 | 0.8 |
| Bleue | Bleu eau | `#1565C0` | 0.3 | 0.8 |
| Turquoise | Turquoise | `#00897B` | 0.3 | 0.8 |
| Brune | Brun terre | `#6D4C41` | 0.3 | 0.8 |
| Noire | Violet foncé | `#4A148C` | 0.3 | 0.8 |
| Rose | Rose vif | `#C2185B` | 0.3 | 0.8 |

Les couches d'analyse (résultats de calcul) utilisent un style distinctif :
- **Alerte / rupture** : contour rouge `#D32F2F`, remplissage rouge semi-transparent, hachures
- **Potentiel / opportunité** : contour orange `#F57C00`, remplissage orange léger
- **Bon état** : contour vert `#388E3C`, remplissage vert léger

### 4.3 Interaction et ergonomie

- **Sidebar gauche** : 320px, repliable. Contient les modes (onglets), les contrôles de couches, les résultats d'analyse
- **Header** : logo EDENA, nom "Tramoscope — Oise", switcher de fond de carte
- **Carte** : occupe tout l'espace restant
- **Tooltip au survol** : compact, 2-3 lignes max (nom, type, surface ou longueur)
- **Panel de détail au clic** : slide-in depuis la droite, toutes les métadonnées
- **Barre de recherche** : en haut de la sidebar, geocoding via API IGN
- **Échelle** et **zoom** : en bas à droite
- **Légende dynamique** : en bas à gauche, ne montre que les couches actives

---

## 5. Méthodes d'analyse — Spécifications scientifiques

### 5.1 Détection de ruptures de corridors (Trame verte)

**Méthode** : analyse de continuité sur le graphe des réservoirs de biodiversité.

1. Charger les réservoirs SRCE comme nœuds du graphe
2. Charger les corridors SRCE comme arêtes
3. Identifier les arêtes coupées par de l'urbanisation ou des infrastructures (intersection OCS GE classes artificialisées)
4. Pour chaque rupture :
   - Calculer la distance de la rupture (longueur du segment artificialisé)
   - Calculer le chemin de moindre coût (least-cost path) à travers la rupture
   - Classer la sévérité : légère (<500m), modérée (500m-2km), critique (>2km)

**Seuils** :
- Distance max entre 2 réservoirs pour considérer une connexion potentielle : **5 km**
- Résolution du raster de coût : **25m** (basé sur OCS GE)
- Coûts de friction par type d'occupation :
  - Espace naturel : 1
  - Espace agricole extensif (prairie, jachère) : 5
  - Espace agricole intensif (grande culture) : 20
  - Zone artificialisée perméable (jardin, parc) : 50
  - Infrastructure linéaire (route, voie ferrée) : 200
  - Zone artificialisée imperméable (bâti, parking) : 1000

### 5.2 Détection de pas japonais (Trame verte)

**Méthode** : identification des fragments d'habitat semi-naturel isolés entre deux réservoirs.

1. Extraire les fragments de végétation naturelle/semi-naturelle de l'OCS GE et BD Forêt
2. Filtrer par taille : **0.1 ha ≤ surface ≤ 5 ha**
3. Pour chaque fragment, vérifier s'il se situe à **moins de 500m** d'un corridor SRCE ou d'un autre fragment
4. Classer les fragments :
   - **Actif** : dans un alignement de fragments espacés de <500m formant un chapelet
   - **Isolé** : fragment seul sans voisin à <1km
   - **Potentiel** : fragment à <500m d'un corridor mais isolé des autres fragments

### 5.3 Score de connectivité paysagère (Trame verte)

**Méthode** : approche inspirée de Graphab (Foltête et al., 2012).

1. Construire un graphe paysager : nœuds = patches d'habitat (>1 ha), arêtes = distances entre patches
2. Calculer des métriques de connectivité :
   - **PC** (Probability of Connectivity) : probabilité qu'un organisme se déplaçant aléatoirement atteigne un autre patch
   - **dPC** : contribution de chaque patch à la connectivité globale (permet d'identifier les patches critiques)
3. Distance de dispersion médiane utilisée : **1000m** (paramétrable selon le groupe d'espèces cible)
4. Afficher un score normalisé 0-100 par maille hexagonale de 1 km²

### 5.4 Ruptures de ripisylves (Trame turquoise)

**Méthode** : analyse de la couverture arborée en zone tampon des cours d'eau.

1. Créer un buffer de **10m** de chaque côté des cours d'eau BD TOPAGE
2. Intersecter avec l'OCS GE
3. Identifier les tronçons où le buffer est occupé par des surfaces artificialisées ou agricoles intensives
4. Classer :
   - **Ripisylve présente** : >70% de couverture arborée/arbustive dans le buffer
   - **Ripisylve dégradée** : 30-70%
   - **Ripisylve absente** : <30%

### 5.5 Déserts pollinisateurs (Trame rose)

**Méthode** : détection des zones sans ressource florale ni habitat de nidification.

1. Identifier les zones d'habitat favorable aux pollinisateurs : prairies, jachères, lisières forestières, haies, friches (via RPG + OCS GE)
2. Créer un buffer de **300m** autour de chaque zone favorable (rayon de butinage médian abeille sauvage)
3. Identifier les zones de **plus de 50 ha** non couvertes par ces buffers = **déserts pollinisateurs**
4. Classer par sévérité :
   - Modéré : 50-200 ha
   - Sévère : 200-500 ha
   - Critique : >500 ha

### 5.6 Analyse pollution lumineuse (Trame noire)

**Méthode** : croisement radiance satellite et enjeux biodiversité.

1. Charger le raster VIIRS-DNB (radiance en nW/cm²/sr)
2. Seuil de pollution lumineuse significative : **5 nW/cm²/sr**
3. Croiser avec les zones d'enjeux biodiversité (ZNIEFF, Natura 2000, corridors SRCE)
4. Identifier les zones de conflit : radiance > seuil ET zone naturelle d'enjeu
5. Enrichir avec les données d'éclairage communal (extinction nocturne, horaires)
6. Classer :
   - **Zone noire préservée** : radiance < 2 nW/cm²/sr
   - **Zone de transition** : 2-5 nW/cm²/sr
   - **Zone polluée** : 5-20 nW/cm²/sr
   - **Zone très polluée** : >20 nW/cm²/sr

---

## 6. Direction artistique

### Identité EDENA

- **Couleur principale** : `#0B2966` (bleu nuit profond)
- **Couleur secondaire** : `#E4E2DD` (gris clair chaud)
- **Typographie** : Rethink Sans (Google Fonts, variable, gratuite)
- **Fallback** : Inter, system-ui, sans-serif
- **Ton** : sobre, minimaliste, professionnel. Pas de fioritures, pas de gradients décoratifs, pas d'animations superflues.

### Application au Tramoscope

- **Header** : fond `#0B2966`, texte blanc, logo EDENA (héron stylisé) à gauche
- **Sidebar** : fond blanc, séparateurs fins `#E4E2DD`
- **Carte** : bords arrondis 0, pas d'ombre portée. La carte est l'élément central.
- **Boutons** : arrondis 6px, fond `#0B2966` pour les primaires, contour `#0B2966` pour les secondaires
- **Toggle de couche** : petit switch rond, couleur de la trame quand actif
- **Icônes** : Lucide Icons (style linéaire fin, cohérent avec le minimalisme)
- **États hover** : léger assombrissement, pas de changement de taille
- **Responsive** : l'outil est pensé desktop-first (usage professionnel), mais doit rester lisible sur tablette

### Logo et branding dans l'interface

- Logo EDENA : illustration de héron en vol (fichier PNG source dans `05_COMMUNICATION/Identite-visuelle/DA ASSO/`). Pour le header, utiliser une version monochrome blanche du héron en SVG simplifié. Le PNG couleur est utilisé dans les rapports PDF et les pages de présentation.
- Logo en haut à gauche du header (SVG monochrome blanc sur fond bleu)
- Le mot "Tramoscope" en Rethink Sans semibold, suivi de " — Oise" en regular
- En footer de la sidebar : "EDENA — Tiers de confiance territorial" en petit
- Dans les rapports PDF : logo couleur, mentions de crédits données

---

## 7. Configuration des seuils

Tous les seuils d'analyse sont centralisés dans `frontend/src/config/analysis.js` et `backend/app/config.py`. Ils doivent être **identiques** entre frontend et backend.

```javascript
// frontend/src/config/analysis.js
export const ANALYSIS_THRESHOLDS = {
  corridorRupture: {
    maxDistanceReservoirs: 5000,      // mètres
    rasterResolution: 25,             // mètres
    severityThresholds: {
      light: 500,                     // mètres
      moderate: 2000,
      critical: Infinity
    },
    frictionCosts: {
      natural: 1,
      extensiveAgriculture: 5,
      intensiveAgriculture: 20,
      permeableUrban: 50,
      linearInfrastructure: 200,
      impermeableUrban: 1000
    }
  },
  steppingStones: {
    minArea: 0.1,                     // hectares
    maxArea: 5,                       // hectares
    maxDistanceToCorridor: 500,       // mètres
    maxDistanceBetweenFragments: 500, // mètres
    isolationThreshold: 1000          // mètres
  },
  connectivity: {
    dispersalDistance: 1000,           // mètres (paramétrable)
    minPatchSize: 1,                  // hectares
    gridCellSize: 1000                // mètres (maille hexagonale)
  },
  riparianRupture: {
    bufferWidth: 10,                  // mètres de chaque côté
    presentThreshold: 0.7,            // >70% couverture arborée
    degradedThreshold: 0.3,           // 30-70%
    absentThreshold: 0.3              // <30%
  },
  pollinationDesert: {
    foragingRadius: 300,              // mètres
    minDesertArea: 50,                // hectares
    severityModerate: 200,            // hectares
    severitySevere: 500               // hectares
  },
  lightPollution: {
    significantThreshold: 5,          // nW/cm²/sr
    preservedMax: 2,
    transitionMax: 5,
    pollutedMax: 20
  }
};
```

---

## 8. Plan de développement

### Phase 1 — Infrastructure et données (priorité immédiate)

**Objectif** : pouvoir afficher une carte avec des données réelles de l'Oise.

1. Initialiser le projet (Vite + React + Tailwind + Leaflet)
2. Créer la structure de fichiers complète
3. Implémenter le composant Map de base avec fond IGN WMTS
4. Écrire les scripts de téléchargement de données (Python)
5. Télécharger et préparer les données Oise :
   - Admin Express (communes, EPCI Oise)
   - OCS GE Oise
   - BD Forêt Oise
   - BD TOPAGE (découpage bassin Oise)
   - SRCE/SRADDET Hauts-de-France
6. Convertir en GeoJSON simplifié et optimisé par zoom
7. Afficher les premières couches sur la carte

**Livrable** : carte interactive avec fond IGN + limites communales + 1-2 couches de données

### Phase 2 — Mode Exploration complet

**Objectif** : toutes les couches des 6 trames navigables.

1. Sidebar avec panneau par trame et toggles
2. Intégration de toutes les couches WMS (ZNIEFF, Natura 2000, PLU, PPRI)
3. Intégration des couches GeoJSON (OCS GE, BD Forêt, SRCE, RPG, ROE)
4. Tooltip au survol et panneau de détail au clic
5. Switcher de fond de carte (Plan IGN / Orthophoto / Neutre)
6. Barre de recherche (geocoding IGN)
7. Légende dynamique
8. Couche VIIRS (raster trame noire)

**Livrable** : Tramoscope Exploration pleinement fonctionnel avec les 6 trames

### Phase 3 — Backend et analyses

**Objectif** : le backend Python et les premières analyses.

1. Setup FastAPI + Docker
2. Scripts de pré-calcul des couches d'analyse :
   - Ruptures de corridors
   - Pas japonais
   - Ruptures ripisylves
   - Déserts pollinisateurs
   - Conflits éclairage/biodiversité
3. Endpoints API pour analyses à la volée (polygone utilisateur)
4. Intégration frontend : mode Analyse ponctuelle
5. Graphiques de résultats (barres, camemberts) dans la sidebar

**Livrable** : modes Exploration + Analyse ponctuelle fonctionnels

### Phase 4 — Rapports et polish

**Objectif** : mode Rapport de zone + finitions.

1. Génération de rapport PDF (WeasyPrint)
2. Template PDF brandé EDENA
3. Mode Rapport de zone dans le frontend
4. Score de connectivité paysagère (Graphab-like)
5. Optimisation performances (lazy loading, simplification géométries par zoom)
6. Tests sur données réelles Oise
7. Déploiement Docker sur VPS edena.eco

**Livrable** : Tramoscope complet, déployé, prêt pour les rencontres institutionnelles

### Stratégie de déploiement continu

**Contrainte critique** : Anthony (co-fondateur) doit pouvoir utiliser l'outil pendant l'absence de Théo (Vietnam, 11-20 mai). Le déploiement doit être automatique dès la fin de la Phase 1.

**Architecture de déploiement :**

1. **Code source** : repo GitHub privé (`edena-asso/tramoscope-oise`)
2. **Frontend** : déployé sur **Vercel** (gratuit, déploiement auto sur `git push`)
   - URL temporaire : `tramoscope-oise.vercel.app`
   - URL finale : `tramoscope.edena.eco` (via CNAME DNS sur edena.eco)
3. **Backend** : déployé sur **Railway** ou **Render** (free tier, déploiement auto)
   - URL : `tramoscope-api.railway.app` (ou équivalent)
4. **Données statiques** : les GeoJSON traités sont inclus dans le build frontend (dossier `public/data/`) pour les couches légères. Les couches lourdes sont servies par le backend.
5. **Migration future** : quand le trafic ou les besoins le justifient, migration vers Docker sur VPS edena.eco

**Setup en 3 étapes :**
```bash
# 1. Créer le repo GitHub
gh repo create edena-asso/tramoscope-oise --private

# 2. Connecter Vercel
# → vercel.com → Import Git Repository → edena-asso/tramoscope-oise
# → Root Directory: frontend/
# → Build Command: npm run build
# → Output Directory: dist/

# 3. Connecter Railway (backend)
# → railway.app → New Project → Deploy from GitHub → edena-asso/tramoscope-oise
# → Root Directory: backend/
# → Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Résultat** : chaque `git push` sur `main` déploie automatiquement le frontend et le backend. Anthony accède à l'outil via une simple URL dans son navigateur, sans rien installer.

---

## 9. Contraintes et règles de développement

### Performance

- Le chargement initial de la carte doit prendre **moins de 3 secondes**
- Les couches GeoJSON lourdes (>5 MB) doivent être simplifiées par niveau de zoom (utiliser tippecanoe ou mapshaper)
- Les flux WMS doivent utiliser le paramètre `BBOX` pour ne charger que la zone visible
- Le backend doit répondre en **moins de 5 secondes** pour les analyses sur une commune, **moins de 30 secondes** pour un rapport complet

### Qualité du code

- TypeScript serait idéal mais pas obligatoire pour le MVP — JavaScript avec JSDoc est acceptable
- Composants React fonctionnels, hooks, pas de classes
- Backend Python avec type hints et docstrings
- Pas de console.log en production
- Variables d'environnement pour toutes les URLs et clés

### Données

- **Jamais committer les données brutes dans Git** — le dossier `data/raw/` et `data/processed/` sont dans `.gitignore`
- Le `data/README.md` explique comment reproduire le téléchargement et le traitement
- Toutes les sources de données ont une licence ouverte — mentionner les attributions dans l'interface et les rapports
- Le fichier `data/config/sources.json` est le catalogue exhaustif avec URLs, licences, dates

### Mentions légales / attributions

Afficher en bas de la carte et dans les rapports PDF :
```
Données : IGN (OCS GE, BD Forêt, BD TOPAGE, Admin Express, RPG, Plan IGN) — Licence ouverte Etalab 2.0
INPN (ZNIEFF, Natura 2000, TVB) — Licence ouverte
Georisques (PPRI) — Licence ouverte
GPU (PLU, SCOT) — Licence ouverte
VIIRS (Earth Observation Group, Colorado School of Mines)
Cerema (ENAF, artificialisation)
GIS Sol / INRAE (carte pédologique)
OFB / Sandre (BD TOPAGE, ROE)
Région Hauts-de-France (SRADDET 2020)
```

---

## 10. Variables d'environnement

```env
# .env.example

# IGN Géoplateforme
VITE_IGN_WMTS_URL=https://data.geopf.fr/wmts
VITE_IGN_WMS_URL=https://data.geopf.fr/wms-r/wms

# INPN
VITE_INPN_WMS_URL=https://ws.carmencarto.fr/WMS/119/fxx_inpn

# GPU (Géoportail de l'Urbanisme)
VITE_GPU_WMS_URL=https://data.geopf.fr/wms-v/ows

# Georisques
VITE_GEORISQUES_WMS_URL=https://georisques.gouv.fr/services

# Backend (local)
VITE_API_URL=http://localhost:8000

# Backend (production — mettre l'URL Railway/Render)
# VITE_API_URL=https://tramoscope-api.railway.app

BACKEND_DATA_DIR=./data/processed
BACKEND_REPORTS_DIR=./data/reports
```

**Note Vercel** : les variables `VITE_*` doivent aussi être configurées dans le dashboard Vercel (Settings → Environment Variables) pour le build de production.

---

## 11. Ce qu'il ne faut PAS faire

- **Pas de Streamlit** — c'est un outil de prototypage, pas une app de production
- **Pas de base de données relationnelle** pour le MVP — les GeoJSON et GeoPackage suffisent
- **Pas de système d'authentification** — l'outil est public
- **Pas de modification de données par l'utilisateur** — lecture seule
- **Pas de parsing de PDF** de PLU/SCOT — on utilise les flux WMS du GPU pour les données spatiales et on affiche un lien vers le document sur le GPU pour la consultation
- **Pas d'IA/LLM** dans le MVP — les analyses sont déterministes, les recommandations du rapport sont template-based
- **Pas de fonctionnalités sociales** (commentaires, partage, comptes utilisateurs)
- **Pas de temps réel** (notifications, websockets)
- **Pas de mobile-first** — l'outil est desktop professionnel d'abord

---

## 12. Commandes de référence

```bash
# Frontend
cd frontend
npm install
npm run dev          # Dev server sur :5173

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload  # Dev server sur :8000

# Données
cd data/scripts
python download_all.py         # Télécharge toutes les sources
python prepare_data.py         # Découpe et convertit pour l'Oise

# Docker (production)
docker-compose up --build      # Lance frontend + backend

# Tests
cd frontend && npm run test
cd backend && pytest
```

---

## 13. Glossaire

| Terme | Définition |
|-------|-----------|
| **Trame verte** | Réseau de continuités écologiques terrestres (forêts, haies, prairies, etc.) |
| **Trame bleue** | Réseau de continuités écologiques aquatiques (cours d'eau, zones humides) |
| **Trame turquoise** | Interface terre-eau : ripisylves, berges, zones d'interface |
| **Trame brune** | Réseau de sols vivants et fonctionnels (non artificialisés) |
| **Trame noire** | Réseau de zones préservées de la pollution lumineuse pour la faune nocturne |
| **Trame rose** | Réseau de zones favorables aux pollinisateurs |
| **TVB** | Trame Verte et Bleue — politique nationale inscrite au code de l'environnement |
| **SRCE** | Schéma Régional de Cohérence Écologique (remplacé par le volet biodiversité du SRADDET) |
| **SRADDET** | Schéma Régional d'Aménagement, de Développement Durable et d'Égalité des Territoires |
| **OCS GE** | Occupation du Sol à Grande Échelle (IGN) — base vectorielle nationale |
| **ZNIEFF** | Zone Naturelle d'Intérêt Écologique, Faunistique et Floristique |
| **ROE** | Référentiel des Obstacles à l'Écoulement |
| **PPRI** | Plan de Prévention des Risques Inondation |
| **GPU** | Géoportail de l'Urbanisme |
| **RPG** | Registre Parcellaire Graphique (données agricoles PAC) |
| **ENAF** | Espaces Naturels, Agricoles et Forestiers (suivi artificialisation) |
| **BD TOPAGE** | Base de Données sur la TOPographie des cours d'eau |
| **Pas japonais** | Fragments d'habitat espacés permettant aux espèces de se déplacer par bonds |
| **Least-cost path** | Chemin de moindre coût à travers un paysage (pondéré par la friction des habitats) |
| **Graphab** | Logiciel de modélisation de la connectivité paysagère (Foltête et al., 2012) |

---

*Document rédigé le 6 mai 2026 — Session EDENA 13*
*À mettre à jour au fil du développement*
