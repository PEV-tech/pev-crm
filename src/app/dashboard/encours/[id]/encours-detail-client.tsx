'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ChevronLeft, RefreshCw, Loader2, ChevronDown, ChevronRight, AlertCircle,
  FileCheck2, FileClock, FileX2, FileEdit, Plus, Pencil, Trash2, RotateCcw, FileSearch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { LineEditorModal, type LineEditorPayload } from './line-editor-modal'
import { AllocationPreviewModal } from './allocation-preview-modal'
import { ValidateBatchModal } from './validate-batch-modal'

interface BatchDetail {
  id: string
  source_type: 'manuel' | 'pdf' | 'csv' | 'auto_entree'
  statut: 'brouillon' | 'valide' | 'comptabilise' | 'annule'
  compagnie_id: string | null
  compagnie_nom: string | null
  partenaire_label: string | null
  annee: number | null
  trimestre: number | null
  periode_debut: string | null
  periode_fin: string | null
  date_reception: string | null
  date_valeur: string | null
  document_name: string | null
  document_hash: string | null
  commentaire: string | null
  created_by: string | null
  created_by_prenom: string | null
  created_by_nom: string | null
  validated_by: string | null
  validated_by_prenom: string | null
  validated_by_nom: string | null
  validated_at: string | null
  created_at: string
  updated_at: string
  nb_lignes: number
  nb_lignes_non_rapprochees: number
  nb_lignes_a_verifier: number
  montant_total_brut: number
}

interface LineRow {
  id: string
  batch_id: string
  type_commission: 'entree' | 'encours'
  origine_ligne: string
  categorie: string | null
  compagnie_id: string | null
  produit_id: string | null
  client_id: string | null
  dossier_id: string | null
  label_source: string | null
  periode_reference_debut: string | null
  periode_reference_fin: string | null
  montant_brut_percu: number
  assiette_reference: number | null
  taux_reference: number | null
  devise: string
  statut_rapprochement: 'non_rapproche' | 'rapproche_auto' | 'rapproche_manuel'
  needs_review: boolean
  notes: string | null
  created_at: string
}

interface AllocationRow {
  id: string
  encaissement_line_id: string
  split_pct: number
  consultant_id: string | null
  apporteur_id: string | null
  applied_rule_id: number
  applied_rule_name: string | null
  commission_brute_snapshot: number
  commission_nette_snapshot: number
  rem_apporteur_interne_montant: number
  rem_apporteur_ext_montant: number
  part_pev_gestion_montant: number
  part_cabinet_prededuction_montant: number
  part_consultant_montant: number
  part_pool_plus_montant: number
  part_thelo_montant: number
  part_maxine_montant: number
  part_stephane_montant: number
  part_cabinet_montant: number
}

interface DetailResponse { batch: BatchDetail; lines: LineRow[]; allocations: AllocationRow[] }

const fmtEUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const fmtDate = (iso: string | null): string => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('fr-FR') } catch { return '—' } }
const fmtDateTime = (iso: string | null): string => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return '—' }
}

