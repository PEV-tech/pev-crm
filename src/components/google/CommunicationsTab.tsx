'use client'
import { useState, useEffect } from 'react'
import { Mail, Calendar, ExternalLink, Paperclip, RefreshCw, Plus, FolderOpen } from 'lucide-react'

interface Props {
  clientEmail?: string | null
  clientName: string
  driveUrl?: string | null
}

interface GmailMessage {
  id: string; from: string; to: string; subject: string; date: string; snippet: string; hasAttachments: boolean; labelIds: string[]
}
interface CalendarEvent {
  id: string; summary: string; start: string; end: string; htmlLink: string; attendees: number; isPast: boolean
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return dateStr }
}

export default function CommunicationsTab({ clientEmail, clientName, driveUrl }: Props) {
  const [tab, setTab] = useState<'emails' | 'rdv'>('emails')
  const [emails, setEmails] = useState<GmailMessage[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null)
  const lastName = clientName?.split(' ').pop() || clientName

  async function loadEmails() {
    if (!clientEmail) return
    setEmailsLoading(true)
    try {
      const r = await fetch(`/api/google/gmail?email=${encodeURIComponent(clientEmail)}`)
      const d = await r.json()
      if (d.connected === false) { setGoogleConnected(false); return }
      setGoogleConnected(true)
      setEmails(d.messages || [])
    } catch(e) { console.error(e) } finally { setEmailsLoading(false) }
  }

  async function loadEvents() {
    setEventsLoading(true)
    try {
      const r = await fetch(`/api/google/calendar?name=${encodeURIComponent(lastName)}`)
      const d = await r.json()
      if (d.connected === false) { setGoogleConnected(false); return }
      setGoogleConnected(true)
      setEvents(d.events || [])
    } catch(e) { console.error(e) } finally { setEventsLoading(false) }
  }

  useEffect(() => { loadEmails() }, [clientEmail])
  useEffect(() => { if (tab === 'rdv') loadEvents() }, [tab])

  if (googleConnected === false) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <Mail className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="text-amber-800 font-medium mb-2">Google non connecté</p>
        <p className="text-amber-600 text-sm mb-4">Connectez votre compte Google pour voir les emails et RDV.</p>
        <a href="/api/google/auth" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700 transition-colors">Connecter Google</a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {driveUrl && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <FolderOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex-1 truncate">{driveUrl}</a>
          <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1 flex-shrink-0"><ExternalLink className="w-3 h-3"/>Ouvrir Drive</a>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button onClick={()=>setTab('emails')} className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${tab==='emails'?'text-blue-600 border-b-2 border-blue-600 bg-blue-50':'text-gray-500 hover:text-gray-700'}`}>
            <Mail className="w-4 h-4"/>Emails{emails.length>0&&<span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{emails.length}</span>}
          </button>
          <button onClick={()=>setTab('rdv')} className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${tab==='rdv'?'text-blue-600 border-b-2 border-blue-600 bg-blue-50':'text-gray-500 hover:text-gray-700'}`}>
            <Calendar className="w-4 h-4"/>RDV Calendar{events.length>0&&<span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{events.length}</span>}
          </button>
        </div>
        {tab==='emails'&&(
          <div>
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">{clientEmail||'Aucun email renseigné'}</span>
              <button onClick={loadEmails} disabled={emailsLoading} className="text-gray-400 hover:text-gray-600"><RefreshCw className={`w-4 h-4 ${emailsLoading?'animate-spin':''}`}/></button>
            </div>
            {!clientEmail?<div className="p-8 text-center text-gray-400 text-sm">Email du client non renseigné</div>
            :emailsLoading?<div className="p-8 text-center text-gray-400 text-sm">Chargement...</div>
            :emails.length===0?<div className="p-8 text-center text-gray-400 text-sm">Aucun email trouvé avec {clientEmail}</div>
            :<div className="divide-y divide-gray-100">{emails.map(m=>(
              <div key={m.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.labelIds.includes('UNREAD')?'bg-blue-500':'bg-gray-200'}`}/>
                      <span className="text-sm font-medium text-gray-900 truncate">{m.subject||'(sans objet)'}</span>
                      {m.hasAttachments&&<Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0"/>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">{m.from}</div>
                    <div className="text-xs text-gray-400 mt-1 line-clamp-1">{m.snippet}</div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(m.date)}</span>
                </div>
              </div>
            ))}</div>}
          </div>
        )}
        {tab==='rdv'&&(
          <div>
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">Recherche: "{lastName}"</span>
              <button onClick={loadEvents} disabled={eventsLoading} className="text-gray-400 hover:text-gray-600"><RefreshCw className={`w-4 h-4 ${eventsLoading?'animate-spin':''}`}/></button>
            </div>
            {eventsLoading?<div className="p-8 text-center text-gray-400 text-sm">Chargement...</div>
            :events.length===0?<div className="p-8 text-center text-gray-400 text-sm">Aucun RDV trouvé pour "{lastName}"</div>
            :<div className="divide-y divide-gray-100">{[...events].sort((a,b)=>new Date(b.start).getTime()-new Date(a.start).getTime()).map(e=>(
              <div key={e.id} className={`p-4 hover:bg-gray-50 ${e.isPast?'opacity-60':''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${e.isPast?'bg-gray-300':'bg-green-500'}`}/>
                      <span className="text-sm font-medium text-gray-900">{e.summary}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{formatDate(e.start)}</div>
                    {e.attendees>0&&<div className="text-xs text-gray-400 mt-0.5">{e.attendees} participant(s)</div>}
                  </div>
                  <a href={e.htmlLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 flex-shrink-0"><ExternalLink className="w-4 h-4"/></a>
                </div>
              </div>
            ))}</div>}
          </div>
        )}
      </div>
      {!driveUrl&&(
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 text-center">
          <a href="/api/google/auth" className="text-blue-600 text-sm hover:text-blue-700 flex items-center justify-center gap-1"><Plus className="w-3 h-3"/>Connecter Google pour accéder aux emails et RDV</a>
        </div>
      )}
    </div>
  )
}
