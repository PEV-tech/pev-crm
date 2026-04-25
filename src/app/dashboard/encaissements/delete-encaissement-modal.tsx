'use client'

/**
 * src/app/dashboard/encaissements/delete-encaissement-modal.tsx
 *
 * Modale de confirmation de suppression d'un encaissement depuis le
 * drill-down de /dashboard/encaissements.
 *
 * Trois cas selon la source de la ligne :
 *
 * 1. `auto` (table encaissements, alimentée par fn_create_encaissement)
 *    → DELETE /api/encaissements/[id] avec body { unmark_facture: true|false }
 *    → Checkbox "Repasser la facture en non payée" cochée par défaut
 *      (sinon le trigger pourrait re-générer la ligne au prochain événement).
 *
 * 2. `encours_v2` (lignes du module Encours V2 avec lot validé)
 *    → DELETE /api/encours/lines/[id]?force=true
 *    → Avertissement : le lot sera dé-validé (allocations supprimées,
 *      statut repassé en brouillon).
 *
 * 3. `facture` (fallback : ligne issue de v_dossiers_complets payée=oui)
 *    → Suppression non disponible côté UI : c'est une situation rare
 *      (trigger qui n'a pas tourné). On affiche un message explicatif et
 *      l'utilisateur doit gérer côté Facturation manuellement.
 */

import * as React from 'react'
import { X, Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type EncaissementSourceType = 'auto' | 'encours_v2' | 'facture'

export interface DeletableEncaissement {
  source_id: string
  source_type: EncaissementSourceType
  label: string
  mois: string
  montant: number
}

export interface DeleteEncaissementModalProps {
  isOpen: boolean
  onClose: () => void
  onDeleted: () => void
  line: DeletableEncaissement | null
}

const fmtEUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

export function DeleteEncaissementModal({ isOpen, onClose, onDeleted, line }: DeleteEncaissementModalProps) {
  const [unmarkFacture, setUnmarkFacture] = React.useState<boolean>(true)
  const [submitting, setSubmitting] = React.useState<boolean>(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isOpen) return
    setUnmarkFacture(true)
    setSubmitting(false)
    setErrorMsg(null)
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, submitting])

  const handleDelete = async () => {
    if (!line || submitting) return
    setSubmitting(true)
    setErrorMsg(null)

    try {
      let res: Response

      if (line.source_type === 'auto') {
        res = await fetch(`/api/encaissements/${line.source_id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unmark_facture: unmarkFacture }),
        })
      } else if (line.source_type === 'encours_v2') {
        res = await fetch(`/api/encours/lines/${line.source_id}?force=true`, { method: 'DELETE' })
      } else {
        // 'facture' : pas d'API disponible
        setErrorMsg(
          "Cette ligne vient d'une facture marquée payée mais sans encaissement automatique généré. " +
            "Va dépayer la facture manuellement depuis la page Facturation.",
        )
        setSubmitting(false)
        return
      }

      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setErrorMsg(json?.error ?? `Erreur ${res.status}`)
        return
      }
      onDeleted()
      onClose()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !line) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />

      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-red-50">
          <div className="flex items-center gap-2">
            <Trash2 size={18} className="text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Supprimer l&apos;encaissement</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded hover:bg-red-100 disabled:opacity-30"
            aria-label="Fermer"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Ligne à supprimer */}
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">À supprimer</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{line.label}</p>
            <div className="flex items-center justify-between mt-1 text-xs text-gray-600">
              <span>{line.mois}</span>
              <span className="tabular-nums font-medium">{fmtEUR.format(line.montant)}</span>
            </div>
          </div>

          {/* Cas auto : checkbox unmark facture */}
          {line.source_type === 'auto' && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={unmarkFacture}
                onChange={(e) => setUnmarkFacture(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">
                <strong>Repasser aussi la facture en « non payée »</strong>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Recommandé si la facture n&apos;aurait pas dû être marquée payée.
                  Sinon le trigger pourrait re-générer cette ligne d&apos;encaissement.
                </span>
              </span>
            </label>
          )}

          {/* Cas encours_v2 : avertissement dé-validation */}
          {line.source_type === 'encours_v2' && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-900">Le lot sera dévalidé</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Toutes les allocations figées du lot seront supprimées et le lot
                  repassera en brouillon. Tu pourras le re-valider après correction.
                </p>
              </div>
            </div>
          )}

          {/* Cas facture : message + bouton désactivé */}
          {line.source_type === 'facture' && (
            <div className="bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-xs text-gray-700">
              Cette ligne vient d&apos;une facture marquée payée mais sans encaissement
              automatique généré. La suppression doit se faire manuellement depuis la
              page Facturation (dépayer la facture).
            </div>
          )}

          {/* Erreur */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-3 py-2">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => void handleDelete()}
            disabled={submitting || line.source_type === 'facture'}
            className="bg-red-600 hover:bg-red-700 text-white border-red-600 gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Suppression…
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Supprimer
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
