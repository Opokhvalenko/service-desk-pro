# ADR 0005: BullMQ Recurring Job for SLA Scheduling

> File kept under the original `0005-sla-scheduler-in-process.md` name for link
> stability — the original draft proposed an in-process scheduler. The decision
> below is what actually shipped.

**Status:** Accepted
**Date:** 2026-04-09 (revised after audit)
**Deciders:** Oksana Pokhvalenko

---

## Context

The SLA engine has to:
- Compute `respondDueAt` / `resolveDueAt` when a ticket is created (based on category + priority + policy).
- Periodically scan tickets whose deadline has passed and mark them as breached.
- Emit notifications when a breach happens.

Two natural scheduling shapes were on the table:

1. **One delayed job per deadline** — schedule a BullMQ job that fires exactly when the SLA elapses. Cancel/reschedule on every ticket edit.
2. **One recurring polling job** — a single job that runs every N seconds and scans for expired-but-unbreached tickets.

We also considered a `@nestjs/schedule` `@Cron(...)` in-process timer (no Redis), but Redis is already a hard dependency for Socket.io pub/sub, so adding BullMQ on top of the same Redis is essentially free infra-wise.

## Decision

We use **BullMQ with a single recurring repeat job**:

```ts
// sla.scheduler.ts
@Injectable()
export class SlaScheduler implements OnModuleInit {
  constructor(@InjectQueue(SLA_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SLA_CHECK_JOB,
      {},
      {
        repeat: { every: 60_000 },
        jobId: 'sla-check-recurring',
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }
}
```

The job is processed by a BullMQ `WorkerHost`:

```ts
// sla.processor.ts
@Processor(SLA_QUEUE)
export class SlaProcessor extends WorkerHost {
  constructor(private readonly sla: SlaService) { super(); }

  async process(job: Job): Promise<void> {
    if (job.name === SLA_CHECK_JOB) {
      const breached = await this.sla.checkBreaches();
      if (breached > 0) this.logger.log(`Processed ${breached} SLA breaches`);
    }
  }
}
```

`SlaService.checkBreaches()` queries tickets where `resolveDueAt < now()` and `breachedAt IS NULL`, marks them, and emits `ticket.sla.breached` events that the notifications module listens to.

## Alternatives Considered

### One BullMQ delayed job per deadline
- ✅ Precise — fires exactly when the deadline elapses
- ✅ Survives backend restarts
- ❌ Job count grows linearly with open tickets
- ❌ Recomputing on edit means scheduling a new job + cancelling the old one
- ❌ Significantly more code paths to test for cancel/reschedule races

### `@nestjs/schedule` `@Cron('*/60 * * * * *')` in-process
- ✅ Zero new infrastructure
- ✅ Trivially simple
- ❌ Doesn't survive backend restarts cleanly (work in flight is lost)
- ❌ Doesn't scale horizontally — multiple instances would do the same scan
- ❌ Harder to observe (no Bull Board, no per-job metrics)

### BullMQ recurring repeat job (chosen)
- ✅ One queue, one job, predictable load
- ✅ Reuses Redis we already have for Socket.io
- ✅ `jobId: 'sla-check-recurring'` guarantees idempotency on restart
- ✅ Bull Board / `prom-client` exporters give us free observability
- ✅ Scales horizontally for free — BullMQ guarantees at-most-one worker grabs the job
- ❌ Worst-case latency is 60s (acceptable for B2B SLA tooling)
- ❌ Tied to BullMQ — would have to migrate if we ever drop Redis

## Consequences

- The whole SLA pipeline lives in `backend/src/modules/sla/`.
- BullMQ + Redis are required infrastructure, not optional.
- Worst-case false-negative window for a breach: 60 s.
- Adding more periodic background work later (notifications digest, cleanup, etc.) follows the same pattern — add a new processor under the existing queue or register a new queue.
- Graceful shutdown is handled by `app.enableShutdownHooks()` + BullMQ worker `close()`, plus Prisma `$disconnect()`.
