'use client'

import * as React from 'react'
import { VDossiersComplets, PaiementType, TablesUpdate } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/status-badge'
// Compteur encaissements 2026
  const [encaissementsCount, setEncaissementsCount] = React.useState<number>(0)
  React.useEffect(() => {
    const fetchEncaissements = async () => {
      const supabase = createClient()
      const { count } = await supabase
        .from('encaissements')
        .select('*', { count: 'exact', head: true })
        .eq('annee', 2026)
      setEncaissementsCount(count || 0)
    }
    fetchEncaissements()
  }, [])
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check, FileText, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface FacturationClientProps {
  initialData: VDossiersComplets[]
}

import { formatCurrency } from '@/lib/formatting'

const getFacturationStatus = (
  facturee: boolean | null | undefined,
  payee: PaiementType | null | undefined
): 'à émettre' | 'émise' | 'payée' => {
  if (facturee && payee === 'oui') return 'payée'
  if (facturee) return 'émise'
  return 'à émettre'
}

export function FacturationClient({ initialData }: FacturationClientProps) {
  // Deduplicate data by dossier id (view can produce duplicates)
  const dedupedData = React.useMemo(() => {
    const map = new Map<string, VDossiersComplets>()
    initialData.forEach(d => { if (d.id && !map.has(d.id)) map.set(d.id, d) })
    return Array.from(map.values())
  }, [initialData])
  const [data, setData] = React.useState(dedupedData)
  const [activeTab, setActiveTab] = React.useState('a-emettre')
  const [loadingIds, setLoadingIds] = React.useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [sortField, setSortField] = React.useState<string>('date_operation')
  const [sortAsc, setSortAsc] = React.useState(false)

  const supabase = React.useMemo(() => createClient(), [])

  // Reset selection when tab changes
  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [activeTab])

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  // Filter data based on active tab + search + sort
  const filteredData = React.useMemo(() => {
    let result = data
    if (activeTab === 'a-emettre') result = result.filter((d) => !d.facturee)
    else if (activeTab === 'emises') result = result.filter((d) => d.facturee && d.payee !== 'oui')
    else if (activeTab === 'payees') result = result.filter((d) => d.payee === 'oui')
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((d) => {
        const text = [d.client_prenom, d.client_nom, d.produit_nom, d.compagnie_nom, d.consultant_prenom, d.consultant_nom].filter(Boolean).join(' ').toLowerCase()
        return text.includes(q)
      })
    }
    // Sort
    result = [...result].sort((a, b) => {
      let va: any, vb: any
      if (sortField === 'client') { va = `${a.client_nom} ${a.client_prenom}`.toLowerCase(); vb = `${b.client_nom} ${b.client_prenom}`.toLowerCase() }
      else if (sortField === 'produit_nom') { va = (a.produit_nom || '').toLowerCase(); vb = (b.produit_nom || '').toLowerCase() }
      else if (sortField === 'montant') { va = a.montant || 0; vb = b.montant || 0 }
      else if (sortField === 'commission_brute') { va = a.commission_brute || 0; vb = b.commission_brute || 0 }
      else if (sortField === 'date_operation') { va = a.date_operation || ''; vb = b.date_operation || '' }
      else if (sortField === 'date_facture') { va = a.date_facture || ''; vb = b.date_facture || '' }
      else { va = ''; vb = '' }
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })
    return result
  }, [data, activeTab, searchQuery, sortField, sortAsc])

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

  // Helper: upsert facture (update if exists, insert if not)
  const upsertFacture = async (dossierId: string, fields: TablesUpdate<'factures'>) => {
    const { data: updated, error: updateErr } = await supabase
      .from('factures')
      .update(fields)
      .eq('dossier_id', dossierId)
      .select()
    if (updateErr) throw updateErr
    // If update matched 0 rows, insert a new facture
    if (!updated || updated.length === 0) {
      const { error: insertErr } = await supabase.from('factures').insert({
        dossier_id: dossierId,
        facturee: fields.facturee ?? false,
        payee: fields.payee ?? 'non',
        date_facture: fields.date_facture ?? null,
        date_paiement: fields.date_paiement ?? null,
      })
      if (insertErr) throw insertErr
    }
  }

  const handleMarkInvoiced = async (dossier: VDossiersComplets) => {
    if (!dossier.id) return
    setLoadingIds((prev) => new Set(prev).add(dossier.id!))
    try {
      const today = new Date().toISOString().split('T')[0]
      await upsertFacture(dossier.id, { facturee: true, date_facture: today })
      setData((prev) => prev.map((d) => d.id === dossier.id ? { ...d, facturee: true, date_facture: today } : d))
    } catch (err) {
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
      await upsertFacture(dossier.id, { facturee: true, payee: 'oui', date_paiement: today })
      setData((prev) => prev.map((d) => d.id === dossier.id ? { ...d, payee: 'oui' as PaiementType, date_paiement: today } : d))
    } catch (err) {
      alert('Erreur lors de la mise à jour')
    } finally {
      setLoadingIds((prev) => { const s = new Set(prev); s.delete(dossier.id!); return s })
    }
  }

  // Bulk invoice: mark all selected as facturée (upsert if facture row missing)
  const handleBulkInvoice = async () => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const ids = Array.from(selectedIds)
    let errorCount = 0
    try {
      await Promise.all(
        ids.map(async (id) => {
          try {
            await upsertFacture(id, { facturee: true, date_facture: today })
          } catch (err) {
            errorCount++
          }
        })
      )
      if (errorCount > 0) {
        alert(`${errorCount} mise(s) à jour ont échoué`)
      }
      // Update local state for all that succeeded
      setData((prev) =>
        prev.map((d) => (d.id && selectedIds.has(d.id)) ? { ...d, facturee: true, date_facture: today } : d)
      )
      setSelectedIds(new Set())
    } catch (err) {
      alert('Erreur lors de la création de la facture groupée')
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Facturation</h1>
          <p className="text-gray-600 mt-1">Suivi des factures et des paiements</p>
        </div>
        <div className="relative w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Rechercher un client, produit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
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
          <p className="text-sm text-gray-600">Encaissements 2026</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{encaissementsCount}</p>
          <p className="text-xs text-gray-500 mt-1">depuis janvier 2026</p>
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
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('client')}>Client {sortField === 'client' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('produit_nom')}>Produit {sortField === 'produit_nom' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Compagnie</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('date_operation')}>Date {sortField === 'date_operation' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('montant')}>Montant {sortField === 'montant' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('commission_brute')}>Commission {sortField === 'commission_brute' ? (sortAsc ? '↑' : '↓') : ''}</th>
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
                          <td className="px-4 py-3 text-xs text-gray-500">{row.date_operation ? new Date(row.date_operation).toLocaleDateString('fr-FR') : '-'}</td>
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
                        <td colSpan={8} className="px-4 py-6 text-center text-gray-500">Aucune facture à émettre</td>
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
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('client')}>Client {sortField === 'client' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('produit_nom')}>Produit {sortField === 'produit_nom' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Compagnie</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('montant')}>Montant {sortField === 'montant' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('commission_brute')}>Commission {sortField === 'commission_brute' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('date_facture')}>Date facture {sortField === 'date_facture' ? (sortAsc ? '↑' : '↓') : ''}</th>
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
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('client')}>Client {sortField === 'client' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('produit_nom')}>Produit {sortField === 'produit_nom' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Compagnie</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('montant')}>Montant {sortField === 'montant' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('commission_brute')}>Commission {sortField === 'commission_brute' ? (sortAsc ? '↑' : '↓') : ''}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('date_facture')}>Date facture {sortField === 'date_facture' ? (sortAsc ? '↑' : '↓') : ''}</th>
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
