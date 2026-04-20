import { KycPublicClient } from './kyc-public-client'

/**
 * Page publique /kyc/[token]
 *
 * Affichée au client non authentifié quand il ouvre le lien reçu par email.
 * Montre un récapitulatif de son KYC (lecture seule, colonnes filtrées par
 * la RPC kyc_client_by_token) puis un bouton "Signer" qui déclenche la RPC
 * kyc_sign_by_token.
 *
 * Cette page est en dehors du layout /dashboard donc pas d'auth requise.
 * Le middleware autorise /kyc explicitement (voir publicRoutes).
 */
export default async function KycPublicPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <KycPublicClient token={token} />
}
