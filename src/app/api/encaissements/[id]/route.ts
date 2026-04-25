import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * DELETE /api/encaissements/[id]
 *
 * Supprime une ligne de la table `encaissements` (flux historique alimenté
 * par fn_create_encaissement). Optionnellement, repasse aussi
 * `factures.payee = 'non'` pour empêcher le trigger de la regénérer.
 *
 * Body JSON optionnel :
 *   { unmark_facture?: boolean }   default: true
 *
 * Réponse 200 :
 *   { ok: true, unmarked_facture: boolean }
 *
 * RLS attendue : géré par la table `encaissements` (manager / back_office /
 * consultant propriétaire du client). L'API ne re-vérifie pas, on laisse
 * PostgREST trancher.
 */

type RouteContext = { params: Promise<{ id: string }> }

function isUuid(x: unknown): x is string {
  return typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    if (!isUuid(id)) return NextResponse.json({ error: 'id invalide' }, { status: 400 })

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const unmarkFacture = (body as { unmark_facture?: boolean }).unmark_facture !== false

    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }

    // 1. Récupérer l'encaissement pour avoir le dossier_id
    const { data: enc, error: encErr } = await supabase
      .from('encaissements')
      .select('id, dossier_id')
      .eq('id', id)
      .maybeSingle()

    if (encErr) {
      console.error('[encaissements DELETE] read', encErr.message)
      return NextResponse.json({ error: encErr.message }, { status: 500 })
    }
    if (!enc) {
      return NextResponse.json({ error: 'Encaissement introuvable' }, { status: 404 })
    }

    let unmarkedFacture = false

    // 2. Si demandé, repasse la facture en non payée AVANT de supprimer l'encaissement.
    //    Ordre important : si on supprime d'abord, le trigger pourrait re-créer
    //    la ligne en cascade. En faisant l'unmark d'abord, on bloque la régénération.
    if (unmarkFacture && enc.dossier_id) {
      const { data: updatedRows, error: factErr } = await supabase
        .from('factures')
        .update({ payee: 'non' })
        .eq('dossier_id', enc.dossier_id)
        .eq('payee', 'oui')
        .select('id')

      if (factErr) {
        console.error('[encaissements DELETE] unmark facture', factErr.message)
        return NextResponse.json({ error: `Annulation facture : ${factErr.message}` }, { status: 500 })
      }
      unmarkedFacture = (updatedRows?.length ?? 0) > 0
    }

    // 3. Suppression de l'encaissement
    const { error: delErr } = await supabase
      .from('encaissements')
      .delete()
      .eq('id', id)

    if (delErr) {
      console.error('[encaissements DELETE] delete', delErr.message)
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, unmarked_facture: unmarkedFacture })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[encaissements DELETE] unexpected:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
