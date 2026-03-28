'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { DollarSign, Users } from 'lucide-react'
import { RoleType } from '@/types/database'

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
  const isManager = role === 'manager'

  if (isManager) {
    // Manager view: all consultants consolidated
    const managerColumns: ColumnDefinition<any>[] = [
      {
        key: 'client_nom',
        label: 'Dossier (Client)',
        render: (_, row) =>
          `${row.client_prenom || ''} ${row.client_nom || ''}`.trim(),
      },
      {
        key: 'montant',
        label: 'Montant brut',
        render: (value) => formatCurrency(value),
      },
      {
        key: 'commission_brute',
        label: 'Commission brute',
        render: (value) => formatCurrency(value),
      },
      {
        key: 'rem_apporteur',
        label: 'Part Consultant',
        render: (value) => formatCurrency(value),
      },
      {
        key: 'rem_apporteur_ext',
        label: 'Part POOL+',
        render: (value) => formatCurrency(value),
      },
      {
        key: 'part_cabinet',
        label: 'Part Cabinet',
        render: (value) => formatCurrency(value),
      },
    ]

    const totals = React.useMemo(() => {
      return {
        totalCommission: dossiers.reduce((sum, d) => sum + (d.commission_brute || 0), 0),
        totalRemuneration: dossiers.reduce((sum, d) => sum + (d.rem_apporteur || 0), 0),
        totalCabinet: dossiers.reduce((sum, d) => sum + (d.part_cabinet || 0), 0),
      }
    }, [dossiers])

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rémunérations</h1>
          <p className="text-gray-600 mt-1">Vue consolidée de toutes les commissions</p>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users size={20} className="text-green-600" />
                Total rémunérations versées
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
              <CardTitle className="text-base">Part cabinet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(totals.totalCabinet)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Détail des commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={dossiers} columns={managerColumns} pageSize={10} />

            {/* Totals Row */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 font-bold text-gray-900">
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
                  <p className="text-xs text-gray-600">Total POOL+</p>
                  <p className="text-lg">
                    {formatCurrency(dossiers.reduce((sum, d) => sum + (d.rem_apporteur_ext || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total support</p>
                  <p className="text-lg">
                    {formatCurrency(dossiers.reduce((sum, d) => sum + (d.rem_support || 0), 0))}
                  </p>
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
    const consultantDossiers = React.useMemo(() => {
      return dossiers.filter((d) => d.consultant_nom === consultant?.nom)
    }, [dossiers, consultant])

    const consultantTotal = React.useMemo(() => {
      return consultantDossiers.reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)
    }, [consultantDossiers])

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

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ma Rémunération</h1>
          <p className="text-gray-600 mt-1">
            Mes commissions et rémunérations
          </p>
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
              Total de {consultantDossiers.length} dossier(s)
            </p>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Détail de mes dossiers</CardTitle>
          </CardHeader>
          <CardContent>
            {consultantDossiers.length > 0 ? (
              <DataTable data={consultantDossiers} columns={myCommissionsColumns} pageSize={10} />
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
