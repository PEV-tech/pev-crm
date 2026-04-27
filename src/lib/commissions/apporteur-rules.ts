/**
 * apporteur-rules.ts — Calcul de la rémunération apporteur d'affaires V2.
 *
 * 2026-04-27 — Logique pure (no I/O) qui calcule la part apporteur d'un
 * dossier en fonction des règles produit-aware stockées dans la table
 * `apporteur_compensation_rules`.
 *
 * Avant V2 : `apporteurs.taux_commission` était un scalaire unique appliqué
 * à plat sur le montant. Yoann Pouliquen a une grille à 3 dimensions :
 *   - 1 % du montant SCPI souscrit
 *   - 25 % des frais d'entrée PE
 *   - 6 mois d'encours one-shot sur les contrats CAV/CAPI (LUX inclus)
 *
 * Le modèle V2 stocke 1 ligne par (apporteur, catégorie produit) avec un
 * `rule_type` qui détermine la formule :
 *
 *   | rule_type                 | Assiette                                    | Paramètre        |
 *   |---------------------------|---------------------------------------------|------------------|
 *   | entry_pct_montant         | dossier.montant                             | rate_pct (%)     |
 *   | entry_pct_frais           | dossier.montant × frais_entree_catalogue    | rate_pct (%)     |
 *   | encours_oneshot_months    | dossier.montant × frais_encours_catalogue   | encours_months   |
 *                                                          × N (périodicité)
 *
 * où N = encours_months si compagnie.encours_periodicite = 'mensuel',
 *        round(encours_months / 3) si 'trimestriel'.
 *
 * Rétro-compat : si aucune règle V2 ne correspond à la catégorie du dossier
 * mais que `apporteurs.taux_commission` est défini, on retombe sur le calcul
 * V1 (taux flat × montant) — comportement inchangé pour les apporteurs
 * historiques sans règles produit.
 *
 * Cette fonction est PURE — elle ne lit pas la DB. Le caller doit fournir
 * les règles, le taux catalogue et la compagnie déjà chargés.
 */

import type {
  Apporteur,
  ApporteurCompensationRule,
  Compagnie,
  Dossier,
  TauxProduitCompagnie,
} from '@/types/database'
import { normalizeCategorieForDefaults } from './default-grilles'

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Décomposition de la rémunération apporteur pour un dossier.
 * Tous les montants sont en EUR, arrondis à 2 décimales.
 */
export interface ApporteurFeeBreakdown {
  /** Part apporteur sur frais d'entrée (entry_pct_montant ou entry_pct_frais). */
  entry: number
  /** Part apporteur one-shot sur N mois d'encours (encours_oneshot_months). */
  encoursOneshot: number
  /** Somme = entry + encoursOneshot. Stocké dans commissions.rem_apporteur_ext. */
  total: number
  /** Trace de la règle effectivement appliquée (audit / debug). */
  appliedRule:
    | {
        source: 'rule_v2'
        ruleType: ApporteurCompensationRule['rule_type']
        productCategory: string
        ratePct?: number
        encoursMonths?: number
        periodicite?: 'mensuel' | 'trimestriel'
      }
    | { source: 'fallback_v1'; tauxCommission: number }
    | { source: 'no_apporteur' | 'no_match' }
}

const ZERO_FEE = (
  source: Extract<
    ApporteurFeeBreakdown['appliedRule'],
    { source: 'no_apporteur' | 'no_match' }
  >['source'],
): ApporteurFeeBreakdown => ({
  entry: 0,
  encoursOneshot: 0,
  total: 0,
  appliedRule: { source },
})

/**
 * Calcule les `N_periods` à appliquer sur l'encours one-shot selon la
 * périodicité de la compagnie.
 *
 * Exemples (encours_months = 6) :
 *   mensuel     → 6 paiements (1 par mois)
 *   trimestriel → 2 paiements (1 par trimestre)
 *
 * Si la périodicité est nulle ou inconnue, on prend trimestriel (default DB).
 */
export function periodsForEncoursOneshot(
  encoursMonths: number,
  periodicite: 'mensuel' | 'trimestriel' | null | undefined,
): number {
  if (encoursMonths <= 0) return 0
  if (periodicite === 'mensuel') return encoursMonths
  // trimestriel (défaut) : 1 paiement tous les 3 mois
  return Math.round(encoursMonths / 3)
}

