import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBatch } from '@/lib/encours/validation'

type RouteContext = { params: Promise<{ id: string }> }

function isUuid(x: unknown): x is string {
  return typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    if (!isUuid(id)) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const allowUnreconciled = Boolean((body as Record<string, unknown>).allowUnreconciledLines)

    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

    const { data: cidData } = await supabase.rpc('get_current_consultant_id' as never)
    const result = await validateBatch(supabase, {
      batchId: id,
      validatedByConsultantId: (cidData as string | null) ?? null,
      allowUnreconciledLines: allowUnreconciled,
    })
    const httpStatus = result.status === 'ok' ? 200 : result.status === 'partial' ? 207 : 400
    return NextResponse.json(result, { status: httpStatus })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
  }
}
