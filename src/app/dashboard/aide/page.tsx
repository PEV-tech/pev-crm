'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/hooks/use-user'
import {
  BookOpen, ChevronRight, ChevronDown, CheckCircle, AlertCircle, Star, Zap,
  Mail, Calendar, Home, Shield, FolderOpen, Users, CreditCard, DollarSign,
  Bell, BarChart2, Settings, FileText, Lock, X, ExternalLink, TrendingUp,
} from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  consultant: 'Consultant',
  manager: 'Manager',
  back_office: 'Back-office',
}

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const FAQ_CATEGORIES = [
  {
    id: 'acces',
    label: 'Accès & Connexion',
    questions: [
      {
        q: "Je ne vois pas les dossiers de mes collègues — est-ce normal ?",
        a: "Oui, c'est intentionnel. En tant que consultant, vous ne voyez que vos propres dossiers et clients. Les managers et le back-office ont accès à l'ensemble des données.",
        roles: ['consultant', 'manager', 'back_office'],
      },
      {
        q: "Comment me connecter au CRM ?",
        a: "Rendez-vous sur pev-crm.vercel.app et connectez-vous avec votre adresse @private-equity-valley.com. Si vous n'avez pas accès, contactez le support.",
        roles: ['consultant', 'manager', 'back_office'],
      },
      {
        q: "La connexion Google ne fonctionne pas — que faire ?",
        a: "Allez dans Paramètres, cliquez 'Connecter Google', puis sélectionnez votre compte @private-equity-valley.com. Si le problème persiste, déconnectez-vous du CRM, reconnectez-vous, et réessayez.",
        roles: ['consultant', 'manager', 'back_office'],
      },
    ],
  },
  {
    id: 'dossiers',
    label: 'Dossiers',
    questions: [
      {
        q: "Comment ajouter un client qui n'existe pas encore ?",
        a: "Lors de la création d'un dossier, tapez le nom du client dans le champ Client — si le client n'existe pas, une option 'Créer ce client' apparaîtra automatiquement.",
        roles: ['consultant', 'manager'],
      },
      {
        q: "Comment retrouver un dossier rapidement ?",
        a: "Utilisez les filtres dans la page Dossiers : par statut, produit, compagnie, ou montant. La barre de recherche en haut filtre aussi par nom de client.",
        roles: ['consultant', 'manager', 'back_office'],
      },
      {
        q: "Quand passer un dossier en 'Client finalisé' ?",
        a: "Dès que la souscription est confirmée et que les fonds sont engagés. Ce changement de statut déclenche automatiquement le calcul de la commission dans la Facturation.",
        roles: ['consultant', 'manager'],
      },
      {
        q: "Puis-je modifier un dossier après sa création ?",
        a: "Oui, cliquez sur le dossier puis sur le bouton d'édition. Vous pouvez modifier le montant, le statut, le produit et la date d'opération.",
        roles: ['consultant', 'manager'],
      },
    ],
  },
  {
    id: 'facturation',
    label: 'Facturation & Paiements',
    questions: [
      {
        q: "Comment savoir si une commission a été payée ?",
        a: "Les commissions payées disparaissent de la Facturation et apparaissent dans les Encaissements. Si vous ne la voyez nulle part, contactez le back-office.",
        roles: ['consultant', 'manager'],
      },
      {
        q: "À quel moment marquer une facture comme 'émise' ?",
        a: "Uniquement quand vous avez réellement envoyé votre facture au service comptable. Cette action déclenche le suivi de paiement côté back-office.",
        roles: ['consultant', 'manager'],
      },
      {
        q: "Qui peut marquer une commission comme payée ?",
        a: "Seul le back-office et les managers peuvent valider le paiement d'une commission. Les consultants voient uniquement le statut.",
        roles: ['consultant', 'manager', 'back_office'],
      },
    ],
  },
  {
    id: 'reglementaire',
    label: 'Réglementaire',
    questions: [
      {
        q: "Quels sont les 6 documents de conformité requis ?",
        a: "KYC (questionnaire client), DER (Document d'Entrée en Relation), PI (Profil Investisseur), PRECO (Recommandations personnalisées), LM (Lettre de Mission), RM (Rapport de Mission).",
        roles: ['consultant', 'manager', 'back_office'],
      },
      {
        q: "Comment mettre à jour la conformité d'un client ?",
        a: "Ouvrez la fiche client, section 'Réglementaire', cliquez le crayon ✏️, cochez les documents reçus et validés, puis sauvegardez. Le score se met à jour automatiquement.",
        roles: ['consultant', 'manager', 'back_office'],
      },
    ],
  },
  {
    id: 'google',
    label: 'Google Gmail & Calendar',
    questions: [
      {
        q: "Les emails du client n'apparaissent pas dans sa fiche — pourquoi ?",
        a: "Vérifiez trois points : (1) votre compte Google est connecté dans Paramètres, (2) l'adresse email du client est renseignée dans ses Coordonnées, (3) cliquez sur l'icône ↻ Actualiser dans l'onglet Emails.",
        roles: ['consultant', 'manager'],
      },
      {
        q: "L'onglet RDV ne trouve pas mes rendez-vous — comment faire ?",
        a: "La recherche se fait sur le nom du client. Assurez-vous que vos RDV Google Calendar contiennent le nom exact du client (ex: 'Martin × PEV'). Cliquez ↻ pour actualiser.",
        roles: ['consultant', 'manager'],
      },
      {
        q: "Mes données Google sont-elles visibles par mes collègues ?",
        a: "Non. Chaque consultant connecte son propre compte Google. Vous ne voyez que vos propres emails et RDV — jamais ceux de vos collègues.",
        roles: ['consultant', 'manager', 'back_office'],
      },
    ],
  },
  {
    id: 'technique',
    label: 'Questions techniques',
    questions: [
      {
        q: "Puis-je uploader n'importe quel type de fichier ?",
        a: "Oui — PDF, images (JPG, PNG), documents Word. Taille maximale recommandée : 10 Mo par fichier.",
        roles: ['consultant', 'manager', 'back_office'],
      },
      {
        q: "Que se passe-t-il si je clique 'Snooze' sur une relance ?",
        a: "La relance disparaît de votre vue et réapparaît automatiquement à la date que vous avez choisie. Elle n'est pas supprimée.",
        roles: ['consultant', 'manager', 'back_office'],
      },
      {
        q: "Le CRM fonctionne-t-il sur mobile ?",
        a: "Oui, le CRM est responsive et fonctionne sur tablette et smartphone. La navigation est adaptée aux petits écrans.",
        roles: ['consultant', 'manager', 'back_office'],
      },
      {
        q: "Le nombre de lignes par page est-il configurable ?",
        a: "Oui, chaque tableau affiche 50 lignes par défaut. Un sélecteur en bas du tableau permet de changer à 25, 50, 100 ou 250 lignes.",
        roles: ['consultant', 'manager', 'back_office'],
      },
    ],
  },
]

