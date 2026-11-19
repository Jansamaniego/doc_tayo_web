# Phase 6: Patients (outline)

Status: **outline**. Backend: **backend Phase 5, not available** (D-11).

## Objectives

Register, find quickly (typo-tolerant), view, edit and archive patients, each with a clinic-specific patient number.

## Deliverables (outline)

- **Patient search** as the entry point at reception:
  - one search field (name, patient number, phone);
  - results as cards/table with patient number, name, age, last visit;
  - names never in the URL (design system §7.4).
- **Register patient:**
  - short form first (name, birth date, sex, phone), then optional details;
  - possible-duplicate warning ("A patient with a similar name and birth date exists") if the API offers it;
  - Senior Citizen / PWD ID fields if billing needs them (D-16).
- **Patient profile:** summary header (number, name, age), tabs for details, appointments (Phase 7), records (Phase 8), billing (Phase 10).
- **Edit; archive** (confirmation, explains what archiving means; restore if the API allows).
- Guardian/dependant fields only once D-24 exists.

## Backend endpoints

All needed, none exist (D-11): create, get, update, archive, search with pagination, patient number, duplicate check, permissions (for example `patients.read`, `patients.manage`).

## Tests (outline)

Search behaviour (debounce, empty, typos handled by the server), registration validation, duplicate warning, archive confirmation, permission views, **cross-clinic: a patient id from another clinic shows not-found**, no patient data in storage or URL (e2e assertion).

## Open questions

Required fields for PH clinics (middle name, suffix, PhilHealth number?); patient number format; what archive means for appointments.
