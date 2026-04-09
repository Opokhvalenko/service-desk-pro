# Contributing

Thanks for taking the time to contribute. This document describes the workflow,
conventions and quality gates that every change to ServiceDesk Pro must pass
before it lands on `main`.

## Workflow

1. Create a branch from `main`. Use a descriptive prefix:
   - `feat/<short-description>` — new user-facing feature
   - `fix/<short-description>` — bug fix
   - `refactor/<short-description>` — internal change, no behaviour delta
   - `docs/<short-description>` — documentation only
   - `test/<short-description>` — tests only
   - `chore/<short-description>` — tooling, CI, dependencies
2. Keep the branch focused. One concern per PR. If you discover an unrelated
   issue mid-flight, open a follow-up branch instead of bundling.
3. Rebase on `main` before opening the PR so the diff is clean.
4. Open a PR using the template in `.github/pull_request_template.md`.
5. CI must be green. Reviewers will not look at red PRs.
6. Squash-merge once approved. The squash commit message must follow
   Conventional Commits (see below).

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <imperative summary>

<optional body explaining the why>

<optional footer: BREAKING CHANGE, refs #123>
```

Allowed types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`,
`build`, `ci`, `style`.

Examples:

- `feat(tickets): add optimistic concurrency to status changes`
- `fix(auth): revoke refresh tokens on password change`
- `docs(adr): rewrite 0005 to match BullMQ recurring-job reality`

## Quality gates (run before pushing)

The pre-push hook runs these automatically — but run them yourself first so
you don't waste a CI cycle:

### Backend (`backend/`)

```bash
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # jest unit tests
npm run build        # nest build
```

### Frontend (`frontend/`)

```bash
npm run lint         # eslint
npm run typecheck    # tsc --noEmit -p tsconfig.json
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

### End-to-end (optional but recommended for risky changes)

```bash
cd frontend
npm run e2e          # Playwright against local docker stack
```

See `docs/LOCAL_E2E.md` for the docker-compose recipe.

## Code standards

- **TypeScript strict mode**. No `any`, no `as any`, no implicit any. Use
  `unknown` + narrowing at boundaries.
- **Backend**: thin controllers, fat services. Validation via class-validator
  DTOs at the controller boundary. RBAC checks live in services, not guards
  alone (defence in depth).
- **Frontend**: standalone components, signals + signalStore, no NgModules,
  no `any`. Material 3 + Tailwind v4 — no hand-rolled CSS unless unavoidable.
- **Database**: every migration is reviewed against `docs/MIGRATIONS.md`.
  Decimal for money, indexes on foreign keys, no destructive column drops in
  the same release as the code change (expand-contract).
- **Errors**: throw typed `HttpException` subclasses. The global filter shapes
  the response envelope — do not hand-roll error JSON in controllers.
- **Logging**: use the Nest `Logger`. Never `console.log` in production paths.
  Errors must include the request id (the all-exceptions filter handles this).
- **Tests**: every bug fix lands with a regression test. Every new endpoint
  lands with at least a happy-path integration test plus an auth/RBAC test.

## Reviews

- At least one approval is required. The reviewer should re-run the test
  suite locally for non-trivial changes.
- Reviewers focus on: correctness, security, RBAC, error handling, test
  coverage of the changed lines, and ADR alignment.
- Style nits should be left as `nit:` comments and never block a merge.

## Architectural decisions

Anything that changes a cross-cutting decision (auth, persistence, queue,
realtime transport, deployment topology) requires an ADR in `docs/adr/`.
Copy `docs/adr/0000-template.md`, increment the number, and link the ADR
from the PR description.
