import { Consultant, Dossier, Commission, TypeFraisType } from '@/types/database'
import { CommissionRule, CommissionSplit, COMMISSION_RULES, determineRule } from './rules'

/**
 * The breakdown of commission amounts for each party.
 * All amounts sum to the total commission_amount.
 */
export interface CommissionBreakdown {
  part_consultant: number
  part_pool_plus: number
  part_thelo: number
  part_maxine: number
  part_stephane: number
  part_cabinet: number
  total: number // Sum of all parts for verification
}

/**
 * Extended breakdown including the rule used and additional metadata.
 */
export interface CommissionCalculationResult extends CommissionBreakdown {
  rule_id: number
  rule_name: string
  encaissement_amount: number
  commission_rate: number // The rate applied (e.g., 0.07 for 7%)
  commission_brute: number // Total commission before distribution
  has_cav_capi_deduction: boolean
  pev_deduction: number // 25% taken by PEV for CAV/CAPI management
  cabinet_deduction: number // 30% taken by Cabinet for apporteur fees (CAV/CAPI only)
}

/**
 * Calculates commissions for a dossier based on encaissement (actual payment received).
 *
 * IMPORTANT: Commissions are calculated on ENCAISSEMENTS (actual payments), NOT on invoiced amounts.
 *
 * For Rule 9 (Encours de gestion / CAV/CAPI):
 * - 25% is taken by PEV first (Gestion PEV, Gestion Namara, Distribution fees)
 * - 30% is taken by Cabinet for Apporteur fees
 * - The remaining amount is distributed according to the rule matching the dossier
 *
 * @param consultant The consultant associated with the dossier
 * @param dossier The dossier record
 * @param commissionRate The commission rate for this dossier (e.g., 0.07 for 7%)
 * @param encaissement_amount The actual payment received (not the invoice amount)
 * @returns CommissionCalculationResult with all breakdown amounts
 */
export function calculateCommission(
  consultant: Consultant,
  dossier: Dossier,
  commissionRate: number,
  encaissement_amount: number,
): CommissionCalculationResult {
  // Determine which rule applies
  const rule = determineRule(consultant, dossier)

  // Calculate gross commission on encaissement
  const commission_brute = encaissement_amount * commissionRate

  // Check if this is a CAV/CAPI encours (management fees)
  const isCavCapi = isCavCapiProduct(dossier)
  let distributableAmount = commission_brute
  let pevDeduction = 0
  let cabinetDeduction = 0
  let appliedRule = rule

  if (isCavCapi) {
    // Rule 9: CAV/CAPI Management Fees
    // Pre-deduct amounts before distribution
    pevDeduction = commission_brute * 0.25 // 25% for PEV
    cabinetDeduction = commission_brute * 0.3 // 30% for Cabinet

    // Remaining for distribution
    distributableAmount = commission_brute - pevDeduction - cabinetDeduction

    // Find the rule matching this dossier's actual operation
    // For CAV/CAPI, use the underlying rule (Rules 1-8) to distribute the remainder
    appliedRule = findUnderlyingRule(consultant, dossier)
  }

  // Apply the rule's split percentages
  const breakdown = applySplit(appliedRule, distributableAmount, consultant.nom)

  // For CAV/CAPI, add the cabinet deduction to cabinet's part
  if (isCavCapi) {
    breakdown.part_cabinet += cabinetDeduction
  }

  // Build the result
  const result: CommissionCalculationResult = {
    ...breakdown,
    total: breakdown.part_consultant +
      breakdown.part_pool_plus +
      breakdown.part_thelo +
      breakdown.part_maxine +
      breakdown.part_stephane +
      breakdown.part_cabinet,
    rule_id: appliedRule.id,
    rule_name: appliedRule.name,
    encaissement_amount,
    commission_rate: commissionRate,
    commission_brute,
    has_cav_capi_deduction: isCavCapi,
    pev_deduction: pevDeduction,
    cabinet_deduction: cabinetDeduction,
  }

  return result
}

