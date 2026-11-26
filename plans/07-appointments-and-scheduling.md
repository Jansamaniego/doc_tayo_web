# Phase 7: Appointments and scheduling (part 1: practitioners, weekly schedules and the staff directory)

Status: **7.0 to 7.4 built** (2026-11-25 and 2026-11-26, see "As Built"); appointments (7.5 onward) are not planned yet (written 2026-11-25). The services catalog became **Phase 8** (plans/08-services-catalog.md, 2026-11-27). Backend: **partly available**. Backend Phase 5, sub-phase **5.2 "Practitioners and directory"** shipped: the staff directory, practitioner profiles, weekly schedules, a day's working hours, and `GET /me` → `practitionerProfileId` ([docs/clinical-integration.md](../docs/clinical-integration.md) §5.2, `docs/openapi.json`, 57 operations, identical to the backend's copy on 2026-11-25). **Not available yet:** appointments (backend 5.3). This plan covers sub-phases 7.0–7.4; appointments are added to it as 7.5 onward when the backend ships them (as Phase 5 gained 5.6). The services catalog (the rest of backend 5.2) shipped on 2026-11-27 and is planned as its own Phase 8 (plans/08-services-catalog.md), not here. Depends on Phase 5 (staff, branches, the clinic time zone) and Phase 6 (the opened-clinic rule P6-4, `LeaveGuard`, the form patterns).

**Numbering.** "Phase 7" and "7.x" are the frontend's; "5.2" and "5.3" are the **backend's** sub-phases.

| Sub-phase | Milestone | Who uses it | What it adds |
| --------- | --------- | ----------- | ------------ |
| 7.0 Foundations | M0 | everyone | Regenerated types; `practitionerProfileId` in the session (also after a clinic switch); wall-clock time and weekday helpers; the directory query |
| 7.1 Practitioners list | M1 | every clinic role (`directory.read`) | **Practitioners** navigation item, the clinic's practitioners with specialization and branch filter |
| 7.2 Practitioner page and "My schedule" | M2 | every clinic role | Profile, weekly schedule, a day's working hours at a branch; **My schedule** for a practitioner |
| 7.3 Add and edit a practitioner | M3 | owner, clinic admin (`practitioners.manage`) | Make a member a practitioner, edit the profile, deactivate and reactivate |
| 7.4 Weekly schedule editor | M4 | owner, clinic admin | Edit the whole week of hours across branches |

End-to-end runs for all of them are milestone M5.

## 1. Objectives

- Everyone at the clinic can see who the practitioners are, where and when they work, and a given day's hours, from one place.
- An owner or clinic admin can set up a practitioner (profile and weekly hours) without help, and cannot save a week the API would refuse.
- A practitioner finds their own schedule in one step.
- Nothing here suggests the hours are free appointment slots: appointments are not counted until backend 5.3.

## 2. Decisions

