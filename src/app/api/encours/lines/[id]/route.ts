import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

function isUuid(x: unknown): x is string {
  return typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    if (!isUuid(id)) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

    const { data: line, error: lErr } = await supabase
      .from('encaissement_lines' as never).select('*').eq('id', id).maybeSingle()
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    if (!line) return NextResponse.json({ error: 'Ligne introuvable' }, { status: 404 })

    const { data: allocations, error: aErr } = await supabase
      .from('encaissement_line_allocations' as never).select('*').eq('encaissement_line_id' as never, id)
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

    return NextResponse.json({ line, allocations: allocations ?? [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    if (!isUuid(id)) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })

    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

    const { data: lineRow, error: lErr } = await supabase
      .from('encaissement_lines' as never)
      .select('id, batch_id, dossier_id, statut_rapprochement').eq('id', id).maybeSingle()
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    if (!lineRow) return NextResponse.json({ error: 'Ligne introuvable' }, { status: 404 })

    const { data: batchRow, error: bErr } = await supabase
      .from('encaissement_batches' as never).select('statut')
      .eq('id', (lineRow as { batch_id: string }).batch_id).maybeSingle()
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
    if (!batchRow) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    if ((batchRow as { statut: string }).statut !== 'brouillon') {
      return NextResponse.json({ error: `Lot en statut "${(batchRow as { statut: string }).statut}"` }, { status: 409 })
    }

    const b = body as Record<string, unknown>
    const allowed = ['type_commission','origine_ligne','montant_brut_percu','categorie','compagnie_id','produit_id','client_id','dossier_id','label_source','periode_reference_debut','periode_reference_fin','assiette_reference','taux_reference','devise','statut_rapprochement','needs_review','notes'] as const
    const payload: Record<string, unknown> = {}
    for (const k of allowed) if (b[k] !== undefined) payload[k] = b[k]
    if (Object.keys(payload).length === 0) return NextResponse.json({ error: 'Aucun champ' }, { status: 400 })

    if (payload.montant_brut_percu !== undefined) {
      const m = Number(payload.montant_brut_percu)
      if (!Number.isFinite(m) || m < 0) return NextResponse.json({ error: 'montant_brut_percu invalide' }, { status: 400 })
      payload.montant_brut_percu = m
    }
    if (payload.type_commission !== undefined && !['entree','encours'].includes(payload.type_commission as string)) {
      return NextResponse.json({ error: 'type_commission invalide' }, { status: 400 })
    }
    if (payload.statut_rapprochement !== undefined && !['non_rapproche','rapproche_auto','rapproche_manuel'].includes(payload.statut_rapprochement as string)) {
      return NextResponse.json({ error: 'statut_rapprochement invalide' }, { status: 400 })
    }

    const newStatut = (payload.statut_rapprochement as string | undefined) ?? (lineRow as { statut_rapprochement: string }).statut_rapprochement
    const newDossierId = (payload.dossier_id as string | undefined) ?? (lineRow as { dossier_id: string | null }).dossier_id
    if (newStatut !== 'non_rapproche' && !newDossierId) {
      return NextResponse.json({ error: 'Ligne rapprochée sans dossier_id' }, { status: 400 })
    }

    const { data, error } = await supabase.from('encaissement_lines' as never).update(payload as never).eq('id', id).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    if (!isUuid(id)) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

    const { data: lineRow } = await supabase
      .from('encaissement_lines' as never).select('batch_id').eq('id', id).maybeSingle()
    if (lineRow) {
      const { data: batchRow } = await supabase
        .from('encaissement_batches' as never).select('statut')
        .eq('id', (lineRow as { batch_id: string }).batch_id).maybeSingle()
      if (batchRow && (batchRow as { statut: string }).statut !== 'brouillon') {
        return NextResponse.json({ error: `Lot en statut "${(batchRow as { statut: string }).statut}". Dé-valider d'abord.` }, { status: 409 })
      }
    }

    const { error } = await supabase.from('encaissement_lines' as never).delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
  }
}
