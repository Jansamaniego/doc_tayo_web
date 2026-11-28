# AGENTS.md: DocTayo Web conventions

The frontend for DocTayo, a multi-tenant clinic system. Read `plan.md` first; each phase has a plan in
`plans/`. The backend contract is in `docs/` (`openapi.json` is the source of truth).

**Never call an endpoint that is not in `docs/openapi.json`.** A feature that needs a missing endpoint is
written as a backend dependency in `plan.md` §12.

## Commands

| Command                                 | What it does                                                                |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                           | Vite dev server, http://localhost:5173                                      |
| `npm run lint` / `format:check` / `typecheck` | ESLint, Prettier, `tsc --noEmit`                                      |
| `npm test`                              | Vitest (unit + component), runner time zone America/New_York                |
| `TEST_TZ=Asia/Manila npx vitest run src/lib src/test` | The second date pass CI also runs                              |
| `npm run test:e2e`                      | Playwright against the real API (see README)                                |
| `npm run api:sync`                      | Copy `openapi.json` from `../doc-tayo-api` and regenerate `src/api/schema.d.ts` |
| `npm run api:check`                     | Fails if the generated types differ from `docs/openapi.json`                |
| `npm run i18n:extract`                  | Update `src/i18n/locales/*.po` after adding or changing messages            |
| `npm run build` / `size`                | Type-check + build; the startup JavaScript budget (170 kB gzip, from the build manifest) and 100 kB per lazy chunk |
| `npm run storybook` / `storybook:build` | The style guide: every token and component in every state                   |
| `npm run tokens:build` / `tokens:check` | Generate `tokens.css` and `tokens.ts` from `tokens.json` / verify they match |
| `npm run font:build`                    | Rebuild the Inter subset (needs `INTER_SOURCE`, see `scripts/build-fonts.ts`) |

## Running things in Docker

The project runs entirely in Docker (docs/docker.md): `docker compose up --build` starts the database, the API and
the dev server; `docker compose run --rm web <command>` runs any npm script above in the dev image (use
`--no-deps` for tools that need no API); `docker compose run --rm e2e` runs Playwright (Chromium, Firefox, WebKit)
against the real API. Never run the backend's own compose stack at the same time (same ports). If you change the
Dockerfile, compose file or nginx config, `scripts/docker-files.spec.ts` must stay green.

## Layout

```
src/app/            providers, router, root layout, boot, global pages
src/routes/         TanStack Router file routes: thin (guard + compose); logic lives in features/
src/features/<x>/   one folder per product area (auth, account, home, shell, admin, staff, clinic, patients): api/ (query hooks), components/, then folders by concern
src/design-system/  tokens/ (tokens.json is the source), components/, patterns/ (app shell, forms, permissions), tv/ (waiting-room display). Imports nothing from features/api/routes/app
src/api/            the ONLY place that calls the API: client, errors, session/, generated schema.d.ts
src/lib/            datetime/ (the only UTC<->clinic-time code), money.ts, preferences.ts, zod.ts, small helpers
src/i18n/           Lingui setup and catalogues (en + pseudo; fil arrives in Phase 16)
tests/e2e/          Playwright, <feature>.spec.ts
```

- Group by feature, then by concern; never a folder for one file. A file of a few lines lives in the file that
  uses it until a second consumer exists.
- Names: `PascalCase.tsx` components (named exports, no default exports except where the router needs them),
  `useThing.ts` hooks, `kebab-case.ts` everything else. `*.spec.ts(x)` next to the code; `*.stories.tsx` next to
  design-system components.

## Rules enforced by lint (do not work around them)

- `fetch` only inside `src/api/`. `localStorage`/`sessionStorage` only in `src/lib/preferences.ts`.
- `@date-fns/tz` only in `src/lib/datetime/`. Import `z` from `@/lib/zod.ts`, never from `zod` (CSP: no eval).
- No `dangerouslySetInnerHTML`. No hard-coded text in JSX: use `<Trans>` / `` t`...` `` (Lingui) and run
  `npm run i18n:extract`. Brand names are not translated.
- The design system must not import from features, api, routes or app.

## Code patterns

- **Arguments:** one argument may be positional. Two arguments of the same type, three or more, or any optional
  argument take **one object** with named fields. Two arguments of different types, none optional, may stay
  positional. Component props are always an object. No placeholder arguments; no parameter nothing reads.
