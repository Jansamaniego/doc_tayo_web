# DocTayo Web: frontend master plan

Status: **draft for approval** (2026-11-20; revised twice the same day with the product owner's answers and the updated backend contract). No application code exists yet. This file is the master plan; each phase has a child plan in [plans/](plans/).

The backend is a separate repository. Its contract is the copy in [docs/](docs/): [frontend-integration.md](docs/frontend-integration.md), [openapi.json](docs/openapi.json), [authentication.md](docs/authentication.md), [authorization.md](docs/authorization.md), [error-codes.md](docs/error-codes.md), [api-conventions.md](docs/api-conventions.md). Where this plan and those documents disagree, the documents win and this plan is corrected.

The product owner's answers of 2026-11-20 are recorded in §15.1 and applied throughout. Details still marked **(proposed)** are the architect's proposals inside those decisions, waiting for review. The questions still open are in §15.2. Nothing there has been decided on the owner's behalf.

---

## 0. Current state

| Item                            | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository | Git repository on branch `develop`. `CLAUDE.md` imports `AGENTS.md` (conventions). `docs/` (backend contract copy, plus our own `environment.md`, `deployment.md`, `adr/`), `plan.md`, `plans/`, and the Phase 1 application. |
| Application code | **Phases 1, 2 and 4 built; Phase 3 in progress; Phase 5.1 to 5.6 built** (2026-11-24). Phases 1–2: the app foundation and the design system (plans/01, plans/02, "As Built"). Phase 3 so far (plans/03-app-shell-auth.md, "As Built"): the session module, the six sign-in-flow screens, routes with guards, the app shell, a static home page and the account page; inactivity sign-out, the branch selector, the offline banner and the Phase 3 e2e flows are still to do. Phase 4 (plans/04-platform-admin.md, "As Built"): the platform admin tabs (Clinics and Users). Phase 5.1 to 5.6 (plans/05-staff-and-account.md, "As Built"): the Staff tab behind `members.read` (list, search, status filter, member detail, roles reference), for people with `members.manage` editing roles and job title, suspend, reactivate and remove, the Invitations tab (list by status, invite, resend, revoke; the last three with `members.invite`), and the account page: rename, change email, and the public `/verify-email` page; and 5.5, the app notices an admin's change to the signed-in person (a lost clinic opens the picker with a notice; the session is read again when the window regains focus), and 5.6, the Clinic tab: the clinic profile (name, time zone, contact details) and its branches (list by status, add, edit, deactivate, reactivate). 96 Vitest files (1330 specs); Playwright: 67 passing on Chromium and the phone viewport against the real API before 5.1, plus 16 for the Staff tabs, 4 for the account and 9 for the Clinic tab on Chromium, and the Firefox and WebKit runs are only possible in Docker (not run since Phase 4). Docker setup (`compose.yaml`), CI workflows. |
| Design system | **Built, awaiting the product owner's approval** (the gate before Phase 3): `tokens.json` -> generated CSS and TS, a contrast test over every colour pairing, self-hosted Inter, components, patterns, TV display, Storybook. See plans/02-design-system.md. |
| Backend endpoints available     | Backend Phases 2–4: **44 operations** in the synced `docs/openapi.json` (2026-11-23): auth (9), invitations (5), `/me` (7), `/tenant` (2), `/branches` (4), `/members` (6), `/roles` and `/permissions` (2), `/admin/*` (7), health (2). Phase 3 uses the auth, `/me` and invitation-accept calls; Phase 4 uses `/admin/*`; Phase 5.1 to 5.6 use `/members` (list, one, edit, suspend, reactivate, remove), `/invitations` (list, invite, resend, revoke), `/roles`, `/permissions`, `/tenant` (read and edit), `/branches` (list, one, create, edit), `PATCH /me`, `POST /me/email` and `POST /auth/email/verify`; the rest wait for later phases. |
| Backend endpoints not available | Patients/appointments/encounters/prescriptions (Phase 5), billing/notifications/reports (Phase 6), patient portal (future), queue and TV display (not planned).                                                                                                                                                                                                                                                                                             |
| Contract                        | `docs/openapi.json` (synced 2026-11-23 from the backend commit `c14e285`) declares the `bearer` scheme (public operations have `security: []`), gives every 4xx/5xx the `ErrorResponse` schema with `ErrorCode` and `FieldErrorCode` enums, types nullable fields as `string \| null`, and returns membership roles as `{ key, name }`. **It declares no path parameters** (D-30): `pathParams()` in `src/api/path-params.ts` works around it. |

---

## 1. Product summary

DocTayo is a multi-tenant clinic-management system for small and mid-sized clinics in the Philippines. One deployment serves many clinics (tenants). Each clinic has one or more branches. One account per person. A person can belong to several clinics and switch between them. Each clinic grants permissions through roles.

| Audience               | Main device          | What they do                                        | Available                                        |
| ---------------------- | -------------------- | --------------------------------------------------- | ------------------------------------------------ |
| Clinic owner / admin   | Desktop, tablet      | Clinic profile, branches, staff, settings           | Available (backend Phases 2–4)                   |
| Doctor                 | Desktop, mobile      | Schedule, patients, notes, diagnoses, prescriptions | Backend Phase 5                                  |
| Nurse                  | Desktop, tablet      | Vital signs, queue support                          | Backend Phase 5                                  |
| Receptionist / staff   | Tablet, desktop      | Register patients, book, check in, queue, payments  | Backend Phases 5–6                               |
| Waiting-room TV        | 1080p TV, unattended | "Now serving" and "Next"                            | Not planned on backend                           |
| Platform admin (us)    | Desktop              | Create/suspend clinics, user status                 | Available (backend Phase 4)                      |
| Patient / guardian     | Mobile               | Own and dependants' appointments and records        | Backend future                                   |

The users go from young staff to senior doctors and senior patients. **The app must work for someone who is not comfortable with technology.** This drives the design system (Phase 2): large text, visible labels, icon _and_ text, one primary action per screen, no surprise timeouts.

---

## 2. Guiding principles

1. **Contract first.** Only call endpoints that are in `docs/openapi.json`. When a feature needs something missing, add it to §12 as a backend dependency. Never invent an endpoint, and never build a screen against an imagined API.
2. **Accessible by default, not by audit.** WCAG 2.2 AA is the floor. Body text aims for AAA contrast. Automated accessibility checks run in unit, component, Storybook and e2e tests from Phase 1.
3. **Plain and calm.** Short words, one job per screen, feedback after every action, nothing disappears without warning.
4. **Privacy by design** (Philippine Data Privacy Act of 2012). Patient data never goes into `localStorage`, logs, error reports or URLs. Displays show minimal identifiers.
5. **The server decides.** Permissions, validation and business rules are enforced by the API. The client hides or explains, and never treats its own checks as security.
6. **Boring, typed, tested.** Strict TypeScript, generated API types, tests written first (per `CLAUDE.md`).
7. **Plans follow the code.** Per `CLAUDE.md`, plans and docs change in the same piece of work as the code.

---

## 3. Phase overview and order

The order below changes the original brief in three places, explained after the table. Phases 1 and 2 stay first.

| #   | Phase                             | Child plan                                                                         | Backend                                               | Can build now?                                                 |
| --- | --------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Project foundation                | [plans/01-foundation.md](plans/01-foundation.md)                                   | none needed (health only)                             | **Yes**                                                        |
| 2   | Design system and UX foundations  | [plans/02-design-system.md](plans/02-design-system.md)                             | none                                                  | **Yes** (approval gate before Phase 3)                         |
| 3   | App shell and authentication      | [plans/03-app-shell-auth.md](plans/03-app-shell-auth.md)                           | available                                             | **Yes**                                                        |
| 4   | Platform admin tabs (Clinics, Users) | [plans/04-platform-admin.md](plans/04-platform-admin.md)                       | available (backend Phase 4)                           | **Yes**, after Phase 3                                         |
| 5   | Staff, invitations, account, clinic profile and branches (sub-phases 5.1–5.6) | [plans/05-staff-and-account.md](plans/05-staff-and-account.md) | available (backend Phases 2–4)                        | **Yes**                                                        |
| 6   | Patients                          | written when the backend delivers                                                  | backend Phase 5                                       | No                                                             |
| 7   | Appointments and scheduling       | written when the backend delivers                                                  | backend Phase 5                                       | No                                                             |
| 8   | Consultations and medical records | written when the backend delivers                                                  | backend Phase 5                                       | No                                                             |
| 9   | Waiting-room queue and TV display | written when the backend delivers                                                  | **not planned**; see §12.4                            | No                                                             |
| 10  | Billing and payments              | written when the backend delivers                                                  | backend Phase 6                                       | No                                                             |
| 11  | Notifications, reports and audit  | written when the backend delivers                                                  | backend Phase 6                                       | No                                                             |
| 12  | Patient portal                    | written when the backend delivers                                                  | backend future                                        | No                                                             |
| 13  | Production hardening              | written before the first deployment                                                | needs a deployed environment                          | Partly (gates start in Phase 1)                                |
| 14  | Filipino language release         | written once the translator and reviewer are named (Q4a)                           | D-25 for language preference and Filipino emails      | After launch                                                   |

**Child plans follow the backend (owner, 2026-11-23).** A child plan is written when the backend delivers what its phase needs, not in advance, so it describes the real contract. Phases 6–14 above are outlines in this master plan only; the earlier outline files were removed.

**Change 1: Platform admin moves up, from 11 to 4.** Until the platform-admin API existed, no clinic could be created over HTTP, only with the dev seed. Backend Phase 4 delivered it (2026-11-23), so building the admin tabs next lets pilot clinics be onboarded. It is **tabs in this app**, shown to platform admins only, not a separate deployment (Q6, revised 2026-11-23). Staff, invitations, account, and the clinic profile and branches follow as Phase 5 (the last as sub-phase 5.6, Q22).

**Change 2: Queue and TV display move after consultations, from 7 to 9.** The backend has not planned any queue endpoint, so this phase is blocked longest. Its doctor control ("next patient") also opens the consultation screen built in Phase 8. The TV _layout_ is still designed in Phase 2 so the design system covers it.

**Change 3: Filipino is a phase of its own (14), after launch** (Q4a). i18n is built from Phase 1 (every string in message files, pseudo-locale tests), so the release is a translation and review job. It can be scheduled whenever the translator and reviewer are named; it does not have to wait for Phases 5–13.

**Numbering note.** The brief's numbered list puts the foundation first and the design system second. Its "Phase 1 in detail" section describes the design system. I kept the numbered list's order (foundation = 1, design system = 2) and wrote **both** child plans in full. Phase 13's gates (performance budget, CSP, accessibility checks) start in Phase 1 and are only _audited_ in Phase 13.

**Gate between Phase 2 and Phase 3:** the design system (tokens, components, TV layout, style guide) must be **approved by the product owner** before any feature screen is built. Ideally it is also tried with two or three real users, including at least one senior.

---

## 4. Technology stack (approved, with shadcn/ui)

**Approved by the product owner (Q1), with one change: use shadcn/ui for components.** The table records the approved stack and why each part was chosen.

| Concern                   | Choice                                                                                                                                                                                                                                  | Why                                                                                                                                                                                                                                                                                                                                                                                    | Main alternative                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| App type                  | **Single-page app** (client-rendered)                                                                                                                                                                                                   | Everything is behind sign-in, so there is no SEO need. The API is a separate service. The refresh cookie is `Path=/api/v1/auth` on the API host, so a server-rendering frontend could not use it anyway. A static SPA is cheap to host and easy to secure with a strict CSP.                                                                                                           | Next.js / Remix SSR: adds a server tier with no benefit here |
| Language                  | **TypeScript**, `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`                                                                                                                                                  | Matches the backend; catches contract drift                                                                                                                                                                                                                                                                                                                                            | none                                                         |
| Framework                 | **React 19**                                                                                                                                                                                                                            | Largest ecosystem of accessible headless components and hiring pool                                                                                                                                                                                                                                                                                                                    | Vue 3, Svelte 5                                              |
| Build tool                | **Vite**                                                                                                                                                                                                                                | The backend's CORS docs already assume `http://localhost:5173` (Vite's default); fast; simple static output                                                                                                                                                                                                                                                                            | none                                                         |
| Routing                   | **TanStack Router** (file-based)                                                                                                                                                                                                        | Type-safe routes and **validated, typed search params** (filters, pagination, dates in the URL). Route-level loaders and guards fit the session → clinic → permission chain.                                                                                                                                                                                                           | React Router 7 (data mode)                                   |
| Server state              | **TanStack Query**                                                                                                                                                                                                                      | Caching, retries, invalidation after mutations, request deduplication. Pairs with the router's loaders.                                                                                                                                                                                                                                                                                | SWR                                                          |
| Client state              | **No state library.** A small in-memory session store (`useSyncExternalStore`) plus URL state                                                                                                                                           | The only client-wide state is session/token/active clinic. Everything else is server state or URL state.                                                                                                                                                                                                                                                                               | Zustand, if this grows                                       |
| API client                | **openapi-typescript** (types) + **openapi-fetch** (tiny typed `fetch` wrapper)                                                                                                                                                         | Types are generated from `docs/openapi.json` by a script (the integration guide suggests openapi-typescript). Requests, responses **and error bodies** (`ErrorResponse`, `ErrorCode`) are checked at compile time. No heavy runtime or generated classes.                                                                                                                              | orval (generates Query hooks; more magic)                    |
| Components                | **shadcn/ui** (owner's choice): components copied into `src/design-system/components/` and built on **Radix UI** primitives                                                                                                             | We own the code, so every component can be restyled to our tokens and enlarged for older users. Radix gives keyboard, focus and screen-reader behaviour. shadcn's defaults are **too small for this audience** (36 px controls, 14 px text), so Phase 2 rewrites the sizes to our tokens. Gaps are filled with boring, accessible builds (see the Dates row and Phase 2 §6).           | React Aria Components                                        |
| Dates in components | Our own labelled **DateField** (month by name, day, year), **react-day-picker** for the optional calendar; **one conversion module** (`src/lib/datetime/`, using `@date-fns/tz`) for UTC <-> clinic time; plain calendar dates (`plain-date.ts`) have no time zone at all | The picker's own time-zone option is **not used**. Pickers and fields deal only in plain calendar dates and wall-clock times; `lib/datetime` is the only code that turns them into UTC for the API and back. Date tests run with the runner's `TZ` set to another zone (America/New_York) and again in Asia/Manila. | @internationalized/date |
| Styling                   | **Tailwind CSS v4** (what shadcn/ui uses), with every value coming from our design tokens via `@theme` CSS variables                                                                                                                    | A fixed token scale stops one-off values from creeping in. Our tokens also generate shadcn's CSS variables (`--primary`, `--ring`, …). Zero runtime, CSP-friendly.                                                                                                                                                                                                                     | none (shadcn requires Tailwind)                              |
| Icons                     | **lucide-react** (shadcn's default)                                                                                                                                                                                                     | Consistent set; always paired with a text label                                                                                                                                                                                                                                                                                                                                        |                                                              |
| Toasts | **Radix Toast**, **for confirmations only** | Errors and actions are never only in a toast: errors stay on the page until dismissed. Toasts stay 10 s, pause on hover and keyboard focus, and have a Close button with words. **Not Sonner:** it injects an inline `<style>` element, which our CSP forbids (ADR-0004). | Sonner |
| Forms                     | **React Hook Form** + **Zod** (shadcn's form pattern)                                                                                                                                                                                   | Uncontrolled inputs keep typing fast. `setError` accepts the API's dotted `details[].field` paths directly. Zod schemas give client-side hints. Typed input never resets on errors.                                                                                                                                                                                                    | TanStack Form                                                |
| Date formatting / money   | `Intl.DateTimeFormat` with an explicit `timeZone`; `Intl.NumberFormat(locale, { style: 'currency', currency: 'PHP' })`                                                                                                                  | Native and time-zone safe                                                                                                                                                                                                                                                                                                                                                              |                                                              |
| i18n                      | **Lingui**, set up in Phase 1 with the **English** catalogue and a pseudo-locale; **Filipino ships after launch** (Phase 14, Q4a)                                                                                                       | Compile-time catalogues, small runtime, ICU plurals. Every string goes through it from the first screen, so Filipino is a translation job, not a refactor.                                                                                                                                                                                                                             | react-i18next, FormatJS                                      |
| Unit + component tests    | **Vitest** + **Testing Library** + **MSW** (typed handlers) + **vitest-axe**; files `*.spec.ts(x)` next to the code (Q10, same as the backend)                                                                                          | Fast, Vite-native. MSW mocks the network, not our modules. axe runs inside each component spec.                                                                                                                                                                                                                                                                                        | Jest                                                         |
| End-to-end                | **Playwright** in `tests/e2e/<feature>.spec.ts`, against the **real API** with the seeded accounts, on **Chromium, WebKit and Firefox plus one mobile viewport** (Q9), with **@axe-core/playwright** on each page inside the same specs | Real cookie, CORS and refresh behaviour can only be proven against the real API (same spirit as the backend's "real PostgreSQL" rule)                                                                                                                                                                                                                                                  | Cypress                                                      |
| Living style guide        | **Storybook** with the a11y addon and test runner                                                                                                                                                                                       | Every token and component state in isolation, axe on every story, and a link to send for design approval                                                                                                                                                                                                                                                                               | A hand-built `/style-guide` route                            |
| Lint / format             | **ESLint** (flat config, `typescript-eslint` strict-type-checked, `jsx-a11y`, `react-hooks`, `import` order) + **Prettier**                                                                                                             | Standard; the accessibility rules catch issues as you type                                                                                                                                                                                                                                                                                                                             | Biome (faster, fewer a11y rules)                             |
| Package manager / runtime | **npm**, **Node 24**                                                                                                                                                                                                                    | Same toolchain as the backend: its `package.json` requires `>=24`, `.nvmrc` says `24`, its Dockerfile uses `node:24-slim`, and its CI reads `.nvmrc`. This repository does the same.                                                                                                                                                                                                   |                                                              |
| Hosting                   | **S3 + CloudFront** (or the equivalent) for the built static files, deployed from GitHub Actions on a merge to `main` (Q2b)                                                                                                             | The build is static, so it does not need a server. The deploy is **independent of the backend's production deployment**, which is not designed yet (backend Phase 7). CloudFront sets the security headers (response headers policy) and serves `index.html` for app routes. **If EC2 is ever required:** serve the static build with nginx, **never from the API container**.         | EC2 + nginx (fallback only)                                  |
| CI                        | **GitHub Actions**, the same as the backend (`doc-tayo-api/.github/workflows/ci.yml`: Node from `.nvmrc`, `npm ci`, pinned action versions)                                                                                             | Jobs: lint, format check, type-check, unit/component tests, e2e, build (plus Storybook a11y, the bundle-size budget and the contract check)                                                                                                                                                                                                                                            |                                                              |

---

## 5. Architecture

### 5.1 Repository layout (proposed; detailed in Phase 1)

```
src/
  app/                  providers, router instance, root error boundary, boot sequence
  routes/               file-based routes; thin: guards, loaders, compose feature components
  features/<feature>/   one folder per product area (auth, clinic-switcher, branches, ...)
    api/                query/mutation hooks for this feature
    components/
    <concern>/          sub-folders by concern once > ~8 files
  design-system/
    tokens/             tokens.json (single source) -> generated tokens.css (+ shadcn CSS variables)
    components/         shadcn/ui components (copied in, restyled to our tokens): Button, TextField, Dialog, ...
    patterns/           FormLayout, ConfirmDialog, EmptyState, PageHeader ...
  api/
    schema.d.ts         GENERATED from docs/openapi.json; never edited
    client.ts           openapi-fetch instance + middleware (auth, request id, errors)
    errors.ts           ApiError (from the generated ErrorResponse), code -> message catalogue
    session/            token store, serialised refresh, cross-tab coordination
  lib/
    datetime/           the ONLY place that converts UTC <-> clinic time; formatting
    ...                 peso formatting, small pure helpers
  i18n/                 Lingui config and catalogues (en + pseudo-locale; fil from Phase 14)
  config/env.ts         validated runtime configuration
tests/e2e/              Playwright
.storybook/
```

### 5.2 Route tree (proposed)

| Route group                                                                             | Who                            | Guard                                                     |
| --------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| `/login`, `/forgot-password`, `/reset-password`, `/account-setup`, `/accept-invitation`; `/verify-email` | public                         | redirect to `/` if already signed in (except token pages); signing in always leads to `/`, never back to the page the person was on |
| `/select-clinic`                                                                        | signed in, no active clinic    | session                                                   |
| `/_clinic/*` (dashboard; Phase 5: `/staff`, `/staff/$membershipId`, `/staff/invitations`, `/clinic`, `/clinic/branches`, `/clinic/branches/new`, `/clinic/branches/$branchId`; later patients, appointments, ...) | signed in + active clinic      | session + clinic + per-route permission (`members.read` for `/staff`, `tenant.read` for `/clinic`, `branches.manage` for `/clinic/branches/new`) |
| `/account/*` (profile, sessions, password)                                              | signed in, clinic not required | session                                                   |
| `/display/*`                                                                            | TV display device              | **device credential**, not a staff session (§12.4)        |
| `/admin` (platform overview), `/admin/clinics`, `/admin/users` (Phase 4)                                                    | platform admins                | session + `GET /me` `platformRole` = `platform_admin` (no clinic needed); anyone else sees "Page not found". An admin with no clinic lands on `/admin` |
| Patient portal (same app or separate: **decided at the start of Phase 12**, Q3)         | patients                       | patient auth (future; D-24)                               |

The email link routes are the exact paths the backend's emails use (integration guide §7). They must not change without a backend change.

### 5.3 Session and token handling (rules from the integration guide)

- **Access token in memory only.** Never in `localStorage`, `sessionStorage` or a readable cookie. The refresh token stays in the httpOnly `dt_refresh` cookie, which the client never touches.
- Every call to `login`, `refresh`, `logout` and `logout-all` uses `credentials: 'include'`.
- **Refresh is serialised in two layers:**
  1. Within a tab: one shared in-flight promise. Concurrent `401 ACCESS_TOKEN_EXPIRED` responses all wait for it, then retry their request **once**.
  2. **Across tabs:** every tab shares the same cookie. Two tabs refreshing at the same moment would trigger the server's reuse detection and end the session. Refresh therefore runs under the **Web Locks API** (`navigator.locks.request('dt-refresh', ...)`). The integration guide does not cover this, but it follows from its rule. Each tab refreshes in turn with the latest cookie. This is an e2e test case in Phase 3.
- On app start, call `POST /auth/refresh`. On `200`, load `GET /me` and `GET /me/memberships` to rebuild the session. On `401`, show sign-in.
- Any `401` other than `ACCESS_TOKEN_EXPIRED` ends the session in this tab and is broadcast to the other tabs.
- **Clinic switching is session-wide.** The active clinic is stored on the server session, and all tabs share that session. When one tab switches clinic, every other tab's next request silently goes to the new clinic. Mitigations:
  - Broadcast `clinic-switched` on a `BroadcastChannel`. Other tabs clear their cache and show "You switched to {clinic} in another tab".
  - Every query key includes the active clinic id, and the whole query cache is cleared on switch.
  - Backend dependency D-1 (§12.1) would let the API itself refuse a request made for the wrong clinic.
- Sign-out (`logout`/`logout-all`) clears the token, the query cache and the session store, then broadcasts to other tabs.

### 5.3.1 Shared devices: sign-out after inactivity (Q5, Q16: decided)

Reception computers and tablets are shared, so an unattended screen must not stay signed in. Hiding the screen alone is not protection.

- **Only on shared computers:** the sign-in page has "This is a shared computer". The choice is remembered on the device in the allow-listed preferences module (not sensitive). **Personal devices** (a doctor's own phone) do not get the 10-minute rule; the normal session lifetime applies (14 days idle on the server).
- **Timing:** after **10 minutes** with no input, counted across all tabs (activity is shared over `BroadcastChannel`), a dialog warns **60 seconds** before: "For privacy, you will be signed out in 60 seconds", with a large **"Stay signed in"** button.
- **At timeout:**
  1. Call **`POST /api/v1/auth/logout`**, so the session is **revoked on the server**. A refresh first is fine, because the HTTP layer handles an expired access token.
  2. Clear the access token from memory, the query cache and everything on screen, and tell the other tabs.
  3. Show the sign-in page: "You were signed out because the computer was not used for 10 minutes."
     If the logout call fails (offline), the local sign-out still happens. The app retries the logout when the network returns, and the server session otherwise ends at its own idle limit (D-26).
- **Unsaved form input is kept so the user can continue** after signing in again:
  - It is kept **in memory only** (a draft store in the running page), never in `localStorage`. `sessionStorage` would survive a reload, but it is used only if the owner approves it (Q16a).
  - It is restored **only if the same user** (same user id) signs in again on that tab, and returns them to the same page.
  - It is **discarded immediately** if a different user signs in, and it is lost when the tab is closed or reloaded.
  - While signed out it is not rendered anywhere.
  - Long clinical notes are also protected by server-side drafts (D-15).
- **Server side:** a shorter server-side idle lifetime for sessions started as "shared computer" does not exist yet. Today sessions idle out after 14 days. This is backend request **D-26**. Until it exists, the client-side sign-out above is the protection.
- A lock screen that unlocks without a new sign-in would need D-27 (optional; not planned).

### 5.4 HTTP layer

- The API origin comes from validated config (`VITE_API_ORIGIN`, for example `http://localhost:3000`: scheme, host and port only). The generated paths already start with `/api/v1`.
- Middleware order:
  1. Set `X-Request-Id` (a UUIDv7 generated on the client; the API honours canonical UUIDs).
  2. Attach the bearer token.
  3. Send.
  4. Parse the error body into `ApiError`, typed from the generated `ErrorResponse` (`{ status, code: ErrorCode, message, details?: { field, code: FieldErrorCode, message }[], requestId }`).
  5. Handle `ACCESS_TOKEN_EXPIRED` by serialised refresh plus one retry.
  6. Map `TENANT_NOT_SELECTED` to the clinic picker.
- `Retry-After` and `X-Request-Id` are exposed by the API's CORS settings and read on `429` and on errors.
- **Branch on `code`, never `message`.** User-facing text comes from our own message catalogue keyed by `code`. A test makes sure every `ErrorCode` and `FieldErrorCode` value has a message (English now; Filipino too from Phase 14). The API's `message` is shown only for a code the generated enum does not know yet.
- Send only documented fields; the API rejects unknown fields with `UNKNOWN_FIELD`. Generated types enforce this.
- Never override `Cache-Control: no-store` on `/auth/*` and `/me*`. No service worker caches API responses.

### 5.5 Permissions in the UI

- Navigation and actions are driven by **permission keys** from `GET /me` → `permissions` (and the `switch-tenant` response). Memberships now return roles as `{ key, name }`. Following the integration guide §5:
  - `name` is used to **label** people;
  - `key` is not used to decide what anyone may do;
  - the home page per role is also chosen from permissions.
- Current keys: `tenant.read`, `tenant.settings.manage`, `branches.read`, `branches.manage`, `members.read`, `members.invite`, `members.manage`.
- One documented exception (Phase 5, P5-3): the owner-only rules for staff changes are not a permission, so the Staff screens read the `owner` role key (from `GET /roles` and the member's roles) to explain them in advance. The server still decides (`OWNER_REQUIRED`).
- A typed `can('branches.manage')` helper and a `<RequirePermission>` wrapper. Routes declare the permission they need, and the guard redirects to a plain "You don't have access to this page" screen.
- Hide-or-disable rule: see Phase 2 §UX patterns. In short:
  - Hide what a role can never do.
  - Where a user would expect to edit something they can only view, show it read-only with a one-line reason.
  - Never show a bare disabled button with no explanation.
- A `403 FORBIDDEN` from the server is still handled: show a message and refresh the permissions, because they may have changed mid-session.

### 5.6 Date, time and money

- The API sends ISO-8601 UTC. Display in the **branch time zone**, falling back to the **clinic time zone** (`GET /tenant` → `timezone`; a branch may override it). Seeded clinics use `Asia/Manila`.
- Never use the device's time zone. A doctor's phone set to another zone must still show clinic time.
- **One module does all conversion:** `src/lib/datetime/` converts UTC from the API to clinic time and back. Components and the date picker only handle plain calendar dates and wall-clock times. The picker's own time-zone option is not relied on.
- All date tests run with the runner's `TZ` set to a zone other than Manila (for example `TZ=America/New_York`), so code that accidentally uses the computer's local time fails in CI.
- Default English formats (proposed; follow common Philippine usage, month first, 12-hour clock): `Nov 20, 2026`, `Fri, Nov 20, 2026`, `2:30 PM`. Filipino formats (`fil-PH`) are agreed with the translator in Phase 14.
- Dates are never shown as ambiguous numbers (`11/12/2026`). Typed date input uses separate, labelled fields or a picker, never a free-text date.
- Money: `₱1,234.50` via `Intl.NumberFormat` with `currency: 'PHP'`. The API's money representation is backend dependency D-12.

### 5.6.1 Languages (Q4, Q4a: decided)

- **Launch in English.** Filipino ships after launch, in Phase 14.
- **i18n from day one:**
  - every user-facing string is in Lingui message files, with no hard-coded text (lint rule from Phase 1);
  - a **pseudo-locale** (stretched text) runs in Storybook and in visual tests, so components already cope with longer Filipino text when it arrives.
- **Translation and review:**
  - translation by a **native speaker**;
  - review by a **staff member at a pilot clinic** who uses the app;
  - **unreviewed machine translation is never shipped**, especially for health, consent and error text;
  - who those two people are is still open (Q4a);
  - a glossary keeps medical and clinic terms consistent, including which terms stay in English.
- **What Phase 14 adds:** the Filipino catalogue, the language switcher (sign-in page and user menu; per-display for the TV), Filipino date formats, and a CI check that no Filipino string is missing or unreviewed. It also needs **D-25** (a per-user language preference and Filipino emails); until then the choice is stored on the device.

### 5.7 Error, loading and offline handling (global)

| Situation                                                          | Behaviour                                                                                                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_FAILED`                                                | Each `details[]` item goes under its field. A summary at the top of the form links to each field. Input is kept.                                |
| `RATE_LIMITED` (429)                                               | Countdown from `Retry-After` ("Please wait 2 minutes before trying again"). The submit button is disabled _with_ that text beside it.           |
| `TENANT_NOT_SELECTED` / `TENANT_ACCESS_DENIED`                     | **Built (5.5):** read the session again; the clinic guard goes to `/select-clinic` with "You no longer have access to {clinic}." (P5-13).       |
| `TENANT_SUSPENDED` / `TENANT_DEACTIVATED`                          | Full-page message plus "Choose another clinic" (planned; not built yet).                                                                        |
| `NOT_FOUND`                                                        | "We couldn't find this" page with a way back. Also covers another clinic's records.                                                             |
| `FORBIDDEN`                                                        | Inline or page message; refresh permissions.                                                                                                    |
| `INTERNAL_ERROR` / `SERVICE_UNAVAILABLE` / network failure         | "Something went wrong. Please try again." plus a retry button and a **"Details for support"** disclosure that shows and copies the `requestId`. |
| Offline (`navigator.onLine` plus failed fetch)                     | Persistent banner "You're offline. Changes will not be saved until you're back online." No silent queueing of writes.                           |
| Unexpected render error                                            | Route-level error boundary with the same support details; the app shell stays usable.                                                           |

---

## 6. Design system summary (full detail in Phase 2)

| Token group                   | Proposal                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary (light, fresh green)  | `green-300 #8FD9A8`: fills and accents only, always with dark text (`green-950`, 9.31:1). Too pale for text or controls.                                                                                                                                                                                                                                                                                            |
| Primary for text and controls | `green-700 #1D6E41`: white on it 6.25:1; on the background 5.97:1. Hover `green-800 #175836` (8.45:1 with white).                                                                                                                                                                                                                                                                                                   |
| Background                    | Off-white `neutral-25 #F9FAF7`; surfaces `#FFFFFF`                                                                                                                                                                                                                                                                                                                                                                  |
| Third colour                  | **Warm coral** `coral-400 #FA7F62` (**confirmed**, Q7). Accent fills only; text on coral uses `neutral-900` (6.45:1).                                                                                                                                                                                                                                                                                               |
| Body text                     | `neutral-900 #1B211E` on the background: **15.63:1** (AAA)                                                                                                                                                                                                                                                                                                                                                          |
| Font                          | **Inter** (SIL Open Font License), self-hosted, with Noto Sans and then system UI as fallbacks. Checked in the font files themselves (Google Fonts builds, Inter 4.001, Noto Sans 2.015): both contain **₱ (U+20B1)**, **ñ/Ñ** and **tabular figures**. Inter also has alternate letterforms that tell `l`, `I` and `1` apart (enabled in Phase 2). Atkinson Hyperlegible Next was dropped because it has **no ₱**. |
| Base size                     | **18 px** body, 16 px minimum anywhere, line height 1.5                                                                                                                                                                                                                                                                                                                                                             |
| Touch target                  | ≥ 44×44 px (48 px default for primary controls)                                                                                                                                                                                                                                                                                                                                                                     |

All contrast figures were computed with the WCAG 2.x relative-luminance formula while writing this plan. Phase 2 turns them into an automated test over `tokens.json`.

---

## 7. Conventions (summary; `CLAUDE.md` for this repo is written in Phase 1)

- **Files:** `PascalCase.tsx` for components, `useThing.ts` for hooks, `kebab-case.ts` for other modules, `*.stories.tsx` next to design-system components.
- **Tests (Q10, same as the backend):** unit and component tests are `*.spec.ts` / `*.spec.tsx` next to the file they test; e2e tests are `tests/e2e/<feature>.spec.ts`; accessibility checks (axe) are **inside the same specs**, never separate files. Because both runners use `.spec.ts`, Vitest includes only `src/**/*.spec.{ts,tsx}` and Playwright only `tests/e2e/`.
- **Arguments:** same rule as the backend `CLAUDE.md`. One argument may be positional. Two arguments of the same type, three or more, or any optional argument → one named object. Component props are always an object.
- **Components:** function components, named exports, no default exports (except where the router requires them). Data fetching lives in feature `api/` hooks, never inside design-system components.
- **shadcn/ui:** components are added with the shadcn CLI into `src/design-system/components/`, then restyled to our tokens and sizes. Once copied, they are our code: reviewed, tested and storied like any other component. Feature code imports them from the design system, never straight from Radix.
- **Text:** every user-facing string goes through Lingui. No string concatenation for sentences.
- **No `any`** and no non-null assertions in app code. Generated types are never edited by hand.
- **Tests first**, per `CLAUDE.md`, for every feature and bug fix.

---

## 8. Testing strategy

| Layer             | Tool                                                                                                                                            | Scope                                                                                                                                                                                                             | Runs in CI              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Unit              | Vitest                                                                                                                                          | Pure functions: formatters, error mapping, permission helpers, token-store/refresh logic, contrast test over tokens                                                                                               | yes                     |
| Component         | Vitest + Testing Library + MSW + vitest-axe                                                                                                     | Each component and feature screen: states, keyboard use, error display; **axe must pass**                                                                                                                         | yes                     |
| Story             | Storybook test runner + axe                                                                                                                     | Every story of every design-system component                                                                                                                                                                      | yes                     |
| End-to-end        | Playwright (`tests/e2e/<feature>.spec.ts`) + @axe-core/playwright on each page; Chromium, WebKit, Firefox + one mobile viewport (about 360×800) | Real API with seeded accounts: sign-in, refresh, cross-tab refresh, clinic switch, permission-hidden UI, email-link pages; CSP report-only violations fail the test (Phase 1 §2.12)                               | yes (real API per D-14) |
| Visual regression | Playwright screenshots of stories (proposed, Phase 2)                                                                                           | Tokens and components at 100% and 200% zoom                                                                                                                                                                       | yes                     |
| Manual            | Checklist on the device list in §11                                                                                                             | Screen reader (**NVDA + Chrome, VoiceOver + Safari**; axe alone does not prove screen-reader behaviour), 200% and 400% zoom, keyboard-only, tablets in portrait and landscape, TV from 3–5 m in Chrome kiosk mode | per phase               |

Rules carried over from `CLAUDE.md`:

- Positive, negative, validation, boundary and security cases.
- Cross-tenant isolation (a second clinic's data must never show after a switch).
- Never weaken an assertion to make a test pass.

---

## 9. Environments and configuration

| Variable                   | Example                                  | Validated                       |
| -------------------------- | ---------------------------------------- | ------------------------------- |
| `VITE_API_ORIGIN`          | `http://localhost:3000`                  | origin only: no path, no trailing slash |
| `VITE_APP_ENV`             | `development` / `staging` / `production` | enum                            |
| `VITE_ERROR_REPORTING_DSN` | empty                                    | optional; Phase 13              |

- Validated with Zod at startup. An invalid config renders a plain error page, not a broken app.
- **Production domain: still open** (the owner decides, Q2c). **Hard constraint:** the app and the API must be subdomains of the **same registrable domain**, for example `app.doctayo.ph` and `api.doctayo.ph`. The refresh cookie is `SameSite=Strict` and refresh/logout check the `Origin`, so a different domain breaks sign-in.
- **Backend settings that must match:**
  - the API's `CORS_ALLOWED_ORIGINS` must contain the app's origin (for example `https://app.doctayo.ph`);
  - `CORS_ALLOW_CREDENTIALS=true`;
  - the API's **`APP_PUBLIC_URL`** must point at the app, because emailed links (reset, setup, invitation) are built from it;
  - the frontend's `VITE_API_ORIGIN` is the API's origin (for example `https://api.doctayo.ph`).
- **Hosting (Q2b):** the static build goes to **S3 + CloudFront** (or the equivalent), deployed from GitHub Actions on a merge to `main`, independent of the backend's deployment.
  - CloudFront serves `index.html` with `Cache-Control: no-cache` and the hashed assets as immutable.
  - It returns `index.html` for app routes.
  - It sets the security headers (CSP, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`) through a response headers policy.
  - Fallback if EC2 is ever required: nginx serving the same files, never the API container.
- **Everything runs in Docker** (`compose.yaml`, docs/docker.md): `docker compose up --build` starts the database, the API (built from the backend checkout) and the dev server; tests, lint, Storybook, Playwright (all three engines) and the production nginx image are Compose services or profiles. Without Docker, local development runs against the backend's docker compose. The API's `.env` must contain `CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173` (the dev server and the preview server used by e2e; the backend reads a comma-separated list) and `CORS_ALLOW_CREDENTIALS=true`. Emails (reset, setup, invitation links) appear in the API's console at `LOG_LEVEL=debug`.

---

## 10. Phase status

| Phase           | Status                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1 Foundation | **Built** (2026-11-20; every check passes locally; CI workflows written but not yet run on GitHub; WebKit e2e verified in the Docker e2e image). Deviations: plans/01-foundation.md, "As Built". |
| 2 Design system | **Built** (2026-11-21); needs the product owner's approval and the manual checks listed in plans/02-design-system.md §14 |
| 3 App shell and authentication | **In progress** (plans/03-app-shell-auth.md, "As Built") |
| 4 Platform admin tabs | **Built** (2026-11-23), plus **M6, the platform overview at `/admin`, built** (2026-11-23); plans/04-platform-admin.md, "As Built"). Unit, component and Chromium e2e tests pass; Firefox and WebKit e2e not run (need Docker); startup bundle over budget |
| 5 Staff, invitations, account and clinic settings | **Built** (2026-11-23 and 2026-11-24): 5.1 (read-only Staff tab), 5.2 (staff changes), 5.3 (invitations), 5.4 (account: name and email), 5.5 (reacting to changes made to you) and 5.6 (clinic profile and branches). The M7 end-to-end items marked "not done" in the plan's As Built and the Firefox and WebKit runs remain (plans/05-staff-and-account.md; sub-phases 5.1–5.6) |
| 6–14            | Outlined in this plan; child plans written as the backend delivers                                                         |

---

## 11. Cross-cutting requirements

- **Accessibility:** WCAG 2.2 AA; AAA contrast for body text; 200% zoom without loss of content or function and reflow at 320 CSS px; full keyboard use; visible focus; no icon-only buttons; no timeouts the user is not warned about. The API session lasts 14 days idle and the 15-minute access token refreshes silently; the shared-device sign-out (§5.3.1) always warns 60 seconds ahead.
- **Privacy:**
  - No patient data in `localStorage`/`sessionStorage`/IndexedDB. Unsaved form input after an inactivity sign-out is kept in memory only (§5.3.1); `sessionStorage` would need the owner's approval (Q16a).
  - No personal data in URLs (ids only), page titles, analytics or error reports.
  - TV shows queue number or first name + last initial only, and never anything that reveals a priority category.
  - Printing is deliberate and shows only what the document needs.
- **Security:**
  - Strict CSP from Phase 1 (report-only first): `script-src 'self'`, `style-src 'self'`, `connect-src` = API origin. Violations fail the e2e tests (Phase 1 §2.12). Never `'unsafe-inline'`.
  - No `dangerouslySetInnerHTML`.
  - Tokens handled only by `api/session/`.
  - Dependencies audited in CI.
- **Performance (proposed budgets, enforced in CI from Phase 1):**
  - The sign-in route's initial JS ≤ 170 KB gzip.
  - Each later route chunk ≤ 100 KB gzip.
  - LCP < 2.5 s on a mid-range Android phone on throttled 4G.
- **Devices and browsers (Q9, decided):**

  | Kind    | Supported                                                                                          |
  | ------- | -------------------------------------------------------------------------------------------------- |
  | Desktop | Chrome and Edge (latest 2 versions), Firefox (latest), Safari on macOS (latest 2)                  |
  | Tablet  | iPad (iPadOS latest 2) and an Android tablet with Chrome, portrait and landscape (reception desks) |
  | Phone   | Android mid-range phone with Chrome (about 360×800) and iPhone Safari (latest 2)                   |
  | TV      | Chrome in kiosk mode (Android TV box or mini PC), 1920×1080; never the TV's built-in browser       |

  Automated: Playwright e2e on Chromium, WebKit and Firefox plus one mobile viewport. Tablets and real phones are checked by hand per phase.

---

## 12. Backend dependencies

Everything the frontend needs that is not in `docs/openapi.json` today, so it can be added to the backend plan. "Needed by" is the frontend phase that is blocked.

### 12.1 Contract fixes

| Id  | Need                                                                                                                                                                                                                                                                                                                                                                                                             | Status                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| D-1 | Optional **expected-tenant header** (for example `X-Tenant-Id`) that the API checks against the session's active tenant, answering a dedicated error code on mismatch. **Why:** the active clinic lives on the server session that all tabs share (§5.3), so a tab still showing Clinic A can write into Clinic B after another tab switched. The client mitigation helps, but only the server can make it safe. | **Open** (needed by Phase 3)                                                         |
| D-2 | Error response schema with enum codes                                                                                                                                                                                                                                                                                                                                                                            | **Done** in the backend: `ErrorResponse`, `ErrorCode`, `FieldErrorCode`              |
| D-3 | Nullable strings typed as `object`                                                                                                                                                                                                                                                                                                                                                                               | **Done**: they are now typed as strings. Generator output checked: `string \| null`. |
| D-4 | Bearer security scheme                                                                                                                                                                                                                                                                                                                                                                                           | **Done**: `bearer`, with `security: []` on public operations                         |
| D-5 | Role keys in memberships                                                                                                                                                                                                                                                                                                                                                                                         | **Done**: roles are `{ key, name }`                                                  |

### 12.2 Backend Phase 4 (members, roles, profile)

| Id   | Need                                                                                                                                                                                 | Needed by                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| D-6  | `GET /roles` (roles of the active clinic, with keys and display names)                                                                                                               | **Done** (backend Phase 4): `GET /roles` with `assignable`, `GET /permissions`. Phase 5 |
| D-7  | List members, change a member's role, remove a member; list and revoke invitations; with permissions such as `members.read`, `members.manage`                                        | **Done** (backend Phase 4): `/members`, `GET /invitations`, revoke. Phase 5             |
| D-8  | `PATCH /me` (name, and ideally phone), email change and verification                                                                                                                 | **Done** except phone (`TODO-LATER L-01`): `PATCH /me`, `POST /me/email`, `/verify-email`. Phase 5 |
| D-9  | A member's **branch assignment** (which branches a staff member works at) and whether a member is a **practitioner** (doctor), for example `GET /me` → `practitionerId`, `branchIds` | Default branch for reception, "my schedule" for doctors (Phases 3, 7)                   |
| D-10 | Platform-admin API: create clinic (with owner invite), list/search clinics, suspend/reactivate, user status                                                                          | **Done** (backend Phase 4), with no separate operator sign-in: a `platformRole` on the normal session that grants no clinic data. Phase 4 |

### 12.3 Backend Phases 5–6

| Id   | Need                                                                                                                                                                                                                                        | Needed by |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| D-11 | Patients: create, get, update, archive, **typo-tolerant search** (for example trigram), clinic-specific patient number, pagination, duplicate warning on create; permissions                                                                | Phase 6   |
| D-12 | **Money representation** (integer centavos or decimal string, never a float), currency fixed to PHP                                                                                                                                         | Phase 10  |
| D-13 | Appointments: per-doctor/branch day and week queries, book/reschedule/cancel/check-in/no-show, a dedicated double-booking error code, doctor availability/schedules, idempotency for booking (`Idempotency-Key` is already allowed by CORS) | Phase 7   |
| D-15 | Encounters: draft autosave **on the server** (so long notes are never lost and never stored on the device), vitals, ICD-10 code search endpoint, prescriptions, finalise, amendments with history                                           | Phase 8   |
| D-16 | Billing: invoices, line items, Senior Citizen/PWD discount computed **server-side** (with VAT treatment), partial payments, refunds, receipt data                                                                                           | Phase 10  |
| D-17 | Notifications (reminder settings, email now and SMS later), report endpoints (appointments and revenue by branch and period), **audit log read endpoint** with filters                                                                      | Phase 11  |

### 12.4 Queue and TV display (not planned on the backend at all)

| Id   | Need                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Why                                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| D-18 | **Queue domain**: tickets created from check-ins and walk-ins; per-branch daily numbering (reset at midnight Asia/Manila); states (waiting, called, serving, done, skipped, no-show); assignment to a doctor or room; call next, recall, skip, transfer. **Priority lanes** (Q11) for seniors, PWD and pregnant patients, as a **per-clinic setting**: on/off, and how strictly priority patients go ahead (always first, or one in every _N_ calls). Rules: the priority reason is **health-related information**, stored and shown to authorised staff only; priority tickets use the **same number series** as everyone else (no special prefix); the reason never appears in the display view (D-21). | Phase 9 reception and doctor controls                                                                                 |
| D-19 | **Rooms / service points** per branch (name shown on the TV)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | "Proceed to Room 2"                                                                                                   |
| D-20 | **Display device authentication**: an admin registers a display for one branch; the TV shows a pairing code; an admin enters it in settings; the device receives a long-lived, revocable credential scoped **only** to that branch's public queue (a distinct token type, no staff session, no other API access); a list of paired displays with last-seen and "revoke"                                                                                                                                                                                                                                                                                                                                   | The TV runs unattended all day and must not hold a staff session                                                      |
| D-21 | A **display-safe queue view** endpoint whose response contains only ticket number, **display name already reduced on the server** (first name + last initial, or none) per a clinic setting, room/doctor label and status. No priority flag or reason, and no field from which the category can be read.                                                                                                                                                                                                                                                                                                                                                                                                  | Data Privacy Act: full names and health-related information must never reach the TV device, not just be hidden by CSS |
| D-22 | **Live updates**: Server-Sent Events (preferred) or an ETag-friendly polling endpoint, with a "called" event id so the TV chimes once per call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The TV must update within a few seconds                                                                               |
| D-23 | **Rate limits for clinics behind one IP**: the global limit is 300 requests/minute/IP, so a busy clinic's staff plus displays behind one NAT could hit it. Needs per-user/per-device limits or an exemption for display streams.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Avoid `429` storms on clinic networks                                                                                 |

### 12.5 Patient portal (future)

| Id   | Need                                                                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-24 | Patient accounts (a token type distinct from `staff`), guardian ↔ dependant links, patient-scoped read endpoints for appointments and released records, booking or requests if wanted |

### 12.6 Languages and shared devices

| Id   | Need                                                                                                                                                                                                                                                                                                                     | Needed by                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| D-25 | A per-user **language preference** (`en` / `fil`) on `GET /me` and in `PATCH /me` (D-8), and **Filipino email templates** sent in the user's language                                                                                                                                                                    | Phase 14 (until then the choice is stored on the device; emails stay English) |
| D-26 | A **"this is a shared computer" sign-in option** with a **shorter server-side idle lifetime** for that session (today every session idles out after 14 days). The client already signs out after 10 minutes (§5.3.1); this makes the server enforce it too, for example if the browser is closed before the timer fires. | Phase 3 works without it; requested so the server enforces the shorter limit  |
| D-27 | _Optional:_ a "confirm password" endpoint for the current session, to allow a lock screen that unlocks without a new sign-in                                                                                                                                                                                             | Not required; §5.3.1 works without it                                         |
| D-28 | **Two-factor sign-in for platform admins** (backend `TODO-LATER L-06`). Admin accounts can create and close clinics, so a password alone is weak protection. | Requested before real pilot clinics are onboarded (Phase 4, Q18) |
| D-29 | _Optional:_ **resend a clinic owner's account-setup link** from the admin tabs (for example `POST /admin/tenants/:id/owners/:userId/resend-setup`). | Not required; Phase 4 works without it (Q20) |
| D-30 | **Declare path parameters in the OpenAPI contract.** Every operation with a path such as `/admin/tenants/{tenantId}` has `parameters: []`, so the generated types forbid `params.path`. | Worked around by `pathParams()` (`src/api/path-params.ts`); remove it when fixed. Phase 4 |
| D-31 | _Optional:_ **platform-wide numbers for the admin overview**: clinic and account counts by status in one call, the newest clinics, and per-clinic activity (appointments, sign-ins). Today the overview makes six count calls (`pageSize=1` per status) and shows activity as labelled sample data. | Not required; Phase 4 M6 works without it (Q21) |

### 12.7 Testing infrastructure

| Id   | Need                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-14 | A way to run the API in frontend CI so Playwright e2e can use the real API. The simplest option, following the backend's own CI job: the frontend workflow checks out `doc-tayo-api` (a read token if the repository is private), starts a `postgres:17-alpine` service, runs its bootstrap, migrations and `db:seed:dev`, and starts the API with `CORS_ALLOWED_ORIGINS=http://localhost:4173` (the preview server) and **`CORS_ALLOW_CREDENTIALS=true`** (the backend's CI uses `false`, which would break the refresh cookie). A published API image would also do. |
| D-32 | **Done** (backend, 2026-11-23): the dev seed (`npm run db:seed:dev`) adds `clinic-admin@sunrise.test` (Clinic admin) and `doctor@sunrise.test` (Doctor) to Sunrise Clinic, with the same development password, so the Staff and Clinic screens can be checked by hand per role. It also adds a second clinic, "Lakeside Family Clinic" (owner `owner@lakeside.test`), and `multi@doctayo.test`, an account in both clinics (clinic admin in Sunrise, doctor in Lakeside). A second run restores the seeded staff to active with their original role. The e2e does not depend on them (it invites its own clinic admin). |

---

## 13. Risks

| Risk                                                              | Mitigation                                                                                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrent refresh across tabs logs users out                     | Web Locks plus a single in-flight promise; e2e test with two tabs (Phase 3)                                                                                      |
| Clinic switch in one tab affects other tabs                       | BroadcastChannel, cache cleared per clinic, D-1                                                                                                                  |
| openapi.json drifts from the backend                              | `npm run api:sync` copies it from the backend checkout and regenerates the types; CI fails if the committed types do not match the committed JSON (Q12)          |
| Static hosting cannot add a per-request CSP nonce                 | Avoid components that inject `<style>` elements; if one must stay, decide between Lambda@Edge (rewrites the HTML per request) and the EC2 + nginx fallback (Q17) |
| shadcn/ui defaults are too small and low-contrast for older users | Phase 2 rewrites sizes and colours to tokens; the target-size and contrast tests guard them                                                                      |
| Filipino text is longer and breaks layouts                        | Pseudo-locale in Storybook and visual tests from Phase 2; components wrap                                                                                        |
| Unreviewed or machine translation reaches users                   | Phase 14 ships only reviewed strings; CI blocks unreviewed Filipino entries                                                                                      |
| Queue backend never planned, blocking Phase 9                     | Dependencies listed now (§12.4); TV layout designed early with mock data in Storybook                                                                            |
| Smart-TV browsers are quirky                                      | Chrome in kiosk mode on an Android TV box or mini PC only; tested there (Q8b)                                                                                    |
| Accidental patient data on shared reception devices               | No local storage of patient data; server-side logout after 10 idle minutes on shared computers (§5.3.1); D-26                                                    |

---

## 14. Definition of done (every phase)

1. Tests written first and passing (unit, component, e2e where applicable), with axe clean.
2. `npm run lint`, `format:check`, `typecheck`, `test`, `test:e2e`, `build` and the size budget pass in CI.
3. Keyboard-only and 200% zoom checked for every new screen.
4. Plans and docs updated to match the code (per `CLAUDE.md`); the child plan's "As Built" section filled in.
5. No endpoint used that is not in `docs/openapi.json`.

---

## 15. Decisions and open questions

### 15.1 Answered by the product owner (2026-11-20)

| #   | Question                              | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                | Where it is applied         |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Q1  | Stack                                 | Approved, **with shadcn/ui** for components                                                                                                                                                                                                                                                                                                                                                                                                           | §4, Phase 1, Phase 2        |
| Q2  | Hosting                               | First answer was AWS EC2; **revised by Q2b**: static build on S3 + CloudFront, with EC2 + nginx only as a fallback                                                                                                                                                                                                                                                                                                                                    | §4, §9                      |
| Q2b | CI and deployment                     | **GitHub Actions**, the same as the backend (lint, format check, type-check, unit/component tests, e2e, build). Deploy the static build to **S3 + CloudFront** (or the equivalent) from GitHub Actions on a merge to `main`, **independent of the backend's deployment** (backend Phase 7, not designed yet). If EC2 is ever required, serve the build with nginx, never from the API container.                                                      | §4, §9, Phase 1, Phase 13   |
| Q3  | Patient portal: same app or separate? | **Decide later**, at the start of Phase 12                                                                                                                                                                                                                                                                                                                                                                                                            | Phase 12                    |
| Q4  | Languages                             | **Filipino is needed** (as well as English)                                                                                                                                                                                                                                                                                                                                                                                                           | §5.6.1, Phase 14            |
| Q4a | Filipino rollout                      | **Launch in English**; i18n from day one; Filipino in a later phase (14). Translation by a native speaker, review by a staff member at a pilot clinic; **never ship unreviewed machine translation**, especially health, consent and error text.                                                                                                                                                                                                      | §5.6.1, Phase 14            |
| Q5  | Shared reception devices              | **Yes**, protect them after inactivity                                                                                                                                                                                                                                                                                                                                                                                                                | §5.3.1                      |
| Q16 | Inactivity time                       | **10 minutes** on shared computers, 60-second warning with a large "Stay signed in". At timeout, `POST /api/v1/auth/logout` (server-side revoke), then clear the token. Keep unsaved form input in memory so the user can continue after signing in again (no patient data in `localStorage`; `sessionStorage` only with the owner's approval). Personal devices: no 10-minute rule. A shorter server-side idle lifetime is a backend request (D-26). | §5.3.1, Phase 3, D-26       |
| Q6  | Admin console                         | **Revised 2026-11-23: tabs in this app** (Clinics, Users) shown only to platform admins, as the backend designed it. Was: a separate deployment, built later                                                                                                                                                                                                                                                                                                                                                                                                                  | §5.2, Phase 4               |
| Q22 | Clinic profile and branches       | **Sub-phase 5.6** of plans/05-staff-and-account.md (decided 2026-11-23) | Phase 5 §5.6, M6 |
| Q23 | Seeded clinic admin and doctor    | **Yes**, in the backend's dev seed (decided 2026-11-23); delivered (D-32, done) | Phase 5 §3, D-32 |
| Q24 | Own row on the Staff list         | **Shown, marked "(you)"** (decided 2026-11-23); the job title is edited there | Phase 5 §5.1 |
| Q7  | Third colour                          | **Warm coral** confirmed                                                                                                                                                                                                                                                                                                                                                                                                                              | Phase 2                     |
| Q8  | TV resolution                         | **1080p and 2160p**                                                                                                                                                                                                                                                                                                                                                                                                                                   | Phase 2 §10, Phase 9        |
| Q8b | TV screen size                        | Design for **43" at 1920×1080, viewed from 3–5 m**; text scales with the viewport (`clamp()` with `vw`/`vh`) so **32" to 65"** work without layout changes. Test on **Chrome in kiosk mode** (Android TV box or mini PC), not a TV's built-in browser.                                                                                                                                                                                                | Phase 2 §10, Phase 9        |
| Q9  | Devices and browsers                  | The device and browser table in §11; Playwright on Chromium, WebKit, Firefox and one mobile viewport                                                                                                                                                                                                                                                                                                                                                  | §11, Phase 1, Phase 13      |
| Q10 | Test file naming                      | Match the backend: `*.spec.ts(x)` next to the file; e2e `tests/e2e/<feature>.spec.ts`; axe inside the same specs                                                                                                                                                                                                                                                                                                                                      | §7, Phase 1                 |
| Q11 | Queue priority                        | **Yes, a per-clinic setting.** The priority reason is health-related, so the TV shows no label and no special prefix. How strictly priority patients jump the queue (always first, or one in every few) is a clinic setting. Confirm the exact legal basis with the clinic owners.                                                                                                                                                                    | D-18, D-21, Phase 9         |
| Q12 | openapi.json sync                     | `npm run api:sync` copies `docs/openapi.json` from the backend checkout (path from an env variable, default `../doc-tayo-api/docs/openapi.json`) and regenerates the types; both are committed; CI fails if the types do not match the JSON. Run it whenever the backend changes its contract (the backend has its own staleness test).                                                                                                               | Phase 1                     |
| Q13 | Design keywords                       | **Confirmed**: calm, clean, trustworthy, warm, unhurried                                                                                                                                                                                                                                                                                                                                                                                              | Phase 2                     |
| Q14 | Error monitoring                      | **Sentry (or equivalent), in Phase 13, not now.** No request or response bodies, no form values, no URLs with query strings, no user names or emails; user id only; session replay off or fully masked; attach the API's `requestId`. First check whether NestJS Observe (the backend's monitoring) offers a browser SDK and compare (unverified).                                                                                                    | Phase 13                    |
| Q15 | Prescriptions and receipts            | **No legal ruling here.** Until a clinic's accountant and a doctor confirm the rules (generic names, licence and PTR numbers, S2 numbers, BIR rules for official receipts and invoices, which have changed in recent years), build **printable templates** and **never present them as official receipts**. The backend plan tracks the same question for domain experts.                                                                             | Phases 8, 10                |
| —   | Font                                  | Pick a professional font that covers ₱ and ñ → **Inter** (checked in the font file)                                                                                                                                                                                                                                                                                                                                                                   | §6, Phase 2                 |
| —   | Node version                          | **Node 24**, same as the backend                                                                                                                                                                                                                                                                                                                                                                                                                      | §4, Phase 1                 |
| —   | How to verify the Phase 2 unknowns    | Dates: one conversion module, tests under another `TZ`. Searchable dropdown: NVDA + Chrome and VoiceOver + Safari; plain select under about 15 options. Toasts: confirmations only; errors stay on the page. CSP: run dev and e2e with the policy in report-only mode and fail on any violation; if a component inserts styles, use a per-request nonce, never `'unsafe-inline'`.                                                                     | Phase 2 §15a, Phase 1 §2.12 |

### 15.2 Still open

| #    | Question                                                                                                                                                                                                                        | Default until answered                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Q2c  | **Production domain** (the owner decides). Constraint: the app and API on the same registrable domain, for example `app.doctayo.ph` / `api.doctayo.ph`                                                                          | Examples use `doctayo.ph` as a placeholder only                    |
| Q3   | Patient portal: same app or separate (decided at the start of Phase 12)                                                                                                                                                         | Keep the design system and API layer free of staff-app assumptions |
| Q4a  | **Who** translates into Filipino (a native speaker) and **who** reviews (a pilot-clinic staff member)                                                                                                                           | Phase 14 is not scheduled until both are named                     |
| Q8b  | **Real TV hardware** (the owner will confirm)                                                                                                                                                                                   | 43" 1080p, Chrome kiosk on an Android TV box or mini PC            |
| Q11b | **Legal basis for priority lanes**: to confirm with clinic owners before Phase 9                                                                                                                                                |                                                                    |
| Q15b | **Prescription and receipt rules**: to confirm with a clinic's doctor and accountant before Phases 8 and 10                                                                                                                     | Templates only (§15.1)                                             |
| Q16a | **May unsaved form input be kept in `sessionStorage`** (survives a reload) instead of memory only?                                                                                                                              | Memory only                                                        |
| Q17  | **Only if** a component turns out to insert `<style>` elements that cannot be avoided: per-request nonces need the HTML rewritten per request, which plain S3 + CloudFront cannot do. Lambda@Edge, or the EC2 + nginx fallback? | Replace or adjust the component so no nonce is needed              |
| Q18  | **Two-factor sign-in for platform admins**: when will the backend add it (D-28)?                                                                                                                                                 | Admins use personal devices and long unique passwords              |
| Q19  | **Who are the platform admins**, and how many? (Granted only on the server with `npm run admin:grant`.)                                                                                                                        | Operations note only; no UI impact                                 |
| Q20  | **Resending a clinic owner's setup link**: needed often enough to ask the backend for D-29?                                                                                                                                    | Backend tooling only                                               |
| Q21  | **Which numbers should the platform overview show** once the backend has them (D-31)?                                                                                                                                       | Sample block shows the shape only                                  |
