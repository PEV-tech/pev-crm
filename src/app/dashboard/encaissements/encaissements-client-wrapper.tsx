'use client'

import * as React from 'react'
import { createClient } from '@supabase/supabase-js'
import { EncaissementsClient } from './encaissements-client'

export function EncaissementsClientWrapper() {
  const [data, setData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const [dossiersRes, facturesRes] = await Promise.all([
          supabase.from('v_dossiers_complets').select('*'),
          supabase.from('factures').select('*'),
        ])

        const dossiers = dossiersRes.data || []
        const factures = facturesRes.data || []

        const encaissements = factures
          .filter((f: any) => f.facturee && f.payee === 'oui')
          .map((f: any) => {
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
