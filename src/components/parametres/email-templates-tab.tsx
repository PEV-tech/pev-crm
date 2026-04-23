'use client'

/**
 * Onglet « Emails » de Paramètres — permet au consultant (et au manager)
 * de personnaliser les templates transactionnels KYC.
 *
 * Retour Maxine #1 (2026-04-21) : chaque consultant doit pouvoir
 * rédiger ses propres emails post-signature. Les managers peuvent aussi
 * éditer les templates de n'importe quel consultant (utile pour
 * proposer des "defaults maison" qui seront clonés).
 *
 * Scope v1 :
 *   · 2 templates : `kyc_signed_consultant` et `kyc_signed_client`.
 *   · Éditeur : subject (1 ligne) + body (textarea). Pas de HTML.
 *   · Variables supportées affichées comme chips cliquables qui
 *     s'insèrent au curseur.
 *   · Preview live du rendu (substitution avec valeurs d'exemple).
 *   · Toggle `enabled` pour désactiver sans supprimer.
 */

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, RotateCcw, Save, Eye } from 'lucide-react'
import {
  DEFAULT_TEMPLATES,
  substituteVars,
  type EmailTemplateKey,
  type EmailTemplateVariables,
  type LoadedTemplate,
} from '@/lib/kyc-email-templates'

type Consultant = { id: string; nom: string; prenom: string | null; role: string | null }

// Valeurs d'exemple pour la preview (couvrent les 4 templates).
const PREVIEW_VARS: EmailTemplateVariables = {
  clientLabel: 'Dupont Jean',
  clientFirstName: 'Jean',
  signerName: 'Jean Dupont',
  signedAtStr: '22 avril 2026 à 14:30',
  completionRate: 87,
  missingFields: 'Adresse, Profession',
  consultantPrenom: 'Maxine',
  // Valeurs d'exemple pour kyc_envoi_lien / kyc_relance.
  portailUrl: 'https://pev-crm.vercel.app/kyc/token-exemple',
  kycSentAtFr: '16 avril 2026 à 09:15',
  joursDepuisEnvoi: 7,
  cabinetNom: 'Private Equity Valley',
  consultantNom: 'Maxine Laisné',
}

const TEMPLATE_LABELS: Record<EmailTemplateKey, { title: string; help: string }> = {
  kyc_signed_consultant: {
    title: 'Notification consultant — KYC signé',
    help: "Email envoyé au consultant (vous) quand un client finalise la signature de son KYC. Pratique pour être alerté en temps réel.",
  },
  kyc_signed_client: {
    title: 'Confirmation client — KYC signé',
    help: "Email envoyé au client qui vient de signer, avec le PDF en pièce jointe. Ton accueil, pas d'infos internes.",
  },
  kyc_envoi_lien: {
    title: 'Envoi du lien KYC — initial',
    help: "Email envoyé au client pour lui transmettre son lien de saisie KYC. Utilisez {{portailUrl}} pour insérer le lien sécurisé.",
  },
  kyc_relance: {
    title: 'Relance KYC — lien non signé',
    help: "Email envoyé automatiquement au client quand le KYC n'est pas signé après le délai que vous aurez choisi dans Paramètres → Relances. Utilisez {{joursDepuisEnvoi}} pour rappeler l'ancienneté du lien.",
  },
}

const VARIABLES: Array<{ name: keyof EmailTemplateVariables; description: string }> = [
  { name: 'clientLabel', description: "Nom complet ou raison sociale" },
  { name: 'clientFirstName', description: "Prénom du client (PP seulement)" },
  { name: 'signerName', description: "Nom saisi au moment de la signature" },
  { name: 'signedAtStr', description: "Date et heure de la signature" },
  { name: 'completionRate', description: "Taux de complétude (0-100)" },
  { name: 'missingFields', description: "Champs manquants (liste séparée virgules)" },
  { name: 'consultantPrenom', description: "Prénom du consultant" },
  { name: 'consultantNom', description: "Nom complet du consultant (prénom + nom)" },
  { name: 'cabinetNom', description: "Nom du cabinet — Private Equity Valley" },
  { name: 'portailUrl', description: "URL sécurisée vers le portail KYC (envoi + relance)" },
  { name: 'kycSentAtFr', description: "Date FR d'envoi du lien (relance)" },
  { name: 'joursDepuisEnvoi', description: "Nombre de jours depuis l'envoi (relance)" },
]

type RowState = LoadedTemplate & { enabled: boolean; id: string | null; dirty: boolean }

