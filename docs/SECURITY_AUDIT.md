# PEV CRM — Audit sécurité V1

**Date** : 2026-04-21 · **Scope** : Supabase (DB + Storage + Auth) · Vercel (runtime + env) · Conformité RGPD / LCB-FT / ACPR-DDA.

Ce document est un audit initial (T0). Il sert à (1) identifier les trous couverts/non couverts, (2) prioriser les corrections avant V1 publique, (3) tenir une trace des choix de design pour un auditeur externe.

À relancer en complément : `scripts/audit-rls-coverage.sql` (5 rapports) pour capturer l'état prod réel au moment de la revue.

---

## 1. Row Level Security (RLS)

### Couverture connue
| Table | RLS activée | Policies | Source |
|---|---|---|---|
| `dossiers` | ✅ FORCE | `select`, `insert`, `update`, `delete` | `fix-rls-p0.sql`, `fix-rls-security-audit.sql` |
| `google_tokens` | ✅ FORCE | `select`, `insert`, `update` (`user_id = auth.uid()`) | `fix-rls-security-audit.sql` |
| `client_commentaires` | ✅ FORCE | `select`, `insert` (`EXISTS … dossiers WHERE client_id = … AND consultant = me`) | `fix-rls-security-audit.sql` |
| `relances` | ✅ FORCE | `select`, `all` | `fix-rls-security-audit.sql` |
| `v_dossiers_complets` | ✅ | `security_invoker = true` | `fix-rls-p0.sql` |
| `v_clients_secure` | ✅ | vue de masquage PII | types only — script à retrouver |

### Gaps constatés (à combler avant V1 prod)
1. **`clients`** : aucune policy scriptée dans `scripts/`. Probable policy initiale en DB mais non auditée. Requis : `SELECT`/`UPDATE` restreints à `consultant_id = get_current_consultant_id() OR is_manager() OR is_back_office()`. `DELETE` restreint aux managers.
2. **`commissions`, `factures`, `encaissements`** : idem, pas de policy scriptée. Critique pour isolation consultant.
3. **`client_pj`** : RLS probablement manquante côté DB (à confirmer via Rapport 1 de `audit-rls-coverage.sql`).
4. **`rendez_vous`** : idem.
5. **`audit_logs`** : lecture restreinte aux managers uniquement. Insertion par trigger côté fonction `audit_trigger_func()`. À vérifier que la policy filtre bien.

**Action** : lancer Rapport 1/2/3 de `audit-rls-coverage.sql`, capturer le résultat ci-dessous, puis produire `scripts/fix-rls-v1-gap.sql` pour combler.

### Résultat prod (2026-04-21, Supabase SQL editor)

**Rapport 1 (tables `public.*` sans RLS)** — 1 seule table :

| Table | rls_enabled | rls_forced |
|---|---|---|
| `encaissements` | ❌ | ❌ |

**C'est critique** : `encaissements` est une table financière (montants client → consultant) accessible à tout utilisateur authentifié via l'anon key, sans filtrage par rôle. Fix : `scripts/fix-rls-encaissements.sql` (créé ce jour) — active RLS FORCE + 4 policies calquées sur `dossiers`.

**Rapport 2 (tables avec RLS mais sans policy)** — 0 ligne. Pas de table verrouillée involontairement.

**Rapport 3 (policies par table)** — couverture conforme à ce qui était scripté :
- `clients` : SELECT/INSERT/UPDATE/DELETE avec filtres `consultant_id = get_current_consultant_id() OR is_manager() OR is_back_office()`.
- `dossiers`, `commissions`, `factures`, `client_pj`, `rendez_vous`, `client_commentaires`, `relances`, `kyc_propositions`, `client_relations`, `audit_logs`, `google_tokens`, `consultants` : toutes protégées.

→ les gaps initialement suspectés (clients, client_pj, rendez_vous, commissions, factures) étaient en fait couverts en prod, juste pas tracés dans `scripts/`. Dette docu à rattraper post-V1 (dump `pg_policies` → `scripts/rls-baseline.sql`).

