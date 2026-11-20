# Deployment

Status: **written, not yet applied.** The production domain (plan.md Q2c) and the AWS resources do
not exist yet, so `.github/workflows/deploy.yml` does nothing until `DEPLOY_ENABLED=true` is set.

The build is static files, so they are served from **S3 + CloudFront**. The deploy is independent of
the backend's production deployment (backend Phase 7, not designed yet). If EC2 is ever required,
serve the same `dist/` with nginx and the same headers, **never from the API container**.

## The nginx image (fallback, and the production build on your machine)

`docker compose up --build web-prod` builds the `prod` stage of the Dockerfile: the production build behind
`nginx-unprivileged` (about 90 MB, user `nginx`, port 8080, `/healthz`). It sends the same caching and security
headers as this document describes (a spec keeps its Content-Security-Policy identical to `src/config/csp.ts`),
falls back to `index.html` for app routes, and reads the API origin from `API_ORIGIN` at start. It is the
**EC2 + nginx fallback** if S3 + CloudFront is ever not an option, never a reason to serve the app from the API
container. Details: [docker.md](docker.md).

## Resources to create

| Resource                  | Notes                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| S3 bucket                 | Private. Reached only through CloudFront (origin access control).                                                  |
| CloudFront distribution   | Custom domain `app.<domain>`. Default root object `index.html`. Error responses 403 and 404 return `/index.html` with status 200 (single-page app routes). |
| ACM certificate           | Must be in `us-east-1` for CloudFront.                                                                             |
| Response headers policy   | The security headers below.                                                                                        |
| IAM role for GitHub OIDC  | Trusts this repository's `main` branch; may write to the bucket and create invalidations. No long-lived keys.      |

Repository variables used by the workflow: `DEPLOY_ENABLED`, `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`,
`S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`.

## Caching

- Hashed files in `assets/`: `Cache-Control: public, max-age=31536000, immutable`.
- `index.html`: `Cache-Control: no-cache`.

## Security headers (response headers policy)

The Content-Security-Policy value comes from one source, `src/config/csp.ts` (`buildCsp({ apiOrigin })`),
the same string `vite preview` sends during the e2e tests. Replace `<API origin>` with the real API origin:

```
Content-Security-Policy-Report-Only:
  default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self';
  connect-src 'self' <API origin>; img-src 'self' data:; frame-ancestors 'none';
  base-uri 'none'; form-action 'self'
```

It is **report-only until Phase 13**, which switches it to `Content-Security-Policy`. Also set
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and a
`Permissions-Policy` that turns off features the app does not use.

## If a component needs inline styles

`style-src` must never get `'unsafe-inline'`. A per-request nonce needs the HTML rewritten for every
request, which plain S3 + CloudFront cannot do (plan.md Q17). Prefer changing the component.