const NAV_SECTIONS = [
  { id: 'bienvenue', label: 'Bienvenue' },
  { id: 'roles', label: 'Rôles & accès' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'dossiers', label: 'Dossiers' },
  { id: 'clients', label: 'Fiches clients' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'relances', label: 'Relances' },
  { id: 'reglementaire', label: 'Réglementaire' },
  { id: 'google', label: 'Google Gmail & Calendar' },
  { id: 'manager', label: 'Fonctions Manager' },
  { id: 'backoffice', label: 'Fonctions Back-office' },
  { id: 'faq', label: 'FAQ' },
]

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl font-bold text-gray-900 scroll-mt-6 mb-5">
      {children}
    </h2>
  )
}

function InfoBox({ color, children }: { color: 'amber' | 'red' | 'blue' | 'green' | 'indigo'; children: React.ReactNode }) {
  const styles = {
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    indigo: 'bg-indigo-50 border-indigo-200',
  }
  const icons = {
    amber: <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />,
    red: <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />,
    blue: <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />,
    green: <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />,
    indigo: <Star className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />,
  }
  return (
    <div className={`flex gap-3 border rounded-lg p-4 ${styles[color]}`}>
      {icons[color]}
      <p className="text-sm text-gray-800">{children}</p>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    consultant: 'bg-indigo-100 text-indigo-700',
    manager: 'bg-green-100 text-green-700',
    back_office: 'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[role] || 'bg-gray-100 text-gray-600'}`}>
      {ROLE_LABELS[role] || role}
    </span>
  )
}