/**
 * Applies a commission rule's split percentages to a commission amount.
 * Handles special cases like Rule 3 (Pool) and Rules with distributed pool shares.
 *
 * @param rule The commission rule to apply
 * @param amount The amount to distribute
 * @param consultantName The name of the consultant (for context)
 * @returns CommissionBreakdown with distributed amounts
 */
function applySplit(rule: CommissionRule, amount: number, consultantName: string): CommissionBreakdown {
  const split = rule.split
  const breakdown: CommissionBreakdown = {
    part_consultant: 0,
    part_pool_plus: 0,
    part_thelo: 0,
    part_maxine: 0,
    part_stephane: 0,
    part_cabinet: 0,
    total: amount,
  }

  // Rule 3: Client apporté par le Pool
  // 70% distributed equally among POOL+ (23.3%), Thélo (23.3%), Maxine (23.3%)
  if (rule.id === 3) {
    breakdown.part_pool_plus = amount * (23.3 / 100)
    breakdown.part_thelo = amount * (23.3 / 100)
    breakdown.part_maxine = amount * (23.3 / 100)
    breakdown.part_cabinet = amount * (30 / 100)
    return breakdown
  }

  // Rules 4-5: Stéphane — Entrée / France
  // Stéphane: 50%, then 25% distributed among POOL+ (8.3%), Thélo (8.3%), Maxine (8.3%), Cabinet (25%)
  if (rule.id === 4 || rule.id === 5) {
    breakdown.part_stephane = amount * (50 / 100)
    breakdown.part_pool_plus = amount * (8.3 / 100)
    breakdown.part_thelo = amount * (8.3 / 100)
    breakdown.part_maxine = amount * (8.3 / 100)
    breakdown.part_cabinet = amount * (25 / 100)
    return breakdown
  }

  // Rule 6: Consultant tier 65%
  // Consultant: 65%, then 10% distributed among POOL+ (~3.33%), Thélo (~3.33%), Maxine (~3.33%), Cabinet (25%)
  if (rule.id === 6) {
    breakdown.part_consultant = amount * (65 / 100)
    breakdown.part_pool_plus = amount * (3.333 / 100)
    breakdown.part_thelo = amount * (3.333 / 100)
    breakdown.part_maxine = amount * (3.333 / 100)
    breakdown.part_cabinet = amount * (25 / 100)
    return breakdown
  }

  // Rule 7: Consultant tier 50%
  // Consultant: 50%, then 25% distributed among POOL+ (8.3%), Thélo (8.3%), Maxine (8.3%), Cabinet (25%)
  if (rule.id === 7) {
    breakdown.part_consultant = amount * (50 / 100)
    breakdown.part_pool_plus = amount * (8.3 / 100)
    breakdown.part_thelo = amount * (8.3 / 100)
    breakdown.part_maxine = amount * (8.3 / 100)
    breakdown.part_cabinet = amount * (25 / 100)
    return breakdown
  }

  // Rule 8: Consultant tier 30%
  // Consultant: 30%, then 40% distributed among POOL+ (13.3%), Thélo (13.3%), Maxine (13.3%), Cabinet (30%)
  if (rule.id === 8) {
    breakdown.part_consultant = amount * (30 / 100)
    breakdown.part_pool_plus = amount * (13.3 / 100)
    breakdown.part_thelo = amount * (13.3 / 100)
    breakdown.part_maxine = amount * (13.3 / 100)
    breakdown.part_cabinet = amount * (30 / 100)
    return breakdown
  }

  // Rules 1-2: Client chassé par sourcing manager (Thélo or Maxine)
  if (rule.id === 1 || rule.id === 2) {
    // The sourcing manager is the consultant in this case
    breakdown.part_consultant = amount * (50 / 100)

    if (rule.id === 1) {
      // Thélo sources: Thélo (50%), Maxine (10%), POOL+ (10%), Cabinet (30%)
      breakdown.part_maxine = amount * (10 / 100)
      breakdown.part_pool_plus = amount * (10 / 100)
    } else {
      // Maxine sources: Maxine (50%), Thélo (10%), POOL+ (10%), Cabinet (30%)
      breakdown.part_thelo = amount * (10 / 100)
      breakdown.part_pool_plus = amount * (10 / 100)
    }

    breakdown.part_cabinet = amount * (30 / 100)
    return breakdown
  }

  // Default: shouldn't reach here
  return breakdown
}

