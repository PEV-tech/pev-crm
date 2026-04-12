'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, Loader2, Trash2, ExternalLink } from 'lucide-react'
import { DocumentChecklist } from '@/components/shared/document-checklist'
import { ClientRelances } from '@/components/shared/client-relances'
import { CommissionPanel } from '@/components/dossiers/commission-panel'
import { CompliancePanel } from '@/components/dossiers/compliance-panel'

import { formatCurrency } from '@/lib/formatting'

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
  const [produits, setProduits] = React.useState<{ id: string; nom: string }[]>([])
  const [compagnies, setCompagnies] = React.useState<{ id: string; nom: string }[]>([])
  const [tauxMap, setTauxMap] = React.useState<{ produit_id: string | null; compagnie_id: string | null; taux: number }[]>([])
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
  const [editDateEntreeRelation, setEditDateEntreeRelation] = React.useState<string>('')
  const [editDateSignature, setEditDateSignature] = React.useState<string>('')
  const [editModeDetention, setEditModeDetention] = React.useState<string>('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type EditFormType = Record<string, any>

  const isConsultant = currentUser?.role === 'consultant'

  const supabase = React.useMemo(() => createClient(), [])

  React.useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dossierRes, produitsRes, compagniesRes, tauxRes] = await Promise.all([
          supabase.from('v_dossiers_complets').select('*').eq('id', id).limit(1).maybeSingle(),
          supabase.from('produits').select('id, nom').order('nom'),
          supabase.from('compagnies').select('id, nom').order('nom'),
          supabase.from('taux_produit_compagnie').select('produit_id, compagnie_id, taux').eq('actif', true),
        ])

        if (produitsRes.data) setProduits(produitsRes.data)
        if (compagniesRes.data) setCompagnies(compagniesRes.data)
        if (tauxRes.data) setTauxMap(tauxRes.data)

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
          setEditForm({
            statut: data.statut || 'prospect',
            montant: data.montant || '',
            financement: data.financement || 'cash',
            date_operation: data.date_operation || '',
            commentaire: data.commentaire || '',
            produit_id: produitId,
            compagnie_id: compagnieId,
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

          // Initialize apporteur ext fields
          setEditApporteurExt(!!data.has_apporteur_ext)
          setEditApporteurExtNom(data.apporteur_ext_nom || '')
          setEditApporteurExtTaux(data.taux_apporteur_ext ? (data.taux_apporteur_ext * 100).toFixed(2) : '')

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

  const editEstimatedCommission = React.useMemo(() => {
    if (autoTaux === null || !editForm.montant) return null
    return parseFloat(editForm.montant) * autoTaux
  }, [autoTaux, editForm.montant])

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditForm((prev: any) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      // 1. Update dossier fields (only columns that exist on dossiers table)
      const { error: dossierError } = await supabase.from('dossiers').update({
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
      }).eq('id', id)

      if (dossierError) { setSaveError(dossierError.message); setSaving(false); return }

      // 1b. Recalculate commissions if montant changed
      const newMontant = parseFloat(editForm.montant) || 0
      if (newMontant !== dossier?.montant && newMontant > 0) {
        const taux = effectiveTauxEntree
        if (taux && taux > 0) {
          const commUpdate: Record<string, any> = {
            commission_brute: newMontant * taux,
          }

          // Deduct apporteur ext share
          let commissionNette = commUpdate.commission_brute
          if (dossier?.has_apporteur_ext && dossier?.taux_apporteur_ext) {
            commUpdate.rem_apporteur_ext = commUpdate.commission_brute * dossier.taux_apporteur_ext
            commissionNette = commUpdate.commission_brute - commUpdate.rem_apporteur_ext
          } else {
            commUpdate.rem_apporteur_ext = 0
          }

          if (consultantTauxRemuneration !== null && consultantTauxRemuneration !== undefined) {
            commUpdate.rem_apporteur = commissionNette * consultantTauxRemuneration
            commUpdate.part_cabinet = commissionNette - commUpdate.rem_apporteur
            commUpdate.pct_cabinet = commUpdate.commission_brute > 0
              ? commUpdate.part_cabinet / commUpdate.commission_brute : 0
          }
          await supabase.from('commissions').update(commUpdate).eq('dossier_id', id)
        }
      }

      // 2. Update client fields (réglementaire + pays — columns on clients table)
      const clientId = dossier?.client_id
      if (clientId) {
        const clientUpdate: Record<string, any> = {
          statut_kyc: editForm.statut_kyc || 'non',
          der: editForm.der === 'oui',
          pi: editForm.pi === 'oui',
          preco: editForm.preco === 'oui',
          lm: editForm.lm === 'oui',
          rm: editForm.rm === 'oui',
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
      if (data) setDossier(data as VDossiersComplets)
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
    if (editApporteurExt && editApporteurExtTaux) {
      const tauxApVal = parseFloat(editApporteurExtTaux)
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

          // Deduct apporteur ext share
          let commissionNette = updateData.commission_brute
          if (editApporteurExt && editApporteurExtTaux) {
            const tauxApporteur = parseFloat(editApporteurExtTaux) / 100
            updateData.rem_apporteur_ext = updateData.commission_brute * tauxApporteur
            commissionNette = updateData.commission_brute - updateData.rem_apporteur_ext
          } else {
            updateData.rem_apporteur_ext = 0
          }

          if (consultantTauxRemuneration !== null && consultantTauxRemuneration !== undefined) {
            updateData.rem_apporteur = commissionNette * consultantTauxRemuneration
            updateData.part_cabinet = commissionNette - updateData.rem_apporteur
            updateData.pct_cabinet = updateData.commission_brute > 0
              ? updateData.part_cabinet / updateData.commission_brute
              : 0
          }
        }
      }

      if (editTauxGestion.trim()) {
        const tauxGestionDecimal = parseFloat(editTauxGestion) / 100
        updateData.taux_gestion = tauxGestionDecimal
      }

      // Save apporteur externe to dossiers table
      const apporteurUpdate: Record<string, any> = {
        has_apporteur_ext: editApporteurExt,
        apporteur_ext_nom: editApporteurExt ? editApporteurExtNom || null : null,
        taux_apporteur_ext: editApporteurExt && editApporteurExtTaux ? parseFloat(editApporteurExtTaux) / 100 : 0,
      }
      await supabase.from('dossiers').update(apporteurUpdate).eq('id', dossier.id)

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
      // Delete factures first (FK constraint)
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
  const partConsultantEntree = React.useMemo(() => {
    if (!commissionBruteCalculee) return dossier?.rem_apporteur ?? null
    if (consultantTauxRemuneration !== null && consultantTauxRemuneration !== undefined) {
      return commissionBruteCalculee * consultantTauxRemuneration
    }
    return dossier?.rem_apporteur ?? null
  }, [commissionBruteCalculee, consultantTauxRemuneration, dossier?.rem_apporteur])

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

  const hasCommissionData = !!(dossier.commission_brute || dossier.rem_apporteur || tauxEntree || effectiveTauxGestion)

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
                  <p className="text-sm font-medium text-gray-500">Produit</p>
                  {isEditing ? (
                    <Select name="produit_id" value={editForm.produit_id} onChange={handleEditChange} className="mt-1">
                      <option value="">— Aucun —</option>
                      {produits.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom}</option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.produit_nom || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Compagnie</p>
                  {isEditing ? (
                    <Select name="compagnie_id" value={editForm.compagnie_id} onChange={handleEditChange} className="mt-1">
                      <option value="">— Aucun —</option>
                      {compagnies.map((c) => (
                        <option key={c.id} value={c.id}>{c.nom}</option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.compagnie_nom || '-'}</p>
                  )}
                </div>
                {isEditing && autoTaux !== null && (
                  <div className="col-span-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-indigo-700">
                        Taux commission : <strong>{(autoTaux * 100).toFixed(2)}%</strong>
                      </span>
                      {editEstimatedCommission !== null && editEstimatedCommission > 0 && (
                        <span className="text-sm font-semibold text-indigo-900">
                          Commission estimée : {formatCurrency(editEstimatedCommission)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
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

          <CompliancePanel
            isEditing={isEditing}
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
        </div>
      </div>
    </div>
  )
}
