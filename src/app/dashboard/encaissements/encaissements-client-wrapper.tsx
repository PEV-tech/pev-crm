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

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()
        // Always use v_dossiers_complets — the component handles role-based display
        const [remRes, facturesRes] = await Promise.all([
          supabase.from('encaissements').select('*').order('annee', { ascending: false }).order('mois'),
          supabase
            .from('v_dossiers_complets')
            .select('id, client_nom, client_prenom, client_pays, consultant_nom, consultant_prenom, taux_remuneration, apporteur_label, produit_nom, compagnie_nom, montant, commission_brute, rem_apporteur, part_cabinet, date_facture, payee')
            .eq('payee', 'oui')
            .order('date_facture', { ascending: false }),
        ])
        if (!remRes.error) { setData(remRes.data || []) }

        if (!facturesRes.error) { setFacturesPaid(facturesRes.data || []) }
      } catch (error) {
        // Error silenced - encaissements fetch failed
      }
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  if (loading) return <div className="flex items-center justify-center min-h-screen">Chargement...</div>

  return <EncaissementsClient initialData={data} role={role} facturesPaid={facturesPaid} />
}
