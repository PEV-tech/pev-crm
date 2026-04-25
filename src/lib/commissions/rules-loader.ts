/**
 * rules-loader.ts — Charge les règles de split commission depuis Supabase.
 *
 * 2026-04-25 — Sortie progressive de `COMMISSION_RULES` hard-codées dans
 * `rules.ts` vers la table `commission_split_rules` éditable par les
 * managers depuis Paramètres.
 *
 * Stratégie :
 *   1. Au premier appel, fetch toutes les règles + cache mémoire (TTL léger).
 *   2. Si la DB est down ou répond avec une erreur, fallback sur
 *      `COMMISSION_RULES` (constantes statiques) → fail-safe.
 *   3. Le moteur de commission (engine.ts, encours/allocation.ts) utilise
 *      les règles renvoyées ici. Les règles snapshotées dans
 *      `encaissements_rem` et `commissions` lors des validations passées
 *      restent figées (immutable by design).
 */

import { createClient } from '@/lib/supabase/client'
import {
  COMMISSION_RULES as STATIC_COMMISSION_RULES,
  type CommissionRule,
  type CommissionSplit,
} from './rules'

/**
 * Mapping rule_key (DB) → id numérique (legacy COMMISSION_RULES).
 * Permet de reconstruire un tableau ordonné identique à l'ancien array.
 */
const RULE_KEY_TO_ID: Record<string, number> = {
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

const ID_TO_RULE_KEY: Record<number, string> = Object.fromEntries(
  Object.entries(RULE_KEY_TO_ID).map(([k, v]) => [v, k]),
)

interface DbCommissionRule {
  id: string
  rule_key: string
  name: string
  description: string | null
  part_consultant: number
  part_pool_plus: number
  part_thelo: number
  part_maxine: number
  part_stephane: number
  part_cabinet: number
  sort_order: number
}

/**
 * Convert a DB row to the legacy CommissionRule shape consumed by engine.ts.
 */
function dbRowToCommissionRule(row: DbCommissionRule): CommissionRule {
  const split: CommissionSplit = {
    part_consultant: Number(row.part_consultant),
    part_pool_plus: Number(row.part_pool_plus),
    part_thelo: Number(row.part_thelo),
    part_maxine: Number(row.part_maxine),
    part_stephane: Number(row.part_stephane),
    part_cabinet: Number(row.part_cabinet),
  }
  return {
    id: RULE_KEY_TO_ID[row.rule_key] ?? row.sort_order,
    name: row.name,
    description: row.description ?? '',
    split,
  }
}

// ─── Cache mémoire ────────────────────────────────────────────────────────────
let cachedRules: CommissionRule[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60_000 // 1 minute — suffisant : modifs managers manuelles

function isCacheFresh(): boolean {
  return cachedRules !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS
}

/**
 * Force le rechargement au prochain appel (à utiliser après une UPDATE
 * depuis l'UI Paramètres).
 */
export function invalidateCommissionRulesCache(): void {
  cachedRules = null
  cacheTimestamp = 0
}

/**
 * Charge les 9 règles de commission depuis Supabase.
 * Fail-safe : si erreur, retourne le tableau statique de fallback.
 *
 * Usage :
 *   const rules = await loadCommissionRules()
 *   const rule = determineRuleFromArray(consultant, dossier, rules)
 */
export async function loadCommissionRules(): Promise<CommissionRule[]> {
  if (isCacheFresh()) return cachedRules!

  try {
    const supabase = createClient()
    // `as never` car la table commission_split_rules n'est pas encore dans
    // le générateur de types Supabase (régénérer après apply de la migration).
    const { data, error } = await supabase
      .from('commission_split_rules' as never)
      .select('*')
      .order('sort_order', { ascending: true })

    if (error || !data || (data as unknown[]).length === 0) {
      // DB inaccessible ou vide → fallback constantes
      // eslint-disable-next-line no-console
      console.warn('[rules-loader] fallback to static COMMISSION_RULES', { error })
      return STATIC_COMMISSION_RULES
    }

    const rules = (data as unknown as DbCommissionRule[]).map(dbRowToCommissionRule)
    cachedRules = rules
    cacheTimestamp = Date.now()
    return rules
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[rules-loader] exception, fallback to static rules', e)
    return STATIC_COMMISSION_RULES
  }
}

/**
 * Variante synchrone : retourne le cache courant ou les constantes statiques
 * si rien n'est chargé. À utiliser dans les call sites qui ne peuvent pas
 * être async (ex. composants synchrones). Préférer `loadCommissionRules()`
 * dès que possible.
 */
export function getCommissionRulesSync(): CommissionRule[] {
  return isCacheFresh() ? cachedRules! : STATIC_COMMISSION_RULES
}

/**
 * Helper : retrouve une règle par son rule_key (utilisé par determineRule
 * pour faire le match scénario → règle indépendamment de l'ordre du tableau).
 */
export function findRuleByKey(rules: CommissionRule[], ruleKey: string): CommissionRule | null {
  const id = RULE_KEY_TO_ID[ruleKey]
  if (id === undefined) return null
  return rules.find((r) => r.id === id) ?? null
}

export { ID_TO_RULE_KEY, RULE_KEY_TO_ID }
