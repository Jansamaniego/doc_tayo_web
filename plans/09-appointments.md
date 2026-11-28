# Phase 9: Appointments

Status: **in progress**: 9.0 (2026-11-27), 9.1 and 9.2 (2026-11-28) built (see "As Built"); 9.3 to 9.5 not built. Written and **approved by the product owner** 2026-11-27, including every decision and the default answers to Q33 to Q36 (§11). Backend: **available**. Backend Phase 5, sub-phase **5.3 "Appointments"**, shipped: the day and week lists, booking and walk-ins, check-in, cancel, no-show, rescheduling and a patient's visits ([docs/appointments-integration.md](../docs/appointments-integration.md), [docs/clinical-integration.md](../docs/clinical-integration.md) §5.3, [docs/error-codes.md](../docs/error-codes.md) "Phase 5.3 codes", `docs/openapi.json`, now **69 operations**, tag `appointments`). Availability (`GET /practitioners/:profileId/availability`) now leaves out booked time. Depends on Phase 6 (patients, the opened-clinic rule P6-4, `LeaveGuard`, `VersionConflictNotice`, idempotency keys), Phase 7 (the directory, practitioner profiles, availability, `practitionerProfileId`, the wall-clock helpers) and Phase 8 (the services and `formatDuration`).

**Numbering.** "Phase 9" and "9.x" are the frontend's; "5.3" is the **backend's** sub-phase. Plan 07 first said appointments would be added to Phase 7 as 7.5 onward. On 2026-11-27 the owner asked for a child plan `09-appointments`, so appointments became a phase of their own, as the services catalog did, and the later phases moved down by one: consultations are now Phase 10, the queue and TV display Phase 11, billing 12, notifications and reports 13, the patient portal 14, production hardening 15 and Filipino 16. The backend guide still says "frontend Phase 7" for appointments and "frontend Phase 10" for the queue: those are the old numbers in a copied document, which is not edited here.

| Sub-phase | Milestone | Who uses it | What it adds |
| --------- | --------- | ----------- | ------------ |
| 9.0 Foundations | M0 | everyone | Regenerated types; the three new error codes; the appointment query hooks; a branch's time zone in one helper; date helpers for days and weeks; the Working hours line changed |
| 9.1 Day view and appointment page | M1 | every clinic role (`appointments.read`) | **Appointments** navigation item; one branch's day, with practitioner and status filters and "My appointments"; one appointment's page |
| 9.2 Booking and walk-ins | M2 | `appointments.manage` (all five default roles) | Book a time; register a walk-in; **Book a visit** on the patient page |
| 9.3 Check in, cancel, no-show | M3 | `appointments.manage` | The status buttons on the day view and the appointment page |
| 9.4 Move or edit | M4 | `appointments.manage` | Change the time, practitioner, service or purpose of a booked appointment |
| 9.5 Week view and a patient's visits | M5 | `appointments.read` | A branch's week; **Visits** (upcoming and history) on the patient page |

End-to-end runs for all of them are milestone M6. The order follows the guide's parts A to F (each part uses what the one before built); part F (changes to existing screens) is in 9.0.

## 1. Objectives

- The front desk sees a branch's day in the branch's own time, from any computer, whatever that computer's time zone.
- A receptionist books a patient with a practitioner without losing what they typed when the API refuses (a taken slot, an archived patient, a practitioner no longer bookable), and a double press creates one appointment.
- A walk-in is registered in two presses from the day view.
- Status buttons follow the status table: a button that the API would refuse is not shown, and a screen that went out of date recovers by reading the appointment again.
- Nothing invites symptoms into the purpose of a visit or the cancel reason: every role, reception included, reads both.
- No screen calls working hours "the only free slots": booking outside them is allowed.

## 2. Decisions

