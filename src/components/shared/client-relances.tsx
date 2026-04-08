'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Plus, Calendar, X, Save, Clock, AlertCircle, CheckCircle } from 'lucide-react'

const formatDate = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))

interface Relance {
  id: string
  client_id: string
  dossier_id: string | null
  type: string
  description: string
  date_echeance: string
  statut: 'a_faire' | 'fait' | 'annule'
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
  dossierId?: string // if provided, filter to this dossier only
  dossiers?: { id: string; produit_nom: string | null }[] // for dossier selector
  compact?: boolean
}

export function ClientRelances({ clientId, dossierId, dossiers, compact }: ClientRelancesProps) {
  const [relances, setRelances] = React.useState<Relance[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showForm, setShowForm] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Form state
  const [formType, setFormType] = React.useState('suivi')
  const [formDesc, setFormDesc] = React.useState('')
  const [formDate, setFormDate] = React.useState('')
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
    setRelances(data || [])
    setLoading(false)
  }, [clientId, dossierId, supabase])

  React.useEffect(() => {
    fetchRelances()
  }, [fetchRelances])

  const handleCreate = async () => {
    if (!formDesc.trim() || !formDate) return
    setSaving(true)
    const { error } = await supabase.from('relances').insert({
      client_id: clientId,
      dossier_id: formDossierId || null,
      type: formType,
      description: formDesc.trim(),
      date_echeance: formDate,
      statut: 'a_faire',
    })
    if (!error) {
      await fetchRelances()
      setShowForm(false)
      setFormDesc('')
      setFormDate('')
      setFormType('suivi')
      setFormDossierId(dossierId || '')
    }
    setSaving(false)
  }

  const handleToggleStatut = async (relance: Relance) => {
    const newStatut = relance.statut === 'a_faire' ? 'fait' : 'a_faire'
    await supabase.from('relances').update({ statut: newStatut }).eq('id', relance.id)
    setRelances(prev =>
      prev.map(r => (r.id === relance.id ? { ...r, statut: newStatut } : r))
    )
  }

  const aFaire = relances.filter(r => r.statut === 'a_faire')
  const faites = relances.filter(r => r.statut === 'fait')

  const isOverdue = (dateStr: string) => new Date(dateStr) < new Date()

  if (loading) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell size={18} className="text-orange-500" />
            Relances
            {aFaire.length > 0 && (
              <Badge variant="warning" className="text-xs">{aFaire.length}</Badge>
            )}
          </CardTitle>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            >
              <Plus size={14} />
              Nouvelle relance
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Create form */}
        {showForm && (
          <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-orange-800">Nouvelle relance</p>
              <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-700">
                <X size={14} />
              </button>
            </div>
            <select
              value={formType}
              onChange={e => setFormType(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
            >
              {RELANCE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Description de la relance..."
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-orange-400 focus:border-orange-400 min-h-16"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Date d'échéance</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
              {!dossierId && dossiers && dossiers.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-gray-500">Dossier (optionnel)</label>
                  <select
                    value={formDossierId}
                    onChange={e => setFormDossierId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                  >
                    <option value="">— Aucun —</option>
                    {dossiers.map(d => (
                      <option key={d.id} value={d.id}>{d.produit_nom || 'Dossier'}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <button
              onClick={handleCreate}
              disabled={saving || !formDesc.trim() || !formDate}
              className="w-full py-1.5 bg-orange-600 text-white text-sm font-medium rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Enregistrement...' : 'Créer la relance'}
            </button>
          </div>
        )}

        {/* Pending relances */}
        {aFaire.length > 0 ? (
          <div className="space-y-2">
            {aFaire.map(r => (
              <div
                key={r.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors ${
                  isOverdue(r.date_echeance)
                    ? 'border-red-200 bg-red-50/50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <button
                  onClick={() => handleToggleStatut(r)}
                  className="mt-0.5 shrink-0 w-5 h-5 rounded border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors flex items-center justify-center"
                  title="Marquer comme fait"
                >
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={isOverdue(r.date_echeance) ? 'destructive' : 'outline'} className="text-[10px]">
                      {RELANCE_TYPES.find(t => t.value === r.type)?.label || r.type}
                    </Badge>
                    <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue(r.date_echeance) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      <Calendar size={10} />
                      {formatDate(r.date_echeance)}
                      {isOverdue(r.date_echeance) && ' — En retard'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !showForm && (
            <p className="text-sm text-gray-400 italic text-center py-3">Aucune relance en cours</p>
          )
        )}

        {/* Completed relances (collapsed) */}
        {faites.length > 0 && !compact && (
          <details className="group">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 flex items-center gap-1">
              <CheckCircle size={12} />
              {faites.length} relance(s) terminée(s)
            </summary>
            <div className="space-y-1.5 mt-2">
              {faites.map(r => (
                <div
                  key={r.id}
                  className="flex items-start gap-2.5 p-2 rounded-lg border border-gray-100 bg-gray-50/50 opacity-60"
                >
                  <button
                    onClick={() => handleToggleStatut(r)}
                    className="mt-0.5 shrink-0 w-5 h-5 rounded border-2 border-emerald-400 bg-emerald-100 flex items-center justify-center"
                    title="Ré-ouvrir"
                  >
                    <CheckCircle size={12} className="text-emerald-600" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-500 line-through">{r.description}</p>
                    <span className="text-[10px] text-gray-400">{formatDate(r.date_echeance)}</span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
