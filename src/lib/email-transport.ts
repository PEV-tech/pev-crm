/**
 * email-transport.ts — Helper d'envoi SMTP (Google Workspace).
 *
 * Contexte 2026-04-21 : on a abandonné Resend parce que la vérification DNS
 * (DKIM/SPF/DMARC) exigée par Resend n'était pas possible — IONOS héberge
 * le DNS du domaine `private-equity-valley.com` et bloque toute modif de
 * zone ainsi que le changement de nameservers derrière un plan payant.
 *
 * Solution : passer par Google Workspace SMTP (smtp.gmail.com:465) via
 * Nodemailer. Le domaine a déjà Google Workspace configuré (MX
 * aspmx.l.google.com visibles dans la zone IONOS) donc l'authentification
 * DKIM/SPF sortante est déjà en place côté Google — aucune modification DNS
 * nécessaire.
 *
 * Expéditeur : `support@private-equity-valley.com` (compte Google Workspace
 * existant). L'app password est un "mot de passe d'application Google"
 * généré depuis les paramètres du compte.
 *
 * Variables d'environnement (Vercel) :
 *   · GOOGLE_SMTP_USER — ex. "support@private-equity-valley.com"
 *   · GOOGLE_SMTP_PASSWORD — mot de passe d'application Google (16 car.)
 *   · GOOGLE_SMTP_FROM — ex. "PEV Support <support@private-equity-valley.com>"
 *       (optionnel ; défaut construit depuis GOOGLE_SMTP_USER).
 *
 * Quota Google Workspace : 2 000 emails/jour par utilisateur. Largement
 * suffisant pour un CRM wealth management PEV.
 *
 * L'API publique imite volontairement la forme que renvoyait Resend
 * (`{ data: { id }, error: { message } }`) pour minimiser les diffs dans
 * `kyc-email.ts`.
 */

import nodemailer from 'nodemailer'
import type { Transporter, SendMailOptions } from 'nodemailer'

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

let cachedTransporter: Transporter | null = null

function getTransporter(): Transporter | null {
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

/**
 * Défaut : construit un `from` valide à partir du user SMTP Google si
 * GOOGLE_SMTP_FROM n'est pas défini. À noter : Google Workspace n'autorise
 * à envoyer qu'avec l'adresse exacte du compte authentifié (ou ses alias
 * déclarés). Si on tente un `from` différent, Google réécrit l'en-tête
 * `From:` pour protéger le domaine.
 */
export function defaultFromAddress(): string {
  const fromEnv = process.env.GOOGLE_SMTP_FROM
  if (fromEnv) return fromEnv
  const user = process.env.GOOGLE_SMTP_USER
  if (!user) return 'PEV CRM <noreply@private-equity-valley.com>'
  return `PEV Support <${user}>`
}

/**
 * `hasCredentials()` — permet aux modules appelants (kyc-email.ts) de
 * court-circuiter proprement avec `{ skipped: 'no-api-key' }` quand le
 * secret SMTP n'est pas configuré en prod/preview.
 */
export function hasCredentials(): boolean {
  return !!(process.env.GOOGLE_SMTP_USER && process.env.GOOGLE_SMTP_PASSWORD)
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const transporter = getTransporter()
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
    // Nodemailer renvoie `info.messageId` en format `<xxx@host>`. On le
    // garde tel quel pour logging côté DB.
    return { data: { id: info.messageId || '' } }
  } catch (err: unknown) {
    return {
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }
}
