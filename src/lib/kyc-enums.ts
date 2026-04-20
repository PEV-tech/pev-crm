/**
 * Enums métiers du KYC PEV — centralisés pour garantir la cohérence
 * entre le formulaire « nouveau client », la section KYC éditable, l'import
 * depuis fichier Excel et (plus tard) les PDF générés.
 *
 * Règle : la valeur STOCKÉE en base est exactement le libellé affiché (avec
 * accents). On évite une table de codes pour garder les exports CSV lisibles.
 */

/** Statut de logement (remplace le select binaire Propriétaire/Locataire). */
export const LOGEMENT_OPTIONS = [
  'Propriétaire',
  'Locataire',
  'Hébergé à titre gratuit',
  'Usufruitier',
  'Logement de fonction',
] as const
export type LogementOption = (typeof LOGEMENT_OPTIONS)[number]

/** Situation matrimoniale — identique à nouveau-client pour cohérence. */
export const SITUATION_MATRIMONIALE_OPTIONS = [
  'Célibataire',
  'Marié(e)',
  'Pacsé(e)',
  'Concubinage',
  'Divorcé(e)',
  'Veuf(ve)',
] as const
export type SituationMatrimoniale = (typeof SITUATION_MATRIMONIALE_OPTIONS)[number]

/** Régime matrimonial (affiché UNIQUEMENT si Marié(e) ou Pacsé(e)). */
export const REGIME_MATRIMONIAL_OPTIONS = [
  'Communauté réduite aux acquêts',
  'Séparation de biens',
  'Communauté universelle',
  'Participation aux acquêts',
  'Régime étranger',
  // Pour les PACS
  'PACS — Séparation de biens',
  'PACS — Indivision',
] as const
export type RegimeMatrimonial = (typeof REGIME_MATRIMONIAL_OPTIONS)[number]

/**
 * Helper — retourne true si on doit afficher le champ régime matrimonial
 * pour une situation donnée. Tolérant aux variantes historiques
 * ('marie', 'pacse', 'Marié(e)').
 */
export function needsRegimeMatrimonial(situation: string | null | undefined): boolean {
  if (!situation) return false
  const s = situation.toLowerCase()
  return s.startsWith('marié') || s.startsWith('marie') || s.startsWith('pacs')
}

/** Type d'actif immobilier — aligne sur la typologie métier de PEV. */
export const TYPE_BIEN_IMMOBILIER_OPTIONS = [
  'Résidence principale',
  'Résidence secondaire',
  'Locatif',
  'SCPI',
  'SCI',
  'Viager',
  'Terrain',
  'Commercial',
] as const
export type TypeBienImmobilier = (typeof TYPE_BIEN_IMMOBILIER_OPTIONS)[number]

/** Type de produit financier. */
export const TYPE_PRODUIT_FINANCIER_OPTIONS = [
  'Liquidités',
  'Livrets',
  'Assurance-vie',
  'Stocks / Actions',
  'Cryptos',
  'PEA',
  'CTO',
  'Retraite (PER, Madelin, art. 83)',
  'Fonds euros',
  'Obligations',
] as const
export type TypeProduitFinancier = (typeof TYPE_PRODUIT_FINANCIER_OPTIONS)[number]

/** Type de détention d'un actif — utile pour le patrimoine immobilier. */
export const TYPE_DETENTION_OPTIONS = [
  'Pleine propriété',
  'Usufruit',
  'Nue-propriété',
  'Indivision',
  'Via SCI',
  'Via société',
] as const
export type TypeDetention = (typeof TYPE_DETENTION_OPTIONS)[number]
