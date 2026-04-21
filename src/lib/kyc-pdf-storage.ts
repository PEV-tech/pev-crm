/**
 * Helper partagé (Chantier #4d) pour générer le PDF KYC de synthèse et
 * le déposer dans le bucket privé `kyc-documents`, puis enregistrer son
 * chemin + timestamp sur la fiche client.
 *
 * Cet helper est destiné au flux post-validation (consultant) :
 * `/api/kyc/apply-proposition` l'appelle APRÈS que la RPC
 * `kyc_apply_proposition` a renvoyé `fully_applied` — le PDF reflète
 * alors strictement l'état consolidé du dossier.
 *
 * Il réplique volontairement la logique historiquement inline dans
 * `/api/kyc/sign-public` (extraction progressive ; sign-public sera
 * dépriécié une fois le flux propositions en production).
 *
 * Degradation gracieuse : jamais d'exception remontée. En cas d'échec
 * (admin client absent, read client KO, upload échoué, update KO), on
 * logge un warning et on renvoie des champs null/partiels — la
 * signature côté DB reste valide indépendamment.
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { generateKycPdfBytes, type KycPdfSignature } from '@/lib/kyc-pdf'

export type KycPdfGenInput = {
  clientId: string
  signerName: string
  signerIp: string | null
  signedAt: Date
  completionRate: number
  missingFields: string[]
  consentIncomplete: boolean
  consentAccuracy: boolean
}

export type KycPdfGenResult = {
  path: string | null
  bytes: Uint8Array | null
}

export async function generateAndStoreKycPdf(
  args: KycPdfGenInput,
): Promise<KycPdfGenResult> {
  const admin = getAdminClient()
  if (!admin) {
    console.warn(
      '[kyc-pdf-storage] SUPABASE_SERVICE_ROLE_KEY manquant — PDF non généré',
    )
    return { path: null, bytes: null }
  }

  try {
    const { data: client, error: readErr } = await admin
      .from('clients')
      .select('*')
      .eq('id', args.clientId)
      .single()

    if (readErr || !client) {
      console.warn(
        '[kyc-pdf-storage] read client failed:',
        readErr?.message || 'not found',
      )
      return { path: null, bytes: null }
    }

    const signature: KycPdfSignature = {
      signerName: args.signerName,
      signedAt: args.signedAt,
      signerIp: args.signerIp,
      completionRate: args.completionRate,
      missingFields: args.missingFields,
      isIncomplete: args.completionRate < 100,
      consentIncomplete: args.consentIncomplete,
      consentAccuracy: args.consentAccuracy,
    }

    const pdfBytes = await generateKycPdfBytes(
      client as Record<string, unknown>,
      signature,
    )

    const stamp = signature.signedAt
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('Z', '')
    const path = `clients/${args.clientId}/kyc-${stamp}.pdf`

    const { error: uploadErr } = await admin.storage
      .from('kyc-documents')
      .upload(path, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.warn('[kyc-pdf-storage] upload failed:', uploadErr.message)
      return { path: null, bytes: pdfBytes }
    }

    const { error: updateErr } = await admin
      .from('clients')
      .update({
        kyc_pdf_storage_path: path,
        kyc_pdf_generated_at: signature.signedAt.toISOString(),
      })
      .eq('id', args.clientId)

    if (updateErr) {
      console.warn(
        '[kyc-pdf-storage] update clients failed:',
        updateErr.message,
      )
    }

    return { path, bytes: pdfBytes }
  } catch (err: unknown) {
    console.warn(
      '[kyc-pdf-storage] PDF gen caught error:',
      err instanceof Error ? err.message : String(err),
    )
    return { path: null, bytes: null }
  }
}
