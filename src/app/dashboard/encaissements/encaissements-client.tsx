'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Users, Download, ChevronDown, ChevronUp } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
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

interface EncaissementsClientProps {
  initialData: RemEntry[]
  role?: string
  facturesPaid?: any[]
}

export function EncaissementsClient({ initialData, role = 'manager', facturesPaid = [] }: EncaissementsClientProps) {
  // Back office sees POOL (thelo+maxine+pool_plus) instead of individual split
  const isBackOffice = role === 'back_office'
  const [data] = React.useState(initialData)
  const [expandedMonths, setExpandedMonths] = React.useState<Record<string, boolean>>({})

  const toggleMonth = (mois: string) => {
    setExpandedMonths(prev => ({ ...prev, [mois]: !prev[mois] }))
  }

  // Group by month
  const byMonth = React.useMemo(() => {
    const grouped: Record<string, RemEntry[]> = {}
    data.forEach(entry => {
      if (!grouped[entry.mois]) grouped[entry.mois] = []
      grouped[entry.mois].push(entry)
    })
    return Object.entries(grouped)
      .sort(([a], [b]) => (MONTH_ORDER[a] || 99) - (MONTH_ORDER[b] || 99))
  }, [data])

  // Grand totals — from encaissements_rem, or fallback to facturesPaid
  const totals = React.useMemo(() => {
    if (data.length > 0) {
      return data.reduce(
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
        { net_cabinet: 0, pool_plus: 0, thelo: 0, maxine: 0, steph_asie: 0, steph_fr: 0, consultant: 0, mathias: 0, part_cabinet: 0 }
      )
    }
    // Fallback: compute from paid factures
    const totalCommission = facturesPaid.reduce((s: number, f: any) => s + (f.commission_brute || 0), 0)
    const totalConsultant = facturesPaid.reduce((s: number, f: any) => s + (f.rem_apporteur || 0), 0)
    const totalCabinet = facturesPaid.reduce((s: number, f: any) => s + (f.part_cabinet || 0), 0)
    return {
      net_cabinet: totalCommission,
      pool_plus: 0, thelo: 0, maxine: 0,
      steph_asie: 0, steph_fr: 0,
      consultant: totalConsultant,
      mathias: 0,
      part_cabinet: totalCabinet,
    }
  }, [data, facturesPaid])

  const monthTotals = React.useCallback((entries: RemEntry[]) => {
    return entries.reduce(
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
      { net_cabinet: 0, pool_plus: 0, thelo: 0, maxine: 0, steph_asie: 0, steph_fr: 0, consultant: 0, mathias: 0, part_cabinet: 0 }
    )
  }, [])

  const handleExportCSV = React.useCallback(() => {
    const header = 'Mois;Label;Net Cabinet;POOL+;Thélo;Maxine;Stéph Asie;Stéph FR;Consultant;Mathias;Cabinet'
    const rows = data.map(e =>
      `${MONTH_LABELS[e.mois] || e.mois};${e.label};${e.net_cabinet};${e.pool_plus};${e.thelo};${e.maxine};${e.steph_asie};${e.steph_fr};${e.consultant};${e.mathias};${e.part_cabinet}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `encaissements_rem_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [data])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Encaissements</h1>
          <p className="text-gray-600 mt-1">
            Commissions reçues et répartition — {data.length > 0 ? `${data.length} entrée(s) sur ${byMonth.length} mois` : `${facturesPaid.length} facture(s) encaissée(s)`}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
          <Download size={18} />
          Exporter CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Total encaissé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totals.net_cabinet)}</p>
          </CardContent>
        </Card>
        {isBackOffice ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                POOL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-indigo-700">{formatCurrency(totals.thelo + totals.maxine + totals.pool_plus)}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Users size={16} className="text-purple-600" />
                  Maxine
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-purple-700">{formatCurrency(totals.maxine)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Thélo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(totals.thelo)}</p>
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Cabinet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-700">{formatCurrency(totals.part_cabinet)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed breakdown cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {!isBackOffice && (
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">POOL+</p>
            <p className="text-sm font-semibold">{formatCurrency(totals.pool_plus)}</p>
          </div>
        )}
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">Stéph FR</p>
          <p className="text-sm font-semibold">{formatCurrency(totals.steph_fr)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">Stéph Asie</p>
          <p className="text-sm font-semibold">{formatCurrency(totals.steph_asie)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">Consultant</p>
          <p className="text-sm font-semibold">{formatCurrency(totals.consultant)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">Mathias</p>
          <p className="text-sm font-semibold">{formatCurrency(totals.mathias)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">Entrées</p>
          <p className="text-sm font-semibold">{data.length}</p>
        </div>
      </div>

      {/* Factures encaissées (payées) — affiché quand encaissements_rem est vide ou en complément */}
      {data.length === 0 && facturesPaid.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} className="text-green-600" />
              Factures encaissées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4 font-medium">Client</th>
                    <th className="py-2 px-2 font-medium">Consultant</th>
                    <th className="py-2 px-2 font-medium">Produit</th>
                    <th className="py-2 px-2 font-medium text-right">Montant</th>
                    <th className="py-2 px-2 font-medium text-right">Commission</th>
                    <th className="py-2 px-2 font-medium text-right">Part consultant</th>
                    <th className="py-2 px-2 font-medium text-right">Date facture</th>
                  </tr>
                </thead>
                <tbody>
                  {facturesPaid.map((f: any, i: number) => (
                    <tr key={f.id || i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-900">{f.client_prenom} {f.client_nom}</td>
                      <td className="py-2 px-2 text-gray-600">{f.consultant_prenom} {f.consultant_nom}</td>
                      <td className="py-2 px-2 text-gray-600">{f.produit_nom || '-'}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(f.montant)}</td>
                      <td className="py-2 px-2 text-right font-semibold">{formatCurrency(f.commission_brute)}</td>
                      <td className="py-2 px-2 text-right text-indigo-700">{formatCurrency(f.rem_apporteur)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{f.date_facture ? new Date(f.date_facture).toLocaleDateString('fr-FR') : '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td className="py-2 pr-4" colSpan={3}>Total</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(facturesPaid.reduce((s: number, f: any) => s + (f.montant || 0), 0))}</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(facturesPaid.reduce((s: number, f: any) => s + (f.commission_brute || 0), 0))}</td>
                    <td className="py-2 px-2 text-right text-indigo-700">{formatCurrency(facturesPaid.reduce((s: number, f: any) => s + (f.rem_apporteur || 0), 0))}</td>
                    <td className="py-2 px-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.length === 0 && facturesPaid.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Aucun encaissement enregistré
          </CardContent>
        </Card>
      )}

      {/* Monthly sections (encaissements_rem) */}
      {byMonth.map(([mois, entries]) => {
        const mt = monthTotals(entries)
        const isExpanded = expandedMonths[mois] !== false // default expanded
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
                  {isBackOffice ? (
                    <span className="text-indigo-600">POOL: {formatCurrency(mt.maxine + mt.thelo + mt.pool_plus)}</span>
                  ) : (
                    <>
                      <span className="text-purple-600">Max: {formatCurrency(mt.maxine)}</span>
                      <span className="text-blue-600">Thélo: {formatCurrency(mt.thelo)}</span>
                    </>
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
                        {isBackOffice ? (
                          <th className="py-2 px-2 font-medium text-right text-indigo-600">POOL</th>
                        ) : (
                          <>
                            <th className="py-2 px-2 font-medium text-right">POOL+</th>
                            <th className="py-2 px-2 font-medium text-right text-blue-600">Thélo</th>
                            <th className="py-2 px-2 font-medium text-right text-purple-600">Maxine</th>
                          </>
                        )}
                        <th className="py-2 px-2 font-medium text-right">Stéph FR</th>
                        <th className="py-2 px-2 font-medium text-right">Consultant</th>
                        <th className="py-2 px-2 font-medium text-right">Mathias</th>
                        <th className="py-2 px-2 font-medium text-right">Cabinet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 pr-4 font-medium text-gray-900">{entry.label}</td>
                          <td className="py-2 px-2 text-right font-semibold">{formatCurrency(Number(entry.net_cabinet))}</td>
                          {isBackOffice ? (
                            <td className="py-2 px-2 text-right text-indigo-700 font-medium">{formatCurrency(Number(entry.thelo) + Number(entry.maxine) + Number(entry.pool_plus))}</td>
                          ) : (
                            <>
                              <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(Number(entry.pool_plus))}</td>
                              <td className="py-2 px-2 text-right text-blue-700 font-medium">{formatCurrency(Number(entry.thelo))}</td>
                              <td className="py-2 px-2 text-right text-purple-700 font-medium">{formatCurrency(Number(entry.maxine))}</td>
                            </>
                          )}
                          <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(Number(entry.steph_fr))}</td>
                          <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(Number(entry.consultant))}</td>
                          <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(Number(entry.mathias))}</td>
                          <td className="py-2 px-2 text-right text-gray-600">{formatCurrency(Number(entry.part_cabinet))}</td>
                        </tr>
                      ))}
                      {/* Month total row */}
                      <tr className="bg-gray-100 font-bold">
                        <td className="py-2 pr-4">Total {MONTH_LABELS[mois]}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(mt.net_cabinet)}</td>
                        {isBackOffice ? (
                          <td className="py-2 px-2 text-right text-indigo-700">{formatCurrency(mt.thelo + mt.maxine + mt.pool_plus)}</td>
                        ) : (
                          <>
                            <td className="py-2 px-2 text-right">{formatCurrency(mt.pool_plus)}</td>
                            <td className="py-2 px-2 text-right text-blue-700">{formatCurrency(mt.thelo)}</td>
                            <td className="py-2 px-2 text-right text-purple-700">{formatCurrency(mt.maxine)}</td>
                          </>
                        )}
                        <td className="py-2 px-2 text-right">{formatCurrency(mt.steph_fr)}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(mt.consultant)}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(mt.mathias)}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(mt.part_cabinet)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Section Factures encaissées supprimée — seul le détail mensuel est conservé */}
    </div>
  )
}
