'use client'

/**
 * Section "Catalogue"
 *
 * Organisation demandée (Maxine, 2026-04-22) :
 *   Partenaire (compagnie) → Produits → Détails (frais entrée, encours, prix part,
 *   commission rétrocédée)
 *
 * Tout est pilot\u00e9 DB : aucun taux en dur.
 *   - `compagnies`                → partenaire (nom + taux_defaut, taux_encours)
 *   - `produits`                  → produits (nom + categorie)
 *   - `taux_produit_compagnie`    → la jonction qui porte les détails par couple
 *                                   (frais_entree, frais_encours, prix_part,
 *                                    commission_retrocedee, taux, description)
 *
 * ⚠ Requiert la migration 2026-04-22_catalogue_details.sql (ajoute les 4 colonnes
 *    de détails sur taux_produit_compagnie + taux_encours sur compagnies).
 */

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronDown, ChevronRight, Edit2, Trash2, Check, X, Plus, Search, AlertCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatting'
import {
  formatPercent2, parseRateInput, rateToInput, type ShowToast, SECTION_INTRO_CLS,
} from './helpers'
import { SousProduitsEditor } from '@/components/parametres/sous-produits-editor'

interface Props {
  isManager: boolean
  showToast: ShowToast
}

type Compagnie = {
  id: string
  nom: string
  taux_defaut: number | null
  taux_encours?: number | null
}

type Produit = {
  id: string
  nom: string
  categorie: string | null
}

type TauxRow = {
  id: string
  compagnie_id: string | null
  produit_id: string | null
  taux: number
  actif: boolean | null
  description: string | null
  frais_entree?: number | null
  frais_encours?: number | null
  prix_part?: number | null
  commission_retrocedee?: number | null
}

