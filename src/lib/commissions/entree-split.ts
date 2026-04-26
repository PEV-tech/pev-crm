/**
 * entree-split.ts — Calcul des splits commission entrée d'un dossier.
 *
 * 2026-04-25 (V4) — Pendant logique de `src/lib/encours/allocation.ts`
 * pour les commissions ENCOURS, mais côté commission ENTRÉE (la
 * commission calculée à la création/finalisation d'un dossier).
 *
 * Avant V4, le calcul était figé en code dans
 * `dossier-detail-wrapper.tsx` :
 *   rem_apporteur = commissionNette × consultantTauxRemuneration
 *   part_cabinet = commissionNette - rem_apporteur
 * Soit 2 splits seulement (consultant / cabinet), le pot pool/thélo/
 * maxine/stéphane n'était pas distribué.
 *
 * Désormais on utilise la grille `commission_split_rules` (DB,
 * éditable managers depuis Paramètres → Rémunération → Splits) pour
 * répartir équitablement le brut entre les 6 bénéficiaires.
 *
 * Snapshot : on stocke `applied_rule_key` + `applied_split_snapshot`
 * sur la commission afin que le calcul reste figé même si la grille
 * évolue ultérieurement.
 */

import type { Consultant, Dossier } from '@/types/database'
import {
  determineRuleFromArray, type CommissionRule, type CommissionSplit,
} from './rules'

const round2 = (n: number): number => Math.round(n * 100) / 100

export interface CommissionEntreeSplits {
  /** Part consultant en EUR (= rem_apporteur, doublonné pour homogénéité). */
  part_consultant: number
  part_pool_plus: number
  part_thelo: number
  part_maxine: number
  part_stephane: number
  part_cabinet: number
  /** Pour rétro-compat — alias de part_consultant. */
  rem_apporteur: number
  /** rule_key utilisé (chasse_thelo, tier_65, etc.) — figé en commission. */
  applied_rule_key: string
  /** Snapshot JSON du split appliqué — traçabilité ACPR si la grille évolue. */
  applied_split_snapshot: {
    rule_id: number
    rule_name: string
    split: CommissionSplit
  }
}

const RULE_ID_TO_KEY: Record<number, string> = {
  1: 'chasse_thelo',
  2: 'chasse_maxine',
  3: 'pool',
  4: 'stephane_entree',
  5: 'stephane_france',
  6: 'tier_65',
  7: 'tier_50',
  8: 'tier_30',
  9: 'encours',
}

/**
 * Calcule les 6 parts (en EUR) d'une commission entrée.
 *
 * @param consultant Le consultant rattaché au dossier (id, prenom, nom,
 *                   taux_remuneration, role…).
 * @param dossier Le dossier (apporteur_label, etc.) — utilisé pour le
 *                matching scénario via determineRuleFromArray.
 * @param commissionNette Le montant net à distribuer (commission_brute
 *                        - rem_apporteur_ext).
 * @param rules Le tableau de règles (typiquement chargé depuis
 *              `commission_split_rules` via loadCommissionRules()).
 * @returns Les 6 parts arrondies à 2 décimales + le snapshot du rule_key
 *          et du split appliqué.
 */
export function computeCommissionEntreeSplits(
  consultant: Pick<Consultant, 'prenom' | 'nom' | 'taux_remuneration'> & Partial<Consultant>,
  dossier: Pick<Dossier, 'apporteur_label'> & Partial<Dossier>,
  commissionNette: number,
  rules: CommissionRule[],
): CommissionEntreeSplits {
  // Cast vers Consultant / Dossier — determineRuleFromArray n'utilise que
  // prenom, nom, taux_remuneration côté consultant et apporteur_label
  // côté dossier. Les autres champs ne sont pas requis.
  const rule = determineRuleFromArray(
    consultant as Consultant,
    dossier as Dossier,
    rules,
  )

  const split = rule.split
  const partConsultant = round2(commissionNette * (split.part_consultant / 100))
  const partPoolPlus   = round2(commissionNette * (split.part_pool_plus  / 100))
  const partThelo      = round2(commissionNette * (split.part_thelo      / 100))
  const partMaxine     = round2(commissionNette * (split.part_maxine     / 100))
  const partStephane   = round2(commissionNette * (split.part_stephane   / 100))
  const partCabinet    = round2(commissionNette * (split.part_cabinet    / 100))

  return {
    part_consultant: partConsultant,
    part_pool_plus: partPoolPlus,
    part_thelo: partThelo,
    part_maxine: partMaxine,
    part_stephane: partStephane,
    part_cabinet: partCabinet,
    // rem_apporteur conservé pour rétro-compat avec les UIs existantes
    // qui lisent `rem_apporteur` directement (rémunérations, dashboards,
    // commission-grille, etc.).
    rem_apporteur: partConsultant,
    applied_rule_key: RULE_ID_TO_KEY[rule.id] ?? `rule_${rule.id}`,
    applied_split_snapshot: {
      rule_id: rule.id,
      rule_name: rule.name,
      split,
    },
  }
}
