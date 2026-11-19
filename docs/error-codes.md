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

`INVALID_CREDENTIALS` is the single answer for an unknown email, a wrong password, and a `pending` or `deactivated` account, so responses never reveal which accounts exist. `ACCESS_TOKEN_EXPIRED` tells the client to call `POST /auth/refresh`; every other token failure is `UNAUTHENTICATED`. `TOKEN_INVALID` covers every emailed-link failure (unknown, expired, used, revoked or replaced token).

## Reserved codes

Cataloged so the contract is stable. `CONFLICT` is produced by `TenantLifecycleService` (invalid tenant status transition) and by invitations (inviting someone who is already a member; resending an accepted or revoked invitation). `METHOD_NOT_ALLOWED` is only mapped from framework 405 exceptions (`to-api-error.ts`). `RATE_LIMITED` comes from the throttler (mapped from its 429) and from account lockout (a `DomainError`); both send a `Retry-After` header. `UNAUTHENTICATED` and `FORBIDDEN` are active since Phase 2.

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
