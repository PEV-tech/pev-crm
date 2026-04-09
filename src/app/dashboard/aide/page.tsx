'use client'
import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronRight, CheckCircle, AlertCircle, Star, Zap, Mail, Calendar, Home } from 'lucide-react'

const SECTIONS = ['bienvenue','navigation','dossiers','clients','facturation','relances','reglementaire','google','faq']
const LABELS: Record<string, string> = {
  bienvenue: 'Bienvenue',
  navigation: 'Navigation',
  dossiers: 'Dossiers',
  clients: 'Clients',
  facturation: 'Facturation',
  relances: 'Relances',
  reglementaire: 'Reglementaire',
  google: 'Google Gmail & Calendar',
  faq: 'FAQ',
}

export default function AidePage() {
  const [active, setActive] = useState('bienvenue')
  function goTo(id: string) {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <div className="flex gap-8 min-h-screen">
      <div className="hidden lg:block w-56 flex-shrink-0">
        <div className="sticky top-6 bg-white border border-gray-200 rounded-xl p-3 space-y-0.5">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-gray-900 text-sm">Manuel CRM</span>
          </div>
          {SECTIONS.map(function(id) {
            const cls = active === id
              ? 'w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700'
              : 'w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50'
            return (
              <button key={id} onClick={function() { goTo(id) }} className={cls}>
                {LABELS[id]}
              </button>
            )
          })}
          <div className="pt-3 border-t border-gray-100 mt-1">
            <Link href="/dashboard" className="flex items-center gap-2 text-xs text-gray-500 px-3 py-1">
              <Home className="w-3.5 h-3.5" />
              Tableau de bord
            </Link>
          </div>
        </div>
      </div>
      <div className="flex-1 max-w-3xl space-y-14 pb-24">
        <div className="bg-indigo-700 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold">Manuel PEV CRM</h1>
          <p className="text-indigo-200 mt-2">Guide complet pour les consultants</p>
          <p className="text-indigo-100 leading-relaxed mt-4">
            Bienvenue dans le CRM de Private Equity Valley. Ce guide explique chaque fonctionnalite.
          </p>
        </div>

        <section id="bienvenue" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Bienvenue</h2>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <p className="text-gray-700 leading-relaxed">
              Le CRM PEV centralise vos dossiers clients, la facturation, les relances,
              la reglementation et vos communications Gmail et Calendar.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
              <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">Consultant</span>
              <p className="text-sm text-gray-700">Voit et gere ses propres dossiers et clients uniquement.</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">Manager</span>
              <p className="text-sm text-gray-700">Acces complet a tous les dossiers, facturation et analyse.</p>
            </div>
          </div>
        </section>

        <section id="navigation" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Navigation</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="space-y-2">
              {[
                ['Tableau de bord', 'Vue ensemble, KPIs'],
                ['Dossiers', 'Tous vos dossiers clients'],
                ['Ma clientele', 'Fiches clients detaillees'],
                ['Facturation', 'Commissions a emettre ou emises'],
                ['Encaissements', 'Commissions recues'],
                ['Relances', 'Suivi des relances'],
                ['Reglementaire', 'Conformite des clients'],
                ['Analyse', 'Statistiques et rapports'],
                ['Aide & Manuel', 'Ce guide'],
                ['Parametres', 'Profil et connexion Google'],
              ].map(function(item) {
                return (
                  <div key={item[0]} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-medium text-gray-900 w-40">{item[0]}</span>
                    <span className="text-xs text-gray-500">{item[1]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section id="dossiers" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Dossiers</h2>
          <p className="text-gray-600">Un dossier = une operation d investissement d un client.</p>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Prospect</span>
              <p className="text-sm text-gray-700">Premier contact, operation non engagee</p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Client en cours</span>
              <p className="text-sm text-gray-700">Souscription lancee, en attente de finalisation</p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Client finalise</span>
              <p className="text-sm text-gray-700">Operation terminee, commission due</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">Passez a Client finalise des que l operation est confirmee.</p>
          </div>
        </section>

        <section id="clients" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Fiches Clients</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
            {[
              ['KPIs', 'Collecte, pipeline, commissions, conformite'],
              ['Dossiers', 'Toutes les operations liees a ce client'],
              ['Coordonnees', 'Email, telephone, pays - editables via le crayon'],
              ['Communications', 'NOUVEAU: Emails Gmail et RDV Calendar'],
              ['Reglementaire', 'KYC, DER, PI, PRECO, LM, RM'],
              ['Journal de suivi', 'Historique des notes, appels, emails'],
              ['Pieces jointes', 'Documents uploades'],
              ['Relances', 'Suivi des relances liees a ce client'],
            ].map(function(item) {
              return (
                <div key={item[0]} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-900 w-40 flex-shrink-0">{item[0]}</span>
                  <span className="text-xs text-gray-500">{item[1]}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section id="facturation" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Facturation</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800">A emettre</p>
                <p className="text-sm text-red-700">Commission calculee, facture non encore envoyee</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="w-4 h-4 bg-orange-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-800">Emise</p>
                <p className="text-sm text-orange-700">Facture envoyee, en attente de paiement</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Payee -&gt; Encaissements</p>
                <p className="text-sm text-green-700">Passe dans les Encaissements</p>
              </div>
            </div>
          </div>
        </section>

        <section id="relances" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Relances</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
            {['Collecte', 'Reglementaire', 'Document', 'Anniversaire', 'Autre'].map(function(r) {
              return (
                <div key={r} className="flex gap-3 p-2.5 border-b border-gray-100 last:border-0">
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">{r}</span>
                </div>
              )
            })}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">Snooze: la relance reapparait automatiquement a la date choisie.</p>
          </div>
        </section>

        <section id="reglementaire" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Reglementaire</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
            {['1. Reglementaire (KYC)', '2. DER', '3. PI', '4. PRECO', '5. LM', '6. RM'].map(function(c) {
              return (
                <div key={c} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span className="text-sm text-gray-900">{c}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section id="google" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Integration Google</h2>
          <div className="bg-indigo-700 rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5" />
              <span className="font-bold">Nouvelle fonctionnalite</span>
            </div>
            <p className="text-indigo-100 text-sm">
              Connectez votre compte Google pour voir vos emails Gmail et RDV Calendar dans chaque fiche client.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-blue-50 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">Onglet Emails</span>
              </div>
            </div>
            <div className="p-5 text-sm text-gray-600">
              Emails echanges avec ce client via son adresse email. Objet, expediteur, date, extrait.
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-green-50 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-900">Onglet RDV Calendar</span>
              </div>
            </div>
            <div className="p-5 text-sm text-gray-600">
              RDV mentionnant le nom du client sur plus ou moins 6 mois. Date, heure, participants.
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Nommez vos RDV Google Calendar avec le nom du client pour qu ils apparaissent dans la fiche.
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">
              Si l email du client n est pas renseigne, l onglet Emails ne peut pas afficher de resultats.
            </p>
          </div>
        </section>

        <section id="faq" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">FAQ</h2>
          <div className="space-y-3">
            {[
              ['Je ne vois pas les dossiers de mes collegues - normal ?', 'Oui, vous ne voyez que vos propres dossiers. Les managers ont acces a tout.'],
              ['Mes emails Gmail n apparaissent pas', 'Verifiez: (1) compte Google connecte dans Parametres, (2) email client renseigne, (3) cliquez Actualiser.'],
              ['Comment savoir si une commission a ete payee ?', 'Les commissions payees passent dans les Encaissements.'],
              ['Le CRM fonctionne-t-il sur mobile ?', 'Oui, le CRM est responsive et fonctionne sur tablette et smartphone.'],
            ].map(function(item) {
              return (
                <details key={item[0]} className="border border-gray-200 rounded-xl">
                  <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                    <span className="font-medium text-gray-900 text-sm">{item[0]}</span>
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
            <p className="font-semibold text-gray-900 mb-2">Besoin d aide ?</p>
            <a href="mailto:maxine@private-equity-valley.com" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
              <Mail className="w-4 h-4" />
              Contacter le support
            </a>
          </div>
        </section>

      </div>
    </div>
  )
              }