| #     | Decision | Why |
| ----- | -------- | --- |
| P7-1  | **The screens say "Practitioners"**, the API's own word (decided 2026-11-25, Q28): a clinic may set up dentists, therapists or midwives, not only doctors. One navigation item, **Practitioners**, after Patients. The word is kept in the message catalogue only, so a later change is one edit per message. | Covers every profession a clinic books; matches the API, so screens, code and guide use one word. |
| P7-2  | **Routes:** `/practitioners` (list) and `/practitioners/$profileId` (practitioner page) under `RequirePermission('directory.read')`; `/practitioners/new`, `/practitioners/$profileId_/edit` and `/practitioners/$profileId_/schedule` also under `practitioners.manage`. Without the permission, the controls are hidden (the guide) and a typed address shows "no access". | Same guard pattern as Phases 5 and 6; full pages for the two forms (tablets). |
| P7-3  | **The directory is read whole.** It has no search parameter, so a screen asks for pages of 100 until it has every entry (one request for any clinic under 100 staff) and filters in the browser. Keys `[tenantId, 'directory', filters]`. The directory carries no e-mail address and the screens never show one. | Clinics are small; a picker must find anyone; the API keeps addresses to `GET /members`. |
| P7-4  | **Inactive practitioners** are shown only to people with `practitioners.manage` (marked **Inactive**, so they can be reactivated). Everyone else sees active practitioners only. | The API marks `isActive` "offer only active practitioners for booking"; reception has no use for inactive ones. |
| P7-5  | **`practitionerProfileId` is part of the session.** It comes with `GET /me` at start, sign-in and every session reload. **After a clinic switch the session reads `GET /me` again**, because the switch answer does not carry it. When it is set, the navigation shows **My schedule** (to the practitioner's own page). This is decided by identity, not by a permission: a documented exception like P5-3. | The guide: "read it again after switching clinics"; otherwise "My schedule" would open the previous clinic's practitioner. |
| P7-6  | **Schedule times are wall-clock times of the branch** (`HH:mm`, no date, no zone) and are never converted. They are shown on a 12-hour clock ("9:00 AM", and `24:00` as "midnight"). Each block names its branch; when a branch's time zone differs from the clinic's, the zone is shown next to it. New helpers in `src/lib/datetime/`: `formatWallTime()` and the weekday names (1 = Monday … 7 = Sunday). | The API's rule; plan.md §5.6 formats. |
| P7-7  | **The schedule editor replaces the whole week.** It shows the seven weekdays, each with its blocks (branch, start, end, and **Until midnight** for `24:00`), **Add hours** and **Remove**. Before sending it checks what the API checks: every part filled, start before end, no overlap between blocks of the same weekday **even at different branches** (back-to-back is fine), at most 50 blocks. The API's `blocks[1].startsAt`-style field names are mapped onto the right row. A week with no hours is allowed and asks first ("{name} will have no working hours"). The API has no version: **the last save wins**, so the editor always opens on a fresh read and shows the saved week after saving. **Copy to other days** (decided 2026-11-25, Q30): see P7-13. | Guide "Weekly schedule". |
| P7-8  | **A day's hours are called "Working hours", never free slots,** with the line "Booked appointments are not counted yet." until appointments exist. The day is picked with `DatePicker` and starts on **today in the branch's zone** (the branch's own zone, or the clinic's); the intervals are shown in the answer's `timeZone`. A deactivated practitioner or a suspended member has no hours, which the page says in words. | Guide "Availability": informational, booking outside them is allowed. |
| P7-9  | **Profile edits send only what changed**; an emptied optional field is `null`; the display name cannot be emptied; no change means no request. There is no `version`: the last save wins. **Deactivate** asks first ("{name} will no longer be offered when booking. Nothing is deleted."); **Reactivate** needs no confirmation. | Guide "Profiles"; the Phase 5 and 6 rules (P5-15, P6-6). |
| P7-10 | **Forms send the clinic they were opened in** (P6-4). `useOpenedClinic` and `SaveFailure` move from `features/patients/form/opened-clinic.tsx` to `src/lib/opened-clinic.tsx` (their second user). | One rule for every form that saves clinic data. |
| P7-11 | **Making a member a practitioner** picks from the directory's active members who have no profile (a searchable list), and pre-fills the display name with their name. A hint says that giving someone the Doctor role does not make them a practitioner here. | Guide "Profiles": a role does not make a profile. |
| P7-12 | **Not built here:** appointments (later in this phase, when the backend ships them), the services catalog (Phase 8), the practitioner picker for booking (built with booking, its first user), assigning staff to branches (D-9, still open), deleting a profile (never). | Not in the API yet, or no screen uses it yet. |
| P7-13 | **Copy to other days.** Each weekday that has hours offers **Copy to other days**. A dialog lists the other six days as checkboxes, each marked "Has hours" when it has some. If a ticked day already has hours, the dialog says so before anything is applied ("Tuesday and Thursday already have hours. They will be replaced."). **Copy hours** replaces each ticked day's blocks with a copy of the source day's blocks: branch, start, end and Until midnight. Unticked days are not touched. Each copy is independent: editing a copied block later never changes the source or another copy. Copying **only changes the form**: nothing is sent until **Save**, which sends the whole week through `PUT /practitioners/:profileId/schedule` as before, and the result is checked by the same rules (P7-7; for example, a week over 50 blocks is refused on Save). Not included: templates, a "Same as Monday" link that stays in sync, copying between practitioners. | Most practitioners work the same hours on several days; no API change is needed. |

## 3. Start condition

- Phases 5 and 6 are built. Phase 3's remaining items are not needed.
- `docs/openapi.json` matches the backend (57 operations) and `src/api/schema.d.ts` was regenerated in 7.0. D-33 (the duplicate check's `birthDate` typed as an object) is **still open** in this contract.
- Test data (backend `npm run db:seed:dev`): `doctor@sunrise.test` is a practitioner in Sunrise (Monday to Friday 09:00–12:00 and 13:00–17:00 at Main, Saturday morning at Quezon City Annex); `multi@doctayo.test` is one in Lakeside (Monday, Wednesday, Friday). The Sunrise owner and clinic admin have no profile. **On the developer's database the seed had not been run since backend 5.2 (2026-11-25: 17 active staff, none with a profile), so it must be run before 7.1 is checked.**

## 4. What changes in existing code (7.0)

| Area | Today | After 7.0 |
| ---- | ----- | --------- |
| `src/api/schema.d.ts` | 51 operations | Regenerated: 57 (`/directory`, `/practitioners*`, `practitionerProfileId` on `GET /me`) |
| Session (`src/api/session/`) | `user`, memberships, active clinic, permissions, platform role | Adds `practitionerProfileId`; `switchClinic` reads `GET /me` again after the switch (P7-5) |
| `src/lib/datetime/` | Plain dates, UTC ↔ clinic time, age | Adds `formatWallTime()` (`HH:mm` → "9:00 AM", `24:00` → "midnight") and weekday names |
| `opened-clinic.tsx` | In `features/patients/form/` | Moves to `src/lib/` (P7-10) |
| Shell navigation | Home, Patients, Staff, Clinic, admin items | Adds **Practitioners** (`directory.read`, 7.1) and **My schedule** (when the session has a profile, 7.2) |
| `src/lib/permissions.ts` | Comment lists twenty keys | Notes that `directory.read` and `practitioners.manage` are now required by routes (5.2) |

## 5. Screens

All text in the English catalogue; lists use `DataTable`; forms use `FormErrorSummary` + `applyApiErrors`, check every field on each press, keep what was typed on any failure, and render `LeaveGuard`.

### 7.1 Practitioners list (M1)

`/practitioners`: the directory (P7-3), entries with a `practitioner`.

- Columns: display name, specialization, the person (full name and job title), status (Active / Inactive, only for `practitioners.manage`, P7-4).
- Filter: **Branch** ("All branches" or one active branch: `branchId` = practitioners with hours there). In the address with the page; nothing typed is.
- **Add a practitioner** (primary, with `practitioners.manage`, 7.3). A name opens the practitioner page (7.2).
- States: loading, "No practitioners yet" (with Add a practitioner for managers), "No practitioner works at this branch", error with request id and Try again.

### 7.2 Practitioner page and "My schedule" (M2)

`/practitioners/$profileId`: `GET /practitioners/:profileId` and the directory entry for the person's name.

- Heading: display name; under it the specialization, PRC license number, PTR number ("Not recorded" when empty), the person's name and job title, and an **Inactive** banner for a deactivated profile.
- **Weekly schedule**: Monday to Sunday, each day's blocks as "9:00 AM – 12:00 PM, Main"; "No hours" for an empty day; "No weekly hours yet" for an empty week.
- **Working hours on a day** (P7-8): branch (the branches in the schedule, else all active branches) and date; the intervals in the branch's zone; "No working hours on this day".
- With `practitioners.manage`: **Edit profile** and **Deactivate** or **Reactivate** (7.3), **Edit weekly schedule** (7.4, at the foot of the Weekly schedule section).
- `404` (unknown, or another clinic's profile) → "We could not find this practitioner".
- **My schedule** in the navigation opens the signed-in practitioner's own page (P7-5).

### 7.3 Add and edit a practitioner (M3)

- `/practitioners/new`: **Person** (a searchable list of active members without a profile, P7-11), **Display name** (required, at most 160, pre-filled, hint "How it is printed, for example Dra. Ana Cruz, MD"), **Specialization** (120), **PRC license number** (40), **PTR number** (40). `POST /practitioners` → `201` → the practitioner page, toast "{name} is now a practitioner at {clinic}." When every active member has a profile, the page says "Everyone on your staff is already a practitioner." `409 CONFLICT_UNIQUE` → on Person: "This person is already a practitioner here." with a link to their page; `409 CONFLICT` → "This person is no longer an active member." and the list is read again; `404` → the same as `CONFLICT`.
- `/practitioners/$profileId_/edit`: the same fields except Person; P7-9. `404` → "We could not find this practitioner".
- Deactivate and Reactivate on the practitioner page: `PATCH { isActive }` (P7-9).
- A successful create, deactivate or reactivate reads the session again (`GET /me`), so **My schedule** follows when it was the person's own profile.
- All three forms and actions send the clinic they were opened in (P7-10), and what is on a form survives a clinic switch in another tab.

### 7.4 Weekly schedule editor (M4)

`/practitioners/$profileId_/schedule`: P7-7 and P7-13. Branch choices are the active branches (all branches are read, so that a saved block at a deactivated one can be named, marked "(no longer active)", and refused on Save); a clinic with one active branch has it chosen already, and one with none says "Add an active branch before adding hours." The profile is always read again when the editor opens, and what it shows survives a clinic switch in another tab. A week that has not changed sends nothing ("Nothing to change."). `PUT /practitioners/:profileId/schedule` → `200` → the practitioner page, toast "Weekly schedule saved." Errors: `VALIDATION_FAILED` on the rows (an inactive branch at `blocks[i].branchId`: "This branch is no longer active"); a `404` is the profile or a branch, so the profile is read again: found → "A branch in this schedule no longer exists" and the branches are read again; not found → "We could not find this practitioner"; another failure of that read is shown as it is.

## 6. Code layout

```
src/features/practitioners/
  api/          directory.ts (useDirectory: every page, P7-3), practitioners.ts (usePractitioner,
                useFreshPractitioner, useAvailability, useCreatePractitioner, useUpdatePractitioner,
                useReplaceSchedule)
  list/         PractitionersPage
  record/       PractitionerPage, WeeklySchedule, WorkingHours, PractitionerActions, PractitionerNotFound
  form/         NewPractitionerPage (with the person picker), EditPractitionerPage, PractitionerFields,
                use-practitioner-form.ts, practitioner-form-values.ts
  schedule/     ScheduleEditorPage, DayHours, CopyHoursDialog, schedule-rules.ts (+ spec: overlaps, order, limits,
                copying, API field names onto rows)
src/routes/_app/_clinic/practitioners.tsx              the directory.read gate
src/routes/_app/_clinic/practitioners/  index.tsx, new.tsx, $profileId.tsx, $profileId_.edit.tsx,
                                  $profileId_.schedule.tsx
src/lib/opened-clinic.tsx                        moved from features/patients (P7-10)
src/lib/datetime/                                + formatWallTime, weekday names
tests/e2e/practitioners.spec.ts                  reads the seeded practitioners; the refusals
tests/e2e/practitioner-management.spec.ts        changes, in a clinic the spec creates
```

## 7. Backend endpoints

All available (backend 5.2):

| Call | Permission | Used by |
| ---- | ---------- | ------- |
| `GET /directory?practitionersOnly=&branchId=&page=&pageSize=` | `directory.read` | 7.1, 7.2, 7.3 |
| `GET /practitioners/:profileId` | `directory.read` | 7.2, 7.3, 7.4 |
| `GET /practitioners/:profileId/availability?branchId=&date=` | `directory.read` | 7.2 |
| `POST /practitioners` | `practitioners.manage` | 7.3 |
| `PATCH /practitioners/:profileId` | `practitioners.manage` | 7.3 |
| `PUT /practitioners/:profileId/schedule` | `practitioners.manage` | 7.4 |
| `GET /me` (`practitionerProfileId`) | signed in | 7.0, 7.2 |
| `GET /branches`, `GET /tenant` | `branches.read`, `tenant.read` | branch names and zones |

**Not built here:** services (`/services`, Phase 8). **Not available, so not built:** appointments, staff-to-branch assignment (D-9), deleting a profile.

## 8. Milestones and their tests (tests first in each)

Every component spec includes axe; every e2e page calls `expectNoAxeViolations`. Specs run in New York time, and the date and time specs also in the Manila pass.

### M0: Foundations (7.0)

- `api:check` passes after the regeneration; the existing suite stays green.
- Session specs: `practitionerProfileId` is read at start, at sign-in and on reload; **after `switchClinic` the session asks `GET /me` again** and holds the new clinic's value (and `null` when there is none); a failed re-read keeps the switch and leaves the value `null`.
- `datetime` specs: `formatWallTime` for `00:00`, `09:05`, `12:00`, `13:30`, `23:59`, `24:00`, and a refusal of `25:00` / `9:5`; weekday names 1–7.
- `useDirectory` spec: one request under 100 entries; several pages read until the total; an empty clinic; the key starts with the clinic id; the request carries the filters; nothing kept once no screen uses it.

### M1: Practitioners list (7.1)

- `routes.spec.tsx`: a person with `directory.read` sees **Practitioners**; without it, no item and "no access" without a request.
- `PractitionersPage.spec.tsx`: only entries with a practitioner; inactive ones only for `practitioners.manage`, marked; the branch filter in the address and the request; loading, empty (both texts), error; never an e-mail address; a clinic switch never shows the other clinic's practitioners.

### M2: Practitioner page and "My schedule" (7.2)

- `PractitionerPage.spec.tsx`: profile fields and "Not recorded"; the week in order (Monday first), times on a 12-hour clock, `24:00` as midnight, branch names, a branch zone shown only when it differs; empty days and empty week; the Inactive banner; `404`. (Manager actions are tested in M3 and M4, which build them.)
- `WorkingHours.spec.tsx`: the first day asked is today **in the branch's zone** (runner in New York, branch in Manila, around midnight UTC); a branch with its own zone; intervals shown in the answer's zone; the "not counted yet" line; no hours; a failure with its request id.
- `routes.spec.tsx` / shell: **My schedule** appears only with a profile, opens the practitioner's page, and follows a clinic switch.

### M3: Add and edit a practitioner (7.3)

- `PractitionersPage.spec.tsx`: **Add a practitioner** (also in the empty state) only for managers.
- `NewPractitionerPage.spec.tsx`: only active members without a profile are offered; the display name is pre-filled and required, lengths at the limits and one over; the request body; the opened clinic is sent; `CONFLICT_UNIQUE`, `CONFLICT`, `404`, `VALIDATION_FAILED`; leaving with typed input asks.
- `EditPractitionerPage.spec.tsx`: only changed fields, `null` for emptied ones, nothing for no change, the display name cannot be emptied, `404`.
- `PractitionerActions.spec.tsx`: Deactivate asks, names the practitioner, focuses Cancel, sends `{ isActive: false }`; Reactivate sends `{ isActive: true }`; both read the page again.

### M4: Weekly schedule editor (7.4)

- `schedule-rules.spec.ts`: overlaps within a weekday (same branch and different branches), back-to-back allowed, `24:00` end, start not before end, 50 and 51 blocks, blocks sorted by weekday then start, `blocks[3].endsAt` → the right row and field.
- `CopyHoursDialog.spec.tsx` and `ScheduleEditorPage.spec.tsx` (copy, P7-13), written first:
  - **replacing a day that has hours**: the dialog says which ticked days have hours and that they will be replaced, before anything is applied; after **Copy hours** those days hold exactly the source day's blocks (branch, start, end, Until midnight) and none of their own;
  - **unticked days are unchanged**, including days with hours and the source day;
  - **copies are independent**: after copying, changing a copied block's end time (or removing it) leaves the source day and every other copy as they were;
  - **keyboard only**: Tab reaches **Copy to other days** on a day with hours (and it is absent on a day without), Space ticks days in the dialog, Enter on **Copy hours** applies, Escape cancels without changing anything, and focus returns to the button that opened the dialog;
  - copying sends no request; the next **Save** sends the whole week with the copies; a copy that pushes the week past 50 blocks is refused on Save.
- `ScheduleEditorPage.spec.tsx`: opens on the saved week; add and remove hours; Until midnight sends `24:00`; one-branch clinics have the branch chosen; every client rule refused before sending; the whole week sent; an empty week asks first and sends `[]`; the API's row errors land on their rows; an inactive branch; an unknown branch reads the branches again; success → the saved week; leaving with changes asks.

### M5: End-to-end (real API, after M0–M4)

Chromium, serial, in two files: `tests/e2e/practitioners.spec.ts` only reads the seeded practitioners (items 1, 2, 7), and `tests/e2e/practitioner-management.spec.ts` makes every change in an **e2e clinic created through the platform admin** (as in `clinic-settings.spec.ts`), never in Sunrise (items 3 to 6). Profiles cannot be deleted, so each run leaves one e2e clinic with a practitioner.

1. Receptionist in Sunrise: **Practitioners** lists the seeded practitioner; the page shows Monday to Friday and Saturday at the annex; working hours for a weekday at Main; no manager controls; `/practitioners/new` shows "no access"; a direct `POST /practitioners` with their token answers `403`.
2. `doctor@sunrise.test`: **My schedule** opens their own page.
3. The e2e clinic's owner: adds a second branch; makes themselves a practitioner (the display name pre-filled, then changed); the profile shows; adding again is refused ("already a practitioner here").
4. Weekly schedule: an overlap across the two branches is refused before sending; Monday's hours (one with Until midnight) are copied to Tuesday and Thursday by keyboard, Tuesday is then changed by hand, and the saved week shows Monday and Thursday alike and Tuesday changed; a day's working hours follow it.
5. Edit the specialization; deactivate (the practitioner is marked Inactive for the owner); reactivate.
6. Cross-clinic: the e2e practitioner's address opened in Sunrise → "We could not find this practitioner".
7. `multi@doctayo.test`: in Lakeside **My schedule** opens their Lakeside page; after switching to Sunrise it disappears.
8. axe on every practitioner page at 1280 px and 360 px; no sideways scrolling.

## 9. Acceptance criteria

- Every milestone's specs pass (New York and Manila runs), plus lint, format check, typecheck, `api:check`, `tokens:check`, `i18n:extract` with no missing message, `build`. Each new route chunk stays under 100 kB gzip.
- The M5 e2e passes against the real API on Chromium (Firefox and WebKit in Docker).
- No screen presents working hours as free appointment slots; no screen shows a staff e-mail address from the directory.
- `plan.md` (§0, §3, §5.2, §5.5, §10, §12), this plan's "As Built" and `AGENTS.md` (if a pattern is added) match the code.

## 10. Accessibility and UX notes

- One primary action per screen: Add a practitioner on the list; Edit profile on a practitioner page (Reactivate when inactive); Save on the forms.
- The schedule editor is usable by keyboard alone: each block's parts are labelled with its weekday and number ("Monday, hours 2: start"), and Add hours / Remove are real buttons with those labels.
- **Copy to other days** is a real button labelled with its day ("Copy Monday's hours to other days"); its dialog is a labelled group of checkboxes, works with Tab, Space, Enter and Escape, and returns focus to the button.
- Times read as words to a screen reader ("9:00 AM to 12:00 PM at Main").
- Works at 320 px: on a phone each weekday is a stacked card, never a wide grid.

## 11. Open questions

Decided by the product owner (2026-11-25):

- **Q28:** a wider word than "Doctors": the screens say **"Practitioners"** (P7-1).
- **Q29:** "Add a practitioner" stays **only on the Practitioners pages**, not on the Staff member page.
- **Q30:** **Copy to other days** is included, kept simple (P7-13).

Still open: none for this part.

## As Built

### 7.0 Foundations (2026-11-25)

Built as planned (§4 and the tests of M0), with these differences or details:

- **`practitionerProfileId` is a required field of the signed-in session** (`session-store.ts`), set from `GET /me`. On a clinic switch it is set to `null` at once, then `GET /me` is read again and only that field is taken (if the session is still in that clinic); a failed read leaves `null` and the switch stands. A tab that hears of another tab's switch reloads the whole session, which reads it too. Specs that build a session state gained the field.
- **`useDirectory`** (`features/practitioners/api/directory.ts`) reads pages of 100 until the last, and keeps nothing once no screen uses it (`gcTime: 0`): the API marks the directory as never cached.
- **Wall-clock helpers** are in their own file, `lib/datetime/wall-time.ts` (`formatWallTime`, `weekdayName`), since they involve no date and no zone. "midnight" is a translated word.
- **`opened-clinic.tsx` moved** to `src/lib/`; the patient forms import it from there (its second user arrives in 7.3).
- The navigation items and screens are not in this sub-phase.

Verified (2026-11-25): `api:check` passes; 109 Vitest files, 1569 specs pass (New York) and the Manila pass (244); lint, format check, typecheck, `tokens:check` and `build` pass; all Chromium e2e specs pass (64), each file on a fresh API instance. Against the real API, `/directory` answers and `GET /me` carries `practitionerProfileId`. Startup JavaScript 214.5 kB gzip (214.4 before; budget 170 kB, already exceeded).

Not verified: a real non-null `practitionerProfileId` (and "after a switch") against the real API, because the developer's database has no practitioner profiles yet (the seed was not re-run); the unit specs cover both. Firefox and WebKit (need Docker).

### 7.1 Practitioners list (2026-11-26)

Built as planned (P7-1, P7-3, P7-4, the list of §5 and the tests of M1), with these differences, which the plan body above already describes or which are recorded here:

- **Left for later sub-phases:** **Add a practitioner** (7.3) and names as links (7.2): neither page exists yet.
- **The list reads the whole directory** (not `practitionersOnly`, which would leave out inactive profiles that a manager must see) and filters and **cuts the pages itself** (20, 50 or 100); a page past the end shows the last one.
- **Columns:** name, specialization ("Not recorded"), staff member (full name and job title), and Status only for `practitioners.manage`. The number of practitioners found is announced politely.
- **The branch filter** lists the active branches (`GET /branches`, up to 100) and sends `branchId`; the address keeps `branch`, `page` and `pageSize`. An empty branch says "No practitioner works at this branch" with **Show all branches**.
- **A routing quirk handled:** the router passes an unusable address value on unless the route returns the key as undefined, so `?branch=nonsense` would have reached the API. This route returns every key. **The older lists (checked on `/staff?status=zzz&page=abc`) still pass such values to the API** and are not changed here.
- **Files:** `features/practitioners/list/PractitionersPage.tsx`, routes `_clinic/practitioners.tsx` (the `directory.read` gate) and `_clinic/practitioners/index.tsx`, the **Practitioners** item (stethoscope) after Patients, `doctor` in the e2e accounts.

Verified (2026-11-26): 110 Vitest files, 1589 specs pass (New York) and the Manila pass (101 for `src/lib` and `src/test`); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass. `tests/e2e/practitioners.spec.ts` (5 specs, Chromium, real API) passes: the navigation and the seeded doctor, no Status column for the receptionist, no e-mail address, the branch filter kept in the address and after a reload, a bad address value ignored, 360 px, and Lakeside's owner seeing only Lakeside's practitioner with a Status column. It ran against an API on the backend's **test database** seeded with `scripts/db/seed-dev.mjs`, because the developer's database had no practitioners; the patient, staff and smoke specs also pass there (44), and the three specs that read e-mails pass against the developer database (25; the test environment delivers no mail). The route chunk is 1.6 kB gzip; startup JavaScript 215.8 kB (214.5 before; budget 170 kB, already exceeded).

Not verified: a clinic with more than 100 staff or more than one page of practitioners against the real API (mocked specs only), an inactive practitioner against the real API (7.3 creates one), Firefox and WebKit (need Docker), manual screen-reader and zoom checks.

### 7.2 Practitioner page and "My schedule" (2026-11-26)

Built as planned (P7-5, P7-6, P7-8, the page of §5 and the tests of M2), with these differences, which the plan body above already describes or which are recorded here:

- **No manager actions yet** (7.3 and 7.4).
- **Files:** `record/PractitionerPage.tsx`, `record/WeeklySchedule.tsx`, `record/WorkingHours.tsx`, `api/practitioners.ts` (`usePractitioner`, `useAvailability`), route `_clinic/practitioners/$profileId.tsx` (keyed by id); **My schedule** in the shell (after Practitioners, current on the person's own page only); list names are links.
- **The tab title is the practitioner's display name** (staff names are not patient data).
- **The person's line** comes from the directory: their name and job title, or "Not active staff at the moment" when the directory does not list them (a suspended member, who also has no hours).
- **Weekly schedule:** a block reads "9:00 AM – 12:00 PM, Main" and, to a screen reader, "9:00 AM to 12:00 PM at Main"; a branch the app cannot find says "Unknown branch"; a branch zone is shown only when it differs from the clinic's.
- **Working hours:** the branches offered are those in the schedule (every active branch if the week is empty). The day follows the chosen branch's today until the person picks one, which is then kept across branches. An incomplete date says "Choose a day." and asks nothing. An interval ending as the day does reads "midnight". An inactive practitioner says so and asks nothing.
- **A design system defect found by the real-browser run and fixed:** the calendar of `DatePicker` (first used on a real page here) named a day button "December 1st" while showing "1", which fails WCAG 2.5.3 (label in name: voice control could not press it). Day buttons are now named "Wednesday, November 25, 2026" (`date-fields.spec.tsx`).

Verified (2026-11-26): 112 Vitest files, 1619 specs pass (New York), the Manila pass (146 for `src/lib`, `src/test` and the practitioners, before the calendar spec); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass. `tests/e2e/practitioners.spec.ts` (11 specs, Chromium, real API on the seeded test database) passes: the page from the list with the seeded week, a Monday's and a Sunday's working hours, the calendar, 360 px, unknown and broken addresses, Lakeside opening Sunrise's doctor getting "not found", **My schedule** for a doctor, and for the two-clinic account in Lakeside, gone after switching to Sunrise (the real-API check of 7.0's re-read). The other Chromium specs pass (64) and the design-system and CSP specs (47). The route chunk is 2.7 kB gzip; startup JavaScript 218.1 kB (215.8 before; budget 170 kB, already exceeded).

Not verified: a branch with its own time zone, a suspended member and an inactive practitioner against the real API (unit specs cover them), Firefox and WebKit (need Docker), manual screen-reader and zoom checks.

### 7.3 Add and edit a practitioner (2026-11-26)

Built as planned (P7-9, P7-10, P7-11, the screens of §5 and the tests of M3), with these differences or details, which the plan body above already describes or which are recorded here:

- **The person picker is not a separate component:** it is the design system's `Combobox` inside `NewPractitionerPage` (one user so far). The booking picker stays with booking (P7-12).
- **A defect found by the spec and fixed before release:** switching clinic in another tab reloads the directory for the new clinic, which removed the open form and what was typed. The form now keeps the staff of the clinic it was opened in. The edit page likewise keeps the profile it first read.
- **The display name** is pre-filled when a person is chosen and follows another choice, until it is typed over.
- **No `Idempotency-Key`:** the contract has none for `POST /practitioners`; the button is disabled while saving, and a repeat is answered `CONFLICT_UNIQUE`.
- **A refused person** (`CONFLICT_UNIQUE`, `CONFLICT`, `404`) is cleared, explained under **Person** and the staff are read again; for `CONFLICT_UNIQUE` the page links to their practitioner page.
- **Actions:** one primary action (Edit profile; Reactivate when inactive); Deactivate is a secondary danger button.
- **Saves refresh** the practitioner and directory queries of the clinic whatever the answer; create, deactivate and reactivate also read the session again.
- **Files:** `form/` (`NewPractitionerPage`, `EditPractitionerPage`, `PractitionerFields`, `use-practitioner-form.ts`, `practitioner-form-values.ts`), `record/PractitionerActions.tsx`, `record/PractitionerNotFound.tsx`, `api/practitioners.ts` (`useCreatePractitioner`, `useUpdatePractitioner`), routes `_clinic/practitioners/new.tsx` and `$profileId_.edit.tsx`.

Verified (2026-11-26): 116 Vitest files, 1665 specs pass (New York) and the Manila pass (187 for `src/lib`, `src/test` and the practitioners); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass. Against the real API on Chromium: `tests/e2e/practitioner-management.spec.ts` (6 specs, the developer database, which delivers the setup e-mail to files): a new clinic's owner makes themselves a practitioner, the same person added from a stale second tab is refused with the link, edit and reload, deactivate (marked Inactive in the real directory, no working hours, **My schedule** gone) and reactivate, both forms at 360 px, and Sunrise's owner getting "not found" for the page and the edit form. `tests/e2e/practitioners.spec.ts` (now 12) adds the receptionist: "no access" for the new and edit pages, no Add button, and `403` from `POST /practitioners` with their token. All other e2e specs pass (Chromium; design-system and CSP also on the phone viewport). Startup JavaScript 221.0 kB gzip (218.1 before; budget 170 kB, already exceeded); each new route chunk is about 1–2 kB.

Not verified against the real API: adding someone whose membership ended meanwhile (`409 CONFLICT` / `404`), server-side field errors, and a clinic switch while a form is open (unit specs cover them). Not done: Firefox and WebKit (need Docker), manual screen-reader and zoom checks.

### 7.4 Weekly schedule editor (2026-11-26)

Built as planned (P7-7, P7-13, the screen of §5 and the tests of M4), with these differences or details, which the plan body above already describes or which are recorded here:

- **All branches are read**, not only the active ones: a saved block at a deactivated branch is shown as "{name} (no longer active)" and refused before sending ("This branch is no longer active."), which the plan did not foresee. A branch with its own time zone shows the zone in the list, and the page says "Times are the local time of each branch."
- **An unchanged week sends nothing** ("Nothing to change."), as on the profile form (P7-9): with no `version`, sending it would only overwrite someone else's newer week.
- **A fresh read:** `useFreshPractitioner` always asks again and the editor waits for that answer, so a cached week is never edited.
- **Rows** keep their order while being edited (a new row is added at the end of its day) and are numbered by position; the week is sent by weekday, then start, and the API's `blocks[i]` errors are mapped onto the rows in that order. `INVALID_VALUE` is worded as the matching rule (inactive branch, overlap, end after start). Of two overlapping blocks, the one that starts later is blamed.
- **404:** see §5; the answer does not say whether the profile or a branch is unknown.
- **Empty week:** the confirmation is "Save an empty week?" / "{name} will have no working hours." / **Save empty week**.
- **Copy dialog:** **Copy hours** with no day ticked says "Choose at least one day."
- **Design system:** `SelectField` and `TimeField` take an optional `name`, so the error summary's links can focus them. `Combobox` takes it too: the **Person** picker of 7.3 had none, so its summary link did not move focus (fixed 2026-11-26, with two specs: 1731 pass).
- **Saved week:** the answer is put in the query cache, so the practitioner page shows it even if the reload fails.
- **Files:** `schedule/` (`ScheduleEditorPage`, `DayHours`, `CopyHoursDialog`, `schedule-rules.ts`), `api/practitioners.ts` (`useFreshPractitioner`, `useReplaceSchedule`), route `_clinic/practitioners/$profileId_.schedule.tsx`.

Verified (2026-11-26): 119 Vitest files, 1729 specs pass (New York) and the Manila pass (246 for `src/lib`, `src/test` and the practitioners); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass. Against the real API on Chromium, `tests/e2e/practitioner-management.spec.ts` (now 9) adds: a second branch, an overlap across the two branches refused, Monday (one block until midnight) copied to Tuesday and Thursday by keyboard, Tuesday changed by hand, the saved week after a reload, a day's working hours at both branches, the editor and the copy dialog at 360 px, an unchanged week, and another clinic getting "not found" for the editor. `practitioners.spec.ts` (12) adds the receptionist getting "no access" for the editor and `403` from the `PUT`. All other e2e specs pass (Chromium; design-system and CSP also on the phone viewport). The route chunk is 4.7 kB gzip; startup JavaScript 224.1 kB (221.0 before; budget 170 kB, already exceeded).

Not verified against the real API: the API's own row errors, a deactivated or deleted branch, an empty week, and a clinic switch while the editor is open (unit specs cover them). Not done: Firefox and WebKit (need Docker), manual screen-reader, zoom and visual layout checks.
