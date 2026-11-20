# Phase 5: Platform administration console (outline)

Status: **outline**. Backend: **backend Phase 4, not available** (D-10). Moved earlier than in the brief because no clinic can be created over HTTP until this exists (plan.md §3). The owner decided (Q6) it is a **separate deployment, built later**.

## Objectives

An internal console for DocTayo operators:

- create clinics (with the owner setup invite);
- list and search clinics;
- suspend or reactivate clinics;
- manage user status.

It has **no access to clinical data** by design.

## Deliverables (outline)

- A **separate deployment** (decided, Q6): its own build entry in this repository, sharing the design system, hosted separately (for example `admin.doctayo.<tld>`; exact host to decide when the phase starts). No clinic-app routes in the admin bundle, and vice versa.
- Operator sign-in (mechanism per D-10; may need MFA, to be raised with the backend).
- Clinics list and detail, create-clinic flow (name, time zone, owner email → the setup email is sent by the API).
- Suspend/reactivate with typed confirmation (an operator-only exception to the plain-confirmation rule).
- User status management.
- Operator audit trail view (if the backend exposes it).

## Backend endpoints

All needed, none exist: D-10 (platform-admin API and operator auth).

## Tests (outline)

- E2E: create a clinic → the setup link works in the clinic app (Phase 3 page); a suspended clinic shows `TENANT_SUSPENDED` handling in the clinic app.
- A security test: the operator token is refused by clinic endpoints, and clinic tokens by admin endpoints.

## Open questions

Admin host name; operator MFA; who are the operators and how are they provisioned.
