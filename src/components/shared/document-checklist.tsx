'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Check, X, Clock, AlertCircle } from 'lucide-react'

// Alignement avec les `Row` Supabase : certaines colonnes booléennes
// ou numériques n'ont pas de DEFAULT NOT NULL côté DB et reviennent
// donc nullable. On élargit l'interface locale plutôt que de caster,
// et on coerce à la lecture côté UI (null → false / tri neutre).
interface DocItem {
  id: string
  dossier_id: string
  document_nom: string
  recu: boolean | null
  date_reception: string | null
  commentaire: string | null
}

interface DocTemplate {
  id: string
  produit_categorie: string
  document_nom: string
  obligatoire: boolean | null
  sort_order: number | null
}

interface DocumentChecklistProps {
  dossierId: string
  produitNom: string | null
  produitCategorie?: string | null
  readOnly?: boolean
}

export function DocumentChecklist({ dossierId, produitNom, produitCategorie, readOnly = false }: DocumentChecklistProps) {
  const supabase = React.useMemo(() => createClient(), [])
  const [docs, setDocs] = React.useState<DocItem[]>([])
  const [templates, setTemplates] = React.useState<DocTemplate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState<string | null>(null)

  // Determine product category for template matching
  const category = React.useMemo(() => {
    const nom = (produitNom || '').toUpperCase().trim()
    const cat = (produitCategorie || '').toUpperCase().trim()
    if (nom.includes('SCPI') || cat.includes('SCPI')) return 'SCPI'
    if (nom.includes('CAV') || cat.includes('CAV')) return 'CAV LUX'
    if (nom.includes('CAPI') || cat.includes('CAPI')) return 'CAPI LUX'
    if (nom.includes('PE') || cat.includes('PE')) return 'PE'
    return null
  }, [produitNom, produitCategorie])

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const [docsRes, templatesRes] = await Promise.all([
        supabase.from('dossier_documents').select('*').eq('dossier_id', dossierId).order('created_at'),
        category
          ? supabase.from('document_templates').select('*').eq('produit_categorie', category).order('sort_order')
          : Promise.resolve({ data: [], error: null }),
      ])
      setDocs(docsRes.data || [])
      setTemplates(templatesRes.data || [])

      // Auto-create checklist items from templates if none exist yet
      if ((docsRes.data || []).length === 0 && (templatesRes.data || []).length > 0) {
        const newDocs = (templatesRes.data || []).map(t => ({
          dossier_id: dossierId,
          document_nom: t.document_nom,
          recu: false,
        }))
        const { data: inserted } = await supabase.from('dossier_documents').insert(newDocs).select()
        if (inserted) setDocs(inserted)
      }

      setLoading(false)
    }
    fetchData()
  }, [dossierId, category, supabase])

  const toggleDoc = async (doc: DocItem) => {
    if (readOnly) return
    setSaving(doc.id)
    const newRecu = !doc.recu
    const { error } = await supabase
      .from('dossier_documents')
      .update({
        recu: newRecu,
        date_reception: newRecu ? new Date().toISOString().split('T')[0] : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)
    if (!error) {
      setDocs(prev => prev.map(d => d.id === doc.id ? {
        ...d,
        recu: newRecu,
        date_reception: newRecu ? new Date().toISOString().split('T')[0] : null,
      } : d))
    }
    setSaving(null)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-gray-400 text-sm">
          Chargement des documents...
        </CardContent>
      </Card>
    )
  }

  if (!category) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText size={18} className="text-gray-600" />
            Documents requis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 italic text-center py-4">
            Aucun template de documents pour ce type de produit
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalDocs = docs.length
  const receivedDocs = docs.filter(d => d.recu).length
  const missingDocs = totalDocs - receivedDocs
  const progress = totalDocs > 0 ? (receivedDocs / totalDocs) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText size={18} className="text-gray-600" />
            Documents requis — {category}
          </CardTitle>
          <div className="flex items-center gap-2">
            {missingDocs > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                <AlertCircle size={12} />
                {missingDocs} manquant(s)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                <Check size={12} />
                Complet
              </span>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{receivedDocs}/{totalDocs} reçu(s)</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {docs.map(doc => (
            <div
              key={doc.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                doc.recu
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              } ${!readOnly ? 'cursor-pointer hover:shadow-sm' : ''}`}
              onClick={() => toggleDoc(doc)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                  saving === doc.id
                    ? 'bg-gray-200'
                    : doc.recu
                      ? 'bg-green-500 text-white'
                      : 'border-2 border-gray-300'
                }`}>
                  {saving === doc.id ? (
                    <Clock size={14} className="text-gray-500 animate-spin" />
                  ) : doc.recu ? (
                    <Check size={14} />
                  ) : null}
                </div>
                <span className={`text-sm font-medium ${doc.recu ? 'text-green-800' : 'text-gray-700'}`}>
                  {doc.document_nom}
                </span>
              </div>
              {doc.recu && doc.date_reception && (
                <span className="text-xs text-green-600">
                  Reçu le {new Date(doc.date_reception).toLocaleDateString('fr-FR')}
                </span>
              )}
              {!doc.recu && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <X size={12} /> Manquant
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
