'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { BarChart3, AlertCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { VDossiersComplets } from '@/types/database'

// Lazy-load Recharts to reduce initial bundle size
const RechartsBarChart = dynamic(
  () => import('recharts').then(mod => ({ default: mod.BarChart })),
  { ssr: false }
)
const Bar = dynamic(() => import('recharts').then(mod => ({ default: mod.Bar })), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => ({ default: mod.XAxis })), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => ({ default: mod.YAxis })), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => ({ default: mod.CartesianGrid })), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => ({ default: mod.Tooltip })), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })), { ssr: false })

import { formatCurrency } from '@/lib/formatting'

interface PendingInvoice extends Record<string, unknown> {
  dossier?: VDossiersComplets
  date_facture?: string | null
}

interface ConsultantBreakdown {
  nom: string
  montant: number
  dossiers: number
  commission: number
}

interface MonthData {
  name: string
  collecte: number
  breakdown: ConsultantBreakdown[]
}

interface DashboardClientProps {
  recentDossiers: VDossiersComplets[]
  pendingInvoices: PendingInvoice[]
  allFinalisedDossiers?: VDossiersComplets[]
  totalDossiers?: number
  isManager?: boolean
}

const monthLabels = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
]

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload?: MonthData }>; label?: string }) => {
  if (active && payload && payload[0]) {
    const data = payload[0].payload as MonthData | undefined
    const total = payload[0].value
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(total)

    const breakdown = data?.breakdown || []

    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-xl text-sm min-w-[220px]">
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
          <span className="font-semibold text-gray-700">{label}</span>
          <span className="font-bold text-indigo-700">{formatted}</span>
        </div>
        {breakdown.length > 0 ? (
          <div className="space-y-1.5">
            {breakdown.map((c, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <span className="text-gray-600 truncate mr-3">{c.nom} <span className="text-gray-400">({c.dossiers})</span></span>
                <span className="font-medium text-gray-900 whitespace-nowrap">{formatCurrency(c.montant)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Aucune opération</p>
        )}
      </div>
    )
  }
  return null
}

export function DashboardClient({ recentDossiers, pendingInvoices, allFinalisedDossiers = [], totalDossiers, isManager }: DashboardClientProps) {
  // Calculate collecte by month with per-consultant breakdown
  const collecteParMois = useMemo(() => {
    const monthlyData: Record<number, number> = {}
    const monthlyBreakdown: Record<number, Record<string, ConsultantBreakdown>> = {}

    for (let i = 0; i < 12; i++) {
      monthlyData[i] = 0
      monthlyBreakdown[i] = {}
    }

    const source = allFinalisedDossiers.length > 0 ? allFinalisedDossiers : recentDossiers
    source.forEach((dossier) => {
      if (dossier.date_operation) {
        const date = new Date(dossier.date_operation)
        const month = date.getMonth()
        const montant = dossier.montant || 0
        monthlyData[month] += montant

        // Build per-consultant breakdown
        const consultantName = `${dossier.consultant_prenom || ''} ${dossier.consultant_nom || ''}`.trim() || 'Inconnu'
        if (!monthlyBreakdown[month][consultantName]) {
          monthlyBreakdown[month][consultantName] = { nom: consultantName, montant: 0, dossiers: 0, commission: 0 }
        }
        monthlyBreakdown[month][consultantName].montant += montant
        monthlyBreakdown[month][consultantName].dossiers += 1
        monthlyBreakdown[month][consultantName].commission += dossier.commission_brute || 0
      }
    })

    return monthLabels.map((label, index) => ({
      name: label,
      collecte: monthlyData[index],
      breakdown: Object.values(monthlyBreakdown[index]).sort((a, b) => b.montant - a.montant),
    }))
  }, [allFinalisedDossiers, recentDossiers])
  const dossiersColumns: ColumnDefinition<VDossiersComplets>[] = [
    {
      key: 'client_nom',
      label: 'Client',
      render: (_, row) => `${row.client_prenom || ''} ${row.client_nom || ''}`.trim(),
    },
    {
      key: 'produit_nom',
      label: 'Produit',
    },
    {
      key: 'compagnie_nom',
      label: 'Compagnie',
    },
    {
      key: 'montant',
      label: 'Montant',
      render: (value) => formatCurrency(value),
    },
    {
      key: 'date_operation',
      label: 'Date',
      render: (value) => {
        if (!value) return '-'
        return new Date(value).toLocaleDateString('fr-FR')
      },
    },
  ]

  const invoicesColumns: ColumnDefinition<PendingInvoice>[] = [
    {
      key: 'dossier.client_nom',
      label: 'Client',
      render: (_, row) =>
        `${row.dossier?.client_prenom || ''} ${row.dossier?.client_nom || ''}`.trim(),
    },
    {
      key: 'dossier.produit_nom',
      label: 'Produit',
      render: (_, row) => row.dossier?.produit_nom || '-',
    },
    {
      key: 'dossier.montant',
      label: 'Montant',
      render: (_, row) => formatCurrency(row.dossier?.montant),
    },
    {
      key: 'date_facture',
      label: 'Date de facture',
      render: (value) => {
        if (!value) return '-'
        return new Date(value).toLocaleDateString('fr-FR')
      },
    },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 size={20} />
            Collecte par mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsBarChart
              data={collecteParMois}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                width={80}
                tickFormatter={(value) =>
                  new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(value)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="collecte"
                fill="#4f46e5"
                radius={[8, 8, 0, 0]}
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total dossiers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{totalDossiers ?? recentDossiers.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Factures en attente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{pendingInvoices.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Dossiers Table */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Derniers dossiers</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={recentDossiers}
            columns={dossiersColumns}
            pageSize={5}
          />
        </CardContent>
      </Card>

      {/* Pending Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle size={18} className="text-orange-500" />
            Factures en attente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInvoices.length > 0 ? (
            <div className="space-y-3">
              {pendingInvoices.slice(0, 5).map((invoice, idx) => (
                <div key={idx} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="font-medium text-sm text-gray-900">
                    {invoice.dossier?.client_prenom} {invoice.dossier?.client_nom}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {formatCurrency(invoice.dossier?.montant)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucune facture en attente</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
