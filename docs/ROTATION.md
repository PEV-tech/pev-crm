# PEV CRM — Procédure de rotation des clés

**Dernière rotation** : 2026-04-21 (GOOGLE_APP_PASSWORD « PEV CRM » activé, ancien « CRM » révoqué, RESEND_API_KEY supprimée).

Ce document décrit qui rotationne quoi, quand, et comment. Il sert de checklist en cas d'incident de sécurité (clé leakée, départ d'un collaborateur, audit externe) et de rappel semestriel.

---

## 1. Inventaire des clés et secrets

| Secret | Rôle | Où l'obtenir | Où le poser | Rotation |
|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | DDL + bypass RLS (génération PDF, notifications, admin) | Supabase Dashboard → Project Settings → API → `service_role` secret | Vercel → env **Production + Preview** uniquement | Semestrielle (ou à la demande) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth client (RLS-aware, sans privilège serveur) | Supabase Dashboard → Project Settings → API → `anon` public | Vercel → env **All** | Sur rotation JWT secret uniquement (≈ annuel) |
| `NEXT_PUBLIC_SUPABASE_URL` | Endpoint REST/auth | idem | Vercel → env **All** | Jamais (sauf changement de projet) |
| Supabase **JWT secret** | Signature des anon/service keys | Supabase Dashboard → Project Settings → API → JWT Settings → « Generate new secret » | N/A (interne à Supabase) | Annuelle, ou immédiate si fuite |
| `GOOGLE_APP_PASSWORD` | SMTP Nodemailer (`support@private-equity-valley.com`) | Google Account → Security → 2-step verification → App passwords | Vercel → env **Production + Preview** | Semestrielle, ou si soupçon |
| Vercel API token (`deploy-vercel.mjs`) | Script de déploiement local, non versionné | Vercel → Account Settings → Tokens | **Local uniquement** (`deploy-vercel.mjs` est gitignore) | Trimestrielle |
| `SUPABASE_ACCESS_TOKEN` (CLI) | `npx supabase` commands | Supabase Dashboard → Account → Access Tokens | `~/.supabase/` local uniquement | À créer — non positionné en prod à date |

## 2. Clés explicitement **absentes**

Ces secrets ont été supprimés après migration ou ne sont plus utilisés. Les lister explicitement évite qu'un futur audit pense qu'ils sont en circulation.

- `RESEND_API_KEY` — supprimée 2026-04-21 après migration vers Nodemailer/Google Workspace SMTP.
- `RESEND_FROM` — idem, obsolète.
- `GOOGLE_APP_PASSWORD` ancien mot de passe « CRM » — révoqué 2026-04-21, seul « PEV CRM » actif.

## 3. Procédure — Rotation `SUPABASE_SERVICE_ROLE_KEY`

Cette clé bypass RLS. C'est la plus sensible. **Toute fuite impose une rotation immédiate.**

1. **Générer la nouvelle clé** — Supabase Dashboard → Project Settings → API → section « service_role ». Bouton « Reset ». Copier la nouvelle valeur.
2. **Poser la nouvelle clé sur Vercel** — Vercel Dashboard → Settings → Environment Variables → remplacer `SUPABASE_SERVICE_ROLE_KEY` sur les envs **Production** ET **Preview**. Pas sur « Development » (dev local passe par `.env.local`).
3. **Redéployer** — Vercel redéploie automatiquement les apps exposées à un changement d'env. Attendre la fin du rollout (≈ 2 min).
4. **Smoke test** — sur la prod, simuler une signature KYC (route `/api/kyc/sign-public`). Si 200 + email reçu + PDF généré, la nouvelle clé est active.
5. **Invalider l'ancienne** — Supabase révoque automatiquement l'ancienne clé au reset. Vérifier en appelant `/api/kyc/sign-public` avec l'ancienne valeur en header (devrait renvoyer 401).
6. **Mettre à jour `.env.local`** — propager la nouvelle valeur localement. Commit de `.env.local` interdit — il est gitignore.
7. **Tracer** — compléter le tableau « Journal de rotation » ci-dessous.

Durée totale : 10 min si smoke test vert du premier coup.

## 4. Procédure — Rotation `GOOGLE_APP_PASSWORD`

1. **Créer un nouveau mot de passe** — Google Account → Security → 2-step verification → App passwords → « Créer ». Nom suggéré : `PEV CRM YYYY-MM`. Copier la valeur (affichée une seule fois).
2. **Poser sur Vercel** — remplacer `GOOGLE_APP_PASSWORD` sur Production + Preview.
3. **Redéployer** et smoke test via signature KYC complète (qui déclenche un email consultant).
4. **Révoquer l'ancien** — Google Account → App passwords → « Supprimer » sur l'ancien nom.
5. **Tracer**.

