# ADR-0003: Static hosting on S3 + CloudFront

Status: accepted (2026-11-20, plan.md Q2b). The domain is still open (Q2c).

## Decision

The build is static files. They are deployed from GitHub Actions on a merge to `main` to **S3 + CloudFront**,
independent of the backend's deployment. If EC2 is ever required, serve the build with nginx, never from
the API container. The app (`app.<domain>`) and the API (`api.<domain>`) must be subdomains of the same
registrable domain.

## Consequences

- Security headers (including the CSP) are set by a CloudFront response headers policy.
- A per-request CSP nonce is not possible on plain S3 + CloudFront. Components must not inject styles; if one
  must, choose between Lambda@Edge and the nginx fallback (plan.md Q17).
- No backend change or server restart is involved in a frontend release; rollback is redeploying an earlier build.

See docs/deployment.md.
