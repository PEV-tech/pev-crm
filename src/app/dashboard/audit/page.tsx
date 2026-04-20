'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRole } from '@/hooks/use-user'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

interface AuditLog {
  id: string
  user_id: string | null
  user_nom: string | null
  action: string
  table_name: string
  record_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const ITEMS_PER_PAGE = 25

export default function AuditLogsPage() {
  const router = useRouter()
  const role = useRole()

  // Gate access: only managers and back_office can access
  const isAuthorized = role === 'manager' || role === 'back_office'

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [filterTable, setFilterTable] = useState<string>('all')
  const [filterUser, setFilterUser] = useState<string>('all')

  // Listes distinctes alimentant les selects (chargées 1×, pas paginées)
  const [tableOptions, setTableOptions] = useState<string[]>([])
  const [userOptions, setUserOptions] = useState<string[]>([])

  // Export CSV
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Chargement 1× des listes distinctes (tables et utilisateurs) pour les
  // selects. Limité à 5000 lignes récentes — suffisant pour peupler les
  // valeurs présentes en pratique sans payload excessif.
  useEffect(() => {
    if (!isAuthorized) return
    let cancelled = false

    async function loadOptions() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('audit_logs')
        .select('table_name, user_nom')
        .order('created_at', { ascending: false })
        .limit(5000)

      if (cancelled || error || !data) return

      const tables = new Set<string>()
      const users = new Set<string>()
      for (const row of data as Array<{ table_name: string | null; user_nom: string | null }>) {
        if (row.table_name) tables.add(row.table_name)
        if (row.user_nom) users.add(row.user_nom)
      }
      setTableOptions(Array.from(tables).sort())
      setUserOptions(Array.from(users).sort((a, b) => a.localeCompare(b, 'fr')))
    }

    loadOptions()
    return () => {
      cancelled = true
    }
  }, [isAuthorized])

