/**
 * POST /api/errors — endpoint de capture d'erreurs applicatives.
 *
 * Remplace un SDK Sentry. Appelé par :
 *   - `components/error-boundary.tsx` (React ErrorBoundary global)
 *   - handlers `window.onerror` / `window.onunhandledrejection` dans le layout
 *   - middleware serveur pour wrapper les API routes (optionnel, PR suivante)
 *
 * Design :
 *   - Accessible en anonyme (middleware exclut /api/* de l'auth). On veut
 *     logger même les erreurs sur /login ou /kyc/[token] où l'utilisateur
 *     n'est pas authentifié.
 *   - Rate-limit strict (10/min/IP) — un bug qui boucle côté client pourrait
 *     saturer la table app_errors en quelques secondes.
 *   - Écrit via service role (bypass RLS). La table a RLS activée et aucune
 *     policy INSERT → seul ce endpoint peut écrire.
 *   - Pas de secrets dans les logs : on reject `extra.password`, `extra.token`,
 *     `extra.authorization` en amont (allowlist minimale pour éviter de leak).
 *
 * Graceful degradation : si SUPABASE_SERVICE_ROLE_KEY absent, on renvoie
 * 202 Accepted — le client n'a pas à savoir que le logging est offline,
 * et on évite de casser son flow avec un 500.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit } from '@/lib/rate-limit'

// Force dynamic : chaque POST doit être exécuté, jamais caché.
export const dynamic = 'force-dynamic'

// Taille max du payload pour éviter les abus (stack traces monstrueuses).
const MAX_MESSAGE_LEN = 2_000
const MAX_STACK_LEN = 20_000
const MAX_ROUTE_LEN = 500
const MAX_UA_LEN = 500
const MAX_EXTRA_BYTES = 4_000

// Clés à supprimer d'`extra` avant insertion (éviter leak de secrets).
const EXTRA_BLOCKLIST = new Set([
  'password',
  'token',
  'authorization',
  'cookie',
  'session',
  'apikey',
  'api_key',
  'secret',
])

type ErrorPayload = {
  source?: unknown
  route?: unknown
  message?: unknown
  stack?: unknown
  userAgent?: unknown
  extra?: unknown
}

function sanitizeExtra(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (EXTRA_BLOCKLIST.has(key.toLowerCase())) continue
    // On ne descend pas récursivement — les payloads doivent être plats.
    // Si une valeur est un objet, on la sérialise en string pour éviter
    // les surprises (fonctions, circulaires, etc.).
    if (value === null || value === undefined) {
      out[key] = null
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value
    } else {
      try {
        out[key] = JSON.stringify(value).slice(0, 500)
      } catch {
        out[key] = '[unserializable]'
      }
    }
  }
  // Cap total size.
  const serialized = JSON.stringify(out)
  if (serialized.length > MAX_EXTRA_BYTES) {
    return { truncated: true, size: serialized.length }
  }
  return out
}

export async function POST(request: NextRequest) {
  const rl = await enforceRateLimit(request, {
    bucket: 'api-errors',
    maxHits: 10,
    windowSeconds: 60,
  })
  if (!rl.allowed) return rl.response

  let body: ErrorPayload
  try {
    body = (await request.json()) as ErrorPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const source = body.source
  if (source !== 'client' && source !== 'server' && source !== 'api') {
    return NextResponse.json(
      { error: 'source must be client | server | api' },
      { status: 400 },
    )
  }

  const rawMessage = typeof body.message === 'string' ? body.message : ''
  if (!rawMessage.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const message = rawMessage.slice(0, MAX_MESSAGE_LEN)
  const stack =
    typeof body.stack === 'string' ? body.stack.slice(0, MAX_STACK_LEN) : null
  const route =
    typeof body.route === 'string' ? body.route.slice(0, MAX_ROUTE_LEN) : null
  const userAgent =
    typeof body.userAgent === 'string'
      ? body.userAgent.slice(0, MAX_UA_LEN)
      : request.headers.get('user-agent')?.slice(0, MAX_UA_LEN) ?? null
  const extra = sanitizeExtra(body.extra)

  const admin = getAdminClient()
  if (!admin) {
    // Pas de service role → le logging est désactivé (dev local sans .env).
    // On renvoie 202 pour ne pas casser le flow client.
    console.warn('[api/errors] SUPABASE_SERVICE_ROLE_KEY absent — skip insert')
    return NextResponse.json({ accepted: true, logged: false }, { status: 202 })
  }

  // Cast via `as never` pour les mêmes raisons que dans rate-limit.ts :
  // la table `app_errors` est ajoutée par la migration add-app-errors.sql
  // et les types TypeScript ne seront régénérés qu'après application.
  // Voir `scripts/add-app-errors.sql` pour la commande de regen.
  const { error } = await admin
    .from('app_errors' as never)
    .insert({
      source,
      route,
      message,
      stack,
      user_agent: userAgent,
      extra,
    } as never)

  if (error) {
    console.error('[api/errors] insert failed:', error.message)
    // On ne remonte pas le détail SQL au client (surface d'attaque).
    return NextResponse.json(
      { error: 'logging failed', logged: false },
      { status: 500 },
    )
  }

  return NextResponse.json({ accepted: true, logged: true }, { status: 201 })
}
