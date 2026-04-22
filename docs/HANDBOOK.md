# PEV CRM — Handbook développeur

> Document de reprise pour un·e développeur·se freelance qui rejoint le projet. L'objectif : être productif en 1 à 2 jours, même sans contexte métier préalable.
>
> **Source de vérité courante :** `STATUS.md` (avancement par chantier, mis à jour à chaque sprint). Ce handbook décrit l'état du code et les conventions ; il n'est pas un journal de bord.
>
> **Autres docs utiles :**
> - `docs/PEV_CRM_Cahier_des_charges_v2.1.docx` — spec fonctionnelle complète, source métier.
> - `docs/REGISTRE_TRAITEMENT.md` — registre RGPD art. 30.
> - `docs/ROTATION.md` — procédure de rotation de secrets.
> - `docs/SECURITY_AUDIT.md` — audit sécurité (RLS, rate-limit, secrets).
> - `docs/kyc-e2e-test.md` — protocole de test E2E signature KYC.
> - `COMPONENTS.md` — bibliothèque de composants UI partagés.
> - `scripts/` — migrations SQL et scripts one-shot. Numérotés par ordre d'application.

---

## 1. En 90 secondes

PEV CRM est l'outil interne de **Private Equity Valley**, un cabinet de conseil en gestion de patrimoine basé en France. L'app remplace un patchwork historique d'Excel + drive partagé. Elle suit trois objets métier principaux : **clients**, **dossiers** (souscriptions de produits), **commissions / encaissements** (flux financiers adossés aux dossiers). Un volet **KYC** récent permet de dématérialiser la collecte d'informations et la signature client.

- **Utilisateurs :** 6–8 consultants + 1 manager (Maxine) + support. Authentification via Supabase Auth (email/password), rôles stockés dans la table `consultants`. Le manager voit tout ; les consultants ne voient que leurs clients/dossiers (RLS).
- **Volume :** ~300 dossiers actifs, ~400 clients, montée en charge modérée (pas de trafic public hors portail KYC).
- **Criticité :** moyenne. Pas de transactions financières en direct, mais faisceau de preuve réglementaire (ACPR/DDA) sur les KYC signés → ne pas toucher aux champs de signature sans comprendre le contrat.

---

## 2. Stack

| Couche | Techno | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.2.15 | Server Components + Route Handlers, Edge non utilisé |
| Langage | TypeScript | 5.x | `strict: true`, mais `ignoreBuildErrors: true` en prod (voir §12) |
| UI | Tailwind + lucide-react + CVA | 3.4 / 1.7 | Primitives maison dans `src/components/ui/*` (voir `COMPONENTS.md`) |
| Charts | recharts | 3.8 | Dashboard manager / consultant |
| DB + Auth | Supabase Postgres | 2.100 | `@supabase/ssr` pour l'auth SSR |
| PDF | pdf-lib + fontkit | 1.17 / 1.1 | Génération PDF KYC côté serveur |
| DOCX | mammoth | 1.12 | Import KYC depuis Word (route `/api/parse-kyc`) |
| Email | nodemailer + Google Workspace SMTP | 6.10 | Expéditeur `support@private-equity-valley.com` |
| Hosting | Vercel | — | Build auto sur push `main` |
| CI | Aucune | — | Pas de tests automatisés à ce jour (voir §12 dette) |

**Pas de Jest/Vitest/Playwright.** Les tests sont manuels (`docs/kyc-e2e-test.md` décrit le protocole pour le flux KYC).

---

## 3. Glossaire métier

| Terme | Sens |
|---|---|
| **Dossier** | Une souscription : { client × produit × compagnie × montant × date }. L'unité de travail du consultant. |
| **Grille** | Barème de taux de commission (entrée, gestion) par compagnie / produit. Table `grilles_commission`. |
| **Taux d'entrée** | % du montant souscrit que le produit verse en commission one-shot. |
| **Taux de gestion / Encours** | % annuel versé tant que l'argent reste chez le fournisseur (PE, CAPI LUX, CAV LUX). |
| **taux_remuneration** | % du commission brute que touche le consultant (le reste va au cabinet). Colonne sur `consultants`, paliers 65/75/85 % selon l'ancienneté (cf. mandat). |
| **Commission brute** | `montant × taux_entrée`. Avant partage cabinet/consultant. |
| **Part cabinet / Rémunération apporteur** | Ventilation de la commission brute entre PEV et le consultant. |
| **Encaissement** | Ligne de cash reçue du fournisseur, rattachée à un dossier. Table `encaissements`. |
| **KYC** | *Know Your Customer*. Formulaire réglementaire à compléter et signer par le client. Deux templates (personne physique / personne morale). |
| **Proposition KYC** | Version non-appliquée du KYC soumise par le client via le portail public. Le consultant valide champ-par-champ avant application. |
| **ACPR / DDA** | Régulateurs français. Imposent la traçabilité de la signature KYC (IP, date, consentement). |
| **Mandat** | Contrat consultant ↔ cabinet. Définit `taux_remuneration`. |
| **PP / PM** | Personne Physique / Personne Morale. Champ `clients.type_personne` : `'physique'` ou `'morale'` (stockage texte). |
| **Co-titulaire** | Second détenteur d'un contrat d'assurance-vie. Stocké sur la fiche client principal (champs dédiés). |

