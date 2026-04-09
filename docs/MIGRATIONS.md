# Database Migrations

This document describes how we evolve the PostgreSQL schema safely. The
core principle is **expand-contract**: never break running code with a
migration, never break a migration with running code.

## Tooling

- **Prisma Migrate** generates and applies migrations.
- Migrations live in `backend/prisma/migrations/`.
- Each migration is a directory with a timestamped name and a single
  `migration.sql` file.

```bash
# Create a new migration after editing schema.prisma
cd backend
npx prisma migrate dev --name add_ticket_due_date

# Apply pending migrations in CI / production
npx prisma migrate deploy
```

`migrate dev` is for **local development only**. It can reset the
database. Never run it against staging or production. CI and production
always use `migrate deploy`, which is non-destructive and idempotent.

## The expand-contract pattern

A naive migration like "rename column `name` to `full_name`" is
dangerous: between the moment the migration runs and the moment the new
code is deployed, **the running old code is reading a column that no
longer exists**. The fix is to split the change into two releases:

### Release N — expand

1. Add the new column / table / index. Do **not** remove anything.
2. Backfill data into the new column.
3. Application code is updated to **write to both** the old and new
   columns and **read from the new** column.
4. Deploy.

At this point both old and new code run side-by-side without breaking,
because the old column still exists and is still being written to.

### Release N+1 — contract

1. Verify in monitoring that nothing is reading the old column anymore
   (add a metric or a log line on every read of the old column during
   release N to confirm).
2. Drop the old column / table / index.
3. Application code stops writing to the old column.
4. Deploy.

## Concrete examples

### Renaming a column

| Step               | Schema                           | Code                                  |
| ------------------ | -------------------------------- | ------------------------------------- |
| Before             | `name TEXT`                      | reads `name`, writes `name`           |
| Release N expand   | `name TEXT`, `full_name TEXT`    | reads `full_name`, writes both        |
| (backfill)         | `UPDATE users SET full_name = name WHERE full_name IS NULL` | — |
| Release N+1 contract | `full_name TEXT`               | reads `full_name`, writes `full_name` |

### Adding a NOT NULL column

You cannot add a NOT NULL column to a non-empty table without a default
or a backfill. The safe sequence:

1. Add the column as nullable.
2. Backfill in a separate transaction (or batched if the table is large).
3. Update application code to always write a value.
4. In a follow-up migration, set NOT NULL.

### Adding an index on a large table

`CREATE INDEX` takes a write lock on PostgreSQL by default. For tables
big enough to matter, use `CREATE INDEX CONCURRENTLY` and run it
**outside** a Prisma migration (Prisma wraps migrations in a
transaction, and `CONCURRENTLY` cannot run inside one).

The recipe:

1. Create an empty Prisma migration: `npx prisma migrate dev --create-only --name add_ticket_status_index`
2. Edit the generated `migration.sql` and replace it with:
   ```sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS "tickets_status_idx" ON "tickets" ("status");
   ```
3. Configure Prisma to not wrap this migration in a transaction by
   adding the directive at the top of the file:
   ```sql
   -- prisma-no-transaction
   ```
   (Prisma 5+ supports this. For older versions, run the SQL outside
   Prisma entirely.)

### Dropping a column

Always a contract step. Confirm via metrics that the column is no
longer read or written by **any** running version of the application
before dropping. When in doubt, wait one extra release cycle.

## Backfills

- **Small tables (< 100k rows)**: a single `UPDATE` in the migration
  itself is fine.
- **Large tables**: do the backfill in application code or a one-off
  script, **not** in the migration. Migrations should be fast and
  predictable. A multi-minute migration blocks deploys and risks
  timeouts.
- **Long-running backfills**: batch by primary key range, sleep between
  batches, log progress, and make the script resumable.

## Reviewing migrations

When reviewing a PR that touches `backend/prisma/migrations/`, check:

- [ ] Is this expand-only, or is it a contract for a previously-shipped
      expand?
- [ ] If it's a contract, has the corresponding expand been deployed
      and verified?
- [ ] Does the migration drop or rename anything? If yes, see above.
- [ ] Does it add a NOT NULL column? Is there a default or backfill?
- [ ] Does it add an index on a large table without `CONCURRENTLY`?
- [ ] Is there a backfill embedded in the migration that could time out?
- [ ] Does the application code in the same PR still work against the
      **old** schema? (It should, otherwise it's not expand-contract.)

## Rollback

Prisma does not generate down-migrations. Our rollback strategy is
**roll forward**:

1. If a migration breaks production, write a new migration that fixes
   it (or reverts the harmful change additively).
2. Deploy the fix-forward migration.
3. Never edit an already-applied migration in place. Prisma tracks
   applied migrations by checksum and will refuse to start.

For truly catastrophic cases (data loss), restore from backup. Neon
provides point-in-time recovery for the production database; the
restore procedure is documented in `DEPLOY.md`.

## Local development

`npx prisma migrate reset` is your friend during development. It drops
the local database, re-applies all migrations, and re-runs the seed.
Never run it against any database that contains data you care about.
