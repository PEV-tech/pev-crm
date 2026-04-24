-- Migration: Auto-création d'une ligne `commissions` à l'INSERT d'un dossier
-- Date: 2026-04-24
-- Référence: Corrections app Étape 5 point 5.1 (plan 2026-04-24)
--
-- Contexte :
--   Aujourd'hui, une ligne `commissions` n'est créée que lors d'une
--   action explicite de l'utilisateur côté UI (édition des taux dans le
--   détail dossier → handleSaveTaux fait un upsert). Conséquence :
--   tous les dossiers CRÉÉS mais jamais édités côté commission sortent
--   avec `commission_brute = NULL, taux_commission = NULL, …` dans
--   `v_dossiers_complets` (LEFT JOIN). L'UI "Détail commission" reste
--   donc vide, exactement ce que Maxine a signalé sur les dossiers :
--     · 2A312B54   (détail mal affiché)
--     · 9816C1CF   (détail absent)
--     · FE8AFA25   (détail absent)
--     · tous les dossiers de Marion Freret (détail absent récurrent)
--   + indirectement le "Pipeline 0 €" de la fiche Marion Freret
--   (cf point 5.3 : sans commission_brute, certaines vues retournent 0).
--
-- Fix :
--   Trigger AFTER INSERT ON dossiers qui crée automatiquement une ligne
--   `commissions` avec les taux déduits de `taux_produit_compagnie`
--   (couple produit×compagnie) ou des defaults par catégorie (cohérent
--   avec src/lib/commissions/default-grilles.ts côté front). Si aucun
--   taux trouvable → 0 (on n'invente pas, on laisse l'utilisateur
--   éditer depuis l'UI).
--
--   Le trigger est SECURITY DEFINER (bypass RLS INSERT sur commissions
--   car le contexte de l'INSERT dossier peut être un consultant qui n'a
--   pas le droit direct d'INSERT sur commissions).
--
--   ON CONFLICT DO NOTHING sur dossier_id : idempotent si une ligne
--   existe déjà (cas d'une re-création accidentelle ou d'un script de
--   backfill qui a déjà tourné).
--
-- Reversible : DROP TRIGGER + DROP FUNCTION en bas du fichier.

-- =============================================================
-- 1. Fonction : calculer et insérer la ligne commissions
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_init_commissions_for_dossier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_taux          NUMERIC;
  v_categorie     TEXT;
  v_brute         NUMERIC;
  v_default_entree NUMERIC;
BEGIN
  -- 1. Priorité 1 : taux explicite via taux_produit_compagnie_id
  --    (FK renseignée manuellement depuis l'UI dossier).
  IF NEW.taux_produit_compagnie_id IS NOT NULL THEN
    SELECT COALESCE(tpc.frais_entree, tpc.taux)
      INTO v_taux
      FROM taux_produit_compagnie tpc
     WHERE tpc.id = NEW.taux_produit_compagnie_id
       AND COALESCE(tpc.actif, true) = true
     LIMIT 1;
  END IF;

  -- 2. Priorité 2 : couple produit × compagnie (sans FK explicite,
  --    on prend la première ligne active matching).
  IF v_taux IS NULL AND NEW.produit_id IS NOT NULL AND NEW.compagnie_id IS NOT NULL THEN
    SELECT COALESCE(tpc.frais_entree, tpc.taux)
      INTO v_taux
      FROM taux_produit_compagnie tpc
     WHERE tpc.produit_id   = NEW.produit_id
       AND tpc.compagnie_id = NEW.compagnie_id
       AND COALESCE(tpc.actif, true) = true
     ORDER BY tpc.taux DESC NULLS LAST
     LIMIT 1;
  END IF;

  -- 3. Priorité 3 : default par catégorie produit
  --    (miroir simplifié de src/lib/commissions/default-grilles.ts).
  --    Les 3 catégories couvertes : SCPI 6 %, PE 3 %, CAV/CAPI 1 %.
  IF v_taux IS NULL AND NEW.produit_id IS NOT NULL THEN
    SELECT p.categorie INTO v_categorie
      FROM produits p
     WHERE p.id = NEW.produit_id
     LIMIT 1;

    v_default_entree := CASE
      WHEN v_categorie ILIKE 'SCPI' THEN 0.06
      WHEN v_categorie ILIKE 'PE' OR v_categorie ILIKE '%private equity%' THEN 0.03
      WHEN v_categorie ILIKE '%CAV%' OR v_categorie ILIKE '%CAPI%' THEN 0.01
      ELSE NULL
    END;
    v_taux := v_default_entree;
  END IF;

  -- 4. Calcul commission brute = montant × taux. NULL-safe.
  v_brute := COALESCE(NEW.montant, 0) * COALESCE(v_taux, 0);

  -- 5. Insertion idempotente. ON CONFLICT sur dossier_id UNIQUE.
  INSERT INTO commissions (
    dossier_id,
    taux_commission,
    commission_brute,
    calculated_at
  ) VALUES (
    NEW.id,
    v_taux,            -- peut être NULL si rien trouvable
    v_brute,           -- 0 si taux NULL ou montant NULL
    NOW()
  )
  ON CONFLICT (dossier_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_init_commissions_for_dossier() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_init_commissions_for_dossier() TO authenticated;

-- =============================================================
-- 2. Trigger AFTER INSERT ON dossiers
-- =============================================================
DROP TRIGGER IF EXISTS trg_dossiers_init_commissions ON public.dossiers;
CREATE TRIGGER trg_dossiers_init_commissions
  AFTER INSERT ON public.dossiers
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_init_commissions_for_dossier();

-- =============================================================
-- 3. Backfill : créer les lignes commissions manquantes pour les
--    dossiers existants (mêmes règles que le trigger).
-- =============================================================
INSERT INTO commissions (dossier_id, taux_commission, commission_brute, calculated_at)
SELECT
  d.id AS dossier_id,
  -- Même cascade de priorités que dans le trigger.
  COALESCE(
    (SELECT COALESCE(tpc.frais_entree, tpc.taux)
       FROM taux_produit_compagnie tpc
      WHERE tpc.id = d.taux_produit_compagnie_id
        AND COALESCE(tpc.actif, true) = true
      LIMIT 1),
    (SELECT COALESCE(tpc.frais_entree, tpc.taux)
       FROM taux_produit_compagnie tpc
      WHERE tpc.produit_id   = d.produit_id
        AND tpc.compagnie_id = d.compagnie_id
        AND COALESCE(tpc.actif, true) = true
      ORDER BY tpc.taux DESC NULLS LAST
      LIMIT 1),
    CASE
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE 'SCPI' THEN 0.06
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE 'PE' THEN 0.03
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE '%CAV%' THEN 0.01
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE '%CAPI%' THEN 0.01
      ELSE NULL
    END
  ) AS taux_commission,
  COALESCE(d.montant, 0) * COALESCE(
    (SELECT COALESCE(tpc.frais_entree, tpc.taux)
       FROM taux_produit_compagnie tpc
      WHERE tpc.id = d.taux_produit_compagnie_id
        AND COALESCE(tpc.actif, true) = true
      LIMIT 1),
    (SELECT COALESCE(tpc.frais_entree, tpc.taux)
       FROM taux_produit_compagnie tpc
      WHERE tpc.produit_id   = d.produit_id
        AND tpc.compagnie_id = d.compagnie_id
        AND COALESCE(tpc.actif, true) = true
      ORDER BY tpc.taux DESC NULLS LAST
      LIMIT 1),
    CASE
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE 'SCPI' THEN 0.06
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE 'PE' THEN 0.03
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE '%CAV%' THEN 0.01
      WHEN (SELECT p.categorie FROM produits p WHERE p.id = d.produit_id) ILIKE '%CAPI%' THEN 0.01
      ELSE 0
    END
  ) AS commission_brute,
  NOW() AS calculated_at
FROM dossiers d
LEFT JOIN commissions c ON c.dossier_id = d.id
WHERE c.dossier_id IS NULL;

-- =============================================================
-- Dépendance d'ordre :
--   Ce script DOIT être joué APRÈS `add-taux-entree-encours.sql`
--   (sinon la référence à `tpc.frais_entree` casse).
-- =============================================================

-- =============================================================
-- Smoke tests
-- =============================================================
-- 1. Vérifier qu'aucun dossier n'a de commission manquante :
-- SELECT COUNT(*) FROM dossiers d
-- LEFT JOIN commissions c ON c.dossier_id = d.id
-- WHERE c.dossier_id IS NULL;
-- Attendu : 0.
--
-- 2. Vérifier les dossiers historiques signalés :
-- SELECT d.id, d.montant, c.taux_commission, c.commission_brute
-- FROM   dossiers d
-- LEFT JOIN commissions c ON c.dossier_id = d.id
-- WHERE  UPPER(LEFT(d.id::TEXT, 8)) IN ('2A312B54','9816C1CF','FE8AFA25');
-- Attendu : 3 lignes, chacune avec taux et commission_brute renseignés.
--
-- 3. Vérifier les dossiers de Marion Freret (consultante probable) :
-- SELECT d.id, d.montant, c.taux_commission, c.commission_brute
-- FROM   dossiers d
-- JOIN   consultants co ON co.id = d.consultant_id
-- LEFT JOIN commissions c ON c.dossier_id = d.id
-- WHERE  co.prenom ILIKE 'marion' AND co.nom ILIKE 'freret';

-- =============================================================
-- ROLLBACK
-- =============================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_dossiers_init_commissions ON public.dossiers;
-- DROP FUNCTION IF EXISTS public.fn_init_commissions_for_dossier();
-- -- Le backfill ne se défait pas trivialement ; faire un snapshot
-- -- `commissions` avant si besoin de rollback des lignes auto-créées.
-- COMMIT;
