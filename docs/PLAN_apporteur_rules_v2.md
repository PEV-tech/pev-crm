# Plan — Apporteur d'affaires V2 (règles produit-aware)

**Date** : 2026-04-27
**Driver** : Onboarding Yoann Pouliquen (1% SCPI / 6 mois encours CAV+LUX / 25% frais entrée PE)
**Décisions cadrées** :
- Encours 6 mois s'applique à **CAV + LUX** (pas Capi)
- Versement apporteur **one-shot à la validation souscription** (pas étalé)
- Déduction **de la commission brute** avant split consultant/cabinet (statu quo)

---

## 1. Spec des règles de calcul

Une règle apporteur = `(apporteur, catégorie produit, type de frais, paramètre)`.

| Catégorie | Type frais | Paramètre | Formule (Yoann) |
|---|---|---|---|
| SCPI | `entry_pct_montant` | 1 % | `montant × 1%` |
| PE | `entry_pct_frais` | 25 % | `montant × frais_entree_catalogue × 25%` |
| CAV_CAPI | `encours_oneshot_months` | 6 mois | `montant × frais_encours_catalogue × N` où N = 6 si mensuel, 2 si trimestriel (périodicité lue sur la compagnie) |

> **Note catégories** : le codebase normalise CAV / CAPI / CAV LUX / CAPI LUX vers la clé canonique `CAV_CAPI` (cf. `normalizeCategorieForDefaults` dans `src/lib/commissions/default-grilles.ts`). La règle 6-mois s'applique donc à TOUS les contrats CAV/CAPI quelle que soit la domiciliation (FR ou LUX) — une seule règle suffit.

