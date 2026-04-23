// test'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonText } from '@/components/shared/skeleton'
import { History, Plus, Pencil, Trash2 } from 'lucide-react'

interface AuditLog {
  id: string
  user_id: string | null
  user_nom: string | null
  action: 'create' | 'update' | 'delete'
  table_name: string
  record_id: string
  details: any
  created_at: string
}

interface DossierHistoryProps {
  dossierId: string
}

const ACTION_META: Record<AuditLog['action'], { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'success' | 'destructive' }> = {
  create: { label: 'Création', icon: <Plus size={12} />, variant: 'success' },
  update: { label: 'Modification', icon: <Pencil size={12} />, variant: 'secondary' },
  delete: { label: 'Suppression', icon: <Trash2 size={12} />, variant: 'destructive' },
}

// Champs qu'on affiche dans le diff, avec label FR
const FIELD_LABELS: Record<string, string> = {
  statut: 'Stade relationnel',
  montant: 'Montant',
  produit_id: 'Produit',
  produit_nom: 'Produit',
  compagnie_id: 'Compagnie',
  compagnie_nom: 'Compagnie',
  financement: 'Financement',
  mode_detention: 'Mode de détention',
  date_entree_relation: 'Date entrée en relation',
  date_realisation: 'Date de réalisation',
  commentaire: 'Commentaire',
  pays: 'Pays',
  ville: 'Ville',
  email: 'Email',
  telephone: 'Téléphone',
  consultant_id: 'Consultant',
  facturee: 'Facturée',
  date_facture: 'Date facture',
  payee: 'Payée',
  taux_entree: 'Taux entrée',
  taux_encours: 'Taux encours',
}

// Champs qu'on ignore dans le diff (bruit, timestamps, etc.)
const IGNORED_FIELDS = new Set(['id', 'created_at', 'updated_at'])

const formatValue = (v: any): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (typeof v === 'number') return String(v)
  return String(v)
}

const formatDateTime = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))

function diffEntries(oldRow: any, newRow: any): Array<{ field: string; before: any; after: any }> {
  if (!oldRow || !newRow) return []
  const out: Array<{ field: string; before: any; after: any }> = []
  const keys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)])
  for (const k of keys) {
    if (IGNORED_FIELDS.has(k)) continue
    if (JSON.stringify(oldRow[k]) !== JSON.stringify(newRow[k])) {
      out.push({ field: k, before: oldRow[k], after: newRow[k] })
    }
  }
  return out
}

export function DossierHistory({ dossierId }: DossierHistoryProps) {
  const [logs, setLogs] = React.useState<AuditLog[] | null>(null)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const supabase = React.useMemo(() => createClient(), [])

  const fetchLogs = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'dossiers')
      .eq('record_id', dossierId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      // Silent fallback : soit RLS ne laisse pas voir (consultant non-manager), soit autre souci
      setLogs([])
      return
    }
    // Déduplication : plusieurs triggers audit peuvent loguer la même ligne à la milliseconde près
    const seen = new Set<string>()
    const deduped = ((data as AuditLog[]) || []).filter((l) => {
      const key = `${l.action}|${new Date(l.created_at).getTime()}|${JSON.stringify(l.details?.new || l.details || {})}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setLogs(deduped)
  }, [dossierId, supabase])

  React.useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History size={18} className="text-gray-500" />
          Historique
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs === null ? (
          <SkeletonText lines={3} />
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun événement journalisé.</p>
        ) : (
          <ul className="space-y-3">
            {logs.map((log) => {
              const meta = ACTION_META[log.action] || ACTION_META.update
              const changes = log.action === 'update' ? diffEntries(log.details?.old, log.details?.new) : []
              const isExpanded = expandedId === log.id
              const hasChanges = changes.length > 0
              return (
                <li key={log.id} className="border-l-2 border-gray-200 pl-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={meta.variant} className="flex items-center gap-1">
                          {meta.icon}
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-gray-500">{formatDateTime(log.created_at)}</span>
                        {log.user_nom && (
                          <span className="text-xs text-gray-700">par {log.user_nom}</span>
                        )}
                      </div>
                      {log.action === 'update' && hasChanges && (
                        <div className="mt-1 text-xs text-gray-600">
                          {isExpanded ? (
                            <div className="space-y-1 mt-1">
                              {changes.map((c) => (
                                <div key={c.field} className="flex flex-wrap items-baseline gap-1">
                                  <span className="font-medium text-gray-700">{FIELD_LABELS[c.field] || c.field} :</span>
                                  <span className="line-through text-gray-400">{formatValue(c.before)}</span>
                                  <span className="text-gray-500">→</span>
                                  <span className="font-medium text-gray-900">{formatValue(c.after)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span>
                              {changes.length} champ{changes.length > 1 ? 's' : ''} modifié{changes.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                      {log.action === 'update' && !hasChanges && (
                        <p className="mt-1 text-xs text-gray-400 italic">Aucun changement significatif</p>
                      )}
                    </div>
                    {log.action === 'update' && hasChanges && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 shrink-0"
                      >
                        {isExpanded ? 'Masquer' : 'Détail'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
