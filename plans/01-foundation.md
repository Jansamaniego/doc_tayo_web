# Phase 1: Project foundation

Status: **built** (2026-11-20). The stack is approved with shadcn/ui (plan.md §4, Q1). Backend: none beyond `GET /api/health` (available). Where the code differs from the text below, the text has been corrected and the difference is listed in §7 "As Built".

No product features in this phase. It ends with an empty but complete, tested, linted, CI-checked app that later phases build on.

## 1. Objectives

1. Scaffold the app with the approved stack (plan.md §4: React, Vite, TanStack, shadcn/ui on Tailwind v4, Node 24) and strict TypeScript.
2. Make the **contract the only way to call the API**: generated types, one HTTP client, one error type.
3. Put every quality gate in place on day one: lint, format, type-check, unit, component, e2e, accessibility, bundle size, CI.
4. Write this repository's `AGENTS.md` (imported by `CLAUDE.md`) with the coding conventions, so later work follows them automatically.
5. Set up i18n from day one: every string in Lingui message files (English catalogue plus a stretched pseudo-locale), with no hard-coded text. Filipino ships after launch (Phase 14, plan.md Q4a).
6. Deploy the static build from GitHub Actions to S3 + CloudFront on a merge to `main` (plan.md Q2b).

## 2. Deliverables

### 2.1 Scaffold

- Vite + React 19 + TypeScript.
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. Path alias `@/` → `src/`.
- **Node 24**, matching the backend: `.nvmrc` = `24`, `package.json` `engines.node` = `>=24`; CI reads `.nvmrc`.
- **Tailwind CSS v4** and **shadcn/ui** initialised (`components.json`, aliases pointing into `src/design-system/`). Phase 1 adds only `Button` (for the example component test). The rest come in Phase 2.
- `.gitignore`, `.editorconfig`, `.prettierrc.json` (the repository was already initialised, branch `develop`).

### 2.2 Folder structure

```
src/
  app/
    App.tsx                 providers: QueryClient, Router, I18n, Session
    boot.ts                 startup: validate env -> try refresh -> render
    RootErrorBoundary.tsx
  routes/                   TanStack Router file-based routes
    __root.tsx
    index.tsx               placeholder home ("DocTayo" + API health status)
    $.tsx                   not-found page
  features/                 empty; first feature arrives in Phase 3
  design-system/            empty skeleton; filled in Phase 2
    tokens/
    components/
    patterns/
  api/
    schema.d.ts             GENERATED (npm run api:sync / api:generate); never edited, committed
    client.ts               openapi-fetch instance + middleware
    errors.ts               ApiError (from the generated ErrorResponse), isApiError(), toApiError()
    request-id.ts           UUIDv7 generator for X-Request-Id
    session/                token store (in-memory) + refresh coordination skeleton (finished in Phase 3)
  lib/
    datetime/               the only UTC <-> clinic-time conversion + date/time formatting, with specs
    money.ts                peso formatting
  i18n/
    lingui config; catalogue en; pseudo-locale for layout tests (fil added in Phase 14)
  config/
    env.ts                  Zod-validated config
    csp.ts                  the content security policy (one source for CloudFront, preview and dev)
  test/
    setup.ts                Testing Library, vitest-axe matchers, MSW server
    msw/handlers.ts         typed default handlers (health)
    render.tsx              renderWithProviders()
tests/e2e/
  smoke.spec.ts
  fixtures/                 seeded accounts (from the backend's dev seed)
.github/workflows/ci.yml
```

Rules (also written into `AGENTS.md`):

- Group by feature, then by concern. Never create a folder for one file.
- `routes/` files stay thin: they guard and compose; logic lives in `features/`.
- Feature code may import from `design-system/`, `api/`, `lib/`, `i18n/`, never from another feature's internals. Each feature exposes an `index.ts`. This boundary is enforced with ESLint `import/no-restricted-paths`.
- `design-system/` imports nothing from `features/` or `api/`.

### 2.3 Naming conventions

