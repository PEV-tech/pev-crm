'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { DollarSign, TrendingUp, Download, Wallet, Receipt, Clock, AlertCircle } from 'lucide-react'
import { RoleType } from '@/types/database'
import { exportCSV, getExportFilename, formatCurrencyForCSV } from '@/lib/export-csv'
import { FacturationConsultant } from '@/components/dashboard/facturation-consultant'
import { CommissionGrille } from '@/components/shared/commission-grille'

import { formatCurrency } from '@/lib/formatting'
import { hasEncours } from '@/lib/commissions/gestion'

const statutLabel = (s: string) => {
  switch (s) {
    case 'client_finalise': return 'Finalisé'
    case 'client_en_cours': return 'En cours'
    case 'prospect': return 'Prospect'
    default: return s
  }
}

type BadgeVariant = 'success' | 'warning' | 'secondary' | 'outline' | 'default' | 'destructive'
const statutVariant = (s: string): BadgeVariant => {
  switch (s) {
    case 'client_finalise': return 'success'
    case 'client_en_cours': return 'warning'
    case 'prospect': return 'secondary'
    default: return 'outline'
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RemunerationsClientProps {
  dossiers: any[]
  consultant: any
  role: RoleType | null
  remTotals?: { maxine: number; thelo: number }
  cagnotteData?: { maxine: any; thelo: any }
}

// Cagnotte card for a manager (Maxine or Thélo)
function ManagerCagnotteCard({
  label,
  remTotal,
  cagnotteRow,
  dossiers,
  consultantId,
  isCurrentUser,
}: {
  label: string
  remTotal: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cagnotteRow: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dossiers: any[]
  consultantId?: string
  isCurrentUser: boolean
}) {
  const solde2025 = Number(cagnotteRow?.solde_2025 || 0)
  const montantFacture = Number(cagnotteRow?.montant_facture || 0)
  // Use acquis_total from DB if available (source of truth), otherwise compute
  const acquis = cagnotteRow?.acquis_total ? Number(cagnotteRow.acquis_total) : (remTotal + solde2025)
  const reste = acquis - montantFacture

  // Prevision = en cours estimé from dossiers
  const prevision = dossiers
    .filter(d => d.statut === 'client_en_cours' && (d.rem_apporteur || 0) > 0)
    .reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)

  // Parse factures_detail from cagnotteRow (fallback to empty if malformed)
  const facturesDetail: { date: string; montant: number; description: string }[] = React.useMemo(() => {
    const raw = cagnotteRow?.factures_detail
    if (Array.isArray(raw)) return raw
    if (typeof raw !== 'string') return []
    try {
      return JSON.parse(raw)
    } catch (e) {
      // Corrupt JSON in manager_cagnotte.factures_detail — dégrade mais signale.
      console.warn('[rémunérations] factures_detail JSON invalide pour', label, e)
      return []
    }
  }, [cagnotteRow, label])

  return (
    <Card className={`border-2 ${isCurrentUser ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet size={18} className="text-indigo-600" />
          Cagnotte {label}
          {isCurrentUser && <Badge variant="outline" className="text-xs">Vous</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <p className="text-xs text-gray-500">Acquis total</p>
            <p className="text-xl font-bold text-indigo-700">{formatCurrency(acquis)}</p>
            <p className="text-xs text-gray-400 mt-0.5">dont solde 2025: {formatCurrency(solde2025)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Déjà facturé</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(montantFacture)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Cagnotte</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(reste)}</p>
            <p className="text-xs text-gray-400 mt-0.5">reste à facturer</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Prévision</p>
            <p className="text-xl font-bold text-gray-500">{formatCurrency(prevision)}</p>
            <p className="text-xs text-gray-400 mt-0.5">dossiers en cours</p>
          </div>
        </div>

        {/* Détail des factures émises */}
        {facturesDetail.length > 0 && (
          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Receipt size={13} /> Détail des factures
            </p>
            <div className="space-y-1">
              {facturesDetail.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                  <span className="text-gray-600">
                    {new Date(f.date).toLocaleDateString('fr-FR')} — {f.description}
                  </span>
                  <span className="font-semibold text-gray-900">{formatCurrency(f.montant)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function RemunerationsClient({
  dossiers,
  consultant,
  role,
  remTotals = { maxine: 0, thelo: 0 },
  cagnotteData = { maxine: null, thelo: null },
}: RemunerationsClientProps) {
  const isManager = role === 'manager' || role === 'back_office'
  const myName = consultant ? `${consultant.prenom || ''} ${consultant.nom || ''}`.trim() : ''

  // For managers: filter to show only THEIR dossiers in detail table
  const isManagerRole = role === 'manager' || role === 'back_office'
  const myFilteredDossiers = React.useMemo(() => {
    if (!isManagerRole) return dossiers
    return dossiers.filter(d => {
      const name = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
      return name === myName
    })
  }, [dossiers, isManagerRole, myName])

  const finalised = React.useMemo(() => myFilteredDossiers.filter(d => d.statut === 'client_finalise'), [myFilteredDossiers])
  const enCours = React.useMemo(() => myFilteredDossiers.filter(d => d.statut === 'client_en_cours'), [myFilteredDossiers])
  const allWithCommission = React.useMemo(() => myFilteredDossiers.filter(d => (d.commission_brute || 0) > 0), [myFilteredDossiers])

  const buildCagnotte = React.useCallback((consultantDossiers: any[]) => {
    const finDossiers = consultantDossiers.filter(d => d.statut === 'client_finalise')
    const ecDossiers = consultantDossiers.filter(d => d.statut === 'client_en_cours' && (d.commission_brute || 0) > 0)
    const acquis = finDossiers.reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)
    const encaisse = finDossiers.filter(d => d.payee === 'oui').reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)
    const facture = finDossiers.filter(d => d.facturee).reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)
    const resteAFacturer = acquis - facture
    const enCoursEstime = ecDossiers.reduce((sum, d) => sum + (d.rem_apporteur || 0), 0)
    const commissionBruteTotal = finDossiers.reduce((sum, d) => sum + (d.commission_brute || 0), 0)
    const partCabinet = finDossiers.reduce((sum, d) => sum + (d.part_cabinet || 0), 0)
    return { acquis, encaisse, facture, resteAFacturer, enCoursEstime, commissionBruteTotal, partCabinet, nbFinalises: finDossiers.length, nbEnCours: ecDossiers.length }
  }, [])

  // ==========================================
  // MANAGER / BACK_OFFICE VIEW
  // ==========================================
  if (isManager) {
    const isBackOffice = role === 'back_office'
    const myDossiers = React.useMemo(() => dossiers.filter(d => {
      const name = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
      return name === myName
    }), [dossiers, myName])

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

    // Get dossiers for Maxine and Thélo (by prenom)
    const maxineDossiers = React.useMemo(() => dossiers.filter(d => d.consultant_prenom === 'Maxine'), [dossiers])
    const theloDossiers = React.useMemo(() => dossiers.filter(d => d.consultant_prenom === 'Thélo' || d.consultant_prenom === 'Thelo' || d.consultant_prenom === 'Théloïs'), [dossiers])

    const isMaxine = consultant?.prenom === 'Maxine'
    const isThelo = consultant?.prenom?.startsWith('Th')

    const detailColumns: ColumnDefinition<any>[] = [
      { key: 'client_nom', label: 'Client', render: (_, row) => `${row.client_prenom || ''} ${row.client_nom || ''}`.trim() },
      { key: 'consultant_prenom', label: 'Consultant', sortable: true, render: (_, row) => {
        const name = `${row.consultant_prenom || ''} ${row.consultant_nom || ''}`.trim()
        return name === 'Pool Pool' ? 'Pool' : name
      }},
      { key: 'produit_nom', label: 'Produit', sortable: true },
      { key: 'statut', label: 'Statut', render: (value) => <Badge variant={statutVariant(value)}>{statutLabel(value)}</Badge> },
      { key: 'montant', label: 'Montant', sortable: true, render: (value) => formatCurrency(value) },
      { key: 'commission_brute', label: 'Commission brute', sortable: true, render: (value, row) => {
        const entree = formatCurrency(value)
        if (hasEncours(row.produit_nom) && row.montant && row.montant > 0) {
          return (
            <div className="text-sm">
              <div className="font-medium">{entree}</div>
              <div className="text-xs text-green-600">Encours: PE/LUX</div>
            </div>
          )
        }
        return entree
      }},
      { key: 'rem_apporteur', label: 'Part Consultant', render: (value) => formatCurrency(value) },
      {
        key: 'facturee', label: 'Facturation',
        render: (value, row) => {
          if (row.payee === 'oui') return <Badge variant="success">Payée</Badge>
          if (value) return <Badge variant="warning">Émise</Badge>
          if (row.statut === 'client_finalise') return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300"><Clock size={12} />À venir</Badge>
          return <Badge variant="secondary">-</Badge>
        },
      },
    ]

    const handleExportCSV = React.useCallback(() => {
      const exportData = filteredDossiers.map(d => {
        const consultantName = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim()
        return {
          client: `${d.client_prenom || ''} ${d.client_nom || ''}`.trim(),
          consultant: consultantName === 'Pool Pool' ? 'Pool' : consultantName,
          statut: statutLabel(d.statut), montant: formatCurrencyForCSV(d.montant),
          commission_brute: formatCurrencyForCSV(d.commission_brute),
          rem_apporteur: formatCurrencyForCSV(d.rem_apporteur),
          part_cabinet: formatCurrencyForCSV(d.part_cabinet),
          facturee: d.facturee ? 'Oui' : 'Non',
          payee: d.payee === 'oui' ? 'Oui' : d.payee === 'en_cours' ? 'Prévision' : 'Non',
        }
      })
      exportCSV(exportData, [
        { key: 'client', label: 'Client' }, { key: 'consultant', label: 'Consultant' },
        { key: 'statut', label: 'Statut' }, { key: 'montant', label: 'Montant (EUR)' },
        { key: 'commission_brute', label: 'Commission brute (EUR)' },
        { key: 'rem_apporteur', label: 'Part Consultant (EUR)' },
        { key: 'part_cabinet', label: 'Part Cabinet (EUR)' },
        { key: 'facturee', label: 'Facturée' }, { key: 'payee', label: 'Payée' },
      ], { filename: getExportFilename('remunerations_export'), separator: ';' })
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
            <Download size={18} />Exporter CSV
          </Button>
        </div>

        {/* CAGNOTTE MANAGER — seulement la sienne, masqué pour back_office */}
        {!isBackOffice && (
          <div className="max-w-xl">
            {isMaxine && (
              <ManagerCagnotteCard
                label="Maxine"
                remTotal={remTotals.maxine}
                cagnotteRow={cagnotteData.maxine}
                dossiers={maxineDossiers}
                consultantId={consultant?.id}
                isCurrentUser={true}
              />
            )}
            {isThelo && (
              <ManagerCagnotteCard
                label="Thélo"
                remTotal={remTotals.thelo}
                cagnotteRow={cagnotteData.thelo}
                dossiers={theloDossiers}
                consultantId={consultant?.id}
                isCurrentUser={true}
              />
            )}
            {!isMaxine && !isThelo && (
              <ManagerCagnotteCard
                label={consultant?.prenom || 'Manager'}
                remTotal={buildCagnotte(myDossiers).acquis}
                cagnotteRow={null}
                dossiers={myDossiers}
                consultantId={consultant?.id}
                isCurrentUser={true}
              />
            )}
          </div>
        )}

        {/* Facturation for current user — hidden for back_office */}
        {consultant?.id && !isBackOffice && (
          <FacturationConsultant
            consultantId={consultant.id}
            dossiers={myDossiers.filter(d => d.statut === 'client_finalise')}
            resteAFacturer={
              isMaxine
                ? (cagnotteData.maxine?.acquis_total ? Number(cagnotteData.maxine.acquis_total) : (remTotals.maxine + Number(cagnotteData.maxine?.solde_2025 || 0))) - Number(cagnotteData.maxine?.montant_facture || 0)
                : isThelo
                  ? (cagnotteData.thelo?.acquis_total ? Number(cagnotteData.thelo.acquis_total) : (remTotals.thelo + Number(cagnotteData.thelo?.solde_2025 || 0))) - Number(cagnotteData.thelo?.montant_facture || 0)
                  : buildCagnotte(myDossiers).resteAFacturer
            }
          />
        )}

        {/* Tabs + table — uniquement MES dossiers */}
        <div className="flex gap-2 border-b border-gray-200">
          {([
            { key: 'finalise' as const, label: 'Finalisés', count: finalised.length },
            { key: 'en_cours' as const, label: 'Prévision', count: enCours.filter(d => (d.commission_brute || 0) > 0).length },
            { key: 'tous' as const, label: 'Tous (avec commission)', count: allWithCommission.length },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab.key ? 'bg-white text-blue-600 border border-gray-200 border-b-white -mb-px' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <Card>
          <CardHeader><CardTitle>Détail des commissions</CardTitle></CardHeader>
          <CardContent>
            <DataTable data={filteredDossiers} columns={detailColumns} pageSize={15} />
          </CardContent>
        </Card>
      </div>
    )
  } else {
    // ==========================================
    // CONSULTANT VIEW
    // ==========================================
    const myCagnotte = React.useMemo(() => buildCagnotte(dossiers), [dossiers, buildCagnotte])

    const myColumns: ColumnDefinition<any>[] = [
      { key: 'client_nom', label: 'Client', render: (_, row) => `${row.client_prenom || ''} ${row.client_nom || ''}`.trim() },
      { key: 'produit_nom', label: 'Produit' },
      { key: 'compagnie_nom', label: 'Compagnie' },
      { key: 'statut', label: 'Statut', render: (value) => <Badge variant={statutVariant(value)}>{statutLabel(value)}</Badge> },
      { key: 'montant', label: 'Montant', render: (value) => formatCurrency(value) },
      { key: 'rem_apporteur', label: 'Ma commission', render: (value, row) => {
        const entree = formatCurrency(value)
        if (hasEncours(row.produit_nom) && row.montant && row.montant > 0) {
          return (
            <div className="text-sm">
              <div className="font-medium">{entree}</div>
              <div className="text-xs text-green-600">+ encours trimestriel</div>
            </div>
          )
        }
        return entree
      }},
      {
        key: 'facturee', label: 'Facturation',
        render: (value, row) => {
          if (row.payee === 'oui') return <Badge variant="success">Payée</Badge>
          if (value) return <Badge variant="warning">Émise</Badge>
          if (row.statut === 'client_finalise') return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300"><Clock size={12} />À venir</Badge>
          return <Badge variant="secondary">-</Badge>
        },
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
      const exportData = filteredDossiers.map(d => ({
        client: `${d.client_prenom || ''} ${d.client_nom || ''}`.trim(),
        produit: d.produit_nom || '', compagnie: d.compagnie_nom || '',
        statut: statutLabel(d.statut), montant: formatCurrencyForCSV(d.montant),
        commission_brute: formatCurrencyForCSV(d.commission_brute),
        rem_apporteur: formatCurrencyForCSV(d.rem_apporteur),
        payee: d.payee === 'oui' ? 'Oui' : d.payee === 'en_cours' ? 'Prévision' : 'Non',
      }))
      exportCSV(exportData, [
        { key: 'client', label: 'Client' }, { key: 'produit', label: 'Produit' },
        { key: 'compagnie', label: 'Compagnie' }, { key: 'statut', label: 'Statut' },
        { key: 'montant', label: 'Montant (EUR)' }, { key: 'commission_brute', label: 'Commission brute (EUR)' },
        { key: 'rem_apporteur', label: 'Ma commission (EUR)' }, { key: 'payee', label: 'Payée' },
      ], { filename: getExportFilename('mes_commissions_export'), separator: ';' })
    }, [filteredDossiers])

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ma Rémunération</h1>
            <p className="text-gray-600 mt-1">Ma cagnotte et mes commissions</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download size={18} />Exporter CSV
          </Button>
        </div>

        {/* Cagnotte consultant */}
        <Card className="border-2 border-indigo-200 bg-indigo-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet size={22} className="text-indigo-600" />Ma cagnotte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Acquis (finalisé)</p>
                <p className="text-2xl font-bold text-indigo-700">{formatCurrency(myCagnotte.acquis)}</p>
                <p className="text-xs text-gray-500">{myCagnotte.nbFinalises} dossier(s)</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Encaissé</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(myCagnotte.encaisse)}</p>
                <p className="text-xs text-gray-500">paiements reçus</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Facturé (en attente)</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(myCagnotte.facture - myCagnotte.encaisse)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Cagnotte</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(myCagnotte.resteAFacturer)}</p>
                <p className="text-xs text-gray-400">reste à facturer</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prévision</p>
                <p className="text-2xl font-bold text-gray-500">{formatCurrency(myCagnotte.enCoursEstime)}</p>
                <p className="text-xs text-gray-500">{myCagnotte.nbEnCours} dossier(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grille de commissionnement progressive */}
        {consultant && (
          <CommissionGrille
            consultantId={consultant.id}
            consultantNom={`${consultant.prenom || ''} ${consultant.nom || ''}`.trim()}
            dossiers={dossiers}
          />
        )}

        {consultant?.id && (
          <FacturationConsultant
            consultantId={consultant.id}
            dossiers={finalised}
            resteAFacturer={myCagnotte.resteAFacturer}
          />
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {([
            { key: 'finalise' as const, label: 'Finalisés', count: finalised.length },
            { key: 'en_cours' as const, label: 'Prévision', count: enCours.filter(d => (d.commission_brute || 0) > 0).length },
            { key: 'tous' as const, label: 'Tous', count: allWithCommission.length },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab.key ? 'bg-white text-blue-600 border border-gray-200 border-b-white -mb-px' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Détail de mes dossiers</CardTitle></CardHeader>
          <CardContent>
            {filteredDossiers.length > 0 ? (
              <DataTable data={filteredDossiers} columns={myColumns} pageSize={10} />
            ) : (
              <p className="text-center text-gray-500 py-6">Aucun dossier dans cette catégorie</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }
}
