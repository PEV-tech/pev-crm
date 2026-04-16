'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heart, Plus, X, Loader2, Users, ExternalLink } from 'lucide-react'
import Link from 'next/link'

const RELATION_TYPES = [
  { value: 'concubinage', label: 'Concubinage' },
  { value: 'marie', label: 'Marié(e)' },
  { value: 'pacse', label: 'Pacsé(e)' },
  { value: 'divorce', label: 'Divorcé(e)' },
  { value: 'veuf', label: 'Veuf(ve)' },
  { value: 'enfant', label: 'Enfant' },
  { value: 'parent', label: 'Parent' },
]

const RELATION_LABELS: Record<string, string> = {
  concubinage: 'Concubinage',
  marie: 'Marié(e)',
  pacse: 'Pacsé(e)',
  divorce: 'Divorcé(e)',
  veuf: 'Veuf(ve)',
  enfant: 'Enfant',
  parent: 'Parent',
}

const RELATION_COLORS: Record<string, string> = {
  concubinage: 'bg-pink-100 text-pink-700',
  marie: 'bg-rose-100 text-rose-700',
  pacse: 'bg-purple-100 text-purple-700',
  divorce: 'bg-orange-100 text-orange-700',
  veuf: 'bg-gray-100 text-gray-700',
  enfant: 'bg-blue-100 text-blue-700',
  parent: 'bg-amber-100 text-amber-700',
}

interface RelationData {
  id: string
  relatedClientId: string
  relatedClientNom: string
  relatedClientPrenom: string | null
  typeRelation: string
}

interface ClientRelationsProps {
  clientId: string
  clientName: string
}

export function ClientRelations({ clientId, clientName }: ClientRelationsProps) {
  const supabase = React.useMemo(() => createClient(), [])
  const [relations, setRelations] = React.useState<RelationData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showForm, setShowForm] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<{ id: string; nom: string; prenom: string | null }[]>([])
  const [searching, setSearching] = React.useState(false)
  const [selectedClient, setSelectedClient] = React.useState<{ id: string; nom: string; prenom: string | null } | null>(null)
  const [relationType, setRelationType] = React.useState('concubinage')

  const fetchRelations = React.useCallback(async () => {
    const { data } = await supabase
      .from('client_relations')
      .select('*')
      .or(`client_id_1.eq.${clientId},client_id_2.eq.${clientId}`)

    if (!data || data.length === 0) {
      setRelations([])
      setLoading(false)
      return
    }

    // Collect all related client IDs
    const relatedIds = data.map((r: any) =>
      r.client_id_1 === clientId ? r.client_id_2 : r.client_id_1
    )

    // Fetch related client info
    const { data: clients } = await supabase
      .from('clients')
      .select('id, nom, prenom')
      .in('id', relatedIds)

    const clientMap = new Map((clients || []).map((c: any) => [c.id, c]))

    const mapped: RelationData[] = data.map((r: any) => {
      const relatedId = r.client_id_1 === clientId ? r.client_id_2 : r.client_id_1
      const relatedClient = clientMap.get(relatedId)
      // If this client is client_id_2 and relation is 'enfant', they're actually the parent
      let displayType = r.type_relation
      if (r.client_id_2 === clientId && r.type_relation === 'enfant') {
        displayType = 'parent'
      } else if (r.client_id_2 === clientId && r.type_relation === 'parent') {
        displayType = 'enfant'
      }
      return {
        id: r.id,
        relatedClientId: relatedId,
        relatedClientNom: relatedClient?.nom || 'Inconnu',
        relatedClientPrenom: relatedClient?.prenom || null,
        typeRelation: displayType,
      }
    })

    setRelations(mapped)
    setLoading(false)
  }, [clientId, supabase])

  React.useEffect(() => { fetchRelations() }, [fetchRelations])

  // Search clients
  React.useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      const term = `%${searchQuery}%`
      const { data } = await supabase
        .from('clients')
        .select('id, nom, prenom')
        .or(`nom.ilike.${term},prenom.ilike.${term}`)
        .neq('id', clientId)
        .limit(6)
      setSearchResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, clientId, supabase])

  const handleAdd = async () => {
    if (!selectedClient) return
    setSaving(true)
    const { error } = await supabase.from('client_relations').insert({
      client_id_1: clientId,
      client_id_2: selectedClient.id,
      type_relation: relationType,
    })
    if (!error) {
      await fetchRelations()
      setShowForm(false)
      setSelectedClient(null)
      setSearchQuery('')
      setRelationType('concubinage')
    }
    setSaving(false)
  }

  const handleRemove = async (relationId: string) => {
    await supabase.from('client_relations').delete().eq('id', relationId)
    setRelations(prev => prev.filter(r => r.id !== relationId))
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users size={18} className="text-gray-600" />
            Relations
            {relations.length > 0 && (
              <Badge variant="secondary" className="text-xs">{relations.length}</Badge>
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
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Add form */}
        {showForm && (
          <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-indigo-800">Ajouter une relation</p>
              <button onClick={() => { setShowForm(false); setSelectedClient(null); setSearchQuery('') }} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>

            {!selectedClient ? (
              <div>
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                />
                {searching && <p className="text-xs text-gray-400 mt-1">Recherche...</p>}
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded bg-white max-h-40 overflow-y-auto">
                    {searchResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedClient(c); setSearchQuery(''); setSearchResults([]) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors"
                      >
                        {c.prenom} {c.nom}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                <span className="text-sm font-medium text-gray-900 flex-1">{selectedClient.prenom} {selectedClient.nom}</span>
                <button onClick={() => setSelectedClient(null)} className="text-gray-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            )}

            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
            >
              {RELATION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <button
              onClick={handleAdd}
              disabled={saving || !selectedClient}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Enregistrement...' : 'Ajouter la relation'}
            </button>
          </div>
        )}

        {/* Relations list */}
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-2">Chargement...</p>
        ) : relations.length > 0 ? (
          relations.map(rel => (
            <div key={rel.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 group">
              <Heart size={14} className="text-pink-400 shrink-0" />
              <Link
                href={`/dashboard/clients/${rel.relatedClientId}`}
                className="flex-1 min-w-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-indigo-600 hover:underline truncate">
                    {rel.relatedClientPrenom} {rel.relatedClientNom}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${RELATION_COLORS[rel.typeRelation] || 'bg-gray-100 text-gray-600'}`}>
                    {RELATION_LABELS[rel.typeRelation] || rel.typeRelation}
                  </span>
                </div>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleRemove(rel.id) }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all shrink-0"
                title="Supprimer"
              >
                <X size={12} className="text-red-400" />
              </button>
            </div>
          ))
        ) : (
          !showForm && (
            <p className="text-sm text-gray-400 italic text-center py-3">Aucune relation</p>
          )
        )}
      </CardContent>
    </Card>
  )
}
