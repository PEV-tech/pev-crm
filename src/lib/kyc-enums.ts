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

/**
 * Régimes matrimoniaux — séparés selon la situation (point 1.7 corrections
 * 2026-04-24). Un couple marié n'a pas les mêmes régimes disponibles qu'un
 * couple pacsé, donc on filtre dynamiquement via `getRegimesForSituation()`.
 */
export const REGIMES_MARIAGE_OPTIONS = [
  'Communauté réduite aux acquêts',
  'Séparation de biens',
  'Communauté universelle',
  'Participation aux acquêts',
  'Régime étranger',
] as const
export type RegimeMariage = (typeof REGIMES_MARIAGE_OPTIONS)[number]

export const REGIMES_PACS_OPTIONS = [
  'PACS — Séparation de biens',
  'PACS — Indivision',
] as const
export type RegimePacs = (typeof REGIMES_PACS_OPTIONS)[number]

/**
 * Union mariage + PACS — conservée pour les cas où on a besoin de valider
 * qu'une valeur existante est reconnue (import, legacy, diff PDF…). Les
 * composants de SAISIE doivent utiliser `getRegimesForSituation()` pour
 * proposer UNIQUEMENT les régimes applicables à la situation courante.
 */
export const REGIME_MATRIMONIAL_OPTIONS = [
  ...REGIMES_MARIAGE_OPTIONS,
  ...REGIMES_PACS_OPTIONS,
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

/**
 * Helper — retourne la liste des régimes matrimoniaux applicables pour
 * une situation donnée. Permet de filtrer le select selon la situation
 * (marié → régimes mariage, pacsé → régimes PACS).
 *
 * Retourne un tableau vide pour les situations qui n'impliquent pas de
 * régime (célibataire, divorcé, veuf, concubinage) — l'appelant doit de
 * toute façon masquer le champ via `needsRegimeMatrimonial()`.
 */
export function getRegimesForSituation(
  situation: string | null | undefined,
): readonly string[] {
  if (!situation) return []
  const s = situation.toLowerCase()
  if (s.startsWith('marié') || s.startsWith('marie')) return REGIMES_MARIAGE_OPTIONS
  if (s.startsWith('pacs')) return REGIMES_PACS_OPTIONS
  return []
}

/** Type d'actif immobilier — aligne sur la typologie métier de PEV.
 *  2026-04-25 : ajout d'"Autre" en dernière position. Quand sélectionné,
 *  l'éditeur affiche un champ libre `type_bien_libre` pour préciser. */
export const TYPE_BIEN_IMMOBILIER_OPTIONS = [
  'Résidence principale',
  'Résidence secondaire',
  'Locatif',
  'SCPI',
  'SCI',
  'Viager',
  'Terrain',
  'Commercial',
  'Autre',
] as const
export type TypeBienImmobilier = (typeof TYPE_BIEN_IMMOBILIER_OPTIONS)[number]

/** Type de produit financier. 2026-04-25 : ajout d'"Autre" + champ libre
 *  `type_produit_libre` activé conditionnellement par l'éditeur. */
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
  'Private Equity',
  'Autre',
] as const
export type TypeProduitFinancier = (typeof TYPE_PRODUIT_FINANCIER_OPTIONS)[number]

/**
 * Patrimoine professionnel (point 1.6 corrections 2026-04-24).
 *
 * Deux grands blocs :
 *   - Immobilier professionnel (locaux, véhicule, outils/machines…)
 *   - Financier professionnel (BFR, trésorerie, …)
 *
 * La catégorie distingue les deux blocs au niveau de la ligne. La
 * sous-catégorie est commune aux deux blocs — l'UI peut pré-filtrer
 * celles qui font sens côté financier vs immo, mais le stockage est
 * unifié pour garder la liberté éditoriale du consultant.
 */
export const PATRIMOINE_PRO_CATEGORIE_OPTIONS = [
  { value: 'immo_pro', label: 'Immobilier professionnel' },
  { value: 'financier_pro', label: 'Financier professionnel' },
] as const
export type PatrimoineProCategorie =
  (typeof PATRIMOINE_PRO_CATEGORIE_OPTIONS)[number]['value']

export const PATRIMOINE_PRO_SOUS_CATEGORIE_OPTIONS = [
  { value: 'locaux', label: 'Locaux' },
  { value: 'bfr', label: 'BFR' },
  { value: 'tresorerie', label: 'Trésorerie' },
  { value: 'outils_machines', label: 'Outils / Machines' },
  { value: 'vehicule', label: 'Véhicule' },
  { value: 'autre', label: 'Autre' },
] as const
export type PatrimoineProSousCategorie =
  (typeof PATRIMOINE_PRO_SOUS_CATEGORIE_OPTIONS)[number]['value']

/**
 * Libellé UI d'une sous-catégorie (lookup helper).
 */
export function labelSousCategoriePro(value: string | null | undefined): string {
  if (!value) return ''
  const found = PATRIMOINE_PRO_SOUS_CATEGORIE_OPTIONS.find(o => o.value === value)
  return found ? found.label : value
}

export function labelCategoriePro(value: string | null | undefined): string {
  if (!value) return ''
  const found = PATRIMOINE_PRO_CATEGORIE_OPTIONS.find(o => o.value === value)
  return found ? found.label : value
}

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
