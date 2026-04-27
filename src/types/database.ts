export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_errors: {
        Row: {
          extra: Json
          id: string
          message: string
          occurred_at: string
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          source: string
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          extra?: Json
          id?: string
          message: string
          occurred_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          source: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          extra?: Json
          id?: string
          message?: string
          occurred_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          source?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      apporteurs: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          nom: string
          prenom: string
          taux_commission: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          nom: string
          prenom: string
          taux_commission?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          nom?: string
          prenom?: string
          taux_commission?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apporteurs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apporteurs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
        ]
      }
      apporteur_compensation_rules: {
        Row: {
          active: boolean
          apporteur_id: string
          created_at: string
          encours_months: number | null
          id: string
          product_category: string
          rate_pct: number | null
          rule_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          apporteur_id: string
          created_at?: string
          encours_months?: number | null
          id?: string
          product_category: string
          rate_pct?: number | null
          rule_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          apporteur_id?: string
          created_at?: string
          encours_months?: number | null
          id?: string
          product_category?: string
          rate_pct?: number | null
          rule_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apporteur_compensation_rules_apporteur_id_fkey"
            columns: ["apporteur_id"]
            isOneToOne: false
            referencedRelation: "apporteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apporteur_compensation_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          record_id: string | null
          table_name: string
          user_id: string | null
          user_nom: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
          user_nom?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
          user_nom?: string | null
        }
        Relationships: []
      }
      challenges: {
        Row: {
          annee: number
          collecte: number
          consultant_id: string
          id: string
          objectif: number
        }
        Insert: {
          annee?: number
          collecte?: number
          consultant_id: string
          id?: string
          objectif?: number
        }
        Update: {
          annee?: number
          collecte?: number
          consultant_id?: string
          id?: string
          objectif?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenges_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
        ]
      }
      client_commentaires: {
        Row: {
          auteur_id: string | null
          auteur_nom: string
          client_id: string
          contenu: string
          created_at: string | null
          id: string
          type_etiquette: string
          updated_at: string | null
        }
        Insert: {
          auteur_id?: string | null
          auteur_nom: string
          client_id: string
          contenu: string
          created_at?: string | null
          id?: string
          type_etiquette?: string
          updated_at?: string | null
        }
        Update: {
          auteur_id?: string | null
          auteur_nom?: string
          client_id?: string
          contenu?: string
          created_at?: string | null
          id?: string
          type_etiquette?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_commentaires_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_commentaires_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
          {
            foreignKeyName: "client_commentaires_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_commentaires_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_commentaires_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_commentaires_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_pj: {
        Row: {
          client_id: string
          created_at: string | null
          date_document: string | null
          id: string
          nom_fichier: string
          storage_path: string
          taille_octets: number | null
          type_document: string | null
          type_mime: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          date_document?: string | null
          id?: string
          nom_fichier: string
          storage_path: string
          taille_octets?: number | null
          type_document?: string | null
          type_mime?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          date_document?: string | null
          id?: string
          nom_fichier?: string
          storage_path?: string
          taille_octets?: number | null
          type_document?: string | null
          type_mime?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_pj_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pj_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pj_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_pj_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_pj_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pj_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
        ]
      }
      client_relations: {
        Row: {
          client_id_1: string
          client_id_2: string
          created_at: string | null
          id: string
          type_relation: string
        }
        Insert: {
          client_id_1: string
          client_id_2: string
          created_at?: string | null
          id?: string
          type_relation: string
        }
        Update: {
          client_id_1?: string
          client_id_2?: string
          created_at?: string | null
          id?: string
          type_relation?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_relations_client_id_1_fkey"
            columns: ["client_id_1"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_relations_client_id_1_fkey"
            columns: ["client_id_1"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_relations_client_id_1_fkey"
            columns: ["client_id_1"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_relations_client_id_1_fkey"
            columns: ["client_id_1"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_relations_client_id_2_fkey"
            columns: ["client_id_2"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_relations_client_id_2_fkey"
            columns: ["client_id_2"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_relations_client_id_2_fkey"
            columns: ["client_id_2"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_relations_client_id_2_fkey"
            columns: ["client_id_2"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
        ]
      }
      clients: {
        Row: {
          adresse: string | null
          autres_revenus: number | null
          capital_social: number | null
          charges_residence_principale: number | null
          a_donation_entre_epoux: boolean | null
          a_testament: boolean | null
          code_postal: string | null
          commentaires: string | null
          commentaires_kyc: Json | null
          conformite: string | null
          consultant_id: string | null
          created_at: string | null
          date_creation: string | null
          date_debut_emploi: string | null
          date_entree_relation: string | null
          date_naissance: string | null
          der: boolean | null
          donation_entre_epoux_details: string | null
          donations_recues: Json | null
          email: string | null
          employeur: string | null
          emprunts: Json | null
          enfants_details: Json | null
          forme_juridique: string | null
          google_drive_url: string | null
          id: string
          impot_revenu_n: number | null
          impot_revenu_n1: number | null
          impot_revenu_n2: number | null
          kyc_completion_rate: number | null
          kyc_consent_accuracy: boolean | null
          kyc_consent_incomplete: boolean | null
          kyc_date_signature: string | null
          kyc_incomplete_signed: boolean | null
          kyc_last_relance_at: string | null
          kyc_missing_fields: Json | null
          kyc_opened_at: string | null
          kyc_pdf_generated_at: string | null
          kyc_pdf_storage_path: string | null
          kyc_relances_count: number
          kyc_sent_at: string | null
          kyc_signed_at: string | null
          kyc_signer_ip: string | null
          kyc_signer_name: string | null
          kyc_token: string | null
          kyc_token_created_at: string | null
          kyc_uploaded_at: string | null
          lieu_naissance: string | null
          lm: boolean | null
          loi_applicable_details: string | null
          loi_applicable_pays: string | null
          montant_loyer: number | null
          nationalite: string | null
          nif: string | null
          nom: string
          nom_jeune_fille: string | null
          nombre_enfants: number | null
          numero_compte: string | null
          objectifs_client: string | null
          patrimoine_divers: Json | null
          patrimoine_immobilier: Json | null
          patrimoine_professionnel: Json | null
          pays: string
          pi: boolean | null
          preco: boolean | null
          prenom: string | null
          produits_financiers: Json | null
          profession: string | null
          proprietaire_locataire: string | null
          raison_sociale: string | null
          regime_matrimonial: string | null
          representant_legal_id: string | null
          residence_fiscale: string | null
          revenus_fonciers: number | null
          revenus_pro_net: number | null
          rm: boolean | null
          siren: string | null
          siret: string | null
          situation_matrimoniale: string | null
          statut_client: string | null
          statut_kyc: Database["public"]["Enums"]["statut_kyc_type"] | null
          statut_professionnel: string | null
          telephone: string | null
          testament_details: string | null
          titre: string | null
          total_revenus_annuel: number | null
          type_personne: string
          union_precedente: boolean | null
          union_precedente_details: string | null
          updated_at: string | null
          ville: string | null
        }
        Insert: {
          a_donation_entre_epoux?: boolean | null
          a_testament?: boolean | null
          adresse?: string | null
          autres_revenus?: number | null
          capital_social?: number | null
          charges_residence_principale?: number | null
          code_postal?: string | null
          commentaires?: string | null
          commentaires_kyc?: Json | null
          conformite?: string | null
          consultant_id?: string | null
          created_at?: string | null
          date_creation?: string | null
          date_debut_emploi?: string | null
          date_entree_relation?: string | null
          date_naissance?: string | null
          der?: boolean | null
          donation_entre_epoux_details?: string | null
          donations_recues?: Json | null
          email?: string | null
          employeur?: string | null
          emprunts?: Json | null
          enfants_details?: Json | null
          forme_juridique?: string | null
          google_drive_url?: string | null
          id?: string
          impot_revenu_n?: number | null
          impot_revenu_n1?: number | null
          impot_revenu_n2?: number | null
          kyc_completion_rate?: number | null
          kyc_consent_accuracy?: boolean | null
          kyc_consent_incomplete?: boolean | null
          kyc_date_signature?: string | null
          kyc_incomplete_signed?: boolean | null
          kyc_last_relance_at?: string | null
          kyc_missing_fields?: Json | null
          kyc_opened_at?: string | null
          kyc_pdf_generated_at?: string | null
          kyc_pdf_storage_path?: string | null
          kyc_relances_count?: number
          kyc_sent_at?: string | null
          kyc_signed_at?: string | null
          kyc_signer_ip?: string | null
          kyc_signer_name?: string | null
          kyc_token?: string | null
          kyc_token_created_at?: string | null
          kyc_uploaded_at?: string | null
          lieu_naissance?: string | null
          lm?: boolean | null
          loi_applicable_details?: string | null
          loi_applicable_pays?: string | null
          montant_loyer?: number | null
          nationalite?: string | null
          nif?: string | null
          nom: string
          nom_jeune_fille?: string | null
          nombre_enfants?: number | null
          numero_compte?: string | null
          objectifs_client?: string | null
          patrimoine_divers?: Json | null
          patrimoine_immobilier?: Json | null
          patrimoine_professionnel?: Json | null
          pays: string
          pi?: boolean | null
          preco?: boolean | null
          prenom?: string | null
          produits_financiers?: Json | null
          profession?: string | null
          proprietaire_locataire?: string | null
          raison_sociale?: string | null
          regime_matrimonial?: string | null
          representant_legal_id?: string | null
          residence_fiscale?: string | null
          revenus_fonciers?: number | null
          revenus_pro_net?: number | null
          rm?: boolean | null
          siren?: string | null
          siret?: string | null
          situation_matrimoniale?: string | null
          statut_client?: string | null
          statut_kyc?: Database["public"]["Enums"]["statut_kyc_type"] | null
          statut_professionnel?: string | null
          telephone?: string | null
          testament_details?: string | null
          titre?: string | null
          total_revenus_annuel?: number | null
          type_personne?: string
          union_precedente?: boolean | null
          union_precedente_details?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Update: {
          a_donation_entre_epoux?: boolean | null
          a_testament?: boolean | null
          adresse?: string | null
          autres_revenus?: number | null
          capital_social?: number | null
          charges_residence_principale?: number | null
          code_postal?: string | null
          commentaires?: string | null
          commentaires_kyc?: Json | null
          conformite?: string | null
          consultant_id?: string | null
          created_at?: string | null
          date_creation?: string | null
          date_debut_emploi?: string | null
          date_entree_relation?: string | null
          date_naissance?: string | null
          der?: boolean | null
          donation_entre_epoux_details?: string | null
          donations_recues?: Json | null
          email?: string | null
          employeur?: string | null
          emprunts?: Json | null
          enfants_details?: Json | null
          forme_juridique?: string | null
          google_drive_url?: string | null
          id?: string
          impot_revenu_n?: number | null
          impot_revenu_n1?: number | null
          impot_revenu_n2?: number | null
          kyc_completion_rate?: number | null
          kyc_consent_accuracy?: boolean | null
          kyc_consent_incomplete?: boolean | null
          kyc_date_signature?: string | null
          kyc_incomplete_signed?: boolean | null
          kyc_last_relance_at?: string | null
          kyc_missing_fields?: Json | null
          kyc_opened_at?: string | null
          kyc_pdf_generated_at?: string | null
          kyc_pdf_storage_path?: string | null
          kyc_relances_count?: number
          kyc_sent_at?: string | null
          kyc_signed_at?: string | null
          kyc_signer_ip?: string | null
          kyc_signer_name?: string | null
          kyc_token?: string | null
          kyc_token_created_at?: string | null
          kyc_uploaded_at?: string | null
          lieu_naissance?: string | null
          lm?: boolean | null
          loi_applicable_details?: string | null
          loi_applicable_pays?: string | null
          montant_loyer?: number | null
          nationalite?: string | null
          nif?: string | null
          nom?: string
          nom_jeune_fille?: string | null
          nombre_enfants?: number | null
          numero_compte?: string | null
          objectifs_client?: string | null
          patrimoine_divers?: Json | null
          patrimoine_immobilier?: Json | null
          patrimoine_professionnel?: Json | null
          pays?: string
          pi?: boolean | null
          preco?: boolean | null
          prenom?: string | null
          produits_financiers?: Json | null
          profession?: string | null
          proprietaire_locataire?: string | null
          raison_sociale?: string | null
          regime_matrimonial?: string | null
          representant_legal_id?: string | null
          residence_fiscale?: string | null
          revenus_fonciers?: number | null
          revenus_pro_net?: number | null
          rm?: boolean | null
          siren?: string | null
          siret?: string | null
          situation_matrimoniale?: string | null
          statut_client?: string | null
          statut_kyc?: Database["public"]["Enums"]["statut_kyc_type"] | null
          statut_professionnel?: string | null
          telephone?: string | null
          testament_details?: string | null
          titre?: string | null
          total_revenus_annuel?: number | null
          type_personne?: string
          union_precedente?: boolean | null
          union_precedente_details?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
          {
            foreignKeyName: "clients_representant_legal_id_fkey"
            columns: ["representant_legal_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_representant_legal_id_fkey"
            columns: ["representant_legal_id"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_representant_legal_id_fkey"
            columns: ["representant_legal_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "clients_representant_legal_id_fkey"
            columns: ["representant_legal_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
        ]
      }
      commissions: {
        Row: {
          calculated_at: string | null
          commission_brute: number
          dossier_id: string
          id: string
          part_cabinet: number | null
          pct_cabinet: number | null
          rem_apporteur: number | null
          rem_apporteur_encours_oneshot: number | null
          rem_apporteur_entry: number | null
          rem_apporteur_ext: number | null
          rem_support: number | null
          taux_commission: number | null
          taux_gestion: number | null
        }
        Insert: {
          calculated_at?: string | null
          commission_brute?: number
          dossier_id: string
          id?: string
          part_cabinet?: number | null
          pct_cabinet?: number | null
          rem_apporteur?: number | null
          rem_apporteur_encours_oneshot?: number | null
          rem_apporteur_entry?: number | null
          rem_apporteur_ext?: number | null
          rem_support?: number | null
          taux_commission?: number | null
          taux_gestion?: number | null
        }
        Update: {
          calculated_at?: string | null
          commission_brute?: number
          dossier_id?: string
          id?: string
          part_cabinet?: number | null
          pct_cabinet?: number | null
          rem_apporteur?: number | null
          rem_apporteur_encours_oneshot?: number | null
          rem_apporteur_entry?: number | null
          rem_apporteur_ext?: number | null
          rem_support?: number | null
          taux_commission?: number | null
          taux_gestion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["id"]
          },
        ]
      }
      compagnies: {
        Row: {
          created_at: string | null
          encours_periodicite: string | null
          id: string
          nom: string
          taux_defaut: number | null
          taux_encours: number | null
        }
        Insert: {
          created_at?: string | null
          encours_periodicite?: string | null
          id?: string
          nom: string
          taux_defaut?: number | null
          taux_encours?: number | null
        }
        Update: {
          created_at?: string | null
          encours_periodicite?: string | null
          id?: string
          nom?: string
          taux_defaut?: number | null
          taux_encours?: number | null
        }
        Relationships: []
      }
      consultant_email_templates: {
        Row: {
          body: string
          consultant_id: string
          created_at: string
          enabled: boolean
          id: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body: string
          consultant_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          body?: string
          consultant_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_email_templates_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_email_templates_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
        ]
      }
      consultants: {
        Row: {
          actif: boolean | null
          auth_user_id: string | null
          created_at: string | null
          id: string
          is_pool_member: boolean | null
          nom: string
          prenom: string
          role: Database["public"]["Enums"]["role_type"]
          taux_remuneration: number
          updated_at: string | null
          zone: string | null
        }
        Insert: {
          actif?: boolean | null
          auth_user_id?: string | null
          created_at?: string | null
          id?: string
          is_pool_member?: boolean | null
          nom: string
          prenom: string
          role?: Database["public"]["Enums"]["role_type"]
          taux_remuneration?: number
          updated_at?: string | null
          zone?: string | null
        }
        Update: {
          actif?: boolean | null
          auth_user_id?: string | null
          created_at?: string | null
          id?: string
          is_pool_member?: boolean | null
          nom?: string
          prenom?: string
          role?: Database["public"]["Enums"]["role_type"]
          taux_remuneration?: number
          updated_at?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          document_nom: string
          id: string
          obligatoire: boolean | null
          produit_categorie: string
          sort_order: number | null
        }
        Insert: {
          document_nom: string
          id?: string
          obligatoire?: boolean | null
          produit_categorie: string
          sort_order?: number | null
        }
        Update: {
          document_nom?: string
          id?: string
          obligatoire?: boolean | null
          produit_categorie?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      dossier_documents: {
        Row: {
          commentaire: string | null
          created_at: string | null
          date_reception: string | null
          document_nom: string
          dossier_id: string
          id: string
          recu: boolean | null
          updated_at: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          date_reception?: string | null
          document_nom: string
          dossier_id: string
          id?: string
          recu?: boolean | null
          updated_at?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          date_reception?: string | null
          document_nom?: string
          dossier_id?: string
          id?: string
          recu?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dossier_documents_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossier_documents_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossier_documents_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          apporteur_ext_nom: string | null
          apporteur_id: string | null
          apporteur_label: string | null
          client_id: string
          co_titulaire_id: string | null
          commentaire: string | null
          compagnie_id: string | null
          consultant_id: string
          created_at: string | null
          date_entree_en_relation: string | null
          date_operation: string
          date_signature: string | null
          financement: Database["public"]["Enums"]["financement_type"] | null
          has_apporteur_ext: boolean | null
          id: string
          mode_detention:
            | Database["public"]["Enums"]["mode_detention_type"]
            | null
          montant: number | null
          produit_id: string | null
          referent: string | null
          statut: Database["public"]["Enums"]["statut_dossier_type"]
          support_id: string | null
          taux_apporteur_ext: number | null
          taux_produit_compagnie_id: string | null
          updated_at: string | null
        }
        Insert: {
          apporteur_ext_nom?: string | null
          apporteur_id?: string | null
          apporteur_label?: string | null
          client_id: string
          co_titulaire_id?: string | null
          commentaire?: string | null
          compagnie_id?: string | null
          consultant_id: string
          created_at?: string | null
          date_entree_en_relation?: string | null
          date_operation?: string
          date_signature?: string | null
          financement?: Database["public"]["Enums"]["financement_type"] | null
          has_apporteur_ext?: boolean | null
          id?: string
          mode_detention?:
            | Database["public"]["Enums"]["mode_detention_type"]
            | null
          montant?: number | null
          produit_id?: string | null
          referent?: string | null
          statut?: Database["public"]["Enums"]["statut_dossier_type"]
          support_id?: string | null
          taux_apporteur_ext?: number | null
          taux_produit_compagnie_id?: string | null
          updated_at?: string | null
        }
        Update: {
          apporteur_ext_nom?: string | null
          apporteur_id?: string | null
          apporteur_label?: string | null
          client_id?: string
          co_titulaire_id?: string | null
          commentaire?: string | null
          compagnie_id?: string | null
          consultant_id?: string
          created_at?: string | null
          date_entree_en_relation?: string | null
          date_operation?: string
          date_signature?: string | null
          financement?: Database["public"]["Enums"]["financement_type"] | null
          has_apporteur_ext?: boolean | null
          id?: string
          mode_detention?:
            | Database["public"]["Enums"]["mode_detention_type"]
            | null
          montant?: number | null
          produit_id?: string | null
          referent?: string | null
          statut?: Database["public"]["Enums"]["statut_dossier_type"]
          support_id?: string | null
          taux_apporteur_ext?: number | null
          taux_produit_compagnie_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_apporteur_id_fkey"
            columns: ["apporteur_id"]
            isOneToOne: false
            referencedRelation: "apporteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "dossiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "dossiers_compagnie_id_fkey"
            columns: ["compagnie_id"]
            isOneToOne: false
            referencedRelation: "compagnies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
          {
            foreignKeyName: "dossiers_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_support_id_fkey"
            columns: ["support_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_support_id_fkey"
            columns: ["support_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
          {
            foreignKeyName: "dossiers_taux_produit_compagnie_id_fkey"
            columns: ["taux_produit_compagnie_id"]
            isOneToOne: false
            referencedRelation: "taux_produit_compagnie"
            referencedColumns: ["id"]
          },
        ]
      }
      encaissements: {
        Row: {
          annee: number
          apporteur_ext_nom: string | null
          apporteur_id: string | null
          client_nom: string | null
          client_pays: string | null
          client_prenom: string | null
          commission_brute: number | null
          commission_nette: number | null
          compagnie_nom: string | null
          consultant_id: string | null
          consultant_nom: string | null
          consultant_prenom: string | null
          created_at: string
          date_encaissement: string
          dossier_id: string | null
          id: string
          label: string | null
          mois: string
          montant_dossier: number | null
          part_cabinet: number | null
          part_maxine: number | null
          part_pool_plus: number | null
          part_thelo: number | null
          pool_total: number | null
          produit_nom: string | null
          rem_apporteur_ext: number | null
          rem_consultant: number | null
          taux_apporteur_ext: number | null
        }
        Insert: {
          annee?: number
          apporteur_ext_nom?: string | null
          apporteur_id?: string | null
          client_nom?: string | null
          client_pays?: string | null
          client_prenom?: string | null
          commission_brute?: number | null
          commission_nette?: number | null
          compagnie_nom?: string | null
          consultant_id?: string | null
          consultant_nom?: string | null
          consultant_prenom?: string | null
          created_at?: string
          date_encaissement?: string
          dossier_id?: string | null
          id?: string
          label?: string | null
          mois: string
          montant_dossier?: number | null
          part_cabinet?: number | null
          part_maxine?: number | null
          part_pool_plus?: number | null
          part_thelo?: number | null
          pool_total?: number | null
          produit_nom?: string | null
          rem_apporteur_ext?: number | null
          rem_consultant?: number | null
          taux_apporteur_ext?: number | null
        }
        Update: {
          annee?: number
          apporteur_ext_nom?: string | null
          apporteur_id?: string | null
          client_nom?: string | null
          client_pays?: string | null
          client_prenom?: string | null
          commission_brute?: number | null
          commission_nette?: number | null
          compagnie_nom?: string | null
          consultant_id?: string | null
          consultant_nom?: string | null
          consultant_prenom?: string | null
          created_at?: string
          date_encaissement?: string
          dossier_id?: string | null
          id?: string
          label?: string | null
          mois?: string
          montant_dossier?: number | null
          part_cabinet?: number | null
          part_maxine?: number | null
          part_pool_plus?: number | null
          part_thelo?: number | null
          pool_total?: number | null
          produit_nom?: string | null
          rem_apporteur_ext?: number | null
          rem_consultant?: number | null
          taux_apporteur_ext?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "encaissements_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaissements_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
          {
            foreignKeyName: "encaissements_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaissements_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaissements_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["id"]
          },
        ]
      }
      encaissements_rem: {
        Row: {
          consultant: number | null
          created_at: string | null
          id: string
          label: string
          mathias: number | null
          maxine: number | null
          mois: string
          net_cabinet: number | null
          part_cabinet: number | null
          pool_plus: number | null
          steph_asie: number | null
          steph_fr: number | null
          thelo: number | null
        }
        Insert: {
          consultant?: number | null
          created_at?: string | null
          id?: string
          label: string
          mathias?: number | null
          maxine?: number | null
          mois: string
          net_cabinet?: number | null
          part_cabinet?: number | null
          pool_plus?: number | null
          steph_asie?: number | null
          steph_fr?: number | null
          thelo?: number | null
        }
        Update: {
          consultant?: number | null
          created_at?: string | null
          id?: string
          label?: string
          mathias?: number | null
          maxine?: number | null
          mois?: string
          net_cabinet?: number | null
          part_cabinet?: number | null
          pool_plus?: number | null
          steph_asie?: number | null
          steph_fr?: number | null
          thelo?: number | null
        }
        Relationships: []
      }
      facturation_consultant: {
        Row: {
          consultant_id: string
          created_at: string | null
          date_facture: string | null
          date_paiement: string | null
          description: string | null
          dossier_id: string | null
          id: string
          montant: number
          numero_facture: string | null
          statut: string
          updated_at: string | null
        }
        Insert: {
          consultant_id: string
          created_at?: string | null
          date_facture?: string | null
          date_paiement?: string | null
          description?: string | null
          dossier_id?: string | null
          id?: string
          montant?: number
          numero_facture?: string | null
          statut?: string
          updated_at?: string | null
        }
        Update: {
          consultant_id?: string
          created_at?: string | null
          date_facture?: string | null
          date_paiement?: string | null
          description?: string | null
          dossier_id?: string | null
          id?: string
          montant?: number
          numero_facture?: string | null
          statut?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturation_consultant_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturation_consultant_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
          {
            foreignKeyName: "facturation_consultant_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturation_consultant_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturation_consultant_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          created_at: string | null
          date_facture: string | null
          date_paiement: string | null
          dossier_id: string
          facturee: boolean | null
          id: string
          payee: Database["public"]["Enums"]["paiement_type"] | null
        }
        Insert: {
          created_at?: string | null
          date_facture?: string | null
          date_paiement?: string | null
          dossier_id: string
          facturee?: boolean | null
          id?: string
          payee?: Database["public"]["Enums"]["paiement_type"] | null
        }
        Update: {
          created_at?: string | null
          date_facture?: string | null
          date_paiement?: string | null
          dossier_id?: string
          facturee?: boolean | null
          id?: string
          payee?: Database["public"]["Enums"]["paiement_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["id"]
          },
        ]
      }
      faq: {
        Row: {
          categorie: string
          created_at: string | null
          id: string
          ordre: number | null
          question: string
          reponse: string
          sous_categorie: string | null
          updated_at: string | null
          visible: boolean | null
        }
        Insert: {
          categorie: string
          created_at?: string | null
          id?: string
          ordre?: number | null
          question: string
          reponse: string
          sous_categorie?: string | null
          updated_at?: string | null
          visible?: boolean | null
        }
        Update: {
          categorie?: string
          created_at?: string | null
          id?: string
          ordre?: number | null
          question?: string
          reponse?: string
          sous_categorie?: string | null
          updated_at?: string | null
          visible?: boolean | null
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          access_token: string
          consultant_id: string | null
          created_at: string | null
          expires_at: string | null
          google_email: string | null
          id: string
          refresh_token: string | null
          scopes: string[] | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          consultant_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          google_email?: string | null
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          consultant_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          google_email?: string | null
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_tokens_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: true
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_tokens_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: true
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
        ]
      }
      grilles_commissionnement: {
        Row: {
          ca_max: number | null
          ca_min: number
          id: string
          label: string
          taux_remuneration: number
        }
        Insert: {
          ca_max?: number | null
          ca_min: number
          id?: string
          label: string
          taux_remuneration: number
        }
        Update: {
          ca_max?: number | null
          ca_min?: number
          id?: string
          label?: string
          taux_remuneration?: number
        }
        Relationships: []
      }
      grilles_frais: {
        Row: {
          actif: boolean | null
          created_at: string | null
          encours_max: number | null
          encours_min: number
          id: string
          libelle: string | null
          produit_categorie: string | null
          taux: number
          type_frais: Database["public"]["Enums"]["type_frais"]
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          encours_max?: number | null
          encours_min: number
          id?: string
          libelle?: string | null
          produit_categorie?: string | null
          taux: number
          type_frais: Database["public"]["Enums"]["type_frais"]
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          encours_max?: number | null
          encours_min?: number
          id?: string
          libelle?: string | null
          produit_categorie?: string | null
          taux?: number
          type_frais?: Database["public"]["Enums"]["type_frais"]
        }
        Relationships: []
      }
      kyc_propositions: {
        Row: {
          client_id: string
          completion_rate: number | null
          consent_accuracy: boolean
          consent_incomplete: boolean
          field_decisions: Json
          id: string
          missing_fields: Json | null
          original_snapshot: Json
          proposed_data: Json
          reviewed_at: string | null
          reviewed_by: string | null
          signed_at: string | null
          signer_ip: string | null
          signer_name: string | null
          status: string
          submitted_at: string
          token_used: string
          updated_at: string
        }
        Insert: {
          client_id: string
          completion_rate?: number | null
          consent_accuracy?: boolean
          consent_incomplete?: boolean
          field_decisions?: Json
          id?: string
          missing_fields?: Json | null
          original_snapshot: Json
          proposed_data: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: string
          submitted_at?: string
          token_used: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          completion_rate?: number | null
          consent_accuracy?: boolean
          consent_incomplete?: boolean
          field_decisions?: Json
          id?: string
          missing_fields?: Json | null
          original_snapshot?: Json
          proposed_data?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: string
          submitted_at?: string
          token_used?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_propositions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_propositions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_propositions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "kyc_propositions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
        ]
      }
      kyc_relance_settings: {
        Row: {
          consultant_id: string
          created_at: string
          email_auto: boolean
          enabled: boolean
          id: string
          intervalle_jours: number
          max_relances: number
          seuil_jours: number
          updated_at: string
        }
        Insert: {
          consultant_id: string
          created_at?: string
          email_auto?: boolean
          enabled?: boolean
          id?: string
          intervalle_jours?: number
          max_relances?: number
          seuil_jours?: number
          updated_at?: string
        }
        Update: {
          consultant_id?: string
          created_at?: string
          email_auto?: boolean
          enabled?: boolean
          id?: string
          intervalle_jours?: number
          max_relances?: number
          seuil_jours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_relance_settings_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: true
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_relance_settings_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: true
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
        ]
      }
      manager_cagnotte: {
        Row: {
          acquis_total: number | null
          factures_detail: Json | null
          id: string
          manager_key: string
          montant_facture: number | null
          solde_2025: number | null
          updated_at: string | null
        }
        Insert: {
          acquis_total?: number | null
          factures_detail?: Json | null
          id?: string
          manager_key: string
          montant_facture?: number | null
          solde_2025?: number | null
          updated_at?: string | null
        }
        Update: {
          acquis_total?: number | null
          factures_detail?: Json | null
          id?: string
          manager_key?: string
          montant_facture?: number | null
          solde_2025?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      produits: {
        Row: {
          categorie: string | null
          created_at: string | null
          id: string
          nom: string
        }
        Insert: {
          categorie?: string | null
          created_at?: string | null
          id?: string
          nom: string
        }
        Update: {
          categorie?: string | null
          created_at?: string | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          hit_at: string
          id: number
          identifier: string
        }
        Insert: {
          bucket: string
          hit_at?: string
          id?: number
          identifier: string
        }
        Update: {
          bucket?: string
          hit_at?: string
          id?: number
          identifier?: string
        }
        Relationships: []
      }
      relances: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          date_echeance: string
          description: string
          dossier_id: string | null
          id: string
          rappel_date: string | null
          source: string | null
          statut: string
          type: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          date_echeance: string
          description: string
          dossier_id?: string | null
          id?: string
          rappel_date?: string | null
          source?: string | null
          statut?: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          date_echeance?: string
          description?: string
          dossier_id?: string | null
          id?: string
          rappel_date?: string | null
          source?: string | null
          statut?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "relances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "relances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
          {
            foreignKeyName: "relances_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relances_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relances_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["id"]
          },
        ]
      }
      rendez_vous: {
        Row: {
          calendar_source: string | null
          client_id: string
          created_at: string | null
          created_by: string | null
          date_rdv: string
          gcal_event_id: string | null
          id: string
          notes: string | null
          type: string | null
        }
        Insert: {
          calendar_source?: string | null
          client_id: string
          created_at?: string | null
          created_by?: string | null
          date_rdv: string
          gcal_event_id?: string | null
          id?: string
          notes?: string | null
          type?: string | null
        }
        Update: {
          calendar_source?: string | null
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          date_rdv?: string
          gcal_event_id?: string | null
          id?: string
          notes?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rendez_vous_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendez_vous_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendez_vous_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "rendez_vous_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "rendez_vous_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendez_vous_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
        ]
      }
      taux_produit_compagnie: {
        Row: {
          actif: boolean | null
          commission_retrocedee: number | null
          compagnie_id: string | null
          description: string | null
          frais_encours: number | null
          frais_entree: number | null
          id: string
          prix_part: number | null
          produit_id: string | null
          taux: number
        }
        Insert: {
          actif?: boolean | null
          commission_retrocedee?: number | null
          compagnie_id?: string | null
          description?: string | null
          frais_encours?: number | null
          frais_entree?: number | null
          id?: string
          prix_part?: number | null
          produit_id?: string | null
          taux: number
        }
        Update: {
          actif?: boolean | null
          commission_retrocedee?: number | null
          compagnie_id?: string | null
          description?: string | null
          frais_encours?: number | null
          frais_entree?: number | null
          id?: string
          prix_part?: number | null
          produit_id?: string | null
          taux?: number
        }
        Relationships: [
          {
            foreignKeyName: "taux_produit_compagnie_compagnie_id_fkey"
            columns: ["compagnie_id"]
            isOneToOne: false
            referencedRelation: "compagnies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taux_produit_compagnie_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_settings: {
        Row: {
          back_office_visible: boolean
          consultant_visible: boolean
          description: string | null
          id: string
          label: string
          section: string
          setting_key: string
          sort_order: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          back_office_visible?: boolean
          consultant_visible?: boolean
          description?: string | null
          id?: string
          label: string
          section: string
          setting_key: string
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          back_office_visible?: boolean
          consultant_visible?: boolean
          description?: string | null
          id?: string
          label?: string
          section?: string
          setting_key?: string
          sort_order?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_clients_secure: {
        Row: {
          conformite: string | null
          created_at: string | null
          der: boolean | null
          email: string | null
          id: string | null
          lm: boolean | null
          nom: string | null
          numero_compte: string | null
          pays: string | null
          pi: boolean | null
          preco: boolean | null
          prenom: string | null
          rm: boolean | null
          statut_kyc: Database["public"]["Enums"]["statut_kyc_type"] | null
          telephone: string | null
        }
        Insert: {
          conformite?: string | null
          created_at?: string | null
          der?: boolean | null
          email?: never
          id?: string | null
          lm?: boolean | null
          nom?: string | null
          numero_compte?: never
          pays?: string | null
          pi?: boolean | null
          preco?: boolean | null
          prenom?: string | null
          rm?: boolean | null
          statut_kyc?: Database["public"]["Enums"]["statut_kyc_type"] | null
          telephone?: never
        }
        Update: {
          conformite?: string | null
          created_at?: string | null
          der?: boolean | null
          email?: never
          id?: string | null
          lm?: boolean | null
          nom?: string | null
          numero_compte?: never
          pays?: string | null
          pi?: boolean | null
          preco?: boolean | null
          prenom?: string | null
          rm?: boolean | null
          statut_kyc?: Database["public"]["Enums"]["statut_kyc_type"] | null
          telephone?: never
        }
        Relationships: []
      }
      v_collecte_par_consultant: {
        Row: {
          consultant: string | null
          financement: Database["public"]["Enums"]["financement_type"] | null
          nb_dossiers: number | null
          produit: string | null
          total_commissions: number | null
          total_montant: number | null
        }
        Relationships: []
      }
      v_dossiers_complets: {
        Row: {
          apporteur_ext_nom: string | null
          apporteur_id: string | null
          apporteur_label: string | null
          client_email: string | null
          client_id: string | null
          client_nom: string | null
          client_pays: string | null
          client_prenom: string | null
          client_telephone: string | null
          client_ville: string | null
          co_titulaire_id: string | null
          co_titulaire_nom: string | null
          co_titulaire_prenom: string | null
          commentaire: string | null
          commission_brute: number | null
          compagnie_nom: string | null
          consultant_id: string | null
          consultant_nom: string | null
          consultant_prenom: string | null
          consultant_zone: string | null
          date_entree_en_relation: string | null
          date_facture: string | null
          date_operation: string | null
          date_signature: string | null
          der: boolean | null
          facturee: boolean | null
          financement: Database["public"]["Enums"]["financement_type"] | null
          has_apporteur_ext: boolean | null
          id: string | null
          lm: boolean | null
          mode_detention:
            | Database["public"]["Enums"]["mode_detention_type"]
            | null
          montant: number | null
          part_cabinet: number | null
          payee: Database["public"]["Enums"]["paiement_type"] | null
          pct_cabinet: number | null
          pi: boolean | null
          preco: boolean | null
          produit_categorie: string | null
          produit_nom: string | null
          referent: string | null
          rem_apporteur: number | null
          rem_apporteur_ext: number | null
          rem_support: number | null
          rm: boolean | null
          statut: Database["public"]["Enums"]["statut_dossier_type"] | null
          statut_kyc: Database["public"]["Enums"]["statut_kyc_type"] | null
          taux_apporteur_ext: number | null
          taux_commission: number | null
          taux_gestion: number | null
          taux_produit_compagnie_description: string | null
          taux_produit_compagnie_id: string | null
          taux_remuneration: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_apporteur_id_fkey"
            columns: ["apporteur_id"]
            isOneToOne: false
            referencedRelation: "apporteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "dossiers_taux_produit_compagnie_id_fkey"
            columns: ["taux_produit_compagnie_id"]
            isOneToOne: false
            referencedRelation: "taux_produit_compagnie"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dossiers_remunerations: {
        Row: {
          apporteur_ext_nom: string | null
          apporteur_id: string | null
          apporteur_label: string | null
          client_email: string | null
          client_id: string | null
          client_nom: string | null
          client_pays: string | null
          client_prenom: string | null
          client_telephone: string | null
          client_ville: string | null
          co_titulaire_id: string | null
          co_titulaire_nom: string | null
          co_titulaire_prenom: string | null
          commentaire: string | null
          commission_brute: number | null
          compagnie_nom: string | null
          consultant_nom: string | null
          consultant_prenom: string | null
          consultant_zone: string | null
          date_entree_en_relation: string | null
          date_facture: string | null
          date_operation: string | null
          date_signature: string | null
          der: boolean | null
          facturee: boolean | null
          financement: Database["public"]["Enums"]["financement_type"] | null
          has_apporteur_ext: boolean | null
          id: string | null
          lm: boolean | null
          mode_detention:
            | Database["public"]["Enums"]["mode_detention_type"]
            | null
          montant: number | null
          part_cabinet: number | null
          payee: Database["public"]["Enums"]["paiement_type"] | null
          pct_cabinet: number | null
          pi: boolean | null
          preco: boolean | null
          produit_categorie: string | null
          produit_nom: string | null
          referent: string | null
          rem_apporteur: number | null
          rem_apporteur_ext: number | null
          rem_support: number | null
          rm: boolean | null
          statut: Database["public"]["Enums"]["statut_dossier_type"] | null
          statut_kyc: Database["public"]["Enums"]["statut_kyc_type"] | null
          taux_apporteur_ext: number | null
          taux_commission: number | null
          taux_gestion: number | null
          taux_remuneration: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_apporteur_id_fkey"
            columns: ["apporteur_id"]
            isOneToOne: false
            referencedRelation: "apporteurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "v_clients_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "dossiers_co_titulaire_id_fkey"
            columns: ["co_titulaire_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["client_id"]
          },
        ]
      }
      v_encaissements: {
        Row: {
          annee: number | null
          apporteur_ext_nom: string | null
          apporteur_id: string | null
          client_nom: string | null
          client_pays: string | null
          client_prenom: string | null
          commission_brute: number | null
          commission_nette: number | null
          compagnie_nom: string | null
          consultant_id: string | null
          consultant_nom: string | null
          consultant_prenom: string | null
          created_at: string | null
          date_encaissement: string | null
          dossier_id: string | null
          id: string | null
          label: string | null
          ma_part: number | null
          mois: string | null
          montant_dossier: number | null
          part_cabinet: number | null
          part_maxine: number | null
          part_pool_plus: number | null
          part_thelo: number | null
          pool_total: number | null
          produit_nom: string | null
          rem_apporteur_ext: number | null
          rem_consultant: number | null
          taux_apporteur_ext: number | null
          visible_part_maxine: number | null
          visible_part_pool_plus: number | null
          visible_part_thelo: number | null
        }
        Insert: {
          annee?: number | null
          apporteur_ext_nom?: string | null
          apporteur_id?: string | null
          client_nom?: string | null
          client_pays?: string | null
          client_prenom?: string | null
          commission_brute?: number | null
          commission_nette?: number | null
          compagnie_nom?: string | null
          consultant_id?: string | null
          consultant_nom?: string | null
          consultant_prenom?: string | null
          created_at?: string | null
          date_encaissement?: string | null
          dossier_id?: string | null
          id?: string | null
          label?: string | null
          ma_part?: never
          mois?: string | null
          montant_dossier?: number | null
          part_cabinet?: number | null
          part_maxine?: number | null
          part_pool_plus?: number | null
          part_thelo?: number | null
          pool_total?: number | null
          produit_nom?: string | null
          rem_apporteur_ext?: number | null
          rem_consultant?: number | null
          taux_apporteur_ext?: number | null
          visible_part_maxine?: never
          visible_part_pool_plus?: never
          visible_part_thelo?: never
        }
        Update: {
          annee?: number | null
          apporteur_ext_nom?: string | null
          apporteur_id?: string | null
          client_nom?: string | null
          client_pays?: string | null
          client_prenom?: string | null
          commission_brute?: number | null
          commission_nette?: number | null
          compagnie_nom?: string | null
          consultant_id?: string | null
          consultant_nom?: string | null
          consultant_prenom?: string | null
          created_at?: string | null
          date_encaissement?: string | null
          dossier_id?: string | null
          id?: string | null
          label?: string | null
          ma_part?: never
          mois?: string | null
          montant_dossier?: number | null
          part_cabinet?: number | null
          part_maxine?: number | null
          part_pool_plus?: number | null
          part_thelo?: number | null
          pool_total?: number | null
          produit_nom?: string | null
          rem_apporteur_ext?: number | null
          rem_consultant?: number | null
          taux_apporteur_ext?: number | null
          visible_part_maxine?: never
          visible_part_pool_plus?: never
          visible_part_thelo?: never
        }
        Relationships: [
          {
            foreignKeyName: "encaissements_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaissements_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["consultant_id"]
          },
          {
            foreignKeyName: "encaissements_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaissements_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "v_dossiers_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaissements_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "v_dossiers_remunerations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pipeline_par_consultant: {
        Row: {
          consultant: string | null
          financement: Database["public"]["Enums"]["financement_type"] | null
          nb_dossiers: number | null
          produit: string | null
          total_montant: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _current_consultant_id: { Args: never; Returns: string }
      _is_manager_or_bo: { Args: never; Returns: boolean }
      _kyc_editable_fields: { Args: never; Returns: string[] }
      calculate_commission: {
        Args: { p_dossier_id: string }
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_max_hits: number
          p_window_seconds: number
        }
        Returns: Json
      }
      get_classement: {
        Args: { p_annee?: number }
        Returns: {
          collecte: number
          consultant_nom: string
          consultant_prenom: string
          nb_dossiers: number
        }[]
      }
      get_current_consultant_id: { Args: never; Returns: string }
      get_current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["role_type"]
      }
      get_frais_taux: {
        Args: {
          p_encours: number
          p_type: Database["public"]["Enums"]["type_frais"]
          p_categorie?: string | null
        }
        Returns: number
      }
      is_back_office: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      kyc_apply_proposition: {
        Args: { p_field_decisions: Json; p_proposition_id: string }
        Returns: Json
      }
      kyc_client_by_token: { Args: { p_token: string }; Returns: Json }
      kyc_generate_token: { Args: { p_client_id: string }; Returns: string }
      kyc_list_pending_propositions: {
        Args: { p_client_id?: string }
        Returns: {
          client_id: string
          completion_rate: number | null
          consent_accuracy: boolean
          consent_incomplete: boolean
          field_decisions: Json
          id: string
          missing_fields: Json | null
          original_snapshot: Json
          proposed_data: Json
          reviewed_at: string | null
          reviewed_by: string | null
          signed_at: string | null
          signer_ip: string | null
          signer_name: string | null
          status: string
          submitted_at: string
          token_used: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "kyc_propositions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      kyc_mark_opened: { Args: { p_token: string }; Returns: undefined }
      kyc_mark_sent: { Args: { p_client_id: string }; Returns: undefined }
      kyc_pending_proposition_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      kyc_sign_by_token: {
        Args: {
          p_completion_rate: number
          p_consent_accuracy: boolean
          p_consent_incomplete: boolean
          p_missing_fields: Json
          p_signer_ip: string
          p_signer_name: string
          p_token: string
        }
        Returns: Json
      }
      kyc_submit_proposition_by_token: {
        Args: {
          p_completion_rate: number
          p_consent_accuracy: boolean
          p_consent_incomplete: boolean
          p_missing_fields: Json
          p_proposed_data: Json
          p_signer_ip: string
          p_signer_name: string
          p_token: string
        }
        Returns: Json
      }
      mask_account: { Args: { num: string }; Returns: string }
      mask_email: { Args: { email: string }; Returns: string }
      mask_phone: { Args: { phone: string }; Returns: string }
      purge_rate_limit_hits: {
        Args: { p_older_than_seconds?: number }
        Returns: number
      }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_google_token: {
        Args: {
          p_access_token: string
          p_consultant_id: string
          p_expires_at: string
          p_google_email: string
          p_refresh_token: string
          p_scopes: string[]
        }
        Returns: undefined
      }
    }
    Enums: {
      financement_type: "cash" | "credit" | "lombard" | "remploi"
      mode_detention_type: "PP" | "NP" | "US"
      paiement_type: "non" | "en_cours" | "oui"
      role_type: "manager" | "consultant" | "back_office"
      statut_dossier_type:
        | "prospect"
        | "client_en_cours"
        | "client_finalise"
        | "non_abouti"
      statut_kyc_type: "non" | "en_cours" | "oui"
      type_frais: "entree" | "gestion"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      financement_type: ["cash", "credit", "lombard", "remploi"],
      mode_detention_type: ["PP", "NP", "US"],
      paiement_type: ["non", "en_cours", "oui"],
      role_type: ["manager", "consultant", "back_office"],
      statut_dossier_type: [
        "prospect",
        "client_en_cours",
        "client_finalise",
        "non_abouti",
      ],
      statut_kyc_type: ["non", "en_cours", "oui"],
      type_frais: ["entree", "gestion"],
    },
  },
} as const

// =====================================================================
// Aliases custom PEV — à maintenir manuellement après chaque
// `supabase gen types typescript` (ils ne sont pas dans la sortie std).
// Raccourcissent les imports dans tout le code applicatif.
// =====================================================================
export type RoleType = Database["public"]["Enums"]["role_type"]
export type StatutKycType = Database["public"]["Enums"]["statut_kyc_type"]
export type FinancementType = Database["public"]["Enums"]["financement_type"]
export type StatutDossierType = Database["public"]["Enums"]["statut_dossier_type"]
export type ModeDetentionType = Database["public"]["Enums"]["mode_detention_type"]
export type PaiementType = Database["public"]["Enums"]["paiement_type"]
export type TypeFraisType = Database["public"]["Enums"]["type_frais"]

export type Consultant = Database["public"]["Tables"]["consultants"]["Row"]
export type ConsultantInsert = Database["public"]["Tables"]["consultants"]["Insert"]
export type ConsultantUpdate = Database["public"]["Tables"]["consultants"]["Update"]

export type Client = Database["public"]["Tables"]["clients"]["Row"]
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"]
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"]

export type Produit = Database["public"]["Tables"]["produits"]["Row"]
export type ProduitInsert = Database["public"]["Tables"]["produits"]["Insert"]
export type ProduitUpdate = Database["public"]["Tables"]["produits"]["Update"]

export type Compagnie = Database["public"]["Tables"]["compagnies"]["Row"]
export type CompagnieInsert = Database["public"]["Tables"]["compagnies"]["Insert"]
export type CompagnieUpdate = Database["public"]["Tables"]["compagnies"]["Update"]

export type TauxProduitCompagnie = Database["public"]["Tables"]["taux_produit_compagnie"]["Row"]
export type TauxProduitCompagnieInsert = Database["public"]["Tables"]["taux_produit_compagnie"]["Insert"]
export type TauxProduitCompagnieUpdate = Database["public"]["Tables"]["taux_produit_compagnie"]["Update"]

export type GrillesFrais = Database["public"]["Tables"]["grilles_frais"]["Row"]
export type GrillesFraisInsert = Database["public"]["Tables"]["grilles_frais"]["Insert"]
export type GrillesFraisUpdate = Database["public"]["Tables"]["grilles_frais"]["Update"]

export type Dossier = Database["public"]["Tables"]["dossiers"]["Row"]
export type DossierInsert = Database["public"]["Tables"]["dossiers"]["Insert"]
export type DossierUpdate = Database["public"]["Tables"]["dossiers"]["Update"]

export type Commission = Database["public"]["Tables"]["commissions"]["Row"]
export type CommissionInsert = Database["public"]["Tables"]["commissions"]["Insert"]
export type CommissionUpdate = Database["public"]["Tables"]["commissions"]["Update"]

export type Facture = Database["public"]["Tables"]["factures"]["Row"]
export type FactureInsert = Database["public"]["Tables"]["factures"]["Insert"]
export type FactureUpdate = Database["public"]["Tables"]["factures"]["Update"]

export type Challenge = Database["public"]["Tables"]["challenges"]["Row"]
export type ChallengeInsert = Database["public"]["Tables"]["challenges"]["Insert"]
export type ChallengeUpdate = Database["public"]["Tables"]["challenges"]["Update"]

export type ClientCommentaire = Database["public"]["Tables"]["client_commentaires"]["Row"]
export type ClientCommentaireInsert = Database["public"]["Tables"]["client_commentaires"]["Insert"]
export type ClientPj = Database["public"]["Tables"]["client_pj"]["Row"]
export type ClientPjInsert = Database["public"]["Tables"]["client_pj"]["Insert"]
export type RendezVous = Database["public"]["Tables"]["rendez_vous"]["Row"]
export type RendezVousInsert = Database["public"]["Tables"]["rendez_vous"]["Insert"]
export type AuditLogs = Database["public"]["Tables"]["audit_logs"]["Row"]
export type AuditLogsInsert = Database["public"]["Tables"]["audit_logs"]["Insert"]
export type DossierDocument = Database["public"]["Tables"]["dossier_documents"]["Row"]
export type DossierDocumentInsert = Database["public"]["Tables"]["dossier_documents"]["Insert"]
export type DocumentTemplate = Database["public"]["Tables"]["document_templates"]["Row"]
export type ClientRelation = Database["public"]["Tables"]["client_relations"]["Row"]
export type GoogleToken = Database["public"]["Tables"]["google_tokens"]["Row"]
export type Relance = Database["public"]["Tables"]["relances"]["Row"]
export type RelanceInsert = Database["public"]["Tables"]["relances"]["Insert"]
export type RelanceUpdate = Database["public"]["Tables"]["relances"]["Update"]
export type Faq = Database["public"]["Tables"]["faq"]["Row"]
export type FaqInsert = Database["public"]["Tables"]["faq"]["Insert"]
export type EncaissementsRem = Database["public"]["Tables"]["encaissements_rem"]["Row"]
export type Encaissement = Database["public"]["Tables"]["encaissements"]["Row"]
export type EncaissementInsert = Database["public"]["Tables"]["encaissements"]["Insert"]
export type EncaissementUpdate = Database["public"]["Tables"]["encaissements"]["Update"]
export type Apporteur = Database["public"]["Tables"]["apporteurs"]["Row"]
export type ApporteurInsert = Database["public"]["Tables"]["apporteurs"]["Insert"]
export type ApporteurUpdate = Database["public"]["Tables"]["apporteurs"]["Update"]

export type ApporteurCompensationRule = Database["public"]["Tables"]["apporteur_compensation_rules"]["Row"]
export type ApporteurCompensationRuleInsert = Database["public"]["Tables"]["apporteur_compensation_rules"]["Insert"]
export type ApporteurCompensationRuleUpdate = Database["public"]["Tables"]["apporteur_compensation_rules"]["Update"]
export type GrillesCommissionnement = Database["public"]["Tables"]["grilles_commissionnement"]["Row"]
export type VisibilitySettings = Database["public"]["Tables"]["visibility_settings"]["Row"]
export type FacturationConsultant = Database["public"]["Tables"]["facturation_consultant"]["Row"]
export type ManagerCagnotte = Database["public"]["Tables"]["manager_cagnotte"]["Row"]

// Sous-fiches enfants — stockées en JSONB array dans clients.enfants_details.
// Tous les champs sont optionnels pour supporter (a) saisies partielles côté
// portail public, (b) entrées legacy backfillées depuis l'ancien champ TEXT
// (où seul `legacy_notes` est rempli).
export type EnfantDetail = {
  nom?: string | null
  prenom?: string | null
  sexe?: 'homme' | 'femme' | 'autre' | null
  date_naissance?: string | null // YYYY-MM-DD
  a_charge?: boolean | null
  // 2026-04-25 : flag pour distinguer les enfants issus d'une union précédente.
  // Utile pour la planification successorale.
  issu_precedente_union?: boolean | null
  legacy_notes?: string | null   // ne devrait apparaître que sur les entrées migrées du champ TEXT
}

// Sous-fiches "donation reçue" — stockées en JSONB array dans
// clients.donations_recues. Multiple donations possibles par client (héritage,
// donation parentale en plusieurs vagues…). Tous les champs optionnels pour
// permettre une saisie partielle.
export type DonationRecue = {
  donateur?: string | null      // qui a fait la donation (parent, conjoint, etc.)
  montant?: number | null       // en euros
  date_donation?: string | null // YYYY-MM-DD
  nature?: string | null        // somme d'argent / bien immobilier / titres / autre
  commentaire?: string | null
}

// Views
export type VDossiersComplets = Database["public"]["Views"]["v_dossiers_complets"]["Row"]
export type VCollecteParConsultant = Database["public"]["Views"]["v_collecte_par_consultant"]["Row"]
export type VPipelineParConsultant = Database["public"]["Views"]["v_pipeline_par_consultant"]["Row"]
export type VDossiersRemunerations = Database["public"]["Views"]["v_dossiers_remunerations"]["Row"]
export type VEncaissements = Database["public"]["Views"]["v_encaissements"]["Row"]
export type VClientsSecure = Database["public"]["Views"]["v_clients_secure"]["Row"]