export function CatalogueSection({ isManager, showToast }: Props) {
  const supabase = createClient()
  const [compagnies, setCompagnies] = React.useState<Compagnie[]>([])
  const [produits, setProduits] = React.useState<Produit[]>([])
  const [taux, setTaux] = React.useState<TauxRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [editingTaux, setEditingTaux] = React.useState<{ id: string; data: TauxRow } | null>(null)
  const [addingToCompagnie, setAddingToCompagnie] = React.useState<string | null>(null)
  const [newRow, setNewRow] = React.useState<Partial<TauxRow>>({})
  const [creatingCompagnie, setCreatingCompagnie] = React.useState<Partial<Compagnie> | null>(null)
  const [creatingProduit, setCreatingProduit] = React.useState<Partial<Produit> | null>(null)
  const [editingCompagnieId, setEditingCompagnieId] = React.useState<string | null>(null)
  const [compagnieForm, setCompagnieForm] = React.useState<Partial<Compagnie>>({})
  const [saving, setSaving] = React.useState(false)

  const fetchAll = React.useCallback(async () => {
    const [co, pr, tx] = await Promise.all([
      supabase.from('compagnies').select('*').order('nom'),
      supabase.from('produits').select('*').order('nom'),
      supabase.from('taux_produit_compagnie').select('*'),
    ])
    setCompagnies((co.data as any) || [])
    setProduits((pr.data as any) || [])
    setTaux((tx.data as any) || [])
    setLoading(false)
  }, [supabase])

  React.useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Filtre : montre les compagnies dont le nom OU un de leurs produits matche la recherche
  const filteredCompagnies = React.useMemo(() => {
    if (!search.trim()) return compagnies
    const q = search.toLowerCase()
    return compagnies.filter((co) => {
      if (co.nom.toLowerCase().includes(q)) return true
      const produitsOfferts = taux.filter((t) => t.compagnie_id === co.id)
      return produitsOfferts.some((t) => {
        const p = produits.find((x) => x.id === t.produit_id)
        return p?.nom.toLowerCase().includes(q) || p?.categorie?.toLowerCase().includes(q)
      })
    })
  }, [compagnies, produits, taux, search])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  /* -------- mutations partenaire -------- */

  const saveCompagnie = async () => {
    if (!creatingCompagnie?.nom && !editingCompagnieId) return
    setSaving(true)
    if (creatingCompagnie) {
      const { error } = await (supabase.from('compagnies') as any).insert([creatingCompagnie])
      setSaving(false)
      if (error) return showToast('Création partenaire impossible', 'error')
      showToast('Partenaire créé', 'success')
      setCreatingCompagnie(null)
    } else if (editingCompagnieId) {
      const { error } = await (supabase.from('compagnies') as any)
        .update(compagnieForm)
        .eq('id', editingCompagnieId)
      setSaving(false)
      if (error) return showToast('Mise à jour impossible', 'error')
      showToast('Partenaire mis à jour', 'success')
      setEditingCompagnieId(null)
    }
    await fetchAll()
  }

  const deleteCompagnie = async (id: string, nom: string) => {
    if (!confirm(`Supprimer le partenaire "${nom}" ? (Toutes ses lignes de taux seront également supprimées.)`)) return
    const { error } = await supabase.from('compagnies').delete().eq('id', id)
    if (error) return showToast('Suppression impossible (références)', 'error')
    showToast('Partenaire supprimé', 'success')
    await fetchAll()
  }

  /* -------- mutations ligne taux -------- */

  const saveTaux = async (row: TauxRow, isNew = false) => {
    setSaving(true)
    if (isNew) {
      const { error } = await (supabase.from('taux_produit_compagnie') as any).insert([row])
      setSaving(false)
      if (error) return showToast('Ajout produit impossible', 'error')
      showToast('Produit ajouté au partenaire', 'success')
      setAddingToCompagnie(null)
      setNewRow({})
    } else {
      const { id, ...patch } = row
      const { error } = await (supabase.from('taux_produit_compagnie') as any).update(patch).eq('id', id)
      setSaving(false)
      if (error) return showToast('Mise à jour impossible', 'error')
      showToast('Détails mis à jour', 'success')
      setEditingTaux(null)
    }
    await fetchAll()
  }

  const deleteTaux = async (id: string) => {
    if (!confirm('Retirer ce produit du partenaire ?')) return
    const { error } = await supabase.from('taux_produit_compagnie').delete().eq('id', id)
    if (error) return showToast('Suppression impossible', 'error')
    showToast('Ligne supprimée', 'success')
    await fetchAll()
  }

  /* -------- création d'un produit (global) -------- */

  const saveNewProduit = async () => {
    if (!creatingProduit?.nom) return
    setSaving(true)
    const { error } = await (supabase.from('produits') as any).insert([creatingProduit])
    setSaving(false)
    if (error) return showToast('Création produit impossible', 'error')
    showToast('Produit créé', 'success')
    setCreatingProduit(null)
    await fetchAll()
  }

  if (loading) return <p className="text-gray-500 p-4">Chargement…</p>

  return (
    <div className="space-y-4">
      <div className={SECTION_INTRO_CLS}>
        <p className="mb-1">
          <strong>Catalogue Partenaires × Produits.</strong> Chaque partenaire (compagnie) expose une
          sélection de produits. Pour chaque couple, vous définissez : nom du produit, catégorie,
          frais d'entrée, frais d'encours et prix de la part.
        </p>
        <p className="text-xs text-indigo-700">
          Les valeurs sont stockées en base (<code>taux_produit_compagnie</code>) — aucun chiffre
          n'est codé en dur. Elles pilotent les calculs de facturation, rémunération et analyse.
        </p>
      </div>

      {/* Warning migration */}
      <MigrationCheck taux={taux} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Partenaire, produit, catégorie…"
            className="pl-9"
          />
        </div>
        <span className="text-sm text-gray-500">
          {filteredCompagnies.length} / {compagnies.length} partenaire(s)
        </span>
        <div className="ml-auto flex gap-2">
          {isManager && (
            <>
              <Button size="sm" variant="outline" onClick={() => setCreatingProduit({})} disabled={creatingProduit !== null}>
                <Plus size={14} className="mr-1" /> Nouveau produit
              </Button>
              <Button size="sm" onClick={() => setCreatingCompagnie({})} disabled={creatingCompagnie !== null}>
                <Plus size={14} className="mr-1" /> Nouveau partenaire
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Form création partenaire */}
      {isManager && creatingCompagnie && (
        <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-blue-900">Nouveau partenaire</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Labeled label="Nom partenaire">
              <Input value={creatingCompagnie.nom || ''} onChange={(e) => setCreatingCompagnie({ ...creatingCompagnie, nom: e.target.value })} />
            </Labeled>
            <Labeled label="Taux défaut (%)">
              <Input type="number" step="0.01" value={rateToInput(creatingCompagnie.taux_defaut)} onChange={(e) => setCreatingCompagnie({ ...creatingCompagnie, taux_defaut: parseRateInput(e.target.value) })} />
            </Labeled>
            <Labeled label="Taux encours (%)">
              <Input type="number" step="0.01" value={rateToInput(creatingCompagnie.taux_encours)} onChange={(e) => setCreatingCompagnie({ ...creatingCompagnie, taux_encours: parseRateInput(e.target.value) })} />
            </Labeled>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreatingCompagnie(null)} disabled={saving}>Annuler</Button>
            <Button size="sm" onClick={saveCompagnie} disabled={saving || !creatingCompagnie.nom}>Créer</Button>
          </div>
        </div>
      )}

      {/* Form création produit */}
      {isManager && creatingProduit && (
        <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-emerald-900">Nouveau produit</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Labeled label="Nom produit">
              <Input value={creatingProduit.nom || ''} onChange={(e) => setCreatingProduit({ ...creatingProduit, nom: e.target.value })} />
            </Labeled>
            <Labeled label="Catégorie">
              <Input value={creatingProduit.categorie || ''} onChange={(e) => setCreatingProduit({ ...creatingProduit, categorie: e.target.value })} placeholder="Assurance-vie, PER, SCPI…" />
            </Labeled>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreatingProduit(null)} disabled={saving}>Annuler</Button>
            <Button size="sm" onClick={saveNewProduit} disabled={saving || !creatingProduit.nom}>Créer</Button>
          </div>
        </div>
      )}

      {/* Liste partenaires */}
      <div className="space-y-3">
        {filteredCompagnies.length === 0 && (
          <div className="border rounded-lg p-6 text-center text-gray-500 text-sm">
            Aucun partenaire {search && 'correspondant à votre recherche'}.
          </div>
        )}
        {filteredCompagnies.map((co) => {
          const isOpen = expanded.has(co.id)
          const rowsOfCompagnie = taux.filter((t) => t.compagnie_id === co.id)
          const isEditingCo = editingCompagnieId === co.id
          return (
            <div key={co.id} className="border rounded-lg overflow-hidden bg-white">
              {/* En-tête partenaire */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b">
                <button className="flex items-center gap-2 flex-1 text-left" onClick={() => toggle(co.id)}>
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {isEditingCo ? (
                    <Input
                      value={compagnieForm.nom || ''}
                      onChange={(e) => setCompagnieForm({ ...compagnieForm, nom: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className="max-w-xs"
                    />
                  ) : (
                    <span className="font-semibold text-gray-900">{co.nom}</span>
                  )}
                  <span className="text-xs text-gray-500">
                    {rowsOfCompagnie.length} produit{rowsOfCompagnie.length > 1 ? 's' : ''}
                  </span>
                </button>

                {/* Taux défaut / encours */}
                {isEditingCo ? (
                  <>
                    <Labeled label="Défaut (%)" inline>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.01"
                        value={rateToInput(compagnieForm.taux_defaut)}
                        onChange={(e) => setCompagnieForm({ ...compagnieForm, taux_defaut: parseRateInput(e.target.value) })}
                      />
                    </Labeled>
                    <Labeled label="Encours (%)" inline>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.01"
                        value={rateToInput(compagnieForm.taux_encours)}
                        onChange={(e) => setCompagnieForm({ ...compagnieForm, taux_encours: parseRateInput(e.target.value) })}
                      />
                    </Labeled>
                  </>
                ) : (
                  <div className="flex gap-3 text-xs text-gray-600">
                    <span>Défaut&nbsp;: <strong>{formatPercent2(co.taux_defaut)}</strong></span>
                    <span>Encours&nbsp;: <strong>{formatPercent2(co.taux_encours)}</strong></span>
                  </div>
                )}

                {isManager && (
                  <div className="flex gap-1">
                    {isEditingCo ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={saveCompagnie} disabled={saving}><Check size={14} className="text-green-600" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCompagnieId(null)}><X size={14} className="text-red-500" /></Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingCompagnieId(co.id); setCompagnieForm(co) }}><Edit2 size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteCompagnie(co.id, co.nom)}><Trash2 size={14} className="text-red-500" /></Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Produits du partenaire */}
              {isOpen && (
                <div className="p-4 space-y-2">
                  {rowsOfCompagnie.length === 0 && addingToCompagnie !== co.id && (
                    <p className="text-sm text-gray-400 italic">
                      Aucun produit n'est encore rattaché à ce partenaire.
                    </p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs font-semibold text-gray-500 uppercase">
                        <tr className="border-b">
                          <th className="px-2 py-2 text-left">Nom du produit</th>
                          <th className="px-2 py-2 text-left">Catégorie</th>
                          <th className="px-2 py-2 text-right">Frais entrée</th>
                          <th className="px-2 py-2 text-right">Frais encours</th>
                          <th className="px-2 py-2 text-right">Prix part</th>
                          <th className="px-2 py-2 text-center">Actif</th>
                          {isManager && <th className="px-2 py-2 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rowsOfCompagnie.map((row) => {
                          const produit = produits.find((p) => p.id === row.produit_id)
                          const isEditing = editingTaux?.id === row.id
                          const displayName =
                            (row.description && row.description.trim()) ||
                            produit?.nom ||
                            '—'
                          if (isEditing) {
                            return (
                              <tr key={row.id} className="bg-blue-50/40">
                                <td colSpan={isManager ? 7 : 6} className="p-2">
                                  <TauxForm
                                    produits={produits}
                                    value={editingTaux!.data}
                                    onChange={(d) => setEditingTaux({ id: editingTaux!.id, data: d })}
                                    onSave={() => saveTaux(editingTaux!.data)}
                                    onCancel={() => setEditingTaux(null)}
                                    saving={saving}
                                    lockProduit
                                  />
                                </td>
                              </tr>
                            )
                          }
                          return (
                            <React.Fragment key={row.id}>
                              <tr className="hover:bg-gray-50/40">
                                <td className="px-2 py-2 font-medium text-gray-900">{displayName}</td>
                                <td className="px-2 py-2 text-gray-600">{produit?.categorie || produit?.nom || '—'}</td>
                                <td className="px-2 py-2 text-right">{formatPercent2(row.frais_entree)}</td>
                                <td className="px-2 py-2 text-right">{formatPercent2(row.frais_encours)}</td>
                                <td className="px-2 py-2 text-right">{row.prix_part != null ? formatCurrency(row.prix_part) : '—'}</td>
                                <td className="px-2 py-2 text-center">
                                  <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${row.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {row.actif ? 'Oui' : 'Non'}
                                  </span>
                                </td>
                                {isManager && (
                                  <td className="px-2 py-2 text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button size="sm" variant="ghost" onClick={() => setEditingTaux({ id: row.id, data: row })}><Edit2 size={14} /></Button>
                                      <Button size="sm" variant="ghost" onClick={() => deleteTaux(row.id)}><Trash2 size={14} className="text-red-500" /></Button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                              {row.produit_id && row.compagnie_id && (
                                <tr className="bg-gray-50/30">
                                  <td colSpan={isManager ? 7 : 6} className="px-6 py-2 border-b border-gray-100">
                                    <div className="flex items-start gap-3">
                                      <span className="text-xs font-medium text-gray-500 shrink-0 mt-0.5">Sous-produits :</span>
                                      <SousProduitsEditor
                                        produitId={row.produit_id}
                                        compagnieId={row.compagnie_id}
                                        produitNom={produit?.nom}
                                        isManager={isManager}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}

                        {/* Form nouvelle ligne */}
                        {addingToCompagnie === co.id && (
                          <tr className="bg-emerald-50/40">
                            <td colSpan={isManager ? 7 : 6} className="p-2">
                              <TauxForm
                                produits={produits}
                                value={{ ...(newRow as TauxRow), compagnie_id: co.id }}
                                onChange={(d) => setNewRow(d)}
                                onSave={() => saveTaux({ ...(newRow as TauxRow), compagnie_id: co.id, actif: newRow.actif ?? true, taux: (newRow as any).taux ?? 0 } as TauxRow, true)}
                                onCancel={() => { setAddingToCompagnie(null); setNewRow({}) }}
                                saving={saving}
                                isNew
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {isManager && addingToCompagnie !== co.id && (
                    <div className="pt-2">
                      <Button size="sm" variant="outline" onClick={() => { setAddingToCompagnie(co.id); setNewRow({ compagnie_id: co.id, actif: true }) }}>
                        <Plus size={14} className="mr-1" /> Ajouter un produit à {co.nom}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* -------- Form ligne taux -------- */

function TauxForm({
  produits,
  value,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
  lockProduit,
}: {
  produits: Produit[]
  value: Partial<TauxRow>
  onChange: (v: TauxRow) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew?: boolean
  lockProduit?: boolean
}) {
  const update = (patch: Partial<TauxRow>) => onChange({ ...(value as TauxRow), ...patch })
  return (
    <div className="space-y-3">
      {/* Ligne 1 : identité du produit — nom produit + catégorie.
          Retour Maxine 2026-04-22 : le nom du produit doit être visible
          (la "description" fait office de nom : ex. ACTIVIMMO, COMETE).
          Commission et Taux ref. sont retirés (redondants avec Frais entrée
          et Frais encours). */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Labeled label="Nom du produit">
          <Input
            value={value.description || ''}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Ex : ACTIVIMMO, COMETE, Multi Lux Opportunités…"
          />
        </Labeled>
        <Labeled label="Catégorie">
          <select
            className="w-full border rounded-md px-2 py-1.5 text-sm bg-white disabled:bg-gray-100"
            value={value.produit_id || ''}
            disabled={lockProduit}
            onChange={(e) => update({ produit_id: e.target.value })}
          >
            <option value="">— Choisir —</option>
            {produits.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </Labeled>
      </div>

      {/* Ligne 2 : conditions tarifaires — alignées avec les colonnes du tableau */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Labeled label="Frais entrée (%)">
          <Input type="number" step="0.01" value={rateToInput(value.frais_entree)} onChange={(e) => update({ frais_entree: parseRateInput(e.target.value) })} />
        </Labeled>
        <Labeled label="Frais encours (%)">
          <Input type="number" step="0.01" value={rateToInput(value.frais_encours)} onChange={(e) => update({ frais_encours: parseRateInput(e.target.value) })} />
        </Labeled>
        <Labeled label="Prix part (€)">
          <Input type="number" step="0.01" value={value.prix_part ?? ''} onChange={(e) => update({ prix_part: e.target.value === '' ? null : parseFloat(e.target.value) })} />
        </Labeled>
        <Labeled label="Actif">
          <label className="flex items-center gap-2 py-1.5">
            <input type="checkbox" checked={value.actif ?? true} onChange={(e) => update({ actif: e.target.checked })} />
            <span className="text-sm text-gray-600">{value.actif ?? true ? 'Oui' : 'Non'}</span>
          </label>
        </Labeled>
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          <X size={14} className="mr-1" /> Annuler
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || !value.produit_id}>
          <Check size={14} className="mr-1" /> {isNew ? 'Ajouter' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}

function Labeled({ label, inline, children }: { label: string; inline?: boolean; children: React.ReactNode }) {
  if (inline) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase text-gray-400 tracking-wider">{label}</span>
        {children}
      </div>
    )
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

/** Détecte si la migration a été jouée en regardant si au moins une ligne a un des champs enrichis. */
function MigrationCheck({ taux }: { taux: TauxRow[] }) {
  // Si aucune ligne n'a ces colonnes définies, on ne peut pas distinguer "migration non faite"
  // de "migration faite mais valeurs nulles". On reste conservateur : on affiche juste une
  // note discrète. Si on détecte une erreur de schéma, ça remonterait côté fetch avec une
  // ligne de taux vide — géré plus haut.
  const anyEnriched = taux.some(
    (t) =>
      t.frais_entree != null ||
      t.frais_encours != null ||
      t.prix_part != null ||
      t.commission_retrocedee != null
  )
  if (anyEnriched || taux.length === 0) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">Migration DB à exécuter</p>
        <p className="text-xs mt-0.5">
          Les colonnes <code>frais_entree</code>, <code>frais_encours</code>, <code>prix_part</code>,{' '}
          <code>commission_retrocedee</code> sont attendues sur <code>taux_produit_compagnie</code>.
          Exécute le script <code>scripts/migrations/2026-04-22_catalogue_details.sql</code> dans
          l'éditeur SQL Supabase, puis régénère les types TS.
        </p>
      </div>
    </div>
  )
}
