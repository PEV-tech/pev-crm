/**
 * kyc-email.ts — Notification email au consultant lors d'une signature KYC.
 *
 * Contexte Batch B (2026-04-21) : Maxine veut que le consultant soit prévenu
 * AU MOMENT où un client signe son KYC — peu importe que la signature soit
 * complète ou incomplète. Les signatures incomplètes déclenchaient déjà un
 * bandeau in-app (Batch antérieur) mais il manquait la notif push.
 *
 * Approche :
 *   · Utilise Resend (installé 2026-04-21). Clé `RESEND_API_KEY` côté server.
 *   · Résolution destinataire : clients.consultant_id → consultants.auth_user_id
 *     → admin.auth.admin.getUserById(...) → users.email. Nécessite le client
 *     admin (service_role) pour lire la table auth.
 *   · Pièce jointe : si on a les bytes du PDF (passés en paramètre par la
 *     route post-génération), on attache directement. Sinon on envoie un
 *     lien vers `/api/kyc/pdf/[clientId]` (consultant auth sera vérifiée).
 *   · Le `from:` est configurable via RESEND_FROM (défaut :
 *     'PEV KYC <kyc@private-equity-valley.com>'). Maxine pourra changer
 *     l'adresse d'envoi sans redéploiement de code.
 *
 * Dégradation gracieuse :
 *   · Pas de clé → `skipped: 'no-api-key'` (log warning).
 *   · Pas d'email consultant → `skipped: 'no-consultant-email'`.
 *   · Erreur Resend → `error` propagé mais la route appelante renvoie quand
 *     même {ok:true} — la signature reste valide.
 */

import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://pev-crm.vercel.app'

const DEFAULT_FROM = 'PEV KYC <kyc@private-equity-valley.com>'

export interface KycEmailContext {
  admin: SupabaseClient<Database>
  clientId: string
  signerName: string
  signedAt: Date
  completionRate: number
  missingFields: string[]
  isIncomplete: boolean
  /** Optionnel : bytes PDF pour pièce jointe directe (sinon, lien). */
  pdfBytes?: Uint8Array | null
  pdfPath?: string | null
}

export interface KycEmailResult {
  sent: boolean
  messageId?: string
  skipped?:
    | 'no-api-key'
    | 'no-consultant'
    | 'no-consultant-email'
    | 'no-client'
  error?: string
}

export async function sendKycSignedNotification(
  ctx: KycEmailContext
): Promise<KycEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn(
      '[kyc-email] RESEND_API_KEY manquant — notification consultant non envoyée'
    )
    return { sent: false, skipped: 'no-api-key' }
  }

  // 1. Lookup client + consultant
  const { data: client, error: readErr } = await ctx.admin
    .from('clients')
    .select('id, nom, prenom, raison_sociale, type_personne, consultant_id')
    .eq('id', ctx.clientId)
    .maybeSingle()

  if (readErr || !client) {
    return {
      sent: false,
      skipped: 'no-client',
      error: readErr?.message,
    }
  }

  if (!client.consultant_id) {
    return { sent: false, skipped: 'no-consultant' }
  }

  const { data: consultant, error: consErr } = await ctx.admin
    .from('consultants')
    .select('id, nom, prenom, auth_user_id')
    .eq('id', client.consultant_id)
    .maybeSingle()

  if (consErr || !consultant || !consultant.auth_user_id) {
    return { sent: false, skipped: 'no-consultant' }
  }

  const { data: authResp, error: authErr } =
    await ctx.admin.auth.admin.getUserById(consultant.auth_user_id)

  const consultantEmail = authResp?.user?.email
  if (authErr || !consultantEmail) {
    return {
      sent: false,
      skipped: 'no-consultant-email',
      error: authErr?.message,
    }
  }

  // 2. Build subject + body
  const clientLabel =
    client.type_personne === 'morale'
      ? client.raison_sociale || client.nom
      : `${client.prenom || ''} ${client.nom}`.trim() || client.nom

  const subject = ctx.isIncomplete
    ? `[KYC] Signature INCOMPLÈTE (${ctx.completionRate}%) — ${clientLabel}`
    : `[KYC] Signature complète — ${clientLabel}`

  const fichePath = `/dashboard/clients/${ctx.clientId}`
  const ficheUrl = `${APP_URL}${fichePath}`
  const pdfDownloadUrl = `${APP_URL}/api/kyc/pdf/${ctx.clientId}`
  const signedAtStr = ctx.signedAt.toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const { html, text } = buildEmailContent({
    clientLabel,
    consultantPrenom: consultant.prenom || '',
    signerName: ctx.signerName,
    signedAtStr,
    completionRate: ctx.completionRate,
    missingFields: ctx.missingFields,
    isIncomplete: ctx.isIncomplete,
    ficheUrl,
    pdfDownloadUrl,
    hasAttachedPdf: !!ctx.pdfBytes,
  })

  // 3. Send via Resend
  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM || DEFAULT_FROM
  const attachments: Array<{
    filename: string
    content: Buffer
  }> = []
  if (ctx.pdfBytes) {
    attachments.push({
      filename: `KYC-${(clientLabel || 'client').replace(/\s+/g, '_')}.pdf`,
      content: Buffer.from(ctx.pdfBytes),
    })
  }

  try {
    const result = await resend.emails.send({
      from,
      to: consultantEmail,
      subject,
      html,
      text,
      attachments: attachments.length ? attachments : undefined,
    })
    if (result.error) {
      return { sent: false, error: result.error.message }
    }
    return { sent: true, messageId: result.data?.id }
  } catch (err: unknown) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// =====================================================
