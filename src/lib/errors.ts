/**
 * Extract a useful human-readable message from anything thrown in a try/catch.
 *
 * Motivation: Supabase `PostgrestError` is a plain object (not
 * `instanceof Error`), so the common `e instanceof Error ? e.message : fallback`
 * pattern always hits the fallback and hides the real cause (e.g. "new row
 * violates row-level security policy ..." + code "42501"). This helper covers:
 *   - real `Error` instances
 *   - PostgrestError-like objects (message / hint / details / code)
 *   - plain strings
 * and falls back to the provided label otherwise.
 */
export function extractErrorMessage(e: unknown, fallback: string): string {
  if (!e) return fallback

  // Real Error instance (includes AuthError, etc.)
  if (e instanceof Error && e.message) return e.message

  // PostgrestError-like: { message, details?, hint?, code? }
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>
    const parts: string[] = []
    if (typeof obj.message === 'string' && obj.message.trim()) parts.push(obj.message.trim())
    if (typeof obj.hint === 'string' && obj.hint.trim()) parts.push(`(hint : ${obj.hint.trim()})`)
    else if (typeof obj.details === 'string' && obj.details.trim()) parts.push(`(${obj.details.trim()})`)
    if (typeof obj.code === 'string' && obj.code.trim()) parts.push(`[${obj.code.trim()}]`)
    if (parts.length > 0) return parts.join(' ')
  }

  if (typeof e === 'string' && e.trim()) return e

  return fallback
}
