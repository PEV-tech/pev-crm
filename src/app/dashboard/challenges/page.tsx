'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useConsultantInfo, useRole } from '@/hooks/use-user'
import { Trophy, TrendingUp, ArrowUp } from 'lucide-react'

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

interface RankedConsultant {
  name: string
  prenom: string
  collecte: number
  nbDossiers: number
  rank: number
  ecart: number | null
}

export default function ChallengesPage() {
  const role = useRole()
  const consultantInfo = useConsultantInfo()
  const isManager = role === 'manager' || role === 'back_office'
  const [ranked, setRanked] = useState<RankedConsultant[]>([])
  const [myRank, setMyRank] = useState<RankedConsultant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRanking() {
      const supabase = createClient()
      const { data: dossiers } = await supabase
        .from('v_dossiers_complets')
        .select('consultant_nom, consultant_prenom, montant, statut')

      if (!dossiers) { setLoading(false); return }

      // Aggregate collecte per consultant
      const map: Record<string, { nom: string; prenom: string; collecte: number; nbDossiers: number }> = {}
      dossiers.forEach((d: any) => {
        if (d.statut !== 'client_finalise') return
        if (!d.consultant_nom || d.consultant_nom.toLowerCase() === 'back office') return
        const key = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
        if (!map[key]) map[key] = { nom: d.consultant_nom, prenom: d.consultant_prenom || '', collecte: 0, nbDossiers: 0 }
        map[key].collecte += d.montant || 0
        map[key].nbDossiers += 1
      })

      const sorted = Object.entries(map)
        .sort((a, b) => b[1].collecte - a[1].collecte)
        .map(([name, data], index, arr) => ({
          name,
          prenom: data.prenom,
          collecte: data.collecte,
          nbDossiers: data.nbDossiers,
          rank: index + 1,
          ecart: index > 0 ? arr[index - 1][1].collecte - data.collecte + 1 : null,
        }))

      setRanked(sorted)

      if (consultantInfo?.name) {
        const me = sorted.find(r => r.name === consultantInfo.name) || null
        setMyRank(me)
      }

      setLoading(false)
    }
    loadRanking()
  }, [consultantInfo, isManager])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Classement</h1>
        <p className="text-gray-600 mt-1">Classement des consultants par collecte réalisée</p>
      </div>

      {/* Mon classement (consultant only) */}
      {!isManager && myRank && (
        <Card className="border-2 border-indigo-200 bg-indigo-50/50">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-100 p-4 rounded-xl">
                  <Trophy className="text-indigo-600" size={32} />
                </div>
                <div>
                  <p className="text-sm text-indigo-600 font-medium">Ma position</p>
                  <p className="text-4xl font-bold text-indigo-900">{myRank.rank}/{ranked.length}</p>
                  <p className="text-sm text-gray-600 mt-1">Collecte : {formatCurrency(myRank.collecte)} · {myRank.nbDossiers} dossier(s)</p>
                </div>
              </div>
              {myRank.ecart !== null && (
                <div className="text-right bg-white rounded-lg p-4 border border-indigo-100">
                  <p className="text-xs text-gray-500 mb-1">Pour passer {myRank.rank - 1}e</p>
                  <p className="text-xl font-bold text-indigo-700 flex items-center gap-1">
                    <ArrowUp size={18} />
                    {formatCurrency(myRank.ecart)}
                  </p>
                </div>
              )}
              {myRank.ecart === null && (
                <div className="text-right bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-lg font-bold text-green-700">1ère position</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager: overview cards (no full table) */}
      {isManager && ranked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} />
              Vue d'ensemble
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ranked.map((r) => (
                <div key={r.name} className={`p-4 rounded-lg border ${r.rank === 1 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                      r.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                      r.rank === 2 ? 'bg-gray-200 text-gray-700' :
                      r.rank === 3 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-500'
                    }`}>{r.rank}</span>
                    <span className="font-semibold text-sm">{r.prenom}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(r.collecte)}</p>
                  <p className="text-xs text-gray-500">{r.nbDossiers} dossier(s)</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
