'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets } from '@/types/database'
import { MaClienteleClient } from './ma-clientele-client'

export function MaClienteleClientWrapper() {
  const { consultant } = useUser()
  const [dossiers, setDossiers] = React.useState<VDossiersComplets[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        // Manager sees all, consultant sees own
        let query = supabase.from('v_dossiers_complets').select('*')

        if (consultant?.role !== 'manager') {
          query = query.eq('consultant_nom', consultant?.nom)
        }

        const { data: dossiersData, error: dossiersError } = await query

        if (dossiersError) {
          console.error('Error fetching dossiers:', dossiersError)
          setDossiers([])
        } else {
          setDossiers((dossiersData || []) as VDossiersComplets[])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setDossiers([])
      } finally {
        setLoading(false)
      }
    }

    if (consultant) fetchData()
  }, [consultant])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  return <MaClienteleClient initialData={dossiers} consultant={consultant} />
}
