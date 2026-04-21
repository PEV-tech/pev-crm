'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Plus, X, Clock, CheckCircle, Ban, RotateCcw, Calendar } from 'lucide-react'

const formatDate = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))

/** Délais CDC §10 */
const DELAIS = [
  { label: '3 jours', days: 3 },
  { label: '5 jours', days: 5 },
  { label: '15 jours', days: 15 },
  { label: '3 semaines', days: 21 },
  { label: '1 mois', days: 30 },
  { label: '3 mois', days: 90 },
  { label: '6 mois', days: 180 },
  { label: '1 an', days: 365 },
]

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const RELANCE_STATUTS = ['a_faire', 'fait', 'ignore', 'reporte'] as const
type RelanceStatut = (typeof RELANCE_STATUTS)[number]

function toRelanceStatut(value: unknown): RelanceStatut {
  return typeof value === 'string' && (RELANCE_STATUTS as readonly string[]).includes(value)
    ? (value as RelanceStatut)
    : 'a_faire'
}

// La colonne `statut` est `text` en DB (pas un enum Postgres), donc le
// Row Supabase remonte `string`. On conserve l'union typée côté UI
// via `toRelanceStatut` appliqué au chargement, pour garder les
// comparaisons exhaustives dans les filtres/badges en aval.
interface Relance {
  id: string
  client_id: string
  dossier_id: string | null
  type: string
  description: string
  date_echeance: string
  rappel_date: string | null
  statut: RelanceStatut
  created_at: string
}

const RELANCE_TYPES = [
  { value: 'document', label: 'Document manquant' },
  { value: 'signature', label: 'Signature' },
  { value: 'paiement', label: 'Paiement' },
  { value: 'kyc', label: 'KYC / Réglementaire' },
  { value: 'suivi', label: 'Suivi général' },
  { value: 'relance_client', label: 'Relance client' },
  { value: 'autre', label: 'Autre' },
]

interface ClientRelancesProps {
  clientId: string
  dossierId?: string
  dossiers?: { id: string; produit_nom: string | null }[]
  compact?: boolean
}

