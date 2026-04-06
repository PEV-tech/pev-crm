'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { EncaissementsClient } from './encaissements-client'

export function EncaissementsClientWrapper() {
  const [data, setData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        const { data: remData, error } = await supabase
          .from('encaissements_rem')
          .select('*')
          .order('mois')

        if (error) {
          console.error('Error fetching encaissements_rem:', error)
          setData([])
        } else {
          setData(remData || [])
        }
      } catch (error) {
        console.error('Error fetching encaissements:', error)
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

  return <EncaissementsClient initialData={data} />
}
