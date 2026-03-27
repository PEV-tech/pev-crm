'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { BarChart3, AlertCircle } from 'lucide-react'

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

export function DashboardClient({ recentDossiers, pendingInvoices }: DashboardClientProps) {
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
      {/* Chart Placeholder */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 size={20} />
            Collecte par mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="mb-2">Graphique recharts</p>
              <p className="text-xs">À implémenter avec la bibliothèque recharts</p>
            </div>
          </div>
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
