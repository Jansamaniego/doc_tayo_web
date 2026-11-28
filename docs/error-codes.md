# API Error Codes

Every non-2xx response uses one shape:

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_FAILED",
    "message": "Some fields need attention.",
    "details": [
      { "field": "email", "code": "INVALID_FORMAT", "message": "This value is not in the expected format." }
    ],
    "requestId": "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b"
  }
}
```

- `code` is stable and machine-readable. Clients should branch on `code`, never on `message`.
- `message` is plain-language fallback text; the frontend may replace it using `code`.
- `details` appears only for validation errors. `field` is a dotted path (`address.city`, `items[0].id`).
- `requestId` equals the `X-Request-Id` response header; quote it when reporting a problem.
- Codes are **append-only**. Renaming or repurposing a code is a breaking change.
- Responses never contain stack traces, SQL, Prisma details, hostnames or credentials.
- Source of truth: `src/common/errors/error-codes.ts` (a unit test keeps this file in sync).

## Error codes

| Code | HTTP | Default message |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Some fields need attention. |
| `BAD_REQUEST` | 400 | The request could not be understood. |
| `MALFORMED_JSON` | 400 | The request body is not valid JSON. |
| `PAYLOAD_TOO_LARGE` | 413 | The request is too large. |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | The request content type is not supported. |
| `ROUTE_NOT_FOUND` | 404 | The requested address does not exist. |
| `NOT_FOUND` | 404 | We could not find what you were looking for. |
| `CONFLICT_UNIQUE` | 409 | This record already exists. |
| `CONFLICT_REFERENCE` | 409 | This record is linked to other information and cannot be changed this way. |
| `NOT_READY` | 503 | The service is not ready yet. Please try again shortly. |
| `SERVICE_UNAVAILABLE` | 503 | The service is temporarily unavailable. Please try again shortly. |
| `INTERNAL_ERROR` | 500 | Something went wrong on our side. Please try again. |
| `UNAUTHENTICATED` | 401 | Please sign in to continue. |
| `FORBIDDEN` | 403 | You do not have permission to do this. |
| `TENANT_NOT_SELECTED` | 403 | Please choose a clinic to continue. |
| `TENANT_SUSPENDED` | 403 | This clinic's access is currently suspended. |
| `TENANT_DEACTIVATED` | 403 | This clinic is no longer active. |
| `TENANT_ACCESS_DENIED` | 403 | You do not have access to this clinic. |
| `INVALID_CREDENTIALS` | 401 | The email or password is incorrect. |
| `ACCESS_TOKEN_EXPIRED` | 401 | Your session needs to be refreshed. |
| `TOKEN_INVALID` | 400 | This link is invalid or has expired. Please request a new one. |
| `ROLE_NOT_ASSIGNABLE` | 422 | This role cannot be given through an invitation. |
| `LAST_OWNER` | 409 | A clinic must always keep at least one active owner. |
| `OWNER_REQUIRED` | 403 | Only an owner can change owners or the owner role. |
| `SELF_ACTION_FORBIDDEN` | 403 | You cannot change your own membership this way. |
| `VERSION_CONFLICT` | 409 | This record was changed by someone else. Please reload it and try again. |
| `TENANT_MISMATCH` | 409 | This page is showing a different clinic than your current one. Please reload the page. |
| `IDEMPOTENCY_KEY_REUSED` | 422 | This request was already sent with different details. Please start again. |
| `IDEMPOTENCY_KEY_IN_USE` | 409 | This request is still being processed. Please wait a moment and try again. |
| `IDEMPOTENCY_KEY_INVALID` | 400 | The request key is not valid. |

`INVALID_CREDENTIALS` is the single answer for an unknown email, a wrong password, and a `pending` or `deactivated` account, so responses never reveal which accounts exist. `ACCESS_TOKEN_EXPIRED` tells the client to call `POST /auth/refresh`; every other token failure is `UNAUTHENTICATED`. `TOKEN_INVALID` covers every emailed-link failure (unknown, expired, used, revoked or replaced token). `LAST_OWNER`, `OWNER_REQUIRED` and `SELF_ACTION_FORBIDDEN` come from member administration (`/members`): a change that would leave no active owner, a non-owner touching the owner role or an owner's membership, and acting on your own membership.

**Phase 5.0 codes.** `VERSION_CONFLICT`: a write carried an out-of-date `version` (optimistic locking, produced by every versioned resource from sub-phase 5.1); reload the record, merge, and send again. The body does not carry the current version. `TENANT_MISMATCH`: the optional `X-Expected-Tenant-Id` header named a clinic other than the session's active clinic (another tab switched clinics); nothing was done, reload the page. The three `IDEMPOTENCY_KEY_*` codes belong to the `Idempotency-Key` header (see [api-conventions.md](api-conventions.md)): `_REUSED` means the same key was used with a different request, `_IN_USE` means the first request with that key is still running (`Retry-After` says when to ask again), `_INVALID` means the key is not 1 to 255 printable ASCII characters. Only successful outcomes are remembered, so a request that failed is simply sent again with the same key and gets its real answer.

**Phase 5.3 codes (appointments).** `APPOINTMENT_OVERLAP`: the practitioner already has an appointment that overlaps the requested time (the database refuses it, also when two people book at the same moment); offer another time. `PATIENT_ARCHIVED`: booking or rescheduling for an archived patient; restore the patient first. `NOT_A_PRACTITIONER`: the chosen member has no active practitioner profile or is not an active member. A transition that the appointment's state does not allow is `CONFLICT`.

| Code | HTTP | Default message |
|---|---|---|
| `APPOINTMENT_OVERLAP` | 409 | The doctor already has an appointment at that time. Please choose another time. |
| `PATIENT_ARCHIVED` | 409 | This patient record is archived. Restore it before booking a visit. |
| `NOT_A_PRACTITIONER` | 422 | This staff member cannot be booked for appointments. |

## Reserved codes

Cataloged so the contract is stable. `CONFLICT` is produced by `TenantLifecycleService` (invalid tenant status transition), by invitations (inviting someone who is already a member; resending an accepted or revoked invitation) and by appointments (a transition or reschedule the current status does not allow). `METHOD_NOT_ALLOWED` is only mapped from framework 405 exceptions (`to-api-error.ts`). `RATE_LIMITED` comes from the throttler (mapped from its 429) and from account lockout (a `DomainError`); both send a `Retry-After` header. `UNAUTHENTICATED` and `FORBIDDEN` are active since Phase 2.

| Code | HTTP | Default message |
|---|---|---|
| `CONFLICT` | 409 | This action conflicts with the current state of the record. |
| `METHOD_NOT_ALLOWED` | 405 | This action is not allowed on this address. |
| `RATE_LIMITED` | 429 | Too many attempts. Please wait a moment and try again. |

## Field-level codes (`details[].code`)

| Code | Message |
|---|---|
| `REQUIRED` | Please fill in this field. |
| `INVALID_FORMAT` | This value is not in the expected format. |
| `INVALID_TYPE` | This value is not the expected type. |
| `INVALID_VALUE` | This value is not allowed. |
| `OUT_OF_RANGE` | This value is outside the allowed range. |
| `TOO_SHORT` | This value is too short. |
| `TOO_LONG` | This value is too long. |
| `UNKNOWN_FIELD` | This field is not accepted. |
| `PASSWORD_TOO_COMMON` | This password is too easy to guess. Please choose another. |
| `PASSWORD_CONTAINS_EMAIL` | The password must not contain your email address. |
| `PASSWORD_INCORRECT` | The password is incorrect. |
