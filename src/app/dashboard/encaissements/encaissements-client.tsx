'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const PayeeBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; variant: string; icon: any }> = {
    oui: { label: 'Payé', variant: 'success', icon: CheckCircle },
    en_cours: { label: 'En cours', variant: 'warning', icon: Clock },
    non: { label: 'Non payé', variant: 'destructive', icon: XCircle },
  }
  const conf = config[status] || config['non']
  return <Badge variant={conf.variant as any}>{conf.label}</Badge>
}

interface EncaissementsClientProps {
  initialData: any[]
}

type TabKey = 'all' | 'paid' | 'pending' | 'unpaid'

export function EncaissementsClient({ initialData }: EncaissementsClientProps) {
  const [data] = React.useState(initialData)
  const [activeTab, setActiveTab] = React.useState<TabKey>('all')

  const categorized = React.useMemo(() => {
    const paid = data.filter((f: any) => f.payee === 'oui')
    const pending = data.filter((f: any) => f.payee === 'en_cours')
    const unpaid = data.filter((f: any) => f.payee === 'non')
    return { paid, pending, unpaid }
  }, [data])

  const filteredData = React.useMemo(() => {
    switch (activeTab) {
      case 'paid':
        return categorized.paid
      case 'pending':
        return categorized.pending
      case 'unpaid':
        return categorized.unpaid
      default:
        return data
    }
  }, [data, activeTab, categorized])

  const totals = React.useMemo(() => {
    const totalMontant = categorized.paid.reduce(
      (sum: number, item: any) => sum + (item.dossier?.montant || 0),
      0
    )
    const totalCommission = categorized.paid.reduce(
      (sum: number, item: any) => sum + (item.dossier?.commission_brute || 0),
      0
    )
    const enCoursTotal = categorized.pending.reduce(
      (sum: number, item: any) => sum + (item.dossier?.montant || 0),
      0
    )
    return { totalMontant, totalCommission, enCoursTotal }
  }, [categorized])

  const columns: ColumnDefinition<any>[] = [
    {
      key: 'dossier.client_nom',
      label: 'Client',
      render: (_, row) =>
        `${row.dossier?.client_prenom || ''} ${row.dossier?.client_nom || ''}`.trim(),
    },
    {
      key: 'dossier.produit_nom',
      label: 'Produit',
      render: (_, row) => row.dossier?.produit_nom || '-',
    },
    {
      key: 'dossier.compagnie_nom',
      label: 'Compagnie',
      render: (_, row) => row.dossier?.compagnie_nom || '-',
    },
    {
      key: 'dossier.montant',
      label: 'Montant',
      render: (_, row) => formatCurrency(row.dossier?.montant),
    },
    {
      key: 'dossier.commission_brute',
      label: 'Commission',
      render: (_, row) => formatCurrency(row.dossier?.commission_brute),
    },
    {
      key: 'facturee',
      label: 'Facturée',
      render: (value) => (
        <Badge variant={value ? 'success' : 'destructive'}>
          {value ? 'Oui' : 'Non'}
        </Badge>
      ),
    },
    {
      key: 'payee',
      label: 'Statut paiement',
      render: (value) => <PayeeBadge status={value || 'non'} />,
    },
    {
      key: 'dossier.consultant_prenom',
      label: 'Consultant',
      render: (_, row) => row.dossier?.consultant_prenom || row.dossier?.consultant_nom || '-',
    },
  ]

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: data.length },
    { key: 'paid', label: 'Payés', count: categorized.paid.length },
    { key: 'pending', label: 'En cours', count: categorized.pending.length },
    { key: 'unpaid', label: 'Non payés', count: categorized.unpaid.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Encaissements</h1>
        <p className="text-gray-600 mt-1">Suivi des paiements et encaissements</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle size={20} className="text-green-600" />
              Total encaissé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(totals.totalMontant)}
            </p>
            <p className="text-sm text-gray-500 mt-1">{categorized.paid.length} paiement(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock size={20} className="text-orange-600" />
              En attente de paiement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              {formatCurrency(totals.enCoursTotal)}
            </p>
            <p className="text-sm text-gray-500 mt-1">{categorized.pending.length} en cours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp size={20} className="text-blue-600" />
              Commissions encaissées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(totals.totalCommission)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-600 border border-gray-200 border-b-white -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {filteredData.length > 0 ? (
            <DataTable data={filteredData} columns={columns} pageSize={15} />
          ) : (
            <p className="text-center text-gray-500 py-6">
              Aucun encaissement dans cette catégorie
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