export function EmailTemplatesTab({
  currentConsultantId,
  isManager,
}: {
  currentConsultantId: string | null
  isManager: boolean
}) {
  const supabase = React.useMemo(() => createClient(), [])
  const [consultants, setConsultants] = React.useState<Consultant[]>([])
  const [selectedConsultantId, setSelectedConsultantId] = React.useState<
    string | null
  >(currentConsultantId)
  const [rows, setRows] = React.useState<Record<EmailTemplateKey, RowState>>({
    kyc_signed_consultant: blankRow('kyc_signed_consultant'),
    kyc_signed_client: blankRow('kyc_signed_client'),
    kyc_envoi_lien: blankRow('kyc_envoi_lien'),
    kyc_relance: blankRow('kyc_relance'),
  })
  const [loading, setLoading] = React.useState(true)
  const [savingKey, setSavingKey] = React.useState<EmailTemplateKey | null>(null)
  const [flash, setFlash] = React.useState<{
    kind: 'ok' | 'err'
    msg: string
  } | null>(null)

  function blankRow(key: EmailTemplateKey): RowState {
    return {
      ...DEFAULT_TEMPLATES[key],
      enabled: false,
      id: null,
      dirty: false,
    }
  }

  React.useEffect(() => {
    if (isManager) {
      supabase
        .from('consultants')
        .select('id, nom, prenom, role')
        .order('nom')
        .then(({ data }) => {
          setConsultants((data || []) as Consultant[])
        })
    }
  }, [isManager, supabase])

  const loadTemplates = React.useCallback(async () => {
    if (!selectedConsultantId) return
    setLoading(true)
    setFlash(null)
    const { data, error } = await supabase
      .from('consultant_email_templates' as never)
      .select('id, template_key, subject, body, enabled')
      .eq('consultant_id', selectedConsultantId)
    if (error) {
      setFlash({ kind: 'err', msg: error.message })
      setLoading(false)
      return
    }
    const byKey: Partial<Record<EmailTemplateKey, RowState>> = {}
    for (const r of (data || []) as Array<{
      id: string
      template_key: EmailTemplateKey
      subject: string
      body: string
      enabled: boolean
    }>) {
      byKey[r.template_key] = {
        id: r.id,
        subject: r.subject,
        bodyText: r.body,
        enabled: r.enabled,
        dirty: false,
      }
    }
    setRows({
      kyc_signed_consultant:
        byKey.kyc_signed_consultant ?? blankRow('kyc_signed_consultant'),
      kyc_signed_client:
        byKey.kyc_signed_client ?? blankRow('kyc_signed_client'),
      kyc_envoi_lien:
        byKey.kyc_envoi_lien ?? blankRow('kyc_envoi_lien'),
      kyc_relance:
        byKey.kyc_relance ?? blankRow('kyc_relance'),
    })
    setLoading(false)
  }, [selectedConsultantId, supabase])

  React.useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  function updateRow(key: EmailTemplateKey, patch: Partial<RowState>) {
    setRows((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch, dirty: true },
    }))
  }

  async function save(key: EmailTemplateKey) {
    if (!selectedConsultantId) return
    setSavingKey(key)
    setFlash(null)
    const row = rows[key]
    try {
      if (row.id) {
        const { error } = await supabase
          .from('consultant_email_templates' as never)
          .update({
            subject: row.subject,
            body: row.bodyText,
            enabled: row.enabled,
          } as never)
          .eq('id', row.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('consultant_email_templates' as never)
          .insert({
            consultant_id: selectedConsultantId,
            template_key: key,
            subject: row.subject,
            body: row.bodyText,
            enabled: row.enabled,
          } as never)
          .select('id')
          .single()
        if (error) throw error
        const newRow = data as unknown as { id: string } | null
        if (newRow) {
          setRows((prev) => ({
            ...prev,
            [key]: { ...prev[key], id: newRow.id, dirty: false },
          }))
        }
      }
      setRows((prev) => ({
        ...prev,
        [key]: { ...prev[key], dirty: false },
      }))
      setFlash({ kind: 'ok', msg: 'Template enregistré' })
    } catch (err: unknown) {
      setFlash({
        kind: 'err',
        msg: err instanceof Error ? err.message : 'Erreur enregistrement',
      })
    } finally {
      setSavingKey(null)
    }
  }

  function resetToDefault(key: EmailTemplateKey) {
    setRows((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        subject: DEFAULT_TEMPLATES[key].subject,
        bodyText: DEFAULT_TEMPLATES[key].bodyText,
        dirty: true,
      },
    }))
  }

  const showConsultantPicker = isManager && consultants.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Mail size={18} /> Templates emails KYC
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Personnalisez les emails envoyés à vos clients et à vous-même après signature.
          </p>
        </div>
        {showConsultantPicker && (
          <label className="text-sm flex items-center gap-2">
            <span className="text-gray-700">Consultant :</span>
            <select
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              value={selectedConsultantId ?? ''}
              onChange={(e) => setSelectedConsultantId(e.target.value || null)}
            >
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.prenom} {c.nom}
                  {c.role ? ` (${c.role})` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {flash && (
        <div
          className={`rounded border text-xs px-3 py-2 ${
            flash.kind === 'ok'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {flash.msg}
        </div>
      )}

      {!selectedConsultantId ? (
        <Card>
          <CardContent className="py-6 text-sm text-gray-500">
            Aucun consultant sélectionné.
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-gray-500">
            Chargement…
          </CardContent>
        </Card>
      ) : (
        (Object.keys(TEMPLATE_LABELS) as EmailTemplateKey[]).map((key) => {
          const row = rows[key]
          const meta = TEMPLATE_LABELS[key]
          const isCustom = row.id !== null
          return (
            <TemplateEditorCard
              key={key}
              title={meta.title}
              help={meta.help}
              isCustom={isCustom}
              row={row}
              onChange={(patch) => updateRow(key, patch)}
              onSave={() => save(key)}
              onReset={() => resetToDefault(key)}
              saving={savingKey === key}
            />
          )
        })
      )}
    </div>
  )
}

function TemplateEditorCard({
  title,
  help,
  isCustom,
  row,
  onChange,
  onSave,
  onReset,
  saving,
}: {
  title: string
  help: string
  isCustom: boolean
  row: RowState
  onChange: (patch: Partial<RowState>) => void
  onSave: () => void
  onReset: () => void
  saving: boolean
}) {
  const [showPreview, setShowPreview] = React.useState(false)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  const subjectRef = React.useRef<HTMLInputElement>(null)
  // Dernier champ focus — pour que les chips de variables insèrent au
  // bon endroit (subject ou body).
  const [lastFocus, setLastFocus] = React.useState<'subject' | 'body'>(
    'body',
  )

  function insertVar(name: string) {
    const token = `{{${name}}}`
    if (lastFocus === 'subject' && subjectRef.current) {
      const el = subjectRef.current
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const next = el.value.slice(0, start) + token + el.value.slice(end)
      onChange({ subject: next })
      // Repositionne le curseur après le token.
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + token.length, start + token.length)
      })
    } else if (bodyRef.current) {
      const el = bodyRef.current
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const next = el.value.slice(0, start) + token + el.value.slice(end)
      onChange({ bodyText: next })
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + token.length, start + token.length)
      })
    }
  }

  const previewSubject = substituteVars(row.subject, PREVIEW_VARS)
  const previewBody = substituteVars(row.bodyText, PREVIEW_VARS)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-gray-500 mt-1">{help}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] rounded px-2 py-0.5 font-medium ${
                isCustom
                  ? row.enabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isCustom
                ? row.enabled
                  ? 'Custom actif'
                  : 'Custom désactivé'
                : 'Template par défaut'}
            </span>
            <label className="inline-flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => onChange({ enabled: e.target.checked })}
              />
              <span>Activer</span>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-700">
            Objet (sujet)
          </label>
          <Input
            ref={subjectRef}
            value={row.subject}
            onChange={(e) => onChange({ subject: e.target.value })}
            onFocus={() => setLastFocus('subject')}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700">Corps</label>
          <textarea
            ref={bodyRef}
            value={row.bodyText}
            onChange={(e) => onChange({ bodyText: e.target.value })}
            onFocus={() => setLastFocus('body')}
            rows={10}
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Texte libre — le corps est automatiquement enveloppé dans la charte
            visuelle PEV à l&apos;envoi. Les sauts de ligne sont préservés.
          </p>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">
            Variables disponibles (cliquer pour insérer)
          </div>
          <div className="flex flex-wrap gap-1">
            {VARIABLES.map((v) => (
              <button
                type="button"
                key={v.name}
                onClick={() => insertVar(v.name)}
                title={v.description}
                className="inline-flex items-center text-[11px] font-mono rounded border border-indigo-200 bg-indigo-50 text-indigo-800 px-2 py-0.5 hover:bg-indigo-100"
              >
                {`{{${v.name}}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={saving || !row.dirty}
          >
            <Save size={14} className="mr-1" />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onReset}
          >
            <RotateCcw size={14} className="mr-1" />
            Restaurer le défaut
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowPreview((v) => !v)}
          >
            <Eye size={14} className="mr-1" />
            {showPreview ? 'Masquer' : 'Aperçu'}
          </Button>
          {row.dirty && (
            <span className="text-[11px] text-amber-700 italic">
              Modifications non enregistrées
            </span>
          )}
        </div>

        {showPreview && (
          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
              Aperçu (variables remplacées par des valeurs d&apos;exemple)
            </div>
            <div className="mb-2">
              <span className="text-[11px] text-gray-500">Objet :</span>{' '}
              <span className="font-medium">{previewSubject}</span>
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-gray-800 text-[13px]">
              {previewBody}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
