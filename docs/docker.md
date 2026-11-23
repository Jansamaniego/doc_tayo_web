# Docker in this project

Everything you need to work on DocTayo Web runs in Docker: the database, the API, the dev server, the tests, the browser tests, the style guide and the production image. You need only Docker (Compose v2) and the backend repository checked out next to this one (`../doc-tayo-api`). Files: [`Dockerfile`](../Dockerfile), [`compose.yaml`](../compose.yaml), [`.dockerignore`](../.dockerignore), [`docker/`](../docker/).

## The short version

```bash
docker compose up --build              # database + migrations + API + dev server  ->  http://localhost:5173
docker compose run --rm seed           # dev clinic and users (owner@sunrise.test, password dev-password-change-me-123)
docker compose down                    # stop; the database is kept (add -v to delete it too)
```

| I want to... | Command |
|---|---|
| Open the app | `docker compose up` then http://localhost:5173 (edits on your machine hot-reload) |
| Run the unit and component tests | `docker compose run --rm web npm test` |
| Lint, type-check, check formatting | `docker compose run --rm web npm run lint` / `typecheck` / `format:check` |
| Check tokens and the API contract | `docker compose run --rm web npm run tokens:check` / `api:check` |
| Run the browser tests (Chromium, Firefox, **WebKit**, mobile) | `docker compose run --rm e2e` |
| Run the platform admin e2e (needs the emails as files) | `MAIL_TRANSPORT=file docker compose up -d api`, `docker compose run --rm seed`, then `docker compose run --rm e2e npx playwright test tests/e2e/platform-admin.spec.ts --project=chromium` (not run yet) |
| Run one browser test file | `docker compose run --rm e2e npx playwright test tests/e2e/smoke.spec.ts --project=chromium` |
| See the style guide | `docker compose up storybook` then http://localhost:6006 |
| Run the production build (nginx) | `docker compose up --build web-prod` then http://localhost:8080 |
| Get a shell | `docker compose run --rm web sh` |
| Add a dependency | `docker compose run --rm web npm install <package>` (updates `package.json` and the lockfile on your machine) |
| Sync the API contract from the backend | `npm run api:sync` on your machine (it reads `../doc-tayo-api`) |
| See logs | `docker compose logs -f web` / `api` |
| Reset the database | `docker compose down -v` (deletes the volumes), then `up` and `seed` |

Use `--no-deps` (`docker compose run --rm --no-deps web npm test`) to run a tool without starting the database and API.

## What runs

```
 your machine
 ├─ browser ─► localhost:5173 ─► web (Vite dev server, hot reload)      ─┐
 ├─ browser ─► localhost:3000 ─► api (NestJS)  ◄────────────────────────┘ (the browser calls the API)
 ├─ DBeaver ─► localhost:5434 ─► postgres
 │
 │   compose network:  web ─ api ─ postgres        migrate (one-off, on every `up`)
 │
 │   profiles (started only when asked):
 │     e2e        Playwright + 3 browsers, shares the API's network ("localhost" is the API)
 │     storybook  the style guide, :6006
 │     prod       nginx with the production build, :8080
 │     tools      seed
```

Every port is published on `127.0.0.1` only. The API, the migration job and the database are built from the backend checkout, exactly as its own `docker-compose.yml` does; **do not run both stacks at once** (they use the same ports): `docker compose stop` in the backend first.

## The images (one Dockerfile, one stage per job)

| Stage | Size | What it is |
|---|---|---|
| `dev` | about 1.1 GB | Node 24 plus all dependencies. Runs the dev server, tests, lint, Storybook. |
| `e2e` | about 4 GB | `dev` plus Chromium, Firefox and WebKit with their Linux libraries. |
| `build` | (not kept) | `npm run build`: type-check and production build. |
| `prod` | about 90 MB | `nginx-unprivileged` serving the build. No Node, no source, runs as the `nginx` user. |

How the dev loop works:

