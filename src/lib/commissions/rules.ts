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
 */
export const COMMISSION_RULES: CommissionRule[] = [
  {
    id: 1,
    name: 'Client chassé par Thélo',
    description: 'Client sourced by Thélo (manager)',
    split: {
      part_consultant: 50, // Thélo
      part_pool_plus: 10,
      part_thelo: 0, // Already counted in consultant
      part_maxine: 10,
      part_stephane: 0,
      part_cabinet: 30,
    },
  },
  {
    id: 2,
    name: 'Client chassé par Maxine',
    description: 'Client sourced by Maxine (admin/manager)',
    split: {
      part_consultant: 50, // Maxine
      part_pool_plus: 10,
      part_thelo: 10,
      part_maxine: 0, // Already counted in consultant
      part_stephane: 0,
      part_cabinet: 30,
    },
  },
  {
    id: 3,
    name: 'Client apporté par le Pool',
    description: 'Client sourced by the Pool (Maxine + Thélo together)',
    split: {
      part_consultant: 0, // Distributed among pool members
      part_pool_plus: 70, // Distributed as 23.3% to POOL+, 23.3% to Thélo, 23.3% to Maxine
      part_thelo: 0, // Part of pool distribution
      part_maxine: 0, // Part of pool distribution
      part_stephane: 0,
      part_cabinet: 30,
    },
  },
  {
    id: 4,
    name: 'Stéphane — Entrée',
    description: 'Deal sourced by Stéphane (entry)',
    split: {
      part_consultant: 50, // Stéphane
      part_pool_plus: 25, // Distributed as 8.3% to POOL+, 8.3% to Thélo, 8.3% to Maxine
      part_thelo: 0, // Part of pool distribution
      part_maxine: 0, // Part of pool distribution
      part_stephane: 0, // Already counted in consultant
      part_cabinet: 25,
    },
  },
  {
    id: 5,
    name: 'Stéphane — France',
    description: 'Stéphane manages French clients',
    split: {
      part_consultant: 50, // Stéphane
      part_pool_plus: 25, // Distributed as 8.3% to POOL+, 8.3% to Thélo, 8.3% to Maxine
      part_thelo: 0, // Part of pool distribution
      part_maxine: 0, // Part of pool distribution
      part_stephane: 0, // Already counted in consultant
      part_cabinet: 25,
    },
  },
  {
    id: 6,
    name: 'Consultant tier 65%',
    description: 'Hugues, James, Guillaume, Maxine at 65%',
    split: {
      part_consultant: 65,
      part_pool_plus: 10, // Distributed as ~3.33% to POOL+, ~3.33% to Thélo, ~3.33% to Maxine
      part_thelo: 0, // Part of pool distribution
      part_maxine: 0, // Part of pool distribution
      part_stephane: 0,
      part_cabinet: 25,
    },
  },
  {
    id: 7,
    name: 'Consultant tier 50%',
    description: 'Mathias, Thélo at 50%',
    split: {
      part_consultant: 50,
      part_pool_plus: 25, // Distributed as 8.3% to POOL+, 8.3% to Thélo, 8.3% to Maxine
      part_thelo: 0, // Part of pool distribution
      part_maxine: 0, // Part of pool distribution
      part_stephane: 0,
      part_cabinet: 25,
    },
  },
  {
    id: 8,
    name: 'Consultant tier 30%',
    description: 'Valentin, Gilles at 30%',
    split: {
      part_consultant: 30,
      part_pool_plus: 40, // Distributed as 13.3% to POOL+, 13.3% to Thélo, 13.3% to Maxine
      part_thelo: 0, // Part of pool distribution
      part_maxine: 0, // Part of pool distribution
      part_stephane: 0,
      part_cabinet: 30,
    },
  },
  {
    id: 9,
    name: 'Encours de gestion (CAV/CAPI)',
    description:
      'Recurring management fees on CAV LUX/CAPI LUX contracts (25% PEV, 30% Cabinet pre-deduction)',
    split: {
      part_consultant: 0, // Determined by matching dossier rule
      part_pool_plus: 0, // Determined by matching dossier rule
      part_thelo: 0, // Determined by matching dossier rule
      part_maxine: 0, // Determined by matching dossier rule
      part_stephane: 0,
      part_cabinet: 0, // Determined by matching dossier rule + 30% pre-deduction
    },
  },
]

/**
 * Mapping of consultant names to their tier and applicable rule.
 * Used by determineRule to automatically select the correct commission rule.
 */
const CONSULTANT_TIER_MAP: {
  [key: string]: { tier: string; ruleIds: number[] }
} = {
  Thélo: { tier: '50%', ruleIds: [1, 7] },
  Maxine: { tier: '65%', ruleIds: [2, 6] },
  Stéphane: { tier: 'source', ruleIds: [4, 5] },
  Mathias: { tier: '50%', ruleIds: [7] },
  Guillaume: { tier: '65%', ruleIds: [6] },
  James: { tier: '65%', ruleIds: [6] },
  Hugues: { tier: '65%', ruleIds: [6] },
  Gilles: { tier: '30%', ruleIds: [8] },
  Valentin: { tier: '30%', ruleIds: [8] },
}

/**
 * Automatically determines which commission rule applies based on:
 * - Consultant name and tier (from taux_remuneration)
 * - Dossier fields (apporteur_label, client sourcing indicators)
 *
 * @param consultant The consultant record
 * @param dossier The dossier record
 * @returns The applicable CommissionRule
 */
export function determineRule(consultant: Consultant, dossier: Dossier): CommissionRule {
  // Check for encours de gestion (CAV/CAPI) - Rule 9
  // This would be determined by the product type and payment method in the dossier
  // For now, assume this is handled at a higher level in the engine

  const consultantName = consultant.nom.trim()

  // Check if the dossier is apporteur-based (sourced by specific consultant)
  if (dossier.apporteur_label) {
    const apporteurName = dossier.apporteur_label.trim()

    // Rule 1: Client chassé par Thélo
    if (apporteurName === 'Thélo') {
      return COMMISSION_RULES[0]
    }

    // Rule 2: Client chassé par Maxine
    if (apporteurName === 'Maxine') {
      return COMMISSION_RULES[1]
    }

    // Rules 4-5: Stéphane — Entrée or France
    if (apporteurName === 'Stéphane') {
      // Rule 5 for France zone, Rule 4 otherwise
      // For simplicity, return Rule 4 (they have identical splits)
      return COMMISSION_RULES[3]
    }

    // Rule 3: Client apporté par le Pool (if apporteur_label indicates pool sourcing)
    if (apporteurName.toLowerCase().includes('pool')) {
      return COMMISSION_RULES[2]
    }
  }

  // Default based on consultant tier (taux_remuneration)
  // Rule 6: Consultant tier 65% (Hugues, James, Guillaume, Maxine)
  if (consultant.taux_remuneration === 0.65) {
    return COMMISSION_RULES[5]
  }

  // Rule 7: Consultant tier 50% (Mathias, Thélo at 50% default)
  if (consultant.taux_remuneration === 0.5) {
    return COMMISSION_RULES[6]
  }

  // Rule 8: Consultant tier 30% (Valentin, Gilles)
  if (consultant.taux_remuneration === 0.3) {
    return COMMISSION_RULES[7]
  }

  // Default fallback to Rule 7 (50% tier)
  return COMMISSION_RULES[6]
}
