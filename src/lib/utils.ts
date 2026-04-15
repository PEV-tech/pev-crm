import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge className strings with Tailwind CSS class deduplication.
 * Combines clsx for conditional classes and tailwind-merge for proper Tailwind conflict resolution.
 *
 * @param inputs - Class names to merge (strings, objects, arrays, etc.)
 * @returns Merged and deduplicated class string
 *
 * @example
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4'
 * cn('px-2', { 'px-4': true }) // => 'px-4'
 * cn(['px-2', { 'py-1': false }], 'px-4') // => 'px-4'
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fix UTF-8 triple-corruption. Use instead of any singleFix pattern.
 * Takes a raw binary string (from atob) and returns proper Unicode.
 */
export function fixEncoding(rawBinary: string): string {
  const bytes = new Uint8Array(rawBinary.length)
  for (let i = 0; i < rawBinary.length; i++) bytes[i] = rawBinary.charCodeAt(i)
  let text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  text = text
    .replace(/\u00E2\u0080\u0094/g, '\u2014')
    .replace(/\u00E2\u0080\u0099/g, '\u2019')
    .replace(/\u00C3\u00A9/g, '\u00E9')
    .replace(/\u00C3\u00A0/g, '\u00E0')
    .replace(/\u00C3\u00A8/g, '\u00E8')
    .replace(/\u00C3\u00AA/g, '\u00EA')
    .replace(/\u00C3\u00AE/g, '\u00EE')
    .replace(/\u00C3\u00B4/g, '\u00F4')
    .replace(/\u00C3\u00BB/g, '\u00FB')
    .replace(/\u00C3\u00A7/g, '\u00E7')
    .replace(/\u00C3\u00A2/g, '\u00E2')
    .replace(/\u00E2\u0080\u00A6/g, '\u2026')
  return text
}

