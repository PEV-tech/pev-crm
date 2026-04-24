'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { VDossiersComplets, StatutDossierType } from '@/types/database'
// Point 2.3 (2026-04-24) — Le wrapper enrichit les rows avec is_orphan
// (prospects dérivés de clients sans dossier) et client_statut (masquer
// les non_abouti par défaut). Type local pour ne pas polluer database.ts.
type DossierRow = VDossiersComplets & {
  is_orphan?: boolean
  client_statut?: 'actif' | 'non_abouti' | null
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { exportCSV, getExportFilename, formatCurrencyForCSV, formatDateForCSV } from '@/lib/export-csv'

import { GrilleGestion, getGestionTaux, hasEncours, computeQuarterlyConsultant } from '@/lib/commissions/gestion'

interface DossiersClientProps {
  initialData: DossierRow[]
  role?: string
  gestionGrilles?: GrilleGestion[]
  entreeGrilles?: GrilleGestion[]
  totalCount?: number
  currentPage?: number
  itemsPerPage?: number
  onPageChange?: (page: number) => void
}

import { formatCurrency } from '@/lib/formatting'

const mapStatutForBadge = (statut: StatutDossierType | null | undefined): 'prospect' | 'client_en_cours' | 'client_finalise' | 'non_abouti' => {
  return (statut as 'prospect' | 'client_en_cours' | 'client_finalise' | 'non_abouti') || 'prospect'
}

const MODE_DETENTION_LABELS: Record<string, string> = {
  PP: 'Pleine Propriété',
  NP: 'Nue-Propriété',
  US: 'Usufruit',
}

export function DossiersClient({
  initialData,
  role = 'manager',
  gestionGrilles = [],
  entreeGrilles = [],
  totalCount = 0,
  currentPage = 0,
  itemsPerPage = 25,
  onPageChange,
}: DossiersClientProps) {
  const isConsultant = role === 'consultant'
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data] = React.useState(initialData)
  const [activeTab, setActiveTab] = React.useState('tous')
  const [filterCategorie, setFilterCategorie] = React.useState('')
  const [filterProduit, setFilterProduit] = React.useState('')
  const [filterPays, setFilterPays] = React.useState('')
  const [filterConsultant, setFilterConsultant] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('q') || '')
  // Point 2.3 (2026-04-24) — Toggle pour inclure les clients archivés
  // en statut_client = 'non_abouti'. Masqués par défaut.
  const [includeNonAbouti, setIncludeNonAbouti] = React.useState(false)

  // Filter data based on active tab, filters, and search
  const filteredData = React.useMemo(() => {
    // Point 2.3 — Filtre statut_client AVANT tout le reste.
    // Clients non_abouti masqués par défaut ; visibles via toggle ou si
    // l'utilisateur sélectionne explicitement l'onglet Non abouti (pour
    // ne pas rendre l'onglet vide).
    let result = data.filter((d) => {
      if (d.client_statut !== 'non_abouti') return true
      if (includeNonAbouti) return true
      if (activeTab === 'non_abouti') return true
      return false
    })

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((d) => {
        const text = [
          d.client_nom, d.client_prenom, d.produit_nom,
          d.compagnie_nom, d.consultant_nom, d.consultant_prenom,
          d.client_pays
        ].filter(Boolean).join(' ').toLowerCase()
        return text.includes(q)
      })
    }

    // Filter by statut
    if (activeTab !== 'tous') {
      result = result.filter((d) => {
        if (activeTab === 'prospects') return d.statut === 'prospect'
        if (activeTab === 'en_cours') return d.statut === 'client_en_cours'
        if (activeTab === 'finalises') return d.statut === 'client_finalise'
        if (activeTab === 'non_abouti') return d.statut === 'non_abouti'
        return true
      })
    }

    // Filter by catégorie
    if (filterCategorie) {
      result = result.filter((d) => d.produit_categorie === filterCategorie)
    }

    // Filter by produit
    if (filterProduit) {
      result = result.filter((d) => d.produit_nom === filterProduit)
    }

    // Filter by pays
    if (filterPays) {
      result = result.filter((d) => d.client_pays === filterPays)
    }

    // Filter by consultant — Point 3.1 (2026-04-24) : on filtre par
    // consultant_id (UUID stable) et plus par concat prenom+nom, car
    // cette dernière matchait par erreur des dossiers de consultants
    // homonymes ou avec espace/casse différente (bug Hugues/Stéphane).
    if (filterConsultant) {
      result = result.filter((d) => (d as any).consultant_id === filterConsultant)
    }

    return result
  }, [data, activeTab, filterCategorie, filterProduit, filterPays, filterConsultant, searchQuery, includeNonAbouti])

  const handleExportCSV = React.useCallback(() => {
    const exportData = filteredData.map((d) => ({
      client: `${d.client_prenom || ''} ${d.client_nom || ''}`.trim(),
      categorie: d.produit_categorie || '',
      compagnie: d.compagnie_nom || '',
      produit: d.produit_nom || '',
      montant: formatCurrencyForCSV(d.montant),
      financement: d.financement || '',
      date: formatDateForCSV(d.date_operation),
      pays: d.client_pays || '',
      consultant: `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim() || '-',
      statut: d.statut || '',
      kyc: d.statut_kyc || '',
    }))

    const columns = [
      { key: 'client', label: 'Client' },
      { key: 'categorie', label: 'Catégorie' },
      { key: 'compagnie', label: 'Compagnie' },
      { key: 'produit', label: 'Produit' },
      { key: 'montant', label: 'Montant (EUR)' },
      { key: 'financement', label: 'Financement' },
      { key: 'date', label: 'Date' },
      { key: 'pays', label: 'Pays' },
      { key: 'consultant', label: 'Consultant' },
      { key: 'statut', label: 'Statut' },
      { key: 'kyc', label: 'Réglementaire' },
    ]

    exportCSV(exportData, columns, {
      filename: getExportFilename('dossiers_export'),
      separator: ';',
    })
  }, [filteredData])

  // Get unique values for filters
  const categories = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.produit_categorie).filter(Boolean) as string[])).sort(),
    [data]
  )
  const produits = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.produit_nom).filter(Boolean) as string[])).sort(),
    [data]
  )
  const pays = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.client_pays).filter(Boolean) as string[])).sort(),
    [data]
  )
  /**
   * Point 3.1 (2026-04-24) — Liste des consultants dédupliquée PAR ID.
   * Ancienne version dédupait par chaîne "prenom nom" — fragile aux
   * homonymes et aux variations de casse/espace dans les données.
   * Le label reste un prenom+nom pour l'affichage, la value est l'UUID.
   */
  const consultants = React.useMemo(() => {
    const byId = new Map<string, string>()
    for (const d of data) {
      const id = (d as any).consultant_id as string | null | undefined
      if (!id) continue
      if (byId.has(id)) continue
      const label = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
      byId.set(id, label || '(consultant sans nom)')
    }
    return Array.from(byId.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [data])

  // Calculate stats
  const stats = React.useMemo(() => {
    // Point 2.3 — Les stats de tabs ignorent les non_abouti (sauf l'onglet
    // Non abouti lui-même) pour refléter la vue par défaut.
    const visibleData = data.filter((d) => {
      if (d.client_statut !== 'non_abouti') return true
      return includeNonAbouti
    })
    // Point 5.2 (2026-04-24) — Le compteur "Tous" affichait la taille
    // de la page courante (25 max via range supabase) et non le total
    // réel de dossiers. On préfère désormais `totalCount` côté serveur
    // quand il est disponible. Les sous-compteurs (prospects, en_cours,
    // finalises, non_abouti) restent locaux car on ne peut pas les
    // obtenir sans un count séparé par statut — c'est acceptable tant
    // que la pagination est petite, mais à tracker si ça diverge trop.
    const totalTous = totalCount > 0 ? totalCount : visibleData.length
    const counts = {
      tous: totalTous,
      prospects: visibleData.filter((d) => d.statut === 'prospect').length,
      en_cours: visibleData.filter((d) => d.statut === 'client_en_cours').length,
      finalises: visibleData.filter((d) => d.statut === 'client_finalise').length,
      non_abouti: data.filter((d) => d.client_statut === 'non_abouti').length,
    }

    const totalMontant = visibleData.reduce((sum, d) => sum + (d.montant || 0), 0)

    return { counts, totalMontant }
  }, [data, includeNonAbouti, totalCount])

  /**
   * Point 2.3 (2026-04-24) — Navigation sur clic de ligne.
   * Les lignes orphelines (prospects dérivés de clients sans dossier)
   * ont un id synthétique `orphan-<clientId>` qui n'existe pas dans la
   * table `dossiers`. On redirige vers la fiche client plutôt que vers
   * une page dossier qui renverrait un 404.
   */
  const handleRowClick = React.useCallback(
    (row: DossierRow) => {
      if (row.is_orphan && row.client_id) {
        router.push(`/dashboard/clients/${row.client_id}`)
        return
      }
      if (row.id) {
        router.push(`/dashboard/dossiers/${row.id}`)
      }
    },
    [router],
  )

  // Table columns
  const columns: ColumnDefinition<DossierRow>[] = [
    {
      key: 'client_nom',
      label: 'Client',
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/dashboard/clients/${row.client_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            {row.client_prenom} {row.client_nom}
          </Link>
          {/* Point 2.3 — badge prospect si ligne orpheline (client sans dossier). */}
          {row.is_orphan && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold uppercase tracking-wide">
              Prospect
            </span>
          )}
          {/* Point 2.3 — badge non abouti si client archivé (visible
              uniquement quand le toggle "Inclure" est ON ou onglet Non abouti). */}
          {row.client_statut === 'non_abouti' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-300 text-[10px] font-semibold uppercase tracking-wide">
              Non abouti
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'produit_categorie',
      label: 'Catégorie',
      sortable: true,
    },
    {
      key: 'compagnie_nom',
      label: 'Compagnie',
      sortable: true,
    },
    {
      key: 'produit_nom',
      label: 'Produit',
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
      key: isConsultant ? 'rem_apporteur' : 'commission_brute',
      label: isConsultant ? 'Ma commission' : 'Commission',
      sortable: true,
      render: (value, row) => {
        // For LUX/PE: use grille entrée instead of taux_produit_compagnie
        const isLuxPe = hasEncours(row.produit_nom, row.produit_categorie)
        let displayValue = value
        if (isLuxPe && entreeGrilles.length > 0 && row.montant) {
          const entreeTaux = getGestionTaux(entreeGrilles, row.montant)
          if (entreeTaux > 0) {
            const grilleCommission = row.montant * entreeTaux
            if (isConsultant && row.commission_brute && row.commission_brute > 0 && row.rem_apporteur) {
              displayValue = grilleCommission * (row.rem_apporteur / row.commission_brute)
            } else {
              displayValue = grilleCommission
            }
          }
        }
        const entree = displayValue ? formatCurrency(displayValue) : '-'
        const quarterly = computeQuarterlyConsultant(
          row.montant, row.rem_apporteur, row.commission_brute, gestionGrilles, row.produit_nom, row.produit_categorie
        )
        if (quarterly === null) return entree
        return (
          <div className="text-sm">
            <div className="font-medium">{entree}</div>
            <div className="text-xs text-green-600 mt-0.5">+ {formatCurrency(quarterly)}/trim.</div>
          </div>
        )
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
      label: 'Réglementaire',
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportCSV}
          >
            <Download size={18} />
            Exporter CSV
          </Button>
        </div>
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
              <TabsTrigger value="non_abouti">
                Non abouti ({stats.counts.non_abouti})
              </TabsTrigger>
            </TabsList>

            {/* Search + Filters */}
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Rechercher un client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
              <Select
                value={filterCategorie}
                onChange={(e) => setFilterCategorie(e.target.value)}
                className="max-w-sm"
              >
                <option value="">Toutes les catégories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
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
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>

              {/* Point 2.3 (2026-04-24) — Toggle pour inclure les clients
                  archivés (statut_client = non_abouti). Masqués par défaut. */}
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none ml-auto">
                <input
                  type="checkbox"
                  checked={includeNonAbouti}
                  onChange={(e) => setIncludeNonAbouti(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Inclure les non aboutis
                {stats.counts.non_abouti > 0 && (
                  <span className="text-xs text-gray-400">({stats.counts.non_abouti})</span>
                )}
              </label>
            </div>

            <TabsContent value="tous" className="mt-4">
              <DataTable
                data={filteredData}
                columns={columns}
                onRowClick={handleRowClick}
                pageSize={25}
              />
            </TabsContent>

            <TabsContent value="prospects" className="mt-4">
              <DataTable
                data={filteredData}
                columns={columns}
                onRowClick={handleRowClick}
                pageSize={25}
              />
            </TabsContent>

            <TabsContent value="en_cours" className="mt-4">
              <DataTable
                data={filteredData}
                columns={columns}
                onRowClick={handleRowClick}
                pageSize={25}
              />
            </TabsContent>

            <TabsContent value="finalises" className="mt-4">
              <DataTable
                data={filteredData}
                columns={columns}
                onRowClick={handleRowClick}
                pageSize={25}
              />
            </TabsContent>

            <TabsContent value="non_abouti" className="mt-4">
              <DataTable
                data={filteredData}
                columns={columns}
                onRowClick={handleRowClick}
                pageSize={25}
              />
            </TabsContent>

            {/* Server-side Pagination Controls */}
            {totalCount > itemsPerPage && onPageChange && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <span className="text-sm text-gray-600">
                  {totalCount === 0 ? '0' : (currentPage * itemsPerPage) + 1} - {Math.min((currentPage + 1) * itemsPerPage, totalCount)} sur {totalCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="gap-1"
                  >
                    <ChevronLeft size={16} />
                    Précédent
                  </Button>
                  <span className="text-sm text-gray-600 flex items-center px-2">
                    Page {currentPage + 1} sur {Math.ceil(totalCount / itemsPerPage)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={(currentPage + 1) * itemsPerPage >= totalCount}
                    className="gap-1"
                  >
                    Suivant
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
