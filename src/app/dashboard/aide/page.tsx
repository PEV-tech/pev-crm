'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRole, useConsultantInfo } from '@/hooks/use-user'
import {
  BookOpen, ChevronDown, ChevronRight, CheckCircle, AlertCircle, Star, Zap,
  Mail, Calendar, Home, Search, HelpCircle, Phone, FileText, Shield, Bell,
  BarChart3, DollarSign, Users, FolderOpen, Settings, Briefcase, MessageSquare,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────
interface FaqEntry {
  id: string
  categorie: string
  sous_categorie: string | null
  question: string
  reponse: string
  ordre: number
}

type RoleLabel = 'consultant' | 'manager' | 'back_office'

// ─── Section definitions per role ─────────────────────────────────
const ALL_SECTIONS = [
  { id: 'bienvenue', label: 'Bienvenue', icon: BookOpen, roles: ['consultant', 'manager', 'back_office'] },
  { id: 'navigation', label: 'Navigation', icon: Home, roles: ['consultant', 'manager', 'back_office'] },
  { id: 'dossiers', label: 'Dossiers', icon: FolderOpen, roles: ['consultant', 'manager', 'back_office'] },
  { id: 'clients', label: 'Clients', icon: Users, roles: ['consultant', 'manager'] },
  { id: 'facturation', label: 'Facturation', icon: DollarSign, roles: ['manager', 'back_office'] },
  { id: 'encaissements', label: 'Encaissements', icon: DollarSign, roles: ['consultant', 'manager', 'back_office'] },
  { id: 'remunerations', label: 'Rémunérations', icon: Briefcase, roles: ['consultant', 'manager'] },
  { id: 'relances', label: 'Relances', icon: Bell, roles: ['manager', 'back_office'] },
  { id: 'reglementaire', label: 'Réglementaire', icon: Shield, roles: ['manager', 'back_office'] },
  { id: 'analyse', label: 'Analyse', icon: BarChart3, roles: ['manager'] },
  { id: 'journal', label: 'Journal de suivi', icon: MessageSquare, roles: ['consultant', 'manager', 'back_office'] },
  { id: 'pj', label: 'Pièces jointes', icon: FileText, roles: ['consultant', 'manager', 'back_office'] },
  { id: 'google', label: 'Google Suite', icon: Mail, roles: ['consultant', 'manager', 'back_office'] },
  { id: 'faq', label: 'FAQ', icon: HelpCircle, roles: ['consultant', 'manager', 'back_office'] },
  { id: 'support', label: 'Support', icon: Phone, roles: ['consultant', 'manager', 'back_office'] },
]

// ─── Navigation items per role ────────────────────────────────────
const NAV_ITEMS: Record<string, { label: string; desc: string; roles: RoleLabel[] }> = {
  'Tableau de bord': { label: 'Tableau de bord', desc: 'Vue d\'ensemble, KPIs principaux', roles: ['consultant', 'manager', 'back_office'] },
  'Dossiers': { label: 'Dossiers', desc: 'Tous les dossiers clients', roles: ['manager', 'back_office'] },
  'Ma clientèle': { label: 'Ma clientèle', desc: 'Fiches clients détaillées', roles: ['consultant', 'manager'] },
  'Facturation': { label: 'Facturation', desc: 'Commissions à émettre ou émises', roles: ['manager', 'back_office'] },
  'Encaissements': { label: 'Encaissements', desc: 'Commissions reçues', roles: ['manager', 'back_office'] },
  'Rémunérations': { label: 'Rémunérations', desc: 'Votre cagnotte et grille de commissionnement', roles: ['consultant', 'manager'] },
  'Relances': { label: 'Relances', desc: 'Suivi des relances automatiques et manuelles', roles: ['manager', 'back_office'] },
  'Réglementaire': { label: 'Réglementaire', desc: 'Conformité des dossiers clients', roles: ['manager', 'back_office'] },
  'Classement': { label: 'Classement', desc: 'Classement des consultants', roles: ['consultant', 'manager', 'back_office'] },
  'Analyse': { label: 'Analyse', desc: 'Statistiques et rapports détaillés', roles: ['manager'] },
  'Aide & Manuel': { label: 'Aide & Manuel', desc: 'Ce guide', roles: ['consultant', 'manager', 'back_office'] },
  'Paramètres': { label: 'Paramètres', desc: 'Profil, produits, compagnies, connexion Google', roles: ['manager'] },
}

export default function AidePage() {
  const role = useRole()
  const consultantInfo = useConsultantInfo()
  const currentRole = (role || 'consultant') as RoleLabel
  const [active, setActive] = useState('bienvenue')
  const [faqEntries, setFaqEntries] = useState<FaqEntry[]>([])
  const [faqSearch, setFaqSearch] = useState('')
  const [openFaqIds, setOpenFaqIds] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Filter sections by role
  const visibleSections = useMemo(
    () => ALL_SECTIONS.filter(s => s.roles.includes(currentRole)),
    [currentRole]
  )

  // Fetch FAQ from Supabase
  useEffect(() => {
    const fetchFaq = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('faq')
        .select('*')
        .eq('visible', true)
        .order('ordre', { ascending: true })
      if (data) setFaqEntries(data)
    }
    fetchFaq()
  }, [])

  // Group FAQ by categorie > sous_categorie
  const faqGrouped = useMemo(() => {
    const filtered = faqSearch
      ? faqEntries.filter(
          f =>
            f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
            f.reponse.toLowerCase().includes(faqSearch.toLowerCase())
        )
      : faqEntries
    const groups: Record<string, Record<string, FaqEntry[]>> = {}
    filtered.forEach(f => {
      const cat = f.categorie
      const sub = f.sous_categorie || 'Général'
      if (!groups[cat]) groups[cat] = {}
      if (!groups[cat][sub]) groups[cat][sub] = []
      groups[cat][sub].push(f)
    })
    return groups
  }, [faqEntries, faqSearch])

  // Auto-expand all categories when searching
  useEffect(() => {
    if (faqSearch) {
      setExpandedCategories(new Set(Object.keys(faqGrouped)))
    }
  }, [faqSearch, faqGrouped])

  function goTo(id: string) {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function toggleFaq(id: string) {
    setOpenFaqIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const roleLabel = currentRole === 'manager' ? 'Manager' : currentRole === 'back_office' ? 'Back Office' : 'Consultant'
  const roleColor = currentRole === 'manager' ? 'bg-green-100 text-green-700' : currentRole === 'back_office' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'

  return (
    <div className="flex gap-8 min-h-screen">
      {/* Sidebar navigation */}
      <div className="hidden lg:block w-56 flex-shrink-0">
        <div className="sticky top-6 bg-white border border-gray-200 rounded-xl p-3 space-y-0.5">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-gray-900 text-sm">Manuel CRM</span>
          </div>
          <div className="flex items-center gap-2 mb-3 px-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>{roleLabel}</span>
          </div>
          {visibleSections.map(s => {
            const Icon = s.icon
            const cls = active === s.id
              ? 'w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 flex items-center gap-2'
              : 'w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2'
            return (
              <button key={s.id} onClick={() => goTo(s.id)} className={cls}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {s.label}
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

      {/* Main content */}
      <div className="flex-1 max-w-3xl space-y-14 pb-24">
        {/* Header */}
        <div className="bg-indigo-700 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold">Aide & Manuel PEV CRM</h1>
          <p className="text-indigo-200 mt-2">
            Guide {roleLabel === 'Manager' ? 'complet — gestion et administration' : roleLabel === 'Back Office' ? '— gestion administrative' : '— utilisation quotidienne'}
          </p>
          <p className="text-indigo-100 leading-relaxed mt-4">
            Bienvenue dans le CRM de Private Equity Valley. Ce guide couvre l&#39;ensemble des fonctionnalités
            {currentRole === 'consultant' ? ' accessibles depuis votre compte consultant.' : currentRole === 'manager' ? ', y compris l\'administration et l\'analyse.' : ' de gestion et de suivi administratif.'}
          </p>
          <div className="mt-4">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${roleColor}`}>
              Connecté en tant que {roleLabel}
              {consultantInfo ? ` — ${consultantInfo.name}` : ''}
            </span>
          </div>
        </div>

        {/* ── Bienvenue ────────────────────────────────────── */}
        <section id="bienvenue" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Bienvenue</h2>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <p className="text-gray-700 leading-relaxed">
              Le CRM PEV centralise vos dossiers clients, la facturation, les relances,
              la réglementation et vos communications Gmail et Calendar.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-900 mb-2">Trois profils d&#39;accès :</p>
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">Consultant</span>
              <p className="text-sm text-gray-700">Voit et gère ses propres dossiers et clients uniquement. Accès à sa cagnotte, ses rémunérations et sa grille de commissionnement.</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">Manager</span>
              <p className="text-sm text-gray-700">Accès complet à tous les dossiers, facturation, analyse, relances, réglementaire et paramètres d&#39;administration.</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
              <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">Back Office</span>
              <p className="text-sm text-gray-700">Accès à tous les dossiers, facturation, encaissements, relances et réglementaire. Pas d&#39;accès à l&#39;analyse ni aux rémunérations.</p>
            </div>
          </div>
        </section>

        {/* ── Navigation ───────────────────────────────────── */}
        <section id="navigation" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Navigation</h2>
          <p className="text-sm text-gray-500">Les éléments affichés ci-dessous correspondent à votre profil ({roleLabel}).</p>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="space-y-2">
              {Object.entries(NAV_ITEMS)
                .filter(([, v]) => v.roles.includes(currentRole))
                .map(([key, v]) => (
                  <div key={key} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-medium text-gray-900 w-44">{v.label}</span>
                    <span className="text-xs text-gray-500">{v.desc}</span>
                  </div>
                ))}
            </div>
          </div>
        </section>

        {/* ── Dossiers ─────────────────────────────────────── */}
        <section id="dossiers" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Dossiers</h2>
          <p className="text-gray-600">Un dossier représente une opération d&#39;investissement d&#39;un client.</p>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            {[
              { label: 'Prospect', desc: 'Premier contact, opération non engagée', color: 'bg-gray-50', badge: 'bg-gray-100 text-gray-600' },
              { label: 'Client en cours', desc: 'Souscription lancée, en attente de finalisation', color: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
              { label: 'Client finalisé', desc: 'Opération terminée, commission due', color: 'bg-green-50', badge: 'bg-green-100 text-green-700' },
            ].map(s => (
              <div key={s.label} className={`flex items-center gap-3 p-3 ${s.color} rounded-lg`}>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
                <p className="text-sm text-gray-700">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">Passez à « Client finalisé » dès que l&#39;opération est confirmée.</p>
          </div>
        </section>

        {/* ── Clients ──────────────────────────────────────── */}
        {visibleSections.some(s => s.id === 'clients') && (
          <section id="clients" className="scroll-mt-6 space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">Fiches Clients</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
              {[
                ['KPIs', 'Collecte, pipeline, commissions, conformité'],
                ['Dossiers', 'Toutes les opérations liées à ce client'],
                ['Coordonnées', 'Email, téléphone, pays — éditables via le crayon'],
                ['Communications', 'Emails Gmail et RDV Calendar (nécessite connexion Google)'],
                ['Réglementaire', 'KYC, DER, PI, PRECO, LM, RM — score sur 5'],
                ['Journal de suivi', 'Historique structuré : notes, appels, emails, comptes rendus'],
                ['Pièces jointes', 'Documents typés (ID, RIB, réglementaire...) et datés'],
                ['Relances', 'Relances manuelles avec délais et rappels automatiques'],
              ].map(item => (
                <div key={item[0]} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-900 w-40 flex-shrink-0">{item[0]}</span>
                  <span className="text-xs text-gray-500">{item[1]}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Facturation ──────────────────────────────────── */}
        {visibleSections.some(s => s.id === 'facturation') && (
          <section id="facturation" className="scroll-mt-6 space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">Facturation</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              {[
                { label: 'À émettre', desc: 'Commission calculée, facture non encore envoyée', color: 'bg-red-50 border-red-200', dot: 'bg-red-500', textColor: 'text-red-800', subColor: 'text-red-700' },
                { label: 'Émise', desc: 'Facture envoyée, en attente de paiement', color: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500', textColor: 'text-orange-800', subColor: 'text-orange-700' },
                { label: 'Payée → Encaissements', desc: 'Passe dans les Encaissements', color: 'bg-green-50 border-green-200', dot: 'bg-green-500', textColor: 'text-green-800', subColor: 'text-green-700' },
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-4 p-4 ${s.color} border rounded-xl`}>
                  <div className={`w-4 h-4 ${s.dot} rounded-full flex-shrink-0`} />
                  <div>
                    <p className={`font-semibold ${s.textColor}`}>{s.label}</p>
                    <p className={`text-sm ${s.subColor}`}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Encaissements ────────────────────────────────── */}
        <section id="encaissements" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Encaissements</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-700 leading-relaxed">
              Les encaissements regroupent toutes les commissions effectivement payées.
              {currentRole === 'consultant'
                ? ' Vous y retrouvez vos propres commissions encaissées.'
                : ' Vue consolidée de l\'ensemble des commissions encaissées par consultant.'}
            </p>
          </div>
        </section>

        {/* ── Rémunérations ────────────────────────────────── */}
        {visibleSections.some(s => s.id === 'remunerations') && (
          <section id="remunerations" className="scroll-mt-6 space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">Rémunérations</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <p className="text-sm text-gray-700 leading-relaxed">
                La page Rémunérations affiche votre cagnotte (commissions en attente), votre grille de commissionnement progressive et l&#39;historique de facturation.
              </p>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-indigo-900 mb-2">Grille de commissionnement progressive :</p>
                <div className="space-y-1">
                  {[
                    ['65 %', '0 — 75 000 €'],
                    ['75 %', '75 000 — 100 000 €'],
                    ['85 %', '100 000 € et plus'],
                  ].map(([taux, tranche]) => (
                    <div key={taux} className="flex items-center gap-3 text-sm text-indigo-800">
                      <span className="font-bold w-12">{taux}</span>
                      <span>CA glissant 12 mois : {tranche}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Relances ─────────────────────────────────────── */}
        {visibleSections.some(s => s.id === 'relances') && (
          <section id="relances" className="scroll-mt-6 space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">Relances</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <p className="text-sm text-gray-700 mb-2">La page Relances regroupe :</p>
              <div className="space-y-2">
                {[
                  { label: 'Automatiques', desc: 'KYC manquant, inactivité 30j+, paiement en attente, réglementaire incomplet, facture impayée 30j+' },
                  { label: 'Manuelles', desc: 'Créées depuis la fiche client avec des délais prédéfinis (3j, 5j, 15j, 3 sem, 1 mois, 3 mois, 6 mois, 1 an)' },
                ].map(r => (
                  <div key={r.label} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">{r.label}</span>
                    <p className="text-sm text-gray-700">{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
              <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Actions possibles : Fait, Ignoré, ou « Me le rappeler dans... ». La relance réapparaît automatiquement à la date de rappel choisie.
              </p>
            </div>
          </section>
        )}

        {/* ── Réglementaire ────────────────────────────────── */}
        {visibleSections.some(s => s.id === 'reglementaire') && (
          <section id="reglementaire" className="scroll-mt-6 space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">Réglementaire</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
              <p className="text-sm text-gray-700 mb-3">Score de conformité sur 5 points :</p>
              {[
                { label: '1. Réglementaire (KYC)', counted: true },
                { label: '2. DER', counted: true },
                { label: '3. PI', counted: true },
                { label: '4. LM', counted: true },
                { label: '5. RM', counted: true },
                { label: '6. PRECO (affiché mais non compté)', counted: false },
              ].map(c => (
                <div key={c.label} className={`flex items-center gap-3 p-2 rounded-lg ${c.counted ? 'bg-gray-50' : 'bg-amber-50'}`}>
                  <CheckCircle className={`w-4 h-4 flex-shrink-0 ${c.counted ? 'text-indigo-600' : 'text-amber-500'}`} />
                  <span className={`text-sm ${c.counted ? 'text-gray-900' : 'text-amber-800 italic'}`}>{c.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Analyse ──────────────────────────────────────── */}
        {visibleSections.some(s => s.id === 'analyse') && (
          <section id="analyse" className="scroll-mt-6 space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">Analyse</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-700 leading-relaxed">
                La page Analyse offre une vue statistique complète : distribution par produit, par consultant, par zone géographique, évolution mensuelle du CA, taux de conversion et répartition des statuts. Accessible uniquement aux managers.
              </p>
            </div>
          </section>
        )}

        {/* ── Journal de suivi ─────────────────────────────── */}
        <section id="journal" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Journal de suivi</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-700 mb-3">
              Le journal de suivi remplace l&#39;ancien champ commentaire. Chaque entrée est structurée avec une étiquette colorée :
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Compte rendu RDV', color: 'bg-blue-100 text-blue-700' },
                { label: 'Email', color: 'bg-green-100 text-green-700' },
                { label: 'Appel téléphonique', color: 'bg-yellow-100 text-yellow-700' },
                { label: 'Note interne', color: 'bg-orange-100 text-orange-700' },
                { label: 'Relance', color: 'bg-red-100 text-red-700' },
                { label: 'Document reçu', color: 'bg-purple-100 text-purple-700' },
                { label: 'Autre', color: 'bg-gray-100 text-gray-700' },
              ].map(e => (
                <span key={e.label} className={`text-xs font-medium px-3 py-1.5 rounded-full ${e.color}`}>{e.label}</span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Les entrées sont triées par ordre chronologique inverse. Vous pouvez filtrer par type et éditer/supprimer vos propres entrées.
            </p>
          </div>
        </section>

        {/* ── Pièces jointes ───────────────────────────────── */}
        <section id="pj" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Pièces jointes</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-700 mb-3">
              Chaque pièce jointe peut être typée et datée :
            </p>
            <div className="grid grid-cols-2 gap-2">
              {['Pièce d\'identité', 'RIB', 'Justificatif domicile', 'Origine des fonds', 'Disponibilité des fonds', 'NIF', 'Contrat', 'Bulletin de souscription', 'Réglementaire', 'Autre'].map(t => (
                <div key={t} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-700">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Google Suite ─────────────────────────────────── */}
        <section id="google" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Intégration Google</h2>
          <div className="bg-indigo-700 rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5" />
              <span className="font-bold">Connexion Google</span>
            </div>
            <p className="text-indigo-100 text-sm">
              Connectez votre compte Google depuis les Paramètres pour synchroniser vos emails Gmail et vos RDV Calendar directement dans les fiches clients.
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
              Affiche les emails échangés avec le client via son adresse email : objet, expéditeur, date, extrait.
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
              Affiche les RDV mentionnant le nom du client sur ±6 mois : date, heure, participants.
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Nommez vos RDV Google Calendar avec le nom du client pour qu&#39;ils apparaissent dans la fiche.
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">
              Si l&#39;email du client n&#39;est pas renseigné, l&#39;onglet Emails ne peut pas afficher de résultats.
            </p>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">FAQ</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher dans la FAQ..."
              value={faqSearch}
              onChange={e => setFaqSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {Object.keys(faqGrouped).length === 0 && faqSearch && (
            <div className="text-center py-8">
              <HelpCircle className="mx-auto text-gray-300 mb-3" size={36} />
              <p className="text-gray-500 text-sm">Aucun résultat pour « {faqSearch} »</p>
            </div>
          )}

          {Object.entries(faqGrouped).map(([categorie, sousCategories]) => (
            <div key={categorie} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCategory(categorie)}
                className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-semibold text-gray-900">{categorie}</span>
                {expandedCategories.has(categorie)
                  ? <ChevronDown className="w-4 h-4 text-gray-500" />
                  : <ChevronRight className="w-4 h-4 text-gray-500" />}
              </button>
              {expandedCategories.has(categorie) && (
                <div className="divide-y divide-gray-100">
                  {Object.entries(sousCategories).map(([sousCat, entries]) => (
                    <div key={sousCat}>
                      {sousCat !== 'Général' && (
                        <div className="px-5 py-2 bg-gray-50/50">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{sousCat}</span>
                        </div>
                      )}
                      {entries.map(faq => (
                        <div key={faq.id} className="border-b border-gray-50 last:border-0">
                          <button
                            onClick={() => toggleFaq(faq.id)}
                            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                          >
                            <span className="font-medium text-gray-800 text-sm pr-4">{faq.question}</span>
                            {openFaqIds.has(faq.id)
                              ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                          </button>
                          {openFaqIds.has(faq.id) && (
                            <div className="px-5 pb-4">
                              <p className="text-sm text-gray-600 leading-relaxed bg-indigo-50 rounded-lg p-3">{faq.reponse}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* ── Support ──────────────────────────────────────── */}
        <section id="support" className="scroll-mt-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Support</h2>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center">
            <HelpCircle className="mx-auto text-indigo-400 mb-3" size={32} />
            <p className="font-semibold text-gray-900 mb-2">Besoin d&#39;aide ?</p>
            <p className="text-sm text-gray-600 mb-4">
              Si vous ne trouvez pas la réponse dans la FAQ, contactez le support.
            </p>
            <a
              href="mailto:support@private-equity-valley.com"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contacter le support
            </a>
            <p className="text-xs text-gray-500 mt-3">support@private-equity-valley.com</p>
          </div>
        </section>

      </div>
    </div>
  )
}