- **Data fetching:** only in a feature's `api/` hooks (TanStack Query), never inside design-system components.
  Query keys for clinic data start with the active clinic id (`useActiveTenantId()`; a list that keeps the previous page while loading must do so only within the same clinic); platform admin data (`/admin/*`) starts with `'admin'`. All API failures are thrown as `ApiError`. A `4xx` is not retried.
  The client sends `X-Expected-Tenant-Id` itself. A form on its own page keeps what it first read in state, so a clinic switch in another tab (which reloads the queries) neither removes it nor mixes in the other clinic's data. What a form's pickers read is held with `useKeptForClinic()` for the same reason. A form that saves clinic data passes the clinic it was opened in (`useOpenedClinic()` from `src/lib/opened-clinic.tsx`, then `headers: requestHeaders({ tenantId })`), and a creating request goes through `createIdempotentAction()` (`src/api/idempotency.ts`, one instance per open form) with `requestHeaders({ idempotencyKey })`.
  Branch on `error.code`, never on `error.message`; user text comes from `src/api/error-messages.ts`.
- **Time and money:** the API speaks UTC. Convert only through `src/lib/datetime`; the time zone is always an
  explicit argument, never the computer's. Never write an amount as a float.
- **Permissions:** drive menus and buttons from `GET /me` `permissions`, not from role names. The server enforces
  them anyway. Hide what a role can never do; show read-only with a reason; never a bare disabled button. A clinic page that needs a permission sits under `<RequirePermission>` (`src/app/RequirePermission.tsx`), so a typed address shows "no access" and never asks for the data.
- **Tokens:** the access token lives in `src/api/session/token-store.ts` (memory). No patient data, token or
  typed form value goes in browser storage, a URL, a log or an error report.
- **Design tokens:** colours, type, spacing, radius and shadows come from `tokens.json` only. Use role classes
  (`bg-primary`, `text-ink-muted`, `border-control`); Tailwind's default colours do not exist. A new colour
  combination needs a line in `tokens/pairings.ts`; `tokens.contrast.spec.ts` must stay green.
- **Components:** shadcn/ui style (Radix), in `src/design-system/components/`: 48 px controls, 18 px text, no
  icon-only buttons (a visible label is required), 44 px targets. Every component has a `*.spec.tsx` (with axe) and
  a `*.stories.tsx` showing every state; `stories.spec.tsx` runs axe over every story. Merge classes with `cn()` from
  `@/lib/cn.ts` (it knows our type scale: plain `twMerge` drops colours next to `text-body-lg`).
- **Nothing may inject styles at runtime** (the CSP has no `'unsafe-inline'`): no Sonner, no CSS-in-JS. Radix's scroll lock does, so the build aliases `react-remove-scroll` to `src/design-system/scroll-lock.tsx`; keep that alias in `vite.config.ts`, `vitest.config.ts` and `.storybook/main.ts`. Toasts are
  `notify.success/info` only, for confirmations; errors and actions stay on the page until dismissed.
- A long form on its own page renders `<LeaveGuard>` (`src/lib/leave-guard.tsx`), which asks before its typed input is lost.
- **Dialogs** use `useReturnFocus` (Radix returns focus only to its own Trigger). Forms: `FormErrorSummary` +
  `applyApiErrors` (maps the API's dotted `details[].field` onto fields, keeps what was typed).
- **TV display:** `TvDisplay` accepts display-safe fields only (no full name, no priority). Never add one.
- **Accessibility:** WCAG 2.2 AA. Labels always visible, no icon-only buttons, 44x44 px targets, visible focus,
  one primary action per screen. Errors stay on the page until dismissed; toasts are for confirmations only.

## Testing rules (tests first, as in CLAUDE.md)

- Write the spec first, watch it fail for the expected reason, then implement.
- Unit/component specs are `*.spec.ts(x)` next to the file, with **axe inside the same spec**
  (`expect(await axe(container)).toHaveNoViolations()`). MSW (`src/test/msw/server.ts`) mocks the network, and an
  unexpected request fails the test. The runner time zone is America/New_York on purpose: code that uses local time fails.
- E2E specs are `tests/e2e/<feature>.spec.ts`, import `test`/`expect` from `./fixtures/test.ts` (it fails on any
  Content-Security-Policy violation), and call `expectNoAxeViolations(page)` on each page. They run against the real API.
- Cover positive, negative, validation, boundary and security cases, and cross-clinic isolation for clinic data.
- Never weaken or delete an assertion to make a test pass.

## Plans and docs

The code is the source of truth. When code differs from `plan.md`, a child plan or `docs/`, edit the plan in the
same change and record the deviation in the child plan's "As Built" section. `docs/*.md` (except `environment.md`,
`deployment.md`, `adr/`) and `docs/openapi.json` are copies from the backend: do not edit or reformat them here.
