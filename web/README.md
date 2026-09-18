# Al Khadim — Web App

Next.js 14 app containing the public website, admin panel, candidate portal, company portal **and the backend API** (`/api/*`). It replaces the Express server in `../api`, which is kept only for reference.

## Getting started

```bash
cp .env.example .env        # then fill in DATABASE_URL, JWT secrets, ...
npm install                 # also runs `prisma generate`
npm run db:deploy           # apply migrations (use `npm run db:migrate` when changing the schema)
npm run db:seed             # admin account + reference data + demo data
npm run dev                 # http://localhost:3000
```

Log in at `/login` with `admin@alkhadim.ae` / `Admin@123` (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` before seeding, and change it in production).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build / server |
| `npm run db:migrate` | Create + apply a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Seed data (idempotent; never overwrites existing rows) |
| `npm run test:server` | API test server on :3200 (own build dir, rate limits off) |
| `npm run test:api` | Run the API integration tests against the test server |

## Backend layout

```
prisma/
  schema.prisma          data model (44 models)
  migrations/            migration history
  seed.ts, seed-data/    seed script
src/app/api/**/route.ts  routes — the folder path is the URL; files only map HTTP methods to controllers
src/app/uploads/         serves uploaded files at /uploads/...
src/server/
  controllers/           one controller per module (request handling + business logic)
  http.ts                handler() wrapper, json(), query(), body(), HttpError
  auth.ts                requireStaff(req, ...roles), requireCandidate, requireClient, ...
  validate.ts            pickFields (allow-lists), escapeHtml, pagination, toNumber/toDate
  upload.ts              multipart uploads → uploads/<images|documents|misc>/
  rateLimit.ts           per-IP limiter (in-memory)
  utils/                 mailer, email templates, OTP, CV parser, audience queries, ...
  ai/                    AI assistant tools
  scheduler/             scheduled-email sender (started from src/instrumentation.ts)
src/lib/prisma.ts        Prisma client singleton
```

Adding an endpoint: write the handler in the module's controller (wrap it in `handler()`, start with the right `require*` guard, whitelist the body with `pickFields`), then export it from a `route.ts` at the matching path with `export const dynamic = 'force-dynamic'`.

## Auth

- **Staff** (admin panel): `POST /api/auth/login` → access token (Bearer) + refresh token. Roles: SUPER_ADMIN, ADMIN, MANAGER, RECRUITER, HR, ACCOUNTANT, VIEWER.
- **Candidates**: `/api/candidate-auth/*` (register with email OTP → admin approves → login).
- **Company users**: `/api/client-auth/*` (register with email OTP → admin approves → login; team invites).

## Environment

See `.env.example`. Without `SMTP_HOST`, emails are logged to the server console instead of sent (and outside production the OTP endpoints return the code as `devCode`). Without `OPENAI_API_KEY` the AI assistant is disabled.

## Tests

Integration tests in `tests/api/` call a running server over HTTP and use the database in `.env`; every test deletes what it creates.

```bash
npm run test:server   # terminal 1
npm run test:api      # terminal 2
```

## Deployment

**VPS (as in ../START.md):** `npm ci && npm run build && npm run db:deploy && npm start` behind Nginx (PM2 for process management). Keep the `uploads/` folder on persistent disk and back it up with the database.

Run a **single instance**: the rate limiter and the email scheduler live in the server process, so serverless hosting or multiple replicas would need a shared store (e.g. Redis) and an external cron instead.
