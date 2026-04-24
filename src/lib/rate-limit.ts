import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Rate-limit stateful via Supabase (RPC `check_rate_limit`).
 *
 * Pourquoi pas en in-memory / lru-cache :
 *   Les Vercel serverless functions scale-out horizontalement et chaque
 *   instance démarre avec un cache vide. Un Map ou un LRU local ne se
 *   partage donc pas, et un attaquant qui tombe sur une instance fraîche
 *   bypasse le limit. On pousse la comptabilité dans Postgres (via la
 *   table `rate_limit_hits` + RPC SECURITY DEFINER) → fenêtre glissante
 *   cohérente sur toutes les instances.
 *
 * Usage type dans une route :
 *
 *   const rl = await enforceRateLimit(req, RATE_LIMITS.KYC_SIGN_PUBLIC)
 *   if (!rl.allowed) return rl.response
 *
 * Le helper FAIL-OPEN en cas d'erreur infra (RPC KO, DB indispo) :
 * on log un warning et on laisse passer. Le but est de se protéger des
 * attaques par volume, pas d'ajouter un SPOF sur Supabase.
 *
 * Identifier : IP client (x-forwarded-for en premier, x-real-ip en
 * fallback, "unknown" en dernier recours). Pour les endpoints
 * consultants authentifiés, IP par session reste pertinent — on ne
 * croise pas par user_id pour V1 (simplicité > granularité, les
 * consultants sont peu nombreux et sur IPs stables).
 */

export type RateLimitPreset = {
  /** Nom du bucket (scope). Doit être stable et unique par endpoint. */
  bucket: string
  /** Nombre max de hits autorisés dans la fenêtre. */
  maxHits: number
  /** Durée de la fenêtre en secondes. */
  windowSeconds: number
}

/**
 * Presets par endpoint. Ajuster les valeurs ici — pas dans les routes —
 * pour garder le tuning centralisé.
 *
 * Heuristique V1 :
 *   · Endpoints publics (non auth)  → 5-10 hits / 5 min (anti-brute force).
 *   · Endpoints consultants auth    → 20 hits / 1 min (usage normal).
 *   · Endpoints coûteux (parse PDF) → 10 hits / 5 min (anti-abus CPU).
 */
export const RATE_LIMITS = {
  KYC_SIGN_PUBLIC: {
    bucket: 'kyc-sign-public',
    maxHits: 5,
    windowSeconds: 300,
  },
  KYC_SUBMIT_PUBLIC: {
    bucket: 'kyc-submit-public',
    maxHits: 10,
    windowSeconds: 300,
  },
  KYC_GENERATE_LINK: {
    bucket: 'kyc-generate-link',
    maxHits: 20,
    windowSeconds: 60,
  },
  // Preset PARSE_KYC retiré 2026-04-24 — fonction "Importer un KYC" supprimée (point 1.8).
} as const satisfies Record<string, RateLimitPreset>

export type RateLimitResult =
  | { allowed: true; remaining: number; limit: number; resetAt: string | null }
  | { allowed: false; response: NextResponse }

type CheckRateLimitRpcResponse = {
  allowed: boolean
  count: number
  limit: number
  reset_at: string
}

/**
 * Extrait l'IP client d'une requête Next.js / Vercel.
 * Exporté pour pouvoir composer un identifier custom (ex: "ip:userId")
 * depuis une route si besoin, mais par défaut `enforceRateLimit` l'utilise
 * en interne.
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || ''
  const firstForwarded = xff.split(',')[0]?.trim()
  if (firstForwarded) return firstForwarded
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}

/**
 * Applique le rate-limit à une requête. Retourne soit `{ allowed: true }`
 * avec les metadata, soit `{ allowed: false, response }` où `response`
 * est une NextResponse 429 prête à être renvoyée par la route.
 *
 * Paramètre `identifier` optionnel : par défaut l'IP client. Passer un
 * user_id ou un token si on veut rate-limit par identité plutôt que par
 * IP (ex: un consultant derrière un NAT partagé).
 */
export async function enforceRateLimit(
  req: NextRequest,
  preset: RateLimitPreset,
  identifier?: string
): Promise<RateLimitResult> {
  const id = identifier ?? getClientIp(req)

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
      'check_rate_limit' as never,
      {
        p_bucket: preset.bucket,
        p_identifier: id,
        p_max_hits: preset.maxHits,
        p_window_seconds: preset.windowSeconds,
      } as never
    )

    if (error) {
      // Fail-open : on ne veut pas casser la route si la DB a un hoquet.
      console.warn(
        `[rate-limit] RPC error on bucket=${preset.bucket} id=${id}: ${error.message}`
      )
      return {
        allowed: true,
        remaining: preset.maxHits,
        limit: preset.maxHits,
        resetAt: null,
      }
    }

    const result = data as unknown as CheckRateLimitRpcResponse | null
    if (!result || typeof result !== 'object') {
      console.warn(
        `[rate-limit] RPC returned unexpected shape on bucket=${preset.bucket}`
      )
      return {
        allowed: true,
        remaining: preset.maxHits,
        limit: preset.maxHits,
        resetAt: null,
      }
    }

    const remaining = Math.max(0, result.limit - result.count)
    const resetAt = result.reset_at ?? null

    if (!result.allowed) {
      // 429 Too Many Requests avec headers standards. Le client peut
      // lire `Retry-After` et `X-RateLimit-Reset` pour se synchroniser.
      const retryAfterSec = resetAt
        ? Math.max(
            1,
            Math.ceil(
              (new Date(resetAt).getTime() - Date.now()) / 1000
            )
          )
        : preset.windowSeconds

      const response = NextResponse.json(
        {
          error: 'Trop de requêtes. Merci de patienter avant de réessayer.',
          retry_after_seconds: retryAfterSec,
        },
        { status: 429 }
      )
      response.headers.set('Retry-After', String(retryAfterSec))
      response.headers.set('X-RateLimit-Limit', String(result.limit))
      response.headers.set('X-RateLimit-Remaining', '0')
      if (resetAt) response.headers.set('X-RateLimit-Reset', resetAt)

      console.warn(
        `[rate-limit] blocked bucket=${preset.bucket} id=${id} count=${result.count}/${result.limit}`
      )

      return { allowed: false, response }
    }

    return {
      allowed: true,
      remaining,
      limit: result.limit,
      resetAt,
    }
  } catch (err) {
    // Fail-open également sur exception inattendue.
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(
      `[rate-limit] unexpected error on bucket=${preset.bucket} id=${id}: ${msg}`
    )
    return {
      allowed: true,
      remaining: preset.maxHits,
      limit: preset.maxHits,
      resetAt: null,
    }
  }
}
