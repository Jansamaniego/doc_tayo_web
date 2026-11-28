# Appointments: frontend integration guide (backend sub-phase 5.3)

For the people (or AI agent) building the DocTayo web app's appointment screens (frontend Phase 7, after the practitioner screens of 7.0–7.4). Read [frontend-integration.md](frontend-integration.md) first for sign-in, tokens, clinic selection, errors and conventions, and the "Rules that apply to every clinical request" in [clinical-integration.md](clinical-integration.md). **The exact request and response shapes are in [openapi.json](openapi.json)** (tag `appointments`; 69 operations in total). This guide covers what that file cannot say: which call each screen makes, the rules behind each answer, and what to show for each error.

Paths below leave out the `/api/v1` prefix.

| Part | Screens | Calls |
|---|---|---|
| [A. Day view](#a-day-view) | The front desk's day at one branch | `GET /appointments?branchId=&date=` |
| [B. Booking and walk-ins](#b-booking-and-walk-ins) | Book a slot; register a patient who is here now | `POST /appointments` |
| [C. Check in, cancel, no-show](#c-check-in-cancel-no-show) | Status buttons on the day view | `POST /appointments/:id/check-in`, `/cancel`, `/no-show` |
| [D. Move or edit](#d-move-or-edit) | Change time, doctor, service, reason | `PATCH /appointments/:id` |
| [E. Week view and a patient's visits](#e-week-view-and-a-patients-visits) | Calendar week; "Visits" on the patient page | `GET /appointments?branchId=&from=&to=`, `GET /patients/:patientId/appointments` |
| [F. Changes to existing screens](#f-changes-to-existing-screens) | Practitioner working hours | `GET /practitioners/:profileId/availability` (now minus booked time) |

Build them in that order: each part uses what the one before it built.

**Test accounts** (after the backend's `npm run db:seed:dev`; password `dev-password-change-me-123`): `reception@sunrise.test` (the front desk; no medical records), `doctor@sunrise.test` (the seeded practitioner, with today's appointments), `owner@sunrise.test`. In Lakeside Family Clinic, `multi@doctayo.test` is the practitioner. The seed is described in [Seeded data](#seeded-data).

---

## Rules for every appointment call

- **Who sees what.** Decide from `GET /me` → `permissions`, never from role names. `appointments.read` unlocks lists and detail; `appointments.manage` unlocks booking, editing and every status button. **All five default roles hold both** (owner, clinic admin, doctor, nurse, receptionist), but a custom role may not: hide what the user cannot do.
- **Send `X-Expected-Tenant-Id: <active clinic id>`** on every call. `409 TENANT_MISMATCH` means another tab switched clinics: nothing was done, reload the app state.
- **Every change sends the `version` you read.** The answer to every write is the whole appointment with its new `version`: replace your copy with it. `409 VERSION_CONFLICT` means someone else changed the appointment first: reload it, show the new state, let the user decide again. The error does not carry the new version.
- **`409 CONFLICT`** means the appointment's status does not allow the action (for example, checking in a cancelled appointment, or editing one that is already checked in). Reload it: the screen was out of date or the button should not have been shown.
- **`404 NOT_FOUND`** is the same for an unknown id and another clinic's id.
- **`400 VALIDATION_FAILED`** carries `details: [{ field, code, message }]`. Show `message` under the form field named by `field` (`startsAt`, `endsAt`, `branchId`, `serviceId`, `reason`, …). A field the API does not accept is `UNKNOWN_FIELD`: that is a bug in the client, not a user mistake.
- **Responses are never cached** (`Cache-Control: no-store`). Do not keep appointment lists in persistent browser storage; in-memory query caches are fine.
- **Appointments are never deleted.** There is no `DELETE`; cancel instead.

### The appointment

```json
{
  "id": "0198f3c2-…",
  "kind": "scheduled",
  "status": "scheduled",
  "branchId": "0198f0aa-…",
  "patient": { "id": "0198f1b0-…", "patientNumber": "P-000001", "firstName": "Juan", "lastName": "Dela Cruz" },
  "practitioner": { "membershipId": "0198f0ab-…", "profileId": "0198f1c4-…", "displayName": "Dr. Dan Doctor, MD" },
  "service": { "id": "0198f1d9-…", "name": "Follow-up" },
  "startsAt": "2026-12-07T01:00:00.000Z",
  "endsAt": "2026-12-07T01:30:00.000Z",
  "reason": "Annual check-up",
  "checkedInAt": null,
  "cancelledAt": null,
  "cancelReason": null,
  "version": 1,
  "createdAt": "2026-12-06T23:40:12.345Z",
  "updatedAt": "2026-12-06T23:40:12.345Z"
}
```

| Field | Meaning |
|---|---|
| `kind` | `scheduled` (booked for a time) or `walk_in` (arrived without a booking) |
| `status` | `scheduled`, `checked_in`, `completed`, `cancelled`, `no_show` (see [Statuses](#statuses)) |
| `patient` | Number and name only, for the list row. No phone, birth date or notes: open `GET /patients/:patientId` for those |
| `practitioner` | `membershipId` is what booking and filters take; `profileId` opens the practitioner page; `displayName` is what to print |
| `service` | `null` when none was chosen. A service deactivated later still shows here by name |
| `startsAt`, `endsAt` | UTC instants. For a walk-in, `startsAt` is the arrival and `endsAt` only an estimate |
| `reason` | The purpose of the visit, or `null` |
| `checkedInAt` | When the patient arrived (set by check-in and for walk-ins; kept after a cancellation) |
| `cancelledAt`, `cancelReason` | Both set exactly when `status` is `cancelled` |
| `version` | Send it back with the next change |

The ids of the staff who booked or changed an appointment are not returned.

### Time zones

- **Every date the API takes (`date`, `from`, `to`) is a day in the branch's time zone**, and every instant it returns is UTC. Show instants in the branch's zone: the branch's `timezone` from `GET /branches`, or when that is `null`, the clinic's `timezone` from `GET /tenant` (both `tenant.read`/`branches.read`, held by every role). Seeded clinics use `Asia/Manila` (UTC+8, no daylight saving).
- **Send instants with `Z` or an offset, to the whole minute**: `"2026-12-07T09:00:00+08:00"` or `"2026-12-07T01:00:00Z"`. Seconds other than `:00`, or no zone at all (`"2026-12-07T09:00"`), are `400`. Build the instant from the date and time the user picked in the **branch's** zone, not the browser's: a receptionist's laptop may be set to another zone.
- An appointment belongs to the day it **starts** on, in the branch's zone. An appointment from 23:30 to 00:30 appears only on the first day.

### Statuses

| Status | Reached by | Buttons to offer |
|---|---|---|
| `scheduled` | booking | **Check in** (only on the appointment's own day), **No-show** (only once the start time has passed), **Cancel**, **Edit** |
| `checked_in` | check-in, or a walk-in | **Cancel** |
| `completed` | signing the consultation (backend 5.4, not available yet) | none |
| `cancelled` | cancel | none |
| `no_show` | no-show | none |

There is **no undo**: a cancelled or no-show appointment stays as it is; book again. Checking in by mistake can only be followed by a cancellation. Show final statuses as read-only rows.

Hide **Check in** when the appointment is not today (in the branch's zone) and **No-show** before `startsAt`. The API refuses both with `409 CONFLICT` anyway, but a hidden button is clearer than an error.

---

## A. Day view

`GET /appointments?branchId=<id>&date=YYYY-MM-DD`

| Parameter | Rule |
|---|---|
| `branchId` | **Required.** It decides the time zone. An unknown or another clinic's branch is `404` |
| `date` | One day in the branch's zone. **Leave it out for today** (computed on the server in the branch's zone) |
| `practitionerMembershipId` | Only this practitioner's appointments |
| `status` | Comma-separated: `status=scheduled,checked_in` |
| `page`, `pageSize` | From 1; default 20, at most 100. Answer: `meta: { page, pageSize, totalItems, totalPages }` |

- Ordered by `startsAt`, then `id`. A walk-in's `startsAt` is its arrival, so walk-ins sit in arrival order among the booked appointments.
- A day view should ask for `pageSize=100` and fetch the next page while `page < totalPages`: a busy branch can have more than one page.
- Suggested filters: practitioner (from the directory, see B), and status tabs **Active** (`scheduled,checked_in`), **All** (no `status`), **Cancelled** (`cancelled,no_show`).
- **"Waiting room"**: `status=checked_in`, in arrival order. There is no separate queue API (frontend Phase 10 waits for one).
- **A doctor's own day**: the API does not return the signed-in member's membership id directly. Take `GET /me` → `practitionerProfileId`; when it is not `null`, `GET /practitioners/:profileId` gives `membershipId`; pass that as `practitionerMembershipId`. A doctor may work at several branches: ask each branch they have hours at (the profile's `schedule[].branchId`).
- Errors: `400` on `branchId` (missing), `date` (not a real date), `status` (unknown value), `pageSize` (over 100); `404` for the branch.

**Done when:** the receptionist sees today's appointments at a branch in the branch's time, can switch days and branches, filter by practitioner and status, and sees walk-ins in arrival order.

---

## B. Booking and walk-ins

`POST /appointments`, with an **`Idempotency-Key`** header: a fresh UUID per booking attempt, **reused when the same request is retried** (a timeout, a double tap). The same key with a different body is `422 IDEMPOTENCY_KEY_REUSED`; while the first request is still running a retry is `409 IDEMPOTENCY_KEY_IN_USE` (wait `Retry-After` seconds and send it again). Only successful bookings are remembered, so after an error the corrected request can reuse the key. Answer: `201` with the appointment.

### Booking a time

```json
{
  "kind": "scheduled",
  "branchId": "…",
  "patientId": "…",
  "practitionerMembershipId": "…",
  "serviceId": "…",
  "startsAt": "2026-12-07T09:00:00+08:00",
  "endsAt": "2026-12-07T09:30:00+08:00",
  "reason": "Follow-up on lab results"
}
```

| Field | Rule |
|---|---|
| `kind` | `scheduled` |
| `branchId` | An **active** branch (`GET /branches`; inactive is `400` on `branchId`) |
| `patientId` | Picked with `GET /patients?q=`. An **archived** patient is `409 PATIENT_ARCHIVED` (offer to restore the patient, `POST /patients/:id/unarchive`, if the user may) |
| `practitionerMembershipId` | From `GET /directory?practitionersOnly=true` (each entry's `membershipId`). Add `&branchId=` to list those with hours at that branch first, but **booking outside a practitioner's hours is allowed**: do not make the picker refuse others |
| `serviceId` | Optional, `null` or left out for none. An **active** service (`GET /services?pageSize=100`; inactive is `400` on `serviceId`) |
| `startsAt`, `endsAt` | **Both required.** Propose `endsAt = startsAt + service.defaultDurationMinutes` and let the user change it. The end must be after the start, at most **8 hours** later, and not already past; the start at most **366 days** ahead. Errors are `400` on the field named |
| `reason` | Optional, at most 200 characters; blank is stored as `null` |

**The reason is the purpose of the visit, never symptoms.** Label it "Purpose of visit" with a hint such as "e.g. follow-up, medical certificate". Every role, reception included, can read it; symptoms belong in the consultation, which reception cannot read.

**Helping the user pick a time.** `GET /practitioners/:profileId/availability?branchId=&date=` gives the practitioner's working hours at that branch on that date **minus what is already booked at any branch** (see F). Use it to suggest free times. It is only a guide: the API decides at booking time.

### Registering a walk-in

```json
{ "kind": "walk_in", "branchId": "…", "patientId": "…", "practitionerMembershipId": "…", "serviceId": "…", "reason": "…" }
```

**Send no `startsAt` or `endsAt`** (either is `400` on that field). The answer is already `checked_in`, with `startsAt` and `checkedInAt` set to now and `endsAt` estimated from the service's duration (30 minutes without a service). Walk-ins never block a slot and never cause `APPOINTMENT_OVERLAP`: they wait in arrival order. Show their end time as an estimate, or not at all.

### Errors to handle

| Answer | What happened | What to show |
|---|---|---|
| `409 APPOINTMENT_OVERLAP` | The practitioner already has a booked or checked-in appointment that overlaps, at any branch. Also when someone else booked the same slot a moment earlier | Keep the form filled; reload the day and the availability; ask for another time or practitioner |
| `409 PATIENT_ARCHIVED` | The patient record is archived | "This patient record is archived" with a restore action if permitted |
| `422 NOT_A_PRACTITIONER` | The chosen member has no active practitioner profile, or was suspended or removed | Reload the practitioner picker |
| `400` on `branchId` / `serviceId` | The branch or service was deactivated | Reload that picker |
| `400` on `startsAt` / `endsAt` | Format, length or range | The field message |
| `404 NOT_FOUND` | A picked branch, patient, practitioner or service no longer exists in this clinic | Reload the pickers |

Back-to-back appointments (one ends at 09:30, the next starts at 09:30) are fine. One patient may have overlapping appointments with two different practitioners.

**Done when:** the receptionist books a patient with a practitioner, sees `APPOINTMENT_OVERLAP` handled without losing the form, registers a walk-in in two clicks, and a double tap on **Book** creates one appointment.

---

## C. Check in, cancel, no-show

| Button | Call | Body | Allowed when |
|---|---|---|---|
| **Check in** | `POST /appointments/:appointmentId/check-in` | `{ "version": 1 }` | `scheduled`, on the appointment's own day in the branch's zone |
| **Cancel** | `POST /appointments/:appointmentId/cancel` | `{ "version": 1, "reason": "The patient called to cancel" }` | `scheduled` or `checked_in` |
| **No-show** | `POST /appointments/:appointmentId/no-show` | `{ "version": 1 }` | `scheduled`, once `startsAt` has passed |

Each answers `200` with the updated appointment.

- **Cancel asks for a reason** (required, at most 500 characters, surrounding spaces trimmed; shown to staff). Ask in a dialog; offer quick choices ("Patient called to cancel", "Practitioner unavailable", "Booked by mistake") plus free text. As with the visit reason: no symptoms.
- Cancelling or marking a no-show **frees the slot at once**; the time can be booked again.
- **No-show** and **Cancel** cannot be undone, so confirm them. **Check in** needs no confirmation.
- Errors: `409 VERSION_CONFLICT` (reload), `409 CONFLICT` (status or day does not allow it; reload), `400` on `reason` or `version`, `404`.
- Two receptionists pressing **Check in** at once: one gets `200`, the other `409`; reload and the row is already checked in.

**Done when:** the day view's buttons follow the status table, a cancel asks for a reason, and a stale screen recovers by reloading.

---

## D. Move or edit

`PATCH /appointments/:appointmentId`

```json
{ "version": 1, "startsAt": "2026-12-07T10:00:00+08:00", "endsAt": "2026-12-07T10:30:00+08:00" }
```

- Only for a **booked** (`kind: scheduled`) appointment that is still **`scheduled`**. A walk-in or an appointment in any other status is `409 CONFLICT`: hide **Edit** for them.
- Send `version` and only the fields that changed: `startsAt`, `endsAt`, `practitionerMembershipId`, `serviceId` (`null` removes it), `reason` (`null` removes it). `startsAt`, `endsAt` and `practitionerMembershipId` cannot be `null`.
- **The patient and the branch cannot change** (`400 UNKNOWN_FIELD`). To move a visit to another branch or patient, cancel it and book again.
- The same rules as booking apply to what changes: times (both together must still be valid), `409 APPOINTMENT_OVERLAP` (moving onto a taken slot; moving within its own time is fine), an inactive service chosen now (`400`). The practitioner and the patient are checked on every change: a practitioner deactivated since the booking is `422 NOT_A_PRACTITIONER`, an archived patient `409 PATIENT_ARCHIVED`. A service deactivated since the booking may stay.
- A patch that changes nothing answers `200` with the same `version`.

**Done when:** the receptionist moves an appointment to another time or practitioner from the day view, and an overlap or a stale version is handled like in B and C.

---

## E. Week view and a patient's visits

### Week (or any range)

`GET /appointments?branchId=<id>&from=2026-12-07&to=2026-12-13`

- `from` and `to` are days in the branch's zone, **both included**, at most **31 days** (`400` on `to` beyond that or when `to` is before `from`). Send both or neither; `date` together with `from`/`to` is `400` on `date`.
- The same filters, order and pagination as the day view. A full week at a busy branch can take several pages of 100: fetch them all before drawing.
- Draw each appointment from `startsAt` to `endsAt` in the branch's zone. Walk-ins have no real length: draw them as markers, or leave them out of the week view.

### A patient's visits

`GET /patients/:patientId/appointments?status=&page=&pageSize=`

- Every branch, **newest start first**, also for an archived patient. Same `status` filter and pagination.
- Each row carries `branchId`: show the branch name from `GET /branches` (rows are not grouped by branch).
- Suggested on the patient page: **Upcoming** (`status=scheduled`) and **History** (no filter).
- `404` for an unknown or another clinic's patient.

**Done when:** a week view shows a branch's booked appointments in the branch's time, and the patient page lists the patient's past and upcoming visits.

---

## F. Changes to existing screens

- **Practitioner working hours** (`GET /practitioners/:profileId/availability`, frontend decision P7-8): the intervals now **leave out booked appointments** (booked and checked-in, at any branch; walk-ins are not subtracted). Remove the line "Booked appointments are not counted yet." The hours are still informational: booking outside them is allowed, so do not call them "the only free slots".
- **Regenerate the API types** from the new `openapi.json` (61 → 69 operations; new tag `appointments`; three new error codes in the `ErrorCode` enum).
- **Error messages**: add the three new codes to the client's error message mapping (table below).
- **Navigation**: an **Appointments** item under `appointments.read`.

### New error codes

| Code | HTTP | Default message (from the API) |
|---|---|---|
| `APPOINTMENT_OVERLAP` | 409 | The doctor already has an appointment at that time. Please choose another time. |
| `PATIENT_ARCHIVED` | 409 | This patient record is archived. Restore it before booking a visit. |
| `NOT_A_PRACTITIONER` | 422 | This staff member cannot be booked for appointments. |

The API messages say "doctor"; if the screens say "practitioner" (frontend decision P7-1), use your own message catalogue for these codes. All codes are in [error-codes.md](error-codes.md).

---

## Seeded data

`npm run db:seed:dev` on the backend books, at Sunrise Clinic's **Main** branch for `doctor@sunrise.test` (Dr. Dan Doctor, MD), on **the day the seed runs** (Asia/Manila):

| Time | Patient | Kind | Status | Service, reason |
|---|---|---|---|---|
| 08:45 | Lourdes Navarro | walk-in | `checked_in` | — |
| 09:00 | Juan Dela Cruz | scheduled | `scheduled` | reason "Annual check-up" |
| 09:30 | Maria Santos | scheduled | `scheduled` | — |
| 10:30 | José Peña | scheduled (15 min) | `scheduled` | Follow-up, "Follow-up on lab results" |
| 11:00 | Angela Reyes | scheduled | `checked_in` | — |
| 11:30 | Pedro Bautista | scheduled | `cancelled` | cancel reason "The patient called to cancel" |
| 14:00 **tomorrow** | Maria Theresa Santos | scheduled | `scheduled` | — |

In Lakeside Family Clinic, `multi@doctayo.test` (Dr. Maya Multi, MD) has one appointment today at 10:00 with Liza Mendoza. Running the seed again the same day adds nothing; running it on a later day adds that day's set, so run it on the day you test. Tomorrow's visit and the **Check in** and **No-show** rules make good tests: tomorrow's appointment cannot be checked in today, and 09:00 cannot be marked a no-show before 09:00.

## Not available yet

- `completed` is never reached until consultations exist (backend 5.4): signing the consultation of a checked-in appointment will complete it.
- No reminders (backend Phase 6), no waiting-room queue or TV display (not planned), no blocking of whole days for leave or holidays, no recurring appointments, no undo of a status change (all recorded in the backend's `later.md`).
- No assignment of staff to branches (frontend D-9): every member sees every branch.
