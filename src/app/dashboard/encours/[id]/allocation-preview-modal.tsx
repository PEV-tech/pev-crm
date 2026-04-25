'use client'

import * as React from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'

interface PreviewDraft {
  split_pct: number
  consultant_id: string | null
  applied_rule_id: number
  applied_rule_name: string
  applied_split_snapshot: { rule_id: number; rule_name: string; rule_description: string; split: { part_consultant: number; part_pool_plus: number; part_thelo: number; part_maxine: number; part_stephane: number; part_cabinet: number }; snapshot_taken_at: string }
  consultant_snapshot: { consultant_id: string | null; prenom: string | null; nom: string | null; role: string | null; taux_remuneration: number | null }
  taux_remuneration_snapshot: number | null
  taux_apporteur_ext_snapshot: number | null
  taux_pev_gestion_snapshot: number
  taux_cabinet_prededuction_snapshot: number
  commission_brute_snapshot: number
  rem_apporteur_interne_montant: number
  rem_apporteur_ext_montant: number
  part_pev_gestion_montant: number
  part_cabinet_prededuction_montant: number
  commission_nette_snapshot: number
  part_consultant_montant: number
  part_pool_plus_montant: number
  part_thelo_montant: number
  part_maxine_montant: number
  part_stephane_montant: number
  part_cabinet_montant: number
}
interface PreviewSummary {
  total_brut: number; total_apporteur_interne: number; total_apporteur_ext: number
  total_pev_gestion: number; total_cabinet_prededuction: number
  total_consultant: number; total_pool_plus: number; total_thelo: number
  total_maxine: number; total_stephane: number; total_cabinet_post_rule: number
  total_reconstitue: number
}
interface PreviewResponse {
  drafts: PreviewDraft[]
  summary: PreviewSummary
  dossier: { id: string; client_nom: string | null; client_prenom: string | null; produit_nom: string | null; produit_categorie: string | null; compagnie_nom: string | null }
}

export interface AllocationPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  input: { dossier_id: string; montant_brut_percu: number; type_commission: 'entree' | 'encours' } | null
}

const fmtEUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const fmtPct = (x: number): string => `${(x * 100).toFixed(2).replace(/\.?0+$/, '')} %`

export function AllocationPreviewModal({ isOpen, onClose, input }: AllocationPreviewModalProps) {
  const [data, setData] = React.useState<PreviewResponse | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isOpen || !input) { setData(null); setErrorMsg(null); return }
    let cancelled = false
    const run = async () => {
      setLoading(true); setErrorMsg(null)
      try {
        const res = await fetch('/api/encours/preview-allocation', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const json = (await res.json().catch(() => null)) as (PreviewResponse & { error?: string }) | null
        if (cancelled) return
        if (!res.ok) { setErrorMsg(json?.error ?? `Erreur ${res.status}`); setData(null); return }
        setData(json as PreviewResponse)
      } catch (err: unknown) {
        if (!cancelled) { setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau'); setData(null) }
      } finally { if (!cancelled) setLoading(false) }
    }
    void run()
    return () => { cancelled = true }
  }, [isOpen, input])

  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Preview d&apos;allocation</h2>
            <p className="text-xs text-gray-500 mt-0.5">Calcul dry-run — rien n&apos;est écrit en base.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Fermer">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[75vh] overflow-y-auto space-y-5">
          {loading && (<div className="flex items-center justify-center py-10 text-gray-500 text-sm"><Loader2 size={16} className="animate-spin mr-2" />Calcul…</div>)}
          {errorMsg && !loading && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-4 py-3 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <div><p className="font-medium">Preview impossible</p><p className="text-xs mt-0.5">{errorMsg}</p></div>
            </div>
          )}
          {data && !loading && !errorMsg && <PreviewContent data={data} />}
        </div>
      </div>
    </div>
  )
}

