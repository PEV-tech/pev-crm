# PEV CRM — État du repo

**Mis à jour** : 2026-04-21 · **Commit de référence** : `dc3e267` (après batch 3 — audit logs)

Ce document est la **source de vérité** sur l'état réel du code. Toute session Claude qui ouvre ce repo doit le lire avant d'écrire du code. À maintenir à jour après chaque feature mergée ou fix important.

---

## Sections du dashboard

Légende : ✅ fonctionnel · ⚠️ partiel (visible mais incomplet) · 🚫 cassé

| Section | Statut | Note |
|---|---|---|
| Aide | ✅ | FAQ statique, accès par rôle. Pas de DB. |
| Analyse | ✅ | Reads `v_dossiers_complets`, charts Recharts. OK. |
| Challenges | ✅ | Leaderboard via RPC `get_classement()`. Read-only. |
| Dossiers (list + [id]) | ✅ | CRUD complet. 43 useState dans le detail-wrapper : complexe mais marche. **Le bouton "Nouveau dossier" en tête de liste a été retiré (`fbeb5be`)** — création d'un dossier passe obligatoirement par la fiche client. La route `/dashboard/dossiers/nouveau` reste accessible mais n'est plus exposée. |
| Encaissements | ✅ | Table + filtres + bulk mark paid + export CSV. |
| Facturation | ✅ | Dashboard factures avec bulk "émettre". |
| Ma clientèle | ✅ | Portfolio consultant avec commissions. Read-only. |
| Rémunérations | ✅ | Breakdown par mois/pool. Read-only. |
| Réglementaire | ✅ | **Read-only by design** — dashboard de monitoring conformité. Les edits se font sur client/[id] et dossier/[id]. |
| Clients/[id] | ✅ | Error handling propre depuis commit `7506da8` (V1). Les échecs de save/delete remontent en alert utilisateur. **KYC avec signature conformité** : badge de complétude en tête de section KYC (% champs requis remplis), bouton "Faire signer" ouvrant un modal avec (1) avertissement légal si incomplet, (2) double validation obligatoire (consentement incomplet + certification exactitude), (3) saisie nom signataire, (4) capture IP + timestamp + liste champs manquants via `/api/sign-kyc`. Bannière rouge "Document signé avec informations incomplètes (XX%)" ensuite visible en permanence sur la fiche. |
| Clients/nouveau | ✅ | **Flux dédié** (CDC) : fiche client autonome sans dossier. **Deux types pris en charge depuis `6ab7c4f`** : Personne physique (nom+prénom+situation+co-titulaire) et Personne morale (raison sociale, forme juridique SCI/SARL/SAS/SCPI/..., SIREN/SIRET, capital, date de création, représentant légal PP). Toggle PP/PM en tête. Dropdown Pays avec bouton "+", consultant + date d'entrée en relation capturés au niveau client. |
| Audit | ✅ | Bandeau d'erreur in-page depuis `45dfdaf`. Plus de `console.error` silencieux. |
| Paramètres | ⚠️ | **1817 lignes monolithiques**. CRUD fonctionne, mais dette technique max — à découper en sous-pages (Consultants, Produits, Grilles, Challenges). Post-V1. |
| Relances | ✅ | Bouton "Marquer fait" sur les manuelles (`1d4d6c4`) + bouton "Ouvrir" sur les dérivées qui navigue vers le dossier concerné (`95ae905`). |

---

## Drapeaux rouges (à adresser)