| Kind                                      | Pattern                                                                   | Example                     |
| ----------------------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| Component                                 | `PascalCase.tsx`, named export                                            | `PageHeader.tsx`            |
| Hook                                      | `useThing.ts`                                                             | `useBranches.ts`            |
| Other module                              | `kebab-case.ts`                                                           | `request-id.ts`             |
| Unit/component test (Q10, as the backend) | `*.spec.ts(x)` next to the file it tests; axe checks inside the same spec | `request-id.spec.ts`        |
| Story                                     | `*.stories.tsx` next to the component                                     | `Button.stories.tsx`        |
| E2E                                       | `tests/e2e/<feature>.spec.ts`; axe on each page inside the same spec      | `tests/e2e/sign-in.spec.ts` |

Both runners use `.spec.ts`, so they are separated by folder: Vitest `include: ['src/**/*.spec.{ts,tsx}']`; Playwright `testDir: 'tests/e2e'`.
| Query keys | `[clinicId, 'branches', params]`; built by a per-feature key factory | `branchKeys.list(params)` |

### 2.4 Environment configuration

- `src/config/env.ts` parses `import.meta.env` with Zod:
  - `VITE_API_ORIGIN` (origin only: scheme, host, port; no path, no trailing slash)
  - `VITE_APP_ENV` (`development | staging | production`)
  - `VITE_ERROR_REPORTING_DSN` (optional)
- `parseEnv(raw)` returns `{ ok, env }` or `{ ok: false, invalidKeys }` (names only); `getEnv()` memoises it. On failure, `src/main.tsx` renders a plain "This app is misconfigured" page listing the bad keys (names only, no values), not a blank screen.
- `.env.example` documents every variable. `docs/environment.md` explains each and lists the API-side settings the developer needs (`CORS_ALLOWED_ORIGINS=http://localhost:5173`, `CORS_ALLOW_CREDENTIALS=true`).
- Per-environment files: `.env.development` (committed, local API `http://localhost:3000`), `.env.test`, `.env.e2e` (the e2e build mode) and `.env.production` (committed, non-secret: `VITE_API_ORIGIN=https://api.<domain>`, a placeholder until the domain is decided, Q2c). Vite inlines these at build time, so the production build is made for one environment. There are no secrets in the frontend.
- `docs/environment.md` repeats the **hard constraint**: the app and the API are subdomains of the same registrable domain (for example `app.doctayo.ph` / `api.doctayo.ph`). The API's `CORS_ALLOWED_ORIGINS` must contain the app's origin, and its `APP_PUBLIC_URL` must point at the app.

### 2.5 Typed API client

- **`npm run api:sync`** (Q12) does two steps:
  1. Copies `openapi.json` from the backend checkout into this repo's `docs/openapi.json`. The source path comes from `BACKEND_OPENAPI_PATH`, default `../doc-tayo-api/docs/openapi.json`, and the script fails with a clear message if the file is missing.
  2. Runs `api:generate`.
     Both the copied JSON and the generated types are committed. Run it whenever the backend changes its contract; the backend regenerates its own `openapi.json`, and a backend test fails if it is stale.
- `npm run api:generate` runs `openapi-typescript docs/openapi.json -o src/api/schema.d.ts`.
- `npm run api:check` regenerates to a temporary file and **fails CI if it differs** from the committed types, so the types can never drift from the committed JSON.
- **No hand-written type fixes are needed.** openapi-typescript 7.13.0 was run on the current `docs/openapi.json` while planning:
  - nullable fields come out as `string | null`;
  - roles come out as `{ key, name }[]`;
  - error bodies come out as `ErrorResponse` with `ErrorCode` / `FieldErrorCode` unions.
    For the record, the earlier `type: object, nullable: true` shape generated `Record<string, never> | null` (also checked). The backend fixed it before this phase started.
