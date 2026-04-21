/**
 * Liste ISO 3166-1 des pays (noms FR) utilisée dans toutes les saisies KYC.
 *
 * Objectif : éviter les saisies libres type "france", "FR", "France " qui
 * rendent les agrégats (patrimoine par pays, résidence fiscale, etc.)
 * impossibles à fiabiliser. Les pays les plus fréquents pour la clientèle PEV
 * (France d'abord, puis zone euro / frontaliers) sont épinglés en tête de
 * liste.
 *
 * Les valeurs stockées en base sont les libellés FR (pas les codes ISO) pour
 * préserver la lisibilité des exports CSV, des bannières d'audit et des
 * fiches PDF signées. Un champ `code` ISO-2 est fourni pour d'éventuels
 * appels API externes.
 *
 * ### Filtrage sanctions
 *
 * La liste exportée `COUNTRIES` est filtrée au chargement pour exclure les
 * juridictions sous GAFI call-for-action et sous sanctions financières UE
 * complètes (voir `pays-blacklist.ts` pour la liste et les sources). Les
 * valeurs historiquement stockées en base pour un client continuent de
 * s'afficher grâce au fallback « valeur existante » des <select> côté UI et
 * à `normalizeCountry()` qui reste lookup-exhaustif (y compris les pays
 * filtrés), de sorte que la lecture du legacy ne se casse pas.
 *
 * Si besoin de la liste complète non filtrée (export, audit, statistiques) :
 * utiliser `COUNTRIES_ALL` / `COUNTRY_NAMES_ALL`.
 */

import { BLACKLIST_CODES } from './pays-blacklist'

export interface Country {
  name: string
  code: string
}

/** Pays épinglés en tête de liste (ordre métier PEV). */
const PINNED: Country[] = [
  { name: 'France', code: 'FR' },
  { name: 'Belgique', code: 'BE' },
  { name: 'Luxembourg', code: 'LU' },
  { name: 'Suisse', code: 'CH' },
  { name: 'Monaco', code: 'MC' },
  { name: 'Andorre', code: 'AD' },
]

