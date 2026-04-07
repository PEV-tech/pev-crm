'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { VDossiersComplets } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select } from '@/components/ui/select'
import { Users, TrendingUp, CheckCircle, Plus, Globe, Package, Building, Download } from 'lucide-react'
import Link from 'next/link'
import { exportCSV, getExportFilename, formatCurrencyForCSV, formatDateForCSV } from '@/lib/export-csv'

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

// Encours only for PE, CAPI LUX, CAV LUX — no encours for SCPI and Girardin
function hasEncours(produitNom: string | null | undefined, produitCategorie: string | null | undefined): boolean {
  const nom = (produitNom || '').toUpperCase().trim()
  const cat = (produitCategorie || '').toUpperCase().trim()
  const ENCOURS_TYPES = ['PE', 'CAPI LUX', 'CAV LUX']
  return ENCOURS_TYPES.includes(nom) || ENCOURS_TYPES.includes(cat)
}

function computeQuarterlyConsultant(
  montant: number | null | undefined,
  remApporteur: number | null | undefined,
  commissionBrute: number | null | undefined,
  grilles: GrilleGestion[],
  produitNom?: string | null,
  produitCategorie?: string | null
): number | null {
  if (!montant || grilles.length === 0) return null
  if (!hasEncours(produitNom, produitCategorie)) return null
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
    ? computeQuarterlyConsultant(row.montant, row.rem_apporteur, row.commission_brute, gestionGrilles, row.produit_nom, row.produit_categorie)
    : (row.montant && gestionGrilles.length > 0 && hasEncours(row.produit_nom, row.produit_categorie))
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

// --- Distribution mini-chart component ---
interface DistributionItem {
  label: string
  count: number
  montant: number
}

const COLORS = [
  'bg-indigo-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-purple-500', 'bg-orange-500',
  'bg-teal-500', 'bg-pink-500',
]

function DistributionChart({
  title,
  icon,
  items,
}: {
  title: string
  icon: React.ReactNode
  items: DistributionItem[]
}) {
  const total = items.reduce((s, i) => s + i.montant, 0)
  const top = items.slice(0, 7)
  const maxMontant = Math.max(...top.map((i) => i.montant), 1)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p>
        ) : (
          <div className="space-y-2.5">
            {top.map((item, i) => {
              const pct = total > 0 ? ((item.montant / total) * 100).toFixed(0) : '0'
              const barW = Math.max((item.montant / maxMontant) * 100, 4)
              return (
                <div key={item.label} className="group">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700 truncate max-w-[60%]">{item.label || 'Non renseigné'}</span>
                    <div className="flex items-center gap-2 text-gray-500">
                      <span>{item.count} dossier{item.count > 1 ? 's' : ''}</span>
                      <span className="font-semibold text-gray-700">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${COLORS[i % COLORS.length]}`}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {items.length > 7 && (
              <p className="text-xs text-gray-400 text-center pt-1">+ {items.length - 7} autres</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
  const [filterYear, setFilterYear] = React.useState<string>('tous')
  const [filterProduit, setFilterProduit] = React.useState<string>('tous')
  const [filterPays, setFilterPays] = React.useState<string>('tous')
  const isConsultant = consultant?.role === 'consultant'

  // Extract available years, products, countries from data
  const availableYears = React.useMemo(() => {
    const years = new Set<string>()
    data.forEach((d) => {
      if (d.date_operation) {
        years.add(d.date_operation.substring(0, 4))
      }
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [data])

  const availableProduits = React.useMemo(() => {
    return Array.from(new Set(data.map(d => d.produit_nom).filter(Boolean) as string[])).sort()
  }, [data])

  const availablePays = React.useMemo(() => {
    return Array.from(new Set(data.map(d => d.client_pays).filter(Boolean) as string[])).sort()
  }, [data])

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
    let result = data
    // Year filter
    if (filterYear !== 'tous') {
      result = result.filter((d) => d.date_operation && d.date_operation.startsWith(filterYear))
    }
    // Product filter
    if (filterProduit !== 'tous') {
      result = result.filter((d) => d.produit_nom === filterProduit)
    }
    // Country filter
    if (filterPays !== 'tous') {
      result = result.filter((d) => d.client_pays === filterPays)
    }
    // Status tab filter
    if (activeTab === 'prospects') result = result.filter((d) => d.statut === 'prospect')
    else if (activeTab === 'en_cours') result = result.filter((d) => d.statut === 'client_en_cours')
    else if (activeTab === 'finalises') result = result.filter((d) => d.statut === 'client_finalise')
    return result
  }, [data, activeTab, filterYear, filterProduit, filterPays])

  // --- Portfolio distributions (finalisés only for real AUM) ---
  const distributions = React.useMemo(() => {
    const finalized = data.filter((d) => d.statut === 'client_finalise' || d.statut === 'client_en_cours')
    const buildDist = (keyFn: (d: VDossiersComplets) => string): DistributionItem[] => {
      const map = new Map<string, { count: number; montant: number }>()
      finalized.forEach((d) => {
        const key = keyFn(d) || 'Non renseigné'
        const prev = map.get(key) || { count: 0, montant: 0 }
        map.set(key, { count: prev.count + 1, montant: prev.montant + (d.montant || 0) })
      })
      return Array.from(map.entries())
        .map(([label, v]) => ({ label, ...v }))
        .sort((a, b) => b.montant - a.montant)
    }
    return {
      byPays: buildDist((d) => d.client_pays || ''),
      byProduit: buildDist((d) => d.produit_nom || ''),
      byCompagnie: buildDist((d) => d.compagnie_nom || ''),
    }
  }, [data])

  // --- CSV export ---
  const handleExport = () => {
    const csvCols = [
      { key: 'client_prenom', label: 'Prénom' },
      { key: 'client_nom', label: 'Nom' },
      { key: 'client_pays', label: 'Pays' },
      { key: 'produit_nom', label: 'Produit' },
      { key: 'compagnie_nom', label: 'Compagnie' },
      { key: 'montant', label: 'Montant', formatter: formatCurrencyForCSV },
      { key: 'financement', label: 'Financement' },
      { key: 'date_operation', label: 'Date', formatter: formatDateForCSV },
      { key: isConsultant ? 'rem_apporteur' : 'commission_brute', label: 'Commission', formatter: formatCurrencyForCSV },
      { key: 'statut', label: 'Statut' },
    ]
    exportCSV(filteredData, csvCols, { filename: getExportFilename('ma-clientele') })
  }

  const columns: ColumnDefinition<VDossiersComplets>[] = [
    {
      key: 'client_nom',
      label: 'Client',
      sortable: true,
      render: (_, row) => {
        const name = `${row.client_prenom || ''} ${row.client_nom || ''}`.trim()
        return row.client_id ? (
          <Link href={`/dashboard/clients/${row.client_id}`} className="text-indigo-600 hover:underline font-medium" onClick={e => e.stopPropagation()}>
            {name}
          </Link>
        ) : name
      },
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
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download size={18} />
            Exporter
          </Button>
          <Link href="/dashboard/dossiers/nouveau">
            <Button className="gap-2">
              <Plus size={18} />
              Nouveau dossier
            </Button>
          </Link>
        </div>
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

      {/* Portfolio Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DistributionChart
          title="Par pays"
          icon={<Globe size={18} className="text-indigo-600" />}
          items={distributions.byPays}
        />
        <DistributionChart
          title="Par produit"
          icon={<Package size={18} className="text-orange-600" />}
          items={distributions.byProduit}
        />
        <DistributionChart
          title="Par compagnie"
          icon={<Building size={18} className="text-green-600" />}
          items={distributions.byCompagnie}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mes dossiers</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tous" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList>
                <TabsTrigger value="tous">Tous ({stats.totalDossiers})</TabsTrigger>
                <TabsTrigger value="prospects">Prospects ({stats.prospects})</TabsTrigger>
                <TabsTrigger value="en_cours">En cours ({stats.enCours})</TabsTrigger>
                <TabsTrigger value="finalises">Finalisés ({stats.finalisés})</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-32">
                  <option value="tous">Toutes années</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
                <Select value={filterProduit} onChange={(e) => setFilterProduit(e.target.value)} className="w-40">
                  <option value="tous">Tous produits</option>
                  {availableProduits.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
                <Select value={filterPays} onChange={(e) => setFilterPays(e.target.value)} className="w-36">
                  <option value="tous">Tous pays</option>
                  {availablePays.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              </div>
            </div>
            {['tous', 'prospects', 'en_cours', 'finalises'].map((tab) => (
              <TabsContent key={tab} value={tab}>
                <DataTable
                  data={filteredData}
                  columns={columns}
                  pageSize={10}
                  onRowClick={(row) => {
                    if (row.id) router.push(`/dashboard/dossiers/${row.id}?from=ma-clientele`)
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
