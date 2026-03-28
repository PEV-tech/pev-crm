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
      try {
        const supabase = createClient()

        const { data: dossiersData, error: dossiersError } = await supabase
          .from('v_dossiers_complets')
          .select('*')

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

    fetchData()
  }, [])

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
