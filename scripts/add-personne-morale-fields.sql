-- =====================================================
-- FEATURE : Personne morale (PM) — fiche client pour societes
-- Date : 2026-04-20
-- Context : CDC Ethique Patrimoine — une fiche client peut etre soit une
--           personne physique (PP, par defaut), soit une personne morale (PM).
--           Les PM couvrent deux cas :
--           1. Societes titulaires en direct (SCI/SASU/holding qui souscrivent
--              elles-memes un contrat).
--           2. Societes detenues dans le patrimoine d'un client physique (parts
--              sociales, dividendes). Dans ce cas la PM est une fiche client a
--              part entiere liee via client_relations (type_relation='associe').
--
-- Approche : on etend la table clients plutot que de creer une table dediee,
-- pour beneficier immediatement de toute l'infrastructure existante (RLS,
-- dossiers, client_relations, search, audit, etc.).
-- =====================================================
--
-- Nouveaux champs clients :
--   - type_personne : discriminant 'physique' (defaut) | 'morale'
--   - raison_sociale : nom juridique de la PM (remplace nom+prenom pour PM)
--   - forme_juridique : SCI, SASU, SARL, SAS, SA, SCP, SCPI, etc. (texte libre
--     pour souplesse, UI propose une liste)
--   - siren : numero SIREN 9 chiffres
--   - siret : numero SIRET 14 chiffres (optionnel, siren suffit pour l'entite)
--   - representant_legal_id : FK -> clients (une PP qui represente la PM). Un
--     client PP peut representer plusieurs PM.
--   - capital_social : numeric(15,2) euros
--   - date_creation : date de constitution de la societe
--
-- Retro-compat : type_personne a une valeur par defaut 'physique', donc
-- toutes les fiches existantes restent valides sans backfill.
--
-- Contrainte : le champ nom de clients reste NOT NULL. Pour une PM, la
-- convention applicative est de stocker la raison_sociale dans nom pour que
-- la recherche et l'affichage par defaut continuent a fonctionner. Le champ
-- raison_sociale sert de source de verite et peut etre synchronise cote
-- frontend.
--
-- RLS : les policies existantes sur clients continuent de s'appliquer sans
-- modification (elles ne distinguent pas PP/PM).
--
-- Idempotent : toutes les ADD COLUMN et CREATE INDEX sont gardes par IF NOT
-- EXISTS. Pas de CHECK constraint ajoute ici pour eviter de bloquer un
-- re-run ; la validation de type_personne est portee cote applicatif.
-- =====================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS type_personne TEXT NOT NULL DEFAULT 'physique';

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS raison_sociale TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS forme_juridique TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS siren TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS siret TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS representant_legal_id UUID REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS capital_social NUMERIC(15, 2);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS date_creation DATE;

CREATE INDEX IF NOT EXISTS idx_clients_type_personne ON clients(type_personne);
CREATE INDEX IF NOT EXISTS idx_clients_representant_legal_id ON clients(representant_legal_id);

-- Smoke test :
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'clients'
--   AND column_name IN ('type_personne', 'raison_sociale', 'forme_juridique',
--                       'siren', 'siret', 'representant_legal_id',
--                       'capital_social', 'date_creation')
-- ORDER BY column_name;
