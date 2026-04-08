'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  Calendar as CalIcon, ChevronLeft, ChevronRight, FileText, Users, Clock,
} from 'lucide-react'
import Link from 'next/link'

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

interface CalEvent {
  id: string
  date: string
  type: 'operation' | 'signature' | 'entree_relation' | 'facture' | 'relance'
  label: string
  clientNom: string
  produit?: string
  dossierId?: string
}

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  operation: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Opération' },
  signature: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Signature' },
  entree_relation: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Entrée en relation' },
  facture: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Facture' },
  relance: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Relance' },
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

export default function CalendrierPage() {
  const { consultant } = useUser()
  const isManager = consultant?.role === 'manager' || consultant?.role === 'back_office'

  const now = new Date()
  const [year, setYear] = React.useState(now.getFullYear())
  const [month, setMonth] = React.useState(now.getMonth())
  const [events, setEvents] = React.useState<CalEvent[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedDay, setSelectedDay] = React.useState<number | null>(null)
  const [filterType, setFilterType] = React.useState<string>('')

  React.useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      const supabase = createClient()
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${getDaysInMonth(year, month)}`

      const { data: dossiers, error } = await supabase
        .from('v_dossiers_complets')
        .select('id, client_nom, client_prenom, produit_nom, date_operation, date_signature, date_entree_en_relation, date_facture')
        .or(`date_operation.gte.${startDate},date_signature.gte.${startDate},date_entree_en_relation.gte.${startDate},date_facture.gte.${startDate}`)
        .or(`date_operation.lte.${endDate},date_signature.lte.${endDate},date_entree_en_relation.lte.${endDate},date_facture.lte.${endDate}`)

      if (error) {
        console.error('Error fetching calendar data:', error)
        setEvents([])
        setLoading(false)
        return
      }

      const calEvents: CalEvent[] = []
      const inRange = (d: string | null) => {
        if (!d) return false
        return d >= startDate && d <= endDate
      }

      for (const d of (dossiers || [])) {
        const clientNom = `${d.client_prenom || ''} ${d.client_nom || ''}`.trim()
        const produit = d.produit_nom || undefined

        if (inRange(d.date_operation)) {
          calEvents.push({ id: `op-${d.id}`, date: d.date_operation!, type: 'operation', label: `Opération — ${clientNom}`, clientNom, produit, dossierId: d.id! })
        }
        if (inRange(d.date_signature)) {
          calEvents.push({ id: `sig-${d.id}`, date: d.date_signature!, type: 'signature', label: `Signature — ${clientNom}`, clientNom, produit, dossierId: d.id! })
        }
        if (inRange(d.date_entree_en_relation)) {
          calEvents.push({ id: `er-${d.id}`, date: d.date_entree_en_relation!, type: 'entree_relation', label: `Entrée en relation — ${clientNom}`, clientNom, produit, dossierId: d.id! })
        }
        if (inRange(d.date_facture)) {
          calEvents.push({ id: `fac-${d.id}`, date: d.date_facture!, type: 'facture', label: `Facture — ${clientNom}`, clientNom, produit, dossierId: d.id! })
        }
      }

      setEvents(calEvents)
      setLoading(false)
    }
    fetchEvents()
  }, [year, month])

  const filteredEvents = React.useMemo(() => {
    if (!filterType) return events
    return events.filter(e => e.type === filterType)
  }, [events, filterType])

  const eventsByDay = React.useMemo(() => {
    const map: Record<number, CalEvent[]> = {}
    filteredEvents.forEach(e => {
      const day = new Date(e.date).getDate()
      if (!map[day]) map[day] = []
      map[day].push(e)
    })
    return map
  }, [filteredEvents])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const goToday = () => {
    setYear(now.getFullYear())
    setMonth(now.getMonth())
    setSelectedDay(now.getDate())
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : null

  // Stats for the month
  const stats = React.useMemo(() => ({
    operations: filteredEvents.filter(e => e.type === 'operation').length,
    signatures: filteredEvents.filter(e => e.type === 'signature').length,
    factures: filteredEvents.filter(e => e.type === 'facture').length,
    total: filteredEvents.length,
  }), [filteredEvents])

  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendrier</h1>
          <p className="text-gray-600 mt-1">Vue mensuelle des échéances et événements</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-48">
            <option value="">Tous les types</option>
            {Object.entries(EVENT_COLORS).map(([key, v]) => (
              <option key={key} value={key}>{v.label}</option>
            ))}
          </Select>
          <Button variant="outline" onClick={goToday} className="gap-2">
            <CalIcon size={16} /> Aujourd'hui
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><FileText size={16} className="text-blue-500" /> Opérations</div>
          <p className="text-2xl font-bold mt-1">{stats.operations}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><Users size={16} className="text-green-500" /> Signatures</div>
          <p className="text-2xl font-bold mt-1">{stats.signatures}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><Clock size={16} className="text-amber-500" /> Factures</div>
          <p className="text-2xl font-bold mt-1">{stats.factures}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><CalIcon size={16} className="text-indigo-500" /> Total événements</div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </Card>
      </div>

      {/* Calendar + Detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft size={20} />
              </button>
              <CardTitle className="text-xl">
                {MONTH_NAMES[month]} {year}
              </CardTitle>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-96 flex items-center justify-center text-gray-400">Chargement...</div>
            ) : (
              <div>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {/* Empty cells for offset */}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-24 border border-gray-50" />
                  ))}
                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const dayEvents = eventsByDay[day] || []
                    const isToday = day === today
                    const isSelected = day === selectedDay
                    return (
                      <div
                        key={day}
                        className={`h-24 border border-gray-100 p-1 cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50 border-indigo-300' :
                          isToday ? 'bg-blue-50 border-blue-200' :
                          dayEvents.length > 0 ? 'hover:bg-gray-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                      >
                        <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5 overflow-hidden">
                          {dayEvents.slice(0, 3).map(ev => (
                            <div
                              key={ev.id}
                              className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${EVENT_COLORS[ev.type].bg} ${EVENT_COLORS[ev.type].text}`}
                            >
                              {ev.clientNom}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDay
                ? `${selectedDay} ${MONTH_NAMES[month]}`
                : 'Sélectionnez un jour'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDay && (
              <p className="text-gray-400 text-sm">Cliquez sur un jour pour voir les événements</p>
            )}
            {selectedDay && selectedDayEvents.length === 0 && (
              <p className="text-gray-400 text-sm">Aucun événement ce jour</p>
            )}
            {selectedDay && selectedDayEvents.length > 0 && (
              <div className="space-y-3">
                {selectedDayEvents.map(ev => (
                  <div
                    key={ev.id}
                    className={`p-3 rounded-lg ${EVENT_COLORS[ev.type].bg} border border-gray-100`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${EVENT_COLORS[ev.type].dot}`} />
                      <span className={`text-xs font-medium ${EVENT_COLORS[ev.type].text}`}>
                        {EVENT_COLORS[ev.type].label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{ev.clientNom}</p>
                    {ev.produit && <p className="text-xs text-gray-500">{ev.produit}</p>}
                    {ev.dossierId && (
                      <Link
                        href={`/dashboard/dossiers/${ev.dossierId}`}
                        className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
                      >
                        Voir le dossier →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        {Object.entries(EVENT_COLORS).map(([key, v]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${v.dot}`} />
            <span>{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
