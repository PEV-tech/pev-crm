/**
 * KYC completion calculator.
 *
 * Définit la liste des champs requis pour considérer un KYC "complet" et
 * calcule un pourcentage + la liste des champs manquants à partir d'un objet
 * client issu de Supabase.
 *
 * La liste a été dérivée des sections de `components/clients/kyc-section.tsx` :
 * état civil, situation familiale, situation professionnelle, revenus,
 * patrimoine immobilier, produits financiers, emprunts, fiscalité, objectifs.
 * Les collections (patrimoine, produits, emprunts) ne sont pas comptées comme
 * requises individuellement — leur absence est normale pour beaucoup de
 * clients. On compte uniquement les champs de « profil » sans lesquels un
 * conseil patrimonial est difficile à produire.
 */

// Champs considérés requis pour qu'un KYC soit « complet ».
// L'ordre impacte l'affichage côté UI (on affiche les manquants dans cet ordre).
export const REQUIRED_KYC_FIELDS = [
  // État civil
  { key: 'titre', label: 'Titre (M./Mme)' },
  { key: 'date_naissance', label: 'Date de naissance' },
  { key: 'lieu_naissance', label: 'Lieu de naissance' },
  { key: 'nationalite', label: 'Nationalité' },
  { key: 'residence_fiscale', label: 'Résidence fiscale' },
  { key: 'adresse', label: 'Adresse' },
  { key: 'ville', label: 'Ville' },
  { key: 'pays', label: 'Pays' },
  { key: 'telephone', label: 'Téléphone' },
  { key: 'email', label: 'Email' },
  // Situation familiale
  { key: 'situation_matrimoniale', label: 'Situation matrimoniale' },
  // Situation professionnelle
  { key: 'profession', label: 'Profession' },
  { key: 'statut_professionnel', label: 'Statut professionnel' },
  // Revenus
  { key: 'revenus_pro_net', label: 'Revenus professionnels nets' },
  { key: 'total_revenus_annuel', label: 'Total revenus annuels' },
  // Fiscalité
  { key: 'impot_revenu_n', label: 'Impôt sur le revenu (N)' },
  // Objectifs
  { key: 'objectifs_client', label: 'Objectifs client' },
] as const

export type RequiredKycKey = (typeof REQUIRED_KYC_FIELDS)[number]['key']

export interface KycCompletionResult {
  /** Pourcentage entier 0–100. */
  rate: number
  /** Nombre de champs requis remplis. */
  filled: number
  /** Nombre total de champs requis. */
  total: number
  /** Liste ordonnée des clés manquantes. */
  missingKeys: RequiredKycKey[]
  /** Labels lisibles des champs manquants (pour UI). */
  missingLabels: string[]
  /** true si rate === 100. */
  isComplete: boolean
}

/**
 * Détecte si un champ est « rempli ». Gère :
 * - undefined / null  → vide
 * - string vide ou whitespace → vide
 * - number 0 → REMPLI (0 est une valeur valide, ex: 0 € de revenus fonciers)
 * - boolean false → REMPLI
 */
function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

/**
 * Calcule la complétude KYC d'un client.
 * @param client objet Supabase (Row de la table clients, typage large).
 */
export function computeKycCompletion(
  client: Record<string, unknown> | null | undefined
): KycCompletionResult {
  const total = REQUIRED_KYC_FIELDS.length

  if (!client) {
    return {
      rate: 0,
      filled: 0,
      total,
      missingKeys: REQUIRED_KYC_FIELDS.map((f) => f.key),
      missingLabels: REQUIRED_KYC_FIELDS.map((f) => f.label),
      isComplete: false,
    }
  }

  const missing: { key: RequiredKycKey; label: string }[] = []
  let filled = 0

  for (const field of REQUIRED_KYC_FIELDS) {
    if (isFilled(client[field.key])) {
      filled += 1
    } else {
      missing.push({ key: field.key, label: field.label })
    }
  }

  const rate = Math.round((filled / total) * 100)

  return {
    rate,
    filled,
    total,
    missingKeys: missing.map((m) => m.key),
    missingLabels: missing.map((m) => m.label),
    isComplete: filled === total,
  }
}
