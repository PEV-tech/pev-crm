'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { ManagerOnly } from '@/components/shared/manager-only'
import { ReglementaireClient } from './reglementaire-client'

export function ReglementaireClientWrapper() {
  const [data, setData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        const { data, error } = await supabase
          .from('v_dossiers_complets')
          .select('id, client_id, statut, date_operation, client_nom, client_prenom, consultant_nom, consultant_prenom, produit_nom, compagnie_nom, statut_kyc, der, pi, preco, lm, rm')

        if (error) {
          console.error('Error fetching dossiers:', error)
          setData([])
        } else {
          setData(data || [])
        }
      } catch (error) {
        console.error('Error fetching compliance data:', error)
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
      <ReglementaireClient initialData={data} />
    </ManagerOnly>
  )
}
