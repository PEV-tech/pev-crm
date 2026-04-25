'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  Shield,
  PenLine,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Mail,
  Send,
  Loader2,
  Clock,
  Eye,
} from 'lucide-react'
import { computeKycCompletion } from '@/lib/kyc-completion'
import { computeEndettement, formatBreakdown } from '@/lib/kyc-endettement'
import { COUNTRY_NAMES } from '@/lib/countries'
import {
  LOGEMENT_OPTIONS,
  REGIME_MATRIMONIAL_OPTIONS,
  SITUATION_MATRIMONIALE_OPTIONS,
  TYPE_BIEN_IMMOBILIER_OPTIONS,
  TYPE_PRODUIT_FINANCIER_OPTIONS,
  TYPE_DETENTION_OPTIONS,
  DETENTEUR_TYPE_OPTIONS,
  DETENTEUR_TYPE_LABELS,
  PATRIMOINE_PRO_CATEGORIE_OPTIONS,
  PATRIMOINE_PRO_SOUS_CATEGORIE_OPTIONS,
  labelCategoriePro,
  labelSousCategoriePro,
  normalizeDetenteurType,
  needsRegimeMatrimonial,
  getRegimesForSituation,
  type DetenteurType,
} from '@/lib/kyc-enums'
import {
  fetchCoTitulaireOptions,
  fetchExternalJointAssets,
  type CoTitulaireOption,
  type ExternalJointAsset,
} from '@/lib/kyc-bidi'
import { KYCSignatureDialog } from './kyc-signature-dialog'

interface KYCSectionProps {
  client: any // The full client object from Supabase with all KYC fields
  onUpdate: () => void // Callback to refresh after save
}

type SectionKey =
  | 'etat_civil'
  | 'situation_familiale'
  | 'situation_professionnelle'
  | 'revenus'
  | 'patrimoine_immobilier'
  | 'patrimoine_professionnel'
  | 'produits_financiers'
  | 'emprunts'
  | 'fiscalite'
  | 'objectifs'

interface EditState {
  [key: string]: any
}

export interface KYCSectionHandle {
  populateFromKyc: (data: any) => void
}

// Shapes des lignes stockées dans les colonnes JSONB du client.
// On reste volontairement en "partial" (tous champs optionnels) car
// les entrées legacy peuvent manquer de colonnes récentes — les
// composants de rendu gèrent déjà les cas `undefined`.
//
// Champs communs ajoutés 2026-04-21 (Chantier #2) :
//   - `detenteur_type` : 'client' | 'co_titulaire' | 'joint'
//      (rôle du détenteur au sein du couple/dossier — cf. kyc-enums.ts)
//   - `co_titulaire_client_id` : UUID du client co-détenteur, requis
//      pour 'co_titulaire' et 'joint', null sinon.
interface ImmobilierRow {
  type_bien?: string
  designation?: string
  date_acq?: string
  valeur_acq?: number
  valeur_actuelle?: number
  detention?: string
  proportion?: number | null
  taux_credit?: number
  duree_credit?: number
  crd?: number
  charges?: number
  detenteur_type?: DetenteurType
  co_titulaire_client_id?: string | null
}

interface ProduitFinancierRow {
  type_produit?: string
  designation?: string
  /**
   * @deprecated champ texte libre historique — remplacé par `detenteur_type`
   * + `co_titulaire_client_id`. Conservé pour back-compat lecture des fiches
   * anciennes (sera supprimé quand les fiches existantes auront été migrées).
   */
  detenteur?: string
  valeur?: number
  date_ouverture?: string
  versements_reguliers?: string
  rendement?: number
  detenteur_type?: DetenteurType
  co_titulaire_client_id?: string | null
}

interface EmpruntRow {
  designation?: string
  etablissement?: string
  montant?: number
  date?: string
  duree?: string
  taux?: number
  crd?: number
  /** Date de fin (maturité) — format ISO 'YYYY-MM-DD'. Historiquement
   *  mal nommé « échéance » dans l'UI (d'où l'ambiguïté — cf. Chantier #3). */
  echeance?: string
  /** Montant de l'échéance mensuelle en euros. Obligatoire côté métier
   *  pour le calcul du taux d'endettement (Chantier #3, 2026-04-21).
   *  Optionnel côté type car les fiches legacy ne le renseignent pas encore. */
  echeance_mensuelle?: number
  detenteur_type?: DetenteurType
  co_titulaire_client_id?: string | null
}

// DiversRow n'est pas encore rendu dans une table éditable (la section
// "patrimoine_divers" est persistée mais sans UI dédiée en V1). Quand
// elle le sera, elle devra suivre la même convention (detenteur_type +
// co_titulaire_client_id) pour rester compatible avec la sync bidi.

/**
 * Ligne de patrimoine professionnel (point 1.6 corrections 2026-04-24).
 * Stockée dans `clients.patrimoine_professionnel` (JSONB array).
 *
 * - `categorie` : immo_pro (locaux, véhicule…) vs financier_pro (BFR,
 *    trésorerie…). Utilisé pour regrouper l'affichage sur 2 blocs.
 * - `sous_categorie` : locaux / bfr / tresorerie / outils_machines /
 *    vehicule / autre. Liste commune aux 2 blocs, libre côté UI.
 * - `designation` : libellé libre (ex: « Entrepôt 12 rue X »).
 * - `valeur` : valorisation en EUR (nombre).
 * - `description` : commentaire libre optionnel.
 * - `detenteur_type` / `co_titulaire_client_id` : idem autres rows pour
 *    rester homogène avec la sync bidi (valeurs optionnelles MVP).
 */
interface PatrimoineProRow {
  categorie?: 'immo_pro' | 'financier_pro'
  sous_categorie?:
    | 'locaux'
    | 'bfr'
    | 'tresorerie'
    | 'outils_machines'
    | 'vehicule'
    | 'autre'
  designation?: string
  valeur?: number
  description?: string
  detenteur_type?: DetenteurType
  co_titulaire_client_id?: string | null
}