/**
 * Determines if a dossier is a CAV/CAPI product (Rule 9 applies).
 * Checks the product name for CAV LUX or CAPI LUX.
 *
 * @param dossier The dossier record
 * @returns true if the dossier is for CAV/CAPI management fees
 */
function isCavCapiProduct(dossier: Dossier): boolean {
  // This would require loading the produit details from the database
  // For now, we'll use a simple name check if available in dossier context
  // In a real implementation, you'd pass the produit_nom or check the produit_id
  return false // To be determined by caller based on actual product
}

/**
 * Finds the underlying commission rule for a CAV/CAPI dossier.
 * This is used to distribute the remainder after PEV and Cabinet deductions.
 *
 * @param consultant The consultant
 * @param dossier The dossier
 * @returns The underlying CommissionRule (Rules 1-8)
 */
function findUnderlyingRule(consultant: Consultant, dossier: Dossier): CommissionRule {
  // For CAV/CAPI products, find which of Rules 1-8 applies
  // This is typically based on how the client was sourced
  // Default to the consultant's standard rule
  return determineRule(consultant, dossier)
}

/**
 * Helper function to check if a dossier's product is CAV/CAPI.
 * To be used with actual product name from the database.
 *
 * @param productName The name of the product (e.g., "CAV LUX", "CAPI LUX")
 * @returns true if the product is a management fee product
 */
export function isManagementFeeProduct(productName: string): boolean {
  if (!productName) return false
  const normalized = productName.toUpperCase()
  return normalized === 'CAV LUX' || normalized === 'CAPI LUX'
}

/**
 * Calculate commission with full context, including product type detection.
 * This is the main entry point for calculating commissions.
 *
 * @param consultant The consultant
 * @param dossier The dossier
 * @param commissionRate The commission rate
 * @param encaissement_amount The actual payment received
 * @param productName Optional: the product name for CAV/CAPI detection
 * @returns CommissionCalculationResult
 */
export function calculateCommissionFull(
  consultant: Consultant,
  dossier: Dossier,
  commissionRate: number,
  encaissement_amount: number,
  productName?: string,
): CommissionCalculationResult {
  // Determine if CAV/CAPI and apply Rule 9 logic
  const isCavCapi = productName ? isManagementFeeProduct(productName) : false

  const appliedRule = determineRule(consultant, dossier)

  // Calculate gross commission
  const commission_brute = encaissement_amount * commissionRate

  let distributableAmount = commission_brute
  let pevDeduction = 0
  let cabinetDeduction = 0

  if (isCavCapi) {
    // Rule 9: CAV/CAPI Management Fees
    pevDeduction = commission_brute * 0.25 // 25% for PEV
    cabinetDeduction = commission_brute * 0.3 // 30% for Cabinet
    distributableAmount = commission_brute - pevDeduction - cabinetDeduction
  }

  // Apply the rule's split
  const breakdown = applySplit(appliedRule, distributableAmount, consultant.nom)

  // For CAV/CAPI, add cabinet deduction to cabinet's part
  if (isCavCapi) {
    breakdown.part_cabinet += cabinetDeduction
  }

  const result: CommissionCalculationResult = {
    ...breakdown,
    total: breakdown.part_consultant +
      breakdown.part_pool_plus +
      breakdown.part_thelo +
      breakdown.part_maxine +
      breakdown.part_stephane +
      breakdown.part_cabinet,
    rule_id: appliedRule.id,
    rule_name: appliedRule.name,
    encaissement_amount,
    commission_rate: commissionRate,
    commission_brute,
    has_cav_capi_deduction: isCavCapi,
    pev_deduction: pevDeduction,
    cabinet_deduction: cabinetDeduction,
  }

  return result
}
