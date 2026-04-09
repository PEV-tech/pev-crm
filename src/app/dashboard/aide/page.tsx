'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, ChevronRight, LayoutDashboard, FolderOpen, Users, FileText,
  CreditCard, DollarSign, Bell, Shield, BarChart2, Settings, Mail, Calendar,
  Plus, Search, Filter, Eye, Pencil, Trash2, CheckCircle, AlertCircle,
  ArrowRight, Star, Zap, Lock, ExternalLink, HelpCircle, Home,
  TrendingUp, Clock, Paperclip, RefreshCw, FolderSearch,
} from 'lucide-react'

const sections = [
  { id: 'bienvenue', label: 'Bienvenue', icon: Star },
  { id: 'navigation', label: 'Navigation', icon: LayoutDashboard },
  { id: 'dossiers', label: 'Dossiers', icon: FolderOpen },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'facturation', label: 'Facturation', icon: CreditCard },
  { id: 'encaissements', label: 'Encaissements', icon: DollarSign },
  { id: 'relances', label: 'Relances', icon: Bell },
  { id: 'reglementaire', label: 'Réglementaire', icon: Shield },
  { id: 'analyse', label: 'Analyse', icon: BarChart2 },
  { id: 'google', label: '🆕 Google Integration', icon: Mail },
  { id: 'parametres', label: 'Paramètres', icon: Settings },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
]

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: any; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-100 p-2.5 rounded-xl">
          <Icon className="w-6 h-6 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  )
}

function Card({ title, children, color = 'gray' }: { title?: string; children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-white border-gray-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    amber: 'bg-amber-50 border-amber-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    purple: 'bg-purple-50 border-purple-200',
  }
  return (
    <div className={`border rounded-xl p-5 ${colors[color] || colors.gray}`}>
      {title && <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>}
      {children}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">{n}</div>
      <div className="flex-1 pb-6">
        <p className="font-semibold text-gray-900 mb-1">{title}</p>
        <p className="text-sm text-gray-600">{children}</p>
      </div>
    </div>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    red: 'bg-red-100 text-red-700 border-red-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[color] || colors.gray}`}>
      {children}
    </span>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">{children}</p>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-800">{children}</p>
    </div>
  )
}