function PreviewContent({ data }: { data: PreviewResponse }) {
  const { drafts, summary, dossier } = data
  const reconstitutionOk = Math.abs(summary.total_reconstitue - summary.total_brut) < 0.02
  return (
    <>
      <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Dossier</p>
        <p className="text-sm font-medium text-gray-900">{[dossier.client_prenom, dossier.client_nom].filter(Boolean).join(' ') || '(client ?)'}</p>
        <p className="text-xs text-gray-600 mt-0.5">{dossier.produit_nom ?? '—'}{dossier.produit_categorie ? ` · ${dossier.produit_categorie}` : ''}{dossier.compagnie_nom ? ` · ${dossier.compagnie_nom}` : ''}</p>
      </div>

      {drafts.map((d, idx) => (
        <div key={idx} className="border border-gray-200 rounded-md overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-semibold uppercase">Règle #{d.applied_rule_id}</p>
              <p className="text-sm font-medium text-blue-900">{d.applied_rule_name}</p>
              {d.applied_split_snapshot.rule_description && (<p className="text-xs text-blue-700 mt-0.5">{d.applied_split_snapshot.rule_description}</p>)}
            </div>
            <div className="text-right"><p className="text-xs text-blue-600">Split</p><p className="text-sm font-medium text-blue-900 tabular-nums">{fmtPct(d.split_pct)}</p></div>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 bg-white">
            <p className="text-xs text-gray-500 uppercase">Consultant cible</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{[d.consultant_snapshot.prenom, d.consultant_snapshot.nom].filter(Boolean).join(' ') || '(consultant ?)'}</p>
            {typeof d.taux_remuneration_snapshot === 'number' && (<p className="text-xs text-gray-500 mt-0.5">taux : {fmtPct(d.taux_remuneration_snapshot)}</p>)}
          </div>

          <div className="px-4 py-3 space-y-2 bg-white">
            <p className="text-xs font-semibold text-gray-600 uppercase">Chaîne de calcul</p>
            <CalcLine label="Brut perçu" value={d.commission_brute_snapshot} strong />
            {d.rem_apporteur_ext_montant > 0 && (<CalcLine label={`− Apporteur ext (${typeof d.taux_apporteur_ext_snapshot === 'number' ? fmtPct(d.taux_apporteur_ext_snapshot) : ''})`} value={-d.rem_apporteur_ext_montant} dim />)}
            {d.rem_apporteur_interne_montant > 0 && (<CalcLine label="− Apporteur interne" value={-d.rem_apporteur_interne_montant} dim />)}
            {d.part_pev_gestion_montant > 0 && (<CalcLine label={`− PEV Gestion (${fmtPct(d.taux_pev_gestion_snapshot)})`} value={-d.part_pev_gestion_montant} dim />)}
            {d.part_cabinet_prededuction_montant > 0 && (<CalcLine label={`− Cabinet pré-rule (${fmtPct(d.taux_cabinet_prededuction_snapshot)})`} value={-d.part_cabinet_prededuction_montant} dim />)}
            <div className="border-t border-gray-200 my-2" />
            <CalcLine label="= Assiette distribuable" value={d.commission_nette_snapshot} accent />
          </div>

          <div className="px-4 py-3 bg-gray-50 space-y-1.5">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Ventilation</p>
            <PocketRow label="Consultant" pct={d.applied_split_snapshot.split.part_consultant} value={d.part_consultant_montant} />
            <PocketRow label="POOL+" pct={d.applied_split_snapshot.split.part_pool_plus} value={d.part_pool_plus_montant} />
            <PocketRow label="Thélo" pct={d.applied_split_snapshot.split.part_thelo} value={d.part_thelo_montant} />
            <PocketRow label="Maxine" pct={d.applied_split_snapshot.split.part_maxine} value={d.part_maxine_montant} />
            <PocketRow label="Stéphane" pct={d.applied_split_snapshot.split.part_stephane} value={d.part_stephane_montant} />
            <PocketRow label="Cabinet (post)" pct={d.applied_split_snapshot.split.part_cabinet} value={d.part_cabinet_montant} />
          </div>
        </div>
      ))}

      <div className="border border-gray-200 rounded-md overflow-hidden">
        <div className="px-4 py-2 bg-gray-100 border-b border-gray-200"><p className="text-xs font-semibold text-gray-700 uppercase">Récapitulatif</p></div>
        <div className="px-4 py-3 space-y-1.5">
          <SummaryRow label="Brut total" value={summary.total_brut} strong />
          <SummaryRow label="Apporteur interne" value={summary.total_apporteur_interne} dim />
          <SummaryRow label="Apporteur externe" value={summary.total_apporteur_ext} dim />
          <SummaryRow label="PEV Gestion" value={summary.total_pev_gestion} dim />
          <SummaryRow label="Cabinet pré-rule" value={summary.total_cabinet_prededuction} dim />
          <SummaryRow label="Consultant" value={summary.total_consultant} />
          <SummaryRow label="POOL+" value={summary.total_pool_plus} />
          <SummaryRow label="Thélo" value={summary.total_thelo} />
          <SummaryRow label="Maxine" value={summary.total_maxine} />
          <SummaryRow label="Stéphane" value={summary.total_stephane} />
          <SummaryRow label="Cabinet (post)" value={summary.total_cabinet_post_rule} />
          <div className="border-t border-gray-200 my-2" />
          <SummaryRow label="= Total reconstitué" value={summary.total_reconstitue} accent />
        </div>
        {!reconstitutionOk && (<div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-xs flex items-center gap-2"><AlertCircle size={12} />Écart : {fmtEUR.format(summary.total_reconstitue - summary.total_brut)}</div>)}
      </div>
    </>
  )
}

function CalcLine({ label, value, strong, dim, accent }: { label: string; value: number; strong?: boolean; dim?: boolean; accent?: boolean }) {
  return (<div className={`flex items-center justify-between text-sm ${strong ? 'font-semibold text-gray-900' : dim ? 'text-gray-600' : accent ? 'font-semibold text-blue-900' : 'text-gray-800'}`}><span>{label}</span><span className="tabular-nums">{fmtEUR.format(value)}</span></div>)
}
function PocketRow({ label, pct, value }: { label: string; pct: number; value: number }) {
  return (<div className="flex items-center justify-between text-sm"><span className="text-gray-800">{label}<span className="ml-1 text-xs text-gray-500">· {pct.toFixed(2)} %</span></span><span className="tabular-nums font-medium text-gray-900">{fmtEUR.format(value)}</span></div>)
}
function SummaryRow({ label, value, strong, dim, accent }: { label: string; value: number; strong?: boolean; dim?: boolean; accent?: boolean }) {
  return (<div className={`flex items-center justify-between text-sm ${strong ? 'font-semibold text-gray-900' : dim ? 'text-gray-600' : accent ? 'font-semibold text-blue-900' : 'text-gray-800'}`}><span>{label}</span><span className="tabular-nums">{fmtEUR.format(value)}</span></div>)
}
