'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { DollarSign, Users, TrendingUp, Download } from 'lucide-react'
import { RoleType } from '@/types/database'
import { exportCSV, getExportFilename, formatCurrencyForCSV } from '@/lib/export-csv'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

interface RemunerationsClientProps {
  dossiers: any[]
  consultant: any
  role: RoleType | null
}

export function RemunerationsClient({
  dossiers,
  consultant,
  role,
}: RemunerationsClientProps) {
  const isManager = role === 'manager' || role === 'back_office'

  if (isManager) {
    // Manager view: consolidated by consultant + detail
    const byConsultant = React.useMemo(() => {
      const map: Record<string, { name: string; dossiers: any[]; totalCommission: number; totalRemuneration: number; totalCabinet: number }> = {}
      dossiers.forEach(d => {
        const name = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim() || 'Non attribué'
        if (!map[name]) {
          map[name] = { name, dossiers: [], totalCommission: 0, totalRemuneration: 0, totalCabinet: 0 }
        }
        map[name].dossiers.push(d)
        map[name].totalCommission += d.commission_brute || 0
        map[name].totalRemuneration += d.rem_apporteur || 0
        map[name].totalCabinet += d.part_cabinet || 0
      })
      return Object.values(map).sort((a, b) => b.totalCommission - a.totalCommission)
    }, [dossiers])

    const totals = React.useMemo(() => ({
      totalCommission: dossiers.reduce((sum, d) => sum + (d.commission_brute || 0), 0),
      totalRemuneration: dossiers.reduce((sum, d) => sum + (d.rem_apporteur || 0), 0),
      totalCabinet: dossiers.reduce((sum, d) => sum + (d.part_cabinet || 0), 0),
    }), [dossiers])

    const managerColumns: ColumnDefinition<any>[] = [
      {
        key: 'client_nom',
        label: 'Dossier (Client)',
        render: (_, row) =>
          `${row.client_prenom || ''} ${row.client_nom || ''}`.trim(),
      },
      {
        key: 'consultant_nom',
        label: 'Consultant',
        sortable: true,
        render: (_, row) =>
          `${row.consultant_prenom || ''} ${row.consultant_nom || ''}`.trim(),
      },
      {
        key: 'montant',
        label: 'Montant brut',
        sortable: true,
        render: (value) => formatCurrency(value),
      },
      {
        key: 'commission_brute',
        label: 'Commission brute',
        sortable: true,
        render: (value) => formatCurrency(value),
      },
      {
        key: 'rem_apporteur',
        label: 'Part Consultant',
        render: (value) => formatCurrency(value),
      },
      {
        key: 'part_cabinet',
        label: 'Part Cabinet',
        render: (value) => formatCurrency(value),
      },
    ]

    const handleExportCSV = React.useCallback(() => {
      const exportData = dossiers.map((d) => ({
        client: `${d.client_prenom || ''} ${d.client_nom || ''}`.trim(),
        consultant: `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim(),
        montant: formatCurrencyForCSV(d.montant),
        commission_brute: formatCurrencyForCSV(d.commission_brute),
        rem_apporteur: formatCurrencyForCSV(d.rem_apporteur),
        part_cabinet: formatCurrencyForCSV(d.part_cabinet),
      }))

      const columns = [
        { key: 'client', label: 'Client' },
        { key: 'consultant', label: 'Consultant' },
        { key: 'montant', label: 'Montant brut (EUR)' },
        { key: 'commission_brute', label: 'Commission brute (EUR)' },
        { key: 'rem_apporteur', label: 'Part Consultant (EUR)' },
        { key: 'part_cabinet', label: 'Part Cabinet (EUR)' },
      ]

      exportCSV(exportData, columns, {
        filename: getExportFilename('remunerations_export'),
        separator: ';',
      })
    }, [dossiers])

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rémunérations</h1>
            <p className="text-gray-600 mt-1">Vue consolidée de toutes les commissions</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportCSV}
          >
            <Download size={18} />
            Exporter CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign size={20} className="text-blue-600" />
                Total commissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(totals.totalCommission)}
              </p>
              <p className="text-sm text-gray-500 mt-1">{dossiers.length} dossier(s) finalisé(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users size={20} className="text-green-600" />
                Total rémunérations consultants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(totals.totalRemuneration)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp size={20} className="text-purple-600" />
                Part cabinet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(totals.totalCabinet)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Par consultant */}
        <Card>
          <CardHeader>
            <CardTitle>Récapitulatif par consultant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byConsultant.map((c) => (
                <div key={c.name} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-500">{c.dossiers.length} dossier(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(c.totalCommission)}</p>
                    <p className="text-sm text-gray-500">Part consultant : {formatCurrency(c.totalRemuneration)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detail Table */}
        <Card>
          <CardHeader>
            <CardTitle>Détail des commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={dossiers} columns={managerColumns} pageSize={15} />

            {/* Totals Row */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-bold text-gray-900">
                <div>
                  <p className="text-xs text-gray-600">Total montant</p>
                  <p className="text-lg">
                    {formatCurrency(dossiers.reduce((sum, d) => sum + (d.montant || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total commission</p>
                  <p className="text-lg">{formatCurrency(totals.totalCommission)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total consultant</p>
                  <p className="text-lg">{formatCurrency(totals.totalRemuneration)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total cabinet</p>
                  <p className="text-lg">{formatCurrency(totals.totalCabinet)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  } else {
    // Consultant view: only their own commissions
    const consultantTotal = React.useMemo(() => {
      return dossiers.reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)
    }, [dossiers])

    const myCommissionsColumns: ColumnDefinition<any>[] = [
      {
        key: 'client_nom',
        label: 'Client',
        render: (_, row) =>
          `${row.client_prenom || ''} ${row.client_nom || ''}`.trim(),
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
        key: 'commission_brute',
        label: 'Commission brute',
        render: (value) => formatCurrency(value),
      },
      {
        key: 'rem_apporteur',
        label: 'Ma commission',
        render: (value) => formatCurrency(value),
      },
    ]

    const handleExportCSVConsultant = React.useCallback(() => {
      const exportData = dossiers.map((d) => ({
        client: `${d.client_prenom || ''} ${d.client_nom || ''}`.trim(),
        produit: d.produit_nom || '',
        compagnie: d.compagnie_nom || '',
        montant: formatCurrencyForCSV(d.montant),
        commission_brute: formatCurrencyForCSV(d.commission_brute),
        rem_apporteur: formatCurrencyForCSV(d.rem_apporteur),
      }))

      const columns = [
        { key: 'client', label: 'Client' },
        { key: 'produit', label: 'Produit' },
        { key: 'compagnie', label: 'Compagnie' },
        { key: 'montant', label: 'Montant (EUR)' },
        { key: 'commission_brute', label: 'Commission brute (EUR)' },
        { key: 'rem_apporteur', label: 'Ma commission (EUR)' },
      ]

      exportCSV(exportData, columns, {
        filename: getExportFilename('mes_commissions_export'),
        separator: ';',
      })
    }, [dossiers])

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ma Rémunération</h1>
            <p className="text-gray-600 mt-1">
              Mes commissions et rémunérations
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportCSVConsultant}
          >
            <Download size={18} />
            Exporter CSV
          </Button>
        </div>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign size={20} className="text-green-600" />
              Mes commissions totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-gray-900">
              {formatCurrency(consultantTotal)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Total de {dossiers.length} dossier(s)
            </p>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Détail de mes dossiers</CardTitle>
          </CardHeader>
          <CardContent>
            {dossiers.length > 0 ? (
              <DataTable data={dossiers} columns={myCommissionsColumns} pageSize={10} />
            ) : (
              <p className="text-center text-gray-500 py-6">
                Aucun dossier attribué
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }
}
