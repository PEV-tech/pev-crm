'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { TrendingUp } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

interface EncaissementsClientProps {
  initialData: any[]
}

export function EncaissementsClient({ initialData }: EncaissementsClientProps) {
  const [data] = React.useState(initialData)

  // Group by month
  const groupedByMonth = React.useMemo(() => {
    const groups: Record<string, any[]> = {}

    data.forEach((item: any) => {
      if (item.date_paiement) {
        const date = new Date(item.date_paiement)
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`
        const monthName = monthNames[date.getMonth()] + ' ' + date.getFullYear()

        if (!groups[monthKey]) {
          groups[monthKey] = []
        }
        groups[monthKey].push({ ...item, monthName })
      }
    })

    return Object.entries(groups).sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
  }, [data])

  // Calculate totals
  const totals = React.useMemo(() => {
    let totalMontant = 0
    let totalCommission = 0

    data.forEach((item: any) => {
      totalMontant += item.dossier?.montant || 0
      totalCommission += item.dossier?.commission_brute || 0
    })

    return { totalMontant, totalCommission }
  }, [data])

  const columns: ColumnDefinition<any>[] = [
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
      key: 'dossier.compagnie_nom',
      label: 'Compagnie',
      render: (_, row) => row.dossier?.compagnie_nom || '-',
    },
    {
      key: 'dossier.montant',
      label: 'Montant',
      render: (_, row) => formatCurrency(row.dossier?.montant),
    },
    {
      key: 'dossier.commission_brute',
      label: 'Commission',
      render: (_, row) => formatCurrency(row.dossier?.commission_brute),
    },
    {
      key: 'date_paiement',
      label: 'Date paiement',
      render: (value) => {
        if (!value) return '-'
        return new Date(value).toLocaleDateString('fr-FR')
      },
    },
    {
      key: 'dossier.consultant_nom',
      label: 'Consultant',
      render: (_, row) =>
        row.dossier?.consultant_prenom && row.dossier?.consultant_nom
          ? `${row.dossier.consultant_prenom} ${row.dossier.consultant_nom}`
          : '-',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Encaissements</h1>
        <p className="text-gray-600 mt-1">Paiements reçus par mois</p>
      </div>

      {/* YTD Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp size={20} className="text-green-600" />
              Total collecté
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(totals.totalMontant)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(totals.totalCommission)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Sections */}
      {groupedByMonth.length > 0 ? (
        <div className="space-y-6">
          {groupedByMonth.map(([monthKey, monthData]: [string, any[]]) => {
            const monthTotal = monthData.reduce((sum, item) => sum + (item.dossier?.montant || 0), 0)
            const commissionTotal = monthData.reduce(
              (sum, item) => sum + (item.dossier?.commission_brute || 0),
              0
            )

            return (
              <Card key={monthKey}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {monthData[0].monthName}
                    </CardTitle>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total du mois</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(monthTotal)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <DataTable
                    data={monthData}
                    columns={columns}
                    pageSize={10}
                  />
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Total du mois</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(monthTotal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Commissions du mois</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(commissionTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">Aucun encaissement disponible</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