const statutStyle = (s: BatchDetail['statut']): string => {
  switch (s) {
    case 'brouillon': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'valide': return 'bg-green-50 text-green-700 border-green-200'
    case 'comptabilise': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'annule': return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}
const statutIcon = (s: BatchDetail['statut']) => {
  const props = { size: 14, className: 'mr-1.5' }
  switch (s) {
    case 'brouillon': return <FileEdit {...props} />
    case 'valide': return <FileCheck2 {...props} />
    case 'comptabilise': return <FileClock {...props} />
    case 'annule': return <FileX2 {...props} />
  }
}
const statutLabel: Record<BatchDetail['statut'], string> = { brouillon: 'Brouillon', valide: 'Validé', comptabilise: 'Comptabilisé', annule: 'Annulé' }
const sourceLabel: Record<BatchDetail['source_type'], string> = { manuel: 'Saisie manuelle', pdf: 'Import PDF', csv: 'Import CSV', auto_entree: 'Auto (entrée)' }
const rapprochementLabel: Record<LineRow['statut_rapprochement'], string> = { non_rapproche: 'Non rapproché', rapproche_auto: 'Rapproché auto', rapproche_manuel: 'Rapproché manuel' }
const rapprochementStyle = (s: LineRow['statut_rapprochement']): string => {
  switch (s) {
    case 'non_rapproche': return 'bg-amber-50 text-amber-700'
    case 'rapproche_auto': return 'bg-green-50 text-green-700'
    case 'rapproche_manuel': return 'bg-blue-50 text-blue-700'
  }
}

export function EncoursDetailClient({ batchId }: { batchId: string }) {
  const [data, setData] = React.useState<DetailResponse | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [notFound, setNotFound] = React.useState<boolean>(false)
  const [expandedLines, setExpandedLines] = React.useState<Record<string, boolean>>({})
  const [editorOpen, setEditorOpen] = React.useState<boolean>(false)
  const [editingLine, setEditingLine] = React.useState<LineEditorPayload | null>(null)
  const [unvalidating, setUnvalidating] = React.useState<boolean>(false)
  const [deletingLineId, setDeletingLineId] = React.useState<string | null>(null)
  const { showToast, ToastContainer } = useToast()
  const [previewInput, setPreviewInput] = React.useState<{ dossier_id: string; montant_brut_percu: number; type_commission: 'entree' | 'encours' } | null>(null)
  const [validateOpen, setValidateOpen] = React.useState<boolean>(false)

  const fetchDetail = React.useCallback(async () => {
    setLoading(true); setErrorMsg(null); setNotFound(false)
    try {
      const res = await fetch(`/api/encours/batches/${batchId}`)
      if (res.status === 404) { setNotFound(true); setData(null); return }
      const json = (await res.json().catch(() => null)) as (DetailResponse & { error?: string }) | null
      if (!res.ok) { setErrorMsg(json?.error ?? `Erreur ${res.status}`); setData(null); return }
      setData(json as DetailResponse)
    } catch (err: unknown) { setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau'); setData(null) }
    finally { setLoading(false) }
  }, [batchId])

  React.useEffect(() => { void fetchDetail() }, [fetchDetail])

  const allocationsByLine = React.useMemo(() => {
    const map = new Map<string, AllocationRow[]>()
    for (const a of data?.allocations ?? []) {
      const list = map.get(a.encaissement_line_id) ?? []
      list.push(a); map.set(a.encaissement_line_id, list)
    }
    return map
  }, [data?.allocations])

  const openCreateEditor = () => { setEditingLine(null); setEditorOpen(true) }
  const openEditEditor = (line: LineRow) => {
    setEditingLine({
      id: line.id, type_commission: line.type_commission, montant_brut_percu: line.montant_brut_percu,
      dossier_id: line.dossier_id, label_source: line.label_source,
      periode_reference_debut: line.periode_reference_debut, periode_reference_fin: line.periode_reference_fin,
      notes: line.notes, needs_review: line.needs_review, statut_rapprochement: line.statut_rapprochement,
    })
    setEditorOpen(true)
  }

  const handleDeleteLine = async (line: LineRow) => {
    if (deletingLineId) return
    if (!window.confirm(`Supprimer cette ligne (${fmtEUR.format(line.montant_brut_percu)}) ?`)) return
    setDeletingLineId(line.id)
    try {
      const res = await fetch(`/api/encours/lines/${line.id}`, { method: 'DELETE' })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) { showToast(json?.error ?? `Erreur ${res.status}`, 'error'); return }
      showToast('Ligne supprimée', 'success'); await fetchDetail()
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erreur réseau', 'error') }
    finally { setDeletingLineId(null) }
  }

  const handleUnvalidate = async () => {
    if (unvalidating) return
    if (!window.confirm('Dé-valider ce lot ? Les allocations seront supprimées.')) return
    setUnvalidating(true)
    try {
      const res = await fetch(`/api/encours/batches/${batchId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'brouillon' }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) { showToast(json?.error ?? `Erreur ${res.status}`, 'error'); return }
      showToast('Lot repassé en brouillon', 'success'); await fetchDetail()
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erreur réseau', 'error') }
    finally { setUnvalidating(false) }
  }

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-3">
        <AlertCircle size={40} className="mx-auto text-gray-400" />
        <h1 className="text-xl font-semibold text-gray-900">Lot introuvable</h1>
        <Link href="/dashboard/encours"><Button variant="outline" className="gap-2"><ChevronLeft size={16} />Retour</Button></Link>
      </div>
    )
  }
  if (loading) {
    return (<div className="flex items-center justify-center h-64 text-gray-500 text-sm"><Loader2 size={16} className="animate-spin mr-2" />Chargement…</div>)
  }
  if (errorMsg || !data) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-4 py-3">{errorMsg ?? 'Erreur'}</div>
        <Link href="/dashboard/encours"><Button variant="outline" className="gap-2"><ChevronLeft size={16} />Retour</Button></Link>
      </div>
    )
  }

  const { batch, lines } = data
  const isBrouillon = batch.statut === 'brouillon'
  const isValide = batch.statut === 'valide' || batch.statut === 'comptabilise'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/encours"><Button variant="outline" className="gap-2"><ChevronLeft size={16} />Retour à la liste</Button></Link>
        <div className="flex items-center gap-2">
          {isBrouillon && lines.length > 0 && (
            <Button variant="default" className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => setValidateOpen(true)}>
              <FileCheck2 size={16} />Valider le lot
            </Button>
          )}
          {batch.statut === 'valide' && (
            <Button variant="outline" className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => void handleUnvalidate()} disabled={unvalidating}>
              <RotateCcw size={16} className={unvalidating ? 'animate-spin' : ''} />Dé-valider
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => void fetchDetail()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Rafraîchir
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{batch.partenaire_label ?? batch.compagnie_nom ?? 'Lot sans partenaire'}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border ${statutStyle(batch.statut)}`}>{statutIcon(batch.statut)}{statutLabel[batch.statut]}</span>
            </div>
            <p className="text-sm text-gray-500">
              {batch.annee && batch.trimestre ? `${batch.annee} — T${batch.trimestre}` : batch.annee ? String(batch.annee) : 'Période non renseignée'}
              {batch.periode_debut && batch.periode_fin ? <> · {fmtDate(batch.periode_debut)} → {fmtDate(batch.periode_fin)}</> : null}
            </p>
            {batch.commentaire && (<p className="mt-2 text-sm text-gray-700 italic">{batch.commentaire}</p>)}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Montant brut total</p>
            <p className="text-2xl font-bold tabular-nums text-gray-900">{fmtEUR.format(batch.montant_total_brut)}</p>
            <p className="text-xs text-gray-500 mt-1">{batch.nb_lignes} ligne{batch.nb_lignes > 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <MetaItem label="Origine" value={sourceLabel[batch.source_type]} />
          <MetaItem label="Date de réception" value={fmtDate(batch.date_reception)} />
          <MetaItem label="Créé par" value={batch.created_by_prenom || batch.created_by_nom ? `${batch.created_by_prenom ?? ''} ${batch.created_by_nom ?? ''}`.trim() : '—'} subvalue={fmtDateTime(batch.created_at)} />
          {batch.validated_at ? (
            <MetaItem label="Validé par" value={batch.validated_by_prenom || batch.validated_by_nom ? `${batch.validated_by_prenom ?? ''} ${batch.validated_by_nom ?? ''}`.trim() : '—'} subvalue={fmtDateTime(batch.validated_at)} />
          ) : (<MetaItem label="Validé" value="Non validé" />)}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Lignes d&apos;encaissement</h2>
          {isBrouillon && (
            <Button variant="default" size="sm" className="gap-2" onClick={openCreateEditor}>
              <Plus size={14} />Ajouter une ligne
            </Button>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="py-10 text-center"><p className="text-sm text-gray-500">Aucune ligne dans ce lot.{isBrouillon && ' Clique sur « + Ajouter une ligne ».'}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {isValide && <Th className="w-8" />}
                  <Th>Type</Th><Th>Dossier</Th><Th>Période réf.</Th>
                  <Th className="text-right">Montant brut</Th><Th>Rapprochement</Th><Th>Notes</Th>
                  {isBrouillon && <Th className="text-right w-28">Actions</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l) => {
                  const allocs = allocationsByLine.get(l.id) ?? []
                  const expanded = Boolean(expandedLines[l.id])
                  return (
                    <React.Fragment key={l.id}>
                      <tr className={expanded ? 'bg-gray-50' : ''}>
                        {isValide && (
                          <Td className="w-8">
                            {allocs.length > 0 ? (
                              <button type="button" onClick={() => setExpandedLines((s) => ({ ...s, [l.id]: !s[l.id] }))} className="p-1 rounded hover:bg-gray-200" aria-label="Allocations">
                                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : null}
                          </Td>
                        )}
                        <Td>
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${l.type_commission === 'encours' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {l.type_commission === 'encours' ? 'Encours' : 'Entrée'}
                          </span>
                        </Td>
                        <Td>
                          {l.dossier_id ? (
                            <Link href={`/dashboard/dossiers/${l.dossier_id}`} className="text-blue-600 hover:underline font-mono text-xs" onClick={(e) => e.stopPropagation()}>{l.dossier_id.slice(0, 8)}…</Link>
                          ) : (<span className="text-gray-400 text-xs italic">Non rapproché</span>)}
                          {l.label_source && (<div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{l.label_source}</div>)}
                        </Td>
                        <Td>
                          {l.periode_reference_debut && l.periode_reference_fin ? (
                            <span className="text-xs text-gray-700">{fmtDate(l.periode_reference_debut)} → {fmtDate(l.periode_reference_fin)}</span>
                          ) : (<span className="text-gray-400 text-xs">—</span>)}
                        </Td>
                        <Td className="text-right tabular-nums font-medium">{fmtEUR.format(l.montant_brut_percu)}</Td>
                        <Td>
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${rapprochementStyle(l.statut_rapprochement)}`}>{rapprochementLabel[l.statut_rapprochement]}</span>
                          {l.needs_review && (<span className="ml-1 inline-block px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-700">À vérifier</span>)}
                        </Td>
                        <Td>{l.notes ? (<span className="text-xs text-gray-600 truncate max-w-xs inline-block">{l.notes}</span>) : (<span className="text-gray-400 text-xs">—</span>)}</Td>
                        {isBrouillon && (
                          <Td className="text-right w-28">
                            <div className="inline-flex items-center gap-1">
                              {l.dossier_id && (
                                <button type="button" onClick={() => setPreviewInput({ dossier_id: l.dossier_id as string, montant_brut_percu: l.montant_brut_percu, type_commission: l.type_commission })}
                                  className="p-1.5 rounded hover:bg-purple-50 text-purple-600" title="Preview">
                                  <FileSearch size={14} />
                                </button>
                              )}
                              <button type="button" onClick={() => openEditEditor(l)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Modifier">
                                <Pencil size={14} />
                              </button>
                              <button type="button" onClick={() => void handleDeleteLine(l)} disabled={deletingLineId === l.id}
                                className="p-1.5 rounded hover:bg-red-50 text-red-600 disabled:opacity-50" title="Supprimer">
                                {deletingLineId === l.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          </Td>
                        )}
                      </tr>
                      {isValide && expanded && allocs.length > 0 && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-3"><AllocationsPanel allocations={allocs} /></td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LineEditorModal
        isOpen={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingLine(null) }}
        onSaved={() => { showToast(editingLine ? 'Ligne mise à jour' : 'Ligne ajoutée', 'success'); void fetchDetail() }}
        batchId={batchId} editingLine={editingLine}
      />
      <AllocationPreviewModal isOpen={previewInput !== null} onClose={() => setPreviewInput(null)} input={previewInput} />
      <ValidateBatchModal isOpen={validateOpen} onClose={() => setValidateOpen(false)}
        onValidated={() => { showToast('Lot validé', 'success'); void fetchDetail() }}
        batchId={batchId}
        lines={lines.map((l) => ({ id: l.id, dossier_id: l.dossier_id, montant_brut_percu: l.montant_brut_percu, statut_rapprochement: l.statut_rapprochement }))}
      />
      {ToastContainer}
    </div>
  )
}

function MetaItem({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
      {subvalue && <p className="text-xs text-gray-400 mt-0.5">{subvalue}</p>}
    </div>
  )
}
function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (<th className={`px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide ${className}`}>{children}</th>)
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-gray-800 ${className}`}>{children}</td>
}

function AllocationsPanel({ allocations }: { allocations: AllocationRow[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600 uppercase">Allocations figées ({allocations.length})</p>
      <div className="overflow-x-auto bg-white border border-gray-200 rounded">
        <table className="min-w-full text-xs divide-y divide-gray-100">
          <thead className="bg-gray-100">
            <tr>
              <Th>Règle</Th><Th className="text-right">Split</Th><Th className="text-right">Brut</Th>
              <Th className="text-right">Apporteur</Th><Th className="text-right">PEV</Th><Th className="text-right">Cabinet pré</Th>
              <Th className="text-right">Consultant</Th><Th className="text-right">Pool+</Th><Th className="text-right">Thélo</Th>
              <Th className="text-right">Maxine</Th><Th className="text-right">Stéphane</Th><Th className="text-right">Cabinet</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allocations.map((a) => (
              <tr key={a.id}>
                <Td><span className="text-xs font-medium">#{a.applied_rule_id}{a.applied_rule_name ? ` — ${a.applied_rule_name}` : ''}</span></Td>
                <Td className="text-right tabular-nums">{(a.split_pct * 100).toFixed(0)} %</Td>
                <Td className="text-right tabular-nums">{fmtEUR.format(a.commission_brute_snapshot)}</Td>
                <Td className="text-right tabular-nums text-gray-600">{fmtEUR.format(a.rem_apporteur_interne_montant + a.rem_apporteur_ext_montant)}</Td>
                <Td className="text-right tabular-nums text-gray-600">{fmtEUR.format(a.part_pev_gestion_montant)}</Td>
                <Td className="text-right tabular-nums text-gray-600">{fmtEUR.format(a.part_cabinet_prededuction_montant)}</Td>
                <Td className="text-right tabular-nums font-medium">{fmtEUR.format(a.part_consultant_montant)}</Td>
                <Td className="text-right tabular-nums">{fmtEUR.format(a.part_pool_plus_montant)}</Td>
                <Td className="text-right tabular-nums">{fmtEUR.format(a.part_thelo_montant)}</Td>
                <Td className="text-right tabular-nums">{fmtEUR.format(a.part_maxine_montant)}</Td>
                <Td className="text-right tabular-nums">{fmtEUR.format(a.part_stephane_montant)}</Td>
                <Td className="text-right tabular-nums">{fmtEUR.format(a.part_cabinet_montant)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