export function ClientRelances({ clientId, dossierId, dossiers, compact }: ClientRelancesProps) {
  const [relances, setRelances] = React.useState<Relance[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showForm, setShowForm] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [snoozeOpen, setSnoozeOpen] = React.useState<string | null>(null)

  // Form state
  const [formType, setFormType] = React.useState('suivi')
  const [formDesc, setFormDesc] = React.useState('')
  const [formDelai, setFormDelai] = React.useState(3) // default 3 jours
  const [formDossierId, setFormDossierId] = React.useState(dossierId || '')

  const supabase = React.useMemo(() => createClient(), [])

  const fetchRelances = React.useCallback(async () => {
    let query = supabase
      .from('relances')
      .select('*')
      .eq('client_id', clientId)
      .order('date_echeance', { ascending: true })

    if (dossierId) {
      query = query.eq('dossier_id', dossierId)
    }

    const { data } = await query
    const rows = (data || []) as Array<Omit<Relance, 'statut'> & { statut: string | null }>
    setRelances(rows.map((r) => ({ ...r, statut: toRelanceStatut(r.statut) })))
    setLoading(false)
  }, [clientId, dossierId, supabase])

  React.useEffect(() => { fetchRelances() }, [fetchRelances])

  const handleCreate = async () => {
    if (!formDesc.trim()) return
    setSaving(true)
    const { error } = await supabase.from('relances').insert({
      client_id: clientId,
      dossier_id: formDossierId || null,
      type: formType,
      description: formDesc.trim(),
      date_echeance: addDays(formDelai),
      rappel_date: addDays(formDelai),
      statut: 'a_faire',
    })
    if (!error) {
      await fetchRelances()
      setShowForm(false)
      setFormDesc('')
      setFormDelai(3)
      setFormType('suivi')
      setFormDossierId(dossierId || '')
    }
    setSaving(false)
  }

  const handleMarkDone = async (id: string) => {
    await supabase.from('relances').update({ statut: 'fait' }).eq('id', id)
    setRelances(prev => prev.map(r => r.id === id ? { ...r, statut: 'fait' as const } : r))
  }

  const handleIgnore = async (id: string) => {
    await supabase.from('relances').update({ statut: 'ignore' }).eq('id', id)
    setRelances(prev => prev.map(r => r.id === id ? { ...r, statut: 'ignore' as const } : r))
  }

  const handleSnooze = async (id: string, days: number) => {
    const newDate = addDays(days)
    await supabase.from('relances').update({
      statut: 'reporte',
      rappel_date: newDate,
      date_echeance: newDate,
    }).eq('id', id)
    await fetchRelances()
    setSnoozeOpen(null)
  }

  const handleReopen = async (r: Relance) => {
    await supabase.from('relances').update({ statut: 'a_faire' }).eq('id', r.id)
    setRelances(prev => prev.map(x => x.id === r.id ? { ...x, statut: 'a_faire' as const } : x))
  }

  const today = new Date().toISOString().split('T')[0]
  // Active: à faire + reporté dont la date est atteinte
  const actives = relances.filter(r =>
    r.statut === 'a_faire' || (r.statut === 'reporte' && r.rappel_date && r.rappel_date <= today)
  )
  const snoozed = relances.filter(r => r.statut === 'reporte' && r.rappel_date && r.rappel_date > today)
  const done = relances.filter(r => r.statut === 'fait' || r.statut === 'ignore')

  const isOverdue = (dateStr: string) => dateStr < today

  if (loading) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell size={18} className="text-orange-500" />
            Relances
            {actives.length > 0 && (
              <Badge variant="warning" className="text-xs">{actives.length}</Badge>
            )}
          </CardTitle>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            >
              <Plus size={14} />
              Nouvelle
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Form de création */}
        {showForm && (
          <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-orange-800">Nouvelle relance</p>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>

            <select
              value={formType}
              onChange={e => setFormType(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-orange-400"
            >
              {RELANCE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Description de la relance..."
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-orange-400 min-h-16"
            />

            {/* Sélecteur de délai */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Me le rappeler dans...</label>
              <div className="flex flex-wrap gap-1.5">
                {DELAIS.map(d => (
                  <button
                    key={d.days}
                    onClick={() => setFormDelai(d.days)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                      formDelai === d.days
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {!dossierId && dossiers && dossiers.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Dossier (optionnel)</label>
                <select
                  value={formDossierId}
                  onChange={e => setFormDossierId(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-orange-400"
                >
                  <option value="">— Aucun —</option>
                  {dossiers.map(d => (
                    <option key={d.id} value={d.id}>{d.produit_nom || 'Dossier'}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={saving || !formDesc.trim()}
              className="w-full py-1.5 bg-orange-600 text-white text-sm font-medium rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Enregistrement...' : 'Créer la relance'}
            </button>
          </div>
        )}

        {/* Relances actives */}
        {actives.length > 0 ? (
          <div className="space-y-2">
            {actives.map(r => (
              <div
                key={r.id}
                className={`p-2.5 rounded-lg border transition-colors ${
                  isOverdue(r.date_echeance)
                    ? 'border-red-200 bg-red-50/50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant={isOverdue(r.date_echeance) ? 'destructive' : 'outline'} className="text-[10px]">
                    {RELANCE_TYPES.find(t => t.value === r.type)?.label || r.type}
                  </Badge>
                  <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue(r.date_echeance) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    <Calendar size={10} />
                    {formatDate(r.date_echeance)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{r.description}</p>

                {/* Actions CDC §10 */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleMarkDone(r.id)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                  >
                    <CheckCircle size={12} /> Fait
                  </button>
                  <button
                    onClick={() => handleIgnore(r.id)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <Ban size={12} /> Ignoré
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setSnoozeOpen(snoozeOpen === r.id ? null : r.id)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                    >
                      <Clock size={12} /> Me le rappeler dans...
                    </button>
                    {snoozeOpen === r.id && (
                      <div className="absolute z-10 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-48">
                        <div className="grid grid-cols-2 gap-1">
                          {DELAIS.map(d => (
                            <button
                              key={d.days}
                              onClick={() => handleSnooze(r.id, d.days)}
                              className="px-2.5 py-1.5 text-xs text-left font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-700 rounded transition-colors"
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !showForm && snoozed.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-3">Aucune relance en cours</p>
          )
        )}

        {/* Relances reportées */}
        {snoozed.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Clock size={10} /> Reportées ({snoozed.length})
            </p>
            {snoozed.map(r => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg border border-amber-100 bg-amber-50/30 text-xs">
                <Clock size={12} className="text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-600 truncate">{r.description}</p>
                  <span className="text-[10px] text-amber-600">Rappel le {formatDate(r.rappel_date!)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Terminées / ignorées */}
        {done.length > 0 && !compact && (
          <details className="group">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 flex items-center gap-1">
              <CheckCircle size={12} />
              {done.length} terminée(s) / ignorée(s)
            </summary>
            <div className="space-y-1.5 mt-2">
              {done.map(r => (
                <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50/50 opacity-60">
                  {r.statut === 'fait' ? (
                    <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                  ) : (
                    <Ban size={12} className="text-gray-400 shrink-0" />
                  )}
                  <p className="flex-1 text-sm text-gray-500 line-through truncate">{r.description}</p>
                  <button
                    onClick={() => handleReopen(r)}
                    className="p-1 hover:bg-gray-100 rounded shrink-0"
                    title="Ré-ouvrir"
                  >
                    <RotateCcw size={10} className="text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
