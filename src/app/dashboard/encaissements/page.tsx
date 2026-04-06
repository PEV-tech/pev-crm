'use client'

import { useRole } from '@/hooks/use-user'
import { EncaissementsClientWrapper } from './encaissements-client-wrapper'

export default function EncaissementsPage() {
  const role = useRole()
  const isManagerOrBO = role === 'manager' || role === 'back_office'

  if (!isManagerOrBO) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès réservé aux gestionnaires.</p>
      </div>
    )
  }

  return <EncaissementsClientWrapper />
}
