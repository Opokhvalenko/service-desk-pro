# ServiceDesk Pro — Technical Challenges

A curated list of the hardest problems I solved on this project, the root cause
of each, the fix I shipped, and what I learned. These are the things I'd
actually want a senior engineer to ask me about in an interview.

---

## 1. Race condition on ticket status changes

**Problem:** Two agents clicking "Resolve" on the same ticket within the same
second would both succeed — the second write silently overwrote the first, and
both `ticket.status_changed` events were emitted. Only the second one was
"real". Listeners (notifications, audit log, realtime) saw two transitions
that didn't actually happen sequentially.

**Root cause:** Classic lost-update race. The service did
`findUnique` → `assertCanTransition` → `update` as three separate operations.
Between the read and the write, another request could mutate the row, and
Prisma's regular `update` does not check the previous value.

**Solution:** Optimistic concurrency via Prisma `updateMany` with a WHERE
guard on the previously-observed status:

```ts
const result = await this.prisma.ticket.updateMany({
  where: { id, status: existing.status },  // guard
  data,
});
if (result.count === 0) {
  throw new ConflictException('Ticket was modified by another request. Reload and try again.');
}
```

If a concurrent writer already moved the row, `count` is 0 and the second
agent gets a 409 instead of silently overwriting. The status field itself
serves as the optimistic-lock version — no schema migration needed.

I also added a regression test that mocks `count: 0` and asserts both that
`ConflictException` is thrown **and** that `events.emit` is **not** called —
because emitting an event for a transition that didn't commit would be worse
than the original bug.

**Takeaway:** Defensive concurrency control belongs on the write itself, not
in a check-then-act sequence above it. Optimistic locking via existing domain
fields is cheaper than version columns when the field is naturally
"versionable" (status, state, etc.).

---

## 2. IDOR in audit log endpoint

**Problem:** Self-review caught that any authenticated user could read the
audit history of any ticket by guessing the ticket ID — the
`/api/audit/ticket/:id` endpoint was guarded by `JwtAuthGuard` but had no
ownership check. A requester could enumerate audit history of tickets they
weren't allowed to see.

**Root cause:** I had built RBAC scoping for the tickets endpoint
(`scopeForUser` filter on `findMany`) but didn't propagate it to the audit
service. The audit endpoint trusted the ticket ID parameter and queried
`auditLog.findMany({ where: { entityId: ticketId } })` directly.

**Solution:** Added an explicit access check that mirrors the ticket-view
RBAC rules:

```ts
async listForTicket(ticketId, user) {
  const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, ... });
  if (!ticket) throw new NotFoundException();
  const allowed =
    user.role === 'ADMIN' || user.role === 'TEAM_LEAD' ||
    (user.role === 'REQUESTER' && ticket.createdById === user.id) ||
    (user.role === 'AGENT' && (ticket.assigneeId === user.id || ticket.assigneeId === null));
  if (!allowed) throw new ForbiddenException();
  return this.prisma.auditLog.findMany({ ... });
}
```

Plus a unit test covering all 8 RBAC scenarios (admin/lead see anything,
requester sees own only, agent sees assigned + unassigned only, others 403).

**Takeaway:** Defence in depth — guards alone aren't enough for object-level
authorization. Every endpoint that takes an entity ID must check that the
user is allowed to see *that specific entity*, not just *any entity of this type*.
This is OWASP A01:2021 (Broken Access Control) territory and one of the most
common real-world vulnerabilities.

---

## 3. PII leak via list endpoints

**Problem:** Agents browsing the queue could see the email address of every
ticket requester — including tickets they hadn't claimed yet. For a real
deployment with hundreds of tickets per day this leaks personal data to
employees who don't currently need it.

**Root cause:** The `tickets.list` endpoint serialized the full `createdBy`
relation including `email`. There was no per-row authorization decision —
all agents saw all PII on every list response.

**Solution:** A `maskRequesterPii()` post-processor applied per item in the
list response, before serialization:

```ts
private maskRequesterPii(ticket, user) {
  if (user.role !== 'AGENT') return ticket;        // admin/lead — full
  if (ticket.assigneeId === user.id) return ticket; // own — full
  return { ...ticket, createdBy: { ...ticket.createdBy, email: '' } };
}
```

Logic: requester sees only own tickets (so masking is a no-op), admin/lead
need full info for management, agent sees the email **only after** they claim
the ticket (the act of claiming is implicit consent to see the user's
contact info). On the queue/browse view, fullName remains visible for context
but email is blanked.

