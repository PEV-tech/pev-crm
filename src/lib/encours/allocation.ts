import type { Consultant, Dossier } from '@/types/database'
import {
  COMMISSION_RULES, determineRuleFromArray,
  type CommissionRule, type CommissionSplit,
} from '@/lib/commissions/rules'
import {
  buildConsultantSnapshot, buildDossierSnapshot, buildRuleSnapshot,
  resolvePrededuction, round2,
  type ConsultantSnapshot, type DossierSnapshot, type RuleSnapshot,
} from './snapshots'

export interface AllocationTarget { consultant: Consultant; split_pct: number }

export interface AllocateLineInput {
  line: { id: string; type_commission: 'entree' | 'encours'; montant_brut_percu: number }
  dossier: Dossier
  targets: AllocationTarget[]
  dossierEnrichment?: Partial<Omit<DossierSnapshot, 'dossier_id'>>
  rem_apporteur_ext_montant?: number
  rem_apporteur_interne_montant?: number
  /**
   * Tableau de règles à utiliser pour le calcul. Si non fourni, fallback
   * sur les COMMISSION_RULES statiques (legacy). Recommandé : passer le
   * résultat de `loadCommissionRules()` pour que les éditions managers
   * en Paramètres prennent effet.
   */
  rules?: CommissionRule[]
}

export interface EncaissementAllocationDraft {
  encaissement_line_id: string
  split_pct: number
  consultant_id: string | null
  apporteur_id: string | null
  applied_rule_id: number
  applied_rule_name: string
  applied_split_snapshot: RuleSnapshot
  consultant_snapshot: ConsultantSnapshot
  dossier_snapshot: DossierSnapshot
  taux_remuneration_snapshot: number | null
  taux_apporteur_ext_snapshot: number | null
  taux_pev_gestion_snapshot: number
  taux_cabinet_prededuction_snapshot: number
  commission_brute_snapshot: number
  rem_apporteur_interne_montant: number
  rem_apporteur_ext_montant: number
  part_pev_gestion_montant: number
  part_cabinet_prededuction_montant: number
  commission_nette_snapshot: number
  part_consultant_montant: number
  part_pool_plus_montant: number
  part_thelo_montant: number
  part_maxine_montant: number
  part_stephane_montant: number
  part_cabinet_montant: number
}

interface SplitAmounts {
  part_consultant: number; part_pool_plus: number; part_thelo: number
  part_maxine: number; part_stephane: number; part_cabinet: number
}

// 2026-04-25 — Refactor : applique directement les pourcentages issus de
// `rule.split` (DB-backed via loadCommissionRules() ou fallback statique
// de COMMISSION_RULES). Plus de hardcoding — éditer les valeurs en DB
// dans Paramètres → Rémunération → Splits change immédiatement les
// allocations futures.
//
// Garanti par le seed initial : les valeurs DB matchent les anciens
// pourcentages hardcodés à l'arrondi près (sum ≈ 100 sauf rule 9
// "encours" qui reste à 0 — déterminé dynamiquement par dossier).
function applyRuleSplit(rule: CommissionRule, amount: number): SplitAmounts {
  const s: CommissionSplit = rule.split
  return {
    part_consultant: amount * (s.part_consultant / 100),
    part_pool_plus: amount * (s.part_pool_plus / 100),
    part_thelo: amount * (s.part_thelo / 100),
    part_maxine: amount * (s.part_maxine / 100),
    part_stephane: amount * (s.part_stephane / 100),
    part_cabinet: amount * (s.part_cabinet / 100),
  }
}

