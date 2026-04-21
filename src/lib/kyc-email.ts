/**
 * kyc-email.ts — Notifications email post-signature KYC (consultant + client).
 *
 * Contexte Batch B (2026-04-21) : Maxine veut que le consultant soit prévenu
 * AU MOMENT où un client signe son KYC — peu importe que la signature soit
 * complète ou incomplète. Les signatures incomplètes déclenchaient déjà un
 * bandeau in-app (Batch antérieur) mais il manquait la notif push.
 *
 * Retour #2 (2026-04-21 post-test) : Maxine a constaté que le PDF ne
 * partait pas vers le CLIENT. `sendKycSignedNotification` n'envoyait
 * qu'au consultant. On ajoute `sendKycSignedNotificationToClient` avec
 * un template différent (ton accueil client, pas d'URL dashboard interne)
 * et on expose un helper groupé `sendKycSignedNotifications` qui fait les
 * deux en parallèle.
 *
 * Migration 2026-04-21 : abandon de Resend au profit de Google Workspace
 * SMTP (voir `src/lib/email-transport.ts` pour les détails). Le domaine
 * `private-equity-valley.com` est hébergé chez IONOS en DNS payant, donc
 * impossible de valider le DKIM/SPF/DMARC requis par Resend. Google
 * Workspace est déjà configuré sur le domaine (MX aspmx.l.google.com) et
 * gère l'authentification sortante sans modif DNS supplémentaire.
 *
 * Approche :
 *   · Transport : helper `sendEmail()` du module `email-transport.ts`
 *     (Nodemailer + smtp.gmail.com:465 avec app password Google).
 *   · Résolution destinataire consultant : clients.consultant_id →
 *     consultants.auth_user_id → admin.auth.admin.getUserById(...).
 *   · Résolution destinataire client : clients.email (champ direct de la
 *     fiche client). Si l'email client est absent, on skip proprement.
 *   · Pièce jointe : si on a les bytes du PDF (passés en paramètre par la
 *     route post-génération), on attache directement. Sinon on envoie un
 *     lien vers `/api/kyc/pdf/[clientId]` (consultant auth sera vérifiée).
 *   · `from:` : défaut calculé depuis GOOGLE_SMTP_USER ; override via
 *     GOOGLE_SMTP_FROM. Google Workspace impose que l'expéditeur soit le
 *     compte authentifié ou un alias déclaré, sinon le From est réécrit.
 *
 * Dégradation gracieuse :
 *   · Pas de credentials SMTP → `skipped: 'no-api-key'` (log warning).
 *   · Pas d'email consultant/client → `skipped: 'no-*-email'`.
 *   · Erreur SMTP → `error` propagé mais la route appelante renvoie quand
 *     même {ok:true} — la signature reste valide en DB.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  loadConsultantEmailTemplate,
  substituteVars,
  wrapBodyInPevShell,
  titleForTemplateKey,
  type EmailTemplateVariables,
} from '@/lib/kyc-email-templates'
import {
  sendEmail,
  defaultFromAddress,
  hasCredentials,
} from '@/lib/email-transport'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://pev-crm.vercel.app'

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
    | 'no-client-email'
  error?: string
}

export interface KycEmailBatchResult {
  consultant: KycEmailResult
  client: KycEmailResult
}

export async function sendKycSignedNotification(
  ctx: KycEmailContext
): Promise<KycEmailResult> {
  if (!hasCredentials()) {
    console.warn(
      '[kyc-email] GOOGLE_SMTP_USER/PASSWORD manquant — notification consultant non envoyée'
    )
    return { sent: false, skipped: 'no-api-key' }
  }

  // 1. Lookup client + consultant
  const { data: client, error: readErr } = await ctx.admin
    .from('clients')
    .select('id, nom, prenom, raison_sociale, type_personne, consultant_id, email')
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

  const fichePath = `/dashboard/clients/${ctx.clientId}`
  const ficheUrl = `${APP_URL}${fichePath}`
  const pdfDownloadUrl = `${APP_URL}/api/kyc/pdf/${ctx.clientId}`
  const signedAtStr = ctx.signedAt.toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  // Retour #1 (2026-04-21) : chaque consultant peut personnaliser son
  // template. On tente de charger un template custom ; sinon on retombe
  // sur le template hardcodé historique (buildEmailContent).
  const customTpl = await loadConsultantEmailTemplate(
    ctx.admin,
    consultant.id,
    'kyc_signed_consultant',
  )

  let subject: string
  let html: string
  let text: string

  if (customTpl) {
    const vars: EmailTemplateVariables = {
      clientLabel,
      clientFirstName:
        client.type_personne === 'morale' ? '' : client.prenom || '',
      signerName: ctx.signerName,
      signedAtStr,
      completionRate: ctx.completionRate,
      missingFields: ctx.missingFields.length
        ? ctx.missingFields.join(', ')
        : '—',
      consultantPrenom: consultant.prenom || '',
    }
    subject = substituteVars(customTpl.subject, vars)
    text = substituteVars(customTpl.bodyText, vars)
    html = wrapBodyInPevShell({
      title: titleForTemplateKey('kyc_signed_consultant', ctx.isIncomplete),
      bodyText: text,
      footer: 'Email automatique PEV CRM — ne pas répondre.',
    })
  } else {
    subject = ctx.isIncomplete
      ? `[KYC] Signature INCOMPLÈTE (${ctx.completionRate}%) — ${clientLabel}`
      : `[KYC] Signature complète — ${clientLabel}`
    const built = buildEmailContent({
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
    html = built.html
    text = built.text
  }

  // 3. Send via Google Workspace SMTP (Nodemailer helper)
  const from = defaultFromAddress()
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

  const result = await sendEmail({
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

// =====================================================
// Retour #2 — notification au CLIENT (destinataire signataire)
// =====================================================

/**
 * Envoie au CLIENT (adresse stockée sur `clients.email`) un email de
 * confirmation avec le PDF signé en pièce jointe. Template distinct du
 * template consultant : ton accueil, pas d'URL dashboard interne, pas
 * de détails opérationnels (champs manquants affichés comme liste courte
 * si signature incomplète, pour que le client sache ce qu'il reste à
 * compléter).
 */
