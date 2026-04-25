'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { VDossiersComplets } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
// DataTable removed — detail section was redundant with dossiers page
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Download, Filter, TrendingUp,
  DollarSign, FileText, Users, ArrowUpRight,
  PieChart, Calendar, Globe, Package, Building, Receipt,
} from 'lucide-react'
import { exportCSV, getExportFilename, formatCurrencyForCSV, formatDateForCSV } from '@/lib/export-csv'

import { formatCurrency } from '@/lib/formatting'

const formatCompact = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M€`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k€`
  return `${value.toFixed(0)}€`
}

interface Consultant {
  id: string
  nom: string
  prenom: string
  role: string
}

// --- Horizontal bar distribution component ---
const COLORS = [
  'bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-purple-500', 'bg-orange-500',
]

function MiniDistribution({
  title,
  icon,
  items,
}: {
  title: string
  icon: React.ReactNode
  items: { label: string; count: number; montant: number }[]
}) {
  const total = items.reduce((s, i) => s + i.montant, 0)
  const top = items.slice(0, 5)
  const maxVal = Math.max(...top.map((i) => i.montant), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {top.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">Aucune donnée</p>
        ) : (
          <div className="space-y-2">
            {top.map((item, i) => {
              const pct = total > 0 ? ((item.montant / total) * 100).toFixed(0) : '0'
              const barW = Math.max((item.montant / maxVal) * 100, 4)
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="font-medium text-gray-700 truncate max-w-[55%]">{item.label || 'Non renseigné'}</span>
                    <span className="text-gray-500">{formatCompact(item.montant)} <span className="text-gray-400">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${COLORS[i % COLORS.length]}`} style={{ width: `${barW}%` }} />
                  </div>
                </div>
              )
            })}
            {items.length > 5 && (
              <p className="text-[10px] text-gray-400 text-center">+ {items.length - 5} autres</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Monthly evolution bar chart (pure CSS) ---
function MonthlyChart({
  months,
  label,
  onClickMonth,
}: {
  months: { label: string; value: number }[]
  label: string
  onClickMonth?: (monthIndex: number) => void
}) {
  const maxVal = Math.max(...months.map((m) => m.value), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Calendar size={16} className="text-indigo-600" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end gap-1 h-32">
          {months.map((m, idx) => {
            const barH = Math.max((m.value / maxVal) * 100, 2)
            return (
              <div
                key={m.label}
                className={`flex-1 flex flex-col items-center justify-end h-full group relative ${onClickMonth ? 'cursor-pointer' : ''}`}
                onClick={() => onClickMonth && m.value > 0 && onClickMonth(idx)}
              >
                <div className="absolute -top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                  {formatCompact(m.value)}
                </div>
                <div
                  className="w-full bg-indigo-500 rounded-t transition-all group-hover:bg-indigo-600"
                  style={{ height: `${barH}%`, minHeight: m.value > 0 ? '4px' : '0px' }}
                />
                <span className="text-[9px] text-gray-500 mt-1 leading-none">{m.label}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// --- Conversion funnel ---
function ConversionFunnel({
  prospects,
  enCours,
  finalises,
}: {
  prospects: number
  enCours: number
  finalises: number
}) {
  const total = prospects + enCours + finalises
  const convEC = total > 0 ? ((enCours + finalises) / total * 100).toFixed(0) : '0'
  const convFin = (enCours + finalises) > 0 ? (finalises / (enCours + finalises) * 100).toFixed(0) : '0'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <PieChart size={16} className="text-purple-600" />
          Entonnoir de conversion
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Prospects</span>
              <span className="font-semibold">{prospects}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="h-3 rounded-full bg-gray-400" style={{ width: '100%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">En cours</span>
              <span className="font-semibold">{enCours} <span className="text-amber-600">({convEC}%)</span></span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="h-3 rounded-full bg-amber-500" style={{ width: `${total > 0 ? ((enCours + finalises) / total * 100) : 0}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Finalisés</span>
              <span className="font-semibold">{finalises} <span className="text-green-600">({convFin}%)</span></span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="h-3 rounded-full bg-green-500" style={{ width: `${total > 0 ? (finalises / total * 100) : 0}%` }} />
            </div>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Taux global : {total > 0 ? (finalises / total * 100).toFixed(1) : '0'}% prospect &rarr; finalisé
        </p>
      </CardContent>
    </Card>
  )
}

// ===== MAIN =====
export default function AnalysePage() {
  const { consultant: currentUser } = useUser()
  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'back_office'

  const [data, setData] = React.useState<VDossiersComplets[]>([])
  const [consultants, setConsultants] = React.useState<Consultant[]>([])
  const [loading, setLoading] = React.useState(true)

  // Month detail popup
  const [selectedMonth, setSelectedMonth] = React.useState<number | null>(null)
  const FULL_MONTH_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  // Filters
  const [periodeDebut, setPeriodeDebut] = React.useState('')
  const [periodeFin, setPeriodeFin] = React.useState('')
  const [filtreConsultant, setFiltreConsultant] = React.useState('tous')
  const [filtreStatut, setFiltreStatut] = React.useState('tous')
  const [filtreProduit, setFiltreProduit] = React.useState('tous')
  const [filtreCompagnie, setFiltreCompagnie] = React.useState('tous')
  const [filtrePays, setFiltrePays] = React.useState('tous')

  const supabase = React.useMemo(() => createClient(), [])

  // Default period = current year
  React.useEffect(() => {
    const now = new Date()
    setPeriodeDebut(`${now.getFullYear()}-01-01`)
    setPeriodeFin(now.toISOString().split('T')[0])
  }, [])

  // Fetch
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
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [supabase])

  // Unique filter values
  const produits = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.produit_nom).filter(Boolean))).sort() as string[], [data]
  )
  const compagnies = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.compagnie_nom).filter(Boolean))).sort() as string[], [data]
  )
  const pays = React.useMemo(
    () => Array.from(new Set(data.map((d) => d.client_pays).filter(Boolean))).sort() as string[], [data]
  )

  // Filtered data
  // 2026-04-25 : alignement avec Ma Clientèle (point 3.1 du 2026-04-24).
  // On filtre par `consultant_id` (UUID) et plus par `consultant_nom +
  // consultant_prenom` qui est sensible aux variations de casse / espace
  // (bug Hugues/Stéphane). Les chiffres entre les deux pages sont
  // désormais cohérents sans dépendre de la qualité des chaînes nom/prénom.
  const filteredData = React.useMemo(() => {
    return data.filter((d) => {
      if (periodeDebut && d.date_operation && d.date_operation < periodeDebut) return false
      if (periodeFin && d.date_operation && d.date_operation > periodeFin) return false
      if (filtreConsultant !== 'tous') {
        if (d.consultant_id !== filtreConsultant) return false
      }
      if (!isManager && currentUser) {
        if (d.consultant_id !== currentUser.id) return false
      }
      if (filtreStatut !== 'tous' && d.statut !== filtreStatut) return false
      if (filtreProduit !== 'tous' && d.produit_nom !== filtreProduit) return false
      if (filtreCompagnie !== 'tous' && d.compagnie_nom !== filtreCompagnie) return false
      if (filtrePays !== 'tous' && d.client_pays !== filtrePays) return false
      return true
    })
  }, [data, periodeDebut, periodeFin, filtreConsultant, filtreStatut, filtreProduit, filtreCompagnie, filtrePays, isManager, currentUser])

  // ===== AGGREGATES =====
  const agg = React.useMemo(() => {
    const total = filteredData.length
    const commBrute = filteredData.reduce((s, d) => s + (d.commission_brute || 0), 0)
    const remApporteur = filteredData.reduce((s, d) => s + (d.rem_apporteur || 0), 0)

    const finalized = filteredData.filter((d) => d.statut === 'client_finalise')
    const montantFinalise = finalized.reduce((s, d) => s + (d.montant || 0), 0)
    const enCours = filteredData.filter((d) => d.statut === 'client_en_cours')
    const montantEnCours = enCours.reduce((s, d) => s + (d.montant || 0), 0)
    const prospects = filteredData.filter((d) => d.statut === 'prospect')

    const ticketMoyen = finalized.length > 0 ? montantFinalise / finalized.length : 0

    const facturees = filteredData.filter((d) => d.facturee).length
    const payees = filteredData.filter((d) => d.payee === 'oui').length
    const impayees = filteredData.filter((d) => d.facturee && d.payee !== 'oui').length

    const clientIds = new Set(filteredData.map((d) => d.client_id).filter(Boolean))

    return {
      total, commBrute, remApporteur,
      montantFinalise, montantEnCours,
      finalized: finalized.length, enCours: enCours.length, prospects: prospects.length,
      ticketMoyen, facturees, payees, impayees,
      uniqueClients: clientIds.size,
    }
  }, [filteredData])

  // ===== MONTHLY EVOLUTION =====
  const monthlyCollecte = React.useMemo(() => {
    const year = periodeDebut ? parseInt(periodeDebut.substring(0, 4)) : new Date().getFullYear()
    const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    const monthData = monthLabels.map((label) => ({ label, value: 0 }))

    filteredData
      .filter((d) => d.statut === 'client_finalise' && d.date_operation)
      .forEach((d) => {
        const dt = new Date(d.date_operation!)
        if (dt.getFullYear() === year) {
          monthData[dt.getMonth()].value += d.montant || 0
        }
      })

    return monthData
  }, [filteredData, periodeDebut])

  const monthlyCommissions = React.useMemo(() => {
    const year = periodeDebut ? parseInt(periodeDebut.substring(0, 4)) : new Date().getFullYear()
    const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    const monthData = monthLabels.map((label) => ({ label, value: 0 }))

    filteredData
      .filter((d) => d.date_operation)
      .forEach((d) => {
        const dt = new Date(d.date_operation!)
        if (dt.getFullYear() === year) {
          monthData[dt.getMonth()].value += (currentUser?.role === 'consultant' ? d.rem_apporteur : d.commission_brute) || 0
        }
      })

    return monthData
  }, [filteredData, periodeDebut, currentUser])

  // ===== DISTRIBUTIONS =====
  const buildDist = React.useCallback((keyFn: (d: VDossiersComplets) => string) => {
    const map = new Map<string, { count: number; montant: number }>()
    filteredData.forEach((d) => {
      const key = keyFn(d) || 'Non renseigné'
      const prev = map.get(key) || { count: 0, montant: 0 }
      map.set(key, { count: prev.count + 1, montant: prev.montant + (d.montant || 0) })
    })
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.montant - a.montant)
  }, [filteredData])

  const distPays = React.useMemo(() => buildDist((d) => d.client_pays || ''), [buildDist])
  const distProduit = React.useMemo(() => buildDist((d) => d.produit_nom || ''), [buildDist])
  const distCompagnie = React.useMemo(() => buildDist((d) => d.compagnie_nom || ''), [buildDist])
  const distFinancement = React.useMemo(() => buildDist((d) => d.financement || ''), [buildDist])

  // ===== TOP CLIENTS =====
  const topClients = React.useMemo(() => {
    const map = new Map<string, { nom: string; montant: number; dossiers: number }>()
    filteredData
      .filter((d) => d.statut === 'client_finalise')
      .forEach((d) => {
        const key = d.client_id || `${d.client_prenom}_${d.client_nom}`
        const nom = `${d.client_prenom || ''} ${d.client_nom || ''}`.trim()
        const prev = map.get(key) || { nom, montant: 0, dossiers: 0 }
        map.set(key, { nom, montant: prev.montant + (d.montant || 0), dossiers: prev.dossiers + 1 })
      })
    return Array.from(map.values()).sort((a, b) => b.montant - a.montant).slice(0, 5)
  }, [filteredData])

  // ===== CONSULTANT RANKING (manager only) =====
  const consultantRanking = React.useMemo(() => {
    if (!isManager) return []
    const map = new Map<string, { nom: string; collecte: number; dossiers: number; commission: number }>()
    filteredData
      .filter((d) => d.statut === 'client_finalise')
      .forEach((d) => {
        const key = `${d.consultant_prenom}_${d.consultant_nom}`
        const nom = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
        const prev = map.get(key) || { nom, collecte: 0, dossiers: 0, commission: 0 }
        map.set(key, {
          nom,
          collecte: prev.collecte + (d.montant || 0),
          dossiers: prev.dossiers + 1,
          commission: prev.commission + (d.commission_brute || 0),
        })
      })
    return Array.from(map.values()).sort((a, b) => b.collecte - a.collecte)
  }, [filteredData, isManager])

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
    exportCSV(filteredData, cols, { filename: getExportFilename('analyse-pev') })
  }

  // Bandeau "période active" — useMemo doit être appelé AVANT toute early return
  // pour respecter les Rules of Hooks (sinon erreur React #310 quand loading bascule).
  const periodeDescription = React.useMemo(() => {
    if (!periodeDebut && !periodeFin) return null // Toute la période → pas de bandeau
    const formatFr = (iso: string) => {
      if (!iso) return ''
      const [y, m, d] = iso.split('-')
      return `${d}/${m}/${y}`
    }
    const debut = periodeDebut ? formatFr(periodeDebut) : 'origine'
    const fin = periodeFin ? formatFr(periodeFin) : 'aujourd\'hui'
    return `${debut} → ${fin}`
  }, [periodeDebut, periodeFin])

  // Reset
  const resetFilters = () => {
    const now = new Date()
    setPeriodeDebut(`${now.getFullYear()}-01-01`)
    setPeriodeFin(now.toISOString().split('T')[0])
    setFiltreConsultant('tous')
    setFiltreStatut('tous')
    setFiltreProduit('tous')
    setFiltreCompagnie('tous')
    setFiltrePays('tous')
  }

  const clearPeriode = () => {
    setPeriodeDebut('')
    setPeriodeFin('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-500">
        Chargement de l&apos;analyse...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analyse</h1>
          <p className="text-gray-600 mt-1">Vue stratégique de l&apos;activité</p>
        </div>
        <Button className="gap-2" onClick={handleExport} disabled={filteredData.length === 0}>
          <Download size={18} />
          Exporter CSV
        </Button>
      </div>

      {/* Bandeau "période active" — explicite que les chiffres sont filtrés.
          Permet aussi de basculer en "toute la période" en un clic. */}
      {periodeDescription && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-indigo-900">
            <Calendar size={16} className="text-indigo-600" />
            <span>
              Les chiffres ci-dessous sont filtrés sur la période :
              {' '}<strong>{periodeDescription}</strong>
              {' '}(<strong>{filteredData.length}</strong> dossiers sur l'ensemble du CRM)
            </span>
          </div>
          <button
            type="button"
            onClick={clearPeriode}
            className="shrink-0 text-xs font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            Voir toute la période →
          </button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter size={18} className="text-gray-600" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Début</label>
              <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fin</label>
              <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            {isManager && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Consultant</label>
                <select value={filtreConsultant} onChange={(e) => setFiltreConsultant(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="tous">Tous</option>
                  {consultants.filter((c) => c.role !== 'back_office').map((c) => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
              <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="tous">Tous</option>
                <option value="prospect">Prospect</option>
                <option value="client_en_cours">En cours</option>
                <option value="client_finalise">Finalisé</option>
                <option value="non_abouti">Non abouti</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Produit</label>
              <select value={filtreProduit} onChange={(e) => setFiltreProduit(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="tous">Tous</option>
                {produits.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Compagnie</label>
              <select value={filtreCompagnie} onChange={(e) => setFiltreCompagnie(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="tous">Toutes</option>
                {compagnies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pays</label>
              <select value={filtrePays} onChange={(e) => setFiltrePays(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="tous">Tous</option>
                {pays.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-gray-500">
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-blue-600" />
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Dossiers</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{agg.total}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{agg.uniqueClients} client{agg.uniqueClients > 1 ? 's' : ''} unique{agg.uniqueClients > 1 ? 's' : ''}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-green-600" />
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Collecte finalisée</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCompact(agg.montantFinalise)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{agg.finalized} dossier{agg.finalized > 1 ? 's' : ''}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-amber-600" />
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Pipeline</p>
          </div>
          <p className="text-2xl font-bold text-amber-700">{formatCompact(agg.montantEnCours)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{agg.enCours} en cours · {agg.prospects} prospect{agg.prospects > 1 ? 's' : ''}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-indigo-600" />
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Commissions</p>
          </div>
          <p className="text-2xl font-bold text-indigo-700">{formatCompact(currentUser?.role === 'consultant' ? agg.remApporteur : agg.commBrute)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight size={14} className="text-teal-600" />
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Ticket moyen</p>
          </div>
          <p className="text-2xl font-bold text-teal-700">{formatCompact(agg.ticketMoyen)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">sur finalisés</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={14} className="text-rose-600" />
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Facturation</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{agg.facturees}/{agg.total}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{agg.payees} payée{agg.payees > 1 ? 's' : ''} · {agg.impayees} impayée{agg.impayees > 1 ? 's' : ''}</p>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MonthlyChart months={monthlyCollecte} label="Collecte finalisée par mois" onClickMonth={(idx) => setSelectedMonth(idx)} />
        <MonthlyChart months={monthlyCommissions} label="Commissions par mois" onClickMonth={(idx) => setSelectedMonth(idx)} />
        <ConversionFunnel prospects={agg.prospects} enCours={agg.enCours} finalises={agg.finalized} />
      </div>

      {/* Distributions Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniDistribution title="Par pays" icon={<Globe size={14} className="text-indigo-600" />} items={distPays} />
        <MiniDistribution title="Par produit" icon={<Package size={14} className="text-orange-600" />} items={distProduit} />
        <MiniDistribution title="Par compagnie" icon={<Building size={14} className="text-green-600" />} items={distCompagnie} />
        <MiniDistribution title="Par financement" icon={<Receipt size={14} className="text-purple-600" />} items={distFinancement} />
      </div>

      {/* Top clients + Consultant ranking */}
      <div className={`grid grid-cols-1 ${isManager ? 'lg:grid-cols-2' : ''} gap-4`}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 5 clients (collecte finalisée)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topClients.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Aucun dossier finalisé</p>
            ) : (
              <div className="space-y-2">
                {topClients.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm font-medium text-gray-800">{c.nom}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">{formatCompact(c.montant)}</span>
                      <span className="text-[10px] text-gray-400 ml-1">({c.dossiers}d)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {isManager && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Performance consultants (finalisés)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {consultantRanking.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Aucune donnée</p>
              ) : (
                <div className="space-y-2">
                  {consultantRanking.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'
                        }`}>{i + 1}</span>
                        <span className="text-sm font-medium text-gray-800">{c.nom}</span>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <span className="text-xs text-gray-500">{c.dossiers}d</span>
                        <span className="text-xs text-indigo-600 font-medium">{formatCompact(c.commission)}</span>
                        <span className="text-sm font-semibold text-gray-900">{formatCompact(c.collecte)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Month detail popup */}
      {selectedMonth !== null && (() => {
        const year = periodeDebut ? parseInt(periodeDebut.substring(0, 4)) : new Date().getFullYear()
        const monthDossiers = filteredData.filter((d) => {
          if (!d.date_operation) return false
          const dt = new Date(d.date_operation)
          return dt.getFullYear() === year && dt.getMonth() === selectedMonth
        })
        const monthCollecte = monthDossiers.filter(d => d.statut === 'client_finalise').reduce((s, d) => s + (d.montant || 0), 0)
        const monthCommission = monthDossiers.reduce((s, d) => s + ((currentUser?.role === 'consultant' ? d.rem_apporteur : d.commission_brute) || 0), 0)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedMonth(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">
                  Détail — {FULL_MONTH_LABELS[selectedMonth]} {year}
                </h3>
                <button onClick={() => setSelectedMonth(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-130px)]">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-indigo-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Dossiers</p>
                    <p className="text-xl font-bold text-indigo-700">{monthDossiers.length}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Collecte finalisée</p>
                    <p className="text-xl font-bold text-green-700">{formatCompact(monthCollecte)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Commissions</p>
                    <p className="text-xl font-bold text-blue-700">{formatCompact(monthCommission)}</p>
                  </div>
                </div>
                {monthDossiers.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Client</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Produit</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Montant</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Commission</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Statut</th>
                        {isManager && <th className="px-3 py-2 text-left font-semibold text-gray-700">Consultant</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {monthDossiers.map((d) => (
                        <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2">{d.client_prenom} {d.client_nom}</td>
                          <td className="px-3 py-2">{d.produit_nom || '-'}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(d.montant)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(currentUser?.role === 'consultant' ? d.rem_apporteur : d.commission_brute)}</td>
                          <td className="px-3 py-2"><StatusBadge status={d.statut as any} type="dossier" /></td>
                          {isManager && <td className="px-3 py-2">{d.consultant_prenom} {d.consultant_nom}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-gray-400 py-8">Aucun dossier ce mois</p>
                )}
              </div>
              <div className="px-6 py-3 border-t bg-gray-50 text-right">
                <button onClick={() => setSelectedMonth(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
