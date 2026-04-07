'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets } from '@/types/database'
import { MaClienteleClient } from './ma-clientele-client'

interface GrilleGestion {
  encours_min: number
  encours_max: number | null
  taux: number
}

export function MaClienteleClientWrapper() {
  const { consultant } = useUser()
  const [dossiers, setDossiers] = React.useState<VDossiersComplets[]>([])
  const [gestionGrilles, setGestionGrilles] = React.useState<GrilleGestion[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        // Always filter by current user's prenom — Ma Clientèle = MES dossiers
        // (All dossiers = page Dossiers, accessible aux managers/BO)
        let query = supabase
          .from('v_dossiers_complets')
          .select('*')
          .eq('consultant_prenom', consultant?.prenom)

        // Also fetch frais de gestion grilles for quarterly encours computation
        const [dossiersRes, grillesRes] = await Promise.all([
          query,
          supabase
            .from('grilles_frais')
            .select('encours_min, encours_max, taux')
            .eq('type_frais', 'gestion')
            .eq('actif', true)
            .order('encours_min', { ascending: true }),
        ])

        if (dossiersRes.error) {
          console.error('Error fetching dossiers:', dossiersRes.error)
          setDossiers([])
        } else {
          setDossiers((dossiersRes.data || []) as VDossiersComplets[])
        }

        if (!grillesRes.error && grillesRes.data) {
          setGestionGrilles(grillesRes.data)
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

  return <MaClienteleClient initialData={dossiers} consultant={consultant} gestionGrilles={gestionGrilles} />
}
