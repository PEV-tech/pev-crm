import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  allocateLine, summarizeAllocations,
  type EncaissementAllocationDraft, type AllocationTarget, type AllocationSummary,
} from './allocation'
import { COMMISSION_RULES, type CommissionRule } from '@/lib/commissions/rules'

// 2026-04-25 — Loader des règles de split (DB → fallback statique).
async function loadRulesForValidation(supabase: SB): Promise<CommissionRule[]> {
  try {
    const { data, error } = await supabase
      .from('commission_split_rules' as never)
      .select('*')
      .order('sort_order', { ascending: true })
    if (error || !data || (data as unknown[]).length === 0) return COMMISSION_RULES
    const ruleKeyToId: Record<string, number> = {
      chasse_thelo: 1, chasse_maxine: 2, pool: 3,
      stephane_entree: 4, stephane_france: 5,
      tier_65: 6, tier_50: 7, tier_30: 8, encours: 9,
    }
    return (data as unknown as Array<Record<string, unknown>>).map((row) => ({
      id: ruleKeyToId[row.rule_key as string] ?? Number(row.sort_order),
      name: String(row.name),
      description: String(row.description ?? ''),
      split: {
        part_consultant: Number(row.part_consultant),
        part_pool_plus: Number(row.part_pool_plus),
        part_thelo: Number(row.part_thelo),
        part_maxine: Number(row.part_maxine),
        part_stephane: Number(row.part_stephane),
        part_cabinet: Number(row.part_cabinet),
      },
    }))
  } catch {
    return COMMISSION_RULES
  }
}

export interface ValidateBatchInput {
  batchId: string
  validatedByConsultantId?: string | null
  allowUnreconciledLines?: boolean
}

export interface LineValidationIssue {
  line_id: string
  severity: 'error' | 'warning'
  code: 'LINE_NOT_RECONCILED' | 'DOSSIER_NOT_FOUND' | 'CONSULTANT_NOT_FOUND' | 'INVALID_AMOUNT' | 'ALLOCATION_SUM_MISMATCH' | 'INSERT_FAILED'
  message: string
}

export interface ValidationResult {
  batch_id: string
  status: 'ok' | 'partial' | 'aborted'
  lines_processed: number
  lines_skipped: number
  allocations_inserted: number
  issues: LineValidationIssue[]
  summary: AllocationSummary | null
  errors: string[]
}

type SB = SupabaseClient<Database>

interface LineRow {
  id: string
  batch_id: string
  type_commission: 'entree' | 'encours'
  montant_brut_percu: number
  dossier_id: string | null
  statut_rapprochement: string
  produit_id: string | null
  compagnie_id: string | null
  client_id: string | null
}

interface DossierEnriched {
  id: string
  client_id: string | null
  consultant_id: string | null
  apporteur_id: string | null
  apporteur_ext_nom: string | null
  taux_apporteur_ext: number | null
  produit_id: string | null
  compagnie_id: string | null
  co_titulaire_id: string | null
  client_nom: string | null
  client_prenom: string | null
  client_pays: string | null
  produit_nom: string | null
  produit_categorie: string | null
  compagnie_nom: string | null
  consultant_prenom: string | null
  consultant_nom: string | null
  taux_remuneration: number | null
}

