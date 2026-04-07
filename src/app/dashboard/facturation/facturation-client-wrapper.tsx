'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { VDossiersComplets } from '@/types/database'
import { ManagerOnly } from '@/components/shared/manager-only'
import { FacturationClient } from './facturation-client'

export function FacturationClientWrapper() {
  const [data, setData] = React.useState<VDossiersComplets[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        const { data, error } = await supabase
          .from('v_dossiers_complets')
          .select('id, client_nom, client_prenom, consultant_nom, consultant_prenom, produit_nom, compagnie_nom, montant, commission_brute, rem_apporteur, part_cabinet, date_operation, date_facture, facturee, payee')
          .eq('statut', 'client_finalise')
          .order('date_operation', { ascending: false })

        if (error) {
          console.error('Error fetching facturation data:', error)
          setData([])
        } else {
          setData((data || []) as VDossiersComplets[])
        }
      } catch (error) {
        console.error('Error fetching facturation data:', error)
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

  return (
    <ManagerOnly>
      <FacturationClient initialData={data} />
    </ManagerOnly>
  )
}
