/**
 * kyc-email-templates.ts — Chargement + substitution des templates
 * emails personnalisables par consultant (retour Maxine #1 2026-04-21).
 *
 * Principes :
 *   · Stockage DB : `consultant_email_templates` (consultant_id,
 *     template_key, subject, body, enabled).
 *   · Si pas de template custom pour un couple (consultant_id, key) OU
 *     si `enabled = false`, l'appelant retombe sur le template hardcodé
 *     historique dans `kyc-email.ts`.
 *   · Substitution Mustache-style `{{nom}}`. On trim les espaces dans le
 *     nom de variable (`{{ nom }}` marche aussi). Variables inconnues
 *     → remplacées par chaîne vide.
 *   · Le `body` stocké est en texte brut ; il est automatiquement
 *     enveloppé dans la charte HTML PEV côté envoi (cf.
 *     `wrapBodyInPevShell`). Le consultant n'a pas à s'occuper du HTML.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type EmailTemplateKey =
  | 'kyc_signed_consultant'
  | 'kyc_signed_client'
  | 'kyc_envoi_lien'
  | 'kyc_relance'

export interface EmailTemplateVariables {
  clientLabel: string
  clientFirstName: string
  signerName: string
  signedAtStr: string
  completionRate: number
  /** Rendu "Adresse, Profession, …" ou "—" si vide. */
  missingFields: string
  consultantPrenom: string
  /**
   * Les variables ci-dessous sont utilisées par les templates
   * `kyc_envoi_lien` (envoi initial du lien au client) et `kyc_relance`
   * (relance envoyée tant que le KYC n'est pas signé). Elles peuvent
   * rester vides pour les templates post-signature historiques.
   */
  /** URL publique complète vers `/kyc/[token]` (inclut le token courant). */
  portailUrl: string
  /** Date d'envoi du lien formatée FR (ex. "23/04/2026 à 09:15"). */
  kycSentAtFr: string
  /** Ancienneté du lien en jours depuis kyc_sent_at (0, 1, 2, …). */
  joursDepuisEnvoi: number
  /** Nom du cabinet, harmonisé — "Private Equity Valley". */
  cabinetNom: string
  /** Nom complet du consultant pour signature (prenom + nom). */
  consultantNom: string
}

export interface LoadedTemplate {
  subject: string
  bodyText: string
}

/**
 * Charge le template personnalisé d'un consultant pour une clé donnée.
 * Retourne null si le template n'existe pas ou est désactivé — le caller
 * doit alors utiliser son template par défaut hardcodé.
 *
 * On utilise le client fourni (admin ou authentifié). En pratique on
 * appelle depuis la route serveur avec le client admin pour garantir
 * que l'envoi email ne dépende pas de la RLS.
 */
export async function loadConsultantEmailTemplate(
  admin: SupabaseClient<Database>,
  consultantId: string,
  key: EmailTemplateKey,
): Promise<LoadedTemplate | null> {
  try {
    const { data, error } = await admin
      .from('consultant_email_templates' as never)
      .select('subject, body, enabled')
      .eq('consultant_id', consultantId)
      .eq('template_key', key)
      .maybeSingle()
    if (error) {
      console.warn(
        '[kyc-email-templates] load failed:',
        error.message,
      )
      return null
    }
    const row = data as unknown as {
      subject: string
      body: string
      enabled: boolean
    } | null
    if (!row || !row.enabled) return null
    return { subject: row.subject, bodyText: row.body }
  } catch (err: unknown) {
    console.warn(
      '[kyc-email-templates] load threw:',
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

/**
 * Substitue les variables Mustache `{{nom}}` dans une chaîne. Variables
 * inconnues → chaîne vide. Whitespace autour du nom toléré.
 */
export function substituteVars(
  tpl: string,
  vars: EmailTemplateVariables,
): string {
  const dict: Record<string, string> = {
    clientLabel: vars.clientLabel,
    clientFirstName: vars.clientFirstName,
    signerName: vars.signerName,
    signedAtStr: vars.signedAtStr,
    completionRate: String(vars.completionRate),
    missingFields: vars.missingFields,
    consultantPrenom: vars.consultantPrenom,
    // Variables ajoutées pour les templates kyc_envoi_lien / kyc_relance.
    portailUrl: vars.portailUrl,
    kycSentAtFr: vars.kycSentAtFr,
    joursDepuisEnvoi: String(vars.joursDepuisEnvoi),
    cabinetNom: vars.cabinetNom,
    consultantNom: vars.consultantNom,
  }
  return tpl.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, name) => {
    return Object.prototype.hasOwnProperty.call(dict, name)
      ? dict[name]
      : ''
  })
}

/**
 * Enveloppe un corps texte dans le shell HTML PEV standard. Le texte
 * est HTML-encodé (pas d'interprétation user-generated), les sauts de
 * ligne doublés deviennent des paragraphes, les simples des `<br>`.
 */
export function wrapBodyInPevShell(args: {
  title: string
  bodyText: string
  footer?: string
}): string {
  const esc = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const paragraphs = args.bodyText
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 12px 0;">${esc(p).replace(/\n/g, '<br>')}</p>`,
    )
    .join('')

  const footerHtml = args.footer
    ? `<p style="color:#64748b; font-size:12px; margin-top:32px;">${esc(args.footer)}</p>`
    : ''

  return `<!doctype html>
<html lang="fr"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color:#1e293b; max-width:640px; margin:0 auto; padding:24px;">
  <div style="border-top:4px solid #243f6f; padding-top:16px;">
    <h2 style="color:#243f6f; margin:0 0 8px 0;">${esc(args.title)}</h2>
    <p style="margin:0 0 16px 0; color:#64748b; font-size:14px;">Private Equity Valley</p>
  </div>
  ${paragraphs}
  ${footerHtml}
</body></html>`
}

