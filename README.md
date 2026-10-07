# AssetTrack

ICT (and multi-department) asset management for community banks — built for messy real-world Excel inventories and branch reconciliation.

## Stack

- Next.js (App Router) + TypeScript
- Prisma + PostgreSQL (Neon / Vercel Postgres)
- Auth.js (credentials + JWT)
- Tailwind CSS + shadcn/ui

## Quick start

1. Copy env and fill in values:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   npm install --legacy-peer-deps
   ```

3. Apply migrations and seed (ICT department, branches, statuses, Super Admin):

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

5. Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, then set a new password when prompted.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:migrate:deploy` | Apply migrations (CI/prod) |
| `npm run db:seed` | Seed Super Admin + ICT config |
| `npm run db:studio` | Prisma Studio |

## Environment

See [`.env.example`](.env.example). Use pooled `DATABASE_URL` at runtime and `DIRECT_URL` for migrations when using Neon.

## Docs

- [Project brief](docs/PROJECT_BRIEF.md)
- [Decisions](docs/DECISIONS.md)

## Phase status

**Phase 1 (Foundation)** — scaffold, schema/seed, auth, RBAC, app shell, audit plumbing, CI.

**Phase 2 (Core register)** — branches/locations/categories/statuses admin; assets list (search, filters, column chooser, saved views, bulk actions); add/edit/detail with history; soft delete + recycle bin; duplicate soft-warnings.

Deferred to later phases: custom fields UI (P3), import/export/labels/scan (P4), reconciliation (P5), dashboard KPIs (P6).
