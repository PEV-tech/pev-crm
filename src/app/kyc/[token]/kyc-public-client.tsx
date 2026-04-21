'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeKycCompletion } from '@/lib/kyc-completion'

/**
 * Portail KYC public /kyc/[token]
 *
 * Version Chantier #4b : le client peut maintenant MODIFIER tout le KYC
 * puis signer + soumettre. La soumission crée une row
 * `kyc_propositions` en `pending` — elle ne touche PAS la table
 * `clients`. Le consultant valide ensuite champ par champ
 * (cf. RPC `kyc_apply_proposition`, UI #4c).
 *
 * États UI possibles :
 *   1. loading            → squelette de chargement
 *   2. error              → lien invalide / expiré
 *   3. already_signed     → dossier déjà signé (lecture seule)
 *   4. pending_proposition → une soumission est en attente de validation
 *                           côté consultant ; on affiche un message
 *                           d'attente au client (question #2 de
 *                           l'arbitrage Maxine 2026-04-22 : une seule
 *                           proposition pending à la fois).
 *   5. editable           → formulaire éditable + bouton "Signer et
 *                           soumettre"
 *
 * Scope de cette itération (#4b.1) :
 *   · Tous les champs scalaires sont éditables.
 *   · Les tableaux JSONB (patrimoine_immobilier, produits_financiers,
 *     patrimoine_divers, emprunts) sont transmis tels quels dans la
 *     soumission mais NON éditables depuis ce portail — un bandeau
 *     invite le client à contacter son consultant pour les mettre à
 *     jour. L'édition JSONB sera livrée en #4b.2.
 */

type ScalarValue = string | number | null | undefined
type JsonbValue = unknown // arrays ou objects conservés tels quels
type KycData = Record<string, unknown> & {
  id?: string
  kyc_signed_at?: string | null
  kyc_signer_name?: string | null
  kyc_incomplete_signed?: boolean | null
}
type PendingProposition = {
  id: string
  status: string
  submitted_at: string
  signer_name: string | null
  signed_at: string | null
}

// Champs scalaires éditables regroupés par section — source de vérité UI.
// L'ordre des sections respecte le KYC consultant existant (demande
// Maxine 2026-04-22 : « adapte seulement pour raisons techniques »).
const SECTIONS: Array<{
  title: string
  fields: Array<{
    key: string
    label: string
    type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea'
    placeholder?: string
    cond?: (d: KycData) => boolean
  }>
}> = [
  {
    title: 'Identité',
    fields: [
      {
        key: 'raison_sociale',
        label: 'Raison sociale',
        cond: (d) => d.type_personne === 'morale',
      },
      { key: 'titre', label: 'Civilité' },
      { key: 'nom', label: 'Nom' },
      { key: 'prenom', label: 'Prénom' },
      { key: 'date_naissance', label: 'Date de naissance', type: 'date' },
      { key: 'lieu_naissance', label: 'Lieu de naissance' },
      { key: 'nationalite', label: 'Nationalité' },
    ],
  },
  {
    title: 'Coordonnées',
    fields: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'telephone', label: 'Téléphone', type: 'tel' },
      { key: 'adresse', label: 'Adresse' },
      { key: 'ville', label: 'Ville' },
      { key: 'pays', label: 'Pays' },
    ],
  },
  {
    title: 'Situation fiscale',
    fields: [
      { key: 'residence_fiscale', label: 'Résidence fiscale' },
      {
        key: 'nif',
        label: 'Numéro d\'identification fiscale (NIF)',
      },
      {
        key: 'proprietaire_locataire',
        label: 'Propriétaire ou locataire',
      },
    ],
  },
  {
    title: 'Situation familiale',
    fields: [
      {
        key: 'situation_matrimoniale',
        label: 'Situation matrimoniale',
      },
      { key: 'regime_matrimonial', label: 'Régime matrimonial' },
      {
        key: 'nombre_enfants',
        label: 'Nombre d\'enfants',
        type: 'number',
      },
    ],
  },
  {
    title: 'Situation professionnelle',
    fields: [
      { key: 'profession', label: 'Profession' },
      {
        key: 'statut_professionnel',
        label: 'Statut professionnel',
      },
      { key: 'employeur', label: 'Employeur' },
      {
        key: 'date_debut_emploi',
        label: 'Date de début d\'emploi',
        type: 'date',
      },
    ],
  },
  {
    title: 'Revenus annuels',
    fields: [
      {
        key: 'revenus_pro_net',
        label: 'Revenus professionnels nets (€)',
        type: 'number',
      },
      {
        key: 'revenus_fonciers',
        label: 'Revenus fonciers (€)',
        type: 'number',
      },
      {
        key: 'autres_revenus',
        label: 'Autres revenus (€)',
        type: 'number',
      },
    ],
  },
  {
    title: 'Impôt sur le revenu',
    fields: [
      {
        key: 'impot_revenu_n',
        label: 'Impôt année N (€)',
        type: 'number',
      },
      {
        key: 'impot_revenu_n1',
        label: 'Impôt année N-1 (€)',
        type: 'number',
      },
      {
        key: 'impot_revenu_n2',
        label: 'Impôt année N-2 (€)',
        type: 'number',
      },
    ],
  },
  {
    title: 'Objectifs',
    fields: [
      {
        key: 'objectifs_client',
        label: 'Vos objectifs patrimoniaux',
        type: 'textarea',
        placeholder:
          'Ex. préparation retraite, transmission, optimisation fiscale…',
      },
    ],
  },
]

