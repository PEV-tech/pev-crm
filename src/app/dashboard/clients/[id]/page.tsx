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
  Mail, Phone, CreditCard, FolderOpen, ExternalLink, Plus, Send, Clock,
} from 'lucide-react'

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
}

function GoogleSuiteCard({ clientName, clientEmail }: { clientName: string; clientEmail: string | null }) {
  const driveSearchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(clientName)}`
  const calendarCreateUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`RDV - ${clientName}`)}&details=${encodeURIComponent(`Rendez-vous client : ${clientName}`)}`
  const gmailComposeUrl = clientEmail
    ? `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(clientEmail)}&su=${encodeURIComponent(`PEV - ${clientName}`)}`
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ExternalLink size={18} className="text-gray-600" />
          Google Suite
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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

        {/* Google Calendar */}
        <a
          href={calendarCreateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50/50 transition-colors group"
        >
          <div className="bg-green-100 p-1.5 rounded-md">
            <Calendar size={16} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 group-hover:text-green-700">Google Agenda</p>
            <p className="text-xs text-gray-500">Créer un rendez-vous</p>
          </div>
          <Plus size={14} className="text-gray-400 group-hover:text-green-500" />
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

export default function ClientDetailPage() {
  const params = useParams()
  const clientId = params.id as string
  const { consultant: currentUser } = useUser()
  const isConsultant = currentUser?.role === 'consultant'

  const [client, setClient] = React.useState<ClientInfo | null>(null)
  const [dossiers, setDossiers] = React.useState<ClientDossier[]>([])
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)

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

        // Fetch all dossiers for this client via view
        const { data: dossierData } = await supabase
          .from('v_dossiers_complets')
          .select('*')
          .eq('client_id', clientId)
          .order('date_operation', { ascending: false })

        setDossiers(dossierData || [])
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [clientId, supabase])

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

  // Compliance
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
              <CardTitle className="flex items-center gap-2">
                <FileText size={20} className="text-gray-600" />
                Dossiers ({dossiers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dossiers.length > 0 ? (
                <div className="space-y-3">
                  {dossiers.map(d => (
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
                            <span>{formatCurrency(d.montant)}</span>
                            <span>{d.financement || '-'}</span>
                            {d.date_operation && (
                              <span>{new Date(d.date_operation).toLocaleDateString('fr-FR')}</span>
                            )}
                            {d.consultant_prenom && (
                              <span>{d.consultant_prenom} {d.consultant_nom}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(isConsultant ? d.rem_apporteur : d.commission_brute)}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {d.facturee && <Badge variant="success" className="text-[10px] px-1.5">Facturée</Badge>}
                            {d.payee === 'oui' && <Badge variant="success" className="text-[10px] px-1.5">Payée</Badge>}
                          </div>
                        </div>
                      </div>
                    </Link>
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
              <CardTitle className="flex items-center gap-2 text-lg">
                <User size={18} className="text-gray-600" />
                Coordonnées
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
              {client.conformite && (
                <div className="pt-2 border-t">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    client.conformite === 'conforme' ? 'bg-green-100 text-green-700' :
                    client.conformite === 'non conforme' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>O2S: {client.conformite}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Suite Integration */}
          <GoogleSuiteCard clientName={fullName} clientEmail={client.email} />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield size={18} className="text-gray-600" />
                  Réglementaire
                </CardTitle>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  complianceDone === 6 ? 'bg-green-100 text-green-700' :
                  complianceDone >= 4 ? 'bg-blue-100 text-blue-700' :
                  complianceDone >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>{complianceDone}/6</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>

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
