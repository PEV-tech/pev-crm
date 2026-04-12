'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets } from '@/types/database'
import { MaClienteleClient } from './ma-clientele-client'
import { GrilleGestion } from '@/lib/commissions/gestion'

export function MaClienteleClientWrapper() {
  const { consultant } = useUser()
  const [dossiers, setDossiers] = React.useState<VDossiersComplets[]>([])
  const [gestionGrilles, setGestionGrilles] = React.useState<GrilleGestion[]>([])
  const [entreeGrilles, setEntreeGrilles] = React.useState<GrilleGestion[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        // Always filter by current user's prenom — Ma Clientèle = MES dossiers
        let query = supabase
          .from('v_dossiers_complets')
          .select('id, client_id, statut, montant, financement, date_operation, client_nom, client_prenom, client_pays, statut_kyc, der, pi, preco, lm, rm, consultant_nom, consultant_prenom, produit_nom, produit_categorie, compagnie_nom, commission_brute, rem_apporteur, facturee, payee')
          .eq('consultant_prenom', consultant?.prenom || '')

        // Fetch both gestion and entree grilles
        const [dossiersRes, gestionRes, entreeRes] = await Promise.all([
          query,
          supabase
            .from('grilles_frais')
            .select('encours_min, encours_max, taux')
            .eq('type_frais', 'gestion')
            .eq('actif', true)
            .order('encours_min', { ascending: true }),
          supabase
            .from('grilles_frais')
            .select('encours_min, encours_max, taux')
            .eq('type_frais', 'entree')
            .eq('actif', true)
            .order('encours_min', { ascending: true }),
        ])

        if (!dossiersRes.error) {
          setDossiers((dossiersRes.data || []) as VDossiersComplets[])
        } else {
          setDossiers([])
        }

        if (!gestionRes.error && gestionRes.data) setGestionGrilles(gestionRes.data)
        if (!entreeRes.error && entreeRes.data) setEntreeGrilles(entreeRes.data)
      } catch (error) {
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

  return <MaClienteleClient initialData={dossiers} consultant={consultant} gestionGrilles={gestionGrilles} entreeGrilles={entreeGrilles} />
}
