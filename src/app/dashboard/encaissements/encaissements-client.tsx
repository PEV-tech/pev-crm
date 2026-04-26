'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Download, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { VDossiersComplets } from '@/types/database'
import { NewEncoursModal } from '@/app/dashboard/encours/new-encours-modal'
import { useToast } from '@/components/ui/toast'
import { DeleteEncaissementModal } from './delete-encaissement-modal'

const ITEMS_PER_PAGE = 25

import { formatCurrency as _formatCurrency } from '@/lib/formatting'
const formatCurrency = (value: number | null | undefined): string => {
  if (value === 0) return '-'
  return _formatCurrency(value)
}

const MONTH_ORDER: Record<string, number> = {
  JANVIER: 1, FEVRIER: 2, MARS: 3, AVRIL: 4, MAI: 5, JUIN: 6,
  JUILLET: 7, AOUT: 8, SEPTEMBRE: 9, OCTOBRE: 10, NOVEMBRE: 11, DECEMBRE: 12,
}

const MONTH_LABELS: Record<string, string> = {
  JANVIER: 'Janvier', FEVRIER: 'Février', MARS: 'Mars', AVRIL: 'Avril',
  MAI: 'Mai', JUIN: 'Juin', JUILLET: 'Juillet', AOUT: 'Août',
  SEPTEMBRE: 'Septembre', OCTOBRE: 'Octobre', NOVEMBRE: 'Novembre', DECEMBRE: 'Décembre',
}

// ───── Types ─────

type EncaissementSource = 'auto' | 'encours_v2' | 'facture'

interface RemEntry {
  id: string
  mois: string
  label: string
  // Décomposition financière (pour traçabilité)
  commission_brute: number
  rem_apporteur: number
  rem_gestion: number
  // Splits
  net_cabinet: number
  pool_plus: number
  thelo: number
  maxine: number
  steph_asie: number
  steph_fr: number
  consultant: number
  mathias: number
  part_cabinet: number
  // Métadonnées pour la suppression depuis le drill-down
  source_id: string
  source_type: EncaissementSource
}

interface Totals {
  commission_brute: number
  rem_apporteur: number
  rem_gestion: number
  net_cabinet: number
  pool_plus: number
  thelo: number
  maxine: number
  steph_asie: number
  steph_fr: number
  consultant: number
  mathias: number
  part_cabinet: number
}

const ZERO_TOTALS: Totals = { commission_brute: 0, rem_apporteur: 0, rem_gestion: 0, net_cabinet: 0, pool_plus: 0, thelo: 0, maxine: 0, steph_asie: 0, steph_fr: 0, consultant: 0, mathias: 0, part_cabinet: 0 }

const sumEntries = (entries: RemEntry[]): Totals =>
  entries.reduce(
    (acc, e) => ({
      commission_brute: acc.commission_brute + Number(e.commission_brute || 0),
      rem_apporteur: acc.rem_apporteur + Number(e.rem_apporteur || 0),
      rem_gestion: acc.rem_gestion + Number(e.rem_gestion || 0),
      net_cabinet: acc.net_cabinet + Number(e.net_cabinet || 0),
      pool_plus: acc.pool_plus + Number(e.pool_plus || 0),
      thelo: acc.thelo + Number(e.thelo || 0),
      maxine: acc.maxine + Number(e.maxine || 0),
      steph_asie: acc.steph_asie + Number(e.steph_asie || 0),
      steph_fr: acc.steph_fr + Number(e.steph_fr || 0),
      consultant: acc.consultant + Number(e.consultant || 0),
      mathias: acc.mathias + Number(e.mathias || 0),
      part_cabinet: acc.part_cabinet + Number(e.part_cabinet || 0),
    }),
    { ...ZERO_TOTALS }
  )

// Helpers
const pool = (t: Totals) => t.pool_plus + t.thelo + t.maxine
const consultantTotal = (t: Totals) => t.consultant + t.mathias

// ───── Compute breakdown from a facture (paid dossier) ─────

