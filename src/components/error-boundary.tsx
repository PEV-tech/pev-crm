'use client'

/**
 * ErrorBoundary global + handlers window.onerror / onunhandledrejection.
 *
 * Posé autour de tout le dashboard dans `app/layout.tsx`. Capture :
 *   1. Les exceptions synchrones des composants React (via componentDidCatch).
 *   2. Les exceptions synchrones hors React (via window.addEventListener('error')).
 *   3. Les promesses rejetées non catchées (unhandledrejection).
 *
 * Chaque capture POST sur /api/errors, fire-and-forget. Si le logging échoue,
 * on ne remonte rien à l'utilisateur — on ne va pas l'embêter avec un
 * problème d'observabilité.
 *
 * Le fallback affiché est volontairement simple. On ne veut pas masquer la
 * stack en dev (on la montre seulement en dev) et on ne veut pas leak
 * d'info technique en prod.
 */

import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react'

function reportError(payload: {
  source: 'client'
  message: string
  stack?: string
  route?: string
  extra?: Record<string, unknown>
}) {
  // Use keepalive pour que le POST parte même si la page se ferme juste après.
  try {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        ...payload,
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
    }).catch(() => {
      // Silent — si /api/errors est down, on ne peut rien y faire de plus.
    })
  } catch {
    // fetch peut throw sur des browsers très vieux — idem, silent.
  }
}

/**
 * Hook à placer dans un composant client de haut niveau (layout).
 * Attache les listeners globaux. Nettoie au démontage.
 */
export function GlobalErrorListeners() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportError({
        source: 'client',
        message: event.message || 'Unknown error',
        stack: event.error?.stack,
        route: window.location.pathname,
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          kind: 'window.onerror',
        },
      })
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled promise rejection'
      const stack = reason instanceof Error ? reason.stack : undefined

      reportError({
        source: 'client',
        message,
        stack,
        route: window.location.pathname,
        extra: { kind: 'unhandledrejection' },
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}

type State = { hasError: boolean; error: Error | null }

/**
 * React Error Boundary classique. On l'utilise autour des pages dashboard,
 * mais il est safe de l'empiler avec d'autres ErrorBoundary plus locaux
 * si besoin (ex: autour d'un composant qui échoue gracefully).
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  State
> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError({
      source: 'client',
      message: error.message || 'React error',
      stack: error.stack,
      route:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
      extra: {
        kind: 'react-error-boundary',
        componentStack: info.componentStack?.slice(0, 1000),
      },
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Une erreur est survenue
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              L&apos;équipe a été notifiée. Vous pouvez rafraîchir la page
              ou retourner à l&apos;accueil.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mt-4 overflow-auto rounded bg-gray-100 p-3 text-left text-xs text-gray-800">
                {this.state.error.message}
                {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
              </pre>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                if (typeof window !== 'undefined') window.location.reload()
              }}
              className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Rafraîchir
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
