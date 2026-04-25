'use client'

import * as React from 'react'
import { X, Loader2, Search, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export type TypeCommission = 'entree' | 'encours'
export type StatutRapprochement = 'non_rapproche' | 'rapproche_auto' | 'rapproche_manuel'

export interface LineEditorPayload {
  id: string
  type_commission: TypeCommission
  montant_brut_percu: number
  dossier_id: string | null
  label_source: string | null
  periode_reference_debut: string | null
  periode_reference_fin: string | null
  notes: string | null
  needs_review: boolean
  statut_rapprochement: StatutRapprochement
}

export interface LineEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  batchId: string
  editingLine?: LineEditorPayload | null
}

interface DossierSuggestion {
  id: string
  client_nom: string | null
  client_prenom: string | null
  produit_nom: string | null
  compagnie_nom: string | null
  montant: number | null
}

const fmtEUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
function formatDossierLabel(d: DossierSuggestion): string {
  const client = [d.client_prenom, d.client_nom].filter(Boolean).join(' ').trim()
  const produit = d.produit_nom ?? '(produit ?)'
  const comp = d.compagnie_nom ?? '—'
  const mt = typeof d.montant === 'number' ? ` · ${fmtEUR.format(d.montant)}` : ''
  return `${client || '(client ?)'} · ${produit} · ${comp}${mt}`
}

