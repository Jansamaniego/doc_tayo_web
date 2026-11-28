# Phase 8: Services catalog

Status: **built** (8.0 to 8.2, 2026-11-27, see "As Built"); written 2026-11-27. The end-to-end items run on Chromium only. Backend: **available**. Backend Phase 5, the rest of sub-phase **5.2, "Services catalog"**, shipped: `GET /services`, `GET /services/:serviceId`, `POST /services`, `PATCH /services/:serviceId` ([docs/clinical-integration.md](../docs/clinical-integration.md) §5.2 Services catalog, [docs/api-conventions.md](../docs/api-conventions.md) "Money", `docs/openapi.json`, now **61 operations**). New clinics also start with a **General consultation** service ([docs/platform-admin-integration.md](../docs/platform-admin-integration.md), "New clinic"). Depends on Phase 5.6 (the Clinic tab and its branch pages, whose pattern this phase follows), Phase 6 (the opened-clinic rule P6-4, `LeaveGuard`, the form patterns) and Phase 7 (`src/lib/opened-clinic.tsx`).

**Numbering.** "Phase 8" and "8.x" are the frontend's; "5.2" is the **backend's** sub-phase. Plan 07 first said services would be added to Phase 7 as 7.5; the product owner made them a phase of their own on 2026-11-27, and the later phases moved down by one; appointments became Phase 9 the same day, moving them once more (consultations are now Phase 10, Filipino Phase 16).

| Sub-phase | Milestone | Who uses it | What it adds |
| --------- | --------- | ----------- | ------------ |
| 8.0 Foundations | M0 | everyone | Regenerated types; money to and from the API's decimal strings; durations in words; the services query hooks |
| 8.1 Services list and service page | M1 | every clinic role (`services.read`) | A **Services** tab in Clinic: the clinic's services with duration and price; one service's page |
| 8.2 Add, edit, deactivate and reactivate | M2 | owner, clinic admin (`services.manage`) | Add a service, edit it, take it out of use and bring it back; inactive services for managers |

End-to-end runs for both are milestone M3.

## 1. Objectives

- Everyone at the clinic can look up what the clinic offers, how long it usually takes and the price to quote, in one place.
- An owner or clinic admin can keep the price list up to date without help, and cannot save a price the API would refuse.
- A price is never shown or handled as a payment: **DocTayo takes no payments** (the guide). Patients pay at the desk.
- No amount is ever a floating-point number, on screen, in the code or in a request.

## 2. Decisions

