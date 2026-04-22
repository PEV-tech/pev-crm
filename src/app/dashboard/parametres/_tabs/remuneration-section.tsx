'use client'

/**
 * Section "Rémunération"
 *
 * Grilles de rémunération PAR CATÉGORIE DE PRODUIT :
 *   · CAV       → contrat assurance-vie français (grille sur encours)
 *   · CAPI_LUX  → capi / assurance-vie Luxembourg (grille sur encours)
 *   · PE        → private equity (grille sur droits d'entrée, dégressive)
 *
 * Les taux sont INDICATIFS. Le consultant peut les surcharger au niveau
 * du dossier lors de la saisie.
 */

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X, Edit2, Trash2, Plus, TrendingUp, Wand2 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatting'
import { formatPercent2, parseRateInput, rateToInput, type ShowToast, SECTION_INTRO_CLS } from './helpers'

interface Props {
  isManager: boolean
  showToast: ShowToast
}

type Categorie = 'CAV' | 'CAPI_LUX' | 'PE'

type Grille = {
  id: string
  type_frais: 'gestion' | 'entree'
  encours_min: number
  encours_max: number | null
  taux: number
  actif: boolean | null
  produit_categorie: Categorie | null
  libelle: string | null
}

const CATEGORIES: { key: Categorie; label: string; hint: string; defaultType: 'gestion' | 'entree' }[] = [
  {
    key: 'CAV',
    label: 'CAV',
    hint: "Contrat Assurance-Vie français — grille appliquée à l'encours.",
    defaultType: 'gestion',
  },
  {
    key: 'CAPI_LUX',
    label: 'CAPI Luxembourg',
    hint: 'Capi / assurance-vie Luxembourg — grille sur encours.',
    defaultType: 'gestion',
  },
  {
    key: 'PE',
    label: 'Private Equity',
    hint: "Grille sur droits d'entrée — dégressive selon le montant souscrit.",
    defaultType: 'entree',
  },
]

const PE_PRESET: Omit<Grille, 'id'>[] = [
  { type_frais: 'entree', encours_min: 100000, encours_max: 200000, taux: 0.03,  actif: true, produit_categorie: 'PE', libelle: "PE — Droit d'entrée 100K-200K" },
  { type_frais: 'entree', encours_min: 200000, encours_max: 300000, taux: 0.02,  actif: true, produit_categorie: 'PE', libelle: "PE — Droit d'entrée 200K-300K" },
  { type_frais: 'entree', encours_min: 300000, encours_max: 500000, taux: 0.01,  actif: true, produit_categorie: 'PE', libelle: "PE — Droit d'entrée 300K-500K" },
  { type_frais: 'entree', encours_min: 500000, encours_max: null,   taux: 0.005, actif: true, produit_categorie: 'PE', libelle: "PE — Droit d'entrée 500K et +" },
]

