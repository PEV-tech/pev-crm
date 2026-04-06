'use client'

import * as React from 'react'
import { createClient } from '@supabase/supabase-js'
import { VDossiersComplets } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowLeft, Edit, Save, X, Loader2 } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

const mapStatutForBadge = (statut: string | null | undefined): 'prospect' | 'client_en_cours' | 'client_finalise' => {
  return (statut as 'prospect' | 'client_en_cours' | 'client_finalise') || 'prospect'
}

const statutLabel = (s: string | null | undefined) => {
  switch (s) {
    case 'prospect': return 'Prospect'
    case 'client_en_cours': return 'Client en cours'
    case 'client_finalise': return 'Client finalisé'
    default: return s || '-'
  }
}

interface DossierDetailWrapperProps { id: string }

export function DossierDetailWrapper({ id }: DossierDetailWrapperProps) {
  const [dossier, setDossier] = React.useState<VDossiersComplets | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const [editForm, setEditForm] = React.useState<any>({})

  const supabase = React.useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  React.useEffect(() => {
    const fetchAll = async () => {
      try {
        const { data, error } = await supabase.from('v_dossiers_complets').select('*').eq('id', id).single()
        if (error || !data) { setNotFound(true) }
        else {
          setDossier(data as VDossiersComplets)
          setEditForm({
            statut: data.statut || 'prospect',
            montant: data.montant || '',
            financement: data.financement || 'cash',
            date_operation: data.date_operation || '',
            commentaire: data.commentaire || '',
          })
        }
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [id, supabase])

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditForm((prev: any) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const { error } = await supabase.from('dossiers').update({
        statut: editForm.statut,
        montant: parseFloat(editForm.montant) || 0,
        financement: editForm.financement || null,
        date_operation: editForm.date_operation,
        commentaire: editForm.commentaire || null,
      }).eq('id', id)
      if (error) { setSaveError(error.message) }
      else {
        const { data } = await supabase.from('v_dossiers_complets').select('*').eq('id', id).single()
        if (data) setDossier(data as VDossiersComplets)
        setIsEditing(false)
      }
    } catch (e: any) { setSaveError(e.message || 'Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  if (notFound || !dossier) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dossier non trouvé</h1>
        <Link href="/dossiers"><Button variant="outline">Retour aux dossiers</Button></Link>
      </div>
    )
  }

  const facturationStatus = dossier.facturee
    ? dossier.payee === 'oui' ? ('payée' as const) : ('émise' as const)
    : ('à émettre' as const)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dossiers">
          <Button variant="ghost" className="gap-2"><ArrowLeft size={18} />Retour</Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dossier #{dossier.id?.slice(0, 8).toUpperCase()}</h1>
          <p className="text-gray-600 mt-1">{dossier.client_prenom} {dossier.client_nom}</p>
        </div>
      </div>

      {saveError && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{saveError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Informations du dossier</CardTitle>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => { setIsEditing(false); setSaveError('') }}>
                        <X size={16} />Annuler
                      </Button>
                      <Button size="sm" className="gap-2 bg-navy-700 hover:bg-navy-800" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Sauvegarder
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsEditing(true)}>
                      <Edit size={16} />Modifier
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Client</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.client_prenom} {dossier.client_nom}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Pays</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.client_pays}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Produit</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.produit_nom || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Compagnie</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.compagnie_nom || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Stade relationnel</p>
                  {isEditing ? (
                    <Select name="statut" value={editForm.statut} onChange={handleEditChange} className="mt-1">
                      <option value="prospect">Prospect</option>
                      <option value="client_en_cours">Client en cours</option>
                      <option value="client_finalise">Client finalisé</option>
                    </Select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{statutLabel(dossier.statut)}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Montant</p>
                  {isEditing ? (
                    <Input name="montant" type="number" value={editForm.montant} onChange={handleEditChange} className="mt-1" step="0.01" />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(dossier.montant)}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Financement</p>
                  {isEditing ? (
                    <Select name="financement" value={editForm.financement} onChange={handleEditChange} className="mt-1">
                      <option value="cash">Cash</option>
                      <option value="credit">Crédit</option>
                      <option value="lombard">Lombard</option>
                      <option value="remploi">Remploi</option>
                    </Select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1 capitalize">{dossier.financement || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date opération</p>
                  {isEditing ? (
                    <Input name="date_operation" type="date" value={editForm.date_operation} onChange={handleEditChange} className="mt-1" />
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {dossier.date_operation ? new Date(dossier.date_operation).toLocaleDateString('fr-FR') : '-'}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Consultant</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{dossier.consultant_prenom} {dossier.consultant_nom}</p>
                </div>
              </div>

              {isEditing ? (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Commentaire</p>
                  <textarea name="commentaire" value={editForm.commentaire} onChange={handleEditChange}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500"
                    rows={3} />
                </div>
              ) : dossier.commentaire ? (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-500">Commentaire</p>
                  <p className="text-gray-700 mt-1">{dossier.commentaire}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Commission Card */}
          {dossier.statut === 'client_finalise' && dossier.commission_brute && (
            <Card>
              <CardHeader><CardTitle>Détail de la commission</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 border-b border-gray-200 pb-4">
                  <div>
                    <p className="text-sm text-gray-600">Commission brute</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(dossier.commission_brute)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Taux commission</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {dossier.taux_commission ? `${(dossier.taux_commission * 100).toFixed(2)}%` : '-'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {dossier.rem_apporteur && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Part Consultant</span>
                      <span className="font-semibold">{formatCurrency(dossier.rem_apporteur)}</span>
                    </div>
                  )}
                  {dossier.rem_support && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Part Support</span>
                      <span className="font-semibold">{formatCurrency(dossier.rem_support)}</span>
                    </div>
                  )}
                  {dossier.part_cabinet && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600">Part Cabinet</span>
                      <span className="font-semibold">{formatCurrency(dossier.part_cabinet)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Statuts</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-2">Dossier</p>
                <StatusBadge status={mapStatutForBadge(dossier.statut)} type="dossier" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Facturation</p>
                <StatusBadge status={facturationStatus} type="facturation" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">KYC</p>
                <StatusBadge status={(dossier.statut_kyc as 'non' | 'en_cours' | 'oui') || 'non'} type="kyc" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Réglementaire</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'KYC', value: dossier.statut_kyc === 'oui' },
                { label: 'DER', value: !!dossier.der },
                { label: 'PI', value: !!dossier.pi },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <Badge variant={value ? 'success' : 'destructive'}>{value ? 'Validé' : 'Non validé'}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Facturation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Facturée</p>
                <Badge variant={dossier.facturee ? 'success' : 'destructive'} className="mt-1">
                  {dossier.facturee ? 'Oui' : 'Non'}
                </Badge>
              </div>
              {dossier.date_facture && (
                <div>
                  <p className="text-sm text-gray-600">Date facture</p>
                  <p className="font-semibold text-gray-900 mt-1">{new Date(dossier.date_facture).toLocaleDateString('fr-FR')}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Payée</p>
                <Badge variant={dossier.payee === 'oui' ? 'success' : 'destructive'} className="mt-1">
                  {dossier.payee === 'oui' ? 'Oui' : 'Non'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
