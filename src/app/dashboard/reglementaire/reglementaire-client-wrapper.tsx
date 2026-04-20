'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { ManagerOnly } from '@/components/shared/manager-only'
import { ReglementaireClient } from './reglementaire-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

// Quality check definitions
interface QualityIssue {
  dossierId: string
  clientNom: string
  consultantNom: string
  produitNom: string
  severity: 'error' | 'warning' | 'info'
  message: string
  field: string
}

function runQualityChecks(dossiers: any[]): QualityIssue[] {
  const issues: QualityIssue[] = []
  // Pour éviter de doublonner les alertes "signature KYC incomplète" au
  // niveau client, on les lève une seule fois par client_id.
  const signatureIncompleteSeen = new Set<string>()

  dossiers.forEach(d => {
    const clientName = `${d.client_prenom || ''} ${d.client_nom || ''}`.trim() || 'Sans nom'
    const consultantName = `${d.consultant_prenom || ''} ${d.consultant_nom || ''}`.trim() || 'Non attribué'
    const base = { dossierId: d.id, clientNom: clientName, consultantNom: consultantName, produitNom: d.produit_nom || '-' }

    // Missing product
    if (!d.produit_nom) issues.push({ ...base, severity: 'error', message: 'Produit non renseigné', field: 'produit' })
    // Missing compagnie
    if (!d.compagnie_nom) issues.push({ ...base, severity: 'error', message: 'Compagnie non renseignée', field: 'compagnie' })
    // Missing montant
    if (!d.montant || d.montant <= 0) issues.push({ ...base, severity: 'error', message: 'Montant manquant ou à zéro', field: 'montant' })
    // Missing date_operation
    if (!d.date_operation) issues.push({ ...base, severity: 'warning', message: 'Date d\'opération manquante', field: 'date_operation' })
    // Missing commission on finalized
    if (d.statut === 'client_finalise' && (!d.commission_brute || d.commission_brute <= 0)) {
      issues.push({ ...base, severity: 'error', message: 'Commission brute manquante sur dossier finalisé', field: 'commission' })
    }
    // KYC not done on finalized
    if (d.statut === 'client_finalise' && d.statut_kyc !== 'oui') {
      issues.push({ ...base, severity: 'error', message: 'KYC non validé sur dossier finalisé', field: 'kyc' })
    }
    // Compliance flags missing on finalized
    if (d.statut === 'client_finalise') {
      if (!d.der) issues.push({ ...base, severity: 'warning', message: 'DER non complété', field: 'der' })
      if (!d.pi) issues.push({ ...base, severity: 'warning', message: 'PI non complété', field: 'pi' })
      if (!d.lm) issues.push({ ...base, severity: 'warning', message: 'LM non complété', field: 'lm' })
      if (!d.rm) issues.push({ ...base, severity: 'warning', message: 'RM non complété', field: 'rm' })
    }
    // Missing consultant
    if (!d.consultant_nom) issues.push({ ...base, severity: 'error', message: 'Consultant non attribué', field: 'consultant' })
    // Facture missing on finalized
    if (d.statut === 'client_finalise' && d.facturee === null) {
      issues.push({ ...base, severity: 'info', message: 'Facture non créée', field: 'facture' })
    }
    // Missing pays
    if (!d.client_pays) issues.push({ ...base, severity: 'warning', message: 'Pays client non renseigné', field: 'pays' })

    // Signature KYC marquée incomplète au moment de signer — warning
    // compliance : audit ACPR/DDA peut exiger des compléments. On alerte
    // une seule fois par client, même si plusieurs dossiers rattachés.
    if (d.client_id && d.kyc_incomplete_signed === true && !signatureIncompleteSeen.has(d.client_id)) {
      signatureIncompleteSeen.add(d.client_id)
      const rate = typeof d.kyc_completion_rate === 'number' ? d.kyc_completion_rate : null
      issues.push({
        ...base,
        severity: 'warning',
        message: rate !== null
          ? `Signature KYC reçue avec dossier incomplet (${rate}%) — à compléter`
          : 'Signature KYC reçue avec dossier incomplet — à compléter',
        field: 'kyc_signature',
      })
    }
  })
  return issues
}

