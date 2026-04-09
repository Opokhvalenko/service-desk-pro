# ADR 0002: Prisma over TypeORM for the Data Layer

**Status:** Accepted
**Date:** 2026-04-09
**Deciders:** Oksana Pokhvalenko

---

## Context

The backend needs a typed ORM that:
- Generates strongly-typed query results (no `any` leaking from raw SQL).
- Has a first-class migration story we can run in CI and on Render.
- Plays well with the relational schema (Users / Tickets / Comments / Attachments / SLA / Audit).
- Doesn't fight NestJS DI.

## Decision

We use **Prisma 6** with PostgreSQL. The schema lives in `backend/prisma/schema.prisma`; migrations are checked in under `backend/prisma/migrations/`.

## Alternatives Considered

### TypeORM
- ✅ Native NestJS module
- ✅ Decorator-based entities feel familiar in a Nest project
- ❌ Type inference on query results is weak — `find` returns `Entity[]`, not the actual selected shape
- ❌ Migration generation has well-known footguns with relations
- ❌ Active maintenance has slowed; ecosystem confidence is low

### Drizzle
- ✅ Excellent type inference, zero-runtime
- ✅ SQL-first
- ❌ Less mature migration tooling
- ❌ Smaller ecosystem in NestJS-land

### Prisma
- ✅ Best-in-class generated types — `prisma.ticket.findMany({ select: { ... } })` returns the *exact* selected shape
- ✅ Excellent migration workflow (`prisma migrate dev` / `deploy`)
- ✅ Built-in connection pooling, easy to wire as a Nest provider
- ❌ Heavier query engine binary
- ❌ Less control over generated SQL than raw drivers

## Consequences

### Positive
- Almost zero runtime type errors at the data layer.
- Schema diffs are auto-generated and reviewable in PRs.
- The `select` projection pattern naturally enforces "fat service / thin DTO".

### Negative
- Migration history must be linear — squashing requires care.
- Prisma client needs to be regenerated after every schema change (`npx prisma generate`).

### Mitigations
- `postinstall` script runs `prisma generate`.
- Docs in `backend/prisma/README.md` describe the migration workflow.
