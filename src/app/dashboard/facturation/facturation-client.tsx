'use client'

import * as React from 'react'
import { VDossiersComplets, PaiementType } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/status-badge'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check, FileText } from 'lucide-react'

interface FacturationClientProps {
  initialData: VDossiersComplets[]
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const getFacturationStatus = (
  facturee: boolean | null | undefined,
  payee: PaiementType | null | undefined
): 'à émettre' | 'émise' | 'payée' => {
  if (facturee && payee === 'oui') return 'payée'
  if (facturee) return 'émise'
  return 'à émettre'
}

export function FacturationClient({ initialData }: FacturationClientProps) {
  const [data, setData] = React.useState(initialData)
  const [activeTab, setActiveTab] = React.useState('a-emettre')
  const [loadingIds, setLoadingIds] = React.useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = React.useState(false)

  const supabase = React.useMemo(() => createClient(), [])

  // Reset selection when tab changes
  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [activeTab])

  // Filter data based on active tab
  const filteredData = React.useMemo(() => {
    let result = data
    if (activeTab === 'a-emettre') result = result.filter((d) => !d.facturee)
    else if (activeTab === 'emises') result = result.filter((d) => d.facturee && d.payee !== 'oui')
    else if (activeTab === 'payees') result = result.filter((d) => d.payee === 'oui')
    return result
  }, [data, activeTab])

  // Calculate stats
  const stats = React.useMemo(() => {
    const aEmettre = data.filter((d) => !d.facturee)
    const emises = data.filter((d) => d.facturee && d.payee !== 'oui')
    const payees = data.filter((d) => d.payee === 'oui')
    return {
      aEmettre: { count: aEmettre.length, montant: aEmettre.reduce((sum, d) => sum + (d.montant || 0), 0) },
      emises: { count: emises.length, montant: emises.reduce((sum, d) => sum + (d.montant || 0), 0) },
      payees: { count: payees.length, montant: payees.reduce((sum, d) => sum + (d.montant || 0), 0) },
    }
  }, [data])

