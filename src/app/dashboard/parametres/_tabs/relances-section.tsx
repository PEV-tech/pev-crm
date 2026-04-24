'use client'

/**
 * Section « Relances » de Paramètres.
 *
 * Chantier 3 de l'étape 3 audit KYC (2026-04-24). Wrapper avec intro
 * pédagogique au-dessus du composant KycRelancesTab.
 */

import * as React from 'react'
import { KycRelancesTab } from '@/components/parametres/kyc-relances-tab'
import { Bell, Info, ChevronDown } from 'lucide-react'

interface Props {
  currentConsultantId: string | null
  isManager: boolean
}

export function RelancesSection({ currentConsultantId, isManager }: Props) {
  const [showHelp, setShowHelp] = React.useState(false)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-amber-900">
              Relances KYC automatiques
            </h3>
            <p className="text-xs text-amber-800/80 mt-0.5">
              Le CRM vérifie chaque nuit si un KYC envoyé n&apos;a pas été signé,
              et crée une entrée dans votre section <em>Relances</em> selon vos
              règles. Vous pouvez activer l&apos;envoi d&apos;un email
              automatique au client (template{' '}
              <code className="bg-white/70 px-1 rounded text-[11px]">
                kyc_relance
              </code>{' '}
              dans <em>Paramètres → Communication</em>).
            </p>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900"
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
          <div className="mt-3 pl-12 text-[12px] text-amber-900/80 space-y-2 leading-relaxed">
            <p>
              <strong>Chaque nuit</strong>, le CRM liste vos clients pour
              lesquels le lien KYC a été envoyé mais jamais signé.
            </p>
            <p>
              <strong>Seuil avant 1re relance</strong> : un client sans nouvelle
              de plus de N jours entre dans la file. Exemple à 7j : un lien
              envoyé le 1er déclenchera une 1re relance le 8.
            </p>
            <p>
              <strong>Intervalle entre relances</strong> : si toujours pas de
              signature M jours après la 1re, une 2e est créée. Exemple à 7j :
              la 2e tombe le 15, la 3e le 22, etc.
            </p>
            <p>
              <strong>Plafond</strong> : au-delà du max, le CRM s&apos;arrête.
              Le compteur se remet à zéro si vous renvoyez un nouveau lien au
              client (régénération du token).
            </p>
            <p>
              <strong>Email automatique</strong> : si activé, le template{' '}
              <code className="bg-white px-1 rounded">kyc_relance</code> est
              envoyé au client en même temps que la relance apparaît dans votre
              section Relances. Sinon, seule l&apos;entrée est créée et
              c&apos;est à vous de relancer comme d&apos;habitude.
            </p>
          </div>
        )}
      </div>

      <KycRelancesTab
        currentConsultantId={currentConsultantId}
        isManager={isManager}
      />
    </div>
  )
}
