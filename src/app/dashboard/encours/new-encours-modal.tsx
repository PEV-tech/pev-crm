'use client'

import * as React from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export interface NewEncoursModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (batchId: string) => void
}

type SourceType = 'manuel' | 'pdf' | 'csv'
interface CompagnieOption { id: string; nom: string | null }

function computeTrimestreBounds(annee: number, trimestre: number): { debut: string; fin: string } {
  const t = Math.max(1, Math.min(4, trimestre))
  const startMonth = (t - 1) * 3
  const endMonth = startMonth + 2
  const debut = new Date(Date.UTC(annee, startMonth, 1))
  const fin = new Date(Date.UTC(annee, endMonth + 1, 0))
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { debut: iso(debut), fin: iso(fin) }
}

const CURRENT_YEAR = new Date().getUTCFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export function NewEncoursModal({ isOpen, onClose, onCreated }: NewEncoursModalProps) {
  const [sourceType, setSourceType] = React.useState<SourceType>('manuel')
  const [compagnieId, setCompagnieId] = React.useState<string>('')
  const [partenaireLabel, setPartenaireLabel] = React.useState<string>('')
  const [annee, setAnnee] = React.useState<number>(CURRENT_YEAR)
  const [trimestre, setTrimestre] = React.useState<number>(1)
  const [dateReception, setDateReception] = React.useState<string>('')
  const [commentaire, setCommentaire] = React.useState<string>('')

  const [compagnies, setCompagnies] = React.useState<CompagnieOption[]>([])
  const [loadingCompagnies, setLoadingCompagnies] = React.useState<boolean>(false)
  const [submitting, setSubmitting] = React.useState<boolean>(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isOpen) return
    setSourceType('manuel'); setCompagnieId(''); setPartenaireLabel('')
    setAnnee(CURRENT_YEAR)
    const m = new Date().getUTCMonth()
    setTrimestre(Math.floor(m / 3) + 1)
    setDateReception(new Date().toISOString().slice(0, 10))
    setCommentaire(''); setErrorMsg(null)
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const load = async () => {
      setLoadingCompagnies(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('compagnies').select('id, nom').order('nom', { ascending: true })
        if (cancelled) return
        if (error) { console.error('[NewEncoursModal] load compagnies', error.message); setCompagnies([]) }
        else setCompagnies((data ?? []) as CompagnieOption[])
      } finally { if (!cancelled) setLoadingCompagnies(false) }
    }
    load()
    return () => { cancelled = true }
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setErrorMsg(null)
    const bounds = computeTrimestreBounds(annee, trimestre)
    const payload: Record<string, unknown> = {
      source_type: sourceType, annee, trimestre,
      periode_debut: bounds.debut, periode_fin: bounds.fin,
    }
    if (compagnieId) payload.compagnie_id = compagnieId
    if (partenaireLabel.trim()) payload.partenaire_label = partenaireLabel.trim()
    if (dateReception) payload.date_reception = dateReception
    if (commentaire.trim()) payload.commentaire = commentaire.trim()

    setSubmitting(true)
    try {
      const res = await fetch('/api/encours/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => null)) as { data?: { id: string }; error?: string } | null
      if (!res.ok) { setErrorMsg(json?.error ?? `Erreur ${res.status}`); return }
      const newId = json?.data?.id
      if (!newId) { setErrorMsg('Lot créé mais id manquant'); return }
      onCreated?.(newId)
      onClose()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau')
    } finally { setSubmitting(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau lot d&apos;encours</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Fermer">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Origine du lot</label>
            <div className="flex gap-2">
              {(['manuel', 'pdf', 'csv'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setSourceType(v)}
                  className={`flex-1 py-2 px-3 text-sm rounded-md border ${sourceType === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                  {v === 'manuel' ? 'Saisie manuelle' : v === 'pdf' ? 'Import PDF' : 'Import CSV'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Partenaire</label>
            <select value={compagnieId} onChange={(e) => setCompagnieId(e.target.value)} disabled={loadingCompagnies}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Aucune (label libre) —</option>
              {compagnies.map((c) => (<option key={c.id} value={c.id}>{c.nom ?? '(sans nom)'}</option>))}
            </select>
            {!compagnieId && (
              <input type="text" placeholder="Ou libellé partenaire" value={partenaireLabel}
                onChange={(e) => setPartenaireLabel(e.target.value)}
                className="mt-2 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Année</label>
              <select value={annee} onChange={(e) => setAnnee(parseInt(e.target.value, 10))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {YEAR_OPTIONS.map((y) => (<option key={y} value={y}>{y}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Trimestre</label>
              <select value={trimestre} onChange={(e) => setTrimestre(parseInt(e.target.value, 10))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value={1}>T1</option><option value={2}>T2</option><option value={3}>T3</option><option value={4}>T4</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date de réception</label>
            <input type="date" value={dateReception} onChange={(e) => setDateReception(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Commentaire (optionnel)</label>
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {errorMsg && (<div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-3 py-2">{errorMsg}</div>)}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (<><Loader2 size={16} className="animate-spin mr-2" />Création…</>) : 'Créer le lot'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
