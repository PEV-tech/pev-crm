# Dossier Detail Page - Commission Taux Modifications

## Changes Made

### 1. SQL Script Created: `scripts/add-taux-gestion.sql`
- Adds `taux_gestion` column to `commissions` table (DECIMAL 6,5, nullable)
- Updates `v_dossiers_complets` view to include:
  - `taux_gestion` from commissions
  - `taux_remuneration` from consultants
  - `client_id`, `client_email`, `client_telephone` fields for completeness
  - `consultant_id` for consistency

### 2. TypeScript Component: `src/app/dashboard/dossiers/[id]/dossier-detail-wrapper.tsx`

#### New State Variables Added
- `editingTaux: boolean` - Controls edit mode for taux
- `editTauxEntree: string` - Edit value for entry fee percentage
- `editTauxGestion: string` - Edit value for management fee percentage
- `savingTaux: boolean` - Loading state for taux save operation
- `consultantTauxRemuneration: number | null` - Consultant's share percentage from DB

#### fetchAll Effect Enhanced
- Fetches `taux_remuneration` from view and stores in state
- Initializes `editTauxEntree` and `editTauxGestion` with current commission values (as percentages)

#### New Handler: `handleSaveTaux()`
- Converts percentage inputs to decimals
- Updates commissions table with:
  - `taux_commission` = editTauxEntree / 100
  - `commission_brute` = montant × (editTauxEntree / 100)
  - `rem_apporteur` = commission_brute × consultantTauxRemuneration
  - `part_cabinet` = commission_brute - rem_apporteur
  - `pct_cabinet` = part_cabinet / commission_brute (or 0)
  - `taux_gestion` = editTauxGestion / 100 (if provided)
- Refreshes dossier data after save

#### Fixed Calculations
1. **quarterlyEncoursCommission useMemo**:
   - Changed from: `(annual * (rem_apporteur / commission_brute)) / 4`
   - Changed to: `(montant * tauxGestion * consultantTauxRemuneration) / 4`
   - Uses actual taux_remuneration instead of derived ratio

2. **partConsultantEntree useMemo**:
   - Changed from: `entreeFromGrille * (rem_apporteur / commission_brute)`
   - Changed to: `entreeFromGrille * consultantTauxRemuneration`
   - Uses actual taux_remuneration directly

#### UI Enhancements
1. **Commission Card Header**:
   - Added "Modifier les taux" button (visible to all users)
   - Shows edit/save UI in header

2. **Taux Editing Section** (new card in commission details):
   - Amber background for visibility
   - Input fields for:
     - Taux d'entrée (%) - always shown
     - Taux de gestion (%) - only for PE/CAPI LUX/CAV LUX products
   - Shows grille default alongside edit field
   - Cancel and Save buttons with loading state

3. **Commission Display (Manager View)**:
   - Entry section: Shows taux with comparison
     - If custom taux differs from grille: "Grille: X% → Appliqué: Y%"
     - If same as grille: "Taux appliqué: X%"
   - Part consultant: Shows calculation basis (% of commission)
   - Encours section: Similar taux display with grille comparison
   - Part consultant for encours now correctly calculated using taux_remuneration

### 3. Key Features
- Taux editing available to all users (consultants can negotiate different rates)
- Automatic recalculation of all commission-related fields on save
- Clear visual distinction between grille defaults and applied rates
- Proper handling of PE/CAPI LUX/CAV LUX products with encours calculations
- Data consistency: all related commission fields updated together
- View refresh after save ensures data consistency

### 4. Database Requirements
- Must run `scripts/add-taux-gestion.sql` in Supabase before deploying
- Adds nullable column (backward compatible)
- Updates view with new fields

## Testing Checklist
- [ ] Load dossier detail page for products with/without encours
- [ ] Verify taux values display correctly (consultant and manager views)
- [ ] Test editing taux entry (all products)
- [ ] Test editing taux gestion (PE/CAPI LUX/CAV LUX only)
- [ ] Verify commission_brute recalculates correctly
- [ ] Verify rem_apporteur uses taux_remuneration correctly
- [ ] Verify part_cabinet calculation
- [ ] Test grille vs applied taux display
- [ ] Verify consultant quarterly encours calculation uses taux_remuneration
