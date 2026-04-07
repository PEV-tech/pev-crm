-- Grille frais d'entrée (LUX / PE)
-- Insère les grilles si elles n'existent pas encore
-- Source : grille Maxine (avril 2026)

-- Vérifier d'abord si des grilles 'entree' existent
-- Si oui, les mettre à jour. Sinon, les insérer.

-- Supprimer les anciennes grilles d'entrée (pour éviter les doublons)
DELETE FROM grilles_frais WHERE type_frais = 'entree';

-- Insérer les grilles frais d'entrée
INSERT INTO grilles_frais (type_frais, encours_min, encours_max, taux, actif) VALUES
  ('entree', 50000,  124999, 0.0150, true),   -- 1.50%
  ('entree', 125000, 249999, 0.0125, true),   -- 1.25%
  ('entree', 250000, 499999, 0.0100, true),   -- 1.00%
  ('entree', 500000, 749999, 0.0075, true),   -- 0.75%
  ('entree', 750000, 999999, 0.0060, true),   -- 0.60%
  ('entree', 1000000, NULL,  0.0025, true);   -- 0.25%

-- Vérifier/mettre à jour les grilles de gestion (si besoin)
DELETE FROM grilles_frais WHERE type_frais = 'gestion';

INSERT INTO grilles_frais (type_frais, encours_min, encours_max, taux, actif) VALUES
  ('gestion', 50000,  124999, 0.0120, true),   -- 1.20%
  ('gestion', 125000, 249999, 0.0110, true),   -- 1.10%
  ('gestion', 250000, 499999, 0.0105, true),   -- 1.05%
  ('gestion', 500000, 749999, 0.0100, true),   -- 1.00%
  ('gestion', 750000, 999999, 0.0095, true),   -- 0.95%
  ('gestion', 1000000, NULL,  0.0090, true);   -- 0.90%

-- Vérification
SELECT type_frais, encours_min, encours_max, taux * 100 as taux_pct, actif
FROM grilles_frais
ORDER BY type_frais, encours_min;
