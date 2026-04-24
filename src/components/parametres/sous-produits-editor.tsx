'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, X, Loader2 } from 'lucide-react'

interface SousProduit {
  id: string
  produit_id: string
  compagnie_id: string
  nom: string
  actif: boolean
}

interface SousProduitsEditorProps {
  produitId: string
  compagnieId: string
  produitNom?: string
  isManager: boolean
  onChange?: () => void
}

/**
 * Editeur compact de sous-produits pour un couple (produit, compagnie).
 * Affiche les sous-produits existants sous forme de chips, permet d'ajouter/supprimer.
 *
 * Note : les types Supabase générés ne connaissent pas encore `sous_produits`
 * (table ajoutée en prod le 2026-04-24 via migration add-sous-produits.sql).
 * On cast le client en `any` pour contourner — à retirer à la prochaine
 * régénération de `src/types/database.ts`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export function SousProduitsEditor({
  produitId,
  compagnieId,
  produitNom,
  isManager,
  onChange,
}: SousProduitsEditorProps) {
  const supabase = React.useMemo(() => createClient() as AnyClient, [])
  const [items, setItems] = React.useState<SousProduit[] | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [newNom, setNewNom] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchItems = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('sous_produits')
      .select('*')
      .eq('produit_id', produitId)
      .eq('compagnie_id', compagnieId)
      .eq('actif', true)
      .order('nom')
    if (error) {
      setError(error.message)
      setItems([])
      return
    }
    setItems((data as SousProduit[]) || [])
  }, [produitId, compagnieId, supabase])

  React.useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const addItem = async () => {
    const nom = newNom.trim()
    if (!nom) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('sous_produits').insert([
      { produit_id: produitId, compagnie_id: compagnieId, nom },
    ])
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewNom('')
    setAdding(false)
    await fetchItems()
    onChange?.()
  }

  const removeItem = async (id: string) => {
    if (!confirm('Supprimer ce sous-produit ? Les dossiers existants qui le référencent ne seront pas impactés (FK RESTRICT).')) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('sous_produits').delete().eq('id', id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    await fetchItems()
    onChange?.()
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items === null ? (
        <Loader2 size={14} className="animate-spin text-gray-400" />
      ) : (
        <>
          {items.length === 0 && !adding && (
            <span className="text-xs text-gray-400 italic">Aucun sous-produit</span>
          )}
          {items.map((sp) => (
            <span
              key={sp.id}
              className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2 py-0.5 rounded-full"
            >
              {sp.nom}
              {isManager && (
                <button
                  type="button"
                  className="hover:text-red-600 disabled:opacity-40"
                  disabled={busy}
                  onClick={() => removeItem(sp.id)}
                  aria-label={`Supprimer ${sp.nom}`}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
          {isManager && adding && (
            <span className="inline-flex items-center gap-1">
              <input
                autoFocus
                type="text"
                value={newNom}
                onChange={(e) => setNewNom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addItem() }
                  if (e.key === 'Escape') { setAdding(false); setNewNom('') }
                }}
                placeholder={produitNom ? `Nom du sous-produit ${produitNom}` : 'Nom du sous-produit'}
                className="border border-gray-300 rounded text-xs px-2 py-0.5 w-48 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Button size="sm" variant="ghost" onClick={addItem} disabled={busy || !newNom.trim()}>
                {busy ? <Loader2 size={12} className="animate-spin" /> : 'Ajouter'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewNom('') }}>
                Annuler
              </Button>
            </span>
          )}
          {isManager && !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-0.5 text-xs text-gray-500 hover:text-indigo-600"
            >
              <Plus size={12} />
              Sous-produit
            </button>
          )}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </>
      )}
    </div>
  )
}
