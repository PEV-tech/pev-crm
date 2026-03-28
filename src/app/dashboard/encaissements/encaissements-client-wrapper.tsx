'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { EncaissementsClient } from './encaissements-client'

export function EncaissementsClientWrapper() {
  const [data, setData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        const [dossiersRes, facturesRes] = await Promise.all([
          supabase.from('v_dossiers_complets').select('*'),
          supabase.from('factures').select('*'),
        ])

        const dossiers = dossiersRes.data || []
        const factures = facturesRes.data || []

        // Show all factures with dossier info, marking payment status
        const encaissements = factures.map((f: any) => {
          const dossier = dossiers.find((d: any) => d.id === f.dossier_id)
          return { ...f, dossier }
        })

        setData(encaissements)
      } catch (error) {
        console.error('Error fetching encaissements:', error)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  return <EncaissementsClient initialData={data} />
}
