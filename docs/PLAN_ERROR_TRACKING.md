# Plan — Error tracking (alternative gratuite à Sentry)

Statut : **à implémenter en PR dédiée** après merge de `feat/uptime-monitoring`.
Date du plan : 2026-04-22.

## Pourquoi pas Sentry tout de suite

Sentry 10 + SDK Next.js a un coût caché : 
- Wizard interactif (`npx @sentry/wizard`) qui modifie plusieurs fichiers.
- Config `instrumentation-client.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts` + options `next.config.mjs`.
- CSP à étendre (`connect-src` doit accepter `*.ingest.sentry.io`).
- Tier gratuit : 5k events/mois — OK tant qu'on débugge peu.

On n'a pas besoin de Sentry maintenant. On a besoin de **voir les erreurs prod**.
Supabase + un endpoint `/api/errors` font le job à 100 % gratuit et restent dans
la stack qu'on maîtrise déjà.

Si un jour on veut passer sur Sentry, on pourra le faire : l'API `/api/errors` restera, on ajoutera juste un `Sentry.captureException()` en plus.

## Schéma proposé

### 1. Table Supabase `app_errors`

```sql
create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  source text not null check (source in ('client', 'server', 'api')),
  route text,                       -- ex: '/dashboard/clients/[id]'
  message text not null,
  stack text,
  user_id uuid references auth.users(id) on delete set null,
  user_agent text,
  extra jsonb default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create index on public.app_errors (occurred_at desc);
create index on public.app_errors (resolved_at) where resolved_at is null;

-- RLS : seuls les managers peuvent lire/écrire.
alter table public.app_errors enable row level security;

create policy "managers_read_errors"
  on public.app_errors for select
  using (
    exists (
      select 1 from consultants
      where auth_user_id = auth.uid()
        and role in ('manager', 'back_office')
    )
  );

-- L'écriture se fait via service role (/api/errors), RLS bypassée.
-- Pas de policy INSERT explicite → anon/authenticated ne peuvent pas écrire.
```

### 2. Endpoint `/api/errors` (POST)

- Input : `{ source, route, message, stack, extra }`
- Utilise service role pour insérer (bypass RLS).
- Rate-limit 10 erreurs/minute/IP pour éviter les floods.
- Logs PII minimisés : pas de body, pas de cookies.

### 3. Client-side capture

- `components/error-boundary.tsx` (React Error Boundary de haut niveau dans `app/layout.tsx`).
- `useEffect` dans `layout.tsx` : attache `window.addEventListener('error', ...)` et `window.addEventListener('unhandledrejection', ...)`.
- Les deux posent sur `/api/errors` avec `source: 'client'`.

### 4. Server-side capture

- Wrapper `withErrorLogging(handler)` pour les route handlers API.
- Log `source: 'server'` avec stack + route.

### 5. Page admin `/dashboard/parametres/erreurs`

- Liste les erreurs non résolues (triées desc).
- Bouton "marquer résolu" pour un consultant manager.
- Filtres par source / route / période.

## Étapes d'implémentation

1. Créer branche `feat/error-tracking`.
2. Écrire migration SQL dans `scripts/migrations/2026-04-22_app_errors.sql`.
3. Appliquer la migration en prod Supabase **avant** de push la route (sinon build Next plante sur les types).
4. `npx supabase gen types typescript --project-id <id> > src/types/database.ts` pour régénérer les types.
5. Coder `/api/errors` + `ErrorBoundary` + page admin.
6. Tester en local avec un `throw new Error('test')` volontaire.
7. PR + merge.

## Coût

- Supabase : stockage quasi nul (une erreur ≈ 2 Ko, on est loin des limites gratuites).
- Vercel : un POST par erreur, négligeable.
- Temps dev : ~3-4h une fois la migration appliquée.

## Alternatives si l'approche maison devient insuffisante

- **Sentry** (gratuit 5k events/mois) — recommandé si on dépasse 50 erreurs/jour en prod.
- **PostHog** — plus analytics mais fait aussi le capture.
- **Highlight.io** — opensource self-host possible.

Décision : pas de SaaS tant qu'on reste < 5 users actifs en prod.
