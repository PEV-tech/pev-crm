'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { RemunerationsClient } from './remunerations-client'

export function RemunerationsClientWrapper() {
  const { consultant } = useUser()
  const [dossiers, setDossiers] = React.useState<any[]>([])
  const [remTotals, setRemTotals] = React.useState<{ maxine: number; thelo: number }>({ maxine: 0, thelo: 0 })
  const [cagnotte, setCagnotte] = React.useState<{ maxine: any; thelo: any }>({ maxine: null, thelo: null })
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      if (!consultant) return
      try {
        const supabase = createClient()
        const isManager = consultant.role === 'manager' || consultant.role === 'back_office'

        // Fetch dossiers
        let query = supabase.from('v_dossiers_complets').select('*')
        if (!isManager) {
          query = query.eq('consultant_prenom', consultant.prenom)
        }
        const { data: dossiersData } = await query
        setDossiers(dossiersData || [])

        // Managers only: fetch encaissements_rem totals and manager_cagnotte
        if (isManager) {
          const [remRes, cagnotteRes] = await Promise.all([
            supabase.from('encaissements_rem').select('maxine, thelo'),
            supabase.from('manager_cagnotte').select('*'),
          ])
          if (remRes.data) {
            const totals = remRes.data.reduce(
              (acc: any, e: any) => ({ maxine: acc.maxine + Number(e.maxine || 0), thelo: acc.thelo + Number(e.thelo || 0) }),
              { maxine: 0, thelo: 0 }
            )
            setRemTotals(totals)
          }
          if (cagnotteRes.data) {
            const maxineRow = cagnotteRes.data.find((r: any) => r.manager_key === 'maxine')
            const theloRow = cagnotteRes.data.find((r: any) => r.manager_key === 'thelo')
            setCagnotte({ maxine: maxineRow || null, thelo: theloRow || null })
          }
        }
      } catch (error) { console.error('Error fetching remuneration data:', error) }
      finally { setLoading(false) }
    }
    if (consultant) fetchData()
  }, [consultant])

  if (loading) return <div className="flex items-center justify-center min-h-screen">Chargement...</div>

  return (
    <RemunerationsClient
      dossiers={dossiers}
      consultant={consultant}
      role={consultant?.role || null}
      remTotals={remTotals}
      cagnotteData={cagnotte}
    />
  )
}
