'use client'

/**
 * Section "Communication"
 *
 * Templates d'email envoyés depuis le CRM (SMTP Google Workspace).
 * Réutilise le composant EmailTemplatesTab existant sous /components/parametres/.
 *
 * Retour Maxine 2026-04-22 : bonne structure, mais rendre plus lisible
 * et plus simple d'utilisation. Polish cosmétique ici — l'éditeur
 * lui-même reste dans EmailTemplatesTab.
 */

import * as React from 'react'
import { EmailTemplatesTab } from '@/components/parametres/email-templates-tab'
import { Mail, Info, ChevronDown } from 'lucide-react'

interface Props {
  currentConsultantId: string | null
  isManager: boolean
}

export function CommunicationSection({ currentConsultantId, isManager }: Props) {
  const [showHelp, setShowHelp] = React.useState(false)

  return (
    <div className="space-y-4">
      {/* En-tête : titre + sous-titre + aide repliable */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <Mail size={18} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-indigo-900">
              Templates d&apos;email
            </h3>
            <p className="text-xs text-indigo-800/80 mt-0.5">
              Personnalisez ce que vos clients reçoivent après signature de leur KYC.
              Les envois partent via Google Workspace depuis{' '}
              <code className="bg-white/70 px-1 py-0.5 rounded text-[11px]">
                support@private-equity-valley.com
              </code>
              .
            </p>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:text-indigo-900"
            >
              <Info size={12} />
              Comment ça marche ?
              <ChevronDown
                size={12}
                className={`transition-transform ${showHelp ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {showHelp && (
          <div className="mt-3 pl-12 text-[12px] text-indigo-900/80 space-y-2 leading-relaxed">
            <p>
              <strong>1. Sélectionnez le consultant</strong> (manager seulement) pour lequel éditer
              les templates. Chaque consultant a ses propres templates ; si aucun template personnalisé
              n&apos;existe, le template par défaut du cabinet est envoyé.
            </p>
            <p>
              <strong>2. Modifiez l&apos;objet et le corps</strong> : le corps est en texte libre,
              sans HTML. La charte visuelle PEV s&apos;applique automatiquement à l&apos;envoi.
            </p>
            <p>
              <strong>3. Insérez des variables</strong> en cliquant sur les puces (ex.{' '}
              <code className="bg-white px-1 rounded">{'{{clientFirstName}}'}</code>). Elles sont
              remplacées par les vraies valeurs au moment de l&apos;envoi.
            </p>
            <p>
              <strong>4. Vérifiez avec Aperçu</strong> avant d&apos;enregistrer. Le bouton{' '}
              <em>Restaurer le défaut</em> annule vos personnalisations pour ce template.
            </p>
            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Astuce : cochez <strong>« Activer »</strong> pour que votre version remplace le template
              par défaut. Sinon, le cabinet continue d&apos;envoyer le template standard.
            </p>
          </div>
        )}
      </div>

      <EmailTemplatesTab currentConsultantId={currentConsultantId} isManager={isManager} />
    </div>
  )
}
