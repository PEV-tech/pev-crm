'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Clock, CreditCard, ShieldAlert, CalendarClock } from 'lucide-react'

interface RelanceRow {
  id: string
  clientNom: string
  consultantNom: string
  consultantPrenom: string
  produitNom: string
  dateOperation: string
  typeRelance: 'kyc' | 'inactivite' | 'paiement' | 'reglementaire' | 'facture_aging'
  statut: string
  urgency: 'critical' | 'high' | 'medium'
  detail?: string
}

interface RelancesClientProps {
  initialData: RelanceRow[]
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString))
  } catch {
    return dateString
  }
}

const getDaysAgo = (dateString: string | null): number | null => {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

const getUrgencyBadge = (urgency: string) => {
  const variants: Record<string, any> = {
    critical: 'destructive',
    high: 'warning',
    medium: 'default',
  }
  const labels: Record<string, string> = {
    critical: 'Critique',
    high: 'Haute',
    medium: 'Normale',
  }
  return <Badge variant={variants[urgency] || 'default'}>{labels[urgency] || urgency}</Badge>
}

const getRelanceTypeBadge = (type: string) => {
  const variants: Record<string, any> = {
    kyc: 'warning',
    inactivite: 'secondary',
    paiement: 'destructive',
    reglementaire: 'warning',
    facture_aging: 'destructive',
  }
  const labels: Record<string, string> = {
    kyc: 'Réglementaire manquant',
    inactivite: 'Inactivité 30j+',
    paiement: 'Paiement en attente',
    reglementaire: 'Réglementaire incomplet',
    facture_aging: 'Facture impayée 30j+',
  }
  const icons: Record<string, any> = {
    kyc: <AlertCircle className="inline mr-1" size={14} />,
    inactivite: <Clock className="inline mr-1" size={14} />,
    paiement: <CreditCard className="inline mr-1" size={14} />,
    reglementaire: <ShieldAlert className="inline mr-1" size={14} />,
    facture_aging: <CalendarClock className="inline mr-1" size={14} />,
  }
  return (
    <Badge variant={variants[type] || 'default'}>
      {icons[type]}
      {labels[type] || type}
    </Badge>
  )
}

type TabType = 'all' | 'kyc' | 'inactivite' | 'paiement' | 'reglementaire' | 'facture_aging'

export function RelancesClient({ initialData }: RelancesClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all')

  const filteredData = useMemo(() => {
    if (activeTab === 'all') return initialData
    return initialData.filter((row) => row.typeRelance === activeTab)
  }, [initialData, activeTab])

  const columns: ColumnDefinition<RelanceRow>[] = [
    {
      key: 'clientNom',
      label: 'Client',
      sortable: true,
    },
    {
      key: 'consultantNom',
      label: 'Consultant',
      sortable: true,
      render: (_, row) => `${row.consultantPrenom} ${row.consultantNom}`,
    },
    {
      key: 'produitNom',
      label: 'Produit',
      sortable: true,
    },
    {
      key: 'dateOperation',
      label: 'Date',
      sortable: true,
      render: (value) => formatDate(value),
    },
    {
      key: 'typeRelance',
      label: 'Type de relance',
      render: (value) => getRelanceTypeBadge(value),
    },
    {
      key: 'urgency',
      label: 'Urgence',
      render: (value) => getUrgencyBadge(value),
    },
    {
      key: 'detail',
      label: 'Détail',
      render: (value) => value ? <span className="text-xs text-gray-600">{value}</span> : '-',
    },
  ]

  const tabCounts = {
    all: initialData.length,
    kyc: initialData.filter((r) => r.typeRelance === 'kyc').length,
    inactivite: initialData.filter((r) => r.typeRelance === 'inactivite').length,
    paiement: initialData.filter((r) => r.typeRelance === 'paiement').length,
    reglementaire: initialData.filter((r) => r.typeRelance === 'reglementaire').length,
    facture_aging: initialData.filter((r) => r.typeRelance === 'facture_aging').length,
  }

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'Tous', icon: null },
    { id: 'kyc', label: 'Réglementaire manquant', icon: <AlertCircle size={16} /> },
    { id: 'reglementaire', label: 'Réglementaire', icon: <ShieldAlert size={16} /> },
    { id: 'inactivite', label: 'Inactivité 30j+', icon: <Clock size={16} /> },
    { id: 'paiement', label: 'Paiement', icon: <CreditCard size={16} /> },
    { id: 'facture_aging', label: 'Facture 30j+', icon: <CalendarClock size={16} /> },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Relances</h1>
        <p className="text-gray-600 mt-1">
          Suivi des dossiers nécessitant une relance ou action
        </p>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-accent-blue text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className="ml-2 bg-gray-300 px-2 py-0.5 rounded-full text-xs font-bold">
                  {tabCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          {filteredData.length > 0 ? (
            <DataTable
              data={filteredData}
              columns={columns}
              searchField="clientNom"
              searchPlaceholder="Rechercher un client..."
              pageSize={15}
            />
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">Aucune relance pour cette catégorie</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {filteredData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm font-medium">Relances critiques</p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  {filteredData.filter((r) => r.urgency === 'critical').length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm font-medium">Relances hautes</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {filteredData.filter((r) => r.urgency === 'high').length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm font-medium">Total à traiter</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{filteredData.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
