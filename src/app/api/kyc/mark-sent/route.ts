import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/kyc/mark-sent
 *
 * Marque un KYC comme "envoyé" (positionne kyc_sent_at si null).
 * Appelé depuis l'UI consultant quand il clique "Copier le lien" ou ouvre
 * Gmail pour envoyer. Idempotent : si kyc_sent_at est déjà défini, pas de
 * MAJ (on garde la date du premier envoi).
 *
 * Body JSON : { client_id: string (uuid) }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const clientId =
      body && typeof body === 'object' && typeof (body as any).client_id === 'string'
        ? ((body as any).client_id as string)
        : null

    if (!clientId) {
      return NextResponse.json({ error: 'client_id requis' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      )
    }

    const { error: rpcErr } = await supabase.rpc(
      'kyc_mark_sent' as never,
      { p_client_id: clientId } as never
    )

    if (rpcErr) {
      console.error('[kyc/mark-sent] rpc error:', rpcErr.message)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[kyc/mark-sent] unexpected:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
