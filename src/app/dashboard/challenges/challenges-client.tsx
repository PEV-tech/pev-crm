'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { TrendingUp } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0 €'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

interface ChallengeData {
  consultant: string
  objectif: number
  collecte: number
  challengeId?: string
}

interface ChallengesClientProps {
  initialData: ChallengeData[]
}

const ProgressBadge = ({ percentage }: { percentage: number }) => {
  let variant: 'destructive' | 'warning' | 'success' = 'destructive'
  if (percentage >= 80) variant = 'success'
  else if (percentage >= 50) variant = 'warning'

  return (
    <Badge variant={variant}>
      {Math.round(percentage)}%
    </Badge>
  )
}

export function ChallengesClient({ initialData }: ChallengesClientProps) {
  const [data] = React.useState(initialData)

  const columns: ColumnDefinition<ChallengeData>[] = [
    {
      key: 'consultant',
      label: 'Consultant',
      sortable: true,
    },
    {
      key: 'objectif',
      label: 'Objectif',
      sortable: true,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'collecte',
      label: 'Collecte réalisée',
      sortable: true,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'collecte',
      label: '% Progression',
      sortable: true,
      render: (_, row) => {
        const percentage = row.objectif > 0 ? (row.collecte / row.objectif) * 100 : 0
        return <ProgressBadge percentage={percentage} />
      },
    },
    {
      key: 'collecte',
      label: 'Statut',
      render: (_, row) => {
        const percentage = row.objectif > 0 ? (row.collecte / row.objectif) * 100 : 0
        let variant: 'destructive' | 'warning' | 'success' = 'destructive'
        let label = 'En retard'
        if (percentage >= 80) {
          variant = 'success'
          label = 'Sur les rails'
        } else if (percentage >= 50) {
          variant = 'warning'
          label = 'À surveiller'
        }
        return <Badge variant={variant}>{label}</Badge>
      },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Challenges</h1>
        <p className="text-gray-600 mt-1">Objectifs et progression des consultants</p>
      </div>

      {/* Progress Bars */}
      <div className="space-y-4">
        {data.map((item, idx) => {
          const percentage = item.objectif > 0 ? (item.collecte / item.objectif) * 100 : 0
          let bgColor = 'bg-red-500'
          if (percentage >= 80) bgColor = 'bg-green-500'
          else if (percentage >= 50) bgColor = 'bg-yellow-500'

          return (
            <Card key={idx}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">
                      {item.consultant}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(item.collecte)} / {formatCurrency(item.objectif)}
                    </p>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${bgColor} transition-all duration-300`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>

                  <p className="text-xs text-gray-600">
                    {Math.round(percentage)}% complété
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" />
            Détails par consultant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable data={data} columns={columns} pageSize={10} />
        </CardContent>
      </Card>
    </div>
  )
}
