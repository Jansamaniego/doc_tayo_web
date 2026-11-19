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
- **Error monitoring:** per Q14, with PII scrubbing (no request bodies, no names, ids only) and release tagging; the `requestId` is attached to reports.
- **Support matrix:** final browsers, devices, the TV device, minimum screen sizes (Q9, Q8b), and tested combinations.
- **Operational (AWS EC2, decided Q2):**
  - web server config for `app.doctayo.<tld>` (nginx proposed): TLS, SPA fallback, caching, security headers;
  - deployment pipeline from CI to the instance (Q2b);
  - environment configs, rollback, status page link;
  - the admin console's separate host (Phase 5).

## Backend endpoints

None new; needs a staging environment that mirrors production domains (cookie and CORS behaviour).

## Tests (outline)

Full e2e suite on the support matrix, Lighthouse/Web Vitals in CI on staging, CSP violation reports reviewed, penetration test (external, if budget allows).

## Open questions

Q2b CI and the deploy step to EC2, Q9 devices, Q14 monitoring provider.