function isStephane(consultantNom: string | null): boolean {
  if (!consultantNom) return false
  const n = consultantNom.toLowerCase().trim()
  return n.includes('stéphane') || n.includes('stephane') || n.includes('steph')
}

function isMaxine(prenom: string | null): boolean {
  return (prenom || '').toLowerCase().trim().includes('maxine')
}
function isThelo(prenom: string | null): boolean {
  const n = (prenom || '').toLowerCase().trim()
  return n.includes('th\u00e9lo') || n.includes('thelo')
}
function isFrance(clientPays: string | null): boolean {
  if (!clientPays) return true // default to FR if unknown
  const p = clientPays.toUpperCase().trim()
  return p === 'FRANCE' || p === 'FR'
}

function factureToRemEntry(f: VDossiersComplets): RemEntry {
  const commBrute = Number(f.commission_brute || 0)
  // Use taux_remuneration to correctly back-calculate pool share
  // NOTE: part_cabinet in DB = commBrute - rem_consultant (pool included), can't use it directly
  const tauxConsultant = Number(f.taux_remuneration || 0)

  // Determine month from date_facture
  let mois = 'INCONNU'
  if (f.date_facture) {
    const d = new Date(f.date_facture)
    const monthNames = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE']
    mois = monthNames[d.getMonth()] || 'INCONNU'
  }

  const label = `${f.client_prenom || ''} ${f.client_nom || ''}`.trim() +
    ((f.produit_nom && f.produit_nom.toUpperCase() !== 'SCPI' ? f.produit_nom : (f.compagnie_nom || f.produit_nom)) ? ` — ${(f.produit_nom && f.produit_nom.toUpperCase() !== 'SCPI') ? f.produit_nom : (f.compagnie_nom || f.produit_nom)}` : '')

  const stephane = isStephane(f.consultant_prenom)
  const maxineM = isMaxine(f.consultant_prenom)
  const theloM = isThelo(f.consultant_prenom)
  const france = isFrance(f.client_pays)

  // Commission rules via consultant_prenom:
  let steph_fr = 0, steph_asie = 0, consultant = 0
  let pp = 0, th = 0, mx = 0, cabinetShare = 0

  if (stephane) {
    const s = commBrute * 0.50
    steph_fr = france ? s : 0; steph_asie = !france ? s : 0
    pp = commBrute * 8.3 / 100; th = pp; mx = pp
    cabinetShare = commBrute * 0.25
  } else if (maxineM) {
    mx = commBrute * 0.50; th = commBrute * 0.10; pp = commBrute * 0.10
    cabinetShare = commBrute * 0.30
  } else if (theloM) {
    th = commBrute * 0.50; mx = commBrute * 0.10; pp = commBrute * 0.10
    cabinetShare = commBrute * 0.30
  } else if (tauxConsultant <= 0) {
    pp = commBrute * 23.3 / 100; th = pp; mx = pp
    cabinetShare = commBrute * 0.30
  } else {
    consultant = commBrute * tauxConsultant
    cabinetShare = commBrute * (tauxConsultant <= 0.35 ? 0.30 : 0.25)
    const pool = Math.max(0, commBrute - consultant - cabinetShare)
    pp = pool / 3; th = pool / 3; mx = pool / 3
  }

  return {
    id: f.id || `f-${Math.random()}`,
    mois, label,
    commission_brute: commBrute,
    rem_apporteur: 0,
    rem_gestion: 0,
    net_cabinet: commBrute,
    pool_plus: pp, thelo: th, maxine: mx,
    steph_fr, steph_asie, consultant, mathias: 0,
    part_cabinet: cabinetShare,
    source_id: f.id || '',
    source_type: 'facture' as const,
  }
}

// ───── Convert encaissement record (from DB trigger) to RemEntry ─────

