'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets } from '@/types/database'
import { DossiersClient } from './dossiers-client'
import { GrilleGestion } from '@/lib/commissions/gestion'

const DOSSIERS_PER_PAGE = 25

/**
 * Point 2.3 (2026-04-24) — Extension du type v_dossiers_complets pour
 * porter, côté front uniquement, deux informations supplémentaires :
 *   - `is_orphan` : la ligne ne provient pas de la table `dossiers`
 *      mais est dérivée d'un client sans dossier (= prospect).
 *   - `client_statut` : statut_client du client principal (actif /
 *      non_abouti), utile pour filtrer côté liste. La vue SQL ne
 *      l'expose pas (non régénérée avant migration 2.3), on le join
 *      manuellement via une seconde requête légère.
 */
export type DossierOrOrphan = VDossiersComplets & {
  is_orphan?: boolean
  client_statut?: 'actif' | 'non_abouti' | null
}

/**
 * Bug 6 (2026-04-24) — Liste exhaustive des consultants pour le dropdown
 * de filtre. Auparavant dérivée de `data` (page courante paginée), donc
 * incomplète : seuls les consultants ayant des dossiers dans les 25 lignes
 * affichées apparaissaient. Désormais fetchée séparément depuis la table
 * `consultants` et passée au client — label stable (prenom + nom DB) et
 * liste complète indépendante de la pagination. Fix aussi Bug 5 par effet
 * de bord : les labels viennent maintenant de la table consultants, plus
 * de divergence possible avec v_dossiers_complets.
 */
export type ConsultantOption = {
  id: string
  label: string
}

