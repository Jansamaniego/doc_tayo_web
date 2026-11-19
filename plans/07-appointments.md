# Phase 7: Appointments and scheduling (outline)

Status: **outline**. Backend: **backend Phase 5, not available** (D-13, D-9).

## Objectives

Day and week views per doctor and branch; book, reschedule, cancel, check in and mark no-show; a "Today at my branch" view for reception. Double bookings are refused by the API and explained clearly.

## Deliverables (outline)

- **Today at my branch** (reception home): timeline/list of today's appointments with large status pills and "Check in", plus a walk-in entry (feeds Phase 9).
- **Doctor schedule:**
  - day (default on mobile) and week (tablet/desktop) views;
  - filter by doctor and branch;
  - all times in the branch time zone.
- **Booking flow:** patient (search from Phase 6) → doctor → date → available time slot → reason (optional; never shown on shared screens) → confirm. Uses `Idempotency-Key` (already allowed by the API's CORS) to avoid double booking on retries, if the backend supports it.
- **Reschedule, cancel** (confirm with consequence), **no-show**.
- **Double booking refused:** a clear message and the nearest free slots, if the API offers them.
- The calendar is keyboard-accessible: a list alternative to the grid view is always available.

## Backend endpoints

All needed, none exist (D-13): appointment CRUD and state changes, availability and doctor schedules, a double-booking error code, practitioner and branch assignment (D-9).

## Tests (outline)

Time-zone correctness (device in another zone), double-booking error handling, state transitions, keyboard use of day and week views, permission variants (doctor sees own schedule, reception sees branch), cross-clinic isolation.

## Open questions

Slot length per doctor; whether patients can book themselves (portal); recurring appointments.
