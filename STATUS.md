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

### Migrations datées 2026-04-20 — état de synchronisation

| Script | Ajoute / Modifie | Reflété dans types ? |
|---|---|---|
| `add-co-titulaire.sql` | `dossiers.co_titulaire_id` | ✅ présent (4 occ) |
| `add-kyc-fields.sql` | `clients.titre`, `nom_jeune_fille`, `adresse`, `patrimoine_immobilier` (JSON), etc. | ✅ présent |
| `p4-encaissements-auto.sql` | **Nouvelle table `encaissements_auto`** | ❌ **absente des types** |

### Table référencée sans SQL identifié
- `apporteurs` — utilisée dans `dossier-detail-wrapper.tsx` (3 erreurs TS) mais aucun script `create table apporteurs` dans `scripts/`. Soit créée manuellement dans l'UI Supabase, soit code mort. **À vérifier.**

**Action P0** :
1. Vérifier si `p4-encaissements-auto.sql` a été appliqué sur Supabase. Si oui → régénérer les types. Si non → l'appliquer puis régénérer.
2. Vérifier l'existence de la table `apporteurs` sur Supabase. Si oui → régénérer. Si non → décider : créer proprement ou retirer le code mort.

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

### P0 — Synchronisation schéma ↔ types
1. **Vérifier l'état de `p4-encaissements-auto.sql` sur Supabase** et régénérer `database.ts` si appliqué.
2. **Résoudre le cas `apporteurs`** : table existante (régénérer types) ou code mort (supprimer les 3 références dans dossier-detail-wrapper.tsx).

### P1 — Hygiène code
3. **Clients/[id]** : remplacer les catchs silencieux (L172, L196, L212) par des toasts/messages utilisateur.
4. **Nettoyer les `console.error` résiduels** (audit L86/L94, dossier-detail-wrapper L654, remunerations L81).
5. **Supprimer les 5 composants orphelins** listés plus haut (après grep de vérification).

### P2 — UX gaps
6. **Relances** : ajouter un bouton "marquer fait" inline sur la page agrégée pour éviter l'aller-retour client/[id].

### P3 — Dette technique
7. **Découper `parametres/page.tsx`** (1817 lignes) en sous-pages.
8. **Setup un outil de migration** (Supabase CLI) pour remplacer les scripts manuels.
9. **ESLint strict** + lint-staged en pre-commit pour bloquer les `console.log` et catchs vides.

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