export async function sendKycSignedNotificationToClient(
  ctx: KycEmailContext,
): Promise<KycEmailResult> {
  if (!hasCredentials()) {
    return { sent: false, skipped: 'no-api-key' }
  }

  const { data: client, error: readErr } = await ctx.admin
    .from('clients')
    .select('id, nom, prenom, raison_sociale, type_personne, email, consultant_id')
    .eq('id', ctx.clientId)
    .maybeSingle()

  if (readErr || !client) {
    return { sent: false, skipped: 'no-client', error: readErr?.message }
  }

  const clientEmail = (client.email || '').trim()
  if (!clientEmail) {
    return { sent: false, skipped: 'no-client-email' }
  }

  const clientLabel =
    client.type_personne === 'morale'
      ? client.raison_sociale || client.nom
      : `${client.prenom || ''} ${client.nom}`.trim() || client.nom

  const signedAtStr = ctx.signedAt.toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  // Retour #1 (2026-04-21) : template client personnalisable par le
  // consultant qui suit ce client. On résout le prénom consultant pour
  // le rendre disponible comme variable aussi sur l'email client.
  let consultantPrenom = ''
  let customTpl: Awaited<
    ReturnType<typeof loadConsultantEmailTemplate>
  > = null
  if (client.consultant_id) {
    const { data: cons } = await ctx.admin
      .from('consultants')
      .select('prenom')
      .eq('id', client.consultant_id)
      .maybeSingle()
    consultantPrenom = (cons?.prenom as string) || ''
    customTpl = await loadConsultantEmailTemplate(
      ctx.admin,
      client.consultant_id,
      'kyc_signed_client',
    )
  }

  let subjectStr: string
  let html: string
  let text: string

  if (customTpl) {
    const vars: EmailTemplateVariables = {
      clientLabel,
      clientFirstName:
        client.type_personne === 'morale' ? '' : client.prenom || '',
      signerName: ctx.signerName,
      signedAtStr,
      completionRate: ctx.completionRate,
      missingFields: ctx.missingFields.length
        ? ctx.missingFields.join(', ')
        : '—',
      consultantPrenom,
    }
    subjectStr = substituteVars(customTpl.subject, vars)
    text = substituteVars(customTpl.bodyText, vars)
    html = wrapBodyInPevShell({
      title: titleForTemplateKey('kyc_signed_client', ctx.isIncomplete),
      bodyText: text,
      footer:
        'Pour toute question, répondez simplement à cet email ou contactez votre conseiller habituel.',
    })
  } else {
    subjectStr = ctx.isIncomplete
      ? 'Votre dossier KYC signé (à compléter) — Private Equity Valley'
      : 'Votre dossier KYC signé — Private Equity Valley'
    const built = buildClientEmailContent({
      clientLabel,
      firstName: client.type_personne === 'morale' ? '' : client.prenom || '',
      signerName: ctx.signerName,
      signedAtStr,
      completionRate: ctx.completionRate,
      missingFields: ctx.missingFields,
      isIncomplete: ctx.isIncomplete,
      hasAttachedPdf: !!ctx.pdfBytes,
    })
    html = built.html
    text = built.text
  }

  const from = defaultFromAddress()
  const attachments: Array<{ filename: string; content: Buffer }> = []
  if (ctx.pdfBytes) {
    attachments.push({
      filename: `KYC-${(clientLabel || 'client').replace(/\s+/g, '_')}-signe.pdf`,
      content: Buffer.from(ctx.pdfBytes),
    })
  }

  const result = await sendEmail({
    from,
    to: clientEmail,
    subject: subjectStr,
    html,
    text,
    attachments: attachments.length ? attachments : undefined,
  })
  if (result.error) {
    return { sent: false, error: result.error.message }
  }
  return { sent: true, messageId: result.data?.id }
}

