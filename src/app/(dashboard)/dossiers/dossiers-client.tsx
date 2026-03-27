'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { VDossiersComplets, StatutDossierType } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Plus } from 'lucide-react'

interface DossiersClientProps {
  initialData: VDossiersComplets[]
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const mapStatutForBadge = (statut: StatutDossierType | null | undefined): 'prospect' | 'client_en_cours' | 'client_finalise' => {
  return (statut as 'prospect' | 'client_en_cours' | 'client_finalise') || 'prospect'
}

export function DossiersClient({ initialData }: DossiersClientProps) {
  const router = useRouter()
  const [data] = React.useState(initialData)
  const [activeTab, setActiveTab] = React.useState('tous')
  const [filterProduit, setFilterProduit] = React.useState('')
  const [filterPays, setFilterPays] = React.useState('')
  const [filterConsultant, setFilterConsultant] = React.useState('')

  // Filter data based on active tab and filters
  const filteredData = React.useMemo(() => {
    let result = data

    // Filter by statut
    if (activeTab !== 'tous') {
      result = result.filter((d) => {
        if (activeTab === 'prospects') return d.statut === 'prospect'
        if (activeTab === 'en_cours') return d.statut === 'client_en_cours'
        if (activeTab === 'finalises') return d.statut === 'client_finalise'
        return true
      })
    }

    // Filter by produit
    if (filterProduit) {
      result = result.filter((d) => d.produit_nom === filterProduit)
    }

    // Filter by pays
    if (filterPays) {
      result = result.filter((d) => d.client_pays === filterPays)
    }

    // Filter by consultant
    if (filterConsultant) {
      result = result.filter((d) => {
        const consultantName = `${d.consultant_prenom} ${d.consultant_nom}`
        return consultantName === filterConsultant
      })
    }

    return result
  }, [data, activeTab, filterProduit, filterPays, filterConsultant])

  // Get unique values for filters
  const produits = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.produit_nom).filter(Boolean) as string[])).sort(),
    [data]
  )
  const pays = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.client_pays).filter(Boolean) as string[])).sort(),
    [data]
  )
  const consultants = React.useMemo(
    () =>
      Array.from(new Set(
        data
          .map((d) => `${d.consultant_prenom} ${d.consultant_nom}`)
          .filter(Boolean)
      )).sort(),
    [data]
  )

  // Calculate stats
  const stats = React.useMemo(() => {
    const counts = {
      tous: data.length,
      prospects: data.filter((d) => d.statut === 'prospect').length,
      en_cours: data.filter((d) => d.statut === 'client_en_cours').length,
      finalises: data.filter((d) => d.statut === 'client_finalise').length,
    }

    const totalMontant = data.reduce((sum, d) => sum + (d.montant || 0), 0)

    return { counts, totalMontant }
  }, [data])

  // Table columns
  const columns: ColumnDefinition<VDossiersComplets>[] = [
    {
      key: 'client_nom',
      label: 'Client',
      sortable: true,
      render: (_, row) => (
        <div className="text-sm">
          {row.client_prenom} {row.client_nom}
        </div>
      ),
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
      key: 'client_pays',
      label: 'Pays',
      sortable: true,
    },
    {
      key: 'consultant_nom',
      label: 'Consultant',
      sortable: true,
      render: (_, row) =>
        row.consultant_prenom && row.consultant_nom
          ? `${row.consultant_prenom} ${row.consultant_nom}`
          : '-',
    },
    {
      key: 'statut',
      label: 'Statut',
      sortable: true,
      render: (value) => (
        <StatusBadge status={mapStatutForBadge(value)} type="dossier" />
      ),
    },
    {
      key: 'statut_kyc',
      label: 'KYC',
      sortable: true,
      render: (value) => (
        <StatusBadge status={value as 'non' | 'en_cours' | 'oui'} type="kyc" />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dossiers</h1>
          <p className="text-gray-600 mt-1">Gérez votre pipeline de dossiers</p>
        </div>
        <Link href="/dossiers/nouveau">
          <Button className="gap-2">
            <Plus size={18} />
            Nouveau dossier
          </Button>
        </Link>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600">Total dossiers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats.counts.tous}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Montant total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(stats.totalMontant)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">En cours</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats.counts.en_cours}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Finalisés</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats.counts.finalises}
          </p>
        </Card>
      </div>

      {/* Tabs and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Dossiers</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="tous"
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="tous">Tous ({stats.counts.tous})</TabsTrigger>
              <TabsTrigger value="prospects">
                Prospects ({stats.counts.prospects})
              </TabsTrigger>
              <TabsTrigger value="en_cours">
                En cours ({stats.counts.en_cours})
              </TabsTrigger>
              <TabsTrigger value="finalises">
                Finalisés ({stats.counts.finalises})
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <Select
                value={filterProduit}
                onChange={(e) => setFilterProduit(e.target.value)}
                className="max-w-sm"
              >
                <option value="">Tous les produits</option>
                {produits.map((produit) => (
                  <option key={produit} value={produit}>
                    {produit}
                  </option>
                ))}
              </Select>

              <Select
                value={filterPays}
                onChange={(e) => setFilterPays(e.target.value)}
                className="max-w-sm"
              >
                <option value="">Tous les pays</option>
                {pays.map((pays) => (
                  <option key={pays} value={pays}>
                    {pays}
                  </option>
                ))}
              </Select>

              <Select
                value={filterConsultant}
                onChange={(e) => setFilterConsultant(e.target.value)}
                className="max-w-sm"
              >
                <option value="">Tous les consultants</option>
                {consultants.map((consultant) => (
                  <option key={consultant} value={consultant}>
                    {consultant}
                  </option>
                ))}
              </Select>
            </div>

            <TabsContent value="tous" className="mt-4">
              <DataTable
                data={filteredData}
                columns={columns}
                onRowClick={(row) => {
                  if (row.id) {
                    router.push(`/dossiers/${row.id}`)
                  }
                }}
                pageSize={10}
              />
            </TabsContent>

            <TabsContent value="prospects" className="mt-4">
              <DataTable
                data={filteredData}
                columns={columns}
                onRowClick={(row) => {
                  if (row.id) {
                    router.push(`/dossiers/${row.id}`)
                  }
                }}
                pageSize={10}
              />
            </TabsContent>

            <TabsContent value="en_cours" className="mt-4">
              <DataTable
                data={filteredData}
                columns={columns}
                onRowClick={(row) => {
                  if (row.id) {
                    router.push(`/dossiers/${row.id}`)
                  }
                }}
                pageSize={10}
              />
            </TabsContent>

            <TabsContent value="finalises" className="mt-4">
              <DataTable
                data={filteredData}
                columns={columns}
                onRowClick={(row) => {
                  if (row.id) {
                    router.push(`/dossiers/${row.id}`)
                  }
                }}
                pageSize={10}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
