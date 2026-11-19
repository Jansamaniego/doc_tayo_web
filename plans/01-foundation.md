# Phase 1: Project foundation

Status: **planned** (draft for approval; revised 2026-11-20). The stack is approved with shadcn/ui (plan.md §4, Q1). Backend: none beyond `GET /api/health` (available).

No product features in this phase. It ends with an empty but complete, tested, linted, CI-checked app that later phases build on.

## 1. Objectives

1. Scaffold the app with the approved stack (plan.md §4: React, Vite, TanStack, shadcn/ui on Tailwind v4, Node 24) and strict TypeScript.
2. Make the **contract the only way to call the API**: generated types, one HTTP client, one error type.
3. Put every quality gate in place on day one: lint, format, type-check, unit, component, e2e, accessibility, bundle size, CI.
4. Write this repository's `AGENTS.md` (imported by `CLAUDE.md`) with the coding conventions, so later work follows them automatically.
5. Set up English and Filipino message catalogues, so no English-only string is ever hard-coded.

## 2. Deliverables

### 2.1 Scaffold

- Vite + React 19 + TypeScript.
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. Path alias `@/` → `src/`.
- **Node 24**, matching the backend: `.nvmrc` = `24`, `package.json` `engines.node` = `>=24`; CI reads `.nvmrc`.
- **Tailwind CSS v4** and **shadcn/ui** initialised (`components.json`, aliases pointing into `src/design-system/`). Phase 1 adds only `Button` (for the example component test). The rest come in Phase 2.
- `git init`, `.gitignore`, `.editorconfig`.

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
    schema.d.ts             GENERATED (npm run api:generate); never edited
    client.ts               openapi-fetch instance + middleware
    errors.ts               ApiError (from the generated ErrorResponse), isApiError(), toApiError()
    request-id.ts           UUIDv7 generator for X-Request-Id
    session/                token store (in-memory) + refresh coordination skeleton (finished in Phase 3)
  lib/
    format/                 date (clinic time zone) and peso formatters, with tests
  i18n/
    lingui config; catalogues en and fil; pseudo-locale for layout tests
  config/
    env.ts                  Zod-validated config
  test/
    setup.ts                Testing Library, vitest-axe matchers, MSW server
    msw/handlers.ts         typed default handlers (health)
    render.tsx              renderWithProviders()