/**
 * Helper groupé : envoie en parallèle la notif consultant ET la notif
 * client. Ne jette jamais, renvoie les deux résultats séparément pour
 * que la route appelante puisse les remonter côté UI (retour #7 : le
 * diff-viewer affiche quelle destination a réussi / échoué).
 */
export async function sendKycSignedNotifications(
  ctx: KycEmailContext,
): Promise<KycEmailBatchResult> {
  const [consultantRes, clientRes] = await Promise.all([
    sendKycSignedNotification(ctx).catch((e: unknown) => ({
      sent: false,
      error: e instanceof Error ? e.message : String(e),
    })),
    sendKycSignedNotificationToClient(ctx).catch((e: unknown) => ({
      sent: false,
      error: e instanceof Error ? e.message : String(e),
    })),
  ])
  return {
    consultant: consultantRes as KycEmailResult,
    client: clientRes as KycEmailResult,
  }
}

// =====================================================
// Template HTML/text pour le CLIENT
// =====================================================

interface ClientEmailArgs {
  clientLabel: string
  firstName: string
  signerName: string
  signedAtStr: string
  completionRate: number
  missingFields: string[]
  isIncomplete: boolean
  hasAttachedPdf: boolean
}

function buildClientEmailContent(a: ClientEmailArgs): {
  html: string
  text: string
} {
  const greeting = a.firstName
    ? `Bonjour ${escapeHtml(a.firstName)},`
    : `Bonjour ${escapeHtml(a.clientLabel)},`

  const confirm = a.isIncomplete
    ? `Nous avons bien reçu votre dossier KYC signé. Il est complété à <strong>${a.completionRate}%</strong> — vous avez accepté de le finaliser ultérieurement.`
    : `Nous avons bien reçu votre dossier KYC signé en totalité. Merci pour le temps que vous y avez consacré.`

  const missingBlock =
    a.isIncomplete && a.missingFields.length
      ? `<p style="margin-top:8px;"><strong>Informations encore à compléter :</strong></p><ul>${a.missingFields
          .map((f) => `<li>${escapeHtml(f)}</li>`)
          .join('')}</ul>`
      : ''

  const pdfNote = a.hasAttachedPdf
    ? `Votre dossier signé est joint à cet email en format PDF. Vous pouvez le conserver pour vos archives personnelles.`
    : `Votre conseiller vous transmettra sous peu la copie PDF de votre dossier signé.`

  const html = `<!doctype html>
<html lang="fr"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#1e293b; max-width:640px; margin:0 auto; padding:24px;">
  <div style="border-top:4px solid #243f6f; padding-top:16px;">
    <h2 style="color:#243f6f; margin:0 0 8px 0;">Votre dossier KYC a bien été signé</h2>
    <p style="margin:0 0 16px 0; color:#64748b; font-size:14px;">Private Equity Valley</p>
  </div>
  <p>${greeting}</p>
  <p>${confirm}</p>
  <table style="border-collapse:collapse; margin:16px 0; font-size:14px;">
    <tr><td style="padding:4px 16px 4px 0; color:#64748b;">Signé par</td><td style="padding:4px 0;"><strong>${escapeHtml(a.signerName)}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0; color:#64748b;">Date</td><td style="padding:4px 0;">${escapeHtml(a.signedAtStr)}</td></tr>
  </table>
  ${missingBlock}
  <p>${pdfNote}</p>
  <p style="color:#64748b; font-size:12px; margin-top:32px;">Pour toute question, répondez simplement à cet email ou contactez votre conseiller habituel.</p>
  <p style="color:#64748b; font-size:12px;">— L'équipe Private Equity Valley</p>
</body></html>`

  const text = `${greeting}

${a.isIncomplete
    ? `Nous avons bien reçu votre dossier KYC signé. Il est complété à ${a.completionRate}% — vous avez accepté de le finaliser ultérieurement.`
    : `Nous avons bien reçu votre dossier KYC signé en totalité. Merci pour le temps que vous y avez consacré.`}

Signé par : ${a.signerName}
Date      : ${a.signedAtStr}
${a.isIncomplete && a.missingFields.length
    ? `\nInformations encore à compléter :\n${a.missingFields.map((f) => `  - ${f}`).join('\n')}\n`
    : ''}
${a.hasAttachedPdf
    ? 'Votre dossier signé est joint à cet email en format PDF.'
    : 'Votre conseiller vous transmettra sous peu la copie PDF.'}

Pour toute question, contactez votre conseiller habituel.

— L'équipe Private Equity Valley`

  return { html, text }
}
