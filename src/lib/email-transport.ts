/**
 * email-transport.ts — Helper d'envoi email.
 *
 * Historique
 * ----------
 * 1. Resend (~2026-04-16) : abandonné, DNS IONOS bloquant pour DKIM/SPF.
 * 2. Google Workspace SMTP + Nodemailer (commit `5b09741` le 2026-04-21) :
 *    l'envoi échouait avec `535-5.7.8 BadCredentials` sur 2 app passwords
 *    successifs. Stack mis en pause, aucun email KYC ne sortait.
 * 3. **Gmail API + OAuth2 refresh_token (chantier 4 étape 3 audit KYC,
 *    2026-04-24)** — approche courante. L'app s'authentifie auprès de
 *    Google avec un `refresh_token` long-vie obtenu une fois pour toute
 *    via le Playground OAuth. Aucun app password à gérer. Le compte
 *    autorisé est `support@private-equity-valley.com` et la scope
 *    `https://www.googleapis.com/auth/gmail.send`.
 *
 * Priorité d'exécution au runtime :
 *   - Si les 3 credentials Gmail API sont présents (CLIENT_ID,
 *     CLIENT_SECRET, REFRESH_TOKEN) → on envoie via Gmail API.
 *   - Sinon, si `GOOGLE_SMTP_USER` + `GOOGLE_SMTP_PASSWORD` sont
 *     présents → fallback Nodemailer SMTP (mode historique).
 *   - Sinon, `sendEmail()` renvoie une erreur claire pour que
 *     l'appelant dégrade proprement (skipped='no-api-key').
 *
 * Variables d'environnement (Vercel) — Gmail API :
 *   · GOOGLE_GMAIL_CLIENT_ID     — OAuth2 client web ID
 *   · GOOGLE_GMAIL_CLIENT_SECRET — OAuth2 client secret
 *   · GOOGLE_GMAIL_REFRESH_TOKEN — refresh token long-vie pour support@
 *   · GOOGLE_GMAIL_SENDER        — adresse émettrice (ex. support@…)
 *
 * Variables d'environnement (Vercel) — fallback SMTP historique :
 *   · GOOGLE_SMTP_USER, GOOGLE_SMTP_PASSWORD, GOOGLE_SMTP_FROM
 *
 * Quota Gmail API : 1 000 000 000 unités/jour, 250 unités/user/sec. L'envoi
 * d'un email consomme 100 unités → largement suffisant pour le CRM PEV.
 *
 * L'API publique (SendEmailInput / SendEmailResult) est strictement
 * identique à l'ancienne version pour ne rien casser côté `kyc-email.ts`.
 */

import nodemailer from 'nodemailer'
import type { Transporter, SendMailOptions } from 'nodemailer'
import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

export interface SendEmailAttachment {
  filename: string
  content: Buffer
}

export interface SendEmailInput {
  from: string
  to: string | string[]
  subject: string
  html: string
  text: string
  attachments?: SendEmailAttachment[]
}

export interface SendEmailResult {
  data?: { id: string } | null
  error?: { message: string } | null
}

// ---------------------------------------------------------------------
// Gmail API transport (priorité 1)
// ---------------------------------------------------------------------

let cachedOAuth2Client: OAuth2Client | null = null

function getGmailOAuth2Client(): OAuth2Client | null {
  if (cachedOAuth2Client) return cachedOAuth2Client
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_GMAIL_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null
  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    // redirect_uri côté Playground — non utilisé au runtime (on passe
    // direct par refresh_token), mais requis par la lib.
    'https://developers.google.com/oauthplayground',
  )
  oAuth2Client.setCredentials({ refresh_token: refreshToken })
  cachedOAuth2Client = oAuth2Client
  return oAuth2Client
}

function hasGmailApiCredentials(): boolean {
  return !!(
    process.env.GOOGLE_GMAIL_CLIENT_ID &&
    process.env.GOOGLE_GMAIL_CLIENT_SECRET &&
    process.env.GOOGLE_GMAIL_REFRESH_TOKEN
  )
}

/**
 * Encode un message MIME pour Gmail API (base64url, padding retiré).
 * Gmail API veut `raw: base64url(RFC 5322 message)`.
 */
