# PEV CRM — État du repo

**Mis à jour** : 2026-04-20 · **Commit de référence** : `ca1e973`

Ce document est la **source de vérité** sur l'état réel du code. Toute session Claude qui ouvre ce repo doit le lire avant d'écrire du code. À maintenir à jour après chaque feature mergée ou fix important.

---

## Sections du dashboard

Légende : ✅ fonctionnel · ⚠️ partiel (visible mais incomplet) · 🚫 cassé

| Section | Statut | Note |
|---|---|---|
| Aide | ✅ | FAQ statique, accès par rôle. Pas de DB. |
| Analyse | ✅ | Reads `v_dossiers_complets`, charts Recharts. OK. |
| Challenges | ✅ | Leaderboard via RPC `get_classement()`. Read-only. |
| Dossiers (list + nouveau + [id]) | ✅ | CRUD complet. 43 useState dans le detail-wrapper : complexe mais marche. |
| Encaissements | ✅ | Table + filtres + bulk mark paid + export CSV. |
| Facturation | ✅ | Dashboard factures avec bulk "émettre". |
| Ma clientèle | ✅ | Portfolio consultant avec commissions. Read-only. |
| Rémunérations | ✅ | Breakdown par mois/pool. Read-only. |
| Clients/[id] | ⚠️ | Fonctionne mais error handling fragile : `catch { setNotFound(true) }` (L172), `catch (e) { console.error }` (L196), error swallowed au save (L212). |
| Audit | ⚠️ | `console.error` résiduels (L86, L94). Fonctionne mais logs à nettoyer. |
| Paramètres | ⚠️ | **1817 lignes monolithiques**. CRUD fonctionne, mais dette technique max — à découper en sous-pages (Consultants, Produits, Grilles, Challenges). |
| Réglementaire | 🚫 | Form visible mais **pas de save handler identifié** dans les 80 premières lignes. Données ne persistent probablement pas. À vérifier. |
| Relances | 🚫 | Wrapper load initial OK mais **pas de POST/PATCH** pour persister les changements de statut. À vérifier. |

---

## Drapeaux rouges (à adresser)

### Comportement silencieux (erreurs avalées)
- `src/app/dashboard/clients/[id]/page.tsx` L172, L196, L212 — catchs vides ou alertes sans contexte
- `src/app/dashboard/remunerations/remunerations-client.tsx` L81 — `} catch { return [] }` silent fallback
- `src/app/dashboard/dossiers/[id]/dossier-detail-wrapper.tsx` L654 — `console.error('Error creating apporteur')`

### Chemins d'écriture manquants
- **Réglementaire** : formulaire sans handler de save
- **Relances** : pas de persistance des updates

### Debugging résiduel
- `src/app/dashboard/audit/page.tsx` L86, L94 — `console.error`
- Divers `console.error` de développement dans dossier-detail-wrapper

### Types TS pré-existants (non bloquants mais polluants)
- `dossier-detail-wrapper.tsx` L102, L108, L558 — 3 erreurs sur la table `apporteurs` (absente de `database.ts`)

---

## Composants orphelins (importés nulle part)

À supprimer au prochain nettoyage :
- `src/components/shared/search-modal.tsx`
- `src/components/shared/stats-card.tsx`
- `src/components/dashboard/podium-wrapper.tsx`
- `src/components/dashboard/podium.tsx`
- `src/components/dossiers/apporteur-section.tsx`

Vérifier avant de supprimer avec `grep -r "from.*search-modal"` etc.

---

## État schéma DB

### Tables dans `src/types/database.ts` (30)
consultants, clients, produits, compagnies, taux_produit_compagnie, grilles_frais, dossiers, commissions, factures, challenges, audit_log, client_commentaires, client_pj, rendez_vous, audit_logs, document_templates, dossier_documents, client_relations, google_tokens, relances, faq, encaissements_rem, grilles_commissionnement, visibility_settings, facturation_consultant, manager_cagnotte + 4 vues (`v_dossiers_complets`, `v_collecte_par_consultant`, `v_pipeline_par_consultant`, `v_dossiers_remunerations`).

