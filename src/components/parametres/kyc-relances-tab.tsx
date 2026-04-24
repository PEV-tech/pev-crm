'use client'

/**
 * Onglet « Relances » de Paramètres — configuration des relances KYC
 * automatiques par consultant.
 *
 * Chantier 3 de l'étape 3 audit KYC (2026-04-24). Le consultant peut choisir :
 *   - enabled          : relances auto actives ou pas
 *   - seuil_jours      : délai après envoi du lien avant la 1re relance
 *   - intervalle_jours : délai entre 2 relances auto
 *   - max_relances     : plafond total (1..10)
 *   - email_auto       : envoi d'un email auto via le template `kyc_relance`
 *                        en plus de l'entrée dans la section Relances.
 *                        Nécessite un stack email fonctionnel (chantier 4+).
 *
 * Modèle DB : `kyc_relance_settings` (1 ligne par consultant, UNIQUE).
 * RLS : le consultant voit/modifie sa propre ligne ; un manager peut éditer
 * celles de n'importe qui (picker consultant en haut).
 *
 * Si aucune ligne n'existe pour un consultant, le composant affiche les
 * valeurs par défaut du DDL (7j / 7j / 3 / email_auto=false / enabled=true)
 * et crée la ligne au premier enregistrement (INSERT vs UPDATE géré via
 * la présence de `row.id`).
 */

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bell, Save } from 'lucide-react'

type Consultant = { id: string; nom: string; prenom: string | null; role: string | null }

interface RowState {
  id: string | null
  enabled: boolean
  seuil_jours: number
  intervalle_jours: number
  max_relances: number
  email_auto: boolean
  dirty: boolean
}

const DEFAULTS: RowState = {
  id: null,
  enabled: true,
  seuil_jours: 7,
  intervalle_jours: 7,
  max_relances: 3,
  email_auto: false,
  dirty: false,
}

