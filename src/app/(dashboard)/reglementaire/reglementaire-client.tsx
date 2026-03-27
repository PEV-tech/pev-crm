'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CheckCircle, AlertCircle } from 'lucide-react'

interface ReglementaireClientProps {
  initialData: any[]
}

const KYCBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; variant: any; color: string }> = {
    'non': { label: 'Non', variant: 'destructive', color: 'bg-red-100' },
    'en_cours': { label: 'En cours', variant: 'warning', color: 'bg-orange-100' },
    'oui': { label: 'Oui', variant: 'success', color: 'bg-green-100' },
  }

  const conf = config[status] || config['non']
  return (
    <Badge variant={conf.variant as any}>
      {conf.label}
    </Badge>
  )
}

const BoolBadge = ({ value }: { value: boolean | null }) => {
  return (
    <Badge variant={value ? 'success' : 'destructive'}>
      {value ? 'Oui' : 'Non'}
    </Badge>
  )
}

export function ReglementaireClient({ initialData }: ReglementaireClientProps) {
  const [data] = React.useState(initialData)
  const [filterIncomplete, setFilterIncomplete] = React.useState(false)

  const filteredData = React.useMemo(() => {
    if (!filterIncomplete) return data

    // Filter to show only incomplete dossiers (any field is false or non)
    return data.filter((d: any) => {
      const kycOk = d.statut_kyc === 'oui'
      const derOk = d.der === true
      const piOk = d.pi === true
      const lmOk = d.lm === true
      const rmOk = d.rm === true

      return !kycOk || !derOk || !piOk || !lmOk || !rmOk
    })
  }, [data, filterIncomplete])

  const stats = React.useMemo(() => {
    const compliant = data.filter((d: any) => {
      return (
        d.statut_kyc === 'oui' &&
        d.der === true &&
        d.pi === true &&
        d.lm === true &&
        d.rm === true
      )
    }).length

    const nonCompliant = data.length - compliant

    return { compliant, nonCompliant, total: data.length }
  }, [data])

  const columns: ColumnDefinition<any>[] = [
    {
      key: 'client_nom',
      label: 'Client',
      sortable: true,
      render: (_, row) =>
        `${row.client_prenom || ''} ${row.client_nom || ''}`.trim(),
    },
    {
      key: 'client_pays',
      label: 'Pays',
      sortable: true,
    },
    {
      key: 'statut_kyc',
      label: 'KYC',
      render: (value) => <KYCBadge status={value || 'non'} />,
    },
    {
      key: 'der',
      label: 'DER',
      render: (value) => <BoolBadge value={value} />,
    },
    {
      key: 'pi',
      label: 'PI',
      render: (value) => <BoolBadge value={value} />,
    },
    {
      key: 'lm',
      label: 'LM',
      render: (value) => <BoolBadge value={value} />,
    },
    {
      key: 'rm',
      label: 'RM',
      render: (value) => <BoolBadge value={value} />,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Réglementaire</h1>
        <p className="text-gray-600 mt-1">Statut de conformité des dossiers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle size={20} className="text-green-600" />
              Conformes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.compliant}</p>
            <p className="text-xs text-gray-600 mt-1">
              {stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle size={20} className="text-orange-600" />
              Non conformes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.nonCompliant}</p>
            <p className="text-xs text-gray-600 mt-1">
              {stats.total > 0 ? Math.round((stats.nonCompliant / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total dossiers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              id="filterIncomplete"
              checked={filterIncomplete}
              onChange={(e) => setFilterIncomplete(e.target.checked)}
              className="w-4 h-4 rounded border border-gray-300 cursor-pointer"
            />
            <label htmlFor="filterIncomplete" className="text-sm font-medium text-gray-700 cursor-pointer">
              Afficher uniquement les dossiers incomplets
            </label>
          </div>
        </CardHeader>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Détails de conformité {filterIncomplete && `(${filteredData.length} incomplet(s))`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Légende</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-900">KYC</p>
              <p className="text-gray-600">Know Your Customer</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">DER</p>
              <p className="text-gray-600">Document d&apos;inscription</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">PI</p>
              <p className="text-gray-600">Pièce d&apos;identité</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">LM</p>
              <p className="text-gray-600">Lutte contre le blanchiment</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">RM</p>
              <p className="text-gray-600">Rapport de conformité</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