export function LineEditorModal({ isOpen, onClose, onSaved, batchId, editingLine }: LineEditorModalProps) {
  const isEditMode = Boolean(editingLine)
  const [typeCommission, setTypeCommission] = React.useState<TypeCommission>('encours')
  const [montantStr, setMontantStr] = React.useState<string>('')
  const [periodeDebut, setPeriodeDebut] = React.useState<string>('')
  const [periodeFin, setPeriodeFin] = React.useState<string>('')
  const [labelSource, setLabelSource] = React.useState<string>('')
  const [notes, setNotes] = React.useState<string>('')
  const [needsReview, setNeedsReview] = React.useState<boolean>(false)
  const [selectedDossier, setSelectedDossier] = React.useState<DossierSuggestion | null>(null)
  const [dossierQuery, setDossierQuery] = React.useState<string>('')
  const [dossierSuggestions, setDossierSuggestions] = React.useState<DossierSuggestion[]>([])
  const [searching, setSearching] = React.useState<boolean>(false)
  const [dropdownOpen, setDropdownOpen] = React.useState<boolean>(false)
  const [submitting, setSubmitting] = React.useState<boolean>(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isOpen) return
    setErrorMsg(null); setDropdownOpen(false)
    if (editingLine) {
      setTypeCommission(editingLine.type_commission)
      setMontantStr(String(editingLine.montant_brut_percu))
      setPeriodeDebut(editingLine.periode_reference_debut ?? '')
      setPeriodeFin(editingLine.periode_reference_fin ?? '')
      setLabelSource(editingLine.label_source ?? '')
      setNotes(editingLine.notes ?? '')
      setNeedsReview(editingLine.needs_review)
      if (editingLine.dossier_id) {
        void loadDossierById(editingLine.dossier_id).then((d) => {
          setSelectedDossier(d)
          setDossierQuery(d ? formatDossierLabel(d) : '')
        })
      } else { setSelectedDossier(null); setDossierQuery('') }
    } else {
      setTypeCommission('encours'); setMontantStr(''); setPeriodeDebut(''); setPeriodeFin('')
      setLabelSource(''); setNotes(''); setNeedsReview(false)
      setSelectedDossier(null); setDossierQuery(''); setDossierSuggestions([])
    }
  }, [isOpen, editingLine])

  React.useEffect(() => {
    if (!isOpen) return
    if (selectedDossier && dossierQuery === formatDossierLabel(selectedDossier)) {
      setDossierSuggestions([]); return
    }
    const q = dossierQuery.trim()
    if (q.length < 2) { setDossierSuggestions([]); return }
    const timer = setTimeout(() => { void searchDossiers(q) }, 300)
    return () => clearTimeout(timer)
  }, [dossierQuery, isOpen, selectedDossier])

  const searchDossiers = async (q: string) => {
    setSearching(true)
    try {
      const supabase = createClient()
      const term = `%${q}%`
      const { data, error } = await supabase
        .from('v_dossiers_complets').select('id, client_nom, client_prenom, produit_nom, compagnie_nom, montant')
        .or(`client_nom.ilike.${term},client_prenom.ilike.${term}`).limit(10)
      if (error) { console.error('[LineEditorModal]', error.message); setDossierSuggestions([]) }
      else setDossierSuggestions((data ?? []) as DossierSuggestion[])
    } finally { setSearching(false) }
  }

  const loadDossierById = async (id: string): Promise<DossierSuggestion | null> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('v_dossiers_complets').select('id, client_nom, client_prenom, produit_nom, compagnie_nom, montant')
      .eq('id', id).maybeSingle()
    if (error || !data) return null
    return data as DossierSuggestion
  }

  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleSelectDossier = (d: DossierSuggestion) => {
    setSelectedDossier(d); setDossierQuery(formatDossierLabel(d))
    setDossierSuggestions([]); setDropdownOpen(false)
  }
  const handleClearDossier = () => { setSelectedDossier(null); setDossierQuery(''); setDossierSuggestions([]) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setErrorMsg(null)
    const montant = Number(montantStr.replace(',', '.'))
    if (!Number.isFinite(montant) || montant < 0) { setErrorMsg('Montant invalide.'); return }

    let statut: StatutRapprochement = 'non_rapproche'
    if (selectedDossier) {
      if (isEditMode && editingLine?.statut_rapprochement === 'rapproche_auto') statut = 'rapproche_auto'
      else statut = 'rapproche_manuel'
    }

    const payload: Record<string, unknown> = {
      type_commission: typeCommission, montant_brut_percu: montant,
      dossier_id: selectedDossier?.id ?? null,
      label_source: labelSource.trim() || null,
      periode_reference_debut: periodeDebut || null,
      periode_reference_fin: periodeFin || null,
      notes: notes.trim() || null,
      needs_review: needsReview, statut_rapprochement: statut,
    }

    setSubmitting(true)
    try {
      const url = isEditMode ? `/api/encours/lines/${editingLine!.id}` : '/api/encours/lines'
      const method = isEditMode ? 'PATCH' : 'POST'
      if (!isEditMode) payload.batch_id = batchId
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) { setErrorMsg(json?.error ?? `Erreur ${res.status}`); return }
      onSaved(); onClose()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau')
    } finally { setSubmitting(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{isEditMode ? 'Modifier la ligne' : 'Ajouter une ligne'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Fermer">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <div className="flex gap-2">
              {(['entree', 'encours'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setTypeCommission(v)}
                  className={`flex-1 py-2 px-3 text-sm rounded-md border ${typeCommission === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                  {v === 'entree' ? 'Entrée' : 'Encours'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">Dossier rapproché</label>
            {selectedDossier ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                <Check size={14} className="text-green-600 flex-shrink-0" />
                <span className="text-sm text-gray-800 flex-1 truncate">{formatDossierLabel(selectedDossier)}</span>
                <button type="button" onClick={handleClearDossier} className="text-xs text-gray-500 hover:text-gray-700 underline">Changer</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={dossierQuery}
                    onChange={(e) => { setDossierQuery(e.target.value); setDropdownOpen(true) }}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="Rechercher par nom de client (min. 2 caractères)…"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {dropdownOpen && dossierQuery.trim().length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                    {searching ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-500"><Loader2 size={12} className="animate-spin" />Recherche…</div>
                    ) : dossierSuggestions.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-gray-500">Aucun dossier trouvé</div>
                    ) : (dossierSuggestions.map((d) => (
                      <button key={d.id} type="button" onClick={() => handleSelectDossier(d)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b border-gray-100 last:border-b-0">
                        <div className="font-medium text-gray-900 truncate">{[d.client_prenom, d.client_nom].filter(Boolean).join(' ').trim() || '(client ?)'}</div>
                        <div className="text-xs text-gray-500 truncate">{d.produit_nom ?? '—'} · {d.compagnie_nom ?? '—'}{typeof d.montant === 'number' ? ` · ${fmtEUR.format(d.montant)}` : ''}</div>
                      </button>
                    )))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Montant brut perçu (EUR)</label>
            <input type="text" inputMode="decimal" value={montantStr} onChange={(e) => setMontantStr(e.target.value)}
              placeholder="0.00" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Période — début</label>
              <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Période — fin</label>
              <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Libellé source (optionnel)</label>
            <input type="text" value={labelSource} onChange={(e) => setLabelSource(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="flex items-center gap-2">
            <input id="needs-review" type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="needs-review" className="text-sm text-gray-700">Marquer comme <strong>à vérifier</strong></label>
          </div>

          {errorMsg && (<div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-3 py-2">{errorMsg}</div>)}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (<><Loader2 size={16} className="animate-spin mr-2" />{isEditMode ? 'Mise à jour…' : 'Création…'}</>) : isEditMode ? 'Enregistrer' : 'Ajouter la ligne'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