**Takeaway:** PII protection isn't a backend concern OR a frontend concern —
it's a per-request authorization decision. Mask at the edge, not at the
component level, so the data never even reaches the client.

---

## 4. Listener failures killing the write path

**Problem:** When the SMTP server hiccupped, the `notifications.listener`
threw, EventEmitter2 propagated the error up the call stack, and the
HTTP request that originally created the ticket got a 500 — even though the
ticket was already persisted. The user saw "create failed" and clicked
again, creating duplicates.

**Root cause:** Two related mistakes:
1. `EventEmitter2.emit()` is synchronous in the call site by default — a
   throwing listener bubbles back to the emitter.
2. The listener didn't have try-catch, so any downstream failure (DB read,
   mail send, notification create) crashed the whole listener.

**Solution:** Two-layer defence:

```ts
// In the service that emits:
private safeEmit(event: string, payload: unknown): void {
  try { this.events.emit(event, payload); }
  catch (err) { this.logger.error(`Listener for ${event} threw: ${err.message}`); }
}

// In each @OnEvent handler:
@OnEvent(TICKET_EVENTS.ASSIGNED)
async onAssigned(payload) {
  try {
    // ... do work
  } catch (err) {
    this.logFailure('TICKET_ASSIGNED', payload.ticketId, err);
  }
}
```

Plus, in the SLA breach listener, an inner try-catch around per-recipient
mail sends so one bad address doesn't abort the loop and skip the remaining
recipients.

I covered all four listeners with regression tests that mock a thrown error
and assert the listener resolves cleanly (never rethrows) and the error is
logged.

**Takeaway:** Once a write commits, the user should always get a 200. Any
downstream notification/audit/realtime work is best-effort — failures must
be observed (logs, metrics, Sentry) but never propagated back to the
HTTP layer. This is the "emit and forget" half of event-driven architecture,
and it's surprisingly easy to get wrong.

---

## 5. Non-atomic password change

**Problem:** `changePassword` did `user.update({ passwordHash })` and then
`refreshToken.updateMany({ revokedAt: now })` as two separate writes. If the
process crashed between them — or even if a network blip happened between the
two TCP packets — the user would have a new password but their old refresh
tokens would still be valid. The "log out everywhere" guarantee that
change-password is supposed to provide would be silently broken.

**Root cause:** Two writes that have to commit together were two separate
Prisma calls.

**Solution:** Wrap both writes in `prisma.$transaction([...])`:

```ts
await this.prisma.$transaction([
  this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
  this.prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  }),
]);
```

Now either both writes commit or both roll back. There's no window where a
partially-applied state could survive a crash.

**Takeaway:** Any operation that has multiple "must-happen-together" writes
needs a transaction. The cost is small (one extra round-trip), the benefit
is correctness under failure. The bug is invisible until it bites you in
production at 3am.

---

## 6. WebSocket gateway can't read process.env

**Problem:** The `@WebSocketGateway` decorator needs `cors.origin` set at
module load time — it's a property of the decorator metadata, not a runtime
config. But `process.env.CORS_ORIGIN` was being read inside a method, so the
gateway always used the default and Vercel couldn't connect via wss://.

**Root cause:** Decorators are evaluated at module-load time, before
NestJS's DI container exists. You can't `inject(ConfigService)` into a
decorator argument, because there's nothing to inject from yet.

**Solution:** A top-level `const` that reads `process.env` directly at
module-load time, before the decorator runs:

```ts
const WS_CORS_ORIGIN: string[] | string =
  process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ?? 'http://localhost:4200';

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: WS_CORS_ORIGIN, credentials: true },
})
export class RealtimeGateway { ... }
```

The trade-off: this bypasses Nest's `ConfigModule` and reads `process.env`
directly. For a single, immutable, deploy-time configuration value, that's
acceptable — and it's the only way to get the value into a decorator.

**Takeaway:** Decorators run at JS module load. Anything that needs to be
configurable inside a decorator must be available **before** any DI happens —
which usually means a top-level const reading `process.env`, an `.env` file
loaded earlier in the boot sequence, or hard-coded.

---

## 7. Render's free tier and CORS_ORIGIN with no protocol

**Problem:** First production deploy worked (BE healthcheck 200), but the
frontend got CORS errors on every API call. The preflight responses had no
`Access-Control-Allow-Origin` header at all.

