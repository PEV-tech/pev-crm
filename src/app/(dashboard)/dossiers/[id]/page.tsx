export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { VDossiersComplets } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const mapStatutForBadge = (statut: string | null | undefined): 'prospect' | 'client_en_cours' | 'client_finalise' => {
  return (statut as 'prospect' | 'client_en_cours' | 'client_finalise') || 'prospect'
}

async function getDossier(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_dossiers_complets')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data as VDossiersComplets
}

export default async function DossierDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const dossier = await getDossier(params.id)

  if (!dossier) {
    notFound()
  }

  const facturationStatus = dossier.facturee
    ? dossier.payee === 'oui'
      ? ('payée' as const)
      : ('émise' as const)
    : ('à émettre' as const)

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/dossiers">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft size={18} />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Dossier #{dossier.id?.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-gray-600 mt-1">
            {dossier.client_prenom} {dossier.client_nom}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Informations du dossier</CardTitle>
                <Button variant="outline" size="sm" className="gap-2">
                  <Edit size={16} />
                  Modifier
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Client</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {dossier.client_prenom} {dossier.client_nom}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Pays</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {dossier.client_pays}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Produit</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {dossier.produit_nom || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Compagnie</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {dossier.compagnie_nom || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Montant</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {formatCurrency(dossier.montant)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Financement</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1 capitalize">
                    {dossier.financement || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date opération</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {dossier.date_operation
                      ? new Date(dossier.date_operation).toLocaleDateString(
                          'fr-FR'
                        )
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Consultant</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {dossier.consultant_prenom} {dossier.consultant_nom}
                  </p>
                </div>
              </div>

              {dossier.commentaire && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-500">Commentaire</p>
                  <p className="text-gray-700 mt-1">{dossier.commentaire}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Commission Card */}
          {dossier.statut === 'client_finalise' && dossier.commission_brute && (
            <Card>
              <CardHeader>
                <CardTitle>Détail de la commission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 border-b border-gray-200 pb-4">
                  <div>
                    <p className="text-sm text-gray-600">Commission brute</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {formatCurrency(dossier.commission_brute)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Taux commission</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {dossier.taux_commission
                        ? `${(dossier.taux_commission * 100).toFixed(2)}%`
                        : '-'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {dossier.rem_apporteur && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Part Consultant</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(dossier.rem_apporteur)}
                      </span>
                    </div>
                  )}
                  {dossier.rem_support && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Part Support</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(dossier.rem_support)}
                      </span>
                    </div>
                  )}
                  {dossier.part_cabinet && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600">Part Cabinet</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(dossier.part_cabinet)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statuts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-2">Dossier</p>
                <StatusBadge
                  status={mapStatutForBadge(dossier.statut)}
                  type="dossier"
                />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Facturation</p>
                <StatusBadge
                  status={facturationStatus}
                  type="facturation"
                />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">KYC</p>
                <StatusBadge
                  status={
                    (dossier.statut_kyc as 'non' | 'en_cours' | 'oui') || 'non'
                  }
                  type="kyc"
                />
              </div>
            </CardContent>
          </Card>

          {/* Regulatory Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Réglementaire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">KYC</span>
                <Badge
                  variant={dossier.statut_kyc === 'oui' ? 'success' : 'destructive'}
                >
                  {dossier.statut_kyc === 'oui' ? 'Validé' : 'Non validé'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">DER</span>
                <Badge
                  variant={dossier.der ? 'success' : 'destructive'}
                >
                  {dossier.der ? 'Oui' : 'Non'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">PI</span>
                <Badge
                  variant={dossier.pi ? 'success' : 'destructive'}
                >
                  {dossier.pi ? 'Oui' : 'Non'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Facturation Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Facturation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Facturée</p>
                <Badge
                  variant={dossier.facturee ? 'success' : 'destructive'}
                  className="mt-1"
                >
                  {dossier.facturee ? 'Oui' : 'Non'}
                </Badge>
              </div>
              {dossier.date_facture && (
                <div>
                  <p className="text-sm text-gray-600">Date facture</p>
                  <p className="font-semibold text-gray-900 mt-1">
                    {new Date(dossier.date_facture).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Payée</p>
                <Badge
                  variant={dossier.payee === 'oui' ? 'success' : 'destructive'}
                  className="mt-1"
                >
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
