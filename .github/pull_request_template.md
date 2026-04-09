<!--
Thanks for the PR. Fill this out so reviewers can move fast.
Delete sections that genuinely don't apply — but err on the side of leaving them.
-->

## Summary

<!-- 1-3 sentences. What does this PR change and why? -->

## Type of change

- [ ] feat — new user-facing feature
- [ ] fix — bug fix
- [ ] refactor — internal change, no behaviour delta
- [ ] docs — documentation only
- [ ] test — tests only
- [ ] chore — tooling / CI / deps
- [ ] perf — performance
- [ ] BREAKING CHANGE

## Linked issues / ADRs

<!-- refs #123, ADR-0005, etc. -->

## Implementation notes

<!--
Anything a reviewer needs to know that isn't obvious from the diff:
non-obvious trade-offs, alternatives considered, follow-ups deferred,
migrations or data backfills required.
-->

## Screenshots / recordings

<!-- For UI changes. Drag-drop here. Delete this section for backend-only PRs. -->

## Testing

- [ ] Unit tests added / updated
- [ ] Integration tests added / updated
- [ ] E2E tests added / updated (or N/A)
- [ ] Manually verified in browser (UI changes)
- [ ] Manually verified with curl / Postman (API changes)

### How to test locally

<!-- Reproducible steps. "Run X, click Y, expect Z." -->

## Quality gate

- [ ] `npm run lint` passes (backend + frontend as relevant)
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No new `any`, no `console.log`, no commented-out code
- [ ] No secrets, no `.env` files committed

## Security / RBAC checklist

- [ ] New endpoints have explicit RBAC checks (not just `@UseGuards(JwtAuthGuard)`)
- [ ] No PII leaked to roles that shouldn't see it
- [ ] User input validated via DTO + class-validator
- [ ] No raw SQL string interpolation (use `Prisma.sql` / parameters)
- [ ] N/A — pure refactor / docs

## Database migrations

- [ ] No migration in this PR
- [ ] Migration is **expand-only** (additive, safe to roll back code)
- [ ] Migration is **contract** (drops/renames) — coordinated with a prior expand release per `docs/MIGRATIONS.md`
- [ ] Backfill plan documented in PR description
