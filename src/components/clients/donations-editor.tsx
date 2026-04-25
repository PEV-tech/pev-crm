'use client'

/**
 * DonationsEditor — sous-fiches "donations reçues" pour la section
 * "Histoire familiale & succession" du KYC.
 *
 * Stockage : tableau JSONB `clients.donations_recues`. Plusieurs donations
 * possibles par client (héritage en plusieurs vagues, donation parentale +
 * donation grand-parent, etc.).
 *
 * Schéma `DonationRecue` (cf. types/database.ts) :
 *   { donateur, montant, date_donation, nature, commentaire }
 *
 * Variantes visuelles via `variant` (même mécanique que EnfantsEditor) :
 *   - `crm`    : indigo (cohérent avec la fiche client interne)
 *   - `public` : violet PEV #1F063E (charte portail KYC)
 */

import * as React from 'react'
import type { DonationRecue } from '@/types/database'

type Variant = 'crm' | 'public'

const NATURE_OPTIONS: Array<{ v: string; label: string }> = [
  { v: '', label: '— Sélectionner —' },
  { v: 'Somme d\'argent', label: 'Somme d\'argent' },
  { v: 'Bien immobilier', label: 'Bien immobilier' },
  { v: 'Titres / valeurs mobilières', label: 'Titres / valeurs mobilières' },
  { v: 'Démembrement (nue-propriété)', label: 'Démembrement (nue-propriété)' },
  { v: 'Autre', label: 'Autre' },
]

interface DonationsEditorProps {
  value: DonationRecue[]
  onChange: (next: DonationRecue[]) => void
  variant?: Variant
  readOnly?: boolean
}

export function DonationsEditor({
  value,
  onChange,
  variant = 'crm',
  readOnly = false,
}: DonationsEditorProps) {
  const donations = Array.isArray(value) ? value : []

  const patch = (i: number, p: Partial<DonationRecue>) => {
    const next = donations.slice()
    next[i] = { ...next[i], ...p }
    onChange(next)
  }
  const add = () =>
    onChange([
      ...donations,
      {
        donateur: null,
        montant: null,
        date_donation: null,
        nature: null,
        commentaire: null,
      },
    ])
  const remove = (i: number) => {
    const next = donations.slice()
    next.splice(i, 1)
    onChange(next)
  }

  const isPublic = variant === 'public'

  const shellCls = isPublic
    ? 'bg-white border border-slate-200 rounded-xl shadow-sm p-6'
    : 'bg-white border border-gray-200 rounded-md p-4'
  const titleCls = isPublic
    ? 'text-[11px] tracking-[0.18em] uppercase text-[#1F063E] font-semibold'
    : 'text-xs font-semibold uppercase tracking-wide text-gray-700'
  const addBtnCls = isPublic
    ? 'shrink-0 inline-flex items-center gap-1 rounded-md border border-[#1F063E]/30 bg-white px-3 py-1 text-xs font-medium text-[#1F063E] hover:bg-[#1F063E]/5 transition-colors'
    : 'shrink-0 inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-white px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors'
  const inputCls = isPublic
    ? 'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-[#1F063E] focus:ring-1 focus:ring-[#1F063E]/20 focus:outline-none transition-colors'
    : 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400'

  return (
    <section className={shellCls}>
      <div className="flex items-start justify-between gap-3 mb-3 pb-2 border-b border-slate-100">
        <div>
          <h3 className={titleCls}>Donations reçues</h3>
          <p className="text-xs text-slate-500 mt-1 normal-case tracking-normal">
            Avez-vous bénéficié d&apos;une donation (parents, grands-parents, conjoint…) ?
            Indiquez chaque donation séparément.
          </p>
        </div>
        {!readOnly && (
          <button type="button" onClick={add} className={addBtnCls}>
            + Ajouter une donation
          </button>
        )}
      </div>

      {donations.length === 0 && (
        <p className="text-xs text-gray-400 italic">Aucune donation déclarée.</p>
      )}

      <div className="space-y-2">
        {donations.map((don, i) => (
          <div
            key={i}
            className="border border-gray-200 rounded-md p-3 relative"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wide text-gray-400">
                Donation {i + 1}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Supprimer
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
              <Field label="Donateur (qui)">
                <input
                  type="text"
                  value={don.donateur ?? ''}
                  placeholder="Ex. Père, Grand-mère paternelle…"
                  onChange={(e) =>
                    patch(i, { donateur: e.target.value || null })
                  }
                  disabled={readOnly}
                  className={inputCls}
                />
              </Field>
              <Field label="Montant (€)">
                <input
                  type="number"
                  value={don.montant ?? ''}
                  onChange={(e) =>
                    patch(i, {
                      montant:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  disabled={readOnly}
                  className={inputCls}
                />
              </Field>
              <Field label="Date de donation">
                <input
                  type="date"
                  value={don.date_donation ?? ''}
                  onChange={(e) =>
                    patch(i, { date_donation: e.target.value || null })
                  }
                  disabled={readOnly}
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  className={inputCls}
                />
              </Field>
              <Field label="Nature">
                <select
                  value={don.nature ?? ''}
                  onChange={(e) =>
                    patch(i, { nature: e.target.value || null })
                  }
                  disabled={readOnly}
                  className={inputCls}
                >
                  {NATURE_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Commentaire" span2>
                <textarea
                  rows={2}
                  value={don.commentaire ?? ''}
                  placeholder="Détails complémentaires (acte notarié, conditions…)"
                  onChange={(e) =>
                    patch(i, { commentaire: e.target.value || null })
                  }
                  disabled={readOnly}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Field({
  label,
  span2 = false,
  children,
}: {
  label: string
  span2?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
        {label}
      </label>
      {children}
    </div>
  )
}

/** Normalise une valeur lue de la DB en DonationRecue[] sûr. */
export function normalizeDonations(value: unknown): DonationRecue[] {
  if (Array.isArray(value)) return value as DonationRecue[]
  return []
}

/** Affichage récap (PDF, vues read-only). */
export function formatDonationsSummary(value: unknown): string {
  const arr = normalizeDonations(value)
  if (arr.length === 0) return '—'
  return arr
    .map((d, i) => {
      const parts: string[] = []
      parts.push(`Donation ${i + 1}`)
      if (d.donateur) parts.push(d.donateur)
      if (typeof d.montant === 'number')
        parts.push(
          new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
          }).format(d.montant)
        )
      if (d.nature) parts.push(d.nature)
      if (d.date_donation) {
        try {
          parts.push(new Date(d.date_donation).toLocaleDateString('fr-FR'))
        } catch {
          parts.push(d.date_donation)
        }
      }
      return parts.join(' · ')
    })
    .join(' | ')
}
