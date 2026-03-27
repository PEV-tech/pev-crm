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
