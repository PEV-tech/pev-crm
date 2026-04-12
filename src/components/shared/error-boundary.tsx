'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // In production, this could be sent to an error reporting service
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <AlertTriangle className="h-10 w-10 text-red-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-800">
                Une erreur est survenue
              </h3>
              <p className="mt-1 text-sm text-red-600">
                {this.state.error?.message || 'Erreur inattendue'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

/**
 * Lightweight error state for data loading failures
 * Use this inline instead of a spinner when a fetch fails
 */
export function FetchError({
  message = 'Erreur de chargement',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
      <AlertTriangle className="h-8 w-8 text-red-400" />
      <p className="text-sm">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </Button>
      )}
    </div>
  )
}