export function KycRelancesTab({
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
  const [row, setRow] = React.useState<RowState>(DEFAULTS)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [flash, setFlash] = React.useState<{
    kind: 'ok' | 'err'
    msg: string
  } | null>(null)

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

  const loadSettings = React.useCallback(async () => {
    if (!selectedConsultantId) return
    setLoading(true)
    setFlash(null)
    const { data, error } = await supabase
      .from('kyc_relance_settings')
      .select('id, enabled, seuil_jours, intervalle_jours, max_relances, email_auto')
      .eq('consultant_id', selectedConsultantId)
      .maybeSingle()
    if (error) {
      setFlash({ kind: 'err', msg: error.message })
      setLoading(false)
      return
    }
    if (data) {
      setRow({
        id: data.id,
        enabled: data.enabled,
        seuil_jours: data.seuil_jours,
        intervalle_jours: data.intervalle_jours,
        max_relances: data.max_relances,
        email_auto: data.email_auto,
        dirty: false,
      })
    } else {
      // Pas de ligne existante — on affiche les defaults, la ligne sera
      // créée au 1er save.
      setRow({ ...DEFAULTS })
    }
    setLoading(false)
  }, [selectedConsultantId, supabase])

  React.useEffect(() => {
    loadSettings()
  }, [loadSettings])

  function update(patch: Partial<RowState>) {
    setRow((prev) => ({ ...prev, ...patch, dirty: true }))
  }

  async function save() {
    if (!selectedConsultantId) return
    // Validation côté client (doublée par les CHECK en base).
    if (row.seuil_jours < 1 || row.seuil_jours > 90) {
      setFlash({ kind: 'err', msg: 'Le seuil doit être entre 1 et 90 jours.' })
      return
    }
    if (row.intervalle_jours < 1 || row.intervalle_jours > 90) {
      setFlash({ kind: 'err', msg: "L'intervalle doit être entre 1 et 90 jours." })
      return
    }
    if (row.max_relances < 1 || row.max_relances > 10) {
      setFlash({ kind: 'err', msg: 'Le plafond doit être entre 1 et 10.' })
      return
    }
    setSaving(true)
    setFlash(null)
    try {
      if (row.id) {
        const { error } = await supabase
          .from('kyc_relance_settings')
          .update({
            enabled: row.enabled,
            seuil_jours: row.seuil_jours,
            intervalle_jours: row.intervalle_jours,
            max_relances: row.max_relances,
            email_auto: row.email_auto,
          })
          .eq('id', row.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('kyc_relance_settings')
          .insert({
            consultant_id: selectedConsultantId,
            enabled: row.enabled,
            seuil_jours: row.seuil_jours,
            intervalle_jours: row.intervalle_jours,
            max_relances: row.max_relances,
            email_auto: row.email_auto,
          })
          .select('id')
          .single()
        if (error) throw error
        setRow((prev) => ({ ...prev, id: data.id, dirty: false }))
      }
      setRow((prev) => ({ ...prev, dirty: false }))
      setFlash({ kind: 'ok', msg: 'Paramètres enregistrés.' })
    } catch (err: unknown) {
      setFlash({
        kind: 'err',
        msg: err instanceof Error ? err.message : 'Erreur enregistrement',
      })
    } finally {
      setSaving(false)
    }
  }

  const showConsultantPicker = isManager && consultants.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Bell size={18} /> Relances KYC automatiques
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Le CRM vérifie quotidiennement les KYC envoyés mais non signés, et
            crée une entrée dans votre section Relances selon les règles ci-dessous.
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
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Règles de relance</CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  Ces règles s&apos;appliquent à tous les clients dont vous êtes
                  le consultant référent.
                </p>
              </div>
              <span
                className={`text-[11px] rounded px-2 py-0.5 font-medium ${
                  row.id
                    ? row.enabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {row.id
                  ? row.enabled
                    ? 'Relances activées'
                    : 'Relances désactivées'
                  : 'Valeurs par défaut'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => update({ enabled: e.target.checked })}
              />
              <span>Activer les relances automatiques</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700">
                  Seuil avant 1re relance (jours)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={row.seuil_jours}
                  onChange={(e) =>
                    update({ seuil_jours: parseInt(e.target.value, 10) || 1 })
                  }
                  disabled={!row.enabled}
                  className="mt-1"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Nombre de jours d&apos;inaction après l&apos;envoi du lien avant que
                  la 1re relance soit générée.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">
                  Intervalle entre relances (jours)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={row.intervalle_jours}
                  onChange={(e) =>
                    update({ intervalle_jours: parseInt(e.target.value, 10) || 1 })
                  }
                  disabled={!row.enabled}
                  className="mt-1"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Cadence des relances suivantes tant que le KYC reste non signé.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">
                  Plafond (nombre max de relances)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={row.max_relances}
                  onChange={(e) =>
                    update({ max_relances: parseInt(e.target.value, 10) || 1 })
                  }
                  disabled={!row.enabled}
                  className="mt-1"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Au-delà, le CRM arrête de relancer automatiquement (la relance
                  peut être régénérée en renvoyant un nouveau lien).
                </p>
              </div>
            </div>

            <label className="inline-flex items-start gap-2 text-sm pt-2 border-t border-gray-100">
              <input
                type="checkbox"
                checked={row.email_auto}
                onChange={(e) => update({ email_auto: e.target.checked })}
                disabled={!row.enabled}
                className="mt-0.5"
              />
              <span>
                Envoyer un email de relance au client automatiquement
                <span className="block text-[11px] text-gray-500 font-normal mt-0.5">
                  Utilise le template <code className="bg-gray-100 px-1 rounded">kyc_relance</code>{' '}
                  paramétrable dans <em>Paramètres → Communication</em>. Nécessite un
                  stack email fonctionnel ; sinon seule l&apos;entrée dans la section
                  Relances est créée.
                </span>
              </span>
            </label>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <Button
                type="button"
                size="sm"
                onClick={save}
                disabled={saving || !row.dirty}
              >
                <Save size={14} className="mr-1" />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {row.dirty && (
                <span className="text-[11px] text-amber-700 italic">
                  Modifications non enregistrées
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