### ✅ Résolus pendant la campagne V1 (2026-04-20, commits `7506da8`, `45dfdaf`, `e80655d`, `0cba145`, `95ae905`)
- ~~clients/[id] L172/L196/L212 — catchs silencieux qui perdaient les saves~~ → alert/console.error dédiés.
- ~~clients/[id] L864 — TS1128 causé par accolades déséquilibrées dans `handleSaveContact`~~ → réécrit comme `handleSaveReglementaire`.
- ~~remunerations-client L81 — `catch { return [] }` silencieux~~ → `console.warn` avec contexte, dégradation inchangée.
- ~~dossier-detail-wrapper L654 — `console.error('Error creating apporteur')` sans UX~~ → alert utilisateur + correction du bug `newAp` référencé avant définition (erreur runtime au passage).
- ~~audit L86/L94 — `console.error` sans feedback visuel~~ → bandeau rouge in-page via `loadError` state.
- ~~**CRITIQUE** : triggers d'audit en prod insèrent dans `audit_log` (singulier, table inexistante) au lieu de `audit_logs` (pluriel)~~ → recréation de `fn_audit_log()` ET `audit_trigger_func()` via `scripts/fix-audit-trigger-table-name.sql`, appliqué en prod 2026-04-20 SQL editor + smoke test UPDATE clients passant. Cassait **tous** les UPDATE/INSERT/DELETE sur clients/dossiers/commissions/factures, silencieusement swallowé avant le fix des catches.
- ~~relances : colonne Actions affichait "—" pour les dérivées (949 entrées, "je ne peux rien faire")~~ → bouton "Ouvrir" vers `/dashboard/dossiers/<id>` ajouté via `95ae905`.

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

### Tables dans `src/types/database.ts` — ✅ régénéré 2026-04-20 (commit `6ab7c4f`, avant : `cea09a9`)
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
15. `fix-audit-trigger-table-name.sql` (2026-04-20) — **fix prod-critique** : triggers d'audit pointaient vers une table inexistante `audit_log` (singulier). Recrée `fn_audit_log()` et `audit_trigger_func()` pour insérer dans `audit_logs` (pluriel). **Appliqué en prod 2026-04-20.**
16. `add-client-standalone-fields.sql` (2026-04-20) — ajoute `clients.consultant_id` (FK → consultants, ON DELETE SET NULL) + `clients.date_entree_relation` (date) + index `idx_clients_consultant_id`. Idempotent (ADD COLUMN IF NOT EXISTS). **Appliqué en prod 2026-04-20**, smoke test `information_schema.columns` passant. Débloque la création de clients standalone (sans dossier) conformément au CDC.
17. `add-personne-morale-fields.sql` (2026-04-20) — ajoute 8 colonnes à `clients` pour support des personnes morales : `type_personne` ('physique'\|'morale', défaut 'physique'), `raison_sociale`, `forme_juridique`, `siren`, `siret`, `representant_legal_id` (FK → clients(id) ON DELETE SET NULL), `capital_social` (NUMERIC(15,2)), `date_creation` + indexes sur type_personne et representant_legal_id. Idempotent. **Appliqué en prod 2026-04-20** (types régénérés confirment la présence des colonnes). Retro-compat totale (default 'physique').
18. `add-kyc-signature-audit.sql` (2026-04-20) — ajoute 8 colonnes audit sur `clients` pour la traçabilité de la signature KYC (conformité ACPR/DDA) : `kyc_signer_name`, `kyc_signed_at` (timestamptz), `kyc_signer_ip`, `kyc_completion_rate` (SMALLINT 0–100 avec CHECK), `kyc_missing_fields` (jsonb), `kyc_incomplete_signed` (boolean), `kyc_consent_incomplete` (boolean), `kyc_consent_accuracy` (boolean). Index partiel `idx_clients_kyc_incomplete_signed` pour les alertes consultant. Idempotent. **Appliqué en prod** (confirmé par le fonctionnement des casts `as any` ciblés en front).
19. `recreate-v-dossiers-complets-full.sql` (2026-04-21) — recrée `v_dossiers_complets` + `v_dossiers_remunerations` de façon consolidée pour exposer `co_titulaire_id`, `co_titulaire_nom`, `co_titulaire_prenom` ET `apporteur_id`. Corrige la feature co-titulaire silencieusement partielle (STATUS.md §Dette révélée). Garde le DISTINCT ON + security_invoker hérités. Forward les champs dans `v_dossiers_remunerations` y compris le Pool-masking. **À appliquer en prod via SQL editor Supabase puis régénérer les types** (`npx supabase gen types typescript --project-id … > src/types/database.ts`).

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
| 7 | **Fix prod audit triggers** (`audit_log` → `audit_logs`) + smoke test passant | `e80655d`, `0cba145` |
| 8 | Bouton "Ouvrir" sur relances dérivées (nav vers dossier) | `95ae905` |
| 9 | **Suppression fiche jointe** POULIQUEN & MARC Marion & Simon (1ʳᵉ dissociation CDC) | prod DELETE |
| 10 | **Route `/dashboard/clients/nouveau`** : fiche client autonome, save partiel, dropdown Pays + "+", co-titulaire via `client_relations`, consultant + date d'entrée en relation au niveau client | à pousser |
| 11 | Bouton "Nouveau client" dans le header global + remplace "Nouveau dossier" sur Ma Clientèle | à pousser |
| 12 | **KYC signature — capture IP côté serveur** via route proxy `/api/kyc/sign-public` (x-forwarded-for → RPC) + auto-refresh polling 30 s côté consultant + carte dashboard "KYC signés (7 j)" avec flag rouge sur incomplets | `498fc38` |
| 13 | **Réglementaire — bandeau KYC incomplets** + ligne récap dans QualityPanel (faisceau de preuve ACPR/DDA) | `5bc5a2a` |
| 14 | **Audit logs — filtres table + utilisateur + export CSV** (RFC 4180, BOM UTF-8, cap 10 000 lignes) | `dc3e267` |

