'use client'

/**
 * SuccessionScalarsEditor — bloc unique pour les questions scalaires de la
 * section "Histoire familiale & succession" du KYC :
 *   - Union précédente (bool + détails)
 *   - Loi applicable (pays + détails)
 *   - Testament (bool + détails)
 *   - Donation entre époux (bool + détails)
 *
 * Note : le tableau "donations reçues" est géré par DonationsEditor
 * séparément, on ne l'inclut pas ici pour pouvoir le placer librement dans
 * le layout parent.
 *
 * 2 variantes visuelles : 'crm' (indigo) / 'public' (violet PEV).
 */

import * as React from 'react'
import { COUNTRY_NAMES } from '@/lib/countries'

type Variant = 'crm' | 'public'

export interface SuccessionScalars {
  union_precedente?: boolean | null
  union_precedente_details?: string | null
  loi_applicable_pays?: string | null
  loi_applicable_details?: string | null
  a_testament?: boolean | null
  testament_details?: string | null
  a_donation_entre_epoux?: boolean | null
  donation_entre_epoux_details?: string | null
}

interface Props {
  value: SuccessionScalars
  onChange: (next: SuccessionScalars) => void
  variant?: Variant
  readOnly?: boolean
}

export function SuccessionScalarsEditor({
  value,
  onChange,
  variant = 'crm',
  readOnly = false,
}: Props) {
  const isPublic = variant === 'public'

  const shellCls = isPublic
    ? 'bg-white border border-slate-200 rounded-xl shadow-sm p-6'
    : 'bg-white border border-gray-200 rounded-md p-4'
  const titleCls = isPublic
    ? 'text-[11px] tracking-[0.18em] uppercase text-[#1F063E] font-semibold mb-3 pb-2 border-b border-slate-100'
    : 'text-xs font-semibold uppercase tracking-wide text-gray-700 mb-3 pb-2 border-b border-gray-100'
  const inputCls = isPublic
    ? 'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-[#1F063E] focus:ring-1 focus:ring-[#1F063E]/20 focus:outline-none transition-colors'
    : 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400'

  const set = <K extends keyof SuccessionScalars>(
    key: K,
    v: SuccessionScalars[K]
  ) => onChange({ ...value, [key]: v })

  return (
    <section className={shellCls}>
      <h3 className={titleCls}>Histoire familiale &amp; succession</h3>

      <div className="space-y-5">
        {/* Union précédente */}
        <BoolWithDetails
          legend="Avez-vous déjà eu une union précédente (mariage, PACS) ?"
          checked={value.union_precedente}
          onChange={(b) => set('union_precedente', b)}
          detailsLabel="Précisez (date, nature, lieu, mode de séparation)"
          details={value.union_precedente_details ?? ''}
          onDetailsChange={(t) => set('union_precedente_details', t || null)}
          inputCls={inputCls}
          readOnly={readOnly}
        />

        {/* Loi applicable */}
        <div>
          <p className="block text-[12px] font-medium text-gray-700 mb-1">
            Désignation de la loi applicable au régime matrimonial
          </p>
          <p className="text-xs text-gray-500 mb-2">
            Pertinent surtout pour les mariages internationaux : si vous avez
            désigné une loi étrangère par contrat ou changement de régime,
            précisez le pays et les modalités.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                Pays
              </label>
              <select
                value={value.loi_applicable_pays ?? ''}
                onChange={(e) =>
                  set('loi_applicable_pays', e.target.value || null)
                }
                disabled={readOnly}
                className={inputCls}
              >
                <option value="">— Aucun / Sans objet —</option>
                {COUNTRY_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                Détails (date de désignation, contrat, notaire…)
              </label>
              <textarea
                rows={2}
                value={value.loi_applicable_details ?? ''}
                onChange={(e) =>
                  set('loi_applicable_details', e.target.value || null)
                }
                disabled={readOnly}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Testament */}
        <BoolWithDetails
          legend="Avez-vous rédigé un testament ?"
          checked={value.a_testament}
          onChange={(b) => set('a_testament', b)}
          detailsLabel="Précisez (date, type, lieu de dépôt, notaire)"
          details={value.testament_details ?? ''}
          onDetailsChange={(t) => set('testament_details', t || null)}
          inputCls={inputCls}
          readOnly={readOnly}
        />

        {/* Donation entre époux */}
        <BoolWithDetails
          legend="Avez-vous une donation entre époux (donation au dernier vivant) ?"
          checked={value.a_donation_entre_epoux}
          onChange={(b) => set('a_donation_entre_epoux', b)}
          detailsLabel="Précisez (date, étendue, conditions)"
          details={value.donation_entre_epoux_details ?? ''}
          onDetailsChange={(t) =>
            set('donation_entre_epoux_details', t || null)
          }
          inputCls={inputCls}
          readOnly={readOnly}
        />
      </div>
    </section>
  )
}

function BoolWithDetails({
  legend,
  checked,
  onChange,
  detailsLabel,
  details,
  onDetailsChange,
  inputCls,
  readOnly,
}: {
  legend: string
  checked: boolean | null | undefined
  onChange: (v: boolean) => void
  detailsLabel: string
  details: string
  onDetailsChange: (v: string) => void
  inputCls: string
  readOnly: boolean
}) {
  // Le textarea n'apparaît qu'une fois "Oui" choisi — réduit le bruit visuel
  // pour les cas négatifs (la grande majorité).
  return (
    <div>
      <p className="block text-[12px] font-medium text-gray-700 mb-1">
        {legend}
      </p>
      <div className="flex items-center gap-4 text-sm pt-1">
        {([
          { v: true, label: 'Oui' },
          { v: false, label: 'Non' },
        ] as const).map((o) => (
          <label
            key={String(o.v)}
            className="inline-flex items-center gap-1.5 cursor-pointer"
          >
            <input
              type="radio"
              checked={checked === o.v}
              onChange={() => onChange(o.v)}
              disabled={readOnly}
              className="accent-indigo-600"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {checked === true && (
        <div className="mt-2">
          <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
            {detailsLabel}
          </label>
          <textarea
            rows={2}
            value={details}
            onChange={(e) => onDetailsChange(e.target.value)}
            disabled={readOnly}
            className={inputCls}
          />
        </div>
      )}
    </div>
  )
}
