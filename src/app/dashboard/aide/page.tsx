'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, ChevronRight, LayoutDashboard, FolderOpen, Users, FileText,
  CreditCard, DollarSign, Bell, Shield, BarChart2, Settings, Mail, Calendar,
  Plus, CheckCircle, AlertCircle, ExternalLink, HelpCircle, Home,
  RefreshCw, Star, Zap, Lock, ArrowRight,
} from 'lucide-react'

const NAV = [
  { id: 'bienvenue', label: 'Bienvenue' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'dossiers', label: 'Dossiers' },
  { id: 'clients', label: 'Clients' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'relances', label: 'Relances' },
  { id: 'reglementaire', label: 'Réglementaire' },
  { id: 'google', label: '🆕 Google Gmail & Calendar' },
  { id: 'faq', label: 'FAQ' },
]

export default function AidePage() {
  const [active, setActive] = useState('bienvenue')

  function goTo(id: string) {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex gap-8 min-h-screen">
      {/* Sidebar */}
      <div className="hidden lg:block w-56 flex-shrink-0">
        <div className="sticky top-6 bg-white border border-gray-200 rounded-xl p-3 space-y-0.5">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-gray-900 text-sm">Manuel CRM</span>
          </div>
          {NAV.map(function(item) {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={function() { goTo(item.id) }}
                className={isActive
                  ? 'w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700'
                  : 'w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              >
                {item.label}
              </button>
            )
          })}
          <div className="pt-3 border-t border-gray-100 mt-1">
            <Link href="/dashboard" className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
              <Home className="w-3.5 h-3.5" />
              Tableau de bord
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-3xl space-y-14 pb-24">

        {/* Header */}
        <div className="bg-indigo-700 rounded-2xl p-8 text-white">
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
            Bienvenue dans le CRM de Private Equity Valley. Ce guide vous explique comment utiliser
            chaque fonctionnalité au quotidien.
          </p>
        </div>

        {/* BIENVENUE */}
        <section id="bienvenue" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Star className="w-6 h-6 text-indigo-600" /> Bienvenue
          </h2>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <p className="text-gray-700 leading-relaxed">
              Le CRM PEV centralise en un seul endroit vos dossiers clients, la facturation,
              les relances, la réglementation et vos communications Gmail/Calendar. Il remplace
              les fichiers Excel DELTA 2026.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Rôles et accès</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
                <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0">Consultant</span>
                <p className="text-sm text-gray-700">Voit et gère ses propres dossiers et clients uniquement. Ne voit pas les autres consultants.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0">Manager</span>
                <p className="text-sm text-gray-700">Accès complet à tous les dossiers, facturation globale, analyse et paramètres.</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Accès au CRM</p>
            <p className="text-indigo-600 font-medium">pev-crm.vercel.app</p>
            <p className="text-xs text-gray-500 mt-1">Connexion avec votre compte @private-equity-valley.com</p>
          </div>
        </section>

        {/* NAVIGATION */}
        <section id="navigation" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" /> Navigation
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Menu latéral gauche</h3>
            <div className="space-y-2">
              {[
                ['📊', 'Tableau de bord', "Vue d'ensemble, KPIs, stats"],
                ['📁', 'Dossiers', 'Tous vos dossiers clients'],
                ['👤', 'Ma clientèle', 'Fiches clients détaillées'],
                ['💶', 'Facturation', 'Commissions à émettre / émises'],
                ['✅', 'Encaissements', 'Commissions reçues'],
                ['🔔', 'Relances', 'Suivi des relances'],
                ['🛡️', 'Réglementaire', 'Conformité des clients'],
                ['📈', 'Analyse', 'Statistiques et rapports'],
                ['📖', 'Aide & Manuel', 'Ce guide'],
                ['⚙️', 'Paramètres', 'Profil et connexion Google'],
              ].map(function(item) {
                return (
                  <div key={item[1]} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-base w-7">{item[0]}</span>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{item[1]}</span>
                      <span className="text-xs text-gray-500 ml-2">— {item[2]}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* DOSSIERS */}
        <section id="dossiers" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-indigo-600" /> Dossiers
          </h2>
          <p className="text-gray-600">Un dossier = une opération d'investissement d'un client.</p>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Créer un dossier</h3>
            <div className="space-y-4">
              {[
                ['1', 'Aller dans "Dossiers"', 'Accédez à la liste de tous vos dossiers.'],
                ['2', 'Cliquer "Nouveau dossier"', 'Le formulaire de création s'ouvre.'],
                ['3', 'Remplir les champs', 'Client, produit, compagnie, montant, financement, date.'],
                ['4', 'Sauvegarder', 'Le dossier apparaît avec le statut Prospect.'],
              ].map(function(step) {
                return (
                  <div key={step[0]} className="flex gap-4">
                    <div className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">{step[0]}</div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{step[1]}</p>
                      <p className="text-sm text-gray-600">{step[2]}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Statuts d'un dossier</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="bg-gray-100 text-gray-600 border border-gray-200 text-xs font-medium px-2 py-0.5 rounded-full">Prospect</span>
                <p className="text-sm text-gray-700">Premier contact, opération non encore engagée</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium px-2 py-0.5 rounded-full">Client en cours</span>
                <p className="text-sm text-gray-700">Souscription lancée, en attente de finalisation</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-medium px-2 py-0.5 rounded-full">Client finalisé</span>
                <p className="text-sm text-gray-700">Opération terminée, commission due</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Produits disponibles</h3>
            <div className="flex flex-wrap gap-2">
              {['SCPI', 'Private Equity', 'CAV LUX', 'CAPI LUX', 'Trilake', 'Girardin'].map(function(p) {
                return <span key={p} className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full border border-indigo-200 font-medium">{p}</span>
              })}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Passez un dossier à "Client finalisé" dès que l'opération est confirmée — cela déclenche automatiquement le calcul de commission.
            </p>
          </div>
        </section>

        {/* CLIENTS */}
        <section id="clients" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-600" /> Fiches Clients
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Contenu d'une fiche client</h3>
            <div className="space-y-2">
              {[
                ['📊', 'KPIs', 'Collecte finalisée, pipeline, commissions, conformité'],
                ['📁', 'Dossiers', 'Toutes les opérations liées à ce client'],
                ['📞', 'Coordonnées', 'Email, téléphone, pays — modifiables via le crayon ✏️'],
                ['📧', 'Communications', '🆕 Emails Gmail + RDV Calendar (si Google connecté)'],
                ['🛡️', 'Réglementaire', 'Statut KYC, DER, PI, PRECO, LM, RM'],
                ['📝', 'Journal de suivi', 'Historique des notes, appels, emails'],
                ['📎', 'Pièces jointes', 'Documents uploadés (RIB, pièce d'identité...)'],
                ['🔔', 'Relances', 'Suivi des relances liées à ce client'],
              ].map(function(item) {
                return (
                  <div key={item[1]} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-base">{item[0]}</span>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{item[1]}</span>
                      <span className="text-xs text-gray-500 ml-2">— {item[2]}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Journal de suivi</h3>
            <p className="text-sm text-gray-700 mb-3">Tracez chaque interaction avec vos clients :</p>
            <div className="flex flex-wrap gap-2">
              {['📞 Appel', '📧 Email', '🤝 Compte rendu RDV', '📋 Note interne', '📨 Relance', '📄 Document reçu'].map(function(t) {
                return <span key={t} className="bg-white text-gray-700 text-xs px-2.5 py-1 rounded-full border border-gray-200">{t}</span>
              })}
            </div>
          </div>
        </section>

        {/* FACTURATION */}
        <section id="facturation" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-indigo-600" /> Facturation
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800">🔴 À émettre</p>
                <p className="text-sm text-red-700">Commission calculée, facture non encore envoyée</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="w-4 h-4 bg-orange-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-800">🟠 Émise</p>
                <p className="text-sm text-orange-700">Facture envoyée, en attente de paiement</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">✅ Payée → Encaissements</p>
                <p className="text-sm text-green-700">Passe dans les Encaissements</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">Ne marquez une commission comme "émise" que lorsque vous avez réellement envoyé votre facture.</p>
          </div>
        </section>

        {/* RELANCES */}
        <section id="relances" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="w-6 h-6 text-indigo-600" /> Relances
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Types de relances</h3>
            <div className="space-y-2">
              {[
                ['Collecte', 'Relancer un client sur un dossier en cours'],
                ['Réglementaire', 'Documents de conformité manquants'],
                ['Document', 'Demander un document spécifique'],
                ['Anniversaire', 'Révision annuelle du portefeuille'],
                ['Autre', 'Toute autre relance personnalisée'],
              ].map(function(r) {
                return (
                  <div key={r[0]} className="flex gap-3 p-2.5 border-b border-gray-100 last:border-0">
                    <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 h-fit">{r[0]}</span>
                    <p className="text-sm text-gray-600">{r[1]}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>Snooze :</strong> Cliquez "Me le rappeler dans..." pour que la relance réapparaisse automatiquement à la date choisie.
            </p>
          </div>
        </section>

        {/* RÉGLEMENTAIRE */}
        <section id="reglementaire" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-6 h-6 text-indigo-600" /> Réglementaire
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Les 6 critères de conformité</h3>
            <div className="space-y-2">
              {[
                ['1', 'Réglementaire (KYC)', 'Questionnaire de connaissance client validé'],
                ['2', 'DER', 'Document d'Entrée en Relation signé'],
                ['3', 'PI', 'Profil Investisseur établi'],
                ['4', 'PRECO', 'Recommandations personnalisées'],
                ['5', 'LM', 'Lettre de Mission signée'],
                ['6', 'RM', 'Rapport de Mission remis'],
              ].map(function(c) {
                return (
                  <div key={c[0]} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{c[0]}</span>
                    <div>
                      <span className="font-medium text-sm text-gray-900">{c[1]}</span>
                      <span className="text-xs text-gray-500 ml-2">— {c[2]}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Codes couleur</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3"><div className="w-3 h-3 bg-red-500 rounded-full" /><p className="text-sm text-gray-700">Rouge — 0-1/6 — Prioritaire</p></div>
              <div className="flex items-center gap-3"><div className="w-3 h-3 bg-orange-500 rounded-full" /><p className="text-sm text-gray-700">Orange — 2-4/6 — En cours</p></div>
              <div className="flex items-center gap-3"><div className="w-3 h-3 bg-green-500 rounded-full" /><p className="text-sm text-gray-700">Vert — 5-6/6 — Conforme</p></div>
            </div>
          </div>
        </section>

        {/* GOOGLE */}
        <section id="google" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Mail className="w-6 h-6 text-indigo-600" /> Intégration Google
          </h2>

          <div className="bg-indigo-700 rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5" />
              <span className="font-bold">Nouvelle fonctionnalité</span>
            </div>
            <p className="text-indigo-100 text-sm leading-relaxed">
              Connectez votre compte Google @private-equity-valley.com pour voir vos emails Gmail
              et RDV Google Calendar directement dans chaque fiche client.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Étape 1 — Connecter Google</h3>
            <div className="space-y-4">
              {[
                ['1', 'Aller dans Paramètres', 'Menu de gauche > Paramètres > Intégrations Google'],
                ['2', 'Cliquer "Connecter Google"', 'Vous êtes redirigé vers Google'],
                ['3', 'Autoriser PEV CRM', 'Choisissez votre compte @private-equity-valley.com et acceptez'],
                ['4', 'Retour automatique', 'Vous êtes redirigé vers le CRM — Google est connecté ✅'],
              ].map(function(s) {
                return (
                  <div key={s[0]} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">{s[0]}</div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{s[1]}</p>
                      <p className="text-xs text-gray-600">{s[2]}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-blue-50 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">Onglet Emails</span>
              </div>
            </div>
            <div className="p-5 space-y-1.5">
              {['Emails échangés avec ce client (via son adresse email)', 'Objet, expéditeur, date, extrait', 'Indicateur pièce jointe et lu/non lu'].map(function(t) {
                return (
                  <div key={t} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {t}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-green-50 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-900">Onglet RDV Calendar</span>
              </div>
            </div>
            <div className="p-5 space-y-1.5">
              {['RDV mentionnant le nom du client (±6 mois)', 'Date, heure, participants', 'Lien direct vers l'événement Google'].map(function(t) {
                return (
                  <div key={t} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {t}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">
              Si l'email du client n'est pas renseigné dans ses Coordonnées, l'onglet Emails ne pourra pas afficher de résultats.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Nommez vos RDV Google Calendar en incluant le nom du client (ex: "Louis Martin × PEV") pour qu'ils apparaissent dans la fiche.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-indigo-600" /> FAQ
          </h2>

          <div className="space-y-3">
            {[
              ['Je ne vois pas les dossiers de mes collègues — normal ?', 'Oui. En tant que consultant, vous ne voyez que vos propres dossiers. Les managers ont accès à tout.'],
              ['Comment ajouter un client qui n'existe pas encore ?', 'Lors de la création d'un dossier, vous pouvez créer un client directement depuis le formulaire.'],
              ['Mes emails Gmail n'apparaissent pas dans la fiche client', 'Vérifiez : (1) compte Google connecté dans Paramètres, (2) email client renseigné dans les Coordonnées, (3) cliquez ↻ Actualiser.'],
              ['Puis-je uploader n'importe quel fichier ?', 'Oui — PDF, images, Word. Taille recommandée : moins de 10 Mo.'],
              ['Comment savoir si une commission a été payée ?', 'Les commissions payées disparaissent de la Facturation et apparaissent dans les Encaissements.'],
              ['Que se passe-t-il si je clique "Snooze" sur une relance ?', 'La relance disparaît et réapparaît automatiquement à la date choisie. Elle n'est pas supprimée.'],
              ['Le CRM fonctionne-t-il sur mobile ?', 'Oui, le CRM est responsive et fonctionne sur tablette et smartphone.'],
              ['Comment retrouver un dossier rapidement ?', 'Utilisez la barre de recherche en haut du tableau de bord, ou les filtres dans la page Dossiers.'],
            ].map(function(item) {
              return (
                <details key={item[0]} className="border border-gray-200 rounded-xl group">
                  <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                    <span className="font-medium text-gray-900 text-sm pr-4">{item[0]}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </summary>
                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-600">{item[1]}</p>
                  </div>
                </details>
              )
            })}
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center">
            <p className="font-semibold text-gray-900 mb-2">Besoin d'aide supplémentaire ?</p>
            <p className="text-sm text-gray-600 mb-4">Contactez Maxine pour toute question non couverte dans ce guide.</p>
            <a href="mailto:maxine@private-equity-valley.com" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
              <Mail className="w-4 h-4" />
              Contacter le support
            </a>
          </div>
        </section>

      </div>
    </div>
  )
}
