'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import Link from 'next/link'
import {
  ArrowLeft, User, FileText, Shield, TrendingUp,
  MapPin, Calendar, DollarSign, CheckCircle,
  Mail, Phone, CreditCard, FolderOpen, ExternalLink, Plus, Send, Clock, Pencil, Save, X,
  Paperclip, Upload, Trash2,
} from 'lucide-react'
import { ClientRelances } from '@/components/shared/client-relances'
import { JournalSuivi } from '@/components/shared/journal-suivi'
import { ClientRelations } from '@/components/shared/client-relations'
import CommunicationsTab from '@/components/google/CommunicationsTab'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

interface ClientDossier {
  id: string
  statut: string
  montant: number | null
  produit_nom: string | null
  compagnie_nom: string | null
  financement: string | null
  date_operation: string | null
  commission_brute: number | null
  rem_apporteur: number | null
  facturee: boolean | null
  payee: string | null
  consultant_prenom: string | null
  consultant_nom: string | null
  taux_commission: number | null
  produit_categorie: string | null
}

interface ClientInfo {
  id: string
  nom: string
  prenom: string | null
  pays: string
  email: string | null
  telephone: string | null
  numero_compte: string | null
  conformite: string | null
  statut_kyc: string
  der: boolean
  pi: boolean
  preco: boolean
  lm: boolean
  rm: boolean
  created_at: string
  commentaires?: string | null
  google_drive_url?: string | null
}

interface RendezVous {
  id: string
  client_id: string
  date_rdv: string
  type: string
  notes: string | null
  created_at: string
}

const RDV_TYPE_LABELS: Record<string, string> = {
  rdv: 'RDV',
  appel: 'Appel',
  visio: 'Visio',
  signature: 'Signature',
  autre: 'Autre',
}

