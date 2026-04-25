import type { CommissionRule, CommissionSplit } from '@/lib/commissions/rules'
import type { Consultant, Dossier } from '@/types/database'

export const TAUX_PEV_GESTION_CAV_CAPI = 0.25 as const
export const TAUX_CABINET_PREDEDUCTION_CAV_CAPI = 0.3 as const

export interface RuleSnapshot {
  rule_id: number
  rule_name: string
  rule_description: string
  split: CommissionSplit
  snapshot_taken_at: string
}

export interface ConsultantSnapshot {
  consultant_id: string | null
  prenom: string | null
  nom: string | null
  role: string | null
  taux_remuneration: number | null
}

export interface DossierSnapshot {
  dossier_id: string
  client_id: string | null
  client_nom: string | null
  client_prenom: string | null
  client_pays: string | null
  produit_id: string | null
  produit_nom: string | null
  produit_categorie: string | null
  compagnie_id: string | null
  compagnie_nom: string | null
  apporteur_id: string | null
  apporteur_ext_nom: string | null
  taux_apporteur_ext: number | null
}

export function buildRuleSnapshot(rule: CommissionRule): RuleSnapshot {
  return {
    rule_id: rule.id,
    rule_name: rule.name,
    rule_description: rule.description,
    split: { ...rule.split },
    snapshot_taken_at: new Date().toISOString(),
  }
}

export function buildConsultantSnapshot(consultant: Consultant | null | undefined): ConsultantSnapshot {
  if (!consultant) return { consultant_id: null, prenom: null, nom: null, role: null, taux_remuneration: null }
  return {
    consultant_id: consultant.id,
    prenom: consultant.prenom ?? null,
    nom: consultant.nom ?? null,
    role: (consultant as { role?: string | null }).role ?? null,
    taux_remuneration: (consultant as { taux_remuneration?: number | null }).taux_remuneration ?? null,
  }
}

export function buildDossierSnapshot(
  dossier: Dossier,
  enrichment: Partial<Omit<DossierSnapshot, 'dossier_id'>> = {},
): DossierSnapshot {
  return {
    dossier_id: dossier.id,
    client_id: dossier.client_id ?? null,
    client_nom: enrichment.client_nom ?? null,
    client_prenom: enrichment.client_prenom ?? null,
    client_pays: enrichment.client_pays ?? null,
    produit_id: dossier.produit_id ?? null,
    produit_nom: enrichment.produit_nom ?? null,
    produit_categorie: enrichment.produit_categorie ?? null,
    compagnie_id: dossier.compagnie_id ?? null,
    compagnie_nom: enrichment.compagnie_nom ?? null,
    apporteur_id: dossier.apporteur_id ?? null,
    apporteur_ext_nom: dossier.apporteur_ext_nom ?? null,
    taux_apporteur_ext: (dossier as { taux_apporteur_ext?: number | null }).taux_apporteur_ext ?? null,
  }
}

export function isEncoursCavCapi(input: {
  produitNom?: string | null
  produitCategorie?: string | null
  typeCommission?: 'entree' | 'encours' | null
}): boolean {
  if (input.typeCommission !== 'encours') return false
  const nom = (input.produitNom ?? '').toUpperCase().trim()
  const categorie = (input.produitCategorie ?? '').toUpperCase().trim()
  if (/\b(CAV|CAPI)\b/.test(nom)) return true
  if (['LUX', 'CAV', 'CAPI_LUX', 'CAV_CAPI', 'CAV/CAPI'].includes(categorie)) return true
  return false
}

export function resolvePrededuction(input: {
  produitNom?: string | null
  produitCategorie?: string | null
  typeCommission?: 'entree' | 'encours' | null
}): { taux_pev_gestion: number; taux_cabinet_prededuction: number } {
  if (!isEncoursCavCapi(input)) return { taux_pev_gestion: 0, taux_cabinet_prededuction: 0 }
  return { taux_pev_gestion: TAUX_PEV_GESTION_CAV_CAPI, taux_cabinet_prededuction: TAUX_CABINET_PREDEDUCTION_CAV_CAPI }
}

export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100
}
