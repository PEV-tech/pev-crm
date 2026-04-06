'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { RemunerationsClient } from './remunerations-client'

export function RemunerationsClientWrapper() {
  const { consultant } = useUser()
  const [dossiers, setDossiers] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      if (!consultant) return

      try {
        const supabase = createClient()

        // For manager: get all finalized dossiers with commission data
        // For consultant: get only their own
        let query = supabase
          .from('v_dossiers_complets')
          .select('*')
          .eq('statut', 'client_finalise')

        if (consultant.role !== 'manager' && consultant.role !== 'back_office') {
          query = query
            .eq('consultant_nom', consultant.nom)
            .eq('consultant_prenom', consultant.prenom)
        }

        const { data: dossiersData, error: dossiersError } = await query

        if (dossiersError) {
          console.error('Error fetching dossiers:', dossiersError)
          setDossiers([])
        } else {
          setDossiers(dossiersData || [])
        }
      } catch (error) {
        console.error('Error fetching remuneration data:', error)
        setDossiers([])
      } finally {
        setLoading(false)
      }
    }

    if (consultant) {
      fetchData()
    }
  }, [consultant])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  return (
    <RemunerationsClient
      dossiers={dossiers}
      consultant={consultant}
      role={consultant?.role || null}
    />
  )
}