| #     | Decision | Why |
| ----- | -------- | --- |
| P9-1  | **Routes:** `/appointments` (day view), `/appointments/week` (week view), `/appointments/$appointmentId` (appointment page) under `RequirePermission('appointments.read')`; `/appointments/new` and `/appointments/$appointmentId_/edit` also under `appointments.manage`. The branch, day and filters are in the address (`branch`, `date`, `practitioner`, `status` as the tab `checked_in`, `all` or `closed`, and for the week `from`); there is no page, since the day is shown whole (P9-3); nothing typed is. A value the app cannot use (not an id, not a real date, an unknown tab) is dropped, never sent (the routing quirk of plan 07, 7.1 As Built). One navigation item, **Appointments** (calendar icon), **after Home and before Patients** (Q33, decided). | Same guard pattern as Phases 5 to 8; full pages for the forms (tablets); the front desk's main screen comes first. |
| P9-2  | **Times are shown in the branch's zone:** the branch's `timezone`, or the clinic's when it is `null` (the guide, "Time zones"). The rule lives in `features/clinic/api/branches.ts`: `branchTimeZone({ branch, clinicZone })`, and `useBranchTimeZone(branchId)` for a screen with one chosen branch. They replace the inline `branch.timezone ?? clinicZone` of the practitioner page. Every date the app sends (`date`, `from`, `to`) is a day in that zone, and every instant it sends is built by `fromClinicDateTime` from the date and time picked in that zone, never the computer's. When the branch's zone differs from the clinic's, the page says "Times are in {zone}." | The guide: "a receptionist's laptop may be set to another zone"; one module does conversion (plan.md §5.6). |
| P9-3  | **The day view reads the whole day:** pages of 100 (`pageSize=100`) until `page = totalPages`, then shows them in the API's order (`startsAt`, then `id`), so walk-ins sit in arrival order. Keys `[tenantId, 'appointments', 'day', { branchId, date, practitionerMembershipId, status }]`. The answers are `no-store`, so the data is kept in memory only while a screen uses it (`gcTime: 0`, as the directory, P7-3). The day is **always sent as `date`**: today is computed with `todayInZone` for the branch, so the heading, the query key and the Check in rule agree, and a view of "today" left open past midnight moves to the new day. | The guide: "a busy branch can have more than one page"; `date` left out means "today on the server", which the screen could not name. |
| P9-4  | **The day view refreshes itself:** every 60 seconds while the page is visible, when the window regains focus, and after every change made from this tab. A second receptionist's booking shows within a minute. No live updates exist in the API. | The front desk shares one day; without it two people book from stale screens and meet `APPOINTMENT_OVERLAP` more often. |
| P9-5  | **The branch** is chosen on the day and week views from the active branches (`GET /branches`). It starts on the branch last used on this computer (the existing `lastBranchId` device preference, plan 01: a branch id is not patient data), else the clinic's first active branch; a clinic with one branch shows no picker. A remembered branch, or one in the address, that is not in the list (another clinic, deactivated) is ignored. A clinic with no active branch says "Add an active branch before booking appointments." | The guide: `branchId` is required; staff are not assigned to branches yet (D-9). |
| P9-6  | **Filters on the day view:** **Practitioner** ("All practitioners" or one, from `GET /directory?practitionersOnly=true`), and status tabs **Active** (`scheduled,checked_in`, the default), **Checked in** (`checked_in`: who is waiting, in arrival order), **All** (no `status`) and **Cancelled and no-show** (`cancelled,no_show`). The **Checked in** tab is not a queue: there is no queue API (Phase 11, §12.4). | The guide's suggested filters and "Waiting room". |
| P9-7  | **"My appointments"** is offered when the session has a `practitionerProfileId` (P7-5): it reads `GET /practitioners/:profileId` for `membershipId` and sets the practitioner filter to it. When the person has hours at more than one branch (the profile's `schedule[].branchId`), the branch picker lists those branches first. This is decided by identity, not by a permission, as **My schedule** is. Backend request **D-35** (optional): `GET /me` → `membershipId` would save the profile read. | The guide, "A doctor's own day". |
| P9-8  | **A row of the day view** shows: time ("9:00 AM – 9:30 AM"; a walk-in "Arrived 8:45 AM", with no end time), patient (number and "Last, First" with the existing `patient-name` helper; a link to the patient page with `patients.read`), practitioner (`displayName`; a link to the practitioner page), service ("No service" when `null`), purpose of visit, a **Walk-in** marker, and the status as a `StatusPill` (Scheduled, Checked in, Completed, Cancelled, No-show: icon and word, never colour alone). Final statuses are read-only rows. The time opens the appointment page. The browser tab title is "Appointments", never a patient's name (Q25). | The guide: "Show their end time as an estimate, or not at all"; `patient` carries number and name only. |
| P9-9  | **The appointment page** (`GET /appointments/:appointmentId`) shows every field of the appointment: kind, status, branch, patient, practitioner, service, start and end (a walk-in's end as "about {time}"), purpose, checked-in time, cancelled time and reason. It is where the status buttons (9.3) and **Edit** (9.4) also live, so they work without the day view. Title "Appointment". `404` (unknown, or another clinic's) → "We could not find this appointment". | One place for an appointment opened from the patient's visits or the week view. |
| P9-10 | **Booking is a full page (`/appointments/new`)**, opened from the day view (**Book an appointment**, the primary action, with the branch and day of the view) and from the patient page (**Book a visit**, with the patient; hidden for an archived patient). One form for both kinds: **Booked time** or **Walk-in (here now)** as a `RadioGroup` at the top (Q34, decided: one form). **Register a walk-in** on the day view opens the same page with Walk-in chosen: one press to open, one to save once patient and practitioner are picked. Fields: Branch (active only), Patient, Practitioner, Service (optional), then for a booked time Date, Start and End; Purpose of visit. It renders `LeaveGuard`. | The guide, part B; "a walk-in in two clicks". |
| P9-11 | **The patient picker searches the server** (`GET /patients?q=`, 250 ms debounce, archived hidden, at most 20 results shown as "P-000123, Dela Cruz, Juan, born Mar 4, 1980"). `Combobox` today filters its own options in the browser, so 9.2 adds a server-searched mode to it in the design system (it is told the typed text and whether results are loading, and does no filtering of its own), with spec and story. The search text is personal data: it is never put in the address, a log or an error report. Without a match the picker says "No patient found" with a link to **Register a patient** (`/patients/new`, Q35). | The Phase 6 search rules (debounce, `q` is personal data); a clinic can have thousands of patients. |
| P9-12 | **The practitioner picker** reads `GET /directory?practitionersOnly=true` (every page, P7-3) and, for the chosen branch, `&branchId=`: practitioners with hours at that branch are listed first under "Works at {branch}", every other active practitioner under "Other practitioners". It never refuses the others: **booking outside a practitioner's hours is allowed**. Deactivated profiles are never offered. | The guide, "practitionerMembershipId"; the picker that P7-12 left for booking. |
| P9-13 | **The service picker** reads `GET /services?pageSize=100` (active only) and offers **No service** first. Choosing a service proposes **End = Start + its usual length** (`defaultDurationMinutes`) until the person changes End by hand; without a service the proposal is 30 minutes. The length is shown in words ("30 minutes", `formatDuration`, which moves from `features/services/` to `src/lib/` as P8-6 said it would when booking became its second user). A service deactivated after booking still shows by name on existing appointments. | The guide: "Propose `endsAt = startsAt + service.defaultDurationMinutes` and let the user change it." |
| P9-14 | **Times checked before sending**, in the branch's zone: Date, Start and End required for a booked time; End after Start; at most 8 hours long; End not already past; Start at most 366 days ahead (a `DatePicker` limit too). `TimeField` keeps its 5-minute steps, so every instant is to the whole minute. Booking across midnight is allowed (End on the next day is chosen with **Ends the next day**, a checkbox shown only when End is before Start). The API's `VALIDATION_FAILED` on `startsAt`/`endsAt` still goes under the field. | The guide's limits; not sending what the API would refuse. |
| P9-15 | **Free times help, they do not decide:** once practitioner, branch and date are chosen, the form shows that practitioner's **free working hours** that day (`GET /practitioners/:profileId/availability`, now without booked time) as buttons ("9:30 AM – 12:00 PM"); pressing one sets Start to its start. The heading is "Free working hours", with the line "Booking outside these hours is allowed." No hours → "No free working hours on this day." | The guide: "Use it to suggest free times. It is only a guide." |
| P9-16 | **Purpose of visit, never symptoms.** The `reason` field is labelled **Purpose of visit** with the hint "For example follow-up or medical certificate. Not symptoms: every staff member can read this." At most 200 characters; blank is sent as `null`. The cancel reason (P9-19) has the same hint. | The guide: symptoms belong in the consultation, which reception cannot read. |
| P9-17 | **Booking sends an `Idempotency-Key`** (`createIdempotentAction()`, one per open form, reused for retries of the same booking, a new one once the form's values change after an error) and **the clinic the form was opened in** (`useOpenedClinic()`, P6-4). What the form holds survives a clinic switch in another tab. `201` → the appointment page, toast "Appointment booked for {patient} at {time}." (a walk-in: "{patient} is checked in."), and the day's queries are read again. | The guide, part B; the Phase 6 rules. |
| P9-18 | **Errors when booking or editing keep the form filled:** `409 APPOINTMENT_OVERLAP` → an alert "The practitioner already has an appointment at that time. Choose another time or practitioner." and the free working hours and the day are read again; `409 PATIENT_ARCHIVED` → "This patient record is archived." with a link to the patient page, where **Restore** is offered to people with `patients.manage`; `422 NOT_A_PRACTITIONER` → under Practitioner, "This practitioner can no longer be booked." and the picker is read again; `400` on `branchId` or `serviceId` → under that field ("no longer active") and its picker is read again; `400` on the times → under the field; `404` → "Something you chose is no longer available." and every picker is read again; anything else through `SaveFailure`. The three new codes get the app's own messages in `src/api/error-messages.ts` (the API says "doctor", the screens say "practitioner", P7-1). | The guide's error table. |
| P9-19 | **Status buttons follow one pure function**, `appointmentActions({ appointment, now, timeZone })`, which returns the buttons to show: **Check in** for `scheduled` on the appointment's own day in the branch's zone; **No-show** for `scheduled` once `startsAt` has passed; **Cancel** for `scheduled` and `checked_in`; **Edit** for a `kind: scheduled` appointment that is `scheduled`. Nothing for `completed`, `cancelled` and `no_show`. `now` ticks every minute on the screen, so No-show appears at the start time without a reload. Each button is a labelled button ("Check in Juan Dela Cruz"), never an icon alone. | The guide's status table: "a hidden button is clearer than an error". |
| P9-20 | **Check in** needs no confirmation. **Cancel** opens a dialog: quick choices ("Patient called to cancel", "Practitioner unavailable", "Booked by mistake") plus **Other reason** with a text field (required, at most 500 characters, trimmed), and the symptoms hint of P9-16. **No-show** asks first ("Mark {patient} as a no-show?" / "This cannot be undone. The time becomes free again."). Each sends the `version` it read and the clinic it was opened in. The answer replaces the appointment in the cache; the day's queries are read again; a toast confirms. | The guide, part C: "No-show and Cancel cannot be undone, so confirm them." |
| P9-21 | **An out-of-date screen recovers by reading again:** `409 VERSION_CONFLICT` and `409 CONFLICT` read the appointment (and the day) again and say, where the action was pressed, "This appointment was changed by someone else. Here is what it shows now." with the new status; nothing is retried by itself. `404` → "We could not find this appointment" and the day is read again. A form keeps what was typed (`VersionConflictNotice`, Phase 6). | The guide: the error carries no version; "let the user decide again". |
| P9-22 | **Edit is a full page** (`/appointments/$appointmentId_/edit`) for a booked, still `scheduled` appointment: the same fields as booking **without Branch, Patient and kind**, which the API refuses to change (the page says "To change the branch or the patient, cancel this appointment and book again."). It opens on a fresh read, sends `version` and **only what changed** (`serviceId` or `reason` `null` to remove; both times together when either changed), and no change sends nothing ("Nothing to change."). A service deactivated since the booking stays chosen and is marked "(no longer offered)". Errors as P9-18 and P9-21. | The guide, part D. |
| P9-23 | **The week view (Q36, decided)** shows Monday to Sunday of one branch (the week holding `from`, in the branch's zone) as **seven day columns, each a list of its appointments in time order** ("9:00 AM – 9:30 AM, Dela Cruz, Juan, Dr. Dan Doctor"), not a time grid with boxes sized by length. It reads every page of `from`/`to` (7 days, under the API's 31) before drawing, with the same practitioner and status filters. **Walk-ins are not listed** in the week; each day shows "{count} walk-ins" instead. On a phone the days are stacked. Previous and next week, and **This week**. | A list per day reads well to a screen reader and at 320 px; walk-ins have no real length (the guide). |
| P9-24 | **A patient's visits** on the patient page (`GET /patients/:patientId/appointments`), shown with `appointments.read`: **Upcoming** (`status=scheduled`) and **History** (every status), newest start first as the API sends them, 20 a page, each with its branch name (`GET /branches`), date and time in that branch's zone, practitioner, service, purpose and status, opening the appointment page. Also for an archived patient. | The guide, part E. |
| P9-25 | **Working hours change (part F):** the line "Booked appointments are not counted yet." on the practitioner page goes, replaced by "Booked appointments are already taken out. Booking outside these hours is allowed." A day with no intervals, whether none are set or all are booked, says "No free working hours on this day". The heading stays "Working hours", never "free slots" (P7-8). | The guide, part F. |
| P9-26 | **Not built here:** a queue or TV display (Phase 11, no API), reminders (backend Phase 6), blocking days for leave or holidays, recurring appointments, undoing a status change, `completed` (reached by signing a consultation, Phase 10), moving an appointment to another branch or patient (cancel and book again), assigning staff to branches (D-9), a printed appointment slip, deleting an appointment (the API has none). | Not in the API, or a later phase. |

## 3. Start condition

- Phases 6, 7.0 to 7.4 and 8 are built (they are).
- `docs/openapi.json` has the eight appointment operations (69 in all; copied from the backend), and 9.0 regenerated `src/api/schema.d.ts` from it (`api:check` passes). D-33 and D-34 are still open in this contract.
- Test data (backend `npm run db:seed:dev`, **run on the day of the test**: the seed books "today" in Asia/Manila): at Sunrise's **Main** branch for `doctor@sunrise.test`, 08:45 walk-in Lourdes Navarro (checked in), 09:00 Juan Dela Cruz ("Annual check-up"), 09:30 Maria Santos, 10:30 José Peña (Follow-up, 15 minutes), 11:00 Angela Reyes (checked in), 11:30 Pedro Bautista (cancelled), and 14:00 **tomorrow** Maria Theresa Santos. In Lakeside, `multi@doctayo.test` has 10:00 today with Liza Mendoza. Whether 09:00 can be marked a no-show depends on the time the test runs, so the e2e specs must not depend on the clock (M6).

## 4. What changes in existing code

| Area | Before this phase | Change (sub-phase) |
| ---- | ----------------- | ------------------ |
| `src/api/schema.d.ts` | 61 operations | Regenerated: 69 (`/appointments*`, `/patients/{patientId}/appointments`, three error codes) (9.0) |
| `src/api/errors.ts`, `error-messages.ts` | No appointment codes | `APPOINTMENT_OVERLAP`, `PATIENT_ARCHIVED`, `NOT_A_PRACTITIONER` in the client's known codes, with "practitioner" wording (P9-18); the "every code has a message" spec covers them (9.0) |
| `features/clinic/api/branches.ts` | Each page works out a branch's zone itself | Adds `branchTimeZone` and `useBranchTimeZone` (P9-2); `useBranch` takes `''` while none is chosen; the practitioner page uses `branchTimeZone` (9.0) |
| `src/lib/datetime/` | Plain dates, UTC ↔ clinic time, wall-clock times | Adds day arithmetic on plain dates (`addDays`, `startOfWeek` with Monday first) and `addMinutes` on an instant; `isSameDayInZone` (9.0) |
| `features/services/duration.ts` | `formatDuration`, one user | Moves to `src/lib/duration.ts` (P9-13) (9.2) |
| `WorkingHours.tsx` | "Booked appointments are not counted yet.", "No working hours on this day" | P9-25; an empty day says "No free working hours on this day" (9.0) |
| Shell navigation | Home, Patients, Practitioners, My schedule, Staff, Clinic | Adds **Appointments** (`appointments.read`) after Home (9.1) |
| `useDirectory`, `usePractitioner`, `patient-name` | Always asked; names need all four parts | `useDirectory` takes `enabled`; `usePractitioner` asks nothing for `''`; a name may come without middle name and suffix (9.1) |
| `src/lib/permissions.ts` | Comment lists the keys routes require | Adds `appointments.read` (9.1) and `appointments.manage` (9.2) |
| Design system `Combobox` | Filters its own options | A server-searched mode (P9-11), with spec and story (9.2) |
| Patient page | Summary, contact, guardian, notes, actions | **Book a visit** (9.2); **Visits** section (9.5) |

## 5. Screens

All text in the English catalogue; lists use `DataTable` and `Pagination`; forms use `FormErrorSummary` + `applyApiErrors`, check every field on each press, keep what was typed on any failure, and render `LeaveGuard`. Every date and time is shown in the branch's zone (P9-2).

### 9.1 Day view and appointment page (M1)

`/appointments` (`GET /appointments?branchId=&date=&practitionerMembershipId=&status=&page=&pageSize=100`, every page, P9-3):

- Heading **Appointments**; under it the branch picker (P9-5), the day as "Mon, Dec 7, 2026" (with "Today" when it is) with **Previous day**, **Today**, **Next day** and a `DatePicker` labelled **Go to a day**. 9.5 adds the link to the week view.
- Filters: Practitioner and **My appointments** (P9-7, only with a profile), both only with `directory.read`; status tabs (P9-6). All in the address. A practitioner in the address who is not in the directory's list shows as "Practitioner not in the list".
- The rows (P9-8); an end on the next day says "(next day)". The number of appointments shown is announced politely. A refresh that fails leaves the list on screen with "We could not refresh this list. It may be out of date." and **Try again**.
- 9.2 adds **Book an appointment** (primary) and **Register a walk-in**; 9.3 adds the row buttons.
- States: loading; "No appointments on this day" (with the filter names when filtered, and **Show all** to clear them); error with request id and **Try again**; no active branch (P9-5).

`/appointments/$appointmentId` (P9-9): every field; the status pill; "Walk-in" when it is one; final statuses say what happened ("Cancelled on Dec 6 at 3:10 PM: Patient called to cancel."). `404` → "We could not find this appointment" with a way back to the day view.

### 9.2 Booking and walk-ins (M2)

`/appointments/new` (P9-10 to P9-18). The address may carry `branch`, `date` and `patient` (an id, never a name) to fill the form; a walk-in is `kind=walk_in`. A day that has passed is replaced by today. The branch is always shown, even in a one-branch clinic. The fields in order: kind, Branch, Patient, Practitioner, Service, then Date, Start, End (with the length in words) and Free working hours for a booked time, then Purpose of visit. **Book appointment** or **Check in walk-in** (one primary button, its label following the kind). The Patient picker's "No patient found" links to registration (Q35). The patient page gains **Book a visit** (with `appointments.manage`, not for an archived patient).

### 9.3 Check in, cancel, no-show (M3)

On each day-view row and on the appointment page: the buttons of P9-19, the dialogs of P9-20 and the recovery of P9-21. While a request runs, its button shows that it is working and cannot be pressed again. Two receptionists pressing Check in at once: one sees the toast, the other sees "This appointment was changed by someone else" and the row already checked in.

### 9.4 Move or edit (M4)

`/appointments/$appointmentId_/edit` (P9-22), from **Edit** on the appointment page and on the row. `200` → the appointment page, toast "Appointment changed." The form keeps the clinic it was opened in.

### 9.5 Week view and a patient's visits (M5)

- `/appointments/week` (P9-23): heading "Week of Dec 7 – 13, 2026", the branch picker and filters of the day view, **Previous week**, **This week**, **Next week**; each day's heading opens that day in the day view. Empty week: "No appointments this week."
- Patient page **Visits** (P9-24): two tabs, **Upcoming** and **History**; "No upcoming visits" / "No visits yet"; error with request id.

## 6. Code layout

```
src/features/appointments/
  api/          appointments.ts (useDayAppointments: every page, P9-3; useWeekAppointments;
                useAppointment; useFreshAppointment; usePatientAppointments; useBookAppointment;
                useRescheduleAppointment; useCheckIn, useCancelAppointment, useMarkNoShow)
  appointment-actions.ts   appointmentActions (P9-19) (+ spec)
  appointment-time.ts      an appointment's time in a zone, shown and spoken (+ spec)
  StatusLabel.tsx          the five statuses as StatusPill
  AppointmentPeople.tsx    patient and practitioner names, linked by permission
  day/          DayViewPage, DayFilters (branch, day, practitioner), DayList (the rows),
                day-search.ts (the address, read by the route)
  week/         WeekViewPage, WeekDay
  record/       AppointmentPage, AppointmentNotFound
  actions/      AppointmentButtons, CancelDialog, NoShowDialog
  form/         BookAppointmentPage (permissions, branches, zone), BookingForm,
                EditAppointmentPage (9.4), PatientPicker, PractitionerPicker, FreeHours,
                appointment-form-values.ts (+ spec: times, limits, proposed end, walk-in body;
                9.4 adds changed fields only)
  PatientVisits.tsx        the Visits section for the patient page
src/routes/_app/_clinic/appointments.tsx        the appointments.read gate
src/routes/_app/_clinic/appointments/  index.tsx, week.tsx, new.tsx, $appointmentId.tsx,
                                       $appointmentId_.edit.tsx
src/lib/datetime/                     + addDays, startOfWeek, addMinutes, isSameDayInZone
src/lib/duration.ts                   formatDuration, moved from features/services (P9-13)
src/lib/use-now.ts                    the time, renewed each minute (+ spec)
tests/e2e/appointments.spec.ts             reads the seeded day; the refusals; cross-clinic
tests/e2e/appointment-booking.spec.ts      every change, in a clinic the spec creates
```

`features/appointments/` is its own folder: consultations (Phase 10) open from a checked-in appointment and will use its api.

## 7. Backend endpoints

All available (backend 5.2 and 5.3):

| Call | Permission | Used by |
| ---- | ---------- | ------- |
| `GET /appointments?branchId=&date=` (and `practitionerMembershipId`, `status`, `page`, `pageSize`) | `appointments.read` | 9.1, 9.3 |
| `GET /appointments?branchId=&from=&to=` | `appointments.read` | 9.5 |
| `GET /appointments/:appointmentId` | `appointments.read` | 9.1, 9.3, 9.4 |
| `POST /appointments` (`Idempotency-Key`) | `appointments.manage` | 9.2 |
| `PATCH /appointments/:appointmentId` | `appointments.manage` | 9.4 |
| `POST /appointments/:appointmentId/check-in`, `/cancel`, `/no-show` | `appointments.manage` | 9.3 |
| `GET /patients/:patientId/appointments` | `appointments.read` | 9.5 |
| `GET /practitioners/:profileId/availability?branchId=&date=` | `directory.read` | 9.0 (Working hours), 9.2 |
| `GET /directory?practitionersOnly=true&branchId=`, `GET /practitioners/:profileId` | `directory.read` | 9.1, 9.2, 9.4 |
| `GET /patients?q=`, `GET /patients/:patientId` | `patients.read` | 9.2 |
| `GET /services?pageSize=100` | `services.read` | 9.2, 9.4 |
| `GET /branches`, `GET /tenant` | `branches.read`, `tenant.read` | branch names and zones |
| `GET /me` (`permissions`, `practitionerProfileId`) | signed in | the navigation, the buttons, My appointments |

A booking form needs `patients.read`, `directory.read` and `services.read` as well as `appointments.manage`; all five default roles hold all of them. A custom role without one of them sees, instead of the form, "You cannot see {patients | practitioners | services}, so you cannot book here." and nothing is asked for (permissions drive the UI, never role names). **Not available, so not built:** P9-26.

## 8. Milestones and their tests (tests first in each)

Every component spec includes axe; every e2e page calls `expectNoAxeViolations`. Specs run in New York time, and the date and time specs also in the Manila pass; branches in the specs use `Asia/Manila` unless a spec says otherwise, so a mistake that uses the computer's zone fails.

### M0: Foundations (9.0)

- `api:check` passes after the regeneration; the existing suite stays green.
- `error-messages.spec.ts`: the three new codes have their own messages and say "practitioner", never "doctor".
- `datetime` specs: `addDays` across a month end, a year end and Feb 29; `startOfWeek` is Monday for every weekday and for a Sunday; `addMinutes` on an instant (30, 480, across midnight UTC and across Manila midnight); `isSameDayInZone` around midnight in Manila while the runner is in New York; `fromClinicDateTime` gives whole minutes (no seconds other than `:00`).
- `useBranchTimeZone` spec: a branch's own zone; `null` falls back to the clinic's; unknown branch gives none; the practitioner page specs stay green on it.
- `appointments.ts` specs: the day hook reads pages of 100 until `totalPages` and keeps the API's order; the key starts with the clinic id and holds branch, date, practitioner and status; the request carries only the filters that are set; a clinic switch never shows the other clinic's appointments; nothing is kept once no screen uses it; `useFreshAppointment` always asks again.
- `WorkingHours.spec.tsx`: the new line (P9-25) and no "not counted yet".

### M1: Day view and appointment page (9.1)

- `routes.spec.tsx`: **Appointments** with `appointments.read`, after Home; without it, no item and "no access" without a request on `/appointments`, `/appointments/week` and an appointment address.
- `DayViewPage.spec.tsx`: today is the branch's today (runner in New York, branch in Manila, just after Manila midnight); previous, next and a picked day; the branch picker starts on the remembered branch, ignores an unknown one, and is absent for a one-branch clinic; no active branch; practitioner filter and status tabs in the address and the request (each tab's `status` value exactly); a bad address value is dropped and never sent; **My appointments** only with a profile and sends that profile's `membershipId`; rows for a booked appointment, a walk-in ("Arrived", no end), no service, a cancelled one; status as icon and word; patient link only with `patients.read`; never a patient name in the tab title; loading, empty (filtered and not), error with request id; a view of today moves to the next day at the branch's midnight; refreshes after 60 seconds (fake timers) and not while hidden.
- `AppointmentPage.spec.tsx`: every field; a walk-in's estimated end; cancelled time and reason; `404`.

### M2: Booking and walk-ins (9.2)

- `combobox` design-system spec and story: the server-searched mode does no filtering, reports the typed text, announces loading and the number of results, and still works by keyboard alone; the existing mode is unchanged.
- `appointment-form-values.spec.ts`: a booked time to the request body with `+08:00`-equivalent instants built in the branch's zone (runner in New York); the walk-in body has no `startsAt` or `endsAt`; the proposed end follows the service until End is typed, 30 minutes without a service; end before start, exactly 8 hours (allowed) and 8 hours 5 minutes (refused), an end already past, a start 366 days ahead (allowed) and 367 (refused), across midnight with **Ends the next day**; purpose of visit 200 and 201 characters, blank sent as `null`; no service sent as `null`.
- `BookAppointmentPage.spec.tsx`: the fields per kind; the address fills branch, date and patient; the patient search waits 250 ms, hides archived patients and never puts the typed text in the address; practitioners who work at the branch come first and the others are still offered; free working hours fill Start; the request carries the `Idempotency-Key` and the opened clinic; a double press sends one request; a retry after a network failure reuses the key; changed values after an error use a new key; `201` → the appointment page and the toast (both kinds); `APPOINTMENT_OVERLAP` keeps every field and reads the day and the free hours again; `PATIENT_ARCHIVED` links to the patient page; `NOT_A_PRACTITIONER` under Practitioner and the picker read again; `400` on `branchId`, `serviceId` and the times under their fields; `404`; what was typed survives a clinic switch in another tab; leaving with typed input asks; a role without `services.read` sees the picker's reason.
- `PatientPage.spec.tsx`: **Book a visit** with `appointments.manage`, not for an archived patient, opens the form with the patient.
- `routes.spec.tsx`: `/appointments/new` without `appointments.manage` shows "no access"; the day view's two buttons only with it.

### M3: Check in, cancel, no-show (9.3)

- `appointment-actions.spec.ts` (written first): every status × kind; Check in only on the appointment's day in the branch's zone (yesterday, today, tomorrow, and an appointment at 23:30 Manila seen from New York); No-show one minute before and at `startsAt`; Edit never for a walk-in; nothing for final statuses.
- `AppointmentButtons.spec.tsx`: the buttons named with the patient; No-show appears when the minute ticks past the start (fake timers); Check in sends `{ version }` with no dialog; the answer replaces the row; `VERSION_CONFLICT` and `CONFLICT` read the appointment again and show the notice with the new status; `404`; a second press while running sends nothing.
- `CancelDialog.spec.tsx`: a reason is required; each quick choice sends its text; **Other reason** at 500 and 501 characters, trimmed; the symptoms hint; Escape cancels and focus returns to **Cancel appointment**.
- `NoShowDialog.spec.tsx`: asks with the patient's name, focuses **Go back**, sends `{ version }`.

### M4: Move or edit (9.4)

- `EditAppointmentPage.spec.tsx`: opens on a fresh read; no Branch, Patient or kind; only changed fields with `version`; both times when one changed; `null` to remove the service or the purpose; "Nothing to change."; a deactivated service stays chosen and marked; `APPOINTMENT_OVERLAP`, `NOT_A_PRACTITIONER`, `PATIENT_ARCHIVED` as in M2; `VERSION_CONFLICT` keeps the typed values and shows `VersionConflictNotice`; a walk-in's or a non-scheduled appointment's edit address says it cannot be changed and sends nothing; the opened clinic is sent.
- `routes.spec.tsx`: the edit address without `appointments.manage` shows "no access".

### M5: Week view and a patient's visits (9.5)

- `WeekViewPage.spec.tsx`: the week is Monday to Sunday in the branch's zone (a Sunday evening in Manila seen from New York belongs to that week); `from`/`to` in the request; every page read before drawing; walk-ins counted, not listed; each day in time order; an appointment from 23:30 to 00:30 only on its first day; previous, next and this week; a bad `from` is dropped; at 360 px the days are stacked.
- `PatientVisits.spec.tsx`: hidden without `appointments.read`; Upcoming sends `status=scheduled`, History none; branch names and each branch's zone; pagination; an archived patient's visits still shown; empty and error states; `404` on the patient leaves the page's own "not found".

### M6: End-to-end (real API, after M0–M5)

Chromium, serial, in two files. `tests/e2e/appointments.spec.ts` only **reads** Sunrise's seeded day (items 1, 2, 7, 8); `tests/e2e/appointment-booking.spec.ts` makes every change in an **e2e clinic created through the platform admin** (as `practitioner-management.spec.ts` does: a branch, the owner as a practitioner with hours, a registered patient), never in Sunrise (items 3 to 6). Appointments cannot be deleted, so each run leaves one e2e clinic with its appointments. The seed must have run today; no assertion depends on the time of day (an appointment created for a time already past or still to come is booked by the spec itself).

1. Receptionist in Sunrise: **Appointments** opens today at Main with the seeded rows in order, the walk-in first and without an end, the cancelled one only under **All** and **Cancelled and no-show**; the practitioner filter and **Checked in** tab; tomorrow's appointment on the next day has no **Check in**.
2. `doctor@sunrise.test`: **My appointments** shows only their own.
3. The e2e clinic: book a time (the end proposed from a service), the same practitioner and time again from a second tab → overlap handled without losing the form; book back-to-back (allowed); a double press creates one appointment (the day shows one); register a walk-in and see it checked in.
4. Check in today's appointment; cancel one with a quick reason; check in from a stale second tab → the notice and the current state.
5. Move an appointment to another time and another practitioner; edit from a stale tab → `VERSION_CONFLICT` handled.
6. The week view shows the e2e appointments; the patient page lists them under Upcoming and History; a practitioner's Working hours leave out the booked time.
7. Cross-clinic: a Sunrise appointment's address opened as Lakeside's owner → "We could not find this appointment"; a direct `POST /appointments` with Lakeside's token and Sunrise's branch answers `404`.
8. axe on every appointments page at 1280 px and 360 px; no sideways scrolling.

## 9. Acceptance criteria

- Every milestone's specs pass (New York and Manila runs), plus lint, format check, typecheck, `api:check`, `tokens:check`, `i18n:extract` with no missing message, `build`. Each new route chunk stays under 100 kB gzip.
- The M6 e2e passes against the real API on Chromium (Firefox and WebKit in Docker).
- No time is built or shown in the computer's zone; no button is shown that the status table forbids; no screen calls working hours free slots; no patient name is in a browser tab title or an address.
- `plan.md` (§0, §3, §5.2, §5.5, §10, §12, §15), this plan's "As Built", plan 07's note on appointments, and `AGENTS.md` (if a pattern is added) match the code.

## 10. Accessibility and UX notes

- One primary action per screen: **Book an appointment** on the day view; **Book appointment** / **Check in walk-in** on the form; **Edit** on a scheduled appointment's page (none on a final one).
- Status is an icon and a word; a walk-in is marked in words; times read as words ("9:00 AM to 9:30 AM").
- Row buttons are named with the patient ("Check in Juan Dela Cruz") so a screen-reader user hears which row they act on.
- The day and week toolbars are reachable by keyboard in order (branch, day, filters, tabs); the status tabs are real tabs.
- Dialogs use `useReturnFocus`; destructive ones (No-show) focus the safe choice.
- Works at 320 px: on a phone the day's rows are cards (`DataTable`'s `auto` layout) and the week's days are stacked.

