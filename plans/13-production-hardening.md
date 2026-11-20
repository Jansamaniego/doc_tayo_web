# Phase 13: Production hardening (outline)

Status: **outline**. The gates (axe, CSP report-only, bundle budgets, dependency audit) **start in Phase 1**. This phase is the full audit and the production switch-on.

## Objectives

Full accessibility audit (including older users), performance budgets confirmed on real devices, a security review, error monitoring, and a browser/device support matrix.

## Deliverables (outline)

- **Accessibility:**
  - full WCAG 2.2 AA audit (automated plus manual, with screen readers on desktop and mobile);
  - **moderated sessions with older users** (staff and patients), with fixes;
  - an accessibility statement.
- **Performance:** confirm budgets (plan.md §11) on a mid-range Android phone and the reception tablet model; route-level code splitting; font subsetting; caching headers for static assets (hashed files immutable; `index.html` no-cache).
- **Security review:**
  - token handling (memory only; refresh serialisation; no tokens in logs);
  - XSS (no raw HTML; dependency audit);
  - **enforced CSP** plus `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`;
  - Subresource Integrity where applicable;
  - checking that email-link fragments are removed;
  - TV display credential scope.
- **Error monitoring (Q14, decided):** **Sentry or an equivalent**, added in this phase, not before.
  - **Never send:** request or response bodies, form values, URLs with query strings, user names or emails.
  - **Send:** the **user id only**, the release tag, and the API's **`requestId`** from error responses, so a frontend error can be matched to the backend logs.
  - **Session replay off**, or fully masked, because screens show patient data.
  - Wired through the `reportError` seam from Phase 1.
  - First check whether **NestJS Observe** (the backend's monitoring) offers a browser SDK and compare it with Sentry. _Unverified._
  - A spec feeds a fake error carrying a body, query string, name and email through the scrubber and asserts that only the allowed fields leave.
- **Support matrix (Q9, decided):** run the full suite on the device and browser list in plan.md §11 (desktop Chrome/Edge/Firefox/Safari; iPad and Android tablet in both orientations; Android mid-range phone and iPhone; TV in Chrome kiosk mode at 1920×1080). Record the tested combinations.
- **Operational (S3 + CloudFront, decided Q2b):**
  - production domain once decided (Q2c), with the same-registrable-domain check: `CORS_ALLOWED_ORIGINS` and `APP_PUBLIC_URL` on the API match the app;
  - CloudFront: TLS certificate, `index.html` for app routes, caching, and the response headers policy with the **enforced** CSP;
  - the deploy workflow from Phase 1 on a merge to `main`;
  - rollback (redeploy a previous build's files);
  - staging;
  - the admin console's separate host (Phase 5).
  - EC2 + nginx is used only if ever required, never the API container.

## Backend endpoints

None new; needs a staging environment that mirrors production domains (cookie and CORS behaviour).

## Tests (outline)

Full e2e suite on the support matrix, Lighthouse/Web Vitals in CI on staging, CSP violation reports reviewed, penetration test (external, if budget allows).

## Open questions

Q2c production domain; the NestJS Observe vs. Sentry comparison (Q14); Q17 if a per-request nonce is ever needed.
