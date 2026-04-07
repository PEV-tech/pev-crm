'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { VDossiersComplets } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Users, TrendingUp, CheckCircle, Plus } from 'lucide-react'
import Link from 'next/link'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

interface GrilleGestion {
  encours_min: number
  encours_max: number | null
  taux: number
}

function getGestionTaux(grilles: GrilleGestion[], montant: number): number {
  const grille = grilles.find(
    (g) => montant >= g.encours_min && (g.encours_max === null || montant <= g.encours_max)
  )
  return grille?.taux || 0
}

function computeQuarterlyConsultant(
  montant: number | null | undefined,
  remApporteur: number | null | undefined,
  commissionBrute: number | null | undefined,
  grilles: GrilleGestion[]
): number | null {
  if (!montant || grilles.length === 0) return null
  const tauxGestion = getGestionTaux(grilles, montant)
  if (!tauxGestion) return null
  if (!remApporteur || !commissionBrute || commissionBrute <= 0) return null
  return (montant * tauxGestion * (remApporteur / commissionBrute)) / 4
}

// Tooltip component for commission details
function CommissionTooltip({
  row,
  isConsultant,
  gestionGrilles,
}: {
  row: VDossiersComplets
  isConsultant: boolean
  gestionGrilles: GrilleGestion[]
}) {
  const [visible, setVisible] = React.useState(false)
  const entree = isConsultant ? row.rem_apporteur : row.commission_brute
  const quarterly = isConsultant
    ? computeQuarterlyConsultant(row.montant, row.rem_apporteur, row.commission_brute, gestionGrilles)
    : row.montant && gestionGrilles.length > 0
    ? (row.montant * getGestionTaux(gestionGrilles, row.montant)) / 4
    : null

  if (!entree && !quarterly) return <span>{formatCurrency(entree)}</span>

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <div className="cursor-help text-sm">
        <div className="font-medium">{formatCurrency(entree)}</div>
        {quarterly !== null && (
          <div className="text-xs text-green-600">+ {formatCurrency(quarterly)}/trim.</div>
        )}
      </div>
      {visible && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-xs">
          <p className="font-semibold text-gray-800 mb-2">Détail commission</p>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-600">Droits d'entrée (souscription)</span>
              <span className="font-semibold text-gray-900">{formatCurrency(isConsultant ? row.rem_apporteur : row.commission_brute)}</span>
            </div>
            {quarterly !== null && (
              <div className="flex justify-between border-t border-gray-100 pt-1.5">
                <span className="text-gray-600">Encours (par trimestre)</span>
                <span className="font-semibold text-green-700">{formatCurrency(quarterly)}</span>
              </div>
            )}
            {quarterly !== null && entree !== null && entree !== undefined && (
              <div className="flex justify-between border-t border-gray-100 pt-1.5">
                <span className="text-gray-500">Total annuel estimé</span>
                <span className="font-semibold text-indigo-700">{formatCurrency((entree || 0) + quarterly * 4)}</span>
              </div>
            )}
          </div>
          {!isConsultant && row.rem_apporteur && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500">Part consultant</span>
                <span className="font-medium">{formatCurrency(row.rem_apporteur)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface MaClienteleClientProps {
  initialData: VDossiersComplets[]
  consultant: any
  gestionGrilles?: GrilleGestion[]
}

export function MaClienteleClient({ initialData, consultant, gestionGrilles = [] }: MaClienteleClientProps) {
  const router = useRouter()
  const [data] = React.useState(initialData)
  const [activeTab, setActiveTab] = React.useState('tous')
  const isConsultant = consultant?.role === 'consultant'

  const stats = React.useMemo(() => {
    const totalDossiers = data.length
    const prospects = data.filter((d) => d.statut === 'prospect').length
    const enCours = data.filter((d) => d.statut === 'client_en_cours').length
    const finalisés = data.filter((d) => d.statut === 'client_finalise').length

    const pipelineTotal = data
      .filter((d) => d.statut === 'client_en_cours')
      .reduce((sum, d) => sum + (d.montant || 0), 0)

    const collecteTotal = data
      .filter((d) => d.statut === 'client_finalise')
      .reduce((sum, d) => sum + (d.montant || 0), 0)

    return { totalDossiers, prospects, enCours, finalisés, pipelineTotal, collecteTotal }
  }, [data])

  const filteredData = React.useMemo(() => {
    if (activeTab === 'tous') return data
    if (activeTab === 'prospects') return data.filter((d) => d.statut === 'prospect')
    if (activeTab === 'en_cours') return data.filter((d) => d.statut === 'client_en_cours')
    if (activeTab === 'finalises') return data.filter((d) => d.statut === 'client_finalise')
    return data
  }, [data, activeTab])

  const columns: ColumnDefinition<VDossiersComplets>[] = [
    {
      key: 'client_nom',
      label: 'Client',
      sortable: true,
      render: (_, row) => `${row.client_prenom || ''} ${row.client_nom || ''}`.trim(),
    },
    { key: 'produit_nom', label: 'Produit', sortable: true },
    { key: 'compagnie_nom', label: 'Compagnie', sortable: true },
    {
      key: 'montant',
      label: 'Montant',
      sortable: true,
      render: (value) => formatCurrency(value),
    },
    { key: 'financement', label: 'Financement', sortable: true },
    {
      key: 'date_operation',
      label: 'Date',
      sortable: true,
      render: (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '-'),
    },
    // Commission with tooltip
    {
      key: isConsultant ? 'rem_apporteur' : 'commission_brute',
      label: isConsultant ? 'Ma commission' : 'Commission',
      sortable: true,
      render: (_, row) => (
        <CommissionTooltip
          row={row}
          isConsultant={isConsultant}
          gestionGrilles={gestionGrilles}
        />
      ),
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ma Clientèle</h1>
          <p className="text-gray-600 mt-1">Mes dossiers et clients</p>
        </div>
        <Link href="/dashboard/dossiers/nouveau">
          <Button className="gap-2">
            <Plus size={18} />
            Nouveau dossier
          </Button>
        </Link>
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
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.pipelineTotal)}</p>
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
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.collecteTotal)}</p>
            <p className="text-xs text-gray-600 mt-1">({stats.finalisés} dossier(s))</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mes dossiers</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tous" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="tous">Tous ({stats.totalDossiers})</TabsTrigger>
              <TabsTrigger value="prospects">Prospects ({stats.prospects})</TabsTrigger>
              <TabsTrigger value="en_cours">En cours ({stats.enCours})</TabsTrigger>
              <TabsTrigger value="finalises">Finalisés ({stats.finalisés})</TabsTrigger>
            </TabsList>
            {['tous', 'prospects', 'en_cours', 'finalises'].map((tab) => (
              <TabsContent key={tab} value={tab}>
                <DataTable
                  data={filteredData}
                  columns={columns}
                  pageSize={10}
                  onRowClick={(row) => {
                    if (row.id) router.push(`/dashboard/dossiers/${row.id}`)
                  }}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
