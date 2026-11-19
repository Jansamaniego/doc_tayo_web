# API conventions

Reference form of `plan.md` §7 for what exists through Phase 3.

- **Base path**: `/api`, URI versioning, default version `v1` → business routes are `/api/v1/<resource>`. Health is version-neutral: `/api/health`, `/api/health/ready`. Swagger UI: `/api/docs` (JSON: `/api/docs-json`), non-production only by default.
- **Unmatched routes** anywhere return the standard error (`ROUTE_NOT_FOUND`).
- **JSON**, `camelCase`, UUID ids, ISO-8601 UTC timestamps. Request bodies are limited to 1 MB.
- **Validation**: DTOs with `class-validator`/`class-transformer`. Global pipe: unknown properties are rejected (`UNKNOWN_FIELD`), types are never silently coerced (`@Type()` explicitly where needed). Failures return `VALIDATION_FAILED` with `details[]`.
- **Success shapes**: controllers return explicit `{ data }` / `{ data, meta }` (`src/common/dto/api-response.ts`). There is no global response-wrapping interceptor (ADR-0005).
- **Errors**: one shape for every failure, see [error-codes.md](error-codes.md). Services throw `DomainError(code)`; never put values (names, ids of people, query text) in error messages.
- **Contract**: [openapi.json](openapi.json) is the generated, committed OpenAPI document (regenerate with `npm run openapi:export`). It declares the `bearer` scheme, marks `@Public()` operations with `security: []`, and gives every 4xx/5xx response the `ErrorResponse` schema (all of this is applied by `finishOpenApiDocument`, `src/common/http/openapi.ts`; nullable fields need an explicit `type`, or a generated client types them as `object`); [frontend-integration.md](frontend-integration.md) explains how to use the API.
- **Request id**: every response has `X-Request-Id`. A client-sent `X-Request-Id` is honored only if it is a canonical UUID; otherwise a new one is generated. The same id appears in the error body and the logs.
- **Status codes**: 200/201/202/204 success; 400 validation or malformed; 401 not authenticated (`UNAUTHENTICATED`; `ACCESS_TOKEN_EXPIRED` tells the client to refresh; `INVALID_CREDENTIALS` for a failed login); 403 not permitted or tenant not usable (`FORBIDDEN`, `TENANT_*`); 404 not found (also used for other tenants' records); 409 conflict; 413/415 body problems; 422 business rule; 429 rate limited or account locked (`RATE_LIMITED`, with `Retry-After`); 500/503 server.
- **Authentication**: `Authorization: Bearer <access token>` for every non-public route; the refresh token lives only in the httpOnly `dt_refresh` cookie (see [authentication.md](authentication.md)). Tokens are never accepted from a query string. `/api/v1/auth/*` and `/api/v1/me*` responses are `Cache-Control: no-store`.
- **CORS**: exact-origin allow list from `CORS_ALLOWED_ORIGINS` (`CORS_ALLOW_CREDENTIALS=true` for the refresh cookie); allowed headers `Content-Type, Authorization, X-Request-Id, Idempotency-Key`; `X-Request-Id` and `Retry-After` are exposed to browsers.

## Adding an endpoint (checklist)

1. Controller under `src/modules/<domain>/`, thin; logic in a service.
2. DTOs with `class-validator` + `@ApiProperty`; explicit response DTO/mapper (never return Prisma entities).
3. `@ApiTags`, documented success and error responses.
4. Throw `DomainError` for business rules; add new codes to `error-codes.ts` **and** `docs/error-codes.md`.
5. Add an e2e test, including error cases.
