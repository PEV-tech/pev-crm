'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets, TablesUpdate } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Loader2, Trash2, ExternalLink, Heart, Search } from 'lucide-react'
import { DocumentChecklist } from '@/components/shared/document-checklist'
import { ClientRelances } from '@/components/shared/client-relances'
import { DossierHistory } from '@/components/shared/dossier-history'
import { CommissionPanel } from '@/components/dossiers/commission-panel'
import { CompliancePanel } from '@/components/dossiers/compliance-panel'

import { formatCurrency } from '@/lib/formatting'
import { getDefaultGrilleForCategorie } from '@/lib/commissions/default-grilles'
import { loadCommissionRules } from '@/lib/commissions/rules-loader'
import { computeCommissionEntreeSplits } from '@/lib/commissions/entree-split'

const formatPct = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(2)}%`
}

const mapStatutForBadge = (statut: string | null | undefined): 'prospect' | 'client_en_cours' | 'client_finalise' => {
  return (statut as 'prospect' | 'client_en_cours' | 'client_finalise') || 'prospect'
}

const statutLabel = (s: string | null | undefined) => {
  switch (s) {
    case 'prospect': return 'Prospect'
    case 'client_en_cours': return 'Client en cours'
    case 'client_finalise': return 'Client finalisé'
    case 'non_abouti': return 'Non abouti'
    default: return s || '-'
  }
}

interface DossierDetailWrapperProps { id: string }

export function DossierDetailWrapper({ id }: DossierDetailWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromPage = searchParams.get('from')
  const backHref = fromPage === 'ma-clientele' ? '/dashboard/ma-clientele' : '/dashboard/dossiers'
  const backLabel = fromPage === 'ma-clientele' ? 'Retour à ma clientèle' : 'Retour aux dossiers'
  const { consultant: currentUser } = useUser()
  const [dossier, setDossier] = React.useState<VDossiersComplets | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const [editForm, setEditForm] = React.useState<EditFormType>({})
  const [tauxGestion, setTauxGestion] = React.useState<number | null>(null)
  const [tauxEntree, setTauxEntree] = React.useState<number | null>(null)
  const [produits, setProduits] = React.useState<{ id: string; nom: string; categorie: string | null }[]>([])
  const [compagnies, setCompagnies] = React.useState<{ id: string; nom: string }[]>([])
  const [tauxMap, setTauxMap] = React.useState<{ id: string; produit_id: string | null; compagnie_id: string | null; taux: number; description: string | null }[]>([])
  const [dossierTpcId, setDossierTpcId] = React.useState<string | null>(null)
  const [autoTaux, setAutoTaux] = React.useState<number | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [editingTaux, setEditingTaux] = React.useState(false)
  const [editTauxEntree, setEditTauxEntree] = React.useState<string>('')
  const [editTauxGestion, setEditTauxGestion] = React.useState<string>('')
  const [savingTaux, setSavingTaux] = React.useState(false)
  const [consultantTauxRemuneration, setConsultantTauxRemuneration] = React.useState<number | null>(null)
  const [editApporteurExt, setEditApporteurExt] = React.useState(false)
  const [editApporteurExtNom, setEditApporteurExtNom] = React.useState('')
  const [editApporteurExtTaux, setEditApporteurExtTaux] = React.useState('')
  const [editVille, setEditVille] = React.useState<string>('')
  // Apporteurs
  const [apporteurs, setApporteurs] = React.useState<{ id: string; nom: string; prenom: string; taux_commission: number | null }[]>([])
  const [editApporteurId, setEditApporteurId] = React.useState<string>('')
  const [editApporteurTaux, setEditApporteurTaux] = React.useState<string>('')
  const [showNewApporteurModal, setShowNewApporteurModal] = React.useState(false)
  const [newApporteurNom, setNewApporteurNom] = React.useState('')
  const [newApporteurPrenom, setNewApporteurPrenom] = React.useState('')
  const [newApporteurTauxDefaut, setNewApporteurTauxDefaut] = React.useState('')
  const [savingNewApporteur, setSavingNewApporteur] = React.useState(false)
  const [editDateEntreeRelation, setEditDateEntreeRelation] = React.useState<string>('')
  const [editDateSignature, setEditDateSignature] = React.useState<string>('')
  const [editModeDetention, setEditModeDetention] = React.useState<string>('')
  // Co-titulaire
  const [coTitulaire, setCoTitulaire] = React.useState<{ id: string; nom: string; prenom: string | null } | null>(null)
  const [coTitulaireSearch, setCoTitulaireSearch] = React.useState('')
  const [coTitulaireResults, setCoTitulaireResults] = React.useState<{ id: string; nom: string; prenom: string | null }[]>([])
  const [linkedPartners, setLinkedPartners] = React.useState<{ id: string; nom: string; prenom: string | null }[]>([])
  const [coTitulaireChanged, setCoTitulaireChanged] = React.useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type EditFormType = Record<string, any>

  const isConsultant = currentUser?.role === 'consultant'

  const supabase = React.useMemo(() => createClient(), [])

  React.useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dossierRes, produitsRes, compagniesRes, tauxRes, apporteursRes] = await Promise.all([
          supabase.from('v_dossiers_complets').select('*').eq('id', id).limit(1).maybeSingle(),
          supabase.from('produits').select('id, nom, categorie').order('nom'),
          supabase.from('compagnies').select('id, nom').order('nom'),
          supabase.from('taux_produit_compagnie').select('id, produit_id, compagnie_id, taux, description').eq('actif', true),
          supabase.from('apporteurs').select('id, nom, prenom, taux_commission').order('nom'),
        ])

        if (produitsRes.data) setProduits(produitsRes.data)
        if (compagniesRes.data) setCompagnies(compagniesRes.data)
        if (tauxRes.data) setTauxMap(tauxRes.data)
        if (apporteursRes.data) setApporteurs(apporteursRes.data)

        const { data, error } = dossierRes
        if (error || !data) { setNotFound(true) }
        else {
          setDossier(data as VDossiersComplets)
          // Set consultant's taux_remuneration for calculations
          if (data.taux_remuneration !== undefined && data.taux_remuneration !== null) {
            setConsultantTauxRemuneration(data.taux_remuneration)
          }
          // Find IDs from view data by matching names to lists
          const produitId = produitsRes.data?.find((p) => p.nom === data.produit_nom)?.id || ''
          const compagnieId = compagniesRes.data?.find((c) => c.nom === data.compagnie_nom)?.id || ''
          // taux_produit_compagnie_id : prendre celui stocké sur le dossier (remonté
          // par la vue depuis 2026-04-24), sinon fallback sur la première ligne taux
          // matching (produit_id, compagnie_id).
          const storedTpcId = data.taux_produit_compagnie_id || null
          setDossierTpcId(storedTpcId)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tpcId = storedTpcId || tauxRes.data?.find((t: any) => t.produit_id === produitId && t.compagnie_id === compagnieId)?.id || ''
  setEditForm({
            statut: data.statut || 'prospect',
            montant: data.montant || '',
            financement: data.financement || 'cash',
            date_operation: data.date_operation || '',
            commentaire: data.commentaire || '',
            produit_id: produitId,
            compagnie_id: compagnieId,
            taux_produit_compagnie_id: tpcId,
            statut_kyc: data.statut_kyc || 'non',
            der: data.der ? 'oui' : 'non',
            pi: data.pi ? 'oui' : 'non',
            preco: data.preco ? 'oui' : 'non',
            lm: data.lm ? 'oui' : 'non',
            rm: data.rm ? 'oui' : 'non',
            pays: data.client_pays || '',
            email: data.client_email || '',
            telephone: data.client_telephone || '',
            ville: data.client_ville || '',
            date_entree_en_relation: data.date_entree_en_relation || '',
            date_signature: data.date_signature || '',
            mode_detention: data.mode_detention || '',
          })
          // Initialize edit state variables for new fields
          setEditVille(data.client_ville || '')
          setEditDateEntreeRelation(data.date_entree_en_relation || '')
          setEditDateSignature(data.date_signature || '')
          setEditModeDetention(data.mode_detention || '')
          // Initialize taux edit fields with current custom values (only if meaningful > 0)
          // Init taux edit fields: use custom if set (including 0%), otherwise leave blank for grille fallback
          if (data.taux_commission !== null && data.taux_commission !== undefined) {
            setEditTauxEntree((data.taux_commission * 100).toFixed(2))
          }
          if (data.taux_gestion !== null && data.taux_gestion !== undefined) {
            setEditTauxGestion((data.taux_gestion * 100).toFixed(2))
          }

          // Initialize co-titulaire from view data
          if (data.co_titulaire_id && data.co_titulaire_nom) {
            setCoTitulaire({ id: data.co_titulaire_id, nom: data.co_titulaire_nom, prenom: data.co_titulaire_prenom ?? '' })
          }
          // Fetch linked partners for the client
          if (data.client_id) {
            const { data: relations } = await supabase
              .from('client_relations')
              .select('*')
              .or(`client_id_1.eq.${data.client_id},client_id_2.eq.${data.client_id}`)
            if (relations && relations.length > 0) {
              const partnerIds = relations
                .filter((r: any) => ['concubinage', 'marie', 'pacse'].includes(r.type_relation))
                .map((r: any) => r.client_id_1 === data.client_id ? r.client_id_2 : r.client_id_1)
              if (partnerIds.length > 0) {
                const { data: partners } = await supabase
                  .from('clients')
                  .select('id, nom, prenom')
                  .in('id', partnerIds)
                if (partners) setLinkedPartners(partners as any)
              }
            }
          }
          // Initialize apporteur ext fields
          setEditApporteurExt(!!data.has_apporteur_ext)
          setEditApporteurExtNom(data.apporteur_ext_nom || '')
          setEditApporteurExtTaux(data.taux_apporteur_ext ? (data.taux_apporteur_ext * 100).toFixed(2) : '')
          // Initialize apporteur (table)
          setEditApporteurId(data.apporteur_id || '')
          setEditApporteurTaux(data.taux_apporteur_ext ? (data.taux_apporteur_ext * 100).toFixed(2) : '')

          // Fetch grille taux for entry + encours commission (LUX/PE)
          if (data.montant && data.montant > 0) {
            const prodNom = (data.produit_nom || '').toUpperCase().trim()
            const isLuxPe = ['PE', 'CAPI LUX', 'CAV LUX'].includes(prodNom)
            try {
              const [gestionRes, entreeRes] = await Promise.all([
                isLuxPe ? supabase.rpc('get_frais_taux', { p_type: 'gestion', p_encours: data.montant }) : Promise.resolve({ data: null }),
                isLuxPe ? supabase.rpc('get_frais_taux', { p_type: 'entree', p_encours: data.montant }) : Promise.resolve({ data: null }),
              ])
              if (typeof gestionRes.data === 'number' && gestionRes.data > 0) {
                setTauxGestion(gestionRes.data)
                // Pre-fill edit field with grille value only if no custom taux set (null = not set)
                if (data.taux_gestion === null || data.taux_gestion === undefined) {
                  setEditTauxGestion((gestionRes.data * 100).toFixed(2))
                }
              }
              if (typeof entreeRes.data === 'number' && entreeRes.data > 0) {
                setTauxEntree(entreeRes.data)
                // Pre-fill edit field with grille value only if no custom taux set (null = not set)
                if (data.taux_commission === null || data.taux_commission === undefined) {
                  setEditTauxEntree((entreeRes.data * 100).toFixed(2))
                }
              }
            } catch {
              // taux not available, silently ignore
            }
          }

          // Point 5.6 (2026-04-24) — Fallback grille par défaut par catégorie.
          // Si après le lookup RPC (ci-dessus) le dossier n'a toujours pas
          // de taux custom ET pas de taux RPC, on applique la grille par
          // défaut basée sur la catégorie produit (SCPI 6%/0%, PE 3%/0.7%,
          // CAV-CAPI 1%/1%). Évite qu'un dossier parte avec des frais à 0
          // quand le partenaire n'a pas encore été paramétré dans le
          // catalogue Paramètres > Catalogue.
          const categorieForFallback = data.produit_categorie || data.produit_nom
          const defaultGrille = getDefaultGrilleForCategorie(categorieForFallback)
          if (defaultGrille) {
            // Ne remplit que si (a) pas de taux custom ET (b) le champ
            // edit n'a pas déjà été pré-rempli par la branche RPC ci-dessus.
            if (
              (data.taux_commission === null || data.taux_commission === undefined) &&
              !editTauxEntree
            ) {
              setEditTauxEntree((defaultGrille.entree * 100).toFixed(2))
            }
            if (
              (data.taux_gestion === null || data.taux_gestion === undefined) &&
              !editTauxGestion &&
              defaultGrille.encours > 0
            ) {
              setEditTauxGestion((defaultGrille.encours * 100).toFixed(2))
            }
          }
        }
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [id, supabase])

  // Auto taux lookup when editing produit + compagnie
  React.useEffect(() => {
    if (isEditing && editForm.produit_id && editForm.compagnie_id) {
      const match = tauxMap.find(
        t => t.produit_id === editForm.produit_id && t.compagnie_id === editForm.compagnie_id
      )
      setAutoTaux(match ? match.taux : null)
    } else {
      setAutoTaux(null)
    }
  }, [isEditing, editForm.produit_id, editForm.compagnie_id, tauxMap])

  // Co-titulaire search
  React.useEffect(() => {
    if (coTitulaireSearch.length < 2) { setCoTitulaireResults([]); return }
    const timer = setTimeout(async () => {
      const term = `%${coTitulaireSearch}%`
      let query = supabase
        .from('clients')
        .select('id, nom, prenom')
        .or(`nom.ilike.${term},prenom.ilike.${term}`)
        .limit(6)
      if (dossier?.client_id) {
        query = query.neq('id', dossier.client_id)
      }
      const { data } = await query
      setCoTitulaireResults((data || []) as any)
    }, 300)
    return () => clearTimeout(timer)
  }, [coTitulaireSearch, dossier?.client_id, supabase])

  const editEstimatedCommission = React.useMemo(() => {
    if (autoTaux === null || !editForm.montant) return null
    return parseFloat(editForm.montant) * autoTaux
  }, [autoTaux, editForm.montant])

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditForm((prev: any) => ({ ...prev, [name]: value }))
  }

  // -------- Cascade Catégorie → Compagnie → Produit (étape 2 part 2) --------
  // `produits` table est en fait le référentiel de produits au sens métier (ACTIVIMMO,
  // COMETE, CAV LUX...). La catégorie est un attribut (SCPI, CAV, PE...) qu'on expose
  // en premier dropdown pour filtrer les compagnies puis les produits disponibles.

  const categorieSelectionnee = React.useMemo<string | ''>(() => {
    if (!editForm.produit_id) return ''
    const p = produits.find((pp) => pp.id === editForm.produit_id)
    return p?.categorie || ''
  }, [editForm.produit_id, produits])

  const categoriesDisponibles = React.useMemo<string[]>(() => {
    const s = new Set<string>()
    for (const p of produits) if (p.categorie) s.add(p.categorie)
    return Array.from(s).sort()
  }, [produits])

  // Afficher toutes les compagnies (pas de filtre par catégorie) — permet de choisir
  // un partenaire même s'il n'a pas encore de couple déclaré dans cette catégorie.
  const compagniesFiltrees = compagnies

  // Produits spécifiques = lignes taux_produit_compagnie filtrées par (categorie + compagnie).
  const couplesAvecLabel = React.useMemo(() => {
    let rows = tauxMap
    if (categorieSelectionnee) {
      const produitIdsDeCategorie = new Set(
        produits.filter((p) => p.categorie === categorieSelectionnee).map((p) => p.id)
      )
      rows = rows.filter((t) => t.produit_id && produitIdsDeCategorie.has(t.produit_id))
    }
    if (editForm.compagnie_id) {
      rows = rows.filter((t) => t.compagnie_id === editForm.compagnie_id)
    }
    return rows.map((t) => {
      const produitNom = produits.find((p) => p.id === t.produit_id)?.nom || ''
      const label = (t.description && t.description.trim()) || produitNom || '—'
      return { id: t.id, produit_id: t.produit_id, compagnie_id: t.compagnie_id, label }
    })
  }, [categorieSelectionnee, editForm.compagnie_id, produits, tauxMap])

  const handleCategorieChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value
    setEditForm((prev: any) => {
      const currentProduit = produits.find((p) => p.id === prev.produit_id)
      const shouldReset = !currentProduit || currentProduit.categorie !== newCat
      return {
        ...prev,
        produit_id: shouldReset ? '' : prev.produit_id,
        compagnie_id: shouldReset ? '' : prev.compagnie_id,
        taux_produit_compagnie_id: shouldReset ? '' : prev.taux_produit_compagnie_id,
      }
    })
    setCategorieOverride(newCat)
  }

  // Choisir un produit spécifique = choisir une ligne taux_produit_compagnie précise.
  // On rétro-remplit produit_id + compagnie_id depuis la ligne choisie.
  const handleProduitSpecifiqueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tpcId = e.target.value
    const ligne = tauxMap.find((t) => t.id === tpcId)
    setEditForm((prev: any) => ({
      ...prev,
      taux_produit_compagnie_id: tpcId,
      produit_id: ligne?.produit_id || prev.produit_id || '',
      compagnie_id: ligne?.compagnie_id || prev.compagnie_id || '',
    }))
  }

  // Shadow state : permet d'avoir une catégorie sélectionnée même quand produit_id est vide
  const [categorieOverride, setCategorieOverride] = React.useState<string>('')
  const categorieAffichee = categorieSelectionnee || categorieOverride

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      // 1. Update dossier fields (only columns that exist on dossiers table)
      const dossierUpdate: TablesUpdate<'dossiers'> = {
        statut: editForm.statut,
        montant: parseFloat(editForm.montant) || 0,
        financement: editForm.financement || null,
        date_operation: editForm.date_operation || null,
        commentaire: editForm.commentaire || null,
        produit_id: editForm.produit_id || null,
        compagnie_id: editForm.compagnie_id || null,
        date_entree_en_relation: editForm.date_entree_en_relation || null,
        date_signature: editForm.date_signature || null,
        mode_detention: editForm.mode_detention || null,
      }
      // FK vers la ligne taux_produit_compagnie spécifique (colonne ajoutée 2026-04-24).
      // Types Supabase pas encore régénérés : cast via any le temps que database.ts soit à jour.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(dossierUpdate as any).taux_produit_compagnie_id = editForm.taux_produit_compagnie_id || null
      // Include co_titulaire_id if changed
      if (coTitulaireChanged) {
        dossierUpdate.co_titulaire_id = coTitulaire?.id || null
      }
      const { error: dossierError } = await supabase.from('dossiers').update(dossierUpdate).eq('id', id)

      if (dossierError) { setSaveError(dossierError.message); setSaving(false); return }

      // 1b. Recalculate commissions if montant changed
      // V4 (2026-04-25) — utilise la grille DB commission_split_rules
      // (loadCommissionRules + computeCommissionEntreeSplits) au lieu de
      // la formule binaire consultant/cabinet historique. Stocke les 6
      // parts + rule_key + snapshot pour traçabilité.
      const newMontant = parseFloat(editForm.montant) || 0
      if (newMontant !== dossier?.montant && newMontant > 0) {
        const taux = effectiveTauxEntree
        if (taux && taux > 0) {
          const commissionBrute = newMontant * taux
          const commUpdate: TablesUpdate<'commissions'> = {
            commission_brute: commissionBrute,
          }

          // Deduct apporteur ext share
          let commissionNette = commissionBrute
          if (dossier?.has_apporteur_ext && dossier?.taux_apporteur_ext) {
            const remApporteurExt = commissionBrute * dossier.taux_apporteur_ext
            commUpdate.rem_apporteur_ext = remApporteurExt
            commissionNette = commissionBrute - remApporteurExt
          } else {
            commUpdate.rem_apporteur_ext = 0
          }

          if (consultantTauxRemuneration !== null && consultantTauxRemuneration !== undefined && dossier) {
            // Charge la grille de splits depuis la DB (cache 1 min, fallback statique).
            const rules = await loadCommissionRules()
            // 2026-04-26 — compagnie_nom + produit_nom passés pour matcher
            // SG/ABF/TRILAKE quand consultant = Stéphane.
            const splits = computeCommissionEntreeSplits(
              {
                prenom: dossier.consultant_prenom ?? '',
                nom: dossier.consultant_nom ?? '',
                taux_remuneration: consultantTauxRemuneration,
              },
              { apporteur_label: dossier.apporteur_label ?? null },
              commissionNette,
              rules,
              dossier.compagnie_nom ?? null,
              dossier.produit_nom ?? null,
            )
            commUpdate.rem_apporteur = splits.rem_apporteur
            commUpdate.part_cabinet  = splits.part_cabinet
            commUpdate.pct_cabinet   = commissionBrute > 0 ? splits.part_cabinet / commissionBrute : 0
            // V4 colonnes additionnelles (cf. migration 2026-04-25_commissions_split_columns).
            // Cast `as any` car types Supabase pas encore régénérés post-migration.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const update = commUpdate as any
            update.part_consultant = splits.part_consultant
            update.part_pool_plus  = splits.part_pool_plus
            update.part_thelo      = splits.part_thelo
            update.part_maxine     = splits.part_maxine
            update.part_stephane   = splits.part_stephane
            update.applied_rule_key = splits.applied_rule_key
            update.applied_split_snapshot = splits.applied_split_snapshot
          }
          await supabase.from('commissions').update(commUpdate).eq('dossier_id', id)
        }
      }

      // 2. Update client fields (réglementaire + pays — columns on clients table)
      // 2026-04-26 — La conformité réglementaire (statut_kyc, der, pi, preco,
      // lm, rm) ne peut être modifiée que par managers + back-office. Les
      // consultants peuvent quand même modifier pays/ville/email/téléphone.
      const isManagerOrBO =
        currentUser?.role === 'manager' || currentUser?.role === 'back_office'
      const clientId = dossier?.client_id
      if (clientId) {
        const clientUpdate: TablesUpdate<'clients'> = {}
        if (isManagerOrBO) {
          clientUpdate.statut_kyc = editForm.statut_kyc || 'non'
          clientUpdate.der        = editForm.der === 'oui'
          clientUpdate.pi         = editForm.pi === 'oui'
          clientUpdate.preco      = editForm.preco === 'oui'
          clientUpdate.lm         = editForm.lm === 'oui'
          clientUpdate.rm         = editForm.rm === 'oui'
        }
        if (editForm.pays) clientUpdate.pays = editForm.pays
        if (editForm.ville) clientUpdate.ville = editForm.ville
        clientUpdate.email = editForm.email || null
        clientUpdate.telephone = editForm.telephone || null
        const { error: clientError } = await supabase.from('clients').update(clientUpdate).eq('id', clientId)
        if (clientError) { setSaveError(clientError.message); setSaving(false); return }
      }

      // Refresh view data
      const { data } = await supabase.from('v_dossiers_complets').select('*').eq('id', id).limit(1).maybeSingle()
      if (data) {
        setDossier(data as VDossiersComplets)
        // Refresh co-titulaire display from refreshed data
        if (data.co_titulaire_id && data.co_titulaire_nom) {
          setCoTitulaire({ id: data.co_titulaire_id, nom: data.co_titulaire_nom, prenom: data.co_titulaire_prenom ?? '' })
        } else {
          setCoTitulaire(null)
        }
      }
      setCoTitulaireChanged(false)
      setIsEditing(false)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde'
      setSaveError(message)
    }
    finally { setSaving(false) }
  }

  const handleSaveTaux = async () => {
    if (!dossier?.id) return

    // Validate taux values before saving
    if (editTauxEntree.trim()) {
      const tauxVal = parseFloat(editTauxEntree)
      if (isNaN(tauxVal) || tauxVal < 0 || tauxVal > 100) {
        setSaveError('Le taux d\'entrée doit être compris entre 0 et 100%')
        return
      }
    }
    if (editTauxGestion.trim()) {
      const tauxGVal = parseFloat(editTauxGestion)
      if (isNaN(tauxGVal) || tauxGVal < 0 || tauxGVal > 100) {
        setSaveError('Le taux de gestion doit être compris entre 0 et 100%')
        return
      }
    }
    const effectiveTauxApporteur = editApporteurId ? editApporteurTaux : editApporteurExtTaux
    if (editApporteurExt && effectiveTauxApporteur) {
      const tauxApVal = parseFloat(effectiveTauxApporteur)
      if (isNaN(tauxApVal) || tauxApVal < 0 || tauxApVal > 100) {
        setSaveError('Le taux apporteur doit être compris entre 0 et 100%')
        return
      }
    }

    setSavingTaux(true)
    try {
      const updateData: any = {}

      // Parse and convert percentages to decimals
      if (editTauxEntree.trim()) {
        const tauxEntreeDecimal = parseFloat(editTauxEntree) / 100
        updateData.taux_commission = tauxEntreeDecimal
        // Calculate commission_brute and rem_apporteur
        if (dossier.montant && dossier.montant > 0) {
          updateData.commission_brute = dossier.montant * tauxEntreeDecimal

          // Deduct apporteur ext share — use dropdown taux if apporteur selected, else legacy field
          let commissionNette = updateData.commission_brute
          const effectiveApporteurTaux = editApporteurId ? editApporteurTaux : editApporteurExtTaux
          if (editApporteurExt && effectiveApporteurTaux) {
            const tauxApporteur = parseFloat(effectiveApporteurTaux) / 100
            updateData.rem_apporteur_ext = updateData.commission_brute * tauxApporteur
            commissionNette = updateData.commission_brute - updateData.rem_apporteur_ext
          } else {
            updateData.rem_apporteur_ext = 0
          }

          if (consultantTauxRemuneration !== null && consultantTauxRemuneration !== undefined && dossier) {
            // V4 (2026-04-25) — utilise la grille DB commission_split_rules
            // pour répartir entre consultant / pool / thélo / maxine /
            // stéphane / cabinet selon la rule applicable au dossier.
            // 2026-04-26 — compagnie_nom + produit_nom pour le matching SG.
            const rules = await loadCommissionRules()
            const splits = computeCommissionEntreeSplits(
              {
                prenom: dossier.consultant_prenom ?? '',
                nom: dossier.consultant_nom ?? '',
                taux_remuneration: consultantTauxRemuneration,
              },
              { apporteur_label: dossier.apporteur_label ?? null },
              commissionNette,
              rules,
              dossier.compagnie_nom ?? null,
              dossier.produit_nom ?? null,
            )
            updateData.rem_apporteur = splits.rem_apporteur
            updateData.part_cabinet  = splits.part_cabinet
            updateData.pct_cabinet   = updateData.commission_brute > 0
              ? splits.part_cabinet / updateData.commission_brute
              : 0
            // Colonnes V4 ajoutées par scripts/migrations/2026-04-25_commissions_split_columns.sql.
            updateData.part_consultant     = splits.part_consultant
            updateData.part_pool_plus      = splits.part_pool_plus
            updateData.part_thelo          = splits.part_thelo
            updateData.part_maxine         = splits.part_maxine
            updateData.part_stephane       = splits.part_stephane
            updateData.applied_rule_key    = splits.applied_rule_key
            updateData.applied_split_snapshot = splits.applied_split_snapshot
          }
        }
      }

      if (editTauxGestion.trim()) {
        const tauxGestionDecimal = parseFloat(editTauxGestion) / 100
        updateData.taux_gestion = tauxGestionDecimal
      }

      // Save apporteur externe to dossiers table
      const apporteurUpdate: TablesUpdate<'dossiers'> = {
        has_apporteur_ext: editApporteurExt,
        apporteur_ext_nom: editApporteurExt ? (editApporteurId ? (() => { const found = apporteurs.find(a => a.id === editApporteurId); return found ? found.prenom + ' ' + found.nom : editApporteurExtNom || null; })() : editApporteurExtNom || null) : null,
        apporteur_id: editApporteurExt && editApporteurId ? editApporteurId : null,
        taux_apporteur_ext: editApporteurExt && editApporteurTaux ? parseFloat(editApporteurTaux) / 100 : 0,
      }
      const { error: apporteurError } = await supabase.from('dossiers').update(apporteurUpdate).eq('id', dossier.id)
      if (apporteurError) throw apporteurError

      // Upsert commissions: update if exists, insert if not
      const { data: existingCommission } = await supabase
        .from('commissions')
        .select('id')
        .eq('dossier_id', dossier.id)
        .maybeSingle()

      if (existingCommission) {
        const { error } = await supabase
          .from('commissions')
          .update(updateData)
          .eq('dossier_id', dossier.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('commissions')
          .insert({ dossier_id: dossier.id, ...updateData })
        if (error) throw error
      }

      // Refresh dossier data
      const { data } = await supabase.from('v_dossiers_complets').select('*').eq('id', dossier.id).limit(1).maybeSingle()
      if (data) {
        setDossier(data as VDossiersComplets)
        // Re-initialize taux edit fields with updated values (null = not set)
        if (data.taux_commission !== null && data.taux_commission !== undefined) {
          setEditTauxEntree((data.taux_commission * 100).toFixed(2))
        }
        if (data.taux_gestion !== null && data.taux_gestion !== undefined) {
          setEditTauxGestion((data.taux_gestion * 100).toFixed(2))
        }
        // Re-initialize apporteur ext fields with updated values
        setEditApporteurExt(!!data.has_apporteur_ext)
        setEditApporteurExtNom(data.apporteur_ext_nom || '')
        setEditApporteurExtTaux(data.taux_apporteur_ext ? (data.taux_apporteur_ext * 100).toFixed(2) : '')
        setEditApporteurId(data.apporteur_id || '')
        setEditApporteurTaux(data.taux_apporteur_ext ? (data.taux_apporteur_ext * 100).toFixed(2) : '')
      }

      setEditingTaux(false)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de la sauvegarde des taux'
      setSaveError(message)
    } finally {
      setSavingTaux(false)
    }
  }

  // Delete handler — only for non-finalized dossiers
  const canDelete = dossier && !isConsultant
  const handleDelete = async () => {
    if (!dossier?.id) return
    setDeleting(true)
    try {
      // Delete related records first (FK constraints)
      const { error: docsError } = await supabase.from('dossier_documents').delete().eq('dossier_id', dossier.id)
      if (docsError) throw docsError
      // Delete relances
      const { error: relError } = await supabase.from('relances').delete().eq('dossier_id', dossier.id)
      if (relError) throw relError
      // Delete factures (FK constraint)
      const { error: factError } = await supabase.from('factures').delete().eq('dossier_id', dossier.id)
      if (factError) throw factError
      // Delete commissions
      const { error: commError } = await supabase.from('commissions').delete().eq('dossier_id', dossier.id)
      if (commError) throw commError
      // Delete dossier
      const { error } = await supabase.from('dossiers').delete().eq('id', dossier.id)
      if (error) throw error
      router.push(dossier.client_id ? `/dashboard/clients/${dossier.client_id}` : '/dashboard/dossiers')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de la suppression'
      setSaveError(message)
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Encours only for PE, CAPI LUX, CAV LUX
  const dossierHasEncours = React.useMemo(() => {
    const nom = (dossier?.produit_nom || '').toUpperCase().trim()
    return ['PE', 'CAPI LUX', 'CAV LUX'].includes(nom)
  }, [dossier?.produit_nom])

  // Effective taux: prefer custom (saved in commissions) over grille default
  // NULL = not set (use grille), 0 = explicitly 0% (no commission), >0 = custom taux
  const effectiveTauxEntree = React.useMemo(() =>
    (dossier?.taux_commission !== null && dossier?.taux_commission !== undefined)
      ? dossier.taux_commission : tauxEntree,
    [dossier?.taux_commission, tauxEntree]
  )
  const effectiveTauxGestion = React.useMemo(() =>
    (dossier?.taux_gestion !== null && dossier?.taux_gestion !== undefined)
      ? dossier.taux_gestion : tauxGestion,
    [dossier?.taux_gestion, tauxGestion]
  )

  // Compute quarterly encours commission for this dossier
  const quarterlyEncoursCommission = React.useMemo(() => {
    if (!dossierHasEncours) return null
    const taux = effectiveTauxGestion
    if (!dossier?.montant || !taux) return null
    const montant = dossier.montant
    const annual = montant * taux
    // Both manager and consultant see the same quarterly total
    return annual / 4
  }, [dossier, effectiveTauxGestion, dossierHasEncours])

  // Part consultant on encours: consultant's share of the quarterly commission
  const partConsultantEncours = React.useMemo(() => {
    if (quarterlyEncoursCommission === null) return null
    if (consultantTauxRemuneration !== null && consultantTauxRemuneration !== undefined) {
      return quarterlyEncoursCommission * consultantTauxRemuneration
    }
    return null
  }, [quarterlyEncoursCommission, consultantTauxRemuneration])

  // Entry commission: use effective taux (custom if set, otherwise grille)
  const commissionBruteCalculee = React.useMemo(() =>
    effectiveTauxEntree && dossier?.montant
      ? dossier.montant * effectiveTauxEntree
      : dossier?.commission_brute ?? null,
    [effectiveTauxEntree, dossier?.montant, dossier?.commission_brute]
  )
  // Réglementaire: count of validated fields (PRECO comptabilisé)
  const reglementaireFields = React.useMemo(() => [
    dossier?.statut_kyc === 'oui',
    !!dossier?.der, !!dossier?.pi, !!dossier?.preco, !!dossier?.lm, !!dossier?.rm,
  ], [dossier?.statut_kyc, dossier?.der, dossier?.pi, dossier?.preco, dossier?.lm, dossier?.rm])
  const reglementaireDone = React.useMemo(() => reglementaireFields.filter(Boolean).length, [reglementaireFields])

  // Part consultant from entry: use consultantTauxRemuneration directly
  // IMPORTANT: all useMemo MUST be before early returns to respect React hook rules
  // Calcul apporteur
  const tauxApporteurEffectif = React.useMemo(() => {
    if (!dossier?.has_apporteur_ext) return 0
    return dossier?.taux_apporteur_ext || 0
  }, [dossier?.has_apporteur_ext, dossier?.taux_apporteur_ext])

  const partApporteurCalculee = React.useMemo(() => {
    if (!commissionBruteCalculee || tauxApporteurEffectif <= 0) return 0
    return commissionBruteCalculee * tauxApporteurEffectif
  }, [commissionBruteCalculee, tauxApporteurEffectif])

  const commissionNetteApporteur = React.useMemo(() => {
    if (!commissionBruteCalculee) return null
    return commissionBruteCalculee - partApporteurCalculee
  }, [commissionBruteCalculee, partApporteurCalculee])

  const partConsultantEntree = React.useMemo(() => {
    if (!commissionNetteApporteur) return dossier?.rem_apporteur ?? null
    if (consultantTauxRemuneration !== null && consultantTauxRemuneration !== undefined) {
      return commissionNetteApporteur * consultantTauxRemuneration
    }
    return dossier?.rem_apporteur ?? null
  }, [commissionNetteApporteur, consultantTauxRemuneration, dossier?.rem_apporteur])

  // Nom apporteur résolu
  const apporteurNomResolu = React.useMemo(() => {
    if (!dossier?.has_apporteur_ext) return null
    const apporteurId = dossier?.apporteur_id
    if (apporteurId) {
      const found = apporteurs.find(a => a.id === apporteurId)
      if (found) return `${found.prenom} ${found.nom}`
    }
    return (dossier as any).apporteur_nom_complet || dossier?.apporteur_ext_nom || 'Apporteur externe'
  }, [dossier, apporteurs])

  // Breakdown complet pour managers/BO
  const breakdownComplet = React.useMemo(() => {
    if (!commissionNetteApporteur || !consultantTauxRemuneration) return null
    const net = commissionNetteApporteur
    const partConsultant = net * consultantTauxRemuneration
    const partCabinet = dossier?.part_cabinet ?? (net * 0.25)
    const partPool = net - partConsultant - partCabinet
    return {
      brute: commissionBruteCalculee || 0,
      apporteur: partApporteurCalculee,
      nette: net,
      consultant: partConsultant,
      pool: partPool > 0 ? partPool : 0,
      cabinet: partCabinet,
    }
  }, [commissionNetteApporteur, consultantTauxRemuneration, commissionBruteCalculee, partApporteurCalculee, dossier?.part_cabinet])

  // ââ Créer un nouvel apporteur à la volée
  const handleCreateApporteur = async () => {
    if (!newApporteurNom.trim() || !newApporteurPrenom.trim()) return
    setSavingNewApporteur(true)
    try {
      const { data, error } = await supabase.from('apporteurs').insert({
        nom: newApporteurNom.trim(),
        prenom: newApporteurPrenom.trim(),
        taux_commission: newApporteurTauxDefaut ? parseFloat(newApporteurTauxDefaut) / 100 : 0,
        created_by: currentUser?.id || null,
      }).select().single()
      if (error) throw error
      const newAp = data as { id: string; prenom: string; nom: string; taux_commission: number }
      setApporteurs(prev => [...prev, newAp].sort((a: any, b: any) => a.nom.localeCompare(b.nom)))
      setEditApporteurId(newAp.id)
      if (newAp.taux_commission > 0) setEditApporteurTaux((newAp.taux_commission * 100).toFixed(2))
      setShowNewApporteurModal(false)
      setNewApporteurNom('')
      setNewApporteurPrenom('')
      setNewApporteurTauxDefaut('')
      // Auto-save: link new apporteur to dossier immediately
      if (dossier?.id) {
        const nomComplet = newAp.prenom + ' ' + newAp.nom
        await supabase.from('dossiers').update({
          has_apporteur_ext: true,
          apporteur_id: newAp.id,
          apporteur_ext_nom: nomComplet,
          taux_apporteur_ext: newAp.taux_commission || 0,
        }).eq('id', dossier.id)
        const { data: refreshed } = await supabase.from('v_dossiers_complets').select('*').eq('id', dossier.id).limit(1).maybeSingle()
        if (refreshed) setDossier(refreshed as VDossiersComplets)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erreur inconnue'
      console.error('[dossier-detail] handleCreateApporteur failed:', err)
      alert('Creation de l\'apporteur impossible : ' + msg)
    } finally {
      setSavingNewApporteur(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  if (notFound || !dossier) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dossier non trouvé</h1>
        <Link href={backHref}><Button variant="outline">{backLabel}</Button></Link>
      </div>
    )
  }

  const facturationStatus = dossier.facturee
    ? dossier.payee === 'oui' ? ('payée' as const) : ('émise' as const)
    : ('à émettre' as const)

  const hasCommissionData = !!(
    dossier.commission_brute ||
    dossier.rem_apporteur ||
    tauxEntree ||
    effectiveTauxGestion ||
    // Fallback : afficher le bloc Détail commission dès qu'un dossier a produit/compagnie/montant,
    // même si les taux calculés de la vue v_dossiers_complets sont NULL (bug SCPI ALDERAN 2026-04-23)
    (dossier.produit_nom && dossier.compagnie_nom && Number(dossier.montant) > 0)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={backHref}>
            <Button variant="ghost" className="gap-2"><ArrowLeft size={18} />{backLabel}</Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dossier #{dossier.id?.slice(0, 8).toUpperCase()}</h1>
            <p className="text-gray-600 mt-1">
              {dossier.client_id ? (
                <Link href={`/dashboard/clients/${dossier.client_id}`} className="text-indigo-600 hover:underline">
                  {dossier.client_prenom} {dossier.client_nom}
                </Link>
              ) : (
                <span>{dossier.client_prenom} {dossier.client_nom}</span>
              )}
            </p>
          </div>
        </div>
        {canDelete && (
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Confirmer ?</span>
                <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>Annuler</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-2" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Supprimer
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={14} />
                Supprimer
              </Button>
            )}
          </div>
        )}
      </div>

      {saveError && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{saveError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Informations du dossier</CardTitle>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => { setIsEditing(false); setSaveError('') }}>
                        <X size={16} />Annuler
                      </Button>
                      <Button size="sm" className="gap-2 bg-navy-700 hover:bg-navy-800" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Sauvegarder
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsEditing(true)}>
                      <Edit size={16} />Modifier
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Co-titulaire section */}
              {isEditing ? (
                <div className="p-3 bg-pink-50 border border-pink-200 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Heart size={12} className="text-pink-400" /> Co-titulaire (opération conjointe)
                  </p>
                  {coTitulaire ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{coTitulaire.prenom} {coTitulaire.nom}</span>
                      <button type="button" onClick={() => { setCoTitulaire(null); setCoTitulaireChanged(true) }}
                        className="p-0.5 hover:bg-pink-100 rounded"><X size={14} className="text-gray-400" /></button>
                    </div>
                  ) : (
                    <>
                      {linkedPartners.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {linkedPartners.map(p => (
                            <button key={p.id} type="button"
                              onClick={() => { setCoTitulaire(p); setCoTitulaireChanged(true); setCoTitulaireSearch('') }}
                              className="text-xs px-2 py-1 bg-white border border-pink-200 rounded-full hover:bg-pink-100 transition-colors">
                              {p.prenom} {p.nom}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Rechercher un co-titulaire..."
                          value={coTitulaireSearch} onChange={(e) => setCoTitulaireSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-pink-400 focus:border-pink-400" />
                      </div>
                      {coTitulaireResults.length > 0 && (
                        <div className="border border-gray-200 rounded bg-white max-h-32 overflow-y-auto">
                          {coTitulaireResults.map(c => (
                            <button key={c.id} type="button"
                              onClick={() => { setCoTitulaire(c); setCoTitulaireChanged(true); setCoTitulaireSearch(''); setCoTitulaireResults([]) }}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-pink-50 transition-colors">
                              {c.prenom} {c.nom}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : coTitulaire ? (
                <div className="flex items-center gap-2 p-3 bg-pink-50 border border-pink-200 rounded-lg mb-2">
                  <Heart size={16} className="text-pink-400 shrink-0" />
                  <span className="text-sm text-gray-600">Opération conjointe avec</span>
                  <Link href={`/dashboard/clients/${coTitulaire.id}`} className="text-sm font-semibold text-indigo-600 hover:underline">
                    {coTitulaire.prenom} {coTitulaire.nom}
                  </Link>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Client</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.client_prenom} {dossier.client_nom}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Pays</p>
                  {isEditing ? (
                    <Input name="pays" value={editForm.pays} onChange={handleEditChange} className="mt-1" placeholder="France" />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.client_pays || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Ville</p>
                  {isEditing ? (
                    <Input name="ville" value={editForm.ville} onChange={handleEditChange} className="mt-1" placeholder="Paris" />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.client_ville || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  {isEditing ? (
                    <Input name="email" type="email" value={editForm.email} onChange={handleEditChange} className="mt-1" placeholder="client@email.com" />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.client_email || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Téléphone</p>
                  {isEditing ? (
                    <Input name="telephone" value={editForm.telephone} onChange={handleEditChange} className="mt-1" placeholder="+33 6 12 34 56 78" />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.client_telephone || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Catégorie</p>
                  {isEditing ? (
                    <Select name="__categorie" value={categorieAffichee} onChange={handleCategorieChange} className="mt-1">
                      <option value="">— Aucune —</option>
                      {categoriesDisponibles.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.produit_categorie || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Compagnie</p>
                  {isEditing ? (
                    <Select name="compagnie_id" value={editForm.compagnie_id} onChange={handleEditChange} className="mt-1">
                      <option value="">— Aucune —</option>
                      {compagniesFiltrees.map((c) => (
                        <option key={c.id} value={c.id}>{c.nom}</option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.compagnie_nom || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Produit</p>
                  {isEditing ? (
                    <Select
                      name="__taux_produit_compagnie_id"
                      value={editForm.taux_produit_compagnie_id || ''}
                      onChange={handleProduitSpecifiqueChange}
                      className="mt-1"
                    >
                      <option value="">— Aucun —</option>
                      {couplesAvecLabel.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {(() => {
                        // Priorité 1 : la description remontée par la vue (taux_produit_compagnie_description)
                        const viewDesc = dossier.taux_produit_compagnie_description?.trim()
                        if (viewDesc) return viewDesc
                        // Fallback 1 : lookup sur tauxMap avec l'id stocké
                        const tpc = dossierTpcId
                          ? tauxMap.find((t) => t.id === dossierTpcId)
                          : tauxMap.find(
                              (t) =>
                                t.produit_id === produits.find((p) => p.nom === dossier.produit_nom)?.id &&
                                t.compagnie_id === compagnies.find((c) => c.nom === dossier.compagnie_nom)?.id
                            )
                        return (tpc?.description && tpc.description.trim()) || dossier.produit_nom || '-'
                      })()}
                    </p>
                  )}
                </div>
                {isEditing && editForm.produit_id && editForm.compagnie_id && autoTaux === null && (
                  <div className="col-span-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-xs text-amber-700">Aucun taux configuré pour cette combinaison produit/compagnie</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-500">Stade relationnel</p>
                  {isEditing ? (
                    <Select name="statut" value={editForm.statut} onChange={handleEditChange} className="mt-1">
                      <option value="prospect">Prospect</option>
                      <option value="client_en_cours">Client en cours</option>
                      <option value="client_finalise">Client finalisé</option>
                      <option value="non_abouti">Non abouti</option>
                    </Select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{statutLabel(dossier.statut)}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Montant</p>
                  {isEditing ? (
                    <Input name="montant" type="number" value={editForm.montant} onChange={handleEditChange} className="mt-1" step="0.01" />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(dossier.montant)}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Financement</p>
                  {isEditing ? (
                    <Select name="financement" value={editForm.financement} onChange={handleEditChange} className="mt-1">
                      <option value="cash">Cash</option>
                      <option value="credit">Crédit</option>
                      <option value="lombard">Lombard</option>
                      <option value="remploi">Remploi</option>
                    </Select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1 capitalize">{dossier.financement || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date entrée en relation</p>
                  {isEditing ? (
                    <Input name="date_entree_en_relation" type="date" value={editForm.date_entree_en_relation} onChange={handleEditChange} className="mt-1" />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {dossier.date_entree_en_relation ? new Date(dossier.date_entree_en_relation).toLocaleDateString('fr-FR') : '-'}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date de réalisation</p>
                  {isEditing ? (
                    <Input name="date_signature" type="date" value={editForm.date_signature} onChange={handleEditChange} className="mt-1" />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {dossier.date_signature ? new Date(dossier.date_signature).toLocaleDateString('fr-FR') : '-'}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Mode de détention</p>
                  {isEditing ? (
                    <Select name="mode_detention" value={editForm.mode_detention} onChange={handleEditChange} className="mt-1">
                      <option value="">— Aucun —</option>
                      <option value="PP">Pleine Propriété</option>
                      <option value="NP">Nue-Propriété</option>
                      <option value="US">Usufruit</option>
                    </Select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {dossier.mode_detention === 'PP' ? 'Pleine Propriété' : dossier.mode_detention === 'NP' ? 'Nue-Propriété' : dossier.mode_detention === 'US' ? 'Usufruit' : dossier.mode_detention || '-'}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Consultant</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.consultant_prenom} {dossier.consultant_nom}</p>
                </div>
              </div>

              {isEditing ? (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Commentaire</p>
                  <textarea name="commentaire" value={editForm.commentaire} onChange={handleEditChange}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500"
                    rows={3} />
                </div>
              ) : dossier.commentaire ? (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-500">Commentaire</p>
                  <p className="text-gray-700 mt-1">{dossier.commentaire}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Commission Panel — visible for all statuses if data is available */}
          {hasCommissionData && (
            <CommissionPanel
              dossier={dossier}
              isConsultant={isConsultant}
              editingTaux={editingTaux}
              editTauxEntree={editTauxEntree}
              editTauxGestion={editTauxGestion}
              savingTaux={savingTaux}
              dossierHasEncours={dossierHasEncours}
              tauxEntree={tauxEntree}
              tauxGestion={tauxGestion}
              effectiveTauxEntree={effectiveTauxEntree}
              effectiveTauxGestion={effectiveTauxGestion}
              commissionBruteCalculee={commissionBruteCalculee}
              quarterlyEncoursCommission={quarterlyEncoursCommission}
              partConsultantEntree={partConsultantEntree}
              partConsultantEncours={partConsultantEncours}
              onEditTauxEntreeChange={setEditTauxEntree}
              onEditTauxGestionChange={setEditTauxGestion}
              onEditApporteurExtChange={setEditApporteurExt}
              onEditApporteurExtNomChange={setEditApporteurExtNom}
              onEditApporteurExtTauxChange={setEditApporteurExtTaux}
              onToggleEditing={() => setEditingTaux(!editingTaux)}
              onSaveTaux={handleSaveTaux}
              editApporteurExt={editApporteurExt}
              editApporteurExtNom={editApporteurExtNom}
              editApporteurExtTaux={editApporteurExtTaux}
              apporteurs={apporteurs}
              editApporteurId={editApporteurId}
              editApporteurTaux={editApporteurTaux}
              showNewApporteurModal={showNewApporteurModal}
              newApporteurNom={newApporteurNom}
              newApporteurPrenom={newApporteurPrenom}
              newApporteurTauxDefaut={newApporteurTauxDefaut}
              savingNewApporteur={savingNewApporteur}
              onEditApporteurIdChange={setEditApporteurId}
              onEditApporteurTauxChange={setEditApporteurTaux}
              onShowNewApporteurModalChange={setShowNewApporteurModal}
              onNewApporteurNomChange={setNewApporteurNom}
              onNewApporteurPrenomChange={setNewApporteurPrenom}
              onNewApporteurTauxDefautChange={setNewApporteurTauxDefaut}
              onCreateApporteur={handleCreateApporteur}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Statuts</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-2">Dossier</p>
                <StatusBadge status={mapStatutForBadge(dossier.statut)} type="dossier" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Facturation</p>
                <StatusBadge status={facturationStatus} type="facturation" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">KYC</p>
                <StatusBadge status={(dossier.statut_kyc as 'non' | 'en_cours' | 'oui') || 'non'} type="kyc" />
              </div>
            </CardContent>
          </Card>

          {/* 2026-04-26 — Validation conformité réservée aux managers + back-office.
              Pour les consultants, on force isEditing à false sur ce panneau
              même si le mode édition global du dossier est actif. */}
          <CompliancePanel
            isEditing={
              isEditing &&
              (currentUser?.role === 'manager' || currentUser?.role === 'back_office')
            }
            reglementaireDone={reglementaireDone}
            dossier={dossier}
            editForm={editForm}
            onEditFormChange={(name, value) => setEditForm((prev: any) => ({ ...prev, [name]: value }))}
          />

          {/* Document Checklist */}
          <DocumentChecklist dossierId={id} produitNom={dossier.produit_nom} />

          {/* Relances pour ce dossier */}
          {dossier.client_id && (
            <ClientRelances clientId={dossier.client_id} dossierId={id} compact />
          )}

          <Card>
            <CardHeader>
              <Link href="/dashboard/facturation" className="group flex items-center gap-1">
                <CardTitle className="text-lg group-hover:text-indigo-600 transition-colors">Facturation</CardTitle>
                <ExternalLink size={14} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Facturée</p>
                <Badge variant={dossier.facturee ? 'success' : 'destructive'} className="mt-1">
                  {dossier.facturee ? 'Oui' : 'Non'}
                </Badge>
              </div>
              {dossier.date_facture && (
                <div>
                  <p className="text-sm text-gray-600">Date facture</p>
                  <p className="font-semibold text-gray-900 mt-1">{new Date(dossier.date_facture).toLocaleDateString('fr-FR')}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Payée</p>
                <Badge variant={dossier.payee === 'oui' ? 'success' : 'destructive'} className="mt-1">
                  {dossier.payee === 'oui' ? 'Oui' : 'Non'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Historique des modifications (audit_logs) */}
          <DossierHistory dossierId={id} />
        </div>
      </div>
    </div>
  )
}
