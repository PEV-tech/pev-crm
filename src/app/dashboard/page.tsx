'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { useRole, useConsultantInfo } from '@/hooks/use-user'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { DashboardClient } from './dashboard-client'
import { SkeletonDashboard } from '@/components/shared/skeleton'
import { TrendingUp, DollarSign, Clock, CheckCircle, Trophy, Target, AlertTriangle } from 'lucide-react'
import { VDossiersComplets } from '@/types/database'

import { formatCurrencyOrZero } from '@/lib/formatting'
const formatCurrency = formatCurrencyOrZero

export default function DashboardPage() {
  const role = useRole()
  const consultantInfo = useConsultantInfo()
  const isManager = role === 'manager' || role === 'back_office'

  const [stats, setStats] = useState({ collecte: 0, caGenere: 0, pipelineEnCours: 0, dossiersFinalisés: 0 })
  const [allFinalisedDossiers, setAllFinalisedDossiers] = useState<VDossiersComplets[]>([])
  const [recentDossiers, setRecentDossiers] = useState<VDossiersComplets[]>([])
  const [pendingInvoices, setPendingInvoices] = useState<Record<string, unknown>[]>([])
  const [consultantRank, setConsultantRank] = useState<{ rank: number; totalConsultants: number; ecart: number | null } | null>(null)
  const [objectif, setObjectif] = useState<{ objectif: number; collecte: number } | null>(null)
  const [projection, setProjection] = useState<number | null>(null)
  const [relancesCount, setRelancesCount] = useState(0)
  const [totalDossiersCount, setTotalDossiersCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const timedOut = useLoadingTimeout(loading, 15000)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const fullName = consultantInfo?.name || ''

      // Single fetch for dossiers 2026 only + challenges + factures in parallel
      const [dossiersRes, challengesRes, facturesRes] = await Promise.all([
        supabase
          .from('v_dossiers_complets')
          .select('id, statut, montant, commission_brute, date_operation, consultant_prenom, consultant_nom, client_prenom, client_nom, produit_nom, compagnie_nom, statut_kyc, facturee, payee')
          .gte('date_operation', '2026-01-01'),
        supabase
          .from('challenges')
          .select('consultant_id, objectif, collecte')
          .eq('annee', 2026),
        supabase
          .from('factures')
          .select('id, dossier_id, facturee, montant')
          .eq('facturee', false)
          .limit(20),
      ])

      const dossiers = dossiersRes.data || []
      const challenges = challengesRes.data || []

      // Single filter pass for consultant dossiers
      const filteredDossiers = (!isManager && fullName)
        ? dossiers.filter((d: any) => `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim() === fullName)
        : dossiers

      // Single pass through filtered dossiers to compute all stats at once
      let collecte = 0, pipelineEnCours = 0, caGenere = 0, dossiersFinalisés = 0, relCount = 0
      const finalised: VDossiersComplets[] = []
      const nowDate = new Date()

      filteredDossiers.forEach((d: any) => {
        caGenere += d.commission_brute || 0

        if (d.statut === 'client_finalise') {
          collecte += d.montant || 0
          dossiersFinalisés++
          finalised.push(d)
          if (d.facturee === true && (d.payee === 'non' || !d.payee)) relCount++
        } else if (d.statut === 'client_en_cours') {
          pipelineEnCours += d.montant || 0
          if (d.statut_kyc === 'non') relCount++
          const dateOp = d.date_operation ? new Date(d.date_operation) : null
          if (dateOp && Math.floor((nowDate.getTime() - dateOp.getTime()) / 86400000) >= 30) relCount++
        }
      })

      setStats({ collecte, caGenere, pipelineEnCours, dossiersFinalisés })
      setAllFinalisedDossiers(finalised)
      setTotalDossiersCount(filteredDossiers.length)
      setRelancesCount(relCount)

      // Projection: (collecte YTD / months elapsed) * 12
      const monthsElapsed = nowDate.getMonth() + (nowDate.getDate() / 30)
      if (monthsElapsed > 0 && collecte > 0) {
        setProjection((collecte / monthsElapsed) * 12)
      }

      // Consultant ranking: use SECURITY DEFINER RPC to see all consultants
      if (!isManager && fullName) {
        const { data: classementData } = await supabase.rpc('get_classement', { p_annee: 2026 })
        const rankings: Record<string, number> = {}
        ;(classementData || []).forEach((d: any) => {
          const name = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
          if (name) rankings[name] = Number(d.collecte) || 0
        })
        const sorted = Object.entries(rankings).sort((a, b) => b[1] - a[1])
        const rank = sorted.findIndex(([name]) => name === fullName) + 1
        const aboveEntry = rank > 1 ? sorted[rank - 2] : null
        setConsultantRank({
          rank: rank || 1,
          totalConsultants: sorted.length,
          ecart: aboveEntry ? aboveEntry[1] - (rankings[fullName] || 0) + 1 : null,
        })
      }

      // Challenges / objectifs
      if (challenges.length > 0) {
        if (!isManager && consultantInfo?.id) {
          const my = challenges.find((c: Record<string, unknown>) => c.consultant_id === consultantInfo.id)
          if (my) setObjectif({ objectif: my.objectif as number, collecte: my.collecte as number })
        } else if (isManager) {
          const totalObj = challenges.reduce((s: number, c: Record<string, unknown>) => s + ((c.objectif as number) || 0), 0)
          const totalCol = challenges.reduce((s: number, c: Record<string, unknown>) => s + ((c.collecte as number) || 0), 0)
          if (totalObj > 0) setObjectif({ objectif: totalObj, collecte: totalCol })
        }
      }

      // Recent dossiers: use already-fetched data, sorted by date (avoid 2nd query)
      const sorted = [...filteredDossiers]
        .filter((d: any) => d.date_operation)
        .sort((a: any, b: any) => new Date(b.date_operation || '').getTime() - new Date(a.date_operation || '').getTime())
        .slice(0, 5)
      setRecentDossiers(sorted as any)

      // Pending invoices: use pre-filtered factures (already fetched with facturee=false)
      const factures = facturesRes.data || []
      if (factures.length > 0) {
        const dossierMap = new Map(filteredDossiers.map((d: any) => [d.id, d]))
        const pending = factures
          .slice(0, 5)
          .map((f: any) => ({ ...f, dossier: dossierMap.get(f.dossier_id as string) }))
          .filter((f: any) => f.dossier)
        setPendingInvoices(pending as any)
      }

      setLoading(false)
    }

    loadData()
  }, [isManager, consultantInfo])

  if (loading) {
    if (timedOut) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Impossible de charger les données. Vérifiez votre connexion et rechargez la page.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Recharger
            </button>
          </div>
        </div>
      )
    }
    return <SkeletonDashboard />
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-600 mt-1">Vue d&apos;ensemble de votre activité</p>
      </div>

      {/* Stats Cards */}
      <div className={`grid ${!isManager && consultantRank ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'} gap-6`}>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Collecte 2026</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(stats.collecte)}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CA Généré</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(stats.caGenere)}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <DollarSign className="text-blue-600" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pipeline en cours</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(stats.pipelineEnCours)}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="text-yellow-600" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Dossiers finalisés</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {stats.dossiersFinalisés}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <CheckCircle className="text-purple-600" size={24} />
            </div>
          </div>
        </Card>

        {!isManager && consultantRank && (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Mon classement</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {consultantRank.rank}/{consultantRank.totalConsultants}
                </p>
                {consultantRank.ecart !== null ? (
                  <p className="text-xs text-indigo-600 mt-1">
                    ↑ {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(consultantRank.ecart)} pour passer {consultantRank.rank - 1}e
                  </p>
                ) : (
                  <p className="text-xs text-green-600 mt-1">🏆 1ère position</p>
                )}
              </div>
              <div className="bg-indigo-100 p-3 rounded-lg">
                <Trophy className="text-indigo-600" size={24} />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Objectives + Projection + Relances row */}
      {(objectif || projection || relancesCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Objectif gauge */}
          {objectif && objectif.objectif > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-orange-100 p-2 rounded-lg">
                  <Target className="text-orange-600" size={20} />
                </div>
                <p className="text-sm font-medium text-gray-600">Objectif 2026</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Collecte</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(objectif.collecte)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      (objectif.collecte / objectif.objectif) >= 1 ? 'bg-green-500' :
                      (objectif.collecte / objectif.objectif) >= 0.7 ? 'bg-blue-500' :
                      (objectif.collecte / objectif.objectif) >= 0.4 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, (objectif.collecte / objectif.objectif) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{((objectif.collecte / objectif.objectif) * 100).toFixed(0)}% atteint</span>
                  <span>Objectif : {formatCurrency(objectif.objectif)}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Projection annuelle */}
          {projection && projection > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-cyan-100 p-2 rounded-lg">
                  <TrendingUp className="text-cyan-600" size={20} />
                </div>
                <p className="text-sm font-medium text-gray-600">Projection annuelle</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(projection)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Basée sur le rythme actuel ({new Date().toLocaleDateString('fr-FR', { month: 'long' })})
              </p>
              {objectif && objectif.objectif > 0 && (
                <p className={`text-xs mt-2 font-medium ${projection >= objectif.objectif ? 'text-green-600' : 'text-amber-600'}`}>
                  {projection >= objectif.objectif
                    ? `En avance de ${formatCurrency(projection - objectif.objectif)}`
                    : `Écart prévisionnel : ${formatCurrency(objectif.objectif - projection)}`}
                </p>
              )}
            </Card>
          )}

          {/* Relances badge */}
          {relancesCount > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-red-100 p-2 rounded-lg">
                  <AlertTriangle className="text-red-600" size={20} />
                </div>
                <p className="text-sm font-medium text-gray-600">Relances en attente</p>
              </div>
              <p className="text-2xl font-bold text-red-600">{relancesCount}</p>
              <p className="text-xs text-gray-500 mt-1">Actions requises (réglementaire, paiements, inactivité)</p>
              <a href="/dashboard/relances" className="text-xs text-indigo-600 hover:underline mt-2 inline-block">
                Voir les relances →
              </a>
            </Card>
          )}
        </div>
      )}

      {/* Content Grid */}
      <DashboardClient recentDossiers={recentDossiers} pendingInvoices={pendingInvoices} allFinalisedDossiers={allFinalisedDossiers} totalDossiers={totalDossiersCount} />
    </div>
  )
}