export function allocateLine(input: AllocateLineInput): EncaissementAllocationDraft[] {
  const { line, dossier, targets, dossierEnrichment, rules } = input
  // Tableau de règles effectif : DB-loaded (préféré) ou fallback statique.
  const activeRules = rules && rules.length > 0 ? rules : COMMISSION_RULES
  if (targets.length === 0) throw new Error(`allocateLine: aucun target pour la ligne ${line.id}`)
  const sumPct = targets.reduce((s, t) => s + t.split_pct, 0)
  if (sumPct < 0.9999 || sumPct > 1.0001) {
    throw new Error(`allocateLine: SUM(split_pct) = ${sumPct} != 1 pour la ligne ${line.id}`)
  }

  const brut = line.montant_brut_percu
  const { taux_pev_gestion, taux_cabinet_prededuction } = resolvePrededuction({
    produitNom: dossierEnrichment?.produit_nom ?? null,
    produitCategorie: dossierEnrichment?.produit_categorie ?? null,
    typeCommission: line.type_commission,
  })

  const remApporteurInterne = round2(input.rem_apporteur_interne_montant ?? 0)
  const remApporteurExt = round2(input.rem_apporteur_ext_montant ?? 0)
  const pvGestion = round2(brut * taux_pev_gestion)
  const cabinetPrededuc = round2(brut * taux_cabinet_prededuction)
  const distribuable = Math.max(0, brut - remApporteurInterne - remApporteurExt - pvGestion - cabinetPrededuc)

  const dossierSnap = buildDossierSnapshot(dossier, dossierEnrichment)

  // 2026-04-26 — compagnie + produit propagés pour le matching SG/ABF/TRILAKE
  // (voir rules.ts::determineRuleKey). Source : dossierEnrichment, sinon
  // fallback sur les champs du dossier.
  const compagnieNomForRule =
    dossierEnrichment?.compagnie_nom ?? (dossier as unknown as { compagnie_nom?: string | null }).compagnie_nom ?? null
  const produitNomForRule =
    dossierEnrichment?.produit_nom ?? (dossier as unknown as { produit_nom?: string | null }).produit_nom ?? null

  return targets.map((target) => {
    const rule = determineRuleFromArray(target.consultant, dossier, activeRules, compagnieNomForRule, produitNomForRule)
    const ruleSnap = buildRuleSnapshot(rule)
    const consultantSnap = buildConsultantSnapshot(target.consultant)

    const distribuableForTarget = distribuable * target.split_pct
    const split = applyRuleSplit(rule, distribuableForTarget)

    const apporteurInterneTarget = round2(remApporteurInterne * target.split_pct)
    const apporteurExtTarget = round2(remApporteurExt * target.split_pct)
    const pvGestionTarget = round2(pvGestion * target.split_pct)
    const cabinetPrededucTarget = round2(cabinetPrededuc * target.split_pct)

    return {
      encaissement_line_id: line.id,
      split_pct: target.split_pct,
      consultant_id: target.consultant.id ?? null,
      apporteur_id: dossier.apporteur_id ?? null,
      applied_rule_id: rule.id,
      applied_rule_name: rule.name,
      applied_split_snapshot: ruleSnap,
      consultant_snapshot: consultantSnap,
      dossier_snapshot: dossierSnap,
      taux_remuneration_snapshot: (target.consultant as { taux_remuneration?: number | null }).taux_remuneration ?? null,
      taux_apporteur_ext_snapshot: (dossier as { taux_apporteur_ext?: number | null }).taux_apporteur_ext ?? null,
      taux_pev_gestion_snapshot: taux_pev_gestion,
      taux_cabinet_prededuction_snapshot: taux_cabinet_prededuction,
      commission_brute_snapshot: round2(brut * target.split_pct),
      rem_apporteur_interne_montant: apporteurInterneTarget,
      rem_apporteur_ext_montant: apporteurExtTarget,
      part_pev_gestion_montant: pvGestionTarget,
      part_cabinet_prededuction_montant: cabinetPrededucTarget,
      commission_nette_snapshot: round2(distribuableForTarget),
      part_consultant_montant: round2(split.part_consultant),
      part_pool_plus_montant: round2(split.part_pool_plus),
      part_thelo_montant: round2(split.part_thelo),
      part_maxine_montant: round2(split.part_maxine),
      part_stephane_montant: round2(split.part_stephane),
      part_cabinet_montant: round2(split.part_cabinet),
    }
  })
}

export interface AllocationSummary {
  total_brut: number
  total_apporteur_interne: number
  total_apporteur_ext: number
  total_pev_gestion: number
  total_cabinet_prededuction: number
  total_consultant: number
  total_pool_plus: number
  total_thelo: number
  total_maxine: number
  total_stephane: number
  total_cabinet_post_rule: number
  total_reconstitue: number
}

export function summarizeAllocations(drafts: EncaissementAllocationDraft[]): AllocationSummary {
  const sum = (pick: (d: EncaissementAllocationDraft) => number) =>
    round2(drafts.reduce((s, d) => s + pick(d), 0))

  const summary: AllocationSummary = {
    total_brut: sum((d) => d.commission_brute_snapshot),
    total_apporteur_interne: sum((d) => d.rem_apporteur_interne_montant),
    total_apporteur_ext: sum((d) => d.rem_apporteur_ext_montant),
    total_pev_gestion: sum((d) => d.part_pev_gestion_montant),
    total_cabinet_prededuction: sum((d) => d.part_cabinet_prededuction_montant),
    total_consultant: sum((d) => d.part_consultant_montant),
    total_pool_plus: sum((d) => d.part_pool_plus_montant),
    total_thelo: sum((d) => d.part_thelo_montant),
    total_maxine: sum((d) => d.part_maxine_montant),
    total_stephane: sum((d) => d.part_stephane_montant),
    total_cabinet_post_rule: sum((d) => d.part_cabinet_montant),
    total_reconstitue: 0,
  }
  summary.total_reconstitue = round2(
    summary.total_apporteur_interne + summary.total_apporteur_ext +
    summary.total_pev_gestion + summary.total_cabinet_prededuction +
    summary.total_consultant + summary.total_pool_plus +
    summary.total_thelo + summary.total_maxine +
    summary.total_stephane + summary.total_cabinet_post_rule,
  )
  return summary
}

export { COMMISSION_RULES }
