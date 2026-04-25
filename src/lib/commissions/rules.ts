import { Consultant, Dossier } from '@/types/database'

/**
 * Commission split breakdown for a specific rule.
 * All percentages sum to 100% (or 70%/75% for CAV/CAPI encours after pre-deductions).
 */
export interface CommissionSplit {
  part_consultant: number // Percentage for the main consultant
  part_pool_plus: number // Percentage for POOL+ (Thélo + Maxine + third person if applicable)
  part_thelo: number // Percentage for Thélo
  part_maxine: number // Percentage for Maxine
  part_stephane: number // Percentage for Stéphane
  part_cabinet: number // Percentage for Cabinet PEV
}

/**
 * Defines a single commission rule with its name, description, and split percentages.
 */
export interface CommissionRule {
  id: number
  name: string
  description: string
  split: CommissionSplit
}

/**
 * All 9 commission rules for the PEV CRM.
 *
 * 2026-04-25 — Les valeurs reflètent les pourcentages EFFECTIVEMENT
 * appliqués (après distribution intra-pool). Cohérent avec le seed DB
 * de la table `commission_split_rules` (cf. migration 2026-04-25).
 *
 * Sert de fail-safe quand la DB est inaccessible — `rules-loader.ts`
 * fetch d'abord la DB, fallback sur ce tableau si erreur.
 */
export const COMMISSION_RULES: CommissionRule[] = [
  {
    id: 1,
    name: 'Client chassé par Thélo',
    description: 'Client sourced by Thélo (manager) — Thélo touche les 50% comme consultant.',
    split: {
      part_consultant: 50, part_pool_plus: 10, part_thelo: 0, part_maxine: 10, part_stephane: 0, part_cabinet: 30,
    },
  },
  {
    id: 2,
    name: 'Client chassé par Maxine',
    description: 'Client sourced by Maxine (admin/manager) — Maxine touche les 50% comme consultant.',
    split: {
      part_consultant: 50, part_pool_plus: 10, part_thelo: 10, part_maxine: 0, part_stephane: 0, part_cabinet: 30,
    },
  },
  {
    id: 3,
    name: 'Client apporté par le Pool',
    description: 'Client sourced by the Pool — pot pool de 70% réparti en 3 (POOL+ / Thélo / Maxine), cabinet 30%.',
    split: {
      part_consultant: 0, part_pool_plus: 23.33, part_thelo: 23.33, part_maxine: 23.33, part_stephane: 0, part_cabinet: 30,
    },
  },
  {
    id: 4,
    name: 'Stéphane — Entrée',
    description: 'Deal sourced by Stéphane (entry) — Stéphane touche 50% comme apporteur, pot pool 25% en 3.',
    split: {
      part_consultant: 0, part_pool_plus: 8.33, part_thelo: 8.33, part_maxine: 8.33, part_stephane: 50, part_cabinet: 25,
    },
  },
  {
    id: 5,
    name: 'Stéphane — France',
    description: 'Stéphane manages French clients — splits identiques à Stéphane Entrée.',
    split: {
      part_consultant: 0, part_pool_plus: 8.33, part_thelo: 8.33, part_maxine: 8.33, part_stephane: 50, part_cabinet: 25,
    },
  },
  {
    id: 6,
    name: 'Consultant tier 65%',
    description: 'Hugues, James, Guillaume, Maxine at 65% — pot pool de 10% réparti en 3.',
    split: {
      part_consultant: 65, part_pool_plus: 3.33, part_thelo: 3.33, part_maxine: 3.33, part_stephane: 0, part_cabinet: 25,
    },
  },
  {
    id: 7,
    name: 'Consultant tier 50%',
    description: 'Mathias, Thélo at 50% — pot pool de 25% réparti en 3.',
    split: {
      part_consultant: 50, part_pool_plus: 8.33, part_thelo: 8.33, part_maxine: 8.33, part_stephane: 0, part_cabinet: 25,
    },
  },
  {
    id: 8,
    name: 'Consultant tier 30%',
    description: 'Valentin, Gilles at 30% — pot pool de 40% réparti en 3.',
    split: {
      part_consultant: 30, part_pool_plus: 13.33, part_thelo: 13.33, part_maxine: 13.33, part_stephane: 0, part_cabinet: 30,
    },
  },
  {
    id: 9,
    name: 'Encours de gestion (CAV/CAPI)',
    description: 'Recurring management fees on CAV LUX/CAPI LUX contracts (25% PEV, 30% Cabinet pre-deduction). Parts déterminées dynamiquement par le moteur — ne pas modifier.',
    split: {
      part_consultant: 0, part_pool_plus: 0, part_thelo: 0, part_maxine: 0, part_stephane: 0, part_cabinet: 0,
    },
  },
]

