import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

    const sp = req.nextUrl.searchParams
    const limit = Math.min(Math.max(parseInt(sp.get('limit') ?? '50', 10) || 50, 1), 500)
    const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0)

    let q = supabase.from('v_encaissement_batches_summary' as never).select('*')
      .order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const statut = sp.get('statut')
    const compagnieId = sp.get('compagnie_id')
    const annee = sp.get('annee')
    const trimestre = sp.get('trimestre')

    if (statut) q = (q as unknown as { eq: (a: string, b: string) => typeof q }).eq('statut', statut)
    if (compagnieId) q = (q as unknown as { eq: (a: string, b: string) => typeof q }).eq('compagnie_id', compagnieId)
    if (annee) q = (q as unknown as { eq: (a: string, b: number) => typeof q }).eq('annee', parseInt(annee, 10))
    if (trimestre) q = (q as unknown as { eq: (a: string, b: number) => typeof q }).eq('trimestre', parseInt(trimestre, 10))

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
    if (typeof b.source_type !== 'string' || !['manuel','pdf','csv','auto_entree'].includes(b.source_type)) {
      return NextResponse.json({ error: 'source_type invalide' }, { status: 400 })
    }

    const { data: cidData } = await supabase.rpc('get_current_consultant_id' as never)
    const payload: Record<string, unknown> = { source_type: b.source_type, statut: 'brouillon', created_by: (cidData as string | null) ?? null }
    const allowed = ['compagnie_id','partenaire_label','annee','trimestre','periode_debut','periode_fin','date_reception','date_valeur','document_name','document_storage_path','document_hash','commentaire'] as const
    for (const k of allowed) if (b[k] !== undefined) payload[k] = b[k]

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

    const { data, error } = await supabase.from('encaissement_batches' as never).insert(payload as never).select('*').single()
    if (error) {
      const code = (error as unknown as { code?: string }).code
      if (code === '23505') return NextResponse.json({ error: 'Document déjà importé (même hash).' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
  }
}
