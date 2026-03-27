'use client'

import * as React from 'react'
import { VDossiersComplets } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Users, TrendingUp, CheckCircle } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

interface MaClienteleClientProps {
  initialData: VDossiersComplets[]
  consultant: any
}

export function MaClienteleClient({ initialData, consultant }: MaClienteleClientProps) {
  const [data] = React.useState(initialData)
  const [activeTab, setActiveTab] = React.useState('tous')

  const stats = React.useMemo(() => {
    const totalDossiers = data.length
    const enCours = data.filter((d) => d.statut === 'client_en_cours').length
    const finalisés = data.filter((d) => d.statut === 'client_finalise').length

    const pipelineTotal = data
      .filter((d) => d.statut === 'client_en_cours')
      .reduce((sum, d) => sum + (d.montant || 0), 0)

    const collecteTotal = data
      .filter((d) => d.statut === 'client_finalise')
      .reduce((sum, d) => sum + (d.montant || 0), 0)

    return {
      totalDossiers,
      enCours,
      finalisés,
      pipelineTotal,
      collecteTotal,
    }
  }, [data])

  const filteredData = React.useMemo(() => {
    if (activeTab === 'tous') return data
    if (activeTab === 'en_cours') return data.filter((d) => d.statut === 'client_en_cours')
    if (activeTab === 'finalises') return data.filter((d) => d.statut === 'client_finalise')
    return data
  }, [data, activeTab])

  const columns: ColumnDefinition<VDossiersComplets>[] = [
    {
      key: 'client_nom',
      label: 'Client',
      sortable: true,
      render: (_, row) =>
        `${row.client_prenom || ''} ${row.client_nom || ''}`.trim(),
    },
    {
      key: 'produit_nom',
      label: 'Produit',
      sortable: true,
    },
    {
      key: 'compagnie_nom',
      label: 'Compagnie',
      sortable: true,
    },
    {
      key: 'montant',
      label: 'Montant',
      sortable: true,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'financement',
      label: 'Financement',
      sortable: true,
    },
    {
      key: 'date_operation',
      label: 'Date',
      sortable: true,
      render: (value) => {
        if (!value) return '-'
        return new Date(value).toLocaleDateString('fr-FR')
      },
    },
    {
      key: 'statut',
      label: 'Statut',
      sortable: true,
      render: (value) => (
        <StatusBadge
          status={(value as 'prospect' | 'client_en_cours' | 'client_finalise') || 'prospect'}
          type="dossier"
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ma Clientèle</h1>
        <p className="text-gray-600 mt-1">
          Mes dossiers et clients
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users size={20} className="text-blue-600" />
              Total dossiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.totalDossiers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp size={20} className="text-yellow-600" />
              Pipeline en cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(stats.pipelineTotal)}
            </p>
            <p className="text-xs text-gray-600 mt-1">({stats.enCours} dossier(s))</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle size={20} className="text-green-600" />
              Finalisés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(stats.collecteTotal)}
            </p>
            <p className="text-xs text-gray-600 mt-1">({stats.finalisés} dossier(s))</p>
          </CardContent>
        </Card>
      </div>

      {/* Table with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Mes dossiers</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="tous"
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="tous">Tous ({stats.totalDossiers})</TabsTrigger>
              <TabsTrigger value="en_cours">En cours ({stats.enCours})</TabsTrigger>
              <TabsTrigger value="finalises">Finalisés ({stats.finalisés})</TabsTrigger>
            </TabsList>

            <TabsContent value="tous">
              <DataTable data={filteredData} columns={columns} pageSize={10} />
            </TabsContent>

            <TabsContent value="en_cours">
              <DataTable data={filteredData} columns={columns} pageSize={10} />
            </TabsContent>

            <TabsContent value="finalises">
              <DataTable data={filteredData} columns={columns} pageSize={10} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
