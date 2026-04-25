'use client'

/**
 * EnfantsEditor — sous-fiches enfants dynamiques (nom, prenom, sexe,
 * date_naissance, a_charge).
 *
 * Stockage côté DB : tableau JSONB `clients.enfants_details` (anciennement
 * TEXT libre, migré le 2026-04-25). Une entrée legacy peut contenir
 * uniquement `legacy_notes` — on l'affiche tel quel pour permettre la
 * rééditation manuelle.
 *
 * `nombre_enfants` (colonne INT séparée) est synchronisé côté parent : à
 * chaque add/remove le parent remet à jour la longueur du tableau. On ne
 * supprime pas la colonne car elle reste utile pour les filtres / vues
 * agrégées qui n'auraient pas envie de jsonb_array_length() à chaque fois.
 *
 * Deux variantes visuelles via la prop `variant` :
 *  - `crm`    : indigo (cohérent avec la fiche client interne)
 *  - `public` : violet PEV #1F063E (charte portail KYC)
 */

import * as React from 'react'
import type { EnfantDetail } from '@/types/database'

type Variant = 'crm' | 'public'

const SEXE_OPTIONS: Array<{ v: NonNullable<EnfantDetail['sexe']>; label: string }> = [
  { v: 'homme', label: 'Homme' },
  { v: 'femme', label: 'Femme' },
  { v: 'autre', label: 'Autre' },
]

interface EnfantsEditorProps {
  value: EnfantDetail[]
  onChange: (next: EnfantDetail[]) => void
  variant?: Variant
  readOnly?: boolean
}

export function EnfantsEditor({
  value,
  onChange,
  variant = 'crm',
  readOnly = false,
}: EnfantsEditorProps) {
  const enfants = Array.isArray(value) ? value : []

  const patch = (i: number, p: Partial<EnfantDetail>) => {
    const next = enfants.slice()
    next[i] = { ...next[i], ...p }
    onChange(next)
  }
  const add = () =>
    onChange([
      ...enfants,
      { nom: null, prenom: null, sexe: null, date_naissance: null, a_charge: null },
    ])
  const remove = (i: number) => {
    const next = enfants.slice()
    next.splice(i, 1)
    onChange(next)
  }

  const isPublic = variant === 'public'

  // Classes — on garde inline pour ne pas multiplier les fichiers, et
  // pour faciliter la lecture diff lors d'un changement de palette.
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
          <h3 className={titleCls}>Enfants</h3>
          <p className="text-xs text-slate-500 mt-1 normal-case tracking-normal">
            Une sous-fiche par enfant. Le compteur « nombre d&apos;enfants »
            est mis à jour automatiquement.
          </p>
        </div>
        {!readOnly && (
          <button type="button" onClick={add} className={addBtnCls}>
            + Ajouter un enfant
          </button>
        )}
      </div>

      {enfants.length === 0 && (
        <p className="text-xs text-gray-400 italic">Aucun enfant déclaré.</p>
      )}

      <div className="space-y-2">
        {enfants.map((enf, i) => {
          const isLegacy = !!enf.legacy_notes && !enf.nom && !enf.prenom && !enf.date_naissance
          return (
            <div
              key={i}
              className="border border-gray-200 rounded-md p-3 relative"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">
                  Enfant {i + 1}
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

              {isLegacy && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                  Saisie historique non structurée :
                  <em className="ml-1">{enf.legacy_notes}</em>
                  {!readOnly && (
                    <span className="block mt-1 text-amber-700">
                      Renseignez les champs ci-dessous puis le bandeau
                      disparaîtra automatiquement.
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                <Field label="Nom">
                  <input
                    type="text"
                    value={enf.nom ?? ''}
                    onChange={(e) =>
                      patch(i, { nom: e.target.value || null })
                    }
                    disabled={readOnly}
                    className={inputCls}
                  />
                </Field>
                <Field label="Prénom">
                  <input
                    type="text"
                    value={enf.prenom ?? ''}
                    onChange={(e) =>
                      patch(i, { prenom: e.target.value || null })
                    }
                    disabled={readOnly}
                    className={inputCls}
                  />
                </Field>
                <Field label="Sexe">
                  <select
                    value={enf.sexe ?? ''}
                    onChange={(e) =>
                      patch(i, {
                        sexe:
                          (e.target.value as EnfantDetail['sexe']) || null,
                      })
                    }
                    disabled={readOnly}
                    className={inputCls}
                  >
                    <option value="">— Sélectionner —</option>
                    {SEXE_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Date de naissance">
                  <input
                    type="date"
                    value={enf.date_naissance ?? ''}
                    onChange={(e) =>
                      patch(i, { date_naissance: e.target.value || null })
                    }
                    disabled={readOnly}
                    min="1900-01-01"
                    max={new Date().toISOString().slice(0, 10)}
                    className={inputCls}
                  />
                </Field>
                <Field label="À charge ?" span2>
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
                          name={`a_charge_${i}`}
                          checked={enf.a_charge === o.v}
                          onChange={() => patch(i, { a_charge: o.v })}
                          disabled={readOnly}
                          className="accent-indigo-600"
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                    {enf.a_charge !== null && enf.a_charge !== undefined && !readOnly && (
                      <button
                        type="button"
                        onClick={() => patch(i, { a_charge: null })}
                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                      >
                        Réinitialiser
                      </button>
                    )}
                  </div>
                </Field>
              </div>
            </div>
          )
        })}
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

/**
 * Helper : normalise une valeur lue depuis la DB (peut être un array, un
 * objet, une chaîne legacy `null` ou `undefined`) en EnfantDetail[] sûr.
 */
export function normalizeEnfantsDetails(value: unknown): EnfantDetail[] {
  if (Array.isArray(value)) return value as EnfantDetail[]
  if (value && typeof value === 'object') {
    return [value as EnfantDetail] // cas unique objet (improbable mais safe)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    // Cas legacy ultra-rare : string non encore migrée
    return [{ legacy_notes: value }]
  }
  return []
}

/**
 * Helper : affichage lecture seule compact (utilisé dans le récap PDF
 * et dans les vues read-only de la fiche client).
 */
export function formatEnfantsSummary(value: unknown): string {
  const arr = normalizeEnfantsDetails(value)
  if (arr.length === 0) return '—'
  return arr
    .map((e, i) => {
      if (e.legacy_notes) return e.legacy_notes
      const parts = [
        [e.prenom, e.nom].filter(Boolean).join(' ') || `Enfant ${i + 1}`,
        e.sexe ? labelSexe(e.sexe) : null,
        e.date_naissance
          ? new Date(e.date_naissance).toLocaleDateString('fr-FR')
          : null,
        e.a_charge === true
          ? 'à charge'
          : e.a_charge === false
            ? 'non à charge'
            : null,
      ].filter(Boolean)
      return parts.join(' · ')
    })
    .join(' | ')
}

function labelSexe(s: NonNullable<EnfantDetail['sexe']>): string {
  return s === 'homme' ? 'H' : s === 'femme' ? 'F' : 'A'
}
