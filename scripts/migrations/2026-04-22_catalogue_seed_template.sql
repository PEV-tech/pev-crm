-- Migration (SEED OPTIONNEL): template de catalogue Compagnie → Produits
-- Date: 2026-04-22
-- Context: retour Maxine — la vue Catalogue doit être groupée par compagnie,
--          avec les produits comme sous-catégories (ex: ALDERAN → ActivImmo + Comète).
--          Ce fichier est un TEMPLATE : seed ON CONFLICT DO NOTHING, donc 100%
--          safe à relancer. Maxine valide/édite ensuite la liste depuis l'UI
--          Paramètres > Catalogue.
--
-- Couvre les compagnies françaises les plus fréquentes en gestion privée :
--   · SCPI : Alderan, Corum AM, Perial AM, Primonial REIM, Sofidy,
--            La Française REM, Atland Voisin, Paref Gestion, Iroko, Remake
--   · Private Equity / Non-coté : Eurazeo, Ardian, Altaroc, Archinvest,
--            123 IM, Peqan
--   · CAPI / CAV Luxembourg : Generali Espace Lux Vie, Cardif Luxembourg Vie,
--            Lombard International, Swiss Life Luxembourg
--
-- IMPORTANT : ces noms de produits sont donnés à titre indicatif. Ils
-- représentent des véhicules réellement distribués en 2025-2026 mais Maxine
-- doit valider ceux que PEV distribue réellement avant mise en production.

BEGIN;

-- =============================================================
-- 1) Compagnies (INSERT ON CONFLICT NOM DO NOTHING)
--    Hypothèse : contrainte UNIQUE sur compagnies.nom. Si absente,
--    remplacer `ON CONFLICT (nom) DO NOTHING` par un WHERE NOT EXISTS.
-- =============================================================

-- SCPI
INSERT INTO public.compagnies (nom) VALUES ('Alderan')          ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Corum AM')         ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Perial AM')        ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Primonial REIM')   ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Sofidy')           ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('La Française REM') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Atland Voisin')    ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Paref Gestion')    ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Iroko')            ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Remake AM')        ON CONFLICT (nom) DO NOTHING;

-- Private Equity
INSERT INTO public.compagnies (nom) VALUES ('Eurazeo')          ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Ardian')           ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Altaroc')          ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Archinvest')       ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('123 IM')           ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Peqan')            ON CONFLICT (nom) DO NOTHING;

-- CAPI / CAV Luxembourg
INSERT INTO public.compagnies (nom) VALUES ('Generali Luxembourg')      ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Cardif Luxembourg Vie')    ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Lombard International')    ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.compagnies (nom) VALUES ('Swiss Life Luxembourg')    ON CONFLICT (nom) DO NOTHING;

-- =============================================================
-- 2) Produits (INSERT ON CONFLICT nom DO NOTHING)
--    Hypothèse : contrainte UNIQUE sur produits.nom.
-- =============================================================

-- Alderan
INSERT INTO public.produits (nom, categorie) VALUES ('ActivImmo', 'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Comète',    'SCPI') ON CONFLICT (nom) DO NOTHING;

-- Corum AM
INSERT INTO public.produits (nom, categorie) VALUES ('Corum Origin', 'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Corum XL',     'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Corum Eurion', 'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Corum USA',    'SCPI') ON CONFLICT (nom) DO NOTHING;

-- Perial AM
INSERT INTO public.produits (nom, categorie) VALUES ('PFO2',                   'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('PF Grand Paris',         'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('PF Hospitalité Europe',  'SCPI') ON CONFLICT (nom) DO NOTHING;

-- Primonial REIM
INSERT INTO public.produits (nom, categorie) VALUES ('Primovie',          'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Patrimmo Commerce', 'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Primopierre',       'SCPI') ON CONFLICT (nom) DO NOTHING;

-- Sofidy
INSERT INTO public.produits (nom, categorie) VALUES ('Immorente',   'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Efimmo 1',    'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Sofidy Europe Invest', 'SCPI') ON CONFLICT (nom) DO NOTHING;

-- La Française REM
INSERT INTO public.produits (nom, categorie) VALUES ('LF Europimmo',        'SCPI') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('LF Grand Paris Patrimoine', 'SCPI') ON CONFLICT (nom) DO NOTHING;

-- Atland Voisin
INSERT INTO public.produits (nom, categorie) VALUES ('Épargne Pierre', 'SCPI') ON CONFLICT (nom) DO NOTHING;

-- Paref Gestion
INSERT INTO public.produits (nom, categorie) VALUES ('Novaxia Neo', 'SCPI') ON CONFLICT (nom) DO NOTHING;

-- Iroko
INSERT INTO public.produits (nom, categorie) VALUES ('Iroko Zen', 'SCPI') ON CONFLICT (nom) DO NOTHING;

-- Remake AM
INSERT INTO public.produits (nom, categorie) VALUES ('Remake Live', 'SCPI') ON CONFLICT (nom) DO NOTHING;

-- Private Equity
INSERT INTO public.produits (nom, categorie) VALUES ('Eurazeo Private Value Europe 3', 'PE') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Ardian Access',     'PE') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Altaroc Odyssey',   'PE') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Archinvest Select', 'PE') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('123 Corporate',     'PE') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Peqan Co-Invest',   'PE') ON CONFLICT (nom) DO NOTHING;

