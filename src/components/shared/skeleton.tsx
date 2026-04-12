'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Base Skeleton component with animated pulse effect
 */
const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg bg-gray-200 animate-pulse',
      className
    )}
    {...props}
  />
))
Skeleton.displayName = 'Skeleton'

/**
 * SkeletonCard: Placeholder for stat cards with shimmer effect
 */
interface SkeletonCardProps {
  count?: number
}

function SkeletonCard({ count = 4 }: SkeletonCardProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${count} gap-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * SkeletonText: Multiple lines of text placeholders
 */
interface SkeletonTextProps {
  lines?: number
  className?: string
}

function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}

/**
 * SkeletonTable: Table placeholder with header and rows
 */
interface SkeletonTableProps {
  rows?: number
  columns?: number
}

function SkeletonTable({ rows = 5, columns = 6 }: SkeletonTableProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="grid gap-4 p-4 border-t border-gray-200"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * SkeletonDashboard: Full dashboard loading state
 */
function SkeletonDashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats Cards */}
      <SkeletonCard count={4} />

      {/* Content area */}
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  )
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonText,
  SkeletonTable,
  SkeletonDashboard,
}
