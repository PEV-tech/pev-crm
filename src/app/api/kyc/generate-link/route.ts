import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/kyc/generate-link
 *
 * Génère (ou régénère) un token KYC pour un client et retourne l'URL publique
 * à envoyer au client. Si un token existe déjà, la fonction RPC le remplace
 * (rotation). C'est voulu : un consultant peut "renouveler le lien" si le
 * précédent a fuité ou expiré côté client.
 *
 * L'URL renvoyée pointe vers /kyc/[token] — une page publique (hors auth)
 * qui permet au client de consulter et signer son KYC.
 *
 * Body JSON : { client_id: string (uuid) }
 * Réponse   : { url, token, mailto }
 *
 * Pré-requis : consultant authentifié (RPC SECURITY DEFINER side-checks auth).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const clientId =
      body && typeof body === 'object' && typeof (body as any).client_id === 'string'
        ? ((body as any).client_id as string)
        : null

    if (!clientId) {
      return NextResponse.json(
        { error: 'client_id requis' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Auth : seul un consultant authentifié peut générer un lien.
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      )
    }

    // Récupérer quelques champs pour pré-remplir le mailto (destinataire +
    // prénom/nom pour le corps).
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, email, prenom, nom, raison_sociale, type_personne')
      .eq('id', clientId)
      .maybeSingle()

    if (clientErr || !client) {
      return NextResponse.json(
        { error: 'Client introuvable' },
        { status: 404 }
      )
    }

    // RPC qui crée/renouvelle le token en une passe atomique et retourne la
    // valeur. Côté DB, SECURITY DEFINER + contrôle auth.uid() IS NOT NULL.
    const { data: token, error: rpcErr } = await supabase.rpc(
      'kyc_generate_token' as never,
      { p_client_id: clientId } as never
    )

    if (rpcErr || !token || typeof token !== 'string') {
      console.error('[kyc/generate-link] rpc error:', rpcErr?.message)
      return NextResponse.json(
        { error: rpcErr?.message || 'Échec de la génération du token' },
        { status: 500 }
      )
    }

    // Construction de l'URL publique. NEXT_PUBLIC_APP_URL est défini sur
    // Vercel (ex: https://pev-crm.vercel.app). Fallback sur l'origine de la
    // requête si la variable manque (dev local).
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`
    const publicUrl = `${baseUrl.replace(/\/$/, '')}/kyc/${token}`

    // Pré-remplissage mailto : sujet + corps simples, le consultant peut
    // éditer dans Gmail avant envoi. On évite d'inclure des infos sensibles
    // (pas d'ID client, pas de données KYC dans le corps).
    const displayName =
      client.type_personne === 'PM'
        ? client.raison_sociale || ''
        : `${client.prenom || ''} ${client.nom || ''}`.trim()
    const subject = `Finalisation de votre dossier KYC — Private Equity Valley`
    const bodyTxt = [
      `Bonjour${displayName ? ` ${displayName}` : ''},`,
      ``,
      `Afin de finaliser votre dossier, merci de compléter et signer votre KYC via le lien sécurisé ci-dessous :`,
      ``,
      publicUrl,
      ``,
      `Ce lien est personnel, ne le transférez pas.`,
      ``,
      `Cordialement,`,
      `Private Equity Valley`,
    ].join('\n')

    const mailto =
      `mailto:${encodeURIComponent(client.email || '')}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(bodyTxt)}`

    // Gmail compose URL — ouvre directement la compose window Gmail web,
    // utile pour les consultants qui ne passent pas par mailto:// par défaut.
    const gmailCompose =
      `https://mail.google.com/mail/?view=cm&fs=1` +
      `&to=${encodeURIComponent(client.email || '')}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(bodyTxt)}`

    return NextResponse.json({
      ok: true,
      token,
      url: publicUrl,
      mailto,
      gmail_compose: gmailCompose,
      recipient_email: client.email || null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[kyc/generate-link] unexpected:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
