'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Consultant } from '@/types/database'
import { useUser } from '@/hooks/use-user'
import Link from 'next/link'
import { ArrowLeft, Loader2, Heart, X, Search, Plus } from 'lucide-react'

// Fiche de creation client autonome (sans dossier).
// Contrairement a /dashboard/dossiers/nouveau qui exige montant/consultant et
// cree un dossier en meme temps, cette page est permissive : seul le nom est
// strictement requis, tout le reste est optionnel. Un client peut exister sans
// aucun projet rattache.
interface ClientLite {
  id: string
  nom: string
  prenom: string | null
  email: string | null
}

interface FormData {
  nom: string
  prenom: string
  pays: string
  ville: string
  email: string
  telephone: string
  dateEntreeRelation: string
  consultantId: string
  commentaire: string
}

function NewClientContent() {
  const router = useRouter()
  const { consultant } = useUser()

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')

  const [consultants, setConsultants] = React.useState<Consultant[]>([])
  const [paysList, setPaysList] = React.useState<string[]>([])
  const [addingPays, setAddingPays] = React.useState(false)
  const [newPaysDraft, setNewPaysDraft] = React.useState('')
  const [loadingData, setLoadingData] = React.useState(true)

  // Co-titulaire (optionnel) : lien via client_relations
  const [coTitulaire, setCoTitulaire] = React.useState<ClientLite | null>(null)
  const [coTitulaireSearch, setCoTitulaireSearch] = React.useState('')
  const [coTitulaireResults, setCoTitulaireResults] = React.useState<ClientLite[]>([])
  const [coTitulaireSearching, setCoTitulaireSearching] = React.useState(false)

  const [formData, setFormData] = React.useState<FormData>({
    nom: '',
    prenom: '',
    pays: '',
    ville: '',
    email: '',
    telephone: '',
    dateEntreeRelation: new Date().toISOString().split('T')[0],
    consultantId: '',
    commentaire: '',
  })

  const supabase = React.useMemo(() => createClient(), [])

  // Bootstrap : consultants actifs + liste distincte des pays deja enregistres.
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [consultantsRes, paysRes] = await Promise.all([
          supabase.from('consultants').select('*').eq('actif', true).order('prenom'),
          supabase.from('clients').select('pays').not('pays', 'is', null),
        ])
        if (consultantsRes.data) setConsultants(consultantsRes.data)
        if (paysRes.data) {
          const distinct = Array.from(
            new Set(
              paysRes.data
                .map((r: any) => (r.pays || '').trim())
                .filter((p: string) => p.length > 0)
            )
          ).sort((a, b) => a.localeCompare(b, 'fr'))
          setPaysList(distinct)
        }
      } catch {
        // silencieux : la page reste utilisable meme si les listes n'ont pas charge
      } finally {
        setLoadingData(false)
      }
    }
    fetchData()
  }, [supabase])

  // Pre-remplir le consultant proprietaire pour les non-managers.
  React.useEffect(() => {
    if (consultant?.id) {
      setFormData(prev => ({ ...prev, consultantId: prev.consultantId || consultant.id }))
    }
  }, [consultant])

  // Recherche co-titulaire debounced
  React.useEffect(() => {
    if (coTitulaireSearch.length < 2) {
      setCoTitulaireResults([])
      return
    }
    const timer = setTimeout(async () => {
      setCoTitulaireSearching(true)
      const term = `%${coTitulaireSearch}%`
      const { data } = await supabase
        .from('clients')
        .select('id, nom, prenom, email')
        .or(`nom.ilike.${term},prenom.ilike.${term}`)
        .limit(6)
      setCoTitulaireResults((data || []) as ClientLite[])
      setCoTitulaireSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [coTitulaireSearch, supabase])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handlePaysChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === '__add_new__') {
      setAddingPays(true)
      setNewPaysDraft('')
    } else {
      setFormData(prev => ({ ...prev, pays: value }))
    }
  }

  const confirmNewPays = () => {
    const clean = newPaysDraft.trim()
    if (!clean) return
    // Ajoute a la liste locale, selectionne, et sort du mode saisie.
    setPaysList(prev => Array.from(new Set([...prev, clean])).sort((a, b) => a.localeCompare(b, 'fr')))
    setFormData(prev => ({ ...prev, pays: clean }))
    setAddingPays(false)
    setNewPaysDraft('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      // Seul le nom est strictement requis pour une fiche client.
      if (!formData.nom.trim()) {
        setError('Le nom est obligatoire.')
        setLoading(false)
        return
      }

      // Le schema impose pays NOT NULL. On autorise une valeur vide coté UI mais
      // on force une valeur par defaut pour ne pas casser l'insert.
      const paysResolved = formData.pays.trim() || 'Non renseigné'

      const { data: inserted, error: insertErr } = await supabase
        .from('clients')
        .insert({
          nom: formData.nom.trim(),
          prenom: formData.prenom.trim() || null,
          pays: paysResolved,
          ville: formData.ville.trim() || null,
          email: formData.email.trim() || null,
          telephone: formData.telephone.trim() || null,
          consultant_id: formData.consultantId || null,
          date_entree_relation: formData.dateEntreeRelation || null,
          commentaires: formData.commentaire.trim() || null,
        })
        .select()
        .single()

      if (insertErr) throw insertErr
      if (!inserted) throw new Error('Insertion sans retour de ligne')

      // Co-titulaire : lien bidirectionnel via client_relations (type marie par defaut).
      // Si ca echoue, on ne bloque pas la creation du client.
      if (coTitulaire?.id) {
        const { error: relErr } = await supabase
          .from('client_relations')
          .insert({
            client_id_1: inserted.id,
            client_id_2: coTitulaire.id,
            type_relation: 'marie',
          } as any)
        if (relErr) {
          // Non bloquant : on remonte un warning mais on a bien cree le client.
          // L'utilisateur pourra ajouter le lien manuellement depuis la fiche.
          // eslint-disable-next-line no-console
          console.warn('[nouveau-client] echec ajout client_relations :', relErr.message)
        }
      }

      setSuccess('Client créé.')
      // Navigation vers la fiche client.
      router.push(`/dashboard/clients/${inserted.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création'
      setError(message)
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

  const isManager = consultant?.role === 'manager' || consultant?.role === 'gestionnaire'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ma-clientele">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft size={18} />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nouveau client</h1>
          <p className="text-gray-600 mt-1">
            Ajouter une fiche client. Seul le nom est requis, tout le reste peut être complété plus tard.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Informations client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <Input
                  name="nom"
                  value={formData.nom}
                  onChange={handleInputChange}
                  placeholder="Dupont"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <Input
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleInputChange}
                  placeholder="Jean"
                />
              </div>
            </div>

            {/* Pays : select sur les pays deja enregistres + option "+ Ajouter" */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
              {addingPays ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newPaysDraft}
                    onChange={(e) => setNewPaysDraft(e.target.value)}
                    placeholder="Nom du nouveau pays"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        confirmNewPays()
                      } else if (e.key === 'Escape') {
                        setAddingPays(false)
                        setNewPaysDraft('')
                      }
                    }}
                  />
                  <Button type="button" onClick={confirmNewPays} disabled={!newPaysDraft.trim()}>
                    Ajouter
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAddingPays(false)
                      setNewPaysDraft('')
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              ) : (
                <Select name="pays" value={formData.pays} onChange={handlePaysChange}>
                  <option value="">— Non renseigné —</option>
                  {paysList.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value="__add_new__">+ Ajouter un nouveau pays…</option>
                </Select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <Input
                name="ville"
                value={formData.ville}
                onChange={handleInputChange}
                placeholder="Paris"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="client@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <Input
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleInputChange}
                  placeholder="+33 6 12 34 56 78"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date d&apos;entrée en relation
                </label>
                <Input
                  name="dateEntreeRelation"
                  type="date"
                  value={formData.dateEntreeRelation}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consultant</label>
                {isManager ? (
                  <Select
                    name="consultantId"
                    value={formData.consultantId}
                    onChange={handleInputChange}
                  >
                    <option value="">— Aucun —</option>
                    {consultants.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.prenom} {c.nom}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-gray-700 py-2 text-sm">
                    {consultant?.prenom} {consultant?.nom}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Co-titulaire */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart size={18} className="text-pink-500" />
              Co-titulaire
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coTitulaire ? (
              <div className="flex items-center gap-3 p-3 bg-pink-50 border border-pink-200 rounded-lg">
                <Heart size={16} className="text-pink-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {coTitulaire.prenom} {coTitulaire.nom}
                  </p>
                  {coTitulaire.email && (
                    <p className="text-xs text-gray-500">{coTitulaire.email}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCoTitulaire(null)}
                  className="p-1 hover:bg-pink-100 rounded transition-colors"
                >
                  <X size={14} className="text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Rechercher un client existant…"
                    value={coTitulaireSearch}
                    onChange={(e) => setCoTitulaireSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-pink-400 focus:border-pink-400"
                  />
                </div>
                {coTitulaireSearching && (
                  <p className="text-xs text-gray-400">Recherche...</p>
                )}
                {coTitulaireResults.length > 0 && (
                  <div className="border border-gray-200 rounded bg-white max-h-40 overflow-y-auto">
                    {coTitulaireResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCoTitulaire(c)
                          setCoTitulaireSearch('')
                          setCoTitulaireResults([])
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-pink-50 transition-colors"
                      >
                        {c.prenom} {c.nom}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 italic">
                  Optionnel — lien bidirectionnel enregistré dans client_relations (type « marié »
                  par défaut, modifiable ensuite).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Commentaire */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Commentaire</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              name="commentaire"
              value={formData.commentaire}
              onChange={handleInputChange}
              placeholder="Notes internes (optionnel)…"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={loading} className="gap-2">
            {loading && <Loader2 size={18} className="animate-spin" />}
            <Plus size={16} />
            Créer le client
          </Button>
          <Link href="/dashboard/ma-clientele">
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}

export default function NewClientPage() {
  return <NewClientContent />
}
