'use client'

import { Suspense } from 'react'
import { DossierDetailWrapper } from './dossier-detail-wrapper'
import { useParams } from 'next/navigation'

function DossierDetailContent() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''

  return <DossierDetailWrapper id={id} />
}

export default function DossierDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Chargement...</div>}>
      <DossierDetailContent />
    </Suspense>
  )
}
