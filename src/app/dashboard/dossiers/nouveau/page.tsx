'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Produit, Compagnie, Consultant, TauxProduitCompagnie } from '@/types/database'
import { useUser } from '@/hooks/use-user'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface FormData {
  nom: string; prenom: string; pays: string; email: string; telephone: string
  produitId: string; compagnieId: string
  montant: string; financement: string; dateOperation: string; dateEntreeRelation: string
  statut: string; commentaire: string; consultantId: string
}

interface ClientInfo {
  id: string
  nom: string
  prenom: string | null
  pays: string
  email: string | null
  telephone: string | null
}

function NewDossierContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { consultant } = useUser()
  const clientIdParam = searchParams.get('client_id')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [produits, setProduits] = React.useState<Produit[]>([])
  const [compagnies, setCompagnies] = React.useState<Compagnie[]>([])
  const [consultants, setConsultants] = React.useState<Consultant[]>([])
  const [tauxMap, setTauxMap] = React.useState<TauxProduitCompagnie[]>([])
  const [autoTaux, setAutoTaux] = React.useState<number | null>(null)
  const [loadingData, setLoadingData] = React.useState(true)
  const [existingClient, setExistingClient] = React.useState<ClientInfo | null>(null)
  const [existingClientId, setExistingClientId] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState<FormData>({
    nom: '', prenom: '', pays: '', email: '', telephone: '', produitId: '', compagnieId: '',
    montant: '', financement: 'cash',
    dateOperation: new Date().toISOString().split('T')[0],
    dateEntreeRelation: new Date().toISOString().split('T')[0],
    statut: 'prospect', commentaire: '', consultantId: '',
  })

  const supabase = React.useMemo(() => createClient(), [])

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [produitsRes, compagniesRes, consultantsRes, tauxRes] = await Promise.all([
          supabase.from('produits').select('*').order('nom'),
          supabase.from('compagnies').select('*').order('nom'),
          supabase.from('consultants').select('*').eq('actif', true).order('prenom'),
          supabase.from('taux_produit_compagnie').select('*').eq('actif', true),
        ])
        if (produitsRes.data) setProduits(produitsRes.data)
        if (compagniesRes.data) setCompagnies(compagniesRes.data)
        if (consultantsRes.data) setConsultants(consultantsRes.data)
        if (tauxRes.data) setTauxMap(tauxRes.data)

        // Fetch existing client if client_id is in params
        if (clientIdParam) {
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id, nom, prenom, pays, email, telephone')
            .eq('id', clientIdParam)
            .single()
          if (clientData && !clientError) {
            setExistingClient(clientData as ClientInfo)
            setExistingClientId(clientData.id)
            // Pre-fill the form with client data
            setFormData(prev => ({
              ...prev,
              nom: clientData.nom,
              prenom: clientData.prenom || '',
              pays: clientData.pays,
              email: clientData.email || '',
              telephone: clientData.telephone || '',
            }))
          }
        }
      } catch (err) { console.error('Error:', err) }
      finally { setLoadingData(false) }
    }
    fetchData()
  }, [supabase, clientIdParam])

  React.useEffect(() => {
    if (consultant?.id) setFormData(prev => ({ ...prev, consultantId: prev.consultantId || consultant.id }))
  }, [consultant])

  // Auto taux lookup when produit + compagnie change
  React.useEffect(() => {
    if (formData.produitId && formData.compagnieId) {
      const match = tauxMap.find(
        t => t.produit_id === formData.produitId && t.compagnie_id === formData.compagnieId
      )
      setAutoTaux(match ? match.taux : null)
    } else {
      setAutoTaux(null)
    }
  }, [formData.produitId, formData.compagnieId, tauxMap])

  const estimatedCommission = React.useMemo(() => {
    if (autoTaux === null || !formData.montant) return null
    return parseFloat(formData.montant) * autoTaux
  }, [autoTaux, formData.montant])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (!formData.nom || !formData.pays || !formData.montant || !formData.consultantId) {
        setError('Veuillez remplir tous les champs obligatoires (Nom, Pays, Montant, Consultant)')
        setLoading(false)
        return
      }

      // Determine client_id: use existing if provided, otherwise create new
      let clientIdForDossier: string
      if (existingClientId) {
        clientIdForDossier = existingClientId
      } else {
        const { data: clientData, error: clientError } = await supabase
          .from('clients').insert({ nom: formData.nom, prenom: formData.prenom || null, pays: formData.pays, email: formData.email || null, telephone: formData.telephone || null })
          .select().single()
        if (clientError) throw clientError
        clientIdForDossier = clientData.id
      }

      const { data: dossierData, error: dossierError } = await supabase
        .from('dossiers').insert({
          client_id: clientIdForDossier,
          consultant_id: formData.consultantId,
          produit_id: formData.produitId || null,
          compagnie_id: formData.compagnieId || null,
          montant: parseFloat(formData.montant),
          financement: (formData.financement as any) || null,
          date_operation: formData.dateOperation,
          statut: formData.statut as any,
          commentaire: formData.commentaire || null,
        }).select().single()
      if (dossierError) throw dossierError

      // Facture is auto-created by on_dossier_finalise trigger on INSERT.
      // As safety net, check if facture exists and create one if trigger didn't.
      const { data: existingFacture } = await supabase.from('factures').select('id').eq('dossier_id', dossierData.id).maybeSingle()
      if (!existingFacture) {
        await supabase.from('factures').insert({ dossier_id: dossierData.id, facturee: false, payee: 'non' })
      }
      router.push(`/dashboard/dossiers/${dossierData.id}`)
    } catch (err: any) {
      console.error('Error creating dossier:', err)
      setError(err.message || 'Erreur lors de la création du dossier')
    } finally { setLoading(false) }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-navy-600 mx-auto mb-2" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  const isManager = consultant?.role === 'manager'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/dossiers"><Button variant="ghost" className="gap-2"><ArrowLeft size={18} />Retour</Button></Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Créer un dossier</h1>
          <p className="text-gray-600 mt-1">Ajouter un nouveau dossier client</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>
              {existingClient ? (
                <span>Dossier pour: <strong>{formData.prenom} {formData.nom}</strong></span>
              ) : (
                'Informations du client'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingClient ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
                    <p className="text-sm text-gray-900 font-medium">{formData.nom}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Prénom</label>
                    <p className="text-sm text-gray-900 font-medium">{formData.prenom || '-'}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pays</label>
                  <p className="text-sm text-gray-900 font-medium">{formData.pays}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <p className="text-sm text-gray-900 font-medium">{formData.email || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                    <p className="text-sm text-gray-900 font-medium">{formData.telephone || '-'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <Input name="nom" value={formData.nom} onChange={handleInputChange} placeholder="Dupont" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                    <Input name="prenom" value={formData.prenom} onChange={handleInputChange} placeholder="Jean" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pays *</label>
                  <Input name="pays" value={formData.pays} onChange={handleInputChange} placeholder="France" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <Input name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="client@email.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <Input name="telephone" value={formData.telephone} onChange={handleInputChange} placeholder="+33 6 12 34 56 78" />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader><CardTitle>Détails du dossier</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Stade relationnel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stade relationnel</label>
              <Select name="statut" value={formData.statut} onChange={handleInputChange}>
                <option value="prospect">Prospect</option>
                <option value="client_en_cours">Client en cours</option>
                <option value="client_finalise">Client finalisé</option>
              </Select>
            </div>

            {/* Produit + Compagnie (tous les deux optionnels) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produit</label>
                <Select name="produitId" value={formData.produitId} onChange={handleInputChange}>
                  <option value="">— Aucun —</option>
                  {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Compagnie</label>
                <Select name="compagnieId" value={formData.compagnieId} onChange={handleInputChange}>
                  <option value="">— Aucune —</option>
                  {compagnies.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </Select>
              </div>
            </div>

            {/* Auto taux indicator */}
            {autoTaux !== null && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-700">
                    Taux commission : <strong>{(autoTaux * 100).toFixed(2)}%</strong>
                  </span>
                  {estimatedCommission !== null && estimatedCommission > 0 && (
                    <span className="text-sm font-semibold text-indigo-900">
                      Commission estimée : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(estimatedCommission)}
                    </span>
                  )}
                </div>
              </div>
            )}
            {formData.produitId && formData.compagnieId && autoTaux === null && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-xs text-amber-700">Aucun taux configuré pour cette combinaison produit/compagnie</span>
              </div>
            )}

            {/* Montant + Financement */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant *</label>
                <Input name="montant" type="number" value={formData.montant} onChange={handleInputChange} placeholder="0.00" step="0.01" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Financement</label>
                <Select name="financement" value={formData.financement} onChange={handleInputChange}>
                  <option value="cash">Cash</option>
                  <option value="credit">Crédit</option>
                  <option value="lombard">Lombard</option>
                  <option value="remploi">Remploi</option>
                </Select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date d'entrée en relation</label>
                <Input name="dateEntreeRelation" type="date" value={formData.dateEntreeRelation} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date opération</label>
                <Input name="dateOperation" type="date" value={formData.dateOperation} onChange={handleInputChange} />
              </div>
            </div>

            {/* Consultant — visible pour managers et consultants */}
            {isManager ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consultant *</label>
                <Select name="consultantId" value={formData.consultantId} onChange={handleInputChange} required>
                  <option value="">Sélectionner un consultant</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
                </Select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consultant</label>
                <p className="text-gray-700 py-2">{consultant?.prenom} {consultant?.nom}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
              <textarea name="commentaire" value={formData.commentaire} onChange={handleInputChange}
                placeholder="Ajouter un commentaire..."
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                rows={4} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={loading} className="gap-2">
            {loading && <Loader2 size={18} className="animate-spin" />}
            Créer le dossier
          </Button>
          <Link href="/dashboard/dossiers"><Button variant="outline">Annuler</Button></Link>
        </div>
      </form>
    </div>
  )
}

import { Suspense } from 'react'

export default function NewDossierPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-navy-600 mx-auto mb-2" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    }>
      <NewDossierContent />
    </Suspense>
  )
}