export async function validateBatch(supabase: SB, input: ValidateBatchInput): Promise<ValidationResult> {
  const result: ValidationResult = {
    batch_id: input.batchId, status: 'ok',
    lines_processed: 0, lines_skipped: 0, allocations_inserted: 0,
    issues: [], summary: null, errors: [],
  }

  const { data: batch, error: batchErr } = await supabase
    .from('encaissement_batches' as never)
    .select('id, statut, created_by').eq('id', input.batchId).maybeSingle()

  if (batchErr || !batch) {
    result.status = 'aborted'
    result.errors.push(`Lot introuvable : ${batchErr?.message ?? 'not found'}`)
    return result
  }

  const batchRow = batch as unknown as { id: string; statut: string; created_by: string | null }
  if (batchRow.statut !== 'brouillon') {
    result.status = 'aborted'
    result.errors.push(`Lot déjà en statut "${batchRow.statut}"`)
    return result
  }

  const { data: linesData, error: linesErr } = await supabase
    .from('encaissement_lines' as never)
    .select('id, batch_id, type_commission, montant_brut_percu, dossier_id, statut_rapprochement, produit_id, compagnie_id, client_id')
    .eq('batch_id' as never, input.batchId)

  if (linesErr || !linesData) {
    result.status = 'aborted'
    result.errors.push(`Chargement lignes : ${linesErr?.message ?? 'no data'}`)
    return result
  }

  const lines = linesData as unknown as LineRow[]
  if (lines.length === 0) {
    result.status = 'aborted'
    result.errors.push('Lot vide')
    return result
  }

  const unreconciled = lines.filter((l) => l.statut_rapprochement === 'non_rapproche')
  if (unreconciled.length > 0 && !input.allowUnreconciledLines) {
    result.status = 'aborted'
    result.errors.push(`${unreconciled.length} ligne(s) non rapprochée(s)`)
    unreconciled.forEach((l) => result.issues.push({
      line_id: l.id, severity: 'error', code: 'LINE_NOT_RECONCILED',
      message: 'Ligne non rapprochée à un dossier',
    }))
    return result
  }

  const dossierIds = Array.from(new Set(lines
    .filter((l) => l.dossier_id && l.statut_rapprochement !== 'non_rapproche')
    .map((l) => l.dossier_id as string)))

  const dossiersById = new Map<string, DossierEnriched>()
  if (dossierIds.length > 0) {
    const { data: dData, error: dErr } = await supabase
      .from('v_dossiers_complets')
      .select('id, client_id, consultant_id, apporteur_id, apporteur_ext_nom, taux_apporteur_ext, produit_id, compagnie_id, co_titulaire_id, client_nom, client_prenom, client_pays, produit_nom, produit_categorie, compagnie_nom, consultant_prenom, consultant_nom, taux_remuneration')
      .in('id', dossierIds)
    if (dErr || !dData) {
      result.status = 'aborted'
      result.errors.push(`Chargement dossiers : ${dErr?.message ?? 'no data'}`)
      return result
    }
    for (const d of dData as unknown as DossierEnriched[]) dossiersById.set(d.id, d)
  }

  const consultantIds = new Set<string>()
  for (const d of dossiersById.values()) if (d.consultant_id) consultantIds.add(d.consultant_id)

  const consultantsById = new Map<string, unknown>()
  if (consultantIds.size > 0) {
    const { data: cData, error: cErr } = await supabase
      .from('consultants')
      .select('id, prenom, nom, role, taux_remuneration, zone, actif, auth_user_id')
      .in('id', Array.from(consultantIds))
    if (cErr || !cData) {
      result.status = 'aborted'
      result.errors.push(`Chargement consultants : ${cErr?.message ?? 'no data'}`)
      return result
    }
    for (const c of cData as Array<{ id: string }>) consultantsById.set(c.id, c)
  }

  // Charge les règles de split (DB → fallback statique).
  const rules = await loadRulesForValidation(supabase)

  const allDrafts: EncaissementAllocationDraft[] = []

  for (const line of lines) {
    if (line.statut_rapprochement === 'non_rapproche') { result.lines_skipped += 1; continue }
    if (!line.dossier_id) { result.issues.push({ line_id: line.id, severity: 'error', code: 'DOSSIER_NOT_FOUND', message: 'dossier_id NULL' }); continue }
    const dossier = dossiersById.get(line.dossier_id)
    if (!dossier) { result.issues.push({ line_id: line.id, severity: 'error', code: 'DOSSIER_NOT_FOUND', message: `Dossier ${line.dossier_id} introuvable` }); continue }
    if (!dossier.consultant_id) { result.issues.push({ line_id: line.id, severity: 'error', code: 'CONSULTANT_NOT_FOUND', message: `Dossier sans consultant_id` }); continue }
    const consultant = consultantsById.get(dossier.consultant_id)
    if (!consultant) { result.issues.push({ line_id: line.id, severity: 'error', code: 'CONSULTANT_NOT_FOUND', message: `Consultant introuvable` }); continue }
    if (line.montant_brut_percu <= 0) {
      result.issues.push({ line_id: line.id, severity: 'warning', code: 'INVALID_AMOUNT', message: `Montant ${line.montant_brut_percu}` })
    }

    const remApporteurExt = dossier.taux_apporteur_ext && line.montant_brut_percu > 0
      ? line.montant_brut_percu * dossier.taux_apporteur_ext : 0

    const targets: AllocationTarget[] = [{
      consultant: consultant as Parameters<typeof allocateLine>[0]['targets'][number]['consultant'],
      split_pct: 1.0,
    }]

    try {
      const drafts = allocateLine({
        line: { id: line.id, type_commission: line.type_commission, montant_brut_percu: line.montant_brut_percu },
        dossier: dossier as unknown as Parameters<typeof allocateLine>[0]['dossier'],
        targets,
        dossierEnrichment: {
          client_nom: dossier.client_nom, client_prenom: dossier.client_prenom,
          client_pays: dossier.client_pays, produit_nom: dossier.produit_nom,
          produit_categorie: dossier.produit_categorie, compagnie_nom: dossier.compagnie_nom,
        },
        rem_apporteur_ext_montant: remApporteurExt,
        rem_apporteur_interne_montant: 0,
        rules,
      })
      allDrafts.push(...drafts)
      result.lines_processed += 1
    } catch (e) {
      result.issues.push({ line_id: line.id, severity: 'error', code: 'ALLOCATION_SUM_MISMATCH', message: e instanceof Error ? e.message : String(e) })
    }
  }

  if (allDrafts.length === 0) {
    result.status = 'aborted'
    result.errors.push('Aucune allocation à insérer')
    return result
  }

  const payload = allDrafts.map((d) => ({
    encaissement_line_id: d.encaissement_line_id, split_pct: d.split_pct,
    consultant_id: d.consultant_id, apporteur_id: d.apporteur_id,
    applied_rule_id: d.applied_rule_id, applied_rule_name: d.applied_rule_name,
    applied_split_snapshot: d.applied_split_snapshot as unknown as object,
    taux_remuneration_snapshot: d.taux_remuneration_snapshot,
    taux_apporteur_ext_snapshot: d.taux_apporteur_ext_snapshot,
    taux_pev_gestion_snapshot: d.taux_pev_gestion_snapshot,
    taux_cabinet_prededuction_snapshot: d.taux_cabinet_prededuction_snapshot,
    commission_brute_snapshot: d.commission_brute_snapshot,
    rem_apporteur_interne_montant: d.rem_apporteur_interne_montant,
    rem_apporteur_ext_montant: d.rem_apporteur_ext_montant,
    part_pev_gestion_montant: d.part_pev_gestion_montant,
    part_cabinet_prededuction_montant: d.part_cabinet_prededuction_montant,
    commission_nette_snapshot: d.commission_nette_snapshot,
    part_consultant_montant: d.part_consultant_montant,
    part_pool_plus_montant: d.part_pool_plus_montant,
    part_thelo_montant: d.part_thelo_montant,
    part_maxine_montant: d.part_maxine_montant,
    part_stephane_montant: d.part_stephane_montant,
    part_cabinet_montant: d.part_cabinet_montant,
  }))

  const { error: insertErr, count } = await supabase
    .from('encaissement_line_allocations' as never)
    .insert(payload as never, { count: 'exact' })

  if (insertErr) {
    result.status = 'aborted'
    result.errors.push(`INSERT allocations : ${insertErr.message}`)
    result.issues.push({ line_id: '-', severity: 'error', code: 'INSERT_FAILED', message: insertErr.message })
    return result
  }

  result.allocations_inserted = count ?? payload.length

  const { error: updErr } = await supabase
    .from('encaissement_batches' as never)
    .update({
      statut: 'valide', validated_at: new Date().toISOString(),
      validated_by: input.validatedByConsultantId ?? null,
    } as never)
    .eq('id', input.batchId)

  if (updErr) {
    result.status = 'partial'
    result.errors.push(`UPDATE statut : ${updErr.message}`)
    result.summary = summarizeAllocations(allDrafts)
    return result
  }

  result.summary = summarizeAllocations(allDrafts)
  result.status = result.issues.some((i) => i.severity === 'error') ? 'partial' : 'ok'
  return result
}

export async function unvalidateBatch(supabase: SB, batchId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: lines, error: linesErr } = await supabase
    .from('encaissement_lines' as never)
    .select('id').eq('batch_id' as never, batchId)
  if (linesErr) return { ok: false, error: linesErr.message }

  if (lines && lines.length > 0) {
    const ids = lines.map((l) => (l as { id: string }).id)
    const { error: delErr } = await supabase
      .from('encaissement_line_allocations' as never)
      .delete().in('encaissement_line_id' as never, ids)
    if (delErr) return { ok: false, error: delErr.message }
  }

  const { error: updErr } = await supabase
    .from('encaissement_batches' as never)
    .update({ statut: 'brouillon', validated_at: null, validated_by: null } as never)
    .eq('id', batchId)
  if (updErr) return { ok: false, error: updErr.message }
  return { ok: true }
}
