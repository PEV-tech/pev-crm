'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  Mail, Phone, CreditCard, FolderOpen, ExternalLink, Plus, Send, Clock, Pencil, Save, X, Trash2, Loader2,
} from 'lucide-react'
import { ClientRelances } from '@/components/shared/client-relances'
import { JournalSuivi } from '@/components/shared/journal-suivi'
import { ClientRelations } from '@/components/shared/client-relations'
import CommunicationsTab from '@/components/google/CommunicationsTab'
import { PiecesJointes } from '@/components/clients/pieces-jointes'
import { KYCSection, KYCSectionHandle } from '@/components/clients/kyc-section'
import { KYCUpload } from '@/components/clients/kyc-upload'

import { formatCurrency } from '@/lib/formatting'

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
  apporteur_ext_nom: string | null
  has_apporteur_ext: boolean | null
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


export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string
  const { consultant: currentUser } = useUser()
  const [deletingClient, setDeletingClient] = React.useState(false)
  const [showDeleteClientConfirm, setShowDeleteClientConfirm] = React.useState(false)
  const isConsultant = currentUser?.role === 'consultant'

  const [client, setClient] = React.useState<ClientInfo | null>(null)
  const [dossiers, setDossiers] = React.useState<ClientDossier[]>([])
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const kycRef = React.useRef<KYCSectionHandle>(null)

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
        ville: '',
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
                    ville: clientData.ville || '',
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

        // Fetch all dossiers for this client (as titulaire or co-titulaire) via view
        const { data: dossierData } = await supabase
          .from('v_dossiers_complets')
          .select('*')
          .or(`client_id.eq.${clientId},co_titulaire_id.eq.${clientId}`)
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

  const handleDeleteClient = async () => {
    if (!client?.id) return
    setDeletingClient(true)
    try {
      const sb = createClient()
      const { data: ds } = await sb.from('dossiers').select('id').eq('client_id', client.id)
      if (ds?.length) {
        for (const d of ds) {
                await sb.from('dossier_documents').delete().eq('dossier_id', d.id)
                      await sb.from('relances').delete().eq('dossier_id', d.id)
          await sb.from('factures').delete().eq('dossier_id', d.id)
          await sb.from('commissions').delete().eq('dossier_id', d.id)
        }
            await sb.from('relances').delete().eq('client_id', client.id)
        await sb.from('dossiers').delete().eq('client_id', client.id)
      }
      await sb.from('clients').delete().eq('id', client.id)
      router.push('/dashboard/dossiers')
    } catch (e) { console.error(e); setDeletingClient(false); setShowDeleteClientConfirm(false) }
  }
  const handleSaveContact = async () => {
    if (!client) return
    setSavingContact(true)
    const { error } = await supabase
      .from('clients')
      .update({
        email: editContact.email || null,
        telephone: editContact.telephone || null,
        pays: editContact.pays || null,
              ville: editContact.ville || null,
        numero_compte: editContact.numero_compte || null,
        google_drive_url: editContact.google_drive_url || null,
      })
      .eq('id', clientId)
          if (error) { alert('Erreur sauvegarde: ' + error.message); console.error(error) } else {}
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
        statut_kyc: editReg.statut_kyc as 'non' | 'en_cours' | 'oui',
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

  // handleSaveNotes removed â replaced by JournalSuivi component

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

  // Compliance â 6 champs : KYC/Réglementaire, DER, PI, PRECO, LM, RM
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
      <div className="flex items-center justify-between">
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
        {!isConsultant && (
          <div className="flex items-center gap-2">
            {showDeleteClientConfirm ? (
              <>
                <span className="text-sm text-red-600 font-medium">Confirmer ?</span>
                <Button size="sm" variant="outline" onClick={() => setShowDeleteClientConfirm(false)}>Annuler</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-2" onClick={handleDeleteClient} disabled={deletingClient}>
                  {deletingClient ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}Supprimer
                </Button>
              </>
            ) : (
              <>
                <KYCUpload onDataParsed={(data) => {
                  if (!kycRef.current) return
                  // Determine which person (titulaire or conjoint) matches this client
                  // by comparing last names (nom)
                  const clientNom = (client.nom || '').toLowerCase().trim()
                  const clientPrenom = (client.prenom || '').toLowerCase().trim()
                  const tNom = (data.titulaire?.nom || '').toLowerCase().trim()
                  const cNom = (data.conjoint?.nom || '').toLowerCase().trim()
                  const tPrenom = (data.titulaire?.prenom || '').toLowerCase().trim()
                  const cPrenom = (data.conjoint?.prenom || '').toLowerCase().trim()

                  let personData = data.titulaire // default
                  if (clientNom && cNom && clientNom === cNom) {
                    // Last name matches conjoint
                    if (!tNom || clientNom !== tNom || clientPrenom === cPrenom) {
                      personData = data.conjoint
                    }
                  } else if (clientPrenom && cPrenom && clientPrenom === cPrenom && clientNom !== tNom) {
                    personData = data.conjoint
                  }

                  // Merge shared fields from titulaire (matrimonial, enfants, objectifs, immobilier, emprunts, fiscalité)
                  // These are household-level, not individual
                  const shared = data.titulaire || {}

                  // Filter produits financiers: keep only client's own + shared (CTE/commun/empty)
                  const clientFirstName = (personData.prenom || client.prenom || '').toLowerCase().trim()
                  const otherFirstName = personData === data.conjoint
                    ? (data.titulaire?.prenom || '').toLowerCase().trim()
                    : (data.conjoint?.prenom || '').toLowerCase().trim()
                  const allProduits = shared.produits_financiers || personData.produits_financiers || []
                  const filteredProduits = allProduits.filter((p: any) => {
                    const det = (p.detenteur || '').toLowerCase().trim()
                    if (!det) return true // no detenteur = include
                    if (det === 'cte' || det === 'commun' || det === 'les deux') return true
                    if (det === clientFirstName) return true
                    if (det === otherFirstName) return false // other person's product
                    return true // unknown detenteur = include
                  })

                  const merged = {
                    ...personData,
                    situation_matrimoniale: personData.situation_matrimoniale || shared.situation_matrimoniale,
                    regime_matrimonial: personData.regime_matrimonial || shared.regime_matrimonial,
                    nombre_enfants: personData.nombre_enfants ?? shared.nombre_enfants,
                    enfants_details: personData.enfants_details || shared.enfants_details,
                    patrimoine_immobilier: personData.patrimoine_immobilier || shared.patrimoine_immobilier,
                    produits_financiers: filteredProduits,
                    emprunts: personData.emprunts || shared.emprunts,
                    impot_revenu_n: personData.impot_revenu_n ?? shared.impot_revenu_n,
                    impot_revenu_n1: personData.impot_revenu_n1 ?? shared.impot_revenu_n1,
                    impot_revenu_n2: personData.impot_revenu_n2 ?? shared.impot_revenu_n2,
                    objectifs_client: personData.objectifs_client || shared.objectifs_client,
                    total_revenus_annuel: personData.total_revenus_annuel ?? shared.total_revenus_annuel,
                  }

                  kycRef.current.populateFromKyc(merged)
                }} />
                <Button size="sm" variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowDeleteClientConfirm(true)}>
                  <Trash2 size={14} />Supprimer le client
                </Button>
              </>
            )}
          </div>
        )}
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
                                {d.apporteur_ext_nom && (
                                  <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">· {d.apporteur_ext_nom}</span>
                                )}
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

          {/* KYC Section */}
          <KYCSection
            ref={kycRef}
            client={client}
            onUpdate={async () => {
              const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
              if (data) setClient(data as ClientInfo)
            }}
          />
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
                      type="text"
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
                                          ville: client.ville || '',
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
          <CommunicationsTab
            clientEmail={client.email}
            clientName={fullName}
            clientId={client.id}
            currentUserId={currentUser?.id}
            currentUserNom={currentUser ? `${currentUser.prenom} ${currentUser.nom}` : undefined}
          />

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
          <PiecesJointes clientId={clientId} currentUserId={currentUser?.id} />

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