// Clés JSONB transmises telles quelles à la RPC (non éditables en #4b.1).
const READONLY_JSONB_KEYS = [
  'patrimoine_immobilier',
  'produits_financiers',
  'patrimoine_divers',
  'emprunts',
  'enfants_details',
] as const

export function KycPublicClient({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [initialData, setInitialData] = useState<KycData | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [pendingProposition, setPendingProposition] =
    useState<PendingProposition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSubmit, setShowSubmit] = useState(false)

  async function loadAll() {
    setLoading(true)
    // RPC 1 : récupérer le KYC actuel.
    const { data: row, error: err1 } = await supabase.rpc(
      'kyc_client_by_token' as never,
      { p_token: token } as never,
    )
    if (err1) {
      setError(err1.message)
      setLoading(false)
      return
    }
    if (!row) {
      setError('Lien invalide ou expiré.')
      setInitialData(null)
      setLoading(false)
      return
    }
    const data = row as KycData
    setInitialData(data)

    // État initial du formulaire = valeurs actuelles du KYC.
    const init: Record<string, unknown> = {}
    for (const section of SECTIONS) {
      for (const f of section.fields) {
        init[f.key] = data[f.key] ?? ''
      }
    }
    // On ré-injecte aussi type_personne (pour la condition d'affichage)
    // et les JSONB en lecture seule.
    init.type_personne = data.type_personne
    for (const k of READONLY_JSONB_KEYS) {
      init[k] = data[k]
    }
    setFormData(init)

    // RPC 2 : y a-t-il déjà une proposition pending ?
    const { data: pending } = await supabase.rpc(
      'kyc_pending_proposition_by_token' as never,
      { p_token: token } as never,
    )
    setPendingProposition(
      pending ? (pending as unknown as PendingProposition) : null,
    )

    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    if (!token || token.length < 16) {
      setError('Lien invalide.')
      setLoading(false)
      return
    }
    loadAll()
    supabase
      .rpc('kyc_mark_opened' as never, { p_token: token } as never)
      .then(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function setField(key: string, value: ScalarValue | JsonbValue) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Chargement…</div>
      </main>
    )
  }

  if (error || !initialData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md bg-white border border-gray-200 rounded-lg p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Lien indisponible
          </h1>
          <p className="text-gray-600 text-sm">
            {error ||
              'Ce lien n\'est plus valide. Contactez votre consultant pour en obtenir un nouveau.'}
          </p>
        </div>
      </main>
    )
  }

  const isSigned = !!initialData.kyc_signed_at
  const displayName =
    initialData.type_personne === 'morale'
      ? (initialData.raison_sociale as string) || ''
      : `${(initialData.prenom as string) || ''} ${
          (initialData.nom as string) || ''
        }`.trim()

  // Construction du payload envoyé à la RPC : scalaires + JSONB intactes.
  function buildProposedData(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const section of SECTIONS) {
      for (const f of section.fields) {
        const raw = formData[f.key]
        if (f.type === 'number') {
          if (raw === '' || raw === null || raw === undefined) {
            // Champ optionnel laissé vide — on n'envoie pas la clé pour
            // ne pas écraser par 0 lors de l'apply côté consultant.
            continue
          }
          const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
          if (Number.isFinite(n)) out[f.key] = n
        } else {
          const s = raw == null ? '' : String(raw).trim()
          if (s) out[f.key] = s
        }
      }
    }
    // JSONB readonly : on renvoie tels quels si présents (même si le
    // consultant les a mis ; la proposition ne les modifiera pas et le
    // diff consultant les ignorera).
    // (À ce stade du render on a déjà early-return sur !initialData mais
    // TS perd le narrowing à travers la closure ; on re-garde.)
    if (!initialData) return out
    for (const k of READONLY_JSONB_KEYS) {
      const v = initialData[k]
      if (v != null) out[k] = v
    }
    // type_personne est readonly (défini par le consultant) mais on le
    // renvoie pour cohérence.
    if (initialData.type_personne) {
      out.type_personne = initialData.type_personne
    }
    return out
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Dossier KYC — Private Equity Valley
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Bonjour {displayName || '—'}, vous pouvez vérifier et compléter
            les informations ci-dessous avant de signer électroniquement
            votre dossier. Votre consultant validera ensuite vos
            modifications.
          </p>
        </div>

        {/* Bandeau de statut */}
        {isSigned ? (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-900">
              Dossier signé
            </p>
            <p className="text-xs text-green-800 mt-1">
              Signé par {initialData.kyc_signer_name || '—'} le{' '}
              {new Date(initialData.kyc_signed_at!).toLocaleString('fr-FR')}.
              Pour toute modification, contactez votre consultant.
            </p>
          </div>
        ) : pendingProposition ? (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              Soumission reçue — en attente de validation
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Votre dossier a été soumis le{' '}
              {new Date(pendingProposition.submitted_at).toLocaleString(
                'fr-FR',
              )}
              {pendingProposition.signer_name
                ? ` par ${pendingProposition.signer_name}`
                : ''}
              . Votre consultant va en valider le contenu. Vous pourrez le
              modifier à nouveau si nécessaire après cette validation.
            </p>
          </div>
        ) : (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-900">
              Merci de vérifier les informations ci-dessous. Toute
              modification sera soumise à votre consultant pour
              validation avant application.
            </p>
          </div>
        )}

        {/* Formulaire */}
        <fieldset
          disabled={isSigned || !!pendingProposition}
          className="space-y-6"
        >
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className="bg-white border border-gray-200 rounded-lg p-5"
            >
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {section.fields
                  .filter((f) => !f.cond || f.cond(initialData))
                  .map((f) => (
                    <FieldInput
                      key={f.key}
                      fieldKey={f.key}
                      label={f.label}
                      type={f.type || 'text'}
                      placeholder={f.placeholder}
                      value={formData[f.key] as ScalarValue}
                      onChange={(v) => setField(f.key, v)}
                    />
                  ))}
              </div>
            </section>
          ))}

          {/* Bandeau patrimoine (non éditable dans #4b.1) */}
          <section className="bg-white border border-dashed border-gray-300 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              Patrimoine et emprunts
            </h2>
            <p className="text-xs text-gray-600">
              L&apos;édition détaillée de votre patrimoine (immobilier,
              produits financiers, divers) et de vos emprunts sera bientôt
              disponible ici. En attendant, merci de contacter directement
              votre consultant pour toute mise à jour de ces sections.
            </p>
          </section>
        </fieldset>

        {/* Action */}
        {!isSigned && !pendingProposition && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setShowSubmit(true)}
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Signer et soumettre
            </button>
          </div>
        )}

        {/* Dialog signature + submit */}
        {showSubmit && !isSigned && !pendingProposition && (() => {
          // La complétude est calculée sur la VALEUR SOUMISE (formData
          // mergé avec les JSONB readonly), pas sur l'ancien snapshot :
          // un client qui vient de remplir 5 champs manquants doit voir
          // son taux monter avant de signer.
          const mergedForCompletion = {
            ...(initialData as Record<string, unknown>),
            ...buildProposedData(),
          }
          const live = computeKycCompletion(mergedForCompletion)
          return (
            <SubmitDialog
              token={token}
              proposedData={buildProposedData()}
              missingFields={live.missingLabels}
              completionRate={live.rate}
              onClose={() => setShowSubmit(false)}
              onSubmitted={async () => {
                setShowSubmit(false)
                await loadAll()
              }}
            />
          )
        })()}

        {/* Footer légal */}
        <p className="mt-8 text-xs text-gray-500 leading-relaxed">
          Les informations ci-dessus sont collectées par Private Equity
          Valley dans le cadre de ses obligations réglementaires (KYC /
          LCB-FT). En signant, vous certifiez l&apos;exactitude des
          informations fournies. Ce lien est personnel et ne doit pas être
          transféré.
        </p>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Composants internes                                                  */