export function DossiersClientWrapper() {
  const { consultant } = useUser()
  const [data, setData] = React.useState<DossierOrOrphan[]>([])
  const [gestionGrilles, setGestionGrilles] = React.useState<GrilleGestion[]>([])
  const [entreeGrilles, setEntreeGrilles] = React.useState<GrilleGestion[]>([])
  const [consultantsList, setConsultantsList] = React.useState<ConsultantOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [totalCount, setTotalCount] = React.useState(0)
  const [currentPage, setCurrentPage] = React.useState(0)

  const fetchData = React.useCallback(async (page: number = 0) => {
    try {
      setLoading(true)
      const supabase = createClient()

      // P0 fix: consultants must only see their own dossiers
      const isManager = consultant?.role === 'manager'
      const isBackOffice = consultant?.role === 'back_office'
      // Bug 1 (2026-04-24) — Pagination retirée. Le volume de dossiers
      // reste < 500 côté PEV ; la complexité de pagination + count gonflé
      // par DISTINCT ON dans v_dossiers_complets ne vaut pas le coup.
      // On charge tout, les stats redeviennent fiables côté front.
      // Point 3.1 — Filtrage backend par `consultant_id` (UUID), pas par
      // prenom. Voir aussi le fetch séparé sur `dossiers` pour le count.
      let dossiersQuery = supabase.from('v_dossiers_complets').select('id, client_id, statut, montant, financement, date_operation, apporteur_label, referent, client_nom, client_prenom, client_pays, statut_kyc, der, pi, preco, lm, rm, consultant_id, consultant_nom, consultant_prenom, consultant_zone, produit_nom, produit_categorie, compagnie_nom, commission_brute, rem_apporteur, facturee, payee, part_cabinet, rem_apporteur, date_facture').order('date_operation', { ascending: false })
      if (!isManager && !isBackOffice && consultant?.id) {
        dossiersQuery = dossiersQuery.eq('consultant_id', consultant.id)
      }

      // Point 2.3 — Second chargement : les clients SANS dossier (prospects).
      // On fetch la table clients et on soustraira ceux qui ont au moins un
      // dossier en aggrégant côté front (plus simple que NOT EXISTS
      // sub-query via supabase-js). Volume attendu faible (< quelques
      // centaines), donc pas de pagination sur cette branche.
      // NOTE : consultant_id peut être NULL sur clients (= POOL, cf mémoire
      // arbitrage 3.2). On laisse remonter pour que le manager les voie.
      let clientsQuery = supabase
        .from('clients')
        .select('id, nom, prenom, pays, statut_kyc, der, pi, lm, rm, consultant_id, statut_client')
      // Filtrage consultant pour les non-managers. Les clients POOL
      // (consultant_id NULL) ne remontent pas côté consultant (seul le
      // manager les voit) — géré naturellement par la condition d'égalité.
      // TODO (point 3.2) : quand le consultant POOL fictif sera en DB,
      // remplacer par `.eq('consultant_id', currentConsultantId)` et laisser
      // la règle POOL remonter via son id.
      if (!isManager && !isBackOffice && consultant?.id) {
        clientsQuery = clientsQuery.eq('consultant_id', consultant.id)
      }

      // Bug 6 — Fetch séparé de la liste complète des consultants pour
      // alimenter le dropdown de filtre. Non paginé (≤20 consultants).
      const consultantsListQuery = supabase
        .from('consultants')
        .select('id, prenom, nom, actif')
        .order('prenom', { ascending: true })

      const [dossiersRes, gestionRes, entreeRes, clientsRes, consultantsListRes] = await Promise.all([
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
        clientsQuery,
        consultantsListQuery,
      ])

      if (!dossiersRes.error) {
        const dossierRows = (dossiersRes.data || []) as DossierOrOrphan[]
        const dossierClientIds = new Set(
          dossierRows.map((r) => r.client_id).filter(Boolean) as string[],
        )

        // Lookup statut_client par client_id pour enrichir les rows dossier.
        const clientsById = new Map<string, any>()
        if (!clientsRes.error && clientsRes.data) {
          for (const c of clientsRes.data as any[]) {
            clientsById.set(c.id, c)
          }
        }

        // 1) Enrichir les rows dossier avec client_statut (pour filtrer les
        //    non_abouti même s'ils ont un dossier legacy).
        const enrichedDossiers: DossierOrOrphan[] = dossierRows.map((r) => ({
          ...r,
          client_statut: (clientsById.get(r.client_id || '')?.statut_client ?? 'actif') as 'actif' | 'non_abouti' | null,
        }))

        // 2) Construire les rows orphelines = clients qui ne sont dans aucun
        //    dossier de la page courante. On signale is_orphan=true et
        //    statut = 'prospect' (règle métier Maxine : fiche client sans
        //    dossier = prospect). Les autres colonnes dossier sont null.
        const orphans: DossierOrOrphan[] =
          !clientsRes.error && clientsRes.data
            ? (clientsRes.data as any[])
                .filter((c) => !dossierClientIds.has(c.id))
                .map((c) => ({
                  id: `orphan-${c.id}`,
                  client_id: c.id,
                  statut: 'prospect' as any,
                  montant: null,
                  financement: null,
                  date_operation: null,
                  apporteur_label: null,
                  referent: null,
                  client_nom: c.nom,
                  client_prenom: c.prenom,
                  client_pays: c.pays,
                  statut_kyc: c.statut_kyc,
                  der: c.der,
                  pi: c.pi,
                  preco: Boolean(c.der && c.pi),
                  lm: c.lm,
                  rm: c.rm,
                  consultant_nom: null,
                  consultant_prenom: null,
                  consultant_zone: null,
                  produit_nom: null,
                  produit_categorie: null,
                  compagnie_nom: null,
                  commission_brute: null,
                  rem_apporteur: null,
                  facturee: null,
                  payee: null,
                  part_cabinet: null,
                  date_facture: null,
                  is_orphan: true,
                  client_statut: (c.statut_client ?? 'actif') as 'actif' | 'non_abouti' | null,
                }) as unknown as DossierOrOrphan)
            : []

        setData([...enrichedDossiers, ...orphans])
        // Bug 1 (2026-04-24) — totalCount = taille réelle des données
        // après déduplication DISTINCT ON + fusion orphans. Plus de
        // pagination ni de count serveur gonflé.
        setTotalCount(enrichedDossiers.length + orphans.length)
        setCurrentPage(0)
      } else {
        setData([])
        setTotalCount(0)
      }

      if (!gestionRes.error && gestionRes.data) setGestionGrilles(gestionRes.data)
      if (!entreeRes.error && entreeRes.data) setEntreeGrilles(entreeRes.data)

      // Bug 6 — Liste complète des consultants pour le dropdown.
      // On inclut les inactifs au cas où des dossiers historiques y sont
      // rattachés (sinon le filtre afficherait "consultant_id inconnu"
      // pour ces dossiers). Label = prénom + nom. Les inactifs sont
      // triés à la fin via une petite logique de sort.
      if (!consultantsListRes.error && consultantsListRes.data) {
        const opts: ConsultantOption[] = (consultantsListRes.data as any[]).map((c) => ({
          id: c.id as string,
          label: `${c.prenom || ''} ${c.nom || ''}`.trim() || '(consultant sans nom)',
        }))
        setConsultantsList(opts)
      }
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
      consultantsList={consultantsList}
    />
  )
}