function QualityPanel({ dossiers }: { dossiers: any[] }) {
  const issues = React.useMemo(() => runQualityChecks(dossiers), [dossiers])
  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')
  const infos = issues.filter(i => i.severity === 'info')

  // Count distinct clients with an incomplete signed KYC — mise en exergue
  // car c'est une alerte réglementaire ciblée (signature ≠ complétude).
  const kycIncompleteClients = React.useMemo(() => {
    const set = new Set<string>()
    dossiers.forEach((d: any) => {
      if (d.client_id && d.kyc_incomplete_signed === true) set.add(d.client_id)
    })
    return set.size
  }, [dossiers])

  const totalDossiers = dossiers.length
  const dossiersWithErrors = new Set(errors.map(e => e.dossierId)).size
  const dossiersClean = totalDossiers - dossiersWithErrors
  const qualityPct = totalDossiers > 0 ? Math.round((dossiersClean / totalDossiers) * 100) : 100

  const [showAll, setShowAll] = React.useState(false)
  const displayedIssues = showAll ? issues : issues.slice(0, 20)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle size={20} className="text-amber-600" />
          Contrôle qualité — {totalDossiers} dossiers analysés
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold" style={{ color: qualityPct === 100 ? '#16a34a' : qualityPct >= 80 ? '#d97706' : '#dc2626' }}>
              {qualityPct}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Score qualité</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <XCircle size={16} className="text-red-600" />
              <p className="text-2xl font-bold text-red-700">{errors.length}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Erreurs</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <AlertCircle size={16} className="text-amber-600" />
              <p className="text-2xl font-bold text-amber-700">{warnings.length}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Avertissements</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle size={16} className="text-green-600" />
              <p className="text-2xl font-bold text-green-700">{dossiersClean}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Dossiers conformes</p>
          </div>
        </div>

        {/* Bandeau signature KYC incomplète — affiché uniquement s'il y a du
            stock à traiter. Cliquable vers la liste des clients. */}
        {kycIncompleteClients > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle size={18} className="text-red-600 shrink-0" />
            <div className="flex-1 text-sm">
              <span className="font-semibold text-red-800">
                {kycIncompleteClients} client{kycIncompleteClients > 1 ? 's' : ''} avec signature KYC incomplète
              </span>
              <span className="text-red-700">
                {' '}— à compléter en priorité (faisceau de preuve ACPR/DDA).
              </span>
            </div>
          </div>
        )}

        {/* Issues list */}
        {issues.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">Sévérité</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Client</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Consultant</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Produit</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Problème</th>
                </tr>
              </thead>
              <tbody>
                {displayedIssues.map((issue, i) => (
                  <tr key={`${issue.dossierId}-${issue.field}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Badge variant={issue.severity === 'error' ? 'destructive' : issue.severity === 'warning' ? 'warning' : 'secondary'}>
                        {issue.severity === 'error' ? 'Erreur' : issue.severity === 'warning' ? 'Alerte' : 'Info'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-medium">{issue.clientNom}</td>
                    <td className="px-3 py-2">{issue.consultantNom}</td>
                    <td className="px-3 py-2">{issue.produitNom}</td>
                    <td className="px-3 py-2">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {issues.length > 20 && (
              <button onClick={() => setShowAll(!showAll)} className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                {showAll ? 'Voir moins' : `Voir les ${issues.length - 20} problèmes restants`}
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-green-600 font-medium">
            <CheckCircle size={32} className="mx-auto mb-2" />
            Tous les dossiers sont conformes
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ReglementaireClientWrapper() {
  const [data, setData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        // Parallèle : dossiers + signatures KYC côté client. Les infos de
        // signature (kyc_signed_at, kyc_incomplete_signed, rate) vivent sur
        // la table `clients`, pas sur la vue `v_dossiers_complets`. On
        // merge côté client pour éviter de refaire la vue SQL.
        const [dossiersRes, clientsKycRes] = await Promise.all([
          supabase
            .from('v_dossiers_complets')
            .select('id, client_id, statut, date_operation, montant, client_nom, client_prenom, client_pays, consultant_nom, consultant_prenom, produit_nom, compagnie_nom, statut_kyc, der, pi, preco, lm, rm, commission_brute, facturee'),
          // Cast `any` : les colonnes kyc_signature_audit ne sont pas encore
          // dans src/types/database.ts (migration appliquée en prod, types
          // non régénérés) — cf. STATUS.md dette post-regen.
          (supabase.from('clients') as any)
            .select('id, kyc_signed_at, kyc_incomplete_signed, kyc_completion_rate, kyc_signer_name'),
        ])

        const dossiers = (dossiersRes.data || []) as any[]
        const clientsKyc = (clientsKycRes.data || []) as Array<{
          id: string
          kyc_signed_at: string | null
          kyc_incomplete_signed: boolean | null
          kyc_completion_rate: number | null
          kyc_signer_name: string | null
        }>
        const kycByClient = new Map(clientsKyc.map((c) => [c.id, c]))

        if (!dossiersRes.error) {
          const merged = dossiers.map((d) => {
            const k = d.client_id ? kycByClient.get(d.client_id) : undefined
            return {
              ...d,
              kyc_signed_at: k?.kyc_signed_at ?? null,
              kyc_incomplete_signed: k?.kyc_incomplete_signed ?? null,
              kyc_completion_rate: k?.kyc_completion_rate ?? null,
              kyc_signer_name: k?.kyc_signer_name ?? null,
            }
          })
          setData(merged)
        } else {
          setData([])
        }
      } catch (error) {
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  return (
    <ManagerOnly>
      <div className="space-y-6">
        <QualityPanel dossiers={data} />
        <ReglementaireClient initialData={data} />
      </div>
    </ManagerOnly>
  )
}
