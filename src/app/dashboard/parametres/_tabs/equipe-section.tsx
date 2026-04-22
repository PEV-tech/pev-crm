'use client'

/**
 * Section "Équipe"
 *   - Sous-onglet Consultants : CRUD consultants (recherche, ajout, édition, désactivation, suppression)
 *   - Sous-onglet Objectifs  : objectifs de collecte annuels par consultant
 *
 * Les données sont DB-driven (table `consultants` + `challenges`).
 */

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Edit2, Trash2, Check, X, Plus, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/formatting'
import { formatPercent0, parseRateInput, rateToInput, type ShowToast, SECTION_INTRO_CLS } from './helpers'

interface Props {
  isManager: boolean
  showToast: ShowToast
}

const roleLabel: Record<string, string> = {
  manager: 'Manager',
  consultant: 'Consultant',
  back_office: 'Back Office',
}

export function EquipeSection({ isManager, showToast }: Props) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="consultants" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="consultants">Consultants</TabsTrigger>
          <TabsTrigger value="objectifs">Objectifs</TabsTrigger>
        </TabsList>
        <TabsContent value="consultants">
          <ConsultantsTab isManager={isManager} showToast={showToast} />
        </TabsContent>
        <TabsContent value="objectifs">
          <ObjectifsTab isManager={isManager} showToast={showToast} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* -------- Consultants -------- */

