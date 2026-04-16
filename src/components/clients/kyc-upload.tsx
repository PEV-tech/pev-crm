'use client'

import * as React from 'react'
import { Upload, Loader2 } from 'lucide-react'

interface KYCData {
  titre: 'monsieur' | 'madame'
  nom?: string | null
  prenom?: string | null
  nom_jeune_fille?: string | null
  date_naissance?: string | null
  lieu_naissance?: string | null
  nationalite?: string | null
  residence_fiscale?: string | null
  nif?: string | null
  adresse?: string | null
  proprietaire_locataire?: string | null
  telephone?: string | null
  email?: string | null
  situation_matrimoniale?: string | null
  regime_matrimonial?: string | null
  nombre_enfants?: number | null
  enfants_details?: string | null
  profession?: string | null
  statut_professionnel?: string | null
  employeur?: string | null
  date_debut_emploi?: string | null
  revenus_pro_net?: number | null
  revenus_fonciers?: number | null
  autres_revenus?: number | null
  total_revenus_annuel?: number | null
  patrimoine_immobilier?: Array<{
    designation?: string | null
    date_acquisition?: string | null
    valeur_acquisition?: number | null
    valeur_actuelle?: number | null
    crd?: number | null
    charges?: number | null
  }>
  produits_financiers?: Array<{
    designation?: string | null
    detenteur?: string | null
    valeur?: number | null
    date_ouverture?: string | null
    versements_reguliers?: number | null
    rendement?: number | null
  }>
  emprunts?: Array<{
    designation?: string | null
    etablissement?: string | null
    montant_emprunte?: number | null
    date_souscription?: string | null
    duree?: number | null
    taux?: number | null
    crd?: number | null
    echeance?: number | null
  }>
  impot_revenu_n?: number | null
  impot_revenu_n1?: number | null
  impot_revenu_n2?: number | null
  objectifs_client?: string | null
  kyc_date_signature?: string | null
}

interface ParsedKYC {
  titulaire: KYCData
  conjoint: KYCData
}

interface KYCUploadProps {
  onDataParsed: (data: ParsedKYC) => void
  disabled?: boolean
}

export function KYCUpload({ onDataParsed, disabled = false }: KYCUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      setError('Veuillez sélectionner un fichier PDF')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Validate file size (max 20 MB)
    const MAX_FILE_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      setError('Le fichier ne doit pas dépasser 20 MB')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/parse-kyc', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Erreur lors du traitement du PDF')
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      const parsed: ParsedKYC = await response.json()

      // Call the callback with parsed data
      onDataParsed(parsed)

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploading(false)
      setError(null)
    } catch (err) {
      console.error('Upload error:', err)
      setError('Erreur lors du traitement du fichier')
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-indigo-200 bg-indigo-50/50 disabled:opacity-50 disabled:cursor-not-allowed"
        title={disabled ? 'Importation désactivée' : 'Importer un fichier KYC (PDF)'}
      >
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Traitement...
          </>
        ) : (
          <>
            <Upload size={16} />
            Importer KYC (PDF)
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading || disabled}
          accept=".pdf"
        />
      </label>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded border border-red-200">
          {error}
        </p>
      )}
    </div>
  )
}