/** Le reste de la liste, ordonnée alphabétiquement. */
const OTHERS: Country[] = [
  { name: 'Afghanistan', code: 'AF' },
  { name: 'Afrique du Sud', code: 'ZA' },
  { name: 'Albanie', code: 'AL' },
  { name: 'Algérie', code: 'DZ' },
  { name: 'Allemagne', code: 'DE' },
  { name: 'Angola', code: 'AO' },
  { name: 'Antigua-et-Barbuda', code: 'AG' },
  { name: 'Arabie saoudite', code: 'SA' },
  { name: 'Argentine', code: 'AR' },
  { name: 'Arménie', code: 'AM' },
  { name: 'Australie', code: 'AU' },
  { name: 'Autriche', code: 'AT' },
  { name: 'Azerbaïdjan', code: 'AZ' },
  { name: 'Bahamas', code: 'BS' },
  { name: 'Bahreïn', code: 'BH' },
  { name: 'Bangladesh', code: 'BD' },
  { name: 'Barbade', code: 'BB' },
  { name: 'Bélarus', code: 'BY' },
  { name: 'Belize', code: 'BZ' },
  { name: 'Bénin', code: 'BJ' },
  { name: 'Bhoutan', code: 'BT' },
  { name: 'Bolivie', code: 'BO' },
  { name: 'Bosnie-Herzégovine', code: 'BA' },
  { name: 'Botswana', code: 'BW' },
  { name: 'Brésil', code: 'BR' },
  { name: 'Brunei', code: 'BN' },
  { name: 'Bulgarie', code: 'BG' },
  { name: 'Burkina Faso', code: 'BF' },
  { name: 'Burundi', code: 'BI' },
  { name: 'Cambodge', code: 'KH' },
  { name: 'Cameroun', code: 'CM' },
  { name: 'Canada', code: 'CA' },
  { name: 'Cap-Vert', code: 'CV' },
  { name: 'Chili', code: 'CL' },
  { name: 'Chine', code: 'CN' },
  { name: 'Chypre', code: 'CY' },
  { name: 'Colombie', code: 'CO' },
  { name: 'Comores', code: 'KM' },
  { name: 'Congo (Brazzaville)', code: 'CG' },
  { name: 'Congo (RDC)', code: 'CD' },
  { name: 'Corée du Nord', code: 'KP' },
  { name: 'Corée du Sud', code: 'KR' },
  { name: 'Costa Rica', code: 'CR' },
  { name: "Côte d'Ivoire", code: 'CI' },
  { name: 'Croatie', code: 'HR' },
  { name: 'Cuba', code: 'CU' },
  { name: 'Danemark', code: 'DK' },
  { name: 'Djibouti', code: 'DJ' },
  { name: 'Dominique', code: 'DM' },
  { name: 'Égypte', code: 'EG' },
  { name: 'Émirats arabes unis', code: 'AE' },
  { name: 'Équateur', code: 'EC' },
  { name: 'Érythrée', code: 'ER' },
  { name: 'Espagne', code: 'ES' },
  { name: 'Estonie', code: 'EE' },
  { name: 'Eswatini', code: 'SZ' },
  { name: 'États-Unis', code: 'US' },
  { name: 'Éthiopie', code: 'ET' },
  { name: 'Fidji', code: 'FJ' },
  { name: 'Finlande', code: 'FI' },
  { name: 'Gabon', code: 'GA' },
  { name: 'Gambie', code: 'GM' },
  { name: 'Géorgie', code: 'GE' },
  { name: 'Ghana', code: 'GH' },
  { name: 'Grèce', code: 'GR' },
  { name: 'Grenade', code: 'GD' },
  { name: 'Guatemala', code: 'GT' },
  { name: 'Guinée', code: 'GN' },
  { name: 'Guinée équatoriale', code: 'GQ' },
  { name: 'Guinée-Bissau', code: 'GW' },
  { name: 'Guyana', code: 'GY' },
  { name: 'Haïti', code: 'HT' },
  { name: 'Honduras', code: 'HN' },
  { name: 'Hongrie', code: 'HU' },
  { name: 'Îles Marshall', code: 'MH' },
  { name: 'Îles Salomon', code: 'SB' },
  { name: 'Inde', code: 'IN' },
  { name: 'Indonésie', code: 'ID' },
  { name: 'Irak', code: 'IQ' },
  { name: 'Iran', code: 'IR' },
  { name: 'Irlande', code: 'IE' },
  { name: 'Islande', code: 'IS' },
  { name: 'Israël', code: 'IL' },
  { name: 'Italie', code: 'IT' },
  { name: 'Jamaïque', code: 'JM' },
  { name: 'Japon', code: 'JP' },
  { name: 'Jordanie', code: 'JO' },
  { name: 'Kazakhstan', code: 'KZ' },
  { name: 'Kenya', code: 'KE' },
  { name: 'Kirghizistan', code: 'KG' },
  { name: 'Kiribati', code: 'KI' },
  { name: 'Kosovo', code: 'XK' },
  { name: 'Koweït', code: 'KW' },
  { name: 'Laos', code: 'LA' },
  { name: 'Lesotho', code: 'LS' },
  { name: 'Lettonie', code: 'LV' },
  { name: 'Liban', code: 'LB' },
  { name: 'Libéria', code: 'LR' },
  { name: 'Libye', code: 'LY' },
  { name: 'Liechtenstein', code: 'LI' },
  { name: 'Lituanie', code: 'LT' },
  { name: 'Macédoine du Nord', code: 'MK' },
  { name: 'Madagascar', code: 'MG' },
  { name: 'Malaisie', code: 'MY' },
  { name: 'Malawi', code: 'MW' },
  { name: 'Maldives', code: 'MV' },
  { name: 'Mali', code: 'ML' },
  { name: 'Malte', code: 'MT' },
  { name: 'Maroc', code: 'MA' },
  { name: 'Maurice', code: 'MU' },
  { name: 'Mauritanie', code: 'MR' },
  { name: 'Mexique', code: 'MX' },
  { name: 'Micronésie', code: 'FM' },
  { name: 'Moldavie', code: 'MD' },
  { name: 'Mongolie', code: 'MN' },
  { name: 'Monténégro', code: 'ME' },
  { name: 'Mozambique', code: 'MZ' },
  { name: 'Myanmar (Birmanie)', code: 'MM' },
  { name: 'Namibie', code: 'NA' },
  { name: 'Nauru', code: 'NR' },
  { name: 'Népal', code: 'NP' },
  { name: 'Nicaragua', code: 'NI' },
  { name: 'Niger', code: 'NE' },
  { name: 'Nigéria', code: 'NG' },
  { name: 'Norvège', code: 'NO' },
  { name: 'Nouvelle-Zélande', code: 'NZ' },
  { name: 'Oman', code: 'OM' },
  { name: 'Ouganda', code: 'UG' },
  { name: 'Ouzbékistan', code: 'UZ' },
  { name: 'Pakistan', code: 'PK' },
  { name: 'Palaos', code: 'PW' },
  { name: 'Palestine', code: 'PS' },
  { name: 'Panama', code: 'PA' },
  { name: 'Papouasie-Nouvelle-Guinée', code: 'PG' },
  { name: 'Paraguay', code: 'PY' },
  { name: 'Pays-Bas', code: 'NL' },
  { name: 'Pérou', code: 'PE' },
  { name: 'Philippines', code: 'PH' },
  { name: 'Pologne', code: 'PL' },
  { name: 'Portugal', code: 'PT' },
  { name: 'Qatar', code: 'QA' },
  { name: 'République centrafricaine', code: 'CF' },
  { name: 'République dominicaine', code: 'DO' },
  { name: 'République tchèque', code: 'CZ' },
  { name: 'Roumanie', code: 'RO' },
  { name: 'Royaume-Uni', code: 'GB' },
  { name: 'Russie', code: 'RU' },
  { name: 'Rwanda', code: 'RW' },
  { name: 'Saint-Christophe-et-Niévès', code: 'KN' },
  { name: 'Saint-Marin', code: 'SM' },
  { name: 'Saint-Vincent-et-les-Grenadines', code: 'VC' },
  { name: 'Sainte-Lucie', code: 'LC' },
  { name: 'Salvador', code: 'SV' },
  { name: 'Samoa', code: 'WS' },
  { name: 'São Tomé-et-Principe', code: 'ST' },
  { name: 'Sénégal', code: 'SN' },
  { name: 'Serbie', code: 'RS' },
  { name: 'Seychelles', code: 'SC' },
  { name: 'Sierra Leone', code: 'SL' },
  { name: 'Singapour', code: 'SG' },
  { name: 'Slovaquie', code: 'SK' },
  { name: 'Slovénie', code: 'SI' },
  { name: 'Somalie', code: 'SO' },
  { name: 'Soudan', code: 'SD' },
  { name: 'Soudan du Sud', code: 'SS' },
  { name: 'Sri Lanka', code: 'LK' },
  { name: 'Suède', code: 'SE' },
  { name: 'Suriname', code: 'SR' },
  { name: 'Syrie', code: 'SY' },
  { name: 'Tadjikistan', code: 'TJ' },
  { name: 'Taïwan', code: 'TW' },
  { name: 'Tanzanie', code: 'TZ' },
  { name: 'Tchad', code: 'TD' },
  { name: 'Thaïlande', code: 'TH' },
  { name: 'Timor oriental', code: 'TL' },
  { name: 'Togo', code: 'TG' },
  { name: 'Tonga', code: 'TO' },
  { name: 'Trinité-et-Tobago', code: 'TT' },
  { name: 'Tunisie', code: 'TN' },
  { name: 'Turkménistan', code: 'TM' },
  { name: 'Turquie', code: 'TR' },
  { name: 'Tuvalu', code: 'TV' },
  { name: 'Ukraine', code: 'UA' },
  { name: 'Uruguay', code: 'UY' },
  { name: 'Vanuatu', code: 'VU' },
  { name: 'Vatican', code: 'VA' },
  { name: 'Venezuela', code: 'VE' },
  { name: 'Viêt Nam', code: 'VN' },
  { name: 'Yémen', code: 'YE' },
  { name: 'Zambie', code: 'ZM' },
  { name: 'Zimbabwe', code: 'ZW' },
]

