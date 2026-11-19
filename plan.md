# DocTayo Web: frontend master plan

Status: **draft for approval** (2026-11-20; revised the same day with the product owner's answers and the updated backend contract). No application code exists yet. This file is the master plan; each phase has a child plan in [plans/](plans/).

The backend is a separate repository. Its contract is the copy in [docs/](docs/): [frontend-integration.md](docs/frontend-integration.md), [openapi.json](docs/openapi.json), [authentication.md](docs/authentication.md), [authorization.md](docs/authorization.md), [error-codes.md](docs/error-codes.md), [api-conventions.md](docs/api-conventions.md). Where this plan and those documents disagree, the documents win and this plan is corrected.

The product owner's answers of 2026-11-20 are recorded in §15.1 and applied throughout. Details still marked **(proposed)** are the architect's proposals inside those decisions, waiting for review. The questions still open are in §15.2. Nothing there has been decided on the owner's behalf.

---

## 0. Current state

| Item | State |
|---|---|
| Repository | `CLAUDE.md` (imports `@AGENTS.md`, **which does not exist yet**; created in Phase 1), `docs/` (backend contract copy), this plan, `plans/`. Not a git repository yet. |
| Application code | None. |
| Design system | None. Phase 2 defines it. |
| Backend endpoints available | 24 operations: auth (login, refresh, logout, logout-all, switch-tenant, forgot/reset password, account setup), invitations (accept, create, resend), `/me` (profile, password, memberships, sessions, revoke session), `/tenant` (get, patch), `/branches` (list, create, get, patch), health (live, ready). Counted from `docs/openapi.json`. |
| Backend endpoints not available | Members/roles (backend Phase 4), patients/appointments/encounters/prescriptions (Phase 5), billing/notifications/reports (Phase 6), patient portal (future), queue and TV display (not planned). |
| Contract | `docs/openapi.json` (updated 2026-11-20) declares the `bearer` scheme (public operations have `security: []`), gives every 4xx/5xx the `ErrorResponse` schema with `ErrorCode` and `FieldErrorCode` enums, types nullable fields as `string \| null`, and returns membership roles as `{ key, name }`. Checked by running openapi-typescript 7.13.0 on it: the generated types are correct, so no hand-written overrides are needed. The defects found in the first draft are fixed (§12.1). |

---

## 1. Product summary

DocTayo is a multi-tenant clinic-management system for small and mid-sized clinics in the Philippines. One deployment serves many clinics (tenants). Each clinic has one or more branches. One account per person. A person can belong to several clinics and switch between them. Each clinic grants permissions through roles.

| Audience | Main device | What they do | Available |
|---|---|---|---|
| Clinic owner / admin | Desktop, tablet | Clinic profile, branches, staff, settings | Profile + branches now; staff in backend Phase 4 |
| Doctor | Desktop, mobile | Schedule, patients, notes, diagnoses, prescriptions | Backend Phase 5 |
| Nurse | Desktop, tablet | Vital signs, queue support | Backend Phase 5 |
| Receptionist / staff | Tablet, desktop | Register patients, book, check in, queue, payments | Backend Phases 5–6 |
| Waiting-room TV | 1080p TV, unattended | "Now serving" and "Next" | Not planned on backend |
| Platform operator (us) | Desktop | Create/suspend clinics, user status | Backend Phase 4 |
| Patient / guardian | Mobile | Own and dependants' appointments and records | Backend future |

The users go from young staff to senior doctors and senior patients. **The app must work for someone who is not comfortable with technology.** This drives the design system (Phase 2): large text, visible labels, icon *and* text, one primary action per screen, no surprise timeouts.

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

The order below changes the original brief in two places, explained after the table. Phases 1 and 2 stay first.

| # | Phase | Child plan | Backend | Can build now? |
|---|---|---|---|---|
| 1 | Project foundation | [plans/01-foundation.md](plans/01-foundation.md) | none needed (health only) | **Yes** |
| 2 | Design system and UX foundations | [plans/02-design-system.md](plans/02-design-system.md) | none | **Yes** (approval gate before Phase 3) |
| 3 | App shell and authentication | [plans/03-app-shell-auth.md](plans/03-app-shell-auth.md) | available | **Yes** |
| 4 | Account and clinic settings | [plans/04-account-clinic-settings.md](plans/04-account-clinic-settings.md) | partly available; staff management in backend Phase 4 | **Partly** |
| 5 | Platform administration console | [plans/05-platform-admin.md](plans/05-platform-admin.md) | backend Phase 4 | No |
| 6 | Patients | [plans/06-patients.md](plans/06-patients.md) | backend Phase 5 | No |
| 7 | Appointments and scheduling | [plans/07-appointments.md](plans/07-appointments.md) | backend Phase 5 | No |
| 8 | Consultations and medical records | [plans/08-consultations.md](plans/08-consultations.md) | backend Phase 5 | No |
| 9 | Waiting-room queue and TV display | [plans/09-queue-tv-display.md](plans/09-queue-tv-display.md) | **not planned**; see §12.4 | No |
| 10 | Billing and payments | [plans/10-billing.md](plans/10-billing.md) | backend Phase 6 | No |
| 11 | Notifications, reports and audit | [plans/11-notifications-reports-audit.md](plans/11-notifications-reports-audit.md) | backend Phase 6 | No |
| 12 | Patient portal | [plans/12-patient-portal.md](plans/12-patient-portal.md) | backend future | No |
| 13 | Production hardening | [plans/13-production-hardening.md](plans/13-production-hardening.md) | needs a deployed environment | Partly (gates start in Phase 1) |

**Change 1: Platform admin moves up, from 11 to 5.** It will be a separate deployment, built later (Q6). Phase 5 can only start once backend Phase 4 delivers the platform-admin API. It depends on backend Phase 4, which arrives before backend Phase 5. Today no clinic can be created over HTTP, only with the dev seed (integration guide §1). So no real clinic can be onboarded until the console exists. Building it right after settings lets us onboard pilot clinics as soon as Phase 4 lands.

**Change 2: Queue and TV display move after consultations, from 7 to 9.** The backend has not planned any queue endpoint, so this phase is blocked longest. Its doctor control ("next patient") also opens the consultation screen built in Phase 8. The TV *layout* is still designed in Phase 2 so the design system covers it.

**Numbering note.** The brief's numbered list puts the foundation first and the design system second. Its "Phase 1 in detail" section describes the design system. I kept the numbered list's order (foundation = 1, design system = 2) and wrote **both** child plans in full. Phase 13's gates (performance budget, CSP, accessibility checks) start in Phase 1 and are only *audited* in Phase 13.

**Gate between Phase 2 and Phase 3:** the design system (tokens, components, TV layout, style guide) must be **approved by the product owner** before any feature screen is built. Ideally it is also tried with two or three real users, including at least one senior.

---

## 4. Technology stack (approved, with shadcn/ui)

**Approved by the product owner (Q1), with one change: use shadcn/ui for components.** The table records the approved stack and why each part was chosen.

| Concern | Choice | Why | Main alternative |
|---|---|---|---|
| App type | **Single-page app** (client-rendered) | Everything is behind sign-in, so there is no SEO need. The API is a separate service. The refresh cookie is `Path=/api/v1/auth` on the API host, so a server-rendering frontend could not use it anyway. A static SPA is cheap to host and easy to secure with a strict CSP. | Next.js / Remix SSR: adds a server tier with no benefit here |
| Language | **TypeScript**, `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` | Matches the backend; catches contract drift | none |
| Framework | **React 19** | Largest ecosystem of accessible headless components and hiring pool | Vue 3, Svelte 5 |
| Build tool | **Vite** | The backend's CORS docs already assume `http://localhost:5173` (Vite's default); fast; simple static output | none |
| Routing | **TanStack Router** (file-based) | Type-safe routes and **validated, typed search params** (filters, pagination, dates in the URL). Route-level loaders and guards fit the session → clinic → permission chain. | React Router 7 (data mode) |
| Server state | **TanStack Query** | Caching, retries, invalidation after mutations, request deduplication. Pairs with the router's loaders. | SWR |
| Client state | **No state library.** A small in-memory session store (`useSyncExternalStore`) plus URL state | The only client-wide state is session/token/active clinic. Everything else is server state or URL state. | Zustand, if this grows |
| API client | **openapi-typescript** (types) + **openapi-fetch** (tiny typed `fetch` wrapper) | Types are generated from `docs/openapi.json` by a script (the integration guide suggests openapi-typescript). Requests, responses **and error bodies** (`ErrorResponse`, `ErrorCode`) are checked at compile time. No heavy runtime or generated classes. | orval (generates Query hooks; more magic) |
| Components | **shadcn/ui** (owner's choice): components copied into `src/design-system/components/` and built on **Radix UI** primitives | We own the code, so every component can be restyled to our tokens and enlarged for older users. Radix gives keyboard, focus and screen-reader behaviour. shadcn's defaults are **too small for this audience** (36 px controls, 14 px text), so Phase 2 rewrites the sizes to our tokens. Gaps are filled with boring, accessible builds (see the Dates row and Phase 2 §6). | React Aria Components |
| Dates in components | **react-day-picker** (shadcn's Calendar) with its `timeZone` support + **date-fns** / **@date-fns/tz** | Shows and picks dates in the clinic's zone, not the device's. Typed date entry uses our own labelled DateField (Phase 2), because a calendar alone is hard for older users. *To verify in Phase 2: the `timeZone` prop behaves as documented in the installed version.* | @internationalized/date |
| Styling | **Tailwind CSS v4** (what shadcn/ui uses), with every value coming from our design tokens via `@theme` CSS variables | A fixed token scale stops one-off values from creeping in. Our tokens also generate shadcn's CSS variables (`--primary`, `--ring`, …). Zero runtime, CSP-friendly. | none (shadcn requires Tailwind) |
| Icons | **lucide-react** (shadcn's default) | Consistent set; always paired with a text label | |
| Toasts | **Sonner** (shadcn's toast) | Configured so errors never auto-dismiss and others stay ≥ 8 s with a Close button (Phase 2) | |
| Forms | **React Hook Form** + **Zod** (shadcn's form pattern) | Uncontrolled inputs keep typing fast. `setError` accepts the API's dotted `details[].field` paths directly. Zod schemas give client-side hints. Typed input never resets on errors. | TanStack Form |
| Date formatting / money | `Intl.DateTimeFormat` with an explicit `timeZone`; `Intl.NumberFormat(locale, { style: 'currency', currency: 'PHP' })` | Native and time-zone safe | |
| i18n | **Lingui**, with **English and Filipino** catalogues from Phase 1 (Q4: Filipino is needed) | Compile-time catalogues, small runtime, ICU plurals. Every string goes through it from the first screen, so Filipino is a translation job, not a refactor. | react-i18next, FormatJS |
| Unit + component tests | **Vitest** + **Testing Library** + **MSW** (typed handlers) + **vitest-axe** | Fast, Vite-native. MSW mocks the network, not our modules. axe runs on every component test. | Jest |
| End-to-end | **Playwright** in `tests/e2e/`, against the **real API** with the seeded accounts, plus **@axe-core/playwright** | Real cookie, CORS and refresh behaviour can only be proven against the real API (same spirit as the backend's "real PostgreSQL" rule) | Cypress |
| Living style guide | **Storybook** with the a11y addon and test runner | Every token and component state in isolation, axe on every story, and a link to send for design approval | A hand-built `/style-guide` route |
| Lint / format | **ESLint** (flat config, `typescript-eslint` strict-type-checked, `jsx-a11y`, `react-hooks`, `import` order) + **Prettier** | Standard; the accessibility rules catch issues as you type | Biome (faster, fewer a11y rules) |
| Package manager / runtime | **npm**, **Node 24** | Same toolchain as the backend: its `package.json` requires `>=24`, `.nvmrc` says `24`, its Dockerfile uses `node:24-slim`, and its CI reads `.nvmrc`. This repository does the same. | |
| Hosting | **AWS EC2**: the built static files served by a web server (nginx proposed) at `app.doctayo.<tld>`; the API at `api.doctayo.<tld>` | Owner's decision (Q2). Both hosts share the registrable domain `doctayo.<tld>`, which the `SameSite=Strict` refresh cookie needs. The web server sets the security headers (CSP and others) and the SPA fallback. | |
| CI | **GitHub Actions** (assumed; CI provider and the deploy step to EC2 are still open, Q2b) | Lint, format check, type-check, unit/component, Storybook a11y, e2e, bundle-size budget | |

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
  lib/                  formatting (dates in clinic time zone, peso), small pure helpers
  i18n/                 Lingui config and catalogues (en, fil)
  config/env.ts         validated runtime configuration
tests/e2e/              Playwright
.storybook/
```

### 5.2 Route tree (proposed)

| Route group | Who | Guard |
|---|---|---|
| `/login`, `/forgot-password`, `/reset-password`, `/account-setup`, `/accept-invitation` | public | redirect to app if already signed in (except token pages) |
| `/select-clinic` | signed in, no active clinic | session |
| `/_clinic/*` (dashboard, settings, branches; later patients, appointments, ...) | signed in + active clinic | session + clinic + per-route permission |
| `/account/*` (profile, sessions, password) | signed in, clinic not required | session |
| `/display/*` | TV display device | **device credential**, not a staff session (§12.4) |
| Admin console (**separate deployment**, Q6; built later, Phase 5) | platform operators | operator auth (D-10) |
| Patient portal (same app or separate: **decided at the start of Phase 12**, Q3) | patients | patient auth (future; D-24) |

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

### 5.3.1 Shared devices: inactivity lock (Q5: yes)

Reception computers and tablets are shared, so the app protects an unattended screen. It still must not surprise anyone.

- **Opt-in per device:** the sign-in page has "This is a shared computer". The choice is remembered on the device. It is not sensitive, so it goes in the allow-listed preferences module. A doctor's own phone is not affected.
- **Warning first:** after a period with no input (proposed 10 minutes; a per-clinic setting needs backend dependency D-26), a dialog says "For privacy, you will be signed out in 60 seconds" with a large "Stay signed in" button. This is never a surprise.
- **Then:**
  - the app calls `POST /auth/logout`;
  - it clears the token, the query cache and everything on screen;
  - it shows the sign-in page with "You were signed out because the computer was not used for 10 minutes";
  - after sign-in it returns to the page the user was on.
- **Why sign-out and not a lock screen:** a true "unlock with your password" needs an endpoint that re-checks the password for the current session, and none exists (optional D-27). Signing out and in again uses only existing endpoints and leaves nothing readable on screen.
- **Unsaved work:**
  - Forms keep nothing on the device (privacy rule).
  - The warning dialog therefore says when a form has unsaved changes, so the user can save first.
  - Long clinical notes are protected by server-side drafts (D-15).

### 5.4 HTTP layer

- Base URL from validated config (`VITE_API_BASE_URL`, for example `http://localhost:3000/api/v1`).
- Middleware order:
  1. Set `X-Request-Id` (a UUIDv7 generated on the client; the API honours canonical UUIDs).
  2. Attach the bearer token.
  3. Send.
  4. Parse the error body into `ApiError`, typed from the generated `ErrorResponse` (`{ status, code: ErrorCode, message, details?: { field, code: FieldErrorCode, message }[], requestId }`).
  5. Handle `ACCESS_TOKEN_EXPIRED` by serialised refresh plus one retry.
  6. Map `TENANT_NOT_SELECTED` to the clinic picker.
- `Retry-After` and `X-Request-Id` are exposed by the API's CORS settings and read on `429` and on errors.
- **Branch on `code`, never `message`.** User-facing text comes from our own catalogue (English and Filipino) keyed by `code`. A test makes sure every `ErrorCode` and `FieldErrorCode` value has a message in both languages. The API's `message`, which is English only, is shown only for a code the generated enum does not know yet.
- Send only documented fields; the API rejects unknown fields with `UNKNOWN_FIELD`. Generated types enforce this.
- Never override `Cache-Control: no-store` on `/auth/*` and `/me*`. No service worker caches API responses.

### 5.5 Permissions in the UI

- Navigation and actions are driven by **permission keys** from `GET /me` → `permissions` (and the `switch-tenant` response). Memberships now return roles as `{ key, name }`. Following the integration guide §5:
  - `name` is used to **label** people;
  - `key` is not used to decide what anyone may do;
  - the home page per role is also chosen from permissions.
- Current keys: `tenant.read`, `tenant.settings.manage`, `branches.read`, `branches.manage`, `members.invite`.
- A typed `can('branches.manage')` helper and a `<RequirePermission>` wrapper. Routes declare the permission they need, and the guard redirects to a plain "You don't have access to this page" screen.
- Hide-or-disable rule: see Phase 2 §UX patterns. In short:
  - Hide what a role can never do.
  - Where a user would expect to edit something they can only view, show it read-only with a one-line reason.
  - Never show a bare disabled button with no explanation.
- A `403 FORBIDDEN` from the server is still handled: show a message and refresh the permissions, because they may have changed mid-session.

### 5.6 Date, time and money

- The API sends ISO-8601 UTC. Display in the **branch time zone**, falling back to the **clinic time zone** (`GET /tenant` → `timezone`; a branch may override it). Seeded clinics use `Asia/Manila`.
- Never use the device's time zone. A doctor's phone set to another zone must still show clinic time.
- Default English formats (proposed; follow common Philippine usage, month first, 12-hour clock): `Nov 20, 2026`, `Fri, Nov 20, 2026`, `2:30 PM`. In Filipino, formats come from `Intl` with the `fil-PH` locale (month names in Filipino). The exact output is to be checked and agreed with the translator in Phase 2.
- Dates are never shown as ambiguous numbers (`11/12/2026`). Typed date input uses separate, labelled fields or a picker, never a free-text date.
- Money: `₱1,234.50` via `Intl.NumberFormat` with `currency: 'PHP'`. The API's money representation is backend dependency D-12.

### 5.6.1 Languages (Q4: Filipino is needed)

- English and Filipino in every part of the app: the staff app, the TV display, and later the portal.
- **Choosing a language:**
  - "English / Filipino" on the sign-in page and in the user menu.
  - The choice is stored on the device (not sensitive) until the API can store it per user (D-25).
  - Each TV display has its own language setting.
- **Translation:**
  - Strings are extracted by Lingui.
  - A **glossary** keeps medical and clinic terms consistent. Many stay in English where clinics use English (Taglish), as agreed with the translator.
  - Who translates and who reviews is open question Q4a.
  - Missing Filipino strings fall back to English, and CI reports how many are missing.
- **Layout:** Filipino text is often longer than English. A **pseudo-locale** (stretched text) runs in Storybook and in visual tests so components wrap instead of breaking.
- **Emails:** the backend sends emails in English only. Filipino emails are part of D-25.

### 5.7 Error, loading and offline handling (global)

| Situation | Behaviour |
|---|---|
| `VALIDATION_FAILED` | Each `details[]` item goes under its field. A summary at the top of the form links to each field. Input is kept. |
| `RATE_LIMITED` (429) | Countdown from `Retry-After` ("Please wait 2 minutes before trying again"). The submit button is disabled *with* that text beside it. |
| `TENANT_NOT_SELECTED` | Go to `/select-clinic`. |
| `TENANT_SUSPENDED` / `TENANT_DEACTIVATED` / `TENANT_ACCESS_DENIED` | Full-page message plus "Choose another clinic". |
| `NOT_FOUND` | "We couldn't find this" page with a way back. Also covers another clinic's records. |
| `FORBIDDEN` | Inline or page message; refresh permissions. |
| `INTERNAL_ERROR` / `SERVICE_UNAVAILABLE` / network failure | "Something went wrong. Please try again." plus a retry button and a **"Details for support"** disclosure that shows and copies the `requestId`. |
| Offline (`navigator.onLine` plus failed fetch) | Persistent banner "You're offline. Changes will not be saved until you're back online." No silent queueing of writes. |
| Unexpected render error | Route-level error boundary with the same support details; the app shell stays usable. |

---

## 6. Design system summary (full detail in Phase 2)

| Token group | Proposal |
|---|---|
| Primary (light, fresh green) | `green-300 #8FD9A8`: fills and accents only, always with dark text (`green-950`, 9.31:1). Too pale for text or controls. |
| Primary for text and controls | `green-700 #1D6E41`: white on it 6.25:1; on the background 5.97:1. Hover `green-800 #175836` (8.45:1 with white). |
| Background | Off-white `neutral-25 #F9FAF7`; surfaces `#FFFFFF` |
| Third colour | **Warm coral** `coral-400 #FA7F62` (**confirmed**, Q7). Accent fills only; text on coral uses `neutral-900` (6.45:1). |
| Body text | `neutral-900 #1B211E` on the background: **15.63:1** (AAA) |
| Font | **Inter** (SIL Open Font License), self-hosted, with Noto Sans and then system UI as fallbacks. Checked in the font files themselves (Google Fonts builds, Inter 4.001, Noto Sans 2.015): both contain **₱ (U+20B1)**, **ñ/Ñ** and **tabular figures**. Inter also has alternate letterforms that tell `l`, `I` and `1` apart (enabled in Phase 2). Atkinson Hyperlegible Next was dropped because it has **no ₱**. |
| Base size | **18 px** body, 16 px minimum anywhere, line height 1.5 |
| Touch target | ≥ 44×44 px (48 px default for primary controls) |

All contrast figures were computed with the WCAG 2.x relative-luminance formula while writing this plan. Phase 2 turns them into an automated test over `tokens.json`.

---

## 7. Conventions (summary; `CLAUDE.md` for this repo is written in Phase 1)

- **Files:** `PascalCase.tsx` for components, `useThing.ts` for hooks, `kebab-case.ts` for other modules, `*.test.ts(x)` next to the code, `*.stories.tsx` next to design-system components, e2e in `tests/e2e/*.spec.ts`. *Proposed:* frontend unit tests use `.test.ts` and Playwright uses `.spec.ts`, so the two runners never pick up each other's files. The backend uses `.spec.ts` for unit tests; open question Q10 if you want them identical.
- **Arguments:** same rule as the backend `CLAUDE.md`. One argument may be positional. Two arguments of the same type, three or more, or any optional argument → one named object. Component props are always an object.
- **Components:** function components, named exports, no default exports (except where the router requires them). Data fetching lives in feature `api/` hooks, never inside design-system components.
- **shadcn/ui:** components are added with the shadcn CLI into `src/design-system/components/`, then restyled to our tokens and sizes. Once copied, they are our code: reviewed, tested and storied like any other component. Feature code imports them from the design system, never straight from Radix.
- **Text:** every user-facing string goes through Lingui. No string concatenation for sentences.
- **No `any`** and no non-null assertions in app code. Generated types are never edited by hand.
- **Tests first**, per `CLAUDE.md`, for every feature and bug fix.

---

## 8. Testing strategy

| Layer | Tool | Scope | Runs in CI |
|---|---|---|---|
| Unit | Vitest | Pure functions: formatters, error mapping, permission helpers, token-store/refresh logic, contrast test over tokens | yes |
| Component | Vitest + Testing Library + MSW + vitest-axe | Each component and feature screen: states, keyboard use, error display; **axe must pass** | yes |
| Story | Storybook test runner + axe | Every story of every design-system component | yes |
| End-to-end | Playwright (`tests/e2e/`) + @axe-core/playwright | Real API with seeded accounts: sign-in, refresh, cross-tab refresh, clinic switch, permission-hidden UI, email-link pages | yes, if the API can run in CI (Q2b/D-14) |
| Visual regression | Playwright screenshots of stories (proposed, Phase 2) | Tokens and components at 100% and 200% zoom | yes |
| Manual | Checklist | Screen reader (NVDA + Chrome, VoiceOver + Safari/iOS), 200% and 400% zoom, keyboard-only, TV from 3–5 m | per phase |

Rules carried over from `CLAUDE.md`:
- Positive, negative, validation, boundary and security cases.
- Cross-tenant isolation (a second clinic's data must never show after a switch).
- Never weaken an assertion to make a test pass.

---

## 9. Environments and configuration

| Variable | Example | Validated |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | absolute URL, no trailing slash |
| `VITE_APP_ENV` | `development` / `staging` / `production` | enum |
| `VITE_ERROR_REPORTING_DSN` | empty | optional; Phase 13 |

- Validated with Zod at startup. An invalid config renders a plain error page, not a broken app.
- **Production** (Q2): the app at `https://app.doctayo.<tld>` and the API at `https://api.doctayo.<tld>`, both on AWS EC2. They share the registrable domain, so the `SameSite=Strict` cookie works. The API's production `.env` must contain `CORS_ALLOWED_ORIGINS=https://app.doctayo.<tld>` and `APP_PUBLIC_URL=https://app.doctayo.<tld>` (email links), and `VITE_API_BASE_URL=https://api.doctayo.<tld>/api/v1`. The exact top-level domain is not yet stated.
- The web server on EC2 serves `index.html` with `Cache-Control: no-cache` and the hashed assets as immutable. It falls back to `index.html` for app routes and sets the security headers (CSP, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`).
- Local development runs against the backend's docker compose. The API's `.env` must contain `CORS_ALLOWED_ORIGINS=http://localhost:5173` and `CORS_ALLOW_CREDENTIALS=true`. Emails (reset, setup, invitation links) appear in the API's console at `LOG_LEVEL=debug`.

---

## 10. Phase status

| Phase | Status |
|---|---|
| 1 Foundation | Planned (full plan written; revised 2026-11-20 for shadcn/ui, Node 24, Filipino, EC2) |
| 2 Design system | Planned (full plan written; revised 2026-11-20); needs approval |
| 3–13 | Outlined |

---

## 11. Cross-cutting requirements

- **Accessibility:** WCAG 2.2 AA; AAA contrast for body text; 200% zoom without loss of content or function and reflow at 320 CSS px; full keyboard use; visible focus; no icon-only buttons; no timeouts the user is not warned about. The API session lasts 14 days idle and the 15-minute access token refreshes silently; the shared-device sign-out (§5.3.1) always warns 60 seconds ahead.
- **Privacy:**
  - No patient data in `localStorage`/`sessionStorage`/IndexedDB.
  - No personal data in URLs (ids only), page titles, analytics or error reports.
  - TV shows queue number or first name + last initial only, and never anything that reveals a priority category.
  - Printing is deliberate and shows only what the document needs.
- **Security:**
  - Strict CSP from Phase 1 (report-only first): `script-src 'self'`, `connect-src` = API origin.
  - No `dangerouslySetInnerHTML`.
  - Tokens handled only by `api/session/`.
  - Dependencies audited in CI.
- **Performance (proposed budgets, enforced in CI from Phase 1):**
  - The sign-in route's initial JS ≤ 170 KB gzip.
  - Each later route chunk ≤ 100 KB gzip.
  - LCP < 2.5 s on a mid-range Android phone on throttled 4G.
- **Browsers (proposed; Q9):** the last 2 versions of Chrome, Edge, Firefox and Safari; iOS Safari 16+; Android Chrome. The TV display targets a Chromium kiosk browser at 1920×1080 and 3840×2160.

---

## 12. Backend dependencies

Everything the frontend needs that is not in `docs/openapi.json` today, so it can be added to the backend plan. "Needed by" is the frontend phase that is blocked.

### 12.1 Contract fixes

| Id | Need | Status |
|---|---|---|
| D-1 | Optional **expected-tenant header** (for example `X-Tenant-Id`) that the API checks against the session's active tenant, answering a dedicated error code on mismatch. **Why:** the active clinic lives on the server session that all tabs share (§5.3), so a tab still showing Clinic A can write into Clinic B after another tab switched. The client mitigation helps, but only the server can make it safe. | **Open** (needed by Phase 3) |
| D-2 | Error response schema with enum codes | **Done** in the backend: `ErrorResponse`, `ErrorCode`, `FieldErrorCode` |
| D-3 | Nullable strings typed as `object` | **Done**: they are now typed as strings. Generator output checked: `string \| null`. |
| D-4 | Bearer security scheme | **Done**: `bearer`, with `security: []` on public operations |
| D-5 | Role keys in memberships | **Done**: roles are `{ key, name }` |

### 12.2 Backend Phase 4 (members, roles, profile)

| Id | Need | Needed by |
|---|---|---|
| D-6 | `GET /roles` (roles of the active clinic, with keys and display names) | Phase 4 invite form (integration guide §8 says do not build the form until this exists) |
| D-7 | List members, change a member's role, remove a member; list and revoke invitations; with permissions such as `members.read`, `members.manage` | Phase 4 staff screens |
| D-8 | `PATCH /me` (name, and ideally phone), email change and verification | Phase 4 profile editing |
| D-9 | A member's **branch assignment** (which branches a staff member works at) and whether a member is a **practitioner** (doctor), for example `GET /me` → `practitionerId`, `branchIds` | Default branch for reception, "my schedule" for doctors (Phases 3, 7) |
| D-10 | Platform-admin API: create clinic (with owner invite), list/search clinics, suspend/reactivate, user status; **separate operator authentication** with no tenant/clinical access | Phase 5 console |

### 12.3 Backend Phases 5–6

| Id | Need | Needed by |
|---|---|---|
| D-11 | Patients: create, get, update, archive, **typo-tolerant search** (for example trigram), clinic-specific patient number, pagination, duplicate warning on create; permissions | Phase 6 |
| D-12 | **Money representation** (integer centavos or decimal string, never a float), currency fixed to PHP | Phase 10 |
| D-13 | Appointments: per-doctor/branch day and week queries, book/reschedule/cancel/check-in/no-show, a dedicated double-booking error code, doctor availability/schedules, idempotency for booking (`Idempotency-Key` is already allowed by CORS) | Phase 7 |
| D-15 | Encounters: draft autosave **on the server** (so long notes are never lost and never stored on the device), vitals, ICD-10 code search endpoint, prescriptions, finalise, amendments with history | Phase 8 |
| D-16 | Billing: invoices, line items, Senior Citizen/PWD discount computed **server-side** (with VAT treatment), partial payments, refunds, receipt data | Phase 10 |
| D-17 | Notifications (reminder settings, email now and SMS later), report endpoints (appointments and revenue by branch and period), **audit log read endpoint** with filters | Phase 11 |

### 12.4 Queue and TV display (not planned on the backend at all)

| Id | Need | Why |
|---|---|---|
| D-18 | **Queue domain**: tickets created from check-ins and walk-ins; per-branch daily numbering (reset at midnight Asia/Manila); states (waiting, called, serving, done, skipped, no-show); assignment to a doctor or room; call next, recall, skip, transfer. **Priority lanes** (Q11) for seniors, PWD and pregnant patients, as a **per-clinic setting**: on/off, and how strictly priority patients go ahead (always first, or one in every *N* calls). Rules: the priority reason is **health-related information**, stored and shown to authorised staff only; priority tickets use the **same number series** as everyone else (no special prefix); the reason never appears in the display view (D-21). | Phase 9 reception and doctor controls |
| D-19 | **Rooms / service points** per branch (name shown on the TV) | "Proceed to Room 2" |
| D-20 | **Display device authentication**: an admin registers a display for one branch; the TV shows a pairing code; an admin enters it in settings; the device receives a long-lived, revocable credential scoped **only** to that branch's public queue (a distinct token type, no staff session, no other API access); a list of paired displays with last-seen and "revoke" | The TV runs unattended all day and must not hold a staff session |
| D-21 | A **display-safe queue view** endpoint whose response contains only ticket number, **display name already reduced on the server** (first name + last initial, or none) per a clinic setting, room/doctor label and status. No priority flag or reason, and no field from which the category can be read. | Data Privacy Act: full names and health-related information must never reach the TV device, not just be hidden by CSS |
| D-22 | **Live updates**: Server-Sent Events (preferred) or an ETag-friendly polling endpoint, with a "called" event id so the TV chimes once per call | The TV must update within a few seconds |
| D-23 | **Rate limits for clinics behind one IP**: the global limit is 300 requests/minute/IP, so a busy clinic's staff plus displays behind one NAT could hit it. Needs per-user/per-device limits or an exemption for display streams. | Avoid `429` storms on clinic networks |

### 12.5 Patient portal (future)

| Id | Need |
|---|---|
| D-24 | Patient accounts (a token type distinct from `staff`), guardian ↔ dependant links, patient-scoped read endpoints for appointments and released records, booking or requests if wanted |

### 12.6 Languages and shared devices

| Id | Need | Needed by |
|---|---|---|
| D-25 | A per-user **language preference** (`en` / `fil`) on `GET /me` and in `PATCH /me` (D-8), and **Filipino email templates** sent in the user's language | Phase 4 (until then the choice is stored on the device; emails stay English) |
| D-26 | A per-clinic **inactivity sign-out time** for shared devices (clinic setting) | Phase 4 settings (until then a fixed 10 minutes) |
| D-27 | *Optional:* a "confirm password" endpoint for the current session, to allow a lock screen that unlocks without a new sign-in | Not required; §5.3.1 works without it |

### 12.7 Testing infrastructure

| Id | Need |
|---|---|
| D-14 | A way to run the API in frontend CI: a published Docker image (or repository access) plus the dev seed, so Playwright e2e can run against the real API |

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Concurrent refresh across tabs logs users out | Web Locks plus a single in-flight promise; e2e test with two tabs (Phase 3) |
| Clinic switch in one tab affects other tabs | BroadcastChannel, cache cleared per clinic, D-1 |
| openapi.json drifts from the deployed API | `api:generate` plus a CI check that the generated file is up to date; a sync procedure (Q12) |
| shadcn/ui defaults are too small and low-contrast for older users | Phase 2 rewrites sizes and colours to tokens; the target-size and contrast tests guard them |
| Filipino text is longer and breaks layouts | Pseudo-locale in Storybook and visual tests; components wrap |
| Queue backend never planned, blocking Phase 9 | Dependencies listed now (§12.4); TV layout designed early with mock data in Storybook |
| Smart-TV browsers are quirky | Recommend a Chromium device (Android TV box or mini PC) in kiosk mode |
| Accidental patient data on shared reception devices | No local storage of patient data; inactivity sign-out on shared devices (§5.3.1) |

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

| # | Question | Answer | Where it is applied |
|---|---|---|---|
| Q1 | Stack | Approved, **with shadcn/ui** for components | §4, Phase 1, Phase 2 |
| Q2 | Hosting | **AWS EC2**: `app.doctayo.<tld>` (frontend), `api.doctayo.<tld>` (API) | §4, §9, Phase 1, Phase 13 |
| Q3 | Patient portal: same app or separate? | **Decide later**, at the start of Phase 12 | Phase 12 |
| Q4 | Languages | **Filipino is needed** (as well as English) | §5.6.1, Phases 1–2, D-25 |
| Q5 | Shared reception devices | **Yes**, protect them after inactivity | §5.3.1, Phase 3, D-26 |
| Q6 | Admin console | **Separate deployment**, built later | §5.2, Phase 5 |
| Q7 | Third colour | **Warm coral** confirmed | Phase 2 |
| Q8 | TV resolution | **1080p and 2160p** | Phase 2 §10, Phase 9 |
| Q11 | Queue priority | **Yes, a per-clinic setting.** The priority reason is health-related, so the TV shows no label and no special prefix. How strictly priority patients jump the queue (always first, or one in every few) is a clinic setting. Confirm the exact legal basis with the clinic owners. | D-18, D-21, Phase 9 |
| Q13 | Design keywords | **Confirmed**: calm, clean, trustworthy, warm, unhurried | Phase 2 |
| Q15 | Prescriptions and receipts | **No legal ruling here.** Until a clinic's accountant and a doctor confirm the rules (generic names, licence and PTR numbers, S2 numbers, BIR rules for official receipts and invoices, which have changed in recent years), build **printable templates** and **never present them as official receipts**. The backend plan tracks the same question for domain experts. | Phases 8, 10 |
| — | Font | Pick a professional font that covers ₱ and ñ → **Inter** (checked in the font file) | §6, Phase 2 |
| — | Node version | **Node 24**, same as the backend | §4, Phase 1 |

### 15.2 Still open

| # | Question | Default until answered |
|---|---|---|
| Q2b | **CI provider and the deploy step to EC2** (for example GitHub Actions building and copying the static files to the server), and the exact top-level domain | GitHub Actions for checks; the deploy step is written in Phase 13 |
| Q3 | Patient portal: same app or separate (to be decided at the start of Phase 12) | Keep the design system and API layer free of staff-app assumptions so both options stay open |
| Q4a | **Who translates into Filipino and who reviews** (including medical terms that stay in English) | English strings written first; Filipino added before each phase is released |
| Q8b | **TV screen size** (the type sizes assume ≥ 43" at up to 5 m) | ≥ 43" |
| Q9 | **Browser/device matrix:** any old devices in clinics (old iPads, Android 9 tablets)? | §11 list |
| Q10 | **Test file naming:** `.test.ts` for unit/component and `.spec.ts` for e2e (proposed), or `.spec.ts` everywhere like the backend? | Proposed split |
| Q12 | **openapi.json sync:** who copies it from the backend, and when? | Manual copy in a PR, then `api:generate` |
| Q14 | **Error monitoring:** third-party (with scrubbing) or self-hosted? | Decide in Phase 13; Phase 1 adds a reporting seam only |
| Q16 | **Inactivity sign-out time** for shared devices | 10 minutes with a 60-second warning (§5.3.1) |
| Q11b | **Legal basis for priority lanes**: to confirm with clinic owners before Phase 9 | |
| Q15b | **Prescription and receipt rules**: to confirm with a clinic's doctor and accountant before Phases 8 and 10 | Templates only (§15.1) |