### P0 résiduel — Dette révélée par types honnêtes
Tous post-V1, **aucun ne bloque l'usage quotidien** (cf. section "Dette révélée" plus haut pour le détail) :
1. ~~Recréer la vue `v_dossiers_complets` pour exposer `co_titulaire_id` et `apporteur_id`~~ → **DONE 2026-04-21** : script appliqué en prod via Chrome/pg-meta (autorisation Maxine, pas de CLI service_role token), types TS patchés manuellement dans `database.ts`, `as any` co_titulaire retirés dans `dossier-detail-wrapper.tsx`. Smoke test validé : les 2 vues exposent bien `apporteur_id`, `co_titulaire_id`, `co_titulaire_nom`, `co_titulaire_prenom`.
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

### Follow-up immédiat — KYC signature (2026-04-20)
La V1 de la signature KYC (commit de ce jour) couvre : détection complétude, avertissement, double validation, saisie nom, persistance audit (IP, timestamp, champs manquants, consentements). **Non couvert, à livrer ensuite :**

- **Génération PDF du KYC signé** avec bandeau visible « KYC incomplet » + liste des champs manquants ou indicateur de complétude. Nécessite d'ajouter `jspdf` ou `pdf-lib` (pas de lib PDF en prod actuellement, seul `pdf-parse` est présent pour l'import). Template à concevoir avec Maxine.
- **Notification consultant** lors d'une signature incomplète. Pas d'infra email en prod actuellement (seuls des `mailto:` côté UI). Deux options : (a) ajouter Resend/SendGrid + route `/api/notify-kyc-signed`, (b) banner/badge in-app sur le dashboard consultant (requête sur `kyc_incomplete_signed=true AND kyc_signed_at > now()-'7 days'`, déjà indexée via `idx_clients_kyc_incomplete_signed`).
- **Signature pad canvas** ou intégration Yousign/DocuSign pour remplacer la saisie texte du nom (V1 pragmatique, suffisante pour un CRM interne utilisé en présence du client, mais pas pour une signature à distance).

---

## Règles de travail (pour éviter que ça reparte en vrille)

1. **Une seule branche de travail active** — pas de session Claude parallèle sans coordination.
2. **Commits atomiques** — un commit = un concept (pas de "WIP + 6 fixes + snapshot" en 59 fichiers).
3. **Feature branches courtes** — `feat/reglementaire-save`, mergée en < 48h.
4. **Mettre à jour ce fichier** après chaque feature finie ou bug identifié. Traité = retiré.
5. **Pas de migration SQL sans régénération des types** dans le même commit.
6. **Pas de push direct sur `main` si divergence** — toujours `git pull --rebase` d'abord, ou faire une PR.
7. **Avant de flagger une feature comme "cassée"**, vérifier qu'elle n'est pas simplement read-only by design (cas Réglementaire/Relances : mutations sur pages parentes).