-- CAPI / CAV Luxembourg
INSERT INTO public.produits (nom, categorie) VALUES ('Espace Lux Vie',       'CAPI_LUX') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Cardif Lux Vie',       'CAPI_LUX') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Lombard PPLI',         'CAPI_LUX') ON CONFLICT (nom) DO NOTHING;
INSERT INTO public.produits (nom, categorie) VALUES ('Swiss Life Liberté',   'CAPI_LUX') ON CONFLICT (nom) DO NOTHING;

-- =============================================================
-- 3) Liaisons compagnie × produit (taux_produit_compagnie)
--    Crée les couples vides (taux/frais à remplir depuis l'UI).
-- =============================================================

-- Helper : insérer le couple si absent.
-- (Pas de UNIQUE sur (compagnie_id, produit_id) dans le schéma actuel,
--  donc on passe par un WHERE NOT EXISTS.)

INSERT INTO public.taux_produit_compagnie (compagnie_id, produit_id)
SELECT c.id, p.id
  FROM public.compagnies c
  JOIN public.produits   p ON (c.nom, p.nom) IN (
    -- Alderan
    ('Alderan',          'ActivImmo'),
    ('Alderan',          'Comète'),
    -- Corum AM
    ('Corum AM',         'Corum Origin'),
    ('Corum AM',         'Corum XL'),
    ('Corum AM',         'Corum Eurion'),
    ('Corum AM',         'Corum USA'),
    -- Perial AM
    ('Perial AM',        'PFO2'),
    ('Perial AM',        'PF Grand Paris'),
    ('Perial AM',        'PF Hospitalité Europe'),
    -- Primonial REIM
    ('Primonial REIM',   'Primovie'),
    ('Primonial REIM',   'Patrimmo Commerce'),
    ('Primonial REIM',   'Primopierre'),
    -- Sofidy
    ('Sofidy',           'Immorente'),
    ('Sofidy',           'Efimmo 1'),
    ('Sofidy',           'Sofidy Europe Invest'),
    -- La Française REM
    ('La Française REM', 'LF Europimmo'),
    ('La Française REM', 'LF Grand Paris Patrimoine'),
    -- Atland Voisin
    ('Atland Voisin',    'Épargne Pierre'),
    -- Paref Gestion
    ('Paref Gestion',    'Novaxia Neo'),
    -- Iroko
    ('Iroko',            'Iroko Zen'),
    -- Remake AM
    ('Remake AM',        'Remake Live'),
    -- Private Equity
    ('Eurazeo',          'Eurazeo Private Value Europe 3'),
    ('Ardian',           'Ardian Access'),
    ('Altaroc',          'Altaroc Odyssey'),
    ('Archinvest',       'Archinvest Select'),
    ('123 IM',           '123 Corporate'),
    ('Peqan',            'Peqan Co-Invest'),
    -- CAPI / CAV Luxembourg
    ('Generali Luxembourg',    'Espace Lux Vie'),
    ('Cardif Luxembourg Vie',  'Cardif Lux Vie'),
    ('Lombard International',  'Lombard PPLI'),
    ('Swiss Life Luxembourg',  'Swiss Life Liberté')
  )
 WHERE NOT EXISTS (
   SELECT 1 FROM public.taux_produit_compagnie t
    WHERE t.compagnie_id = c.id AND t.produit_id = p.id
 );

COMMIT;

-- =============================================================
-- ROLLBACK (partiel — ne supprime que les liaisons, pas les compagnies /
-- produits qui pourraient déjà être utilisés ailleurs)
-- =============================================================
-- BEGIN;
-- DELETE FROM public.taux_produit_compagnie
--  WHERE (compagnie_id, produit_id) IN (
--    SELECT c.id, p.id FROM public.compagnies c JOIN public.produits p ON ...
--  );
-- COMMIT;