| #    | Decision | Why |
| ---- | -------- | --- |
| P8-1 | **Where:** (decided 2026-11-27, Q31) a third tab, **Services**, in the Clinic area, after Profile and Branches (`ClinicTabs`). No new navigation item. Routes: `/clinic/services` (list) and `/clinic/services/$serviceId` (service page) under `RequirePermission('services.read')`; `/clinic/services/new` under `services.manage`. Without the permission the tab is hidden and a typed address shows "no access" without asking for data. The page heading is **Services and prices**. | The guide calls it "price list settings"; it is clinic set-up, like branches, and every role holds `tenant.read` and `services.read`, so everyone reaches it. Same route and guard pattern as `/clinic/branches` (Phase 5.6). |
| P8-2 | **The service page follows the branch page:** it shows the service, and for `services.manage` it has **Edit** (the form opens on the same page), **Deactivate** or **Reactivate**. No separate edit route. | Same area, same pattern (`BranchPage`); one form component for add and edit. |
| P8-3 | **Money crosses the API boundary only as a decimal string** (D-12, now decided by the backend: `"500.00"`, two decimals in answers, up to two in requests, never a JSON number). Inside the app an amount stays **whole centavos** (`number`, a safe integer), as `formatPeso` and `MoneyField` already use. Two new helpers in `src/lib/money.ts`: `centavosFromApi('500.00')` → `50000` (string parsing, no `parseFloat`; refuses anything else) and `centavosToApi(50000)` → `"500.00"`. Nothing else converts money. | The integer-centavos design of Phase 1 stays correct; only the edge changes. No float on either side. |
| P8-4 | **A price has three states, and the screens say which:** a fixed price ("₱500.00"), **Free** (`"0.00"`), and **No fixed price** (`null`, shown as "Price at the desk"). The form asks with a `RadioGroup` (**No fixed price**, **Free**, **Fixed price**) and shows `MoneyField` (**Amount**) only for Fixed price, which is last so that the amount is directly under it. A fixed price of ₱0 is refused with "Choose Free for a service without charge." | The guide: `null` is not the same as free. Three named choices are clearer than an empty field meaning something. |
| P8-5 | **Price limits checked before sending:** at least ₱0.01 for Fixed price, at most two decimals, at most ₱9,999,999,999.99. Commas typed as thousands separators are accepted and never sent. The upper limit comes from the **backend's source** (`^\d{1,10}(\.\d{1,2})?$`, a `numeric(12,2)` column), not from the contract, which has no `pattern` or `maximum`: backend request **D-34**. If the API still answers `VALIDATION_FAILED` on `price`, it goes under the field. | Not saving what the API would refuse (objective 2); the limit must not be guessed silently. |
| P8-6 | **Duration** is a whole number of minutes, 5 to 480, typed in a labelled field ("Usual length, in minutes", hint "5 to 480 minutes. A suggestion for the appointment length; it can be changed when booking.") and shown in words: "15 minutes", "1 hour", "1 hour 30 minutes" (a `formatDuration` with ICU plurals, in `src/lib/duration.ts` since booking, its second user, Phase 9.2). New services start at 30 minutes. | The guide: "only a suggestion for the appointment length". Words read better than "90 min" for every user and screen reader. |
| P8-7 | **The list** shows name (and the description under it, when there is one), duration and price, ordered by name as the API sends it, paginated by the API (20, 50 or 100 a page; `page` and `pageSize` in the address). Query keys `[tenantId, 'services', filters]`; a list that keeps the previous page while loading does so only within the same clinic. | API pagination; the Phase 5 and 6 list rules. |
| P8-8 | **Inactive services** are shown only to people with `services.manage`: a **Show inactive services** checkbox (`includeInactive=true`, `inactive=1` in the address), each marked **Inactive**. Everyone else sees active services only; a reader who opens an inactive service's address still sees it, marked Inactive (the API serves it by id so old records can show its name). | As P7-4: reception has no use for inactive services in the list; the API keeps them readable by id. |
| P8-9 | **Add:** `POST /services` with `name`, `defaultDurationMinutes`, and `description` and `price` (`null` when not given). `201` → the service page, toast "{name} added." The contract has **no `Idempotency-Key`** for it: the button is disabled while saving. `409 CONFLICT_UNIQUE` → under **Name**: "This clinic already has a service with this name." and the list is read again (the guide: a retry that answers `409` may have saved the first time). | Guide "Services catalog". |
| P8-10 | **Edit sends only what changed**; an emptied description is `null`; a price changed to No fixed price is `null`; no change means no request ("Nothing to change."). There is **no `version`: the last save wins**, so the form opens on a fresh read of the service. `409 CONFLICT_UNIQUE` as in P8-9; `404` → "We could not find this service". | Guide; the Phase 5 to 7 rules (P5-15, P6-6, P7-9). |
| P8-11 | **Deactivate** asks first ("Deactivate {name}?" / "{name} will no longer be offered when booking. Nothing is deleted, and past records keep its name."); **Reactivate** needs no confirmation. Both are `PATCH { isActive }`. Services are **never deleted** and the app offers no delete. | Guide: "Services are never deleted." Same wording pattern as P7-9. |
| P8-12 | **Forms send the clinic they were opened in** (`useOpenedClinic()`, `requestHeaders({ tenantId })`, P6-4), and what a form shows or holds survives a clinic switch in another tab. | One rule for every form that saves clinic data. |
| P8-13 | **General consultation is an ordinary service:** no special label, it can be renamed, priced or deactivated like any other. | Guide: "It is an ordinary service." |
| P8-14 | **Prices are information, never a checkout** (Q32: billing stays as planned until the backend plans it). No "Pay", "Charge", cart, total or receipt anywhere in this phase. The page says once, under the heading: "Prices the front desk quotes. Patients pay at the desk." | Guide: "show prices as information, never as a checkout." |
| P8-15 | **Not built here:** the **service picker** (`GET /services?pageSize=100`): its first user is appointment booking (backend 5.3, not available), so it is built with booking, as the practitioner picker is (P7-12). Deleting a service (not in the API). Prices per branch or per practitioner (not in the API). | No screen uses them yet, or the API has none. |

## 3. Start condition