// Templates HTML + text
// =====================================================

interface EmailContentArgs {
  clientLabel: string
  consultantPrenom: string
  signerName: string
  signedAtStr: string
  completionRate: number
  missingFields: string[]
  isIncomplete: boolean
  ficheUrl: string
  pdfDownloadUrl: string
  hasAttachedPdf: boolean
}

function buildEmailContent(a: EmailContentArgs): {
  html: string
  text: string
} {
  const greeting = a.consultantPrenom
    ? `Bonjour ${escapeHtml(a.consultantPrenom)},`
    : 'Bonjour,'

  const statusLine = a.isIncomplete
    ? `Le KYC a été signé avec un <strong>taux de complétude de ${a.completionRate}%</strong>. Le client a explicitement consenti à signer un dossier incomplet.`
    : `Le KYC a été signé en totalité (100%).`

  const missingBlock = a.isIncomplete && a.missingFields.length
    ? `<p><strong>Champs manquants :</strong></p><ul>${a.missingFields
        .map((f) => `<li>${escapeHtml(f)}</li>`)
        .join('')}</ul>`
    : ''

  const pdfNote = a.hasAttachedPdf
    ? `Le PDF signé est joint à cet email.`
    : `<a href="${escapeAttr(a.pdfDownloadUrl)}">Télécharger le PDF signé</a> (authentification CRM requise).`

  const html = `<!doctype html>
<html lang="fr"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#1e293b; max-width:640px; margin:0 auto; padding:24px;">
  <div style="border-top:4px solid #243f6f; padding-top:16px;">
    <h2 style="color:#243f6f; margin:0 0 8px 0;">Signature KYC ${a.isIncomplete ? '— INCOMPLÈTE' : 'reçue'}</h2>
    <p style="margin:0 0 16px 0; color:#64748b; font-size:14px;">Ethique &amp; Patrimoine — PEV CRM</p>
  </div>
  <p>${greeting}</p>
  <p>Le client <strong>${escapeHtml(a.clientLabel)}</strong> vient de signer son KYC via le portail public.</p>
  <p>${statusLine}</p>
  <table style="border-collapse:collapse; margin:16px 0; font-size:14px;">
    <tr><td style="padding:4px 16px 4px 0; color:#64748b;">Signé par</td><td style="padding:4px 0;"><strong>${escapeHtml(a.signerName)}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0; color:#64748b;">Date</td><td style="padding:4px 0;">${escapeHtml(a.signedAtStr)}</td></tr>
    <tr><td style="padding:4px 16px 4px 0; color:#64748b;">Complétude</td><td style="padding:4px 0;">${a.completionRate}%</td></tr>
  </table>
  ${missingBlock}
  <p>${pdfNote}</p>
  <p style="margin-top:24px;">
    <a href="${escapeAttr(a.ficheUrl)}" style="display:inline-block; background:#243f6f; color:#fff; padding:10px 18px; text-decoration:none; border-radius:4px;">Ouvrir la fiche client</a>
  </p>
  <p style="color:#64748b; font-size:12px; margin-top:32px;">Email automatique PEV CRM — ne pas répondre.</p>
</body></html>`

  const text = `${greeting}

Le client ${a.clientLabel} vient de signer son KYC via le portail public.

${a.isIncomplete
    ? `Complétude : ${a.completionRate}% (signature INCOMPLÈTE avec consentement explicite)`
    : `Complétude : 100%`}
Signé par : ${a.signerName}
Date      : ${a.signedAtStr}
${a.isIncomplete && a.missingFields.length ? `\nChamps manquants :\n${a.missingFields.map((f) => `  - ${f}`).join('\n')}\n` : ''}
${a.hasAttachedPdf
    ? 'Le PDF signé est joint à cet email.'
    : `Télécharger le PDF signé : ${a.pdfDownloadUrl} (authentification CRM requise)`}

Ouvrir la fiche client : ${a.ficheUrl}

— PEV CRM`

  return { html, text }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}
