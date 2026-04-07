'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { useRole, useConsultantInfo } from '@/hooks/use-user'
import { DashboardClient } from './dashboard-client'
import { TrendingUp, DollarSign, Clock, CheckCircle, Trophy } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0 €'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export default function DashboardPage() {
  const role = useRole()
  const consultantInfo = useConsultantInfo()
  const isManager = role === 'manager' || role === 'back_office'

  const [stats, setStats] = useState({ collecte: 0, caGenere: 0, pipelineEnCours: 0, dossiersFinalisés: 0 })
  const [allFinalisedDossiers, setAllFinalisedDossiers] = useState<any[]>([])
  const [recentDossiers, setRecentDossiers] = useState<any[]>([])
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([])
  const [consultantRank, setConsultantRank] = useState<{ rank: number; totalConsultants: number; ecart: number | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()

      // Get all dossiers for stats
      const { data: dossiers } = await supabase
        .from('v_dossiers_complets')
        .select('*')

      if (dossiers) {
        let filteredDossiers = dossiers

        // If consultant, filter by their name
        if (!isManager && consultantInfo?.name) {
          const fullName = consultantInfo.name
          filteredDossiers = dossiers.filter((d: any) => {
            const dossierConsultant = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
            return dossierConsultant === fullName
          })
        }

        const collecte = filteredDossiers
          .filter((d: any) => d.statut === 'client_finalise')
          .reduce((sum: number, d: any) => sum + (d.montant || 0), 0)

        const pipelineEnCours = filteredDossiers
          .filter((d: any) => d.statut === 'client_en_cours')
          .reduce((sum: number, d: any) => sum + (d.montant || 0), 0)

        const caGenere = filteredDossiers
          .reduce((sum: number, d: any) => sum + (d.commission_brute || 0), 0)

        const dossiersFinalisés = filteredDossiers.filter((d: any) => d.statut === 'client_finalise').length

        setStats({ collecte, caGenere, pipelineEnCours, dossiersFinalisés })

        // Store all finalized dossiers for the monthly chart
        setAllFinalisedDossiers(filteredDossiers.filter((d: any) => d.statut === 'client_finalise'))

        // Calculate consultant ranking if not a manager
        if (!isManager && consultantInfo?.name) {
          const consultantRankings: Record<string, number> = {}

          dossiers.forEach((d: any) => {
            const dossierConsultant = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
            if (d.statut === 'client_finalise' && dossierConsultant) {
              consultantRankings[dossierConsultant] = (consultantRankings[dossierConsultant] || 0) + (d.montant || 0)
            }
          })

          const sortedConsultants = Object.entries(consultantRankings)
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name)

          const sortedEntries = Object.entries(consultantRankings)
            .sort((a, b) => b[1] - a[1])
          const rank = sortedEntries.findIndex(([name]) => name === consultantInfo.name) + 1
          const myCollecte = consultantRankings[consultantInfo.name] || 0
          const aboveEntry = rank > 1 ? sortedEntries[rank - 2] : null
          const ecart = aboveEntry ? aboveEntry[1] - myCollecte + 1 : null
          setConsultantRank({
            rank,
            totalConsultants: sortedEntries.length,
            ecart,
          })
        }
      }

      // Get recent dossiers
      let recentQuery = supabase
        .from('v_dossiers_complets')
        .select('*')
        .order('date_operation', { ascending: false })
        .limit(5)

      // If consultant, filter by their name
      if (!isManager && consultantInfo?.name) {
        const fullName = consultantInfo.name
        const { data: recent } = await supabase
          .from('v_dossiers_complets')
          .select('*')
          .order('date_operation', { ascending: false })
          .limit(100)

        const filtered = (recent || []).filter((d: any) => {
          const dossierConsultant = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
          return dossierConsultant === fullName
        }).slice(0, 5)

        setRecentDossiers(filtered)
      } else {
        const { data: recent } = await recentQuery
        setRecentDossiers(recent || [])
      }

      // Get pending invoices
      const { data: factures } = await supabase
        .from('factures')
        .select('*')

      if (factures && dossiers) {
        let invoiceDossiers = dossiers

        // If consultant, filter by their name
        if (!isManager && consultantInfo?.name) {
          const fullName = consultantInfo.name
          invoiceDossiers = dossiers.filter((d: any) => {
            const dossierConsultant = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
            return dossierConsultant === fullName
          })
        }

        const pending = factures
          .filter((f: any) => !f.facturee)
          .slice(0, 5)
          .map((f: any) => {
            const dossier = invoiceDossiers.find((d: any) => d.id === f.dossier_id)
            return { ...f, dossier }
          })
          .filter((f: any) => f.dossier)
        setPendingInvoices(pending)
      }

      setLoading(false)
    }

    loadData()
  }, [isManager, consultantInfo])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
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

      {/* Content Grid */}
      <DashboardClient recentDossiers={recentDossiers} pendingInvoices={pendingInvoices} allFinalisedDossiers={allFinalisedDossiers} />
    </div>
  )
}