/**
 * Templates PAR DÉFAUT proposés au consultant quand il arrive sur l'onglet
 * « Emails » de Paramètres. Ils peuvent les cloner et les éditer.
 * Gardés alignés avec la copie historique de `kyc-email.ts` pour que la
 * transition soit transparente.
 */
export const DEFAULT_TEMPLATES: Record<EmailTemplateKey, LoadedTemplate> = {
  kyc_signed_consultant: {
    subject:
      '[KYC] Signature {{completionRate}}% — {{clientLabel}}',
    bodyText: `Bonjour {{consultantPrenom}},

Le client {{clientLabel}} vient de signer son KYC via le portail public.

Signé par : {{signerName}}
Date      : {{signedAtStr}}
Complétude : {{completionRate}}%

Champs manquants (le cas échéant) : {{missingFields}}

Le PDF signé est joint à cet email et déposé dans la fiche client.

— PEV CRM`,
  },
  kyc_signed_client: {
    subject: 'Votre dossier KYC signé — Private Equity Valley',
    bodyText: `Bonjour {{clientFirstName}},

Nous avons bien reçu votre dossier KYC signé.

Signé par : {{signerName}}
Date      : {{signedAtStr}}
Complétude : {{completionRate}}%

Votre dossier signé est joint à cet email en format PDF. Vous pouvez le conserver pour vos archives personnelles.

Pour toute question, répondez simplement à cet email ou contactez votre conseiller habituel.

— L'équipe Private Equity Valley`,
  },
  kyc_envoi_lien: {
    subject: 'Votre dossier KYC à compléter — {{cabinetNom}}',
    bodyText: `Bonjour {{clientFirstName}},

Pour préparer votre dossier, je vous invite à renseigner vos informations via le lien sécurisé ci-dessous. Comptez une dizaine de minutes.

{{portailUrl}}

Ce lien est personnel et unique. Il vous permet de compléter la fiche à votre rythme puis de la signer électroniquement une fois terminée.

Si une information vous manque ou si vous avez la moindre question, répondez simplement à cet email.

Cordialement,
{{consultantNom}}
{{cabinetNom}}`,
  },
  kyc_relance: {
    subject: 'Rappel — votre dossier KYC à finaliser ({{joursDepuisEnvoi}} jours)',
    bodyText: `Bonjour {{clientFirstName}},

Je reviens vers vous au sujet de votre dossier KYC, que je vous ai transmis le {{kycSentAtFr}} ({{joursDepuisEnvoi}} jours) et que je n'ai pas encore reçu signé.

Pour reprendre votre saisie là où vous l'aviez laissée, voici à nouveau votre lien personnel :

{{portailUrl}}

Cela ne prend que quelques minutes. Si vous rencontrez une difficulté ou avez besoin d'un accompagnement pour remplir la fiche, n'hésitez pas à me répondre directement.

Cordialement,
{{consultantNom}}
{{cabinetNom}}`,
  },
}

/**
 * Titre HTML à utiliser dans le shell PEV en fonction de la clé — libellé
 * et ton cohérents avec les templates par défaut ci-dessus.
 */
export function titleForTemplateKey(
  key: EmailTemplateKey,
  isIncomplete: boolean,
): string {
  if (key === 'kyc_signed_consultant') {
    return isIncomplete ? 'Signature KYC — INCOMPLÈTE' : 'Signature KYC reçue'
  }
  if (key === 'kyc_envoi_lien') {
    return 'Votre dossier KYC à compléter'
  }
  if (key === 'kyc_relance') {
    return 'Rappel — votre dossier KYC à finaliser'
  }
  return 'Votre dossier KYC a bien été signé'
}
