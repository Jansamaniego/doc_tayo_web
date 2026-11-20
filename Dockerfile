# syntax=docker/dockerfile:1
#
# DocTayo Web images. One Dockerfile, a stage for each job:
#
#   dev    Node + dependencies: dev server, unit tests, lint, type-check, Storybook
#   e2e    dev + Chromium, Firefox and WebKit (with their system libraries) for Playwright
#   build  the production build (type-checked)
#   prod   nginx serving that build: the same files that go to S3 + CloudFront
#
# Use them through compose.yaml (see docs/docker.md):  docker compose up

ARG NODE_VERSION=24

# ---- deps: install every dependency (cached until the lockfile changes) -----
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# ---- dev: what `docker compose up` and the tool commands run ----------------
# The source is bind-mounted over /app by compose, and node_modules lives in a
# volume. The entrypoint reinstalls when package-lock.json changed, so a
# `git pull` never needs a rebuild.
FROM deps AS dev
ENV NODE_ENV=development
RUN sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.lock-hash
COPY --chown=node:node docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod +x /usr/local/bin/dev-entrypoint.sh
COPY --chown=node:node . .
EXPOSE 5173
USER node
ENTRYPOINT ["dev-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- e2e: Playwright with all three browser engines --------------------------
# `--with-deps` installs the Linux libraries the browsers need (this is what
# a plain WSL machine lacks, so WebKit only runs here).
FROM dev AS e2e
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium firefox webkit \
 && chmod -R a+rX /ms-playwright
USER node
CMD ["npm", "run", "test:e2e"]

# ---- build: the production build (npm run build = type-check + vite build) --
FROM deps AS build
COPY --chown=node:node . .
# The API origin is baked into the build (Vite inlines VITE_* values). Leave it
# unset to use .env.production.
ARG VITE_API_ORIGIN=
RUN if [ -z "$VITE_API_ORIGIN" ]; then unset VITE_API_ORIGIN; fi; npm run build

# ---- prod: nginx, no root, no source, no node ---------------------------------
# Serves the single-page app with the security headers and caching of
# docs/deployment.md. It is the fallback if EC2 is ever required (never serve
# the app from the API container). Set API_ORIGIN when you run it.
FROM nginxinc/nginx-unprivileged:alpine AS prod
ENV API_ORIGIN=http://localhost:3000
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
