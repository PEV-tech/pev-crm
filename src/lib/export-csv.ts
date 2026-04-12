/**
 * CSV Export Utility
 * Creates RFC 4180 compliant CSV with UTF-8 BOM for Excel compatibility
 */

interface ExportOptions {
  filename: string
  separator?: string
}

interface ColumnConfig {
  key: string
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formatter?: (value: any) => string
}

export function exportCSV(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[],
  columns: ColumnConfig[],
  options: ExportOptions
): void {
  if (data.length === 0) {
    console.warn('No data to export')
    return
  }

  const separator = options.separator || ';'

  // Build CSV content
  const headers = columns.map((col) => escapeCSVField(col.label)).join(separator)

  const rows = data.map((row) =>
    columns
      .map((col) => {
        let value = getNestedValue(row, col.key)
        if (col.formatter) {
          value = col.formatter(value)
        }
        return escapeCSVField(String(value ?? ''))
      })
      .join(separator)
  )

  const csvContent = [headers, ...rows].join('\n')

  // Add UTF-8 BOM for Excel compatibility
  const bom = '\ufeff'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })

  // Trigger download
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', options.filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Escape CSV field values according to RFC 4180
 * Fields containing special characters should be quoted
 */
function escapeCSVField(field: string): string {
  // If field contains comma, newline, or quotes, it needs to be quoted
  if (field.includes(',') || field.includes(';') || field.includes('\n') || field.includes('"')) {
    // Escape quotes by doubling them
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

/**
 * Get nested object values using dot notation (e.g., "user.name")
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj)
}

/**
 * Generate a formatted filename with current date
 */
export function getExportFilename(basename: string): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${basename}_${year}-${month}-${day}.csv`
}

/**
 * Format currency for CSV export (removes Euro symbol, uses comma decimal)
 */
export function formatCurrencyForCSV(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format date for CSV export
 */
export function formatDateForCSV(value: string | null | undefined): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString('fr-FR')
}
