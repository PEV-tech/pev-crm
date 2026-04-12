/**
 * Centralized formatting utilities for the PEV CRM
 * All currency, date, and number formatting should use these functions
 */

/**
 * Format a number as EUR currency using French locale
 * Returns '-' for null/undefined values
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

/**
 * Format a number as EUR currency with no decimal places
 * Useful for rounded display in summaries
 */
export function formatCurrencyRounded(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format a number as EUR currency, returning '0 €' for null/undefined
 * Used in contexts where zero should be explicit
 */
export function formatCurrencyOrZero(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0 \u20ac'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

/**
 * Format a number as percentage
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

/**
 * Format a date string in French locale
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('fr-FR')
}
