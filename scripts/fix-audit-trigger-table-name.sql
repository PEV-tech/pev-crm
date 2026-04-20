-- =====================================================
-- FIX: triggers d'audit référencent audit_log (singulier) au lieu de audit_logs
-- Date: 2026-04-20
-- Context: découvert en prod quand la correction des silent catches
--          dans clients/[id]/page.tsx a exposé l'erreur:
--          "Erreur sauvegarde contact : relation 'audit_log' does not exist"
-- =====================================================
-- Tous les UPDATE/INSERT/DELETE sur clients, dossiers, commissions, factures
-- échouaient en prod à cause de DEUX fonctions qui insèrent dans une table
-- inexistante (audit_log singulier). La vraie table est audit_logs.
--
-- Diagnostic via smoke test UPDATE clients : l'erreur pointait vers
-- audit_trigger_func() et non fn_audit_log(). Les DEUX existent en prod.
-- Ce script recrée proprement les deux fonctions pour pointer vers audit_logs
-- avec le schéma réel de la table (user_id, user_nom, action, table_name,
-- record_id, details jsonb, created_at).
--
-- Les triggers en place utilisent déjà ces fonctions et ne nécessitent pas
-- de recréation (CREATE OR REPLACE FUNCTION remplace la fonction en place).
--
-- Appliqué en prod le 2026-04-20 via SQL editor Supabase.
-- =====================================================

-- ----- Fonction 1 : fn_audit_log -----
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $BODY$
DECLARE
  v_user_id UUID;
  v_user_nom TEXT;
  v_action TEXT;
  v_record_id UUID;
  v_details JSONB;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT nom INTO v_user_nom FROM consultants WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_record_id := NEW.id;
    v_details := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_record_id := NEW.id;
    v_details := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_record_id := OLD.id;
    v_details := to_jsonb(OLD);
  END IF;

  -- Fix: audit_logs (pluriel), pas audit_log (singulier)
  INSERT INTO audit_logs (
    user_id, user_nom, action, table_name, record_id, details, created_at
  ) VALUES (
    v_user_id, v_user_nom, v_action, TG_TABLE_NAME, v_record_id, v_details, now()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----- Fonction 2 : audit_trigger_func (la vraie coupable identifiée en prod) -----
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $BODY$
DECLARE
  v_user_id UUID;
  v_user_nom TEXT;
  v_action TEXT;
  v_record_id UUID;
  v_details JSONB;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT nom INTO v_user_nom FROM consultants WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_record_id := NEW.id;
    v_details := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_record_id := NEW.id;
    v_details := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_record_id := OLD.id;
    v_details := to_jsonb(OLD);
  END IF;

  INSERT INTO audit_logs (
    user_id, user_nom, action, table_name, record_id, details, created_at
  ) VALUES (
    v_user_id, v_user_nom, v_action, TG_TABLE_NAME, v_record_id, v_details, now()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

-- Smoke test post-fix (a été lancé avec succès en prod le 2026-04-20) :
-- UPDATE clients SET email = email WHERE id = (SELECT id FROM clients LIMIT 1)
-- RETURNING id, email;
