'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Produit, Compagnie, Consultant } from '@/types/database'
import { useUser } from '@/hooks/use-user'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface FormData {
  nom: string
  prenom: string
  pays: string
  produitId: string
  compagnieId: string
  montant: string
  financement: string
  dateOperation: string
  commentaire: string
  consultantId: string
}

export default function NewDossierPage() {
  const router = useRouter()
  const { consultant } = useUser()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [produits, setProduits] = React.useState<Produit[]>([])
  const [compagnies, setCompagnies] = React.useState<Compagnie[]>([])
  const [consultants, setConsultants] = React.useState<Consultant[]>([])
  const [loadingData, setLoadingData] = React.useState(true)
  const [formData, setFormData] = React.useState<FormData>({
    nom: '',
    prenom: '',
    pays: '',
    produitId: '',
    compagnieId: '',
    montant: '',
    financement: 'cash',
    dateOperation: new Date().toISOString().split('T')[0],
    commentaire: '',
    consultantId: consultant?.id || '',
  })

  // Initialize Supabase client
  const supabase = React.useMemo(() => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }, [])

  // Fetch reference data
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [produitsRes, compagniesRes, consultantsRes] = await Promise.all([
          supabase.from('produits').select('*').order('nom'),
          supabase.from('compagnies').select('*').order('nom'),
          supabase
            .from('consultants')
            .select('*')
            .eq('actif', true)
            .order('prenom'),
        ])

        if (produitsRes.data) setProduits(produitsRes.data)
        if (compagniesRes.data) setCompagnies(compagniesRes.data)
        if (consultantsRes.data) setConsultants(consultantsRes.data)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Erreur lors du chargement des données')
      } finally {
        setLoadingData(false)
      }
    }

    fetchData()
  }, [supabase])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate form
      if (
        !formData.nom ||
        !formData.pays ||
        !formData.produitId ||
        !formData.montant ||
        !formData.consultantId
      ) {
        setError('Veuillez remplir tous les champs obligatoires')
        setLoading(false)
        return
      }

      // Create client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          nom: formData.nom,
          prenom: formData.prenom || null,
          pays: formData.pays,
        })
        .select()
        .single()

      if (clientError) throw clientError

      // Create dossier
      const { data: dossierData, error: dossierError } = await supabase
        .from('dossiers')
        .insert({
          client_id: clientData.id,
          consultant_id: formData.consultantId,
          produit_id: formData.produitId || null,
          compagnie_id: formData.compagnieId || null,
          montant: parseFloat(formData.montant),
          financement: (formData.financement as any) || null,
          date_operation: formData.dateOperation,
          commentaire: formData.commentaire || null,
          statut: 'prospect',
        })
        .select()
        .single()

      if (dossierError) throw dossierError

      // Create facturation record
      await supabase.from('factures').insert({
        dossier_id: dossierData.id,
        facturee: false,
        payee: 'non',
      })

      router.push(`/dossiers/${dossierData.id}`)
    } catch (err: any) {
      console.error('Error creating dossier:', err)
      setError(err.message || 'Erreur lors de la création du dossier')
    } finally {
      setLoading(false)
    }
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dossiers">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft size={18} />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Créer un dossier</h1>
          <p className="text-gray-600 mt-1">Ajouter un nouveau dossier client</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Informations du client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom *
                </label>
                <Input
                  name="nom"
                  value={formData.nom}
                  onChange={handleInputChange}
                  placeholder="Dupont"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom
                </label>
                <Input
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleInputChange}
                  placeholder="Jean"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pays *
              </label>
              <Input
                name="pays"
                value={formData.pays}
                onChange={handleInputChange}
                placeholder="France"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Détails du dossier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produit *
                </label>
                <Select
                  name="produitId"
                  value={formData.produitId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Sélectionner un produit</option>
                  {produits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Compagnie
                </label>
                <Select
                  name="compagnieId"
                  value={formData.compagnieId}
                  onChange={handleInputChange}
                >
                  <option value="">Sélectionner une compagnie</option>
                  {compagnies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant *
                </label>
                <Input
                  name="montant"
                  type="number"
                  value={formData.montant}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Financement
                </label>
                <Select
                  name="financement"
                  value={formData.financement}
                  onChange={handleInputChange}
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Crédit</option>
                  <option value="lombard">Lombard</option>
                  <option value="remploi">Remploi</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date opération *
              </label>
              <Input
                name="dateOperation"
                type="date"
                value={formData.dateOperation}
                onChange={handleInputChange}
                required
              />
            </div>

            {isManager && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consultant *
                </label>
                <Select
                  name="consultantId"
                  value={formData.consultantId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Sélectionner un consultant</option>
                  {consultants.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.prenom} {c.nom}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commentaire
              </label>
              <textarea
                name="commentaire"
                value={formData.commentaire}
                onChange={handleInputChange}
                placeholder="Ajouter un commentaire..."
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={loading} className="gap-2">
            {loading && <Loader2 size={18} className="animate-spin" />}
            Créer le dossier
          </Button>
          <Link href="/dossiers">
            <Button variant="outline">Annuler</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