function GoogleSuiteCard({
  clientId,
  clientName,
  clientEmail,
  supabase,
}: {
  clientId: string
  clientName: string
  clientEmail: string | null
  supabase: ReturnType<typeof createClient>
}) {
  const [rdvList, setRdvList] = React.useState<RendezVous[]>([])
  const [showForm, setShowForm] = React.useState(false)
  const [rdvDate, setRdvDate] = React.useState('')
  const [rdvTime, setRdvTime] = React.useState('10:00')
  const [rdvType, setRdvType] = React.useState('rdv')
  const [rdvNotes, setRdvNotes] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [loadingRdv, setLoadingRdv] = React.useState(true)

  const driveSearchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(clientName)}`
  const gmailComposeUrl = clientEmail
    ? `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(clientEmail)}&su=${encodeURIComponent(`PEV - ${clientName}`)}`
    : null

  // Fetch RDVs for this client
  React.useEffect(() => {
    const fetchRdvs = async () => {
      const { data } = await supabase
        .from('rendez_vous')
        .select('*')
        .eq('client_id', clientId)
        .order('date_rdv', { ascending: true })
      setRdvList(data || [])
      setLoadingRdv(false)
    }
    fetchRdvs()
  }, [clientId, supabase])

  const now = new Date()
  const prochainRdv = rdvList.find(r => new Date(r.date_rdv) >= now) || null
  const dernierRdv = [...rdvList].reverse().find(r => new Date(r.date_rdv) < now) || null

  const handleCreateRdv = async () => {
    if (!rdvDate || !rdvTime) return
    setSaving(true)
    const dateRdv = `${rdvDate}T${rdvTime}:00`
    const { error } = await supabase.from('rendez_vous').insert({
      client_id: clientId,
      date_rdv: dateRdv,
      type: rdvType,
      notes: rdvNotes || null,
    })
    if (!error) {
      // Refresh list
      const { data } = await supabase
        .from('rendez_vous')
        .select('*')
        .eq('client_id', clientId)
        .order('date_rdv', { ascending: true })
      setRdvList(data || [])
      // Open Google Calendar with the event
      const endTime = new Date(`${rdvDate}T${rdvTime}:00`)
      endTime.setHours(endTime.getHours() + 1)
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
      const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${RDV_TYPE_LABELS[rdvType]} - ${clientName}`)}&dates=${fmt(new Date(`${rdvDate}T${rdvTime}:00`))}/${fmt(endTime)}&details=${encodeURIComponent(`${RDV_TYPE_LABELS[rdvType]} client : ${clientName}${rdvNotes ? '\n' + rdvNotes : ''}`)}`
      window.open(calUrl, '_blank')
      // Reset form
      setShowForm(false)
      setRdvDate('')
      setRdvTime('10:00')
      setRdvType('rdv')
      setRdvNotes('')
    }
    setSaving(false)
  }

  const handleDeleteRdv = async (id: string) => {
    await supabase.from('rendez_vous').delete().eq('id', id)
    setRdvList(prev => prev.filter(r => r.id !== id))
  }

  const formatRdvDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ExternalLink size={18} className="text-gray-600" />
          Google Suite
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Prochain / Dernier RDV */}
        {!loadingRdv && (
          <div className="space-y-2 pb-2 border-b border-gray-100">
            <div className="flex items-start gap-2">
              <div className="bg-green-100 p-1 rounded">
                <Clock size={12} className="text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Prochain RDV</p>
                {prochainRdv ? (
                  <div>
                    <p className="text-sm font-medium text-green-700">{formatRdvDate(prochainRdv.date_rdv)}</p>
                    <p className="text-xs text-gray-500">{RDV_TYPE_LABELS[prochainRdv.type] || prochainRdv.type}{prochainRdv.notes ? ` · ${prochainRdv.notes}` : ''}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Aucun RDV prévu</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-gray-100 p-1 rounded">
                <Clock size={12} className="text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dernier RDV</p>
                {dernierRdv ? (
                  <div>
                    <p className="text-sm font-medium text-gray-700">{formatRdvDate(dernierRdv.date_rdv)}</p>
                    <p className="text-xs text-gray-500">{RDV_TYPE_LABELS[dernierRdv.type] || dernierRdv.type}{dernierRdv.notes ? ` · ${dernierRdv.notes}` : ''}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Aucun RDV passé</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* New RDV button / form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50/50 transition-colors group text-left"
          >
            <div className="bg-green-100 p-1.5 rounded-md">
              <Calendar size={16} className="text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 group-hover:text-green-700">Nouveau rendez-vous</p>
              <p className="text-xs text-gray-500">Enregistrer + Google Agenda</p>
            </div>
            <Plus size={14} className="text-gray-400 group-hover:text-green-500" />
          </button>
        ) : (
          <div className="p-3 rounded-lg border border-green-200 bg-green-50/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-green-800">Nouveau RDV</p>
              <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-700">Annuler</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={rdvDate}
                onChange={e => setRdvDate(e.target.value)}
                className="col-span-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-400 focus:border-green-400"
              />
              <input
                type="time"
                value={rdvTime}
                onChange={e => setRdvTime(e.target.value)}
                className="col-span-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-400 focus:border-green-400"
              />
            </div>
            <select
              value={rdvType}
              onChange={e => setRdvType(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-400 focus:border-green-400"
            >
              <option value="rdv">RDV en personne</option>
              <option value="visio">Visio</option>
              <option value="appel">Appel téléphonique</option>
              <option value="signature">Signature</option>
              <option value="autre">Autre</option>
            </select>
            <input
              type="text"
              placeholder="Notes (optionnel)"
              value={rdvNotes}
              onChange={e => setRdvNotes(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-400 focus:border-green-400"
            />
            <button
              onClick={handleCreateRdv}
              disabled={saving || !rdvDate}
              className="w-full py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Enregistrement...' : 'Créer RDV + ouvrir Agenda'}
            </button>
          </div>
        )}

        {/* Upcoming RDVs list */}
        {rdvList.filter(r => new Date(r.date_rdv) >= now).length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">RDV à venir</p>
            {rdvList.filter(r => new Date(r.date_rdv) >= now).map(r => (
              <div key={r.id} className="flex items-center justify-between p-1.5 rounded bg-green-50/50 text-xs">
                <span className="text-gray-700">{formatRdvDate(r.date_rdv)} · {RDV_TYPE_LABELS[r.type] || r.type}</span>
                <button onClick={() => handleDeleteRdv(r.id)} className="text-gray-400 hover:text-red-500 text-[10px]">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Google Drive */}
        <a
          href={driveSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors group"
        >
          <div className="bg-yellow-100 p-1.5 rounded-md">
            <FolderOpen size={16} className="text-yellow-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700">Google Drive</p>
            <p className="text-xs text-gray-500">Rechercher le dossier client</p>
          </div>
          <ExternalLink size={14} className="text-gray-400 group-hover:text-blue-500" />
        </a>

        {/* Gmail */}
        {gmailComposeUrl ? (
          <a
            href={gmailComposeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-colors group"
          >
            <div className="bg-red-100 p-1.5 rounded-md">
              <Send size={16} className="text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 group-hover:text-red-700">Envoyer un email</p>
              <p className="text-xs text-gray-500 truncate">{clientEmail}</p>
            </div>
            <ExternalLink size={14} className="text-gray-400 group-hover:text-red-500" />
          </a>
        ) : (
          <div className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-gray-50">
            <div className="bg-gray-200 p-1.5 rounded-md">
              <Send size={16} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Envoyer un email</p>
              <p className="text-xs text-gray-400 italic">Email non renseigné</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const PJ_TYPES = [
  { value: 'piece_identite', label: 'Pièce d\'identité' },
  { value: 'rib', label: 'RIB' },
  { value: 'justificatif_domicile', label: 'Justificatif domicile' },
  { value: 'justificatif_origine_fonds', label: 'Justificatif origine des fonds' },
  { value: 'justificatif_disponibilite_fonds', label: 'Justificatif disponibilité des fonds' },
  { value: 'nif', label: 'NIF' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'bulletin_souscription', label: 'Bulletin de souscription' },
  { value: 'reglementaire', label: 'Réglementaire' },
  { value: 'autre', label: 'Autre' },
]

const PJ_TYPE_COLORS: Record<string, string> = {
  piece_identite: 'bg-blue-100 text-blue-700',
  rib: 'bg-green-100 text-green-700',
  justificatif_domicile: 'bg-amber-100 text-amber-700',
  justificatif_origine_fonds: 'bg-purple-100 text-purple-700',
  justificatif_disponibilite_fonds: 'bg-indigo-100 text-indigo-700',
  nif: 'bg-teal-100 text-teal-700',
  contrat: 'bg-pink-100 text-pink-700',
  bulletin_souscription: 'bg-cyan-100 text-cyan-700',
  reglementaire: 'bg-orange-100 text-orange-700',
  autre: 'bg-gray-100 text-gray-600',
}

function PiecesJointes({
  clientId,
  supabase,
  currentUserId,
}: {
  clientId: string
  supabase: ReturnType<typeof createClient>
  currentUserId?: string
}) {
  const [pjList, setPjList] = React.useState<any[]>([])
  const [uploading, setUploading] = React.useState(false)
  const [loadingPj, setLoadingPj] = React.useState(true)
  const [showUploadForm, setShowUploadForm] = React.useState(false)
  const [uploadType, setUploadType] = React.useState('autre')
  const [uploadDate, setUploadDate] = React.useState(new Date().toISOString().split('T')[0])
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = React.useState<File | null>(null)

  React.useEffect(() => {
    const fetchPj = async () => {
      const { data } = await supabase
        .from('client_pj')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      setPjList(data || [])
      setLoadingPj(false)
    }
    fetchPj()
  }, [clientId, supabase])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setShowUploadForm(true)
  }

  const handleUpload = async () => {
    if (!pendingFile) return
    setUploading(true)

    const storagePath = `${clientId}/${Date.now()}_${pendingFile.name}`

    const { error: uploadErr } = await supabase.storage
      .from('client-pj')
      .upload(storagePath, pendingFile)

    if (uploadErr) {
      console.error('Upload error:', uploadErr)
      alert('Erreur lors de l\'upload. Veuillez réessayer.')
      setUploading(false)
      return
    }

    const { error: insertErr } = await supabase.from('client_pj').insert({
      client_id: clientId,
      nom_fichier: pendingFile.name,
      storage_path: storagePath,
      taille_octets: pendingFile.size,
      type_mime: pendingFile.type || null,
      type_document: uploadType,
      date_document: uploadDate || null,
      uploaded_by: currentUserId || null,
    })

    if (!insertErr) {
      const { data } = await supabase
        .from('client_pj')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      setPjList(data || [])
    }
    setUploading(false)
    setShowUploadForm(false)
    setPendingFile(null)
    setUploadType('autre')
    setUploadDate(new Date().toISOString().split('T')[0])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (pj: { id: string; storage_path: string }) => {
    await supabase.storage.from('client-pj').remove([pj.storage_path])
    await supabase.from('client_pj').delete().eq('id', pj.id)
    setPjList(prev => prev.filter(p => p.id !== pj.id))
  }

  const handleDownload = async (pj: { storage_path: string; nom_fichier: string }) => {
    const { data } = await supabase.storage.from('client-pj').createSignedUrl(pj.storage_path, 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Paperclip size={18} className="text-gray-600" />
            Pièces jointes
            {pjList.length > 0 && (
              <Badge variant="secondary" className="text-xs">{pjList.length}</Badge>
            )}
          </CardTitle>
          <label className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer">
            <Upload size={14} />
            Ajouter
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Upload form with type + date */}
        {showUploadForm && pendingFile && (
          <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-indigo-800 truncate">{pendingFile.name}</p>
              <button onClick={() => { setShowUploadForm(false); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">Type de document</label>
              <select
                value={uploadType}
                onChange={e => setUploadType(e.target.value)}
                className="w-full px-2 py-1.5 mt-0.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400"
              >
                {PJ_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">Date du document</label>
              <input
                type="date"
                value={uploadDate}
                onChange={e => setUploadDate(e.target.value)}
                className="w-full px-2 py-1.5 mt-0.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-1.5 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Upload en cours...' : 'Enregistrer'}
            </button>
          </div>
        )}

        {loadingPj ? (
          <p className="text-xs text-gray-400 text-center py-2">Chargement...</p>
        ) : pjList.length > 0 ? (
          pjList.map(pj => {
            const typeLabel = PJ_TYPES.find(t => t.value === pj.type_document)?.label || pj.type_document || 'Autre'
            const typeColor = PJ_TYPE_COLORS[pj.type_document] || PJ_TYPE_COLORS.autre
            return (
              <div key={pj.id} className="flex items-start gap-2 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 group">
                <Paperclip size={14} className="text-gray-400 shrink-0 mt-0.5" />
                <button
                  onClick={() => handleDownload(pj)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm text-indigo-600 hover:underline truncate">{pj.nom_fichier}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${typeColor}`}>
                      {typeLabel}
                    </span>
                    {pj.date_document && (
                      <span className="text-[10px] text-gray-500">
                        {new Date(pj.date_document).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">{formatSize(pj.taille_octets)}</span>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(pj)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all shrink-0"
                  title="Supprimer"
                >
                  <Trash2 size={12} className="text-red-400" />
                </button>
              </div>
            )
          })
        ) : (
          !showUploadForm && (
            <p className="text-sm text-gray-400 italic text-center py-3">Aucune pièce jointe</p>
          )
        )}
      </CardContent>
    </Card>
  )
}