**Root cause:** I'd set `CORS_ORIGIN=service-desk-pro-sepia.vercel.app` in
the Render dashboard — without the `https://` protocol. The CORS middleware
matches origins as exact strings, so the browser-sent `Origin:
https://service-desk-pro-sepia.vercel.app` didn't match the configured
`service-desk-pro-sepia.vercel.app` (no protocol). It silently fell through
to the default of "no allowed origin", returning a 204 with no allow-origin
header.

**Solution:** Add the protocol:
`CORS_ORIGIN=https://service-desk-pro-vercel.app`. Render auto-redeployed,
and the next preflight request returned the correct header. Verified with
`curl -i -X OPTIONS ... -H "Origin: https://..."`.

**Takeaway:** CORS origins are exact strings, not URL patterns. Always
include the protocol. And when debugging CORS, use `curl` to inspect the
actual headers — browser devtools sometimes hide the response body, and the
network panel doesn't always make the missing header obvious.

---

## 8. Playwright `getByLabel('Password')` strict-mode violation

**Problem:** Local Playwright tests passed, but the same tests on CI failed
with "strict mode violation: getByLabel('Password') resolved to 2 elements".
The login form has a password field with a "show password" toggle button,
and Playwright's strict mode considered the button to be inside the label
scope.

**Root cause:** Material's `<mat-form-field>` includes the `matSuffix` toggle
button inside the label-pointing `aria-labelledby` chain. So
`getByLabel('Password')` matched both the input AND the suffix toggle button.
Locally the version of Playwright had different strict-mode rules and only
the input matched; on CI, the stricter version matched both.

**Solution:** Switch from `getByLabel` to `getByRole`:
```ts
await page.getByRole('textbox', { name: 'Password' }).fill('password123');
```

`getByRole('textbox')` is unambiguous because the toggle button has role
`button`, not `textbox`. The test is also more semantically correct — we're
filling a textbox, not "the thing labeled Password".

**Takeaway:** Static parsing of test files (e.g. by linters or AI tools)
can't catch runtime locator collisions. Always run new e2e tests against a
real browser locally before pushing to CI — the failure mode I hit was
specific to the Material component's accessibility tree, which no static
check could've predicted.

---

## 9. Prisma `@@map` and raw SQL table names

**Problem:** A workload aggregation query I wrote with `prisma.$queryRaw`
worked locally but failed in production with `relation "Ticket" does not
exist`. Other queries (via Prisma client) worked fine.

**Root cause:** Prisma's `@@map("tickets")` directive on the model means
the actual PostgreSQL table is named `tickets` (lowercase, plural), but the
TypeScript model and Prisma client APIs use `Ticket` (PascalCase). When I
wrote raw SQL, I instinctively used the model name — `FROM "Ticket"` —
which is the TypeScript name, not the database name.

**Solution:** Use the actual table names in raw SQL:
```ts
await this.prisma.$queryRaw<WorkloadRow[]>`
  SELECT t."assigneeId" AS "assigneeId", u."fullName" AS "fullName",
    COUNT(*) FILTER (WHERE t.status::text NOT IN ('RESOLVED', 'CLOSED')) AS open,
    COUNT(*) FILTER (WHERE t.status::text = 'RESOLVED') AS resolved
  FROM tickets t
  JOIN users u ON u.id = t."assigneeId"
  WHERE t."assigneeId" IN (${Prisma.join(assigneeIds)})
  GROUP BY t."assigneeId", u."fullName"
`;
```

Plus the `::text` cast on the enum status column, because PostgreSQL enum
comparison with raw string literals doesn't auto-cast.

**Takeaway:** The boundary between Prisma's typed world and raw SQL is a
common source of bugs. When reaching for `$queryRaw`, double-check actual
table/column names with `\d+ tablename` in psql, not the Prisma schema.

---

## 10. macOS local Postgres conflicting with Docker on port 5432

**Problem:** Local e2e tests via Docker Compose would fail with "P1010:
denied access on database `sdp`" — even though `psql` to `127.0.0.1:5432`
worked and the user existed. Resetting docker-compose, recreating volumes,
and verifying credentials all yielded the same error.

**Root cause:** Homebrew `postgresql@17` was running on the host as a
service from a previous (Heartland Homes) project. macOS resolves
`127.0.0.1:5432` to the **first** listener it finds — and Homebrew's
PostgreSQL bound to the port before Docker's port-forward took effect. Every
connection went to the host PG, which didn't have the `sdp` user that
docker-compose's seed expects.

