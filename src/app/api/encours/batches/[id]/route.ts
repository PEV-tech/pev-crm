import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unvalidateBatch } from '@/lib/encours/validation'

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

    const { data: batch, error: bErr } = await supabase
      .from('v_encaissement_batches_summary' as never).select('*').eq('id', id).maybeSingle()
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
    if (!batch) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })

    const { data: lines, error: lErr } = await supabase
      .from('encaissement_lines' as never).select('*')
      .eq('batch_id' as never, id).order('created_at', { ascending: true })
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })

    const lineIds = ((lines ?? []) as Array<{ id: string }>).map((l) => l.id)
    let allocations: unknown[] = []
    if (lineIds.length > 0) {
      const { data: aData, error: aErr } = await supabase
        .from('encaissement_line_allocations' as never).select('*')
        .in('encaissement_line_id' as never, lineIds)
      if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
      allocations = aData ?? []
    }

    return NextResponse.json({ batch, lines: lines ?? [], allocations })
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

    const { data: current, error: cErr } = await supabase
      .from('encaissement_batches' as never).select('id, statut').eq('id', id).maybeSingle()
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
    if (!current) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })

    const b = body as Record<string, unknown>
    if (b.statut === 'brouillon' && (current as { statut: string }).statut === 'valide') {
      const res = await unvalidateBatch(supabase, id)
      if (!res.ok) return NextResponse.json({ error: res.error ?? 'Dé-validation échouée' }, { status: 500 })
      return NextResponse.json({ ok: true, action: 'unvalidated' })
    }
    if (b.statut === 'valide') return NextResponse.json({ error: 'Utiliser POST /validate' }, { status: 400 })
    if (b.statut !== undefined && !['brouillon','comptabilise','annule'].includes(b.statut as string)) {
      return NextResponse.json({ error: 'statut invalide' }, { status: 400 })
    }

    const allowed = ['statut','compagnie_id','partenaire_label','annee','trimestre','periode_debut','periode_fin','date_reception','date_valeur','document_name','document_storage_path','document_hash','commentaire'] as const
    const payload: Record<string, unknown> = {}
    for (const k of allowed) if (b[k] !== undefined) payload[k] = b[k]
    if (Object.keys(payload).length === 0) return NextResponse.json({ error: 'Aucun champ' }, { status: 400 })

    if (payload.annee !== undefined && payload.annee !== null) {
      const a = Number(payload.annee)
      if (!Number.isInteger(a) || a < 2000 || a > 2100) return NextResponse.json({ error: 'annee hors borne' }, { status: 400 })
      payload.annee = a
    }
    if (payload.trimestre !== undefined && payload.trimestre !== null) {
      const t = Number(payload.trimestre)
      if (!Number.isInteger(t) || t < 1 || t > 4) return NextResponse.json({ error: 'trimestre hors borne' }, { status: 400 })
      payload.trimestre = t
    }

    const { data, error } = await supabase.from('encaissement_batches' as never).update(payload as never).eq('id', id).select('*').single()
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
    const { error } = await supabase.from('encaissement_batches' as never).delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
  }
}
