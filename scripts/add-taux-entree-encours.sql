-- Migration: Ajouter frais_entree et frais_encours sur taux_produit_compagnie
-- Date: 2026-04-24
-- Référence: Corrections app Étape 5 points 5.5 + 5.6 (plan 2026-04-24)
--
-- Contexte :
--   La table `taux_produit_compagnie` n'a qu'une colonne `taux` scalaire,
--   utilisée comme taux d'entrée. Elle ne permet pas de distinguer les
--   droits d'entrée (one-shot, au moment de la souscription) des droits
--   d'encours (taux annuel récurrent sur PE / CAV / CAPI). Le cas
--   signalé par Maxine (Paul Taurignan — Cedrus & Partners, PE : entrée
--   3 % OK, encours 1 % non appliqué) illustre le besoin : il faut
--   pouvoir saisir les 2 taux côté paramétrage catalogue.
--
--   Cette migration ajoute 2 colonnes nullables :
--     · frais_entree  : override du taux d'entrée (si NULL → fallback
--       sur `taux` historique, qui reste lu en priorité comme aujourd'hui).
--     · frais_encours : taux d'encours annuel (décimal, 0.01 = 1 %).
--
-- Rétro-compatibilité :
--   - Aucune lecture existante n'est cassée : `taux` reste la source
--     primaire, les deux nouvelles colonnes sont des overrides optionnels.
--   - Les types TS seront régénérés via
--     `npx supabase gen types typescript`.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS.
-- Reversible : DROP COLUMN à la main en cas de rollback (cf fin du fichier).

ALTER TABLE public.taux_produit_compagnie
  ADD COLUMN IF NOT EXISTS frais_entree  NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS frais_encours NUMERIC NULL;

COMMENT ON COLUMN public.taux_produit_compagnie.frais_entree IS
  'Droits d''entrée one-shot (décimal, ex: 0.03 = 3 %). Si NULL → fallback sur la colonne `taux` historique. Ajouté 2026-04-24 (point 5.5).';
COMMENT ON COLUMN public.taux_produit_compagnie.frais_encours IS
  'Droits d''encours annuels récurrents (décimal, ex: 0.01 = 1 %). Nullable : absence → pas d''encours sur ce couple produit×compagnie. Ajouté 2026-04-24 (point 5.5).';

-- ==============================================================
-- Seed correctif STRUCTUREL — frais_encours par catégorie produit
-- ==============================================================
-- Rappel Maxine (2026-04-24) : le cas Paul Taurignan / Cedrus & Partners
-- n'est qu'un exemple concret. Le bug "droits d'encours non appliqués"
-- touche potentiellement toutes les compagnies qui n'ont pas de taux
-- d'encours renseigné dans le catalogue. On généralise donc le seed à
-- TOUS les couples produit×compagnie dont la catégorie implique un
-- encours (PE, CAV, CAPI) et qui n'ont pas encore de frais_encours.
--
-- Valeurs retenues par catégorie (alignées sur l'arbitrage 5.6) :
--   · PE        : 0,7 % (grille par défaut PEV)
--   · CAV/CAPI  : 1 %   (grille par défaut PEV)
--   · SCPI      : 0 %   (pas d'encours sur SCPI)
--
-- Override Cedrus (cas Paul Taurignan) : 1 % (plus élevé que le
-- default PE 0,7 %). Il est appliqué AVANT le seed générique pour ne
-- pas être écrasé par lui.
--
-- Idempotent partout : WHERE frais_encours IS NULL garantit qu'aucune
-- valeur déjà saisie (notamment via l'UI catalogue) n'est écrasée.

-- (1) Override Cedrus & Partners (1 % sur PE) — en premier pour
-- prévaloir sur le default générique PE 0,7 %.
UPDATE public.taux_produit_compagnie tpc
SET    frais_encours = 0.01
FROM   public.compagnies c, public.produits p
WHERE  tpc.compagnie_id = c.id
  AND  tpc.produit_id   = p.id
  AND  (c.nom ILIKE '%cedrus%' OR c.nom ILIKE '%Cedrus & Partners%')
  AND  (p.nom ILIKE '%PE%' OR p.categorie ILIKE '%PE%' OR p.categorie ILIKE '%private equity%')
  AND  tpc.frais_encours IS NULL;

-- (2) Seed générique par catégorie (n'écrase pas Cedrus déjà à 1 %
-- grâce au WHERE IS NULL).
UPDATE public.taux_produit_compagnie tpc
SET    frais_encours = CASE
  WHEN p.categorie ILIKE 'PE' OR p.categorie ILIKE '%private equity%' THEN 0.007
  WHEN p.categorie ILIKE '%CAV%' OR p.categorie ILIKE '%CAPI%'        THEN 0.01
  ELSE NULL -- SCPI, autres : pas de seed (laissé à 0 côté calcul)
END
FROM   public.produits p
WHERE  tpc.produit_id = p.id
  AND  tpc.frais_encours IS NULL
  AND  (
        p.categorie ILIKE 'PE' OR p.categorie ILIKE '%private equity%'
     OR p.categorie ILIKE '%CAV%' OR p.categorie ILIKE '%CAPI%'
  );

-- (3) Copie défensive `taux` → `frais_entree` pour TOUTES les lignes
-- (pas juste Cedrus) : aligne les colonnes, ne casse rien.
UPDATE public.taux_produit_compagnie tpc
SET    frais_entree = tpc.taux
WHERE  tpc.frais_entree IS NULL
  AND  tpc.taux IS NOT NULL;

-- ==============================================================
-- Smoke tests (à exécuter manuellement post-migration)
-- ==============================================================
-- SELECT c.nom AS compagnie, p.nom AS produit, tpc.taux, tpc.frais_entree, tpc.frais_encours
-- FROM   public.taux_produit_compagnie tpc
-- JOIN   public.compagnies c ON c.id = tpc.compagnie_id
-- JOIN   public.produits   p ON p.id = tpc.produit_id
-- WHERE  c.nom ILIKE '%cedrus%';
-- Attendu : frais_encours = 0.01, frais_entree ≈ 0.03 (= taux).

-- ==============================================================
-- ROLLBACK
-- ==============================================================
-- BEGIN;
-- ALTER TABLE public.taux_produit_compagnie
--   DROP COLUMN IF EXISTS frais_encours,
--   DROP COLUMN IF EXISTS frais_entree;
-- COMMIT;
