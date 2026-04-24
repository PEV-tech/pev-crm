/**
 * kyc-relances-cron.ts — logique pure du cron de relances KYC.
 *
 * Chantier 3 de l'étape 3 audit KYC (2026-04-24).
 *
 * Appelée par le handler HTTP /api/cron/kyc-relances (déclenché par
 * Vercel Cron quotidien). Isolée ici pour faciliter les tests unitaires
 * et la ré-exécution manuelle depuis un script.
 *
 * Algorithme :
 *   1. Lire toutes les lignes kyc_relance_settings avec enabled=true.
 *   2. Pour chaque consultant :
 *      - Lister ses clients kyc_sent_at IS NOT NULL AND kyc_signed_at IS NULL
 *        AND kyc_token IS NOT NULL AND kyc_relances_count < max_relances.
 *      - Garder ceux qui franchissent le seuil :
 *          (kyc_last_relance_at IS NULL AND kyc_sent_at < NOW() - seuil)
 *          OU (kyc_last_relance_at < NOW() - intervalle)
 *      - Pour chaque client qualifié :
 *          · UPSERT dans relances (source='auto_kyc_unsigned', type='kyc', …).
 *            L'index partiel UNIQUE empêche 2 relances actives sur le
 *            même client → on compose ON CONFLICT côté applicatif par un
 *            SELECT pré-vol pour savoir si on UPDATE ou INSERT.
 *          · UPDATE clients.kyc_relances_count++ et kyc_last_relance_at=NOW().
 *   3. Retourner un rapport agrégé (par consultant + global).
 *
 * Pas d'envoi email dans ce fichier — l'email_auto est câblé au chantier 5,
 * une fois le stack SMTP débloqué (chantier 4).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface RelancesCronReport {
  ran_at: string
  consultants_scanned: number
  consultants_skipped_disabled: number
  clients_considered: number
  relances_inserted: number
  relances_reactivated: number
  clients_capped: number
  errors: Array<{ consultant_id: string; client_id?: string; message: string }>
}

export async function runKycRelancesCron(
  admin: SupabaseClient<Database>,
  options: { now?: Date } = {},
): Promise<RelancesCronReport> {
  const now = options.now ?? new Date()
  const report: RelancesCronReport = {
    ran_at: now.toISOString(),
    consultants_scanned: 0,
    consultants_skipped_disabled: 0,
    clients_considered: 0,
    relances_inserted: 0,
    relances_reactivated: 0,
    clients_capped: 0,
    errors: [],
  }

  // Étape 1 — charger tous les settings. On inclut les désactivés juste
  // pour le compte d'audit ; on les skippe ensuite.
  const { data: settingsRows, error: settingsErr } = await admin
    .from('kyc_relance_settings')
    .select(
      'consultant_id, enabled, seuil_jours, intervalle_jours, max_relances, email_auto',
    )
  if (settingsErr) {
    report.errors.push({
      consultant_id: '*',
      message: `load settings: ${settingsErr.message}`,
    })
    return report
  }

  for (const s of settingsRows ?? []) {
    if (!s.enabled) {
      report.consultants_skipped_disabled += 1
      continue
    }
    report.consultants_scanned += 1

    // Étape 2a — clients à examiner pour ce consultant.
    // Les colonnes kyc_sent_at / kyc_signed_at / kyc_token existent en DB
    // depuis add-kyc-signature-audit.sql / add-kyc-link-flow.sql mais ne
    // sont pas encore dans src/types/database.ts (dette notée STATUS.md).
    // On cast en `never` pour le select + `unknown` pour le résultat —
    // même pattern que dans src/app/kyc/[token]/kyc-public-client.tsx.
    const { data: clients, error: clientsErr } = await admin
      .from('clients')
      .select(
        'id, nom, prenom, raison_sociale, type_personne, kyc_sent_at, kyc_signed_at, kyc_token, kyc_relances_count, kyc_last_relance_at' as never,
      )
      .eq('consultant_id', s.consultant_id)
      .not('kyc_sent_at', 'is', null)
      .is('kyc_signed_at', null)
      .not('kyc_token', 'is', null)
    if (clientsErr) {
      report.errors.push({
        consultant_id: s.consultant_id,
        message: `load clients: ${clientsErr.message}`,
      })
      continue
    }

    for (const c of ((clients ?? []) as unknown) as Array<{
      id: string
      nom: string
      prenom: string | null
      raison_sociale: string | null
      type_personne: string | null
      kyc_sent_at: string | null
      kyc_signed_at: string | null
      kyc_token: string | null
      kyc_relances_count: number
      kyc_last_relance_at: string | null
    }>) {
      report.clients_considered += 1

      // Plafond atteint → skip sans erreur.
      if (c.kyc_relances_count >= s.max_relances) {
        report.clients_capped += 1
        continue
      }

      // Étape 2b — le client franchit-il le seuil ?
      const sentAt = c.kyc_sent_at ? new Date(c.kyc_sent_at) : null
      const lastRelanceAt = c.kyc_last_relance_at
        ? new Date(c.kyc_last_relance_at)
        : null
      const daysSince = (d: Date): number =>
        (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)

      let shouldRelancer = false
      if (lastRelanceAt === null && sentAt !== null) {
        shouldRelancer = daysSince(sentAt) >= s.seuil_jours
      } else if (lastRelanceAt !== null) {
        shouldRelancer = daysSince(lastRelanceAt) >= s.intervalle_jours
      }
      if (!shouldRelancer) continue

      // Étape 2c — nom affichable pour la description.
      const clientLabel =
        c.type_personne === 'morale'
          ? c.raison_sociale || c.nom
          : `${c.prenom ?? ''} ${c.nom}`.trim() || c.nom

      const relanceNum = c.kyc_relances_count + 1
      const description = `KYC non signé — relance auto ${relanceNum}/${s.max_relances} pour ${clientLabel}`
      const todayIso = now.toISOString().slice(0, 10) // YYYY-MM-DD

      try {
        // Cherche une relance auto active déjà existante (index partiel
        // UNIQUE garantit au plus 1 ligne a_faire/reporte). Si présent,
        // on la met à jour (réactive) plutôt que d'échouer sur contrainte.
        const { data: existing, error: lookupErr } = await admin
          .from('relances')
          .select('id, statut')
          .eq('client_id', c.id)
          .eq('source', 'auto_kyc_unsigned')
          .in('statut', ['a_faire', 'reporte'])
          .maybeSingle()
        if (lookupErr) throw lookupErr

        if (existing) {
          // Réactive + bump description pour compter la N-ième relance.
          const { error: updErr } = await admin
            .from('relances')
            .update({
              description,
              date_echeance: todayIso,
              rappel_date: null,
              statut: 'a_faire',
            })
            .eq('id', existing.id)
          if (updErr) throw updErr
          report.relances_reactivated += 1
        } else {
          const { error: insErr } = await admin.from('relances').insert({
            client_id: c.id,
            created_by: s.consultant_id,
            type: 'kyc',
            description,
            date_echeance: todayIso,
            rappel_date: null,
            statut: 'a_faire',
            source: 'auto_kyc_unsigned',
          })
          if (insErr) throw insErr
          report.relances_inserted += 1
        }

        // Bump compteurs per-client.
        const { error: bumpErr } = await admin
          .from('clients')
          .update({
            kyc_relances_count: c.kyc_relances_count + 1,
            kyc_last_relance_at: now.toISOString(),
          })
          .eq('id', c.id)
        if (bumpErr) throw bumpErr
      } catch (err: unknown) {
        report.errors.push({
          consultant_id: s.consultant_id,
          client_id: c.id,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return report
}
