'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeKycCompletion } from '@/lib/kyc-completion'

type KycData = Record<string, unknown> & {
  id?: string
  nom?: string
  prenom?: string
  raison_sociale?: string
  type_personne?: string
  email?: string
  telephone?: string
  kyc_signed_at?: string | null
  kyc_signer_name?: string | null
  kyc_incomplete_signed?: boolean | null
  kyc_completion_rate?: number | null
  kyc_missing_fields?: string[] | null
}

/**
 * Client component qui fait tourner le workflow KYC côté visiteur anonyme.
 *
 * Flow :
 * 1. mount → RPC kyc_client_by_token(token) pour récupérer les données
 * 2. mount → RPC kyc_mark_opened(token) pour marquer "En cours" (idempotent)
 * 3. affiche lecture seule + statut
 * 4. si non signé → bouton "Signer" ouvre dialog de signature
 * 5. submit → RPC kyc_sign_by_token(...) puis refresh état
 *
 * Toutes les RPC sont SECURITY DEFINER et limitent strictement ce que le
 * token permet de voir/modifier (cf. add-kyc-link-flow.sql).
 */
export function KycPublicClient({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<KycData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSign, setShowSign] = useState(false)

  async function reload() {
    setLoading(true)
    const { data: row, error: err } = await supabase.rpc(
      'kyc_client_by_token' as never,
      { p_token: token } as never
    )
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    if (!row) {
      setError("Lien invalide ou expiré.")
      setData(null)
      setLoading(false)
      return
    }
    setData(row as KycData)
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    if (!token || token.length < 16) {
      setError("Lien invalide.")
      setLoading(false)
      return
    }
    reload()
    // Marquer comme ouvert (idempotent côté DB).
    supabase
      .rpc('kyc_mark_opened' as never, { p_token: token } as never)
      .then(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Chargement…</div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md bg-white border border-gray-200 rounded-lg p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Lien indisponible
          </h1>
          <p className="text-gray-600 text-sm">
            {error ||
              "Ce lien n'est plus valide. Contactez votre consultant pour en obtenir un nouveau."}
          </p>
        </div>
      </main>
    )
  }

  const isSigned = !!data.kyc_signed_at
  // NB : la colonne `type_personne` stocke 'physique' | 'morale' (texte
  // libre, valeurs saisies par le form `dashboard/clients/nouveau`).
  // Anciennement 'PM' — jamais matché — donnait un nom vide sur le
  // header public des clients PM. Fix 2026-04-21.
  const displayName =
    data.type_personne === 'morale'
      ? data.raison_sociale || ''
      : `${data.prenom || ''} ${data.nom || ''}`.trim()

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Dossier KYC — Private Equity Valley
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Bonjour {displayName || '—'}, merci de vérifier les informations
            ci-dessous puis de signer électroniquement votre dossier.
          </p>
        </div>

        {/* Statut */}
        <div className="mb-6">
          {isSigned ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-green-600 flex items-center justify-center text-white text-xs">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Dossier signé
                  </p>
                  <p className="text-xs text-green-800 mt-1">
                    Signé par {data.kyc_signer_name || '—'} le{' '}
                    {new Date(data.kyc_signed_at!).toLocaleString('fr-FR')}
                    {data.kyc_incomplete_signed
                      ? ' (signature avec KYC incomplet acceptée)'
                      : ''}
                    .
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                En attente de votre signature. Vérifiez les informations
                ci-dessous. Si certaines sont incorrectes ou manquantes,
                contactez votre consultant avant de signer.
              </p>
            </div>
          )}
        </div>

        {/* Récap données */}
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          <RecapRow label="Nom complet" value={displayName} />
          <RecapRow label="Email" value={data.email as string} />
          <RecapRow label="Téléphone" value={data.telephone as string} />
          <RecapRow
            label="Date de naissance"
            value={data.date_naissance as string}
          />
          <RecapRow
            label="Nationalité"
            value={data.nationalite as string}
          />
          <RecapRow
            label="Adresse"
            value={[
              data.adresse as string,
              data.ville as string,
              data.pays as string,
            ]
              .filter(Boolean)
              .join(', ')}
          />
          <RecapRow
            label="Résidence fiscale"
            value={data.residence_fiscale as string}
          />
          <RecapRow
            label="Situation matrimoniale"
            value={data.situation_matrimoniale as string}
          />
          <RecapRow
            label="Profession"
            value={data.profession as string}
          />
          <RecapRow
            label="Employeur"
            value={data.employeur as string}
          />
          <RecapRow
            label="Revenus annuels (total)"
            value={formatAmount(data.total_revenus_annuel)}
          />
          <RecapRow
            label="Patrimoine immobilier"
            value={formatAmount(data.patrimoine_immobilier)}
          />
          <RecapRow
            label="Produits financiers"
            value={formatAmount(data.produits_financiers)}
          />
        </div>

        {/* Action */}
        {!isSigned && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setShowSign(true)}
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Signer mon dossier KYC
            </button>
          </div>
        )}

        {/* Dialog signature — complétion calculée EN DIRECT sur la fiche
            via `computeKycCompletion` (même logique que le dashboard
            consultant). Avant ce fix, on lisait `data.kyc_completion_rate`
            qui n'est jamais rempli AVANT signature : la colonne est
            écrite UNIQUEMENT au moment du sign. La fallback naïve à 100
            masquait des KYC très incomplets au signataire, qui pouvait
            donc cocher « j'atteste de l'exactitude » sans voir passer
            le warning d'incomplétude. Fix 2026-04-21. */}
        {showSign && !isSigned && (() => {
          const live = computeKycCompletion(data as Record<string, unknown>)
          return (
            <SignDialog
              token={token}
              missingFields={live.missingLabels}
              completionRate={live.rate}
              onClose={() => setShowSign(false)}
              onSigned={async () => {
                setShowSign(false)
                await reload()
              }}
            />
          )
        })()}

        {/* Footer légal */}
        <p className="mt-8 text-xs text-gray-500 leading-relaxed">
          Les informations ci-dessus sont collectées par Private Equity Valley
          dans le cadre de ses obligations réglementaires (KYC / LCB-FT). En
          signant, vous certifiez l'exactitude de ces informations. Ce lien
          est personnel et ne doit pas être transféré.
        </p>
      </div>
    </main>
  )
}

function RecapRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="col-span-2 text-gray-900 break-words">
        {value || <span className="text-gray-400 italic">Non renseigné</span>}
      </dd>
    </div>
  )
}

function formatAmount(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return ''
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v)
}

/**
 * Dialog de signature : nom + cases de consentement + bouton confirm.
 * Appelle kyc_sign_by_token via RPC anonyme.
 */
function SignDialog({
  token,
  missingFields,
  completionRate,
  onClose,
  onSigned,
}: {
  token: string
  missingFields: string[]
  completionRate: number
  onClose: () => void
  onSigned: () => void
}) {
  const [signerName, setSignerName] = useState('')
  const [consentAccuracy, setConsentAccuracy] = useState(false)
  const [consentIncomplete, setConsentIncomplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isIncomplete = completionRate < 100
  const canSubmit =
    signerName.trim().length >= 2 &&
    consentAccuracy &&
    (!isIncomplete || consentIncomplete) &&
    !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setErr(null)
    // On passe par /api/kyc/sign-public pour que le serveur (Vercel) capte
    // l'IP publique du signataire via x-forwarded-for et la passe à la RPC.
    // Le navigateur ne la connaît pas, donc tout appel direct à la RPC
    // kyc_sign_by_token laisserait `kyc_signer_ip` à null.
    try {
      const res = await fetch('/api/kyc/sign-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signer_name: signerName.trim(),
          completion_rate: Math.round(completionRate),
          missing_fields: missingFields,
          consent_incomplete: consentIncomplete,
          consent_accuracy: consentAccuracy,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        setErr(payload?.error || 'Erreur lors de la signature')
        setSubmitting(false)
        return
      }
      onSigned()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur réseau')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Signature électronique
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Saisissez votre nom complet et validez les mentions ci-dessous pour
          signer votre dossier KYC.
        </p>

        {isIncomplete && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Votre dossier est complété à {completionRate}%. En signant, vous
            acceptez que certaines informations ({missingFields.length} champ
            {missingFields.length > 1 ? 's' : ''}) ne soient pas renseignées
            pour l&rsquo;instant.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nom et prénom (signature)
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-0"
              placeholder="Ex. Jean Dupont"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={consentAccuracy}
              onChange={(e) => setConsentAccuracy(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Je certifie que les informations renseignées sont exactes et à
              jour.
            </span>
          </label>

          {isIncomplete && (
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={consentIncomplete}
                onChange={(e) => setConsentIncomplete(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                J&rsquo;accepte de signer ce dossier KYC bien qu&rsquo;il soit
                incomplet, et m&rsquo;engage à le compléter ultérieurement.
              </span>
            </label>
          )}
        </div>

        {err && (
          <p className="mt-3 text-xs text-red-600">
            Erreur : {err}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Signature…' : 'Signer'}
          </button>
        </div>
      </div>
    </div>
  )
}
