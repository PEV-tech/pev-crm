'use client'

import * as React from 'react'
import { VDossiersComplets, PaiementType } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { createClient } from '@supabase/supabase-js'
import { Loader2, Check, X } from 'lucide-react'

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

  const supabase = React.useMemo(() => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }, [])

  // Filter data based on active tab
  const filteredData = React.useMemo(() => {
    let result = data

    if (activeTab === 'a-emettre') {
      result = result.filter((d) => !d.facturee)
    } else if (activeTab === 'emises') {
      result = result.filter((d) => d.facturee && d.payee !== 'oui')
    } else if (activeTab === 'payees') {
      result = result.filter((d) => d.payee === 'oui')
    }

    return result
  }, [data, activeTab])

  // Calculate stats
  const stats = React.useMemo(() => {
    const aEmettre = data.filter((d) => !d.facturee)
    const emises = data.filter((d) => d.facturee && d.payee !== 'oui')
    const payees = data.filter((d) => d.payee === 'oui')

    return {
      aEmettre: {
        count: aEmettre.length,
        montant: aEmettre.reduce((sum, d) => sum + (d.montant || 0), 0),
      },
      emises: {
        count: emises.length,
        montant: emises.reduce((sum, d) => sum + (d.montant || 0), 0),
      },
      payees: {
        count: payees.length,
        montant: payees.reduce((sum, d) => sum + (d.montant || 0), 0),
      },
    }
  }, [data])

  const handleMarkInvoiced = async (dossier: VDossiersComplets) => {
    if (!dossier.id) return

    setLoadingIds((prev) => new Set(prev).add(dossier.id!))

    try {
      const today = new Date().toISOString().split('T')[0]

      // Update factures table
      const { error } = await supabase
        .from('factures')
        .update({
          facturee: true,
          date_facture: today,
        })
        .eq('dossier_id', dossier.id)

      if (error) throw error

      // Update local state
      setData((prev) =>
        prev.map((d) =>
          d.id === dossier.id
            ? { ...d, facturee: true, date_facture: today }
            : d
        )
      )
    } catch (err) {
      console.error('Error marking as invoiced:', err)
      alert('Erreur lors de la mise à jour')
    } finally {
      setLoadingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(dossier.id!)
        return newSet
      })
    }
  }

  const handleMarkPaid = async (dossier: VDossiersComplets) => {
    if (!dossier.id) return

    setLoadingIds((prev) => new Set(prev).add(dossier.id!))

    try {
      const today = new Date().toISOString().split('T')[0]

      // Update factures table
      const { error } = await supabase
        .from('factures')
        .update({
          payee: 'oui' as PaiementType,
          date_paiement: today,
        })
        .eq('dossier_id', dossier.id)

      if (error) throw error

      // Update local state
      setData((prev) =>
        prev.map((d) =>
          d.id === dossier.id
            ? { ...d, payee: 'oui' as PaiementType, date_facture: today }
            : d
        )
      )
    } catch (err) {
      console.error('Error marking as paid:', err)
      alert('Erreur lors de la mise à jour')
    } finally {
      setLoadingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(dossier.id!)
        return newSet
      })
    }
  }

  // Table columns
  const columns: ColumnDefinition<VDossiersComplets>[] = [
    {
      key: 'client_nom',
      label: 'Client',
      sortable: true,
      render: (_, row) => (
        <div className="text-sm">
          {row.client_prenom} {row.client_nom}
        </div>
      ),
    },
    {
      key: 'produit_nom',
      label: 'Produit',
      sortable: true,
    },
    {
      key: 'compagnie_nom',
      label: 'Compagnie',
      sortable: true,
    },
    {
      key: 'montant',
      label: 'Montant',
      sortable: true,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'commission_brute',
      label: 'Commission',
      sortable: true,
      render: (value) => formatCurrency(value),
    },
    {
      key: 'date_facture',
      label: 'Date facture',
      sortable: true,
      render: (value) => {
        if (!value) return '-'
        return new Date(value).toLocaleDateString('fr-FR')
      },
    },
    {
      key: 'facturee',
      label: 'Statut',
      sortable: true,
      render: (_, row) => {
        const status = getFacturationStatus(row.facturee, row.payee)
        return (
          <StatusBadge status={status} type="facturation" />
        )
      },
    },
  ]

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
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats.aEmettre.count}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(stats.aEmettre.montant)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Émises</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats.emises.count}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(stats.emises.montant)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Payées</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats.payees.count}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(stats.payees.montant)}
          </p>
        </Card>
      </div>

      {/* Tabs and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Factures</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="a-emettre"
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="a-emettre">
                À émettre ({stats.aEmettre.count})
              </TabsTrigger>
              <TabsTrigger value="emises">
                Émises ({stats.emises.count})
              </TabsTrigger>
              <TabsTrigger value="payees">
                Payées ({stats.payees.count})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="a-emettre" className="mt-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Produit
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Compagnie
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Montant
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Commission
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length > 0 ? (
                      filteredData.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-gray-200 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            {row.client_prenom} {row.client_nom}
                          </td>
                          <td className="px-4 py-3">
                            {row.produit_nom || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {row.compagnie_nom || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {formatCurrency(row.montant)}
                          </td>
                          <td className="px-4 py-3">
                            {formatCurrency(row.commission_brute)}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              onClick={() => handleMarkInvoiced(row)}
                              disabled={loadingIds.has(row.id!)}
                              className="gap-2"
                            >
                              {loadingIds.has(row.id!) ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Check size={14} />
                              )}
                              Marquer facturée
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-3 text-center text-gray-500"
                        >
                          Aucune facture à émettre
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="emises" className="mt-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Produit
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Compagnie
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Montant
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Commission
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Date facture
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length > 0 ? (
                      filteredData.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-gray-200 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            {row.client_prenom} {row.client_nom}
                          </td>
                          <td className="px-4 py-3">
                            {row.produit_nom || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {row.compagnie_nom || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {formatCurrency(row.montant)}
                          </td>
                          <td className="px-4 py-3">
                            {formatCurrency(row.commission_brute)}
                          </td>
                          <td className="px-4 py-3">
                            {row.date_facture
                              ? new Date(row.date_facture).toLocaleDateString(
                                  'fr-FR'
                                )
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              onClick={() => handleMarkPaid(row)}
                              disabled={loadingIds.has(row.id!)}
                              className="gap-2"
                            >
                              {loadingIds.has(row.id!) ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Check size={14} />
                              )}
                              Marquer payée
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-3 text-center text-gray-500"
                        >
                          Aucune facture émise en attente de paiement
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="payees" className="mt-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Produit
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Compagnie
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Montant
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Commission
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Date facture
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length > 0 ? (
                      filteredData.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-gray-200 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            {row.client_prenom} {row.client_nom}
                          </td>
                          <td className="px-4 py-3">
                            {row.produit_nom || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {row.compagnie_nom || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {formatCurrency(row.montant)}
                          </td>
                          <td className="px-4 py-3">
                            {formatCurrency(row.commission_brute)}
                          </td>
                          <td className="px-4 py-3">
                            {row.date_facture
                              ? new Date(row.date_facture).toLocaleDateString(
                                  'fr-FR'
                                )
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status="payée" type="facturation" />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-3 text-center text-gray-500"
                        >
                          Aucune facture payée
                        </td>
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
