-- Migration: permettre plusieurs produits du même "produit_id" (catégorie)
--            sur une même compagnie.
-- Date: 2026-04-22
-- Context: retour Maxine — "je n'arrive pas à ajouter plusieurs produits par
--          partenaire. mais j'arrive bien à ajouter quand produit dans un
--          partenaire quand il n'y a pas encore de produit chez ce partenaire".
--
--          Dans l'UI, `produit_id` pointe sur une CATÉGORIE (SCPI, PE, LUX…),
--          et le NOM du produit ("ACTIVIMMO", "COMETE", "Multi Lux Opportunités")
--          est stocké dans la colonne `description`. Donc un partenaire peut
--          parfaitement avoir plusieurs lignes avec le même produit_id (ex.
--          deux SCPI chez ALDERAN) — c'est normal et attendu.
--
--          Une contrainte UNIQUE (compagnie_id, produit_id) bloque ce cas,
--          d'où l'erreur "Ajout produit impossible" au 2ᵉ produit.
--
--          Ce script détecte dynamiquement et supprime TOUTE contrainte UNIQUE
--          (ou index unique) portant exactement sur (compagnie_id, produit_id)
--          dans `public.taux_produit_compagnie`. Si aucune n'existe, no-op.
--
-- Rollback: voir section ROLLBACK en bas (ne pas réactiver, on garde la
--           possibilité d'ajouter plusieurs produits par compagnie).

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  -- 1) Contraintes UNIQUE (au sens SQL) portant sur exactement
  --    (compagnie_id, produit_id).
  FOR r IN
    SELECT c.conname AS conname
      FROM pg_constraint c
      JOIN pg_class     t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'taux_produit_compagnie'
       AND c.contype = 'u'
       AND (
         SELECT array_agg(a.attname ORDER BY a.attname)
           FROM unnest(c.conkey) AS k(attnum)
           JOIN pg_attribute a
             ON a.attrelid = c.conrelid
            AND a.attnum   = k.attnum
       ) = ARRAY['compagnie_id','produit_id']::name[]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.taux_produit_compagnie DROP CONSTRAINT %I',
      r.conname
    );
    RAISE NOTICE 'Dropped UNIQUE constraint %', r.conname;
  END LOOP;

  -- 2) Index UNIQUE (pas rattaché à une contrainte) sur les mêmes colonnes.
  FOR r IN
    SELECT ic.relname AS indexname
      FROM pg_index       i
      JOIN pg_class       ic ON ic.oid = i.indexrelid
      JOIN pg_class       tc ON tc.oid = i.indrelid
      JOIN pg_namespace   n  ON n.oid = tc.relnamespace
     WHERE n.nspname  = 'public'
       AND tc.relname = 'taux_produit_compagnie'
       AND i.indisunique
       AND NOT i.indisprimary
       AND (
         SELECT array_agg(a.attname ORDER BY a.attname)
           FROM unnest(i.indkey::int[]) AS k(attnum)
           JOIN pg_attribute a
             ON a.attrelid = tc.oid
            AND a.attnum   = k.attnum
       ) = ARRAY['compagnie_id','produit_id']::name[]
       -- on exclut les index adossés à une contrainte déjà traitée au 1)
       AND NOT EXISTS (
         SELECT 1
           FROM pg_constraint c
          WHERE c.conindid = ic.oid
       )
  LOOP
    EXECUTE format('DROP INDEX public.%I', r.indexname);
    RAISE NOTICE 'Dropped UNIQUE index %', r.indexname;
  END LOOP;
END $$;

COMMIT;

-- =============================================================
-- ROLLBACK (non recommandé — casse la fonctionnalité multi-produits)
-- =============================================================
-- BEGIN;
-- ALTER TABLE public.taux_produit_compagnie
--   ADD CONSTRAINT taux_produit_compagnie_compagnie_produit_key
--   UNIQUE (compagnie_id, produit_id);
-- COMMIT;
