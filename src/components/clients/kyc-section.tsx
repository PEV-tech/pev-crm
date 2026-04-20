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
} from 'lucide-react'
import { computeKycCompletion } from '@/lib/kyc-completion'
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
  | 'produits_financiers'
  | 'emprunts'
  | 'fiscalite'
  | 'objectifs'

interface EditState {
  [key: string]: any
}

interface KYCSectionHandle {
  populateFromKyc: (data: any) => void
}

const KYCSection = React.forwardRef<KYCSectionHandle, KYCSectionProps>(
  ({ client, onUpdate }, ref) => {
    const [isEditMode, setIsEditMode] = React.useState(false)
    const [expandedSections, setExpandedSections] = React.useState<Set<SectionKey>>(
      new Set()
    )
    const [editData, setEditData] = React.useState<EditState>({})
    const [saving, setSaving] = React.useState(false)
    const [signatureOpen, setSignatureOpen] = React.useState(false)

    const supabase = React.useMemo(() => createClient(), [])

    // Complétude calculée à partir du client actuel (recalculée à chaque
    // changement de props — les edits en cours ne comptent pas tant que
    // non sauvés, comportement voulu pour que la signature reflète l'état
    // persisté).
    const completion = React.useMemo(() => computeKycCompletion(client), [client])
    const kycSignedAt: string | null = client?.kyc_signed_at ?? null
    const kycIncompleteSigned: boolean = client?.kyc_incomplete_signed === true
    const kycSignerName: string | null = client?.kyc_signer_name ?? null
    const kycCompletionAtSign: number | null = client?.kyc_completion_rate ?? null

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
        proprietaire_locataire: client?.proprietaire_locataire,
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
            proprietaire_locataire: proprio,
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
              designation: item.designation || '',
              date_acq: item.date_acq || item.date_acquisition || '',
              valeur_acq: item.valeur_acq ?? item.valeur_acquisition ?? 0,
              valeur_actuelle: item.valeur_actuelle ?? 0,
              detention: item.detention || '',
              taux_credit: item.taux_credit ?? 0,
              duree_credit: item.duree_credit ?? 0,
              crd: item.crd ?? 0,
              charges: item.charges ?? 0,
            })),
            produits_financiers: (data.produits_financiers || []).map((item: any) => ({
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
          proprietaire_locataire: editData.proprietaire_locataire,
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
        proprietaire_locataire: client?.proprietaire_locataire,
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
                      <input
                        type="text"
                        value={data.nationalite || ''}
                        onChange={e =>
                          setEditData({ ...editData, nationalite: e.target.value })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Résidence fiscale
                      </label>
                      <input
                        type="text"
                        value={data.residence_fiscale || ''}
                        onChange={e =>
                          setEditData({
                            ...editData,
                            residence_fiscale: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
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
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Propriétaire / Locataire
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
                      <option value="">Sélectionner</option>
                      <option value="Propriétaire">Propriétaire</option>
                      <option value="Locataire">Locataire</option>
                    </select>
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

                  <div>
                    <p className="text-xs text-gray-500">Propriétaire / Locataire</p>
                    <p className="text-sm font-medium text-gray-900">
                      {displayValue(data.proprietaire_locataire)}
                    </p>
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
                      onChange={e =>
                        setEditData({
                          ...editData,
                          situation_matrimoniale: e.target.value,
                        })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    >
                      <option value="">Sélectionner</option>
                      <option value="Célibataire">Célibataire</option>
                      <option value="Concubinage">Concubinage</option>
                      <option value="Pacsé(e)">Pacsé(e)</option>
                      <option value="Marié(e)">Marié(e)</option>
                      <option value="Veuf(ve)">Veuf(ve)</option>
                      <option value="Divorcé(e)">Divorcé(e)</option>
                    </select>
                  </div>

                  {(data.situation_matrimoniale === 'Marié(e)' ||
                    data.situation_matrimoniale === 'Pacsé(e)') && (
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Régime matrimonial
                      </label>
                      <input
                        type="text"
                        value={data.regime_matrimonial || ''}
                        onChange={e =>
                          setEditData({
                            ...editData,
                            regime_matrimonial: e.target.value,
                          })
                        }
                        className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
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

                  {(data.situation_matrimoniale === 'Marié(e)' ||
                    data.situation_matrimoniale === 'Pacsé(e)') && (
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
                    <input
                      type="text"
                      placeholder="p.ex. 2020 ou Jan. 2020"
                      value={data.date_debut_emploi || ''}
                      onChange={e =>
                        setEditData({ ...editData, date_debut_emploi: e.target.value })
                      }
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    />
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

      // Taux d'endettement = total échéances emprunts mensuelles / revenus mensuels
      const empruntsArr = data.emprunts || []
      const totalEcheancesMensuelles = empruntsArr.reduce(
        (sum: number, e: any) => sum + (e.echeance || 0),
        0
      )
      const revenusMensuels = totalRevenus / 12
      const tauxEndettement =
        revenusMensuels > 0
          ? Math.round((totalEcheancesMensuelles / revenusMensuels) * 10000) / 100
          : 0

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

                  {tauxEndettement > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-600">
                        Taux d'endettement
                      </p>
                      <p className={`text-sm font-bold mt-1 ${tauxEndettement > 35 ? 'text-red-600' : tauxEndettement > 25 ? 'text-orange-600' : 'text-green-600'}`}>
                        {tauxEndettement}%
                        {tauxEndettement > 35 && ' ⚠️ Élevé'}
                      </p>
                    </div>
                  )}
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

                  {tauxEndettement > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-600">
                        Taux d'endettement
                      </p>
                      <p className={`text-sm font-bold ${tauxEndettement > 35 ? 'text-red-600' : tauxEndettement > 25 ? 'text-orange-600' : 'text-green-600'}`}>
                        {tauxEndettement}%
                        {tauxEndettement > 35 && ' ⚠️ Élevé'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Patrimoine immobilier section
    const PatrimoineImmobilierSection = () => {
      const section: SectionKey = 'patrimoine_immobilier'
      const isExpanded = expandedSections.has(section)
      const immobilier = data.patrimoine_immobilier || []

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

      // Format currency with 50% annotation when communauté
      const formatImmoValue = (value: number | undefined | null, detention: string | undefined | null): React.ReactNode => {
        if (value === undefined || value === null || value === 0) return formatCurrency(0)
        if (isCommunaute(detention)) {
          const half = Math.round(value / 2)
          return (
            <span>
              {formatCurrency(half)}
              <span className="text-[10px] text-gray-400 ml-1">(50% de {formatCurrency(value)})</span>
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
              designation: '',
              date_acq: '',
              valeur_acq: 0,
              valeur_actuelle: 0,
              detention: '',
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
                              Taux %
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Durée (ans)
                            </th>
                            <th className="text-right py-1 px-1 font-semibold">CRD</th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Charges
                            </th>
                            <th className="text-center py-1 px-1">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {immobilier.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
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
                                <input
                                  type="text"
                                  placeholder="ex: 50/50"
                                  value={row.detention || ''}
                                  onChange={e =>
                                    updateImmobilierRow(
                                      idx,
                                      'detention',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
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
                            <th className="text-right py-1 px-1 font-semibold">CRD</th>
                            <th className="text-right py-1 px-1 font-semibold">
                              Charges
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {immobilier.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="py-1 px-1 text-gray-900">
                                {row.designation || '-'}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.date_acq || '-'}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatImmoValue(row.valeur_acq, row.detention)}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatImmoValue(row.valeur_actuelle, row.detention)}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.detention || '-'}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatImmoValue(row.crd, row.detention)}
                              </td>
                              <td className="py-1 px-1 text-right text-gray-900">
                                {formatImmoValue(row.charges, row.detention)}
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

    // Produits financiers section
    const ProduitsFinianciers = () => {
      const section: SectionKey = 'produits_financiers'
      const isExpanded = expandedSections.has(section)
      const produits = data.produits_financiers || []

      const addProduitRow = () => {
        setEditData({
          ...editData,
          produits_financiers: [
            ...produits,
            {
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
                                <input
                                  type="text"
                                  value={row.designation}
                                  onChange={e =>
                                    updateProduitRow(idx, 'designation', e.target.value)
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <input
                                  type="text"
                                  value={row.detenteur}
                                  onChange={e =>
                                    updateProduitRow(idx, 'detenteur', e.target.value)
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
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
                                {row.designation || '-'}
                              </td>
                              <td className="py-1 px-1 text-gray-900">
                                {row.detenteur || '-'}
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
      const emprunts = data.emprunts || []

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
                              Échéance
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
                              Échéance
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
                <button
                  onClick={() => setSignatureOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-navy-700 bg-navy-50 border border-navy-200 rounded hover:bg-navy-100 transition-colors"
                  title={
                    kycSignedAt
                      ? 'Re-signer le KYC (remplacera la précédente signature)'
                      : 'Faire signer le KYC par le client'
                  }
                >
                  <PenLine size={14} />
                  {kycSignedAt ? 'Re-signer' : 'Faire signer'}
                </button>
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
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-200">
            <EtatCivilSection />
            <SituationFamilialeSection />
            <SituationProfessionnelleSection />
            <RevenusSection />
            <PatrimoineImmobilierSection />
            <ProduitsFinianciers />
            <EmpruntsSection />
            <FiscaliteSection />
            <ObjectifsSection />
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