- Phases 5.6, 6 and 7.0 to 7.4 are built (they are).
- `docs/openapi.json` has the four `/services` operations (copied from the backend; 61 operations in all), and 8.0 regenerated `src/api/schema.d.ts` from it. D-33 is still open in this contract.
- Test data (backend `npm run db:seed:dev`): Sunrise has General consultation (no price), Follow-up (15 minutes, ₱300.00), Pediatric check-up (30, ₱600.00), Wound dressing (20, ₱250.00) and an **inactive** Medical certificate (10, ₱150.00); Lakeside has General consultation and Vaccination (15, ₱350.00). Clinics created before backend 5.2 got General consultation from the backend's migration. **Run the seed again on an older database** before 8.1 is checked.

## 4. What changes in existing code

| Area | Before this phase | Change (sub-phase) |
| ---- | ----------------- | ------------------ |
| `src/api/schema.d.ts` | 57 operations | Regenerated: 61 (`/services`, `/services/{serviceId}`) (8.0) |
| `src/lib/money.ts` | `formatPeso({ centavos })`, marked provisional (D-12 undecided) | D-12 decided: adds `centavosFromApi` and `centavosToApi` (P8-3); the "provisional" note goes (8.0) |
| `ClinicTabs` | Profile, Branches | Adds **Services** (shown with `services.read`, P8-1) (8.1, with its first route) |
| `src/lib/permissions.ts` | Comment: routes require `directory.read` and `practitioners.manage` since backend 5.2 | Adds `services.read` to that note (8.1) and `services.manage` (8.2), as routes require them |

## 5. Screens

All text in the English catalogue; the list uses `DataTable` and `Pagination`; the form uses `FormErrorSummary` + `applyApiErrors`, checks every field on each press, keeps what was typed on any failure, and renders `LeaveGuard` (on the add page; while editing on the service page).

### 8.1 Services list and service page (M1)

`/clinic/services` (`GET /services?page=&pageSize=`, plus `includeInactive=true` for managers who ticked it):

- Heading **Services and prices**, the line of P8-14, then the table: **Service** (name; description under it in smaller text), **Usual length** ("30 minutes"), **Price** ("₱500.00", "Free", "Price at the desk"), and **Status** only for `services.manage` (Active / Inactive).
- A name opens the service page. For managers: **Show inactive services** (P8-8, 8.1) and **Add a service** (primary, 8.2).
- States: loading; "No services yet" (8.2 adds Add a service for managers; a clinic always starts with one, so this is rare); error with request id and Try again; a page past the end is replaced in the address by the last page (Back does not return to it).
- A screen reader hears a fixed price in words ("1,250 pesos and 50 centavos").

`/clinic/services/$serviceId` (`GET /services/:serviceId`):

