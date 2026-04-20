import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/sign-kyc
 *
 * Enregistre la signature d'un KYC par un client (ou son représentant légal
 * pour une personne morale). Capture les éléments d'audit nécessaires pour
 * prouver le consentement explicite en cas de KYC incomplet :
 * - nom du signataire saisi
 * - timestamp serveur (non falsifiable côté UI)
 * - IP source (via X-Forwarded-For ou X-Real-IP — Vercel renseigne ces headers)
 * - taux de complétude au moment de la signature
 * - liste des champs manquants
 * - flags de consentement (incomplete + accuracy)
 *
 * Body JSON attendu :
 * {
 *   client_id: string (uuid),
 *   signer_name: string (non vide),
 *   completion_rate: number (0-100),
 *   missing_fields: string[],
 *   consent_incomplete: boolean,
 *   consent_accuracy: boolean
 * }
 *
 * Pré-requis :
 * - L'utilisateur appelant doit être authentifié (RLS empêche la mise à jour
 *   sinon). Dans la V1, c'est le consultant qui déclenche la signature en
 *   présence du client — la signature électronique du client est capturée
 *   via la saisie du nom, pas via une session client autonome.
 * - Si completion_rate < 100, les deux flags de consentement doivent être
 *   true, sinon la requête est rejetée (protection serveur, en plus de la
 *   validation UI).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Body JSON invalide' },
        { status: 400 }
      )
    }

    const {
      client_id,
      signer_name,
      completion_rate,
      missing_fields,
      consent_incomplete,
      consent_accuracy,
    } = body as {
      client_id?: unknown
      signer_name?: unknown
      completion_rate?: unknown
      missing_fields?: unknown
      consent_incomplete?: unknown
      consent_accuracy?: unknown
    }

    // Validations.
    if (typeof client_id !== 'string' || !client_id) {
      return NextResponse.json({ error: 'client_id requis' }, { status: 400 })
    }
    if (typeof signer_name !== 'string' || !signer_name.trim()) {
      return NextResponse.json(
        { error: 'Le nom du signataire est requis' },
        { status: 400 }
      )
    }
    if (
      typeof completion_rate !== 'number' ||
      completion_rate < 0 ||
      completion_rate > 100 ||
      !Number.isFinite(completion_rate)
    ) {
      return NextResponse.json(
        { error: 'completion_rate doit être un nombre entre 0 et 100' },
        { status: 400 }
      )
    }
    if (!Array.isArray(missing_fields)) {
      return NextResponse.json(
        { error: 'missing_fields doit être un tableau' },
        { status: 400 }
      )
    }
    const consentIncomplete = consent_incomplete === true
    const consentAccuracy = consent_accuracy === true

    const isIncomplete = completion_rate < 100

    // Garde-fou serveur : on ne peut pas signer un KYC incomplet sans les
    // deux cases de consentement explicite.
    if (isIncomplete && (!consentIncomplete || !consentAccuracy)) {
      return NextResponse.json(
        {
          error:
            'Signature d\'un KYC incomplet : les deux consentements explicites sont obligatoires.',
        },
        { status: 400 }
      )
    }

    // Extraction IP : Vercel renseigne X-Forwarded-For (peut contenir une
    // liste, on prend le premier). Fallback sur X-Real-IP.
    const forwardedFor = req.headers.get('x-forwarded-for') || ''
    const realIp = req.headers.get('x-real-ip') || ''
    const ip =
      forwardedFor.split(',')[0]?.trim() ||
      realIp.trim() ||
      null

    const supabase = await createClient()

    // Auth check : le caller doit être un utilisateur authentifié (consultant
    // qui fait signer le client sur son poste).
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      )
    }

    const now = new Date().toISOString()

    // Update de la fiche client. RLS s'applique — si le consultant n'a pas
    // les droits sur ce client, l'UPDATE retourne 0 ligne et on répond 403.
    const { data: updated, error: updateErr } = await supabase
      .from('clients')
      .update({
        kyc_signer_name: signer_name.trim(),
        kyc_signed_at: now,
        kyc_signer_ip: ip,
        kyc_completion_rate: Math.round(completion_rate),
        kyc_missing_fields: missing_fields as any,
        kyc_incomplete_signed: isIncomplete,
        kyc_consent_incomplete: consentIncomplete,
        kyc_consent_accuracy: consentAccuracy,
        // On aligne aussi la date simple existante pour compat.
        kyc_date_signature: now.split('T')[0],
      } as any)
      .eq('id', client_id)
      .select('id')
      .maybeSingle()

    if (updateErr) {
      console.error('[sign-kyc] update error:', updateErr.message)
      return NextResponse.json(
        { error: `Erreur lors de l'enregistrement : ${updateErr.message}` },
        { status: 500 }
      )
    }
    if (!updated) {
      return NextResponse.json(
        {
          error:
            "Client introuvable ou accès refusé par la politique de sécurité.",
        },
        { status: 403 }
      )
    }

    return NextResponse.json({
      ok: true,
      client_id: updated.id,
      signed_at: now,
      completion_rate: Math.round(completion_rate),
      incomplete: isIncomplete,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[sign-kyc] unexpected error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
