# ADR 0005: SLA Scheduler In-Process (No BullMQ)

**Status:** Accepted
**Date:** 2026-04-09
**Deciders:** Oksana Pokhvalenko

---

## Context

The SLA engine has to:
- Compute `respondDueAt` / `resolveDueAt` when a ticket is created (based on category + priority + policy).
- Periodically scan tickets whose deadline has passed and mark them as breached.
- Emit notifications when a breach happens.

Initial plan was to use BullMQ + Redis with delayed jobs (one job per deadline). After reviewing the actual scope this turned out to be over-engineered.

## Decision

The SLA scheduler runs **in-process** as a `@Cron('*/60 * * * * *')` job inside the SLA module. Every 60 seconds it queries tickets whose `resolveDueAt < now()` and `breachedAt IS NULL`, marks them, and emits `ticket.sla.breached` events.

## Alternatives Considered

### BullMQ delayed jobs (one job per deadline)
- ✅ Precise — fires exactly when the deadline elapses
- ✅ Survives backend restarts (jobs persist in Redis)
- ❌ Job count grows linearly with open tickets
- ❌ Recomputing on edit means scheduling a new job + cancelling the old one
- ❌ Adds Redis-as-job-broker as a critical dependency
- ❌ Significant operational complexity for a portfolio project

### Database-driven cron in PostgreSQL (`pg_cron`)
- ✅ Zero app-side state
- ❌ Render's managed Postgres doesn't ship `pg_cron`
- ❌ Logic lives in SQL — harder to test

### In-process cron (chosen)
- ✅ Trivially simple — one query per minute
- ✅ Worst-case latency is 60s, well within SLA-engine tolerance
- ✅ No new infrastructure
- ✅ Easy to test (mock `Date.now`, call the method directly)
- ❌ Doesn't scale horizontally — multiple instances would do the same work
- ❌ Requires graceful shutdown so an in-flight scan finishes

### Mitigations
- For now we run a single backend instance on Render, so duplicate work isn't a concern.
- If we ever scale out: add a Postgres advisory lock around the scan, or move the cron to its own worker process.
- `enableShutdownHooks()` + Prisma `$disconnect()` ensure in-flight scans complete on SIGTERM.

## Consequences

- The whole SLA pipeline lives in `backend/src/modules/sla/`. No Redis dependency for scheduling (Redis is still used for sockets pub/sub).
- BullMQ is **not** used in the project (see ADR 0006 if we ever add it back).
- Worst-case false-negative window: 60s. Acceptable for a B2B ticketing tool.
