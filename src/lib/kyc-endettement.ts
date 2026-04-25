/**
 * Taux d'endettement — helper partagé entre le dashboard KYC (kyc-section.tsx)
 * et le générateur PDF (kyc-pdf.ts).
 *
 * Historique
 * ----------
 * - Chantier #3 (2026-04-21) : la formule précédente sommait un champ texte
 *   `echeance` qui était en réalité une DATE → taux toujours = 0. Corrigé
 *   pour utiliser `echeance_mensuelle` (numérique, euros / mois).
 * - Chantier #7.5 (2026-04-24) : élargissement du numérateur. Avant, seules
 *   les mensualités de crédits (`emprunts[].echeance_mensuelle`) étaient
 *   comptées. On ajoute désormais :
 *     · `montant_loyer`                  si statut logement = "Locataire"
 *     · `charges_residence_principale`   si statut logement = "Propriétaire"
 *       ou "Usufruitier"
 *   Ces deux champs représentent une charge fixe mensuelle structurelle qui
 *   pèse sur la capacité de remboursement. C'est la définition HCSF du taux
 *   d'endettement utilisée en conseil patrimonial (plafond recommandé 35 %).
 */

export interface EmpruntLike {
  echeance_mensuelle?: number | null
}

export interface EndettementInput {
  proprietaire_locataire?: string | null
  montant_loyer?: number | null
  charges_residence_principale?: number | null
  total_revenus_annuel?: number | null
  revenus_pro_net?: number | null
  revenus_fonciers?: number | null
  autres_revenus?: number | null
  emprunts?: EmpruntLike[] | null
}

export interface EndettementBreakdown {
  /** Pourcentage, arrondi à 2 décimales. 0 si pas de revenus. */
  taux: number
  /** Revenus mensuels (= total annuel / 12). */
  revenusMensuels: number
  /** Somme des mensualités de crédits (euros / mois). */
  mensualitesCredits: number
  /** Loyer mensuel pris en compte (0 si pas locataire). */
  loyer: number
  /** Charges RP mensuelles prises en compte (0 si pas propriétaire/usufruitier). */
  chargesResidence: number
  /** Somme totale au numérateur. */
  chargesTotales: number
  /** Nombre d'emprunts dont echeance_mensuelle est manquante — fausse le taux. */
  empruntsIncomplets: number
  /** true si aucun revenu (taux non calculable). */
  revenusManquants: boolean
}

/** Détecte si la saisie "statut logement" implique un loyer mensuel. */
export function isLocataire(statut: string | null | undefined): boolean {
  return (statut || '').toLowerCase().includes('locataire')
}

/** Détecte si la saisie "statut logement" implique des charges RP (crédit + copro + taxe). */
export function isProprietaireOuUsufruitier(statut: string | null | undefined): boolean {
  const v = (statut || '').toLowerCase()
  return v.includes('propri') || v.includes('usufruitier')
}

/**
 * Calcule le taux d'endettement et sa décomposition.
 *
 * - Les revenus sont fournis **annuels** (cohérent avec la colonne DB
 *   `total_revenus_annuel`). On divise par 12 pour le dénominateur.
 * - Si `total_revenus_annuel` est nul ou absent, on re-somme les 3 composantes
 *   revenus_pro_net + revenus_fonciers + autres_revenus comme fallback, même
 *   logique que la section Revenus historique.
 * - Les `emprunts` sans `echeance_mensuelle` sont comptés `0` mais signalés
 *   via `empruntsIncomplets` pour que l'UI affiche un warning.
 * - Le loyer et les charges sont mensuels par définition (saisie UI explicite).
 */
export function computeEndettement(input: EndettementInput): EndettementBreakdown {
  const totalRevenusAnnuel =
    (input.total_revenus_annuel && input.total_revenus_annuel > 0)
      ? input.total_revenus_annuel
      : (input.revenus_pro_net || 0) +
        (input.revenus_fonciers || 0) +
        (input.autres_revenus || 0)

  const revenusMensuels = totalRevenusAnnuel / 12

  const emprunts = input.emprunts || []
  const mensualitesCredits = emprunts.reduce(
    (sum, e) => sum + (typeof e.echeance_mensuelle === 'number' && Number.isFinite(e.echeance_mensuelle) ? e.echeance_mensuelle : 0),
    0,
  )
  const empruntsIncomplets = emprunts.filter(
    (e) => typeof e.echeance_mensuelle !== 'number' || !Number.isFinite(e.echeance_mensuelle),
  ).length

  const loyer = isLocataire(input.proprietaire_locataire)
    ? Number(input.montant_loyer ?? 0) || 0
    : 0
  const chargesResidence = isProprietaireOuUsufruitier(input.proprietaire_locataire)
    ? Number(input.charges_residence_principale ?? 0) || 0
    : 0

  const chargesTotales = mensualitesCredits + loyer + chargesResidence
  const taux = revenusMensuels > 0
    ? Math.round((chargesTotales / revenusMensuels) * 10000) / 100
    : 0

  return {
    taux,
    revenusMensuels,
    mensualitesCredits,
    loyer,
    chargesResidence,
    chargesTotales,
    empruntsIncomplets,
    revenusManquants: revenusMensuels <= 0,
  }
}

/**
 * Libellé court décrivant la composition du numérateur, ex :
 *   "1 200 € crédits + 850 € charges RP"
 * Utilisé comme sous-texte sous le taux affiché.
 */
export function formatBreakdown(b: EndettementBreakdown): string {
  const parts: string[] = []
  const fmt = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
  if (b.mensualitesCredits > 0) parts.push(`${fmt(b.mensualitesCredits)} crédits`)
  if (b.loyer > 0) parts.push(`${fmt(b.loyer)} loyer`)
  if (b.chargesResidence > 0) parts.push(`${fmt(b.chargesResidence)} charges RP`)
  return parts.join(' + ')
}