**Rapport 4 (buckets storage)** — `kyc-documents` privé, 4 policies conformes (cf. §2). Aucun bucket `public=true` non justifié.

**Rapport 5 (RPC)** — `is_manager`, `is_back_office`, `get_current_consultant_id`, `get_current_role`, `mask_account/email/phone`, `unaccent`, `upsert_google_token`, `get_classement`, `calculate_commission`, `get_frais_taux` : toutes `SECURITY DEFINER` avec `search_path` figé sur `public, pg_temp`. Pas de grant `anon`. OK.

---

## 2. Policies Storage

### État connu
- **`kyc-documents`** : privé, 4 policies (script `add-kyc-pdf-storage.sql`, 2026-04-21).
  - INSERT/UPDATE : `service_role` only (génération PDF backend via `/api/kyc/sign-public`).
  - SELECT : `authenticated` (lien signé 5 min par `/api/kyc/pdf/[clientId]`).
  - DELETE : `is_manager()` only.

### Buckets non audités
- **`client_pj`** (ou équivalent pour les pièces jointes CDC §03) : bucket à créer ou auditer, policies à poser (INSERT/DELETE consultant du client, SELECT consultant/manager).
- **`document_templates`** : bucket probable pour les KYC / mandats templates. Auditer la policy SELECT.
- Tout bucket `public=true` non justifié par la fonction métier = risque.

**Action** : lancer Rapport 4 de `audit-rls-coverage.sql`.

---

## 3. Rotation des clés et JWT