- Heading: the name; then description ("No description"), usual length, price, and an **Inactive** banner for a deactivated service.
- For managers (8.2): **Edit**, **Deactivate** or **Reactivate**.
- `404` (unknown, or another clinic's service) → "We could not find this service" with a way back to the list.

### 8.2 Add, edit, deactivate and reactivate (M2)

- `/clinic/services/new`: **Name** (required, at most 120; hint "For example Follow-up or Wound dressing"), **Description** (optional, at most 500), **Usual length, in minutes** (required, whole number 5–480, starts at 30), **Price** (P8-4: No fixed price, Free, Fixed price + amount; starts at No fixed price). P8-9 for the answer.
- Edit on the service page: the same fields, filled from a fresh read (P8-10).
- Deactivate and Reactivate on the service page (P8-11); both refresh the service and the list.
- Errors on any of them: `VALIDATION_FAILED` on its fields; `CONFLICT_UNIQUE` under Name; `404` → "We could not find this service"; `403 FORBIDDEN` → the message, and permissions are read again (§5.5); anything else through `SaveFailure`.

## 6. Code layout

```
src/features/services/
  api/          services.ts (useServices, useService, useFreshService, useCreateService,
                useUpdateService)
  ServicePrice.tsx  the three price texts, with the amount in words for screen readers
  list/         ServicesPage
  record/       ServicePage, EditService, ServiceActions, ServiceNotFound
  form/         NewServicePage, ServiceForm (add and edit), service-form-values.ts
                (+ spec: price states and limits, durations, changed fields only)
src/routes/_app/_clinic/clinic/services/  index.tsx, new.tsx, $serviceId.tsx
src/features/clinic/ClinicTabs.tsx               + Services
src/lib/money.ts                                 + centavosFromApi, centavosToApi
src/lib/duration.ts                              formatDuration (P8-6; moved here in Phase 9.2)
tests/e2e/services.spec.ts                       reads the seeded services; the refusals
tests/e2e/service-management.spec.ts             changes, in a clinic the spec creates
```

`features/services/` is its own folder (not `features/clinic/`) because booking, consultations and billing will use the services api too.

## 7. Backend endpoints

All available (backend 5.2):

| Call | Permission | Used by |
| ---- | ---------- | ------- |
| `GET /services?page=&pageSize=&includeInactive=` | `services.read` | 8.1, 8.2 |
| `GET /services/:serviceId` | `services.read` | 8.1, 8.2 |
| `POST /services` | `services.manage` | 8.2 |
| `PATCH /services/:serviceId` (`name`, `description`, `defaultDurationMinutes`, `price`, `isActive`) | `services.manage` | 8.2 |
| `GET /me` (`permissions`) | signed in | the tab, the controls |

**Not available, so not built:** deleting a service, prices per branch or per practitioner, an idempotency key on `POST /services`, a `version` for edits.

## 8. Milestones and their tests (tests first in each)

Every component spec includes axe; every e2e page calls `expectNoAxeViolations`. Specs run in New York time; the money and duration specs also in the Manila pass.

### M0: Foundations (8.0)

- `api:check` passes after the regeneration; the existing suite stays green.
- `money.spec.ts`: `centavosFromApi` for `"0.00"`, `"0.05"`, `"500.00"`, `"1234.50"`, `"9999999999.99"`; refuses `"1e3"`, `"-1.00"`, `"1.005"`, `"1,000.00"`, `""`, `" 5"`; `centavosToApi` for 0, 5, 50000, 123450 and 999999999999; refuses a negative, a fraction and an unsafe integer; a round trip never changes a value. No `parseFloat` or `Number(string)` of a decimal in the module.
- `formatDuration` spec: 5, 15, 59, 60, 61, 90, 120, 480 minutes; plurals; refuses 0 and a fraction.
- `services.ts` specs: the key starts with the clinic id; the request carries page, pageSize and includeInactive only when ticked; a clinic switch never shows the other clinic's services; `useFreshService` always asks again.

### M1: Services list and service page (8.1)

- `ClinicTabs` / `routes.spec.tsx`: the **Services** tab with `services.read`; without it, no tab and "no access" without a request on both addresses.
- `ServicesPage.spec.tsx`: the columns and the three price texts; a description under the name; Status column, **Show inactive services** and **Add a service** only for managers; the checkbox and page in the address and the request; a bad address value is ignored (never sent to the API); a page past the end; loading, empty, error with request id; never "Pay" or a total.
- `ServicePage.spec.tsx`: every field, "No description", the Inactive banner (also for a reader opening an inactive service), `404`, no manager controls for a reader.

### M2: Add, edit, deactivate and reactivate (8.2)

- `service-form-values.spec.ts`: the three price states to the request (`"500.00"`, `"0.00"`, `null`); Fixed price with ₱0, over the limit and empty refused (three decimals and commas are the amount field's, tested in `NewServicePage.spec.tsx`); duration 4, 5, 480, 481 and 30.5; name 120 and 121; description 500 and 501; only changed fields in an edit, `null` for an emptied description, nothing for no change.
- `routes.spec.tsx`: `/clinic/services/new` without `services.manage` shows "no access"; **Add a service** only for managers.
- `NewServicePage.spec.tsx`: the request body; the opened clinic is sent; `201` → the service page and the toast; `CONFLICT_UNIQUE` under Name and the list read again; `VALIDATION_FAILED` on its fields (including `price`); the button disabled while saving; what was typed survives a clinic switch in another tab; leaving with typed input asks.
- `ServicePage.spec.tsx` (edit): opens on a fresh read; only changed fields; "Nothing to change."; `CONFLICT_UNIQUE`; `404`; switching a fixed price to No fixed price sends `price: null`.
- `ServiceActions.spec.tsx`: Deactivate asks, names the service, focuses Cancel, sends `{ isActive: false }`; Reactivate sends `{ isActive: true }`; both refresh the service and the list; a failure stays on the page.

### M3: End-to-end (real API, after M0–M2)

Chromium, serial, in two files: `tests/e2e/services.spec.ts` only reads Sunrise's seeded services (items 1, 2, 5), and `tests/e2e/service-management.spec.ts` makes every change in an **e2e clinic created through the platform admin** (as `practitioner-management.spec.ts` does), never in Sunrise (items 3, 4). Services cannot be deleted, so each run leaves one e2e clinic with its services.

1. Receptionist in Sunrise: Clinic → **Services** lists the seeded services with "Price at the desk" for General consultation and ₱300.00 for Follow-up; no inactive Medical certificate, no Status column, no Add button; `/clinic/services/new` shows "no access"; a direct `POST /services` with their token answers `403`.
2. Owner in Sunrise: **Show inactive services** shows Medical certificate marked Inactive; nothing is changed.
3. The e2e clinic's owner: the new clinic starts with General consultation; adds "E2E Follow-up" (15 minutes, ₱1,250.50 typed with a comma) and sees ₱1,250.50 after a reload; adding "e2e follow-up" is refused under Name; edits it to Free, then No fixed price; edits General consultation's price.
4. Deactivate "E2E Follow-up" (gone from the list, shown with Show inactive, its page still opens), then reactivate it.
5. Cross-clinic: a Sunrise service's address opened as Lakeside's owner → "We could not find this service".
6. axe on every services page at 1280 px and 360 px; no sideways scrolling.

## 9. Acceptance criteria

- Every milestone's specs pass (New York and Manila runs), plus lint, format check, typecheck, `api:check`, `tokens:check`, `i18n:extract` with no missing message, `build`. Each new route chunk stays under 100 kB gzip.
- The M3 e2e passes against the real API on Chromium (Firefox and WebKit in Docker).
- No amount is parsed or computed as a floating-point number; no screen offers a payment.
- `plan.md` (§0, §3, §5.2, §5.5, §5.6, §10, §12), this plan's "As Built" and `AGENTS.md` (if a pattern is added) match the code.

## 10. Accessibility and UX notes

- One primary action per screen: Add a service on the list (managers); Edit on a service page (Reactivate when inactive); Save on the form.
- Prices are read as words by a screen reader ("500 pesos", "Free", "Price at the desk"), never "P 500".
- The price choice is one labelled group ("Price"); the amount field appears directly under **Fixed price** and is the next Tab stop. Focus is not moved when it appears: arrow keys select radios, and moving focus on selection would pull a keyboard user out of the group (WCAG 3.2.2).
- The duration field is a text field with `inputMode="numeric"`, not a spinner, so it can be typed and read easily.
- Works at 320 px: on a phone the table shows as cards (`DataTable`'s `auto` layout).

## 11. Open questions

Decided by the product owner (2026-11-27):

- **Q31:** Services is **a tab in Clinic**, not its own navigation item (P8-1).
- **Q32:** Phase 12 ("Billing and payments") stays **unchanged until the backend plans its billing phase**; nothing in this phase takes a payment (P8-14).

Still open: none for this phase. Backend request: **D-34** (P8-5).

## As Built

### 8.0 Foundations (2026-11-27)

Built as planned (P8-3, P8-6, the query hooks and the tests of M0), with these differences, which the plan body above already describes or which are recorded here:

- **`ClinicTabs` and the permissions comment wait for 8.1 and 8.2** (§4 first listed them under 8.0): a tab would lead to a page that does not exist yet.
- **`formatDuration` is in `features/services/duration.ts`**, not under `form/`: the list and the service page use it too. It refuses anything but a whole number of minutes from 1.
- **`centavosFromApi` is strict:** exactly two decimals, as the API answers. `"5"` and `"5.0"`, which the API accepts in requests, are refused when read. Both helpers refuse amounts too large to count exactly; `centavosToApi` refuses negatives.
- **Only the read hooks:** `useCreateService` and `useUpdateService` come with their forms in 8.2.
- **No screen uses any of it yet**, so nothing changed for the user.
- **Files:** `src/lib/money.ts`, `features/services/duration.ts`, `features/services/api/services.ts`, `src/api/schema.d.ts`, the message catalogues.

Verified (2026-11-27): the new specs failed first for the expected reason; 121 Vitest files, 1788 specs pass (New York) and the Manila pass (301 for `src/lib`, `src/test`, the practitioners and the services); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass. `size` still fails as before: startup JavaScript 224.2 kB gzip (budget 170 kB).

Not verified: the hooks against the real API (mocked specs only; 8.1 is their first user), and no e2e run (no screen changed).

### 8.1 Services list and service page (2026-11-27)

Built as planned (P8-1, P8-2's read part, P8-4's texts, P8-7, P8-8, P8-14, the screens of §5 and the tests of M1), with these differences, which the plan body above already describes or which are recorded here:

- **Left for 8.2:** **Add a service**, the `/clinic/services/new` route (and its "no access"), and Edit, Deactivate and Reactivate. Until then `/clinic/services/new` is read as a service id and shows "We could not find this service".
- **A page past the end:** the list asks the route to replace the address with the last page, and shows loading meanwhile.
- **Prices for screen readers:** the "₱" amount is hidden from them and the words are read instead (`ServicePrice.tsx`).
- **The Services tab** is hidden without `services.read`.
- **An unknown or broken address** (`404`, or `400` for a value that is not an id) shows "We could not find this service".
- **Files:** `features/services/` (`list/ServicesPage`, `record/ServicePage`, `ServicePrice`), `features/clinic/ClinicTabs.tsx`, routes `_clinic/clinic/services/index.tsx` and `$serviceId.tsx`, `src/lib/permissions.ts` (comment), `tests/e2e/services.spec.ts`.

Verified (2026-11-27): the new specs failed first for the expected reason; 123 Vitest files, 1819 specs pass (New York) and the Manila pass (325 for `src/lib`, `src/test`, the practitioners and the services); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass. Against the real API on Chromium, `tests/e2e/services.spec.ts` (8 specs, seeded test database): the receptionist's list, a service page, bad and past-the-end addresses, `403` from `POST` and `PATCH` with their token, unknown ids, 360 px, the owner showing the inactive service, and Lakeside's owner seeing only Lakeside's services and getting "not found" for Sunrise's. `smoke` (4), `practitioners` (12), `clinic-settings` (9, developer database) and design-system with CSP (47) also pass. The route chunks are about 1.4 kB and 1.0 kB gzip; startup JavaScript 227.8 kB (224.2 before; budget 170 kB, already exceeded).

Not verified: more than one page of services against the real API (mocked specs only), a clinic with no services, Firefox and WebKit (need Docker), manual screen-reader, zoom and visual checks. The other e2e specs were not rerun.

### 8.2 Add, edit, deactivate and reactivate (2026-11-27)

Built as planned (P8-2, P8-4, P8-5, P8-9 to P8-12, the screens of §5 and the tests of M2 and M3), with these differences, which the plan body above already describes or which are recorded here:

- **Price order and focus:** No fixed price, Free, Fixed price (the plan listed Fixed price first), and focus is **not** moved to the amount (§10).
- **One form component, `ServiceForm`,** holds the fields, the checks, the API's problems and the leave guard; there is no `ServiceFields` or `use-service-form.ts`.
- **The design system's `MoneyField` takes an optional `name`,** so the error summary's link can focus it.
- **The edit form** opens in place of the service page ("Edit service" and the name). It waits for a fresh read and never edits a cached copy: if that read fails it shows the error with **Try again** and **Cancel**. It keeps what it read when the clinic is switched in another tab. **Cancel** discards without asking, as on the branch page; moving to another page with changes asks.
- **After a save** the answer is put in the query cache and the clinic's service queries are read again, whatever the answer was. A later read that fails leaves the page as it is, unless it says the service is gone ("We could not find this service").
- **A deactivated or reactivated service** is announced by a toast ("{name} is deactivated." / "{name} is active again.").
- **`403 FORBIDDEN`** is shown on the page; the app's existing handler reads the permissions again.
- **Files:** `form/` (`NewServicePage`, `ServiceForm`, `service-form-values.ts`), `record/` (`EditService`, `ServiceActions`, `ServiceNotFound`), `api/services.ts` (`useCreateService`, `useUpdateService`), route `_clinic/clinic/services/new.tsx`, `tests/e2e/service-management.spec.ts`.

Verified (2026-11-27): the new specs failed first for the expected reason; 126 Vitest files, 1892 specs pass (New York) and the Manila pass (394 for `src/lib`, `src/test`, the practitioners and the services); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass. Against the real API on Chromium: `tests/e2e/service-management.spec.ts` (6 specs, developer database, a new clinic): General consultation is there, a service added with ₱1,250.50 and kept after a reload, the same name in other letters refused, edited to Free and then no fixed price, General consultation priced (a taken name refused), deactivated, found with Show inactive, reactivated, and the forms at 360 px. `tests/e2e/services.spec.ts` (8) now also checks that the receptionist has no Add button and gets "no access" for the add page. Design-system and CSP specs (47) pass. Startup JavaScript 228.8 kB gzip (227.8 before; budget 170 kB, already exceeded); each services route chunk is at most about 2.3 kB.

Not verified against the real API: server-side field errors, an edit of a service gone meanwhile, and a clinic switch while a form is open (unit specs cover them). Not done: Firefox and WebKit (need Docker), manual screen-reader, zoom and visual checks. The other e2e specs were not rerun after 8.2.

