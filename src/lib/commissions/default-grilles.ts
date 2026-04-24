/**
 * Grilles de frais par défaut appliquées quand aucune ligne précise
 * n'existe pour le couple produit × compagnie du dossier.
 *
 * Point 5.6 corrections 2026-04-24 — arbitrage Maxine :
 *   SCPI      : entrée 6 %   / encours 0 %
 *   PE        : entrée 3 %   / encours 0,7 %
 *   CAV/CAPI  : entrée 1 %   / encours 1 %
 *
 * Ces taux servent de filet de sécurité : si un consultant crée un
 * dossier avec une catégorie renseignée mais un partenaire non catalogué
 * (ou laissé vide), on ne le laisse pas partir avec une commission à 0.
 *
 * Priorité de lookup (à appliquer au moment du calcul commission) :
 *   1. Si `dossier.taux_produit_compagnie_id` pointe vers une ligne → utiliser `taux_produit_compagnie.taux`.
 *   2. Sinon, si `(produit_id, compagnie_id)` a une ligne dans `taux_produit_compagnie` → idem.
 *   3. Sinon, fallback sur ces defaults catégorie.
 *   4. Si aucun default ne matche → 0 (statu quo).
 *
 * Important : ne JAMAIS écraser un paramétrage plus précis. Les defaults
 * ne s'appliquent qu'en dernier recours (priorité 3).
 */

export type DefaultGrilleCategorie = 'SCPI' | 'PE' | 'CAV_CAPI'

export interface DefaultGrille {
  entree: number // décimal (0.06 = 6 %)
  encours: number // décimal annuel
  label: string
}

/**
 * Table des defaults. Conservée en TS plutôt qu'en DB pour :
 *   - Éviter une migration supplémentaire sur `grilles_frais` (la
 *     structure actuelle n'a pas de colonne `produit_categorie`).
 *   - Garder la règle visible dans le code / la PR (le paramétrage
 *     "vrai" reste DB dans `taux_produit_compagnie` et prime toujours).
 *
 * Si on veut un jour rendre ça modifiable sans déploiement, on crée
 * une table `grilles_defaut_categorie` et on l'y copie — la lecture
 * côté code restera identique.
 */
export const DEFAULT_GRILLES: Record<DefaultGrilleCategorie, DefaultGrille> = {
  SCPI: { entree: 0.06, encours: 0, label: 'SCPI' },
  PE: { entree: 0.03, encours: 0.007, label: 'Private Equity' },
  CAV_CAPI: { entree: 0.01, encours: 0.01, label: 'CAV / CAPI' },
}

/**
 * Normalise une catégorie libre (ex: "SCPI", "Private Equity", "CAV LUX",
 * "CAPI LUX", "CAV/CAPI", "PE") vers une des 3 clés du dictionnaire.
 * Retourne null si aucune correspondance — l'appelant applique alors
 * son propre fallback (typiquement 0, statu quo pré-5.6).
 */
export function normalizeCategorieForDefaults(
  categorie: string | null | undefined,
): DefaultGrilleCategorie | null {
  if (!categorie) return null
  const c = categorie.toUpperCase().trim()
  if (c === 'SCPI') return 'SCPI'
  // PE, Private Equity, PRIVATE EQUITY → tous mappés sur PE
  if (c === 'PE' || c.includes('PRIVATE EQUITY') || c.includes('PRIVATE')) return 'PE'
  // CAV, CAPI, CAV LUX, CAPI LUX, CAV/CAPI
  if (c.includes('CAV') || c.includes('CAPI')) return 'CAV_CAPI'
  return null
}

/**
 * Retourne la grille par défaut pour une catégorie donnée, ou null si
 * la catégorie n'est pas couverte par la règle métier 5.6.
 */
export function getDefaultGrilleForCategorie(
  categorie: string | null | undefined,
): DefaultGrille | null {
  const key = normalizeCategorieForDefaults(categorie)
  if (!key) return null
  return DEFAULT_GRILLES[key]
}

/**
 * Helper principal : retourne le taux d'entrée à appliquer pour un dossier
 * étant donné (1) le taux déjà paramétré côté DB et (2) la catégorie
 * produit. N'écrase JAMAIS un taux existant (> 0).
 *
 * Usage typique côté détail dossier :
 *   const tauxEntree = resolveTauxEntree(dossier.taux_commission, dossier.produit_categorie)
 */
export function resolveTauxEntree(
  currentTaux: number | null | undefined,
  categorie: string | null | undefined,
): number {
  if (typeof currentTaux === 'number' && currentTaux > 0) return currentTaux
  const def = getDefaultGrilleForCategorie(categorie)
  return def ? def.entree : 0
}

/**
 * Idem pour l'encours / la gestion récurrente. Seules les catégories PE
 * et CAV/CAPI ont un taux d'encours par défaut non nul (SCPI = 0).
 */
export function resolveTauxEncours(
  currentTaux: number | null | undefined,
  categorie: string | null | undefined,
): number {
  if (typeof currentTaux === 'number' && currentTaux > 0) return currentTaux
  const def = getDefaultGrilleForCategorie(categorie)
  return def ? def.encours : 0
}