**Précisions sur l'assiette** :
- `entry_pct_montant` (SCPI) : assiette = `dossier.montant`
- `entry_pct_frais` (PE) : assiette = `dossier.montant × taux_produit_compagnie.frais_entree / 100` (les frais d'entrée catalogue, dérivés)
- `encours_oneshot_months` : assiette = `dossier.montant × taux_produit_compagnie.frais_encours / 100` × N où N est dérivé de `compagnies.encours_periodicite`

`encours_estime_periodique` = `montant_souscription × frais_encours_periodique` (rate déjà connu via `taux_produit_compagnie.frais_encours`).

---

## 2. Schéma DB — migration SQL

**Fichier** : `scripts/migrations/2026-04-27_apporteur_rules_v2.sql`

```sql
-- 2.1 Périodicité encours au niveau Compagnie (uniforme pour toute la compagnie)
ALTER TABLE compagnies
  ADD COLUMN encours_periodicite text
    CHECK (encours_periodicite IN ('mensuel', 'trimestriel')) DEFAULT 'trimestriel';

-- 2.2 Règles de rémunération apporteur
CREATE TABLE apporteur_compensation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apporteur_id uuid NOT NULL REFERENCES apporteurs(id) ON DELETE CASCADE,
  product_category text NOT NULL CHECK (product_category IN ('SCPI', 'PE', 'CAV', 'LUX')),
  rule_type text NOT NULL CHECK (rule_type IN ('entry_pct_montant', 'entry_pct_frais', 'encours_oneshot_months')),
  rate_pct numeric(6,3),         -- pour entry_pct_* : 1.000 (SCPI), 25.000 (PE)
  encours_months smallint,        -- pour encours_oneshot_months : 6
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (apporteur_id, product_category)
);

-- 2.3 Champs commissions split apporteur (granularité par règle)
ALTER TABLE commissions
  ADD COLUMN rem_apporteur_entry numeric(12,2) DEFAULT 0,
  ADD COLUMN rem_apporteur_encours_oneshot numeric(12,2) DEFAULT 0;
-- rem_apporteur_ext devient une vue calculée = entry + encours_oneshot pour rétro-compat

-- 2.4 RLS (managers/back-office CRUD, tous lecture)
ALTER TABLE apporteur_compensation_rules ENABLE ROW LEVEL SECURITY;
-- policies analogues à apporteurs
```

**Migration des apporteurs existants** : Yoann + ceux déjà créés avec `taux_commission` flat. On garde `apporteurs.taux_commission` comme **fallback** si aucune règle produit n'existe (rétro-compat).

---

## 3. Logique de calcul

### Nouveau module
**`src/lib/commissions/apporteur-rules.ts`** :
```ts
export async function computeApporteurFee(args: {
  apporteurId: string
  dossier: Dossier   // contient produit_categorie, montant, frais_entree, periodicite
  tauxProduitCompagnie: TauxProduitCompagnie
}): Promise<{ entry: number; encoursOneshot: number; total: number }>
```

Logique :
1. Charger les rules actives pour `apporteurId + dossier.produit_categorie`
2. Si `entry_pct` → `montant × rate_pct/100` (PE : utiliser frais_entree spécifique)
3. Si `encours_oneshot_months` → `montant × frais_encours/100 × N` (N = 6 si mensuel, 2 si trimestriel)
4. Fallback : si aucune rule, utiliser `apporteur.taux_commission` × `montant` (comportement V1)

### Intégration
- **`src/lib/commissions/entree-split.ts`** : remplacer la déduction flat `rem_apporteur_ext` par appel à `computeApporteurFee`. Stocker `rem_apporteur_entry` et `rem_apporteur_encours_oneshot` séparément dans la commission.
- **`src/lib/encours/allocation.ts`** : **AUCUN CHANGEMENT** côté allocation (le one-shot est déduit en amont, pas pendant les encours périodiques).

---

## 4. UI Paramètres → Rémunération → Apporteurs

**Route** : `/dashboard/parametres?tab=remuneration&subtab=apporteurs`
**Fichier** : `src/app/dashboard/parametres/_tabs/apporteurs-section.tsx`
**Pattern** : reprendre la structure de `commission-splits-tab.tsx` (PR #53).

Contenu :
- Liste des apporteurs (table : nom, prénom, # règles actives, # dossiers liés)
- Bouton "Ajouter apporteur" → modal avec formulaire 4 règles pré-remplies (SCPI / PE / CAV / LUX), désactivables
- Édition inline d'une règle existante
- Restreint aux managers (mêmes RLS que Splits)

Form Yoann — préset proposé :
```
SCPI    | entry_pct              | 1.000 %
PE      | entry_pct              | 25.000 %  (s'applique à frais_entree)
CAV     | encours_oneshot_months | 6 mois
LUX     | encours_oneshot_months | 6 mois
```

---

## 5. UI Catalogue — périodicité encours (par Compagnie)

**Fichier** : `src/app/dashboard/parametres/_tabs/catalogue-section.tsx`
Ajouter un champ **Périodicité encours** (Mensuel / Trimestriel) sur la fiche Compagnie (un seul champ par compagnie, pas par produit). Default = Trimestriel pour ne pas casser l'existant. À renseigner manuellement par Maxine pour les compagnies CAV/LUX concernées.

---

## 6. UI Dossier Detail — modal apporteur

**Fichier** : `src/app/dashboard/dossiers/[id]/dossier-detail-wrapper.tsx`
- À la sélection de l'apporteur, calculer en preview le montant qui lui reviendra (basé sur produit + montant du dossier).
- Affichage : `"Yoann Pouliquen — 1% SCPI = 3 000 € (preview)"` sous le dropdown.

---

## 7. Tests Vitest

**Fichier** : `tests/unit/commissions/apporteur-rules.spec.ts`

Cas à couvrir :
1. SCPI 300k + Yoann → 3 000 € en `rem_apporteur_entry`
2. PE 100k, frais entrée 5% (5 000 €), Yoann → 1 250 € (25%) en `rem_apporteur_entry`
3. CAV 200k mensuel, frais encours 0,1%/mois, Yoann → 200 × 0,001 × 6 = 1 200 € en `rem_apporteur_encours_oneshot`
4. LUX 500k trimestriel, frais encours 0,3%/trim, Yoann → 500k × 0,003 × 2 = 3 000 €
5. Apporteur sans règle produit → fallback `taux_commission` flat (V1)
6. Dossier sans apporteur → tous les champs = 0

---

## 8. Backfill Yoann

1. Créer Yoann via UI (Paramètres → Apporteurs → Ajouter)
2. Renseigner les 4 règles (1/25/6/6)
3. Renseigner périodicité encours sur compagnies CAV/LUX dans Catalogue
4. Liste des dossiers historiques apportés par Yoann à attacher manuellement (à fournir par Maxine)

---

## 9. Estimation & ordre

| Étape | Effort | PR |
|---|---|---|
| Migration SQL (§2) | 0,5j | PR #N |
| Logique `apporteur-rules.ts` + intégration `entree-split` | 1,5j | PR #N+1 |
| UI Paramètres Apporteurs (§4) | 1,5j | PR #N+2 |
| UI Catalogue périodicité (§5) | 0,5j | PR #N+3 |
| UI Dossier preview (§6) | 0,5j | PR #N+3 |
| Tests Vitest (§7) | 0,5j | PR #N+4 |
| Backfill Yoann (§8) | manuel | — |

**Total** : ~5 jours dev + saisie data.

---

## 10. Arbitrages confirmés (2026-04-27)

- ✅ **Frais d'entrée PE** : pas de champ dédié sur le dossier. Calcul dérivé `dossier.montant × taux_produit_compagnie.frais_entree`. Yoann : 25% de cette assiette.
- ✅ **Périodicité encours** : uniforme par compagnie. Champ `compagnies.encours_periodicite` (mensuel|trimestriel).
- ✅ **Catégories produit** : SCPI, PE, CAV_CAPI (3 valeurs canoniques). LUX/CAPI/CAV LUX/CAPI LUX → tous mappés vers CAV_CAPI via le normaliseur existant.
- ⏳ **Reporting "Rému Yoann sur les 12 derniers mois"** sur la page Apporteurs : reporté en V2.1.
