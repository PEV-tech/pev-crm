'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type DossierStatus = 'prospect' | 'client_en_cours' | 'client_finalise' | 'non_abouti'
type FacturationStatus = 'à émettre' | 'émise' | 'payée'
type KycStatus = 'non' | 'en_cours' | 'oui'

type StatusType = DossierStatus | FacturationStatus | KycStatus

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusType
  type?: 'dossier' | 'facturation' | 'kyc'
}

const statusConfig: Record<StatusType, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline' }> = {
  // Dossier statuses
  prospect: { label: 'Prospect', variant: 'secondary' },
  client_en_cours: { label: 'Client en cours', variant: 'warning' },
  client_finalise: { label: 'Client finalisé', variant: 'success' },
  non_abouti: { label: 'Non abouti', variant: 'outline' },
  // Facturation statuses
  'à émettre': { label: 'À émettre', variant: 'destructive' },
  'émise': { label: 'Émise', variant: 'warning' },
  'payée': { label: 'Payée', variant: 'success' },
  // KYC statuses
  'non': { label: 'Non', variant: 'destructive' },
  'en_cours': { label: 'En cours', variant: 'warning' },
  'oui': { label: 'Oui', variant: 'success' },
}

export const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ status, type, className, ...props }, ref) => {
    const config = statusConfig[status]

    if (!config) {
      return null
    }

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        className={cn('capitalize', className)}
        {...props}
      >
        {config.label}
      </Badge>
    )
  }
)
StatusBadge.displayName = 'StatusBadge'

export type { DossierStatus, FacturationStatus, KycStatus }'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type DossierStatus = 'prospect' | 'client_en_cours' | 'client_finalise'
type FacturationStatus = 'à émettre' | 'émise' | 'payée'
type KycStatus = 'non' | 'en_cours' | 'oui'

type StatusType = DossierStatus | FacturationStatus | KycStatus

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusType
  type?: 'dossier' | 'facturation' | 'kyc'
}

const statusConfig: Record<StatusType, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline' }> = {
  // Dossier statuses
  prospect: { label: 'Prospect', variant: 'secondary' },
  client_en_cours: { label: 'Client en cours', variant: 'warning' },
  client_finalise: { label: 'Client finalisé', variant: 'success' },
  // Facturation statuses
  'à émettre': { label: 'À émettre', variant: 'destructive' },
  'émise': { label: 'Émise', variant: 'warning' },
  'payée': { label: 'Payée', variant: 'success' },
  // KYC statuses
  'non': { label: 'Non', variant: 'destructive' },
  'en_cours': { label: 'En cours', variant: 'warning' },
  'oui': { label: 'Oui', variant: 'success' },
}

export const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ status, type, className, ...props }, ref) => {
    const config = statusConfig[status]

    if (!config) {
      return null
    }

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        className={cn('capitalize', className)}
        {...props}
      >
        {config.label}
      </Badge>
    )
  }
)
StatusBadge.displayName = 'StatusBadge'

export type { DossierStatus, FacturationStatus, KycStatus }