export function RemunerationSection({ isManager, showToast }: Props) {
  const supabase = createClient()
  const [grilles, setGrilles] = React.useState<Grille[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<{ id: string; data: Grille } | null>(null)
  const [creating, setCreating] = React.useState<{ categorie: Categorie; data: Partial<Grille> } | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [seeding, setSeeding] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    const { data } = await supabase
      .from('grilles_frais')
      .select('*')
      .order('produit_categorie' as never)
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

  const seedPePreset = async () => {
    if (!confirm("Installer le barème PE indicatif (3% → 0,5% dégressif) ?")) return
    setSeeding(true)
    const { error } = await (supabase.from('grilles_frais') as any).insert(PE_PRESET)
    setSeeding(false)
    if (error) return showToast('Impossible de seeder le preset PE', 'error')
    showToast('Barème PE installé', 'success')
    await fetchData()
  }

  if (loading) return <p className="text-gray-500 p-4">Chargement…</p>

  const byCategorie = (cat: Categorie) =>
    grilles.filter(
      (g) =>
        g.produit_categorie === cat ||
        // Les grilles historiques (sans catégorie) sont rangées sous CAV
        (cat === 'CAV' && !g.produit_categorie),
    )

  return (
    <div className="space-y-4">
      <div className={SECTION_INTRO_CLS}>
        <p className="mb-1">
          <strong>Barèmes de rémunération par catégorie de produit.</strong>{' '}
          Chaque grille définit les taux par tranches (min/max). Ces taux sont
          <em> indicatifs</em> — le consultant peut les ajuster au moment de la
          saisie du dossier.
        </p>
      </div>

      <Tabs defaultValue="CAV" className="space-y-3">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
              <span className="ml-1.5 text-[10px] text-gray-500">
                ({byCategorie(c.key).length})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((c) => {
          const rows = byCategorie(c.key)
          const hasAny = rows.length > 0
          return (
            <TabsContent key={c.key} value={c.key} className="space-y-3">
              <div className="rounded-md border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-600">
                {c.hint}
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-500">{rows.length} grille(s)</p>
                <div className="flex items-center gap-2">
                  {isManager && c.key === 'PE' && !hasAny && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={seedPePreset}
                      disabled={seeding}
                    >
                      <Wand2 size={14} className="mr-1" />
                      Installer le barème PE indicatif
                    </Button>
                  )}
                  {isManager && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCreating({
                          categorie: c.key,
                          data: {
                            type_frais: c.defaultType,
                            actif: true,
                            encours_min: 0,
                            produit_categorie: c.key,
                          },
                        })
                      }
                      disabled={creating !== null}
                    >
                      <Plus size={14} className="mr-1" /> Nouvelle grille
                    </Button>
                  )}
                </div>
              </div>

              {isManager && creating?.categorie === c.key && (
                <GrilleForm
                  value={creating.data as Grille}
                  onChange={(d) =>
                    setCreating({ categorie: c.key, data: { ...d, produit_categorie: c.key } })
                  }
                  onSave={() => save({ ...(creating.data as Grille), produit_categorie: c.key }, true)}
                  onCancel={() => setCreating(null)}
                  saving={saving}
                  isNew
                />
              )}

              <GrillesTable
                rows={rows}
                editing={editing}
                setEditing={setEditing}
                onSave={save}
                onRemove={remove}
                saving={saving}
                isManager={isManager}
              />

              {c.key !== 'PE' && hasAny && (
                <RemunerationPreview
                  grille={rows.find((g) => g.type_frais === 'gestion' && g.actif) || rows[0]}
                />
              )}
              {c.key === 'PE' && hasAny && <PeLadderPreview rows={rows.filter((r) => r.actif)} />}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

/* -------- Table -------- */

function GrillesTable({
  rows,
  editing,
  setEditing,
  onSave,
  onRemove,
  saving,
  isManager,
}: {
  rows: Grille[]
  editing: { id: string; data: Grille } | null
  setEditing: (v: { id: string; data: Grille } | null) => void
  onSave: (row: Grille) => Promise<void>
  onRemove: (id: string) => Promise<void>
  saving: boolean
  isManager: boolean
}) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b text-xs uppercase tracking-wider text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left">Libellé</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-right">Min</th>
            <th className="px-3 py-2 text-right">Max</th>
            <th className="px-3 py-2 text-right">Taux annuel</th>
            <th className="px-3 py-2 text-center">Actif</th>
            {isManager && <th className="px-3 py-2 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={isManager ? 7 : 6} className="py-6 text-center text-gray-400">
                Aucune grille dans cette catégorie
              </td>
            </tr>
          )}
          {rows.map((g) => {
            const isEditing = editing?.id === g.id
            if (isEditing) {
              return (
                <tr key={g.id} className="bg-blue-50/40">
                  <td colSpan={isManager ? 7 : 6} className="p-3">
                    <GrilleForm
                      value={editing!.data}
                      onChange={(d) => setEditing({ id: editing!.id, data: d })}
                      onSave={() => onSave(editing!.data)}
                      onCancel={() => setEditing(null)}
                      saving={saving}
                    />
                  </td>
                </tr>
              )
            }
            return (
              <tr key={g.id} className="hover:bg-gray-50/50">
                <td className="px-3 py-2 text-gray-800">{g.libelle || <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${g.type_frais === 'gestion' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {g.type_frais === 'gestion' ? 'Gestion (encours)' : "Entrée"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{formatCurrency(g.encours_min)}</td>
                <td className="px-3 py-2 text-right">{g.encours_max ? formatCurrency(g.encours_max) : '∞'}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-700">{formatPercent2(g.taux)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${g.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {g.actif ? 'Oui' : 'Non'}
                  </span>
                </td>
                {isManager && (
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ id: g.id, data: g })}><Edit2 size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => onRemove(g.id)}><Trash2 size={14} className="text-red-500" /></Button>
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* -------- Form -------- */

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
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Libellé (facultatif)</label>
          <Input
            value={value.libelle ?? ''}
            placeholder="Ex. PE — Droit d'entrée 100K-200K"
            onChange={(e) => update({ libelle: e.target.value || null })}
          />
        </div>
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
          <label className="block text-xs font-medium text-gray-500 mb-1">Min (€)</label>
          <Input type="number" value={value.encours_min ?? ''} onChange={(e) => update({ encours_min: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Max (€)</label>
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

/* -------- Previews -------- */

function RemunerationPreview({ grille }: { grille: Grille }) {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
      <p className="font-medium flex items-center gap-2 mb-1">
        <TrendingUp size={16} /> Exemple de calcul sur encours
      </p>
      <p className="text-xs">
        Pour un encours de 500&nbsp;000&nbsp;€ avec un taux de{' '}
        <strong>{formatPercent2(grille.taux)}</strong> :<br />
        Rémunération annuelle cabinet = {formatCurrency(500000 * grille.taux)}<br />
        Rémunération trimestrielle cabinet = {formatCurrency((500000 * grille.taux) / 4)}
      </p>
    </div>
  )
}

function PeLadderPreview({ rows }: { rows: Grille[] }) {
  // Simulation : 250K€ souscrit. Applique la tranche correspondante.
  const simul = 250000
  const applicable = rows
    .filter((r) => r.type_frais === 'entree')
    .find(
      (r) =>
        simul >= r.encours_min &&
        (r.encours_max === null || simul <= r.encours_max),
    )
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
      <p className="font-medium flex items-center gap-2 mb-1">
        <TrendingUp size={16} /> Simulation PE — 250 000 € souscrits
      </p>
      {applicable ? (
        <p className="text-xs">
          Tranche appliquée : <strong>{formatCurrency(applicable.encours_min)}</strong>
          {' – '}
          {applicable.encours_max ? formatCurrency(applicable.encours_max) : '∞'}{' '}
          → <strong>{formatPercent2(applicable.taux)}</strong><br />
          Droits d&apos;entrée cabinet = {formatCurrency(simul * applicable.taux)}
        </p>
      ) : (
        <p className="text-xs">Aucune tranche ne couvre 250 000 €.</p>
      )}
    </div>
  )
}