## 11. Open questions

Decided by the product owner (2026-11-27): the default of each.

- **Q33:** Where does **Appointments** go in the navigation? **After Home, before Patients**; Home stays as it is (its "Today at a glance" is not wired to appointments in this phase).
- **Q34:** One booking form with **Booked time / Walk-in** at the top or a separate short walk-in dialog on the day view? **One form.**
- **Q35:** When the patient is not registered yet, is a link to **Register a patient** enough (the person comes back to booking afterwards), or should registration open inside the booking form? **A link.**
- **Q36:** Week view as **seven day lists** (P9-23) or a time grid with boxes sized by length? **Day lists.** A grid is harder to use with a screen reader and on a phone.

Backend request: **D-35** (optional, P9-7): `GET /me` → the signed-in member's `membershipId`.

## As Built

### 9.0 Foundations (2026-11-27)

Built as planned (P9-2, P9-3's reading, P9-18's messages, P9-25, and the tests of M0), with these differences, which the plan body above already describes or which are recorded here:

- **Two zone helpers, not one:** `branchTimeZone({ branch, clinicZone })` for lists of branches (a hook cannot be called per row) and `useBranchTimeZone(branchId)` on top of it. The practitioner page uses the first. Neither guesses: an unknown branch has no zone.
- **Only the read hooks the M0 specs name:** `useDayAppointments`, `useAppointment` and `useFreshAppointment`. `useWeekAppointments` and `usePatientAppointments` come with 9.5, the mutations with 9.2 to 9.4.
- **The day is read all or nothing:** if a later page fails, the whole query fails, so half a day is never shown as the day.
- **"No working hours on this day" became "No free working hours on this day"** (not in the approved text of P9-25): since booked time is taken out, a fully booked day has no intervals, and the old sentence would have said the practitioner does not work that day.
- **`src/api/errors.ts`** needed the three codes too (the compiler requires the list to match the contract; without them they would read as unknown).
- **No screen is new**; the only visible change is the practitioner page's two sentences.
- **Files:** `src/api/` (`schema.d.ts`, `errors.ts`, `error-messages.ts`), `src/lib/datetime/` (`addDays`, `startOfWeek` in `plain-date.ts`; `addMinutes`, `isSameDayInZone` in `index.ts`), `features/clinic/api/branches.ts`, `features/appointments/api/appointments.ts`, `features/practitioners/record/` (`PractitionerPage`, `WorkingHours`), `features/practitioners/api/practitioners.ts` (comment), `tests/e2e/practitioners.spec.ts` (the new texts), the message catalogues.

