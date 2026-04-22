'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { SkeletonTable } from '@/components/shared/skeleton'
import { createClient } from '@/lib/supabase/client'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { Plus, Receipt, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/formatting'
import { VDossiersComplets } from '@/types/database'

const ITEMS_PER_PAGE = 25

interface FacturationConsultantProps {
  consultantId: string
  dossiers: VDossiersComplets[] // finalized dossiers for selection
  resteAFacturer: number
}

interface Facture {
  id: string
  numero_facture: string | null
  montant: number
  date_facture: string | null
  date_paiement: string | null
  dossier_id: string | null
  description: string | null
  statut: 'emise' | 'payee' | 'annulee'
  created_at: string
}

export function FacturationConsultant({ consultantId, dossiers, resteAFacturer }: FacturationConsultantProps) {
  const [factures, setFactures] = React.useState<Facture[]>([])
  const [loading, setLoading] = React.useState(true)
  const timedOut = useLoadingTimeout(loading, 15000)
  const [showForm, setShowForm] = React.useState(false)
  const [currentPage, setCurrentPage] = React.useState(0)
  const [totalCount, setTotalCount] = React.useState(0)

  // Form state
  const [formMontant, setFormMontant] = React.useState('')
  const [formNumero, setFormNumero] = React.useState('')
  const [formDescription, setFormDescription] = React.useState('')
  const [formDossierId, setFormDossierId] = React.useState('')
  const [formDate, setFormDate] = React.useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = React.useState(false)

  const fetchFactures = React.useCallback(async (page: number = 0) => {
    const supabase = createClient()
    const from = page * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    // Fetch data with pagination
    const { data, error, count } = await supabase
      .from('facturation_consultant')
      .select('*', { count: 'exact' })
      .eq('consultant_id', consultantId)
      .order('date_facture', { ascending: false })
      .range(from, to)

    if (!error && data) {
      setFactures(data as any)
      setTotalCount(count || 0)
      setCurrentPage(page)
    }
    setLoading(false)
  }, [consultantId])

  React.useEffect(() => {
    if (consultantId) fetchFactures(0)
  }, [consultantId, fetchFactures])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formMontant || Number(formMontant) <= 0) return

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('facturation_consultant').insert({
      consultant_id: consultantId,
      montant: Number(formMontant),
      date_facture: formDate,
    })

    if (!error) {
      setShowForm(false)
      setFormMontant('')
      setFormNumero('')
      setFormDescription('')
      setFormDossierId('')
      setFormDate(new Date().toISOString().split('T')[0])
      fetchFactures(0)
    }
    setSaving(false)
  }

  const handleMarkPaid = async (factureId: string) => {
    const supabase = createClient()
    await supabase.from('facturation_consultant').delete().eq('id', factureId)
    fetchFactures(currentPage)
  }

  const handleCancel = async (factureId: string) => {
    const supabase = createClient()
    await supabase.from('facturation_consultant').delete().eq('id', factureId)
    fetchFactures(currentPage)
  }

  // Totals
  const totalFacture = factures.filter(f => f.statut !== 'annulee').reduce((sum, f) => sum + f.montant, 0)
  const totalPaye = factures.filter(f => f.statut === 'payee').reduce((sum, f) => sum + f.montant, 0)
  const totalEnAttente = factures.filter(f => f.statut === 'emise').reduce((sum, f) => sum + f.montant, 0)

  const columns: ColumnDefinition<Facture>[] = [
    {
      key: 'date_facture',
      label: 'Date',
      render: (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '-',
    },
    {
      key: 'numero_facture',
      label: 'N° Facture',
      render: (value) => value || '-',
    },
    {
      key: 'montant',
      label: 'Montant',
      render: (value) => formatCurrency(value),
    },
    {
      key: 'description',
      label: 'Description',
      render: (value) => value || '-',
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (value) => {
        const variant = value === 'payee' ? 'success' : value === 'annulee' ? 'destructive' : 'warning'
        const label = value === 'payee' ? 'Payée' : value === 'annulee' ? 'Annulée' : 'Émise'
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      key: 'date_paiement',
      label: 'Date paiement',
      render: (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '-',
    },
    {
      key: 'id',
      label: 'Actions',
      render: (value, row) => {
        if (row.statut !== 'emise') return null
        return (
          <div className="flex gap-1">
            <button
              onClick={() => handleMarkPaid(value)}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="Marquer payée"
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => handleCancel(value)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="Annuler"
            >
              <X size={16} />
            </button>
          </div>
        )
      },
    },
  ]

  if (loading) {
    if (timedOut) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt size={20} className="text-blue-600" />
              Suivi de mes factures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <p className="text-gray-600 text-center">Impossible de charger les données. Vérifiez votre connexion et rechargez la page.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Recharger
              </button>
            </div>
          </CardContent>
        </Card>
      )
    }
    return <SkeletonTable rows={5} columns={7} />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt size={20} className="text-blue-600" />
            Suivi de mes factures
          </CardTitle>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus size={16} />
            Nouvelle facture
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">Total facturé</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(totalFacture)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">Payé</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaye)}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">En attente de paiement</p>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(totalEnAttente)}</p>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
            <h4 className="font-medium text-gray-900">Enregistrer une facture</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formMontant}
                  onChange={(e) => setFormMontant(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° de facture</label>
                <input
                  type="text"
                  value={formNumero}
                  onChange={(e) => setFormNumero(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="FC-2026-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dossier associé</label>
                <select
                  value={formDossierId}
                  onChange={(e) => setFormDossierId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">-- Aucun / Général --</option>
                  {dossiers.map((d: VDossiersComplets) => (
                    <option key={d.id || ''} value={d.id || ''}>
                      {d.client_prenom} {d.client_nom} - {d.produit_nom} ({formatCurrency(d.commission_brute)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Facture janvier, commission SCPI..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </form>
        )}

        {/* Table */}
        {factures.length > 0 ? (
          <>
            <DataTable data={factures} columns={columns} pageSize={ITEMS_PER_PAGE} />

            {/* Pagination */}
            {totalCount > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <span className="text-sm text-gray-600">
                  {totalCount === 0 ? '0' : (currentPage * ITEMS_PER_PAGE) + 1} - {Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalCount)} sur {totalCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchFactures(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="gap-1"
                  >
                    <ChevronLeft size={16} />
                    Précédent
                  </Button>
                  <span className="text-sm text-gray-600 flex items-center px-2">
                    Page {currentPage + 1} sur {Math.ceil(totalCount / ITEMS_PER_PAGE)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchFactures(currentPage + 1)}
                    disabled={(currentPage + 1) * ITEMS_PER_PAGE >= totalCount}
                    className="gap-1"
                  >
                    Suivant
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-gray-500 py-4">
            Aucune facture enregistrée. Cliquez sur &quot;Nouvelle facture&quot; pour commencer.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