function encaissementToRemEntry(e: any): RemEntry {
  const stephane = isStephane(e.consultant_prenom)
  const france = isFrance(e.client_pays)
  const remConsultant = Number(e.rem_consultant || 0)

  // source_type vient de la vue v_encaissements_unified ('auto' ou 'encours_v2')
  const sourceType: EncaissementSource = (e.source_type === 'encours_v2' ? 'encours_v2' : 'auto')

  return {
    id: e.id || e.dossier_id || `enc-${Math.random()}`,
    mois: e.mois || 'INCONNU',
    label: (e.produit_nom && e.produit_nom.toUpperCase() === 'SCPI' && e.compagnie_nom) ? (e.label || '').replace(/\s*\u2014\s*SCPI\s*$/, ` \u2014 ${e.compagnie_nom}`) : (e.label || ''),
    commission_brute: Number(e.commission_brute || 0),
    rem_apporteur: Number(e.rem_apporteur_ext || 0),
    rem_gestion: Number(e.rem_gestion || 0),
    net_cabinet: Number(e.commission_nette || e.commission_brute || 0),
    pool_plus: Number(e.part_pool_plus || 0),
    thelo: Number(e.part_thelo || 0),
    maxine: Number(e.part_maxine || 0),
    steph_fr: stephane && france ? remConsultant : 0,
    steph_asie: stephane && !france ? remConsultant : 0,
    consultant: !stephane ? remConsultant : 0,
    mathias: 0,
    part_cabinet: Number(e.part_cabinet || 0),
    source_id: e.id || '',
    source_type: sourceType,
  }
}

// ───── Drill-down types ─────

type ColKey = 'maxine' | 'thelo' | 'pool_plus' | 'pool' | 'steph_fr' | 'steph_asie' | 'consultant' | 'part_cabinet' | 'net_cabinet'

const COL_LABELS: Record<ColKey, string> = {
  maxine: 'Maxine',
  thelo: 'Thélo',
  pool_plus: 'POOL+',
  pool: 'POOL',
  steph_fr: 'Stéphane FR',
  steph_asie: 'Stéphane SG',
  consultant: 'Consultant',
  part_cabinet: 'Cabinet',
  net_cabinet: 'Net cabinet',
}

function getEntryValue(entry: RemEntry, col: ColKey): number {
  if (col === 'pool') return Number(entry.pool_plus || 0) + Number(entry.thelo || 0) + Number(entry.maxine || 0)
  if (col === 'consultant') return Number(entry.consultant || 0) + Number(entry.mathias || 0)
  return Number((entry as any)[col] || 0)
}

interface DrillDownEntry {
  label: string
  mois: string
  amount: number
  // Métadonnées portées pour la suppression depuis le drill-down
  source_id: string
  source_type: EncaissementSource
}

interface DrillDownInfo {
  title: string
  entries: DrillDownEntry[]
  total: number
}

// ───── Component ─────

interface EncaissementsClientProps {
  initialData: any[] // Raw encaissement records from DB trigger
  role?: string
  facturesPaid?: VDossiersComplets[]
}

