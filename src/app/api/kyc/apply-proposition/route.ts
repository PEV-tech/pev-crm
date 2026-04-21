import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { generateAndStoreKycPdf } from '@/lib/kyc-pdf-storage'
import { sendKycSignedNotifications } from '@/lib/kyc-email'

/**
 * POST /api/kyc/apply-proposition
 *
 * Chantier #4d : endpoint consultant authentifié pour appliquer une
 * proposition KYC (issue du portail public `/kyc/[token]`) en chaîne
 * avec la génération PDF + notification email.
 *
 * Pourquoi un endpoint et pas un appel RPC direct depuis le diff-viewer :
 *   · La génération PDF nécessite la service_role_key (bucket privé
 *     `kyc-documents`, policy INSERT service_role uniquement). Elle ne
 *     peut donc pas se faire côté navigateur.
 *   · Le PDF doit refléter l'état *consolidé* du dossier — on le génère
 *     APRÈS `kyc_apply_proposition`, pas à la soumission (le flux pré-#4b
 *     générait le PDF à la signature, avant toute validation consultant,
 *     ce qui créait des PDF non représentatifs quand le consultant rejetait
 *     un ou plusieurs champs). Cf. CDC Chantier #4d.
 *
 * Body JSON :
 *   { proposition_id: string (UUID), field_decisions: Record<string,"accept"|"reject"> }
 *
 * Retour :
 *   200 { status: 'fully_applied' | 'partially_applied' | 'rejected',
 *         applied, rejected, pdf_path? }
 *   400 erreurs métier (décision manquante, proposition déjà traitée, ...)
 *   401 si pas authentifié
 *   500 erreur interne
 *
 * Sécurité :
 *   · Auth obligatoire : on utilise le client Supabase server avec la
 *     session du consultant — si pas de session, la RPC remonte
 *     "Authentication required".
 *   · La RPC `kyc_apply_proposition` est SECURITY DEFINER avec check
 *     auth.uid() + GRANT EXECUTE TO authenticated → pas d'écriture
 *     anonyme possible.
 *   · Le PDF + l'email ne partent QUE si le statut final est
 *     `fully_applied` — en partially_applied, on diffère la génération
 *     (le consultant devra faire tourner une nouvelle proposition
 *     complète, ou un job batch de réparation régénèrera le PDF).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }
    const { proposition_id, field_decisions } = body as {
      proposition_id?: unknown
      field_decisions?: unknown
    }
    if (typeof proposition_id !== 'string' || proposition_id.length < 10) {
      return NextResponse.json(
        { error: 'proposition_id requis' },
        { status: 400 },
      )
    }
    if (
      !field_decisions ||
      typeof field_decisions !== 'object' ||
      Array.isArray(field_decisions)
    ) {
      return NextResponse.json(
        { error: 'field_decisions doit être un objet { champ: accept|reject }' },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    // 1. Appliquer la proposition (RPC SECURITY DEFINER avec auth check
    //    et whitelist de champs). Remonte une erreur si pas authentifié,
    //    si la proposition n'est plus pending, ou si une décision manque.
    const { data: applyData, error: applyErr } = await supabase.rpc(
      'kyc_apply_proposition' as never,
      {
        p_proposition_id: proposition_id,
        p_field_decisions: field_decisions as never,
      } as never,
    )
    if (applyErr) {
      console.error('[kyc/apply-proposition] rpc error:', applyErr.message)
      const isAuth = /auth/i.test(applyErr.message)
      return NextResponse.json(
        { error: applyErr.message },
        { status: isAuth ? 401 : 400 },
      )
    }

    const result = applyData as {
      proposition_id: string
      status: 'fully_applied' | 'partially_applied' | 'rejected'
      applied: number
      rejected: number
    }

    // 2. Si fully_applied : fetch la proposition pour récupérer la
    //    signature + completion rate (la RPC ne les renvoie pas), puis
    //    générer le PDF + envoyer l'email consultant.
    //
    //    On utilise le client admin pour bypass la RLS sur
    //    kyc_propositions (la policy SELECT passe mais on veut l'IP et
    //    les consents qui ne sont pas dans le snapshot).
    let pdfPath: string | null = null
    let pdfGenerated = false
    let emailSentConsultant = false
    let emailSentClient = false
    let emailSkippedReasonConsultant: string | null = null
    let emailSkippedReasonClient: string | null = null
    let pjArchived = false

    if (result.status === 'fully_applied') {
      const admin = getAdminClient()
      if (!admin) {
        console.warn(
          '[kyc/apply-proposition] SUPABASE_SERVICE_ROLE_KEY absent — PDF/email skippés',
        )
        emailSkippedReasonConsultant = 'service_role_key_missing'
        emailSkippedReasonClient = 'service_role_key_missing'
      } else {
        type PropRow = {
          client_id: string
          signer_name: string | null
          signer_ip: string | null
          signed_at: string | null
          completion_rate: number | null
          missing_fields: unknown
          consent_incomplete: boolean | null
          consent_accuracy: boolean | null
        }
        const { data: propRaw, error: propErr } = await admin
          .from('kyc_propositions' as never)
          .select(
            'client_id, signer_name, signer_ip, signed_at, completion_rate, missing_fields, consent_incomplete, consent_accuracy',
          )
          .eq('id', proposition_id)
          .single()
        const prop = propRaw as unknown as PropRow | null

        if (propErr || !prop) {
          console.warn(
            '[kyc/apply-proposition] read proposition failed:',
            propErr?.message || 'not found',
          )
          emailSkippedReasonConsultant = 'proposition_read_failed'
          emailSkippedReasonClient = 'proposition_read_failed'
        } else {
          const signedAt = prop.signed_at
            ? new Date(prop.signed_at)
            : new Date()
          const completionRate = prop.completion_rate ?? 0
          const missingFields = Array.isArray(prop.missing_fields)
            ? (prop.missing_fields as unknown[]).map((m) => String(m))
            : []
          const consentIncomplete = !!prop.consent_incomplete
          const consentAccuracy = !!prop.consent_accuracy
          const signerName = prop.signer_name || ''
          const signerIp = prop.signer_ip || null
          const clientId = prop.client_id

          const pdfResult = await generateAndStoreKycPdf({
            clientId,
            signerName,
            signerIp,
            signedAt,
            completionRate,
            missingFields,
            consentIncomplete,
            consentAccuracy,
          })
          pdfPath = pdfResult.path
          pdfGenerated = pdfResult.path != null
          pjArchived = pdfResult.pjArchived === true

          // Emails consultant + client (retour Maxine #2 : le client
          // signataire recevait rien avant ; maintenant il reçoit une
          // copie PDF en pièce jointe). On n'échoue pas la requête si
          // un des deux envois plante — on remonte les deux états séparés
          // pour que le diff-viewer surface une erreur ciblée
          // (correctif diagnostic #7).
          try {
            const batch = await sendKycSignedNotifications({
              admin,
              clientId,
              signerName,
              signedAt,
              completionRate,
              missingFields,
              isIncomplete: completionRate < 100,
              pdfBytes: pdfResult.bytes,
              pdfPath: pdfResult.path,
            })
            emailSentConsultant = batch.consultant.sent === true
            if (!emailSentConsultant) {
              emailSkippedReasonConsultant =
                batch.consultant.skipped ||
                batch.consultant.error ||
                'unknown'
              console.warn(
                '[kyc/apply-proposition] email consultant not sent:',
                emailSkippedReasonConsultant,
              )
            }
            emailSentClient = batch.client.sent === true
            if (!emailSentClient) {
              emailSkippedReasonClient =
                batch.client.skipped || batch.client.error || 'unknown'
              console.warn(
                '[kyc/apply-proposition] email client not sent:',
                emailSkippedReasonClient,
              )
            }
          } catch (emailErr: unknown) {
            const msg =
              emailErr instanceof Error ? emailErr.message : 'threw'
            emailSkippedReasonConsultant = msg
            emailSkippedReasonClient = msg
            console.warn(
              '[kyc/apply-proposition] email batch threw:',
              msg,
            )
          }
        }
      }
    }

    return NextResponse.json({
      status: result.status,
      applied: result.applied,
      rejected: result.rejected,
      pdf_generated: pdfGenerated,
      pj_archived: pjArchived,
      email_sent_consultant: emailSentConsultant,
      email_sent_client: emailSentClient,
      ...(pdfPath ? { pdf_path: pdfPath } : {}),
      ...(emailSkippedReasonConsultant
        ? { email_skipped_reason_consultant: emailSkippedReasonConsultant }
        : {}),
      ...(emailSkippedReasonClient
        ? { email_skipped_reason_client: emailSkippedReasonClient }
        : {}),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[kyc/apply-proposition] unexpected:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
