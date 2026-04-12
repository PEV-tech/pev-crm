'use client'
import { useState, useEffect } from 'react'
import { Mail, Calendar, ExternalLink, Paperclip, RefreshCw, Plus, FolderOpen, ChevronDown, ChevronUp, Check, X, HelpCircle, Clock, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  clientEmail?: string | null
  clientName: string
  driveUrl?: string | null
  clientId?: string
  currentUserId?: string
  currentUserNom?: string
}

interface GmailMessage {
  id: string; threadId: string; from: string; to: string; subject: string; date: string; snippet: string; hasAttachments: boolean; labelIds: string[]
}

interface Attendee {
  email: string
  displayName: string
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction'
  self: boolean
}

interface CalendarEvent {
  id: string; summary: string; start: string; end: string; htmlLink: string; attendees: Attendee[]; isPast: boolean
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return dateStr }
}

const RESPONSE_STATUS: Record<string, { label: string; color: string; icon: 'check' | 'x' | 'help' | 'clock' }> = {
  accepted: { label: 'Accepté', color: 'text-green-600', icon: 'check' },
  declined: { label: 'Refusé', color: 'text-red-500', icon: 'x' },
  tentative: { label: 'Peut-être', color: 'text-amber-500', icon: 'help' },
  needsAction: { label: 'En attente', color: 'text-gray-400', icon: 'clock' },
}

function ResponseIcon({ status }: { status: string }) {
  const info = RESPONSE_STATUS[status] || RESPONSE_STATUS.needsAction
  const iconClass = `w-3 h-3 ${info.color}`
  switch (info.icon) {
    case 'check': return <Check className={iconClass} />
    case 'x': return <X className={iconClass} />
    case 'help': return <HelpCircle className={iconClass} />
    case 'clock': return <Clock className={iconClass} />
  }
}

