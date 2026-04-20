import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
 *   200 { ok: true } si OK
 *   400 / 500 avec `{ error }` sinon (message remonté depuis la RPC)
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

    const { error: rpcErr } = await supabase.rpc(
      'kyc_sign_by_token' as never,
      {
        p_token: token,
        p_signer_name: signer_name.trim(),
        p_completion_rate: Math.round(completion_rate),
        p_missing_fields: missing_fields as never,
        p_consent_incomplete: consent_incomplete === true,
        p_consent_accuracy: consent_accuracy === true,
        p_signer_ip: ip,
      } as never
    )

    if (rpcErr) {
      // Les erreurs métier (KYC déjà signé, consentement manquant) remontent
      // en texte lisible — on les renvoie telles quelles pour affichage UI.
      console.error('[kyc/sign-public] rpc error:', rpcErr.message)
      return NextResponse.json({ error: rpcErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[kyc/sign-public] unexpected:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
