'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { DollarSign, Users, TrendingUp, Download, Wallet, Receipt, CreditCard, Clock } from 'lucide-react'
import { RoleType } from '@/types/database'
import { exportCSV, getExportFilename, formatCurrencyForCSV } from '@/lib/export-csv'
import { FacturationConsultant } from '@/components/dashboard/facturation-consultant'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const statutLabel = (s: string) => {
  switch (s) {
    case 'client_finalise': return 'Finalisé'
    case 'client_en_cours': return 'En cours'
    case 'prospect': return 'Prospect'
    default: return s
  }
}

const statutVariant = (s: string): any => {
  switch (s) {
    case 'client_finalise': return 'success'
    case 'client_en_cours': return 'warning'
    case 'prospect': return 'secondary'
    default: return 'outline'
  }
}

interface RemunerationsClientProps {
  dossiers: any[]
  consultant: any
  role: RoleType | null
}

export function RemunerationsClient({
  dossiers,
  consultant,
  role,
}: RemunerationsClientProps) {
  const isManager = role === 'manager' || role === 'back_office'
  const myName = consultant ? `${consultant.prenom || ''} ${consultant.nom || ''}`.trim() : ''

  // Separate finalized from en_cours dossiers
  const finalised = React.useMemo(() => dossiers.filter(d => d.statut === 'client_finalise'), [dossiers])
  const enCours = React.useMemo(() => dossiers.filter(d => d.statut === 'client_en_cours'), [dossiers])
  const allWithCommission = React.useMemo(() => dossiers.filter(d => (d.commission_brute || 0) > 0), [dossiers])

  // ==========================================
  // CAGNOTTE CALCULATION (per consultant)
  // ==========================================
  const buildCagnotte = React.useCallback((consultantDossiers: any[]) => {
    const finDossiers = consultantDossiers.filter(d => d.statut === 'client_finalise')
    const ecDossiers = consultantDossiers.filter(d => d.statut === 'client_en_cours' && (d.commission_brute || 0) > 0)

    const acquis = finDossiers.reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)
    const facture = finDossiers.filter(d => d.facturee).reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)
    const encaisse = finDossiers.filter(d => d.payee === 'oui').reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)
    const resteAFacturer = acquis - facture
    const enCoursEstime = ecDossiers.reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)
    const commissionBruteTotal = finDossiers.reduce((sum, d) => sum + (d.commission_brute || 0), 0)
    const partCabinet = finDossiers.reduce((sum, d) => sum + (d.part_cabinet || 0), 0)

    return {
      acquis,
      facture,
      encaisse,
      resteAFacturer,
      enCoursEstime,
      commissionBruteTotal,
      partCabinet,
      nbFinalises: finDossiers.length,
      nbEnCours: ecDossiers.length,
    }
  }, [])

  // ==========================================
  // MANAGER VIEW
  // ==========================================
  if (isManager) {
    const myDossiers = React.useMemo(() => dossiers.filter(d => {
      const name = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
      return name === myName
    }), [dossiers, myName])

    const myCagnotte = React.useMemo(() => buildCagnotte(myDossiers), [myDossiers, buildCagnotte])

    // Per consultant breakdown
    const byConsultant = React.useMemo(() => {
      const map: Record<string, { name: string; dossiers: any[] }> = {}
      dossiers.forEach(d => {
        const name = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim() || 'Non attribué'
        if (!map[name]) map[name] = { name, dossiers: [] }
        map[name].dossiers.push(d)
      })
      return Object.values(map)
        .map(c => ({ ...c, cagnotte: buildCagnotte(c.dossiers) }))
        .sort((a, b) => b.cagnotte.commissionBruteTotal - a.cagnotte.commissionBruteTotal)
    }, [dossiers, buildCagnotte])

    const globalTotals = React.useMemo(() => buildCagnotte(dossiers), [dossiers, buildCagnotte])

    const [activeTab, setActiveTab] = React.useState<'finalise' | 'en_cours' | 'tous'>('finalise')
    const filteredDossiers = React.useMemo(() => {
      switch (activeTab) {
        case 'finalise': return finalised
        case 'en_cours': return enCours
        default: return allWithCommission
      }
    }, [activeTab, finalised, enCours, allWithCommission])

    const detailColumns: ColumnDefinition<any>[] = [
      {
        key: 'client_nom',
        label: 'Client',
        render: (_, row) => `${row.client_prenom || ''} ${row.client_nom || ''}`.trim(),
      },
      {
        key: 'consultant_prenom',
        label: 'Consultant',
        sortable: true,
        render: (_, row) => `${row.consultant_prenom || ''} ${row.consultant_nom || ''}`.trim(),
      },
      {
        key: 'statut',
        label: 'Statut',
        render: (value) => <Badge variant={statutVariant(value)}>{statutLabel(value)}</Badge>,
      },
      {
        key: 'montant',
        label: 'Montant',
        sortable: true,
        render: (value) => formatCurrency(value),
      },
      {
        key: 'commission_brute',
        label: 'Commission brute',
        sortable: true,
        render: (value) => formatCurrency(value),
      },
      {
        key: 'rem_apporteur',
        label: 'Part Consultant',
        render: (value) => formatCurrency(value),
      },
      {
        key: 'facturee',
        label: 'Facturée',
        render: (value) => (
          <Badge variant={value ? 'success' : 'outline'}>
            {value ? 'Oui' : 'Non'}
          </Badge>
        ),
      },
      {
        key: 'payee',
        label: 'Payée',
        render: (value) => {
          const v = value || 'non'
          const variant = v === 'oui' ? 'success' : v === 'en_cours' ? 'warning' : 'outline'
          const label = v === 'oui' ? 'Oui' : v === 'en_cours' ? 'En cours' : 'Non'
          return <Badge variant={variant}>{label}</Badge>
        },
      },
    ]

    const handleExportCSV = React.useCallback(() => {
      const exportData = filteredDossiers.map((d) => ({
        client: `${d.client_prenom || ''} ${d.client_nom || ''}`.trim(),
        consultant: `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim(),
        statut: statutLabel(d.statut),
        montant: formatCurrencyForCSV(d.montant),
        commission_brute: formatCurrencyForCSV(d.commission_brute),
        rem_apporteur: formatCurrencyForCSV(d.rem_apporteur),
        part_cabinet: formatCurrencyForCSV(d.part_cabinet),
        facturee: d.facturee ? 'Oui' : 'Non',
        payee: d.payee === 'oui' ? 'Oui' : d.payee === 'en_cours' ? 'En cours' : 'Non',
      }))

      const columns = [
        { key: 'client', label: 'Client' },
        { key: 'consultant', label: 'Consultant' },
        { key: 'statut', label: 'Statut' },
        { key: 'montant', label: 'Montant (EUR)' },
        { key: 'commission_brute', label: 'Commission brute (EUR)' },
        { key: 'rem_apporteur', label: 'Part Consultant (EUR)' },
        { key: 'part_cabinet', label: 'Part Cabinet (EUR)' },
        { key: 'facturee', label: 'Facturée' },
        { key: 'payee', label: 'Payée' },
      ]

      exportCSV(exportData, columns, {
        filename: getExportFilename('remunerations_export'),
        separator: ';',
      })
    }, [filteredDossiers])

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rémunérations</h1>
            <p className="text-gray-600 mt-1">Cagnotte, facturation et commissions</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download size={18} />
            Exporter CSV
          </Button>
        </div>

        {/* MA CAGNOTTE - Highlighted */}
        <Card className="border-2 border-indigo-200 bg-indigo-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet size={22} className="text-indigo-600" />
              Ma cagnotte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-gray-600">Acquis (finalisé)</p>
                <p className="text-2xl font-bold text-indigo-700">{formatCurrency(myCagnotte.acquis)}</p>
                <p className="text-xs text-gray-500">{myCagnotte.nbFinalises} dossier(s)</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Déjà facturé</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(myCagnotte.facture)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Reste à facturer</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(myCagnotte.resteAFacturer)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Encaissé</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(myCagnotte.encaisse)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">En cours (estimé)</p>
                <p className="text-2xl font-bold text-gray-500">{formatCurrency(myCagnotte.enCoursEstime)}</p>
                <p className="text-xs text-gray-500">{myCagnotte.nbEnCours} dossier(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facturation Consultant */}
        {consultant?.id && (
          <FacturationConsultant
            consultantId={consultant.id}
            dossiers={myDossiers.filter(d => d.statut === 'client_finalise')}
            resteAFacturer={myCagnotte.resteAFacturer}
          />
        )}

        {/* Global Cabinet Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign size={20} className="text-blue-600" />
                Commissions cabinet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(globalTotals.commissionBruteTotal)}</p>
              <p className="text-sm text-gray-500">{globalTotals.nbFinalises} finalisé(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt size={20} className="text-green-600" />
                Total facturé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(globalTotals.facture)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard size={20} className="text-orange-600" />
                Reste à facturer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(globalTotals.resteAFacturer)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp size={20} className="text-purple-600" />
                Part cabinet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(globalTotals.partCabinet)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Par consultant with cagnotte */}
        <Card>
          <CardHeader>
            <CardTitle>Cagnotte par consultant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byConsultant.map((c) => (
                <div key={c.name} className={`py-3 border-b border-gray-100 last:border-0 ${c.name === myName ? 'bg-indigo-50 -mx-4 px-4 rounded-lg border-indigo-200' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`font-medium ${c.name === myName ? 'text-indigo-700' : 'text-gray-900'}`}>
                      {c.name}{c.name === myName ? ' (vous)' : ''}
                    </p>
                    <p className="text-sm text-gray-500">{c.cagnotte.nbFinalises} finalisé(s) · {c.cagnotte.nbEnCours} en cours</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Acquis: </span>
                      <span className="font-semibold">{formatCurrency(c.cagnotte.acquis)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Facturé: </span>
                      <span className="font-semibold text-green-700">{formatCurrency(c.cagnotte.facture)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Reste: </span>
                      <span className="font-semibold text-orange-600">{formatCurrency(c.cagnotte.resteAFacturer)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Encaissé: </span>
                      <span className="font-semibold text-green-600">{formatCurrency(c.cagnotte.encaisse)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">En cours: </span>
                      <span className="font-semibold text-gray-500">{formatCurrency(c.cagnotte.enCoursEstime)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tabs and Detail Table */}
        <div className="flex gap-2 border-b border-gray-200 pb-0">
          {([
            { key: 'finalise' as const, label: 'Finalisés', count: finalised.length },
            { key: 'en_cours' as const, label: 'En cours', count: enCours.filter(d => (d.commission_brute || 0) > 0).length },
            { key: 'tous' as const, label: 'Tous (avec commission)', count: allWithCommission.length },
          ]).map((tab) => (
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

        <Card>
          <CardHeader>
            <CardTitle>Détail des commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={filteredDossiers} columns={detailColumns} pageSize={15} />
          </CardContent>
        </Card>
      </div>
    )
  } else {
    // ==========================================
    // CONSULTANT VIEW - Their own cagnotte
    // ==========================================
    const myCagnotte = React.useMemo(() => buildCagnotte(dossiers), [dossiers, buildCagnotte])

    const myColumns: ColumnDefinition<any>[] = [
      {
        key: 'client_nom',
        label: 'Client',
        render: (_, row) => `${row.client_prenom || ''} ${row.client_nom || ''}`.trim(),
      },
      {
        key: 'produit_nom',
        label: 'Produit',
      },
      {
        key: 'compagnie_nom',
        label: 'Compagnie',
      },
      {
        key: 'statut',
        label: 'Statut',
        render: (value) => <Badge variant={statutVariant(value)}>{statutLabel(value)}</Badge>,
      },
      {
        key: 'montant',
        label: 'Montant',
        render: (value) => formatCurrency(value),
      },
      {
        key: 'commission_brute',
        label: 'Commission brute',
        render: (value) => formatCurrency(value),
      },
      {
        key: 'rem_apporteur',
        label: 'Ma commission',
        render: (value) => formatCurrency(value),
      },
      {
        key: 'facturee',
        label: 'Facturée',
        render: (value) => (
          <Badge variant={value ? 'success' : 'outline'}>
            {value ? 'Oui' : 'Non'}
          </Badge>
        ),
      },
    ]

    const [activeTab, setActiveTab] = React.useState<'finalise' | 'en_cours' | 'tous'>('finalise')
    const filteredDossiers = React.useMemo(() => {
      switch (activeTab) {
        case 'finalise': return finalised
        case 'en_cours': return enCours.filter(d => (d.commission_brute || 0) > 0)
        default: return allWithCommission
      }
    }, [activeTab, finalised, enCours, allWithCommission])

    const handleExportCSV = React.useCallback(() => {
      const exportData = filteredDossiers.map((d) => ({
        client: `${d.client_prenom || ''} ${d.client_nom || ''}`.trim(),
        produit: d.produit_nom || '',
        compagnie: d.compagnie_nom || '',
        statut: statutLabel(d.statut),
        montant: formatCurrencyForCSV(d.montant),
        commission_brute: formatCurrencyForCSV(d.commission_brute),
        rem_apporteur: formatCurrencyForCSV(d.rem_apporteur),
        facturee: d.facturee ? 'Oui' : 'Non',
      }))

      const columns = [
        { key: 'client', label: 'Client' },
        { key: 'produit', label: 'Produit' },
        { key: 'compagnie', label: 'Compagnie' },
        { key: 'statut', label: 'Statut' },
        { key: 'montant', label: 'Montant (EUR)' },
        { key: 'commission_brute', label: 'Commission brute (EUR)' },
        { key: 'rem_apporteur', label: 'Ma commission (EUR)' },
        { key: 'facturee', label: 'Facturée' },
      ]

      exportCSV(exportData, columns, {
        filename: getExportFilename('mes_commissions_export'),
        separator: ';',
      })
    }, [filteredDossiers])

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ma Rémunération</h1>
            <p className="text-gray-600 mt-1">Ma cagnotte et mes commissions</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download size={18} />
            Exporter CSV
          </Button>
        </div>

        {/* Cagnotte */}
        <Card className="border-2 border-indigo-200 bg-indigo-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet size={22} className="text-indigo-600" />
              Ma cagnotte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-gray-600">Acquis (finalisé)</p>
                <p className="text-2xl font-bold text-indigo-700">{formatCurrency(myCagnotte.acquis)}</p>
                <p className="text-xs text-gray-500">{myCagnotte.nbFinalises} dossier(s)</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Déjà facturé</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(myCagnotte.facture)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Reste à facturer</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(myCagnotte.resteAFacturer)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Encaissé</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(myCagnotte.encaisse)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">En cours (estimé)</p>
                <p className="text-2xl font-bold text-gray-500">{formatCurrency(myCagnotte.enCoursEstime)}</p>
                <p className="text-xs text-gray-500">{myCagnotte.nbEnCours} dossier(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facturation Consultant */}
        {consultant?.id && (
          <FacturationConsultant
            consultantId={consultant.id}
            dossiers={finalised}
            resteAFacturer={myCagnotte.resteAFacturer}
          />
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 pb-0">
          {([
            { key: 'finalise' as const, label: 'Finalisés', count: finalised.length },
            { key: 'en_cours' as const, label: 'En cours', count: enCours.filter(d => (d.commission_brute || 0) > 0).length },
            { key: 'tous' as const, label: 'Tous', count: allWithCommission.length },
          ]).map((tab) => (
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
          <CardHeader>
            <CardTitle>Détail de mes dossiers</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredDossiers.length > 0 ? (
              <DataTable data={filteredDossiers} columns={myColumns} pageSize={10} />
            ) : (
              <p className="text-center text-gray-500 py-6">
                Aucun dossier dans cette catégorie
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }
}