- Your source is **bind-mounted** at `/app`, so edits appear at once and files created by tools (`dist/`, `test-results/`, the route tree) belong to you. The containers run as the `node` user (uid 1000); if your user id is not 1000, add `user: "<uid>:<gid>"` to the services in a `compose.override.yaml`.
- `node_modules` lives in a **volume** (`web_node_modules`), installed for Linux inside the image. It never mixes with a `node_modules` from your machine.
- When `package-lock.json` changes (after a `git pull`), the entrypoint reinstalls by itself the next time any command starts (about 15 s). No rebuild needed. A rebuild (`--build`) is only for changes to the Dockerfile.

## Why it is built this way

- **The e2e container shares the API's network** (`network_mode: service:api`). For the browser, `localhost:3000` is the API and `localhost:4173` is the preview server, so the app uses its normal `.env.e2e` and the refresh cookie (`SameSite=Strict`) stays same-site, as in production. This matters from Phase 3, when e2e signs people in.
- **The e2e image installs the browsers with `--with-deps`.** A plain Linux or WSL machine lacks the system libraries, so WebKit (Safari) could not run on it; it runs here.
- **Migrations run on every `up`** (the `migrate` job exits when done; repeating it is safe), so a fresh machine needs no extra step before the API starts.
- **The production image is the fallback in docs/deployment.md.** Production is S3 + CloudFront; this image is for running the production build locally and for EC2 + nginx if that is ever required. The API origin is a runtime setting (`API_ORIGIN`), so one image fits every environment; `VITE_API_ORIGIN` is baked into the build (`--build-arg`, see `compose.yaml`).
- **nginx security headers:** `docker/nginx/default.conf.template` sets the Content-Security-Policy as a variable and adds it, with `docker/nginx/security-headers.conf`, in every location, because nginx drops server-level headers inside a location that sets its own. A spec (`scripts/docker-files.spec.ts`) keeps the policy identical to `src/config/csp.ts`.

## Settings

All optional (defaults in `compose.yaml`); put them in a `.env` file next to `compose.yaml` or export them.

| Variable | Default | Use |
|---|---|---|
| `BACKEND_DIR` | `../doc-tayo-api` | Where the backend checkout is |
| `WEB_PORT`, `API_PORT`, `POSTGRES_PORT`, `STORYBOOK_PORT`, `PROD_PORT` | 5173, 3000, 5434, 6006, 8080 | Host ports. `API_PORT` is also given to the browser app, so it follows. |
| `DB_APP_PASSWORD`, `DB_OWNER_PASSWORD`, `POSTGRES_SUPERUSER_PASSWORD`, `JWT_ACCESS_SECRET` | development values | Development secrets only. Never reuse them anywhere real. |

## Troubleshooting

| Problem | Fix |
|---|---|
| `port is already allocated` | The backend's own stack (or a host Postgres) is running: stop it, or change the port variable. |
| `path .../doc-tayo-api not found` or the API will not build | Check out the backend next to this repository, or set `BACKEND_DIR`. |
| The page loads but the API is unreachable or CORS fails | The API must allow the page's origin. Compose allows `:5173`, `:4173` and `:8080`; if you changed `WEB_PORT`, add that origin to `CORS_ALLOWED_ORIGINS` in `compose.yaml`. |
| Hot reload does not notice edits | On Docker Desktop with the project on a Windows drive, file events do not reach Linux. Keep the project inside the WSL file system (`/home/...`) or enable Vite polling. |
| Dependency errors after pulling | They fix themselves (see above). To force it: `docker compose down -v` (also deletes the database) or `docker compose run --rm web npm ci`. |
| Chromium crashes in `e2e` | Needs shared memory: `shm_size: 1gb` is set; raise it if your tests are heavy. |
| Files in my project are owned by root | Something ran as root. The services run as `node` (uid 1000); fix with `sudo chown -R $USER .` and check for a `user:` override. |
