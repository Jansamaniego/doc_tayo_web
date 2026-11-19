# Phase 8: Consultations and medical records (outline)

Status: **outline**. Backend: **backend Phase 5, not available** (D-15).

## Objectives

Visit notes, vital signs, diagnoses (ICD-10 search), prescriptions with a printable layout, and finalising. Finalised records cannot be edited, only amended, and the UI shows the amendment history.

## Deliverables (outline)

- **Consultation screen** (doctor, desktop and tablet; readable on mobile):
  - patient header;
  - vitals (nurse or doctor; units shown; out-of-range values flagged with icon + text, not colour alone);
  - notes, diagnoses, prescriptions.
- **Autosave to the server** as a draft (D-15). Never stored on the device. Visible "Saved 2:41 PM" status. On a network failure, the text stays on screen with a clear "Not saved yet" warning.
- **ICD-10 search:** combobox by code or words (D-15 code search).
- **Prescriptions:** drug, dose, frequency, duration, quantity, instructions; a **printable template** (print primitives from Phase 2). Required fields such as generic names, the doctor's licence and PTR numbers and S2 numbers, and the paper size, are **not decided here**: they wait for confirmation by a doctor (Q15b). The template keeps those fields configurable until then.
- **Finalise:** confirmation ("After finalising, changes are made as amendments and the original is kept").
- **Amendments:** finalised records are read-only. "Add amendment" records the reason. A history timeline shows who, when, what changed and why; the original is always viewable.
- Past visits list on the patient profile.

## Backend endpoints

All needed, none exist (D-15): encounters, drafts, vitals, ICD-10 search dataset, prescriptions, finalise, amendments with history, permissions (clinical data restricted to clinical roles).

## Tests (outline)

Draft autosave and failure display, finalise locks editing (UI and API 409/422 handling), amendment history rendering, print layout (Playwright PDF snapshot), clinical data not visible to non-clinical roles, no clinical data in storage.

## Open questions

Q15b (prescription rules, to be confirmed by a doctor; this plan gives no legal advice); structured versus free-text notes (SOAP?); e-signature.
