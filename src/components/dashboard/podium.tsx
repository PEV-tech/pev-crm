'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Trophy } from 'lucide-react'

interface PodiumData {
  rank: number
  consultantNom: string
  consultantPrenom: string
  collecte: number
  nbDossiers: number
}

interface PodiumProps {
  data: PodiumData[]
}

import { formatCurrencyOrZero } from '@/lib/formatting'
const formatCurrency = formatCurrencyOrZero

const getMedalColor = (rank: number): string => {
  switch (rank) {
    case 1:
      return 'bg-yellow-100 border-2 border-yellow-400'
    case 2:
      return 'bg-gray-100 border-2 border-gray-400'
    case 3:
      return 'bg-orange-100 border-2 border-orange-400'
    default:
      return 'bg-white border-2 border-gray-200'
  }
}

const getMedalIcon = (rank: number): string => {
  switch (rank) {
    case 1:
      return '🥇'
    case 2:
      return '🥈'
    case 3:
      return '🥉'
    default:
      return ''
  }
}

const getRankBadgeVariant = (rank: number): 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' | 'success' => {
  switch (rank) {
    case 1:
      return 'success'
    case 2:
      return 'secondary'
    case 3:
      return 'warning'
    default:
      return 'outline'
  }
}

export function Podium({ data }: PodiumProps) {
  const topThree = data.slice(0, 3)
  const remaining = data.slice(3)

  const columns: ColumnDefinition<PodiumData>[] = [
    {
      key: 'rank',
      label: 'Rang',
      render: (rank) => (
        <Badge variant={getRankBadgeVariant(rank as number)}>
          {rank}
        </Badge>
      ),
    },
    {
      key: 'consultantNom',
      label: 'Consultant',
      render: (_, row) => `${row.consultantPrenom} ${row.consultantNom}`,
    },
    {
      key: 'collecte',
      label: 'Collecte',
      sortable: true,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'nbDossiers',
      label: 'Dossiers',
      sortable: true,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Trophy className="text-yellow-500" size={32} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Podium des consultants</h2>
          <p className="text-gray-600 text-sm">Top 3 par collecte réalisée</p>
        </div>
      </div>

      {/* Top 3 Medal Cards */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((consultant, index) => {
            const rank = index + 1
            return (
              <Card key={`${consultant.consultantNom}-${rank}`} className={`${getMedalColor(rank)} shadow-lg`}>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="text-4xl">{getMedalIcon(rank)}</div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {consultant.consultantPrenom} {consultant.consultantNom}
                      </h3>
                      <p className="text-2xl font-bold text-gray-700 mt-2">
                        {formatCurrency(consultant.collecte)}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {consultant.nbDossiers} dossier{consultant.nbDossiers > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Full Ranking Table */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Classement complet</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data}
              columns={columns}
              searchField="consultantNom"
              searchPlaceholder="Rechercher un consultant..."
              pageSize={10}
            />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {data.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Trophy className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">Aucune donnée de collecte disponible</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
