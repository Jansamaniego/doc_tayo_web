# Phase 12: Patient portal (outline)

Status: **outline**. Backend: **future, not available** (D-24). **Same app or separate: decided at the start of this phase** (owner's answer to Q3, 2026-11-20). Until then, the design system and API layer stay free of staff-app assumptions, so both options remain possible.

## Objectives

Patients and guardians view their appointments and own records. One account may manage several patients (for example a parent for their children).

## Input for the Q3 decision (to be taken at the start of this phase)

A **separate app (separate build and deployment) in the same repository**, sharing the design system and API layer:
- different audience and threat model (public sign-up, more account-recovery traffic);
- a different token type (D-24);
- mobile-first layouts;
- no staff code or staff routes shipped to patients;
- it can have its own language defaults (Filipino is needed, Q4).

## Deliverables (outline)

- Patient sign-in and account recovery.
- "Who are you managing?" switcher (self, dependants), similar to the clinic switcher.
- Upcoming and past appointments; booking or requests if the backend supports them.
- Released records (what is visible to patients is a clinical and legal decision).
- Extra-large-text defaults and the simplest wording, for senior patients.

## Backend endpoints

All needed, none exist (D-24).

## Tests (outline)

Guardian can only see linked dependants; a patient cannot see another's data (security e2e); mobile accessibility audit; senior user testing.

## Open questions

Q3 (same app or separate, decided at the start of this phase); consent and age rules for guardians; which records are released to patients.
