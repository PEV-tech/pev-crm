# PEV CRM

Outil interne de **Private Equity Valley** — CRM spécialisé gestion de patrimoine. Suivi clients, dossiers, commissions, encaissements et KYC réglementaire (ACPR/DDA).

## Reprise développeur

Point d'entrée unique : [`docs/HANDBOOK.md`](docs/HANDBOOK.md).

Il couvre :
- Setup local, variables d'environnement, déploiement.
- Stack, architecture, conventions de code.
- Flux métier critiques (KYC, dossiers, commissions, facturation, encaissements).
- Guide de lecture, sécurité, roadmap, dette technique et pièges connus.

## Statut courant

[`STATUS.md`](STATUS.md) — avancement par chantier, mis à jour chaque sprint.

## Autres docs utiles

- [`COMPONENTS.md`](COMPONENTS.md) — bibliothèque de composants UI partagés.
- [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md) — audit sécurité (RLS, rate-limit, secrets).
- [`docs/REGISTRE_TRAITEMENT.md`](docs/REGISTRE_TRAITEMENT.md) — registre RGPD art. 30.
- [`docs/ROTATION.md`](docs/ROTATION.md) — procédure de rotation de secrets.
- [`docs/kyc-e2e-test.md`](docs/kyc-e2e-test.md) — protocole de test E2E signature KYC.
- [`docs/adr/`](docs/adr/) — décisions techniques archivées.
- [`scripts/`](scripts/) — migrations SQL (ordre d'application dans le handbook §5.5).

## Stack

Next.js 14 App Router · TypeScript · Supabase (Postgres + Auth + Storage) · Vercel · Tailwind · pdf-lib · nodemailer (Google Workspace SMTP).

## Commandes

```bash
npm install
cp .env.local.example .env.local   # à compléter
npm run dev        # http://localhost:3000
npm run build      # build prod
npm run lint       # ESLint
```

Pas de tests automatisés à ce jour (cf. handbook §12 — dette).
