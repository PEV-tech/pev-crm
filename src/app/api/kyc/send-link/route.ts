import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { sendKycEnvoiLien } from '@/lib/kyc-email'

/**
 * POST /api/kyc/send-link
 *
 * Chantier 5 étape 3 audit KYC (2026-04-24). Déclenche l'envoi automatique
 * du lien KYC au client par email depuis le CRM, via le transport Gmail
 * API (voir email-transport.ts). Alternative au flow historique
 * « génère le lien + ouvre Gmail compose » qui reste disponible via
 * `/api/kyc/generate-link`.
 *
 * Flow :
 *   1. Auth consultant via cookies Supabase.
 *   2. Rate-limit partagé avec /generate-link (20/min).
 *   3. Vérifie que le client est bien rattaché au consultant courant
 *      (ou que le user est manager/back_office — géré par la RPC
 *      SECURITY DEFINER `kyc_generate_token`).
 *   4. RPC `kyc_generate_token` : crée ou renouvelle le token et renvoie
 *      sa valeur.
 *   5. Construit l'URL publique `/kyc/[token]`.
 *   6. `sendKycEnvoiLien()` charge le template `kyc_envoi_lien`
 *      personnalisé du consultant (fallback DEFAULT_TEMPLATES), substitue
 *      les variables Mustache, envoie via Gmail API.
 *   7. Marque `kyc_sent_at` via RPC `kyc_mark_sent` (idempotent).
 *
 * Body JSON  : { client_id: string (uuid) }
 * Réponse OK : { ok:true, token, url, recipient_email, email:{ sent, messageId|error } }
 * Réponses d'erreur : 400 (body), 401 (auth), 404 (client), 500 (RPC ou envoi fatal).
 *
 * Si l'envoi email échoue (ex: transport non configuré), on renvoie
 * quand même 200 avec `email.sent=false` + raison — le token a été
 * généré, le consultant peut tomber sur le mode manuel Gmail compose
 * via /generate-link si besoin.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit(req, RATE_LIMITS.KYC_GENERATE_LINK)
    if (!rl.allowed) return rl.response

    const body = await req.json().catch(() => null)
    const clientId =
      body && typeof body === 'object' && typeof (body as Record<string, unknown>).client_id === 'string'
        ? ((body as Record<string, unknown>).client_id as string)
        : null

    if (!clientId) {
      return NextResponse.json({ error: 'client_id requis' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 },
      )
    }

    // 1. Récupération du client pour valider + email destinataire.
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, email, prenom, nom, raison_sociale, type_personne')
      .eq('id', clientId)
      .maybeSingle()

    if (clientErr || !client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    if (!client.email || !client.email.trim()) {
      return NextResponse.json(
        {
          error:
            "Ce client n'a pas d'email renseigné — ajoutez-en un sur sa fiche avant d'envoyer automatiquement le lien.",
        },
        { status: 400 },
      )
    }

    // 2. Génération du token KYC via RPC (crée ou renouvelle).
    const { data: token, error: rpcErr } = await supabase.rpc(
      'kyc_generate_token' as never,
      { p_client_id: clientId } as never,
    )
    if (rpcErr || !token || typeof token !== 'string') {
      console.error('[kyc/send-link] kyc_generate_token error:', rpcErr?.message)
      return NextResponse.json(
        { error: rpcErr?.message || 'Échec de la génération du token' },
        { status: 500 },
      )
    }

    // 3. URL publique vers le portail.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`
    const portailUrl = `${baseUrl.replace(/\/$/, '')}/kyc/${token}`

    // 4. Envoi email via Gmail API (fallback SMTP si refresh_token absent).
    // On utilise le client admin pour laisser sendKycEnvoiLien lookup le
    // template custom du consultant (nécessite bypass RLS sur
    // consultant_email_templates sans la session authentifiée du
    // consultant — idem que le flow post-signature).
    const admin = getAdminClient()
    if (!admin) {
      // Token généré mais envoi auto indisponible — on renvoie ok=true
      // quand même, le consultant peut passer par /generate-link manuel.
      return NextResponse.json({
        ok: true,
        token,
        url: portailUrl,
        recipient_email: client.email,
        email: {
          sent: false,
          error:
            "Admin client indisponible (SUPABASE_SERVICE_ROLE_KEY manquante). Utilisez le bouton 'Gmail compose' pour envoyer manuellement.",
        },
      })
    }

    const emailResult = await sendKycEnvoiLien({
      admin,
      clientId,
      portailUrl,
    })

    // 5. Mark-sent quand l'email est parti (idempotent côté RPC).
    if (emailResult.sent) {
      const { error: markErr } = await supabase.rpc(
        'kyc_mark_sent' as never,
        { p_client_id: clientId } as never,
      )
      if (markErr) {
        // Email parti mais mark-sent KO : on log, pas critique (le
        // consultant peut retrier ; le compteur `kyc_relances_count`
        // fonctionne indépendamment).
        console.warn(
          '[kyc/send-link] kyc_mark_sent failed (non-fatal):',
          markErr.message,
        )
      }
    }

    return NextResponse.json({
      ok: true,
      token,
      url: portailUrl,
      recipient_email: client.email,
      email: emailResult.sent
        ? { sent: true, messageId: emailResult.messageId }
        : {
            sent: false,
            skipped: emailResult.skipped,
            error: emailResult.error,
          },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[kyc/send-link] unexpected:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
