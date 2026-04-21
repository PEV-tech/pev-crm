/**
 * Synchronisation bidirectionnelle des actifs détenus en commun.
 *
 * Contexte métier
 * ---------------
 * Un couple (client + co-titulaire) peut détenir un même bien. Pour éviter la
 * duplication (et les divergences qui en résultent), la ligne est stockée UNE
 * SEULE FOIS, sur la fiche du client principal (celui qui a créé la ligne),
 * avec deux attributs :
 *
 *   - `detenteur_type` = 'joint'
 *   - `co_titulaire_client_id` = UUID de l'autre client/dossier PEV
 *
 * Lorsqu'on affiche la fiche KYC du co-titulaire (le client B), on interroge
 * les fiches des autres clients pour récupérer leurs lignes marquées
 * `joint` dont le `co_titulaire_client_id` pointe vers B — on les affiche
 * en lecture seule, avec un badge « Joint avec [Prénom Nom] — édition sur
 * son dossier ».
 *
 * Pourquoi pas une table normalisée ?
 * -----------------------------------
 * Le schéma historique stocke les actifs dans des colonnes JSONB sur la table
 * `clients` (`patrimoine_immobilier`, `produits_financiers`, `patrimoine_divers`,
 * `emprunts`). Normaliser à ce stade serait un très gros chantier (migration
 * de toutes les fiches existantes, réécriture du flow d'édition, de l'import
 * Excel, de la génération PDF). On garde le JSONB et on fait la sync au read
 * via ce helper — performance OK pour un cabinet (~200 fiches).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Identifiant des 4 sections d'actifs stockées en JSONB sur `clients`. */
export type AssetSection =
  | 'patrimoine_immobilier'
  | 'produits_financiers'
  | 'patrimoine_divers'
  | 'emprunts'

export const ASSET_SECTIONS: readonly AssetSection[] = [
  'patrimoine_immobilier',
  'produits_financiers',
  'patrimoine_divers',
  'emprunts',
] as const

/**
 * Ligne d'actif « externe » : appartient à un autre client mais marquée
 * joint avec le client courant. On conserve les infos de provenance pour
 * l'affichage (badge + lien « éditer sur son dossier »).
 */
export interface ExternalJointAsset {
  /** Section d'origine. */
  section: AssetSection
  /** Index de la ligne dans le tableau JSONB du client source (pour les liens). */
  source_index: number
  /** UUID du client qui détient la ligne (source de vérité pour l'édition). */
  source_client_id: string
  /** Nom d'affichage "Prénom Nom" pour le badge. */
  source_client_display: string
  /** La ligne elle-même, forme JSONB opaque (garde tous les attributs). */
  row: Record<string, unknown>
}

/**
 * Retourne les actifs « joints » venant d'autres clients et référençant
 * `currentClientId` via `co_titulaire_client_id`.
 *
 * Implémentation : on récupère toutes les fiches clients ayant au moins une
 * colonne JSONB non vide, puis on filtre côté JS. Pour ~200 fiches c'est
 * acceptable. Si le volume grandit, ajouter un index fonctionnel ou extraire
 * les actifs dans une table `actifs` dédiée (refactor majeur, pas pour V1).
 */
export async function fetchExternalJointAssets(
  supabase: SupabaseClient,
  currentClientId: string,
): Promise<ExternalJointAsset[]> {
  if (!currentClientId) return []

  // On scanne les fiches susceptibles de référencer le client courant.
  // Pas de filtrage SQL précis (les opérateurs JSONB de Supabase sur un
  // tableau d'objets imbriqués sont verbeux) : on récupère tout et on filtre
  // en JS. Projection minimale pour limiter le volume.
  const { data, error } = await supabase
    .from('clients')
    .select(
      'id,nom,prenom,patrimoine_immobilier,produits_financiers,patrimoine_divers,emprunts',
    )
    .neq('id', currentClientId)

  if (error) {
    // On log mais on ne casse pas le rendu — la fiche reste affichable
    // avec uniquement les actifs « locaux ».
    console.error('[kyc-bidi] fetchExternalJointAssets failed:', error)
    return []
  }

  const out: ExternalJointAsset[] = []

  for (const client of data ?? []) {
    const display = `${client.prenom ?? ''} ${client.nom ?? ''}`.trim() || '—'

    for (const section of ASSET_SECTIONS) {
      const arr = (client as Record<string, unknown>)[section]
      if (!Array.isArray(arr)) continue

      arr.forEach((row, idx) => {
        if (!row || typeof row !== 'object') return
        const r = row as Record<string, unknown>
        if (r.detenteur_type !== 'joint') return
        if (r.co_titulaire_client_id !== currentClientId) return

        out.push({
          section,
          source_index: idx,
          source_client_id: client.id,
          source_client_display: display,
          row: r,
        })
      })
    }
  }

  return out
}

/**
 * Retourne la liste des clients PEV exploitable comme options de co-titulaire.
 * Utilisée pour peupler le <select> lors de la saisie d'un actif joint.
 *
 * On exclut le client courant (on ne peut pas être co-titulaire de soi-même)
 * et on trie par nom/prénom.
 */
export interface CoTitulaireOption {
  id: string
  label: string
}

export async function fetchCoTitulaireOptions(
  supabase: SupabaseClient,
  currentClientId: string,
): Promise<CoTitulaireOption[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id,nom,prenom')
    .neq('id', currentClientId)
    .order('nom', { ascending: true })
    .order('prenom', { ascending: true })

  if (error) {
    console.error('[kyc-bidi] fetchCoTitulaireOptions failed:', error)
    return []
  }

  return (data ?? []).map((c: { id: string; nom: string | null; prenom: string | null }) => ({
    id: c.id,
    label: `${c.prenom ?? ''} ${c.nom ?? ''}`.trim() || '—',
  }))
}
