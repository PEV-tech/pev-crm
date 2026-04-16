// Auto-generated Supabase TypeScript types
// Generated from SQL schema at /sessions/wonderful-zen-hypatia/mnt/uploads/schema_supabase_pev.sql

export type Database = {
  public: {
    Tables: {
      consultants: {
        Row: {
          id: string
          auth_user_id: string | null
          nom: string
          prenom: string
          role: RoleType
          taux_remuneration: number
          zone: string | null
          is_pool_member: boolean
          actif: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          nom: string
          prenom: string
          role?: RoleType
          taux_remuneration?: number
          zone?: string | null
          is_pool_member?: boolean
          actif?: boolean
        }
        Update: {
          auth_user_id?: string | null
          nom?: string
          prenom?: string
          role?: RoleType
          taux_remuneration?: number
          zone?: string | null
          is_pool_member?: boolean
          actif?: boolean
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          nom: string
          prenom: string | null
          pays: string
          ville: string | null
          email: string | null
          telephone: string | null
          numero_compte: string | null
          conformite: string | null
          statut_kyc: StatutKycType
          der: boolean
          pi: boolean
          lm: boolean
          rm: boolean
          preco: boolean
          google_drive_url: string | null
          commentaires: string | null
          created_at: string
          updated_at: string
          titre: string | null
          nom_jeune_fille: string | null
          date_naissance: string | null
          lieu_naissance: string | null
          nationalite: string | null
          residence_fiscale: string | null
          nif: string | null
          adresse: string | null
          proprietaire_locataire: string | null
          situation_matrimoniale: string | null
          regime_matrimonial: string | null
          nombre_enfants: number | null
          enfants_details: string | null
          profession: string | null
          statut_professionnel: string | null
          employeur: string | null
          date_debut_emploi: string | null
          revenus_pro_net: number | null
          revenus_fonciers: number | null
          autres_revenus: number | null
          total_revenus_annuel: number | null
          patrimoine_immobilier: Record<string, unknown> | null
          produits_financiers: Record<string, unknown> | null
          patrimoine_divers: Record<string, unknown> | null
          emprunts: Record<string, unknown> | null
          impot_revenu_n: number | null
          impot_revenu_n1: number | null
          impot_revenu_n2: number | null
          objectifs_client: string | null
          kyc_date_signature: string | null
          kyc_uploaded_at: string | null
        }
        Insert: {
          id?: string
          nom: string
          prenom?: string | null
          pays: string
          ville?: string | null
          statut_kyc?: StatutKycType
          der?: boolean
          pi?: boolean
          lm?: boolean
          rm?: boolean
          preco?: boolean
          google_drive_url?: string | null
          commentaires?: string | null
          titre?: string | null
          nom_jeune_fille?: string | null
          date_naissance?: string | null
          lieu_naissance?: string | null
          nationalite?: string | null
          residence_fiscale?: string | null
          nif?: string | null
          adresse?: string | null
          proprietaire_locataire?: string | null
          situation_matrimoniale?: string | null
          regime_matrimonial?: string | null
          nombre_enfants?: number | null
          enfants_details?: string | null
          profession?: string | null
          statut_professionnel?: string | null
          employeur?: string | null
          date_debut_emploi?: string | null
          revenus_pro_net?: number | null
          revenus_fonciers?: number | null
          autres_revenus?: number | null
          total_revenus_annuel?: number | null
          patrimoine_immobilier?: Record<string, unknown> | null
          produits_financiers?: Record<string, unknown> | null
          patrimoine_divers?: Record<string, unknown> | null
          emprunts?: Record<string, unknown> | null
          impot_revenu_n?: number | null
          impot_revenu_n1?: number | null
          impot_revenu_n2?: number | null
          objectifs_client?: string | null
          kyc_date_signature?: string | null
          kyc_uploaded_at?: string | null
        }
        Update: {
          nom?: string
          prenom?: string | null
          pays?: string
          ville?: string | null
          statut_kyc?: StatutKycType
          der?: boolean
          pi?: boolean
          lm?: boolean
          rm?: boolean
          preco?: boolean
          google_drive_url?: string | null
          commentaires?: string | null
          titre?: string | null
          nom_jeune_fille?: string | null
          date_naissance?: string | null
          lieu_naissance?: string | null
          nationalite?: string | null
          residence_fiscale?: string | null
          nif?: string | null
          adresse?: string | null
          proprietaire_locataire?: string | null
          situation_matrimoniale?: string | null
          regime_matrimonial?: string | null
          nombre_enfants?: number | null
          enfants_details?: string | null
          profession?: string | null
          statut_professionnel?: string | null
          employeur?: string | null
          date_debut_emploi?: string | null
          revenus_pro_net?: number | null
          revenus_fonciers?: number | null
          autres_revenus?: number | null
          total_revenus_annuel?: number | null
          patrimoine_immobilier?: Record<string, unknown> | null
          produits_financiers?: Record<string, unknown> | null
          patrimoine_divers?: Record<string, unknown> | null
          emprunts?: Record<string, unknown> | null
          impot_revenu_n?: number | null
          impot_revenu_n1?: number | null
          impot_revenu_n2?: number | null
          objectifs_client?: string | null
          kyc_date_signature?: string | null
          kyc_uploaded_at?: string | null
        }
        Relationships: []
      }
      produits: {
        Row: {
          id: string
          nom: string
          categorie: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          categorie?: string | null
        }
        Update: {
          nom?: string
          categorie?: string | null
        }
        Relationships: []
      }
      compagnies: {
        Row: {
          id: string
          nom: string
          taux_defaut: number | null
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          taux_defaut?: number | null
        }
        Update: {
          nom?: string
          taux_defaut?: number | null
        }
        Relationships: []
      }
      taux_produit_compagnie: {
        Row: {
          id: string
          produit_id: string | null
          compagnie_id: string | null
          taux: number
          description: string | null
          actif: boolean
        }
        Insert: {
          id?: string
          produit_id?: string | null
          compagnie_id?: string | null
          taux: number
          description?: string | null
          actif?: boolean
        }
        Update: {
          produit_id?: string | null
          compagnie_id?: string | null
          taux?: number
          description?: string | null
          actif?: boolean
        }
        Relationships: []
      }
      grilles_frais: {
        Row: {
          id: string
          type_frais: TypeFraisType
          encours_min: number
          encours_max: number | null
          taux: number
          actif: boolean
          created_at: string
        }
        Insert: {
          id?: string
          type_frais: TypeFraisType
          encours_min: number
          encours_max?: number | null
          taux: number
          actif?: boolean
        }
        Update: {
          type_frais?: TypeFraisType
          encours_min?: number
          encours_max?: number | null
          taux?: number
          actif?: boolean
        }
        Relationships: []
      }
      dossiers: {
        Row: {
          id: string
          client_id: string
          consultant_id: string
          produit_id: string | null
          compagnie_id: string | null
          montant: number
          financement: FinancementType | null
          statut: StatutDossierType
          commentaire: string | null
          date_operation: string
          date_entree_en_relation: string | null
          date_signature: string | null
          mode_detention: ModeDetentionType | null
          apporteur_id: string | null
          apporteur_label: string | null
          referent: string | null
          support_id: string | null
          has_apporteur_ext: boolean
          apporteur_ext_nom: string | null
          taux_apporteur_ext: number | null
          co_titulaire_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          consultant_id: string
          produit_id?: string | null
          compagnie_id?: string | null
          montant?: number
          financement?: FinancementType | null
          statut?: StatutDossierType
          commentaire?: string | null
          date_operation?: string
          date_entree_en_relation?: string | null
          date_signature?: string | null
          mode_detention?: ModeDetentionType | null
          apporteur_id?: string | null
          apporteur_label?: string | null
          referent?: string | null
          support_id?: string | null
          has_apporteur_ext?: boolean
          apporteur_ext_nom?: string | null
          taux_apporteur_ext?: number | null
          co_titulaire_id?: string | null
        }
        Update: {
          client_id?: string
          consultant_id?: string
          produit_id?: string | null
          compagnie_id?: string | null
          montant?: number
          financement?: FinancementType | null
          statut?: StatutDossierType
          commentaire?: string | null
          date_operation?: string
          date_entree_en_relation?: string | null
          date_signature?: string | null
          mode_detention?: ModeDetentionType | null
          apporteur_id?: string | null
          apporteur_label?: string | null
          referent?: string | null
          support_id?: string | null
          has_apporteur_ext?: boolean
          apporteur_ext_nom?: string | null
          taux_apporteur_ext?: number | null
          co_titulaire_id?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          id: string
          dossier_id: string
          taux_commission: number
          commission_brute: number
          rem_apporteur: number | null
          rem_apporteur_ext: number | null
          rem_support: number | null
          part_cabinet: number | null
          pct_cabinet: number | null
          calculated_at: string
          taux_gestion: number | null
        }
        Insert: {
          id?: string
          dossier_id: string
          taux_commission?: number
          commission_brute?: number
          rem_apporteur?: number | null
          rem_apporteur_ext?: number | null
          rem_support?: number | null
          part_cabinet?: number | null
          pct_cabinet?: number | null
          taux_gestion?: number | null
        }
        Update: {
          taux_commission?: number
          commission_brute?: number
          rem_apporteur?: number | null
          rem_apporteur_ext?: number | null
          rem_support?: number | null
          part_cabinet?: number | null
          pct_cabinet?: number | null
          taux_gestion?: number | null
        }
        Relationships: []
      }
      factures: {
        Row: {
          id: string
          dossier_id: string
          facturee: boolean
          payee: PaiementType
          date_facture: string | null
          date_paiement: string | null
          created_at: string
        }
        Insert: {
          id?: string
          dossier_id: string
          facturee?: boolean
          payee?: PaiementType
          date_facture?: string | null
          date_paiement?: string | null
        }
        Update: {
          facturee?: boolean
          payee?: PaiementType
          date_facture?: string | null
          date_paiement?: string | null
        }
        Relationships: []
      }
      challenges: {
        Row: {
          id: string
          consultant_id: string
          annee: number
          objectif: number
          collecte: number
        }
        Insert: {
          id?: string
          consultant_id: string
          annee?: number
          objectif: number
          collecte?: number
        }
        Update: {
          annee?: number
          objectif?: number
          collecte?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          table_name: string
          record_id: string
          action: string
          old_data: Record<string, unknown> | null
          new_data: Record<string, unknown> | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          table_name: string
          record_id: string
          action: string
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          user_id?: string | null
        }
        Update: {
          table_name?: string
          record_id?: string
          action?: string
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_commentaires: {
        Row: {
          id: string
          client_id: string
          auteur_id: string | null
          auteur_nom: string
          type_etiquette: string
          contenu: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          auteur_id?: string | null
          auteur_nom: string
          type_etiquette: string
          contenu: string
        }
        Update: {
          client_id?: string
          auteur_id?: string | null
          auteur_nom?: string
          type_etiquette?: string
          contenu?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_pj: {
        Row: {
          id: string
          client_id: string
          nom_fichier: string
          storage_path: string
          taille_octets: number
          type_mime: string | null
          type_document: string
          date_document: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          nom_fichier: string
          storage_path: string
          taille_octets: number
          type_mime?: string | null
          type_document: string
          date_document?: string | null
          uploaded_by?: string | null
        }
        Update: {
          nom_fichier?: string
          storage_path?: string
          taille_octets?: number
          type_mime?: string | null
          type_document?: string
          date_document?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      rendez_vous: {
        Row: {
          id: string
          client_id: string
          date_rdv: string
          type: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          date_rdv: string
          type: string
          notes?: string | null
        }
        Update: {
          client_id?: string
          date_rdv?: string
          type?: string
          notes?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          user_nom: string | null
          action: string
          table_name: string
          record_id: string | null
          details: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          user_nom?: string | null
          action: string
          table_name: string
          record_id?: string | null
          details?: Record<string, unknown> | null
        }
        Update: {
          user_id?: string | null
          user_nom?: string | null
          action?: string
          table_name?: string
          record_id?: string | null
          details?: Record<string, unknown> | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          id: string
          produit_categorie: string
          document_nom: string
          obligatoire: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          produit_categorie: string
          document_nom: string
          obligatoire?: boolean
          sort_order?: number
        }
        Update: {
          produit_categorie?: string
          document_nom?: string
          obligatoire?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      dossier_documents: {
        Row: {
          id: string
          dossier_id: string
          document_nom: string
          recu: boolean
          date_reception: string | null
          commentaire: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dossier_id: string
          document_nom: string
          recu?: boolean
          date_reception?: string | null
          commentaire?: string | null
        }
        Update: {
          document_nom?: string
          recu?: boolean
          date_reception?: string | null
          commentaire?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_relations: {
        Row: {
          id: string
          client_id_1: string
          client_id_2: string
          type_relation: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id_1: string
          client_id_2: string
          type_relation: string
        }
        Update: {
          client_id_1?: string
          client_id_2?: string
          type_relation?: string
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          id: string
          consultant_id: string
          access_token: string
          refresh_token: string | null
          expires_at: string
          google_email: string | null
          scopes: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          consultant_id: string
          access_token: string
          refresh_token?: string | null
          expires_at: string
          google_email?: string | null
          scopes?: string | null
        }
        Update: {
          access_token?: string
          refresh_token?: string | null
          expires_at?: string
          google_email?: string | null
          scopes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relances: {
        Row: {
          id: string
          client_id: string
          dossier_id: string | null
          type: string
          description: string
          date_echeance: string
          rappel_date: string | null
          statut: 'a_faire' | 'fait' | 'ignore' | 'reporte'
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          dossier_id?: string | null
          type: string
          description: string
          date_echeance: string
          rappel_date?: string | null
          statut?: 'a_faire' | 'fait' | 'ignore' | 'reporte'
        }
        Update: {
          client_id?: string
          dossier_id?: string | null
          type?: string
          description?: string
          date_echeance?: string
          rappel_date?: string | null
          statut?: 'a_faire' | 'fait' | 'ignore' | 'reporte'
        }
        Relationships: []
      }
      faq: {
        Row: {
          id: string
          categorie: string
          sous_categorie: string
          question: string
          reponse: string
          ordre: number
          created_at: string
        }
        Insert: {
          id?: string
          categorie: string
          sous_categorie: string
          question: string
          reponse: string
          ordre?: number
        }
        Update: {
          categorie?: string
          sous_categorie?: string
          question?: string
          reponse?: string
          ordre?: number
        }
        Relationships: []
      }
      encaissements_rem: {
        Row: {
          id: string
          dossier_id: string
          montant: number
          date_encaissement: string
          type_encaissement: string
          created_at: string
        }
        Insert: {
          id?: string
          dossier_id: string
          montant: number
          date_encaissement: string
          type_encaissement: string
        }
        Update: {
          montant?: number
          date_encaissement?: string
          type_encaissement?: string
        }
        Relationships: []
      }
      grilles_commissionnement: {
        Row: {
          id: string
          taux_remuneration: number
          ca_min: number
          ca_max: number | null
          label: string | null
        }
        Insert: {
          id?: string
          taux_remuneration: number
          ca_min: number
          ca_max?: number | null
          label?: string | null
        }
        Update: {
          taux_remuneration?: number
          ca_min?: number
          ca_max?: number | null
          label?: string | null
        }
        Relationships: []
      }
      visibility_settings: {
        Row: {
          id: string
          consultant_id: string
          key: string
          value: boolean
          created_at: string
        }
        Insert: {
          id?: string
          consultant_id: string
          key: string
          value: boolean
        }
        Update: {
          key?: string
          value?: boolean
        }
        Relationships: []
      }
      facturation_consultant: {
        Row: {
          id: string
          consultant_id: string
          date_facture: string
          montant_ht: number
          taux_tva: number
          created_at: string
        }
        Insert: {
          id?: string
          consultant_id: string
          date_facture: string
          montant_ht: number
          taux_tva?: number
        }
        Update: {
          date_facture?: string
          montant_ht?: number
          taux_tva?: number
        }
        Relationships: []
      }
      manager_cagnotte: {
        Row: {
          id: string
          manager_id: string
          montant: number
          date_creation: string
          created_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          montant: number
          date_creation: string
        }
        Update: {
          montant?: number
        }
        Relationships: []
      }
    }
    Views: {
      v_dossiers_complets: {
        Row: {
          id: string | null
          client_id: string | null
          statut: StatutDossierType | null
          montant: number | null
          financement: FinancementType | null
          commentaire: string | null
          date_operation: string | null
          date_entree_en_relation: string | null
          date_signature: string | null
          mode_detention: ModeDetentionType | null
          apporteur_label: string | null
          referent: string | null
          has_apporteur_ext: boolean | null
          apporteur_ext_nom: string | null
          taux_apporteur_ext: number | null
          client_nom: string | null
          client_prenom: string | null
          client_pays: string | null
          client_ville: string | null
          client_email: string | null
          client_telephone: string | null
          statut_kyc: StatutKycType | null
          der: boolean | null
          pi: boolean | null
          preco: boolean | null
          lm: boolean | null
          rm: boolean | null
          co_titulaire_id: string | null
          co_titulaire_nom: string | null
          co_titulaire_prenom: string | null
          consultant_id: string | null
          consultant_nom: string | null
          consultant_prenom: string | null
          consultant_zone: string | null
          taux_remuneration: number | null
          produit_nom: string | null
          produit_categorie: string | null
          compagnie_nom: string | null
          taux_commission: number | null
          taux_gestion: number | null
          commission_brute: number | null
          rem_apporteur: number | null
          rem_apporteur_ext: number | null
          rem_support: number | null
          part_cabinet: number | null
          pct_cabinet: number | null
          facturee: boolean | null
          payee: PaiementType | null
          date_facture: string | null
        }
        Relationships: []
      }
      v_collecte_par_consultant: {
        Row: {
          consultant: string | null
          produit: string | null
          financement: FinancementType | null
          total_montant: number | null
          nb_dossiers: number | null
          total_commissions: number | null
        }
        Relationships: []
      }
      v_pipeline_par_consultant: {
        Row: {
          consultant: string | null
          produit: string | null
          financement: FinancementType | null
          total_montant: number | null
          nb_dossiers: number | null
        }
        Relationships: []
      }
      v_dossiers_remunerations: {
        Row: {
          id: string | null
          client_id: string | null
          statut: StatutDossierType | null
          montant: number | null
          financement: FinancementType | null
          commentaire: string | null
          date_operation: string | null
          date_entree_en_relation: string | null
          date_signature: string | null
          mode_detention: ModeDetentionType | null
          apporteur_label: string | null
          referent: string | null
          has_apporteur_ext: boolean | null
          apporteur_ext_nom: string | null
          taux_apporteur_ext: number | null
          client_nom: string | null
          client_prenom: string | null
          client_pays: string | null
          client_ville: string | null
          client_email: string | null
          client_telephone: string | null
          statut_kyc: StatutKycType | null
          der: boolean | null
          pi: boolean | null
          preco: boolean | null
          lm: boolean | null
          rm: boolean | null
          consultant_nom: string | null
          consultant_prenom: string | null
          consultant_zone: string | null
          taux_remuneration: number | null
          produit_nom: string | null
          produit_categorie: string | null
          compagnie_nom: string | null
          taux_commission: number | null
          taux_gestion: number | null
          commission_brute: number | null
          rem_apporteur: number | null
          rem_apporteur_ext: number | null
          rem_support: number | null
          part_cabinet: number | null
          pct_cabinet: number | null
          facturee: boolean | null
          payee: PaiementType | null
          date_facture: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_current_consultant_id: {
        Args: Record<string, never>
        Returns: string
      }
      get_current_role: {
        Args: Record<string, never>
        Returns: RoleType
      }
      is_manager: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_back_office: {
        Args: Record<string, never>
        Returns: boolean
      }
      calculate_commission: {
        Args: {
          p_dossier_id: string
        }
        Returns: void
      }
      get_frais_taux: {
        Args: {
          p_type: TypeFraisType
          p_encours: number
        }
        Returns: number
      }
      upsert_google_token: {
        Args: {
          p_consultant_id: string
          p_access_token: string
          p_refresh_token?: string | null
          p_expires_at: string
          p_google_email?: string | null
          p_scopes?: string | null
        }
        Returns: void
      }
    }
    Enums: {
      role_type: RoleType
      statut_kyc_type: StatutKycType
      financement_type: FinancementType
      statut_dossier_type: StatutDossierType
      paiement_type: PaiementType
      type_frais: TypeFraisType
      mode_detention_type: ModeDetentionType
    }
  }
}

// Enum Types
export type RoleType = 'manager' | 'consultant' | 'back_office'
export type StatutKycType = 'non' | 'en_cours' | 'oui'
export type FinancementType = 'cash' | 'credit' | 'lombard' | 'remploi'
export type StatutDossierType = 'prospect' | 'client_en_cours' | 'client_finalise' | 'non_abouti'
export type ModeDetentionType = 'PP' | 'NP' | 'US'
export type PaiementType = 'non' | 'en_cours' | 'oui'
export type TypeFraisType = 'entree' | 'gestion'

// Table-specific types for convenience
export type Consultant = Database['public']['Tables']['consultants']['Row']
export type ConsultantInsert = Database['public']['Tables']['consultants']['Insert']
export type ConsultantUpdate = Database['public']['Tables']['consultants']['Update']

export type Client = Database['public']['Tables']['clients']['Row']
export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']

export type Produit = Database['public']['Tables']['produits']['Row']
export type ProduitInsert = Database['public']['Tables']['produits']['Insert']
export type ProduitUpdate = Database['public']['Tables']['produits']['Update']

export type Compagnie = Database['public']['Tables']['compagnies']['Row']
export type CompagnieInsert = Database['public']['Tables']['compagnies']['Insert']
export type CompagnieUpdate = Database['public']['Tables']['compagnies']['Update']

export type TauxProduitCompagnie = Database['public']['Tables']['taux_produit_compagnie']['Row']
export type TauxProduitCompagnieInsert = Database['public']['Tables']['taux_produit_compagnie']['Insert']
export type TauxProduitCompagnieUpdate = Database['public']['Tables']['taux_produit_compagnie']['Update']

export type GrillesFrais = Database['public']['Tables']['grilles_frais']['Row']
export type GrillesFraisInsert = Database['public']['Tables']['grilles_frais']['Insert']
export type GrillesFraisUpdate = Database['public']['Tables']['grilles_frais']['Update']

export type Dossier = Database['public']['Tables']['dossiers']['Row']
export type DossierInsert = Database['public']['Tables']['dossiers']['Insert']
export type DossierUpdate = Database['public']['Tables']['dossiers']['Update']

export type Commission = Database['public']['Tables']['commissions']['Row']
export type CommissionInsert = Database['public']['Tables']['commissions']['Insert']
export type CommissionUpdate = Database['public']['Tables']['commissions']['Update']

export type Facture = Database['public']['Tables']['factures']['Row']
export type FactureInsert = Database['public']['Tables']['factures']['Insert']
export type FactureUpdate = Database['public']['Tables']['factures']['Update']

export type Challenge = Database['public']['Tables']['challenges']['Row']
export type ChallengeInsert = Database['public']['Tables']['challenges']['Insert']
export type ChallengeUpdate = Database['public']['Tables']['challenges']['Update']

export type AuditLog = Database['public']['Tables']['audit_log']['Row']
export type AuditLogInsert = Database['public']['Tables']['audit_log']['Insert']
export type AuditLogUpdate = Database['public']['Tables']['audit_log']['Update']

export type ClientCommentaire = Database['public']['Tables']['client_commentaires']['Row']
export type ClientCommentaireInsert = Database['public']['Tables']['client_commentaires']['Insert']
export type ClientPj = Database['public']['Tables']['client_pj']['Row']
export type ClientPjInsert = Database['public']['Tables']['client_pj']['Insert']
export type RendezVous = Database['public']['Tables']['rendez_vous']['Row']
export type RendezVousInsert = Database['public']['Tables']['rendez_vous']['Insert']
export type AuditLogs = Database['public']['Tables']['audit_logs']['Row']
export type AuditLogsInsert = Database['public']['Tables']['audit_logs']['Insert']
export type DossierDocument = Database['public']['Tables']['dossier_documents']['Row']
export type DossierDocumentInsert = Database['public']['Tables']['dossier_documents']['Insert']
export type DocumentTemplate = Database['public']['Tables']['document_templates']['Row']
export type ClientRelation = Database['public']['Tables']['client_relations']['Row']
export type GoogleToken = Database['public']['Tables']['google_tokens']['Row']
export type Relance = Database['public']['Tables']['relances']['Row']
export type RelanceInsert = Database['public']['Tables']['relances']['Insert']
export type RelanceUpdate = Database['public']['Tables']['relances']['Update']
export type Faq = Database['public']['Tables']['faq']['Row']
export type FaqInsert = Database['public']['Tables']['faq']['Insert']
export type EncaissementsRem = Database['public']['Tables']['encaissements_rem']['Row']
export type GrillesCommissionnement = Database['public']['Tables']['grilles_commissionnement']['Row']
export type VisibilitySettings = Database['public']['Tables']['visibility_settings']['Row']
export type FacturationConsultant = Database['public']['Tables']['facturation_consultant']['Row']
export type ManagerCagnotte = Database['public']['Tables']['manager_cagnotte']['Row']

// View types
export type VDossiersComplets = Database['public']['Views']['v_dossiers_complets']['Row']
export type VCollecteParConsultant = Database['public']['Views']['v_collecte_par_consultant']['Row']
export type VPipelineParConsultant = Database['public']['Views']['v_pipeline_par_consultant']['Row']
export type VDossiersRemunerations = Database['public']['Views']['v_dossiers_remunerations']['Row']