export default function AidePage() {
  const [activeSection, setActiveSection] = useState('bienvenue')

  const scrollTo = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex gap-8 min-h-screen">
      {/* Sidebar sticky */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-6 bg-white border border-gray-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-gray-900">Manuel d'utilisation</span>
          </div>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeSection === s.id
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <s.icon className="w-4 h-4 flex-shrink-0" />
              {s.label}
            </button>
          ))}
          <div className="pt-4 border-t border-gray-100 mt-2">
            <Link href="/dashboard" className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
              <Home className="w-3.5 h-3.5" />
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-3xl space-y-16 pb-24">

        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Manuel PEV CRM</h1>
              <p className="text-indigo-200 text-sm mt-0.5">Guide complet — Consultants</p>
            </div>
          </div>
          <p className="text-indigo-100 leading-relaxed">
            Bienvenue dans le CRM de Private Equity Valley. Ce guide vous explique comment utiliser chaque fonctionnalité
            au quotidien pour gérer vos clients, dossiers et commissions efficacement.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            {['Dossiers', 'Clients', 'Facturation', 'Relances', 'Google Gmail/Calendar'].map(tag => (
              <span key={tag} className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">{tag}</span>
            ))}
          </div>
        </div>

        {/* SECTION BIENVENUE */}
        <Section id="bienvenue" title="Bienvenue dans le CRM" icon={Star}>
          <Card color="indigo">
            <p className="text-gray-700 leading-relaxed">
              Le CRM PEV est la plateforme centrale de gestion des opérations de Private Equity Valley.
              Il remplace les fichiers Excel (DELTA 2026) et centralise en un seul endroit : vos dossiers clients,
              la facturation, les relances, la réglementation et vos communications Gmail/Calendar.
            </p>
          </Card>

          <Card title="Qui peut faire quoi ?">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
                <div className="w-24 flex-shrink-0">
                  <Badge color="indigo">Consultant</Badge>
                </div>
                <p className="text-sm text-gray-700">Voir et gérer <strong>ses propres dossiers</strong>, ses clients, ses relances. Ne voit pas les dossiers des autres consultants.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <div className="w-24 flex-shrink-0">
                  <Badge color="green">Manager</Badge>
                </div>
                <p className="text-sm text-gray-700">Accès complet à <strong>tous les dossiers</strong>, toutes les fiches clients, la facturation globale, les encaissements, l'analyse.</p>
              </div>
            </div>
          </Card>

          <Card title="Accès au CRM">
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-4">
              <ExternalLink className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="font-medium text-gray-900">pev-crm.vercel.app</p>
                <p className="text-xs text-gray-500 mt-0.5">Connexion avec votre compte @private-equity-valley.com</p>
              </div>
            </div>
          </Card>
        </Section>

        {/* SECTION NAVIGATION */}
        <Section id="navigation" title="Navigation & Interface" icon={LayoutDashboard}>
          <Card title="Le tableau de bord (page d'accueil)">
            <p className="text-sm text-gray-600 mb-4">La page d'accueil affiche vos indicateurs clés :</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Collecte finalisée', desc: 'Total AUM de vos dossiers clôturés' },
                { label: 'Pipeline en cours', desc: 'Dossiers en cours de finalisation' },
                { label: 'Commissions dues', desc: 'Ce qui vous est dû et non encore payé' },
                { label: 'Relances actives', desc: 'Nombre de relances à traiter aujourd'hui' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Menu de navigation (barre latérale gauche)">
            <div className="space-y-2">
              {[
                { icon: '📊', label: 'Tableau de bord', desc: 'Vue d'ensemble & KPIs' },
                { icon: '📁', label: 'Dossiers', desc: 'Tous vos dossiers clients' },
                { icon: '👤', label: 'Ma clientèle', desc: 'Fiches clients détaillées' },
                { icon: '💶', label: 'Facturation', desc: 'Commissions à émettre / émises' },
                { icon: '✅', label: 'Encaissements', desc: 'Commissions reçues et payées' },
                { icon: '🔔', label: 'Relances', desc: 'Suivi des relances clients/dossiers' },
                { icon: '🛡️', label: 'Réglementaire', desc: 'Conformité des clients' },
                { icon: '📈', label: 'Analyse', desc: 'Statistiques et rapports' },
                { icon: '⚙️', label: 'Paramètres', desc: 'Votre profil et connexions' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-lg w-8">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Tip>
            Le CRM s'adapte à votre rôle : en tant que consultant, vous ne voyez que vos propres données.
            Les managers voient l'ensemble de l'activité du cabinet.
          </Tip>
        </Section>

        {/* SECTION DOSSIERS */}
        <Section id="dossiers" title="Gérer les Dossiers" icon={FolderOpen}>
          <p className="text-gray-600">Un dossier représente une opération d'investissement d'un client (SCPI, PE, CAV LUX, etc.).</p>

          <Card title="Créer un nouveau dossier">
            <div className="space-y-4">
              <Step n={1} title="Cliquer sur « Dossiers » dans le menu">
                Accédez à la liste de tous vos dossiers en cours.
              </Step>
              <Step n={2} title='Cliquer le bouton "Nouveau dossier"'>
                Un formulaire s'ouvre. Renseignez les informations de l'opération.
              </Step>
              <Step n={3} title="Remplir les champs obligatoires">
                Client, produit, compagnie, montant, type de financement (cash/crédit/lombard/remploi), date d'opération.
              </Step>
              <Step n={4} title="Sauvegarder">
                Le dossier apparaît dans votre liste avec le statut "Prospect".
              </Step>
            </div>
          </Card>

          <Card title="Statuts d'un dossier">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <Badge color="gray">Prospect</Badge>
                <p className="text-sm text-gray-700">Premier contact, opération non encore engagée</p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50">
                <Badge color="blue">Client en cours</Badge>
                <p className="text-sm text-gray-700">Souscription lancée, en attente de finalisation</p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50">
                <Badge color="green">Client finalisé</Badge>
                <p className="text-sm text-gray-700">Opération terminée, commission due</p>
              </div>
            </div>
          </Card>

          <Card title="Types de produits disponibles">
            <div className="flex flex-wrap gap-2">
              {['SCPI', 'Private Equity', 'CAV LUX', 'CAPI LUX', 'Trilake', 'Girardin'].map(p => (
                <span key={p} className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full border border-indigo-200 font-medium">{p}</span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Chaque produit a ses propres règles de commissionnement qui s'appliquent automatiquement.</p>
          </Card>

          <Card title="Types de financement">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Cash', desc: 'Paiement comptant' },
                { label: 'Crédit', desc: 'Financement bancaire classique' },
                { label: 'Lombard', desc: 'Prêt sur nantissement de portefeuille' },
                { label: 'Remploi', desc: 'Réinvestissement de capitaux existants' },
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-sm text-gray-900">{f.label}</p>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Commissions — calcul automatique">
            <p className="text-sm text-gray-600 mb-3">
              Dès qu'un dossier est créé, le CRM calcule automatiquement la décomposition des commissions selon les règles PEV :
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                <span className="text-gray-700">Commission brute cabinet</span>
                <Badge color="indigo">Calculée automatiquement</Badge>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                <span className="text-gray-700">Rémunération apporteur (vous)</span>
                <Badge color="green">Votre part</Badge>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-gray-700">Part Pool / Cabinet</span>
                <Badge color="gray">Selon règles PEV</Badge>
              </div>
            </div>
          </Card>

          <Tip>
            Modifiez le statut d'un dossier de "Client en cours" à "Client finalisé" dès que l'opération est confirmée —
            cela déclenche automatiquement la création de la commission dans la Facturation.
          </Tip>
        </Section>

        {/* SECTION CLIENTS */}
        <Section id="clients" title="Fiches Clients (Ma clientèle)" icon={Users}>
          <p className="text-gray-600">La section "Ma clientèle" centralise toutes les informations sur vos clients : coordonnées, historique des opérations, conformité, communications.</p>

          <Card title="Accéder à une fiche client">
            <div className="space-y-3">
              <Step n={1} title='Cliquer sur "Ma clientèle" dans le menu'>
                Liste de tous vos clients avec recherche et filtres.
              </Step>
              <Step n={2} title="Cliquer sur un nom de client">
                La fiche détaillée s'ouvre avec toutes les informations.
              </Step>
            </div>
          </Card>

          <Card title="Contenu d'une fiche client">
            <div className="space-y-3">
              {[
                { icon: '📊', label: 'KPIs en haut', desc: 'Collecte finalisée, pipeline, commissions, score de conformité' },
                { icon: '📁', label: 'Dossiers', desc: 'Tous les dossiers liés à ce client (cliquables pour accéder au détail)' },
                { icon: '📞', label: 'Coordonnées', desc: 'Email, téléphone, pays, numéro de compte — modifiables via le crayon' },
                { icon: '📧', label: 'Communications', desc: '🆕 Emails Gmail + RDV Google Calendar (si Google connecté)' },
                { icon: '🛡️', label: 'Réglementaire', desc: 'Statut KYC, DER, PI, LM, RM — modifiables' },
                { icon: '📝', label: 'Journal de suivi', desc: 'Historique des notes, appels, RDV, emails' },
                { icon: '📎', label: 'Pièces jointes', desc: 'Documents uploadés (RIB, pièce d'identité, contrats...)' },
                { icon: '🔔', label: 'Relances', desc: 'Suivi des relances liées à ce client' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Journal de suivi — tracer les interactions" color="blue">
            <p className="text-sm text-gray-700 mb-3">
              Chaque interaction avec un client doit être tracée dans le Journal de suivi.
              C'est votre historique de la relation client.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '📞 Appel', color: 'bg-blue-100 text-blue-700' },
                { label: '📧 Email', color: 'bg-green-100 text-green-700' },
                { label: '🤝 Compte rendu RDV', color: 'bg-purple-100 text-purple-700' },
                { label: '📋 Note interne', color: 'bg-amber-100 text-amber-700' },
                { label: '📨 Relance', color: 'bg-orange-100 text-orange-700' },
                { label: '📄 Document reçu', color: 'bg-indigo-100 text-indigo-700' },
              ].map(t => (
                <span key={t.label} className={`text-xs px-2.5 py-1 rounded-full ${t.color}`}>{t.label}</span>
              ))}
            </div>
          </Card>

          <Card title="Uploader des pièces jointes" color="gray">
            <p className="text-sm text-gray-600 mb-3">Dans chaque fiche client, section "Pièces jointes" :</p>
            <div className="space-y-2 text-sm text-gray-700">
              <p>1. Cliquer <strong>Ajouter</strong></p>
              <p>2. Sélectionner le fichier (PDF, image...)</p>
              <p>3. Choisir le <strong>type de document</strong> (RIB, pièce d'identité, contrat, réglementaire...)</p>
              <p>4. Indiquer la <strong>date du document</strong></p>
              <p>5. Cliquer <strong>Enregistrer</strong></p>
            </div>
          </Card>

          <Tip>
            Utilisez le journal de suivi après chaque appel ou réunion. Cela permet à tout le cabinet d'avoir
            une vision partagée de la relation avec le client.
          </Tip>
        </Section>

        {/* SECTION FACTURATION */}
        <Section id="facturation" title="Facturation" icon={CreditCard}>
          <p className="text-gray-600">La facturation gère l'émission de vos commissions. Un flux en deux états simples.</p>

          <Card title="Les deux états d'une commission">
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0"></div>
                <div>
                  <p className="font-semibold text-red-800">🔴 À émettre</p>
                  <p className="text-sm text-red-700">Commission calculée mais facture non encore envoyée à PEV</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <div className="w-4 h-4 bg-orange-500 rounded-full flex-shrink-0"></div>
                <div>
                  <p className="font-semibold text-orange-800">🟠 Émise</p>
                  <p className="text-sm text-orange-700">Facture envoyée, en attente de paiement</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0"></div>
                <div>
                  <p className="font-semibold text-green-800">✅ Payée → Encaissements</p>
                  <p className="text-sm text-green-700">Disparaît de la Facturation et passe dans les Encaissements</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Comment émettre une facture">
            <div className="space-y-3">
              <Step n={1} title='Aller dans "Facturation"'>
                Vous voyez toutes les commissions à émettre (en rouge).
              </Step>
              <Step n={2} title="Cliquer sur une ligne">
                Vérifier les montants et les détails de la commission.
              </Step>
              <Step n={3} title='"Marquer comme émise"'>
                La ligne passe en orange. Vous pouvez alors envoyer votre facture au service comptable.
              </Step>
            </div>
          </Card>

          <Warning>
            Ne marquez une commission comme "émise" que lorsque vous avez réellement envoyé votre facture.
            Cette action déclenche le suivi comptable.
          </Warning>
        </Section>

        {/* SECTION ENCAISSEMENTS */}
        <Section id="encaissements" title="Encaissements" icon={DollarSign}>
          <p className="text-gray-600">Les encaissements sont les commissions effectivement reçues et payées.</p>

          <Card>
            <p className="text-sm text-gray-700 leading-relaxed">
              Une fois qu'une commission est marquée comme <strong>payée</strong> par le back-office, elle disparaît
              de la Facturation et apparaît ici dans les Encaissements. C'est votre historique de paiements.
            </p>
          </Card>

          <Card title="Ce que vous voyez" color="green">
            <div className="space-y-2 text-sm text-gray-700">
              <p>• Date de paiement</p>
              <p>• Client et dossier concerné</p>
              <p>• Montant encaissé</p>
              <p>• Cumul de vos encaissements sur la période</p>
            </div>
          </Card>

          <Tip>
            En tant que consultant, vous voyez uniquement vos propres encaissements.
            Le filtre par période vous permet de retrouver les paiements d'une année ou d'un trimestre.
          </Tip>
        </Section>

        {/* SECTION RELANCES */}
        <Section id="relances" title="Relances" icon={Bell}>
          <p className="text-gray-600">Le système de relances vous permet de suivre vos actions à faire auprès de vos clients, sans oublier aucun suivi.</p>

          <Card title="Les 5 types de relances">
            <div className="space-y-2">
              {[
                { label: 'Collecte', desc: 'Relancer un client sur un dossier d'investissement en cours' },
                { label: 'Réglementaire', desc: 'Rappeler un client pour ses documents de conformité manquants' },
                { label: 'Document', desc: 'Demander un document spécifique (RIB, justificatif...)' },
                { label: 'Anniversaire', desc: 'Révision annuelle du portefeuille client' },
                { label: 'Autre', desc: 'Toute autre relance personnalisée' },
              ].map(r => (
                <div key={r.label} className="flex gap-3 p-2.5 border-b border-gray-100 last:border-0">
                  <Badge color="indigo">{r.label}</Badge>
                  <p className="text-sm text-gray-600">{r.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Créer une relance">
            <div className="space-y-3">
              <Step n={1} title='Aller dans "Relances"'>
                Vue d'ensemble de toutes vos relances actives, organisées par catégorie et délai.
              </Step>
              <Step n={2} title="Sélectionner le délai">
                3j, 5j, 3 semaines, 1 mois, 3 mois, 6 mois, 1 an.
              </Step>
              <Step n={3} title="Gérer les statuts">
                <strong>Fait</strong> (clôture la relance), <strong>Ignoré</strong> (supprime), <strong>Me le rappeler dans...</strong> (reporte avec snooze automatique).
              </Step>
            </div>
          </Card>

          <Card color="amber">
            <p className="text-sm text-amber-800">
              <strong>Snooze automatique :</strong> Quand vous cliquez "Me le rappeler dans...", la relance disparaît et réapparaît automatiquement à la date choisie.
              Vous ne perdez jamais un suivi.
            </p>
          </Card>
        </Section>

        {/* SECTION RÉGLEMENTAIRE */}
        <Section id="reglementaire" title="Réglementaire" icon={Shield}>
          <p className="text-gray-600">La vue Réglementaire est le tableau de bord de conformité de tous vos clients.</p>

          <Card title="Le score de conformité">
            <p className="text-sm text-gray-600 mb-4">Chaque client a un score de 0 à 5 basé sur 5 critères :</p>
            <div className="space-y-2">
              {[
                { label: 'Statut KYC', desc: 'Questionnaire de connaissance client validé' },
                { label: 'DER', desc: 'Document d'Entrée en Relation signé' },
                { label: 'PI', desc: 'Profil Investisseur établi' },
                { label: 'LM', desc: 'Lettre de Mission signée' },
                { label: 'RM', desc: 'Rapport de Mission remis' },
              ].map((c, i) => (
                <div key={c.label} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</span>
                  <div>
                    <span className="font-medium text-sm text-gray-900">{c.label}</span>
                    <span className="text-xs text-gray-500 ml-2">— {c.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Codes couleur" color="gray">
            <div className="space-y-2">
              <div className="flex items-center gap-3"><div className="w-3 h-3 bg-red-500 rounded-full"></div><p className="text-sm text-gray-700">Rouge — Score faible (0-1/5) — À traiter en priorité</p></div>
              <div className="flex items-center gap-3"><div className="w-3 h-3 bg-orange-500 rounded-full"></div><p className="text-sm text-gray-700">Orange — Score moyen (2-3/5) — En cours</p></div>
              <div className="flex items-center gap-3"><div className="w-3 h-3 bg-green-500 rounded-full"></div><p className="text-sm text-gray-700">Vert — Score complet (4-5/5) — Conforme</p></div>
            </div>
          </Card>

          <Card title="Mettre à jour la conformité">
            <p className="text-sm text-gray-600">
              Dans chaque fiche client, section "Réglementaire", cliquez le crayon ✏️ pour éditer.
              Cochez les documents validés puis sauvegardez. Le score se met à jour automatiquement.
            </p>
          </Card>
        </Section>

        {/* SECTION ANALYSE */}
        <Section id="analyse" title="Analyse & Rapports" icon={BarChart2}>
          <Card>
            <p className="text-sm text-gray-700 leading-relaxed">
              La page Analyse vous donne une vision graphique de vos performances : évolution de la collecte,
              répartition par produit/compagnie, pipeline prévisionnel, et projection de commissions.
            </p>
          </Card>

          <Card title="Ce que vous trouvez dans l'Analyse" color="indigo">
            <div className="space-y-2 text-sm text-gray-700">
              <p>📊 <strong>Collecte par période</strong> — Évolution mensuelle de votre AUM</p>
              <p>🥧 <strong>Répartition par produit</strong> — Quels produits composent votre portefeuille</p>
              <p>📈 <strong>Pipeline prévisionnel</strong> — Dossiers en cours × montants estimés</p>
              <p>💰 <strong>Projection commissions</strong> — Ce que vous devriez percevoir</p>
              <p>🏆 <strong>Top clients</strong> — Vos clients avec le plus fort encours</p>
            </div>
          </Card>
        </Section>

        {/* SECTION GOOGLE */}
        <Section id="google" title="🆕 Intégration Google (Gmail + Calendar)" icon={Mail}>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="w-6 h-6" />
              <h3 className="text-lg font-bold">Nouvelle fonctionnalité</h3>
            </div>
            <p className="text-blue-100 text-sm leading-relaxed">
              Connectez votre compte Google @private-equity-valley.com pour accéder à vos emails Gmail
              et vos RDV Google Calendar directement depuis chaque fiche client — sans quitter le CRM.
            </p>
          </div>

          <Card title="Étape 1 — Connecter votre compte Google" color="blue">
            <div className="space-y-3">
              <Step n={1} title='Aller dans "Paramètres" (menu de gauche)'>
                Trouvez la section "Intégrations Google".
              </Step>
              <Step n={2} title='Cliquer "Connecter mon compte Google"'>
                Vous êtes redirigé vers la page d'autorisation Google.
              </Step>
              <Step n={3} title="Autoriser PEV CRM">
                Sélectionnez votre compte @private-equity-valley.com et acceptez les autorisations
                (lecture Gmail + Calendar).
              </Step>
              <Step n={4} title="C'est fait !">
                Vous êtes redirigé vers le CRM. Votre compte est connecté. ✅
              </Step>
            </div>
            <div className="mt-4 bg-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Confidentialité :</strong> Chaque consultant connecte son propre compte Google.
                Vous voyez uniquement VOS emails et VOS RDV — jamais ceux de vos collègues.
              </p>
            </div>
          </Card>

          <Card title="Étape 2 — Utiliser dans les fiches clients" color="green">
            <p className="text-sm text-gray-600 mb-4">
              Une fois connecté, ouvrez n'importe quelle fiche client. Vous verrez une nouvelle section
              <strong> "Communications"</strong> avec deux onglets :
            </p>
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Onglet Emails</span>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-sm text-gray-600">Affiche tous vos emails Gmail échangés avec l'adresse email de ce client :</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-gray-700"><CheckCircle className="w-4 h-4 text-green-500" /> Objet de l'email</div>
                    <div className="flex items-center gap-2 text-gray-700"><CheckCircle className="w-4 h-4 text-green-500" /> Expéditeur et date</div>
                    <div className="flex items-center gap-2 text-gray-700"><CheckCircle className="w-4 h-4 text-green-500" /> Extrait du contenu</div>
                    <div className="flex items-center gap-2 text-gray-700"><CheckCircle className="w-4 h-4 text-green-500" /> Indicateur pièce jointe 📎</div>
                    <div className="flex items-center gap-2 text-gray-700"><CheckCircle className="w-4 h-4 text-green-500" /> Lu / Non lu</div>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-green-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-900">Onglet RDV Calendar</span>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-sm text-gray-600">Affiche tous vos RDV Google Calendar mentionnant le nom du client :</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-gray-700"><CheckCircle className="w-4 h-4 text-green-500" /> Titre et date du RDV</div>
                    <div className="flex items-center gap-2 text-gray-700"><CheckCircle className="w-4 h-4 text-green-500" /> Nombre de participants</div>
                    <div className="flex items-center gap-2 text-gray-700"><CheckCircle className="w-4 h-4 text-green-500" /> Lien direct vers l'événement Google</div>
                    <div className="flex items-center gap-2 text-gray-700"><CheckCircle className="w-4 h-4 text-green-500" /> À venir (vert) vs passés (grisés)</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Bouton Actualiser" color="gray">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-gray-600" />
              <p className="text-sm text-gray-700">
                Cliquez l'icône ↻ dans chaque onglet pour recharger les données depuis Google en temps réel.
                Les données ne se mettent pas à jour automatiquement.
              </p>
            </div>
          </Card>

          <Warning>
            Si l'adresse email du client n'est pas renseignée dans sa fiche, l'onglet Emails ne pourra pas afficher de résultats.
            Assurez-vous de renseigner l'email client dans les Coordonnées.
          </Warning>

          <Tip>
            La recherche Calendar se fait sur le nom du client (ex: "Martin"). Nommez bien vos RDV Google Calendar
            en incluant le nom du client (ex: "Louis Martin × PEV") pour qu'ils apparaissent correctement.
          </Tip>
        </Section>

        {/* SECTION PARAMÈTRES */}
        <Section id="parametres" title="Paramètres" icon={Settings}>
          <Card title="Votre profil">
            <p className="text-sm text-gray-600 mb-3">Dans Paramètres, vous pouvez :</p>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Modifier votre nom affiché</div>
              <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Changer votre mot de passe</div>
              <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Connecter/déconnecter votre compte Google</div>
              <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Voir votre rémunération personnelle (confidentielle)</div>
            </div>
          </Card>

          <Card title="Ma rémunération" color="indigo">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-indigo-600" />
              <p className="text-sm text-indigo-900">
                La page "Ma rémunération" affiche votre rémunération personnelle calculée par le CRM.
                Ces données sont strictement confidentielles — personne d'autre ne peut les voir.
              </p>
            </div>
          </Card>
        </Section>

        {/* SECTION FAQ */}
        <Section id="faq" title="Questions fréquentes (FAQ)" icon={HelpCircle}>
          <div className="space-y-4">
            {[
              {
                q: "Je ne vois pas les dossiers de mes collègues — est-ce normal ?",
                a: "Oui, c'est intentionnel. En tant que consultant, vous ne voyez que vos propres dossiers. Les managers ont accès à tout."
              },
              {
                q: "Comment ajouter un client qui n'existe pas encore ?",
                a: "Lors de la création d'un nouveau dossier, vous pouvez créer un nouveau client directement depuis le formulaire. Il sera ensuite accessible dans Ma clientèle."
              },
              {
                q: "Mes emails Gmail n'apparaissent pas dans la fiche client",
                a: "Vérifiez que : (1) votre compte Google est connecté dans Paramètres, (2) l'adresse email du client est renseignée dans ses Coordonnées, (3) cliquez sur Actualiser (↻) dans l'onglet Emails."
              },
              {
                q: "Puis-je uploader n'importe quel type de fichier ?",
                a: "Oui — PDF, images (JPG, PNG), documents Word, etc. Taille maximale recommandée : 10 Mo par fichier."
              },
              {
                q: "Comment savoir si une commission a été payée ?",
                a: "Les commissions payées disparaissent de la Facturation et apparaissent dans la section Encaissements. Si vous ne la voyez ni dans l'un ni dans l'autre, contactez le back-office."
              },
              {
                q: "Que se passe-t-il si je clique 'Snooze' sur une relance ?",
                a: "La relance disparaît de votre vue et réapparaît automatiquement à la date que vous avez choisie. Elle n'est pas supprimée."
              },
              {
                q: "Le CRM fonctionne-t-il sur mobile ?",
                a: "Oui, le CRM est responsive et fonctionne sur tablette et smartphone. La navigation est adaptée aux petits écrans."
              },
              {
                q: "Comment retrouver un dossier rapidement ?",
                a: "Utilisez la barre de recherche en haut du tableau de bord, ou les filtres dans la page Dossiers (par statut, produit, date, montant)."
              },
            ].map((item, i) => (
              <details key={i} className="border border-gray-200 rounded-xl group">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-medium text-gray-900 text-sm pr-4">{item.q}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0" />
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-gray-600">{item.a}</p>
                </div>
              </details>
            ))}
          </div>

          <Card color="indigo">
            <div className="text-center">
              <h3 className="font-semibold text-gray-900 mb-2">Besoin d'aide supplémentaire ?</h3>
              <p className="text-sm text-gray-600 mb-4">Contactez Maxine ou le back-office PEV pour toute question non couverte dans ce guide.</p>
              <a href="mailto:maxine@private-equity-valley.com" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
                <Mail className="w-4 h-4" />
                Contacter le support
              </a>
            </div>
          </Card>
        </Section>

      </div>
    </div>
  )
}