export function EncaissementsClient({ initialData, role = 'manager', facturesPaid = [] }: EncaissementsClientProps) {
  const isBackOffice = role === 'back_office'
  const isManager = !isBackOffice
  const [expandedMonths, setExpandedMonths] = React.useState<Record<string, boolean>>({})
  const [drillDown, setDrillDown] = React.useState<DrillDownInfo | null>(null)
  const [monthPagination, setMonthPagination] = React.useState<Record<string, number>>({})
  const [newEncoursOpen, setNewEncoursOpen] = React.useState<boolean>(false)
  const { showToast, ToastContainer } = useToast()

  const toggleMonth = (mois: string) => {
    setExpandedMonths(prev => ({ ...prev, [mois]: !prev[mois] }))
  }

  // Encaissements table = authoritative source. No merge with facturesPaid to avoid double-counting.
    const data: RemEntry[] = React.useMemo(() => { if (initialData.length > 0) return initialData.map(encaissementToRemEntry); return facturesPaid.map(f => factureToRemEntry(f)) }, [initialData, facturesPaid])

  // Drill-down: show dossiers for a given column, optionally filtered by month
  const openDrillDown = (col: ColKey, mois?: string) => {
    const source = mois ? data.filter(e => e.mois === mois) : data
    const entries: DrillDownEntry[] = source
      .map(e => ({
        label: e.label,
        mois: e.mois,
        amount: getEntryValue(e, col),
        source_id: e.source_id,
        source_type: e.source_type,
      }))
      .filter(e => e.amount !== 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    const total = entries.reduce((s, e) => s + e.amount, 0)
    const monthLabel = mois ? (MONTH_LABELS[mois] || mois) + ' — ' : ''
    setDrillDown({ title: `${monthLabel}${COL_LABELS[col]}`, entries, total })
  }

  // Suppression depuis le drill-down
  const [deleteTarget, setDeleteTarget] = React.useState<DrillDownEntry | null>(null)

  const byMonth = React.useMemo(() => {
    const grouped: Record<string, RemEntry[]> = {}
    data.forEach(entry => {
      if (!grouped[entry.mois]) grouped[entry.mois] = []
      grouped[entry.mois].push(entry)
    })
    return Object.entries(grouped)
      .sort(([a], [b]) => (MONTH_ORDER[a] || 99) - (MONTH_ORDER[b] || 99))
  }, [data])

  const totals = React.useMemo(() => sumEntries(data), [data])

  // CSV — adapté au rôle
  const handleExportCSV = React.useCallback(() => {
    let header: string
    let rows: string[]
    if (isBackOffice) {
      header = 'Mois;Label;Brut;Apporteur;Gestion;Net Cabinet;POOL;Stéphane FR;Stéphane SG;Consultant;Cabinet'
      rows = data.map(e =>
        `${MONTH_LABELS[e.mois] || e.mois};${e.label};${e.commission_brute};${e.rem_apporteur};${e.rem_gestion};${e.net_cabinet};${Number(e.pool_plus || 0) + Number(e.thelo || 0) + Number(e.maxine || 0)};${e.steph_fr};${e.steph_asie};${Number(e.consultant || 0) + Number(e.mathias || 0)};${e.part_cabinet}`
      )
    } else {
      header = 'Mois;Label;Brut;Apporteur;Gestion;Net Cabinet;Maxine;Thélo;POOL+;Stéphane FR;Stéphane SG;Consultant;Cabinet'
      rows = data.map(e =>
        `${MONTH_LABELS[e.mois] || e.mois};${e.label};${e.commission_brute};${e.rem_apporteur};${e.rem_gestion};${e.net_cabinet};${e.maxine};${e.thelo};${e.pool_plus};${e.steph_fr};${e.steph_asie};${Number(e.consultant || 0) + Number(e.mathias || 0)};${e.part_cabinet}`
      )
    }
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `encaissements_rem_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [data, isBackOffice])

  // ───── Cellule du tableau mensuel ─────
  // Le clic sur les cellules individuelles a été retiré (option B 2026-04-25).
  // Le drill-down par poche × mois est accessible via la barre récap en haut
  // OU via les chiffres d'en-tête de chaque mois (Max:/Thélo:/Cab:/POOL:).
  // Le paramètre `col` est conservé pour compatibilité de signature.
  const ClickableCell = ({ value, className = '' }: { value: number; col: ColKey; mois?: string; className?: string }) => {
    const display = formatCurrency(value)
    return <td className={`py-2 px-2 text-right ${className}`}>{display}</td>
  }

  // ───── Ligne du tableau mensuel ─────
  const MonthRow = ({ entry, isTotalRow, label, mois }: { entry: Totals & { label?: string; source_id?: string; source_type?: EncaissementSource }; isTotalRow?: boolean; label?: string; mois: string }) => {
    const cls = isTotalRow ? 'bg-gray-100 font-bold' : 'border-b border-gray-100 hover:bg-gray-50'
    const canDelete = !isTotalRow && (isManager || isBackOffice) && entry.source_id && entry.source_type
    return (
      <tr className={cls}>
        <td className="py-2 pr-4 font-medium text-gray-900">{label || (entry as any).label}</td>
        <ClickableCell value={(entry as any).commission_brute || 0} col="net_cabinet" mois={mois} className="text-gray-500" />
        <ClickableCell value={(entry as any).rem_apporteur || 0} col="net_cabinet" mois={mois} className="text-orange-600" />
        <ClickableCell value={(entry as any).rem_gestion || 0} col="net_cabinet" mois={mois} className="text-orange-600" />
        <ClickableCell value={entry.net_cabinet} col="net_cabinet" mois={mois} className="font-semibold" />
        {isManager ? (
          <>
            <ClickableCell value={entry.maxine} col="maxine" mois={mois} className="text-purple-700 font-medium" />
            <ClickableCell value={entry.thelo} col="thelo" mois={mois} className="text-blue-700 font-medium" />
            <ClickableCell value={entry.pool_plus} col="pool_plus" mois={mois} className="text-gray-600" />
          </>
        ) : (
          <ClickableCell value={entry.pool_plus + entry.thelo + entry.maxine} col="pool" mois={mois} className="text-indigo-700 font-medium" />
        )}
        <ClickableCell value={entry.steph_fr} col="steph_fr" mois={mois} className="text-gray-600" />
        <ClickableCell value={entry.steph_asie} col="steph_asie" mois={mois} className="text-gray-600" />
        <ClickableCell value={entry.consultant + entry.mathias} col="consultant" mois={mois} className="text-gray-600" />
        <ClickableCell value={entry.part_cabinet} col="part_cabinet" mois={mois} className="text-gray-600" />
        <td className="py-2 pl-2 w-10">
          {canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget({
                  label: (entry as any).label || '',
                  mois,
                  amount: Number(entry.net_cabinet || 0),
                  source_id: entry.source_id as string,
                  source_type: entry.source_type as EncaissementSource,
                })
              }}
              className="p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
              title="Supprimer cet encaissement"
              aria-label="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Encaissements</h1>
          <p className="text-gray-600 mt-1">
            Commissions reçues et répartition — {data.length} entrée(s) sur {byMonth.length} mois
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" className="gap-2" onClick={() => setNewEncoursOpen(true)}>
            <Plus size={18} />
            Encours
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download size={18} />
            Exporter CSV
          </Button>
        </div>
      </div>

      <NewEncoursModal
        isOpen={newEncoursOpen}
        onClose={() => setNewEncoursOpen(false)}
        onCreated={(batchId) => { showToast(`Lot créé (${batchId.slice(0, 8)}…)`, 'success') }}
      />
      {ToastContainer}

      {/* ───── Barre récapitulative ───── */}
      <div className={`grid grid-cols-3 ${isManager ? 'md:grid-cols-8' : 'md:grid-cols-7'} gap-3`}>
        <div
          className="bg-blue-50 rounded-lg p-3 text-center cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => openDrillDown('net_cabinet')}
          title="Voir le détail"
        >
          <p className="text-xs text-blue-500">Total encaissé</p>
          <p className="text-sm font-bold text-blue-700">{formatCurrency(totals.net_cabinet)}</p>
        </div>
        {isManager ? (
          <>
            <div
              className="bg-purple-50 rounded-lg p-3 text-center cursor-pointer hover:bg-purple-100 transition-colors"
              onClick={() => openDrillDown('maxine')}
              title="Voir le détail Maxine"
            >
              <p className="text-xs text-purple-500">Maxine</p>
              <p className="text-sm font-semibold text-purple-700">{formatCurrency(totals.maxine)}</p>
            </div>
            <div
              className="bg-blue-50 rounded-lg p-3 text-center cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => openDrillDown('thelo')}
              title="Voir le détail Thélo"
            >
              <p className="text-xs text-blue-500">Thélo</p>
              <p className="text-sm font-semibold text-blue-700">{formatCurrency(totals.thelo)}</p>
            </div>
            <div
              className="bg-gray-50 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => openDrillDown('pool_plus')}
              title="Voir le détail POOL+"
            >
              <p className="text-xs text-gray-500">POOL+</p>
              <p className="text-sm font-semibold">{formatCurrency(totals.pool_plus)}</p>
            </div>
          </>
        ) : (
          <div
            className="bg-indigo-50 rounded-lg p-3 text-center cursor-pointer hover:bg-indigo-100 transition-colors"
            onClick={() => openDrillDown('pool')}
            title="Voir le détail POOL"
          >
            <p className="text-xs text-indigo-500">POOL</p>
            <p className="text-sm font-semibold text-indigo-700">{formatCurrency(pool(totals))}</p>
          </div>
        )}
        <div
          className="bg-gray-50 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => openDrillDown('steph_fr')}
          title="Voir le détail Stéphane FR"
        >
          <p className="text-xs text-gray-500">Stéphane FR</p>
          <p className="text-sm font-semibold">{formatCurrency(totals.steph_fr)}</p>
        </div>
        <div
          className="bg-gray-50 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => openDrillDown('steph_asie')}
          title="Voir le détail Stéphane SG"
        >
          <p className="text-xs text-gray-500">Stéphane SG</p>
          <p className="text-sm font-semibold">{formatCurrency(totals.steph_asie)}</p>
        </div>
        <div
          className="bg-gray-50 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => openDrillDown('consultant')}
          title="Voir le détail Consultant"
        >
          <p className="text-xs text-gray-500">Consultant</p>
          <p className="text-sm font-semibold">{formatCurrency(consultantTotal(totals))}</p>
        </div>
        <div
          className="bg-gray-50 rounded-lg p-3 text-center cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => openDrillDown('part_cabinet')}
          title="Voir le détail Cabinet"
        >
          <p className="text-xs text-gray-500">Cabinet</p>
          <p className="text-sm font-semibold">{formatCurrency(totals.part_cabinet)}</p>
        </div>
      </div>

      {/* ───── Drill-down modal ───── */}
      {drillDown && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDrillDown(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">{drillDown.title}</h3>
              <button onClick={() => setDrillDown(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {drillDown.entries.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun dossier</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2 pr-4 font-medium">Dossier</th>
                      <th className="py-2 px-2 font-medium">Mois</th>
                      <th className="py-2 px-2 font-medium text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillDown.entries.map((e, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-4 text-gray-900">{e.label}</td>
                        <td className="py-2 px-2 text-gray-500">{MONTH_LABELS[e.mois] || e.mois}</td>
                        <td className="py-2 px-2 text-right font-medium">{formatCurrency(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t p-4 flex items-center justify-between bg-gray-50 rounded-b-xl">
              <span className="text-sm text-gray-500">{drillDown.entries.length} dossier(s)</span>
              <span className="text-sm font-bold">{formatCurrency(drillDown.total)}</span>
            </div>
          </div>
        </div>
      )}

      {data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Aucun encaissement enregistré
          </CardContent>
        </Card>
      )}

      {/* ───── Sections mensuelles ───── */}
      {byMonth.map(([mois, entries]) => {
        const mt = sumEntries(entries)
        const isExpanded = expandedMonths[mois] !== false
        const page = monthPagination[mois] || 0
        const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE)
        const paginatedEntries = entries.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE)

        return (
          <Card key={mois}>
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleMonth(mois)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-xl">{MONTH_LABELS[mois] || mois}</CardTitle>
                  <span className="text-sm text-gray-500">{entries.length} entrée(s)</span>
                  <span className="text-lg font-bold text-blue-700">{formatCurrency(mt.net_cabinet)}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  {isManager ? (
                    <>
                      <span
                        className="text-purple-600 cursor-pointer hover:underline"
                        onClick={(e) => { e.stopPropagation(); openDrillDown('maxine', mois) }}
                        title="Voir le détail Maxine pour ce mois"
                      >
                        Max: {formatCurrency(mt.maxine)}
                      </span>
                      <span
                        className="text-blue-600 cursor-pointer hover:underline"
                        onClick={(e) => { e.stopPropagation(); openDrillDown('thelo', mois) }}
                        title="Voir le détail Thélo pour ce mois"
                      >
                        Thélo: {formatCurrency(mt.thelo)}
                      </span>
                    </>
                  ) : (
                    <span
                      className="text-indigo-600 cursor-pointer hover:underline"
                      onClick={(e) => { e.stopPropagation(); openDrillDown('pool', mois) }}
                      title="Voir le détail POOL pour ce mois"
                    >
                      POOL: {formatCurrency(pool(mt))}
                    </span>
                  )}
                  <span
                    className="text-gray-600 cursor-pointer hover:underline"
                    onClick={(e) => { e.stopPropagation(); openDrillDown('part_cabinet', mois) }}
                    title="Voir le détail Cabinet pour ce mois"
                  >
                    Cab: {formatCurrency(mt.part_cabinet)}
                  </span>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-2 pr-4 font-medium">Dossier</th>
                        <th className="py-2 px-2 font-medium text-right text-gray-500">Brut</th>
                        <th className="py-2 px-2 font-medium text-right text-orange-600">Apporteur</th>
                        <th className="py-2 px-2 font-medium text-right text-orange-600">Gestion</th>
                        <th className="py-2 px-2 font-medium text-right">Net cabinet</th>
                        {isManager ? (
                          <>
                            <th className="py-2 px-2 font-medium text-right text-purple-600">Maxine</th>
                            <th className="py-2 px-2 font-medium text-right text-blue-600">Thélo</th>
                            <th className="py-2 px-2 font-medium text-right">POOL+</th>
                          </>
                        ) : (
                          <th className="py-2 px-2 font-medium text-right text-indigo-600">POOL</th>
                        )}
                        <th className="py-2 px-2 font-medium text-right">Stéphane FR</th>
                        <th className="py-2 px-2 font-medium text-right">Stéphane SG</th>
                        <th className="py-2 px-2 font-medium text-right">Consultant</th>
                        <th className="py-2 px-2 font-medium text-right">Cabinet</th>
                        <th className="py-2 pl-2 font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEntries.map((entry) => (
                        <MonthRow key={entry.id} entry={entry as any} mois={mois} />
                      ))}
                      <MonthRow
                        entry={mt}
                        isTotalRow
                        label={`Total ${MONTH_LABELS[mois] || mois}`}
                        mois={mois}
                      />
                    </tbody>
                  </table>
                </div>

                {/* Pagination for month entries */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-xs text-gray-600">
                      {entries.length === 0 ? '0' : (page * ITEMS_PER_PAGE) + 1} - {Math.min((page + 1) * ITEMS_PER_PAGE, entries.length)} sur {entries.length}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMonthPagination(prev => ({ ...prev, [mois]: page - 1 }))}
                        disabled={page === 0}
                        className="gap-1"
                      >
                        <ChevronLeft size={14} />
                        Préc.
                      </Button>
                      <span className="text-xs text-gray-600 flex items-center px-2">
                        {page + 1}/{totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMonthPagination(prev => ({ ...prev, [mois]: page + 1 }))}
                        disabled={(page + 1) * ITEMS_PER_PAGE >= entries.length}
                        className="gap-1"
                      >
                        Suiv.
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Modale de confirmation de suppression depuis le drill-down */}
      <DeleteEncaissementModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          showToast('Encaissement supprimé. Recharge la page pour mettre à jour les totaux.', 'success')
          setDrillDown(null)
          setDeleteTarget(null)
          // Soft refresh : recharge la page au prochain tick pour re-fetcher les données
          setTimeout(() => window.location.reload(), 800)
        }}
        line={deleteTarget ? {
          source_id: deleteTarget.source_id,
          source_type: deleteTarget.source_type,
          label: deleteTarget.label,
          mois: MONTH_LABELS[deleteTarget.mois] || deleteTarget.mois,
          montant: deleteTarget.amount,
        } : null}
      />
    </div>
  )
}

// =============================================================================
// SplitsConformityBanner (2026-04-26)
//
// Pastille verte/orange/rouge qui indique le ratio d'encaissements ayant un
// split V4 valide (applied_rule_key non-null). Click → expand qui liste les
// encaissements non-conformes (legacy, à investiguer).
//
// Source : `data` directement (chaque entry vient de v_encaissements_unified
// qui propage applied_rule_key de la table sous-jacente).
// =============================================================================
interface SplitsConformityBannerProps {
  data: ReadonlyArray<unknown>
}

function SplitsConformityBanner({ data }: SplitsConformityBannerProps) {
  const [expanded, setExpanded] = React.useState(false)

  const stats = React.useMemo(() => {
    let total = 0
    let withV4 = 0
    const legacy: Array<{
      label: string
      mois: string
      annee: number
      brute: number
      consultant: string
    }> = []
    for (const raw of data) {
      total += 1
      const entry = raw as Record<string, unknown>
      const ruleKey = entry.applied_rule_key as string | null | undefined
      if (ruleKey) {
        withV4 += 1
      } else {
        legacy.push({
          label: String(entry.label ?? '?'),
          mois: String(entry.mois ?? '?'),
          annee: Number(entry.annee ?? 0),
          brute: Number(entry.commission_brute ?? 0),
          consultant: String(
            entry.consultant_prenom && entry.consultant_nom
              ? `${entry.consultant_prenom} ${entry.consultant_nom}`
              : entry.consultant_prenom ?? entry.consultant_nom ?? '?',
          ),
        })
      }
    }
    const pct = total > 0 ? Math.round((withV4 / total) * 100) : 100
    return { total, withV4, legacy, pct }
  }, [data])

  if (stats.total === 0) return null

  const tone =
    stats.pct === 100
      ? { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', dot: 'bg-green-500', label: 'Conforme' }
      : stats.pct >= 80
        ? { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Partiellement conforme' }
        : { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', dot: 'bg-red-500', label: 'Non conforme' }

  return (
    <div className={`rounded-lg border ${tone.border} ${tone.bg} px-4 py-3`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`inline-block w-3 h-3 rounded-full ${tone.dot}`} />
          <div>
            <div className={`text-sm font-semibold ${tone.text}`}>
              Conformité grille V4 — {tone.label}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              <strong>{stats.withV4}</strong> / {stats.total} encaissements ont la grille de splits V4 appliquée
              {' '}(<strong>{stats.pct}%</strong>)
              {stats.legacy.length > 0 && (
                <span> — {stats.legacy.length} legacy à vérifier</span>
              )}
            </div>
          </div>
        </div>
        {stats.legacy.length > 0 && (
          <div className="text-xs text-gray-500 shrink-0">
            {expanded ? 'Masquer ▲' : 'Voir détail ▼'}
          </div>
        )}
      </button>

      {expanded && stats.legacy.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-2">
            Encaissements sans <code className="bg-white px-1 rounded">applied_rule_key</code> en base —
            il s&apos;agit de saisies historiques ou de cas où le backfill V4 n&apos;a pas pu déterminer
            la règle. Le total et la répartition restent corrects mais aucune trace de
            la règle utilisée n&apos;est conservée.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-2 py-1 font-medium">Période</th>
                  <th className="px-2 py-1 font-medium">Label</th>
                  <th className="px-2 py-1 font-medium">Consultant</th>
                  <th className="px-2 py-1 font-medium text-right">Brut</th>
                </tr>
              </thead>
              <tbody>
                {stats.legacy.slice(0, 30).map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-2 py-1 text-gray-600">
                      {row.mois} {row.annee}
                    </td>
                    <td className="px-2 py-1 text-gray-900">{row.label}</td>
                    <td className="px-2 py-1 text-gray-600">{row.consultant}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-gray-900">
                      {formatCurrency(row.brute)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.legacy.length > 30 && (
              <p className="text-[11px] text-gray-400 mt-2 text-center">
                + {stats.legacy.length - 30} autres
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