function buildRawMimeMessage(input: SendEmailInput): string {
  const boundary = `pev_boundary_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  const to = Array.isArray(input.to) ? input.to.join(', ') : input.to
  const headers: string[] = [
    `From: ${input.from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(input.subject, 'utf-8').toString('base64')}?=`,
    'MIME-Version: 1.0',
  ]

  const hasAttachments = !!(input.attachments && input.attachments.length > 0)
  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
  } else {
    // Alternative HTML + texte brut sans pièces jointes.
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
  }

  const parts: string[] = []
  parts.push(headers.join('\r\n'))
  parts.push('')

  if (hasAttachments) {
    // Bloc HTML/texte + pièces jointes.
    const altBoundary = `pev_alt_${Date.now().toString(36)}`
    parts.push(`--${boundary}`)
    parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
    parts.push('')
    parts.push(`--${altBoundary}`)
    parts.push('Content-Type: text/plain; charset=UTF-8')
    parts.push('Content-Transfer-Encoding: 7bit')
    parts.push('')
    parts.push(input.text)
    parts.push('')
    parts.push(`--${altBoundary}`)
    parts.push('Content-Type: text/html; charset=UTF-8')
    parts.push('Content-Transfer-Encoding: 7bit')
    parts.push('')
    parts.push(input.html)
    parts.push('')
    parts.push(`--${altBoundary}--`)
    parts.push('')
    for (const att of input.attachments!) {
      parts.push(`--${boundary}`)
      parts.push(`Content-Type: application/octet-stream; name="${att.filename}"`)
      parts.push(`Content-Disposition: attachment; filename="${att.filename}"`)
      parts.push('Content-Transfer-Encoding: base64')
      parts.push('')
      // Split base64 in 76-char lines (RFC 2045).
      const b64 = att.content.toString('base64')
      for (let i = 0; i < b64.length; i += 76) {
        parts.push(b64.slice(i, i + 76))
      }
      parts.push('')
    }
    parts.push(`--${boundary}--`)
  } else {
    parts.push(`--${boundary}`)
    parts.push('Content-Type: text/plain; charset=UTF-8')
    parts.push('Content-Transfer-Encoding: 7bit')
    parts.push('')
    parts.push(input.text)
    parts.push('')
    parts.push(`--${boundary}`)
    parts.push('Content-Type: text/html; charset=UTF-8')
    parts.push('Content-Transfer-Encoding: 7bit')
    parts.push('')
    parts.push(input.html)
    parts.push('')
    parts.push(`--${boundary}--`)
  }

  // CRLF obligatoire en MIME.
  const raw = parts.join('\r\n')

  // base64url : base64 avec `-` et `_` à la place de `+` et `/`, pas de padding.
  return Buffer.from(raw, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function sendViaGmailApi(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const auth = getGmailOAuth2Client()
  if (!auth) {
    return {
      error: {
        message:
          'Gmail API credentials missing: set GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, GOOGLE_GMAIL_REFRESH_TOKEN',
      },
    }
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth })
    const raw = buildRawMimeMessage(input)
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })
    return { data: { id: res.data.id || '' } }
  } catch (err: unknown) {
    return {
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }
}

// ---------------------------------------------------------------------
// Nodemailer SMTP fallback (priorité 2)
// ---------------------------------------------------------------------

let cachedTransporter: Transporter | null = null

function getSmtpTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter
  const user = process.env.GOOGLE_SMTP_USER
  const pass = process.env.GOOGLE_SMTP_PASSWORD
  if (!user || !pass) return null
  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  })
  return cachedTransporter
}

function hasSmtpCredentials(): boolean {
  return !!(process.env.GOOGLE_SMTP_USER && process.env.GOOGLE_SMTP_PASSWORD)
}

async function sendViaSmtp(input: SendEmailInput): Promise<SendEmailResult> {
  const transporter = getSmtpTransporter()
  if (!transporter) {
    return {
      error: {
        message:
          'SMTP credentials missing: set GOOGLE_SMTP_USER and GOOGLE_SMTP_PASSWORD',
      },
    }
  }

  const mail: SendMailOptions = {
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  }

  try {
    const info = await transporter.sendMail(mail)
    return { data: { id: info.messageId || '' } }
  } catch (err: unknown) {
    return {
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }
}

// ---------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------

/**
 * Défaut : construit un `from` valide. Priorité :
 *   1. GOOGLE_GMAIL_SENDER (ex. `support@private-equity-valley.com`)
 *      + wrapper `PEV Support <…>` pour affichage propre.
 *   2. GOOGLE_SMTP_FROM (fallback historique).
 *   3. GOOGLE_SMTP_USER (fallback de dernier recours).
 *   4. Adresse factice noreply (dernier rempart — évite un throw à
 *      l'init, mais l'envoi échouera ensuite avec une erreur explicite).
 */
export function defaultFromAddress(): string {
  const gmailSender = process.env.GOOGLE_GMAIL_SENDER
  if (gmailSender) return `PEV Support <${gmailSender}>`
  const smtpFrom = process.env.GOOGLE_SMTP_FROM
  if (smtpFrom) return smtpFrom
  const smtpUser = process.env.GOOGLE_SMTP_USER
  if (smtpUser) return `PEV Support <${smtpUser}>`
  return 'PEV CRM <noreply@private-equity-valley.com>'
}

/**
 * `hasCredentials()` — indique si AU MOINS UN transport est configuré.
 * Utilisé par les routes API pour court-circuiter proprement quand
 * aucun credential n'est en place (ex. Preview Vercel sans env vars).
 */
export function hasCredentials(): boolean {
  return hasGmailApiCredentials() || hasSmtpCredentials()
}

/**
 * `sendEmail()` — route automatiquement vers Gmail API si configuré,
 * sinon SMTP, sinon erreur explicite. La signature reste identique
 * à la version 1.0 pour que `kyc-email.ts` et les autres appelants
 * n'aient rien à changer.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  if (hasGmailApiCredentials()) return sendViaGmailApi(input)
  if (hasSmtpCredentials()) return sendViaSmtp(input)
  return {
    error: {
      message:
        'No email transport configured: set Gmail API credentials (GOOGLE_GMAIL_CLIENT_ID + _SECRET + _REFRESH_TOKEN) or SMTP (GOOGLE_SMTP_USER + _PASSWORD).',
    },
  }
}
