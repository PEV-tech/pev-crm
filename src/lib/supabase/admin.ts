import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Admin Supabase client — utilise la service_role key.
 *
 * ⚠️  À n'utiliser QUE côté serveur (API routes), jamais dans un Client
 * Component ou un bundle qui fuite au browser. La service_role bypass
 * toute RLS.
 *
 * Use-cases actuels :
 *   - /api/kyc/sign-public/route.ts : upload PDF KYC dans bucket privé
 *     après signature (l'appelant est non-authentifié, impossible d'utiliser
 *     le client anon + RLS pour écrire dans storage).
 *   - /api/kyc/pdf/[clientId]/route.ts : génération de signed URL pour
 *     téléchargement côté consultant (pourrait aussi se faire en
 *     authenticated, mais on centralise pour simplifier les policies).
 *
 * Fallback : si SUPABASE_SERVICE_ROLE_KEY n'est pas défini, `getAdminClient`
 * renvoie `null`. Les routes qui l'utilisent doivent dégrader gracieusement
 * (ex : signature OK sans PDF, avec log warning) plutôt que crasher.
 */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