tests/e2e/
  smoke.spec.ts
  fixtures/                 seeded accounts (from the backend's dev seed)
.storybook/                 config only; stories arrive in Phase 2
.github/workflows/ci.yml
```

Rules (also written into `AGENTS.md`):
- Group by feature, then by concern. Never create a folder for one file.
- `routes/` files stay thin: they guard and compose; logic lives in `features/`.
- Feature code may import from `design-system/`, `api/`, `lib/`, `i18n/`, never from another feature's internals. Each feature exposes an `index.ts`. This boundary is enforced with ESLint `import/no-restricted-paths`.
- `design-system/` imports nothing from `features/` or `api/`.

### 2.3 Naming conventions

| Kind | Pattern | Example |
|---|---|---|
| Component | `PascalCase.tsx`, named export | `PageHeader.tsx` |
| Hook | `useThing.ts` | `useBranches.ts` |
| Other module | `kebab-case.ts` | `format-date.ts` |
| Unit/component test | `*.test.ts(x)` next to the code | `format-date.test.ts` |
| Story | `*.stories.tsx` next to the component | `Button.stories.tsx` |
| E2E | `tests/e2e/*.spec.ts` | `sign-in.spec.ts` |
| Query keys | `[clinicId, 'branches', params]`; built by a per-feature key factory | `branchKeys.list(params)` |

### 2.4 Environment configuration

- `src/config/env.ts` parses `import.meta.env` with Zod:
  - `VITE_API_BASE_URL` (absolute URL, no trailing slash)
  - `VITE_APP_ENV` (`development | staging | production`)
  - `VITE_ERROR_REPORTING_DSN` (optional)
- It exports a frozen, typed `env`. On failure, `boot.ts` renders a plain "This app is misconfigured" page listing the bad keys (names only, no values), not a blank screen.
- `.env.example` documents every variable. `docs/environment.md` explains each and lists the API-side settings the developer needs (`CORS_ALLOWED_ORIGINS=http://localhost:5173`, `CORS_ALLOW_CREDENTIALS=true`).
- Per-environment files: `.env.development` (committed, local API `http://localhost:3000/api/v1`) and `.env.production` (committed, non-secret: `VITE_API_BASE_URL=https://api.doctayo.<tld>/api/v1`). Vite inlines these at build time, so the production build is made for one environment. There are no secrets in the frontend.

### 2.5 Typed API client

- `npm run api:generate` runs `openapi-typescript docs/openapi.json -o src/api/schema.d.ts`.
- `npm run api:check` regenerates to a temporary file and fails if it differs from the committed one. It runs in CI, so the types can never drift from `docs/openapi.json`.
- **No hand-written type fixes are needed.** openapi-typescript 7.13.0 was run on the current `docs/openapi.json` while planning:
  - nullable fields come out as `string | null`;
  - roles come out as `{ key, name }[]`;
  - error bodies come out as `ErrorResponse` with `ErrorCode` / `FieldErrorCode` unions.
  For the record, the earlier `type: object, nullable: true` shape generated `Record<string, never> | null` (also checked). The backend fixed it before this phase started.
- Exported named aliases (`type Branch = components['schemas']['BranchResponse']`, etc.) live next to the feature that uses them, so components never write `components['schemas'][...]` inline.
- `client.ts`: one `openapi-fetch` client created with `baseUrl: env.VITE_API_BASE_URL`. It is the only place that calls `fetch` for the API (ESLint `no-restricted-globals` for `fetch` outside `src/api/`).

### 2.6 HTTP layer (middleware)

| Order | Middleware | Phase 1 | Completed in |
|---|---|---|---|
| 1 | Request id: `X-Request-Id` = UUIDv7 | done | |
| 2 | Credentials: `credentials: 'include'` for `/auth/*` | done | |
| 3 | Bearer token from the in-memory store (no-op while empty) | done | |
| 4 | Error parsing: non-2xx → `ApiError { status, code, message, details?, requestId, retryAfterSeconds? }`; network failure → `ApiError { code: 'NETWORK_ERROR' }` (client-only code); a body that is not JSON → `INTERNAL_ERROR` with the header request id | done | |
| 5 | Expired token: serialised refresh + one retry | skeleton + unit tests of the single-flight promise | Phase 3 (Web Locks, cross-tab) |

- The error code types come from the **generated** `ErrorCode` and `FieldErrorCode` enums.
- The client adds one code of its own, `NETWORK_ERROR`, kept in a separate union so it can never be confused with a server code.
- `messageFor(error)` returns a Lingui message keyed by `code`, in English or Filipino. English texts are drafted from the "Do this" column of the integration guide §6. The API's (English-only) `message` is used only for a code the generated enum does not know.
- A unit test checks that every enum value has a message in both catalogues.

### 2.7 Routing skeleton

- TanStack Router with file-based routes and generated route tree.
- `__root.tsx`: skip link ("Skip to main content"), `<main id="main">`, route announcer (the page title is announced on navigation for screen readers), focus moved to the `h1` on route change.
- Placeholder routes: `/` (calls `GET /api/health` and shows "API reachable" / "API not reachable"), not-found.
- Empty route groups are written down but **not created** until their phase (no empty folders).

### 2.8 Formatting helpers (used everywhere later)

- `formatDate({ iso, timeZone, locale, style })` and `formatTime({ iso, timeZone, locale })`: Intl-based (`en-PH` or `fil-PH`). The time zone is **required** and never defaults to the device. The locale comes from the active language.
- `formatPeso({ amount, locale })`: input type decided by D-12. Phase 1 accepts integer centavos and is marked provisional.

### 2.9 Testing setup (one passing example each)

| Type | Tool | Example test |
|---|---|---|
| Unit | Vitest | `format-date.test.ts`: a UTC timestamp shows in Asia/Manila (UTC+8) correctly across midnight; the time zone is required |
| Unit | Vitest | `errors.test.ts`: parses the documented error body; maps a network failure; keeps `requestId`; every `ErrorCode`/`FieldErrorCode` has an English and a Filipino message |
| Component | Vitest + Testing Library + MSW | `HomePage.test.tsx`: shows "API reachable" when the MSW health handler answers 200, and the error state on 503 |
| Accessibility (component) | vitest-axe | the same component test asserts `expect(await axe(container)).toHaveNoViolations()` |
| E2E | Playwright | `tests/e2e/smoke.spec.ts`: opens `/`, sees the heading, the health status is "reachable" (real API) |
| Accessibility (e2e) | @axe-core/playwright | the smoke test runs axe on `/` (WCAG 2.2 AA tags), zero violations |

- Playwright config: projects for Chromium, Firefox, WebKit, plus a mobile viewport (Pixel 7) and a tablet viewport (iPad, landscape). `baseURL` is the Vite preview server. API URL from env. Traces on failure.
- `tests/e2e/fixtures/accounts.ts`: `owner@sunrise.test`, `reception@sunrise.test`, with the password read from an env variable that defaults to the documented dev-seed password. This is for local and CI only.
- Coverage: reported, no threshold in Phase 1 (proposed: 80% lines on `src/api/` and `src/lib/` from Phase 3).

### 2.10 Lint, format, type-check

| Script | Does |
|---|---|
| `npm run dev` | Vite on `http://localhost:5173` |
| `npm run build` | type-check + production build |
| `npm run preview` | serve the build (e2e target) |
| `npm run lint` | ESLint (typescript-eslint strict-type-checked, react-hooks, jsx-a11y strict, import order and boundaries, no-restricted-globals for `fetch` and `localStorage` outside allowed modules) |
| `npm run format` / `format:check` | Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (unit + component) |
| `npm run test:e2e` | Playwright |
| `npm run storybook` / `storybook:test` | Storybook dev / test runner with axe |
| `npm run api:generate` / `api:check` | generate / verify API types |
| `npm run size` | bundle-size budget (size-limit): sign-in route entry ≤ 170 KB gzip (plan.md §11) |
| `npm run i18n:extract` | Lingui extraction; CI fails if catalogues are stale and reports the number of missing Filipino strings |

`localStorage` is banned by lint outside an allow-listed `lib/preferences.ts`. That module holds non-sensitive device preferences only: language, "this is a shared computer", last-used branch id. This enforces the privacy rule.

### 2.11 CI (`.github/workflows/ci.yml`, assuming GitHub Actions; Q2b)

Jobs:
1. `install` (Node version from `.nvmrc`, npm ci, cache)
2. `lint`, `format:check`, `typecheck`, `api:check`, `i18n:extract --check` in parallel
3. `test`
4. `build` + `size`
5. `storybook:test`
6. `e2e`: runs the API from a backend Docker image with the dev seed (**needs D-14**). Until D-14 exists, this job runs the e2e suite against MSW-backed preview (`E2E_MODE=mock`) and the real-API run is local only. This is stated in the README so no one assumes CI covers real-API behaviour.
7. `npm audit --omit=dev --audit-level=high`

### 2.12 Security baseline

- A CSP header template in **report-only** mode: `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self' https://api.doctayo.<tld>; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`.
  - Written as a web-server config snippet for the EC2 host (nginx proposed). `frame-ancestors` only works as a header, not in a meta tag.
  - Enforced in Phase 13.
  - The Inter font files are self-hosted, so no font CDN is allowed.
  - *To check in Phase 2:* whether any shadcn/Radix or Sonner component injects a `<style>` element, which `style-src 'self'` would block. Inline `style` attributes set from JavaScript are not affected.
- No `dangerouslySetInnerHTML` (lint rule).

### 2.13 Documentation

- `README.md`: what it is; prerequisites; running the backend (docker compose, migrate, `npm run db:seed:dev`, CORS env); `npm install` / `npm run dev`; seeded accounts; where emails appear (API console, `LOG_LEVEL=debug`); scripts table; how to regenerate API types; how to run e2e against the local API.
- `AGENTS.md` (imported by the existing `CLAUDE.md`): file layout, component and hook patterns, argument style (same rule as the backend: positional for one argument, named object for two or more of the same type, three or more, or any optional), data-fetching rules (feature `api/` hooks only; query keys start with the clinic id), text through Lingui, design tokens only (no raw colours or pixel values), accessibility rules (no icon-only buttons, labels always visible), the testing rules (test first, axe in every component test, e2e in `tests/e2e/`), and "never call an endpoint that is not in `docs/openapi.json`".
- `docs/environment.md` (local and production values, including `app.doctayo.<tld>` / `api.doctayo.<tld>`), `docs/adr/0001-frontend-stack.md` (records the approved stack, shadcn/ui, Node 24, and the alternatives), `docs/adr/0002-session-handling.md` (in-memory token, serialised refresh, cross-tab rules, shared-device sign-out).

## 3. Backend endpoints used

| Endpoint | Exists | Use |
|---|---|---|
| `GET /api/health` | yes | home placeholder and smoke test |
| everything else | n/a | not used in Phase 1 |

## 4. Tests (written first)

Order of work:
1. Write the failing unit tests for `env.ts`, `errors.ts`, `request-id.ts`, `format-date.ts`, and the single-flight refresh helper.
2. Then write the component test for the home page, then the e2e smoke test.
3. Implement until green.

| Test | Cases |
|---|---|
| `env.test.ts` | valid config; missing base URL; relative URL; trailing slash; unknown env name → error listing key names only |
| `errors.test.ts` | documented 400 with `details`; 401 `ACCESS_TOKEN_EXPIRED`; 429 with `Retry-After` → `retryAfterSeconds`; non-JSON 502 → `INTERNAL_ERROR` keeping the `X-Request-Id` header; network failure → `NETWORK_ERROR`; every generated `ErrorCode`/`FieldErrorCode` has an `en` and a `fil` message |
| `request-id.test.ts` | canonical UUID format (the API ignores non-canonical ones) |
| `format-date.test.ts` | `2026-11-20T16:30:00Z` → `Nov 21, 2026` in Asia/Manila (en); the `fil-PH` output pinned by a snapshot reviewed by the translator; time zone required (type error test via `@ts-expect-error`); 12-hour time |
| `refresh-single-flight.test.ts` | three concurrent callers → one underlying call; after it settles, a new call starts a new refresh; a failure rejects all waiters |
| `client.test.ts` | adds `X-Request-Id`, bearer when a token exists, none when empty; `credentials: 'include'` on `/auth/*` |
| `HomePage.test.tsx` | reachable / not reachable / loading; axe clean |
| `tests/e2e/smoke.spec.ts` | page loads, heading visible, health reachable, axe clean, keyboard: the skip link is the first tab stop |

## 5. Acceptance criteria

- [ ] `npm run lint`, `format:check`, `typecheck`, `test`, `build`, `size`, `api:check` all pass locally and in CI.
- [ ] `npm run test:e2e` passes locally against the backend running from its docker compose with the dev seed.
- [ ] Changing `docs/openapi.json` without regenerating makes CI fail.
- [ ] Calling `fetch` or `localStorage` outside the allowed modules fails lint.
- [ ] A missing `VITE_API_BASE_URL` shows the misconfiguration page.
- [ ] One example of each test type passes: unit, component, component-axe, e2e, e2e-axe.
- [ ] The home page can be switched between English and Filipino, and the choice survives a reload.
- [ ] README lets a new developer run the app against the local API in under 15 minutes (tried by someone who did not write it).
- [ ] `AGENTS.md`, ADR-0001 and ADR-0002 exist. plan.md §0 and §10 are updated.

## 6. Open questions for this phase

- Q2b CI provider and EC2 deploy step, Q10 test naming, Q12 openapi.json sync (plan.md §15.2).
- D-14: can frontend CI pull a backend image? Until it can, real-API e2e runs locally only.

## 7. As Built

(Filled in when the phase is implemented.)
