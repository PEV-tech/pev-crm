-- =====================================================
-- P3 DATA FIXES: Marion Freret dedup, Brice Jaulneau Labarre
-- Date: 2026-04-10
-- =====================================================

-- =====================================================
-- #1 — Delete duplicate Marion FRERET client (no dossiers)
-- Keep: 50cabe74-f0dc-4bee-955f-641ce9983219 (has dossier)
-- Delete: 415db3f3-d12c-4919-a756-0c2ff4775cff (empty)
-- =====================================================
DELETE FROM clients WHERE id = '415db3f3-d12c-4919-a756-0c2ff4775cff';

-- =====================================================
-- #2 — Create Brice JAULNEAU LABARRE as new client
-- Then reassign 3 dossiers from Elsa & Vincent to Brice:
--   76e55495 (SG-TRILAKE, 452255€)
--   12ef8ee7 (SG-EG, 100000€)
--   026a7fe6 (PE ALTAROC, 100000€)
-- =====================================================

-- First get the consultant_id from Elsa & Vincent's existing client
-- to assign the same consultant to Brice
INSERT INTO clients (nom, prenom, pays)
SELECT 'JAULNEAU LABARRE', 'Brice', 'FRANCE'
WHERE NOT EXISTS (
  SELECT 1 FROM clients WHERE nom ILIKE '%jaulneau%' AND prenom ILIKE '%brice%'
);

-- Reassign the 3 dossiers to Brice
UPDATE dossiers SET client_id = (
  SELECT id FROM clients WHERE nom ILIKE '%jaulneau labarre%' AND prenom ILIKE '%brice%' LIMIT 1
) WHERE id IN (
  '76e55495-963b-40cc-8e92-98698d01bb57',
  '12ef8ee7-014f-49cc-981e-8be3d8f8ce78',
  '026a7fe6-1909-40ae-b726-cbf613fb6d80'
);
