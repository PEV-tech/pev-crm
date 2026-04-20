# PEV CRM — État du repo

**Mis à jour** : 2026-04-20 · **Commit de référence** : `1d4d6c4`

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
| Clients/[id] | ✅ | Error handling propre depuis commit `7506da8` (V1). Les échecs de save/delete remontent en alert utilisateur. |
| Audit | ✅ | Bandeau d'erreur in-page depuis `45dfdaf`. Plus de `console.error` silencieux. |
| Paramètres | ⚠️ | **1817 lignes monolithiques**. CRUD fonctionne, mais dette technique max — à découper en sous-pages (Consultants, Produits, Grilles, Challenges). Post-V1. |
| Relances | ✅ | Bouton "Marquer fait" inline ajouté (`1d4d6c4`) pour les relances `manuelle`. Les dérivées (kyc/inactivité/…) se résolvent en corrigeant la donnée sous-jacente. |

---

## Drapeaux rouges (à adresser)

### ✅ Résolus pendant la campagne V1 (2026-04-20, commits `7506da8`, `45dfdaf`)
- ~~clients/[id] L172/L196/L212 — catchs silencieux qui perdaient les saves~~ → alert/console.error dédiés.
- ~~clients/[id] L864 — TS1128 causé par accolades déséquilibrées dans `handleSaveContact`~~ → réécrit comme `handleSaveReglementaire`.
- ~~remunerations-client L81 — `catch { return [] }` silencieux~~ → `console.warn` avec contexte, dégradation inchangée.
- ~~dossier-detail-wrapper L654 — `console.error('Error creating apporteur')` sans UX~~ → alert utilisateur + correction du bug `newAp` référencé avant définition (erreur runtime au passage).
- ~~audit L86/L94 — `console.error` sans feedback visuel~~ → bandeau rouge in-page via `loadError` state.

### Dette révélée par la régénération des types (non bloquants — post-V1)
La régénération honnête des types (commit `cea09a9`) a fait remonter des incohérences que les types hand-edited masquaient :

- **`v_dossiers_complets` n'expose pas `co_titulaire_id` / `apporteur_id`** (vue pas rafraîchie après `add-co-titulaire.sql`). Le code `dossier-detail-wrapper.tsx` (L164, L165, L191, L346, L347, L471, L596) lit ces champs → renvoie `undefined` au runtime. Traité comme "no co-titulaire" par la logique de falsy-check, donc pas de crash, mais la feature co-titulaire est **silencieusement partielle**. **Fix** : recréer la vue avec ces colonnes.
- **kyc-section.tsx** : ~15 erreurs implicit-any dans des callbacks `map/reduce`. Pré-existant, annotations manquantes.
- **document-checklist / client-relances** : les `Row` types Supabase sont plus larges que les interfaces locales (ex: `statut: string` vs `"a_faire" | "fait" | …`). À harmoniser.
- **clients/[id]/page.tsx(218,669)** : `Update` type de Supabase exclut `null` pour colonnes nullable-with-default ; `ClientInfo` local manque `ville`. Micro-fix.
- **dossiers/nouveau page.tsx(201)** : `client_id: string | null` vs signature Insert qui veut `string | undefined`. Harmoniser.
- **parse-kyc/route.ts** : flag regex ES2018 — bump `target` dans `tsconfig.json`.

Total tsc : 73 errors. **Aucune ne bloque le build Next.js** (Vercel ignore les type errors par défaut). Liste exhaustive : `npx tsc --noEmit`.

---

## Composants orphelins

✅ **Nettoyage effectué 2026-04-20 (commit `0e2bb74`)** — 4 composants supprimés après vérification grep :
- `src/components/shared/stats-card.tsx`
- `src/components/dashboard/podium-wrapper.tsx`
- `src/components/dashboard/podium.tsx`
- `src/components/dossiers/apporteur-section.tsx`

Note : `search-modal.tsx` était sur la liste initiale mais est en fait importé par `components/shared/header.tsx` — **conservé**.

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

## Backlog priorisé

### ✅ Campagne V1 livrée (2026-04-20)
| # | Item | Commit |
|---|---|---|
| 1 | Synchro types (`encaissements`, `v_encaissements`, `apporteurs`) | `cea09a9` |
| 2 | Restauration aliases de commodité (VDossiersComplets, Consultant, …) | `a6cd9dc` |
| 3 | Fix catchs silencieux clients/[id] + résolution TS1128 L864 | `7506da8` |
| 4 | Nettoyage console.error (audit, rémunérations, dossier-detail) + fix bug `newAp` | `45dfdaf` |
| 5 | Suppression 4 composants orphelins | `0e2bb74` |
| 6 | Bouton inline "Marquer fait" sur relances agrégées | `1d4d6c4` |

### P0 résiduel — Dette révélée par types honnêtes
Tous post-V1, **aucun ne bloque l'usage quotidien** (cf. section "Dette révélée" plus haut pour le détail) :
1. Recréer la vue `v_dossiers_complets` pour exposer `co_titulaire_id` et `apporteur_id` (feature co-titulaire partielle en silence).
2. Harmoniser `document-checklist` / `client-relances` : élargir les interfaces locales vers les `Row` Supabase.
3. Annotations `map/reduce` dans `kyc-section.tsx` (~15 implicit-any).
4. Bump `tsconfig.target` à ES2018+ pour régler `parse-kyc/route.ts`.

### P1 — Dette technique
5. **Tracer le DDL `apporteurs`** dans `scripts/create-apporteurs.sql` (reverse-engineering depuis Supabase) pour qu'un futur env propre soit reproductible.
6. **Découper `parametres/page.tsx`** (1817 lignes) en sous-pages (Consultants, Produits, Grilles, Challenges).
7. **Setup Supabase CLI migrations** pour remplacer les scripts manuels appliqués via le SQL editor.
8. **ESLint strict** + lint-staged en pre-commit pour bloquer les `console.log`, catchs vides, et `as any` régressions.

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