---

## 4. Architecture

### 4.1 Arbre général

```
pev-crm/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # redirige → /login ou /dashboard
│   │   ├── login/
│   │   ├── dashboard/            # zone authentifiée (13 features)
│   │   │   ├── layout.tsx        # sidebar + header
│   │   │   ├── clients/          # liste, création, détail, édition
│   │   │   ├── dossiers/         # idem + panel commission/compliance
│   │   │   ├── encaissements/
│   │   │   ├── facturation/
│   │   │   ├── remunerations/
│   │   │   ├── analyse/          # graphiques recharts
│   │   │   ├── ma-clientele/     # vue consultant
│   │   │   ├── relances/
│   │   │   ├── challenges/
│   │   │   ├── audit/            # journal
│   │   │   ├── reglementaire/
│   │   │   ├── parametres/
│   │   │   └── aide/
│   │   ├── kyc/[token]/          # PORTAIL PUBLIC client (sans auth)
│   │   └── api/                  # Route Handlers
│   │       ├── kyc/              # 6 routes (voir §6.1)
│   │       ├── parse-kyc/        # upload .docx → JSON
│   │       ├── sign-kyc/         # signature consultant (alternative desktop)
│   │       ├── google/           # OAuth Gmail/Calendar
│   │       └── clear-session/
│   ├── components/               # 31 composants
│   │   ├── ui/                   # primitives (Button, Card, Table, ...)
│   │   ├── shared/               # DataTable, StatsCard, StatusBadge, Sidebar, ...
│   │   ├── clients/              # kyc-section, kyc-proposition-diff, pieces-jointes
│   │   ├── dossiers/             # commission-panel, compliance-panel
│   │   ├── dashboard/            # CommunicationsTab
│   │   ├── parametres/           # email-templates-tab
│   │   ├── google/               # facturation-consultant (gmail)
│   │   └── providers/            # user-provider (context)
│   ├── lib/                      # 21 modules métier/infra
│   │   ├── supabase/             # client.ts, server.ts, admin.ts, middleware.ts
│   │   ├── commissions/          # engine.ts, gestion.ts, rules.ts
│   │   ├── kyc-pdf.ts            # génération PDF pdf-lib
│   │   ├── kyc-pdf-storage.ts    # upload bucket Supabase
│   │   ├── kyc-email.ts          # notifications consultant
│   │   ├── kyc-email-templates.ts
│   │   ├── kyc-enums.ts          # valeurs contrôlées (regimes, devises, ...)
│   │   ├── kyc-completion.ts     # calcul taux de complétude
│   │   ├── kyc-bidi.ts           # mapping form ↔ DB bidirectionnel
│   │   ├── email-transport.ts    # nodemailer + SMTP Workspace
│   │   ├── rate-limit.ts         # helper rate-limit Supabase-backed
│   │   ├── pays-blacklist.ts     # liste GAFI
│   │   ├── countries.ts          # ISO-3166 FR
│   │   ├── export-csv.ts
│   │   ├── formatting.ts
│   │   └── utils.ts              # `cn()` (tailwind-merge)
│   ├── hooks/                    # use-user, use-loading-timeout
│   └── types/database.ts         # types générés Supabase (à régénérer si schéma change)
├── scripts/                      # 40+ migrations SQL + 1 import one-shot
├── docs/                         # spec + audits + ce handbook
└── (configs racine : next.config.mjs, tsconfig.json, tailwind.config, ...)
```

### 4.2 Frontend

- **Server Components par défaut.** Les pages `dashboard/**/page.tsx` chargent les données via `createClient()` côté serveur (cookies session). Les composants interactifs sont dans des fichiers séparés marqués `'use client'` (convention : `*-client.tsx` ou `*-wrapper.tsx`).
- **Layout cascade.** `app/dashboard/layout.tsx` vérifie la session + charge le consultant. Un `ErrorBoundary` enveloppe l'ensemble (`components/shared/error-boundary.tsx`).
- **Styling.** Tailwind + `cn()` dans `src/lib/utils.ts`. Palette `navy-*` définie dans `tailwind.config`. Variants via CVA.
- **Pas de Redux / Zustand.** L'état global minimal passe par `UserProvider` (`src/components/providers/user-provider.tsx`).

### 4.3 API Routes

13 route handlers sous `src/app/api/**/route.ts`. Pattern commun :

