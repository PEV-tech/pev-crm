'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  BarChart3, Download, Filter, TrendingUp,
  DollarSign, FileText, Users,
} from 'lucide-react'
import { exportCSV, getExportFilename, formatCurrencyForCSV, formatDateForCSV } from '@/lib/export-csv'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

interface Consultant {
  id: string
  nom: string
  prenom: string
  role: string
}

export default function ReportingPage() {
  const { consultant: currentUser } = useUser()
  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'back_office'

  const [data, setData] = React.useState<VDossiersComplets[]>([])
  const [consultants, setConsultants] = React.useState<Consultant[]>([])
  const [loading, setLoading] = React.useState(true)

  // Filters
  const [periodeDebut, setPeriodeDebut] = React.useState('')
  const [periodeFin, setPeriodeFin] = React.useState('')
  const [filtreConsultant, setFiltreConsultant] = React.useState('tous')
  const [filtreStatut, setFiltreStatut] = React.useState('tous')
  const [filtreProduit, setFiltreProduit] = React.useState('tous')
  const [filtreCompagnie, setFiltreCompagnie] = React.useState('tous')

  const supabase = React.useMemo(() => createClient(), [])

  // Set default period to current year
  React.useEffect(() => {
    const now = new Date()
    setPeriodeDebut(`${now.getFullYear()}-01-01`)
    setPeriodeFin(now.toISOString().split('T')[0])
  }, [])

  // Fetch all data
  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [dossierRes, consultantRes] = await Promise.all([
          supabase.from('v_dossiers_complets').select('*').order('date_operation', { ascending: false }),
          supabase.from('consultants').select('id, nom, prenom, role').eq('actif', true).order('nom'),
        ])
        setData(dossierRes.data || [])
        setConsultants(consultantRes.data || [])
      } catch (err) {
        console.error('Reporting fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [supabase])

  // Extract unique values for filters
  const produits = React.useMemo(
    () => [...new Set(data.map((d) => d.produit_nom).filter(Boolean))].sort() as string[],
    [data]
  )
  const compagnies = React.useMemo(
    () => [...new Set(data.map((d) => d.compagnie_nom).filter(Boolean))].sort() as string[],
    [data]
  )

  // Filtered data
  const filteredData = React.useMemo(() => {
    return data.filter((d) => {
      // Period filter
      if (periodeDebut && d.date_operation && d.date_operation < periodeDebut) return false
      if (periodeFin && d.date_operation && d.date_operation > periodeFin) return false
      // Consultant (compare by name since v_dossiers_complets has consultant_nom/prenom)
      if (filtreConsultant !== 'tous') {
        const cons = consultants.find((c) => c.id === filtreConsultant)
        if (cons) {
          const match = d.consultant_nom === cons.nom && d.consultant_prenom === cons.prenom
          if (!match) return false
        }
      }
      // For consultant role, only their own
      if (!isManager && currentUser) {
        const match = d.consultant_nom === currentUser.nom && d.consultant_prenom === currentUser.prenom
        if (!match) return false
      }
      if (filtreStatut !== 'tous' && d.statut !== filtreStatut) return false
      if (filtreProduit !== 'tous' && d.produit_nom !== filtreProduit) return false
      if (filtreCompagnie !== 'tous' && d.compagnie_nom !== filtreCompagnie) return false
      return true
    })
  }, [data, periodeDebut, periodeFin, filtreConsultant, filtreStatut, filtreProduit, filtreCompagnie, consultants, isManager, currentUser])

  // Aggregates
  const agg = React.useMemo(() => {
    const total = filteredData.length
    const montantTotal = filteredData.reduce((s, d) => s + (d.montant || 0), 0)
    const commTotal = filteredData.reduce(
      (s, d) => s + ((currentUser?.role === 'consultant' ? d.rem_apporteur : d.commission_brute) || 0), 0
    )
    const finalized = filteredData.filter((d) => d.statut === 'client_finalise')
    const montantFinalise = finalized.reduce((s, d) => s + (d.montant || 0), 0)
    const enCours = filteredData.filter((d) => d.statut === 'client_en_cours')
    const montantEnCours = enCours.reduce((s, d) => s + (d.montant || 0), 0)
    const prospects = filteredData.filter((d) => d.statut === 'prospect').length
    return { total, montantTotal, commTotal, montantFinalise, montantEnCours, prospects, finalized: finalized.length, enCours: enCours.length }
  }, [filteredData, currentUser])

  // Export
  const handleExport = () => {
    const cols = [
      { key: 'client_prenom', label: 'Prénom' },
      { key: 'client_nom', label: 'Nom' },
      { key: 'client_pays', label: 'Pays' },
      { key: 'produit_nom', label: 'Produit' },
      { key: 'compagnie_nom', label: 'Compagnie' },
      { key: 'montant', label: 'Montant', formatter: formatCurrencyForCSV },
      { key: 'financement', label: 'Financement' },
      { key: 'date_operation', label: 'Date opération', formatter: formatDateForCSV },
      { key: 'statut', label: 'Statut' },
      { key: 'commission_brute', label: 'Commission brute', formatter: formatCurrencyForCSV },
      { key: 'rem_apporteur', label: 'Rém. apporteur', formatter: formatCurrencyForCSV },
      { key: 'consultant_prenom', label: 'Consultant prénom' },
      { key: 'consultant_nom', label: 'Consultant nom' },
      { key: 'facturee', label: 'Facturée', formatter: (v: any) => (v ? 'Oui' : 'Non') },
      { key: 'payee', label: 'Payée' },
    ]
    exportCSV(filteredData, cols, { filename: getExportFilename('reporting-pev') })
  }

  // Reset filters
  const resetFilters = () => {
    const now = new Date()
    setPeriodeDebut(`${now.getFullYear()}-01-01`)
    setPeriodeFin(now.toISOString().split('T')[0])
    setFiltreConsultant('tous')
    setFiltreStatut('tous')
    setFiltreProduit('tous')
    setFiltreCompagnie('tous')
  }

  // Table columns
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
      render: (v) => formatCurrency(v),
    },
    {
      key: 'date_operation',
      label: 'Date',
      sortable: true,
      render: (v) => (v ? new Date(v).toLocaleDateString('fr-FR') : '-'),
    },
    {
      key: 'commission_brute',
      label: 'Commission',
      sortable: true,
      render: (v) => formatCurrency(v),
    },
    ...(isManager
      ? [
          {
            key: 'consultant_nom' as keyof VDossiersComplets,
            label: 'Consultant',
            sortable: true,
            render: (_: any, row: VDossiersComplets) =>
              `${row.consultant_prenom || ''} ${row.consultant_nom || ''}`.trim(),
          },
        ]
      : []),
    {
      key: 'statut',
      label: 'Statut',
      sortable: true,
      render: (v) => (
        <StatusBadge
          status={(v as 'prospect' | 'client_en_cours' | 'client_finalise') || 'prospect'}
          type="dossier"
        />
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-500">
        Chargement du reporting...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reporting</h1>
          <p className="text-gray-600 mt-1">Analyse et export des données</p>
        </div>
        <Button className="gap-2" onClick={handleExport} disabled={filteredData.length === 0}>
          <Download size={18} />
          Exporter CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter size={18} className="text-gray-600" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date début</label>
              <input
                type="date"
                value={periodeDebut}
                onChange={(e) => setPeriodeDebut(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date fin</label>
              <input
                type="date"
                value={periodeFin}
                onChange={(e) => setPeriodeFin(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            {isManager && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Consultant</label>
                <select
                  value={filtreConsultant}
                  onChange={(e) => setFiltreConsultant(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="tous">Tous</option>
                  {consultants
                    .filter((c) => c.role !== 'back_office')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.prenom} {c.nom}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
              <select
                value={filtreStatut}
                onChange={(e) => setFiltreStatut(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="tous">Tous</option>
                <option value="prospect">Prospect</option>
                <option value="client_en_cours">En cours</option>
                <option value="client_finalise">Finalisé</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Produit</label>
              <select
                value={filtreProduit}
                onChange={(e) => setFiltreProduit(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="tous">Tous</option>
                {produits.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Compagnie</label>
              <select
                value={filtreCompagnie}
                onChange={(e) => setFiltreCompagnie(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="tous">Toutes</option>
                {compagnies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-gray-500">
              Réinitialiser les filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-blue-600" />
            <p className="text-xs font-medium text-gray-500">Dossiers</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{agg.total}</p>
          <p className="text-xs text-gray-500 mt-1">
            {agg.finalized} finalisé{agg.finalized > 1 ? 's' : ''} · {agg.enCours} en cours · {agg.prospects} prospect{agg.prospects > 1 ? 's' : ''}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-green-600" />
            <p className="text-xs font-medium text-gray-500">Collecte finalisée</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(agg.montantFinalise)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-amber-600" />
            <p className="text-xs font-medium text-gray-500">Pipeline en cours</p>
          </div>
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(agg.montantEnCours)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-indigo-600" />
            <p className="text-xs font-medium text-gray-500">Commissions</p>
          </div>
          <p className="text-2xl font-bold text-indigo-700">{formatCurrency(agg.commTotal)}</p>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={20} className="text-gray-600" />
              Détail ({filteredData.length} résultat{filteredData.length > 1 ? 's' : ''})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredData}
            columns={columns}
            pageSize={15}
          />
        </CardContent>
      </Card>
    </div>
  )
}
