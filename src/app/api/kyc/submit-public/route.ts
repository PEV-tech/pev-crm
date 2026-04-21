import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * POST /api/kyc/submit-public
 *
 * Route publique appelée par le portail client `/kyc/[token]` pour créer
 * une proposition de modification du KYC. La proposition est horodatée
 * + signée par le client mais n'écrit PAS encore dans la table
 * `clients` : elle attend la validation champ-par-champ du consultant
 * (cf. RPC `kyc_apply_proposition`, Chantier #4c/#4d).
 *
 * Pourquoi passer par une route serveur plutôt que d'appeler la RPC
 * directement depuis le navigateur ?
 *   · Captation de l'IP publique via `x-forwarded-for` / `x-real-ip`
 *     (renseignés par Vercel). Le navigateur ne connaît pas sa propre
 *     IP, donc un appel direct à `kyc_submit_proposition_by_token`
 *     laisserait `signer_ip` à null — dégradation du faisceau de preuve
 *     ACPR/DDA en cas de contrôle.
 *   · Couche de validation supplémentaire avant la RPC (types + bornes).
 *   · Point d'accrochage pour envoyer un email de notification au
 *     consultant (`sendKycPropositionNotification`, à venir — #4c).
 *
 * Body JSON :
 * {
 *   token: string,                  // token KYC reçu par email
 *   proposed_data: Record<string, unknown>, // KYC proposé par le client
 *   signer_name: string,
 *   completion_rate: number,        // 0..100
 *   missing_fields: string[],
 *   consent_accuracy: boolean,
 *   consent_incomplete: boolean
 * }
 *
 * Retours :
 *   200 { ok: true, proposition_id, submitted_at }
 *   400 validation payload / consentement manquant
 *   409 une proposition pending existe déjà pour ce client
 *   500 erreur interne
 */
export async function POST(req: NextRequest) {
  try {
    // Rate-limit en premier — endpoint public, même logique anti-abus
    // que `/api/kyc/sign-public`.
    const rl = await enforceRateLimit(req, RATE_LIMITS.KYC_SUBMIT_PUBLIC)
    if (!rl.allowed) return rl.response

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Body JSON invalide' },
        { status: 400 },
      )
    }

    const {
      token,
      proposed_data,
      signer_name,
      completion_rate,
      missing_fields,
      consent_accuracy,
      consent_incomplete,
    } = body as {
      token?: unknown
      proposed_data?: unknown
      signer_name?: unknown
      completion_rate?: unknown
      missing_fields?: unknown
      consent_accuracy?: unknown
      consent_incomplete?: unknown
    }

    // --- validations route (la RPC revalide derrière) -----------------
    if (typeof token !== 'string' || token.length < 16) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
    }
    if (
      !proposed_data ||
      typeof proposed_data !== 'object' ||
      Array.isArray(proposed_data)
    ) {
      return NextResponse.json(
        { error: 'proposed_data doit être un objet JSON' },
        { status: 400 },
      )
    }
    if (typeof signer_name !== 'string' || signer_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nom du signataire requis' },
        { status: 400 },
      )
    }
    if (
      typeof completion_rate !== 'number' ||
      !Number.isFinite(completion_rate) ||
      completion_rate < 0 ||
      completion_rate > 100
    ) {
      return NextResponse.json(
        { error: 'completion_rate doit être un nombre entre 0 et 100' },
        { status: 400 },
      )
    }
    if (!Array.isArray(missing_fields)) {
      return NextResponse.json(
        { error: 'missing_fields doit être un tableau' },
        { status: 400 },
      )
    }
    if (consent_accuracy !== true) {
      return NextResponse.json(
        { error: 'Consentement d\'exactitude requis' },
        { status: 400 },
      )
    }

    // --- IP (même logique que /api/kyc/sign-public) -------------------
    const forwardedFor = req.headers.get('x-forwarded-for') || ''
    const realIp = req.headers.get('x-real-ip') || ''
    const ip =
      forwardedFor.split(',')[0]?.trim() || realIp.trim() || null

    // --- RPC ----------------------------------------------------------
    const supabase = await createClient()
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      'kyc_submit_proposition_by_token' as never,
      {
        p_token: token,
        p_proposed_data: proposed_data as never,
        p_signer_name: signer_name.trim(),
        p_completion_rate: Math.round(completion_rate),
        p_missing_fields: missing_fields as never,
        p_consent_incomplete: consent_incomplete === true,
        p_consent_accuracy: consent_accuracy === true,
        p_signer_ip: ip,
      } as never,
    )

    if (rpcErr) {
      // Map "already exists" → 409 Conflict, reste → 400 Bad Request.
      // Message anglais remonté par la RPC tel quel : "A pending
      // proposition already exists for this client".
      console.error('[kyc/submit-public] rpc error:', rpcErr.message)
      const isConflict = /already\s+exists|pending\s+proposition/i.test(
        rpcErr.message,
      )
      return NextResponse.json(
        { error: rpcErr.message },
        { status: isConflict ? 409 : 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      ...(rpcData && typeof rpcData === 'object'
        ? (rpcData as Record<string, unknown>)
        : {}),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[kyc/submit-public] unexpected:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
