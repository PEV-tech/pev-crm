'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets } from '@/types/database'
import { DossiersClient } from './dossiers-client'

interface GrilleFrais {
  encours_min: number
  encours_max: number | null
  taux: number
}

export function DossiersClientWrapper() {
  const { consultant } = useUser()
  const [data, setData] = React.useState<VDossiersComplets[]>([])
  const [gestionGrilles, setGestionGrilles] = React.useState<GrilleFrais[]>([])
  const [entreeGrilles, setEntreeGrilles] = React.useState<GrilleFrais[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        // P0 fix: consultants must only see their own dossiers
        const isManager = consultant?.role === 'manager'
        const isBackOffice = consultant?.role === 'back_office'
        let dossiersQuery = supabase.from('v_dossiers_complets').select('id, client_id, statut, montant, financement, date_operation, apporteur_label, referent, client_nom, client_prenom, client_pays, statut_kyc, der, pi, preco, lm, rm, consultant_nom, consultant_prenom, consultant_zone, produit_nom, produit_categorie, compagnie_nom, commission_brute, rem_apporteur, facturee, payee').order('date_operation', { ascending: false })
        if (!isManager && !isBackOffice) {
          dossiersQuery = dossiersQuery.eq('consultant_prenom', consultant?.prenom)
        }

        const [dossiersRes, gestionRes, entreeRes] = await Promise.all([
          dossiersQuery,
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

        if (dossiersRes.error) {
          console.error('Error fetching dossiers:', dossiersRes.error)
          setData([])
        } else {
          setData((dossiersRes.data || []) as VDossiersComplets[])
        }

        if (!gestionRes.error && gestionRes.data) setGestionGrilles(gestionRes.data)
        if (!entreeRes.error && entreeRes.data) setEntreeGrilles(entreeRes.data)
      } catch (error) {
        console.error('Error fetching dossiers:', error)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    if (consultant) fetchData()
  }, [consultant])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  return (
    <DossiersClient
      initialData={data}
      role={consultant?.role || 'manager'}
      gestionGrilles={gestionGrilles}
      entreeGrilles={entreeGrilles}
    />
  )
            }
