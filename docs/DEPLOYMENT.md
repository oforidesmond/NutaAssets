# Deploying AssetTrack on Vercel

Step-by-step for the Hobby (free) tier with Vercel Postgres / Neon.

## 1. Create the Vercel project

1. Push this repo to GitHub (or import from the local folder with the Vercel CLI).
2. In [vercel.com](https://vercel.com), **Add New → Project** and import the repository.
3. Framework preset: **Next.js**. Leave the root directory as the repo root.

Do **not** deploy yet — add storage and env vars first.

## 2. Add Postgres (Neon via Vercel Storage)

1. In the project → **Storage** → create **Postgres** (Neon marketplace / Vercel Postgres).
2. Connect it to the project. Vercel injects connection strings.
3. Confirm you have both:
   - `DATABASE_URL` — **pooled** connection (runtime / serverless)
   - `DIRECT_URL` — **non-pooled** (Prisma migrations)

If only one URL is provided, duplicate it into both for local-style Postgres; on Neon, prefer the pooled URL for `DATABASE_URL` and the direct URL for `DIRECT_URL` (see Neon + Prisma docs).

## 3. Environment variables

In **Settings → Environment Variables**, set for Production (and Preview if you use it):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Pooled Postgres URL from Storage |
| `DIRECT_URL` | Direct (non-pooled) URL for migrations |
| `AUTH_SECRET` | Long random string (≥32 chars). Generate with `openssl rand -base64 32` |
| `AUTH_URL` | Public site URL, e.g. `https://your-app.vercel.app` |
| `SEED_ADMIN_EMAIL` | First Super Admin email (seed only) |
| `SEED_ADMIN_PASSWORD` | Temp password (≥8 chars); user must change on first login |
| `SMS_PROVIDER` | `ebits` (sends login credentials by SMS on user create / password reset) |
| `EBITS_SMS_BASE_URL` | e.g. `https://alerts.ebitsgh.com` |
| `EBITS_SMS_API_KEY` | ebits API key (header `api-key`) |
| `EBITS_SMS_SENDER_ID` | Approved sender ID string |

SMS vars are optional for boot/local without SMS; without them, user create/reset still works but credentials are not delivered by SMS.

Optional later: Blob token if you enable photo attachments (app works without Blob).

Copy the same keys into a local `.env` from `.env.example` for development.

## 4. Build & migrate settings

**Build Command** (Project → Settings → General → Build & Development Settings):

```bash
npx prisma migrate deploy && next build
```

**Install Command** (default is fine):

```bash
npm install --legacy-peer-deps
```

`postinstall` already runs `prisma generate`.

## 5. Deploy

Trigger a deployment (git push or Deploy). On success:

1. Open the production URL.
2. You should land on login — the DB is migrated but **empty of seed data** until you seed once.

## 6. Seed the Super Admin (one-time)

From your machine (with Production env vars, or via `vercel env pull`):

```bash
npx vercel env pull .env.production.local
# Ensure DATABASE_URL / DIRECT_URL / SEED_ADMIN_* are set
npx dotenv -e .env.production.local -- npm run db:seed
```

Or run against the production DB URL locally:

```bash
DATABASE_URL="..." DIRECT_URL="..." SEED_ADMIN_EMAIL="..." SEED_ADMIN_PASSWORD="..." npm run db:seed
```

Seed creates:

- Super Admin from `SEED_ADMIN_*` (`mustChangePassword: true`)
- ICT department, statuses, categories, branches, starter custom fields
- Org settings (name, tag template)

Sign in, change password when prompted, then configure branches/codes if needed.

## 7. Post-deploy checklist

- [ ] Login + forced password change works
- [ ] Department switcher shows ICT
- [ ] Add one asset on mobile width
- [ ] Import sample workbook from `docs/sample/`
- [ ] Create a short reconciliation exercise
- [ ] Dashboard KPIs load; Reports print
- [ ] `AUTH_URL` matches the real domain (update if you attach a custom domain)

## 8. Custom domain

1. Vercel → Project → Domains → add your domain.
2. Update `AUTH_URL` to `https://your.domain` and redeploy.

## 9. Free-tier constraints (already designed for)

- Bulk import/export and reconciliation apply run in **chunks of 200** with progress UI.
- Excel is parsed **in the browser**; only JSON chunks hit the server (~4.5 MB body limit).
- No local disk writes; optional attachments use Vercel Blob when configured.
- Serverless timeouts are short — avoid whole-table loads; lists are paginated.

## 10. Local parity

```bash
cp .env.example .env
npm install --legacy-peer-deps
npx prisma migrate deploy
npm run db:seed
npm run dev
```

See [README.md](../README.md) and [USER_GUIDE.md](USER_GUIDE.md).
