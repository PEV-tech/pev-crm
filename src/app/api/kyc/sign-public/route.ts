import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { generateKycPdfBytes, type KycPdfSignature } from '@/lib/kyc-pdf'
import { sendKycSignedNotification } from '@/lib/kyc-email'

/**
 * POST /api/kyc/sign-public
 *
 * Proxy serveur pour la signature d'un KYC depuis le portail public
 * `/kyc/[token]`. Le client appelle cette route plutôt que la RPC
 * directement afin que l'IP publique du signataire soit captée côté
 * serveur (via `x-forwarded-for` / `x-real-ip` — renseignés par Vercel)
 * et transmise à la RPC `kyc_sign_by_token`.
 *
 * Pourquoi cette route :
 *   - Le navigateur ne connaît pas son IP publique ; avant ce fix le
 *     champ `kyc_signer_ip` était systématiquement `null`, dégradant le
 *     faisceau de preuve ACPR/DDA pour les signatures incomplètes.
 *   - L'auth n'est PAS requise (le token est le mécanisme d'accès). On
 *     utilise donc le client Supabase anon classique : la RPC est
 *     SECURITY DEFINER et contrôle déjà strictement ce qu'un token
 *     permet de faire.
 *
 * Effets post-RPC (Batch A KYC PDF — 2026-04-21) :
 *   · On récupère le client_id retourné par la RPC.
 *   · On lit la fiche client complète via le client admin (service_role).
 *   · On génère le PDF de synthèse (PP ou PM selon type_personne).
 *   · On l'upload dans le bucket privé `kyc-documents` (policy INSERT
 *     service_role uniquement).
 *   · On écrit le chemin + timestamp sur la fiche client.
 *   · En cas d'échec à n'importe quelle étape (admin client absent, upload
 *     KO, ...), on LOG un warning mais on renvoie quand même {ok:true} :
 *     la signature elle-même est persistée par la RPC et ne doit pas
 *     être invalidée par un souci de génération PDF qu'on peut rejouer
 *     ultérieurement via un job de réparation.
 *
 * Body JSON attendu :
 * {
 *   token: string,
 *   signer_name: string,
 *   completion_rate: number (0-100),
 *   missing_fields: string[],
 *   consent_incomplete: boolean,
 *   consent_accuracy: boolean
 * }
 *
 * Retour :
 *   200 { ok: true, pdf_path?: string } si OK
 *   400 pour les erreurs de validation de payload
 *   409 pour les conflits d'état (ex: "Ce dossier a déjà été signé")
 *   500 pour les erreurs internes inattendues
 *   Le message remonté depuis la RPC est passé tel quel dans `{ error }`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Body JSON invalide' },
        { status: 400 }
      )
    }

    const {
      token,
      signer_name,
      completion_rate,
      missing_fields,
      consent_incomplete,
      consent_accuracy,
    } = body as {
      token?: unknown
      signer_name?: unknown
      completion_rate?: unknown
      missing_fields?: unknown
      consent_incomplete?: unknown
      consent_accuracy?: unknown
    }

    // Validations minimales côté route (la RPC revalide derrière).
    if (typeof token !== 'string' || token.length < 16) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
    }
    if (typeof signer_name !== 'string' || !signer_name.trim()) {
      return NextResponse.json(
        { error: 'Nom du signataire requis' },
        { status: 400 }
      )
    }
    if (
      typeof completion_rate !== 'number' ||
      completion_rate < 0 ||
      completion_rate > 100 ||
      !Number.isFinite(completion_rate)
    ) {
      return NextResponse.json(
        { error: 'completion_rate doit être un nombre entre 0 et 100' },
        { status: 400 }
      )
    }
    if (!Array.isArray(missing_fields)) {
      return NextResponse.json(
        { error: 'missing_fields doit être un tableau' },
        { status: 400 }
      )
    }

    // Extraction IP — Vercel renseigne x-forwarded-for (liste, on prend
    // le premier, qui est l'IP client originale). Fallback sur x-real-ip.
    const forwardedFor = req.headers.get('x-forwarded-for') || ''
    const realIp = req.headers.get('x-real-ip') || ''
    const ip =
      forwardedFor.split(',')[0]?.trim() ||
      realIp.trim() ||
      null

    const supabase = await createClient()

    const signerName = signer_name.trim()
    const roundedRate = Math.round(completion_rate)
    const missingArr = (missing_fields as unknown[]).map((m) => String(m))
    const consentIncomplete = consent_incomplete === true
    const consentAccuracy = consent_accuracy === true

    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      'kyc_sign_by_token' as never,
      {
        p_token: token,
        p_signer_name: signerName,
        p_completion_rate: roundedRate,
        p_missing_fields: missingArr as never,
        p_consent_incomplete: consentIncomplete,
        p_consent_accuracy: consentAccuracy,
        p_signer_ip: ip,
      } as never
    )

    if (rpcErr) {
      // Les erreurs métier (KYC déjà signé, consentement manquant) remontent
      // en texte lisible — on les renvoie telles quelles pour affichage UI.
      // On mappe "déjà signé" vers 409 Conflict (sémantique HTTP correcte
      // pour un conflit d'état ressource) ; les autres restent en 400.
      // Pattern résilient : accepte à la fois l'ancien message EN
      // ("KYC already signed") et le nouveau FR ("déjà été signé"),
      // pour couvrir une fenêtre de rollout où l'un et l'autre peuvent
      // coexister entre DB et app.
      console.error('[kyc/sign-public] rpc error:', rpcErr.message)
      const isConflict =
        /d[ée]j[àa]\s+[ée]t[ée]\s+sign|already\s+signed/i.test(rpcErr.message)
      return NextResponse.json(
        { error: rpcErr.message },
        { status: isConflict ? 409 : 400 }
      )
    }

    // --- PDF generation + email notification post-RPC
    // Best-effort : tout échec à ce stade logge un warning mais n'invalide
    // jamais la signature (persistée par la RPC en amont).
    const clientId = extractClientId(rpcData)
    const signedAt = new Date()
    let pdfPath: string | null = null
    let pdfBytes: Uint8Array | null = null

    if (clientId) {
      const pdfResult = await generateAndStoreKycPdf({
        clientId,
        signerName,
        signerIp: ip,
        completionRate: roundedRate,
        missingFields: missingArr,
        consentIncomplete,
        consentAccuracy,
        signedAt,
      })
      pdfPath = pdfResult.path
      pdfBytes = pdfResult.bytes

      // Email au consultant (complet ou incomplet — Maxine 2026-04-21)
      const admin = getAdminClient()
      if (admin) {
        try {
          const emailResult = await sendKycSignedNotification({
            admin,
            clientId,
            signerName,
            signedAt,
            completionRate: roundedRate,
            missingFields: missingArr,
            isIncomplete: roundedRate < 100,
            pdfBytes,
            pdfPath,
          })
          if (!emailResult.sent) {
            console.warn(
              '[kyc/sign-public] email not sent:',
              emailResult.skipped || emailResult.error
            )
          }
        } catch (emailErr: unknown) {
          console.warn(
            '[kyc/sign-public] email send threw:',
            emailErr instanceof Error ? emailErr.message : String(emailErr)
          )
        }
      }
    }

    return NextResponse.json({
      ok: true,
      ...(pdfPath ? { pdf_path: pdfPath } : {}),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[kyc/sign-public] unexpected:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function extractClientId(rpcData: unknown): string | null {
  if (!rpcData || typeof rpcData !== 'object') return null
  const maybe = (rpcData as Record<string, unknown>).client_id
  return typeof maybe === 'string' ? maybe : null
}

/**
 * Génère le PDF de synthèse KYC et l'upload dans Supabase Storage.
 * Renvoie { path, bytes } :
 *   · `path` : chemin d'objet dans le bucket `kyc-documents`
 *     (ex: "clients/uuid/kyc-2026-04-21T10-12.pdf") ou `null` si échec.
 *   · `bytes` : Uint8Array du PDF généré, conservé pour pièce jointe email
 *     consultant. `null` si PDF pas généré (clé admin absente / read KO).
 *
 * Les bytes sont renvoyés MÊME si l'upload a échoué, ce qui permet à
 * l'email de partir avec le PDF en attachement quand le stockage est KO
 * mais que la génération a réussi. Degradation gracieuse : aucune
 * exception remontée à l'appelant.
 *
 * Batch B (2026-04-21, Maxine) : exposer les bytes a été ajouté pour
 * permettre la notification consultant avec PDF inline sans nouveau
 * round-trip de téléchargement depuis le bucket.
 */
async function generateAndStoreKycPdf(args: {
  clientId: string
  signerName: string
  signerIp: string | null
  signedAt: Date
  completionRate: number
  missingFields: string[]
  consentIncomplete: boolean
  consentAccuracy: boolean
}): Promise<{ path: string | null; bytes: Uint8Array | null }> {
  const admin = getAdminClient()
  if (!admin) {
    console.warn(
      '[kyc/sign-public] SUPABASE_SERVICE_ROLE_KEY manquant — PDF non généré'
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
        '[kyc/sign-public] read client failed:',
        readErr?.message || 'not found'
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
      signature
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
      console.warn('[kyc/sign-public] upload failed:', uploadErr.message)
      // On renvoie les bytes quand même pour permettre l'email.
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
        '[kyc/sign-public] update clients failed:',
        updateErr.message
      )
      // Le PDF est bien dans le bucket mais le lien n'est pas persisté.
      // On peut quand même retourner le chemin pour que l'appelant logge.
    }

    return { path, bytes: pdfBytes }
  } catch (err: unknown) {
    console.warn(
      '[kyc/sign-public] PDF gen caught error:',
      err instanceof Error ? err.message : String(err)
    )
    return { path: null, bytes: null }
  }
}
