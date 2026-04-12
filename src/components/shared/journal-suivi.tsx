'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonText } from '@/components/shared/skeleton'
import { MessageSquare, Plus, X, Save, Pencil, Trash2, Filter } from 'lucide-react'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'

/** Étiquettes CDC §8 */
const ETIQUETTES = [
  { value: 'compte_rendu_rdv', label: 'Compte rendu RDV', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'email', label: 'Email', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'appel_telephonique', label: 'Appel téléphonique', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'note_interne', label: 'Note interne', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'relance', label: 'Relance', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'document_recu', label: 'Document reçu', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'autre', label: 'Autre', color: 'bg-gray-100 text-gray-700 border-gray-200' },
] as const

type EtiquetteType = typeof ETIQUETTES[number]['value']

const getEtiquette = (type: string) =>
  ETIQUETTES.find(e => e.value === type) || ETIQUETTES[ETIQUETTES.length - 1]

const formatDateTime = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d))

interface Commentaire {
  id: string
  client_id: string
  auteur_id: string | null
  auteur_nom: string
  type_etiquette: EtiquetteType
  contenu: string
  created_at: string
  updated_at: string
}

interface JournalSuiviProps {
  clientId: string
  currentUserId?: string
  currentUserNom: string
  isManager: boolean
}

export function JournalSuivi({ clientId, currentUserId, currentUserNom, isManager }: JournalSuiviProps) {
  const [commentaires, setCommentaires] = React.useState<Commentaire[]>([])
  const [loading, setLoading] = React.useState(true)
  const timedOut = useLoadingTimeout(loading, 15000)
  const [showForm, setShowForm] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [filterType, setFilterType] = React.useState<EtiquetteType | 'all'>('all')

  // Form state
  const [formType, setFormType] = React.useState<EtiquetteType>('note_interne')
  const [formContenu, setFormContenu] = React.useState('')

  // Edit state
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editContenu, setEditContenu] = React.useState('')
  const [editType, setEditType] = React.useState<EtiquetteType>('note_interne')

  const supabase = React.useMemo(() => createClient(), [])

  const fetchCommentaires = React.useCallback(async () => {
    const { data } = await supabase
      .from('client_commentaires')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setCommentaires((data as any) || [])
    setLoading(false)
  }, [clientId, supabase])

  React.useEffect(() => { fetchCommentaires() }, [fetchCommentaires])

  const handleCreate = async () => {
    if (!formContenu.trim()) return
    setSaving(true)
    const { error } = await supabase.from('client_commentaires').insert({
      client_id: clientId,
      auteur_id: currentUserId || null,
      auteur_nom: currentUserNom,
      type_etiquette: formType,
      contenu: formContenu.trim(),
    })
    if (!error) {
      await fetchCommentaires()
      setShowForm(false)
      setFormContenu('')
      setFormType('note_interne')
    }
    setSaving(false)
  }

  const handleUpdate = async (id: string) => {
    if (!editContenu.trim()) return
    setSaving(true)
    await supabase.from('client_commentaires').update({
      contenu: editContenu.trim(),
      type_etiquette: editType,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await fetchCommentaires()
    setEditingId(null)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('client_commentaires').delete().eq('id', id)
    setCommentaires(prev => prev.filter(c => c.id !== id))
  }

  const canEditDelete = (c: Commentaire) =>
    isManager || c.auteur_id === currentUserId

  const filtered = filterType === 'all'
    ? commentaires
    : commentaires.filter(c => c.type_etiquette === filterType)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare size={18} className="text-indigo-600" />
            Journal de suivi
            {commentaires.length > 0 && (
              <span className="text-xs font-normal text-gray-400">({commentaires.length})</span>
            )}
          </CardTitle>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            >
              <Plus size={14} />
              Ajouter
            </button>
          )}
        </div>

        {/* Filtres par étiquette */}
        {commentaires.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${
                filterType === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Tous
            </button>
            {ETIQUETTES.map(e => {
              const count = commentaires.filter(c => c.type_etiquette === e.value).length
              if (count === 0) return null
              return (
                <button
                  key={e.value}
                  onClick={() => setFilterType(e.value)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${
                    filterType === e.value ? e.color + ' ring-1 ring-offset-1' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {e.label} ({count})
                </button>
              )
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Form nouveau commentaire */}
        {showForm && (
          <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-indigo-800">Nouveau commentaire</p>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex flex-wrap gap-1.5">
              {ETIQUETTES.map(e => (
                <button
                  key={e.value}
                  onClick={() => setFormType(e.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    formType === e.value ? e.color + ' ring-1 ring-offset-1' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>

            <textarea
              value={formContenu}
              onChange={e => setFormContenu(e.target.value)}
              placeholder="Écrire un commentaire..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 min-h-24 resize-y"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={saving || !formContenu.trim()}
                className="flex-1 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
              >
                <Save size={14} />
                {saving ? 'Enregistrement...' : 'Publier'}
              </button>
              <button
                onClick={() => { setShowForm(false); setFormContenu('') }}
                className="px-4 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Liste des commentaires */}
        {loading ? (
          timedOut ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <p className="text-gray-600 text-center">Impossible de charger les données. Vérifiez votre connexion et rechargez la page.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Recharger
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <SkeletonText lines={3} className="mb-3" />
              <SkeletonText lines={2} />
              <SkeletonText lines={4} />
            </div>
          )
        ) : filtered.length > 0 ? (
          <div className="space-y-2.5">
            {filtered.map(c => {
              const etiq = getEtiquette(c.type_etiquette)
              const isEditing = editingId === c.id

              return (
                <div key={c.id} className="group relative p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                  {/* Header: auteur + date + étiquette */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${etiq.color}`}>
                      {etiq.label}
                    </span>
                    <span className="text-xs font-medium text-gray-700">{c.auteur_nom}</span>
                    <span className="text-[10px] text-gray-400">{formatDateTime(c.created_at)}</span>
                    {c.updated_at !== c.created_at && (
                      <span className="text-[10px] text-gray-400 italic">(modifié)</span>
                    )}

                    {/* Actions */}
                    {canEditDelete(c) && !isEditing && (
                      <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(c.id)
                            setEditContenu(c.contenu)
                            setEditType(c.type_etiquette)
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Modifier"
                        >
                          <Pencil size={12} className="text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          <Trash2 size={12} className="text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Contenu */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {ETIQUETTES.map(e => (
                          <button
                            key={e.value}
                            onClick={() => setEditType(e.value)}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${
                              editType === e.value ? e.color : 'bg-white text-gray-500 border-gray-200'
                            }`}
                          >
                            {e.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={editContenu}
                        onChange={e => setEditContenu(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 min-h-16 resize-y"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(c.id)}
                          disabled={saving || !editContenu.trim()}
                          className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {saving ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 border border-gray-300 text-xs rounded hover:bg-gray-50 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.contenu}</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          !showForm && (
            <p className="text-sm text-gray-400 italic text-center py-4">
              {filterType !== 'all' ? 'Aucun commentaire de ce type' : 'Aucun commentaire'}
            </p>
          )
        )}
      </CardContent>
    </Card>
  )
}
