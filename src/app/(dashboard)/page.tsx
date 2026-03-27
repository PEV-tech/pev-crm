import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardClient } from './dashboard-client'
import { TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0 €'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

async function getRecentDossiers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_dossiers_complets')
    .select('*')
    .order('date_operation', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching recent dossiers:', error)
    return []
  }

  return data || []
}

async function getPendingInvoices() {
  const supabase = await createClient()
  const { data: dossiers, error: dossiersError } = await supabase
    .from('v_dossiers_complets')
    .select('*')

  if (dossiersError) {
    console.error('Error fetching dossiers:', dossiersError)
    return []
  }

  const { data: factures, error: facturesError } = await supabase
    .from('factures')
    .select('*')

  if (facturesError) {
    console.error('Error fetching factures:', facturesError)
    return []
  }

  // Filter dossiers where facturee=false
  const pendingFacures = factures
    .filter((f: any) => !f.facturee)
    .slice(0, 5)

  return pendingFacures.map((f: any) => {
    const dossier = dossiers?.find((d: any) => d.id === f.dossier_id)
    return { ...f, dossier }
  })
}

async function getStats() {
  const supabase = await createClient()

  // Get all dossiers for stats
  const { data: dossiers, error: dossiersError } = await supabase
    .from('v_dossiers_complets')
    .select('*')

  if (dossiersError) {
    console.error('Error:', dossiersError)
    return { collecte: 0, caGenere: 0, pipelineEnCours: 0, dossiersFinalisés: 0 }
  }

  const collecte = dossiers
    ?.filter((d: any) => d.statut === 'client_finalise')
    .reduce((sum: number, d: any) => sum + (d.montant || 0), 0) || 0

  const pipelineEnCours = dossiers
    ?.filter((d: any) => d.statut === 'client_en_cours')
    .reduce((sum: number, d: any) => sum + (d.montant || 0), 0) || 0

  const caGenere = dossiers
    ?.reduce((sum: number, d: any) => sum + (d.commission_brute || 0), 0) || 0

  const dossiersFinalisés = dossiers?.filter((d: any) => d.statut === 'client_finalise').length || 0

  return { collecte, caGenere, pipelineEnCours, dossiersFinalisés }
}

export default async function DashboardPage() {
  const [stats, recentDossiers, pendingInvoices] = await Promise.all([
    getStats(),
    getRecentDossiers(),
    getPendingInvoices(),
  ])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-600 mt-1">Vue d&apos;ensemble de votre activité</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      </div>

      {/* Content Grid */}
      <DashboardClient recentDossiers={recentDossiers} pendingInvoices={pendingInvoices} />
    </div>
  )
}
