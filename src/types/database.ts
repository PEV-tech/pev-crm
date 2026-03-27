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
      }
      clients: {
        Row: {
          id: string
          nom: string
          prenom: string | null
          pays: string
          statut_kyc: StatutKycType
          der: boolean
          pi: boolean
          lm: boolean
          rm: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nom: string
          prenom?: string | null
          pays: string
          statut_kyc?: StatutKycType
          der?: boolean
          pi?: boolean
          lm?: boolean
          rm?: boolean
        }
        Update: {
          nom?: string
          prenom?: string | null
          pays?: string
          statut_kyc?: StatutKycType
          der?: boolean
          pi?: boolean
          lm?: boolean
          rm?: boolean
        }
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
          apporteur_id: string | null
          apporteur_label: string | null
          referent: string | null
          support_id: string | null
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
          apporteur_id?: string | null
          apporteur_label?: string | null
          referent?: string | null
          support_id?: string | null
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
          apporteur_id?: string | null
          apporteur_label?: string | null
          referent?: string | null
          support_id?: string | null
        }
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
        }
        Update: {
          taux_commission?: number
          commission_brute?: number
          rem_apporteur?: number | null
          rem_apporteur_ext?: number | null
          rem_support?: number | null
          part_cabinet?: number | null
          pct_cabinet?: number | null
        }
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
      }
    }
    Views: {
      v_dossiers_complets: {
        Row: {
          id: string | null
          statut: StatutDossierType | null
          montant: number | null
          financement: FinancementType | null
          commentaire: string | null
          date_operation: string | null
          apporteur_label: string | null
          referent: string | null
          client_nom: string | null
          client_prenom: string | null
          client_pays: string | null
          statut_kyc: StatutKycType | null
          der: boolean | null
          pi: boolean | null
          lm: boolean | null
          rm: boolean | null
          consultant_nom: string | null
          consultant_prenom: string | null
          consultant_zone: string | null
          produit_nom: string | null
          produit_categorie: string | null
          compagnie_nom: string | null
          taux_commission: number | null
          commission_brute: number | null
          rem_apporteur: number | null
          rem_support: number | null
          part_cabinet: number | null
          pct_cabinet: number | null
          facturee: boolean | null
          payee: PaiementType | null
          date_facture: string | null
        }
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
      }
      v_pipeline_par_consultant: {
        Row: {
          consultant: string | null
          produit: string | null
          financement: FinancementType | null
          total_montant: number | null
          nb_dossiers: number | null
        }
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
    }
    Enums: {
      role_type: RoleType
      statut_kyc_type: StatutKycType
      financement_type: FinancementType
      statut_dossier_type: StatutDossierType
      paiement_type: PaiementType
      type_frais: TypeFraisType
    }
  }
}

// Enum Types
export type RoleType = 'manager' | 'consultant' | 'back_office'
export type StatutKycType = 'non' | 'en_cours' | 'oui'
export type FinancementType = 'cash' | 'credit' | 'lombard' | 'remploi'
export type StatutDossierType = 'prospect' | 'client_en_cours' | 'client_finalise'
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

// View types
export type VDossiersComplets = Database['public']['Views']['v_dossiers_complets']['Row']
export type VCollecteParConsultant = Database['public']['Views']['v_collecte_par_consultant']['Row']
export type VPipelineParConsultant = Database['public']['Views']['v_pipeline_par_consultant']['Row']
