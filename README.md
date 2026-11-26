# DocTayo Web

Frontend for DocTayo, a multi-tenant clinic-management system for clinics in the Philippines.
Single-page app: React 19, TypeScript, Vite, TanStack Router/Query, shadcn/ui, Tailwind CSS v4.

- Plan: [plan.md](plan.md) and [plans/](plans/). Conventions: [AGENTS.md](AGENTS.md).
- Backend contract: [docs/](docs/) (start with [frontend-integration.md](docs/frontend-integration.md)).

**Status:** Phases 1 (foundation) and 2 (design system) are built; the style guide awaits the product owner's
approval before any feature screen is built. There are no product screens yet; the home page only shows whether
the API is reachable. Run `npm run storybook` to see the design system.

## Run it with Docker (recommended)

You need Docker (Compose v2) and the backend repository checked out next to this one (`../doc-tayo-api`).

```bash
docker compose up --build         # database + migrations + API + dev server
docker compose run --rm seed      # dev clinic and users (needed from Phase 3)
```

Open http://localhost:5173 (hot reload). Seeded accounts (password `dev-password-change-me-123`):
`owner@sunrise.test` (Owner), `clinic-admin@sunrise.test` (Clinic admin), `doctor@sunrise.test` (Doctor) and `reception@sunrise.test` (Receptionist). Emails (reset, setup, invitation links)
are printed in the API's logs: `docker compose logs -f api`.

Everything else runs in Docker too:

| Command                                | What it does                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `docker compose run --rm web npm test` | unit and component specs (also `lint`, `typecheck`, `format:check`, ...)           |
| `docker compose run --rm e2e`          | Playwright on Chromium, Firefox, WebKit and a phone viewport, against the real API |
| `docker compose up storybook`          | the style guide, http://localhost:6006                                             |
| `docker compose up --build web-prod`   | the production image (nginx), http://localhost:8080                                |
| `docker compose down`                  | stop (add `-v` to also delete the database)                                        |

The full guide, with how it works and troubleshooting, is [docs/docker.md](docs/docker.md). Do not run this stack
and the backend's own `docker-compose.yml` together: they use the same ports.

## Run it without Docker

Prerequisites: **Node 24** (`.nvmrc`; with nvm: `nvm use`), and the API running somewhere.

1. **Start the API** (in `../doc-tayo-api`). It must allow this app's origins and cookies:

   ```bash
   export CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
   docker compose up --build -d            # API on :3000 and Postgres
   npm run db:seed:dev                     # development clinic and users (needed from Phase 3); also admin@doctayo.test, the platform admin
   ```

   Or put `CORS_ALLOWED_ORIGINS=...` and `CORS_ALLOW_CREDENTIALS=true` in the API's `.env`. `4173` is the
   preview server the e2e tests use. Check: `curl http://localhost:3000/api/health`.

2. **Start the app** (this repository):

   ```bash
   npm ci
   npm run dev        # http://localhost:5173
   ```

Settings are documented in [docs/environment.md](docs/environment.md) and validated at startup.

## Scripts

| Script                                                   | Purpose                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `npm run dev` / `build` / `preview`                      | Dev server, type-check + production build, preview           |
| `npm run lint` / `format` / `format:check` / `typecheck` | Quality gates                                                |
| `npm test`                                               | Unit and component specs (Vitest, axe inside)                |
| `npm run test:e2e`                                       | Playwright, real API (below)                                 |
| `npm run api:sync`                                       | Copy the contract from `../doc-tayo-api`, regenerate types   |
| `npm run api:generate` / `api:check`                     | Regenerate / verify `src/api/schema.d.ts`                    |
| `npm run i18n:extract` / `i18n:check`                    | Update / verify the message catalogues                       |
| `npm run size`                                           | Startup and per-chunk bundle budgets (after `npm run build`) |
| `npm run storybook` / `storybook:build`                  | The style guide: every token and component, every state      |
| `npm run tokens:build` / `tokens:check`                  | Generate / verify the design token files                     |

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