### Migrations probablement non synchronisées avec les types
- `scripts/p4-encaissements-auto.sql` (2026-04-20 19:26) — crée `encaissements_auto` **absente des types**
- `scripts/add-co-titulaire.sql` (2026-04-20 19:26) — ajoute `co_titulaire_id` sur dossiers
- `scripts/add-kyc-fields.sql` (2026-04-20 19:26) — ajoute colonnes KYC sur clients (titre, nom_jeune_fille, adresse, patrimoine_immobilier JSON, etc.)
- Table `apporteurs` référencée dans le code mais absente des types

**Action** : après avoir appliqué ces migrations sur Supabase, régénérer les types :
```bash
npx supabase gen types typescript --project-id <ID> > src/types/database.ts
```

---

## SQL migration history

Scripts dans `scripts/` (ordre chronologique) :

1. `rename-and-prefix.sql` (2026-04-07) — renommage initial
2. `insert-grilles-entree.sql` (2026-04-07) — seed grilles
3. `add-taux-gestion.sql` (2026-04-07) — taux_gestion
4. `fix-rls-p0.sql` (2026-04-08) — RLS policies v0
5. `p1-evolutions.sql` (2026-04-08) — ville, non_abouti, dates
6. `p2-evolutions.sql` (2026-04-09) — recreate `v_dossiers_complets`, PRECO
7. `p3-evolutions.sql` (2026-04-10) — views + grille schema
8. `p3-data-fixes.sql` (2026-04-20) — dedup Marion Freret, Brice Jaulneau
9. `audit-log-setup.sql` (2026-04-20) — table audit_log
10. `audit-triggers.sql` (2026-04-20) — triggers audit
11. `fix-rls-security-audit.sql` (2026-04-20) — durcissement RLS
12. `add-co-titulaire.sql` (2026-04-20) — co_titulaire_id
13. `add-kyc-fields.sql` (2026-04-20) — champs KYC clients
14. `p4-encaissements-auto.sql` (2026-04-20) — `encaissements_auto`

**Dette** : pas d'outil de migration (Supabase CLI migrations, Flyway, etc.). Chaque script est appliqué à la main via le SQL editor Supabase. Aucun registre d'exécution. À terme : utiliser Supabase migrations CLI.

---

## Backlog priorisé (propositions)

### P0 — Bugs qui impactent les utilisateurs
1. **Vérifier Réglementaire** : les données saisies sont-elles persistées ? Si non, implémenter le save.
2. **Vérifier Relances** : idem.
3. **Synchroniser les types avec la DB** : appliquer les 3 migrations du 2026-04-20 sur Supabase, régénérer `database.ts`, supprimer les 3 erreurs TS pré-existantes.

### P1 — Hygiène
4. **Clients/[id]** : remplacer les catchs silencieux par des toasts/messages utilisateur.
5. **Supprimer les 5 composants orphelins** listés plus haut.
6. **Nettoyer les `console.error` résiduels** (audit, dossier-detail-wrapper, autres).

### P2 — Dette technique
7. **Découper `parametres/page.tsx`** (1817 lignes) en sous-pages.
8. **Setup un outil de migration** (Supabase CLI) pour remplacer les scripts manuels.
9. **ESLint strict** + lint-staged en pre-commit pour bloquer les `console.log` et catchs vides.

### P3 — Features identifiées
Cf. `/sessions/charming-jolly-ramanujan/mnt/.auto-memory/project_crm_roadmap.md` pour le cahier des charges complet.

---

## Règles de travail (pour éviter que ça reparte en vrille)

1. **Une seule branche de travail active** — pas de session Claude parallèle sans coordination.
2. **Commits atomiques** — un commit = un concept (pas de "WIP + 6 fixes + snapshot" en 59 fichiers).
3. **Feature branches courtes** — `feat/reglementaire-save`, mergée en < 48h.
4. **Mettre à jour ce fichier** après chaque feature finie ou bug identifié. Traité = retiré.
5. **Pas de migration SQL sans régénération des types** dans le même commit.
6. **Pas de push direct sur `main` si divergence** — toujours `git pull --rebase` d'abord, ou faire une PR.
