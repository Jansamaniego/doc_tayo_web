# Phase 6: Patients (sub-phases 6.0–6.5)

Status: **built, 6.0 to 6.5 and the M6 end-to-end items** (2026-11-25, see "As Built"); the cross-browser runs and manual checks are not done (written 2026-11-25). Backend: **available** for this phase only: backend Phase 5, sub-phases **5.0** (clinical foundations: the `X-Expected-Tenant-Id` header, `Idempotency-Key`, `version`, declared path parameters, the clinical permissions) and **5.1** (patients). Source: [docs/clinical-integration.md](../docs/clinical-integration.md) and [docs/api-conventions.md](../docs/api-conventions.md); the shapes are in `docs/openapi.json` (51 operations, checked identical to the backend's copy on 2026-11-25). Depends on Phase 3 (session, guards, shell), Phase 5 (lists, `RequirePermission`, the form and dialog patterns, the clinic time zone) and the design system's `DateField`.

**Numbering.** "Phase 6" is the frontend phase; "5.0" and "5.1" are the **backend's** sub-phases. The clinical guide's later sub-phases are not available yet and get their own child plans when they ship: backend 5.2's practitioners and staff directory and 5.3 (appointments) for frontend **Phase 7**, 5.2's services catalog for **Phase 8**; backend 5.4 (consultations) and 5.5 (prescriptions) for frontend **Phase 9**.

The work is split into six sub-phases, built and verified in this order. 6.0 changes code every screen shares; 6.1–6.5 are the patient screens for the front desk (every default role holds `patients.read` and `patients.manage`).

| Sub-phase | Milestone | What it adds |
| --------- | --------- | ------------ |
| 6.0 Clinical foundations | M0 | Regenerated types and the five new error codes; `pathParams()` removed (D-30 done); the clinic check header on every request; idempotency keys for creating requests; patient-data cache rules |
| 6.1 Patient list and search | M1 | **Patients** navigation item, one search box (name, patient number or phone), "Show archived", pagination |
| 6.2 Patient page | M2 | The patient's details, allergies, front-desk notes, archived banner |
| 6.3 Register a patient | M3 | Registration form, the "Is this the same person?" duplicate warning, safe double taps |
| 6.4 Edit a patient | M4 | Edit form that sends only what changed, with `version`, and the "someone else saved first" flow |
| 6.5 Archive and restore | M5 | Archive with a reason, restore |

End-to-end runs for all of them are milestone M6.

## 1. Objectives

- The front desk finds any patient in seconds, from a name typed with typos or without accents, a patient number or a phone number in any format.
- Registering a patient never creates an accidental double (a double tap, a retry) and always shows likely existing records first, without blocking a genuine new registration.
- Two people editing the same patient never silently overwrite each other.
- Patient data never leaks: not between clinics, not into the browser's storage, history, address bar, logs or error reports.

## 2. Decisions

| #     | Decision | Why |
| ----- | -------- | --- |
| P6-1  | **Routes:** `/patients` (list), `/patients/new`, `/patients/$patientId`, `/patients/$patientId/edit`. One navigation item, **Patients** (`requires: 'patients.read'`), after Home. `/patients/*` sits under `RequirePermission('patients.read')`; `/new` and `/edit` also under `patients.manage`. | Full pages, not dialogs: the forms are long and are used on tablets. Same guard pattern as Phase 5. |
| P6-2  | **The address keeps only `page`, `pageSize` and `includeArchived=true`.** Search text never goes in the address, history or analytics (it is personal data; the API does not log it either). The patient id in the path is an opaque UUID, not personal data. | AGENTS.md: no typed value or patient data in a URL. |
| P6-3  | **No patient name in the browser tab title.** Pages are titled "Patients", "Patient record", "Register a patient", "Edit patient". | Titles are kept in the browser history, and reception computers are shared (plan.md §2.4). |
| P6-4  | **The clinic check header.** The API client sends `X-Expected-Tenant-Id` on every request while a clinic is active, never empty. Queries send the active clinic. **A form sends the clinic it was opened in**, captured when it mounts, not the current one. `409 TENANT_MISMATCH` is handled once, globally: reload the session (as `onForbidden`), keep the form and what was typed, and show "This page was opened for {clinic A}. You are now working in {clinic B}. Nothing was saved." | Another tab's clinic switch reaches this tab through the tab broadcast, so a form typed for Clinic A would otherwise pass the check and save into Clinic B. Only the clinic the form was opened in is the person's intent. |
| P6-5  | **Idempotency keys.** One key per user action: a create form makes a key when it opens and reuses it for every press and retry until one succeeds, then makes a new one. The key is a UUIDv7 from `newRequestId()`. `409 IDEMPOTENCY_KEY_IN_USE` (the first press is still running) waits `Retry-After` (2 s when absent) and sends the same request **once** more; a second `IN_USE` shows "Still saving. Please wait a moment." **`422 IDEMPOTENCY_KEY_REUSED` has a way out** (added 2026-11-25): it can happen to a person, when a create succeeded but the answer was lost, and they then changed the form and pressed again. The form keeps what was typed, shows "This patient may already have been registered. Check the matching records before registering again.", asks for the possible duplicates again (P6-13), and offers **Register as a new patient**, which is the only thing that starts a new key. `IDEMPOTENCY_KEY_INVALID` is a programming error: the general message with the request id. | The guide's rules; a double tap or a retry after a timeout registers one patient, and a lost answer never leaves the form stuck or silently registers the patient twice. |
| P6-6  | **Edits send `version` and only the changed fields**; an emptied optional field sends `null`; a name cannot be emptied (client check). No change means no request ("Nothing to change."). | Guide 5.1 "Editing"; the Phase 5 rule (P5-15). |
| P6-7  | **"Someone else saved first" (`409 VERSION_CONFLICT`):** the edit form reads the patient again and shows "Someone else saved changes to this patient while you were editing" with each field that changed on the server (label, before, now). The form is then based on the new record and its `version`: **a field the person changed keeps what they typed** (marked when the server changed it too), and **a field they did not change takes the newly saved value**, so pressing Save never sends it and never undoes the other person's change. The person checks and presses **Save** again; nothing is saved automatically. | The guide: reload, show what changed, let them redo the edit. Nothing typed is lost, and nothing someone else saved is overwritten unseen. |
| P6-8  | **Patient data is never kept longer than the screen that shows it.** Patient queries have `gcTime: 0` (dropped as soon as no screen uses them) and keys `[tenantId, 'patients', …]`; nothing is persisted; the existing cache clear on sign-out and clinic switch stays. | `Cache-Control: no-store` and the guide; shared devices. |
| P6-9  | **The birth date is a plain calendar date** (`YYYY-MM-DD`) entered with `DateField` (month by name, day, year) and never passed through a time zone. The form refuses a date before 1900-01-01 or after today **in the clinic's time zone**, and never pre-fills today. The age ("38 years", "11 months" under 2 years) is computed from the birth date and today in the clinic's zone (new `todayInZone()` and `ageOn()` in `src/lib/datetime/`). | Guide "Birth date"; a doctor's phone in another zone must still show the same age. |
| P6-10 | **Phones are typed any way people do;** the server normalises them (`+639171234567`). The form does not check the format; on `phone: INVALID_FORMAT` it says "Enter a mobile number, or start a landline or foreign number with + and the country code." Shown phones are grouped for reading (`+63 917 123 4567`); other countries as stored. The same applies to the guardian's phone. | The API accepts local formats; a stricter client check (as for the clinic's contact phone, P5-19) would refuse numbers the API accepts. |
| P6-11 | **One search box** (`SearchField`, 300 ms after typing stops), at most 100 characters (cut), with "Show archived" as a checkbox. Results: name, patient number, birth date and age, phone, status (an **Archived** pill). Without text the list is the clinic's patients by last name. | Guide "Searching": the API decides whether the text is a number, a phone or a name. |
| P6-12 | **Names:** lists and search results show "Last, First Middle Suffix" (sorted by last name); headings and confirmations show "First Middle Last Suffix". One `patientName()` formatter. | Easy to scan a list by family name; natural reading elsewhere. |
| P6-13 | **Possible duplicates never block.** While registering, `GET /patients/possible-duplicates` runs 300 ms after the names, birth date or phone change, with whatever is filled in. Up to five candidates appear in an "Is this the same person?" panel: name, number, birth date, phone, the reason in words ("Same phone number", "Similar name and the same birth date") and an **Archived** pill when archived, each with **Open record** (the unsaved-changes guard asks first). Registering carries on with the normal **Register patient** button. | Guide "Possible duplicates". |
| P6-14 | **Archive asks for a reason** (required, at most 200 characters) in a dialog that names the patient; an archived patient's page shows a banner with the reason and date and offers **Restore** (with `version`). An archived patient can still be edited. `409 CONFLICT` reloads the patient with "This patient was already archived or restored by someone else."; `409 VERSION_CONFLICT` (someone changed it) reloads it with "Someone else changed this patient. Check the record, then try again." | Guide "Archiving": patients are never deleted. |
| P6-15 | **Allergies are shown prominently** on the patient page (a labelled box, "None recorded" when empty); **notes** are labelled "Front desk notes (not medical)". Both are text areas of at most 2,000 characters. | Staff check allergies before anything else; the API marks notes as non-clinical. |
| P6-16 | **Not built here:** medical records (backend 5.4), merging duplicate records, deleting a patient (never), printing a patient slip (no endpoint or template yet), appointments (Phase 7). | Not in the API. |

