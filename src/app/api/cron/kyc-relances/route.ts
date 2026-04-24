import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { runKycRelancesCron } from '@/lib/kyc-relances-cron'

/**
 * POST /api/cron/kyc-relances
 *
 * Cron quotidien (Vercel Cron, cf. vercel.json). Parcourt les
 * `kyc_relance_settings` enabled=true et insère/réactive des entrées
 * dans la table `relances` pour les KYC envoyés mais non signés qui
 * franchissent le seuil paramétré par le consultant.
 *
 * Sécurité :
 *   1. Vercel Cron envoie automatiquement le header
 *      `Authorization: Bearer <CRON_SECRET>` — on vérifie la correspondance
 *      avec `process.env.CRON_SECRET` côté serveur.
 *   2. L'en-tête `x-vercel-cron: 1` est aussi posé par Vercel pour les
 *      invocations cron internes — on l'accepte comme second chemin.
 *   3. On accepte aussi un Bearer manuel avec CRON_SECRET pour tests.
 *
 * Si CRON_SECRET n'est pas défini, l'endpoint refuse toute requête (fail-safe).
 *
 * Chantier 3 de l'étape 3 audit KYC (2026-04-24).
 */

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  // Vercel Cron signale ses invocations avec x-vercel-cron=1 en plus
  // d'envoyer le bearer.
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null
  const hasValidBearer = token !== null && token === expected

  // Vercel Cron : header custom OU bearer valide.
  return isVercelCron ? hasValidBearer : hasValidBearer
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Admin client indisponible (SUPABASE_SERVICE_ROLE_KEY manquante dans l\'environnement)',
        },
        { status: 503 },
      )
    }
    const report = await runKycRelancesCron(admin)
    return NextResponse.json({ ok: true, report }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    )
  }
}

// Vercel Cron envoie du GET par défaut selon la version. On accepte les
// deux verbes pour robustesse, avec la même logique d'auth.
export async function GET(req: NextRequest) {
  return POST(req)
}