```ts
export async function POST(req: NextRequest) {
  try {
    // 1. Rate-limit (obligatoire sur les routes publiques/non-auth ; voir §8)
    const rl = await enforceRateLimit(req, RATE_LIMITS.MON_BUCKET)
    if (!rl.allowed) return rl.response

    // 2. Parse + valide le body
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: '...' }, { status: 400 })

    // 3. Auth (si route authentifiée)
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Auth requise' }, { status: 401 })

    // 4. Appel RPC (préféré) ou query
    const { data, error: rpcErr } = await supabase.rpc('ma_fonction', { p_arg: ... })
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, ...data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    console.error('[route-name] unexpected:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

**Règles :**
- Toujours passer par une RPC `SECURITY DEFINER` pour muter ; jamais de `INSERT/UPDATE` direct depuis le navigateur vers une table sensible.
- Rate-limit toutes les routes publiques (portail KYC, `/api/parse-kyc`).
- Logs préfixés par `[<route-name>]` pour faciliter le filtrage Vercel.
- Erreurs métier attendues → statut 400/409 avec message FR lisible. Crashs → 500 avec message générique.

### 4.4 Base de données

**Hébergement :** Supabase (Postgres 15 managé). Project ID et URL dans la mémoire `project_pev_crm_infra.md`.

**Schéma principal (simplifié) :**

```
consultants       — 1 par salarié. taux_remuneration, role manager/consultant.
clients           — PP ou PM. type_personne. KYC : champ-par-champ (kyc_*).
dossiers          — souscriptions. FK vers clients, consultants, produits, compagnies.
produits          — catalogue (CAV, PE, CAPI, ...).
compagnies        — fournisseurs (Generali, Cardif, ...).
commissions       — ventilation par dossier : taux_entrée, taux_gestion, brute, part_cabinet, rem_apporteur.
encaissements     — cash reçu. FK dossier. Workflow statut (à émettre / émise / payée).
grilles_commission — barème par compagnie × produit.
kyc_propositions  — proposition de modification du KYC par le client (en attente de validation consultant).
rate_limit_hits   — table de buckets pour le rate-limit (voir §8).
audit_log         — journal (voir scripts/audit-*.sql).
```

**Vues :** `v_dossiers_complets` dénormalise dossiers + clients + consultants + commissions pour les écrans détail (évite les N+1). Toujours privilégier la vue plutôt qu'assembler les jointures côté client.

**Policies RLS :** activées sur toutes les tables sensibles (voir `scripts/rls-baseline.sql` et `scripts/audit-rls-coverage.sql`). Le manager voit tout via un sous-rôle, les consultants voient leurs propres lignes via `consultant_id = auth.uid()` ou équivalent.

**Storage :** bucket privé `kyc-documents` (RLS : seul le `service_role` peut INSERT ; `SELECT` via signed URL générée côté serveur). Les PDFs KYC signés y atterrissent avec la convention `clients/<uuid>/kyc-<isodate>.pdf`.

### 4.5 Auth

- **Dashboard :** Supabase Auth cookie session, vérifié par `src/lib/supabase/middleware.ts` sur toutes les routes `/dashboard/*`.
- **Portail KYC public :** pas d'auth. Le **token** KYC (généré par `kyc_generate_token`) sert d'identifiant porteur. Token long (≥ 32 caractères), stocké hashé côté DB, rotatable.
- **Google OAuth :** scopes Gmail (envoi factures) + Calendar. Flow dans `src/app/api/google/*`. Token stocké en base (table `consultant_google_tokens`).

---

## 5. Setup local

### 5.1 Prérequis

- Node.js 20+
- Un compte Supabase avec accès au project PEV CRM (demander à Maxine)
- Un compte Vercel avec accès au project (pour preview)
- Accès au coffre-fort 1Password / bitwarden pour les secrets

### 5.2 Installation

```bash
git clone git@github.com:<org>/pev-crm.git
cd pev-crm
npm install
cp .env.local.example .env.local
# Remplir .env.local (voir §5.3)
npm run dev   # http://localhost:3000
```

### 5.3 Variables d'environnement

Fichier `.env.local` (non commité) :

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # serveur uniquement

# Email (optionnel en dev — sans, les mails sont log-only)
GOOGLE_WORKSPACE_SMTP_USER=support@private-equity-valley.com
GOOGLE_WORKSPACE_SMTP_PASS=<app-password>

# Google OAuth (optionnel en dev)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...

# URL publique (utilisée pour construire les liens KYC envoyés aux clients)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> La clé `SUPABASE_SERVICE_ROLE_KEY` donne accès administrateur à la DB. Ne jamais la logger, ne jamais la passer côté client, ne jamais la pousser dans `NEXT_PUBLIC_*`.

### 5.4 État de la DB locale

Deux options :

1. **Pointer `.env.local` vers le project Supabase dev.** Plus rapide. Les RPC, RLS, buckets sont déjà en place.
2. **Supabase local** (`supabase start`). Plus isolé. Il faut alors rejouer les scripts dans `scripts/` **dans l'ordre chronologique d'application** (voir §5.5). C'est fastidieux et pas formellement documenté — on recommande l'option 1 sauf besoin spécifique.

### 5.5 Migrations SQL

Il n'y a **pas de système de migration automatisé** (pas de Prisma, pas de sqlx-migrate, pas de Supabase CLI migrations à ce jour). Les scripts SQL dans `scripts/` sont appliqués manuellement dans le SQL Editor de Supabase, dans l'ordre historique. Ordre d'application connu :

```
add-personne-morale-fields.sql
add-co-titulaire.sql
add-client-standalone-fields.sql
insert-grilles-entree.sql
add-kyc-fields.sql
add-kyc-propositions.sql
add-kyc-pdf-storage.sql
add-kyc-link-flow.sql
add-kyc-signature-audit.sql
add-taux-gestion.sql
add-consultant-email-templates.sql
fix-kyc-generate-token-pgcrypto.sql
fix-kyc-rpc-i18n-and-order.sql
fix-apply-proposition-enfants-details.sql
fix-client-pj-kyc-signe-check.sql
audit-log-setup.sql
audit-triggers.sql
rls-baseline.sql
fix-rls-p0.sql
fix-rls-security-audit.sql
fix-rls-encaissements.sql
add-rate-limit.sql
p1-evolutions.sql … p4-encaissements-auto.sql
recreate-v-dossiers-complets-full.sql
rename-and-prefix.sql
```

**À faire côté dette (§12) :** introduire un outil de migration (Supabase CLI ou `dbmate`) et regrouper par baseline.

### 5.6 Scripts NPM

```
npm run dev      # Next dev server (turbopack)
npm run build    # build prod (ignore erreurs TS / ESLint — voir §12)
npm run start    # serve le build prod
npm run lint     # ESLint (flat config)
```

Pas de `npm test` — aucun test automatisé.

### 5.7 Déploiement

**Vercel est connecté à la branche `main`.** Un push = un build et un déploiement en prod. Les PR déclenchent des previews. Pas de staging intermédiaire.

Avant de pousser :

```bash
npm run build   # doit passer
npm run lint    # pas de nouvelles erreurs (il y a du legacy)
```

Les variables d'environnement de prod sont gérées dans l'UI Vercel (Project → Settings → Environment Variables). Pour rotate un secret : voir `docs/ROTATION.md`.

> ⚠️ `deploy-vercel.mjs` à la racine est un script one-shot historique qui utilise l'API Vercel directement. **Il contient des secrets en clair et n'est plus utilisé.** À supprimer (voir `docs/CLEANUP_CANDIDATES.md`).


---

## 6. Flux métier critiques

### 6.1 KYC (Know Your Customer)

Le flux KYC est **le plus complexe et le plus critique** du CRM. Il repose sur une preuve réglementaire (ACPR/DDA) : signature horodatée + IP + traçabilité des consentements.

**Objectif :** collecter auprès du client les informations réglementaires (identité, régime matrimonial, situation financière, provenance des fonds, etc.), puis obtenir sa signature, et archiver un PDF de synthèse.

**Vue d'ensemble :**

```
┌──────────────────────┐
│ Consultant (dashboard) │
└─────────┬──────────────┘
          │ 1. Génère un lien
          ▼
┌──────────────────────────────────┐
│ POST /api/kyc/generate-link       │
│  → RPC kyc_generate_token         │
│  ← { token, url, mailto, gmail }  │
└─────────┬────────────────────────┘
          │ 2. Envoie email (copy/paste mailto ou Gmail compose)
          ▼
┌────────────────────────────────┐
│ Client ouvre /kyc/[token]      │
│  (portail public, sans auth)   │
└─────────┬──────────────────────┘
          │ 3. Complète et soumet (optionnel : proposition)
          │    ou signe directement
          ▼
┌───────────────────────────────────────────┐
│ POST /api/kyc/submit-public   ← proposition │
│ POST /api/kyc/sign-public     ← signature   │
│   → RPC kyc_submit_proposition_by_token    │
│   → RPC kyc_sign_by_token                  │
│   → generateKycPdfBytes + upload bucket    │
│   → sendKycSignedNotification              │
└─────────┬─────────────────────────────────┘
          │ 4. Consultant voit badge "Signé" + lien PDF
          │    Reçoit email notification (complet/incomplet)
          ▼
┌──────────────────────────────────────┐
│ (si proposition) consultant valide    │
│ champ-par-champ via kyc-proposition-  │
│ diff, puis                             │
│ POST /api/kyc/apply-proposition       │
│  → RPC kyc_apply_proposition          │
└───────────────────────────────────────┘
```

**Les 6 routes API KYC :**

| Route | Rôle | Auth | Rate-limit |
|---|---|---|---|
| `POST /api/kyc/generate-link` | Crée/renouvelle un token | Consultant | 20/min |
| `POST /api/kyc/submit-public` | Client soumet proposition | Token | 10/5 min |
| `POST /api/kyc/sign-public` | Client signe (complet ou incomplet) | Token | 5/5 min |
| `POST /api/kyc/apply-proposition` | Consultant applique proposition | Consultant | — |
| `POST /api/kyc/mark-sent` | Marque le lien comme envoyé (audit UX) | Consultant | — |
| `GET  /api/kyc/pdf/[clientId]` | Signed URL du PDF archivé | Consultant | — |

**Points d'attention :**

1. **IP capture.** Le navigateur ne connaît pas son IP publique. C'est pour ça que `submit-public` et `sign-public` sont des proxy serveur plutôt que des appels RPC directs : la route extrait `x-forwarded-for` / `x-real-ip` (renseignés par Vercel) et les passe à la RPC. Sans ce relais, `kyc_signer_ip` serait `null` → faisceau de preuve ACPR dégradé.

2. **Signature incomplète.** Le client peut signer un KYC incomplet (cases obligatoires à cocher : `consent_incomplete` + `consent_accuracy`). Dans ce cas : `kyc_incomplete_signed = true`, `completion_rate < 100`, `missing_fields` non vide. L'email notification consultant distingue complet / incomplet.

3. **Best-effort post-RPC.** La génération PDF + upload + email ne peuvent JAMAIS invalider la signature (persistée par la RPC avant). En cas d'échec (clé service_role manquante, timeout storage, SMTP down), on logge en warning et on renvoie `{ ok: true }`. Un job de réparation doit rattraper les PDFs manquants (voir dette §12).

4. **Proposition vs signature directe.** Deux parcours possibles :
   - **Proposition** (endpoint `submit-public`) : le client soumet son KYC, il est mis en attente. Le consultant reprend champ-par-champ via `kyc-proposition-diff.tsx`, accepte ou rejette chaque modification, puis applique via `apply-proposition`. Utile pour les corrections mineures.
   - **Signature directe** (endpoint `sign-public`) : le client confirme le KYC tel qu'il est (pré-rempli par le consultant ou complété par lui), et signe. Plus rapide mais moins de contrôle.

5. **Type_personne.** La colonne `clients.type_personne` vaut `'physique'` ou `'morale'`. **Ne jamais écrire `'PP'` ou `'PM'`** — un bug corrigé le 2026-04-21 dégradait silencieusement le mailto (branche `else` empruntée à tort). Chercher `client.type_personne === 'morale'` pour la logique de branchement.

6. **Templates Word.** `lib/kyc-pdf.ts` régénère un PDF from-scratch avec pdf-lib à partir des données client. Les templates Word d'origine sont archivés mais ne servent qu'à la spec — le PDF servi est 100 % généré.

7. **RPC à connaître** (toutes `SECURITY DEFINER`) :
   - `kyc_generate_token(p_client_id)`
   - `kyc_submit_proposition_by_token(p_token, p_proposed_data, …)`
   - `kyc_sign_by_token(p_token, p_signer_name, p_signer_ip, …)`
   - `kyc_apply_proposition(p_proposition_id, p_field_decisions)`
   - Code dans `scripts/add-kyc-link-flow.sql`, `scripts/fix-kyc-rpc-i18n-and-order.sql`, `scripts/fix-apply-proposition-enfants-details.sql`.

### 6.2 Dossiers & commissions

Un **dossier** représente une souscription : `{ client, produit, compagnie, montant, date }`. La commission associée est calculée à partir d'une **grille** (`grilles_commission`) mais peut être négociée dossier par dossier.

**Modèle de calcul :**

```
commission_brute = montant × taux_entrée
rem_apporteur    = commission_brute × consultant.taux_remuneration
part_cabinet     = commission_brute - rem_apporteur
pct_cabinet      = part_cabinet / commission_brute

(produits à encours : PE / CAPI LUX / CAV LUX)
encours_trim_consultant = montant × taux_gestion × consultant.taux_remuneration / 4
```

**Attention :** `consultant.taux_remuneration` doit être lu **depuis la table `consultants`** (via la vue `v_dossiers_complets`), **pas dérivé** du ratio `rem_apporteur / commission_brute` des dossiers historiques. Le ratio dérivé est faux dès que le consultant a changé de palier (65 → 75 → 85 %).

**Édition des taux.** Chaque dossier permet de dérogation à la grille (bouton "Modifier les taux" sur le détail dossier). Les champs dépendants (`commission_brute`, `rem_apporteur`, `part_cabinet`, `pct_cabinet`) sont recalculés ensemble en un seul UPDATE. Voir `src/app/dashboard/dossiers/[id]/dossier-detail-wrapper.tsx`.

**Historique.** Trois ADRs de l'époque documentent le refactor taux d'avril 2026 : `TECHNICAL_SUMMARY.md`, `IMPLEMENTATION_CHECKLIST.md`, `CHANGES_SUMMARY.md`. Les trois sont redondants — à consolider (voir cleanup).

### 6.3 Rémunérations consultant

`src/app/dashboard/remunerations/` agrège les `rem_apporteur` par consultant × période. Le mandat définit les paliers :

| Palier | Ancienneté | taux_remuneration |
|---|---|---|
| Débutant | < 2 ans | 65 % |
| Confirmé | 2–5 ans | 75 % |
| Senior | > 5 ans | 85 % |

Le changement de palier est manuel (UPDATE sur `consultants.taux_remuneration`). Les dossiers existants gardent leur `rem_apporteur` figé ; seuls les nouveaux dossiers bénéficient du nouveau palier.

### 6.4 Facturation

`src/app/dashboard/facturation/` génère les factures cabinet → fournisseur (Generali, Cardif, ...). Émission via Gmail (consultant connecté via OAuth). Le composant `src/components/google/facturation-consultant.tsx` ouvre une fenêtre compose Gmail pré-remplie. Pas d'envoi automatisé.

### 6.5 Encaissements

Représente le cash reçu du fournisseur, à rapprocher d'un dossier. Statuts : `à émettre` → `émise` → `payée`. RLS en place après le chantier sécurité d'avril 2026 (`scripts/fix-rls-encaissements.sql`).

Le script `scripts/p4-encaissements-auto.sql` a introduit une automatisation de rattachement, mais une partie du workflow reste manuelle.

### 6.6 Audit log

Chaque INSERT/UPDATE/DELETE sur les tables sensibles est loggé dans `audit_log` via des triggers (voir `scripts/audit-triggers.sql`). Consultable sous `/dashboard/audit`. Manager uniquement.

---

## 7. Conventions de code

### 7.1 Nommage

- **Fichiers :** `kebab-case.ts` / `kebab-case.tsx`. Les composants clients ont souvent un suffixe `-client.tsx` ou `-wrapper.tsx`.
- **Composants :** `PascalCase`.
- **Fonctions / variables :** `camelCase`.
- **Constantes :** `UPPER_SNAKE_CASE` pour les presets (voir `RATE_LIMITS`).
- **Tables SQL :** `snake_case`, toujours au pluriel (`clients`, `dossiers`, `kyc_propositions`).
- **RPC Postgres :** `snake_case`, préfixe métier (`kyc_*`, `commission_*`, `audit_*`).
- **Colonnes FR.** Beaucoup de colonnes sont en français (`prenom`, `nom`, `raison_sociale`, `regime_matrimonial`). C'est assumé — le domaine est FR, pas d'i18n prévue côté schéma. **Ne pas renommer**.

### 7.2 Commentaires

- **FR par défaut** dans le code métier (routes KYC, composants clients).
- **EN** acceptable pour les utilitaires purs (`src/lib/utils.ts`).
- **Bloc d'en-tête de route** obligatoire : description du rôle, body/retour, raisons de décision (voir `/api/kyc/sign-public/route.ts` pour un exemple complet).
- Préférer des commentaires qui expliquent **pourquoi** plutôt que **quoi**.

### 7.3 Pattern API Route + RPC

**Principe :** la DB est la source d'autorité. Les routes API sont des fins "couche de validation + capture contexte (IP, headers) + logging" avant/après un appel RPC.

**Pourquoi ?**
- **RLS + SECURITY DEFINER** : la logique métier sensible (auth check, constraints, atomicité) vit dans Postgres. Impossible à contourner depuis un navigateur compromis.
- **Testabilité** : on peut rejouer les RPC depuis le SQL Editor pour reproduire un bug.
- **Cohérence** : une seule source pour une logique (pas de duplication client/serveur).

**Quand ajouter une route sans RPC ?** Pour du pur read sans contrainte d'audit (ex: lister des lignes filtrées par RLS), ou pour des actions sans effet de bord DB (envoi d'email, signed URL storage).

### 7.4 Pattern component

Trois types de composants, par ordre de préférence :

1. **Server Component** (par défaut en App Router) — pour afficher des données sans interactivité lourde. Fetch direct avec `createClient()` côté serveur.
2. **Client Component statique** (`'use client'`) — pour les écrans interactifs sans état serveur partagé. Props passées depuis le parent Server Component.
3. **Client Component + wrapper** — le pattern des écrans détail (`dossier-detail-wrapper.tsx`). Le wrapper gère le state local ; la page `page.tsx` reste Server Component et fait le fetch initial.

Éviter : mélanger server/client fetchs dans le même fichier, passer des callbacks depuis Server → Client (interdit par Next).

### 7.5 Rate-limit

Helper dans `src/lib/rate-limit.ts`. Backend : table `rate_limit_hits` + RPC `check_rate_limit` (`SECURITY DEFINER`, sliding window). Fail-open : en cas d'erreur RPC, on laisse passer (on logge un warning) — on préfère un faux négatif à bloquer un consultant légitime.

**Presets actuels :**

| Bucket | Max | Fenêtre |
|---|---|---|
| `KYC_SIGN_PUBLIC` | 5 | 5 min |
| `KYC_SUBMIT_PUBLIC` | 10 | 5 min |
| `KYC_GENERATE_LINK` | 20 | 1 min |
| `PARSE_KYC` | 10 | 5 min |

Identifiant par défaut : IP (x-forwarded-for / x-real-ip). Peut être override (ex: par token KYC) via paramètre optionnel.

### 7.6 Logs

- `console.log` **interdit** en prod — un seul reste dans `src/components/clients/kyc-proposition-diff.tsx:566` (à nettoyer).
- `console.warn` / `console.error` acceptés pour les erreurs inattendues.
- Préfixer par `[<module>]` (ex: `[kyc/sign-public] upload failed: ...`).
- Les logs sont visibles dans Vercel → Project → Logs.

### 7.7 Migration SQL

Format attendu d'un nouveau script `scripts/add-xxx.sql` :

```sql
-- scripts/add-xxx.sql
-- Date : 2026-MM-DD
-- Auteur : <initials>
-- Contexte : (1-3 lignes expliquant pourquoi)
-- Dépendances : (autres scripts prérequis)

BEGIN;

-- ... DDL ...

-- Si création d'une RPC SECURITY DEFINER, toujours :
--   * REVOKE ALL ON FUNCTION ... FROM PUBLIC;
--   * GRANT EXECUTE ON FUNCTION ... TO <role(s)>;
-- avec un commentaire justifiant les rôles autorisés.

COMMIT;
```

Pas d'`IF NOT EXISTS` pour les ALTER de colonnes "mission critique" (on préfère un script qui casse explicitement si l'état attendu n'y est pas).

### 7.8 Headers & CSP

Définis dans `next.config.mjs`. CSP restrictive : Supabase + Google OAuth/APIs whitelistés. Ajouter un nouveau domaine externe nécessite d'étendre `connect-src` (ou `img-src` / `script-src` selon usage).

---

## 8. Guide de lecture : par où commencer ?

Selon ce que tu veux comprendre, lit dans cet ordre :

### Je veux comprendre la route KYC de bout en bout
1. `src/app/kyc/[token]/page.tsx` — le portail client.
2. `src/components/clients/kyc-signature-dialog.tsx` — la modale signature.
3. `src/app/api/kyc/sign-public/route.ts` — le proxy serveur.
4. `scripts/add-kyc-link-flow.sql` + `scripts/fix-kyc-rpc-i18n-and-order.sql` — la RPC.
5. `src/lib/kyc-pdf.ts` + `src/lib/kyc-email.ts` — génération PDF + email.
6. `src/components/clients/kyc-section.tsx` — retour côté consultant (badge signé).

### Je veux comprendre le calcul de commission
1. `scripts/add-taux-gestion.sql` — ajout `taux_gestion` + vue.
2. `src/app/dashboard/dossiers/[id]/dossier-detail-wrapper.tsx` — écran + handler save.
3. `src/lib/commissions/engine.ts` / `gestion.ts` / `rules.ts` — moteur de calcul.
4. `TECHNICAL_SUMMARY.md` — ADR détaillée (historique, à consolider).

### Je veux comprendre la structure d'authentification
1. `src/lib/supabase/middleware.ts` — refresh session + redirect.
2. `src/lib/supabase/server.ts` / `client.ts` / `admin.ts` — les trois clients.
3. `src/app/dashboard/layout.tsx` — layout protégé.
4. `src/hooks/use-user.ts` — récupération user côté client.

### Je veux comprendre la liste des clients
1. `src/app/dashboard/clients/page.tsx` — liste.
2. `src/app/dashboard/clients/[id]/page.tsx` — détail.
3. `src/components/shared/data-table.tsx` — table générique.

### Je veux comprendre la sécurité
1. `docs/SECURITY_AUDIT.md` — audit.
2. `scripts/rls-baseline.sql` + `scripts/audit-rls-coverage.sql`.
3. `scripts/add-rate-limit.sql` + `src/lib/rate-limit.ts`.
4. `docs/ROTATION.md` — procédure rotation secrets.

---

## 9. Sécurité

Résumé des dispositifs en place (détails dans `docs/SECURITY_AUDIT.md`) :

- **RLS sur toutes les tables clients** (clients, dossiers, commissions, encaissements, kyc_propositions). Policies : manager voit tout, consultant voit ses lignes, service_role bypass.
- **SECURITY DEFINER pour les mutations sensibles** (KYC, commissions, audit). Les RPC re-vérifient l'auth.
- **Rate-limit** sur toutes les routes publiques ou non-authentifiées.
- **CSP + HSTS + X-Frame-Options DENY + Permissions-Policy** dans `next.config.mjs`.
- **Token KYC** : généré en DB via `pgcrypto`, longueur ≥ 32, rotatable. Stocké hashé côté serveur.
- **Bucket storage privé** : INSERT réservé à `service_role`, SELECT via signed URL courte durée.
- **Audit log** : triggers sur tables sensibles.
- **Rotation des secrets** : procédure documentée (`docs/ROTATION.md`).
- **Registre RGPD art. 30** : `docs/REGISTRE_TRAITEMENT.md`.

**Points d'attention résiduels** (voir §12) :
- `next.config.mjs` désactive `eslint` et `typescript` au build. Des erreurs peuvent passer en prod.
- Pas de WAF / DDoS mitigation autre que le rate-limit Supabase.
- Pas de 2FA sur Supabase Auth (email/password only).

---

## 10. Email

- **Transport** : Nodemailer + SMTP Google Workspace (`src/lib/email-transport.ts`).
- **Expéditeur** : `support@private-equity-valley.com`.
- **Templates** :
   - KYC signé / incomplet : `src/lib/kyc-email-templates.ts` + `src/lib/kyc-email.ts`. PDF joint.
   - Autres (relances, factures) : envoyés manuellement via Gmail OAuth, pas de template serveur.

En dev local, si `GOOGLE_WORKSPACE_SMTP_PASS` est absent, l'envoi est skippé avec un log warning (`[kyc/sign-public] email not sent: no-transport`). La signature reste persistée.

---

## 11. Roadmap & chantiers en cours

**Source de vérité :** `STATUS.md` (mis à jour chaque sprint). Extrait indicatif au 2026-04-22 :

- Chantier sécurité : RLS encaissements ✅, rate-limit ✅, registre RGPD ✅, rotation secrets ✅, audit trail ✅.
- Chantier KYC : batch A (PDF + bucket) ✅, batch B (email notification consultant) ✅, batch C (proposition diff + apply) ✅. Retours Maxine post-test du 2026-04-21 : 9 items (voir mémoire `project_kyc_retours_maxine_2026_04_21_v2.md`).
- Chantier encaissements auto : en cours.
- Chantier reporting / analyse : v1 en place, évolutions mineures.

**À venir (non priorisé) :**
- Système de migrations DB automatisé (Supabase CLI / dbmate).
- Tests automatisés E2E (Playwright) — a minima le flow KYC.
- CI GitHub Actions (lint + build + typecheck).
- 2FA consultant.
- Régénération PDF batch (job de réparation pour les PDFs manquants post-signature).

---

## 12. Dette technique & pièges connus

### Dette structurelle

| Item | Impact | Effort |
|---|---|---|
| `next.config.mjs` ignore les erreurs TS et ESLint au build | Moyen — des erreurs peuvent passer en prod | Moyen — retirer les flags, corriger les 17+ erreurs existantes (dont un flag regex es2018 dans `parse-kyc/route.ts`) |
| Pas de tests automatisés | Élevé — chaque refactor est risqué | Élevé — introduire Vitest + Playwright |
| Pas de CI | Moyen | Faible — action GitHub + `npm run build` + `npm run lint` |
| Pas de système de migration DB | Moyen — ordre des scripts tribal | Moyen — Supabase CLI migrations + baseline |
| 3 docs sur le même refactor commission (TECHNICAL_SUMMARY / IMPLEMENTATION_CHECKLIST / CHANGES_SUMMARY) | Faible — confusion | Faible — consolider en 1 ADR historique |
| `scripts/import-delta-2026.*` (one-shot migration Excel) reste dans le repo | Faible — bruit | Faible — archiver en `scripts/archive/` |
| `deploy-vercel.mjs` (script de déploiement historique, contient des secrets en clair) | Sécurité — secrets lisibles même s'ils sont gitignored | Faible — supprimer |

### Pièges connus

1. **`clients.type_personne`** stocke `'physique' | 'morale'`, jamais `'PP'` / `'PM'`. Un bug (2026-04-21) dégradait le mailto quand on écrivait `'PM'` par erreur.
2. **`consultant.taux_remuneration`** doit être lu directement depuis `consultants`, pas dérivé de ratios sur dossiers historiques (cf. §6.2).
3. **`kyc_signer_ip` = null** = la route a été appelée sans passer par le proxy serveur (ou sans headers Vercel). À traiter comme un faisceau de preuve dégradé.
4. **RPC `kyc_sign_by_token`** : messages d'erreur bilingues FR/EN pendant la période de rollout (`/déjà signé|already signed/i`). Ne pas "simplifier" cette regex.
5. **PDF best-effort** : si le PDF échoue, la signature reste valide. Ne pas retourner 500 à l'utilisateur dans ce cas (voir `/api/kyc/sign-public`).
6. **Mémoire Claude** : des mémoires projet existent (voir `/sessions/.../mnt/.auto-memory/MEMORY.md`). Infos sensibles (IDs Supabase, Vercel) y sont référencées. Ne pas partager hors contexte.
7. **Service role key** : requise pour PDF gen + upload storage + email admin. Si absente en dev, tout fonctionne sauf ces étapes (logs warning).

### Boucles d'abandon

- Les champs `kyc_pdf_storage_path` / `kyc_pdf_generated_at` peuvent être `null` même après signature si le bucket était down au moment T. Un job de réparation à venir les comblera en relisant `audit_log`.

---

## 13. Contacts & ownership

| Rôle | Personne |
|---|---|
| Product owner | Maxine (manager PEV) |
| Tech lead | à désigner / ex-prestataire |
| Ops Supabase / Vercel | Maxine (accès root) |
| Regulatory (ACPR/DDA/RGPD) | Maxine |

Les décisions métier passent toujours par Maxine. Pour toute question "pourquoi le champ X existe", consulter d'abord le cahier des charges (`docs/PEV_CRM_Cahier_des_charges_v2.1.docx`) puis les mémoires `project_*.md` si accessibles.

---

## 14. Lexique des fichiers à lire en priorité

**Top 10 à ouvrir dès le premier jour :**

1. `STATUS.md` — avancement réel.
2. `docs/HANDBOOK.md` — ce document.
3. `src/app/dashboard/layout.tsx` — entrée authentifiée.
4. `src/lib/supabase/middleware.ts` — refresh session.
5. `src/app/api/kyc/sign-public/route.ts` — cas d'école du pattern API + RPC.
6. `scripts/rls-baseline.sql` — policies RLS.
7. `scripts/add-kyc-link-flow.sql` — les RPC KYC.
8. `src/lib/rate-limit.ts` — helper partagé.
9. `src/components/shared/data-table.tsx` — primitive réutilisée partout.
10. `docs/SECURITY_AUDIT.md` — état sécurité.

Bonne reprise.