/**
 * Liste complète non filtrée (ISO 3166-1 entière), utile pour :
 *  - les fonctions de lookup/normalisation qui doivent reconnaître les noms
 *    historiques même quand ils sont devenus bloqués (sinon `normalizeCountry`
 *    renverrait `undefined` pour un client créé avant la revue de la liste
 *    noire, et le champ disparaîtrait à la relecture),
 *  - les exports/statistiques d'audit qui doivent pouvoir présenter tous les
 *    pays saisis en base sans masquer silencieusement les cas legacy.
 */
export const COUNTRIES_ALL: readonly Country[] = [...PINNED, ...OTHERS]

/**
 * Liste exposée aux saisies utilisateur — les juridictions sous sanctions
 * (GAFI call-for-action + UE financières complètes) sont retirées. Voir
 * `pays-blacklist.ts` pour les codes exclus et leurs sources.
 */
export const COUNTRIES: Country[] = COUNTRIES_ALL.filter(
  (c) => !BLACKLIST_CODES.has(c.code),
)

/** Noms seulement (pratique pour les select simples). Liste filtrée. */
export const COUNTRY_NAMES: string[] = COUNTRIES.map((c) => c.name)

/** Variante non filtrée (pour exports / audit). */
export const COUNTRY_NAMES_ALL: string[] = COUNTRIES_ALL.map((c) => c.name)

/**
 * Tente de résoudre une saisie libre legacy (ex: "france", "FR", "France ")
 * vers un nom canonique. Renvoie undefined si inconnu.
 *
 * Important : le lookup se fait sur `COUNTRIES_ALL` (liste non filtrée) pour
 * que les valeurs historiques de clients créés avant la mise en place de la
 * blacklist restent affichables. L'appelant qui veut un check conformité
 * doit utiliser `isBlacklisted()` depuis `pays-blacklist.ts`.
 */
export function normalizeCountry(input: string | null | undefined): string | undefined {
  if (!input) return undefined
  const clean = input.trim()
  if (!clean) return undefined
  const lower = clean.toLowerCase()
  const byName = COUNTRIES_ALL.find((c) => c.name.toLowerCase() === lower)
  if (byName) return byName.name
  const upper = clean.toUpperCase()
  const byCode = COUNTRIES_ALL.find((c) => c.code === upper)
  if (byCode) return byCode.name
  return undefined
}
