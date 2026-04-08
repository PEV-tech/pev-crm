'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Award, Target, ArrowUp } from 'lucide-react'

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)

interface GrilleTier {
  id: string
  taux: number
  ca_min: number
  ca_max: number | null
}

interface CommissionGrilleProps {
  consultantId: string
  consultantNom: string
  dossiers: any[] // from v_dossiers_complets or v_dossiers_remunerations
}

// Consultants excluded from progressive grille (fixed rates)
const EXCLUDED_CONSULTANTS = ['Maxine', 'Thélo', 'Thelo', 'Théloïs', 'Stéphane', 'Mathias']

export function CommissionGrille({ consultantId, consultantNom, dossiers }: CommissionGrilleProps) {
  const [tiers, setTiers] = React.useState<GrilleTier[]>([])
  const [loading, setLoading] = React.useState(true)
  const supabase = React.useMemo(() => createClient(), [])

  // Check if this consultant is excluded
  const firstName = consultantNom.split(' ')[0]
  const isExcluded = EXCLUDED_CONSULTANTS.some(
    name => firstName.toLowerCase() === name.toLowerCase()
  )

  // Fetch grille tiers
  React.useEffect(() => {
    if (isExcluded) { setLoading(false); return }
    const fetch = async () => {
      const { data } = await supabase
        .from('grilles_commissionnement')
        .select('*')
        .order('ca_min', { ascending: true })
      setTiers(data || [])
      setLoading(false)
    }
    fetch()
  }, [supabase, isExcluded])

  // Compute 12-month rolling CA from finalized dossiers
  const { rollingCA, currentTier, nextTier, gapToNext } = React.useMemo(() => {
    const now = new Date()
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate())

    const rollingCA = dossiers
      .filter(d => {
        if (d.statut !== 'client_finalise') return false
        const dateOp = d.date_operation ? new Date(d.date_operation) : null
        return dateOp && dateOp >= twelveMonthsAgo
      })
      .reduce((sum, d) => sum + (d.commission_brute || 0), 0)

    let currentTier: GrilleTier | null = null
    let nextTier: GrilleTier | null = null

    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i]
      if (rollingCA >= t.ca_min && (t.ca_max === null || rollingCA < t.ca_max)) {
        currentTier = t
        nextTier = i < tiers.length - 1 ? tiers[i + 1] : null
        break
      }
    }

    // If below first tier, use first tier as current
    if (!currentTier && tiers.length > 0) {
      currentTier = tiers[0]
      nextTier = tiers.length > 1 ? tiers[1] : null
    }

    const gapToNext = nextTier ? nextTier.ca_min - rollingCA : 0

    return { rollingCA, currentTier, nextTier, gapToNext }
  }, [dossiers, tiers])

  if (isExcluded || loading) return null
  if (tiers.length === 0) return null

  const progressInTier = currentTier
    ? currentTier.ca_max
      ? Math.min(100, ((rollingCA - currentTier.ca_min) / (currentTier.ca_max - currentTier.ca_min)) * 100)
      : 100
    : 0

  return (
    <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award size={18} className="text-emerald-600" />
          Grille de commissionnement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current tier display */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Taux actuel</p>
            <p className="text-3xl font-bold text-emerald-700">
              {currentTier ? `${(currentTier.taux * 100).toFixed(0)}%` : '-'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 font-medium">CA 12 mois glissants</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(rollingCA)}</p>
          </div>
        </div>

        {/* Tier visualization */}
        <div className="space-y-2">
          {tiers.map((t, i) => {
            const isActive = currentTier?.id === t.id
            const isPast = currentTier ? t.ca_min < currentTier.ca_min : false
            const isFuture = currentTier ? t.ca_min > currentTier.ca_min : true

            return (
              <div
                key={t.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                  isActive
                    ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                    : isPast
                    ? 'border-gray-200 bg-gray-50 opacity-60'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : isPast
                    ? 'bg-gray-300 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {(t.taux * 100).toFixed(0)}%
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isActive ? 'text-emerald-800' : 'text-gray-700'}`}>
                      Palier {(t.taux * 100).toFixed(0)}%
                    </span>
                    {isActive && (
                      <Badge variant="success" className="text-[10px]">Actuel</Badge>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatCurrency(t.ca_min)} — {t.ca_max ? formatCurrency(t.ca_max) : '∞'}
                  </span>
                </div>
                {isActive && (
                  <div className="w-20">
                    <div className="w-full bg-emerald-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${progressInTier}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Gap to next tier */}
        {nextTier && gapToNext > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="bg-amber-100 p-2 rounded-full">
              <Target size={16} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                Prochain palier : {(nextTier.taux * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-amber-600">
                Il vous manque <span className="font-bold">{formatCurrency(gapToNext)}</span> de CA pour passer au palier suivant
              </p>
            </div>
            <ArrowUp size={18} className="text-amber-500" />
          </div>
        )}

        {/* Already at max tier */}
        {!nextTier && currentTier && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="bg-emerald-100 p-2 rounded-full">
              <Award size={16} className="text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-emerald-800">
              Palier maximum atteint !
            </p>
          </div>
        )}

        <p className="text-[10px] text-gray-400 text-center">
          Calcul basé sur les commissions brutes des dossiers finalisés des 12 derniers mois
        </p>
      </CardContent>
    </Card>
  )
}
