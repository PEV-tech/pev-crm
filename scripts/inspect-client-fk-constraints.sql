-- Inspection des FK pointant vers clients(id) et leur DELETE rule.
-- Read-only : aucun effet de bord. À lancer dans le SQL editor Supabase
-- avant d'appliquer fix-client-fk-cascades.sql.
--
-- Contexte : la suppression des fiches jointes (Matthieu Dumont & Caroline Pénard,
-- Marion Pouliquen & Simon Marc, etc.) échouait avec une contrainte FK.
-- POULIQUEN & MARC a été résolu manuellement par DELETE ciblé (STATUS #9) mais
-- sans fix structurel — il faut identifier quelle(s) table(s) référence(nt)
-- clients(id) sans ON DELETE CASCADE/SET NULL.

SELECT
  tc.constraint_name,
  tc.table_schema,
  tc.table_name           AS child_table,
  kcu.column_name         AS child_column,
  ccu.table_name          AS parent_table,
  ccu.column_name         AS parent_column,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema    = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
 AND tc.table_schema    = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
 AND rc.unique_constraint_schema = ccu.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema     = 'public'
  AND ccu.table_name      = 'clients'
  AND ccu.column_name     = 'id'
ORDER BY child_table, child_column;

-- Attendu :
-- | child_table         | child_column          | delete_rule |
-- |---------------------|-----------------------|-------------|
-- | client_relations    | client_id_1           | CASCADE     | ← déjà ok (p2-evolutions)
-- | client_relations    | client_id_2           | CASCADE     | ← déjà ok
-- | clients             | co_titulaire_id       | SET NULL    | ← déjà ok (add-co-titulaire)
-- | clients             | representant_legal_id | SET NULL    | ← déjà ok (personne morale)
-- | kyc_propositions    | client_id             | CASCADE     | ← déjà ok
-- | dossiers            | client_id             | ???         | ← CAUSE SUSPECTÉE du blocage
-- | client_pj           | client_id             | ???         | ← candidate
-- | client_commentaires | client_id             | ???         | ← candidate
-- | rendez_vous         | client_id             | ???         | ← candidate
-- | relances            | client_id             | ???         | ← candidate
-- | encaissements       | client_id             | ???         | ← candidate (via dossier ?)
--
-- Toute ligne où delete_rule = 'NO ACTION' ou 'RESTRICT' explique le blocage.
