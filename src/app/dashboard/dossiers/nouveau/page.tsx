'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Produit, Compagnie, Consultant, TauxProduitCompagnie, TablesInsert } from '@/types/database'
import { useUser } from '@/hooks/use-user'
import Link from 'next/link'
import { ArrowLeft, Loader2, Heart, X, Search } from 'lucide-react'

interface FormData {
  nom: string; prenom: string; pays: string; ville: string; email: string; telephone: string
  categorie: string; produitId: string; compagnieId: string
  montant: string; financement: string; dateOperation: string; dateEntreeRelation: string; dateSignature: string
  statut: string; modeDetention: string; commentaire: string; consultantId: string
}

interface ClientInfo {
  id: string
  nom: string
  prenom: string | null
  pays: string
  ville?: string | null
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
  // Co-titulaire state
  const [coTitulaire, setCoTitulaire] = React.useState<ClientInfo | null>(null)
  const [coTitulaireSearch, setCoTitulaireSearch] = React.useState('')
  const [coTitulaireResults, setCoTitulaireResults] = React.useState<ClientInfo[]>([])
  const [coTitulaireSearching, setCoTitulaireSearching] = React.useState(false)
  const [linkedPartners, setLinkedPartners] = React.useState<ClientInfo[]>([])
  const [formData, setFormData] = React.useState<FormData>({
    nom: '', prenom: '', pays: '', ville: '', email: '', telephone: '',
    categorie: '', produitId: '', compagnieId: '',
    montant: '', financement: 'cash',
    dateOperation: new Date().toISOString().split('T')[0],
    dateEntreeRelation: new Date().toISOString().split('T')[0],
    dateSignature: new Date().toISOString().split('T')[0],
    statut: 'prospect', modeDetention: '', commentaire: '', consultantId: '',
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
            .select('id, nom, prenom, pays, ville, email, telephone, date_entree_relation')
            .eq('id', clientIdParam)
            .single()
          if (clientData && !clientError) {
            setExistingClient(clientData as ClientInfo)
            setExistingClientId(clientData.id)
            // Pre-fill the form with client data
            // Point 4.1 (2026-04-24) : si la fiche client a une date
            // d'entrée en relation, on la reprend par défaut dans le
            // dossier (l'utilisateur peut encore l'écraser). Sinon on
            // garde la date du jour (fallback initialisé L57).
            const clientDateEntree = (clientData as any).date_entree_relation as string | null
            setFormData(prev => ({
              ...prev,
              nom: clientData.nom,
              prenom: clientData.prenom || '',
              pays: clientData.pays,
              ville: (clientData as any).ville || '',
              email: clientData.email || '',
              telephone: clientData.telephone || '',
              dateEntreeRelation: clientDateEntree || prev.dateEntreeRelation,
            }))
          }
        }
      } catch (err) {
        // Error silenced - fetch data failed
      } finally { setLoadingData(false) }
    }
    fetchData()
  }, [supabase, clientIdParam])

  React.useEffect(() => {
    if (consultant?.id) setFormData(prev => ({ ...prev, consultantId: prev.consultantId || consultant.id }))
  }, [consultant])

  // Fetch linked partners (couple/famille) when client is known
  React.useEffect(() => {
    if (!existingClientId) { setLinkedPartners([]); return }
    const fetchPartners = async () => {
      const { data: relations } = await supabase
        .from('client_relations')
        .select('*')
        .or(`client_id_1.eq.${existingClientId},client_id_2.eq.${existingClientId}`)
      if (!relations || relations.length === 0) return
      const partnerIds = relations
        .filter((r: any) => ['concubinage', 'marie', 'pacse'].includes(r.type_relation))
        .map((r: any) => r.client_id_1 === existingClientId ? r.client_id_2 : r.client_id_1)
      if (partnerIds.length === 0) return
      const { data: partners } = await supabase
        .from('clients')
        .select('id, nom, prenom, pays, ville, email, telephone')
        .in('id', partnerIds)
      if (partners) setLinkedPartners(partners as ClientInfo[])
    }
    fetchPartners()
  }, [existingClientId, supabase])

  // Search co-titulaire
  React.useEffect(() => {
    if (coTitulaireSearch.length < 2) { setCoTitulaireResults([]); return }
    const timer = setTimeout(async () => {
      setCoTitulaireSearching(true)
      const term = `%${coTitulaireSearch}%`
      let query = supabase
        .from('clients')
        .select('id, nom, prenom, pays, ville, email, telephone')
        .or(`nom.ilike.${term},prenom.ilike.${term}`)
        .limit(6)
      if (existingClientId) {
        query = query.neq('id', existingClientId)
      }
      const { data, error } = await query
      // debug removed
      setCoTitulaireResults((data || []) as ClientInfo[])
      setCoTitulaireSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [coTitulaireSearch, existingClientId, supabase])

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

  // Retours Maxine 2026-04-27 : la catégorie (SCPI / PE / CAV / GIRARDIN / SG…)
  // doit être sélectionnable dès la création du dossier pour que la grille
  // de rémunération s'applique correctement (cas Florent Sygall : sans
  // catégorie, le moteur ne savait pas piocher la grille CAV).
  // La liste est dérivée des produits.categorie côté DB → pas d'enum hardcodé.
  const categoriesDisponibles = React.useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const p of produits) if (p.categorie) set.add(p.categorie)
    return Array.from(set).sort()
  }, [produits])

  // Produits filtrés par catégorie sélectionnée (si présente).
  const produitsFiltres = React.useMemo(() => {
    if (!formData.categorie) return produits
    return produits.filter(p => p.categorie === formData.categorie)
  }, [produits, formData.categorie])

  // Reset produit_id quand la catégorie change si le produit courant
  // n'appartient plus à la nouvelle catégorie.
  React.useEffect(() => {
    if (!formData.produitId || !formData.categorie) return
    const current = produits.find(p => p.id === formData.produitId)
    if (current && current.categorie !== formData.categorie) {
      setFormData(prev => ({ ...prev, produitId: '' }))
    }
  }, [formData.categorie, formData.produitId, produits])

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
          .from('clients').insert({ nom: formData.nom, prenom: formData.prenom || null, pays: formData.pays, ville: formData.ville || null, email: formData.email || null, telephone: formData.telephone || null })
          .select().single()
        if (clientError) throw clientError
        clientIdForDossier = clientData.id
      }

      const dossierPayload: TablesInsert<'dossiers'> = {
        client_id: clientIdForDossier,
        co_titulaire_id: coTitulaire?.id || null,
        consultant_id: formData.consultantId,
        produit_id: formData.produitId || null,
        compagnie_id: formData.compagnieId || null,
        montant: parseFloat(formData.montant),
        financement: (formData.financement as any) || null,
        date_operation: formData.dateOperation || new Date().toISOString().split('T')[0],
        // Point 4.1 (2026-04-24) : persister la date d'entrée en relation
        // sur le dossier. Ce champ était oublié du payload — conséquence :
        // les dossiers sortaient avec date_entree_en_relation NULL même
        // quand l'utilisateur la renseignait dans le formulaire.
        date_entree_en_relation: formData.dateEntreeRelation || null,
        date_signature: formData.dateSignature || null,
        mode_detention: (formData.modeDetention || null) as any,
        statut: formData.statut as any,
        commentaire: formData.commentaire || null,
      }
      const { data: dossierData, error: dossierError } = await supabase
        .from('dossiers').insert(dossierPayload).select().single()
      if (dossierError) throw dossierError

      // Facture is auto-created by on_dossier_finalise trigger on INSERT.
      // As safety net, check if facture exists and create one if trigger didn't.
      const { data: existingFacture } = await supabase.from('factures').select('id').eq('dossier_id', dossierData.id).maybeSingle()
      if (!existingFacture) {
        await supabase.from('factures').insert({ dossier_id: dossierData.id, facturee: false, payee: 'non' })
      }
      router.push(`/dashboard/dossiers/${dossierData.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création du dossier'
      setError(message)
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ville</label>
                  <p className="text-sm text-gray-900 font-medium">{formData.ville || '-'}</p>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <Input name="ville" value={formData.ville} onChange={handleInputChange} placeholder="Paris" />
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

        {/* Co-titulaire (opération conjointe) */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart size={18} className="text-pink-500" />
              Co-titulaire (opération conjointe)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coTitulaire ? (
              <div className="flex items-center gap-3 p-3 bg-pink-50 border border-pink-200 rounded-lg">
                <Heart size={16} className="text-pink-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{coTitulaire.prenom} {coTitulaire.nom}</p>
                  {coTitulaire.email && <p className="text-xs text-gray-500">{coTitulaire.email}</p>}
                </div>
                <button type="button" onClick={() => setCoTitulaire(null)} className="p-1 hover:bg-pink-100 rounded transition-colors">
                  <X size={14} className="text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedPartners.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Partenaire lié</p>
                    {linkedPartners.map(p => (
                      <button key={p.id} type="button" onClick={() => setCoTitulaire(p)}
                        className="w-full flex items-center gap-2 p-2.5 text-left bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 transition-colors">
                        <Heart size={14} className="text-pink-400 shrink-0" />
                        <span className="text-sm font-medium text-gray-900">{p.prenom} {p.nom}</span>
                        <span className="text-xs text-pink-600 ml-auto">Sélectionner</span>
                      </button>
                    ))}
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                      <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">ou rechercher un autre client</span></div>
                    </div>
                  </div>
                )}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un co-titulaire..."
                    value={coTitulaireSearch}
                    onChange={(e) => setCoTitulaireSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-pink-400 focus:border-pink-400"
                  />
                </div>
                {coTitulaireSearching && <p className="text-xs text-gray-400">Recherche...</p>}
                {coTitulaireResults.length > 0 && (
                  <div className="border border-gray-200 rounded bg-white max-h-40 overflow-y-auto">
                    {coTitulaireResults.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setCoTitulaire(c); setCoTitulaireSearch(''); setCoTitulaireResults([]) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-pink-50 transition-colors">
                        {c.prenom} {c.nom}
                      </button>
                    ))}
                  </div>
                )}
                {!coTitulaire && linkedPartners.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Optionnel — sélectionnez un co-titulaire pour une opération conjointe (couple marié, pacsé, etc.)</p>
                )}
              </div>
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
                <option value="non_abouti">Non abouti</option>
              </Select>
            </div>

            {/* Catégorie (filtre les produits proposés) — retour Maxine 2026-04-27 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <Select name="categorie" value={formData.categorie} onChange={handleInputChange}>
                <option value="">— Toutes —</option>
                {categoriesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <p className="text-xs text-gray-500 mt-1">SCPI, PE, CAV, GIRARDIN… détermine la grille de rémunération applicable.</p>
            </div>

            {/* Produit + Compagnie (tous les deux optionnels) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produit</label>
                <Select name="produitId" value={formData.produitId} onChange={handleInputChange}>
                  <option value="">— Aucun —</option>
                  {produitsFiltres.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
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

            {/* Mode de détention */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode de détention</label>
              <Select name="modeDetention" value={formData.modeDetention} onChange={handleInputChange}>
                <option value="">Non défini</option>
                <option value="PP">Pleine Propriété</option>
                <option value="NP">Nue-Propriété</option>
                <option value="US">Usufruit</option>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date d'entrée en relation</label>
                <Input name="dateEntreeRelation" type="date" value={formData.dateEntreeRelation} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date opération</label>
                <Input name="dateOperation" type="date" value={formData.dateOperation} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de signature</label>
                <Input name="dateSignature" type="date" value={formData.dateSignature} onChange={handleInputChange} />
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
