/**
 * Liste des juridictions exclues des saisies KYC pour un cabinet de conseil
 * patrimonial français soumis au droit de l'Union européenne.
 *
 * Deux sources publiques de référence, cumulées :
 *
 * 1. GAFI/FATF — « High-Risk Jurisdictions subject to a Call for Action »
 *    (publication trimestrielle : https://www.fatf-gafi.org/en/publications/
 *     High-risk-and-other-monitored-jurisdictions.html)
 *    Ces juridictions imposent des contre-mesures et justifient le refus de
 *    tout nouvel engagement commercial.
 *
 * 2. UE — Règlements de sanctions financières globales en vigueur :
 *    - Règlement (UE) 833/2014 (Russie, amendé 2022)
 *    - Règlement (UE) 765/2006 (Bélarus, amendé 2022)
 *    - Règlement (UE) 36/2012 (Syrie)
 *    - Règlement (UE) 267/2012 (Iran)
 *    - Règlement (UE) 2020/1998 (régime global droits humains)
 *    - Règlement (UE) 753/2011 (Afghanistan / régime taliban)
 *    - Règlement (CE) 2580/2001 et PESC 2018/1544 (Venezuela, ciblé)
 *
 * Note : les pays de la « liste grise » GAFI (sous surveillance renforcée
 * mais pas « call for action » — ex: Croatie, Bulgarie, Nigéria, Sénégal,
 * Vietnam…) ne sont PAS bloqués ici. Ils restent sélectionnables dans les
 * formulaires et relèvent d'une vigilance renforcée (EDD) côté consultant.
 * Ajouter ces pays ici bloquerait une clientèle francophone légitime.
 *
 * Politique produit (Maxine Laisné, 2026-04-21) : on bloque les 3 juridictions
 * GAFI call-for-action + les pays sous sanctions financières UE complètes.
 * Les valeurs historiques déjà saisies pour un client continueront de
 * s'afficher grâce au fallback « valeur existante » des <select> dans
 * `kyc-section.tsx` — la filtration agit uniquement sur les NOUVELLES saisies.
 */

export interface BlacklistEntry {
  code: string
  reason: string
  source: string
}

export const BLACKLIST: readonly BlacklistEntry[] = [
  {
    code: 'KP',
    reason: 'Corée du Nord — GAFI call-for-action + sanctions UN',
    source: 'FATF + UNSC Res. 1718/2321',
  },
  {
    code: 'IR',
    reason: 'Iran — GAFI call-for-action + sanctions UE/UN',
    source: 'FATF + Règlement (UE) 267/2012',
  },
  {
    code: 'MM',
    reason: 'Myanmar (Birmanie) — GAFI call-for-action (depuis 2022)',
    source: 'FATF',
  },
  {
    code: 'RU',
    reason: 'Russie — sanctions financières UE complètes',
    source: 'Règlement (UE) 833/2014 tel qu\'amendé',
  },
  {
    code: 'BY',
    reason: 'Bélarus — sanctions financières UE complètes',
    source: 'Règlement (UE) 765/2006 tel qu\'amendé',
  },
  {
    code: 'SY',
    reason: 'Syrie — sanctions UE complètes + UN',
    source: 'Règlement (UE) 36/2012',
  },
  {
    code: 'AF',
    reason: 'Afghanistan — sanctions UE/UN (régime taliban)',
    source: 'Règlement (UE) 753/2011',
  },
  {
    code: 'CU',
    reason: 'Cuba — risque sanctions secondaires OFAC (extraterritorialité)',
    source: 'Politique interne PEV (alignement risque US)',
  },
  {
    code: 'VE',
    reason: 'Venezuela — sanctions ciblées UE',
    source: 'PESC 2017/2074',
  },
] as const

/** Set des codes ISO-2 bloqués (accès O(1) dans les filtres). */
export const BLACKLIST_CODES: ReadonlySet<string> = new Set(
  BLACKLIST.map((e) => e.code),
)

/**
 * Date de dernière revue de la liste. À mettre à jour à chaque modification
 * (les listes GAFI/UE évoluent environ tous les trimestres).
 */
export const BLACKLIST_LAST_REVIEW = '2026-04-21'

/** Utilitaire pratique pour l'affichage côté UI (explication à l'utilisateur). */
export function isBlacklisted(code: string | null | undefined): boolean {
  if (!code) return false
  return BLACKLIST_CODES.has(code.toUpperCase())
}
