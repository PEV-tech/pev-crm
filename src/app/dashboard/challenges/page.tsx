'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { useConsultantInfo, useRole } from '@/hooks/use-user'
import { Trophy, TrendingUp, ArrowUp, Target } from 'lucide-react'

import { formatCurrencyRounded } from '@/lib/formatting'
const formatCurrency = formatCurrencyRounded

interface RankedConsultant {
  name: string // full "prenom nom" key
  prenom: string
  nom: string
  collecte: number
  nbDossiers: number
  rank: number
  ecart: number | null // amount to reach the rank above
}

export default function ChallengesPage() {
  const role = useRole()
  const consultantInfo = useConsultantInfo()
  const isManager = role === 'manager' || role === 'back_office'
  const [ranked, setRanked] = useState<RankedConsultant[]>([])
  const [myRank, setMyRank] = useState<RankedConsultant | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    async function loadRanking() {
      setLoading(true)
      const supabase = createClient()
      // Use SECURITY DEFINER RPC to get cross-consultant ranking data
      // get_classement() includes ALL consultants (even those with 0 collecte)
      const classementRes = await supabase.rpc('get_classement', { p_annee: selectedYear })
      const classementData = classementRes.data || []

      const map: Record<string, { nom: string; prenom: string; collecte: number; nbDossiers: number }> = {}
      classementData.forEach((d: any) => {
        if (!d.consultant_prenom) return
        const key = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
        if (!map[key]) map[key] = { nom: d.consultant_nom || '', prenom: d.consultant_prenom || '', collecte: 0, nbDossiers: 0 }
        map[key].collecte = Number(d.collecte) || 0
        map[key].nbDossiers = Number(d.nb_dossiers) || 0
      })

      const sorted = Object.entries(map)
        .sort((a, b) => b[1].collecte - a[1].collecte)
        .map(([name, data], index, arr) => ({
          name,
          prenom: data.prenom,
          nom: data.nom,
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
  }, [consultantInfo, isManager, selectedYear])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>

  // For consultants: anonymized view — only rank numbers and amounts, highlight own position
  const totalCollecte = ranked.reduce((s, r) => s + r.collecte, 0)
  const totalDossiers = ranked.reduce((s, r) => s + r.nbDossiers, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Classement</h1>
          <p className="text-gray-600 mt-1">
            {isManager ? 'Classement détaillé des consultants' : 'Votre position par rapport à vos pairs'} — {selectedYear}
          </p>
        </div>
        <Select value={String(selectedYear)} onChange={e => setSelectedYear(Number(e.target.value))} className="w-32">
          {[2024, 2025, 2026].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><Trophy size={16} className="text-yellow-500" /> Participants</div>
          <p className="text-2xl font-bold mt-1">{ranked.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><TrendingUp size={16} className="text-blue-500" /> Collecte totale</div>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalCollecte)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><Target size={16} className="text-green-500" /> Dossiers finalisés</div>
          <p className="text-2xl font-bold mt-1">{totalDossiers}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><TrendingUp size={16} className="text-indigo-500" /> Moyenne/consultant</div>
          <p className="text-2xl font-bold mt-1">{ranked.length > 0 ? formatCurrency(totalCollecte / ranked.length) : '-'}</p>
        </Card>
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
                  <p className="text-4xl font-bold text-indigo-900">{myRank.rank}<span className="text-lg text-gray-400">/{ranked.length}</span></p>
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

      {/* ═══════ MANAGER VIEW: Full detail ═══════ */}
      {isManager && ranked.length > 0 && (
        <>
          {/* Top 3 Podium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ranked.slice(0, 3).map((r) => (
              <Card key={r.name} className={`${
                r.rank === 1 ? 'border-2 border-yellow-400 bg-yellow-50/50' :
                r.rank === 2 ? 'border-2 border-gray-300 bg-gray-50/50' :
                'border-2 border-orange-300 bg-orange-50/50'
              }`}>
                <CardContent className="py-6 text-center">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-lg font-bold mb-3 ${
                    r.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                    r.rank === 2 ? 'bg-gray-200 text-gray-700' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉'}
                  </div>
                  <p className="text-lg font-bold text-gray-900">{r.prenom} {r.nom}</p>
                  <p className="text-2xl font-bold text-indigo-700 mt-1">{formatCurrency(r.collecte)}</p>
                  <p className="text-sm text-gray-500 mt-1">{r.nbDossiers} dossier(s)</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Full detail table */}
          <Card>
            <CardHeader><CardTitle>Détail du classement</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Consultant</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Collecte</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Dossiers</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Écart rang supérieur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((r) => (
                      <tr key={r.name} className={`border-b border-gray-200 hover:bg-gray-50 ${r.rank <= 3 ? 'bg-yellow-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            r.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                            r.rank === 2 ? 'bg-gray-200 text-gray-700' :
                            r.rank === 3 ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-500'
                          }`}>{r.rank}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.prenom} {r.nom}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(r.collecte)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{r.nbDossiers}</td>
                        <td className="px-4 py-3 text-right">
                          {r.ecart !== null ? (
                            <span className="text-indigo-600 font-medium">+{formatCurrency(r.ecart)}</span>
                          ) : (
                            <span className="text-green-600 font-medium">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══════ CONSULTANT VIEW: Anonymized ═══════ */}
      {!isManager && ranked.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Classement anonymisé</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Rang</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Collecte</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Dossiers</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Écart rang supérieur</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => {
                    const isMe = myRank && r.name === myRank.name
                    return (
                      <tr
                        key={r.rank}
                        className={`border-b border-gray-200 ${
                          isMe ? 'bg-indigo-50 border-indigo-200 font-semibold' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              r.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                              r.rank === 2 ? 'bg-gray-200 text-gray-700' :
                              r.rank === 3 ? 'bg-orange-100 text-orange-800' :
                              isMe ? 'bg-indigo-200 text-indigo-800' :
                              'bg-gray-100 text-gray-500'
                            }`}>{r.rank}</span>
                            {isMe && <span className="text-xs text-indigo-600 font-bold">← Vous</span>}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right ${isMe ? 'text-indigo-900 font-bold' : 'text-gray-900'}`}>
                          {formatCurrency(r.collecte)}
                        </td>
                        <td className={`px-4 py-3 text-right ${isMe ? 'text-indigo-700' : 'text-gray-600'}`}>
                          {r.nbDossiers}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.ecart !== null ? (
                            <span className={`font-medium ${isMe ? 'text-indigo-600' : 'text-gray-500'}`}>+{formatCurrency(r.ecart)}</span>
                          ) : (
                            <span className="text-green-600 font-medium">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {ranked.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Aucune collecte finalisée en {selectedYear}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