  useEffect(() => {
    if (!isAuthorized) {
      router.push('/dashboard')
      return
    }

    async function loadAuditLogs() {
      setLoading(true)
      setLoadError(null)
      const supabase = createClient()

      try {
        // Build query with filters
        let query = supabase
          .from('audit_logs')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })

        // Apply action filter
        if (filterAction !== 'all') {
          query = query.eq('action', filterAction)
        }

        // Apply table filter
        if (filterTable !== 'all') {
          query = query.eq('table_name', filterTable)
        }

        // Apply user filter
        if (filterUser !== 'all') {
          query = query.eq('user_nom', filterUser)
        }

        // Apply date filters
        if (filterDateFrom) {
          query = query.gte('created_at', `${filterDateFrom}T00:00:00`)
        }
        if (filterDateTo) {
          query = query.lte('created_at', `${filterDateTo}T23:59:59`)
        }

        // Apply pagination
        const from = (currentPage - 1) * ITEMS_PER_PAGE
        const to = from + ITEMS_PER_PAGE - 1
        query = query.range(from, to)

        const { data, count, error } = await query

        if (error) {
          setLoadError('Chargement des logs impossible : ' + error.message)
          setLogs([])
          setTotalCount(0)
        } else {
          setLogs((data as AuditLog[]) || [])
          setTotalCount(count || 0)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'erreur inconnue'
        setLoadError('Chargement des logs impossible : ' + msg)
        setLogs([])
        setTotalCount(0)
      } finally {
        setLoading(false)
      }
    }

    loadAuditLogs()
  }, [isAuthorized, currentPage, filterAction, filterTable, filterUser, filterDateFrom, filterDateTo, router])

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Accès refusé</h1>
          <p className="text-gray-600 mt-2">Seuls les gestionnaires peuvent accéder aux journaux d'audit.</p>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const getActionBadge = (action: string) => {
    const variants: Record<string, string> = {
      create: 'success',
      update: 'warning',
      delete: 'destructive',
    }
    const labels: Record<string, string> = {
      create: 'Création',
      update: 'Modification',
      delete: 'Suppression',
    }
    const variant = (variants[action] || 'default') as 'success' | 'warning' | 'destructive' | 'default'
    return <Badge variant={variant}>{labels[action] || action}</Badge>
  }

  const handleResetFilters = () => {
    setFilterAction('all')
    setFilterTable('all')
    setFilterUser('all')
    setFilterDateFrom('')
    setFilterDateTo('')
    setCurrentPage(1)
  }

  const hasActiveFilters =
    filterAction !== 'all' ||
    filterTable !== 'all' ||
    filterUser !== 'all' ||
    filterDateFrom !== '' ||
    filterDateTo !== ''

  // Échappement CSV RFC 4180 : entourer de " si le champ contient ", ; ou \n
  // et doubler les " internes.
  const csvCell = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    if (/[";\n\r]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  // Export CSV : rejoue la requête avec les mêmes filtres (sans pagination),
  // plafonne à 10 000 lignes par précaution, puis déclenche un download via
  // blob URL. On utilise ';' comme séparateur (Excel FR par défaut) et on
  // ajoute le BOM UTF-8 pour que les accents s'affichent correctement.
  const handleExportCsv = async () => {
    setExporting(true)
    setExportError(null)
    const supabase = createClient()
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000)

      if (filterAction !== 'all') query = query.eq('action', filterAction)
      if (filterTable !== 'all') query = query.eq('table_name', filterTable)
      if (filterUser !== 'all') query = query.eq('user_nom', filterUser)
      if (filterDateFrom) query = query.gte('created_at', `${filterDateFrom}T00:00:00`)
      if (filterDateTo) query = query.lte('created_at', `${filterDateTo}T23:59:59`)

      const { data, error } = await query

      if (error) {
        setExportError('Export impossible : ' + error.message)
        return
      }

      const rows = (data as AuditLog[]) || []
      const headers = [
        'Date/Heure',
        'Utilisateur',
        'User ID',
        'Action',
        'Table',
        'ID du dossier',
        'Détails',
      ]
      const lines = [headers.map(csvCell).join(';')]
      for (const log of rows) {
        lines.push(
          [
            new Date(log.created_at).toLocaleString('fr-FR'),
            log.user_nom || 'Système',
            log.user_id || '',
            log.action,
            log.table_name,
            log.record_id || '',
            log.details ? JSON.stringify(log.details) : '',
          ]
            .map(csvCell)
            .join(';')
        )
      }

      const csv = '\uFEFF' + lines.join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      a.href = url
      a.download = `audit-logs-${stamp}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erreur inconnue'
      setExportError('Export impossible : ' + msg)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Journaux d'audit</h1>
        <p className="text-gray-600 mt-1">Historique des modifications apportées aux données du CRM</p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Filtres</CardTitle>
              <CardDescription>Affinez votre recherche</CardDescription>
            </div>
            <button
              onClick={handleExportCsv}
              disabled={exporting || totalCount === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter les résultats filtrés au format CSV (max 10 000 lignes)"
            >
              <Download size={16} />
              {exporting ? 'Export…' : 'Exporter CSV'}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {exportError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {exportError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type d'action</label>
              <select
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous</option>
                <option value="create">Création</option>
                <option value="update">Modification</option>
                <option value="delete">Suppression</option>
              </select>
            </div>

            {/* Table Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Table</label>
              <select
                value={filterTable}
                onChange={(e) => {
                  setFilterTable(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Toutes</option>
                {tableOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* User Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Utilisateur</label>
              <select
                value={filterUser}
                onChange={(e) => {
                  setFilterUser(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous</option>
                {userOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de début</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => {
                  setFilterDateFrom(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date To Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => {
                  setFilterDateTo(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <div className="flex items-end lg:col-span-5">
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Logs d'audit
            {totalCount > 0 && <span className="text-gray-500 font-normal ml-2">({totalCount} entrées)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {loadError}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <p className="text-gray-500">Chargement...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex justify-center py-12">
              <p className="text-gray-500">Aucun journal d'audit trouvé</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Date/Heure</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>ID du dossier</TableHead>
                      <TableHead>Détails</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs text-gray-600">
                          {new Date(log.created_at).toLocaleString('fr-FR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{log.user_nom || 'Système'}</div>
                            {log.user_id && (
                              <div className="text-xs text-gray-500 font-mono">{log.user_id.substring(0, 8)}...</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="text-sm text-gray-700">{log.table_name}</TableCell>
                        <TableCell className="font-mono text-xs text-gray-600">
                          {log.record_id ? log.record_id.substring(0, 8) + '...' : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {log.details ? (
                            <details className="cursor-pointer">
                              <summary className="text-blue-600 hover:underline">Voir détails</summary>
                              <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-48">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} sur {totalPages}
                    {totalCount > 0 && ` (${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} sur ${totalCount})`}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                      Précédent
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
