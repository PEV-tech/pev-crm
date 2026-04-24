'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Paperclip, Upload, Trash2, X,
} from 'lucide-react'

interface PiecesJointesProps {
  clientId: string
  currentUserId?: string
}

const PJ_TYPES = [
  { value: 'kyc_signe', label: 'KYC signé' },
  { value: 'piece_identite', label: 'Pièce d\'identité' },
  { value: 'rib', label: 'RIB' },
  { value: 'justificatif_domicile', label: 'Justificatif domicile' },
  { value: 'justificatif_origine_fonds', label: 'Justificatif origine des fonds' },
  { value: 'justificatif_disponibilite_fonds', label: 'Justificatif disponibilité des fonds' },
  { value: 'nif', label: 'NIF' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'bulletin_souscription', label: 'Bulletin de souscription' },
  { value: 'reglementaire', label: 'Réglementaire' },
  // Catégories documentaires réglementaires PEV (ajoutées 2026-04-24, point 1.5)
  { value: 'cr', label: 'CR — Compte rendu' },
  { value: 'der', label: 'DER — Document d\'entrée en relation' },
  { value: 'pi', label: 'PI — Profil investisseur' },
  { value: 'preco', label: 'PRECO — Préconisation' },
  { value: 'lm', label: 'LM — Lettre de mission' },
  { value: 'rm', label: 'RM — Rapport de mission' },
  { value: 'autre', label: 'Autre' },
]

const PJ_TYPE_COLORS: Record<string, string> = {
  kyc_signe: 'bg-emerald-100 text-emerald-700',
  piece_identite: 'bg-blue-100 text-blue-700',
  rib: 'bg-green-100 text-green-700',
  justificatif_domicile: 'bg-amber-100 text-amber-700',
  justificatif_origine_fonds: 'bg-purple-100 text-purple-700',
  justificatif_disponibilite_fonds: 'bg-indigo-100 text-indigo-700',
  nif: 'bg-teal-100 text-teal-700',
  contrat: 'bg-pink-100 text-pink-700',
  bulletin_souscription: 'bg-cyan-100 text-cyan-700',
  reglementaire: 'bg-orange-100 text-orange-700',
  cr: 'bg-slate-100 text-slate-700',
  der: 'bg-rose-100 text-rose-700',
  pi: 'bg-violet-100 text-violet-700',
  preco: 'bg-lime-100 text-lime-700',
  lm: 'bg-sky-100 text-sky-700',
  rm: 'bg-fuchsia-100 text-fuchsia-700',
  autre: 'bg-gray-100 text-gray-600',
}

export function PiecesJointes({
  clientId,
  currentUserId,
}: PiecesJointesProps) {
  const supabase = createClient()

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
  }, [clientId])

  // Security: file upload validation
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
  ]
  const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.js', '.vbs', '.msi', '.dll']

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      alert('Fichier trop volumineux. Taille maximum : 10 Mo.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Validate file type (MIME + extension)
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      alert('Ce type de fichier n\'est pas autorisé.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      alert('Ce type de fichier n\'est pas autorisé. Types acceptés : PDF, images, Word, Excel, texte.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

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
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
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