  // Selection helpers
  const allFilteredIds = filteredData.map((d) => d.id!).filter(Boolean)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id))
  const someSelected = allFilteredIds.some((id) => selectedIds.has(id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allFilteredIds))
    }
  }

  // Selected dossiers summary
  const selectedDossiers = filteredData.filter((d) => d.id && selectedIds.has(d.id))
  const selectedTotal = selectedDossiers.reduce((sum, d) => sum + (d.commission_brute || 0), 0)

  const handleMarkInvoiced = async (dossier: VDossiersComplets) => {
    if (!dossier.id) return
    setLoadingIds((prev) => new Set(prev).add(dossier.id!))
    try {
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('factures').update({ facturee: true, date_facture: today }).eq('dossier_id', dossier.id)
      if (error) throw error
      setData((prev) => prev.map((d) => d.id === dossier.id ? { ...d, facturee: true, date_facture: today } : d))
    } catch (err) {
      console.error('Error marking as invoiced:', err)
      alert('Erreur lors de la mise à jour')
    } finally {
      setLoadingIds((prev) => { const s = new Set(prev); s.delete(dossier.id!); return s })
    }
  }

  const handleMarkPaid = async (dossier: VDossiersComplets) => {
    if (!dossier.id) return
    setLoadingIds((prev) => new Set(prev).add(dossier.id!))
    try {
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('factures').update({ payee: 'oui' as PaiementType, date_paiement: today }).eq('dossier_id', dossier.id)
      if (error) throw error
      setData((prev) => prev.map((d) => d.id === dossier.id ? { ...d, payee: 'oui' as PaiementType, date_paiement: today } : d))
    } catch (err) {
      console.error('Error marking as paid:', err)
      alert('Erreur lors de la mise à jour')
    } finally {
      setLoadingIds((prev) => { const s = new Set(prev); s.delete(dossier.id!); return s })
    }
  }

  // Bulk invoice: mark all selected as facturée
  const handleBulkInvoice = async () => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const ids = Array.from(selectedIds)
    try {
      // Update each selected dossier (Supabase doesn't support IN for update on factures easily without array ops)
      const results = await Promise.all(
        ids.map((id) =>
          supabase.from('factures').update({ facturee: true, date_facture: today }).eq('dossier_id', id)
        )
      )
      const errors = results.filter((r) => r.error)
      if (errors.length > 0) {
        console.error('Some updates failed:', errors)
        alert(`${errors.length} mise(s) à jour ont échoué`)
      }
      // Update local state for all that succeeded
      setData((prev) =>
        prev.map((d) => (d.id && selectedIds.has(d.id)) ? { ...d, facturee: true, date_facture: today } : d)
      )
      setSelectedIds(new Set())
    } catch (err) {
      console.error('Error in bulk invoice:', err)
      alert('Erreur lors de la création de la facture groupée')
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Facturation</h1>
        <p className="text-gray-600 mt-1">Suivi des factures et des paiements</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600">À émettre</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.aEmettre.count}</p>
          <p className="text-xs text-gray-500 mt-1">{formatCurrency(stats.aEmettre.montant)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Émises</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.emises.count}</p>
          <p className="text-xs text-gray-500 mt-1">{formatCurrency(stats.emises.montant)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Payées</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.payees.count}</p>
          <p className="text-xs text-gray-500 mt-1">{formatCurrency(stats.payees.montant)}</p>
        </Card>
      </div>

      {/* Tabs and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Factures</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="a-emettre" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="a-emettre">À émettre ({stats.aEmettre.count})</TabsTrigger>
              <TabsTrigger value="emises">Émises ({stats.emises.count})</TabsTrigger>
              <TabsTrigger value="payees">Payées ({stats.payees.count})</TabsTrigger>
            </TabsList>

            {/* À ÉMETTRE — with multi-select */}
            <TabsContent value="a-emettre" className="mt-4 space-y-3">
              {/* Bulk action bar */}
              {someSelected && (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                  <div className="text-sm text-indigo-800">
                    <span className="font-semibold">{selectedIds.size} dossier(s) sélectionné(s)</span>
                    {selectedTotal > 0 && (
                      <span className="ml-2 text-indigo-600">— Commission totale : {formatCurrency(selectedTotal)}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleBulkInvoice}
                    disabled={bulkLoading}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    Créer la facture groupée
                  </Button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Produit</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Compagnie</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Montant</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Commission</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length > 0 ? (
                      filteredData.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-b border-gray-200 hover:bg-gray-50 cursor-pointer ${row.id && selectedIds.has(row.id) ? 'bg-indigo-50' : ''}`}
                          onClick={() => row.id && toggleSelect(row.id)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!(row.id && selectedIds.has(row.id))}
                              onChange={() => row.id && toggleSelect(row.id)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-4 py-3">{row.client_prenom} {row.client_nom}</td>
                          <td className="px-4 py-3">{row.produit_nom || '-'}</td>
                          <td className="px-4 py-3">{row.compagnie_nom || '-'}</td>
                          <td className="px-4 py-3">{formatCurrency(row.montant)}</td>
                          <td className="px-4 py-3">{formatCurrency(row.commission_brute)}</td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkInvoiced(row)}
                              disabled={loadingIds.has(row.id!)}
                              className="gap-1 text-xs"
                            >
                              {loadingIds.has(row.id!) ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              Facturer
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-500">Aucune facture à émettre</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ÉMISES */}
            <TabsContent value="emises" className="mt-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Produit</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Compagnie</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Montant</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Commission</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Date facture</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length > 0 ? (
                      filteredData.map((row) => (
                        <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3">{row.client_prenom} {row.client_nom}</td>
                          <td className="px-4 py-3">{row.produit_nom || '-'}</td>
                          <td className="px-4 py-3">{row.compagnie_nom || '-'}</td>
                          <td className="px-4 py-3">{formatCurrency(row.montant)}</td>
                          <td className="px-4 py-3">{formatCurrency(row.commission_brute)}</td>
                          <td className="px-4 py-3">
                            {row.date_facture ? new Date(row.date_facture).toLocaleDateString('fr-FR') : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              onClick={() => handleMarkPaid(row)}
                              disabled={loadingIds.has(row.id!)}
                              className="gap-2"
                            >
                              {loadingIds.has(row.id!) ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              Marquer payée
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-500">Aucune facture émise en attente de paiement</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* PAYÉES */}
            <TabsContent value="payees" className="mt-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Produit</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Compagnie</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Montant</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Commission</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Date facture</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length > 0 ? (
                      filteredData.map((row) => (
                        <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3">{row.client_prenom} {row.client_nom}</td>
                          <td className="px-4 py-3">{row.produit_nom || '-'}</td>
                          <td className="px-4 py-3">{row.compagnie_nom || '-'}</td>
                          <td className="px-4 py-3">{formatCurrency(row.montant)}</td>
                          <td className="px-4 py-3">{formatCurrency(row.commission_brute)}</td>
                          <td className="px-4 py-3">
                            {row.date_facture ? new Date(row.date_facture).toLocaleDateString('fr-FR') : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status="payée" type="facturation" />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-500">Aucune facture payée</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