function ConsultantsTab({ isManager, showToast }: Props) {
  const supabase = createClient()
  const [consultants, setConsultants] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [editing, setEditing] = React.useState<{ id: string; data: Record<string, any> } | null>(null)
  const [creating, setCreating] = React.useState<Record<string, any> | null>(null)
  const [saving, setSaving] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    const { data } = await supabase.from('consultants').select('*').order('prenom')
    setConsultants(data || [])
    setLoading(false)
  }, [supabase])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = React.useMemo(() => {
    if (!search.trim()) return consultants
    const q = search.toLowerCase()
    return consultants.filter(
      (c: any) =>
        c.prenom?.toLowerCase().includes(q) ||
        c.nom?.toLowerCase().includes(q) ||
        c.zone?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q)
    )
  }, [consultants, search])

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    const { error } = await (supabase.from('consultants') as any)
      .update(editing.data)
      .eq('id', editing.id)
    setSaving(false)
    if (error) {
      showToast('Erreur lors de la sauvegarde', 'error')
      return
    }
    showToast('Consultant mis à jour', 'success')
    setEditing(null)
    await fetchData()
  }

  const handleCreate = async () => {
    if (!creating) return
    setSaving(true)
    const { error } = await (supabase.from('consultants') as any).insert([creating])
    setSaving(false)
    if (error) {
      showToast('Erreur lors de la création', 'error')
      return
    }
    showToast('Consultant créé', 'success')
    setCreating(null)
    await fetchData()
  }

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Supprimer ${label} ? (Préférer désactiver si vous voulez garder l'historique)`)) return
    const { error } = await supabase.from('consultants').delete().eq('id', id)
    if (error) {
      showToast('Suppression impossible (références existantes ?)', 'error')
      return
    }
    showToast('Consultant supprimé', 'success')
    await fetchData()
  }

  if (loading) return <p className="text-gray-500 p-4">Chargement…</p>

  return (
    <div className="space-y-4">
      <div className={SECTION_INTRO_CLS}>
        Gère les utilisateurs du CRM. Le <strong>taux de rémunération</strong> est la part consultant
        appliquée sur les commissions cabinet (contrat mandat : 65 / 75 / 85 % selon paliers).
        Désactiver plutôt que supprimer pour préserver l'historique.
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, zone, rôle…"
            className="pl-9"
          />
        </div>
        <span className="text-sm text-gray-500 ml-auto">
          {filtered.length} / {consultants.length} consultant(s)
        </span>
        {isManager && (
          <Button size="sm" variant="outline" onClick={() => setCreating({ actif: true, role: 'consultant' })} disabled={creating !== null}>
            <Plus size={14} className="mr-1" /> Nouveau
          </Button>
        )}
      </div>

      {isManager && creating && (
        <ConsultantForm
          data={creating}
          onChange={setCreating}
          onSave={handleCreate}
          onCancel={() => setCreating(null)}
          saving={saving}
          isNew
        />
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Prénom</th>
              <th className="px-3 py-2 text-left">Nom</th>
              <th className="px-3 py-2 text-left">Rôle</th>
              <th className="px-3 py-2 text-right">Taux rém.</th>
              <th className="px-3 py-2 text-left">Zone</th>
              <th className="px-3 py-2 text-center">Statut</th>
              {isManager && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isManager ? 7 : 6} className="py-6 text-center text-gray-400">
                  Aucun consultant
                </td>
              </tr>
            )}
            {filtered.map((c: any) => {
              const isEditing = editing?.id === c.id
              if (isEditing) {
                return (
                  <tr key={c.id} className="bg-blue-50/40">
                    <td colSpan={isManager ? 7 : 6} className="p-3">
                      <ConsultantForm
                        data={editing!.data}
                        onChange={(d) => setEditing({ id: editing!.id, data: d! })}
                        onSave={handleSave}
                        onCancel={() => setEditing(null)}
                        saving={saving}
                      />
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2 font-medium text-gray-900">{c.prenom}</td>
                  <td className="px-3 py-2 text-gray-700">{c.nom}</td>
                  <td className="px-3 py-2 text-gray-700">{roleLabel[c.role] || c.role}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatPercent0(c.taux_remuneration)}</td>
                  <td className="px-3 py-2 text-gray-600">{c.zone || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${c.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  {isManager && (
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.id, data: { ...c } })} aria-label="Modifier">
                          <Edit2 size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id, `${c.prenom} ${c.nom}`)} aria-label="Supprimer">
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ConsultantForm({
  data,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  data: Record<string, any>
  onChange: (d: Record<string, any> | null) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew?: boolean
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
      <LabeledInput label="Prénom" value={data.prenom || ''} onChange={(v) => onChange({ ...data, prenom: v })} />
      <LabeledInput label="Nom" value={data.nom || ''} onChange={(v) => onChange({ ...data, nom: v })} />
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Rôle</label>
        <select
          className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
          value={data.role || 'consultant'}
          onChange={(e) => onChange({ ...data, role: e.target.value })}
        >
          <option value="consultant">Consultant</option>
          <option value="manager">Manager</option>
          <option value="back_office">Back Office</option>
        </select>
      </div>
      <LabeledInput
        label="Taux rém. (%)"
        type="number"
        step="0.1"
        value={rateToInput(data.taux_remuneration)}
        onChange={(v) => onChange({ ...data, taux_remuneration: parseRateInput(v) })}
      />
      <LabeledInput label="Zone" value={data.zone || ''} onChange={(v) => onChange({ ...data, zone: v })} />
      <label className="flex items-center gap-2 text-sm pt-5">
        <input
          type="checkbox"
          checked={data.actif ?? true}
          onChange={(e) => onChange({ ...data, actif: e.target.checked })}
        />
        Actif
      </label>
      <div className="col-span-full flex justify-end gap-2">
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

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  step,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  step?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <Input type={type} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/* -------- Objectifs -------- */

function ObjectifsTab({ isManager, showToast }: Props) {
  const supabase = createClient()
  const [consultants, setConsultants] = React.useState<any[]>([])
  const [challenges, setChallenges] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Record<string, number>>({})
  const [saving, setSaving] = React.useState(false)
  const annee = new Date().getFullYear()

  const fetchData = React.useCallback(async () => {
    const [c, ch] = await Promise.all([
      supabase.from('consultants').select('*').eq('actif', true),
      supabase.from('challenges').select('*').eq('annee', annee),
    ])
    setConsultants(c.data || [])
    setChallenges(ch.data || [])
    setLoading(false)
  }, [supabase, annee])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async (consultantId: string) => {
    const val = form[consultantId] || 0
    setSaving(true)
    const existing = challenges.find((c) => c.consultant_id === consultantId)
    let error
    if (existing) {
      ;({ error } = await supabase.from('challenges').update({ objectif: val }).eq('id', existing.id))
    } else {
      ;({ error } = await supabase
        .from('challenges')
        .insert({ consultant_id: consultantId, annee, objectif: val, collecte: 0 }))
    }
    setSaving(false)
    if (error) {
      showToast('Erreur lors de la sauvegarde', 'error')
      return
    }
    showToast('Objectif mis à jour', 'success')
    setEditing(null)
    await fetchData()
  }

  if (loading) return <p className="text-gray-500 p-4">Chargement…</p>

  const list = consultants
    .filter((c: any) => c.role !== 'back_office')
    .sort((a: any, b: any) => a.prenom.localeCompare(b.prenom))

  const total = list.reduce((acc, c: any) => {
    const ch = challenges.find((x) => x.consultant_id === c.id)
    return acc + (ch?.objectif || 0)
  }, 0)
  const totalCollecte = list.reduce((acc, c: any) => {
    const ch = challenges.find((x) => x.consultant_id === c.id)
    return acc + (ch?.collecte || 0)
  }, 0)

  return (
    <div className="space-y-4">
      <div className={SECTION_INTRO_CLS}>
        <strong>Objectifs de collecte {annee}</strong> par consultant. La colonne « Collecte actuelle »
        est calculée à partir des dossiers signés sur l'année (alimentation automatique).
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Consultant</th>
              <th className="px-3 py-2 text-left">Rôle</th>
              <th className="px-3 py-2 text-right">Objectif {annee}</th>
              <th className="px-3 py-2 text-right">Collecte actuelle</th>
              <th className="px-3 py-2 text-right">% atteint</th>
              {isManager && <th className="px-3 py-2 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((c: any) => {
              const ch = challenges.find((x) => x.consultant_id === c.id)
              const objectif = ch?.objectif || 0
              const collecte = ch?.collecte || 0
              const pct = objectif > 0 ? (collecte / objectif) * 100 : 0
              const isEditing = editing === c.id
              return (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {c.prenom} {c.nom}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{roleLabel[c.role] || c.role}</td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={form[c.id] ?? ''}
                        step="10000"
                        onChange={(e) => setForm((p) => ({ ...p, [c.id]: parseFloat(e.target.value) || 0 }))}
                        className="w-36 ml-auto text-right"
                      />
                    ) : (
                      <span className={objectif > 0 ? 'font-semibold' : 'text-gray-400'}>
                        {objectif > 0 ? formatCurrency(objectif) : 'Non défini'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(collecte)}</td>
                  <td className="px-3 py-2 text-right">
                    {objectif > 0 ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-12 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {isManager && (
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleSave(c.id)} disabled={saving}>
                            <Check size={14} className="text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            <X size={14} className="text-red-500" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(c.id)
                            setForm((p) => ({ ...p, [c.id]: objectif }))
                          }}
                        >
                          <Edit2 size={14} />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold text-gray-700 border-t">
            <tr>
              <td className="px-3 py-2" colSpan={2}>Total équipe</td>
              <td className="px-3 py-2 text-right">{formatCurrency(total)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totalCollecte)}</td>
              <td className="px-3 py-2 text-right">
                {total > 0 ? `${((totalCollecte / total) * 100).toFixed(0)}%` : '—'}
              </td>
              {isManager && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