## 3. Start condition

- Phase 5 is built (lists, `RequirePermission`, `useActiveTenantId`, the clinic time zone, dialogs and forms). Phase 3's remaining items (branch selector, inactivity sign-out, offline banner) are **not** needed.
- `docs/openapi.json` already matches the backend (51 operations), but **`src/api/schema.d.ts` is stale: `npm run api:check` fails** until M0 regenerates it.
- Test data (backend `npm run db:seed:dev`): 8 patients in Sunrise Clinic (accented names, a child with a guardian, a likely duplicate pair with the same phone, one archived) and 2 in Lakeside. `reception@`, `doctor@` and `owner@sunrise.test` all read and manage patients; `multi@doctayo.test` sees a different list in each clinic.

## 4. What changes in existing code (6.0)

| Area | Today | After 6.0 |
| ---- | ----- | --------- |
| `src/api/schema.d.ts` | Generated from the 44-operation contract | Regenerated (`npm run api:generate`): 51 operations, path parameters declared |
| `src/api/errors.ts`, `error-messages.ts` | 28 server codes | Adds `VERSION_CONFLICT`, `TENANT_MISMATCH`, `IDEMPOTENCY_KEY_REUSED`, `IDEMPOTENCY_KEY_IN_USE`, `IDEMPOTENCY_KEY_INVALID` with their messages (the compiler refuses the regenerated types until they are there) |
| `pathParams()` (`src/api/path-params.ts`, five callers) | Works around undeclared path parameters (D-30) | Removed; callers pass `params: { path: { … } }` |
| `src/api/client.ts` | Bearer token, `X-Request-Id`, refresh | Adds `X-Expected-Tenant-Id` (the active clinic, or the clinic a form passes with `requestHeaders({ tenantId })`, P6-4) and an optional `Idempotency-Key` (`requestHeaders({ idempotencyKey })`); `src/api/idempotency.ts` holds the one-key-per-action rule (P6-5) |
| `src/app/query-client.ts` | `FORBIDDEN` → `onForbidden`; `TENANT_NOT_SELECTED` / `TENANT_ACCESS_DENIED` → `onClinicLost` | Also `TENANT_MISMATCH` → `onTenantMismatch` (reload the session). The notice naming both clinics is built with the forms (6.3, 6.4) |
| `src/lib/permissions.ts`, plan.md §5.5 | Seven permission keys | The twenty current keys; the clinical ones noted (medical-record keys are for doctors and nurses only) |
| `src/lib/datetime/` | UTC ↔ clinic time, plain dates | Adds `todayInZone({ timeZone })` and `ageOn({ birthDate, today })` (P6-9) |
| Shell navigation | Home, Staff, Clinic, admin items | Adds **Patients** after Home (`patients.read`). **Moved to 6.1**, with the first patient route |

