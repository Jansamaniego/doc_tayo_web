# DocTayo Web

Frontend for DocTayo, a multi-tenant clinic-management system for clinics in the Philippines.
Single-page app: React 19, TypeScript, Vite, TanStack Router/Query, shadcn/ui, Tailwind CSS v4.

- Plan: [plan.md](plan.md) and [plans/](plans/). Conventions: [AGENTS.md](AGENTS.md).
- Backend contract: [docs/](docs/) (start with [frontend-integration.md](docs/frontend-integration.md)).

**Status:** Phase 1 (foundation) is built. There are no product screens yet; the home page only shows
whether the API is reachable.

## Prerequisites

- **Node 24** (`.nvmrc`; with nvm: `nvm use`).
- Docker, to run the API locally.
- The backend repository checked out next to this one: `../doc-tayo-api`.

## Run it locally

1. **Start the API** (in `../doc-tayo-api`). The API must allow this app's origins and cookies:

   ```bash
   export CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
   docker compose up --build -d            # API on :3000 and Postgres
   docker compose run --rm --build migrate # apply migrations
   npm run db:seed:dev                     # development clinic and users (needed from Phase 3)
   ```

   Or put `CORS_ALLOWED_ORIGINS=...` and `CORS_ALLOW_CREDENTIALS=true` in the API's `.env`. `4173` is the
   preview server the e2e tests use. Check: `curl http://localhost:3000/api/health`.

2. **Start the app** (this repository):

   ```bash
   npm ci
   npm run dev        # http://localhost:5173
   ```

Seeded accounts (password `dev-password-change-me-123`): `owner@sunrise.test` (Owner) and
`reception@sunrise.test` (Receptionist). Emails (reset, setup, invitation links) are printed in the API's
console at `LOG_LEVEL=debug`; see [docs/frontend-integration.md](docs/frontend-integration.md) §2.

Settings are documented in [docs/environment.md](docs/environment.md) and validated at startup.

## Scripts

| Script                                                   | Purpose                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `npm run dev` / `build` / `preview`                      | Dev server, type-check + production build, preview         |
| `npm run lint` / `format` / `format:check` / `typecheck` | Quality gates                                              |
| `npm test`                                               | Unit and component specs (Vitest, axe inside)              |
| `npm run test:e2e`                                       | Playwright, real API (below)                               |
| `npm run api:sync`                                       | Copy the contract from `../doc-tayo-api`, regenerate types |
| `npm run api:generate` / `api:check`                     | Regenerate / verify `src/api/schema.d.ts`                  |
| `npm run i18n:extract` / `i18n:check`                    | Update / verify the message catalogues                     |
| `npm run size`                                           | Bundle-size budget (after `npm run build`)                 |

## When the backend changes its contract

```bash
npm run api:sync   # BACKEND_OPENAPI_PATH overrides ../doc-tayo-api/docs/openapi.json
```

Commit both `docs/openapi.json` and `src/api/schema.d.ts`. CI fails if they disagree.

## End-to-end tests

They need the real API running (see above) and a Playwright browser:

```bash
npx playwright install chromium firefox webkit   # Linux may also need: npx playwright install-deps
npm run test:e2e                                 # builds with --mode e2e and serves on :4173
npm run test:e2e -- --project=chromium           # one project
```

Projects: Chromium, WebKit, Firefox, and a 360x800 mobile viewport. Every spec fails on any
Content-Security-Policy violation and runs axe.

**CI:** the `verify` job (lint, format, types, contract check, catalogues, unit tests in two time zones,
build, size) runs on every push. The real-API `e2e` job is skipped until the repository variable
`E2E_BACKEND_REPOSITORY` and the secret `E2E_BACKEND_TOKEN` give it access to the backend (plan.md D-14), so
**CI does not yet run the e2e suite**; run it locally.

## Deployment

Static build to S3 + CloudFront from GitHub Actions on a merge to `main`; see
[docs/deployment.md](docs/deployment.md). It is switched off until the domain and AWS resources exist.
