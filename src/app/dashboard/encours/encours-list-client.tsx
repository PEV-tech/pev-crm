'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, Filter, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { NewEncoursModal } from './new-encours-modal'
import { useToast } from '@/components/ui/toast'

interface BatchSummaryRow {
  id: string
  source_type: 'manuel' | 'pdf' | 'csv' | 'auto_entree'
  statut: 'brouillon' | 'valide' | 'comptabilise' | 'annule'
  compagnie_id: string | null
  compagnie_nom: string | null
  partenaire_label: string | null
  annee: number | null
  trimestre: number | null
  date_reception: string | null
  date_valeur: string | null
  document_name: string | null
  commentaire: string | null
  created_at: string
  created_by_prenom: string | null
  created_by_nom: string | null
  validated_at: string | null
  nb_lignes: number
  nb_lignes_non_rapprochees: number
  nb_lignes_a_verifier: number
  montant_total_brut: number
}
interface CompagnieOption { id: string; nom: string | null }

const CURRENT_YEAR = new Date().getUTCFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]
const fmtEUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const fmtDate = (iso: string | null): string => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('fr-FR') } catch { return '—' } }

const statutStyle = (s: BatchSummaryRow['statut']): string => {
  switch (s) {
    case 'brouillon': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'valide': return 'bg-green-50 text-green-700 border-green-200'
    case 'comptabilise': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'annule': return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}
const statutLabel: Record<BatchSummaryRow['statut'], string> = {
  brouillon: 'Brouillon', valide: 'Validé', comptabilise: 'Comptabilisé', annule: 'Annulé',
}
const sourceLabel: Record<BatchSummaryRow['source_type'], string> = {
  manuel: 'Manuel', pdf: 'PDF', csv: 'CSV', auto_entree: 'Auto',
}

export function EncoursListClient() {
  const [rows, setRows] = React.useState<BatchSummaryRow[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [compagnies, setCompagnies] = React.useState<CompagnieOption[]>([])
  const [filterStatut, setFilterStatut] = React.useState<string>('')
  const [filterAnnee, setFilterAnnee] = React.useState<string>('')
  const [filterTrimestre, setFilterTrimestre] = React.useState<string>('')
  const [filterCompagnie, setFilterCompagnie] = React.useState<string>('')
  const [modalOpen, setModalOpen] = React.useState<boolean>(false)
  const { showToast, ToastContainer } = useToast()

  const fetchBatches = React.useCallback(async () => {
    setLoading(true); setErrorMsg(null)
    const params = new URLSearchParams()
    if (filterStatut) params.set('statut', filterStatut)
    if (filterAnnee) params.set('annee', filterAnnee)
    if (filterTrimestre) params.set('trimestre', filterTrimestre)
    if (filterCompagnie) params.set('compagnie_id', filterCompagnie)
    params.set('limit', '100')
    try {
      const res = await fetch(`/api/encours/batches?${params.toString()}`)
      const json = (await res.json().catch(() => null)) as { data?: BatchSummaryRow[]; error?: string } | null
      if (!res.ok) { setErrorMsg(json?.error ?? `Erreur ${res.status}`); setRows([]); return }
      setRows(json?.data ?? [])
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau'); setRows([])
    } finally { setLoading(false) }
  }, [filterStatut, filterAnnee, filterTrimestre, filterCompagnie])

  React.useEffect(() => { void fetchBatches() }, [fetchBatches])

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from('compagnies').select('id, nom').order('nom', { ascending: true })
      if (cancelled) return
      if (error) { console.error('[encours list] load compagnies', error.message); return }
      setCompagnies((data ?? []) as CompagnieOption[])
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const resetFilters = () => { setFilterStatut(''); setFilterAnnee(''); setFilterTrimestre(''); setFilterCompagnie('') }
  const hasActiveFilters = Boolean(filterStatut) || Boolean(filterAnnee) || Boolean(filterTrimestre) || Boolean(filterCompagnie)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Encours</h1>
          <p className="text-gray-600 mt-1">Lots d&apos;encaissements — {rows.length} lot(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void fetchBatches()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Rafraîchir
          </Button>
          <Button variant="default" className="gap-2" onClick={() => setModalOpen(true)}>
            <Plus size={18} />Nouveau lot
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filtres</span>
          {hasActiveFilters && (<button onClick={resetFilters} className="text-xs text-blue-600 hover:underline ml-auto">Réinitialiser</button>)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Statut</label>
            <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">Tous</option>
              <option value="brouillon">Brouillon</option><option value="valide">Validé</option>
              <option value="comptabilise">Comptabilisé</option><option value="annule">Annulé</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Année</label>
            <select value={filterAnnee} onChange={(e) => setFilterAnnee(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">Toutes</option>
              {YEAR_OPTIONS.map((y) => (<option key={y} value={String(y)}>{y}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Trimestre</label>
            <select value={filterTrimestre} onChange={(e) => setFilterTrimestre(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">Tous</option><option value="1">T1</option><option value="2">T2</option><option value="3">T3</option><option value="4">T4</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Partenaire</label>
            <select value={filterCompagnie} onChange={(e) => setFilterCompagnie(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">Tous</option>
              {compagnies.map((c) => (<option key={c.id} value={c.id}>{c.nom ?? '(sans nom)'}</option>))}
            </select>
          </div>
        </div>
      </div>

      {errorMsg && (<div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-4 py-3">{errorMsg}</div>)}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            <Loader2 size={16} className="animate-spin mr-2" />Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">{hasActiveFilters ? 'Aucun lot ne correspond aux filtres.' : 'Aucun lot. Créez-en un via "Nouveau lot".'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Partenaire</Th><Th>Période</Th><Th>Source</Th><Th>Statut</Th>
                  <Th className="text-right">Lignes</Th><Th className="text-right">Brut</Th>
                  <Th>Créé</Th><Th>Créé par</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => { window.location.href = `/dashboard/encours/${r.id}` }}>
                    <Td>
                      <div className="font-medium text-gray-900">{r.partenaire_label ?? r.compagnie_nom ?? '(sans partenaire)'}</div>
                      {r.commentaire && (<div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{r.commentaire}</div>)}
                    </Td>
                    <Td>{r.annee && r.trimestre ? `${r.annee} — T${r.trimestre}` : r.annee ? String(r.annee) : '—'}</Td>
                    <Td><span className="text-xs text-gray-600">{sourceLabel[r.source_type]}</span></Td>
                    <Td><span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${statutStyle(r.statut)}`}>{statutLabel[r.statut]}</span></Td>
                    <Td className="text-right">
                      <span className="tabular-nums">{r.nb_lignes}</span>
                      {r.nb_lignes_non_rapprochees > 0 && (<span className="ml-2 text-xs text-amber-600">· {r.nb_lignes_non_rapprochees}</span>)}
                      {r.nb_lignes_a_verifier > 0 && (<span className="ml-2 text-xs text-red-600">· {r.nb_lignes_a_verifier}</span>)}
                    </Td>
                    <Td className="text-right tabular-nums">{fmtEUR.format(r.montant_total_brut)}</Td>
                    <Td>{fmtDate(r.created_at)}</Td>
                    <Td>{r.created_by_prenom || r.created_by_nom ? `${r.created_by_prenom ?? ''} ${r.created_by_nom ?? ''}`.trim() : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewEncoursModal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        onCreated={(batchId) => {
          showToast(`Lot créé (${batchId.slice(0, 8)}…).`, 'success')
          void fetchBatches()
        }} />
      {ToastContainer}

      <p className="text-xs text-gray-400 text-center pt-2">
        Le flux d&apos;encaissements auto reste sur la <Link href="/dashboard/encaissements" className="underline hover:text-gray-600">page Encaissements</Link>.
      </p>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (<th className={`px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide ${className}`}>{children}</th>)
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-gray-800 ${className}`}>{children}</td>
}