**Solution:** `brew services stop postgresql@17`. The Heartland project was
already deployed and didn't need the local PG anymore, so stopping it
permanently was the right call. After that, port 5432 cleanly resolved to
the docker-compose container.

**Takeaway:** Port conflicts are silent. When debugging "the service is
running, the credentials are right, but auth fails", check `lsof -i :PORT`
to see who's actually listening. Multi-project local dev environments
accumulate background services that conflict across projects.

---

## 11. tsconfig deprecation: `baseUrl` without `paths`

**Problem:** TypeScript 6 started warning that `baseUrl` is deprecated and
will be removed in TS 7.

**Root cause:** I had `"baseUrl": "./"` in `backend/tsconfig.json` from the
Nest CLI scaffold, but never added any `paths` mapping that would actually
use it. So `baseUrl` was sitting there as dead config — but it was still
deprecated, and the IDE was throwing warnings on every file.

**Solution:** Just delete it. No `paths` use it, no relative imports rely
on it, the build is clean without it. The fix is one line removed from one
file.

**Takeaway:** Dead config is technical debt that hides until a tool gets
strict. Periodically run `npx tsc --noEmit` and skim for warnings — they
catch deprecations early and prevent the cliff edge of "TS 7 is out, half
your projects break".

---

## 12. Cron seed workflow failing on Neon cold start

**Problem:** A nightly GitHub Actions cron (`seed-reset.yml`) had been
green for 5 days running the Prisma seed against Neon Postgres. Then on
two consecutive nights it failed with `PrismaClientInitializationError:
Can't reach database server at ep-...-pooler.eu-central-1.aws.neon.tech`.
No code changes, no secret changes. A manual `workflow_dispatch` run
the same morning passed in 33s.

**Root cause:** Neon's free-tier compute auto-suspends after ~5 minutes
of inactivity. The cron fires at 03:00 UTC, when the DB has been idle
all night. The cold-start handshake on a suspended compute can take
20–60 seconds, but Prisma's default `connect_timeout` is roughly 10s,
so the very first connection attempt times out before Neon finishes
waking. The manual run worked because opening the Neon dashboard had
already warmed the compute.

**Solution:** Add a "Wake up Neon" step before the seed step that pings
the DB with `SELECT 1;` in a retry loop:

```yaml
- name: Wake up Neon (handle cold start)
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    DIRECT_URL: ${{ secrets.DIRECT_URL }}
  run: |
    for i in 1 2 3 4 5; do
      echo "Attempt $i: pinging Neon..."
      if npx prisma db execute --schema=prisma/schema.prisma --stdin <<< "SELECT 1;"; then
        echo "Neon is warm"
        exit 0
      fi
      echo "Cold start in progress, retrying in 10s..."
      sleep 10
    done
    echo "Neon did not respond after 5 attempts"
    exit 1
```

Two non-obvious details that bit me during iteration:
- `prisma db execute` does not auto-detect `prisma/schema.prisma` the
  way `prisma migrate` does — `--schema` must be passed explicitly.
- Schema validation happens before the SQL ping, so any env var
  referenced in `schema.prisma` (here both `DATABASE_URL` and
  `DIRECT_URL`) must be present in the step's `env:` block, otherwise
  Prisma fails with `P1012 Environment variable not found` before it
  ever tries to reach the database.

**Takeaway:** Free-tier serverless databases trade cost for cold-start
latency, and CI cron jobs run at exactly the time when latency is
worst. When something flakes only at scheduled times but works on
manual triggers, suspect timing/state, not the code. The pre-warm
pattern (ping + retry before the real work) is cheap insurance worth
adding to any cron that touches a serverless DB.

---

## What didn't make this list

A few things I considered but left out — they're either covered in the ADRs
or they were too "tutorial-grade" to be interesting:

- BullMQ recurring job vs delayed-per-deadline (in `docs/adr/0005-sla-scheduler-in-process.md`)
- Why JWT in Authorization header instead of cookie (standard answer)
- How RBAC guards work in Nest (decorator + reflector — standard Nest)
- Material 3 + Tailwind v4 coexistence (just CSS layering, not interesting)

The ones above are the ones that actually taught me something — concurrency,
authorization, atomicity, failure isolation, decorator timing, deployment
pitfalls. If a senior engineer asks me "what's the hardest thing you fixed
on this project", any one of these is a legitimate answer.
