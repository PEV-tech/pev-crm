'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, Loader2, X, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  computeKycCompletion,
  type KycCompletionResult,
} from '@/lib/kyc-completion'

/**
 * Modal de signature KYC avec garde-fou de conformité.
 *
 * Flow :
 *  1. Détection : calcule la complétude à l'ouverture.
 *  2. Avertissement bloquant si complétude < 100% avec message légal fourni
 *     par Maxine (cf. CDC). Toujours affiché pour visibilité.
 *  3. Double validation : deux cases à cocher obligatoires pour les KYC
 *     incomplets (consentement + certification).
 *  4. Signature : saisie du nom complet du signataire (tenant lieu de
 *     signature électronique V1 — à upgrader vers un pad signature + hash ou
 *     un provider DocuSign/Yousign ultérieurement).
 *  5. POST /api/sign-kyc : persiste audit trail côté serveur.
 */

interface KYCSignatureDialogProps {
  open: boolean
  onClose: () => void
  client: Record<string, any>
  /** Callback déclenché après signature OK, pour rafraîchir la vue parente. */
  onSigned: () => void
}

export function KYCSignatureDialog({
  open,
  onClose,
  client,
  onSigned,
}: KYCSignatureDialogProps) {
  const completion: KycCompletionResult = React.useMemo(
    () => computeKycCompletion(client),
    [client]
  )
  const isIncomplete = !completion.isComplete

  const [signerName, setSignerName] = React.useState('')
  const [consentIncomplete, setConsentIncomplete] = React.useState(false)
  const [consentAccuracy, setConsentAccuracy] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset à chaque ouverture pour éviter qu'un consentement précédent
  // persiste (risque de signature non intentionnelle sur un autre client).
  React.useEffect(() => {
    if (open) {
      setSignerName('')
      setConsentIncomplete(false)
      setConsentAccuracy(false)
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  const canSubmit = (() => {
    if (!signerName.trim()) return false
    if (isIncomplete && (!consentIncomplete || !consentAccuracy)) return false
    // Pour un KYC complet on demande quand même la case "informations exactes".
    if (!isIncomplete && !consentAccuracy) return false
    return true
  })()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/sign-kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          signer_name: signerName.trim(),
          completion_rate: completion.rate,
          missing_fields: completion.missingKeys,
          consent_incomplete: consentIncomplete,
          consent_accuracy: consentAccuracy,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || `Erreur HTTP ${res.status}`)
        setSubmitting(false)
        return
      }

      onSigned()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
      setSubmitting(false)
    }
  }

  // Couleur & libellé du badge de complétude selon le taux.
  const rateColor =
    completion.rate >= 100
      ? 'text-green-700 bg-green-50 border-green-200'
      : completion.rate >= 70
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-red-700 bg-red-50 border-red-200'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <PenLine size={20} className="text-navy-600" />
            <h2 className="text-lg font-bold text-gray-900">
              Signature du KYC
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Fermer"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Complétude */}
          <div
            className={`flex items-center justify-between p-4 border rounded-lg ${rateColor}`}
          >
            <div className="flex items-center gap-3">
              {completion.isComplete ? (
                <CheckCircle2 size={24} />
              ) : (
                <AlertTriangle size={24} />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {completion.isComplete
                    ? 'KYC complet'
                    : 'KYC incomplet'}
                </p>
                <p className="text-xs opacity-90">
                  {completion.filled} / {completion.total} champs requis
                  renseignés
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{completion.rate}%</p>
            </div>
          </div>

          {/* Avertissement si incomplet : message légal fourni par Maxine */}
          {isIncomplete && (
            <div className="border-2 border-amber-300 bg-amber-50 rounded-lg p-4">
              <p className="text-sm font-bold text-amber-900 mb-2">
                ⚠️ Attention – KYC incomplet
              </p>
              <p className="text-sm text-amber-900 mb-3">
                Certaines informations nécessaires à l&apos;analyse de votre
                situation n&apos;ont pas été renseignées. Votre conseiller vous
                recommande de compléter ces informations afin de garantir une
                évaluation adaptée à votre profil.
              </p>
              <p className="text-sm text-amber-900 mb-2">
                En choisissant de signer ce document en l&apos;état, vous
                reconnaissez :
              </p>
              <ul className="list-disc list-inside text-sm text-amber-900 space-y-1 ml-2">
                <li>que les informations fournies sont partielles,</li>
                <li>
                  que cela peut limiter la pertinence des conseils qui vous
                  seront proposés,
                </li>
                <li>
                  que vous acceptez de valider ce document malgré ces éléments
                  manquants.
                </li>
              </ul>

              {/* Liste des champs manquants, pour transparence. */}
              {completion.missingLabels.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs font-semibold text-amber-900 cursor-pointer hover:underline">
                    Voir les {completion.missingLabels.length} champ
                    {completion.missingLabels.length > 1 ? 's' : ''} manquant
                    {completion.missingLabels.length > 1 ? 's' : ''}
                  </summary>
                  <ul className="mt-2 list-disc list-inside text-xs text-amber-800 space-y-0.5 ml-2">
                    {completion.missingLabels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Double validation (ou simple si complet). */}
          <div className="space-y-3">
            {isIncomplete && (
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentIncomplete}
                  onChange={(e) => setConsentIncomplete(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-navy-600 focus:ring-navy-500"
                />
                <span className="text-sm text-gray-800">
                  Je confirme vouloir signer un KYC incomplet.
                </span>
              </label>
            )}
            <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={consentAccuracy}
                onChange={(e) => setConsentAccuracy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-navy-600 focus:ring-navy-500"
              />
              <span className="text-sm text-gray-800">
                Je certifie que les informations fournies sont exactes.
              </span>
            </label>
          </div>

          {/* Signature : saisie du nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du signataire <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Prénom NOM"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-navy-400 focus:border-navy-400 font-serif italic text-lg"
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">
              La saisie de votre nom vaut signature électronique. Horodatage
              et adresse IP seront enregistrés.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Signer{isIncomplete ? ' le KYC incomplet' : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