- Exported named aliases (`type Branch = components['schemas']['BranchResponse']`, etc.) live next to the feature that uses them, so components never write `components['schemas'][...]` inline.
- `client.ts`: one `openapi-fetch` client created with `baseUrl` = the validated `VITE_API_ORIGIN`. It is the only place that calls `fetch` for the API (ESLint `no-restricted-globals` for `fetch` outside `src/api/`).

### 2.6 HTTP layer (middleware)

| Order | Middleware                                                                                                                                                                                                                                               | Phase 1                                            | Completed in                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| 1     | Request id: `X-Request-Id` = UUIDv7                                                                                                                                                                                                                      | done                                               |                                |
| 2     | Credentials: `credentials: 'include'` for `/auth/*`                                                                                                                                                                                                      | done                                               |                                |
| 3     | Bearer token from the in-memory store (no-op while empty)                                                                                                                                                                                                | done                                               |                                |
| 4     | Error parsing: non-2xx → `ApiError { status, code, message, details?, requestId, retryAfterSeconds? }`; network failure → `ApiError { code: 'NETWORK_ERROR' }` (client-only code); a body that is not JSON → `INTERNAL_ERROR` with the header request id | done                                               |                                |
| 5     | Expired token: serialised refresh + one retry                                                                                                                                                                                                            | skeleton + unit tests of the single-flight promise | Phase 3 (Web Locks, cross-tab) |

- The error code types come from the **generated** `ErrorCode` and `FieldErrorCode` enums.
- The client adds one code of its own, `NETWORK_ERROR`, kept in a separate union so it can never be confused with a server code.
- `messageFor(error)` returns a Lingui message keyed by `code`. English texts are drafted from the "Do this" column of the integration guide §6. The API's `message` is used only for a code the generated enum does not know.
- A unit test checks that every enum value has a message in the English catalogue (Phase 14 extends it to Filipino).

### 2.7 Routing skeleton

- TanStack Router with file-based routes and generated route tree.
- `__root.tsx`: skip link ("Skip to main content"), `<main id="main">`, route announcer (the page title is announced on navigation for screen readers), focus moved to the `h1` on route change.
- Placeholder routes: `/` (calls `GET /api/health` and shows "API reachable" / "API not reachable"), not-found.
- Empty route groups are written down but **not created** until their phase (no empty folders).

### 2.8 Date, time and money helpers (used everywhere later)

- **`src/lib/datetime/` is the only module that converts between UTC (API) and clinic time (UI)**, using `@date-fns/tz`:
  - `toClinicDateTime({ iso, timeZone })` converts an API timestamp into plain parts (date + wall-clock time) for display and for pickers;
  - `fromClinicDateTime({ date, time, timeZone })` converts what the user picked into an ISO UTC string for the API;
  - `formatDate({ iso, timeZone, locale, style })` and `formatTime({ iso, timeZone, locale })` format via `Intl` (`en-PH` now).
    The time zone is **required** and never defaults to the device. No other file may import `@date-fns/tz` or construct `Date` from user input (lint rule).
- **Date tests run under a foreign time zone:** the Vitest config sets `process.env.TZ = 'America/New_York'` before tests start, so any code that uses the computer's local time gives wrong answers and fails. CI also runs the date specs a second time with `TZ=Asia/Manila`.
- `formatPeso({ amount, locale })`: input type decided by D-12. Phase 1 accepts integer centavos and is marked provisional.

### 2.9 Testing setup (one passing example each)

| Type                      | Tool                           | Example test                                                                                                                                                                                                                       |
| ------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                      | Vitest                         | `lib/datetime/datetime.spec.ts` (runner `TZ=America/New_York`): a UTC timestamp shows in Asia/Manila (UTC+8) correctly across midnight; a picked Manila date and time converts to the right UTC instant; the time zone is required |
| Unit                      | Vitest                         | `errors.spec.ts`: parses the documented error body; maps a network failure; keeps `requestId`; every `ErrorCode`/`FieldErrorCode` has an English message                                                                           |
| Component                 | Vitest + Testing Library + MSW | `HomePage.spec.tsx`: shows "API reachable" when the MSW health handler answers 200, and the error state on 503                                                                                                                     |
| Accessibility (component) | vitest-axe                     | the same component test asserts `expect(await axe(container)).toHaveNoViolations()`                                                                                                                                                |
| E2E                       | Playwright                     | `tests/e2e/smoke.spec.ts`: opens `/`, sees the heading, the health status is "reachable" (real API), **no CSP violation reported**                                                                                                 |
| Accessibility (e2e)       | @axe-core/playwright           | the smoke test runs axe on `/` (WCAG 2.2 AA tags), zero violations                                                                                                                                                                 |

