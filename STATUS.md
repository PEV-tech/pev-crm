# PEV CRM — État du repo

**Mis à jour** : 2026-04-20 · **Commit de référence** : `cea09a9`

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
| Réglementaire | ✅ | **Read-only by design** — dashboard de monitoring conformité. Les edits se font sur client/[id] et dossier/[id]. |
| Clients/[id] | ⚠️ | Fonctionne mais error handling fragile : `catch { setNotFound(true) }` (L172), `catch (e) { console.error }` (L196), error swallowed au save (L212). |
| Audit | ⚠️ | `console.error` résiduels (L86, L94). Fonctionne mais logs à nettoyer. |
| Paramètres | ⚠️ | **1817 lignes monolithiques**. CRUD fonctionne, mais dette technique max — à découper en sous-pages (Consultants, Produits, Grilles, Challenges). |
| Relances | ⚠️ | **Read-only by design avec UX gap** — page principale agrège, les mutations (INSERT/UPDATE) fonctionnent via le composant `ClientRelances` embarqué sur client/[id]. Manque un bouton "marquer fait" inline sur la liste agrégée. |

---

## Drapeaux rouges (à adresser)

### Comportement silencieux (erreurs avalées)
- `src/app/dashboard/clients/[id]/page.tsx` L172, L196, L212 — catchs vides ou alertes sans contexte
- `src/app/dashboard/remunerations/remunerations-client.tsx` L81 — `} catch { return [] }` silent fallback
- `src/app/dashboard/dossiers/[id]/dossier-detail-wrapper.tsx` L654 — `console.error('Error creating apporteur')`

### Debugging résiduel
- `src/app/dashboard/audit/page.tsx` L86, L94 — `console.error`
- Divers `console.error` de développement dans dossier-detail-wrapper

### Types TS pré-existants (non bloquants mais polluants)
- ~~`dossier-detail-wrapper.tsx` L102, L108, L558 — 3 erreurs sur la table `apporteurs`~~ ✅ **Résolu** par régénération des types (commit `cea09a9`).
- `clients/[id]/page.tsx` L864 — TS1128 résiduel. **Cause racine identifiée** : accolades déséquilibrées dans `handleSaveContact` (L198-217), propagées jusqu'en fin de fichier. Fix au passage dans le nettoyage des catchs silencieux (même zone).

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

### Tables dans `src/types/database.ts` — ✅ régénéré 2026-04-20 (commit `cea09a9`)
Types complets et à jour avec Supabase. Tables incluses : consultants, clients, produits, compagnies, taux_produit_compagnie, grilles_frais, dossiers, commissions, factures, challenges, audit_log, audit_logs, client_commentaires, client_pj, client_relations, rendez_vous, document_templates, dossier_documents, google_tokens, relances, faq, encaissements, encaissements_rem, grilles_commissionnement, visibility_settings, facturation_consultant, manager_cagnotte, **apporteurs** + vues (`v_dossiers_complets`, `v_collecte_par_consultant`, `v_pipeline_par_consultant`, `v_dossiers_remunerations`, `v_encaissements`, `v_clients_secure`) + RPC (get_classement, calculate_commission, get_frais_taux, is_manager, is_back_office, mask_account/email/phone, unaccent, get_current_consultant_id, get_current_role, upsert_google_token).

### Dette résiduelle (P3)
- `apporteurs` — utilisée dans `dossier-detail-wrapper.tsx` depuis commit `6bd8756` (2026-04-13). Présente sur Supabase et désormais dans les types, mais **aucun script DDL tracé** dans `scripts/`. À créer rétroactivement pour qu'un nouvel environnement soit reproductible.

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

### ✅ P0 — Synchronisation types (FAIT 2026-04-20, commit `cea09a9`)
- Régénération `src/types/database.ts` depuis Supabase — tables `encaissements`, `v_encaissements`, `apporteurs` désormais présentes.
- `as any` retiré de `remunerations-client-wrapper.tsx` L34.

### P0 — Hygiène code (bloqueurs d'usage quotidien)
1. **Clients/[id]** : remplacer les catchs silencieux (L172, L196, L212) par des toasts/messages utilisateur. Le save silencieux à L212 fait **perdre des données sans feedback** — c'est LE blocker V1.
   - Note : le fix de L212 résout aussi l'erreur TS1128 pré-existante à L864 (même accolade mal placée).
2. **Nettoyer les `console.error` résiduels** (audit L86/L94, dossier-detail-wrapper L654, remunerations L81).
3. **Supprimer les 5 composants orphelins** listés plus haut (après grep de vérification).

### P1 — UX gaps
4. **Relances** : ajouter un bouton "marquer fait" inline sur la page agrégée pour éviter l'aller-retour client/[id].

### P2 — Post-V1 (dette technique)
5. **Tracer le DDL `apporteurs`** dans `scripts/create-apporteurs.sql` (reverse-engineering depuis Supabase) pour qu'un futur env propre soit reproductible.
6. **Découper `parametres/page.tsx`** (1817 lignes) en sous-pages.
7. **Setup un outil de migration** (Supabase CLI) pour remplacer les scripts manuels.
8. **ESLint strict** + lint-staged en pre-commit pour bloquer les `console.log` et catchs vides.

### P4 — Features identifiées
Cf. `/sessions/charming-jolly-ramanujan/mnt/.auto-memory/project_crm_roadmap.md` pour le cahier des charges complet.

---

## Règles de travail (pour éviter que ça reparte en vrille)

1. **Une seule branche de travail active** — pas de session Claude parallèle sans coordination.
2. **Commits atomiques** — un commit = un concept (pas de "WIP + 6 fixes + snapshot" en 59 fichiers).
3. **Feature branches courtes** — `feat/reglementaire-save`, mergée en < 48h.
4. **Mettre à jour ce fichier** après chaque feature finie ou bug identifié. Traité = retiré.
5. **Pas de migration SQL sans régénération des types** dans le même commit.
6. **Pas de push direct sur `main` si divergence** — toujours `git pull --rebase` d'abord, ou faire une PR.
7. **Avant de flagger une feature comme "cassée"**, vérifier qu'elle n'est pas simplement read-only by design (cas Réglementaire/Relances : mutations sur pages parentes).
