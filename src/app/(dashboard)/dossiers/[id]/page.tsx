'use client'

import { DossierDetailWrapper } from './dossier-detail-wrapper'
import { useParams } from 'next/navigation'

export default function DossierDetailPage() {
  const params = useParams()
  const id = params.id as string

  return <DossierDetailWrapper id={id} />
}
