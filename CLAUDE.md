@AGENTS.md

## Operating Principles (Non-Negotiable)

     1. **Correctness over cleverness**: Prefer boring, readable solutions.
     2. **Smallest change that works**: Don't refactor adjacent code unless necessary.
     3. **Follow existing patterns**: Check `src/` structure before introducing new abstractions.
     4. **Be explicit about uncertainty**: If something cannot be verified, say so.
     5. **Todo list is mandatory for every task**: At the START of every task (before any code is read or written), create a todo list that maps to the
     Task Lifecycle steps below. Use the session's task tool if it has one (`TaskCreate` or `TodoWrite`); if it has none, write the checklist as the first message of the task and keep it updated as steps finish. This is not optional. The todo list is what prevents early stopping and missed steps.
     6. **Plans and docs stay aligned with the code**: the master plan (`plan.md`), the child plans (`plans/`) and `docs/` must always describe the code as it is. See "Plans and Docs Stay Aligned With the Code" below.

## Task Lifecycle

The todo list for every task contains these steps (drop only those that truly do not apply, and say so):

1. Understand the request and read the relevant code, plans and docs.
2. Write the tests first and confirm they fail for the expected reason (see "Tests First").
3. Implement the smallest change that works.
4. Run the related tests, then the broader suite, plus lint, format check and typecheck.
5. Update the plans and docs so they match the code (see "Plans and Docs Stay Aligned With the Code").
6. Report: tests added, commands run and their results, plan/doc files updated, and anything not run or not verified.

## Mandatory Development Rule: Tests First

**Tests must ALWAYS be written before implementation code. This is a mandatory development rule, not an optional recommendation.**

Before writing or modifying any feature or bug-fix implementation:

1. Understand the requirement and inspect the existing implementation.
2. Identify the expected behavior, edge cases, and failure scenarios.
3. Write the tests that define and verify the expected behavior.
4. Run the tests and confirm that they fail for the expected reason (or otherwise demonstrate that the new behavior is not yet implemented).
5. Only then write or modify implementation code.
6. Run the relevant tests again and confirm they pass.
7. Run the broader relevant test suite to detect regressions.

**If you catch yourself writing implementation code before its tests, STOP. Write the tests first, then continue.**

### Testing requirements

- Apply this rule to backend and frontend development.
- Backend: follow the testing conventions and directory structure defined in the backend `plan.md`. Unit tests should follow the established `*.spec.ts` convention alongside the code they test. E2E tests belong in the designated backend E2E test directory.
- Frontend: follow the frontend plan's testing conventions. E2E tests belong in `tests/e2e/`, unless the approved frontend plan specifies otherwise.
- Use real PostgreSQL for integration and database behavior tests. Do not mock Prisma when verifying actual database behavior.
- Include positive cases, negative cases, validation failures, boundary conditions, and relevant security scenarios.
- For multi-tenant functionality, test cross-tenant access and isolation explicitly.
- For bug fixes, write a regression test that reproduces the bug before fixing it.
- For refactoring, add or verify tests that protect existing behavior before changing implementation.
- Do not weaken, delete, skip, or modify assertions merely to make failing tests pass. Change tests only when requirements or expected behavior legitimately change.
- Never claim a feature is complete merely because the code compiles. Its relevant tests must pass.

### Test execution and reporting

After implementation:

- Run the tests directly related to the change.
- Run the relevant broader test suite.
- Run linting and type checking when applicable.
- Report which tests were added, which commands were executed, and whether they passed.
- Clearly disclose any tests that could not be executed and why.

### Important distinction

Planning tasks do not require implementation tests to be written prematurely. However, every implementation milestone must specify its tests and acceptance criteria before implementation begins.

**Priority:** This rule takes precedence over speed or convenience. Never skip test-first development to save time or tokens.

## Mandatory Rule: Plans and Docs Stay Aligned With the Code

**The implemented code is the source of truth. `plan.md`, every child plan in `plans/`, and the documents in `docs/` (including ADRs) must always match it. A change is not complete while any of them disagrees with the code.**

