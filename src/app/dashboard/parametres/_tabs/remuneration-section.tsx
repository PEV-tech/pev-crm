'use client'

/**
 * Section "Rémunération"
 *
 * Grilles de rémunération sur encours (table `grilles_frais`, type_frais='gestion'
 * ou 'entree'). Pilote le calcul de la rémunération trimestrielle cabinet.
 */

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X, Edit2, Trash2, Plus, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/formatting'
import { formatPercent2, parseRateInput, rateToInput, type ShowToast, SECTION_INTRO_CLS } from './helpers'

interface Props {
  isManager: boolean
  showToast: ShowToast
}

type Grille = {
  id: string
  type_frais: 'gestion' | 'entree'
  encours_min: number
  encours_max: number | null
  taux: number
  actif: boolean | null
}

export function RemunerationSection({ isManager, showToast }: Props) {
  const supabase = createClient()
  const [grilles, setGrilles] = React.useState<Grille[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<{ id: string; data: Grille } | null>(null)
  const [creating, setCreating] = React.useState<Partial<Grille> | null>(null)
  const [saving, setSaving] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    const { data } = await supabase
      .from('grilles_frais')
      .select('*')
      .order('type_frais')
      .order('encours_min')
    setGrilles((data as any) || [])
    setLoading(false)
  }, [supabase])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const save = async (row: Grille, isNew = false) => {
    setSaving(true)
    const { id, ...patch } = row
    const { error } = isNew
      ? await (supabase.from('grilles_frais') as any).insert([patch])
      : await (supabase.from('grilles_frais') as any).update(patch).eq('id', id)
    setSaving(false)
    if (error) return showToast('Erreur lors de la sauvegarde', 'error')
    showToast(isNew ? 'Grille créée' : 'Grille mise à jour', 'success')
    setEditing(null)
    setCreating(null)
    await fetchData()
  }

  const remove = async (id: string) => {
    if (!confirm('Supprimer cette grille ?')) return
    const { error } = await supabase.from('grilles_frais').delete().eq('id', id)
    if (error) return showToast('Suppression impossible', 'error')
    showToast('Grille supprimée', 'success')
    await fetchData()
  }

  if (loading) return <p className="text-gray-500 p-4">Chargement…</p>

  const gestionActive = grilles.find((g) => g.type_frais === 'gestion' && g.actif)

  return (
    <div className="space-y-4">
      <div className={SECTION_INTRO_CLS}>
        <p className="mb-1">
          <strong>Barèmes de rémunération sur encours et sur frais d'entrée.</strong>
        </p>
        <p className="text-xs text-indigo-700">
          Règle appliquée : <em>rémunération trimestrielle cabinet = encours × taux annuel ÷ 4 × part consultant</em>.
          Les tranches (min/max) permettent des barèmes progressifs.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{grilles.length} grille(s)</p>
        {isManager && (
          <Button size="sm" variant="outline" onClick={() => setCreating({ type_frais: 'gestion', actif: true, encours_min: 0 })} disabled={creating !== null}>
            <Plus size={14} className="mr-1" /> Nouvelle grille
          </Button>
        )}
      </div>

      {isManager && creating && (
        <GrilleForm
          value={creating as Grille}
          onChange={(d) => setCreating(d)}
          onSave={() => save(creating as Grille, true)}
          onCancel={() => setCreating(null)}
          saving={saving}
          isNew
        />
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs uppercase tracking-wider text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Encours min</th>
              <th className="px-3 py-2 text-right">Encours max</th>
              <th className="px-3 py-2 text-right">Taux annuel</th>
              <th className="px-3 py-2 text-right">Taux trimestriel</th>
              <th className="px-3 py-2 text-center">Actif</th>
              {isManager && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {grilles.length === 0 && (
              <tr>
                <td colSpan={isManager ? 7 : 6} className="py-6 text-center text-gray-400">
                  Aucune grille configurée
                </td>
              </tr>
            )}
            {grilles.map((g) => {
              const isEditing = editing?.id === g.id
              if (isEditing) {
                return (
                  <tr key={g.id} className="bg-blue-50/40">
                    <td colSpan={isManager ? 7 : 6} className="p-3">
                      <GrilleForm
                        value={editing!.data}
                        onChange={(d) => setEditing({ id: editing!.id, data: d })}
                        onSave={() => save(editing!.data)}
                        onCancel={() => setEditing(null)}
                        saving={saving}
                      />
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={g.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${g.type_frais === 'gestion' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {g.type_frais === 'gestion' ? 'Gestion (encours)' : 'Entrée'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(g.encours_min)}</td>
                  <td className="px-3 py-2 text-right">{g.encours_max ? formatCurrency(g.encours_max) : '∞'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700">{formatPercent2(g.taux)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatPercent2(g.taux / 4)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${g.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.actif ? 'Oui' : 'Non'}
                    </span>
                  </td>
                  {isManager && (
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ id: g.id, data: g })}><Edit2 size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(g.id)}><Trash2 size={14} className="text-red-500" /></Button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {gestionActive && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium flex items-center gap-2 mb-1">
            <TrendingUp size={16} /> Exemple de calcul de rémunération sur encours
          </p>
          <p className="text-xs">
            Pour un encours de 500&nbsp;000&nbsp;€ avec un taux de gestion de{' '}
            <strong>{formatPercent2(gestionActive.taux)}</strong> :
            <br />
            Rémunération annuelle cabinet = {formatCurrency(500000 * gestionActive.taux)}
            <br />
            Rémunération trimestrielle cabinet = {formatCurrency((500000 * gestionActive.taux) / 4)}
          </p>
        </div>
      )}
    </div>
  )
}

function GrilleForm({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  value: Grille
  onChange: (v: Grille) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew?: boolean
}) {
  const update = (patch: Partial<Grille>) => onChange({ ...value, ...patch })
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
            value={value.type_frais}
            onChange={(e) => update({ type_frais: e.target.value as 'gestion' | 'entree' })}
          >
            <option value="gestion">Gestion (encours)</option>
            <option value="entree">Entrée</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Encours min (€)</label>
          <Input type="number" value={value.encours_min ?? ''} onChange={(e) => update({ encours_min: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Encours max (€)</label>
          <Input type="number" value={value.encours_max ?? ''} placeholder="Illimité" onChange={(e) => update({ encours_max: e.target.value === '' ? null : parseFloat(e.target.value) })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Taux annuel (%)</label>
          <Input type="number" step="0.01" value={rateToInput(value.taux)} onChange={(e) => update({ taux: parseRateInput(e.target.value) ?? 0 })} />
        </div>
        <label className="flex items-center gap-2 text-sm pt-5 md:col-span-1 col-span-2">
          <input type="checkbox" checked={value.actif ?? true} onChange={(e) => update({ actif: e.target.checked })} />
          Actif
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          <X size={14} className="mr-1" /> Annuler
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          <Check size={14} className="mr-1" /> {isNew ? 'Créer' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}
