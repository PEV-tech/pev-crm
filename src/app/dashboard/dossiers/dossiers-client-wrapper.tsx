'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets } from '@/types/database'
import { DossiersClient } from './dossiers-client'

interface GrilleGestion {
  encours_min: number
  encours_max: number | null
  taux: number
}

export function DossiersClientWrapper() {
  const { consultant } = useUser()
  const [data, setData] = React.useState<VDossiersComplets[]>([])
  const [gestionGrilles, setGestionGrilles] = React.useState<GrilleGestion[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        const [dossiersRes, grillesRes] = await Promise.all([
          supabase.from('v_dossiers_complets').select('*').order('date_operation', { ascending: false }),
          supabase
            .from('grilles_frais')
            .select('encours_min, encours_max, taux')
            .eq('type_frais', 'gestion')
            .eq('actif', true)
            .order('encours_min', { ascending: true }),
        ])

        if (dossiersRes.error) {
          console.error('Error fetching dossiers:', dossiersRes.error)
          setData([])
        } else {
          setData((dossiersRes.data || []) as VDossiersComplets[])
        }

        if (!grillesRes.error && grillesRes.data) {
          setGestionGrilles(grillesRes.data)
        }
      } catch (error) {
        console.error('Error fetching dossiers:', error)
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
    <DossiersClient
      initialData={data}
      role={consultant?.role || 'manager'}
      gestionGrilles={gestionGrilles}
    />
  )
}
