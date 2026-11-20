# Phase 11: Notifications, reports and audit (outline)

Status: **outline**. Backend: **backend Phase 6, not available** (D-17).

## Objectives

- Appointment reminders (email first, SMS later).
- Daily appointment and revenue reports by branch and period.
- An audit log viewer for clinic admins.

## Deliverables (outline)

- **Reminder settings** (clinic admin): on/off, how long before, the message preview (template variables shown in plain words), channel (email; SMS when available).
- **Reports:**
  - date range picker (in the clinic time zone), branch filter;
  - appointments (booked, completed, no-show, cancelled) and revenue tables, with **charts that always have a table alternative** and labels rather than colour alone;
  - CSV export if the API provides it;
  - printable view.
- **Audit log viewer:** filter by date, person and action; events in plain words ("Ana Cruz signed in", "Branch 'Main' edited"); `requestId` for support. Read-only.

## Backend endpoints

All needed, none exist (D-17): reminder settings, report endpoints, audit log read endpoint. The backend already _writes_ audit events (`auth.login`, `invitation.created`, …; see docs/authentication.md), but has no read endpoint.

## Tests (outline)

Time-zone correctness of report ranges (midnight Manila), empty periods, large numbers, accessible charts (table alternative present), audit filters, permission (admins only).

## Open questions

Which reports matter most to owners; SMS provider and cost; data retention shown to admins.
