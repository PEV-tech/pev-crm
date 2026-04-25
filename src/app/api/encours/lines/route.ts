import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isUuid(x: unknown): x is string {
  return typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

    const sp = req.nextUrl.searchParams
    const batchId = sp.get('batch_id')
    const dossierId = sp.get('dossier_id')
    const needsReview = sp.get('needs_review')
    const statut = sp.get('statut_rapprochement')
    const limit = Math.min(Math.max(parseInt(sp.get('limit') ?? '200', 10) || 200, 1), 2000)
    const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0)

    if (batchId && !isUuid(batchId)) return NextResponse.json({ error: 'batch_id invalide' }, { status: 400 })
    if (dossierId && !isUuid(dossierId)) return NextResponse.json({ error: 'dossier_id invalide' }, { status: 400 })

    let q = supabase.from('encaissement_lines' as never).select('*')
      .order('created_at', { ascending: true }).range(offset, offset + limit - 1)

    if (batchId) q = (q as unknown as { eq: (a: string, b: string) => typeof q }).eq('batch_id', batchId)
    if (dossierId) q = (q as unknown as { eq: (a: string, b: string) => typeof q }).eq('dossier_id', dossierId)
    if (statut) q = (q as unknown as { eq: (a: string, b: string) => typeof q }).eq('statut_rapprochement', statut)
    if (needsReview === 'true') q = (q as unknown as { eq: (a: string, b: boolean) => typeof q }).eq('needs_review', true)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [], limit, offset })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })

    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

    const b = body as Record<string, unknown>
    if (!isUuid(b.batch_id)) return NextResponse.json({ error: 'batch_id invalide' }, { status: 400 })
    if (typeof b.type_commission !== 'string' || !['entree','encours'].includes(b.type_commission)) {
      return NextResponse.json({ error: 'type_commission invalide' }, { status: 400 })
    }
    if (typeof b.montant_brut_percu !== 'number' || b.montant_brut_percu < 0 || !Number.isFinite(b.montant_brut_percu)) {
      return NextResponse.json({ error: 'montant_brut_percu invalide' }, { status: 400 })
    }

    const { data: batchRow, error: bErr } = await supabase
      .from('encaissement_batches' as never).select('statut').eq('id', b.batch_id).maybeSingle()
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
    if (!batchRow) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    if ((batchRow as { statut: string }).statut !== 'brouillon') {
      return NextResponse.json({ error: `Lot en statut "${(batchRow as { statut: string }).statut}"` }, { status: 409 })
    }

    const allowed = ['batch_id','type_commission','origine_ligne','montant_brut_percu','categorie','compagnie_id','produit_id','client_id','dossier_id','label_source','periode_reference_debut','periode_reference_fin','assiette_reference','taux_reference','devise','statut_rapprochement','needs_review','notes'] as const
    const payload: Record<string, unknown> = {}
    for (const k of allowed) if (b[k] !== undefined) payload[k] = b[k]

    const sr = (payload.statut_rapprochement as string | undefined) ?? 'non_rapproche'
    if (sr !== 'non_rapproche' && !isUuid(payload.dossier_id)) {
      return NextResponse.json({ error: 'Ligne rapprochée sans dossier_id' }, { status: 400 })
    }

    const { data, error } = await supabase.from('encaissement_lines' as never).insert(payload as never).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
  }
}
