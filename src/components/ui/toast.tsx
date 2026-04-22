'use client'

/**
 * Toast utilitaire ultra-léger, sans dépendance externe.
 * Usage : const { showToast, ToastContainer } = useToast()
 *   showToast('Sauvegardé', 'success')
 *   {ToastContainer}
 *
 * Pensé pour être monté une fois par page (shell). Si on installe `sonner`
 * plus tard, on peut remplacer par un wrapper gardant la même signature.
 */

import * as React from 'react'
import { Check, X, AlertCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])
  const nextId = React.useRef(0)

  const showToast = React.useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, type }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const ToastContainer = (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const styles =
          t.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : t.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
        const Icon = t.type === 'success' ? Check : t.type === 'error' ? X : AlertCircle
        return (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-sm pointer-events-auto min-w-[240px] text-sm font-medium ${styles}`}
          >
            <Icon size={16} />
            <span>{t.message}</span>
          </div>
        )
      })}
    </div>
  )

  return { showToast, ToastContainer }
}
