# Environment

Every variable is validated at startup by `src/config/env.ts` (Zod). An invalid value shows a
"This app is misconfigured" page that lists the **names** of the bad keys, never their values.
Vite inlines `VITE_*` values into the build, so a build is made for one environment and the app
holds **no secrets**.

| Variable                   | Example                  | Rules                                                                                                              |
| -------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `VITE_API_ORIGIN`          | `http://localhost:3000`  | Scheme, host and optional port only. **No path and no trailing slash**: the generated API paths already begin `/api/v1`. |
| `VITE_APP_ENV`             | `development`            | `development`, `staging` or `production`.                                                                          |
| `VITE_ERROR_REPORTING_DSN` | _(empty)_                | Optional. Error reporting is added in Phase 13; leave it empty.                                                    |

Which file is read:

| Command                              | File               |
| ------------------------------------ | ------------------ |
| `npm run dev`                        | `.env.development` |
| `npm test`                           | `.env.test`        |
| `npm run test:e2e` (builds and previews with `--mode e2e`) | `.env.e2e` |
| `npm run build`                      | `.env.production`  |

Put machine-specific overrides in `.env.local` (git-ignored). `.env.example` documents every key.

> The plan called this variable `VITE_API_BASE_URL` with the `/api/v1` suffix. The generated client
> (`openapi-typescript`) contains the full path in every operation, so the base URL is the **origin**.
> The variable is therefore named `VITE_API_ORIGIN`.

## The same-registrable-domain rule (production)

The app and the API must be subdomains of the **same registrable domain**, for example
`app.doctayo.ph` and `api.doctayo.ph` (the real domain is not decided yet, plan.md Q2c). The refresh
cookie is `SameSite=Strict`, and `refresh`, `logout` and `logout-all` check the `Origin` header, so a
different domain breaks sign-in.

Backend settings that must match:

- `CORS_ALLOWED_ORIGINS` contains the app's origin (a comma-separated list of exact origins).
- `CORS_ALLOW_CREDENTIALS=true`, or the refresh cookie is never sent.
- `APP_PUBLIC_URL` points at the app: emailed links (reset, setup, invitation) are built from it.

## Local development against the API

See the README. In short, the API's `CORS_ALLOWED_ORIGINS` needs `http://localhost:5173` (dev server)
and `http://localhost:4173` (the preview server the e2e tests use).

## In Docker

`compose.yaml` sets `VITE_API_ORIGIN` for the dev server from `API_PORT` (default `http://localhost:3000`: the
browser on your machine reaches the API through the published port). The e2e container shares the API's network,
so it uses `.env.e2e` unchanged. The production image bakes `VITE_API_ORIGIN` in at build time (`--build-arg`) and
reads `API_ORIGIN` at start for the Content-Security-Policy `connect-src`. See [docker.md](docker.md).
