'use client'

/**
 * commission-splits-tab.tsx — Édition de la grille des 9 règles de split
 * commission (Param\u00e8tres → R\u00e9mun\u00e9ration → onglet "Splits").
 *
 * 2026-04-25 — Sortie des 9 r\u00e8gles de `src/lib/commissions/rules.ts` vers
 * la table DB `commission_split_rules`. Lecture pour tous les
 * authentifi\u00e9s, \u00e9dition pour managers uniquement (RLS + UI).
 */

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X, Edit2, AlertTriangle, Info } from 'lucide-react'
import type { ShowToast } from '@/app/dashboard/parametres/_tabs/helpers'
import { invalidateCommissionRulesCache } from '@/lib/commissions/rules-loader'

interface Props {
  isManager: boolean
  showToast: ShowToast
}

interface SplitRule {
  id: string
  rule_key: string
  name: string
  description: string | null
  part_consultant: number
  part_pool_plus: number
  part_thelo: number
  part_maxine: number
  part_stephane: number
  part_cabinet: number
  sort_order: number
  updated_at: string
  updated_by: string | null
}

const PART_FIELDS: Array<{ key: keyof SplitRule; label: string; tooltip?: string }> = [
  { key: 'part_consultant', label: 'Consultant', tooltip: 'Consultant rattaché au dossier' },
  { key: 'part_pool_plus',  label: 'POOL+',      tooltip: 'Tiers du pot pool (cf. répartition tierce)' },
  { key: 'part_thelo',      label: 'Thélo' },
  { key: 'part_maxine',     label: 'Maxine' },
  { key: 'part_stephane',   label: 'Stéphane',   tooltip: 'Part dédiée Stéphane (rules entrée/France)' },
  { key: 'part_cabinet',    label: 'Cabinet',    tooltip: 'Part PEV cabinet' },
]

function rowSum(r: SplitRule): number {
  return Number(r.part_consultant) + Number(r.part_pool_plus) + Number(r.part_thelo)
       + Number(r.part_maxine) + Number(r.part_stephane) + Number(r.part_cabinet)
}

export function CommissionSplitsTab({ isManager, showToast }: Props) {
  const supabase = React.useMemo(() => createClient(), [])
  const [rules, setRules] = React.useState<SplitRule[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<SplitRule | null>(null)
  const [saving, setSaving] = React.useState(false)

  const fetchRules = React.useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('commission_split_rules' as never)
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) {
      showToast('Erreur chargement splits : ' + error.message, 'error')
      setRules([])
    } else {
      setRules((data ?? []) as unknown as SplitRule[])
    }
    setLoading(false)
  }, [supabase, showToast])

  React.useEffect(() => { void fetchRules() }, [fetchRules])

  const startEdit = (r: SplitRule) => {
    setEditingId(r.id)
    setDraft({ ...r })
  }
  const cancelEdit = () => {
    setEditingId(null)
    setDraft(null)
  }

  const updateField = (key: keyof SplitRule, value: number) => {
    if (!draft) return
    setDraft({ ...draft, [key]: value })
  }

  const save = async () => {
    if (!draft) return
    const sum = rowSum(draft)
    // Tolérance d'arrondi ±0.05 pour les fractions tierces (23.33 etc.)
    if (draft.rule_key !== 'encours' && Math.abs(sum - 100) > 0.5) {
      showToast(`Somme des parts = ${sum.toFixed(2)}% — doit valoir 100% (tolérance 0.5)`, 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('commission_split_rules' as never)
      .update({
        part_consultant: draft.part_consultant,
        part_pool_plus: draft.part_pool_plus,
        part_thelo: draft.part_thelo,
        part_maxine: draft.part_maxine,
        part_stephane: draft.part_stephane,
        part_cabinet: draft.part_cabinet,
      } as never)
      .eq('id' as never, draft.id)
    setSaving(false)
    if (error) {
      showToast('Sauvegarde KO : ' + error.message, 'error')
      return
    }
    invalidateCommissionRulesCache()
    showToast(`Règle "${draft.name}" mise à jour`, 'success')
    setEditingId(null)
    setDraft(null)
    void fetchRules()
  }

  if (loading) {
    return <p className="text-sm text-gray-500 py-4">Chargement des règles de split…</p>
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 flex gap-2">
        <Info size={14} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-1">Comment ça marche</p>
          <p className="leading-relaxed">
            Les 9 règles ci-dessous décrivent comment chaque commission est répartie entre le consultant,
            le pot POOL (Thélo / Maxine / POOL+), Stéphane et le cabinet. Pour chaque règle, la somme des
            parts doit valoir 100% (sauf <em>Encours</em> qui est à 0 — déterminé dynamiquement).
            {' '}<strong>Toute modification s&apos;applique aux nouveaux encaissements</strong> ; les
            allocations historiques restent figées par snapshot.
          </p>
        </div>
      </div>

      {!isManager && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <p>Lecture seule — seuls les <strong>managers</strong> peuvent modifier ces règles.</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50">Règle</th>
              {PART_FIELDS.map((f) => (
                <th key={f.key} className="px-3 py-2 text-right font-semibold text-gray-700" title={f.tooltip}>
                  {f.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
              {isManager && <th className="px-3 py-2 text-center font-semibold text-gray-700 w-24">Action</th>}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const isEditing = editingId === r.id
              const display = isEditing && draft ? draft : r
              const sum = rowSum(display)
              const sumOk = r.rule_key === 'encours' || Math.abs(sum - 100) <= 0.5
              return (
                <tr key={r.id} className={`border-b border-gray-100 last:border-0 ${isEditing ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-2 sticky left-0 bg-inherit">
                    <div className="font-medium text-gray-900">{r.name}</div>
                    {r.description && (
                      <div className="text-[11px] text-gray-500 max-w-md mt-0.5 leading-snug">{r.description}</div>
                    )}
                  </td>
                  {PART_FIELDS.map((f) => {
                    const value = display[f.key] as number
                    return (
                      <td key={f.key} className="px-3 py-2 text-right tabular-nums">
                        {isEditing && draft ? (
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            value={value}
                            onChange={(e) => updateField(f.key, Number(e.target.value))}
                            className="w-20 text-right ml-auto"
                          />
                        ) : (
                          <span className={value > 0 ? 'text-gray-900' : 'text-gray-400'}>
                            {Number(value).toFixed(2)}%
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${sumOk ? 'text-green-700' : 'text-red-600'}`}>
                    {sum.toFixed(2)}%
                  </td>
                  {isManager && (
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={save} disabled={saving} className="h-7 w-7 p-0">
                            <Check size={14} className="text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving} className="h-7 w-7 p-0">
                            <X size={14} className="text-gray-600" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(r)} disabled={editingId !== null} className="h-7 w-7 p-0">
                          <Edit2 size={14} className="text-gray-600" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Source : table <code className="text-gray-600">commission_split_rules</code> (9 lignes,
        <code className="text-gray-600 ml-1">rule_key</code> immutables). Audit trail complet dans
        <code className="text-gray-600 ml-1">audit_logs</code> à chaque modification.
      </p>
    </div>
  )
}
