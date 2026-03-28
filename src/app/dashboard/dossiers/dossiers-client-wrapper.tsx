'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { VDossiersComplets } from '@/types/database'
import { DossiersClient } from './dossiers-client'

export function DossiersClientWrapper() {
  const [data, setData] = React.useState<VDossiersComplets[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        const { data, error } = await supabase
          .from('v_dossiers_complets')
          .select('*')
          .order('date_operation', { ascending: false })

        if (error) {
          console.error('Error fetching dossiers:', error)
          setData([])
        } else {
          setData((data || []) as VDossiersComplets[])
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

  return <DossiersClient initialData={data} />
}
