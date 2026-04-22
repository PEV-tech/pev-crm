# ADR 2026-04 — Édition des taux de commission par dossier

> Consolidation de `TECHNICAL_SUMMARY.md`, `IMPLEMENTATION_CHECKLIST.md` et `CHANGES_SUMMARY.md` (avril 2026). Les trois documents d'origine ont été supprimés en faveur de cet ADR unique.
>
> **Statut :** Implémenté et en prod. Conservé pour traçabilité de la décision.
>
> **Voir aussi :** `docs/HANDBOOK.md` §6.2 (modèle de calcul courant).

---

## Contexte

À l'origine, les taux de commission étaient calés sur la grille (`grilles_commission`), non modifiables dossier par dossier. Besoin exprimé par Maxine : permettre au consultant de **négocier des taux différents** lorsque le client le justifie, sans passer par un update SQL manuel.

Deuxième problème identifié au passage : le calcul de la part consultant utilisait un **ratio dérivé** (`rem_apporteur / commission_brute`) des dossiers historiques. Dès qu'un consultant change de palier (65 → 75 → 85 %), ce ratio devient faux pour les nouveaux calculs (quarterly encours en particulier).

## Décisions

### 1. Nouvelle colonne `commissions.taux_gestion`

Ajout d'une colonne pour stocker le taux de gestion (encours) appliqué, distinct de la grille par défaut. Nullable (rétro-compat). Concerne les produits à encours uniquement : PE, CAPI LUX, CAV LUX.

Migration : `scripts/add-taux-gestion.sql`.

### 2. Dénormalisation via la vue `v_dossiers_complets`

La vue est étendue pour exposer :
- `commissions.taux_gestion`
- `consultants.taux_remuneration`
- Les IDs et contacts client nécessaires au rendu détail (évite N+1).

Décision : **toujours lire `taux_remuneration` depuis la vue** (source `consultants`), **jamais le dériver** du ratio des dossiers historiques.

### 3. UI d'édition des taux

Bouton "Modifier les taux" sur l'en-tête de la card commission (détail dossier). Mode édition avec fond ambré pour la visibilité. Champs :
- **Taux d'entrée** (%) — toujours visible.
- **Taux de gestion** (%) — uniquement pour PE / CAPI LUX / CAV LUX.
- Affichage côte-à-côte du défaut grille et du taux appliqué.

L'utilisateur saisit des **pourcentages** (ex: `1.25` pour 1,25 %), convertis en décimales côté handler avant UPDATE.

### 4. Recalcul atomique de tous les champs dépendants

Le handler `handleSaveTaux()` recalcule dans un même UPDATE :

```
taux_commission   = editTauxEntree / 100
commission_brute  = montant × taux_commission
rem_apporteur     = commission_brute × consultant.taux_remuneration
part_cabinet      = commission_brute - rem_apporteur
pct_cabinet       = part_cabinet / commission_brute   (ou 0 si brute = 0)
taux_gestion      = editTauxGestion / 100             (produits à encours uniquement)
```

Tous les champs écrits ensemble pour éviter les incohérences. Rafraîchissement de la vue ensuite.

### 5. Correction du calcul encours trimestriel

**Avant :**
```ts
const ratio = rem_apporteur / commission_brute
const quarterlyEncoursCommission = (annual * ratio) / 4
const partConsultantEntree = entreeFromGrille * ratio
```

**Après :**
```ts
const quarterlyEncoursCommission = (montant * tauxGestion * consultant.taux_remuneration) / 4
const partConsultantEntree = entreeFromGrille * consultant.taux_remuneration
```

Utilise directement `taux_remuneration` depuis `consultants` (récupéré via la vue). Robuste aux changements de palier.

### 6. Display manager enrichi

Entrée et encours affichent :
- Le taux appliqué.
- Une comparaison `Grille: X% → Appliqué: Y%` quand les deux diffèrent (epsilon flottant via `Math.abs`).
- La part consultant avec son % de base.

## Conséquences

- **Backward compatible** : `taux_gestion` nullable, dossiers existants intacts tant qu'on ne touche pas aux taux.
- **Déploiement** : migration SQL AVANT push frontend (la vue attend les nouvelles colonnes).
- **Ouvert aux consultants** : pas de gating role, chacun peut ajuster ses taux. Le manager voit la variation via la comparaison grille/appliqué.
- **Règles React hooks** respectées : tous les `useState` / `useMemo` avant retours conditionnels (cf. `dossier-detail-wrapper.tsx` lignes 49–330).

## Fichiers impactés

- `scripts/add-taux-gestion.sql` (migration DDL + vue).
- `src/app/dashboard/dossiers/[id]/dossier-detail-wrapper.tsx` (UI + handler).

## Tests manuels réalisés

Cf. `TECHNICAL_SUMMARY.md` d'origine (section Testing Considerations) — non rejoué depuis car aucun test automatisé n'existe encore. À transformer en test Playwright quand la suite sera introduite (cf. `HANDBOOK.md` §12 dette).

## Pistes d'évolution déjà identifiées

- Édition bulk de taux sur plusieurs dossiers.
- Templates de taux par produit/compagnie.
- Audit log dédié des changements de taux (actuellement capturé par `audit_log` générique).
- Workflow d'approbation pour les taux en dehors d'une fourchette.
- Historisation (taux précédent → nouveau, avec horodatage).

Aucune de ces pistes n'est priorisée à ce jour.