## 5. Procédure — Rotation JWT secret Supabase (`anon` + `service_role` en même temps)

⚠️ Impact : invalide tous les JWT émis depuis le début du projet. Tous les utilisateurs connectés seront déconnectés. Pertinent uniquement en cas de fuite critique.

1. Supabase Dashboard → Project Settings → API → JWT Settings → « Generate new JWT secret ».
2. Récupérer les nouvelles `anon` et `service_role` keys dérivées.
3. Propager les 2 sur Vercel **simultanément** (anon sur All, service_role sur Prod+Preview).
4. Redéployer. Tous les utilisateurs devront se reconnecter.
5. Prévenir les consultants via Slack/email avant la rotation (fenêtre de maintenance ≈ 5 min).

## 6. Procédure — Révocation sessions compromises

Sans rotation du JWT secret, pour invalider **une session utilisateur** précise :

```sql
-- Supabase SQL editor (service_role requis)
SELECT auth.admin_sign_out('<uid>'::uuid);
```

Ou côté code serveur via `supabase.auth.admin.signOut(uid)`. À scripter plus tard si usage fréquent (`/api/admin/revoke-session`).

## 7. Procédure — Rotation Vercel API token (`deploy-vercel.mjs`)

1. Vercel → Account Settings → Tokens → « Create ».
2. Remplacer la valeur dans `~/.../deploy-vercel.mjs` **ligne 8 (token Vercel)** et **ligne 10 (service_role Supabase)** uniquement en local. Fichier gitignore — ne jamais commit.
3. Révoquer l'ancien token sur Vercel.
4. Test : `node deploy-vercel.mjs` doit rester fonctionnel.

## 8. En cas de fuite suspectée

1. **Révoquer la clé suspecte immédiatement** (ne pas attendre confirmation du vecteur).
2. Rotation selon §3/§4/§5.
3. **Auditer les logs Supabase** (Dashboard → Logs → API) sur les 48 h précédant la suspicion. Chercher :
   - requêtes non-SELECT venant d'IPs inconnues,
   - accès à la table `auth.users` ou `audit_logs` depuis l'anon key.
4. **Auditer les commits git récents** avec `detect-secrets scan --all-files` (cf. §9).
5. **Notifier l'équipe** (Slack #ops) et Maxine.
6. Si données personnelles accédées : **notifier la CNIL** sous 72 h (art. 33 RGPD).

## 9. Scan préventif — secrets en clair

Tous les 3 mois (ou après chaque merge de branche longue durée), lancer :

```bash
# Installer (une fois) :
pip install detect-secrets --break-system-packages

# Scan working tree :
detect-secrets scan --all-files \
  --exclude-files '\.next/|node_modules/|\.git/|package-lock\.json|\.snap$' \
  > .secrets.baseline

# Scan git history (prefix user-specific) :
git log --all -p -S "<jwt-middle-chunk>"
```

**Scan du 2026-04-21** : 0 secret en clair commité. Seuls `.env.local` et `deploy-vercel.mjs` contiennent des tokens — tous deux gitignore. 942 « Hex High Entropy » dans `tsconfig.tsbuildinfo` = hashes de build, faux positifs.

⚠️ **Finding à tracer** : commits `3b96508` (2026-04-14 18:07) → `ca48093` (2026-04-14 18:10) ont ajouté puis retiré `src/app/api/migrate/route.ts`, un endpoint de migration avec token d'auth hardcodé `'pev-migrate-2026'` et accès à `process.env.SUPABASE_SERVICE_ROLE_KEY`. Exposé 3 min en prod. L'endpoint n'a jamais renvoyé les valeurs des env vars (seulement leur existence), donc pas de leak direct. Mais par précaution, la prochaine rotation service_role (§3) vaut d'être anticipée — à mettre en calendrier pour **2026-10** au plus tard.

---

## 10. Journal de rotation

Ajouter une ligne à chaque rotation. Format ISO 8601.

| Date | Secret | Raison | Auteur | Vérification |
|---|---|---|---|---|
| 2026-04-21 | `GOOGLE_APP_PASSWORD` | Migration Resend → Nodemailer, nouveau mot de passe « PEV CRM » | Maxine | Signature KYC PP → email reçu |
| 2026-04-21 | `RESEND_API_KEY` | Suppression définitive post-migration | Maxine | — |
| — | `SUPABASE_SERVICE_ROLE_KEY` | À planifier 2026-10 (suivi finding §9) | — | — |
