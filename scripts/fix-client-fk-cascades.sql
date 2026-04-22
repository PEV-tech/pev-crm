-- Correction structurelle des contraintes FK qui bloquent la suppression
-- des fiches clients (typiquement les fiches jointes « & »).
--
-- À appliquer APRÈS avoir lancé inspect-client-fk-constraints.sql et
-- vérifié que les delete_rule sont bien « NO ACTION » ou « RESTRICT ».
--
-- Règles métier :
--   - Tables « légères » (pas de valeur historique) → ON DELETE CASCADE.
--     Si on supprime un client, on perd ses PJ, commentaires, RDV, relances.
--   - Tables « financières » (dossiers, commissions, factures, encaissements)
--     → RESTRICT conservé. On n'efface jamais un client qui a encore
--     des dossiers rattachés. Il faut d'abord :
--       (a) dissocier les couples « & » en deux fiches autonomes ;
--       (b) réaffecter chaque dossier à la fiche pertinente ;
--       (c) puis supprimer la fiche jointe, qui n'a plus d'enfants financiers.
--
-- Idempotent (DROP IF EXISTS + ADD). Zero-downtime.

BEGIN;

-- client_pj : pièces jointes sur fiche client (CDC §03) → CASCADE
ALTER TABLE public.client_pj
  DROP CONSTRAINT IF EXISTS client_pj_client_id_fkey;
ALTER TABLE public.client_pj
  ADD  CONSTRAINT client_pj_client_id_fkey
       FOREIGN KEY (client_id) REFERENCES public.clients(id)
       ON DELETE CASCADE;

-- client_commentaires : commentaires libres → CASCADE
ALTER TABLE public.client_commentaires
  DROP CONSTRAINT IF EXISTS client_commentaires_client_id_fkey;
ALTER TABLE public.client_commentaires
  ADD  CONSTRAINT client_commentaires_client_id_fkey
       FOREIGN KEY (client_id) REFERENCES public.clients(id)
       ON DELETE CASCADE;

-- rendez_vous : agenda CGP → CASCADE
ALTER TABLE public.rendez_vous
  DROP CONSTRAINT IF EXISTS rendez_vous_client_id_fkey;
ALTER TABLE public.rendez_vous
  ADD  CONSTRAINT rendez_vous_client_id_fkey
       FOREIGN KEY (client_id) REFERENCES public.clients(id)
       ON DELETE CASCADE;

-- relances : relances manuelles/dérivées → CASCADE
-- Attention : les relances dérivées sont normalement liées à un dossier,
-- pas à un client directement. Si votre schéma `relances` n'a pas de
-- colonne client_id, retirer ce bloc.
-- ALTER TABLE public.relances
--   DROP CONSTRAINT IF EXISTS relances_client_id_fkey;
-- ALTER TABLE public.relances
--   ADD  CONSTRAINT relances_client_id_fkey
--        FOREIGN KEY (client_id) REFERENCES public.clients(id)
--        ON DELETE CASCADE;

-- dossiers : table critique → on conserve RESTRICT (comportement par défaut)
-- mais on documente le choix. Aucune ALTER ici.
--
-- Si plus tard on veut forcer la dissociation automatique, il faudra
-- un trigger qui redirige dossiers.client_id vers un client « orphelin »
-- avant la suppression, pas un CASCADE qui perdrait la trace comptable.

COMMIT;

-- Smoke test après apply :
--   SELECT constraint_name, delete_rule FROM information_schema.referential_constraints
--    WHERE constraint_name IN (
--      'client_pj_client_id_fkey',
--      'client_commentaires_client_id_fkey',
--      'rendez_vous_client_id_fkey'
--    );
--   → attendu : delete_rule = 'CASCADE' pour les 3.
