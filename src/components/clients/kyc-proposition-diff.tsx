'use client'

/**
 * Chantier #4c : diff-viewer consultant pour une proposition KYC pending.
 *
 * Entrée :
 *   - clientId : UUID du client affiché dans /dashboard/clients/[id]
 *   - onApplied() : callback déclenché après `kyc_apply_proposition` pour
 *     que la page parent re-fetch les données client.
 *
 * Le composant s'auto-charge au mount via RPC `kyc_list_pending_propositions`
 * filtrée sur ce client. Si aucune proposition pending → render null
 * (pas de bruit dans l'UI).
 *
 * Mode d'emploi pour le consultant :
 *   1. Bandeau amber avec les métadonnées de signature (nom, IP, date,
 *      taux de complétion, consentements).
 *   2. Pour chaque champ proposé différent du snapshot : colonne gauche
 *      = valeur courante (extraite de `original_snapshot` pour être
 *      cohérent avec ce que le client voyait au moment de signer),
 *      colonne droite = proposition. Boutons accepter / refuser par
 *      champ (obligatoire : la RPC refuse l'application si une décision
 *      manque).
 *   3. Boutons raccourcis : « Tout accepter » / « Tout refuser ».
 *   4. Bouton « Appliquer » qui envoie `field_decisions` à la RPC
 *      `kyc_apply_proposition` (SECURITY DEFINER, fait l'audit +
 *      l'UPDATE clients).
 *
 * Limitations connues :
 *   - #4d : la PDF est encore générée à la soumission (sign-public). En
 *     attendant le déplacement post-validation, on génère juste un
 *     toast d'info quand le statut final == 'fully_applied'.
 *   - L'affichage JSONB (patrimoine, emprunts) est volontairement brut
 *     (JSON.stringify). Un render tabulaire arrivera en V2.
 */

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react'

type Decision = 'accept' | 'reject'

type PendingProposition = {
  id: string
  client_id: string
  token_used: string | null
  original_snapshot: Record<string, unknown> | null
  proposed_data: Record<string, unknown>
  signer_name: string | null
  signer_ip: string | null
  signed_at: string | null
  submitted_at: string | null
  completion_rate: number | null
  missing_fields: string[] | null
  consent_accuracy: boolean | null
  consent_incomplete: boolean | null
  status: string
}

// Libellés alignés avec `_kyc_editable_fields()` côté SQL + le portail
// public. Toute clé absente d'ici tombera dans un fallback humanisé.
const FIELD_LABELS: Record<string, string> = {
  nom: 'Nom',
  prenom: 'Prénom',
  raison_sociale: 'Raison sociale',
  type_personne: 'Type de personne',
  email: 'Email',
  telephone: 'Téléphone',
  titre: 'Civilité',
  date_naissance: 'Date de naissance',
  lieu_naissance: 'Lieu de naissance',
  nationalite: 'Nationalité',
  adresse: 'Adresse',
  ville: 'Ville',
  pays: 'Pays',
  residence_fiscale: 'Résidence fiscale',
  nif: 'NIF',
  proprietaire_locataire: 'Propriétaire / locataire',
  situation_matrimoniale: 'Situation matrimoniale',
  regime_matrimonial: 'Régime matrimonial',
  nombre_enfants: "Nombre d'enfants",
  enfants_details: 'Détails enfants',
  profession: 'Profession',
  statut_professionnel: 'Statut professionnel',
  employeur: 'Employeur',
  date_debut_emploi: "Date de début d'emploi",
  revenus_pro_net: 'Revenus professionnels nets',
  revenus_fonciers: 'Revenus fonciers',
  autres_revenus: 'Autres revenus',
  total_revenus_annuel: 'Total revenus annuels',
  impot_revenu_n: 'Impôt revenu N',
  impot_revenu_n1: 'Impôt revenu N-1',
  impot_revenu_n2: 'Impôt revenu N-2',
  patrimoine_immobilier: 'Patrimoine immobilier',
  produits_financiers: 'Produits financiers',
  patrimoine_divers: 'Patrimoine divers',
  emprunts: 'Emprunts',
  objectifs_client: 'Objectifs patrimoniaux',
}

