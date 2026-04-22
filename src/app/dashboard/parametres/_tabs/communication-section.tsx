'use client'

/**
 * Section "Communication"
 *
 * Templates d'email envoyés depuis le CRM (SMTP Google Workspace).
 * Réutilise le composant EmailTemplatesTab existant sous /components/parametres/.
 */

import * as React from 'react'
import { EmailTemplatesTab } from '@/components/parametres/email-templates-tab'
import { SECTION_INTRO_CLS } from './helpers'

interface Props {
  currentConsultantId: string | null
  isManager: boolean
}

export function CommunicationSection({ currentConsultantId, isManager }: Props) {
  return (
    <div className="space-y-4">
      <div className={SECTION_INTRO_CLS}>
        <strong>Templates d'email.</strong> Chaque consultant peut personnaliser ses propres
        templates ; le manager voit et peut ajuster les templates par défaut du cabinet.
        Les emails partent via Google Workspace SMTP depuis{' '}
        <code>support@private-equity-valley.com</code>.
      </div>
      <EmailTemplatesTab currentConsultantId={currentConsultantId} isManager={isManager} />
    </div>
  )
}
