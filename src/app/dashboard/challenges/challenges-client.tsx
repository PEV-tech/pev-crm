'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Trophy, ArrowUp } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0 €'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
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
  return <Badge variant={variant}>{Math.round(percentage)}%</Badge>
}

const PODIUM_ICONS = ['🥇', '🥈', '🥉']

export function ChallengesClient({ initialData }: ChallengesClientProps) {
  // Sort by collecte desc to establish ranking
  const ranked = React.useMemo(() => {
    return [...initialData]
      .sort((a, b) => b.collecte - a.collecte)
      .map((item, index) => {
        const percentage = item.objectif > 0 ? (item.collecte / item.objectif) * 100 : 0
        // Écart pour passer à la position supérieure
        const prevItem = index > 0 ? [...initialData].sort((a, b) => b.collecte - a.collecte)[index - 1] : null
        const ecartForUp = prevItem ? prevItem.collecte - item.collecte + 1 : 0
        return { ...item, rank: index + 1, percentage, ecartForUp }
      })
  }, [initialData])

  const total = ranked.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Challenges</h1>
        <p className="text-gray-600 mt-1">Objectifs et progression des consultants</p>
      </div>

      {/* Podium cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ranked.slice(0, 3).map((item) => {
          let bgColor = 'bg-gray-100'
          if (item.rank === 1) bgColor = 'bg-yellow-50 border-yellow-300'
          else if (item.rank === 2) bgColor = 'bg-gray-100 border-gray-300'
          else if (item.rank === 3) bgColor = 'bg-orange-50 border-orange-200'
          const barBg = item.percentage >= 80 ? 'bg-green-500' : item.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          return (
            <Card key={item.consultant} className={`border-2 ${bgColor}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{PODIUM_ICONS[item.rank - 1]}</span>
                    <span className="font-bold text-gray-900">{item.consultant}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-500">{item.rank}/{total}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Collecte</span>
                    <span className="font-semibold">{formatCurrency(item.collecte)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Objectif</span>
                    <span>{formatCurrency(item.objectif)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className={`h-full ${barBg} transition-all`} style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <ProgressBadge percentage={item.percentage} />
                    {item.rank > 1 && (
                      <span className="text-xs text-indigo-600 flex items-center gap-1">
                        <ArrowUp size={12} />
                        {formatCurrency(item.ecartForUp)} pour +1
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Classement complet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" />
            Classement complet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ranked.map((item) => {
              const barBg = item.percentage >= 80 ? 'bg-green-500' : item.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              let statusLabel = 'En retard'
              let statusVariant: 'destructive' | 'warning' | 'success' = 'destructive'
              if (item.percentage >= 80) { statusLabel = 'Sur les rails'; statusVariant = 'success' }
              else if (item.percentage >= 50) { statusLabel = 'À surveiller'; statusVariant = 'warning' }

              return (
                <div key={item.consultant} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center gap-3 mb-2">
                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      item.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                      item.rank === 2 ? 'bg-gray-100 text-gray-700' :
                      item.rank === 3 ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {item.rank}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{item.consultant}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{item.rank}/{total}</span>
                          <Badge variant={statusVariant} className="text-xs">{statusLabel}</Badge>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className={`h-full ${barBg} transition-all`} style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">
                          {formatCurrency(item.collecte)} / {formatCurrency(item.objectif)}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium">{Math.round(item.percentage)}%</span>
                          {item.rank > 1 && (
                            <span className="text-xs text-indigo-600 flex items-center gap-1">
                              <ArrowUp size={11} />
                              {formatCurrency(item.ecartForUp)} pour passer {item.rank - 1}e
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
