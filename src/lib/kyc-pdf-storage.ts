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

import nodePath from 'path'
import { getAdminClient } from '@/lib/supabase/admin'
import { generateKycPdfBytes, type KycPdfSignature } from '@/lib/kyc-pdf-template'

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
  /** Retour #2 — indique si le PDF a aussi été déposé comme pièce
   *  jointe CRM (bucket `client-pj` + row `client_pj`). Séparé du
   *  `path` car le PDF peut être déposé en kyc-documents même si
   *  l'archivage PJ échoue. */
  pjArchived?: boolean
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

    // Résolution du nom du consultant
    let consultantName: string | null = null
    const consultantId = (client as Record<string, unknown>).consultant_id
    if (consultantId) {
      const { data: consultant } = await admin
        .from('consultants')
        .select('nom, prenom')
        .eq('id', consultantId as string)
        .single()
      if (consultant) {
        consultantName =
          `${(consultant as { prenom?: string; nom?: string }).prenom ?? ''} ${(consultant as { prenom?: string; nom?: string }).nom ?? ''}`.trim() ||
          null
      }
    }

    const logoPath = nodePath.join(process.cwd(), 'public', 'logo-pev-icon.png')

    const pdfBytes = await generateKycPdfBytes(
      client as Record<string, unknown>,
      signature,
      logoPath,
      consultantName,
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

    // Retour #2 — archivage PJ CRM. On réutilise le bucket `client-pj`
    // (déjà utilisé par le composant PiecesJointes) et on insère une
    // ligne dans `client_pj` avec type_document='kyc_signe'. Le consultant
    // voit alors le PDF signé dans sa liste de PJ standard, sans avoir
    // à naviguer vers le bucket privé kyc-documents.
    //
    // Best effort : si l'upload bucket ou l'insert row échoue, on ne
    // propage pas — le PDF canonical reste dans kyc-documents et l'email
    // l'attache en direct. On logge juste un warning.
    let pjArchived = false
    try {
      const pjPath = `${args.clientId}/kyc-signe-${stamp}.pdf`
      const { error: pjUploadErr } = await admin.storage
        .from('client-pj')
        .upload(pjPath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        })
      if (pjUploadErr) {
        console.warn(
          '[kyc-pdf-storage] client-pj upload failed:',
          pjUploadErr.message,
        )
      } else {
        const pjRow = {
          client_id: args.clientId,
          nom_fichier: `KYC-signe-${stamp}.pdf`,
          storage_path: pjPath,
          taille_octets: pdfBytes.byteLength,
          type_mime: 'application/pdf',
          type_document: 'kyc_signe',
          date_document: signature.signedAt.toISOString().slice(0, 10),
          // `uploaded_by` laissé null — c'est un upload système
          // post-signature, pas un upload utilisateur.
        }
        const { error: pjInsertErr } = await admin
          .from('client_pj' as never)
          .insert(pjRow as never)
        if (pjInsertErr) {
          console.warn(
            '[kyc-pdf-storage] client_pj insert failed:',
            pjInsertErr.message,
          )
        } else {
          pjArchived = true
        }
      }
    } catch (pjErr: unknown) {
      console.warn(
        '[kyc-pdf-storage] PJ archive threw:',
        pjErr instanceof Error ? pjErr.message : String(pjErr),
      )
    }

    return { path, bytes: pdfBytes, pjArchived }
  } catch (err: unknown) {
    console.warn(
      '[kyc-pdf-storage] PDF gen caught error:',
      err instanceof Error ? err.message : String(err),
    )
    return { path: null, bytes: null }
  }
}
