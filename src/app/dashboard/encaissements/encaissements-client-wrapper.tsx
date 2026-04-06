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

        // Use v_dossiers_complets which already has facturee/payee columns
        // and is accessible via RLS (avoids separate factures table query)
        const { data: dossiers, error } = await supabase
          .from('v_dossiers_complets')
          .select('*')
          .eq('statut', 'client_finalise')
          .order('date_operation', { ascending: false })

        if (error) {
          console.error('Error fetching encaissements:', error)
          setData([])
        } else {
          // Transform to match encaissements-client expected format
          const encaissements = (dossiers || []).map((d: any) => ({
            dossier_id: d.id,
            facturee: d.facturee ?? false,
            payee: d.payee ?? 'non',
            date_facture: d.date_facture,
            date_paiement: d.date_paiement,
            dossier: {
              id: d.id,
              client_nom: d.client_nom,
              client_prenom: d.client_prenom,
              produit_nom: d.produit_nom,
              compagnie_nom: d.compagnie_nom,
              montant: d.montant,
              commission_brute: d.commission_brute,
              consultant_prenom: d.consultant_prenom,
              consultant_nom: d.consultant_nom,
              date_operation: d.date_operation,
            },
          }))
          setData(encaissements)
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
