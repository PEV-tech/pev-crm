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
import { Download } from 'lucide-react'
import { exportCSV, getExportFilename, formatCurrencyForCSV, formatDateForCSV } from '@/lib/export-csv'

import { GrilleGestion, getGestionTaux, hasEncours, computeQuarterlyConsultant } from '@/lib/commissions/gestion'

/** Bug 6 (2026-04-24) — Liste complète des consultants fournie par le
 *  wrapper (fetchée depuis la table `consultants`, pas dérivée de data).
 *  Garantit que le dropdown liste tous les consultants même si leur
 *  dossier n'est pas sur la page courante paginée. */
export interface ConsultantOption {
  id: string
  label: string
}

interface DossiersClientProps {
  initialData: DossierRow[]
  role?: string
  gestionGrilles?: GrilleGestion[]
  entreeGrilles?: GrilleGestion[]
  totalCount?: number
  currentPage?: number
  itemsPerPage?: number
  onPageChange?: (page: number) => void
  consultantsList?: ConsultantOption[]
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
  consultantsList = [],
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
  // 2026-04-25 — Filtre période (alignement avec Analyse). Pas de défaut :
  // la page démarre sur "toute la période". Quand actif, le bandeau bleu
  // apparaît en tête (cf. Analyse).
  const [periodeDebut, setPeriodeDebut] = React.useState('')
  const [periodeFin, setPeriodeFin] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('q') || '')

  // 2026-04-25 — Filtrage en deux étages :
  //   1. `scopeData` applique tous les filtres "globaux" (période,
  //      catégorie, produit, pays, consultant) + l'exclusion des
  //      non_abouti. C'est la base sur laquelle on calcule les KPIs et
  //      les comptes par onglet → garantit la cohérence avec Analyse.
  //   2. `filteredData` ajoute `activeTab` + `searchQuery` pour le
  //      tableau lui-même.
  // Les filtres `activeTab` et `searchQuery` n'affectent pas les KPIs
  // (un changement d'onglet ne doit pas modifier les compteurs).
  const scopeData = React.useMemo(() => {
    let result = data.filter((d) => d.client_statut !== 'non_abouti')

    if (filterCategorie) result = result.filter((d) => d.produit_categorie === filterCategorie)
    if (filterProduit) result = result.filter((d) => d.produit_nom === filterProduit)
    if (filterPays) result = result.filter((d) => d.client_pays === filterPays)
    // Filter by consultant — Point 3.1 (2026-04-24) : consultant_id (UUID)
    // pour éviter les collisions de prénoms (bug Hugues/Stéphane).
    if (filterConsultant) result = result.filter((d) => (d as any).consultant_id === filterConsultant)
    // Filter by période (date_operation). Les lignes sans date_operation
    // (orphan/prospect dérivés) sont conservées — elles ne portent pas de
    // date, donc on ne peut pas les filtrer dessus.
    if (periodeDebut) result = result.filter((d) => !d.date_operation || d.date_operation >= periodeDebut)
    if (periodeFin) result = result.filter((d) => !d.date_operation || d.date_operation <= periodeFin)

    return result
  }, [data, filterCategorie, filterProduit, filterPays, filterConsultant, periodeDebut, periodeFin])

  // Vue dédiée aux non_abouti (onglet séparé).
  const nonAboutiData = React.useMemo(
    () => data.filter((d) => d.client_statut === 'non_abouti'),
    [data],
  )

  // Filter data based on active tab and search (par-dessus scopeData).
  const filteredData = React.useMemo(() => {
    let result: DossierRow[]
    if (activeTab === 'non_abouti') {
      // Onglet dédié : seuls les non_abouti — sans filtres globaux pour
      // ne pas masquer un client archivé qui pourrait sortir de la période.
      result = nonAboutiData
    } else {
      result = scopeData
      if (activeTab === 'prospects') result = result.filter((d) => d.statut === 'prospect')
      else if (activeTab === 'en_cours') result = result.filter((d) => d.statut === 'client_en_cours')
      else if (activeTab === 'finalises') result = result.filter((d) => d.statut === 'client_finalise')
    }

    // Text search (s'applique sur toutes les vues)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((d) => {
        const text = [
          d.client_nom, d.client_prenom, d.produit_nom,
          d.compagnie_nom, d.consultant_nom, d.consultant_prenom,
          d.client_pays,
        ].filter(Boolean).join(' ').toLowerCase()
        return text.includes(q)
      })
    }

    return result
  }, [scopeData, nonAboutiData, activeTab, searchQuery])

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
   * Bug 6 (2026-04-24) — Liste complète des consultants fournie par le
   * wrapper (fetch séparé sur la table `consultants`), pas dérivée de
   * data. Garantit que TOUS les consultants apparaissent dans le dropdown
   * même ceux qui n'ont pas de dossier sur la page courante paginée.
   * Fallback sur la dérivation depuis data si la prop n'est pas fournie
   * (rétrocompat).
   */
  const consultants = React.useMemo(() => {
    if (consultantsList && consultantsList.length > 0) {
      return [...consultantsList].sort((a, b) => a.label.localeCompare(b.label))
    }
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

  // 2026-04-25 — KPIs et comptes par onglet basés sur `scopeData` (filtres
  // globaux appliqués), pas plus sur `data` brut. Les compteurs reflètent
  // donc la période active et les filtres catégorie/produit/pays/consultant.
  // Le compteur Non abouti reste basé sur le dataset complet (la fiche
  // archivée n'a pas vocation à disparaître quand on filtre par période).
  const stats = React.useMemo(() => {
    const counts = {
      tous: scopeData.length,
      prospects: scopeData.filter((d) => d.statut === 'prospect').length,
      en_cours: scopeData.filter((d) => d.statut === 'client_en_cours').length,
      finalises: scopeData.filter((d) => d.statut === 'client_finalise').length,
      non_abouti: nonAboutiData.length,
    }

    const totalMontant = scopeData.reduce((sum, d) => sum + (d.montant || 0), 0)

    return { counts, totalMontant }
  }, [scopeData, nonAboutiData])

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

  // Helpers d'affichage pour le bandeau "période active" (cohérent avec Analyse).
  const formatFrDate = (iso: string): string => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  const periodeDescription = React.useMemo(() => {
    if (!periodeDebut && !periodeFin) return null
    const debut = periodeDebut ? formatFrDate(periodeDebut) : 'origine'
    const fin = periodeFin ? formatFrDate(periodeFin) : "aujourd'hui"
    return `${debut} → ${fin}`
  }, [periodeDebut, periodeFin])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">Vue consolidée : dossiers + prospects (clients sans dossier)</p>
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

      {/* Bandeau "période active" — apparaît uniquement quand une période
          est saisie. Cohérent avec /dashboard/analyse. */}
      {periodeDescription && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-indigo-900">
            <span>
              Les chiffres ci-dessous sont filtrés sur la période :
              {' '}<strong>{periodeDescription}</strong>
              {' '}(<strong>{stats.counts.tous}</strong> dossiers sur l&apos;ensemble du CRM)
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setPeriodeDebut(''); setPeriodeFin('') }}
            className="shrink-0 text-xs font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            Voir toute la période →
          </button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600">Total clients</p>
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
          <CardTitle>Liste clients</CardTitle>
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
              {/* 2026-04-25 — Filtre période. Pas de défaut : "toute la
                  période" tant qu'aucune date n'est saisie. */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 whitespace-nowrap">Du</label>
                <input
                  type="date"
                  value={periodeDebut}
                  onChange={(e) => setPeriodeDebut(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <label className="text-xs text-gray-600 whitespace-nowrap">Au</label>
                <input
                  type="date"
                  value={periodeFin}
                  onChange={(e) => setPeriodeFin(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
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

              {/* Bug 3 (2026-04-24) — Checkbox "Inclure les non aboutis"
                  retirée. L'onglet dédié "Non abouti" suffit et évite la
                  double UX. */}
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

            {/* Bug 1 (2026-04-24) — Pagination serveur retirée. Avec
                ~300-500 clients max, on charge tout d'un coup. Le
                composant DataTable gère sa propre pagination locale sur
                les lignes déjà chargées (pageSize=25 par défaut). */}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
