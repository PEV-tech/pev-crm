'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down'
  trendValue?: string | number
  className?: string
}

export const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  (
    {
      title,
      value,
      subtitle,
      icon,
      trend,
      trendValue,
      className,
    },
    ref
  ) => {
    return (
      <Card ref={ref} className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            {title}
          </CardTitle>
          {icon && <div className="text-gray-400">{icon}</div>}
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          {(subtitle || trend) && (
            <div className="flex items-center gap-1">
              {trend && (
                <span
                  className={cn(
                    'text-xs font-semibold',
                    trend === 'up' ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend === 'up' ? '↑' : '↓'}
                  {trendValue && ` ${trendValue}`}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-gray-500">{subtitle}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }
)
StatsCard.displayName = 'StatsCard'