Verified (2026-11-27): the new specs failed first for the expected reason; 128 Vitest files, 1956 specs pass (New York) and the Manila pass (`src/lib`, `src/test`, the practitioners, appointments and clinic); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass. `size` still fails as before: startup JavaScript 229.1 kB gzip (budget 170 kB; 228.8 after 8.2).

Not verified: nothing was run against the real API (it was not running), including the updated `tests/e2e/practitioners.spec.ts`.

### 9.1 Day view and appointment page (2026-11-28)

Built as planned (P9-1's read routes, P9-2, P9-4 to P9-9, the screens of §5 and the tests of M1), with these differences, which the plan body above already describes or which are recorded here:

- **Left for later sub-phases:** **Book an appointment**, **Register a walk-in** (9.2), the status buttons (9.3), **Edit** (9.4) and the link to the week view (9.5). Until 9.5, `/appointments/week` is read as an appointment id and shows "We could not find this appointment".
- **No page in the address:** the day is shown whole.
- **Refresh (P9-4):** the day query reads every 60 seconds (React Query pauses it while the window is hidden) and on focus. The appointment page does not refresh on a timer.
- **"Today"** follows the branch through `useNow` (`src/lib/use-now.ts`), renewed at each minute.
- **My appointments** is a toggle button (pressed, with a tick). It appears once the person's profile is read; if that read fails there is no button and no message.
- **My branches first** reorders the picker only: the branch on screen does not change when the profile arrives.
- **Accessible names:** a row's time link is named in words with the patient ("9:00 AM to 9:30 AM, Juan Dela Cruz").
- **The appointment page** reads its branch and the clinic zone first and shows no time until the zone is known. Its **All appointments** link opens the appointment's branch and day.
- **Startup JavaScript:** the route reads the address rules from `day-search.ts`, so the page stays in its own chunk.

Verified (2026-11-28): the new specs failed first (missing modules and routes); 133 Vitest files, 2013 specs pass (New York) and the Manila pass (454 for `src/lib`, `src/test`, appointments, practitioners and clinic); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass; every string is in the catalogue. The appointments chunks are about 4.4 kB and 1.6 kB gzip. `size` still fails: startup JavaScript 234.1 kB gzip (229.1 after 9.0; budget 170 kB).

Not verified: anything against the real API or in a real browser (the API was not running), so no layout, 360 px, contrast-in-place or CSP check; the end-to-end items are M6; manual screen-reader and zoom checks.

### 9.2 Booking and walk-ins (2026-11-28)

Built as planned (P9-10 to P9-18, the screen of §5 and the tests of M2), with these differences, which the plan body above already describes or which are recorded here:

- **Without a needed permission the whole form is replaced** by the reasons (not only the one picker), so nothing is asked for.
- **After a taken time** the free hours are read again and the appointment queries are marked stale; the form shows no day list, so there is nothing else to read there.
- **Refused choices are cleared** so the next press cannot repeat them: the practitioner (`NOT_A_PRACTITIONER`), the branch and the service (`400`). Each says why under its field.
- **The practitioner picker is the plain select with two headings** (`SelectField` gained `groups`), not a searchable list.
- **366 days:** refused when the date is later than today plus 366 days, or the start is more than 366 × 24 hours away (the guide does not say which the API counts).
- **Purpose of visit** is a one-line field with no hard length stop; 201 characters are refused on Save.
- **A clinic switched in another tab:** the form keeps its branches, zone, practitioners, services and permissions (`useKeptForClinic`, new in `src/lib/opened-clinic.tsx`), searches patients only in its own clinic, and hides the free hours and any read failure of the other clinic.
- **Leaving asks** once anything was entered, even if it was changed back.
- **Design system:** `Combobox` has the server-searched mode and now says "1 result", not "1 results"; `SelectField` has `groups`; `DateField` takes a `name` for the error summary.
- **Other changes:** `formatDuration` moved to `src/lib/duration.ts`; `usePatientSearch` and `usePatientOfForm` in the patients api; `useBookAppointment`; **Book a visit** on the patient page; the two buttons on the day view.
- **Files:** `features/appointments/form/` (`BookAppointmentPage`, `BookingForm`, `PatientPicker`, `PractitionerPicker`, `FreeHours`, `appointment-form-values.ts`), `features/appointments/api/appointments.ts`, `day/DayViewPage.tsx`, `features/patients/` (`api/patients.ts`, `record/PatientPage.tsx`), route `_clinic/appointments/new.tsx`, `design-system/components/` (`select-fields`, `date-fields`), `src/lib/` (`duration.ts`, `opened-clinic.tsx`, `permissions.ts`).

Verified (2026-11-28): the new specs failed first for the expected reason; 135 Vitest files, 2098 specs pass (New York) and the Manila pass (774 for `src/lib`, `src/test`, appointments, practitioners, clinic, patients and services); lint, format check, typecheck, `api:check`, `tokens:check`, `build` and `storybook:build` pass; every string is in the catalogue. The booking route's chunk is about 5.4 kB gzip. `size` still fails: startup JavaScript 237.0 kB gzip (234.1 after 9.1; budget 170 kB).

A temporary Chromium check of the built app **with faked API answers** (not committed) passed on the day view, patient picker, booking form and appointment page at 1280 px and 360 px: axe, no Content-Security-Policy violation, no sideways scrolling (not measured with the picker open), and a booking reaching the appointment page.

Not verified: anything against the real API (it was not running), so not the server's own refusals, the idempotency replay or the seeded data; walk-in and error states in a browser; Firefox and WebKit; manual screen-reader (the server-searched Combobox included) and zoom checks. The end-to-end items are M6.
