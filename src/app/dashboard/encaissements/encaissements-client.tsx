'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Download, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { VDossiersComplets } from '@/types/database'

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

interface RemEntry {
  id: string
  mois: string
  label: string
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

interface Totals {
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

const ZERO_TOTALS: Totals = { net_cabinet: 0, pool_plus: 0, thelo: 0, maxine: 0, steph_asie: 0, steph_fr: 0, consultant: 0, mathias: 0, part_cabinet: 0 }

const sumEntries = (entries: RemEntry[]): Totals =>
  entries.reduce(
    (acc, e) => ({
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

function isFrance(clientPays: string | null): boolean {
  if (!clientPays) return true // default to FR if unknown
  const p = clientPays.toUpperCase().trim()
  return p === 'FRANCE' || p === 'FR'
}

function factureToRemEntry(f: VDossiersComplets): RemEntry {
  const commBrute = Number(f.commission_brute || 0)
  const remApporteur = Number(f.rem_apporteur || 0)
  const partCabinet = Number(f.part_cabinet || 0)

  // POOL = what's left after consultant + cabinet
  const poolTotal = Math.max(0, commBrute - remApporteur - partCabinet)
  const poolThird = poolTotal / 3

  // Determine month from date_facture
  let mois = 'INCONNU'
  if (f.date_facture) {
    const d = new Date(f.date_facture)
    const monthNames = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE']
    mois = monthNames[d.getMonth()] || 'INCONNU'
  }

  const label = `${f.client_prenom || ''} ${f.client_nom || ''}`.trim() +
    (f.produit_nom ? ` — ${f.produit_nom}` : '')

  // Determine who gets rem_apporteur
  const stephane = isStephane(f.consultant_nom)
  const france = isFrance(f.client_pays)

  return {
    id: f.id || `f-${Math.random()}`,
    mois,
    label,
    net_cabinet: commBrute,
    pool_plus: poolThird,
    thelo: poolThird,
    maxine: poolThird,
    steph_fr: stephane && france ? remApporteur : 0,
    steph_asie: stephane && !france ? remApporteur : 0,
    consultant: !stephane ? remApporteur : 0,
    mathias: 0,
    part_cabinet: partCabinet,
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

interface DrillDownInfo {
  title: string
  entries: { label: string; mois: string; amount: number }[]
  total: number
}

// ───── Component ─────

interface EncaissementsClientProps {
  initialData: RemEntry[]
  role?: string
  facturesPaid?: VDossiersComplets[]
}

export function EncaissementsClient({ initialData, role = 'manager', facturesPaid = [] }: EncaissementsClientProps) {
  const isBackOffice = role === 'back_office'
  const isManager = !isBackOffice
  const [expandedMonths, setExpandedMonths] = React.useState<Record<string, boolean>>({})
  const [drillDown, setDrillDown] = React.useState<DrillDownInfo | null>(null)
  const [monthPagination, setMonthPagination] = React.useState<Record<string, number>>({})

  const toggleMonth = (mois: string) => {
    setExpandedMonths(prev => ({ ...prev, [mois]: !prev[mois] }))
  }

  // Merge encaissements_rem with computed facturesPaid entries
  // encaissements_rem may not include recent dossiers (e.g. paid this month)
  const data: RemEntry[] = React.useMemo(() => {
    if (initialData.length === 0) return facturesPaid.map(factureToRemEntry)
    if (facturesPaid.length === 0) return initialData

    // Build set of dossier IDs already covered by encaissements_rem
    const existingIds = new Set(initialData.map(e => e.id))

    // Compute entries from facturesPaid that are NOT already in initialData
    const extraEntries = facturesPaid
      .filter(f => f.id && !existingIds.has(f.id))
      .map(factureToRemEntry)

    return [...initialData, ...extraEntries]
  }, [initialData, facturesPaid])

  // Drill-down: show dossiers for a given column, optionally filtered by month
  const openDrillDown = (col: ColKey, mois?: string) => {
    const source = mois ? data.filter(e => e.mois === mois) : data
    const entries = source
      .map(e => ({ label: e.label, mois: e.mois, amount: getEntryValue(e, col) }))
      .filter(e => e.amount !== 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    const total = entries.reduce((s, e) => s + e.amount, 0)
    const monthLabel = mois ? (MONTH_LABELS[mois] || mois) + ' — ' : ''
    setDrillDown({ title: `${monthLabel}${COL_LABELS[col]}`, entries, total })
  }

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
      header = 'Mois;Label;Net Cabinet;POOL;Stéphane FR;Stéphane SG;Consultant;Cabinet'
      rows = data.map(e =>
        `${MONTH_LABELS[e.mois] || e.mois};${e.label};${e.net_cabinet};${Number(e.pool_plus || 0) + Number(e.thelo || 0) + Number(e.maxine || 0)};${e.steph_fr};${e.steph_asie};${Number(e.consultant || 0) + Number(e.mathias || 0)};${e.part_cabinet}`
      )
    } else {
      header = 'Mois;Label;Net Cabinet;Maxine;Thélo;POOL+;Stéphane FR;Stéphane SG;Consultant;Cabinet'
      rows = data.map(e =>
        `${MONTH_LABELS[e.mois] || e.mois};${e.label};${e.net_cabinet};${e.maxine};${e.thelo};${e.pool_plus};${e.steph_fr};${e.steph_asie};${Number(e.consultant || 0) + Number(e.mathias || 0)};${e.part_cabinet}`
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

  // ───── Cellule cliquable ─────
  const ClickableCell = ({ value, col, mois, className = '' }: { value: number; col: ColKey; mois?: string; className?: string }) => {
    const display = formatCurrency(value)
    if (display === '-') return <td className={`py-2 px-2 text-right ${className}`}>-</td>
    return (
      <td
        className={`py-2 px-2 text-right cursor-pointer hover:bg-indigo-50 hover:underline rounded transition-colors ${className}`}
        onClick={(e) => { e.stopPropagation(); openDrillDown(col, mois) }}
        title={`Voir le détail ${COL_LABELS[col]}`}
      >
        {display}
      </td>
    )
  }

  // ───── Ligne du tableau mensuel ─────
  const MonthRow = ({ entry, isTotalRow, label, mois }: { entry: Totals & { label?: string }; isTotalRow?: boolean; label?: string; mois: string }) => {
    const cls = isTotalRow ? 'bg-gray-100 font-bold' : 'border-b border-gray-100 hover:bg-gray-50'
    return (
      <tr className={cls}>
        <td className="py-2 pr-4 font-medium text-gray-900">{label || (entry as any).label}</td>
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
        <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
          <Download size={18} />
          Exporter CSV
        </Button>
      </div>

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
                      <span className="text-purple-600">Max: {formatCurrency(mt.maxine)}</span>
                      <span className="text-blue-600">Thélo: {formatCurrency(mt.thelo)}</span>
                    </>
                  ) : (
                    <span className="text-indigo-600">POOL: {formatCurrency(pool(mt))}</span>
                  )}
                  <span className="text-gray-600">Cab: {formatCurrency(mt.part_cabinet)}</span>
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
    </div>
  )
}