### État actuel
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : exposée côté client (Next.js public env). Normale pour Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` : utilisée côté serveur uniquement (API routes KYC, `kyc-pdf-storage.ts`). Stockée dans Vercel env privée.
- `GOOGLE_APP_PASSWORD` (email Nodemailer) : stockée Vercel. Ancien mot de passe « CRM » supprimé 2026-04-21. Seul « PEV CRM » actif.
- Pas de `RESEND_API_KEY` (supprimé 2026-04-21 après migration Nodemailer).

### Gaps
1. **Aucune rotation automatique** des clés Supabase (service_role) ni du JWT secret. À date : rotation sur demande via dashboard Supabase.
2. **Pas de mécanisme de révocation** des sessions utilisateur en cas de compromission. Supabase auth expose `auth.admin.signOut(uid)` mais aucun script côté admin.
3. **Clés dans l'historique Git ?** **Audité 2026-04-21 via `detect-secrets` + `git log -S` ciblé** : 0 secret commité. `.env.local` et `deploy-vercel.mjs` (qui contiennent les JWTs Supabase et le token Vercel) sont correctement gitignore. Les 942 matches dans `tsconfig.tsbuildinfo` sont des hashes de build (faux positifs). **⚠️ Finding à tracer** : commits `3b96508` / `ca48093` (2026-04-14, ~3 min d'exposition) ont ajouté puis retiré un endpoint `/api/migrate/route.ts` avec auth hardcodée `'pev-migrate-2026'` — n'a jamais renvoyé les valeurs des env vars, mais par précaution **rotation `SUPABASE_SERVICE_ROLE_KEY` à planifier avant 2026-10** (cf. `docs/ROTATION.md`).

**Action** :
- ~~Documenter la procédure de rotation dans `docs/ROTATION.md`.~~ → **livré 2026-04-21** ([docs/ROTATION.md](ROTATION.md)) : inventaire clés, procédures §3/§4/§5 (service_role / Google / JWT), playbook incident §8, scan préventif §9, journal §10.
- Prévoir rotation semestrielle minimum sur `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_APP_PASSWORD`, `JWT_SECRET` (sur regeneration Supabase).
- ~~Scanner l'historique Git avec `gitleaks` ou `truffleHog` avant premier audit externe.~~ → **fait 2026-04-21** via `detect-secrets` (gitleaks binary inaccessible depuis le sandbox). 0 secret commité.

---

## 4. Logs d'accès et alertes

### État actuel
- Table `audit_logs` avec trigger `fn_audit_log()` → `audit_trigger_func()` sur UPDATE/INSERT/DELETE (fixé 2026-04-20 via `fix-audit-trigger-table-name.sql`).
- UI `dashboard/audit/page.tsx` : filtres table + utilisateur + export CSV (`dc3e267`).
- Log des signatures KYC : `kyc_signer_name`, `kyc_signed_at`, `kyc_signer_ip`, `kyc_missing_fields`, etc. sur `clients`.

### Gaps
1. **Pas d'alerting automatique** sur accès anormal. Ex : 1 consultant qui lit les fiches de 50 clients non rattachés en < 5 min devrait déclencher une alerte.
2. **Pas de rate-limiting** côté Next.js API routes (KYC endpoints surtout). DoS trivial sur `/api/kyc/sign-public` possible.
3. **Logs Vercel** : conservation par défaut 7 jours (plan Pro) ou 30 jours. Pour conformité ACPR-DDA il faut 10 ans sur les actes métier. Les logs métier sont en DB (OK), mais les logs d'accès Next.js ne sont pas archivés.

**Action** :
- Webhook Supabase → Slack sur `audit_logs` avec règles simples (> 20 SELECT sur clients en 5 min).
- Ajouter un rate-limiter (upstash `@upstash/ratelimit`) sur `/api/kyc/*` et `/api/parse-kyc`.
- Archivage logs Vercel → Logtail / Datadog (retention 1 an minimum).

---

## 5. Conformité RGPD

### Pseudonymisation
- Vue `v_clients_secure` + RPC `mask_account / mask_email / mask_phone` existent. À vérifier si elles sont appelées dans le front (recherche `mask_`).
- Logs IP signature KYC : IP stockée en clair dans `kyc_signer_ip`. **Conforme RGPD si finalité documentée** (preuve consentement ACPR) et durée de conservation limitée.

### Droit à l'effacement / portabilité / rectification
- **Aucun flow utilisateur** n'expose ces droits pour le client final. Le client PEV est le CGP, pas le client final. Mais les clients finaux (personnes physiques dont on stocke les PII) ont droit à :
  - accès à leurs données,
  - rectification,
  - effacement (avec conservation légale LCB-FT = 5 ans après fin de relation),
  - portabilité (export JSON/CSV).
- À date : **pas de workflow automatisé**. Traitement manuel case par case par le back-office.

### Durées de conservation
- KYC : 5 ans min (LCB-FT) après clôture du compte / fin relation.
- Signatures KYC : 10 ans (ACPR-DDA pour mandats CIF).
- Logs audit : 3 ans recommandé.
- **Aucun script de purge automatique** à date. À écrire.

### Registre de traitement (DPO)
- Pas encore formalisé. Obligatoire au-delà de 250 employés ou pour traitement données sensibles (PEV y est : données patrimoine = catégorie spéciale indirecte).

**Action** :
- Rédiger `docs/REGISTRE_TRAITEMENT.md` (modèle CNIL).
- Page `/dashboard/rgpd` côté admin pour consulter/exporter/supprimer les données d'un client final (procédure + log).
- Script `scripts/purge-old-clients.sql` avec règles de rétention documentées.

---

## 6. Optimisation infra (CDC §07 IMPORTANT)

### Supabase
| Item | État |
|---|---|
| Indexes sur colonnes fréquentes | ✅ **Vérifié 2026-04-21** via `pg_indexes` : les 4 indexes initialement listés comme « à ajouter » sont en fait tous présents, sous des noms sans suffixe `_id` ou via des UNIQUE constraints : `dossiers.idx_dossiers_client` (client_id), `dossiers.idx_dossiers_consultant` (consultant_id), `commissions.idx_commissions_dossier` + `commissions_dossier_id_key` UNIQUE, `encaissements.encaissements_dossier_id_key` UNIQUE. **Note schéma** : `encaissements` n'a pas de `client_id` (rattachement via `dossier_id`), la recommandation initiale était imprécise. **Vrais gaps résiduels** (non-bloquants V1) : `idx_encaissements_consultant_id`, `idx_encaissements_apporteur_id`, et un doublon à nettoyer sur `commissions` (UNIQUE `commissions_dossier_id_key` + `commissions_dossier_id_unique` = 2 index pour la même contrainte). |
| Revue requêtes N+1 | 🚫 Pas faite. `dossier-detail-wrapper.tsx` est un candidat (43 useState, nombreux appels supabase). |
| PgBouncer | 🚫 Non configuré. Supabase Pro l'inclut via « pooler » URL. À brancher côté Next.js (`DATABASE_POOL_URL`). |
| Backups | ✅ Auto via plan Supabase. À vérifier le RPO. |

### Vercel
| Item | État |
|---|---|
| Cache routes statiques | ⚠️ `next.config.mjs` à auditer. Les pages dashboard sont `dynamic = 'force-dynamic'` par défaut. |
| Edge Functions | 🚫 Aucune migration vers Edge (toutes les API routes tournent en Node Serverless). Les endpoints légers (`/api/kyc/pdf/[clientId]`) y gagneraient en latence. |
| Monitoring temps de réponse | ⚠️ Vercel Analytics activée ? À confirmer. Sinon ajouter `@vercel/analytics`. |

---

## 7. Checklist finale pré-V1

- [x] ~~Lancer `audit-rls-coverage.sql`, capturer les 5 rapports ici.~~ → fait 2026-04-21, §1 rempli.
- [x] ~~Dissocier la dernière fiche jointe « DUMONT & PENARD » (plan Matthieu conserve les dossiers).~~ → `dissociate-dumont-penard.sql` prêt.
- [ ] Appliquer `fix-rls-encaissements.sql` en prod + smoke test (consultant voit ses encaissements uniquement, manager voit tout). **Mis de côté 2026-04-21 sur décision Maxine, à reprendre.**
- [x] ~~Appliquer `fix-clients-drive-column-dedup.sql` + régénérer `src/types/database.ts`.~~ → fait 2026-04-21 (patch manuel TS faute de CLI Supabase avec auth).
- [x] ~~Appliquer `dissociate-dumont-penard.sql` (prévenir Matthieu avant).~~ → fait 2026-04-21, smoke test OK (Matthieu conserve ses 2 dossiers).
- [ ] `fix-client-fk-cascades.sql` : optionnel (prod déjà en CASCADE sur les 3 tables légères) — à appliquer uniquement pour figer l'état.
- [x] ~~Scan secrets Git (`gitleaks` / `truffleHog`).~~ → fait 2026-04-21 via `detect-secrets` (cf. §3). 0 secret commité.
- [ ] Rate-limit `/api/kyc/*` et `/api/parse-kyc`.
- [x] ~~Documenter rotation clés dans `docs/ROTATION.md`.~~ → livré 2026-04-21.
- [ ] Rédiger registre RGPD minimal.
- [x] ~~Ajouter les 4 indexes manquants en DB.~~ → en fait déjà présents, recommandation corrigée §6. Gaps résiduels non-bloquants documentés.
- [ ] Vérifier `next.config.mjs` et brancher `@vercel/analytics`.
- [ ] Dump `pg_policies` → `scripts/rls-baseline.sql` pour reproductibilité.

---

## 8. Hors scope V1 (post-V1)

- Edge Functions migration.
- Webhook Supabase → Slack pour alerting.
- Page `/dashboard/rgpd` self-service pour droits client final.
- Intégration Yousign / DocuSign (signature électronique qualifiée).
- Logtail / Datadog pour logs Vercel.
- SOC2 type 1 (si clients institutionnels).