// CONSULTANT_TIER_MAP retiré 2026-04-25 — la logique de mapping
// (consultant + dossier) → rule_key vit désormais dans determineRuleKey()
// directement, sans table intermédiaire.

/**
 * Determine the applicable rule_key (string identifier) for a (consultant, dossier)
 * pair. Pure function : ne dépend pas du tableau de règles, juste du scénario métier.
 *
 * 2026-04-25 — Extrait de l'ancien `determineRule()` pour permettre le branchement
 * sur la table DB `commission_split_rules` sans dupliquer la logique de matching.
 */
export function determineRuleKey(consultant: Consultant, dossier: Dossier): string {
  // Point 3.2 (2026-04-24) — Consultant fictif POOL → règle 'pool' direct,
  // prioritaire sur les autres branches.
  const isPoolConsultant =
    (consultant.prenom && consultant.prenom.trim().toUpperCase() === 'POOL') ||
    (consultant.nom && consultant.nom.trim().toUpperCase() === 'POOL')
  if (isPoolConsultant) return 'pool'

  // Apporteur-based : matching sur dossier.apporteur_label
  if (dossier.apporteur_label) {
    const apporteurName = dossier.apporteur_label.trim()
    if (apporteurName === 'Thélo') return 'chasse_thelo'
    if (apporteurName === 'Maxine') return 'chasse_maxine'
    if (apporteurName === 'Stéphane') return 'stephane_entree' // France & Entrée ont splits identiques
    if (apporteurName.toLowerCase().includes('pool')) return 'pool'
  }

  // Default tier-based (taux_remuneration sur consultant)
  if (consultant.taux_remuneration === 0.65) return 'tier_65'
  if (consultant.taux_remuneration === 0.5) return 'tier_50'
  if (consultant.taux_remuneration === 0.3) return 'tier_30'

  // Fallback : tier 50%
  return 'tier_50'
}

/**
 * Determine la règle applicable en utilisant un tableau de règles fourni
 * (typiquement chargé depuis Supabase via loadCommissionRules()).
 *
 * @param consultant Le consultant rattaché au dossier
 * @param dossier Le dossier
 * @param rules Le tableau de règles (DB-backed)
 * @returns La règle qui s'applique
 */
export function determineRuleFromArray(
  consultant: Consultant,
  dossier: Dossier,
  rules: CommissionRule[],
): CommissionRule {
  const ruleKey = determineRuleKey(consultant, dossier)
  const ruleKeyToId: Record<string, number> = {
    chasse_thelo: 1,
    chasse_maxine: 2,
    pool: 3,
    stephane_entree: 4,
    stephane_france: 5,
    tier_65: 6,
    tier_50: 7,
    tier_30: 8,
    encours: 9,
  }
  const targetId = ruleKeyToId[ruleKey] ?? 7
  return rules.find((r) => r.id === targetId) ?? rules[6] ?? COMMISSION_RULES[6]
}

/**
 * Legacy synchrone : utilise les constantes statiques COMMISSION_RULES.
 * Conservée pour la rétro-compatibilité des call sites synchrones non
 * encore migrés vers loadCommissionRules() async. À termet, à remplacer.
 *
 * @deprecated Préférer `determineRuleFromArray(consultant, dossier, rules)`
 *             avec un tableau chargé depuis Supabase via `loadCommissionRules()`.
 */
export function determineRule(consultant: Consultant, dossier: Dossier): CommissionRule {
  return determineRuleFromArray(consultant, dossier, COMMISSION_RULES)
}