export default function ClientDetailPage() {
  const params = useParams()
  const clientId = params.id as string
  const { consultant: currentUser } = useUser()
  const isConsultant = currentUser?.role === 'consultant'

  const [client, setClient] = React.useState<ClientInfo | null>(null)
  const [dossiers, setDossiers] = React.useState<ClientDossier[]>([])
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)

  // Edit mode states
  const [editingContact, setEditingContact] = React.useState(false)
  const [editingReglementaire, setEditingReglementaire] = React.useState(false)
  const [savingContact, setSavingContact] = React.useState(false)
  const [savingReglementaire, setSavingReglementaire] = React.useState(false)

  // Edit form values
  const [editContact, setEditContact] = React.useState({
    email: '',
    telephone: '',
    pays: '',
    numero_compte: '',
    google_drive_url: '',
  })
  const [editReg, setEditReg] = React.useState({
    statut_kyc: 'non',
    der: false,
    pi: false,
    preco: false,
    lm: false,
    rm: false,
  })
  // editNotesValue kept for backward compat migration display
  const [editNotesValue, setEditNotesValue] = React.useState('')

  const supabase = React.useMemo(() => createClient(), [])

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch client info
        const { data: clientData, error: clientErr } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single()

        if (clientErr || !clientData) { setNotFound(true); return }
        setClient(clientData as ClientInfo)

        // Initialize edit forms with client data
        setEditContact({
          email: clientData.email || '',
          telephone: clientData.telephone || '',
          pays: clientData.pays || '',
          numero_compte: clientData.numero_compte || '',
          google_drive_url: clientData.google_drive_url || '',
        })
        setEditReg({
          statut_kyc: clientData.statut_kyc || 'non',
          der: clientData.der || false,
          pi: clientData.pi || false,
          preco: clientData.preco || false,
          lm: clientData.lm || false,
          rm: clientData.rm || false,
        })
        setEditNotesValue(clientData.commentaires || '')

        // Fetch all dossiers for this client via view
        const { data: dossierData } = await supabase
          .from('v_dossiers_complets')
          .select('*')
          .eq('client_id', clientId)
          .order('date_operation', { ascending: false })

        // Deduplicate dossiers (safety net)
        const uniqueDossiers = dossierData ? Array.from(
          new Map(dossierData.map((d: any) => [d.id, d])).values()
        ) : []
        setDossiers(uniqueDossiers as ClientDossier[])
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [clientId, supabase])

  const handleSaveContact = async () => {
    if (!client) return
    setSavingContact(true)
    const { error } = await supabase
      .from('clients')
      .update({
        email: editContact.email || null,
        telephone: editContact.telephone || null,
        pays: editContact.pays || null,
        numero_compte: editContact.numero_compte || null,
        google_drive_url: editContact.google_drive_url || null,
      })
      .eq('id', clientId)
    if (!error) {
      setClient({ ...client, ...editContact })
      setEditingContact(false)
    }
    setSavingContact(false)
  }

  const handleSaveReglementaire = async () => {
    if (!client) return
    setSavingReglementaire(true)
    const { error } = await supabase
      .from('clients')
      .update({
        statut_kyc: editReg.statut_kyc,
        der: editReg.der,
        pi: editReg.pi,
        preco: editReg.preco,
        lm: editReg.lm,
        rm: editReg.rm,
      })
      .eq('id', clientId)
    if (!error) {
      setClient({ ...client, ...editReg })
      setEditingReglementaire(false)
    }
    setSavingReglementaire(false)
  }

  // handleSaveNotes removed — replaced by JournalSuivi component

  if (loading) return <div className="flex items-center justify-center min-h-[400px] text-gray-500">Chargement...</div>
  if (notFound || !client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Client non trouvé</h1>
        <Link href="/dashboard/ma-clientele"><Button variant="outline">Retour</Button></Link>
      </div>
    )
  }

  const fullName = `${client.prenom || ''} ${client.nom}`.trim()
  const totalCollecte = dossiers
    .filter(d => d.statut === 'client_finalise')
    .reduce((s, d) => s + (d.montant || 0), 0)
  const totalPipeline = dossiers
    .filter(d => d.statut === 'client_en_cours')
    .reduce((s, d) => s + (d.montant || 0), 0)
  const totalCommission = dossiers.reduce((s, d) => s + (isConsultant ? (d.rem_apporteur || 0) : (d.commission_brute || 0)), 0)
  const finalisedCount = dossiers.filter(d => d.statut === 'client_finalise').length
  const enCoursCount = dossiers.filter(d => d.statut === 'client_en_cours').length

  // Compliance — 6 champs : KYC/Réglementaire, DER, PI, PRECO, LM, RM
  const complianceFields = [
    { label: 'KYC', ok: client.statut_kyc === 'oui' },
    { label: 'DER', ok: !!client.der },
    { label: 'PI', ok: !!client.pi },
    { label: 'PRECO', ok: !!client.preco },
    { label: 'LM', ok: !!client.lm },
    { label: 'RM', ok: !!client.rm },
  ]
  const complianceDone = complianceFields.filter(f => f.ok).length
  const compliancePct = (complianceDone / 6) * 100

  // Group dossiers by product category
  const dossiersByCategory = dossiers.reduce((acc, d) => {
    const cat = d.produit_categorie || d.produit_nom?.split(' ')[0] || 'Autre'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(d)
    return acc
  }, {} as Record<string, ClientDossier[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ma-clientele">
          <Button variant="ghost" className="gap-2"><ArrowLeft size={18} />Retour</Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-3 rounded-xl">
              <User size={28} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{fullName}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-sm text-gray-600">
                  <MapPin size={14} /> {client.pays || 'N/A'}
                </span>
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                    <Mail size={14} /> {client.email}
                  </a>
                )}
                {client.telephone && (
                  <a href={`tel:${client.telephone}`} className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                    <Phone size={14} /> {client.telephone}
                  </a>
                )}
                {client.numero_compte && (
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <CreditCard size={14} /> {client.numero_compte}
                  </span>
                )}
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Calendar size={14} /> Client depuis {new Date(client.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-gray-500">Dossiers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{dossiers.length}</p>
          <p className="text-xs text-gray-500">{finalisedCount} finalisé(s) · {enCoursCount} en cours</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-gray-500">Collecte finalisée</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalCollecte)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-gray-500">Pipeline en cours</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(totalPipeline)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-gray-500">{isConsultant ? 'Mes commissions' : 'Commissions totales'}</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{formatCurrency(totalCommission)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-gray-500">Conformité</p>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-2xl font-bold ${compliancePct === 100 ? 'text-green-700' : compliancePct >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
              {complianceDone}/6
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
            <div className={`h-1.5 rounded-full ${compliancePct === 100 ? 'bg-green-500' : compliancePct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${compliancePct}%` }} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dossiers list */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText size={20} className="text-gray-600" />
                  Dossiers ({dossiers.length})
                </CardTitle>
                <Link href={`/dashboard/dossiers/nouveau?client_id=${client.id}`}>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Plus size={16} />
                    Nouveau dossier
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {dossiers.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(dossiersByCategory).map(([category, catDossiers]) => (
                    <div key={category} className="space-y-2">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">{category}</h3>
                      {catDossiers.map(d => (
                        <Link key={d.id} href={`/dashboard/dossiers/${d.id}`} className="block">
                          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 text-sm">
                                  {d.produit_nom || 'Sans produit'} {d.compagnie_nom ? `· ${d.compagnie_nom}` : ''}
                                </span>
                                <StatusBadge
                                  status={(d.statut as 'prospect' | 'client_en_cours' | 'client_finalise') || 'prospect'}
                                  type="dossier"
                                />
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                <span>{d.financement || '-'}</span>
                                {d.date_operation && (
                                  <span>{new Date(d.date_operation).toLocaleDateString('fr-FR')}</span>
                                )}
                                {d.consultant_prenom && (
                                  <span>{d.consultant_prenom} {d.consultant_nom}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="text-sm font-bold text-gray-900">
                                {formatCurrency(d.montant)}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                com. {formatCurrency(isConsultant ? d.rem_apporteur : (d.commission_brute || (d.taux_commission && d.montant ? d.montant * d.taux_commission : null)))}
                              </p>
                              <div className="flex gap-1 mt-1 justify-end">
                                {d.facturee && <Badge variant="success" className="text-[10px] px-1.5">Facturée</Badge>}
                                {d.payee === 'oui' && <Badge variant="success" className="text-[10px] px-1.5">Payée</Badge>}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-6">Aucun dossier</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Contact + Compliance + Info */}
        <div className="space-y-4">
          {/* Contact info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User size={18} className="text-gray-600" />
                  Coordonnées
                </CardTitle>
                {!editingContact && (
                  <button
                    onClick={() => setEditingContact(true)}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Éditer"
                  >
                    <Pencil size={16} className="text-gray-500" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!editingContact ? (
                <>
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-gray-400 shrink-0" />
                    {client.email ? (
                      <a href={`mailto:${client.email}`} className="text-sm text-indigo-600 hover:underline truncate">{client.email}</a>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Non renseigné</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-gray-400 shrink-0" />
                    {client.telephone ? (
                      <a href={`tel:${client.telephone}`} className="text-sm text-indigo-600 hover:underline">{client.telephone}</a>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Non renseigné</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700">{client.pays || 'Non renseigné'}</span>
                  </div>
                  {client.numero_compte && (
                    <div className="flex items-center gap-3">
                      <CreditCard size={16} className="text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-700">{client.numero_compte}</span>
                    </div>
                  )}
                  {client.google_drive_url && (
                    <div className="flex items-center gap-3">
                      <FolderOpen size={16} className="text-gray-400 shrink-0" />
                      <a href={client.google_drive_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline truncate flex items-center gap-1">
                        Google Drive <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                  {client.conformite && (
                    <div className="pt-2 border-t">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        client.conformite === 'conforme' ? 'bg-green-100 text-green-700' :
                        client.conformite === 'non conforme' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>O2S: {client.conformite}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Email</label>
                    <input
                      type="email"
                      value={editContact.email}
                      onChange={e => setEditContact({ ...editContact, email: e.target.value })}
                      className="w-full px-3 py-2 mt-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Téléphone</label>
                    <input
                      type="tel"
                      value={editContact.telephone}
                      onChange={e => setEditContact({ ...editContact, telephone: e.target.value })}
                      className="w-full px-3 py-2 mt-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Pays</label>
                    <input
                      type="text"
                      value={editContact.pays}
                      onChange={e => setEditContact({ ...editContact, pays: e.target.value })}
                      className="w-full px-3 py-2 mt-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Numéro de compte</label>
                    <input
                      type="text"
                      value={editContact.numero_compte}
                      onChange={e => setEditContact({ ...editContact, numero_compte: e.target.value })}
                      className="w-full px-3 py-2 mt-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Lien Google Drive</label>
                    <input
                      type="url"
                      value={editContact.google_drive_url}
                      onChange={e => setEditContact({ ...editContact, google_drive_url: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-3 py-2 mt-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveContact}
                      disabled={savingContact}
                      className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <Save size={14} />
                      {savingContact ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingContact(false)
                        setEditContact({
                          email: client.email || '',
                          telephone: client.telephone || '',
                          pays: client.pays || '',
                          numero_compte: client.numero_compte || '',
                          google_drive_url: client.google_drive_url || '',
                        })
                      }}
                      className="flex-1 py-2 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <X size={14} />
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relations */}
          <ClientRelations clientId={clientId} clientName={fullName} />

          {/* Google Suite Integration */}
          <CommunicationsTab clientEmail={client.email} clientName={fullName} />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield size={18} className="text-gray-600" />
                  Réglementaire
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!editingReglementaire && (
                    <button
                      onClick={() => setEditingReglementaire(true)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                      title="Éditer"
                    >
                      <Pencil size={16} className="text-gray-500" />
                    </button>
                  )}
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    complianceDone === 6 ? 'bg-green-100 text-green-700' :
                    complianceDone >= 4 ? 'bg-blue-100 text-blue-700' :
                    complianceDone >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>{complianceDone}/6</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!editingReglementaire ? (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div className={`h-2 rounded-full transition-all ${
                      compliancePct === 100 ? 'bg-green-500' : compliancePct >= 60 ? 'bg-blue-500' : compliancePct >= 30 ? 'bg-amber-500' : 'bg-red-500'
                    }`} style={{ width: `${compliancePct}%` }} />
                  </div>
                  {complianceFields.map(f => (
                    <div key={f.label} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">{f.label}</span>
                      <Badge variant={f.ok ? 'success' : 'destructive'}>
                        {f.ok ? 'Validé' : 'Non validé'}
                      </Badge>
                    </div>
                  ))}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        id="kyc"
                        checked={editReg.statut_kyc === 'oui'}
                        onChange={e => setEditReg({ ...editReg, statut_kyc: e.target.checked ? 'oui' : 'non' })}
                        className="rounded"
                      />
                      <label htmlFor="kyc" className="text-sm font-medium text-gray-700 cursor-pointer">KYC</label>
                    </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        id="der"
                        checked={editReg.der}
                        onChange={e => setEditReg({ ...editReg, der: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="der" className="text-sm font-medium text-gray-700 cursor-pointer">DER</label>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        id="pi"
                        checked={editReg.pi}
                        onChange={e => setEditReg({ ...editReg, pi: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="pi" className="text-sm font-medium text-gray-700 cursor-pointer">PI</label>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        id="preco"
                        checked={editReg.preco}
                        onChange={e => setEditReg({ ...editReg, preco: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="preco" className="text-sm font-medium text-gray-700 cursor-pointer">PRECO</label>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        id="lm"
                        checked={editReg.lm}
                        onChange={e => setEditReg({ ...editReg, lm: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="lm" className="text-sm font-medium text-gray-700 cursor-pointer">LM</label>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        id="rm"
                        checked={editReg.rm}
                        onChange={e => setEditReg({ ...editReg, rm: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="rm" className="text-sm font-medium text-gray-700 cursor-pointer">RM</label>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveReglementaire}
                      disabled={savingReglementaire}
                      className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <Save size={14} />
                      {savingReglementaire ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingReglementaire(false)
                        setEditReg({
                          statut_kyc: client.statut_kyc || 'non',
                          der: client.der || false,
                          pi: client.pi || false,
                          preco: client.preco || false,
                          lm: client.lm || false,
                          rm: client.rm || false,
                        })
                      }}
                      className="flex-1 py-2 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <X size={14} />
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Journal de suivi structuré (CDC §8) */}
          <JournalSuivi
            clientId={clientId}
            currentUserId={currentUser?.id}
            currentUserNom={currentUser ? `${currentUser.prenom || ''} ${currentUser.nom || ''}`.trim() : 'Utilisateur'}
            isManager={currentUser?.role === 'manager' || currentUser?.role === 'back_office'}
          />

          {/* Pièces jointes */}
          <PiecesJointes clientId={clientId} supabase={supabase} currentUserId={currentUser?.id} />

          {/* Relances */}
          <ClientRelances
            clientId={clientId}
            dossiers={dossiers.map(d => ({ id: d.id, produit_nom: d.produit_nom }))}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Résumé financier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total investi</span>
                <span className="text-sm font-semibold">{formatCurrency(totalCollecte + totalPipeline)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Dont finalisé</span>
                <span className="text-sm font-semibold text-green-700">{formatCurrency(totalCollecte)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Dont en cours</span>
                <span className="text-sm font-semibold text-amber-700">{formatCurrency(totalPipeline)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="text-sm text-gray-600">{isConsultant ? 'Mes commissions' : 'Commissions'}</span>
                <span className="text-sm font-bold text-indigo-700">{formatCurrency(totalCommission)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