const KYCSection = React.forwardRef<KYCSectionHandle, KYCSectionProps>(
  ({ client, onUpdate }, ref) => {
    const [isEditMode, setIsEditMode] = React.useState(false)
    const [expandedSections, setExpandedSections] = React.useState<Set<SectionKey>>(
      new Set()
    )
    const [editData, setEditData] = React.useState<EditState>({})
    // Options pour le <select> co-titulaire (autres clients PEV).
    const [coTitulaireOptions, setCoTitulaireOptions] = React.useState<
      CoTitulaireOption[]
    >([])
    // Actifs « joints » détenus par d'autres clients qui référencent le client
    // courant — affichés en lecture seule (édition sur le dossier source).
    const [externalJointAssets, setExternalJointAssets] = React.useState<
      ExternalJointAsset[]
    >([])
    const [saving, setSaving] = React.useState(false)
    const [signatureOpen, setSignatureOpen] = React.useState(false)
    const [linkBusy, setLinkBusy] = React.useState<null | 'copy' | 'email' | 'send_auto'>(null)
    const [linkFeedback, setLinkFeedback] = React.useState<string | null>(null)

    const supabase = React.useMemo(() => createClient(), [])

    // Chargement asynchrone des données liées au Détenteur (Chantier #2) :
    // - Liste des autres clients PEV pour peupler le <select> co-titulaire.
    // - Actifs « joints » d'autres clients qui référencent le client courant,
    //   affichés en lecture seule avec un badge d'origine.
    // Tolérant aux erreurs (tableaux vides si la requête échoue).
    React.useEffect(() => {
      if (!client?.id) {
        setCoTitulaireOptions([])
        setExternalJointAssets([])
        return
      }
      let cancelled = false
      ;(async () => {
        const [options, external] = await Promise.all([
          fetchCoTitulaireOptions(supabase, client.id),
          fetchExternalJointAssets(supabase, client.id),
        ])
        if (cancelled) return
        setCoTitulaireOptions(options)
        setExternalJointAssets(external)
      })()
      return () => {
        cancelled = true
      }
    }, [client?.id, supabase])

    // Complétude calculée à partir du client actuel (recalculée à chaque
    // changement de props — les edits en cours ne comptent pas tant que
    // non sauvés, comportement voulu pour que la signature reflète l'état
    // persisté).
    const completion = React.useMemo(() => computeKycCompletion(client), [client])
    const kycSignedAt: string | null = client?.kyc_signed_at ?? null
    const kycIncompleteSigned: boolean = client?.kyc_incomplete_signed === true
    const kycSignerName: string | null = client?.kyc_signer_name ?? null
    const kycCompletionAtSign: number | null = client?.kyc_completion_rate ?? null
    const kycPdfPath: string | null = client?.kyc_pdf_storage_path ?? null
    const kycPdfUrl: string | null =
      kycPdfPath && client?.id ? `/api/kyc/pdf/${client.id}` : null

    // Statut dérivé du workflow lien public : Brouillon → Envoyé → En cours → Signé.
    // "Signé incomplet" est un sous-état de Signé traité visuellement via
    // kycIncompleteSigned au-dessus.
    const kycToken: string | null = client?.kyc_token ?? null
    const kycSentAt: string | null = client?.kyc_sent_at ?? null
    const kycOpenedAt: string | null = client?.kyc_opened_at ?? null
    const kycStatus: 'brouillon' | 'envoye' | 'en_cours' | 'signe' = kycSignedAt
      ? 'signe'
      : kycOpenedAt
      ? 'en_cours'
      : kycSentAt
      ? 'envoye'
      : 'brouillon'

    // Initialize edit state from client props on mount or when client changes
    React.useEffect(() => {
      const initialData: EditState = {
        titre: client?.titre,
        nom_jeune_fille: client?.nom_jeune_fille,
        date_naissance: client?.date_naissance,
        lieu_naissance: client?.lieu_naissance,
        nationalite: client?.nationalite,
        residence_fiscale: client?.residence_fiscale,
        nif: client?.nif,
        adresse: client?.adresse,
        code_postal: client?.code_postal,
        ville: client?.ville,
        pays: client?.pays,
        proprietaire_locataire: client?.proprietaire_locataire,
        montant_loyer: client?.montant_loyer,
        charges_residence_principale: client?.charges_residence_principale,
        situation_matrimoniale: client?.situation_matrimoniale,
        regime_matrimonial: client?.regime_matrimonial,
        nombre_enfants: client?.nombre_enfants,
        enfants_details: client?.enfants_details,
        profession: client?.profession,
        statut_professionnel: client?.statut_professionnel,
        employeur: client?.employeur,
        date_debut_emploi: client?.date_debut_emploi,
        revenus_pro_net: client?.revenus_pro_net,
        revenus_fonciers: client?.revenus_fonciers,
        autres_revenus: client?.autres_revenus,
        total_revenus_annuel: client?.total_revenus_annuel,
        impot_revenu_n: client?.impot_revenu_n,
        impot_revenu_n1: client?.impot_revenu_n1,
        impot_revenu_n2: client?.impot_revenu_n2,
        objectifs_client: client?.objectifs_client,
        patrimoine_immobilier: Array.isArray(client?.patrimoine_immobilier)
          ? client.patrimoine_immobilier
          : [],
        patrimoine_professionnel: Array.isArray(client?.patrimoine_professionnel)
          ? client.patrimoine_professionnel
          : [],
        produits_financiers: Array.isArray(client?.produits_financiers)
          ? client.produits_financiers
          : [],
        patrimoine_divers: Array.isArray(client?.patrimoine_divers)
          ? client.patrimoine_divers
          : [],
        emprunts: Array.isArray(client?.emprunts) ? client.emprunts : [],
      }
      setEditData(initialData)
    }, [client])

    // Expose populateFromKyc via ref — auto-saves after populating
    React.useImperativeHandle(
      ref,
      () => ({
        populateFromKyc: async (data: any) => {
          // Map titre value to display format
          let titreValue = data.titre
          if (titreValue === 'monsieur') titreValue = 'Monsieur'
          else if (titreValue === 'madame') titreValue = 'Madame'

          // Map situation_matrimoniale to display format
          let sitMatri = data.situation_matrimoniale
          const sitMap: Record<string, string> = {
            marie: 'Marié(e)', celibataire: 'Célibataire', divorce: 'Divorcé(e)',
            veuf: 'Veuf(ve)', pacse: 'Pacsé(e)', concubinage: 'Concubinage',
          }
          if (sitMatri && sitMap[sitMatri]) sitMatri = sitMap[sitMatri]

          // Map proprietaire_locataire to display format
          let proprio = data.proprietaire_locataire
          if (proprio === 'proprietaire') proprio = 'Propriétaire'
          else if (proprio === 'locataire') proprio = 'Locataire'

          const mappedData: EditState = {
            titre: titreValue,
            nom_jeune_fille: data.nom_jeune_fille,
            date_naissance: data.date_naissance,
            lieu_naissance: data.lieu_naissance,
            nationalite: data.nationalite,
            residence_fiscale: data.residence_fiscale,
            nif: data.nif,
            adresse: data.adresse,
            code_postal: data.code_postal,
            ville: data.ville,
            pays: data.pays,
            proprietaire_locataire: proprio,
            montant_loyer: data.montant_loyer,
            charges_residence_principale: data.charges_residence_principale,
            situation_matrimoniale: sitMatri,
            regime_matrimonial: data.regime_matrimonial,
            nombre_enfants: data.nombre_enfants,
            enfants_details: data.enfants_details,
            profession: data.profession,
            statut_professionnel: data.statut_professionnel,
            employeur: data.employeur,
            date_debut_emploi: data.date_debut_emploi,
            revenus_pro_net: data.revenus_pro_net,
            revenus_fonciers: data.revenus_fonciers,
            autres_revenus: data.autres_revenus,
            total_revenus_annuel: data.total_revenus_annuel,
            impot_revenu_n: data.impot_revenu_n,
            impot_revenu_n1: data.impot_revenu_n1,
            impot_revenu_n2: data.impot_revenu_n2,
            objectifs_client: data.objectifs_client,
            // Remap immobilier fields: parser uses valeur_acquisition/date_acquisition,
            // CRM uses valeur_acq/date_acq
            patrimoine_immobilier: (data.patrimoine_immobilier || []).map((item: any) => ({
              type_bien: item.type_bien || item.type || '',
              designation: item.designation || '',
              date_acq: item.date_acq || item.date_acquisition || '',
              valeur_acq: item.valeur_acq ?? item.valeur_acquisition ?? 0,
              valeur_actuelle: item.valeur_actuelle ?? 0,
              detention: item.detention || '',
              proportion:
                typeof item.proportion === 'number' ? item.proportion : 100,
              taux_credit: item.taux_credit ?? 0,
              duree_credit: item.duree_credit ?? 0,
              crd: item.crd ?? 0,
              charges: item.charges ?? 0,
            })),
            produits_financiers: (data.produits_financiers || []).map((item: any) => ({
              type_produit: item.type_produit || item.type || '',
              designation: item.designation || '',
              detenteur: item.detenteur || '',
              valeur: item.valeur ?? 0,
              date_ouverture: item.date_ouverture || '',
              versements_reguliers: item.versements_reguliers ?? 0,
              rendement: item.rendement ?? 0,
            })),
            patrimoine_divers: data.patrimoine_divers || [],
            // Remap emprunt fields: parser uses montant_emprunte/date_souscription,
            // CRM uses montant/date
            emprunts: (data.emprunts || []).map((item: any) => ({
              designation: item.designation || '',
              etablissement: item.etablissement || '',
              montant: item.montant ?? item.montant_emprunte ?? 0,
              date: item.date || item.date_souscription || '',
              duree: item.duree ?? '',
              taux: item.taux ?? 0,
              crd: item.crd ?? 0,
              echeance: item.echeance ?? '',
            })),
          }
          setEditData(mappedData)
          setIsEditMode(true)

          // Auto-save after populating
          if (!client.id) return
          try {
            const updatePayload: any = {
              titre: mappedData.titre,
              nom_jeune_fille: mappedData.nom_jeune_fille,
              date_naissance: mappedData.date_naissance,
              lieu_naissance: mappedData.lieu_naissance,
              nationalite: mappedData.nationalite,
              residence_fiscale: mappedData.residence_fiscale,
              nif: mappedData.nif,
              adresse: mappedData.adresse,
              ville: mappedData.ville,
              pays: mappedData.pays,
              proprietaire_locataire: mappedData.proprietaire_locataire,
              situation_matrimoniale: mappedData.situation_matrimoniale,
              regime_matrimonial: mappedData.regime_matrimonial,
              nombre_enfants: mappedData.nombre_enfants,
              enfants_details: mappedData.enfants_details,
              profession: mappedData.profession,
              statut_professionnel: mappedData.statut_professionnel,
              employeur: mappedData.employeur,
              date_debut_emploi: mappedData.date_debut_emploi,
              revenus_pro_net: mappedData.revenus_pro_net,
              revenus_fonciers: mappedData.revenus_fonciers,
              autres_revenus: mappedData.autres_revenus,
              total_revenus_annuel: mappedData.total_revenus_annuel,
              impot_revenu_n: mappedData.impot_revenu_n,
              impot_revenu_n1: mappedData.impot_revenu_n1,
              impot_revenu_n2: mappedData.impot_revenu_n2,
              objectifs_client: mappedData.objectifs_client,
              patrimoine_immobilier: mappedData.patrimoine_immobilier,
              produits_financiers: mappedData.produits_financiers,
              patrimoine_divers: mappedData.patrimoine_divers,
              emprunts: mappedData.emprunts,
              kyc_uploaded_at: new Date().toISOString(),
            }

            const { error } = await supabase
              .from('clients')
              .update(updatePayload)
              .eq('id', client.id)

            if (!error) {
              setIsEditMode(false)
              if (onUpdate) onUpdate()
            } else {
              console.error('Auto-save error:', error)
            }
          } catch (e) {
            console.error('Auto-save exception:', e)
          }
        },
      }),
      [client.id, supabase, onUpdate]
    )

    const toggleSection = (section: SectionKey) => {
      setExpandedSections(prev => {
        const next = new Set(prev)
        if (next.has(section)) {
          next.delete(section)
        } else {
          next.add(section)
        }
        return next
      })
    }

    const handleSave = async () => {
      if (!client.id) return
      setSaving(true)
      try {
        // Build the update object with individual columns
        const updatePayload: any = {
          titre: editData.titre,
          nom_jeune_fille: editData.nom_jeune_fille,
          date_naissance: editData.date_naissance,
          lieu_naissance: editData.lieu_naissance,
          nationalite: editData.nationalite,
          residence_fiscale: editData.residence_fiscale,
          nif: editData.nif,
          adresse: editData.adresse,
          code_postal: editData.code_postal,
          ville: editData.ville,
          pays: editData.pays,
          proprietaire_locataire: editData.proprietaire_locataire,
          montant_loyer: editData.montant_loyer,
          charges_residence_principale: editData.charges_residence_principale,
          situation_matrimoniale: editData.situation_matrimoniale,
          regime_matrimonial: editData.regime_matrimonial,
          nombre_enfants: editData.nombre_enfants,
          enfants_details: editData.enfants_details,
          profession: editData.profession,
          statut_professionnel: editData.statut_professionnel,
          employeur: editData.employeur,
          date_debut_emploi: editData.date_debut_emploi,
          revenus_pro_net: editData.revenus_pro_net,
          revenus_fonciers: editData.revenus_fonciers,
          autres_revenus: editData.autres_revenus,
          total_revenus_annuel: editData.total_revenus_annuel,
          impot_revenu_n: editData.impot_revenu_n,
          impot_revenu_n1: editData.impot_revenu_n1,
          impot_revenu_n2: editData.impot_revenu_n2,
          objectifs_client: editData.objectifs_client,
          patrimoine_immobilier: editData.patrimoine_immobilier,
          patrimoine_professionnel: editData.patrimoine_professionnel,
          produits_financiers: editData.produits_financiers,
          patrimoine_divers: editData.patrimoine_divers,
          emprunts: editData.emprunts,
        }

        const { error } = await supabase
          .from('clients')
          .update(updatePayload)
          .eq('id', client.id)

        if (!error) {
          setIsEditMode(false)
          if (onUpdate) onUpdate()
        } else {
          console.error('Save error:', error)
        }
      } catch (e) {
        console.error('Exception:', e)
      } finally {
        setSaving(false)
      }
    }

    const handleCancel = () => {
      // Reset to current client state
      const initialData: EditState = {
        titre: client?.titre,
        nom_jeune_fille: client?.nom_jeune_fille,
        date_naissance: client?.date_naissance,
        lieu_naissance: client?.lieu_naissance,
        nationalite: client?.nationalite,
        residence_fiscale: client?.residence_fiscale,
        nif: client?.nif,
        adresse: client?.adresse,
        code_postal: client?.code_postal,
        ville: client?.ville,
        pays: client?.pays,
        proprietaire_locataire: client?.proprietaire_locataire,
        montant_loyer: client?.montant_loyer,
        charges_residence_principale: client?.charges_residence_principale,
        situation_matrimoniale: client?.situation_matrimoniale,
        regime_matrimonial: client?.regime_matrimonial,
        nombre_enfants: client?.nombre_enfants,
        enfants_details: client?.enfants_details,
        profession: client?.profession,
        statut_professionnel: client?.statut_professionnel,
        employeur: client?.employeur,
        date_debut_emploi: client?.date_debut_emploi,
        revenus_pro_net: client?.revenus_pro_net,
        revenus_fonciers: client?.revenus_fonciers,
        autres_revenus: client?.autres_revenus,
        total_revenus_annuel: client?.total_revenus_annuel,
        impot_revenu_n: client?.impot_revenu_n,
        impot_revenu_n1: client?.impot_revenu_n1,
        impot_revenu_n2: client?.impot_revenu_n2,
        objectifs_client: client?.objectifs_client,
        patrimoine_immobilier: Array.isArray(client?.patrimoine_immobilier)
          ? client.patrimoine_immobilier
          : [],
        patrimoine_professionnel: Array.isArray(client?.patrimoine_professionnel)
          ? client.patrimoine_professionnel
          : [],
        produits_financiers: Array.isArray(client?.produits_financiers)
          ? client.produits_financiers
          : [],
        patrimoine_divers: Array.isArray(client?.patrimoine_divers)
          ? client.patrimoine_divers
          : [],
        emprunts: Array.isArray(client?.emprunts) ? client.emprunts : [],
      }
      setEditData(initialData)
      setIsEditMode(false)
    }

    const formatCurrency = (value: number | undefined): string => {
      if (!value) return '0 €'
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(value)
    }

    const displayValue = (value: any): string => {
      if (value === null || value === undefined || value === '') return '-'
      if (typeof value === 'number') return value.toString()
      return String(value)
    }

    const data = editData

    // État civil section
    const EtatCivilSection = () => {
      const section: SectionKey = 'etat_civil'
      const isExpanded = expandedSections.has(section)

      return (
        <div className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-600" />
              ) : (
                <ChevronRight size={16} className="text-gray-600" />
              )}
              <h3 className="font-semibold text-sm text-gray-900">État civil</h3>
            </div>
          </button>

          {isExpanded && (
            <div className="px-3 pb-3 space-y-3 bg-gray-50/50">
              {isEditMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Titre
                      </label>
                      <select
                        value={data.titre || ''}
                        onChange={e =>
                          setEditData({ ...editData, titre: e.target.value })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      >
                        <option value="">Sélectionner</option>
                        <option value="Monsieur">Monsieur</option>
                        <option value="Madame">Madame</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Nom
                      </label>
                      <input
                        type="text"
                        value={client.nom || ''}
                        disabled
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Nom de jeune fille
                      </label>
                      <input
                        type="text"
                        value={data.nom_jeune_fille || ''}
                        onChange={e =>
                          setEditData({
                            ...editData,
                            nom_jeune_fille: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Prénom
                      </label>
                      <input
                        type="text"
                        value={client.prenom || ''}
                        disabled
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Date de naissance
                      </label>
                      <input
                        type="date"
                        value={data.date_naissance || ''}
                        onChange={e =>
                          setEditData({
                            ...editData,
                            date_naissance: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Lieu de naissance
                      </label>
                      <input
                        type="text"
                        value={data.lieu_naissance || ''}
                        onChange={e =>
                          setEditData({
                            ...editData,
                            lieu_naissance: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Nationalité
                      </label>
                      <select
                        value={data.nationalite || ''}
                        onChange={e =>
                          setEditData({ ...editData, nationalite: e.target.value })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      >
                        <option value="">— Sélectionner —</option>
                        {/* Si la valeur actuelle ne figure pas dans la liste ISO
                            (legacy text libre), on l'ajoute en tête pour éviter
                            qu'elle disparaisse silencieusement. */}
                        {data.nationalite &&
                          !COUNTRY_NAMES.includes(data.nationalite) && (
                            <option value={data.nationalite}>
                              {data.nationalite} (valeur existante)
                            </option>
                          )}
                        {COUNTRY_NAMES.map(name => (
                          <option key={`nat-${name}`} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Résidence fiscale
                      </label>
                      <select
                        value={data.residence_fiscale || ''}
                        onChange={e =>
                          setEditData({
                            ...editData,
                            residence_fiscale: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      >
                        <option value="">— Sélectionner —</option>
                        {data.residence_fiscale &&
                          !COUNTRY_NAMES.includes(data.residence_fiscale) && (
                            <option value={data.residence_fiscale}>
                              {data.residence_fiscale} (valeur existante)
                            </option>
                          )}
                        {COUNTRY_NAMES.map(name => (
                          <option key={`fisc-${name}`} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      N° d'identification fiscale
                    </label>
                    <input
                      type="text"
                      value={data.nif || ''}
                      onChange={e =>
                        setEditData({
                          ...editData,
                          nif: e.target.value,
                        })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Adresse
                    </label>
                    <textarea
                      value={data.adresse || ''}
                      onChange={e =>
                        setEditData({ ...editData, adresse: e.target.value })
                      }
                      rows={2}
                      placeholder="Numéro, rue, complément"
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>

                  {/* Ordre d'usage FR : Code postal + Ville AVANT Pays. */}
                  <div className="grid grid-cols-[140px_1fr] gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Code postal
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={data.code_postal || ''}
                        onChange={e =>
                          setEditData({ ...editData, code_postal: e.target.value })
                        }
                        placeholder="75008"
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Ville
                      </label>
                      <input
                        type="text"
                        value={data.ville || ''}
                        onChange={e =>
                          setEditData({ ...editData, ville: e.target.value })
                        }
                        placeholder="Paris"
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Pays
                    </label>
                    <select
                      value={data.pays || ''}
                      onChange={e =>
                        setEditData({ ...editData, pays: e.target.value })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    >
                      <option value="">— Sélectionner —</option>
                      {data.pays && !COUNTRY_NAMES.includes(data.pays) && (
                        <option value={data.pays}>
                          {data.pays} (valeur existante)
                        </option>
                      )}
                      {COUNTRY_NAMES.map(name => (
                        <option key={`pays-${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Statut de logement
                      </label>
                      <select
                        value={data.proprietaire_locataire || ''}
                        onChange={e =>
                          setEditData({
                            ...editData,
                            proprietaire_locataire: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      >
                        <option value="">— Sélectionner —</option>
                        {/* Garde les valeurs legacy si elles ne figurent pas dans la liste. */}
                        {data.proprietaire_locataire &&
                          !LOGEMENT_OPTIONS.includes(
                            data.proprietaire_locataire as any
                          ) && (
                            <option value={data.proprietaire_locataire}>
                              {data.proprietaire_locataire} (valeur existante)
                            </option>
                          )}
                        {LOGEMENT_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Montant du loyer conditionnel : affiché dès que le statut
                        contient "locataire" (case-insensitive pour accepter
                        "Locataire" saisi par le picker + "locataire" mappé
                        depuis populateFromKyc). Saisie = euros par mois TTC. */}
                    {(data.proprietaire_locataire || '').toLowerCase().includes('locataire') && (
                      <div>
                        <label className="text-xs font-semibold text-gray-600">
                          Montant du loyer (€/mois)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={
                            data.montant_loyer === null || data.montant_loyer === undefined
                              ? ''
                              : String(data.montant_loyer)
                          }
                          onChange={e => {
                            const raw = e.target.value.trim()
                            const parsed = raw === '' ? null : Number(raw)
                            setEditData({
                              ...editData,
                              montant_loyer: Number.isFinite(parsed as number) ? parsed : null,
                            })
                          }}
                          placeholder="1200"
                          className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                        />
                      </div>
                    )}
                    {/* Charges résidence principale conditionnelles : affichées
                        si propriétaire ou usufruitier (crédit + copro + taxe
                        foncière mensualisée). Champ miroir de montant_loyer. */}
                    {(() => {
                      const v = (data.proprietaire_locataire || '').toLowerCase()
                      return v.includes('propri') || v.includes('usufruitier')
                    })() && (
                      <div>
                        <label className="text-xs font-semibold text-gray-600">
                          Charges résidence principale (€/mois)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={
                            data.charges_residence_principale === null || data.charges_residence_principale === undefined
                              ? ''
                              : String(data.charges_residence_principale)
                          }
                          onChange={e => {
                            const raw = e.target.value.trim()
                            const parsed = raw === '' ? null : Number(raw)
                            setEditData({
                              ...editData,
                              charges_residence_principale: Number.isFinite(parsed as number) ? parsed : null,
                            })
                          }}
                          placeholder="850"
                          className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Titre</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.titre)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Nom</p>
                      <p className="text-sm font-medium text-gray-900">
                        {client.nom || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Nom de jeune fille</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.nom_jeune_fille)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Prénom</p>
                      <p className="text-sm font-medium text-gray-900">
                        {client.prenom || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Date de naissance</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.date_naissance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Lieu de naissance</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.lieu_naissance)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Nationalité</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.nationalite)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Résidence fiscale</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.residence_fiscale)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">N° d'identification</p>
                    <p className="text-sm font-medium text-gray-900">
                      {displayValue(data.nif)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Adresse</p>
                    <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                      {displayValue(data.adresse)}
                    </p>
                  </div>

                  <div className="grid grid-cols-[140px_1fr] gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Code postal</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.code_postal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Ville</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.ville)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Pays</p>
                    <p className="text-sm font-medium text-gray-900">
                      {displayValue(data.pays)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Statut de logement</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.proprietaire_locataire)}
                      </p>
                    </div>
                    {(data.proprietaire_locataire || '').toLowerCase().includes('locataire') && (
                      <div>
                        <p className="text-xs text-gray-500">Montant du loyer</p>
                        <p className="text-sm font-medium text-gray-900">
                          {data.montant_loyer != null
                            ? `${Number(data.montant_loyer).toLocaleString('fr-FR', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })} € / mois`
                            : '-'}
                        </p>
                      </div>
                    )}
                    {(() => {
                      const v = (data.proprietaire_locataire || '').toLowerCase()
                      return v.includes('propri') || v.includes('usufruitier')
                    })() && (
                      <div>
                        <p className="text-xs text-gray-500">Charges résidence principale</p>
                        <p className="text-sm font-medium text-gray-900">
                          {data.charges_residence_principale != null
                            ? `${Number(data.charges_residence_principale).toLocaleString('fr-FR', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })} € / mois`
                            : '-'}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Situation familiale section
    const SituationFamilialeSection = () => {
      const section: SectionKey = 'situation_familiale'
      const isExpanded = expandedSections.has(section)

      return (
        <div className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-600" />
              ) : (
                <ChevronRight size={16} className="text-gray-600" />
              )}
              <h3 className="font-semibold text-sm text-gray-900">
                Situation familiale
              </h3>
            </div>
          </button>

          {isExpanded && (
            <div className="px-3 pb-3 space-y-3 bg-gray-50/50">
              {isEditMode ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Situation matrimoniale
                    </label>
                    <select
                      value={data.situation_matrimoniale || ''}
                      onChange={e => {
                        const newSit = e.target.value
                        // Quand on passe sur une situation qui ne nécessite pas
                        // de régime (célibataire, divorcé, veuf…), on remet à
                        // null pour éviter les données orphelines sur un
                        // changement d'état marital.
                        setEditData({
                          ...editData,
                          situation_matrimoniale: newSit,
                          regime_matrimonial: needsRegimeMatrimonial(newSit)
                            ? editData.regime_matrimonial
                            : null,
                        })
                      }}
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    >
                      <option value="">— Sélectionner —</option>
                      {data.situation_matrimoniale &&
                        !SITUATION_MATRIMONIALE_OPTIONS.includes(
                          data.situation_matrimoniale as any
                        ) && (
                          <option value={data.situation_matrimoniale}>
                            {data.situation_matrimoniale} (valeur existante)
                          </option>
                        )}
                      {SITUATION_MATRIMONIALE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Régime matrimonial : UNIQUEMENT si Marié(e) ou Pacsé(e). */}
                  {needsRegimeMatrimonial(data.situation_matrimoniale) && (
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Régime matrimonial
                      </label>
                      <select
                        value={data.regime_matrimonial || ''}
                        onChange={e =>
                          setEditData({
                            ...editData,
                            regime_matrimonial: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      >
                        <option value="">— Sélectionner —</option>
                        {/* Fallback "valeur existante" : garde l'affichage
                            d'une valeur déjà persistée même si elle n'est
                            pas dans la liste filtrée (ex: régime PACS sur
                            un client marié par erreur historique). */}
                        {data.regime_matrimonial &&
                          !getRegimesForSituation(data.situation_matrimoniale).includes(
                            data.regime_matrimonial as any
                          ) && (
                            <option value={data.regime_matrimonial}>
                              {data.regime_matrimonial} (valeur existante)
                            </option>
                          )}
                        {/* Filtrage par situation : mariage → régimes mariage,
                            PACS → régimes PACS (point 1.7 corrections 2026-04-24). */}
                        {getRegimesForSituation(data.situation_matrimoniale).map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Nombre d'enfants
                      </label>
                      <input
                        type="number"
                        value={data.nombre_enfants || 0}
                        onChange={e =>
                          setEditData({
                            ...editData,
                            nombre_enfants: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Détails enfants
                      </label>
                      <input
                        type="text"
                        placeholder="p.ex. 11 ans, 15 ans"
                        value={data.enfants_details || ''}
                        onChange={e =>
                          setEditData({
                            ...editData,
                            enfants_details: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500">Situation matrimoniale</p>
                    <p className="text-sm font-medium text-gray-900">
                      {displayValue(data.situation_matrimoniale)}
                    </p>
                  </div>

                  {needsRegimeMatrimonial(data.situation_matrimoniale) && (
                    <div>
                      <p className="text-xs text-gray-500">Régime matrimonial</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.regime_matrimonial)}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Nombre d'enfants</p>
                      <p className="text-sm font-medium text-gray-900">
                        {data.nombre_enfants || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Détails enfants</p>
                      <p className="text-sm font-medium text-gray-900">
                        {displayValue(data.enfants_details)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Situation professionnelle section
    const SituationProfessionnelleSection = () => {
      const section: SectionKey = 'situation_professionnelle'
      const isExpanded = expandedSections.has(section)

      return (
        <div className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-600" />
              ) : (
                <ChevronRight size={16} className="text-gray-600" />
              )}
              <h3 className="font-semibold text-sm text-gray-900">
                Situation professionnelle
              </h3>
            </div>
          </button>

          {isExpanded && (
            <div className="px-3 pb-3 space-y-3 bg-gray-50/50">
              {isEditMode ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Profession
                    </label>
                    <input
                      type="text"
                      value={data.profession || ''}
                      onChange={e =>
                        setEditData({ ...editData, profession: e.target.value })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Statut
                    </label>
                    <select
                      value={data.statut_professionnel || ''}
                      onChange={e =>
                        setEditData({
                          ...editData,
                          statut_professionnel: e.target.value,
                        })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    >
                      <option value="">Sélectionner</option>
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="TNS">TNS</option>
                      <option value="Fonctionnaire">Fonctionnaire</option>
                      <option value="Retraité">Retraité</option>
                      <option value="Sans emploi">Sans emploi</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Employeur
                    </label>
                    <input
                      type="text"
                      value={data.employeur || ''}
                      onChange={e =>
                        setEditData({ ...editData, employeur: e.target.value })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Depuis
                    </label>
                    {/* date_debut_emploi stocke "YYYY-MM-DD" en base ; l'input
                        `date` n'accepte que ce format. Si la valeur legacy est
                        du texte libre (ex: "Jan. 2020"), on bascule en input
                        text en fallback pour ne pas la perdre. */}
                    {(() => {
                      const v = data.date_debut_emploi || ''
                      const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(v)
                      if (v && !isIsoDate) {
                        return (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="text"
                              value={v}
                              onChange={e =>
                                setEditData({
                                  ...editData,
                                  date_debut_emploi: e.target.value,
                                })
                              }
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setEditData({
                                  ...editData,
                                  date_debut_emploi: '',
                                })
                              }
                              className="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                              title="Effacer pour basculer sur le date picker"
                            >
                              Convertir en date
                            </button>
                          </div>
                        )
                      }
                      return (
                        <input
                          type="date"
                          value={v}
                          onChange={e =>
                            setEditData({
                              ...editData,
                              date_debut_emploi: e.target.value,
                            })
                          }
                          className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                        />
                      )
                    })()}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500">Profession</p>
                    <p className="text-sm font-medium text-gray-900">
                      {displayValue(data.profession)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Statut</p>
                    <p className="text-sm font-medium text-gray-900">
                      {displayValue(data.statut_professionnel)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Employeur</p>
                    <p className="text-sm font-medium text-gray-900">
                      {displayValue(data.employeur)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Depuis</p>
                    <p className="text-sm font-medium text-gray-900">
                      {displayValue(data.date_debut_emploi)}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Revenus section
    const RevenusSection = () => {
      const section: SectionKey = 'revenus'
      const isExpanded = expandedSections.has(section)
      const totalRevenus =
        (data.revenus_pro_net || 0) +
        (data.revenus_fonciers || 0) +
        (data.autres_revenus || 0)

      // Taux d'endettement = (charges mensuelles totales / revenus mensuels) × 100
      //
      // Chantier #3 (2026-04-21) : formule corrigée pour utiliser
      // `echeance_mensuelle` au lieu de l'ancien champ DATE `echeance`.
      // Chantier #7.5 (2026-04-24) : le numérateur inclut désormais aussi
      // `montant_loyer` (si locataire) et `charges_residence_principale`
      // (si propriétaire / usufruitier). La logique est factorisée dans
      // `@/lib/kyc-endettement` et réutilisée par le générateur PDF.
      const endettement = computeEndettement({
        proprietaire_locataire: data.proprietaire_locataire,
        montant_loyer: data.montant_loyer,
        charges_residence_principale: data.charges_residence_principale,
        total_revenus_annuel: data.total_revenus_annuel,
        revenus_pro_net: data.revenus_pro_net,
        revenus_fonciers: data.revenus_fonciers,
        autres_revenus: data.autres_revenus,
        emprunts: (data.emprunts || []) as EmpruntRow[],
      })
      const tauxEndettement = endettement.taux
      const revenusMensuels = endettement.revenusMensuels
      const empruntsIncomplets = endettement.empruntsIncomplets
      const endettementBreakdown = formatBreakdown(endettement)
      const hasAucuneCharge = endettement.chargesTotales === 0

      return (
        <div className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-600" />
              ) : (
                <ChevronRight size={16} className="text-gray-600" />
              )}
              <h3 className="font-semibold text-sm text-gray-900">Revenus</h3>
            </div>
            {!isEditMode && (
              <span className="text-sm font-bold text-indigo-600">
                {formatCurrency(totalRevenus)}
              </span>
            )}
          </button>

          {isExpanded && (
            <div className="px-3 pb-3 space-y-3 bg-gray-50/50">
              {isEditMode ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Revenus professionnels net imposable
                    </label>
                    <input
                      type="number"
                      value={data.revenus_pro_net || 0}
                      onChange={e =>
                        setEditData({
                          ...editData,
                          revenus_pro_net: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Revenus fonciers
                    </label>
                    <input
                      type="number"
                      value={data.revenus_fonciers || 0}
                      onChange={e =>
                        setEditData({
                          ...editData,
                          revenus_fonciers: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Autres revenus
                    </label>
                    <input
                      type="number"
                      value={data.autres_revenus || 0}
                      onChange={e =>
                        setEditData({
                          ...editData,
                          autres_revenus: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>

                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-semibold text-gray-600">
                      Total revenus annuels
                    </p>
                    <p className="text-sm font-bold text-indigo-700 mt-1">
                      {formatCurrency(totalRevenus)}
                    </p>
                  </div>

                  {/* Taux d'endettement — toujours affiché pour que l'absence
                      de charges soit un état explicite et pas un oubli.
                      Inclut mensualités crédits + loyer + charges RP. */}
                  <div className="mt-2 border-t pt-2">
                    <p className="text-xs font-semibold text-gray-600">
                      Taux d'endettement
                    </p>
                    {hasAucuneCharge ? (
                      <p className="text-sm font-bold mt-1 text-gray-500">
                        0% — aucune charge structurelle
                      </p>
                    ) : revenusMensuels <= 0 ? (
                      <p className="text-sm font-bold mt-1 text-gray-500">
                        Non calculable — renseigner les revenus
                      </p>
                    ) : (
                      <>
                        <p
                          className={`text-sm font-bold mt-1 ${
                            tauxEndettement > 35
                              ? 'text-red-600'
                              : tauxEndettement > 25
                              ? 'text-orange-600'
                              : 'text-green-600'
                          }`}
                        >
                          {tauxEndettement}%
                          {tauxEndettement > 35 && ' ⚠️ Élevé'}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {formatCurrency(endettement.chargesTotales)} /mois sur{' '}
                          {formatCurrency(revenusMensuels)} /mois de revenus
                        </p>
                        {endettementBreakdown && (
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            dont {endettementBreakdown}
                          </p>
                        )}
                        {empruntsIncomplets > 0 && (
                          <p className="text-[11px] text-orange-600 mt-0.5">
                            ⚠ {empruntsIncomplets} emprunt
                            {empruntsIncomplets > 1 ? 's' : ''} sans échéance
                            mensuelle renseignée — le taux est sous-estimé.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500">
                      Revenus professionnels net imposable
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(data.revenus_pro_net)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Revenus fonciers</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(data.revenus_fonciers)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Autres revenus</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(data.autres_revenus)}
                    </p>
                  </div>

                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-semibold text-gray-600">
                      Total revenus annuels
                    </p>
                    <p className="text-sm font-bold text-indigo-700">
                      {formatCurrency(totalRevenus)}
                    </p>
                  </div>

                  <div className="mt-2 border-t pt-2">
                    <p className="text-xs font-semibold text-gray-600">
                      Taux d'endettement
                    </p>
                    {hasAucuneCharge ? (
                      <p className="text-sm font-bold text-gray-500">
                        0% — aucune charge structurelle
                      </p>
                    ) : revenusMensuels <= 0 ? (
                      <p className="text-sm font-bold text-gray-500">
                        Non calculable — renseigner les revenus
                      </p>
                    ) : (
                      <>
                        <p
                          className={`text-sm font-bold ${
                            tauxEndettement > 35
                              ? 'text-red-600'
                              : tauxEndettement > 25
                              ? 'text-orange-600'
                              : 'text-green-600'
                          }`}
                        >
                          {tauxEndettement}%
                          {tauxEndettement > 35 && ' ⚠️ Élevé'}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {formatCurrency(endettement.chargesTotales)} /mois sur{' '}
                          {formatCurrency(revenusMensuels)} /mois de revenus
                        </p>
                        {endettementBreakdown && (
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            dont {endettementBreakdown}
                          </p>
                        )}
                        {empruntsIncomplets > 0 && (
                          <p className="text-[11px] text-orange-600 mt-0.5">
                            ⚠ {empruntsIncomplets} emprunt
                            {empruntsIncomplets > 1 ? 's' : ''} sans échéance
                            mensuelle renseignée — le taux est sous-estimé.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Helper partagé par les 3 sections d'actifs éditables : rend la cellule
    // « Détenteur » (select 'Client' / 'Co-titulaire' / 'Joint') + le sélecteur
    // de co-titulaire (affiché uniquement quand le rôle le requiert).
    // `onChange` reçoit le couple (type, co_titulaire_client_id) pour que
    // l'appelant puisse les appliquer sur la ligne en une seule MAJ.
    const DetenteurCell = ({
      value,
      coTitulaireId,
      onChange,
    }: {
      value: DetenteurType | undefined
      coTitulaireId: string | null | undefined
      onChange: (type: DetenteurType | undefined, coTitId: string | null) => void
    }) => {
      // Normalise les anciennes valeurs libres ('conjoint'/'commun'/'autre')
      // persistées par le portail V1 — sinon le select reste vide et l'UI
      // laisse croire que le détenteur n'est pas renseigné.
      const current: DetenteurType = normalizeDetenteurType(value)
      const needsPicker = current === 'co_titulaire' || current === 'joint'
      return (
        <div className="flex flex-col gap-1">
          <select
            value={current}
            onChange={e => {
              const t = e.target.value as DetenteurType
              // Lorsqu'on repasse à 'client', on efface la référence co-titulaire.
              onChange(t, t === 'client' ? null : coTitulaireId ?? null)
            }}
            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs bg-white"
          >
            {DETENTEUR_TYPE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>
                {DETENTEUR_TYPE_LABELS[opt]}
              </option>
            ))}
          </select>
          {needsPicker && (
            <select
              value={coTitulaireId ?? ''}
              onChange={e => onChange(current, e.target.value || null)}
              className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs bg-white"
            >
              <option value="">— Sélectionner un client —</option>
              {coTitulaireOptions.map(o => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )
    }

    // Lookup inverse UUID → libellé pour les affichages read-only.
    const coTitulaireLabel = (id: string | null | undefined): string => {
      if (!id) return '—'
      return coTitulaireOptions.find(o => o.id === id)?.label ?? '—'
    }

    // Patrimoine immobilier section
    const PatrimoineImmobilierSection = () => {
      const section: SectionKey = 'patrimoine_immobilier'
      const isExpanded = expandedSections.has(section)
      const immobilier: ImmobilierRow[] = (data.patrimoine_immobilier || []) as ImmobilierRow[]

      // Detect if detention means community (50/50 split)
      // If detention is not specified, fall back to régime matrimonial
      const isCommunaute = (detention: string | undefined | null): boolean => {
        const d = (detention || '').toLowerCase().trim()
        if (d) {
          return /^(cte|communaut[ée]|commun|50\s*\/\s*50|50\s*%?\s*[-\/]\s*50\s*%?)$/.test(d)
        }
        // No detention specified: check régime matrimonial
        const regime = (data.regime_matrimonial || '').toLowerCase().trim()
        return /^(cte|communaut[ée]|commun)/.test(regime)
      }

      // Format currency with proportion annotation.
      // Si une proportion explicite est renseignée (0–100) on l'utilise ;
      // sinon on retombe sur l'heuristique communauté (50/50).
      const formatImmoValue = (
        value: number | undefined | null,
        detention: string | undefined | null,
        proportion?: number | null
      ): React.ReactNode => {
        if (value === undefined || value === null || value === 0)
          return formatCurrency(0)
        const prop = typeof proportion === 'number' ? proportion : null
        if (prop !== null && prop !== 100) {
          const share = Math.round((value * prop) / 100)
          return (
            <span>
              {formatCurrency(share)}
              <span className="text-[10px] text-gray-400 ml-1">
                ({prop}% de {formatCurrency(value)})
              </span>
            </span>
          )
        }
        if (prop === null && isCommunaute(detention)) {
          const half = Math.round(value / 2)
          return (
            <span>
              {formatCurrency(half)}
              <span className="text-[10px] text-gray-400 ml-1">
                (50% de {formatCurrency(value)})
              </span>
            </span>
          )
        }
        return formatCurrency(value)
      }

      // Auto-calculate CRD: capital restant dû basé sur valeur acq, date acq, taux crédit, durée crédit
      const computeCRD = (row: any): number | null => {
        const { valeur_acq, date_acq, taux_credit, duree_credit } = row
        if (!valeur_acq || !date_acq || !taux_credit || !duree_credit) return null
        const tauxMensuel = (taux_credit / 100) / 12
        const nbMoisTotal = duree_credit * 12
        const dateAcq = new Date(date_acq)
        const now = new Date()
        const moisEcoules = (now.getFullYear() - dateAcq.getFullYear()) * 12 + (now.getMonth() - dateAcq.getMonth())
        if (moisEcoules <= 0) return valeur_acq
        if (moisEcoules >= nbMoisTotal) return 0
        // Mensualité = P * r / (1 - (1+r)^-n)
        const mensualite = valeur_acq * tauxMensuel / (1 - Math.pow(1 + tauxMensuel, -nbMoisTotal))
        // CRD après k mois = P * (1+r)^k - mensualite * ((1+r)^k - 1) / r
        const crd = valeur_acq * Math.pow(1 + tauxMensuel, moisEcoules) - mensualite * (Math.pow(1 + tauxMensuel, moisEcoules) - 1) / tauxMensuel
        return Math.max(0, Math.round(crd))
      }

      const addImmobilierRow = () => {
        setEditData({
          ...editData,
          patrimoine_immobilier: [
            ...immobilier,
            {
              type_bien: '',
              designation: '',
              date_acq: '',
              valeur_acq: 0,
              valeur_actuelle: 0,
              detention: '',
              proportion: 100,
              taux_credit: 0,
              duree_credit: 0,
              crd: 0,
              charges: 0,
            },
          ],
        })
      }

      const removeImmobilierRow = (index: number) => {
        setEditData({
          ...editData,
          patrimoine_immobilier: immobilier.filter((_, i) => i !== index),
        })
      }

      const updateImmobilierRow = (index: number, field: string, value: any) => {
        const updated = [...immobilier]
        updated[index] = { ...updated[index], [field]: value }
        // Auto-calculate CRD when relevant fields change
        if (['valeur_acq', 'date_acq', 'taux_credit', 'duree_credit'].includes(field)) {
          const calculatedCRD = computeCRD(updated[index])
          if (calculatedCRD !== null) {
            updated[index].crd = calculatedCRD
          }
        }
        setEditData({ ...editData, patrimoine_immobilier: updated })
      }

      return (
        <div className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-600" />
              ) : (
                <ChevronRight size={16} className="text-gray-600" />
              )}
              <h3 className="font-semibold text-sm text-gray-900">
                Patrimoine immobilier
              </h3>
            </div>
            {!isEditMode && immobilier.length > 0 && (
              <span className="text-sm font-bold text-indigo-600">
                {formatCurrency(immobilier.reduce((sum, row) => {
                  const val = row.valeur_actuelle ?? 0
                  // Ordre de priorité : proportion explicite > heuristique
                  // communauté > 100%. La proportion est toujours traitée en
                  // % (0–100) et représente la quote-part du client.
                  const prop = typeof row.proportion === 'number' ? row.proportion : null
                  if (prop !== null) {
                    return sum + Math.round((val * prop) / 100)
                  }
                  return sum + (isCommunaute(row.detention) ? Math.round(val / 2) : val)
                }, 0))}
              </span>
            )}
          </button>

          {isExpanded && (
            <div className="px-3 pb-3 bg-gray-50/50">
              {isEditMode ? (
                <div className="space-y-2">
                  {immobilier.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Aucun bien immobilier</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-1 px-1 font-semibold">
                              Type
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Désignation
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Date acq.
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Valeur acq.
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Actuelle
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Détention
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Part %
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Taux %
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Durée (ans)
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">CRD</th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Charges
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Détenteur
                            </th>
                            <th className="text-center py-1 px-1">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {immobilier.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="py-1 px-1">
                                <select
                                  value={row.type_bien || ''}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'type_bien',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs bg-white"
                                >
                                  <option value="">—</option>
                                  {row.type_bien &&
                                    !(TYPE_BIEN_IMMOBILIER_OPTIONS as readonly string[]).includes(
                                      row.type_bien
                                    ) && (
                                      <option value={row.type_bien}>
                                        {row.type_bien}
                                      </option>
                                    )}
                                  {TYPE_BIEN_IMMOBILIER_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="text"
                                  value={row.designation}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'designation',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="date"
                                  value={row.date_acq}
                                  onChange={e =>
                                    updateImmobilierRow(idx, 'date_acq', e.target.value)
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  value={row.valeur_acq}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'valeur_acq',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  value={row.valeur_actuelle}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'valeur_actuelle',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <select
                                  value={row.detention || ''}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'detention',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs bg-white"
                                >
                                  <option value="">—</option>
                                  {row.detention &&
                                    !(TYPE_DETENTION_OPTIONS as readonly string[]).includes(row.detention) && (
                                      <option value={row.detention}>
                                        {row.detention}
                                      </option>
                                    )}
                                  {TYPE_DETENTION_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={row.proportion ?? 100}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'proportion',
                                      Math.min(
                                        100,
                                        Math.max(0, parseInt(e.target.value) || 0)
                                      )
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                  title="Quote-part du client (100% si détenteur unique)"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="ex: 1.5"
                                  value={row.taux_credit || ''}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'taux_credit',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  placeholder="ex: 20"
                                  value={row.duree_credit || ''}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'duree_credit',
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  value={row.crd}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'crd',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs bg-gray-50"
                                  title="Calculé automatiquement si valeur acq., date, taux et durée renseignés"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  value={row.charges}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'charges',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1 min-w-[140px]">
                                <DetenteurCell
                                  value={row.detenteur_type}
                                  coTitulaireId={row.co_titulaire_client_id}
                                  onChange={(type, coTitId) => {
                                    const updated = [...immobilier]
                                    updated[idx] = {
                                      ...updated[idx],
                                      detenteur_type: type,
                                      co_titulaire_client_id: coTitId,
                                    }
                                    setEditData({
                                      ...editData,
                                      patrimoine_immobilier: updated,
                                    })
                                  }}
                                />
                              </td>
                              <td className="py-1 px-1 text-center">
                                <button
                                  onClick={() => removeImmobilierRow(idx)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <button
                    onClick={addImmobilierRow}
                    className="mt-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  >
                    <Plus size={12} />
                    Ajouter un bien
                  </button>
                </div>
              ) : (
                <>
                  {immobilier.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2">
                      Aucun bien immobilier
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-1 px-1 font-semibold">
                              Type
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Désignation
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Date acq.
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Valeur acq.
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Actuelle
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Détention
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Part %
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">CRD</th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Charges
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Détenteur
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {immobilier.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="py-1 px-1 text-gray-900">
                                {row.type_bien || '-'}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.designation || '-'}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.date_acq || '-'}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatImmoValue(
                                  row.valeur_acq,
                                  row.detention,
                                  row.proportion
                                )}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatImmoValue(
                                  row.valeur_actuelle,
                                  row.detention,
                                  row.proportion
                                )}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.detention || '-'}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {typeof row.proportion === 'number'
                                  ? `${row.proportion}%`
                                  : '-'}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatImmoValue(
                                  row.crd,
                                  row.detention,
                                  row.proportion
                                )}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatImmoValue(
                                  row.charges,
                                  row.detention,
                                  row.proportion
                                )}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.detenteur_type
                                  ? DETENTEUR_TYPE_LABELS[row.detenteur_type]
                                  : 'Client'}
                                {(row.detenteur_type === 'co_titulaire' ||
                                  row.detenteur_type === 'joint') && (
                                  <span className="block text-gray-500 text-[10px]">
                                    {coTitulaireLabel(row.co_titulaire_client_id)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Patrimoine professionnel section — point 1.6 corrections 2026-04-24.
    // Structure : 2 blocs (Immobilier pro / Financier pro) affichés côte à
    // côte. Saisie via table éditable : bloc, sous-catégorie, désignation,
    // valeur, description. Persisté dans `clients.patrimoine_professionnel`
    // (JSONB, cf scripts/add-patrimoine-professionnel.sql).
    const PatrimoineProfessionnelSection = () => {
      const section: SectionKey = 'patrimoine_professionnel'
      const isExpanded = expandedSections.has(section)
      const pro: PatrimoineProRow[] = (data.patrimoine_professionnel || []) as PatrimoineProRow[]

      const addProRow = (categorieDefault: 'immo_pro' | 'financier_pro') => {
        setEditData({
          ...editData,
          patrimoine_professionnel: [
            ...pro,
            {
              categorie: categorieDefault,
              sous_categorie: categorieDefault === 'immo_pro' ? 'locaux' : 'bfr',
              designation: '',
              valeur: 0,
              description: '',
            },
          ],
        })
      }

      const removeProRow = (index: number) => {
        setEditData({
          ...editData,
          patrimoine_professionnel: pro.filter((_, i) => i !== index),
        })
      }

      const updateProRow = (index: number, field: string, value: any) => {
        const updated = [...pro]
        updated[index] = { ...updated[index], [field]: value }
        setEditData({ ...editData, patrimoine_professionnel: updated })
      }

      // Totaux par bloc (utile côté lecture)
      const totalImmoPro = pro
        .filter(r => r.categorie === 'immo_pro')
        .reduce((sum, r) => sum + (r.valeur || 0), 0)
      const totalFinancierPro = pro
        .filter(r => r.categorie === 'financier_pro')
        .reduce((sum, r) => sum + (r.valeur || 0), 0)
      const totalPro = totalImmoPro + totalFinancierPro

      const renderEditTable = (categorie: 'immo_pro' | 'financier_pro') => {
        const rowsWithIndex = pro
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => row.categorie === categorie)
        return (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                {labelCategoriePro(categorie)}
              </h4>
              <button
                onClick={() => addProRow(categorie)}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus size={12} /> Ajouter une ligne
              </button>
            </div>
            {rowsWithIndex.length === 0 ? (
              <p className="text-xs text-gray-500 italic">Aucune ligne</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-1 px-1 font-semibold">Sous-catégorie</th>
                      <th className="text-left py-1 px-1 font-semibold">Désignation</th>
                      <th className="text-right py-1 px-1 font-semibold">Valeur (€)</th>
                      <th className="text-left py-1 px-1 font-semibold">Description</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsWithIndex.map(({ row, index }) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="py-1 px-1">
                          <select
                            value={row.sous_categorie || ''}
                            onChange={e => updateProRow(index, 'sous_categorie', e.target.value)}
                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="">—</option>
                            {PATRIMOINE_PRO_SOUS_CATEGORIE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 px-1">
                          <input
                            type="text"
                            value={row.designation || ''}
                            onChange={e => updateProRow(index, 'designation', e.target.value)}
                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                          />
                        </td>
                        <td className="py-1 px-1 text-right">
                          <input
                            type="number"
                            value={row.valeur ?? 0}
                            onChange={e => updateProRow(index, 'valeur', parseFloat(e.target.value) || 0)}
                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs text-right"
                          />
                        </td>
                        <td className="py-1 px-1">
                          <input
                            type="text"
                            value={row.description || ''}
                            onChange={e => updateProRow(index, 'description', e.target.value)}
                            placeholder="Optionnel"
                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                          />
                        </td>
                        <td className="py-1 px-1">
                          <button
                            onClick={() => removeProRow(index)}
                            className="text-red-500 hover:text-red-700"
                            title="Supprimer"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      }

      const renderReadList = (categorie: 'immo_pro' | 'financier_pro') => {
        const rows = pro.filter(r => r.categorie === categorie)
        const total = rows.reduce((sum, r) => sum + (r.valeur || 0), 0)
        return (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                {labelCategoriePro(categorie)}
              </h4>
              {rows.length > 0 && (
                <span className="text-xs font-semibold text-indigo-600">
                  {formatCurrency(total)}
                </span>
              )}
            </div>
            {rows.length === 0 ? (
              <p className="text-xs text-gray-500 italic">Aucune ligne</p>
            ) : (
              <ul className="space-y-1">
                {rows.map((row, i) => (
                  <li key={i} className="flex items-start justify-between text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">
                        {labelSousCategoriePro(row.sous_categorie)}
                      </span>
                      {row.designation && (
                        <span className="text-gray-600"> — {row.designation}</span>
                      )}
                      {row.description && (
                        <div className="text-[10px] text-gray-400 italic">{row.description}</div>
                      )}
                    </div>
                    <span className="ml-2 text-gray-900 tabular-nums">
                      {formatCurrency(row.valeur || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      }

      return (
        <div className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-600" />
              ) : (
                <ChevronRight size={16} className="text-gray-600" />
              )}
              <h3 className="font-semibold text-sm text-gray-900">
                Patrimoine professionnel
              </h3>
            </div>
            {!isEditMode && totalPro > 0 && (
              <span className="text-sm font-bold text-indigo-600">
                {formatCurrency(totalPro)}
              </span>
            )}
          </button>
          {isExpanded && (
            <div className="px-3 pb-3 bg-gray-50/50">
              {isEditMode ? (
                <>
                  {renderEditTable('immo_pro')}
                  {renderEditTable('financier_pro')}
                </>
              ) : (
                <>
                  {renderReadList('immo_pro')}
                  {renderReadList('financier_pro')}
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Produits financiers section
    const ProduitsFinianciers = () => {
      const section: SectionKey = 'produits_financiers'
      const isExpanded = expandedSections.has(section)
      const produits: ProduitFinancierRow[] = (data.produits_financiers || []) as ProduitFinancierRow[]

      const addProduitRow = () => {
        setEditData({
          ...editData,
          produits_financiers: [
            ...produits,
            {
              type_produit: '',
              designation: '',
              detenteur: '',
              valeur: 0,
              date_ouverture: '',
              versements_reguliers: '',
              rendement: 0,
            },
          ],
        })
      }

      const removeProduitRow = (index: number) => {
        setEditData({
          ...editData,
          produits_financiers: produits.filter((_, i) => i !== index),
        })
      }

      const updateProduitRow = (index: number, field: string, value: any) => {
        const updated = [...produits]
        updated[index] = { ...updated[index], [field]: value }
        setEditData({ ...editData, produits_financiers: updated })
      }

      return (
        <div className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-600" />
              ) : (
                <ChevronRight size={16} className="text-gray-600" />
              )}
              <h3 className="font-semibold text-sm text-gray-900">
                Produits financiers
              </h3>
            </div>
            {!isEditMode && produits.length > 0 && (
              <span className="text-sm font-bold text-indigo-600">
                {formatCurrency(produits.reduce((sum, row) => sum + (row.valeur ?? 0), 0))}
              </span>
            )}
          </button>

          {isExpanded && (
            <div className="px-3 pb-3 bg-gray-50/50">
              {isEditMode ? (
                <div className="space-y-2">
                  {produits.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">
                      Aucun produit financier
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-1 px-1 font-semibold">
                              Type
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Désignation
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Détenteur
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Valeur
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Date ouv.
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Versements
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Rendement %
                            </th>
                            <th className="text-center py-1 px-1">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {produits.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="py-1 px-1">
                                <select
                                  value={row.type_produit || ''}
                                  onChange={e =>
                                    updateProduitRow(
                                      idx,
                                      'type_produit',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs bg-white"
                                >
                                  <option value="">—</option>
                                  {row.type_produit &&
                                    !(TYPE_PRODUIT_FINANCIER_OPTIONS as readonly string[]).includes(
                                      row.type_produit
                                    ) && (
                                      <option value={row.type_produit}>
                                        {row.type_produit}
                                      </option>
                                    )}
                                  {TYPE_PRODUIT_FINANCIER_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="text"
                                  value={row.designation}
                                  onChange={e =>
                                    updateProduitRow(idx, 'designation', e.target.value)
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1 min-w-[140px]">
                                <DetenteurCell
                                  value={row.detenteur_type}
                                  coTitulaireId={row.co_titulaire_client_id}
                                  onChange={(type, coTitId) => {
                                    const updated = [...produits]
                                    updated[idx] = {
                                      ...updated[idx],
                                      detenteur_type: type,
                                      co_titulaire_client_id: coTitId,
                                    }
                                    setEditData({
                                      ...editData,
                                      produits_financiers: updated,
                                    })
                                  }}
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  value={row.valeur}
                                  onChange={e =>
                                    updateProduitRow(
                                      idx,
                                      'valeur',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="date"
                                  value={row.date_ouverture}
                                  onChange={e =>
                                    updateProduitRow(idx, 'date_ouverture', e.target.value)
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="text"
                                  value={row.versements_reguliers}
                                  onChange={e =>
                                    updateProduitRow(
                                      idx,
                                      'versements_reguliers',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  value={row.rendement}
                                  onChange={e =>
                                    updateProduitRow(
                                      idx,
                                      'rendement',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1 text-center">
                                <button
                                  onClick={() => removeProduitRow(idx)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <button
                    onClick={addProduitRow}
                    className="mt-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  >
                    <Plus size={12} />
                    Ajouter un produit
                  </button>
                </div>
              ) : (
                <>
                  {produits.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2">
                      Aucun produit financier
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-1 px-1 font-semibold">
                              Type
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Désignation
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Détenteur
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Valeur
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Date ouv.
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Versements
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Rendement %
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {produits.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="py-1 px-1 text-gray-900">
                                {row.type_produit || '-'}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.designation || '-'}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.detenteur_type
                                  ? DETENTEUR_TYPE_LABELS[row.detenteur_type]
                                  : row.detenteur || 'Client'}
                                {(row.detenteur_type === 'co_titulaire' ||
                                  row.detenteur_type === 'joint') && (
                                  <span className="block text-gray-500 text-[10px]">
                                    {coTitulaireLabel(row.co_titulaire_client_id)}
                                  </span>
                                )}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatCurrency(row.valeur)}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.date_ouverture || '-'}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.versements_reguliers || '-'}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {row.rendement}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Emprunts & Charges section
    const EmpruntsSection = () => {
      const section: SectionKey = 'emprunts'
      const isExpanded = expandedSections.has(section)
      const emprunts: EmpruntRow[] = (data.emprunts || []) as EmpruntRow[]

      const addEmpruntRow = () => {
        setEditData({
          ...editData,
          emprunts: [
            ...emprunts,
            {
              designation: '',
              etablissement: '',
              montant: 0,
              date: '',
              duree: '',
              taux: 0,
              crd: 0,
              echeance: '',
              echeance_mensuelle: 0,
            },
          ],
        })
      }

      const removeEmpruntRow = (index: number) => {
        setEditData({
          ...editData,
          emprunts: emprunts.filter((_, i) => i !== index),
        })
      }

      const updateEmpruntRow = (index: number, field: string, value: any) => {
        const updated = [...emprunts]
        updated[index] = { ...updated[index], [field]: value }
        setEditData({ ...editData, emprunts: updated })
      }

      return (
        <div className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-600" />
              ) : (
                <ChevronRight size={16} className="text-gray-600" />
              )}
              <h3 className="font-semibold text-sm text-gray-900">
                Emprunts & Charges
              </h3>
            </div>
          </button>

          {isExpanded && (
            <div className="px-3 pb-3 bg-gray-50/50">
              {isEditMode ? (
                <div className="space-y-2">
                  {emprunts.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Aucun emprunt</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-1 px-1 font-semibold">
                              Désignation
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Établissement
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Montant
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Date
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Durée
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Taux %
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">CRD</th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Date fin
                            </th>
                            <th
                              className="text-right py-1 px-1 font-semibold"
                              title="Montant mensuel remboursé — utilisé pour le calcul du taux d'endettement"
                            >
                              Éch. mens. €
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Détenteur
                            </th>
                            <th className="text-center py-1 px-1">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emprunts.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="py-1 px-1">
                                <input
                                  type="text"
                                  value={row.designation}
                                  onChange={e =>
                                    updateEmpruntRow(idx, 'designation', e.target.value)
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="text"
                                  value={row.etablissement}
                                  onChange={e =>
                                    updateEmpruntRow(idx, 'etablissement', e.target.value)
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  value={row.montant}
                                  onChange={e =>
                                    updateEmpruntRow(
                                      idx,
                                      'montant',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="date"
                                  value={row.date}
                                  onChange={e =>
                                    updateEmpruntRow(idx, 'date', e.target.value)
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="text"
                                  value={row.duree}
                                  onChange={e =>
                                    updateEmpruntRow(idx, 'duree', e.target.value)
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  value={row.taux}
                                  onChange={e =>
                                    updateEmpruntRow(
                                      idx,
                                      'taux',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  value={row.crd}
                                  onChange={e =>
                                    updateEmpruntRow(
                                      idx,
                                      'crd',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="date"
                                  value={row.echeance}
                                  onChange={e =>
                                    updateEmpruntRow(idx, 'echeance', e.target.value)
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="number"
                                  value={row.echeance_mensuelle ?? ''}
                                  placeholder="Obligatoire"
                                  onChange={e =>
                                    updateEmpruntRow(
                                      idx,
                                      'echeance_mensuelle',
                                      e.target.value === ''
                                        ? undefined
                                        : parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className={`w-full px-1 py-0.5 border rounded text-xs ${
                                    typeof row.echeance_mensuelle !== 'number'
                                      ? 'border-orange-400 bg-orange-50'
                                      : 'border-gray-300'
                                  }`}
                                  title="Montant de la mensualité — requis pour le taux d'endettement"
                                />
                              </td>
                              <td className="py-1 px-1 min-w-[140px]">
                                <DetenteurCell
                                  value={row.detenteur_type}
                                  coTitulaireId={row.co_titulaire_client_id}
                                  onChange={(type, coTitId) => {
                                    const updated = [...emprunts]
                                    updated[idx] = {
                                      ...updated[idx],
                                      detenteur_type: type,
                                      co_titulaire_client_id: coTitId,
                                    }
                                    setEditData({
                                      ...editData,
                                      emprunts: updated,
                                    })
                                  }}
                                />
                              </td>
                              <td className="py-1 px-1 text-center">
                                <button
                                  onClick={() => removeEmpruntRow(idx)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <button
                    onClick={addEmpruntRow}
                    className="mt-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  >
                    <Plus size={12} />
                    Ajouter un emprunt
                  </button>
                </div>
              ) : (
                <>
                  {emprunts.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2">
                      Aucun emprunt
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-1 px-1 font-semibold">
                              Désignation
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Établissement
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Montant
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Date
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Durée
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Taux %
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">CRD</th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Date fin
                            </th>
                            <th
                              className="text-right py-1 px-1 font-semibold"
                              title="Montant de la mensualité — utilisé pour le taux d'endettement"
                            >
                              Éch. mens.
                            </th>
                            <th className="text-left py-1 px-1 font-semibold">
                              Détenteur
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {emprunts.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="py-1 px-1 text-gray-900">
                                {row.designation || '-'}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.etablissement || '-'}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatCurrency(row.montant)}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.date || '-'}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.duree || '-'}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {row.taux}%
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatCurrency(row.crd)}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.echeance || '-'}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {typeof row.echeance_mensuelle === 'number'
                                  ? formatCurrency(row.echeance_mensuelle)
                                  : '—'}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.detenteur_type
                                  ? DETENTEUR_TYPE_LABELS[row.detenteur_type]
                                  : 'Client'}
                                {(row.detenteur_type === 'co_titulaire' ||
                                  row.detenteur_type === 'joint') && (
                                  <span className="block text-gray-500 text-[10px]">
                                    {coTitulaireLabel(row.co_titulaire_client_id)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Fiscalité section
    const FiscaliteSection = () => {
      const section: SectionKey = 'fiscalite'
      const isExpanded = expandedSections.has(section)

      return (
        <div className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-600" />
              ) : (
                <ChevronRight size={16} className="text-gray-600" />
              )}
              <h3 className="font-semibold text-sm text-gray-900">Fiscalité</h3>
            </div>
          </button>

          {isExpanded && (
            <div className="px-3 pb-3 space-y-3 bg-gray-50/50">
              {isEditMode ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Impôt sur le revenu N
                    </label>
                    <input
                      type="number"
                      value={data.impot_revenu_n || 0}
                      onChange={e =>
                        setEditData({
                          ...editData,
                          impot_revenu_n: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Impôt sur le revenu N-1
                    </label>
                    <input
                      type="number"
                      value={data.impot_revenu_n1 || 0}
                      onChange={e =>
                        setEditData({
                          ...editData,
                          impot_revenu_n1: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Impôt sur le revenu N-2
                    </label>
                    <input
                      type="number"
                      value={data.impot_revenu_n2 || 0}
                      onChange={e =>
                        setEditData({
                          ...editData,
                          impot_revenu_n2: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500">Impôt sur le revenu N</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(data.impot_revenu_n)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Impôt sur le revenu N-1</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(data.impot_revenu_n1)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Impôt sur le revenu N-2</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(data.impot_revenu_n2)}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Objectifs section
    const ObjectifsSection = () => {
      const section: SectionKey = 'objectifs'
      const isExpanded = expandedSections.has(section)

      return (
        <div className="border-b border-gray-200 last:border-b-0">
          <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-600" />
              ) : (
                <ChevronRight size={16} className="text-gray-600" />
              )}
              <h3 className="font-semibold text-sm text-gray-900">
                Objectifs client
              </h3>
            </div>
          </button>

          {isExpanded && (
            <div className="px-3 pb-3 bg-gray-50/50">
              {isEditMode ? (
                <textarea
                  value={data.objectifs_client || ''}
                  onChange={e =>
                    setEditData({ ...editData, objectifs_client: e.target.value })
                  }
                  rows={3}
                  placeholder="Décrire les objectifs du client..."
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                />
              ) : (
                <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                  {displayValue(data.objectifs_client)}
                </p>
              )}
            </div>
          )}
        </div>
      )
    }

    // Workflow KYC par lien public : génère/réutilise un token, puis soit
    // copie le lien dans le presse-papier, soit ouvre Gmail pré-rempli.
    // Dans les deux cas on appelle mark-sent pour passer en statut "Envoyé"
    // (RPC idempotente côté Postgres via COALESCE).
    const fetchKycLink = async (): Promise<
      | { url: string; gmail_compose: string; recipient_email: string | null }
      | null
    > => {
      if (!client?.id) return null
      const res = await fetch('/api/kyc/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || `Erreur ${res.status}`)
      }
      return {
        url: json.url,
        gmail_compose: json.gmail_compose,
        recipient_email: json.recipient_email ?? null,
      }
    }

    const markKycSent = async () => {
      if (!client?.id) return
      await fetch('/api/kyc/mark-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id }),
      }).catch(() => null)
    }

    const handleCopyKycLink = async () => {
      setLinkFeedback(null)
      setLinkBusy('copy')
      try {
        const info = await fetchKycLink()
        if (!info) return
        try {
          await navigator.clipboard.writeText(info.url)
          setLinkFeedback('Lien copié dans le presse-papier')
        } catch {
          window.prompt('Copiez le lien KYC ci-dessous :', info.url)
          setLinkFeedback('Lien affiché (copie auto indisponible)')
        }
        await markKycSent()
        onUpdate()
      } catch (e: any) {
        setLinkFeedback(`Erreur : ${e?.message || 'inconnue'}`)
      } finally {
        setLinkBusy(null)
        setTimeout(() => setLinkFeedback(null), 4000)
      }
    }

    const handleEmailKyc = async () => {
      setLinkFeedback(null)
      setLinkBusy('email')
      try {
        const info = await fetchKycLink()
        if (!info) return
        // Ouvre Gmail compose pré-rempli dans un nouvel onglet.
        window.open(info.gmail_compose, '_blank', 'noopener,noreferrer')
        await markKycSent()
        setLinkFeedback(
          info.recipient_email
            ? `Gmail ouvert → ${info.recipient_email}`
            : 'Gmail ouvert (pas d\'email client enregistré)'
        )
        onUpdate()
      } catch (e: any) {
        setLinkFeedback(`Erreur : ${e?.message || 'inconnue'}`)
      } finally {
        setLinkBusy(null)
        setTimeout(() => setLinkFeedback(null), 4000)
      }
    }

    // Chantier 5 étape 3 audit KYC (2026-04-24) : envoi auto via Gmail API.
    // Alternative au flux `handleEmailKyc` (ouvre Gmail web pour que le
    // consultant envoie manuellement) — ici le CRM envoie lui-même en
    // utilisant le template `kyc_envoi_lien` (personnalisable dans
    // Paramètres → Communication). Côté code, /api/kyc/send-link fait
    // le full pipeline : generate_token + charge template + sendEmail
    // (Gmail API) + mark-sent.
    const handleSendKycLinkAuto = async () => {
      if (!client?.id) return
      setLinkFeedback(null)
      setLinkBusy('send_auto')
      try {
        const res = await fetch('/api/kyc/send-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: client.id }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || `Erreur ${res.status}`)
        }
        const email = json.email as { sent: boolean; error?: string } | undefined
        if (email?.sent) {
          setLinkFeedback(`Email envoyé → ${json.recipient_email}`)
        } else {
          setLinkFeedback(
            `Lien généré, mais envoi email indisponible : ${email?.error || 'raison inconnue'}. Utilise "Ouvrir dans Gmail" pour envoyer manuellement.`,
          )
        }
        onUpdate()
      } catch (e: any) {
        setLinkFeedback(`Erreur : ${e?.message || 'inconnue'}`)
      } finally {
        setLinkBusy(null)
        setTimeout(() => setLinkFeedback(null), 6000)
      }
    }

    return (
      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield size={18} className="text-gray-600" />
              KYC - Know Your Customer
              {/* Badge de complétude — toujours visible */}
              <span
                className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  completion.rate >= 100
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : completion.rate >= 70
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
                title={`${completion.filled} / ${completion.total} champs requis renseignés`}
              >
                {completion.rate >= 100 ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <AlertTriangle size={12} />
                )}
                {completion.rate}%
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {!isEditMode && (
                <>
                  {/* Badge de statut workflow (Brouillon / Envoyé / En cours / Signé). */}
                  {(() => {
                    const statusStyles: Record<
                      typeof kycStatus,
                      { bg: string; label: string; Icon: any; title: string }
                    > = {
                      brouillon: {
                        bg: 'bg-gray-100 text-gray-700 border-gray-200',
                        label: 'Brouillon',
                        Icon: Pencil,
                        title: 'Aucun lien envoyé au client',
                      },
                      envoye: {
                        bg: 'bg-blue-50 text-blue-700 border-blue-200',
                        label: 'Envoyé',
                        Icon: Mail,
                        title: kycSentAt
                          ? `Lien envoyé le ${new Date(kycSentAt).toLocaleString('fr-FR')}`
                          : 'Lien envoyé au client',
                      },
                      en_cours: {
                        bg: 'bg-amber-50 text-amber-700 border-amber-200',
                        label: 'En cours',
                        Icon: Eye,
                        title: kycOpenedAt
                          ? `Ouvert par le client le ${new Date(kycOpenedAt).toLocaleString('fr-FR')}`
                          : 'Lien ouvert par le client',
                      },
                      signe: {
                        bg: kycIncompleteSigned
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-green-50 text-green-700 border-green-200',
                        label: kycIncompleteSigned ? 'Signé incomplet' : 'Signé',
                        Icon: kycIncompleteSigned ? AlertTriangle : CheckCircle2,
                        title: kycSignedAt
                          ? `Signé le ${new Date(kycSignedAt).toLocaleString('fr-FR')}`
                          : 'KYC signé',
                      },
                    }
                    const s = statusStyles[kycStatus]
                    const Icon = s.Icon
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg}`}
                        title={s.title}
                      >
                        <Icon size={12} />
                        {s.label}
                      </span>
                    )
                  })()}

                  {/* Actions workflow : disponibles tant que le KYC n'est pas signé. */}
                  {!kycSignedAt && (
                    <>
                      <button
                        onClick={handleCopyKycLink}
                        disabled={linkBusy !== null}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-navy-700 bg-navy-50 border border-navy-200 rounded hover:bg-navy-100 transition-colors disabled:opacity-50"
                        title="Générer/réutiliser un lien privé et le copier dans le presse-papier"
                      >
                        {linkBusy === 'copy' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Copy size={14} />
                        )}
                        Copier le lien
                      </button>
                      <button
                        onClick={handleSendKycLinkAuto}
                        disabled={linkBusy !== null}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 border border-green-600 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                        title="Envoi automatique par le CRM (template kyc_envoi_lien, personnalisable dans Paramètres → Communication)"
                      >
                        {linkBusy === 'send_auto' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                        Envoyer le lien (auto)
                      </button>
                      <button
                        onClick={handleEmailKyc}
                        disabled={linkBusy !== null}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-navy-700 border border-navy-700 rounded hover:bg-navy-800 transition-colors disabled:opacity-50"
                        title="Ouvrir Gmail avec un brouillon pré-rempli vers le client (mode manuel)"
                      >
                        {linkBusy === 'email' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Mail size={14} />
                        )}
                        Ouvrir dans Gmail
                      </button>
                    </>
                  )}

                  {/* Re-signer manuel (offline) — garde le flux existant via modale. */}
                  <button
                    onClick={() => setSignatureOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    title={
                      kycSignedAt
                        ? 'Re-signer manuellement (écrase la précédente signature)'
                        : 'Signer manuellement sur place (hors parcours email)'
                    }
                  >
                    <PenLine size={14} />
                    {kycSignedAt ? 'Re-signer' : 'Signer sur place'}
                  </button>
                </>
              )}
              {!isEditMode ? (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Éditer"
                >
                  <Pencil size={16} className="text-gray-500" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-1.5 hover:bg-green-100 rounded transition-colors text-green-600 disabled:opacity-50"
                    title="Enregistrer"
                  >
                    <Save size={16} />
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500 disabled:opacity-50"
                    title="Annuler"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Timeline 3-points : Envoyé → Ouvert → Signé. Donne une lecture
              chronologique à la volée sans ouvrir le tooltip du badge.
              Les 3 dates sont déjà calculées plus haut (kycSentAt,
              kycOpenedAt, kycSignedAt). On n'affiche la timeline que si au
              moins l'envoi a eu lieu — avant ça, le badge "Brouillon" suffit
              (pas d'événement à tracer). */}
          {!isEditMode && kycSentAt && (() => {
            const fmtShort = (iso: string | null): string => {
              if (!iso) return '—'
              const d = new Date(iso)
              if (Number.isNaN(d.getTime())) return '—'
              return d.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })
            }
            const steps: Array<{
              label: string
              date: string | null
              tone: 'blue' | 'amber' | 'green'
            }> = [
              { label: 'Envoyé', date: kycSentAt, tone: 'blue' },
              { label: 'Ouvert', date: kycOpenedAt, tone: 'amber' },
              { label: 'Signé', date: kycSignedAt, tone: 'green' },
            ]
            const toneClasses: Record<'blue' | 'amber' | 'green', { dot: string; label: string }> = {
              blue: { dot: 'bg-blue-500 border-blue-500', label: 'text-blue-700' },
              amber: { dot: 'bg-amber-500 border-amber-500', label: 'text-amber-700' },
              green: { dot: 'bg-green-500 border-green-500', label: 'text-green-700' },
            }
            return (
              <div className="mt-3 flex items-start gap-2 text-xs">
                {steps.map((step, i) => {
                  const done = !!step.date
                  const nextDone = !!steps[i + 1]?.date
                  const t = toneClasses[step.tone]
                  return (
                    <React.Fragment key={step.label}>
                      <div className="flex flex-col items-center min-w-[80px]">
                        <div
                          className={`w-3 h-3 rounded-full border-2 ${
                            done ? t.dot : 'bg-white border-gray-300'
                          }`}
                          aria-hidden="true"
                        />
                        <div
                          className={`mt-1 font-medium ${
                            done ? t.label : 'text-gray-400'
                          }`}
                        >
                          {step.label}
                        </div>
                        <div
                          className={`${
                            done ? 'text-gray-600' : 'text-gray-400'
                          }`}
                        >
                          {fmtShort(step.date)}
                        </div>
                      </div>
                      {i < steps.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mt-1.5 ${
                            done && nextDone
                              ? 'bg-gray-400'
                              : 'bg-gray-200'
                          }`}
                          aria-hidden="true"
                        />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            )
          })()}

          {/* Feedback inline après "Copier le lien" ou "Envoyer par email". */}
          {linkFeedback && (
            <div className="mt-3 p-2 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
              <Clock size={12} />
              <span>{linkFeedback}</span>
            </div>
          )}

          {/* Bannière d'audit si KYC signé — rouge si incomplet, verte si complet. */}
          {kycSignedAt && (
            <div
              className={`mt-3 p-3 rounded-lg border text-sm ${
                kycIncompleteSigned
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}
            >
              <div className="flex items-start gap-2">
                {kycIncompleteSigned ? (
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">
                    {kycIncompleteSigned
                      ? `Document signé avec des informations incomplètes (${kycCompletionAtSign ?? '?'}%)`
                      : 'KYC signé'}
                  </p>
                  <p className="text-xs opacity-90 mt-0.5">
                    Signé le{' '}
                    {new Date(kycSignedAt).toLocaleString('fr-FR', {
                      dateStyle: 'long',
                      timeStyle: 'short',
                    })}
                    {kycSignerName ? ` par ${kycSignerName}` : ''}
                    {kycIncompleteSigned
                      ? ' — consentement explicite enregistré.'
                      : '.'}
                  </p>
                  {kycPdfUrl && (
                    <p className="text-xs mt-1">
                      <a
                        href={kycPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-medium"
                      >
                        Télécharger le PDF signé
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-200">
            {/*
              IMPORTANT: ces sous-"composants" sont en fait des closures
              locales qui referment sur le state/setters du KYCSection.
              On les APPELLE en fonctions ({FooSection()}) au lieu de les
              monter en JSX (<FooSection />) : cela évite à React de les
              traiter comme un nouveau type de composant à chaque render
              du parent, ce qui provoquait un unmount+remount à chaque
              frappe (bug de perte de focus signalé 2026-04-21).
            */}
            {EtatCivilSection()}
            {SituationFamilialeSection()}
            {SituationProfessionnelleSection()}
            {RevenusSection()}
            {PatrimoineImmobilierSection()}
            {PatrimoineProfessionnelSection()}
            {ProduitsFinianciers()}
            {EmpruntsSection()}
            {FiscaliteSection()}
            {ObjectifsSection()}

            {/*
              Actifs joints « externes » — détenus par un autre client PEV qui
              a déclaré cette fiche comme co-titulaire. Affichés en lecture
              seule, l'édition se fait sur le dossier source (source de vérité).
              Rend rien si la liste est vide. Cf. lib/kyc-bidi.ts.
            */}
            {externalJointAssets.length > 0 && !isEditMode && (
              <div className="border-b border-gray-200 last:border-b-0">
                <div className="p-3 bg-indigo-50/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className="text-indigo-600" />
                    <h3 className="font-semibold text-sm text-gray-900">
                      Actifs détenus avec un autre client
                    </h3>
                  </div>
                  <p className="text-[11px] text-gray-600 mb-2">
                    Ces actifs sont enregistrés sur la fiche d&apos;un
                    autre client. Ils apparaissent ici en lecture seule —
                    toute modification doit se faire sur la fiche source.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 px-1 font-semibold">
                            Section
                          </th>
                          <th className="text-left py-1 px-1 font-semibold">
                            Type
                          </th>
                          <th className="text-left py-1 px-1 font-semibold">
                            Désignation
                          </th>
                          <th className="text-right py-1 px-1 font-semibold">
                            Valeur
                          </th>
                          <th className="text-left py-1 px-1 font-semibold">
                            Édité sur dossier
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {externalJointAssets.map((ext, i) => {
                          const row = ext.row as Record<string, unknown>
                          const designation =
                            (row.designation as string | undefined) ||
                            (row.type_bien as string | undefined) ||
                            (row.type_produit as string | undefined) ||
                            '-'
                          const valeur =
                            (row.valeur_actuelle as number | undefined) ??
                            (row.valeur as number | undefined) ??
                            (row.montant as number | undefined)
                          const sectionLabel =
                            ext.section === 'patrimoine_immobilier'
                              ? 'Immobilier'
                              : ext.section === 'patrimoine_professionnel'
                              ? 'Pro'
                              : ext.section === 'produits_financiers'
                              ? 'Financier'
                              : ext.section === 'emprunts'
                              ? 'Emprunt'
                              : 'Divers'
                          // Point 4.3 (2026-04-24) — badge kind :
                          // joint = détenu en commun ; co_titulaire =
                          // détenu exclusivement par le co-titulaire
                          // (la fiche courante) mais saisi sur une autre.
                          const kindLabel = ext.kind === 'joint' ? 'Joint' : 'Co-titulaire'
                          const kindClass =
                            ext.kind === 'joint'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-amber-100 text-amber-700'
                          return (
                            <tr
                              key={`${ext.source_client_id}-${ext.section}-${ext.source_index}-${i}`}
                              className="border-b border-gray-200"
                            >
                              <td className="py-1 px-1 text-gray-900">
                                {sectionLabel}
                              </td>
                              <td className="py-1 px-1">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${kindClass}`}>
                                  {kindLabel}
                                </span>
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {designation}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {typeof valeur === 'number'
                                  ? formatCurrency(valeur)
                                  : '-'}
                              </td>
                              <td className="py-1 px-1">
                                <a
                                  href={`/dashboard/clients/${ext.source_client_id}`}
                                  className="text-indigo-600 hover:underline"
                                >
                                  {ext.source_client_display}
                                </a>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <KYCSignatureDialog
          open={signatureOpen}
          onClose={() => setSignatureOpen(false)}
          client={client}
          onSigned={onUpdate}
        />
      </Card>
    )
  }
)

KYCSection.displayName = 'KYCSection'

export { KYCSection }
