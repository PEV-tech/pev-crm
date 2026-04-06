'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { BarChart3, AlertCircle } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

interface DashboardClientProps {
  recentDossiers: any[]
  pendingInvoices: any[]
}

const monthLabels = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
]

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload[0]) {
    const value = payload[0].value
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value)
    return (
      <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-sm text-gray-900">
        {formatted}
      </div>
    )
  }
  return null
}

export function DashboardClient({ recentDossiers, pendingInvoices }: DashboardClientProps) {
  // Calculate collecte by month (only finalized dossiers)
  const collecteParMois = useMemo(() => {
    const monthlyData: Record<number, number> = {}

    // Initialize all months to 0
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = 0
    }

    // Sum up collecte by month for finalized dossiers only
    recentDossiers.forEach((dossier) => {
      if (dossier.statut === 'client_finalise' && dossier.date_operation) {
        const date = new Date(dossier.date_operation)
        const month = date.getMonth()
        monthlyData[month] += dossier.montant || 0
      }
    })

    // Transform to recharts format
    return monthLabels.map((label, index) => ({
      name: label,
      collecte: monthlyData[index],
    }))
  }, [recentDossiers])
  const dossiersColumns: ColumnDefinition<any>[] = [
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

  const invoicesColumns: ColumnDefinition<any>[] = [
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
            <BarChart
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
            </BarChart>
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
            <p className="text-3xl font-bold text-gray-900">{recentDossiers.length}</p>
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