- Playwright config (Q9): projects for **Chromium, WebKit and Firefox, plus one mobile viewport** (Android mid-range, about 360×800). `baseURL` is the Vite preview server (`http://localhost:4173`, so the API's local `CORS_ALLOWED_ORIGINS` must include it). API URL from env. Traces on failure. Tablets and real phones from the device list are checked by hand.
- `tests/e2e/fixtures/accounts.ts`: `owner@sunrise.test`, `reception@sunrise.test`, with the password read from an env variable that defaults to the documented dev-seed password. This is for local and CI only.
- Coverage: reported, no threshold in Phase 1 (proposed: 80% lines on `src/api/` and `src/lib/` from Phase 3).

### 2.10 Lint, format, type-check

| Script                                 | Does                                                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                          | Vite on `http://localhost:5173`                                                                                                                                                         |
| `npm run build`                        | type-check + production build                                                                                                                                                           |
| `npm run preview`                      | serve the build (e2e target)                                                                                                                                                            |
| `npm run lint`                         | ESLint (typescript-eslint strict-type-checked, react-hooks, jsx-a11y strict, import order and boundaries, no-restricted-globals for `fetch` and `localStorage` outside allowed modules) |
| `npm run format` / `format:check`      | Prettier                                                                                                                                                                                |
| `npm run typecheck`                    | `tsc --noEmit`                                                                                                                                                                          |
| `npm run test`                         | Vitest (unit + component)                                                                                                                                                               |
| `npm run test:e2e`                     | Playwright                                                                                                                                                                              |
| `npm run api:sync`                     | copy `openapi.json` from the backend checkout (`BACKEND_OPENAPI_PATH`) and regenerate the types                                                                                         |
| `npm run api:generate` / `api:check`   | generate / verify API types                                                                                                                                                             |
| `npm run size`                         | bundle-size budget (size-limit): sign-in route entry ≤ 170 KB gzip (plan.md §11)                                                                                                        |
| `npm run i18n:extract`                 | Lingui extraction; CI fails if catalogues are stale or a hard-coded string is found                                                                                                     |

`localStorage` and `sessionStorage` are banned by lint outside an allow-listed `lib/preferences.ts`. That module holds non-sensitive device preferences only ("this is a shared computer", last-used branch id, and the language from Phase 14). This enforces the privacy rule.

### 2.11 CI and deployment (GitHub Actions, as the backend; Q2b)

`.github/workflows/ci.yml` follows the backend's `ci.yml`:

- triggers on `pull_request` and pushes to `main`;
- `permissions: contents: read`, a `concurrency` group, pinned action versions;
- `actions/setup-node` with `node-version-file: .nvmrc` and the npm cache, then `npm ci`.

Jobs (the owner's list, plus the gates this plan adds):

1. **verify**:
   - lint, format check, type-check;
   - `api:check` (types match the committed JSON) and `i18n:extract --check`;
   - unit/component tests (`npm test`, with the `TZ` rule above);
   - build, then `size`.
2. **e2e**: real API per **D-14**.
   - The workflow checks out `doc-tayo-api` and starts `postgres:17-alpine` as a service.
   - It runs the backend's bootstrap SQL, migrations and `db:seed:dev`.
   - It starts the API with `CORS_ALLOWED_ORIGINS=http://localhost:4173` and `CORS_ALLOW_CREDENTIALS=true`. The backend's own CI sets `false`, which would break the refresh cookie.
   - Then Playwright runs against `npm run preview`.
     Until D-14 is settled (repository access or a published image), this job is marked "pending", and the real-API run is local only. The README says so, so no one assumes CI covers it.
3. **storybook** (from Phase 2): build Storybook and run the test runner with axe.
4. **audit**: `npm audit --omit=dev --audit-level=high`, informational at first (as the backend).

`.github/workflows/deploy.yml`, **on a merge to `main`** (Q2b):

1. Build with the production `.env`.
2. Sync `dist/` to the S3 bucket: hashed assets with `Cache-Control: public, max-age=31536000, immutable`, then `index.html` with `no-cache`.
3. Invalidate `/index.html` in CloudFront.

- **AWS credentials:** GitHub's OIDC role (no long-lived keys).
- **Independent of the backend's deployment**, which is not designed yet (backend Phase 7).
- The workflow does nothing until the AWS resources and the domain exist (Q2c). These resources are documented in `docs/deployment.md`:
  - the bucket (private, reached only through CloudFront);
  - the distribution, with `index.html` returned for app routes;
  - the response headers policy carrying the CSP and other security headers;
  - an ACM certificate in `us-east-1` (required for CloudFront);
  - the OIDC role.
- **Fallback if EC2 is ever required:** nginx serving the same `dist/` with the same headers, **never from the API container**.

### 2.12 Security baseline: the content security policy

- **One source of truth:** `src/config/csp.ts` builds the policy string. It is used by the CloudFront response headers policy (documented value), by `vite preview` (`preview.headers`) and by the dev server, so tests check the policy production will send:
  `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self' <API origin>; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`
- **Report-only first.** It is sent as `Content-Security-Policy-Report-Only` until Phase 13 enforces it. `frame-ancestors` only works as a header, which CloudFront sets.
- **Violations fail the tests:**
  - A Playwright fixture adds an init script that records every `securitypolicyviolation` event on the page, and fails the test after each run if any were recorded.
  - Every e2e spec uses the fixture, so every e2e run is a CSP test against the production build served by `vite preview`.
- **Dev server:** Vite injects `<style>` elements for CSS during development. The dev policy uses Vite's `html.cspNonce` option (a fixed dev-only nonce) so those are allowed and real violations still show. _To verify in Phase 1: that `html.cspNonce` covers all of Vite's dev-injected styles in the installed version._
- **If a component inserts `<style>` elements in the production build** (to be found by the tests above, Phase 2): use a **per-request nonce for `style-src`, never `'unsafe-inline'`**. Plain S3 + CloudFront serves the same `index.html` to everyone and cannot add a per-request nonce; CloudFront Functions cannot change the response body. So the order of preference is:
  1. avoid or adjust the component;
  2. otherwise decide between Lambda@Edge rewriting `index.html` per request and the EC2 + nginx fallback (plan.md Q17).
- Inline `style` attributes set from JavaScript (CSSOM) are not blocked by `style-src`.
- The Inter font files are self-hosted, so no font CDN is allowed.
- No `dangerouslySetInnerHTML` (lint rule).
- **Error monitoring** is not added now (Phase 13, Q14). Phase 1 adds only a `reportError({ error, requestId })` seam that logs to the console in development.

### 2.13 Documentation

- `README.md`: what it is; prerequisites (Node 24); running the backend (docker compose, migrate, `npm run db:seed:dev`, CORS env with `http://localhost:5173,http://localhost:4173` and `CORS_ALLOW_CREDENTIALS=true`); `npm install` / `npm run dev`; seeded accounts; where emails appear (API console, `LOG_LEVEL=debug`); scripts table; **`npm run api:sync`** after a backend contract change; how to run e2e against the local API.
- `AGENTS.md` (imported by the existing `CLAUDE.md`): file layout, component and hook patterns, argument style (same rule as the backend: positional for one argument, named object for two or more of the same type, three or more, or any optional), data-fetching rules (feature `api/` hooks only; query keys start with the clinic id), text through Lingui, design tokens only (no raw colours or pixel values), accessibility rules (no icon-only buttons, labels always visible), the testing rules (test first; `*.spec.ts(x)` next to the file; axe inside the same specs; e2e in `tests/e2e/<feature>.spec.ts`; date specs under a foreign `TZ`; dates only through `lib/datetime`), and "never call an endpoint that is not in `docs/openapi.json`".
- `docs/environment.md` (local and production values and the same-registrable-domain constraint), `docs/deployment.md` (S3 + CloudFront resources, headers, deploy workflow, EC2 + nginx fallback), `docs/adr/0001-frontend-stack.md` (records the approved stack, shadcn/ui, Node 24, and the alternatives), `docs/adr/0002-session-handling.md` (in-memory token, serialised refresh, cross-tab rules, shared-device sign-out), `docs/adr/0003-hosting.md` (static hosting on S3 + CloudFront, independent deploy, CSP and nonce consequences).

## 3. Backend endpoints used

| Endpoint          | Exists | Use                             |
| ----------------- | ------ | ------------------------------- |
| `GET /api/health` | yes    | home placeholder and smoke test |
| everything else   | n/a    | not used in Phase 1             |

## 4. Tests (written first)

Order of work:

1. Write the failing unit tests for `env.ts`, `errors.ts`, `request-id.ts`, `lib/datetime`, and the single-flight refresh helper.
2. Then write the component test for the home page, then the e2e smoke test.
3. Implement until green.

| Test                                                              | Cases                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.spec.ts`                                                     | valid config; missing base URL; relative URL; trailing slash; unknown env name → error listing key names only                                                                                                                                                                                                                                  |
| `errors.spec.ts`                                                  | documented 400 with `details`; 401 `ACCESS_TOKEN_EXPIRED`; 429 with `Retry-After` → `retryAfterSeconds`; non-JSON 502 → `INTERNAL_ERROR` keeping the `X-Request-Id` header; network failure → `NETWORK_ERROR`; every generated `ErrorCode`/`FieldErrorCode` has an `en` message                                                                |
| `request-id.spec.ts`                                              | canonical UUID format (the API ignores non-canonical ones)                                                                                                                                                                                                                                                                                     |
| `lib/datetime/datetime.spec.ts` (runs with `TZ=America/New_York`) | `2026-11-20T16:30:00Z` → `Nov 21, 2026`, `12:30 AM` in Asia/Manila; Manila `Nov 21, 2026 12:30 AM` → `2026-11-20T16:30:00Z`; a Manila date near midnight does not shift by a day; time zone required (type error test via `@ts-expect-error`); a guard spec asserts `process.env.TZ` is not Manila so the trap cannot be switched off silently |
| `refresh-single-flight.spec.ts`                                   | three concurrent callers → one underlying call; after it settles, a new call starts a new refresh; a failure rejects all waiters                                                                                                                                                                                                               |
| `client.spec.ts`                                                  | adds `X-Request-Id`, bearer when a token exists, none when empty; `credentials: 'include'` on `/auth/*`                                                                                                                                                                                                                                        |
| `HomePage.spec.tsx`                                               | reachable / not reachable / loading; axe clean                                                                                                                                                                                                                                                                                                 |
| `api-sync.spec.ts`                                                | copies from `BACKEND_OPENAPI_PATH`; uses the default path when unset; fails with a clear message when the file is missing; leaves `docs/openapi.json` untouched on failure                                                                                                                                                                     |
| `csp.spec.ts`                                                     | the policy string contains no `'unsafe-inline'` or `'unsafe-eval'`; `connect-src` is the configured API origin                                                                                                                                                                                                                                 |
| `tests/e2e/smoke.spec.ts`                                         | page loads, heading visible, health reachable, axe clean, keyboard: the skip link is the first tab stop, no CSP violation (fixture)                                                                                                                                                                                                            |

## 5. Acceptance criteria

Checked on 2026-11-20. `[x]` = verified by a command run in this session; `[~]` = partly verified (the gap is stated); `[ ]` = not verified.

- [x] `npm run lint`, `format:check`, `typecheck`, `test`, `build`, `size`, `api:check`, `i18n:check` pass locally. [~] "and in CI": the workflows exist (`.github/workflows/ci.yml`) but have **not been run on GitHub**; only their commands were run locally.
- [x] `npm run api:sync` copies the backend's `openapi.json` from `../doc-tayo-api` and regenerates the types (run; the result is content-identical to the committed contract, only whitespace differs); a missing source fails with a clear message. Editing the JSON without regenerating makes `api:check` exit 1 (run; restored afterwards).
- [x] An injected `<style>` makes the CSP detector record a violation (`tests/e2e/csp-fixture.spec.ts`, passes in 3 browsers). The fixture also failed a real run once, on an `eval` probe from Zod (fixed, see §7).
- [x] Date specs pass under `TZ=America/New_York` (default) and `TEST_TZ=Asia/Manila`.
- [~] `npm run test:e2e` passes locally against the real API from the backend's docker compose: **15 of 15 on Chromium, Firefox and the 360x800 mobile project**. **WebKit could not be run** on this machine (missing system libraries); the dev seed could not be run (backend outbox-schema error, §7), but Phase 1 needs no seeded account.
- [x] Calling `fetch`, `localStorage`, `sessionStorage`, `@date-fns/tz`, `zod`, `dangerouslySetInnerHTML` or hard-coded JSX text, or importing the API from the design system, fails lint (verified with a probe file, then removed).
- [x] A bad `VITE_API_ORIGIN` shows the misconfiguration page listing the key name and no value (verified in Chromium against a deliberately broken build, then removed).
- [x] One example of each test type passes: unit, component, component-axe, e2e, e2e-axe.
- [~] All text on the home page comes from the Lingui catalogue (lint rule + extraction). The pseudo-locale **changes** every string (accents) but does **not stretch** it (Lingui has no option for that; §7).
- [~] `deploy.yml` exists and is documented; it has never run (needs the AWS resources and domain, Q2c).
- [ ] README lets a new developer run the app in under 15 minutes (tried by someone who did not write it): **not tried**.
- [x] `AGENTS.md`, ADR-0001, ADR-0002, ADR-0003, `docs/environment.md`, `docs/deployment.md` exist. plan.md §0 and §10 are updated.

## 6. Open questions for this phase

- Q2c production domain (plan.md §15.2), and who creates the AWS resources (bucket, distribution, certificate, OIDC role).
- D-14: frontend CI needs read access to `doc-tayo-api` (or a published API image). Until then, real-API e2e runs locally only.
- Q17 only if a component injects styles (see §2.12).

## 7. As Built

Built 2026-11-20. Test files: 19 spec files with 146 specs (Vitest), plus `tests/e2e/smoke.spec.ts` (4 tests) and `tests/e2e/csp-fixture.spec.ts` (1 test) on 4 Playwright projects.

### Deviations from the plan above (the text above already describes the code; this records why)

1. **`VITE_API_ORIGIN`, not `VITE_API_BASE_URL`.** Every path in the generated schema already starts with `/api/v1` (and health is `/api/health`), so the client's base URL must be the origin. A base URL ending in `/api/v1` would request `/api/v1/api/v1/...`.
2. **Tool versions pinned by peer dependencies:** TypeScript **5.9** (openapi-typescript 7.13 needs `^5`; typescript-eslint supports `<6.1`) and ESLint **9** (jsx-a11y supports up to 9). Recorded in ADR-0001.
3. **Zod runs `jitless`** through `src/lib/zod.ts` (lint forbids importing `zod` directly). Found by the CSP detector: Zod's default probes `new Function`, which the policy reports as a `script-src` violation. This module is not in the plan.
4. **MSW 3** renamed the option: `onUnhandledFrame: 'error'` (the old name is silently ignored). Unexpected requests fail the tests.
5. **Pseudo-locale is accented, not stretched.** Lingui's pseudo-localisation changes letters but keeps the length, so the plan's "stretched text" length stress is **not met**. It still exposes hard-coded text. Phase 2 must add the length stress (for example a Storybook decorator, or a generated catalogue that pads strings).
6. **`formatPeso({ centavos })` and `formatDate`/`formatTime` take no `locale`** (English only until Phase 14). `formatDate` styles: `medium`, `weekday`.
7. **Scripts are TypeScript** run by Node 24's type stripping (`scripts/openapi.ts`, `api-sync.ts`, `api-check.ts`), not `.mjs`. Their spec lives in `scripts/openapi.spec.ts`, so Vitest also includes `scripts/**/*.spec.ts`.
8. **Files differ from the sketch:** the boot sequence is in `src/main.tsx` (no `boot.ts`); `RootErrorBoundary` is `RouteErrorPage`, used as the router's `errorComponent`; not-found is the router's `notFoundComponent` (no `$.tsx`); the health hook is `src/app/useApiHealth.ts`; the placeholder pages are in `src/app/`. `reportError` is inside `RouteErrorPage` (a single user; no separate file until a second one exists). `tests/e2e/fixtures/accounts.ts` exists but is unused until Phase 3. `src/features/` does not exist yet (no empty folders).
9. **The shadcn CLI was not run.** `components.json` and `src/design-system/components/button.tsx` were written by hand in shadcn's pattern (and already changed to our sizes: 48 px high, 18 px text, no icon-only size). `src/index.css` holds a **placeholder** theme; Phase 2 replaces it with generated tokens.
10. **Bundle budget** counts all JavaScript in `dist/assets/*.js` (153.4 kB of 170 kB gzip), because the entry chunk alone (66.6 kB) hides the chunks it loads at startup. **90% of the budget is already used by a page that shows one sentence**: React, TanStack Router and Query, Zod, Lingui and the icon set. Phase 2 and 3 must watch it.
11. **Prettier ignores prose:** `docs/`, `plan.md`, `plans/`, `CLAUDE.md`, `AGENTS.md`. (The first run reformatted the backend's contract copies in `docs/`; they were restored from git.) `docs/openapi.json` was re-copied by `api:sync` from the backend checkout; the content is identical, the whitespace differs.
12. **Storybook is not set up in Phase 1** (no `.storybook/`, no `storybook` scripts, no Storybook CI job): it is introduced with the first stories in Phase 2, where plans/02-design-system.md §11 already describes it.
13. **CI:** triggers on pull requests and pushes to `main` and `develop`. The `e2e` job runs only when the repository variable `E2E_BACKEND_REPOSITORY` and secret `E2E_BACKEND_TOKEN` exist (D-14), starts Postgres and the backend with `CORS_ALLOW_CREDENTIALS=true`, and runs all four projects. `deploy.yml` is inert until `DEPLOY_ENABLED=true`. Neither workflow has run on GitHub.
14. **Local e2e needs `http://localhost:4173` in the API's `CORS_ALLOWED_ORIGINS`** (the preview server). The README and `docs/environment.md` say so.

### Not verified

- GitHub Actions: the workflow files were only formatted and read, never executed.
- WebKit e2e (not runnable here). The `e2e` CI job installs it with `--with-deps`.
- That Vite's `html.cspNonce` lets the dev server's injected styles through the dev policy: the dev server was not tested with the CSP header. (The production policy is tested on every e2e run.)
- `npm run i18n:check` cannot detect stale catalogues until the `.po` files are committed (it compares with git).
- The 15-minute README claim.

### Found in the backend (not a frontend problem)

- `npm run db:seed:dev` in `../doc-tayo-api` fails here with `OutboxSchemaError: schema "nest_outbox" is at version 0 ... needs version 1`, although `docker compose run --rm migrate` reports no pending migrations. The seeded accounts are therefore not available on this machine yet. Needed from Phase 3. To report to the backend.

