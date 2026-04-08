'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { EncaissementsClient } from './encaissements-client'

export function EncaissementsClientWrapper() {
  const { consultant } = useUser()
  const [data, setData] = React.useState<any[]>([])
  const [facturesPaid, setFacturesPaid] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  const role = consultant?.role || 'manager'
  const isBackOffice = role === 'back_office'

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()
        // Back office uses v_dossiers_remunerations (masks POOL member names)
        const facturesView = isBackOffice ? 'v_dossiers_remunerations' : 'v_dossiers_complets'
        const [remRes, facturesRes] = await Promise.all([
          supabase.from('encaissements_rem').select('*').order('mois'),
          supabase
            .from(facturesView)
            .select('id, client_nom, client_prenom, consultant_nom, consultant_prenom, produit_nom, compagnie_nom, montant, commission_brute, rem_apporteur, part_cabinet, date_facture, payee')
            .eq('payee', 'oui')
            .order('date_facture', { ascending: false }),
        ])
        if (remRes.error) { console.error('Error fetching encaissements_rem:', remRes.error) }
        else { setData(remRes.data || []) }

        if (!facturesRes.error) { setFacturesPaid(facturesRes.data || []) }
      } catch (error) { console.error('Error fetching encaissements:', error) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [isBackOffice])

  if (loading) return <div className="flex items-center justify-center min-h-screen">Chargement...</div>

  return <EncaissementsClient initialData={data} role={role} facturesPaid={facturesPaid} />
}
