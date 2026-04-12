/**
 * Gestion (management fee) calculations
 * Shared business logic for quarterly consultant fees on PE, CAPI LUX, CAV LUX products
 */

export interface GrilleGestion {
  encours_min: number
  encours_max: number | null
  taux: number
}

/**
 * Find the applicable management fee rate for a given amount
 */
export function getGestionTaux(grilles: GrilleGestion[], montant: number): number {
  const grille = grilles.find(
    (g) => montant >= g.encours_min && (g.encours_max === null || montant <= g.encours_max)
  )
  return grille?.taux || 0
}

/**
 * Determine if a product type supports management fees (encours)
 * Only PE, CAPI LUX, CAV LUX have encours — not SCPI or Girardin
 */
export function hasEncours(
  produitNom: string | null | undefined,
  produitCategorie?: string | null
): boolean {
  const nom = (produitNom || '').toUpperCase().trim()
  const cat = (produitCategorie || '').toUpperCase().trim()
  const ENCOURS_TYPES = ['PE', 'CAPI LUX', 'CAV LUX']
  return ENCOURS_TYPES.includes(nom) || ENCOURS_TYPES.includes(cat)
}

/**
 * Compute quarterly consultant commission for encours-based products
 * Returns null if the product doesn't support encours or data is missing
 */
export function computeQuarterlyConsultant(
  montant: number | null | undefined,
  remApporteur: number | null | undefined,
  commissionBrute: number | null | undefined,
  grilles: GrilleGestion[],
  produitNom?: string | null,
  produitCategorie?: string | null
): number | null {
  if (!montant || grilles.length === 0) return null
  if (!hasEncours(produitNom, produitCategorie)) return null
  const tauxGestion = getGestionTaux(grilles, montant)
  if (!tauxGestion) return null
  if (!remApporteur || !commissionBrute || commissionBrute <= 0) return null
  return (montant * tauxGestion * (remApporteur / commissionBrute)) / 4
}