function StepList({ steps }: { steps: [string, string][] }) {
  return (
    <div className="space-y-3">
      {steps.map(function(step, i) {
        return (
          <div key={i} className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {i + 1}
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{step[0]}</p>
              <p className="text-xs text-gray-500 mt-0.5">{step[1]}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function AidePage() {
  const { consultant } = useUser()
  const role = consultant?.role || 'consultant'
  const isManager = role === 'manager'
  const isBackOffice = role === 'back_office'
  const isConsultant = role === 'consultant'
  const isManagerOrBO = isManager || isBackOffice

  const [activeSection, setActiveSection] = useState('bienvenue')
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [showSupport, setShowSupport] = useState(false)

  function goTo(id: string) {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Filter FAQ by role
  const filteredFaq = FAQ_CATEGORIES.map(cat => ({
    ...cat,
    questions: cat.questions.filter(q => q.roles.includes(role)),
  })).filter(cat => cat.questions.length > 0)

  return (
    <div className="flex gap-8 min-h-screen">
      {/* Sidebar nav */}
      <div className="hidden lg:block w-52 flex-shrink-0">
        <div className="sticky top-6 bg-white border border-gray-200 rounded-xl p-3 space-y-0.5">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-gray-900 text-sm">Manuel CRM</span>
          </div>
          <div className="mb-2">
            <RoleBadge role={role} />
          </div>
          {NAV_SECTIONS.filter(function(s) {
            if (s.id === 'manager' && !isManagerOrBO) return false
            if (s.id === 'backoffice' && !isManagerOrBO) return false
            return true
          }).map(function(s) {
            const cls = activeSection === s.id
              ? 'w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700'
              : 'w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50'
            return (
              <button key={s.id} onClick={function() { goTo(s.id) }} className={cls}>
                {s.label}
              </button>
            )
          })}
          <div className="pt-3 border-t border-gray-100 mt-1 space-y-1">
            <Link href="/dashboard" className="flex items-center gap-2 text-xs text-gray-500 px-3 py-1 hover:text-gray-800">
              <Home className="w-3.5 h-3.5" />
              Tableau de bord
            </Link>
            <button
              onClick={function() { setShowSupport(true) }}
              className="flex items-center gap-2 text-xs text-indigo-600 px-3 py-1 hover:text-indigo-800 w-full text-left"
            >
              <Mail className="w-3.5 h-3.5" />
              Contacter le support
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-3xl space-y-14 pb-24">

        {/* Header */}
        <div className="bg-indigo-700 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold">Manuel PEV CRM</h1>
          <p className="text-indigo-200 mt-1">
            Guide {ROLE_LABELS[role]} — Private Equity Valley
          </p>
          <p className="text-indigo-100 leading-relaxed mt-4">
            Ce guide est personnalisé pour votre profil <strong>{ROLE_LABELS[role]}</strong>.
            Il vous explique comment utiliser chaque fonctionnalité disponible au quotidien.
          </p>
          <div className="flex gap-2 mt-4">
            <RoleBadge role={role} />
          </div>
        </div>

        {/* BIENVENUE */}
        <section>
          <SectionTitle id="bienvenue">Bienvenue dans le CRM</SectionTitle>
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="text-gray-700 leading-relaxed">
              Le CRM PEV centralise en un seul endroit vos dossiers clients, la facturation,
              les relances, la réglementation et vos communications Gmail / Calendar.
              Il remplace les fichiers Excel DELTA 2026.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="font-semibold text-gray-900 mb-1">Accès</p>
            <p className="text-indigo-600 font-medium text-sm">pev-crm.vercel.app</p>
            <p className="text-xs text-gray-500 mt-1">Connexion avec votre compte @private-equity-valley.com</p>
          </div>
        </section>

        {/* RÔLES */}
        <section>
          <SectionTitle id="roles">Rôles &amp; accès</SectionTitle>
          <div className="space-y-3">
            <div className={`border rounded-xl p-4 ${isConsultant ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <RoleBadge role="consultant" />
                {isConsultant && <span className="text-xs text-indigo-600 font-medium">— Votre profil</span>}
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Voir et gérer ses propres dossiers uniquement</li>
                <li>• Accéder à ses fiches clients</li>
                <li>• Émettre ses propres factures</li>
                <li>• Voir ses commissions et encaissements</li>
                <li>• Gérer ses relances et son réglementaire</li>
                <li>• Connecter son compte Google (emails + RDV)</li>
              </ul>
            </div>
            <div className={`border rounded-xl p-4 ${isManager ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <RoleBadge role="manager" />
                {isManager && <span className="text-xs text-green-600 font-medium">— Votre profil</span>}
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Accès complet à tous les dossiers et clients</li>
                <li>• Vue globale de la facturation et des encaissements</li>
                <li>• Accès aux analyses et statistiques cabinet</li>
                <li>• Gestion du classement et des rémunérations</li>
                <li>• Paramètres et configuration</li>
              </ul>
            </div>
            <div className={`border rounded-xl p-4 ${isBackOffice ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <RoleBadge role="back_office" />
                {isBackOffice && <span className="text-xs text-orange-600 font-medium">— Votre profil</span>}
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Gestion des encaissements et validation des paiements</li>
                <li>• Accès à tous les dossiers en lecture</li>
                <li>• Suivi du réglementaire global</li>
                <li>• Vue facturation complète</li>
              </ul>
            </div>
          </div>
        </section>

        {/* NAVIGATION */}
        <section>
          <SectionTitle id="navigation">Navigation</SectionTitle>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="space-y-2">
              {[
                ['Tableau de bord', "Vue d'ensemble, KPIs, statistiques rapides", true],
                ['Dossiers', 'Tous vos dossiers clients avec filtres et recherche', true],
                ['Ma clientèle', 'Fiches clients détaillées', !isBackOffice],
                ['Facturation', 'Commissions à émettre ou émises', true],
                ['Encaissements', 'Commissions reçues et historique de paiements', true],
                ['Relances', 'Suivi et planification des relances clients', !isBackOffice],
                ['Réglementaire', 'Conformité documentaire des clients (KYC, DER, PI…)', true],
                ['Analyse', 'Statistiques, graphiques et exports', isManagerOrBO],
                ['Aide & Manuel', 'Ce guide', true],
                ['Paramètres', 'Profil, connexion Google', true],
              ].filter(function(item) { return !!item[2] }).map(function(item) {
                return (
                  <div key={String(item[0])} className="flex items-start gap-3 py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-medium text-gray-900 w-40 flex-shrink-0">{item[0]}</span>
                    <span className="text-xs text-gray-500">{item[1] as string}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* DOSSIERS */}
        <section>
          <SectionTitle id="dossiers">Dossiers</SectionTitle>
          <p className="text-gray-600 mb-4">Un dossier représente une opération d'investissement d'un client.</p>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-4">Créer un dossier</p>
            <StepList steps={[
              ["Aller dans 'Dossiers'", "Accédez à la liste de vos dossiers."],
              ["Cliquer 'Nouveau dossier'", "Le formulaire de création s'ouvre."],
              ["Remplir les champs obligatoires", "Client, produit, compagnie, montant, type de financement, date."],
              ["Sauvegarder", "Le dossier apparaît avec le statut Prospect."],
            ]} />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-3">Statuts d'un dossier</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">Prospect</span>
                <p className="text-sm text-gray-700">Premier contact, opération non encore engagée</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">Client en cours</span>
                <p className="text-sm text-gray-700">Souscription lancée, en attente de finalisation</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">Client finalisé</span>
                <p className="text-sm text-gray-700">Opération terminée, commission calculée automatiquement</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-3">Types de produits</p>
            <div className="flex flex-wrap gap-2">
              {['SCPI', 'Private Equity', 'CAV LUX', 'CAPI LUX', 'Trilake', 'Girardin'].map(function(p) {
                return <span key={p} className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full border border-indigo-200 font-medium">{p}</span>
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-3">Types de financement</p>
            <div className="grid grid-cols-2 gap-2">
              {[['Cash', 'Paiement comptant'], ['Crédit', 'Financement bancaire'], ['Lombard', 'Prêt sur nantissement'], ['Remploi', 'Réinvestissement']].map(function(f) {
                return (
                  <div key={f[0]} className="bg-gray-50 rounded-lg p-3">
                    <p className="font-medium text-sm text-gray-900">{f[0]}</p>
                    <p className="text-xs text-gray-500">{f[1]}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <InfoBox color="amber">
            Passez un dossier à "Client finalisé" dès que l'opération est confirmée — cela déclenche
            automatiquement le calcul de commission dans la Facturation.
          </InfoBox>
        </section>

        {/* CLIENTS */}
        <section>
          <SectionTitle id="clients">Fiches clients</SectionTitle>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-3">Contenu d'une fiche client</p>
            <div className="space-y-2">
              {[
                ['KPIs', 'Collecte finalisée, pipeline, commissions, score réglementaire'],
                ['Dossiers', 'Toutes les opérations liées à ce client (cliquables)'],
                ["Coordonnées", "Email, téléphone, pays — modifiables via le crayon ✏️"],
                ["Communications", "Emails Gmail et RDV Calendar (si Google connecté)"],
                ["Réglementaire", "KYC, DER, PI, PRECO, LM, RM"],
                ["Journal de suivi", "Historique des notes, appels, RDV, emails"],
                ["Pièces jointes", "Documents uploadés (RIB, pièce d'identité, contrats…)"],
                ["Relances", "Relances liées à ce client"],
              ].map(function(item) {
                return (
                  <div key={item[0]} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-medium text-gray-900 w-36 flex-shrink-0">{item[0]}</span>
                    <span className="text-xs text-gray-500">{item[1]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-2">Journal de suivi</p>
            <p className="text-sm text-gray-700 mb-3">
              Tracez chaque interaction avec vos clients pour garder un historique complet de la relation.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Appel', 'Email', 'Compte rendu RDV', 'Note interne', 'Relance', 'Document reçu'].map(function(t) {
                return <span key={t} className="bg-white text-gray-700 text-xs px-2.5 py-1 rounded-full border border-gray-200">{t}</span>
              })}
            </div>
          </div>

          <InfoBox color="amber">
            L'affichage dans la liste clients montre en grand le montant investi (collecte) et
            en petit la commission — c'est intentionnel : le montant est l'indicateur principal.
          </InfoBox>
        </section>

        {/* FACTURATION */}
        <section>
          <SectionTitle id="facturation">Facturation</SectionTitle>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-3">
            <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">À émettre</p>
                <p className="text-xs text-red-700">Commission calculée, facture non encore envoyée au cabinet</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="w-4 h-4 bg-orange-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-800 text-sm">Émise</p>
                <p className="text-xs text-orange-700">Facture envoyée, en attente de paiement</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Payée → Encaissements</p>
                <p className="text-xs text-green-700">Disparaît de la Facturation, visible dans les Encaissements</p>
              </div>
            </div>
          </div>

          <InfoBox color="red">
            Ne marquez une commission comme "émise" que lorsque vous avez réellement envoyé
            votre facture. Cette action déclenche le suivi comptable.
          </InfoBox>
        </section>

        {/* RELANCES */}
        <section>
          <SectionTitle id="relances">Relances</SectionTitle>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-2">
            {['Collecte', 'Réglementaire', 'Document', 'Anniversaire', 'Autre'].map(function(r) {
              const descs: Record<string, string> = {
                'Collecte': "Relancer un client sur un dossier d'investissement",
                'Réglementaire': "Documents de conformité manquants",
                'Document': "Demander un document spécifique",
                'Anniversaire': "Révision annuelle du portefeuille",
                'Autre': "Toute autre relance personnalisée",
              }
              return (
                <div key={r} className="flex gap-3 p-2.5 border-b border-gray-100 last:border-0 items-center">
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">{r}</span>
                  <p className="text-sm text-gray-600">{descs[r]}</p>
                </div>
              )
            })}
          </div>

          <InfoBox color="amber">
            <strong>Snooze :</strong> Cliquez "Me le rappeler dans..." pour que la relance
            réapparaisse automatiquement à la date choisie, sans être perdue.
          </InfoBox>
        </section>

        {/* RÉGLEMENTAIRE */}
        <section>
          <SectionTitle id="reglementaire">Réglementaire</SectionTitle>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-4">Les 6 documents de conformité</p>
            <div className="space-y-2">
              {[
                ['KYC', "Questionnaire Know Your Customer — document à fournir par le client"],
                ['DER', "Document d'Entrée en Relation signé"],
                ['PI', "Profil Investisseur établi"],
                ['PRECO', "Recommandations personnalisées d'investissement"],
                ['LM', "Lettre de Mission signée"],
                ['RM', "Rapport de Mission remis"],
              ].map(function(c) {
                return (
                  <div key={c[0]} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <span className="w-12 text-center font-bold text-indigo-700 text-sm bg-indigo-100 rounded px-1.5 py-0.5 flex-shrink-0">{c[0]}</span>
                    <span className="text-sm text-gray-700">{c[1]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-3">Codes couleur du score</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3"><div className="w-3 h-3 bg-red-500 rounded-full" /><p className="text-sm text-gray-700">Rouge — 0 à 2 / 6 — Prioritaire</p></div>
              <div className="flex items-center gap-3"><div className="w-3 h-3 bg-amber-500 rounded-full" /><p className="text-sm text-gray-700">Orange — 3 à 4 / 6 — En cours</p></div>
              <div className="flex items-center gap-3"><div className="w-3 h-3 bg-green-500 rounded-full" /><p className="text-sm text-gray-700">Vert — 5 à 6 / 6 — Conforme</p></div>
            </div>
          </div>

          <InfoBox color="blue">
            Pour mettre à jour la conformité d'un client : ouvrez sa fiche, cliquez le crayon ✏️
            dans la section Réglementaire, cochez les documents reçus, puis sauvegardez.
          </InfoBox>
        </section>

        {/* GOOGLE */}
        <section>
          <SectionTitle id="google">Google Gmail &amp; Calendar</SectionTitle>

          <div className="bg-indigo-700 rounded-xl p-5 text-white mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5" />
              <span className="font-bold">Intégration Google</span>
            </div>
            <p className="text-indigo-100 text-sm leading-relaxed">
              Connectez votre compte @private-equity-valley.com pour accéder à vos emails Gmail
              et vos RDV Google Calendar directement depuis chaque fiche client.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-gray-900 mb-4">Étape 1 — Connecter votre compte Google</p>
            <StepList steps={[
              ["Aller dans Paramètres", "Menu de gauche > Paramètres."],
              ["Cliquer 'Connecter mon compte Google'", "Vous êtes redirigé vers la page d'autorisation Google."],
              ["Sélectionner votre compte @private-equity-valley.com", "Choisissez le bon compte si vous en avez plusieurs."],
              ["Accepter les autorisations", "Lecture Gmail et Calendar uniquement."],
              ["Retour automatique", "Le CRM confirme la connexion — vous êtes prêt."],
            ]} />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="bg-blue-50 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900 text-sm">Onglet Emails</span>
              </div>
            </div>
            <div className="p-5 text-sm text-gray-600 space-y-1">
              <p>• Emails échangés avec l'adresse email du client</p>
              <p>• Objet, expéditeur, date, extrait du message</p>
              <p>• Indicateur pièce jointe et statut lu / non lu</p>
              <p>• Bouton ↻ pour actualiser en temps réel</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="bg-green-50 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-900 text-sm">Onglet RDV Calendar</span>
              </div>
            </div>
            <div className="p-5 text-sm text-gray-600 space-y-1">
              <p>• RDV Google Calendar mentionnant le nom du client (±6 mois)</p>
              <p>• Date, heure, nombre de participants</p>
              <p>• Lien direct vers l'événement Google</p>
              <p>• RDV à venir en vert, passés en grisé</p>
            </div>
          </div>

          <div className="space-y-3">
            <InfoBox color="red">
              Si l'email du client n'est pas renseigné dans ses Coordonnées, l'onglet Emails
              ne peut pas afficher de résultats.
            </InfoBox>
            <InfoBox color="amber">
              Nommez vos RDV Google Calendar avec le nom du client (ex: "Louis Martin × PEV")
              pour qu'ils apparaissent correctement dans la fiche.
            </InfoBox>
            <InfoBox color="blue">
              Vos données Gmail et Calendar sont strictement privées — aucun collègue ne voit
              vos emails ni vos RDV.
            </InfoBox>
          </div>
        </section>

        {/* FONCTIONS MANAGER — visible manager + backoffice */}
        {isManagerOrBO && (
          <section>
            <SectionTitle id="manager">
              {isBackOffice ? 'Fonctions Back-office' : 'Fonctions Manager'}
            </SectionTitle>

            {isManager && (
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="font-semibold text-gray-900 mb-3">Accès étendu</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>• Voir <strong>tous les dossiers</strong> de tous les consultants</p>
                    <p>• Vue globale de la facturation du cabinet</p>
                    <p>• Accès aux <strong>rémunérations</strong> de chaque consultant</p>
                    <p>• <strong>Page Analyse</strong> avec statistiques cabinet, graphs, export Excel</p>
                    <p>• Classement des consultants par collecte</p>
                    <p>• Gestion des paramètres et configurations</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="font-semibold text-gray-900 mb-3">Page Analyse</p>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>• Filtres par période, consultant, produit, compagnie</p>
                    <p>• Graphique collecte mensuelle (cliquez un mois pour le détail)</p>
                    <p>• Répartition par produit et financement</p>
                    <p>• Indicateurs facturation : émises, payées, impayées</p>
                    <p>• Export Excel de tous les dossiers filtrés</p>
                  </div>
                </div>
              </div>
            )}

            {isBackOffice && (
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="font-semibold text-gray-900 mb-3">Votre rôle</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>• Valider le paiement des commissions (passage à "Payée")</p>
                    <p>• Consulter tous les dossiers en lecture</p>
                    <p>• Suivi du réglementaire de l'ensemble des clients</p>
                    <p>• Vue complète de la facturation cabinet</p>
                    <p>• Accès aux encaissements globaux</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* FAQ */}
        <section>
          <SectionTitle id="faq">FAQ — Questions fréquentes</SectionTitle>
          <p className="text-gray-500 text-sm mb-6">
            Questions filtrées pour votre profil <strong>{ROLE_LABELS[role]}</strong>.
            Cliquez sur une question pour afficher la réponse.
          </p>

          <div className="space-y-8">
            {filteredFaq.map(function(cat) {
              return (
                <div key={cat.id}>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full" />
                    {cat.label}
                  </h3>
                  <div className="space-y-2">
                    {cat.questions.map(function(item) {
                      const faqId = cat.id + '-' + item.q.substring(0, 20)
                      const isOpen = openFaq === faqId
                      return (
                        <div key={item.q} className="border border-gray-200 rounded-xl overflow-hidden">
                          <button
                            onClick={function() { setOpenFaq(isOpen ? null : faqId) }}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                          >
                            <span className="font-medium text-gray-900 text-sm pr-4">{item.q}</span>
                            {isOpen
                              ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            }
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                              <p className="text-sm text-gray-700 pt-3 leading-relaxed">{item.a}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Support CTA */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center">
          <p className="font-semibold text-gray-900 mb-2">Votre question ne figure pas dans ce guide ?</p>
          <p className="text-sm text-gray-600 mb-4">
            Contactez le support pour toute question non couverte ici.
          </p>
          <button
            onClick={function() { setShowSupport(true) }}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Contacter le support
          </button>
        </div>

      </div>

      {/* Support dialog */}
      {showSupport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={function() { setShowSupport(false) }}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
            onClick={function(e) { e.stopPropagation() }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Contacter le support</h3>
              <button onClick={function() { setShowSupport(false) }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Pour toute question ou problème technique, envoyez un email au support PEV.
                Précisez votre nom, votre rôle et décrivez le problème aussi précisément que possible.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <Mail className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email support</p>
                  <a
                    href="mailto:support@private-equity-valley.com"
                    className="text-indigo-600 font-medium text-sm hover:underline"
                  >
                    support@private-equity-valley.com
                  </a>
                </div>
              </div>
              <a
                href="mailto:support@private-equity-valley.com"
                className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Ouvrir dans ma messagerie
              </a>
              <button
                onClick={function() { setShowSupport(false) }}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
