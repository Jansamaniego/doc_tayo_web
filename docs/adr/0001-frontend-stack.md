# ADR-0001: Frontend stack

Status: accepted (2026-11-20, owner approval of plan.md Q1, with shadcn/ui).

## Decision

A client-rendered single-page app: **React 19, TypeScript (strict), Vite, TanStack Router and Query,
openapi-typescript + openapi-fetch, shadcn/ui (Radix) on Tailwind CSS v4, React Hook Form + Zod,
Lingui, Vitest + Testing Library + MSW + vitest-axe, Playwright + axe, ESLint + Prettier.** Runtime:
**Node 24**, the same as the backend.

## Why

- Everything is behind sign-in, so there is no SEO need. The refresh cookie is scoped to the API, so a
  server-rendering frontend could not use it. A static build is cheap to host and easy to lock down
  with a strict Content-Security-Policy.
- The API contract is OpenAPI: generated types make contract drift a compile error.
- shadcn/ui gives us the component code to restyle for older users; Radix supplies accessible behaviour.

## Version pins (found while scaffolding, 2026-11-20)

- **TypeScript 5.x**, not 6 or 7: `openapi-typescript` 7.13 declares `typescript ^5.x` as a peer, and
  `typescript-eslint` 8.73 supports `<6.1`. Revisit when `openapi-typescript` supports a newer TypeScript.
- **ESLint 9**, not 10: `eslint-plugin-jsx-a11y` 6.10 supports ESLint up to 9.
- **Vite 8 / Vitest 5** with Lingui's own Vite plugin (`macroTransform: true`): no Babel is needed.
- **MSW 3**: the unexpected-request option is `onUnhandledFrame` (the old `onUnhandledRequest` is silently ignored).
- **Zod 4** must run with `jitless: true` (`src/lib/zod.ts`): its default JIT probes `new Function`, which our CSP forbids.

## Alternatives considered

Next.js or Remix (a server tier with no benefit), React Aria Components (an excellent fit, but the owner
chose shadcn/ui), Jest, Cypress, Biome. See plan.md §4.
