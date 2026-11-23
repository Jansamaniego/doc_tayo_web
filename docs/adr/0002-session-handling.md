# ADR-0002: Session handling

Status: accepted (2026-11-20). Implemented in Phase 3; Phase 1 provides the in-memory token store and
the single-flight helper (`src/api/session/`).

## Decision

- The **access token lives in memory only**. The refresh token is the httpOnly `dt_refresh` cookie, which
  the app never reads. Nothing sensitive goes in `localStorage` or `sessionStorage`; only
  `src/lib/preferences.ts` may touch storage, for non-sensitive device preferences.
- **Refresh is serialised.** Within a tab, one shared in-flight promise. Across tabs, the Web Locks API.
  Two refreshes with the same cookie look like a stolen token to the server and end the session.
- **The active clinic is stored on the server session**, which all tabs share. A clinic switch in one tab
  is broadcast to the others; the query cache is cleared and every query key starts with the clinic id.
  Backend dependency D-1 would let the server reject a request made for the wrong clinic.
- **Shared computers** (opt-in at sign-in) are signed out after 10 idle minutes, with a 60-second warning:
  `POST /auth/logout` revokes the session on the server, then the token and screen are cleared. Unsaved form
  input is kept in memory only and returned to the same user. Server-side enforcement is backend request D-26.

- **The session also holds `platformRole`** (`none` or `platform_admin`, from `GET /me`). It decides whether the Clinics and Users tabs exist and grants no clinic data. A `FORBIDDEN` on any request refreshes `GET /me`, so a removed role or permission shows up without a reload.
- **Every page load restores the session** with one `POST /auth/refresh` (limited to 30 a minute per address). Tests that are not about signing in must stub it (`realSession` in `tests/e2e/fixtures/test.ts`).

See plan.md §5.3 and §5.3.1 for the details.
