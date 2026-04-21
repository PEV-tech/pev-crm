'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeKycCompletion } from '@/lib/kyc-completion'
// Retour #4 — source unique des dropdowns pour éviter que le client
// saisisse une valeur que le CRM ne peut pas relire.
import {
  LOGEMENT_OPTIONS,
  SITUATION_MATRIMONIALE_OPTIONS,
  REGIME_MATRIMONIAL_OPTIONS,
  TYPE_BIEN_IMMOBILIER_OPTIONS,
  TYPE_PRODUIT_FINANCIER_OPTIONS,
  needsRegimeMatrimonial,
} from '@/lib/kyc-enums'

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
    type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea' | 'select'
    placeholder?: string
    cond?: (d: KycData) => boolean
    // Retour #4 — si fourni, le champ est rendu comme un <select> aligné
    // sur les enums CRM. On stocke le LIBELLÉ tel quel (pas un code), pour
    // que le consultant relise la même chaîne qu'il verrait dans le CRM.
    options?: readonly string[]
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
        type: 'select',
        options: LOGEMENT_OPTIONS,
      },
    ],
  },
  {
    title: 'Situation familiale',
    fields: [
      {
        key: 'situation_matrimoniale',
        label: 'Situation matrimoniale',
        type: 'select',
        options: SITUATION_MATRIMONIALE_OPTIONS,
      },
      {
        key: 'regime_matrimonial',
        label: 'Régime matrimonial',
        type: 'select',
        options: REGIME_MATRIMONIAL_OPTIONS,
        // N'apparaît que si la situation l'implique (marié·e / pacsé·e) —
        // même règle que la section KYC consultant (kyc-section.tsx).
        cond: (d) => needsRegimeMatrimonial(d.situation_matrimoniale as string | null | undefined),
      },
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

// Clés JSONB éditables depuis le portail (#4b.2 : patrimoine + emprunts).
// Les 4 tableaux ci-dessous sont rendus sous forme de tableaux éditables
// avec ajout/suppression de lignes. Le format de ligne reste simple
// (pas de résolution FK côté client : le consultant résout les
// co-titulaires à la validation).
const EDITABLE_JSONB_KEYS = [
  'patrimoine_immobilier',
  'produits_financiers',
  'patrimoine_divers',
  'emprunts',
] as const

// Clés JSONB transmises telles quelles à la RPC (non éditables ici).
// `enfants_details` reste géré côté consultant en V1 (nombre_enfants
// reste éditable par le client).
const READONLY_JSONB_KEYS = ['enfants_details'] as const

// Shapes simplifiées — miroir des interfaces consultant (kyc-section.tsx)
// sans les FK UUID (co_titulaire_client_id). Côté client, le co-titulaire
// est saisi en texte libre (`co_titulaire_nom`) ; le consultant résout
// le lien au moment d'accepter la proposition.
type DetenteurType = 'client' | 'conjoint' | 'commun' | 'autre' | ''

type ImmobilierRow = {
  type_bien?: string
  designation?: string
  date_acq?: string
  valeur_acq?: number | ''
  valeur_actuelle?: number | ''
  detenteur_type?: DetenteurType
  co_titulaire_nom?: string
  proportion?: number | ''
  taux_credit?: number | ''
  duree_credit?: number | ''
  crd?: number | ''
  charges?: number | ''
}

type ProduitFinancierRow = {
  type_produit?: string
  designation?: string
  etablissement?: string
  valeur?: number | ''
  date_ouverture?: string
  versements_reguliers?: string
  rendement?: number | ''
  detenteur_type?: DetenteurType
  co_titulaire_nom?: string
}

type EmpruntRow = {
  designation?: string
  etablissement?: string
  montant?: number | ''
  date?: string
  duree?: string
  taux?: number | ''
  crd?: number | ''
  echeance?: string
  echeance_mensuelle?: number | ''
  detenteur_type?: DetenteurType
  co_titulaire_nom?: string
}

type DiversRow = {
  type_bien?: string
  designation?: string
  valeur?: number | ''
  detenteur_type?: DetenteurType
  co_titulaire_nom?: string
}

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
    // JSONB éditables : toujours normaliser vers un array (vide si null).
    for (const k of EDITABLE_JSONB_KEYS) {
      const v = data[k]
      init[k] = Array.isArray(v) ? v : []
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
      <main className="min-h-screen flex flex-col">
        <PevBrandHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#64748b] text-sm">Chargement…</div>
        </div>
      </main>
    )
  }

  if (error || !initialData) {
    return (
      <main className="min-h-screen flex flex-col">
        <PevBrandHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-10 text-center">
            <h1 className="text-xl font-bold text-[#1F063E] mb-2 tracking-tight">
              Lien indisponible
            </h1>
            <p className="text-slate-600 text-sm">
              {error ||
                'Ce lien n\'est plus valide. Contactez votre consultant pour en obtenir un nouveau.'}
            </p>
          </div>
        </div>
        <PevBrandFooter />
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
    // JSONB éditables : on prend la version courante du formulaire,
    // pas l'initialData. On n'envoie la clé que si l'array existe (même
    // vide — un array vide est un signal volontaire "j'ai tout supprimé").
    for (const k of EDITABLE_JSONB_KEYS) {
      const v = formData[k]
      if (Array.isArray(v)) {
        out[k] = sanitizeJsonbRows(v)
      }
    }
    // type_personne est readonly (défini par le consultant) mais on le
    // renvoie pour cohérence.
    if (initialData.type_personne) {
      out.type_personne = initialData.type_personne
    }
    return out
  }

  return (
    <main className="min-h-screen flex flex-col">
      <PevBrandHeader />
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-12">
        {/* Header du dossier — typographie Raleway alignée site PEV,
            tracking large sur l'eyebrow façon wordmark corporate. */}
        <div className="mb-8">
          <p className="text-[11px] tracking-[0.22em] uppercase text-[#3898EC] font-bold mb-3">
            Dossier KYC
          </p>
          <h1 className="text-[2.25rem] sm:text-[2.5rem] font-bold text-[#1F063E] leading-[1.1] tracking-tight">
            Bonjour {displayName || '—'}
          </h1>
          <p className="text-[15px] text-[#1F063E]/70 mt-4 leading-relaxed max-w-2xl">
            Vous pouvez vérifier et compléter les informations ci-dessous
            avant de signer électroniquement votre dossier. Votre
            consultant validera ensuite vos modifications.
          </p>
          <div className="mt-5 h-[3px] w-20 bg-gradient-to-r from-[#1F063E] to-[#3898EC] rounded-full" />
        </div>

        {/* Bandeau de statut */}
        {isSigned ? (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
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
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
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
          <div className="mb-6 rounded-xl border-l-4 border-l-[#1F063E] border border-[#1F063E]/15 bg-white shadow-sm p-4">
            <p className="text-sm text-slate-700 leading-relaxed">
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
              className="bg-white border border-slate-200 rounded-xl shadow-sm p-6"
            >
              <h2 className="text-[11px] tracking-[0.18em] uppercase text-[#1F063E] font-semibold mb-4 pb-3 border-b border-slate-100">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {section.fields
                  // Retour #4 — on évalue la condition sur `formData` (pas
                  // `initialData`) : si le client change sa situation
                  // matrimoniale, le champ régime apparaît/disparaît en
                  // temps réel, comme dans le CRM.
                  .filter((f) => !f.cond || f.cond(formData as KycData))
                  .map((f) => (
                    <FieldInput
                      key={f.key}
                      fieldKey={f.key}
                      label={f.label}
                      type={f.type || 'text'}
                      placeholder={f.placeholder}
                      options={f.options}
                      value={formData[f.key] as ScalarValue}
                      onChange={(v) => setField(f.key, v)}
                    />
                  ))}
              </div>
            </section>
          ))}

          {/* Patrimoine immobilier (JSONB éditable) */}
          <ImmobilierEditor
            rows={(formData.patrimoine_immobilier as ImmobilierRow[]) || []}
            onChange={(rows) => setField('patrimoine_immobilier', rows)}
          />

          {/* Produits financiers (JSONB éditable) */}
          <ProduitsFinanciersEditor
            rows={(formData.produits_financiers as ProduitFinancierRow[]) || []}
            onChange={(rows) => setField('produits_financiers', rows)}
          />

          {/* Patrimoine divers (JSONB éditable) */}
          <DiversEditor
            rows={(formData.patrimoine_divers as DiversRow[]) || []}
            onChange={(rows) => setField('patrimoine_divers', rows)}
          />

          {/* Emprunts (JSONB éditable, avec échéance mensuelle pour le
              taux d'endettement — Chantier #3) */}
          <EmpruntsEditor
            rows={(formData.emprunts as EmpruntRow[]) || []}
            onChange={(rows) => setField('emprunts', rows)}
          />

          <p className="text-xs text-gray-500 italic">
            Si vous détenez un bien, un placement ou un emprunt en commun
            avec une autre personne (conjoint, enfant, société, …),
            saisissez simplement son nom dans le champ « Co-titulaire ».
            Votre consultant rattachera la fiche au dossier concerné lors
            de la validation.
          </p>
        </fieldset>

        {/* Action */}
        {!isSigned && !pendingProposition && (
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={() => setShowSubmit(true)}
              className="inline-flex items-center gap-2 bg-[#1F063E] text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-[#150230] transition-colors shadow-sm"
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
        <p className="mt-10 text-xs text-slate-500 leading-relaxed">
          Les informations ci-dessus sont collectées par Private Equity
          Valley dans le cadre de ses obligations réglementaires (KYC /
          LCB-FT). En signant, vous certifiez l&apos;exactitude des
          informations fournies. Ce lien est personnel et ne doit pas être
          transféré.
        </p>
      </div>
      <PevBrandFooter />
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Charte PEV — header + footer aux couleurs de private-equity-valley.com */
/* Retour Maxine 2026-04-21 v2 : « ça ne ressemble pas assez à PEV —   */
/* plus ton violet, typographie, logo... ». On reprend la palette       */
/* exacte du site www.private-equity-valley.com :                       */
/*    · #1F063E → violet profond (bg header/footer + wordmark)          */
/*    · #3898EC → bleu ciel (accent CTA / liens / hover)                */
/*    · #F8EFFF → lavande pâle (fond subtil sections)                   */
/* Police : Raleway (injectée via src/app/kyc/layout.tsx, next/font).   */
/* Le dashboard interne reste inchangé (charte neutre outil interne).  */
/* ------------------------------------------------------------------ */

function PevBrandHeader() {
  return (
    <header className="w-full bg-[#1F063E] text-white">
      <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Monogramme PE — cercle avec bordure blanche fine, pas de
              fill gris (le site PEV l'affiche en blanc net sur violet). */}
          <div className="h-12 w-12 rounded-full border-2 border-white/85 flex items-center justify-center">
            <span className="text-base font-bold text-white tracking-[0.08em]">
              PE
            </span>
          </div>
          <div className="leading-tight">
            <p className="text-[17px] font-bold tracking-[0.14em] uppercase">
              Private Equity Valley
            </p>
            <p className="text-[10.5px] text-white/65 tracking-[0.2em] uppercase mt-0.5">
              Valoriser aujourd&rsquo;hui, transmettre demain
            </p>
          </div>
        </div>
        <a
          href="https://www.private-equity-valley.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 text-[11px] tracking-[0.15em] uppercase text-white/75 hover:text-[#3898EC] transition-colors font-medium"
        >
          private-equity-valley.com
          <span aria-hidden className="text-white/50">↗</span>
        </a>
      </div>
      {/* Fine ligne d'accent bleu ciel sous la barre — cue visuel
          présent sur le site PEV sous la navbar principale. */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#3898EC] via-[#3898EC]/60 to-transparent" />
    </header>
  )
}

function PevBrandFooter() {
  return (
    <footer className="w-full bg-[#1F063E] text-white mt-10">
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full border border-white/40 flex items-center justify-center text-[10px] font-bold tracking-wider">
            PE
          </div>
          <p className="text-[11px] text-white/70">
            © 2010-2026 Private Equity Valley · Tous droits réservés
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-white/70">
          <a
            href="https://www.private-equity-valley.com/mentions-legales"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#3898EC] transition-colors"
          >
            Mentions légales
          </a>
          <a
            href="https://www.private-equity-valley.com/politiques-de-confidentialite"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#3898EC] transition-colors"
          >
            Confidentialité
          </a>
          <a
            href="mailto:contact@private-equity-valley.com"
            className="hover:text-[#3898EC] transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/* Composants internes                                                  */
/* ------------------------------------------------------------------ */

/**
 * Retour Maxine #5 — bornes date : on limite tous les champs date à
 * [1900 .. année courante + 10], ce qui suffit pour naissance / emploi /
 * acquisition de bien / échéance emprunt. Côté navigateur ça améliore
 * deux choses :
 *   - le calendrier natif s'ouvre sur une plage lisible (et pas à l'an
 *     0001 quand le champ est vide),
 *   - la saisie clavier "19" est moins souvent interprétée comme année 19.
 * Les clefs ci-dessous correspondent aux dates qui DOIVENT être dans le
 * passé strict (sinon on permet jusqu'à +10 ans pour les dates projet /
 * échéance).
 */
const PAST_ONLY_DATE_KEYS = new Set<string>([
  'date_naissance',
  'date_debut_emploi',
  'date_acq',
  'date_ouverture',
  'emprunt_date_depart',
])
const DATE_MIN_ISO = '1900-01-01'
function dateMaxIso(fieldKey?: string): string {
  const now = new Date()
  const isPastOnly = fieldKey ? PAST_ONLY_DATE_KEYS.has(fieldKey) : false
  const year = isPastOnly ? now.getFullYear() : now.getFullYear() + 10
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function FieldInput({
  fieldKey,
  label,
  type,
  placeholder,
  value,
  onChange,
  options,
}: {
  fieldKey: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea' | 'select'
  placeholder?: string
  value: ScalarValue
  onChange: (v: ScalarValue) => void
  options?: readonly string[]
}) {
  const baseClass =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#1F063E] focus:ring-1 focus:ring-[#1F063E]/20 focus:outline-none transition-colors'
  // Pour un input `date` ou `number`, un `value={null}` casse React : on
  // garde '' comme valeur-sentinelle uniformément.
  const v = value == null ? '' : String(value)
  const commonProps = {
    id: `kyc-${fieldKey}`,
    placeholder,
  }
  const dateBounds =
    type === 'date'
      ? { min: DATE_MIN_ISO, max: dateMaxIso(fieldKey) }
      : {}
  return (
    <div className={type === 'textarea' ? 'sm:col-span-2' : ''}>
      <label
        htmlFor={`kyc-${fieldKey}`}
        className="block text-xs font-medium text-gray-700 mb-1"
      >
        {label}
        {type === 'date' && (
          <span className="ml-1 text-[10px] text-gray-400 font-normal">
            (JJ/MM/AAAA)
          </span>
        )}
      </label>
      {type === 'textarea' ? (
        <textarea
          {...commonProps}
          value={v}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      ) : type === 'select' ? (
        <select
          {...commonProps}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        >
          <option value="">—</option>
          {(options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...commonProps}
          {...dateBounds}
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
    <div className="fixed inset-0 z-50 bg-[#1F063E]/40 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-[#1F063E] text-white px-6 py-4">
          <h2 className="text-base font-bold tracking-[0.14em] uppercase">
            Signature et soumission
          </h2>
          <p className="text-[10.5px] text-white/70 mt-1 tracking-[0.2em] uppercase">
            Private Equity Valley
          </p>
        </div>
        <div className="p-6">
        <p className="text-sm text-slate-600 mb-4">
          Saisissez votre nom complet et validez les mentions ci-dessous
          pour soumettre votre dossier KYC à votre consultant.
        </p>

        {isIncomplete && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
            <div>
              Votre dossier est complété à{' '}
              <span className="font-semibold">{completionRate}%</span>. En
              signant, vous acceptez que les{' '}
              <span className="font-semibold">
                {missingFields.length} champ
                {missingFields.length > 1 ? 's' : ''} ci-dessous
              </span>{' '}
              ne soi{missingFields.length > 1 ? 'ent' : 't'} pas
              renseigné{missingFields.length > 1 ? 's' : ''} pour
              l&rsquo;instant :
            </div>
            {/* Retour Maxine #6 : lister explicitement les noms des champs
                non remplis (et pas juste le compte). Affichage en pastilles
                pour rester lisible même avec 10+ entrées, auto-scroll au-
                delà de ~160px. */}
            {missingFields.length > 0 && (
              <ul className="flex flex-wrap gap-1 max-h-40 overflow-y-auto pr-1">
                {missingFields.map((label, i) => (
                  <li
                    key={`${label}-${i}`}
                    className="inline-flex items-center rounded-full bg-white border border-amber-300 px-2 py-0.5 text-[11px] text-amber-800"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            )}
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#1F063E] focus:ring-1 focus:ring-[#1F063E]/20 focus:outline-none transition-colors"
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
            className="px-4 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-md text-sm font-medium bg-[#1F063E] text-white hover:bg-[#150230] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submitting ? 'Envoi…' : 'Signer et soumettre'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Helpers JSONB                                                        */
/* ------------------------------------------------------------------ */

/**
 * Nettoie un array de lignes JSONB avant envoi :
 *   - transforme '' en null pour les number,
 *   - drop les lignes 100% vides (toutes les valeurs falsy),
 *   - trim les strings.
 * Conserve l'ordre des lignes.
 */
function sanitizeJsonbRows(rows: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const src = raw as Record<string, unknown>
    const cleaned: Record<string, unknown> = {}
    let hasAny = false
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === 'string') {
        const t = v.trim()
        if (t) {
          cleaned[k] = t
          hasAny = true
        }
      } else if (typeof v === 'number' && Number.isFinite(v)) {
        cleaned[k] = v
        hasAny = true
      } else if (v === '' || v == null) {
        // skip : cellule vide
      } else {
        cleaned[k] = v
        hasAny = true
      }
    }
    if (hasAny) out.push(cleaned)
  }
  return out
}

const DETENTEUR_OPTIONS: Array<{ v: DetenteurType; label: string }> = [
  { v: '', label: '—' },
  { v: 'client', label: 'Moi seul(e)' },
  { v: 'conjoint', label: 'Mon conjoint seul(e)' },
  { v: 'commun', label: 'En commun' },
  { v: 'autre', label: 'Autre (précisez le nom)' },
]

/* ------------------------------------------------------------------ */
/* Row editors — un par type de patrimoine                              */
/* ------------------------------------------------------------------ */

function EditorShell({
  title,
  subtitle,
  onAdd,
  children,
}: {
  title: string
  subtitle?: string
  onAdd: () => void
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-[11px] tracking-[0.18em] uppercase text-[#1F063E] font-semibold">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 normal-case tracking-normal">
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[#1F063E]/30 bg-white px-3 py-1 text-xs font-medium text-[#1F063E] hover:bg-[#1F063E]/5 transition-colors"
        >
          + Ajouter
        </button>
      </div>
      {children}
    </section>
  )
}

function RowCard({
  idx,
  onRemove,
  children,
}: {
  idx: number
  onRemove: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 rounded-md p-3 mb-2 last:mb-0 relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wide text-gray-400">
          Ligne {idx + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-600 hover:text-red-800"
        >
          Supprimer
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
        {children}
      </div>
    </div>
  )
}

function TxtCell({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  span2 = false,
  fieldKey,
}: {
  label: string
  value: string | number | undefined
  onChange: (v: string | number | '') => void
  placeholder?: string
  type?: 'text' | 'number' | 'date'
  span2?: boolean
  // Optionnel : sert pour les dates, on l'utilise pour distinguer les
  // dates passé-seul (date_acq, date_naissance...) des dates qui peuvent
  // être dans le futur (date de fin d'emprunt, date de départ d'un bien
  // diversifié...). Cf. retour Maxine #5.
  fieldKey?: string
}) {
  const v = value == null ? '' : String(value)
  const dateBounds =
    type === 'date'
      ? { min: DATE_MIN_ISO, max: dateMaxIso(fieldKey) }
      : {}
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
        {label}
        {type === 'date' && (
          <span className="ml-1 text-[10px] text-gray-400 font-normal">
            (JJ/MM/AAAA)
          </span>
        )}
      </label>
      <input
        type={type}
        value={v}
        placeholder={placeholder}
        {...dateBounds}
        onChange={(e) => {
          if (type === 'number') {
            if (e.target.value === '') {
              onChange('')
            } else {
              const n = parseFloat(e.target.value)
              onChange(Number.isFinite(n) ? n : '')
            }
          } else {
            onChange(e.target.value)
          }
        }}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-[#1F063E] focus:ring-1 focus:ring-[#1F063E]/20 focus:outline-none transition-colors"
      />
    </div>
  )
}

function SelectCell({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  options: Array<{ v: string; label: string }>
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
        {label}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-[#1F063E] focus:ring-1 focus:ring-[#1F063E]/20 focus:outline-none transition-colors"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function DetenteurFields<
  T extends { detenteur_type?: DetenteurType; co_titulaire_nom?: string },
>({
  row,
  onPatch,
}: {
  row: T
  onPatch: (patch: Partial<T>) => void
}) {
  const needsName =
    row.detenteur_type === 'commun' || row.detenteur_type === 'autre'
  return (
    <>
      <SelectCell
        label="Détenteur"
        value={row.detenteur_type}
        onChange={(v) =>
          onPatch({
            detenteur_type: v as DetenteurType,
            // on vide le nom si on repasse à un détenteur solo
            co_titulaire_nom:
              v === 'commun' || v === 'autre' ? row.co_titulaire_nom : '',
          } as Partial<T>)
        }
        options={DETENTEUR_OPTIONS.map((o) => ({ v: o.v, label: o.label }))}
      />
      {needsName && (
        <TxtCell
          label="Co-titulaire (nom)"
          value={row.co_titulaire_nom}
          placeholder="Ex. Marie Dupont"
          onChange={(v) =>
            onPatch({ co_titulaire_nom: String(v) } as Partial<T>)
          }
        />
      )}
    </>
  )
}

function ImmobilierEditor({
  rows,
  onChange,
}: {
  rows: ImmobilierRow[]
  onChange: (rows: ImmobilierRow[]) => void
}) {
  const patch = (i: number, p: Partial<ImmobilierRow>) => {
    const next = rows.slice()
    next[i] = { ...next[i], ...p }
    onChange(next)
  }
  const add = () =>
    onChange([...rows, { detenteur_type: 'client' } as ImmobilierRow])
  const remove = (i: number) => {
    const next = rows.slice()
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <EditorShell
      title="Patrimoine immobilier"
      subtitle="Résidence principale, secondaire, investissement locatif, SCPI détenues en direct, etc."
      onAdd={add}
    >
      {rows.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          Aucune ligne. Cliquez « Ajouter » si vous détenez un bien
          immobilier.
        </p>
      )}
      {rows.map((row, i) => (
        <RowCard key={i} idx={i} onRemove={() => remove(i)}>
          {/* Retour #4 — dropdown aligné sur TYPE_BIEN_IMMOBILIER_OPTIONS
              (kyc-enums). Le client ne peut plus saisir une valeur
              libre que le consultant n'aurait pas dans sa liste. */}
          <SelectCell
            label="Type de bien"
            value={row.type_bien}
            onChange={(v) => patch(i, { type_bien: v })}
            options={[
              { v: '', label: '— Sélectionner —' },
              ...TYPE_BIEN_IMMOBILIER_OPTIONS.map((o) => ({
                v: o,
                label: o,
              })),
            ]}
          />
          <TxtCell
            label="Désignation / adresse"
            value={row.designation}
            onChange={(v) => patch(i, { designation: String(v) })}
          />
          <TxtCell
            label="Date d'acquisition"
            type="date"
            fieldKey="date_acq"
            value={row.date_acq}
            onChange={(v) => patch(i, { date_acq: String(v) })}
          />
          <TxtCell
            label="Valeur d'acquisition (€)"
            type="number"
            value={row.valeur_acq}
            onChange={(v) =>
              patch(i, { valeur_acq: v === '' ? '' : Number(v) })
            }
          />
          <TxtCell
            label="Valeur actuelle (€)"
            type="number"
            value={row.valeur_actuelle}
            onChange={(v) =>
              patch(i, { valeur_actuelle: v === '' ? '' : Number(v) })
            }
          />
          <TxtCell
            label="Quote-part (%)"
            type="number"
            value={row.proportion}
            onChange={(v) =>
              patch(i, { proportion: v === '' ? '' : Number(v) })
            }
          />
          <TxtCell
            label="CRD emprunt (€)"
            type="number"
            value={row.crd}
            onChange={(v) => patch(i, { crd: v === '' ? '' : Number(v) })}
          />
          <TxtCell
            label="Charges mensuelles (€)"
            type="number"
            value={row.charges}
            onChange={(v) =>
              patch(i, { charges: v === '' ? '' : Number(v) })
            }
          />
          <DetenteurFields
            row={row}
            onPatch={(p) => patch(i, p as Partial<ImmobilierRow>)}
          />
        </RowCard>
      ))}
    </EditorShell>
  )
}

function ProduitsFinanciersEditor({
  rows,
  onChange,
}: {
  rows: ProduitFinancierRow[]
  onChange: (rows: ProduitFinancierRow[]) => void
}) {
  const patch = (i: number, p: Partial<ProduitFinancierRow>) => {
    const next = rows.slice()
    next[i] = { ...next[i], ...p }
    onChange(next)
  }
  const add = () =>
    onChange([
      ...rows,
      { detenteur_type: 'client' } as ProduitFinancierRow,
    ])
  const remove = (i: number) => {
    const next = rows.slice()
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <EditorShell
      title="Produits financiers"
      subtitle="Livrets, assurance-vie, PEA, comptes-titres, PER, épargne entreprise, etc."
      onAdd={add}
    >
      {rows.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          Aucune ligne. Cliquez « Ajouter » pour déclarer un placement.
        </p>
      )}
      {rows.map((row, i) => (
        <RowCard key={i} idx={i} onRemove={() => remove(i)}>
          {/* Retour #4 — dropdown aligné sur TYPE_PRODUIT_FINANCIER_OPTIONS
              (kyc-enums). Coherence CRM ↔ portail. */}
          <SelectCell
            label="Type de produit"
            value={row.type_produit}
            onChange={(v) => patch(i, { type_produit: v })}
            options={[
              { v: '', label: '— Sélectionner —' },
              ...TYPE_PRODUIT_FINANCIER_OPTIONS.map((o) => ({
                v: o,
                label: o,
              })),
            ]}
          />
          <TxtCell
            label="Désignation"
            value={row.designation}
            placeholder="Ex. Contrat Afer"
            onChange={(v) => patch(i, { designation: String(v) })}
          />
          <TxtCell
            label="Établissement"
            value={row.etablissement}
            onChange={(v) => patch(i, { etablissement: String(v) })}
          />
          <TxtCell
            label="Valeur actuelle (€)"
            type="number"
            value={row.valeur}
            onChange={(v) =>
              patch(i, { valeur: v === '' ? '' : Number(v) })
            }
          />
          <TxtCell
            label="Date d'ouverture"
            type="date"
            fieldKey="date_ouverture"
            value={row.date_ouverture}
            onChange={(v) => patch(i, { date_ouverture: String(v) })}
          />
          <TxtCell
            label="Versements réguliers"
            value={row.versements_reguliers}
            placeholder="Ex. 300 €/mois"
            onChange={(v) =>
              patch(i, { versements_reguliers: String(v) })
            }
          />
          <DetenteurFields
            row={row}
            onPatch={(p) => patch(i, p as Partial<ProduitFinancierRow>)}
          />
        </RowCard>
      ))}
    </EditorShell>
  )
}

function DiversEditor({
  rows,
  onChange,
}: {
  rows: DiversRow[]
  onChange: (rows: DiversRow[]) => void
}) {
  const patch = (i: number, p: Partial<DiversRow>) => {
    const next = rows.slice()
    next[i] = { ...next[i], ...p }
    onChange(next)
  }
  const add = () =>
    onChange([...rows, { detenteur_type: 'client' } as DiversRow])
  const remove = (i: number) => {
    const next = rows.slice()
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <EditorShell
      title="Patrimoine divers"
      subtitle="Véhicules, œuvres d'art, bijoux, parts sociales, objets de valeur, etc."
      onAdd={add}
    >
      {rows.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          Aucune ligne.
        </p>
      )}
      {rows.map((row, i) => (
        <RowCard key={i} idx={i} onRemove={() => remove(i)}>
          <TxtCell
            label="Nature du bien"
            value={row.type_bien}
            placeholder="Ex. Véhicule"
            onChange={(v) => patch(i, { type_bien: String(v) })}
          />
          <TxtCell
            label="Désignation"
            value={row.designation}
            onChange={(v) => patch(i, { designation: String(v) })}
            span2
          />
          <TxtCell
            label="Valeur estimée (€)"
            type="number"
            value={row.valeur}
            onChange={(v) =>
              patch(i, { valeur: v === '' ? '' : Number(v) })
            }
          />
          <DetenteurFields
            row={row}
            onPatch={(p) => patch(i, p as Partial<DiversRow>)}
          />
        </RowCard>
      ))}
    </EditorShell>
  )
}

function EmpruntsEditor({
  rows,
  onChange,
}: {
  rows: EmpruntRow[]
  onChange: (rows: EmpruntRow[]) => void
}) {
  const patch = (i: number, p: Partial<EmpruntRow>) => {
    const next = rows.slice()
    next[i] = { ...next[i], ...p }
    onChange(next)
  }
  const add = () =>
    onChange([...rows, { detenteur_type: 'client' } as EmpruntRow])
  const remove = (i: number) => {
    const next = rows.slice()
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <EditorShell
      title="Emprunts en cours"
      subtitle="Prêts immobiliers, crédits conso, prêts étudiants, LOA, etc. Indiquez bien l'échéance mensuelle pour permettre le calcul de votre taux d'endettement."
      onAdd={add}
    >
      {rows.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          Aucun emprunt en cours.
        </p>
      )}
      {rows.map((row, i) => (
        <RowCard key={i} idx={i} onRemove={() => remove(i)}>
          <TxtCell
            label="Désignation"
            value={row.designation}
            placeholder="Ex. Prêt résidence principale"
            onChange={(v) => patch(i, { designation: String(v) })}
          />
          <TxtCell
            label="Établissement prêteur"
            value={row.etablissement}
            onChange={(v) => patch(i, { etablissement: String(v) })}
          />
          <TxtCell
            label="Montant initial (€)"
            type="number"
            value={row.montant}
            onChange={(v) =>
              patch(i, { montant: v === '' ? '' : Number(v) })
            }
          />
          <TxtCell
            label="Date de départ"
            type="date"
            fieldKey="emprunt_date_depart"
            value={row.date}
            onChange={(v) => patch(i, { date: String(v) })}
          />
          <TxtCell
            label="Durée"
            value={row.duree}
            placeholder="Ex. 25 ans"
            onChange={(v) => patch(i, { duree: String(v) })}
          />
          <TxtCell
            label="Taux (%)"
            type="number"
            value={row.taux}
            onChange={(v) => patch(i, { taux: v === '' ? '' : Number(v) })}
          />
          <TxtCell
            label="Capital restant dû (€)"
            type="number"
            value={row.crd}
            onChange={(v) => patch(i, { crd: v === '' ? '' : Number(v) })}
          />
          <TxtCell
            label="Date de fin"
            type="date"
            value={row.echeance}
            onChange={(v) => patch(i, { echeance: String(v) })}
          />
          <TxtCell
            label="Échéance mensuelle (€)"
            type="number"
            value={row.echeance_mensuelle}
            onChange={(v) =>
              patch(i, { echeance_mensuelle: v === '' ? '' : Number(v) })
            }
          />
          <DetenteurFields
            row={row}
            onPatch={(p) => patch(i, p as Partial<EmpruntRow>)}
          />
        </RowCard>
      ))}
    </EditorShell>
  )
}
