'use client'

import * as React from 'react'
import { X, Loader2, CheckCircle2, AlertCircle, AlertTriangle, FileCheck2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ValidationIssue { line_id: string; severity: 'error' | 'warning'; code: string; message: string }
interface ValidationSummary {
  total_brut: number; total_apporteur_interne: number; total_apporteur_ext: number
  total_pev_gestion: number; total_cabinet_prededuction: number
  total_consultant: number; total_pool_plus: number; total_thelo: number
  total_maxine: number; total_stephane: number; total_cabinet_post_rule: number
  total_reconstitue: number
}
interface ValidationResult {
  batch_id: string; status: 'ok' | 'partial' | 'aborted'
  lines_processed: number; lines_skipped: number; allocations_inserted: number
  issues: ValidationIssue[]; summary: ValidationSummary | null; errors: string[]
}
interface LineSummary {
  id: string
  dossier_id: string | null
  montant_brut_percu: number
  statut_rapprochement: 'non_rapproche' | 'rapproche_auto' | 'rapproche_manuel'
}

export interface ValidateBatchModalProps {
  isOpen: boolean
  onClose: () => void
  onValidated: () => void
  batchId: string
  lines: LineSummary[]
}

const fmtEUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
type Phase = 'confirm' | 'validating' | 'result'

export function ValidateBatchModal({ isOpen, onClose, onValidated, batchId, lines }: ValidateBatchModalProps) {
  const [phase, setPhase] = React.useState<Phase>('confirm')
  const [allowUnreconciled, setAllowUnreconciled] = React.useState<boolean>(false)
  const [result, setResult] = React.useState<ValidationResult | null>(null)
  const [fatalErrorMsg, setFatalErrorMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => { setPhase('confirm'); setAllowUnreconciled(false); setResult(null); setFatalErrorMsg(null) }, 200)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'validating') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, phase])

  const reconciled = React.useMemo(() => lines.filter((l) => l.statut_rapprochement !== 'non_rapproche'), [lines])
  const unreconciled = React.useMemo(() => lines.filter((l) => l.statut_rapprochement === 'non_rapproche'), [lines])
  const reconciledTotal = reconciled.reduce((s, l) => s + l.montant_brut_percu, 0)
  const canValidate = reconciled.length > 0 && (unreconciled.length === 0 || allowUnreconciled)

  const handleValidate = async () => {
    setPhase('validating'); setFatalErrorMsg(null); setResult(null)
    try {
      const res = await fetch(`/api/encours/batches/${batchId}/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowUnreconciledLines: allowUnreconciled }),
      })
      const json = (await res.json().catch(() => null)) as (ValidationResult & { error?: string }) | null
      if (!json) { setFatalErrorMsg(`Réponse invalide HTTP ${res.status}`); setPhase('result'); return }
      setResult(json as ValidationResult)
      if ((json as ValidationResult).allocations_inserted > 0) onValidated()
      setPhase('result')
    } catch (err: unknown) {
      setFatalErrorMsg(err instanceof Error ? err.message : 'Erreur réseau'); setPhase('result')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={phase === 'validating' ? undefined : onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Valider le lot</h2>
          <button type="button" onClick={onClose} disabled={phase === 'validating'} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" aria-label="Fermer">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {phase === 'confirm' && (
            <ConfirmPhase reconciled={reconciled} unreconciled={unreconciled} reconciledTotal={reconciledTotal} allowUnreconciled={allowUnreconciled} setAllowUnreconciled={setAllowUnreconciled} />
          )}
          {phase === 'validating' && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-600">
              <Loader2 size={32} className="animate-spin mb-3 text-blue-600" />
              <p className="text-sm font-medium">Validation en cours…</p>
              <p className="text-xs text-gray-500 mt-1">Figer les allocations + bascule statut.</p>
            </div>
          )}
          {phase === 'result' && (<ResultPhase result={result} fatalErrorMsg={fatalErrorMsg} />)}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          {phase === 'confirm' && (
            <>
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={() => void handleValidate()} disabled={!canValidate} className="gap-2">
                <FileCheck2 size={16} />Valider le lot
              </Button>
            </>
          )}
          {phase === 'validating' && (<Button variant="outline" disabled>Validation…</Button>)}
          {phase === 'result' && (<Button onClick={onClose}>Fermer</Button>)}
        </div>
      </div>
    </div>
  )
}

function ConfirmPhase({ reconciled, unreconciled, reconciledTotal, allowUnreconciled, setAllowUnreconciled }: {
  reconciled: LineSummary[]; unreconciled: LineSummary[]; reconciledTotal: number;
  allowUnreconciled: boolean; setAllowUnreconciled: (v: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3">
        <p className="text-xs text-blue-600 uppercase font-semibold mb-1">Ce qui va être figé</p>
        <p className="text-sm text-gray-800"><strong>{reconciled.length}</strong> ligne(s) rapprochée(s) — montant brut total <strong className="tabular-nums">{fmtEUR.format(reconciledTotal)}</strong>.</p>
        <p className="text-xs text-gray-600 mt-1">Chaque ligne génère une allocation figée selon la grille de splits actuelle (cf. Paramètres → Rémunération → Splits). Immutable après validation.</p>
      </div>

      {unreconciled.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">{unreconciled.length} ligne(s) non rapprochée(s)</p>
              <p className="text-xs text-amber-800 mt-0.5">Ces lignes ne seront pas validées (à compléter ensuite).</p>
            </div>
          </div>
          <label className="flex items-center gap-2 mt-2 pl-6">
            <input type="checkbox" checked={allowUnreconciled} onChange={(e) => setAllowUnreconciled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
            <span className="text-sm text-amber-900">J&apos;accepte de valider malgré ça</span>
          </label>
        </div>
      )}

      {reconciled.length === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-800">
          <AlertCircle size={14} className="inline mr-1" />Aucune ligne rapprochée — impossible de valider.
        </div>
      )}
    </div>
  )
}

function ResultPhase({ result, fatalErrorMsg }: { result: ValidationResult | null; fatalErrorMsg: string | null }) {
  if (fatalErrorMsg && !result) {
    return (
      <div className="flex flex-col items-center py-6">
        <AlertCircle size={40} className="text-red-600 mb-3" />
        <p className="text-lg font-semibold text-gray-900">Échec</p>
        <p className="text-sm text-gray-600 mt-1 text-center max-w-md">{fatalErrorMsg}</p>
      </div>
    )
  }
  if (!result) return null
  const isOk = result.status === 'ok'; const isPartial = result.status === 'partial'; const isAborted = result.status === 'aborted'
  const Icon = isOk ? CheckCircle2 : isPartial ? AlertTriangle : AlertCircle
  const iconColor = isOk ? 'text-green-600' : isPartial ? 'text-amber-600' : 'text-red-600'
  const title = isOk ? 'Lot validé' : isPartial ? 'Validation partielle' : 'Validation annulée'

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-4">
        <Icon size={40} className={`${iconColor} mb-2`} />
        <p className="text-lg font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-1">{result.allocations_inserted} allocation(s) · {result.lines_processed} ligne(s) traitée(s){result.lines_skipped > 0 ? ` · ${result.lines_skipped} ignorée(s)` : ''}</p>
      </div>

      {result.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
          <p className="text-xs font-semibold text-red-700 uppercase mb-2">Erreurs</p>
          <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">{result.errors.map((e, i) => (<li key={i}>{e}</li>))}</ul>
        </div>
      )}

      {result.issues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 uppercase mb-2">Issues par ligne</p>
          <div className="space-y-1.5">
            {result.issues.map((iss, idx) => (
              <div key={idx} className="text-xs text-amber-900 flex items-start gap-2">
                <span className={`inline-block px-1.5 py-0.5 rounded font-mono ${iss.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{iss.code}</span>
                <div className="flex-1"><span className="font-mono text-gray-500">{iss.line_id === '-' ? '—' : `${iss.line_id.slice(0, 8)}…`}</span> {iss.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isAborted && result.summary && (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <div className="px-4 py-2 bg-gray-100 border-b border-gray-200"><p className="text-xs font-semibold text-gray-700 uppercase">Récap financier</p></div>
          <div className="px-4 py-3 space-y-1.5">
            <SummaryRow label="Brut total" value={result.summary.total_brut} strong />
            <SummaryRow label="Apporteur interne" value={result.summary.total_apporteur_interne} dim />
            <SummaryRow label="Apporteur externe" value={result.summary.total_apporteur_ext} dim />
            <SummaryRow label="PEV Gestion" value={result.summary.total_pev_gestion} dim />
            <SummaryRow label="Cabinet pré-rule" value={result.summary.total_cabinet_prededuction} dim />
            <SummaryRow label="Consultant" value={result.summary.total_consultant} />
            <SummaryRow label="POOL+" value={result.summary.total_pool_plus} />
            <SummaryRow label="Thélo" value={result.summary.total_thelo} />
            <SummaryRow label="Maxine" value={result.summary.total_maxine} />
            <SummaryRow label="Stéphane" value={result.summary.total_stephane} />
            <SummaryRow label="Cabinet (post)" value={result.summary.total_cabinet_post_rule} />
            <div className="border-t border-gray-200 my-2" />
            <SummaryRow label="= Total reconstitué" value={result.summary.total_reconstitue} accent />
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryRow({ label, value, strong, dim, accent }: { label: string; value: number; strong?: boolean; dim?: boolean; accent?: boolean }) {
  return (<div className={`flex items-center justify-between text-sm ${strong ? 'font-semibold text-gray-900' : dim ? 'text-gray-600' : accent ? 'font-semibold text-blue-900' : 'text-gray-800'}`}><span>{label}</span><span className="tabular-nums">{fmtEUR.format(value)}</span></div>)
}
