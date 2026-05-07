import { FileText, Search, MousePointerClick } from 'lucide-react';

/**
 * Mode "Rapport" — guide l'utilisateur vers la génération PDF.
 *
 * Le bouton de téléchargement est dans le DetailPanel droit (s'affiche dès
 * qu'une commune est sélectionnée). Ici on explique comment l'invoquer + on
 * liste ce que contient le rapport.
 */
export default function ReportPanel() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 mb-3">
        <FileText size={14} className="text-edena-primary" />
        <h3 className="text-sm font-semibold text-edena-primary">Rapport de commune</h3>
      </div>
      <p className="text-[11px] text-gray-500 leading-snug mb-4">
        Génère un PDF de diagnostic territorial brandé EDENA, prêt à transmettre
        aux élus ou partenaires institutionnels.
      </p>

      <div className="border border-edena-secondary rounded p-3 mb-3 bg-gray-50">
        <div className="text-xs font-medium text-gray-700 mb-2">Comment ça marche</div>
        <ol className="text-[11px] text-gray-600 space-y-1.5 list-none">
          <li className="flex gap-2">
            <span className="shrink-0 w-4 h-4 rounded-full bg-edena-primary text-white text-[9px] font-bold flex items-center justify-center mt-0.5">1</span>
            <span>
              <span className="inline-flex items-center gap-1 font-medium text-gray-800">
                <Search size={10} />Cherchez
              </span>{' '}
              une commune dans la barre du haut, ou cliquez directement sur la carte.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-4 h-4 rounded-full bg-edena-primary text-white text-[9px] font-bold flex items-center justify-center mt-0.5">2</span>
            <span>
              Activez les couches que vous voulez voir détaillées dans le rapport
              (onglet Exploration et/ou Analyse).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-4 h-4 rounded-full bg-edena-primary text-white text-[9px] font-bold flex items-center justify-center mt-0.5">3</span>
            <span>
              <span className="inline-flex items-center gap-1 font-medium text-gray-800">
                <MousePointerClick size={10} />Cliquez
              </span>{' '}
              sur <em>« Télécharger le rapport PDF »</em> en bas du panneau commune
              (à droite).
            </span>
          </li>
        </ol>
      </div>

      <div className="text-xs font-medium text-gray-700 mb-1.5">Contenu du rapport</div>
      <ul className="text-[11px] text-gray-600 space-y-0.5 mb-4">
        <li>• Carte de localisation IGN</li>
        <li>• Identité commune (population, maire, gentilé, mairie…)</li>
        <li>• Indicateurs des trames activées (longueurs, surfaces, comptages)</li>
        <li>• Diagnostic des 6 analyses dérivées sur la commune</li>
        <li>• Recommandations d'action automatisées</li>
        <li>• Mentions légales sources de données</li>
      </ul>

      <div className="text-[10px] text-gray-400 leading-relaxed border-t border-edena-secondary pt-2">
        Le rapport est généré côté navigateur (aucune donnée ne quitte votre poste).
        Le périmètre libre (polygone dessiné) viendra avec la Phase 4 backend.
      </div>
    </div>
  );
}