/* ------------------------------------------------------------------ */

function FieldInput({
  fieldKey,
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  fieldKey: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea'
  placeholder?: string
  value: ScalarValue
  onChange: (v: ScalarValue) => void
}) {
  const baseClass =
    'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-0'
  // Pour un input `date` ou `number`, un `value={null}` casse React : on
  // garde '' comme valeur-sentinelle uniformément.
  const v = value == null ? '' : String(value)
  const commonProps = {
    id: `kyc-${fieldKey}`,
    placeholder,
  }
  return (
    <div className={type === 'textarea' ? 'sm:col-span-2' : ''}>
      <label
        htmlFor={`kyc-${fieldKey}`}
        className="block text-xs font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea
          {...commonProps}
          value={v}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      ) : (
        <input
          {...commonProps}
          type={type}
          value={v}
          onChange={(e) =>
            onChange(
              type === 'number'
                ? e.target.value === ''
                  ? ''
                  : parseFloat(e.target.value)
                : e.target.value,
            )
          }
          className={baseClass}
        />
      )}
    </div>
  )
}

/**
 * Dialog de signature + soumission.
 * Même contrat côté consentement que SignDialog (ancienne version) pour
 * préserver la traçabilité ACPR : nom + consent_accuracy obligatoires,
 * consent_incomplete obligatoire si rate < 100.
 */
