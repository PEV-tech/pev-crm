import type { ToastType } from '@/components/ui/toast'

export type ShowToast = (message: string, type?: ToastType) => void

export const SECTION_INTRO_CLS =
  'rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-indigo-900'

export const formatPercent0 = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(0)}%`
}

export const formatPercent2 = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(2)}%`
}

/** Convertit la saisie "2.5" (en %) vers 0.025 (fraction). Null si vide. */
export const parseRateInput = (v: string): number | null => {
  if (v === '' || v == null) return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n / 100 : null
}

/** Convertit 0.025 vers "2.5" pour l'affichage en <input type="number">. */
export const rateToInput = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return ''
  return (v * 100).toString()
}