**The staff and account specs** (`tests/e2e/staff.spec.ts`, `tests/e2e/account-email.spec.ts`) use the seeded
Sunrise accounts (`owner@`, `clinic-admin@`, `doctor@`, `reception@sunrise.test`). `staff.spec.ts` changes the
seeded doctor and puts everything back; `account-email.spec.ts` invites a NEW person and reads that person's
invitation and email-change links from the API's emails, so it needs `MAIL_TRANSPORT=file` and the same
`CORS_ALLOWED_ORIGINS` / `APP_PUBLIC_URL` as below. Each run leaves a revoked invitation and one new
`e2e-acct-...@example.test` account behind (neither can be deleted). Running several specs back to back may
hit the API's limit of 30 page refreshes a minute per address; if the last spec fails, run it again alone.

**The clinic settings spec** (`tests/e2e/clinic-settings.spec.ts`) creates a clinic and its owner the same way as the platform admin spec below (so it needs the same API setup and `admin@doctayo.test`), changes only that new clinic, and reads Sunrise Clinic as the seeded receptionist and owner. It runs in Chromium only and leaves a new "E2E Clinic ..." with its branches behind.

**The patient spec** (`tests/e2e/patients.spec.ts`) only reads: it needs the patients that `npm run db:seed:dev`
registers, and signs in as `reception@sunrise.test` and `owner@lakeside.test`.

`tests/e2e/patient-registration.spec.ts` registers, edits, archives and restores patients, and archives them afterwards (they cannot be
deleted); it also signs in as `multi@doctayo.test` to switch clinics between two tabs.

`tests/e2e/practitioners.spec.ts` reads the practitioners that `npm run db:seed:dev` creates since backend
sub-phase 5.2 (run it again on an older database).

`tests/e2e/practitioner-management.spec.ts` adds, edits, deactivates and reactivates a practitioner and edits
their weekly schedule (with a second branch) in a new clinic, so it needs the same API setup as the platform admin spec below (`MAIL_TRANSPORT=file` and
`admin@doctayo.test`); it signs in as `owner@sunrise.test` for the cross-clinic check. It runs in Chromium only
and leaves a new "E2E Practice ..." clinic behind.

**The platform admin spec** (`tests/e2e/platform-admin.spec.ts`) creates a clinic and an owner, then reads
the owner's setup link from the API's emails. So the API must run with `MAIL_TRANSPORT=file` (it writes to
its `var/mail`; with Docker: `MAIL_TRANSPORT=file docker compose up -d api`, and the e2e container reads the
same volume), its `CORS_ALLOWED_ORIGINS` and `APP_PUBLIC_URL` must be `http://localhost:4173`, and the
backend's dev seed must have run (it creates `admin@doctayo.test`). It runs in Chromium only, and each run
leaves a deactivated "E2E Clinic ..." behind. Without Docker, point the app at your API with
`VITE_API_ORIGIN=http://localhost:<port> npx playwright test --project=chromium`; Firefox and WebKit need the
Docker e2e image (their system libraries are missing on most machines). The API limits sign-ins to 5 per 15
minutes per account: restart the API (it keeps the counts in memory) if you run the suite several times.
After pulling backend changes, **restart your API**: `nest start` without `--watch` keeps running the old build, and an API that predates `platformRole` on `GET /me` makes the app treat a platform admin as a clinic user with no clinic (the clinic picker's "You don't have a clinic you can open right now").

**CI:** the `verify` job (lint, format, types, contract check, catalogues, unit tests in two time zones,
build, size) runs on every push. The real-API `e2e` job is skipped until the repository variable
`E2E_BACKEND_REPOSITORY` and the secret `E2E_BACKEND_TOKEN` give it access to the backend (plan.md D-14), so
**CI does not yet run the e2e suite**; run it locally.

## Deployment

Static build to S3 + CloudFront from GitHub Actions on a merge to `main`; see
[docs/deployment.md](docs/deployment.md). It is switched off until the domain and AWS resources exist.
