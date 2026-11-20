# ADR-0004: Design tokens and component library

Status: accepted for implementation (2026-11-21). **Product-owner approval of the style guide is still pending** (plans/02-design-system.md §14).

## Decision

- **One token source**, `src/design-system/tokens/tokens.json`. `npm run tokens:build` generates `tokens.css` (a Tailwind v4 `@theme`) and `tokens.ts`; CI runs `tokens:check`. Tailwind's default colours are switched off (`--color-*: initial`), so a component can only use role tokens (`bg-primary`, `text-ink-muted`, `border-control`), never a raw palette step or hex value.
- **Contrast is a test.** `pairings.ts` lists every foreground/background a component uses; `tokens.contrast.spec.ts` fails the build below 7:1 (body text), 4.5:1 (other text) or 3:1 (borders, focus ring).
- **Components are shadcn/ui-style** (Radix primitives, copied into `src/design-system/components/` and changed for older users: 48 px controls, 18 px text, no icon-only buttons). Where shadcn has nothing suitable we build it plainly.
- **Inter, self-hosted and subset** (`npm run font:build`): Basic Latin, Latin-1, ₱, weights 400-700, with tabular figures and the `cv05`/`cv08` letter alternates.

## Why these differ from the first plan

- **Radix Toast, not Sonner.** Sonner injects an inline `<style>` element when it loads. Our Content-Security-Policy forbids inline styles (`style-src 'self'`, never `'unsafe-inline'`), and per-request nonces are not possible on plain S3 + CloudFront (plan.md Q17). Radix Toast keeps its styles in our CSS.
- **Own listbox for the Combobox, not cmdk.** Full control of the ARIA (labelled trigger, `aria-activedescendant`, a live result count) and nothing to fight in jsdom.
- **No TanStack Table.** v9 is brand new and our tables are sorted by the server, so a controlled `sort` prop is simpler and lighter.
- **Zod runs in no-eval mode** (`src/lib/zod.ts`): found by the e2e CSP check in Phase 1.
- **A class-merge helper that knows our type scale** (`src/lib/cn.ts`): without it `tailwind-merge` dropped the white text of a large primary button (found by the browser tests, 2.61:1 contrast).

## Consequences

- Adding a colour means a token, then a declared pairing, then a passing contrast test.
- Anything that injects styles at runtime cannot be used (see docs/deployment.md).
- Stories double as tests: every story is checked with axe in Vitest and in a real browser through the e2e gallery.
