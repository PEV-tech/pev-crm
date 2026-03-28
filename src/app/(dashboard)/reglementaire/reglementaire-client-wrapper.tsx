'use client'

import * as React from 'react'
import { createClient } from '@supabase/supabase-js'
import { ReglementaireClient } from './reglementaire-client'

export function ReglementaireClientWrapper() {
  const [data, setData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data, error } = await supabase
          .from('v_dossiers_complets')
          .select('*')

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

  return <ReglementaireClient initialData={data} />
}
