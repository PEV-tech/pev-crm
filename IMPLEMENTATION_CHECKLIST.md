# Implementation Checklist - Commission Taux Editing

## Files Changed

### SQL Migration
- [x] `scripts/add-taux-gestion.sql` - Created
  - Adds taux_gestion column to commissions table
  - Updates v_dossiers_complets view with new fields

### TypeScript Component
- [x] `src/app/dashboard/dossiers/[id]/dossier-detail-wrapper.tsx` - Modified

## Feature Completion

### 1. Fetch Consultant Share Percentage
- [x] Fetch `taux_remuneration` from `consultants` table (via view)
- [x] Store in `consultantTauxRemuneration` state
- [x] Initialize edit fields with current taux values (as percentages)

### 2. Editable Taux UI
- [x] "Modifier les taux" button in commission card header
- [x] Edit mode toggle with visual feedback (amber background)
- [x] Input fields for:
  - [x] Taux d'entrée (always shown)
  - [x] Taux de gestion (only for PE/CAPI LUX/CAV LUX)
- [x] Show grille defaults alongside inputs
- [x] Cancel and Save buttons with loading state

### 3. Save Handler
- [x] Convert percentages to decimals
- [x] Calculate `commission_brute` = montant × taux
- [x] Calculate `rem_apporteur` = commission_brute × consultantTauxRemuneration
- [x] Calculate `part_cabinet` = commission_brute - rem_apporteur
- [x] Calculate `pct_cabinet` = part_cabinet / commission_brute
- [x] Save all values to commissions table
- [x] Refresh dossier data after save

### 4. Commission Display (Manager View)
- [x] Entry section:
  - [x] Show applied taux clearly
  - [x] Show grille vs applied comparison when different
  - [x] Show part consultant with percentage basis
- [x] Encours section:
  - [x] Show applied taux clearly
  - [x] Show grille vs applied comparison when different
  - [x] Show quarterly part consultant

### 5. Commission Calculations - FIXED
- [x] quarterlyEncoursCommission:
  - [x] Old: (annual × (rem_apporteur / commission_brute)) / 4
  - [x] New: (montant × tauxGestion × consultantTauxRemuneration) / 4
  - [x] Uses actual taux_remuneration instead of derived ratio

- [x] partConsultantEntree:
  - [x] Old: entreeFromGrille × (rem_apporteur / commission_brute)
  - [x] New: entreeFromGrille × consultantTauxRemuneration
  - [x] Uses actual taux_remuneration directly

### 6. React Hooks Rules
- [x] All useState hooks before early returns
- [x] All useMemo hooks before early returns
- [x] Proper dependency arrays in useEffect and useMemo
- [x] fetchAll effect properly structured

### 7. Database Compatibility
- [x] taux_gestion column is nullable (backward compatible)
- [x] View includes all required fields
- [x] View includes consultant.taux_remuneration
- [x] View includes commission.taux_gestion

## Code Quality
- [x] No TypeScript errors in component
- [x] Build succeeds without errors
- [x] Proper error handling in save handler
- [x] Loading states for async operations
- [x] User feedback (error messages, visual states)

## Data Integrity
- [x] All commission fields updated together
- [x] No orphaned/inconsistent data
- [x] View refresh ensures consistency
- [x] Consultant share uses correct percentage

## Testing Recommendations
1. Test with dossier that has no commission data yet
2. Test editing entry taux for standard products
3. Test editing both taux for PE/CAPI LUX/CAV LUX
4. Verify consultant view shows correct quarterly encours
5. Verify manager view shows grille vs applied comparison
6. Test with different consultantTauxRemuneration values (0.5, 0.6, 0.7)
7. Verify part_cabinet calculations
8. Test error scenarios (invalid input, save failure)

## Deployment Notes
1. Run SQL migration FIRST
2. Deploy updated component
3. No downtime required (backward compatible)
4. Existing dossiers unaffected until taux is edited
5. Both entry and encours taux can be edited independently

## Database Fields Updated by Save
When user saves taux changes:
- commissions.taux_commission (entry taux)
- commissions.commission_brute (recalculated)
- commissions.rem_apporteur (recalculated)
- commissions.part_cabinet (recalculated)
- commissions.pct_cabinet (recalculated)
- commissions.taux_gestion (if encours product)

All other commission fields remain unchanged.
