import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/kyc/pdf/[clientId]
 *
 * Renvoie une redirection 302 vers une Signed URL Supabase Storage valable
 * 5 min, permettant au consultant de télécharger le PDF KYC signé du client.
 *
 * Auth :
 *   · Exige un utilisateur authentifié côté CRM (via cookies Supabase).
 *     Les RLS sur la table `clients` décident déjà qui peut voir quelle
 *     fiche — on s'appuie sur un SELECT * FROM clients WHERE id=… pour
 *     valider l'accès avant d'émettre la signed URL.
 *   · La signed URL est émise par le client admin (service_role). On ne
 *     peut pas la laisser le front-end la générer directement parce que
 *     les policies storage.objects SELECT sont authenticated (ce qui
 *     suffirait) mais on centralise ici pour le logging + TTL contrôlé.
 *
 * Behaviour :
 *   · 404 si la fiche n'a pas de kyc_pdf_storage_path renseigné.
 *   · 403 si l'utilisateur non authentifié.
 *   · 404 si l'utilisateur n'a pas accès à la fiche via RLS.
 *   · 503 si SUPABASE_SERVICE_ROLE_KEY manquant (PDF jamais générés).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  if (!clientId || typeof clientId !== 'string') {
    return NextResponse.json({ error: 'clientId requis' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 403 })
  }

  // 1. Vérif d'accès à la fiche via RLS utilisateur (pas via admin)
  const { data: client, error: readErr } = await supabase
    .from('clients')
    .select('id, kyc_pdf_storage_path')
    .eq('id', clientId)
    .maybeSingle()

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 })
  }
  if (!client) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }
  if (!client.kyc_pdf_storage_path) {
    return NextResponse.json(
      { error: 'Aucun PDF KYC généré pour ce client' },
      { status: 404 }
    )
  }

  // 2. Signed URL via admin
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY non configuré côté serveur' },
      { status: 503 }
    )
  }

  const { data: signed, error: signErr } = await admin.storage
    .from('kyc-documents')
    .createSignedUrl(client.kyc_pdf_storage_path, 60 * 5) // 5 min

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message || 'Signed URL KO' },
      { status: 500 }
    )
  }

  return NextResponse.redirect(signed.signedUrl, { status: 302 })
}