- **Same change, not later.** Whenever code (or the Prisma schema, migrations, config, routes, error codes, scripts, or test layout) differs from what a plan or doc says, edit the plan/doc in the same piece of work. Do not leave drift for a follow-up.
- **Edit the plan to match the code, never the reverse.** If implementation had to deviate from an approved plan, update the plan body so it describes what was built, and record the deviation and its reason in the child plan's "As Built" section (create one if missing). Do not silently ship a deviation, and do not bend the code back to a stale plan.
- **Which files:**
  - The relevant child plan in `plans/` (scope, data model, endpoints, tests, milestones, status).
  - The master `plan.md`: current-state table (§0), the affected sections, the phase status in §10, and open questions in §15.
  - `docs/*.md` and `docs/adr/` for behavior, conventions and decisions (add or amend an ADR when a decision changes).
  - `README.md`, `.env.example` and `docs/environment.md` when setup or configuration changes.
- **Replace stale text.** Remove or rewrite statements that are no longer true ("later", "not yet", "reserved", old counts, old file names). Do not just append a note beside a wrong statement.
- **Verify before writing.** State only what was checked in the code or in a command's output. Mark anything unverified as such (principle 4).
- **Before reporting a task done:** re-read the plan/doc sections touching the change, and in the final report list which plan and doc files were updated (or state that none needed changing).
- **Planning work in the other direction:** an approved plan may describe code that does not exist yet; mark such parts with their phase or "planned" so they cannot be mistaken for the current state.

## Code Organisation and Style Conventions

These apply to every change, so new code follows them without being asked. When existing code disagrees with a rule you are touching, bring that code in line (smallest change) rather than copying the old style.

### Folder and file layout

- A module's root holds only its `*.module.ts`, controllers and `dto/`. Once a module has more than about eight source files, group the rest in subfolders **by concern** (for example `auth/session/`, `auth/password/`, `auth/flows/`), not by file kind. Never create a folder for one file.
- File names say what is inside: `x.service.ts` (injectable service), `x.controller.ts`, `x.guard.ts`, `x.module.ts`, `x.dto.ts`; anything else is plain code (a pure function or constants file) named for its subject, without a `.service` suffix.
- Do not keep a file of a few lines. Constants or a thin wrapper used by a single file live in that file; share them in their own file only when a second consumer exists.
- A flow or service is one use case or one tightly related set of them. A new use case gets its own service file under the module's `flows/`-style folder rather than growing an existing one.
- Specs sit next to the code they test (`*.spec.ts`); e2e tests stay in `test/`.

### Function arguments

- **One argument:** positional is fine (`rotate(token)`).
- **Two or more arguments of the same type** (several strings or ids), **or three or more arguments in total, or any optional argument:** take **one object** with named fields (`change({ currentPassword, newPassword })`). A swapped pair of strings compiles and is a security bug.
- **Different types, two arguments, none optional** may stay positional (`cookies.set(res, token, expiresAt)`).
- **Never** pass a placeholder (`{}`, `null`) to reach a later argument, and never keep a parameter nothing reads.
- **Transaction handle:** when a method can run inside a caller's transaction, `tx`/`db` is the **first** parameter and is **required** (`sessions.revoke(tx, { sessionId, reason })`, `audit.record(tx, entry)`). Never default it to the global client: a forgotten `tx` would silently break atomicity. The type is `PrismaTransaction` (`src/prisma/prisma.service.ts`) or a `Pick<PrismaClient, ...>` of just the delegates used.
- Controllers pass the validated DTO straight to the service when the field names match, instead of copying fields one by one.
- The caller's identity (user, session, tenant) comes from `RequestContext` inside the service, not as extra id arguments from the controller.

### Duplication and naming

- The third copy of the same block (an audit entry, a find-validate-consume sequence) becomes a helper. Name it for the intent (`recordAccountEvent`, `redeem`), and put it with the data it works on.
- A value that is decided by another argument is derived inside, not passed in (a token's TTL follows its type).
- Replace unreadable derived types (`Parameters<Parameters<...>[0]>[0]`) with a named type exported from where the thing is defined.
- Keep comments for the non-obvious why (security reasons, ordering, race handling); do not narrate what the code does.
