'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CheckCircle, AlertCircle, Search, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import Link from 'next/link'

interface ReglementaireClientProps {
  initialData: any[]
}

const KYCBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; variant: string }> = {
    non: { label: 'Non', variant: 'destructive' },
    en_cours: { label: 'En cours', variant: 'warning' },
    oui: { label: 'Oui', variant: 'success' },
  }
  const conf = config[status] || config['non']
  return <Badge variant={conf.variant as any}>{conf.label}</Badge>
}

const BoolBadge = ({ value }: { value: boolean | null }) => {
  return (
    <Badge variant={value ? 'success' : 'destructive'}>
      {value ? 'Oui' : 'Non'}
    </Badge>
  )
}

const ComplianceBar = ({ score, total }: { score: number; total: number }) => {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const color = pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600">{score}/{total}</span>
    </div>
  )
}

interface ClientGroup {
  clientKey: string
  clientNom: string
  clientPrenom: string
  clientPays: string
  dossiers: any[]
  complianceScore: number
  totalChecks: number
  isFullyCompliant: boolean
}

export function ReglementaireClient({ initialData }: ReglementaireClientProps) {
  const [data] = React.useState(initialData)
  const [filterIncomplete, setFilterIncomplete] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [expandedClients, setExpandedClients] = React.useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = React.useState<'client' | 'dossier'>('client')

  // Group dossiers by client
  const clientGroups = React.useMemo(() => {
    const groups: Record<string, ClientGroup> = {}

    data.forEach((d: any) => {
      const key = `${(d.client_nom || '').toUpperCase()}|${(d.client_prenom || '').toUpperCase()}`

      if (!groups[key]) {
        groups[key] = {
          clientKey: key,
          clientNom: d.client_nom || '',
          clientPrenom: d.client_prenom || '',
          clientPays: d.client_pays || '',
          dossiers: [],
          complianceScore: 0,
          totalChecks: 0,
          isFullyCompliant: true,
        }
      }

      groups[key].dossiers.push(d)

      // Calculate per-dossier compliance
      const checks = [
        d.statut_kyc === 'oui',
        d.der === true,
        d.pi === true,
        d.lm === true,
        d.rm === true,
      ]
      const score = checks.filter(Boolean).length
      groups[key].complianceScore += score
      groups[key].totalChecks += 5
      if (score < 5) groups[key].isFullyCompliant = false
    })

    return Object.values(groups).sort((a, b) => {
      // Non-compliant first
      if (a.isFullyCompliant !== b.isFullyCompliant) return a.isFullyCompliant ? 1 : -1
      return a.clientNom.localeCompare(b.clientNom)
    })
  }, [data])

  const filteredGroups = React.useMemo(() => {
    let result = clientGroups

    if (filterIncomplete) {
      result = result.filter((g) => !g.isFullyCompliant)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (g) =>
          g.clientNom.toLowerCase().includes(q) ||
          g.clientPrenom.toLowerCase().includes(q) ||
          g.clientPays.toLowerCase().includes(q)
      )
    }

    return result
  }, [clientGroups, filterIncomplete, searchQuery])

  const stats = React.useMemo(() => {
    const compliant = clientGroups.filter((g) => g.isFullyCompliant).length
    const nonCompliant = clientGroups.length - compliant
    const totalDossiers = data.length
    const compliantDossiers = data.filter(
      (d: any) =>
        d.statut_kyc === 'oui' && d.der === true && d.pi === true && d.lm === true && d.rm === true
    ).length

    return { compliant, nonCompliant, total: clientGroups.length, totalDossiers, compliantDossiers }
  }, [clientGroups, data])

  const toggleClient = (key: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Flat dossier view columns
  const dossierColumns: ColumnDefinition<any>[] = [
    {
      key: 'client_nom',
      label: 'Client',
      sortable: true,
      render: (_, row) => `${row.client_prenom || ''} ${row.client_nom || ''}`.trim(),
    },
    {
      key: 'produit_nom',
      label: 'Produit',
      sortable: true,
    },
    {
      key: 'consultant_prenom',
      label: 'Consultant',
      sortable: true,
      render: (_, row) => row.consultant_prenom || row.consultant_nom || '-',
    },
    {
      key: 'statut_kyc',
      label: 'KYC',
      render: (value) => <KYCBadge status={value || 'non'} />,
    },
    {
      key: 'der',
      label: 'DER',
      render: (value) => <BoolBadge value={value} />,
    },
    {
      key: 'pi',
      label: 'PI',
      render: (value) => <BoolBadge value={value} />,
    },
    {
      key: 'lm',
      label: 'LM',
      render: (value) => <BoolBadge value={value} />,
    },
    {
      key: 'rm',
      label: 'RM',
      render: (value) => <BoolBadge value={value} />,
    },
    {
      key: 'id',
      label: '',
      render: (_, row) => (
        <Link
          href={`/dashboard/dossiers/${row.id}`}
          className="text-blue-600 hover:text-blue-800 text-xs"
        >
          Voir
        </Link>
      ),
    },
  ]

  const filteredDossiers = React.useMemo(() => {
    let result = data

    if (filterIncomplete) {
      result = result.filter(
        (d: any) =>
          d.statut_kyc !== 'oui' || d.der !== true || d.pi !== true || d.lm !== true || d.rm !== true
      )
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (d: any) =>
          (d.client_nom || '').toLowerCase().includes(q) ||
          (d.client_prenom || '').toLowerCase().includes(q) ||
          (d.produit_nom || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [data, filterIncomplete, searchQuery])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Réglementaire</h1>
        <p className="text-gray-600 mt-1">Suivi de conformité par client et dossier</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle size={20} className="text-green-600" />
              Clients conformes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.compliant}</p>
            <p className="text-xs text-gray-600 mt-1">
              {stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0}% des clients
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle size={20} className="text-orange-600" />
              Clients non conformes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{stats.nonCompliant}</p>
            <p className="text-xs text-gray-600 mt-1">À régulariser</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText size={20} className="text-blue-600" />
              Dossiers conformes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.compliantDossiers}</p>
            <p className="text-xs text-gray-600 mt-1">
              sur {stats.totalDossiers} dossiers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total clients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher un client, produit..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterIncomplete}
                  onChange={(e) => setFilterIncomplete(e.target.checked)}
                  className="w-4 h-4 rounded border border-gray-300 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">Non conformes uniquement</span>
              </label>

              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('client')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'client' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Par client
                </button>
                <button
                  onClick={() => setViewMode('dossier')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'dossier' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Par dossier
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {viewMode === 'dossier' ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Conformité par dossier {filterIncomplete && `(${filteredDossiers.length} non conforme(s))`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={filteredDossiers} columns={dossierColumns} pageSize={15} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Suivi par client ({filteredGroups.length} client{filteredGroups.length > 1 ? 's' : ''})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                <div className="col-span-3">Client</div>
                <div className="col-span-1">Pays</div>
                <div className="col-span-1 text-center">Dossiers</div>
                <div className="col-span-2">Conformité</div>
                <div className="col-span-1 text-center">KYC</div>
                <div className="col-span-1 text-center">DER</div>
                <div className="col-span-1 text-center">PI</div>
                <div className="col-span-1 text-center">LM</div>
                <div className="col-span-1 text-center">RM</div>
              </div>

              {filteredGroups.map((group) => {
                const isExpanded = expandedClients.has(group.clientKey)
                // Aggregate: show worst status for each check
                const anyKycBad = group.dossiers.some((d: any) => d.statut_kyc !== 'oui')
                const anyDerBad = group.dossiers.some((d: any) => d.der !== true)
                const anyPiBad = group.dossiers.some((d: any) => d.pi !== true)
                const anyLmBad = group.dossiers.some((d: any) => d.lm !== true)
                const anyRmBad = group.dossiers.some((d: any) => d.rm !== true)

                return (
                  <div key={group.clientKey}>
                    {/* Client Row */}
                    <div
                      className={`grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer hover:bg-gray-50 rounded transition-colors ${
                        !group.isFullyCompliant ? 'bg-orange-50/50' : ''
                      }`}
                      onClick={() => toggleClient(group.clientKey)}
                    >
                      <div className="col-span-3 flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                        )}
                        <span className="font-medium text-sm text-gray-900">
                          {group.clientPrenom} {group.clientNom}
                        </span>
                      </div>
                      <div className="col-span-1 text-sm text-gray-600">{group.clientPays || '-'}</div>
                      <div className="col-span-1 text-center text-sm text-gray-600">
                        {group.dossiers.length}
                      </div>
                      <div className="col-span-2">
                        <ComplianceBar score={group.complianceScore} total={group.totalChecks} />
                      </div>
                      <div className="col-span-1 text-center">
                        <Badge variant={anyKycBad ? 'destructive' : 'success'} className="text-xs">
                          {anyKycBad ? 'Non' : 'OK'}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-center">
                        <Badge variant={anyDerBad ? 'destructive' : 'success'} className="text-xs">
                          {anyDerBad ? 'Non' : 'OK'}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-center">
                        <Badge variant={anyPiBad ? 'destructive' : 'success'} className="text-xs">
                          {anyPiBad ? 'Non' : 'OK'}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-center">
                        <Badge variant={anyLmBad ? 'destructive' : 'success'} className="text-xs">
                          {anyLmBad ? 'Non' : 'OK'}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-center">
                        <Badge variant={anyRmBad ? 'destructive' : 'success'} className="text-xs">
                          {anyRmBad ? 'Non' : 'OK'}
                        </Badge>
                      </div>
                    </div>

                    {/* Expanded Dossier Rows */}
                    {isExpanded && (
                      <div className="ml-8 border-l-2 border-gray-200 mb-2">
                        {group.dossiers.map((d: any, idx: number) => (
                          <div
                            key={d.id || idx}
                            className="grid grid-cols-12 gap-2 px-4 py-2 items-center text-sm bg-gray-50/50 hover:bg-gray-100/50"
                          >
                            <div className="col-span-3 flex items-center gap-2">
                              <FileText size={14} className="text-gray-400" />
                              <Link
                                href={`/dashboard/dossiers/${d.id}`}
                                className="text-blue-600 hover:underline text-xs"
                              >
                                {d.produit_nom || 'Dossier'} — {d.compagnie_nom || ''}
                              </Link>
                            </div>
                            <div className="col-span-1 text-xs text-gray-500">
                              {d.consultant_prenom || d.consultant_nom || '-'}
                            </div>
                            <div className="col-span-1 text-center text-xs text-gray-500">
                              {formatCurrency(d.montant)}
                            </div>
                            <div className="col-span-2 text-xs text-gray-500">
                              {d.statut === 'client_finalise'
                                ? 'Finalisé'
                                : d.statut === 'client_en_cours'
                                ? 'En cours'
                                : 'Prospect'}
                            </div>
                            <div className="col-span-1 text-center">
                              <KYCBadge status={d.statut_kyc || 'non'} />
                            </div>
                            <div className="col-span-1 text-center">
                              <BoolBadge value={d.der} />
                            </div>
                            <div className="col-span-1 text-center">
                              <BoolBadge value={d.pi} />
                            </div>
                            <div className="col-span-1 text-center">
                              <BoolBadge value={d.lm} />
                            </div>
                            <div className="col-span-1 text-center">
                              <BoolBadge value={d.rm} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {filteredGroups.length === 0 && (
                <p className="text-center text-gray-500 py-8">Aucun résultat</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Légende des vérifications réglementaires</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-900">KYC</p>
              <p className="text-gray-600">Know Your Customer</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">DER</p>
              <p className="text-gray-600">Document d&apos;entrée en relation</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">PI</p>
              <p className="text-gray-600">Pièce d&apos;identité</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">LM</p>
              <p className="text-gray-600">Lutte contre le blanchiment</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">RM</p>
              <p className="text-gray-600">Recueil de missions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}