## 5. Screens

All text in the English catalogue; lists use `DataTable` + `Pagination` + `SearchField`; forms use `FormErrorSummary` + `applyApiErrors`, check every field on each press, and keep what was typed on any failure.

### 6.1 Patient list and search (M1)

`/patients`: `GET /patients?q=&includeArchived=&page=&pageSize=20`.

- **Register a patient** is the primary action (with `patients.manage`; built in 6.3).
- Search and "Show archived" as in P6-11. "{n} patients found" is announced politely.
- States: loading, empty ("No patients yet", with Register a patient), no results ("No patient matches your search", Clear search, and Register a patient), error (message, request id, Try again).
- A name opens `/patients/$patientId` (built in 6.2).

### 6.2 Patient page (M2)

`/patients/$patientId`: `GET /patients/:patientId`.

- Heading: the full name; under it the patient number (large, it is read out and printed), sex, birth date and age.
- Sections, in this order: **Allergies** (first, P6-15), **Contact** (phone, email, address, city, province), **Guardian** (name, phone; shown when filled, or when the patient is under 18 with "No guardian recorded"), **Front desk notes (not medical)**. Empty values say "Not recorded"; empty allergies and notes "None recorded".
- An archived patient has a banner ("Archived on {date}: {reason}", the date in the clinic's zone). With `patients.manage`: **Edit** (primary) and **Archive**; on an archived patient **Restore** (primary) and Edit (built in 6.4 and 6.5).
- `404 NOT_FOUND` (an unknown id or another clinic's patient, the API never says which) → "We could not find this patient." with a link back to Patients.

### 6.3 Register a patient (M3)

`/patients/new`: `POST /patients` with an idempotency key (P6-5).

- Fields: First name and Last name (required, at most 80), Middle name (80), Suffix (20, hint "Jr., Sr., III"), Sex (Female, Male, Not recorded; default Not recorded), Birth date (`DateField`, optional, P6-9), Phone (P6-10), Email (254), Address (200), City and Province (120), Guardian name (160) and Guardian phone, Allergies and Front desk notes (2,000 each).
- Blank optional fields are left out; text is trimmed.
- The duplicate panel of P6-13 beside the form on wide screens, above the button on narrow ones.
- `201` → the new patient's page with a toast "{name} is registered as {patientNumber}."
- `400 VALIDATION_FAILED` → each detail under its field (`REQUIRED`, `TOO_LONG`, `INVALID_FORMAT`, `INVALID_VALUE`, `OUT_OF_RANGE`; `UNKNOWN_FIELD` cannot happen: the request is built from known fields).
- The unsaved-changes guard asks before leaving with typed input.

### 6.4 Edit a patient (M4)

`/patients/$patientId/edit`: the same fields, filled from `GET /patients/:patientId`; `PATCH` with `version` and the changes (P6-6). `200` → the patient page with "Changes saved."; `409 VERSION_CONFLICT` → P6-7; `404` → as 6.2. An archived patient can be edited (the archived banner is repeated on the form).

### 6.5 Archive and restore (M5)

On the patient page: **Archive** opens a dialog "Archive {name}?" with Reason (required, at most 200, hint "For staff only, for example Duplicate record"); `POST …/archive` `{ reason, version }` → the page shows the banner; toast "{name} is archived." **Restore** asks "Restore {name}? They will appear in the patient list and in search again." → `POST …/unarchive` `{ version }`. `409 CONFLICT` and `409 VERSION_CONFLICT` → reload, each with its message of P6-14.

## 6. Code layout

```
src/features/patients/
  api/          patients.ts (usePatients, usePatient, usePossibleDuplicates, useRegisterPatient,
                useUpdatePatient, useArchivePatient, useRestorePatient)
  list/         PatientsPage
  record/       PatientPage, PatientActions, ArchiveDialog, ArchivedBanner, PatientNotFound
  form/         RegisterPatientPage, EditPatientPage, PatientFields and use-patient-form.ts (shared),
                DuplicateCandidates, VersionConflictNotice, patient-form-values.ts (+ spec: values <->
                request, changed fields)
  patient-name.ts, phone-display.ts (+ specs), birth-date.ts
src/routes/_app/_clinic/patients.tsx            the patients.read gate
src/routes/_app/_clinic/patients/  index.tsx, new.tsx, $patientId.tsx, $patientId_.edit.tsx
src/api/client.ts                               + X-Expected-Tenant-Id, requestHeaders() (6.0)
src/api/idempotency.ts                          createIdempotentAction() (6.0)
src/lib/datetime/                               + todayInZone, ageOn
src/lib/leave-guard.tsx                         "Leave without saving?" (6.3)
src/lib/opened-clinic.tsx                       the clinic a form was opened in, and why a save failed
                                                (in features/patients/form/ until Phase 7.0)
tests/e2e/patients.spec.ts, patient-registration.spec.ts
```

## 7. Backend endpoints

All available (backend 5.1; [clinical-integration.md](../docs/clinical-integration.md)):

| Call | Permission | Used by |
| ---- | ---------- | ------- |
| `GET /patients` | `patients.read` | 6.1 |
| `GET /patients/:patientId` | `patients.read` | 6.2, 6.4 |
| `GET /patients/possible-duplicates` | `patients.read` | 6.3 |
| `POST /patients` (`Idempotency-Key`) | `patients.manage` | 6.3 |
| `PATCH /patients/:patientId` (`version`) | `patients.manage` | 6.4 |
| `POST /patients/:patientId/archive`, `/unarchive` (`version`) | `patients.manage` | 6.5 |
| `GET /tenant` (`timezone`, for the age and the birth-date limit) | `tenant.read` | 6.2–6.4 |

**Not available, so not built:** merging duplicates, deleting, printing, medical records, appointments, the staff directory and practitioners.

## 8. Milestones and their tests (tests first in each)

Every component spec includes axe; every e2e page calls `expectNoAxeViolations`. Specs run in New York time, and the date specs also in the Manila pass.

### M0: Clinical foundations (6.0)

- `npm run api:check` passes after the regeneration; `typecheck` passes with `pathParams()` gone; the existing suite stays green.
- `error-messages.spec.ts`: the five new codes have messages (the existing "every code has a message" check).
- `client.spec.ts`: `X-Expected-Tenant-Id` is the active clinic on a request while one is active, absent with none (never empty), and the clinic passed by the caller when one is passed; `Idempotency-Key` is sent only when given and is the same on a retry after `ACCESS_TOKEN_EXPIRED`.
- `query-client.spec.ts`: `TENANT_MISMATCH` from a query and from a mutation reloads the session once; other codes do not.
- `datetime` specs: `todayInZone` at 23:30 UTC is the next day in Manila and the same day in New York; `ageOn` on, the day before and the day after a birthday, on 29 February, and under 2 years in months.
- A spec for the idempotency retry: `IDEMPOTENCY_KEY_IN_USE` with `Retry-After: 1` resends the same key once, then succeeds; a second `IN_USE` shows the waiting message.

### M1: Patient list and search (6.1)

- `routes.spec.tsx`: a person with `patients.read` sees **Patients**; one without it gets "no access" without a request. (`/patients/new` without `patients.manage` is tested in M3.)
- `PatientsPage.spec.tsx` (MSW): the first request has no `q`; the search text reaches `q` (trimmed, cut at 100) but never `location.href`; "Show archived" sets `includeArchived=true` in the address and the request; Archived pill; names "Last, First"; birth date with age in the clinic's zone; phones grouped; pagination; loading, empty, no-results and error states; the key starts with the clinic id and a clinic switch never shows the previous clinic's patients.

### M2: Patient page (6.2)

- `PatientPage.spec.tsx`: every section and the "Not recorded" / "None recorded" / "No guardian recorded" texts (a 10-year-old without a guardian); the patient number and copying it; the archived banner; `404` → "We could not find this patient"; the tab title is "Patient record", never the name. (Edit and Archive being shown only with `patients.manage` is tested in M4 and M5.)

### M3: Register a patient (6.3)

- `patient-form-values.spec.ts`: form values → request (trimmed, blank optional fields left out, sex default). (The changed fields with `null` for emptied ones are tested in M4, which builds them.)
- `routes.spec.tsx`: **Register a patient** on the list (also in its empty and no-results states) and `/patients/new` need `patients.manage`.
- `RegisterPatientPage.spec.tsx`: `IDEMPOTENCY_KEY_REUSED` keeps the input, shows the "may already have been registered" message, asks for duplicates again, sends nothing more on its own, and only **Register as a new patient** sends with a new key; required names; lengths at the limits and one over; birth dates 1899-12-31, 1900-01-01, today and tomorrow (in the clinic's zone, runner in New York); the request body; the same idempotency key on a second press after a network error, a new one after a success; `IN_USE` retry; the API's field errors under their fields with input kept; `phone: INVALID_FORMAT` shows the landline hint; `201` → the patient page with the toast.
- `DuplicateCandidates.spec.tsx`: no request until a name pair with a birth date, or a phone, is filled; one request per pause (300 ms); `+` sent as `%2B`; both reasons in words; an archived candidate; Open record asks before leaving with typed input; `[]` shows nothing; a failure shows nothing and never blocks registering.

### M4: Edit a patient (6.4)

- `EditPatientPage.spec.tsx`: the form is filled from the record; only the changed fields and `version` are sent; emptied fields are `null`; an emptied name is refused; nothing changed → no request; `VERSION_CONFLICT` → the patient is read again, the notice lists the fields someone else changed (before → now), the values the person changed stay, a field both changed is marked, **a field only the other person changed shows the new value and is not in the next request**, and that request sends the new `version`; `TENANT_MISMATCH` keeps the input and shows the notice of P6-4 with both clinic names.

### M5: Archive and restore (6.5)

- `ArchiveDialog.spec.tsx` / `PatientPage.spec.tsx`: the reason is required and at most 200 characters; the dialog names the patient and focuses Cancel; the body is `{ reason, version }`; restore sends `{ version }`; `CONFLICT` and `VERSION_CONFLICT` reload, each with its message.

### M6: End-to-end (real API, after M0–M5)

`tests/e2e/patients.spec.ts` (reading: items 1, 2, 7) and `tests/e2e/patient-registration.spec.ts` (changing: items 3 to 6 and 8), Chromium, serial. The front desk (`reception@sunrise.test`) signs in once in each. Every patient registered is named "E2eregister…" and archived at the end (patients cannot be deleted).

1. **Patients** in the navigation; the list is by last name; the seeded archived patient is hidden and shown with "Show archived".
2. Search: a typo without accents ("dela crus"), a patient number in a short form (`p-1…`), a phone in a local format; the text is never in the address.
3. Register: typing the seeded duplicate pair's phone shows "Same phone number" candidates; registering goes on; **two quick presses register one patient** (searching its name finds exactly one); its page shows the new number.
4. Validation: a landline without `+` → the phone hint; a birth year 1899 refused before sending.
5. Edit the phone; a reload keeps it. **Two pages edit the same patient**; the second save shows "Someone else saved changes…" with the changed field, and saves on the next press.
6. Archive with a reason: hidden from the list and search, shown with "Show archived", banner on the page; restore.
7. **Cross-clinic:** Lakeside's owner opens a Sunrise patient's address → "We could not find this patient."; the two clinics' lists share no patient.
8. **Wrong clinic:** two pages of `multi@`: page A opens the registration form in Sunrise and fills it; page B switches to Lakeside; page A's press shows the P6-4 notice, and no "E2E" patient exists in either clinic afterwards.
9. axe on the list, the patient page, the registration and the edit form at 1280 px and 360 px; no sideways scrolling.

## 9. Acceptance criteria

- Every milestone's specs pass (New York and Manila runs), plus lint, format check, typecheck, `api:check`, `tokens:check`, `i18n:extract` with no missing message, `build`. Each new route chunk stays under 100 kB gzip.
- The M6 e2e passes against the real API on Chromium (Firefox and WebKit in Docker).
- No patient name, search text or other patient field appears in an address, a tab title, browser storage, a log or an error report (checked by the specs of P6-2 and P6-3 and by review).
- `plan.md` (§0, §3, §5.2, §5.4, §5.5, §10, §12), this plan's "As Built" and `AGENTS.md` (the header and idempotency patterns) match the code.

## 10. Accessibility and UX notes

- One primary action per screen: Register a patient on the list; Edit on the patient page (Restore when archived); Register patient / Save on the forms.
- The patient number is large and copyable; the name never wraps mid-word in the heading.
- The duplicate panel is announced politely when candidates appear and never takes focus.
- Forms work at 200% zoom and at 320 px; a table may scroll in its own box only.
- `DateField` keeps typing as the main way to enter a birth date (seniors at the desk read dates aloud).

## 11. Open questions

- **Q25: Patient names in the tab title.** Never, for privacy on shared computers (P6-3)? Default: never.
- **Q26: Who may archive?** Every default role holds `patients.manage`, so a receptionist can archive. Keep it, or ask the backend for a separate permission? Default: keep (the reason is recorded).
- **Q27: A printed patient slip** (patient number and name) at registration: wanted? It needs a template, not an endpoint. Default: not in this phase.

## As Built

### 6.0 Clinical foundations (2026-11-25)

Built as planned (§4, the tests of M0), with these differences, which the plan body above already describes or which are recorded here:

- **Moved to 6.1:** the **Patients** navigation item (there is no patient route yet) and the patient-data cache rule P6-8 (`gcTime: 0` belongs to the patient queries, which do not exist yet).
- **Moved to 6.3 / 6.4:** the P6-4 notice that names both clinics. 6.0 reloads the session on `TENANT_MISMATCH`; meanwhile the failing screen shows the catalogue message ("This page was opened for another clinic. Nothing was saved. Check which clinic you are in and try again.").
- **Headers:** `getApiClient()` sends the signed-in session's `activeTenantId` on every request that goes through the typed client (not on the token refresh, which uses its own fetch). A request that already carries the header keeps it, and a retry after `ACCESS_TOKEN_EXPIRED` keeps the original clinic and key even if another tab switched clinics meanwhile.
- **Idempotency:** `createIdempotentAction()` returns a `run(send)` function. The key is kept after any failure and replaced only after a success; `IDEMPOTENCY_KEY_IN_USE` waits `Retry-After` (2 s without one) and resends once. Nothing uses it until 6.3.
- **Age:** `ageOn()` is in `plain-date.ts` (it involves no time zone) and returns `{ unit: 'months' | 'years', value }`; `todayInZone()` is in `datetime/index.ts`.
- **Decided for 6.3 (2026-11-25):** the stuck-form case (a lost answer, then an edited form, `IDEMPOTENCY_KEY_REUSED`) is now covered by P6-5 and a M3 test. `createIdempotentAction` will need a way to start a new key on request; 6.3 adds it.
- **Not covered:** the forms built in Phases 4 and 5 (invite, member edit, clinic profile, branches) send the clinic that is **active when they submit**, not the one they were opened in (P6-4 applies the opened clinic from the patient forms on). Whether a clinic switch in another tab can reach one of those forms while it stays open was not tested.

Verified (2026-11-25): `api:check` passes again; 97 Vitest files, 1368 specs pass (New York) and the Manila date pass (79); lint, format check, typecheck, `tokens:check` and `build` pass. Against the real API: the CORS preflight allows `X-Expected-Tenant-Id` and `Idempotency-Key`, the right clinic id answers `200`, a wrong one `409 TENANT_MISMATCH`; the Chromium e2e specs pass with the new header, each on a fresh API instance: `staff` (16), `account-email` (4), `clinic-settings` (9), `platform-admin` (12), `smoke` (4). Startup JavaScript 206.2 kB gzip (206.1 before; budget 170 kB, already exceeded).

Not verified: two real tabs switching clinics in a browser (M6 step 8), Firefox and WebKit (need Docker).

### 6.1 Patient list and search (2026-11-25)

Built as planned (P6-1's list route and navigation item, P6-2, P6-8, P6-11, the list texts of §5, the tests of M1), with these differences, which the plan body above already describes or which are recorded here:

- **Left for later sub-phases:** the **Register a patient** button (and its place in the empty and no-results states) arrives with 6.3, and names become links with 6.2: neither page exists yet.
- **The Status column appears only with "Show archived"**, and then says Archived or Active on every row; without it every row would be active.
- **The search field is labelled "Search by name, patient number or phone"**; the number of results is announced politely.
- **Files:** `features/patients/` (`api/patients.ts` with `usePatients`, `list/PatientsPage.tsx`, `patient-name.ts` with `patientListName`, `phone-display.ts`; the "natural" name order of P6-12 is added with the patient page), routes `_clinic/patients.tsx` (the `patients.read` gate) and `_clinic/patients/index.tsx`. There is no separate status pill component: the list uses `StatusPill` directly.
- **The clinic time zone** for the age comes from `features/staff/api/clinic-time-zone.ts` (its third screen). Until it is known, the birth date shows without an age.
- **Test helper:** `renderWithProviders` accepts a `queryClient`, so a spec can check that no patient stays cached after the screen closes.
- **An unknown address parameter** (a typed `?q=`) stays in the address bar but is ignored; the app never writes search text there.

Verified (2026-11-25): 100 Vitest files, 1395 specs pass (New York) and the Manila pass (101, including the patient specs); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass; `tests/e2e/patients.spec.ts` (5 specs, Chromium, real API with the seeded patients) passes: list by family name without the archived patient, "Show archived", search by typo, by name without accents, by short patient number and by local phone with nothing in the address, no results, 360 px without sideways scrolling, axe, and the other clinic's owner seeing none of Sunrise's patients. The other Chromium e2e specs still pass (45), each on a fresh API instance. The route chunks are small (2.1 kB gzip for the list). Startup JavaScript 208.1 kB gzip (206.2 before; budget 170 kB, already exceeded).

Not verified: a list longer than one page against the real API (mocked specs cover paging), the live search timing against a large clinic, Firefox and WebKit (need Docker), manual screen-reader and 200% zoom checks.

### 6.2 Patient page (2026-11-25)

Built as planned (the route, the sections, the age, P6-3, P6-9, P6-10, P6-12, P6-15 and the tests of M2), with these differences, which the plan body above already describes or which are recorded here:

- **No Edit, Archive or Restore buttons yet** (6.4 and 6.5): the archived banner is shown, without Restore.
- **Allergies is the first section**, above Contact.
- **A broken link** (`400 VALIDATION_FAILED` for an id that is not a UUID) shows the same "We could not find this patient" as `404`.
- **Copy number** copies the patient number and says "Copied"; where the browser offers no clipboard, nothing happens and the number stays on screen.
- **The guardian rule needs the clinic's zone:** "under 18" is judged on today's date there, so the empty Guardian section appears once the zone is known. Someone with no birth date and no guardian has no Guardian section.
- **Files:** `record/PatientPage.tsx`, `birth-date.ts` (`birthDateWithAge`, now shared with the list), `patientFullName` in `patient-name.ts`, `usePatient` in `api/patients.ts`, the route `_clinic/patients/$patientId.tsx` (keyed by id, so nothing carries over between records). List names are now links.
- **For 6.3 and 6.4:** `/patients/new` does not exist yet, so typing it shows "We could not find this patient". 6.3 adds the static route (it wins over `$patientId`). The edit route must not nest under `$patientId.tsx`, which renders no outlet: use `$patientId_.edit.tsx`.

Verified (2026-11-25): 101 Vitest files, 1423 specs pass (New York) and the Manila pass (127); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass; `tests/e2e/patients.spec.ts` now has 9 specs (Chromium, real API): the page from the list with its number, sections and tab title, copying the number, a child's guardian, an archived patient's banner, an unknown and a broken address, 360 px, and the other clinic opening a Sunrise patient's address getting "We could not find this patient". The other Chromium e2e specs still pass (45), each on a fresh API instance. The patient route chunk is 1.9 kB gzip; startup JavaScript 209.4 kB (208.1 before; budget 170 kB, already exceeded).

Not verified: Firefox and WebKit (need Docker), manual screen-reader and 200% zoom checks, very long names or notes in a real browser.

### 6.3 Register a patient (2026-11-25)

Built as planned (P6-1's `/patients/new`, P6-4, P6-5, P6-9, P6-10, P6-13, the form of §5 and the tests of M3), with these differences, which the plan body above already describes or which are recorded here:

- **Files:** `form/RegisterPatientPage.tsx`, `form/DuplicateCandidates.tsx`, `form/patient-form-values.ts`, `usePossibleDuplicates` and `useRegisterPatient` in `api/patients.ts`, the route `_clinic/patients/new.tsx` (behind `patients.manage`), and the **Register a patient** link on the list, in its heading row and its empty and no-results states. The form's fields are in the page itself; 6.4 will move them to a shared `PatientForm`.
- **Moved to 6.4:** the "changed fields" half of `patient-form-values` (nothing uses it yet).
- **A half-typed or impossible birth date is refused** ("Complete the birth date with a real date, or leave it empty."): `DateField` reports no value for it, so it would have been dropped silently. `DateField` gained `onIncompleteChange` for this. The field also shows its own before/after message while typing.
- **Leaving with typed input** asks "Leave without saving?" through a new `LeaveGuard` (`src/lib/leave-guard.tsx`, the router's blocker plus the browser's own question on closing the tab). It never holds a person whose session ended, or a form that has just saved. The earlier forms (Phases 4 and 5) do not use it yet.
- **"Register as a new patient"** starts a new key by making a new `createIdempotentAction()`; the helper needed no change. While that notice shows, it replaces **Register patient**, and Enter does not submit.
- **The registration mutation keeps no variables** after the form closes (`gcTime: 0`), as the queries do not (P6-8).
- **Contract defect (D-33):** the contract declares the duplicate check's `birthDate` query parameter as an object, not text, so one cast is needed in `usePossibleDuplicates`.
- **A defect found by the real-browser run and fixed, in the app shell (Phase 2):** `AppShell` built a different tree for desktop, tablet and phone widths, so crossing a width (turning a tablet, resizing a window) **rebuilt the page and erased everything typed into any form**. It now keeps one tree and changes only the navigation around the page (`app-shell.spec.tsx`, "changing the screen width keeps the page").

Verified (2026-11-25): 105 Vitest files, 1487 specs pass (New York) and the Manila pass (178); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass. `tests/e2e/patient-registration.spec.ts` (5 specs, Chromium, real API): required and out-of-range input and a landline without "+" refused with nothing created; the duplicate panel for the seeded phone and the leave question; the 360 px layout keeping what was typed, with the matches above the button; two quick presses registering one patient; and two tabs of one browser, one switching clinic while the other's form is open: the form keeps its input, says "This page was opened for Sunrise Clinic. You are now working in Lakeside Family Clinic. Nothing was saved.", and no patient of that name exists in either clinic. All other Chromium e2e specs pass (54), each on a fresh API instance. The registration route's chunks are at most 5.4 kB gzip; startup JavaScript 211.8 kB (209.4 before; budget 170 kB, already exceeded).

Not verified: a lost answer followed by an edit (`IDEMPOTENCY_KEY_REUSED`) and `IDEMPOTENCY_KEY_IN_USE` against the real API (mocked specs only), the browser's own question when closing the tab, Firefox and WebKit (need Docker), manual screen-reader and 200% zoom checks. Each e2e run leaves an archived `E2eregister…` patient in Sunrise.

### 6.4 Edit a patient (2026-11-25)

Built as planned (P6-1's edit route, P6-4, P6-6, P6-7, the screen of §5 and the tests of M4), with these differences, which the plan body above already describes or which are recorded here:

- **Files:** `form/EditPatientPage.tsx`; the registration form's fields and checks moved into `form/PatientFields.tsx` and `form/use-patient-form.ts`, which both pages use; `form/opened-clinic.tsx` (`useOpenedClinic`, `SaveFailure`); `form/VersionConflictNotice.tsx`; `record/ArchivedBanner.tsx` and `record/PatientNotFound.tsx` (shared with the patient page); `fetchPatient` and `useUpdatePatient` in `api/patients.ts`; the route `_clinic/patients/$patientId_.edit.tsx` (behind `patients.manage`); an **Edit** link on the patient page for people who may manage patients.
- **The form stays on the record it was opened with.** Later reads of the same patient do not change it, and a clinic switched in another tab (which empties the cache) does not remove it or what was typed: saving then shows the two-clinic notice.
- **A saved birth date is not judged again** when it was not changed (the API accepts tomorrow's date, which the form refuses for new input).
- **The conflict notice** lists each field the other person changed as "label: before → now", adds "You also changed this: your value is kept. Check it." where both did, takes focus, and has its own text when no form field changed (for example the record was archived meanwhile; the banner then appears). If the new record cannot be read, the error is shown and the form is left as it was. The birth date boxes are filled afresh after a conflict, so a date the other person removed does not linger on screen.
- **"Nothing to change."** is shown, and nothing is sent, when nothing differs (spaces alone are not a change).
- **A patient gone by the time of saving** (`404`) shows "We could not find this patient".

Verified (2026-11-25): 106 Vitest files, 1516 specs pass (New York) and the Manila pass (204); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass. `tests/e2e/patient-registration.spec.ts` (now 8 specs, Chromium, real API) also covers editing: nothing to change; a changed phone saved and kept after a reload; two tabs editing the same patient (the second gets the notice, keeps its phone and email, takes the other's city, and saves all three on the next press); the 360 px edit form and the leave question. All other Chromium e2e specs pass (54) and the design-system and CSP specs (47). The edit route chunk is 2.2 kB gzip; startup JavaScript 213.4 kB (211.8 before; budget 170 kB, already exceeded).

Not verified: a clinic switch while the **edit** form is open in a real browser (unit specs, and the registration e2e covers the same mechanism), editing an archived patient against the real API (6.5), Firefox and WebKit (need Docker), manual screen-reader and 200% zoom checks.

### 6.5 Archive and restore (2026-11-25)

Built as planned (P6-14, the actions of §5 and the tests of M5), with these differences, which the plan body above already describes or which are recorded here:

- **Files:** `record/PatientActions.tsx` (Edit, Archive or Restore, their dialogs and messages), `record/ArchiveDialog.tsx`, `useArchivePatient` and `useRestorePatient` in `api/patients.ts`.
- **Two messages, not one.** The plan gave a stale version the "already archived or restored" words; a plain edit also makes the version stale, so `VERSION_CONFLICT` has its own: "Someone else changed this patient. Check the record, then try again." The real API checks the archive state before the version, so archiving an already archived patient answers `CONFLICT` even with an old version.
- **Whatever the answer**, the patient and the lists are read again, so the page shows what is true.
- **The archive dialog** says what archiving does, starts on **Cancel** (focused with a ref: the lint rules refuse `autoFocus`), and asks before closing with a typed reason (Escape or Close; the Cancel button closes at once, as in the invite dialog). Restore uses the normal confirmation.
- **A clinic switched elsewhere** while the dialog is open: the page changes to the other clinic's answer for this patient, so the dialog goes with it and nothing is saved. A request already sent names the clinic the page was opened in and is refused (`TENANT_MISMATCH`, spec).

### Phase 6 end-to-end (M6) and acceptance (2026-11-25)

All nine M6 items run against the real API on Chromium: `patients.spec.ts` (9 specs) and `patient-registration.spec.ts` (10 specs). Item 7 uses Lakeside's owner rather than `multi@`.

Verified: 107 Vitest files, 1538 specs pass (New York) and the Manila pass (226); lint, format check, typecheck, `api:check`, `tokens:check`, `i18n:extract` (no missing message) and `build` pass; the other Chromium e2e specs (45) and the design-system and CSP specs (47) pass. Each patient route chunk is under 4 kB gzip. Nothing in `features/patients` writes to browser storage or the console, and every patient page has a title without the name (checked by search and by the specs). Startup JavaScript is 214.4 kB gzip (213.4 before 6.5; 206.1 before Phase 6; budget 170 kB, already exceeded: **the budget decision is still open**).

Not done or not verified: Firefox and WebKit (need Docker), manual screen-reader, 200% zoom and keyboard-only checks, `IDEMPOTENCY_KEY_REUSED` / `_IN_USE` against the real API (mocked specs only), a patient list longer than one page against the real API. Q25 to Q27 (§11) stand at their defaults.