function SubmitDialog({
  token,
  proposedData,
  missingFields,
  completionRate,
  onClose,
  onSubmitted,
}: {
  token: string
  proposedData: Record<string, unknown>
  missingFields: string[]
  completionRate: number
  onClose: () => void
  onSubmitted: () => void
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
    try {
      const res = await fetch('/api/kyc/submit-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          proposed_data: proposedData,
          signer_name: signerName.trim(),
          completion_rate: Math.round(completionRate),
          missing_fields: missingFields,
          consent_incomplete: consentIncomplete,
          consent_accuracy: consentAccuracy,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        setErr(payload?.error || 'Erreur lors de la soumission')
        setSubmitting(false)
        return
      }
      onSubmitted()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur réseau')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Signature et soumission
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Saisissez votre nom complet et validez les mentions ci-dessous
          pour soumettre votre dossier KYC à votre consultant.
        </p>

        {isIncomplete && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Votre dossier est complété à {completionRate}%. En signant,
            vous acceptez que certaines informations (
            {missingFields.length} champ
            {missingFields.length > 1 ? 's' : ''}) ne soient pas
            renseignées pour l&rsquo;instant.
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
              Je certifie que les informations renseignées sont exactes
              et à jour.
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
                J&rsquo;accepte de soumettre ce dossier KYC bien
                qu&rsquo;il soit incomplet, et m&rsquo;engage à le
                compléter ultérieurement.
              </span>
            </label>
          )}
        </div>

        {err && (
          <p className="mt-3 text-xs text-red-600">Erreur : {err}</p>
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
            {submitting ? 'Envoi…' : 'Signer et soumettre'}
          </button>
        </div>
      </div>
    </div>
  )
}