function humanize(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Comparaison stricte pour détecter un vrai changement. */
function valuesDiffer(a: unknown, b: unknown): boolean {
  // null/undefined/'' traités comme "absence" pour éviter le bruit.
  const empty = (v: unknown) =>
    v == null || (typeof v === 'string' && v.trim() === '')
  if (empty(a) && empty(b)) return false
  // Comparaison sérialisée suffisante pour scalars + JSONB.
  try {
    return JSON.stringify(a) !== JSON.stringify(b)
  } catch {
    return a !== b
  }
}

function formatValue(v: unknown): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

export function KycPropositionDiff({
  clientId,
  onApplied,
}: {
  clientId: string
  onApplied?: () => void | Promise<void>
}) {
  const supabase = React.useMemo(() => createClient(), [])
  const [loading, setLoading] = React.useState(true)
  const [proposition, setProposition] = React.useState<PendingProposition | null>(
    null,
  )
  const [decisions, setDecisions] = React.useState<Record<string, Decision>>({})
  const [applying, setApplying] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc(
      'kyc_list_pending_propositions' as never,
      { p_client_id: clientId } as never,
    )
    if (err) {
      setError(err.message)
      setProposition(null)
      setLoading(false)
      return
    }
    const list = data as unknown as PendingProposition[] | null
    const first = Array.isArray(list) && list.length > 0 ? list[0] : null
    setProposition(first ?? null)
    setDecisions({})
    setLoading(false)
  }, [clientId, supabase])

  React.useEffect(() => {
    if (clientId) load()
  }, [clientId, load])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" /> Vérification des
          propositions KYC…
        </CardContent>
      </Card>
    )
  }

  if (!proposition) return null

  // Calcul du diff : on ne montre que les champs VRAIMENT modifiés.
  const snapshot = proposition.original_snapshot ?? {}
  const proposed = proposition.proposed_data ?? {}
  const diffKeys = Object.keys(proposed).filter((k) =>
    valuesDiffer(snapshot[k], proposed[k]),
  )
  // Les champs inchangés — on les cache dans un repli discret pour que
  // le consultant puisse quand même les inspecter s'il veut.
  const unchangedKeys = Object.keys(proposed).filter(
    (k) => !valuesDiffer(snapshot[k], proposed[k]),
  )

  const allDecided = diffKeys.every((k) => decisions[k])

  async function apply() {
    if (!allDecided || applying || !proposition) return
    setApplying(true)
    setError(null)
    setSuccess(null)
    const payload: Record<string, Decision> = {}
    for (const k of diffKeys) payload[k] = decisions[k]

    // On passe par l'endpoint /api/kyc/apply-proposition (et plus par la
    // RPC direct) pour que la génération PDF + email se fassent côté
    // serveur avec la service_role_key (Chantier #4d).
    try {
      const res = await fetch('/api/kyc/apply-proposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposition_id: proposition.id,
          field_decisions: payload,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        status?: 'fully_applied' | 'partially_applied' | 'rejected'
        applied?: number
        rejected?: number
        pdf_path?: string
      }
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setApplying(false)
        return
      }
      setSuccess(
        `Proposition ${
          data.status === 'fully_applied'
            ? 'entièrement appliquée'
            : data.status === 'partially_applied'
              ? 'partiellement appliquée'
              : 'refusée'
        } — ${data.applied ?? 0} champ(s) accepté(s), ${data.rejected ?? 0} refusé(s)${
          data.pdf_path ? '. PDF généré.' : '.'
        }`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
      setApplying(false)
      return
    }

    setApplying(false)
    // refresh parent + local state.
    if (onApplied) await onApplied()
    await load()
  }

  function setAll(d: Decision) {
    const next: Record<string, Decision> = {}
    for (const k of diffKeys) next[k] = d
    setDecisions(next)
  }

  const incompleteBadge = proposition.consent_incomplete ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">
      <AlertTriangle size={11} /> KYC incomplet ({proposition.completion_rate ?? 0}%)
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-green-100 text-green-800">
      <CheckCircle size={11} /> Complet ({proposition.completion_rate ?? 100}%)
    </span>
  )

  return (
    <Card className="border-amber-300 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <AlertTriangle size={18} className="text-amber-600" />
          Proposition KYC en attente de validation
          {incompleteBadge}
        </CardTitle>
        <p className="text-xs text-gray-600 mt-1">
          Signée par <span className="font-medium">{proposition.signer_name || '—'}</span>
          {proposition.signed_at && (
            <>
              {' '}le{' '}
              {new Date(proposition.signed_at).toLocaleString('fr-FR')}
            </>
          )}
          {proposition.signer_ip && (
            <> depuis {proposition.signer_ip}</>
          )}
          . Vous devez vous prononcer sur chaque champ modifié avant
          d&apos;appliquer la proposition au dossier client.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-xs text-green-800">
            {success}
          </div>
        )}

        {diffKeys.length === 0 ? (
          <p className="text-sm text-gray-600">
            Aucun champ n&apos;a été modifié dans cette proposition (le
            client a re-signé sans changer de valeurs). Vous pouvez
            l&apos;appliquer d&apos;un clic pour la clôturer.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAll('accept')}
                className="text-green-700 border-green-300 hover:bg-green-50"
              >
                <CheckCircle size={14} className="mr-1" /> Tout accepter
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAll('reject')}
                className="text-red-700 border-red-300 hover:bg-red-50"
              >
                <XCircle size={14} className="mr-1" /> Tout refuser
              </Button>
              <span className="text-[11px] text-gray-500 ml-2">
                {Object.keys(decisions).length} / {diffKeys.length} champ(s) décidé(s)
              </span>
            </div>

            <div className="space-y-2">
              {diffKeys.map((k) => {
                const current = snapshot[k]
                const next = proposed[k]
                const d = decisions[k]
                return (
                  <div
                    key={k}
                    className="rounded border border-gray-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-sm font-medium text-gray-900">
                        {humanize(k)}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setDecisions((prev) => ({ ...prev, [k]: 'accept' }))
                          }
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                            d === 'accept'
                              ? 'bg-green-600 text-white border-green-600'
                              : 'border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-300'
                          }`}
                        >
                          <CheckCircle size={12} /> Accepter
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDecisions((prev) => ({ ...prev, [k]: 'reject' }))
                          }
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                            d === 'reject'
                              ? 'bg-red-600 text-white border-red-600'
                              : 'border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300'
                          }`}
                        >
                          <XCircle size={12} /> Refuser
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-gray-50 border border-gray-200 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
                          Valeur actuelle
                        </div>
                        <pre className="whitespace-pre-wrap break-words text-gray-700 font-sans">
                          {formatValue(current)}
                        </pre>
                      </div>
                      <div className="rounded bg-amber-50 border border-amber-200 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-amber-700 mb-0.5">
                          Proposition
                        </div>
                        <pre className="whitespace-pre-wrap break-words text-amber-900 font-sans">
                          {formatValue(next)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {unchangedKeys.length > 0 && (
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer">
              {unchangedKeys.length} champ(s) inchangé(s) — afficher
            </summary>
            <div className="mt-1 pl-4 text-[11px]">
              {unchangedKeys.map((k) => humanize(k)).join(', ')}
            </div>
          </details>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
          <Button
            type="button"
            disabled={applying || (diffKeys.length > 0 && !allDecided)}
            onClick={apply}
            className="bg-gray-900 hover:bg-gray-800"
          >
            {applying && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Appliquer la proposition
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
