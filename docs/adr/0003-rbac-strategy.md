# ADR 0003: RBAC via Roles + Permission Matrix

**Status:** Accepted
**Date:** 2026-04-09
**Deciders:** Oksana Pokhvalenko

---

## Context

ServiceDesk Pro has 4 roles (`ADMIN`, `TEAM_LEAD`, `AGENT`, `REQUESTER`) and dozens of role-gated capabilities (assign, escalate, view internal notes, access reports, manage users, etc.). We need an authorization model that:

- Enforces access on the backend at the route level.
- Hides UI affordances on the frontend that the user can't actually use.
- Is easy to audit ("who can do what?") in a single place.
- Doesn't sprinkle `if (role === 'ADMIN' || role === 'TEAM_LEAD')` checks across the codebase.

## Decision

Two-layer model:

1. **Backend:** roles are the source of truth. A `@Roles(...)` decorator + `RolesGuard` checks the JWT subject's role against the allowed list. Mounted globally via `APP_GUARD`. Routes without `@Roles` are open to any authenticated user; `@Public()` opts out of auth entirely.

2. **Frontend:** a single `PERMISSION_MATRIX: Record<Permission, readonly UserRole[]>` constant maps semantic permission keys (`ticket.assign`, `reports.view`, `admin.access`, …) to roles. A `*hasPermission` structural directive reads `auth.role()` (signal) inside `effect()` and creates/clears the embedded view. Templates use the permission key, not the role.

## Alternatives Considered

### Per-route role string scattered in templates and services
- ✅ Trivial
- ❌ Changing "who can escalate" means grepping the codebase
- ❌ Easy to drift between FE and BE checks

### Full ABAC (attribute-based) with policy engine (Casbin / Cerbos)
- ✅ Maximum flexibility
- ❌ Massive overkill for 4 roles and ~15 permissions
- ❌ Adds infra (policy server) and a second DSL

### Roles + permission matrix (chosen)
- ✅ One file to audit
- ✅ Renaming a permission is a single rename
- ✅ Changing which role gets a permission touches one row
- ✅ FE templates read as intent (`*hasPermission="'reports.view'"`), not as plumbing
- ❌ Two layers (BE roles + FE matrix) must stay in sync — mitigated by tests + the matrix being short

## Consequences

- New permissions require: (1) add to `Permission` union, (2) add row in `PERMISSION_MATRIX`, (3) add `@Roles` on the relevant backend route.
- The matrix is the single source of truth for "what can each role do?" — useful for the README and for screenshots.
