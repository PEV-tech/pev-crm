/**
 * /api/healthcheck — endpoint d'uptime monitoring.
 *
 * Usage :
 *   - GitHub Actions workflow (.github/workflows/uptime.yml) le ping toutes
 *     les 5 minutes et ouvre une issue GitHub automatique si la réponse ≠ 200.
 *   - Accessible en anonyme (middleware matcher exclut `/api/*` de l'auth).
 *
 * Réponses :
 *   - 200 `{ status: 'ok', db: 'ok'|'unchecked', timestamp }` — site up, DB OK.
 *   - 503 `{ status: 'down', db: 'error', error, timestamp }` — DB injoignable.
 *
 * On ping `consultants` avec le service role (bypass RLS, lecture triviale).
 * C'est volontairement minimal : pas de count(*), juste un `limit(1)` pour
 * valider env vars + réseau Supabase + Postgres vivant, sans charger la base.
 *
 * Quand SUPABASE_SERVICE_ROLE_KEY n'est pas défini (ex. preview sans secret),
 * on renvoie quand même 200 avec `db: 'unchecked'` — le site Next tourne,
 * c'est la seule chose que le monitoring peut affirmer depuis l'extérieur.
 */

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Force dynamic : pas de cache statique, on veut toujours vérifier l'état courant.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const timestamp = new Date().toISOString()

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json(
      { status: 'ok', db: 'unchecked', timestamp },
      { status: 200 },
    )
  }

  try {
    const { error } = await admin
      .from('consultants')
      .select('id')
      .limit(1)

    if (error) {
      return NextResponse.json(
        {
          status: 'down',
          db: 'error',
          error: error.message,
          timestamp,
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { status: 'ok', db: 'ok', timestamp },
      { status: 200 },
    )
  } catch (err: unknown) {
    return NextResponse.json(
      {
        status: 'down',
        db: 'error',
        error: err instanceof Error ? err.message : String(err),
        timestamp,
      },
      { status: 503 },
    )
  }
}
