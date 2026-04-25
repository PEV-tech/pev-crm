'use client'

import { useParams } from 'next/navigation'
import { useRole } from '@/hooks/use-user'
import { EncoursDetailClient } from './encours-detail-client'

export default function EncoursDetailPage() {
  const params = useParams<{ id: string }>()
  const role = useRole()
  const isManagerOrBO = role === 'manager' || role === 'back_office'

  if (!isManagerOrBO) {
    return (<div className="flex items-center justify-center h-64"><p className="text-gray-500">Accès réservé aux gestionnaires.</p></div>)
  }
  const id = params?.id
  if (!id || typeof id !== 'string') {
    return (<div className="flex items-center justify-center h-64"><p className="text-gray-500">Identifiant manquant.</p></div>)
  }
  return <EncoursDetailClient batchId={id} />
}
