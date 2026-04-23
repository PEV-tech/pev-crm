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

/**
 * Rôle du détenteur d'un actif (ou d'une dette) au sein d'un couple/dossier.
 *
 * - `client` : détenu exclusivement par le client principal de la fiche KYC.
 * - `co_titulaire` : détenu exclusivement par le co-titulaire (conjoint,
 *    partenaire de PACS, co-investisseur). L'actif est informatif côté fiche
 *    du client mais n'est pas consolidé dans son patrimoine.
 * - `joint` : détenu conjointement. Par convention la ligne est stockée UNE
 *    SEULE FOIS sur la fiche du client principal, et référence le co-titulaire
 *    via `co_titulaire_client_id`. À la lecture, la fiche du co-titulaire
 *    voit automatiquement la ligne (sync bidirectionnelle, cf. lib/kyc-bidi.ts).
 *
 * Cette valeur est orthogonale à `TYPE_DETENTION_OPTIONS` qui décrit la forme
 * juridique (pleine propriété, usufruit, indivision…).
 */
export const DETENTEUR_TYPE_OPTIONS = [
  'client',
  'co_titulaire',
  'joint',
] as const
export type DetenteurType = (typeof DETENTEUR_TYPE_OPTIONS)[number]

/** Libellés FR des types de détenteur pour affichage UI. */
export const DETENTEUR_TYPE_LABELS: Record<DetenteurType, string> = {
  client: 'Client',
  co_titulaire: 'Co-titulaire',
  joint: 'Joint',
}

/**
 * Libellés orientés "je" pour le portail public KYC (le client rempli
 * lui-même la fiche, donc on parle à la 1re personne).
 */
export const DETENTEUR_TYPE_LABELS_PORTAIL: Record<DetenteurType, string> = {
  client: 'Moi seul(e)',
  co_titulaire: 'Mon co-titulaire seul(e)',
  joint: 'En commun avec mon co-titulaire',
}

/**
 * Normalise une valeur `detenteur_type` provenant des JSONB existants.
 *
 * Avant le commit `1cfe2de` (détenteur structuré) et l'alignement portail
 * étape 2 (2026-04-23), le portail public persistait des valeurs libres
 * (`conjoint`, `commun`, `autre`) qui ne sont pas dans l'enum canonique.
 * Cette fonction réécrit ces valeurs à la lecture, pour que le select
 * dashboard + le diff-viewer + le PDF affichent quelque chose de cohérent
 * sans avoir à migrer les lignes JSONB en base.
 *
 * - `conjoint` / `co_titulaire`  → `co_titulaire`
 * - `commun`   / `joint`         → `joint`
 * - `autre`                      → `co_titulaire` (le nom est dans
 *                                  `co_titulaire_nom`, le consultant
 *                                  résoudra la FK)
 * - `client`, `''`, `undefined`  → `client`
 */
export function normalizeDetenteurType(value: unknown): DetenteurType {
  if (typeof value !== 'string' || value === '') return 'client'
  const v = value.toLowerCase().trim()
  if (v === 'co_titulaire' || v === 'conjoint') return 'co_titulaire'
  if (v === 'joint' || v === 'commun') return 'joint'
  if (v === 'autre') return 'co_titulaire'
  if (v === 'client') return 'client'
  return 'client'
}