/**
 * Calcule la rémunération apporteur pour un dossier donné.
 *
 * @param args.apporteur     Apporteur attaché au dossier (id + taux_commission V1
 *                           pour fallback). null si pas d'apporteur.
 * @param args.rules         Règles V2 actives pour cet apporteur (typiquement
 *                           chargées via SELECT WHERE apporteur_id = X AND active).
 *                           Tableau vide → fallback V1.
 * @param args.dossier       Dossier (montant + produit_categorie).
 * @param args.taux          Ligne `taux_produit_compagnie` correspondant au
 *                           couple compagnie × produit du dossier (frais_entree
 *                           et frais_encours en %). null = 0 partout.
 * @param args.compagnie     Compagnie du dossier (pour encours_periodicite).
 *                           null = trimestriel (default).
 *
 * @returns Décomposition entry / encoursOneshot / total + trace de la règle
 *          appliquée. Tous les montants sont en EUR arrondis 2 décimales.
 *
 * @example
 *   // Yoann SCPI 300k
 *   computeApporteurFee({
 *     apporteur: yoann,
 *     rules: [{ rule_type: 'entry_pct_montant', product_category: 'SCPI',
 *               rate_pct: 1, ... }],
 *     dossier: { montant: 300_000, produit_categorie: 'SCPI' },
 *     taux: { frais_entree: 0.06, frais_encours: 0 },
 *     compagnie: { encours_periodicite: 'trimestriel' },
 *   })
 *   // → { entry: 3000, encoursOneshot: 0, total: 3000, appliedRule: {...} }
 */
export function computeApporteurFee(args: {
  apporteur: Pick<Apporteur, 'id' | 'taux_commission'> | null
  rules: ApporteurCompensationRule[]
  dossier: Pick<Dossier, 'montant'> & { produit_categorie: string | null }
  taux: Pick<TauxProduitCompagnie, 'frais_entree' | 'frais_encours'> | null
  compagnie: Pick<Compagnie, 'encours_periodicite'> | null
}): ApporteurFeeBreakdown {
  const { apporteur, rules, dossier, taux, compagnie } = args

  if (!apporteur) return ZERO_FEE('no_apporteur')

  const montant = Number(dossier.montant ?? 0)
  if (!montant) return ZERO_FEE('no_match')

  // 1. Tenter le matching V2 sur la catégorie produit normalisée
  const category = normalizeCategorieForDefaults(dossier.produit_categorie)
  const matchingRule = category
    ? rules.find(
        (r) => r.active && r.product_category === category && r.apporteur_id === apporteur.id,
      )
    : null

  if (matchingRule) {
    return applyRuleV2({
      rule: matchingRule,
      montant,
      taux,
      compagnie,
    })
  }

  // 2. Fallback V1 : taux_commission scalaire sur le montant (statu quo)
  const tauxV1 = Number(apporteur.taux_commission ?? 0)
  if (tauxV1 > 0) {
    const entry = round2(montant * tauxV1)
    return {
      entry,
      encoursOneshot: 0,
      total: entry,
      appliedRule: { source: 'fallback_v1', tauxCommission: tauxV1 },
    }
  }

  // 3. Pas de règle, pas de taux V1
  return ZERO_FEE('no_match')
}

function applyRuleV2(args: {
  rule: ApporteurCompensationRule
  montant: number
  taux: Pick<TauxProduitCompagnie, 'frais_entree' | 'frais_encours'> | null
  compagnie: Pick<Compagnie, 'encours_periodicite'> | null
}): ApporteurFeeBreakdown {
  const { rule, montant, taux, compagnie } = args

  switch (rule.rule_type) {
    case 'entry_pct_montant': {
      const ratePct = Number(rule.rate_pct ?? 0)
      const entry = round2(montant * (ratePct / 100))
      return {
        entry,
        encoursOneshot: 0,
        total: entry,
        appliedRule: {
          source: 'rule_v2',
          ruleType: 'entry_pct_montant',
          productCategory: rule.product_category,
          ratePct,
        },
      }
    }
    case 'entry_pct_frais': {
      const fraisEntree = Number(taux?.frais_entree ?? 0)
      const ratePct = Number(rule.rate_pct ?? 0)
      const entry = round2(montant * fraisEntree * (ratePct / 100))
      return {
        entry,
        encoursOneshot: 0,
        total: entry,
        appliedRule: {
          source: 'rule_v2',
          ruleType: 'entry_pct_frais',
          productCategory: rule.product_category,
          ratePct,
        },
      }
    }
    case 'encours_oneshot_months': {
      const fraisEncours = Number(taux?.frais_encours ?? 0)
      const months = Number(rule.encours_months ?? 0)
      const periodicite =
        (compagnie?.encours_periodicite as 'mensuel' | 'trimestriel' | null) ?? 'trimestriel'
      const periods = periodsForEncoursOneshot(months, periodicite)
      const encoursOneshot = round2(montant * fraisEncours * periods)
      return {
        entry: 0,
        encoursOneshot,
        total: encoursOneshot,
        appliedRule: {
          source: 'rule_v2',
          ruleType: 'encours_oneshot_months',
          productCategory: rule.product_category,
          encoursMonths: months,
          periodicite,
        },
      }
    }
    default: {
      // rule_type non reconnu (ne devrait pas arriver vu le CHECK constraint)
      return {
        entry: 0,
        encoursOneshot: 0,
        total: 0,
        appliedRule: { source: 'no_match' },
      }
    }
  }
}