export default function CommunicationsTab({ clientEmail, clientName, driveUrl, clientId, currentUserId, currentUserNom }: Props) {
  const [tab, setTab] = useState<'emails' | 'rdv'>('emails')
  const [emails, setEmails] = useState<GmailMessage[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null)
  const [showAllEmails, setShowAllEmails] = useState(false)
  const [importingEmailIds, setImportingEmailIds] = useState<Set<string>>(new Set())
  const [importedEmailIds, setImportedEmailIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const supabase = createClient()
  const lastName = clientName?.split(' ').pop() || clientName

  async function importEmailToJournal(message: GmailMessage) {
    if (!clientId || !currentUserNom) return
    if (importingEmailIds.has(message.id)) return

    setImportingEmailIds(prev => new Set(prev).add(message.id))

    try {
      // Format the email content
      const contenu = `**Objet:** ${message.subject || '(sans objet)'}\n**De:** ${message.from}\n**Date:** ${formatDate(message.date)}\n\n${message.snippet}`

      // Insert into client_commentaires
      const { error } = await supabase.from('client_commentaires').insert({
        client_id: clientId,
        auteur_id: currentUserId || null,
        auteur_nom: currentUserNom,
        type_etiquette: 'email',
        contenu: contenu,
      })

      if (error) {
        setToast({ message: 'Erreur lors de l\'import', type: 'error' })
        console.error('Import error:', error)
      } else {
        setImportedEmailIds(prev => new Set(prev).add(message.id))
        setToast({ message: 'Email importé au journal de suivi', type: 'success' })
        setTimeout(() => setToast(null), 3000)
      }
    } catch (err) {
      setToast({ message: 'Erreur lors de l\'import', type: 'error' })
      console.error('Import error:', err)
    } finally {
      setImportingEmailIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(message.id)
        return newSet
      })
    }
  }

  async function loadEmails() {
    if (!clientEmail) return
    setEmailsLoading(true)
    try {
      const r = await fetch(`/api/google/gmail?email=${encodeURIComponent(clientEmail)}`)
      const d = await r.json()
      if (d.connected === false) { setGoogleConnected(false); return }
      setGoogleConnected(true)
      setEmails(d.messages || [])
    } finally { setEmailsLoading(false) }
  }

  async function loadEvents() {
    setEventsLoading(true)
    try {
      const params = new URLSearchParams()
      if (lastName) params.set('name', lastName)
      if (clientEmail) params.set('email', clientEmail)
      const r = await fetch(`/api/google/calendar?${params.toString()}`)
      const d = await r.json()
      if (d.connected === false) { setGoogleConnected(false); return }
      setGoogleConnected(true)
      setEvents(d.events || [])
    } finally { setEventsLoading(false) }
  }

  useEffect(() => { loadEmails() }, [clientEmail])
  useEffect(() => { if (tab === 'rdv') loadEvents() }, [tab])

  const gmailThreadUrl = (msg: GmailMessage) =>
    `https://mail.google.com/mail/u/0/#inbox/${msg.threadId}`

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

  const visibleEmails = showAllEmails ? emails : emails.slice(0, 3)
  const hasMoreEmails = emails.length > 3

  // Split events into upcoming and past
  const upcomingEvents = events.filter(e => !e.isPast)
  const pastEvents = events.filter(e => e.isPast)

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

        {/* EMAILS TAB */}
        {tab==='emails'&&(
          <div>
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">{clientEmail||'Aucun email renseigné'}</span>
              <button onClick={loadEmails} disabled={emailsLoading} className="text-gray-400 hover:text-gray-600"><RefreshCw className={`w-4 h-4 ${emailsLoading?'animate-spin':''}`}/></button>
            </div>
            {!clientEmail?<div className="p-8 text-center text-gray-400 text-sm">Email du client non renseigné</div>
            :emailsLoading?<div className="p-8 text-center text-gray-400 text-sm">Chargement...</div>
            :emails.length===0?<div className="p-8 text-center text-gray-400 text-sm">Aucun email trouvé avec {clientEmail}</div>
            :<div>
              <div className="divide-y divide-gray-100">
                {visibleEmails.map(m=>(
                  <div
                    key={m.id}
                    className="p-4 hover:bg-blue-50/50 transition-colors group flex items-start justify-between gap-2"
                  >
                    <a
                      href={gmailThreadUrl(m)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 block cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.labelIds.includes('UNREAD')?'bg-blue-500':'bg-gray-200'}`}/>
                        <span className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">{m.subject||'(sans objet)'}</span>
                        {m.hasAttachments&&<Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0"/>}
                        <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate">{m.from}</div>
                      <div className="text-xs text-gray-400 mt-1 line-clamp-1">{m.snippet}</div>
                    </a>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{formatDate(m.date)}</span>
                      {clientId && currentUserNom && (
                        <button
                          onClick={() => importEmailToJournal(m)}
                          disabled={importingEmailIds.has(m.id) || importedEmailIds.has(m.id)}
                          title={importedEmailIds.has(m.id) ? 'Email importé' : 'Importer au journal'}
                          className={`p-1.5 rounded transition-colors flex-shrink-0 ${
                            importedEmailIds.has(m.id)
                              ? 'bg-green-100 text-green-600'
                              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                          } ${importingEmailIds.has(m.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {hasMoreEmails && (
                <button
                  onClick={() => setShowAllEmails(!showAllEmails)}
                  className="w-full py-2.5 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 flex items-center justify-center gap-1 transition-colors"
                >
                  {showAllEmails ? (
                    <><ChevronUp className="w-4 h-4" />Réduire</>
                  ) : (
                    <><ChevronDown className="w-4 h-4" />Voir les {emails.length - 3} autres emails</>
                  )}
                </button>
              )}
            </div>}
          </div>
        )}

        {/* CALENDAR TAB */}
        {tab==='rdv'&&(
          <div>
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">Recherche: &quot;{lastName}&quot;{clientEmail ? ` / ${clientEmail}` : ''}</span>
              <button onClick={loadEvents} disabled={eventsLoading} className="text-gray-400 hover:text-gray-600"><RefreshCw className={`w-4 h-4 ${eventsLoading?'animate-spin':''}`}/></button>
            </div>
            {eventsLoading?<div className="p-8 text-center text-gray-400 text-sm">Chargement...</div>
            :events.length===0?<div className="p-8 text-center text-gray-400 text-sm">Aucun RDV trouvé pour &quot;{lastName}&quot;</div>
            :<div>
              {/* Upcoming events */}
              {upcomingEvents.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-green-50 border-b border-green-100">
                    <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">À venir ({upcomingEvents.length})</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {upcomingEvents.map(e=>(
                      <div key={e.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500"/>
                              <span className="text-sm font-medium text-gray-900">{e.summary}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{formatDate(e.start)}</div>
                            {/* Attendees with response status */}
                            {e.attendees && e.attendees.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {e.attendees.filter(a => !a.self).map((a, i) => {
                                  const status = RESPONSE_STATUS[a.responseStatus] || RESPONSE_STATUS.needsAction
                                  return (
                                    <div key={i} className="flex items-center gap-1.5 text-xs">
                                      <ResponseIcon status={a.responseStatus} />
                                      <span className="text-gray-600">{a.displayName || a.email}</span>
                                      <span className={`${status.color} font-medium`}>· {status.label}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <a href={e.htmlLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 flex-shrink-0 p-1"><ExternalLink className="w-4 h-4"/></a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Past events */}
              {pastEvents.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 border-t">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Passés ({pastEvents.length})</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {[...pastEvents].reverse().map(e=>(
                      <div key={e.id} className="p-4 hover:bg-gray-50 opacity-60">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300"/>
                              <span className="text-sm font-medium text-gray-900">{e.summary}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{formatDate(e.start)}</div>
                            {e.attendees && e.attendees.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {e.attendees.filter(a => !a.self).map((a, i) => {
                                  const status = RESPONSE_STATUS[a.responseStatus] || RESPONSE_STATUS.needsAction
                                  return (
                                    <div key={i} className="flex items-center gap-1.5 text-xs">
                                      <ResponseIcon status={a.responseStatus} />
                                      <span className="text-gray-600">{a.displayName || a.email}</span>
                                      <span className={`${status.color} font-medium`}>· {status.label}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <a href={e.htmlLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 flex-shrink-0 p-1"><ExternalLink className="w-4 h-4"/></a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>}
          </div>
        )}
      </div>
      {!driveUrl&&(
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 text-center">
          <a href="/api/google/auth" className="text-blue-600 text-sm hover:text-blue-700 flex items-center justify-center gap-1"><Plus className="w-3 h-3"/>Connecter Google pour accéder aux emails et RDV</a>
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
