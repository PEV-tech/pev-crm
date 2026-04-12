'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets } from '@/types/database'
import { DossiersClient } from './dossiers-client'
import { GrilleGestion } from '@/lib/commissions/gestion'

const DOSSIERS_PER_PAGE = 25

export function DossiersClientWrapper() {
  const { consultant } = useUser()
  const [data, setData] = React.useState<VDossiersComplets[]>([])
  const [gestionGrilles, setGestionGrilles] = React.useState<GrilleGestion[]>([])
  const [entreeGrilles, setEntreeGrilles] = React.useState<GrilleGestion[]>([])
  const [loading, setLoading] = React.useState(true)
  const [totalCount, setTotalCount] = React.useState(0)
  const [currentPage, setCurrentPage] = React.useState(0)

  const fetchData = React.useCallback(async (page: number = 0) => {
    try {
      setLoading(true)
      const supabase = createClient()
      const from = page * DOSSIERS_PER_PAGE
      const to = from + DOSSIERS_PER_PAGE - 1

      // P0 fix: consultants must only see their own dossiers
      const isManager = consultant?.role === 'manager'
      const isBackOffice = consultant?.role === 'back_office'
      let dossiersQuery = supabase.from('v_dossiers_complets').select('id, client_id, statut, montant, financement, date_operation, apporteur_label, referent, client_nom, client_prenom, client_pays, statut_kyc, der, pi, preco, lm, rm, consultant_nom, consultant_prenom, consultant_zone, produit_nom, produit_categorie, compagnie_nom, commission_brute, rem_apporteur, facturee, payee, part_cabinet, rem_apporteur, date_facture', { count: 'exact' }).order('date_operation', { ascending: false }).range(from, to)
      if (!isManager && !isBackOffice && consultant?.prenom) {
        dossiersQuery = dossiersQuery.eq('consultant_prenom', consultant.prenom)
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

      if (!dossiersRes.error) {
        setData((dossiersRes.data || []) as VDossiersComplets[])
        setTotalCount(dossiersRes.count || 0)
        setCurrentPage(page)
      } else {
        setData([])
        setTotalCount(0)
      }

      if (!gestionRes.error && gestionRes.data) setGestionGrilles(gestionRes.data)
      if (!entreeRes.error && entreeRes.data) setEntreeGrilles(entreeRes.data)
    } catch (error) {
      setData([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [consultant])

  React.useEffect(() => {
    if (consultant) fetchData(0)
  }, [consultant, fetchData])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  return (
    <DossiersClient
      initialData={data}
      role={consultant?.role || 'manager'}
      gestionGrilles={gestionGrilles}
      entreeGrilles={entreeGrilles}
      totalCount={totalCount}
      currentPage={currentPage}
      itemsPerPage={DOSSIERS_PER_PAGE}
      onPageChange={fetchData}
    />
  )
}
