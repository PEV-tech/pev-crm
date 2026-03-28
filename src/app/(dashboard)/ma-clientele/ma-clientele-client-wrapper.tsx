'use client'

import * as React from 'react'
import { createClient } from '@supabase/supabase-js'
import { VDossiersComplets } from '@/types/database'
import { MaClienteleClient } from './ma-clientele-client'

export function MaClienteleClientWrapper() {
  const [dossiers, setDossiers] = React.useState<VDossiersComplets[]>([])
  const [consultant, setConsultant] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          setDossiers([])
          setConsultant(null)
          setLoading(false)
          return
        }

        const { data: consultantData, error: consultantError } = await supabase
          .from('consultants')
          .select('*')
          .eq('auth_user_id', user.id)
          .single()

        if (consultantError) {
          console.error('Error fetching consultant:', consultantError)
          setDossiers([])
          setConsultant(null)
          setLoading(false)
          return
        }

        const { data: dossiersData, error: dossiersError } = await supabase
          .from('v_dossiers_complets')
          .select('*')
          .eq('consultant_nom', consultantData?.nom)

        if (dossiersError) {
          console.error('Error fetching dossiers:', dossiersError)
          setDossiers([])
          setConsultant(consultantData)
        } else {
          setDossiers((dossiersData || []) as VDossiersComplets[])
          setConsultant(consultantData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setDossiers([])
        setConsultant(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  return <MaClienteleClient initialData={dossiers} consultant={consultant} />
}
